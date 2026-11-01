/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { createHataskeyNotificationToasts, enqueuePageStatusToast, getToastDuration, notificationOutlinePaths, registerNotificationPageContext } from './hataskey-notification-toast.js';
import { splitNotificationText } from './notification-text.js';
import type { entities } from 'cherrypick-js';

const notification = (id: string): entities.Notification => ({ id, type: 'test', createdAt: '2026-09-07T00:00:00Z' });

describe('Hataskey notification queue', () => {
	it('delivers action feedback immediately and replaces it with the newest action', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		queue.target.value = window.document.createElement('div');
		const release = registerNotificationPageContext(queue, () => true);
		try {
			expect(enqueuePageStatusToast('Deleted', 'deleted')).toBe(true);
			expect(queue.navbarNotice.value).toMatchObject({ kind: 'noteAction', action: 'delete', message: 'Deleted' });
			expect(enqueuePageStatusToast('Edited', 'edited')).toBe(true);
			expect(queue.items.value).toHaveLength(1);
			expect(queue.navbarNotice.value).toMatchObject({ action: 'edit', message: 'Edited' });
		} finally {
			release();
		}
	});
	it('keeps the regular toast fallback when no notification surface is visible', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const release = registerNotificationPageContext(queue, () => true);
		try {
			expect(enqueuePageStatusToast('Deleted', 'deleted')).toBe(false);
			expect(queue.items.value).toHaveLength(0);
		} finally {
			release();
		}
	});
	it('chooses the latest visible mobile surface and restores the previous owner on release', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		const first = { active: ref(true), target: ref(window.document.createElement('div')), outline: ref(window.document.createElement('header')), animations: ref(true) };
		const second = { active: ref(false), target: ref<HTMLElement | null>(null), outline: ref<HTMLElement | null>(null), animations: ref(true) };
		const releaseFirst = queue.registerSurface(first);
		const releaseSecond = queue.registerSurface(second);
		expect(queue.surface.value).toBe(first);
		expect(queue.mobile.value).toBe(true);
		second.active.value = true;
		expect(queue.surface.value).toBe(first);
		second.target.value = window.document.createElement('div'); second.outline.value = window.document.createElement('header');
		expect(queue.surface.value).toBe(second);
		releaseSecond(); releaseSecond();
		expect(queue.surface.value).toBe(first);
		releaseFirst();
		expect(queue.surface.value).toBeUndefined();
		expect(queue.integrated.value).toBe(false);
	});
	it('expires at five seconds of visible, unpaused time', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		queue.enqueue(notification('first'), 'local', 0);
		queue.tick(2000, new Set());
		queue.tick(12000, new Set([queue.items.value[0].id]));
		expect(queue.items.value[0].elapsed).toBe(2000);
		queue.tick(14999, new Set());
		expect(queue.items.value).toHaveLength(1);
		queue.tick(15000, new Set());
		expect(queue.items.value).toHaveLength(0);
	});
	it.each(['notification', 'noteAction'] as const)('preserves the remaining %s lifetime while the navbar contents are hidden', (kind) => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		if (kind === 'notification') queue.enqueue(notification('first'), 'local', 0);
		else queue.enqueueNavbarNotice({ kind: 'noteAction', action: 'edit', message: 'Edited' }, 0);
		queue.tick(1000, new Set());
		const item = queue.items.value[0];
		queue.paused.value = true;
		queue.tick(12000, new Set());
		expect(item.elapsed).toBe(1000);
		expect(item.updatedAt).toBe(12000);
		queue.paused.value = false;
		const expiresAt = 12000 + getToastDuration(item) - item.elapsed;
		queue.tick(expiresAt - 1, new Set());
		expect(queue.items.value[0]).toBe(item);
		queue.tick(expiresAt, new Set());
		expect(queue.items.value).toHaveLength(0);
	});
	it('keeps surface and individual pauses effective after the navbar pause ends', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const surfacePaused = ref(false);
		queue.registerSurface({ active: ref(true), target: ref(window.document.createElement('div')), outline: ref(window.document.createElement('header')), animations: ref(false), paused: surfacePaused });
		queue.enqueue(notification('first'), 'local', 0);
		queue.tick(1000, new Set());
		const item = queue.items.value[0];
		queue.paused.value = true;
		queue.tick(6000, new Set());
		surfacePaused.value = true;
		queue.paused.value = false;
		queue.tick(11000, new Set());
		expect(item.elapsed).toBe(1000);
		surfacePaused.value = false;
		queue.tick(16000, new Set([item.id]));
		expect(item.elapsed).toBe(1000);
		queue.tick(19999, new Set());
		expect(queue.items.value[0]).toBe(item);
		queue.tick(20000, new Set());
		expect(queue.items.value).toHaveLength(0);
	});
	it('keeps three desktop cards, with the newest at the bottom, without mixing account IDs', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		queue.enqueue(notification('same'), 'local', 0);
		queue.enqueue(notification('same'), 'external', 0, 'example.test');
		expect(queue.items.value).toHaveLength(2);
		queue.enqueue(notification('third'), 'local', 0);
		queue.enqueue(notification('fourth'), 'local', 0);
		expect(queue.items.value.map(item => item.source === 'local' || item.source === 'external' ? item.notification.id : null)).toEqual(['fourth', 'third', 'same']);
	});
	it.each([true, false])('uses one shared latest notification in the navbar (mobile=%s)', (mobile) => {
		const queue = createHataskeyNotificationToasts(computed(() => mobile), computed(() => !mobile));
		queue.enqueue(notification('local'), 'local', 0);
		queue.enqueue(notification('remote'), 'external', 100);
		expect(queue.items.value.map(item => item.source)).toEqual(['external']);
		queue.enqueue(notification('flower'), 'local', 200);
		expect(queue.items.value.map(item => item.source === 'local' || item.source === 'external' ? item.notification.id : null)).toEqual(['flower']);
	});
	it('preserves the active timer when the navbar disappears or the device changes', () => {
		const mobile = ref(false);
		const navbarVisible = ref(true);
		const queue = createHataskeyNotificationToasts(computed(() => mobile.value), computed(() => navbarVisible.value));
		queue.enqueue(notification('first'), 'local', 0);
		queue.tick(1900, new Set());
		navbarVisible.value = false;
		expect(queue.integrated.value).toBe(false);
		mobile.value = true;
		expect(queue.integrated.value).toBe(true);
		expect(queue.items.value[0].elapsed).toBe(1900);
	});
});

