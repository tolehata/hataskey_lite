/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskRecipe from './HataskRecipe.vue';
import type { App } from 'vue';

const mocks = vi.hoisted(() => ({
	api: vi.fn(),
	toast: vi.fn(),
	alert: vi.fn(),
	confirm: vi.fn(),
	select: vi.fn(),
	selectUser: vi.fn(),
	fileSelect: vi.fn(),
}));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({
	toast: mocks.toast, alert: mocks.alert, confirm: mocks.confirm, select: mocks.select, selectUser: mocks.selectUser,
	popup: vi.fn(), popupMenu: vi.fn(), inputText: vi.fn(),
}));
vi.mock('@/utility/drive.js', () => ({ selectFile: mocks.fileSelect }));
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: { props: ['user'], setup: (props: { user: { id: string } }) => () => h('span', { 'data-avatar': props.user.id }) } }));
vi.mock('@/components/global/MkUserName.vue', () => ({ default: { props: ['user'], setup: (props: { user: { name: string } }) => () => h('span', props.user.name) } }));

const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];

function recipe(overrides: Record<string, unknown> = {}) {
	return {
		id: 'r1', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z', userId: 'me',
		user: { id: 'me', username: 'me', name: '自分' }, isMine: true,
		title: '鶏むねのねぎ塩だれ', summary: '片栗粉をまとわせて焼く。', category: 'main', servings: 2, minutes: 25, scalable: true,
		ingredients: [{ name: '鶏むね肉', amount: '300g' }, { name: '塩', amount: '小さじ1/2' }, { name: 'こしょう', amount: '少々' }],
		steps: [{ text: '下味をつける。', timerSeconds: 600, timerLabel: '置く' }, { text: '焼く。', timerSeconds: null, timerLabel: '' }],
		referenceLinks: [],
		tags: ['作りおき'], photo: null, visibility: 'followers', visibleUserIds: [], isDraft: false, cookedCount: 6, lastCookedAt: null,
		...overrides,
	};
}

function listResult(items: ReturnType<typeof recipe>[]) {
	return { items, total: items.length, counts: { all: items.length, main: items.length, side: 0, soup: 0, staple: 0, dessert: 0 }, tags: ['作りおき'] };
}

async function settle(): Promise<void> {
	for (let i = 0; i < 6; i++) {
		await Promise.resolve();
		await nextTick();
	}
}

async function mount(props: Record<string, unknown> = {}) {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp(HataskRecipe, { theme: 'koke', mode: 'light', consented: true, settingsReady: true, ...props });
	app.mount(container);
	mounted.push({ app, container });
	await settle();
	return container;
}

async function mountFlow(onHatadyCookingSaved = vi.fn()) {
	let instance: { openRecordFromHatady: () => void; openRecord: () => void } | null = null;
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp({ render: () => h(HataskRecipe, {
		theme: 'koke', mode: 'light', consented: true, settingsReady: true, onHatadyCookingSaved,
		ref: (value: any) => { instance = value; },
	}) });
	app.mount(container);
	mounted.push({ app, container });
	await settle();
	return { container, instance: instance!, onHatadyCookingSaved };
}

async function chooseRecipeForRecord(container: HTMLElement) {
	mocks.select.mockResolvedValue({ canceled: false, result: 'r1' });
	button(container, '選ぶ').click();
	await settle();
}

function button(container: HTMLElement, text: string): HTMLButtonElement {
	const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim().includes(text));
	if (!found) throw new Error(`Missing button: ${text}`);
	return found;
}

function labeledButton(container: HTMLElement, label: string): HTMLButtonElement {
	const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label);
	if (!found) throw new Error(`Missing labeled button: ${label}`);
	return found;
}

