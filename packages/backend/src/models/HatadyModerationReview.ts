/* SPDX-License-Identifier: AGPL-3.0-only */
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export const HATADY_MODERATION_TARGETS = ['book', 'log', 'comment', 'reaction', 'mediaWork', 'mediaSession', 'mediaComment', 'mediaReaction'] as const;
export type HatadyModerationTarget = typeof HATADY_MODERATION_TARGETS[number];
export const HATADY_MODERATION_STATES = ['unreviewed', 'flagged', 'reviewed'] as const;
export type HatadyModerationState = typeof HATADY_MODERATION_STATES[number];

/** Shared staff annotations; source content is never copied or modified here. */
@Entity('hatady_moderation_review')
export class MiHatadyModerationReview {
	@PrimaryColumn('varchar', { length: 16 })
	public targetType: HatadyModerationTarget;

	@PrimaryColumn(id())
	public targetId: string;

	@Index()
	@Column('varchar', { length: 16, default: 'unreviewed' })
	public state: HatadyModerationState;

	@Column('varchar', { length: 1000, default: '' })
	public note: string;

	@Column('integer', { default: 1 })
	public revision: number;

	@Column('varchar', { length: 64 })
	public contentVersion: string;

	@Column({ ...id(), nullable: true })
	public reviewerId: string | null;

	@ManyToOne(() => MiUser, { onDelete: 'SET NULL' })
	@JoinColumn()
	public reviewer: MiUser | null;

	@Column('timestamp with time zone')
	public reviewedAt: Date;
}
