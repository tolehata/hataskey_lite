/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { completeHatadyTutorial, loadHatadyTutorialKind } from './hatady-tutorial.js';

type AccountFixture = { id: string; token: string } | null;
type RegistryParams = { scope: string[]; key: string; value?: unknown };

const fixtures = vi.hoisted(() => ({
	api: vi.fn(),
	account: { current: { id: 'owner-one', token: 'test-token-one' } as AccountFixture },
}));
vi.mock('@/i.js', () => ({ get $i() { return fixtures.account.current; } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixtures.api(...args) }));

const registry = new Map<string, unknown>();
const writes = () => fixtures.api.mock.calls
	.filter(([endpoint]) => endpoint === 'i/registry/set')
	.map(([, params]) => ({ key: params.key, value: params.value }));

async function registryApi(endpoint: string, params: RegistryParams, token: string): Promise<unknown> {
	expect(params.scope).toEqual(['client', 'hatady']);
	expect(['tutorialDone', 'updateGuideVersion']).toContain(params.key);
	expect(token).toBe('test-token-one');
	if (endpoint === 'i/registry/get') {
		if (!registry.has(params.key)) throw Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
		return registry.get(params.key);
	}
	if (endpoint === 'i/registry/set') {
		registry.set(params.key, params.value);
		return undefined;
	}
	throw new Error('Unexpected endpoint');
}

