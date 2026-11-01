/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * Hatady の映画・ゲーム作品記録で共有する型と表示用ヘルパー。
 * API の値は保存値のまま扱い、表示文言だけ共通 locale の _hata._hatady._media から解決する。
 */

import type * as Misskey from 'cherrypick-js';
import { i18n } from '@/i18n.js';

export type HatadyMediaKind = 'movie' | 'game' | 'work';
export type HatadyMediaStatus = 'planned' | 'in_progress' | 'completed' | 'mastered' | 'on_hold' | 'dropped';
export type HatadyMediaSessionKind = 'movie_viewing' | 'game_play' | 'game_match' | 'game_roguelike' | 'game_pve';

/** 旗鯖fork(Hatady): 記録できる成績の指標。作品によって存在する指標が違うので、記録ごとに選ぶ。 */
export const HATADY_STAT_FIELDS = ['kills', 'deaths', 'specials', 'rescues', 'assists'] as const;
export type HatadyStatField = (typeof HATADY_STAT_FIELDS)[number];
export type HatadyWeaponStatRow = { weapon: string } & Partial<Record<HatadyStatField, number>>;
export type HatadyMediaVisibility = 'private' | 'followers' | 'public';
export type HatadyMediaSort = 'updatedAt' | 'title' | 'releaseDate' | 'recommendationRating' | 'status';
export type HatadyMovieOrigin = 'domestic' | 'foreign' | 'co_production' | 'other';
export type HatadyMovieViewingMode = 'original' | 'subtitled' | 'dubbed';

export interface HatadyMediaWork {
	id: string;
	createdAt: string;
	updatedAt: string;
	userId: string;
	user?: Misskey.entities.UserLite | null;
	kind: HatadyMediaKind;
	title: string;
	originalTitle?: string | null;
	status: HatadyMediaStatus;
	visibility: HatadyMediaVisibility;
	creator?: string | null;
	coverColorIndex?: number | null;
	isFavorite?: boolean;
	isRecommended?: boolean;
	recommendationRating?: number | null;
	releaseDate?: string | null;
	releaseYear?: number | null;
	officialUrl?: string | null;
	synopsis?: string | null;
	synopsisSpoiler?: boolean;
	review?: string | null;
	reviewSpoiler?: boolean;
	// 映画固有
	genres?: string[] | null;
	primaryLanguage?: string | null;
	runtimeMinutes?: number | null;
	origin?: HatadyMovieOrigin | null;
	viewingMode?: HatadyMovieViewingMode | null;
	highlights?: string[] | null;
	highlightsSpoiler?: boolean;
	// ゲーム固有
	platforms?: string[] | null;
	developer?: string | null;
	publisher?: string | null;
	reactions?: Array<{ reaction: string; count: number }>;
	myReaction?: string | null;
	commentsCount?: number;
	details?: Record<string, unknown>;
	deleted?: boolean;
	[key: string]: unknown;
}

export interface HatadyMediaSession {
	fileIds?: string[];
	files?: Misskey.entities.DriveFile[];
	id: string;
	workId: string | null;
	createdAt: string;
	updatedAt: string;
	kind: HatadyMediaSessionKind;
	occurredAt: string;
	durationMinutes?: number | null;
	durationSeconds?: number | null;
	startedAt?: string | null;
	tags?: string[];
	workSnapshot?: Record<string, unknown>;
	note?: string | null;
	noteSpoiler?: boolean;
	visibility: HatadyMediaVisibility;
	details?: Record<string, unknown> | null;
	[key: string]: unknown;
}

export type HatadyActivityType = 'study' | 'exercise' | 'work' | 'cooking' | HatadyMediaSessionKind;

export interface HatadyActivity {
	id: string;
	type: HatadyActivityType;
	occurredAt: string;
	visibility: HatadyMediaVisibility;
	user?: Misskey.entities.UserLite | null;
	isMine: boolean;
	source?: string;
	study?: Record<string, any> | null;
	media?: {
		work: HatadyMediaWork | null;
		session: HatadyMediaSession;
	} | null;
}

