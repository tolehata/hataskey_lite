/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { In } from 'typeorm';
import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import {
	obsoleteNotificationTypes,
	groupedNotificationTypes,
	FilterUnionByProperty,
	notificationFilterTypes,
} from '@/types.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { MiGroupedNotification, MiNotification } from '@/models/Notification.js';

export const meta = {
	tags: ['account', 'notifications'],

	requireCredential: true,

	limit: {
		duration: 30000,
		max: 30,
	},

	kind: 'read:notifications',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Notification',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		markAsRead: { type: 'boolean', default: true },
		excludeBots: { type: 'boolean', default: false },
		// 後方互換のため、廃止された通知タイプも受け付ける
		includeTypes: { type: 'array', items: {
			type: 'string', enum: [...notificationFilterTypes, ...obsoleteNotificationTypes],
		} },
		excludeTypes: { type: 'array', items: {
			type: 'string', enum: [...notificationFilterTypes, ...obsoleteNotificationTypes],
		} },
	},
	required: [],
} as const;

function groupNotifications(notifications: MiNotification[]) {
	// grouping
	// 旗鯖fork: リアクション通知のグルーピングを「隣接比較」から「全体集約」方式に変更。
	// 旧実装は prev (直前) のみと比較していたため、同じノートへのリアクションが時系列で
	// 飛び石になると複数グループに分裂し、(1) 同じ投稿の通知が重複表示される、
	// (2) 分裂で水増しされたグループが slice(limit) で切られてリアクションが欠落する、
	// という不具合があった。リアクションは全体を走査して noteId / notifierId で集約することで
	// 飛び石でも 1 グループにまとめ、重複と欠落を解消する。
	// renote / note のグルーピングは Misskey 標準の隣接比較のまま。

	// (1) リアクション通知を noteId ごとに集約 (同じノートへの複数ユーザー → reaction:grouped 候補)
	const reactionsByNote = new Map<string, FilterUnionByProperty<MiNotification, 'type', 'reaction'>[]>();
	for (const n of notifications) {
		if (n.type !== 'reaction' || n.noteId == null) continue;
		const arr = reactionsByNote.get(n.noteId);
		if (arr) arr.push(n as any);
		else reactionsByNote.set(n.noteId, [n as any]);
	}

	// (2) 「そのノートへのリアクションが自分だけ (1件)」のものは groupedByUser 候補に回す。
	//     2件以上のノートは reaction:grouped として確定 (同じノートへの複数人リアクションを最優先)。
	const groupedReactionNoteIds = new Set<string>(); // reaction:grouped に確定した noteId
	const singleReactions: FilterUnionByProperty<MiNotification, 'type', 'reaction'>[] = []; // groupedByUser 候補
	for (const [noteId, arr] of reactionsByNote) {
		if (arr.length >= 2) {
			groupedReactionNoteIds.add(noteId);
		} else {
			singleReactions.push(arr[0]);
		}
	}

	// (3) 単独リアクションを notifierId ごとに集約 (同じユーザーが複数ノート → reaction:groupedByUser 候補)
	const reactionsByUser = new Map<string, FilterUnionByProperty<MiNotification, 'type', 'reaction'>[]>();
	for (const n of singleReactions) {
		if (n.notifierId == null) continue;
		const arr = reactionsByUser.get(n.notifierId);
		if (arr) arr.push(n);
		else reactionsByUser.set(n.notifierId, [n]);
	}
	const groupedByUserNotifierIds = new Set<string>(); // groupedByUser に確定した notifierId
	for (const [notifierId, arr] of reactionsByUser) {
		if (arr.length >= 2) groupedByUserNotifierIds.add(notifierId);
	}

	// (4) 元の時系列順を保ったまま 1 パスで構築する。
	//     各グループは「最初に出現した位置」に 1 つだけ置き、以降の同グループ要素はスキップする。
	const emittedReactionNoteIds = new Set<string>();
	const emittedByUserNotifierIds = new Set<string>();
	const groupedNotifications: MiGroupedNotification[] = [];
	const memberIds = new Map<MiGroupedNotification, string[]>();
	const append = (group: MiGroupedNotification, ids: string[]) => { groupedNotifications.push(group); memberIds.set(group, ids); };

	for (let i = 0; i < notifications.length; i++) {
		const notification = notifications[i];

		// --- リアクション: 全体集約の結果を使って 1 グループ = 1 エントリで出力 ---
		if (notification.type === 'reaction' && notification.noteId != null) {
			const noteId = notification.noteId;
			// 同じノートへの複数人リアクション → reaction:grouped
			if (groupedReactionNoteIds.has(noteId)) {
				if (emittedReactionNoteIds.has(noteId)) continue; // 既に出力済みなのでスキップ (重複防止)
				emittedReactionNoteIds.add(noteId);
				const arr = reactionsByNote.get(noteId)!;
				append({
					type: 'reaction:grouped',
					id: arr[arr.length - 1].id, // 取得順で末尾の通知IDをページ境界に使う
					createdAt: arr[0].createdAt,
					noteId,
					reactions: arr.map(r => ({
						userId: r.notifierId!,
						reaction: r.reaction!,
					})),
				}, arr.map(item => item.id));
				continue;
			}
			// 同じユーザーが複数ノートにリアクション → reaction:groupedByUser
			if (notification.notifierId != null && groupedByUserNotifierIds.has(notification.notifierId)) {
				const notifierId = notification.notifierId;
				if (emittedByUserNotifierIds.has(notifierId)) continue; // 既に出力済みなのでスキップ
				emittedByUserNotifierIds.add(notifierId);
				const arr = reactionsByUser.get(notifierId)!;
				append({
					type: 'reaction:groupedByUser',
					id: arr[arr.length - 1].id,
					createdAt: arr[0].createdAt,
					notifierId,
					reactions: arr.map(r => ({
						noteId: r.noteId!,
						reaction: r.reaction!,
						createdAt: r.createdAt,
					})),
				}, arr.map(item => item.id));
				continue;
			}
			// どちらにも属さない完全な単発リアクションはそのまま
			append(notification, [notification.id]);
			continue;
		}

		// --- renote / note: Misskey標準の隣接比較を維持 ---
		const prevGroupedNotification = groupedNotifications.at(-1);
		if (prevGroupedNotification != null && i > 0) {
			const prev = notifications[i - 1];
			if (prev.type === 'renote' && notification.type === 'renote' && prev.targetNoteId === notification.targetNoteId) {
				let target = prevGroupedNotification;
				if (target.type !== 'renote:grouped') {
					const previousIds = memberIds.get(target) ?? [prev.id];
					memberIds.delete(target);
					groupedNotifications[groupedNotifications.length - 1] = {
						type: 'renote:grouped',
						id: '',
						createdAt: notification.createdAt,
						noteId: prev.noteId!,
						userIds: [prev.notifierId!],
					};
					target = groupedNotifications.at(-1)!;
					memberIds.set(target, previousIds);
				}
				(target as FilterUnionByProperty<MiGroupedNotification, 'type', 'renote:grouped'>).userIds.push(notification.notifierId!);
				target.id = notification.id;
				memberIds.get(target)!.push(notification.id);
				continue;
			}
			if (prev.type === 'note' && notification.type === 'note') {
				let target = prevGroupedNotification;
				if (target.type !== 'note:grouped') {
					const previousIds = memberIds.get(target) ?? [prev.id];
					memberIds.delete(target);
					groupedNotifications[groupedNotifications.length - 1] = {
						type: 'note:grouped',
						id: '',
						createdAt: notification.createdAt,
						noteIds: [prev.noteId],
						notifierIds: [prev.notifierId!],
					};
					target = groupedNotifications.at(-1)!;
					memberIds.set(target, previousIds);
				}
				if (!(target as FilterUnionByProperty<MiGroupedNotification, 'type', 'note:grouped'>).notifierIds.includes(notification.notifierId)) {
					(target as FilterUnionByProperty<MiGroupedNotification, 'type', 'note:grouped'>).notifierIds.push(notification.notifierId!);
				}
				(target as FilterUnionByProperty<MiGroupedNotification, 'type', 'note:grouped'>).noteIds.push(notification.noteId!);
				target.id = notification.id;
				memberIds.get(target)!.push(notification.id);
				continue;
			}
		}

		append(notification, [notification.id]);
	}

	return { groups: groupedNotifications, memberIds };
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private idService: IdService,
		private notificationEntityService: NotificationEntityService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const EXTRA_LIMIT = 100;
			const untilId = ps.untilId ?? (ps.untilDate ? this.idService.gen(ps.untilDate!) : undefined);
			const sinceId = ps.sinceId ?? (ps.sinceDate ? this.idService.gen(ps.sinceDate!) : undefined);

			// 種類の全解除・全除外でも、選択ブランド内の必須アイコンデコ獲得通知を取得する。
			const includeTypes = ps.includeTypes && ps.includeTypes.filter(type => !(obsoleteNotificationTypes).includes(type as any)) as typeof groupedNotificationTypes[number][];
			const excludeTypes = ps.excludeTypes && ps.excludeTypes.filter(type => !(obsoleteNotificationTypes).includes(type as any)) as typeof groupedNotificationTypes[number][];

			const notifications = await this.notificationService.getNotifications(me.id, {
				sinceId: sinceId,
				untilId: untilId,
				// グルーピングで件数が減っても、指定件数ぶんの表示候補を確保する。
				limit: ps.limit + EXTRA_LIMIT,
				includeTypes,
				excludeTypes,
				excludeBots: ps.excludeBots,
			});

			if (notifications.length === 0) {
				return [];
			}

			let pageNotifications = notifications;
			let grouped = groupNotifications(pageNotifications);
			// A page must cover a contiguous range of source notifications. Otherwise
			// a reaction group can move the cursor past an omitted, still-unread row.
			while (grouped.groups.length > ps.limit) {
				const nextGroup = grouped.groups[ps.limit];
				const nextId = grouped.memberIds.get(nextGroup)?.[0];
				if (nextId == null) throw new Error('Missing notification group members');
				const boundary = pageNotifications.findIndex(notification => notification.id === nextId);
				pageNotifications = pageNotifications.slice(0, boundary);
				grouped = groupNotifications(pageNotifications);
			}
			const { groups: limitedGroupedNotifications, memberIds } = grouped;

			const packed = await this.notificationEntityService.packGroupedMany(limitedGroupedNotifications, me.id);
			const selected = new Map(limitedGroupedNotifications.map(group => [group.id, memberIds.get(group) ?? [group.id]]));
			const selectedIds = [...new Set([...selected.values()].flat())];
			const originalById = new Map(notifications.map(notification => [notification.id, notification]));
			const firstPassIds = (group: (typeof packed)[number], ids: string[]): string[] => {
				const display = group as { type: string; reactions?: { user?: { id: string }; note?: { id: string } }[]; users?: { id: string }[] };
				if (display.type === 'reaction:grouped') {
					const userIds = new Set((display.reactions ?? []).flatMap(reaction => reaction.user?.id ? [reaction.user.id] : []));
					return ids.filter(id => { const original = originalById.get(id); return original != null && 'notifierId' in original && typeof original.notifierId === 'string' && userIds.has(original.notifierId); });
				}
				if (display.type === 'reaction:groupedByUser') {
					const noteIds = new Set((display.reactions ?? []).flatMap(reaction => reaction.note?.id ? [reaction.note.id] : []));
					return ids.filter(id => { const original = originalById.get(id); return original != null && 'noteId' in original && typeof original.noteId === 'string' && noteIds.has(original.noteId); });
				}
				if (display.type === 'renote:grouped' || display.type === 'note:grouped') {
					const userIds = new Set((display.users ?? []).map(user => user.id));
					return ids.filter(id => { const original = originalById.get(id); return original != null && 'notifierId' in original && typeof original.notifierId === 'string' && userIds.has(original.notifierId); });
				}
				return ids;
			};
			const current = await this.notificationService.findNotificationsByIds(me.id, selectedIds);
			const visible = new Set((await this.notificationEntityService.packMany(current, me.id)).map(item => item.id));
			const result = packed.map(group => ({ ...group, notificationIds: firstPassIds(group, selected.get(group.id) ?? []).filter(id => visible.has(id)) }))
				.filter(group => group.notificationIds.length > 0);
			if (ps.markAsRead) await this.notificationService.markNotificationsRead(me.id, result.flatMap(group => group.notificationIds));
			return result;
		});
	}
}
