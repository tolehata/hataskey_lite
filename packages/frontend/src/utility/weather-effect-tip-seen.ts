/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクトの「初回チュートリアルを表示済みの天気種別」を記録する端末ローカルストア。
 *
 * 以前は prefer(プロファイル同期)に保存していたため、別端末でも「表示済み」扱いになり、
 * 新しい端末では一度もチュートリアルが出ない問題があった。
 * チュートリアルは「無効化の方法を知らせる」案内なので、端末ごとに一度ずつ出すのが正しい。
 * よって localStorage(端末ローカル・非同期)に保存する。
 *
 * - 天気種別(rain/snow/...)単位で記録
 * - localStorage が使えない環境ではメモリ上のみ(セッション内のみ有効)
 */

const STORAGE_KEY = 'hataWeatherEffect:tipsShown';

let shown: Set<string> | null = null;

function load(): void {
	if (shown != null) return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const arr = raw != null ? JSON.parse(raw) as unknown : null;
		shown = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
	} catch {
		shown = new Set();
	}
}

function persist(): void {
	if (shown == null) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...shown]));
	} catch {
		// 失敗してもメモリ上は維持する。
	}
}

/**
 * この天気種別の初回チュートリアルを(この端末で)既に表示したか。
 */
export function hasShownWeatherTip(kind: string): boolean {
	load();
	return shown!.has(kind);
}

/**
 * この天気種別の初回チュートリアルを(この端末で)表示済みとして記録する。
 */
export function markWeatherTipShown(kind: string): void {
	load();
	if (shown!.has(kind)) return;
	shown!.add(kind);
	persist();
}
