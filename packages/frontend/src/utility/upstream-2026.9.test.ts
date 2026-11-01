/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { entities } from 'cherrypick-js';
import { getEmojiNameFromReaction, isLocalCustomEmojiReaction, normalizeCustomEmojiName, getCustomEmojiImagePath } from '@@/js/emoji-name.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { getType, isPreviewable } from '@/utility/lightbox.js';

const note = (text: string | null, cw: string | null = null) => ({ userId: 'author', text, cw }) as entities.Note;

describe('タイムラインで共有するワードミュート判定', () => {
	test('繰り返し使うg付き正規表現がノートごとに同じ結果を返す', () => {
		const filters = ['/旗/g'];
		for (let i = 0; i < 5; i++) expect(checkWordMute(note('旗鯖'), null, filters)).toEqual(filters);
		expect(checkWordMute(note('別の文章'), null, filters)).toBe(false);
	});

	test('空語を除いてAND条件を評価し、CWも判定する', () => {
		const filters = [['', '旗', '鯖'], ['', '']];
		expect(checkWordMute(note('鯖', '旗'), null, filters)).toEqual([filters[0]]);
		expect(checkWordMute(note('旗'), null, filters)).toBe(false);
		expect(checkWordMute(note('文章'), null, [['', '']])).toBe(false);
	});

	test('不正な正規表現や空のノートで例外を出さず、自分の投稿はミュートしない', () => {
		expect(checkWordMute(note('旗'), null, ['/[/'])).toBe(false);
		expect(checkWordMute(note(null), null, [['旗']])).toBe(false);
		expect(checkWordMute(note('旗'), { id: 'author' } as entities.UserLite, [['旗']])).toBe(false);
	});
});

describe('ローカルとリモートの絵文字を区別する', () => {
	test.each([
		[':wave@.:', 'wave', true],
		[':wave@example.invalid:', 'wave@example.invalid', false],
		['👍', '👍', false],
	] as const)('%s の名前と利用可能な絵文字の判定', (reaction, name, local) => {
		expect(getEmojiNameFromReaction(reaction)).toBe(name);
		expect(isLocalCustomEmojiReaction(reaction)).toBe(local);
	});

	test('画像パスの構築でリモートホスト名を維持する', () => {
		expect(normalizeCustomEmojiName(':wave@.:')).toBe('wave');
		expect(getCustomEmojiImagePath('wave', null)).toBe('/emoji/wave.webp');
		expect(getCustomEmojiImagePath('wave', 'example.invalid')).toBe('/emoji/wave@example.invalid.webp');
	});
});

describe('画像・動画・音声のプレビュー対象', () => {
	test.each([['image/png', 'image'], ['video/mp4', 'video'], ['audio/mpeg', 'audio']] as const)('%s を正しいビューアーへ渡す', (mime, type) => {
		expect(isPreviewable(mime)).toBe(true);
		expect(getType(mime)).toBe(type);
	});

	test.each(['audio/midi', 'audio/x-midi', 'application/zip'])('%s は通常ファイルとして扱う', (mime) => {
		expect(isPreviewable(mime)).toBe(false);
	});
});
