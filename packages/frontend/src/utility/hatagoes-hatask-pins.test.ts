/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { DEFAULT_HATAGOES_HATASK_PINS, normalizeHatagoesHataskPins, normalizeHatagoesHataskPinsDesktop } from './hatagoes-hatask-pins.js';

describe('Hatask capsule pins', () => {
	test('defaults to the five screens in the canonical mock', () => {
		expect(normalizeHatagoesHataskPins(undefined)).toEqual(DEFAULT_HATAGOES_HATASK_PINS);
	});

	test('keeps Today, allows four other Hatask screens, and preserves order', () => {
		expect(normalizeHatagoesHataskPins(['hatask.recipe', 'hatask.garden', 'hatask.recipe', 'hatady.records', 'hatask.todo', 'hatask.meal', 'hatask.cal'])).toEqual([
			'hatask.today', 'hatask.recipe', 'hatask.garden', 'hatask.todo', 'hatask.meal',
		]);
		expect(normalizeHatagoesHataskPins([])).toEqual(['hatask.today']);
	});

	test('excludes staff, actions, and mock-excluded screens', () => {
		expect(normalizeHatagoesHataskPins(['hatask.review', 'hatask.support-admin', 'hatask.appearance', 'hatask.scratchpad', 'hatask.api-console', 'hatask.cal'])).toEqual([
			'hatask.today', 'hatask.cal',
		]);
	});

	test('carries an old Hata Docs pin into HataIntro once on mobile and desktop', () => {
		const saved = ['hatask.hata-docs', 'hatask.cal', 'hatask.intro', 'hatask.todo'];
		const expected = ['hatask.today', 'hatask.intro', 'hatask.cal', 'hatask.todo'];
		expect(normalizeHatagoesHataskPins(saved)).toEqual(expected);
		expect(normalizeHatagoesHataskPinsDesktop(saved)).toEqual(expected);
		expect(normalizeHatagoesHataskPinsDesktop(undefined, saved)).toEqual(expected);
	});

	test('desktop keeps five choices plus Today and falls back to mobile without writing', () => {
		const mobile = ['hatask.today', 'hatask.recipe', 'hatask.garden', 'hatask.todo', 'hatask.meal'];
		expect(normalizeHatagoesHataskPinsDesktop(undefined, mobile)).toEqual(mobile);
		expect(normalizeHatagoesHataskPinsDesktop([...mobile, 'hatask.cal', 'hatask.mood'])).toEqual([...mobile, 'hatask.cal']);
		expect(normalizeHatagoesHataskPins(mobile)).toEqual(mobile);
	});
});
