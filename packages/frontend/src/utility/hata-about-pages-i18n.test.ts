/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, test } from 'vitest';
import effectiveLocales from '../../../../locales/index.js';

const frontendSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
const locale = (code: string) => (load(fs.readFileSync(path.resolve(process.cwd(), '../../locales', `${code}.yml`), 'utf8')) ?? {}) as {
	aboutMisskey: string;
	poweredByMisskeyDescription?: string;
	_hata: {
		_aboutHataskey: Record<string, string>;
		_serverInfo: Record<string, string>;
	};
};

function serverDescriptionIssues(description: unknown): string[] {
	if (typeof description !== 'string') return ['missing description'];
	const issues: string[] = [];
	if (!description.includes('<b>Hataskey</b>')) issues.push('platform markup');
	if (/CherryPick|Misskey|ميسكي/i.test(description)) issues.push('old platform name');
	if (description.match(/\{name\}/g)?.length !== 1) issues.push('server name placeholder');
	return issues;
}

describe('Hataskey・サーバー情報ページの共通言語対応', () => {
	test('サーバー説明の旧ブランド・閉じタグ・プレースホルダーの違反を検出する', () => {
		expect(serverDescriptionIssues('{name} <b>Hataskey</b>')).toEqual([]);
		for (const broken of [
			'{name} <b>CherryPick</b> (CherryPick instance)',
			'{name} <b>ميسكي</b> (ميسكي)',
			'{name} <b>Hataskey</b> (CherryPick instance)',
			'{name} <b>Hataskey<b>',
			'<b>Hataskey</b>',
			undefined,
		]) {
			expect(serverDescriptionIssues(broken).length).toBeGreaterThan(0);
		}
	});

	test('全翻訳ファイルのサーバー説明がHataskeyを案内する', () => {
		const descriptions = fs.readdirSync(path.resolve(process.cwd(), '../../locales'))
			.filter(file => file.endsWith('.yml'))
			.map(file => [file, locale(file.slice(0, -4)).poweredByMisskeyDescription] as const)
			.filter(([, description]) => description !== undefined);
		expect(descriptions.length).toBeGreaterThan(0);
		for (const [file, description] of descriptions) {
			expect(serverDescriptionIssues(description), file).toEqual([]);
		}
	});

	test('未翻訳のフォールバックを含む全有効言語でHataskeyを案内する', () => {
		expect(Object.keys(effectiveLocales).length).toBeGreaterThan(0);
		for (const [code, translation] of Object.entries(effectiveLocales)) {
			expect(serverDescriptionIssues(translation.poweredByMisskeyDescription), code).toEqual([]);
		}
		expect(locale('da-DK').poweredByMisskeyDescription).toBeUndefined();
		expect(effectiveLocales['da-DK'].poweredByMisskeyDescription).toBe(effectiveLocales['en-US'].poweredByMisskeyDescription);
	});

	test('Hataskeyについての固有説明を共通localeから表示する', () => {
		const source = frontendSource('src/pages/about-misskey.vue');
		expect(source).toContain('{{ copy.about }}');
		expect(source).toContain('{{ copy.basedOnMisskey }}');
		expect(source).toContain('{{ copy.specialThanksMisskey }}');
		expect(source).toContain('title: copy.title');
		expect(locale('ja-JP').aboutMisskey).toBe('Hataskeyについて');
		expect(locale('en-US').aboutMisskey).toBe('About Hataskey');
		expect(locale('zh-CN').aboutMisskey).toBe('关于 Hataskey');
	});

	test('ローカル・連合先のサーバー情報に固定英語を残さない', () => {
		const overview = frontendSource('src/pages/about.overview.vue');
		const federation = frontendSource('src/pages/about.federation.vue');
		const remote = frontendSource('src/pages/instance-info.vue');

		expect(overview).toContain('i18n.tsx.poweredByMisskeyDescription({ name: instance.name ?? host })');
		expect(overview).toContain('{{ serverInfoCopy.wellKnownResources }}');
		expect(federation).toContain('i18n.tsx._hata._serverInfo.status({ status: getStatus(instance) })');
		expect(remote).toContain('{{ serverInfoCopy.refreshMetadata }}');
		expect(remote).toContain('{{ serverInfoCopy.wellKnownResources }}');
		expect(remote).toContain('title: serverInfoCopy.rawData');
		expect(remote).not.toMatch(/>\s*(?:Host|Moderation|Refresh metadata|Following \(Pub\)|Followers \(Sub\)|Well-known resources|Raw)\s*</);
	});

	test('3言語の旗鯖固有キーとプレースホルダーが一致する', () => {
		const locales = ['ja-JP', 'en-US', 'zh-CN'].map(code => locale(code)._hata);
		const aboutKeys = Object.keys(locales[0]._aboutHataskey).sort();
		const serverInfoKeys = Object.keys(locales[0]._serverInfo).sort();
		for (const item of locales.slice(1)) {
			expect(Object.keys(item._aboutHataskey).sort()).toEqual(aboutKeys);
			expect(Object.keys(item._serverInfo).sort()).toEqual(serverInfoKeys);
			expect(item._serverInfo.lastPosted).toContain('{date}');
			expect(item._serverInfo.status).toContain('{status}');
		}
	});
});
