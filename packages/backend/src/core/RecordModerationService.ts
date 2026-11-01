/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { lockHataskFlowerWallet } from '@/core/hatask-flower-v2.js';
import type { MiUser } from '@/models/User.js';
import { MiAnnouncement } from '@/models/Announcement.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { HatadyStreamService } from '@/core/HatadyStreamService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { HATADY_MODERATION_CTE } from '@/core/HatadyModerationService.js';
import { HATASK_REVIEW_CTE } from '@/core/hatask-record-review.js';
import { normalizeRecordModerationRequest, recordModerationErrors as errors, recordModerationHash, validateRecordModerationTarget } from '@/misc/record-moderation.js';
import type { RecordModerationImpact, RecordModerationInfo, RecordModerationRequest, RecordModerationTarget } from '@/misc/record-moderation.js';
import type { DataSource, EntityManager } from 'typeorm';

type Data = Record<string, any>;
type Source = { table: string; label: string; rows: Data[] };
type RegistryRow = { id: string; value: unknown; updatedAt: Date };
type Snapshot = {
	userId: string; username: string; name: string; title: string; version: string;
	impact: RecordModerationImpact[]; retained: string; sources: Source[];
	registry?: { key: string; rows: RegistryRow[]; selected: Map<string, number[]>; serverId: string | null; flowerId: string | null };
};
type Operation = { id: string; action: 'delete' | 'warn'; createdAt: Date; info: RecordModerationInfo; requestHash: string };

const tables: Record<string, string> = {
	book: 'hatady_book', log: 'hatady_log', comment: 'hatady_comment', reaction: 'hatady_reaction',
	mediaWork: 'hatady_media_work', mediaSession: 'hatady_media_session', mediaComment: 'hatady_media_comment', mediaReaction: 'hatady_media_reaction',
};
const labels: Record<string, string> = {
	hatady_book: '本', hatady_log: '活動記録', hatady_comment: 'コメント', hatady_reaction: 'リアクション',
	hatady_media_work: '作品', hatady_media_session: '活動記録', hatady_media_comment: 'コメント', hatady_media_reaction: 'リアクション',
	hatady_bookmark: 'しおり', hatady_book_memo: '本のメモ', hatady_notification: '関連する通知',
	hatask_event: '公開・共有された予定', hatask_rsvp: '予定の参加回答', hatask_flower: '公開用の開花記録',
};
// Actual CASCADE relations plus obsolete media notifications. SET NULL activities
// and replies are deliberately retained, matching the existing owner deletion.
const edges = [
	['hatady_book', 'hatady_bookmark', 'bookId'], ['hatady_book', 'hatady_book_memo', 'bookId'],
	['hatady_log', 'hatady_comment', 'logId'], ['hatady_log', 'hatady_reaction', 'logId'], ['hatady_log', 'hatady_notification', 'logId'],
	['hatady_comment', 'hatady_reaction', 'commentId'], ['hatady_comment', 'hatady_notification', 'commentId'],
	['hatady_media_work', 'hatady_media_comment', 'workId'], ['hatady_media_work', 'hatady_media_reaction', 'workId'], ['hatady_media_work', 'hatady_notification', 'mediaWorkId'],
	['hatady_media_session', 'hatady_media_comment', 'sessionId'], ['hatady_media_session', 'hatady_media_reaction', 'sessionId'], ['hatady_media_session', 'hatady_notification', 'mediaSessionId'],
	['hatady_media_comment', 'hatady_media_reaction', 'commentId'], ['hatady_media_comment', 'hatady_notification', 'mediaCommentId'],
] as const;
const values = (value: unknown): unknown[] => Array.isArray(value) ? value : [value];
const object = (value: unknown): Data => value != null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};