describe('Hatadyの初回案内と更新案内の既読', () => {
	beforeEach(() => {
		registry.clear();
		registry.set('display', { theme: 'espresso', futureDisplay: true });
		fixtures.account.current = { id: 'owner-one', token: 'test-token-one' };
		fixtures.api.mockReset();
		fixtures.api.mockImplementation(registryApi);
	});

	test('初回完了キーが未設定またはfalseのときだけ初回案内を選ぶ', async () => {
		expect(await loadHatadyTutorialKind()).toBe('initial');
		registry.set('tutorialDone', false);
		expect(await loadHatadyTutorialKind()).toBe('initial');
		expect(fixtures.api.mock.calls.every(([, params]) => params.key === 'tutorialDone')).toBe(true);
		expect(writes()).toEqual([]);
	});

	test('既存利用者は更新キーが未設定または古い場合だけ更新案内を選ぶ', async () => {
		registry.set('tutorialDone', true);
		expect(await loadHatadyTutorialKind()).toBe('update');
		for (const version of [0, 1]) {
			registry.set('updateGuideVersion', version);
			expect(await loadHatadyTutorialKind()).toBe('update');
		}
		for (const version of [2, 7]) {
			registry.set('updateGuideVersion', version);
			expect(await loadHatadyTutorialKind()).toBeNull();
		}
		expect(writes()).toEqual([]);
	});

	test.each(['tutorialDone', 'updateGuideVersion'])('%sの通信失敗を未設定扱いせず、読込も完了保存も失敗を返す', async key => {
		registry.set('tutorialDone', true);
		const failure = new Error('offline');
		fixtures.api.mockImplementation((endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/get' && params.key === key) return Promise.reject(failure);
			return registryApi(endpoint, params, token);
		});
		await expect(loadHatadyTutorialKind()).rejects.toBe(failure);
		await expect(completeHatadyTutorial('initial')).rejects.toBe(failure);
		expect(writes()).toEqual([]);
	});

	test.each([null, 'true', 1, { done: true }])('未知の初回完了形式 %j を上書きしない', async value => {
		registry.set('tutorialDone', value);
		await expect(loadHatadyTutorialKind()).rejects.toThrow('Unsupported Hatady tutorial completion value');
		await expect(completeHatadyTutorial('initial')).rejects.toThrow('Unsupported Hatady tutorial completion value');
		expect(writes()).toEqual([]);
		expect(registry.get('tutorialDone')).toEqual(value);
	});

	test.each([null, '2', { version: 2 }, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('未知の更新既読形式 %j を上書きしない', async value => {
		registry.set('tutorialDone', true);
		registry.set('updateGuideVersion', value);
		await expect(loadHatadyTutorialKind()).rejects.toThrow('Unsupported Hatady update guide version');
		await expect(completeHatadyTutorial('update')).rejects.toThrow('Unsupported Hatady update guide version');
		registry.set('tutorialDone', false);
		await expect(completeHatadyTutorial('initial')).rejects.toThrow('Unsupported Hatady update guide version');
		expect(writes()).toEqual([]);
		expect(registry.get('updateGuideVersion')).toEqual(value);
		expect(registry.get('tutorialDone')).toBe(false);
	});

	test('初回完了では更新既読を先に保存し、その後の読込で更新案内を続けて出さない', async () => {
		await completeHatadyTutorial('initial');
		expect(writes()).toEqual([
			{ key: 'updateGuideVersion', value: 2 },
			{ key: 'tutorialDone', value: true },
		]);
		expect(await loadHatadyTutorialKind()).toBeNull();
		await completeHatadyTutorial('initial');
		expect(writes()).toHaveLength(2);
		expect(registry.get('display')).toEqual({ theme: 'espresso', futureDisplay: true });
	});

	test('更新案内の完了は独立キーだけを変更し、既存の初回完了状態に触らない', async () => {
		registry.set('tutorialDone', true);
		registry.set('updateGuideVersion', 1);
		await completeHatadyTutorial('update');
		expect(writes()).toEqual([{ key: 'updateGuideVersion', value: 2 }]);
		expect(fixtures.api.mock.calls.every(([, params]) => params.key === 'updateGuideVersion')).toBe(true);
		expect(registry.get('tutorialDone')).toBe(true);
		expect(await loadHatadyTutorialKind()).toBeNull();
	});

	test('表示判定後に新しい版が保存されていても、完了時に読み直して版を下げない', async () => {
		registry.set('tutorialDone', true);
		registry.set('updateGuideVersion', 1);
		expect(await loadHatadyTutorialKind()).toBe('update');
		registry.set('updateGuideVersion', 7);
		await completeHatadyTutorial('update');
		expect(writes()).toEqual([]);
		registry.set('tutorialDone', false);
		await completeHatadyTutorial('initial');
		expect(writes()).toEqual([{ key: 'tutorialDone', value: true }]);
		expect(registry.get('updateGuideVersion')).toBe(7);
	});

	test('更新既読の保存が失敗したときは初回完了キーを立てず、再試行できる', async () => {
		const failure = new Error('version write failed');
		fixtures.api.mockImplementation((endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/set' && params.key === 'updateGuideVersion') return Promise.reject(failure);
			return registryApi(endpoint, params, token);
		});
		await expect(completeHatadyTutorial('initial')).rejects.toBe(failure);
		expect(writes()).toEqual([{ key: 'updateGuideVersion', value: 2 }]);
		expect(registry.has('tutorialDone')).toBe(false);
		expect(await loadHatadyTutorialKind()).toBe('initial');
		fixtures.api.mockImplementation(registryApi);
		await completeHatadyTutorial('initial');
		expect(await loadHatadyTutorialKind()).toBeNull();
	});

	test('初回完了の保存だけ失敗した場合は先に保存した更新既読を維持して再試行する', async () => {
		const failure = new Error('initial write failed');
		fixtures.api.mockImplementation((endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/set' && params.key === 'tutorialDone') return Promise.reject(failure);
			return registryApi(endpoint, params, token);
		});
		await expect(completeHatadyTutorial('initial')).rejects.toBe(failure);
		expect(registry.get('updateGuideVersion')).toBe(2);
		expect(await loadHatadyTutorialKind()).toBe('initial');
		fixtures.api.mockImplementation(registryApi);
		await completeHatadyTutorial('initial');
		expect(await loadHatadyTutorialKind()).toBeNull();
		expect(writes().filter(write => write.key === 'updateGuideVersion')).toHaveLength(1);
	});

	test('更新案内の保存失敗を成功扱いせず、次の表示判定も更新案内のままにする', async () => {
		registry.set('tutorialDone', true);
		const failure = new Error('write failed');
		fixtures.api.mockImplementation((endpoint: string, params: RegistryParams, token: string) => endpoint === 'i/registry/set'
			? Promise.reject(failure)
			: registryApi(endpoint, params, token));
		await expect(completeHatadyTutorial('update')).rejects.toBe(failure);
		expect(await loadHatadyTutorialKind()).toBe('update');
	});

	test('読込中のアカウント切替後には別の利用者の既読を保存しない', async () => {
		registry.set('tutorialDone', false);
		fixtures.api.mockImplementation(async (endpoint: string, params: RegistryParams, token: string) => {
			const result = await registryApi(endpoint, params, token);
			fixtures.account.current = { id: 'owner-two', token: 'test-token-two' };
			return result;
		});
		await expect(completeHatadyTutorial('initial')).rejects.toThrow('Hatady tutorial account changed');
		expect(writes()).toEqual([]);
		expect(fixtures.api).toHaveBeenCalledTimes(1);
	});

	test('更新既読の保存中にログアウトしたら続く初回完了保存を行わない', async () => {
		fixtures.api.mockImplementation(async (endpoint: string, params: RegistryParams, token: string) => {
			const result = await registryApi(endpoint, params, token);
			if (endpoint === 'i/registry/set') fixtures.account.current = null;
			return result;
		});
		await expect(completeHatadyTutorial('initial')).rejects.toThrow('Hatady tutorial account changed');
		expect(writes()).toEqual([{ key: 'updateGuideVersion', value: 2 }]);
		expect(registry.has('tutorialDone')).toBe(false);
	});

	test('未ログインでは初回扱いも既読保存も行わない', async () => {
		fixtures.account.current = null;
		await expect(loadHatadyTutorialKind()).rejects.toThrow('signed-in account');
		await expect(completeHatadyTutorial('update')).rejects.toThrow('signed-in account');
		expect(fixtures.api).not.toHaveBeenCalled();
	});
});
