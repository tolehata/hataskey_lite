// ⚠️vitest は happy-dom（vite の web resolve）で走るため node:fs は使えない。
//   アセットの実在確認はここではできないので、枚数は下の固定表で押さえる。
import { describe, expect, test } from "vitest";
import {
	GALLERY_CHARS,
	STAGE_SEQUENCE,
	barksFor,
	bustupPath,
	clearedOrder,
	facePath,
	galleryCharById,
	isUnlocked,
	isStillUnlocked,
	posePath,
	stageOrder,
	stillPath,
	unlockedCount,
	unlockedStills,
} from "./gallery-data.js";
import type { GalleryChar, GalleryProgress } from "./gallery-data.js";
import gallerySource from "./Gallery.vue?raw";
import { MENU_LINES } from "./menu-lines.js";

const progressOf = (stars: Record<string, 0 | 1 | 2 | 3>, vignettesSeen: string[] = []): GalleryProgress =>
	({ stars, vignettesSeen });

// ⚠️実アセットの枚数。キャラごとに表情の数が違うので、存在しない番号を参照しないための固定表。
const FACE_COUNT: Record<string, number> = {
	wakana: 21, ren: 21, yae: 4, inukai: 4, gen: 3,
	tatsumi: 3, naito: 3, haruno: 3, amamiya: 3, tsune: 0,
};

describe("花常の名鑑データ", () => {
	test("IDが重複せず、全員が名前と説明を持つ", () => {
		const ids = GALLERY_CHARS.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of GALLERY_CHARS) {
			expect(entry.name.length).toBeGreaterThan(0);
			expect(entry.role.length).toBeGreaterThan(0);
			expect(entry.summary.length).toBeGreaterThan(0);
			expect(galleryCharById(entry.id)).toBe(entry);
		}
	});

	test("表情番号は1から連番で、実アセットの枚数と一致する", () => {
		for (const entry of GALLERY_CHARS) {
			expect(entry.faces.length).toBe(FACE_COUNT[entry.id]);
			entry.faces.forEach((face, index) => {
				expect(face.n).toBe(index + 1);
				expect(face.label.length).toBeGreaterThan(0);
			});
		}
	});

	test("バストアップが生成済みなのは若菜とレンだけで、表情の枚数を超えない", () => {
		for (const entry of GALLERY_CHARS) {
		if (entry.id === "wakana" || entry.id === "ren") expect(entry.bustupCount).toBe(21);
			else expect(entry.bustupCount).toBe(0);
			expect(entry.bustupCount).toBeLessThanOrEqual(entry.faces.length);
		}
	});

	test("スチルを持つのは生成済みの若菜とレンだけ", () => {
		for (const entry of GALLERY_CHARS) {
			if (entry.id === "wakana" || entry.id === "ren") expect(entry.stills.length).toBeGreaterThan(0);
			else expect(entry.stills).toEqual([]);
			const files = entry.stills.map((still) => still.file);
			expect(new Set(files).size).toBe(files.length);
			for (const still of entry.stills) {
				expect(Number.isInteger(still.since)).toBe(true);
				expect(still.since).toBeGreaterThanOrEqual(1);
				expect(still.since).toBeLessThanOrEqual(12);
			}
		}
	});

	test("解放条件のステージIDは本編36面のいずれか", () => {
		for (const entry of GALLERY_CHARS) {
			if (entry.unlock.stage === null) continue;
			expect(STAGE_SEQUENCE).toContain(entry.unlock.stage);
		}
	});

	test("画像パスは /client-assets/hanaawase/ 配下を指す", () => {
		expect(posePath("wakana")).toBe("/client-assets/hanaawase/chara/wakana/pose_a.webp");
		expect(facePath("ren", 5)).toBe("/client-assets/hanaawase/chara/ren/face_5.webp");
		expect(bustupPath("wakana", 4)).toBe("/client-assets/hanaawase/chara/wakana/bustup_4.webp");
		expect(stillPath("ren", "laugh")).toBe("/client-assets/hanaawase/still/ren/laugh.webp");
	});
});

