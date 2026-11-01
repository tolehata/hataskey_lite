/* SPDX-License-Identifier: AGPL-3.0-only */
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export const HATASK_REVIEW_STATES = ['unread', 'flagged', 'reviewed'] as const;
export type HataskReviewState = typeof HATASK_REVIEW_STATES[number];

/** Staff annotations are separate from users' records and planner snapshots. */
@Entity('hatask_record_review')
export class MiHataskRecordReview {
	@PrimaryColumn('varchar', { length: 64 })
	public id: string;

	@Index('IDX_hatask_review_user')
	@Column(id())
	public userId: string;

	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 16 })
	public state: HataskReviewState;

	@Column('varchar', { length: 64 })
	public contentVersion: string;

	@Column('integer')
	public revision: number;

	@Column({ ...id(), nullable: true })
	public reviewerId: string | null;

	@ManyToOne(() => MiUser, { onDelete: 'SET NULL' })
	@JoinColumn()
	public reviewer: MiUser | null;

	@Column('timestamp with time zone')
	public reviewedAt: Date;
}
