import { describe, expect, test } from "vitest";
import {
	VIGNETTES,
	backdropAt,
	isUnlocked,
	pendingVignettes,
	pendingVignettesAt,
	resolveStep,
	seenVignettes,
	skipTo,
	speakerName,
	vignetteById,
	visibleLines,
	withSeen,
} from "./story/index.js";
import type { ChoiceRecord, StoryProgress, Vignette } from "./story/index.js";

const progressOf = (stars: Record<string, number>, seen: string[] = [], choices: ChoiceRecord = {}): StoryProgress =>
	({ stars, vignettesSeen: seen, choices });
const empty = progressOf({});
const monthOneCleared = progressOf({ "m1-1": 3, "m1-2": 2, "m1-3": 1 });
const ids = (list: readonly Vignette[]) => list.map((entry) => entry.id);

/** 場面を最後まで再生し、通った行のテキストを返す。選択に当たったら answers に従う。 */
const playThrough = (vignette: Vignette, answers: ChoiceRecord = {}) => {
	let choices: ChoiceRecord = {};
	const texts: string[] = [];
	let cursor = 0;
	let first = true;
	for (let guard = 0; guard < 2000; guard++) {
		const step = resolveStep(vignette, choices, first ? cursor : cursor + 1);
		if (step.kind === "end") return texts;
		if (step.kind === "choice") {
			const answer = answers[step.choice.id];
			expect(answer).toBeDefined();
			choices = { ...choices, [step.choice.id]: answer! };
			cursor = step.index;
			first = true;
			continue;
		}
		texts.push(step.line.text);
		cursor = step.index;
		first = false;
	}
	throw new Error("再生が終わらない");
};

describe("花常 物語の収録", () => {
	test("場面IDは一意で、順番が再生順になっている", () => {
		expect(new Set(ids(VIGNETTES)).size).toBe(VIGNETTES.length);
		expect(ids(VIGNETTES)[0]).toBe("p-00-bunguten");
		expect(ids(VIGNETTES).at(-1)).toBe("m12-chomen-1231");
		expect(vignetteById("m1-ookami")?.title).toBe("狼の来客");
	});

	test("全ての場面にあらすじと本文がある", () => {
		for (const vignette of VIGNETTES) {
			expect(vignette.synopsis.length).toBeGreaterThan(8);
			expect(vignette.lines.length).toBeGreaterThan(0);
		}
	});

	test("⚠️本文に外国語・ハングル・ラテン文字が混入していない", () => {
		const contaminated = /[가-힯ᄀ-ᇿЀ-ӿͰ-ϿA-Za-zＡ-Ｚａ-ｚ]/;
		// ⚠️除外語を作らない。五月の「QRコード」は登録商標だったので原稿ごと「二次元コード」に直した。
		// ⚠️ここに除外を足すと検出力が落ちる。まず本文の側を日本語表記に直せないか考えること。
		for (const vignette of VIGNETTES) {
			expect(contaminated.test(vignette.synopsis), vignette.id).toBe(false);
			expect(contaminated.test(vignette.title), vignette.id).toBe(false);
			for (const line of vignette.lines) {
				expect(contaminated.test(line.text), `${vignette.id}: ${line.text}`).toBe(false);
			}
		}
	});

	test("表情は1〜21、立ち絵のある話者にだけ付く", () => {
		for (const vignette of VIGNETTES) for (const line of vignette.lines) {
			if (line.kind !== "say") continue;
			if (line.emo !== undefined) {
				expect(line.emo).toBeGreaterThanOrEqual(1);
				expect(line.emo).toBeLessThanOrEqual(21);
				expect(["wakana", "ren"]).toContain(line.speaker);
			}
			// サブキャストは立ち絵なし＝名前が要る
			if (line.speaker === "sub") expect(line.name).toBeTruthy();
		}
	});

	test("条件付きの行が参照する選択は、必ずどこかで提示される", () => {
		const offered = new Set(VIGNETTES.flatMap((entry) => (entry.choices ?? []).map((choice) => choice.id)));
		for (const vignette of VIGNETTES) for (const line of vignette.lines) {
			if (line.when) expect(offered.has(line.when.choice), `${vignette.id}/${line.when.choice}`).toBe(true);
		}
		expect([...offered].sort()).toEqual([
			"B-00", "B-01", "B-02", "B-03", "B-04", "B-05", "B-06",
			"B-07", "B-08", "B-09", "B-10", "B-11", "B-12",
			"B-13", "B-14", "B-15", "B-16", "B-17", "B-18",
			"B-19", "B-20", "B-21", "B-22",
		]);
	});

	test("⚠️選択IDは、それを提示する場面がただ一つ（同じIDを二度訊かない）", () => {
		const seen = new Map<string, string>();
		for (const vignette of VIGNETTES) for (const choice of vignette.choices ?? []) {
			expect(seen.has(choice.id), `${choice.id} は ${seen.get(choice.id)} でも提示されている`).toBe(false);
			seen.set(choice.id, vignette.id);
		}
		// ⚠️九月「ろうそく」だけは、1場面が2つの選択を持つ（原稿が1場面として書いている）
		expect(vignetteById("m9-rousoku")!.choices?.map((choice) => choice.id)).toEqual(["B-17", "B-18"]);
	});

	test("話者名は若菜・レンだけ固定、サブキャストは本文の名前をそのまま出す", () => {
		const ookami = vignetteById("m1-ookami")!;
		expect(speakerName(ookami.lines.find((line) => line.kind === "say" && line.speaker === "ren")!)).toBe("レン");
		const market = vignetteById("m1-hamaichiba")!;
		expect(speakerName(market.lines.find((line) => line.kind === "say" && line.speaker === "sub")!)).toBe("競り人の声");
	});
});

