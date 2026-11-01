/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HatadintDraft = {
	version: 1;
	width: number;
	height: number;
	name: string;
	bg: 'white' | 'black' | 'transparent';
	active: number;
	layers: {
		id: number;
		name: string;
		visible: boolean;
		opacity: number;
		blend: 'normal' | 'multiply' | 'screen' | 'overlay';
		data: string;
	}[];
};

const MAX_DRAFT_LENGTH = 8_000_000;
const PNG_DATA_PREFIX = 'data:image/png;base64,';

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function name(value: unknown, min: number, max: number): value is string {
	return typeof value === 'string' && value.length >= min && value.length <= max && (min === 0 || value.trim().length > 0);
}

/** Validate the envelope; image decoding and dimensions are checked before restoration. */
function pngData(value: unknown): value is string {
	if (typeof value !== 'string' || !value.startsWith(PNG_DATA_PREFIX)) return false;
	const data = value.slice(PNG_DATA_PREFIX.length);
	return data.length > 0 && data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(data);
}

/** Does not touch storage or mutate the candidate/current drawing. */
export function validateHatadintDraft(value: unknown): HatadintDraft {
	if (!record(value) || value.version !== 1 || !integer(value.width, 1, 4096) || !integer(value.height, 1, 4096) || value.width * value.height > 4096 ** 2 || !name(value.name, 1, 60) || !['white', 'black', 'transparent'].includes(value.bg as string) || !Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > 32 || !integer(value.active, 0, value.layers.length - 1)) {
		throw new Error('Invalid Hatadint draft metadata');
	}
	const ids = new Set<number>();
	const layers = value.layers.map((layer: unknown): HatadintDraft['layers'][number] => {
		if (!record(layer) || !integer(layer.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(layer.id) || !name(layer.name, 0, 40) || typeof layer.visible !== 'boolean' || typeof layer.opacity !== 'number' || !Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1 || !['normal', 'multiply', 'screen', 'overlay'].includes(layer.blend as string) || !pngData(layer.data)) {
			throw new Error('Invalid Hatadint draft layer');
		}
		ids.add(layer.id);
		return {
			id: layer.id,
			name: layer.name,
			visible: layer.visible,
			opacity: layer.opacity,
			blend: layer.blend as HatadintDraft['layers'][number]['blend'],
			data: layer.data,
		};
	});
	return {
		version: 1,
		width: value.width,
		height: value.height,
		name: value.name,
		bg: value.bg as HatadintDraft['bg'],
		active: value.active,
		layers,
	};
}

export function hatadintDraftKey(accountId: string): string {
	if (typeof accountId !== 'string' || accountId.trim().length === 0) throw new Error('A Hatadint draft requires an account');
	return `hatadint:draft:${accountId}`;
}

/** Serialize fully before replacing an existing stored draft. */
export function serializeHatadintDraft(value: unknown): string {
	const raw = JSON.stringify(validateHatadintDraft(value));
	if (raw.length > MAX_DRAFT_LENGTH) throw new Error('Hatadint draft is too large');
	return raw;
}

export function parseHatadintDraft(raw: string): HatadintDraft {
	if (typeof raw !== 'string' || raw.length > MAX_DRAFT_LENGTH) throw new Error('Hatadint draft is too large');
	return validateHatadintDraft(JSON.parse(raw));
}
