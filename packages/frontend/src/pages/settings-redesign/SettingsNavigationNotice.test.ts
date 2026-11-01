/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsNavigationNotice from './SettingsNavigationNotice.vue';
import source from './SettingsNavigationNotice.vue?raw';
import type { App } from 'vue';

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

type NoticeProps = {
	message: string;
	dismissLabel: string;
	dismissible?: boolean;
	motionEnabled?: boolean;
	onDismiss?: () => void;
};

function mountNotice(props: NoticeProps): HTMLDivElement {
	const app = createApp(defineComponent({
		setup() {
			return () => h(SettingsNavigationNotice, props);
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return container;
}

describe('settings navigation notice', () => {
	test('条件未充足の通知はstatus/live領域として表示する', async () => {
		const container = mountNotice({ message: 'この設定を表示するには先に基本設定を有効にしてください', dismissLabel: 'Dismiss' });
		await nextTick();
		const notice = container.querySelector('[role="status"]');
		expect(notice?.getAttribute('aria-live')).toBe('polite');
		expect(notice?.getAttribute('aria-atomic')).toBe('true');
		expect(notice?.textContent).toContain('先に基本設定');
	});

	test('閉じる操作はdismissだけを通知し、表示状態は親に委ねる', async () => {
		const dismissed = vi.fn();
		const app = createApp(defineComponent({
			setup() {
				return () => h(SettingsNavigationNotice, { message: '説明', dismissible: true, dismissLabel: 'Dismiss', motionEnabled: false, onDismiss: dismissed });
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await nextTick();
		container.querySelector<HTMLButtonElement>('button')?.click();
		await nextTick();
		expect(dismissed).toHaveBeenCalledTimes(1);
		expect(container.querySelector<HTMLButtonElement>('button')?.getAttribute('aria-label')).toBe('Dismiss');
		expect(container.querySelector('[role="status"]')).not.toBeNull();
	});

	test('message変更時も表示本体を維持する', async () => {
		const state = ref('最初の条件');
		const updatedApp = createApp(defineComponent({
			setup() {
				return () => h(SettingsNavigationNotice, { message: state.value, dismissible: true, dismissLabel: 'Dismiss' });
			},
		}));
		const updatedContainer = window.document.createElement('div');
		window.document.body.append(updatedContainer);
		updatedApp.mount(updatedContainer);
		mounted.push({ app: updatedApp, container: updatedContainer });
		await nextTick();
		state.value = '新しい条件';
		await nextTick();
		expect(updatedContainer.querySelector('[role="status"]')?.textContent).toContain('新しい条件');
	});

	test('モーション契約はアプリ設定とOSのreduced-motionを尊重する', () => {
		expect(source).toContain('motionEnabled?: boolean');
		expect(source).toContain('dismissLabel: string');
		expect(source).toContain('aria-atomic="true"');
		expect(source).not.toContain('aria-label="閉じる"');
		expect(source).not.toContain('<Transition');
		expect(source).not.toContain('watch(() => props.message');
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
		expect(source).toContain('min-width: 44px');
		expect(source).toContain('line-break: strict');
		expect(source).toContain('var(--MI_THEME-accent)');
	});
});
