/*
 * 旗鯖fork: Hatady 独自の通知(リアクション/コメント/フォロー/継続・達成)。
 *   hataskey 本体の通知とは別管理(要件: Hatady 内で完結)。type で種別を分ける。
 *   フォロー/マイルストーンは将来用の予約(現状はリアクション/コメントを生成)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyLog } from './HatadyLog.js';
import { MiHatadyComment } from './HatadyComment.js';
import { MiHatadyMediaWork } from './HatadyMediaWork.js';
import { MiHatadyMediaSession } from './HatadyMediaSession.js';
import { MiHatadyMediaComment } from './HatadyMediaComment.js';

@Entity('hatady_notification')
@Index(['notifieeId', 'createdAt'])
export class MiHatadyNotification {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the notification.',
	})
	public createdAt: Date;

	// 通知の受信者。
	@Index()
	@Column(id())
	public notifieeId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public notifiee: MiUser | null;

	// 通知を発生させたユーザー(システム通知なら null)。
	@Column({
		...id(),
		nullable: true,
	})
	public notifierId: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public notifier: MiUser | null;

	// reaction / comment / follow / milestone / mediaComment / mediaReply / mediaReaction
	@Column('varchar', {
		length: 32,
		comment: 'reaction / comment / follow / milestone',
	})
	public type: string;

	@Column({
		...id(),
		nullable: true,
		comment: 'The related log (reaction/comment target).',
	})
	public logId: MiHatadyLog['id'] | null;

	@ManyToOne(type => MiHatadyLog, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public log: MiHatadyLog | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The related comment (for comment/reply).',
	})
	public commentId: MiHatadyComment['id'] | null;

	@ManyToOne(type => MiHatadyComment, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public comment: MiHatadyComment | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The related Hatady movie/game work.',
	})
	public mediaWorkId: MiHatadyMediaWork['id'] | null;

	@ManyToOne(type => MiHatadyMediaWork, { onDelete: 'SET NULL' })
	@JoinColumn()
	public mediaWork: MiHatadyMediaWork | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The related Hatady movie/game comment.',
	})
	public mediaCommentId: MiHatadyMediaComment['id'] | null;

	@ManyToOne(type => MiHatadyMediaComment, { onDelete: 'SET NULL' })
	@JoinColumn()
	public mediaComment: MiHatadyMediaComment | null;

	// リアクション通知の絵文字。
	@Column('varchar', {
		length: 260,
		nullable: true,
	})
	public reaction: string | null;

	// マイルストーン等の任意情報(例: 連続日数)。
	@Column('integer', {
		nullable: true,
	})
	public value: number | null;

	@Index()
	@Column('boolean', {
		default: false,
	})
	public isRead: boolean;
	@Index()
	@Column({ ...id(), nullable: true })
	public mediaSessionId: MiHatadyMediaSession['id'] | null;

	@ManyToOne(type => MiHatadyMediaSession, { onDelete: 'SET NULL' })
	@JoinColumn()
	public mediaSession: MiHatadyMediaSession | null;

	@Column('timestamp with time zone', { nullable: true })
	public deletedAt: Date | null;
}
