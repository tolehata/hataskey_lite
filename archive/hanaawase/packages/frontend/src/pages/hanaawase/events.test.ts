import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import eventHomeSource from "./EventHome.vue?raw";
import {
	EVENT_INDEX_TTL_MS,
	EVENT_INDEX_URL,
	EVENT_INDEX_REQUEST_INIT,
	HanaawaseEventLoader,
	currentRun,
	emptyEventProgress,
	eventArchived,
	eventBalance,
	eventRunFullTime,
	eventState,
	revealedEventStages,
} from "./events.js";
import hanaawasePageSource from "./index.vue?raw";

const entry = {
	id: "event-a",
	title: "試し",
	rev: 3,
	runs: [{ start: "2026-08-01T00:00+09:00", end: "2026-08-18T00:00+09:00", label: "初回" }],
	archiveFrom: "2026-08-18T00:00+09:00",
} as const;
const index = { v: 1, events: [entry] } as const;
const definition = {
	v: 1,
	id: "event-a",
	title: "試し",
	subtitle: "副題",
	season: "初夏",
	logo: null,
	home: "home.json",
	story: ["story/01.json"],
	stages: [{
		id: "ev-a-1",
		title: "第一局",
		goal: { flower: "ume", goalNeed: 10 },
		moves: 20,
		colors: ["matsu", "ume", "sakura"],
		starScores: [0, 100, 200],
		outOfSeasonRate: 0,
		ambience: "shop",
		points: 6,
		gimmick: null,
	}],
	backgrounds: { street: { file: "img/a.webp", fallback: "street" } },
	points: { id: "p", name: "札", icon: null },
	exchange: [{ itemId: "hasami", name: "鋏", cost: 10, limit: 3 }],
	chara: {
		name: "きよ",
		nameColor: "evt",
		tachie: "chara/pose_a.webp",
		faces: "chara/face_{n}.webp",
		lines: [{ text: "試しです", tags: ["初回"] }],
	},
	rally: { enabled: false },
	notice: ["開催時間"],
};
const home = {
	v: 1,
	bg: "img/a.webp",
	accent: "#8877aa",
	chara: "chara/pose_a.webp",
	line: "一言",
	entries: ["event-stages", "exchange", "event-story"],
};
const story = {
	v: 1,
	id: "ev-a-story-1",
	kind: "scene",
	title: "一場面",
	trigger: { at: "stage-clear", stageId: "ev-a-1" },
	synopsis: "あらすじ",
	lines: [
		{ kind: "narration", text: "朝だった。", bg: "evt:street" },
		{ kind: "say", speaker: "evt", name: "きよ", emo: 2, text: "おはようございます" },
	],
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: { "content-type": "application/json" },
});

