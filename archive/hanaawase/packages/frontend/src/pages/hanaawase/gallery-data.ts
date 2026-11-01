// 花常 キャラ図鑑（ギャラリー）のデータと解放判定。
// ⚠️backend非依存。判定は storage.ts の Progress を「読むだけ」で行い、保存も追記もしない。
// ⚠️i18n は本体 locale を使わずここに閉じ込める（CONSTRAINTS・パージ容易性）。
// ⚠️ネタバレ規約: 12月の種明かし・伏線の回収内容を説明文に書かない。
//   説明は BIBLE §5 / MOB.md の記述の範囲内に留め、設定にない属性を足さない。

import { MENU_LINES } from "./menu-lines.js";
import type { StageId } from "./levels.js";
import type { Progress } from "./storage.js";

export type GalleryCharId =
	| "wakana" | "ren" | "yae" | "tatsumi" | "gen"
	| "haruno" | "amamiya" | "inukai" | "naito" | "tsune";

/** 図鑑が読む進行の断片。⚠️Progress をそのまま渡せるが、書き換えない。 */
export type GalleryProgress = Pick<Progress, "stars" | "vignettesSeen">;

export interface GalleryFace {
	/** 画像番号（face_N.webp / bustup_N.webp）。⚠️キャラごとに枚数が違う。 */
	readonly n: number;
	readonly label: string;
}
export interface GalleryStill {
	/** 拡張子なしのファイル名。⚠️ファイルが無くても壊れない（読み込み失敗は静かに隠す）。 */
	readonly file: string;
	readonly title: string;
	/** この月の最初の面をクリアしたら解放。1〜12。 */
	readonly since: number;
}
export interface GalleryUnlock {
	/** このステージ（またはそれ以降）をクリアで解放。null は最初から解放。 */
	readonly stage: StageId | null;
	/** 将来のビネットID解放用。進行に該当IDがあれば stage より先に解放する。 */
	readonly vignette?: string;
}
export interface GalleryFact {
	readonly label: string;
	readonly value: string;
}
export interface GalleryChar {
	readonly id: GalleryCharId;
	readonly name: string;
	readonly reading: string;
	readonly role: string;
	readonly summary: string;
	readonly facts: readonly GalleryFact[];
	readonly faces: readonly GalleryFace[];
	/** バストアップ(webp)の枚数。0 は未生成（表情は face_N.webp で見せる）。 */
	readonly bustupCount: number;
	/** 立ち絵 pose_a.webp の有無。 */
	readonly hasPose: boolean;
	readonly stills: readonly GalleryStill[];
	/** 常のように立ち絵を持たない項目で使う引用。 */
	readonly quotes?: readonly string[];
	readonly unlock: GalleryUnlock;
	/** 季節の差し色（意匠。インラインstyleで --chara-accent に渡す）。 */
	readonly accent: string;
}

const ASSET_ROOT = "/client-assets/hanaawase";

export const posePath = (id: GalleryCharId, pose = "a"): string => `${ASSET_ROOT}/chara/${id}/pose_${pose}.webp`;
export const facePath = (id: GalleryCharId, n: number): string => `${ASSET_ROOT}/chara/${id}/face_${n}.webp`;
export const bustupPath = (id: GalleryCharId, n: number): string => `${ASSET_ROOT}/chara/${id}/bustup_${n}.webp`;
export const stillPath = (id: GalleryCharId, file: string): string => `${ASSET_ROOT}/still/${id}/${file}.webp`;

// --- 進行の並び（本編36面の順序） -------------------------------------------------
export const STAGE_SEQUENCE: readonly StageId[] = (() => {
	const out: StageId[] = [];
	for (let month = 1; month <= 12; month++) {
		for (const n of [1, 2, 3] as const) out.push(`m${month}-${n}` as StageId);
	}
	return out;
})();

const ORDER: ReadonlyMap<string, number> = new Map(STAGE_SEQUENCE.map((id, index) => [id as string, index]));

/** 未知のIDは -1。 */
export const stageOrder = (id: string): number => ORDER.get(id) ?? -1;

/** クリア済み（星1つ以上）のうち、いちばん先のステージの順序。未クリアは -1。 */
export const clearedOrder = (progress: GalleryProgress): number => {
	let max = -1;
	for (const [id, star] of Object.entries(progress.stars)) {
		if (star > 0) max = Math.max(max, stageOrder(id));
	}
	return max;
};

/**
 * 解放判定。⚠️「登場した月のステージ、またはそれ以降をクリアしている」ことを条件にする。
 * 月は自由に選べる設計（index.vue のマップは全月クリック可）なので、
 * 先の月を遊んだ人が前の月の人物で詰まらないよう順序で判定する。
 */
