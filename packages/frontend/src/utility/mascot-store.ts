/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: マスコット機能の表示用ストア(P3 段階3-1)。
 *   - hata/mascot/get でデータを取得。updatedAt をキーにキャッシュし、差分があるときだけ再取得
 *   - 画像はドライブURLを fetch して Blob を IndexedDB(idb-proxy)にキャッシュし、
 *     ObjectURL を作って表示する。普段はドライブから読み込まない(エグレス削減)
 *   - updatedAt が変わったら画像キャッシュも作り直す
 *   - テキストは表示側でエスケープして使う(XSS防御)
 */

import { ref, computed } from 'vue';
import { get as idbGet, set as idbSet, del as idbDel } from '@/utility/idb-proxy.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';

const mascotSettingsCopy = i18n.ts._hata._mascotSettings;
const mascotSettingsCopyx = i18n.tsx._hata._mascotSettings;

export type MascotExpression = { id: string; label: string; url: string; driveFileId: string | null; bubbleX?: number; bubbleY?: number; bubbleScale?: number; bubbleTail?: 'left' | 'right'; motion?: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity?: number; questionEnabled?: boolean; qBubbleX?: number; qBubbleY?: number; qBubbleScale?: number; qBubbleTail?: 'left' | 'right'; textColor?: string | null; qTextColor?: string | null };
export type MascotPhrase = { id: string; text: string; expressionId: string | null };
export type MascotNotifyExpression = { url?: string | null; driveFileId?: string | null; label?: string; text?: string; motion?: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity?: number; bubbleX?: number; bubbleY?: number; bubbleScale?: number; bubbleTail?: 'left' | 'right'; exclaimEnabled?: boolean; eBubbleX?: number; eBubbleY?: number; eBubbleScale?: number; eBubbleTail?: 'left' | 'right'; textColor?: string | null; eTextColor?: string | null };
export type MascotBirthdayExpression = { url?: string | null; driveFileId?: string | null; label?: string; text?: string; motion?: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity?: number; bubbleX?: number; bubbleY?: number; bubbleScale?: number; bubbleTail?: 'left' | 'right'; textColor?: string | null };
export type MascotCharacter = { id: string; name: string; expressions: MascotExpression[]; phrases: MascotPhrase[]; notifyExpression?: MascotNotifyExpression | null; notifyExpression2?: MascotNotifyExpression | null; birthdayExpression?: MascotBirthdayExpression | null; charBirthdayEnabled?: boolean; charBirthdayMonth?: number | null; charBirthdayDay?: number | null; charBirthdayExpression?: MascotBirthdayExpression | null };
export type MascotData = {
	characters: MascotCharacter[];
	activeCharacterId: string | null;
	showName: boolean;
	updatedAt: number;
};

const DATA_CACHE_KEY = 'hataMascot:data';
const IMG_CACHE_PREFIX = 'hataMascot:img:';

// メモリ上の状態(全コンポーネントで共有)
export const mascotData = ref<MascotData | null>(null);
export const mascotLoaded = ref(false);
// driveFileId(なければurl) -> ObjectURL の解決済みマップ
const imageObjectUrls = ref<Record<string, string>>({});