describe('HataFeed navbar notices', () => {
	it('expires note actions after three seconds while ordinary notices retain five seconds', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		queue.enqueueNavbarNotice({ kind: 'noteAction', action: 'clip', message: 'クリップに追加しました', target: 'あとで読む' }, 0);
		expect(getToastDuration(queue.items.value[0])).toBe(3000);
		queue.tick(2999, new Set());
		expect(queue.items.value).toHaveLength(1);
		queue.tick(3000, new Set());
		expect(queue.items.value).toHaveLength(0);
		queue.enqueueNavbarNotice({ kind: 'status', message: '保存しました' }, 4000);
		expect(getToastDuration(queue.items.value[0])).toBe(5000);
		queue.tick(8999, new Set());
		expect(queue.items.value).toHaveLength(1);
		queue.tick(9000, new Set());
		expect(queue.items.value).toHaveLength(0);
	});
	it('distinguishes a hidden native navbar from a temporarily folded available one', () => {
		const available = ref(false);
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false), computed(() => available.value));
		expect(queue.canIntegrateStatus.value).toBe(false);
		available.value = true;
		expect(queue.canIntegrateStatus.value).toBe(true);
		expect(queue.integrated.value).toBe(false);
	});
	it('keeps ordinary status copy in the shared navbar item and expires it', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		queue.enqueueNavbarNotice({ kind: 'status', message: '料理として記録しました', icon: 'ti ti-tools-kitchen-2' }, 100);
		expect(queue.navbarNotice.value).toEqual({ kind: 'status', message: '料理として記録しました', icon: 'ti ti-tools-kitchen-2' });
		expect(queue.items.value).toHaveLength(1);
		expect(queue.items.value[0]).toMatchObject({ source: 'status', message: '料理として記録しました' });
		expect(queue.integrated.value).toBe(true);
		queue.tick(5100, new Set());
		expect(queue.items.value).toEqual([]);
	});
	it('shares standard events and local status in the latest slot and pauses during a draft prompt', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		const paused = ref(false);
		queue.registerSurface({ active: ref(true), target: ref(window.document.createElement('div')), outline: ref(window.document.createElement('header')), animations: ref(false), paused });
		queue.enqueue(notification('reply'), 'local', 0);
		queue.enqueueStatus('保存しました', 200);
		expect(queue.items.value).toHaveLength(1);
		expect(queue.items.value[0]).toMatchObject({ source: 'status', message: '保存しました' });
		queue.tick(1200, new Set());
		paused.value = true; queue.tick(9000, new Set());
		expect(queue.items.value[0].elapsed).toBe(1000);
		paused.value = false; queue.tick(13000, new Set());
		expect(queue.items.value).toHaveLength(0);
	});
});

