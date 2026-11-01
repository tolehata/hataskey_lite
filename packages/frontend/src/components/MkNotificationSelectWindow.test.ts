/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import NotificationSelectWindow from './MkNotificationSelectWindow.vue';
import type { App } from 'vue';
import type { NotificationFilterDetails } from '@/utility/notification-filter.js';

/* Test-only component stubs share this file with their integration test. */
/* eslint-disable vue/one-component-per-file */
vi.mock('@/i18n.js', async () => {
	const types = await import('cherrypick-js');
	return { i18n: { ts: {
		notificationSetting: 'Notification settings', notificationSettingDesc: 'Select notifications', disableAll: 'Disable all', enableAll: 'Enable all',
		_notification: { _types: Object.fromEntries(types.notificationTypes.map(type => [type, type])) },
		_hata: {
			_notificationBrands: { standard: 'Standard', hatady: 'Hatady', hatask: 'Hatask', hataFeed: 'HataFeed' },
			_notificationFilter: { botNotifications: 'Bots', botNotificationsDescription: 'Show bots', otherHatask: 'Other Hatask' },
			_hatady: { _notification: Object.fromEntries(types.hatadyNotificationSubtypes.map(type => [type, `Hatady ${type}`])) },
		},
	} } };
});
vi.mock('./MkModalWindow.vue', () => ({ default: defineComponent({ emits: ['ok'], setup: (_, { emit, expose, slots }) => {
		expose({ 'close': () => {} });
		return () => h('section', [slots.header?.(), slots.default?.(), h('button', { onClick: () => emit('ok') }, 'OK')]);
} }) }));
vi.mock('./MkInfo.vue', () => ({ default: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }) }));
vi.mock('./MkButton.vue', () => ({ default: defineComponent({ emits: ['click'], setup: (_, { emit, slots }) => () => h('button', { onClick: () => emit('click') }, slots.default?.()) }) }));
vi.mock('./MkSwitch.vue', () => ({ default: defineComponent({ props: { modelValue: Boolean, disabled: Boolean }, emits: ['update:modelValue'], setup: (props, { emit, slots }) => () => h('label', [
		h('input', { type: 'checkbox', checked: props.modelValue, disabled: props.disabled, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked) }),
		slots.default?.(), slots.caption?.(),
	]) }) }));

const mounted: { app: App<Element>; host: HTMLDivElement }[] = [];

function mount(props: { excludeTypes?: string[]; knownTypes?: string[]; excludeBots?: boolean; filterDetails?: NotificationFilterDetails } = {}) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const done = vi.fn();
	const app = createApp(defineComponent({ setup: () => () => h(NotificationSelectWindow, { ...props, onDone: done }) }));
	app.mount(host);
	mounted.push({ app, host });
	return { host, done };
}

function switchFor(host: Element, label: string): HTMLInputElement {
	const row = [...host.querySelectorAll('label')].find(element => element.textContent.trim().startsWith(label));
	if (!row) throw new Error(`Missing switch ${label}`);
	const input = row.querySelector('input');
	if (!input) throw new Error(`Missing input for ${label}`);
	return input;
}

async function setSwitch(host: Element, label: string, enabled: boolean) {
	const input = switchFor(host, label);
	input.checked = enabled;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await nextTick();
}

async function press(host: Element, label: string) {
	const button = [...host.querySelectorAll('button')].find(element => element.textContent === label);
	if (!button) throw new Error(`Missing button ${label}`);
	button.click();
	await nextTick();
}

afterEach(() => {
	for (const { app, host } of mounted.splice(0)) { app.unmount(); host.remove(); }
});

describe('notification filter modal', () => {
	test('reward notifications have no OFF switch and survive Disable all when saved', async () => {
		const { host, done } = mount({ excludeTypes: ['hataskDecorationUnlocked'], knownTypes: notificationTypes.filter(type => type !== 'hataskDecorationUnlocked') });
		expect(() => switchFor(host, 'hataskFlowerReady')).not.toThrow();
		expect([...host.querySelectorAll('label')].some(row => row.textContent.includes('hataskDecorationUnlocked'))).toBe(false);
		await press(host, 'Disable all');
		await press(host, 'OK');
		expect(done).toHaveBeenCalledOnce();
		const saved = done.mock.calls[0][0];
		expect(saved.excludeTypes).toContain('hataskFlowerReady');
		expect(saved.excludeTypes).not.toContain('hataskDecorationUnlocked');
		expect(saved.filterDetails.includeBrands).toEqual([]);
	});

	test('old Hatady exclusion stays off until its category is enabled, while child choices survive', async () => {
		const { host, done } = mount({ excludeTypes: ['app', 'hatady'] });
		expect(switchFor(host, 'Hatady').checked).toBe(false);
		expect(switchFor(host, 'Other Hatask').checked).toBe(false);
		expect(switchFor(host, `Hatady ${hatadyNotificationSubtypes[0]}`).disabled).toBe(true);
		await setSwitch(host, 'Hatady', true);
		await press(host, 'Enable all');
		await setSwitch(host, `Hatady ${hatadyNotificationSubtypes[0]}`, false);
		await setSwitch(host, 'Bots', false);
		await press(host, 'Disable all');
		expect(switchFor(host, 'Hatady').checked).toBe(false);
		expect(switchFor(host, 'Bots').checked).toBe(false);
		await press(host, 'Enable all');
		expect(switchFor(host, 'Hatady').checked).toBe(true);
		expect(switchFor(host, 'Bots').checked).toBe(true);
		await setSwitch(host, `Hatady ${hatadyNotificationSubtypes[0]}`, false);
		await setSwitch(host, 'Other Hatask', false);
		await setSwitch(host, 'Bots', false);
		await setSwitch(host, 'Standard', false);
		await press(host, 'OK');
		expect(done).toHaveBeenCalledOnce();
		const saved = done.mock.calls[0][0];
		expect(saved.excludeBots).toBe(true);
		expect(saved.excludeTypes).not.toContain('hatady');
		expect(saved.filterDetails).toMatchObject({ includeBrands: ['hatady', 'hatask', 'hataFeed'], includeHataskApp: false, excludeHatadySubtypes: [hatadyNotificationSubtypes[0]] });
		const reopened = mount(saved);
		expect(switchFor(reopened.host, 'Standard').checked).toBe(false);
		expect(switchFor(reopened.host, 'Hatady').checked).toBe(true);
		expect(switchFor(reopened.host, `Hatady ${hatadyNotificationSubtypes[0]}`).checked).toBe(false);
		expect(switchFor(reopened.host, 'Other Hatask').checked).toBe(false);
		expect(switchFor(reopened.host, 'Bots').checked).toBe(false);
	});
});
