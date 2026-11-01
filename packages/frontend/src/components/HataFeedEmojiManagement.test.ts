/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import HataFeedEmojiHistory from './HataFeedEmojiHistory.vue';
import HataFeedEmojiChangeWizard from './HataFeedEmojiChangeWizard.vue';
import HataFeedEmojiChangeReview from './HataFeedEmojiChangeReview.vue';
import type { Component } from 'vue';
import type { HataFeedEmojiChangeRequest, HataFeedEmojiRequest } from '@/utility/hatafeed.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), choose: vi.fn(), notify: vi.fn(), popup: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: fixture.choose }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/hatafeed-ui.js', () => ({ hataFeedNotify: fixture.notify }));
vi.mock('@/i.js', () => ({ $i: { id: 'reviewer' } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/os.js', () => ({ popup: fixture.popup, confirm: async () => ({ canceled: false }) }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/MkWindow.vue', () => ({ default: defineComponent({ setup(_, { expose }) { expose({ close: vi.fn() }); }, template: '<section><slot name="header"/><slot/></section>' }) }));

const original = (id = 'original'): HataFeedEmojiRequest => ({ id, name: id, createdAt: '2026-09-22T00:00:00.000Z', requestedBy: null, category: null, aliases: [], license: 'own image', localOnly: false, isSensitive: false, sourceType: 'own', originalUrl: null, remoteHost: null, imageUrl: '/old.png', status: 'approved', resolvedComment: null, resolvedById: null, resolvedAt: null, resolvedEmojiId: 'emoji', currentEmoji: { id: 'emoji', name: id, imageUrl: '/old.png', license: 'own image', category: null, aliases: [] } });
const change = (kind: HataFeedEmojiChangeRequest['kind'] = 'updateImage'): HataFeedEmojiChangeRequest => ({ id: 'change', originalRequestId: 'original', targetEmojiId: 'emoji', name: 'original', createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z', requestedBy: null, kind, status: 'pending', reason: 'new image', previousImageUrl: '/old.png', imageUrl: '/new.png', license: 'own image', resolvedAt: null, resolvedById: null, resolvedComment: null, events: [] });
const cleanups: Array<() => void> = [];
beforeEach(() => {
	fixture.api.mockReset().mockImplementation(async (endpoint: string) => endpoint.endsWith('emoji-quota') ? { remaining: 0, limit: 10 } : [original()]);
	fixture.choose.mockReset().mockResolvedValue([{ id: 'newfile', url: '/new.png', type: 'image/png', size: 1000 }]);
	fixture.notify.mockReset(); fixture.popup.mockReset().mockReturnValue({ dispose: vi.fn() });
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

async function mount(component: Component, props: Record<string, unknown>) {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(component, props) });
	app.component('MkTime', { template: '<time />' }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick(); await nextTick(); return target;
}

function button(target: HTMLElement, label: string) {
	const result = [...target.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.trim() === label || element.getAttribute('aria-label') === label);
	expect(result, label).toBeDefined(); return result!;
}

async function click(target: HTMLElement, label: string) { button(target, label).click(); await nextTick(); await nextTick(); }

async function input(target: HTMLElement, selector: string, value: string) {
	const element = target.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
	element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}

async function acknowledge(target: HTMLElement) { target.querySelector<HTMLInputElement>('[type="checkbox"]')!.click(); await nextTick(); }

describe('HataFeed emoji history and search', () => {
	test('zero addition quota still allows updates, withdrawals and pending cancellation', async () => {
		fixture.api.mockImplementation(async (endpoint: string) => endpoint.endsWith('emoji-quota') ? { remaining: 0, limit: 10 } : [original(), { ...original('pending'), status: 'pending', currentEmoji: null }]);
		const target = await mount(HataFeedEmojiHistory, {});
		expect(target.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('0');
		for (const label of ['画像更新を申請', '取り下げを申請', 'この追加申請を取り消す']) expect(button(target, label).disabled).toBe(false);
	});
	test('an active change hides further change actions', async () => {
		fixture.api.mockResolvedValue([{ ...original(), latestChange: change() }]);
		const target = await mount(HataFeedEmojiHistory, {});
		expect(target.textContent).toContain('画像更新の確認待ち');
		expect(target.textContent).not.toContain('画像更新を申請'); expect(target.textContent).not.toContain('取り下げを申請');
	});
	test('search and filters query all requests and reset the pagination cursor', async () => {
		fixture.api.mockImplementation(async (endpoint: string) => endpoint.endsWith('emoji-quota') ? { remaining: 6, limit: 10 } : Array.from({ length: 16 }, (_, index) => original(`item${index}`)));
		const target = await mount(HataFeedEmojiHistory, {});
		await click(target, '次のページ');
		expect(fixture.api).toHaveBeenLastCalledWith('hata/feedback/emoji-requests', expect.objectContaining({ untilId: 'item14' }));
		await input(target, '[type="search"]', ' おつ ');
		target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await nextTick(); await nextTick();
		expect(fixture.api).toHaveBeenLastCalledWith('hata/feedback/emoji-requests', expect.objectContaining({ query: 'おつ', untilId: undefined, mine: true }));
		await click(target, '確認待ち');
		expect(fixture.api).toHaveBeenLastCalledWith('hata/feedback/emoji-requests', expect.objectContaining({ query: 'おつ', filter: 'waiting', untilId: undefined }));
	});
	test('a slow previous search cannot replace the latest results', async () => {
		let finishOld!: (value: HataFeedEmojiRequest[]) => void;
		fixture.api.mockImplementation(async (endpoint: string, params: { query?: string }) => endpoint.endsWith('emoji-quota') ? { remaining: 6, limit: 10 } : params.query === 'old' ? new Promise(resolve => { finishOld = resolve; }) : [original('latest')]);
		const target = await mount(HataFeedEmojiHistory, {});
		await input(target, '[type="search"]', 'old'); await click(target, '検索');
		await input(target, '[type="search"]', 'new'); await click(target, '検索');
		finishOld([original('obsolete')]); await nextTick(); await nextTick();
		expect(target.textContent).toContain(':latest:'); expect(target.textContent).not.toContain(':obsolete:');
	});
});

describe('HataFeed emoji change submission', () => {
	test('image submission requires confirmation and preserves input on API failure', async () => {
		fixture.api.mockRejectedValueOnce({ code: 'HATAFEED_EMOJI_CHANGE_PENDING' });
		const target = await mount(HataFeedEmojiChangeWizard, { request: original(), kind: 'updateImage' });
		expect(button(target, '申請内容を確認').disabled).toBe(true);
		await click(target, '新しい画像を選ぶ'); await input(target, 'textarea', '読みやすく更新'); await acknowledge(target);
		await click(target, '申請内容を確認'); await click(target, '画像更新を申請する');
		expect(fixture.api).toHaveBeenCalledWith('hata/feedback/emoji-change-requests/create', { originalRequestId: 'original', kind: 'updateImage', reason: '読みやすく更新', fileId: 'newfile', license: 'own image' });
		expect(target.querySelector('[role="alert"]')).not.toBeNull();
		await click(target, '戻って編集'); expect(target.querySelector('textarea')?.value).toBe('読みやすく更新');
		expect(target.querySelector('img[src="/new.png"]')).not.toBeNull();
	});
	test('withdrawal submits no image or quota operation', async () => {
		const target = await mount(HataFeedEmojiChangeWizard, { request: original(), kind: 'withdraw' });
		await input(target, 'textarea', '利用終了'); await acknowledge(target); await click(target, '申請内容を確認'); await click(target, '取り下げを申請する');
		expect(fixture.api.mock.calls).toEqual([['hata/feedback/emoji-change-requests/create', { originalRequestId: 'original', kind: 'withdraw', reason: '利用終了' }]]);
		expect(target.textContent).toContain('新規追加の申請枠は変わりません');
	});
	test('pending cancellation uses the original request and does not require a file', async () => {
		const target = await mount(HataFeedEmojiChangeWizard, { request: { ...original(), status: 'pending' }, kind: 'cancel' });
		await click(target, '追加申請を取り消す');
		expect(fixture.api.mock.calls).toEqual([['hata/feedback/emoji-requests/cancel', { requestId: 'original', reason: null }]]);
		expect(target.textContent).toContain('追加申請を取り消しました');
	});
});

describe('HataFeed emoji review', () => {
	test.each([['保留', 'hold'], ['却下', 'reject']])('%s requires a reason and sends the displayed review version', async (label, endpoint) => {
		const target = await mount(HataFeedEmojiChangeReview, { request: change(), isStaff: true });
		await click(target, label); expect(fixture.api).not.toHaveBeenCalled();
		await input(target, 'textarea', '利用条件の確認'); await click(target, label);
		expect(fixture.api).toHaveBeenCalledWith(`hata/feedback/emoji-change-requests/${endpoint}`, { requestId: 'change', expectedUpdatedAt: change().updatedAt, comment: '利用条件の確認' });
		expect(fixture.notify).toHaveBeenCalledWith(expect.stringContaining(`画像更新申請を${label}`));
	});
	test('withdrawal approval requires explicit acknowledgement and surfaces stale review errors', async () => {
		fixture.api.mockRejectedValueOnce({ code: 'HATAFEED_EMOJI_REQUEST_CONFLICT' });
		const target = await mount(HataFeedEmojiChangeReview, { request: change('withdraw'), isStaff: true });
		expect(button(target, '承認して取り下げ').disabled).toBe(true);
		await acknowledge(target); await click(target, '承認して取り下げ');
		expect(target.querySelector('[role="alert"]')).not.toBeNull(); expect(fixture.notify).not.toHaveBeenCalled();
		fixture.api.mockResolvedValueOnce([{ ...change('withdraw'), status: 'held', updatedAt: '2026-09-22T01:00:00.000Z' }]);
		await click(target, '最新の申請を読み込む');
		expect(button(target, '承認して取り下げ').disabled).toBe(true);
		await acknowledge(target); await click(target, '承認して取り下げ');
		expect(fixture.api).toHaveBeenLastCalledWith('hata/feedback/emoji-change-requests/approve', expect.objectContaining({ expectedUpdatedAt: '2026-09-22T01:00:00.000Z' }));
	});
	test('applicants can read review history without staff controls', async () => {
		const target = await mount(HataFeedEmojiChangeReview, { request: change(), isStaff: false });
		expect(target.textContent).not.toContain('承認して更新'); expect(target.querySelector('textarea')).toBeNull();
	});
});
