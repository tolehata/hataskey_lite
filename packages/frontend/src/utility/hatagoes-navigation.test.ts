/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { getHatagoesOrigin, hatagoesAppForPath, hatagoesPageKey, hatagoesPaneKey, hatagoesTab, hatagoesUrl, hatagoesUrlForStandaloneHatask, isHatagoesCurrentScreen, isHatagoesIntroPath, readHatagoesLocation, rememberHatagoesOrigin, withHatagoesTab } from './hatagoes-navigation.js';
import { getHatagoesScreen } from './hatagoes-catalog.js';

describe('HataGoes navigation', () => {
	test.each(['/hatask/intro', '/hata-docs'])('recognizes embedded guide %s with inner and outer query/hash values', path => {
		expect(isHatagoesIntroPath(hatagoesUrl(path))).toBe(true);
		expect(isHatagoesIntroPath(`${hatagoesUrl(`${path}?from=hataskapps#guide`)}&source=launcher#window`)).toBe(true);
	});

	test('keeps back navigation for standalone guides, other screens, and lookalike or invalid destinations', () => {
		for (const path of ['/hatask/intro', '/hata-docs', '/hatagoes', '/other?view=%2Fhatask%2Fintro', 'https://example.com/hatagoes?view=%2Fhatask%2Fintro']) {
			expect(isHatagoesIntroPath(path)).toBe(false);
		}
		for (const view of ['home', 'settings', 'notifications', '/hatask', '/hatask?tab=todo', '/hatask/intro-extra', '/hatask/intro/child', '/hata-docs-extra', '/hatady', '/hatafeed', 'https://example.com/hatask/intro', '//example.com/hatask/intro', '/hatask/../hatask/intro']) {
			expect(isHatagoesIntroPath(hatagoesUrl(view))).toBe(false);
		}
	});

	test('selects the same screen through its filters, default tab and beta alias', () => {
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatady.records')!, '/hatady?hgScope=recent&tab=records&hgId=one')).toBe(true);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatady.home')!, '/hatady')).toBe(true);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatask.today')!, '/hatask?tab=home')).toBe(true);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatask.cal')!, '/hatask?notice=calendar')).toBe(true);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatafeed.beta')!, '/hatafeed?tab=beta')).toBe(true);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatady.records')!, '/hatady?tab=collection')).toBe(false);
		expect(isHatagoesCurrentScreen(getHatagoesScreen('hatady.settings')!, '/hatady')).toBe(false);
		const igo = getHatagoesScreen('hatask.hataigo');
		if (!igo) throw new Error('Missing HataIgo screen registration');
		expect(isHatagoesCurrentScreen(igo, '/hataigo')).toBe(true);
	});
	test('preserves legacy Hatask notification targets and explicit tab precedence', () => {
		expect(hatagoesTab('/hatask?notice=calendar')).toBe('cal');
		expect(hatagoesTab('/hatask?notice=mood')).toBe('mood');
		expect(hatagoesTab('/hatask?notice=calendar&tab=todo')).toBe('todo');
		expect(hatagoesTab('/hatask?notice=unknown')).toBeUndefined();
		expect(hatagoesTab('/hatady?notice=calendar')).toBeUndefined();
	});

	test('round trips a nested detail URL once, including encoded identifiers', () => {
		const path = '/hatask?tab=todo&hgKind=todo&hgId=a%2Fb%20c';
		expect(readHatagoesLocation(hatagoesUrl(path))).toEqual({ view: 'app', app: 'hatask', path });
		expect(readHatagoesLocation(hatagoesUrl(withHatagoesTab(path, 'mood')))).toMatchObject({ path: '/hatask?tab=mood' });
	});

	test('rejects external, escaped, and control-character destinations', () => {
		for (const path of ['https://example.com/hatask', '//example.com/hatask', '/hatask\\else', '/hatask\u0000', '/hatask/../../admin']) {
			expect(hatagoesAppForPath(path)).toBeNull();
			expect(readHatagoesLocation(hatagoesUrl(path))).toEqual({ view: 'home' });
		}
	});

	test('keeps one mounted data owner for tabs and details of each app', () => {
		expect(hatagoesPageKey('/hatask?tab=todo')).toBe(hatagoesPageKey('/hatask?tab=mood'));
		expect(hatagoesPageKey('/hatady?tab=records')).toBe(hatagoesPageKey('/hatady?tab=collection&hgId=book'));
		expect(hatagoesPageKey('/hatafeed')).toBe(hatagoesPageKey('/hatafeed/issue-1'));
		expect(hatagoesPageKey('/hatafeed/beta')).toBe(hatagoesPageKey('/hatafeed'));
		expect(hatagoesTab('/hatafeed/beta')).toBe('beta');
		expect(hatagoesPageKey('/hatask')).not.toBe(hatagoesPageKey('/hatady'));
		expect(hatagoesPaneKey('/hatask?tab=todo')).toBe(hatagoesPaneKey('/hatask?tab=mood'));
		expect(hatagoesPaneKey('/hatask/card-maker')).not.toBe(hatagoesPaneKey('/hatask'));
	});

	test('opens HataIgo like other games: a tool page, not an app tab of its own', () => {
		expect(hatagoesAppForPath('/hataigo')).toBe('hatask');
		expect(hatagoesPaneKey('/hataigo')).toBe('tool:/hataigo');
		expect(hatagoesPaneKey('/hataigo/game-123')).toBe('tool:/hataigo/game-123');
	});

	test('clears detail targets and returns Feed detail or beta routes to its tabbed root', () => {
		expect(withHatagoesTab('/hatask?tab=todo&hgKind=todo&hgId=123&other=keep', 'mood')).toBe('/hatask?tab=mood&other=keep');
		expect(withHatagoesTab('/hatafeed/issue-1?hgKind=issue&hgId=123', 'roadmap')).toBe('/hatafeed?tab=roadmap');
		expect(withHatagoesTab('/hatafeed/beta', 'issues')).toBe('/hatafeed?tab=issues');
	});

	test('stores a safe exit origin per router', () => {
		const first = {};
		const second = {};
		rememberHatagoesOrigin(first, '/my/notifications', '/hatagoes');
		rememberHatagoesOrigin(first, '/hatagoes', '/hatagoes?view=search');
		rememberHatagoesOrigin(second, '//example.com', '/hatagoes');
		expect(getHatagoesOrigin(first)).toBe('/my/notifications');
		expect(getHatagoesOrigin(second)).toBe('/');
	});

	test('sends the retired standalone Hatask screen into HataGoes with its tab and record intact', () => {
		expect(hatagoesUrlForStandaloneHatask('/hatask')).toBe(hatagoesUrl('/hatask'));
		expect(hatagoesUrlForStandaloneHatask('/hatask?tab=garden')).toBe(hatagoesUrl('/hatask?tab=garden'));
		expect(readHatagoesLocation(hatagoesUrlForStandaloneHatask('/hatask?tab=meal&meal=2') ?? '')).toEqual({ view: 'app', path: '/hatask?tab=meal&meal=2', app: 'hatask' });
		for (const path of ['/hatask/intro', '/hatask/card-maker', '/hatagoes', hatagoesUrl('/hatask'), '/hatasky', '/', '/hatady']) {
			expect(hatagoesUrlForStandaloneHatask(path)).toBeNull();
		}
	});
});
