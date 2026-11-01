/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HATAGOES_CATALOG } from './hatagoes-catalog.js';
import { HATAGOES_USAGE_ALIAS, HATAGOES_USAGE_ALIASES, hatagoesUsageScreenForPath, hatagoesUsageScreensForViewer, rankHatagoesLauncherScreens, recordHatagoesScreenUsage } from './hatagoes-launcher-usage.js';
import { readAkatsukiUsage } from './hatask-akatsuki-usage.js';
import { miLocalStorage } from '@/local-storage.js';

const now = new Date(2026, 9, 3, 12).getTime();
const day = 86_400_000;
const candidates = HATAGOES_CATALOG.filter(screen => ['hatask.cal', 'hatask.todo', 'hatask.card-maker', 'hatask.emotion-analysis', 'hatady.home', 'hatady.records', 'hatafeed.home', 'hatafeed.issues'].includes(screen.id));
let saved: Map<string, unknown>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	saved = new Map();
	vi.spyOn(miLocalStorage, 'getItemAsJson').mockImplementation(key => saved.get(key));
	vi.spyOn(miLocalStorage, 'setItemAsJson').mockImplementation((key, value) => { saved.set(key, structuredClone(value)); });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('HataGoes launcher usage', () => {
	test('maps legacy Hatask history to catalog destinations and decays older use', () => {
		const usage = {
			cal: { score: 8, lastUsedAt: now - 28 * day },
			analyze: { score: 3, lastUsedAt: now },
			card: { score: 1, lastUsedAt: now },
			hatady: { score: 1, lastUsedAt: now - day },
			feed: { score: 1, lastUsedAt: now - 2 * day },
		};
		expect(rankHatagoesLauncherScreens(candidates, usage, now).slice(0, 5).map(screen => screen.id)).toEqual([
			'hatask.emotion-analysis', 'hatask.cal', 'hatask.card-maker', 'hatady.home', 'hatafeed.home',
		]);
		expect(HATAGOES_USAGE_ALIAS['hatask.appearance']).toBe('settings');
		expect(HATAGOES_USAGE_ALIAS['hatask.drawing-tool']).toBe('drawing');
	});

	test('combines old Docs use with HataIntro and records the old route as Intro', () => {
		const screens = HATAGOES_CATALOG.filter(screen => ['hatask.intro', 'hatask.hata-docs', 'hatask.card-maker'].includes(screen.id));
		const usage = { docs: { score: 3, lastUsedAt: now }, intro: { score: 2, lastUsedAt: now }, card: { score: 4, lastUsedAt: now } };
		expect(rankHatagoesLauncherScreens(screens, usage, now).map(screen => screen.id)).toEqual(['hatask.intro', 'hatask.card-maker']);
		expect(hatagoesUsageScreenForPath('/hata-docs', screens)?.id).toBe('hatask.intro');
		recordHatagoesScreenUsage('alice', 'hatask.hata-docs', screens, now);
		expect(readAkatsukiUsage('alice').intro.score).toBe(1);
		expect(readAkatsukiUsage('alice').docs).toBeUndefined();
	});

	test('uses mock defaults then catalog order for unrecorded candidates, respecting supplied ACL and hidden IDs', () => {
		const raw = [...candidates, HATAGOES_CATALOG.find(screen => screen.id === 'hatask.scratchpad')!];
		const available = raw.filter(screen => screen.id !== 'hatafeed.issues'); // no feed access
		const ranked = rankHatagoesLauncherScreens(available, {}, now).map(screen => screen.id);
		expect(ranked.slice(0, 5)).toEqual(['hatask.cal', 'hatask.todo', 'hatask.card-maker', 'hatady.home', 'hatady.records']);
		expect(ranked).not.toContain('hatask.scratchpad');
		expect(ranked).not.toContain('hatafeed.issues');
		expect(ranked.at(-1)).toBe('hatask.emotion-analysis');
	});

	test('records in the existing account-local key and throttles the same legacy alias', () => {
		expect(HATAGOES_USAGE_ALIASES).toHaveLength(new Set(HATAGOES_USAGE_ALIASES).size);
		expect(HATAGOES_USAGE_ALIASES.length).toBeLessThan(64);
		expect(HATAGOES_USAGE_ALIASES.every(alias => /^[a-z]+$/.test(alias))).toBe(true);
		recordHatagoesScreenUsage('alice', 'hatask.cal', candidates, now);
		recordHatagoesScreenUsage('alice', 'hatask.cal', candidates, now + 30_000);
		expect(miLocalStorage.setItemAsJson).toHaveBeenCalledTimes(1);
		expect(readAkatsukiUsage('alice').cal.score).toBe(1);
		recordHatagoesScreenUsage('bob', 'hatady.records', candidates, now);
		expect(readAkatsukiUsage('bob').hyrecords.score).toBe(1);
		expect(readAkatsukiUsage('alice').hyrecords).toBeUndefined();
		expect([...saved.keys()]).toEqual(['hataskAkatsukiUsage:alice', 'hataskAkatsukiUsage:bob']);
	});

	test('ignores inaccessible IDs and malformed or expired saved usage', () => {
		saved.set('hataskAkatsukiUsage:alice', {
			cal: { score: 2, lastUsedAt: now },
			card: { score: Number.NaN, lastUsedAt: now },
			analyze: { score: 4, lastUsedAt: now - 91 * day },
			'hatask.todo': { score: 9, lastUsedAt: now },
		});
		const before = readAkatsukiUsage('alice');
		expect(rankHatagoesLauncherScreens(candidates, before, now)[0].id).toBe('hatask.cal');
		expect(recordHatagoesScreenUsage('alice', 'hatafeed.issues', candidates.filter(screen => screen.app !== 'hatafeed'), now)).toEqual(before);
		expect(recordHatagoesScreenUsage('alice', 'hatask.scratchpad', HATAGOES_CATALOG, now)).toEqual(before);
		expect(miLocalStorage.setItemAsJson).not.toHaveBeenCalled();
	});

	test('resolves standalone routes only within visible authorized destinations', () => {
		const ordinary = hatagoesUsageScreensForViewer({ policies: { canAccessHataFeed: false, canUseMascot: false } });
		expect(hatagoesUsageScreenForPath('/hatask/card-maker', ordinary)?.id).toBe('hatask.card-maker');
		expect(hatagoesUsageScreenForPath('/hatask?tab=todo', ordinary)?.id).toBe('hatask.todo');
		expect(hatagoesUsageScreenForPath('/scratchpad', ordinary)).toBeUndefined();
		expect(hatagoesUsageScreenForPath('/mascot', ordinary)).toBeUndefined();
		expect(hatagoesUsageScreenForPath('/hatafeed?tab=issues', ordinary)).toBeUndefined();
		const staff = hatagoesUsageScreensForViewer({ isModerator: true, policies: { canUseMascot: true } });
		expect(hatagoesUsageScreenForPath('/hatafeed?tab=issues', staff)?.id).toBe('hatafeed.issues');
		expect(hatagoesUsageScreenForPath('/hatask?tab=review', staff)?.id).toBe('hatask.review');
	});
});