// HTML エスケープ(表示前に必ず通す)
export function escapeText(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function imgCacheKey(e: MascotExpression): string {
	return IMG_CACHE_PREFIX + (e.driveFileId ?? e.url);
}

// 旗鯖fork(perf): 既存の ObjectURL を新しい blob URL で上書きする前に古い方を revoke する。
//   表示中の <img> 参照がまだ生きている瞬間に revoke すると画像が消えるリスクがあるため、
//   次フレーム(マイクロタスク)で新しい URL を Vue が反映した後に revoke を遅延させる。
function replaceObjectUrl(memoKey: string, next: string) {
	const prev = imageObjectUrls.value[memoKey];
	imageObjectUrls.value[memoKey] = next;
	if (prev && prev !== next && prev.startsWith('blob:')) {
		// 1フレーム後に解放: 表示している <img src> が next に切り替わってから revoke する。
		queueMicrotask(() => { try { URL.revokeObjectURL(prev); } catch { /* noop */ } });
	}
}

// 1枚の画像を取得(キャッシュ優先)。dataのupdatedAtが変わっていれば作り直す。
async function resolveImage(e: MascotExpression, dataUpdatedAt: number): Promise<void> {
	const key = imgCacheKey(e);
	const memoKey = e.driveFileId ?? e.url;
	try {
		const cached = await idbGet(key) as { updatedAt: number; blob: Blob } | undefined;
		if (cached && cached.updatedAt === dataUpdatedAt && cached.blob instanceof Blob) {
			replaceObjectUrl(memoKey, URL.createObjectURL(cached.blob));
			return;
		}
		// キャッシュ無し or 古い -> fetch して Blob を保存
		const res = await fetch(e.url);
		if (!res.ok) throw new Error('fetch failed');
		const blob = await res.blob();
		try { await idbSet(key, { updatedAt: dataUpdatedAt, blob }); } catch { /* localStorageフォールバック時はBlob保存不可。URL直表示にフォールバック */ }
		replaceObjectUrl(memoKey, URL.createObjectURL(blob));
	} catch {
		// 取得失敗時は元のURLを直接使う(最低限表示はできる)
		replaceObjectUrl(memoKey, e.url);
	}
}

// 表情の表示用URL(ObjectURL優先、なければ元URL)
export function expressionDisplayUrl(e: MascotExpression | null | undefined): string {
	if (!e) return '';
	const memoKey = e.driveFileId ?? e.url;
	return imageObjectUrls.value[memoKey] ?? e.url;
}

// 旧ObjectURLを解放
function revokeAll() {
	for (const u of Object.values(imageObjectUrls.value)) {
		if (u.startsWith('blob:')) URL.revokeObjectURL(u);
	}
	imageObjectUrls.value = {};
}

// 旗鯖fork(perf): タブを閉じる/リロード時に残った ObjectURL を解放してリークを防ぐ。
//   ページ遷移(SPA内)では発火しないので、replaceObjectUrl 側で逐次回収するのと両輪。
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		for (const u of Object.values(imageObjectUrls.value)) {
			if (u.startsWith('blob:')) {
				try { URL.revokeObjectURL(u); } catch { /* noop */ }
			}
		}
	});
}

// データを読み込む。キャッシュを即時反映し、サーバーと updatedAt が違えば更新する。
export async function loadMascot(force = false): Promise<void> {
	// まずキャッシュを反映(即表示)
	if (!force) {
		try {
			const cached = await idbGet(DATA_CACHE_KEY) as MascotData | undefined;
			if (cached) {
				mascotData.value = cached;
				await resolveImagesFor(cached);
			}
		} catch { /* noop */ }
	}

	// サーバーから最新を取得して updatedAt を比較
	try {
		const res = await misskeyApi('hata/mascot/get', {});
		const data = res.data as MascotData | Record<string, never>;
		if (!data || !Array.isArray((data as MascotData).characters) || (data as MascotData).characters.length === 0) {
			mascotData.value = null;
			mascotLoaded.value = true;
			return;
		}
		const fresh = data as MascotData;
		const prev = mascotData.value;
		if (!prev || prev.updatedAt !== fresh.updatedAt || force) {
			revokeAll();
			mascotData.value = fresh;
			try { await idbSet(DATA_CACHE_KEY, fresh); } catch { /* noop */ }
			await resolveImagesFor(fresh);
		}
	} catch {
		// オフライン等。キャッシュがあればそれを使う
	} finally {
		mascotLoaded.value = true;
	}
}

async function resolveImagesFor(data: MascotData): Promise<void> {
	const tasks: Promise<void>[] = [];
	for (const c of data.characters) {
		for (const e of c.expressions) {
			tasks.push(resolveImage(e, data.updatedAt));
		}
	}
	await Promise.allSettled(tasks);
}

export async function clearMascotCache(): Promise<void> {
	revokeAll();
	try { await idbDel(DATA_CACHE_KEY); } catch { /* noop */ }
	// 個別画像キャッシュは updatedAt 変更時に上書きされるため、ここでは data キャッシュのみ消す
}

// アクティブキャラ
export const activeCharacter = computed<MascotCharacter | null>(() => {
	const d = mascotData.value;
	if (!d) return null;
	return d.characters.find(c => c.id === d.activeCharacterId) ?? d.characters[0] ?? null;
});

