/**
 * 花常イベントの開催索引と静的な演出素材を読む実行時基盤。
 * 開催索引だけは管理画面のサーバー設定を読み、イベント本文・画像は静的素材を使う。
 */
import { apiUrl } from "@@/js/config.js";
import type { AmbienceKind } from "./ambience.js";
import type { Flower } from "./engine.js";
import type { EventProgress } from "./storage.js";
import type { Line, Vignette } from "./story/index.js";

const EVENT_ROOT = "/client-assets/hanaawase/events";
export const EVENT_INDEX_URL = `${apiUrl}/games/hanaawase/event-index`;
export const EVENT_INDEX_REQUEST_INIT: RequestInit = {
	method: "POST",
	body: "{}",
	credentials: "omit",
	cache: "no-store",
	headers: {
		"Content-Type": "application/json",
	},
};
export const EVENT_INDEX_TTL_MS = 60_000;

export type EventRun = Readonly<{ start: string; end: string; label: string }>;
export type EventIndexEntry = Readonly<{
	id: string;
	title: string;
	rev: number;
	runs: readonly EventRun[];
	archiveFrom: string;
}>;
export type EventIndex = Readonly<{ v: 1; events: readonly EventIndexEntry[] }>;

export type EventStage = Readonly<{
	id: string;
	title: string;
	flower: Flower;
	goalNeed: number;
	moves: number;
	colors: readonly Flower[];
	starScores: readonly [number, number, number];
	outOfSeasonRate: number;
	ambience: AmbienceKind;
	points: number;
	gimmick: null | Readonly<{ id: string; params?: Readonly<Record<string, unknown>> }>;
}>;
export type EventExchangeItem = Readonly<{
	itemId: string;
	name: string;
	cost: number;
	limit: number;
}>;
export type EventBackground = Readonly<{ file: string; fallback: string }>;
export type EventCharaLine = Readonly<{ text: string; tags: readonly string[] }>;
export type EventDefinition = Readonly<{
	v: 1;
	id: string;
	title: string;
	subtitle: string;
	season: string;
	logo: string | null;
	home: string;
	story: readonly string[];
	stages: readonly EventStage[];
	backgrounds: Readonly<Record<string, EventBackground>>;
	points: Readonly<{ id: string; name: string; icon: string | null }>;
	exchange: readonly EventExchangeItem[];
	chara: Readonly<{
		name: string;
		nameColor: string;
		tachie: string;
		faces: string;
		lines: readonly EventCharaLine[];
	}>;
	rally: Readonly<{ enabled: boolean }>;
	notice: readonly string[];
}>;
export type EventHome = Readonly<{
	v: 1;
	bg: string;
	accent: string;
	chara: string;
	line: string;
	entries: readonly string[];
}>;
export type LoadedEvent = Readonly<{
	index: EventIndexEntry;
	definition: EventDefinition;
	home: EventHome;
	stories: readonly Vignette[];
}>;
export type EventState = "active" | "upcoming" | "ended";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const stringValue = (value: unknown) => typeof value === "string" ? value : undefined;
const finiteInt = (value: unknown, minimum = 0) =>
	typeof value === "number" && Number.isInteger(value) && value >= minimum ? value : undefined;
const stringArray = (value: unknown): string[] | undefined =>
	Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
const validDate = (value: unknown): value is string =>
	typeof value === "string"
	&& /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
	&& Number.isFinite(Date.parse(value));
const validId = (value: unknown): value is string =>
	typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
const validAssetId = (value: unknown): value is string =>
	typeof value === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(value);
const FLOWERS = new Set<Flower>(["matsu", "ume", "sakura", "ajisai", "himawari", "kiku"]);
const AMBIENCES = new Set<AmbienceKind>(["shop", "rain", "wind", "silent"]);

