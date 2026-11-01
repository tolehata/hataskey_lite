/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HatadyModeration from './HatadyModeration.vue';
import type { ModerationDetail, ModerationEntry } from '@/utility/hatady-moderation.js';

const fixtures = vi.hoisted(() => ({ api: vi.fn(), width: 800 }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: vi.fn() }));
vi.mock('@/utility/record-moderation.js', () => ({ openRecordModeration: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'staff', isModerator: true, isAdmin: false } }));
vi.mock('@/components/MkReactionIcon.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ props: { reaction: String }, setup: props => () => render('span', { 'data-emoji': props.reaction }, props.reaction) }) };
});
vi.mock('@/components/MkMediaList.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ props: { mediaList: Array }, setup: props => () => render('div', { 'data-images': JSON.stringify(props.mediaList) }) }) };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { title: String, centerTitle: Boolean, scrollHint: Boolean, busy: Boolean },
		emits: ['close', 'closed'],
		setup(props, { slots, emit, expose }) {
			expose({ close: () => emit('closed') });
			return () => render('section', { role: 'dialog', 'aria-label': props.title }, [render('button', { 'aria-label': '閉じる', onClick: () => emit('close') }, '閉じる'), slots.default?.()]);
		},
	}) };
});

const cleanups: Array<() => void> = [];
const makeEntry = (id: string): ModerationEntry => ({
	key: `log:${id}`, targetType: 'log', targetId: id, category: 'record', activity: 'study',
	actor: { id: 'actor', username: 'haru', name: 'はる', host: null } as ModerationEntry['actor'],
	title: `記録 ${id}`, body: '省略されない全文', visibility: 'private', createdAt: '2026-09-16T12:00:00Z',
	emoji: null, parentKey: null, contentVersion: 'a'.repeat(32),
	review: { state: 'unreviewed', note: '', revision: 0, reviewer: null, reviewedAt: null, stale: false },
});

function makeDetail(item: ModerationEntry): ModerationDetail {
	return { item, fields: [{ label: 'メモ', value: '詳しい内容' }], ancestors: [], related: item.targetId === 'a' ? [makeEntry('b')] : [], relatedHasMore: false };
}

async function settle() { await Promise.resolve(); await nextTick(); await nextTick(); }

async function mountView() {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HatadyModeration) });
	app.component('MkAvatar', { render: () => h('span') });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await vi.advanceTimersByTimeAsync(0);
	await settle();
	return host;
}

beforeEach(() => {
	vi.useFakeTimers();
	fixtures.width = 800;
	fixtures.api.mockReset();
	fixtures.api.mockImplementation(async (endpoint: string, payload: Record<string, unknown>) => {
		if (endpoint.endsWith('/list')) return { items: [makeEntry('a'), makeEntry('b')], total: 2, nextCursor: null, counts: { unreviewed: 2, flagged: 0, reviewed: 0 } };
		if (endpoint.endsWith('/show')) return makeDetail(makeEntry(String(payload.targetId)));
		throw new Error(`Unexpected API: ${endpoint}`);
	});
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => fixtures.width);
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('Hatady moderation view', () => {
	test('shows attached record images in the staff detail', async () => {
		const host = await mountView();
		const files = [{ id: 'photo', type: 'image/png', url: '/files/photo', isSensitive: true }];
		fixtures.api.mockResolvedValueOnce(makeDetail({ ...makeEntry('a'), fileIds: ['photo'], files: files as ModerationEntry['files'] }));
		host.querySelector<HTMLButtonElement>('[data-key="log:a"]')!.click();
		await settle();
		expect(window.document.querySelector('[data-images]')?.getAttribute('data-images')).toBe(JSON.stringify(files));
	});

	test('the actual capsule keeps only the selected label and forwards each category to the combined query', async () => {
		const host = await mountView();
		expect(host.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe('検索内容を入力...');
		const capsule = host.querySelector('[role="group"][aria-label="確認する内容の種類"]')!;
		const buttons = Array.from(capsule.querySelectorAll<HTMLButtonElement>('button'));
		expect(buttons).toHaveLength(5);
		for (const [index, category] of ['all', 'collection', 'record', 'comment', 'reaction'].entries()) {
			buttons[index].click();
			await vi.advanceTimersByTimeAsync(0);
			await settle();
			const requests = fixtures.api.mock.calls.filter(([endpoint]) => endpoint.endsWith('/list'));
			expect(requests.at(-1)?.[1].category).toBe(category);
			expect(buttons.filter(button => button.querySelector('span'))).toEqual([buttons[index]]);
			expect(buttons[index].getAttribute('aria-pressed')).toBe('true');
			expect(buttons.every(button => Boolean(button.getAttribute('aria-label')))).toBe(true);
		}
	});

	test('a narrow detail uses one dialog editor, keeps per-target notes through related navigation, and restores the selected row focus', async () => {
		const host = await mountView();
		const first = host.querySelector<HTMLButtonElement>('[data-key="log:a"]')!;
		first.click();
		await settle();
		const dialog = window.document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(dialog).not.toBeNull();
		expect(dialog.textContent).toContain('省略されない全文');
		expect(window.document.querySelectorAll('textarea')).toHaveLength(1);
		const note = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
		note.value = 'A の確認途中';
		note.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		const related = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent?.includes('この内容への投稿'))!;
		related.click();
		await settle();
		expect(dialog.querySelector('h2')?.textContent).toBe('記録 b');
		expect(window.document.activeElement).toBe(dialog.querySelector('h2'));
		dialog.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')!.click();
		await settle();
		expect(window.document.querySelector('[role="dialog"]')).toBeNull();
		expect(window.document.activeElement).toBe(host.querySelector('[data-key="log:b"]'));
		first.click();
		await settle();
		expect(window.document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')?.value).toBe('A の確認途中');
		const ids = Array.from(window.document.querySelectorAll('[id]'), element => element.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