// 旗鯖fork(タスク8): Hatask のホーム画面でマスコットカードを表示している間 true。
// フローティングマスコット(MkMascotFloating)はこれが true の間は表示を抑制し、
// 画面に2体並ばないようにする(連動非表示)。
export const hatakMascotActive = ref(false);

// 旗鯖fork(#11): フローティングマスコットが画面に吹き出しを表示できる状態(visible かつ 最小化していない)か。
// マスコットウィジェットはこれが true の間、特殊イベント(通知/誕生日)の吹き出しを抑制し、
// フローティングと二重に出さないようにする(同じアクティブキャラのため、ウィジェット側を抑制する)。
export const floatingMascotShown = ref(false);

// 現在の文言・表情(ランダム選択)
export const currentPhrase = ref<MascotPhrase | null>(null);

export function pickRandomPhrase(): void {
	const c = activeCharacter.value;
	if (!c || c.phrases.length === 0) { currentPhrase.value = null; return; }
	// 直前と違うものを選ぶ(1つしかない場合はそのまま)
	if (c.phrases.length === 1) { currentPhrase.value = c.phrases[0]; return; }
	let next: MascotPhrase;
	do {
		next = c.phrases[Math.floor(Math.random() * c.phrases.length)];
	} while (next.id === currentPhrase.value?.id);
	currentPhrase.value = next;
}

// 現在の表情(announce中はその表情、なければ文言に紐づくもの、なければ先頭表情)
export const currentExpression = computed<MascotExpression | null>(() => {
	const c = activeCharacter.value;
	if (!c) return null;
	// announce中はそのメッセージが指定する表情(種別)を優先
	if (announceMessage.value) {
		const t = announceMessage.value.expressionType;
		// 通知用・誕生日用は専用スロットを最優先で使う
		if (t === 'notify') {
			const nx = pickNotifyExpressionByVariant(c, announceMessage.value.notifyVariant);
			if (nx && (nx.url || nx.driveFileId)) return notifyToExpression(nx);
		}
		if (t === 'birthday' && c.birthdayExpression && (c.birthdayExpression.url || c.birthdayExpression.driveFileId)) {
			return birthdayToExpression(c.birthdayExpression);
		}
		if (t === 'charBirthday' && c.charBirthdayExpression && (c.charBirthdayExpression.url || c.charBirthdayExpression.driveFileId)) {
			return birthdayToExpression(c.charBirthdayExpression);
		}
		if (t) {
			const byType = findExpressionByType(c, t);
			if (byType) return byType;
		}
		const linkedA = announceMessage.value.expressionId;
		if (linkedA) {
			const f = c.expressions.find(e => e.id === linkedA);
			if (f) return f;
		}
	}
	const linked = currentPhrase.value?.expressionId;
	if (linked) {
		const found = c.expressions.find(e => e.id === linked);
		if (found) return found;
	}
	return c.expressions[0] ?? null;
});

// 通知表情が有効か(画像が設定されているか)
function isNotifyUsable(n: MascotNotifyExpression | null | undefined): boolean {
	return !!(n && (n.url || n.driveFileId));
}
// 有効な通知表情の variant 一覧(0=notifyExpression, 1=notifyExpression2)
function usableNotifyVariants(c: MascotCharacter): Array<0 | 1> {
	const arr: Array<0 | 1> = [];
	if (isNotifyUsable(c.notifyExpression)) arr.push(0);
	if (isNotifyUsable(c.notifyExpression2)) arr.push(1);
	return arr;
}
// variant 指定で通知表情を返す(未指定なら variant 0)
function pickNotifyExpressionByVariant(c: MascotCharacter, variant: 0 | 1 | undefined): MascotNotifyExpression | null {
	if (variant === 1) return c.notifyExpression2 ?? null;
	return c.notifyExpression ?? null;
}
// 有効な通知表情からランダムに variant を選ぶ(両方有効ならランダム、片方ならそれ、無ければ null)
export function chooseNotifyVariant(c: MascotCharacter | null): 0 | 1 | null {
	if (!c) return null;
	const vs = usableNotifyVariants(c);
	if (vs.length === 0) return null;
	return vs[Math.floor(Math.random() * vs.length)];
}

