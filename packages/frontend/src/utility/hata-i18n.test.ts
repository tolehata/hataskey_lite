/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';
import locales from '../../../../locales/index.js';

interface LocaleTree {
	[key: string]: string | LocaleTree;
}
type LeafEntry = [path: string, value: string];

const ENGLISH_FORBIDDEN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const EXCLUDED_FEATURE_PATH = /(?:^|\.)(?:_?hanaawase|_?hanatsune|_?machi|_?earthquake|_?tsunami)(?:\.|$)/i;
const HATA_I18N_REFERENCE = /i18n\.tsx?\._hata((?:\.[A-Za-z0-9_]+)+?)(?=\.(?:replace|replaceAll|toString|trim|split|startsWith|endsWith|includes|map|filter|join)\s*\(|\s|[,;:)}\]\[]|$)/g;
const LOCALE_STRING_MEMBERS = new Set([
	'at', 'charAt', 'endsWith', 'includes', 'indexOf', 'lastIndexOf', 'length', 'localeCompare', 'match', 'matchAll',
	'normalize', 'padEnd', 'padStart', 'replace', 'replaceAll', 'search', 'slice', 'split', 'startsWith', 'substring',
	'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toString', 'toUpperCase', 'trim', 'trimEnd', 'trimStart',
]);
const SHARED_CUSTOM_PATHS = [
	'cannotBlockOrMuteAdministrator',
	'goToAnnouncements',
	'maintenance',
	'_settings.cherrypickBanner',
	'_announcement.latest',
	'_announcement.pinned',
	'_announcement.pin',
	'_announcement.unpin',
	'_announcement.movePinUp',
	'_announcement.movePinDown',
	'_announcement.categoryInfo',
	'_announcement.categoryWarning',
	'_announcement.categorySuccess',
	'_announcement.categoryError',
	'_announcement.categoryMaintenance',
	'_announcement.maintenanceNote',
	'_achievements._types._hatasabaDeckTutorial.title',
	'_achievements._types._hatasabaDeckTutorial.description',
	'_achievements._types._welcomeToHatask.title',
	'_achievements._types._welcomeToHatask.description',
	'_achievements._types._welcomeToHatady.title',
	'_achievements._types._welcomeToHatady.description',
	'_achievements._types._hataSideStudioPioneer.title',
	'_achievements._types._hataSideStudioPioneer.description',
	'_achievements._types._hataSideStudioPioneer.flavor',
	'_achievements._types._hatacordingUiTutorial.title',
	'_achievements._types._hatacordingUiTutorial.description',
	'_achievements._types._setNameToHatacha.title',
	'_achievements._types._setNameToHatacha.description',
	'_widgets.externalNotifications',
	'_widgets.mascot',
	'_widgets.hataskFlowers',
	'_timelines.trending',
	'_trending.newNotesAvailable',
	'_trending.empty',
	'_notification.reactedToMultipleNotes',
	'_notification._types.hataFeed',
	'_notification._types.addedToPrivateChannel',
	'_notification._types.removedFromPrivateChannel',
	'_deck._columns.externalNotifications',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asLocaleTree(value: unknown, source: string): LocaleTree {
	if (!isRecord(value)) throw new TypeError(`${source} is not a locale object`);
	for (const [key, child] of Object.entries(value)) {
		if (typeof child !== 'string') asLocaleTree(child, `${source}.${key}`);
	}
	return value as LocaleTree;
}

function readHataLocale(code: 'ja-JP' | 'en-US' | 'zh-CN'): LocaleTree {
	const locale = readLocale(code);
	return asLocaleTree(locale._hata, code);
}

function readLocale(code: 'ja-JP' | 'en-US' | 'zh-CN'): Record<string, unknown> {
	const source = fs.readFileSync(path.resolve(process.cwd(), '../../locales', `${code}.yml`), 'utf8');
	const locale = load(source) as Record<string, unknown>;
	if (!isRecord(locale)) throw new TypeError(`${code} is not a locale object`);
	return locale;
}

function leafEntries(tree: LocaleTree, prefix = ''): LeafEntry[] {
	return Object.entries(tree).flatMap(([key, value]) => {
		const path = prefix === '' ? key : `${prefix}.${key}`;
		return typeof value === 'string' ? [[path, value]] : leafEntries(value, path);
	});
}

function leafMap(entries: LeafEntry[]): Map<string, string> {
	return new Map(entries);
}

function placeholders(value: string): string[] {
	return Array.from(value.matchAll(/\{([A-Za-z0-9_]+)\}/g), match => match[1]).sort();
}

function contaminatedPaths(entries: LeafEntry[], pattern: RegExp): string[] {
	return entries.filter(([, value]) => pattern.test(value)).map(([key]) => key);
}

function emptyPaths(entries: LeafEntry[]): string[] {
	return entries.filter(([, value]) => value.trim() === '').map(([key]) => key);
}

function excludedFeaturePaths(entries: LeafEntry[]): string[] {
	return entries.map(([key]) => key).filter(key => EXCLUDED_FEATURE_PATH.test(key));
}

function placeholderMismatches(reference: LeafEntry[], translated: LeafEntry[]): string[] {
	const translatedByPath = leafMap(translated);
	return reference.flatMap(([key, value]) => {
		const translatedValue = translatedByPath.get(key);
		return translatedValue == null || placeholders(value).join('\0') !== placeholders(translatedValue).join('\0') ? [key] : [];
	});
}

function sourceFiles(root: string): string[] {
	return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
		const absolute = path.join(root, entry.name);
		if (entry.isDirectory()) return sourceFiles(absolute);
		return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [absolute] : [];
	});
}

