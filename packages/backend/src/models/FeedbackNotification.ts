/*
 * 旗鯖fork: フィードバックセンター内の通知(per-user)。
 * 絵文字申請の承認/却下、Issueへの新しいコメント、ステータス変更などの際に受信者へ作成する。
 * 未読(isRead=false)件数をフィードバックセンターの未読バッジに表示する。
 * メッセージは簡潔で分かりやすい文言(例: 「申請を承認しました。」「申請はリジェクトされました。」
 * 「新しいコメントが来ています。」)を message に保持する。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiFeedbackIssue } from './FeedbackIssue.js';
import { MiFeedbackEmojiRequest } from './FeedbackEmojiRequest.js';
import { MiFeedbackEmojiChangeRequest } from './FeedbackEmojiChangeRequest.js';

@Entity('feedback_notification')
@Index(['userId', 'isRead'])
export class MiFeedbackNotification {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the notification.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	// emojiApproved / emojiRejected / newComment / issueStatusChanged / issueClosed /
	// newEmojiRequest / newIssue など
	@Column('varchar', {
		length: 32,
		comment: 'The notification type.',
	})
	public type: string;

	@Column('varchar', {
		length: 1024,
		comment: 'The concise message text.',
	})
	public message: string;

	// 旗鯖fork: この通知の発生元となった操作者(例: 申請を承認したモデレーター)。
	// スタッフ間共有通知(他のモデレーターが処理したことの通知)で「誰が処理したか」を表示するのに使う。
	@Column({
		...id(),
		nullable: true,
		comment: 'The user who triggered this notification (e.g. the moderator who approved).',
	})
	public actorId: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public actor: MiUser | null;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the notification has been read.',
	})
	public isRead: boolean;

	@Column({
		...id(),
		nullable: true,
		comment: 'The related issue ID (if any).',
	})
	public feedbackId: MiFeedbackIssue['id'] | null;

	@ManyToOne(type => MiFeedbackIssue, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public feedback: MiFeedbackIssue | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The related emoji request ID (if any).',
	})
	public emojiRequestId: MiFeedbackEmojiRequest['id'] | null;

	@ManyToOne(type => MiFeedbackEmojiRequest, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public emojiRequest: MiFeedbackEmojiRequest | null;

	@Column({ ...id(), nullable: true })
	public emojiChangeRequestId: string | null;

	@ManyToOne(() => MiFeedbackEmojiChangeRequest, { onDelete: 'SET NULL' })
	@JoinColumn({ foreignKeyConstraintName: 'FK_feedback_notification_emoji_change' })
	public emojiChangeRequest: MiFeedbackEmojiChangeRequest | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The related comment ID (if any).',
	})
	public commentId: string | null;
}
