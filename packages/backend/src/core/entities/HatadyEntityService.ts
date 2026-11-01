/*
 * 旗鯖fork: Hatady の各エンティティ(本 / 学習ログ)を API レスポンス用に pack する。
 *   N+1 を避けるため packLogs は関連ユーザー・本をまとめて取得して埋める。
 *   表紙は保持せずタイトルから自動生成するため、pack では title/coverColorIndex を返すのみ。
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { normalizeHatadyDuration, packHatadyDetails } from '@/core/HatadyRecordData.js';
import { DI } from '@/di-symbols.js';
import type { HatadyBooksRepository, HatadyLogsRepository, HatadyReactionsRepository, HatadyCommentsRepository, HatadyFollowingsRepository, HatadyBookmarksRepository, HatadyMediaWorksRepository, HatadyMediaCommentsRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiHatadyBook } from '@/models/HatadyBook.js';
import type { MiHatadyLog } from '@/models/HatadyLog.js';
import type { MiHatadyComment } from '@/models/HatadyComment.js';
import type { MiHatadyNotification } from '@/models/HatadyNotification.js';
import type { MiHatadyBookmark } from '@/models/HatadyBookmark.js';
import type { MiHatadyBookMemo } from '@/models/HatadyBookMemo.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { HatadyAttachmentService } from '@/core/HatadyAttachmentService.js';
import { HatadyService } from '@/core/HatadyService.js';
import { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';

@Injectable()
export class HatadyEntityService {
	constructor(
		@Inject(DI.hatadyBooksRepository)
		private hatadyBooksRepository: HatadyBooksRepository,
		@Inject(DI.hatadyLogsRepository)
		private hatadyLogsRepository: HatadyLogsRepository,
		@Inject(DI.hatadyReactionsRepository)
		private hatadyReactionsRepository: HatadyReactionsRepository,
		@Inject(DI.hatadyCommentsRepository)
		private hatadyCommentsRepository: HatadyCommentsRepository,
		@Inject(DI.hatadyFollowingsRepository)
		private hatadyFollowingsRepository: HatadyFollowingsRepository,
		@Inject(DI.hatadyBookmarksRepository)
		private hatadyBookmarksRepository: HatadyBookmarksRepository,
		@Inject(DI.hatadyMediaWorksRepository)
		private hatadyMediaWorksRepository: HatadyMediaWorksRepository,
		@Inject(DI.hatadyMediaCommentsRepository)
		private hatadyMediaCommentsRepository: HatadyMediaCommentsRepository,

		private userEntityService: UserEntityService,
		private hatadyAttachmentService: HatadyAttachmentService,
		@Inject(HatadyService) private hatadyService?: HatadyService,
	) {
	}

	@bindThis
	public packBookmark(bm: MiHatadyBookmark): Record<string, unknown> {
		return {
			id: bm.id,
			bookId: bm.bookId,
			page: bm.page,
			name: bm.name,
			color: bm.color,
			memo: bm.memo,
			createdAt: bm.createdAt.toISOString(),
		};
	}

	@bindThis
	public packMemo(memo: MiHatadyBookMemo): Record<string, unknown> {
		return {
			id: memo.id,
			bookId: memo.bookId,
			text: memo.text,
			page: memo.page,
			createdAt: memo.createdAt.toISOString(),
			updatedAt: memo.updatedAt.toISOString(),
		};
	}

	// 対象(ログ/コメント)群のリアクションを1クエリで集計し、対象ID → { reactions: {絵文字:数}, myReaction } を返す。
	@bindThis
	private async aggregateReactions(
		kind: 'log' | 'comment',
		targetIds: string[],
		meId?: MiUser['id'] | null,
	): Promise<Map<string, { reactions: Record<string, number>; myReaction: string | null }>> {
		const out = new Map<string, { reactions: Record<string, number>; myReaction: string | null }>();
		for (const id of targetIds) out.set(id, { reactions: {}, myReaction: null });
		if (targetIds.length === 0) return out;

		const col = kind === 'log' ? 'logId' : 'commentId';
		const rows = await this.hatadyReactionsRepository.createQueryBuilder('r')
			.where(`r.${col} IN (:...ids)`, { ids: targetIds })
			.getMany();

		for (const r of rows) {
			const key = (kind === 'log' ? r.logId : r.commentId) as string;
			const entry = out.get(key);
			if (!entry) continue;
			entry.reactions[r.reaction] = (entry.reactions[r.reaction] ?? 0) + 1;
			if (meId && r.userId === meId) entry.myReaction = r.reaction;
		}
		return out;
	}

	@bindThis
	public packBook(book: MiHatadyBook, privateAccess = false): Record<string, unknown> {
		return {
			visibility: book.visibility ?? 'public',
			details: packHatadyDetails(book.details, privateAccess === true),
			id: book.id,
			createdAt: book.createdAt.toISOString(),
			updatedAt: book.updatedAt.toISOString(),
			userId: book.userId,
			title: book.title,
			author: book.author,
			totalPages: book.totalPages,
			currentPage: book.currentPage,
			status: book.status,
			coverColorIndex: book.coverColorIndex,
			isFavorite: book.isFavorite,
			isRecommended: book.isRecommended,
			finishedAt: book.finishedAt ? book.finishedAt.toISOString() : null,
			// 進捗率(総ページ数がある時のみ)。
			progress: (book.totalPages && book.totalPages > 0)
				? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
				: null,
		};
	}

	public async packBookWithUser(book: MiHatadyBook, viewerId: MiUser['id'], privateAccess = false): Promise<Record<string, unknown>> {
		const users = await this.userEntityService.packMany([book.userId], { id: viewerId }, { schema: 'UserLite' });
		return { ...this.packBook(book, privateAccess), user: users[0] ?? null };
	}

	// 旗鯖fork(セキュリティ): しおりは自由記述メモ(bm.memo)を含む私的データのため、
	//   閲覧者が所有する本にだけ付ける。viewerId は必須引数にして、呼び出し側に必ず判断させる。
	//   viewerId に null を渡すと絞り込まない(モデレーター専用エンドポイント用の明示的なオプトアウト)。
	@bindThis
	public async packBooks(books: MiHatadyBook[], viewerId: MiUser['id'] | null): Promise<Record<string, unknown>[]> {
		if (books.length === 0) return [];
		const users = await this.userEntityService.packMany([...new Set(books.map(book => book.userId))], viewerId ? { id: viewerId } : null, { schema: 'UserLite' });
		const usersMap = new Map(users.map(user => [user.id, user]));
		// しおりを一括取得して本ごとに付与(本棚の「しおりが挟まっている」演出用)。
		const visibleBooks = viewerId == null ? books : books.filter(b => b.userId === viewerId);
		const bmMap = new Map<string, MiHatadyBookmark[]>();
		if (visibleBooks.length > 0) {
			const bmRows = await this.hatadyBookmarksRepository.createQueryBuilder('bm')
				.where('bm.bookId IN (:...ids)', { ids: visibleBooks.map(b => b.id) })
				.orderBy('bm.page', 'ASC').getMany();
			for (const bm of bmRows) {
				const arr = bmMap.get(bm.bookId) ?? [];
				arr.push(bm);
				bmMap.set(bm.bookId, arr);
			}
		}
		return books.map(b => ({
			...this.packBook(b, viewerId == null || b.userId === viewerId),
			user: usersMap.get(b.userId) ?? null,
			bookmarks: (bmMap.get(b.id) ?? []).map(bm => this.packBookmark(bm)),
		}));
	}

	// 旗鯖fork: 学習ログを一括 pack。N+1 解消のため:
	//   1. 投稿者ユーザーを packMany で一括取得
	//   2. 紐づく本を In() で 1 クエリにまとめて取得
	@bindThis
	public async packLogs(logs: MiHatadyLog[], me?: { id: MiUser['id'] } | null, staffAccess = false): Promise<Record<string, unknown>[]> {
		if (logs.length === 0) return [];

		// 1. ユーザーを一括 pack。
		const userIds = [...new Set(logs.map(l => l.userId))];
		const packedUsers = await this.userEntityService.packMany(userIds);
		const usersMap = new Map(packedUsers.map(u => [u.id, u]));

		// 2. 本を一括取得。
		const bookIds = [...new Set(logs.map(l => l.bookId).filter((x): x is string => x != null))];
		const booksMap = new Map<string, MiHatadyBook>();
		if (bookIds.length > 0) {
			const books = await this.hatadyBooksRepository.findBy({ id: In(bookIds) });
			for (const b of books) booksMap.set(b.id, b);
		}

		const followed = me && bookIds.length ? await this.hatadyFollowingsRepository.findBy({ followerId: me.id }) : [];
		const follows = new Set(followed.map(row => row.followeeId));
		// 3. リアクションを一括集計。
		const reactionsMap = await this.aggregateReactions('log', logs.map(l => l.id), me?.id);
		const files = await this.hatadyAttachmentService.packRecords(logs);

		return logs.map(log => {
			const linkedBook = log.bookId ? booksMap.get(log.bookId) : null;
			const book = linkedBook && (staffAccess || linkedBook.userId === me?.id || (linkedBook.visibility ?? 'public') === 'public' || (linkedBook.visibility === 'followers' && follows.has(linkedBook.userId))) ? linkedBook : null;
			const rx = reactionsMap.get(log.id) ?? { reactions: {}, myReaction: null };
			return {
				id: log.id,
				createdAt: log.createdAt.toISOString(),
				studiedAt: log.studiedAt.toISOString(),
				userId: log.userId,
				user: usersMap.get(log.userId) ?? null,
				title: log.title,
				subject: log.subject,
				tag: log.tag,
				body: log.body,
				fileIds: log.fileIds ?? [],
				files: files.get(log.id) ?? [],
				bookId: book ? log.bookId : null,
				book: book ? this.packBook(book, staffAccess || book.userId === me?.id) : null,
				pageFrom: log.pageFrom,
				pageTo: log.pageTo,
				kind: log.kind ?? 'study',
				tags: log.tags ?? (log.tag ? [log.tag] : []),
				durationSeconds: normalizeHatadyDuration({}, log),
				startedAt: log.startedAt ?? null,
				details: log.details ?? {},
				mediaWorkId: log.userId === me?.id || staffAccess ? log.mediaWorkId ?? null : null,
				durationMinutes: log.durationMinutes,
				isPublic: log.isPublic,
				visibility: log.visibility,
				reactionsCount: log.reactionsCount,
				commentsCount: log.commentsCount,
				reactions: rx.reactions,
				myReaction: rx.myReaction,
				isMine: me ? log.userId === me.id : false,
			};
		});
	}

	// 旗鯖fork: コメント(会話ページの返信)を一括 pack。ユーザー・リアクションをまとめて取得。
	@bindThis
	public async packComments(comments: MiHatadyComment[], me?: { id: MiUser['id'] } | null): Promise<Record<string, unknown>[]> {
		if (comments.length === 0) return [];

		const userIds = [...new Set(comments.map(c => c.userId))];
		const packedUsers = await this.userEntityService.packMany(userIds);
		const usersMap = new Map(packedUsers.map(u => [u.id, u]));

		const reactionsMap = await this.aggregateReactions('comment', comments.map(c => c.id), me?.id);

		return comments.map(c => {
			const rx = reactionsMap.get(c.id) ?? { reactions: {}, myReaction: null };
			return {
				id: c.id,
				createdAt: c.createdAt.toISOString(),
				updatedAt: c.updatedAt?.toISOString() ?? null,
				logId: c.logId,
				userId: c.userId,
				user: usersMap.get(c.userId) ?? null,
				replyId: c.replyId,
				text: c.text,
				reactionsCount: c.reactionsCount,
				reactions: rx.reactions,
				myReaction: rx.myReaction,
				isMine: me ? c.userId === me.id : false,
			};
		});
	}

	@bindThis
	public async packLog(log: MiHatadyLog, me?: { id: MiUser['id'] } | null, staffAccess = false): Promise<Record<string, unknown>> {
		const [packed] = await this.packLogs([log], me, staffAccess);
		return packed;
	}

	// 旗鯖fork(1h): 通知を一括 pack。通知者・関連ログのタイトル・関連コメント本文をまとめて埋める。
	//   viewerId(=受信者) を渡すと、フォロー通知に「フォロー返し済みか(isFollowingBack)」を付与する。
	@bindThis
	public async packNotifications(notifications: MiHatadyNotification[], viewerId?: MiUser['id'] | null): Promise<Record<string, unknown>[]> {
		if (notifications.length === 0) return [];

		const notifierIds = [...new Set(notifications.map(n => n.notifierId).filter((x): x is string => x != null))];
		const packedUsers = notifierIds.length > 0 ? await this.userEntityService.packMany(notifierIds) : [];
		const usersMap = new Map(packedUsers.map(u => [u.id, u]));

		// フォロー通知用: 受信者が通知者をフォローしているか(フォロー返し済みか)を一括判定。
		const followBackSet = new Set<string>();
		if (viewerId) {
			const followTargetIds = [...new Set(notifications.filter(n => n.type === 'follow' && n.notifierId).map(n => n.notifierId as string))];
			if (followTargetIds.length > 0) {
				const rows = await this.hatadyFollowingsRepository.createQueryBuilder('f')
					.where('f.followerId = :me', { me: viewerId })
					.andWhere('f.followeeId IN (:...ids)', { ids: followTargetIds })
					.getMany();
				for (const r of rows) followBackSet.add(r.followeeId);
			}
		}

		const commentIds = [...new Set(notifications.map(n => n.commentId).filter((x): x is string => x != null))];
		const loadedComments = commentIds.length > 0
			? await this.hatadyCommentsRepository.findBy({ id: In(commentIds) })
			: [];
		const logIds = [...new Set([
			...notifications.map(n => n.logId).filter((x): x is string => x != null),
			...loadedComments.map(comment => comment.logId),
		])];
		const logsMap = new Map<string, MiHatadyLog>();
		if (logIds.length > 0 && viewerId) {
			const logs = await this.hatadyLogsRepository.findBy({ id: In(logIds) });
			const followerOwnerIds = [...new Set(logs
				.filter(log => log.userId !== viewerId && log.visibility === 'followers')
				.map(log => log.userId))];
			const followedIds = new Set<string>();
			if (followerOwnerIds.length > 0) {
				const rows = await this.hatadyFollowingsRepository.createQueryBuilder('log_following')
					.where('log_following.followerId = :viewerId', { viewerId })
					.andWhere('log_following.followeeId IN (:...ownerIds)', { ownerIds: followerOwnerIds })
					.getMany();
				for (const row of rows) followedIds.add(row.followeeId);
			}
			for (const log of logs) {
				if ((log.userId === viewerId || log.visibility === 'public' || (log.visibility === 'followers' && followedIds.has(log.userId))) && !(await this.hatadyService?.isBlockedEitherDirection(log.userId, viewerId))) {
					logsMap.set(log.id, log);
				}
			}
		}

		const commentsMap = new Map<string, MiHatadyComment>();
		if (commentIds.length > 0) {
			for (const comment of loadedComments) {
				if (logsMap.has(comment.logId)) commentsMap.set(comment.id, comment);
			}
		}

		const mediaWorkIds = [...new Set(notifications.map(n => n.mediaWorkId).filter((x): x is string => x != null))];
		const mediaWorksMap = new Map<string, { title: string; kind: string }>();
		if (mediaWorkIds.length > 0 && viewerId) {
			const works = await this.hatadyMediaWorksRepository.findBy({ id: In(mediaWorkIds) });
			const followedIds = new Set<string>();
			const ownerIds = [...new Set(works.filter(work => work.userId !== viewerId && work.visibility === 'followers').map(work => work.userId))];
			if (ownerIds.length > 0) {
				const rows = await this.hatadyFollowingsRepository.createQueryBuilder('following')
					.where('following.followerId = :viewerId', { viewerId })
					.andWhere('following.followeeId IN (:...ownerIds)', { ownerIds })
					.getMany();
				for (const row of rows) followedIds.add(row.followeeId);
			}
			const visible = works.map(work => ({ work, allowed: work.userId === viewerId || work.visibility === 'public' || (work.visibility === 'followers' && followedIds.has(work.userId)) }));
			for (const { work, allowed } of visible) if (allowed && !(await this.hatadyService?.isBlockedEitherDirection(work.userId, viewerId))) mediaWorksMap.set(work.id, { title: work.title, kind: work.kind });
		}

		const mediaSessionIds = [...new Set(notifications.map(n => n.mediaSessionId).filter((id): id is string => id != null))];
		const mediaSessionsMap = new Map<string, MiHatadyMediaSession>();
		if (mediaSessionIds.length && viewerId) {
			const sessions = await this.hatadyMediaWorksRepository.manager.getRepository(MiHatadyMediaSession).findBy({ id: In(mediaSessionIds) });
			for (const session of sessions) {
				const allowed = session.userId === viewerId || session.visibility === 'public' || (session.visibility === 'followers' && await this.hatadyFollowingsRepository.existsBy({ followerId: viewerId, followeeId: session.userId }));
				if (allowed && !(await this.hatadyService?.isBlockedEitherDirection(session.userId, viewerId))) mediaSessionsMap.set(session.id, session);
			}
		}

		const mediaCommentIds = [...new Set(notifications.map(n => n.mediaCommentId).filter((x): x is string => x != null))];
		const mediaCommentsMap = new Map<string, { text: string | null; spoiler: boolean }>();
		if (mediaCommentIds.length > 0) {
			const comments = await this.hatadyMediaCommentsRepository.findBy({ id: In(mediaCommentIds) });
			for (const comment of comments) {
				if ((comment.workId != null && mediaWorksMap.has(comment.workId)) || (comment.sessionId != null && mediaSessionsMap.has(comment.sessionId))) mediaCommentsMap.set(comment.id, { text: comment.spoiler ? null : comment.text, spoiler: comment.spoiler });
			}
		}

		return notifications.map(n => {
			const log = n.logId ? logsMap.get(n.logId) : null;
			const comment = n.commentId ? commentsMap.get(n.commentId) : null;
			const visibleLogId = log?.id ?? (comment != null && logsMap.has(comment.logId) ? comment.logId : null);
			const visibleCommentId = comment?.id ?? null;
			// 作品が削除済み、または通知後に非公開化されて現在の受信者が閲覧できない場合は、
			// stable ID 自体も返さない。タイトルだけを隠して ID を残すと存在確認の oracle になる。
			const visibleMediaWorkId = n.mediaWorkId != null && mediaWorksMap.has(n.mediaWorkId) ? n.mediaWorkId : null;
			const visibleMediaSession = n.mediaSessionId ? mediaSessionsMap.get(n.mediaSessionId) : null;
			const visibleMediaCommentId = n.mediaCommentId != null && mediaCommentsMap.has(n.mediaCommentId) ? n.mediaCommentId : null;
			return {
				id: n.id,
				createdAt: n.createdAt.toISOString(),
				type: n.type,
				isRead: n.isRead,
				user: n.notifierId ? (usersMap.get(n.notifierId) ?? null) : null,
				logId: visibleLogId,
				logTitle: visibleLogId ? (logsMap.get(visibleLogId)?.title ?? null) : null,
				commentId: visibleCommentId,
				commentText: comment?.text ?? null,
				mediaWorkId: visibleMediaWorkId,
				mediaSessionId: visibleMediaSession?.id ?? null,
				mediaTitle: visibleMediaWorkId ? (mediaWorksMap.get(visibleMediaWorkId)?.title ?? null) : visibleMediaSession?.workSnapshot?.title ?? null,
				mediaKind: visibleMediaWorkId ? (mediaWorksMap.get(visibleMediaWorkId)?.kind ?? null) : visibleMediaSession?.workSnapshot?.kind ?? null,
				mediaCommentId: visibleMediaCommentId,
				mediaCommentText: visibleMediaCommentId ? (mediaCommentsMap.get(visibleMediaCommentId)?.text ?? null) : null,
				mediaCommentSpoiler: visibleMediaCommentId ? (mediaCommentsMap.get(visibleMediaCommentId)?.spoiler ?? null) : null,
				reaction: n.reaction,
				value: n.value,
				isFollowingBack: n.type === 'follow' && n.notifierId ? followBackSet.has(n.notifierId) : false,
			};
		});
	}
}