function parseIndex(input: unknown): EventIndex | undefined {
	if (!isRecord(input) || input.v !== 1 || !Array.isArray(input.events)) return undefined;
	const events: EventIndexEntry[] = [];
	const ids = new Set<string>();
	for (const raw of input.events) {
		if (!isRecord(raw) || !validId(raw.id) || ids.has(raw.id)) return undefined;
		const title = stringValue(raw.title);
		const rev = finiteInt(raw.rev, 1);
		if (!title || rev === undefined || !Array.isArray(raw.runs) || !validDate(raw.archiveFrom)) return undefined;
		const runs: EventRun[] = [];
		for (const run of raw.runs) {
			if (!isRecord(run) || !validDate(run.start) || !validDate(run.end) || typeof run.label !== "string") return undefined;
			if (Date.parse(run.start) >= Date.parse(run.end)) return undefined;
			runs.push({ start: run.start, end: run.end, label: run.label });
		}
		if (runs.length === 0 || raw.archiveFrom !== runs[0]?.end) return undefined;
		ids.add(raw.id);
		events.push({ id: raw.id, title, rev, runs, archiveFrom: raw.archiveFrom });
	}
	return { v: 1, events };
}

function parseStage(input: unknown): EventStage | undefined {
	if (!isRecord(input) || !validId(input.id) || typeof input.title !== "string" || !isRecord(input.goal)) return undefined;
	const flower = input.goal.flower;
	const goalNeed = finiteInt(input.goal.goalNeed, 1);
	const moves = finiteInt(input.moves, 1);
	const points = finiteInt(input.points, 0);
	const colors = Array.isArray(input.colors) && input.colors.every((entry) => FLOWERS.has(entry as Flower))
		? input.colors as Flower[]
		: undefined;
	const scores = Array.isArray(input.starScores) && input.starScores.length === 3
		&& input.starScores.every((entry) => finiteInt(entry) !== undefined)
		? input.starScores as [number, number, number]
		: undefined;
	if (!FLOWERS.has(flower as Flower) || goalNeed === undefined || moves === undefined || points === undefined || !colors || !scores) return undefined;
	if (typeof input.outOfSeasonRate !== "number" || input.outOfSeasonRate < 0 || input.outOfSeasonRate > 1) return undefined;
	if (!AMBIENCES.has(input.ambience as AmbienceKind)) return undefined;
	if (input.gimmick !== null && (!isRecord(input.gimmick) || typeof input.gimmick.id !== "string")) return undefined;
	return {
		id: input.id,
		title: input.title,
		flower: flower as Flower,
		goalNeed,
		moves,
		colors,
		starScores: scores,
		outOfSeasonRate: input.outOfSeasonRate,
		ambience: input.ambience as AmbienceKind,
		points,
		gimmick: input.gimmick as EventStage["gimmick"],
	};
}

function parseDefinition(input: unknown, expectedId: string): EventDefinition | undefined {
	if (!isRecord(input) || input.v !== 1 || input.id !== expectedId) return undefined;
	const title = stringValue(input.title);
	const subtitle = stringValue(input.subtitle);
	const season = stringValue(input.season);
	const home = stringValue(input.home);
	const story = stringArray(input.story);
	if (!title || !subtitle || !season || !home || !story || !Array.isArray(input.stages)) return undefined;
	if (new Set(story).size !== story.length) return undefined;
	const stages = input.stages.map(parseStage);
	if (stages.some((entry) => entry === undefined) || new Set(stages.map((entry) => entry?.id)).size !== stages.length) return undefined;
	if (!isRecord(input.backgrounds) || !isRecord(input.points) || !Array.isArray(input.exchange) || !isRecord(input.chara)) return undefined;
	const backgrounds: Record<string, EventBackground> = {};
	for (const [id, raw] of Object.entries(input.backgrounds)) {
		if (!validAssetId(id) || !isRecord(raw) || typeof raw.file !== "string" || typeof raw.fallback !== "string") return undefined;
		backgrounds[id] = { file: raw.file, fallback: raw.fallback };
	}
	const exchange: EventExchangeItem[] = [];
	const itemIds = new Set<string>();
	for (const raw of input.exchange) {
		if (!isRecord(raw) || !validId(raw.itemId) || itemIds.has(raw.itemId) || typeof raw.name !== "string") return undefined;
		const cost = finiteInt(raw.cost, 1);
		const limit = finiteInt(raw.limit, 1);
		if (cost === undefined || limit === undefined) return undefined;
		itemIds.add(raw.itemId);
		exchange.push({ itemId: raw.itemId, name: raw.name, cost, limit });
	}
	const lines = Array.isArray(input.chara.lines) ? input.chara.lines.flatMap((raw): EventCharaLine[] => {
		if (!isRecord(raw) || typeof raw.text !== "string") return [];
		const tags = stringArray(raw.tags);
		return tags ? [{ text: raw.text, tags }] : [];
	}) : [];
	const notice = stringArray(input.notice);
	if (lines.length !== (input.chara.lines as unknown[])?.length || !notice || !isRecord(input.rally)) return undefined;
	if (!validId(input.points.id) || typeof input.points.name !== "string") return undefined;
	if (typeof input.chara.name !== "string" || typeof input.chara.nameColor !== "string"
		|| typeof input.chara.tachie !== "string" || typeof input.chara.faces !== "string") return undefined;
	return {
		v: 1,
		id: expectedId,
		title,
		subtitle,
		season,
		logo: typeof input.logo === "string" ? input.logo : null,
		home,
		story,
		stages: stages as EventStage[],
		backgrounds,
		points: {
			id: input.points.id,
			name: input.points.name,
			icon: typeof input.points.icon === "string" ? input.points.icon : null,
		},
		exchange,
		chara: {
			name: input.chara.name,
			nameColor: input.chara.nameColor,
			tachie: input.chara.tachie,
			faces: input.chara.faces,
			lines,
		},
		rally: { enabled: input.rally.enabled === true },
		notice,
	};
}