describe("花常 物語のゲート判定", () => {
	test("進行ゼロでは序章と一月六日の帳面だけが解放される", () => {
		expect(ids(pendingVignettes(empty))).toEqual([
			"p-00-bunguten", "p-00-kaiten-zenya", "p-00-chomen-0105", "m1-chomen-0106",
		]);
	});

	test("1-1クリアで初売りと『今日のうちに飾る花』が解放される", () => {
		const after = progressOf({ "m1-1": 1 });
		expect(ids(pendingVignettesAt(after, "stage-clear"))).toEqual(["m1-hatsuuri", "m1-kyou-no-uchi"]);
	});

	test("1-2クリアで帳面一月七日と狼の来客が解放される", () => {
		const after = progressOf({ "m1-1": 1, "m1-2": 1 });
		expect(ids(pendingVignettesAt(after, "stage-clear")))
			.toEqual(["m1-hatsuuri", "m1-kyou-no-uchi", "m1-chomen-0107", "m1-ookami"]);
	});

	test("月の全ステージクリアで、くろまつと月末の帳面が解放される", () => {
		expect(ids(pendingVignettesAt(monthOneCleared, "month-close"))).toEqual(["m1-kuromatsu", "m1-chomen-0131"]);
		expect(isUnlocked(vignetteById("m1-kuromatsu")!, progressOf({ "m1-1": 1, "m1-2": 1 }))).toBe(false);
	});

	test("既読は解放済みでもキューに出ない。スキップした場面も既読に入る", () => {
		const seen = progressOf({}, ["p-00-bunguten", "p-00-kaiten-zenya"]);
		expect(ids(pendingVignettes(seen))).toEqual(["p-00-chomen-0105", "m1-chomen-0106"]);
		expect(ids(seenVignettes(seen))).toEqual(["p-00-bunguten", "p-00-kaiten-zenya"]);
		expect(withSeen(["a"], "b")).toEqual(["a", "b"]);
		expect(withSeen(["a", "b"], "b")).toEqual(["a", "b"]); // 冪等
	});

	test("⚠️読み返しには到達済みの場面しか並ばない（未読のあらすじは原理的に出ない）", () => {
		expect(seenVignettes(empty)).toHaveLength(0);
		expect(ids(seenVignettes(progressOf({ "m1-1": 3 }, ["m1-hatsuuri"])))).toEqual(["m1-hatsuuri"]);
	});
});

/**
 * index.vue の配線が前提にしている取り決め。
 * ⚠️盤面を離れたときの「受け皿」は boss-before を除いた pendingVignettes そのもの。
 *   並び順は VIGNETTES の収録順なので、収録順を崩すと再生順が壊れる。ここで固定する。
 */
