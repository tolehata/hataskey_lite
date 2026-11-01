/*
 * 旗鯖fork: 宴(うたげ)判定セッション。
 * 本文に「宴/うたげ/ぅたげ/utage」を含むローカルノートが投稿されると running で1件作成され、
 * 15分(expiresAt)逃げ切れば succeeded、それ以前に反応(リアクション/リプライ/リノート)が
 * 着弾すれば抽選で reviving へ進み、それ以外は failed に確定する。
 * 復活期限内に目標の累計応援人数へ達すれば succeeded。一度 succeeded/failed になったら不可逆。
 * 従来はフロントのメモリ上でのみ判定していたため、リロードや別端末で状態が揺れていたが、
 * 確定結果をサーバーに永続化することで全クライアントで一貫した状態を読めるようにする。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiNote } from './Note.js';

@Entity('utage_session')
@Index('IDX_utage_session_resolved_status', ['resolvedAt', 'status'])
export class MiUtageSession {
	@PrimaryColumn(id())
	public id: string;

	@Index({ unique: true })
	@Column({
		...id(),
		comment: 'The target note ID.',
	})
	public noteId: MiNote['id'];

	@ManyToOne(type => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: MiNote | null;

	@Index()
	@Column({
		...id(),
		comment: 'The poster user ID.',
	})
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('timestamp with time zone', {
		comment: 'When the utage started (note creation time).',
	})
	public startedAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the flashing window ends (startedAt + 15min).',
	})
	public expiresAt: Date;

	@Index()
	@Column('varchar', {
		length: 16,
		default: 'running',
		comment: 'running / reviving / succeeded / failed',
	})
	public status: string;

	@Column('integer', { default: 0 })
	public ruleVersion: number;

	@Column('integer', { default: 0 })
	public revision: number;

	// Durable publication checkpoint. A worker retries unfinished side effects.
	@Column('integer', { default: 0 })
	public publishedRevision: number;

	@Column('timestamp with time zone', { nullable: true })
	public revivalStartedAt: Date | null;

	@Column('timestamp with time zone', { nullable: true })
	public revivalExpiresAt: Date | null;

	@Column('integer', { nullable: true })
	public revivalOnlineCount: number | null;

	@Column('integer', { nullable: true })
	public revivalTargetCount: number | null;

	// Private, immutable exclusion snapshot; never packed or streamed.
	@Column('varchar', { length: 32, array: true, default: '{}' })
	public revivalExcludedUserIds: string[];

	// At most 20 distinct receipts, updated under the session row lock.
	// Kept after reaction removal and account deletion so a receipt cannot be reused.
	@Column('varchar', { length: 32, array: true, default: '{}' })
	public revivalSupporterIds: string[];

	@Column('varchar', { length: 16, nullable: true })
	public successMethod: 'normal' | 'revival' | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the status was finalized (succeeded/failed).',
	})
	public resolvedAt: Date | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether another user interrupted this Utage within five seconds. Only events recorded after this column was introduced are eligible.',
	})
	public interruptedWithin5Seconds: boolean;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The user who interrupted the Utage. Local profile badge data only.',
	})
	public interruptedByUserId: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public interruptedByUser: MiUser | null;
}
