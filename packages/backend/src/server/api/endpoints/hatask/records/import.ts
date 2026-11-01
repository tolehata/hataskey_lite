/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { lockHataskFlowerWallet } from '@/core/hatask-flower-v2.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { hataskModeratedRecordError, rethrowHataskModerationError } from '@/misc/hatask-moderated-record.js';
import { FLOWER_ARCHIVE_KEY, flowerRecordSchema, mealRecordSchema, moodRecordSchema, RECORD_MAX_BYTES, RECORD_SCOPE, mergeRecords, parseImport, type RecordKind } from './_shared.js';

const countsSchema = { type: 'object', properties: { moods: { type: 'integer' }, meals: { type: 'integer' }, flowers: { type: 'integer' } }, required: ['moods', 'meals', 'flowers'] } as const;
export const meta = {
	tags: ['hatask'], requireCredential: true, secure: true, kind: 'write:account',
	bodyLimit: RECORD_MAX_BYTES + 64 * 1024, limit: { duration: 60000, max: 5 },
	res: { type: 'object', properties: { added: countsSchema, duplicates: countsSchema, conflicts: countsSchema }, required: ['added', 'duplicates', 'conflicts'] },
	errors: {
		invalidPayload: { message: 'The Hatask record export is invalid.', code: 'HATASK_RECORDS_INVALID_PAYLOAD', id: '9508cb42-47ca-4d14-b39c-dda8d6728b10' },
		invalidStoredData: { message: 'Saved Hatask records contain an ambiguous collection or ID.', code: 'HATASK_RECORDS_INVALID_STORED_DATA', id: 'f3cf817b-48e4-4c99-9c62-ff279fed2031' },
		payloadTooLarge: { message: 'The Hatask record export is too large.', code: 'HATASK_RECORDS_PAYLOAD_TOO_LARGE', id: '7ccdf17b-b664-40f7-999d-40331619ddf4' },
		moderated: hataskModeratedRecordError,
	},
} as const;

