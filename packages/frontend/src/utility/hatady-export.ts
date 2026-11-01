/*
 * 旗鯖fork(Hatady P5): 学習記録を人間可読な .txt にエクスポートする。
 *   既存の hata/hatady/logs (sinceDate/untilDate + untilId ページング) をループ取得し、
 *   日付見出しごとに整形。冒頭にサマリ(期間/総時間/件数/連続)を付与して Blob ダウンロード。
 * 旗鯖fork(Hatady media): 映画・ゲームの作品/記録は、将来の読込拡張に備えた版付き JSON
 *   として別に書き出す。学習時間へ混ぜず、保存済みの言語非依存 enum と公開範囲を維持する。
 *   現時点では書き出し専用で、読込UIは提供しない。
 */
import { versatileLang } from '@@/js/intl-const.js';
import type { HatadyLogKind } from '@/utility/hatady-media.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyTzOffset } from '@/utility/hatady-prefs.js';
import { requireHatadyActivityPage } from '@/utility/hatady-media.js';
import { collectActivityPages, collectWorkPages } from '@/utility/hatady-home.js';
import { HATADY_ACTIVITY_CHOICES, hatadyDuration, hatadySeconds } from '@/utility/hatady-ui.js';

const MAX_PAGES = 50; // 100件×50 = 上限5000件(暴走防止)

export const HATADY_MEDIA_EXPORT_FORMAT = 'hatady-media' as const;
export const HATADY_MEDIA_EXPORT_VERSION = 1 as const;
export const HATADY_MEDIA_EXPORT_LIMIT_ERROR = 'HATADY_MEDIA_EXPORT_LIMIT_EXCEEDED' as const;
export const HATADY_MEDIA_EXPORT_INVALID_RESPONSE = 'HATADY_MEDIA_EXPORT_INVALID_RESPONSE' as const;
export const HATADY_MEDIA_EXPORT_CURSOR_STALLED = 'HATADY_MEDIA_EXPORT_CURSOR_STALLED' as const;

export type HatadyMediaExportArchive = {
	format: typeof HATADY_MEDIA_EXPORT_FORMAT;
	formatVersion: typeof HATADY_MEDIA_EXPORT_VERSION;
	serverVersion: string;
	exportedAt: string;
	timezone: string;
	works: unknown[];
	sessions: unknown[];
};

export function buildHatadyMediaExportArchive(
	works: unknown[],
	sessions: unknown[],
	opts?: { now?: Date; serverVersion?: string; timezone?: string },
): HatadyMediaExportArchive {
	const now = opts?.now ?? new Date();
	return {
		format: HATADY_MEDIA_EXPORT_FORMAT,
		formatVersion: HATADY_MEDIA_EXPORT_VERSION,
		serverVersion: opts?.serverVersion ?? (typeof _VERSION_ === 'string' ? _VERSION_ : 'unknown'),
		exportedAt: now.toISOString(),
		timezone: opts?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
		works,
		sessions,
	};
}

export type HatadyMediaExportKind = 'movie' | 'game';
export type HatadyMediaExportFormat = 'json' | 'txt';

/**
 * 書き出す範囲。
 * ⚠️期間は記録(occurredAt)に効かせる。作品そのものは日付を持たないため、
 *   期間を指定したときは「その期間に記録があった作品」だけを残す。
 *   指定しないときは、記録のない作品も含めて全部残す(作品一覧として使えるように)。
 * ⚠️kinds が空配列なら「すべての種別」を意味する。
 */
