/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: 地震・津波情報の表示ヘルパー。出典: 気象庁 / P2P地震情報。
 */

// P2PQuake の scale 値 → 震度ラベル。
export function scaleToLabel(scale: number): string {
	switch (scale) {
		case 10: return '1';
		case 20: return '2';
		case 30: return '3';
		case 40: return '4';
		case 45: return '5弱';
		case 50: return '5強';
		case 55: return '6弱';
		case 60: return '6強';
		case 70: return '7';
		default: return '?';
	}
}

// 震度の色(気象庁の震度カラーに準じた配色。厳密一致でなく視認性重視)。
//   文字は常に白で乗せるため、震度3はやや濃いゴールドにして可読性を確保している。
export function scaleToColor(scale: number): string {
	switch (scale) {
		case 10: return '#6c7a89';
		case 20: return '#2e7d32';
		case 30: return '#b8860b';
		case 40: return '#fb8c00';
		case 45: return '#e64a19';
		case 50: return '#d32f2f';
		case 55: return '#8e24aa';
		case 60: return '#6a1b9a';
		case 70: return '#b71c1c';
		default: return 'var(--MI_THEME-divider)';
	}
}

// 震度バッジの文字色。全ての震度で白に統一(背景側で可読性を確保)。
export function scaleTextColor(_scale: number): string {
	return '#fff';
}

// 津波予報の段階ラベル。
export function tsunamiGradeLabel(grade: string): string {
	switch (grade) {
		case 'MajorWarning': return '大津波警報';
		case 'Warning': return '津波警報';
		case 'Watch': return '津波注意報';
		case 'Unknown': return '不明';
		default: return grade;
	}
}

export function tsunamiGradeColor(grade: string): string {
	switch (grade) {
		case 'MajorWarning': return '#ad02ad';
		case 'Warning': return '#ff2800';
		case 'Watch': return '#fae696';
		default: return 'var(--MI_THEME-divider)';
	}
}

// 地震情報(551)の issue.type → 日本語。
export function issueTypeLabel(type: string): string {
	switch (type) {
		case 'ScalePrompt': return '震度速報';
		case 'Destination': return '震源情報';
		case 'DetailScale': return '各地の震度';
		case 'Foreign': return '遠地地震';
		case 'Other': return 'その他';
		default: return type;
	}
}

// 国内向け津波の有無(earthquake.domesticTsunami)。
//   気象庁の発表する区分に合わせた短いラベル(個別のチップ用)。
//   電文の文言を改変せず、独自の警報化を避けるため気象庁準拠の語に揃える。
//   ※ P2PQuakeの仕様上 Warning=「津波予報(種類不明)」のため、「警報」と断定せず汎用の「津波情報」と表記する。
export function domesticTsunamiLabel(v: string): string | null {
	switch (v) {
		case 'None': return null; // 「心配なし」はチップでは出さず、選択時の文言で気象庁の定型文を出す
		case 'Unknown': return null;
		case 'Checking': return '津波の有無を調査中';
		case 'NonEffective': return '若干の海面変動';
		case 'Watch': return '津波注意報';
		case 'Warning': return '津波情報';
		default: return null;
	}
}

// 1日(ミリ秒)。これより古い地震・津波情報はキャッシュ肥大化防止のため保持しない。
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// P2PQuakeの時刻文字列("2024/01/01 12:00:00" 形式・JST)が、現在から ms 以内か。
//   時刻不明(空)のものは判定不能なので残す(true)。
export function isWithin(timeStr: string | undefined | null, ms: number): boolean {
	if (!timeStr) return true;
	const t = Date.parse(timeStr);
	if (Number.isNaN(t)) return true;
	return (Date.now() - t) < ms;
}

// 地震・津波レコードの代表時刻。
export function recordTime(r: any): string | undefined {
	return r?.earthquake?.time || r?.time;
}

// 1日以内のレコードだけ残す(地震・津波共通)。
export function pruneOld<T>(list: T[]): T[] {
	return list.filter(r => isWithin(recordTime(r), ONE_DAY_MS));
}

// 電光掲示板(ticker)アイテムの型。
//   kind='header': 第○報・ソース明記行 / 'scale': 色付き震度バッジ / 'info': テキスト
export type TickerItem = { kind: 'header' | 'scale' | 'info'; text: string; scale?: number };

