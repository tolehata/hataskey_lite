import { describe, expect, test } from "vitest";
import { HanaawaseStorage, emptySaveMap } from "./storage.js";
import type { Cache, Progress, RegistryApi, SaveKey } from "./storage.js";

const memoryCache = (): Cache & { values: Map<string, string> } => {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => { values.set(key, value); },
		removeItem: (key) => { values.delete(key); },
	};
};
const apiWith = (records: Partial<Record<SaveKey, unknown>>, failures = 0) => {
	let remainingFailures = failures;
	const calls: Array<{ endpoint: string; key: SaveKey }> = [];
	const api: RegistryApi = async (endpoint, data) => {
		calls.push({ endpoint, key: data.key });
		if (endpoint === "i/registry/get") return records[data.key];
		if (remainingFailures-- > 0) throw new Error("offline");
		records[data.key] = data.value;
		return undefined;
	};
	return { api, calls, records };
};

describe("花常の進行保存", () => {
	test("vなしの旧データをv1として読み、既定値を補う", async () => {
		const remote = apiWith({ progress: { stars: { "m1-1": 2 } } });
		const storage = new HanaawaseStorage(remote.api, memoryCache(), () => 100);
		const loaded = await storage.load();
		expect(loaded.data.progress.v).toBe(1);
		expect(loaded.data.progress.stars["m1-1"]).toBe(2);
		expect(loaded.data.progress.tools.hasami).toBe(0);
	});

	test("未来バージョンは読み取り専用にして上書きしない", async () => {
		const remote = apiWith({ progress: { v: 2, updatedAt: 10 } });
		const storage = new HanaawaseStorage(remote.api, memoryCache(), () => 100);
		await storage.load();
		expect(storage.isReadOnly()).toBe(true);
		expect(await storage.save("progress", emptySaveMap().progress)).toBe("readonly");
		expect(remote.calls.filter((call) => call.endpoint === "i/registry/set")).toHaveLength(0);
	});

	test("通信失敗でも先にキャッシュへ保存し、後で再送する", async () => {
		const remote = apiWith({}, 1);
		const cache = memoryCache();
		const storage = new HanaawaseStorage(remote.api, cache, () => 100);
		await storage.load();
		const progress = { ...emptySaveMap().progress, stars: { "m1-1": 3 } as const };
		expect(await storage.save("progress", progress)).toBe("queued");
		expect(JSON.parse(cache.values.get("miux:hanaawase:progress") ?? "{}").stars["m1-1"]).toBe(3);
		expect(storage.hasUnsyncedChanges()).toBe(true);
		expect(await storage.retryPending()).toEqual(["saved"]);
		expect((remote.records.progress as { stars: Record<string, number> }).stars["m1-1"]).toBe(3);
	});

	test("通信中に重なった保存は最後の値を続けて送る", async () => {
		const records: Partial<Record<SaveKey, unknown>> = {};
		let releaseFirstSet: (() => void) | undefined;
		let setCount = 0;
		const api: RegistryApi = async (endpoint, data) => {
			if (endpoint === "i/registry/get") return records[data.key];
			if (endpoint === "i/registry/set") {
				setCount++;
				if (setCount === 1) await new Promise<void>((resolve) => { releaseFirstSet = resolve; });
				records[data.key] = data.value;
			}
			return undefined;
		};
		const storage = new HanaawaseStorage(api, memoryCache(), () => 100);
		const first = storage.save("progress", { ...emptySaveMap().progress, stars: { "m1-1": 1 } });
		await Promise.resolve();
		const second = storage.save("progress", { ...emptySaveMap().progress, stars: { "m1-1": 3 } });
		releaseFirstSet?.();
		await Promise.all([first, second]);
		expect((records.progress as { stars: Record<string, number> }).stars["m1-1"]).toBe(3);
		expect(setCount).toBe(2);
	});

	test("新しい別端末データとは進行を減らさずにマージする", async () => {
		const remote = apiWith({ progress: {
			v: 1, updatedAt: 200, stars: { "m1-1": 1, "m1-2": 3 }, vignettesSeen: ["a"], hintsSeen: [], disclaimerSeen: false,
			choices: { chapter: "A" }, tools: { hasami: 1, tenaoshi: 0, uchimizu: 0 }, toolsUnlocked: ["hasami"],
		} });
		const storage = new HanaawaseStorage(remote.api, memoryCache(), () => 300);
		await storage.load();
		remote.records.progress = {
			v: 1, updatedAt: 250, stars: { "m1-2": 3 }, vignettesSeen: ["a"], hintsSeen: [], disclaimerSeen: false,
			choices: { chapter: "A" }, tools: { hasami: 1, tenaoshi: 0, uchimizu: 0 }, toolsUnlocked: ["hasami"],
		};
		const local: Progress = { ...storage.snapshot().progress, stars: { "m1-1": 3 }, choices: { chapter: "B" }, tools: { hasami: 0, tenaoshi: 2, uchimizu: 0 } };
		await storage.save("progress", local);
		const saved = remote.records.progress as { stars: Record<string, number>; choices: Record<string, string>; tools: Record<string, number> };
		expect(saved.stars).toEqual({ "m1-1": 3, "m1-2": 3 });
		expect(saved.choices.chapter).toBe("A");
		expect(saved.tools.tenaoshi).toBe(2);
	});

	test("壊れたキャッシュは初期化前に復旧用キーへ退避する", async () => {
		const cache = memoryCache();
		cache.values.set("miux:hanaawase:settings", "not-json");
		const storage = new HanaawaseStorage(apiWith({}).api, cache);
		const loaded = await storage.load();
		expect(loaded.recoveryAvailable).toBe(true);
		expect(cache.values.get("miux:hanaawase:recovery:settings")).toBe("not-json");
	});

	test("イベント記録は累積値を減らさず、交換数と既読を和集合でマージする", async () => {
		const remote = apiWith({ events: {
			v: 1,
			updatedAt: 200,
			byEvent: {
				"ev-a": {
					points: 18,
					exchanged: { hasami: 1 },
					stagesCleared: ["s1"],
					storySeen: ["p1"],
					rallyContrib: 2,
				},
			},
			kazari: ["kazari-a"],
		} });
		const storage = new HanaawaseStorage(remote.api, memoryCache(), () => 300);
		await storage.load();
		remote.records.events = {
			v: 1,
			updatedAt: 250,
			byEvent: {
				"ev-a": {
					points: 20,
					exchanged: { hasami: 1 },
					stagesCleared: ["s1"],
					storySeen: ["p1"],
					rallyContrib: 2,
				},
			},
			kazari: ["kazari-a"],
		};
		const local = {
			...storage.snapshot().events,
			byEvent: {
				"ev-a": {
					points: 18,
					exchanged: { hasami: 2, tenaoshi: 1 },
					stagesCleared: ["s1", "s2"],
					storySeen: ["p1", "p2"],
					rallyContrib: 3,
					completedAt: 280,
				},
			},
			kazari: ["kazari-b"],
		};
		await storage.save("events", local);
		const saved = remote.records.events as ReturnType<HanaawaseStorage["snapshot"]>["events"];
		expect(saved.byEvent["ev-a"]?.points).toBe(20);
		expect(saved.byEvent["ev-a"]?.exchanged).toEqual({ hasami: 2, tenaoshi: 1 });
		expect(saved.byEvent["ev-a"]?.stagesCleared).toEqual(["s1", "s2"]);
		expect(saved.byEvent["ev-a"]?.storySeen).toEqual(["p1", "p2"]);
		expect(saved.byEvent["ev-a"]?.completedAt).toBe(280);
		expect(saved.kazari).toEqual(["kazari-a", "kazari-b"]);
	});

	test("リセットはレジストリと端末キャッシュを同時に消す", async () => {
		const remote = apiWith({ progress: emptySaveMap().progress });
		const cache = memoryCache();
		const storage = new HanaawaseStorage(remote.api, cache);
		await storage.save("progress", { ...emptySaveMap().progress, stars: { "m1-1": 3 } });
		expect(await storage.reset()).toBe("saved");
		expect(cache.values.has("miux:hanaawase:progress")).toBe(false);
		expect(remote.calls.filter((call) => call.endpoint === "i/registry/remove")).toHaveLength(4);
	});
});