export type HatadyMediaExportFilter = {
	since: number | null;
	/** 日の始まり(ms)。この関数の中で日末まで含める。 */
	until: number | null;
	kinds: readonly HatadyMediaExportKind[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
	return value != null && typeof value === 'object' ? (value as AnyRecord) : null;
}

/**
 * 作品と記録を、種別と期間で絞る。
 * ⚠️絞ったあとも作品と記録の対応が壊れないようにする(記録だけ残って作品が無い状態を作らない)。
 */
export function filterHatadyMediaForExport(
	works: readonly unknown[],
	sessions: readonly unknown[],
	filter: HatadyMediaExportFilter,
): { works: unknown[]; sessions: unknown[] } {
	const kinds = filter.kinds.length > 0 ? new Set<string>(filter.kinds) : null;
	const until = filter.until != null ? filter.until + DAY_MS - 1 : null;
	const hasPeriod = filter.since != null || filter.until != null;

	const workById = new Map<string, AnyRecord>();
	for (const raw of works) {
		const work = asRecord(raw);
		if (work && typeof work.id === 'string') workById.set(work.id, work);
	}

	const keptSessions = sessions.filter((raw) => {
		const session = asRecord(raw);
		if (!session) return false;
		const work = typeof session.workId === 'string' ? workById.get(session.workId) : undefined;
		const snapshot = asRecord(session.workSnapshot);
		const kind =
			work?.kind ??
			snapshot?.kind ??
			(session.kind === 'movie_viewing'
				? 'movie'
				: typeof session.kind === 'string' && session.kind.startsWith('game_')
					? 'game'
					: null);
		if (kinds && !(typeof kind === 'string' && kinds.has(kind))) return false;
		if (!hasPeriod) return true;
		// ⚠️期間を指定したときだけ、日時が壊れている記録を落とす。
		//   指定していないなら落とさない(書き出しから黙って消えるのを避ける)。
		const at = Date.parse(String(session.occurredAt ?? ''));
		if (!Number.isFinite(at)) return false;
		if (filter.since != null && at < filter.since) return false;
		if (until != null && at > until) return false;
		return true;
	});

	const referenced = new Set<string>();
	for (const raw of keptSessions) {
		const session = asRecord(raw);
		if (session && typeof session.workId === 'string') referenced.add(session.workId);
	}

	const keptWorks = works.filter((raw) => {
		const work = asRecord(raw);
		if (!work) return false;
		if (kinds && !(typeof work.kind === 'string' && kinds.has(work.kind))) return false;
		if (!hasPeriod) return true;
		return typeof work.id === 'string' && referenced.has(work.id);
	});

	return { works: keptWorks, sessions: keptSessions };
}

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}

function ymdKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fileStamp(d: Date): string {
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

const dateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: '2-digit', day: '2-digit' });
const weekdayFormatter = new Intl.DateTimeFormat(versatileLang, { weekday: 'short' });

/**
 * 期間内の学習ログを取得して .txt をダウンロードする。
 * @param opts.sinceDate / untilDate  ms epoch(端は含む)。null で無制限。
 */
