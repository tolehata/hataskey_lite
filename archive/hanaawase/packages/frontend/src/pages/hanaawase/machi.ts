// 花常「街の様子」の出し分けロジック。純TS・DOM非依存・テスト可能。
// ⚠️Math.random は使わない（本体規約）。乱数は seed 付き rng（rng.ts）を呼び出し側が渡す。
//    時刻依存の揺らぎが欲しいときは Date.now() を種にして rng を作る。
// ⚠️backend非依存。locale/PREF_DEF/achievements/リアルタイムチャンネルを一切参照しない。

import { mulberry32, seedFromText } from './rng.js';
import type { Rng } from './rng.js';
import {
	AMBIENT_EMOJI,
	HEART_EMOJI,
	HEART_REPLIES,
	MACHI_POSTS,
	MACHI_REPOST_SCENARIOS,
	MACHI_THREADS,
	TANOMIGOTO,
} from './machi-lines.js';
import type { MachiPersonaId, MachiPost, Tanomigoto } from './machi-lines.js';

// --- モデル -------------------------------------------------------------

export interface MachiReaction {
	emoji: string;
	count: number;
	/** 自分が押した分を含むか（♡の見た目を変える）。 */
	mine: boolean;
}

export interface MachiNote {
	id: number;
	personaId: MachiPersonaId;
	text: string;
	/** 投稿された時刻。リアクションの育ち方はここからの経過で決まる。 */
	bornAt: number;
	reactions: MachiReaction[];
	/**
	 * この投稿が最終的に集める反応の総数。ここに届いたら増えるのをやめる。
	 * ⚠️これが無いと放置中に青天井で増え続ける。投稿ごとにばらつく（`reactionCap`）。
	 */
	cap: number;
	/** 自分が♡を押しているか。 */
	hearted: boolean;
	/** スレッドの返信か。 */
	reply: boolean;
	/** 自分の下にまだ返信がある（縦線を継続する）。 */
	cont: boolean;
	/** 返信を持つ親か（アバター下から縦線を伸ばす）。 */
	hasReplies: boolean;
	/** その投稿に付きやすい絵文字のあたり。 */
	emojiHints: string[];
	/**
	 * 自分の♡がきっかけで流れてきた投稿か。
	 * ⚠️あくまで空リプ（宛先を書かない独立した投稿）のまま。表示側が一度だけ淡く光らせるだけに使う。
	 */
	warm: boolean;
	/** NPCが取り消した投稿。本文・操作・リアクションは表示しない。 */
	withdrawn: boolean;
	/** 直前の投稿を本人が書きなおしたもの。 */
	reposted: boolean;
}

export interface MachiPetal {
	/** カード内の水平位置 %。 */
	left: number;
	/** 一辺 px。 */
	size: number;
	/** 落下にかける秒数。 */
	dur: number;
	/** 開始を遅らせる秒数。 */
	delay: number;
	/** 横に流れる量 px。 */
	sway: number;
}

export type QuestState = 'open' | 'wip' | 'done' | 'fail' | 'miss';

export interface QuestEntry {
	qi: number;
	quest: Tanomigoto;
	state: QuestState;
	/** 「あとN日」の表示用。 */
	limitDays: number;
	petals: MachiPetal[];
}

/** フィードの1要素。会話（スレッド）は notes 複数でひとまとまり。 */
export type MachiItem =
	| { kind: 'notes'; id: number; notes: MachiNote[] }
	| { kind: 'quest'; id: number; qi: number };

export type FeedSource =
	| { kind: 'post'; index: number }
	| { kind: 'thread'; index: number };

// --- 流速（⚠️固定しない） -----------------------------------------------

/** ときどき会話が弾む確率。 */
export const BURST_CHANCE = 0.16;
/** フィードに残す最大件数。これを超えた末尾は捨てる。 */
export const FEED_LIMIT = 44;

/**
 * 次の投稿までの待ち時間 ms。
 * ふだんは3〜10秒あくが、16%の確率で0.8〜1.9秒の「バースト」になる（＝立て続けに流れる）。
 */
export function nextPostDelay(rng: Rng): number {
	return rng() < BURST_CHANCE ? 800 + rng() * 1100 : 3000 + rng() * 7000;
}

/** リアクションが1つ増えるまでの待ち時間 ms。 */
export function nextReactionDelay(rng: Rng): number {
	return 500 + rng() * 2400;
}

/** 次のたのみごとが流れてくるまでの待ち時間 ms（45〜90秒＝低頻度）。 */
export function nextQuestDelay(rng: Rng): number {
	return 45000 + rng() * 45000;
}

/** 投稿取消のお遊びが始まるまでの待ち時間 ms（55〜105秒＝低頻度）。 */
export function nextRepostDelay(rng: Rng): number {
	return 55000 + rng() * 50000;
}

