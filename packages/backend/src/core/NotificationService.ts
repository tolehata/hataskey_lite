/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import * as Redis from 'ioredis';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { In } from 'typeorm';
import { ReplyError } from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { UsersRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiNotification } from '@/models/Notification.js';
import { bindThis } from '@/decorators.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PushNotificationService } from '@/core/PushNotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { IdService } from '@/core/IdService.js';
import { CacheService } from '@/core/CacheService.js';
import type { Config } from '@/config.js';
import { UserListService } from '@/core/UserListService.js';
import { FilterUnionByProperty, groupedNotificationTypes, obsoleteNotificationTypes } from '@/types.js';
import { trackPromise } from '@/misc/promise-tracker.js';
// import { escapeHtml } from '@/misc/escape-html.js';

// Keep the stream write and its deduplication marker atomic. Delivery after the
// stream write (packing, live events and push) is not an exactly-once guarantee.
const createNotificationOnceScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then
	return false
end
local id = redis.call('XADD', KEYS[1], 'MAXLEN', '~', ARGV[1], ARGV[2], 'data', ARGV[3])
redis.call('SET', KEYS[2], id, 'EX', ARGV[4])
return id
`;
const notificationDedupRetentionSeconds = 7 * 24 * 60 * 60;
const advanceReadCursorScript = `
local function compareDecimal(a, b)
	if #a ~= #b then return #a < #b and -1 or 1 end
	if a == b then return 0 end
	return a < b and -1 or 1
end
local current = redis.call('GET', KEYS[1])
if current then
	local currentMs, currentSeq = string.match(current, '^(%d+)%-(%d+)$')
	local nextMs, nextSeq = string.match(ARGV[1], '^(%d+)%-(%d+)$')
	local msOrder = compareDecimal(currentMs, nextMs)
	if msOrder > 0 or (msOrder == 0 and compareDecimal(currentSeq, nextSeq) >= 0) then return false end
end
redis.call('SET', KEYS[1], ARGV[1])
return true
`;
const removeMatchingHashFieldsScript = `
local removed = 0
for i = 1, #ARGV, 2 do
	if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
		removed = removed + redis.call('HDEL', KEYS[1], ARGV[i])
	end
