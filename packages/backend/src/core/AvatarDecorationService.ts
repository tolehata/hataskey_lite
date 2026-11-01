/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as Redis from 'ioredis';
import { IsNull, Not } from 'typeorm';
import type { AvatarDecorationsRepository, InstancesRepository, UsersRepository } from '@/models/_.js';
import { MiAvatarDecoration } from '@/models/AvatarDecoration.js';
import { MiUser } from '@/models/User.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MemorySingleCache } from '@/misc/cache.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { appendQuery, query } from '@/misc/prelude/url.js';
import type { Config } from '@/config.js';
import type { RoleService } from '@/core/RoleService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { Packed } from '@/misc/json-schema.js';
import { avatarDecorationUnavailableReason, type AvatarDecorationUnavailableReason } from '@/core/avatar-decoration-availability.js';
import { hasCompletedHataskFlowerCollection, hasCompletedHataskFlowerCollectionMany, recordHataskFlowerCollectionCompletion, recordCurrentSeasonHataskFlowerCompletions } from '@/core/hatask-flower-completion.js';

export class HataskAvatarDecorationUpdateError extends Error {
	constructor(public readonly reason: 'notFound' | 'invalidReplacement' | 'replacementConflict') {
		super(reason);
	}
}

// TODO:
// 1. checkDuplicateする => done
// 2. リモートのデコレーションをproxy通してないメディアURLで保存できるようにする => プロキシのURLだと403になるので必須
// 3. AvatarDecorationsEntityServiceを作ってpackする
// 4. リモートユーザーのデコレーションを適宜fetchできる関数とAPIを作る
// 5. remoteUserUpdateの処理をAPIfetchの部分とアップデートの部分に分ける => 4をやるためには必要
// 6. するか迷う: MiAvatarDecorationのカラムにdescriptionの他にライセンス欄を追加する
// 7. するか迷う: APubでデコレーションを配信する? => Misskey自体は今のところやることなさそうだからやるならnsを作る必要がある
// 8. avatar-decorationのjson-schemaを作る => packするためには必要
@Injectable()
export class AvatarDecorationService implements OnApplicationShutdown {
	public cache: MemorySingleCache<MiAvatarDecoration[]>;
	public cacheWithRemote: MemorySingleCache<MiAvatarDecoration[]>;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.avatarDecorationsRepository)
		private avatarDecorationsRepository: AvatarDecorationsRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private httpRequestService: HttpRequestService,
		private moduleRef: ModuleRef,
	) {
		this.cache = new MemorySingleCache<MiAvatarDecoration[]>(1000 * 60 * 30); // 30s
		this.cacheWithRemote = new MemorySingleCache<MiAvatarDecoration[]>(1000 * 60 * 30); // 30s

		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as GlobalEvents['internal']['payload'];
			switch (type) {
				case 'avatarDecorationCreated':
				case 'avatarDecorationUpdated':
				case 'avatarDecorationDeleted': {
					this.cache.delete();
					this.cacheWithRemote.delete();
					break;
				}
				default:
					break;
			}
		}
	}

	@bindThis
	public async create(options: Partial<MiAvatarDecoration>, moderator?: MiUser): Promise<MiAvatarDecoration> {
		const created = await this.avatarDecorationsRepository.insertOne({
			id: this.idService.gen(),
			...options,
		});
		this.cache.delete();
		this.cacheWithRemote.delete();

		this.globalEventService.publishInternalEvent('avatarDecorationCreated', created);

		if (moderator) {
			this.moderationLogService.log(moderator, 'createAvatarDecoration', {
				avatarDecorationId: created.id,
				avatarDecoration: created,
			});
		}

		return created;
	}

	@bindThis
	public async update(id: MiAvatarDecoration['id'], params: Partial<MiAvatarDecoration>, moderator?: MiUser): Promise<void> {
		const avatarDecoration = await this.avatarDecorationsRepository.findOneByOrFail({ id });

		const date = new Date();
		await this.avatarDecorationsRepository.update(avatarDecoration.id, {
			updatedAt: date,
			...params,
		});

		const updated = await this.avatarDecorationsRepository.findOneByOrFail({ id: avatarDecoration.id });
		this.publishUpdatedDecoration(avatarDecoration, updated, moderator);
	}

	/** The old reward and its replacement change together, without changing either image or role policy. */
	@bindThis
	public async configureHataskDecoration(
		id: MiAvatarDecoration['id'],
		params: Pick<MiAvatarDecoration, 'requiresHataskFlowerCompletion' | 'availableFrom' | 'availableUntil'>,
		moderator: MiUser,
		replaceFromId?: MiAvatarDecoration['id'],
	): Promise<void> {
		if (replaceFromId != null && (replaceFromId === id || !params.requiresHataskFlowerCompletion)) {
			throw new HataskAvatarDecorationUpdateError('invalidReplacement');
		}
		const changes = await this.avatarDecorationsRepository.manager.transaction(async manager => {
			const repository = manager.getRepository(MiAvatarDecoration);
			const ids = replaceFromId == null ? [id] : [id, replaceFromId].sort();
			// Ordinary saves and releases take the same lock as replacement, so concurrent writes cannot split a swap.
			const decorations = await repository.createQueryBuilder('decoration')
				.where('decoration.id IN (:...ids)', { ids })
				.andWhere('decoration.host IS NULL')
				.orderBy('decoration.id', 'ASC')
				.setLock('pessimistic_write')
				.getMany();
			const target = decorations.find(decoration => decoration.id === id);
			const source = replaceFromId == null ? undefined : decorations.find(decoration => decoration.id === replaceFromId);
			if (target == null || (replaceFromId != null && source == null)) throw new HataskAvatarDecorationUpdateError('notFound');
			if (source != null && (!source.requiresHataskFlowerCompletion || target.requiresHataskFlowerCompletion)) {
				throw new HataskAvatarDecorationUpdateError('replacementConflict');
			}
			const date = new Date();
			const updates: { before: MiAvatarDecoration; after: MiAvatarDecoration }[] = [];
			if (source != null) {
				const values = { updatedAt: date, requiresHataskFlowerCompletion: false };
				await repository.update(source.id, values);
				updates.push({ before: source, after: { ...source, ...values } });
			}
			const values = { updatedAt: date, ...params };
			await repository.update(target.id, values);
			updates.push({ before: target, after: { ...target, ...values } });
			return updates;
		});
		// Publish only committed state. A failed second write leaves both records and caches unchanged.
		for (const { before, after } of changes) this.publishUpdatedDecoration(before, after, moderator);
	}

	@bindThis
	private publishUpdatedDecoration(before: MiAvatarDecoration, updated: MiAvatarDecoration, moderator?: MiUser): void {
		this.cache.delete();
		this.cacheWithRemote.delete();
		this.globalEventService.publishInternalEvent('avatarDecorationUpdated', updated);

		if (moderator) {
			this.moderationLogService.log(moderator, 'updateAvatarDecoration', {
				avatarDecorationId: before.id,
				before,
				after: updated,
			});
		}
	}

	/** Availability is always calculated from server state, including previously completed collections. */
	@bindThis
	public async getAvailability(userId: string | null, decorations: MiAvatarDecoration[]): Promise<Map<string, AvatarDecorationUnavailableReason | null>> {
		const roleService = this.moduleRef.get<RoleService>('RoleService');
		const [roles, allRoles, completed] = await Promise.all([
			userId == null ? [] : roleService.getUserRoles(userId),
			roleService.getRoles(),
			userId != null && decorations.some(d => d.requiresHataskFlowerCompletion)
				? recordHataskFlowerCollectionCompletion(this.usersRepository.manager, userId) : false,
		]);
		const now = Date.now();
		return new Map(decorations.map(decoration => [decoration.id, avatarDecorationUnavailableReason(decoration, {
			now,
			hasCompletedHataskFlower: completed,
			hasRequiredRole: !decoration.roleIdsThatCanBeUsedThisDecoration.some(id => allRoles.some(role => role.id === id))
				|| roles.some(role => decoration.roleIdsThatCanBeUsedThisDecoration.includes(role.id)),
		})]));
	}

	/** Discover committed achievements and newly available rewards, including offline owners. */
	@bindThis
	public async notifyUnlockedDecorations(): Promise<void> {
		const now = Date.now();
		const manager = this.usersRepository.manager;
		await recordCurrentSeasonHataskFlowerCompletions(manager, new Date(now));
		const decorations = (await this.avatarDecorationsRepository.findBy({ host: IsNull(), requiresHataskFlowerCompletion: true }))
			.filter(decoration => avatarDecorationUnavailableReason(decoration, { now, hasCompletedHataskFlower: true }) == null);
		if (decorations.length === 0) return;
		const type = 'hataskDecorationUnlocked' as const;
		const notificationService = this.moduleRef.get<NotificationService>('NotificationService');
		const failures: unknown[] = [];
		let cursor = '';
		for (;;) {
			const owners: { userId: string }[] = await manager.query(`
				SELECT wallet."userId" FROM hatask_drop_wallet wallet
				INNER JOIN "user" owner ON owner.id = wallet."userId"
				WHERE wallet."flowerCollectionCompletedAt" IS NOT NULL AND wallet."userId" > $1
				AND owner.host IS NULL AND owner."isDeleted" = false AND owner."isSuspended" = false
				AND EXISTS (
					SELECT 1 FROM unnest($2::varchar[]) AS reward(id) WHERE NOT EXISTS (
						SELECT 1 FROM hatask_flower_notice notice WHERE notice."userId" = wallet."userId"
						AND notice.type = $3 AND notice."sourceId" = reward.id AND notice."sentAt" IS NOT NULL
					)
				) ORDER BY wallet."userId" ASC LIMIT 100`, [cursor, decorations.map(decoration => decoration.id), type]);
			if (owners.length === 0) break;
			for (const { userId } of owners) {
				try {
					const availability = await this.getAvailability(userId, decorations);
					for (const decoration of decorations) {
						if (availability.get(decoration.id) !== null) continue;
						// Keep the outbox separate from the achievement transaction. Only committed rewards reach Redis.
						await manager.query('INSERT INTO hatask_flower_notice("userId",type,"sourceId") VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [userId, type, decoration.id]);
						await manager.transaction(async transaction => {
							const notices = await transaction.query('SELECT "sourceId" FROM hatask_flower_notice WHERE "userId"=$1 AND type=$2 AND "sourceId"=$3 AND "sentAt" IS NULL FOR UPDATE SKIP LOCKED', [userId, type, decoration.id]);
							if (notices.length === 0) return;
							// Serialize delivery with a reward replacement, release, or period edit.
							const current = await transaction.getRepository(MiAvatarDecoration).createQueryBuilder('decoration')
								.where('decoration.id = :id AND decoration.host IS NULL', { id: decoration.id })
								.setLock('pessimistic_read').getOne();
							if (!current?.requiresHataskFlowerCompletion
								|| (await this.getAvailability(userId, [current])).get(current.id) !== null) return;
							await notificationService.createNotificationAsync(userId, type, {
								customHeader: 'Hataskのアイコンデコ',
								customBody: `「${current.name}」を獲得しました。アイコンデコの設定から着用できます。`,
								customIcon: current.url,
								customLink: '/settings/avatar-decoration',
							}, null, `hatask-decoration:${decoration.id}`);
							await transaction.query('UPDATE hatask_flower_notice SET "sentAt"=now() WHERE "userId"=$1 AND type=$2 AND "sourceId"=$3', [userId, type, decoration.id]);
						});
					}
				} catch (error) {
					// A failed recipient is retried on the next tick without blocking other recipients.
					failures.push(error);
				}
			}
			cursor = owners[owners.length - 1].userId;
			if (owners.length < 100) break;
		}
		if (failures.length > 0) throw new AggregateError(failures, 'Hatask decoration notifications failed');
	}

	/** One lookup for every local user in a page who wears a reward decoration, instead of one per user. */
	@bindThis
	public async getHataskFlowerCompletions(users: readonly Pick<MiUser, 'id' | 'host' | 'avatarDecorations'>[]): Promise<Map<MiUser['id'], boolean>> {
		const candidates = users.filter(user => user.host == null && user.avatarDecorations.length > 0);
		if (candidates.length === 0) return new Map();
		const rewardIds = new Set((await this.getAll(false, true)).filter(d => d.requiresHataskFlowerCompletion).map(d => d.id));
		if (rewardIds.size === 0) return new Map();
		const wearers = [...new Set(candidates.filter(user => user.avatarDecorations.some(setting => rewardIds.has(setting.id))).map(user => user.id))];
		return hasCompletedHataskFlowerCollectionMany(this.usersRepository.manager, wearers);
	}

	/** Filter at the final API boundary as well as on write: an offline wearer must also expire. */
	@bindThis
	public async packUserDecorations(
		user: Pick<MiUser, 'id' | 'host' | 'avatarDecorations'>,
		// From getHataskFlowerCompletions; a missing entry falls back to a per-user lookup.
		flowerCompletions?: ReadonlyMap<MiUser['id'], boolean>,
	): Promise<Packed<'UserLite'>['avatarDecorations']> {
		if (user.avatarDecorations.length === 0) return [];
		const decorations = await this.getAll(false, true);
		const equipped = user.avatarDecorations.flatMap(setting => {
			const decoration = decorations.find(d => d.id === setting.id);
			return decoration == null ? [] : [{ setting, decoration }];
		});
		const completed = user.host == null && equipped.some(({ decoration }) => decoration.requiresHataskFlowerCompletion)
			? flowerCompletions?.get(user.id) ?? await hasCompletedHataskFlowerCollection(this.usersRepository.manager, user.id) : false;
		const now = Date.now();
		return equipped.filter(({ decoration }) => user.host != null
			|| avatarDecorationUnavailableReason(decoration, { now, hasCompletedHataskFlower: completed }) == null)
			.map(({ setting, decoration }) => ({
				id: setting.id,
				angle: setting.angle === 0 ? undefined : setting.angle,
				flipH: setting.flipH === false ? undefined : setting.flipH,
				offsetX: setting.offsetX === 0 ? undefined : setting.offsetX,
				offsetY: setting.offsetY === 0 ? undefined : setting.offsetY,
				scale: setting.scale === 0 ? undefined : setting.scale,
				opacity: setting.opacity === 0 ? undefined : setting.opacity,
				url: decoration.url,
				availableUntil: user.host == null ? decoration.availableUntil?.toISOString() ?? null : null,
			}));
	}

	/** Existing minute worker calls this; restricting a decoration also invokes it immediately. */
	@bindThis
	public async removeUnavailableDecorations(decorationId?: string): Promise<void> {
		const now = Date.now();
		const decorations = (await this.getAll(true)).filter(d => (decorationId == null || d.id === decorationId)
			&& ((decorationId != null && d.requiresHataskFlowerCompletion) || avatarDecorationUnavailableReason(d, { now, hasCompletedHataskFlower: true }) != null));
		if (decorations.length === 0) return;
		const decorationIds = decorations.map(d => d.id);
		let cursor = '';
		for (;;) {
			const users = await this.usersRepository.createQueryBuilder('owner')
				.select(['owner.id', 'owner.avatarDecorations'])
				.where('owner.host IS NULL')
				.andWhere('owner.id > :cursor', { cursor })
				.andWhere('EXISTS (SELECT 1 FROM jsonb_array_elements("owner"."avatarDecorations") decoration WHERE decoration->>\'id\' = ANY(:decorationIds))', { decorationIds })
				.orderBy('owner.id', 'ASC').limit(100).getMany();
			if (users.length === 0) break;
			for (const user of users) {
				const changed = await this.usersRepository.manager.transaction(async manager => {
					// Recheck current policy and hold it stable until the equipment update commits.
					const current = await manager.getRepository(MiAvatarDecoration).createQueryBuilder('decoration')
						.where('decoration.id IN (:...ids) AND decoration.host IS NULL', { ids: decorationIds })
						.orderBy('decoration.id', 'ASC').setLock('pessimistic_read').getMany();
					const completed = current.some(d => d.requiresHataskFlowerCompletion)
						? await hasCompletedHataskFlowerCollection(manager, user.id) : false;
					const unavailableIds = current.filter(d => avatarDecorationUnavailableReason(d, { now: Date.now(), hasCompletedHataskFlower: completed }) != null).map(d => d.id);
					if (unavailableIds.length === 0) return false;
					// Filter the current DB array atomically, preserving concurrent edits to other decorations.
					const result = await manager.createQueryBuilder().update(MiUser).set({
						avatarDecorations: () => 'COALESCE((SELECT jsonb_agg(decoration ORDER BY position) FROM jsonb_array_elements("avatarDecorations") WITH ORDINALITY AS equipped(decoration, position) WHERE NOT (decoration->>\'id\' = ANY(:unavailableIds))), \'[]\'::jsonb)',
					})
						.where('id = :userId AND host IS NULL', { userId: user.id })
						.andWhere('EXISTS (SELECT 1 FROM jsonb_array_elements("avatarDecorations") decoration WHERE decoration->>\'id\' = ANY(:unavailableIds))')
						.setParameter('unavailableIds', unavailableIds).execute();
					return Boolean(result.affected);
				});
				if (!changed) continue;
				this.globalEventService.publishInternalEvent('localUserUpdated', { id: user.id });
				const userEntityService = this.moduleRef.get<UserEntityService>('UserEntityService');
				const packed = await userEntityService.pack(user.id, { id: user.id }, { schema: 'MeDetailed' });
				this.globalEventService.publishMainStream(user.id, 'meUpdated', packed);
			}
			cursor = users[users.length - 1].id;
			if (users.length < 100) break;
		}
	}

	@bindThis
	private getProxiedUrl(url: string, mode?: 'static' | 'avatar'): string {
		return appendQuery(
			`${this.config.mediaProxy}/${mode ?? 'image'}.webp`,
			query({
				url,
				...(mode ? { [mode]: '1' } : {}),
			}),
		);
	}

	@bindThis
	public async remoteUserUpdate(user: MiUser) {
		const userHost = user.host ?? '';
		const instance = await this.instancesRepository.findOneBy({ host: userHost });
		const userHostUrl = `https://${user.host}`;
		const showUserApiUrl = `${userHostUrl}/api/users/show`;

		if (!['misskey', 'cherrypick', 'sharkey'].includes(<string>instance?.softwareName)) return;

		const res = await this.httpRequestService.send(showUserApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 'username': user.username }),
		});

		const userData: any = await res.json();
		const userAvatarDecorations = userData.avatarDecorations ?? undefined;

		if (!userAvatarDecorations || userAvatarDecorations.length === 0) {
			const updates = {} as Partial<MiUser>;
			updates.avatarDecorations = [];

			if (!(await this.usersRepository.update({ id: user.id, isDeleted: false }, updates)).affected) {
				return 'skip';
			}

			return;
		}

		const instanceHost = instance!.host;
		const decorationApiUrl = `https://${instanceHost}/api/get-avatar-decorations`;
		const allRes = await this.httpRequestService.send(decorationApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});

		const allDecorations: any = await allRes.json();
		const updates = {} as Partial<MiUser>;
		updates.avatarDecorations = [];

		for (const avatarDecoration of userAvatarDecorations) {
			let name;
			let description;
			const avatarDecorationId = avatarDecoration.id;

			for (const decoration of allDecorations) {
				// eslint-disable-next-line eqeqeq
				if (decoration.id == avatarDecorationId) {
					name = decoration.name;
					description = decoration.description;
					break;
				}
			}

			const existingDecoration = await this.avatarDecorationsRepository.findOneBy({
				host: userHost,
				remoteId: avatarDecorationId,
			});

			const decorationData = {
				name: name,
				description: description,
				url: this.getProxiedUrl(avatarDecoration.url, 'avatar'),
				remoteId: avatarDecorationId,
				host: userHost,
				rawUrl: avatarDecoration.url,
			};

			if (existingDecoration == null) {
				await this.create(decorationData);
				this.cacheWithRemote.delete();
			} else {
				await this.update(existingDecoration.id, decorationData);
				this.cacheWithRemote.delete();
			}

			const findDecoration = await this.avatarDecorationsRepository.findOneBy({
				host: userHost,
				remoteId: avatarDecorationId,
			});

			updates.avatarDecorations.push({
				id: findDecoration?.id ?? '',
				angle: avatarDecoration.angle ?? 0,
				flipH: avatarDecoration.flipH ?? false,
				offsetX: avatarDecoration.offsetX ?? 0,
				offsetY: avatarDecoration.offsetY ?? 0,
				scale: avatarDecoration.scale ?? 1,
				opacity: avatarDecoration.opacity ?? 1,
			});
		}
		if (!(await this.usersRepository.update({ id: user.id, isDeleted: false }, updates)).affected) {
			return 'skip';
		}

		return undefined;
	}

	@bindThis
	public async delete(id: MiAvatarDecoration['id'], moderator?: MiUser): Promise<void> {
		const avatarDecoration = await this.avatarDecorationsRepository.findOneByOrFail({ id });

		await this.avatarDecorationsRepository.delete({ id: avatarDecoration.id });
		this.cache.delete();
		this.cacheWithRemote.delete();
		this.globalEventService.publishInternalEvent('avatarDecorationDeleted', avatarDecoration);

		if (moderator) {
			this.moderationLogService.log(moderator, 'deleteAvatarDecoration', {
				avatarDecorationId: avatarDecoration.id,
				avatarDecoration: avatarDecoration,
			});
		}
	}

	@bindThis
	public async getAll(noCache = false, withRemote = false, remoteOnly = false): Promise<MiAvatarDecoration[]> {
		if (noCache) {
			this.cache.delete();
			this.cacheWithRemote.delete();
		}

		if (remoteOnly) {
			return this.cacheWithRemote.fetch(() => this.avatarDecorationsRepository.find({
				where: {
					host: Not(IsNull()),
				},
			}));
		} else if (withRemote) {
			return this.cacheWithRemote.fetch(() => this.avatarDecorationsRepository.find());
		} else {
			return this.cache.fetch(() => this.avatarDecorationsRepository.find({
				where: {
					host: IsNull(),
				},
			}));
		}
	}

	@bindThis
	private async fetchRemoteDecorations(id: string): Promise<string | null> {
		const decoration = await this.avatarDecorationsRepository.findOneBy({ id });
		if (decoration == null) return null;
		if (!decoration.host) return null;

		const instance = await this.instancesRepository.findOneBy({ host: decoration.host });
		if (!instance) return null;

		if (!['misskey', 'cherrypick', 'sharkey'].includes(<string>instance.softwareName)) {
			return null;
		}

		const decorationApiUrl = `https://${instance.host}/api/get-avatar-decorations`;

		try {
			const res = await this.httpRequestService.send(decorationApiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			const allDecorations: any = await res.json();
			const remoteDecoration = allDecorations.find((d: any) => d.id === decoration.remoteId);

			if (remoteDecoration?.url) {
				return remoteDecoration.url;
			}
		} catch (e) {
			return null;
		}
		return null;
	}

	@bindThis
	public async getRawUrl(decoration: MiAvatarDecoration): Promise<string | null> {
		if (decoration.rawUrl) return decoration.rawUrl;

		const remoteUrl = await this.fetchRemoteDecorations(decoration.id);
		if (remoteUrl) {
			await this.update(decoration.id, { rawUrl: remoteUrl });
		}
		return remoteUrl;
	}

	@bindThis
	public checkDuplicate(url: string, name: string): Promise<boolean> {
		return this.avatarDecorationsRepository.exists({ where: { url, name, host: IsNull() } });
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
