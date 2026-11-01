<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<component :is="embedded ? SettingsEmbeddedWindow : MkModal" ref="modal" :preferType="'dialog'" @click="onBackdropClick" @esc="onEscape" @closed="emit('closed')">
	<div ref="panel" :class="$style.root" role="dialog" :aria-modal="embedded ? undefined : true" aria-labelledby="mkuisetup-title" :data-animation="prefer.s.animation ? 'true' : 'false'" :data-glass="prefer.s.useBlurEffect && prefer.s.useBlurEffectForModal ? 'true' : 'false'" :data-embedded-scroll="embedded ? '' : undefined" @click.stop @keydown.esc.stop.prevent="onEscape">
		<header :class="$style.header">
			<h1 id="mkuisetup-title" :class="$style.title"><ChevronsLeftRight :size="16" aria-hidden="true" :class="$style.swapIcon"/>{{ copy.title }}</h1>
			<button type="button" :class="$style.close" :aria-label="i18n.ts.close" :disabled="busy" @click="close"><X :size="20" aria-hidden="true"/></button>
		</header>

		<div v-show="pending === null" :class="$style.body">
			<p :class="$style.hint">{{ copy.hint }}</p>
			<!-- 旗鯖fork: 各カードの上に、Hataskey UI と同じガラス・ピル型ナビの小さな見本を描く。
			     見本は飾りなので読み上げない（名前と説明文だけを読む）。 -->
			<div :class="$style.cards">
				<button type="button" data-ui="simple" :class="[$style.card, { [$style.selected]: currentUi === 'simple' }]" :aria-pressed="currentUi === 'simple'" :disabled="busy" @click="choose('simple')">
					<span :class="$style.stage" aria-hidden="true">
						<span :class="$style.phone">
							<span :class="$style.pill"><span :class="$style.pillActive"></span><span :class="$style.dot"></span><span :class="$style.dot"></span><span :class="$style.dot"></span></span>
							<span v-for="n in 2" :key="n" :class="$style.note"><span :class="[$style.avatar, n === 2 && $style.avatarAlt]"></span><span :class="$style.lines"><span :class="$style.line" style="width: 70%"></span><span :class="$style.line" style="width: 92%"></span><span :class="$style.line" style="width: 54%"></span></span></span>
							<span :class="$style.phoneBottom"><span :class="$style.pill"><span :class="$style.dot"></span><span :class="$style.dot"></span><span :class="$style.pillActive"></span><span :class="$style.dot"></span></span><span :class="$style.fab"></span></span>
						</span>
						<span v-if="currentUi === 'simple'" :class="$style.check"><Check :size="14"/></span>
					</span>
					<span :class="$style.meta">
						<span :class="$style.nameRow"><LayoutTemplate :size="18" aria-hidden="true" :class="$style.optionIcon"/><span :class="$style.brandName">Hataskey UI</span><span :class="$style.recommended">{{ i18n.ts.recommended }}</span></span>
						<span :class="$style.description">{{ copy.standardDescription }}</span>
						<span :class="$style.optionEnd"><span v-if="currentUi === 'simple'">{{ i18n.ts.inUse }}</span><ChevronRight v-else :size="16" aria-hidden="true"/></span>
					</span>
				</button>
				<button type="button" data-ui="hataskey3" :class="[$style.card, { [$style.selected]: currentUi === 'hataskey3' }]" :aria-pressed="currentUi === 'hataskey3'" :disabled="busy" @click="choose('hataskey3')">
					<span :class="$style.stage" aria-hidden="true">
						<span :class="$style.desk">
							<span :class="$style.rail"><span :class="$style.railLogo"></span><span :class="[$style.dot, $style.dotActive]"></span><span :class="$style.dot"></span><span :class="$style.dot"></span><span :class="$style.dot"></span></span>
							<span :class="$style.deskMain"><span :class="$style.composer"></span><span v-for="n in 2" :key="n" :class="$style.note"><span :class="[$style.avatar, n === 2 && $style.avatarAlt]"></span><span :class="$style.lines"><span :class="$style.line" style="width: 64%"></span><span :class="$style.line" style="width: 88%"></span></span></span></span>
							<span :class="$style.deskSide"><span :class="$style.widget"><span :class="$style.bloom"></span><span :class="$style.line" style="width: 60%"></span></span><span :class="$style.widget"><span :class="$style.line" style="width: 80%"></span><span :class="$style.line" style="width: 50%"></span></span></span>
						</span>
						<span v-if="currentUi === 'hataskey3'" :class="$style.check"><Check :size="14"/></span>
					</span>
					<span :class="$style.meta">
						<span :class="$style.nameRow"><PanelsTopLeft :size="18" aria-hidden="true" :class="$style.optionIcon"/><span :class="$style.brandName">Hataskey UI S</span></span>
						<span :class="$style.description">{{ copy.ui3Description }}</span>
						<span :class="$style.optionEnd"><span v-if="currentUi === 'hataskey3'">{{ i18n.ts.inUse }}</span><ChevronRight v-else :size="16" aria-hidden="true"/></span>
					</span>
				</button>
			</div>
			<details :class="$style.legacy" :open="legacyOpen" @toggle="legacyOpen = ($event.target as HTMLDetailsElement).open">
				<summary :class="$style.legacySummary" @click="busy && $event.preventDefault()"><ChevronDown :size="16" aria-hidden="true"/>{{ copy.otherUis }}<span :class="$style.deprecatedBadge">{{ copy.notRecommended }}</span></summary>
				<p :class="$style.legacyNote">{{ copy.conflictNote }}</p>
				<div :class="$style.legacyOptions">
					<button type="button" data-ui="default" :class="[$style.option, $style.legacyOption, { [$style.selected]: currentUi === 'default' }]" :aria-pressed="currentUi === 'default'" :disabled="busy" @click="askDeprecated('default')">
						<LayoutList :size="22" aria-hidden="true" :class="$style.optionIcon"/><span :class="$style.optionName">Misskey UI</span><span :class="$style.optionEnd"><span v-if="currentUi === 'default'">{{ i18n.ts.inUse }}</span><ChevronRight v-else :size="16" aria-hidden="true"/></span>
					</button>
					<button type="button" data-ui="deck" :class="[$style.option, $style.legacyOption, { [$style.selected]: currentUi === 'deck' }]" :aria-pressed="currentUi === 'deck'" :disabled="busy" @click="askDeprecated('deck')">
						<Columns3 :size="22" aria-hidden="true" :class="$style.optionIcon"/><span :class="$style.optionName">{{ copy.legacyDeck }}</span><span :class="$style.optionEnd"><span v-if="currentUi === 'deck'">{{ i18n.ts.inUse }}</span><ChevronRight v-else :size="16" aria-hidden="true"/></span>
					</button>
				</div>
			</details>
		</div>

		<div v-show="pending !== null" :class="$style.confirm">
			<span :class="$style.deprecatedBadge">{{ copy.notRecommended }}</span>
			<h2>{{ i18n.tsx._hata._uiSetup.switchConfirm({ ui: pending === 'default' ? 'Misskey UI' : copy.legacyDeck }) }}</h2>
			<p>{{ copy.deprecatedWarning }}</p>
			<div :class="$style.actions">
				<button type="button" data-confirm-back :class="$style.action" :disabled="busy" @click="backFromConfirm">{{ i18n.ts.goBack }}</button>
				<button type="button" :class="[$style.action, $style.accept]" :disabled="busy" @click="submitDeprecated">{{ copy.switchAction }}</button>
			</div>
		</div>
	</div>
