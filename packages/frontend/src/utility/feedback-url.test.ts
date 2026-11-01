/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { defaultFeedbackUrl, resolveFeedbackUrl } from './feedback-url.js';

describe('Hataskey feedback destination', () => {
	test.each([
		'https://github.com/tolehata/hataskey/issues',
		'https://github.com/kokonect-link/cherrypick/issues/new',
		'https://code.tolehata.net/hatacha/cherrypick-hata/issues',
		'https://code.tolehata.net/hatacha/cherrypick-hata/issues/new',
	])('旧既定URLだけを新規Issueへ読み替える: %s', url => {
		expect(resolveFeedbackUrl(url)).toBe('https://github.com/tolehata/hataskey/issues/new');
	});

	test.each([
		null, '', defaultFeedbackUrl, 'https://example.test/feedback',
		'https://github.com/tolehata/hataskey/issues/123',
		'https://github.com/tolehata/hataskey/issues?template=custom',
		'https://github.com/tolehata/hataskey/issues/',
	])('独自URLと非表示設定は変更しない: %s', url => {
		expect(resolveFeedbackUrl(url)).toBe(url);
	});

	test('サーバーの新規既定値と表示・設定画面を同じ宛先へつなぐ', () => {
		// Source wiring checks only; no settings API or database is called.
		for (const path of ['../backend/src/models/Meta.ts', '../backend/src/models/json-schema/meta.ts']) {
			expect(readFileSync(resolve(process.cwd(), path), 'utf8')).toContain(`default: '${defaultFeedbackUrl}'`);
		}
		const about = readFileSync(resolve(process.cwd(), 'src/pages/about.overview.vue'), 'utf8');
		const branding = readFileSync(resolve(process.cwd(), 'src/pages/admin/branding.vue'), 'utf8');
		expect(about).toContain('computed(() => resolveFeedbackUrl(instance.feedbackUrl))');
		expect(about).toContain('v-if="feedbackUrl" :to="feedbackUrl"');
		expect(branding).toContain('ref(resolveFeedbackUrl(meta.feedbackUrl))');
	});
});