export interface HatadyActivityPage {
	items: HatadyActivity[];
	nextCursor: string | null;
	hasMore: boolean;
}

export interface HatadyMediaComment {
	id: string;
	workId: string;
	text: string;
	createdAt: string;
	replyId?: string | null;
	userId?: string;
	spoiler?: boolean;
	reactions?: Array<{ reaction: string; count: number }>;
	myReaction?: string | null;
	user?: Misskey.entities.UserLite | null;
	[key: string]: unknown;
}

type CopyTree = Record<string, any>;

export function hatadyMediaCopy(): CopyTree {
	return (i18n.ts._hata._hatady as unknown as { _media: CopyTree })._media;
}

export function mediaStatusOptions(kind: HatadyMediaKind): HatadyMediaStatus[] {
	if (kind === 'work') return ['in_progress', 'completed', 'on_hold'];
	return kind === 'movie'
		? ['planned', 'in_progress', 'completed', 'on_hold', 'dropped']
		: ['planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped'];
}

export function mediaSessionTypes(kind: HatadyMediaKind): HatadyMediaSessionKind[] {
	if (kind === 'work') return [];
	return kind === 'movie' ? ['movie_viewing'] : ['game_play', 'game_match', 'game_pve', 'game_roguelike'];
}

export function mediaStatusCopyKey(kind: HatadyMediaKind, status: HatadyMediaStatus): string {
	if (status === 'in_progress' || status === 'completed') return `${kind}_${status}`;
	return status;
}

export function normalizeMediaSortForKind(kind: HatadyMediaKind, sort: HatadyMediaSort): HatadyMediaSort {
	return kind !== 'movie' && sort === 'recommendationRating' ? 'updatedAt' : sort;
}

export type HatadyMediaAdvancedFilters = {
	origin?: HatadyMovieOrigin | '';
	viewingMode?: HatadyMovieViewingMode | '';
	isRecommended?: boolean | null;
	minRecommendation?: number | null;
	sessionKind?: HatadyMediaSessionKind | '';
	result?: string;
	weapon?: string;
	rank?: string;
	route?: string;
	since?: string;
	until?: string;
};

export function mediaAdvancedFilterPayload(
	kind: HatadyMediaKind,
	filters: HatadyMediaAdvancedFilters,
): Record<string, unknown> {
	if (kind === 'movie') {
		return {
			...(filters.origin ? { origin: filters.origin } : {}),
			...(filters.viewingMode ? { viewingMode: filters.viewingMode } : {}),
			...(typeof filters.isRecommended === 'boolean' ? { isRecommended: filters.isRecommended } : {}),
			...(filters.minRecommendation != null
				? { minRecommendation: Math.max(0, Math.min(10, Math.round(filters.minRecommendation))) }
				: {}),
		};
	}
	return {
		...(filters.sessionKind ? { sessionKind: filters.sessionKind } : {}),
		...(filters.result?.trim() ? { result: filters.result.trim() } : {}),
		...(filters.weapon?.trim() ? { weapon: filters.weapon.trim() } : {}),
		...(filters.rank?.trim() ? { rank: filters.rank.trim() } : {}),
		...(filters.route?.trim() ? { route: filters.route.trim() } : {}),
		...(filters.since ? { since: filters.since } : {}),
		...(filters.until ? { until: filters.until } : {}),
	};
}

/**
 * 複数値は1行1項目で編集する。項目名に含まれるカンマを区切りとして扱わないため、
 * APIから受け取った配列を編集しても内容を可逆に保てる。
 */
export function normalizeMediaList(value: unknown): string[] {
	if (Array.isArray(value)) return value
		.map(String)
		.map((x) => x.trim())
		.filter(Boolean);
	if (typeof value !== 'string') return [];
	return value
		.split(/\r?\n/)
		.map((x) => x.trim())
		.filter(Boolean);
}

