/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getGroup, getStone, oppositeColor } from './rules/board.js';
import { applyGameAction, createGame } from './rules/game.js';
import { scoreJapanese } from './rules/score.js';
import { getLevelBudget } from './engine/levels.js';
import type { SearchInput, SearchResult } from './engine/client.js';
import type { BoardSize, Color, Point } from './rules/board.js';
import type { GameAction, GameState } from './rules/game.js';
import type { AiRecord } from './ai-records.js';

export interface AiSearchClient {
	search(input: SearchInput, options?: { onProgress?: (snapshot: SearchResult) => void }): Promise<SearchResult>;
	cancel(): void;
	dispose(): void;
}

export type AiGameOptions = { id: string; size: BoardSize; handicap: number; ownColor: Color; level: string; komi?: number };
export type AiActionResult = { ok: true } | { ok: false; reason: string };
export type EstimatePoint = { move: number; margin: number | null };

/** Local human/AI game orchestration. It never infers dead stones. The only
 * scoring marks are the user's group/empty-point selections, and accepting
 * them is an explicit action. Search output remains a separate estimate.
 */
export class AiGameSession {
	state: GameState;
	busy = false;
	paused = false;
	enabled = true;
	error: string | null = null;
	purpose: 'ai' | 'hint' | 'estimate' | null = null;
	analysis: SearchResult | null = null;
	progress: SearchResult | null = null;
	/** AI が直前に打った手と、そのときの読み（打った直後に analysis は消えるので別に持つ） */
	lastAiThought: { result: SearchResult; moveNumber: number } | null = null;
	private snapshots: GameState[];
	private estimates = new Map<number, SearchResult>();
	private generation = 0;
	private client: AiSearchClient | undefined;

	constructor(readonly options: AiGameOptions, private createClient: () => AiSearchClient, private changed: () => void = () => {}) {
		this.state = createGame({ size: options.size, handicap: options.handicap, komi: options.komi });
		this.snapshots = [this.state];
	}

	get canPlay(): boolean {
		return this.enabled && !this.busy && this.state.phase === 'playing' && this.state.toPlay === this.options.ownColor;
	}

	get graph(): EstimatePoint[] {
		return [...this.estimates].sort(([a], [b]) => a - b).map(([move, result]) => ({ move, margin: result.estimatedMargin }));
	}

	get score() {
		return scoreJapanese(this.state.board, this.state.scoring, this.state.prisoners, this.state.komi);
	}

	private notify(): void {
		this.changed();
	}

	private isCurrentSearch(generation: number): boolean {
		return generation === this.generation && this.enabled;
	}

	private isCurrentGeneration(generation: number): boolean {
		return generation === this.generation;
	}

	private canApplyAiResult(result: SearchResult | null): result is SearchResult {
		return result !== null && this.enabled && !this.paused && this.state.phase === 'playing';
	}

	private commit(action: GameAction): AiActionResult {
		const applied = applyGameAction(this.state, action);
		if (!applied.ok) return applied;
		this.state = applied.state;
		this.snapshots.push(this.state);
		this.analysis = null;
		this.progress = null;
		this.error = null;
		this.notify();
		return { ok: true };
	}

	async play(point: Point | null): Promise<AiActionResult> {
		if (!this.canPlay) return { ok: false, reason: 'notYourTurn' };
		const color = this.options.ownColor;
		const applied = this.commit(point === null ? { type: 'pass', color } : { type: 'play', color, point });
		if (!applied.ok) return applied;
		this.paused = false;
		if (this.state.phase === 'playing') await this.resume();
		return { ok: true };
	}

	private async search(purpose: 'ai' | 'hint' | 'estimate'): Promise<SearchResult | null> {
		if (!this.enabled || this.busy || this.state.phase === 'finished') return null;
		const generation = ++this.generation;
		this.busy = true;
		this.purpose = purpose;
		this.error = null;
		this.progress = null;
		this.notify();
		try {
			this.client ??= this.createClient();
			const result = await this.client.search({
				board: this.state.board, previousBoard: this.state.previousBoard,
				toPlay: this.state.toPlay, consecutivePasses: this.state.consecutivePasses,
				prisoners: this.state.prisoners, komi: this.state.komi,
				budget: getLevelBudget(this.options.level, this.state.board.size),
			}, { onProgress: snapshot => { if (this.isCurrentSearch(generation)) { this.progress = snapshot; this.notify(); } } });
			if (!this.isCurrentSearch(generation)) return null;
			this.analysis = result;
			this.estimates.set(this.state.moves.length, result);
			return result;
		} catch (error) {
			if (this.isCurrentSearch(generation)) {
				this.error = error instanceof Error && error.name === 'AbortError' ? null : 'engine';
				this.paused = true;
			}
			return null;
		} finally {
			if (this.isCurrentGeneration(generation)) { this.busy = false; this.purpose = null; this.notify(); }
		}
	}

