/* 旗鯖fork: Hatady の映画鑑賞・ゲームプレイ記録。 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyMediaWork, type HatadyMediaVisibility } from './HatadyMediaWork.js';

// 旗鯖fork(Hatady): game_pve は4人以上の協力プレイ(敵の種類・数・ウェーブ)を記録する種別。
// 種別を追加するときは、DBのCHK_hatady_media_session_kindも更新する。
export const HATADY_MEDIA_SESSION_KINDS = ['movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'] as const;
export type HatadyMediaSessionKind = typeof HATADY_MEDIA_SESSION_KINDS[number];

@Entity('hatady_media_session')
@Index(['userId', 'id'])
@Index(['workId', 'id'])
export class MiHatadyMediaSession {
	@Column({ ...id(), array: true, default: '{}' })
	public fileIds: string[];

	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone')
	public updatedAt: Date;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public workId: MiHatadyMediaWork['id'] | null;

	@ManyToOne(type => MiHatadyMediaWork, { onDelete: 'SET NULL' })
	@JoinColumn()
	public work: MiHatadyMediaWork | null;

	@Column('varchar', { length: 32 })
	public kind: HatadyMediaSessionKind;

	@Index()
	@Column('timestamp with time zone')
	public occurredAt: Date;

	@Column('integer', { nullable: true })
	public durationMinutes: number | null;

	@Column('varchar', { length: 8192, nullable: true })
	public note: string | null;

	@Column('boolean', { default: false })
	public noteSpoiler: boolean;

	@Column('varchar', { length: 16, default: 'private' })
	public visibility: HatadyMediaVisibility;

	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public details: Record<string, unknown>;
	@Column('double precision', { nullable: true })
	public durationSeconds: number | null;

	@Column('varchar', { length: 12, nullable: true })
	public startedAt: string | null;

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public tags: string[];

	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public workSnapshot: Record<string, unknown>;
}