/** 取消前の投稿を読める時間。 */
export const REPOST_VISIBLE_MS = 3200;
/** 取消表示から、書きなおしが流れるまでの間。 */
export const REPOST_PAUSE_MS = 1200;

/** ♡を押してから投稿者が空リプを流すまでの待ち時間 ms（2.2〜7.4秒）。 */
export function heartReplyDelay(rng: Rng): number {
	return 2200 + rng() * 5200;
}

// --- リアクションが時間で育つ -------------------------------------------

/** 投稿直後、誰もまだ押さない時間 ms。 */
export const REACTION_QUIET_MS = 3500;
/** 盛り上がりのピークに達するまでの秒数。 */
export const REACTION_RISE_S = 14;
/** 画面内の投稿の押されやすさ倍率。 */
export const VISIBLE_BOOST = 1.6;
/** 1投稿に付く絵文字の種類の上限。 */
export const MAX_REACTION_KINDS = 8;
/**
 * 投稿が「もう誰も見ない」ことになるまでの ms。
 * ⚠️これが無いと重みが 14/t で永遠に正のままになり、放置中もリアクションが増え続ける。
 */
export const REACTION_FADE_MS = 240000;

/**
 * 投稿からの経過で「誰かが気づいて押す」重み。
 * 直後は誰もまだ見ていない → 14秒かけて盛り上がる → 以降ゆるやかに減衰 → 4分で 0。
 */
export function reactionWeight(ageMs: number): number {
	if (ageMs <= REACTION_QUIET_MS) return 0;
	if (ageMs >= REACTION_FADE_MS) return 0;
	const t = (ageMs - REACTION_QUIET_MS) / 1000;
	const base = t < REACTION_RISE_S ? t / REACTION_RISE_S : REACTION_RISE_S / t;
	// ⚠️打ち切りで反応がぷつりと止まって見えないよう、終わりに向けて滑らかに 0 へ寄せる
	return base * (1 - (ageMs - REACTION_QUIET_MS) / (REACTION_FADE_MS - REACTION_QUIET_MS));
}

/**
 * その投稿が最終的に集める反応の総数。
 * ⚠️投稿ごとにばらけるよう id から決める（`Math.random` は使わない）。
 * 二乗で低いほうへ寄せてあるので、大半は静かなまま・ときどき伸びる投稿がある。
 */
export function reactionCap(id: number): number {
	const h = (Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) >>> 0) / 0x100000000;
	return 2 + Math.floor(h * h * 26);
}

/** いま付いている反応の総数。 */
export function reactionTotal(note: MachiNote): number {
	let total = 0;
	for (const r of note.reactions) total += r.count;
	return total;
}

/**
 * この投稿はまだ育つか。
 * ⚠️表示側はこれで先に絞ってから DOM を測ること（放置中の強制レイアウトを避けるため）。
 */
export function canGrowReaction(note: MachiNote, now: number): boolean {
	if (note.withdrawn) return false;
	if (reactionWeight(now - note.bornAt) <= 0) return false;
	return reactionTotal(note) < note.cap;
}

/** 種類が少ないうちほど新しい絵文字が付きやすい。 */
export function newEmojiChance(kinds: number): number {
	if (kinds < 3) return 0.62;
	if (kinds < 5) return 0.4;
	return 0.18;
}

/** 重み付き抽選。合計が0以下なら null。 */
export function pickWeighted<T>(entries: readonly { item: T; weight: number }[], rng: Rng): T | null {
	let total = 0;
	for (const e of entries) if (e.weight > 0) total += e.weight;
	if (total <= 0) return null;
	let r = rng() * total;
	for (const e of entries) {
		if (e.weight <= 0) continue;
		r -= e.weight;
		if (r <= 0) return e.item;
	}
	return entries[entries.length - 1]?.item ?? null;
}

/** その投稿にまだ付いていない絵文字を1つ選ぶ。投稿自身のあたりを優先する。 */
export function pickEmoji(note: MachiNote, rng: Rng): string {
	const used = new Set(note.reactions.map((r) => r.emoji));
	const hints = note.emojiHints.filter((e) => !used.has(e));
	if (hints.length > 0 && rng() < 0.7) return hints[Math.floor(rng() * hints.length)]!;
	return AMBIENT_EMOJI[Math.floor(rng() * AMBIENT_EMOJI.length)]!;
}

export interface ReactionTarget {
	note: MachiNote;
	/** いま画面内に見えているか。 */
	visible: boolean;
}

/** どの投稿のどの絵文字が増えたか（表示側はこれを見て1つだけ弾ませる）。 */
export interface ReactionHit {
	note: MachiNote;
	emoji: string;
}