describe("花常イベントローダ", () => {
	test("indexだけno-storeで取得し、60秒以内は再取得しない", async () => {
		let now = 1000;
		const fetcher = vi.fn(async () => response(index));
		const loader = new HanaawaseEventLoader(fetcher, () => now);
		expect(await loader.loadIndex()).toEqual(index);
		expect(await loader.loadIndex()).toEqual(index);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith(EVENT_INDEX_URL, EVENT_INDEX_REQUEST_INIT);
		now += EVENT_INDEX_TTL_MS;
		expect(await loader.loadIndex()).toEqual(index);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	test("TTL後の取得失敗は前回値を流用せずfail-closed", async () => {
		let now = 1000;
		const fetcher = vi.fn()
			.mockResolvedValueOnce(response(index))
			.mockResolvedValueOnce(response({}, 503));
		const loader = new HanaawaseEventLoader(fetcher, () => now);
		expect(await loader.loadIndex()).toEqual(index);
		now += EVENT_INDEX_TTL_MS;
		expect(await loader.loadIndex()).toBeUndefined();
		expect(await loader.loadIndex()).toBeUndefined();
	});

	test("event・home・storyはrev付きURLで読み、evt話者を保つ", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === EVENT_INDEX_URL) return response(index);
			if (url.endsWith("/event.json?rev=3")) return response(definition);
			if (url.endsWith("/home.json?rev=3")) return response(home);
			if (url.endsWith("/story/01.json?rev=3")) return response(story);
			return response({}, 404);
		});
		const loader = new HanaawaseEventLoader(fetcher);
		const loadedIndex = await loader.loadIndex();
		const loaded = loadedIndex ? await loader.loadEvent(loadedIndex.events[0]!) : undefined;
		expect(loaded?.definition.stages[0]?.flower).toBe("ume");
		expect(loaded?.stories[0]?.lines[1]).toMatchObject({ kind: "say", speaker: "evt", name: "きよ", emo: 2 });
		expect(fetcher.mock.calls.map((call) => String(call[0])).filter((url) => url.includes("event-a/")))
			.toEqual([
				"/client-assets/hanaawase/events/event-a/event.json?rev=3",
				"/client-assets/hanaawase/events/event-a/home.json?rev=3",
				"/client-assets/hanaawase/events/event-a/story/01.json?rev=3",
			]);
	});

	test("壊れたevent定義は画面へ渡さない", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes("event.json") ? response({ ...definition, stages: [{ id: "broken" }] }) : response(home));
		const loader = new HanaawaseEventLoader(fetcher);
		expect(await loader.loadEvent(entry)).toBeUndefined();
	});

	test("タイムゾーン無し・交換品ID重複・存在しない面を指す物語はfail-closed", async () => {
		const noZone = {
			...index,
			events: [{ ...entry, runs: [{ ...entry.runs[0], start: "2026-08-01T00:00" }] }],
		};
		const indexLoader = new HanaawaseEventLoader(async () => response(noZone));
		expect(await indexLoader.loadIndex()).toBeUndefined();

		const duplicateExchange = { ...definition, exchange: [definition.exchange[0], definition.exchange[0]] };
		const exchangeLoader = new HanaawaseEventLoader(async (input: RequestInfo | URL) =>
			String(input).includes("event.json") ? response(duplicateExchange) : response(home));
		expect(await exchangeLoader.loadEvent(entry)).toBeUndefined();

		const wrongStory = { ...story, trigger: { at: "stage-clear", stageId: "not-found" } };
		const storyLoader = new HanaawaseEventLoader(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("event.json")) return response(definition);
			if (url.includes("home.json")) return response(home);
			return response(wrongStory);
		});
		expect(await storyLoader.loadEvent(entry)).toBeUndefined();
	});

	test("配信する第1回イベントの実JSONをそのまま読める", async () => {
		const root = resolve(process.cwd(), "assets/hanaawase/events");
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input) === EVENT_INDEX_URL) {
				/*
				⚠️索引は 2026-07-30 から**サーバー設定（`meta.hanaawaseEventIndex`）＋API**が正本です。
				⚠️以前ここで読んでいた `assets/hanaawase/events/index.json` は**削除しました**。
				  配信される場所に置いたままだと、⚠️**運営者が書き換えても開催時間が変わらない**という
				  事故（＝二重の正本）になるためです。
				⚠️これは**テスト用の見本**。`assets/` ではなく `src/` に置いてあるので配信されません。
				⚠️本物の既定値は backend の `misc/hanaawase-event-index.ts` の
				  `DEFAULT_HANAAWASE_EVENT_INDEX` とマイグレーションの `DEFAULT` です。
				  ⚠️開催時間を変えるときは**管理画面から**であって、この見本を書き換えても何も起きません。
				*/
				return response(JSON.parse(
					await readFile(resolve(process.cwd(), "src/pages/hanaawase/event-index.fixture.json"), "utf8"),
				));
			}
			const url = new URL(String(input), "https://hanaawase.invalid");
			const relative = url.pathname.replace("/client-assets/hanaawase/events/", "");
			try {
				return response(JSON.parse(await readFile(join(root, relative), "utf8")));
			} catch {
				return response({}, 404);
			}
		});
		const loader = new HanaawaseEventLoader(fetcher);
		const actualIndex = await loader.loadIndex();
		expect(actualIndex?.events[0]?.id).toBe("mago-no-inuma");
		const actual = actualIndex ? await loader.loadEvent(actualIndex.events[0]!) : undefined;
		expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
			EVENT_INDEX_URL,
			"/client-assets/hanaawase/events/mago-no-inuma/event.json?rev=1",
			"/client-assets/hanaawase/events/mago-no-inuma/home.json?rev=1",
			...Array.from({ length: 6 }, (_, index) =>
				`/client-assets/hanaawase/events/mago-no-inuma/story/0${index + 1}.json?rev=1`),
		]);
		expect(actual?.index.id).toBe("mago-no-inuma");
		expect(actual?.definition.stages).toHaveLength(6);
		expect(actual?.stories).toHaveLength(6);
		expect(actual?.definition.backgrounds.kiyoba_front?.file).toBe("img/bg_kiyoba_front.webp");
		const stages = actual?.definition.stages ?? [];
		const exchange = actual?.definition.exchange ?? [];
		expect(Math.max(...stages.map((stage) => stage.goalNeed / stage.moves))).toBeLessThanOrEqual(1.27);
		expect(stages.map((stage) => stage.moves)).toEqual([22, 22, 21, 23, 24, 26]);
		expect(exchange.map((item) => item.cost)).toEqual([6, 6, 6, 5, 7, 9, 10, 11, 12]);
		expect(exchange.reduce((sum, item) => sum + item.cost * item.limit, 0)).toBe(108);
	});
});

