/**
 * 花常 物語（ビネット）の型。
 *
 * ⚠️本体非依存。ここから本体（locales / preferences / achievements 等）を参照しない。
 * ⚠️Math.random 不使用。純データ＋純関数だけを置く。
 *
 * 【本文タグとの対応】HANATSUNE-SPEC §9.7.15
 *   `【若菜④】「…」`   → { kind: "say", speaker: "wakana", emo: 4, text: "…" }
 *   `【レン②】「…」`   → { kind: "say", speaker: "ren",    emo: 2, text: "…" }
 *   `> 八重「…」`       → { kind: "say", speaker: "sub", name: "八重", text: "…" }（立ち絵なし）
 *   地の文               → { kind: "narration", text: "…" }
 *   `> 一月五日。晴れ。` → { kind: "diary", text: "…" }（縦書きの帳面）
 *   `[背景=shop_day]`   → 直後の行の `bg`（省略時は直前を継続）
 *   `◆選択 B-01「甘酒」` → Vignette.choice
 *   `【A】/【B】/【合流】` `{B-01=A: …}` → Line.when
 */

/**
 * 表情差分の番号。主役二人は21枚まで持てる。
 * サブキャストは素材枚数が少ないため、表示側で各キャラの上限へ丸める。
 */
export type Emotion =
	| 1 | 2 | 3 | 4 | 5 | 6 | 7
	| 8 | 9 | 10 | 11 | 12 | 13 | 14
	| 15 | 16 | 17 | 18 | 19 | 20 | 21;

/**
 * 話者。sub = 本編サブキャスト、evt = 表情を持つイベント限定キャスト。
 * ⚠️evt はイベントJSONの中だけで使い、本編キャストへ混ぜない。
 */
export type Speaker = "wakana" | "ren" | "sub" | "evt" | "narration";

/** 選択肢の枝。 */
export type ChoiceKey = "A" | "B";

/**
 * 行の表示条件。過去の選択で本文が変わる箇所に付ける。
 * 未回答の選択を参照する行は「表示しない」（＝勝手に選ばせない）。
 */
export type LineCondition = Readonly<{ choice: string; is: ChoiceKey }>;

/** 全行に共通で載る任意項目。 */
type LineCommon = Readonly<{
	/** この行から背景を切り替える。省略時は直前を継続（SPEC §9.7.15）。 */
	bg?: string;
	/** 表示条件。省略時は常に表示。 */
	when?: LineCondition;
}>;

export type Line =
	/** 帳面（縦書き・一人称） */
	| (LineCommon & Readonly<{ kind: "diary"; text: string }>)
	/** 会話 */
	| (LineCommon & Readonly<{ kind: "say"; speaker: Speaker; name?: string; emo?: Emotion; text: string }>)
	/** 地の文 */
	| (LineCommon & Readonly<{ kind: "narration"; text: string }>);

export type ChoiceOption = Readonly<{
	key: ChoiceKey;
	/** 選択肢の文言（本文の `→ A. …` そのまま）。 */
	label: string;
	/** 軸の増減の覚え書き（本文の `(縁+1)`）。⚠️数値としては使わない・保存もしない。 */
	note?: string;
}>;

export type Choice = Readonly<{
	/** 本文の選択ID（例 "B-01"）。progress.choices のキー。 */
	id: string;
	/** 選択の見出し（例 "甘酒"）。 */
	label: string;
	/** 軸（例 "縁"）。軸なしは undefined。 */
	axis?: string;
	options: readonly [ChoiceOption, ChoiceOption];
}>;

/**
 * ビネットの解放条件。
 * ⚠️本文の「ステージ1-2の前」は「ステージ1-1クリア後」と同じ場所なので stage-clear に寄せる。
 *   （章の途中で中断しても取りこぼさない＝進行状態から解決できる形にするため）
 */
export type VignetteTrigger =
	| Readonly<{ at: "month-open"; month: number }>
	| Readonly<{ at: "stage-clear"; stageId: string }>
	| Readonly<{ at: "boss-before"; stageId: string }>
	| Readonly<{ at: "boss-after"; stageId: string }>
	| Readonly<{ at: "month-close"; month: number }>;

export type Vignette = Readonly<{
	/** 場面ID。progress.vignettesSeen のキー。⚠️一度出したら変えない。 */
	id: string;
	/** chomen = 帳面（縦書き） / scene = 場面（立ち絵つき） */
	kind: "chomen" | "scene";
	/** 章（0 = 序章）。読み返しの並びに使う。 */
	month: number;
	/** 見出し（例 "一月五日、駅前"）。 */
	title: string;
	trigger: VignetteTrigger;
	/**
	 * あらすじ。⚠️スキップ確認でだけ見せる＝再生中＝到達済みの場面のあらすじしか出ない。
	 * ⚠️表層の出来事だけを書く。伏線の回収内容に触れない。
	 */
	synopsis: string;
	lines: readonly Line[];
	/**
	 * 本文中の分岐点に置く選択肢。⚠️並びは本文に現れる順。
	 * ⚠️1つの場面に2つ置くことがある（九月「ろうそく」の B-17 / B-18）。
	 */
	choices?: readonly Choice[];
}>;

/** progress.choices と同じ形。story/ からは storage.ts を読まない（パージ容易性）。 */
export type ChoiceRecord = Readonly<Record<string, ChoiceKey>>;

/** progress のうち物語が見る部分だけ。⚠️storage.ts に依存しない構造的部分型。 */
export type StoryProgress = Readonly<{
	stars: Readonly<Record<string, number>>;
	vignettesSeen: readonly string[];
	choices: ChoiceRecord;
}>;
