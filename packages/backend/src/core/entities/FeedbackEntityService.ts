/*
 * 旗鯖fork: HataFeed の各エンティティを API レスポンス用に pack する。
 *   - 単体 pack* と、N+1 を解消するための packMany 系(packIssues / packComments / ...)を提供する。
 *   - 単体 pack* は packMany 系を 1 件で呼ぶ薄いラッパに揃え、コード重複を避ける。
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type {
	FeedbackIssuesRepository,
	FeedbackAgreesRepository,
	FeedbackCommentsRepository,
	FeedbackCommentReactionsRepository,
	FeedbackProjectsRepository,
	FeedbackIssueModeratorsRepository,
	FeedbackEmojiChangeRequestsRepository,
	EmojisRepository,
	DriveFilesRepository,
} from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import type { MiFeedbackComment } from '@/models/FeedbackComment.js';
import type { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';
import type { MiFeedbackEmojiChangeRequest } from '@/models/FeedbackEmojiChangeRequest.js';
import type { MiFeedbackNotification } from '@/models/FeedbackNotification.js';
import type { MiFeedbackProject } from '@/models/FeedbackProject.js';
import type { Packed } from '@/misc/json-schema.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class FeedbackEntityService {
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,
		@Inject(DI.feedbackAgreesRepository)
		private feedbackAgreesRepository: FeedbackAgreesRepository,
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,
		@Inject(DI.feedbackCommentReactionsRepository)
		private feedbackCommentReactionsRepository: FeedbackCommentReactionsRepository,
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,
		@Inject(DI.feedbackIssueModeratorsRepository)
		private feedbackIssueModeratorsRepository: FeedbackIssueModeratorsRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		@Inject(DI.feedbackEmojiChangeRequestsRepository)
		private feedbackEmojiChangesRepository: FeedbackEmojiChangeRequestsRepository,
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
	) {
	}

	@bindThis
	public async packProject(src: MiFeedbackProject['id'] | MiFeedbackProject): Promise<Record<string, unknown>> {
		const project = typeof src === 'object' ? src : await this.feedbackProjectsRepository.findOneByOrFail({ id: src });
		return {
			id: project.id,
			createdAt: project.createdAt.toISOString(),
			updatedAt: project.updatedAt.toISOString(),
			ownerId: project.ownerId,
			owner: await this.userEntityService.pack(project.ownerId),
			name: project.name,
			description: project.description,
			url: project.url,
			genre: project.genre ?? null,
			iconUrl: project.iconFileId ? (await this.driveFileEntityService.packManyByIds([project.iconFileId]))[0]?.url ?? null : null,
			isOfficial: project.isOfficial,
			color: project.color ?? null,
			suspended: project.suspended ?? false,
		};
	}

	// 旗鯖fork: Issue を一括 pack する。N+1 解消のため:
	//   1. 「賛同済み」を Issue 単位 exists 1回ずつ → In() で 1 クエリにまとめる
	//   2. createdBy / closedBy のユーザーを packMany で 1 クエリに集約
	//   3. 各 Issue の添付ファイル ID を全 Issue 横断で読み、所有者を確認してから packMany に渡す
	// 既存の packIssue は内部で packIssues([issue]) を呼ぶ形にしてコード重複を避けている。
	@bindThis
	public async packIssues(issues: MiFeedbackIssue[], me?: { id: MiUser['id'] } | null): Promise<Record<string, unknown>[]> {
		if (issues.length === 0) return [];

		// 1. 「自分が賛同済み」セットを 1 クエリで取得。
		const agreedIds = new Set<MiFeedbackIssue['id']>();
		if (me) {
			const rows = await this.feedbackAgreesRepository.findBy({
				feedbackId: In(issues.map(i => i.id)),
				userId: me.id,
			});
			for (const r of rows) agreedIds.add(r.feedbackId);
		}

		// 2. 各 Issue の対処担当(委任モデレーター)を 1 クエリでまとめて取得し、issueId ごとに集約。
		//    一覧のメタ行に「対処担当」を出すため(2a)。N+1 を避けるため In() で一括。
		const modRows = await this.feedbackIssueModeratorsRepository.findBy({
			feedbackId: In(issues.map(i => i.id)),
		});
		const assigneeIdsByIssue = new Map<string, MiUser['id'][]>();
		for (const r of modRows) {
			const arr = assigneeIdsByIssue.get(r.feedbackId) ?? [];
			arr.push(r.userId);
			assigneeIdsByIssue.set(r.feedbackId, arr);
		}

		// 3. createdBy / closedBy / 対処担当 のユーザーをまとめて pack。
		const userIds = new Set<MiUser['id']>();
		for (const i of issues) {
			if (i.createdById) userIds.add(i.createdById);
			if (i.closedById) userIds.add(i.closedById);
		}
		for (const ids of assigneeIdsByIssue.values()) for (const uid of ids) userIds.add(uid);
		const packedUsersMap = new Map<MiUser['id'], Packed<'UserLite'>>();
		if (userIds.size > 0) {
			const packed = await this.userEntityService.packMany([...userIds]);
			for (const u of packed) packedUsersMap.set(u.id, u);
		}

		// 3. 全 Issue 横断で fileIds を集めて 1 回の packManyByIds に集約。
		const allFileIds = new Set<string>();
		for (const i of issues) for (const fid of i.fileIds) allFileIds.add(fid);
		const sourceFiles = allFileIds.size > 0
			? await this.driveFilesRepository.findBy({ id: In([...allFileIds]) })
			: [];
		const sourceFilesMap = new Map(sourceFiles.map(file => [file.id, file]));
		const safeFileIds = [...allFileIds].filter(fid => issues.some(issue =>
			issue.createdById != null && issue.fileIds.includes(fid) && sourceFilesMap.get(fid)?.userId === issue.createdById));
		const packedFilesMap = new Map<string, Packed<'DriveFile'>>();
		if (safeFileIds.length > 0) {
			const packed = await this.driveFileEntityService.packMany(sourceFiles.filter(file => safeFileIds.includes(file.id)));
			for (const f of packed) packedFilesMap.set(f.id, f);
		}

		return issues.map(issue => ({
			id: issue.id,
			number: issue.number,
			createdAt: issue.createdAt.toISOString(),
			updatedAt: issue.updatedAt.toISOString(),
			title: issue.title,
			description: issue.description,
			category: issue.category,
			status: issue.status,
			priority: issue.priority,
			pinned: issue.pinned,
			closed: issue.closed,
			closedAt: issue.closedAt ? issue.closedAt.toISOString() : null,
			closedBy: issue.closedById ? (packedUsersMap.get(issue.closedById) ?? null) : null,
			agreementsCount: issue.agreementsCount,
			commentsCount: issue.commentsCount,
			lastCommentedAt: issue.lastCommentedAt ? issue.lastCommentedAt.toISOString() : null,
			resolutionNote: issue.resolutionNote,
			projectId: issue.projectId,
			code: issue.code ?? null,
			isAgreed: agreedIds.has(issue.id),
			createdBy: issue.createdById ? (packedUsersMap.get(issue.createdById) ?? null) : null,
			// 旗鯖fork(2a): 対処担当(委任モデレーター)。一覧メタ行の「対処担当」表示に使う。
			assignees: (assigneeIdsByIssue.get(issue.id) ?? [])
				.map(uid => packedUsersMap.get(uid))
				.filter((x): x is Packed<'UserLite'> => x != null),
			files: issue.fileIds.length > 0
				? issue.fileIds.filter(fid => issue.createdById != null && sourceFilesMap.get(fid)?.userId === issue.createdById)
					.map(fid => packedFilesMap.get(fid)).filter(x => x != null)
				: [],
		}));
	}

	@bindThis
	public async packIssue(src: MiFeedbackIssue['id'] | MiFeedbackIssue, me?: { id: MiUser['id'] } | null): Promise<Record<string, unknown>> {
		const issue = typeof src === 'object' ? src : await this.feedbackIssuesRepository.findOneByOrFail({ id: src });
		const [packed] = await this.packIssues([issue], me);
		return packed;
	}

	// 旗鯖fork: この Issue に対処権限を委任されたユーザー(委任者)を pack する。
	@bindThis
	public async packIssueModerators(feedbackId: string): Promise<Record<string, unknown>[]> {
		const rows = await this.feedbackIssueModeratorsRepository.findBy({ feedbackId });
		if (rows.length === 0) return [];
		// 旗鯖fork: ユーザーは packMany で一括取得し、N+1 を回避する。
		return await this.userEntityService.packMany(rows.map(r => r.userId));
	}

	// 旗鯖fork: 会話に参加した(コメントした)ユーザー(参加者)を pack する。重複排除・最大20・参加順。
	@bindThis
	public async packIssueParticipants(feedbackId: string): Promise<Record<string, unknown>[]> {
		const rows = await this.feedbackCommentsRepository.createQueryBuilder('comment')
			.select('comment.userId', 'userId')
			.addSelect('MIN(comment.id)', 'firstId')
			.where('comment.feedbackId = :feedbackId', { feedbackId })
			.groupBy('comment.userId')
			.orderBy('"firstId"', 'ASC')
			.limit(20)
			.getRawMany<{ userId: string }>();
		if (rows.length === 0) return [];
		// 旗鯖fork: ユーザーは packMany で一括取得し、N+1 を回避する。
		return await this.userEntityService.packMany(rows.map(r => r.userId));
	}

	// 旗鯖fork: Comment を一括 pack する。N+1 解消のため:
	//   1. リアクションを Comment 単位で findBy → In() で 1 クエリにまとめる
	//   2. コメント投稿者のユーザーを packMany で一括取得(replyTo.user も含む)
	//   3. ファイル ID を全 Comment 横断で読み、所有者を確認してから packMany に渡す
	//   4. 返信先 Comment 本体(replyToId)を In() で 1 クエリにまとめる
	@bindThis
	public async packComments(comments: MiFeedbackComment[], me?: { id: MiUser['id'] } | null): Promise<Record<string, unknown>[]> {
		if (comments.length === 0) return [];

		// 1. 全コメントのリアクションを 1 クエリで取得し、commentId ごとに集計する。
		const commentIds = comments.map(c => c.id);
		const allReactions = await this.feedbackCommentReactionsRepository.findBy({
			commentId: In(commentIds),
		});
		const reactionsByComment = new Map<string, { counts: Record<string, number>; myReaction: string | null }>();
		for (const cid of commentIds) reactionsByComment.set(cid, { counts: {}, myReaction: null });
		for (const r of allReactions) {
			const bucket = reactionsByComment.get(r.commentId);
			if (!bucket) continue;
			bucket.counts[r.reaction] = (bucket.counts[r.reaction] ?? 0) + 1;
			if (me && r.userId === me.id) bucket.myReaction = r.reaction;
		}

		// 2. 返信先コメントを 1 クエリで取得。
		const replyToIds = comments.map(c => c.replyToId).filter((x): x is string => x != null);
		const replyToMap = new Map<string, MiFeedbackComment>();
		if (replyToIds.length > 0) {
			const parents = await this.feedbackCommentsRepository.findBy({ id: In(replyToIds) });
			for (const p of parents) replyToMap.set(p.id, p);
		}

		// 3. ユーザーを packMany で一括取得(コメント投稿者 + 返信先投稿者)。
		const userIds = new Set<MiUser['id']>();
		for (const c of comments) userIds.add(c.userId);
		for (const p of replyToMap.values()) userIds.add(p.userId);
		const packedUsers = userIds.size > 0 ? await this.userEntityService.packMany([...userIds]) : [];
		const packedUsersMap = new Map(packedUsers.map(u => [u.id, u]));

		// 4. ファイル ID を全 Comment 横断で集めて 1 回の packManyByIds に集約。
		const allFileIds = new Set<string>();
		for (const c of comments) for (const fid of c.fileIds) allFileIds.add(fid);
		const sourceFiles = allFileIds.size > 0
			? await this.driveFilesRepository.findBy({ id: In([...allFileIds]) })
			: [];
		const sourceFilesMap = new Map(sourceFiles.map(file => [file.id, file]));
		const safeFileIds = [...allFileIds].filter(fid => comments.some(comment =>
			comment.userId != null && comment.fileIds.includes(fid) && sourceFilesMap.get(fid)?.userId === comment.userId));
		const packedFilesMap = new Map<string, Packed<'DriveFile'>>();
		if (safeFileIds.length > 0) {
			const packed = await this.driveFileEntityService.packMany(sourceFiles.filter(file => safeFileIds.includes(file.id)));
			for (const f of packed) packedFilesMap.set(f.id, f);
		}

		return comments.map(src => {
			const bucket = reactionsByComment.get(src.id) ?? { counts: {}, myReaction: null };
			let replyTo: Record<string, unknown> | null = null;
			if (src.replyToId != null) {
				const parent = replyToMap.get(src.replyToId);
				if (parent != null) {
					replyTo = {
						id: parent.id,
						user: packedUsersMap.get(parent.userId) ?? null,
						text: parent.text.length > 80 ? parent.text.slice(0, 80) + '…' : parent.text,
					};
				}
			}
			return {
				id: src.id,
				createdAt: src.createdAt.toISOString(),
				updatedAt: src.updatedAt ? src.updatedAt.toISOString() : null,
				feedbackId: src.feedbackId,
				text: src.text,
				user: packedUsersMap.get(src.userId) ?? null,
				files: src.fileIds.length > 0
					? src.fileIds.filter(fid => src.userId != null && sourceFilesMap.get(fid)?.userId === src.userId)
						.map(fid => packedFilesMap.get(fid)).filter(x => x != null)
					: [],
				reactions: bucket.counts,
				myReaction: bucket.myReaction,
				replyToId: src.replyToId ?? null,
				replyTo,
				mark: src.mark ?? null,
			};
		});
	}

	@bindThis
	public async packComment(src: MiFeedbackComment, me?: { id: MiUser['id'] } | null): Promise<Record<string, unknown>> {
		const [packed] = await this.packComments([src], me);
		return packed;
	}

	@bindThis
	public async packEmojiRequest(src: MiFeedbackEmojiRequest): Promise<Record<string, unknown>> {
		return (await this.packEmojiRequests([src]))[0];
	}

	@bindThis
	public async packEmojiRequests(requests: MiFeedbackEmojiRequest[]): Promise<Record<string, unknown>[]> {
		if (!requests.length) return [];
		const fileIds = [...new Set(requests.flatMap(request => request.fileId != null ? [request.fileId] : []))];
		const [emojis, changes, sourceFiles] = await Promise.all([
			this.emojisRepository.findBy({ id: In(requests.flatMap(request => request.resolvedEmojiId ? [request.resolvedEmojiId] : [])) }),
			this.feedbackEmojiChangesRepository.createQueryBuilder('change').distinctOn(['change.originalRequestId']).where('change.originalRequestId IN (:...ids)', { ids: requests.map(request => request.id) }).orderBy('change.originalRequestId').addOrderBy('change.id', 'DESC').getMany(),
			fileIds.length > 0 ? this.driveFilesRepository.findBy({ id: In(fileIds) }) : Promise.resolve([]),
		]);
		const sourceFilesMap = new Map(sourceFiles.map(file => [file.id, file]));
		const safeFileIds = fileIds.filter(id => requests.some(request => request.fileId === id && request.requestedById != null && sourceFilesMap.get(id)?.userId === request.requestedById));
		const packedFiles = safeFileIds.length > 0 ? await this.driveFileEntityService.packMany(sourceFiles.filter(file => safeFileIds.includes(file.id))) : [];
		const packedFilesMap = new Map(packedFiles.map(file => [file.id, file]));
		return Promise.all(requests.map(async src => {
			const emoji = emojis.find(item => item.id === src.resolvedEmojiId && item.host == null);
			const change = changes.find(item => item.originalRequestId === src.id);
			const ownedFileId = src.fileId != null && src.requestedById != null && sourceFilesMap.get(src.fileId)?.userId === src.requestedById
				? src.fileId : null;
			return {
				id: src.id,
				createdAt: src.createdAt.toISOString(),
				updatedAt: src.updatedAt ? src.updatedAt.toISOString() : null,
				requestedBy: await this.userEntityService.pack(src.requestedById),
				name: src.name,
				category: src.category,
				aliases: src.aliases,
				license: src.license,
				localOnly: src.localOnly,
				isSensitive: src.isSensitive,
				sourceType: src.sourceType,
				originalUrl: src.originalUrl,
				remoteHost: src.remoteHost,
				fileId: ownedFileId,
				imageUrl: src.fileId != null ? (ownedFileId != null ? packedFilesMap.get(ownedFileId)?.url ?? null : null)
					: src.sourceType === 'remote' ? src.originalUrl : null,
				status: src.status,
				resolvedComment: src.resolvedComment,
				resolvedById: src.resolvedById,
				resolvedAt: src.resolvedAt ? src.resolvedAt.toISOString() : null,
				resolvedEmojiId: src.resolvedEmojiId,
				cancelledAt: src.cancelledAt?.toISOString() ?? null,
				cancellationReason: src.cancellationReason,
				currentEmoji: emoji ? { id: emoji.id, name: emoji.name, imageUrl: emoji.publicUrl || emoji.originalUrl, license: emoji.license, category: emoji.category, aliases: emoji.aliases } : null,
				latestChange: change ? await this.packEmojiChangeRequest(change) : null,
			};
		}));
	}

	@bindThis
	public async packEmojiChangeRequest(src: MiFeedbackEmojiChangeRequest): Promise<Record<string, unknown>> {
		return {
			id: src.id, originalRequestId: src.originalRequestId, targetEmojiId: src.targetEmojiId,
			createdAt: src.createdAt.toISOString(), updatedAt: src.updatedAt.toISOString(),
			requestedBy: await this.userEntityService.pack(src.requestedById),
			kind: src.kind, status: src.status, name: src.targetSnapshot.name, reason: src.reason,
			previousImageUrl: src.targetSnapshot.publicUrl || src.targetSnapshot.originalUrl,
			imageUrl: src.replacementImageUrl, license: src.license,
			resolvedAt: src.resolvedAt?.toISOString() ?? null, resolvedById: src.resolvedById,
			resolvedComment: src.resolvedComment, events: src.events,
		};
	}

	// 旗鯖fork: Notification を一括 pack する。N+1 解消のため:
	//   - actorId のユーザーを packMany で一括取得して 1 クエリに集約。
	@bindThis
	public async packNotifications(notifications: MiFeedbackNotification[]): Promise<Record<string, unknown>[]> {
		if (notifications.length === 0) return [];

		const actorIds = new Set<MiUser['id']>();
		for (const n of notifications) if (n.actorId) actorIds.add(n.actorId);
		const packedUsers = actorIds.size > 0 ? await this.userEntityService.packMany([...actorIds]) : [];
		const packedUsersMap = new Map(packedUsers.map(u => [u.id, u]));

		return notifications.map(src => ({
			id: src.id,
			createdAt: src.createdAt.toISOString(),
			type: src.type,
			message: src.message,
			isRead: src.isRead,
			actor: src.actorId ? (packedUsersMap.get(src.actorId) ?? null) : null,
			feedbackId: src.feedbackId,
			emojiRequestId: src.emojiRequestId,
			emojiChangeRequestId: src.emojiChangeRequestId,
			commentId: src.commentId,
		}));
	}

	@bindThis
	public async packNotification(src: MiFeedbackNotification): Promise<Record<string, unknown>> {
		const [packed] = await this.packNotifications([src]);
		return packed;
	}
}
