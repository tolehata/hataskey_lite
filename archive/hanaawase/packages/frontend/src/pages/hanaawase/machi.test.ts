import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng.js';
import {
	BURST_CHANCE,
	FEED_LIMIT,
	HEAD_PETAL_COUNT,
	HEART_BURST_MS,
	HEART_SPARK_COUNT,
	ICON_CHANGE_LINES,
	MACHI_FACE_COUNT,
	MACHI_FACE_IDS,
	MACHI_NOTE_COLORS,
	MACHI_SEASON,
	MACHI_SKY,
	MAX_REACTION_KINDS,
	MAX_WIP,
	REACTION_FADE_MS,
	REACTION_QUIET_MS,
	VISIBLE_BOOST,
	acceptQuest,
	badgeCount,
	buildOrder,
	buildRepostOrder,
	canGrowReaction,
	createMachiRng,
	estimateMachiAutoplayLoad,
	facePathOf,
	filterTab,
	growReaction,
	heartReplyDelay,
	inTab,
	initialFaces,
	machiSeason,
	machiSky,
	makeHeadPetals,
	makeHeartSparks,
	makeItem,
	makeNote,
	makePetals,
	makeQuestEntry,
	makeRepostSequence,
	markMissed,
	newEmojiChance,
	nextIconChangeDelay,
	nextPostDelay,
	nextQuestDelay,
	nextReactionDelay,
	nextRepostDelay,
	pickEmoji,
	pickHeartReply,
	pickIconChange,
	pickWeighted,
	reactionCap,
	reactionTotal,
	reactionWeight,
	relativeTime,
	resolveQuest,
	showDoneTab,
	tabCount,
	tabForEntry,
	toggleHeart,
	withdrawNote,
	wipCount,
} from './machi.js';
import type { MachiNote, QuestEntry } from './machi.js';
import {
	AMBIENT_EMOJI,
	HEART_EMOJI,
	HEART_REPLIES,
	MACHI_PERSONAS,
	MACHI_POSTS,
	MACHI_REPOST_SCENARIOS,
	MACHI_THREADS,
	MACHI_INFO_NOTE,
	TANOMIGOTO,
	personaOf,
} from './machi-lines.js';
import type { MachiPersonaId } from './machi-lines.js';

const rngOf = (seed: number) => mulberry32(seed);
const noteAt = (bornAt: number, id = 1): MachiNote => makeNote(id, 'wakana', 'てすと', bornAt);