/**
 * 候補から1つ選んでリアクションを1つ増やす。増やした場所を返す（誰も反応しない時間帯は null）。
 * ⚠️note を破壊的に更新する。呼び出し側は reactive な配列要素をそのまま渡してよい。
 */
export function growReaction(targets: readonly ReactionTarget[], now: number, rng: Rng): ReactionHit | null {
	const entries = targets.map((t) => ({
		item: t.note,
		// ⚠️上限に届いた投稿は候補から外す。外さないと総数が青天井に増え続ける
		weight: canGrowReaction(t.note, now)
			? reactionWeight(now - t.note.bornAt) * (t.visible ? VISIBLE_BOOST : 1)
			: 0,
	}));
	const note = pickWeighted(entries, rng);
	if (!note) return null;
	const kinds = note.reactions.length;
	if ((kinds === 0 || rng() < newEmojiChance(kinds)) && kinds < MAX_REACTION_KINDS) {
		const emoji = pickEmoji(note, rng);
		const same = note.reactions.find((r) => r.emoji === emoji);
		if (same) same.count += 1;
		else note.reactions.push({ emoji, count: 1, mine: false });
		return { note, emoji };
	}
	if (note.reactions.length === 0) return null;
	const bumped = note.reactions[Math.floor(rng() * note.reactions.length)]!;
	bumped.count += 1;
	return { note, emoji: bumped.emoji };
}

/** 自分で♡を押す／取り消す。押した後の状態を返す。 */
export function toggleHeart(note: MachiNote): boolean {
	if (note.withdrawn) return false;
	const index = note.reactions.findIndex((r) => r.emoji === HEART_EMOJI);
	if (note.hearted) {
		note.hearted = false;
		if (index >= 0) {
			const reaction = note.reactions[index]!;
			reaction.count -= 1;
			reaction.mine = false;
			if (reaction.count <= 0) note.reactions.splice(index, 1);
		}
		return false;
	}
	note.hearted = true;
	if (index >= 0) {
		note.reactions[index]!.count += 1;
		note.reactions[index]!.mine = true;
	} else {
		note.reactions.push({ emoji: HEART_EMOJI, count: 1, mine: true });
	}
	return true;
}

/** ♡への反応。⚠️返信ではなく、宛先を書かない独立した投稿（空リプ）として流す。 */
export function pickHeartReply(rng: Rng): string {
	return HEART_REPLIES[Math.floor(rng() * HEART_REPLIES.length)]!;
}

// --- 投稿の生成 ---------------------------------------------------------

export interface NoteOptions {
	reply?: boolean;
	cont?: boolean;
	hasReplies?: boolean;
	emojiHints?: readonly string[];
	warm?: boolean;
	withdrawn?: boolean;
	reposted?: boolean;
}

/** ⚠️新着は必ずリアクション0から始める（データ側の e は「付きやすさ」であって初期値ではない）。 */
export function makeNote(id: number, personaId: MachiPersonaId, text: string, now: number, options: NoteOptions = {}): MachiNote {
	return {
		id,
		personaId,
		text,
		bornAt: now,
		reactions: [],
		cap: reactionCap(id),
		hearted: false,
		reply: options.reply === true,
		cont: options.cont === true,
		hasReplies: options.hasReplies === true,
		emojiHints: [...(options.emojiHints ?? [])],
		warm: options.warm === true,
		withdrawn: options.withdrawn === true,
		reposted: options.reposted === true,
	};
}

export interface MachiRepostSequence {
	/** まず流れる、後から取り消される投稿。 */
	original: MachiItem;
	/** 同じ人物の書きなおしと、別人物の反応を束ねた会話。 */
	followup: MachiItem;
	/** 表示側が取り消し状態へ切り替える対象。 */
	originalNoteId: number;
}

/** 250パターンのどれかを、取消前1本＋投稿しなおしと反応の会話へ組み立てる。 */
export function makeRepostSequence(index: number, now: number, nextId: () => number): MachiRepostSequence {
	const scene = MACHI_REPOST_SCENARIOS[index % MACHI_REPOST_SCENARIOS.length]!;
	const originalNote = makeNote(nextId(), scene.p, scene.before, now, { emojiHints: scene.e });
	const repost = makeNote(nextId(), scene.p, scene.after, now + REPOST_VISIBLE_MS + REPOST_PAUSE_MS, {
		hasReplies: true,
		emojiHints: scene.e,
		reposted: true,
	});
	const reaction = makeNote(nextId(), scene.by, scene.reply, repost.bornAt, {
		reply: true,
		emojiHints: ['💬'],
	});
	return {
		original: { kind: 'notes', id: originalNote.id, notes: [originalNote] },
		followup: { kind: 'notes', id: repost.id, notes: [repost, reaction] },
		originalNoteId: originalNote.id,
	};
}

