import { miLocalStorage } from "@/local-storage.js";
import { misskeyApi } from "@/utility/misskey-api.js";

/** 花常だけが使うアカウントレジストリ。プロフィール・寄付状態などは参照しない。 */
export const HANA_AWASE_SCOPE = ["client", "hanaawase"] as const;
export const SAVE_VERSION = 1 as const;
const CACHE_PREFIX = "miux:hanaawase:" as const;

export type StarCount = 0 | 1 | 2 | 3;
export type Progress = Readonly<{
	v: typeof SAVE_VERSION;
	stars: Readonly<Record<string, StarCount>>;
	vignettesSeen: readonly string[];
	hintsSeen: readonly string[];
	disclaimerSeen: boolean;
	/** 読んだ注意書きの版。index.vue の DISCLAIMER_REV より小さければ、既読の人にも再表示する。 */
	disclaimerRev: number;
	choices: Readonly<Record<string, "A" | "B">>;
	tools: Readonly<{ hasami: number; tenaoshi: number; uchimizu: number }>;
	toolsUnlocked: readonly string[];
	updatedAt: number;
}>;
export type Daily = Readonly<{
	v: typeof SAVE_VERSION;
	lastPlayed: string;
	streak: number;
	best: number;
	freezes: number;
	freezeMonth: string;
	plays: number;
	longest: number;
	updatedAt: number;
}>;
export type GameSettings = Readonly<{
	v: typeof SAVE_VERSION;
	se: boolean;
	/**
	 * 環境音（店・雨・風のループ）。⚠️**既定は切**。
	 * ⚠️利用者から「ずっと響いていて不快」と報告があったため、効果音とは別の栓にして既定を切にした。
	 * ⚠️`se` を切ると環境音も止まる（親子関係。UIの文言もそう書いてある）。
	 */
	amb: boolean;
	motion: "normal" | "reduced";
	barks: boolean;
	updatedAt: number;
}>;
export type EventProgress = Readonly<{
	/**
	 * マージで減らさないための累積獲得数。画面の残高は交換済みの必要数を差し引いて求める。
	 * ⚠️有償取得・譲渡は存在しない。
	 */
	points: number;
	exchanged: Readonly<Record<string, number>>;
	stagesCleared: readonly string[];
	storySeen: readonly string[];
	rallyContrib: number;
	completedAt?: number;
}>;
export type EventSave = Readonly<{
	v: typeof SAVE_VERSION;
	updatedAt: number;
	byEvent: Readonly<Record<string, EventProgress>>;
	kazari: readonly string[];
}>;
export type SaveKey = "progress" | "daily" | "settings" | "events";
export type SaveMap = Readonly<{ progress: Progress; daily: Daily; settings: GameSettings; events: EventSave }>;
export type SaveStatus = "saved" | "queued" | "readonly";
export type RegistryApi = (endpoint: "i/registry/get" | "i/registry/set" | "i/registry/remove", data: {
	scope: readonly string[];
	key: SaveKey;
	value?: unknown;
}) => Promise<unknown>;
export type Cache = Readonly<{
	getItem: (key: `miux:${string}`) => string | null;
	setItem: (key: `miux:${string}`, value: string) => void;
	removeItem: (key: `miux:${string}`) => void;
}>;
export type LoadResult = Readonly<{
	data: SaveMap;
	readOnly: boolean;
	recoveryAvailable: boolean;
}>;

const keys: readonly SaveKey[] = ["progress", "daily", "settings", "events"];
const cacheKey = (key: SaveKey): `miux:${string}` => `${CACHE_PREFIX}${key}`;
const recoveryKey = (key: SaveKey): `miux:${string}` => `${CACHE_PREFIX}recovery:${key}`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const numberAtLeast = (value: unknown, minimum = 0) =>
	typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;
const uniqueStrings = (value: unknown): string[] =>
	Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
