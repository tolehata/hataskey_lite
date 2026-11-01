/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataskSearchResults from './HataskSearchResults.vue';
import type { HataskSearchGroup } from './HataskSearchResults.vue';
import type { App } from 'vue';

type Props = { groups: HataskSearchGroup[]; emptyLabel: string };
const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];

function sampleGroups(): HataskSearchGroup[] {
	return [
		{ id: 'events', label: '予定', items: [{ id: 'event-1', title: '旗茶くんと映画', description: '9月6日 19:00', color: '#238a72', selectable: true }] },
		{ id: 'moods', label: 'きもち', items: [{ id: 'mood-1', title: '散歩が楽しかった', description: '9月5日 17:00', icon: 'ti ti-mood-smile', selectable: false }] },
		{ id: 'todos', label: 'ToDo', items: [{ id: 'todo-1', title: '本を返す', description: '期限なし' }] },
	];
}

function mountResults(groups = sampleGroups(), emptyLabel = '見つかりませんでした', copies = 1) {
	const props = reactive<Props>({ groups, emptyLabel });
	const select = vi.fn();
	const app = createApp(defineComponent({ setup: () => () => h('div', Array.from({ length: copies }, () => h(HataskSearchResults, { ...props, onSelect: select }))) }));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, props, select };
}

function resultRow(container: HTMLElement, id: string): HTMLElement {
	const row = container.querySelector<HTMLElement>(`[data-search-id="${id}"]`);
	if (!row) throw new Error(`Missing search result: ${id}`);
	return row;
}

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

