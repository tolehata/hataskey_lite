/* SPDX-License-Identifier: AGPL-3.0-only */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSettingsBentoMotion } from './settings-bento-motion.js';

function deferred() {
	let resolve!: () => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function nativeMock() {
	const calls: Array<{
		apply: () => Promise<void>;
		ready: ReturnType<typeof deferred>;
		finished: ReturnType<typeof deferred>;
		updated: ReturnType<typeof deferred>;
		skip: ReturnType<typeof vi.fn>;
		types: Set<string>;
	}> = [];
	const start = vi.fn((apply: () => Promise<void>) => {
		const call = { apply, ready: deferred(), finished: deferred(), updated: deferred(), skip: vi.fn(), types: new Set<string>() };
		calls.push(call);
		return { ready: call.ready.promise, finished: call.finished.promise, updateCallbackDone: call.updated.promise, skipTransition: call.skip, types: call.types };
	});
	vi.stubGlobal('document', { startViewTransition: start });
	return { start, calls };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('settings bento motion', () => {
	test.each([false, true])('motion無効または非対応なら更新とnextTickを一度実行する enabled=%s', enabled => {
		const tick = vi.fn(async () => {});
		const start = vi.fn();
		vi.stubGlobal('document', { startViewTransition: enabled ? undefined : start });
		const motion = createSettingsBentoMotion({ enabled: () => enabled, nextTick: tick });
		const update = vi.fn();
		return motion.transition(update).then(() => {
			expect(update).toHaveBeenCalledTimes(1);
			expect(tick).toHaveBeenCalledTimes(1);
			expect(start).not.toHaveBeenCalled();
		});
	});

	test('native開始失敗でも更新を失わない', async () => {
		vi.stubGlobal('document', { startViewTransition: () => { throw new Error('unavailable'); } });
		const update = vi.fn();
		const tick = vi.fn(async () => {});
		await createSettingsBentoMotion({ enabled: () => true, nextTick: tick }).transition(update);
		expect(update).toHaveBeenCalledTimes(1);
		expect(tick).toHaveBeenCalledTimes(1);
	});

	test('更新完了後はanimation.finishedを待たず戻り、finishedで参照を解放する', async () => {
		const { calls } = nativeMock();
		const update = vi.fn();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const result = motion.transition(update);
		expect(update).not.toHaveBeenCalled();
		expect(calls[0].types.has('settings-bento')).toBe(true);
		await calls[0].apply();
		calls[0].updated.resolve();
		await result;
		expect(update).toHaveBeenCalledTimes(1);
		calls[0].finished.resolve();
		await Promise.resolve();
		motion.cancel();
		expect(calls[0].skip).not.toHaveBeenCalled();
	});

	test('連打後に遅れて来た古いcallbackは新しい画面を上書きしない', async () => {
		const { calls } = nativeMock();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const first = vi.fn();
		const second = vi.fn();
		const firstResult = motion.transition(first);
		const secondResult = motion.transition(second);
		expect(calls[0].skip).toHaveBeenCalledTimes(1);
		await calls[1].apply();
		calls[1].updated.resolve();
		await secondResult;
		await calls[0].apply();
		calls[0].updated.resolve();
		calls[0].ready.reject(new Error('skipped'));
		calls[0].finished.resolve();
		await firstResult;
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
		motion.cancel();
		expect(calls[1].skip).toHaveBeenCalledTimes(1);
	});

	test('deactivateによるcancel(true)後にnativeがcallbackを呼んでも更新しない', async () => {
		const { calls } = nativeMock();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const update = vi.fn();
		const result = motion.transition(update);
		motion.cancel(true);
		await calls[0].apply();
		calls[0].updated.resolve();
		calls[0].ready.reject(new Error('skipped'));
		calls[0].finished.resolve();
		await result;
		expect(update).not.toHaveBeenCalled();
		expect(calls[0].skip).toHaveBeenCalledTimes(1);
	});

	test('resizeやmotion無効化によるcancel()では選択した行き先を失わない', async () => {
		const { calls } = nativeMock();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const update = vi.fn();
		const result = motion.transition(update);
		motion.cancel();
		await calls[0].apply();
		calls[0].updated.resolve();
		calls[0].ready.reject(new Error('skipped'));
		calls[0].finished.resolve();
		await result;
		expect(update).toHaveBeenCalledTimes(1);
		expect(calls[0].skip).toHaveBeenCalledTimes(1);
	});

	test('native失敗のpromiseを処理し、callback適用後の失敗で更新を繰り返さない', async () => {
		const { calls } = nativeMock();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const update = vi.fn();
		const result = motion.transition(update);
		await calls[0].apply();
		calls[0].ready.reject(new Error('snapshot failed'));
		calls[0].updated.reject(new Error('native failed'));
		calls[0].finished.reject(new Error('native failed'));
		await result;
		expect(update).toHaveBeenCalledTimes(1);
		motion.cancel();
		expect(calls[0].skip).not.toHaveBeenCalled();
	});

	test('更新前のnative失敗はfallbackで一度だけ更新する', async () => {
		const { calls } = nativeMock();
		const motion = createSettingsBentoMotion({ enabled: () => true, nextTick: async () => {} });
		const update = vi.fn();
		const result = motion.transition(update);
		calls[0].ready.reject(new Error('native failed'));
		calls[0].updated.reject(new Error('native failed'));
		calls[0].finished.reject(new Error('native failed'));
		await result;
		await calls[0].apply();
		expect(update).toHaveBeenCalledTimes(1);
	});
});
