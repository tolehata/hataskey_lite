/**
 * 花常 物語の収録とゲート判定。
 *
 * ⚠️純TS。Vue も storage.ts も import しない（パージ容易性：この階層ごと消せる）。
 * ⚠️Math.random 不使用。すべて進行状態からの決定的な関数。
 *
 * 再生の考え方:
 *   `resolveStep()` が「今なにを出すか」を返すだけの状態機械。呼び出し側は cursor を進める。
 *   選択肢は「その選択に依存する最初の行」に着いた時点で提示する（本文の ◆選択 の位置と一致する）。
 *   スキップは `skipTo()` で「次の選択」または「場面の終わり」まで飛ばす。
 *   ⚠️選択肢はスキップしない。スキップは必ず選択肢の手前で止まる。
 */

import { M01 } from "./m01.js";
import { M02 } from "./m02.js";
import { M03 } from "./m03.js";
import { M04 } from "./m04.js";
import { M05 } from "./m05.js";
import { M06 } from "./m06.js";
import { M07 } from "./m07.js";
import { M08 } from "./m08.js";
import { M09 } from "./m09.js";
import { M10 } from "./m10.js";
import { M11 } from "./m11.js";
import { M12 } from "./m12.js";
import { PROLOGUE } from "./prologue.js";
import type { Choice, ChoiceRecord, Line, StoryProgress, Vignette, VignetteTrigger } from "./types.js";

export type { Choice, ChoiceKey, ChoiceRecord, Emotion, Line, Speaker, StoryProgress, Vignette, VignetteTrigger } from "./types.js";

/** 収録。⚠️並び順が再生順であり、読み返しの並び順でもある。 */
export const VIGNETTES: readonly Vignette[] = [
	...PROLOGUE,
	...M01, ...M02, ...M03, ...M04, ...M05, ...M06,
	...M07, ...M08, ...M09, ...M10, ...M11, ...M12,
];

const BY_ID = new Map(VIGNETTES.map((vignette) => [vignette.id, vignette]));

export const vignetteById = (id: string): Vignette | undefined => BY_ID.get(id);

// --- ゲート判定 -------------------------------------------------------------

const monthStageIds = (month: number): readonly string[] => [`m${month}-1`, `m${month}-2`, `m${month}-3`];
const isCleared = (progress: StoryProgress, stageId: string) => (progress.stars[stageId] ?? 0) > 0;
const isMonthCleared = (progress: StoryProgress, month: number) =>
	monthStageIds(month).every((id) => isCleared(progress, id));

/** その月に入れるか。1月は常に開いている。 */
export const isMonthOpen = (progress: StoryProgress, month: number) =>
	month <= 1 || isMonthCleared(progress, month - 1);

/** そのステージに挑めるか（＝直前が済んでいるか）。 */
export const isStageReachable = (progress: StoryProgress, stageId: string) => {
	const matched = /^m(\d+)-([123])$/.exec(stageId);
	if (!matched) return false;
	const month = Number(matched[1]);
	const number = Number(matched[2]);
	if (number === 1) return isMonthOpen(progress, month);
	return isCleared(progress, `m${month}-${number - 1}`);
};

/**
 * ビネットが解放済みか。
 * ⚠️イベント（クリアの瞬間）ではなく進行状態から判定する。
 *   途中で離脱しても取りこぼさないため。
 */
export const isUnlocked = (vignette: Vignette, progress: StoryProgress): boolean => {
	const trigger = vignette.trigger;
	if (trigger.at === "month-open") return isMonthOpen(progress, trigger.month);
	if (trigger.at === "month-close") return isMonthCleared(progress, trigger.month);
	if (trigger.at === "boss-before") return isStageReachable(progress, trigger.stageId);
	return isCleared(progress, trigger.stageId);
};

export const isSeen = (vignette: Vignette, progress: StoryProgress) =>
	progress.vignettesSeen.includes(vignette.id);

/** 解放済みでまだ見ていないビネットを、収録順に返す。⚠️これが再生キュー。 */
export const pendingVignettes = (progress: StoryProgress): readonly Vignette[] =>
	VIGNETTES.filter((vignette) => isUnlocked(vignette, progress) && !isSeen(vignette, progress));