</component>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { Check, ChevronsLeftRight, ChevronDown, ChevronRight, LayoutTemplate, PanelsTopLeft, LayoutList, Columns3, X } from '@lucide/vue';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import MkModal from '@/components/MkModal.vue';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

type Ui = 'simple' | 'hataskey3' | 'default' | 'deck';
const props = defineProps<{ embedded?: boolean }>();
const emit = defineEmits<{ (e: 'closed'): void }>();
const modal = ref<{ close: () => void } | null>(null);
const panel = ref<HTMLElement | null>(null);
const copy = i18n.ts._hata._uiSetup;
const storedUi = miLocalStorage.getItem('ui');
const currentUi: Ui = storedUi === 'hataskey3' || storedUi === 'default' || storedUi === 'deck' ? storedUi : 'simple';
const legacyOpen = ref(currentUi === 'default' || currentUi === 'deck');
const pending = ref<'default' | 'deck' | null>(null);
const busy = ref(false);
let previousChoice: 'default' | 'deck' | null = null;
let exitAnimation: Animation | null = null;
let disposed = false;
let navigating = false;

// 設定検索のハンドラー解析に合わせ、戻り値は型推論に任せる。
function close() {
	if (busy.value) return;
	modal.value?.close();
}

function onBackdropClick() {
	if (!props.embedded) close();
}