@Injectable()
export class RecordModerationService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		private roleService: RoleService, private idService: IdService,
		private announcementEntityService: AnnouncementEntityService, private globalEventService: GlobalEventService,
		private hatadyStreamService: HatadyStreamService,
		private notificationService: NotificationService,
	) {}

	private async authorize(viewer: MiUser, token: unknown) {
		if (token != null || !viewer?.id || !await this.roleService.isModerator(viewer)) throw new ApiError(errors.denied);
	}
	private async rows(manager: EntityManager, table: string, column: string, ids: string[], lock: boolean, ownerId?: string): Promise<Data[]> {
		if (!ids.length) return [];
		// Identifiers are exclusively internal constants, never request parameters.
		const rows = await manager.query(`SELECT to_jsonb(x) AS data FROM "${table}" x WHERE "${column}"=ANY($1::varchar[])${ownerId ? ' AND "userId"=$2' : ''} ORDER BY id${lock ? ' FOR UPDATE' : ''}`, ownerId ? [ids, ownerId] : [ids]);
		return rows.map((row: { data: Data }) => row.data);
	}
	// 'rows' locks only the rows; it is the first phase of a locked Hatask snapshot.
	private async snapshot(manager: EntityManager, target: RecordModerationTarget, lock: boolean | 'rows'): Promise<Snapshot> {
		let sources: Source[] = [], registry: Snapshot['registry'];
		let row: Data;
		if (target.product === 'hatady') {
			if (lock) await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`hatady-review:${target.targetType}:${target.targetId}`]);
			const table = tables[target.targetType];
			const root = await this.rows(manager, table, 'id', [target.targetId], !!lock);
			if (!root.length) throw new ApiError(errors.missing);
			[row] = await manager.query(`${HATADY_MODERATION_CTE} SELECT * FROM reviewed WHERE "targetType"=$1 AND "targetId"=$2`, [target.targetType, target.targetId]);
			if (!row) throw new ApiError(errors.missing);
			sources = [{ table, label: labels[table], rows: root }];
			for (let index = 0; index < sources.length; index++) {
				const source = sources[index];
				for (const [, child, column] of edges.filter(edge => edge[0] === source.table)) {
					const children = await this.rows(manager, child, column, source.rows.map(item => item.id), !!lock);
					const seen = new Set(sources.filter(item => item.table === child).flatMap(item => item.rows.map(value => value.id)));
					const fresh = children.filter(item => !seen.has(item.id));
					if (fresh.length) sources.push({ table: child, label: labels[child], rows: fresh });
				}
			}
		} else {
			// The first read resolves the owner only; everything is re-read after locking.
			[row] = await manager.query(`${HATASK_REVIEW_CTE} SELECT * FROM reviewed WHERE id=$1`, [target.targetId]);
			if (!row) throw new ApiError(errors.missing);
			if (lock === true) {
				// Writers take the planner lock, then the flower wallet and row locks;
				// the moderation trigger takes the owner lock last. Keep the same order.
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-planner:${row.userId}:${row.key}`]);
				if (row.key === 'todos' || row.key === 'gallery') await lockHataskFlowerWallet(manager, row.userId);
				const locked = await this.snapshot(manager, target, 'rows');
				await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`record-moderation:hatask:${locked.userId}`]);
				await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`hatask-review:${target.targetId}`]);
				// The owner lock now blocks new writes. Rows added or reviews changed before
				// it was taken surface here as a version change.
				const settled = await this.snapshot(manager, target, false);
				if (settled.version !== locked.version) throw new ApiError(errors.conflict);
				return settled;
			}
			const rowLock = lock === 'rows';
			const registryRows: RegistryRow[] = await manager.query(`SELECT id,value,"updatedAt" FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=ARRAY['client','hatask']::varchar[] AND key=$2 ORDER BY id${rowLock ? ' FOR UPDATE' : ''}`, [row.userId, row.key]);
			const serverId = row.key === 'events' ? row.entry_id.startsWith('server:') ? row.entry_id.slice(7) : row.data.serverEventId ?? row.data.localRecord?.serverEventId ?? null : null;
			const flowerId = row.key === 'gallery' && row.entry_id.startsWith('id:') ? row.entry_id.slice(3) : null;
			const selected = new Map<string, number[]>();
			for (const stored of registryRows) {
				const indexes: number[] = [];
				values(stored.value).forEach((value, index) => {
					const item = object(value);
					const entry = typeof item.id === 'string' && item.id ? `id:${item.id}` : row.key === 'flower' ? 'growing' : `${stored.id}:${index + 1}`;
					if (entry === row.entry_id || serverId && item.serverEventId === serverId) indexes.push(index);
				});
				if (indexes.length) selected.set(stored.id, indexes);
			}
			registry = { key: row.key, rows: registryRows, selected, serverId, flowerId };
			if (serverId) {
				// Event before RSVP, matching hatask/events/rsvp.
				const events = await this.rows(manager, 'hatask_event', 'id', [serverId], rowLock, row.userId);
				if (events.length) {
					sources.push({ table: 'hatask_event', label: labels.hatask_event, rows: events });
					sources.push({ table: 'hatask_rsvp', label: labels.hatask_rsvp, rows: await this.rows(manager, 'hatask_rsvp', 'eventId', [serverId], rowLock) });
				}
			}
			if (flowerId) {
				const flowers = await this.rows(manager, 'hatask_flower', 'clientFlowerId', [flowerId], rowLock, row.userId);
				if (flowers.length) sources.push({ table: 'hatask_flower', label: labels.hatask_flower, rows: flowers });
			}
		}
		const [owner] = await manager.query('SELECT username,name FROM "user" WHERE id=$1', [row.userId]);
		if (!owner) throw new ApiError(errors.missing);
		const impact = sources.filter(source => source.rows.length).map(source => ({ label: source.label, count: source.rows.length }));
		if (registry?.selected.size) impact.unshift({ label: '端末と同期する記録（同一記録の保存コピーを含む）', count: [...registry.selected.values()].reduce((sum, indexes) => sum + indexes.length, 0) });
		const registryVersion = registry?.key === 'flower' ? registry.rows.map(stored => ({
			id: stored.id,
			value: values(stored.value).map(value => {
				if (value == null || typeof value !== 'object' || Array.isArray(value)) return value;
				const { progress, lastGrowthAt, totalMinutes, ...content } = object(value);
				return content;
			}),
		})) : registry?.rows;
		return {
			userId: row.userId, username: owner.username, name: owner.name ?? '', title: String(row.title).slice(0, 300),
			version: recordModerationHash({ target: { product: target.product, targetType: target.targetType, targetId: target.targetId }, contentVersion: row.contentVersion, revision: row.revision, sources, registry: registryVersion, owner }),
			impact, sources, registry,
			retained: ['book', 'mediaWork'].includes(target.targetType) ? '関連する活動記録は残り、本・作品との関連だけが解除されます。添付画像のファイル自体は削除しません。' : '対象に付随しない記録と、添付画像のファイル自体は削除しません。',
		};
	}

	public async preview(viewer: MiUser, target: RecordModerationTarget, token: unknown = null) {
		await this.authorize(viewer, token); validateRecordModerationTarget(target);
		return this.db.transaction('REPEATABLE READ', async manager => {
			const snapshot = await this.snapshot(manager, target, false);
			await this.authorize(viewer, token);
			return { ...target, version: snapshot.version, title: snapshot.title, userId: snapshot.userId, username: snapshot.username, name: snapshot.name, impact: snapshot.impact, retained: snapshot.retained };
		});
	}
	private async remove(manager: EntityManager, target: RecordModerationTarget, snapshot: Snapshot, operationId: string) {
		if (snapshot.registry) {
			const { key, rows, selected, serverId, flowerId } = snapshot.registry;
			const removed: unknown[] = [];
			for (const stored of rows) {
				const indexes = selected.get(stored.id);
				if (!indexes) continue;
				const items = values(stored.value);
				removed.push(...indexes.map(index => items[index]));
				const remaining = items.filter((_, index) => !indexes.includes(index));
				await manager.query('UPDATE registry_item SET value=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1', [stored.id, JSON.stringify(Array.isArray(stored.value) ? remaining : remaining[0] ?? null)]);
			}
			if (removed.length) await manager.query(`INSERT INTO record_moderation_tombstone ("userId",key,identity,"operationId")
				SELECT $1,$2::text,hatask_record_identity($2::text,item),$3 FROM jsonb_array_elements($4::jsonb) item ON CONFLICT DO NOTHING`, [snapshot.userId, key, operationId, JSON.stringify(removed)]);
			for (const [collection, id] of [['serverEvent', serverId], ['gallery', flowerId]]) {
				if (id) await manager.query('INSERT INTO record_moderation_tombstone ("userId",key,identity,"operationId") VALUES ($1,$2::text,hatask_record_identity($2::text,jsonb_build_object(\'id\',$3::text)),$4) ON CONFLICT DO NOTHING', [snapshot.userId, collection, id, operationId]);
			}
			for (const source of snapshot.sources.filter(item => ['hatask_event', 'hatask_flower'].includes(item.table))) {
				await manager.query(`DELETE FROM "${source.table}" WHERE id=ANY($1::varchar[]) AND "userId"=$2`, [source.rows.map(row => row.id), snapshot.userId]);
			}
			return;
		}
		const root = snapshot.sources[0], data = root.rows[0];
		const notifications = snapshot.sources.filter(source => source.table === 'hatady_notification').flatMap(source => source.rows.map(row => row.id));
		if (notifications.length) await manager.query('DELETE FROM hatady_notification WHERE id=ANY($1::varchar[])', [notifications]);
		if (target.targetType === 'comment') await manager.query('UPDATE hatady_comment SET "replyId"=NULL WHERE "replyId"=$1', [target.targetId]);
		await manager.query(`DELETE FROM "${root.table}" WHERE id=$1 AND "userId"=$2`, [target.targetId, snapshot.userId]);
		// The surrounding transaction makes counter updates and audit inseparable.
		if (target.targetType === 'comment') await manager.query('UPDATE hatady_log SET "commentsCount"=GREATEST(0,"commentsCount"-1) WHERE id=$1', [data.logId]);
		if (target.targetType === 'reaction') {
			if (data.logId) await manager.query('UPDATE hatady_log SET "reactionsCount"=GREATEST(0,"reactionsCount"-1) WHERE id=$1', [data.logId]);
			if (data.commentId) await manager.query('UPDATE hatady_comment SET "reactionsCount"=GREATEST(0,"reactionsCount"-1) WHERE id=$1', [data.commentId]);
		}
		if (target.targetType === 'mediaReaction' && data.commentId) await manager.query('UPDATE hatady_media_comment SET "reactionsCount"=GREATEST(0,"reactionsCount"-1) WHERE id=$1', [data.commentId]);
	}
	public async execute(viewer: MiUser, input: RecordModerationRequest, token: unknown = null) {
		await this.authorize(viewer, token);
		const request = normalizeRecordModerationRequest(input), hash = recordModerationHash(request);
		let result: Operation;
		let changedActivities: { source: 'log' | 'session'; id: string }[] = [];
		let changedNotifications: { id: string; notifieeId: string }[] = [];
		try {
			result = await this.db.transaction(async manager => {
				await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`record-moderation:request:${viewer.id}:${request.requestId}`]);
				const [existing]: Operation[] = await manager.query('SELECT * FROM record_moderation_operation WHERE "moderatorId"=$1 AND "requestId"=$2', [viewer.id, request.requestId]);
				if (existing) {
					if (existing.requestHash !== hash) throw new ApiError(errors.conflict);
					return existing;
				}
				const snapshot = await this.snapshot(manager, request, true);
				if (request.action === 'delete' && request.product === 'hatady') {
					changedNotifications = snapshot.sources.filter(source => source.table === 'hatady_notification').flatMap(source => source.rows)
						.filter(row => typeof row.id === 'string' && typeof row.notifieeId === 'string')
						.map(row => ({ id: row.id as string, notifieeId: row.notifieeId as string }));
					const row = snapshot.sources[0]?.rows[0];
					if (request.targetType === 'book') {
						const logs: { id: string }[] = await manager.query('SELECT id FROM hatady_log WHERE "bookId"=$1', [request.targetId]);
						changedActivities.push(...logs.map(log => ({ source: 'log' as const, id: log.id })));
					}
					const logId = request.targetType === 'log' ? request.targetId : row?.logId ?? (request.targetType === 'reaction' && row?.commentId ? (await manager.query('SELECT "logId" FROM hatady_comment WHERE id=$1', [row.commentId]))[0]?.logId : null);
					if (logId) changedActivities.push({ source: 'log', id: logId });
					const sessionId = request.targetType === 'mediaSession' ? request.targetId : row?.sessionId ?? (request.targetType === 'mediaReaction' && row?.commentId ? (await manager.query('SELECT "sessionId" FROM hatady_media_comment WHERE id=$1', [row.commentId]))[0]?.sessionId : null);
					if (sessionId) changedActivities.push({ source: 'session', id: sessionId });
					const workId = request.targetType === 'mediaWork' ? request.targetId : row?.workId ?? (request.targetType === 'mediaReaction' && row?.commentId ? (await manager.query('SELECT "workId" FROM hatady_media_comment WHERE id=$1', [row.commentId]))[0]?.workId : null);
					if (workId) {
						const sessions: { id: string }[] = await manager.query('SELECT id FROM hatady_media_session WHERE "workId"=$1', [workId]);
						changedActivities.push(...sessions.map(session => ({ source: 'session' as const, id: session.id })));
						if (sessions.length > 0) {
							const relatedNotifications: { id: string; notifieeId: string }[] = await manager.query('SELECT id,"notifieeId" FROM hatady_notification WHERE "mediaSessionId"=ANY($1::varchar[])', [sessions.map(session => session.id)]);
							changedNotifications.push(...relatedNotifications);
						}
					}
				}
				if (snapshot.version !== request.version) throw new ApiError(errors.conflict);
				// Recheck role immediately before mutations as well as at endpoint entry.
				await this.authorize(viewer, token);
				const [actor] = await manager.query('SELECT username,name FROM "user" WHERE id=$1', [viewer.id]);
				const now = new Date(), operationId = this.idService.gen(now.getTime());
				const warningId = request.warning === null ? null : this.idService.gen(now.getTime());
				const info: RecordModerationInfo = {
					operationId, product: request.product, targetType: request.targetType, targetId: request.targetId, title: snapshot.title,
					targetUserId: snapshot.userId, targetUsername: snapshot.username, targetName: snapshot.name,
					moderatorId: viewer.id, moderatorUsername: actor.username, moderatorName: actor.name ?? '', performedAt: now.toISOString(),
					reason: request.reason, impact: request.action === 'delete' ? snapshot.impact : [], warningId,
				};
				await manager.query(`INSERT INTO record_moderation_operation (id,"moderatorId","requestId","requestHash",product,"targetType","targetId",action,"createdAt",info)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [operationId, viewer.id, request.requestId, hash, request.product, request.targetType, request.targetId, request.action, now, JSON.stringify(info)]);
				if (request.action === 'delete') await this.remove(manager, request, snapshot, operationId);
				const productName = request.product === 'hatady' ? 'Hatady' : 'Hatask';
				if (warningId) await manager.getRepository(MiAnnouncement).insert({
					id: warningId, updatedAt: null, title: `${productName}のご利用について`,
					text: `${request.warning}\n\n対応：${request.action === 'delete' ? '対象の記録を削除しました' : '対象の記録について警告しました'}\n対象の記録ID：${request.targetId}\nお問い合わせID：${operationId}`,
					imageUrl: null, icon: 'warning', display: 'dialog', needConfirmationToRead: true,
					isActive: true, forExistingUsers: false, silence: false, userId: snapshot.userId,
				});
				const prefix = request.product === 'hatady' ? 'Hatady' : 'Hatask';
				if (request.action === 'delete') await manager.query('INSERT INTO moderation_log (id,"userId",type,info) VALUES ($1,$2,$3,$4::jsonb)', [this.idService.gen(now.getTime()), viewer.id, `delete${prefix}Record`, JSON.stringify(info)]);
				if (warningId) await manager.query('INSERT INTO moderation_log (id,"userId",type,info) VALUES ($1,$2,$3,$4::jsonb)', [this.idService.gen(now.getTime()), viewer.id, `warn${prefix}User`, JSON.stringify({ ...info, impact: [] })]);
				return { id: operationId, action: request.action, createdAt: now, info, requestHash: hash };
			});
		} catch (error) {
			changedActivities = [];
			changedNotifications = [];
			const code = (error as { driverError?: { code?: string } }).driverError?.code;
			if (code === '40001' || code === '40P01') throw new ApiError(errors.conflict);
			throw error;
		}
		for (const activity of changedActivities) this.hatadyStreamService?.changed(activity.source, activity.id);
		const byOwner = new Map<string, string[]>();
		for (const row of changedNotifications) byOwner.set(row.notifieeId, [...new Set([...(byOwner.get(row.notifieeId) ?? []), row.id])]);
		await Promise.all([...byOwner].map(([userId, ids]) => this.notificationService.refreshSourceNotifications(userId, 'hatady', ids).catch(() => {})));
		// Delivery is durable at commit. A failed realtime hint never turns a committed
		// deletion into an error; getUnreadAnnouncements will still return the warning.
		if (result.info.warningId) {
			try {
				const announcement = await this.db.getRepository(MiAnnouncement).findOneBy({ id: result.info.warningId });
				if (announcement) this.globalEventService.publishMainStream(result.info.targetUserId, 'announcementCreated', { announcement: await this.announcementEntityService.pack(announcement) });
			} catch { /* The persisted, recipient-only announcement remains available. */ }
		}
		return { operationId: result.id, action: result.action, performedAt: result.info.performedAt, warningId: result.info.warningId };
	}
	public async history(viewer: MiUser, target: RecordModerationTarget, token: unknown = null) {
		await this.authorize(viewer, token); validateRecordModerationTarget(target);
		const rows: Operation[] = await this.db.query('SELECT id,action,"createdAt",info FROM record_moderation_operation WHERE product=$1 AND "targetType"=$2 AND "targetId"=$3 ORDER BY id DESC LIMIT 50', [target.product, target.targetType, target.targetId]);
		await this.authorize(viewer, token);
		return rows.map(row => ({ action: row.action, ...row.info }));
	}
}
