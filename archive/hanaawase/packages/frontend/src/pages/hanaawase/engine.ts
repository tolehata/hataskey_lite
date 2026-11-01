import type { Rng } from "./rng.js";

export const FLOWERS = [
	"matsu",
	"ume",
	"sakura",
	"ajisai",
	"himawari",
	"kiku",
] as const;
export type Flower = (typeof FLOWERS)[number];
export type Special = "tanzaku" | "mari" | "tsuki";
export type TanzakuAxis = "row" | "column";
export type Coord = Readonly<{ row: number; col: number }>;
export type Piece = Readonly<{
	flower: Flower;
	special?: Special;
	axis?: TanzakuAxis;
	outOfSeason?: boolean;
}>;
export type Board = ReadonlyArray<ReadonlyArray<Piece | null>>;
export type Match = Readonly<{
	cells: Coord[];
	flower: Flower;
	direction: TanzakuAxis;
}>;
export type Spawn = Readonly<{ at: Coord; piece: Piece }>;
/** 連鎖1段ぶんの中間状態。消去→整地→補充を段ごとに再生するために使う。 */
export type ResolutionStep = Readonly<{
	/** この段で消えたマスと、消える直前の駒。 */
	removed: { at: Coord; piece: Piece }[];
	/** この段で生成された特殊ピース。 */
	spawn?: Spawn;
	/** この段で起爆した特殊ピースの種類。 */
	detonated: Special[];
	/** rows×cols。整地後の [row][col] にある駒が、この段で落ちたマス数（0=不動）。 */
	drops: number[][];
	/** この段の整地・補充まで終えた盤面。 */
	board: Board;
	/** 1始まりの連鎖段数。 */
	cascade: number;
	/** この段の獲得点。 */
	gained: number;
}>;
export type Resolution = Readonly<{
	board: Board;
	removed: Coord[];
	spawns: Spawn[];
	collected: Partial<Record<Flower, number>>;
	cascade: number;
	score: number;
	returnedMoves: number;
	/** 連鎖の中間状態。畳み込むと上の集計値に一致する。 */
	steps: ResolutionStep[];
}>;

const key = ({ row, col }: Coord) => `${row}:${col}`;
const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;
const inside = (board: Board, { row, col }: Coord) =>
	row >= 0 && row < board.length && col >= 0 && col < (board[0]?.length ?? 0);
const clone = (board: Board): (Piece | null)[][] =>
	board.map((row) => [...row]);
const coordinates = (board: Board): Coord[] =>
	board.flatMap((row, rowIndex) =>
		row.map((_, col) => ({ row: rowIndex, col })),
	);
const unique = (cells: Iterable<Coord>) => [
	...new Map([...cells].map((cell) => [key(cell), cell])).values(),
];
const isFlower = (value: string): value is Flower =>
	(FLOWERS as readonly string[]).includes(value);

export const createPiece = (
	flower: Flower,
	special?: Special,
	axis?: TanzakuAxis,
): Piece => ({
	flower,
	...(special ? { special } : {}),
	...(axis ? { axis } : {}),
});

export const areAdjacent = (a: Coord, b: Coord) =>
	Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

export const swap = (board: Board, a: Coord, b: Coord): Board => {
	if (!inside(board, a) || !inside(board, b)) throw new RangeError("盤面外のマスは入れ替えられません");
	const next = clone(board);
	[next[a.row][a.col], next[b.row][b.col]] = [
		next[b.row][b.col],
		next[a.row][a.col],
	];
	return next;
};

