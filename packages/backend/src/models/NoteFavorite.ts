/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from './util/id.js';
import { MiNote } from './Note.js';
import { MiUser } from './User.js';
import { MiNoteFavoriteFolder } from './NoteFavoriteFolder.js';

@Entity('note_favorite')
@Index(['userId', 'noteId'], { unique: true })
export class MiNoteFavorite {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column(id())
	public noteId: MiNote['id'];

	@ManyToOne(type => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: MiNote | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public folderId: MiNoteFavoriteFolder['id'] | null;

	// Folder deletion must never remove a favorite or change its saved ID/date.
	@ManyToOne(type => MiNoteFavoriteFolder, { onDelete: 'SET NULL' })
	@JoinColumn()
	public folder: MiNoteFavoriteFolder | null;
}
