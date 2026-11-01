/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyMediaKind, HatadyMediaSession, HatadyMediaSessionKind, HatadyMediaSuggestions } from '@/utility/hatady-media.js';
import type { HatadyFormField, HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import { HATADY_STAT_FIELDS, MEDIA_SESSION_DETAIL_KEYS, mediaSessionDetailsPayload, normalizeMediaList } from '@/utility/hatady-media.js';
import { formField as f, optionalPages } from '@/utility/hatady-form.js';

const listKeys = ['companions', 'achievements', 'weaponOrder', 'roundResults', 'branches', 'enemyTypes'];
const numberKeys = ['rating', 'bestOf', 'ratingBefore', 'ratingAfter', 'floor', 'runNumber', 'teamSize', 'opponentSize', 'waves', 'enemyCount'];
const booleanKeys = ['rewatch', 'overtime'];
export const SESSION_TYPE_OPTIONS = [
	{ value: 'game_play', label: 'プレイ', icon: 'ti ti-device-gamepad-2' },
	{ value: 'game_match', label: '対戦', icon: 'ti ti-swords' },
	{ value: 'game_pve', label: '協力・PvE', icon: 'ti ti-users' },
	{ value: 'game_roguelike', label: 'ローグライク', icon: 'ti ti-dice' },
];
export function initialSessionDetails(source?: HatadyMediaSession | null): HatadyFormValues {
	const details = source?.details ?? {}, values: HatadyFormValues = {};
	for (const key of new Set(Object.values(MEDIA_SESSION_DETAIL_KEYS).flat())) {
		values[key] = listKeys.includes(key) ? normalizeMediaList(details[key]) : booleanKeys.includes(key) ? details[key] === true : details[key] ?? '';
	}
	// Retain every saved row and its unknown properties, including unnamed legacy totals.
	const rows = Array.isArray(details.weaponStats) ? details.weaponStats.filter(row => row && typeof row === 'object').map(row => ({ ...(row as object) })) : [];
	if (rows.length === 0 && HATADY_STAT_FIELDS.some(key => typeof details[key] === 'number')) rows.push({ weapon: String(details.weapon ?? ''), ...Object.fromEntries(HATADY_STAT_FIELDS.filter(key => typeof details[key] === 'number').map(key => [key, details[key]])) });
	values.weaponStats = rows;
	const used = HATADY_STAT_FIELDS.filter(key => rows.some(row => typeof (row as any)[key] === 'number'));
	values.statFields = Array.isArray(details.statFields) ? [...details.statFields] : used.length ? used : ['kills', 'deaths'];
	return values;
}

export function sessionDetailPages(workKind: HatadyMediaKind, suggestions: HatadyMediaSuggestions = {}): HatadyFormPage[] {
	const text = (key: string, label: string, maximum = 512) => f(key, label, { maxlength: maximum, suggestions: suggestions[key] ?? [] });
	const number = (key: string, label: string) => f(key, label, { type: 'number', min: key.startsWith('rating') ? -1000000000 : ['teamSize', 'opponentSize'].includes(key) ? 1 : 0, max: key.startsWith('rating') ? 1000000000 : ['teamSize', 'opponentSize'].includes(key) ? 100 : 1000000, step: key.startsWith('rating') ? 'any' : 1, suggestions: suggestions[key] ?? [] });
	const list = (key: string, label: string, ordered = false) => f(key, label, { type: 'list', ordered, maxItems: key === 'roundResults' ? 100 : 30, maxlength: key === 'roundResults' ? 512 : 256, suggestions: suggestions[key] ?? [] });
	const choice = (key: string, label: string, options: [string, string][]) => f(key, label, { type: 'select', options: [{ value: '', label: '未設定' }, ...options.map(([value, name]) => ({ value, label: name }))] });
	const matchmaking = choice('matchmaking', 'マッチング', [['random', 'ランダム'], ['solo', 'ソロ'], ['party', 'パーティー'], ['specific', '指定した相手']]);
	const mood = choice('mood', '今日の調子', [['great', 'とてもよい'], ['good', 'よい'], ['neutral', 'ふつう'], ['tired', '疲れた'], ['frustrated', 'くやしい']]);
	const result = (match: boolean) => choice('result', '結果', match ? [['win', '勝ち'], ['loss', '負け'], ['draw', '引き分け']] : [['cleared', 'クリア'], ['failed', '失敗'], ['retired', '途中で終了']]);
	const group = (kind: HatadyMediaSessionKind, id: string, title: string, fields: HatadyFormField[], icon = 'ti ti-notes') => optionalPages(`${kind}-${id}`, title, fields, icon).map(page => ({ ...page, when: (values: HatadyFormValues) => values.sessionKind === kind }));
	if (workKind === 'movie') return [
		...group('movie_viewing', 'place', '鑑賞した場所と形式', [text('theaterName', '映画館・鑑賞した場所'), text('screeningFormat', '上映形式'), choice('viewingMode', '音声・字幕', [['original', 'オリジナル'], ['subtitled', '字幕'], ['dubbed', '吹替']])], 'ti ti-movie'),
		...group('movie_viewing', 'company', '誰と、何回目？', [list('companions', '一緒に観た人'), f('rewatch', '再鑑賞', { type: 'checkbox' })], 'ti ti-users'),
	];
	const pages: HatadyFormPage[] = [];
	for (const kind of ['game_play', 'game_match', 'game_pve', 'game_roguelike'] as const) {
		if (kind === 'game_play') pages.push(...group(kind, 'progress', '遊び方と進み具合', [choice('playMode', '遊び方', [['single', 'シングル'], ['multi', 'マルチ']]), matchmaking, text('progress', '進み具合')], 'ti ti-device-gamepad-2'));
		if (kind !== 'game_play') pages.push(...group(kind, 'outcome', '結果を残す', [result(kind === 'game_match'), ...(kind === 'game_roguelike' ? [text('cause', '終了した理由')] : [text('reason', '結果の理由'), text('score', 'スコア')])], 'ti ti-flag'));
		if (kind === 'game_match') pages.push(
			...group(kind, 'opponent', '対戦相手', [matchmaking, choice('opponentType', '対戦相手の種類', [['human', '人'], ['cpu', 'CPU'], ['team', 'チーム'], ['other', 'その他']]), text('opponent', '対戦相手')], 'ti ti-swords'),
			...group(kind, 'teams', '人数とラウンド', [number('teamSize', '味方の人数'), number('opponentSize', '相手の人数'), number('bestOf', '最大ラウンド数'), list('roundResults', 'ラウンドごとの結果', true), f('overtime', '延長戦', { type: 'checkbox' })], 'ti ti-users'),
			...group(kind, 'rating', 'ランクとレート', [text('rank', 'ランク'), number('ratingBefore', '開始時のレート'), number('ratingAfter', '終了時のレート')], 'ti ti-chart-line'),
		);
		if (kind === 'game_pve') pages.push(...group(kind, 'enemies', '協力プレイと敵', [number('teamSize', '参加人数'), number('waves', 'ウェーブ数'), number('enemyCount', '敵の数'), list('enemyTypes', '敵の種類'), text('boss', 'ボス'), text('rank', 'ランク')], 'ti ti-users'));
		if (kind === 'game_match' || kind === 'game_pve') pages.push(
			...group(kind, 'stage', 'モードとステージ', [text('mode', 'モード'), text('map', 'マップ')], 'ti ti-map'),
			...group(kind, 'stats', '武器ごとの成績', [f('weaponStats', '使った武器と成績', { type: 'weaponStats', suggestions: suggestions.weapon ?? [] })], 'ti ti-chart-bar'),
		);
		if (kind === 'game_roguelike') pages.push(...group(kind, 'run', '今回の挑戦', [text('seed', 'シード'), number('runNumber', '挑戦回数'), number('floor', '到達階層'), text('route', 'ルート'), list('branches', '選んだ分岐', true), text('build', 'ビルド')], 'ti ti-route'));
		pages.push(...group(kind, 'equipment', 'キャラクターと装備', [text('character', 'キャラクター'), text('weapon', '主な武器'), list('weaponOrder', '武器・装備の順番', true)], 'ti ti-sword'));
		if (kind === 'game_play' || kind === 'game_pve') pages.push(...group(kind, 'achievements', '達成したこと', [list('achievements', '実績・達成したこと')], 'ti ti-trophy'));
		pages.push(...group(kind, 'condition', '環境と調子', [...(kind !== 'game_match' ? [text('difficulty', '難易度')] : []), text('device', 'プレイした機器'), mood, ...(kind === 'game_play' ? [text('rank', 'ランク'), number('rating', 'レート')] : [])], 'ti ti-device-desktop'));
	}
	return pages;
}

export function sessionDetailsPayload(workKind: HatadyMediaKind, kind: HatadyMediaSessionKind, values: HatadyFormValues, original: Record<string, unknown> = {}): Record<string, unknown> {
	const draft: Record<string, unknown> = {};
	for (const key of MEDIA_SESSION_DETAIL_KEYS[kind]) {
		const value = values[key];
		draft[key] = listKeys.includes(key) ? normalizeMediaList(value) : numberKeys.includes(key) ? value === '' || value == null ? null : Number(value) : typeof value === 'string' ? value.trim() || null : value;
	}
	if (kind === 'game_match' || kind === 'game_pve') {
		for (const key of HATADY_STAT_FIELDS) draft[key] = null;
		for (const row of values.weaponStats ?? []) for (const key of HATADY_STAT_FIELDS) if (typeof row[key] === 'number' && Number.isFinite(row[key])) draft[key] = Number(draft[key] ?? 0) + row[key];
		draft.weaponStats = (values.weaponStats ?? []).filter((row: HatadyFormValues) => String(row.weapon ?? '').trim() || (Array.isArray(original.weaponStats) && original.weaponStats.some(item => item && typeof item === 'object' && (item as Record<string, unknown>).weapon === ''))).map((row: HatadyFormValues) => ({ ...row, weapon: String(row.weapon ?? '').trim(), ...Object.fromEntries(HATADY_STAT_FIELDS.map(key => [key, row[key] ?? null])) }));
		draft.statFields = [...(values.statFields ?? [])];
	}
	const preserved = { ...original };
	for (const key of MEDIA_SESSION_DETAIL_KEYS[kind]) delete preserved[key];
	return { ...preserved, ...mediaSessionDetailsPayload(workKind, kind, draft) };
}
