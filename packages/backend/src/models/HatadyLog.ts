/*
 * 旗鯖fork: Hatady(学習・読書記録)の学習ログ(セッション)。
 * 何を学んだか(title) + 分野(subject) + 任意の本(bookId, pageFrom→pageTo) + 学習時間 + メモ +
 * この分野の得意/苦手/興味(tag) + 公開範囲(isPublic)。日付区切りの縦タイムラインで振り返る。
 * リアクション/コメントは後続フェーズ(件数は非正規化カラムで保持)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyBook } from './HatadyBook.js';
import { MiHatadyMediaWork } from './HatadyMediaWork.js';

// cooking は Hatask レシピの「作った記録」からのみ作られる。
export const HATADY_LOG_KINDS = ['study', 'exercise', 'work', 'cooking'] as const;
export type HatadyLogKind = typeof HATADY_LOG_KINDS[number];

@Entity('hatady_log')
export class MiHatadyLog {
	@Column({ ...id(), array: true, default: '{}' })
	public fileIds: string[];

	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the log (when recorded).',
	})
	public createdAt: Date;

	// 旗鯖fork: 実際に学習した開始時刻(記録時刻と別に指定できる)。タイムラインの日付区切りに使う。
	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the study session actually started.',
	})
	public studiedAt: Date;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 512,
		comment: 'What was studied (title).',
	})
	public title: string;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'Subject (free text, e.g. プログラミング).',
	})
	public subject: string;

	// strength=得意 / weak=苦手 / interest=興味 / null=なし
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: 'strength / weak / interest / null',
	})
	public tag: string | null;

	@Column('varchar', {
		length: 4096,
		nullable: true,
		comment: 'Memo / notes.',
	})
	public body: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The linked book (optional).',
	})
	public bookId: MiHatadyBook['id'] | null;

	@ManyToOne(type => MiHatadyBook, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public book: MiHatadyBook | null;

	@Column('integer', {
		nullable: true,
		comment: 'Page read from (optional).',
	})
	public pageFrom: number | null;

	@Column('integer', {
		nullable: true,
		comment: 'Page read to (optional).',
	})
	public pageTo: number | null;

	@Column('integer', {
		default: 0,
		comment: 'Study duration in minutes.',
	})
	public durationMinutes: number;

	// 旗鯖fork: サーバー全体に公開するか(みんなの学習フィードに載る)。false = 自分のみ。
	//   visibility==='public' と等価(既存クエリ互換のため併存)。
	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this log is public (server-wide feed). Equivalent to visibility==="public".',
	})
	public isPublic: boolean;

	// 旗鯖fork: 公開範囲。public=全体公開 / followers=フォロワーのみ / private=自分のみ。
	@Index()
	@Column('varchar', {
		length: 16,
		default: 'public',
		comment: 'public / followers / private',
	})
	public visibility: string;

	@Column('integer', {
		default: 0,
		comment: 'Denormalized reaction count.',
	})
	public reactionsCount: number;

	@Column('integer', {
		default: 0,
		comment: 'Denormalized comment count.',
	})
	public commentsCount: number;
	@Column('double precision', { nullable: true })
	public durationSeconds: number | null;

	@Column('varchar', { length: 12, nullable: true })
	public startedAt: string | null;

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public tags: string[];

	@Column('varchar', { length: 16, default: 'study' })
	public kind: HatadyLogKind;

	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public details: Record<string, unknown>;

	@Index()
	@Column({ ...id(), nullable: true })
	public mediaWorkId: MiHatadyMediaWork['id'] | null;

	@ManyToOne(type => MiHatadyMediaWork, { onDelete: 'SET NULL' })
	@JoinColumn()
	public mediaWork: MiHatadyMediaWork | null;
}