function parseHome(input: unknown): EventHome | undefined {
	if (!isRecord(input) || input.v !== 1) return undefined;
	const entries = stringArray(input.entries);
	if (typeof input.bg !== "string" || typeof input.accent !== "string"
		|| typeof input.chara !== "string" || typeof input.line !== "string" || !entries) return undefined;
	return { v: 1, bg: input.bg, accent: input.accent, chara: input.chara, line: input.line, entries };
}

function parseStory(input: unknown): Vignette | undefined {
	if (!isRecord(input) || input.v !== 1 || typeof input.id !== "string"
		|| (input.kind !== "scene" && input.kind !== "chomen") || typeof input.title !== "string"
		|| typeof input.synopsis !== "string" || !isRecord(input.trigger) || !Array.isArray(input.lines)) return undefined;
	if (input.trigger.at !== "stage-clear" || typeof input.trigger.stageId !== "string") return undefined;
	const lines: Line[] = [];
	for (const raw of input.lines) {
		if (!isRecord(raw) || typeof raw.text !== "string") return undefined;
		const bg = typeof raw.bg === "string" ? raw.bg : undefined;
		if (raw.kind === "narration" || raw.kind === "diary") {
			lines.push({ kind: raw.kind, text: raw.text, ...(bg ? { bg } : {}) });
			continue;
		}
		if (raw.kind !== "say" || !["wakana", "ren", "sub", "evt"].includes(String(raw.speaker))) return undefined;
		const emo = finiteInt(raw.emo, 1);
		if (emo !== undefined && emo > 21) return undefined;
		lines.push({
			kind: "say",
			speaker: raw.speaker as "wakana" | "ren" | "sub" | "evt",
			...(typeof raw.name === "string" ? { name: raw.name } : {}),
			...(emo !== undefined ? { emo: emo as 1 } : {}),
			text: raw.text,
			...(bg ? { bg } : {}),
		});
	}
	return {
		id: input.id,
		kind: input.kind,
		month: 0,
		title: input.title,
		trigger: { at: "stage-clear", stageId: input.trigger.stageId },
		synopsis: input.synopsis,
		lines,
	};
}

async function json(fetcher: Fetcher, url: string, init?: RequestInit): Promise<unknown> {
	const response = await fetcher(url, init);
	if (!response.ok) throw new Error(`event fetch failed: ${response.status}`);
	return response.json();
}

export class HanaawaseEventLoader {
	private cached?: Readonly<{ at: number; value: EventIndex }>;

	public constructor(
		private readonly fetcher: Fetcher = window.fetch.bind(window),
		private readonly now: () => number = Date.now,
	) {}

	/** 失敗時は前回値を流用せず undefined（fail-closed）。 */
	public async loadIndex(force = false): Promise<EventIndex | undefined> {
		const now = this.now();
		if (!force && this.cached && now - this.cached.at < EVENT_INDEX_TTL_MS) return this.cached.value;
		try {
			const parsed = parseIndex(await json(this.fetcher, EVENT_INDEX_URL, EVENT_INDEX_REQUEST_INIT));
			if (!parsed) throw new Error("invalid event index");
			this.cached = { at: now, value: parsed };
			return parsed;
		} catch {
			this.cached = undefined;
			return undefined;
		}
	}

