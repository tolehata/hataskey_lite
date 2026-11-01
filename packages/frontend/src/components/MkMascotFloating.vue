<!--
旗鯖fork: フローティングマスコット(段階C: 土台 + 吹き出し連携 + 縁取り黒ぼかし + クリックで次の文言)
どの画面でも最前面にマスコットを浮かべる。ドラッグで移動でき、位置は registry(displaySettings) に保存。
表示ON/OFFはデスクトップ/モバイルで別設定(floatingEnabledDesktop / floatingEnabledMobile)。
通知/誕生日/未読/ランダム文言で吹き出しを表示(displayText/announce を専用ページと共有)。
視認性のため、立ち絵のシルエットに沿った黒いぼかし(drop-shadow)を敷く(濃さは floatingBackdropOpacity)。
クリック(ドラッグでない)で次の文言へ。最小化は段階③、設定UIは段階④で追加する。
-->
<template>
<!-- 最小化時: 左下/右下に小ボタンだけ残す -->
<button
	v-if="visible && shownUrl && minimized"
	:class="[$style.miniBtn, minimizeCorner === 'left' ? $style.miniLeft : $style.miniRight]"
	@click="restore"
	:title="copy.showMascot"
>
	<img :src="shownUrl" :class="$style.miniImg" draggable="false" alt="mascot" />
</button>

<!-- 通常表示 -->
<div
	v-if="visible && shownUrl && !minimized"
	:class="$style.root"
	:style="rootStyle"
>
	<!-- 操作ボタン(ホバー時に表示) -->
	<div :class="$style.controls">
		<button :class="$style.ctrlBtn" @click.stop="toggleQuickPanel" :title="copy.quickSettings"><i class="ti ti-adjustments"></i></button>
		<button :class="$style.ctrlBtn" @click.stop="minimize" :title="copy.minimize"><i class="ti ti-minus"></i></button>
	</div>

	<!-- かんたん設定パネル(吹き出し形式) -->
	<div v-if="quickPanelOpen" :class="$style.quickPanel" @pointerdown.stop @click.stop>
		<div :class="$style.qpRow">
			<span>{{ copy.opacity }}</span>
			<input type="range" min="0.1" max="1" step="0.05" :value="displaySettings.floatingOpacity" @input="setOpacity($event)" />
		</div>
		<div :class="$style.qpRow">
			<span>{{ copy.flip }}</span>
			<button :class="[$style.qpToggle, displaySettings.floatingFlip && $style.qpToggleOn]" @click="toggleFlip"></button>
		</div>
	</div>

	<!-- ドラッグ&クリックの対象(立ち絵+吹き出し) -->
	<div :class="$style.stage" @pointerdown="onPointerDown" @click="onClick">
		<!-- 立ち絵。反転は外側ラッパーで行い、img本体の translate/motion transform を壊さない。 -->
		<div :class="$style.imgFlip" :style="flipStyle">
			<img :src="shownUrl" :class="[$style.img, motionName === 'bounce' ? 'htkFloatMotionBounce' : motionName === 'shake' ? 'htkFloatMotionShake' : motionName === 'sway' ? 'htkFloatMotionSway' : motionName === 'spin' ? 'htkFloatMotionSpin' : '']" :style="imgStyle" draggable="false" :alt="shownExpression?.label || 'mascot'" />
		</div>
		<!-- 文言の吹き出し(表情ごとの位置に重ねる) -->
		<div v-if="phraseText" :class="[$style.bubble, bubbleTail === 'right' ? $style.tail_right : $style.tail_left]" :style="bubbleStyle">{{ phraseText }}</div>
		<!-- ？小吹き出し(疑問トグルON時) -->
		<div v-if="qEnabled" :class="[$style.qBubble, qTail === 'right' ? $style.qtail_right : $style.qtail_left]" :style="qBubbleStyle">?</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { deviceKind } from '@/utility/device-kind.js';
import { mainRouter } from '@/router.js';
import { hataMascotSuppressed } from '@/utility/hata-mascot-suppression.js';
import { i18n } from '@/i18n.js';
import {
	mascotLoaded, loadMascot,
	currentExpression, pickRandomPhrase, clearAnnounce,
	expressionDisplayUrl, escapeText,
	displayText, announceMessage,
	displaySettings, displaySettingsLoaded, loadDisplaySettings,
	saveFloatingPosition, saveDisplaySettings,
	mascotVisible,
	nextIdleDelayMs,
	hatakMascotActive,
	floatingMascotShown,
} from '@/utility/mascot-store.js';