const updatedAtOf = (value: { updatedAt: number }) => value.updatedAt;
const maxTool = (value: unknown) => Math.min(5, numberAtLeast(value));
const emptyProgress = (): Progress => ({
	v: SAVE_VERSION, stars: {}, vignettesSeen: [], hintsSeen: [], disclaimerSeen: false, disclaimerRev: 0,
	choices: {}, tools: { hasami: 0, tenaoshi: 0, uchimizu: 0 }, toolsUnlocked: [], updatedAt: 0,
});
const emptyDaily = (): Daily => ({
	v: SAVE_VERSION, lastPlayed: "", streak: 0, best: 0, freezes: 0, freezeMonth: "",
	plays: 0, longest: 0, updatedAt: 0,
});
const emptySettings = (): GameSettings => ({
	v: SAVE_VERSION, se: true, amb: false, motion: "normal", barks: true, updatedAt: 0,
});
const emptyEvents = (): EventSave => ({
	v: SAVE_VERSION, updatedAt: 0, byEvent: {}, kazari: [],
});
export const emptySaveMap = (): SaveMap => ({
	progress: emptyProgress(), daily: emptyDaily(), settings: emptySettings(), events: emptyEvents(),
});

type Decoded<T> = Readonly<{ value: T; future: boolean }>;
const versionIsFuture = (value: Record<string, unknown>) =>
	typeof value.v === "number" && value.v > SAVE_VERSION;

const decodeProgress = (input: unknown): Decoded<Progress> | undefined => {
	if (!isRecord(input)) return undefined;
	if (versionIsFuture(input)) return { value: emptyProgress(), future: true };
	const stars: Record<string, StarCount> = {};
	if (isRecord(input.stars)) for (const [id, value] of Object.entries(input.stars)) {
		if (value === 0 || value === 1 || value === 2 || value === 3) stars[id] = value;
	}
	const choices: Record<string, "A" | "B"> = {};
	if (isRecord(input.choices)) for (const [id, value] of Object.entries(input.choices)) {
		if (value === "A" || value === "B") choices[id] = value;
	}
	const tools = isRecord(input.tools) ? input.tools : {};
	return { value: {
		v: SAVE_VERSION, stars, vignettesSeen: uniqueStrings(input.vignettesSeen), hintsSeen: uniqueStrings(input.hintsSeen),
		disclaimerSeen: input.disclaimerSeen === true, disclaimerRev: numberAtLeast(input.disclaimerRev), choices,
		tools: { hasami: maxTool(tools.hasami), tenaoshi: maxTool(tools.tenaoshi), uchimizu: maxTool(tools.uchimizu) },
		toolsUnlocked: uniqueStrings(input.toolsUnlocked), updatedAt: numberAtLeast(input.updatedAt),
	}, future: false };
};
const decodeDaily = (input: unknown): Decoded<Daily> | undefined => {
	if (!isRecord(input)) return undefined;
	if (versionIsFuture(input)) return { value: emptyDaily(), future: true };
	return { value: {
		v: SAVE_VERSION, lastPlayed: typeof input.lastPlayed === "string" ? input.lastPlayed : "",
		streak: numberAtLeast(input.streak), best: numberAtLeast(input.best), freezes: numberAtLeast(input.freezes),
		freezeMonth: typeof input.freezeMonth === "string" ? input.freezeMonth : "", plays: numberAtLeast(input.plays),
		longest: numberAtLeast(input.longest), updatedAt: numberAtLeast(input.updatedAt),
	}, future: false };
};
const decodeSettings = (input: unknown): Decoded<GameSettings> | undefined => {
	if (!isRecord(input)) return undefined;
	if (versionIsFuture(input)) return { value: emptySettings(), future: true };
	return { value: {
		v: SAVE_VERSION, se: input.se !== false,
		// ⚠️既定は切。古い保存には amb が無いので、明示的に true のときだけ入れる。
		amb: input.amb === true, motion: input.motion === "reduced" ? "reduced" : "normal",
		barks: input.barks !== false, updatedAt: numberAtLeast(input.updatedAt),
	}, future: false };
};
const decodeEvents = (input: unknown): Decoded<EventSave> | undefined => {
	if (!isRecord(input)) return undefined;
	if (versionIsFuture(input)) return { value: emptyEvents(), future: true };
	const byEvent: Record<string, EventProgress> = {};
	if (isRecord(input.byEvent)) for (const [eventId, raw] of Object.entries(input.byEvent)) {
		if (!isRecord(raw)) continue;
		const exchanged: Record<string, number> = {};
		if (isRecord(raw.exchanged)) for (const [itemId, count] of Object.entries(raw.exchanged)) {
			exchanged[itemId] = numberAtLeast(count);
		}
		const completedAt = numberAtLeast(raw.completedAt);
		byEvent[eventId] = {
			points: numberAtLeast(raw.points),
			exchanged,
			stagesCleared: uniqueStrings(raw.stagesCleared),
			storySeen: uniqueStrings(raw.storySeen),
			rallyContrib: numberAtLeast(raw.rallyContrib),
			...(completedAt > 0 ? { completedAt } : {}),
		};
	}
	return { value: {
		v: SAVE_VERSION,
		updatedAt: numberAtLeast(input.updatedAt),
		byEvent,
		kazari: uniqueStrings(input.kazari),
	}, future: false };
};
const decode = <K extends SaveKey>(key: K, value: unknown): Decoded<SaveMap[K]> | undefined => {
	if (key === "progress") return decodeProgress(value) as Decoded<SaveMap[K]> | undefined;
	if (key === "daily") return decodeDaily(value) as Decoded<SaveMap[K]> | undefined;
	if (key === "settings") return decodeSettings(value) as Decoded<SaveMap[K]> | undefined;
	return decodeEvents(value) as Decoded<SaveMap[K]> | undefined;
};