describe('machi-lines のデータ健全性', () => {
	it('全投稿の投稿者が住民に実在する', () => {
		const ids = new Set(MACHI_PERSONAS.map((p) => p.id));
		for (const post of MACHI_POSTS) expect(ids.has(post.p)).toBe(true);
		for (const thread of MACHI_THREADS) {
			expect(ids.has(thread.root.p)).toBe(true);
			for (const reply of thread.replies) expect(ids.has(reply.p)).toBe(true);
		}
		for (const quest of TANOMIGOTO) expect(ids.has(quest.by)).toBe(true);
	});

	it('投稿取消→投稿しなおし→別NPC反応は250組を明示し、全住民が登場する', () => {
		expect(MACHI_REPOST_SCENARIOS).toHaveLength(250);
		const ids = new Set(MACHI_PERSONAS.map((persona) => persona.id));
		const authors = new Map<MachiPersonaId, number>();
		const lines: string[] = [];
		for (const scene of MACHI_REPOST_SCENARIOS) {
			expect(ids.has(scene.p)).toBe(true);
			expect(ids.has(scene.by)).toBe(true);
			expect(scene.by).not.toBe(scene.p);
			expect(scene.before.trim().length).toBeGreaterThan(0);
			expect(scene.after.trim().length).toBeGreaterThan(0);
			expect(scene.reply.trim().length).toBeGreaterThan(0);
			authors.set(scene.p, (authors.get(scene.p) ?? 0) + 1);
			lines.push(scene.before, scene.after, scene.reply);
		}
		expect(authors.size).toBe(MACHI_PERSONAS.length);
		for (const count of authors.values()) {
			expect(count).toBeGreaterThanOrEqual(7);
			expect(count).toBeLessThanOrEqual(8);
		}
		expect(lines).toHaveLength(750);
		expect(new Set(lines).size).toBe(lines.length);
	});

	it('追加文は話者の禁則と12月の種明かしを破らない', () => {
		const exclamationAllowed = new Set<MachiPersonaId>(['ren', 'yae', 'inukai', 'tatsumi', 'yuta', 'goro']);
		for (const scene of MACHI_REPOST_SCENARIOS) {
			for (const [speaker, line] of [[scene.p, scene.before], [scene.p, scene.after], [scene.by, scene.reply]] as const) {
				if (!exclamationAllowed.has(speaker)) expect(line).not.toContain('!');
				if (speaker === 'ren') expect(line).not.toContain('っす');
				for (const spoiler of ['常の常連', '古い鋏の持ち主', '帳面に漣']) expect(line).not.toContain(spoiler);
			}
		}
	});

	// ⚠️本数は追加で増える。固定しないが、⚠️idの一意と全フィールドの充足は崩さない。
	it('たのみごとはidが一意・4つの文がすべて埋まっている', () => {
		expect(TANOMIGOTO.length).toBeGreaterThanOrEqual(50);
		expect(new Set(TANOMIGOTO.map((q) => q.id)).size).toBe(TANOMIGOTO.length);
		for (const q of TANOMIGOTO) {
			for (const line of [q.ask, q.wip, q.done, q.fail, q.title, q.goal]) {
				expect(line.length).toBeGreaterThan(0);
			}
			expect(q.petal).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it('投稿本文が重複していない', () => {
		expect(new Set(MACHI_POSTS.map((p) => p.t)).size).toBe(MACHI_POSTS.length);
	});

	it('空リプは重複なし・注記は3行', () => {
		// ⚠️本数はバッチ追加で増えるので固定しない。重複0だけは崩さない。
		expect(HEART_REPLIES.length).toBeGreaterThanOrEqual(100);
		expect(new Set(HEART_REPLIES).size).toBe(HEART_REPLIES.length);
		expect(MACHI_INFO_NOTE.length).toBe(3);
	});

	it('会話の本文も重複していない（単独投稿とも重ならない）', () => {
		const lines = [
			...MACHI_POSTS.map((p) => p.t),
			...MACHI_THREADS.flatMap((t) => [t.root.t, ...t.replies.map((r) => r.t)]),
		];
		expect(new Set(lines).size).toBe(lines.length);
	});

	it('外国語（ハングル・キリル・不要なラテン文字）が混入していない', () => {
		const lines = [
			...MACHI_POSTS.map((p) => p.t),
			...MACHI_THREADS.flatMap((t) => [t.root.t, ...t.replies.map((r) => r.t)]),
			...HEART_REPLIES,
			...MACHI_REPOST_SCENARIOS.flatMap((scene) => [scene.before, scene.after, scene.reply]),
		];
		for (const line of lines) expect(line).not.toMatch(/[가-힣Ѐ-ӿA-Za-z]/);
	});

	it('personaOf は未知のidでも落ちない', () => {
		expect(personaOf('wakana').name).toBe('三隅若菜');
		expect(personaOf('nobody').handle).toBe('unknown');
	});
});

describe('流速（⚠️固定しない）', () => {
	it('ふだんは3〜10秒、バーストは0.8〜1.9秒', () => {
		let burst = 0;
		for (let seed = 1; seed <= 4000; seed++) {
			const delay = nextPostDelay(rngOf(seed));
			if (delay < 2000) {
				burst++;
				expect(delay).toBeGreaterThanOrEqual(800);
				expect(delay).toBeLessThan(1900);
			} else {
				expect(delay).toBeGreaterThanOrEqual(3000);
				expect(delay).toBeLessThan(10000);
			}
		}
		// 16%前後に収まる（一定間隔にならない）
		expect(burst / 4000).toBeGreaterThan(BURST_CHANCE - 0.05);
		expect(burst / 4000).toBeLessThan(BURST_CHANCE + 0.05);
	});

	it('たのみごとは低頻度（45〜90秒）／空リプは2.2〜7.4秒', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const q = nextQuestDelay(rngOf(seed));
			expect(q).toBeGreaterThanOrEqual(45000);
			expect(q).toBeLessThan(90000);
			const h = heartReplyDelay(rngOf(seed));
			expect(h).toBeGreaterThanOrEqual(2200);
			expect(h).toBeLessThan(7400);
			const r = nextReactionDelay(rngOf(seed));
			expect(r).toBeGreaterThanOrEqual(500);
			expect(r).toBeLessThan(2900);
		}
	});

	it('同じseedなら同じ値（Math.randomを使っていない）', () => {
		expect(nextPostDelay(rngOf(99))).toBe(nextPostDelay(rngOf(99)));
		expect(createMachiRng(7)()).toBe(createMachiRng(7)());
	});
});

describe('リアクションが時間で育つ', () => {
	it('投稿から3.5秒間は誰も押さない', () => {
		expect(reactionWeight(0)).toBe(0);
		expect(reactionWeight(REACTION_QUIET_MS)).toBe(0);
		expect(reactionWeight(REACTION_QUIET_MS + 1)).toBeGreaterThan(0);
	});

	it('14秒かけて盛り上がり、以降ゆるやかに減衰する', () => {
		const peak = reactionWeight(REACTION_QUIET_MS + 14000);
		expect(reactionWeight(REACTION_QUIET_MS + 4000)).toBeLessThan(peak);
		expect(reactionWeight(REACTION_QUIET_MS + 30000)).toBeLessThan(peak);
		expect(reactionWeight(REACTION_QUIET_MS + 60000)).toBeLessThan(reactionWeight(REACTION_QUIET_MS + 30000));
		expect(reactionWeight(REACTION_QUIET_MS + 60000)).toBeGreaterThan(0);
	});

	it('新着はリアクション0から始まる', () => {
		const item = makeItem({ kind: 'post', index: 0 }, 1000, (() => { let n = 0; return () => n++; })());
		for (const note of item.kind === 'notes' ? item.notes : []) {
			expect(note.reactions.length).toBe(0);
			expect(note.hearted).toBe(false);
		}
	});

	it('誰も反応しない時間帯は null（時間が経つと押される）', () => {
		const now = 100000;
		const fresh = noteAt(now - 1000);
		expect(growReaction([{ note: fresh, visible: true }], now, rngOf(3))).toBeNull();
		const ripe = noteAt(now - 12000);
		const hit = growReaction([{ note: ripe, visible: true }], now, rngOf(3));
		expect(hit?.note).toBe(ripe);
		expect(ripe.reactions.length).toBe(1);
		expect(ripe.reactions[0]!.count).toBe(1);
		expect(hit?.emoji).toBe(ripe.reactions[0]!.emoji);
	});

	it('画面内の投稿は1.6倍押されやすい', () => {
		const now = 100000;
		let visibleWins = 0;
		for (let seed = 1; seed <= 600; seed++) {
			const seen = noteAt(now - 12000, 1);
			const unseen = noteAt(now - 12000, 2);
			const picked = growReaction([{ note: seen, visible: true }, { note: unseen, visible: false }], now, rngOf(seed));
			if (picked?.note === seen) visibleWins++;
		}
		const ratio = visibleWins / 600;
		// 1.6 : 1 → 約0.615
		expect(ratio).toBeGreaterThan(0.55);
		expect(ratio).toBeLessThan(0.68);
	});

	it('種類は最大8種まで／少ないうちほど新しい絵文字が付きやすい', () => {
		expect(newEmojiChance(0)).toBeGreaterThan(newEmojiChance(3));
		expect(newEmojiChance(3)).toBeGreaterThan(newEmojiChance(5));
		const now = 100000;
		const note = noteAt(now - 20000);
		note.cap = 999; // ⚠️種類の上限を見たいので、総数の上限は外しておく
		for (let i = 0; i < 400; i++) {
			growReaction([{ note, visible: true }], now, rngOf(i + 1));
		}
		expect(note.reactions.length).toBeGreaterThan(1);
		expect(note.reactions.length).toBeLessThanOrEqual(MAX_REACTION_KINDS);
	});

	it('⚠️放置してもリアクションは無限に増えない（投稿ごとの上限で止まる）', () => {
		const now = 100000;
		const note = noteAt(now - 20000);
		for (let i = 0; i < 2000; i++) growReaction([{ note, visible: true }], now, rngOf(i + 1));
		expect(reactionTotal(note)).toBe(note.cap);
		expect(canGrowReaction(note, now)).toBe(false);
		// さらに呼んでも増えない
		expect(growReaction([{ note, visible: true }], now, rngOf(7))).toBeNull();
		expect(reactionTotal(note)).toBe(note.cap);
	});

	it('⚠️上限は投稿ごとにばらつく（同じ値ばかりにならない）', () => {
		const caps = new Set<number>();
		for (let id = 1; id <= 200; id++) caps.add(reactionCap(id));
		expect(caps.size).toBeGreaterThan(8);
		for (const c of caps) {
			expect(c).toBeGreaterThanOrEqual(2);
			expect(c).toBeLessThanOrEqual(27);
		}
	});

	it('⚠️古い投稿は重みが0になり、候補から完全に外れる', () => {
		expect(reactionWeight(REACTION_FADE_MS)).toBe(0);
		expect(reactionWeight(REACTION_FADE_MS + 60000)).toBe(0);
		expect(reactionWeight(REACTION_FADE_MS - 1000)).toBeGreaterThan(0);
		const now = 1000000;
		const old = noteAt(now - REACTION_FADE_MS - 1);
		expect(canGrowReaction(old, now)).toBe(false);
		expect(growReaction([{ note: old, visible: true }], now, rngOf(3))).toBeNull();
	});

	it('投稿自身の絵文字のあたりが優先され、同じ絵文字は重複しない', () => {
		const note = makeNote(1, 'wakana', 'てすと', 0, { emojiHints: ['🌼', '🌱'] });
		const seen = new Set<string>();
		for (let seed = 1; seed <= 60; seed++) seen.add(pickEmoji(note, rngOf(seed)));
		expect(seen.has('🌼') || seen.has('🌱')).toBe(true);
		note.reactions = [{ emoji: '🌼', count: 1, mine: false }, { emoji: '🌱', count: 1, mine: false }];
		for (let seed = 1; seed <= 60; seed++) {
			expect(AMBIENT_EMOJI).toContain(pickEmoji(note, rngOf(seed)));
		}
	});

	it('VISIBLE_BOOST と FEED_LIMIT の定数が想定どおり', () => {
		expect(VISIBLE_BOOST).toBe(1.6);
		expect(FEED_LIMIT).toBeGreaterThan(20);
	});
});

describe('♡を自分で押す', () => {
	it('押す→取り消すで元に戻る', () => {
		const note = noteAt(0);
		expect(toggleHeart(note)).toBe(true);
		expect(note.hearted).toBe(true);
		expect(note.reactions).toEqual([{ emoji: HEART_EMOJI, count: 1, mine: true }]);
		expect(toggleHeart(note)).toBe(false);
		expect(note.hearted).toBe(false);
		expect(note.reactions.length).toBe(0);
	});

	it('既に他人の♡があるときは数だけ増減する', () => {
		const note = noteAt(0);
		note.reactions = [{ emoji: HEART_EMOJI, count: 4, mine: false }];
		toggleHeart(note);
		expect(note.reactions[0]).toEqual({ emoji: HEART_EMOJI, count: 5, mine: true });
		toggleHeart(note);
		expect(note.reactions[0]).toEqual({ emoji: HEART_EMOJI, count: 4, mine: false });
	});

	it('空リプは一覧から選ばれ、返信ではない独立した文', () => {
		const line = pickHeartReply(rngOf(5));
		expect(HEART_REPLIES).toContain(line);
		// ⚠️宛先（@やさん付けの呼びかけ）を含まない＝ひとりごとの温度
		for (const l of HEART_REPLIES) expect(l).not.toContain('@');
	});
});

describe('会話（返信）の組み立て', () => {
	// ⚠️インデックス固定にしない（バッチ追加で並びが動くため）。中身の条件で拾う。
	const indexOfThreadWith = (replies: (n: number) => boolean) => {
		const index = MACHI_THREADS.findIndex((t) => replies(t.replies.length));
		expect(index).toBeGreaterThanOrEqual(0);
		return index;
	};

	it('親に hasReplies、最後以外の返信に cont が立つ', () => {
		let id = 0;
		const index = indexOfThreadWith((n) => n >= 2); // 返信2件以上＝途中で線が続くもの
		const item = makeItem({ kind: 'thread', index }, 0, () => id++);
		expect(item.kind).toBe('notes');
		const notes = item.kind === 'notes' ? item.notes : [];
		expect(notes.length).toBe(1 + MACHI_THREADS[index]!.replies.length);
		expect(notes[0]!.hasReplies).toBe(true);
		expect(notes[0]!.reply).toBe(false);
		expect(notes[1]!.reply).toBe(true);
		expect(notes[1]!.cont).toBe(true); // 次の返信へ線を継続
		expect(notes[notes.length - 1]!.cont).toBe(false); // ⚠️まとまりの最後にだけ境界線
	});

	it('返信が1件のスレッドでは cont が立たない', () => {
		let id = 0;
		const index = indexOfThreadWith((n) => n === 1);
		const item = makeItem({ kind: 'thread', index }, 0, () => id++);
		const notes = item.kind === 'notes' ? item.notes : [];
		expect(notes.length).toBe(2);
		expect(notes[1]!.cont).toBe(false);
	});

	it('buildOrder は投稿と会話を全部含み、seedで再現できる', () => {
		const a = buildOrder(rngOf(42));
		const b = buildOrder(rngOf(42));
		expect(a).toEqual(b);
		expect(a.length).toBe(MACHI_POSTS.length + MACHI_THREADS.length);
		expect(a.filter((s) => s.kind === 'thread').length).toBe(MACHI_THREADS.length);
		expect(buildOrder(rngOf(43))).not.toEqual(a);
	});

	it('取消シーンは取消前1本と、本人の投稿しなおし＋別NPC反応に組み立てる', () => {
		let id = 100;
		const scene = MACHI_REPOST_SCENARIOS[0]!;
		const sequence = makeRepostSequence(0, 1000, () => id++);
		expect(sequence.original.kind).toBe('notes');
		expect(sequence.followup.kind).toBe('notes');
		const original = sequence.original.kind === 'notes' ? sequence.original.notes[0]! : undefined;
		const followup = sequence.followup.kind === 'notes' ? sequence.followup.notes : [];
		expect(original?.personaId).toBe(scene.p);
		expect(original?.text).toBe(scene.before);
		expect(original?.withdrawn).toBe(false);
		expect(followup[0]?.personaId).toBe(scene.p);
		expect(followup[0]?.text).toBe(scene.after);
		expect(followup[0]?.reposted).toBe(true);
		expect(followup[0]?.hasReplies).toBe(true);
		expect(followup[1]?.personaId).toBe(scene.by);
		expect(followup[1]?.text).toBe(scene.reply);
		expect(followup[1]?.reply).toBe(true);
	});

	it('取消済み投稿はリアクションを畳み、それ以上育たない', () => {
		const note = makeNote(9, 'wakana', '取消前', 0);
		note.reactions.push({ emoji: '🌼', count: 3, mine: false });
		toggleHeart(note);
		withdrawNote(note);
		expect(note.withdrawn).toBe(true);
		expect(note.hearted).toBe(false);
		expect(note.reactions).toEqual([]);
		expect(canGrowReaction(note, 20000)).toBe(false);
		expect(toggleHeart(note)).toBe(false);
	});

	it('取消パターンはseed固定の一巡順で250組すべてに到達する', () => {
		const a = buildRepostOrder(rngOf(77));
		const b = buildRepostOrder(rngOf(77));
		expect(a).toEqual(b);
		expect(a).toHaveLength(250);
		expect(new Set(a).size).toBe(250);
		expect(Math.min(...a)).toBe(0);
		expect(Math.max(...a)).toBe(249);
		expect(buildRepostOrder(rngOf(78))).not.toEqual(a);
	});
});

describe('自動再生の負荷契約', () => {
	it('通信API検出器の陽性対照が発火し、自動再生ソースには通信・永続化呼び出しが無い', () => {
		const detector = /(?:\bfetch\s*\(|\bmisskeyApi\s*\(|\bos\.api\s*\(|\bi\/registry\b|\blocalStorage\b|\bmiLocalStorage\b)/;
		// ⚠️陽性対照。これが落ちるなら「0件」の検査自体が壊れている。
		expect(detector.test("misskeyApi('i/registry/set')")).toBe(true);
		const root = join(process.cwd(), 'src/pages/hanaawase');
		const source = [
			readFileSync(join(root, 'MachiFeed.vue'), 'utf8'),
			readFileSync(join(root, 'machi.ts'), 'utf8'),
		].join('\n');
		expect(detector.test(source)).toBe(false);
	});

	it('平均負荷はサーバー要求・永続書込0、ブラウザ内タイマー活発時約88.1回/分', () => {
		const load = estimateMachiAutoplayLoad();
		expect(load.serverRequestsPerMinute).toBe(0);
		expect(load.persistentWritesPerMinute).toBe(0);
		expect(load.postInsertionsPerMinute).toBeCloseTo(10.571, 3);
		expect(load.activeReactionChecksPerMinute).toBeCloseTo(35.294, 3);
		expect(load.reactionPopCleanupWakeupsPerMinute).toBeCloseTo(35.294, 3);
		expect(load.idleReactionChecksPerMinute).toBe(10);
		expect(load.repostSequenceWakeupsPerMinute).toBeCloseTo(2.25, 3);
		expect(load.totalActiveTimerWakeupsPerMinute).toBeCloseTo(88.098, 3);
		expect(load.totalIdleTimerWakeupsPerMinute).toBeCloseTo(27.51, 3);
	});

	it('取消シーンの開始間隔は55〜105秒の範囲に収まる', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const delay = nextRepostDelay(rngOf(seed));
			expect(delay).toBeGreaterThanOrEqual(55000);
			expect(delay).toBeLessThan(105000);
		}
	});
});

describe('時刻表示', () => {
	it('経過で切り替わる', () => {
		expect(relativeTime(0)).toBe('たった今');
		expect(relativeTime(44000)).toBe('たった今');
		expect(relativeTime(60000)).toBe('1分前');
		expect(relativeTime(5 * 60000)).toBe('5分前');
		expect(relativeTime(2 * 3600000)).toBe('2時間前');
		expect(relativeTime(3 * 86400000)).toBe('3日前');
	});
});

describe('たのみごとの台帳', () => {
	const makeLog = (count: number): QuestEntry[] => {
		const rng = rngOf(11);
		return Array.from({ length: count }, (_, i) => makeQuestEntry(i, i, rng));
	};

	it('生成された依頼は未受注・期限つき・花びら5枚', () => {
		const entry = makeQuestEntry(0, 0, rngOf(1));
		expect(entry.state).toBe('open');
		expect(entry.limitDays).toBeGreaterThanOrEqual(2);
		expect(entry.limitDays).toBeLessThanOrEqual(5);
		expect(entry.petals.length).toBe(5);
		for (const p of entry.petals) {
			expect(p.left).toBeGreaterThanOrEqual(0);
			expect(p.left).toBeLessThan(100);
			expect(p.dur).toBeGreaterThanOrEqual(8.5); // ⚠️ゆっくり落ちる
			expect(p.dur).toBeLessThanOrEqual(13);
		}
		expect(makePetals(rngOf(2), 5).length).toBe(5);
	});

	it('同時受注は5件まで', () => {
		const log = makeLog(8);
		for (let i = 0; i < MAX_WIP; i++) expect(acceptQuest(log, i)).toBe('accepted');
		expect(wipCount(log)).toBe(MAX_WIP);
		expect(acceptQuest(log, MAX_WIP)).toBe('full');
		expect(log[MAX_WIP]!.state).toBe('open');
		// 1件片付ければまた受けられる
		resolveQuest(log, 0, 'done');
		expect(acceptQuest(log, MAX_WIP)).toBe('accepted');
	});

	it('二重受注・存在しないidは invalid', () => {
		const log = makeLog(2);
		expect(acceptQuest(log, 0)).toBe('accepted');
		expect(acceptQuest(log, 0)).toBe('invalid');
		expect(acceptQuest(log, 99)).toBe('invalid');
	});

	it('成否はシステム判定：wip のときだけ解決できる', () => {
		const log = makeLog(2);
		expect(resolveQuest(log, 0, 'done')).toBe(false); // 未受注は解決できない
		acceptQuest(log, 0);
		expect(resolveQuest(log, 0, 'done')).toBe(true);
		expect(resolveQuest(log, 0, 'fail')).toBe(false); // 二度は解決しない
		expect(log[0]!.state).toBe('done');
	});

	it('流れ去った未受注は見逃しになり、受け直せる', () => {
		const log = makeLog(2);
		expect(markMissed(log, 0)).toBe(true);
		expect(log[0]!.state).toBe('miss');
		expect(markMissed(log, 0)).toBe(false);
		expect(acceptQuest(log, 0)).toBe('accepted');
	});

	it('見逃しは進行中と未受注の両方に出る（救済）', () => {
		const log = makeLog(1);
		markMissed(log, 0);
		expect(inTab(log[0]!, 'active')).toBe(true);
		expect(inTab(log[0]!, 'open')).toBe(true);
		expect(inTab(log[0]!, 'done')).toBe(false);
	});

	it('「完了・失敗」タブは該当が出てから表示', () => {
		const log = makeLog(2);
		expect(showDoneTab(log)).toBe(false);
		acceptQuest(log, 0);
		expect(showDoneTab(log)).toBe(false);
		resolveQuest(log, 0, 'fail');
		expect(showDoneTab(log)).toBe(true);
		expect(tabCount(log, 'done')).toBe(1);
	});

	it('バッジは引受中＋見逃しだけ数える', () => {
		const log = makeLog(4);
		expect(badgeCount(log)).toBe(0); // 未受注は数えない
		acceptQuest(log, 0);
		markMissed(log, 1);
		expect(badgeCount(log)).toBe(2);
		resolveQuest(log, 0, 'done');
		expect(badgeCount(log)).toBe(1);
	});

	it('タブの絞り込みと、カードをタップしたときの遷移先', () => {
		const log = makeLog(3);
		acceptQuest(log, 0);
		resolveQuest(log, 0, 'done');
		acceptQuest(log, 1);
		expect(filterTab(log, 'active').map((e) => e.qi)).toEqual([1]);
		expect(filterTab(log, 'open').map((e) => e.qi)).toEqual([2]);
		expect(filterTab(log, 'done').map((e) => e.qi)).toEqual([0]);
		expect(tabForEntry(log[0])).toBe('done');
		expect(tabForEntry(log[1])).toBe('active');
		expect(tabForEntry(log[2])).toBe('open');
		expect(tabForEntry(undefined)).toBe('active');
	});
});

describe('季節と空（表題の花びら／TLの背景）', () => {
	type Rgb = readonly [number, number, number];
	type Rgba = readonly [number, number, number, number];

	const cssColor = (value: string): Rgba => {
		const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
		if (hex) return [Number.parseInt(hex[1] ?? '', 16), Number.parseInt(hex[2] ?? '', 16), Number.parseInt(hex[3] ?? '', 16), 1];
		const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*(\d+(?:\.\d+)?)%\s*\)$/.exec(value);
		if (!rgb) throw new Error(`CSS色を解析できません: ${value}`);
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4]) / 100];
	};
	const composite = (bottom: Rgb, top: Rgba): Rgb => [
		top[0] * top[3] + bottom[0] * (1 - top[3]),
		top[1] * top[3] + bottom[1] * (1 - top[3]),
		top[2] * top[3] + bottom[2] * (1 - top[3]),
	];
	const luminance = (color: Rgb): number => {
		const linear = color.map((channel) => {
			const value = channel / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
	};
	const contrast = (foreground: Rgb, background: Rgb): number => {
		const a = luminance(foreground);
		const b = luminance(background);
		return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	};

	/** JSTの時刻ちょうどを指す Date（⚠️端末のタイムゾーンに依存しないよう UTC で組む）。 */
	const atJst = (hour: number) => new Date(Date.UTC(2026, 6, 25, (hour + 15) % 24, 0));

	it('季節はJSTの月で決まる（月替わりの境目もJST）', () => {
		expect(machiSeason(new Date(Date.UTC(2026, 1, 28, 14, 59)))).toBe('winter'); // JST 2/28 23:59
		expect(machiSeason(new Date(Date.UTC(2026, 1, 28, 15, 0)))).toBe('spring'); // JST 3/1 00:00
		expect(machiSeason(new Date(Date.UTC(2026, 6, 1, 0, 0)))).toBe('summer');
		expect(machiSeason(new Date(Date.UTC(2026, 9, 1, 0, 0)))).toBe('autumn');
		expect(machiSeason(new Date(Date.UTC(2026, 11, 1, 0, 0)))).toBe('winter');
	});

	it('空はJSTの時刻で6段階に切り替わる', () => {
		expect(machiSky(atJst(3))).toBe('night');
		expect(machiSky(atJst(4))).toBe('dawn');
		expect(machiSky(atJst(5))).toBe('dawn');
		expect(machiSky(atJst(6))).toBe('morning');
		expect(machiSky(atJst(9))).toBe('morning');
		expect(machiSky(atJst(10))).toBe('day');
		expect(machiSky(atJst(14))).toBe('day');
		expect(machiSky(atJst(15))).toBe('evening');
		expect(machiSky(atJst(17))).toBe('evening');
		expect(machiSky(atJst(18))).toBe('dusk');
		expect(machiSky(atJst(19))).toBe('dusk');
		expect(machiSky(atJst(20))).toBe('night');
		expect(machiSky(atJst(0))).toBe('night');
	});

	it('⚠️空の濃さは30%以下（濃くすると本文が読めなくなる＝害のある演出）', () => {
		const alphas: number[] = [];
		for (const spec of Object.values(MACHI_SKY)) {
			expect(spec.label.length).toBeGreaterThan(0);
			for (const color of [spec.top, spec.bottom, spec.glow]) {
				const m = /\/\s*(\d+(?:\.\d+)?)%\s*\)/.exec(color);
				expect(m).not.toBeNull();
				alphas.push(Number(m![1]));
			}
		}
		expect(alphas.length).toBe(18);
		for (const a of alphas) expect(a).toBeLessThanOrEqual(30);
	});

	it('⚠️6段階の空×4季で、本文・名前・handle・時刻・返信行がすべて4.5:1以上', () => {
		const base: Rgb = [43, 38, 32];
		const noteBackground = cssColor(MACHI_NOTE_COLORS.background);
		const roles = {
			body: cssColor(MACHI_NOTE_COLORS.ink),
			name: cssColor(MACHI_NOTE_COLORS.ink),
			handle: cssColor(MACHI_NOTE_COLORS.supporting),
			time: cssColor(MACHI_NOTE_COLORS.supporting),
			actions: cssColor(MACHI_NOTE_COLORS.supporting),
		};
		const measurements: { label: string; ratio: number }[] = [];

		for (const [skyId, skySpec] of Object.entries(MACHI_SKY)) {
			for (const [seasonId, seasonSpec] of Object.entries(MACHI_SEASON)) {
				// top/bottomの両端を測る。glowは最大濃度を同時に重ねるため、実表示より厳しい側の測定。
				const surfaces = [skySpec.top, skySpec.bottom].map((edge) => {
					let surface = composite(base, cssColor(seasonSpec.tint));
					surface = composite(surface, cssColor(edge));
					surface = composite(surface, cssColor(skySpec.glow));
					return composite(surface, noteBackground);
				});
				for (const [role, color] of Object.entries(roles)) {
					const foreground: Rgb = [color[0], color[1], color[2]];
					const ratio = Math.min(...surfaces.map((surface) => contrast(foreground, surface)));
					measurements.push({ label: `${skyId}/${seasonId}/${role}`, ratio });
				}
			}
		}

		expect(measurements).toHaveLength(6 * 4 * 5);
		for (const result of measurements) expect(result.ratio, result.label).toBeGreaterThanOrEqual(4.5);
	});

	it('⚠️表題の花びらの濃さは0.5以下（表題が読めなくなるのを防ぐ）', () => {
		for (const spec of Object.values(MACHI_SEASON)) {
			expect(spec.colors.length).toBeGreaterThanOrEqual(3);
			for (const c of spec.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
			expect(spec.peak).toBeGreaterThan(0);
			expect(spec.peak).toBeLessThanOrEqual(0.5);
		}
	});

	it('表題の花びらは7枚・枠内・遅延は負（開いた瞬間に一斉に降り出さない）', () => {
		const petals = makeHeadPetals(rngOf(9));
		expect(petals.length).toBe(HEAD_PETAL_COUNT);
		for (const p of petals) {
			expect(p.left).toBeGreaterThanOrEqual(0);
			expect(p.left).toBeLessThan(100);
			expect(p.size).toBeGreaterThan(0);
			expect(p.dur).toBeGreaterThanOrEqual(9);
			expect(p.dur).toBeLessThanOrEqual(16);
			expect(p.delay).toBeLessThanOrEqual(0); // ⚠️負＝途中の状態から見える
			expect(Math.abs(p.drift)).toBeGreaterThanOrEqual(14);
			expect(p.tone).toBeGreaterThanOrEqual(0);
			expect(p.tone).toBeLessThan(3);
		}
		// ⚠️同じseedなら同じ（Math.randomを使っていない）
		expect(makeHeadPetals(rngOf(9))).toEqual(petals);
	});
});

