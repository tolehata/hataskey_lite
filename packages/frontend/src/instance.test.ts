/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => {
	const values = new Map<string, string>();
	return {
		values,
		api: vi.fn(),
		setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
	};
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/i.js', () => ({ $i: { token: 'stale-token' } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => fixture.values.get(key) ?? null,
	setItem: fixture.setItem,
} }));

import { fetchInstance, instance } from './instance.js';
import { $i } from '@/i.js';

describe('fetchInstance', () => {
	beforeEach(() => {
		fixture.values.clear();
		fixture.api.mockReset();
		fixture.setItem.mockClear();
	});

	test('refreshes stale setup metadata through the public API without an account token', async () => {
		fixture.values.set('instance', JSON.stringify({ requireSetup: true }));
		fixture.values.set('instanceCachedAt', String(Date.now()));
		instance.requireSetup = true;
		fixture.api.mockResolvedValueOnce({ requireSetup: false });

		const result = await fetchInstance(true);

		expect($i?.token).toBe('stale-token');
		expect(fixture.api).toHaveBeenCalledWith('meta', { detail: true }, null);
		expect(result).toBe(instance);
		expect(instance.requireSetup).toBe(false);
		expect(JSON.parse(fixture.values.get('instance') ?? '{}')).toMatchObject({ requireSetup: false });
		expect(Number(fixture.values.get('instanceCachedAt'))).toBeGreaterThan(0);
	});
});
