/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, ref } from 'vue';
import AiGame from './ai-game.vue';
import type { PropType } from 'vue';
import type { Board } from '@/utility/hataigo/rules/board.js';
import type { SearchResult } from '@/utility/hataigo/engine/client.js';
import { aiText } from '@/utility/hataigo/i18n.js';

const fixture = vi.hoisted(() => ({ search: vi.fn(), cancel: vi.fn(), dispose: vi.fn(), save: vi.fn(), savePrefs: vi.fn(async () => true) }));
// The worker/board doubles and app harness are components local to this test.
/* eslint-disable vue/one-component-per-file */
vi.mock('@/utility/hataigo/engine/client.js', () => ({ createEngineClient: () => ({ search: fixture.search, cancel: fixture.cancel, dispose: fixture.dispose }) }));
vi.mock('@/utility/hataigo/ai-records.js', async () => {
	const { ref: makeRef } = await import('vue');
	return { useAiRecords: () => ({ records: makeRef([]), loaded: makeRef(true), error: makeRef(null), save: fixture.save }) };
});
vi.mock('@/utility/hataigo/prefs.js', async () => {
	const { reactive } = await import('vue');
	const prefs = reactive({ theme: 'fuji', stones: 'real', labels: true, autoplayInterval: 1000, showThought: true, showEstimate: true });
	return { useHataigoPrefs: () => ({ prefs, save: fixture.savePrefs }) };
});
vi.mock('@/i.js', () => ({ $i: { id: 'viewer', token: 'viewer-token', avatarUrl: '/self.png' } }));
vi.mock('@/components/hataigo/HataigoBoard.vue', async () => {
	const { defineComponent, h: makeNode } = await import('vue');
	return { default: defineComponent({ inheritAttrs: false, props: { position: { type: Object as PropType<Board>, required: true } }, setup(props) { return () => makeNode('output', { 'data-stones': '' }, String(props.position.cells.filter(stone => stone !== null).length)); } }) };
});

function result(): SearchResult {
	return { move: null, candidates: [{ point: null, visits: 1, winRate: 0.5 }], playouts: 1, attempts: 1, elapsedMs: 1, stopped: 'budget', estimatedMargin: 0, ownership: { black: Array(81).fill(0), white: Array(81).fill(0), neutral: Array(81).fill(1), samples: 1 } };
}

const cleanups: (() => void)[] = [];
beforeEach(() => { fixture.search.mockReset().mockResolvedValue(result()); fixture.cancel.mockReset(); fixture.dispose.mockReset(); fixture.save.mockReset().mockResolvedValue(true); });
afterEach(() => cleanups.splice(0).forEach(dispose => dispose()));

async function flush(): Promise<void> { for (let i = 0; i < 6; i++) await Promise.resolve(); await nextTick(); }

