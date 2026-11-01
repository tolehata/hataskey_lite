/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { HataskFlowerV2Service } from './HataskFlowerV2Service.js';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { lockHataskFlowerWallet } from '@/core/hatask-flower-v2.js';
import type { RegistryItemsRepository } from '@/models/_.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { MiUser } from '@/models/User.js';
import { flowerDay } from './hatask-flower-v2.js';
import { validTodayJournalRow } from './hatagoes-daily.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import {
	HATASK_PLANNER_COLLECTIONS,
	HATASK_PLANNER_CORE_COLLECTIONS,
	HATASK_PLANNER_SCOPE,
	HATASK_PLANNER_SHADOW_FORMAT,
	HATASK_PLANNER_SHADOW_KEY,
	HATASK_PLANNER_SHADOW_VERSION,
	HATASK_PLANNER_TARGET_SCHEMA_VERSION,
	HATASK_PLANNER_VALUE_MAX_BYTES,
	appendPlannerBackup,
	assertPlannerValue,
	createPlannerMigrationShadowSource,
	findPlannerRows,
	hashPlannerShadowSource,
	hashPlannerValue,
	isEquivalentPlannerMigrationShadow,
	latestPlannerRow,
	mergePlannerRows,
	plannerBackupKey,
	plannerRawRows,
	readBackupEnvelope,
	type HataskPlannerCoreCollection,
	type HataskPlannerCollection,
	type PlannerMigrationShadow,
	type PlannerMigrationTargetIntegrity,
} from '@/server/api/endpoints/hatask/planner/_shared.js';

@Injectable()
export class RegistryApiService {
	constructor(
		private flowerService: HataskFlowerV2Service,
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,

		private idService: IdService,
		private globalEventService: GlobalEventService,
	) {
	}