// 専用スロット(通知用/誕生日用)を MascotExpression 互換に変換
function notifyToExpression(n: NonNullable<MascotCharacter['notifyExpression']>): MascotExpression {
	return {
		id: '__notify__', label: n.label ?? '', url: n.url ?? '', driveFileId: n.driveFileId ?? null,
		bubbleX: n.bubbleX, bubbleY: n.bubbleY, bubbleScale: n.bubbleScale, bubbleTail: n.bubbleTail,
		motion: n.motion, motionIntensity: n.motionIntensity,
		questionEnabled: n.exclaimEnabled, qBubbleX: n.eBubbleX, qBubbleY: n.eBubbleY, qBubbleScale: n.eBubbleScale, qBubbleTail: n.eBubbleTail,
		textColor: n.textColor, qTextColor: n.eTextColor,
	} as MascotExpression;
}
function birthdayToExpression(b: NonNullable<MascotCharacter['birthdayExpression']>): MascotExpression {
	return {
		id: '__birthday__', label: b.label ?? '', url: b.url ?? '', driveFileId: b.driveFileId ?? null,
		bubbleX: b.bubbleX, bubbleY: b.bubbleY, bubbleScale: b.bubbleScale, bubbleTail: b.bubbleTail,
		motion: b.motion, motionIntensity: b.motionIntensity,
		textColor: b.textColor,
	} as MascotExpression;
}

// ===== 表情の種別 =====
// 立ち絵に種別(通知/笑/泣/ノーマル/疑問/怒)を持たせ、状況に応じた表情を出せるようにする。
// 正式なフィールド追加は後の段階で行うが、当面はラベル文字列からの簡易マッチで対応する。
export type ExpressionType = 'notify' | 'birthday' | 'charBirthday' | 'smile' | 'cry' | 'normal' | 'question' | 'angry';
const EXPR_TYPE_KEYWORDS: Record<ExpressionType, string[]> = {
	notify: ['通知', 'notify', 'notification', 'お知らせ'],
	birthday: ['誕生', 'birthday', 'バースデー', 'お祝い'],
	charBirthday: ['誕生', 'birthday', 'バースデー', 'お祝い'],
	smile: ['笑', 'smile', 'happy', 'うれし', '嬉'],
	cry: ['泣', 'cry', 'sad', 'かなし', '悲'],
	normal: ['ノーマル', 'normal', '通常', 'デフォルト', 'default'],
	question: ['疑問', 'question', 'はてな', '?', '？'],
	angry: ['怒', 'angry', 'おこ'],
};
export function findExpressionByType(c: MascotCharacter, type: ExpressionType): MascotExpression | null {
	const kws = EXPR_TYPE_KEYWORDS[type] ?? [];
	for (const e of c.expressions) {
		const label = (e.label ?? '').toLowerCase();
		if (kws.some(k => label.includes(k.toLowerCase()))) return e;
	}
	return null;
}

// ===== 表示設定(registry 端末共通) =====
// 「マスコットが何を伝えるか」のトグル群と、標準通知トーストの無効化トグル。
const SETTINGS_SCOPE = ['client', 'hataMascot'];
const SETTINGS_KEY = 'displaySettings';

export type MascotDisplaySettings = {
	tellBirthday: boolean;       // 誕生日を祝う
	tellNotifications: boolean;  // 通知を伝える(来たとき)
	tellRandomPhrases: boolean;  // 設定文言をランダム表示
	tellUnreadOnLogin: boolean;  // ログイン時の未読通知数
	tellHataskNotifications: boolean; // Hataskの通知を伝える
	suppressStandardToast: boolean;   // 通知を伝える時に標準トーストを無効化
	notifyDurationSec: number;        // 通知用表情の表示秒数(デフォルト3)
	floatingEnabledDesktop: boolean;  // デスクトップでフローティング表示
	floatingEnabledMobile: boolean;   // モバイルでフローティング表示
	floatingX: number;                // フローティング位置X(px、左上基準)
	floatingY: number;                // フローティング位置Y(px、左上基準)
	floatingBackdropOpacity: number;  // フローティングのぼかし背景の濃さ(0〜1、0で無効)
	floatingBackdropColor: string;    // フローティングのぼかし背景の色(#rrggbb)
	floatingFlip: boolean;            // フローティングの立ち絵を左右反転
	floatingOpacity: number;          // フローティング全体の透過度(0.1〜1)
	floatingMinimizeCorner: 'left' | 'right'; // 最小化時に小ボタンを出す位置(左下/右下)
	idleMinSec: number;               // 表情/文言の自動切替の最短間隔(秒)
	idleMaxSec: number;               // 表情/文言の自動切替の最長間隔(秒)
};

