/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultFeedbackUrl, resolveFeedbackUrl } from '@/misc/feedback-url.js';
import { defaultFeedbackUrl as cachedDefaultFeedbackUrl, resolveFeedbackUrl as resolveCachedFeedbackUrl } from '../../../../frontend/src/utility/feedback-url.js';

const legacyUrls = [
	'https://github.com/tolehata/hataskey/issues',
	'https://github.com/kokonect-link/cherrypick/issues/new',
	'https://code.tolehata.net/hatacha/cherrypick-hata/issues',
	'https://code.tolehata.net/hatacha/cherrypick-hata/issues/new',
];
const unchangedUrls = [
	null,
	'',
	defaultFeedbackUrl,
	'https://example.test/feedback',
	'https://github.com/tolehata/hataskey/issues/123',
	'https://github.com/tolehata/hataskey/issues?template=custom',
	'https://github.com/tolehata/hataskey/issues/',
	' https://github.com/tolehata/hataskey/issues',
];
const responseFiles = [
	{ path: 'src/core/entities/MetaEntityService.ts', variable: 'instance' },
	{ path: 'src/server/api/endpoints/admin/meta.ts', variable: 'instance' },
	{ path: 'src/server/NodeinfoServerService.ts', variable: 'meta' },
];

function checkResponseWiring(source: string, variable: string) {
	expect(source).toContain('import { resolveFeedbackUrl } from \'@/misc/feedback-url.js\';');
	expect(source).toContain(`feedbackUrl: resolveFeedbackUrl(${variable}.feedbackUrl),`);
}

describe('feedback URL response defaults', () => {
	it.each(legacyUrls)('returns the new issue form for the exact legacy default %s', url => {
		const storedMeta = { feedbackUrl: url };
		expect(resolveFeedbackUrl(storedMeta.feedbackUrl)).toBe('https://github.com/tolehata/hataskey/issues/new');
		expect(storedMeta.feedbackUrl).toBe(url);
	});

	it.each(unchangedUrls)('preserves a custom URL or hidden setting %s', url => {
		expect(resolveFeedbackUrl(url)).toBe(url);
	});

	it('matches the frontend fallback for previously cached metadata', () => {
		expect(defaultFeedbackUrl).toBe(cachedDefaultFeedbackUrl);
		for (const url of [...legacyUrls, ...unchangedUrls]) {
			expect(resolveFeedbackUrl(url)).toBe(resolveCachedFeedbackUrl(url));
		}
	});

	it.each(responseFiles)('applies the resolver at the existing response field in $path', ({ path, variable }) => {
		// Source contract only: no API requests, database reads/writes, or migrations.
		checkResponseWiring(readFileSync(resolve(process.cwd(), path), 'utf8'), variable);
	});

	it('leaves admin/meta authentication, admin authorization, and token restrictions intact', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/server/api/endpoints/admin/meta.ts'), 'utf8');
		for (const guard of ['requireCredential: true', 'requireAdmin: true', 'secure: true', 'kind: \'read:admin:meta\'']) {
			expect(source).toContain(guard);
		}
	});

	it('positive control: detects a response field reverting to the stored legacy value', () => {
		const source = readFileSync(resolve(process.cwd(), responseFiles[0].path), 'utf8');
		const regressed = source.replace('feedbackUrl: resolveFeedbackUrl(instance.feedbackUrl),', 'feedbackUrl: instance.feedbackUrl,');
		expect(regressed).not.toBe(source);
		expect(() => checkResponseWiring(regressed, 'instance')).toThrow();
	});
});
