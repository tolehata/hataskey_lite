/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { HATASK_PHRASE_TRANSLATIONS, translateHataskPhrase } from './hatask-phrases-i18n.js';
import { getPhraseCount } from './hatask-phrases.js';

type Translation = {
	readonly en: string;
	readonly zh: string;
};

type TranslationTable = Readonly<Record<string, Translation>>;

const ENGLISH_FORBIDDEN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const UNSAFE_TEMPLATE_TOKEN = /(?:\$\{|`)/;
const SOURCE_START = 'const dawn = [';
const SOURCE_END = '\n\nexport type HataskPhrase =';

function extractSourcePhrases(source: string): string[] {
	const start = source.indexOf(SOURCE_START);
	const end = source.indexOf(SOURCE_END, start);
	if (start < 0 || end < 0) throw new Error('Hatask phrase data region was not found');
	const region = source.slice(start, end);
	return Array.from(region.matchAll(/\[([\s\S]*?)\]/g)).flatMap(block =>
		Array.from(block[1].matchAll(/'([^']*)'/g), match => match[1]),
	);
}

function duplicateEntries(values: readonly string[]): Array<[string, number]> {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return Array.from(counts.entries()).filter(([, count]) => count > 1).sort(([a], [b]) => a.localeCompare(b));
}

function missingKeys(sourcePhrases: readonly string[], table: TranslationTable): string[] {
	const translatedKeys = new Set(Object.keys(table));
	return Array.from(new Set(sourcePhrases)).filter(key => !translatedKeys.has(key)).sort();
}

function extraKeys(sourcePhrases: readonly string[], table: TranslationTable): string[] {
	const sourceKeys = new Set(sourcePhrases);
	return Object.keys(table).filter(key => !sourceKeys.has(key)).sort();
}

function emptyTranslationPaths(table: TranslationTable): string[] {
	return Object.entries(table).flatMap(([key, translation]) => [
		...(translation.en.trim() === '' ? [`${key}.en`] : []),
		...(translation.zh.trim() === '' ? [`${key}.zh`] : []),
	]);
}

function contaminatedTranslationPaths(table: TranslationTable): { en: string[]; zh: string[] } {
	return Object.entries(table).reduce<{ en: string[]; zh: string[] }>((result, [key, translation]) => {
		if (ENGLISH_FORBIDDEN_SCRIPT.test(translation.en)) result.en.push(key);
		if (SIMPLIFIED_CHINESE_FORBIDDEN_SCRIPT.test(translation.zh)) result.zh.push(key);
		return result;
	}, { en: [], zh: [] });
}

function unsafeTemplatePaths(table: TranslationTable): string[] {
	return Object.entries(table).flatMap(([key, translation]) => [
		...(UNSAFE_TEMPLATE_TOKEN.test(translation.en) ? [`${key}.en`] : []),
		...(UNSAFE_TEMPLATE_TOKEN.test(translation.zh) ? [`${key}.zh`] : []),
	]);
}

const source = readFileSync(resolve(process.cwd(), 'src/utility/hatask-phrases.ts'), 'utf8');
const sourcePhrases = extractSourcePhrases(source);
const translations: TranslationTable = HATASK_PHRASE_TRANSLATIONS;

describe('Hatask HataEye fixed-phrase translations', () => {
	test('原文は1,779件・1,776ユニークで、既知の3件だけが重複する', () => {
		expect(getPhraseCount()).toBe(1779);
		expect(sourcePhrases).toHaveLength(1779);
		expect(new Set(sourcePhrases).size).toBe(1776);
		const duplicates = new Map(duplicateEntries(sourcePhrases));
		expect(duplicates.size).toBe(3);
		expect(duplicates.get('一つずつ片付けよう')).toBe(2);
		expect(duplicates.get('手袋忘れないで')).toBe(2);
		expect(duplicates.get('明日は明日の風が吹く')).toBe(2);
	});

	test('辞書が原文1,776キーを過不足なく一度ずつ持つ', () => {
		expect(Object.keys(translations)).toHaveLength(1776);
		expect(missingKeys(sourcePhrases, translations)).toEqual([]);
		expect(extraKeys(sourcePhrases, translations)).toEqual([]);
	});

	test('翻訳に空値・対象外文字種・危険なテンプレートトークンがない', () => {
		expect(emptyTranslationPaths(translations)).toEqual([]);
		expect(contaminatedTranslationPaths(translations)).toEqual({ en: [], zh: [] });
		expect(unsafeTemplatePaths(translations)).toEqual([]);
	});

	test('日本語は原文を維持し、英語と簡体字は代表訳を返す', () => {
		const phrase = '完璧じゃなくていいよ';
		expect(translateHataskPhrase(phrase, 'ja-JP')).toBe(phrase);
		expect(translateHataskPhrase(phrase, 'en-US')).toBe("You don't have to be perfect.");
		expect(translateHataskPhrase(phrase, 'zh-CN')).toBe('不必做到完美。');
	});

	test('辞書にない利用者入力と予定タイトル本文を変更しない', () => {
		const userText = '利用者が入力した自由文';
		const schedule = '今日の予定: 四月の読書会';
		expect(translateHataskPhrase(userText, 'en-US')).toBe(userText);
		expect(translateHataskPhrase(userText, 'zh-CN')).toBe(userText);
		expect(translateHataskPhrase(schedule, 'ja-JP')).toBe(schedule);
		expect(translateHataskPhrase(schedule, 'en-US')).toBe("Today's schedule: 四月の読書会");
		expect(translateHataskPhrase(schedule, 'zh-CN')).toBe('今天的安排：四月の読書会');
	});

	test('改行で結合された固定文を行単位で翻訳する', () => {
		const compound = 'おはよう！今日もいい一日に\n一つずつ片付けよう';
		expect(translateHataskPhrase(compound, 'en-US')).toBe('Good morning! Let us make today a good one.\nTake care of them one at a time.');
		expect(translateHataskPhrase(compound, 'zh-CN')).toBe('早上好！愿今天也是美好的一天。\n一件一件处理吧。');
	});

	test('検出器の陽性対照が欠落・余剰・空値・文字種混入・テンプレート混入を検出する', () => {
		const firstKey = 'まだ暗いね、早起きさん';
		const missing = { ...translations } as Record<string, Translation>;
		delete missing[firstKey];
		expect(missingKeys(sourcePhrases, missing)).toEqual([firstKey]);

		const extra = { ...translations, __positive_extra__: { en: 'Extra', zh: '额外' } };
		expect(extraKeys(sourcePhrases, extra)).toEqual(['__positive_extra__']);

		const empty = { ...translations, [firstKey]: { en: ' ', zh: translations[firstKey].zh } };
		expect(emptyTranslationPaths(empty)).toEqual([`${firstKey}.en`]);

		const englishCjk = { ...translations, [firstKey]: { en: 'Open 設定', zh: translations[firstKey].zh } };
		expect(contaminatedTranslationPaths(englishCjk).en).toEqual([firstKey]);

		const chineseKana = { ...translations, [firstKey]: { en: translations[firstKey].en, zh: '打开セクション' } };
		expect(contaminatedTranslationPaths(chineseKana).zh).toEqual([firstKey]);

		const unsafeTemplate = { ...translations, [firstKey]: { en: '${unsafe}', zh: translations[firstKey].zh } };
		expect(unsafeTemplatePaths(unsafeTemplate)).toEqual([`${firstKey}.en`]);
	});
});
