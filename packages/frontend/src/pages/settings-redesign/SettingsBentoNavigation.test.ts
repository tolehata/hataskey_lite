/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, h, nextTick, reactive } from 'vue';
import { parse as parseCss } from 'postcss';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsBentoNavigation from './SettingsBentoNavigation.vue';
import type { App } from 'vue';
import type { AtRule, Node as PostCssNode } from 'postcss';

vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: { _hata: { _settingsBento: { allCategories: 'すべてのカテゴリ' } } },
		tsx: { _hata: { _settingsBento: {
			moreItems: ({ count }: { count: number }) => `ほか ${count} 項目`,
			itemCount: ({ count }: { count: number }) => `${count} 項目`,
		} } },
	},
}));

const groups = [
	{ id: 'you', label: 'あなた', ids: ['profile', 'privacy', 'security'] },
	{ id: 'usage', label: '使い方', ids: ['appearance', 'timeline', 'post', 'notify', 'access'] },
	{ id: 'management', label: '管理', ids: ['mute', 'drive', 'apps', 'data', 'advanced'] },
];
const categories = groups.flatMap(group => group.ids.map(id => ({ id, label: `${id} label`, description: `${id} description`, icon: 'ti ti-settings', groupId: group.id, groupLabel: group.label, preview: [`${id} first`, `${id} second`, `${id} third`] })));
const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

function mountNavigation(smartphone: boolean, initialCategory: string | null = null) {
	const state = reactive({ activeCategoryId: initialCategory, smartphone, motionEnabled: false });
	const select = vi.fn();
	const overview = vi.fn();
	const app = createApp({ render: () => h(SettingsBentoNavigation, { categories, ...state, onSelect: select, onOverview: overview }) });
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, state, select, overview };
}

function visibleCategoryIds(container: HTMLElement): string[] {
	return [...container.querySelectorAll<HTMLElement>('[data-settings-category-id]')].map(button => button.dataset.settingsCategoryId ?? '');
}

const source = readFileSync(resolve(process.cwd(), 'src/pages/settings-redesign/SettingsBentoNavigation.vue'), 'utf8');
const stylesheet = parseCss(source.match(/<style[^>]*>([\s\S]*?)<\/style>/u)?.[1] ?? '');

