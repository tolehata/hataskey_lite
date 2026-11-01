/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, ref } from 'vue';
import Analysis from './analysis.vue';
import type { SearchResult } from '@/utility/hataigo/engine/client.js';
import { historyText } from '@/utility/hataigo/history.js';
import { aiText, recordText } from '@/utility/hataigo/i18n.js';

const engine = vi.hoisted(() => ({ search: vi.fn(), cancel: vi.fn(), dispose: vi.fn() }));
vi.mock('@/utility/hataigo/engine/client.js', () => ({ createEngineClient: () => ({ search: engine.search, cancel: engine.cancel, dispose: engine.dispose }) }));

vi.mock('@/utility/hataigo/prefs.js', async () => {
	const { reactive } = await import('vue');
	return { useHataigoPrefs: () => ({ prefs: reactive({ theme: 'fuji', stones: 'real', labels: true, autoplayInterval: 1000 }), save: vi.fn().mockResolvedValue(true) }) };
});
vi.mock('@/components/hataigo/HataigoBoard.vue', () => ({ default: { inheritAttrs: false, template: '<div role="img" aria-label="local board"></div>' } }));
const menu = vi.hoisted(() => ({ popupMenu: vi.fn() }));
vi.mock('@/os.js', () => ({ popupMenu: menu.popupMenu }));

const cleanups: (() => void)[] = [];
beforeEach(() => { vi.useFakeTimers(); engine.search.mockReset(); engine.cancel.mockReset(); engine.dispose.mockReset(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); });

async function mount(options: { enterBoard?: boolean } = {}) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const visible = ref(true);
	const active = ref(true);
	const replayRequest = ref<{ id: string; sgf: string }>();
	const app = createApp({ render: () => h(KeepAlive, null, { default: () => visible.value ? h(Analysis, { active: active.value, replayRequest: replayRequest.value, mode: 'solo', initialSize: 9 }) : h('div') }) });
	app.mount(target);
	let mounted = true;
	const dispose = () => { if (mounted) { app.unmount(); target.remove(); mounted = false; } };
	cleanups.push(dispose);
	await nextTick();
	// ひとりで並べるは条件の画面から始まる。既存のテストは盤の画面で行う
	if (options.enterBoard !== false) { button(target, recordText.newBoard).click(); await nextTick(); }
	return { target, visible, active, dispose, replayRequest };
}

function button(target: HTMLElement, label: string): HTMLButtonElement {
	const result = [...target.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.getAttribute('aria-label') === label || candidate.textContent.trim() === label);
	if (result === undefined) throw new Error(`Missing button: ${label}`);
	return result;
}

function moveNumber(target: HTMLElement): number {
	return Number(target.querySelector('output b')?.textContent);
}

async function startRecord(target: HTMLElement): Promise<void> {
	button(target, recordText.pass).click();
	button(target, recordText.pass).click();
	await nextTick();
	button(target, recordText.first).click();
	await nextTick();
	button(target, recordText.play).click();
	await nextTick();
}

describe('HataIgo analysis playback lifecycle', () => {
	it('stops autoplay when cached by KeepAlive and preserves the unsaved record', async () => {
		const { target, visible } = await mount();
		await startRecord(target);
		await vi.advanceTimersByTimeAsync(1000);
		expect(moveNumber(target)).toBe(1);
		visible.value = false;
		await nextTick();
		await vi.advanceTimersByTimeAsync(5000);
		visible.value = true;
		await nextTick();
		expect(moveNumber(target)).toBe(1);
		expect(target.querySelector('output')?.textContent).toContain('/ 2');
		expect(button(target, recordText.play).getAttribute('aria-pressed')).toBe('false');
	});

	it('stops autoplay when the host pane becomes inactive and does not restart itself', async () => {
		const { target, active } = await mount();
		await startRecord(target);
		active.value = false;
		await nextTick();
		await vi.advanceTimersByTimeAsync(5000);
		expect(moveNumber(target)).toBe(0);
		active.value = true;
		await nextTick();
		expect(button(target, recordText.play).getAttribute('aria-pressed')).toBe('false');
		expect(moveNumber(target)).toBe(0);
	});

	it('clears the pending autoplay timeout on unmount', async () => {
		const { target, dispose } = await mount();
		await startRecord(target);
		expect(vi.getTimerCount()).toBeGreaterThan(0);
		dispose();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(5000);
	});

	it('stops at the final move and supports restarting from the beginning', async () => {
		const { target } = await mount();
		await startRecord(target);
		await vi.advanceTimersByTimeAsync(2000);
		expect(moveNumber(target)).toBe(2);
		expect(button(target, recordText.play).getAttribute('aria-pressed')).toBe('false');
		button(target, recordText.play).click();
		await nextTick();
		expect(moveNumber(target)).toBe(0);
		await vi.advanceTimersByTimeAsync(1000);
		expect(moveNumber(target)).toBe(1);
	});
});

function reviewResult(margin: number | null): SearchResult {
	return { move: { x: 1, y: 1 }, candidates: [{ point: { x: 0, y: 0 }, visits: 1, winRate: null }, { point: { x: 1, y: 1 }, visits: 9, winRate: 0.5 }, { point: { x: 2, y: 2 }, visits: 4, winRate: 0.25 }], playouts: margin === null ? 0 : 14, attempts: 14, elapsedMs: 1, stopped: 'budget', estimatedMargin: margin, ownership: { black: Array(81).fill(0), white: Array(81).fill(0), neutral: Array(81).fill(1), samples: margin === null ? 0 : 14 } };
}

