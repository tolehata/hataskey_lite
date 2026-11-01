/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: プライベートチャンネルへの参加招待。
 * 参加を承認するまでは channel_member に登録せず、チャンネル内容を閲覧できない。
 */

import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne, Check } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiChannel } from './Channel.js';

export type ChannelInvitationStatus = 'pending' | 'rejected';

@Entity('channel_invitation')
@Index(['channelId', 'userId'], { unique: true })
@Check('CHK_channel_invitation_status', '"status" IN (\'pending\', \'rejected\')')
export class MiChannelInvitation {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone', { nullable: true })
	public respondedAt: Date | null;

	@Index()
	@Column({ ...id() })
	public channelId: MiChannel['id'];

	@ManyToOne(type => MiChannel, { onDelete: 'CASCADE' })
	@JoinColumn()
	public channel: MiChannel | null;

	@Index()
	@Column({ ...id() })
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public invitedById: MiUser['id'] | null;

	@ManyToOne(type => MiUser, { onDelete: 'SET NULL' })
	@JoinColumn()
	public invitedBy: MiUser | null;

	@Index()
	@Column('varchar', { length: 16, default: 'pending' })
	public status: ChannelInvitationStatus;
}