describe('住民のアイコンが変わる', () => {
	// ⚠️実ファイル準拠。assets/hanaawase/chara/<id>/face_N.webp の実枚数と一致していること。
	const REAL_COUNTS: Record<string, number> = { wakana: 21, ren: 21, yae: 4, inukai: 4, naito: 3, tatsumi: 3, gen: 3 };

	// ⚠️これは「表」と「テスト内の写し」の突き合わせであって、ディスクは見ていない。
	//   実ファイルとの一致は下の「⚠️アイコンの表とディスクの一致」が担当する。
	it('⚠️枚数表がうっかり書き換わっていない／住民として実在する', () => {
		expect({ ...MACHI_FACE_COUNT }).toEqual(REAL_COUNTS);
		const ids = new Set(MACHI_PERSONAS.map((p) => p.id));
		for (const id of MACHI_FACE_IDS) {
			expect(ids.has(id)).toBe(true);
			expect(personaOf(id).tachie).toBe(true); // 立ち絵を持つ住民だけ
		}
	});

	it('⚠️範囲外・未登録は null を返す（404になるパスを組み立てない）', () => {
		expect(facePathOf('wakana', 1)).toBe('/client-assets/hanaawase/chara/wakana/face_1.webp');
		expect(facePathOf('wakana', 21)).toBe('/client-assets/hanaawase/chara/wakana/face_21.webp');
		expect(facePathOf('wakana', 22)).toBeNull();
		expect(facePathOf('naito', 4)).toBeNull(); // naito は3枚
		expect(facePathOf('gen', 3)).toBe('/client-assets/hanaawase/chara/gen/face_3.webp');
		expect(facePathOf('gen', 0)).toBeNull();
		expect(facePathOf('gen', -1)).toBeNull();
		expect(facePathOf('gen', 1.5)).toBeNull();
		expect(facePathOf('saeko', 1)).toBeNull(); // 立ち絵を持たない住民
		expect(facePathOf('nobody', 1)).toBeNull();
	});

	it('最初のアイコンは全員が範囲内・毎回同じ', () => {
		const faces = initialFaces();
		expect(faces.size).toBe(MACHI_FACE_IDS.length);
		for (const [id, n] of faces) {
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(REAL_COUNTS[id]!);
			expect(facePathOf(id, n)).not.toBeNull();
		}
		expect([...initialFaces()]).toEqual([...faces]);
	});

	it('⚠️変更後の番号は必ず範囲内で、いまと違う（変えたのに変わらない事故を防ぐ）', () => {
		const faces = initialFaces();
		for (let seed = 1; seed <= 600; seed++) {
			const change = pickIconChange(faces, rngOf(seed));
			expect(change).not.toBeNull();
			const count = REAL_COUNTS[change!.personaId]!;
			expect(count).toBeGreaterThanOrEqual(2);
			expect(change!.face).toBeGreaterThanOrEqual(1);
			expect(change!.face).toBeLessThanOrEqual(count);
			expect(change!.face).not.toBe(faces.get(change!.personaId));
			expect(facePathOf(change!.personaId, change!.face)).not.toBeNull();
			expect(ICON_CHANGE_LINES).toContain(change!.text);
		}
	});

	it('現在の番号が未設定でも範囲内に収まる', () => {
		const empty = new Map<MachiPersonaId, number>();
		for (let seed = 1; seed <= 200; seed++) {
			const change = pickIconChange(empty, rngOf(seed))!;
			expect(change.face).toBeGreaterThanOrEqual(1);
			expect(change.face).toBeLessThanOrEqual(REAL_COUNTS[change.personaId]!);
		}
	});

	it('アイコン変更の文面は重複なし・宛先なし・外国語なし', () => {
		expect(ICON_CHANGE_LINES.length).toBeGreaterThanOrEqual(12);
		expect(new Set(ICON_CHANGE_LINES).size).toBe(ICON_CHANGE_LINES.length);
		for (const line of ICON_CHANGE_LINES) {
			expect(line).not.toContain('@');
			expect(line).not.toMatch(/[가-힣Ѐ-ӿA-Za-z]/);
			// ⚠️「アイコンを変えた」と伝わる文であること（言い回しは統一しない）
			expect(line).toMatch(/アイコン|写真|顔/);
		}
	});

	it('アイコン変更は低頻度（90〜210秒）', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const d = nextIconChangeDelay(rngOf(seed));
			expect(d).toBeGreaterThanOrEqual(90000);
			expect(d).toBeLessThan(210000);
		}
	});
});