const mergeProgress = (server: Progress, local: Progress): Progress => {
	const stars: Record<string, StarCount> = { ...server.stars };
	for (const [id, star] of Object.entries(local.stars)) stars[id] = Math.max(stars[id] ?? 0, star) as StarCount;
	return {
		...local, stars, vignettesSeen: uniqueStrings([...server.vignettesSeen, ...local.vignettesSeen]),
		hintsSeen: uniqueStrings([...server.hintsSeen, ...local.hintsSeen]), disclaimerSeen: server.disclaimerSeen || local.disclaimerSeen,
		// ⚠️版は「読んだ最大版」を採る。小さい方を採ると別端末で読み直しを強いる。
		disclaimerRev: Math.max(server.disclaimerRev, local.disclaimerRev),
		choices: { ...local.choices, ...server.choices }, // 物語の選択はサーバー側を優先する
		tools: {
			hasami: Math.max(server.tools.hasami, local.tools.hasami), tenaoshi: Math.max(server.tools.tenaoshi, local.tools.tenaoshi),
			uchimizu: Math.max(server.tools.uchimizu, local.tools.uchimizu),
		},
		toolsUnlocked: uniqueStrings([...server.toolsUnlocked, ...local.toolsUnlocked]),
		updatedAt: Math.max(server.updatedAt, local.updatedAt),
	};
};
const mergeDaily = (server: Daily, local: Daily): Daily => ({
	...local, lastPlayed: server.lastPlayed > local.lastPlayed ? server.lastPlayed : local.lastPlayed,
	streak: Math.max(server.streak, local.streak), best: Math.max(server.best, local.best), freezes: Math.max(server.freezes, local.freezes),
	freezeMonth: server.freezeMonth > local.freezeMonth ? server.freezeMonth : local.freezeMonth,
	plays: Math.max(server.plays, local.plays), longest: Math.max(server.longest, local.longest),
	updatedAt: Math.max(server.updatedAt, local.updatedAt),
});
const mergeEvents = (server: EventSave, local: EventSave): EventSave => {
	const byEvent: Record<string, EventProgress> = {};
	for (const eventId of new Set([...Object.keys(server.byEvent), ...Object.keys(local.byEvent)])) {
		const a = server.byEvent[eventId];
		const b = local.byEvent[eventId];
		if (!a) { if (b) byEvent[eventId] = b; continue; }
		if (!b) { byEvent[eventId] = a; continue; }
		const exchanged: Record<string, number> = { ...a.exchanged };
		for (const [itemId, count] of Object.entries(b.exchanged)) {
			exchanged[itemId] = Math.max(exchanged[itemId] ?? 0, count);
		}
		const completedAt = Math.max(a.completedAt ?? 0, b.completedAt ?? 0);
		byEvent[eventId] = {
			points: Math.max(a.points, b.points),
			exchanged,
			stagesCleared: uniqueStrings([...a.stagesCleared, ...b.stagesCleared]),
			storySeen: uniqueStrings([...a.storySeen, ...b.storySeen]),
			rallyContrib: Math.max(a.rallyContrib, b.rallyContrib),
			...(completedAt > 0 ? { completedAt } : {}),
		};
	}
	return {
		v: SAVE_VERSION,
		updatedAt: Math.max(server.updatedAt, local.updatedAt),
		byEvent,
		kazari: uniqueStrings([...server.kazari, ...local.kazari]),
	};
};
const merge = <K extends SaveKey>(key: K, server: SaveMap[K], local: SaveMap[K]): SaveMap[K] => {
	if (key === "progress") return mergeProgress(server as Progress, local as Progress) as SaveMap[K];
	if (key === "daily") return mergeDaily(server as Daily, local as Daily) as SaveMap[K];
	if (key === "settings") {
		return { ...(local as GameSettings), updatedAt: Math.max(updatedAtOf(server), updatedAtOf(local)) } as SaveMap[K];
	}
	return mergeEvents(server as EventSave, local as EventSave) as SaveMap[K];
};

