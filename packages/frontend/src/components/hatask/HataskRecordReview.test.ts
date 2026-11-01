/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyle, parse } from '@vue/compiler-sfc';
import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskRecordReview from './HataskRecordReview.vue';
import type { App } from 'vue';
import { $i } from '@/i.js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), selectUser: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({ selectUser: mocks.selectUser, popup: vi.fn() }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn(() => null) }));
vi.mock('@/i.js', async () => ({ $i: (await import('vue')).reactive({ id: 'moderator', isAdmin: false, isModerator: true }) }));
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: { props: ['user'], setup: (props: { user: { id: string } }) => () => h('span', { 'data-avatar': props.user.id }) } }));
vi.mock('@/components/RecordModerationActions.vue', () => ({ default: { render: () => null } }));

const id = 'a'.repeat(64);
const item = (extra = {}) => ({ id, kind: 'todo', user: { id: 'owner', username: 'owner', name: '所有者' }, title: '非公開の予定', body: '<script>機密の本文</script>', date: '2026-09-16', time: '09:30', visibility: 'private', state: 'unread', stale: false, revision: 0, contentVersion: 'b'.repeat(64), reviewer: null, reviewedAt: null, dateFallback: false, ...extra });
const page = (items = [item()], extra = {}) => ({ items, total: items.length, kinds: { todo: items.length }, states: { unread: items.length }, nextCursor: null, ...extra });
const detail = (extra = {}) => ({ item: item(extra), fields: [{ label: 'サブタスク', value: 'private subtask' }], audience: [{ id: 'member', username: 'member', name: '指定した人' }] });
const mounted: { app: App; container: HTMLElement }[] = [];

async function flush() { for (let index = 0; index < 15; index++) await nextTick(); }

function mount() {
	const container = window.document.createElement('div'); window.document.body.append(container);
	const app = createApp(HataskRecordReview); app.mount(container); mounted.push({ app, container });
	return { app, container };
}

function button(container: HTMLElement, selector: string) {
	const el = container.querySelector<HTMLButtonElement>(selector); expect(el).toBeTruthy(); return el!;
}

beforeEach(() => {
	vi.useFakeTimers();
	Object.assign($i!, { id: 'moderator', isAdmin: false, isModerator: true });
	mocks.api.mockReset(); mocks.selectUser.mockReset();
	mocks.api.mockImplementation(async endpoint => endpoint.endsWith('/list') ? page() : detail());
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
});
afterEach(() => {
	for (const { app, container } of mounted.splice(0)) { app.unmount(); container.remove(); }
	vi.restoreAllMocks(); vi.useRealTimers();
});

