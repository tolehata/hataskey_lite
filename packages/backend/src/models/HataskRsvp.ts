/*
 * Hatask RSVP response
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHataskEvent } from './HataskEvent.js';

@Entity('hatask_rsvp')
@Index(['eventId', 'userId'], { unique: true })
export class MiHataskRsvp {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The event ID.',
	})
	public eventId: MiHataskEvent['id'];

	@ManyToOne(type => MiHataskEvent, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public event: MiHataskEvent | null;

	@Index()
	@Column({
		...id(),
		comment: 'The responder user ID.',
	})
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 16, comment: 'going / maybe / declined' })
	public status: string;

	@Column('timestamp with time zone')
	public respondedAt: Date;
}