/** 250パターンをseed付きで一巡させる順番。重複抽選で一部が永久に出ない状態を避ける。 */
export function buildRepostOrder(rng: Rng): number[] {
	const order = MACHI_REPOST_SCENARIOS.map((_, index) => index);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[order[i], order[j]] = [order[j]!, order[i]!];
	}
	return order;
}

/** NPC投稿を取消済みにする。リアクションと自分の♡も同時に畳む。 */
export function withdrawNote(note: MachiNote): void {
	note.withdrawn = true;
	note.hearted = false;
	note.reactions.splice(0, note.reactions.length);
}

/** 投稿1本 or 会話ひとまとまりを組み立てる。 */
export function makeItem(source: FeedSource, now: number, nextId: () => number): MachiItem {
	if (source.kind === 'post') {
		const post: MachiPost = MACHI_POSTS[source.index % MACHI_POSTS.length]!;
		const note = makeNote(nextId(), post.p, post.t, now, { emojiHints: post.e });
		return { kind: 'notes', id: note.id, notes: [note] };
	}
	const thread = MACHI_THREADS[source.index % MACHI_THREADS.length]!;
	const root = makeNote(nextId(), thread.root.p, thread.root.t, now, {
		hasReplies: thread.replies.length > 0,
		emojiHints: thread.root.e,
	});
	const notes = [root];
	thread.replies.forEach((reply, i) => {
		notes.push(makeNote(nextId(), reply.p, reply.t, now, {
			reply: true,
			cont: i < thread.replies.length - 1,
			emojiHints: reply.e,
		}));
	});
	return { kind: 'notes', id: root.id, notes };
}

/** 投稿と会話を混ぜて並び順を作る（seed固定なので再現できる）。 */
export function buildOrder(rng: Rng): FeedSource[] {
	const order: FeedSource[] = [
		...MACHI_POSTS.map((_, index) => ({ kind: 'post', index }) as const),
		...MACHI_THREADS.map((_, index) => ({ kind: 'thread', index }) as const),
	];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[order[i], order[j]] = [order[j]!, order[i]!];
	}
	return order;
}

/** 投稿の時刻表示。⚠️投稿からの経過で決める（固定の文言を回さない）。 */
export function relativeTime(ageMs: number): string {
	if (ageMs < 45000) return 'たった今';
	const minutes = Math.floor(ageMs / 60000);
	if (minutes < 60) return `${Math.max(1, minutes)}分前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}時間前`;
	return `${Math.floor(hours / 24)}日前`;
}

// --- 季節と空（表題の花びら／TLの背景） ---------------------------------
// ⚠️判定はJST固定（daytime.ts と同じ思想）。端末のタイムゾーンで見え方を変えない。

/** JSTの値を getUTC* で読み出せるようにずらした Date。⚠️表示に使わない（内部計算専用）。 */
function jstShift(now: Date): Date {
	return new Date(now.getTime() + 9 * 3600000);
}

export type MachiSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export function machiSeason(now: Date): MachiSeason {
	const month = jstShift(now).getUTCMonth() + 1;
	if (month >= 3 && month <= 5) return 'spring';
	if (month >= 6 && month <= 8) return 'summer';
	if (month >= 9 && month <= 11) return 'autumn';
	return 'winter';
}

export interface MachiSeasonSpec {
	/** 表題まわりの花びらの色。枚ごとに順に使う。 */
	readonly colors: readonly string[];
	/** 花びらの形。CSS 側で data-shape により border-radius を切り替える。 */
	readonly shape: 'sakura' | 'leaf' | 'ginkgo' | 'snow';
	/** いちばん濃いときの不透明度。⚠️表題を読む邪魔をしない上限としてここで縛る。 */
	readonly peak: number;
	/** TLの空にうっすら混ぜる季節の色。 */
	readonly tint: string;
}

/** ⚠️peak は 0.5 を超えない（超えると表題に重なって読みにくくなる）。 */
export const MACHI_SEASON: Readonly<Record<MachiSeason, MachiSeasonSpec>> = {
	spring: { colors: ['#f2a7b8', '#f8cdd8', '#e8b6c6'], shape: 'sakura', peak: 0.46, tint: 'rgb(242 167 184 / 7%)' },
	summer: { colors: ['#8fc98c', '#bfe0a2', '#a6d3b4'], shape: 'leaf', peak: 0.38, tint: 'rgb(143 201 140 / 6%)' },
	autumn: { colors: ['#e0a53f', '#d1673c', '#c98a4a'], shape: 'ginkgo', peak: 0.44, tint: 'rgb(209 103 60 / 7%)' },
	winter: { colors: ['#e8eef5', '#cfdbe8', '#dce6f0'], shape: 'snow', peak: 0.5, tint: 'rgb(207 219 232 / 6%)' },
};

