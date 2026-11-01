/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import _Ajv from 'ajv';
import { describe, expect, test } from 'vitest';

const Ajv = _Ajv.default;

/*
 * 旗鯖fork(Hatady): 「映画を保存できない」の原因になった罠を再発させないための構造テスト。
 *
 * ⚠️Ajv の `nullable: true` は type の判定を緩めるだけで、`enum` は独立に評価される。
 *   そのため { type: 'string', enum: ['a','b'], nullable: true } に null を送ると enum で弾かれる。
 *   本家 Misskey は enum 側にも null を入れて回避している(notes/create の reactionAcceptance 等)。
 *   フォークの hata 系エンドポイントはこれを落としていたため、既定値が null の項目
 *   (映画の origin / viewingMode)を持つ作品は一度も作成できなかった。
 */
describe('hata endpoints: nullable enum params actually accept null', () => {
	const endpointsDir = join(dirname(fileURLToPath(import.meta.url)), '../../src/server/api/endpoints/hata');

	function collect(dir: string): string[] {
		return readdirSync(dir).flatMap(name => {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) return collect(full);
			return name.endsWith('.ts') ? [full] : [];
		});
	}

	const files = collect(endpointsDir);

	test('the endpoint set is actually being scanned', () => {
		expect(files.length).toBeGreaterThan(20);
	});

	test('every nullable enum lists null among its allowed values', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			source.split('\n').forEach((line, index) => {
				if (!line.includes('nullable: true') || !line.includes('enum: [')) return;
				// items の enum は配列の中身の話で、nullable は配列側に付いている。別物なので対象外。
				if (line.includes('items:')) return;
				// `optional:` を持つのは応答スキーマ(Misskey独自の方言)。Ajv で検証されないので対象外。
				if (line.includes('optional:')) return;
				const body = /enum: \[([^\]]*)\]/.exec(line)?.[1];
				if (body == null) return;
				if (body.split(',').some(value => value.trim() === 'null')) return;
				offenders.push(`${relative(endpointsDir, file)}:${index + 1}`);
			});
		}
		expect(offenders, 'nullable enums missing null (null would be rejected by Ajv)').toEqual([]);
	});

	// 上のルールが「なぜ必要か」を Ajv の実挙動で固定する。ここが変わればルール自体を見直す合図。
	test('ajv rejects null for a nullable enum unless null is listed', () => {
		const ajv = new Ajv({ useDefaults: true });
		const withoutNull = ajv.compile({ type: 'object', properties: { v: { type: 'string', enum: ['a'], nullable: true } } });
		const withNull = ajv.compile({ type: 'object', properties: { v: { type: 'string', enum: ['a', null], nullable: true } } });
		expect(withoutNull({ v: null })).toBe(false);
		expect(withNull({ v: null })).toBe(true);
		expect(withNull({ v: 'a' })).toBe(true);
		expect(withNull({ v: 'b' })).toBe(false);
	});
});
