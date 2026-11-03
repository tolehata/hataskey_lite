/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsPopupBridge from './SettingsPopupBridge.vue';
import type { App } from 'vue';
import type { SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';

vi.mock('@/components/MkHatasabaUi2EditWindow.vue', async () => {
	const { defineComponent, h, inject } = await import('vue');
	const { settingsSearchV2ContextKey } = await import('@/utility/settings-search-v2-context.js');
	return {
		default: defineComponent({
			emits: ['closed'],
			setup(_, { emit }) {
				const context = inject(settingsSearchV2ContextKey, null);
				return () => h('button', {
					'data-popup-stub': 'hatasaba-ui2',
					'data-has-settings-context': context == null ? 'false' : 'true',
					onClick: () => emit('closed'),
				}, 'hatasaba-ui2');
			},
		}),
	};
});

vi.mock('@/components/MkHataSettingsTransfer.vue', async () => ({ default: (await import('vue')).defineComponent({ template: '<button data-popup-stub="settings-transfer" @click="$emit(\'closed\')">settings-transfer</button>', emits: ['closed'] }) }));
vi.mock('@/components/MkUISetup.vue', async () => ({ default: (await import('vue')).defineComponent({ template: '<button data-popup-stub="ui-setup" @click="$emit(\'closed\')">ui-setup</button>', emits: ['closed'] }) }));

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

function contextFixture(): SettingsSearchV2Context {
	return {
		catalog: ref(null),
		navigateToSetting: vi.fn(),
		motionEnabled: ref(false),
	};
}

function mountBridge(popup: 'hatasaba-ui2' | 'ui-setup' | 'settings-transfer', onClosed = vi.fn()) {
	const context = contextFixture();
	const app = createApp(defineComponent({
		setup() {
			return () => h(SettingsPopupBridge, {
				popup,
				settingsContext: context,
				motionEnabled: false,
				onClosed,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, onClosed };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('SettingsPopupBridge', () => {
	test('global os.popup配下でも同じsettings contextをprovideし、closedを一度だけ転送する', async () => {
		const { container, onClosed } = mountBridge('hatasaba-ui2');
		await nextTick();
		const popup = container.querySelector<HTMLButtonElement>('[data-popup-stub="hatasaba-ui2"]');
		expect(popup?.dataset.hasSettingsContext).toBe('true');
		popup?.click();
		await nextTick();
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	test.each(['ui-setup', 'settings-transfer'] as const)('%s は既存popup componentへ橋渡しする', async popupKind => {
		const { container } = mountBridge(popupKind);
		await nextTick();
		expect(container.querySelector(`[data-popup-stub="${popupKind}"]`)).not.toBeNull();
	});

	test('motion無効時はlayout wrapperを作らず、popup subtreeのmotionを停止する', async () => {
		const { container } = mountBridge('ui-setup');
		await nextTick();
		const scope = container.firstElementChild;
		expect(scope?.getAttribute('data-motion-enabled')).toBe('false');
		const source = await import('./SettingsPopupBridge.vue?raw');
		expect(source.default).toContain('display: contents');
		expect(source.default).toContain('@media (prefers-reduced-motion: reduce)');
	});
});