/**
 * 投稿面と、その上の文字色。空と季節色を残したまま小さい文字も4.5:1以上にする。
 * ⚠️MachiFeed.vue はこの値をCSS変数へ渡す。検証と表示の色を別々に手書きしない。
 */
export const MACHI_NOTE_COLORS = {
	background: 'rgb(43 38 32 / 88%)',
	ink: '#f4efe3',
	supporting: '#d1c8b7',
} as const;

/** 表題まわりを舞う花びら1枚。⚠️軌道と絵の二層で描く（たのみごとの花吹雪と同じ作法）。 */
export interface MachiHeadPetal {
	/** ヘッダ内の水平位置 %。 */
	left: number;
	/** 一辺 px。 */
	size: number;
	/** 1周にかける秒数。 */
	dur: number;
	/** ⚠️負の値。開いた瞬間に全枚が上端から一斉に降り出す不自然さを消す。 */
	delay: number;
	/** 横に流れる量 px。 */
	drift: number;
	/** 絵の回転量 deg（⚠️回転は絵の側。軌道を回すと弧を描いて飛ぶ）。 */
	spin: number;
	/** colors のどれを使うか。 */
	tone: number;
}

/** ⚠️表題まわりは7枚まで。増やすと文字が読みにくくなる。 */
export const HEAD_PETAL_COUNT = 7;

export function makeHeadPetals(rng: Rng, count = HEAD_PETAL_COUNT): MachiHeadPetal[] {
	const petals: MachiHeadPetal[] = [];
	for (let i = 0; i < count; i++) {
		petals.push({
			left: Math.round((3 + (i * 92) / count + rng() * 7) * 10) / 10,
			size: Math.round((5 + rng() * 4.5) * 10) / 10,
			dur: Math.round((9 + rng() * 7) * 10) / 10,
			delay: -Math.round((i * 1.9 + rng() * 5) * 10) / 10,
			drift: Math.round((rng() < 0.5 ? -1 : 1) * (14 + rng() * 34)),
			spin: Math.round((rng() < 0.5 ? -1 : 1) * (120 + rng() * 260)),
			tone: i % 3,
		});
	}
	return petals;
}

export type MachiSky = 'dawn' | 'morning' | 'day' | 'evening' | 'dusk' | 'night';

/** JSTの時刻から空を選ぶ。夜明け4-6 / 朝6-10 / 昼10-15 / 夕15-18 / 宵18-20 / 夜それ以外。 */
export function machiSky(now: Date): MachiSky {
	const hour = jstShift(now).getUTCHours();
	if (hour >= 4 && hour < 6) return 'dawn';
	if (hour >= 6 && hour < 10) return 'morning';
	if (hour >= 10 && hour < 15) return 'day';
	if (hour >= 15 && hour < 18) return 'evening';
	if (hour >= 18 && hour < 20) return 'dusk';
	return 'night';
}

export interface MachiSkySpec {
	/** ヘッダの小さな表示。 */
	readonly label: string;
	readonly top: string;
	readonly bottom: string;
	readonly glow: string;
	/** 光の中心の縦位置 %。 */
	readonly glowY: string;
}

/**
 * ⚠️どれも「--m-bg の上に薄くのせる色」。不透明度は 30% を超えない。
 * ここを濃くすると本文が読めなくなる＝害のある演出になる。
 */
export const MACHI_SKY: Readonly<Record<MachiSky, MachiSkySpec>> = {
	dawn: { label: '暁', top: 'rgb(96 84 138 / 26%)', bottom: 'rgb(226 150 128 / 10%)', glow: 'rgb(255 196 150 / 14%)', glowY: '88%' },
	morning: { label: '朝', top: 'rgb(150 196 214 / 18%)', bottom: 'rgb(255 240 206 / 8%)', glow: 'rgb(255 246 214 / 16%)', glowY: '12%' },
	day: { label: '昼', top: 'rgb(146 194 220 / 14%)', bottom: 'rgb(214 226 200 / 7%)', glow: 'rgb(255 255 240 / 10%)', glowY: '6%' },
	evening: { label: '夕', top: 'rgb(226 158 86 / 16%)', bottom: 'rgb(180 108 96 / 10%)', glow: 'rgb(255 190 120 / 18%)', glowY: '78%' },
	dusk: { label: '宵', top: 'rgb(92 78 128 / 24%)', bottom: 'rgb(214 118 96 / 12%)', glow: 'rgb(255 158 110 / 16%)', glowY: '92%' },
	night: { label: '夜', top: 'rgb(38 52 96 / 30%)', bottom: 'rgb(24 30 54 / 16%)', glow: 'rgb(150 178 235 / 10%)', glowY: '20%' },
};

/** ⚠️空の切替はフェード。ぱっと変わらない。 */
export const SKY_FADE_MS = 2600;
/** たのみごとが流れてきたときに空がひと呼吸だけ暖まる長さ。 */
export const QUEST_BLOOM_MS = 3400;

