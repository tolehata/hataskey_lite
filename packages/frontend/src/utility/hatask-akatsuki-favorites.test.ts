/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';
import { normalizeHataskAkatsukiFavorites } from './hatask-akatsuki-favorites.js';
import type { HataskAkatsukiFavoriteId } from '@/components/hatask/hatask-akatsuki-types.js';

const parsed = parse(readFileSync(`${process.cwd()}/src/pages/hatask.vue`, 'utf8'));
if (!parsed.descriptor.scriptSetup) throw new Error('Missing Hatask setup script');
const script = ts.createSourceFile('hatask.ts', parsed.descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);

function fixture() {
	const functions = script.statements.filter(node => ts.isFunctionDeclaration(node) && ['saveAkatsukiFavorites', 'registrySet'].includes(node.name?.text ?? '')).map(node => node.getText(script)).join('\n');
	const code = ts.transpileModule(`${functions}\n({saveAkatsukiFavorites})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	const settings = { value: { theme: 'akatsuki', showClock: false, akatsukiHomeFavorites: ['todo'] as HataskAkatsukiFavoriteId[], customSetting: { preserved: true } } };
	const ready = { value: true };
	const enabled = { value: true };
	const loadedKeys = new Set(['settings']);
	const saving = { value: false };
	const error = { value: '' };
	const api = vi.fn().mockResolvedValue(undefined);
	const runtime = runInNewContext(code, {
		settings, loadedKeys, dataLoaded: ready, isAkatsuki: enabled,
		props: { embedded: false },
		akatsukiFavoritesSaving: saving, akatsukiFavoritesError: error, normalizeHataskAkatsukiFavorites,
		isPlannerCollectionKey: () => false, misskeyApi: api, SCOPE: ['client', 'hatask'],
	}) as { saveAkatsukiFavorites: (favorites: HataskAkatsukiFavoriteId[]) => Promise<void> };
	return { ...runtime, settings, ready, enabled, loadedKeys, saving, error, api };
}

describe('暁のお気に入りの保存', () => {
	test('未設定・不正な値では未選択とし、許可した項目だけを重複なく最大2つ復元する', () => {
		for (const value of [null, undefined, false, 'calendar', {}, 1]) expect(normalizeHataskAkatsukiFavorites(value)).toEqual([]);
		const saved = ['unknown', 'flower', 'flower', null, 'calendar', 'todo', 'meal'];
		expect(normalizeHataskAkatsukiFavorites(saved)).toEqual(['flower', 'calendar']);
		expect(saved).toEqual(['unknown', 'flower', 'flower', null, 'calendar', 'todo', 'meal']);
	});

	test('既存設定を保ちアカウントの設定に保存し、保存完了まで表示を変えず連打も防ぐ', async () => {
		const f = fixture();
		let finish!: () => void;
		f.api.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
		const first = f.saveAkatsukiFavorites(['calendar', 'flower']);
		await f.saveAkatsukiFavorites(['meal']);
		expect(f.api).toHaveBeenCalledTimes(1);
		expect(f.api).toHaveBeenCalledWith('i/registry/set', {
			key: 'settings', scope: ['client', 'hatask'],
			value: { theme: 'akatsuki', showClock: false, customSetting: { preserved: true }, akatsukiHomeFavorites: ['calendar', 'flower'] },
		});
		expect(f.settings.value.akatsukiHomeFavorites).toEqual(['todo']);
		expect(f.saving.value).toBe(true);
		finish();
		await first;
		expect(f.settings.value.akatsukiHomeFavorites).toEqual(['calendar', 'flower']);
		expect(f.settings.value.customSetting).toEqual({ preserved: true });
		expect(f.saving.value).toBe(false);
	});

	test('保存失敗時は以前の選択と設定を維持し、再試行後に1項目への変更や解除を保存できる', async () => {
		const f = fixture();
		f.api.mockRejectedValueOnce(new Error('offline'));
		await f.saveAkatsukiFavorites(['flower']);
		expect(f.settings.value.akatsukiHomeFavorites).toEqual(['todo']);
		expect(f.error.value).toContain('保存できませんでした');
		expect(f.saving.value).toBe(false);
		await f.saveAkatsukiFavorites(['flower']);
		expect(f.settings.value.akatsukiHomeFavorites).toEqual(['flower']);
		expect(f.error.value).toBe('');
		await f.saveAkatsukiFavorites([]);
		expect(f.settings.value.akatsukiHomeFavorites).toEqual([]);
		expect(f.settings.value.showClock).toBe(false);
	});

	test('未読・読込失敗時は保存を拒否し、読込後はどのテーマでも保存する', async () => {
		const f = fixture();
		f.ready.value = false;
		await f.saveAkatsukiFavorites(['calendar']);
		f.ready.value = true;
		f.loadedKeys.clear();
		await f.saveAkatsukiFavorites(['calendar']);
		expect(f.api).not.toHaveBeenCalled();
		f.loadedKeys.add('settings');
		f.enabled.value = false;
		await f.saveAkatsukiFavorites(['calendar']);
		expect(f.api).toHaveBeenCalledTimes(1);
		expect(f.settings.value.akatsukiHomeFavorites).toEqual(['calendar']);
	});
});
