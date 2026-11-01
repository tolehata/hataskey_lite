/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import type { HataskPlannerTheme } from './hatask-planner-types.js';

const directory = resolve(process.cwd(), 'src/components/hatask');
const themes: HataskPlannerTheme[] = ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu', 'halloween'];

function component(name: string) { return parse(readFileSync(resolve(directory, `${name}.vue`), 'utf8')); }

function contrast(a: string, b: string): number {
	const luminance = (hex: string) => {
		const rgb = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
		return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
	};
	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (lighter + .05) / (darker + .05);
}

describe('暁の子 UI テーマ契約', () => {
	test('保存済みテーマとハロウィンを同じ型で受け取る', () => {
		const typeSource = readFileSync(resolve(directory, 'hatask-planner-types.ts'), 'utf8');
		const themeType = typeSource.match(/export type HataskPlannerTheme = ([^;]+);/u)?.[1];
		expect(themeType?.match(/'[^']+'/gu)?.map(value => value.slice(1, -1))).toEqual(themes);
	});

	test.each(['HataskCalendarPlanner', 'HataskTodoPlanner', 'HataskJournal', 'HataskQuickCapture', 'HataskTemplateLibrary'])('%s は全テーマで共通の子 UI を使う', name => {
		const { descriptor, errors } = component(name);
		expect(errors).toEqual([]);
		expect(descriptor.scriptSetup?.content).toContain('theme?: HataskPlannerTheme');
		expect(descriptor.template?.content).toContain(':data-hatask-theme="theme"');
		const styles = descriptor.styles.map(style => style.src ? readFileSync(resolve(process.cwd(), 'src/pages', style.src), 'utf8') : style.content).join('\n');
		expect(styles).toContain('.root[data-hatask-theme]');
		expect(styles).toContain('--accent: var(--accent-ink)');
		expect(styles).toContain('--fg-3: var(--fg-2)');
	});

	test.each(['HataskCalendarPlanner', 'HataskTodoPlanner', 'HataskEventMoveDialog'])('%s の Teleport は Hatask の明暗を明示的に受け取る', name => {
		const { descriptor, errors } = component(name);
		expect(errors).toEqual([]);
		expect(descriptor.scriptSetup?.content).toContain('colorMode?: \'light\' | \'dark\'');
		expect(descriptor.template?.content).toContain(':data-hatask-mode="colorMode"');
		const styles = descriptor.styles.map(style => style.src ? readFileSync(resolve(process.cwd(), 'src/pages', style.src), 'utf8') : style.content).join('\n');
		expect(styles).toContain('[data-hatask-theme=\'akatsuki\'][data-hatask-mode=\'dark\']');
		for (const color of ['#fff7f2', '#2b1f2c', '#b02e56', '#1b1424', '#f6ecf3', '#ff7fa3']) expect(styles).toContain(color);
		const palettes = readFileSync(resolve(directory, 'hatask-themes.scss'), 'utf8');
		for (const theme of themes.slice(1)) expect(palettes).toMatch(new RegExp(`data-hatask-theme=["']?${theme}["']?`));
	});

	test('きもち・ごはんの入力にもテーマを渡し、既存の入力は維持する', () => {
		const { descriptor } = component('HataskJournal');
		const capture = descriptor.template?.content.match(/<HataskQuickCapture[\s\S]+?\/?>/u)?.[0];
		expect(capture).toContain(':theme="theme"');
		expect(capture).toContain('v-model="draft.note"');
		expect(capture).toContain(':mode="kind"');
	});

	test('淡いアクセントの白文字を陽性対照として検出し、採用した明暗の本文色は4.5を満たす', () => {
		expect(contrast('#ffffff', '#e0567a')).toBeLessThan(4.5);
		for (const [foreground, background] of [['#ffffff', '#b02e56'], ['#26101c', '#ff7fa3'], ['#6a5566', '#fff3ec'], ['#c8b5c6', '#1b1424']]) {
			expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
		}
	});

	test('白い通知数字には明暗共通の濃いバッジ背景を使う', () => {
		const layout = component('HataskAkatsukiLayout').descriptor.styles.map(style => style.src ? readFileSync(resolve(process.cwd(), 'src/pages', style.src), 'utf8') : style.content).join('\n');
		const apps = component('HataskAkatsukiApps').descriptor.styles.map(style => style.src ? readFileSync(resolve(process.cwd(), 'src/pages', style.src), 'utf8') : style.content).join('\n');
		const background = layout.match(/--hak-badge-bg:\s*(#[\da-f]{6});/iu)?.[1];
		expect(background).toBeDefined();
		if (!background) throw new Error('Missing notification badge color');
		expect(contrast('#ffffff', '#ff7fa3')).toBeLessThan(4.5);
		expect(contrast('#ffffff', background)).toBeGreaterThanOrEqual(4.5);
		expect(apps).toMatch(/\.countBadge\s*\{[^}]*background:\s*var\(--hak-badge-bg,\s*#b02e56\);[^}]*color:\s*#fff;/u);
	});
});

describe('Archivo の自己ホストと配布ライセンス', () => {
	const assets = resolve(process.cwd(), 'assets/fonts');
	const page = parse(readFileSync(resolve(process.cwd(), 'src/pages/hatask.vue'), 'utf8')).descriptor;
	const globalStyles = page.styles.filter(style => !style.scoped && !style.module).map(style => style.src ? readFileSync(resolve(process.cwd(), 'src/pages', style.src), 'utf8') : style.content).join('\n');
	const fontStyle = readFileSync(resolve(directory, 'hatask-fonts.scss'), 'utf8');
	const faces = fontStyle.match(/@font-face\s*\{[^}]+\}/gu)?.filter(face => face.includes("font-family: 'Archivo'")) ?? [];
	const originals = [
		{ file: 'archivo-latin-wght.woff2', bytes: 34928, sha256: '8f704806dbedeaaeca334b11ec348bc3ac3a439d6431544b3afb54f534ee4967' },
		{ file: 'archivo-latin-ext-wght.woff2', bytes: 32608, sha256: 'ff4f17d21930e36d6d93baba663e624cb767afc3feebf7adaebd82242638de05' },
		{ file: 'archivo-vietnamese-wght.woff2', bytes: 13240, sha256: '5a621c5598a31392555104ccdc41a46c3104f1cc22666024a8afb881ca9adaab' },
	];
	const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
	const localFontUrls = (style: string) => [...style.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/gu)].every(([, url]) => url.startsWith('/client-assets/fonts/archivo-') && url.endsWith('.woff2'));

	test('モックの400–900を含む可変ウェイトを通常幅で登録し、外部CDNは使わない', () => {
		expect(globalStyles).toContain('@use "../components/hatask/hatask-fonts.scss";');
		expect(localFontUrls("src: url('https://fonts.gstatic.com/archivo.woff2')")).toBe(false);
		expect(faces).toHaveLength(3);
		for (const face of faces) {
			expect(face).toContain('font-style: normal;');
			expect(face).toContain('font-weight: 100 900;');
			expect(face).toContain('font-stretch: 100%;');
			expect(face).toContain('font-display: swap;');
			expect(face).toContain('unicode-range:');
			expect(face.match(/url\(/gu)).toHaveLength(1);
			expect(localFontUrls(face)).toBe(true);
		}
	});

	test.each(originals)('$file は取得元と一致する未加工のWOFF2で、宣言から実在ファイルへ届く', original => {
		const bytes = readFileSync(resolve(assets, original.file));
		expect(bytes.toString('ascii', 0, 4)).toBe('wOF2');
		expect(bytes.readUInt32BE(8)).toBe(bytes.length);
		expect(bytes.length).toBe(original.bytes);
		expect(hash(bytes)).toBe(original.sha256);
		expect(faces.some(face => face.includes(`/client-assets/fonts/${original.file}`))).toBe(true);
		const corrupted = Buffer.from(bytes);
		corrupted[corrupted.length - 1] ^= 1;
		expect(hash(corrupted)).not.toBe(original.sha256);
	});

	test('著作権表示とOFL全文を原文のまま同梱し、本体のAGPLと区分する', () => {
		const license = readFileSync(resolve(assets, 'Archivo-OFL.txt'), 'utf8');
		const originalHash = '108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b';
		expect(license).toMatch(/^Copyright 2020 The Archivo Project Authors \(https:\/\/github.com\/Omnibus-Type\/Archivo\)/u);
		expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
		expect(hash(license)).toBe(originalHash);
		expect(hash(license.replace('PERMISSION & CONDITIONS', ''))).not.toBe(originalHash);
		const notice = readFileSync(resolve(assets, 'NOTICE.md'), 'utf8');
		expect(notice).toContain('[Archivo-OFL.txt](./Archivo-OFL.txt)');
		expect(notice).toContain('AGPL-3.0-onlyへ付け替えず');
		for (const original of originals) {
			expect(notice).toContain(original.file);
			expect(notice).toContain(original.sha256);
		}
		expect(readFileSync(resolve(process.cwd(), '../../LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
	});
});