function localePathExists(tree: LocaleTree, localePath: string): boolean {
	let cursor: string | LocaleTree = tree;
	for (const segment of localePath.split('.').filter(Boolean)) {
		if (typeof cursor === 'string' || !(segment in cursor)) return false;
		cursor = cursor[segment];
	}
	return true;
}

/**
 * locale の葉文字列へ到達した後に続く `.replace()` などは JavaScript の操作なので、
 * locale 階層としては葉へ到達した時点で有効とみなす。
 */
function localeReferenceExists(tree: LocaleTree, localePath: string): boolean {
	let cursor: string | LocaleTree = tree;
	for (const segment of localePath.split('.').filter(Boolean)) {
		if (typeof cursor === 'string') return LOCALE_STRING_MEMBERS.has(segment);
		if (!(segment in cursor)) return false;
		cursor = cursor[segment];
	}
	return true;
}

function localeValue(tree: Record<string, unknown>, localePath: string): string | undefined {
	let cursor: unknown = tree;
	for (const segment of localePath.split('.').filter(Boolean)) {
		if (!isRecord(cursor) || !(segment in cursor)) return undefined;
		cursor = cursor[segment];
	}
	return typeof cursor === 'string' ? cursor : undefined;
}

function missingSourceReferences(tree: LocaleTree): string[] {
	const sourceRoot = path.resolve(process.cwd(), 'src');
	return sourceFiles(sourceRoot).flatMap(file => {
		if (file === path.resolve(process.cwd(), 'src/utility/hata-i18n.test.ts')) return [];
		const source = fs.readFileSync(file, 'utf8');
		return Array.from(source.matchAll(HATA_I18N_REFERENCE)).flatMap(match => {
			const localePath = match[1].slice(1);
			return localePathExists(tree, localePath)
				? []
				: [`${path.relative(process.cwd(), file)}: _hata.${localePath}`];
		});
	});
}

type LocaleAlias = {
	name: string;
	localePath: string;
	symbol: ts.Symbol;
};

type StaticTranslator = {
	name: string;
	localePath: string;
	symbol: ts.Symbol;
};

function staticMemberPath(node: ts.Expression): { root: ts.Identifier; members: string[] } | null {
	if (ts.isIdentifier(node)) return { root: node, members: [] };
	if (ts.isPropertyAccessExpression(node)) {
		const parent = staticMemberPath(node.expression);
		return parent == null ? null : { root: parent.root, members: [...parent.members, node.name.text] };
	}
	if (ts.isElementAccessExpression(node) && node.argumentExpression != null && ts.isStringLiteralLike(node.argumentExpression)) {
		const parent = staticMemberPath(node.expression);
		return parent == null ? null : { root: parent.root, members: [...parent.members, node.argumentExpression.text] };
	}
	return null;
}

function localeAliasPath(initializer: ts.Expression): string | null {
	const path = staticMemberPath(initializer);
	if (path == null || path.root.text !== 'i18n' || path.members.length < 3) return null;
	if ((path.members[0] !== 'ts' && path.members[0] !== 'tsx') || path.members[1] !== '_hata') return null;
	return path.members.slice(2).join('.');
}