describe('favorite save statuses', () => {
	it.each([true, false])('shares the latest navbar slot and the existing five-second lifetime (mobile=%s)', (mobile) => {
		const queue = createHataskeyNotificationToasts(computed(() => mobile), computed(() => !mobile));
		queue.enqueue(notification('earlier'), 'local', 0);
		queue.enqueueStatus('「あとで読む」に保存しました', 1000, undefined, true);
		expect(queue.items.value).toHaveLength(1);
		expect(queue.items.value[0]).toMatchObject({ source: 'status', favoriteSaved: true, message: '「あとで読む」に保存しました', elapsed: 0, updatedAt: 1000 });
		queue.tick(5999, new Set());
		expect(queue.items.value).toHaveLength(1);
		queue.tick(6000, new Set());
		expect(queue.items.value).toEqual([]);

		queue.enqueueStatus('未分類に保存しました', 7000, undefined, true);
		queue.enqueue(notification('later'), 'external', 8000, 'example.test');
		expect(queue.items.value).toHaveLength(1);
		expect(queue.items.value[0]).toMatchObject({ source: 'external', notification: { id: 'later' } });
	});
	it('keeps welcome, saved, and ordinary notifications independent in the desktop stack', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		const welcomeUser: entities.UserLite = {
			id: 'self', username: 'self', name: '旗茶', host: null, avatarUrl: '/avatar.webp', avatarBlurhash: null,
			avatarDecorations: [], isLocked: false, emojis: {}, onlineStatus: 'online',
		};
		queue.enqueueStatus('おかえりなさい、旗茶さん', 0, welcomeUser);
		queue.enqueueStatus('「暮らし」に保存しました', 1000, undefined, true);
		queue.enqueue(notification('reply'), 'local', 2000);
		expect(queue.items.value).toHaveLength(3);
		expect(queue.items.value[0]).toMatchObject({ source: 'local', notification: { id: 'reply' } });
		expect(queue.items.value[1]).toMatchObject({ source: 'status', favoriteSaved: true, welcomeUser: undefined });
		expect(queue.items.value[2]).toMatchObject({ source: 'status', welcomeUser, favoriteSaved: undefined });
		queue.tick(5000, new Set());
		expect(queue.items.value.map(item => item.source)).toEqual(['local', 'status']);
		expect(queue.items.value[1].elapsed).toBe(4000);
		queue.tick(6000, new Set());
		expect(queue.items.value).toHaveLength(1);
		expect(queue.items.value[0]).toMatchObject({ source: 'local', elapsed: 4000 });
	});
});

describe('notification outline and copy', () => {
	it('uses two symmetric open paths from top centre to bottom centre', () => {
		const paths = notificationOutlinePaths(360, 120, 24, true);
		expect(paths).toHaveLength(2);
		for (const path of paths) {
			expect(path.startsWith('M 180 1 H ')).toBe(true);
			expect(path.endsWith('119 H 180')).toBe(true);
			expect(path.includes('Z')).toBe(false);
		}
		expect(paths[0]).toContain('0 0 1 359 24');
		expect(paths[1]).toContain('0 0 0 1 24');
	});
	it('starts the closed floating outline on the top-right arc', () => {
		const [path] = notificationOutlinePaths(300, 80, 16, false);
		const [, x, y] = path.split(' ').map(Number);
		expect(x).toBeGreaterThan(284);
		expect(y).toBeLessThan(16);
		expect(path.endsWith('Z')).toBe(true);
	});
	it('breaks after punctuation and attached closing quotes, without changing text', () => {
		const text = 'お花が咲いたよ、見てね。「収穫できます！」明日も。';
		const parts = splitNotificationText(text);
		expect(parts).toEqual(['お花が咲いたよ、', '見てね。', '「収穫できます！」', '明日も。']);
		expect(parts.join('')).toBe(text);
		expect(splitNotificationText('長い名前やhttps://example.test/path')).toEqual(['長い名前やhttps://example.test/path']);
	});
});

describe('Concrnt notifications in the shared toast queue', () => {
	it('labels Concrnt as its own outside source and de-duplicates by URI', () => {
		const queue = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		const item = { uri: 'ccfs://con1self/n/1', schema: 's', type: 'reaction' as const, author: 'con1other', authorName: '相手', authorProfile: 'main', createdAt: '2026-10-21T00:00:00Z' };
		queue.enqueueConcrnt(item, 0);
		queue.enqueueConcrnt({ ...item }, 10);
		queue.enqueue(notification('local'), 'local', 20);
		expect(queue.items.value.map(entry => entry.source)).toEqual(['local', 'concrnt']);
	});
});
