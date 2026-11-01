/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundError, In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { DI } from '@/di-symbols.js';
import type { Packed } from '@/misc/json-schema.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser } from '@/models/User.js';
import type { MiUtageSession } from '@/models/UtageSession.js';
import { utageSnapshot, type UtageParticipation } from '@/misc/utage-revival.js';
import type { MiNote } from '@/models/Note.js';
import type { MiChannel } from '@/models/Channel.js';
import type { UsersRepository, NotesRepository, FollowingsRepository, PollsRepository, PollVotesRepository, NoteReactionsRepository, ChannelsRepository, ChannelMembersRepository, InstancesRepository, MiMeta, EventsRepository, UtageSessionsRepository } from '@/models/_.js';
import { shouldHideNoteByTime } from '@/misc/should-hide-note-by-time.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import { bindThis } from '@/decorators.js';
import { DebounceLoader } from '@/misc/loader.js';
import { IdService } from '@/core/IdService.js';
import { ReactionsBufferingService } from '@/core/ReactionsBufferingService.js';
import { RoleService } from '@/core/RoleService.js';
import { MemoryKVCache } from '@/misc/cache.js';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { ReactionService } from '../ReactionService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';

export type NoteVisibilityInput = Pick<MiNote,
	'id' | 'userId' | 'userHost' | 'channelId' | 'visibility' | 'visibleUserIds' | 'mentions' | 'replyUserId'
> & Partial<Pick<MiNote, 'user' | 'channel' | 'replyId' | 'renoteId' | 'reply' | 'renote'>>;

export type ChannelVisibilityNote = {
	id: MiNote['id'];
	userId: MiUser['id'];
	channelId?: MiChannel['id'] | null;
	replyId?: MiNote['id'] | null;
	renoteId?: MiNote['id'] | null;
	reply?: ChannelVisibilityNote | null;
	renote?: ChannelVisibilityNote | null;
};

/**
 * How long a fetched ancestor is reused. The data never changes, so the cache can only err by
 * remembering a deleted ancestor: that hides its parent a little longer, never reveals anything.
 * Long enough to absorb a burst of reaction events, short enough for a deletion to take effect.
 */
export const CHANNEL_VISIBILITY_NODE_TTL_MS = 1000 * 60 * 5;

/** The immutable part of a note that channel visibility depends on. */
type ChannelVisibilityNode = {
	id: MiNote['id'];
	userId: MiUser['id'];
	channelId: MiChannel['id'] | null;
	replyId: MiNote['id'] | null;
	renoteId: MiNote['id'] | null;
};

type ChannelVisibilityContext = {
	iAmModerator?: boolean;
	iAmAdministrator?: boolean;
	channels?: Map<MiChannel['id'], MiChannel>;
};

// is-renote.tsとよしなにリンク
function isPureRenote(note: MiNote): note is MiNote & { renoteId: MiNote['id']; renote: MiNote } {
	return (
		note.renote != null &&
		note.reply == null &&
		note.text == null &&
		note.cw == null &&
		(note.fileIds == null || note.fileIds.length === 0) &&
		!note.hasPoll
	);
}

function getAppearNoteIds(notes: MiNote[]): Set<string> {
	const appearNoteIds = new Set<string>();
	for (const note of notes) {
		if (isPureRenote(note)) {
			appearNoteIds.add(note.renoteId);
		} else {
			appearNoteIds.add(note.id);
		}
	}
	return appearNoteIds;
}

async function nullIfEntityNotFound<T>(promise: Promise<T>): Promise<T | null> {
	try {
		return await promise;
	} catch (err) {
		if (err instanceof EntityNotFoundError) {
			return null;
		}
		throw err;
	}
}

@Injectable()
export class NoteEntityService implements OnModuleInit, OnApplicationShutdown {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private customEmojiService: CustomEmojiService;
	private reactionService: ReactionService;
	private reactionsBufferingService: ReactionsBufferingService;
	private idService: IdService;
	private noteLoader = new DebounceLoader(this.findNoteOrFail);
	private roleService: RoleService;
	private channelVisibilityNodes?: MemoryKVCache<ChannelVisibilityNode>;

