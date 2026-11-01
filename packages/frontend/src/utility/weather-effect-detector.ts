/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect)の検出ロジック。
 *
 * ノート本文(+CW)から天気を表すキーワードを検出し、表示すべきエフェクト種別を返す。
 * 雷は健康配慮(光感受性てんかん対策)のため意図的に対象外としている。
 *
 * 誤検出を避ける方針:
 *   - ひらがな単独マッチは飴・腫れ・由紀などと衝突するので採用しない。漢字+英語のみ。
 *   - 「曇り」は背景演出として地味で効果が薄いため Step1 では rain/snow/sunny の3種のみ。
 *
 * 複数天気が同時に書かれている場合(例:「雨が降った後で晴れた」)の優先ルール:
 *   - 「本文中で最後に出現した天気」を優先する(案A)。
 *   - 予測可能でシンプル。ユーザーが文末に書いた現在の天気が反映されやすい。
 */

export type WeatherKind = 'rain' | 'heavyRain' | 'snow' | 'sunny' | 'windy' | 'shootingStar' | 'freshGreen' | 'summerLeaves';

// 各天気種別の検出パターン。漢字+英語のみに絞り、ひらがな単独マッチは避ける。
// 注意: heavyRain は rain より前に置き、「土砂降り」「豪雨」等を通常の雨より優先して判定する。
//       (例: 「土砂降り」は rain の「雨」にもマッチするため、先に heavyRain を取る)
//
// 旗鯖fork(perf): モジュールスコープで /.../gi リテラルをそのまま使い回す。
//   `g` フラグの RegExp は `lastIndex` 内部状態を持つので exec ループでは状態が残り
//   バグの原因になる。後段で `matchAll` を使うことで毎回新規イテレータを得られるため、
//   `lastIndex` を気にせず安全に共有できる。`new RegExp(source, ...)` の毎回コピーを廃止。
const WEATHER_PATTERNS: { kind: WeatherKind; regex: RegExp }[] = [
	{ kind: 'heavyRain', regex: /土砂降り|豪雨|大雨|暴風雨|ゲリラ豪雨|集中豪雨|どしゃ降り|heavy rain|downpour|torrential/gi },
	{ kind: 'rain', regex: /雨|霧雨|小雨|夕立|rain|rainy/gi },
	{ kind: 'snow', regex: /雪|吹雪|降雪|snow|snowy/gi },
	// 夜・おやすみ系 → 流れ星。「夜」単体は誤爆しやすい(今夜/夜中など)ので、就寝の挨拶に絞る。
	{ kind: 'shootingStar', regex: /いい夜|良い夜|おやすみ|お休み|安らかな夜|流れ星|流星|sleep|oyasumi|good night|goodnight/gi },
	// 朝の挨拶・晴天系 → 日差し。
	{ kind: 'sunny', regex: /おはよう|お早う|晴れ|晴天|快晴|日差し|陽射し|日射し|ピーカン|sunny|clear sky|good morning|ohayou/gi },
	{ kind: 'windy', regex: /強風|風が強い|風強い|暴風|突風|木枯らし|こがらし|windy|gale|gusty/gi },
	// 旗鯖fork: 新緑/若葉 → 明るい緑の葉が舞い落ちる。
	{ kind: 'freshGreen', regex: /新緑|若葉|青葉若葉|新芽|芽吹き|木の芽|fresh green/gi },
	// 旗鯖fork: 夏/青葉 → 濃い緑の葉が舞い落ちる。
	{ kind: 'summerLeaves', regex: /真夏|盛夏|夏|青葉|深緑|緑陰|青々|midsummer/gi },
];

// 挨拶(朝/就寝)由来かどうかの判定用パターン。
// 挨拶で発動した演出は一過性が自然なので、長さ設定に関わらず短時間で消す。
const GREETING_REGEX = /おはよう|お早う|good morning|ohayou|いい夜|良い夜|おやすみ|お休み|安らかな夜|oyasumi|good night|goodnight/i;

/**
 * テキストが朝/就寝の挨拶を含むか。
 * (「晴れ」「雨」等の純粋な天気ワードだけの場合は false)
 */
export function isGreetingText(text: string | null | undefined): boolean {
	if (text == null || text.length === 0) return false;
	return GREETING_REGEX.test(text);
}

/**
 * テキストから天気種別を検出する。
 * 複数該当する場合は「最後に出現したもの」を優先する。
 *
 * @param text 検出対象テキスト(ノート本文 + CW を結合したもの想定)
 * @returns 検出された天気種別。該当なしは null。
 */
export function detectWeather(text: string | null | undefined): WeatherKind | null {
	if (text == null || text.length === 0) return null;

	// 各天気種別ごとに「本文中で最後に出現した位置」を求める。
	// 旗鯖fork(perf): matchAll は呼び出しごとに新しいイテレータを返すため、
	//   モジュールスコープの /.../gi リテラルを共有しても lastIndex 汚染が起きない。
	const lastIndexOf: Partial<Record<WeatherKind, number>> = {};
	for (const { kind, regex } of WEATHER_PATTERNS) {
		let lastIndex = -1;
		for (const m of text.matchAll(regex)) {
			if (typeof m.index === 'number') lastIndex = m.index;
		}
		if (lastIndex >= 0) lastIndexOf[kind] = lastIndex;
	}

	// 土砂降り(heavyRain)が含まれていたら、雨らしさを最優先で激しい雨にする。
	// (「大雨」「土砂降り」は通常の rain にも部分マッチするため、ここで明示的に優先する)
	if (lastIndexOf.heavyRain != null) return 'heavyRain';

	// それ以外は「最後に出現した天気」を採用する(予測可能でシンプル)。
	let best: { kind: WeatherKind; index: number } | null = null;
	for (const kind of Object.keys(lastIndexOf) as WeatherKind[]) {
		const index = lastIndexOf[kind]!;
		if (best == null || index > best.index) {
			best = { kind, index };
		}
	}

	return best?.kind ?? null;
}

/**
 * ノートオブジェクトから検出用テキスト(本文 + CW)を組み立てる。
 * MkNote.vue の utageTextMatched と同じ範囲を見ることで整合を取る。
 */
export function buildWeatherDetectText(note: { text?: string | null; cw?: string | null }): string {
	return `${note.text ?? ''} ${note.cw ?? ''}`;
}
