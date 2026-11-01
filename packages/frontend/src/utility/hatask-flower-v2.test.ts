/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
	return { promise, resolve, reject };
}

beforeEach(() => { api.mockReset(); vi.resetModules(); });

describe('Hatask authoritative flower client', () => {
	test('reuses the request ID after a lost watering response', async () => {
		const { pourHataskFlower } = await import('./hatask-flower-v2.js');
		api.mockRejectedValueOnce(new TypeError('Network connection lost'));
		await expect(pourHataskFlower('self')).rejects.toThrow('Network connection lost');
		const first = api.mock.calls[0][1];
		api.mockResolvedValueOnce({ drops: 3 });
		await pourHataskFlower('self');
		expect(api.mock.calls[1][1].requestId).toBe(first.requestId);
		api.mockResolvedValueOnce({ drops: 2 });
		await pourHataskFlower('self');
		expect(api.mock.calls[2][1].requestId).not.toBe(first.requestId);
	});

	test('does not switch an uncertain watering request to a different destination', async () => {
		const { pourHataskFlower } = await import('./hatask-flower-v2.js');
		api.mockRejectedValueOnce(new TypeError('offline'));
		await expect(pourHataskFlower('self')).rejects.toThrow();
		await expect(pourHataskFlower('festival')).rejects.toThrow('previous watering');
		expect(api).toHaveBeenCalledTimes(1);
	});

	test('uses one home watering request ID for repeat calls and preserves an uncertain older ID', async () => {
		const { pourHataskFlower } = await import('./hatask-flower-v2.js');
		const homeId = 'hatagoes-home-water:2026-10-03';
		api.mockResolvedValueOnce({ drops: 2 }).mockResolvedValueOnce({ drops: 2 });
		await pourHataskFlower('self', homeId);
		await pourHataskFlower('self', homeId);
		expect(api.mock.calls[0][1].requestId).toBe(homeId);
		expect(api.mock.calls[1][1].requestId).toBe(homeId);
		api.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ drops: 1 });
		await expect(pourHataskFlower('self')).rejects.toThrow('offline');
		const uncertainId = api.mock.calls[2][1].requestId;
		await pourHataskFlower('self', 'hatagoes-home-water:2026-10-04');
		expect(api.mock.calls[3][1].requestId).toBe(uncertainId);
	});

	test('a remounted home sends the same day request ID after module reload', async () => {
		api.mockResolvedValue({ drops: 2 });
		const dayId = 'hatagoes-home-water:2026-10-03';
		const first = await import('./hatask-flower-v2.js');
		await first.pourHataskFlower('self', dayId);
		vi.resetModules();
		const reloaded = await import('./hatask-flower-v2.js');
		await reloaded.pourHataskFlower('self', dayId);
		expect(api.mock.calls.map(call => call[1].requestId)).toEqual([dayId, dayId]);
	});

	test('a slow read cannot overwrite a newer watering result', async () => {
		const { getHataskFlowerState, pourHataskFlower, HATASK_FLOWER_STATE_EVENT } = await import('./hatask-flower-v2.js');
		const old = deferred<{ drops: number }>();
		api.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ drops: 3 });
		const events: number[] = [];
		const receive = (event: Event) => { events.push((event as CustomEvent).detail.drops); };
		window.addEventListener(HATASK_FLOWER_STATE_EVENT, receive);
		try {
			const read = getHataskFlowerState();
			await pourHataskFlower('self');
			old.resolve({ drops: 4 });
			expect((await read).drops).toBe(3);
			expect(events).toEqual([3]);
		} finally { window.removeEventListener(HATASK_FLOWER_STATE_EVENT, receive); }
	});

	test('concurrent different mutations are not reported as successful', async () => {
		const { pourHataskFlower, claimHataskFlowerSeed } = await import('./hatask-flower-v2.js');
		const pending = deferred<{ drops: number }>();
		api.mockReturnValueOnce(pending.promise);
		const pouring = pourHataskFlower('self');
		await expect(claimHataskFlowerSeed('winter')).rejects.toThrow('already in progress');
		pending.resolve({ drops: 3 });
		await pouring;
		expect(api).toHaveBeenCalledTimes(1);
	});

	test('the server wallet-full reason is explained without claiming another reward', async () => {
		const { hataskDropRewardMessage } = await import('./hatask-flower-v2.js');
		expect(hataskDropRewardMessage({ granted: false, why: 'store' })).toBe('じょうろがいっぱいです');
	});

	test('an external reward refresh survives an earlier failed read', async () => {
		const { getHataskFlowerState, refreshHataskFlowerStateAfterUpdate } = await import('./hatask-flower-v2.js');
		const old = deferred<{ drops: number }>();
		api.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ drops: 5 });
		const oldRead = getHataskFlowerState().catch(() => null);
		const updated = refreshHataskFlowerStateAfterUpdate();
		old.reject(new TypeError('offline'));
		expect((await updated).drops).toBe(5);
		await oldRead;
		expect(api).toHaveBeenCalledTimes(2);
	});

	test('simultaneous external rewards share one fresh authoritative read', async () => {
		const { refreshHataskFlowerStateAfterUpdate } = await import('./hatask-flower-v2.js');
		api.mockResolvedValueOnce({ drops: 6 });
		const first = refreshHataskFlowerStateAfterUpdate();
		const second = refreshHataskFlowerStateAfterUpdate();
		expect(second).toBe(first);
		expect((await first).drops).toBe(6);
		expect(api).toHaveBeenCalledTimes(1);
	});

	test('a reward arriving during the fresh read forces a trailing read for all callers', async () => {
		const { refreshHataskFlowerStateAfterUpdate, HATASK_FLOWER_STATE_EVENT } = await import('./hatask-flower-v2.js');
		const pending = deferred<{ drops: number }>();
		api.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ drops: 7 });
		const events: number[] = [];
		const receive = (event: Event) => { events.push((event as CustomEvent).detail.drops); };
		window.addEventListener(HATASK_FLOWER_STATE_EVENT, receive);
		try {
			const first = refreshHataskFlowerStateAfterUpdate();
			await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
			const second = refreshHataskFlowerStateAfterUpdate();
			pending.resolve({ drops: 6 });
			expect((await first).drops).toBe(7);
			expect((await second).drops).toBe(7);
			expect(api).toHaveBeenCalledTimes(2);
			expect(events).toEqual([7]);
		} finally { window.removeEventListener(HATASK_FLOWER_STATE_EVENT, receive); }
	});
});