describe("花常の名鑑の解放判定", () => {
	test("ステージ順は36面が睦月から師走まで並ぶ", () => {
		expect(STAGE_SEQUENCE.length).toBe(36);
		expect(STAGE_SEQUENCE[0]).toBe("m1-1");
		expect(STAGE_SEQUENCE[35]).toBe("m12-3");
		expect(stageOrder("m1-1")).toBe(0);
		expect(stageOrder("m2-1")).toBeGreaterThan(stageOrder("m1-3"));
		expect(stageOrder("shiranai")).toBe(-1);
	});

	test("星0や未知のIDはクリア扱いにしない", () => {
		expect(clearedOrder(progressOf({}))).toBe(-1);
		expect(clearedOrder(progressOf({ "m1-1": 0 }))).toBe(-1);
		expect(clearedOrder(progressOf({ "m99-9": 3 } as Record<string, 3>))).toBe(-1);
		expect(clearedOrder(progressOf({ "m1-1": 1, "m3-2": 2 }))).toBe(stageOrder("m3-2"));
	});

	test("進行ゼロでは若菜と常だけが開いていて、ほかは伏せられる", () => {
		const empty = progressOf({});
		const open = GALLERY_CHARS.filter((entry) => isUnlocked(entry, empty)).map((entry) => entry.id);
		expect(open).toEqual(["wakana", "tsune"]);
		expect(unlockedCount(empty)).toBe(2);
	});

	test("登場した月のステージをクリアすると解放される", () => {
		const afterFirst = progressOf({ "m1-1": 1 });
		expect(isUnlocked(galleryCharById("yae") as GalleryChar, afterFirst)).toBe(true);
		expect(isUnlocked(galleryCharById("ren") as GalleryChar, afterFirst)).toBe(false);
		expect(isUnlocked(galleryCharById("tatsumi") as GalleryChar, afterFirst)).toBe(false);

		const afterSecond = progressOf({ "m1-1": 1, "m1-2": 3 });
		expect(isUnlocked(galleryCharById("ren") as GalleryChar, afterSecond)).toBe(true);
		expect(isUnlocked(galleryCharById("gen") as GalleryChar, afterSecond)).toBe(false);
	});

	test("先の月から遊んでも、それ以前の人物は解放される", () => {
		const jumped = progressOf({ "m7-2": 1 });
		expect(isUnlocked(galleryCharById("amamiya") as GalleryChar, jumped)).toBe(true);
		expect(isUnlocked(galleryCharById("inukai") as GalleryChar, jumped)).toBe(true);
		// ⚠️まだ先の人物は出さない。
		expect(isUnlocked(galleryCharById("naito") as GalleryChar, jumped)).toBe(false);
	});

	test("全面クリアで全員が解放される", () => {
		const all: Record<string, 3> = {};
		for (const id of STAGE_SEQUENCE) all[id] = 3;
		expect(unlockedCount(progressOf(all))).toBe(GALLERY_CHARS.length);
	});

	test("ビネットIDでも解放できる", () => {
		const entry: GalleryChar = { ...(galleryCharById("naito") as GalleryChar), unlock: { stage: "m10-1", vignette: "v-test" } };
		expect(isUnlocked(entry, progressOf({}))).toBe(false);
		expect(isUnlocked(entry, progressOf({}, ["v-test"]))).toBe(true);
	});

	test("ひとこまは進行ゼロでは0枚で、対応する月への到達後に増える", () => {
		const wakana = galleryCharById("wakana") as GalleryChar;
		expect(unlockedStills(wakana, progressOf({}))).toHaveLength(0);
		expect(unlockedStills(wakana, progressOf({ "m1-1": 1 }))).toHaveLength(3);
		expect(unlockedStills(wakana, progressOf({ "m3-1": 1 }))).toHaveLength(8);
		expect(unlockedStills(wakana, progressOf({ "m12-1": 1 }))).toHaveLength(wakana.stills.length);
	});

	test("ひとこまの不正な月は解放しない", () => {
		const full = progressOf({ "m12-3": 3 });
		expect(isStillUnlocked({ file: "x", title: "x", since: 0 }, full)).toBe(false);
		expect(isStillUnlocked({ file: "x", title: "x", since: 13 }, full)).toBe(false);
		expect(isStillUnlocked({ file: "x", title: "x", since: 1.5 }, full)).toBe(false);
	});
});

describe("花常の名鑑のひとこと", () => {
	test("セリフを持つのは menu-lines.ts にいる面々だけ", () => {
		for (const entry of GALLERY_CHARS) {
			const lines = barksFor(entry.id);
			if (entry.id === "haruno" || entry.id === "amamiya" || entry.id === "tsune") expect(lines).toEqual([]);
			else expect(lines.length).toBeGreaterThan(0);
		}
	});

	test("伏線(rare)と進行段階限定(prog)の行は図鑑に出さない", () => {
		const sensitive = new Set(MENU_LINES.filter((line) => line.rare === true || line.prog !== undefined).map((line) => line.t));
		expect(sensitive.size).toBeGreaterThan(0);
		for (const entry of GALLERY_CHARS) {
			for (const bark of barksFor(entry.id)) expect(sensitive.has(bark)).toBe(false);
		}
	});

	test("同じ本文を重ねて返さない", () => {
		for (const entry of GALLERY_CHARS) {
			const lines = barksFor(entry.id);
			expect(new Set(lines).size).toBe(lines.length);
		}
	});
});

describe("花常の名鑑レイアウト", () => {
	test("一覧と詳細の100%幅カードをborder-boxへ収め、小窓幅をcontainerで判定する", () => {
		expect(gallerySource).toContain(".gallery-scope *::after { box-sizing: border-box; }");
		expect(gallerySource).toContain(".gallery-grid > li, .still-grid > li { min-width: 0; }");
		expect(gallerySource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
		expect(gallerySource).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
		expect(gallerySource).toContain("@container (max-width: 420px)");
		expect(gallerySource).not.toContain("@media (max-width: 420px)");
	});
});
