/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import { miLocalStorage } from '@/local-storage.js';

/** HataGoes caches never use the account-synchronized preference store. */
export type HatagoesDeviceKey = `hatagoes:${'state' | 'create' | 'scroll'}:${string}`;
export function readHatagoesDeviceCache(key: HatagoesDeviceKey): string | null {
	try { return miLocalStorage.getItem(key); } catch { return null; }
}

export function writeHatagoesDeviceCache(key: HatagoesDeviceKey, value: unknown): void {
	try { miLocalStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional device cache. */ }
}

export type HataNotificationBrand = 'all' | 'standard' | 'hatady' | 'hatask' | 'hataFeed';
export const HATA_NOTIFICATION_CATEGORIES = ['standard', 'hatady', 'hatask', 'hataFeed'] as const;
export type HataNotificationCategory = typeof HATA_NOTIFICATION_CATEGORIES[number];
export type HataNotificationView = {
	brand: HataNotificationBrand;
	includeBrands: HataNotificationCategory[] | null;
	includeTypes: string[] | null;
	includeHatadySubtypes: string[] | null;
	includeHataskApp: boolean;
	excludeBots: boolean;
};

export function readHataNotificationView(): HataNotificationView {
	let saved: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(miLocalStorage.getItem('hataNotificationView') ?? '{}');
		if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>;
	} catch { /* use defaults */ }
	const brand = saved.brand;
	const includeTypes = Array.isArray(saved.includeTypes) ? saved.includeTypes.filter((value): value is string => typeof value === 'string') : null;
	const savedBrands = Array.isArray(saved.includeBrands) ? saved.includeBrands.filter((value): value is HataNotificationCategory => HATA_NOTIFICATION_CATEGORIES.some(category => category === value)) : null;
	const includeBrands = savedBrands != null
		? HATA_NOTIFICATION_CATEGORIES.filter(value => savedBrands.includes(value))
		: !Object.prototype.hasOwnProperty.call(saved, 'includeBrands') && includeTypes != null && !includeTypes.includes('hatady')
			? HATA_NOTIFICATION_CATEGORIES.filter(value => value !== 'hatady')
			: null;
	return {
		brand: brand === 'standard' || brand === 'hatady' || brand === 'hatask' || brand === 'hataFeed' ? brand : 'all',
		includeBrands,
		includeTypes,
		includeHatadySubtypes: Array.isArray(saved.includeHatadySubtypes) ? saved.includeHatadySubtypes.filter((value): value is string => typeof value === 'string') : null,
		includeHataskApp: typeof saved.includeHataskApp === 'boolean' ? saved.includeHataskApp : includeTypes == null || includeTypes.includes('app'),
		excludeBots: saved.excludeBots === true,
	};
}

export const hataNotificationView = ref<HataNotificationView>(readHataNotificationView());
export function setHataNotificationView(patch: Partial<HataNotificationView>): void {
	const next = { ...hataNotificationView.value, ...patch };
	let previous: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(miLocalStorage.getItem('hataNotificationView') ?? '{}');
		if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) previous = parsed as Record<string, unknown>;
	} catch { /* use defaults */ }
	miLocalStorage.setItem('hataNotificationView', JSON.stringify({ ...previous, ...next }));
	hataNotificationView.value = next;
}

export type HataskeyUiSDisplaySize = 'standard' | 'small';

function readHataskeyUiSDisplaySize(): HataskeyUiSDisplaySize {
	return miLocalStorage.getItem('hataskeyUiSDisplaySize') === 'small' ? 'small' : 'standard';
}

export const hataskeyUiSDisplaySize = ref<HataskeyUiSDisplaySize>(readHataskeyUiSDisplaySize());
export function setHataskeyUiSDisplaySize(size: HataskeyUiSDisplaySize): void {
	miLocalStorage.setItem('hataskeyUiSDisplaySize', size);
	hataskeyUiSDisplaySize.value = size;
}

export const HATAFEED_THEMES = ['light', 'dark', 'paper', 'espresso'] as const;
export type HataFeedTheme = typeof HATAFEED_THEMES[number];

function readHataFeedTheme(): HataFeedTheme {
	try {
		const saved = miLocalStorage.getItem('hatafeedTheme');
		return HATAFEED_THEMES.find(theme => theme === saved) ?? 'light';
	} catch {
		return 'light';
	}
}

export const hataFeedTheme = ref<HataFeedTheme>(readHataFeedTheme());
export function setHataFeedTheme(theme: HataFeedTheme): void {
	miLocalStorage.setItem('hatafeedTheme', theme);
	hataFeedTheme.value = theme;
}