// --- 住民のアイコンが変わる ---------------------------------------------
// ⚠️アイコンは立ち絵の表情差分（chara/<id>/face_N.webp）から作る。
// ⚠️face の枚数はキャラごとに違う。ここに書いた枚数を超える N を絶対に組み立てない（404になる）。
//    実ファイル準拠（2026-07 時点の assets/hanaawase/chara/ の中身）。

export const MACHI_FACE_COUNT: Readonly<Partial<Record<MachiPersonaId, number>>> = {
	wakana: 21,
	ren: 21,
	yae: 4,
	inukai: 4,
	naito: 3,
	tatsumi: 3,
	gen: 3,
};

export const MACHI_FACE_IDS: readonly MachiPersonaId[] = Object.keys(MACHI_FACE_COUNT) as MachiPersonaId[];

/**
 * アイコンの画像パス。⚠️枚数の範囲外・未登録の住民は null（＝頭文字のアイコンに戻る）。
 * 呼び出し側は null を素通りさせ、読み込み失敗も静かに握りつぶすこと。
 */
export function facePathOf(personaId: string, n: number): string | null {
	const count = MACHI_FACE_COUNT[personaId as MachiPersonaId];
	if (count === undefined) return null;
	if (!Number.isInteger(n) || n < 1 || n > count) return null;
	return `/client-assets/hanaawase/chara/${personaId}/face_${n}.webp`;
}

/** 住民ごとの最初のアイコン。⚠️idから決めるので毎回同じ（Math.random は使わない）。 */
export function initialFaces(): Map<MachiPersonaId, number> {
	const faces = new Map<MachiPersonaId, number>();
	for (const id of MACHI_FACE_IDS) {
		const count = MACHI_FACE_COUNT[id] ?? 1;
		faces.set(id, 1 + (seedFromText(`hanaawase:machi:face:${id}`) % count));
	}
	return faces;
}

/** ⚠️アイコン変更の文面はここに閉じ込める（machi-lines.ts も本体 locale も触らない）。 */
export const ICON_CHANGE_LINES: readonly string[] = [
	'アイコン、変えました。',
	'思い立ってアイコンを差し替えた。深い意味はない。',
	'アイコンを新しくしました。今日の顔です。',
	'写真を替えました。しばらくこれでいきます。',
	'アイコン変えたら誰だか分からないと言われた。私です。',
	'前のアイコン、二年くらい使っていた。さすがに替える。',
	'アイコンを差し替えた。少し明るいほうがいいかと思って。',
	'アイコン変更。撮ったのは今朝の店先。',
	'アイコン、変えてみた。しっくりくるまでもう少しかかりそう。',
	'アイコンを替えました。前のほうがよかったら言ってください。',
	'顔が古くなってきたのでアイコンを更新。',
	'アイコン新しくした。季節に合わせたつもり。',
	'アイコンを替えた。鏡を見て少し反省した。',
	'アイコン、変えました。見分けがつかなくなったらすみません。',
	'新しいアイコンです。撮り直しに三十分かかった。',
	'アイコンを変えた。写りは悪くないと思う。',
];

export interface IconChange {
	personaId: MachiPersonaId;
	/** ⚠️必ず 1..MACHI_FACE_COUNT の範囲。かつ今と違う番号。 */
	face: number;
	text: string;
}

/** 誰かがアイコンを変えるまでの待ち時間 ms（90〜210秒＝ときどき）。 */
export function nextIconChangeDelay(rng: Rng): number {
	return 90000 + rng() * 120000;
}

export interface MachiAutoplayLoadEstimate {
	/** 自動再生そのものが発生させるサーバー要求。初期ページ・画像取得は含まない。 */
	serverRequestsPerMinute: number;
	/** 自動再生そのものが発生させるDB・registry等への永続書き込み。 */
	persistentWritesPerMinute: number;
	/** 新しい投稿を差し込む平均回数。 */
	postInsertionsPerMinute: number;
	/** リアクションが育っている時間帯の判定回数。 */
	activeReactionChecksPerMinute: number;
	/** 育ったリアクションの弾み表示を消す、一過性タイマーの平均回数。 */
	reactionPopCleanupWakeupsPerMinute: number;
	/** 育つ投稿が無い時間帯の判定回数。 */
	idleReactionChecksPerMinute: number;
	/** 取消開始・取消表示・投稿しなおしの3段階を合わせた平均タイマー発火回数。 */
	repostSequenceWakeupsPerMinute: number;
	/** 時刻・依頼・アイコン・投稿取消を含む、活発時の平均タイマー発火回数。 */
	totalActiveTimerWakeupsPerMinute: number;
	/** リアクションが育たない時間帯の平均タイマー発火回数。 */
	totalIdleTimerWakeupsPerMinute: number;
}