describe("花常イベントの時間と残高", () => {
	test("局は済んだ局と次の一局だけを順に表示し、既知の旧記録は隠さない", () => {
		const stages = ["s1", "s2", "s3", "s4"].map((id) => ({ id }));
		const ids = (cleared: readonly string[]) => revealedEventStages(stages, cleared).map((stage) => stage.id);

		expect(ids([])).toEqual(["s1"]);
		expect(ids(["s1"])).toEqual(["s1", "s2"]);
		expect(ids(["s1", "s2"])).toEqual(["s1", "s2", "s3"]);
		expect(ids(["s1", "s2", "s3", "s4"])).toEqual(["s1", "s2", "s3", "s4"]);
		// 旧版では順不同で始められたため、既に見た第三局は隠さない。
		expect(ids(["s3"])).toEqual(["s1", "s2", "s3"]);
	});

	test("開催判定はstartを含みendを含まない半開区間", () => {
		expect(eventState(entry, Date.parse("2026-07-31T23:59:59+09:00"))).toBe("upcoming");
		expect(eventState(entry, Date.parse(entry.runs[0].start))).toBe("active");
		expect(eventState(entry, Date.parse("2026-08-17T23:59:59.999+09:00"))).toBe("active");
		expect(eventState(entry, Date.parse(entry.runs[0].end))).toBe("ended");
		expect(currentRun(entry, Date.parse("2026-07-01T00:00+09:00"))?.label).toBe("初回");
		expect(eventArchived(entry, Date.parse(entry.archiveFrom))).toBe(true);
	});

	test("開催時間の完全表記はJST・曜日・アーカイブ見出しを固定する", () => {
		expect(eventRunFullTime(entry.runs[0])).toBe(
			"開催時間\n2026年8月1日(土) 0:00 から\n2026年8月18日(火) 0:00 まで（日本標準時）");
		expect(eventRunFullTime(entry.runs[0], true)).toBe(
			"これまでの開催時間\n2026年8月1日(土) 0:00 から\n2026年8月18日(火) 0:00 まで（日本標準時）");
	});

	test("残高は累積獲得から交換済みだけを引き、0未満にしない", () => {
		const def = { ...definition, stages: [], exchange: definition.exchange } as never;
		expect(eventBalance(def, { ...emptyEventProgress(), points: 25, exchanged: { hasami: 2 } })).toBe(5);
		expect(eventBalance(def, { ...emptyEventProgress(), points: 5, exchanged: { hasami: 2 } })).toBe(0);
	});
});