export async function exportHatadyLogs(opts: {
	sinceDate: number | null;
	untilDate: number | null;
}): Promise<{ count: number }> {
	// untilDate はその日の終わりまで含める。
	const untilDate = opts.untilDate != null ? opts.untilDate + (24 * 60 * 60 * 1000 - 1) : null;

	// Stable (occurredAt,id,source) cursors retain more than 100 entries at the same timestamp.
	const activities = await collectActivityPages(async (cursor) =>
		requireHatadyActivityPage(
			await misskeyApi(
				'hata/hatady/activities' as never,
				{
					scope: 'mine',
					kinds: ['study'],
					limit: 100,
					sinceDate: opts.sinceDate ?? undefined,
					untilDate: untilDate ?? undefined,
					...(cursor ? { cursor } : {}),
				} as never,
			),
		),
	);
	const logs: any[] = activities.map((activity) => activity.study!);

	const stats: any = await misskeyApi('hata/hatady/stats', { tzOffset: hatadyTzOffset() }).catch(() => null);

	// 古い順に並べ、日付でグルーピング。
	logs.sort((a, b) => new Date(a.studiedAt).getTime() - new Date(b.studiedAt).getTime());
	const byDay = new Map<string, any[]>();
	let totalSeconds = 0;
	for (const log of logs) {
		totalSeconds += hatadySeconds(log) ?? 0;
		const d = new Date(log.studiedAt);
		const k = ymdKey(d);
		if (!byDay.has(k)) byDay.set(k, []);
		byDay.get(k)!.push(log);
	}

	// ===== 整形 =====
	const now = new Date();
	const copy = i18n.ts._hata._hatady._exportText;
	const tx = i18n.tsx._hata._hatady._exportText;
	const lines: string[] = [];
	lines.push(copy.title);
	const periodStr =
		opts.sinceDate != null || opts.untilDate != null
			? tx.periodRange({
				from: opts.sinceDate != null ? dateFormatter.format(new Date(opts.sinceDate)) : '—',
				to: opts.untilDate != null ? dateFormatter.format(new Date(opts.untilDate)) : '—',
			})
			: copy.all;
	lines.push(tx.periodLine({ period: periodStr }));
	lines.push(
		tx.exportedLine({ date: dateFormatter.format(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` }),
	);
	lines.push(tx.summaryLine({ duration: hatadyDuration(totalSeconds), count: logs.length }));
	if (stats) {
		lines.push(tx.streakLine({ days: stats.streakDays ?? 0 }));
	}
	lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	lines.push('');

	if (logs.length === 0) {
		lines.push(copy.empty);
	} else {
		const dayKeys = [...byDay.keys()].sort();
		for (const k of dayKeys) {
			const items = byDay.get(k)!;
			const d = new Date(items[0].studiedAt);
			const daySeconds = items.reduce((s, x) => s + (hatadySeconds(x) ?? 0), 0);
			lines.push(
				tx.dayLine({
					date: dateFormatter.format(d),
					weekday: weekdayFormatter.format(d),
					count: items.length,
					duration: hatadyDuration(daySeconds),
				}),
			);
			for (const log of items) {
				const time = `${pad(new Date(log.studiedAt).getHours())}:${pad(new Date(log.studiedAt).getMinutes())}`;
				const subj = log.subject ? `[${log.subject}] ` : '';
				lines.push(
					tx.logLine({ time, subject: subj, title: log.title ?? '', duration: hatadyDuration(hatadySeconds(log)) }),
				);
				if (log.book?.title) {
					const pages = log.pageFrom != null && log.pageTo != null ? ` p.${log.pageFrom} → p.${log.pageTo}` : '';
					lines.push(
						tx.bookLine({ book: `${log.book.title}${log.book.author ? ' / ' + log.book.author : ''}${pages}` }),
					);
				}
				if (log.body) {
					// メモは複数行対応(各行をインデント)。
					for (const bl of String(log.body).split('\n')) lines.push(`\u3000${bl}`);
				}
			}
			lines.push('');
		}
	}

	const text = lines.join('\r\n');
	const fromStamp = opts.sinceDate != null ? fileStamp(new Date(opts.sinceDate)) : 'all';
	const toStamp = opts.untilDate != null ? fileStamp(new Date(opts.untilDate)) : fileStamp(now);
	const filename = `hatady_${fromStamp}-${toStamp}.txt`;

	// Blob ダウンロード。
	const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = window.document.createElement('a');
	a.href = url;
	a.download = filename;
	window.document.body.appendChild(a);
	a.click();
	window.document.body.removeChild(a);
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);

	return { count: logs.length };
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = window.document.createElement('a');
	a.href = url;
	a.download = filename;
	window.document.body.appendChild(a);
	a.click();
	window.document.body.removeChild(a);
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function asItems(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (value != null && typeof value === 'object') {
		const items = (value as { items?: unknown }).items;
		if (Array.isArray(items)) return items;
	}
	throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
}

export async function fetchMediaPages(
	endpoint: 'hata/hatady/media/works/list' | 'hata/hatady/media/sessions/list',
): Promise<unknown[]> {
	const all: unknown[] = [];
	const seen = new Set<string>();
	let untilId: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const response = await misskeyApi(endpoint, { limit: 100, untilId });
		const items = asItems(response);
		if (items.length === 0) break;
		if (items.length > 100) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
		for (const item of items) {
			if (item == null || typeof item !== 'object') throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
			const itemId = (item as { id?: unknown }).id;
			if (typeof itemId !== 'string' || itemId.length === 0) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
			if (seen.has(itemId)) throw new Error(HATADY_MEDIA_EXPORT_CURSOR_STALLED);
			seen.add(itemId);
			all.push(item);
		}
		if (items.length < 100) break;
		const lastId = (items.at(-1) as { id?: unknown } | undefined)?.id;
		if (typeof lastId !== 'string' || lastId.length === 0) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
		if (lastId === untilId) throw new Error(HATADY_MEDIA_EXPORT_CURSOR_STALLED);
		untilId = lastId;
		if (page === MAX_PAGES - 1) {
			const probeResponse = await misskeyApi(endpoint, { limit: 1, untilId });
			if (asItems(probeResponse).length > 0) throw new Error(HATADY_MEDIA_EXPORT_LIMIT_ERROR);
		}
	}
	return all;
}

function mediaCopy() {
	return i18n.ts._hata._hatady._mediaExportText;
}

function mediaTx() {
	return i18n.tsx._hata._hatady._mediaExportText;
}

function kindLabel(kind: unknown): string {
	const copy = mediaCopy();
	return kind === 'movie' ? copy.kindMovie : kind === 'game' ? copy.kindGame : copy.kindUnknown;
}

/** 状態・視聴方法などは保存済みの言語非依存 enum。⚠️表示のときだけ訳す(保存値は触らない)。 */
function enumLabel(group: 'status' | 'sessionKind', value: unknown): string {
	const copy = mediaCopy() as unknown as Record<string, string>;
	const key = `${group}_${String(value)}`;
	return copy[key] ?? String(value ?? '');
}

/**
 * 映画・ゲームの記録を人が読めるテキストへ整形する。
 * ⚠️ネタバレ扱いの本文には印を付ける。書き出したファイルを他人へ渡したときに不意に見せないため。
 */
export function buildHatadyMediaExportText(
	works: readonly unknown[],
	sessions: readonly unknown[],
	opts?: { now?: Date; periodLabel?: string; kindLabel?: string },
): string {
	const now = opts?.now ?? new Date();
	const copy = mediaCopy();
	const tx = mediaTx();
	const workById = new Map<string, AnyRecord>();
	for (const raw of works) {
		const work = asRecord(raw);
		if (work && typeof work.id === 'string') workById.set(work.id, work);
	}

	const rows = sessions
		.map((raw) => asRecord(raw))
		.filter((session): session is AnyRecord => session != null)
		.map((session) => ({ session, at: Date.parse(String(session.occurredAt ?? '')) }))
		.sort((a, b) => (Number.isFinite(a.at) ? a.at : 0) - (Number.isFinite(b.at) ? b.at : 0));

	const totalSeconds = rows.reduce((sum, r) => sum + (hatadySeconds(r.session) ?? 0), 0);

	const lines: string[] = [];
	lines.push(copy.title);
	lines.push(tx.periodLine({ period: opts?.periodLabel ?? copy.all }));
	lines.push(tx.kindLine({ kind: opts?.kindLabel ?? copy.kindAll }));
	lines.push(
		tx.exportedLine({ date: dateFormatter.format(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` }),
	);
	lines.push(tx.summaryLine({ works: works.length, sessions: rows.length, duration: hatadyDuration(totalSeconds) }));
	lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	lines.push('');

	if (rows.length === 0) {
		lines.push(copy.emptySessions);
	} else {
		const byDay = new Map<string, Array<{ session: AnyRecord; at: number }>>();
		for (const row of rows) {
			const key = Number.isFinite(row.at) ? ymdKey(new Date(row.at)) : copy.unknownDate;
			if (!byDay.has(key)) byDay.set(key, []);
			byDay.get(key)!.push(row);
		}
		for (const [key, items] of byDay) {
			const first = items[0];
			const daySeconds = items.reduce((sum, r) => sum + (hatadySeconds(r.session) ?? 0), 0);
			const header = Number.isFinite(first.at)
				? tx.dayLine({
					date: dateFormatter.format(new Date(first.at)),
					weekday: weekdayFormatter.format(new Date(first.at)),
					count: items.length,
					duration: hatadyDuration(daySeconds),
				})
				: tx.dayLineUnknown({ label: key, count: items.length });
			lines.push(header);
			for (const { session, at } of items) {
				const work =
					(typeof session.workId === 'string' ? workById.get(session.workId) : undefined) ??
					asRecord(session.workSnapshot);
				const time = Number.isFinite(at)
					? `${pad(new Date(at).getHours())}:${pad(new Date(at).getMinutes())}`
					: '--:--';
				lines.push(
					tx.sessionLine({
						time,
						kind: kindLabel(work?.kind),
						title: String(work?.title ?? copy.unknownWork),
						type: enumLabel('sessionKind', session.kind),
						duration: hatadyDuration(hatadySeconds(session)),
					}),
				);
				if (typeof session.note === 'string' && session.note.length > 0) {
					const mark = session.noteSpoiler === true ? `${copy.spoilerMark} ` : '';
					for (const line of session.note.split('\n')) lines.push(`\u3000${mark}${line}`);
				}
			}
			lines.push('');
		}
	}

	lines.push('── ' + copy.workListHeading + ' ──');
	if (works.length === 0) {
		lines.push(copy.emptyWorks);
	} else {
		for (const raw of works) {
			const work = asRecord(raw);
			if (!work) continue;
			const creator = typeof work.creator === 'string' && work.creator.length > 0 ? ` / ${work.creator}` : '';
			const rating =
				typeof work.recommendationRating === 'number' ? tx.ratingLabel({ rating: work.recommendationRating }) : '';
			lines.push(
				tx.workLine({
					kind: kindLabel(work.kind),
					title: String(work.title ?? ''),
					creator,
					status: enumLabel('status', work.status),
					rating,
				}),
			);
			if (typeof work.review === 'string' && work.review.length > 0) {
				const mark = work.reviewSpoiler === true ? `${copy.spoilerMark} ` : '';
				for (const line of work.review.split('\n')) lines.push(`\u3000${mark}${line}`);
			}
		}
	}

	return lines.join('\r\n');
}

/**
 * 映画・ゲーム作品と、その視聴/プレイ記録を書き出す。
 * JSON は版付きで、将来の読込実装が部分データを黙って受理しないよう format/version を必ず含める。
 * ⚠️絞り込みは取得後に行う(APIに期間・種別の引数が無いため)。取得件数の上限は従来どおり。
 */
export async function exportHatadyMediaArchive(opts?: {
	filter?: HatadyMediaExportFilter;
	format?: HatadyMediaExportFormat;
	periodLabel?: string;
	kindLabel?: string;
}): Promise<{ works: number; sessions: number }> {
	const [allWorks, allSessions] = await Promise.all([
		fetchMediaPages('hata/hatady/media/works/list'),
		fetchMediaPages('hata/hatady/media/sessions/list'),
	]);
	const filter = opts?.filter ?? { since: null, until: null, kinds: [] };
	const { works, sessions } = filterHatadyMediaForExport(allWorks, allSessions, filter);
	const now = new Date();
	const stamp = filter.since != null ? fileStamp(new Date(filter.since)) : 'all';
	const endStamp = filter.until != null ? fileStamp(new Date(filter.until)) : fileStamp(now);

	if (opts?.format === 'txt') {
		const text = buildHatadyMediaExportText(works, sessions, {
			now,
			periodLabel: opts.periodLabel,
			kindLabel: opts.kindLabel,
		});
		downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `hatady_media_${stamp}-${endStamp}.txt`);
	} else {
		const archive = buildHatadyMediaExportArchive(works, sessions, { now });
		downloadBlob(
			new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json;charset=utf-8' }),
			`hatady_media_${stamp}-${endStamp}.json`,
		);
	}
	return { works: works.length, sessions: sessions.length };
}

