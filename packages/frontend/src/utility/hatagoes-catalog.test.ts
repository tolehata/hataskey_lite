/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { DEFAULT_HATAGOES_PINS, getHatagoesCatalogGroup, getHatagoesScreen, HATAGOES_CATALOG, HATAGOES_PIN_LIMIT, isHatagoesVisibleScreen, normalizeHatagoesPins } from './hatagoes-catalog.js';

describe('HataGoes screen catalog', () => {
	test('has unique IDs and actual root paths for catalog destinations', () => {
		expect(new Set(HATAGOES_CATALOG.map(screen => screen.id)).size).toBe(HATAGOES_CATALOG.length);
		for (const screen of HATAGOES_CATALOG) {
			expect(screen.path).toMatch(/^\/(?!\/)/);
			expect(getHatagoesScreen(screen.id)).toBe(screen);
		}
		expect(getHatagoesScreen('hatagoes.home')).toBeUndefined();
	});

	test('uses five confirmed initial pins in order', () => {
		expect(HATAGOES_PIN_LIMIT).toBe(5);
		expect(normalizeHatagoesPins(undefined)).toEqual(DEFAULT_HATAGOES_PINS);
		expect(normalizeHatagoesPins(null)).toEqual(DEFAULT_HATAGOES_PINS);
		expect(DEFAULT_HATAGOES_PINS.every(id => getHatagoesScreen(id) !== undefined)).toBe(true);
	});

	test('keeps user order, drops duplicate and unknown IDs, and limits to five', () => {
		expect(normalizeHatagoesPins([
			'hatady.collection', 'unknown', 'hatady.collection', 42,
			'hatask.mood', 'hatafeed.issues', 'hatask.cal', 'hatask.todo', 'hatask.meal',
		])).toEqual(['hatady.collection', 'hatask.mood', 'hatafeed.issues', 'hatask.cal', 'hatask.todo']);
	});

	test('preserves an intentionally short or empty pin selection', () => {
		expect(normalizeHatagoesPins([])).toEqual([]);
		expect(normalizeHatagoesPins(['hatask.todo'])).toEqual(['hatask.todo']);
	});

	test('maps saved Hata Docs pins to HataIntro without changing their order', () => {
		expect(normalizeHatagoesPins(['hatask.hata-docs', 'hatask.todo', 'hatask.intro'])).toEqual(['hatask.intro', 'hatask.todo']);
		expect(getHatagoesScreen('hatask.hata-docs')?.path).toBe('/hata-docs');
		expect(getHatagoesScreen('hatask.review')).toMatchObject({ label: 'Hatask モデレーション', path: '/hatask?tab=review', access: 'moderator' });
	});

	test('retains in-page tab identity when several entries share a route', () => {
		expect(getHatagoesScreen('hatady.records')).toMatchObject({ path: '/hatady', tab: 'records' });
		expect(getHatagoesScreen('hatady.collection')).toMatchObject({ path: '/hatady', tab: 'collection' });
		expect(getHatagoesScreen('hatafeed.issues')).toMatchObject({ path: '/hatafeed', tab: 'issues' });
		expect(getHatagoesScreen('hatask.hataigo')).toMatchObject({ app: 'hatask', path: '/hataigo', standalone: true });
		expect(HATAGOES_CATALOG.filter(screen => 'standalone' in screen).map(screen => screen.id)).toEqual(['hatask.hataigo']);
		expect(HATAGOES_CATALOG.some(screen => (screen.app as string) === 'hataigo')).toBe(false);
	});

	test('exposes existing peripheral tools and keeps retired games out', () => {
		for (const [id, path] of [
			['hatask.clicker', '/clicker'],
			['hatask.qr', '/qr'],
			['hatask.scratchpad', '/scratchpad'],
			['hatask.api-console', '/api-console'],
			['hatask.hata-docs', '/hata-docs'],
			['hatask.pages', '/pages'],
			['hatask.play', '/play'],
			['hatask.gallery', '/gallery'],
		]) expect(getHatagoesScreen(id)?.path).toBe(path);
		expect(HATAGOES_CATALOG.map(screen => screen.path)).not.toContain('/hanaawase');
		expect(HATAGOES_CATALOG.map(screen => screen.path)).not.toContain('/playground/cpp');
		for (const id of ['hatask.stacking-game', 'hatask.whack-emoji', 'hatask.emoji-shoot', 'hatask.cpp-playground']) {
			expect(getHatagoesScreen(id)).toBeUndefined();
			// 廃止前に保存したピンは枠を消費せずに読み飛ばす
			expect(normalizeHatagoesPins([id, 'hatask.todo'])).toEqual(['hatask.todo']);
		}
		expect(getHatagoesScreen('hatask.settings')?.label).toBe('Hataskey 全体の設定');
		expect(getHatagoesScreen('hatask.support')?.label).toBe('支援情報');
		expect(getHatagoesScreen('hatask.emotion-analysis')?.icon).toBe('ti ti-scan');
	});

	test('groups legacy destinations by purpose while retaining their route identity', () => {
		for (const [id, group] of [
			['hatask.scratchpad', 'developer'], ['hatask.api-console', 'developer'],
			['hatask.reversi', 'games'], ['hatask.clicker', 'games'], ['hatask.bubble-game', 'games'],
			['hatask.play', 'contents'], ['hatask.gallery', 'contents'],
			['hatask.card-maker', 'hataskey'], ['hatask.hataigo', 'hataskey'], ['hatask.recipe', 'hatask'],
		] as const) expect(getHatagoesCatalogGroup(getHatagoesScreen(id)!)).toBe(group);
	});

	test('hides omitted and duplicate routes from HataGoes selectors without changing saved IDs', () => {
		const hidden = HATAGOES_CATALOG.filter(screen => !isHatagoesVisibleScreen(screen)).map(screen => screen.id);
		expect(hidden).toEqual([
			'hatafeed.settings', 'hatask.games', 'hatask.bubble-game',
			'hatask.reversi', 'hatask.clicker', 'hatask.qr', 'hatask.scratchpad', 'hatask.api-console', 'hatask.hata-docs',
			'hatask.pages', 'hatask.play', 'hatask.gallery', 'hatask.settings', 'hatask.support-admin',
		]);
		expect(normalizeHatagoesPins(['hatask.reversi'])).toEqual(['hatask.reversi']);
		expect(normalizeHatagoesPins(['hatask.support-admin'])).toEqual(['hatask.support-admin']);
	});

	test('distinguishes app-owned modal actions from Hataskey settings routes', () => {
		expect(getHatagoesScreen('hatask.appearance')).toMatchObject({ app: 'hatask', path: '/hatask', action: 'settings' });
		expect(getHatagoesScreen('hatady.settings')).toMatchObject({ app: 'hatady', path: '/hatady', action: 'settings' });
		expect(getHatagoesScreen('hatafeed.display-settings')).toMatchObject({ app: 'hatafeed', path: '/hatafeed', action: 'settings' });
		expect(getHatagoesScreen('hatask.drawing-tool')).toMatchObject({ path: '/hatask', action: 'drawing-tool' });
		expect(getHatagoesScreen('hatask.whats-new')).toMatchObject({ path: '/hatask', action: 'whats-new' });
		expect(getHatagoesScreen('hatask.settings')).toMatchObject({ path: '/settings/hata-custom' });
		expect(getHatagoesScreen('hatask.settings')).not.toHaveProperty('action');
	});
});
