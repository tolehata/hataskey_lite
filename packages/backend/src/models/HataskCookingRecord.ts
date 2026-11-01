/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiDriveFile } from './DriveFile.js';
import { HATASK_RECIPE_VISIBILITIES, MiHataskRecipe } from './HataskRecipe.js';
import { MiHatadyLog } from './HatadyLog.js';

export const HATASK_COOKING_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type HataskCookingMealSlot = typeof HATASK_COOKING_MEAL_SLOTS[number];

export const HATASK_COOKING_VISIBILITIES = ['public', ...HATASK_RECIPE_VISIBILITIES] as const;
export type HataskCookingVisibility = typeof HATASK_COOKING_VISIBILITIES[number];

@Entity('hatask_cooking_record')
@Index('IDX_hatask_cooking_record_userId_cookedAt', ['userId', 'cookedAt'])
export class MiHataskCookingRecord {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone')
	public cookedAt: Date;

	@Index('IDX_hatask_cooking_record_userId')
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Index('IDX_hatask_cooking_record_recipeId')
	@Column({
		...id(),
		nullable: true,
	})
	public recipeId: MiHataskRecipe['id'] | null;

	@ManyToOne(type => MiHataskRecipe, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public recipe: MiHataskRecipe | null;

	@Column('varchar', { length: 128, comment: 'Recipe title at the time of cooking.' })
	public title: string;

	@Column('integer', { nullable: true })
	public durationSeconds: number | null;

	@Column('smallint', { default: 2 })
	public servings: number;

	@Column('varchar', { length: 16, nullable: true })
	public mealSlot: HataskCookingMealSlot | null;

	@Column('integer', { nullable: true, comment: 'Ingredient cost in yen.' })
	public cost: number | null;

	@Column('varchar', { length: 2000, default: '' })
	public memo: string;

	@Column({
		...id(),
		nullable: true,
	})
	public fileId: MiDriveFile['id'] | null;

	@ManyToOne(type => MiDriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public file: MiDriveFile | null;

	@Column('varchar', { length: 16, default: 'private' })
	public visibility: HataskCookingVisibility;

	@Column('varchar', { length: 32, array: true, default: '{}' })
	public visibleUserIds: string[];

	@Column({
		...id(),
		nullable: true,
		comment: 'The mirrored Hatady cooking log.',
	})
	public hatadyLogId: MiHatadyLog['id'] | null;

	@ManyToOne(type => MiHatadyLog, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public hatadyLog: MiHatadyLog | null;
}
