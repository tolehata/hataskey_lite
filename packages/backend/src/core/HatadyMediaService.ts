/*
 * 旗鯖fork: Hatady の映画・ゲーム記録ドメイン。
 * 所有権・公開範囲・種別固有検証をこのサービスに集約し、各 API で判定が分散しないようにする。
 */

import { HataskFlowerV2Service, type FlowerReward } from './HataskFlowerV2Service.js';
import { Inject, Injectable } from '@nestjs/common';
import { In, type DataSource, type EntityManager, type QueryDeepPartialEntity } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type {
	HatadyFollowingsRepository,
	HatadyMediaCommentsRepository,
	HatadyMediaReactionsRepository,
	HatadyMediaSessionsRepository,
	HatadyMediaWorksRepository,
} from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import {
	HATADY_MEDIA_VISIBILITIES,
	HATADY_MEDIA_WORK_KINDS,
	HATADY_MEDIA_WORK_STATUSES,
	HATADY_MOVIE_ORIGINS,
	HATADY_MOVIE_VIEWING_MODES,
	MiHatadyMediaWork,
	type HatadyMediaVisibility,
	type HatadyMediaWorkKind,
	type HatadyMediaWorkStatus,
	type HatadyMovieOrigin,
	type HatadyMovieViewingMode,
} from '@/models/HatadyMediaWork.js';
import {
	HATADY_MEDIA_SESSION_KINDS,
	MiHatadyMediaSession,
	type HatadyMediaSessionKind,
} from '@/models/HatadyMediaSession.js';
import { MiHatadyMediaComment } from '@/models/HatadyMediaComment.js';
import { MiHatadyMediaReaction } from '@/models/HatadyMediaReaction.js';
import { MiHatadyNotification } from '@/models/HatadyNotification.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { HatadyAttachmentService } from '@/core/HatadyAttachmentService.js';
import { HatadyService, type HatadyMirrorNotification } from '@/core/HatadyService.js';
import { HatadyStreamService } from '@/core/HatadyStreamService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { bindThis } from '@/decorators.js';
import { mergeHatadyDetails, normalizeHatadyDuration, normalizeHatadyStartedAt, normalizeHatadyTags, packHatadyDetails } from '@/core/HatadyRecordData.js';

const MOVIE_FIELDS = ['runtimeMinutes', 'genres', 'origin', 'viewingMode', 'primaryLanguage', 'highlights', 'highlightsSpoiler'] as const;
const GAME_FIELDS = ['platforms', 'developer', 'publisher'] as const;

export type HatadyMediaWorkInput = {
	details?: Record<string, unknown>;
	title?: string;
	originalTitle?: string | null;
	creator?: string | null;
	releaseDate?: string | null;
	releaseYear?: number | null;
	status?: HatadyMediaWorkStatus;
	visibility?: HatadyMediaVisibility;
	isFavorite?: boolean;
	isRecommended?: boolean;
	recommendationRating?: number | null;
	coverColorIndex?: number | null;
	synopsis?: string | null;
	synopsisSpoiler?: boolean;
	review?: string | null;
	reviewSpoiler?: boolean;
	officialUrl?: string | null;
	runtimeMinutes?: number | null;
	genres?: string[];
	origin?: HatadyMovieOrigin | null;
	viewingMode?: HatadyMovieViewingMode | null;
	primaryLanguage?: string | null;
	highlights?: string[];
	highlightsSpoiler?: boolean;
	platforms?: string[];
	developer?: string | null;
	publisher?: string | null;
};

export type HatadyMediaSessionInput = {
	fileIds?: string[];
	durationSeconds?: number | null;
	startedAt?: string | null;
	tags?: string[];
	occurredAt: string;
	durationMinutes?: number | null;
	note?: string | null;
	noteSpoiler?: boolean;
	visibility?: HatadyMediaVisibility;
	details?: Record<string, unknown>;
};

function assertEnum<T extends string>(value: unknown, values: readonly T[], name: string): asserts value is T {
	if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`invalid ${name}`);
}

function normalizeOptionalString(value: string | null | undefined, max: number, name: string): string | null {
	if (value == null) return null;
	const result = value.trim();
	if (result.length === 0) return null;
	if (result.length > max) throw new Error(`${name} is too long`);
	return result;
}

function normalizeStringArray(value: string[] | undefined, maxItems: number, maxLength: number, name: string, deduplicate = true): string[] {
	if (value == null) return [];
	if (!Array.isArray(value) || value.length > maxItems) throw new Error(`invalid ${name}`);
	const normalized = value.map(item => {
		if (typeof item !== 'string') throw new Error(`invalid ${name}`);
		const text = item.trim();
		// フロントの複数値入力は1行1項目を正本とする。項目内改行を許すと、
		// APIで保存した1項目が次回編集時に複数項目へ分裂してしまう。
		if (text.length === 0 || text.length > maxLength || /[\r\n]/.test(text)) throw new Error(`invalid ${name}`);
		return text;
	});
	return deduplicate ? [...new Set(normalized)] : normalized;
}

const MEDIA_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

export function parseHatadyMediaDateTime(value: string, name = 'date-time'): Date {
	const match = MEDIA_DATE_TIME_RE.exec(value);
	if (match == null) throw new Error(`invalid ${name}`);
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (year < 1800 || year > 3000 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59 || second > 59) throw new Error(`invalid ${name}`);
	if (match[8] !== 'Z') {
		const offsetHour = Number(match[10]);
		const offsetMinute = Number(match[11]);
		if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) throw new Error(`invalid ${name}`);
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) throw new Error(`invalid ${name}`);
	return parsed;
}

function hasStoredValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === 'string') return value.trim().length > 0;
	if (typeof value === 'boolean') return value;
	return !Array.isArray(value) || value.length > 0;
}

/**
 * 旗鯖fork(Hatady): 記録できる成績の指標。ゲームによって存在する指標が違う(スペシャルや救助が無い作品もある)ため、
 * どれを使うかは記録ごとに利用者が選ぶ。ここはその選択肢の正本。
 */
export const HATADY_STAT_FIELDS = ['kills', 'deaths', 'specials', 'rescues', 'assists'] as const;
export type HatadyStatField = typeof HATADY_STAT_FIELDS[number];

export function normalizeHatadyStatFields(raw: unknown): HatadyStatField[] {
	if (!Array.isArray(raw)) throw new Error('invalid statFields');
	if (raw.length > HATADY_STAT_FIELDS.length) throw new Error('invalid statFields');
	const seen = new Set<string>();
	for (const value of raw) {
		if (typeof value !== 'string' || !HATADY_STAT_FIELDS.includes(value as HatadyStatField)) throw new Error('invalid statFields');
		if (seen.has(value)) throw new Error('invalid statFields');
		seen.add(value);
	}
	// 保存順の揺れが表示順に出ないよう、定義順へ揃えてから返す。
	return HATADY_STAT_FIELDS.filter(field => seen.has(field));
}

/**
 * 旗鯖fork(Hatady): 武器ごとの成績行。武器名は必須で、指標は入っているものだけを持つ。
 * 未入力の指標を 0 で埋めると「0キル」と「記録していない」が区別できなくなるため、キーごと落とす。
 */
export function normalizeHatadyWeaponStats(raw: unknown, previous: unknown = []): Record<string, unknown>[] {
	if (!Array.isArray(raw)) throw new Error('invalid weaponStats');
	if (raw.length > 20) throw new Error('invalid weaponStats');
	const savedRows = Array.isArray(previous) ? previous.filter(row => row && typeof row === 'object') as Record<string, unknown>[] : [];
	const used = new Set<number>();
	return raw.map(entry => {
		const opaque = Object.entries(entry ?? {}).filter(([key]) => key !== 'weapon' && !HATADY_STAT_FIELDS.includes(key as HatadyStatField));
		const matches = (row: Record<string, unknown>, index: number) => !used.has(index) && opaque.every(([key, value]) => Object.hasOwn(row, key) && JSON.stringify(row[key]) === JSON.stringify(value));
		let match = savedRows.findIndex((row, index) => row.weapon === entry?.weapon && matches(row, index));
		if (match < 0 && opaque.length > 0) {
			const candidates = savedRows.flatMap((row, index) => matches(row, index) ? [index] : []);
			if (candidates.length === 1) match = candidates[0];
		}
		const stored = match >= 0 ? savedRows[match] : {};
		if (match >= 0) used.add(match);
		if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('invalid weaponStats');
		const row = entry as Record<string, unknown>;
		for (const key of Object.keys(row)) {
			if (key !== 'weapon' && !HATADY_STAT_FIELDS.includes(key as HatadyStatField) && (!Object.hasOwn(stored, key) || JSON.stringify(stored[key]) !== JSON.stringify(row[key]))) throw new Error(`invalid weaponStats field ${key}`);
		}
		const weapon = typeof row.weapon === 'string' ? row.weapon.trim() : '';
		if ((weapon.length === 0 && stored.weapon !== '') || weapon.length > 256) throw new Error('invalid weaponStats weapon');
		const normalized: Record<string, unknown> = { ...stored, weapon };
		for (const field of HATADY_STAT_FIELDS) {
			const value = row[field];
			if (value === undefined) continue;
			if (value === null) { normalized[field] = null; continue; }
			if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 1000000) throw new Error(`invalid weaponStats ${field}`);
			normalized[field] = value;
		}
		return normalized;
	});
}

