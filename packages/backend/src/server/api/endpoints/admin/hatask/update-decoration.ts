/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { AvatarDecorationService, HataskAvatarDecorationUpdateError } from '@/core/AvatarDecorationService.js';
import { parseAvatarDecorationDate } from '@/core/avatar-decoration-availability.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['admin', 'hatask'],
	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:avatar-decorations',
	limit: { duration: 60 * 1000, max: 30 },
	errors: {
		noSuchDecoration: { message: 'No such local avatar decoration.', code: 'NO_SUCH_AVATAR_DECORATION', id: '795cc2a5-4aa4-4e24-acd5-289eb57b9306' },
		invalidPeriod: { message: 'The availability period is invalid.', code: 'INVALID_AVATAR_DECORATION_PERIOD', id: '493aaf5d-73af-440a-8295-484a61fba0e4' },
		invalidReplacement: { message: 'The avatar decoration replacement is invalid.', code: 'INVALID_AVATAR_DECORATION_REPLACEMENT', id: 'cb741a4b-ef61-454b-8d73-c01dba1ece93' },
		replacementConflict: { message: 'The avatar decoration reward settings have changed. Reload before replacing.', code: 'AVATAR_DECORATION_REPLACEMENT_CONFLICT', id: '8c5fdddb-0777-43dd-a250-e90f836b5d51', httpStatusCode: 409 },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', format: 'misskey:id' },
		replaceFromId: { type: 'string', format: 'misskey:id' },
		requiresHataskFlowerCompletion: { type: 'boolean' },
		availableFrom: { type: 'string', nullable: true, maxLength: 35 },
		availableUntil: { type: 'string', nullable: true, maxLength: 35 },
	},
	required: ['id', 'requiresHataskFlowerCompletion', 'availableFrom', 'availableUntil'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: AvatarDecorationService) {
		super(meta, paramDef, async (ps, me) => {
			const availableFrom = ps.availableFrom == null ? null : parseAvatarDecorationDate(ps.availableFrom);
			const availableUntil = ps.availableUntil == null ? null : parseAvatarDecorationDate(ps.availableUntil);
			if ((ps.availableFrom != null && availableFrom == null) || (ps.availableUntil != null && availableUntil == null)
				|| (availableFrom != null && availableUntil != null && availableFrom >= availableUntil)) {
				throw new ApiError(meta.errors.invalidPeriod);
			}
			try {
				await this.service.configureHataskDecoration(ps.id, { requiresHataskFlowerCompletion: ps.requiresHataskFlowerCompletion, availableFrom, availableUntil }, me, ps.replaceFromId);
			} catch (error) {
				if (error instanceof HataskAvatarDecorationUpdateError) {
					throw new ApiError(error.reason === 'notFound' ? meta.errors.noSuchDecoration : meta.errors[error.reason]);
				}
				throw error;
			}
			await this.service.removeUnavailableDecorations(ps.id);
		});
	}
}
