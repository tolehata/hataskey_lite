/*
 * 旗鯖fork(Hatady): 本の内容メモ。本ごとに複数持てる、内容(あらすじ・要点・引用など)の記録。
 *   本の所有者のみ作成/編集/削除できる。任意でページ番号を紐づけられる。
 *   しおり(MiHatadyBookmark)とは別物: しおりは「読書位置の目印」、こちらは「本の内容の記録」。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyBook } from './HatadyBook.js';

@Entity('hatady_book_memo')
export class MiHatadyBookMemo {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the memo.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date of the memo.',
	})
	public updatedAt: Date;

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

	@Column('varchar', {
		length: 4096,
		comment: 'The memo content.',
	})
	public text: string;

	// 任意: このメモが対応するページ番号。null = ページ指定なし。
	@Column('integer', {
		nullable: true,
		comment: 'Optional page number this memo refers to.',
	})
	public page: number | null;
}
