/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { canViewHataigo } from '@/misc/hataigo/access.js';
import type { MiHataigoGame } from '@/models/HataigoGame.js';

type ViewableGame = Parameters<typeof canViewHataigo>[0];
const privateGame: ViewableGame = { user1Id: 'alice', user2Id: 'bob', phase: 'playing', allowSpectate: false, publicAfterEnd: false };
const cases: { game: ViewableGame; viewer: string | null; allowed: boolean }[] = [
	{ game: privateGame, viewer: 'alice', allowed: true }, { game: privateGame, viewer: 'stranger', allowed: false }, { game: privateGame, viewer: null, allowed: false },
	{ game: { ...privateGame, phase: 'waiting', allowSpectate: true }, viewer: 'stranger', allowed: false },
	{ game: { ...privateGame, allowSpectate: true }, viewer: 'stranger', allowed: true },
	{ game: { ...privateGame, phase: 'ended', allowSpectate: true }, viewer: 'stranger', allowed: false },
	{ game: { ...privateGame, phase: 'ended', publicAfterEnd: true }, viewer: null, allowed: true },
	{ game: { ...privateGame, user2Id: null, phase: 'ended', publicAfterEnd: true }, viewer: 'stranger', allowed: false },
];

function permissionViolations(check: (game: ViewableGame, viewer: string | null) => boolean) {
	return cases.filter(item => check(item.game, item.viewer) !== item.allowed);
}

test('positive control catches an unsafe permission implementation, then all visibility cases pass', () => {
	expect(permissionViolations(() => true).length).toBeGreaterThan(0);
	expect(permissionViolations(canViewHataigo)).toEqual([]);
});

test('unrelated moderator-shaped records do not gain participant privileges', () => {
	const game = { ...privateGame } as MiHataigoGame;
	expect(canViewHataigo(game, 'moderator')).toBe(false);
});
