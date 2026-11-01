/*
 * 旗鯖fork(Hatady): ユーザーの分野(subject)レジストリ。
 *   学習ログ上、分野は自由テキスト(HatadyLog.subject)だが、ここに (userId, name) 単位で
 *   「色の指定」や「明示登録」を保持して、分野の管理(色指定・削除・付け替え)を可能にする。
 *   色は本人のクライアント内でのみ反映される個人設定(他ユーザーの表示には影響しない)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatady_subject')
@Index(['userId', 'name'], { unique: true })
export class MiHatadySubject {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 128,
		comment: 'Subject name.',
	})
	public name: string;

	// 分野の色(HEX #rrggbb)。null = 既定(タイトルハッシュ/既知分野による自動割当)。
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: 'Subject color (hex). null = auto-assigned.',
	})
	public color: string | null;

	@Column('timestamp with time zone', {
		comment: 'The created date.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date.',
	})
	public updatedAt: Date;
}
