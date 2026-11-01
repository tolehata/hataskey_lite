/*
 * 旗鯖fork: フィードバックセンターのコメントに対するリアクション。
 * 1ユーザーにつき1コメント1リアクション((commentId, userId) でユニーク)。reaction は絵文字文字列。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiFeedbackComment } from './FeedbackComment.js';

@Entity('feedback_comment_reaction')
@Index(['commentId', 'userId'], { unique: true })
export class MiFeedbackCommentReaction {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the reaction.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public commentId: MiFeedbackComment['id'];

	@ManyToOne(type => MiFeedbackComment, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public comment: MiFeedbackComment | null;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 260,
		comment: 'The reaction (emoji).',
	})
	public reaction: string;
}
