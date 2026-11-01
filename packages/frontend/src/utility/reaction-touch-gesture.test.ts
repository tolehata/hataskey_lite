/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	REACTION_DETAILS_HOLD_MS,
	REACTION_MENU_HOLD_MS,
	ReactionTouchGesture,
} from './reaction-touch-gesture.js';

describe('モバイルのリアクションチップ長押し', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function setup() {
		const showDetails = vi.fn();
		const hideDetails = vi.fn();
		const showMenu = vi.fn();
		const gesture = new ReactionTouchGesture({ showDetails, hideDetails, showMenu });
		return { gesture, showDetails, hideDetails, showMenu };
	}

	test('短いタップでは詳細もメニューも開かずclickを維持する', async () => {
		const { gesture, showDetails, showMenu } = setup();
		gesture.start({ x: 10, y: 10 });
		await vi.advanceTimersByTimeAsync(REACTION_DETAILS_HOLD_MS - 1);
		gesture.end();
		await vi.runAllTimersAsync();

		expect(showDetails).not.toHaveBeenCalled();
		expect(showMenu).not.toHaveBeenCalled();
		expect(gesture.consumeSyntheticClick()).toBe(false);
	});

	test('長押しでは利用者一覧を開き、指を離すとすぐ閉じる', async () => {
		const { gesture, showDetails, hideDetails, showMenu } = setup();
		gesture.start({ x: 10, y: 10 });
		await vi.advanceTimersByTimeAsync(REACTION_DETAILS_HOLD_MS);
		expect(showDetails).toHaveBeenCalledOnce();
		expect(hideDetails).not.toHaveBeenCalled();

		gesture.end();

		expect(showMenu).not.toHaveBeenCalled();
		expect(hideDetails).toHaveBeenCalledTimes(1);
		expect(gesture.consumeSyntheticClick()).toBe(true);
		expect(gesture.consumeSyntheticClick()).toBe(false);
	});

	test('継続長押しは接触中だけ利用者一覧を残して操作メニューを開く', async () => {
		const { gesture, showDetails, hideDetails, showMenu } = setup();
		gesture.start({ x: 10, y: 10 });
		await vi.advanceTimersByTimeAsync(REACTION_MENU_HOLD_MS);

		expect(showDetails).toHaveBeenCalledOnce();
		expect(showMenu).toHaveBeenCalledOnce();
		expect(hideDetails).not.toHaveBeenCalled();

		gesture.end();
		expect(hideDetails).toHaveBeenCalledOnce();
	});

	test('指が移動した場合は長押しを中止してスクロールを優先する', async () => {
		const { gesture, showDetails, showMenu } = setup();
		gesture.start({ x: 10, y: 10 });
		gesture.move({ x: 30, y: 10 });
		await vi.runAllTimersAsync();

		expect(showDetails).not.toHaveBeenCalled();
		expect(showMenu).not.toHaveBeenCalled();
	});

	test('利用者一覧の表示後に指が動いた場合もすぐ閉じる', async () => {
		const { gesture, showDetails, hideDetails, showMenu } = setup();
		gesture.start({ x: 10, y: 10 });
		await vi.advanceTimersByTimeAsync(REACTION_DETAILS_HOLD_MS);
		gesture.move({ x: 30, y: 10 });

		expect(showDetails).toHaveBeenCalledOnce();
		expect(hideDetails).toHaveBeenCalledOnce();
		expect(showMenu).not.toHaveBeenCalled();
	});

	test('同じタッチからiOSが生成したcontextmenuだけを抑止する', async () => {
		const { gesture } = setup();
		gesture.start({ x: 10, y: 10 });
		expect(gesture.shouldBlockContextMenu()).toBe(true);
		gesture.end();
		expect(gesture.shouldBlockContextMenu()).toBe(true);
		await vi.advanceTimersByTimeAsync(800);
		expect(gesture.shouldBlockContextMenu()).toBe(false);
	});

	test('合成clickが来ない端末でも次の通常タップを消さない', async () => {
		const { gesture } = setup();
		gesture.start({ x: 10, y: 10 });
		await vi.advanceTimersByTimeAsync(REACTION_DETAILS_HOLD_MS);
		gesture.end();
		await vi.advanceTimersByTimeAsync(800);

		expect(gesture.consumeSyntheticClick()).toBe(false);
	});
});