async function mount() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const visible = ref(true);
	const app = createApp({ render: () => h(KeepAlive, null, { default: () => visible.value ? h(AiGame, { initialSize: 9, active: true }) : h('div') }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick();
	return { target, visible };
}

function button(target: HTMLElement, label: string): HTMLButtonElement {
	const value = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent.trim() === label);
	if (value === undefined) throw new Error(`Missing button ${label}`);
	return value;
}

async function start(target: HTMLElement): Promise<void> { button(target, aiText.start).click(); await flush(); }

describe('AI game user actions', () => {
	it('opens resignation confirmation and saves only after the explicit confirmation', async () => {
		const { target } = await mount();
		await start(target);
		button(target, aiText.resign).click();
		await nextTick();
		expect(target.textContent).toContain(aiText.resignTitle);
		expect(fixture.save).not.toHaveBeenCalled();
		button(target, aiText.cancel).click();
		await nextTick();
		expect(target.textContent).not.toContain(aiText.finished);
		button(target, aiText.resign).click();
		await nextTick();
		button(target, aiText.confirmResign).click();
		await flush();
		expect(target.textContent).toContain(aiText.finished);
		expect(fixture.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ size: 9, ownColor: 'black', winner: 'white', reason: 'resign' }));
	});

	it('keeps the progress row and the elements above the board the same while the AI thinks', async () => {
		let resolve: (value: SearchResult) => void = () => {};
		fixture.search.mockImplementation(() => new Promise(res => { resolve = res; }));
		const { target } = await mount();
		await start(target);
		const progress = () => target.querySelector('[data-active]');
		const barRows = () => [...progress()?.parentElement?.children ?? []].map(element => element.getAttribute('class') ?? element.tagName);
		expect(progress()?.getAttribute('data-active')).toBe('false');
		const before = barRows();
		button(target, aiText.pass).click();
		await flush();
		expect(target.textContent).toContain(aiText.thinking);
		expect(progress()?.getAttribute('data-active')).toBe('true');
		// 盤の上の操作帯の行が考え中でも増えも減りもしない（＝盤が上下にずれない）
		expect(barRows()).toEqual(before);
		resolve(result());
		await flush();
	});

	it('hides and shows the AI thought and estimate cards independently and remembers the choice', async () => {
		const { target } = await mount();
		await start(target);
		const toggle = (label: string) => target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
		expect(target.textContent).toContain(aiText.thoughtEmpty);
		toggle(`${aiText.thoughtTitle}を隠す`)?.click();
		await nextTick();
		expect(target.textContent).not.toContain(aiText.thoughtEmpty);
		expect(target.textContent).toContain(aiText.estimateUnknown);
		expect(fixture.savePrefs).toHaveBeenLastCalledWith({ showThought: false });
		toggle(`${aiText.estimateTitle}を隠す`)?.click();
		await nextTick();
		expect(target.textContent).not.toContain(aiText.estimateUnknown);
		expect(fixture.savePrefs).toHaveBeenLastCalledWith({ showEstimate: false });
		// 見出しと「出す」ボタンは残る
		expect(target.textContent).toContain(aiText.thoughtTitle);
		toggle(`${aiText.thoughtTitle}を出す`)?.click();
		await nextTick();
		expect(target.textContent).toContain(aiText.thoughtEmpty);
	});

	it('shows a two-pass scoring draft and saves nothing until the scoring button is pressed', async () => {
		const { target } = await mount();
		await start(target);
		button(target, aiText.pass).click();
		await flush();
		expect(target.textContent).toContain(aiText.scoringTitle);
		expect(target.textContent).not.toContain(aiText.finished);
		expect(fixture.save).not.toHaveBeenCalled();
		button(target, aiText.estimate).click();
		await flush();
		expect(target.textContent).toContain(aiText.scoringDraft);
		expect(fixture.save).not.toHaveBeenCalled();
		button(target, aiText.confirmScore).click();
		await flush();
		expect(target.textContent).toContain(aiText.finished);
		expect(fixture.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'score', winner: 'white' }));
	});

	it('undoes the visible AI stone once and waits for an explicit resume', async () => {
		const answer = result();
		answer.move = { x: 8, y: 8 };
		fixture.search.mockResolvedValue(answer);
		const { target } = await mount();
		await start(target);
		button(target, aiText.pass).click();
		await flush();
		expect(target.querySelector('[data-stones]')?.textContent).toBe('1');
		button(target, aiText.undo).click();
		await flush();
		expect(target.querySelector('[data-stones]')?.textContent).toBe('0');
		expect(button(target, aiText.resume)).toBeInstanceOf(HTMLButtonElement);
		expect(fixture.search).toHaveBeenCalledTimes(1);
	});

	it('disposes the worker on KeepAlive deactivation and ignores its late move', async () => {
		let resolve: (value: SearchResult) => void = () => {};
		fixture.search.mockImplementation(() => new Promise(res => { resolve = res; }));
		const { target, visible } = await mount();
		await start(target);
		button(target, aiText.pass).click();
		await flush();
		visible.value = false;
		await nextTick();
		expect(fixture.dispose).toHaveBeenCalledTimes(1);
		const answer = result();
		answer.move = { x: 8, y: 8 };
		resolve(answer);
		await flush();
		visible.value = true;
		await nextTick();
		expect(target.querySelector('[data-stones]')?.textContent).toBe('0');
		expect(button(target, aiText.resume)).toBeInstanceOf(HTMLButtonElement);
	});
});