export function normalizeMediaWorks(value: unknown): HatadyMediaWork[] {
	const source = Array.isArray(value)
		? value
		: value && typeof value === 'object' && Array.isArray((value as any).items)
			? (value as any).items
			: [];
	return source.filter((item: unknown): item is HatadyMediaWork => {
		if (!item || typeof item !== 'object') return false;
		const work = item as Partial<HatadyMediaWork>;
		return (
			typeof work.id === 'string' &&
			(work.kind === 'movie' || work.kind === 'game' || work.kind === 'work') &&
			typeof work.title === 'string'
		);
	});
}

export function normalizeMediaSessions(value: unknown): HatadyMediaSession[] {
	const source = Array.isArray(value)
		? value
		: value && typeof value === 'object' && Array.isArray((value as any).items)
			? (value as any).items
			: [];
	return source.filter(
		(item: unknown): item is HatadyMediaSession =>
			!!item && typeof item === 'object' && typeof (item as any).id === 'string',
	);
}

export function normalizeHatadyActivityPage(value: unknown): HatadyActivityPage {
	const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const rawItems = Array.isArray(source.items) ? source.items : [];
	const items = rawItems.filter((item: unknown): item is HatadyActivity => {
		if (!item || typeof item !== 'object') return false;
		const activity = item as Partial<HatadyActivity>;
		if (typeof activity.id !== 'string' || typeof activity.occurredAt !== 'string') return false;
		if (
			!['study', 'exercise', 'work', 'cooking', 'movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'].includes(
				String(activity.type),
			)
		) return false;
		return ['study', 'exercise', 'work', 'cooking'].includes(activity.type as string)
			? !!activity.study && typeof activity.study === 'object'
			: !!activity.media?.session;
	});
	return {
		items,
		nextCursor: typeof source.nextCursor === 'string' ? source.nextCursor : null,
		hasMore: source.hasMore === true,
	};
}

/** Aggregates and exports must fail visibly when a response loses rows. */
export function requireHatadyActivityPage(value: unknown): HatadyActivityPage {
	if (
		!value ||
		typeof value !== 'object' ||
		!Array.isArray((value as any).items) ||
		typeof (value as any).hasMore !== 'boolean'
	) throw new Error('Invalid Hatady activity response');
	const page = normalizeHatadyActivityPage(value);
	if (page.items.length !== (value as any).items.length || (page.hasMore && !page.nextCursor)) throw new Error('Incomplete Hatady activity response');
	return page;
}

export function mediaDashboardSessions(sessions: readonly HatadyMediaSession[], isMine: boolean): HatadyMediaSession[] {
	return isMine ? [...sessions] : sessions.filter((session) => !session.noteSpoiler);
}

export function formatMediaMinutes(minutes: number | null | undefined): string {
	const total = Math.max(0, Number(minutes ?? 0));
	if (!Number.isFinite(total)) return '';
	const hours = Math.floor(total / 60);
	const rest = total % 60;
	const copyx = i18n.tsx._hata._hatady._home;
	return hours > 0
		? copyx.durationHoursMinutes({ hours: hours.toString(), minutes: rest.toString() })
		: copyx.durationMinutes({ minutes: rest.toString() });
}

export function mediaWorkSpecificPayload(
	kind: HatadyMediaKind,
	values: {
		genres?: string[];
		origin?: HatadyMovieOrigin | null;
		viewingMode?: HatadyMovieViewingMode | null;
		primaryLanguage?: string | null;
		runtimeMinutes?: number | null;
		highlights?: string[];
		highlightsSpoiler?: boolean;
		platforms?: string[];
		developer?: string | null;
		publisher?: string | null;
	},
): Record<string, unknown> {
	if (kind === 'work') return {};
	return kind === 'movie'
		? {
			genres: values.genres ?? [],
			origin: values.origin ?? null,
			viewingMode: values.viewingMode ?? null,
			primaryLanguage: values.primaryLanguage ?? null,
			runtimeMinutes: values.runtimeMinutes ?? null,
			highlights: values.highlights ?? [],
			highlightsSpoiler: values.highlightsSpoiler ?? false,
		}
		: {
			platforms: values.platforms ?? [],
			developer: values.developer ?? null,
			publisher: values.publisher ?? null,
		};
}

