/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import type { SettingsPreferenceModels } from './settings-preferences-models.js';

const mocks = vi.hoisted(() => ({ ui: 'simple' as string | null, setDevice: vi.fn(), setProfile: vi.fn(), reload: vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: (key: string) => key === 'ui' ? mocks.ui : null, setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	const tabSwipeEnabled = ref(true);
	return { tabSwipeEnabled, setTabSwipeEnabled: (value: boolean) => { mocks.setDevice(value); tabSwipeEnabled.value = value; } };
});
vi.mock('@/preferences.js', async () => {
	const { computed, ref } = await import('vue');
	const values = new Map<string, ReturnType<typeof ref>>();
	const enableHorizontalSwipe = ref(false);
	values.set('enableHorizontalSwipe', enableHorizontalSwipe);
	return {
		prefer: {
			s: { dataSaver: {}, trustedDomains: [] },
			r: { enableHorizontalSwipe },
			model: (key: string, read = (value: unknown) => value, write = (value: unknown) => value) => {
				const value = values.get(key) ?? ref(false);
				values.set(key, value);
				return computed({ get: () => read(value.value), set: next => { mocks.setProfile(key, write(next)); value.value = write(next); } });
			},
			commit: vi.fn(),
		},
	};
});
vi.mock('@/store.js', () => ({ store: { makeGetterSetter: () => ({ get: () => false, set: vi.fn() }) } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {}, tsx: {} } }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/id.js', () => ({ genId: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/reload-suggest.js', () => ({ suggestReload: mocks.reload }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: vi.fn() }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/instance.js', () => ({ instance: {} }));

const mounted: { app: App; container: HTMLDivElement }[] = [];

async function mountModels() {
	const { createSettingsPreferenceModels } = await import('./settings-preferences-models.js');
	let models!: SettingsPreferenceModels;
	const app = createApp(defineComponent({
		setup() {
			models = createSettingsPreferenceModels();
			return () => h('div');
		},
	}));
	const container = window.document.createElement('div');
	app.mount(container);
	mounted.push({ app, container });
	return models;
}

beforeEach(async () => {
	vi.resetModules();
	const { prefer } = await import('@/preferences.js');
	const { tabSwipeEnabled } = await import('@/utility/hatasaba-device-prefs.js');
	prefer.r.enableHorizontalSwipe.value = false;
	tabSwipeEnabled.value = true;
	vi.clearAllMocks();
});

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

describe('settings preference horizontal swipe persistence', () => {
	it.each(['simple', 'hataskey3', null])('%sでは端末の横スワイプ設定と読み書きを共有する', async ui => {
		mocks.ui = ui;
		const models = await mountModels();
		const device = await import('@/utility/hatasaba-device-prefs.js');
		const { horizontalSwipeEnabled } = await import('@/utility/horizontal-swipe-preference.js');
		const { prefer } = await import('@/preferences.js');
		expect(models.controls.enableHorizontalSwipe.value).toBe(true);
		models.controls.enableHorizontalSwipe.value = false;
		await nextTick();
		expect(mocks.setDevice).toHaveBeenCalledExactlyOnceWith(false);
		expect(mocks.setProfile).not.toHaveBeenCalled();
		expect(horizontalSwipeEnabled.value).toBe(false);
		expect(mocks.reload).toHaveBeenCalledTimes(1);
		device.setTabSwipeEnabled(true);
		expect(models.controls.enableHorizontalSwipe.value).toBe(true);
		prefer.r.enableHorizontalSwipe.value = true;
		device.setTabSwipeEnabled(false);
		expect(models.controls.enableHorizontalSwipe.value).toBe(false);
	});

	it.each(['default', 'deck', 'friendly'])('%sでは従来のプロファイル設定を維持する', async ui => {
		mocks.ui = ui;
		const models = await mountModels();
		const device = await import('@/utility/hatasaba-device-prefs.js');
		const { horizontalSwipeEnabled } = await import('@/utility/horizontal-swipe-preference.js');
		expect(models.controls.enableHorizontalSwipe.value).toBe(false);
		models.controls.enableHorizontalSwipe.value = true;
		await nextTick();
		expect(mocks.setProfile).toHaveBeenCalledExactlyOnceWith('enableHorizontalSwipe', true);
		expect(mocks.setDevice).not.toHaveBeenCalled();
		expect(horizontalSwipeEnabled.value).toBe(true);
		device.setTabSwipeEnabled(false);
		expect(models.controls.enableHorizontalSwipe.value).toBe(true);
	});
});