export const defaultDisplaySettings: MascotDisplaySettings = {
	tellBirthday: true,
	tellNotifications: true,
	tellRandomPhrases: true,
	tellUnreadOnLogin: true,
	tellHataskNotifications: true,
	suppressStandardToast: true,
	notifyDurationSec: 3,
	floatingEnabledDesktop: true,
	floatingEnabledMobile: false,
	floatingX: -1,
	floatingY: -1,
	floatingBackdropOpacity: 0.25,
	floatingBackdropColor: '#000000',
	floatingFlip: false,
	floatingOpacity: 1,
	floatingMinimizeCorner: 'right',
	idleMinSec: 5,
	idleMaxSec: 12,
};

export const displaySettings = ref<MascotDisplaySettings>({ ...defaultDisplaySettings });
export const displaySettingsLoaded = ref(false);

export async function loadDisplaySettings(): Promise<void> {
	try {
		const v = await misskeyApi('i/registry/get', { key: SETTINGS_KEY, scope: SETTINGS_SCOPE }) as Partial<MascotDisplaySettings> | null;
		displaySettings.value = { ...defaultDisplaySettings, ...(v ?? {}) };
	} catch {
		displaySettings.value = { ...defaultDisplaySettings };
	} finally {
		displaySettingsLoaded.value = true;
	}
}
export async function saveDisplaySettings(v: MascotDisplaySettings): Promise<void> {
	displaySettings.value = v;
	try { await misskeyApi('i/registry/set', { key: SETTINGS_KEY, value: v, scope: SETTINGS_SCOPE }); } catch { /* noop */ }
}

// フローティング位置だけを更新して保存する(ドラッグ終了時に呼ぶ)。
export async function saveFloatingPosition(x: number, y: number): Promise<void> {
	const v = { ...displaySettings.value, floatingX: Math.round(x), floatingY: Math.round(y) };
	await saveDisplaySettings(v);
}

// 表情/文言の自動切替の次の遅延(ms)を、設定の最短〜最長からランダムに返す。
// 専用ページ・フローティング共通。範囲は5秒〜1800秒(30分)にクランプし、min>maxなら入れ替える。
export function nextIdleDelayMs(): number {
	const IDLE_LIMIT_MIN = 5;
	const IDLE_LIMIT_MAX = 1800;
	let lo = typeof displaySettings.value.idleMinSec === 'number' ? displaySettings.value.idleMinSec : 5;
	let hi = typeof displaySettings.value.idleMaxSec === 'number' ? displaySettings.value.idleMaxSec : 12;
	lo = Math.min(Math.max(lo, IDLE_LIMIT_MIN), IDLE_LIMIT_MAX);
	hi = Math.min(Math.max(hi, IDLE_LIMIT_MIN), IDLE_LIMIT_MAX);
	if (lo > hi) { const t = lo; lo = hi; hi = t; }
	return (lo + Math.random() * (hi - lo)) * 1000;
}

// 標準通知トーストを抑制すべきか(common.vue から参照)。
// 「通知を伝える」かつ「標準トースト無効化」が両方ON、かつ実際にマスコットが表示されている時だけ抑制する。
// (マスコットが表示されていない画面で抑制すると通知が完全に見えなくなるため)
//
// 旗鯖fork: mascotVisible に加えて立ち絵 URL が解決できることも条件に含める。MkMascotFloating の
// visible 修正と二重ガード。これにより、マスコット画像未設定 + フローティング ON のユーザーで
// 通知トーストが完全に消える不具合を確実に防ぐ。
export const mascotVisible = ref(false);
export function shouldSuppressStandardToast(): boolean {
	return mascotVisible.value === true
		&& displaySettings.value.tellNotifications === true
		&& displaySettings.value.suppressStandardToast === true
		&& expressionDisplayUrl(currentExpression.value) !== '';
}

