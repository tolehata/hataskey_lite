/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { completeHataFeedTutorial, loadHataFeedTutorialKind } from './hatafeed-tutorial.js';

const fixtures = vi.hoisted(() => ({ api: vi.fn(), owner: { current: { id: 'alice', token: 'alice-token' } as { id: string; token: string } | null } }));
vi.mock('@/i.js', () => ({ get $i() { return fixtures.owner.current; } }));
vi.mock('@@/js/config.js', () => ({ host: 'example.test' }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
const records = new Map<string, unknown>();
const currentKey = 'client/hatafeed/tutorialVersion';
const legacyKey = 'client/preferences/sync/default:simpleUi.hatafeedIntroShown';
type Params = { scope: string[]; key: string; value?: unknown };

async function api(endpoint: string, params: Params, token: string) {
	expect(token).toBe('alice-token');
	const key = [...params.scope, params.key].join('/');
	expect([currentKey, legacyKey]).toContain(key);
	if (endpoint === 'i/registry/get') {
		if (!records.has(key)) throw Object.assign(new Error('Missing key'), { code: 'NO_SUCH_KEY' });
		return records.get(key);
	}
	if (endpoint !== 'i/registry/set') throw new Error('Unexpected mutation');
	expect(key).toBe(currentKey);
	records.set(key, params.value);
	return undefined;
}

const writes = () => fixtures.api.mock.calls.filter(([endpoint]) => endpoint === 'i/registry/set');
beforeEach(() => {
	records.clear(); fixtures.owner.current = { id: 'alice', token: 'alice-token' };
	fixtures.api.mockReset().mockImplementation(api);
});

describe('HataFeed guide selection and account-scoped completion', () => {
	test('a new reader sees the initial guide and reads never save completion', async () => {
		expect(await loadHataFeedTutorialKind()).toBe('initial');
		expect(writes()).toEqual([]);
	});
	test('own existing activity selects the update guide without reading retired preferences', async () => {
		expect(await loadHataFeedTutorialKind(true)).toBe('update');
		expect(fixtures.api).toHaveBeenCalledOnce();
		expect(writes()).toEqual([]);
	});
	test.each([{}, { account: 'alice' }, { server: 'example.test', account: 'alice' }])('the account old introduction %j selects the update guide without restoring old settings', async scope => {
		records.set(legacyKey, [[scope, true]]);
		expect(await loadHataFeedTutorialKind()).toBe('update');
		expect(writes()).toEqual([]);
	});
	test.each([[{ account: 'bob' }, true], [{ server: 'other.test' }, true], [{}, false]])('another account/server or an unseen introduction %j does not mark the current account as returning', async (scope, shown) => {
		records.set(legacyKey, [[scope, shown]]);
		expect(await loadHataFeedTutorialKind()).toBe('initial');
	});
	test('completion uses one key, suppresses a second automatic guide, and preserves future versions', async () => {
		await completeHataFeedTutorial();
		expect(writes()).toHaveLength(1);
		expect(records.get(currentKey)).toBe(1);
		expect(await loadHataFeedTutorialKind()).toBeNull();
		await completeHataFeedTutorial();
		records.set(currentKey, 9); await completeHataFeedTutorial();
		expect(writes()).toHaveLength(1);
		expect(records.get(currentKey)).toBe(9);
	});
	test.each([null, '1', true, -1, 0.5, { version: 1 }])('unknown completion value %j is preserved', async value => {
		records.set(currentKey, value);
		await expect(loadHataFeedTutorialKind()).rejects.toThrow('Unsupported HataFeed tutorial version');
		await expect(completeHataFeedTutorial()).rejects.toThrow('Unsupported HataFeed tutorial version');
		expect(writes()).toEqual([]); expect(records.get(currentKey)).toEqual(value);
	});
	test.each([currentKey, legacyKey])('a failed read of %s is not treated as a new user', async key => {
		fixtures.api.mockImplementation((endpoint: string, params: Params, token: string) => {
			if ([...params.scope, params.key].join('/') === key) throw new Error('offline');
			return api(endpoint, params, token);
		});
		await expect(loadHataFeedTutorialKind()).rejects.toThrow('offline');
		expect(writes()).toEqual([]);
	});
	test('failed completion is retriable and does not mark the guide as read', async () => {
		fixtures.api.mockImplementation((endpoint: string, params: Params, token: string) => {
			if (endpoint.endsWith('/set')) throw new Error('offline');
			return api(endpoint, params, token);
		});
		await expect(completeHataFeedTutorial()).rejects.toThrow('offline');
		expect(await loadHataFeedTutorialKind()).toBe('initial');
		fixtures.api.mockImplementation(api); await completeHataFeedTutorial();
		expect(await loadHataFeedTutorialKind()).toBeNull();
	});
	test('an account change during a read prevents a write under the next account', async () => {
		fixtures.api.mockImplementation(async () => { fixtures.owner.current = { id: 'bob', token: 'bob-token' }; return 0; });
		await expect(completeHataFeedTutorial()).rejects.toThrow('account changed');
		expect(writes()).toEqual([]);
	});
	test('signed-out readers do not call the registry', async () => {
		fixtures.owner.current = null;
		await expect(loadHataFeedTutorialKind()).rejects.toThrow('signed-in account');
		await expect(completeHataFeedTutorial()).rejects.toThrow('signed-in account');
		expect(fixtures.api).not.toHaveBeenCalled();
	});
});
