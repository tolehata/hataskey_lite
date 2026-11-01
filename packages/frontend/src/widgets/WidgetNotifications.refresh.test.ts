/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint vue/one-component-per-file: off -- Component stubs isolate the widget and its real timeline. */

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WidgetNotifications from './WidgetNotifications.vue';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/os.js', () => ({ popupAsyncWithDialog: vi.fn(), form: vi.fn() }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, enablePullToRefresh: false, enableInfiniteScroll: false, useGroupedNotifications: false } } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true } } }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: () => ({ on: vi.fn(), dispose: vi.fn() }), on: vi.fn(), off: vi.fn(), send: vi.fn() }) }));
vi.mock('@/events.js', () => ({ globalEvents: { on: vi.fn(), off: vi.fn() } }));
vi.mock('@/i.js', () => ({ $i: { id: 'viewer' } }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => '1', setItem: vi.fn() } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { notifications: '通知', settings: '設定', markAllAsRead: '既読', loadMore: 'もっと見る' } } }));
vi.mock('@/utility/timeline-date-separate.js', () => ({ isSeparatorNeeded: () => false, getSeparatorInfo: () => null }));
vi.mock('@@/js/use-document-visibility.js', async () => {
	const { ref } = await import('vue');
	return { useDocumentVisibility: () => ref('visible') };
});
vi.mock('@@/js/scroll.js', () => ({ getScrollContainer: (element: HTMLElement) => element.closest('[data-test-scroll]'), scrollToTop: vi.fn() }));
vi.mock('@/components/MkContainer.vue', () => ({ default: { template: '<div data-test-scroll><slot/></div>' } }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/MkNotification.vue', () => ({ default: { props: ['notification'], template: '<div data-test-notification>{{ notification.id }}</div>' } }));
vi.mock('@/components/MkNote.vue', () => ({ default: {} }));
vi.mock('@/components/MkHataFeedNotificationGroup.vue', () => ({ default: {} }));

const cleanup: (() => void)[] = [];
const notification = (id: string) => ({ id, type: 'app', createdAt: '2026-09-10T00:00:00Z', header: '通知', body: id });

async function settle() { for (let i = 0; i < 8; i++) await nextTick(); }

function required<T extends Element>(container: ParentNode, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing rendered element: ${selector}`);
	return element;
}

async function mountWidget() {
	const parent = reactive({ widget: { id: 'notifications', data: { height: 300, showHeader: true, excludeBots: false, excludeTypes: [] as string[], notificationFilterKnownTypes: [] as string[] } } });
	const app = createApp(defineComponent({ setup: () => () => h(WidgetNotifications, { widget: parent.widget }) }));
	app.directive('tooltip', {});
	app.directive('appear', {});
	app.component('MkLoading', { template: '<div data-test-loading>読込中</div>' });
	app.component('MkError', { template: '<div>失敗</div>' });
	app.component('MkResult', { template: '<div>空</div>' });
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	await settle();
	return { parent, container, scrollContainer: required<HTMLElement>(container, '[data-test-scroll]') };
}

beforeEach(() => {
	api.mockReset();
	api.mockImplementation(async (_endpoint, params) => params.untilId ? [notification('notification-1')] : [notification('notification-3'), notification('notification-2')]);
});
afterEach(() => { for (const unmount of cleanup.splice(0)) unmount(); });

describe('通知ウィジェットの設定同期と一覧の保持', () => {
	test('同じ保存設定の再受信では一覧・スクロール位置・読み込んだ過去の通知を保持する', async () => {
		const { parent, container, scrollContainer } = await mountWidget();
		expect(api).toHaveBeenCalledTimes(1);
		required<HTMLButtonElement>(container, 'button').click();
		await settle();
		expect(api).toHaveBeenCalledTimes(2);
		expect(api.mock.calls[1][1]).toMatchObject({ untilId: 'notification-2' });
		expect(container.querySelectorAll('[data-test-notification]')).toHaveLength(3);
		const firstRow = container.querySelector('[data-scroll-anchor]');
		scrollContainer.scrollTop = 180;
		for (let i = 0; i < 3; i++) {
			parent.widget = JSON.parse(JSON.stringify(parent.widget));
			await settle();
		}
		expect(api).toHaveBeenCalledTimes(2);
		expect(container.querySelector('[data-scroll-anchor]')).toBe(firstRow);
		expect(container.querySelectorAll('[data-test-notification]')).toHaveLength(3);
		expect(container.querySelector('[data-test-loading]')).toBeNull();
		expect(scrollContainer.scrollTop).toBe(180);
	});

	test('高さの変更では再取得せず、通知フィルターとBot除外の変更時は再取得する', async () => {
		const { parent } = await mountWidget();
		parent.widget = { ...parent.widget, data: { ...JSON.parse(JSON.stringify(parent.widget.data)), height: 480 } };
		await settle();
		expect(api).toHaveBeenCalledTimes(1);
		parent.widget.data.excludeTypes = ['follow'];
		await settle();
		expect(api).toHaveBeenCalledTimes(2);
		expect(api.mock.calls[1][1]).toMatchObject({ excludeTypes: ['follow'] });
		parent.widget.data.excludeBots = true;
		await settle();
		expect(api).toHaveBeenCalledTimes(3);
		expect(api.mock.calls[2][1]).toMatchObject({ excludeTypes: ['follow'], excludeBots: true });
	});
});
