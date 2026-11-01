/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref, shallowReactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskFlowerCollection from './HataskFlowerCollection.vue';
import type { App } from 'vue';
import type { HataskFlowerCollectionLabels } from './HataskFlowerCollection.vue';
import type { HataskFlowerSelection, HataskFlowerView } from './hatask-flower-view.js';
import { hotkeyDirective } from '@/directives/hotkey.js';
import { claimZIndex } from '@/os.js';

vi.mock('@/os.js', () => ({ claimZIndex: vi.fn(() => 2000) }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, menuStyle: 'auto', useBlurEffectForModal: false, removeModalBgColorForBlur: false } } }));
vi.mock('@/components/HataskEmoji.vue', async () => {
	const { defineComponent: component, h: node } = await import('vue');
	return { default: component({ props: { emoji: { type: String, default: '' } }, setup: props => () => node('img', { 'data-test-emoji': props.emoji }) }) };
});
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: {
	props: ['user', 'forceShowDecoration', 'link', 'preview'],
	render(this: { user: { id: string }; forceShowDecoration: boolean; link: boolean; preview: boolean }) {
		return h('span', { 'data-avatar': this.user.id, 'data-decoration': this.forceShowDecoration, 'data-link': this.link, 'data-preview': this.preview });
	},
} }));
vi.mock('@/components/global/MkUserName.vue', () => ({ default: {
	props: ['user', 'enableEmojiMenu'],
	render(this: { user: { name: string } }) { return h('span', { 'data-owner-name': true }, this.user.name); },
} }));

