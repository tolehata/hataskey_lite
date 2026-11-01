/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parse as parseSfc } from '@vue/compiler-sfc';
import postcss from 'postcss';

const fixtures = await vi.hoisted(async () => {
	const vue = await import('vue');
	return { owner: vue.defineComponent({ render: () => vue.h('div', { 'data-inline-owner': '' }) }) };
});
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	return { i18n: new I18n(yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Locale) };
});
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/page.js', () => ({ provideMetadataReceiver: vi.fn() }));
vi.mock('./SettingsPreferencesSurface.vue', () => ({ default: fixtures.owner }));
vi.mock('./SettingsSectionExplainer.vue', () => ({ default: fixtures.owner }));
vi.mock('@/components/MkButton.vue', () => ({ default: fixtures.owner }));
vi.mock('@/pages/settings/profile.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/privacy.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/email.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/security.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/theme.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/emoji-palette.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/notifications.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/sounds.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/mute-block.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/drive.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/profiles.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/account-data.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/hata-custom.vue', () => ({ __esModule: true, default: fixtures.owner }));
vi.mock('@/pages/settings/cherrypick.vue', () => ({ __esModule: true, default: fixtures.owner }));

import Surface from './SettingsCategorySurface.vue';
import source from './SettingsCategorySurface.vue?raw';
import { bentoDestinationLinkSections, bentoPreferencePlacements, bentoSectionIcon, bentoSectionIds, settingsBentoCategoryIds } from './settings-bento-catalog.js';
import { settingsInventoryKeys } from './settings-preferences-catalog.js';
import { destinationForId } from './settings-destinations.js';
import type { App } from 'vue';
import type { Locale } from '../../../../../locales/index.js';
import type { SettingsBentoCategoryId, SettingsBentoSectionId } from './settings-bento-catalog.js';

const mounted: Array<{ app: App; host: HTMLElement }> = [];

async function settle() {
	for (let index = 0; index < 8; index++) await nextTick();
}

async function mountCategory(categoryId: SettingsBentoCategoryId) {
	const props = reactive({ categoryId });
	const selected: Array<{ id: string; opener: EventTarget | null }> = [];
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(Surface, {
		...props,
		cacheAction: { id: 'clear-cache', searchId: 'settings.action.clear-cache', label: 'キャッシュを削除', icon: 'ti ti-trash' },
		onOpenDestination: (id, event) => selected.push({ id, opener: event.currentTarget }),
	}) });
	app.component('MkLoading', fixtures.owner);
	app.mount(host);
	mounted.push({ app, host });
	await settle();
	return { host, props, selected };
}

function destinationButton(host: HTMLElement, id: string) {
	const button = host.querySelector<HTMLButtonElement>(`button[data-settings-destination-id="${id}"]`);
	if (button == null) throw new Error(`Missing destination: ${id}`);
	return button;
}

function expandingSelectors(css: string, classNames: Record<string, string>) {
	const selectors: string[] = [];
	postcss.parse(css).walkDecls('flex', declaration => {
		if (declaration.value !== '1' || declaration.parent?.type !== 'rule') return;
		selectors.push(...declaration.parent.selectors.map(selector => selector.replace(/\.([\w-]+)/gu, (_match, name: string) => `.${classNames[name] ?? name}`)));
	});
	return selectors;
}

type ParsedTemplate = NonNullable<NonNullable<ReturnType<typeof parseSfc>['descriptor']['template']>['ast']>;
type TemplateChild = ParsedTemplate['children'][number];
type TemplateElement = Extract<TemplateChild, { type: 1 }>;
type SectionIcon = { id: string; icon: string };

function attribute(node: TemplateElement, name: string): string | undefined {
	const prop = node.props.find(candidate => candidate.type === 6 && candidate.name === name);

	return prop?.type === 6 ? prop.value?.content : undefined;
}