function scriptBlocks(source: string, file: string): Array<{ source: string; lineOffset: number }> {
	if (!file.endsWith('.vue')) return [{ source, lineOffset: 0 }];
	return Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), match => ({
		source: match[1],
		lineOffset: source.slice(0, match.index! + match[0].indexOf(match[1])).split('\n').length - 1,
	}));
}

function templateBlock(source: string): string {
	return source
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, match => match.replace(/[^\n]/g, ' '))
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, match => match.replace(/[^\n]/g, ' '))
		.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));
}

function createSourceProgram(source: string, file: string): { sourceFile: ts.SourceFile; checker: ts.TypeChecker } {
	const isTsx = file.endsWith('.tsx');
	const virtualFile = `${file.replace(/\.(?:vue|tsx?)$/i, '')}.hata-i18n-audit.${isTsx ? 'tsx' : 'ts'}`;
	const options: ts.CompilerOptions = { noLib: true, noResolve: true, target: ts.ScriptTarget.Latest };
	const sourceFile = ts.createSourceFile(virtualFile, source, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
	const host = ts.createCompilerHost(options);
	host.fileExists = candidate => candidate === virtualFile;
	host.readFile = candidate => candidate === virtualFile ? source : undefined;
	host.getSourceFile = candidate => candidate === virtualFile ? sourceFile : undefined;
	const program = ts.createProgram([virtualFile], options, host);
	return { sourceFile, checker: program.getTypeChecker() };
}

function missingAliasedReferencesInSource(tree: LocaleTree, source: string, file: string): string[] {
	const missing: string[] = [];
	const templateAliases = new Map<string, Set<string>>();
	const templateTranslators = new Map<string, Set<string>>();

	for (const block of scriptBlocks(source, file)) {
		const { sourceFile, checker } = createSourceProgram(block.source, file);
		const aliases = new Map<ts.Symbol, LocaleAlias>();
		const translators = new Map<ts.Symbol, StaticTranslator>();

		const collectAliases = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer != null) {
				const localePath = localeAliasPath(node.initializer);
				const symbol = localePath == null ? undefined : checker.getSymbolAtLocation(node.name);
				if (localePath != null && symbol != null) {
					const alias = { name: node.name.text, localePath, symbol };
					aliases.set(symbol, alias);
					const paths = templateAliases.get(alias.name) ?? new Set<string>();
					paths.add(alias.localePath);
					templateAliases.set(alias.name, paths);
				}
			}
			ts.forEachChild(node, collectAliases);
		};
		collectAliases(sourceFile);

		const collectTranslators = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node) && node.name?.text === 't' && node.body != null) {
				const symbol = checker.getSymbolAtLocation(node.name);
				const referencedAliases = new Set<LocaleAlias>();
				const findAlias = (child: ts.Node): void => {
					if (ts.isIdentifier(child)) {
						const alias = aliases.get(checker.getSymbolAtLocation(child)!);
						if (alias != null) referencedAliases.add(alias);
					}
					ts.forEachChild(child, findAlias);
				};
				findAlias(node.body);
				if (symbol != null && referencedAliases.size === 1) {
					const [alias] = referencedAliases;
					const translator = { name: node.name.text, localePath: alias.localePath, symbol };
					translators.set(symbol, translator);
					const paths = templateTranslators.get(translator.name) ?? new Set<string>();
					paths.add(translator.localePath);
					templateTranslators.set(translator.name, paths);
				}
			}
			ts.forEachChild(node, collectTranslators);
		};
		collectTranslators(sourceFile);

		const inspect = (node: ts.Node): void => {
			if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && !(
				(ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) && node.parent.expression === node
			)) {
				const path = staticMemberPath(node);
				const alias = path == null ? undefined : aliases.get(checker.getSymbolAtLocation(path.root)!);
				if (alias != null && path!.members.length > 0) {
					const localePath = [alias.localePath, ...path!.members].join('.');
					if (!localeReferenceExists(tree, localePath)) {
						const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 + block.lineOffset;
						missing.push(`${file}:${line}: _hata.${localePath}`);
					}
				}
			}
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
				const translator = translators.get(checker.getSymbolAtLocation(node.expression)!);
				if (translator != null) {
					const localePath = `${translator.localePath}.${node.arguments[0].text}`;
					if (!localePathExists(tree, localePath)) {
						const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 + block.lineOffset;
						missing.push(`${file}:${line}: _hata.${localePath}`);
					}
				}
			}
			ts.forEachChild(node, inspect);
		};
		inspect(sourceFile);
	}

	if (file.endsWith('.vue')) {
		const template = templateBlock(source);
		for (const [alias, paths] of templateAliases) {
			if (paths.size !== 1) continue;
			const [basePath] = paths;
			// ⚠️`\b` は `.` の直後でも成立するため、
			//   `editor.copy.x` の `copy` を局所別名 `copy` と取り違える。
			//   別名は「単独の識別子として現れたとき」だけ拾う。
			const reference = new RegExp(`(?<![\\w$.])${alias}((?:\\.[A-Za-z_$][\\w$]*)+)`, 'g');
			for (const match of template.matchAll(reference)) {
				const localePath = `${basePath}.${match[1].slice(1)}`;
				if (!localeReferenceExists(tree, localePath)) {
					const line = template.slice(0, match.index).split('\n').length;
					missing.push(`${file}:${line}: _hata.${localePath}`);
				}
			}
		}
		for (const [translator, paths] of templateTranslators) {
			if (paths.size !== 1) continue;
			const [basePath] = paths;
			const call = new RegExp(`\\b${translator}\\(\\s*['\"]([A-Za-z0-9_]+)['\"]\\s*\\)`, 'g');
			for (const match of template.matchAll(call)) {
				const localePath = `${basePath}.${match[1]}`;
				if (!localePathExists(tree, localePath)) {
					const line = template.slice(0, match.index).split('\n').length;
					missing.push(`${file}:${line}: _hata.${localePath}`);
				}
			}
		}
	}

	return missing;
}