describe('Hatask record review', () => {
	test('authorized moderator loads API records and renders private text as plain text', async () => {
		const { container } = mount(); await flush();
		expect(mocks.api).toHaveBeenCalledWith('admin/hatask/records/list', expect.objectContaining({ kind: 'all', userId: null, cursor: null }));
		expect(container.querySelector('.detail-body')?.textContent).toContain('<script>機密の本文</script>');
		expect(container.querySelector('script')).toBeNull();
		expect(container.textContent).toContain('指定した人'); expect(container.textContent).toContain('private subtask');
	});
	test('ordinary users make no staff API requests; admins can enter', async () => {
		$i!.isModerator = false;
		const { container } = mount(); await flush(); expect(container.querySelector('.review-page')).toBeNull(); expect(mocks.api).not.toHaveBeenCalled();
		$i!.isAdmin = true; await flush(); expect(container.querySelector('.review-page')).toBeTruthy(); expect(mocks.api).toHaveBeenCalled();
	});
	test('revoking a role clears private data and rejects late responses', async () => {
		let complete!: (value: unknown) => void;
		mocks.api.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
		const { container } = mount(); await flush(); $i!.isModerator = false; await flush();
		complete(page()); await flush();
		expect(container.textContent).not.toContain('非公開の予定'); expect(container.querySelector('.review-page')).toBeNull();
	});
	test('API permission revocation removes already visible details', async () => {
		const { container } = mount(); await flush();
		mocks.api.mockRejectedValueOnce({ code: 'ROLE_PERMISSION_DENIED' });
		button(container, '[data-set-state="reviewed"]').click(); await flush();
		expect(container.querySelector('.review-page')).toBeNull(); expect(container.textContent).toContain('権限がありません');
	});
	test('mobile detail opens and returns focus to the selected row', async () => {
		const { container } = mount(); await flush();
		button(container, '[data-record]').click(); await flush();
		expect(container.querySelector('.review-page')?.getAttribute('data-detail-open')).toBe('true');
		button(container, '.detail-back').click(); await flush();
		expect(container.querySelector('.review-page')?.getAttribute('data-detail-open')).toBe('false'); expect(window.document.activeElement).toBe(container.querySelector('[data-record]'));
	});
	test('loads the next cursor and resets pages when filters change', async () => {
		mocks.api.mockImplementation(async endpoint => endpoint.endsWith('/list') ? page([item()], { nextCursor: 'cursor', total: 2 }) : detail());
		const { container } = mount(); await flush();
		mocks.api.mockResolvedValueOnce(page([item({ id: 'c'.repeat(64) })], { total: 2 }));
		button(container, '.list-end button').click(); await flush(); expect(container.querySelectorAll('[data-record]')).toHaveLength(2);
		expect(mocks.api).toHaveBeenCalledWith('admin/hatask/records/list', expect.objectContaining({ cursor: 'cursor' }));
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')!; search.value = '新しい条件'; search.dispatchEvent(new Event('input'));
		await flush(); expect(container.querySelectorAll('[data-record]')).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(350); await flush();
		expect(mocks.api).toHaveBeenCalledWith('admin/hatask/records/list', expect.objectContaining({ query: '新しい条件', cursor: null }));
	});
	test('failed saves keep the previous state; a conflict reloads the latest content', async () => {
		const { container } = mount(); await flush();
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		button(container, '[data-set-state="reviewed"]').click(); await flush();
		expect(button(container, '[data-set-state="unread"]').getAttribute('aria-pressed')).toBe('true'); expect(container.textContent).toContain('保存できませんでした');
		mocks.api.mockRejectedValueOnce({ code: 'HATASK_REVIEW_CONFLICT' }).mockResolvedValueOnce(detail({ title: '別の人による更新', revision: 2 }));
		button(container, '[data-set-state="reviewed"]').click(); await flush();
		expect(container.textContent).toContain('別の人による更新'); expect(container.textContent).toContain('最新の内容を確認');
	});
	test('successful saves use revision/content checks and display the returned shared state', async () => {
		const { container } = mount(); await flush();
		mocks.api.mockResolvedValueOnce(detail({ state: 'reviewed', revision: 1 }));
		button(container, '[data-set-state="reviewed"]').click(); await flush();
		expect(mocks.api).toHaveBeenCalledWith('admin/hatask/records/review', { id, state: 'reviewed', expectedRevision: 0, expectedContentVersion: 'b'.repeat(64) });
		expect(button(container, '[data-set-state="reviewed"]').getAttribute('aria-pressed')).toBe('true');
	});
	test('unmounted views ignore pending requests', async () => {
		let complete!: (value: unknown) => void;
		mocks.api.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
		const { app, container } = mount(); await flush(); app.unmount(); mounted.splice(0, 1);
		complete(page()); await flush(); expect(container.textContent).toBe(''); expect(mocks.api).toHaveBeenCalledTimes(1); container.remove();
	});
	test('local scoped styling includes the reset, narrow layout and theme assets', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskRecordReview.vue'), 'utf8');
		const { descriptor } = parse(source);
		const compiled = compileStyle({ filename: 'HataskRecordReview.vue', source: descriptor.styles[0].content, id: 'data-v-review-test', scoped: true });
		expect(compiled.errors).toEqual([]);
		expect(compiled.code).toContain('.review-page button[data-v-review-test]');
		expect(compiled.code).toContain('@container review-page (max-width: 800px)');
		expect(compiled.code).toContain('var(--hatakyu-calendar)');
		expect(compiled.code).toContain('.review-page[data-theme=\'hatakyu\'] .record-type[data-kind=\'event\'][data-v-review-test]');
		expect(compiled.code).toContain('overflow-wrap: anywhere');
	});
});
