/*
 * Hatask shared event for RSVP
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatask_event')
export class MiHataskEvent {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The creator user ID.',
	})
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 256 })
	public title: string;

	@Column('varchar', { length: 32, default: '📅' })
	public emoji: string;

	@Column('varchar', { length: 16, comment: 'YYYY-MM-DD' })
	public date: string;

	@Column('varchar', { length: 16, default: '', comment: 'YYYY-MM-DD' })
	public dateEnd: string;

	@Column('varchar', { length: 8, default: '' })
	public timeStart: string;

	@Column('varchar', { length: 8, default: '' })
	public timeEnd: string;

	@Column('boolean', { default: false })
	public allDay: boolean;

	@Column('varchar', { length: 16, default: '#e27d60' })
	public color: string;

	@Column('boolean', { default: false })
	public rsvpClosed: boolean;

	@Column('boolean', { default: true })
	public rsvp: boolean;

	@Column('varchar', { length: 16, default: 'public' })
	public visibility: 'public' | 'specified';

	@Column('varchar', { length: 32, array: true, default: '{}' })
	public visibleUserIds: string[];

	@Column('timestamp with time zone')
	public createdAt: Date;
}
