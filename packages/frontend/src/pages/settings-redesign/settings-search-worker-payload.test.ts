/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 検索ワーカーへ渡す荷物が「複製できる形」であることを見張る。
 *
 * ⚠️実際に起きた不具合が2つある。どちらもワーカーが起動できず、
 *   設定検索が丸ごと使えなくなっていた。Firefox のコンソールで判明した。
 *
 *   1. `ReferenceError: window is not defined`
 *      ワーカーの依存が `@@/js/config.js` まで辿り着き、その先頭で
 *      `window.document` を触っていた。⚠️ワーカーに window は無い。
 *
 *   2. `DOMException: Proxy object could not be cloned.`
 *      props 越しの catalog は Vue のリアクティブなプロキシ。
 *      ⚠️postMessage の構造化複製はプロキシを複製できない。
 */

import { describe, expect, test } from 'vitest';
import panelSource from './SettingsSearchPanel.vue?raw';
import workerSource from '@/workers/settings-search-v2.ts?raw';
import configSource from '@@/js/config.ts?raw';

describe('settings search worker payload', () => {
	test('検出器が生きている（ソースを実際に読めている）', () => {
		// ⚠️陽性対照。空なら以降の判定は何も見ていない。
		expect(panelSource).toContain('postMessage');
		expect(workerSource).toContain('initialize');
		expect(configSource.length).toBeGreaterThan(200);
	});

	test('⚠️catalog は toRaw で生に戻してから送る', () => {
		// ⚠️プロキシのまま渡すと postMessage が例外を投げ、
		//   ワーカーの初期化ごと失敗して検索が使えなくなる。
		expect(panelSource).toContain('const rawCatalog = toRaw(props.catalog);');
		expect(panelSource).toContain('descriptors: toRaw(rawCatalog.descriptors).map(');
		// ⚠️入れ子の配列も複製できる形にすること。
		expect(panelSource).toContain('related: toRaw(descriptor).related.map(relation => ({ ...toRaw(relation) })),');
		// ⚠️生に戻さず直接渡す書き方が復活していないこと。
		expect(panelSource).not.toContain('descriptors: props.catalog.descriptors,');
	});

	test('⚠️共有configはワーカーでも読める（windowを直に触らない）', () => {
		// ⚠️このファイルはワーカーの依存に入る。モジュール先頭で window を触ると
		//   ワーカー全体が読み込めなくなる。
		expect(configSource).toContain("const hasWindow = typeof window !== 'undefined';");
		// ⚠️`window.` を無防備に書いた行が無いこと（hasWindow の分岐内だけ許す）。
		// ⚠️三項演算子で改行した続きの行も安全なので、直前の行まで見て判定する。
		const lines = configSource.split('\n');
		const bare = lines.filter((line, index) => {
			if (!/(?<![\w.])window\./u.test(line)) return false;
			const trimmed = line.trimStart();
			if (trimmed.startsWith('*') || trimmed.startsWith('//')) return false;
			const context = [lines[index - 2] ?? '', lines[index - 1] ?? '', line].join(' ');
			return !context.includes('hasWindow');
		});
		expect(bare).toEqual([]);
	});
});
