/* SPDX-License-Identifier: AGPL-3.0-only */
/* eslint-disable vue/one-component-per-file -- Component mocks share the same mounted test harness. */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';

const state = vi.hoisted(() => ({ modelCreations: 0, controls: {} as Record<string, Ref<unknown>>, account: { policies: { canSetFederationAvatarShape: false, chatAvailability: 'available' } } }));
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	return { i18n: new I18n(yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as never) };
});
vi.mock('@@/js/config.js', () => ({ langs: [['ja-JP', '日本語']], ui: 'desktop' }));
vi.mock('@/i.js', () => ({ $i: state.account }));
vi.mock('@/instance.js', () => ({ instance: { federation: 'all', enableUrlPreview: true } }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true), trustedDomains: ref([]), pinnedUserLists: ref([]) } } };
});
vi.mock('@/store.js', async () => {
	const { ref } = await import('vue');
	return { store: { r: { additionalUnicodeEmojiIndexes: ref({}) } } };
});
vi.mock('@/os.js', () => ({ confirm: vi.fn(async () => ({ canceled: true })) }));
vi.mock('@/preferences/manager.js', () => ({ getInitialPrefValue: () => false }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hataskeyUiSDisplaySize: ref('standard'), setHataskeyUiSDisplaySize: vi.fn() };
});
vi.mock('./settings-preferences-models.js', async () => {
	const { ref } = await import('vue');
	const { preferenceContainerKeys } = await import('./settings-preferences-catalog.js');
	return {
		emojiIndexLangs: ['ja-JP'],
		createSettingsPreferenceModels: () => {
			state.modelCreations++;
			state.controls = Object.fromEntries(preferenceContainerKeys.map(key => [key, ref<unknown>(key === 'fontSize' ? 8 : key === 'postFormVisibilityBorder.enabled' ? false : true)]));
			return {
				controls: state.controls, lang: ref('ja-JP'), overridedDeviceKind: ref(null), realtimeMode: ref(false),
				useBoldFont: ref(false), useSystemFont: ref(false), fontSizeBefore: ref(8),
				externalNavigationWarning: ref(true), trustedDomains: ref(''), trustedDomainsChanged: ref(false),
				searchEngine: ref('other'), searchEngineUrl: ref(''), searchEngineUrlQuery: ref(''),
				dataSaver: ref({ media: false, avatar: false, disableUrlPreview: false, urlPreviewThumbnail: false, code: false }),
				learnMoreCantUseSetFederationAvatarShape: vi.fn(), reload: vi.fn(), setAllDataSaver: vi.fn(),
				saveTrustedDomains: vi.fn(), clearTrustedDomains: vi.fn(), setPinnedList: vi.fn(), removePinnedList: vi.fn(),
				testNotification: vi.fn(), removeEmojiIndex: vi.fn(), downloadEmojiIndex: vi.fn(), chooseNewReaction: vi.fn(), resetReaction: vi.fn(),
			};
		},
	};
});

async function controlStub() {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { modelValue: { type: [String, Number, Boolean, Object, Array], default: undefined }, disabled: Boolean }, emits: ['update:modelValue'],
		setup: (props, { emit, slots }) => () => render('button', {
			type: 'button', disabled: props.disabled, 'data-model-value': String(props.modelValue),
			onClick: () => emit('update:modelValue', !props.modelValue),
		}, slots.label?.()),
	}) };
}

vi.mock('@/components/MkSwitch.vue', controlStub);
vi.mock('@/components/MkInput.vue', controlStub);
vi.mock('@/components/MkSelect.vue', controlStub);
vi.mock('@/components/MkRadios.vue', controlStub);
vi.mock('@/components/MkRange.vue', controlStub);
vi.mock('@/components/MkTextarea.vue', controlStub);
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: (_props, { slots }) => () => render('button', slots.default?.()) }) };
});
vi.mock('@/components/MkInfo.vue', () => ({ default: { template: '<aside><slot/></aside>' } }));
vi.mock('./HataskeyUiSRssSettings.vue', () => ({ default: { template: '<aside data-special-owner="rss"/>' } }));
vi.mock('./HataskeyUiSBottomNavSettings.vue', () => ({ default: { template: '<aside data-special-owner="bottom-nav"/>' } }));
vi.mock('./SettingsSectionExplainer.vue', () => ({ default: { props: ['sectionId'], template: '<figure :data-explainer-section="sectionId"/>' } }));

import Surface from './SettingsPreferencesSurface.vue';
import { bentoPreferencePlacements, settingsBentoCategoryIds } from './settings-bento-catalog.js';
import { canonicalSearchIdForPreferenceKey, settingsInventoryKeys } from './settings-preferences-catalog.js';
import type { App, Ref } from 'vue';
import type { SettingsBentoCategoryId } from './settings-bento-catalog.js';