async function backFromConfirm() {
	if (busy.value) return;
	pending.value = null;
	await nextTick();
	if (!disposed && previousChoice) panel.value?.querySelector<HTMLButtonElement>(`[data-ui="${previousChoice}"]`)?.focus();
}

function onEscape() {
	if (pending.value) backFromConfirm();
	else close();
}

function askDeprecated(type: 'default' | 'deck') {
	if (busy.value) return;
	if (type === currentUi) {
		finishCurrent();
		return;
	}
	previousChoice = type;
	pending.value = type;
	void nextTick(() => panel.value?.querySelector<HTMLButtonElement>('[data-confirm-back]')?.focus());
}

function finishCurrent() {
	if (busy.value) return;
	miLocalStorage.setItem('ui_setup_completed', 'true');
	close();
}

async function playExit() {
	if (!prefer.s.animation || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !panel.value?.animate) return true;
	exitAnimation = panel.value.animate([
		{ opacity: 1, transform: 'scaleY(1)' },
		{ opacity: 0, transform: 'scaleY(.88)' },
	], { duration: 220, easing: 'cubic-bezier(.4, 0, .8, .35)', fill: 'forwards' });
	try {
		await exitAnimation.finished;
		return !disposed;
	} catch {
		return false;
	}
}

async function choose(type: Ui) {
	if (busy.value) return;
	if (type === currentUi) {
		finishCurrent();
		return;
	}
	busy.value = true;
	try {
		if (!await playExit() || disposed) return;
		miLocalStorage.setItem('ui', type);
		miLocalStorage.setItem('ui_setup_completed', 'true');
		navigating = true;
		if (type === 'hataskey3') window.location.assign('/');
		else window.location.reload();
	} catch (error) {
		navigating = false;
		exitAnimation?.cancel();
		exitAnimation = null;
		throw error;
	} finally {
		if (!disposed && !navigating) busy.value = false;
	}
}

function submitDeprecated() {
	if (pending.value && !busy.value) void choose(pending.value);
}

onBeforeUnmount(() => {
	disposed = true;
	exitAnimation?.cancel();
	exitAnimation = null;
});
</script>

