/* SPDX-License-Identifier: AGPL-3.0-only */
import { ref } from 'vue';
import { normalizeHatagoesAppPins } from './hatagoes-app-pins.js';
import { normalizeHatagoesPins } from './hatagoes-catalog.js';
import { normalizeHatagoesHataskPins, normalizeHatagoesHataskPinsDesktop } from './hatagoes-hatask-pins.js';
import { misskeyApi } from './misskey-api.js';

export const HATAGOES_HOME_CARDS = [
	{ id: 'schedule', label: '次の予定' }, { id: 'todo', label: '優先ToDo' },
	{ id: 'flower', label: 'おはな' }, { id: 'mood', label: 'きもち' },
	{ id: 'meal', label: 'ごはん' }, { id: 'reading', label: '読みかけ' }, { id: 'issues', label: 'イシュー' },
	{ id: 'community', label: 'Hatadyコミュニティ' }, { id: 'roadmap', label: 'HataFeedロードマップ' },
] as const;
export type HatagoesCardId = (typeof HATAGOES_HOME_CARDS)[number]['id'];
export type HatagoesCard = { id: HatagoesCardId; hidden: boolean };
export const HATAGOES_HOME_CARDS_V3 = [
	{ id: 'daily', label: 'きょうの記録' }, { id: 'schedule', label: 'いま' },
	{ id: 'flower', label: 'おはな' }, { id: 'todo', label: 'ToDo' },
	{ id: 'mood', label: 'いまのきもち' }, { id: 'meal', label: 'きょうのごはん' },
	{ id: 'reading', label: '読みかけ' }, { id: 'issues', label: 'あなたのイシュー' },
] as const;
export type HatagoesCardV3Id = (typeof HATAGOES_HOME_CARDS_V3)[number]['id'];
export type HatagoesCardV3 = { id: HatagoesCardV3Id; hidden: boolean };
export const HATAGOES_THEMES = ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu', 'halloween'] as const;
export type HatagoesTheme = (typeof HATAGOES_THEMES)[number];
export type HatagoesHomeTheme = { theme: HatagoesTheme; darkMode: boolean; autoTheme: boolean };
const scope = ['client', 'hatagoes'];
const object = (v: unknown): Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function normalizeHatagoesCards(value: unknown): HatagoesCard[] {
	const cards: HatagoesCard[] = [];
	for (const raw of Array.isArray(value) ? value : []) {
		const v = object(raw);
		const definition = HATAGOES_HOME_CARDS.find(card => card.id === v.id);
		if (definition && !cards.some(card => card.id === definition.id)) cards.push({ id: definition.id, hidden: v.hidden === true });
	}
	for (const card of HATAGOES_HOME_CARDS) if (!cards.some(v => v.id === card.id)) cards.push({ id: card.id, hidden: false });
	return cards;
}

/** V3 is independent of the old grid. Only matching hidden choices migrate. */
export function normalizeHatagoesCardsV3(value: unknown, legacy?: unknown): HatagoesCardV3[] {
	const legacyHidden = new Set((Array.isArray(legacy) ? legacy : []).filter(item => object(item).hidden === true).map(item => object(item).id));
	const cards: HatagoesCardV3[] = [];
	for (const raw of Array.isArray(value) ? value : []) {
		const v = object(raw);
		const definition = HATAGOES_HOME_CARDS_V3.find(card => card.id === v.id);
		if (definition && !cards.some(card => card.id === definition.id)) cards.push({ id: definition.id, hidden: v.hidden === true });
	}
	for (const definition of HATAGOES_HOME_CARDS_V3) if (!cards.some(card => card.id === definition.id)) cards.push({ id: definition.id, hidden: !Array.isArray(value) && legacyHidden.has(definition.id) });
	return cards;
}

export function normalizeHatagoesTheme(value: unknown): HatagoesHomeTheme {
	const v = object(value);
	return { theme: HATAGOES_THEMES.find(theme => theme === v.theme) ?? 'akatsuki', darkMode: v.darkMode === true, autoTheme: v.autoTheme !== false };
}

