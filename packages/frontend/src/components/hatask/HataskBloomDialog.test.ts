/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { App } from 'vue';
import HataskBloomDialog from './HataskBloomDialog.vue';
import { hotkeyDirective } from '@/directives/hotkey.js';

// Keep MkModal, its transitions, and focusTrap real so these tests exercise
// the teleported dialog's focus and background inert lifecycle.
vi.mock('@/os.js', () => ({ claimZIndex: vi.fn(() => 2000) }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, menuStyle: 'auto', useBlurEffectForModal: false, removeModalBgColorForBlur: false } } }));
vi.mock('@/components/HataskEmoji.vue', () => ({ default: { props: ['emoji'], render: () => h('span') } }));

const mounted: { app: App<Element>; garden: HTMLElement }[] = [];

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});

async function settle() {
	await nextTick();
	await vi.advanceTimersByTimeAsync(350);
	await nextTick();
}

afterEach(() => {
	for (const { app, garden } of mounted.splice(0)) {
		app.unmount();
		garden.remove();
	}
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function required<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing bloom dialog element: ${selector}`);
	return element;
}

async function mount() {
	const garden = document.createElement('main');
	const source = document.createElement('button');
	source.textContent = '咲いた花を見る';
	const container = document.createElement('div');
	garden.append(source, container);
	document.body.append(garden);
	source.focus();
	const shown = ref(true);
	const events = { harvested: [] as string[], closed: 0 };
	const app = createApp(defineComponent({ setup: () => () => shown.value ? h(HataskBloomDialog, {
		flower: { id: 'bloom-1', name: 'デイジー', emoji: '🌼', nickname: 'もとの名前' },
		source,
		animations: false,
		onHarvest: nickname => { events.harvested.push(nickname); },
		onClosed: () => { events.closed++; shown.value = false; },
	}) : null }));
	app.directive('hotkey', hotkeyDirective);
	app.mount(container);
	mounted.push({ app, garden });
	await settle();
	return { app, garden, source, events };
}

describe('HataskBloomDialog with the real modal focus trap', () => {
	test('renders outside the inert garden and accepts a nickname before harvesting', async () => {
		const { garden, events } = await mount();
		const panel = required<HTMLElement>('[role="dialog"]');
		const modalRoot = required<HTMLElement>('.hatask-bloom-modal');
		expect(modalRoot.parentElement).toBe(document.body);
		expect(garden.contains(panel)).toBe(false);
		expect(garden.inert).toBe(true);
		for (let ancestor: HTMLElement | null = panel; ancestor; ancestor = ancestor.parentElement) {
			expect(ancestor.inert).not.toBe(true);
		}
		const input = required<HTMLInputElement>('[role="dialog"] input');
		expect(document.activeElement).toBe(input);
		expect(input.disabled).toBe(false);
		expect(input.value).toBe('もとの名前');
		input.value = '  朝のひかり  ';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		required<HTMLButtonElement>('[role="dialog"] .harvest').click();
		expect(events.harvested).toEqual(['朝のひかり']);
		expect(events.closed).toBe(0);
	});

	test('rerolls only the leading phrase and keeps the flower name', async () => {
		await mount();
		const input = required<HTMLInputElement>('[role="dialog"] input');
		const label = required<HTMLLabelElement>('[role="dialog"] .name label');
		expect(label.htmlFor).toBe(input.id);
		const before = input.value;
		required<HTMLButtonElement>('[role="dialog"] .reroll').click();
		await nextTick();
		expect(input.value).not.toBe(before);
		expect(input.value.endsWith('デイジー')).toBe(true);
		expect(input.value.length).toBeGreaterThan('デイジー'.length);
		expect(window.document.activeElement).toBe(input);
	});

	test('Escape closes once, restores the background, and returns focus to the opener', async () => {
		const { garden, source, events } = await mount();
		required<HTMLInputElement>('[role="dialog"] input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(events.closed).toBe(1);
		expect(events.harvested).toEqual([]);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(garden.inert).toBe(false);
		expect(document.activeElement).toBe(source);
	});
});
