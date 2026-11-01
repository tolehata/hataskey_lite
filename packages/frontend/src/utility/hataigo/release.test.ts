/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { hataigoSourceLink, hataigoSourceUrl } from './source.js';

const root = process.cwd();

async function files(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...await files(path));
		else if (!entry.name.endsWith('.test.ts')) result.push(path);
	}
	return result;
}

const forbidden = /cdn\.jsdelivr\.net|unpkg\.com|support\.js|Modernist|\b(?:isDonor|policies|rolePolicies)\b|\.roles\b/;

test('release detector catches each positive control before scanning shipped HataIgo sources', async () => {
	for (const control of ['https://cdn.jsdelivr.net/icon', 'https://unpkg.com/vue', 'support.js', 'Modernist', 'user.isDonor', 'policies.rateLimit', 'rolePolicies', 'user.roles']) expect(forbidden.test(control), control).toBe(true);
	const runtime = (await Promise.all(['src/utility/hataigo', 'src/pages/hataigo', 'src/components/hataigo'].map(path => files(resolve(root, path))))).flat();
	// 空のディレクトリを走査して「0件」で通るのを防ぐ下限（詰碁を外して実数は 45 本）
	expect(runtime.length).toBeGreaterThan(40);
	for (const path of runtime) {
		expect(forbidden.test(await readFile(path, 'utf8')), relative(root, path)).toBe(false);
		expect(path, 'handoff fonts must not be copied into HataIgo assets').not.toMatch(/\.woff2?$/);
	}
});

test('source link identifies only a clean exact commit or explicitly supplied archive', () => {
	const commit = 'a'.repeat(40);
	expect(hataigoSourceUrl(undefined, 'git@github.com:tolehata/hataskey.git', commit, true)).toBe(`https://github.com/tolehata/hataskey/tree/${commit}`);
	expect(hataigoSourceUrl(undefined, 'https://github.com/tolehata/hataskey', commit, false)).toBeNull();
	expect(hataigoSourceUrl(undefined, 'https://github.com/tolehata/hataskey', 'unknown', true)).toBeNull();
	expect(hataigoSourceUrl(undefined, 'https://attacker.invalid/tolehata/hataskey', commit, true)).toBeNull();
	expect(hataigoSourceUrl('https://sources.example/build-123.tar.gz', '', 'unknown', false)).toBe('https://sources.example/build-123.tar.gz');
	for (const value of ['javascript:alert(1)', 'https://token@example.org/source', '/source', 'http://example.org/source']) expect(hataigoSourceUrl(value, '', commit, true)).toBeNull();
});

test('source link falls back to the admin repository URL, and shows the unset text only when neither exists', () => {
	const exact = `https://github.com/tolehata/hataskey/tree/${'a'.repeat(40)}`;
	expect(hataigoSourceLink(exact, 'https://github.com/tolehata/hataskey')).toEqual({ url: exact, exact: true });
	expect(hataigoSourceLink(null, 'https://github.com/tolehata/hataskey')).toEqual({ url: 'https://github.com/tolehata/hataskey', exact: false });
	expect(hataigoSourceLink(undefined, null)).toBeNull();
	for (const value of ['javascript:alert(1)', 'https://token@example.org/source', 'not a url', '']) expect(hataigoSourceLink(null, value), value).toBeNull();
});

test('public help and credits contain no internal legal analysis or prohibited identifiers', async () => {
	const pattern = /JP\d{7}|US\d{7}|特許\s*\d{7}|HATAIGO-CONSTRAINTS|HATAIGO-HANDOFF/;
	for (const text of ['JP1234567', 'US1234567', '特許1234567', 'HATAIGO-CONSTRAINTS', 'HATAIGO-HANDOFF']) expect(pattern.test(text)).toBe(true);
	for (const file of ['src/components/hataigo/HataigoInfo.vue', 'src/utility/hataigo/lessons.ts', 'assets/CREDITS.md']) expect(await readFile(resolve(root, file), 'utf8')).not.toMatch(pattern);
});

test('Docker context excludes the private requirement and design directory', async () => {
	const rules = (await readFile(resolve(root, '../../.dockerignore'), 'utf8')).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
	const excluded = (path: string, patterns: string[]) => patterns.some(pattern => pattern === 'packages/frontend/hataigo/' && path.startsWith(pattern));
	const fixture = 'packages/frontend/hataigo/design/support.js';
	expect(excluded(fixture, [])).toBe(false);
	expect(excluded(fixture, ['packages/frontend/hataigo/'])).toBe(true);
	for (const path of [fixture, 'packages/frontend/hataigo/HATAIGO-CONSTRAINTS.md', 'packages/frontend/hataigo/design/font.woff2']) expect(excluded(path, rules), path).toBe(true);
	expect(rules.some(rule => rule.startsWith('!packages/frontend/hataigo'))).toBe(false);
	expect(excluded('packages/frontend/src/pages/hataigo/index.vue', rules)).toBe(false);
});
