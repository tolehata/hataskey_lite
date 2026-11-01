/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import simpleSource from './simple.vue?raw';

/** The button markup for one bottom-navbar entry. */
function bottomNavButton(source: string, id: string): string {
	const start = source.indexOf(`v-else-if="item.id==='${id}'"`);
	if (start < 0) return '';
	return source.slice(start, source.indexOf('</button>', start));
}

describe('Hataskey UI bottom navbar app icons', () => {
	test('HataGoes and HataFeed use their app logos, not a generic Tabler icon', () => {
		const hatagoes = bottomNavButton(simpleSource, 'hatagoes');
		expect(hatagoes).toContain('<HataAppNavIcon app="hatagoes"');
		expect(hatagoes).not.toContain('ti ti-sparkles');
		// HataGoes keeps its colour logo in dark mode, as in the side menu.
		expect(hatagoes).not.toContain(':monochrome="footerIsDark"');
		expect(bottomNavButton(simpleSource, 'hatafeed')).toContain('<HataAppNavIcon app="hatafeed"');
		// Positive control: the old markup is detected by this check.
		const old = simpleSource.replace('<HataAppNavIcon app="hatagoes" :size="22"/>', '<i class="ti ti-sparkles" aria-hidden="true"></i>');
		expect(bottomNavButton(old, 'hatagoes')).toContain('ti ti-sparkles');
	});
});