/** A failed read never becomes a write of defaults. Each key is saved independently. */
export function useHatagoesPreferences() {
	const pins = ref(normalizeHatagoesPins(undefined));
	const hataskPins = ref(normalizeHatagoesHataskPins(undefined));
	const hataskPinsDesktop = ref(normalizeHatagoesHataskPinsDesktop(undefined));
	const appPins = ref(normalizeHatagoesAppPins(undefined));
	const cards = ref(normalizeHatagoesCards(undefined));
	const cardsV3 = ref(normalizeHatagoesCardsV3(undefined));
	const theme = ref(normalizeHatagoesTheme(undefined));
	const ready = ref(false);
	const saving = ref(false);
	const error = ref(false);
	let generation = 0;
	let queue = Promise.resolve();
	let desktopPinsConfigured = false;

	async function load() {
		if (saving.value) return;
		const request = ++generation;
		try {
			const data = object(await misskeyApi('i/registry/get-all', { scope }));
			let homeTheme = data.theme;
			if (homeTheme == null) {
				const hatask = object(await misskeyApi('i/registry/get-all', { scope: ['client', 'hatask'] }));
				homeTheme = normalizeHatagoesTheme(hatask.settings);
				if (request !== generation) return;
				// This is a new HataGoes-only key. Existing app settings are read-only here.
				await misskeyApi('i/registry/set', { scope, key: 'theme', value: homeTheme });
			}
			if (request !== generation) return;
			pins.value = normalizeHatagoesPins(data.pins);
			hataskPins.value = normalizeHatagoesHataskPins(data.hataskPins);
			desktopPinsConfigured = Array.isArray(data.hataskPinsDesktop);
			hataskPinsDesktop.value = normalizeHatagoesHataskPinsDesktop(data.hataskPinsDesktop, data.hataskPins);
			appPins.value = normalizeHatagoesAppPins(data.appPins);
			cards.value = normalizeHatagoesCards(data.cards);
			cardsV3.value = normalizeHatagoesCardsV3(data.cardsV3, data.cards);
			theme.value = normalizeHatagoesTheme(homeTheme);
			ready.value = true;
			error.value = false;
		} catch { if (request === generation) error.value = true; }
	}

	function save(key: 'pins' | 'hataskPins' | 'hataskPinsDesktop' | 'appPins' | 'cards' | 'cardsV3' | 'theme', value: unknown) {
		if (!ready.value) return Promise.reject(new Error('HataGoes settings have not loaded'));
		generation++;
		saving.value = true;
		const normalized = key === 'pins' ? normalizeHatagoesPins(value) : key === 'hataskPins' ? normalizeHatagoesHataskPins(value) : key === 'hataskPinsDesktop' ? normalizeHatagoesHataskPinsDesktop(value) : key === 'appPins' ? normalizeHatagoesAppPins(value) : key === 'cards' ? normalizeHatagoesCards(value) : key === 'cardsV3' ? normalizeHatagoesCardsV3(value) : normalizeHatagoesTheme(value);
		const operation = queue.then(async () => {
			await misskeyApi('i/registry/set', { scope, key, value: normalized });
			if (key === 'pins') pins.value = normalizeHatagoesPins(normalized);
			else if (key === 'hataskPins') {
				hataskPins.value = normalizeHatagoesHataskPins(normalized);
				if (!desktopPinsConfigured) hataskPinsDesktop.value = normalizeHatagoesHataskPinsDesktop(undefined, normalized);
			} else if (key === 'hataskPinsDesktop') {
				hataskPinsDesktop.value = normalizeHatagoesHataskPinsDesktop(normalized);
				desktopPinsConfigured = true;
			} else if (key === 'appPins') appPins.value = normalizeHatagoesAppPins(normalized);
			else if (key === 'cards') cards.value = normalizeHatagoesCards(normalized);
			else if (key === 'cardsV3') cardsV3.value = normalizeHatagoesCardsV3(normalized);
			else theme.value = normalizeHatagoesTheme(normalized);
			error.value = false;
		});
		queue = operation.catch(() => { error.value = true; });
		void queue.then(() => { if (queue === settled) saving.value = false; });
		const settled = queue;
		return operation;
	}

	return { pins, hataskPins, hataskPinsDesktop, appPins, cards, cardsV3, theme, ready, saving, error, load, save };
}