describe("花常 物語の発火点（index.vue の配線が依存する取り決め）", () => {
	/** 盤面を離れた直後・ホーム到着時に出すもの。⚠️boss-before だけは混ぜない。 */
	const aftermath = (progress: StoryProgress) =>
		ids(pendingVignettes(progress).filter((entry) => entry.trigger.at !== "boss-before"));
	/** その盤面に入る直前に出すもの。 */
	const beforeBoard = (progress: StoryProgress, stageId: string) =>
		ids(pendingVignettes(progress)
			.filter((entry) => entry.trigger.at === "boss-before" && entry.trigger.stageId === stageId));

	test("⚠️季節の障りの前ふりは、受け皿に混ざらない（盤面へ入る直前まで取っておく）", () => {
		const beforeBoss = progressOf({ "m3-1": 1, "m3-2": 1 });
		expect(aftermath(beforeBoss)).not.toContain("m3-kaze-ga-deru");
		expect(beforeBoard(beforeBoss, "m3-3")).toEqual(["m3-kaze-ga-deru"]);
		// 直前のステージが済んでいなければ、まだ出ない
		expect(beforeBoard(progressOf({ "m3-1": 1 }), "m3-3")).toEqual([]);
	});

	test("⚠️前ふりは一度読んだら出ない（負けて挑み直しても再表示しない）", () => {
		const seen = progressOf({ "m3-1": 1, "m3-2": 1 }, ["m3-kaze-ga-deru"]);
		expect(beforeBoard(seen, "m3-3")).toEqual([]);
		// 読み返しには残る
		expect(ids(seenVignettes(seen))).toContain("m3-kaze-ga-deru");
	});

	test("⚠️撃破後は『後日談 → その局の場面 → 月末 → 次の月の頭』の順で流れる", () => {
		const afterBoss = progressOf({ "m3-1": 1, "m3-2": 1, "m3-3": 3 });
		const queue = aftermath(afterBoss);
		expect(queue.slice(-6)).toEqual([
			"m3-ichiba", "m3-zubunure", "m3-mame", "m3-higan", "m3-chomen-0331",
			// 月が閉じると次の月が開くので、続けて次章の頭までが一続きに流れる
			"m4-chomen-0402",
		]);
		expect(queue.indexOf("m3-zubunure")).toBeLessThan(queue.indexOf("m3-mame"));
	});

	test("⚠️背景タグは §9.7.55 の語彙だけ（未知のIDは404になる）", () => {
		// PNG(=webp)がある8種と、CSSで環境を描く4種。⚠️ここに無いIDを本文に足さない。
		const withImage = new Set([
			"shop_day", "shop_evening", "shop_night", "workroom",
			"front_spring", "front_summer", "front_autumn", "front_winter",
		]);
		const cssOnly = new Set(["market", "street", "indoor_other", "outskirt"]);
		for (const vignette of VIGNETTES) for (const line of vignette.lines) {
			if (line.bg === undefined) continue;
			expect(withImage.has(line.bg) || cssOnly.has(line.bg), `${vignette.id}: ${line.bg}`).toBe(true);
		}
	});
});

