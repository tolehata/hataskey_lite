/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: プライベートチャンネルのメンバーシップ。
 *   ここに登録されたユーザー(+チャンネル作成者/副管理者)だけがプライベートチャンネルを閲覧できる。
 *   作成者や副管理者による追加、またはあいことば(password)入力で登録される。
 */

import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiChannel } from './Channel.js';

@Entity('channel_member')
@Index(['channelId', 'userId'], { unique: true })
export class MiChannelMember {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the membership.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The channel ID.',
	})
	public channelId: MiChannel['id'];

	@ManyToOne(type => MiChannel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: MiChannel | null;

	@Index()
	@Column({
		...id(),
		comment: 'The member user ID.',
	})
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;
}
