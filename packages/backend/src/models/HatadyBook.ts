/*
 * 旗鯖fork: Hatady(学習・読書記録)の本。ユーザーが手入力で登録する(外部API不使用)。
 * 表紙はタイトルから自動生成するため画像は保持しない。coverColorIndex で色だけ上書き可能。
 * 学習ログ(MiHatadyLog)から任意で参照され、進捗(currentPage)を更新する。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatady_book')
export class MiHatadyBook {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the book.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date of the book.',
	})
	public updatedAt: Date;

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
		comment: 'The book title.',
	})
	public title: string;

	@Column('varchar', {
		length: 256,
		nullable: true,
		comment: 'The author(s).',
	})
	public author: string | null;

	@Column('integer', {
		nullable: true,
		comment: 'Total pages (optional).',
	})
	public totalPages: number | null;

	@Column('integer', {
		default: 0,
		comment: 'Current page (progress).',
	})
	public currentPage: number;

	// reading=読書中 / finished=読了 / want=読みたい
	@Column('varchar', {
		length: 16,
		default: 'reading',
		comment: 'reading / finished / want',
	})
	public status: string;

	// 旗鯖fork: 自動生成表紙の色をユーザーが選んだ場合のインデックス。null = タイトルから自動。
	@Column('integer', {
		nullable: true,
		comment: 'User-chosen cover color index. null = auto from title.',
	})
	public coverColorIndex: number | null;

	// 旗鯖fork: お気に入り(本棚で上位表示)。
	@Column('boolean', {
		default: false,
		comment: 'Favorite (shown at top of the shelf).',
	})
	public isFavorite: boolean;

	// 旗鯖fork: おすすめの本(プロフィールのおすすめ本セクションに表示)。
	@Column('boolean', {
		default: false,
		comment: 'Recommended (shown in profile recommended section).',
	})
	public isRecommended: boolean;

	// 旗鯖fork: 読了日(status を finished にした日時)。ソート「読了日」に使用。
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the book was marked as finished.',
	})
	public finishedAt: Date | null;
	@Column('varchar', { length: 16, default: 'public' })
	public visibility: 'private' | 'followers' | 'public';

	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public details: Record<string, unknown>;
}
