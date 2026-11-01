/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { beforeAll, describe, expect, test } from 'vitest';

const filename = resolve(process.cwd(), 'src/pages/hatask.vue');
const parsed = parse(readFileSync(filename, 'utf8'), { filename });
const scopedStyle = parsed.descriptor.styles.find(style => style.scoped && style.lang === 'scss');
const layoutFilename = resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue');
const layoutParsed = parse(readFileSync(layoutFilename, 'utf8'), { filename: layoutFilename });
const scopeId = 'data-v-hatask-visibility';
const tabs = ['cal', 'todo', 'garden'] as const;
const themes = ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'] as const;
type Theme = typeof themes[number];
// Derive these from the installed SFC parser. A direct compiler-core import
// resolves a different patch version in this workspace and has a different AST.
type TemplateAst = NonNullable<NonNullable<typeof parsed.descriptor.template>['ast']>;
type TemplateChildNode = TemplateAst['children'][number];
type ElementNode = Extract<TemplateChildNode, { type: 1 }>;
type CompiledStyle = Awaited<ReturnType<typeof compileStyleAsync>>;
type Rule = { selector: string; property: string; value: string; important: boolean; specificity: number; reducedMotion: boolean; order: number };

let compiled: CompiledStyle;
let broken: CompiledStyle;
let layoutCompiled: CompiledStyle;
let actualRules: Rule[];
let brokenRules: Rule[];

function compiledRoot(style: CompiledStyle) {
	const root = style.rawResult?.root;
	if (!root) throw new Error('SCSS compiler did not produce a PostCSS tree');
	return root;
}

/** Sass may omit quotes around identifier-valued attributes; their meaning is unchanged. */
function canonicalSelector(selector: string): string {
	return selector.replace(/\[([\w-]+)=(["']?)([\w-]+)\2\]/gu, (_, name: string, _quote: string, value: string) => `[${name}=${value}]`).replaceAll(`[${scopeId}]`, '').trim();
}

function elements(children: TemplateChildNode[]): ElementNode[] {
	return children.flatMap(child => child.type === 1 ? [child, ...elements(child.children)] : []);
}

function attribute(node: ElementNode, name: string): string | undefined {
	const prop = node.props.find(candidate => candidate.type === 6 && candidate.name === name);
	return prop?.type === 6 ? prop.value?.content : undefined;
}

function tabNode(tab: typeof tabs[number]): ElementNode {
	const matches = elements(parsed.descriptor.template?.ast?.children ?? []).filter(node => node.props.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.type === 4 && prop.exp.content.replace(/\s/gu, '') === `activeTab==='${tab}'||captureKind==='${tab}'`));
	expect(matches, `${tab} の実テンプレート分岐`).toHaveLength(1);
	expect(attribute(matches[0], 'class')).toContain('htk-tabpage');
	return matches[0];
}

/** Static template skeleton only: no page setup, API calls, directives or animation events. */
function skeleton(node: ElementNode): HTMLElement {
	const element = window.document.createElement(node.tag);
	element.setAttribute(scopeId, '');
	for (const prop of node.props) {
		if (prop.type === 6 && prop.value && (prop.name === 'class' || prop.name === 'style' || prop.name.startsWith('data-'))) element.setAttribute(prop.name, prop.value.content);
	}
	for (const child of node.children) {
		if (child.type !== 1) continue;
		if (child.props.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.type === 4 && prop.exp.content.trim() === 'false')) continue;
		// Vue templates do not introduce DOM ancestors. Native <template> would
		// instead hide its descendants inside .content and weaken this detector.
		if (child.tag === 'template') {
			const transparent = skeleton(child);
			element.append(...Array.from(transparent.childNodes));
		} else element.append(skeleton(child));
	}
	return element;
}

function fixture(tab: typeof tabs[number], theme: Theme, animations: 'on' | 'off' = 'on'): HTMLElement[] {
	const root = window.document.createElement('div');
	root.className = 'htk-root';
	root.dataset.theme = theme;
	root.dataset.anim = animations;
	root.setAttribute(scopeId, '');
	root.append(skeleton(tabNode(tab)));
	const content = Array.from(root.querySelectorAll<HTMLElement>('.htk-anim'));
	expect(content.length, `${tab} の実テンプレートに表示対象が必要`).toBeGreaterThan(0);
	return content;
}

/** Limited to the parent .htk-anim rules, not a browser layout/compositing engine. */
function rulesFrom(style: CompiledStyle): Rule[] {
	expect(style.errors).toEqual([]);
	const stylesheet = compiledRoot(style);
	const rules: Rule[] = [];
	stylesheet.walkRules(rule => {
		if (!rule.selector.includes('.htk-anim')) return;
		let reducedMotion = false;
		for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
			if (parent.type !== 'atrule') continue;
			// Fail closed if a new conditional opacity rule exceeds this detector.
			expect(parent.name).toBe('media');
			expect(parent.params).toBe('(prefers-reduced-motion: reduce)');
			reducedMotion = true;
		}
		for (const selector of rule.selectors) {
			// The relevant selectors currently contain only classes, attributes,
			// descendant combinators and nth-child. Reject unsupported syntax.
			const withoutNot = selector.replace(/:not\(\[[^\]]+\]\)/gu, '');
			const withoutAttributes = withoutNot.replace(/\[[^\]]+\]/gu, '');
			const withoutClasses = withoutAttributes.replace(/\.[\w-]+/gu, '').replace(/:nth-child\([^)]*\)/gu, '');
			expect(withoutClasses.trim(), `unsupported visibility selector: ${selector}`).toBe('');
			const specificity = (selector.match(/\[[^\]]+\]|\.[\w-]+|:nth-child\([^)]*\)/gu) ?? []).length;
			rule.walkDecls(declaration => {
				if (!['opacity', 'animation', 'animation-name'].includes(declaration.prop)) return;
				rules.push({ selector, property: declaration.prop, value: declaration.value, important: !!declaration.important, specificity, reducedMotion, order: rules.length });
			});
		}
	});
	expect(rules.some(rule => rule.property === 'opacity')).toBe(true);
	return rules;
}