/** Read child headings from their real templates without starting account/API owners. */
function sourceSectionIcons(path: string, categoryId: SettingsBentoCategoryId): SectionIcon[] {
	const parsed = parseSfc(readFileSync(resolve(process.cwd(), path), 'utf8'));

	function walk(children: TemplateChild[]): SectionIcon[] {
		return children.flatMap(node => {
			if (node.type !== 1) return [];
			for (const prop of node.props) {
				if (prop.type !== 7 || prop.name !== 'show' || prop.exp?.type !== 4) continue;
				const categories = /^showsCategory\((.+)\)$/u.exec(prop.exp.content);
				if (categories != null && ![...categories[1].matchAll(/'([^']+)'/gu)].some(match => match[1] === categoryId)) return [];
				if (prop.exp.content === 'presentationCategory == null') return [];
			}
			const result: SectionIcon[] = [];
			const id = attribute(node, 'data-settings-section-anchor');
			if (id != null) {
				let icon = attribute(node, 'data-settings-section-icon');
				if (icon == null) {
					const binding = node.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.type === 4 && prop.arg.content === 'data-settings-section-icon');
					const expression = binding?.type === 7 && binding.exp?.type === 4 ? binding.exp.content : '';
					const sectionId = /^bentoSectionIcon\('([^']+)'\)$/u.exec(expression)?.[1];
					if (sectionId == null || !bentoSectionIds.includes(sectionId as SettingsBentoSectionId)) throw new Error(`Unsupported section icon: ${path}: ${id}: ${expression}`);
					icon = bentoSectionIcon(sectionId as SettingsBentoSectionId);
				}
				result.push({ id, icon });
			}
			return [...result, ...walk(node.children)];
		});
	}

	return walk(parsed.descriptor.template?.ast?.children ?? []);
}

function duplicateIcons(entries: readonly SectionIcon[]): string[] {
	return [...new Set(entries.filter((entry, index) => entries.findIndex(candidate => candidate.icon === entry.icon) !== index).map(entry => entry.icon))];
}

function categorySectionIcons(host: HTMLElement, categoryId: SettingsBentoCategoryId): SectionIcon[] {
	const entries = [...host.querySelectorAll<HTMLElement>('[data-settings-section-anchor]')].map(element => ({
		id: element.dataset.settingsSectionAnchor ?? '', icon: element.dataset.settingsSectionIcon ?? '',
	}));
	// Include all preference sections that can appear, even when a particular UI or
	// account hides a control. A unique superset also covers those smaller menus.
	for (const sectionId of new Set(settingsInventoryKeys.map(key => bentoPreferencePlacements[key]))) {
		if (sectionId.startsWith(`${categoryId}.`)) entries.push({ id: `preference:${sectionId}`, icon: bentoSectionIcon(sectionId) });
	}
	if (categoryId === 'appearance') entries.push(...sourceSectionIcons('src/pages/settings-redesign/SettingsPreferencesSurface.vue', categoryId));
	const sourceOwners: Record<string, string> = { palette: 'emoji-palette', mute: 'mute-block', profiles: 'profiles', export: 'account-data' };
	for (const owner of host.querySelectorAll<HTMLElement>('[data-settings-owner]')) {
		const id = owner.dataset.settingsOwner;
		if (id == null) throw new Error('Missing owner id');
		entries.push(...sourceSectionIcons(`src/pages/settings/${sourceOwners[id] ?? id}.vue`, categoryId));
	}
	return entries;
}

