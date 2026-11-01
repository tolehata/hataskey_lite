/* SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick } from 'vue';
import { afterEach, expect, test, vi } from 'vitest';
import HatagoesSupportButton from './HatagoesSupportButton.vue';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));

const mounted: { unmount: () => void; element: HTMLElement }[] = [];

async function settle() { for (let i = 0; i < 3; i++) { await Promise.resolve(); await nextTick(); } }

function mount(open = vi.fn()) {
	const element = window.document.createElement('div');
	window.document.body.append(element);
	const app = createApp({ setup: () => () => h(HatagoesSupportButton, { onOpen: open }) });
	app.mount(element);
	mounted.push({ unmount: () => app.unmount(), element });
	return { element, open };
}

afterEach(() => { for (const item of mounted.splice(0)) { item.unmount(); item.element.remove(); } api.mockReset(); });

test('未設定でも表示許可があれば支援情報を開ける', async () => {
	api.mockResolvedValue({ configured: false, navButtonVisible: true, settings: null });
	const { element, open } = mount();
	await settle();
	const button = element.querySelector<HTMLButtonElement>('button[aria-label="支援情報"]');
	expect(button).not.toBeNull();
	button!.click();
	expect(open).toHaveBeenCalledOnce();
	expect(api).toHaveBeenCalledWith('hatask/support/show', {}, undefined, expect.any(AbortSignal));
});

test('管理者が非表示にした場合と取得失敗時はボタンを出さない', async () => {
	api.mockResolvedValueOnce({ configured: true, navButtonVisible: false });
	const hidden = mount();
	await settle();
	expect(hidden.element.querySelector('button')).toBeNull();
	api.mockRejectedValueOnce(new Error('offline'));
	const failed = mount();
	await settle();
	expect(failed.element.querySelector('button')).toBeNull();
});

test('ウィンドウ復帰後に設定を読み直す', async () => {
	api.mockResolvedValueOnce({ navButtonVisible: true }).mockResolvedValueOnce({ navButtonVisible: false });
	const { element } = mount();
	await settle();
	expect(element.querySelector('button')).not.toBeNull();
	window.dispatchEvent(new Event('focus'));
	await settle();
	expect(element.querySelector('button')).toBeNull();
});
