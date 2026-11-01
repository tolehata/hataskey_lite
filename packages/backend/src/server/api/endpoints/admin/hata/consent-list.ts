/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, UserProfilesRepository } from '@/models/_.js';

export const meta = {
	tags: ['admin', 'hata'],

	requireCredential: true,
	requireModerator: true,
	secure: true,

	kind: 'read:admin:show-user',

	res: {
		type: 'object',
		properties: {
			users: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'misskey:id' },
						username: { type: 'string' },
						name: { type: 'string', nullable: true },
						avatarUrl: { type: 'string', nullable: true },
						hataConsentExternalTl: { type: 'boolean' },
						hataConsentExternalTlDate: { type: 'string', format: 'date-time', nullable: true },
						hataConsentCustomFont: { type: 'boolean' },
						hataConsentCustomFontDate: { type: 'string', format: 'date-time', nullable: true },
						hataConsentMascot: { type: 'boolean' },
						hataConsentMascotDate: { type: 'string', format: 'date-time', nullable: true },
						hataConsentNoteCharm: { type: 'boolean' },
						hataConsentNoteCharmDate: { type: 'string', format: 'date-time', nullable: true },
						hataConsentDrawing: { type: 'boolean' },
						hataConsentDrawingDate: { type: 'string', format: 'date-time', nullable: true },
						hataConsentDrawingVersion: { type: 'string', nullable: true },
					},
					required: [
						'id', 'username', 'name', 'avatarUrl',
						'hataConsentExternalTl', 'hataConsentExternalTlDate',
						'hataConsentCustomFont', 'hataConsentCustomFontDate',
						'hataConsentMascot', 'hataConsentMascotDate',
						'hataConsentNoteCharm', 'hataConsentNoteCharmDate',
						'hataConsentDrawing', 'hataConsentDrawingDate', 'hataConsentDrawingVersion',
					],
				},
			},
			total: { type: 'integer' },
		},
		required: ['users', 'total'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
		offset: { type: 'integer', default: 0 },
		filter: {
			type: 'string',
			enum: ['all', 'externalTl', 'customFont', 'mascot', 'noteCharm', 'noteCharmPending', 'drawing', 'drawingPending'],
			default: 'all',
		},
		username: { type: 'string', nullable: true, default: null },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps) => {
			// まずローカルユーザーを取得（ユーザー名フィルタ含む）
			const userQuery = this.usersRepository.createQueryBuilder('user')
				.where('user.host IS NULL')
				.andWhere('user.isDeleted = false');

			if (ps.username) {
				userQuery.andWhere('user."usernameLower" LIKE :q', { q: `%${ps.username.toLowerCase()}%` });
			}

			const localUsers = await userQuery
				.orderBy('user.id', 'DESC')
				.getMany();

			if (localUsers.length === 0) {
				return { users: [], total: 0 };
			}

			const localUserIds = localUsers.map(u => u.id);

			// プロファイルを取得
			const profileQuery = this.userProfilesRepository.createQueryBuilder('profile')
				.where('profile."userId" IN (:...ids)', { ids: localUserIds });

			if (ps.filter === 'externalTl') {
				profileQuery.andWhere('profile."hataConsentExternalTl" = true');
			} else if (ps.filter === 'customFont') {
				profileQuery.andWhere('profile."hataConsentCustomFont" = true');
			} else if (ps.filter === 'mascot') {
				profileQuery.andWhere('profile."hataConsentMascot" = true');
			} else if (ps.filter === 'noteCharm') {
				profileQuery.andWhere('profile."hataConsentNoteCharm" = true');
			} else if (ps.filter === 'noteCharmPending') {
				profileQuery.andWhere('profile."hataConsentNoteCharm" = false');
			} else if (ps.filter === 'drawing') {
				profileQuery.andWhere('profile."hataConsentDrawing" = true');
			} else if (ps.filter === 'drawingPending') {
				profileQuery.andWhere('profile."hataConsentDrawing" = false');
			}

			const profiles = await profileQuery.getMany();
			const profileMap = new Map(profiles.map(p => [p.userId, p]));

			// フィルタ適用後のユーザーリスト
			let resultUsers = localUsers;
			if (ps.filter !== 'all') {
				resultUsers = localUsers.filter(u => profileMap.has(u.id));
			}

			const total = resultUsers.length;

			// ページネーション
			const paged = resultUsers.slice(ps.offset, ps.offset + ps.limit);

			return {
				users: paged.map(u => {
					const p = profileMap.get(u.id);
					return {
						id: u.id,
						username: u.username,
						name: u.name,
						avatarUrl: u.avatarUrl,
						hataConsentExternalTl: p?.hataConsentExternalTl ?? false,
						hataConsentExternalTlDate: p?.hataConsentExternalTlDate?.toISOString() ?? null,
						hataConsentCustomFont: p?.hataConsentCustomFont ?? false,
						hataConsentCustomFontDate: p?.hataConsentCustomFontDate?.toISOString() ?? null,
						hataConsentMascot: p?.hataConsentMascot ?? false,
						hataConsentMascotDate: p?.hataConsentMascotDate?.toISOString() ?? null,
						hataConsentNoteCharm: p?.hataConsentNoteCharm ?? false,
						hataConsentNoteCharmDate: p?.hataConsentNoteCharmDate?.toISOString() ?? null,
						hataConsentDrawing: p?.hataConsentDrawing ?? false,
						hataConsentDrawingDate: p?.hataConsentDrawingDate?.toISOString() ?? null,
						hataConsentDrawingVersion: p?.hataConsentDrawingVersion ?? null,
					};
				}),
				total,
			};
		});
	}
}
