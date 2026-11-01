/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HataigoBoard from './HataigoBoard.vue';
import HataigoLogo from './HataigoLogo.vue';
import { createBoard } from '@/utility/hataigo/rules/board.js';

const cleanups: (() => void)[] = [];

afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function mountBoard(interactive = true) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const onPlace = vi.fn();
	const onSelect = vi.fn();
	// eslint-disable-next-line vue/one-component-per-file -- Each mount owns an isolated test fixture.
	const app = createApp({ render: () => h(HataigoBoard, { position: createBoard(9, { black: [{ x: 0, y: 0 }] }), interactive, labels: true, onPlace, onSelect }) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
	return { host, buttons, onPlace, onSelect };
}

test('each intersection has a spoken coordinate and only one is in the tab order', () => {
	const { host, buttons } = mountBoard();
	expect(host.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe('9');
	expect(buttons).toHaveLength(81);
	expect(buttons[0].getAttribute('aria-label')).toBe('A9、黒');
	expect(buttons[80].getAttribute('aria-label')).toBe('J1、空き');
	expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1);
	expect(host.querySelectorAll('[role="row"]')).toHaveLength(9);
});

test('occupied intersections emit selection only and empty intersections emit coordinates too', () => {
	const { buttons, onPlace, onSelect } = mountBoard();
	buttons[0].click();
	expect(onSelect).toHaveBeenLastCalledWith({ x: 0, y: 0 });
	expect(onPlace).not.toHaveBeenCalled();
	buttons[1].click();
	expect(onSelect).toHaveBeenLastCalledWith({ x: 1, y: 0 });
	expect(onPlace).toHaveBeenCalledExactlyOnceWith(1, 0);
});

test('arrow keys move actual focus and Enter/Space activate their focused intersections', async () => {
	const { buttons, onPlace } = mountBoard();
	buttons[0].focus();
	buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
	await nextTick();
	expect(window.document.activeElement).toBe(buttons[1]);
	expect(buttons[1].tabIndex).toBe(0);
	expect(buttons[0].tabIndex).toBe(-1);
	buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	expect(onPlace).toHaveBeenLastCalledWith(1, 0);
	buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
	await nextTick();
	expect(window.document.activeElement).toBe(buttons[10]);
	buttons[10].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
	expect(onPlace).toHaveBeenLastCalledWith(1, 1);
	expect(onPlace).toHaveBeenCalledTimes(2);
});

test('a display-only board has no interactive controls', () => {
	const { host, buttons, onPlace } = mountBoard(false);
	expect(buttons).toHaveLength(0);
	expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('9路盤');
	expect(onPlace).not.toHaveBeenCalled();
});

function mountWithPointer(props: Record<string, unknown>) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const onPlace = vi.fn();
	// eslint-disable-next-line vue/one-component-per-file -- Each mount owns an isolated test fixture.
	const app = createApp({ render: () => h(HataigoBoard, { position: createBoard(9), interactive: true, turn: 'black', onPlace, ...props }) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	const grid = host.querySelector<HTMLElement>('svg')?.parentElement;
	if (!grid) throw new Error('grid not rendered');
	// jsdom has no layout: give the grid a 400px box so a tap maps to an intersection.
	grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
	const tap = async (x: number, y: number) => {
		for (const type of ['pointerdown', 'pointerup']) {
			const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }) as MouseEvent & { pointerId: number; isPrimary: boolean; pointerType: string };
			Object.assign(event, { pointerId: 1, isPrimary: true, pointerType: 'touch' });
			grid.dispatchEvent(event);
		}
		await nextTick();
	};
	return { host, onPlace, tap };
}

test('direct placement: one tap on the nearest intersection plays it', async () => {
	const { onPlace, tap } = mountWithPointer({ placement: 'direct' });
	await tap(51, 49);
	expect(onPlace).toHaveBeenCalledExactlyOnceWith(1, 1);
});

test('confirm placement: the first tap previews, the second tap or the button plays', async () => {
	const { host, onPlace, tap } = mountWithPointer({ placement: 'confirm' });
	await tap(200, 200);
	expect(onPlace).not.toHaveBeenCalled();
	expect(host.textContent).toContain('ここに打つ');
	expect(host.textContent).toContain('E5');
	await tap(150, 200);
	expect(onPlace).not.toHaveBeenCalled();
	expect(host.textContent).toContain('D5');
	await tap(150, 200);
	expect(onPlace).toHaveBeenCalledExactlyOnceWith(3, 4);
	await tap(50, 50);
	Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'ここに打つ')?.click();
	expect(onPlace).toHaveBeenLastCalledWith(1, 1);
});

test('scoring marks act at once even when placement asks for confirmation', async () => {
	const { onPlace, tap } = mountWithPointer({ placement: 'confirm', marking: true });
	await tap(100, 100);
	expect(onPlace).toHaveBeenCalledExactlyOnceWith(2, 2);
});

test('intersection buttons reset every inherited page style so the board stays visible', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const css = readFileSync(resolve(process.cwd(), 'src/components/hataigo/HataigoBoard.vue'), 'utf8');
	expect(css).toMatch(/\.board \.hit \{ all: unset;[^}]*pointer-events: none;/);
});

test('logo uses the provided flag and stone geometry without external assets', () => {
	const host = window.document.createElement('div');
	// eslint-disable-next-line vue/one-component-per-file -- Each mount owns an isolated test fixture.
	const app = createApp({ render: () => h(HataigoLogo, { size: 40 }) });
	app.mount(host);
	cleanups.push(() => app.unmount());
	expect(host.querySelector('rect')?.getAttribute('height')).toBe('66');
	expect(host.querySelector('circle')?.getAttribute('r')).toBe('19');
	expect(host.querySelectorAll('circle')).toHaveLength(3);
	expect(host.querySelector('span')?.style.backgroundColor).toBe('#d6cbf3');
	expect(host.querySelector('img')).toBeNull();
});