// ===== announce(割り込みメッセージ) =====
// 通知・誕生日・未読などをマスコットに一時的に喋らせる。一定時間で消えてアイドルに戻る。
export type AnnounceMessage = {
	text: string;
	expressionType?: ExpressionType | null;
	expressionId?: string | null;
	notifyVariant?: 0 | 1;  // 通知表情のどちらを使うか(0=notifyExpression, 1=notifyExpression2)
};
export const announceMessage = ref<AnnounceMessage | null>(null);
let announceTimer: ReturnType<typeof setTimeout> | null = null;

export function announce(text: string, opts: { expressionType?: ExpressionType | null; durationMs?: number; notifyVariant?: 0 | 1 } = {}): void {
	announceMessage.value = { text, expressionType: opts.expressionType ?? 'notify', notifyVariant: opts.notifyVariant };
	if (announceTimer) clearTimeout(announceTimer);
	announceTimer = setTimeout(() => { announceMessage.value = null; announceTimer = null; }, opts.durationMs ?? 8000);
}

// 割り込みメッセージを即時クリア(手動で「次の文言」を押したときなどに使う)。
export function clearAnnounce(): void {
	if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }
	announceMessage.value = null;
}

// 通知が来たときにマスコットに喋らせる。
// 「通知用表情の文言(前置き)」+ 改行 + 「通知の内容(誰が何をしたか)」を吹き出しに表示する。
// 表示時間は設定の notifyDurationSec(秒)。表示中に次の通知が来たらタイマーがリセットされ(延長)、
// 吹き出しの内容も最新の通知に更新される(重ね掛け)。
export function announceNotification(notification: NotificationLike | null | undefined): void {
	// app通知(Hataskのタスク/ToDo/きもち記録など)は専用フラグで制御。それ以外は通常の通知フラグ。
	const isApp = notification?.type === 'app';
	if (isApp) {
		if (!displaySettings.value.tellHataskNotifications) return;
	} else {
		if (!displaySettings.value.tellNotifications) return;
	}
	const c = activeCharacter.value;
	// 有効な通知表情(2種)からランダムに選ぶ。選んだ方の文言を前置きにする。
	const variant = chooseNotifyVariant(c);
	const chosen = variant === 1 ? c?.notifyExpression2 : c?.notifyExpression;
	const preface = chosen?.text?.trim() ?? '';
	const content = notificationContentText(notification);
	const text = preface ? `${preface}\n${content}` : content;
	const sec = typeof displaySettings.value.notifyDurationSec === 'number' ? displaySettings.value.notifyDurationSec : 3;
	announce(text, { expressionType: 'notify', durationMs: Math.max(1, sec) * 1000, notifyVariant: variant ?? 0 });
}

// 外部アカウントの通知をマスコットに伝える。標準通知と同じ構造なので notificationContentText を使う。
// 「外部アカウントで」と前置きして、どこの通知か分かるようにする。
export function announceExternalNotification(notification: NotificationLike | null | undefined): void {
	if (!displaySettings.value.tellNotifications) return;
	const c = activeCharacter.value;
	const variant = chooseNotifyVariant(c);
	const chosen = variant === 1 ? c?.notifyExpression2 : c?.notifyExpression;
	const preface = chosen?.text?.trim() ?? '';
	const content = notificationContentText(notification);
	const body = mascotSettingsCopyx.externalAccountNotification({ content });
	const text = preface ? `${preface}\n${body}` : body;
	const sec = typeof displaySettings.value.notifyDurationSec === 'number' ? displaySettings.value.notifyDurationSec : 3;
	announce(text, { expressionType: 'notify', durationMs: Math.max(1, sec) * 1000, notifyVariant: variant ?? 0 });
}

type NotificationLike = {
	type?: string;
	user?: { name?: string | null; username?: string } | null;
	users?: Array<{ name?: string | null; username?: string }> | null;
	reaction?: string | null;
	header?: string | null;
	body?: string | null;
} | null | undefined;

