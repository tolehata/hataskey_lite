<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: マスコット専用ページ(P3 段階3-1)。サイドメニューから開く。
  立ち絵+名前+文言を大きく表示し、一定時間ごとに文言(と紐づく表情)が切り替わる。
  画像は mascot-store の IndexedDB キャッシュ経由(ObjectURL)で表示。
-->
<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :title="copy.title" :icon="'ti ti-mood-smile'"/></template>
	<MkSpacer :contentMax="700">
		<div v-if="!mascotLoaded" :class="$style.center">{{ copy.loading }}</div>

		<!-- 旗鯖fork: マスコット機能がロールで許可されていないユーザー向けの案内。操作系は一切出さない。 -->
		<div v-else-if="!canUseMascot" :class="$style.empty">
			<i class="ti ti-lock" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ copy.unavailable }}</div>
		</div>

		<div v-else-if="!hasMascot" :class="$style.empty">
			<i class="ti ti-mood-empty" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ copy.notConfigured }}</div>
			<MkButton primary rounded @click="openSettings"><i class="ti ti-settings"></i> {{ copy.configureMascot }}</MkButton>
		</div>

		<div v-else :class="$style.stage">
			<div :class="$style.imgWrap">
				<Transition name="mascotScene" mode="out-in">
					<div :key="transitionKey" :class="$style.scene">
						<img v-if="expUrl" :src="expUrl" :style="motionVarStyle" :class="[$style.img, motionName==='bounce' ? $style.motionBounce : motionName==='shake' ? $style.motionShake : motionName==='sway' ? $style.motionSway : motionName==='spin' ? $style.motionSpin : '']" :alt="expLabel" draggable="false" />
						<div v-else :class="$style.noImg"><i class="ti ti-photo"></i></div>
						<!-- 吹き出しを立ち絵の上に、表情ごとの位置(bubbleX/Y)で重ねる -->
						<div v-if="phraseText" :class="[$style.bubble, bubbleTail==='right' ? $style.tail_right : $style.tail_left]" :style="bubbleStyle" @click="next">
							{{ phraseText }}
						</div>
						<!-- ？小吹き出し(疑問トグルON時) -->
						<div v-if="qEnabled" :class="[$style.qBubble, qTail==='right' ? $style.qtail_right : $style.qtail_left]" :style="qBubbleStyle">?</div>
					</div>
				</Transition>
			</div>
			<div v-if="character && (mascotData?.showName) && character.name" :class="$style.name">{{ character.name }}</div>
			<div v-if="!phraseText" :class="$style.bubbleEmpty">{{ copy.noPhrase }}</div>
			<div :class="$style.controls">
				<MkButton rounded @click="next"><i class="ti ti-refresh"></i> {{ copy.nextPhrase }}</MkButton>
				<MkButton v-if="isBirthdayToday" rounded gradate @click="celebrateBirthday"><i class="ti ti-cake"></i> {{ copy.celebrateBirthday }}</MkButton>
				<MkButton rounded @click="openSettings"><i class="ti ti-settings"></i> {{ i18n.ts.settings }}</MkButton>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { isBirthday } from '@/utility/is-birthday.js';
import {
	mascotData, mascotLoaded, loadMascot,
	activeCharacter, currentExpression,
	pickRandomPhrase, expressionDisplayUrl, escapeText,
	displayText, loadDisplaySettings, mascotVisible,
	announceBirthday, announceUnread, announceCharBirthday, isCharBirthdayToday, clearAnnounce,
	nextIdleDelayMs,
} from '@/utility/mascot-store.js';

const copy = i18n.ts._hata._mascotPage;

const character = computed(() => activeCharacter.value);
const hasMascot = computed(() => !!character.value);
// 旗鯖fork: マスコット機能の利用可否(ロールポリシー)。未許可ユーザーには機能を一切見せない。
const canUseMascot = computed(() => $i?.policies?.canUseMascot === true);
// pending(storeが指す次の表示内容)
const pendingPhraseText = computed(() => displayText.value ? escapeText(displayText.value) : '');
const pendingExpUrl = computed(() => expressionDisplayUrl(currentExpression.value));
const expLabel = computed(() => currentExpression.value?.label ?? '');