/** 種別ごとに保存される details のキー。フォームの項目落ちを検知する回帰テストからも参照する。 */
export const MEDIA_SESSION_DETAIL_KEYS: Record<HatadyMediaSessionKind, readonly string[]> = {
	movie_viewing: ['theaterName', 'screeningFormat', 'companions', 'rewatch', 'viewingMode'],
	game_play: [
		'playMode',
		'matchmaking',
		'progress',
		'difficulty',
		'device',
		'rank',
		'rating',
		'mood',
		'achievements',
		'character',
		'weapon',
		'weaponOrder',
	],
	game_match: [
		'result',
		'reason',
		'matchmaking',
		'opponentType',
		'opponent',
		'teamSize',
		'opponentSize',
		'score',
		'mode',
		'map',
		'character',
		'weapon',
		'weaponOrder',
		'statFields',
		'weaponStats',
		'roundResults',
		'bestOf',
		'kills',
		'deaths',
		'assists',
		'specials',
		'rescues',
		'rank',
		'ratingBefore',
		'ratingAfter',
		'overtime',
		'mood',
		'device',
	],
	game_roguelike: [
		'result',
		'seed',
		'floor',
		'route',
		'branches',
		'build',
		'runNumber',
		'difficulty',
		'character',
		'weapon',
		'weaponOrder',
		'mood',
		'device',
		'cause',
	],
	game_pve: [
		'result',
		'reason',
		'teamSize',
		'waves',
		'enemyTypes',
		'enemyCount',
		'boss',
		'difficulty',
		'mode',
		'map',
		'rank',
		'score',
		'character',
		'weapon',
		'weaponOrder',
		'statFields',
		'weaponStats',
		'kills',
		'deaths',
		'assists',
		'specials',
		'rescues',
		'achievements',
		'mood',
		'device',
	],
};

export function mediaSessionDetailsPayload(
	workKind: HatadyMediaKind,
	sessionKind: HatadyMediaSessionKind,
	values: Record<string, unknown>,
): Record<string, unknown> {
	const canonicalKind: HatadyMediaSessionKind = workKind === 'movie' ? 'movie_viewing' : sessionKind;
	return Object.fromEntries(
		MEDIA_SESSION_DETAIL_KEYS[canonicalKind]
			.filter((key) => values[key] !== undefined)
			.map((key) => [key, values[key]]),
	);
}

export type HatadyMediaSessionDisplayFact = { key: string; value: unknown };

/** 記録ごとに選ばれた指標。未指定(旧記録)は全指標を対象とみなす。 */
export function mediaStatFields(details: Record<string, unknown> | null | undefined): HatadyStatField[] {
	const raw = Array.isArray(details?.statFields) ? (details!.statFields as unknown[]).map(String) : [];
	const chosen = HATADY_STAT_FIELDS.filter((field) => raw.includes(field));
	return chosen.length > 0 ? chosen : [...HATADY_STAT_FIELDS];
}

/** 武器ごとの成績行。壊れた行(武器名なし等)は数えず落とす。 */
export function mediaWeaponStatRows(details: Record<string, unknown> | null | undefined): HatadyWeaponStatRow[] {
	const raw = details?.weaponStats;
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((entry) => {
		if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return [];
		const row = entry as Record<string, unknown>;
		const weapon = typeof row.weapon === 'string' ? row.weapon.trim() : '';
		if (weapon.length === 0) return [];
		const normalized: HatadyWeaponStatRow = { weapon };
		for (const field of HATADY_STAT_FIELDS) {
			const value = row[field];
			if (typeof value === 'number' && Number.isFinite(value)) normalized[field] = value;
		}
		return [normalized];
	});
}

