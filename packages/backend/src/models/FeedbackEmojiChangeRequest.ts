/* SPDX-License-Identifier: AGPL-3.0-only */
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiDriveFile } from './DriveFile.js';
import { MiFeedbackEmojiRequest } from './FeedbackEmojiRequest.js';

export type EmojiChangeKind = 'updateImage' | 'withdraw';
export type EmojiChangeStatus = 'pending' | 'held' | 'approved' | 'rejected';
export type EmojiChangeSnapshot = { name: string; originalUrl: string; publicUrl: string; license: string | null; updatedAt: string | null };
export type EmojiChangeEvent = { status: EmojiChangeStatus; at: string; actorId: string; comment: string | null };

/** Changes never create a row in feedback_emoji_request (the weekly quota ledger). */
@Entity('feedback_emoji_change_request')
@Index('IDX_feedback_emoji_change_active', ['targetEmojiId'], { unique: true, where: `"status" IN ('pending', 'held')` })
@Check('CHK_feedback_emoji_change_kind', `"kind" IN ('updateImage', 'withdraw')`)
@Check('CHK_feedback_emoji_change_status', `"status" IN ('pending', 'held', 'approved', 'rejected')`)
export class MiFeedbackEmojiChangeRequest {
	@PrimaryColumn({ ...id(), primaryKeyConstraintName: 'PK_feedback_emoji_change' })
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone')
	public updatedAt: Date;

	@Index('IDX_feedback_emoji_change_owner')
	@Column(id())
	public requestedById: string;

	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ foreignKeyConstraintName: 'FK_feedback_emoji_change_owner' })
	public requestedBy: MiUser | null;

	@Index('IDX_feedback_emoji_change_original')
	@Column(id())
	public originalRequestId: string;

	@ManyToOne(() => MiFeedbackEmojiRequest, { onDelete: 'CASCADE' })
	@JoinColumn({ foreignKeyConstraintName: 'FK_feedback_emoji_change_original' })
	public originalRequest: MiFeedbackEmojiRequest | null;

	// No emoji FK: deleting an emoji must not erase its review history.
	@Column('varchar', { length: 128 })
	public targetEmojiId: string;

	@Column('varchar', { length: 16 })
	public kind: EmojiChangeKind;

	@Index('IDX_feedback_emoji_change_status')
	@Column('varchar', { length: 16, default: 'pending' })
	public status: EmojiChangeStatus;

	@Column('varchar', { length: 1024 })
	public reason: string;

	@Column({ ...id(), nullable: true })
	public fileId: string | null;

	@ManyToOne(() => MiDriveFile, { onDelete: 'SET NULL' })
	@JoinColumn({ foreignKeyConstraintName: 'FK_feedback_emoji_change_file' })
	public file: MiDriveFile | null;

	@Column('varchar', { length: 1024, nullable: true })
	public license: string | null;

	@Column('jsonb')
	public targetSnapshot: EmojiChangeSnapshot;

	@Column('varchar', { length: 512, nullable: true })
	public replacementImageUrl: string | null;

	@Column({ ...id(), nullable: true })
	public resolvedById: string | null;

	@Column('timestamp with time zone', { nullable: true })
	public resolvedAt: Date | null;

	@Column('varchar', { length: 1024, nullable: true })
	public resolvedComment: string | null;

	@Column('jsonb', { default: '[]' })
	public events: EmojiChangeEvent[];
}