describe("花常イベントとPCホームの表示", () => {
	test("イベントの局一覧は全貌を初回から出さず、表示済みの局だけを開始できる", () => {
		expect(eventHomeSource).toContain('v-for="(stage, index) in revealedStages"');
		expect(eventHomeSource).toContain("revealedEventStages(props.event.definition.stages, props.progress.stagesCleared)");
		expect(eventHomeSource).not.toContain("六つの花仕事");
		expect(hanaawasePageSource).toContain("const permitted = revealedEventStages(event.definition.stages, currentEventProgress.value.stagesCleared)");
		expect(hanaawasePageSource).toContain("if (!permitted) return;");
	});

	test("イベントの背景とタブ内容を別々にフェードし、動き控えめ設定も守る", () => {
		expect(eventHomeSource).toContain('<Transition name="event-bg-fade">');
		expect(eventHomeSource).toContain('<Transition name="event-panel-fade" mode="out-in">');
		expect(eventHomeSource).toContain("Object.values(props.event.definition.backgrounds)");
		expect(eventHomeSource).toContain('.event-bg-fade-enter-active, .event-bg-fade-leave-active');
		expect(eventHomeSource).toContain('.event-panel-fade-enter-active, .event-panel-fade-leave-active');
		expect(eventHomeSource).toContain('.event-home[data-motion="reduced"]');
	});

	test("イベント説明は右上の？ボタンからモーダルで開き、元の下部表示を残さない", () => {
		expect(eventHomeSource).toContain('class="event-help"');
		expect(eventHomeSource).toContain('aria-label="イベントの説明を開く"');
		expect(eventHomeSource).toContain('aria-haspopup="dialog"');
		expect(eventHomeSource).toContain('class="event-info-backdrop"');
		expect(eventHomeSource).toContain('role="dialog"');
		expect(eventHomeSource).toContain('aria-modal="true"');
		expect(eventHomeSource).toContain('{{ fullTime }}');
		expect(eventHomeSource).toContain('v-for="line in event.definition.notice"');
		expect(eventHomeSource).toContain('event.key === "Escape"');
		expect(eventHomeSource).toContain('event.key === "Tab"');
		expect(eventHomeSource).toContain('infoClose.value?.focus()');
		expect(eventHomeSource).toContain('infoButton.value?.focus()');
		expect(eventHomeSource).toContain('.event-home > .event-info-backdrop { position: absolute; z-index: 10; }');
		expect(eventHomeSource).toContain('.event-head { padding: 24px 62px 10px;');
		expect(eventHomeSource).not.toContain('<details class="event-notice">');
	});

	test("PCホームは左右を同じ可変高にし、小窓向けのcontainer queryを維持する", () => {
		const paneHeight = "clamp(720px, 74cqw, 840px)";
		expect(hanaawasePageSource.match(new RegExp(paneHeight.replace(/[()]/g, "\\$&"), "g"))).toHaveLength(2);
		expect(hanaawasePageSource).not.toContain("height: 640px");
		expect(hanaawasePageSource).toContain("@container (min-width: 920px)");
		expect(hanaawasePageSource).toContain("overflow-y: auto");
	});

	test("ホーム左上からページ全体を再読込せずゲーム一覧へ戻れる", () => {
		expect(hanaawasePageSource).toContain('class="home-exit"');
		expect(hanaawasePageSource).toContain('aria-label="花常を終了してゲーム一覧へ戻る"');
		expect(hanaawasePageSource).toContain('@click="leaveGame"');
		expect(hanaawasePageSource).toMatch(/function leaveGame\(\) \{\s*closeStoryForNavigation\(\);\s*showHome\(\);\s*router\.replaceByPath\("\/games"\);\s*\}/);
		expect(hanaawasePageSource).not.toContain('router.push("/games")');
		expect(hanaawasePageSource).toMatch(/\.home-shell > \.home-exit \{[^}]*z-index: 3;/);
		expect(hanaawasePageSource).not.toContain('window.location.assign("/games")');
	});

	test("入場・復帰・画面外への戻る操作で物語を自動開始しない", () => {
		const mounted = hanaawasePageSource.slice(
			hanaawasePageSource.indexOf("onMounted(async () => {"),
			hanaawasePageSource.indexOf("// 旗鯖fork: StackingRouterView"),
		);
		const activated = hanaawasePageSource.slice(
			hanaawasePageSource.indexOf("onActivated(() => {"),
			hanaawasePageSource.indexOf("onDeactivated(() => {"),
		);
		const deactivated = hanaawasePageSource.slice(
			hanaawasePageSource.indexOf("onDeactivated(() => {"),
			hanaawasePageSource.indexOf("onUnmounted(() => {"),
		);

		expect(mounted).not.toContain('playPendingStory("home")');
		expect(mounted).toContain("showHome()");
		expect(activated).not.toContain("playPendingStory");
		expect(activated).toContain("goHome()");
		expect(deactivated).toContain("closeStoryForNavigation()");
		expect(hanaawasePageSource).toContain('v-if="hasPendingHomeStory"');
		expect(hanaawasePageSource).toContain('@click="openPendingStory"');
		expect(hanaawasePageSource).toContain("新しい物語を読む");
		expect(hanaawasePageSource).toMatch(/function goHome\(\) \{\s*showHome\(\);\s*\}/);
	});

	test("局の開始時に目標を示し、歯車メニューとホーム帰還で局の境界を明確にする", () => {
		expect(hanaawasePageSource).toContain('class="goal-preview"');
		expect(hanaawasePageSource).toContain('aria-labelledby="goal-preview-title"');
		expect(hanaawasePageSource).toContain("goalPreviewKicker");
		expect(hanaawasePageSource).toContain("stageLabel(stage.value as StageDefinition)");
		expect(hanaawasePageSource).toContain("const GOAL_PREVIEW_MS = 2400");
		expect(hanaawasePageSource).toContain("void showGoalPreview()");
		expect(hanaawasePageSource).toContain("animation: hana-goal-preview-fill 2400ms");
		expect(hanaawasePageSource).toContain(":not(.board-bg, .board-bg-scrim, .goal-preview, .result, .leave-ask)");

		expect(hanaawasePageSource).toContain('aria-label="局のメニューを開く"');
		expect(hanaawasePageSource).toContain('v-html="ICONS.haguruma()"');
		expect(hanaawasePageSource).not.toContain('aria-label="月の一覧へ戻る"');

		expect(hanaawasePageSource).toContain("1局＝盤面から、その局に続く物語の終わりまで");
		expect(hanaawasePageSource).toContain('if (outcome.value === "clear" && playPendingStory("home")) return;');
		expect(hanaawasePageSource).toContain("goHomeAfterStage()");
		expect(hanaawasePageSource).not.toContain("const nextStage = LEVELS.find");
		expect(hanaawasePageSource).not.toContain("startStage(nextStage)");
	});

	test("通し読み一覧の戻る操作は未読物語を開始せずホームだけを表示する", () => {
		expect(hanaawasePageSource).toContain('scene === \'read\'');
		expect(hanaawasePageSource).toContain('aria-label="ホームへ戻る" @click="leaveReadback"');
		expect(hanaawasePageSource).toMatch(/function leaveReadback\(\) \{\s*showHome\(\);\s*\}/);
	});
});