	async resume(): Promise<void> {
		if (!this.enabled || this.busy || this.state.phase !== 'playing') return;
		this.paused = false;
		if (this.state.toPlay === this.options.ownColor) { this.notify(); return; }
		const result = await this.search('ai');
		if (!this.canApplyAiResult(result)) return;
		const color = oppositeColor(this.options.ownColor);
		const applied = this.commit(result.move === null ? { type: 'pass', color } : { type: 'play', color, point: result.move });
		if (!applied.ok) { this.error = 'invalidAiMove'; this.paused = true; this.notify(); return; }
		this.lastAiThought = { result, moveNumber: this.state.moves.length };
		this.notify();
	}

	async analyze(purpose: 'hint' | 'estimate'): Promise<void> {
		if (this.state.phase === 'finished') return;
		await this.search(purpose);
	}

	cancel(): void {
		this.generation++;
		this.client?.cancel();
		this.busy = false;
		this.purpose = null;
		this.progress = null;
		this.paused = true;
		this.notify();
	}

	undo(): boolean {
		if (this.snapshots.length <= 1 || this.state.phase === 'finished') return false;
		this.cancel();
		this.snapshots.pop();
		this.state = this.snapshots[this.snapshots.length - 1];
		this.analysis = null;
		this.error = null;
		for (const move of this.estimates.keys()) if (move > this.state.moves.length) this.estimates.delete(move);
		if (this.lastAiThought !== null && this.lastAiThought.moveNumber > this.state.moves.length) this.lastAiThought = null;
		// A one-move undo must remain visible until the user explicitly resumes.
		this.paused = true;
		this.notify();
		return true;
	}

	mark(point: Point): boolean {
		if (!this.enabled || this.busy || this.state.phase !== 'scoring') return false;
		let deadStones = [...this.state.scoring.deadStones];
		let neutralPoints = [...this.state.scoring.neutralPoints];
		const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
		if (getStone(this.state.board, point) !== null) {
			const group = getGroup(this.state.board, point);
			if (group === null) return false;
			const remove = group.stones.every(stone => deadStones.some(mark => same(mark, stone)));
			deadStones = deadStones.filter(mark => !group.stones.some(stone => same(mark, stone)));
			if (!remove) deadStones.push(...group.stones);
		} else {
			neutralPoints = neutralPoints.some(mark => same(mark, point)) ? neutralPoints.filter(mark => !same(mark, point)) : [...neutralPoints, point];
		}
		const applied = applyGameAction(this.state, { type: 'setScoring', color: this.options.ownColor, marks: { deadStones, neutralPoints } });
		if (!applied.ok) return false;
		this.state = applied.state;
		this.notify();
		return true;
	}

	clearMarks(): void {
		if (this.state.phase !== 'scoring' || this.busy) return;
		const applied = applyGameAction(this.state, { type: 'setScoring', color: this.options.ownColor, marks: { deadStones: [], neutralPoints: [] } });
		if (applied.ok) { this.state = applied.state; this.notify(); }
	}

	confirmScore(): boolean {
		if (!this.enabled || this.busy || this.state.phase !== 'scoring') return false;
		const human = applyGameAction(this.state, { type: 'acceptScore', color: this.options.ownColor });
		if (!human.ok) return false;
		const ai = applyGameAction(human.state, { type: 'acceptScore', color: oppositeColor(this.options.ownColor) });
		if (!ai.ok) return false;
		this.cancel();
		this.state = ai.state;
		this.notify();
		return true;
	}

	resign(): boolean {
		if (!this.enabled || this.state.phase === 'finished') return false;
		this.cancel();
		const applied = this.commit({ type: 'resign', color: this.options.ownColor });
		return applied.ok;
	}

	finishedRecord(endedAt: string): AiRecord | null {
		const result = this.state.result;
		if (this.state.phase !== 'finished' || result === null || (result.reason !== 'score' && result.reason !== 'resign') || result.winner === null) return null;
		return { id: this.options.id, size: this.state.board.size, ownColor: this.options.ownColor, winner: result.winner, reason: result.reason, endedAt };
	}

	deactivate(): void {
		this.enabled = false;
		this.cancel();
		this.client?.dispose();
		this.client = undefined;
	}

	activate(): void {
		this.enabled = true;
		this.notify();
	}
}

/** Display ownership of empty intersections only. This never marks stones as
 * dead and never writes scoring marks. Unknown/no-sample ownership stays empty.
 */
export function ownershipMarks(state: { board: GameState['board'] }, result: SearchResult | null): { black: Point[]; white: Point[] } {
	const marks: { black: Point[]; white: Point[] } = { black: [], white: [] };
	if (result === null || result.ownership.samples === 0) return marks;
	state.board.cells.forEach((stone, index) => {
		if (stone !== null) return;
		const black = result.ownership.black[index] ?? 0;
		const white = result.ownership.white[index] ?? 0;
		const point = { x: index % state.board.size, y: Math.floor(index / state.board.size) };
		if (black >= 0.6 && black > white) marks.black.push(point);
		else if (white >= 0.6 && white > black) marks.white.push(point);
	});
	return marks;
}