export const paramDef = { type: 'object', properties: { format: { type: 'string' }, version: { type: 'integer' }, exportedAt: { type: 'string' }, data: {
	type: 'object', properties: {
		moods: { type: 'array', maxItems: 50000, items: moodRecordSchema }, meals: { type: 'array', maxItems: 50000, items: mealRecordSchema }, flowers: { type: 'array', maxItems: 50000, items: flowerRecordSchema },
	}, required: ['moods', 'meals', 'flowers'],
} }, required: ['format', 'version', 'exportedAt', 'data'], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.db) private db: DataSource, private idService: IdService, private globalEventService: GlobalEventService) {
		super(meta, paramDef, async (ps, me) => {
			if (Buffer.byteLength(JSON.stringify(ps), 'utf8') > RECORD_MAX_BYTES) throw new ApiError(meta.errors.payloadTooLarge);
			let incoming: ReturnType<typeof parseImport>;
			try { incoming = parseImport(ps); } catch { throw new ApiError(meta.errors.invalidPayload); }
			const changed: { key: string; value: Record<string, unknown>[] }[] = [];
			const result = await this.db.transaction(async manager => {
				// Match RegistryApiService.set: wallet first, then journal locks in a stable order.
				await lockHataskFlowerWallet(manager, me.id);
				for (const key of ['meals', 'moods']) await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatagoes-journal:${me.id}:${key}`]);
				const repo = manager.getRepository(MiRegistryItem);
				const rows = await repo.createQueryBuilder('item').where('item.domain IS NULL').andWhere('item.userId = :userId', { userId: me.id })
					.andWhere('item.scope = :scope', { scope: [...RECORD_SCOPE] }).andWhere('item.key IN (:...keys)', { keys: ['moods', 'meals', FLOWER_ARCHIVE_KEY] })
					.orderBy('item.updatedAt', 'ASC').addOrderBy('item.id', 'ASC').setLock('pessimistic_write').getMany();
				if (['moods', 'meals', FLOWER_ARCHIVE_KEY].some(key => rows.filter(row => row.key === key).length > 1)) throw new ApiError(meta.errors.invalidStoredData);
				const harvested: { entry: unknown }[] = await manager.query('SELECT entry FROM hatask_flower_harvest WHERE "userId"=$1 ORDER BY id ASC', [me.id]);
				const prepare = (kind: RecordKind) => {
					const key = kind === 'flowers' ? FLOWER_ARCHIVE_KEY : kind;
					const matching = rows.filter(row => row.key === key);
					const raw = matching.flatMap(row => {
						if (!Array.isArray(row.value)) throw new TypeError('Invalid stored collection');
						return row.value;
					});
					if (kind === 'flowers') {
						const combined = [...harvested.map(row => row.entry), ...raw];
						const merged = mergeRecords(combined, incoming.flowers, kind);
						return { kind, key, matching, merged: { ...merged, value: [...raw, ...merged.value.slice(combined.length)] } };
					}
					return { kind, key, matching, merged: mergeRecords(raw, incoming[kind], kind) };
				};
				let prepared: ReturnType<typeof prepare>[];
				try { prepared = (['moods', 'meals', 'flowers'] as const).map(prepare); } catch { throw new ApiError(meta.errors.invalidStoredData); }
				if (prepared.some(item => item.merged.value.length > 50000)) throw new ApiError(meta.errors.payloadTooLarge);
				const exportShape = { format: 'hatask-records-export', version: 1, exportedAt: new Date().toISOString(), data: {
					moods: prepared[0].merged.value, meals: prepared[1].merged.value,
					flowers: [...harvested.map(row => row.entry), ...prepared[2].merged.value],
				} };
				if (Buffer.byteLength(JSON.stringify(exportShape), 'utf8') > RECORD_MAX_BYTES) throw new ApiError(meta.errors.payloadTooLarge);
				const newFlowers = prepared[2].merged.value.slice(rows.find(row => row.key === FLOWER_ARCHIVE_KEY)?.value instanceof Array ? (rows.find(row => row.key === FLOWER_ARCHIVE_KEY)!.value as unknown[]).length : 0);
				if (newFlowers.length) {
					await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`record-moderation:hatask:${me.id}`]);
					const blocked = await manager.query(`SELECT 1 FROM jsonb_array_elements($2::jsonb) item JOIN record_moderation_tombstone t ON t."userId"=$1 AND t.key='gallery' AND t.identity=hatask_record_identity('gallery',item) LIMIT 1`, [me.id, JSON.stringify(newFlowers)]);
					if (blocked.length) throw new ApiError(meta.errors.moderated);
				}
				const added = { moods: 0, meals: 0, flowers: 0 }, duplicates = { ...added }, conflicts = { ...added };
				const now = new Date();
				for (const item of prepared) {
					added[item.kind] = item.merged.added;
					duplicates[item.kind] = item.merged.duplicates;
					conflicts[item.kind] = item.merged.conflicts;
					if (!item.merged.added) continue;
					if (Buffer.byteLength(JSON.stringify(item.merged.value), 'utf8') > RECORD_MAX_BYTES) throw new ApiError(meta.errors.payloadTooLarge);
					if (item.matching.length) await repo.update(item.matching.map(row => row.id), { updatedAt: now, value: item.merged.value });
					else await repo.insert({ id: this.idService.gen(now.getTime()), updatedAt: now, userId: me.id, domain: null, scope: [...RECORD_SCOPE], key: item.key, value: item.merged.value });
					changed.push({ key: item.key, value: item.merged.value });
				}
				return { added, duplicates, conflicts };
			}).catch(rethrowHataskModerationError);
			for (const item of changed) this.globalEventService.publishMainStream(me.id, 'registryUpdated', { scope: [...RECORD_SCOPE], key: item.key, value: item.value });
			return result;
		});
	}
}