/**
 * 武器行の合計。行が1つも無い場合は details 直下の合計値(旧記録・手入力)を拾う。
 * ⚠️未記録と 0 を区別するため、値が無い指標はキーごと落とす(0 で埋めない)。
 */
export function mediaStatTotals(
	details: Record<string, unknown> | null | undefined,
): Partial<Record<HatadyStatField, number>> {
	const rows = mediaWeaponStatRows(details);
	const totals: Partial<Record<HatadyStatField, number>> = {};
	if (rows.length > 0) {
		for (const row of rows) {
			for (const field of HATADY_STAT_FIELDS) {
				const value = row[field];
				if (typeof value !== 'number') continue;
				totals[field] = (totals[field] ?? 0) + value;
			}
		}
		return totals;
	}
	for (const field of HATADY_STAT_FIELDS) {
		const value = details?.[field];
		if (typeof value === 'number' && Number.isFinite(value)) totals[field] = value;
	}
	return totals;
}

/**
 * 旗鯖fork(Hatady): マイログに出す記録の種類。端末ローカルの保存値から復元するため、
 * 壊れた値・未知の値・順序の揺れを吸収する。⚠️保存が無い(null)ときだけ「全部表示」に倒す。
 * ⚠️空配列は「何も表示しない」という利用者の選択なので、全部表示に読み替えてはいけない。
 */
export const HATADY_LOG_KINDS = ['study', 'movie', 'game', 'exercise', 'work', 'cooking'] as const;
export type HatadyLogKind = (typeof HATADY_LOG_KINDS)[number];

export function normalizeHatadyLogKinds(raw: unknown): HatadyLogKind[] {
	if (raw == null) return [...HATADY_LOG_KINDS];
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [...HATADY_LOG_KINDS];
		}
	}
	if (!Array.isArray(parsed)) return [...HATADY_LOG_KINDS];
	// 定義順に揃える。保存順の揺れがボタンの並びや送信内容に出ないようにする。
	return HATADY_LOG_KINDS.filter((kind) => parsed.includes(kind));
}

/**
 * 旗鯖fork(Hatady): 同じ武器名やウェーブ数を毎回打ち直さずに済むよう、過去の記録から入力候補を集める。
 * 自由入力で同じ語を繰り返す欄だけを対象にする(シード値のように毎回違う値は候補にしても邪魔になるだけ)。
 */
const SUGGESTED_TEXT_KEYS = [
	'weapon',
	'character',
	'device',
	'mode',
	'map',
	'rank',
	'difficulty',
	'boss',
	'opponent',
	'progress',
	'route',
	'build',
	'theaterName',
	'screeningFormat',
] as const;
const SUGGESTED_LIST_KEYS = [
	'weaponOrder',
	'achievements',
	'enemyTypes',
	'roundResults',
	'branches',
	'companions',
] as const;
const SUGGESTED_NUMBER_KEYS = ['teamSize', 'opponentSize', 'waves', 'enemyCount', 'bestOf'] as const;
const SUGGESTION_LIMIT = 20;

export type HatadyMediaSuggestions = Record<string, string[]>;

