/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// The how-to-play steps. Every diagram here is original to HataIgo; the wording is ours
// (no rule text is quoted from any federation's rulebook).

import { createBoard, playMove } from './rules/board.js';
import type { Board, Point } from './rules/board.js';
import type { BoardHint, BoardTerritory } from './board-presentation.js';

export type Lesson = {
	readonly id: string;
	readonly title: string;
	readonly line: string;
	readonly board: Board;
	readonly hints?: readonly BoardHint[];
	readonly territory?: BoardTerritory;
	/** When set, the learner plays black and the step is cleared by `cleared`. */
	readonly tryIt?: { readonly prompt: string; readonly done: string; readonly cleared: (before: Board, after: Board, point: Point) => boolean };
};

const p = (x: number, y: number): Point => ({ x, y });

export const LESSONS: readonly Lesson[] = [
	{
		id: 'place',
		title: '線の交わるところに置く',
		line: '黒から、交互に1つずつ。置いた石は動かしません。',
		board: createBoard(9, { black: [p(2, 2), p(6, 6)], white: [p(6, 2)] }),
		tryIt: { prompt: '好きなところに黒を置いてみよう', done: 'いいね。これで1手。', cleared: () => true },
	},
	{
		id: 'capture',
		title: 'まわりをふさぐと取れる',
		line: '石のとなり（上下左右）が全部ふさがると、盤から取りのぞかれます。',
		board: createBoard(9, { black: [p(3, 4), p(4, 3), p(5, 4)], white: [p(4, 4)] }),
		tryIt: { prompt: '白を取ってみよう', done: '取れた！ 取った石は自分の得点になります。', cleared: (_before, after) => after.cells[4 * 9 + 4] === null },
	},
	{
		id: 'no-entry',
		title: '置いたとたん取られる所には打てない',
		line: '×の所に黒を置くと、まわりが白だけで息ができません。ただし相手を取れるなら打てます。',
		board: createBoard(9, { white: [p(3, 4), p(4, 3), p(5, 4), p(4, 5)] }),
		hints: [{ point: p(4, 4), kind: 'failure' }],
	},
	{
		id: 'ko',
		title: 'すぐの取り返しはなし（コウ）',
		line: '黒が白を1つ取った直後の形。白が×ですぐ取り返すと、同じ形がくり返されます。1回ほかに打ってからなら取り返せます。',
		board: createBoard(9, { black: [p(3, 4), p(4, 3), p(4, 5), p(5, 4)], white: [p(5, 3), p(6, 4), p(5, 5)] }),
		hints: [{ point: p(4, 4), kind: 'failure' }],
	},
	{
		id: 'count',
		title: '二人ともパスしたら数える',
		line: '囲んだ空き（地）と取った石が多いほうの勝ち。白にはあとから打つぶんのコミが足されます。',
		board: createBoard(9, {
			black: [p(3, 0), p(3, 1), p(3, 2), p(3, 3), p(3, 4), p(3, 5), p(3, 6), p(3, 7), p(3, 8)],
			white: [p(5, 0), p(5, 1), p(5, 2), p(5, 3), p(5, 4), p(5, 5), p(5, 6), p(5, 7), p(5, 8)],
		}),
		territory: {
			black: Array.from({ length: 9 }, (_, y) => [p(0, y), p(1, y), p(2, y)]).flat(),
			white: Array.from({ length: 9 }, (_, y) => [p(6, y), p(7, y), p(8, y)]).flat(),
		},
	},
];

/** Plays black for a try-it step. Returns the new board, or the reason it was refused. */
export function tryLessonMove(board: Board, point: Point): { ok: true; board: Board } | { ok: false; message: string } {
	const result = playMove(board, 'black', point);
	if (result.ok) return { ok: true, board: result.board };
	return { ok: false, message: result.reason === 'occupied' ? 'そこにはもう石があります' : result.reason === 'suicide' ? 'そこは打てない場所です' : 'そこには打てません' };
}
