/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const local = new Map<string, string>();
const api = vi.fn();
let cacheReadFails = false;
let cacheWriteFails = false;

vi.mock('@/local-storage.js', () => ({
	miLocalStorage: {
		getItem: (key: string) => {
			if (cacheReadFails) throw new Error('cache unavailable');
			return local.get(key) ?? null;
		},
		setItem: (key: string, value: string) => {
			if (cacheWriteFails) throw new Error('cache full');
			return local.set(key, value);
		},
	},
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => api(...args) }));

async function loadModule() {
	vi.resetModules();
	return import('./hatady-prefs.js');
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe('Hatadyの共通言語化後の表示設定', () => {
	beforeEach(() => {
		local.clear();
		api.mockReset();
		cacheReadFails = false;
		cacheWriteFails = false;
	});

	test('テーマ保存時に既存の旧言語値と将来フィールドを維持する', async () => {
		api.mockImplementation((endpoint: string, data: { value?: unknown }) => {
			if (endpoint === 'i/registry/get') return Promise.resolve({ theme: 'paper', lang: 'en', futureDisplay: true });
			if (endpoint === 'i/registry/set') return Promise.resolve(data.value);
			return Promise.reject(new Error('unexpected'));
		});
		const prefs = await loadModule();

		await prefs.saveHatadyDisplay('espresso');

		expect(local.get('hatadyTheme')).toBe('espresso');
		expect(local.get('hatadyLang')).toBe('en');
		expect(api).toHaveBeenCalledWith('i/registry/set', {
			scope: ['client', 'hatady'],
			key: 'display',
			value: { theme: 'espresso', lang: 'en', futureDisplay: true },
		});
	});

	test('旧言語値が一度もない利用者には言語フィールドを新設しない', async () => {
		api.mockImplementation((endpoint: string, data: { value?: unknown }) => {
			if (endpoint === 'i/registry/get') return Promise.reject({ code: 'NO_SUCH_KEY' });
			if (endpoint === 'i/registry/set') return Promise.resolve(data.value);
			return Promise.reject(new Error('unexpected'));
		});
		const prefs = await loadModule();

		await prefs.saveHatadyDisplay('hataskey');

		expect(api).toHaveBeenCalledWith('i/registry/set', {
			scope: ['client', 'hatady'],
			key: 'display',
			value: { theme: 'hataskey' },
		});
	});

	test('サーバー取得不能時も端末に残る旧言語値は消さない', async () => {
		local.set('hatadyLang', 'auto');
		api.mockImplementation((endpoint: string, data: { value?: unknown }) => {
			if (endpoint === 'i/registry/get') return Promise.reject(new Error('offline'));
			if (endpoint === 'i/registry/set') return Promise.resolve(data.value);
			return Promise.reject(new Error('unexpected'));
		});
		const prefs = await loadModule();

		await expect(prefs.saveHatadyDisplay('paper')).rejects.toThrow('offline');

		expect(local.get('hatadyLang')).toBe('auto');
		expect(api.mock.calls.filter(([endpoint]) => endpoint === 'i/registry/set')).toEqual([]);
	});

	test('書込失敗時は既存テーマと未知設定を変更しない', async () => {
		local.set('hatadyTheme', 'espresso');
		api.mockImplementation((endpoint: string) => endpoint === 'i/registry/get' ? Promise.resolve({ theme: 'espresso', custom: { keep: true } }) : Promise.reject(new Error('write failed')));
		const prefs = await loadModule();
		await expect(prefs.saveHatadyDisplay('dark')).rejects.toThrow('write failed');
		expect(prefs.hatadyTheme.value).toBe('espresso');
		expect(local.get('hatadyTheme')).toBe('espresso');
		expect(api).toHaveBeenCalledWith('i/registry/set', expect.objectContaining({ value: { theme: 'dark', custom: { keep: true } } }));
	});

	test('端末キャッシュを読めなくても既定値で起動しサーバー設定を読み込める', async () => {
		cacheReadFails = true;
		cacheWriteFails = true;
		api.mockResolvedValue({ theme: 'espresso', lang: 'en' });
		const prefs = await loadModule();
		expect(prefs.hatadyTheme.value).toBe('light');
		await prefs.loadHatadyDisplay();
		expect(prefs.hatadyTheme.value).toBe('espresso');
	});

	test('補助キャッシュへの書込失敗をレジストリ保存の失敗にしない', async () => {
		cacheWriteFails = true;
		api.mockImplementation((endpoint: string) => endpoint === 'i/registry/get'
			? Promise.resolve({ theme: 'paper', lang: 'en', future: { keep: true } })
			: Promise.resolve());
		const prefs = await loadModule();
		await expect(prefs.saveHatadyDisplay('dark')).resolves.toBeUndefined();
		expect(prefs.hatadyTheme.value).toBe('dark');
		expect(api).toHaveBeenCalledWith('i/registry/set', expect.objectContaining({
			value: { theme: 'dark', lang: 'en', future: { keep: true } },
		}));
	});

	test('保存前に開始した読み込みが遅れて完了してもテーマと言語キャッシュを巻き戻さない', async () => {
		const oldLoad = deferred<unknown>();
		api.mockImplementationOnce(() => oldLoad.promise);
		api.mockImplementation((endpoint: string) => endpoint === 'i/registry/get'
			? Promise.resolve({ theme: 'paper', lang: 'en', future: true })
			: Promise.resolve());
		const prefs = await loadModule();
		const loading = prefs.loadHatadyDisplay();
		await prefs.saveHatadyDisplay('dark');
		oldLoad.resolve({ theme: 'paper', lang: 'ja' });
		await loading;
		expect(prefs.hatadyTheme.value).toBe('dark');
		expect(local.get('hatadyTheme')).toBe('dark');
		expect(local.get('hatadyLang')).toBe('en');
	});

	test('同時読み込みは新しく開始した要求を優先する', async () => {
		const first = deferred<unknown>();
		const second = deferred<unknown>();
		api.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
		const prefs = await loadModule();
		const firstLoad = prefs.loadHatadyDisplay();
		const secondLoad = prefs.loadHatadyDisplay();
		second.resolve({ theme: 'dark', lang: 'en' });
		await secondLoad;
		first.resolve({ theme: 'paper', lang: 'ja' });
		await firstLoad;
		expect(prefs.hatadyTheme.value).toBe('dark');
		expect(local.get('hatadyLang')).toBe('en');
	});

	test('保存中の読み込みは古い設定を反映せず次回読み込みは利用できる', async () => {
		const saving = deferred<void>();
		api.mockImplementation((endpoint: string) => endpoint === 'i/registry/get'
			? Promise.resolve({ theme: 'paper' })
			: saving.promise);
		const prefs = await loadModule();
		const save = prefs.saveHatadyDisplay('dark');
		await vi.waitFor(() => expect(api).toHaveBeenCalledWith('i/registry/set', expect.anything()));
		await prefs.loadHatadyDisplay();
		expect(api.mock.calls.filter(([endpoint]) => endpoint === 'i/registry/get')).toHaveLength(1);
		saving.resolve();
		await save;
		expect(prefs.hatadyTheme.value).toBe('dark');
		api.mockResolvedValue({ theme: 'hataskey' });
		await prefs.loadHatadyDisplay();
		expect(prefs.hatadyTheme.value).toBe('hataskey');
	});

	test('連続保存を順番に実行し最新テーマと直前の未知フィールドを維持する', async () => {
		const firstWrite = deferred<void>();
		let stored: Record<string, unknown> = { theme: 'paper', lang: 'en', future: 1 };
		let writes = 0;
		api.mockImplementation(async (endpoint: string, data: { value: Record<string, unknown> }) => {
			if (endpoint === 'i/registry/get') return { ...stored };
			if (++writes === 1) await firstWrite.promise;
			stored = { ...data.value, future: 2 };
			return undefined;
		});
		const prefs = await loadModule();
		const first = prefs.saveHatadyDisplay('dark');
		const second = prefs.saveHatadyDisplay('espresso');
		await vi.waitFor(() => expect(writes).toBe(1));
		expect(api.mock.calls.filter(([endpoint]) => endpoint === 'i/registry/get')).toHaveLength(1);
		firstWrite.resolve();
		await Promise.all([first, second]);
		expect(api.mock.calls.filter(([endpoint]) => endpoint === 'i/registry/set').map(([, data]) => data.value)).toEqual([
			{ theme: 'dark', lang: 'en', future: 1 },
			{ theme: 'espresso', lang: 'en', future: 2 },
		]);
		expect(prefs.hatadyTheme.value).toBe('espresso');
		expect(stored.theme).toBe('espresso');
	});

	test('先の保存が失敗しても次の保存を実行できる', async () => {
		const firstWrite = deferred<void>();
		let writes = 0;
		api.mockImplementation((endpoint: string) => endpoint === 'i/registry/get'
			? Promise.resolve({ theme: 'paper', lang: 'auto', future: true })
			: ++writes === 1 ? firstWrite.promise : Promise.resolve());
		const prefs = await loadModule();
		const first = prefs.saveHatadyDisplay('dark');
		const rejection = expect(first).rejects.toThrow('write failed');
		const second = prefs.saveHatadyDisplay('hataskey');
		await vi.waitFor(() => expect(writes).toBe(1));
		firstWrite.reject(new Error('write failed'));
		await rejection;
		await second;
		expect(writes).toBe(2);
		expect(prefs.hatadyTheme.value).toBe('hataskey');
		expect(local.get('hatadyLang')).toBe('auto');
	});
});
