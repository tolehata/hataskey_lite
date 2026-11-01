/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { checkedRows, cleanRecord, FLOWER_ARCHIVE_KEY, flowerRecordSchema, mealRecordResponseSchema, moodRecordResponseSchema, RECORD_MAX_BYTES, RECORD_SCOPE } from './_shared.js';

export const meta = {
	tags: ['hatask'], requireCredential: true, secure: true, kind: 'read:account',
	limit: { duration: 60000, max: 10 },
	res: { type: 'object', properties: {
		format: { type: 'string' }, version: { type: 'integer' }, exportedAt: { type: 'string' },
		data: { type: 'object', properties: {
			moods: { type: 'array', items: moodRecordResponseSchema }, meals: { type: 'array', items: mealRecordResponseSchema }, flowers: { type: 'array', items: flowerRecordSchema },
		}, required: ['moods', 'meals', 'flowers'] },
	}, required: ['format', 'version', 'exportedAt', 'data'] },
	errors: { invalidStoredData: { message: 'Saved Hatask records cannot be exported safely.', code: 'HATASK_RECORDS_INVALID_STORED_DATA', id: '63f96280-f2c4-4eb6-a9f5-303112fa7c6b' } },
} as const;
export const paramDef = { type: 'object', properties: {}, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.db) private db: DataSource) {
		super(meta, paramDef, async (_ps, me) => {
			try {
				const rows: { key: string; value: unknown }[] = await this.db.query('SELECT key,value FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=$2 AND key=ANY($3::varchar[]) ORDER BY "updatedAt" ASC,id ASC', [me.id, [...RECORD_SCOPE], ['moods', 'meals', FLOWER_ARCHIVE_KEY]]);
				for (const key of ['moods', 'meals', FLOWER_ARCHIVE_KEY]) if (rows.filter(row => row.key === key).length > 1) throw new TypeError('Ambiguous stored collection');
				const journal = (key: 'moods' | 'meals') => rows.filter(row => row.key === key).flatMap(row => {
					if (!Array.isArray(row.value)) throw new TypeError('Invalid stored collection');
					return row.value;
				});
				const harvested: { entry: unknown }[] = await this.db.query('SELECT entry FROM hatask_flower_harvest WHERE "userId"=$1 ORDER BY id ASC', [me.id]);
				const archived = rows.filter(row => row.key === FLOWER_ARCHIVE_KEY).flatMap(row => {
					if (!Array.isArray(row.value)) throw new TypeError('Invalid stored flower archive');
					return row.value;
				});
				const flowers = checkedRows([...harvested.map(row => cleanRecord(row.entry, 'flowers')), ...archived], 'flowers');
				const file = { format: 'hatask-records-export', version: 1, exportedAt: new Date().toISOString(), data: { moods: checkedRows(journal('moods'), 'moods'), meals: checkedRows(journal('meals'), 'meals'), flowers } };
				if (Buffer.byteLength(JSON.stringify(file), 'utf8') > RECORD_MAX_BYTES) throw new TypeError('Export exceeds import limit');
				return file;
			} catch (error) { if (error instanceof TypeError) throw new ApiError(meta.errors.invalidStoredData); throw error; }
		});
	}
}