// 通知内容(誰が何をしたか)を1行の文言にする。
function notificationContentText(n: NotificationLike): string {
	// grouped 系は users 配列の先頭から名前を拾う
	const groupedName = n?.users?.[0]?.name || n?.users?.[0]?.username;
	const name = n?.user?.name || n?.user?.username || groupedName || mascotSettingsCopy.unknownUser;
	switch (n?.type) {
		case 'follow': return mascotSettingsCopyx.notificationFollow({ name });
		case 'followRequestAccepted': return mascotSettingsCopyx.notificationFollowRequestAccepted({ name });
		case 'receiveFollowRequest': return mascotSettingsCopyx.notificationReceiveFollowRequest({ name });
		case 'mention': return mascotSettingsCopyx.notificationMention({ name });
		case 'reply': return mascotSettingsCopyx.notificationReply({ name });
		case 'renote':
		case 'renote:grouped': return mascotSettingsCopyx.notificationRenote({ name });
		case 'quote': return mascotSettingsCopyx.notificationQuote({ name });
		case 'reaction':
		case 'reaction:grouped':
		case 'reaction:groupedByUser': return mascotSettingsCopyx.notificationReaction({ name });
		case 'note':
		case 'note:grouped': return mascotSettingsCopyx.notificationNote({ name });
		case 'pollEnded': return mascotSettingsCopy.notificationPollEnded;
		case 'achievementEarned': return mascotSettingsCopy.notificationAchievementEarned;
		case 'roleAssigned': return mascotSettingsCopy.notificationRoleAssigned;
		case 'login': return mascotSettingsCopy.notificationLogin;
		case 'hataskDecorationUnlocked':
		case 'app': {
			// Hatask等のアプリ通知。header(件名)/body(本文)があればそれを使う。
			const head = (n?.header ?? '').trim();
			const bdy = (n?.body ?? '').trim();
			if (head && bdy) return `${head}：${bdy}`;
			if (head) return head;
			if (bdy) return bdy;
			return mascotSettingsCopy.notificationApp;
		}
		case 'test': return mascotSettingsCopy.notificationTest;
		default:
			return mascotSettingsCopy.notificationDefault;
	}
}

// 誕生日を祝う。誕生日用表情の文言があればそれを使う。
export function announceBirthday(): void {
	if (!displaySettings.value.tellBirthday) return;
	const c = activeCharacter.value;
	const custom = c?.birthdayExpression?.text?.trim();
	const text = custom || mascotSettingsCopy.birthdayDefault;
	announce(text, { expressionType: 'birthday', durationMs: 12000 });
}

// 今日がアクティブキャラ自身の誕生日か(月日で毎年)。
export function isCharBirthdayToday(): boolean {
	const c = activeCharacter.value;
	if (!c || c.charBirthdayEnabled !== true) return false;
	if (typeof c.charBirthdayMonth !== 'number' || typeof c.charBirthdayDay !== 'number') return false;
	const now = new Date();
	return (now.getMonth() + 1) === c.charBirthdayMonth && now.getDate() === c.charBirthdayDay;
}

// キャラ自身の誕生日にキャラが言う。専用表情・文言を使う。
export function announceCharBirthday(): void {
	if (!isCharBirthdayToday()) return;
	const c = activeCharacter.value;
	const custom = c?.charBirthdayExpression?.text?.trim();
	const text = custom || mascotSettingsCopy.characterBirthdayDefault;
	announce(text, { expressionType: 'charBirthday', durationMs: 8000 });
}

// ログイン時に未読通知件数を伝える。
export function announceUnread(count: number): void {
	if (!displaySettings.value.tellUnreadOnLogin) return;
	if (!count || count <= 0) return;
	announce(mascotSettingsCopyx.unreadNotificationCount({ count }), { expressionType: 'notify' });
}

// 表示すべきテキスト(announce優先、なければ現在のランダム文言)。表示側でエスケープして使う。
export const displayText = computed<string>(() => {
	if (announceMessage.value) return announceMessage.value.text;
	if (displaySettings.value.tellRandomPhrases) return currentPhrase.value?.text ?? '';
	return '';
});
