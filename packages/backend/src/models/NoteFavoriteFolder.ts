/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export const FAVORITE_FOLDER_COLORS = ['rose', 'amber', 'green', 'blue', 'violet', 'slate'] as const;
export type FavoriteFolderColor = typeof FAVORITE_FOLDER_COLORS[number];

@Entity('note_favorite_folder')
@Index('IDX_favorite_folder_root_name', ['userId', 'name'], { unique: true, where: '"parentId" IS NULL' })
@Index('IDX_favorite_folder_child_name', ['userId', 'parentId', 'name'], { unique: true, where: '"parentId" IS NOT NULL' })
export class MiNoteFavoriteFolder {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public parentId: MiNoteFavoriteFolder['id'] | null;

	@ManyToOne(type => MiNoteFavoriteFolder, { onDelete: 'CASCADE' })
	@JoinColumn()
	public parent: MiNoteFavoriteFolder | null;

	@Column('varchar', { length: 100 })
	public name: string;

	@Column('varchar', { length: 10, default: 'rose' })
	public color: FavoriteFolderColor;

	@Column('integer', { default: 0 })
	public position: number;
}