function winningRule(rules: Rule[], element: HTMLElement, property: string, reducedMotion = false): Rule | undefined {
	return rules.filter(rule => rule.property === property && (!rule.reducedMotion || reducedMotion) && element.matches(rule.selector)).sort((a, b) => Number(a.important) - Number(b.important) || a.specificity - b.specificity || a.order - b.order).at(-1);
}

function hiddenContent(rules: Rule[], content: HTMLElement[], reducedMotion = false): HTMLElement[] {
	return content.filter(element => {
		const opacity = winningRule(rules, element, 'opacity', reducedMotion);
		// Require an actual matching declaration: a selector/scoping failure is
		// not evidence that the original opacity:0 defect was fixed.
		if (!opacity) throw new Error(`no opacity declaration for ${element.className}`);
		expect(element.style.opacity, 'inline opacity must be reviewed explicitly').toBe('');
		return Number(opacity.value) !== 1;
	});
}

beforeAll(async () => {
	expect(parsed.errors).toEqual([]);
	if (!scopedStyle) throw new Error('Hatask parent scoped SCSS was not found');
	const originalRule = /(\.htk-root\[data-theme\]\s+\.htk-anim\s*\{\s*opacity:\s*)1(?=\s*[;}])/u;
	expect(scopedStyle.content).toMatch(originalRule);
	const brokenSource = scopedStyle.content.replace(originalRule, (_, prefix: string) => `${prefix}0`);
	expect(brokenSource).not.toBe(scopedStyle.content);
	const compile = (source: string) => compileStyleAsync({ source: source + '\n' + readFileSync(resolve(process.cwd(), 'src/components/hatask/hatask-themes.scss'), 'utf8'), filename, id: scopeId, scoped: true, preprocessLang: 'scss' });
	expect(layoutParsed.errors).toEqual([]);
	expect(layoutParsed.descriptor.styles).toHaveLength(1);
	const layoutStyle = layoutParsed.descriptor.styles[0];
	expect(layoutStyle.scoped).toBe(true);
	expect(layoutStyle.lang).toBe('scss');
	[compiled, broken, layoutCompiled] = await Promise.all([
		compile(scopedStyle.content),
		compile(brokenSource),
		compileStyleAsync({ source: layoutStyle.content, filename: layoutFilename, id: scopeId, scoped: true, preprocessLang: 'scss' }),
	]);
	expect(layoutCompiled.errors).toEqual([]);
	actualRules = rulesFrom(compiled);
	brokenRules = rulesFrom(broken);
}, 30000);