export function validateHatadyMediaSessionDetails(kind: HatadyMediaSessionKind, raw: unknown, previous: Record<string, unknown> = {}): Record<string, unknown> {
	if (raw == null) return { ...previous };
	if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid session details');
	const details = { ...raw } as Record<string, unknown>;
	const normalizedDetails: Record<string, unknown> = { ...details };
	const allowed: Record<HatadyMediaSessionKind, ReadonlySet<string>> = {
		movie_viewing: new Set(['theaterName', 'screeningFormat', 'companions', 'rewatch', 'viewingMode']),
		game_play: new Set(['playMode', 'matchmaking', 'progress', 'difficulty', 'device', 'rank', 'rating', 'mood', 'achievements', 'character', 'weapon', 'weaponOrder']),
		game_match: new Set(['result', 'reason', 'opponentType', 'opponent', 'matchmaking', 'score', 'mode', 'map', 'character', 'weapon', 'weaponOrder', 'roundResults', 'bestOf', 'kills', 'deaths', 'assists', 'rank', 'ratingBefore', 'ratingAfter', 'overtime', 'mood', 'device', 'teamSize', 'opponentSize', 'weaponStats', 'statFields', 'specials', 'rescues']),
		game_roguelike: new Set(['result', 'seed', 'floor', 'route', 'branches', 'build', 'runNumber', 'difficulty', 'character', 'weapon', 'weaponOrder', 'mood', 'device', 'cause']),
		// 旗鯖fork(Hatady): 4人以上の協力プレイ。敵の構成とウェーブを持ち、勝敗ではなく踏破結果で終わる。
		game_pve: new Set(['result', 'reason', 'difficulty', 'mode', 'map', 'character', 'weapon', 'weaponOrder', 'rank', 'score', 'mood', 'device', 'achievements', 'teamSize', 'waves', 'enemyTypes', 'enemyCount', 'boss', 'weaponStats', 'statFields', 'kills', 'deaths', 'assists', 'specials', 'rescues']),
	};
	const cleared: string[] = [];
	for (const key of Object.keys(details)) {
		if (details[key] === null && (allowed[kind].has(key) || ['viewing', 'session', 'note', 'pages', 'place'].includes(key))) { cleared.push(key); delete details[key]; delete normalizedDetails[key]; continue; }
		if (!allowed[kind].has(key) && !['viewing', 'session', 'note', 'pages', 'place'].includes(key)) {
			if (!Object.hasOwn(previous, key) || JSON.stringify(previous[key]) !== JSON.stringify(details[key])) throw new Error(`field ${key} is not allowed for ${kind}`);
		}
	}
	const stringKeys = ['viewing', 'session', 'note', 'pages', 'place', 'theaterName', 'screeningFormat', 'progress', 'difficulty', 'device', 'rank', 'mood', 'character', 'weapon', 'reason', 'opponent', 'score', 'mode', 'map', 'seed', 'route', 'build', 'cause', 'boss'];
	for (const key of stringKeys) {
		if (details[key] !== undefined && (typeof details[key] !== 'string' || (details[key] as string).length > (key === 'note' ? 8192 : 512))) throw new Error(`invalid ${key}`);
	}
	for (const key of ['companions', 'achievements', 'weaponOrder', 'branches', 'enemyTypes']) {
		if (details[key] !== undefined) normalizedDetails[key] = normalizeStringArray(details[key] as string[], 30, 256, key, false);
	}
	if (details.rewatch !== undefined && typeof details.rewatch !== 'boolean') throw new Error('invalid rewatch');
	if (details.overtime !== undefined && typeof details.overtime !== 'boolean') throw new Error('invalid overtime');
	if (details.viewingMode !== undefined && details.viewingMode !== previous.viewingMode) assertEnum(details.viewingMode, HATADY_MOVIE_VIEWING_MODES, 'viewingMode');
	if (details.playMode !== undefined && details.playMode !== previous.playMode) assertEnum(details.playMode, ['single', 'multi'], 'playMode');
	if (details.matchmaking !== undefined && details.matchmaking !== previous.matchmaking) assertEnum(details.matchmaking, ['solo', 'party', 'specific', 'random'], 'matchmaking');
	if (details.opponentType !== undefined && details.opponentType !== previous.opponentType) assertEnum(details.opponentType, ['human', 'cpu', 'team', 'other'], 'opponentType');
	if (details.result !== undefined && details.result !== previous.result) {
		const values = kind === 'game_match' ? ['win', 'loss', 'draw'] : ['cleared', 'failed', 'retired'];
		assertEnum(details.result, values, 'result');
	}
	for (const key of ['floor', 'runNumber', 'bestOf', 'kills', 'deaths', 'assists', 'specials', 'rescues', 'waves', 'enemyCount']) {
		if (details[key] !== undefined && (!Number.isInteger(details[key]) || (details[key] as number) < 0 || (details[key] as number) > 1000000)) throw new Error(`invalid ${key}`);
	}
	// 編成人数は「4対4」のような表示にしか使わないので、現実的な上限で抑える。
	for (const key of ['teamSize', 'opponentSize']) {
		if (details[key] !== undefined && (!Number.isInteger(details[key]) || (details[key] as number) < 1 || (details[key] as number) > 100)) throw new Error(`invalid ${key}`);
	}
	if (details.statFields !== undefined) {
		const stored = Array.isArray(previous.statFields) ? previous.statFields : [];
		if (!Array.isArray(details.statFields) || details.statFields.some(value => typeof value !== 'string' || (!HATADY_STAT_FIELDS.includes(value as HatadyStatField) && !stored.includes(value)))) throw new Error('invalid statFields');
		normalizedDetails.statFields = [...normalizeHatadyStatFields(details.statFields.filter(value => HATADY_STAT_FIELDS.includes(value as HatadyStatField))), ...stored.filter(value => typeof value === 'string' && !HATADY_STAT_FIELDS.includes(value as HatadyStatField))];
	}
	if (details.weaponStats !== undefined) {
		normalizedDetails.weaponStats = normalizeHatadyWeaponStats(details.weaponStats, previous.weaponStats);
	}
	for (const key of ['rating', 'ratingBefore', 'ratingAfter']) {
		if (details[key] !== undefined && (typeof details[key] !== 'number' || !Number.isFinite(details[key]) || Math.abs(details[key] as number) > 1000000000)) throw new Error(`invalid ${key}`);
	}
	if (details.roundResults !== undefined) {
		normalizedDetails.roundResults = normalizeStringArray(details.roundResults as string[], 100, 512, 'roundResults', false);
	}
	const encoded = JSON.stringify(normalizedDetails);
	if (encoded.length > 16384) throw new Error('session details are too large');
	const result = { ...previous, ...JSON.parse(encoded) } as Record<string, unknown>;
	for (const key of cleared) delete result[key];
	return result;
}

export function validateHatadyMediaOfficialUrl(value: string | null | undefined): void {
	if (value == null || value.trim() === '') return;
	if (value.length > 2048) throw new Error('invalid officialUrl');
	let url: URL;
	try { url = new URL(value); } catch { throw new Error('invalid officialUrl'); }
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid officialUrl');
}

