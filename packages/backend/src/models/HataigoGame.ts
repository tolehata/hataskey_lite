/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GameResult } from '@/misc/hataigo/rules/game.js';
import type { ClockState } from '@/misc/hataigo/clock.js';
import type { HataigoAnnouncements, HataigoAnnouncementStates, HataigoPhase, HataigoSettings, HataigoVisibility, StoredHataigoAction } from '@/misc/hataigo/types.js';
import { id } from './util/id.js';

@Entity('hataigo_game')
@Index(['user1Id', 'phase'])
@Index(['user2Id', 'phase'])
@Index(['phase', 'deadlineAt'])
export class MiHataigoGame {
	@PrimaryColumn(id()) public id: string;
	@Column('timestamp with time zone') public createdAt: Date;
	@Column('timestamp with time zone', { nullable: true }) public startedAt: Date | null;
	@Column('timestamp with time zone', { nullable: true }) public endedAt: Date | null;
	@Column({ ...id(), nullable: true }) public user1Id: string | null;
	@Column({ ...id(), nullable: true }) public user2Id: string | null;
	@Column('smallint', { nullable: true }) public black: 1 | 2 | null;
	@Column('varchar', { length: 16, default: 'waiting' }) public phase: HataigoPhase;
	@Column('jsonb') public settings: HataigoSettings;
	@Column('boolean', { default: false }) public user1Ready: boolean;
	@Column('boolean', { default: false }) public user2Ready: boolean;
	@Column('boolean', { default: false }) public isInvitation: boolean;
	@Column('boolean', { default: true }) public invitationAccepted: boolean;
	@Column('jsonb', { nullable: true }) public result: GameResult | null;
	@Column('jsonb', { default: [] }) public actions: StoredHataigoAction[];
	@Column('jsonb', { nullable: true }) public clockState: ClockState | null;
	@Column('timestamp with time zone', { nullable: true }) public deadlineAt: Date | null;
	@Column('jsonb') public visibility: HataigoVisibility;
	@Column('jsonb', { default: { user1: { enabled: false, visibility: 'home', allowName: false }, user2: { enabled: false, visibility: 'home', allowName: false } } }) public announcements: HataigoAnnouncements;
	@Column('jsonb', { default: { user1: { status: 'none', text: null, noteId: null, attempts: 0, nextAttemptAtMs: 0, lastError: null }, user2: { status: 'none', text: null, noteId: null, attempts: 0, nextAttemptAtMs: 0, lastError: null } } }) public announcementState: HataigoAnnouncementStates;
	@Column('boolean', { default: false }) public allowSpectate: boolean;
	@Column('boolean', { default: false }) public allowSpectatorChat: boolean;
	@Column('boolean', { default: false }) public publicAfterEnd: boolean;
	@Column('integer', { default: 0 }) public revision: number;
}
