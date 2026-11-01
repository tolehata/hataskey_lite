/*
 * 旗鯖fork: フィードバックセンターの Issue 内会話(コメント)。Issue に対して投稿でき、
 * メッセージには FeedbackCommentReaction でリアクションを付けられる。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiFeedbackIssue } from './FeedbackIssue.js';

@Entity('feedback_comment')
export class MiFeedbackComment {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the comment.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The last edited date of the comment.',
	})
	public updatedAt: Date | null;

	@Index()
	@Column(id())
	public feedbackId: MiFeedbackIssue['id'];

	@ManyToOne(type => MiFeedbackIssue, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public feedback: MiFeedbackIssue | null;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 8192,
		comment: 'The body text of the comment.',
	})
	public text: string;

	// 旗鯖fork: 添付画像(スクショ等)。ドライブファイルIDの配列。
	@Column('varchar', {
		length: 32,
		array: true,
		default: '{}',
		comment: 'Attached image (drive) file IDs.',
	})
	public fileIds: string[];

	// 旗鯖fork: このコメントが返信している先のコメントID(スレッド)。null = トップレベル。
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The comment this one replies to (thread). null = top-level.',
	})
	public replyToId: MiFeedbackComment['id'] | null;

	// 旗鯖fork: コメントのマーク。'important'=重要 / 'question'=? / null=なし。
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: "Comment mark: 'important' / 'question' / null.",
	})
	public mark: string | null;
}