export const isUnlocked = (entry: GalleryChar, progress: GalleryProgress): boolean => {
	if (entry.unlock.stage === null) return true;
	if (entry.unlock.vignette !== undefined && progress.vignettesSeen.includes(entry.unlock.vignette)) return true;
	const need = stageOrder(entry.unlock.stage);
	return need >= 0 && clearedOrder(progress) >= need;
};

/** ひとこまの解放判定。保存キーは増やさず、既存の星だけを読む。 */
export const isStillUnlocked = (still: GalleryStill, progress: GalleryProgress): boolean => {
	if (!Number.isInteger(still.since) || still.since < 1 || still.since > 12) return false;
	return clearedOrder(progress) >= stageOrder(`m${still.since}-1`);
};

/** 読み込み成否とは切り離した、進行だけによる解放済み一覧。 */
export const unlockedStills = (entry: GalleryChar, progress: GalleryProgress): readonly GalleryStill[] =>
	entry.stills.filter((still) => isStillUnlocked(still, progress));

// --- 名鑑本体 ---------------------------------------------------------------------
// ⚠️unlock は BIBLE §10（各月構成表）の初登場場面に合わせる。前倒ししない。

export const GALLERY_CHARS: readonly GalleryChar[] = [
	{
		id: "wakana",
		name: "三隅 若菜",
		reading: "みすみ・わかな",
		role: "花常の二代目",
		summary: "祖母の花屋を継いで、入舟町の店先に立っている。生花チェーンで三年。型は正確で、だからこそ、この店のやり方との差に手が止まる。感情は、たいてい顔に出る。",
		facts: [
			{ label: "素性", value: "生花チェーン勤め三年ののち、花常を継ぐ" },
			{ label: "身なり", value: "墨色のボブに白い椿の髪留め、藍の前掛け" },
			{ label: "声", value: "短い言い切り。敬語がときどき硬い" },
		],
		faces: [
			{ n: 1, label: "澄まし" },
			{ n: 2, label: "にこにこ" },
			{ n: 3, label: "むむっ" },
			{ n: 4, label: "きりっと" },
			{ n: 5, label: "しょんぼり" },
			{ n: 6, label: "きらきら" },
			{ n: 7, label: "案じ顔" },
			{ n: 8, label: "小さな驚き" },
			{ n: 9, label: "ほっとする" },
			{ n: 10, label: "ためらい" },
			{ n: 11, label: "照れ" },
			{ n: 12, label: "くやしい" },
			{ n: 13, label: "考え中" },
			{ n: 14, label: "眠たげ" },
			{ n: 15, label: "笑いこらえ" },
			{ n: 16, label: "言い切る" },
			{ n: 17, label: "伏し目" },
			{ n: 18, label: "覚悟" },
			{ n: 19, label: "戸惑い" },
			{ n: 20, label: "やりきった顔" },
			{ n: 21, label: "やわらかな笑み" },
		],
		bustupCount: 21,
		hasPose: true,
		stills: [
			// 本文の初出に沿う。1月=開店仕事と帳面、3月=卒業束と春の嵐、
			// 4月以降=配達・夕仕事、8月=夜仕事、12月=繁忙の遅い夜。
			{ file: "water_morning", title: "朝の水替え", since: 1 },
			{ file: "cut_morning", title: "朝の下ごしらえ", since: 1 },
			{ file: "ledger_night", title: "夜の帳面", since: 1 },
			{ file: "cut_day", title: "昼の水切り", since: 2 },
			{ file: "arrange_day", title: "昼の店づくり", since: 3 },
			{ file: "carry_day", title: "荷を運ぶ", since: 3 },
			{ file: "handover_day", title: "昼の受け渡し", since: 3 },
			{ file: "smile_close", title: "笑うところ", since: 3 },
			{ file: "water_evening", title: "夕の水替え", since: 4 },
			{ file: "cut_evening", title: "夕の水切り", since: 5 },
			{ file: "handover_evening", title: "夕の受け渡し", since: 6 },
			{ file: "arrange_night", title: "夜の手入れ", since: 8 },
			{ file: "tired_night", title: "遅い夜", since: 12 },
		],
		unlock: { stage: null },
		accent: "#c9a04e",
	},
	{
		id: "ren",
		name: "大神 漣",
		reading: "おおがみ・れん",
		role: "配達を手伝う学生",
		summary: "狼の獣人。情報工学科の二回生で、長野の山町の出。ふらりと店に来て、そのまま配達を手伝うようになった。花の名前は、テストよりよく頭に入るらしい。",
		facts: [
			{ label: "素性", value: "情報工学科二回生。サーバー同好会に所属" },
			{ label: "身なり", value: "黒のジャケットに、首は黒と青のヘッドホン" },
			// ⚠️2026-07-27 語尾「〜っす」は全廃した。⚠️ここは名鑑に出る文なので戻さないこと（BIBLE §5 が正本）。
			{ label: "声", value: "砕けた敬語で陽気。技術の話になると早口" },
		],
		faces: [
			{ n: 1, label: "通常" },
			{ n: 2, label: "満面の笑み" },
			{ n: 3, label: "照れ" },
			{ n: 4, label: "びっくり" },
			{ n: 5, label: "真顔" },
			{ n: 6, label: "困り笑い" },
			{ n: 7, label: "嫉妬" },
			{ n: 8, label: "焦燥" },
			{ n: 9, label: "泣く" },
			{ n: 10, label: "落ち込む" },
			{ n: 11, label: "絶望" },
			{ n: 12, label: "警戒" },
			{ n: 13, label: "安堵" },
			{ n: 14, label: "案じる" },
			{ n: 15, label: "照れ隠し" },
			{ n: 16, label: "決意" },
			{ n: 17, label: "疲れ" },
			{ n: 18, label: "はにかみ" },
			{ n: 19, label: "困惑" },
			{ n: 20, label: "聞き入る" },
			{ n: 21, label: "守る目" },
		],
		bustupCount: 21,
		hasPose: true,
		stills: [
			// レンの手伝いが本文で見える順。夜の真顔は種明かし前の11月まで伏せる。
			{ file: "delivery_day", title: "昼の配達", since: 1 },
			{ file: "carry_box", title: "荷箱を運ぶ", since: 2 },
			{ file: "help_water", title: "水替えを手伝う", since: 2 },
			{ file: "handover", title: "受け渡し", since: 3 },
			{ file: "laugh", title: "笑うところ", since: 3 },
			{ file: "delivery_evening", title: "夕の配達", since: 4 },
			{ file: "serious_night", title: "夜の真顔", since: 11 },
		],
		unlock: { stage: "m1-2" },
		accent: "#7b86c8",
	},
	{
		id: "yae",
		name: "八重",
		reading: "やえ",
		role: "隣の青果「まるはち」女主人",
		summary: "還暦。常の幼馴染で、町の噂はたいていこの人を通る。若菜にとっては、町の母のような人。用も無いのに、野菜を置いていく。",
		facts: [
			{ label: "素性", value: "隣の青果「まるはち」の女主人。還暦" },
			{ label: "間柄", value: "常の幼馴染" },
			{ label: "声", value: "「常ちゃんの孫が、まあ」" },
		],
		faces: [
			{ n: 1, label: "笑い" },
			{ n: 2, label: "呆れ" },
			{ n: 3, label: "案じ顔" },
			{ n: 4, label: "しみじみ" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m1-1" },
		accent: "#c96f5a",
	},
	{
		id: "tatsumi",
		name: "辰巳",
		reading: "たつみ",
		role: "浜市場の競り人",
		summary: "五十代後半。鉢巻に法被、木札を握って場を回す。若菜のことは「常サンとこの」と呼ぶ。教えはしないが、黙って見ていてくれる。",
		facts: [
			{ label: "素性", value: "浜市場の競り人。五十代後半" },
			{ label: "役どころ", value: "市場という世界の案内人" },
			{ label: "声", value: "「目ぇ肥やしてけ! 若えうちにな!」" },
		],
		faces: [
			{ n: 1, label: "大声" },
			{ n: 2, label: "にやり" },
			{ n: 3, label: "真顔" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m1-3" },
		accent: "#4f7fa3",
	},
	{
		id: "gen",
		name: "熊谷 玄",
		reading: "くまがい・げん",
		role: "喫茶「くろまつ」のマスター",
		summary: "熊の獣人、六十代。藍の作務衣に前掛け、いつも伏し目。ほとんど喋らない。常の碁敵だった。珈琲は、冷める前に。",
		facts: [
			{ label: "素性", value: "喫茶「くろまつ」のマスター。六十代" },
			{ label: "間柄", value: "常の碁敵" },
			{ label: "声", value: "「……豆。」" },
		],
		faces: [
			{ n: 1, label: "無表情" },
			{ n: 2, label: "かすかな笑み" },
			{ n: 3, label: "むっつり" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m1-3" },
		accent: "#6d5a45",
	},
	{
		id: "haruno",
		name: "春野",
		reading: "はるの",
		role: "就職一年目の青年",
		summary: "卒業の花束を買いに来た青年。それからも、季節の変わり目にふらりと店に現れる。生真面目で、鞄をいつも提げている。",
		facts: [
			{ label: "素性", value: "就職一年目の青年" },
			{ label: "身なり", value: "少しずつ着慣れていくスーツ" },
			{ label: "声", value: "「初任給、なんです」" },
		],
		faces: [
			{ n: 1, label: "緊張" },
			{ n: 2, label: "はにかみ" },
			{ n: 3, label: "晴れやか" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m3-1" },
		accent: "#7fa87f",
	},
	{
		id: "amamiya",
		name: "雨宮",
		reading: "あまみや",
		role: "雨の日にだけ来る人",
		summary: "雨の日にだけ、ビニール傘を提げて店に来る。買うのは白い花を少し。多くは語らない。こちらからも、訊かない。",
		facts: [
			{ label: "素性", value: "雨の日にだけ訪れる女性" },
			{ label: "註文", value: "白い花を、少し" },
			{ label: "声", value: "「……白いのを、少し」" },
		],
		faces: [
			{ n: 1, label: "伏し目" },
			{ n: 2, label: "かすかな微笑" },
			{ n: 3, label: "晴れやか" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m6-1" },
		accent: "#8fa3b5",
	},
	{
		id: "inukai",
		name: "犬飼 旬",
		reading: "いぬかい・しゅん",
		role: "仲卸「犬飼生花」の青年",
		summary: "柴犬の獣人。作業エプロンに軽装、動きが速い。生花の目利きは任せておけと胸を張る。レンとは、犬だ狼だと言い合っている。",
		facts: [
			{ label: "素性", value: "仲卸「犬飼生花」の青年" },
			{ label: "間柄", value: "市場でのレンの友人" },
			{ label: "声", value: "「柴犬だっつの。犬っころ扱いすんなよな」" },
		],
		faces: [
			{ n: 1, label: "通常" },
			{ n: 2, label: "吠え" },
			{ n: 3, label: "したり顔" },
			{ n: 4, label: "しょげ" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m7-2" },
		accent: "#c98a4e",
	},
	{
		id: "naito",
		name: "内藤",
		reading: "ないとう",
		role: "菊農家",
		summary: "七十代。麦わら帽子に長靴、節くれだった手。夜どおし電灯を点けた畑で菊を育てている。菊の話をするときだけ、少し目を見開く。",
		facts: [
			{ label: "素性", value: "菊農家。七十代" },
			{ label: "畑", value: "夜も明かりを落とさない電照菊の畑" },
			{ label: "声", value: "「菊はな、夜も起きとるんだ」" },
		],
		faces: [
			{ n: 1, label: "朴訥" },
			{ n: 2, label: "語り" },
			{ n: 3, label: "笑み" },
		],
		bustupCount: 0,
		hasPose: true,
		stills: [],
		unlock: { stage: "m10-1" },
		accent: "#b8a94e",
	},
	{
		// ⚠️常は「不在の主役」。姿は出さず、語録だけを置く最小の扱いに留める。
		//   回収にかかわる語録（一輪・光の花）は載せない。
		id: "tsune",
		name: "常",
		reading: "つね",
		role: "花常をひらいた人",
		summary: "若菜の祖母。この店をはじめた人。姿は無く、古い帳面の余白と、使い込まれた道具のなかにいる。",
		facts: [
			{ label: "間柄", value: "若菜の祖母" },
			{ label: "遺したもの", value: "古帳面と、握りの飴色になった鋏" },
		],
		faces: [],
		bustupCount: 0,
		hasPose: false,
		stills: [],
		quotes: [
			"棚は縛れ。花は諦めるな。",
			"売れない日は、店を磨く日。",
			"値札より先に、名前を覚えな。",
		],
		unlock: { stage: null },
		accent: "#8a7a5c",
	},
];

export const galleryCharById = (id: GalleryCharId): GalleryChar | undefined =>
	GALLERY_CHARS.find((entry) => entry.id === id);

/** menu-lines.ts 側にセリフを持つID。 */
const LINE_CHAR_IDS: ReadonlySet<string> = new Set(["wakana", "ren", "yae", "inukai", "gen", "tatsumi", "naito"]);

/**
 * 図鑑に出してよい「ひとこと」。
 * ⚠️rare と prog 付き（伏線・進行段階限定）の行は、文脈から外れて出るとネタバレになるため除外する。
 */
export const barksFor = (id: GalleryCharId): readonly string[] => {
	if (!LINE_CHAR_IDS.has(id)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const line of MENU_LINES) {
		if (line.char !== id) continue;
		if (line.rare === true || line.prog !== undefined) continue;
		if (seen.has(line.t)) continue;
		seen.add(line.t);
		out.push(line.t);
	}
	return out;
};

/** 解放済みの人数（表示用）。 */
export const unlockedCount = (progress: GalleryProgress): number =>
	GALLERY_CHARS.reduce((total, entry) => total + (isUnlocked(entry, progress) ? 1 : 0), 0);