end
return removed
`;
const flushNotificationsScript = `
for i = 1, 3 do redis.call('DEL', KEYS[i]) end
redis.call('INCR', KEYS[4])
return true
`;

export function matchesNotificationListFilter(notification: MiNotification, options: {
	includeTypes?: readonly string[];
	excludeTypes?: readonly string[];
}): boolean {
	if (options.includeTypes != null && !options.includeTypes.includes(notification.type)) return false;
	if (options.excludeTypes?.includes(notification.type)) return false;
	return true;
}

function compareStreamIds(a: string, b: string): number {
	const [aMilliseconds = '0', aNumber = '0'] = a.split('-');
	const [bMilliseconds = '0', bNumber = '0'] = b.split('-');
	const aMs = BigInt(aMilliseconds);
	const aSequence = BigInt(aNumber);
	const bMs = BigInt(bMilliseconds);
	const bSequence = BigInt(bNumber);
	return aMs === bMs ? (aSequence < bSequence ? -1 : aSequence > bSequence ? 1 : 0) : aMs < bMs ? -1 : 1;
}

export function filterNotificationsFromBotIds(
	notifications: MiNotification[],
	botUserIds: ReadonlySet<MiUser['id']>,
): MiNotification[] {
	return notifications.filter(notification => !('notifierId' in notification)
		|| notification.notifierId == null
		|| !botUserIds.has(notification.notifierId));
}

@Injectable()
export class NotificationService implements OnApplicationShutdown {
	#shutdownController = new AbortController();
	private revisionKey(userId: string): string { return `notificationRevision:${userId}`; }
	private async bumpRevision(userId: string): Promise<void> { await this.redisClient.incr(this.revisionKey(userId)); }
	private async getRevision(userId: string): Promise<string> { return await this.redisClient.get(this.revisionKey(userId)) ?? '0'; }
	private async getCurrentUnreadState(userId: string): Promise<{ unreadNotificationsCount: number; revision: string }> {
		for (;;) {
			const revision = await this.getRevision(userId);
			const unreadNotificationsCount = await this.getUnreadNotificationsCount(userId);
			if (revision === await this.getRevision(userId)) return { unreadNotificationsCount, revision };
		}
	}
	@bindThis
	public async getUnreadNotificationState(userId: string): Promise<{ unreadNotificationsCount: number; revision: string }> {
		return this.getCurrentUnreadState(userId);
	}

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private notificationEntityService: NotificationEntityService,
		private idService: IdService,
		private globalEventService: GlobalEventService,
		private pushNotificationService: PushNotificationService,
		private cacheService: CacheService,
		private userListService: UserListService,
	) {
	}

	@bindThis
	public async readAllNotification(
		userId: MiUser['id'],
		force = false,
	) {
		const latestNotificationIdsRes = await this.redisClient.xrevrange(
			`notificationTimeline:${userId}`,
			'+',
			'-',
			'COUNT', 1);
		const latestNotificationId = latestNotificationIdsRes[0]?.[0];

		if (latestNotificationId == null) return;

		const snapshot = await this.redisClient.xrange(`notificationTimeline:${userId}`, '-', latestNotificationId);
		const snapshotNotifications = snapshot.map(([, fields]) => this.parseEntry(fields)).filter((x): x is MiNotification => x != null);
		const visible = await this.notificationEntityService.packMany(snapshotNotifications, userId);
		const visibleIds = new Set(visible.map(x => x.id));
		const advanced = await this.redisClient.eval(advanceReadCursorScript, 1, `latestReadNotification:${userId}`, latestNotificationId) as number;
		await this.cleanupIndividualReads(userId, latestNotificationId);
		if (force || advanced === 1) {
			await this.bumpRevision(userId);
			const state = await this.getCurrentUnreadState(userId);
			this.postReadAllNotifications(userId, [...visibleIds], state);
		}
	}

	private parseEntry(fields: string[]): MiNotification | null {
		const dataIndex = fields.indexOf('data');
		if (dataIndex < 0) return null;
		try { return JSON.parse(fields[dataIndex + 1]) as MiNotification; } catch { return null; }
	}

	private individualReadKey(userId: string): string { return `individualReadNotification:${userId}`; }
	private async removeMatchingHashFields(key: string, entries: [string, string][]): Promise<void> {
		if (entries.length > 0) await this.redisClient.eval(removeMatchingHashFieldsScript, 1, key, ...entries.flat());
	}

	private async cleanupIndividualReads(userId: string, cursor: string): Promise<void> {
		const reads = await this.redisClient.hgetall(this.individualReadKey(userId));
		const expired = Object.entries(reads).filter(([, entryId]) => compareStreamIds(entryId, cursor) <= 0);
		await this.removeMatchingHashFields(this.individualReadKey(userId), expired);
	}

	/** A standard notification ID can only be marked read in its owner's stream. */
	@bindThis
	public async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
		return (await this.markNotificationsRead(userId, [notificationId])).length > 0;
	}

	@bindThis
	public async findNotificationsByIds(userId: string, notificationIds: string[]): Promise<MiNotification[]> {
		const entries = await Promise.all([...new Set(notificationIds)].map(async notificationId => {
			let entryId: string;
			try { entryId = this.toXListId(notificationId); } catch { return null; }
			const rows = await this.redisClient.xrange(`notificationTimeline:${userId}`, entryId, entryId, 'COUNT', 1);
			const notification = rows[0] == null ? null : this.parseEntry(rows[0][1]);
			return notification?.id === notificationId ? notification : null;
		}));
		return entries.filter((entry): entry is MiNotification => entry != null);
	}

	/** Batched reads publish one authoritative count while validating every ID in the owner's stream. */
	@bindThis
	public async markNotificationsRead(userId: string, notificationIds: string[]): Promise<string[]> {
		const retained = await this.findNotificationsByIds(userId, notificationIds);
		const packed = await this.notificationEntityService.packMany(retained, userId);
		const visibleIds = new Set(packed.map(notification => notification.id));
		const notifications = retained.filter(notification => visibleIds.has(notification.id));
		if (notifications.length === 0) return [];
		await Promise.all(notifications.map(notification => this.redisClient.hset(this.individualReadKey(userId), notification.id, this.toXListId(notification.id))));
		await this.bumpRevision(userId);
		const state = await this.getCurrentUnreadState(userId);
		for (const notification of notifications) {
			this.globalEventService.publishMainStream(userId, 'readNotification', { id: notification.id, ...state });
			void Promise.resolve(this.pushNotificationService.pushNotification(userId, 'readNotification', { id: notification.id })).catch(() => {});
		}
		return notifications.map(notification => notification.id);
	}

	private async isRead(userId: string, notification: MiNotification, entryId: string, cursor?: string | null, individualReads?: Record<string, string>): Promise<boolean> {
		if (cursor != null && compareStreamIds(entryId, cursor) <= 0) return true;
		if (individualReads != null
			? individualReads[notification.id] != null
			: await this.redisClient.hexists(this.individualReadKey(userId), notification.id) === 1) return true;
		return false;
	}

	@bindThis
	public async getUnreadNotificationsCount(userId: string): Promise<number> {
		const [entries, cursor, individualReads] = await Promise.all([
			this.redisClient.xrevrange(`notificationTimeline:${userId}`, '+', '-'),
			this.redisClient.get(`latestReadNotification:${userId}`),
			this.redisClient.hgetall(this.individualReadKey(userId)),
		]);
		const candidates = entries.map(([entryId, fields]) => ({ entryId, notification: this.parseEntry(fields) }))
			.filter((x): x is { entryId: string; notification: MiNotification } => x.notification != null);
		const retainedIds = new Set(candidates.map(x => x.entryId));
		const latestSnapshotId = candidates[0]?.entryId;
		const staleIndividualIds = latestSnapshotId == null ? [] : Object.entries(individualReads).filter(([, entryId]) =>
			compareStreamIds(entryId, latestSnapshotId) <= 0 && !retainedIds.has(entryId));
		await this.removeMatchingHashFields(this.individualReadKey(userId), staleIndividualIds);
		// 旗鯖fork: 既読判定を先に済ませ、可視判定(packMany)は未読分だけに行う。
		// packMany の可視判定は1件ごとに独立しているため、数える集合(未読∩可視)は変わらない。
		// 全件を渡すと通知が来るたび最大 perUserNotificationsMaxCount 件のノートを詰め直すことになる。
		const unread: MiNotification[] = [];
		for (const { entryId, notification } of candidates) {
			if (!(await this.isRead(userId, notification, entryId, cursor, individualReads))) unread.push(notification);
		}
		if (unread.length === 0) return 0;
		return (await this.notificationEntityService.packMany(unread, userId)).length;
	}

	@bindThis
	private postReadAllNotifications(userId: MiUser['id'], ids: string[], state: { unreadNotificationsCount: number; revision: string }) {
		this.globalEventService.publishMainStream(userId, 'readAllNotifications', { ids, ...state });
		this.pushIdBatches(userId, 'readAllNotifications', ids);
	}

	private pushIdBatches(userId: string, type: 'readAllNotifications' | 'notificationChanged', ids: string[]): void {
		for (let index = 0; index < ids.length; index += 50) {
			void Promise.resolve(this.pushNotificationService.pushNotification(userId, type, { ids: ids.slice(index, index + 50) })).catch(() => {});
		}
	}

	@bindThis
	public createNotification<T extends MiNotification['type']>(
		notifieeId: MiUser['id'],
		type: T,
		data: Omit<FilterUnionByProperty<MiNotification, 'type', T>, 'type' | 'id' | 'createdAt' | 'notifierId'>,
		notifierId?: MiUser['id'] | null,
	) {
		trackPromise(
			this.#createNotificationInternal(notifieeId, type, data, notifierId),
		);
	}

	/**
	 * Callers that must contain delivery failures can await the standard notification path.
	 * An optional key suppresses duplicate stream entries for this recipient for seven days.
	 */
	@bindThis
	public async createNotificationAsync<T extends MiNotification['type']>(
		notifieeId: MiUser['id'],
		type: T,
		data: Omit<FilterUnionByProperty<MiNotification, 'type', T>, 'type' | 'id' | 'createdAt' | 'notifierId'>,
		notifierId?: MiUser['id'] | null,
		idempotencyKey?: string,
	): Promise<MiNotification | null> {
		return this.#createNotificationInternal(notifieeId, type, data, notifierId, idempotencyKey);
	}

	async #createNotificationInternal<T extends MiNotification['type']>(
		notifieeId: MiUser['id'],
		type: T,
		data: Omit<FilterUnionByProperty<MiNotification, 'type', T>, 'type' | 'id' | 'createdAt' | 'notifierId'>,
		notifierId?: MiUser['id'] | null,
		idempotencyKey?: string,
	): Promise<MiNotification | null> {
		const profile = await this.cacheService.userProfileCache.fetch(notifieeId);

		// 古いMisskeyバージョンのキャッシュが残っている可能性がある
		// 旗鯖fork: MiNotification['type'] 全体を汎用 T として受け取るここでは静的にキーの網羅性を
		// 保証できない(が値側の discriminated union はそのまま維持する)ので、
		// キーだけ string に広げて読む(挙動は変えない)。
		type RecieveConfigValue = NonNullable<(typeof profile.notificationRecieveConfig)[keyof typeof profile.notificationRecieveConfig]>;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const recieveConfig = (profile.notificationRecieveConfig as Partial<Record<string, RecieveConfigValue>> ?? {})[type];
		if (recieveConfig?.type === 'never') {
			return null;
		}

		if (notifierId) {
			if (notifieeId === notifierId) {
				return null;
			}

			const mutings = await this.cacheService.userMutingsCache.fetch(notifieeId);
			if (mutings.has(notifierId)) {
				return null;
			}

			if (recieveConfig?.type === 'following') {
				const isFollowing = await this.cacheService.userFollowingsCache.fetch(notifieeId).then(followings => Object.hasOwn(followings, notifierId));
				if (!isFollowing) {
					return null;
				}
			} else if (recieveConfig?.type === 'follower') {
				const isFollower = await this.cacheService.userFollowingsCache.fetch(notifierId).then(followings => Object.hasOwn(followings, notifieeId));
				if (!isFollower) {
					return null;
				}
			} else if (recieveConfig?.type === 'mutualFollow') {
				const [isFollowing, isFollower] = await Promise.all([
					this.cacheService.userFollowingsCache.fetch(notifieeId).then(followings => Object.hasOwn(followings, notifierId)),
					this.cacheService.userFollowingsCache.fetch(notifierId).then(followings => Object.hasOwn(followings, notifieeId)),
				]);
				if (!(isFollowing && isFollower)) {
					return null;
				}
			} else if (recieveConfig?.type === 'followingOrFollower') {
				const [isFollowing, isFollower] = await Promise.all([
					this.cacheService.userFollowingsCache.fetch(notifieeId).then(followings => Object.hasOwn(followings, notifierId)),
					this.cacheService.userFollowingsCache.fetch(notifierId).then(followings => Object.hasOwn(followings, notifieeId)),
				]);
				if (!isFollowing && !isFollower) {
					return null;
				}
			} else if (recieveConfig?.type === 'list') {
				const isMember = await this.userListService.membersCache.fetch(recieveConfig.userListId).then(members => members.has(notifierId));
				if (!isMember) {
					return null;
				}
			}
		}

		const createdAt = new Date();
		const dedupKey = idempotencyKey === undefined ? null
			: `notificationDedup:${notifieeId}:${createHash('sha256').update(idempotencyKey).digest('hex')}`;
		let notification: FilterUnionByProperty<MiNotification, 'type', T>;
		let redisId: string;

		do {
			notification = {
				id: this.idService.gen(),
				createdAt,
				type: type,
				...(notifierId ? {
					notifierId,
				} : {}),
				...data,
			} as unknown as FilterUnionByProperty<MiNotification, 'type', T>;

			try {
				if (dedupKey === null) {
					redisId = (await this.redisClient.xadd(
						`notificationTimeline:${notifieeId}`,
						'MAXLEN', '~', this.config.perUserNotificationsMaxCount.toString(),
						this.toXListId(notification.id),
						'data', JSON.stringify(notification)))!;
				} else {
					const result = await this.redisClient.eval(
						createNotificationOnceScript, 2,
						`notificationTimeline:${notifieeId}`, dedupKey,
						this.config.perUserNotificationsMaxCount.toString(),
						this.toXListId(notification.id), JSON.stringify(notification),
						notificationDedupRetentionSeconds.toString(),
					) as string | null;
					if (result === null) return null;
					redisId = result;
				}
			} catch (e) {
				// The ID specified in XADD is equal or smaller than the target stream top item で失敗することがあるのでリトライ
				// Keep legacy retries unchanged, but do not spin on permanent Lua/permission errors.
				if (e instanceof ReplyError && (dedupKey === null
					|| (e instanceof Error && e.message.includes('The ID specified in XADD is equal or smaller than the target stream top item')))) continue;
				throw e;
			}

			break;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		} while (true);

		await this.bumpRevision(notifieeId);
		const packed = await this.notificationEntityService.pack(notification, notifieeId, {});

		if (packed == null) return null;

		// Publish notification event
		this.globalEventService.publishMainStream(notifieeId, 'notification', packed);

		// 2秒経っても(今回作成した)通知が既読にならなかったら「未読の通知がありますよ」イベントを発行する
		// テスト通知の場合は即時発行
		const interval = notification.type === 'test' ? 0 : 2000;
		setTimeout(interval, 'unread notification', { signal: this.#shutdownController.signal }).then(async () => {
			const retained = await this.redisClient.xrange(`notificationTimeline:${notifieeId}`, redisId, redisId, 'COUNT', 1);
			if (retained[0] == null) return;
			const latestReadNotificationId = await this.redisClient.get(`latestReadNotification:${notifieeId}`);
			if (await this.isRead(notifieeId, notification, redisId, latestReadNotificationId)) return;
			const current = await this.notificationEntityService.pack(notification, notifieeId, {});
			if (current == null) return;
			const state = await this.getCurrentUnreadState(notifieeId);
			if (await this.isRead(notifieeId, notification, redisId, await this.redisClient.get(`latestReadNotification:${notifieeId}`))) return;

			this.globalEventService.publishMainStream(notifieeId, 'unreadNotification', { ...current, ...state });
			this.pushNotificationService.pushNotification(notifieeId, 'notification', current);
		}, () => { /* aborted, ignore it */ });

		return notification;
	}

	@bindThis
	public async flushAllNotifications(userId: MiUser['id']) {
		await this.redisClient.eval(flushNotificationsScript, 4,
			`notificationTimeline:${userId}`, `latestReadNotification:${userId}`,
			this.individualReadKey(userId), this.revisionKey(userId));
		this.globalEventService.publishMainStream(userId, 'notificationFlushed', await this.getCurrentUnreadState(userId));
	}

	@bindThis
	public async deleteUserGroupInvitation(userId: MiUser['id'], invitationId: string) {
		const streamKey = `notificationTimeline:${userId}`;
		const entries = await this.redisClient.xrange(streamKey, '-', '+');

		for (const [entryId, fields] of entries) {
			const dataIndex = fields.indexOf('data');
			if (dataIndex !== -1) {
				try {
					const data = JSON.parse(fields[dataIndex + 1]);

					if (data.userGroupInvitationId === invitationId) {
						await this.redisClient.xdel(streamKey, entryId);
						break;
					}
				} catch (e) {
					console.error('(UserGroupInvitationNotification) JSON Parsing Error:', e);
				}
			} else console.log('(UserGroupInvitationNotification) Data field not found in fields:', fields);
		}
	}

	@bindThis
	public dispose(): void {
		this.#shutdownController.abort();
	}

	private toXListId(id: string): string {
		const { date, additional } = this.idService.parseFull(id);
		// Redis Stream sequenceはunit64制約があるため、収まらない場合は下位64bitを取る
		return date.toString() + '-' + BigInt.asUintN(64, additional).toString();
	}

	@bindThis
	public async getNotifications(
		userId: MiUser['id'],
		{
			sinceId,
			untilId,
			limit = 20,
			includeTypes,
			excludeTypes,
			excludeBots = false,
		}: {
			sinceId?: string,
			untilId?: string,
			limit?: number,
			// any extra types are allowed, those are no-op
			includeTypes?: (MiNotification['type'] | string)[],
			excludeTypes?: (MiNotification['type'] | string)[],
			excludeBots?: boolean,
		},
	): Promise<MiNotification[]> {
		let sinceTime = sinceId ? this.toXListId(sinceId) : null;
		let untilTime = untilId ? this.toXListId(untilId) : null;

		const accepted: MiNotification[] = [];
		for (;;) {
			let notificationsRes: [id: string, fields: string[]][];

			// sinceidのみの場合は古い順、そうでない場合は新しい順。 QueryService.makePaginationQueryも参照
			if (sinceTime && !untilTime) {
				notificationsRes = await this.redisClient.xrange(
					`notificationTimeline:${userId}`,
					'(' + sinceTime,
					'+',
					'COUNT', limit);
			} else {
				notificationsRes = await this.redisClient.xrevrange(
					`notificationTimeline:${userId}`,
					untilTime ? '(' + untilTime : '+',
					sinceTime ? '(' + sinceTime : '-',
					'COUNT', limit);
			}

			if (notificationsRes.length === 0) break;

			let notifications = notificationsRes.map(([, fields]) => this.parseEntry(fields)).filter((x): x is MiNotification => x != null);
			notifications = notifications.filter(notification => matchesNotificationListFilter(notification, { includeTypes, excludeTypes }));

			if (excludeBots && notifications.length > 0) {
				const notifierIds = [...new Set(notifications.flatMap(notification => (
					'notifierId' in notification && notification.notifierId != null ? [notification.notifierId] : []
				)))];
				if (notifierIds.length > 0) {
					const botUsers = await this.usersRepository.find({
						where: { id: In(notifierIds), isBot: true },
						select: { id: true },
					});
					notifications = filterNotificationsFromBotIds(notifications, new Set(botUsers.map(user => user.id)));
				}
			}

			const visible = await this.notificationEntityService.packMany(notifications, userId);
			const visibleIds = new Set(visible.map(x => x.id));
			accepted.push(...notifications.filter(x => visibleIds.has(x.id)).slice(0, limit - accepted.length));
			if (accepted.length >= limit) break;

			// Continue from the raw cursor even when every candidate is hidden.
			if (sinceId && !untilId) {
				sinceTime = notificationsRes[notificationsRes.length - 1][0];
			} else {
				untilTime = notificationsRes[notificationsRes.length - 1][0];
			}
			if (notificationsRes.length < limit) break;
		}

		return accepted;
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
