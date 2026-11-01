/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { assertUniqueNavigationIds } from './settings-navigation-ids.js';
import shellSource from './index.vue?raw';
import destinationsSource from './settings-destinations.ts?raw';

describe('settings navigation IDs', () => {
	test('current shell IA is unique while an injected duplicate is fail-fast', () => {
		const navStart = shellSource.search(/const navSections(?:\s*:[^=]+)?\s*=\s*settingsDestinationSections\.map\(/u);
		const guardStart = shellSource.indexOf('assertUniqueNavigationIds(navSections);', navStart);
		const navigationIds = [...destinationsSource.matchAll(/destination\('([^']+)'/gu)].map(match => match[1]);
		expect(navStart).toBeGreaterThan(-1);
		expect(guardStart).toBeGreaterThan(navStart);
		// コンカレント連携を独立した項目に追加した現在の destination は53件。
		expect(navigationIds).toHaveLength(53);
		expect(new Set(navigationIds).size).toBe(navigationIds.length);
		expect(navigationIds).toContain('account-plugins');
		expect(navigationIds).toContain('account-concrnt');

		expect(() => assertUniqueNavigationIds([
			{ items: [{ id: 'settings.unique' }] },
			{ items: [{ id: 'settings.unique' }] },
		])).toThrow('[settings-redesign] duplicate navigation item id: settings.unique');
		expect(() => assertUniqueNavigationIds([
			{ items: [{ id: 'settings.one' }] },
			{ items: [{ id: 'settings.two' }] },
		])).not.toThrow();
	});
});
