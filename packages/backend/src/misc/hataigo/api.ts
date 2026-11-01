/*
	* SPDX-FileCopyrightText: Tolehata and hatasaba-project
	* SPDX-License-Identifier: AGPL-3.0-only
	*/

import { getIpHash } from '@/misc/get-ip-hash.js';
import type { HataigoService } from '@/core/HataigoService.js';
import type { MiUser } from '@/models/User.js';
import { ApiError } from '@/server/api/error.js';
import { HataigoError } from './types.js';

export const hataigoApiErrors = {
	unavailable: { message: 'This game is unavailable.', code: 'HATAIGO_UNAVAILABLE', id: '887e0aa1-1eac-48eb-8ff6-bc99ee6c4fab', httpStatusCode: 404 },
	invalid: { message: 'The game operation was rejected.', code: 'HATAIGO_INVALID_ACTION', id: '8e697dab-ab46-454f-9168-92ed2af2de10' },
} as const;

export function hataigoErrorCode(error: unknown): string {
	if (!(error instanceof HataigoError)) return 'INTERNAL_ERROR';
	return error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN' ? 'HATAIGO_UNAVAILABLE' : `HATAIGO_${error.code}`;
}

export async function hataigoApi<T>(action: () => Promise<T>): Promise<T> {
	try { return await action(); } catch (error) {
		if (!(error instanceof HataigoError)) throw error;
		const code = hataigoErrorCode(error);
		if (code === 'HATAIGO_UNAVAILABLE') throw new ApiError(hataigoApiErrors.unavailable);
		throw new ApiError({ ...hataigoApiErrors.invalid, code, httpStatusCode: error.code === 'RATE_LIMIT' ? 429 : 400 });
	}
}

/** HTTP reads share one fixed quota; stream permission rechecks deliberately do not consume it. */
export async function hataigoReadQuota(games: Pick<HataigoService, 'rateLimit'>, user: Pick<MiUser, 'id'> | null, ip?: string | null): Promise<void> {
	await games.rateLimit(user?.id ?? `ip:${getIpHash(ip ?? '0.0.0.0')}`, 'read', 120, 60000);
}

export const hataigoPointSchema = {
	type: 'object', additionalProperties: false,
	properties: { x: { type: 'integer', minimum: 0, maximum: 18 }, y: { type: 'integer', minimum: 0, maximum: 18 } }, required: ['x', 'y'],
} as const;
export const hataigoActionSchema = {
	oneOf: [
		{ type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['play'] }, point: hataigoPointSchema }, required: ['type', 'point'] },
		{ type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['setScoring'] }, marks: {
			type: 'object', additionalProperties: false, properties: {
				deadStones: { type: 'array', maxItems: 361, items: hataigoPointSchema }, neutralPoints: { type: 'array', maxItems: 361, items: hataigoPointSchema },
			}, required: ['deadStones', 'neutralPoints'],
		} }, required: ['type', 'marks'] },
		{ type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['pass', 'resign', 'acceptScore', 'requestResume', 'acceptNoResult'] } }, required: ['type'] },
	],
} as const;
export const hataigoSettingsSchema = {
	type: 'object', additionalProperties: false,
	properties: {
		size: { type: 'integer', minimum: 9, maximum: 19 }, handicap: { type: 'integer', minimum: 0, maximum: 9 }, komi: { type: 'number', minimum: 0, maximum: 7.5 }, rules: { type: 'string', enum: ['japanese'] },
		allowSpectate: { type: 'boolean' }, allowSpectatorChat: { type: 'boolean' }, publicAfterEnd: { type: 'boolean' },
		announcement: { type: 'object', additionalProperties: false, properties: {
			enabled: { type: 'boolean' }, visibility: { type: 'string', enum: ['home', 'followers', 'public'] }, allowName: { type: 'boolean' },
		}, required: [] },
		clock: { oneOf: [
			{ type: 'object', additionalProperties: false, properties: { kind: { type: 'string', enum: ['byoyomi'] }, mainSec: { type: 'integer', minimum: 300, maximum: 1200 }, periodSec: { type: 'integer', minimum: 30, maximum: 30 }, periods: { type: 'integer', minimum: 3, maximum: 5 } }, required: ['kind', 'mainSec', 'periodSec', 'periods'] },
			{ type: 'object', additionalProperties: false, properties: { kind: { type: 'string', enum: ['correspondence'] }, perMoveSec: { type: 'integer', minimum: 86400, maximum: 86400 } }, required: ['kind', 'perMoveSec'] },
		] },
	}, required: [],
} as const;
