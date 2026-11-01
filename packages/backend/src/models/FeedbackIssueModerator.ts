/*
 * 旗鯖fork: フィードバックセンターの「Issue 個別のモデレーター権限付与」。
 * モデレーターは初期状態では Issue をクローズ等できないが、管理者が個別の Issue に対して
 * 特定のモデレーターへ対処権限を付与すると、その Issue に限り対処(クローズ/ステータス変更等)できる。
 * (feedbackId, userId) でユニーク。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiFeedbackIssue } from './FeedbackIssue.js';

@Entity('feedback_issue_moderator')
@Index(['feedbackId', 'userId'], { unique: true })
export class MiFeedbackIssueModerator {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'When the permission was granted.',
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

	@Column({
		...id(),
		nullable: true,
		comment: 'The admin user ID who granted the permission.',
	})
	public grantedById: MiUser['id'] | null;
}
