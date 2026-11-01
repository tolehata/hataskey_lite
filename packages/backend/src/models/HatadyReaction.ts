/*
 * 旗鯖fork: Hatady の学習ログ / コメントへのリアクション。
 *   対象は logId か commentId のどちらか一方。1ユーザー1対象につき1リアクション(Misskey準拠)。
 *   reaction は hataskey 共通のリアクション文字列(unicode か :name: / :name@host: のカスタム絵文字)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyLog } from './HatadyLog.js';
import { MiHatadyComment } from './HatadyComment.js';

@Entity('hatady_reaction')
@Index(['userId', 'logId'], { unique: true, where: '"logId" IS NOT NULL' })
@Index(['userId', 'commentId'], { unique: true, where: '"commentId" IS NOT NULL' })
export class MiHatadyReaction {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the reaction.',
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

	// 対象ログ(commentId が null のとき有効)。
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The target log (mutually exclusive with commentId).',
	})
	public logId: MiHatadyLog['id'] | null;

	@ManyToOne(type => MiHatadyLog, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public log: MiHatadyLog | null;

	// 対象コメント(logId が null のとき有効)。
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The target comment (mutually exclusive with logId).',
	})
	public commentId: MiHatadyComment['id'] | null;

	@ManyToOne(type => MiHatadyComment, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public comment: MiHatadyComment | null;

	@Column('varchar', {
		length: 260,
		comment: 'Reaction (unicode emoji or :name: custom emoji).',
	})
	public reaction: string;
}