function input(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-22T10:00:00'));
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.confirm.mockResolvedValue({ canceled: false });
	mocks.api.mockImplementation(async (endpoint: string) => {
		if (endpoint === 'hatask/recipes/list') return listResult([recipe()]);
		if (endpoint === 'hatask/recipes/show') return recipe();
		if (endpoint === 'hatask/recipes/cooked/create') return { id: 'c1' };
		return {};
	});
});
afterEach(() => {
	for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
	window.localStorage.clear();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('HataskRecipe', () => {
	test('参考サイトを複数保存し、詳細と再編集に反映して削除できる', async () => {
		let saved = recipe();
		mocks.api.mockImplementation(async (endpoint: string, params: Record<string, unknown>) => {
			if (endpoint === 'hatask/recipes/list') return listResult([saved]);
			if (endpoint === 'hatask/recipes/show') return saved;
			if (endpoint === 'hatask/recipes/create' || endpoint === 'hatask/recipes/update') {
				saved = recipe(params);
				return saved;
			}
			return {};
		});
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		input(container.querySelector<HTMLInputElement>('input[maxlength="128"]')!, '参考つきレシピ');
		for (const [title, url] of [['  料理の基本  ', ' HTTPS://EXAMPLE.COM/base '], ['', 'http://example.org/recipe']]) {
			button(container, '参考サイトを追加').click();
			await settle();
			input([...container.querySelectorAll<HTMLInputElement>('input[maxlength="120"]')].at(-1)!, title);
			input([...container.querySelectorAll<HTMLInputElement>('input[type="url"]')].at(-1)!, url);
		}
		// Completely empty (including whitespace-only) rows are not sent.
		button(container, '参考サイトを追加').click();
		await settle();
		input([...container.querySelectorAll<HTMLInputElement>('input[type="url"]')].at(-1)!, '  ');
		button(container, '保存する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/create', expect.objectContaining({ referenceLinks: [
			{ title: '料理の基本', url: 'https://example.com/base' },
			{ title: '', url: 'http://example.org/recipe' },
		] }));
		const links = [...container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')];
		expect(links).toHaveLength(2);
		expect(links[0].textContent).toContain('料理の基本');
		expect(links[0].textContent).toContain('https://example.com/base');
		expect(links[1].textContent).toBe('http://example.org/recipe');
		for (const link of links) {
			expect(link.getAttribute('target')).toBe('_blank');
			expect(link.getAttribute('rel')).toBe('noopener noreferrer');
		}
		button(container, '編集').click();
		await settle();
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="url"]')].map(el => el.value)).toEqual(['https://example.com/base', 'http://example.org/recipe']);
		labeledButton(container, '参考サイト1を削除').click();
		await settle();
		input(container.querySelector<HTMLInputElement>('input[maxlength="120"]')!, '変更したサイト');
		input(container.querySelector<HTMLInputElement>('input[type="url"]')!, 'https://example.net/new');
		button(container, '保存する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/update', expect.objectContaining({ recipeId: 'r1', referenceLinks: [{ title: '変更したサイト', url: 'https://example.net/new' }] }));
		expect(container.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe('https://example.net/new');
		button(container, '編集').click();
		await settle();
		labeledButton(container, '参考サイト1を削除').click();
		await settle();
		button(container, '保存する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/update', expect.objectContaining({ referenceLinks: [] }));
		expect(container.querySelector('#hatask-recipe-references')).toBeNull();
	});

	test.each([
		['名前のみ', ''],
		['', '/relative'],
		['', 'https:example.com'],
		['', 'javascript:alert(1)'],
		['', 'https://user:pass@example.com'],
		['', 'https://example.com/' + 'a'.repeat(2048)],
		['', 'https://example.com/' + 'あ'.repeat(230)],
		['名'.repeat(121), 'https://example.com'],
	])('不正な参考サイト2は通常保存と下書き保存を抑止する (%s, %s)', async (title, url) => {
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		input(container.querySelector<HTMLInputElement>('input[maxlength="128"]')!, '入力確認');
		button(container, '参考サイトを追加').click();
		await settle();
		button(container, '参考サイトを追加').click();
		await settle();
		input(container.querySelectorAll<HTMLInputElement>('input[maxlength="120"]')[1], title);
		input(container.querySelectorAll<HTMLInputElement>('input[type="url"]')[1], url);
		await settle();
		for (const action of ['保存する', '下書き保存']) {
			button(container, action).click();
			await settle();
			expect(mocks.alert).toHaveBeenLastCalledWith({ type: 'error', text: expect.stringContaining('参考サイト2の' + (title.length > 120 ? 'サイト名' : 'URL')) });
		}
		expect(mocks.api.mock.calls.some(([endpoint]) => endpoint === 'hatask/recipes/create' || endpoint === 'hatask/recipes/update')).toBe(false);
	});

	test('referenceLinksのない旧下書きを保存すると空配列を送る', async () => {
		window.localStorage.setItem('hatask:recipe-editor-draft', JSON.stringify({ title: '旧下書き' }));
		mocks.api.mockImplementation(async (endpoint: string, params: Record<string, unknown>) => endpoint === 'hatask/recipes/create' ? recipe(params) : listResult([]));
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		expect(container.querySelectorAll('input[type="url"]')).toHaveLength(0);
		button(container, '保存する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/create', expect.objectContaining({ title: '旧下書き', referenceLinks: [] }));
		expect(container.querySelector('#hatask-recipe-references')).toBeNull();
	});

	test('古い下書きは参考サイトなしで開き、新しい参考サイトも自動保存して再開できる', async () => {
		window.localStorage.setItem('hatask:recipe-editor-draft', JSON.stringify({ title: '以前の下書き' }));
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		expect(container.querySelector<HTMLInputElement>('input[maxlength="128"]')?.value).toBe('以前の下書き');
		expect(container.querySelectorAll('input[type="url"]')).toHaveLength(0);
		button(container, '参考サイトを追加').click();
		await settle();
		input(container.querySelector<HTMLInputElement>('input[maxlength="120"]')!, '下書きのサイト');
		input(container.querySelector<HTMLInputElement>('input[type="url"]')!, 'https://example.com/draft');
		await settle();
		vi.advanceTimersByTime(1000);
		expect(JSON.parse(window.localStorage.getItem('hatask:recipe-editor-draft')!).referenceLinks).toEqual([expect.objectContaining({ title: '下書きのサイト', url: 'https://example.com/draft' })]);
		button(container, '一覧にもどる').click();
		await settle();
		button(container, 'レシピを書く').click();
		await settle();
		expect(container.querySelector<HTMLInputElement>('input[type="url"]')?.value).toBe('https://example.com/draft');
		for (let i = 1; i < 10; i++) {
			button(container, '参考サイトを追加').click();
			await settle();
		}
		expect(button(container, '参考サイトを追加').disabled).toBe(true);
		labeledButton(container, '参考サイト2を削除').click();
		await settle();
		expect(button(container, '参考サイトを追加').disabled).toBe(false);
		mocks.api.mockImplementation(async (endpoint: string, params: Record<string, unknown>) => endpoint === 'hatask/recipes/create' ? recipe(params) : listResult([]));
		button(container, '下書き保存').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/create', expect.objectContaining({ isDraft: true, referenceLinks: [{ title: '下書きのサイト', url: 'https://example.com/draft' }] }));
	});

	test('Hatadyからの料理記録成功だけ戻り確認イベントを一度発火する', async () => {
		const { container, instance, onHatadyCookingSaved } = await mountFlow();
		instance.openRecordFromHatady();
		await settle();
		expect(container.textContent).toContain('作ったことを記録する');
		await chooseRecipeForRecord(container);
		button(container, '料理として記録する').click();
		await settle();
		expect(onHatadyCookingSaved).toHaveBeenCalledOnce();
		instance.openRecord();
		await settle();
		await chooseRecipeForRecord(container);
		button(container, '料理として記録する').click();
		await settle();
		expect(onHatadyCookingSaved).toHaveBeenCalledOnce();
	});

	test('保存失敗時は促さず、再試行成功で一度促す。キャンセル後の通常記録では促さない', async () => {
		const { container, instance, onHatadyCookingSaved } = await mountFlow();
		instance.openRecordFromHatady();
		await settle();
		await chooseRecipeForRecord(container);
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		button(container, '料理として記録する').click();
		await settle();
		expect(onHatadyCookingSaved).not.toHaveBeenCalled();
		button(container, '料理として記録する').click();
		await settle();
		expect(onHatadyCookingSaved).toHaveBeenCalledOnce();
		instance.openRecordFromHatady();
		await settle();
		button(container, 'あとで').click();
		await settle();
		instance.openRecord();
		await settle();
		await chooseRecipeForRecord(container);
		button(container, '料理として記録する').click();
		await settle();
		expect(onHatadyCookingSaved).toHaveBeenCalledOnce();
	});
	test('compiled CSSでカプセルの44pxと6テーマ明暗の角丸トークンを保つ', async () => {
		const directory = resolve(process.cwd(), 'src/components/hatask');
		const recipeSource = readFileSync(resolve(directory, 'HataskRecipe.vue'), 'utf8');
		const recipeStyle = parse(recipeSource).descriptor.styles[0];
		const compiled = await compileStyleAsync({ source: recipeStyle.content, filename: 'HataskRecipe.vue', id: 'recipe-radius-test', modules: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		if (!compiled.rawResult || !compiled.modules) throw new Error('Missing compiled recipe CSS');
		const declarations = (className: string, property: string) => {
			const values: string[] = [];
			compiled.rawResult!.root.walkRules(rule => {
				if (rule.selector.includes(`.${compiled.modules![className]}`)) rule.walkDecls(property, decl => { values.push(decl.value); });
			});
			return values;
		};
		for (const name of ['segItem', 'mealChip', 'iconButton']) expect(declarations(name, 'border-radius')).toContain('var(--control-radius)');
		expect(declarations('seg', 'border-radius')).toContain('var(--case-radius)');
		expect(declarations('mealChoices', 'border-radius')).toContain('var(--case-radius)');
		expect(declarations('mealChoices', 'background')).toContain('var(--masthead)');
		expect(declarations('mealChoices', 'overflow-x')).toContain('auto');
		expect(declarations('mealField', 'grid-template-columns')).toContain('minmax(0, 1fr)');
		expect(declarations('mealChip', 'min-height')).toContain('44px');
		expect(declarations('mealChip', 'min-width')).toContain('44px');
		expect(declarations('listActions', 'gap')).toContain('4px');
		expect(compiled.code).toContain('max-width: 599px');
		const orderedDeclarations: { selector: string; property: string; value: string; mobile: boolean; order: number }[] = [];
		let order = 0;
		compiled.rawResult.root.walkRules(rule => {
			const currentOrder = order++;
			const mobile = rule.parent?.type === 'atrule' && rule.parent.params.includes('max-width: 599px');
			rule.walkDecls(decl => { orderedDeclarations.push({ selector: rule.selector, property: decl.prop, value: decl.value, mobile, order: currentOrder }); });
		});
		const position = (className: string, property: string, value: string, mobile: boolean) => {
			const found = orderedDeclarations.find(item => item.selector.includes(`.${compiled.modules![className]}`) && item.property === property && item.value === value && item.mobile === mobile);
			expect(found, `${className} ${property}: ${value} (${mobile ? 'mobile' : 'base'})`).toBeDefined();
			return found!.order;
		};
		expect(position('seg', 'padding-inline', '4px', true)).toBeGreaterThan(position('seg', 'padding', '4px 6px', false));
		expect(position('segItem', 'font-size', '11px', true)).toBeGreaterThan(position('segItem', 'font-size', '13px', false));
		expect(position('segItem', 'gap', '4px', true)).toBeGreaterThan(position('segItem', 'gap', '6px', false));
		expect(position('listActions', 'gap', '4px', true)).toBeGreaterThan(position('listActions', 'gap', '8px', false));
		expect(position('listActions', 'padding', '0', true)).toBeGreaterThan(position('primary', 'padding-inline', '20px', false));
		const layoutSource = readFileSync(resolve(directory, 'HataskAkatsukiLayout.vue'), 'utf8');
		const layoutStyle = parse(layoutSource).descriptor.styles[0];
		const layout = await compileStyleAsync({ source: layoutStyle.content, filename: 'HataskAkatsukiLayout.vue', id: 'recipe-layout-radius-test', scoped: true, preprocessLang: 'scss' });
		expect(layout.errors).toEqual([]);
		expect(layout.code).toContain('--card-radius: 24px');
		expect(layout.code).toContain('--case-radius: 999px');
		expect(layout.code).toContain('--control-radius: 999px');
		const themeSource = readFileSync(resolve(directory, 'hatask-themes.scss'), 'utf8');
		const themes = await compileStyleAsync({ source: themeSource, filename: 'hatask-themes.scss', id: 'recipe-themes-test', preprocessLang: 'scss' });
		expect(themes.errors).toEqual([]);
		if (!themes.rawResult) throw new Error('Missing compiled theme CSS');
		for (const [theme, cardRadius, caseRadius, controlRadius] of [
			['koke', '24px', '999px', '999px'],
			['kisetsu', '6px', '8px', '5px'],
			['kashin', '22px', '24px', '999px'],
			['suri', '0px', '0px', '0px'],
			['hatakyu', '3px', '5px', '6px'],
		]) {
			const matching: Record<string, string[]> = { '--card-radius': [], '--case-radius': [], '--control-radius': [] };
			const themeAttribute = `[data-hatask-theme=${theme}]`;
			const darkAttribute = '[data-hatask-mode=dark]';
			let hasDarkSelector = false;
			themes.rawResult.root.walkRules(rule => {
				const selectors = rule.selectors.map(selector => selector.replace(/['"]/g, '').replace(/\s+/g, ''));
				if (!selectors.some(selector => selector.includes(themeAttribute))) return;
				if (selectors.some(selector => selector.includes(themeAttribute) && selector.includes(darkAttribute))) hasDarkSelector = true;
				for (const property of Object.keys(matching)) rule.walkDecls(property, decl => { matching[property].push(decl.value); });
			});
			expect(matching['--card-radius'], theme).toContain(cardRadius);
			expect(matching['--case-radius'], theme).toContain(caseRadius);
			expect(matching['--control-radius'], theme).toContain(controlRadius);
			expect(hasDarkSelector, `${theme} dark selector`).toBe(true);
		}
	});
	test('自分のレシピが無いときは空状態を出し、みんなのレシピへ切り替えられる', async () => {
		mocks.api.mockImplementation(async (endpoint: string) => endpoint === 'hatask/recipes/list' ? listResult([]) : {});
		const container = await mount();
		expect(container.textContent).toContain('まだレシピがありません');
		expect(labeledButton(container, '自分のレシピ').getAttribute('aria-pressed')).toBe('true');
		expect(labeledButton(container, 'みんなのレシピ').textContent).toBe('');
		expect(labeledButton(container, 'レシピを書く')).toBeTruthy();
		expect(labeledButton(container, 'レシピからご飯を記録')).toBeTruthy();
		labeledButton(container, 'みんなのレシピ').click();
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('hatask/recipes/list', expect.objectContaining({ scope: 'shared', category: null, tag: null }));
		expect(labeledButton(container, 'みんなのレシピ').textContent).toBe('みんなのレシピ');
		expect(labeledButton(container, '自分のレシピ').textContent).toBe('');
		labeledButton(container, '自分のレシピ').click();
		await settle();
		expect(container.textContent).toContain('まだレシピがありません');
		expect(labeledButton(container, '自分のレシピ').textContent).toBe('自分のレシピ');
	});

	test('読み込み失敗は0件と分けて中央に再試行を出し、古い一覧を見せない', async () => {
		let fail = false;
		mocks.api.mockImplementation(async (endpoint: string) => {
			if (endpoint !== 'hatask/recipes/list') return recipe();
			if (fail) throw new Error('offline');
			return listResult([recipe()]);
		});
		const container = await mount();
		expect(button(container, '鶏むねのねぎ塩だれ')).toBeTruthy();
		fail = true;
		labeledButton(container, 'みんなのレシピ').click();
		await settle();
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('レシピを読み込めませんでした');
		expect(container.textContent).not.toContain('まだレシピがありません');
		expect([...container.querySelectorAll('button')].some(item => item.textContent?.includes('鶏むねのねぎ塩だれ'))).toBe(false);
		fail = false;
		button(container, '再読み込み').click();
		await settle();
		expect(button(container, '鶏むねのねぎ塩だれ')).toBeTruthy();
	});

	test('タブを素早く戻した後に届く古い応答は一覧を上書きしない', async () => {
		let resolveShared!: (value: ReturnType<typeof listResult>) => void;
		mocks.api.mockImplementation((endpoint: string, params?: { scope?: string }) => {
			if (endpoint !== 'hatask/recipes/list') return Promise.resolve(recipe());
			if (params?.scope === 'shared') return new Promise(resolve => { resolveShared = resolve; });
			return Promise.resolve(listResult([recipe()]));
		});
		const container = await mount();
		labeledButton(container, 'みんなのレシピ').click();
		await settle();
		labeledButton(container, '自分のレシピ').click();
		await settle();
		resolveShared(listResult([recipe({ id: 'old', title: '古い共有レシピ' })]));
		await settle();
		expect(container.textContent).toContain('鶏むねのねぎ塩だれ');
		expect(container.textContent).not.toContain('古い共有レシピ');
	});

	test('検索0件は条件なしの空状態と区別する', async () => {
		mocks.api.mockImplementation(async (endpoint: string, params?: { query?: string | null }) => {
			if (endpoint !== 'hatask/recipes/list') return {};
			return params?.query ? listResult([]) : listResult([recipe()]);
		});
		const container = await mount();
		input(container.querySelector<HTMLInputElement>('input[type="search"]')!, '不存在');
		vi.advanceTimersByTime(300);
		await settle();
		expect(container.textContent).toContain('条件に合うレシピはありません。');
		expect(container.textContent).not.toContain('まだレシピがありません');
	});

	test('食事カプセルは選択中だけラベルを見せ、選択値を保存する', async () => {
		const container = await mount();
		labeledButton(container, 'レシピからご飯を記録').click();
		await settle();
		const group = container.querySelector('[role="group"][aria-label="ごはん"]')!;
		const choices = [...group.querySelectorAll<HTMLButtonElement>('button')];
		expect(choices.map(item => item.getAttribute('aria-label'))).toEqual(['選ばない', '朝ごはん', '昼ごはん', '夜ごはん', '間食']);
		expect(choices[0].textContent).toBe('選ばない');
		expect(choices.slice(1).every(item => item.textContent === '')).toBe(true);
		choices[2].click();
		await settle();
		expect(choices[2].getAttribute('aria-pressed')).toBe('true');
		expect(choices[2].textContent).toBe('昼ごはん');
		expect(choices[0].textContent).toBe('');
		mocks.select.mockResolvedValue({ canceled: false, result: 'r1' });
		button(container, '選ぶ').click();
		await settle();
		button(container, '料理として記録する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/cooked/create', expect.objectContaining({ mealSlot: 'lunch' }));
	});

	test('料理の記録だけ公開を選べて、保存時にpublicを送る', async () => {
		const container = await mount();
		labeledButton(container, 'レシピからご飯を記録').click();
		await settle();
		const recordVisibility = container.querySelector<HTMLElement>('[role="group"][aria-label="公開範囲"]')!;
		const choices = [...recordVisibility.querySelectorAll<HTMLButtonElement>('button')];
		expect(choices.map(choice => choice.textContent?.trim())).toEqual(['公開', '非公開', 'フォロワー', '指定メンバー']);
		expect(choices.find(choice => choice.textContent?.trim() === '非公開')?.getAttribute('aria-pressed')).toBe('true');
		const publicChoice = choices.find(choice => choice.textContent?.trim() === '公開')!;
		expect(publicChoice.querySelector('i')?.className).toContain('ti-world');
		publicChoice.click();
		await settle();
		expect(publicChoice.getAttribute('aria-pressed')).toBe('true');
		mocks.select.mockResolvedValue({ canceled: false, result: 'r1' });
		button(container, '選ぶ').click();
		await settle();
		button(container, '料理として記録する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/cooked/create', expect.objectContaining({ visibility: 'public', visibleUserIds: [] }));

		labeledButton(container, 'レシピを書く').click();
		await settle();
		const recipeVisibility = container.querySelector<HTMLElement>('[role="group"][aria-label="公開範囲"]')!;
		expect([...recipeVisibility.querySelectorAll('button')].map(choice => choice.textContent?.trim())).toEqual(['非公開', 'フォロワー', '指定メンバー']);
	});

	test('記録の初期日時だけなら戻れ、入力後は取消で保持し承認で戻る', async () => {
		const container = await mount();
		labeledButton(container, 'レシピからご飯を記録').click();
		await settle();
		button(container, 'あとで').click();
		await settle();
		expect(mocks.confirm).not.toHaveBeenCalled();
		labeledButton(container, 'レシピからご飯を記録').click();
		await settle();
		const memo = container.querySelector<HTMLTextAreaElement>('textarea[maxlength="2000"]')!;
		input(memo, '次は塩を少なく');
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		button(container, 'あとで').click();
		await settle();
		expect(memo.value).toBe('次は塩を少なく');
		expect(container.textContent).toContain('作ったことを記録する');
		button(container, 'もどる').click();
		await settle();
		expect(mocks.confirm).toHaveBeenCalledTimes(2);
		expect(container.textContent).toContain('レシピ');
		expect(container.textContent).not.toContain('作ったことを記録する');
	});

	test.each([
		['日時', (container: HTMLElement) => input(container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, '2026-09-21T12:30')],
		['時間', (container: HTMLElement) => input(container.querySelectorAll<HTMLInputElement>('input[type="number"]')[0], '35')],
		['人数', (container: HTMLElement) => input(container.querySelectorAll<HTMLInputElement>('input[type="number"]')[1], '4')],
		['食事', (container: HTMLElement) => labeledButton(container, '夜ごはん').click()],
		['費用', (container: HTMLElement) => input(container.querySelectorAll<HTMLInputElement>('input[type="number"]')[2], '800')],
		['公開範囲', (container: HTMLElement) => button(container, 'フォロワー').click()],
		['写真', (container: HTMLElement) => labeledButton(container, '写真を追加').click()],
	] as const)('%sの入力だけでも記録破棄の確認を出す', async (_field, change) => {
		mocks.fileSelect.mockResolvedValue({ id: 'file1', url: '/photo.jpg', thumbnailUrl: '/photo-thumb.jpg', type: 'image/jpeg' });
		const container = await mount();
		labeledButton(container, 'レシピからご飯を記録').click();
		await settle();
		change(container);
		await settle();
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		button(container, 'あとで').click();
		await settle();
		expect(mocks.confirm).toHaveBeenCalledOnce();
		expect(container.textContent).toContain('作ったことを記録する');
	});

	test('調理から引き継いだ記録は破棄確認し、保存後は確認しない', async () => {
		const container = await mount();
		button(container, '鶏むねのねぎ塩だれ').click();
		await settle();
		button(container, '作りはじめる').click();
		await settle();
		button(container, '作り終わった').click();
		await settle();
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		button(container, 'もどる').click();
		await settle();
		expect(container.textContent).toContain('作ったことを記録する');
		button(container, '料理として記録する').click();
		await settle();
		expect(mocks.confirm).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain('作りはじめる');
	});

	test('新規レシピの戻る操作は自動保存した下書きを保持する', async () => {
		const container = await mount();
		labeledButton(container, 'レシピを書く').click();
		await settle();
		input(container.querySelector<HTMLInputElement>('input[maxlength="128"]')!, '鶏そぼろ');
		await settle();
		vi.advanceTimersByTime(800);
		expect(window.localStorage.getItem('hatask:recipe-editor-draft')).toContain('鶏そぼろ');
		button(container, '一覧にもどる').click();
		await settle();
		expect(mocks.confirm).not.toHaveBeenCalled();
		expect(window.localStorage.getItem('hatask:recipe-editor-draft')).toContain('鶏そぼろ');
		labeledButton(container, 'レシピを書く').click();
		await settle();
		expect(container.querySelector<HTMLInputElement>('input[maxlength="128"]')?.value).toBe('鶏そぼろ');
	});

	test('記録の保存中は戻れず、保存完了時に破棄確認を出さない', async () => {
		let resolveSave!: (value: { id: string }) => void;
		mocks.api.mockImplementation((endpoint: string) => {
			if (endpoint === 'hatask/recipes/list') return Promise.resolve(listResult([recipe()]));
			if (endpoint === 'hatask/recipes/show') return Promise.resolve(recipe());
			if (endpoint === 'hatask/recipes/cooked/create') return new Promise(resolve => { resolveSave = resolve; });
			return Promise.resolve({});
		});
		const container = await mount();
		button(container, '鶏むねのねぎ塩だれ').click();
		await settle();
		button(container, '作りはじめる').click();
		await settle();
		button(container, '作り終わった').click();
		await settle();
		button(container, '料理として記録する').click();
		await settle();
		expect(button(container, 'もどる').disabled).toBe(true);
		expect(button(container, 'あとで').disabled).toBe(true);
		resolveSave({ id: 'c1' });
		await settle();
		expect(mocks.confirm).not.toHaveBeenCalled();
		expect(container.textContent).toContain('作りはじめる');
	});

	test('詳細の分量は人数に合わせて最初の数量だけを計算し直す', async () => {
		const container = await mount();
		button(container, '鶏むねのねぎ塩だれ').click();
		await settle();
		const amounts = () => [...container.querySelectorAll('dd')].map(item => item.textContent);
		expect(amounts()).toEqual(['300g', '小さじ1/2', '少々']);
		container.querySelector<HTMLButtonElement>('[aria-label="1人分ふやす"]')!.click();
		container.querySelector<HTMLButtonElement>('[aria-label="1人分ふやす"]')!.click();
		await settle();
		expect(amounts()).toEqual(['600g', '小さじ1', '少々']);
		expect(container.textContent).toContain('人数に合わせて計算しています');
	});

	test('公開者が自動調整をオフにしたレシピは基準人数のまま表示する', async () => {
		mocks.api.mockImplementation(async (endpoint: string) => {
			if (endpoint === 'hatask/recipes/list') return listResult([recipe({ scalable: false })]);
			if (endpoint === 'hatask/recipes/show') return recipe({ scalable: false });
			return {};
		});
		const container = await mount();
		button(container, '鶏むねのねぎ塩だれ').click();
		await settle();
		expect(container.querySelector<HTMLButtonElement>('[aria-label="1人分ふやす"]')!.disabled).toBe(true);
		expect(container.textContent).toContain('分量の自動調整をオフにしています');
	});

	test('作り終わったら実測時間と人数を記録シートに引き継いで保存する', async () => {
		const container = await mount();
		button(container, '鶏むねのねぎ塩だれ').click();
		await settle();
		container.querySelector<HTMLButtonElement>('[aria-label="1人分ふやす"]')!.click();
		await settle();
		button(container, '作りはじめる').click();
		await settle();
		expect(container.textContent).toContain('0 / 2 完了');
		vi.advanceTimersByTime(28 * 60 * 1000);
		button(container, '作り終わった').click();
		await settle();
		expect(container.textContent).toContain('作ったことを記録する');
		button(container, '料理として記録する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/cooked/create', expect.objectContaining({
			recipeId: 'r1', durationSeconds: 28 * 60, servings: 3, visibility: 'private', visibleUserIds: [],
		}));
		expect(mocks.toast).toHaveBeenCalledWith('料理として記録しました', 'ti ti-tools-kitchen-2');
	});

	test('初回同意は設定の読込後だけ出し、同意と閉じるを親へ伝える', async () => {
		const consent = vi.fn();
		const close = vi.fn();
		const waiting = await mount({ consented: false, settingsReady: false });
		expect(waiting.querySelector('[role="dialog"]')).toBeNull();
		const container = await mount({ consented: false, settingsReady: true, onConsent: consent, onClose: close });
		const dialog = container.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain('外部サーバーへ連合されません');
		button(container, '同意して使う').click();
		button(container, '閉じる').click();
		expect(consent).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
	});

	test('指定メンバーを選ばずに保存しようとすると送信しない', async () => {
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		const title = container.querySelector<HTMLInputElement>('input[maxlength="128"]')!;
		title.value = 'ほうれん草のごま和え';
		title.dispatchEvent(new Event('input'));
		button(container, '指定メンバー').click();
		await settle();
		button(container, '保存する').click();
		await settle();
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'error', text: '指定メンバーを1人以上選んでください。' });
		expect(mocks.api).not.toHaveBeenCalledWith('hatask/recipes/create', expect.anything());
	});

	test('新しいレシピはタグを分けて保存し、自動保存の下書きを消す', async () => {
		mocks.api.mockImplementation(async (endpoint: string) => {
			if (endpoint === 'hatask/recipes/list') return listResult([recipe()]);
			if (endpoint === 'hatask/recipes/create') return recipe({ id: 'r2', title: 'ほうれん草のごま和え', category: 'side' });
			return {};
		});
		const container = await mount();
		button(container, 'レシピを書く').click();
		await settle();
		const title = container.querySelector<HTMLInputElement>('input[maxlength="128"]')!;
		title.value = 'ほうれん草のごま和え';
		title.dispatchEvent(new Event('input'));
		const tags = container.querySelector<HTMLInputElement>('input[placeholder="作りおき 鶏むね"]')!;
		tags.value = '#副菜  10分、 副菜';
		tags.dispatchEvent(new Event('input'));
		button(container, '副菜').click();
		await settle();
		vi.advanceTimersByTime(1000);
		expect(window.localStorage.getItem('hatask:recipe-editor-draft')).toContain('ほうれん草のごま和え');
		button(container, '保存する').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hatask/recipes/create', expect.objectContaining({
			title: 'ほうれん草のごま和え', category: 'side', tags: ['副菜', '10分'], isDraft: false, visibility: 'private',
		}));
		expect(window.localStorage.getItem('hatask:recipe-editor-draft')).toBeNull();
		expect(container.textContent).toContain('作りはじめる');
	});
});