// 旗鯖fork: 端末ローカル(プロファイル非同期)の Hataskey UI 設定。
// prefer(プロファイル)に入れると複数端末で共有されてしまう設定を、端末ごとに保持するためのもの。
// 共有 reactive ref としてエクスポートし、設定ページと UI(simple.vue)の双方が同じ状態を参照する。

// 旗鯖fork(#6): 画面幅に関係なくデッキ表示を強制するか。
// スマホ等の狭幅端末では新デッキUIが未対応で描画が壊れるため、プロファイル共有させず端末ごとに持つ。
export const deckIgnoreWidth = ref(miLocalStorage.getItem('hatasabaDeckIgnoreWidth') === 'true');
export function setDeckIgnoreWidth(v: boolean): void {
	deckIgnoreWidth.value = v;
	miLocalStorage.setItem('hatasabaDeckIgnoreWidth', v ? 'true' : 'false');
}

// 旗鯖fork: 横開きの折りたたみ端末(メインディスプレイ)向けレイアウトを使うか。
//   'auto' = 幅と入力方式から自動判定 / 'on' = 常に使う / 'off' = 使わない。
//   ⚠️端末ごとに違って当然の設定なのでプロフィール同期しない。
//     同期すると、折りたたみ端末と通常のスマホで同じアカウントを使ったときに片方が壊れる。
export type HataFoldableMode = 'auto' | 'on' | 'off';

function readFoldableMode(): HataFoldableMode {
	const v = miLocalStorage.getItem('hataFoldableLayout');
	return v === 'on' || v === 'off' ? v : 'auto';
}

export const foldableLayoutMode = ref<HataFoldableMode>(readFoldableMode());
export function setFoldableLayoutMode(v: HataFoldableMode): void {
	foldableLayoutMode.value = v;
	miLocalStorage.setItem('hataFoldableLayout', v);
}

// Hataskey UI のタイムライン・デッキで、左右スワイプをタブ移動に使うか。
// タッチやトラックパッドの操作感は端末ごとに異なるため、プロファイル同期しない。
// 未設定は true。従来どおりスワイプで移動できる。
export const tabSwipeEnabled = ref(miLocalStorage.getItem('hatasabaTabSwipeEnabled') !== 'false');
export function setTabSwipeEnabled(v: boolean): void {
	tabSwipeEnabled.value = v;
	miLocalStorage.setItem('hatasabaTabSwipeEnabled', v ? 'true' : 'false');
}

// 右ウィジェットバーの幅は端末ごとに保ち、ウィジェットの内容やプロファイルとは分ける。
export const rightWidgetsCollapsed = ref(miLocalStorage.getItem('hataRightWidgetsCollapsed') === 'true');
export function setRightWidgetsCollapsed(collapsed: boolean): void {
	rightWidgetsCollapsed.value = collapsed;
	miLocalStorage.setItem('hataRightWidgetsCollapsed', collapsed ? 'true' : 'false');
}

// 旗鯖fork(#31): ミュートしたユーザーのリアクションを、ノートのリアクションチップ自体から隠す。
//   端末ごと(プロファイル非同期)に管理し、リアクター一覧は共有ストアで安定化して参照する。
export const hideMutedReactionsLocal = ref(miLocalStorage.getItem('hataHideMutedReactions') === 'true');
export function setHideMutedReactionsLocal(v: boolean): void {
	hideMutedReactionsLocal.value = v;
	miLocalStorage.setItem('hataHideMutedReactions', v ? 'true' : 'false');
}

// 旗鯖fork(ベータ): グラスUI(グラスモーフィズム刷新)を有効化するか。端末ローカル(プロファイル非同期)。
//   有効時は <html> に 'hataGlassUi' クラスを付与し、各コンポーネントの SCSS が
//   :global(html.hataGlassUi) 配下でグラス面/ピルタブ/リアクショングロー等に差し替える。
//   ぼかしは既存の --MI-blur (useBlurEffect=false で none) を尊重する。
function applyGlassUiClass(v: boolean): void {
	if (typeof window !== 'undefined') {
		window.document.documentElement.classList.toggle('hataGlassUi', v);
	}
}

