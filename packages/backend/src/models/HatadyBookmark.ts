/*
 * 旗鯖fork(Hatady): 本のしおり。ページ・名前・色で本ごとに管理する。
 *   本の所有者のみ作成/削除できる。本棚では しおりの数だけ「しおりが挟まっている」演出に使う。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyBook } from './HatadyBook.js';

@Entity('hatady_bookmark')
export class MiHatadyBookmark {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the bookmark.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public bookId: MiHatadyBook['id'];

	@ManyToOne(type => MiHatadyBook, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public book: MiHatadyBook | null;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('integer', {
		default: 0,
		comment: 'Bookmarked page.',
	})
	public page: number;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'Bookmark name / note.',
	})
	public name: string | null;

	// しおりの色(プリセットキー: red/orange/yellow/green/blue/purple/pink など)。
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: 'Bookmark color preset key.',
	})
	public color: string | null;

	// 旗鯖fork: しおりごとの長文メモ(name は短い見出し、こちらは自由記述の追記)。
	@Column('varchar', {
		length: 2048,
		nullable: true,
		comment: 'Per-bookmark free-text memo.',
	})
	public memo: string | null;
}
