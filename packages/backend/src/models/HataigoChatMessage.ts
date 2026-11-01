/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';

@Entity('hataigo_chat_message')
@Index('IDX_hataigo_chat_game_id', ['gameId', 'id'])
@Index('IDX_hataigo_chat_expires', ['expiresAt'])
export class MiHataigoChatMessage {
	@PrimaryColumn({ ...id(), primaryKeyConstraintName: 'PK_hataigo_chat_message' }) public id: string;
	@Column(id()) public gameId: string;
	@Column({ ...id(), nullable: true }) public userId: string | null;
	@Column('varchar', { length: 500, nullable: true }) public text: string | null;
	@Column('timestamp with time zone') public createdAt: Date;
	@Column('timestamp with time zone') public expiresAt: Date;
	@Column('varchar', { length: 100 }) public policyVersion: string;
	@Column('timestamp with time zone', { nullable: true }) public deletedAt: Date | null;
	@Column({ ...id(), nullable: true }) public deletedById: string | null;
	@Column('varchar', { length: 16, nullable: true }) public deletionReason: 'abuse' | 'spam' | 'other' | null;
}
