/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('post send delay', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-06T00:00:00Z'));
	});

	test('未設定はOFF・5秒で、旧形式の任意秒数は最も近いプリセットへ寄せて保存する', async () => {
		const delay = await import('./post-send-delay.js');
		expect(delay.postSendDelayEnabled.value).toBe(false);
		expect(delay.postSendDelaySeconds.value).toBe(5);

		delay.setPostSendDelayEnabled(true);
		delay.setPostSendDelaySeconds(99);
		expect(localStorage.getItem('hataPostDelayEnabled')).toBe('true');
		expect(delay.postSendDelaySeconds.value).toBe(10);
		delay.setPostSendDelaySeconds(0);
		expect(delay.postSendDelaySeconds.value).toBe(3);
		delay.setPostSendDelaySeconds(7);
		expect(delay.postSendDelaySeconds.value).toBe(5);
	});

	test('時間切れで送信へ進み、枠の残量も減る', async () => {
		const { createPostSendDelayController } = await import('./post-send-delay.js');
		const controller = createPostSendDelayController();
		const result = controller.begin(5);
		expect(controller.active.value).toBe(true);
		expect(controller.remainingSeconds.value).toBe(5);

		await vi.advanceTimersByTimeAsync(2100);
		expect(controller.remainingSeconds.value).toBe(3);
		expect(controller.progress.value).toBeLessThan(0.6);
		await vi.advanceTimersByTimeAsync(2900);
		expect(await result).toBe(true);
		expect(controller.active.value).toBe(false);
		expect(controller.exitMode.value).toBe('complete');
	});

	test('取り消し・今すぐ投稿・破棄を区別し、二重開始を防ぐ', async () => {
		const { createPostSendDelayController } = await import('./post-send-delay.js');
		const controller = createPostSendDelayController();

		const canceled = controller.begin(5);
		expect(await controller.begin(5)).toBe(false);
		controller.cancel();
		expect(await canceled).toBe(false);
		expect(controller.exitMode.value).toBe('cancel');

		const immediate = controller.begin(5);
		controller.sendNow();
		expect(await immediate).toBe(true);
		expect(controller.exitMode.value).toBe('complete');

		const disposed = controller.begin(5);
		controller.dispose();
		expect(await disposed).toBe(false);
		expect(controller.exitMode.value).toBe('cancel');
	});
});
