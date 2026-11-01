/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Test-only parent and global component stubs. */

import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsEmbeddedWindow from './SettingsEmbeddedWindow.vue';
import type { App } from 'vue';

vi.mock('@/i18n.js', () => ({ i18n: { ts: { 'close': '閉じる', done: '完了' } } }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));

const mounted: { app: App; container: HTMLDivElement }[] = [];

function mountWindow(initialProps: Record<string, unknown> = {}, withHeader = true) {
	const handle = ref<InstanceType<typeof SettingsEmbeddedWindow> | null>(null);
	const onClosed = vi.fn();
	// The real Hatask, earthquake and mascot owners all call close() here.
	// Limit re-entry so a regression is an assertion failure, not a stack overflow.
	const onClose = vi.fn(() => {
		if (onClose.mock.calls.length < 3) handle.value?.close();
	});
	const onOk = vi.fn();
	const props = reactive(initialProps);
	const app = createApp(defineComponent({
		setup: () => () => h(SettingsEmbeddedWindow, { ...props, ref: handle, onClose, onClosed, onOk }, {
			...(withHeader ? { header: () => '設定' } : {}),
			default: () => h('div', { 'data-embedded-scroll': '' }, '本文'),
			footer: () => 'フッター',
		}),
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.component('MkA', defineComponent({ setup: (_, { slots }) => () => h('a', slots.default?.()) }));
	app.mount(container);
	mounted.push({ app, container });
	return { handle, container, props, onClose, onClosed, onOk };
}

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

describe('SettingsEmbeddedWindow', () => {
	it('公開closeはclose要求を再発火させず、closedを一度だけ通知する', () => {
		const { handle, onClose, onClosed } = mountWindow();
		handle.value?.close();
		handle.value?.close();
		expect(onClose).not.toHaveBeenCalled();
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('モーダルと同じclose要求を親が受け取り、一度だけ閉じる', () => {
		const { container, onClose, onClosed } = mountWindow({ withCloseButton: true });
		const closeButton = container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-close"]');
		expect(closeButton?.getAttribute('aria-label')).toBe('閉じる');
		closeButton?.click();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('MkWindow由来の閉じるボタンは公開closeと同じ経路を使う', () => {
		const { container, onClose, onClosed } = mountWindow({ closeButton: true });
		const closeButton = container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-close"]');
		expect(closeButton).not.toBeNull();
		closeButton?.click();
		expect(onClose).not.toHaveBeenCalled();
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('OKは保存可能になるまで無効で、押すとokのみを通知する', async () => {
		const { container, props, onOk, onClose, onClosed } = mountWindow({ withOkButton: true, okButtonDisabled: true });
		const ok = container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-ok"]');
		expect(ok?.textContent).toContain('完了');
		expect(ok?.disabled).toBe(true);
		ok?.click();
		expect(onOk).not.toHaveBeenCalled();
		props.okButtonDisabled = false;
		await nextTick();
		expect(ok?.disabled).toBe(false);
		ok?.click();
		expect(onOk).toHaveBeenCalledTimes(1);
		expect(onClose).not.toHaveBeenCalled();
		expect(onClosed).not.toHaveBeenCalled();
	});

	it('指定のないOKと明示的に無効な閉じるボタンは表示しない', () => {
		const { container } = mountWindow({ withCloseButton: false });
		expect(container.querySelector('header')?.textContent).toBe('設定');
		expect(container.querySelectorAll('button')).toHaveLength(0);
		expect(container.querySelector('[data-embedded-scroll]')?.textContent).toBe('本文');
		expect(container.querySelector('footer')?.textContent).toBe('フッター');
	});

	it('自前の見出しを持つMkModal利用者へ重複ヘッダーを追加しない', () => {
		const { container } = mountWindow({}, false);
		expect(container.querySelector('header')).toBeNull();
	});
});
