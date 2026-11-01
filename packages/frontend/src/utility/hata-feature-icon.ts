/* SPDX-License-Identifier: AGPL-3.0-only */

export const HATA_FEATURE_ICONS = {
	home: { family: 'hatask', shape: 'home' },
	cal: { family: 'hatask', shape: 'cal' },
	todo: { family: 'hatask', shape: 'todo' },
	mood: { family: 'hatask', shape: 'mood' },
	meal: { family: 'hatask', shape: 'meal' },
	recipe: { family: 'hatask', shape: 'recipe' },
	garden: { family: 'hatask', shape: 'flower' },
	ranking: { family: 'hatask', shape: 'rank' },
	settings: { family: 'hatask', shape: 'look' },
	review: { family: 'hatask', shape: 'shield' },
	hataskapps: { family: 'hatask', shape: 'apps' },
	apps: { family: 'hatask', shape: 'appsplus' },
	card: { family: 'hataskey', shape: 'card' },
	analyze: { family: 'hataskey', shape: 'lyze' },
	studio: { family: 'hataskey', shape: 'studio' },
	mascot: { family: 'hataskey', shape: 'mascot' },
	games: { family: 'hataskey', shape: 'game' },
	igo: { family: 'hataskey', shape: 'igo' },
	intro: { family: 'hataskey', shape: 'intro' },
	drawing: { family: 'hataskey', shape: 'draw' },
	whatsnew: { family: 'hataskey', shape: 'news' },
	earthquake: { family: 'hataskey', shape: 'quake' },
	support: { family: 'hataskey', shape: 'support' },
	'hatady-home': { family: 'hatady', shape: 'home' },
	'hatady-records': { family: 'hatady', shape: 'note' },
	'hatady-collection': { family: 'hatady', shape: 'shelf' },
	'hatady-profile': { family: 'hatady', shape: 'person' },
	'hatady-moderation': { family: 'hatady', shape: 'shield' },
	'hatady-settings': { family: 'hatady', shape: 'gear' },
	'hatafeed-home': { family: 'hatafeed', shape: 'home' },
	'hatafeed-issues': { family: 'hatafeed', shape: 'issue' },
	'hatafeed-roadmap': { family: 'hatafeed', shape: 'map' },
	'hatafeed-beta': { family: 'hatafeed', shape: 'beta' },
	'hatafeed-emoji': { family: 'hatafeed', shape: 'emoji' },
	'hatafeed-settings': { family: 'hatafeed', shape: 'gear' },
} as const;

export type HataFeature = keyof typeof HATA_FEATURE_ICONS;

export function hataFeatureForHataskApp(id: string): HataFeature | null {
	return Object.hasOwn(HATA_FEATURE_ICONS, id) ? id as HataFeature : null;
}

const screenFeatures: Readonly<Record<string, HataFeature>> = {
	'hatask.today': 'home',
	'hatask.review': 'review',
	'hatask.apps': 'hataskapps',
	'hatask.tools': 'apps',
	'hatady.home': 'hatady-home',
	'hatady.records': 'hatady-records',
	'hatady.collection': 'hatady-collection',
	'hatady.profile': 'hatady-profile',
	'hatady.moderation': 'hatady-moderation',
	'hatady.settings': 'hatady-settings',
	'hatafeed.home': 'hatafeed-home',
	'hatafeed.issues': 'hatafeed-issues',
	'hatafeed.roadmap': 'hatafeed-roadmap',
	'hatafeed.beta': 'hatafeed-beta',
	'hatafeed.emoji': 'hatafeed-emoji',
	'hatafeed.settings': 'hatafeed-settings',
	'hatafeed.display-settings': 'hatafeed-settings',
	'hatask.cal': 'cal',
	'hatask.todo': 'todo',
	'hatask.mood': 'mood',
	'hatask.meal': 'meal',
	'hatask.recipe': 'recipe',
	'hatask.garden': 'garden',
	'hatask.ranking': 'ranking',
	'hatask.appearance': 'settings',
	'hatask.card-maker': 'card',
	'hatask.emotion-analysis': 'analyze',
	'hatask.side-studio': 'studio',
	'hatask.mascot': 'mascot',
	'hatask.games': 'games',
	'hatask.hataigo': 'igo',
	'hatask.intro': 'intro',
	'hatask.drawing-tool': 'drawing',
	'hatask.whats-new': 'whatsnew',
	'hatask.earthquake': 'earthquake',
	'hatask.support': 'support',
};

export function hataFeatureForScreen(id: string): HataFeature | null {
	return Object.hasOwn(screenFeatures, id) ? screenFeatures[id] : null;
}
