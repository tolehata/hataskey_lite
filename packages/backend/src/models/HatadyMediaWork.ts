/*
 * 旗鯖fork: Hatady の映画・ゲーム作品記録。
 * 既存の読書記録とは独立したドメインとして保持する。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export const HATADY_MEDIA_WORK_KINDS = ['movie', 'game', 'work'] as const;
export type HatadyMediaWorkKind = typeof HATADY_MEDIA_WORK_KINDS[number];
export const HATADY_MEDIA_WORK_STATUSES = ['planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped'] as const;
export type HatadyMediaWorkStatus = typeof HATADY_MEDIA_WORK_STATUSES[number];
export const HATADY_MEDIA_VISIBILITIES = ['private', 'followers', 'public'] as const;
export type HatadyMediaVisibility = typeof HATADY_MEDIA_VISIBILITIES[number];
export const HATADY_MOVIE_ORIGINS = ['domestic', 'foreign', 'co_production', 'other'] as const;
export type HatadyMovieOrigin = typeof HATADY_MOVIE_ORIGINS[number];
export const HATADY_MOVIE_VIEWING_MODES = ['dubbed', 'subtitled', 'original'] as const;
export type HatadyMovieViewingMode = typeof HATADY_MOVIE_VIEWING_MODES[number];

@Entity('hatady_media_work')
@Index(['userId', 'kind', 'id'])
@Index(['userId', 'status', 'id'])
export class MiHatadyMediaWork {
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

	@Column('varchar', { length: 16 })
	public kind: HatadyMediaWorkKind;

	@Column('varchar', { length: 512 })
	public title: string;

	@Column('varchar', { length: 512, nullable: true })
	public originalTitle: string | null;

	@Column('varchar', { length: 256, nullable: true })
	public creator: string | null;

	@Column('date', { nullable: true })
	public releaseDate: string | null;

	@Column('integer', { nullable: true })
	public releaseYear: number | null;

	@Column('varchar', { length: 32, default: 'planned' })
	public status: HatadyMediaWorkStatus;

	@Column('varchar', { length: 16, default: 'private' })
	public visibility: HatadyMediaVisibility;

	@Column('boolean', { default: false })
	public isFavorite: boolean;

	@Column('boolean', { default: false })
	public isRecommended: boolean;

	@Column('integer', { nullable: true })
	public recommendationRating: number | null;

	@Column('integer', { nullable: true })
	public coverColorIndex: number | null;

	@Column('varchar', { length: 8192, nullable: true })
	public synopsis: string | null;

	@Column('boolean', { default: false })
	public synopsisSpoiler: boolean;

	@Column('varchar', { length: 8192, nullable: true })
	public review: string | null;

	@Column('boolean', { default: false })
	public reviewSpoiler: boolean;

	@Column('varchar', { length: 2048, nullable: true })
	public officialUrl: string | null;

	// 映画固有
	@Column('integer', { nullable: true })
	public runtimeMinutes: number | null;

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public genres: string[];

	@Column('varchar', { length: 16, nullable: true })
	public origin: HatadyMovieOrigin | null;

	@Column('varchar', { length: 16, nullable: true })
	public viewingMode: HatadyMovieViewingMode | null;

	@Column('varchar', { length: 128, nullable: true })
	public primaryLanguage: string | null;

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public highlights: string[];

	@Column('boolean', { default: false })
	public highlightsSpoiler: boolean;

	// ゲーム固有
	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public platforms: string[];

	@Column('varchar', { length: 256, nullable: true })
	public developer: string | null;

	@Column('varchar', { length: 256, nullable: true })
	public publisher: string | null;
	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public details: Record<string, unknown>;
}