describe("花常 物語の再生", () => {
	test("未回答の選択に着いたら、そこで選択を出す", () => {
		const zenya = vignetteById("p-00-kaiten-zenya")!;
		let cursor = 0;
		let step = resolveStep(zenya, {}, cursor);
		for (let guard = 0; guard < 500 && step.kind === "line"; guard++) {
			cursor = step.index;
			step = resolveStep(zenya, {}, cursor + 1);
		}
		expect(step.kind).toBe("choice");
		expect(step.kind === "choice" && step.choice.id).toBe("B-00");
	});

	test("選ばなかった枝の本文は流れない", () => {
		const zenya = vignetteById("p-00-kaiten-zenya")!;
		const a = playThrough(zenya, { "B-00": "A" });
		const b = playThrough(zenya, { "B-00": "B" });
		expect(a).toContain("三行だけ読んで、若菜は帳面を閉じた。");
		expect(a).not.toContain("読むのは、まだやめておく。");
		expect(b).toContain("読むのは、まだやめておく。");
		expect(b).not.toContain("三行だけ読んで、若菜は帳面を閉じた。");
		// 合流後は両方に出る
		expect(a.at(-1)).toBe(b.at(-1));
	});

	test("同じ選択に依存する後半の本文も、選んだ枝だけが流れる", () => {
		const hatsuuri = vignetteById("m1-hatsuuri")!;
		const a = playThrough(hatsuuri, { "B-01": "A" });
		const b = playThrough(hatsuuri, { "B-01": "B" });
		expect(a).toContain("あります。見様見真似ですが");
		expect(b).toContain("……今年は、ないんです");
		expect(a).not.toContain("……今年は、ないんです");
		expect(a.at(-1)).toBe("外は、雪がやんでいた。");
		expect(b.at(-1)).toBe("外は、雪がやんでいた。");
	});

	test("帳面の可変行は、選択が未回答なら表示しない（勝手に選ばせない）", () => {
		const chomen = vignetteById("m1-chomen-0131")!;
		const none = visibleLines(chomen, {}).map((line) => line.text);
		const a = visibleLines(chomen, { "B-01": "A" }).map((line) => line.text);
		expect(none.some((text) => text.startsWith("甘酒"))).toBe(false);
		expect(a.some((text) => text.startsWith("甘酒は、七杯出た。"))).toBe(true);
		expect(a.some((text) => text.startsWith("甘酒の盆は、"))).toBe(false);
	});

	test("背景は指定行から切り替わり、省略時は直前を継続する", () => {
		const hatsuuri = vignetteById("m1-hatsuuri")!;
		expect(backdropAt(hatsuuri, 0)).toBe("front_winter");
		expect(backdropAt(hatsuuri, 5)).toBe("front_winter");
		expect(backdropAt(hatsuuri, hatsuuri.lines.length - 1)).toBe("shop_day");
		const kuromatsu = vignetteById("m1-kuromatsu")!;
		expect(backdropAt(kuromatsu, 0)).toBe("street");
		expect(backdropAt(kuromatsu, kuromatsu.lines.length - 1)).toBe("street");
		expect(backdropAt(kuromatsu, 6)).toBe("indoor_other");
		// 帳面には背景タグがない
		expect(backdropAt(vignetteById("m1-chomen-0107")!, 3)).toBeUndefined();
	});

	test("⚠️1場面に選択が2つある「ろうそく」は、順番に2回訊く", () => {
		const rousoku = vignetteById("m9-rousoku")!;
		const first = skipTo(rousoku, {}, 0);
		expect(first.kind === "choice" && first.choice.id).toBe("B-17");
		const afterFirst = skipTo(rousoku, { "B-17": "A" }, first.kind === "choice" ? first.index : 0);
		expect(afterFirst.kind === "choice" && afterFirst.choice.id).toBe("B-18");
		// 両方に答えれば、そこから先は止まらない
		const index = afterFirst.kind === "choice" ? afterFirst.index : 0;
		expect(skipTo(rousoku, { "B-17": "A", "B-18": "B" }, index).kind).toBe("end");
		// 選んだ枝だけが流れる（B-17 は前半、B-18 は後半の分岐）
		const aa = playThrough(rousoku, { "B-17": "A", "B-18": "A" });
		const bb = playThrough(rousoku, { "B-17": "B", "B-18": "B" });
		expect(aa).toContain("……努力します");
		expect(bb).toContain("……なくしません");
		expect(aa).not.toContain("……なくしません");
		expect(aa.at(-1)).toBe(bb.at(-1));
	});

	test("⚠️十二月「年の瀬の夜」の開幕は、十一月の問いの選択で入れ替わる（ここでは訊かない）", () => {
		const toshinose = vignetteById("m12-toshi-no-se-no-yoru")!;
		// この場面自体は選択を持たないので、スキップは一息で終わりまで飛ぶ
		expect(toshinose.choices).toBeUndefined();
		expect(skipTo(toshinose, { "B-21": "A" }, 0).kind).toBe("end");
		const high = visibleLines(toshinose, { "B-21": "A" }).map((line) => line.text);
		const low = visibleLines(toshinose, { "B-21": "B" }).map((line) => line.text);
		expect(high).toContain("勘定台の上には、若菜が先に、紺の帳面を出して置いていた。");
		expect(low).not.toContain("勘定台の上には、若菜が先に、紺の帳面を出して置いていた。");
		expect(high.at(-1)).toBe(low.at(-1));
	});
});

describe("花常 スキップ", () => {
	test("⚠️スキップは選択肢の手前で必ず止まる（選択は飛ばさない）", () => {
		const zenya = vignetteById("p-00-kaiten-zenya")!;
		const step = skipTo(zenya, {}, 0);
		expect(step.kind).toBe("choice");
		expect(step.kind === "choice" && step.choice.id).toBe("B-00");
	});

	test("選択を答えたあとのスキップは、場面の終わりまで飛ぶ", () => {
		const zenya = vignetteById("p-00-kaiten-zenya")!;
		const at = skipTo(zenya, {}, 0);
		expect(at.kind).toBe("choice");
		const after = skipTo(zenya, { "B-00": "A" }, at.kind === "choice" ? at.index : 0);
		expect(after.kind).toBe("end");
	});

	test("選択のない場面のスキップは、一息で終わりまで飛ぶ", () => {
		expect(skipTo(vignetteById("m1-hamaichiba")!, {}, 0).kind).toBe("end");
		expect(skipTo(vignetteById("m1-chomen-0106")!, {}, 0).kind).toBe("end");
	});

	test("同じ選択を二度は訊かない（初売りの後半の分岐で止まらない）", () => {
		const hatsuuri = vignetteById("m1-hatsuuri")!;
		const first = skipTo(hatsuuri, {}, 0);
		expect(first.kind === "choice" && first.choice.id).toBe("B-01");
		const index = first.kind === "choice" ? first.index : 0;
		expect(skipTo(hatsuuri, { "B-01": "A" }, index).kind).toBe("end");
	});
});