	// Created on first use so partially constructed instances (and each test) get their own cache.
	private get channelVisibilityNodeCache(): MemoryKVCache<ChannelVisibilityNode> {
		return this.channelVisibilityNodes ??= new MemoryKVCache<ChannelVisibilityNode>(CHANNEL_VISIBILITY_NODE_TTL_MS, 20_000);
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.channelVisibilityNodes?.dispose();
	}

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.eventsRepository)
		private eventsRepository: EventsRepository,

		@Inject(DI.utageSessionsRepository)
		private utageSessionsRepository: UtageSessionsRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelMembersRepository)
		private channelMembersRepository: ChannelMembersRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		//private userEntityService: UserEntityService,
		//private driveFileEntityService: DriveFileEntityService,
		//private customEmojiService: CustomEmojiService,
		//private reactionService: ReactionService,
		//private reactionsBufferingService: ReactionsBufferingService,
		//private idService: IdService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.reactionService = this.moduleRef.get('ReactionService');
		this.reactionsBufferingService = this.moduleRef.get('ReactionsBufferingService');
		this.idService = this.moduleRef.get('IdService');
		this.roleService = this.moduleRef.get('RoleService');
	}

	/** プライベート投稿・その投稿を参照する親を、通常の visibility と分けて除外する。 */
	@bindThis
	public async filterChannelVisibleNotes<T extends ChannelVisibilityNote>(notes: T[], meId: MiUser['id'] | null): Promise<T[]> {
		return this.filterChannelVisibleNotesWithContext(notes, meId, {});
	}

	private async filterChannelVisibleNotesWithContext<T extends ChannelVisibilityNote>(notes: T[], meId: MiUser['id'] | null, context: ChannelVisibilityContext): Promise<T[]> {
		if (notes.length === 0) return [];

		const nodes = new Map<string, ChannelVisibilityNote>();
		const parents = new Map<string, Set<string>>();
		const visitedObjects = new Set<ChannelVisibilityNote>();
		const fetchedIds = new Set<string>();
		const pending: ChannelVisibilityNote[] = [...notes];
		for (;;) {
			while (pending.length > 0) {
				const note = pending.pop();
				if (note == null || visitedObjects.has(note)) continue;
				visitedObjects.add(note);
				const previous = nodes.get(note.id);
				const merged = { ...previous, ...note };
				// undefined は未取得。先に得ていた ID/子を失わないようにする。
				if (previous) {
					for (const key of ['channelId', 'replyId', 'renoteId', 'reply', 'renote'] as const) {
						if (note[key] === undefined && previous[key] !== undefined) Object.assign(merged, { [key]: previous[key] });
					}
				}
				nodes.set(note.id, merged);
				for (const [id, child] of [[merged.replyId, merged.reply], [merged.renoteId, merged.renote]] as const) {
					for (const childId of new Set([id, child?.id])) {
						if (childId == null) continue;
						const parentIds = parents.get(childId) ?? new Set<string>();
						parentIds.add(note.id);
						parents.set(childId, parentIds);
					}
					if (child != null) pending.push(child);
				}
			}

			const missingIds = new Set([...parents.keys()].filter(id => !nodes.has(id) && !fetchedIds.has(id)));
			// 更新イベント等の部分 snapshot も、存命なら参照列を補完する。
			for (const note of nodes.values()) {
				if (!fetchedIds.has(note.id) && (note.channelId === undefined || note.replyId === undefined || note.renoteId === undefined)) missingIds.add(note.id);
			}
			if (missingIds.size === 0) break;
			for (const id of missingIds) fetchedIds.add(id);
			// 投稿者・チャンネル・返信/引用先は作成後に変わらない。DB で得た節は共有して再利用する。
			const uncachedIds: string[] = [];
			for (const id of missingIds) {
				const cached = this.channelVisibilityNodeCache.get(id);
				if (cached) pending.push({ ...cached });
				else uncachedIds.push(id);
			}
			if (uncachedIds.length > 0) {
				const fetched = await this.notesRepository.find({
					where: { id: In(uncachedIds) },
					select: { id: true, userId: true, channelId: true, replyId: true, renoteId: true },
				});
				for (const node of fetched) {
					this.channelVisibilityNodeCache.set(node.id, { id: node.id, userId: node.userId, channelId: node.channelId, replyId: node.replyId, renoteId: node.renoteId });
				}
				pending.push(...fetched);
			}
			// DB に無い子は削除済み。削除イベントの root は受信 snapshot を残す。
		}

		const channelIds = [...new Set([...nodes.values()].flatMap(note => note.channelId == null ? [] : [note.channelId]))];
		if (channelIds.length === 0) return notes;
		// JOIN や共有 broadcast 内の channel は古いことがあるため、常に現在の DB を参照する。
		const channels = await this.channelsRepository.findBy({ id: In(channelIds) });
		context.channels = new Map(channels.map(channel => [channel.id, channel]));
		const privateChannels = new Map(channels.filter(channel => channel.isPrivate).map(channel => [channel.id, channel]));
		if (privateChannels.size === 0) return notes;
		const isStaff = meId != null && ((context.iAmModerator ??= await this.roleService.isModerator({ id: meId })) || (context.iAmAdministrator ??= await this.roleService.isAdministrator({ id: meId })));
		if (isStaff) return notes;
		const membershipIds = meId == null ? [] : [...privateChannels.values()]
			.filter(channel => channel.userId !== meId && !channel.moderatorUserIds.includes(meId))
			.map(channel => channel.id);
		const memberships = meId == null || membershipIds.length === 0 ? [] : await this.channelMembersRepository.findBy({ channelId: In(membershipIds), userId: meId });
		const memberChannels = new Set(memberships.map(member => member.channelId));
		const blocked = new Set<string>();
		for (const note of nodes.values()) {
			const channel = note.channelId == null ? null : privateChannels.get(note.channelId);
			if (channel == null) continue;
			if (meId != null && (note.userId === meId || channel.userId === meId || channel.moderatorUserIds.includes(meId) || memberChannels.has(channel.id))) continue;
			blocked.add(note.id);
		}
		// 逆向きに伝播するので、循環参照・共有された子も一度ずつ処理できる。
		const blockedQueue = [...blocked];
		while (blockedQueue.length > 0) {
			const blockedId = blockedQueue.pop();
			if (blockedId == null) continue;
			for (const parentId of parents.get(blockedId) ?? []) {
				if (blocked.has(parentId)) continue;
				blocked.add(parentId);
				blockedQueue.push(parentId);
			}
		}
		return notes.filter(note => !blocked.has(note.id));
	}

	@bindThis
	public async isChannelVisibleForMe(note: ChannelVisibilityNote, meId: MiUser['id'] | null): Promise<boolean> {
		return (await this.filterChannelVisibleNotes([note], meId)).length > 0;
	}

	@bindThis
	private treatVisibility(packedNote: Packed<'Note'>, meIsAdmin = false): Packed<'Note'>['visibility'] {
		// 旗鯖fork: サーバー管理者はモデレーション上の理由で
		// 「過去のノートをフォロワーのみ」の自動可視性変換をbypass
		if (meIsAdmin) return packedNote.visibility;

		if (packedNote.visibility === 'public' || packedNote.visibility === 'home') {
			const followersOnlyBefore = packedNote.user.makeNotesFollowersOnlyBefore;
			if ((followersOnlyBefore != null)
				&& (
					(followersOnlyBefore <= 0 && (Date.now() - new Date(packedNote.createdAt).getTime() > 0 - (followersOnlyBefore * 1000)))
					|| (followersOnlyBefore > 0 && (new Date(packedNote.createdAt).getTime() < followersOnlyBefore * 1000))
				)
			) {
				packedNote.visibility = 'followers';
			}
		}
		return packedNote.visibility;
	}

	@bindThis
	public async shouldHideNote(
		packedNote: Packed<'Note'>,
		meId: MiUser['id'] | null,
		_hint_?: {
			channelMap?: Map<MiChannel['id'], MiChannel>;
			iAmModerator?: boolean;
			channelVisibilityChecked?: boolean;
		},
	): Promise<boolean> {
		if (!_hint_?.channelVisibilityChecked && !await this.isChannelVisibleForMe(packedNote, meId)) return true;
		if (packedNote.isHidden) return true;
		if (meId === packedNote.userId) return false;

		// 旗鯖fork: サーバー管理者はモデレーション上の理由で
		// 「過去のノートを非公開化」の自動非表示化をbypass (要signin保護はそのまま)
		if (meId != null && await this.roleService.isAdministrator({ id: meId })) {
			return false;
		}

		// TODO: isVisibleForMe を使うようにしても良さそう(型違うけど)
		const visibility = this.treatVisibility({ ...packedNote });
		let hide = meId == null && (this.meta.ugcVisibilityForVisitor === 'none'
			|| (this.meta.ugcVisibilityForVisitor === 'local' && packedNote.user.host != null));

		if (packedNote.user.requireSigninToViewContents && meId == null) {
			hide = true;
		}

		if (!hide) {
			const hiddenBefore = packedNote.user.makeNotesHiddenBefore;
			if ((hiddenBefore != null)
				&& (
					(hiddenBefore <= 0 && (Date.now() - new Date(packedNote.createdAt).getTime() > 0 - (hiddenBefore * 1000)))
					|| (hiddenBefore > 0 && (new Date(packedNote.createdAt).getTime() < hiddenBefore * 1000))
				)
			) {
				hide = true;
			}
		}

		// visibility が specified かつ自分が指定されていなかったら非表示
		if (!hide) {
			if (visibility === 'specified') {
				if (meId == null) {
					hide = true;
				} else {
					// 指定されているかどうか
					const specified = packedNote.visibleUserIds?.some(id => meId === id) ?? false;

					if (!specified) {
						hide = true;
					}
				}
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (!hide) {
			if (visibility === 'followers') {
				if (meId == null) {
					hide = true;
				} else if (packedNote.reply && (meId === packedNote.reply.userId)) {
					// 自分の投稿に対するリプライ
					hide = false;
				} else if (packedNote.mentions && packedNote.mentions.some(id => meId === id)) {
					// 自分へのメンション
					hide = false;
				} else {
					// フォロワーかどうか
					// TODO: 当関数呼び出しごとにクエリが走るのは重そうだからなんとかする
					const isFollowing = await this.followingsRepository.exists({
						where: {
							followeeId: packedNote.userId,
							followerId: meId,
						},
					});

					hide = !isFollowing;
				}
			}
		}

		return hide;
	}

	@bindThis
	public hideNote(packedNote: Packed<'Note'>): void {
		packedNote.visibleUserIds = undefined;
		packedNote.fileIds = [];
		packedNote.files = [];
		packedNote.text = null;
		packedNote.poll = undefined;
		packedNote.event = undefined;
		packedNote.tags = undefined;
		packedNote.cw = null;
		packedNote.isHidden = true;
		// TODO: hiddenReason みたいなのを提供しても良さそう
	}

	@bindThis
	private async populatePoll(note: MiNote, meId: MiUser['id'] | null) {
		const poll = await this.pollsRepository.findOneByOrFail({ noteId: note.id });
		const choices = poll.choices.map(c => ({
			text: c,
			votes: poll.votes[poll.choices.indexOf(c)],
			isVoted: false,
		}));

		if (meId) {
			if (poll.multiple) {
				const votes = await this.pollVotesRepository.findBy({
					userId: meId,
					noteId: note.id,
				});

				const myChoices = votes.map(v => v.choice);
				for (const myChoice of myChoices) {
					choices[myChoice].isVoted = true;
				}
			} else {
				const vote = await this.pollVotesRepository.findOneBy({
					userId: meId,
					noteId: note.id,
				});

				if (vote) {
					choices[vote.choice].isVoted = true;
				}
			}
		}

		return {
			multiple: poll.multiple,
			expiresAt: poll.expiresAt?.toISOString() ?? null,
			choices,
		};
	}

	@bindThis
	private async populateEvent(note: MiNote) {
		const event = await this.eventsRepository.findOneByOrFail({ noteId: note.id });
		return {
			title: event.title,
			start: event.start.toISOString(),
			end: event.end?.toISOString() ?? null,
			metadata: event.metadata,
		};
	}

	// 旗鯖fork: 宴(うたげ)の判定状態を返す。宴ワードを含むローカルノートのみ DB を引く
	// (全ノートで session を照会すると TL 表示が重くなるため、安価な正規表現で足切りする)。
	private static readonly UTAGE_REGEX = /宴|うたげ|ぅたげ|utage/i;

	// 旗鯖fork: 1ノートに対して宴の判定をすべきか? を判定する純粋関数(DBを引かない)。
	private isUtageCandidate(note: MiNote): boolean {
		if (note.userHost != null) return false; // ローカルノートのみ
		const t = `${note.text ?? ''} ${note.cw ?? ''}`;
		return NoteEntityService.UTAGE_REGEX.test(t);
	}

	@bindThis
	private async populateUtage(
		note: MiNote,
		meId: MiUser['id'] | null,
		_hint_?: { utageSessionMap?: Map<string, MiUtageSession>; utageViewer?: MiUser | null },
	) {
		if (!this.isUtageCandidate(note)) return {};
		const session = _hint_?.utageSessionMap !== undefined ? _hint_.utageSessionMap.get(note.id) : await this.utageSessionsRepository.findOneBy({ noteId: note.id });
		if (!session) return {};
		const snapshot = utageSnapshot(session);
		if (!meId || !session.revivalStartedAt) return snapshot;
		const viewer = _hint_?.utageViewer !== undefined ? _hint_.utageViewer : await this.usersRepository.findOneBy({ id: meId });
		const participation: UtageParticipation = meId === session.userId ? 'author'
			: session.revivalSupporterIds.includes(meId) ? 'accepted'
				: session.revivalExcludedUserIds.includes(meId) ? 'existing'
					: viewer && viewer.host == null && !viewer.isBot && !viewer.isSuspended && !viewer.isDeleted ? 'eligible' : 'ineligible';
		return { ...snapshot, utageMyParticipation: participation };
	}

	@bindThis
	public async populateMyReaction(note: { id: MiNote['id']; reactions: MiNote['reactions']; reactionAndUserPairCache?: MiNote['reactionAndUserPairCache']; }, meId: MiUser['id'], _hint_?: {
		myReactions: Map<MiNote['id'], string | null>;
	}) {
		if (_hint_?.myReactions.has(note.id)) {
			const reaction = _hint_.myReactions.get(note.id);
			if (reaction) {
				return this.reactionService.convertLegacyReaction(reaction);
			} else {
				return undefined;
			}
		}

		// 集計やユーザーペアのキャッシュは遅延・重複し得るため、本人の状態は正本を参照する。
		// hint にない遅延読込の返信先・引用先も、未リアクションとは扱わない。
		const reaction = await this.noteReactionsRepository.findOneBy({
			userId: meId,
			noteId: note.id,
		});

		if (reaction) {
			return this.reactionService.convertLegacyReaction(reaction.reaction);
		}

		return undefined;
	}

	@bindThis
	public async isVisibleForMe(note: NoteVisibilityInput, meId: MiUser['id'] | null): Promise<boolean> {
		if (!await this.isChannelVisibleForMe(note, meId)) return false;
		// This code must always be synchronized with the checks in generateVisibilityQuery.
		if (meId == null && (this.meta.ugcVisibilityForVisitor === 'none'
			|| (this.meta.ugcVisibilityForVisitor === 'local' && note.userHost != null))) return false;

		let visibility = note.visibility;
		// Partial responses and note-update events need the same time/sign-in checks as packing.
		if (meId !== note.userId && !(meId != null && await this.roleService.isAdministrator({ id: meId }))) {
			const author = note.user ?? await this.usersRepository.findOneBy({ id: note.userId });
			if (author == null || (meId == null && author.requireSigninToViewContents)) return false;
			const createdAt = this.idService.parse(note.id).date;
			if (shouldHideNoteByTime(author.makeNotesHiddenBefore, createdAt)) return false;
			if ((visibility === 'public' || visibility === 'home') && shouldHideNoteByTime(author.makeNotesFollowersOnlyBefore, createdAt)) visibility = 'followers';
		}

		// visibility が specified かつ自分が指定されていなかったら非表示
		if (visibility === 'specified') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return note.visibleUserIds.some(id => meId === id);
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (visibility === 'followers') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (note.replyUserId && (meId === note.replyUserId)) {
				// 自分の投稿に対するリプライ
				return true;
			} else if (note.mentions && note.mentions.some(id => meId === id)) {
				// 自分へのメンション
				return true;
			} else {
				// フォロワーかどうか
				const [following, user] = await Promise.all([
					this.followingsRepository.count({
						where: {
							followeeId: note.userId,
							followerId: meId,
						},
						take: 1,
					}),
					this.usersRepository.findOneByOrFail({ id: meId }),
				]);

				/* If we know the following, everyhting is fine.

				But if we do not know the following, it might be that both the
				author of the note and the author of the like are remote users,
				in which case we can never know the following. Instead we have
				to assume that the users are following each other.
				*/
				return following > 0 || (note.userHost != null && user.host != null);
			}
		}

		return true;
	}

	@bindThis
	public async packAttachedFiles(fileIds: MiNote['fileIds'], packedFiles: Map<MiNote['fileIds'][number], Packed<'DriveFile'> | null>): Promise<Packed<'DriveFile'>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(x => x != null);
	}

	@bindThis
	public async pack(
		src: MiNote['id'] | MiNote,
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
			withReactionAndUserPairCache?: boolean;
			// この pack 呼び出しの根で判定した全参照にだけ引き継ぐ。
			_channelVisibilityChecked?: boolean;
			_channelVisibilityContext?: ChannelVisibilityContext;
			_ancestorNoteIds?: Set<MiNote['id']>;
			_hint_?: {
				bufferedReactions: Map<MiNote['id'], { deltas: Record<string, number>; pairs: ([MiUser['id'], string])[] }> | null;
				myReactions: Map<MiNote['id'], string | null>;
				packedFiles: Map<MiNote['fileIds'][number], Packed<'DriveFile'> | null>;
				packedUsers: Map<MiUser['id'], Packed<'UserLite'>>;
				// 旗鯖fork: packMany で集約した宴セッション状態。エントリが無ければセッション未登録。
				utageSessionMap?: Map<string, MiUtageSession>;
				utageViewer?: MiUser | null;
				// 旗鯖fork: packMany で集約したチャンネル本体・閲覧時メンバーシップ・モデレーター判定。
				channelMap?: Map<MiChannel['id'], MiChannel>;
				iAmModerator?: boolean;
			};
		},
	): Promise<Packed<'Note'>> {
		const opts = Object.assign({
			detail: true,
			skipHide: false,
			withReactionAndUserPairCache: false,
		}, options);

		const meId = me ? me.id : null;
		const note = typeof src === 'object' ? src : await this.noteLoader.load(src);
		const visibilityContext = opts._channelVisibilityContext ?? {};
		if (!opts.skipHide && !opts._channelVisibilityChecked && (await this.filterChannelVisibleNotesWithContext([note], meId, visibilityContext)).length === 0) {
			throw new PrivateChannelNoteVisibilityError();
		}
		const ancestorNoteIds = new Set(opts._ancestorNoteIds);
		ancestorNoteIds.add(note.id);
		const host = note.userHost;
		// 旗鯖fork: packMany 経由のときは isModerator を 1 回だけ呼んで使い回す。
		const iAmModerator = visibilityContext.iAmModerator ?? opts._hint_?.iAmModerator ?? (me ? await this.roleService.isModerator(me as MiUser) : false);
		visibilityContext.iAmModerator = iAmModerator;

		const bufferedReactions = opts._hint_?.bufferedReactions != null
			? (opts._hint_.bufferedReactions.get(note.id) ?? { deltas: {}, pairs: [] })
			: this.meta.enableReactionsBuffering
				? await this.reactionsBufferingService.get(note.id)
				: { deltas: {}, pairs: [] };
		const reactions = this.reactionService.convertLegacyReactions(this.reactionsBufferingService.mergeReactions(note.reactions, bufferedReactions.deltas ?? {}));

		const reactionAndUserPairCache = note.reactionAndUserPairCache.concat(bufferedReactions.pairs.map(x => x.join('/')));

		let text = note.text;

		if (note.name && (note.url ?? note.uri) && !note.hasEvent) {
			text = `【${note.name}】\n${(note.text ?? '').trim()}\n\n${note.url ?? note.uri}`;
		}

		// 旗鯖fork: packMany 経由のときは channelMap で 1 回の SELECT に集約する。
		const channel = note.channelId
			? visibilityContext.channels?.get(note.channelId) ?? opts._hint_?.channelMap?.get(note.channelId) ?? note.channel ?? await this.channelsRepository.findOneBy({ id: note.channelId })
			: null;

		const reactionEmojiNames = Object.keys(reactions)
			.filter(x => x.startsWith(':') && x.includes('@') && !x.includes('@.')) // リモートカスタム絵文字のみ
			.map(x => this.reactionService.decodeReaction(x).reaction.replaceAll(':', ''));
		await this.customEmojiService.prefetchEmojis(this.aggregateNoteEmojis([note]));
		const packedFiles = options?._hint_?.packedFiles;
		const packedUsers = options?._hint_?.packedUsers;

		const packed: Packed<'Note'> = await awaitAll({
			id: note.id,
			createdAt: this.idService.parse(note.id).date.toISOString(),
			updatedAt: note.updatedAt ? note.updatedAt.toISOString() : undefined,
			updatedAtHistory: note.updatedAtHistory ? note.updatedAtHistory.map(x => x.toISOString()) : undefined,
			deleteAt: note.deleteAt ? note.deleteAt.toISOString() : undefined,
			userId: note.userId,
			user: packedUsers?.get(note.userId) ?? this.userEntityService.pack(note.user ?? note.userId, me),
			text: text,
			cw: note.cw,
			visibility: note.visibility,
			localOnly: note.localOnly,
			reactionAcceptance: note.reactionAcceptance,
			visibleUserIds: note.visibility === 'specified' ? note.visibleUserIds : undefined,
			disableRightClick: note.disableRightClick || undefined,
			renoteCount: note.renoteCount,
			repliesCount: note.repliesCount,
			reactionCount: Object.values(reactions).reduce((a, b) => a + b, 0),
			reactions: reactions,
			reactionEmojis: this.customEmojiService.populateEmojis(reactionEmojiNames, host),
			reactionAndUserPairCache: opts.withReactionAndUserPairCache ? reactionAndUserPairCache : undefined,
			emojis: host != null ? this.customEmojiService.populateEmojis(note.emojis, host) : undefined,
			tags: note.tags.length > 0 ? note.tags : undefined,
			fileIds: note.fileIds,
			files: packedFiles != null ? this.packAttachedFiles(note.fileIds, packedFiles) : this.driveFileEntityService.packManyByIds(note.fileIds),
			replyId: note.replyId,
			renoteId: note.renoteId,
			channelId: note.channelId ?? undefined,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
				color: channel.color,
				isSensitive: channel.isSensitive,
				allowRenoteToExternal: channel.allowRenoteToExternal,
				// 旗鯖fork: プライベートチャンネルはチャンネル外リノート不可。フロントでメニューを抑制するため公開。
				isPrivate: channel.isPrivate,
				userId: channel.userId,
			} : undefined,
			mentions: note.mentions.length > 0 ? note.mentions : undefined,
			hasPoll: note.hasPoll || undefined,
			// 旗鯖fork: 宴(うたげ)の判定状態。宴ノートでなければ undefined。
			// 公開状態と、認証済み閲覧者だけの参加状態を初期表示に渡す。
			...await this.populateUtage(note, meId, opts._hint_),
			uri: note.uri ?? undefined,
			url: note.url ?? undefined,
			hasDeliveryTargets: note.deliveryTargets != null,
			...((meId === note.userId || iAmModerator) ? {
				deliveryTargets: note.deliveryTargets ? await (async () => {
					const deliveryTargets = note.deliveryTargets!;
					const instances = await this.instancesRepository.findBy({
						host: In(deliveryTargets.hosts),
					});
					const instanceMap = new Map(instances.map(i => [i.host, i.name]));

					return {
						mode: deliveryTargets.mode,
						hosts: deliveryTargets.hosts,
						names: deliveryTargets.hosts.map(host => instanceMap.get(host) ?? null),
					};
				})() : undefined,
			} : {}),

			...(opts.detail ? {
				clippedCount: note.clippedCount,

				// そもそもJOINしていない場合はundefined、JOINしたけど存在していなかった場合はnullで区別される
				reply: (note.replyId && (note.reply === null || ancestorNoteIds.has(note.replyId))) ? null : note.replyId ? nullIfEntityNotFound(this.pack(note.reply ?? note.replyId, me, {
					// NOTE: 기본값은 false 이지만, 2025.10.0 대응 과정에서 코드가 변경됨에 따라 MkSubNoteContent에서 myReaction을 불러오지 못하는 문제가 있으므로 true로 변경됨.
					// myReaction을 불러오지 못하면 자신이 리액션 했다는 정보를 불러오지 못하므로 이미 리액션을 했더라도 다시 눌러 리액션을 취소하는 기능을 사용할 수 없고, 리액션을 중복으로 등록하려고 시도하게됨.
					detail: true,
					skipHide: opts.skipHide,
					withReactionAndUserPairCache: opts.withReactionAndUserPairCache,
					_channelVisibilityChecked: true,
					_channelVisibilityContext: visibilityContext,
					_ancestorNoteIds: ancestorNoteIds,
					_hint_: options?._hint_,
				})) : undefined,

				// そもそもJOINしていない場合はundefined、JOINしたけど存在していなかった場合はnullで区別される
				renote: (note.renoteId && (note.renote === null || ancestorNoteIds.has(note.renoteId))) ? null : note.renoteId ? nullIfEntityNotFound(this.pack(note.renote ?? note.renoteId, me, {
					detail: true,
					skipHide: opts.skipHide,
					withReactionAndUserPairCache: opts.withReactionAndUserPairCache,
					_channelVisibilityChecked: true,
					_channelVisibilityContext: visibilityContext,
					_ancestorNoteIds: ancestorNoteIds,
					_hint_: options?._hint_,
				})) : undefined,

				poll: note.hasPoll ? this.populatePoll(note, meId) : undefined,
				event: note.hasEvent ? this.populateEvent(note) : undefined,

				...(meId ? {
					myReaction: this.populateMyReaction({
						id: note.id,
						reactions: reactions,
						reactionAndUserPairCache: reactionAndUserPairCache,
					}, meId, options?._hint_),
				} : {}),
			} : {}),
		});

		// 旗鯖fork: 管理者はノート可視性の自動変換をbypass (モデレーション目的)
		const meIsAdmin = visibilityContext.iAmAdministrator ?? (meId != null ? await this.roleService.isAdministrator({ id: meId }) : false);
		visibilityContext.iAmAdministrator = meIsAdmin;
		this.treatVisibility(packed, meIsAdmin);

		if (!opts.skipHide) {
			if (await this.shouldHideNote(packed, meId, { ...opts._hint_, channelVisibilityChecked: true })) this.hideNote(packed);
		}

		return packed;
	}

	@bindThis
	public async packMany(
		sourceNotes: MiNote[],
		me?: { id: MiUser['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
		},
	) {
		if (sourceNotes.length === 0) return [];
		const visibilityContext: ChannelVisibilityContext = {};
		const notes = options?.skipHide ? sourceNotes : await this.filterChannelVisibleNotesWithContext(sourceNotes, me?.id ?? null, visibilityContext);
		if (notes.length === 0) return [];

		const bufferedReactions = this.meta.enableReactionsBuffering ? await this.reactionsBufferingService.getMany([...getAppearNoteIds(notes)]) : null;

		const meId = me ? me.id : null;
		const myReactionsMap = new Map<MiNote['id'], string | null>();
		if (meId && options?.detail !== false) {
			// 再帰 pack へ渡す本人の状態を一括取得する。集計・ペアキャッシュは判定に使わない。
			const pending = [...notes];
			const visited = new Set<MiNote>();
			while (pending.length > 0) {
				const note = pending.pop();
				if (note == null || visited.has(note)) continue;
				visited.add(note);
				myReactionsMap.set(note.id, null);
				// 未 JOIN の子も既知の ID で先に取得し、それより深い未知の子は単体取得へ委ねる。
				if (note.replyId) myReactionsMap.set(note.replyId, null);
				if (note.renoteId) myReactionsMap.set(note.renoteId, null);
				if (note.reply) pending.push(note.reply);
				if (note.renote) pending.push(note.renote);
			}

			const myReactions = await this.noteReactionsRepository.find({
				where: {
					userId: meId,
					noteId: In([...myReactionsMap.keys()]),
				},
				select: { noteId: true, reaction: true },
			});
			for (const reaction of myReactions) {
				myReactionsMap.set(reaction.noteId, reaction.reaction);
			}
		}

		await this.customEmojiService.prefetchEmojis(this.aggregateNoteEmojis(notes));
		// TODO: 本当は renote とか reply がないのに renoteId とか replyId があったらここで解決しておく
		const fileIds = notes.map(n => [n.fileIds, n.renote?.fileIds, n.reply?.fileIds]).flat(2).filter(x => x != null);
		const packedFiles = fileIds.length > 0 ? await this.driveFileEntityService.packManyByIdsMap(fileIds) : new Map();
		const users = [
			...notes.map(({ user, userId }) => user ?? userId),
			...notes.map(({ replyUserId }) => replyUserId).filter(x => x != null),
			...notes.map(({ renoteUserId }) => renoteUserId).filter(x => x != null),
		];
		const packedUsers = await this.userEntityService.packMany(users, me)
			.then(users => new Map(users.map(u => [u.id, u])));

		// 旗鯖fork: 宴(うたげ)セッションを一括取得して N+1 を解消する。
		//   - ローカル かつ 宴ワードを含むノートだけ DB を引く(個別 pack と同じ足切り)。
		//   - 再帰 pack で参照される reply/renote も hint で吸収するため候補に含める。
		const utageCandidateIds: MiNote['id'][] = [];
		for (const n of notes) {
			if (this.isUtageCandidate(n)) utageCandidateIds.push(n.id);
			if (n.reply && this.isUtageCandidate(n.reply)) utageCandidateIds.push(n.reply.id);
			if (n.renote && this.isUtageCandidate(n.renote)) utageCandidateIds.push(n.renote.id);
		}
		const utageSessionMap = new Map<string, MiUtageSession>();
		const utageViewer = meId && utageCandidateIds.length ? await this.usersRepository.findOneBy({ id: meId }) : null;
		if (utageCandidateIds.length > 0) {
			const sessions = await this.utageSessionsRepository.findBy({ noteId: In(utageCandidateIds) });
			for (const s of sessions) {
				utageSessionMap.set(s.noteId, s);
			}
		}

		// 旗鯖fork: 表示用チャンネル情報も一括取得する。閲覧判定時の最新情報を優先する。
		//   - JOIN 済み(note.channel が non-null)のものは不足分だけ hint に含める。
		//   - 再帰 pack で参照される reply/renote の channelId も対象にする。
		const channelMap = visibilityContext.channels ?? new Map<MiChannel['id'], MiChannel>();
		const collectChannel = (n: MiNote) => {
			if (n.channelId != null && n.channel != null && !channelMap.has(n.channelId)) channelMap.set(n.channelId, n.channel);
		};
		const channelIdsNeeded = new Set<MiChannel['id']>();
		const collectChannelId = (n: MiNote) => {
			if (n.channelId != null && n.channel == null && !channelMap.has(n.channelId)) {
				channelIdsNeeded.add(n.channelId);
			}
		};
		for (const n of notes) {
			collectChannel(n);
			if (n.reply) collectChannel(n.reply);
			if (n.renote) collectChannel(n.renote);
		}
		for (const n of notes) {
			collectChannelId(n);
			if (n.reply) collectChannelId(n.reply);
			if (n.renote) collectChannelId(n.renote);
		}
		if (channelIdsNeeded.size > 0) {
			const channels = await this.channelsRepository.findBy({ id: In([...channelIdsNeeded]) });
			for (const c of channels) channelMap.set(c.id, c);
		}

		// roleService.isModerator は packMany 全体で 1 回だけ呼ぶ。
		const iAmModerator = visibilityContext.iAmModerator ?? (me ? await this.roleService.isModerator(me as MiUser) : false);
		visibilityContext.iAmModerator = iAmModerator;

		const packedNotes = await Promise.all(notes.map(async n => {
			try {
				return await this.pack(n, me, {
					...options,
					_channelVisibilityChecked: true,
					_channelVisibilityContext: visibilityContext,
					_hint_: {
						bufferedReactions,
						myReactions: myReactionsMap,
						packedFiles,
						packedUsers,
						utageSessionMap,
						utageViewer,
						channelMap,
						iAmModerator,
					},
				});
			} catch (err) {
				if (err instanceof PrivateChannelNoteVisibilityError) return null;
				throw err;
			}
		}));
		return packedNotes.filter((note): note is Packed<'Note'> => note != null);
	}

	@bindThis
	public aggregateNoteEmojis(notes: MiNote[]) {
		let emojis: { name: string | null; host: string | null; }[] = [];
		for (const note of notes) {
			emojis = emojis.concat(note.emojis
				.map(e => this.customEmojiService.parseEmojiStr(e, note.userHost)));
			if (note.renote) {
				emojis = emojis.concat(note.renote.emojis
					.map(e => this.customEmojiService.parseEmojiStr(e, note.renote!.userHost)));
				if (note.renote.user) {
					emojis = emojis.concat(note.renote.user.emojis
						.map(e => this.customEmojiService.parseEmojiStr(e, note.renote!.userHost)));
				}
			}
			const customReactions = Object.keys(note.reactions).map(x => this.reactionService.decodeReaction(x)).filter(x => x.name != null) as typeof emojis;
			emojis = emojis.concat(customReactions);
			if (note.user) {
				emojis = emojis.concat(note.user.emojis
					.map(e => this.customEmojiService.parseEmojiStr(e, note.userHost)));
			}
		}
		return emojis.filter(x => x.name != null && x.host != null) as { name: string; host: string; }[];
	}

	@bindThis
	private findNoteOrFail(id: string): Promise<MiNote> {
		return this.notesRepository.findOneOrFail({
			where: { id },
			relations: { user: true, renote: true, reply: true },
		});
	}

	@bindThis
	public async fetchDiffs(noteIds: MiNote['id'][], meId: MiUser['id'] | null = null) {
		if (noteIds.length === 0) return [];
		if (meId == null && this.meta.ugcVisibilityForVisitor === 'none') return [];

		const fetched = await this.notesRepository.find({
			where: {
				id: In(noteIds),
			},
			select: {
				id: true,
				userId: true,
				channelId: true,
				userHost: true,
				visibility: true,
				visibleUserIds: true,
				mentions: true,
				replyUserId: true,
				reactions: true,
				reactionAndUserPairCache: true,
			},
		});

		const notes: MiNote[] = [];
		for (const note of fetched) {
			if (await this.isVisibleForMe(note, meId)) {
				notes.push(note);
			}
		}

		const bufferedReactionsMap = this.meta.enableReactionsBuffering ? await this.reactionsBufferingService.getMany(noteIds) : null;

		const packings = notes.map(note => {
			const bufferedReactions = bufferedReactionsMap?.get(note.id);
			//const reactionAndUserPairCache = note.reactionAndUserPairCache.concat(bufferedReactions.pairs.map(x => x.join('/')));

			const reactions = this.reactionService.convertLegacyReactions(this.reactionsBufferingService.mergeReactions(note.reactions, bufferedReactions?.deltas ?? {}));

			const reactionEmojiNames = Object.keys(reactions)
				.filter(x => x.startsWith(':') && x.includes('@') && !x.includes('@.')) // リモートカスタム絵文字のみ
				.map(x => this.reactionService.decodeReaction(x).reaction.replaceAll(':', ''));

			return this.customEmojiService.populateEmojis(reactionEmojiNames, note.userHost).then(reactionEmojis => ({
				id: note.id,
				reactions,
				reactionEmojis,
			}));
		});

		return await Promise.all(packings);
	}
}