export function buildHatadyMediaWorkCursorCondition(
	sort: 'createdAt' | 'updatedAt' | 'title' | 'releaseDate' | 'releaseYear' | 'status' | 'recommendationRating',
	order: 'ASC' | 'DESC',
	cursorValue: Date | string | number | null,
	untilId: string,
): { sql: string; params: { cursorValue?: Date | string | number; untilId: string } } {
	const op = order === 'DESC' ? '<' : '>';
	if (cursorValue == null) {
		return order === 'DESC'
			? { sql: `work.${sort} IS NULL AND work.id < :untilId`, params: { untilId } }
			: { sql: `((work.${sort} IS NULL AND work.id > :untilId) OR work.${sort} IS NOT NULL)`, params: { untilId } };
	}
	const nullTail = order === 'DESC' ? ` OR work.${sort} IS NULL` : '';
	return {
		sql: `(work.${sort} ${op} :cursorValue OR (work.${sort} = :cursorValue AND work.id ${op} :untilId)${nullTail})`,
		params: { cursorValue, untilId },
	};
}

export function buildHatadyMediaWorkSearchCondition(includePrivateText: boolean): string {
	const publicMetadata = '(work.title ILIKE :query OR work.originalTitle ILIKE :query OR work.creator ILIKE :query OR work.developer ILIKE :query OR work.publisher ILIKE :query OR work.primaryLanguage ILIKE :query OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(work.genres) AS genre(value) WHERE genre.value ILIKE :query) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(work.platforms) AS platform(value) WHERE platform.value ILIKE :query))';
	// あらすじ・レビューはネタバレ検索oracleになるため、本人一覧だけを検索対象にする。
	return includePrivateText ? `(${publicMetadata} OR work.synopsis ILIKE :query OR work.review ILIKE :query)` : publicMetadata;
}

export type HatadyMediaSessionWorkFilters = {
	sessionKind?: HatadyMediaSessionKind;
	result?: string;
	weapon?: string;
	rank?: string;
	route?: string;
	since?: string;
	until?: string;
};

export function buildHatadyMediaSessionWorkFilterCondition(filters: HatadyMediaSessionWorkFilters): { sql: string; params: Record<string, string> } | null {
	const clauses = ['media_session."workId" = work.id'];
	const params: Record<string, string> = {};
	if (filters.sessionKind != null) {
		assertEnum(filters.sessionKind, HATADY_MEDIA_SESSION_KINDS, 'sessionKind');
		clauses.push('media_session.kind = :sessionKind');
		params.sessionKind = filters.sessionKind;
	}
	if (filters.since != null) {
		clauses.push('media_session."occurredAt" >= :sessionSince');
		params.sessionSince = filters.since;
	}
	if (filters.until != null) {
		clauses.push('media_session."occurredAt" <= :sessionUntil');
		params.sessionUntil = filters.until;
	}
	const detailFilters = [['result', filters.result], ['weapon', filters.weapon], ['rank', filters.rank], ['route', filters.route]] as const;
	for (const [key, value] of detailFilters) {
		if (value == null) continue;
		const normalized = value.trim();
		const maxLength = key === 'result' ? 64 : 512;
		if (normalized.length === 0 || normalized.length > maxLength) throw new Error(`invalid ${key}`);
		const parameter = `session${key[0]!.toUpperCase()}${key.slice(1)}`;
		clauses.push(`media_session.details ->> '${key}' ILIKE :${parameter}`);
		params[parameter] = `%${sqlLikeEscape(normalized)}%`;
	}
	if (clauses.length === 1) return null;
	return { sql: `EXISTS (SELECT 1 FROM "hatady_media_session" media_session WHERE ${clauses.join(' AND ')})`, params };
}

@Injectable()
export class HatadyMediaService {
	public static readonly ERR_NOT_FOUND = 'HATADY_MEDIA_NOT_FOUND_OR_ACCESS_DENIED';
	public static readonly ERR_GAME_TITLE_LIMIT = 'HATADY_GAME_TITLE_LIMIT';

	constructor(
		private flowerService: HataskFlowerV2Service,
		@Inject(DI.db)
		private db: DataSource,
		@Inject(DI.hatadyMediaWorksRepository)
		private worksRepository: HatadyMediaWorksRepository,
		@Inject(DI.hatadyMediaSessionsRepository)
		private sessionsRepository: HatadyMediaSessionsRepository,
		@Inject(DI.hatadyMediaCommentsRepository)
		private commentsRepository: HatadyMediaCommentsRepository,
		@Inject(DI.hatadyMediaReactionsRepository)
		private reactionsRepository: HatadyMediaReactionsRepository,
		@Inject(DI.hatadyFollowingsRepository)
		private hatadyFollowingsRepository: HatadyFollowingsRepository,
		private idService: IdService,
		private roleService: RoleService,
		private userEntityService: UserEntityService,
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
		private hatadyAttachmentService: HatadyAttachmentService,
		private hatadyStreamService: HatadyStreamService,
	) {}

	private async publishWorkSessions(workId: string): Promise<void> {
		try {
			const sessions = await this.sessionsRepository.findBy({ workId });
			for (const session of sessions) this.hatadyStreamService?.changed('session', session.id);
		} catch { /* A committed write must not fail because its realtime hint failed. */ }
	}

	@bindThis
	public async canViewWork(work: MiHatadyMediaWork, viewerId: MiUser['id'], staffAccess = false): Promise<boolean> {
		if (work.userId === viewerId || (staffAccess && await this.hatadyService.canModerate(viewerId))) return true;
		if (await this.hatadyService.isBlockedEitherDirection(viewerId, work.userId)) return false;
		if (work.visibility === 'public') return true;
		if (work.visibility !== 'followers') return false;
		return this.hatadyFollowingsRepository.existsBy({ followerId: viewerId, followeeId: work.userId });
	}

	@bindThis
	public async getVisibleWork(workId: string, viewerId: MiUser['id'], staffAccess = false): Promise<MiHatadyMediaWork> {
		const work = await this.worksRepository.findOneBy({ id: workId });
		if (work == null || !(await this.canViewWork(work, viewerId, staffAccess))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		return work;
	}

	@bindThis
	public async getOwnedWork(workId: string, userId: MiUser['id']): Promise<MiHatadyMediaWork> {
		const work = await this.worksRepository.findOneBy({ id: workId, userId });
		if (work == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		return work;
	}

	private normalizeWork(kind: HatadyMediaWorkKind, input: HatadyMediaWorkInput, current?: MiHatadyMediaWork): QueryDeepPartialEntity<MiHatadyMediaWork> {
		assertEnum(kind, HATADY_MEDIA_WORK_KINDS, 'kind');
		const title = (input.title ?? current?.title ?? '').trim();
		if (title.length === 0 || title.length > 512) throw new Error('invalid title');
		const status = input.status ?? current?.status ?? 'planned';
		const visibility = input.visibility ?? current?.visibility ?? 'private';
		assertEnum(status, HATADY_MEDIA_WORK_STATUSES, 'status');
		if (kind !== 'game' && status === 'mastered') throw new Error('invalid status for movie');
		assertEnum(visibility, HATADY_MEDIA_VISIBILITIES, 'visibility');
		if (input.releaseDate != null) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) throw new Error('invalid releaseDate');
			const year = Number(input.releaseDate.slice(0, 4));
			if (year < 1800 || year > 3000) throw new Error('invalid releaseDate');
			const parsed = new Date(`${input.releaseDate}T00:00:00.000Z`);
			if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.releaseDate) throw new Error('invalid releaseDate');
		}
		if (input.releaseYear != null && (!Number.isInteger(input.releaseYear) || input.releaseYear < 1800 || input.releaseYear > 3000)) throw new Error('invalid releaseYear');
		// 0..10 の整数で半星単位を保持する。表示値は recommendationRating / 2。
		if (input.recommendationRating != null && (!Number.isInteger(input.recommendationRating) || input.recommendationRating < 0 || input.recommendationRating > 10)) throw new Error('invalid recommendationRating');
		if (input.coverColorIndex != null && (!Number.isInteger(input.coverColorIndex) || input.coverColorIndex < 0 || input.coverColorIndex > 100)) throw new Error('invalid coverColorIndex');
		validateHatadyMediaOfficialUrl(input.officialUrl);

		if (kind === 'movie' && GAME_FIELDS.some(key => hasStoredValue(input[key]))) throw new Error('game-only fields are not allowed for a movie');
		if (kind === 'game' && MOVIE_FIELDS.some(key => hasStoredValue(input[key]))) throw new Error('movie-only fields are not allowed for a game');
		if (input.runtimeMinutes != null && (!Number.isInteger(input.runtimeMinutes) || input.runtimeMinutes < 1 || input.runtimeMinutes > 100000)) throw new Error('invalid runtimeMinutes');
		if (input.origin != null) assertEnum(input.origin, HATADY_MOVIE_ORIGINS, 'origin');
		if (input.viewingMode != null) assertEnum(input.viewingMode, HATADY_MOVIE_VIEWING_MODES, 'viewingMode');

