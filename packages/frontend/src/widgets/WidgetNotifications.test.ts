/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WidgetNotifications from './WidgetNotifications.vue';

type Filter = { excludeTypes: string[]; knownTypes: string[]; excludeBots: boolean; filterDetails: { includeBrands?: string[] | null; includeHataskApp?: boolean; excludeHatadySubtypes?: string[]; knownHatadySubtypes?: string[] } };
const popup = vi.hoisted(() => vi.fn());
vi.mock('@/os.js', () => ({ popupAsyncWithDialog: popup, form: vi.fn() }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { notifications: '通知', settings: '設定', markAllAsRead: '既読' } } }));
vi.mock('@/components/MkNotificationSelectWindow.vue', () => ({ default: {} }));
vi.mock('@/components/MkContainer.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: (_props, { slots }) => () => render('div', [slots.func?.({ buttonStyleClass: '' }), slots.default?.()]) }) };
});
vi.mock('@/components/MkStreamingNotificationsTimeline.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ props: { excludeBots: Boolean, includeBrands: { type: Array, default: () => [] }, includeHataskApp: Boolean, excludeHatadySubtypes: { type: Array, default: () => [] } }, setup: props => () => render('div', {
		'data-exclude-bots': String(props.excludeBots),
		'data-include-brands': JSON.stringify(props.includeBrands),
		'data-include-hatask-app': String(props.includeHataskApp),
		'data-exclude-hatady-subtypes': JSON.stringify(props.excludeHatadySubtypes),
	}) }) };
});

const cleanup: (() => void)[] = [];

function mountWidget(initialData: Record<string, unknown> = {}) {
	let stored = JSON.stringify({ height: 300, showHeader: true, excludeBots: false, excludeTypes: [], notificationFilterKnownTypes: ['follow'], ...initialData });
	const parent = reactive({ widget: { id: 'notifications-1', data: JSON.parse(stored) } });
	const app = createApp(defineComponent({ setup: () => () => h(WidgetNotifications, {
		widget: parent.widget,
		onUpdateProps: data => {
			stored = JSON.stringify(data);
			parent.widget = { id: parent.widget.id, data: JSON.parse(stored) };
		},
	}) }));
	app.directive('tooltip', {});
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	const openDialog = () => {
		container.querySelectorAll<HTMLButtonElement>('button')[1].click();
		const call = popup.mock.calls.at(-1)!;
		return { initial: call[1] as Filter, done: (call[2] as { done: (filter: Filter) => Promise<void> }).done };
	};
	return { parent, openDialog, readSaved: () => JSON.parse(stored), container };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
	popup.mockReset();
	popup.mockResolvedValue({ dispose: vi.fn() });
});
afterEach(() => {
	for (const unmount of cleanup.splice(0)) unmount();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('通知ウィジェットの設定確定', () => {
	test('連続してダイアログを確定してもBot除外が即時に保存される', async () => {
		const fixture = mountWidget();
		const first = fixture.openDialog();
		await first.done(first.initial);
		await nextTick();
		const second = fixture.openDialog();
		await second.done({ ...second.initial, excludeBots: true });
		expect(fixture.readSaved().excludeBots).toBe(true);
		await nextTick();
		expect(fixture.container.querySelector('[data-exclude-bots]')?.getAttribute('data-exclude-bots')).toBe('true');
	});

	test('ダイアログで触らなかったBot設定は、開いている間の親の更新を維持する', async () => {
		const fixture = mountWidget();
		const dialog = fixture.openDialog();
		fixture.parent.widget = { id: fixture.parent.widget.id, data: { ...fixture.parent.widget.data, excludeBots: true } };
		await nextTick();
		await dialog.done({ ...dialog.initial, excludeTypes: ['follow'] });
		expect(fixture.readSaved()).toMatchObject({ excludeBots: true, excludeTypes: ['follow'] });
	});

	test('ダイアログで変更したBot設定は親更新後にも確定でき、無関係の更新を残す', async () => {
		const fixture = mountWidget();
		const dialog = fixture.openDialog();
		fixture.parent.widget = { id: fixture.parent.widget.id, data: { ...fixture.parent.widget.data, height: 480, excludeTypes: ['follow'] } };
		await nextTick();
		await dialog.done({ ...dialog.initial, excludeBots: true });
		expect(fixture.readSaved()).toMatchObject({ excludeBots: true, height: 480, excludeTypes: ['follow'] });
	});

	test('詳細フィルタを確定すると保存され、タイムラインと次のダイアログに反映される', async () => {
		const fixture = mountWidget();
		const dialog = fixture.openDialog();
		const filterDetails = { ...dialog.initial.filterDetails, includeBrands: ['hatady'], includeHataskApp: false, excludeHatadySubtypes: ['reaction'] };
		await dialog.done({ ...dialog.initial, filterDetails });
		await nextTick();
		expect(fixture.readSaved().notificationFilterDetails).toEqual(filterDetails);
		const timeline = fixture.container.querySelector('[data-include-brands]');
		expect(timeline?.getAttribute('data-include-brands')).toBe('["hatady"]');
		expect(timeline?.getAttribute('data-include-hatask-app')).toBe('false');
		expect(timeline?.getAttribute('data-exclude-hatady-subtypes')).toContain('reaction');
		expect(fixture.openDialog().initial.filterDetails).toEqual(filterDetails);
	});

	test('詳細フィルタを触らない間に親が更新された場合は親の変更を残す', async () => {
		const fixture = mountWidget();
		const dialog = fixture.openDialog();
		const updatedDetails = { includeBrands: ['hataFeed'], includeHataskApp: false };
		fixture.parent.widget = { id: fixture.parent.widget.id, data: { ...fixture.parent.widget.data, notificationFilterDetails: updatedDetails } };
		await nextTick();
		await dialog.done({ ...dialog.initial, excludeBots: true });
		expect(fixture.readSaved().notificationFilterDetails).toEqual(updatedDetails);
	});
});