describe('HataskSearchResults', () => {
	test('結果表示専用で、検索欄や編集欄を追加しない', () => {
		const inputFields = (container: HTMLElement) => container.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="searchbox"]');
		const positive = window.document.createElement('div');
		positive.append(window.document.createElement('input'));
		expect(inputFields(positive)).toHaveLength(1);
		expect(inputFields(mountResults().container)).toHaveLength(0);
	});

	test('3分類の見出し、タイトル、説明、既存アイコンと予定色を表示する', () => {
		const groups = sampleGroups();
		const { container } = mountResults(groups);
		expect([...container.querySelectorAll('[data-search-group]')].map(group => group.getAttribute('data-search-group'))).toEqual(['events', 'moods', 'todos']);
		for (const group of groups) {
			const section = container.querySelector(`[data-search-group="${group.id}"]`);
			const heading = section?.querySelector('h3');
			expect(heading?.textContent).toBe(group.label);
			expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
			for (const item of group.items) {
				const row = resultRow(container, item.id);
				expect(row.textContent).toContain(item.title);
				expect(row.textContent).toContain(item.description);
			}
		}
		const expectedColor = window.document.createElement('span');
		expectedColor.style.backgroundColor = '#238a72';
		expect(expectedColor.style.backgroundColor).not.toBe('');
		expect(resultRow(container, 'event-1').querySelector<HTMLElement>('[aria-hidden="true"]')?.style.backgroundColor).toBe(expectedColor.style.backgroundColor);
		expect(resultRow(container, 'mood-1').querySelector('[aria-hidden="true"] .ti-mood-smile')).not.toBeNull();
		expect(resultRow(container, 'todo-1').querySelector('[aria-hidden="true"]')).not.toBeNull();
	});

	test('空の結果は親から渡された空状態文言だけを表示する', () => {
		const { container } = mountResults([], '一致する記録はありません');
		expect(container.querySelector('[role="status"]')?.textContent).toContain('一致する記録はありません');
		expect(container.querySelector('[data-search-group]')).toBeNull();
		expect(container.querySelector('button')).toBeNull();
	});

	test('空状態文言が空なら、検索前の候補なし状態へ丸アイコンだけを表示しない', () => {
		const { container } = mountResults([], '');
		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector('.ti-circle-off')).toBeNull();
		expect(container.querySelector('[data-hatask-search-results]')?.textContent).toBe('');
	});

	test('項目のない分類を省き、全分類が空でも空状態を表示する', () => {
		const emptyGroups = sampleGroups().map(group => ({ ...group, items: [] }));
		const { container } = mountResults(emptyGroups);
		expect(container.querySelector('[data-search-group]')).toBeNull();
		expect(container.querySelector('[role="status"]')).not.toBeNull();
		const mixed = mountResults([emptyGroups[0], sampleGroups()[1]]);
		expect([...mixed.container.querySelectorAll('[data-search-group]')].map(group => group.getAttribute('data-search-group'))).toEqual(['moods']);
	});

	test('選択できる予定はbuttonでeventsと実IDだけを通知し、元データを変えない', () => {
		const groups = sampleGroups();
		const before = JSON.stringify(groups);
		const { container, select } = mountResults(groups);
		const event = resultRow(container, 'event-1');
		expect(event.tagName).toBe('BUTTON');
		expect(event.getAttribute('type')).toBe('button');
		event.focus();
		expect(window.document.activeElement).toBe(event);
		event.click();
		expect(select.mock.calls).toEqual([['events', 'event-1']]);
		expect(JSON.stringify(groups)).toBe(before);
	});

	test('最近のきもちとToDoも親が選択可能と指定した場合だけ通知する', () => {
		const groups = sampleGroups().map(group => ({ ...group, items: group.items.map(item => ({ ...item, selectable: true })) }));
		const { container, select } = mountResults(groups);
		resultRow(container, 'mood-1').click();
		resultRow(container, 'todo-1').click();
		expect(select.mock.calls).toEqual([['moods', 'mood-1'], ['todos', 'todo-1']]);
	});

	test('selectableがfalseまたは未指定の行は静的表示で選択を通知しない', () => {
		const { container, select } = mountResults();
		// The same mounted listener receives selectable events, so a missing emit is detectable.
		resultRow(container, 'event-1').click();
		expect(select).toHaveBeenCalledOnce();
		select.mockClear();
		for (const id of ['mood-1', 'todo-1']) {
			const row = resultRow(container, id);
			expect(row.tagName).toBe('DIV');
			expect(row.getAttribute('role')).toBeNull();
			expect(row.hasAttribute('tabindex')).toBe(false);
			row.click();
		}
		expect(select).not.toHaveBeenCalled();
	});

	test('親が結果や選択可否を更新すると反映し、内部に検索状態を保持しない', async () => {
		const { container, props, select } = mountResults();
		props.groups[0].items[0].selectable = false;
		props.groups[0].items[0].title = '更新後の予定';
		await nextTick();
		const row = resultRow(container, 'event-1');
		expect(row.tagName).toBe('DIV');
		expect(row.textContent).toContain('更新後の予定');
		row.click();
		expect(select).not.toHaveBeenCalled();
		props.groups = [];
		props.emptyLabel = '検索結果なし';
		await nextTick();
		expect(container.querySelector('[role="status"]')?.textContent).toContain('検索結果なし');
		expect(container.querySelector('[data-search-id]')).toBeNull();
	});

	test('見出しとユーザー本文をHTMLとして解釈せず、長文を欠落させない', () => {
		const label = '<img src=x onerror="alert(1)">';
		const title = '<script>alert(2)</script>';
		const description = `https://example.invalid/${'long-token-'.repeat(80)}\n<iframe src="/private"></iframe>`;
		const { container } = mountResults([{ id: 'events', label, items: [{ id: 'escaped', title, description, selectable: true }] }]);
		expect(container.querySelector('h3')?.textContent).toBe(label);
		expect(resultRow(container, 'escaped').textContent).toBe(title + description);
		expect(container.querySelector('img, script, iframe')).toBeNull();
	});

	test('同時に二箇所へ表示しても各分類の見出しIDが衝突しない', () => {
		// Both instances in one app match the legacy/inline shared-component contract.
		const { container } = mountResults(sampleGroups(), '', 2);
		const ids = [...container.querySelectorAll('h3')].map(heading => heading.id);
		expect(ids).toHaveLength(6);
		expect(new Set(ids).size).toBe(6);
	});

	test('実SCSSをCSS Modulesとしてコンパイルし、局所的な行・文字・旧テーマ装飾を保持する', async () => {
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskSearchResults.vue');
		const source = readFileSync(filename, 'utf8');
		const { descriptor } = parse(source, { filename });
		const style = descriptor.styles.find(item => item.module && item.lang === 'scss');
		if (!style) throw new Error('Missing search results module stylesheet');
		const compiled = await compileStyleAsync({ source: style.content, filename, id: 'hatask-search-results', modules: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const stylesheet = compiled.rawResult?.root;
		const classes = compiled.modules;
		if (!stylesheet || !classes) throw new Error('Missing compiled CSS Modules output');
		const rules = new Map<string, Record<string, string>>();
		stylesheet.walkRules(rule => {
			const declarations: Record<string, string> = {};
			rule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value; });
			for (const selector of rule.selectors) rules.set(selector, { ...rules.get(selector), ...declarations });
		});
		const itemSelector = `.${classes.root} .${classes.item}`;
		// Root-qualified selectors outrank a surrounding layout's generic button reset.
		const hasLocalItem = (collection: typeof rules) => collection.has(itemSelector);
		const broken = new Map(rules);
		broken.delete(itemSelector);
		expect(hasLocalItem(broken)).toBe(false);
		expect(hasLocalItem(rules)).toBe(true);
		expect(rules.get(itemSelector)).toMatchObject({ 'min-width': '0', 'min-height': '44px', 'width': '100%', 'padding': '10px 12px', 'background': 'transparent', 'color': 'var(--fg)', 'font': 'inherit', 'text-align': 'start' });
		for (const textClass of ['title', 'description']) {
			expect(rules.get(`.${classes.root} .${classes[textClass]}`)).toMatchObject({ 'min-width': '0', 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' });
		}
		expect(rules.get(`.${classes.root} .${classes.description}`)?.color).toBe('var(--fg-2)');
		const selectors = [...rules.keys()].map(selector => selector.replace(/\[([\w-]+)=(["']?)([\w-]+)\2\]/gu, '[$1=$3]'));
		for (const theme of ['kisetsu', 'kashin', 'suri']) {
			expect(selectors).toContain(`.htk-modal-ov[data-theme=${theme}] .${classes.root} .${classes.groupTitle}`);
			expect(selectors).toContain(`.htk-modal-ov[data-theme=${theme}] .${classes.root} .${classes.item}`);
		}
		expect(selectors).toContain(`.${classes.root} .${classes.item}[data-selectable=true]:focus-visible`);
	});
});
