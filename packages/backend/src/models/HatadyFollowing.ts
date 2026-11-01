/*
 * 旗鯖fork: Hatady 内のフォロー関係(要件①: hataskey 本体のフォローとは非連動・Hatady 内で完結)。
 *   followerId が followeeId をフォローする。1方向1レコード、(follower, followee) で一意。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatady_following')
@Index(['followerId', 'followeeId'], { unique: true })
export class MiHatadyFollowing {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the following.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public followerId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public follower: MiUser | null;

	@Index()
	@Column(id())
	public followeeId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public followee: MiUser | null;
}