const mounted: { app: App; host: HTMLElement }[] = [];

function mountCategory(categoryId: SettingsBentoCategoryId) {
	state.modelCreations = 0;
	state.account.policies.chatAvailability = 'available';
	const props = reactive({ categoryId, categoryFlow: true });
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(Surface, props) });
	for (const name of ['Mfm', 'MkCustomEmoji', 'MkEmoji']) app.component(name, { template: '<span/>' });
	app.mount(host);
	mounted.push({ app, host });
	return { host, props };
}

function control(host: HTMLElement, key: string): HTMLElement {
	const target = host.querySelector<HTMLElement>(`[data-settings-search-id="${canonicalSearchIdForPreferenceKey(key)}"]`);
	expect(target, key).not.toBeNull();
	if (target == null) throw new Error(`Missing setting control: ${key}`);
	return target;
}

afterEach(() => { for (const { app, host } of mounted.splice(0)) { app.unmount(); host.remove(); } });

describe('category preference rendering', () => {
	test('retains one model owner and edits while moving through appearance, timeline and posting', async () => {
		const { host, props } = mountCategory('appearance');
		const fontCard = control(host, 'fontSize').closest('[data-bento-section]');
		expect(fontCard).toBe(control(host, 'useBoldFont').closest('[data-bento-section]'));
		expect(fontCard).toBe(control(host, 'useSystemFont').closest('[data-bento-section]'));
		expect(fontCard?.querySelectorAll('[data-explainer-section="appearance.section1"]')).toHaveLength(1);
		expect(host.querySelectorAll('[data-special-owner="rss"]')).toHaveLength(1);
		expect(host.querySelectorAll('[data-special-owner="bottom-nav"]')).toHaveLength(1);
		expect(control(host, 'setFederationAvatarShape').querySelector('button')?.disabled).toBe(true);
		props.categoryId = 'timeline'; await nextTick();
		control(host, 'ltlEmojiVoteEnabled').querySelector('button')?.click(); await nextTick();
		expect(state.controls.ltlEmojiVoteEnabled.value).toBe(false);
		props.categoryId = 'post'; await nextTick();
		expect(control(host, 'postFormVisibilityBorder.width').querySelector('button')?.disabled).toBe(true);
		control(host, 'postFormVisibilityBorder.enabled').querySelector('button')?.click(); await nextTick();
		expect(state.controls['postFormVisibilityBorder.enabled'].value).toBe(true);
		expect(control(host, 'postFormVisibilityBorder.width').querySelector('button')?.disabled).toBe(false);
		props.categoryId = 'timeline'; await nextTick();
		expect(control(host, 'ltlEmojiVoteEnabled').querySelector('button')?.dataset.modelValue).toBe('false');
		expect(state.modelCreations).toBe(1);
	});

	test('renders each inventoried control in its assigned section exactly once across categories', async () => {
		const { host, props } = mountCategory('appearance');
		const rendered = new Set<string>();
		for (const categoryId of settingsBentoCategoryIds) {
			props.categoryId = categoryId; await nextTick();
			for (const key of settingsInventoryKeys.filter(candidate => !candidate.startsWith('hataskeyUi3Rss'))) {
				const targets = host.querySelectorAll(`[data-settings-search-id="${canonicalSearchIdForPreferenceKey(key)}"]`);
				if (bentoPreferencePlacements[key].startsWith(`${categoryId}.`)) {
					expect(targets, key).toHaveLength(1);
					expect(targets[0].closest('[data-bento-section]')?.getAttribute('data-bento-section'), key).toBe(bentoPreferencePlacements[key]);
					rendered.add(key);
				} else expect(targets, key).toHaveLength(0);
			}
			for (const card of host.querySelectorAll('[data-bento-section]')) expect(card.querySelector('[data-settings-search-id], [data-special-owner]')).not.toBeNull();
		}
		expect(rendered.size).toBe(settingsInventoryKeys.filter(key => !key.startsWith('hataskeyUi3Rss')).length);
		expect(state.modelCreations).toBe(1);
	});

	test('does not create an empty messaging card when account policy disables chat', async () => {
		const { host, props } = mountCategory('appearance');
		state.account.policies.chatAvailability = 'unavailable';
		props.categoryId = 'privacy'; await nextTick();
		expect(host.querySelector('[data-bento-section="privacy.section2"]')).toBeNull();
		expect(host.querySelector('[data-bento-category]')).toBeNull();
	});
});
