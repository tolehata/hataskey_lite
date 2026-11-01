/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, test } from 'vitest';
import { courses, destinations, features, glossary, guideDetails } from './content.js';
import { references, referenceCourses } from './reference-content.js';
import { brandName, hataskGuideProse, iconClass } from './prose.js';
import { findFeatures } from './search.js';
import { composerTools } from './static-scenes.js';

const directory = resolve(process.cwd(), 'src/components/hata-intro');
const css = readFileSync(resolve(directory, 'hata-intro.css'), 'utf8') + '\n' + readFileSync(resolve(directory, 'reference.css'), 'utf8') + '\n' + readFileSync(resolve(directory, 'ui-s-scenes.css'), 'utf8') + '\n' + readFileSync(resolve(directory, 'hatagoes-scenes.css'), 'utf8');
const sources = readdirSync(directory).filter(file => /\.(?:js|ts|vue)$/.test(file) && !file.endsWith('.test.ts')).map(file => readFileSync(resolve(directory, file), 'utf8')).join('\n');

describe('承認ガイドの内容と安全な本体接続', () => {
	test('8カテゴリ・32章とFAQ・手順・関連項目を欠落なく保つ', () => {
		expect(courses.map(c => c.id)).toEqual(['uis', 'hatagoes', 'timeline', 'notes', 'post', 'apps', 'hatask', 'settings']);
		const ids = courses.flatMap(c => c.features);
		expect(ids).toHaveLength(32);
		expect(new Set(ids).size).toBe(32);
		expect(Object.keys(features).sort()).toEqual([...ids].sort());
		expect(Object.keys(guideDetails).sort()).toEqual([...ids].sort());

		function checkFeature(id: string) {
			const f = features[id], d = guideDetails[id];
			expect(f).toBeDefined(); expect(d).toBeDefined();
			for (const text of [f.name, f.title, f.benefit, f.where, f.source, f.note, d.result, d.aliases]) expect(text.length).toBeGreaterThan(0);
			expect(f.steps.length).toBeGreaterThanOrEqual(3); expect(d.help.length).toBeGreaterThan(0);
			for (const related of d.related) expect(ids).toContain(related);
		}

		expect(() => checkFeature('positive-control-missing')).toThrow();
		ids.forEach(checkFeature);
		glossary.forEach(([, , id]) => expect(ids).toContain(id));
	});
	test('Hatadintの名称・旧検索語・書き出し案内を保持する', () => {
		expect(features.draw.name).toBe('Hatadint');
		for (const word of ['Hatadint', 'hatadint', 'Ｈａｔａｄｉｎｔ', 'お絵描き', 'お絵かき', '書き出す PNG']) expect(findFeatures(word)[0]?.id).toBe('draw');
		expect(features.draw.steps.join(' ')).toContain('右上の「書き出す」');
		expect(features.draw.note).toContain('投稿は送信されない');
	});
	test('検索のカテゴリ・複数語・カナ正規化は同じ記事集合を参照する', () => {
		expect(findFeatures('', 'apps').map(item => item.id)).toEqual(courses.find(c => c.id === 'apps')?.features);
		expect(findFeatures('映画 記録').map(item => item.id)).toContain('hatady');
		expect(findFeatures('てーま').map(item => item.id)).toContain('theme');
		expect(findFeatures('Hatadint', 'settings')).toEqual([]);
	});
	test('新しい使い方を検索でき、操作説明の参照元が実在する', () => {
		expect(findFeatures('UI S', 'uis').map(item => item.id).sort()).toEqual(['uiSOverview', 'uiSPost', 'uiSSettings', 'uiSWorkspace']);
		expect(findFeatures('UI S お絵描き', 'uis').map(item => item.id)).toContain('uiSPost');
		expect(findFeatures('横断検索').map(item => item.id)).toContain('goesSearch');
		expect(findFeatures('フォルダ').map(item => item.id)).toContain('favorite');
		const sourceExists = (path: string) => existsSync(resolve(process.cwd(), path.startsWith('locales/') ? '../..' : 'src', path));
		expect(sourceExists('missing-guide-source.vue')).toBe(false);
		for (const feature of Object.values(features)) {
			for (const source of feature.source.split(';')) expect(sourceExists(source.trim().split(':')[0]), source).toBe(true);
		}
	});
	test('名前と文はHTMLをエスケープし、句点で改行する', () => {
		expect(hataskGuideProse('「一文。」次の文')).toBe('「一文。」<br>次の文');
		expect(hataskGuideProse('<img src=x>。次')).toBe('&lt;img src=x&gt;。<br>次');
		expect(brandName('Hatadint')).toBe('<span class="hg-brand">Hatadint</span>');
		expect(brandName('Hata<script>')).toContain('&lt;script&gt;');
	});
	test('すべての本体入口が同一インスタンスの内部ルートである', () => {
		for (const route of Object.values(destinations)) expect(route).toMatch(/^\/(?!\/)/);
		expect(destinations.layout).toBe('/settings/hata-custom');
		expect(destinations.card).toBe('/hatask/card-maker');
		expect(sources).not.toContain('http://localhost');
		expect(sources).not.toContain('file:///');
	});
	test('説明図にアカウント・API・設定保存・iframe・コード評価を持ち込まない', () => {
		const forbidden = /\b(?:misskeyApi|fetch|XMLHttpRequest|eval)\s*\(|\b(?:localStorage|sessionStorage)\.|\bnew Function\b|<iframe\b|\bsrcdoc\s*=|(?:globalThis|window)\.HataskGuide/;
		for (const positive of ['fetch("/api")', 'localStorage.setItem("x","y")', '<iframe srcdoc="...">', 'window.HataskGuide = {}']) expect(forbidden.test(positive)).toBe(true);
		expect(forbidden.test(sources)).toBe(false);
	});
	test('モックで未確定だったはたLite/Darkの色を実物と偽らない', () => {
		expect(features.theme.note).toContain('配色はまだ仮表示');
		expect(guideDetails.theme.practice).toContain('実際のテーマ色はまだ適用していない');
	});
});

describe('ガイド内に閉じたモック準拠のCSS・書体', () => {
	test('外枠は上下線だけを残し、テーマや幅の違いでも左右線を戻さず、内側の境界とフォーカスを保つ', () => {
		function checkBorders(source: string) {
			const ast = postcss.parse(source);
			let blockBorders = 0;
			// Walk nested @media/@container rules too, including theme-qualified roots.
			ast.walkRules(rule => {
				if (!rule.selectors.some(selector => /^\.hata-intro(?:\[[^\]]+\])*$/.test(selector))) return;
				rule.walkDecls(/^border(?:-|$)/, declaration => {
					if (declaration.prop === 'border-radius') return;
					expect(declaration.prop).toBe('border-block');
					expect(declaration.value).toBe('1px solid var(--hg-line)');
					blockBorders++;
				});
			});
			expect(blockBorders).toBeGreaterThan(0);
			const declaration = (selector: string, property: string) => {
				let value = '';
				ast.walkRules(selector, rule => rule.walkDecls(property, item => { value = item.value; }));
				return value;
			};
			for (const selector of ['.hata-intro .hg-topic-card', '.hata-intro .hg-search-box']) {
				expect(declaration(selector, 'border')).toBe('1px solid var(--hg-line)');
			}
			expect(declaration('.hata-intro .hg-log-rail', 'border-left')).toBe('2px solid var(--hg-line)');
			expect(declaration('.hata-intro :where(button,input,select):focus-visible', 'outline')).toBe('2px solid var(--hg-accent)');
		}

		for (const incorrect of [
			'.hata-intro { border: 1px solid var(--hg-line); }',
			'.hata-intro[data-theme="night"] { border-right: 1px solid var(--hg-line); }',
			'@container hg-guide-a (max-width: 640px) { .hata-intro { border-inline: 1px solid var(--hg-line); } }',
			'@media (prefers-color-scheme: dark) { .hata-intro[data-theme="system"] { border-left: 1px solid var(--hg-line); } }',
			'.hata-intro { border-block: none; }',
			'.hata-intro .hg-topic-card { border: none; }',
			'.hata-intro :where(button,input,select):focus-visible { outline: none; }',
		]) expect(() => checkBorders(`${css}\n${incorrect}`)).toThrow();
		checkBorders(css);
	});

	test('HataIntroのブランド書体・控えめな上部余白と、改訂文だけのフッターの中央揃えを維持する', () => {
		function checkPresentation(source: string) {
			const ast = postcss.parse(source);
			const declaration = (selector: string, property: string) => {
				let value = '';
				ast.walkRules(selector, rule => rule.walkDecls(property, item => { value = item.value; }));
				return value;
			};
			expect(declaration('.hata-intro .hg-brand', 'font-family')).toMatch(/^HataIntroRighteous(?:,|$)/);
			expect(declaration('.hata-intro .hg-main', 'padding-block')).toBe('clamp(16px, 2cqi, 24px)');
			expect(declaration('.hata-intro .hg-hero', 'padding-top')).toBe('0');
			expect(declaration('.hata-intro .hg-hero .hg-eyebrow .hg-brand', 'font-size')).toBe('20px');
			expect(declaration('.hata-intro .hg-hero .hg-eyebrow .hg-brand', 'line-height')).toBe('1.4');
			expect(declaration('.hata-intro .hg-footer', 'display')).toBe('block');
			expect(declaration('.hata-intro .hg-footer', 'text-align')).toBe('center');
		}

		for (const incorrect of [
			'.hata-intro .hg-brand { font-family: sans-serif; }',
			'.hata-intro .hg-main { padding-block: 64px; }',
			'.hata-intro .hg-hero { padding-top: 32px; }',
			'.hata-intro .hg-hero .hg-eyebrow .hg-brand { font-size: 36px; }',
			'.hata-intro .hg-hero .hg-eyebrow .hg-brand { line-height: 2; }',
			'.hata-intro .hg-footer { display: flex; }',
			'.hata-intro .hg-footer { text-align: left; }',
		]) expect(() => checkPresentation(`${css}\n${incorrect}`)).toThrow();
		checkPresentation(css);
	});

	test('CSS構文検査とスコープ検査は陽性対照を検出する', () => {
		expect(() => postcss.parse('.broken {')).toThrow();

		function checkScope(source: string) {
			postcss.parse(source).walkRules(rule => {
				if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
				expect(rule.selector.startsWith('.hata-intro')).toBe(true);
			});
		}

		expect(() => checkScope('body { color:red }')).toThrow();
		checkScope(css);
		expect(css).not.toMatch(/@import|data:font/);
	});
	test('書体は既存RighteousとOFLを使い、本文とTablerは本体資源を再利用する', () => {
		expect(css).toContain('url(\'/client-assets/Righteous-Regular.woff2\')');
		expect(css).toMatch(/\.hg-brand\s*\{[^}]*font-family:\s*HataIntroRighteous/);
		expect(readFileSync(resolve(process.cwd(), 'assets/fonts/Righteous-OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE');
		expect(readFileSync(resolve(process.cwd(), 'assets/Righteous-Regular.woff2')).subarray(0, 4).toString()).toBe('wOF2');
		const glyphs = readFileSync(resolve(process.cwd(), '../../node_modules/.pnpm/@tabler+icons-webfont@3.35.0/node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css'), 'utf8');
		const names = new Set([
			...Object.values(features).map(f => f.icon), ...courses.map(c => c.icon),
			...referenceCourses.map(c => c.icon), ...references.map(r => r.iconClass.replace('ti ti-', '')),
			...composerTools.map(tool => tool[1]),
			...[...sources.matchAll(/\b(?:icon|iconClass|ti)\('([^']+)'/g)].map(match => match[1]),
			...[...sources.matchAll(/class="ti ti-([a-z0-9-]+)/g)].map(match => match[1]),
		]);
		const missing = (names: Iterable<string>) => [...names].filter(name => !glyphs.includes(`.${iconClass(name).split(' ')[1]}:before`));
		expect(missing(['positive-control-missing-icon'])).toEqual(['positive-control-missing-icon']);
		expect(missing(names)).toEqual([]);
	});
	test('カプセル・フォーカス・タッチ領域・小窓のcontainerルールを維持する', () => {
		const ast = postcss.parse(css);
		const declaration = (selector: string, property: string) => { let value = ''; ast.walkRules(selector, rule => rule.walkDecls(property, item => { value = item.value; })); return value; };
		expect(declaration('.hata-intro .hg-search-box', 'border-radius')).toBe('999px');
		expect(declaration('.hata-intro .hg-search-box:focus-within', 'box-shadow')).toContain('3px');
		expect(declaration('.hata-intro .hg-search-box input', 'min-width')).toBe('0');
		expect(declaration('.hata-intro .hg-search-submit', 'color')).toBe('var(--hg-on-accent)');
		expect(css).toContain('@media (pointer:coarse)');
		expect(css).toContain('width:44px; height:44px');
		expect(css).toContain('prefers-reduced-motion:reduce');
		expect(css).toContain('@container hg-guide-a');
		expect(css).toContain('var(--MI-stickyTop, 0px)');
		expect(css).toContain('[data-hgu-section] { scroll-margin-top:160px');
		expect(declaration('.hata-intro .hg-reference-reading', 'max-width')).toBe('760px');
		expect(css).toContain('text-wrap: pretty; word-break: auto-phrase; line-break: strict; overflow-wrap: break-word');
	});
	test('本体配色・ライト・ダークを別々に扱う', () => {
		expect(css).toContain('.hata-intro[data-theme="system"]');
		expect(css).toContain('--hg-panel: var(--MI_THEME-panel)');
		expect(css).toContain('--hg-fg: var(--MI_THEME-fg)');
		expect(css).toContain('--hg-on-accent: var(--MI_THEME-fgOnAccent)');
		expect(css).toContain('[data-theme="day"] { color-scheme: light; }');
		expect(css).toContain('[data-theme="night"] { color-scheme: dark; }');
		postcss.parse(css).walkRules('.hata-intro .hgt-tool-scene', rule => {
			rule.walkDecls(/^--hgt-/, item => {
				expect(item.value).toMatch(/^var\(--hg-/);
				expect(item.value).not.toContain('--MI_THEME-');
			});
		});
	});
});