export function collectMediaSessionSuggestions(
	sessions: readonly Pick<HatadyMediaSession, 'occurredAt' | 'details'>[],
): HatadyMediaSuggestions {
	const collected: HatadyMediaSuggestions = {};
	const seen: Record<string, Set<string>> = {};
	const push = (key: string, raw: unknown) => {
		const value =
			typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
		if (value.length === 0 || value.length > 256) return;
		seen[key] ??= new Set<string>();
		collected[key] ??= [];
		if (seen[key].has(value) || collected[key].length >= SUGGESTION_LIMIT) return;
		seen[key].add(value);
		collected[key].push(value);
	};
	// ⚠️直近で使ったものほど先に出す。呼び出し順に依存しないよう、ここで新しい順へ並べ直す。
	const ordered = [...sessions].sort((a, b) => String(b.occurredAt ?? '').localeCompare(String(a.occurredAt ?? '')));
	for (const session of ordered) {
		const details = session.details ?? {};
		for (const key of SUGGESTED_TEXT_KEYS) push(key, details[key]);
		for (const key of SUGGESTED_NUMBER_KEYS) push(key, details[key]);
		for (const key of SUGGESTED_LIST_KEYS) {
			const list = details[key];
			if (Array.isArray(list)) for (const item of list) push(key, item);
		}
		// 武器名は単一欄と成績表の双方から集める。どちらで入力しても同じ候補が出るようにするため。
		for (const row of mediaWeaponStatRows(details)) push('weapon', row.weapon);
	}
	return collected;
}

// 対で意味を持つ値はまとめ直して出すので、素の値としては並べない。
// ⚠️ここは i18n を持ち込まない(表示ラベルはコンポーネント側の責務)。純粋関数のままにしてテスト可能に保つ。
const MERGED_DETAIL_KEYS: readonly string[] = ['ratingBefore', 'ratingAfter', 'statFields'];

/** APIへ保存したdetailsを、セッション種別ごとに漏れなく再表示するための正本。 */
export function mediaSessionDisplayFacts(
	session: Pick<HatadyMediaSession, 'kind' | 'details'>,
): HatadyMediaSessionDisplayFact[] {
	const details = session.details ?? {};
	const keys = MEDIA_SESSION_DETAIL_KEYS[session.kind];
	// ⚠️まとめ直した事実も、必ず「その種別が持つキーか」で守る。
	// 種別を見ずに details の中身だけで判定すると、映画の記録にゲームの項目が漏れて出る。
	const hasComposition =
		keys.includes('teamSize') &&
		keys.includes('opponentSize') &&
		typeof details.teamSize === 'number' &&
		typeof details.opponentSize === 'number';
	const facts: HatadyMediaSessionDisplayFact[] = [];
	for (const key of keys) {
		if (MERGED_DETAIL_KEYS.includes(key)) continue;
		// 「4 vs 4」としてまとめるので、両方揃っているときは個別の人数を出さない。
		if (hasComposition && (key === 'teamSize' || key === 'opponentSize')) continue;
		const value = details[key];
		if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
		facts.push({ key, value });
	}
	if (hasComposition) {
		facts.push({ key: 'teamComposition', value: `${details.teamSize} vs ${details.opponentSize}` });
	}
	if (keys.includes('ratingBefore') && (details.ratingBefore != null || details.ratingAfter != null)) {
		facts.push({ key: 'ratingBeforeAfter', value: `${details.ratingBefore ?? '—'} → ${details.ratingAfter ?? '—'}` });
	}
	return facts;
}

export function mediaReactionPayload(
	targetType: 'work' | 'comment',
	targetId: string,
	reaction?: string,
): Record<string, string> {
	return reaction == null ? { targetType, targetId } : { targetType, targetId, reaction };
}

export function mediaCommentCreatePayload(
	workId: string,
	text: string,
	spoiler: boolean,
	replyId?: string | null,
): Record<string, unknown> {
	return { workId, text: text.trim(), spoiler, ...(replyId ? { replyId } : {}) };
}

export function hatadyViewingEventPayload(
	titleTemplate: string,
	workTitle: string,
	date: string,
	timeStart: string,
): Record<string, unknown> {
	return {
		title: titleTemplate.replace('{title}', workTitle),
		emoji: '🎬',
		date,
		dateEnd: '',
		timeStart,
		timeEnd: '',
		allDay: false,
		color: '#d9824a',
		rsvp: true,
	};
}
