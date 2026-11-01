/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CherryPickSettings from './cherrypick.vue';
import HataCustomSettings from './hata-custom.vue';
import type { App, Component, Ref } from 'vue';
import type { SettingsBentoCategoryId } from '@/pages/settings-redesign/settings-bento-catalog.js';
import type { SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

const mocks = vi.hoisted(() => ({ writes: vi.fn(), commit: vi.fn(), reload: vi.fn(), api: vi.fn(), models: vi.fn(), seed: vi.fn(), read: vi.fn(), resetPreferences: vi.fn(), popup: vi.fn() }));
const stubs = await vi.hoisted(async () => {
	const vue = await import('vue');
	const body = vue.defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => vue.h('div', [slots.label?.(), slots.default?.(), slots.caption?.()]) });
	const toggle = vue.defineComponent({
		props: { modelValue: Boolean },
		emits: ['update:modelValue'],
		setup: (props, { slots, emit }) => () => vue.h('button', { 'data-setting-switch': '', onClick: () => emit('update:modelValue', !props.modelValue) }, slots.label?.()),
	});
	return { body, toggle };
});
vi.mock('@/components/MkSwitch.vue', () => ({ default: stubs.toggle }));
vi.mock('@/components/MkSelect.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkRadios.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkInput.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkColorInput.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkDisableSection.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkFeatureBanner.vue', () => ({ default: stubs.body }));
vi.mock('@/components/HataAppNavIcon.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkHatakyuIllustration.vue', () => ({ default: stubs.body }));
vi.mock('@/components/form/link.vue', () => ({ default: stubs.body }));
vi.mock('@/components/MkPreferenceContainer.vue', async () => {
	const vue = await import('vue');
	return { default: vue.defineComponent({ props: { k: { type: String, required: true } }, setup: (props, { slots }) => () => vue.h('div', { 'data-preference-key': props.k }, slots.default?.()) }) };
});
vi.mock('@/preferences.js', async () => {
	const { computed, ref: createRef } = await import('vue');
	const values = new Map<string, Ref<unknown>>();
	const valueFor = (key: string) => {
		const value = values.get(key) ?? createRef(key === 'simpleUi.botAllowlist' ? [] : key === 'simpleUi.noteSpacing' ? 'moderate' : false);
		values.set(key, value);
		return value;
	};
	mocks.seed.mockImplementation((key: string, value: unknown) => { valueFor(key).value = value; });
	mocks.read.mockImplementation((key: string) => valueFor(key).value);
	mocks.resetPreferences.mockImplementation(() => values.clear());
	return { prefer: {
		s: {},
		r: new Proxy({}, { get: (_, key) => valueFor(String(key)) }),
		model: (key: string) => {
			mocks.models(key);
			return computed({ get: () => valueFor(key).value, set: value => { mocks.writes(key, value); valueFor(key).value = value; } });
		},
		commit: mocks.commit,
	} };
});
vi.mock('@/i18n.js', () => {
	const copy = () => new Proxy({}, { get: (_, key) => String(key) });
	return { i18n: {
		ts: { _cherrypick: copy(), _nsfwOpenBehavior: copy(), _hata: { _customSettings: {
			...Object.fromEntries(['_general', '_font', '_ui', '_visual', '_hatask', '_hatady', '_mascot', '_other'].map(key => [key, copy()])),
			title: 'Hataskey', categoryVisual: 'categoryVisual',
		} } },
		tsx: { _hata: { _customSettings: {} } },
	} };
});
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/utility/reload-suggest.js', () => ({ suggestReload: mocks.reload }));
vi.mock('@/utility/hatakyu-assets.js', () => ({ brandedIconUrl: () => '', useHatakyuBranding: () => false }));
vi.mock('@/utility/hata-app-brand.js', () => ({ hataAppForMenuIcon: () => null }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: vi.fn(), uploadFile: vi.fn() }));
vi.mock('@/i.js', () => ({ ensureSignin: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: mocks.popup }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => 'simple' } }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/utility/hidden-reactions.js', async () => ({ getHiddenReactions: () => [], hiddenReactionsVersion: (await import('vue')).ref(0) }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref: createRef } = await import('vue');
	return { glassUiLocal: createRef(true), setGlassUiLocal: vi.fn(), glassUiBubbleLocal: createRef(true), setGlassUiBubbleLocal: vi.fn(), hideMutedReactionsLocal: createRef(false), setHideMutedReactionsLocal: vi.fn(), foldableLayoutMode: createRef('auto'), setFoldableLayoutMode: vi.fn() };
});
vi.mock('@/scripts/hata-font-manager.js', () => ({ HATA_FONT_PRESETS: [], DEFAULT_HATA_FONT_ID: 'system', SYSTEM_HATA_FONT_STACK: 'sans-serif', applyHataFont: vi.fn(), resolveHataFontId: () => 'system' }));

