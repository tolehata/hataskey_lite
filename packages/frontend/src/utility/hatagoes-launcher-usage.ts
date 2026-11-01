/* SPDX-License-Identifier: AGPL-3.0-only */
import { akatsukiUsageScore, readAkatsukiUsage, recordAkatsukiUsage } from './hatask-akatsuki-usage.js';
import type { HataskAkatsukiUsage } from './hatask-akatsuki-usage.js';
import { canonicalHatagoesScreenId, HATAGOES_CATALOG, isHatagoesVisibleScreen } from './hatagoes-catalog.js';
import type { HatagoesCatalogEntry } from './hatagoes-catalog.js';
import { isHatagoesCurrentScreen } from './hatagoes-navigation.js';

// Reuse Hatask's existing device-local usage keys. New aliases contain only
// lowercase letters, as required by normalizeAkatsukiUsage.
export const HATAGOES_USAGE_ALIAS: Readonly<Record<string, string>> = {
	'hatask.today': 'home',
	'hatask.cal': 'cal',
	'hatask.todo': 'todo',
	'hatask.mood': 'mood',
	'hatask.meal': 'meal',
	'hatask.recipe': 'recipe',
	'hatask.garden': 'garden',
	'hatask.support': 'support',
	'hatask.ranking': 'ranking',
	'hatask.review': 'review',
	'hatask.apps': 'hataskapps',
	'hatask.tools': 'apps',
	'hatask.appearance': 'settings',
	'hatask.drawing-tool': 'drawing',
	'hatask.whats-new': 'whatsnew',
	'hatask.intro': 'intro',
	'hatask.card-maker': 'card',
	'hatask.emotion-analysis': 'analyze',
	'hatask.side-studio': 'studio',
	'hatask.earthquake': 'earthquake',
	'hatask.mascot': 'mascot',
	'hatask.hata-docs': 'docs',
	'hatask.games': 'games',
	'hatask.settings': 'hatasettings',
	'hatady.home': 'hatady',
	'hatady.records': 'hyrecords',
	'hatady.collection': 'hycollection',
	'hatady.profile': 'hyprofile',
	'hatady.moderation': 'hymoderation',
	'hatady.settings': 'hysettings',
	'hatafeed.home': 'feed',
	'hatafeed.issues': 'hfissues',
	'hatafeed.roadmap': 'hfroadmap',
	'hatafeed.beta': 'hfbeta',
	'hatafeed.emoji': 'hfemoji',
	'hatafeed.display-settings': 'hfsettings',
};

export const HATAGOES_USAGE_ALIASES = [...new Set(Object.values(HATAGOES_USAGE_ALIAS))];

// The first-run launcher follows the mock's core app destinations. Other
// eligible screens retain their catalog order after these entries.
export const HATAGOES_LAUNCHER_DEFAULT_ORDER = [
	'hatask.cal', 'hatask.todo', 'hatask.mood', 'hatask.meal',
	'hatask.recipe', 'hatask.garden', 'hatask.ranking', 'hatask.earthquake',
	'hatask.mascot', 'hatask.card-maker', 'hatask.appearance',
] as const;

const defaultRank = new Map<string, number>(HATAGOES_LAUNCHER_DEFAULT_ORDER.map((id, index) => [id, index]));
const catalogRank = new Map<string, number>(HATAGOES_CATALOG.map((screen, index) => [screen.id, index]));

export function hatagoesUsageScreensForViewer(viewer: { isAdmin?: boolean; isModerator?: boolean; policies?: Record<string, unknown> } | null): HatagoesCatalogEntry[] {
	if (!viewer) return [];
	const staff = viewer.isAdmin || viewer.isModerator;
	const canFeed = staff || viewer.policies?.canAccessHataFeed === true;
	return HATAGOES_CATALOG.filter((screen: HatagoesCatalogEntry) => {
		if (!isHatagoesVisibleScreen(screen) || screen.app === 'hatafeed' && !canFeed) return false;
		if (screen.access === 'admin') return !!viewer.isAdmin;
		if (screen.access === 'moderator' || screen.access === 'hatafeedStaff') return !!staff;
		if (screen.access === 'canUseMascot') return viewer.policies?.canUseMascot !== false;
		return true;
	});
}

export function hatagoesUsageScreenForPath(path: string, allowedScreens: readonly HatagoesCatalogEntry[]): HatagoesCatalogEntry | undefined {
	if (path.split(/[?#]/u, 1)[0] === '/hata-docs') return allowedScreens.find(screen => screen.id === 'hatask.intro');
	return allowedScreens.find(screen => isHatagoesVisibleScreen(screen) && isHatagoesCurrentScreen(screen, path));
}

export function rankHatagoesLauncherScreens(screens: readonly HatagoesCatalogEntry[], usage: HataskAkatsukiUsage, now = Date.now()): HatagoesCatalogEntry[] {
	return screens.filter(isHatagoesVisibleScreen).sort((left, right) => {
		const leftScore = akatsukiUsageScore(usage, HATAGOES_USAGE_ALIAS[left.id] ?? '', now) + (left.id === 'hatask.intro' ? akatsukiUsageScore(usage, 'docs', now) : 0);
		const rightScore = akatsukiUsageScore(usage, HATAGOES_USAGE_ALIAS[right.id] ?? '', now) + (right.id === 'hatask.intro' ? akatsukiUsageScore(usage, 'docs', now) : 0);
		if (leftScore !== rightScore) return rightScore - leftScore;
		const leftDefault = defaultRank.get(left.id) ?? Infinity;
		const rightDefault = defaultRank.get(right.id) ?? Infinity;
		if (leftDefault !== rightDefault) return leftDefault - rightDefault;
		return (catalogRank.get(left.id) ?? Infinity) - (catalogRank.get(right.id) ?? Infinity);
	});
}

export function recordHatagoesScreenUsage(userId: string | undefined, screenId: string, allowedScreens: readonly HatagoesCatalogEntry[], now = Date.now()): HataskAkatsukiUsage {
	if (!userId) return {};
	const canonicalId = canonicalHatagoesScreenId(screenId);
	const screen = allowedScreens.find(candidate => candidate.id === canonicalId && isHatagoesVisibleScreen(candidate));
	const alias = screen && HATAGOES_USAGE_ALIAS[screen.id];
	return alias ? recordAkatsukiUsage(userId, alias, HATAGOES_USAGE_ALIASES, now) : readAkatsukiUsage(userId);
}
