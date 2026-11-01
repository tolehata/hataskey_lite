/*
 * 旗鯖fork: Hatady の学習ログへのコメント(会話ページの返信)。
 *   replyId で1段のネスト返信に対応。リアクションは HatadyReaction(commentId)で保持。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyLog } from './HatadyLog.js';

@Entity('hatady_comment')
export class MiHatadyComment {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the comment.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public logId: MiHatadyLog['id'];

	@ManyToOne(type => MiHatadyLog, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public log: MiHatadyLog | null;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	// 返信先コメント(1段ネスト用)。null = ルート直下の返信。
	@Column({
		...id(),
		nullable: true,
		comment: 'The parent comment (for nested replies).',
	})
	public replyId: MiHatadyComment['id'] | null;

	@Column('varchar', {
		length: 2048,
		comment: 'Comment text.',
	})
	public text: string;

	@Column('integer', {
		default: 0,
		comment: 'Denormalized reaction count.',
	})
	public reactionsCount: number;
	@Column('timestamp with time zone', { nullable: true })
	public updatedAt: Date | null;
}
