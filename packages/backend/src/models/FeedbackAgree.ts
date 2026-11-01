/*
 * 旗鯖fork: フィードバックセンターの「賛同(これ困ってる)」。ユーザーが Issue に1回賛同できる。
 * (feedbackId, userId) でユニーク。件数は MiFeedbackIssue.agreementsCount に非正規化して持つ。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiFeedbackIssue } from './FeedbackIssue.js';

@Entity('feedback_agree')
@Index(['feedbackId', 'userId'], { unique: true })
export class MiFeedbackAgree {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the FeedbackAgree.',
	})
	public createdAt: Date;

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
}
