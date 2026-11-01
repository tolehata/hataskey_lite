/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { hatagoesModalTransition, hatagoesWindowMotion } from './hatagoes-motion.js';

describe('HataGoes popup motion', () => {
	test('forces the short scoped transition even when the legacy animation setting is off', () => {
		expect(hatagoesModalTransition({ legacyAnimation: false, forceMotion: true, preset: 'dissolve', type: 'dialog', send: false })).toBe('hatagoes');
		expect(hatagoesWindowMotion(false, true)).toBe(true);
	});
	test('respects explicit instant close and preserves ordinary routes', () => {
		expect(hatagoesModalTransition({ legacyAnimation: false, forceMotion: true, preset: 'none', type: 'dialog', send: false })).toBe('');
		expect(hatagoesModalTransition({ legacyAnimation: false, forceMotion: false, preset: undefined, type: 'popup', send: false })).toBe('');
		expect(hatagoesModalTransition({ legacyAnimation: true, forceMotion: false, preset: undefined, type: 'popup', send: false })).toBe('modal-popup');
		expect(hatagoesWindowMotion(false, false)).toBe(false);
	});
});
