/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, nextTick } from 'vue';
import type { App } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});

vi.mock('@/pages/settings/index.vue', () => ({
	__esModule: true,
	default: defineComponent({ template: '<h1>旧設定の見出し</h1>' }),
}));

vi.mock('./index.vue', () => ({
	__esModule: true,
	default: defineComponent({
		emits: ['openLegacy'],
		template: '<button type="button" data-open-legacy @click="$emit(\'openLegacy\')">旧設定へ</button>',
	}),
}));

import SettingsGateway from './gateway.vue';

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

async function settle(): Promise<void> {
	await Promise.resolve();
	await vi.dynamicImportSettled();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
	window.document.querySelectorAll('[aria-label="新しい設定画面に戻る"]').forEach(element => element.remove());
	vi.restoreAllMocks();
});

describe('settings redesign gateway', () => {
	test('new/old mode switch gives screen readers a focused labelled context region', async () => {
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
			callback(0);
			return 1;
		});
		const app = createApp(SettingsGateway);
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await settle();

		const redesigned = container.querySelector<HTMLElement>('[role="region"][aria-label="新しい設定"]');
		expect(redesigned).not.toBeNull();
		container.querySelector<HTMLButtonElement>('[data-open-legacy]')?.click();
		await settle();
		const legacy = container.querySelector<HTMLElement>('[role="region"][aria-label="旧設定"]');
		expect(legacy).not.toBeNull();
		expect(window.document.activeElement).toBe(legacy);

		window.document.querySelector<HTMLButtonElement>('[aria-label="新しい設定画面に戻る"]')?.click();
		await settle();
		expect(window.document.activeElement).toBe(container.querySelector('[role="region"][aria-label="新しい設定"]'));
	});
});
