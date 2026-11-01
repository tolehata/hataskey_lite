/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('ハタキュアセットのライセンス表記', () => {
	const notice = readFileSync(resolve(process.cwd(), 'assets/hatakyu/NOTICE.md'), 'utf8');

	test('アセット全体をAGPL-3.0-onlyとして明示する', () => {
		expect(notice).toContain('すべての PNG 画像');
		expect(notice).toContain('AGPL-3.0-only');
		expect(notice).toContain('GNU Affero General Public License version 3 only');
	});

	test('権利者・ライセンサーをniganigafish.として明示する', () => {
		expect(notice).toContain('権利者・ライセンサー: **niganigafish.**');
	});

	test('ほかのアセットへ条件を広げない', () => {
		expect(notice).toContain('ハタキュ以外');
		expect(notice).toContain('それぞれのファイルまたは同梱NOTICE');
	});
});
