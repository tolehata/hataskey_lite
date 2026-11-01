// 花常: メニューのキャラ演出（立ち絵＋吹き出し）の出し分けエンジン。
// 文脈(時間帯JST/当月/進行)でセリフをフィルタ → 出演castingを重みで決定 → セリフを重み抽選。
// ⚠️Math.random は使わない（本体規約）。乱数は seed を受け取る決定的RNG。呼び出し側が Date.now() 等を渡す。
// backend非依存・保存しない（BARKS同様セッション内のみ）。

import { timeOfDay } from './daytime';
import type { TimeOfDay } from './daytime';
import { MENU_LINES, MENU_CHARS } from './menu-lines';
import { MENU_LINES_2 } from './menu-lines-2';
import { MENU_LINES_3 } from './menu-lines-3';
import type { MenuLine, MenuCharId, MenuProg } from './menu-lines';

/** 全セリフ。⚠️追加分は menu-lines-N.ts に足し、ここで1行だけ結合する（既存ファイルは書き換えない）。 */
export const ALL_MENU_LINES: MenuLine[] = [...MENU_LINES, ...MENU_LINES_2, ...MENU_LINES_3];

export interface MenuContext {
	/** 判定基準時刻（時間帯の算出に使う）。 */
	now: Date;
	/** 花仕事の現在月 1-12。 */
	month: number;
	/** 物語進行の段階。 */
	prog: MenuProg;
}

/** 立ち絵バストアップ画像のパス（表情番号 = face）。webp（透過・軽量）。 */
export function bustupPath(char: MenuCharId, face: number): string {
	const n = Math.min(6, Math.max(1, Math.round(face)));
	return `/client-assets/hanaawase/chara/${char}/bustup_${n}.webp`;
}

/** 立ち絵ポーズ画像のパス。 */
export function posePath(char: MenuCharId, pose = 'a'): string {
	return `/client-assets/hanaawase/chara/${char}/pose_${pose}.webp`;
}

// --- 決定的RNG（xorshift32）。seed から再現可能。テスト可能。 ---
function makeRng(seed: number): () => number {
	let s = seed >>> 0;
	if (s === 0) s = 0x9e3779b9;
	return () => {
		s ^= s << 13; s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5; s >>>= 0;
		return s / 0x100000000;
	};
}

const PROG_RANK: Record<MenuProg, number> = { early: 0, mid: 1, late: 2 };

/** あるキャラの、文脈に合うセリフだけを返す。 */
export function eligibleLines(char: MenuCharId, ctx: MenuContext): MenuLine[] {
	const t = timeOfDay(ctx.now);
	return ALL_MENU_LINES.filter((l) => {
		if (l.char !== char) return false;
		if (l.time !== 'any' && l.time !== t) return false;
		if (l.month !== 'any' && !l.month.includes(ctx.month)) return false;
		// prog は段階一致のみ（early専用の一言は序盤だけ、late専用は終盤だけ出す）
		if (l.prog && l.prog !== ctx.prog) return false;
		return true;
	});
}

interface CastWeight { char: MenuCharId; w: number; }

/**
 * 出演（casting）の重み。既定は若菜（彼女の店）。時間帯・季節でゲストが顔を出す。
 * ⚠️ここは「誰がいつ立つか」の設計。絵・セリフを足すほど自然に賑わう。
 */
export function castingWeights(ctx: MenuContext): CastWeight[] {
	const t: TimeOfDay = timeOfDay(ctx.now);
	const list: CastWeight[] = [{ char: 'wakana', w: 100 }];
	// ⚠️レンは朝(市場)・昼(講義の合間)にも出す。ここを落とすと menu-lines.ts の
	//   time:'morning'/'day' のレンのセリフが永久に表示されない（実際に4本が死んでいた）。
	if (t === 'morning') list.push({ char: 'inukai', w: 22 }, { char: 'tatsumi', w: 18 }, { char: 'ren', w: 10 }, { char: 'yae', w: 12 });
	if (t === 'day') list.push({ char: 'yae', w: 26 }, { char: 'ren', w: 12 });
	if (t === 'evening') list.push({ char: 'ren', w: 30 }, { char: 'gen', w: 14 }, { char: 'yae', w: 12 });
	if (t === 'night') list.push({ char: 'ren', w: 12 });
	// 菊の候は内藤が顔を出す。⚠️本番は10月（BIBLE「神無月＝光の花」）なので9月と10月の両方に出す。
	// ここを9月だけにすると month:[10] のセリフが永久に表示されない。
	if (ctx.month === 9 || ctx.month === 10) list.push({ char: 'naito', w: 20 });
	return list;
}

export interface PickedLine {
	char: MenuCharId;
	name: string;
	line: MenuLine;
}

/**
 * 文脈に合う一言を1つ選ぶ。
 * @param seed 呼び出し側が渡す乱数種（Date.now() など。同seed+同文脈なら同結果=テスト可能）。
 * @param exclude 直前に出した本文（連続で同じを避ける）。
 */
export function pickMenuLine(ctx: MenuContext, seed: number, exclude?: string): PickedLine | null {
	const rand = makeRng(seed);
	// 1) 出演：セリフが1本以上ある候補だけで重み抽選
	const cast = castingWeights(ctx).filter((c) => eligibleLines(c.char, ctx).length > 0);
	if (cast.length === 0) return null;
	const total = cast.reduce((a, c) => a + c.w, 0);
	let r = rand() * total;
	let char: MenuCharId = cast[0].char;
	for (const c of cast) {
		r -= c.w;
		if (r <= 0) { char = c.char; break; }
	}
	// 2) セリフ：直前回避 → rare を1/100に落とした重み抽選
	let pool = eligibleLines(char, ctx);
	if (exclude) {
		const rest = pool.filter((l) => l.t !== exclude);
		if (rest.length > 0) pool = rest;
	}
	const weighted: MenuLine[] = [];
	for (const l of pool) {
		const n = l.rare ? 1 : 100;
		for (let i = 0; i < n; i++) weighted.push(l);
	}
	const line = weighted[Math.floor(rand() * weighted.length)] ?? pool[0];
	return { char, name: MENU_CHARS[char].name, line };
}

// 進行段階の順序（必要なら外部から利用）。
export function progRank(p: MenuProg): number { return PROG_RANK[p]; }
