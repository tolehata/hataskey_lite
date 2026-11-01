/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const announcements = path.resolve(process.cwd(), 'src/pages/announcements.vue');
const newNotes = path.resolve(process.cwd(), 'src/components/MkTimelineNewNotesContent.vue');

afterEach(() => vi.unstubAllEnvs());

describe('CSS Modules scoped names', () => {
	it('keeps the former four-character collision distinct in production', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		const { getConfig } = await import('../vite.config.js');
		const modules = getConfig().css?.modules;
		if (!modules || typeof modules.generateScopedName !== 'function') throw new Error('CSS Modules generateScopedName is missing');
		const { generateScopedName } = modules;

		const headerIcon = generateScopedName('headerIcon', announcements, '');
		const face = generateScopedName('face', newNotes, '');
		expect(headerIcon.slice(0, 5)).toBe('xfhS3');
		expect(face.slice(0, 5)).toBe('xfhS3');
		expect(headerIcon).not.toBe(face);
		for (const scopedName of [headerIcon, face]) {
			expect(scopedName).toMatch(/^x[0-9a-zA-Z]+$/);
			expect(scopedName.length).toBeGreaterThan(5);
		}
		expect(generateScopedName('headerIcon', announcements, '')).toBe(headerIcon);
		expect(generateScopedName('headerIcon', `${announcements}?vue&type=style&index=0&module=$style`, '')).toBe(headerIcon);

		vi.stubEnv('NODE_ENV', 'development');
		const devModules = getConfig().css?.modules;
		if (!devModules || typeof devModules.generateScopedName !== 'function') throw new Error('CSS Modules generateScopedName is missing');
		const generateDevScopedName = devModules.generateScopedName;
		expect(generateDevScopedName('headerIcon', announcements, '')).toBe('pages-announcements-headerIcon');
		expect(generateDevScopedName('face', newNotes, '')).toBe('components-MkTimelineNewNotesContent-face');
	});
});
