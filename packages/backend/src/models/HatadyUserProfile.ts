/*
 * 旗鯖fork(1c): Hatady のユーザー個別設定(プロフィールのバナー色など)。
 *   他ユーザーからも見えるためサーバー保存(レジストリではなくテーブル)。userId を主キーに 1:1。
 */

import { PrimaryColumn, Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatady_user_profile')
export class MiHatadyUserProfile {
	// user と 1:1。userId を主キーにする。
	@PrimaryColumn(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('timestamp with time zone', {
		comment: 'The last updated date.',
	})
	public updatedAt: Date;

	// バナー色のプリセットキー(orange / green / blue / purple / rose / teal / graphite など)。null=既定(orange)。
	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Profile banner color preset key.',
	})
	public bannerColor: string | null;
	@Column('jsonb', { default: () => '\'{}\'::jsonb' })
	public design: Record<string, unknown>;
}
