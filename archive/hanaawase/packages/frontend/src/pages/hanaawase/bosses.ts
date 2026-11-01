/** 季節の障り。予告を必ず1手前に出す、Vue非依存のボス状態遷移。 */
import type { Board, Coord, Piece } from "./engine.js";
import type { Rng } from "./rng.js";

export type BossId = "haruare" | "samidare" | "nowaki" | "ooshimo";
export type BossEffectKind = "puddle" | "frozen";
export type BossAction =
	| Readonly<{ kind: "flow-column"; column: number; targets: readonly Coord[] }>
	| Readonly<{ kind: "puddle"; targets: readonly Coord[] }>
	| Readonly<{ kind: "swap-four"; targets: readonly Coord[] }>
	| Readonly<{ kind: "freeze"; targets: readonly Coord[] }>;
export type BossDefinition = Readonly<{
	id: BossId;
	name: string;
	month: 3 | 6 | 9 | 12;
	hp: number;
	cycle: number;
	targetCount: number;
	action: BossAction["kind"];
}>;
export type BossState = Readonly<{
	id: BossId;
	hp: number;
	movesTaken: number;
	telegraph?: BossAction;
	effects: Readonly<Record<BossEffectKind, readonly Coord[]>>;
}>;
export type BossTurn = Readonly<{
	state: BossState;
	action?: BossAction;
}>;

export const BOSSES: Readonly<Record<BossId, BossDefinition>> = {
	haruare: { id: "haruare", name: "春荒", month: 3, hp: 120, cycle: 2, targetCount: 8, action: "flow-column" },
	samidare: { id: "samidare", name: "五月雨", month: 6, hp: 150, cycle: 3, targetCount: 2, action: "puddle" },
	nowaki: { id: "nowaki", name: "野分", month: 9, hp: 180, cycle: 4, targetCount: 4, action: "swap-four" },
	ooshimo: { id: "ooshimo", name: "大霜", month: 12, hp: 220, cycle: 3, targetCount: 2, action: "freeze" },
};

const key = ({ row, col }: Coord) => `${row}:${col}`;
const unique = (cells: readonly Coord[]) => [...new Map(cells.map((cell) => [key(cell), cell])).values()];
const coordinates = (board: Board): Coord[] =>
	board.flatMap((cells, row) => cells.map((_, col) => ({ row, col })));
const sample = (cells: readonly Coord[], count: number, rng: Rng) => {
	const pool = [...cells];
	for (let index = pool.length - 1; index > 0; index--) {
		const other = Math.floor(rng() * (index + 1));
		[pool[index], pool[other]] = [pool[other], pool[index]];
	}
	return pool.slice(0, count);
};
const cap = (board: Board) => Math.floor((board.length * (board[0]?.length ?? 0)) / 3);

export const createBossState = (id: BossId): BossState => ({
	id,
	hp: BOSSES[id].hp,
	movesTaken: 0,
	effects: { puddle: [], frozen: [] },
});

const telegraphFor = (state: BossState, board: Board, rng: Rng): BossAction => {
	const definition = BOSSES[state.id];
	if (definition.action === "flow-column") {
		const column = Math.floor(rng() * (board[0]?.length ?? 1));
		return { kind: "flow-column", column, targets: board.map((_, row) => ({ row, col: column })) };
	}
	const blocked = new Set([...state.effects.puddle, ...state.effects.frozen].map(key));
	const targets = sample(coordinates(board).filter((cell) => !blocked.has(key(cell))), definition.targetCount, rng);
	if (definition.action === "puddle") return { kind: "puddle", targets };
	if (definition.action === "swap-four") return { kind: "swap-four", targets };
	return { kind: "freeze", targets };
};

/** プレイヤーが1手終えた直後に呼ぶ。予告済みなら発動、なければ次手用の予告を置く。 */
export const advanceBoss = (state: BossState, board: Board, rng: Rng): BossTurn => {
	const movesTaken = state.movesTaken + 1;
	if (state.telegraph) {
		const action = state.telegraph;
		const effects = { ...state.effects };
		if (action.kind === "puddle" || action.kind === "freeze") {
			const kind: BossEffectKind = action.kind === "freeze" ? "frozen" : "puddle";
			effects[kind] = unique([...effects[kind], ...action.targets]).slice(0, cap(board));
		}
		return { state: { ...state, movesTaken, telegraph: undefined, effects }, action };
	}
	const definition = BOSSES[state.id];
	if (movesTaken % definition.cycle === definition.cycle - 1) {
		return { state: { ...state, movesTaken, telegraph: telegraphFor(state, board, rng) } };
	}
	return { state: { ...state, movesTaken } };
};

/** 特殊ピースによる消去は2点、通常消去は1点。連鎖倍率はボスへ持ち込まない。 */
export const bossDamage = (before: Board, removed: readonly Coord[]) =>
	removed.reduce((total, { row, col }) => total + (before[row]?.[col]?.special ? 2 : 1), 0);

export const applyBossDamage = (state: BossState, damage: number): BossState => ({
	...state,
	hp: Math.max(0, state.hp - Math.max(0, damage)),
});

/** 盤面を動かす2種の天候行動。雨溜まり・凍結はstate.effectsで表す。 */
export const applyBossAction = (board: Board, action: BossAction): Board => {
	if (action.kind !== "flow-column" && action.kind !== "swap-four") return board;
	const next = board.map((row) => [...row]);
	if (action.kind === "flow-column") {
		const columns = next[0]?.length ?? 0;
		if (columns < 2 || action.column < 0 || action.column >= columns) return board;
		const destination = (action.column + 1) % columns;
		for (let row = 0; row < next.length; row++) {
			[next[row][action.column], next[row][destination]] = [
				next[row][destination],
				next[row][action.column],
			];
		}
		return next;
	}
	const pieces = action.targets.map(({ row, col }) => next[row]?.[col]);
	for (const [index, { row, col }] of action.targets.entries()) {
		if (!next[row]) continue;
		next[row][col] = pieces[(index - 1 + pieces.length) % pieces.length] ?? null;
	}
	return next;
};

/** 雨溜まり・凍結は隣接消去を1回受けたときだけ解ける。 */
export const clearBossEffects = (state: BossState, removed: readonly Coord[]): BossState => {
	const adjacent = (target: Coord) => removed.some((cell) => Math.abs(cell.row - target.row) + Math.abs(cell.col - target.col) === 1);
	return {
		...state,
		effects: {
			puddle: state.effects.puddle.filter((cell) => !adjacent(cell)),
			frozen: state.effects.frozen.filter((cell) => !adjacent(cell)),
		},
	};
};

export const isSwapBlocked = (state: BossState, a: Coord, b: Coord) =>
	state.effects.frozen.some((cell) => key(cell) === key(a) || key(cell) === key(b));

export const isMatchBlocked = (state: BossState, cell: Coord) =>
	state.effects.puddle.some((effect) => key(effect) === key(cell));

export const bossActionPieces = (board: Board, action: BossAction): readonly Piece[] =>
	action.targets.flatMap(({ row, col }) => {
		const piece = board[row]?.[col];
		return piece ? [piece] : [];
	});
