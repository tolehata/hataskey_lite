/* SPDX-License-Identifier: AGPL-3.0-only */
import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { MiUser } from './User.js';

@Entity('hatask_drop_wallet')
@Check('"drops" BETWEEN 0 AND 20')
export class MiHataskDropWallet {
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@Column('integer', { default: 0 })
	public drops: number;
	@Column('varchar', { length: 80, nullable: true })
	public timezone: string | null;
	@Column('jsonb', { nullable: true })
	public flower: unknown | null;
	@Column('jsonb', { default: '[]' })
	public seeds: unknown;
	@Column('jsonb', { default: '[]' })
	public rareSeeds: unknown;
	@Column('timestamptz', { nullable: true })
	public flowerCollectionCompletedAt: Date | null;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_drop_ledger')
@Index(['userId', 'day', 'source'])
export class MiHataskDropLedger {
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@PrimaryColumn('varchar', { length: 16 })
	public source: string;
	@PrimaryColumn('varchar', { length: 128 })
	public sourceId: string;
	@Column('varchar', { length: 10 })
	public day: string;
	@Column('text', { nullable: true })
	public title: string | null;
	@Column('timestamptz', { default: () => 'now()' })
	public createdAt: Date;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_flower_todo')
export class MiHataskFlowerTodo {
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@PrimaryColumn('varchar', { length: 128 })
	public id: string;
	@Column('timestamptz', { default: () => 'now()' })
	public createdAt: Date;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_flower_harvest')
@Index('IDX_hatask_flower_harvest_user_season_species', ['userId', 'season', 'speciesId'])
export class MiHataskFlowerHarvest {
	@PrimaryColumn('varchar', { length: 64 })
	public id: string;
	@Column('varchar', { length: 32 })
	public userId: string;
	@Column('varchar', { length: 80 })
	public speciesId: string;
	@Column('varchar', { length: 8 })
	public season: string;
	@Column('jsonb')
	public entry: unknown;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_flower_discovery')
@Index(['speciesId', 'rank'], { unique: true })
export class MiHataskFlowerDiscovery {
	@PrimaryColumn('varchar', { length: 80 })
	public speciesId: string;
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@Column('integer')
	public rank: number;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_flower_festival')
export class MiHataskFlowerFestival {
	@PrimaryColumn('varchar', { length: 32 })
	public id: string;
	@Column('varchar', { length: 8 })
	public season: string;
	@Column('integer')
	public goal: number;
	@Column('integer', { default: 0 })
	public total: number;
	@Column('timestamptz')
	public startsAt: Date;
	@Column('timestamptz')
	public endsAt: Date;
	@Column('timestamptz', { nullable: true })
	public bloomedAt: Date | null;
}

@Entity('hatask_flower_participant')
export class MiHataskFlowerParticipant {
	@PrimaryColumn('varchar', { length: 32 })
	public festivalId: string;
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@Column('integer', { default: 1 })
	public count: number;
	@Column('timestamptz', { default: () => 'now()' })
	public updatedAt: Date;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
	@ManyToOne(() => MiHataskFlowerFestival, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'festivalId' })
	public festival: MiHataskFlowerFestival | null;
}

@Entity('hatask_flower_request')
export class MiHataskFlowerRequest {
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@PrimaryColumn('varchar', { length: 128 })
	public id: string;
	@Column('varchar', { length: 16 })
	public target: string;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

@Entity('hatask_flower_notice')
export class MiHataskFlowerNotice {
	@PrimaryColumn('varchar', { length: 32 })
	public userId: string;
	@PrimaryColumn('varchar', { length: 32 })
	public type: string;
	@PrimaryColumn('varchar', { length: 64 })
	public sourceId: string;
	@Column('timestamptz', { nullable: true })
	public sentAt: Date | null;
	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	public user: MiUser | null;
}