/**
 * 自動再生の理論平均。各待ち時間が一様分布である既存実装から算出する。
 * ⚠️通信0の根拠はテストで MachiFeed.vue / machi.ts の通信API不在を陽性対照つきで固定する。
 */
export function estimateMachiAutoplayLoad(): MachiAutoplayLoadEstimate {
	const meanPostDelay = BURST_CHANCE * ((800 + 1900) / 2) + (1 - BURST_CHANCE) * ((3000 + 10000) / 2);
	const postInsertions = 60000 / meanPostDelay;
	const activeReactionChecks = 60000 / ((500 + 2900) / 2);
	const idleReactionChecks = 60000 / 6000;
	const questWakeups = 60000 / ((45000 + 90000) / 2);
	const iconWakeups = 60000 / ((90000 + 210000) / 2);
	const clockWakeups = 60000 / 20000;
	const repostSequences = 60000 / ((55000 + 105000) / 2);
	const repostSequenceWakeups = repostSequences * 3;
	// リアクションが1つ育つたび、弾み表示を360ms後に消す一過性タイマーが1回だけ動く。
	const reactionPopCleanupWakeups = activeReactionChecks;
	// アイコン変更には、光の印をICON_FLIP_MS後に消す一過性タイマーが1回だけ伴う。
	const iconWakeupsWithCleanup = iconWakeups * 2;
	return {
		serverRequestsPerMinute: 0,
		persistentWritesPerMinute: 0,
		postInsertionsPerMinute: postInsertions,
		activeReactionChecksPerMinute: activeReactionChecks,
		reactionPopCleanupWakeupsPerMinute: reactionPopCleanupWakeups,
		idleReactionChecksPerMinute: idleReactionChecks,
		repostSequenceWakeupsPerMinute: repostSequenceWakeups,
		totalActiveTimerWakeupsPerMinute: postInsertions + activeReactionChecks + reactionPopCleanupWakeups + questWakeups + iconWakeupsWithCleanup + clockWakeups + repostSequenceWakeups,
		totalIdleTimerWakeupsPerMinute: postInsertions + idleReactionChecks + questWakeups + iconWakeupsWithCleanup + clockWakeups + repostSequenceWakeups,
	};
}

/**
 * 「アイコンを変える住民」と「変えた後の番号」を選ぶ。
 * ⚠️今と同じ番号は選ばない（「変えました」と言って何も変わらない事故を防ぐ）。
 * ⚠️差分が2枚未満の住民は候補に入れない。
 */
export function pickIconChange(faces: ReadonlyMap<MachiPersonaId, number>, rng: Rng): IconChange | null {
	const pool = MACHI_FACE_IDS.filter((id) => (MACHI_FACE_COUNT[id] ?? 0) >= 2);
	if (pool.length === 0) return null;
	const personaId = pool[Math.floor(rng() * pool.length)]!;
	const count = MACHI_FACE_COUNT[personaId]!;
	const current = faces.get(personaId);
	// 1..count-1 を引いてから、いまの番号以上なら1つ送る＝いまの番号だけを飛ばした一様抽選
	let face = 1 + Math.floor(rng() * (count - 1));
	if (current !== undefined && face >= current) face += 1;
	return { personaId, face, text: ICON_CHANGE_LINES[Math.floor(rng() * ICON_CHANGE_LINES.length)]! };
}

/** アイコンが変わった住民を光らせておく長さ ms。 */
export const ICON_FLIP_MS = 1200;

// --- ♡の手応え ----------------------------------------------------------

/** ♡から散る花びら1枚。⚠️transform と opacity だけで描けるパラメータに限る。 */
export interface HeartSpark {
	/** 到達点 px。 */
	dx: number;
	dy: number;
	size: number;
	/** ms。 */
	dur: number;
	/** ms。 */
	delay: number;
	spin: number;
	tone: number;
}

export const HEART_SPARK_COUNT = 7;
/** ⚠️どの粒も必ずこの時間内に消え切る（＝押しっぱなしでも残骸が溜まらない）。 */
export const HEART_BURST_MS = 1200;

export function makeHeartSparks(rng: Rng, count = HEART_SPARK_COUNT): HeartSpark[] {
	const sparks: HeartSpark[] = [];
	for (let i = 0; i < count; i++) {
		// ⚠️上向きの扇（-155〜-25度）。真下に飛ばすと押した指の下で潰れて見えない
		const deg = -155 + (130 * (i + rng() * 0.9)) / count;
		const rad = (deg * Math.PI) / 180;
		const reach = 18 + rng() * 26;
		sparks.push({
			dx: Math.round(Math.cos(rad) * reach),
			dy: Math.round(Math.sin(rad) * reach),
			size: Math.round((4.5 + rng() * 4) * 10) / 10,
			dur: Math.round(560 + rng() * 460),
			delay: Math.round(rng() * 90),
			spin: Math.round((rng() < 0.5 ? -1 : 1) * (40 + rng() * 130)),
			tone: i % 3,
		});
	}
	return sparks;
}