type Instance = InstanceType<typeof HataskFlowerCollection>;
const mounted: { app: App<Element>; container: HTMLDivElement; source: HTMLButtonElement; close: () => void }[] = [];
const labels: HataskFlowerCollectionLabels = { close: '閉じる', sort: '並び順', newest: '新しい順', oldest: '古い順', previous: '前へ', next: '次へ', loading: '読み込み中', error: '取得できませんでした', retry: '再試行', empty: 'お花はまだありません', rare: 'レア', harvested: '収穫日' };
const sample: HataskFlowerView[] = Array.from({ length: 3 }, (_, index) => ({
	id: `flower-${index}`,
	name: `朝のひかりとそよ風に咲いたお花${index}`,
	emoji: '🌼',
	variety: 'デイジー',
	hanakotoba: '希望',
	harvestedAt: '2026-09-08T01:00:00.000Z',
	dateLabel: '9月8日 10:00',
	rare: index === 1,
	isOwner: false,
	user: { id: `user-${index}`, name: `育てた人${index}`, username: `user${index}`, host: null, avatarUrl: '/avatar.webp', avatarBlurhash: null, avatarDecorations: [{ id: 'decoration', url: '/decoration.webp' }] } as HataskFlowerView['user'],
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
});

async function settle(): Promise<void> {
	for (let tick = 0; tick < 4; tick++) await nextTick();
	await vi.advanceTimersByTimeAsync(350);
	for (let tick = 0; tick < 4; tick++) await nextTick();
}

afterEach(async () => {
	for (const item of mounted.splice(0).reverse()) {
		item.close();
		await settle();
		item.app.unmount(); item.container.remove(); item.source.remove();
	}
	vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

function required<T extends HTMLElement = HTMLElement>(container: ParentNode, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing flower collection element: ${selector}`);
	return element;
}

async function mount(overrides: Partial<Instance['$props']> = {}) {
	const source = window.document.createElement('button');
	source.textContent = '一覧を見る';
	source.style.setProperty('--accent', '#e0567a'); source.style.setProperty('--accent-ink', '#b02e56'); source.style.setProperty('--masthead', '#fff7f2');
	const container = window.document.createElement('div');
	window.document.body.append(source, container);
	source.focus();
	const state = shallowReactive({
		isOpen: true, items: sample as readonly HataskFlowerView[], title: 'みんなのお花', summary: '3輪のお花', page: 1, totalPages: 3,
		order: 'newest' as 'newest' | 'oldest', loading: false, error: false, personal: false, source, theme: 'akatsuki', mode: 'light' as 'light' | 'dark', animations: false, labels,
		...overrides,
	});
	const instance = ref<Instance>();
	const events = { closed: 0, retry: 0, selections: [] as HataskFlowerSelection[], pages: [] as number[], orders: [] as ('newest' | 'oldest')[] };
	const shown = ref(true);
	const app = createApp(defineComponent({ setup: () => () => shown.value ? h(HataskFlowerCollection, {
		...state, ref: instance,
		onClosed: () => { events.closed++; shown.value = false; },
		onSelect: selection => { events.selections.push(selection); },
		onPage: page => { events.pages.push(page); },
		onOrder: order => { events.orders.push(order); },
		onRetry: () => { events.retry++; },
	}) : null }));
	app.directive('hotkey', hotkeyDirective);
	app.mount(container);
	mounted.push({ app, container, source, close: () => instance.value?.close() });
	await settle();
	return { container, source, state, instance, events };
}

describe('HataskFlowerCollection', () => {
	test('uses the standard dialog layer and theme, with escaped names and decorated avatars', async () => {
		const flower = { ...sample[0], name: '<img src=x onerror=alert(1)>' };
		const { container } = await mount({ items: [flower, ...sample.slice(1)] });
		const panel = required(container, '[role="dialog"]');
		expect(claimZIndex).toHaveBeenCalledWith('middle');
		expect(panel.style.getPropertyValue('--accent')).toBe('#e0567a');
		expect(panel.style.getPropertyValue('--accent-ink')).toBe('#b02e56');
		expect(panel.getAttribute('aria-labelledby')).toBe(required(panel, 'h2').id);
		const cards = panel.querySelectorAll('[data-flower-id]');
		expect(cards).toHaveLength(3);
		expect(cards[0].textContent).toContain(flower.name);
		expect(cards[0].querySelector('[onerror]')).toBeNull();
		expect(cards[0].querySelector('time')?.getAttribute('datetime')).toBe(flower.harvestedAt);
		expect(required(cards[0], '[data-avatar]').dataset).toMatchObject({ decoration: 'true', link: 'false', preview: 'false' });
		expect(panel.querySelectorAll('[data-owner-name]')).toHaveLength(3);
		expect(panel.querySelectorAll('[data-rare="true"]')).toHaveLength(1);
		expect(window.document.activeElement).toBe(required(container, '[data-flower-collection-action="close"]'));
	});

	test('personal collections keep avatars but omit account names from cards and accessible labels', async () => {
		const { container } = await mount({ personal: true, title: 'フラワーギャラリー' });
		expect(container.querySelectorAll('[data-avatar]')).toHaveLength(3);
		expect(container.querySelector('[data-owner-name]')).toBeNull();
		const card = required(container, '[data-flower-id="flower-0"]');
		expect(card.getAttribute('aria-label')).toContain(sample[0].name);
		expect(card.getAttribute('aria-label')).not.toContain('育てた人');
	});

	test('selects each actual card as the detail anchor and keeps the collection open', async () => {
		const { container, events } = await mount();
		const card = required<HTMLButtonElement>(container, '[data-flower-id="flower-1"]');
		card.click();
		await settle();
		expect(events.selections).toEqual([{ flower: sample[1], anchor: card, returnFocusTo: card }]);
		expect(events.closed).toBe(0);
		expect(container.querySelectorAll('[data-flower-id]')).toHaveLength(3);
	});

	test('requests sorting and one-based pages without rewriting the parent-owned data', async () => {
		const { container, state, events } = await mount();
		const previous = required<HTMLButtonElement>(container, '[data-flower-collection-action="previous"]');
		const next = required<HTMLButtonElement>(container, '[data-flower-collection-action="next"]');
		expect(previous.disabled).toBe(true);
		previous.click(); next.click();
		expect(events.pages).toEqual([2]);
		expect(state.page).toBe(1);
		state.page = 3;
		await settle();
		expect(next.disabled).toBe(true);
		previous.click(); next.click();
		expect(events.pages).toEqual([2, 2]);
		expect(required(container, 'footer').textContent).toContain('3 / 3');
		const sort = required<HTMLSelectElement>(container, '[data-flower-collection-action="order"]');
		sort.value = 'oldest'; sort.dispatchEvent(new Event('change', { bubbles: true }));
		expect(events.orders).toEqual(['oldest']);
		expect(state.order).toBe('newest');
		expect(state.items.map(item => item.id)).toEqual(sample.map(item => item.id));
	});

	test('keeps loading, error retry, and empty states distinct and blocks paging while loading', async () => {
		const { container, state, events } = await mount({ loading: true });
		expect(required(container, '[role="status"]').textContent).toBe(labels.loading);
		expect(container.querySelector('[data-flower-id]')).toBeNull();
		const next = required<HTMLButtonElement>(container, '[data-flower-collection-action="next"]');
		expect(next.disabled).toBe(true);
		next.click();
		expect(events.pages).toEqual([]);
		state.loading = false; state.error = true;
		await settle();
		expect(required(container, '[role="alert"]').textContent).toContain(labels.error);
		required<HTMLButtonElement>(container, '[data-flower-collection-action="retry"]').click();
		expect(events.retry).toBe(1);
		state.error = false; state.items = [];
		await settle();
		expect(required(container, '[role="status"]').textContent).toBe(labels.empty);
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});

	test('Escape, outside click, and parent close restore the opener once per dialog', async () => {
		const first = await mount();
		required(first.container, '[data-flower-collection-action="close"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(first.events.closed).toBe(1);
		expect(window.document.activeElement).toBe(first.source);
		const second = await mount();
		required(second.container, '[data-cy-bg]').click();
		await settle();
		expect(second.events.closed).toBe(1);
		expect(window.document.activeElement).toBe(second.source);
		const third = await mount();
		third.state.isOpen = false;
		third.instance.value?.close();
		await settle();
		expect(third.events.closed).toBe(1);
		expect(window.document.activeElement).toBe(third.source);
	});
});
