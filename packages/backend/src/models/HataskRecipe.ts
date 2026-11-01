/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiDriveFile } from './DriveFile.js';

export const HATASK_RECIPE_CATEGORIES = ['main', 'side', 'soup', 'staple', 'dessert'] as const;
export type HataskRecipeCategory = typeof HATASK_RECIPE_CATEGORIES[number];

/** Recipes and cooking records are never federated; only local audiences exist. */
export const HATASK_RECIPE_VISIBILITIES = ['private', 'followers', 'specified'] as const;
export type HataskRecipeVisibility = typeof HATASK_RECIPE_VISIBILITIES[number];

export type HataskRecipeIngredient = {
	name: string;
	/** Free text such as "300g" or "大さじ2"; the viewer scales the first number it contains. */
	amount: string;
};

export type HataskRecipeStep = {
	text: string;
	timerSeconds: number | null;
	timerLabel: string;
};

export type HataskRecipeReferenceLink = {
	title: string;
	url: string;
};

@Entity('hatask_recipe')
@Index('IDX_hatask_recipe_userId_updatedAt', ['userId', 'updatedAt'])
export class MiHataskRecipe {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone')
	public updatedAt: Date;

	@Index('IDX_hatask_recipe_userId')
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 128 })
	public title: string;

	@Column('varchar', { length: 512, default: '' })
	public summary: string;

	@Column('varchar', { length: 16, default: 'main' })
	public category: HataskRecipeCategory;

	@Column('smallint', { default: 2, comment: 'The number of servings the amounts are written for.' })
	public servings: number;

	@Column('smallint', { nullable: true, comment: 'Approximate total minutes.' })
	public minutes: number | null;

	@Column('boolean', { default: true, comment: 'Whether viewers may rescale ingredient amounts.' })
	public scalable: boolean;

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public ingredients: HataskRecipeIngredient[];

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public steps: HataskRecipeStep[];

	@Column('jsonb', { default: () => '\'[]\'::jsonb' })
	public referenceLinks: HataskRecipeReferenceLink[];

	@Column('varchar', { length: 32, array: true, default: '{}' })
	public tags: string[];

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
	public visibility: HataskRecipeVisibility;

	@Column('varchar', { length: 32, array: true, default: '{}' })
	public visibleUserIds: string[];

	@Column('boolean', { default: false })
	public isDraft: boolean;
}