export const findMatches = (board: Board, blockedCells: readonly Coord[] = []): Match[] => {
	const blocked = new Set(blockedCells.map(key));
	const matches: Match[] = [];
	for (let row = 0; row < board.length; row++) {
		let col = 0;
		while (col < (board[row]?.length ?? 0)) {
			const flower = blocked.has(key({ row, col })) ? undefined : board[row][col]?.flower;
			let end = col + 1;
			while (flower && !blocked.has(key({ row, col: end })) && board[row][end]?.flower === flower) end++;
			if (flower && end - col >= 3) matches.push({
					flower,
					direction: "row",
					cells: Array.from({ length: end - col }, (_, i) => ({
						row,
						col: col + i,
					})),
			});
			col = end;
		}
	}
	for (let col = 0; col < (board[0]?.length ?? 0); col++) {
		let row = 0;
		while (row < board.length) {
			const flower = blocked.has(key({ row, col })) ? undefined : board[row][col]?.flower;
			let end = row + 1;
			while (flower && !blocked.has(key({ row: end, col })) && board[end]?.[col]?.flower === flower) end++;
			if (flower && end - row >= 3) matches.push({
					flower,
					direction: "column",
					cells: Array.from({ length: end - row }, (_, i) => ({
						row: row + i,
						col,
					})),
			});
			row = end;
		}
	}
	return matches;
};

export const matchedCells = (board: Board, blockedCells: readonly Coord[] = []) =>
	unique(findMatches(board, blockedCells).flatMap((match) => match.cells));

/** 開始時の自然消去を避け、少なくとも1手ある盤面をシード付き乱数で作る。 */
export const createBoard = (
	rows: number,
	columns: number,
	colors: readonly Flower[],
	rng: Rng,
	maxAttempts = 100,
): Board => {
	if (rows < 3 || columns < 3 || colors.length < 3) throw new RangeError("盤面は3以上、花は3種以上必要です");
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const next: Piece[][] = [];
		for (let row = 0; row < rows; row++) {
			next[row] = [];
			for (let col = 0; col < columns; col++) {
				const forbidden = new Set<Flower>();
				if (col >= 2 && next[row][col - 1].flower === next[row][col - 2].flower) forbidden.add(next[row][col - 1].flower);
				if (row >= 2 && next[row - 1][col].flower === next[row - 2][col].flower) forbidden.add(next[row - 1][col].flower);
				const choices = colors.filter((flower) => !forbidden.has(flower));
				next[row][col] = createPiece(
					choices[Math.floor(rng() * choices.length)],
				);
			}
		}
		if (hasPossibleMove(next)) return next;
	}
	throw new Error("開始可能な盤面を作れませんでした");
};

export const hasPossibleMove = (board: Board, blockedCells: readonly Coord[] = []): boolean =>
	coordinates(board).some((cell) =>
		[
			{ row: cell.row + 1, col: cell.col },
			{ row: cell.row, col: cell.col + 1 },
		]
			.filter((other) => inside(board, other))
			.some((other) => {
				const left = board[cell.row][cell.col],
					right = board[other.row][other.col];
				return Boolean(
					left?.special ||
						right?.special ||
						matchedCells(swap(board, cell, other), blockedCells).length,
				);
			}),
	);

export const specialFor = (runs: Match[], at: Coord): Piece | undefined => {
	const touching = runs.filter((run) =>
		run.cells.some((cell) => same(cell, at)),
	);
	if (!touching.length) return undefined;
	const crossing = touching.some((a) =>
		touching.some((b) => a !== b && a.direction !== b.direction),
	);
	const longest = Math.max(...touching.map((run) => run.cells.length));
	const flower = touching[0].flower;
	if (crossing) return createPiece(flower, "mari");
	if (longest >= 5) return createPiece(flower, "tsuki");
	if (longest === 4) return createPiece(
			flower,
			"tanzaku",
			touching[0].direction === "row" ? "column" : "row",
		);
	return undefined;
};

const line = (board: Board, at: Coord, axis: TanzakuAxis, width = 1) =>
	coordinates(board).filter((cell) =>
		axis === "row"
			? Math.abs(cell.row - at.row) <= Math.floor(width / 2)
			: Math.abs(cell.col - at.col) <= Math.floor(width / 2),
	);