function missingAliasedSourceReferences(tree: LocaleTree): string[] {
	const sourceRoot = path.resolve(process.cwd(), 'src');
	return sourceFiles(sourceRoot).flatMap(file => {
		if (file === path.resolve(process.cwd(), 'src/utility/hata-i18n.test.ts')) return [];
		return missingAliasedReferencesInSource(tree, fs.readFileSync(file, 'utf8'), path.relative(process.cwd(), file));
	});
}

function withoutReferenceLine(reference: string): string {
	return reference.replace(/:\d+:/, ':');
}

describe('旗鯖独自機能の翻訳', () => {
	const japanese = leafEntries(readHataLocale('ja-JP'));
	const english = leafEntries(readHataLocale('en-US'));
	const simplifiedChinese = leafEntries(readHataLocale('zh-CN'));
	const expectedKeys = japanese.map(([key]) => key).sort();

	test('英語と簡体字が日本語正本と同じ葉キーをすべて持つ', () => {
		expect(english.map(([key]) => key).sort()).toEqual(expectedKeys);
		expect(simplifiedChinese.map(([key]) => key).sort()).toEqual(expectedKeys);
	});

	test('翻訳値が空ではない', () => {
		expect(emptyPaths(japanese)).toEqual([]);
		expect(emptyPaths(english)).toEqual([]);
		expect(emptyPaths(simplifiedChinese)).toEqual([]);
	});

	test('英語へCJK文字が混入せず、簡体字へ日本語かなが混入していない', () => {
		expect(contaminatedPaths(english, ENGLISH_FORBIDDEN_SCRIPT)).toEqual([]);
		expect(contaminatedPaths(simplifiedChinese, SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT)).toEqual([]);
	});

	test('英語と簡体字のプレースホルダが日本語正本と一致する', () => {
		expect(placeholderMismatches(japanese, english)).toEqual([]);
		expect(placeholderMismatches(japanese, simplifiedChinese)).toEqual([]);
	});

	test('翻訳対象外の機能を独自翻訳名前空間へ混在させない', () => {
		expect(excludedFeaturePaths(japanese)).toEqual([]);
		expect(excludedFeaturePaths(english)).toEqual([]);
		expect(excludedFeaturePaths(simplifiedChinese)).toEqual([]);
	});

	test('build後の全29言語で独自翻訳名前空間と全葉キーを参照できる', () => {
		const builtLocales = Object.entries(locales);
		expect(builtLocales).toHaveLength(29);
		for (const [code, locale] of builtLocales) {
			const hata = asLocaleTree((locale as unknown as Record<string, unknown>)._hata, code);
			expect(leafEntries(hata).map(([key]) => key).sort(), code).toEqual(expectedKeys);
		}
	});

	test('ソースから直接参照する独自翻訳パスが日本語正本に存在する', () => {
		expect(missingSourceReferences(readHataLocale('ja-JP'))).toEqual([]);
	});

	// ⚠️TypeScript の型検査器を起こして全ソースを辿るため、単体でも約5秒かかる。
	//   既定の5秒だと全体実行（並列）で必ず時間切れになり、
	//   ⚠️「翻訳が欠けている」という誤った読み方をされる。実測に合わせて広げる。
	test('ソースから別名と静的翻訳関数で参照する独自翻訳パスが日本語正本に存在する', () => {
		expect(missingAliasedSourceReferences(readHataLocale('ja-JP'))).toEqual([]);
	}, 60000);

	test('共通名前空間に置く独自機能の表示文も3言語で揃っている', () => {
		const ja = readLocale('ja-JP');
		const en = readLocale('en-US');
		const zh = readLocale('zh-CN');
		for (const localePath of SHARED_CUSTOM_PATHS) {
			const jaValue = localeValue(ja, localePath);
			const enValue = localeValue(en, localePath);
			const zhValue = localeValue(zh, localePath);
			expect(jaValue, `ja-JP: ${localePath}`).toBeTypeOf('string');
			expect(enValue, `en-US: ${localePath}`).toBeTypeOf('string');
			expect(zhValue, `zh-CN: ${localePath}`).toBeTypeOf('string');
			expect(placeholders(enValue ?? ''), `en-US: ${localePath}`).toEqual(placeholders(jaValue ?? ''));
			expect(placeholders(zhValue ?? ''), `zh-CN: ${localePath}`).toEqual(placeholders(jaValue ?? ''));
			expect(ENGLISH_FORBIDDEN_SCRIPT.test(enValue ?? ''), `en-US: ${localePath}`).toBe(false);
			expect(SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT.test(zhValue ?? ''), `zh-CN: ${localePath}`).toBe(false);
		}
	});

	test('検出器の陽性対照が空文字・文字種混入・プレースホルダ不一致・対象外機能を検出する', () => {
		expect(emptyPaths([['broken.empty', ' 　']])).toEqual(['broken.empty']);
		expect(contaminatedPaths([['broken.english', 'Open 設定']], ENGLISH_FORBIDDEN_SCRIPT)).toEqual(['broken.english']);
		expect(contaminatedPaths([['broken.chinese', '打开セクション']], SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT)).toEqual(['broken.chinese']);
		expect(placeholderMismatches(
			[['broken.placeholder', '{count} / {total}']],
			[['broken.placeholder', '{count} / {limit}']],
		)).toEqual(['broken.placeholder']);
		expect(excludedFeaturePaths([['hanaawase.title', '花常']])).toEqual(['hanaawase.title']);
		expect(localePathExists({ valid: { leaf: 'ok' } }, 'missing.leaf')).toBe(false);
		expect(localeValue({ valid: { leaf: 'ok' } }, 'missing.leaf')).toBeUndefined();
	});

	test('別名・静的翻訳関数の参照検出器が欠落を検出し、シャドーイングを誤検出しない', () => {
		const fixture = `
<template>
	<div>{{ copy.missingTemplate }}</div>
	<div>{{ t('missingTemplateCall') }}</div>
</template>
<script setup lang="ts">
const copy = i18n.ts._hata.valid;
copy.present;
copy.missingScript;
copy.present.replace('{value}', 'ok');
function t(key: string) { return copy[key] ?? key; }
t('present');
t('missingScriptCall');
function shadowed(copy: { notLocale: string }) { return copy.notLocale; }
</script>`;
		expect(missingAliasedReferencesInSource({ valid: { present: '{value}' } }, fixture, 'positive.vue').map(withoutReferenceLine).sort()).toEqual([
			'positive.vue: _hata.valid.missingScript',
			'positive.vue: _hata.valid.missingScriptCall',
			'positive.vue: _hata.valid.missingTemplate',
			'positive.vue: _hata.valid.missingTemplateCall',
		]);
	});
});
