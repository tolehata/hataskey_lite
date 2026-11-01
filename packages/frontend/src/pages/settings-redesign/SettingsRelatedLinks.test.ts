/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, provide, ref } from 'vue';
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
import SettingsRelatedLinks from './SettingsRelatedLinks.vue';
import source from './SettingsRelatedLinks.vue?raw';
import type { SettingsRelatedLink } from './SettingsRelatedLinks.vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

function fiveMeaningfulItems(): SettingsRelatedLink[] {
	return Array.from({ length: 5 }, (_, index) => ({
		stableId: `settings.control.related-${index}`,
		route: '/settings/preferences',
		controlId: `settings.control.related-${index}`,
		label: `関連設定 ${index + 1}`,
		reason: '同じ表示設定',
	}));
}

describe('settings related links', () => {
	test('初期表示は最大3件で、ほかn件を見るから残りの有意候補を開く', async () => {
		const selected = vi.fn();
		const app = createApp(defineComponent({
			setup() {
				return () => h(SettingsRelatedLinks, { items: fiveMeaningfulItems(), onSelect: selected });
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await nextTick();

		expect(container.querySelectorAll('button')).toHaveLength(4);
		expect(container.querySelector('[data-settings-related]')?.textContent).toContain('こちらをお探しですか？');
		expect(container.querySelectorAll('[role]')).toHaveLength(0);
		const more = [...container.querySelectorAll<HTMLButtonElement>('button')]
			.find(button => button.textContent?.includes('ほか'));
		expect(more?.textContent).toContain('ほか2件を見る');
		more?.click();
		await nextTick();
		expect(container.querySelectorAll('button')).toHaveLength(5);
		expect([...container.querySelectorAll<HTMLButtonElement>('button')]
			.some(button => button.textContent?.includes('ほか'))).toBe(false);
	});

	test('破壊的候補は初期表示・展開後とも関連UIに出さない', async () => {
		const app = createApp(defineComponent({
			setup() {
				return () => h(SettingsRelatedLinks, {
					items: [...fiveMeaningfulItems(), {
						stableId: 'settings.shell.logout', route: '/settings', controlId: 'settings.shell.logout', label: 'ログアウト', destructive: true,
					}],
				});
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await nextTick();
		expect(container.textContent).not.toContain('ログアウト');
	});

	test('アプリのモーション無効contextでも160ms置換モーションを有効化しない', async () => {
		const app = createApp(defineComponent({
			setup() {
				provide(settingsSearchV2ContextKey, {
					catalog: ref(null),
					navigateToSetting: vi.fn(),
					motionEnabled: ref(false),
				});
				return () => h(SettingsRelatedLinks, { items: fiveMeaningfulItems() });
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await nextTick();
		expect(container.firstElementChild?.getAttribute('data-motion-enabled')).toBe('false');
		expect(source).toContain('160ms');
		expect(source).toContain('min-height: 44px');
		expect(source).toContain('color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent)');
		expect(source).toContain('white-space: nowrap');
		expect(source).not.toContain('border: 1px dashed');
		expect(source).not.toContain('role="listitem"');
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
	});
});