// 実際に表示する内容(画像のデコード完了を待ってから pending を反映する)。
// これにより「軽いテキストだけ先に出て、重い画像が遅れて出る」ズレを防ぐ。
const shownUrl = ref('');
const shownText = ref('');
const shownExpression = ref<typeof currentExpression.value>(null);

// 表示用に参照する値はすべて shown 系から導出する
const expUrl = computed(() => shownUrl.value);
const phraseText = computed(() => shownText.value);
const transitionKey = computed(() => `${shownUrl.value}::${shownText.value}`);

// 画像をプリロード&デコードしてから shown を更新する
let applyToken = 0;
async function applyPending() {
	const token = ++applyToken;
	const url = pendingExpUrl.value;
	const text = pendingPhraseText.value;
	const exp = currentExpression.value;
	if (url) {
		try {
			const img = new Image();
			img.src = url;
			if (img.decode) await img.decode();
		} catch { /* デコード失敗時もそのまま表示に進む */ }
	}
	// 待っている間に次の切替が来ていたら、この適用は破棄(最新優先)
	if (token !== applyToken) return;
	shownUrl.value = url;
	shownText.value = text;
	shownExpression.value = exp;
}

// pending(表情/文言)が変わったら、画像を用意してから表示を切り替える
watch([pendingExpUrl, pendingPhraseText], () => { applyPending(); });

// 吹き出し位置(表情ごとのbubbleX/Y、未設定は上中央寄り)。表示中の表情(shownExpression)基準。
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
const motionVarStyle = computed(() => ({ '--htk-motion-i': String(typeof shownExpression.value?.motionIntensity === 'number' ? shownExpression.value.motionIntensity : 1) }));
const motionName = computed(() => shownExpression.value?.motion ?? 'none');
const qEnabled = computed(() => shownExpression.value?.questionEnabled === true);
const qTail = computed<'left' | 'right'>(() => (shownExpression.value?.qBubbleTail === 'right' ? 'right' : 'left'));
const qBubbleStyle = computed(() => {
	const e = shownExpression.value;
	const x = (typeof e?.qBubbleX === 'number' ? e.qBubbleX : 0.7);
	const y = (typeof e?.qBubbleY === 'number' ? e.qBubbleY : 0.05);
	const scale = (typeof e?.qBubbleScale === 'number' ? e.qBubbleScale : 1);
	const s: Record<string, string> = { left: (x * 100) + '%', top: (y * 100) + '%', fontSize: (1.1 * scale) + 'rem' };
	if (e?.qTextColor) s.color = e.qTextColor;
	return s;
});

let timer: ReturnType<typeof setTimeout> | null = null;
function startTimer() {
	stopTimer();
	const delay = nextIdleDelayMs();
	timer = setTimeout(() => { pickRandomPhrase(); startTimer(); }, delay);
}
function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }

function next() { clearAnnounce(); pickRandomPhrase(); startTimer(); }

// 今日が自分の誕生日か($i.birthday は 'YYYY-MM-DD')
const isBirthdayToday = computed(() => {
	return $i ? isBirthday($i) : false;
});
function celebrateBirthday() { announceBirthday(); }

function openSettings() {
	// 旗鯖fork: 未許可ユーザーは設定ダイアログを開けない(UI非表示に加えた二重防御)
	if (!canUseMascot.value) return;
	import('@/pages/MkMascotSettings.vue').then(x => {
		const { dispose } = os.popup(x.default, {}, {
			closed: () => dispose(),
		});
	});
}

onMounted(async () => {
	await Promise.allSettled([loadMascot(), loadDisplaySettings()]);
	pickRandomPhrase();
	await applyPending();
	startTimer();
	mascotVisible.value = true;
	announceOnOpen();
});
onActivated(() => { startTimer(); mascotVisible.value = true; announceOnOpen(); });
onDeactivated(() => { stopTimer(); mascotVisible.value = false; });
onUnmounted(() => { stopTimer(); mascotVisible.value = false; });

// ページを開いたときの自動メッセージ。キャラ誕生日を最優先(1日1回・セッション中1回)、なければ未読件数。
let charBirthdayAnnounced = false;
function announceOnOpen() {
	if (isCharBirthdayToday()) {
		// 出っぱなしを防ぐため、開くたびではなくセッション中1回だけお祝いする
		if (!charBirthdayAnnounced) {
			charBirthdayAnnounced = true;
			announceCharBirthday();
		}
		return;
	}
	const count = $i?.unreadNotificationsCount ?? 0;
	announceUnread(count);
}