const defaultCache: Cache = miLocalStorage;
const defaultApi: RegistryApi = (endpoint, data) =>
	misskeyApi(endpoint as never, data as never) as Promise<unknown>;

/**
 * レジストリへの保存をまとめる。端末キャッシュを先に書き、失敗時はpendingを保持して再送する。
 * インスタンスはページごとに1つだけ作り、`retryPending` を画面遷移・online時に呼ぶ。
 */
export class HanaawaseStorage {
	private data: SaveMap = emptySaveMap();
	private baseline: Partial<Record<SaveKey, number>> = {};
	private pending = new Map<SaveKey, SaveMap[SaveKey]>();
	private inFlight = new Map<SaveKey, Promise<SaveStatus>>();
	private failures = 0;
	private readOnly = false;
	private recoveryAvailable = false;

	public constructor(
		private readonly api: RegistryApi = defaultApi,
		private readonly cache: Cache = defaultCache,
		private readonly now: () => number = Date.now,
	) {}

	public snapshot(): SaveMap { return this.data; }
	public isReadOnly() { return this.readOnly; }
	public hasUnsyncedChanges() { return this.pending.size > 0; }
	public consecutiveFailures() { return this.failures; }
	public shouldShowWarning() { return this.failures >= 3; }

	private writeCache<K extends SaveKey>(key: K, value: SaveMap[K]) {
		this.cache.setItem(cacheKey(key), JSON.stringify(value));
	}
	private readCache<K extends SaveKey>(key: K): Decoded<SaveMap[K]> | undefined {
		const raw = this.cache.getItem(cacheKey(key));
		if (raw === null) return undefined;
		try {
			const decoded = decode(key, JSON.parse(raw));
			if (decoded) return decoded;
		} catch { /* 壊れたキャッシュは退避して初期値に戻す */ }
		this.cache.setItem(recoveryKey(key), raw);
		this.recoveryAvailable = true;
		return undefined;
	}

