/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick } from 'vue';
import { expect, test } from 'vitest';
import HataAppNavIcon from './HataAppNavIcon.vue';
import { hataAppForMenuIcon, hataAppForMenuLabel, hataAppForSettingsBrand } from '@/utility/hata-app-brand.js';

test('brand matching upgrades old menu icons while preserving custom icons and labels', () => {
	expect(hataAppForMenuIcon('hatask', 'ti ti-eye')).toBe('hatask');
	expect(hataAppForMenuIcon('hatask', 'ti ti-layout-dashboard')).toBe('hatask');
	expect(hataAppForMenuIcon('hatask', 'ti ti-star')).toBeNull();
	expect(hataAppForMenuIcon('calendar', 'ti ti-eye')).toBeNull();
	expect(hataAppForMenuLabel('hatady', 'Hatady', 'ti ti-book-2')).toBe('hatady');
	expect(hataAppForMenuLabel('hatady', 'My books', 'ti ti-book-2')).toBeNull();
	expect(hataAppForSettingsBrand('HataFeed')).toBe('hatafeed');
	expect(hataAppForSettingsBrand('Hataskey')).toBeNull();
});

test('clicking the parent link replays the decorative logo tap without handling navigation', async () => {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	let navigations = 0;
	const app = createApp({ render: () => h('button', { onClick: () => { navigations++; } }, [h(HataAppNavIcon, { app: 'hatask' }), h('span', 'Hatask')]) });
	try {
		app.mount(host);
		(host.querySelector('button span:last-child') as HTMLElement).click();
		await nextTick();
		await nextTick();
		expect(navigations).toBe(1);
		expect(host.querySelector('[class*=tap]')).not.toBeNull();
	} finally {
		app.unmount();
		host.remove();
	}
});