async function flushReview(): Promise<void> { for (let i = 0; i < 6; i++) await Promise.resolve(); await nextTick(); }

describe('local record AI review', () => {
	it('sorts candidates by visits and keeps estimates attached to their exact move', async () => {
		engine.search.mockResolvedValueOnce(reviewResult(1)).mockResolvedValueOnce(reviewResult(2));
		const { target } = await mount();
		button(target, recordText.review).click();
		await nextTick();
		button(target, aiText.review).click();
		await flushReview();
		expect(target.textContent.indexOf('B8')).toBeLessThan(target.textContent.indexOf('C7'));
		expect(target.textContent).toContain('黒 +1.0');
		button(target, recordText.pass).click();
		await nextTick();
		expect(target.textContent).toContain(aiText.estimateUnknown);
		button(target, aiText.review).click();
		await flushReview();
		expect(target.textContent).toContain('黒 +2.0');
		button(target, recordText.previous).click();
		await nextTick();
		expect(target.textContent).toContain('黒 +1.0');
	});

	it('cancels navigation and deactivation searches and ignores stale worker estimates', async () => {
		let resolve: (value: SearchResult) => void = () => {};
		engine.search.mockImplementation(() => new Promise(res => { resolve = res; }));
		const { target, visible } = await mount();
		button(target, recordText.review).click();
		await nextTick();
		button(target, aiText.review).click();
		await nextTick();
		button(target, recordText.pass).click();
		await nextTick();
		expect(engine.cancel).toHaveBeenCalled();
		resolve(reviewResult(90));
		await flushReview();
		expect(target.textContent).not.toContain('黒 +90.0');
		button(target, aiText.review).click();
		await nextTick();
		visible.value = false;
		await nextTick();
		expect(engine.dispose).toHaveBeenCalledTimes(1);
		resolve(reviewResult(80));
		await flushReview();
		visible.value = true;
		await nextTick();
		expect(target.textContent).not.toContain('黒 +80.0');
	});
});

describe('solo setup and board are separate screens', () => {
	it('starts on the setup screen, opens the board, and switches back and forth without losing moves', async () => {
		const { target } = await mount({ enterBoard: false });
		expect(target.querySelector('[aria-label="local board"]')).toBeNull();
		expect(target.textContent).not.toContain(recordText.backToBoard);
		button(target, recordText.newBoard).click();
		await nextTick();
		expect(target.querySelector('[aria-label="local board"]')).not.toBeNull();
		button(target, recordText.pass).click();
		await nextTick();
		expect(target.querySelector('output')?.textContent).toContain('/ 1');
		button(target, recordText.changeSetup).click();
		await nextTick();
		expect(target.querySelector('[aria-label="local board"]')).toBeNull();
		button(target, recordText.backToBoard).click();
		await nextTick();
		// 条件の画面を経由しても盤の記録は残る
		expect(target.querySelector('output')?.textContent).toContain('/ 1');
		button(target, recordText.changeSetup).click();
		await nextTick();
		button(target, recordText.newBoard).click();
		await nextTick();
		// 打ちかけの盤があるときは、新しく始める前に確かめる
		expect(target.textContent).toContain(recordText.resetConfirm);
		button(target, recordText.confirmReset).click();
		await nextTick();
		expect(target.querySelector('output')?.textContent).toContain('/ 0');
	});

	it('offers opening a record as step 2 of the setup, and keeps SGF actions behind one button on the board', async () => {
		const { target } = await mount({ enterBoard: false });
		menu.popupMenu.mockClear();
		// 条件の画面：段組みの「2 棋譜から始める」から開く。SGF のメニューは出さない
		expect(target.textContent).toContain(recordText.fromRecordStep);
		expect([...target.querySelectorAll('button')].some(item => item.getAttribute('aria-label') === recordText.sgfMenu)).toBe(false);
		expect([...target.querySelectorAll('button')].some(item => item.textContent.includes(recordText.importSgf))).toBe(true);
		button(target, recordText.newBoard).click();
		await nextTick();
		button(target, recordText.sgfMenu).click();
		expect(menu.popupMenu.mock.calls.at(-1)?.[0].map((item: { text?: string; type?: string }) => item.text ?? item.type)).toEqual([recordText.importSgf, 'divider', recordText.exportSgf, recordText.includeComments]);
	});
});

describe('external replay preserves unsaved analysis until confirmation', () => {
	it('lets the user cancel or explicitly replace the current record', async () => {
		const { target, replayRequest } = await mount();
		button(target, recordText.pass).click();
		await nextTick();
		expect(target.querySelector('output')?.textContent).toContain('/ 1');
		replayRequest.value = { id: 'request-1', sgf: '(;SZ[9];B[aa];W[bb])' };
		await nextTick();
		expect(target.textContent).toContain(historyText.loadExternal);
		expect(target.querySelector('output')?.textContent).toContain('/ 1');
		button(target, historyText.cancelLoad).click();
		await nextTick();
		expect(target.querySelector('output')?.textContent).toContain('/ 1');
		replayRequest.value = { id: 'request-2', sgf: '(;SZ[9];B[aa];W[bb])' };
		await nextTick();
		button(target, historyText.confirmLoad).click();
		await nextTick();
		expect(target.querySelector('output')?.textContent).toContain('/ 2');
		expect(target.textContent).not.toContain(historyText.loadExternal);
	});
});