/** 特定の合図に紐づくものだけに絞る（ステージクリア直後などに使う）。 */
export const pendingVignettesAt = (progress: StoryProgress, at: VignetteTrigger["at"]): readonly Vignette[] =>
	pendingVignettes(progress).filter((vignette) => vignette.trigger.at === at);

/** 読み返し（花手帖）に並べるもの。到達した場面だけ＝ネタバレしない。 */
export const seenVignettes = (progress: StoryProgress): readonly Vignette[] =>
	VIGNETTES.filter((vignette) => isSeen(vignette, progress));

/** 既読に加える。⚠️スキップした場面も到達扱いで加える。 */
export const withSeen = (seen: readonly string[], id: string): readonly string[] =>
	seen.includes(id) ? seen : [...seen, id];

// --- 再生 -------------------------------------------------------------------

export type Step =
	| Readonly<{ kind: "line"; index: number; line: Line }>
	| Readonly<{ kind: "choice"; choice: Choice; index: number }>
	| Readonly<{ kind: "end" }>;

/** この行を、いまの選択状態で出すか。 */
const lineShows = (line: Line, choices: ChoiceRecord) =>
	line.when === undefined || choices[line.when.choice] === line.when.is;

/**
 * この行が待っている「この場面の未回答の選択」を返す。待っていなければ undefined。
 * ⚠️他の場面の選択を参照する行は、ここでは止めない（過去の選択なので必ず答が出ている）。
 */
const awaitedChoice = (vignette: Vignette, line: Line, choices: ChoiceRecord): Choice | undefined => {
	const when = line.when;
	if (when === undefined || choices[when.choice] !== undefined) return undefined;
	return vignette.choices?.find((entry) => entry.id === when.choice);
};

/**
 * cursor の位置で「いま出すもの」を決める。
 * 条件に合わない行は読み飛ばし、未回答の選択に当たったらそこで止まる。
 */
export const resolveStep = (vignette: Vignette, choices: ChoiceRecord, cursor: number): Step => {
	for (let index = Math.max(0, cursor); index < vignette.lines.length; index++) {
		const line = vignette.lines[index]!;
		const awaited = awaitedChoice(vignette, line, choices);
		if (awaited !== undefined) return { kind: "choice", choice: awaited, index };
		if (lineShows(line, choices)) return { kind: "line", index, line };
	}
	return { kind: "end" };
};

/**
 * スキップの着地点。⚠️次の選択肢の手前、または場面の終わりで必ず止まる。
 * 選択は読み物ではなく進行のメカニクスなので、飛ばさない。
 */
export const skipTo = (vignette: Vignette, choices: ChoiceRecord, cursor: number): Step => {
	for (let index = Math.max(0, cursor); index < vignette.lines.length; index++) {
		const line = vignette.lines[index]!;
		const awaited = awaitedChoice(vignette, line, choices);
		if (awaited !== undefined) return { kind: "choice", choice: awaited, index };
	}
	return { kind: "end" };
};

/** いまの選択で実際に読める行だけを並べる（読み返し・通し読み用）。 */
export const visibleLines = (vignette: Vignette, choices: ChoiceRecord): readonly Line[] =>
	vignette.lines.filter((line) => lineShows(line, choices));

/** 背景は「省略時は直前を継続」。指定行までの最後の bg を返す。 */
export const backdropAt = (vignette: Vignette, index: number): string | undefined => {
	let current: string | undefined;
	for (let i = 0; i <= Math.min(index, vignette.lines.length - 1); i++) {
		const bg = vignette.lines[i]?.bg;
		if (bg !== undefined) current = bg;
	}
	return current;
};

/** 立ち絵を出す話者（サブキャストは立ち絵なし。SPEC §9.7.6-6）。 */
export const hasPortrait = (line: Line) =>
	line.kind === "say" && (line.speaker === "wakana" || line.speaker === "ren" || line.speaker === "evt");

/** 名前表示。⚠️若菜・レン以外は本文の名前をそのまま出す。 */
export const speakerName = (line: Line): string | undefined => {
	if (line.kind !== "say") return undefined;
	if (line.speaker === "wakana") return "若菜";
	if (line.speaker === "ren") return "レン";
	return line.name;
};
