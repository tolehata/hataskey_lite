/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EntityNotFoundError, In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { ChannelInvitationsRepository, FollowRequestsRepository, HatadyNotificationsRepository, NotesRepository, MiUser, UsersRepository, UserGroupInvitationsRepository } from '@/models/_.js';
import { MiHatadyLog } from '@/models/HatadyLog.js';
import { MiHatadyComment } from '@/models/HatadyComment.js';
import { MiHatadyMediaWork } from '@/models/HatadyMediaWork.js';
import { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import { MiHatadyMediaComment } from '@/models/HatadyMediaComment.js';
import type { HatadyService } from '@/core/HatadyService.js';
import type { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiGroupedNotification, MiNotification } from '@/models/Notification.js';
import type { MiNote } from '@/models/Note.js';
import type { Packed } from '@/misc/json-schema.js';
import { bindThis } from '@/decorators.js';
import { FilterUnionByProperty, groupedNotificationTypes } from '@/types.js';
import { CacheService } from '@/core/CacheService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import { RoleEntityService } from './RoleEntityService.js';
import { ChatEntityService } from './ChatEntityService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { UserEntityService } from './UserEntityService.js';
import type { NoteEntityService } from './NoteEntityService.js';
import type { UserGroupInvitationEntityService } from './UserGroupInvitationEntityService.js';

const NOTE_REQUIRED_NOTIFICATION_TYPES = new Set([
	'note',
	'mention',
	'reply',
	'renote',
	'renote:grouped',
	'quote',
	'reaction',
	'reaction:grouped',
	'pollEnded',
	'scheduledNotePosted',
] as (typeof groupedNotificationTypes[number])[]);

@Injectable()
export class NotificationEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private noteEntityService: NoteEntityService;
	private roleEntityService: RoleEntityService;
	private chatEntityService: ChatEntityService;
	private userGroupInvitationEntityService: UserGroupInvitationEntityService;
	private hatadyService: HatadyService;
	private hatadyMediaService: HatadyMediaService;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.followRequestsRepository)
		private followRequestsRepository: FollowRequestsRepository,

		@Inject(DI.userGroupInvitationsRepository)
		private userGroupInvitationsRepository: UserGroupInvitationsRepository,

		@Inject(DI.channelInvitationsRepository)
		private channelInvitationsRepository: ChannelInvitationsRepository,

		@Inject(DI.hatadyNotificationsRepository)
		private hatadyNotificationsRepository: HatadyNotificationsRepository,

		private cacheService: CacheService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.noteEntityService = this.moduleRef.get('NoteEntityService');
		this.roleEntityService = this.moduleRef.get('RoleEntityService');
		this.chatEntityService = this.moduleRef.get('ChatEntityService');
		this.userGroupInvitationEntityService = this.moduleRef.get('UserGroupInvitationEntityService');
		this.hatadyService = this.moduleRef.get<HatadyService>('HatadyService', { strict: false });
		this.hatadyMediaService = this.moduleRef.get<HatadyMediaService>('HatadyMediaService', { strict: false });
	}

	/** Resolve the current target before exposing its title or stable ID. */
	@bindThis
	private async packHatady(notification: Extract<MiNotification, { type: 'hatady' }>, meId: MiUser['id']): Promise<Packed<'Notification'> | null> {
		const source = await this.hatadyNotificationsRepository.findOneBy({ id: notification.sourceNotificationId, notifieeId: meId });
		if (source == null || source.deletedAt != null || source.type !== notification.subtype) return null;
		if (source.notifierId !== (notification.notifierId ?? null)) return null;
		if (source.notifierId != null && !(await this.hatadyService.canAppearInTimeline(source.notifierId, meId))) return null;
		const repository = this.hatadyNotificationsRepository.manager;
		let title: string | undefined;
		let logId: string | undefined;
		let commentId: string | undefined;
		let mediaWorkId: string | undefined;
		let mediaSessionId: string | undefined;
		let mediaCommentId: string | undefined;
		if (notification.targetType === 'log' || notification.targetType === 'comment') {
			if (notification.targetId == null) return null;
			const comment = notification.targetType === 'comment'
				? await repository.getRepository(MiHatadyComment).findOneBy({ id: notification.targetId })
				: null;
			if (notification.targetType === 'comment' && comment == null) return null;
			const targetLogId = notification.targetType === 'log' ? notification.targetId : comment!.logId;
			const log = await repository.getRepository(MiHatadyLog).findOneBy({ id: targetLogId });
			if (log == null || !(await this.hatadyService.canViewLog(log, meId))) return null;
			title = log.title;
			logId = log.id;
			commentId = comment?.id;
		} else if (notification.targetType === 'work' || notification.targetType === 'session' || notification.targetType === 'mediaComment') {
			if (notification.targetId == null) return null;
			const comment = notification.targetType === 'mediaComment'
				? await repository.getRepository(MiHatadyMediaComment).findOneBy({ id: notification.targetId })
				: null;
			if (notification.targetType === 'mediaComment' && comment == null) return null;
			const sessionId = notification.targetType === 'session' ? notification.targetId : comment?.sessionId ?? source.mediaSessionId;
			let visibleTarget = false;
			let session: MiHatadyMediaSession | null = null;
			if (sessionId != null) {
				session = await repository.getRepository(MiHatadyMediaSession).findOneBy({ id: sessionId });
				if (session == null || !(await this.hatadyMediaService.canViewSession(session, null, meId))) return null;
				mediaSessionId = session.id;
				visibleTarget = true;
			}
			const workId = notification.targetType === 'work' ? notification.targetId : comment?.workId ?? session?.workId ?? source.mediaWorkId;
			if (workId != null) {
				const work = await repository.getRepository(MiHatadyMediaWork).findOneBy({ id: workId });
				if (work != null && await this.hatadyMediaService.canViewWork(work, meId)) {
					title = work.title;
					mediaWorkId = work.id;
					visibleTarget = true;
				} else if (notification.targetType === 'work' || (notification.targetType === 'mediaComment' && comment?.workId != null)) return null;
			}
			if (!visibleTarget) return null;
			mediaCommentId = comment?.id;
		} else if (notification.targetType !== 'none' || notification.targetId != null
			|| !['follow', 'milestone', 'goalDone'].includes(notification.subtype)) {
			return null;
		}
		const user = source.notifierId == null ? undefined : await this.userEntityService.pack(source.notifierId, { id: meId });
		if (source.notifierId != null && user == null) return null;
		return {
			id: notification.id,
			createdAt: new Date(notification.createdAt).toISOString(),
			type: 'hatady',
			sourceNotificationId: source.id,
			subtype: notification.subtype,
			targetType: notification.targetType,
			targetId: notification.targetId,
			...(source.notifierId != null ? { userId: source.notifierId, user } : {}),
			...(title != null ? { title } : {}),
			...(logId != null ? { logId } : {}),
			...(commentId != null ? { commentId } : {}),
			...(mediaWorkId != null ? { mediaWorkId } : {}),
			...(mediaSessionId != null ? { mediaSessionId } : {}),
			...(mediaCommentId != null ? { mediaCommentId } : {}),
			...(source.reaction != null ? { reaction: source.reaction } : {}),
			...(source.value != null ? { value: source.value } : {}),
			isRead: source.isRead,
		} as unknown as Packed<'Notification'>;
	}

	private async packVisibleNote(noteId: MiNote['id'], meId: MiUser['id']): Promise<Packed<'Note'> | null> {
		try {
			return await this.noteEntityService.pack(noteId, { id: meId }, { detail: true });
		} catch (error) {
			if (error instanceof PrivateChannelNoteVisibilityError || error instanceof EntityNotFoundError) return null;
			throw error;
		}
	}

	/**
	 * 通知をパックする共通処理
	*/
	async #packInternal <T extends MiNotification | MiGroupedNotification> (
		src: T,
		meId: MiUser['id'],
		options: {
			checkValidNotifier?: boolean;
			checkValidChannelInvitation?: boolean;
		},
		hint?: {
			packedNotes: Map<MiNote['id'], Packed<'Note'>>;
			packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
		},
	): Promise<Packed<'Notification'> | null> {
		const notification = src;
		if (notification.type === 'hatady') {
			if (options.checkValidNotifier !== false && !(await this.#isValidNotifier(notification, meId))) return null;
			return this.packHatady(notification, meId);
		}

		if (options.checkValidNotifier !== false && !(await this.#isValidNotifier(notification, meId))) return null;
		if (options.checkValidChannelInvitation !== false
			&& notification.type === 'addedToPrivateChannel'
			&& notification.channelInvitationId != null
			&& !await this.channelInvitationsRepository.exists({ where: { id: notification.channelInvitationId, userId: meId, status: 'pending' } })) return null;

		// 旗鯖fork: NOTE_REQUIRED_NOTIFICATION_TYPES は addedToPrivateChannel 等を含まない
		// (MiNotification['type'] 全体より狭い)。その場合 has() は元々 false を返すだけなので、
		// 型だけ広げて渡す(挙動は変えない)。
		const needsNote = NOTE_REQUIRED_NOTIFICATION_TYPES.has(notification.type as typeof groupedNotificationTypes[number]) && 'noteId' in notification;
		const noteIfNeed = needsNote ? (
			hint?.packedNotes != null
				? hint.packedNotes.get(notification.noteId)
				: await this.packVisibleNote(notification.noteId, meId)
		) : undefined;
		// if the note has been deleted, don't show this notification
		if (needsNote && !noteIfNeed) return null;

		const needsUser = 'notifierId' in notification;
		// 旗鯖fork: addedToPrivateChannel/removedFromPrivateChannel は notifierId が
		// null になり得る型だが、既存の呼び出し(get/pack)はそのまま渡しても
		// 従来どおり「見つからない」扱いになるだけなので挙動は変えず、型だけ通す。
		const userIfNeed = needsUser ? (
			hint?.packedUsers != null
				? hint.packedUsers.get(notification.notifierId as MiUser['id'])
				: this.userEntityService.pack(notification.notifierId as MiUser['id'], { id: meId })
		) : undefined;
		// if the user has been deleted, don't show this notification
		if (needsUser && !userIfNeed) return null;

		//#region Grouped notifications
		if (notification.type === 'reaction:grouped') {
			const reactions = (await Promise.all(notification.reactions.map(async reaction => {
				const user = hint?.packedUsers != null
					? hint.packedUsers.get(reaction.userId)!
					: await this.userEntityService.pack(reaction.userId, { id: meId });
				return {
					user,
					reaction: reaction.reaction,
				};
			}))).filter(r => r.user != null);
			// if all users have been deleted, don't show this notification
			if (reactions.length === 0) {
				return null;
			}

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				note: noteIfNeed,
				reactions,
			});
		} else if (notification.type === 'reaction:groupedByUser') {
			// 旗鯖fork: 同じユーザーから複数ノートへのリアクションをまとめて表示
			const user = hint?.packedUsers != null
				? hint.packedUsers.get(notification.notifierId)
				: await this.userEntityService.pack(notification.notifierId, { id: meId });
			if (!user) return null;

			const reactions = (await Promise.all(notification.reactions.map(async reaction => {
				const note = hint?.packedNotes != null
					? hint.packedNotes.get(reaction.noteId)
					: await this.packVisibleNote(reaction.noteId, meId);
				if (!note) return null;
				return {
					note,
					reaction: reaction.reaction,
					createdAt: new Date(reaction.createdAt).toISOString(),
				};
			}))).filter(r => r != null);
			// if all notes have been deleted, don't show this notification
			if (reactions.length === 0) return null;

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				user,
				userId: notification.notifierId,
				reactions,
			});
		} else if (notification.type === 'renote:grouped') {
			const users = (await Promise.all(notification.userIds.map(userId => {
				const packedUser = hint?.packedUsers != null ? hint.packedUsers.get(userId) : null;
				if (packedUser) {
					return packedUser;
				}

				return this.userEntityService.pack(userId, { id: meId });
			}))).filter(x => x != null);
			// if all users have been deleted, don't show this notification
			if (users.length === 0) {
				return null;
			}

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				note: noteIfNeed,
				users,
			});
		} else if (notification.type === 'note:grouped') {
			const notes = (await Promise.all(notification.noteIds.map(noteId => hint?.packedNotes != null
				? hint.packedNotes.get(noteId)
				: this.packVisibleNote(noteId, meId)))).filter(note => note != null);
			if (notes.length === 0) return null;
			const visibleAuthors = new Set(notes.map(note => note.userId));
			const users = (await Promise.all(notification.notifierIds.filter(id => visibleAuthors.has(id)).map(notifier => {
				const packedUser = hint?.packedUsers != null ? hint.packedUsers.get(notifier) : null;
				if (packedUser) {
					return packedUser;
				}

				return this.userEntityService.pack(notifier, { id: meId });
			}))).filter(x => x != null);
			// if all users have been deleted, don't show this notification
			if (users.length === 0) {
				return null;
			}

			return await awaitAll({
				id: notification.id,
				createdAt: new Date(notification.createdAt).toISOString(),
				type: notification.type,
				noteIds: notes.map(note => note.id),
				users,
			});
		}
		//#endregion

		const needsRole = notification.type === 'roleAssigned';
		const role = needsRole ? await this.roleEntityService.pack(notification.roleId) : undefined;
		// if the role has been deleted, don't show this notification
		if (needsRole && !role) {
			return null;
		}

		const needsChatRoomInvitation = notification.type === 'chatRoomInvitationReceived';
		const chatRoomInvitation = needsChatRoomInvitation ? await this.chatEntityService.packRoomInvitation(notification.invitationId, { id: meId }).catch(() => null) : undefined;
		// if the invitation has been deleted, don't show this notification
		if (needsChatRoomInvitation && !chatRoomInvitation) {
			return null;
		}

		return await awaitAll({
			id: notification.id,
			createdAt: new Date(notification.createdAt).toISOString(),
			type: notification.type === 'app' && notification.customHeader === 'HataFeed' ? 'hataFeed' : notification.type,
			userId: 'notifierId' in notification ? notification.notifierId : undefined,
			...(userIfNeed != null ? { user: userIfNeed } : {}),
			...(noteIfNeed != null ? { note: noteIfNeed } : {}),
			...(notification.type === 'reaction' ? {
				reaction: notification.reaction,
			} : {}),
			...(notification.type === 'groupInvited' ? {
				invitation: this.userGroupInvitationEntityService.pack(notification.userGroupInvitationId),
			} : {}),
			...(notification.type === 'roleAssigned' ? {
				role: role,
			} : {}),
			...(notification.type === 'chatRoomInvitationReceived' ? {
				invitation: chatRoomInvitation,
			} : {}),
			...(notification.type === 'followRequestAccepted' ? {
				message: notification.message,
			} : {}),
			...(notification.type === 'achievementEarned' ? {
				achievement: notification.achievement,
			} : {}),
			...(notification.type === 'exportCompleted' ? {
				exportedEntity: notification.exportedEntity,
				fileId: notification.fileId,
			} : {}),
			...(notification.type === 'login' ? {
				ip: notification.userIp,
			} : {}),
			...(notification.type === 'app' || notification.type === 'hataFeed' || notification.type === 'hataskFlowerReady' || notification.type === 'hataskFlowerBloomed' || notification.type === 'hataskZukanUpdated' || notification.type === 'hataskFestivalBloomed' || notification.type === 'hataskDecorationUnlocked' || notification.type === 'earthquake'
				|| notification.type === 'addedToPrivateChannel' || notification.type === 'removedFromPrivateChannel' ? {
				body: notification.customBody,
				header: notification.customHeader,
				icon: notification.customIcon,
				// 旗鯖fork: クリック時の遷移先 (相対パス)
				link: notification.customLink,
				...(notification.type === 'hataFeed' && notification.sourceNotificationId != null ? { sourceNotificationId: notification.sourceNotificationId } : {}),
				...(notification.type === 'addedToPrivateChannel' && notification.channelInvitationId != null ? { invitationId: notification.channelInvitationId } : {}),
			} : {}),
		});
	}

	async #packManyInternal <T extends MiNotification | MiGroupedNotification>	(
		notifications: T[],
		meId: MiUser['id'],
	): Promise<T[]> {
		if (notifications.length === 0) return [];

		let validNotifications = notifications;

		validNotifications = await this.#filterValidNotifier(validNotifications, meId);

		const noteIds = validNotifications.map(x => 'noteId' in x ? x.noteId : null).filter(x => x != null);
		// 旗鯖fork: reaction:groupedByUser は内部に複数の noteId を持つため、別途バルク取得対象に追加
		for (const notification of validNotifications) {
			if (notification.type === 'note:grouped') noteIds.push(...notification.noteIds);
			if (notification.type === 'reaction:groupedByUser') {
				for (const r of notification.reactions) {
					noteIds.push(r.noteId);
				}
			}
		}
		const notes = noteIds.length > 0 ? await this.notesRepository.find({
			where: { id: In(noteIds) },
			relations: { user: true, reply: { user: true }, renote: { user: true } },
		}) : [];
		const packedNotesArray = await this.noteEntityService.packMany(notes, { id: meId }, {
			detail: true,
		});
		const packedNotes = new Map(packedNotesArray.map(p => [p.id, p]));

		validNotifications = validNotifications.filter(x => !('noteId' in x) || packedNotes.has(x.noteId));

		const userIds = [];
		for (const notification of validNotifications) {
			if ('notifierId' in notification) userIds.push(notification.notifierId);
			if (notification.type === 'reaction:grouped') userIds.push(...notification.reactions.map(x => x.userId));
			if (notification.type === 'renote:grouped') userIds.push(...notification.userIds);
			if (notification.type === 'note:grouped') userIds.push(...notification.notifierIds);
			// 旗鯖fork: reaction:groupedByUser の notifierId は 'notifierId' in notification で既に含まれる (型上)
		}
		const users = userIds.length > 0 ? await this.usersRepository.find({
			where: { id: In(userIds) },
		}) : [];
		const packedUsersArray = await this.userEntityService.packMany(users, { id: meId });
		const packedUsers = new Map(packedUsersArray.map(p => [p.id, p]));

		// 既に解決されたフォローリクエストの通知を除外
		const followRequestNotifications = validNotifications.filter((x): x is FilterUnionByProperty<T, 'type', 'receiveFollowRequest'> => x.type === 'receiveFollowRequest');
		if (followRequestNotifications.length > 0) {
			const reqs = await this.followRequestsRepository.find({
				where: { followerId: In(followRequestNotifications.map(x => x.notifierId)) },
			});
			validNotifications = validNotifications.filter(x => (x.type !== 'receiveFollowRequest') || reqs.some(r => r.followerId === x.notifierId));
		}

		// 承認・拒否済みのプライベートチャンネル招待通知を除外する。
		const channelInvitationIds = validNotifications.flatMap(notification => notification.type === 'addedToPrivateChannel' && notification.channelInvitationId != null
			? [notification.channelInvitationId]
			: []);
		if (channelInvitationIds.length > 0) {
			const pendingInvitations = await this.channelInvitationsRepository.find({
				where: { id: In(channelInvitationIds), userId: meId, status: 'pending' },
			});
			const pendingIds = new Set(pendingInvitations.map(invitation => invitation.id));
			validNotifications = validNotifications.filter(notification => notification.type !== 'addedToPrivateChannel'
				|| notification.channelInvitationId == null
				|| pendingIds.has(notification.channelInvitationId));
		}

		const packPromises = validNotifications.map(x => {
			return this.pack(
				x,
				meId,
				{ checkValidNotifier: false, checkValidChannelInvitation: false },
				{ packedNotes, packedUsers },
			);
		});

		return (await Promise.all(packPromises)).filter(x => x != null);
	}

	@bindThis
	public async pack(
		src: MiNotification | MiGroupedNotification,
		meId: MiUser['id'],

		options: {
			checkValidNotifier?: boolean;
			checkValidChannelInvitation?: boolean;
		},
		hint?: {
			packedNotes: Map<MiNote['id'], Packed<'Note'>>;
			packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
		},
	): Promise<Packed<'Notification'> | null> {
		return await this.#packInternal(src, meId, options, hint);
	}

	@bindThis
	public async packMany(
		notifications: MiNotification[],
		meId: MiUser['id'],
	): Promise<MiNotification[]> {
		return await this.#packManyInternal(notifications, meId);
	}

	@bindThis
	public async packGroupedMany(
		notifications: MiGroupedNotification[],
		meId: MiUser['id'],
	): Promise<MiGroupedNotification[]> {
		return await this.#packManyInternal(notifications, meId);
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを確認するvalidator
	 */
	#validateNotifier <T extends MiNotification | MiGroupedNotification> (
		notification: T,
		userIdsWhoMeMuting: Set<MiUser['id']>,
		userMutedInstances: Set<string>,
		notifiers: MiUser[],
	): boolean {
		if (!('notifierId' in notification)) return true;
		// 旗鯖fork: addedToPrivateChannel/removedFromPrivateChannel は notifierId が
		// null になり得る(MiNotification側の型)。null はそのまま渡しても
		// Set.has/Array.find は安全に false/undefined を返す(挙動は変えない)ので、
		// 型だけ MiUser['id'] とみなす。
		const notifierId = notification.notifierId as MiUser['id'];
		if (userIdsWhoMeMuting.has(notifierId)) return false;

		const notifier = notifiers.find(x => x.id === notifierId) ?? null;

		if (notifier == null) return false;
		if (notifier.host && userMutedInstances.has(notifier.host)) return false;

		if (notifier.isSuspended) return false;

		return true;
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを実際に確認する
	 */
	async #isValidNotifier(
		notification: MiNotification | MiGroupedNotification,
		meId: MiUser['id'],
	): Promise<boolean> {
		return (await this.#filterValidNotifier([notification], meId)).length === 1;
	}

	/**
	 * notifierが存在するか、ミュートされていないか、サスペンドされていないかを実際に複数確認する
	 */
	async #filterValidNotifier <T extends MiNotification | MiGroupedNotification> (
		notifications: T[],
		meId: MiUser['id'],
	): Promise<T[]> {
		const [
			userIdsWhoMeMuting,
			userMutedInstances,
		] = await Promise.all([
			this.cacheService.userMutingsCache.fetch(meId),
			this.cacheService.userProfileCache.fetch(meId).then(p => new Set(p.mutedInstances)),
		]);

		const notifierIds = notifications.map(notification => 'notifierId' in notification ? notification.notifierId : null).filter(x => x != null);
		const notifiers = notifierIds.length > 0 ? await this.usersRepository.find({
			where: { id: In(notifierIds) },
		}) : [];

		const filteredNotifications = ((await Promise.all(notifications.map(async (notification) => {
			const isValid = this.#validateNotifier(notification, userIdsWhoMeMuting, userMutedInstances, notifiers);
			return isValid ? notification : null;
		}))) as [T | null] ).filter(x => x != null);

		return filteredNotifications;
	}
}
