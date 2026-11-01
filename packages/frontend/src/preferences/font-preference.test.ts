/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';
import { DEFAULT_HATA_FONT_ID, resolveHataFontId } from '@/scripts/hata-font-manager.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({ waiting: () => () => {}, alert: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/preferences.js', () => ({ prefer: {} }));

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function fixture(cloudGetBulk: StorageProvider['cloudGetBulk'] = async () => ({})) {
	let saved: PreferencesProfile | null = null;
	const io: StorageProvider = {
		load: () => saved && copy(saved),
		save: ({ profile }) => { saved = copy(profile); },
		cloudGetBulk,
		cloudGet: async () => null,
		cloudSet: async () => undefined,
	};
	return {
		boot: () => new PreferencesManager(io, { id: 'font-user' }),
		get saved() {
			if (saved === null) throw new Error('font preference fixture has no saved profile');
			return copy(saved);
		},
		replace: (profile: PreferencesProfile) => { saved = copy(profile); },
	};
}

describe('font preference persistence', () => {
	test('normalization sets LINE for new profiles and retains a materialized legacy default across reloads', async () => {
		const f = fixture();
		const first = f.boot();
		await first.cloudReady;
		expect(first.s['hataFont.id']).toBe(DEFAULT_HATA_FONT_ID);
		expect(f.saved.preferences['hataFont.id'][0][1]).toBe(DEFAULT_HATA_FONT_ID);

		first.commit('hataFont.id', 'zen-kaku');
		const reloaded = f.boot();
		await reloaded.cloudReady;
		expect(reloaded.s['hataFont.id']).toBe('zen-kaku');
		expect(resolveHataFontId(reloaded.s['hataFont.id'])).toBe(DEFAULT_HATA_FONT_ID);
		expect(f.saved.preferences['hataFont.id'][0][1]).toBe('zen-kaku');
	});

	test.each(['zen-kaku-antique', 'm-plus-1p', 'custom', 'system'] as const)('explicit %s selection survives profile reload', async id => {
		const f = fixture();
		const first = f.boot();
		await first.cloudReady;
		first.commit('hataFont.id', id);
		const reloaded = f.boot();
		await reloaded.cloudReady;
		expect(reloaded.s['hataFont.id']).toBe(id);
		expect(resolveHataFontId(reloaded.s['hataFont.id'])).toBe(id);
	});

	test('profile import and cloud update resolve legacy default without rewriting the saved ID', async () => {
		let remoteId: 'zen-kaku' | 'zen-kaku-antique' = 'zen-kaku';
		const f = fixture(async () => ({ 'hataFont.id': remoteId }) as never);
		const active = f.boot();
		await active.cloudReady;

		const imported = f.saved;
		imported.id = 'imported-font-profile';
		imported.preferences['hataFont.id'][0][1] = 'zen-kaku';
		f.replace(imported);
		active.reloadProfile();
		await active.cloudReady;
		expect(active.s['hataFont.id']).toBe('zen-kaku');
		expect(resolveHataFontId(active.s['hataFont.id'])).toBe(DEFAULT_HATA_FONT_ID);

		active.getMatchedRecordOf('hataFont.id')[2].sync = true;
		active.save();
		remoteId = 'zen-kaku-antique';
		active.reloadProfile();
		await active.cloudReady;
		expect(active.s['hataFont.id']).toBe('zen-kaku-antique');
		expect(resolveHataFontId(active.s['hataFont.id'])).toBe('zen-kaku-antique');

		remoteId = 'zen-kaku';
		active.reloadProfile();
		await active.cloudReady;
		expect(active.s['hataFont.id']).toBe('zen-kaku');
		expect(resolveHataFontId(active.s['hataFont.id'])).toBe(DEFAULT_HATA_FONT_ID);
	});
});
