/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { useSlidingIndicator } from './sliding-indicator.js';

// The tab hosts are small components local to each test.
/* eslint-disable vue/one-component-per-file */
const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); vi.unstubAllGlobals(); });

// jsdom にはレイアウトが無いので、各タブの位置と大きさを決め打ちする
function layout(element: HTMLElement, left: number, width: number): void {
	Object.defineProperties(element, { offsetLeft: { value: left }, offsetTop: { value: 4 }, offsetWidth: { value: width }, offsetHeight: { value: 40 } });
}

it('slides to the selected tab only when the selection changes, after an instant first placement', async () => {
	const frames: FrameRequestCallback[] = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
	vi.stubGlobal('cancelAnimationFrame', () => {});
	const selected = ref('a');
	let api: ReturnType<typeof useSlidingIndicator> | undefined;
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp(defineComponent({
		setup() {
			const root = ref<HTMLElement | null>(null);
			api = useSlidingIndicator(root, '[data-on="true"]', () => selected.value);
			return () => h('div', { ref: root }, ['a', 'b'].map((id, index) => h('button', { 'data-on': String(selected.value === id), ref: (element: unknown) => { if (element instanceof HTMLElement && !('offsetLeft' in Object.getOwnPropertyDescriptors(element))) layout(element, 4 + index * 100, 96); } })));
		},
	}));
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	expect(api?.style.value).toEqual({ opacity: '1', width: '96px', height: '40px', transform: 'translate(4px, 4px)' });
	// 最初は動かさずに置き、次のフレームから動きを付ける
	expect(api?.animate.value).toBe(false);
	frames.forEach(frame => frame(0));
	expect(api?.animate.value).toBe(true);
	selected.value = 'b';
	await nextTick();
	await nextTick();
	expect(api?.style.value.transform).toBe('translate(104px, 4px)');
	expect(api?.animate.value).toBe(true);
});

it('hides the indicator when nothing is selected or the tabs are not laid out', () => {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	let api: ReturnType<typeof useSlidingIndicator> | undefined;
	const app = createApp(defineComponent({
		setup() {
			const root = ref<HTMLElement | null>(null);
			api = useSlidingIndicator(root, '[data-on="true"]', () => 'none');
			return () => h('div', { ref: root }, [h('button', { 'data-on': 'false' })]);
		},
	}));
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	expect(api?.style.value).toEqual({ opacity: '0' });
});