describe('暁で従来の .htk-anim 内容が透明にならない親 CSS 契約', () => {
	test.each(tabs)('%s: 旧 opacity:0 を同じコンパイル・セレクター検出器で検出する', tab => {
		const content = fixture(tab, 'akatsuki');
		expect(hiddenContent(brokenRules, content)).toHaveLength(content.length);
	});

	test.each(tabs)('%s: アニメーション開始なしでも実テンプレートの内容は opacity:1', tab => {
		const content = fixture(tab, 'akatsuki');
		expect(hiddenContent(actualRules, content)).toEqual([]);
		for (const element of content) expect(winningRule(actualRules, element, 'animation')).toBeUndefined();
	});

	test.each(themes)('%s: 動き OFF と reduced-motion の両方で本文を表示する', theme => {
		for (const tab of tabs) {
			for (const [animations, reducedMotion] of [['off', false], ['on', true]] as const) {
				const content = fixture(tab, theme, animations);
				expect(hiddenContent(actualRules, content, reducedMotion)).toEqual([]);
				for (const element of content) expect(winningRule(actualRules, element, 'animation', reducedMotion)?.value).toBe('none');
			}
		}
	});

	test.each(themes)('%s: 旧テーマ固有の登場演出を使わず、本文を表示する', theme => {
		for (const element of fixture('cal', theme)) {
			expect(winningRule(actualRules, element, 'opacity')?.value).toBe('1');
			expect(winningRule(actualRules, element, 'animation')?.value ?? '').not.toMatch(/htkItem(?:Ki|Ka|Su)/u);
		}
	});
});

