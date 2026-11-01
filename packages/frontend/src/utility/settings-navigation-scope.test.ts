/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { SettingsCatalogDescriptorV2 } from './settings-search-v2.js';
import {
	countSettingsNavigationScopeV2,
	descriptorMatchesSettingsNavigationScopeV2,
	relatedSourcesForSettingsNavigationV2,
} from './settings-navigation-scope.js';

function descriptor(overrides: Partial<SettingsCatalogDescriptorV2> & Pick<SettingsCatalogDescriptorV2, 'stableId' | 'route' | 'categoryId'>): SettingsCatalogDescriptorV2 {
	const { stableId, route, categoryId, ...rest } = overrides;
	return {
		stableId,
		controlId: stableId,
		source: 'control',
		searchable: true,
		route,
		label: stableId,
		categoryId,
		categoryLabel: categoryId,
		aliases: [],
		legacyLabels: [],
		preferenceKeys: [],
		persistence: 'profile',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'core',
		applicableUi: 'all',
		metadataEvidence: {
			persistence: 'test fixture: profile persistence',
			saveMode: 'test fixture: immediate save',
			availability: 'test fixture: all viewports',
			owner: 'test fixture: core owner',
			applicableUi: 'test fixture: all UI contexts',
		},
		relatedIds: [],
		related: [],
		searchRank: 0,
		...rest,
	};
}

const glass = descriptor({
	stableId: 'settings.control.glass-opacity', route: '/settings/hata-custom', categoryId: 'hataskey-ui',
	activation: { kind: 'hata-custom-category', category: 'glassUi' },
});
const font = descriptor({
	stableId: 'settings.control.font-family', route: '/settings/hata-custom', categoryId: 'theme-font',
	activation: { kind: 'hata-custom-category', category: 'font' },
});
const density = descriptor({ stableId: 'settings.control.note-density', route: '/settings/preferences', categoryId: 'display-notes' });
const chat = descriptor({ stableId: 'settings.control.chat-enter', route: '/settings/preferences', categoryId: 'behavior' });
const descriptors = [glass, font, density, chat];
const byStableId = new Map(descriptors.map(item => [item.stableId, item]));

describe('settings navigation catalog scope', () => {
	test('same-route badge counts are distinct for glassUi, font, and exact preferences controls', () => {
		const glassTarget = { route: '/settings/hata-custom', categoryId: 'hataskey-ui', activation: { kind: 'hata-custom-category' as const, category: 'glassUi' as const } };
		const fontTarget = { route: '/settings/hata-custom', categoryId: 'theme-font', activation: { kind: 'hata-custom-category' as const, category: 'font' as const } };
		const densityTarget = { route: '/settings/preferences', controlId: density.stableId, categoryId: 'display-notes' };
		expect(countSettingsNavigationScopeV2(descriptors, glassTarget)).toBe(1);
		expect(countSettingsNavigationScopeV2(descriptors, fontTarget)).toBe(1);
		expect(countSettingsNavigationScopeV2(descriptors, densityTarget)).toBe(1);
		expect(descriptorMatchesSettingsNavigationScopeV2(chat, densityTarget)).toBe(false);
		// Positive control: a route-only count would incorrectly include both.
		expect(descriptors.filter(item => item.route === '/settings/preferences')).toHaveLength(2);
	});

	test('route-tail relations use focused control or active hata-custom category, never every descriptor on a route', () => {
		expect(relatedSourcesForSettingsNavigationV2({
			descriptors, byStableId, currentRoute: '/settings/hata-custom', activeTarget: null, activeHataCustomCategory: 'glassUi', fallback: null,
		})).toEqual([glass]);
		expect(relatedSourcesForSettingsNavigationV2({
			descriptors, byStableId, currentRoute: '/settings/hata-custom', activeTarget: null, activeHataCustomCategory: 'font', fallback: null,
		})).toEqual([font]);
		expect(relatedSourcesForSettingsNavigationV2({
			descriptors, byStableId, currentRoute: '/settings/preferences', activeTarget: { route: '/settings/preferences', controlId: density.stableId }, activeHataCustomCategory: null, fallback: null,
		})).toEqual([density]);
		expect(relatedSourcesForSettingsNavigationV2({
			descriptors, byStableId, currentRoute: '/settings/preferences', activeTarget: null, activeHataCustomCategory: null, fallback: null,
		})).toEqual([]);
	});
});
