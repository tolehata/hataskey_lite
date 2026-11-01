/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import type { UserProfilesRepository } from '@/models/_.js';

export const DRAWING_CONSENT_VERSION = '2026-09-09';

export const meta = {
	tags: ['hata'],

	requireCredential: true,

	// 旗鯖fork: 法的同意フラグの改ざん防止のため secure: true を必須化
	// (3rd party トークン経由での書き換えを拒否し、Web セッション本人のみ通過)
	secure: true,

	kind: 'write:account',

	limit: {
		duration: ms('1hour'),
		max: 60,
		minInterval: ms('1sec'),
	},

	errors: {
		consentCannotBeRevoked: {
			message: 'The initial Hatadint consent record cannot be revoked.',
			code: 'CONSENT_CANNOT_BE_REVOKED',
			id: '1db7d08d-a4c4-4bde-a4cc-4e5c5a3be989',
		},
	},

	res: {
		type: 'object',
		nullable: false, optional: false,
		properties: {
			ok: { type: 'boolean', nullable: false, optional: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		type: {
			type: 'string',
			enum: ['externalTl', 'customFont', 'mascot', 'noteCharm', 'drawing'],
		},
		agree: { type: 'boolean' },
	},
	required: ['type', 'agree'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const now = new Date();

			if (ps.type === 'externalTl') {
				await this.userProfilesRepository.update(me.id, {
					hataConsentExternalTl: ps.agree,
					hataConsentExternalTlDate: ps.agree ? now : null,
				});
			} else if (ps.type === 'customFont') {
				await this.userProfilesRepository.update(me.id, {
					hataConsentCustomFont: ps.agree,
					hataConsentCustomFontDate: ps.agree ? now : null,
				});
			} else if (ps.type === 'mascot') {
				await this.userProfilesRepository.update(me.id, {
					hataConsentMascot: ps.agree,
					hataConsentMascotDate: ps.agree ? now : null,
				});
			} else if (ps.type === 'noteCharm') {
				await this.userProfilesRepository.update(me.id, {
					hataConsentNoteCharm: ps.agree,
					hataConsentNoteCharmDate: ps.agree ? now : null,
				});
			} else {
				if (!ps.agree) throw new ApiError(meta.errors.consentCannotBeRevoked);
				// 同時リクエストでも最初の記録だけを残す。版の変更は再同意の条件にしない。
				await this.userProfilesRepository.update({ userId: me.id, hataConsentDrawing: false }, {
					hataConsentDrawing: true,
					hataConsentDrawingDate: now,
					hataConsentDrawingVersion: DRAWING_CONSENT_VERSION,
				});
			}

			return { ok: true };
		});
	}
}