	@bindThis
	public async set(userId: MiUser['id'], domain: string | null, scope: string[], key: string, value: any) {
		// TODO: 作成できるキーの数を制限する
		const isNativeHataskPlannerScope = domain == null &&
			scope.length === HATASK_PLANNER_SCOPE.length &&
			scope.every((part, index) => part === HATASK_PLANNER_SCOPE[index]);
		if (isNativeHataskPlannerScope && key === HATASK_PLANNER_SHADOW_KEY) {
			throw new IdentifiableError('6ba201a8-59d4-4be4-aae1-9d1343306009', 'Use hatask/planner/create-shadow to create the migration shadow.');
		}
		if (isNativeHataskPlannerScope && HATASK_PLANNER_COLLECTIONS.map(plannerBackupKey).includes(key)) {
			throw new IdentifiableError('46e6e2cd-1d6b-4a91-8fd6-f051db88b85b', 'Hatask planner backups are write-protected.');
		}
		if (
			isNativeHataskPlannerScope &&
			(HATASK_PLANNER_COLLECTIONS as readonly string[]).includes(key)
		) {
			// 旧フロントの i/registry/set も新CAS endpointと同じlock/backupへ参加させる。
			// これにより、移行期間中に古いタブが書いても直前値は必ず世代バックアップへ残る。
			const collection = key as HataskPlannerCollection;
			assertPlannerValue(value, collection);
			if (Buffer.byteLength(JSON.stringify(value), 'utf8') > HATASK_PLANNER_VALUE_MAX_BYTES) {
				throw new TypeError('Hatask planner data is too large.');
			}
			await this.registryItemsRepository.manager.transaction(async manager => {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-planner:${userId}:${collection}`]);
				if (collection === 'todos') await lockHataskFlowerWallet(manager, userId);
				const backupKey = plannerBackupKey(collection);
				const migrationMarkerKey = HATASK_PLANNER_SHADOW_KEY;
				const rows = await findPlannerRows(manager, userId, [collection, backupKey, migrationMarkerKey], true);
				if (rows.some(row => row.key === migrationMarkerKey)) {
					throw new IdentifiableError('77e11876-8b64-4ee4-9093-a51dbd927e75', 'Hatask planner migration is complete. Refresh the client before saving.');
				}
				const collectionRows = rows.filter(row => row.key === collection);
				const latest = latestPlannerRow(collectionRows);
				const previous = mergePlannerRows(collectionRows);
				const now = new Date();
				const repo = manager.getRepository(MiRegistryItem);

				if (latest != null) {
					const backupRows = rows.filter(row => row.key === backupKey);
					const latestBackup = latestPlannerRow(backupRows);
					const envelope = appendPlannerBackup(
						readBackupEnvelope(latestBackup?.value),
						previous,
						latest.updatedAt.toISOString(),
						now.toISOString(),
						plannerRawRows(collectionRows),
					);
					if (latestBackup == null) {
						await repo.insert({
							id: this.idService.gen(now.getTime()), updatedAt: now, userId, domain: null,
							scope: [...HATASK_PLANNER_SCOPE], key: backupKey, value: envelope as any,
						});
					} else {
						await repo.update(backupRows.map(row => row.id), { updatedAt: now, value: envelope as any });
					}
				}

				if (latest == null) {
					await repo.insert({ id: this.idService.gen(now.getTime()), updatedAt: now, userId, domain: null, scope: [...HATASK_PLANNER_SCOPE], key: collection, value });
				} else {
					await repo.update(collectionRows.map(row => row.id), { updatedAt: now, value });
				}
				if (collection === 'todos') await this.flowerService.onTodosCommitted(manager, userId, previous, value);
			});
			return;
		}
		if (isNativeHataskPlannerScope && (key === 'moods' || key === 'meals')) {
			await this.registryItemsRepository.manager.transaction(async manager => {
				const kind = key === 'moods' ? 'mood' : 'meal';
				await lockHataskFlowerWallet(manager, userId);
				const [wallet] = await manager.query('SELECT timezone FROM hatask_drop_wallet WHERE "userId"=$1', [userId]);
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatagoes-journal:${userId}:${key}`]);
				const repo = manager.getRepository(MiRegistryItem);
				const rows = await repo.createQueryBuilder('item').where('item.domain IS NULL').andWhere('item.userId = :userId', { userId }).andWhere('item.scope = :scope', { scope }).andWhere('item.key = :key', { key }).orderBy('item.updatedAt', 'DESC').addOrderBy('item.id', 'DESC').setLock('pessimistic_write').getMany();
				const now = new Date();
				const today = flowerDay(now, wallet?.timezone);
				const previouslyValidIds = new Set(rows.flatMap(item => Array.isArray(item.value) ? item.value.filter((entry: unknown) => validTodayJournalRow(entry, kind, today)).map((entry: { id: string }) => entry.id) : []));
				if (rows.length) await repo.update(rows.map(row => row.id), { updatedAt: now, value });
				else await repo.insert({ id: this.idService.gen(now.getTime()), updatedAt: now, userId, domain: null, scope, key, value });
				if (Array.isArray(value) && value.some(row => validTodayJournalRow(row, kind, today) && !previouslyValidIds.has(row.id))) await this.flowerService.onJournalCommitted(manager, userId, kind, now);
			});
			this.globalEventService.publishMainStream(userId, 'registryUpdated', { scope, key, value });
			return;
		}

		const query = this.registryItemsRepository.createQueryBuilder('item');
		if (domain) {
			query.where('item.domain = :domain', { domain: domain });
		} else {
			query.where('item.domain IS NULL');
		}
		query.andWhere('item.userId = :userId', { userId: userId });
		query.andWhere('item.key = :key', { key: key });
		query.andWhere('item.scope = :scope', { scope: scope });

		const existingItem = await query.getOne();

		if (existingItem) {
			await this.registryItemsRepository.update(existingItem.id, {
				updatedAt: new Date(),
				value: value,
			});
		} else {
			await this.registryItemsRepository.insert({
				id: this.idService.gen(),
				updatedAt: new Date(),
				userId: userId,
				domain: domain,
				scope: scope,
				key: key,
				value: value,
			});
		}

		if (domain == null) {
			// TODO: サードパーティアプリが傍受出来てしまうのでどうにかする
			this.globalEventService.publishMainStream(userId, 'registryUpdated', {
				scope: scope,
				key: key,
				value: value,
			});
		}
	}

	@bindThis
	public async createHataskPlannerMigrationShadow(
		userId: MiUser['id'],
		expectedRevisions: Record<HataskPlannerCoreCollection, string | null>,
		targetIntegrity: PlannerMigrationTargetIntegrity,
	): Promise<{ created: boolean; revision: string; sourceHash: string; rawRowCount: number }> {
		return await this.registryItemsRepository.manager.transaction(async manager => {
			// Match commit-batch's order when a migration overlaps another client's save.
			for (const collection of [...HATASK_PLANNER_CORE_COLLECTIONS].sort()) {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-planner:${userId}:${collection}`]);
			}

			const rows = await findPlannerRows(manager, userId, [...HATASK_PLANNER_CORE_COLLECTIONS, HATASK_PLANNER_SHADOW_KEY], true);
			const source = createPlannerMigrationShadowSource(rows);
			for (const collection of HATASK_PLANNER_CORE_COLLECTIONS) {
				const collectionRows = rows.filter(row => row.key === collection);
				const latest = latestPlannerRow(collectionRows);
				const entry = source[collection];
				const actualRevision = latest == null || entry.status === 'missing'
					? null
					: `${latest.updatedAt.toISOString()}:${hashPlannerValue(entry.value)}`;
				if (actualRevision !== expectedRevisions[collection]) {
					throw new IdentifiableError('fbc74e90-140f-4288-93aa-6d88eb4765ea', 'Hatask planner data changed before migration backup.');
				}
				if (entry.status === 'loaded' ? entry.value.length !== targetIntegrity.collections[collection].count : targetIntegrity.collections[collection].count !== 0) {
					throw new IdentifiableError('e3444ce7-0d3f-4471-bd0c-6e09e67daa47', 'Hatask planner migration target does not match the stored item count.');
				}
				if (entry.status === 'loaded' && Buffer.byteLength(JSON.stringify(entry.value), 'utf8') > HATASK_PLANNER_VALUE_MAX_BYTES) {
					throw new IdentifiableError('97ea3e66-8a62-4919-a7da-0b16b25677e0', 'Hatask planner data is too large for an atomic migration commit.');
				}
			}

			const now = new Date();
			const shadow: PlannerMigrationShadow = {
				format: HATASK_PLANNER_SHADOW_FORMAT,
				version: HATASK_PLANNER_SHADOW_VERSION,
				targetSchemaVersion: HATASK_PLANNER_TARGET_SCHEMA_VERSION,
				createdAt: now.toISOString(),
				source,
				sourceHash: hashPlannerShadowSource(source),
				targetIntegrity,
			};
			const markerRows = rows.filter(row => row.key === HATASK_PLANNER_SHADOW_KEY);
			const latestMarker = latestPlannerRow(markerRows);
			if (latestMarker != null) {
				if (!isEquivalentPlannerMigrationShadow(latestMarker.value, shadow)) {
					throw new IdentifiableError('3cb60500-7526-42d1-b102-2805984ee177', 'A different Hatask planner migration shadow already exists.');
				}
				return {
					created: false,
					revision: latestMarker.updatedAt.toISOString(),
					sourceHash: shadow.sourceHash,
					rawRowCount: Object.values(source).reduce((count, entry) => count + (entry.status === 'loaded' ? entry.rawRows.length : 0), 0),
				};
			}

			await manager.getRepository(MiRegistryItem).insert({
				id: this.idService.gen(now.getTime()),
				updatedAt: now,
				userId,
				domain: null,
				scope: [...HATASK_PLANNER_SCOPE],
				key: HATASK_PLANNER_SHADOW_KEY,
				value: shadow as any,
			});
			return {
				created: true,
				revision: now.toISOString(),
				sourceHash: shadow.sourceHash,
				rawRowCount: Object.values(source).reduce((count, entry) => count + (entry.status === 'loaded' ? entry.rawRows.length : 0), 0),
			};
		});
	}

	@bindThis
	public async getItem(userId: MiUser['id'], domain: string | null, scope: string[], key: string): Promise<MiRegistryItem | null> {
		const query = this.registryItemsRepository.createQueryBuilder('item')
			.where(domain == null ? 'item.domain IS NULL' : 'item.domain = :domain', { domain: domain })
			.andWhere('item.userId = :userId', { userId: userId })
			.andWhere('item.key = :key', { key: key })
			.andWhere('item.scope = :scope', { scope: scope });

		const item = await query.getOne();

		return item;
	}

	@bindThis
	public async getAllItemsOfScope(userId: MiUser['id'], domain: string | null, scope: string[]): Promise<MiRegistryItem[]> {
		const query = this.registryItemsRepository.createQueryBuilder('item');
		query.where(domain == null ? 'item.domain IS NULL' : 'item.domain = :domain', { domain: domain });
		query.andWhere('item.userId = :userId', { userId: userId });
		query.andWhere('item.scope = :scope', { scope: scope });

		const items = await query.getMany();

		return items;
	}

	@bindThis
	public async getAllKeysOfScope(userId: MiUser['id'], domain: string | null, scope: string[]): Promise<string[]> {
		const query = this.registryItemsRepository.createQueryBuilder('item');
		query.select('item.key');
		query.where(domain == null ? 'item.domain IS NULL' : 'item.domain = :domain', { domain: domain });
		query.andWhere('item.userId = :userId', { userId: userId });
		query.andWhere('item.scope = :scope', { scope: scope });

		const items = await query.getMany();

		return items.map(x => x.key);
	}

	@bindThis
	public async getAllScopeAndDomains(userId: MiUser['id']): Promise<{ domain: string | null; scopes: string[][] }[]> {
		const query = this.registryItemsRepository.createQueryBuilder('item')
			.select(['item.scope', 'item.domain'])
			.where('item.userId = :userId', { userId: userId });

		const items = await query.getMany();

		const res = [] as { domain: string | null; scopes: string[][] }[];

		for (const item of items) {
			const target = res.find(x => x.domain === item.domain);
			if (target) {
				if (target.scopes.some(scope => scope.join('.') === item.scope.join('.'))) continue;
				target.scopes.push(item.scope);
			} else {
				res.push({
					domain: item.domain,
					scopes: [item.scope],
				});
			}
		}

		return res;
	}

	@bindThis
	public async remove(userId: MiUser['id'], domain: string | null, scope: string[], key: string) {
		if (
			domain == null &&
			scope.length === HATASK_PLANNER_SCOPE.length &&
			scope.every((part, index) => part === HATASK_PLANNER_SCOPE[index]) &&
			[
				...HATASK_PLANNER_COLLECTIONS,
				...HATASK_PLANNER_COLLECTIONS.map(plannerBackupKey),
				HATASK_PLANNER_SHADOW_KEY,
			].includes(key)
		) {
			throw new IdentifiableError('1b5d9a06-6385-4a9f-9d86-613954867cf7', 'Hatask planner collections cannot be removed. Save an empty verified array instead.');
		}
		const query = this.registryItemsRepository.createQueryBuilder().delete();
		if (domain) {
			query.where('domain = :domain', { domain: domain });
		} else {
			query.where('domain IS NULL');
		}
		query.andWhere('userId = :userId', { userId: userId });
		query.andWhere('key = :key', { key: key });
		query.andWhere('scope = :scope', { scope: scope });

		await query.execute();
	}
}
