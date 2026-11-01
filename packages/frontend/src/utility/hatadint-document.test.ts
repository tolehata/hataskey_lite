/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { hatadintDraftKey, parseHatadintDraft, serializeHatadintDraft, validateHatadintDraft } from './hatadint-document.js';
import type { HatadintDraft } from './hatadint-document.js';

const PNG_DATA_PREFIX = 'data:image/png;base64,';
const PNG = `${PNG_DATA_PREFIX}iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=`;

function draft(): HatadintDraft {
	return {
		version: 1,
		width: 800,
		height: 600,
		name: '春の空',
		bg: 'transparent',
		active: 0,
		layers: [{ id: 1, name: '線画', visible: true, opacity: 1, blend: 'normal', data: PNG }],
	};
}

describe('Hatadint draft validation', () => {
	test('round-trips dimensions, title and all layer metadata', () => {
		const source = draft();
		source.active = 1;
		source.layers.push({ ...source.layers[0], id: 2, name: '色', visible: false, opacity: 0.25, blend: 'multiply' });
		expect(parseHatadintDraft(serializeHatadintDraft(source))).toEqual(source);
	});

	test('returns a separate draft and layer list without retaining unknown fields', () => {
		const source = { ...draft(), extra: 'not a drawing field' };
		const copy = validateHatadintDraft(source);
		expect(copy).not.toBe(source);
		expect(copy.layers).not.toBe(source.layers);
		expect(copy.layers[0]).not.toBe(source.layers[0]);
		expect(copy).not.toHaveProperty('extra');
		copy.layers[0].name = 'changed';
		expect(source.layers[0].name).toBe('線画');
	});

	test.each([null, undefined, [], 'drawing', 1, false])('rejects a non-document value %s', value => {
		expect(() => validateHatadintDraft(value)).toThrow();
	});

	test.each([0, 2, '1', undefined])('rejects an unsupported version %s', version => {
		expect(() => validateHatadintDraft({ ...draft(), version })).toThrow();
	});

	test.each([0, 4097, 800.5, NaN, Infinity, '800'])('rejects an invalid width or height %s', size => {
		expect(() => validateHatadintDraft({ ...draft(), width: size })).toThrow();
		expect(() => validateHatadintDraft({ ...draft(), height: size })).toThrow();
	});

	test('accepts the dimension limits and maximum pixel budget', () => {
		expect(validateHatadintDraft({ ...draft(), width: 1, height: 1 }).width).toBe(1);
		expect(validateHatadintDraft({ ...draft(), width: 4096, height: 4096 }).height).toBe(4096);
	});

	test.each(['', ' \n\t', 'a'.repeat(61), null])('rejects an empty or overlong document name %s', name => {
		expect(() => validateHatadintDraft({ ...draft(), name })).toThrow();
	});

	test('accepts a sixty-character title without changing it', () => {
		const name = '絵'.repeat(60);
		expect(validateHatadintDraft({ ...draft(), name }).name).toBe(name);
	});

	test.each(['white', 'black', 'transparent'])('accepts the %s background', bg => {
		expect(validateHatadintDraft({ ...draft(), bg }).bg).toBe(bg);
	});

	test('rejects unsupported backgrounds', () => {
		expect(() => validateHatadintDraft({ ...draft(), bg: '#ffffff' })).toThrow();
	});

	test('requires at least one layer and permits no more than 32', () => {
		const source = draft();
		expect(() => validateHatadintDraft({ ...source, layers: [] })).toThrow();
		source.layers = Array.from({ length: 32 }, (_, index) => ({ ...source.layers[0], id: index + 1 }));
		expect(validateHatadintDraft(source).layers).toHaveLength(32);
		source.layers.push({ ...source.layers[0], id: 33 });
		expect(() => validateHatadintDraft(source)).toThrow();
	});

	test.each([-1, 1, 0.5, NaN, '0'])('rejects an active layer index outside the actual list %s', active => {
		expect(() => validateHatadintDraft({ ...draft(), active })).toThrow();
	});

	test.each([0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '1'])('rejects an invalid layer ID %s', id => {
		const source = draft();
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], id }] })).toThrow();
	});

	test('rejects duplicate IDs even if the corresponding layer data differs', () => {
		const source = draft();
		source.layers.push({ ...source.layers[0], name: 'duplicate' });
		expect(() => validateHatadintDraft(source)).toThrow();
	});

	test('allows unnamed layers and up to forty characters but rejects longer names', () => {
		const source = draft();
		for (const name of ['', '字'.repeat(40)]) {
			expect(validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], name }] }).layers[0].name).toBe(name);
		}
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], name: '字'.repeat(41) }] })).toThrow();
	});

	test.each([-0.1, 1.1, NaN, Infinity, '0.5'])('rejects invalid layer opacity %s', opacity => {
		const source = draft();
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], opacity }] })).toThrow();
	});

	test('preserves invisible and fully transparent layers for later edits', () => {
		const source = draft();
		source.layers[0].visible = false;
		source.layers[0].opacity = 0;
		expect(parseHatadintDraft(serializeHatadintDraft(source))).toEqual(source);
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], visible: 0 }] })).toThrow();
	});

	test.each(['normal', 'multiply', 'screen', 'overlay'])('preserves the supported %s blend mode', blend => {
		const source = draft();
		expect(validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], blend }] }).layers[0].blend).toBe(blend);
	});

	test('rejects unsupported blend modes', () => {
		const source = draft();
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], blend: 'destination-out' }] })).toThrow();
	});

	test.each(['https://example.invalid/image.png', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,AAAA', PNG_DATA_PREFIX, `${PNG_DATA_PREFIX}AAAA A==`, `${PNG_DATA_PREFIX}A===`, `${PNG_DATA_PREFIX}AA=A`, `${PNG_DATA_PREFIX}AAA`, `${PNG_DATA_PREFIX}____`])('rejects an external or malformed PNG data URL %s', data => {
		const source = draft();
		expect(() => validateHatadintDraft({ ...source, layers: [{ ...source.layers[0], data }] })).toThrow();
	});

	test('rejects invalid JSON and applies schema validation after JSON parsing', () => {
		expect(() => parseHatadintDraft('{broken')).toThrow();
		expect(() => parseHatadintDraft(JSON.stringify({ ...draft(), active: 100 }))).toThrow();
	});

	test('rejects oversized serialized drafts before the caller replaces stored data', () => {
		const source = draft();
		const previous = serializeHatadintDraft(source);
		let stored = previous;
		source.layers[0].data = PNG_DATA_PREFIX + 'A'.repeat(8_000_000);
		expect(() => { stored = serializeHatadintDraft(source); }).toThrow('too large');
		expect(stored).toBe(previous);
		expect(() => parseHatadintDraft(' '.repeat(8_000_001))).toThrow('too large');
	});

	test('accepts exactly the maximum serialized length', () => {
		const source = draft();
		source.layers[0].data = PNG_DATA_PREFIX + 'AAAA';
		const length = serializeHatadintDraft(source).length;
		const extraCharacters = (8_000_000 - length) % 4;
		source.name += 'a'.repeat(extraCharacters);
		source.layers[0].data += 'A'.repeat(8_000_000 - length - extraCharacters);
		const raw = serializeHatadintDraft(source);
		expect(raw.length).toBe(8_000_000);
		expect(parseHatadintDraft(raw).name).toBe(source.name);
	});
});

describe('Hatadint draft account keys', () => {
	test('isolates draft keys by account without touching mock storage keys', () => {
		expect(hatadintDraftKey('account-a')).toBe('hatadint:draft:account-a');
		expect(hatadintDraftKey('account-b')).toBe('hatadint:draft:account-b');
		expect(hatadintDraftKey('account-a')).not.toBe(hatadintDraftKey('account-b'));
	});

	test.each(['', ' ', '\t\n'])('rejects empty account identifiers %s', accountId => {
		expect(() => hatadintDraftKey(accountId)).toThrow();
	});
});
