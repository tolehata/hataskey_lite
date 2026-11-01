/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import * as vue from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PreferencesManager } from './preferences/manager.js';
import type { DeckProfile } from './deck.js';
import type { PreferencesProfile, StorageProvider } from './preferences/manager.js';
import { deepClone } from '@/utility/clone.js';
import { deepEqual } from '@/utility/deep-equal.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

const scopes: vue.EffectScope[] = [];
afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop();
});

// Run the entire real deck module with a real preference manager per tab.
// Replace only module bindings for app IO; no browser or storage is accessed.
const code = ts.transpileModule(readFileSync(`${process.cwd()}/src/deck.ts`, 'utf8') + '\nexport { switchProfile };', {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function loadDeck(prefer: PreferencesManager) {
	const modules: Record<string, unknown> = {
		vue,
		'./i18n.js': { i18n: { ts: {} } },
		'@/utility/id.js': { genId: () => 'generated-profile' },
		'@/utility/clone.js': { deepClone },
		'@/utility/deep-equal.js': { deepEqual },
		'@/preferences.js': { prefer },
		'@/os.js': {},
	};
	const exports = {};
	const scope = vue.effectScope();
	scopes.push(scope);
	scope.run(() => new Function('require', 'exports', code)((id: string) => {
		if (!(id in modules)) throw new Error(`Unexpected deck dependency: ${id}`);
		return modules[id];
	}, exports));
	return exports as typeof import('./deck.js') & { switchProfile: (profile: DeckProfile) => void };
}

const initialProfiles: DeckProfile[] = [{
	id: 'main', name: 'Main',
	columns: [{ id: 'notifications', type: 'notifications', name: null, width: 300, excludeBots: false }],
	layout: [['notifications']],
}, {
	id: 'second', name: 'Second',
	columns: [{ id: 'other-notifications', type: 'notifications', name: null, width: 360, excludeBots: false }],
	layout: [['other-notifications']],
}];

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

async function fixture() {
	let saved: PreferencesProfile | null = null;
	const io: StorageProvider = {
		load: () => copy(saved),
		save: ({ profile }) => { saved = copy(profile); },
		cloudGetBulk: async () => ({}),
		cloudGet: async () => null,
		cloudSet: async () => undefined,
	};
	const boot = async () => {
		const manager = new PreferencesManager(io, { id: 'test-account' });
		await manager.cloudReady;
		return manager;
	};
	const seed = await boot();
	seed.commit('deck.profiles', copy(initialProfiles));
	seed.commit('deck.profile', 'Main');
	return { boot };
}

describe('標準デッキの保存済み設定への追従', () => {
	test('別タブの同期後に幅を変更しても、更新済みのBot除外設定を戻さない', async () => {
		const f = await fixture();
		const preferA = await f.boot();
		const preferB = await f.boot();
		const deckA = loadDeck(preferA);
		const deckB = loadDeck(preferB);
		deckA.updateColumn('notifications', { excludeBots: true });
		preferB.reloadProfile();
		await preferB.cloudReady;
		expect(preferB.s['deck.profiles'].find(p => p.name === 'Main')?.columns[0].excludeBots).toBe(true);
		expect.soft(deckB.columns.value[0].excludeBots).toBe(true);
		deckB.updateColumn('notifications', { width: 440 });
		const reloaded = await f.boot();
		expect(reloaded.s['deck.profiles'].find(p => p.name === 'Main')?.columns[0]).toMatchObject({ excludeBots: true, width: 440 });
	});

	test('同期したプロファイル選択と列配置を、次の操作より前に反映する', async () => {
		const f = await fixture();
		const prefer = await f.boot();
		const deck = loadDeck(prefer);
		prefer.commit('deck.profile', 'Second');
		expect(deck.columns.value.map(column => column.id)).toEqual(['other-notifications']);
		expect(deck.layout.value).toEqual([['other-notifications']]);
		deck.updateColumn('other-notifications', { excludeBots: true });
		const reloaded = await f.boot();
		expect(reloaded.s['deck.profiles'].find(p => p.name === 'Main')).toEqual(initialProfiles[0]);
		expect(reloaded.s['deck.profiles'].find(p => p.name === 'Second')?.columns[0].excludeBots).toBe(true);
	});

	test('同じターンの連続保存と再読込で設定と配置を保持する', async () => {
		const f = await fixture();
		const prefer = await f.boot();
		const deck = loadDeck(prefer);
		deck.updateColumn('notifications', { excludeBots: true });
		deck.addColumn({ id: 'local', type: 'tl', tl: 'local', name: null, width: 380 });
		deck.swapLeftColumn('local');
		deck.updateColumn('notifications', { width: 420 });
		expect(deck.columns.value.find(column => column.id === 'notifications')).toMatchObject({ excludeBots: true, width: 420 });
		expect(deck.layout.value).toEqual([['local'], ['notifications']]);
		const reloaded = loadDeck(await f.boot());
		expect(reloaded.columns.value).toEqual(deck.columns.value);
		expect(reloaded.layout.value).toEqual(deck.layout.value);
	});

	test('同期値が同じ場合はカラムと配置の参照を維持する', async () => {
		const f = await fixture();
		const prefer = await f.boot();
		const deck = loadDeck(prefer);
		const columns = deck.columns.value;
		const layout = deck.layout.value;
		prefer.reloadProfile();
		await prefer.cloudReady;
		expect(deck.columns.value).toBe(columns);
		expect(deck.layout.value).toBe(layout);
	});

	test('メニューを開いた後の同期値を、古いプロファイルの選択で上書きしない', async () => {
		const f = await fixture();
		const prefer = await f.boot();
		const deck = loadDeck(prefer);
		const staleMenuProfile = copy(prefer.s['deck.profiles'].find(p => p.name === 'Second')!);
		const updated = copy(prefer.s['deck.profiles']);
		updated.find(p => p.name === 'Second')!.columns[0].excludeBots = true;
		prefer.commit('deck.profiles', updated);
		deck.switchProfile(staleMenuProfile);
		expect(deck.columns.value[0].excludeBots).toBe(true);
		expect((await f.boot()).s['deck.profiles'].find(p => p.name === 'Second')?.columns[0].excludeBots).toBe(true);
	});
});