const square = (board: Board, at: Coord, radius: number) =>
	coordinates(board).filter(
		(cell) =>
			Math.abs(cell.row - at.row) <= radius &&
			Math.abs(cell.col - at.col) <= radius,
	);
const color = (board: Board, flower: Flower) =>
	coordinates(board).filter(
		(cell) => board[cell.row][cell.col]?.flower === flower,
	);

/** 特殊ピース同士、または特殊ピースと通常花を起爆したときの消去範囲。 */
export const specialTargets = (board: Board, a: Coord, b?: Coord): Coord[] => {
	const first = board[a.row]?.[a.col];
	const second = b ? board[b.row]?.[b.col] : undefined;
	if (!first?.special) return [];
	if (!second?.special) {
		if (first.special === "tanzaku") return line(board, a, first.axis ?? "row");
		if (first.special === "mari") return square(board, a, 1);
		return second ? color(board, second.flower) : [a];
	}
	if (first.special === "tsuki" && second.special === "tsuki") return coordinates(board);
	if (first.special === "tsuki") {
		const changed = color(board, second.flower);
		return unique(
			changed.flatMap((cell) =>
				second.special === "tanzaku"
					? line(board, cell, second.axis ?? "row")
					: square(board, cell, 1),
			),
		);
	}
	if (second.special === "tsuki") {
		const changed = color(board, first.flower);
		return unique(
			changed.flatMap((cell) =>
				first.special === "tanzaku"
					? line(board, cell, first.axis ?? "row")
					: square(board, cell, 1),
			),
		);
	}
	if (first.special === "mari" && second.special === "mari") return square(board, a, 2);
	if (first.special === "tanzaku" && second.special === "tanzaku") return unique([...line(board, a, "row"), ...line(board, a, "column")]);
	const tanzaku =
		first.special === "tanzaku"
			? { piece: first, at: a }
			: { piece: second, at: b ?? a };
	return line(board, tanzaku.at, tanzaku.piece.axis ?? "row", 3);
};

/**
 * 空マスを詰めて上から補充し、副産物として各駒の落下距離を返す。
 * 残存駒は「自分より下で消えた数」、新規駒はその列で消えた数だけ落ちる。
 */
const refill = (
	board: (Piece | null)[][],
	colors: readonly Flower[],
	rng: Rng,
): Readonly<{ board: (Piece | null)[][]; drops: number[][] }> => {
	const rows = board.length;
	const columns = board[0]?.length ?? 0;
	const next = Array.from({ length: rows }, () =>
		Array.from({ length: columns }, () => null as Piece | null),
	);
	const drops = Array.from({ length: rows }, () =>
		Array.from({ length: columns }, () => 0),
	);
	for (let col = 0; col < columns; col++) {
		const retained = board
			.map((row, index) => ({ piece: row[col], row: index }))
			.filter(
				(entry): entry is { piece: Piece; row: number } => entry.piece !== null,
			);
		const missing = rows - retained.length;
		const filled = Array.from({ length: missing }, () =>
			createPiece(colors[Math.floor(rng() * colors.length)]),
		);
		for (let index = 0; index < missing; index++) {
			next[index][col] = filled[index];
			drops[index][col] = missing;
		}
		for (const [index, entry] of retained.entries()) {
			const landed = missing + index;
			next[landed][col] = entry.piece;
			drops[landed][col] = landed - entry.row;
		}
	}
	return { board: next, drops };
};