// 旗鯖fork: 最新地震の電光掲示板アイテム列を生成。
//   電文の値を改変せず、意訳もせずそのまま並べる(気象業務法23条配慮)。
//   - 最終報(issue.type='DetailScale'=各地の震度)を受信していれば最終報のみを流す
//   - 受信前(速報段階)は第1報から最新報までを時系列に流す
//   ページ/カラム/ウィジェット/Haskタイル全てで共通利用する。
export function generateTickerItems(latestQuake: any, rawQuakes: any[]): TickerItem[] {
	if (!latestQuake) return [];
	const key = latestQuake._key;
	// 同じ地震の生レコード(各報)を受信順に並べる。
	const allReports = [...rawQuakes]
		.filter(r => (r.earthquake?.time ?? r.id) === key)
		.sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')));
	// 最終報(各地の震度=DetailScale)が含まれていれば、それだけ流す(中間報は省略)。
	const finalReport = [...allReports].reverse().find(r => r.issue?.type === 'DetailScale');
	const reports = finalReport ? [finalReport] : allReports;
	const usingFinal = !!finalReport;
	const items: TickerItem[] = [];
	let no = 0;
	for (const r of reports) {
		no++;
		const type = r.issue?.type ? issueTypeLabel(r.issue.type) : '';
		const recv = r.time ? String(r.time) : '';
		const headerLabel = usingFinal
			? `最終報${type ? '・' + type : ''}${recv ? '（' + recv + '受信）' : ''}`
			: `第${no}報${type ? '・' + type : ''}${recv ? '（' + recv + '受信）' : ''}`;
		items.push({ kind: 'header', text: headerLabel });
		const hypo = r.earthquake?.hypocenter?.name;
		if (hypo) items.push({ kind: 'info', text: `震源 ${hypo}` });
		const ms = r.earthquake?.maxScale;
		if (typeof ms === 'number' && ms >= 10) items.push({ kind: 'scale', scale: ms, text: `最大震度${scaleToLabel(ms)}` });
		const mag = r.earthquake?.hypocenter?.magnitude;
		if (typeof mag === 'number' && mag >= 0) items.push({ kind: 'info', text: `M${mag}` });
		const depth = r.earthquake?.hypocenter?.depth;
		if (typeof depth === 'number' && depth >= 0) items.push({ kind: 'info', text: `深さ${depth}km` });
		const dt = r.earthquake?.domesticTsunami;
		const dtLabel = domesticTsunamiLabel(dt ?? '');
		if (dtLabel) items.push({ kind: 'info', text: `津波: ${dtLabel}` });
		else if (dt === 'None') items.push({ kind: 'info', text: '津波: 心配なし' });
		const pts = [...(r.points ?? [])]
			.filter(p => typeof p.scale === 'number' && p.scale >= 10 && (p.addr || p.pref))
			.sort((a, b) => b.scale - a.scale);
		for (const p of pts) items.push({ kind: 'scale', scale: p.scale, text: p.addr || p.pref });
	}
	return items;
}

// 47都道府県(GeoJSONの name と一致。P2PQuakeの points[].pref とも一致する)。
export const PREFECTURES: string[] = [
	'北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
	'茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
	'新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
	'静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
	'奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
	'徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
	'熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

// 都道府県名 → 行政区域コード(2桁・JIS順)。市区町村GeoJSONのファイル名に使う。
export function prefNameToCode(pref: string): string | null {
	const i = PREFECTURES.indexOf(pref);
	return i < 0 ? null : String(i + 1).padStart(2, '0');
}

// issue.type の詳しさ順位(大きいほど最終報に近い)。
function issueRank(type: string | undefined): number {
	switch (type) {
		case 'DetailScale': return 4; // 各地の震度(最終的に詳しい)
		case 'Destination': return 3; // 震源情報
		case 'ScalePrompt': return 2; // 震度速報(速報)
		case 'Foreign': return 1;
		default: return 0;
	}
}

/**
 * 同じ地震(第○報)を1件にまとめる。
 *   earthquake.time(発生時刻)が同じものを同一地震とみなし、
 *   もっとも詳しい/新しい報を代表として残す(最終報に近いものを表示)。
 */
export function dedupeQuakes(list: any[]): any[] {
	const groups = new Map<string, any[]>();
	for (const q of list) {
		if (q == null) continue;
		const key = q.earthquake?.time || q.id || JSON.stringify(q.time);
		const arr = groups.get(key) ?? [];
		arr.push(q);
		groups.set(key, arr);
	}
	const reps: any[] = [];
	for (const [key, arr] of groups.entries()) {
		// 詳しさ → 受信時刻(time) の順で最良を代表に。
		arr.sort((a, b) => {
			const r = issueRank(b.issue?.type) - issueRank(a.issue?.type);
			if (r !== 0) return r;
			return String(b.time ?? '').localeCompare(String(a.time ?? ''));
		});
		const rep = { ...arr[0] };
		// 念のため最大震度はグループ内の最大を採用(速報→詳報で下がらないように)。
		let maxScale = rep.earthquake?.maxScale ?? -1;
		for (const q of arr) {
			const s = q.earthquake?.maxScale ?? -1;
			if (s > maxScale) maxScale = s;
		}
		if (rep.earthquake) rep.earthquake = { ...rep.earthquake, maxScale };
		rep._reportCount = arr.length;
		// 安定キー(発生時刻ベース)。第○報が更新されても同じ地震として扱えるよう、
		// 代表の report id ではなくグループキーを使う。
		rep._key = key;
		reps.push(rep);
	}
	// 発生時刻の新しい順。
	reps.sort((a, b) => String(b.earthquake?.time ?? b.time ?? '').localeCompare(String(a.earthquake?.time ?? a.time ?? '')));
	return reps;
}

/** その地震が指定の都道府県で震度を観測したか(震度1以上)。 */
export function quakeAffectsPref(q: any, pref: string): boolean {
	if (!pref) return false;
	for (const p of (q.points ?? [])) {
		if (p.pref === pref && typeof p.scale === 'number' && p.scale >= 10) return true;
	}
	return false;
}

/** 電光掲示板用: 各地の震度を「震度の大きい順」に並べたフラットな配列。 */
export function tickerPoints(q: any): { scale: number; addr: string }[] {
	const out: { scale: number; addr: string }[] = [];
	for (const p of (q?.points ?? [])) {
		if (typeof p.scale !== 'number' || p.scale < 10) continue;
		out.push({ scale: p.scale, addr: p.addr || p.pref || '' });
	}
	out.sort((a, b) => b.scale - a.scale);
	return out.filter(x => x.addr);
}

/** その都道府県での観測最大震度(scale)。なければ -1。 */
export function maxScaleInPref(q: any, pref: string): number {
	let max = -1;
	for (const p of (q.points ?? [])) {
		if (p.pref === pref && typeof p.scale === 'number' && p.scale > max) max = p.scale;
	}
	return max;
}