	public async loadEvent(index: EventIndexEntry): Promise<LoadedEvent | undefined> {
		const base = `${EVENT_ROOT}/${index.id}`;
		const revision = `?rev=${index.rev}`;
		try {
			const definition = parseDefinition(await json(this.fetcher, `${base}/event.json${revision}`), index.id);
			if (!definition) return undefined;
			const home = parseHome(await json(this.fetcher, `${base}/${definition.home}${revision}`));
			if (!home) return undefined;
			const stories = await Promise.all(definition.story.map(async (file) =>
				parseStory(await json(this.fetcher, `${base}/${file}${revision}`))));
			if (stories.some((story) => story === undefined)) return undefined;
			const parsedStories = stories as Vignette[];
			const stageIds = new Set(definition.stages.map((stage) => stage.id));
			if (new Set(parsedStories.map((story) => story.id)).size !== parsedStories.length
				|| parsedStories.some((story) =>
					story.trigger.at !== "stage-clear" || !stageIds.has(story.trigger.stageId))) return undefined;
			return { index, definition, home, stories: parsedStories };
		} catch {
			return undefined;
		}
	}
}

export function eventState(entry: EventIndexEntry, now = Date.now()): EventState {
	if (entry.runs.some((run) => Date.parse(run.start) <= now && now < Date.parse(run.end))) return "active";
	if (entry.runs.some((run) => now < Date.parse(run.start))) return "upcoming";
	return "ended";
}

export function currentRun(entry: EventIndexEntry, now = Date.now()): EventRun | undefined {
	return entry.runs.find((run) => Date.parse(run.start) <= now && now < Date.parse(run.end))
		?? entry.runs.filter((run) => now < Date.parse(run.start))
			.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
}

export function eventRunFullTime(run: EventRun, archived = false): string {
	const format = (iso: string) => {
		const parts = new Intl.DateTimeFormat("ja-JP", {
			timeZone: "Asia/Tokyo",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			weekday: "short",
			hour: "numeric",
			minute: "2-digit",
			hourCycle: "h23",
		}).formatToParts(new Date(iso));
		const get = (type: Intl.DateTimeFormatPartTypes) =>
			parts.find((part) => part.type === type)?.value ?? "";
		return `${get("year")}年${get("month")}月${get("day")}日(${get("weekday")}) ${get("hour")}:${get("minute")}`;
	};
	const heading = archived ? "これまでの開催時間" : "開催時間";
	return `${heading}\n${format(run.start)} から\n${format(run.end)} まで（日本標準時）`;
}

export const eventArchived = (entry: EventIndexEntry, now = Date.now()) =>
	now >= Date.parse(entry.archiveFrom);

export const eventAssetPath = (eventId: string, file: string, rev: number) =>
	`${EVENT_ROOT}/${eventId}/${file}?rev=${rev}`;

export function eventSpent(definition: EventDefinition, progress: EventProgress): number {
	return definition.exchange.reduce((sum, item) =>
		sum + item.cost * Math.min(item.limit, progress.exchanged[item.itemId] ?? 0), 0);
}

export const eventBalance = (definition: EventDefinition, progress: EventProgress) =>
	Math.max(0, progress.points - eventSpent(definition, progress));

/**
 * イベントの局は、済んだ局と次に挑める一局だけを順に見せる。
 * 旧版で順番を飛ばしてクリアした記録も、既知の局を隠して進行不能にしないよう保持する。
 */
export function revealedEventStages<T extends Readonly<{ id: string }>>(
	stages: readonly T[],
	stagesCleared: readonly string[],
): readonly T[] {
	const cleared = new Set(stagesCleared);
	const highestKnown = stages.reduce((highest, stage, index) =>
		cleared.has(stage.id) ? index : highest, -1);
	const next = stages.findIndex((stage) => !cleared.has(stage.id));
	const lastVisible = Math.max(highestKnown, next === -1 ? stages.length - 1 : next);
	return stages.slice(0, lastVisible + 1);
}

export const emptyEventProgress = (): EventProgress => ({
	points: 0,
	exchanged: {},
	stagesCleared: [],
	storySeen: [],
	rallyContrib: 0,
});