		return {
			title,
			originalTitle: input.originalTitle === undefined ? current?.originalTitle ?? null : normalizeOptionalString(input.originalTitle, 512, 'originalTitle'),
			creator: input.creator === undefined ? current?.creator ?? null : normalizeOptionalString(input.creator, 256, 'creator'),
			releaseDate: input.releaseDate === undefined ? current?.releaseDate ?? null : input.releaseDate,
			releaseYear: input.releaseYear === undefined ? current?.releaseYear ?? null : input.releaseYear,
			status,
			visibility,
			isFavorite: input.isFavorite ?? current?.isFavorite ?? false,
			// おすすめ表示・半星評価は映画専用。ゲームフォームの旧クライアントが 0 を送っても
			// 作成を壊さないよう拒否ではなく安全な既定値へ正規化する。
			isRecommended: input.isRecommended ?? current?.isRecommended ?? false,
			recommendationRating: input.recommendationRating === undefined ? current?.recommendationRating ?? null : input.recommendationRating,
			details: mergeHatadyDetails(current?.details, input.details, 'work') as QueryDeepPartialEntity<MiHatadyMediaWork>['details'],
			coverColorIndex: input.coverColorIndex === undefined ? current?.coverColorIndex ?? null : input.coverColorIndex,
			synopsis: input.synopsis === undefined ? current?.synopsis ?? null : normalizeOptionalString(input.synopsis, 8192, 'synopsis'),
			synopsisSpoiler: input.synopsisSpoiler ?? current?.synopsisSpoiler ?? false,
			review: input.review === undefined ? current?.review ?? null : normalizeOptionalString(input.review, 8192, 'review'),
			reviewSpoiler: input.reviewSpoiler ?? current?.reviewSpoiler ?? false,
			officialUrl: input.officialUrl === undefined ? current?.officialUrl ?? null : normalizeOptionalString(input.officialUrl, 2048, 'officialUrl'),
			runtimeMinutes: kind === 'movie' ? (input.runtimeMinutes === undefined ? current?.runtimeMinutes ?? null : input.runtimeMinutes) : null,
			genres: kind === 'movie' ? (input.genres === undefined ? current?.genres ?? [] : normalizeStringArray(input.genres, 30, 128, 'genres')) : [],
			origin: kind === 'movie' ? (input.origin === undefined ? current?.origin ?? null : input.origin) : null,
			viewingMode: kind === 'movie' ? (input.viewingMode === undefined ? current?.viewingMode ?? null : input.viewingMode) : null,
			primaryLanguage: kind === 'movie' ? (input.primaryLanguage === undefined ? current?.primaryLanguage ?? null : normalizeOptionalString(input.primaryLanguage, 128, 'primaryLanguage')) : null,
			highlights: kind === 'movie' ? (input.highlights === undefined ? current?.highlights ?? [] : normalizeStringArray(input.highlights, 50, 512, 'highlights')) : [],
			highlightsSpoiler: kind === 'movie' ? (input.highlightsSpoiler ?? current?.highlightsSpoiler ?? false) : false,
			platforms: kind === 'game' ? (input.platforms === undefined ? current?.platforms ?? [] : normalizeStringArray(input.platforms, 30, 128, 'platforms')) : [],
			developer: kind === 'game' ? (input.developer === undefined ? current?.developer ?? null : normalizeOptionalString(input.developer, 256, 'developer')) : null,
			publisher: kind === 'game' ? (input.publisher === undefined ? current?.publisher ?? null : normalizeOptionalString(input.publisher, 256, 'publisher')) : null,
		};
	}

	@bindThis
	public async createWork(user: MiUser, kind: HatadyMediaWorkKind, input: HatadyMediaWorkInput): Promise<MiHatadyMediaWork> {
		const values = this.normalizeWork(kind, input);
		const now = new Date();
		const id = this.idService.gen(now.getTime());
		const entity = { ...values, id, createdAt: now, updatedAt: now, userId: user.id, kind };
		if (kind !== 'game') return this.worksRepository.insertOne(entity);

		const policies = await this.roleService.getUserPolicies(user.id);
		return this.db.transaction(async manager => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatady-media-game:${user.id}`]);
			const repo = manager.getRepository(MiHatadyMediaWork);
			const count = await repo.countBy({ userId: user.id, kind: 'game' });
			if (count >= policies.hatadyGameTitleLimit) throw new Error(HatadyMediaService.ERR_GAME_TITLE_LIMIT);
			await repo.insert(entity);
			return repo.findOneByOrFail({ id: entity.id });
		});
	}

	@bindThis
	public async updateWork(userId: string, workId: string, input: HatadyMediaWorkInput): Promise<MiHatadyMediaWork> {
		await this.db.transaction(async manager => {
			const locked = await manager.getRepository(MiHatadyMediaWork).findOne({ where: { id: workId, userId }, lock: { mode: 'pessimistic_write' } });
			if (locked == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			const patch = this.normalizeWork(locked.kind, { ...input, title: input.title ?? locked.title }, locked);
			await manager.getRepository(MiHatadyMediaWork).update({ id: workId, userId }, { ...patch, updatedAt: new Date() });
		});
		const work = await this.getOwnedWork(workId, userId);
		await this.publishWorkSessions(workId);
		const sessions = await this.sessionsRepository.findBy({ workId });
		const sources = await this.db.getRepository(MiHatadyNotification).findBy([
			{ mediaWorkId: workId },
			...(sessions.length > 0 ? [{ mediaSessionId: In(sessions.map(session => session.id)) }] : []),
		]);
		await this.hatadyService.refreshHatadyNotificationRows(sources);
		return work;
	}

	@bindThis
	public async deleteWork(userId: string, workId: string): Promise<void> {
		let sessions: MiHatadyMediaSession[] = [];
		let sources: MiHatadyNotification[] = [];
		await this.db.transaction(async manager => {
			const owned = await manager.getRepository(MiHatadyMediaWork).findOne({ where: { id: workId, userId }, lock: { mode: 'pessimistic_write' } });
			if (owned == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			sessions = await manager.getRepository(MiHatadyMediaSession).findBy({ workId });
			sources = await manager.getRepository(MiHatadyNotification).findBy([
				{ mediaWorkId: workId },
				...(sessions.length > 0 ? [{ mediaSessionId: In(sessions.map(session => session.id)) }] : []),
			]);
			await manager.getRepository(MiHatadyMediaWork).delete({ id: workId, userId });
		});
		for (const session of sessions) this.hatadyStreamService?.changed('session', session.id);
		await this.hatadyService.refreshHatadyNotificationRows(sources);
	}

	@bindThis
	public async listWorks(viewerId: string, targetUserId: string, options: {
		staffAccess?: boolean;
		scope?: 'mine' | 'recent' | 'public' | 'following' | 'all';
		kind?: HatadyMediaWorkKind;
		status?: HatadyMediaWorkStatus;
		origin?: HatadyMovieOrigin;
		viewingMode?: HatadyMovieViewingMode;
		isRecommended?: boolean;
		minRecommendation?: number;
		sort?: 'createdAt' | 'updatedAt' | 'title' | 'releaseDate' | 'releaseYear' | 'status' | 'recommendationRating';
		order?: 'asc' | 'desc';
		query?: string;
		untilId?: string;
		limit: number;
	} & HatadyMediaSessionWorkFilters): Promise<MiHatadyMediaWork[]> {
		const qb = this.worksRepository.createQueryBuilder('work');
		const scope = options.scope;
		const staffAccess = (scope === 'all' || options.staffAccess === true) && await this.hatadyService.canModerate(viewerId);
		if (scope === 'all') {
			if (!(await this.hatadyService.canModerate(viewerId))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			qb.where('1 = 1');
		} else if (scope === 'recent' || scope === 'public') qb.where('work.visibility = \'public\'');
		else if (scope === 'following') qb.where('work.visibility IN (\'public\', \'followers\') AND EXISTS (SELECT 1 FROM "hatady_following" f WHERE f."followerId" = :viewerId AND f."followeeId" = work."userId")', { viewerId });
		else {
			qb.where('work.userId = :targetUserId', { targetUserId: scope === 'mine' ? viewerId : targetUserId });
			if (viewerId !== targetUserId && scope !== 'mine' && !staffAccess) qb.andWhere(await this.hatadyFollowingsRepository.existsBy({ followerId: viewerId, followeeId: targetUserId }) ? 'work.visibility IN (\'public\', \'followers\')' : 'work.visibility = \'public\'');
		}
		if (!staffAccess && scope !== 'mine') {
			const excluded = [...await this.hatadyService.getTimelineExcludedUserIds(viewerId)];
			if (excluded.length) qb.andWhere('work.userId NOT IN (:...excluded)', { excluded });
		}

		if (options.kind != null) qb.andWhere('work.kind = :kind', { kind: options.kind });
		if (options.status != null) qb.andWhere('work.status = :status', { status: options.status });
		if (options.origin != null) qb.andWhere('work.origin = :origin', { origin: options.origin });
		if (options.viewingMode != null) qb.andWhere('work.viewingMode = :viewingMode', { viewingMode: options.viewingMode });
		if (options.isRecommended != null) qb.andWhere('work.isRecommended = :isRecommended', { isRecommended: options.isRecommended });
		if (options.minRecommendation != null) {
			if (!Number.isInteger(options.minRecommendation) || options.minRecommendation < 0 || options.minRecommendation > 10) throw new Error('invalid minRecommendation');
			qb.andWhere('work.recommendationRating >= :minRecommendation', { minRecommendation: options.minRecommendation });
		}
		const hasSessionFilter = options.sessionKind != null || options.result != null || options.weapon != null || options.rank != null || options.route != null || options.since != null || options.until != null;
		// セッションの details・期間は作品所有者専用の検索面に限定する。
		// 他人のセッションを検索条件として使うと、非表示本文やネタバレ内容の存在 oracle になり得る。
		if (hasSessionFilter && (viewerId !== targetUserId || (scope != null && scope !== 'mine'))) throw new Error('invalid session filters for another user');
		const since = options.since == null ? null : parseHatadyMediaDateTime(options.since, 'since');
		const until = options.until == null ? null : parseHatadyMediaDateTime(options.until, 'until');
		if (since != null && until != null && since.getTime() > until.getTime()) throw new Error('invalid session date range');
		const sessionFilter = buildHatadyMediaSessionWorkFilterCondition(options);
		if (sessionFilter != null) qb.andWhere(sessionFilter.sql, sessionFilter.params);
		if (options.query?.trim()) {
			const query = `%${sqlLikeEscape(options.query.trim())}%`;
			qb.andWhere(buildHatadyMediaWorkSearchCondition(viewerId === targetUserId && (scope == null || scope === 'mine')), { query });
		}
		const sort = options.sort ?? 'createdAt';
		const order = (options.order ?? 'desc').toUpperCase() as 'ASC' | 'DESC';
		if (options.untilId != null) {
			// cursor は現在の user/kind/status/query/visibility 条件に含まれる作品だけを認める。
			// 別フィルターのIDを使うと sort 値だけが流用され、正当な行を飛ばすページ欠落になる。
			const cursor = await qb.clone().andWhere('work.id = :cursorId', { cursorId: options.untilId }).getOne();
			if (cursor == null || !(await this.canViewWork(cursor, viewerId, staffAccess))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			const cursorValue = cursor[sort];
			const condition = buildHatadyMediaWorkCursorCondition(sort, order, cursorValue, cursor.id);
			qb.andWhere(condition.sql, condition.params);
		}
		qb.orderBy(`work.${sort}`, order, order === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST').addOrderBy('work.id', order);
		const rows = await qb.take(Math.min(100, Math.max(1, options.limit))).getMany();
		// SQL 側で絞った後にも中央認可を通し、将来の visibility 追加時の漏洩を防ぐ。
		const allowed = await Promise.all(rows.map(work => this.canViewWork(work, viewerId, staffAccess)));
		return rows.filter((_, index) => allowed[index]);
	}

	@bindThis
	public packWork(work: MiHatadyMediaWork, privateAccess = false) {
		return {
			details: packHatadyDetails(work.details, privateAccess === true),
			id: work.id,
			createdAt: work.createdAt.toISOString(),
			updatedAt: work.updatedAt.toISOString(),
			userId: work.userId,
			kind: work.kind,
			title: work.title,
			originalTitle: work.originalTitle,
			creator: work.creator,
			releaseDate: work.releaseDate,
			releaseYear: work.releaseYear,
			status: work.status,
			visibility: work.visibility,
			isFavorite: work.isFavorite,
			isRecommended: work.isRecommended,
			recommendationRating: work.recommendationRating,
			coverColorIndex: work.coverColorIndex,
			synopsis: work.synopsis,
			synopsisSpoiler: work.synopsisSpoiler,
			review: work.review,
			reviewSpoiler: work.reviewSpoiler,
			officialUrl: work.officialUrl,
			runtimeMinutes: work.runtimeMinutes,
			genres: work.genres,
			origin: work.origin,
			viewingMode: work.viewingMode,
			primaryLanguage: work.primaryLanguage,
			highlights: work.highlights,
			highlightsSpoiler: work.highlightsSpoiler,
			platforms: work.platforms,
			developer: work.developer,
			publisher: work.publisher,
		};
	}

	public async packWorks(works: MiHatadyMediaWork[], viewerId: string, staffAccess = false) {
		if (works.length === 0) return [];
		const staff = staffAccess && await this.hatadyService.canModerate(viewerId);
		const [activity, users] = await Promise.all([
			this.hatadyService.getWorkActivities(works.filter(work => work.kind === 'work').map(work => work.id), viewerId, staff),
			this.userEntityService.packMany([...new Set(works.map(work => work.userId))], { id: viewerId }, { schema: 'UserLite' }),
		]);
		const usersMap = new Map(users.map(user => [user.id, user]));
		return works.map(work => ({ ...this.packWork(work, staff || work.userId === viewerId), user: usersMap.get(work.userId) ?? null, ...(work.kind === 'work' ? { activity: activity[work.id] } : {}) }));
	}

	@bindThis
	public async showWork(workId: string, viewerId: string, staffAccess = false) {
		const staff = staffAccess && await this.hatadyService.canModerate(viewerId);
		const work = await this.getVisibleWork(workId, viewerId, staffAccess);
		const [packedWork] = await this.packWorks([work], viewerId, staffAccess);
		const reactions = await this.reactionsRepository.createQueryBuilder('reaction')
			.select('reaction.reaction', 'reaction')
			.addSelect('COUNT(*)', 'count')
			.where('reaction.workId = :workId', { workId })
			.groupBy('reaction.reaction')
			.orderBy('COUNT(*)', 'DESC')
			.getRawMany<{ reaction: string; count: string }>();
		const [mine, commentsCount] = await Promise.all([
			this.reactionsRepository.findOneBy({ userId: viewerId, workId }),
			this.commentsRepository.countBy({ workId }),
		]);
		return {
			...packedWork,
			isMine: work.userId === viewerId,
			logs: work.kind === 'work' ? await this.hatadyEntityService.packLogs(
				await this.hatadyService.getWorkLogs(work.id, viewerId, staff), { id: viewerId }, staff,
			) : [],
			activity: packedWork.activity ?? null,
			reactions: reactions.map(row => ({ reaction: row.reaction, count: Number(row.count) })),
			myReaction: mine?.reaction ?? null,
			commentsCount,
		};
	}

	public async getSessionEngagement(sessionIds: string[], viewerId: string) {
		const out = new Map<string, { reactions: { reaction: string; count: number }[]; myReaction: string | null; commentsCount: number }>();
		if (sessionIds.length === 0) return out;
		for (const id of sessionIds) out.set(id, { reactions: [], myReaction: null, commentsCount: 0 });
		const [reactions, mine, comments] = await Promise.all([
			this.reactionsRepository.createQueryBuilder('reaction').select('reaction.sessionId', 'sessionId').addSelect('reaction.reaction', 'reaction').addSelect('COUNT(*)', 'count').where('reaction.sessionId IN (:...sessionIds)', { sessionIds }).groupBy('reaction.sessionId').addGroupBy('reaction.reaction').getRawMany<{ sessionId: string; reaction: string; count: string }>(),
			this.reactionsRepository.findBy({ userId: viewerId, sessionId: In(sessionIds) }),
			this.commentsRepository.createQueryBuilder('comment').select('comment.sessionId', 'sessionId').addSelect('COUNT(*)', 'count').where('comment.sessionId IN (:...sessionIds)', { sessionIds }).groupBy('comment.sessionId').getRawMany<{ sessionId: string; count: string }>(),
		]);
		for (const row of reactions) out.get(row.sessionId)?.reactions.push({ reaction: row.reaction, count: Number(row.count) });
		for (const row of mine) { const entry = row.sessionId ? out.get(row.sessionId) : null; if (entry) entry.myReaction = row.reaction; }
		for (const row of comments) { const entry = out.get(row.sessionId); if (entry) entry.commentsCount = Number(row.count); }
		return out;
	}

	public async showSession(sessionId: string, viewerId: string, staffAccess = false) {
		const session = await this.getVisibleSession(sessionId, viewerId, staffAccess);
		const work = session.workId == null ? null : await this.worksRepository.findOneBy({ id: session.workId });
		const visibleWork = work && await this.canViewWork(work, viewerId, staffAccess) ? work : null;
		const [reactionRows, mine, commentsCount, packedWorks] = await Promise.all([
			this.reactionsRepository.createQueryBuilder('reaction').select('reaction.reaction', 'reaction').addSelect('COUNT(*)', 'count').where('reaction.sessionId = :sessionId', { sessionId }).groupBy('reaction.reaction').getRawMany<{ reaction: string; count: string }>(),
			this.reactionsRepository.findOneBy({ userId: viewerId, sessionId }),
			this.commentsRepository.countBy({ sessionId }),
			this.packWorks(visibleWork ? [visibleWork] : [], viewerId, staffAccess),
		]);
		return { session: { ...await this.packSession(session), workId: visibleWork ? session.workId : null, reactions: reactionRows.map(row => ({ reaction: row.reaction, count: Number(row.count) })), myReaction: mine?.reaction ?? null, commentsCount }, work: packedWorks[0] ?? null, isMine: session.userId === viewerId };
	}

	private normalizeSession(work: Pick<MiHatadyMediaWork, 'kind'>, kind: HatadyMediaSessionKind, input: HatadyMediaSessionInput, previous?: MiHatadyMediaSession): QueryDeepPartialEntity<MiHatadyMediaSession> {
		assertEnum(kind, HATADY_MEDIA_SESSION_KINDS, 'session kind');
		if (work.kind === 'work' || (work.kind === 'movie') !== (kind === 'movie_viewing')) throw new Error('session kind does not match work kind');
		const occurredAt = parseHatadyMediaDateTime(input.occurredAt, 'occurredAt');
		if (input.durationMinutes != null && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 2147483647)) throw new Error('invalid durationMinutes');
		const visibility = input.visibility ?? 'private';
		assertEnum(visibility, HATADY_MEDIA_VISIBILITIES, 'visibility');
		// 作品と記録の公開範囲は独立。閲覧時は作品の認可を別に確認してpackする。
		return {
			kind,
			occurredAt,
			durationSeconds: normalizeHatadyDuration(input, previous),
			durationMinutes: input.durationSeconds !== undefined ? (input.durationSeconds === null ? null : Math.floor(input.durationSeconds / 60)) : input.durationMinutes === undefined ? previous?.durationMinutes ?? null : input.durationMinutes,
			startedAt: input.startedAt === undefined ? previous?.startedAt ?? null : normalizeHatadyStartedAt(input.startedAt),
			tags: normalizeHatadyTags(input.tags, previous?.tags ?? []),
			note: normalizeOptionalString(input.note, 8192, 'note'),
			noteSpoiler: input.noteSpoiler ?? false,
			visibility,
			details: validateHatadyMediaSessionDetails(kind, input.details, previous?.details) as QueryDeepPartialEntity<MiHatadyMediaSession>['details'],
		};
	}

	@bindThis
	public async createSession(userId: string, workId: string, kind: HatadyMediaSessionKind, input: HatadyMediaSessionInput): Promise<MiHatadyMediaSession & { flowerReward: FlowerReward }> {
		const now = new Date();
		const id = this.idService.gen(now.getTime());
		const session = await this.db.transaction(async manager => {
			const work = await manager.getRepository(MiHatadyMediaWork).findOne({ where: { id: workId, userId }, lock: { mode: 'pessimistic_write' } });
			if (work == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			const values = this.normalizeSession(work, kind, input);
			values.fileIds = await this.hatadyAttachmentService.validate(userId, input.fileIds ?? [], [], manager);
			if (input.tags?.includes('recommend')) await manager.getRepository(MiHatadyMediaWork).update({ id: workId, userId }, { isRecommended: true });
			await manager.getRepository(MiHatadyMediaSession).insert({ id, createdAt: now, updatedAt: now, userId, workId, ...values, workSnapshot: this.snapshotWork(work) as QueryDeepPartialEntity<MiHatadyMediaSession>['workSnapshot'] });
			const flowerReward = await this.flowerService.onHatadyCreated(manager, userId, id);
			return Object.assign(await manager.getRepository(MiHatadyMediaSession).findOneByOrFail({ id, userId }), { flowerReward });
		});
		// 旗鯖fork(Hatady次期: ゲーム/映画記録): 映画・ゲームの記録も連続記録に数えるため、
		//   学習ログ作成時と同じ節目通知の判定をここでも行う。
		this.hatadyStreamService?.changed('session', session.id);
		await this.hatadyService.notifyMilestoneIfReached(userId);
		return session;
	}

	@bindThis
	public async listSessions(viewerId: string, options: { workId?: string; untilId?: string; limit: number; staffAccess?: boolean }): Promise<MiHatadyMediaSession[]> {
		const staffAccess = options.staffAccess === true && await this.hatadyService.canModerate(viewerId);
		const qb = this.sessionsRepository.createQueryBuilder('session');
		let visibleWork: MiHatadyMediaWork | null = null;
		if (options.workId == null) {
			// workId 無しは本人のエクスポート専用。別ユーザーを指定する入口を持たない。
			qb.where('session.userId = :viewerId', { viewerId });
		} else {
			const work = await this.getVisibleWork(options.workId, viewerId, staffAccess);
			visibleWork = work;
			qb.where('session.workId = :workId', { workId: work.id });
			if (work.userId !== viewerId && !staffAccess) {
				const isFollower = await this.hatadyFollowingsRepository.existsBy({ followerId: viewerId, followeeId: work.userId });
				qb.andWhere(isFollower ? 'session.visibility IN (\'public\', \'followers\')' : 'session.visibility = \'public\'');
			}
		}
		if (options.untilId != null) {
			const cursor = options.workId == null
				? await this.sessionsRepository.findOneBy({ id: options.untilId, userId: viewerId })
				: await this.sessionsRepository.findOneBy({ id: options.untilId, workId: options.workId });
			if (cursor == null || (visibleWork != null && !(await this.canViewSession(cursor, visibleWork, viewerId, staffAccess)))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			qb.andWhere('session.id < :untilId', { untilId: options.untilId });
		}
		const sessions = await qb.orderBy('session.id', 'DESC').take(Math.min(100, Math.max(1, options.limit))).getMany();
		if (options.workId == null) return sessions;
		const work = visibleWork ?? await this.getVisibleWork(options.workId, viewerId, staffAccess);
		const allowed = await Promise.all(sessions.map(session => this.canViewSession(session, work, viewerId, staffAccess)));
		return sessions.filter((_, index) => allowed[index]);
	}

	@bindThis
	public snapshotWork(work: MiHatadyMediaWork): Record<string, unknown> {
		return { title: work.title, kind: work.kind, creator: work.creator, genre: typeof work.details?.genre === 'string' ? work.details.genre : work.genres?.[0] ?? '' };
	}

	public async canViewSession(session: MiHatadyMediaSession, _work: MiHatadyMediaWork | null, viewerId: string, staffAccess = false): Promise<boolean> {
		if (session.userId === viewerId || (staffAccess && await this.hatadyService.canModerate(viewerId))) return true;
		if (await this.hatadyService.isBlockedEitherDirection(session.userId, viewerId)) return false;
		if (session.visibility === 'public') return true;
		return session.visibility === 'followers' && this.hatadyFollowingsRepository.existsBy({ followerId: viewerId, followeeId: session.userId });
	}

	public async getVisibleSession(sessionId: string, viewerId: string, staffAccess = false): Promise<MiHatadyMediaSession> {
		const session = await this.sessionsRepository.findOneBy({ id: sessionId });
		if (session == null || !(await this.canViewSession(session, null, viewerId, staffAccess))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		return session;
	}

	@bindThis
	public async updateSession(userId: string, sessionId: string, input: Partial<HatadyMediaSessionInput>): Promise<MiHatadyMediaSession> {
		await this.db.transaction(async manager => {
			const repo = manager.getRepository(MiHatadyMediaSession);
			const session = await repo.findOne({ where: { id: sessionId, userId }, lock: { mode: 'pessimistic_write' } });
			if (session == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			const work = session.workId == null ? null : await manager.getRepository(MiHatadyMediaWork).findOneBy({ id: session.workId, userId });
			const values = this.normalizeSession(work ?? { kind: session.kind === 'movie_viewing' ? 'movie' : 'game' }, session.kind, {
				...input,
				occurredAt: input.occurredAt ?? session.occurredAt.toISOString(),
				note: input.note === undefined ? session.note : input.note,
				noteSpoiler: input.noteSpoiler ?? session.noteSpoiler,
				visibility: input.visibility ?? session.visibility,
			}, session);
			if (input.fileIds !== undefined) values.fileIds = await this.hatadyAttachmentService.validate(userId, input.fileIds, session.fileIds ?? [], manager);
			await repo.update({ id: sessionId, userId }, { ...values, updatedAt: new Date() });
			if (work && input.tags?.includes('recommend')) await manager.getRepository(MiHatadyMediaWork).update({ id: work.id, userId }, { isRecommended: true });
		});
		const updated = await this.sessionsRepository.findOneByOrFail({ id: sessionId, userId });
		this.hatadyStreamService?.changed('session', sessionId);
		await this.hatadyService.refreshHatadyNotificationRows(await this.db.getRepository(MiHatadyNotification).findBy({ mediaSessionId: sessionId }));
		return updated;
	}

	@bindThis
	public async deleteSession(userId: string, sessionId: string): Promise<void> {
		let sources: MiHatadyNotification[] = [];
		await this.db.transaction(async manager => {
			const session = await manager.getRepository(MiHatadyMediaSession).findOne({ where: { id: sessionId, userId }, lock: { mode: 'pessimistic_write' } });
			if (session == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			sources = await manager.getRepository(MiHatadyNotification).findBy({ mediaSessionId: sessionId });
			await manager.getRepository(MiHatadyMediaSession).delete({ id: sessionId, userId });
		});
		this.hatadyStreamService?.changed('session', sessionId);
		await this.hatadyService.refreshHatadyNotificationRows(sources);
	}

	@bindThis
	public async packSession(session: MiHatadyMediaSession) {
		return (await this.packSessions([session]))[0];
	}

	@bindThis
	public async packSessions(sessions: MiHatadyMediaSession[]) {
		const files = await this.hatadyAttachmentService.packRecords(sessions);
		return sessions.map(session => ({
			id: session.id,
			createdAt: session.createdAt.toISOString(),
			updatedAt: session.updatedAt.toISOString(),
			userId: session.userId,
			workId: session.workId,
			kind: session.kind,
			occurredAt: session.occurredAt.toISOString(),
			durationMinutes: session.durationMinutes,
			durationSeconds: normalizeHatadyDuration({}, session),
			startedAt: session.startedAt ?? null,
			tags: session.tags ?? [],
			workSnapshot: session.workSnapshot ?? {},
			fileIds: session.fileIds ?? [],
			files: files.get(session.id) ?? [],
			note: session.note,
			noteSpoiler: session.noteSpoiler,
			visibility: session.visibility,
			details: session.details,
		}));
	}

	@bindThis
	public async listComments(viewerId: string, workId: string | undefined, untilId: string | undefined, limit: number, sessionId?: string, staffAccess = false) {
		if (!!workId === !!sessionId) throw new Error('invalid comment target');
		if (sessionId) await this.getVisibleSession(sessionId, viewerId, staffAccess);
		else await this.getVisibleWork(workId!, viewerId, staffAccess);
		const target = sessionId ? { sessionId } : { workId: workId! };
		const qb = this.commentsRepository.createQueryBuilder('comment').where(sessionId ? 'comment.sessionId = :sessionId' : 'comment.workId = :workId', target);
		if (untilId != null) {
			if (!(await this.commentsRepository.existsBy({ id: untilId, ...target }))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			qb.andWhere('comment.id < :untilId', { untilId });
		}
		const comments = await qb.orderBy('comment.id', 'DESC').take(Math.min(100, Math.max(1, limit))).getMany();
		comments.reverse();
		const allowed = await Promise.all(comments.map(comment => this.hatadyService.canAppearInTimeline(comment.userId, viewerId)));
		return this.packComments(comments.filter((_, index) => allowed[index]), viewerId);
	}

	@bindThis
	public async createComment(userId: string, workId: string | null, replyId: string | null, text: string, spoiler: boolean, sessionId?: string) {
		if (!!workId === !!sessionId) throw new Error('invalid comment target');
		const normalized = text.trim();
		if (normalized.length === 0 || normalized.length > 2048) throw new Error('invalid comment');
		const now = new Date();
		const commentId = this.idService.gen(now.getTime());
		const mirrors: HatadyMirrorNotification[] = [];
		const comment = await this.db.transaction(async manager => {
			const target = await this.resolveReactionTarget(manager, userId, sessionId ? 'session' : 'work', sessionId ?? workId!);
			const where = sessionId ? { sessionId } : { workId: workId! };
			let parent: MiHatadyMediaComment | null = null;
			if (replyId != null) {
				parent = await manager.getRepository(MiHatadyMediaComment).findOneBy({ id: replyId, ...where });
				if (parent == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			}
			await manager.getRepository(MiHatadyMediaComment).insert({ id: commentId, createdAt: now, updatedAt: now, workId: workId ?? null, sessionId: sessionId ?? null, userId, replyId, text: normalized, spoiler, reactionsCount: 0 });
			const recipients = new Set([target.ownerId, ...(parent ? [parent.userId] : [])]);
			for (const notifieeId of recipients) {
				const push = await this.insertMediaNotification(manager, { notifieeId, notifierId: userId, type: parent?.userId === notifieeId ? 'mediaReply' : 'mediaComment', mediaWorkId: workId, mediaSessionId: sessionId, mediaCommentId: commentId });
				if (push) mirrors.push(push);
			}
			return manager.getRepository(MiHatadyMediaComment).findOneByOrFail({ id: commentId });
		});
		if (sessionId) this.hatadyStreamService?.changed('session', sessionId);
		else if (workId) await this.publishWorkSessions(workId);
		await Promise.all(mirrors.map(record => this.hatadyService.mirrorHatadyNotification(record)));
		return this.packComment(comment, userId);
	}

	@bindThis
	public async updateComment(userId: string, commentId: string, text: string, spoiler: boolean) {
		const comment = await this.commentsRepository.findOneBy({ id: commentId, userId });
		if (comment == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		// 投稿者本人は、親作品の公開範囲が後から変わっても本文の訂正・撤回ができる。
		const normalized = text.trim();
		if (normalized.length === 0 || normalized.length > 2048) throw new Error('invalid comment');
		await this.commentsRepository.update({ id: commentId, userId }, { text: normalized, spoiler, updatedAt: new Date() });
		return this.packComment(await this.commentsRepository.findOneByOrFail({ id: commentId, userId }), userId);
	}

	@bindThis
	public async deleteComment(userId: string, commentId: string): Promise<void> {
		let comment: MiHatadyMediaComment | null = null;
		let sources: MiHatadyNotification[] = [];
		await this.db.transaction(async manager => {
			comment = await manager.getRepository(MiHatadyMediaComment).findOne({ where: { id: commentId, userId }, lock: { mode: 'pessimistic_write' } });
			if (comment == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			sources = await manager.getRepository(MiHatadyNotification).findBy({ mediaCommentId: commentId });
			await manager.getRepository(MiHatadyMediaComment).delete({ id: commentId, userId });
		});
		const deleted = comment as MiHatadyMediaComment | null;
		if (deleted == null) return;
		if (deleted.sessionId) this.hatadyStreamService?.changed('session', deleted.sessionId);
		else if (deleted.workId) await this.publishWorkSessions(deleted.workId);
		await this.hatadyService.refreshHatadyNotificationRows(sources);
	}

	private async packComment(comment: MiHatadyMediaComment, viewerId: string) {
		return (await this.packComments([comment], viewerId))[0]!;
	}

	private async packComments(comments: MiHatadyMediaComment[], viewerId: string) {
		if (comments.length === 0) return [];
		const userIds = [...new Set(comments.map(comment => comment.userId))];
		const [users, reactionRows] = await Promise.all([
			this.userEntityService.packMany(userIds),
			this.reactionsRepository.createQueryBuilder('reaction')
				.where('reaction.commentId IN (:...commentIds)', { commentIds: comments.map(comment => comment.id) })
				.getMany(),
		]);
		const usersMap = new Map(users.map(user => [user.id, user]));
		const reactionsMap = new Map<string, { counts: Map<string, number>; mine: string | null }>();
		for (const reaction of reactionRows) {
			if (reaction.commentId == null) continue;
			const entry = reactionsMap.get(reaction.commentId) ?? { counts: new Map<string, number>(), mine: null };
			entry.counts.set(reaction.reaction, (entry.counts.get(reaction.reaction) ?? 0) + 1);
			if (reaction.userId === viewerId) entry.mine = reaction.reaction;
			reactionsMap.set(reaction.commentId, entry);
		}
		return comments.map(comment => {
			const reactions = reactionsMap.get(comment.id) ?? { counts: new Map<string, number>(), mine: null };
			return {
				id: comment.id,
				createdAt: comment.createdAt.toISOString(),
				updatedAt: comment.updatedAt.toISOString(),
				workId: comment.workId,
				sessionId: comment.sessionId,
				userId: comment.userId,
				user: usersMap.get(comment.userId) ?? null,
				replyId: comment.replyId,
				text: comment.text,
				spoiler: comment.spoiler,
				reactionsCount: comment.reactionsCount,
				reactions: [...reactions.counts].map(([reaction, count]) => ({ reaction, count })),
				myReaction: reactions.mine,
			};
		});
	}

	private async resolveReactionTarget(manager: EntityManager, viewerId: string, targetType: 'work' | 'session' | 'comment', targetId: string): Promise<{ ownerId: string; workId: string | null; sessionId: string | null; commentId: string | null; comment?: MiHatadyMediaComment }> {
		if (targetType === 'work') {
			const work = await manager.getRepository(MiHatadyMediaWork).findOne({ where: { id: targetId }, lock: { mode: 'pessimistic_read' } });
			if (work == null || !(await this.canViewWork(work, viewerId))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			return { ownerId: work.userId, workId: targetId, sessionId: null, commentId: null };
		}
		if (targetType === 'session') {
			const session = await manager.getRepository(MiHatadyMediaSession).findOne({ where: { id: targetId }, lock: { mode: 'pessimistic_read' } });
			if (session == null || !(await this.canViewSession(session, null, viewerId))) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
			return { ownerId: session.userId, workId: null, sessionId: session.id, commentId: null };
		}
		const ref = await manager.getRepository(MiHatadyMediaComment).findOneBy({ id: targetId });
		if (ref == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		await this.resolveReactionTarget(manager, viewerId, ref.sessionId ? 'session' : 'work', ref.sessionId ?? ref.workId!);
		const comment = await manager.getRepository(MiHatadyMediaComment).findOne({ where: { id: targetId }, lock: { mode: 'pessimistic_write' } });
		if (comment == null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
		return { ownerId: comment.userId, workId: null, sessionId: null, commentId: comment.id, comment };
	}

	@bindThis
	public async createReaction(userId: string, targetType: 'work' | 'session' | 'comment', targetId: string, reaction: string): Promise<void> {
		const normalized = reaction.trim();
		if (normalized.length === 0 || normalized.length > 260) throw new Error('invalid reaction');
		const mirrors: HatadyMirrorNotification[] = [];
		const changed = await this.db.transaction(async manager => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatady-media-reaction:${userId}:${targetType}:${targetId}`]);
			const target = await this.resolveReactionTarget(manager, userId, targetType, targetId);
			const targetIds = { workId: target.workId ?? target.comment?.workId ?? null, sessionId: target.sessionId ?? target.comment?.sessionId ?? null };
			const repo = manager.getRepository(MiHatadyMediaReaction);
			const existing = await repo.findOneBy(target.workId ? { userId, workId: target.workId } : target.sessionId ? { userId, sessionId: target.sessionId } : { userId, commentId: target.commentId! });
			if (existing != null) {
				if (existing.reaction === normalized) return targetIds;
				await repo.update(existing.id, { reaction: normalized, createdAt: new Date() });
				const push = await this.insertMediaNotification(manager, {
					notifieeId: target.ownerId,
					notifierId: userId,
					type: 'mediaReaction',
					mediaWorkId: target.workId ?? target.comment?.workId ?? null,
					mediaSessionId: target.sessionId ?? target.comment?.sessionId ?? null,
					mediaCommentId: target.comment?.id ?? null,
					reaction: normalized,
				});
				if (push) mirrors.push(push);
				return targetIds;
			}
			const now = new Date();
			await repo.insert({ id: this.idService.gen(now.getTime()), createdAt: now, userId, workId: target.workId, sessionId: target.sessionId, commentId: target.commentId, reaction: normalized });
			if (target.commentId != null) await manager.increment(MiHatadyMediaComment, { id: target.commentId }, 'reactionsCount', 1);
			const push = await this.insertMediaNotification(manager, {
				notifieeId: target.ownerId,
				notifierId: userId,
				type: 'mediaReaction',
				mediaWorkId: target.workId ?? target.comment?.workId ?? null,
				mediaSessionId: target.sessionId ?? target.comment?.sessionId ?? null,
				mediaCommentId: target.comment?.id ?? null,
				reaction: normalized,
			});
			if (push) mirrors.push(push);
			return targetIds;
		});
		if (changed?.sessionId) this.hatadyStreamService?.changed('session', changed.sessionId);
		else if (changed?.workId) await this.publishWorkSessions(changed.workId);
		await Promise.all(mirrors.map(record => this.hatadyService.mirrorHatadyNotification(record)));
	}

	@bindThis
	public async deleteReaction(userId: string, targetType: 'work' | 'session' | 'comment', targetId: string): Promise<void> {
		// 非公開化・Hatadyフォロー解除後も、自分が付けたリアクションは撤回できる。
		// 本人の行だけをキーにして冪等削除し、対象の存在や公開範囲はレスポンスへ漏らさない。
		const changed = await this.db.transaction(async manager => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatady-media-reaction:${userId}:${targetType}:${targetId}`]);
			const repo = manager.getRepository(MiHatadyMediaReaction);
			const reaction = await repo.findOneBy(targetType === 'work' ? { userId, workId: targetId } : targetType === 'session' ? { userId, sessionId: targetId } : { userId, commentId: targetId });
			if (reaction == null) return null;
			let targetIds: { workId: string | null; sessionId: string | null };
			if (reaction.commentId) {
				const comment = await manager.getRepository(MiHatadyMediaComment).findOneBy({ id: reaction.commentId });
				targetIds = { workId: comment?.workId ?? null, sessionId: comment?.sessionId ?? null };
			} else targetIds = { workId: reaction.workId, sessionId: reaction.sessionId };
			await repo.delete(reaction.id);
			if (reaction.commentId != null) {
				await manager.query('UPDATE "hatady_media_comment" SET "reactionsCount" = GREATEST(0, "reactionsCount" - 1) WHERE "id" = $1', [reaction.commentId]);
			}
			return targetIds;
		});
		if (changed?.sessionId) this.hatadyStreamService?.changed('session', changed.sessionId);
		else if (changed?.workId) await this.publishWorkSessions(changed.workId);
	}

	private async insertMediaNotification(manager: EntityManager, params: {
		notifieeId: string;
		notifierId: string;
		type: 'mediaComment' | 'mediaReply' | 'mediaReaction';
		mediaWorkId: string | null;
		mediaSessionId?: string | null;
		mediaCommentId?: string | null;
		reaction?: string | null;
	}): Promise<HatadyMirrorNotification | null> {
		if (params.notifieeId === params.notifierId) return null;
		const now = new Date();
		const notificationId = this.idService.gen(now.getTime());
		await manager.getRepository(MiHatadyNotification).insert({
			id: notificationId,
			createdAt: now,
			notifieeId: params.notifieeId,
			notifierId: params.notifierId,
			type: params.type,
			logId: null,
			commentId: null,
			mediaWorkId: params.mediaWorkId,
			mediaSessionId: params.mediaSessionId ?? null,
			mediaCommentId: params.mediaCommentId ?? null,
			reaction: params.reaction ?? null,
			value: null,
			isRead: false,
		});
		return {
			userId: params.notifieeId,
			notifierId: params.notifierId,
			sourceNotificationId: notificationId,
			subtype: params.type,
			targetType: params.mediaCommentId ? 'mediaComment' : params.mediaSessionId ? 'session' : params.mediaWorkId ? 'work' : 'none',
			targetId: params.mediaCommentId ?? params.mediaSessionId ?? params.mediaWorkId ?? null,
		};
	}
}