export const resolve = (
	initial: Board,
	colors: readonly Flower[],
	rng: Rng,
	initialRemoved: Coord[] = [],
	blockedCells: readonly Coord[] = [],
): Resolution => {
	let board = clone(initial);
	let pending = initialRemoved;
	let cascade = 0;
	let score = 0;
	let returnedMoves = 0;
	const removed: Coord[] = [];
	const spawns: Spawn[] = [];
	const steps: ResolutionStep[] = [];
	const collected: Partial<Record<Flower, number>> = {};
	while (pending.length || findMatches(board, blockedCells).length) {
		const runs = findMatches(board, blockedCells);
		const baseCells = unique([...pending, ...runs.flatMap((run) => run.cells)]);
		pending = [];
		const detonated = baseCells
			.map((cell) => board[cell.row][cell.col]?.special)
			.filter((kind): kind is Special => kind !== undefined);
		const cells = unique([
			...baseCells,
			...baseCells.flatMap((cell) =>
				board[cell.row][cell.col]?.special ? specialTargets(board, cell) : [],
			),
		]);
		if (!cells.length) break;
		cascade++;
		const spawnAt =
			cells.find((cell) => board[cell.row][cell.col]?.special == null) ??
			cells[0];
		const special = specialFor(runs, spawnAt);
		const stepRemoved: { at: Coord; piece: Piece }[] = [];
		let gained = 0;
		for (const cell of cells) {
			const piece = board[cell.row][cell.col];
			if (!piece) continue;
			board[cell.row][cell.col] = null;
			removed.push(cell);
			stepRemoved.push({ at: cell, piece });
			collected[piece.flower] = (collected[piece.flower] ?? 0) + 1;
			if (piece.outOfSeason) {
				returnedMoves++;
				gained += 500;
			}
		}
		const spawn = special ? { at: spawnAt, piece: special } : undefined;
		if (spawn) {
			board[spawn.at.row][spawn.at.col] = spawn.piece;
			spawns.push(spawn);
		}
		gained += cells.length * 10 * (1 + (cascade - 1) * 0.5);
		score += gained;
		const refilled = refill(board, colors, rng);
		board = refilled.board;
		steps.push({
			removed: stepRemoved,
			...(spawn ? { spawn } : {}),
			detonated,
			drops: refilled.drops,
			// 次の段で board を破壊的に書き換えるため、段ごとに複製して保持する。
			board: clone(board),
			cascade,
			gained,
		});
	}
	return {
		board,
		removed: unique(removed),
		spawns,
		collected,
		cascade,
		score,
		returnedMoves,
		steps,
	};
};

export const playSwap = (
	board: Board,
	a: Coord,
	b: Coord,
	colors: readonly Flower[],
	rng: Rng,
	blockedCells: readonly Coord[] = [],
): Readonly<{ accepted: boolean; board: Board; resolution?: Resolution }> => {
	if (!areAdjacent(a, b) || !inside(board, a) || !inside(board, b)) return { accepted: false, board };
	const swapped = swap(board, a, b);
	const targets = unique([
		...specialTargets(swapped, a, b),
		...specialTargets(swapped, b, a),
	]);
	if (!targets.length && !matchedCells(swapped, blockedCells).length) return { accepted: false, board };
	const resolution = resolve(swapped, colors, rng, targets, blockedCells);
	return { accepted: true, board: resolution.board, resolution };
};

/** 自動シャッフルと打ち水で共用する、特殊ピースを保った並べ替え処理。 */
export const shuffleBoard = (
	board: Board,
	rng: Rng,
	maxAttempts = 100,
): Board => {
	const pieces = coordinates(board)
		.map((cell) => board[cell.row][cell.col])
		.filter((piece): piece is Piece => piece !== null);
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const shuffled = [...pieces];
		for (let index = shuffled.length - 1; index > 0; index--) {
			const target = Math.floor(rng() * (index + 1));
			[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
		}
		let offset = 0;
		const next = board.map((row) =>
			row.map(() => {
				const piece = shuffled[offset++];
				if (!piece) throw new Error("シャッフル対象の駒が不足しています");
				return piece;
			}),
		);
		if (!findMatches(next).length && hasPossibleMove(next)) return next;
	}
	throw new Error("有効な盤面を作れませんでした");
};

export const automaticShuffle = shuffleBoard;
export const uchimizuShuffle = shuffleBoard;
export { isFlower };
