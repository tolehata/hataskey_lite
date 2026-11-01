/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '../..');
const archiveRoot = resolve(repositoryRoot, 'archive/hanaawase');
const readSource = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function filesIn(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = resolve(directory, entry.name);
		return entry.isDirectory() ? filesIn(path) : [path];
	});
}

const archivedPaths = filesIn(archiveRoot)
	.map(path => relative(archiveRoot, path).split(sep).join('/'))
	.sort();

function activeReferences(source: string): string[] {
	return source.match(/hanaawase|hanatsune|花常|はなつね/gi) ?? [];
}

describe('花常のソース保管と実行・配信からの切り離し', () => {
	test('専用300ファイルの内容を移動前のSHA-256集約値と照合する', () => {
		expect(archivedPaths).toHaveLength(300);
		const manifest = archivedPaths.map(path => `${sha256(readFileSync(resolve(archiveRoot, path)))}  archive/hanaawase/${path}\n`).join('');
		expect(sha256(manifest)).toBe('6498aeea82d5bcea3ab88c303198642749954f7a536c7c1b05cabbe5b88cbacb');
		// 陽性対照はファイルを変更せず、照合対象のメモリ上のコピーだけを壊す。
		expect(sha256(`${manifest}unexpected-file\n`)).not.toBe(sha256(manifest));
	});

	test('保管した各ファイルは以前の実行・配信パスに残っていない', () => {
		for (const path of archivedPaths) expect(existsSync(resolve(repositoryRoot, path)), path).toBe(false);
		expect(archivedPaths.filter(path => path.startsWith('packages/frontend/src/pages/hanaawase/'))).toHaveLength(82);
		expect(archivedPaths.filter(path => path.startsWith('packages/frontend/assets/'))).toHaveLength(209);
	});

	test('導線・専用API・Registryカテゴリ・Meta再結線の陽性対照を検出する', () => {
		for (const source of [
			"path: '/hanaawase'",
			"import('@/pages/admin/games/hanaawase.vue')",
			"export * as 'games/hanaawase/event-index' from './endpoints/games/hanaawase/event-index.js'",
			"id: 'tool:hanaawase'",
			"scope: ['client', 'hanaawase']",
			'public hanaawaseEventIndex: HanaawaseEventIndex',
			'花常（はなつね）',
		]) expect(activeReferences(source).length).toBeGreaterThan(0);
	});

	test.each([
		'packages/frontend/src/router.definition.ts',
		'packages/frontend/src/pages/games.vue',
		'packages/frontend/src/pages/admin/index.vue',
		'packages/frontend/src/pages/hata-docs.vue',
		'packages/frontend/src/utility/hata-settings-transfer.ts',
		'packages/frontend/src/utility/hata-icon-motion.ts',
		'packages/frontend/src/utility/hata-whats-new.ts',
		'packages/backend/src/server/api/endpoint-list.ts',
		'packages/backend/src/models/Meta.ts',
	])('%s に花常の実行接続を残さない', path => {
		expect(activeReferences(readSource(path))).toEqual([]);
	});

	test('専用APIの登録除去がHTTPルートとNest providerの両方に反映される構造を維持する', () => {
		const endpointList = readSource('packages/backend/src/server/api/endpoint-list.ts');
		expect(endpointList).toContain("export * as 'i/registry/get'");
		expect(endpointList).toContain("export * as 'i/registry/set'");
		expect(readSource('packages/backend/src/server/api/EndpointsModule.ts')).toContain("import * as endpointsObject from './endpoint-list.js'");
		expect(readSource('packages/backend/src/server/api/endpoints.ts')).toContain("import * as endpointsObject from './endpoint-list.js'");
		expect(readSource('packages/backend/src/server/api/ApiServerService.ts')).toContain('for (const endpoint of endpoints)');
	});

	test('元のmigrationを変更せず、通常起動の自動schema削除を無効のままにする', () => {
		const migration = readSource('packages/backend/migration/1787700000000-add-hanaawase-event-index.js');
		expect(sha256(migration)).toBe('3d83ad84b2a0703cb18c0496740757db315e3f9be5de68a7525b6de7d6143351');
		const postgres = readSource('packages/backend/src/postgres.ts');
		expect(postgres).toContain("synchronize: process.env.NODE_ENV === 'test'");
		expect(postgres).toContain("dropSchema: process.env.NODE_ENV === 'test'");
	});

	test('保管ディレクトリとローカル開発書類をDockerから、保管ファイルを公開tarballから除外する', () => {
		const ignored = readSource('.dockerignore').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
		expect(ignored).toContain('archive/hanaawase/');
		expect(ignored).toContain('packages/frontend/hanaawase/');
		expect(ignored).toContain('temp/');
		expect(readSource('scripts/tarball.mjs')).toContain("'archive/hanaawase/**'");
		expect(archiveRoot.startsWith(`${resolve(repositoryRoot, 'packages/frontend/assets')}${sep}`)).toBe(false);
		expect(readSource('packages/icons-subsetter/src/generator.ts')).toContain("frontend: 'packages/frontend/src/**/*.{ts,vue,js}'");
	});
});