const headerActions = computed(() => canUseMascot.value ? [{
	icon: 'ti ti-settings',
	text: i18n.ts.settings,
	handler: openSettings,
}] : []);

definePage(() => ({
	title: copy.title,
	icon: 'ti ti-mood-smile',
}));
</script>

<style lang="scss" module>
.center { text-align:center; padding:40px 0; opacity:.6; }
.empty { display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 0; }
.emptyIcon { font-size:3rem; opacity:.4; }
.emptyText { opacity:.7; }
.stage { display:flex; flex-direction:column; align-items:center; gap:18px; padding:20px 0 40px; }
.imgWrap { position:relative; width:min(86vw, 420px); aspect-ratio:4/3; max-height:440px; display:flex; align-items:center; justify-content:center; }
.scene { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
.img { max-width:80%; max-height:100%; object-fit:contain; filter:drop-shadow(0 8px 24px rgba(0,0,0,.25)); user-select:none; -webkit-user-drag:none; }
.noImg { width:100%; height:100%; display:flex; align-items:center; justify-content:center; border:1px dashed var(--MI_THEME-divider); border-radius:16px; opacity:.4; font-size:2rem; }
.motionBounce { animation: htkMascotBounce 1s ease-in-out infinite; }
.motionShake { animation: htkMascotShake .35s linear infinite; }
.motionSway { animation: htkMascotSway 2s ease-in-out infinite; }
.motionSpin { animation: htkMascotSpin 3s linear infinite; }
:global {
	@keyframes htkMascotBounce { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(calc(-8% * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotShake { 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(calc(-4px * var(--htk-motion-i, 1))); } 75%{ transform:translateX(calc(4px * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotSway { 0%,100%{ transform:rotate(calc(-4deg * var(--htk-motion-i, 1))); } 50%{ transform:rotate(calc(4deg * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotSpin { from{ transform:rotate(0); } to{ transform:rotate(360deg); } }
}
.name { font-size:1.1rem; font-weight:700; }
.bubble { position:absolute; transform:translate(-50%,-50%); max-width:78%; background: var(--MI_THEME-panel); border:1px solid var(--MI_THEME-divider); border-radius:16px; padding:8px 12px; line-height:1.5; text-align:center; cursor:pointer; transition:transform .1s; word-break:break-word; white-space:pre-line; box-shadow:0 4px 16px rgba(0,0,0,.22); }
.bubble:active { transform:translate(-50%,-50%) scale(.97); }
.bubble::after { content:''; position:absolute; top:50%; width:0; height:0; border-style:solid; }
/* しっぽは本体色の単一三角。本体側に2pxめり込ませて継ぎ目を消す(枠線三角は重なりの線が出るため使わない) */
.tail_left::after { right:100%; transform:translateY(-50%); border-width:8px 12px 8px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.tail_right::after { left:100%; transform:translateY(-50%); border-width:8px 0 8px 12px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }
/* ？小吹き出し */
.qBubble { position:absolute; transform:translate(-50%,-50%); min-width:1.6em; height:1.6em; display:flex; align-items:center; justify-content:center; background: var(--MI_THEME-panel); border:1px solid var(--MI_THEME-divider); border-radius:50%; font-weight:700; color: var(--MI_THEME-accent); box-shadow:0 2px 8px rgba(0,0,0,.2); }
.qBubble::after { content:''; position:absolute; top:60%; width:0; height:0; border-style:solid; }
.qtail_left::after { right:100%; transform:translateY(-50%); border-width:6px 9px 6px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.qtail_right::after { left:100%; transform:translateY(-50%); border-width:6px 0 6px 9px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }
.bubbleEmpty { opacity:.5; font-size:.9rem; }
.controls { display:flex; gap:10px; }
/* シーン(画像+吹き出し+?)を1つのラッパーとして一括フェード。
   別々のTransitionにすると軽いテキストが先に出てズレるため、まとめて遷移させる。 */
:global(.mascotScene-enter-active) { transition: opacity .4s ease, transform .4s cubic-bezier(0.34,1.56,0.64,1); }
:global(.mascotScene-leave-active) { transition: opacity .4s ease; }
:global(.mascotScene-enter-from) { opacity: 0; transform: translateY(8px) scale(.97); }
:global(.mascotScene-leave-to) { opacity: 0; }
</style>