// --- たのみごと ---------------------------------------------------------

/** ⚠️同時に引き受けられるのは5件まで。 */
export const MAX_WIP = 5;

export type QuestTab = 'active' | 'open' | 'done';

/** ⚠️おしとやかに。5枚だけ、ゆっくり、薄く。 */
export function makePetals(rng: Rng, count = 5): MachiPetal[] {
	const petals: MachiPetal[] = [];
	for (let i = 0; i < count; i++) {
		petals.push({
			left: 8 + i * 19 + rng() * 8,
			size: Math.round(9 * (0.8 + rng() * 0.6) * 10) / 10,
			dur: Math.round((8.5 + rng() * 4.5) * 10) / 10,
			delay: Math.round((i * 1.7 + rng() * 2) * 10) / 10,
			sway: Math.round((rng() < 0.5 ? -1 : 1) * (9 + rng() * 14)),
		});
	}
	return petals;
}

export function makeQuestEntry(qi: number, index: number, rng: Rng): QuestEntry {
	return {
		qi,
		quest: TANOMIGOTO[index % TANOMIGOTO.length]!,
		state: 'open',
		limitDays: 2 + Math.floor(rng() * 4),
		petals: makePetals(rng),
	};
}

export function wipCount(log: readonly QuestEntry[]): number {
	return log.filter((e) => e.state === 'wip').length;
}

/** タブに入る条件。⚠️「見逃し」は救済のため 進行中 と 未受注 の両方に出す。 */
export function inTab(entry: QuestEntry, tab: QuestTab): boolean {
	if (tab === 'active') return entry.state === 'wip' || entry.state === 'miss';
	if (tab === 'open') return entry.state === 'open' || entry.state === 'miss';
	return entry.state === 'done' || entry.state === 'fail';
}

export function filterTab(log: readonly QuestEntry[], tab: QuestTab): QuestEntry[] {
	return log.filter((e) => inTab(e, tab));
}

export function tabCount(log: readonly QuestEntry[], tab: QuestTab): number {
	return filterTab(log, tab).length;
}

/** ⚠️「完了・失敗」タブは該当が出てから表示する。 */
export function showDoneTab(log: readonly QuestEntry[]): boolean {
	return tabCount(log, 'done') > 0;
}

/** ヘッダの！に出す数字。引受中＋見逃しだけ数える（未受注は数えない）。 */
export function badgeCount(log: readonly QuestEntry[]): number {
	return log.filter((e) => e.state === 'wip' || e.state === 'miss').length;
}

/** カードをタップしたとき、その依頼が入っているタブ。 */
export function tabForEntry(entry: QuestEntry | undefined): QuestTab {
	if (!entry) return 'active';
	if (entry.state === 'open') return 'open';
	if (entry.state === 'done' || entry.state === 'fail') return 'done';
	return 'active';
}

export type AcceptResult = 'accepted' | 'full' | 'invalid';

export function acceptQuest(log: QuestEntry[], qi: number): AcceptResult {
	const entry = log.find((e) => e.qi === qi);
	if (!entry || (entry.state !== 'open' && entry.state !== 'miss')) return 'invalid';
	if (wipCount(log) >= MAX_WIP) return 'full';
	entry.state = 'wip';
	return 'accepted';
}

/** ⚠️成否はシステム（盤面の結果）が決める。UIに手動の完了/失敗ボタンは置かない。 */
export function resolveQuest(log: QuestEntry[], qi: number, result: 'done' | 'fail'): boolean {
	const entry = log.find((e) => e.qi === qi);
	if (!entry || entry.state !== 'wip') return false;
	entry.state = result;
	return true;
}

/** 流れ去った依頼を「見逃し」にする（トースト＋バッジで救済する）。 */
export function markMissed(log: QuestEntry[], qi: number): boolean {
	const entry = log.find((e) => e.qi === qi);
	if (!entry || entry.state !== 'open') return false;
	entry.state = 'miss';
	return true;
}

export const QUEST_STATE_LABEL: Record<QuestState, string> = {
	open: '未受注',
	wip: '引受中',
	done: '完了',
	fail: '失敗',
	miss: '見逃し',
};

// --- rng ヘルパ ---------------------------------------------------------

/** 街の様子専用の rng。seed 未指定なら時刻を種にする（⚠️Math.randomは使わない）。 */
export function createMachiRng(seed?: number): Rng {
	return mulberry32((seed ?? Date.now()) ^ seedFromText('hanaawase:machi'));
}