describe('♡の手応え', () => {
	it('7枚・必ず上向きの扇・同じseedなら同じ', () => {
		const sparks = makeHeartSparks(rngOf(4));
		expect(sparks.length).toBe(HEART_SPARK_COUNT);
		for (const s of sparks) {
			expect(s.dy).toBeLessThanOrEqual(0); // ⚠️真下に飛ばすと押した指の下で潰れる
			expect(s.size).toBeGreaterThan(0);
			expect(s.tone).toBeGreaterThanOrEqual(0);
			expect(s.tone).toBeLessThan(3);
		}
		expect(makeHeartSparks(rngOf(4))).toEqual(sparks);
	});

	it('⚠️どの粒も HEART_BURST_MS 内に消え切る（残骸が溜まらない）', () => {
		for (let seed = 1; seed <= 400; seed++) {
			for (const s of makeHeartSparks(rngOf(seed))) {
				expect(s.delay).toBeGreaterThanOrEqual(0);
				expect(s.delay + s.dur).toBeLessThanOrEqual(HEART_BURST_MS);
			}
		}
	});

	it('♡への反応は空リプのまま。warm は表示の印にすぎない', () => {
		const plain = makeNote(1, 'wakana', 'てすと', 0);
		expect(plain.warm).toBe(false);
		expect(plain.reply).toBe(false);
		const warm = makeNote(2, 'wakana', pickHeartReply(rngOf(5)), 0, { warm: true });
		expect(warm.warm).toBe(true);
		// ⚠️空リプ＝返信ではない独立した投稿。warm を付けても返信にはしない
		expect(warm.reply).toBe(false);
		expect(warm.hasReplies).toBe(false);
		expect(warm.text).not.toContain('@');
	});
});