describe('時間帯グラデーションのコンパイル済み CSS 契約', () => {
	const properties = ['bg', 'start', 'middle', 'end', 'left-start', 'left-middle', 'left-end', 'right-start', 'right-middle', 'right-end'].map(name => `--hak-daylight-${name}`);
	const literalColor = (value: string): boolean => /^(?:#[\da-f]{6}|transparent)$/iu.test(value);

	function rootDeclarations(dark = false): Map<string, string> {
		const declarations = new Map<string, string>();
		const target = `.htk-akatsuki-layout[data-enabled=true]${dark ? '[data-mode=dark]' : ''}`;
		compiledRoot(layoutCompiled).walkRules(rule => {
			if (rule.parent?.type !== 'root') return;
			if (canonicalSelector(rule.selector) !== target) return;
			rule.walkDecls(declaration => { declarations.set(declaration.prop, declaration.value); });
		});
		expect(declarations.size).toBeGreaterThan(0);
		return declarations;
	}

	test('属性の引用符だけを正規化し、テーマ・明暗・有効状態は区別する', () => {
		const expected = '.htk-akatsuki-layout[data-enabled=true][data-mode=dark]';
		for (const quote of ['', "'", '"']) {
			expect(canonicalSelector(`.htk-akatsuki-layout[data-enabled=${quote}true${quote}][data-mode=${quote}dark${quote}][${scopeId}]`)).toBe(expected);
		}
		expect(canonicalSelector('.htk-akatsuki-layout[data-enabled=false][data-mode=dark]')).not.toBe(expected);
		expect(canonicalSelector('.htk-akatsuki-layout[data-enabled=true][data-mode=light]')).not.toBe(expected);
		expect(canonicalSelector('.htk-root[data-theme="kisetsu"][data-anim] .htk-anim')).not.toBe('.htk-root[data-theme=hatakyu][data-anim] .htk-anim');
	});

	test('10 色の @property は独立した透明色・継承ありで登録され、Sass 変数を残さない', () => {
		expect(literalColor('$color')).toBe(false);
		expect(literalColor('var(--accent)')).toBe(false);
		expect(literalColor('transparent')).toBe(true);
		const registered: string[] = [];
		compiledRoot(layoutCompiled).walkAtRules('property', property => {
			if (!property.params.startsWith('--hak-daylight-')) return;
			registered.push(property.params);
			const declarations = new Map<string, string>();
			property.walkDecls(declaration => { declarations.set(declaration.prop, declaration.value); });
			expect(declarations.get('syntax')?.replaceAll("'", '"')).toBe('"<color>"');
			expect(declarations.get('inherits')).toBe('true');
			expect(literalColor(declarations.get('initial-value') ?? ''), `${property.params} initial-value`).toBe(true);
			expect(declarations.get('initial-value')).toBe('transparent');
		});
		expect(registered).toEqual(properties);
	});

	test('10 色だけを root で連続補間し、時間長と linear を結線する', () => {
		const root = rootDeclarations();
		expect(root.get('transition-property')?.split(',').map(value => value.trim())).toEqual(properties);
		expect(root.get('transition-duration')).toBe('var(--hak-daylight-duration, 0s)');
		expect(root.get('transition-timing-function')).toBe('linear');
		expect(root.get('background')).toBe('var(--bg-image), var(--bg)');
	});

	test.each([false, true])('dark=%s: 登録色を中央・左右ペイン背景へ実際に参照する', dark => {
		// Dark overrides only differing declarations; the base selector still applies.
		const root = new Map([...rootDeclarations(), ...(dark ? rootDeclarations(true) : [])]);
		for (const [declaration, suffixes] of [
			['--bg', ['bg']],
			['--bg-image', ['start', 'middle', 'end']],
			['--menu-left-bg', ['left-start', 'left-middle', 'left-end']],
			['--menu-right-bg', ['right-start', 'right-middle', 'right-end']],
		] as const) {
			const value = root.get(declaration);
			for (const suffix of suffixes) expect(value).toContain(`var(--hak-daylight-${suffix})`);
		}
		expect(layoutCompiled.code).toMatch(/background:\s*var\(--menu-left-bg\)/u);
		expect(layoutCompiled.code).toMatch(/background:\s*var\(--menu-right-bg\)/u);
	});
});

describe('検索フォーカスとTeleport先のトグル色', () => {
	test('PC検索のフォーカス輪郭は角丸ケースに付け、内側inputの四角い輪郭だけを外す', () => {
		const declarations = (selector: string) => {
			const result = new Map<string, string>();
			compiledRoot(layoutCompiled).walkRules(rule => {
				if (rule.selectors.some(value => canonicalSelector(value) === selector)) rule.walkDecls(decl => { result.set(decl.prop, decl.value); });
			});
			return result;
		};
		expect(declarations('.hak-desktop-search').get('border-radius')).toBe('999px');
		expect(declarations('.htk-akatsuki-layout .hak-desktop-search:focus-within').get('outline')).toBe('3px solid var(--accent-ink)');
		expect(declarations('.htk-akatsuki-layout .hak-desktop-search input:focus-visible').get('outline')).toBe('none');
		// Missing a wrapper ring must not be mistaken for the rounded-focus fix.
		expect(declarations('.missing-search:focus-within').has('outline')).toBe(false);
	});

	test.each(themes.flatMap(theme => ['light', 'dark'].map(mode => ({ theme, mode }))))('$theme/$mode: ページとbody直下モーダルに同じ緑とスプリング曲線が届く', ({ theme, mode }) => {
		for (const className of ['htk-root', 'htk-modal-ov', 'htk-event-details-theme']) {
			const element = window.document.createElement('div');
			element.className = className;
			element.dataset.theme = theme;
			element.dataset.mode = mode;
			element.setAttribute(scopeId, '');
			const tokens = new Map<string, string>();
			compiledRoot(compiled).walkRules(rule => {
				if (rule.parent?.type === 'root' && rule.selectors.some(selector => element.matches(selector))) rule.walkDecls(decl => { if (decl.prop.startsWith('--')) tokens.set(decl.prop, decl.value); });
			});
			expect(tokens.get('--success')).toBe('#6ec072');
			expect(tokens.get('--ease-spring')).toBe('cubic-bezier(0.34,1.56,0.64,1)');
			expect(tokens.has('--surface')).toBe(true);
			const hasSwitchTokens = (values: Map<string, string>): boolean => ['--success', '--surface', '--ease-spring'].every(key => values.has(key));
			expect(hasSwitchTokens(tokens)).toBe(true);
			tokens.delete('--success');
			expect(hasSwitchTokens(tokens)).toBe(false);
		}
	});

	test('暁の検索結果表示時は旧入力モーダルを出さず、同じ結果部品を使う', () => {
		const template = parsed.descriptor.template?.content ?? '';
		expect(template).not.toContain('class="htk-sch-modal"');
		expect(template).toContain('v-model:searchQuery="searchQuery"');
		expect(template.match(/<HataskSearchResults\b/g)).toHaveLength(1);
		expect(template).not.toContain('class="htk-inp htk-sch-inp"');
	});
});

describe('お花の並び替えは共通コレクションから操作する', () => {
	test('一覧のネイティブ選択欄と取得済みの並び順を使う', () => {
		const collection = parse(readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskFlowerCollection.vue'), 'utf8')).descriptor;
		const template = collection.template!.content;
		expect(template).toContain('data-flower-collection-action="order"');
		expect(template).toContain(':value="order"');
		expect(template).toContain('@change="changeOrder"');
		expect(template).toContain('<option value="newest">{{ labels.newest }}</option>');
		expect(template).toContain('<option value="oldest">{{ labels.oldest }}</option>');
		expect(collection.scriptSetup!.content).toContain("emit('order', order)");
	});
});

describe('暁のメニュー・カプセルケース・検索開閉の CSS 契約', () => {
	function declarations(selector: string): Map<string, string> {
		const result = new Map<string, string>();
		compiledRoot(layoutCompiled).walkRules(rule => {
			if (rule.selectors.some(value => canonicalSelector(value) === selector)) rule.walkDecls(decl => { result.set(decl.prop, decl.value); });
		});
		return result;
	}

	test('メニュー内だけ字形の128%拡大を止め、正方形の枠で中央に配置する', () => {
		const commonStyle = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf8');
		const commonIcon = commonStyle.match(/\.ti\s*\{[^}]*&::before\s*\{([^}]*)\}/u)?.[1];
		expect(commonIcon).toMatch(/font-size:\s*128%/u);
		const glyph = declarations('.hak-rail :is(.hak-rail-menu, .hak-rail-tab) > .ti::before');
		expect(glyph.get('font-size')).toBe('1em');
		expect(glyph.get('line-height')).toBe('1');
		expect(glyph.get('display')).toBe('block');
		for (const [selector, width] of [['.hak-rail-tab > .ti', '20px'], ['.htk-akatsuki-layout .hak-rail-menu > .ti', '21px']]) {
			const icon = declarations(selector);
			expect(icon.get('width')).toBe(width);
			expect(icon.get('height')).toBe(width);
			expect(icon.get('place-items')).toBe('center');
			expect(icon.get('vertical-align')).toBe('baseline');
		}
		// The same selector lookup must not find a global override affecting other icons.
		expect(declarations('.ti::before').has('font-size')).toBe(false);
	});

	test('右ペインのケースは既存の角丸・枠・背景・影トークンを使い、内容とフォーカスを切り取らない', () => {
		const card = declarations('.htk-akatsuki-layout .hak-side-case');
		for (const [property, value] of [['border', 'var(--card-border)'], ['border-radius', 'var(--card-radius)'], ['background', 'var(--masthead)'], ['box-shadow', 'var(--card-shadow)'], ['min-width', '0'], ['padding', '14px']]) expect(card.get(property)).toBe(value);
		expect(card.has('height')).toBe(false);
		expect(card.has('overflow')).toBe(false);
		expect(declarations('.hak-side').get('gap')).toBe('12px');
		expect(declarations('.hak-side-case .hak-todo-copy').get('overflow-wrap')).toBe('anywhere');
		expect(declarations('[data-hide-aside=true] .hak-side').get('display')).toBe('none');
	});

	test('検索結果は高さを0frから1frへ開き、閉じるときは上へ戻す', () => {
		const closed = declarations('.hak-search-disclosure');
		const opened = declarations('.hak-search-disclosure[data-open=true]');
		expect(closed.get('grid-template-rows')).toBe('0fr');
		expect(opened.get('grid-template-rows')).toBe('1fr');
		expect(closed.get('transition')).toContain('grid-template-rows 0.28s');
		expect(closed.get('visibility')).toBe('hidden');
		expect(opened.get('visibility')).toBe('visible');
		expect(declarations('.hak-search-disclosure-clip').get('min-height')).toBe('0');
		expect(declarations('.hak-search-disclosure-clip').get('overflow')).toBe('hidden');
		expect(declarations('.hak-search-results').get('transform')).toBe('translateY(-12px)');
		expect(declarations('.hak-search-disclosure[data-open=true] .hak-search-results').get('transform')).toBe('translateY(0)');
		expect(declarations('.htk-akatsuki-layout[data-motion=off] *').get('transition')).toBe('none');
	});
});
