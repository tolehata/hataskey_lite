/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp, defineComponent, h, nextTick, provide, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { App } from 'vue';

vi.mock('@/utility/haptic.js', () => ({
	haptic: vi.fn(),
}));

vi.mock('@/components/MkSwitch.button.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			emits: ['toggle'],
			setup(_, { emit }) {
				return () => h('button', {
					'data-testid': 'switch-toggle',
					onClick: () => emit('toggle'),
				});
			},
		}),
	};
});

vi.mock('@/components/MkRadio.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			props: ['modelValue', 'value', 'disabled'],
			emits: ['update:modelValue'],
			setup(props, { emit, slots }) {
				return () => h('button', {
					role: 'checkbox',
					disabled: props.disabled,
					onClick: () => emit('update:modelValue', props.value),
				}, slots.default?.());
			},
		}),
	};
});

vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});

import type { SettingsCatalogDescriptorV2, SettingsCatalogV2, SettingsRelatedV2 } from '@/utility/settings-search-v2.js';
import type { SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

type Mounted = {
	app: App<Element>;
	container: HTMLDivElement;
};

const mounted: Mounted[] = [];
const integrationPaths = [
	'src/components/MkSwitch.vue',
	'src/components/MkInput.vue',
	'src/components/MkSelect.vue',
	'src/components/MkRange.vue',
	'src/components/MkRadios.vue',
	'src/components/MkTextarea.vue',
	'src/components/MkColorInput.vue',
	'src/components/MkCodeEditor.vue',
];

function descriptor(stableId: string, relatedIds: string[] = [], related: SettingsRelatedV2[] = []): SettingsCatalogDescriptorV2 {
	return {
		stableId,
		controlId: `${stableId}-control`,
		source: 'control',
		searchable: true,
		route: `/settings/${stableId}`,
		anchor: `${stableId}-anchor`,
		label: `設定 ${stableId}`,
		categoryId: 'test',
		categoryLabel: 'テスト',
		aliases: [],
		legacyLabels: [],
		preferenceKeys: [],
		persistence: 'profile',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'core',
		applicableUi: 'all',
		metadataEvidence: {
			persistence: 'test fixture: profile persistence',
			saveMode: 'test fixture: immediate save',
			availability: 'test fixture: all viewports',
			owner: 'test fixture: core owner',
			applicableUi: 'test fixture: all UI contexts',
		},
		relatedIds,
		related,
		searchRank: 0,
	};
}

function catalogFixture(candidateCount: number): SettingsCatalogV2 {
	const candidateIds = Array.from({ length: candidateCount }, (_, index) => `candidate-${index + 1}`);
	const current = descriptor('current', candidateIds, candidateIds.map((stableId, index) => ({
		stableId,
		kind: 'sameTopic',
		reason: `理由 ${index + 1}`,
		weight: 10 - index,
	})));
	const descriptors = [current, ...candidateIds.map(stableId => descriptor(stableId))];
	return {
		descriptors,
		items: descriptors,
		byStableId: new Map(descriptors.map(item => [item.stableId, item])),
		byLegacyId: new Map(),
		canonicalStableIdByLegacyStableId: new Map(),
		fallbackRoutes: [],
	};
}

function contextFor(catalog: SettingsCatalogV2 | null, navigateToSetting = vi.fn()): SettingsSearchV2Context {
	return {
		catalog: ref(catalog),
		navigateToSetting,
	};
}

function mountWithContext(component: any, context: SettingsSearchV2Context | undefined, props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}): Mounted {
	const app = createApp(defineComponent({
		setup() {
			if (context != null) provide(settingsSearchV2ContextKey, context);
			return () => h(component, props, slots);
		},
	}));
	app.directive('tooltip', {});
	const container = window.document.createElement('div');
	window.document.body.appendChild(container);
	app.mount(container);
	const result = { app, container };
	mounted.push(result);
	return result;
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('SettingsControlRelated', () => {
	test('context・ID・catalog・候補が不足する時は関連ブロックを描画しない', async () => {
		const absentContext = mountWithContext(SettingsControlRelated, undefined, { 'data-settings-search-id': 'current' });
		const absentId = mountWithContext(SettingsControlRelated, contextFor(catalogFixture(1)));
		const absentCatalog = mountWithContext(SettingsControlRelated, contextFor(null), { 'data-settings-search-id': 'current' });
		const absentCandidates = mountWithContext(SettingsControlRelated, contextFor(catalogFixture(0)), { 'data-settings-search-id': 'current' });
		await nextTick();

		for (const item of [absentContext, absentId, absentCatalog, absentCandidates]) {
			expect(item.container.textContent).toBe('');
			expect(item.container.querySelector('button')).toBeNull();
		}
	});

	test('shellがページ末尾表示を選んだ時は項目ごとの関連ブロックを描画しない', async () => {
		const context = contextFor(catalogFixture(2));
		context.inlineRelated = false;
		const item = mountWithContext(SettingsControlRelated, context, {
			'data-settings-search-id': 'current',
		});
		await nextTick();

		expect(item.container.textContent).toBe('');
		expect(item.container.querySelector('button')).toBeNull();
	});

	test('候補は初期最大3件で、指定見出しとroute・anchor・controlIdを渡す', async () => {
		const navigateToSetting = vi.fn();
		const item = mountWithContext(SettingsControlRelated, contextFor(catalogFixture(4), navigateToSetting), { 'data-settings-search-id': 'current' });
		await nextTick();

		expect(item.container.textContent).toContain('こちらをお探しですか？');
		const candidates = [...item.container.querySelectorAll<HTMLButtonElement>('button')].slice(0, 3);
		expect(candidates).toHaveLength(3);
		expect(item.container.querySelectorAll('[role]')).toHaveLength(0);
		expect(item.container.textContent).toContain('ほか1件を見る');
		(candidates[0] as HTMLButtonElement).click();
		await nextTick();
		expect(navigateToSetting).toHaveBeenCalledWith({
			stableId: 'candidate-1',
			route: '/settings/candidate-1',
			anchor: 'candidate-1-anchor',
			controlId: 'candidate-1-control',
		});
	});

	test('関連候補のcategory/popup activationを落とさずshellへ渡す', async () => {
		const navigateToSetting = vi.fn();
		const catalog = catalogFixture(1);
		catalog.byStableId.get('candidate-1')!.activation = { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' };
		const item = mountWithContext(SettingsControlRelated, contextFor(catalog, navigateToSetting), { 'data-settings-search-id': 'current' });
		await nextTick();

		const candidate = item.container.querySelector<HTMLButtonElement>('button');
		candidate?.click();
		await nextTick();
		expect(navigateToSetting).toHaveBeenCalledWith({
			stableId: 'candidate-1',
			route: '/settings/candidate-1',
			anchor: 'candidate-1-anchor',
			controlId: 'candidate-1-control',
			activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
		});
	});

	test('lookup用attrsはSettingsRelatedLinksのDOMへ重複転送しない', async () => {
		const related = mountWithContext(SettingsControlRelated, contextFor(catalogFixture(1)), {
			class: 'lookup-class',
			'data-settings-search-id': 'current',
		});
		const switchControl = mountWithContext(MkSwitch, contextFor(catalogFixture(1)), {
			modelValue: false,
			'data-settings-search-id': 'current',
		});
		await nextTick();

		expect(related.container.querySelectorAll('[data-settings-search-id]')).toHaveLength(0);
		expect(related.container.querySelector('.lookup-class')).toBeNull();
		expect(switchControl.container.querySelectorAll('[data-settings-search-id="current"]')).toHaveLength(1);
	});

	test('Switchの候補クリックはtoggleを発火せず、通常toggleは一度だけ発火する', async () => {
		const update = vi.fn();
		const item = mountWithContext(MkSwitch, contextFor(catalogFixture(1)), {
			modelValue: false,
			'data-settings-search-id': 'current',
			'onUpdate:modelValue': update,
		});
		await nextTick();

		const candidate = item.container.querySelector<HTMLButtonElement>('button:not([data-testid])');
		if (candidate == null) throw new Error('関連候補ボタンを生成できませんでした');
		candidate.click();
		await nextTick();
		expect(update).not.toHaveBeenCalled();

		const toggle = item.container.querySelector<HTMLElement>('[data-testid="switch-toggle"]');
		if (toggle == null) throw new Error('スイッチ操作面を生成できませんでした');
		toggle.click();
		await nextTick();
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith(true);
	});

	test('MkRadiosはattrsを一度だけrootへ渡し、選択更新を一度だけemitする', async () => {
		const update = vi.fn();
		const item = mountWithContext(MkRadios, contextFor(catalogFixture(1)), {
			modelValue: 'first',
			class: 'passed-class',
			'data-settings-search-id': 'current',
			'onUpdate:modelValue': update,
		}, {
			default: () => [
				h('span', { value: 'first' }, '最初'),
				h('span', { value: 'second' }, '次'),
			],
		});
		await nextTick();

		const root = item.container.firstElementChild;
		expect(root?.classList.contains('passed-class')).toBe(true);
		expect(item.container.querySelectorAll('[data-settings-search-id="current"]')).toHaveLength(1);
		expect(root?.getAttribute('onupdate:modelvalue')).toBeNull();
		const radios = item.container.querySelectorAll<HTMLElement>('[role="checkbox"]');
		expect(radios).toHaveLength(2);
		radios[1].click();
		await nextTick();
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith('second');
	});

	test('8種の統合は操作要素の外側にあり、label/button nestingを作らない', async () => {
		const sources = await Promise.all(integrationPaths.map(path => readFile(resolve(process.cwd(), path), 'utf8')));

		for (const source of sources) {
			expect(source).toContain('SettingsControlRelated');
			expect(source).toContain('isSettingsRedesign');
			expect(source).not.toContain('<label><SettingsControlRelated');
			expect(source).not.toContain('<button><SettingsControlRelated');
		}
		expect(sources[0]).toContain('flex-wrap: wrap');
		expect(sources[0]).toContain('&::before');
		expect(sources[4]).toContain('inheritAttrs: false');
		expect(sources[4]).toContain('emits: [\'update:modelValue\']');
	});
});
