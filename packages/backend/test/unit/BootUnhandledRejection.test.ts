/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const bootFiles = ['boot.js', 'boot.embed.js'];

describe('ブートローダーの未処理Promise拒否', () => {
	for (const file of bootFiles) {
		test(`${file}はレート制限を致命的な起動失敗へ昇格させない`, () => {
			const source = readFileSync(resolve(process.cwd(), 'src/server/web', file), 'utf8');
			const handlerStart = source.indexOf('window.onunhandledrejection');
			const guard = source.indexOf('if (isExpectedRateLimitRejection(e))', handlerStart);
			const render = source.indexOf('renderError(\'SOMETHING_HAPPENED_IN_PROMISE\'', handlerStart);

			expect(source).toContain('code === \'RATE_LIMIT_EXCEEDED\'');
			expect(source).toContain('code === \'BRIEF_REQUEST_INTERVAL\'');
			expect(source.slice(guard, render)).toContain('e.preventDefault();');
			expect(guard).toBeGreaterThan(handlerStart);
			expect(render).toBeGreaterThan(guard);
		});
	}
});