<style lang="scss" module>
.root {
	--surface: var(--MI_THEME-panel);
	--foreground: var(--MI_THEME-fg);
	--muted: color-mix(in srgb, var(--MI_THEME-fg) 70%, transparent);
	--line: var(--MI_THEME-divider);
	--accent: var(--MI_THEME-accent);
	--soft: color-mix(in srgb, var(--MI_THEME-accent) 12%, var(--MI_THEME-panel));
	box-sizing: border-box;
	width: min(600px, 100%);
	max-height: calc(100dvh - 32px);
	overflow-y: auto;
	overscroll-behavior: contain;
	margin: auto;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-panel) 48%, var(--line));
	border-radius: 28px;
	background: var(--surface);
	color: var(--foreground);
	box-shadow: 0 22px 64px color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent);
	text-align: center;
	caret-color: transparent;
	transform-origin: center;
}
.root[data-glass='true'] {
	--surface: color-mix(in srgb, var(--MI_THEME-panel) 86%, transparent);
	--soft: color-mix(in srgb, var(--MI_THEME-accent) 12%, var(--MI_THEME-panel) 58%);
	-webkit-backdrop-filter: blur(22px) saturate(1.16);
	backdrop-filter: blur(22px) saturate(1.16);
}
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
	.root[data-glass='true'] { --surface: var(--MI_THEME-panel); }
}
.root * { box-sizing: border-box; }
.root svg { stroke-width: 1.7; }
.root button { font: inherit; color: inherit; cursor: pointer; }
.root button:disabled { cursor: default; }
.header { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.title { grid-column: 2; display: flex; align-items: center; justify-content: center; gap: 7px; margin: 0; font-size: 16px; font-weight: 700; }
.swapIcon { color: var(--accent); flex: none; }
.close { grid-column: 3; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--muted) !important; }
.close:hover { background: var(--soft); }
.body { padding: 18px; }
.hint { margin: 0 0 12px; color: var(--muted); font-size: 12px; }
/* 旗鯖fork: Hataskey UI の見た目（ガラスの面・ピル型ナビ・大きめの角丸・アクセントの淡い光）に合わせたカード。
   見本の寸法と色は MkHatasabaUi2PreviewWindow のモック（.phone）と揃え、別物に見えないようにする。 */
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; text-align: left; }
.card { position: relative; display: flex; min-width: 0; flex-direction: column; overflow: hidden; padding: 0; border: 1px solid color-mix(in srgb, var(--line) 80%, transparent); border-radius: 22px; background: color-mix(in srgb, var(--surface) 70%, var(--soft)); box-shadow: 0 6px 18px color-mix(in srgb, var(--MI_THEME-fg) 7%, transparent); text-align: left; transition: transform .22s cubic-bezier(.2, .8, .2, 1), box-shadow .22s ease, border-color .22s ease; }
.card:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 34%, var(--line)); box-shadow: 0 12px 28px color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent); }
.card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.card.selected { border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent), 0 12px 30px color-mix(in srgb, var(--accent) 22%, transparent); }
.stage { position: relative; display: grid; place-items: center; height: 168px; overflow: hidden; background: radial-gradient(120% 90% at 20% 0%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 60%), linear-gradient(160deg, #1b2338, #131a2b); }
.check { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: var(--MI_THEME-fgOnAccent, #fff); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 50%, transparent); }
.check svg { stroke-width: 2.6; }
.meta { display: grid; gap: 6px; padding: 14px 16px 14px; }
.nameRow { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 7px; }
.optionIcon { flex: none; color: var(--accent); stroke-width: 1.7; }
.optionName { position: relative; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.brandName { font-family: 'Righteous', system-ui, sans-serif; font-size: 18px; font-weight: 400; line-height: 1.2; }
.recommended { padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-family: system-ui, sans-serif; font-size: 10px; font-weight: 700; white-space: nowrap; }
.description { color: var(--muted); font-size: 12px; line-height: 1.6; line-break: strict; text-wrap: pretty; }
.optionEnd { display: inline-flex; align-items: center; justify-self: start; min-height: 26px; margin-top: 2px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--muted); font-size: 12px; }
.card .optionEnd { justify-self: end; }
.selected .optionEnd { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-weight: 700; }

/* ===== Hataskey UI の見本（スマホの縦長画面） ===== */
.phone { display: flex; width: 104px; height: 150px; flex-direction: column; gap: 6px; padding: 8px 7px; border: 1px solid rgba(255, 255, 255, .6); border-radius: 20px; background: linear-gradient(180deg, #eef2fa, #e2e8f4); box-shadow: 0 14px 30px rgba(15, 22, 45, .4), inset 0 1px 0 rgba(255, 255, 255, .8); }
.pill { display: flex; flex: 1; align-items: center; justify-content: space-around; gap: 4px; padding: 4px 6px; border: 1px solid rgba(255, 255, 255, .85); border-radius: 999px; background: rgba(255, 255, 255, .75); box-shadow: 0 3px 8px rgba(20, 30, 60, .1); }
.phone > .pill { flex: none; }
.dot { width: 5px; height: 5px; flex: none; border-radius: 50%; background: #9aa3b8; opacity: .7; }
.pillActive { width: 14px; height: 7px; flex: none; border-radius: 999px; background: var(--accent); }
.note { display: flex; gap: 5px; padding: 6px; border: 1px solid rgba(255, 255, 255, .73); border-radius: 11px; background: rgba(255, 255, 255, .63); box-shadow: 0 2px 6px rgba(20, 30, 60, .06); }
.avatar { width: 14px; height: 14px; flex: none; border-radius: 5px; background: linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 30%, #2fb8a6)); }
.avatarAlt { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 70%, #7a5ad0), #2fb8a6); }
.lines { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; padding-top: 1px; }
.line { display: block; height: 3px; border-radius: 2px; background: rgba(38, 52, 86, .2); }
.phoneBottom { display: flex; align-items: center; gap: 5px; margin-top: auto; }
.fab { width: 22px; height: 22px; flex: none; border-radius: 50%; background: var(--accent); box-shadow: 0 4px 10px color-mix(in srgb, var(--accent) 50%, transparent); }

/* ===== Hataskey UI S の見本（左のナビ・中央のタイムライン・右のウィジェット） ===== */
.desk { display: grid; grid-template-columns: 22px minmax(0, 1fr) 54px; gap: 6px; width: 196px; height: 124px; padding: 7px; border: 1px solid rgba(255, 255, 255, .6); border-radius: 16px; background: linear-gradient(180deg, #eef2fa, #e2e8f4); box-shadow: 0 14px 30px rgba(15, 22, 45, .4), inset 0 1px 0 rgba(255, 255, 255, .8); }
.rail { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 6px 0; border-radius: 11px; background: rgba(255, 255, 255, .7); }
.railLogo { width: 12px; height: 12px; margin-bottom: 2px; border-radius: 4px; background: var(--accent); }
.dotActive { background: var(--accent); opacity: 1; }
.deskMain { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.composer { height: 14px; flex: none; border: 1px solid rgba(255, 255, 255, .85); border-radius: 999px; background: rgba(255, 255, 255, .75); }
.deskSide { display: flex; flex-direction: column; gap: 5px; }
.widget { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 5px; border-radius: 10px; background: rgba(255, 255, 255, .63); }
.widget .line { align-self: stretch; }
.bloom { width: 20px; height: 20px; border-radius: 50%; background: conic-gradient(var(--accent) 0 68%, color-mix(in srgb, var(--accent) 18%, #fff) 0); }

.option { display: flex; width: 100%; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--line) 80%, transparent); border-radius: 999px; background: transparent; text-align: left; }
.option:hover:not(:disabled), .option.selected { background: var(--soft); }
.option.selected { border-color: color-mix(in srgb, var(--accent) 38%, var(--surface)); }
.option .optionIcon { color: var(--muted); }
.option .optionEnd { margin: 0 0 0 auto; padding: 0; background: none; }
.legacyOptions { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 8px; }
.legacy { margin-top: 18px; padding-top: 6px; border-top: 1px solid var(--line); }
.legacySummary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 4px; color: var(--muted); font-size: 12px; cursor: pointer; list-style: none; }
.legacySummary::-webkit-details-marker { display: none; }
.legacySummary > svg { color: var(--accent); stroke-width: 1.7; }
.deprecatedBadge { display: inline-block; padding: 0 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 10px; white-space: nowrap; }
.legacyNote { margin: 0 4px 8px; color: var(--muted); font-size: 12px; }
.legacyOption .optionName { font-size: 13px; font-weight: 500; }
.confirm { padding: 24px; }
.confirm h2 { margin: 12px 0; font-size: 16px; }
.confirm p { margin: 0 0 24px; font-size: 13px; }
.actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
.action { min-height: 44px; padding: 10px 20px; border: 0; border-radius: 999px; background: var(--soft); }
.accept { background: var(--accent); color: var(--MI_THEME-fgOnAccent) !important; font-weight: 700 !important; }
@media (max-width: 380px) {
	.body { padding: 12px; }
	.stage { height: 150px; }
	.brandName { font-size: 16px; }
	.description { font-size: 11px; }
}
@media (prefers-reduced-motion: no-preference) {
	.root[data-animation='true'] .swapIcon { animation: swapNudge 620ms ease-out both; }
	.root[data-animation='true'] .card:hover:not(:disabled) { transform: translateY(-2px); }
}
@keyframes swapNudge { 0%, 100% { transform: translateX(0); } 35% { transform: translateX(4px); } 70% { transform: translateX(-3px); } }
</style>

<style>
@font-face {
	font-family: 'Righteous';
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	src: url('/client-assets/Righteous-Regular.woff2') format('woff2');
}
</style>
