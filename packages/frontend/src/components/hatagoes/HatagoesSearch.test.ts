/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
import HatagoesSearch from './HatagoesSearch.vue';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

function result(items: { id: string; title: string; url: string }[], hasMore = false) {
	return { items: items.map(item => ({ ...item, app: 'hatask', kind: 'todo', text: '', targetId: item.id })), total: hasMore ? 2 : items.length,
		hasMore, counts: { hatask: items.length, hatady: 0, hatafeed: 0, users: 0 } };
}

async function settle() { await Promise.resolve(); await nextTick(); await nextTick(); }

let cleanup: (() => void) | undefined;

function mount() {
	const active = ref(true);
	const close = vi.fn();
	const open = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatagoesSearch, { active: active.value, onClose: close, onOpen: open }) });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	const input = target.querySelector('input[type=search]') as HTMLInputElement;
	return { target, input, active, close, open, async query(value: string) {
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		await vi.advanceTimersByTimeAsync(300);
		await settle();
	} };
}

beforeEach(() => { api.mockReset(); vi.useFakeTimers(); });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); });

describe('HataGoes search requests', () => {
	test('closes from its named dialog and cancels a hidden request without losing the query', async () => {
		const pending = deferred<ReturnType<typeof result>>();
		api.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(result([{ id: 'fresh', title: '再表示', url: '/hatask?tab=todo' }]));
		const view = mount();
		await view.query('読書');
		expect(view.target.querySelector('[role="dialog"][aria-labelledby="hatagoes-search-heading"]')).not.toBeNull();
		view.active.value = false;
		await settle();
		expect(api.mock.calls[0]?.[3]?.aborted).toBe(true);
		pending.resolve(result([{ id: 'stale', title: '古い結果', url: '/hatask?tab=todo' }]));
		await settle();
		expect(view.target.textContent).not.toContain('古い結果');
		view.active.value = true;
		await settle();
		expect(view.input.value).toBe('読書');
		expect(view.target.textContent).toContain('再表示');
		(view.target.querySelector('[aria-label="検索を閉じる"]') as HTMLButtonElement).click();
		expect(view.close).toHaveBeenCalledOnce();
	});
	test('ignores a late response for an older query', async () => {
		const first = deferred<ReturnType<typeof result>>();
		const second = deferred<ReturnType<typeof result>>();
		api.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const view = mount();
		await view.query('古い');
		await view.query('新しい');
		second.resolve(result([{ id: 'new', title: '新しい結果', url: '/hatask?tab=todo' }]));
		await settle();
		first.resolve(result([{ id: 'old', title: '古い結果', url: '/hatask?tab=todo' }]));
		await settle();
		expect(view.target.textContent).toContain('新しい結果');
		expect(view.target.textContent).not.toContain('古い結果');
	});

	test('retries a failed additional page at the same offset without losing results', async () => {
		api.mockResolvedValueOnce(result([{ id: 'first', title: '先頭', url: '/hatask?tab=todo' }], true))
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(result([{ id: 'second', title: '続き', url: '/hatask?tab=todo' }]));
		const view = mount();
		await view.query('記録');
		const more = [...view.target.querySelectorAll('button')].find(button => button.textContent?.includes('さらに表示'))!;
		more.click();
		await settle();
		const retry = [...view.target.querySelectorAll('button')].find(button => button.textContent?.includes('再試行'))!;
		retry.click();
		await settle();
		expect(api.mock.calls.map(call => call[1]?.offset)).toEqual([0, 1, 1]);
		expect(view.target.textContent).toContain('先頭');
		expect(view.target.textContent).toContain('続き');
	});

	test('keeps modifier clicks as links and routes an ordinary click through the shell', async () => {
		api.mockResolvedValue(result([{ id: 'todo', title: 'ToDo結果', url: '/hatask?tab=todo' }]));
		const view = mount();
		await view.query('ToDo');
		const link = view.target.querySelector<HTMLAnchorElement>('a[href]')!;
		expect(link.getAttribute('href')).toContain('/hatagoes?');
		link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
		expect(view.open).not.toHaveBeenCalled();
		link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(view.open).toHaveBeenCalledOnce();
	});
});