export type HatadyArchiveFilter = { kinds: readonly HatadyLogKind[]; since: number | null; until: number | null };
/** Version 1 media keys remain unchanged; new record/book arrays are additive. */
export type HatadyFullArchive = HatadyMediaExportArchive & {
	logs: AnyRecord[];
	books: AnyRecord[];
	bookmarks: AnyRecord[];
	bookMemos: AnyRecord[];
};
export type HatadyPreparedExport = {
	archive: HatadyFullArchive;
	records: number;
	works: number;
	contents: string;
	filename: string;
	mimeType: string;
};

export async function readAllHatadyArchive(filter: HatadyArchiveFilter): Promise<HatadyFullArchive> {
	const kinds = new Set(filter.kinds.length ? filter.kinds : HATADY_ACTIVITY_CHOICES.map((kind) => kind.value));
	const untilDate =
		filter.until == null
			? undefined
			: (() => {
				const date = new Date(filter.until);
				date.setHours(23, 59, 59, 999);
				return date.getTime();
			})();
	const [activities, allBooks, allWorks, allSessions] = await Promise.all([
		collectActivityPages(async (cursor) =>
			requireHatadyActivityPage(
				await misskeyApi(
					'hata/hatady/activities' as never,
					{
						scope: 'mine',
						kinds: [...kinds],
						limit: 100,
						sinceDate: filter.since ?? undefined,
						untilDate,
						...(cursor ? { cursor } : {}),
					} as never,
				),
			),
		),
		kinds.has('study')
			? collectWorkPages<AnyRecord & { id: string }>(async (untilId) => {
				const value = await misskeyApi('hata/hatady/books', { limit: 100, untilId });
				if (!Array.isArray(value) || value.some((item) => !item || typeof (item as AnyRecord).id !== 'string')) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
				return value as unknown as Array<AnyRecord & { id: string }>;
			})
			: Promise.resolve([]),
		fetchMediaPages('hata/hatady/media/works/list'),
		fetchMediaPages('hata/hatady/media/sessions/list'),
	]);
	const logs = activities.filter((activity) => activity.study).map((activity) => activity.study!);
	const hasPeriod = filter.since != null || filter.until != null;
	const bookIds = new Set(logs.map((log) => log.bookId));
	const books = allBooks.filter((book) => !hasPeriod || bookIds.has(book.id));
	const bookmarks: AnyRecord[] = [],
		bookMemos: AnyRecord[] = [];
	// Read saved memo/bookmark IDs through the existing owner-authorized detail API.
	for (const book of books) {
		const result = (await misskeyApi('hata/hatady/books/show', { bookId: book.id })) as AnyRecord;
		if (!Array.isArray(result.bookmarks) || !Array.isArray(result.memos)) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
		bookmarks.push(...result.bookmarks);
		bookMemos.push(...result.memos);
	}
	const selectedSessions = allSessions.filter((raw) => {
		const session = asRecord(raw);
		if (!session) throw new Error(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
		const kind = session.kind === 'movie_viewing' ? 'movie' : 'game';
		if (!kinds.has(kind)) return false;
		if (!hasPeriod) return true;
		const at = Date.parse(String(session.occurredAt));
		return (
			Number.isFinite(at) && (filter.since == null || at >= filter.since) && (untilDate == null || at <= untilDate)
		);
	});
	const referenced = new Set([
		...selectedSessions.map((raw) => asRecord(raw)?.workId),
		...logs.map((log) => log.mediaWorkId),
	]);
	const works = allWorks.filter((raw) => {
		const work = asRecord(raw);
		return work && kinds.has(work.kind as HatadyLogKind) && (!hasPeriod || referenced.has(work.id));
	});
	return { ...buildHatadyMediaExportArchive(works, selectedSessions), logs, books, bookmarks, bookMemos };
}

export function prepareHatadyExport(archive: HatadyFullArchive, format: 'json' | 'txt'): HatadyPreparedExport {
	let contents: string;
	if (format === 'json') contents = JSON.stringify(archive, null, 2);
	else {
		const rows = [
			...archive.logs.map((log) => ({
				at: String(log.studiedAt),
				data: log,
				title: String(log.title ?? ''),
				body: String(log.body ?? ''),
				kind: String(log.kind ?? 'study'),
			})),
			...archive.sessions.map((raw) => {
				const session = asRecord(raw)!;
				const work =
					archive.works.map(asRecord).find((work) => work?.id === session.workId) ?? asRecord(session.workSnapshot);
				return {
					at: String(session.occurredAt),
					data: session,
					title: String(work?.title ?? ''),
					body: String(session.note ?? ''),
					kind: session.kind === 'movie_viewing' ? 'movie' : 'game',
				};
			}),
		].sort((a, b) => a.at.localeCompare(b.at));
		const lines = [
			'Hatady',
			`${rows.length}記録 · ${archive.books.length + archive.works.length}作品`,
			archive.exportedAt,
			'',
		];
		for (const row of rows) {
			lines.push(
				`${row.at} · ${HATADY_ACTIVITY_CHOICES.find((kind) => kind.value === row.kind)?.label ?? row.kind}`,
				row.title,
				hatadyDuration(hatadySeconds(row.data)),
			);
			if (row.body) lines.push(`${asRecord(row.data.details)?.spoiler || row.data.noteSpoiler ? '[ネタバレ] ' : ''}${row.body}`);
			// Keep every saved detail in the readable export, including unknown legacy fields.
			lines.push(JSON.stringify(row.data, null, 2), '');
		}
		lines.push(
			'コレクション・しおり・内容メモ',
			JSON.stringify(
				{ books: archive.books, works: archive.works, bookmarks: archive.bookmarks, bookMemos: archive.bookMemos },
				null,
				2,
			),
		);
		contents = lines.join('\r\n');
	}
	return {
		archive,
		records: archive.logs.length + archive.sessions.length,
		works: archive.books.length + archive.works.length,
		contents,
		filename: `hatady_${fileStamp(new Date(archive.exportedAt))}.${format}`,
		mimeType: format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
	};
}

export function downloadPreparedHatadyExport(prepared: HatadyPreparedExport): void {
	downloadBlob(new Blob([prepared.contents], { type: prepared.mimeType }), prepared.filename);
}