const mounted: { app: App; container: HTMLDivElement }[] = [];

function mountOwner(component: Component, initialCategory?: SettingsBentoCategoryId, context?: SettingsSearchV2Context) {
	const category = ref(initialCategory);
	const app = createApp(defineComponent({ setup: () => () => h(component, { presentationCategory: category.value }) }));
	if (context != null) app.provide(settingsSearchV2ContextKey, context);
	for (const name of ['SearchMarker', 'SearchLabel', 'SearchText', 'MkAvatar', 'MkUserName']) app.component(name, stubs.body);
	app.directive('tooltip', {});
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { category, container };
}

function visible(element: Element): boolean {
	for (let node: Element | null = element; node != null; node = node.parentElement) {
		if ((node as HTMLElement).style.display === 'none') return false;
	}
	return true;
}

function visiblePreferenceKeys(container: HTMLElement): string[] {
	return [...container.querySelectorAll('[data-preference-key]')].filter(visible).map(element => element.getAttribute('data-preference-key') ?? '').sort();
}

function visibleSwitches(container: HTMLElement): string[] {
	return [...container.querySelectorAll('[data-setting-switch]')].filter(visible).map(element => element.textContent.trim());
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resetPreferences();
	mocks.api.mockResolvedValue([]);
	mocks.popup.mockReturnValue({ dispose: vi.fn() });
});
afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

describe('CherryPick settings category presentation', () => {
	it.each([
		['advanced', ['nicknameEnabled']],
		['post', ['postFormVisibilityHotkey', 'renameTheButtonInPostFormToNya', 'useEnterToSend']],
		['timeline', ['expandOnNoteClick', 'expandOnNoteClickBehavior', 'reactableRemoteReactionEnabled', 'showRenoteConfirmPopup']],
		['appearance', ['displayHeaderNavBarWhenScroll', 'mobileHeaderChange']],
		['notify', ['showFollowingMessageInsteadOfButtonEnabled']],
	] as const)('%sは分類対象の既存コントロールだけを表示する', (category, keys) => {
		const { container } = mountOwner(CherryPickSettings, category);
		expect(visiblePreferenceKeys(container)).toEqual([...keys].sort());
	});

	it('カテゴリ未指定では従来11項目すべてを表示する', () => {
		const { container } = mountOwner(CherryPickSettings);
		expect(visiblePreferenceKeys(container)).toHaveLength(11);
	});

	it('カテゴリ切替でownerを再生成せず、元の保存と再読込通知を使う', async () => {
		const { category, container } = mountOwner(CherryPickSettings, 'post');
		const modelCount = mocks.models.mock.calls.length;
		container.querySelector<HTMLButtonElement>('[data-preference-key="renameTheButtonInPostFormToNya"] button')?.click();
		await nextTick();
		expect(mocks.writes).toHaveBeenCalledExactlyOnceWith('renameTheButtonInPostFormToNya', true);
		expect(mocks.commit).toHaveBeenCalledExactlyOnceWith('renameTheButtonInPostFormToNyaManualSet', true);
		expect(mocks.reload).toHaveBeenCalledTimes(1);
		category.value = 'timeline';
		await nextTick();
		expect(mocks.models).toHaveBeenCalledTimes(modelCount);
		expect(visiblePreferenceKeys(container)).toContain('expandOnNoteClick');
		expect(mocks.writes).toHaveBeenCalledTimes(1);
	});
});