// jsdom does not lay out container queries. Read the actual CSS spans and DOM
// flags, then check sparse grid occupancy without claiming pixel verification.
function gridPlacement(container: HTMLElement, width: number) {
	const root = container.querySelector<HTMLElement>('nav');
	if (root == null) throw new Error('Missing settings navigation');
	const grid = root.firstElementChild as HTMLElement;
	const buttons = [...grid.querySelectorAll<HTMLButtonElement>('button')];
	const aliases: Record<string, string> = {
		root: root.classList[0],
		categoryGrid: grid.classList[0],
		categoryTile: buttons[0].classList[0],
	};
	const stylesFor = (element: HTMLElement) => {
		const result: Partial<Record<string, string>> = {};
		stylesheet.walkRules(rule => {
			if (!rule.nodes.some(node => node.type === 'decl' && node.prop.startsWith('grid-'))) return;
			let parent: PostCssNode['parent'] = rule.parent;
			while (parent != null) {
				if (parent.type === 'atrule') {
					const at = parent as AtRule;
					if (at.name === 'media') return;
					const maximum = at.name === 'container' ? at.params.match(/max-width:\s*(\d+)px/u)?.[1] : undefined;
					if (maximum != null && width > Number(maximum)) return;
				}
				parent = parent.parent;
			}
			const selector = rule.selector.replace(/\.(root|categoryGrid|categoryTile)\b/gu, (_, name: string) => `.${aliases[name]}`);
			if (!element.matches(selector)) return;
			rule.walkDecls(declaration => {
				if (declaration.prop.startsWith('grid-')) result[declaration.prop] = declaration.value;
			});
		});
		return result;
	};
	const gridStyle = stylesFor(grid);
	expect(gridStyle['grid-auto-flow'] ?? 'row').toBe('row');
	const template = gridStyle['grid-template-columns'];
	if (template == null) throw new Error('Missing grid column definition');
	const columns = Number(template.match(/repeat\((\d+),/u)?.[1] ?? 1);
	const occupied: Array<Array<string | null>> = [];
	const placements: Array<{ id: string; column: number; row: number; columns: number; rows: number }> = [];
	let column = 0;
	let row = 0;
	for (const button of buttons) {
		const style = stylesFor(button);
		const spanColumns = Number(style['grid-column']?.match(/span (\d+)/u)?.[1] ?? 1);
		const spanRows = Number(style['grid-row']?.match(/span (\d+)/u)?.[1] ?? 1);
		expect(spanColumns).toBeLessThanOrEqual(columns);
		let fits = false;
		while (!fits) {
			if (column + spanColumns > columns) { row++; column = 0; }
			fits = Array.from({ length: spanRows }, (_row, y) => Array.from({ length: spanColumns }, (_column, x) => !occupied[row + y]?.[column + x]).every(Boolean)).every(Boolean);
			if (!fits) column++;
		}
		const id = button.dataset.settingsCategoryId ?? 'overview';
		placements.push({ id, column, row, columns: spanColumns, rows: spanRows });
		for (let y = 0; y < spanRows; y++) {
			occupied[row + y] ??= Array.from({ length: columns }, () => null);
			for (let x = 0; x < spanColumns; x++) occupied[row + y][column + x] = id;
		}
		column += spanColumns;
	}
	return { columns, rows: occupied.length, holes: occupied.flat().filter(cell => cell == null).length, placements };
}

describe('settings bento navigation', () => {
	test.each([false, true])('トップは13カテゴリを重複なく元の順序で表示する smartphone=%s', smartphone => {
		const { container, select } = mountNavigation(smartphone);
		expect(visibleCategoryIds(container)).toEqual(categories.map(category => category.id));
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
		expect(buttons).toHaveLength(13);
		for (const [index, button] of buttons.entries()) {
			expect(button.type).toBe('button');
			expect(button.querySelector('strong')?.textContent).toBe(categories[index].label);
			expect(button.querySelector('small')?.textContent ?? null).toBe(smartphone ? null : categories[index].description);
			expect(button.querySelector('.ti-chevron-right')?.getAttribute('aria-hidden')).toBe('true');
			for (const preview of categories[index].preview) expect(button.textContent).not.toContain(preview);
			button.click();
		}
		expect(select.mock.calls.map(([id]) => id)).toEqual(categories.map(category => category.id));
		const panels = [...container.querySelectorAll<HTMLElement>('[data-settings-group-id]')];
		expect(panels.map(panel => panel.dataset.settingsGroupId)).toEqual(groups.map(group => group.id));
		for (const [index, panel] of panels.entries()) {
			const heading = panel.querySelector('h2');
			expect(heading?.textContent).toBe(groups[index].label);
			expect(panel.getAttribute('aria-labelledby')).toBe(heading?.id);
			expect(visibleCategoryIds(panel)).toEqual(groups[index].ids);
		}
	});

	test('スマホは選択カテゴリを先頭にして同じグループの兄弟だけを表示する', async () => {
		const { container, state, select, overview } = mountNavigation(true, 'profile');
		for (const group of groups) {
			for (const id of group.ids) {
				state.activeCategoryId = id;
				await nextTick();
				expect(visibleCategoryIds(container)).toEqual([id, ...group.ids.filter(sibling => sibling !== id)]);
				const current = container.querySelector<HTMLButtonElement>('[aria-current="page"]');
				expect(current?.dataset.settingsCategoryId).toBe(id);
				select.mockClear();
				current?.click();
				expect(select).not.toHaveBeenCalled();
				const all = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'すべてのカテゴリ');
				if (group.id === 'you') {
					expect(all).toBeDefined();
					all?.click();
				} else {
					expect(all).toBeUndefined();
				}
			}
		}
		expect(overview).toHaveBeenCalledTimes(3);
	});

	test('PCは選択後も全カテゴリへ直接移動でき、選択状態を一つだけ示す', async () => {
		const { container, state, select } = mountNavigation(false, 'post');
		expect(visibleCategoryIds(container)).toEqual(categories.map(category => category.id));
		expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
		container.querySelector<HTMLButtonElement>('[data-settings-category-id="security"]')?.click();
		expect(select).toHaveBeenCalledWith('security');
		state.activeCategoryId = 'security';
		await nextTick();
		expect(container.querySelector('[aria-current="page"]')?.getAttribute('data-settings-category-id')).toBe('security');
		expect(visibleCategoryIds(container)).toEqual(categories.map(category => category.id));
	});

	test('スマホの判定変更だけでカテゴリ選択を維持し、ナビの対象範囲を切り替える', async () => {
		const { container, state } = mountNavigation(true, 'drive');
		expect(visibleCategoryIds(container)).toEqual(['drive', 'mute', 'apps', 'data', 'advanced']);
		state.smartphone = false;
		await nextTick();
		expect(visibleCategoryIds(container)).toEqual(categories.map(category => category.id));
		expect(container.querySelector('[aria-current="page"]')?.getAttribute('data-settings-category-id')).toBe('drive');
	});

	test('モックのダミー件数を追加せず、モーション無効ではタイルの遷移名を外す', () => {
		const { container } = mountNavigation(false);
		expect(container.textContent).not.toContain('項目');
		for (const button of container.querySelectorAll<HTMLElement>('[data-settings-category-id]')) expect(button.style.viewTransitionName).toBe('none');
	});

	test('ホームの端末判定が変わってもカテゴリのDOM・順序・フォーカスを保持し説明だけを切り替える', async () => {
		const { container, state, select } = mountNavigation(false);
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
		buttons[4].focus();
		for (const smartphone of [true, false]) {
			state.smartphone = smartphone;
			await nextTick();
			expect(visibleCategoryIds(container)).toEqual(categories.map(category => category.id));
			expect([...container.querySelectorAll('button')]).toEqual(buttons);
			expect(window.document.activeElement).toBe(buttons[4]);
			for (const [index, button] of buttons.entries()) expect(button.querySelector('small')?.textContent ?? null).toBe(smartphone ? null : categories[index].description);
		}
		expect(select).not.toHaveBeenCalled();
	});

	test.each([false, true])('全選択位置でnavに空きセルを残さない smartphone=%s', async smartphone => {
		const { container, state } = mountNavigation(smartphone, 'profile');
		for (const category of categories) {
			state.activeCategoryId = category.id;
			await nextTick();
			const placement = gridPlacement(container, smartphone ? 390 : 280);
			expect(placement.holes, category.id).toBe(0);
			expect(placement.placements.find(tile => tile.id === category.id)).toMatchObject({ columns: 2, rows: 2 });
			expect(visibleCategoryIds(container)).toEqual(smartphone
				? [category.id, ...categories.filter(sibling => sibling.groupId === category.groupId && sibling.id !== category.id).map(sibling => sibling.id)]
				: categories.map(item => item.id));
		}
	});

	test('配置検査は偶数番目の選択カードの前後にできる旧配置の穴を検出する', () => {
		const { container } = mountNavigation(false, 'privacy');
		for (const tile of container.querySelectorAll<HTMLElement>('[data-fill-row="true"]')) tile.dataset.fillRow = 'false';
		expect(gridPlacement(container, 280).holes).toBe(2);
	});
});
