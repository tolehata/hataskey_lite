/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import * as Redis from 'ioredis';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { ReplyError } from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { FeedbackNotificationsRepository, HatadyNotificationsRepository, UsersRepository } from '@/models/_.js';
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
const createSourceNotificationScript = `
local existing = redis.call('HGET', KEYS[2], ARGV[3])
if existing then
	if #redis.call('XRANGE', KEYS[1], existing, existing, 'COUNT', 1) > 0 then return false end
	redis.call('HDEL', KEYS[2], ARGV[3])
end
local id = redis.call('XADD', KEYS[1], 'MAXLEN', '~', ARGV[1], ARGV[2], 'data', ARGV[4])
redis.call('HSET', KEYS[2], ARGV[3], id)
return id
`;
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
const repairSourceIndexScript = `
local indexed = redis.call('HGET', KEYS[2], ARGV[1])
if indexed then return indexed end
if #redis.call('XRANGE', KEYS[1], ARGV[2], ARGV[2], 'COUNT', 1) == 0 then return false end
redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2])
return redis.call('HGET', KEYS[2], ARGV[1])
`;
const flushNotificationsScript = `
for i = 1, 4 do redis.call('DEL', KEYS[i]) end
redis.call('INCR', KEYS[5])
return true
`;

type LinkedNotification = Extract<MiNotification, { type: 'hatady' | 'hataFeed' }>;
export type NotificationBrand = 'all' | 'standard' | 'hatady' | 'hatask' | 'hataFeed';
export function notificationBrand(notification: MiNotification | { type: string; header?: string | null; link?: string | null }): Exclude<NotificationBrand, 'all'> {
	const fields = notification as { customHeader?: string | null; customLink?: string | null; header?: string | null; link?: string | null };
	const header = fields.customHeader ?? fields.header;
	const link = fields.customLink ?? fields.link;
	if (notification.type === 'hatady') return 'hatady';
	if (notification.type === 'hataFeed' || (notification.type === 'app' && header === 'HataFeed')) return 'hataFeed';
	if (notification.type === 'hataskFlowerReady' || notification.type === 'hataskFlowerBloomed' || notification.type === 'hataskZukanUpdated' || notification.type === 'hataskFestivalBloomed' || notification.type === 'hataskDecorationUnlocked') return 'hatask';
	if (notification.type === 'app' && ((link != null && /^\/hatask(?:\/|[?#]|$)/.test(link))
		|| (link == null && ['Hatask', 'Hataskのお花'].includes(header ?? '')))) return 'hatask';
	return 'standard';
}

export function matchesNotificationListFilter(notification: MiNotification, options: {
	includeTypes?: readonly string[];
	excludeTypes?: readonly string[];
	brand?: NotificationBrand;
	includeBrands?: readonly Exclude<NotificationBrand, 'all'>[];
	includeHataskApp?: boolean;
}): boolean {
	const selectedBrand = notificationBrand(notification);
	if (options.brand != null && options.brand !== 'all' && selectedBrand !== options.brand) return false;
	if (options.includeBrands != null && !options.includeBrands.includes(selectedBrand)) return false;
	// Reward delivery is mandatory, but its list entry still belongs only to Hatask.
	if (notification.type === 'hataskDecorationUnlocked') return true;
	if (notification.type === 'app' && selectedBrand === 'hatask' && options.includeHataskApp !== undefined) return options.includeHataskApp;
	const effectiveType = notification.type === 'app' && selectedBrand === 'hataFeed' ? 'hataFeed' : notification.type;
	if (options.includeTypes != null && !options.includeTypes.includes(effectiveType)) return false;
	if (options.excludeTypes?.includes(effectiveType)) return false;
	return true;
}

function sourceOf(notification: MiNotification): { type: 'hatady' | 'hataFeed'; id: string } | null {
	return (notification.type === 'hatady' || notification.type === 'hataFeed') && notification.sourceNotificationId != null
		? { type: notification.type, id: notification.sourceNotificationId }
		: null;
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

		@Inject(DI.hatadyNotificationsRepository)
		private hatadyNotificationsRepository: HatadyNotificationsRepository,

		@Inject(DI.feedbackNotificationsRepository)
		private feedbackNotificationsRepository: FeedbackNotificationsRepository,

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
		const linkedChanged = await this.markLinkedSourcesRead(userId, snapshotNotifications.filter(x => visibleIds.has(x.id)));
		const advanced = await this.redisClient.eval(advanceReadCursorScript, 1, `latestReadNotification:${userId}`, latestNotificationId) as number;
		await this.cleanupIndividualReads(userId, latestNotificationId);
		if (force || advanced === 1 || linkedChanged) {
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

	private sourceIndexKey(userId: string): string { return `notificationSourceIndex:${userId}`; }
	private individualReadKey(userId: string): string { return `individualReadNotification:${userId}`; }
	private sourceField(type: 'hatady' | 'hataFeed', id: string): string { return `${type}:${id}`; }
	private async removeMatchingHashFields(key: string, entries: [string, string][]): Promise<void> {
		if (entries.length > 0) await this.redisClient.eval(removeMatchingHashFieldsScript, 1, key, ...entries.flat());
	}

	private async cleanupIndividualReads(userId: string, cursor: string): Promise<void> {
		const reads = await this.redisClient.hgetall(this.individualReadKey(userId));
		const expired = Object.entries(reads).filter(([, entryId]) => compareStreamIds(entryId, cursor) <= 0);
		await this.removeMatchingHashFields(this.individualReadKey(userId), expired);
	}

	private async cleanupSourceIndexAfterTrim(userId: string): Promise<void> {
		const indexKey = this.sourceIndexKey(userId);
		if (await this.redisClient.hlen(indexKey) <= this.config.perUserNotificationsMaxCount * 2) return;
		const [index, retained] = await Promise.all([
			this.redisClient.hgetall(indexKey),
			this.redisClient.xrange(`notificationTimeline:${userId}`, '-', '+'),
		]);
		const retainedIds = new Set(retained.map(([entryId]) => entryId));
		const latestSnapshotId = retained.at(-1)?.[0];
		if (latestSnapshotId == null) return;
		const staleFields = Object.entries(index).filter(([, entryId]) =>
			compareStreamIds(entryId, latestSnapshotId) <= 0 && !retainedIds.has(entryId));
		await this.removeMatchingHashFields(indexKey, staleFields);
	}

	private async markLinkedSourcesRead(userId: string, notifications: MiNotification[]): Promise<boolean> {
		const hatadyIds = notifications.flatMap(n => n.type === 'hatady' ? [n.sourceNotificationId] : []);
		const hataFeedIds = notifications.flatMap(n => n.type === 'hataFeed' && n.sourceNotificationId != null ? [n.sourceNotificationId] : []);
		const hatadyChanged = hatadyIds.length > 0 ? await this.hatadyNotificationsRepository.update({ notifieeId: userId, id: In(hatadyIds), isRead: false, deletedAt: IsNull() }, { isRead: true }) : null;
		const hataFeedChanged = hataFeedIds.length > 0 ? await this.feedbackNotificationsRepository.update({ userId, id: In(hataFeedIds), isRead: false }, { isRead: true }) : null;
		return (hatadyChanged?.affected ?? 0) > 0 || (hataFeedChanged?.affected ?? 0) > 0;
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
		await this.markLinkedSourcesRead(userId, notifications);
		await Promise.all(notifications.map(notification => this.redisClient.hset(this.individualReadKey(userId), notification.id, this.toXListId(notification.id))));
		await this.bumpRevision(userId);
		const state = await this.getCurrentUnreadState(userId);
		for (const notification of notifications) {
			this.globalEventService.publishMainStream(userId, 'readNotification', { id: notification.id, ...state });
			void Promise.resolve(this.pushNotificationService.pushNotification(userId, 'readNotification', { id: notification.id })).catch(() => {});
		}
		return notifications.map(notification => notification.id);
	}

	/** The source-side bulk action passes its own snapshot; unknown legacy entries are untouched. */
	@bindThis
	public async markSourceNotificationsRead(userId: string, type: 'hatady' | 'hataFeed', sourceIds: string[]): Promise<void> {
		const notifications: LinkedNotification[] = [];
		for (const sourceId of new Set(sourceIds)) {
			const notification = await this.findNotificationBySource(userId, type, sourceId);
			if (notification != null) notifications.push(notification);
		}
		if (notifications.length === 0) return;
		await this.markLinkedSourcesRead(userId, notifications);
		await Promise.all(notifications.map(notification => this.redisClient.hset(this.individualReadKey(userId), notification.id, this.toXListId(notification.id))));
		await this.bumpRevision(userId);
		const state = await this.getCurrentUnreadState(userId);
		for (const notification of notifications) {
			this.globalEventService.publishMainStream(userId, 'readNotification', { id: notification.id, ...state });
			void Promise.resolve(this.pushNotificationService.pushNotification(userId, 'readNotification', { id: notification.id })).catch(() => {});
		}
	}

	/** Tell live clients to re-fetch affected retained entries after source delete/restore or access changes. */
	@bindThis
	public async refreshSourceNotifications(userId: string, type: 'hatady' | 'hataFeed', sourceIds: string[]): Promise<void> {
		const ids: string[] = [];
		for (const sourceId of new Set(sourceIds)) {
			const notification = await this.findNotificationBySource(userId, type, sourceId);
			if (notification != null) ids.push(notification.id);
		}
		await this.publishNotificationChanged(userId, ids);
	}

	/** Re-evaluate the owner's retained Hatady entries after follow, mute or block changes. */
	@bindThis
	public async refreshHatadyNotificationsForViewer(userId: string): Promise<void> {
		const entries = await this.redisClient.xrange(`notificationTimeline:${userId}`, '-', '+');
		const ids = entries.flatMap(([, fields]) => {
			const notification = this.parseEntry(fields);
			return notification?.type === 'hatady' ? [notification.id] : [];
		});
		await this.publishNotificationChanged(userId, ids);
	}

	private async publishNotificationChanged(userId: string, ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.bumpRevision(userId);
		const state = await this.getCurrentUnreadState(userId);
		this.globalEventService.publishMainStream(userId, 'notificationChanged', { ids, ...state });
		this.pushIdBatches(userId, 'notificationChanged', ids);
	}

	@bindThis
	public async findNotificationBySource(userId: string, type: 'hatady' | 'hataFeed', sourceId: string): Promise<LinkedNotification | null> {
		const streamKey = `notificationTimeline:${userId}`;
		const indexKey = this.sourceIndexKey(userId);
		const field = this.sourceField(type, sourceId);
		const indexed = await this.redisClient.hget(indexKey, field);
		if (indexed != null) {
			const entry = await this.redisClient.xrange(streamKey, indexed, indexed, 'COUNT', 1);
			const notification = entry[0] == null ? null : this.parseEntry(entry[0][1]);
			if (notification != null && sourceOf(notification)?.type === type && sourceOf(notification)?.id === sourceId) return notification as LinkedNotification;
			await this.removeMatchingHashFields(indexKey, [[field, indexed]]);
		}
		const entries = await this.redisClient.xrange(streamKey, '-', '+');
		for (const [entryId, fields] of entries) {
			const notification = this.parseEntry(fields);
			if (notification != null && sourceOf(notification)?.type === type && sourceOf(notification)?.id === sourceId) {
				const currentId = await this.redisClient.eval(repairSourceIndexScript, 2, streamKey, indexKey, field, entryId) as string | null;
				if (currentId == null) return null;
				if (currentId === entryId) return notification as LinkedNotification;
				const current = await this.redisClient.xrange(streamKey, currentId, currentId, 'COUNT', 1);
				const currentNotification = current[0] == null ? null : this.parseEntry(current[0][1]);
				return currentNotification != null && sourceOf(currentNotification)?.type === type && sourceOf(currentNotification)?.id === sourceId
					? currentNotification as LinkedNotification : null;
			}
		}
		return null;
	}

	private async isRead(userId: string, notification: MiNotification, entryId: string, cursor?: string | null, individualReads?: Record<string, string>, sourceReads?: { hatady: ReadonlyMap<string, boolean>; hataFeed: ReadonlyMap<string, boolean> }): Promise<boolean> {
		const source = sourceOf(notification);
		if (source?.type === 'hatady') {
			if (sourceReads) {
				const read = sourceReads.hatady.get(source.id);
				if (read !== undefined) return read;
			} else {
				const row = await this.hatadyNotificationsRepository.findOneBy({ id: source.id, notifieeId: userId });
				if (row != null) return row.isRead;
			}
		}
		if (source?.type === 'hataFeed') {
			if (sourceReads) {
				const read = sourceReads.hataFeed.get(source.id);
				if (read !== undefined) return read;
			} else {
				const row = await this.feedbackNotificationsRepository.findOneBy({ id: source.id, userId });
				if (row != null) return row.isRead;
			}
		}
		if (cursor != null && compareStreamIds(entryId, cursor) <= 0) return true;
		if (individualReads != null
			? individualReads[notification.id] != null
			: await this.redisClient.hexists(this.individualReadKey(userId), notification.id) === 1) return true;
		return false;
	}

	@bindThis
	public async getUnreadNotificationCountsByBrand(userId: string): Promise<Record<Exclude<NotificationBrand, 'all'>, number>> {
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
		const hatadyIds = [...new Set(candidates.flatMap(({ notification }) => {
			const source = sourceOf(notification);
			return source?.type === 'hatady' ? [source.id] : [];
		}))];
		const hataFeedIds = [...new Set(candidates.flatMap(({ notification }) => {
			const source = sourceOf(notification);
			return source?.type === 'hataFeed' ? [source.id] : [];
		}))];
		const [hatadyRows, hataFeedRows] = await Promise.all([
			hatadyIds.length ? this.hatadyNotificationsRepository.findBy({ id: In(hatadyIds), notifieeId: userId }) : [],
			hataFeedIds.length ? this.feedbackNotificationsRepository.findBy({ id: In(hataFeedIds), userId }) : [],
		]);
		const sourceReads = {
			hatady: new Map(hatadyRows.map(row => [row.id, row.isRead])),
			hataFeed: new Map(hataFeedRows.map(row => [row.id, row.isRead])),
		};
		const unread: MiNotification[] = [];
		for (const { entryId, notification } of candidates) {
			if (!(await this.isRead(userId, notification, entryId, cursor, individualReads, sourceReads))) unread.push(notification);
		}
		const counts = { standard: 0, hatask: 0, hatady: 0, hataFeed: 0 };
		if (unread.length === 0) return counts;
		const visibleIds = new Set((await this.notificationEntityService.packMany(unread, userId)).map(x => x.id));
		for (const notification of unread) {
			if (visibleIds.has(notification.id)) counts[notificationBrand(notification)]++;
		}
		return counts;
	}

	@bindThis
	public async getUnreadNotificationsCount(userId: string, includeBrands?: readonly Exclude<NotificationBrand, 'all'>[]): Promise<number> {
		const counts = await this.getUnreadNotificationCountsByBrand(userId);
		return (includeBrands ?? ['standard', 'hatask', 'hatady', 'hataFeed']).reduce((total, brand) => total + counts[brand], 0);
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
		// 旗鯖fork: notificationRecieveConfig のキー集合(types.ts の notificationTypes)は
		// addedToPrivateChannel/removedFromPrivateChannel/hataskDecorationUnlocked を含まない(受信設定の対象外のため)。
		// MiNotification['type'] 全体を汎用 T として受け取るここでは静的にキーの網羅性を
		// 保証できない(が値側の discriminated union はそのまま維持する)ので、
		// キーだけ string に広げて読む(挙動は変えない)。
		type RecieveConfigValue = NonNullable<(typeof profile.notificationRecieveConfig)[keyof typeof profile.notificationRecieveConfig]>;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const recieveConfig = (profile.notificationRecieveConfig as Partial<Record<string, RecieveConfigValue>> ?? {})[type];
		if (type !== 'hataskDecorationUnlocked' && recieveConfig?.type === 'never') {
			return null;
		}

		if (notifierId && type !== 'hataskDecorationUnlocked') {
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
		const sourceId = 'sourceNotificationId' in data ? data.sourceNotificationId : null;
		const sourceType: 'hatady' | 'hataFeed' | null = type === 'hatady' ? 'hatady' : type === 'hataFeed' ? 'hataFeed' : null;
		const source = sourceType !== null && typeof sourceId === 'string' ? { type: sourceType, id: sourceId } : null;
		if (source != null && await this.findNotificationBySource(notifieeId, source.type, source.id) != null) return null;
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
				if (source != null) {
					const result = await this.redisClient.eval(
						createSourceNotificationScript, 2,
						`notificationTimeline:${notifieeId}`, this.sourceIndexKey(notifieeId),
						this.config.perUserNotificationsMaxCount.toString(),
						this.toXListId(notification.id), this.sourceField(source.type, source.id), JSON.stringify(notification),
					) as string | null;
					if (result === null) return null;
					redisId = result;
				} else if (dedupKey === null) {
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
				if (e instanceof ReplyError && ((source === null && dedupKey === null)
					|| (e instanceof Error && e.message.includes('The ID specified in XADD is equal or smaller than the target stream top item')))) continue;
				throw e;
			}

			break;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		} while (true);

		await this.bumpRevision(notifieeId);
		const packed = await this.notificationEntityService.pack(notification, notifieeId, {});
		if (source != null) await this.cleanupSourceIndexAfterTrim(notifieeId);

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
			let pushPayload = current;
			if (notification.type === 'hatady') {
				const linked = notification as Extract<MiNotification, { type: 'hatady' }>;
				pushPayload = {
					id: current.id,
					createdAt: current.createdAt,
					type: 'hatady',
					sourceNotificationId: linked.sourceNotificationId,
					subtype: linked.subtype,
					targetType: linked.targetType,
					targetId: linked.targetId,
					isRead: false,
				} as unknown as typeof current;
			}
			this.pushNotificationService.pushNotification(notifieeId, 'notification', pushPayload);
		}, () => { /* aborted, ignore it */ });

		return notification;
	}

	@bindThis
	public async flushAllNotifications(userId: MiUser['id']) {
		await this.redisClient.eval(flushNotificationsScript, 5,
			`notificationTimeline:${userId}`, `latestReadNotification:${userId}`,
			this.individualReadKey(userId), this.sourceIndexKey(userId), this.revisionKey(userId));
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
			brand = 'all',
			includeBrands,
			includeHataskApp,
			includeHatadySubtypes,
			excludeHatadySubtypes,
			excludeBots = false,
		}: {
			sinceId?: string,
			untilId?: string,
			limit?: number,
			// any extra types are allowed, those are no-op
			includeTypes?: (MiNotification['type'] | string)[],
			excludeTypes?: (MiNotification['type'] | string)[],
			brand?: NotificationBrand,
			includeBrands?: Exclude<NotificationBrand, 'all'>[],
			includeHataskApp?: boolean,
			includeHatadySubtypes?: Extract<MiNotification, { type: 'hatady' }>['subtype'][],
			excludeHatadySubtypes?: Extract<MiNotification, { type: 'hatady' }>['subtype'][],
			excludeBots?: boolean,
		},
	): Promise<MiNotification[]> {
		// 種類フィルタが空でも、選択ブランド内の必須アイコンデコ獲得通知を探す。
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
			notifications = notifications.filter(notification => matchesNotificationListFilter(notification, { includeTypes, excludeTypes, brand, includeBrands, includeHataskApp }));
			if (includeHatadySubtypes !== undefined || excludeHatadySubtypes !== undefined) {
				notifications = notifications.filter(notification => notification.type !== 'hatady'
					|| ((includeHatadySubtypes === undefined || includeHatadySubtypes.includes(notification.subtype))
						&& !excludeHatadySubtypes?.includes(notification.subtype)));
			}

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
