/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), close: vi.fn() }));
vi.mock('@/components/MkModal.vue', () => ({ default: defineComponent({ inheritAttrs: false, setup(_, { slots, expose }) { expose({ close: fixture.close }); return () => h('section', slots.default?.({ type: 'popup', maxHeight: 640 })); } }) }));
vi.mock('@/components/HfAvatar.vue', () => ({ default: { template: '<span/>' } }));
vi.mock('@/components/HataFeedNotificationBody.vue', () => ({ default: { template: '<span/>' } }));
vi.mock('@/components/MkTime.vue', () => ({ default: { template: '<time/>' } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/hatafeed-ui.js', () => ({ hataFeedNotify: vi.fn() }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => vi.fn() }));
vi.mock('@/utility/hatafeed-emoji-notification.js', () => ({ openHataFeedEmojiNotification: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/utility/hatafeed.js', async () => ({
	hataFeedUnreadCount: (await import('vue')).ref(0), markHataFeedNotificationsRead: vi.fn(),
	notifIcon: () => 'ti ti-bell', notifTypeLabel: { mention: 'メンション', issue: 'イシュー' },
	groupHataFeedNotifications: () => [], groupSummary: () => '', notificationDisplayMessage: () => '',
}));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
import HataFeedNotifications from './HataFeedNotifications.vue';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); fixture.api.mockReset(); fixture.close.mockReset(); });

async function mount(host: boolean) {
	fixture.api.mockResolvedValue({ notifications: [], unreadCount: 0 });
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp(HataFeedNotifications);
	if (host) app.provide(HATA_GOES_HOST, {} as never);
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await vi.waitFor(() => expect(target.textContent).toContain('通知はありません'));
	return target;
}

describe('HataFeed notification filters', () => {
	test('HataGoes sheet keeps focus inside and applies the existing type filter', async () => {
		const target = await mount(true);
		const filter = target.querySelector<HTMLButtonElement>('button[aria-expanded]');
		expect(filter).toBeInstanceOf(HTMLButtonElement);
		filter!.click();
		await nextTick();
		const sheet = target.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
		expect(sheet).toBeInstanceOf(HTMLElement);
		await vi.waitFor(() => expect(window.document.activeElement).toBe(sheet?.querySelector('button')));
		expect(target.querySelector('select')).toBeNull();
		expect(target.querySelector('[inert]')).not.toBeNull();
		const issue = [...(sheet?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(item => item.textContent?.trim() === 'イシュー');
		issue?.click();
		await vi.waitFor(() => expect(filter?.getAttribute('aria-expanded')).toBe('false'));
		await vi.waitFor(() => expect(window.document.activeElement).toBe(filter));
		expect(fixture.api).toHaveBeenCalledTimes(2);
		expect(fixture.close).not.toHaveBeenCalled();
	});

	test('legacy filter remains an inline select', async () => {
		const target = await mount(false);
		target.querySelector<HTMLButtonElement>('button[aria-expanded]')?.click();
		await nextTick();
		expect(target.querySelector('select')).toBeInstanceOf(HTMLSelectElement);
		expect(target.querySelector('.hf-notif-filter-sheet')).toBeNull();
	});
});
