/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import source from './simple.vue?raw';

function normalizedDeclaration(selector: string, property: string, text = source): string | undefined {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return text
		.match(new RegExp(`^${escapedSelector}\\s*\\{[^}]*${property}:\\s*([^;]+);`, 'mu'))?.[1]
		.replace(/\s+/gu, '');
}

describe('Hataskey UI foldable layout', () => {
	test('ウィジェット列をノート列と同じ上端から始める', () => {
		const timelineTop = normalizedDeclaration('.timelineContainer', 'padding-top');
		const widgetTop = normalizedDeclaration('.root[data-hata-foldable=\'true\'] .desktopWidgetsInner', 'padding-top');

		expect(timelineTop).toBe('calc(56px+env(safe-area-inset-top,0px))');
		expect(widgetTop).toBe('calc(56px+env(safe-area-inset-top,0px)+var(--simple-announcements-height,0px))');
	});

	test('折りたたみ端末の上部ナビは画面全幅でなくタイムライン列の中央へ置く', () => {
		expect(normalizedDeclaration('.root[data-hata-foldable=\'true\'] .topBar', 'position')).toBe('absolute');
		expect(normalizedDeclaration('.mainColumnInner', 'position')).toBe('relative');
		expect(normalizedDeclaration('.topBar', 'left')).toBe('0');
		expect(normalizedDeclaration('.topBar', 'right')).toBe('0');
		expect(normalizedDeclaration('.root[data-hata-foldable=\'true\'] .topBar', 'top')).toBe('var(--simple-announcements-height,0px)');
		expect(normalizedDeclaration('.topBar', 'justify-content')).toBe('center');
	});

	test('通常のモバイルはfixed、通常PCはabsoluteという既存の配置を維持する', () => {
		expect(normalizedDeclaration('.topBar', 'position')).toBe('fixed');
		expect(normalizedDeclaration('.desktopLayout .topBar', 'position')).toBe('absolute');
		expect(normalizedDeclaration('.topBar', 'top')).toBe('calc(var(--simple-announcements-height,0px)+var(--MI-fixed-top-inset,0px))');
		expect(normalizedDeclaration('.desktopLayout .topBar', 'top')).toBe('var(--simple-announcements-height,0px)');
	});

	test('折りたたみ端末だけの補正を外すと旧viewport基準の配置として検出できる', () => {
		const selector = '.root[data-hata-foldable=\'true\'] .topBar';
		const oldLayout = source.replace(/\.root\[data-hata-foldable='true'\] \.topBar\s*\{[^}]*\}/u, '');
		expect(oldLayout).not.toBe(source);
		expect(normalizedDeclaration(selector, 'position', oldLayout)).toBeUndefined();
		expect(normalizedDeclaration(selector, 'position')).toBe('absolute');
	});
});
