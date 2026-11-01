/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, it } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HataigoHelp from './HataigoHelp.vue';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); });

function mount(text: string): HTMLElement {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HataigoHelp, { label: 'AIの読み', text }) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return host;
}

it('keeps the explanation behind the i button and closes it from outside or with Escape', async () => {
	const host = mount('勝率は、目安です。');
	const button = host.querySelector('button');
	if (!button) throw new Error('button not rendered');
	expect(button.getAttribute('aria-label')).toBe('AIの読みの説明');
	expect(host.querySelector('[role="note"]')).toBeNull();
	button.click();
	await nextTick();
	expect(button.getAttribute('aria-expanded')).toBe('true');
	expect(host.querySelector('[role="note"]')?.textContent).toBe('勝率は、目安です。');
	window.document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
	await nextTick();
	expect(host.querySelector('[role="note"]')).toBeNull();
	button.click();
	await nextTick();
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
	await nextTick();
	expect(host.querySelector('[role="note"]')).toBeNull();
});

it('puts each sentence on its own line and allows a break only after 、 and 。', async () => {
	const host = mount('下の線の長さは、読んだ回数の割合です。AIは、いちばん多く読んだ手を選びます。');
	host.querySelector('button')?.click();
	await nextTick();
	const sentences = [...host.querySelectorAll('[role="note"] > span')];
	expect(sentences.map(sentence => sentence.textContent)).toEqual(['下の線の長さは、読んだ回数の割合です。', 'AIは、いちばん多く読んだ手を選びます。']);
	// 折り返してよい位置（<wbr>）は「、」「。」のあとだけ
	expect(sentences.map(sentence => sentence.innerHTML.split('<wbr>').filter(Boolean))).toEqual([['下の線の長さは、', '読んだ回数の割合です。'], ['AIは、', 'いちばん多く読んだ手を選びます。']]);
});
