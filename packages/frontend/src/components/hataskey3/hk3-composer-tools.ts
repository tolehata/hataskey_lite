/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';

// Hataskey UI 3 の投稿欄の「投稿機能」メニューと、ショートカット2枠で選べる機能。
export const HK3_COMPOSER_TOOL_IDS = ['poll', 'mention', 'hashtag', 'event', 'mfm', 'drawing', 'reactionAcceptance', 'full'] as const;
export type Hk3ComposerToolId = typeof HK3_COMPOSER_TOOL_IDS[number];
export const HK3_COMPOSER_SHORTCUT_SLOTS = 2;

export function hk3ComposerToolLabel(id: Hk3ComposerToolId): string {
	const copy = i18n.ts._hata._hataskeyUi3;
	return ({
		poll: copy.poll,
		mention: copy.mention,
		hashtag: copy.hashtag,
		event: copy.event,
		mfm: copy.mfm,
		drawing: copy.drawing,
		reactionAcceptance: copy.reactionAcceptance,
		full: copy.expandForm,
	} satisfies Record<Hk3ComposerToolId, string>)[id];
}

export const HK3_COMPOSER_SHORTCUT_NONE = 'none';
export const HK3_COMPOSER_SHORTCUT_OPTIONS = [HK3_COMPOSER_SHORTCUT_NONE, ...HK3_COMPOSER_TOOL_IDS] as const;
export const HK3_COMPOSER_EMOJI_POSITIONS = ['afterShortcuts', 'beforeVisibility'] as const;

/** 保存値(2枠)を揃える。'none'・未知の機能・重複は空き枠(＋)として扱う。 */
export function normalizeHk3ComposerShortcuts(first: unknown, second: unknown): (Hk3ComposerToolId | null)[] {
	const source = [first, second];
	const seen = new Set<string>();
	return Array.from({ length: HK3_COMPOSER_SHORTCUT_SLOTS }, (_, i) => {
		const id = source[i];
		if (typeof id !== 'string' || !(HK3_COMPOSER_TOOL_IDS as readonly string[]).includes(id) || seen.has(id)) return null;
		seen.add(id);
		return id as Hk3ComposerToolId;
	});
}
