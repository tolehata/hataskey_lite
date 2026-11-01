/*
 * 旗鯖fork: HataFeed(フィードバックセンター)のビジネスロジック。
 * - アクセス可否(ロールポリシー canAccessHataFeed)とクローズ等の権限判定
 *   (クローズできるのは管理者、または Issue 個別に権限付与されたモデレーター)
 * - プロジェクト / Issue / 賛同 / コメント / コメントリアクション / 絵文字申請 / Issue個別モデレーター権限 の操作
 * - フィードバックセンター内通知(per-user)の生成。スタッフが処理した場合は他スタッフへも共有通知する。
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type {
	FeedbackProjectsRepository,
	FeedbackIssuesRepository,
	FeedbackAgreesRepository,
	FeedbackCommentsRepository,
	FeedbackCommentReactionsRepository,
	FeedbackIssueModeratorsRepository,
	FeedbackEmojiRequestsRepository,
	FeedbackNotificationsRepository,
	DriveFilesRepository,
} from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import { MiFeedbackAgree } from '@/models/FeedbackAgree.js';
import type { MiFeedbackProject } from '@/models/FeedbackProject.js';
import { MiFeedbackComment } from '@/models/FeedbackComment.js';
import type { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { mergeHataFeedRecipients } from '@/misc/hatafeed-notification.js';
import { lockEmojiRequest } from '@/misc/emoji-request-lock.js';
import type { EmojiTransaction } from '@/misc/emoji-transaction.js';
import { MiFeedbackNotification } from '@/models/FeedbackNotification.js';
import { ApiError } from '@/server/api/error.js';
import { feedbackEmojiErrors } from '@/misc/feedback-emoji-errors.js';
import { feedbackAttachmentErrors, validateFeedbackFiles } from '@/misc/feedback-attachments.js';

type FeedbackNotificationRefs = { actorId?: MiUser['id'] | null; feedbackId?: string | null; emojiRequestId?: string | null; emojiChangeRequestId?: string | null; commentId?: string | null };
type EmojiOverrides = { name?: string; category?: string | null; aliases?: string[]; license?: string | null; localOnly?: boolean; isSensitive?: boolean };

// 通知の簡潔メッセージ。
const NOTIFY_MESSAGE = {
	emojiApproved: '絵文字の申請が承認されました。',
	emojiRejected: '絵文字の申請がリジェクトされました。',
	emojiHeld: '絵文字の申請が保留になりました。',
	newComment: '新しいコメントが来ています。',
	commentReaction: 'あなたのコメントにリアクションが付きました。',
	issueClosed: 'イシューがクローズされました。',
	issueReopened: 'イシューが再オープンされました。',
	issueStatusChanged: 'イシューのステータスが変更されました。',
	newEmojiRequest: '新しい絵文字の申請が来ています。',
	newIssue: '新しいイシューが投稿されました。',
	moderatorGranted: 'このイシューの対処権限が付与されました。',
	issueResolved: 'イシューが解決済みになりました。',
} as const;

type NotifyType = keyof typeof NOTIFY_MESSAGE;

// ステータスの日本語ラベル(通知文言用)。closed=受付終了 はクローズ時に自動設定する。
const STATUS_LABEL_JP: Record<string, string> = {
	open: '受付中',
	planned: '対応予定',
	nextFixConfirmed: '次回修正確定',
	nextFixPlanned: '次回修正予定',
	inProgress: '対応中',
	monitoring: '修正監視中',
	resolved: '解決済み',
	wontfix: '見送り',
	unknown: '用途不明',
	closed: '受付終了',
};

@Injectable()
export class FeedbackService {
	constructor(
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,
		@Inject(DI.feedbackAgreesRepository)
		private feedbackAgreesRepository: FeedbackAgreesRepository,
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,
		@Inject(DI.feedbackCommentReactionsRepository)
		private feedbackCommentReactionsRepository: FeedbackCommentReactionsRepository,
		@Inject(DI.feedbackIssueModeratorsRepository)
		private feedbackIssueModeratorsRepository: FeedbackIssueModeratorsRepository,
		@Inject(DI.feedbackEmojiRequestsRepository)
		private feedbackEmojiRequestsRepository: FeedbackEmojiRequestsRepository,
		@Inject(DI.feedbackNotificationsRepository)
		private feedbackNotificationsRepository: FeedbackNotificationsRepository,
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private idService: IdService,
		private roleService: RoleService,
		private customEmojiService: CustomEmojiService,
		private notificationService: NotificationService,
	) {
	}

	//#region 権限判定

	// HataFeed を利用できるか(ロールポリシー canAccessHataFeed。スタッフは常に可)。
	@bindThis
	public async canAccess(userId: MiUser['id'] | null): Promise<boolean> {
		if (userId == null) return false;
		if (await this.roleService.isModerator({ id: userId })) return true;
		const policies = await this.roleService.getUserPolicies(userId);
		return policies.canAccessHataFeed === true;
	}

	// スタッフ(管理者 or モデレーター)か。
	@bindThis
	public async isStaff(userId: MiUser['id'] | null): Promise<boolean> {
		if (userId == null) return false;
		return this.roleService.isModerator({ id: userId });
	}

	// 旗鯖fork: そのプロジェクトのイシューをエクスポートできるか。
	//   鯖缶(管理者/モデレーター)は常に可。プロジェクト作成者(owner)は自分のプロジェクトのみ可。
	//   公式(projectId=null)は鯖缶のみ。
	@bindThis
	public async canExport(userId: MiUser['id'] | null, projectId: string | null): Promise<boolean> {
		if (userId == null) return false;
		if (await this.roleService.isModerator({ id: userId })) return true;
		if (projectId == null) return false;
		const project = await this.feedbackProjectsRepository.findOneBy({ id: projectId });
		return project != null && project.ownerId === userId;
	}

	// その Issue を対処(クローズ/再オープン/ステータス変更等)できるか。
	// 管理者・モデレーターは常に可。加えて、その Issue に個別権限を委任された一般ユーザーも可。
	// (それ以外のユーザーは不可)
	@bindThis
	public async canManageIssue(userId: MiUser['id'] | null, issue: MiFeedbackIssue): Promise<boolean> {
		if (userId == null) return false;
		if (await this.roleService.isModerator({ id: userId })) return true;
		// 個別に委任されたユーザーか
		const grant = await this.feedbackIssueModeratorsRepository.findOneBy({ feedbackId: issue.id, userId });
		return grant != null;
	}

	// 旗鯖fork(セキュリティ): その Issue を閲覧してよいか。
	//   issues/show.ts が持っていた判定をそのまま切り出したもの(挙動は不変)。
	//   - セキュリティ対応(security)のイシューはスタッフ(管理者/モデ)のみ。存在ごと隠す。
	//   - サスペンド中プロジェクトのイシューは、作成者(owner)・鯖缶以外には存在ごと隠す。
	//   コメント一覧 / コメント投稿 / 賛同 / コメントリアクションからも呼ぶこと。
	//   ※ canAccess(HataFeed 自体を使えるか)とは別の判定。両方を通す必要がある。
	@bindThis
	public async canViewIssue(userId: MiUser['id'] | null, issue: MiFeedbackIssue): Promise<boolean> {
		if (issue.category === 'security' && !await this.isStaff(userId)) return false;

		if (issue.projectId != null) {
			const project = await this.feedbackProjectsRepository.findOneBy({ id: issue.projectId });
			if (project != null && !await this.canViewProject(userId, project)) return false;
		}

		return true;
	}

	// 旗鯖fork(セキュリティ): コメントIDしか持たない操作(リアクション等)向け。
	//   そのコメントが属する Issue を閲覧してよいかを判定する。
	//   コメントまたは Issue が存在しない場合も false(呼び出し側で存在ごと隠すこと)。
	@bindThis
	public async canViewComment(userId: MiUser['id'] | null, commentId: string): Promise<boolean> {
		const comment = await this.feedbackCommentsRepository.findOneBy({ id: commentId });
		if (comment == null) return false;
		const issue = await this.feedbackIssuesRepository.findOneBy({ id: comment.feedbackId });
		if (issue == null) return false;
		return this.canViewIssue(userId, issue);
	}

	//#endregion

	//#region 通知

	// 旗鯖fork(セキュリティ): Issue にひも付く通知は、本文と同じ可視性判定を通す。
	// 公開 Issue が後から security へ変更された場合などに、過去の参加者へ
	// タイトルや状態だけが通知経由で漏れることを防ぐ。
	@bindThis
	private async filterVisibleIssueNotificationRecipients(userIds: MiUser['id'][], feedbackId?: string | null): Promise<MiUser['id'][]> {
		const uniqueUserIds = [...new Set(userIds)];
		if (feedbackId == null || uniqueUserIds.length === 0) return uniqueUserIds;

		const issue = await this.feedbackIssuesRepository.findOneBy({ id: feedbackId });
		if (issue == null) return [];

		const visibleUserIds = await Promise.all(uniqueUserIds.map(async userId =>
			await this.canViewIssue(userId, issue) ? userId : null,
		));
		return visibleUserIds.filter((userId): userId is MiUser['id'] => userId != null);
	}

	// 単一ユーザーへ通知を作成する。message を渡すと固定文言の代わりにその文言を使う(イシュー名入り等)。
	@bindThis
	public async notify(userId: MiUser['id'], type: NotifyType, refs: FeedbackNotificationRefs = {}, message?: string, transaction?: EmojiTransaction): Promise<void> {
		await this.notifyMany([userId], type, refs, message, transaction);
	}

	// スタッフ全員(actor を除く)へ共有通知する。重複ID(管理者かつモデレーター等)は排除する。
	// 旗鯖fork: feedback_notifications への INSERT を bulk 化(notifyMany 経由)して 1クエリにまとめる。
	//   ベル通知(Redis xadd / WS publish 等)は per-user 副作用が必要なため個別呼び出しを維持。
	@bindThis
	public async notifyStaff(actorId: MiUser['id'] | null, type: NotifyType, refs: FeedbackNotificationRefs = {}, message?: string, excludedRecipientIds: MiUser['id'][] = [], transaction?: EmojiTransaction): Promise<void> {
		const staffIds = await this.roleService.getModeratorIds({ includeAdmins: true, includeRoot: true });
		const targets = mergeHataFeedRecipients(actorId == null ? excludedRecipientIds : [actorId, ...excludedRecipientIds], staffIds);
		await this.notifyMany(targets, type, { ...refs, actorId }, message, transaction);
	}

	// 表示名を取り出すヘルパー(通知文言用)。
	@bindThis
	private displayName(user: { name?: string | null; username: string } | null | undefined): string {
		if (user == null) return '誰か';
		return (user.name && user.name.length > 0) ? user.name : user.username;
	}

	// 旗鯖fork: 複数ユーザーへ同一文言の通知を bulk insert で配信する。
	//   DB の INSERT は 1クエリにまとめ、ベル通知(Redis xadd / WS publish)は per-user に並列発火する。
	//   念のためこの層でも重複を排除し、呼び出し側の役割重複を未読件数へ波及させない。
	@bindThis
	private async notifyMany(userIds: MiUser['id'][], type: NotifyType, refs: FeedbackNotificationRefs = {}, message?: string, transaction?: EmojiTransaction): Promise<void> {
		const uniqueUserIds = await this.filterVisibleIssueNotificationRecipients(userIds, refs.feedbackId);
		if (uniqueUserIds.length === 0) return;
		const body = (message ?? NOTIFY_MESSAGE[type]).slice(0, 1024);
		const now = new Date();
		const repository = transaction?.manager.getRepository(MiFeedbackNotification) ?? this.feedbackNotificationsRepository;
		const rows = uniqueUserIds.map(uid => ({
			id: this.idService.gen(),
			createdAt: now,
			userId: uid,
			type,
			message: body,
			isRead: false,
			actorId: refs.actorId ?? null,
			feedbackId: refs.feedbackId ?? null,
			emojiRequestId: refs.emojiRequestId ?? null,
			emojiChangeRequestId: refs.emojiChangeRequestId ?? null,
			commentId: refs.commentId ?? null,
		}));
		await repository.insert(rows);
		const linkRef = refs.feedbackId ? `/hatafeed/${refs.feedbackId}` : refs.emojiChangeRequestId ? `/hatafeed?emojiChangeRequestId=${refs.emojiChangeRequestId}` : refs.emojiRequestId ? `/hatafeed?emojiRequestId=${refs.emojiRequestId}` : '/hatafeed';
		const publish = async () => {
			const results = await Promise.allSettled(rows.map(row => this.notificationService.createNotificationAsync(row.userId, 'hataFeed', {
					sourceNotificationId: row.id,
					customBody: body,
					customHeader: 'HataFeed',
					customIcon: null,
					customLink: linkRef,
				})));
			const failed = results.flatMap((result, index) => result.status === 'rejected' ? [{ id: rows[index].id, reason: result.reason }] : []);
			if (failed.length > 0) throw new AggregateError(failed.map(item => item.reason), `hataFeed standard notification mirror failed: ${failed.map(item => item.id).join(',')}`);
		};
		if (transaction) transaction.afterCommit.push(publish);
		else await publish();
	}

	@bindThis
	public async getUnreadCount(userId: MiUser['id']): Promise<number> {
		return this.feedbackNotificationsRepository.countBy({ userId, isRead: false });
	}

	@bindThis
	public async markAllNotificationsRead(userId: MiUser['id']): Promise<void> {
		const rows = await this.feedbackNotificationsRepository.findBy({ userId, isRead: false });
		if (rows.length === 0) return;
		const ids = rows.map(row => row.id);
		await this.feedbackNotificationsRepository.update({ userId, id: In(ids), isRead: false }, { isRead: true });
		await this.notificationService.markSourceNotificationsRead(userId, 'hataFeed', ids);
	}

	@bindThis
	public async markNotificationRead(userId: MiUser['id'], notificationId: string): Promise<void> {
		// 通知IDだけでは更新しない。必ず所有者も条件に含め、他人の通知を既読にできないようにする。
		if (!(await this.feedbackNotificationsRepository.existsBy({ id: notificationId, userId }))) return;
		await this.feedbackNotificationsRepository.update({ id: notificationId, userId, isRead: false }, { isRead: true });
		await this.notificationService.markSourceNotificationsRead(userId, 'hataFeed', [notificationId]);
	}

	//#endregion

	//#region プロジェクト

	@bindThis
	public async createProject(owner: MiUser, params: { name: string; description?: string; url?: string | null; iconFileId?: string | null; color?: string | null; genre?: string | null }): Promise<string> {
		const now = new Date();
		const id = this.idService.gen();
		await this.feedbackProjectsRepository.insert({
			id,
			createdAt: now,
			updatedAt: now,
			ownerId: owner.id,
			name: params.name,
			description: params.description ?? '',
			url: params.url ?? null,
			genre: (params.genre != null && params.genre.length > 0) ? params.genre : null,
			iconFileId: params.iconFileId ?? null,
			color: (params.color != null && params.color.length > 0) ? params.color : null,
			isOfficial: false,
		});
		return id;
	}

	// 旗鯖fork: プロジェクトの更新(スタッフのみ)。指定されたフィールドだけ更新する。
	@bindThis
	public async updateProject(projectId: string, params: { name?: string; description?: string; url?: string | null; iconFileId?: string | null; color?: string | null; suspended?: boolean; genre?: string | null }): Promise<void> {
		await this.feedbackProjectsRepository.update(projectId, {
			updatedAt: new Date(),
			...(params.name !== undefined ? { name: params.name } : {}),
			...(params.description !== undefined ? { description: params.description } : {}),
			...(params.url !== undefined ? { url: params.url } : {}),
			...(params.genre !== undefined ? { genre: (params.genre != null && params.genre.length > 0) ? params.genre : null } : {}),
			...(params.iconFileId !== undefined ? { iconFileId: params.iconFileId } : {}),
			...(params.color !== undefined ? { color: (params.color != null && params.color.length > 0) ? params.color : null } : {}),
			...(params.suspended !== undefined ? { suspended: params.suspended } : {}),
		});
	}

	// 旗鯖fork: プロジェクトの削除(スタッフのみ・公式は不可)。
	//   このプロジェクトに紐づくイシューもすべて削除する(コメント・賛同・通知はFK CASCADEで連鎖削除)。
	@bindThis
	public async deleteProject(projectId: string): Promise<void> {
		// まず配下のイシューを全削除(関連データはDBのON DELETE CASCADEで連鎖)。
		await this.feedbackIssuesRepository.delete({ projectId });
		await this.feedbackProjectsRepository.delete({ id: projectId, isOfficial: false });
	}

	// 旗鯖fork: そのプロジェクト(およびその配下イシュー)を閲覧できるか。
	//   サスペンド中は作成者(owner)と鯖缶(管理者/モデレーター)のみ閲覧可。
	@bindThis
	public async canViewProject(userId: MiUser['id'] | null, project: MiFeedbackProject): Promise<boolean> {
		if (!project.suspended) return true;
		if (userId == null) return false;
		if (project.ownerId === userId) return true;
		return this.roleService.isModerator({ id: userId });
	}

	//#endregion

	//#region Issue

	@bindThis
	public async createIssue(creator: MiUser, params: {
		title: string;
		description?: string;
		category?: string;
		priority?: string;
		projectId?: string | null;
		fileIds?: string[];
		code?: string | null;
	}): Promise<string> {
		await validateFeedbackFiles(this.driveFilesRepository, params.fileIds ?? [], creator.id);
		const now = new Date();
		const id = this.idService.gen();
		// PostgreSQL assigns a unique number, including concurrent creations.
		await this.feedbackIssuesRepository.insert({
			id,
			createdAt: now,
			updatedAt: now,
			title: params.title,
			description: params.description ?? '',
			category: params.category ?? 'bug',
			status: 'open',
			priority: params.priority ?? 'normal',
			pinned: false,
			closed: false,
			agreementsCount: 0,
			commentsCount: 0,
			fileIds: params.fileIds ?? [],
			projectId: params.projectId ?? null,
			code: (params.code != null && params.code.length > 0) ? params.code : null,
			createdById: creator.id,
		});
		// 公式(インスタンス)フィードバックへの新規 Issue はスタッフへ共有通知。
		if ((params.projectId ?? null) == null) {
			await this.notifyStaff(creator.id, 'newIssue', { feedbackId: id }, `「${params.title}」のイシューが投稿されました。`);
		}
		return id;
	}

	// その Issue の会話に参加した(コメントした)ユーザーIDの一覧(重複排除)。
	@bindThis
	private async getCommenterIds(feedbackId: string): Promise<MiUser['id'][]> {
		const rows = await this.feedbackCommentsRepository.createQueryBuilder('comment')
			.select('comment.userId', 'userId')
			.where('comment.feedbackId = :feedbackId', { feedbackId })
			.distinct(true)
			.getRawMany<{ userId: string }>();
		return rows.map(r => r.userId);
	}

	// ステータス変更(対処権限が必要)。
	@bindThis
	public async setIssueStatus(actor: MiUser, issue: MiFeedbackIssue, status: string, resolutionNote?: string | null): Promise<void> {
		await this.feedbackIssuesRepository.update(issue.id, {
			status,
			resolutionNote: resolutionNote ?? issue.resolutionNote,
			updatedAt: new Date(),
		});
		// 起票者へ通知 + スタッフへ共有通知。状態名を明記する。
		const statusMsg = `イシュー「${issue.title}」の状態が「${STATUS_LABEL_JP[status] ?? status}」に変更されました。`;
		const staffIds = await this.roleService.getModeratorIds({ includeAdmins: true, includeRoot: true });
		const statusTargets = mergeHataFeedRecipients(
			[actor.id],
			issue.createdById == null ? [] : [issue.createdById],
			staffIds,
		);
		await this.notifyMany(statusTargets, 'issueStatusChanged', { actorId: actor.id, feedbackId: issue.id }, statusMsg);

		// 解決済みになった場合は、会話に参加したユーザーへ解決通知(起票者・操作者は除く)。
		if (status === 'resolved') {
			const resolvedMsg = `「${issue.title}」のイシューが解決済みになりました。`;
			const commenterIds = await this.getCommenterIds(issue.id);
			// 状態変更通知を受け取った人へ、同じ操作の「解決」通知を重ねて送らない。
			const targets = mergeHataFeedRecipients([actor.id, ...statusTargets], commenterIds);
			await this.notifyMany(targets, 'issueResolved', { actorId: actor.id, feedbackId: issue.id }, resolvedMsg);
		}
	}

	@bindThis
	public async closeIssue(actor: MiUser, issue: MiFeedbackIssue): Promise<void> {
		await this.feedbackIssuesRepository.update(issue.id, {
			closed: true,
			closedAt: new Date(),
			closedById: actor.id,
			// クローズ時はステータスを自動的に「受付終了」にする。
			status: 'closed',
			updatedAt: new Date(),
		});
		const msg = `イシュー「${issue.title}」がクローズされました（受付終了）。`;
		// 起票者・会話参加者・スタッフを先に一意化し、役割を兼ねる利用者へ重複送信しない。
		const commenterIds = await this.getCommenterIds(issue.id);
		const staffIds = await this.roleService.getModeratorIds({ includeAdmins: true, includeRoot: true });
		const targets = mergeHataFeedRecipients(
			[actor.id],
			issue.createdById == null ? [] : [issue.createdById],
			commenterIds,
			staffIds,
		);
		await this.notifyMany(targets, 'issueClosed', { actorId: actor.id, feedbackId: issue.id }, msg);
	}

	@bindThis
	public async reopenIssue(actor: MiUser, issue: MiFeedbackIssue): Promise<void> {
		await this.feedbackIssuesRepository.update(issue.id, {
			closed: false,
			closedAt: null,
			closedById: null,
			// 再オープン時はステータスを「受付中」に戻す。
			status: 'open',
			updatedAt: new Date(),
		});
		await this.notifyStaff(actor.id, 'issueReopened', { feedbackId: issue.id }, `イシュー「${issue.title}」が再オープンされました。`);
	}

	// イシューを削除する(関連するコメント・賛同・通知等は FK CASCADE で削除される)。スタッフ専用想定。
	@bindThis
	public async deleteIssue(issue: MiFeedbackIssue): Promise<void> {
		await this.feedbackIssuesRepository.delete(issue.id);
	}

	//#endregion

	//#region 賛同

	// 賛同のトグル。戻り値は操作後に賛同済みか。
	@bindThis
	public async toggleAgree(user: MiUser, issue: MiFeedbackIssue): Promise<boolean> {
		return this.feedbackIssuesRepository.manager.transaction(async manager => {
			const issues = manager.getRepository(MiFeedbackIssue);
			const agrees = manager.getRepository(MiFeedbackAgree);
			// Serialize toggles before reading their state. Both the row and its count
			// commit together, so retries and concurrent requests cannot double-count.
			await issues.findOneOrFail({ where: { id: issue.id }, lock: { mode: 'pessimistic_write' } });
			const existing = await agrees.findOneBy({ feedbackId: issue.id, userId: user.id });
			if (existing != null) {
				const deleted = await agrees.delete(existing.id);
				if (deleted.affected === 1) await issues.decrement({ id: issue.id }, 'agreementsCount', 1);
				return false;
			}
			await agrees.insert({ id: this.idService.gen(), createdAt: new Date(), feedbackId: issue.id, userId: user.id });
			await issues.increment({ id: issue.id }, 'agreementsCount', 1);
			return true;
		});
	}

	//#endregion

	//#region コメント

	@bindThis
	public async addComment(user: MiUser, issue: MiFeedbackIssue, text: string, fileIds: string[] = [], replyToId: string | null = null): Promise<string> {
		await validateFeedbackFiles(this.driveFilesRepository, fileIds, user.id);
		const now = new Date();
		const id = this.idService.gen();
		// 旗鯖fork: 返信先コメントを検証(同じイシュー内のものだけ許可)。
		let replyTarget: MiFeedbackComment | null = null;
		if (replyToId != null) {
			replyTarget = await this.feedbackCommentsRepository.findOneBy({ id: replyToId, feedbackId: issue.id });
		}
		await this.feedbackIssuesRepository.manager.transaction(async manager => {
			const issues = manager.getRepository(MiFeedbackIssue);
			await manager.getRepository(MiFeedbackComment).insert({
				id,
				createdAt: now,
				updatedAt: null,
				feedbackId: issue.id,
				userId: user.id,
				text,
				fileIds,
				replyToId: replyTarget ? replyTarget.id : null,
			});
			await issues.update(issue.id, { lastCommentedAt: now });
			await issues.increment({ id: issue.id }, 'commentsCount', 1);
		});
		const notified = new Set<MiUser['id']>([user.id]);
		// 旗鯖fork: 返信先コメントの投稿者へ「返信が来ています」通知。
		if (replyTarget != null && !notified.has(replyTarget.userId)) {
			notified.add(replyTarget.userId);
			await this.notify(replyTarget.userId, 'newComment', { actorId: user.id, feedbackId: issue.id, commentId: id }, `「${issue.title}」のイシューであなたのコメントに${this.displayName(user)}が返信しました。`);
		}
		// 起票者(コメント投稿者以外)へ「(イシュー名)に(投稿者)のコメントが来ています。」通知。
		if (issue.createdById != null && !notified.has(issue.createdById)) {
			await this.notify(issue.createdById, 'newComment', { actorId: user.id, feedbackId: issue.id, commentId: id }, `「${issue.title}」のイシューに${this.displayName(user)}のコメントが来ています。`);
		}
		return id;
	}

	// コメントへのリアクション(トグル)。付与(または差し替え)時はコメント投稿者へ通知。
	@bindThis
	public async toggleCommentReaction(user: MiUser, commentId: string, reaction: string): Promise<boolean> {
		const existing = await this.feedbackCommentReactionsRepository.findOneBy({ commentId, userId: user.id });
		if (existing != null && existing.reaction === reaction) {
			await this.feedbackCommentReactionsRepository.delete(existing.id);
			return false;
		}
		if (existing != null) {
			// 既存リアクションを差し替え
			await this.feedbackCommentReactionsRepository.update(existing.id, { reaction });
			await this.notifyCommentReaction(user, commentId);
			return true;
		}
		await this.feedbackCommentReactionsRepository.insert({
			id: this.idService.gen(),
			createdAt: new Date(),
			commentId,
			userId: user.id,
			reaction,
		});
		await this.notifyCommentReaction(user, commentId);
		return true;
	}

	// 旗鯖fork: コメントにリアクションが付いた時、コメント投稿者(自分以外)へ通知する。
	@bindThis
	private async notifyCommentReaction(actor: MiUser, commentId: string): Promise<void> {
		const comment = await this.feedbackCommentsRepository.findOneBy({ id: commentId });
		if (comment == null || comment.userId === actor.id) return;
		const issue = await this.feedbackIssuesRepository.findOneBy({ id: comment.feedbackId });
		const title = issue ? `「${issue.title}」の` : '';
		await this.notify(comment.userId, 'commentReaction', { actorId: actor.id, feedbackId: comment.feedbackId, commentId }, `${title}イシューであなたのコメントに${this.displayName(actor)}がリアクションしました。`);
	}

	// 旗鯖fork: コメントを管理(削除/マーク)できるか。コメント投稿者・イシュー対処権限者(スタッフ/委任)。
	@bindThis
	public async canManageComment(userId: MiUser['id'] | null, comment: MiFeedbackComment): Promise<boolean> {
		if (userId == null) return false;
		if (comment.userId === userId) return true;
		const issue = await this.feedbackIssuesRepository.findOneBy({ id: comment.feedbackId });
		if (issue == null) return false;
		return this.canManageIssue(userId, issue);
	}

	// 旗鯖fork: コメントのマークを設定する('important'/'question'/null)。
	@bindThis
	public async setCommentMark(commentId: string, mark: string | null): Promise<void> {
		await this.feedbackCommentsRepository.update(commentId, { mark: mark, updatedAt: new Date() });
	}

	// 旗鯖fork: コメントを削除する(関連リアクションはFK CASCADE)。commentsCountを減算する。
	@bindThis
	public async deleteComment(comment: MiFeedbackComment): Promise<void> {
		await this.feedbackIssuesRepository.manager.transaction(async manager => {
			const deleted = await manager.getRepository(MiFeedbackComment).delete({ id: comment.id, feedbackId: comment.feedbackId });
			if (deleted.affected === 1) {
				await manager.getRepository(MiFeedbackIssue).decrement({ id: comment.feedbackId }, 'commentsCount', 1);
			}
		});
	}

	//#endregion

	//#region Issue個別モデレーター権限(管理者のみ操作)

	@bindThis
	public async grantModerator(admin: MiUser, issue: MiFeedbackIssue, targetUserId: MiUser['id']): Promise<void> {
		const existing = await this.feedbackIssueModeratorsRepository.findOneBy({ feedbackId: issue.id, userId: targetUserId });
		if (existing != null) return;
		await this.feedbackIssueModeratorsRepository.insert({
			id: this.idService.gen(),
			createdAt: new Date(),
			feedbackId: issue.id,
			userId: targetUserId,
			grantedById: admin.id,
		});
		await this.notify(targetUserId, 'moderatorGranted', { actorId: admin.id, feedbackId: issue.id }, `「${issue.title}」のイシューの対処権限が付与されました。`);
	}

	@bindThis
	public async revokeModerator(issue: MiFeedbackIssue, targetUserId: MiUser['id']): Promise<void> {
		await this.feedbackIssueModeratorsRepository.delete({ feedbackId: issue.id, userId: targetUserId });
	}

	//#endregion

	//#region 絵文字申請

	// リモート絵文字の申請が可能か(ロールポリシー canRequestRemoteEmoji。スタッフは常に可)。
	@bindThis
	public async canRequestRemoteEmoji(userId: MiUser['id']): Promise<boolean> {
		if (await this.roleService.isModerator({ id: userId })) return true;
		const policies = await this.roleService.getUserPolicies(userId);
		return policies.canRequestRemoteEmoji === true;
	}

	// 週次クォータの使用量(過去7日間に作成した申請数)。
	@bindThis
	public async getEmojiRequestUsage(userId: MiUser['id']): Promise<number> {
		const weekAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
		return this.feedbackEmojiRequestsRepository.createQueryBuilder('req')
			.where('req.requestedById = :userId', { userId })
			.andWhere('req.createdAt >= :weekAgo', { weekAgo })
			.getCount();
	}

	// 絵文字申請のクォータ情報。limit はロールポリシー(emojiRequestLimit、既定10)。
	// remaining は過去7日の使用量を差し引いた残数。resetAt は最古の申請が枠を空ける時刻。
	@bindThis
	public async getEmojiRequestQuota(userId: MiUser['id']): Promise<{ limit: number; used: number; remaining: number; canRemote: boolean; resetAt: string | null }> {
		const policies = await this.roleService.getUserPolicies(userId);
		const limit = policies.emojiRequestLimit;
		const used = await this.getEmojiRequestUsage(userId);
		const canRemote = await this.canRequestRemoteEmoji(userId);

		// 枠が埋まっている場合、最古(=7日窓の先頭)の申請が抜けて1枠空く時刻を案内する。
		let resetAt: string | null = null;
		if (used >= limit && limit > 0) {
			const weekAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
			const oldest = await this.feedbackEmojiRequestsRepository.createQueryBuilder('req')
				.where('req.requestedById = :userId', { userId })
				.andWhere('req.createdAt >= :weekAgo', { weekAgo })
				.orderBy('req.createdAt', 'ASC')
				.getOne();
			if (oldest) resetAt = new Date(oldest.createdAt.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
		}

		return { limit, used, remaining: Math.max(0, limit - used), canRemote, resetAt };
	}

	@bindThis
	public async createEmojiRequest(user: MiUser, params: {
		name: string;
		category?: string | null;
		aliases?: string[];
		license?: string | null;
		localOnly?: boolean;
		isSensitive?: boolean;
		sourceType: 'remote' | 'image';
		originalUrl?: string | null;
		remoteHost?: string | null;
		fileId?: string | null;
	}): Promise<string> {
		if (params.sourceType === 'image' && params.fileId == null) throw new ApiError(feedbackAttachmentErrors.invalidAttachment);
		if (params.fileId != null) await validateFeedbackFiles(this.driveFilesRepository, [params.fileId], user.id);
		const now = new Date();
		const id = this.idService.gen();
		await this.feedbackEmojiRequestsRepository.insert({
			id,
			createdAt: now,
			updatedAt: now,
			requestedById: user.id,
			name: params.name,
			category: params.category ?? null,
			aliases: params.aliases ?? [],
			license: params.license ?? null,
			localOnly: params.localOnly ?? false,
			isSensitive: params.isSensitive ?? false,
			sourceType: params.sourceType,
			originalUrl: params.originalUrl ?? null,
			remoteHost: params.remoteHost ?? null,
			fileId: params.fileId ?? null,
			status: 'pending',
		});
		// 新規申請はスタッフへ共有通知(未処理タブ + 未読バッジ)。
		await this.notifyStaff(user.id, 'newEmojiRequest', { emojiRequestId: id });
		return id;
	}

	// 申請を承認 → 実際のカスタム絵文字を作成。
	// overrides を渡すと、承認者が申請内容を修正したうえで登録できる。
	@bindThis
	public async approveEmojiRequest(actor: MiUser, req: MiFeedbackEmojiRequest, overrides?: EmojiOverrides): Promise<void> {
		await this.withEmojiReviewLock(actor, req.id, fresh => this.applyEmojiApproval(actor, fresh, overrides));
	}

	private async withEmojiReviewLock(actor: MiUser, requestId: string, action: (req: MiFeedbackEmojiRequest) => Promise<void>): Promise<void> {
		if (!await this.canAccess(actor.id) || !await this.isStaff(actor.id)) throw new ApiError(feedbackEmojiErrors.accessDenied);
		await this.feedbackEmojiRequestsRepository.manager.transaction(async manager => {
			await lockEmojiRequest(manager, requestId);
			const fresh = await this.feedbackEmojiRequestsRepository.findOneBy({ id: requestId });
			if (!fresh) throw new ApiError(feedbackEmojiErrors.noSuchRequest);
			if (!['pending', 'held'].includes(fresh.status)) throw new ApiError(feedbackEmojiErrors.invalidState);
			await action(fresh);
		});
	}

	private async applyEmojiApproval(actor: MiUser, req: MiFeedbackEmojiRequest, overrides?: EmojiOverrides): Promise<void> {
		// ⚠️保留中(held)も承認できるようにする。ここを pending だけにすると保留した申請が二度と処理できなくなる。
		if (req.status !== 'pending' && req.status !== 'held') return;
		if (req.sourceType === 'image' && req.fileId == null) throw new ApiError(feedbackAttachmentErrors.invalidAttachment);
		const ownedFile = req.fileId != null
			? (await validateFeedbackFiles(this.driveFilesRepository, [req.fileId], req.requestedById)).get(req.fileId)
			: null;

		// 承認者の修正を反映した最終値。
		const rawName = overrides?.name ?? req.name;
		// カスタム絵文字名は [a-zA-Z0-9_] のみ有効。無効文字を _ に整形し、空なら 'emoji'。
		const baseName = (rawName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 120)) || 'emoji';
		// 同名が既にあると insert が失敗して「追加されない」ため、重複時は連番を付与して必ず登録する。
		let finalName = baseName;
		for (let n = 1; await this.customEmojiService.checkDuplicate(finalName); n++) {
			finalName = `${baseName}_${n}`;
		}
		const finalCategory = overrides?.category !== undefined ? overrides.category : req.category;
		const finalAliases = overrides?.aliases ?? req.aliases;
		const finalLicense = overrides?.license !== undefined ? overrides.license : req.license;
		const finalLocalOnly = overrides?.localOnly ?? req.localOnly;
		const finalIsSensitive = overrides?.isSensitive ?? req.isSensitive;

		// 画像を解決する。自前画像はドライブファイルから、リモートは originalUrl から。
		let originalUrl: string;
		let publicUrl: string;
		let fileType = 'image/png';
		if (req.fileId != null) {
			const file = ownedFile!;
			originalUrl = file.url;
			publicUrl = file.webpublicUrl ?? file.url;
			fileType = file.webpublicType ?? file.type ?? fileType;
		} else if (req.sourceType === 'remote' && req.originalUrl != null) {
			originalUrl = req.originalUrl;
			publicUrl = req.originalUrl;
		} else {
			throw new Error('no image source');
		}

		const emojiData = {
			originalUrl,
			publicUrl,
			fileType,
			name: finalName,
			category: finalCategory,
			aliases: finalAliases,
			host: null,
			license: finalLicense,
			isSensitive: finalIsSensitive,
			localOnly: finalLocalOnly,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
		};
		// 通常は add()(システムユーザーへ再アップロード)。再アップロードに失敗する環境
		// (ローカル開発でバックエンドが自分のドライブURLを取得できない等)では addDirect() にフォールバック。
		const emoji = await (async () => {
			try {
				return await this.customEmojiService.add(emojiData, actor);
			} catch {
				return await this.customEmojiService.addDirect(emojiData, actor);
			}
		})();

		await this.feedbackEmojiRequestsRepository.update(req.id, {
			status: 'approved',
			// 承認時に確定した内容を記録に残す。
			name: finalName,
			category: finalCategory,
			aliases: finalAliases,
			license: finalLicense,
			localOnly: finalLocalOnly,
			isSensitive: finalIsSensitive,
			resolvedById: actor.id,
			resolvedAt: new Date(),
			resolvedEmojiId: emoji.id,
			updatedAt: new Date(),
		});
		// 申請者へ承認通知(絵文字名入り) + 他スタッフへ共有通知。
		await this.notify(req.requestedById, 'emojiApproved', { actorId: actor.id, emojiRequestId: req.id }, `絵文字「:${finalName}:」の申請が承認されました。`);
		await this.notifyStaff(actor.id, 'emojiApproved', { emojiRequestId: req.id }, `${this.displayName(actor)}が絵文字「:${finalName}:」の申請を承認しました。`, [req.requestedById]);
	}

	@bindThis
	public async rejectEmojiRequest(actor: MiUser, req: MiFeedbackEmojiRequest, comment?: string | null): Promise<void> {
		await this.withEmojiReviewLock(actor, req.id, fresh => this.applyEmojiRejection(actor, fresh, comment));
	}

	private async applyEmojiRejection(actor: MiUser, req: MiFeedbackEmojiRequest, comment?: string | null): Promise<void> {
		// ⚠️保留中(held)もリジェクトできるようにする。
		if (req.status !== 'pending' && req.status !== 'held') return;
		await this.feedbackEmojiRequestsRepository.update(req.id, {
			status: 'rejected',
			resolvedById: actor.id,
			resolvedAt: new Date(),
			resolvedComment: comment ?? null,
			updatedAt: new Date(),
		});
		// 申請者へリジェクト通知(絵文字名・理由入り) + 他スタッフへ共有通知。
		const rejectedMsg = comment
			? `絵文字「:${req.name}:」の申請がリジェクトされました。（理由: ${comment}）`
			: `絵文字「:${req.name}:」の申請がリジェクトされました。`;
		await this.notify(req.requestedById, 'emojiRejected', { actorId: actor.id, emojiRequestId: req.id }, rejectedMsg);
		await this.notifyStaff(actor.id, 'emojiRejected', { emojiRequestId: req.id }, `${this.displayName(actor)}が絵文字「:${req.name}:」の申請をリジェクトしました。`, [req.requestedById]);
	}

	/**
	 * 旗鯖fork: 絵文字申請を保留にする。
	 * ⚠️承認画面で管理者が直した入力値をそのまま申請レコードへ保存してから保留にする。
	 *   （保留のたびに入力が消えると、結局あとで最初から入力し直すことになるため）
	 * ⚠️保留専用の列は増やさない（マイグレーションを増やさないため）。
	 *   最後に誰がいつ触ったかは resolvedBy/resolvedAt、理由は resolvedComment を流用する。
	 *   status が held の間は「未解決」であり、resolved* は解決記録ではなく最終操作の記録。
	 */
	@bindThis
	public async holdEmojiRequest(actor: MiUser, req: MiFeedbackEmojiRequest, overrides?: EmojiOverrides, comment?: string | null): Promise<void> {
		await this.withEmojiReviewLock(actor, req.id, fresh => this.applyEmojiHold(actor, fresh, overrides, comment));
	}

	private async applyEmojiHold(actor: MiUser, req: MiFeedbackEmojiRequest, overrides?: EmojiOverrides, comment?: string | null): Promise<void> {
		// ⚠️既に承認・却下したものは保留に戻さない。保留中の再保留（入力の上書き保存）は許す。
		if (req.status !== 'pending' && req.status !== 'held') return;

		await this.feedbackEmojiRequestsRepository.update(req.id, {
			...(overrides?.name !== undefined ? { name: overrides.name } : {}),
			...(overrides?.category !== undefined ? { category: overrides.category } : {}),
			...(overrides?.aliases !== undefined ? { aliases: overrides.aliases } : {}),
			...(overrides?.license !== undefined ? { license: overrides.license } : {}),
			...(overrides?.localOnly !== undefined ? { localOnly: overrides.localOnly } : {}),
			...(overrides?.isSensitive !== undefined ? { isSensitive: overrides.isSensitive } : {}),
			status: 'held',
			resolvedById: actor.id,
			resolvedAt: new Date(),
			resolvedComment: comment ?? null,
			updatedAt: new Date(),
		});

		const finalName = overrides?.name ?? req.name;
		const heldMsg = comment
			? `絵文字「:${finalName}:」の申請が保留になりました。（理由: ${comment}）`
			: `絵文字「:${finalName}:」の申請が保留になりました。`;
		await this.notify(req.requestedById, 'emojiHeld', { actorId: actor.id, emojiRequestId: req.id }, heldMsg);
		await this.notifyStaff(actor.id, 'emojiHeld', { emojiRequestId: req.id }, `${this.displayName(actor)}が絵文字「:${finalName}:」の申請を保留にしました。`, [req.requestedById]);
	}

	//#endregion
}
