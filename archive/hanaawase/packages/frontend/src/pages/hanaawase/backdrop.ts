// 花常: 適応背景の選択（表引きレジストリ）。PNGを1枚足す＝REGISTRYに1行足すだけで選択対象に入る。
// storyBg（進行上書き）最優先。CSS代替の場所は png=null を返し、描画側が §12.5 のCSS環境を描く（shop_dayに丸めない）。
// ⚠️Math.random 不使用の純関数。時間帯は daytime.ts（JST）を再利用。

import { timeOfDay } from './daytime';
import type { TimeOfDay } from './daytime';

export type Location =
	| 'shop' | 'front' | 'workroom'                          // 既存PNG場所
	| 'market' | 'naito_field' | 'sakanoue' | 'shotengai'   // ヒーロー（限定PNG）
	| 'street' | 'indoor_other' | 'outskirt';               // CSS代替（PNG無し）
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeSlot = TimeOfDay; // morning | day | evening | night
export type Weather = 'clear' | 'overcast' | 'rain' | 'snow' | 'frost' | 'candle';

/** BgId = 実在WebPのファイル名幹（= REGISTRY の id）。開いた型（新IDを足しやすく）。 */
export type BgId = string;

/** 背景画像1枚 = この定義1行。 */
interface BgDef {
	id: BgId;          // == bg/<id>.webp
	loc: Location;
	season?: Season;   // front_* のみ
	time?: TimeSlot;   // 既定 'day'
	weather?: Weather; // 既定 clear/overcast
}

// ⚠️近未来版（nf_*）が生成済みのものはそちらを正とする（2026-07-25 利用者裁定で背景は近未来へ転換）。
// 未生成の場所・季節は、絵が揃うまで従来版を使う。⚠️実在しないIDを登録しない（404の原因になる）。
const REGISTRY: readonly BgDef[] = [
	{ id: 'nf_shop_morning', loc: 'shop', time: 'morning' },
	{ id: 'nf_shop_day', loc: 'shop', time: 'day' },
	{ id: 'nf_shop_evening', loc: 'shop', time: 'evening' },
	{ id: 'nf_shop_night', loc: 'shop', time: 'night' },
	{ id: 'nf_workroom', loc: 'workroom', time: 'day' },
	{ id: 'nf_workroom', loc: 'workroom', time: 'night' },
	{ id: 'nf_front_day', loc: 'front', time: 'day' },
	{ id: 'nf_front_night', loc: 'front', time: 'night' },
	{ id: 'front_spring', loc: 'front', season: 'spring' },
	{ id: 'front_spring_rain', loc: 'front', season: 'spring', weather: 'rain' },
	{ id: 'front_spring_evening', loc: 'front', season: 'spring', time: 'evening' },
	{ id: 'front_summer', loc: 'front', season: 'summer' },
	{ id: 'front_summer_rain', loc: 'front', season: 'summer', weather: 'rain' },
	{ id: 'front_summer_evening', loc: 'front', season: 'summer', time: 'evening' },
	{ id: 'front_autumn', loc: 'front', season: 'autumn' },
	{ id: 'front_autumn_rain', loc: 'front', season: 'autumn', weather: 'rain' },
	{ id: 'front_autumn_frost', loc: 'front', season: 'autumn', weather: 'frost' },
	{ id: 'front_winter', loc: 'front', season: 'winter' },
	{ id: 'front_winter_snow', loc: 'front', season: 'winter', weather: 'snow' },
	{ id: 'front_winter_night', loc: 'front', season: 'winter', time: 'night' },
	{ id: 'market_dawn', loc: 'market', time: 'morning' },
	{ id: 'naito_field_night', loc: 'naito_field', time: 'night' },
	{ id: 'sakanoue', loc: 'sakanoue', time: 'day' },
	{ id: 'shotengai_night', loc: 'shotengai', time: 'night' },
];

/** CSS代替の場所（背景画像を持たない）。描画側が §12.5 のCSS環境を描く。 */
const CSS_LOCATIONS: ReadonlySet<Location> = new Set(['street', 'indoor_other', 'outskirt']);

export interface BackdropContext {
	now: Date;
	month: number;            // 1-12
	loc?: Location;           // 場面の場所（既定 'shop'）
	time?: TimeSlot;          // 本文が明示するとき（既定は now から算出）
	weather?: Weather;        // 本文が明示するとき（既定なし）
	storyBg?: BgId;           // 進行上書き（最優先・任意のBgId）
}

/** 選択結果。id=null は「CSS環境で描く」の合図（shop_dayに丸めない）。 */
export interface BackdropPick { id: BgId | null; css: boolean; }

export function bgPath(id: BgId): string {
	return `/client-assets/hanaawase/bg/${id}.webp`;
}

export function seasonOf(month: number): Season {
	if (month >= 3 && month <= 5) return 'spring';
	if (month >= 6 && month <= 8) return 'summer';
	if (month >= 9 && month <= 11) return 'autumn';
	return 'winter';
}

/**
 * 文脈から背景を選ぶ。
 * 優先順: storyBg（上書き） > CSS場所 > 場所×季節での time/weather 最良一致 > shop_day。
 */
export function pickBackdrop(ctx: BackdropContext): BackdropPick {
	if (ctx.storyBg) {
		return { id: ctx.storyBg, css: false }; // 未登録IDでも上書きは尊重（新タグ移行期）
	}
	const loc: Location = ctx.loc ?? 'shop';
	if (CSS_LOCATIONS.has(loc)) return { id: null, css: true }; // §12.5

	const season = loc === 'front' ? seasonOf(ctx.month) : undefined;
	const time: TimeSlot = ctx.time ?? timeOfDay(ctx.now);
	const wantWeather = ctx.weather;

	// ⚠️季節を持たない定義（近未来版の nf_front_day/night 等）は、どの季節でも候補に入れる。
	//   ここで除外すると「登録したのに永久に選ばれない」死にデータになる。
	const pool = REGISTRY.filter((d) => d.loc === loc && (!season || !d.season || d.season === season));
	const score = (d: BgDef): number =>
		(d.weather === wantWeather ? 4 : d.weather ? -2 : 0) +
		((d.time ?? 'day') === time ? 2 : 0) +
		(season && d.season === season ? 1 : 0); // 季節が一致する専用絵をわずかに優先
	const best = [...pool].sort((a, b) => score(b) - score(a))[0];
	if (best) return { id: best.id, css: false };
	return { id: 'shop_day', css: false }; // 最終フォールバック（§9.7.55: 迷ったら shop_day）
}