// 旗鯖fork(Hataskey UI 2 デフォルトON化): 新規ユーザー・未設定端末では自動的に ON にする。
//   判定: getItem('hataGlassUi') が 'false' の時のみ OFF (=ユーザーが明示的に OFF にした)。
//   'true' または null (未設定) は ON。
//   既存で 'true' 保存済み → true 維持 (=これまで通り ON)。
//   既存で 'false' 保存済み → false 維持 (=明示OFF のユーザーの意思を尊重)。
//   未設定 (null) → true (自動ON)。同時に localStorage にも 'true' を書き込むことで、
//   次回起動以降 (=もし将来この判定を変えたとしても) 動作が変わらない安定した状態にする。
// 旗鯖fork: Hataskey UI 2 は強制ON(有効化トグルは廃止)。過去に明示OFF('false')にした端末も含め、
//   常に ON に固定する。localStorage も 'true' に揃えて状態を安定させる。
const _initialGlassUi = true;
export const glassUiLocal = ref(_initialGlassUi);
if (miLocalStorage.getItem('hataGlassUi') !== 'true') {
	miLocalStorage.setItem('hataGlassUi', 'true');
}
export function setGlassUiLocal(v: boolean): void {
	// 強制ONのため OFF 指定は無視して常に ON にする。
	glassUiLocal.value = true;
	miLocalStorage.setItem('hataGlassUi', 'true');
	applyGlassUiClass(true);
}
// モジュール読み込み時(=アプリ起動時)に現在値をクラスへ反映。
applyGlassUiClass(glassUiLocal.value);

// 旗鯖fork(ベータ): Hataskey UI 2 でノートの吹き出しデザイン(本文枠 + ＜口)を表示するか。端末ローカル。
//   既定は false(=吹き出しを非表示 = 外側の角丸カードだけのすっきり表示)。
//   Hataskey UI 2(glassUiLocal) が有効なときのみ設定 UI に表示される。
//   有効時は <html> に 'hataGlassUiBubble' クラスを付与し、タイムライン側 SCSS が
//   glass 表示のノートに吹き出し枠(＜口付き)を描画する。
function applyGlassUiBubbleClass(v: boolean): void {
	if (typeof window !== 'undefined') {
		window.document.documentElement.classList.toggle('hataGlassUiBubble', v);
	}
}

export const glassUiBubbleLocal = ref(miLocalStorage.getItem('hataGlassUiBubble') === 'true');
export function setGlassUiBubbleLocal(v: boolean): void {
	glassUiBubbleLocal.value = v;
	miLocalStorage.setItem('hataGlassUiBubble', v ? 'true' : 'false');
	applyGlassUiBubbleClass(v);
}
applyGlassUiBubbleClass(glassUiBubbleLocal.value);

// 旗鯖fork(#34): 地震・津波情報の「お住いの都道府県」。
//   居住地はプライバシーに関わるため、サーバーには一切送らず、この端末にのみ保存する。
//   未設定は空文字。
export const earthquakePref = ref(miLocalStorage.getItem('hataEarthquakePref') ?? '');
export function setEarthquakePref(v: string): void {
	earthquakePref.value = v;
	if (v) miLocalStorage.setItem('hataEarthquakePref', v);
	else miLocalStorage.removeItem('hataEarthquakePref');
}

// 旗鯖fork(#34): 地震情報の取得間隔(秒)。'10'=リアルタイム相当(最短)。端末ローカル。
export const earthquakePollSec = ref(Number(miLocalStorage.getItem('hataEarthquakePollSec') ?? '10'));
export function setEarthquakePollSec(v: number): void {
	earthquakePollSec.value = v;
	miLocalStorage.setItem('hataEarthquakePollSec', String(v));
}

/** Viewer-only controls: account charm selection remains on the server. */
export type NoteCharmDisplay = { show: boolean; motion: boolean; showOthers: boolean; wind: boolean };

function readNoteCharmDisplay(): NoteCharmDisplay {
	try {
		const saved: unknown = JSON.parse(miLocalStorage.getItem('noteCharmDisplay') ?? '{}');
		if (saved && typeof saved === 'object') {
			const values = saved as Partial<NoteCharmDisplay>;
			return { show: values.show !== false, motion: values.motion !== false, showOthers: values.showOthers !== false, wind: values.wind !== false };
		}
	} catch { /* Use defaults when device storage is unavailable. */ }
	return { show: true, motion: true, showOthers: true, wind: true };
}

export const noteCharmDisplay = ref<NoteCharmDisplay>(readNoteCharmDisplay());
export function setNoteCharmDisplay(patch: Partial<NoteCharmDisplay>): void {
	noteCharmDisplay.value = { ...noteCharmDisplay.value, ...patch };
	try { miLocalStorage.setItem('noteCharmDisplay', JSON.stringify(noteCharmDisplay.value)); } catch { /* Session preferences still apply. */ }
}