	public async load(): Promise<LoadResult> {
		for (const key of keys) {
			const cached = this.readCache(key);
			if (cached?.future) this.readOnly = true;
			if (cached && !cached.future) this.data = { ...this.data, [key]: cached.value };
			try {
				const remote = decode(key, await this.api("i/registry/get", { scope: HANA_AWASE_SCOPE, key }));
				if (!remote) continue;
				if (remote.future) { this.readOnly = true; continue; }
				const local = this.data[key] as SaveMap[typeof key];
				const resolved = remote.value.updatedAt >= updatedAtOf(local) ? remote.value : merge(key, remote.value, local);
				this.data = { ...this.data, [key]: resolved };
				this.baseline[key] = remote.value.updatedAt;
				this.writeCache(key, resolved);
			} catch {
				// オフラインではキャッシュ/既定のまま遊べる。次の保存時に再送する。
			}
		}
		return { data: this.data, readOnly: this.readOnly, recoveryAvailable: this.recoveryAvailable };
	}

	public async save<K extends SaveKey>(key: K, next: SaveMap[K]): Promise<SaveStatus> {
		if (this.readOnly) return "readonly";
		const value = { ...next, v: SAVE_VERSION, updatedAt: Math.max(this.now(), updatedAtOf(this.data[key]) + 1) } as SaveMap[K];
		this.data = { ...this.data, [key]: value };
		this.writeCache(key, value); // APIより先。通信断でも端末から失わない。
		this.pending.set(key, value);
		return this.flush(key);
	}

	public async retryPending(): Promise<SaveStatus[]> {
		return Promise.all([...this.pending.keys()].map((key) => this.flush(key)));
	}

	/** 二段階確認を終えたUIからだけ呼ぶ。端末キャッシュとレジストリを同時に消す。 */
	public async reset(): Promise<SaveStatus> {
		if (this.readOnly) return "readonly";
		try {
			await Promise.all(keys.map((key) => this.api("i/registry/remove", { scope: HANA_AWASE_SCOPE, key })));
			for (const key of keys) {
				this.cache.removeItem(cacheKey(key));
				this.cache.removeItem(recoveryKey(key));
			}
			this.data = emptySaveMap();
			this.baseline = {};
			this.pending.clear();
			this.failures = 0;
			this.recoveryAvailable = false;
			return "saved";
		} catch {
			this.failures++;
			return "queued";
		}
	}

	private async flush(key: SaveKey): Promise<SaveStatus> {
		const existing = this.inFlight.get(key);
		if (existing) {
			await existing;
			return this.pending.has(key) ? this.flush(key) : "saved";
		}
		const task = this.flushOne(key);
		this.inFlight.set(key, task);
		try {
			return await task;
		} finally {
			this.inFlight.delete(key);
		}
	}

	private async flushOne(key: SaveKey): Promise<SaveStatus> {
		const pending = this.pending.get(key);
		if (!pending) return "saved";
		if (this.readOnly) return "readonly";
		try {
			const remote = decode(key, await this.api("i/registry/get", { scope: HANA_AWASE_SCOPE, key }));
			if (remote?.future) { this.readOnly = true; return "readonly"; }
			let value = pending;
			if (remote && remote.value.updatedAt > (this.baseline[key] ?? 0)) value = merge(key, remote.value, pending);
			value = { ...value, updatedAt: Math.max(this.now(), updatedAtOf(value) + 1) } as SaveMap[typeof key];
			await this.api("i/registry/set", { scope: HANA_AWASE_SCOPE, key, value });
			if (this.pending.get(key) === pending) this.data = { ...this.data, [key]: value };
			this.baseline[key] = value.updatedAt;
			this.writeCache(key, value);
			if (this.pending.get(key) === pending) this.pending.delete(key);
			this.failures = 0;
			return "saved";
		} catch {
			this.failures++;
			return "queued";
		}
	}

	/** online復帰時に未送信を再送する。呼び出し元でunmount時に解除する。 */
	public retryWhenOnline(): () => void {
		const listener = () => { void this.retryPending(); };
		window.addEventListener("online", listener);
		return () => window.removeEventListener("online", listener);
	}
}