const copy = i18n.ts._hata._mascotFloating;
const isDesktop = deviceKind === 'desktop';
const suppressedForHataFamily = computed(() => {
	const path = mainRouter.currentRef.value._parsedRoute.fullPath.split(/[?#]/u, 1)[0];
	return hataMascotSuppressed.value || /^\/(?:hatagoes|hatask|hatady|hatafeed)(?:\/|$)/u.test(path);
});

// 表示するか(デスクトップ/モバイルで別設定)
const visible = computed(() => {
	if (suppressedForHataFamily.value) return false;
	if (!mascotLoaded.value || !displaySettingsLoaded.value) return false;
	// 旗鯖fork(タスク8): Hatask でマスコットカードを表示中は、フローティングを隠して2体並ぶのを防ぐ
	if (hatakMascotActive.value) return false;
	// 旗鯖fork: 立ち絵 (表情画像) の URL が解決できない場合は実体描画されないため visible=false にする。
	// ユーザーがマスコット画像を未設定のまま「フローティング ON」だけ立てている時、従来は
	// mascotVisible=true となり shouldSuppressStandardToast() が真 → 通知トーストが完全に消える
	// (マスコットも実体は描画されないので通知が一切表示されない) という不具合があった。
	const hasShownImage = expressionDisplayUrl(currentExpression.value) !== '';
	if (!hasShownImage) return false;
	return isDesktop ? displaySettings.value.floatingEnabledDesktop : displaySettings.value.floatingEnabledMobile;
});

// 立ち絵(画像をデコードしてから表示)。表情切替に追従。
const shownUrl = ref('');
const shownExpression = ref<typeof currentExpression.value>(null);
const pendingUrl = computed(() => expressionDisplayUrl(currentExpression.value));

let applyToken = 0;
async function applyPending() {
	const token = ++applyToken;
	const url = pendingUrl.value;
	if (url) {
		try { const img = new Image(); img.src = url; if (img.decode) await img.decode(); } catch { /* noop */ }
	}
	if (token !== applyToken) return;
	shownUrl.value = url;
	shownExpression.value = currentExpression.value;
}
// 同じ画像・文言のまま位置を保存した場合も、新しい表情の設定へ更新する。
watch([pendingUrl, displayText, currentExpression], () => { applyPending(); });

// ===== 立ち絵モーション(専用ページと同じ。keyframesは下の素styleで固定値定義) =====
const motionName = computed(() => shownExpression.value?.motion ?? 'none');

// ===== 吹き出し(displayText を専用ページと同じく表示) =====
const phraseText = computed(() => displayText.value ? escapeText(displayText.value) : '');
const bubbleStyle = computed(() => {
	const e = shownExpression.value;
	const x = (typeof e?.bubbleX === 'number' ? e.bubbleX : 0.5);
	const y = (typeof e?.bubbleY === 'number' ? e.bubbleY : 0.1);
	const scale = (typeof e?.bubbleScale === 'number' ? e.bubbleScale : 1);
	const s: Record<string, string> = { left: (x * 100) + '%', top: (y * 100) + '%', fontSize: (0.85 * scale) + 'rem' };
	if (e?.textColor) s.color = e.textColor;
	return s;
});
const bubbleTail = computed<'left' | 'right'>(() => (shownExpression.value?.bubbleTail === 'right' ? 'right' : 'left'));
const qEnabled = computed(() => shownExpression.value?.questionEnabled === true);
const qTail = computed<'left' | 'right'>(() => (shownExpression.value?.qBubbleTail === 'right' ? 'right' : 'left'));
const qBubbleStyle = computed(() => {
	const e = shownExpression.value;
	const x = (typeof e?.qBubbleX === 'number' ? e.qBubbleX : 0.7);
	const y = (typeof e?.qBubbleY === 'number' ? e.qBubbleY : 0.05);
	const scale = (typeof e?.qBubbleScale === 'number' ? e.qBubbleScale : 1);
	const s: Record<string, string> = { left: (x * 100) + '%', top: (y * 100) + '%', fontSize: (0.85 * scale) + 'rem' };
	if (e?.qTextColor) s.color = e.qTextColor;
	return s;
});

// ===== 縁取り黒ぼかし(立ち絵のシルエットに沿った drop-shadow) =====
// 濃さ0で無効。デフォルトはやや明るめ。黒丸にせず画像の形に沿わせる。
const backdropOpacity = computed(() => {
	const v = displaySettings.value.floatingBackdropOpacity;
	return typeof v === 'number' ? Math.min(Math.max(v, 0), 1) : 0;
});
// #rrggbb / #rgb を "r,g,b" に変換(不正値は黒)
function hexToRgb(hex: string): string {
	const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '');
	if (!m) return '0,0,0';
	let h = m[1];
	if (h.length === 3) h = h.split('').map(c => c + c).join('');
	const n = parseInt(h, 16);
	return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
const backdropRgb = computed(() => hexToRgb(displaySettings.value.floatingBackdropColor || '#000000'));

const imgStyle = computed(() => {
	const o = backdropOpacity.value;
	const base = 'drop-shadow(0 4px 16px rgba(0,0,0,.3))';
	if (o <= 0) return { filter: base };
	// 設定色のぼかしを複数方向に重ねてシルエットの縁取りにする
	const c = `rgba(${backdropRgb.value},${o})`;
	const glow = `drop-shadow(0 0 6px ${c}) drop-shadow(0 0 12px ${c}) drop-shadow(0 0 18px ${c})`;
	return { filter: `${glow} ${base}` };
});

// ===== 位置(px、左上基準) =====
const SIZE_W = 200;
const SIZE_H = 150;
const posX = ref(0);
const posY = ref(0);

function initPosition() {
	const sx = displaySettings.value.floatingX;
	const sy = displaySettings.value.floatingY;
	if (typeof sx === 'number' && sx >= 0 && typeof sy === 'number' && sy >= 0) {
		posX.value = sx;
		posY.value = sy;
	} else {
		posX.value = Math.max(0, window.innerWidth - SIZE_W - 24);
		posY.value = Math.max(0, window.innerHeight - SIZE_H - 96);
	}
	clampToViewport();
}

function clampToViewport() {
	const maxX = Math.max(0, window.innerWidth - 40);
	const maxY = Math.max(0, window.innerHeight - 40);
	posX.value = Math.min(Math.max(0, posX.value), maxX);
	posY.value = Math.min(Math.max(0, posY.value), maxY);
}

const rootStyle = computed(() => ({
	left: posX.value + 'px',
	top: posY.value + 'px',
	opacity: String(clampOpacity(displaySettings.value.floatingOpacity)),
}));

// ===== 最小化 / 反転 / 透過度 / かんたん設定パネル =====
const minimized = ref(false);          // セッション内のみ(リロードで復帰)

// 旗鯖fork(#11): フローティングが吹き出しを出せる状態(表示中 かつ 最小化していない)をストアに共有する。
// マスコットウィジェットはこれを見て特殊イベントの二重表示を抑制する。
watch([visible, minimized], () => {
	floatingMascotShown.value = visible.value && !minimized.value;
}, { immediate: true });
const quickPanelOpen = ref(false);
// 旗鯖fork: 最小化ボタンの位置は常に右下に固定する。
//   左下は下部ナビバー等の他UIと重なって操作不能になるため、左下の選択肢(および位置設定UI)を廃止。
//   既存で 'left' を保存済みのユーザーも右下へ矯正される。
const minimizeCorner = computed<'left' | 'right'>(() => 'right');

function clampOpacity(v: unknown): number {
	const n = typeof v === 'number' ? v : 1;
	return Math.min(1, Math.max(0.1, n));
}
function minimize() { minimized.value = true; quickPanelOpen.value = false; }
function restore() { minimized.value = false; }
function toggleQuickPanel() { quickPanelOpen.value = !quickPanelOpen.value; }
function setOpacity(ev: Event) {
	const v = parseFloat((ev.target as HTMLInputElement).value);
	saveDisplaySettings({ ...displaySettings.value, floatingOpacity: clampOpacity(v) });
}
function toggleFlip() {
	saveDisplaySettings({ ...displaySettings.value, floatingFlip: !displaySettings.value.floatingFlip });
}
const flipStyle = computed(() => ({
	transform: displaySettings.value.floatingFlip ? 'scaleX(-1)' : 'none',
}));

// ===== ドラッグ移動 + クリックで次の文言 =====
let dragging = false;
let startPX = 0, startPY = 0, startX = 0, startY = 0;
let moved = false;

function onPointerDown(ev: PointerEvent) {
	dragging = true;
	moved = false;
	startPX = ev.clientX;
	startPY = ev.clientY;
	startX = posX.value;
	startY = posY.value;
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
}
function onPointerMove(ev: PointerEvent) {
	if (!dragging) return;
	const dx = ev.clientX - startPX;
	const dy = ev.clientY - startPY;
	if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
	posX.value = startX + dx;
	posY.value = startY + dy;
}
function onPointerUp() {
	if (!dragging) return;
	dragging = false;
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	if (moved) {
		clampToViewport();
		saveFloatingPosition(posX.value, posY.value);
	}
}
// クリック(ドラッグでない)で次の文言へ
function onClick() {
	if (moved) return;
	clearAnnounce();
	pickRandomPhrase();
}

function onResize() { clampToViewport(); }

// ===== 通常時の自動ローテーション(一定間隔で文言/表情を切り替え) =====
// announce中(通知/誕生日/未読の表示中)は切り替えない。
// 専用ページと同じく、ランダムな間隔(5〜12秒)で文言と紐づく表情を切り替える。
let rotateTimer: ReturnType<typeof setTimeout> | null = null;
function startRotation() {
	stopRotation();
	const delay = nextIdleDelayMs();
	rotateTimer = setTimeout(() => {
		if (!announceMessage.value) pickRandomPhrase(); // 通知等の表示中は維持
		startRotation(); // 次の切替を予約(毎回ランダムな間隔)
	}, delay);
}
function stopRotation() {
	if (rotateTimer) { clearTimeout(rotateTimer); rotateTimer = null; }
}

onMounted(async () => {
	await Promise.allSettled([loadMascot(), loadDisplaySettings()]);
	pickRandomPhrase();
	await applyPending();
	initPosition();
	// 旗鯖fork: マスコットが実際に表示されている時だけ mascotVisible を立てる。
	//   従来は無条件で true にしていたため、フローティング無効(特にモバイル既定)でも
	//   shouldSuppressStandardToast() が真になり、マスコットが出ていないのに
	//   標準の通知トーストが抑制されて「通知が一切出ない」状態になっていた(hata-11.6 以来の不具合)。
	mascotVisible.value = visible.value;
	window.addEventListener('resize', onResize);
	startRotation();
});
onBeforeUnmount(() => {
	floatingMascotShown.value = false; // 旗鯖fork(#11): アンマウント時はフローティング非表示扱いに戻す
	window.removeEventListener('resize', onResize);
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	stopRotation();
	mascotVisible.value = false;
});

watch(displaySettingsLoaded, (v) => { if (v) initPosition(); });

// 旗鯖fork: 表示状態(デバイス別トグル / Hataskカード重複回避 / 読み込み完了)が変わったら
//   mascotVisible を追従させる。これにより「マスコット非表示なのに標準トーストが抑制される」のを防ぐ。
watch(visible, (v) => { mascotVisible.value = v; });
</script>

<style lang="scss" module>
.root {
	position: fixed;
	z-index: 2100;
	width: 200px;
	height: 150px;
	user-select: none;
}
.root:hover .controls { opacity: 1; pointer-events: auto; }

/* 操作ボタン(ホバー時に表示) */
.controls {
	position: absolute;
	top: 0;
	right: 0;
	display: flex;
	gap: 4px;
	z-index: 5;
	opacity: 0;
	pointer-events: none;
	transition: opacity .15s;
}
.ctrlBtn {
	width: 24px;
	height: 24px;
	border: none;
	border-radius: 50%;
	background: rgba(0,0,0,.45);
	color: #fff;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: .8rem;
}
.ctrlBtn:hover { background: rgba(0,0,0,.65); }

/* かんたん設定パネル(吹き出し形式) */
.quickPanel {
	position: absolute;
	top: 26px;
	right: 0;
	z-index: 6;
	min-width: 168px;
	padding: 10px 12px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 10px;
	box-shadow: 0 4px 16px rgba(0,0,0,.3);
	display: flex;
	flex-direction: column;
	gap: 8px;
	font-size: .8rem;
}
.qpRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.qpRow input[type=range] { width: 90px; }
.qpToggle { width: 36px; height: 20px; border-radius: 999px; border: none; background: var(--MI_THEME-divider); position: relative; cursor: pointer; transition: background .15s; }
.qpToggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.qpToggleOn { background: var(--MI_THEME-accent); }
.qpToggleOn::after { transform: translateX(16px); }
.qpSeg { display: inline-flex; border: 1px solid var(--MI_THEME-divider); border-radius: 6px; overflow: hidden; }
.qpSegBtn { border: none; background: transparent; color: var(--MI_THEME-fg); padding: 3px 8px; cursor: pointer; font-size: .75rem; }
.qpSegOn { background: var(--MI_THEME-accent); color: #fff; }

/* 最小化時の小ボタン */
.miniBtn {
	position: fixed;
	bottom: 16px;
	z-index: 2100;
	width: 48px;
	height: 48px;
	border: none;
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	box-shadow: 0 2px 10px rgba(0,0,0,.3);
	cursor: pointer;
	padding: 0;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
}
.miniRight { right: 16px; }
.miniLeft { left: 16px; }
.miniImg { width: 100%; height: 100%; object-fit: contain; -webkit-user-drag: none; pointer-events: none; }

/* 立ち絵+吹き出しの基準枠。プレビュー(MkMascotSettings)と同じ 4:3・画像55% に揃え、
   bubbleX/Y の指す位置をプレビューと完全一致させる(吹き出しは画像の外にも置ける)。 */
.stage {
	position: relative;
	width: 100%;
	height: 100%;
	cursor: grab;
	touch-action: none;
}
.stage:active { cursor: grabbing; }

/* 反転用ラッパー(立ち絵だけ反転、吹き出しの文字は反転させない) */
.imgFlip {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.img {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	max-width: 55%;
	max-height: 80%;
	object-fit: contain;
	-webkit-user-drag: none;
	pointer-events: none;
}
/* 立ち絵モーションのクラスとkeyframesは module 外の素style に置く(下部参照)。
   module内に animation:htkFloat... を書くと keyframes名がハッシュ化され参照が切れるため。 */

.bubble {
	position: absolute;
	transform: translate(-50%, -50%);
	width: max-content;
	max-width: 200px;
	padding: 6px 10px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	color: var(--MI_THEME-fg);
	border-radius: 14px;
	line-height: 1.4;
	text-align: center;
	box-shadow: 0 2px 8px rgba(0,0,0,.25);
	white-space: pre-line;
	word-break: break-word;
	pointer-events: none;
	z-index: 2;
}
.bubble::after { content:''; position:absolute; top:50%; width:0; height:0; border-style:solid; }
.tail_left::after { right:100%; transform:translateY(-50%); border-width:8px 12px 8px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.tail_right::after { left:100%; transform:translateY(-50%); border-width:8px 0 8px 12px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }

.qBubble {
	position: absolute;
	transform: translate(-50%, -50%);
	min-width: 1.6em;
	height: 1.6em;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	color: var(--MI_THEME-accent);
	border-radius: 50%;
	font-weight: 700;
	box-shadow: 0 2px 8px rgba(0,0,0,.2);
	pointer-events: none;
	z-index: 2;
}
.qBubble::after { content:''; position:absolute; top:60%; width:0; height:0; border-style:solid; }
.qtail_left::after { right:100%; transform:translateY(-50%); border-width:6px 9px 6px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.qtail_right::after { left:100%; transform:translateY(-50%); border-width:6px 0 6px 9px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }
</style>

<style lang="scss">
/* keyframes と モーションクラスはグローバルに出す必要があるため module 外の素の style に置く。
   (module内に書くと animation の keyframes 参照名がハッシュ化されて参照切れになるため)
   中央配置の translate(-50%,-50%) を保ったまま動かす。calc/var は使わず固定値。 */
.htkFloatMotionBounce { animation: htkFloatBounce 1s ease-in-out infinite; }
.htkFloatMotionShake { animation: htkFloatShake .35s linear infinite; }
.htkFloatMotionSway { animation: htkFloatSway 2s ease-in-out infinite; }
.htkFloatMotionSpin { animation: htkFloatSpin 3s linear infinite; }
@keyframes htkFloatBounce { 0%,100%{ transform:translate(-50%,-50%); } 50%{ transform:translate(-50%, calc(-50% - 8px)); } }
@keyframes htkFloatShake { 0%,100%{ transform:translate(-50%,-50%); } 25%{ transform:translate(calc(-50% - 4px),-50%); } 75%{ transform:translate(calc(-50% + 4px),-50%); } }
@keyframes htkFloatSway { 0%,100%{ transform:translate(-50%,-50%) rotate(-4deg); } 50%{ transform:translate(-50%,-50%) rotate(4deg); } }
@keyframes htkFloatSpin { from{ transform:translate(-50%,-50%) rotate(0); } to{ transform:translate(-50%,-50%) rotate(360deg); } }
</style>
