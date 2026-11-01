/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, provide, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import MkFolder from './MkFolder.vue';
import folderSource from './MkFolder.vue?raw';
import type { App } from 'vue';
import type { SettingsSearchNavigationTargetV2, SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/preferences.js', () => ({
	prefer: { s: { animation: false, 'experimental.enableFolderPageView': false } },
}));
vi.mock('@/utility/get-bg-color.js', () => ({ getBgColor: () => null }));
vi.mock('@/os.js', () => ({
	pageFolderTeleportCount: { value: 0 },
	popup: vi.fn(),
}));
vi.mock('@/components/MkFolderPage.vue', () => ({
	default: defineComponent({ name: 'MkFolderPageStub', render: () => null }),
}));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

function mountFolder(
	target = ref<SettingsSearchNavigationTargetV2 | null>(null),
	descendantIds = 'settings.control.target',
	descendantMarkers = '',
) {
	const context: SettingsSearchV2Context = {
		catalog: ref(null),
		navigateToSetting: vi.fn(),
		activeNavigationTarget: target,
	};
	const app = createApp(defineComponent({
		setup() {
			provide(settingsSearchV2ContextKey, context);
			return () => h(MkFolder, {
				canPage: false,
				'data-settings-search-descendant-ids': descendantIds,
				'data-settings-search-descendant-markers': descendantMarkers,
			}, {
				label: () => '折りたたみ設定',
				default: () => h('input', { 'data-settings-search-id': 'settings.control.target' }),
			});
		},
	}));
	app.component('MkStickyContainer', defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()); } }));
	app.component('MkCondensedLine', defineComponent({ setup(_, { slots }) { return () => h('span', slots.default?.()); } }));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, target };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('MkFolder settings search disclosure', () => {
	test('検索対象を含むfolderだけを開き、内側controlをDOMへ到達可能にする', async () => {
		const { container, target } = mountFolder();
		await nextTick();
		expect(container.querySelector('[data-settings-search-id]')).toBeNull();

		target.value = { route: '/settings/preferences', controlId: 'settings.control.target' };
		await vi.waitFor(() => {
			expect(container.querySelector('[role="group"]')?.getAttribute('aria-expanded')).toBe('true');
			expect(container.querySelector('[data-settings-search-id="settings.control.target"]')).not.toBeNull();
		});
	});

	test('無関係なfolderを開かず、marker targetも明示された祖先だけに限定する', async () => {
		const { container } = mountFolder(ref({ route: '/settings/preferences', anchor: 'marker-target' }), 'settings.control.other');
		await nextTick();
		await nextTick();
		expect(container.querySelector('[role="group"]')?.getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector('[data-settings-search-id]')).toBeNull();
		expect(folderSource).toContain('data-settings-search-descendant-markers');
		expect(folderSource).toContain('if (asPage && nextOpened)');
		expect(folderSource).toContain('no preference or form value is written');
	});

	test('marker targetは配下markerの完全一致でだけ開く', async () => {
		const { container } = mountFolder(
			ref({ route: '/settings/preferences', anchor: 'marker-target' }),
			'settings.control.other',
			'root-marker marker-target nested-marker',
		);
		await vi.waitFor(() => expect(container.querySelector('[role="group"]')?.getAttribute('aria-expanded')).toBe('true'));
	});
});