describe('pickWeighted', () => {
	it('重み0だけなら null', () => {
		expect(pickWeighted([{ item: 'a', weight: 0 }], rngOf(1))).toBeNull();
		expect(pickWeighted([], rngOf(1))).toBeNull();
	});
	it('重みの比に従う', () => {
		let a = 0;
		for (let seed = 1; seed <= 800; seed++) {
			if (pickWeighted([{ item: 'a', weight: 3 }, { item: 'b', weight: 1 }], rngOf(seed)) === 'a') a++;
		}
		expect(a / 800).toBeGreaterThan(0.68);
		expect(a / 800).toBeLessThan(0.82);
	});
});

/**
 * ⚠️MACHI_FACE_COUNT は手書きの表なので、絵を増減させるとディスクとずれる。
 * ずれたまま気づかないと 404（増やした側は使われない／減らした側は壊れた画像）になるため、
 * ⚠️実ファイルと突き合わせてここで落とす。自動列挙は vite.config.ts を触るため採れない（パージ容易性）。
 */
describe('⚠️アイコンの表とディスクの一致', () => {
	// ⚠️`new URL(..., import.meta.url)` は使わない。Vite がアセット参照として書き換えるので
	//   解決先が http://localhost:3000/vite/... になり、ファイルとして見えなくなる（実際に踏んだ）。
	//   vitest の cwd は packages/frontend なので、そこからの相対で引く。
	const assetRoot = join(process.cwd(), 'assets', 'hanaawase');
	const charaDir = join(assetRoot, 'chara');
	/** ディスク上の face_N.webp を数える。存在しない住民は 0。 */
	const countOnDisk = (id: string): number => {
		const dir = join(charaDir, id);
		if (!existsSync(dir)) return 0;
		return readdirSync(dir).filter((name) => /^face_\d+\.webp$/.test(name)).length;
	};

	it('⚠️検査の土台が実在する（ここが空なら以降の合格は空振り）', () => {
		expect(existsSync(charaDir), charaDir).toBe(true);
		expect(readdirSync(charaDir).length).toBeGreaterThan(0);
	});

	it('表に書いた枚数が、実ファイルの枚数と一致する', () => {
		for (const id of MACHI_FACE_IDS) {
			expect(countOnDisk(id), `chara/${id}`).toBe(MACHI_FACE_COUNT[id]);
		}
	});

	it('⚠️組み立てうるパスが全て実在する（1本でも欠けたら404になる）', () => {
		let checked = 0;
		for (const id of MACHI_FACE_IDS) {
			for (let n = 1; n <= MACHI_FACE_COUNT[id]!; n++) {
				const path = facePathOf(id, n);
				expect(path, `${id}/face_${n}`).not.toBeNull();
				const file = path!.replace('/client-assets/hanaawase/', '');
				expect(existsSync(join(assetRoot, file)), file).toBe(true);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(0); // ⚠️0本の空振りを許さない
	});

	it('⚠️立ち絵を持つ住民の表が漏れていない（tachie:true なら表に載っている）', () => {
		for (const persona of MACHI_PERSONAS) {
			if (!persona.tachie) continue;
			expect(MACHI_FACE_IDS, `${persona.id} に tachie:true があるのに表が無い`).toContain(persona.id);
		}
	});
});
