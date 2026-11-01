/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import type { entities } from 'cherrypick-js';
import { getLtlEmojiVoteAnchor } from '@/utility/ltl-emoji-vote-anchor.js';

const note = {
	id: 'trigger', text: '絵文字を選ぶぞ', userId: 'author',
	user: { id: 'author', host: null }, visibility: 'public', channelId: null,
	files: [],
} as unknown as entities.Note;
const me = { id: 'viewer' } as entities.UserLite;
const defaults = { mutedWords: [], withSensitive: true };

describe('LTL emoji vote anchor', () => {
	it('attaches only to the actual visible trigger, including a whitespace-normalized post', () => {
		expect(getLtlEmojiVoteAnchor([note], 'trigger', me, defaults)).toBe('trigger');
		expect(getLtlEmojiVoteAnchor([{ ...note, text: '　絵文字を選ぶぞ\n' }], 'trigger', me, defaults)).toBe('trigger');
		expect(getLtlEmojiVoteAnchor([note], 'another-round', me, defaults)).toBeNull();
		expect(getLtlEmojiVoteAnchor([], 'trigger', me, defaults)).toBeNull();
	});
	it.each([
		{ isHidden: true },
		{ text: null },
		{ text: '「絵文字を選ぶぞ」と投稿する' },
		{ visibility: 'home' },
		{ visibility: 'specified' },
		{ channelId: 'channel' },
		{ user: { ...note.user, host: 'remote.invalid' } },
	])('does not expose an event for an ineligible or hidden note: %j', patch => {
		expect(getLtlEmojiVoteAnchor([{ ...note, ...patch } as entities.Note], 'trigger', me, defaults)).toBeNull();
	});
	it('respects existing keyword and regexp mute rules for the trigger, reply, and quote', () => {
		expect(getLtlEmojiVoteAnchor([note], 'trigger', me, { ...defaults, mutedWords: [['絵文字']] })).toBeNull();
		for (const field of ['reply', 'renote']) {
			const linked = { ...note, [field]: { ...note, id: 'quoted', text: 'spoiler' } };
			expect(getLtlEmojiVoteAnchor([linked], 'trigger', me, { ...defaults, mutedWords: ['/spoiler/i'] })).toBeNull();
			expect(getLtlEmojiVoteAnchor([linked], 'trigger', me, defaults)).toBe('trigger');
		}
	});
	it('hides rows for sensitive-filtered media and hidden linked notes', () => {
		const sensitive = { ...note, files: [{ isSensitive: true }] } as entities.Note;
		expect(getLtlEmojiVoteAnchor([sensitive], 'trigger', me, { ...defaults, withSensitive: false })).toBeNull();
		expect(getLtlEmojiVoteAnchor([sensitive], 'trigger', me, defaults)).toBe('trigger');
		expect(getLtlEmojiVoteAnchor([{ ...note, renote: { ...note, isHidden: true } }], 'trigger', me, defaults)).toBeNull();
	});
});