function tablerIcons(): Set<string> {
	const root = resolve(process.cwd(), '../../node_modules/.pnpm');
	const pkg = readdirSync(root).find(name => name.startsWith('@tabler+icons-webfont@'));
	if (pkg == null) throw new Error('Missing installed Tabler webfont');
	const css = readFileSync(resolve(root, pkg, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.css'), 'utf8');
	return new Set([...css.matchAll(/\.(ti-[a-z0-9-]+):{1,2}before/gu)].map(match => `ti ${match[1]}`));
}

afterEach(() => {
	for (const { app, host } of mounted.splice(0)) {
		app.unmount();
		host.remove();
	}
});

describe('category settings entry points', () => {
	test('アイコン検出器は同じアイコンを別の節へ追加すると重複を検出する', () => {
		expect(duplicateIcons([{ id: 'first', icon: 'ti ti-user' }, { id: 'second', icon: 'ti ti-user' }])).toEqual(['ti ti-user']);
		expect(tablerIcons().has('ti ti-user')).toBe(true);
		expect(tablerIcons().has('ti ti-no-such-settings-icon')).toBe(false);
	});

	test.each(settingsBentoCategoryIds)('%sカテゴリの同時表示候補は重複せず実在するアイコンで区別できる', async categoryId => {
		const { host } = await mountCategory(categoryId);
		const entries = categorySectionIcons(host, categoryId);
		const icons = tablerIcons();
		expect(entries.length).toBeGreaterThan(0);
		expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
		expect(duplicateIcons(entries), JSON.stringify(entries)).toEqual([]);
		for (const entry of entries) expect(icons.has(entry.icon), `${entry.id}: ${entry.icon}`).toBe(true);
	});

	test('Hataskey UIとSの入口は見た目カテゴリの最初に一度だけ表示し既存destinationへ渡す', async () => {
		const { host, selected } = await mountCategory('appearance');
		const surface = host.querySelector('[data-settings-bento-category]');
		const leading = surface?.firstElementChild;
		expect(leading?.hasAttribute('data-settings-leading-destinations')).toBe(true);
		expect(leading?.querySelector('h3')?.textContent).toContain('Hataskey UI');
		for (const id of ['hataskey-ui', 'hataskey-ui-s']) {
			expect(host.querySelectorAll(`button[data-settings-destination-id="${id}"]`)).toHaveLength(1);
			const button = destinationButton(host, id);
			expect(leading?.contains(button)).toBe(true);
			expect(button.textContent).toContain(destinationForId(id)?.label);
			button.click();
			expect(selected.at(-1)).toEqual({ id, opener: button });
		}
		expect(destinationForId('hataskey-ui')).toMatchObject({ route: '/settings/hata-custom', activation: { kind: 'hata-custom-category', category: 'glassUi' } });
		expect(destinationForId('hataskey-ui-s')).toMatchObject({ route: '/settings/preferences', stableId: 'settings.destination.hataskey-ui-s' });
	});

	test('全カテゴリを巡回しても既存の詳細設定入口を欠落・重複させない', async () => {
		const { host, props } = await mountCategory('appearance');
		const rendered: string[] = [];
		for (const categoryId of settingsBentoCategoryIds) {
			props.categoryId = categoryId;
			await settle();
			for (const button of host.querySelectorAll<HTMLButtonElement>('button[data-settings-destination-id]')) rendered.push(button.dataset.settingsDestinationId ?? '');
		}
		expect(rendered.toSorted()).toEqual(bentoDestinationLinkSections.flatMap(section => section.destinationIds).toSorted());
		expect(new Set(rendered).size).toBe(rendered.length);
	});

	test('アプリ入口は文字だけを伸ばし、実Hatask・Hatady・HataFeedアイコンのspanへflexを適用しない', async () => {
		const { host } = await mountCategory('apps');
		const css = parseSfc(source).descriptor.styles.find(style => style.module)?.content;
		if (css == null) throw new Error('Missing category styles');
		for (const id of ['hata-hatask', 'hata-hatady', 'hata-hatafeed']) {
			const button = destinationButton(host, id);
			const logo = button.querySelector<HTMLElement>('[data-hata-app-logo]');
			const label = button.querySelector<HTMLElement>('span[data-brand]');
			if (logo == null || label == null) throw new Error(`Missing application brand: ${id}`);
			expect(logo.style.width).toBe('24px');
			expect(logo.style.height).toBe('24px');
			const classNames = { link: button.classList[0], linkLabel: label.classList[0] };
			const selectors = expandingSelectors(css, classNames);
			expect(selectors.some(selector => label.matches(selector))).toBe(true);
			expect(selectors.some(selector => logo.matches(selector))).toBe(false);
			// Positive control: the former generic span selector also expands the real logo root.
			expect(expandingSelectors('.link > span { flex: 1; }', classNames).some(selector => logo.matches(selector))).toBe(true);
		}
	});
});
