/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { deepEqual } from './deep-equal.js';

describe('deepEqual', () => {
	test('matches null with null', () => {
		expect(deepEqual(null, null)).toBe(true);
	});

	test('distinguishes null from undefined in both directions', () => {
		expect(deepEqual(undefined, null)).toBe(false);
		expect(deepEqual(null, undefined)).toBe(false);
	});

	test.each([
		{ kind: 'object', value: {} },
		{ kind: 'array', value: [] },
		{ kind: 'map', value: new Map<string, null>() },
	])('distinguishes null from an empty $kind in both directions', ({ value }) => {
		expect(deepEqual(value, null)).toBe(false);
		expect(deepEqual(null, value)).toBe(false);
	});

	test.each([
		{ kind: 'record', before: { value: {} }, after: { value: null } },
		{ kind: 'array', before: [{}], after: [null] },
		{ kind: 'map', before: new Map([['value', {}]]), after: new Map([['value', null]]) },
	])('detects a nested null transition in a $kind in both directions', ({ before, after }) => {
		expect(deepEqual(before, after)).toBe(false);
		expect(deepEqual(after, before)).toBe(false);
	});

	test.each(['lightTheme', 'darkTheme'])('detects a %s null transition in both directions', (key) => {
		const before = { [key]: null };
		const after = { [key]: { id: 'theme', name: 'Theme', props: { accent: '#123456' } } };

		expect(deepEqual(after, before)).toBe(false);
		expect(deepEqual(before, after)).toBe(false);
	});

	test('matches equal arrays with nullable values', () => {
		expect(deepEqual([null, { value: null }], [null, { value: null }])).toBe(true);
	});

	test('matches equal records with nullable values', () => {
		expect(deepEqual({ value: null, nested: { value: null } }, { value: null, nested: { value: null } })).toBe(true);
	});

	test('matches equal maps with nullable values', () => {
		expect(deepEqual(new Map([['value', null]]), new Map([['value', null]]))).toBe(true);
	});

	test('detects different nested values beside matching nulls', () => {
		const before = { items: [null, { value: 'before' }] };
		const after = { items: [null, { value: 'after' }] };

		expect(deepEqual(before, after)).toBe(false);
		expect(deepEqual(after, before)).toBe(false);
	});
});
