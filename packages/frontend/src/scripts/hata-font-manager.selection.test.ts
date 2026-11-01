/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { prefer } from '@/preferences.js';
import {
	applyHataFont,
	DEFAULT_HATA_FONT_ID,
	HATA_FONT_PRESETS,
	initHataFontWatcher,
	resolveHataFontId,
} from './hata-font-manager.js';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	const initial = {
		'hataFont.id': 'line-seed-jp',
		'hataFont.customUrl': '',
		'hataFont.customName': '',
		'hataFont.customFontConsent': false,
	};
	return {
		prefer: {
			s: { ...initial },
			r: Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, ref(value)])),
		},
	};
});

type FontPrefKey = 'hataFont.id' | 'hataFont.customUrl' | 'hataFont.customName' | 'hataFont.customFontConsent';
const happyDOMSettings = (window as unknown as { happyDOM: { settings: {
	disableCSSFileLoading: boolean;
	handleDisabledFileLoadingAsSuccess: boolean;
} } }).happyDOM.settings;
let previousCSSFileLoading: boolean;
let previousDisabledFileLoadingAsSuccess: boolean;

function setFontPref(key: FontPrefKey, value: string | boolean): void {
	(prefer.s as Record<string, unknown>)[key] = value;
	(prefer.r as Record<string, { value: unknown }>)[key].value = value;
}

describe('Hataskey UI font selection', () => {
	beforeAll(() => {
		previousCSSFileLoading = happyDOMSettings.disableCSSFileLoading;
		previousDisabledFileLoadingAsSuccess = happyDOMSettings.handleDisabledFileLoadingAsSuccess;
		happyDOMSettings.disableCSSFileLoading = true;
		happyDOMSettings.handleDisabledFileLoadingAsSuccess = true;
	});

	afterAll(() => {
		happyDOMSettings.disableCSSFileLoading = previousCSSFileLoading;
		happyDOMSettings.handleDisabledFileLoadingAsSuccess = previousDisabledFileLoadingAsSuccess;
	});

	beforeEach(() => {
		setFontPref('hataFont.id', DEFAULT_HATA_FONT_ID);
		setFontPref('hataFont.customUrl', '');
		setFontPref('hataFont.customName', '');
		setFontPref('hataFont.customFontConsent', false);
		// LINE は inline を消して style.scss の既定スタックに委ねる。
		applyHataFont();
	});

	test('saved legacy default resolves to LINE while explicitly selected Zen stays Zen', () => {
		expect(resolveHataFontId('zen-kaku')).toBe('line-seed-jp');
		expect(resolveHataFontId('zen-kaku-antique')).toBe('zen-kaku-antique');
		expect(resolveHataFontId('system')).toBe('system');
		expect(HATA_FONT_PRESETS[0]).toMatchObject({ id: DEFAULT_HATA_FONT_ID, family: "'LINE Seed JP'", googleFontsQuery: null });

		setFontPref('hataFont.id', 'zen-kaku');
		applyHataFont();
		expect(window.document.documentElement.style.fontFamily).toBe('');

		setFontPref('hataFont.id', 'zen-kaku-antique');
		applyHataFont();
		expect(window.document.documentElement.style.fontFamily).toContain('Zen Kaku Gothic Antique');
		expect(window.document.getElementById('hata-google-font')).not.toBeNull();
	});

	test('Google and custom resources are cleared when switching to LINE', () => {
		setFontPref('hataFont.id', 'm-plus-1p');
		applyHataFont();
		expect(window.document.getElementById('hata-google-font')).not.toBeNull();
		setFontPref('hataFont.id', DEFAULT_HATA_FONT_ID);
		applyHataFont();
		expect(window.document.getElementById('hata-google-font')).toBeNull();

		setFontPref('hataFont.customUrl', '/files/font.woff2');
		setFontPref('hataFont.customName', 'My Font');
		setFontPref('hataFont.customFontConsent', true);
		setFontPref('hataFont.id', 'custom');
		applyHataFont();
		expect(window.document.getElementById('hata-custom-font')).not.toBeNull();
		setFontPref('hataFont.id', DEFAULT_HATA_FONT_ID);
		applyHataFont();
		expect(window.document.getElementById('hata-custom-font')).toBeNull();
	});

	test('invalid custom font falls back to LINE and system selection uses the OS stack', () => {
		setFontPref('hataFont.id', 'custom');
		setFontPref('hataFont.customUrl', 'https://other.example/font.woff2');
		setFontPref('hataFont.customFontConsent', true);
		applyHataFont();
		expect(window.document.documentElement.style.fontFamily).toBe('');
		expect(window.document.getElementById('hata-custom-font')).toBeNull();

		setFontPref('hataFont.id', 'system');
		applyHataFont();
		expect(window.document.documentElement.style.fontFamily).toContain('system-ui');
		expect(window.document.documentElement.style.fontFamily).not.toContain('LINE Seed JP');
	});

	test('reactive preference updates apply imported or synced font choices', async () => {
		initHataFontWatcher();
		initHataFontWatcher();
		setFontPref('hataFont.id', 'zen-kaku');
		await nextTick();
		expect(window.document.documentElement.style.fontFamily).toBe('');

		setFontPref('hataFont.id', 'ibm-plex-sans-jp');
		await nextTick();
		expect(window.document.documentElement.style.fontFamily).toContain('IBM Plex Sans JP');
		setFontPref('hataFont.id', DEFAULT_HATA_FONT_ID);
		await nextTick();
		expect(window.document.documentElement.style.fontFamily).toBe('');
		expect(window.document.getElementById('hata-google-font')).toBeNull();
	});
});