describe('Hataskey custom settings category presentation', () => {
	it('新カテゴリのUI変更と設定転送はshellだけに渡し、独自popupを重ねない', async () => {
		const navigateToSetting = vi.fn();
		const { category, container } = mountOwner(HataCustomSettings, 'appearance', { catalog: ref(null), navigateToSetting });
		const uiButton = [...container.querySelectorAll('button')].find(button => visible(button) && button.textContent.trim() === 'openUiSetup');
		expect(uiButton).toBeDefined();
		uiButton?.click();
		expect(navigateToSetting).toHaveBeenNthCalledWith(1, { route: '/settings/hata-custom', activation: { kind: 'popup', category: 'general', popup: 'ui-setup' } });
		category.value = 'data';
		await nextTick();
		const transferButton = [...container.querySelectorAll('button')].find(button => visible(button) && button.textContent.trim() === 'openTransfer');
		expect(transferButton).toBeDefined();
		transferButton?.click();
		expect(navigateToSetting).toHaveBeenNthCalledWith(2, { route: '/settings/hata-custom', activation: { kind: 'popup', category: 'general', popup: 'settings-transfer' } });
		expect(navigateToSetting).toHaveBeenCalledTimes(2);
		expect(mocks.popup).not.toHaveBeenCalled();
	});

	it('legacy表示はcontextがあっても既存のpopup起動を維持する', async () => {
		const navigateToSetting = vi.fn();
		const { container } = mountOwner(HataCustomSettings, undefined, { catalog: ref(null), navigateToSetting });
		for (const text of ['openUiSetup', 'openTransfer']) {
			const button = [...container.querySelectorAll('button')].find(candidate => visible(candidate) && candidate.textContent.trim() === text);
			expect(button).toBeDefined();
			button?.click();
		}
		await vi.waitFor(() => expect(mocks.popup).toHaveBeenCalledTimes(2));
		expect(navigateToSetting).not.toHaveBeenCalled();
	});

	it.each([
		{ deck: false, spacing: 'compact' },
		{ deck: true, spacing: 'wide' },
	])('分類の閲覧とdeck切替で隠れた投稿間隔を書き換えない: $spacing / deck=$deck', async ({ deck, spacing }) => {
		mocks.seed('simpleUi.noteSpacing', spacing);
		mocks.seed('simpleUi.deckMode', deck);
		const { category } = mountOwner(HataCustomSettings, 'appearance');
		expect(mocks.read('simpleUi.noteSpacing')).toBe(spacing);
		for (const next of ['post', 'notify', 'data', 'timeline'] as const) {
			category.value = next;
			mocks.seed('simpleUi.deckMode', !mocks.read('simpleUi.deckMode'));
			await nextTick();
			expect(mocks.read('simpleUi.noteSpacing')).toBe(spacing);
		}
		expect(mocks.writes).not.toHaveBeenCalled();
	});

	it('legacyの投稿間隔移行とdeck切替時の保存・復元は維持する', async () => {
		mocks.seed('simpleUi.noteSpacing', 'compact');
		mountOwner(HataCustomSettings);
		expect(mocks.writes).toHaveBeenCalledExactlyOnceWith('simpleUi.noteSpacing', 'moderate');
		mocks.seed('simpleUi.noteSpacing', 'wide');
		mocks.seed('simpleUi.deckMode', true);
		await nextTick();
		expect(mocks.read('simpleUi.noteSpacing')).toBe('compact');
		mocks.seed('simpleUi.deckMode', false);
		await nextTick();
		expect(mocks.read('simpleUi.noteSpacing')).toBe('wide');
	});

	it('BOT許可一覧はtimeline初回表示で読み、同じ一覧の再表示では照会し直さない', async () => {
		mocks.seed('simpleUi.botAllowlist', ['bot']);
		mocks.api.mockResolvedValue([{ id: 'bot', isBot: true }]);
		const { category } = mountOwner(HataCustomSettings, 'appearance');
		for (const next of ['post', 'notify', 'data'] as const) {
			category.value = next;
			await nextTick();
		}
		expect(mocks.api).not.toHaveBeenCalled();
		expect(mocks.writes).not.toHaveBeenCalled();
		category.value = 'timeline';
		await nextTick();
		expect(mocks.api).toHaveBeenCalledExactlyOnceWith('users/show', { userIds: ['bot'] });
		category.value = 'post';
		await nextTick();
		category.value = 'timeline';
		await nextTick();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		category.value = 'post';
		await nextTick();
		mocks.seed('simpleUi.botAllowlist', ['bot', 'missing']);
		await nextTick();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		expect(mocks.writes).not.toHaveBeenCalled();
		category.value = 'timeline';
		await nextTick();
		expect(mocks.api).toHaveBeenCalledWith('users/show', { userIds: ['bot', 'missing'] });
		expect(mocks.writes).toHaveBeenCalledExactlyOnceWith('simpleUi.botAllowlist', ['bot']);
	});

	it('legacyは起動時にBOT一覧を読み、無効なIDの整理を維持する', async () => {
		mocks.seed('simpleUi.botAllowlist', ['missing']);
		mountOwner(HataCustomSettings);
		await nextTick();
		expect(mocks.api).toHaveBeenCalledExactlyOnceWith('users/show', { userIds: ['missing'] });
		expect(mocks.writes).toHaveBeenCalledExactlyOnceWith('simpleUi.botAllowlist', []);
	});

	it('既存post操作を接続し、他ownerにある公開範囲枠を二重表示しない', async () => {
		const { category, container } = mountOwner(HataCustomSettings, 'post');
		const modelCount = mocks.models.mock.calls.length;
		expect(visibleSwitches(container)).toEqual(['showHashtagButton', 'showDrawingButton']);
		[...container.querySelectorAll<HTMLButtonElement>('[data-setting-switch]')].find(button => visible(button) && button.textContent === 'showHashtagButton')?.click();
		await nextTick();
		expect(mocks.writes).toHaveBeenCalledExactlyOnceWith('showHashtagButtonInPostForm', true);
		category.value = 'timeline';
		await nextTick();
		expect(visibleSwitches(container)).toEqual(['hideMutedReactions', 'hideBotPostsLabel']);
		expect(mocks.models).toHaveBeenCalledTimes(modelCount);
		expect(mocks.writes).toHaveBeenCalledTimes(1);
	});

	it('通知とdataへ切替後も同じownerを使用する', async () => {
		const { category, container } = mountOwner(HataCustomSettings, 'notify');
		const modelCount = mocks.models.mock.calls.length;
		expect(visibleSwitches(container)).toEqual(['showLoginDaysPopup']);
		category.value = 'data';
		await nextTick();
		expect(visibleSwitches(container)).toEqual([]);
		const visibleText = [...container.querySelectorAll('button')].filter(visible).map(button => button.textContent.trim());
		expect(visibleText).toEqual(['openTransfer']);
		expect(mocks.models).toHaveBeenCalledTimes(modelCount);
		expect(mocks.writes).not.toHaveBeenCalled();
	});

	it('カテゴリ未指定では従来generalの公開範囲枠とカテゴリ切替を維持する', async () => {
		const { container } = mountOwner(HataCustomSettings);
		expect(visibleSwitches(container)).toContain('colorByVisibility');
		const visualTab = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'categoryVisual');
		expect(visualTab).toBeDefined();
		visualTab?.click();
		await nextTick();
		expect(visibleSwitches(container)).toContain('enableGlassEffect');
	});
});
