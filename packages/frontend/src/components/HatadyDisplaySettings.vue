<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog
	ref="dialog"
	:class="$style.dialog"
	:title="copy.title"
	centerTitle
	:embedded="embedded"
	:bare="embedded"
	:busy="saving"
	:inert="prompt"
	@close="requestClose"
	@closed="emit('closed')"
>
	<h2 v-if="embedded" :class="$style.embeddedTitle">{{ copy.title }}</h2>
	<div ref="settingsRoot" :class="$style.settings" data-settings-search-group-id="settings.group.hatady-display-settings">
		<section data-hatagoes-setting="theme">
			<h3>{{ copy.theme }}</h3>
			<div :class="$style.carousel" :aria-label="settingsCopy.chooseAppearance">
				<button type="button" :class="[$style.arrow, 'hy-icon-button']" :aria-label="settingsCopy.previousTheme" :disabled="saving || themeIndex === 0" @click="move(-1)">
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>
				<div ref="viewport" :class="$style.viewport" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd" @touchcancel="touchStart = null" @click.capture="guardSwipeClick">
					<button
						v-for="opt in themeOptions"
						:key="opt.value"
						type="button"
						:data-theme="opt.value"
						:class="$style.themeCard"
						:style="{ '--hy-theme-offset': themeOffset(opt.value), '--hy-theme-scale': themeOffset(opt.value) === 0 ? 1 : 0.8, zIndex: themeOffset(opt.value) === 0 ? 3 : 2 }"
						:aria-label="opt.label"
						:aria-pressed="editTheme === opt.value"
						:aria-hidden="Math.abs(themeOffset(opt.value)) > 1"
						:tabindex="Math.abs(themeOffset(opt.value)) > 1 ? -1 : 0"
						:disabled="saving"
						@click="choose(opt.value)"
					>
						<span :class="$style.preview" :data-theme-preview="opt.value" aria-hidden="true">
							<b>Hatady</b>
							<span><i :class="opt.icon"></i><strong>{{ settingsCopy.previewTitle }}</strong></span>
							<span><i></i><i></i><i></i></span>
						</span>
						<strong>{{ opt.label }}</strong>
						<small>{{ opt.description }}</small>
						<span :class="$style.selection">
							<i :class="editTheme === opt.value ? 'ti ti-check' : 'ti ti-circle-check'" aria-hidden="true"></i>
							{{ editTheme === opt.value ? settingsCopy.selected : settingsCopy.choose }}
						</span>
					</button>
				</div>
				<button type="button" :class="[$style.arrow, 'hy-icon-button']" :aria-label="settingsCopy.nextTheme" :disabled="saving || themeIndex === themeOptions.length - 1" @click="move(1)">
					<i class="ti ti-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
			<div :class="$style.dots" role="group" :aria-label="settingsCopy.themeList">
				<button v-for="(opt, index) in themeOptions" :key="opt.value" type="button" class="hy-icon-button" :aria-label="opt.label" :aria-pressed="editTheme === opt.value" :disabled="saving" @click="move(index - themeIndex)">
					<i aria-hidden="true"></i>
				</button>
			</div>
			<p class="hy-muted">{{ copy.themeHint }}</p>
		</section>
		<section data-hatagoes-setting="manage">
			<h3>{{ copy.manage }}</h3>
			<div :class="$style.menu">
				<button @click="openSubjectManager">
					<i class="ti ti-palette"></i>
					<span>{{ copy.manageSubjects }}</span>
					<i class="ti ti-chevron-right"></i>
				</button>
				<button @click="rerunTutorial($event)">
					<i class="ti ti-book"></i>
					<span>{{ copy.rerunTutorial }}</span>
					<i class="ti ti-chevron-right"></i>
				</button>
				<button @click="rerunTutorial($event, 'update')">
					<i class="ti ti-sparkles"></i>
					<span>{{ settingsCopy.v2Changes }}</span>
					<i class="ti ti-chevron-right"></i>
				</button>
				<button @click="doExportAll">
					<i class="ti ti-file-download"></i>
					<span>{{ copy.exportAll }}</span>
					<i class="ti ti-chevron-right"></i>
				</button>
			</div>
		</section>
		<section data-hatagoes-setting="sync">
			<h3>
				<i class="ti ti-refresh"></i>
				{{ copy.sync }}
				<small>{{ canSync ? copy.syncEnabled : copy.syncDisabled }}</small>
			</h3>
			<template v-if="canSync">
				<p class="hy-muted">{{ copy.syncShareAll }}</p>
				<div :class="$style.sync">
					<span v-for="it in syncItems" :key="it.key">
						<i :class="['ti', it.icon]"></i>
						{{ it.label }}
						<i class="ti ti-cloud-check"></i>
					</span>
				</div>
			</template>
			<p v-else class="hy-muted">
				{{ copy.syncBlockedTitle }}
				<br/>
				{{ copy.syncBlockedSub }}
			</p>
		</section>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	</div>
	<template #actions>
		<button v-if="!embedded" class="hy-secondary" :disabled="saving" @click="requestClose">{{ copy.cancel }}</button>
		<button class="hy-primary" :disabled="saving || !dirty" @click="save">
			<i class="ti ti-check"></i>
			{{ copy.save }}
		</button>
	</template>
</HyDialog>
<HatadyDraftPrompt
	v-if="prompt"
	:title="settingsCopy.draftQuestion"
	:description="settingsCopy.draftDescription"
	:error="draftError"
	@save="leave(true)"
	@discard="leave(false)"
	@return="prompt = false"
/>
</template>
<script setup lang="ts">
import { computed, ref, nextTick, onUnmounted, onMounted, watch } from 'vue';
import { revealHatagoesSetting } from '@/utility/hatagoes-setting-section.js';
import { showHatadyTutorial } from '@/utility/hatady-tutorial-launcher.js';
import type { HatadyTutorialKind } from '@/utility/hatady-tutorial.js';
import type { HatadyTheme } from '@/utility/hatady-prefs.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { i18n } from '@/i18n.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { hatadyTheme, saveHatadyDisplay } from '@/utility/hatady-prefs.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { $i } from '@/i.js';

const popup = useHataGoesPopup();
const props = defineProps<{ embedded?: boolean; initialSection?: string }>();
const settingsRoot = ref<HTMLElement>();
onMounted(() => revealHatagoesSetting(settingsRoot.value, props.initialSection));
watch(() => props.initialSection, section => revealHatagoesSetting(settingsRoot.value, section), { flush: 'post' });
const emit = defineEmits<{ (ev: 'closed'): void }>();
const dialog = ref<any>(),
	viewport = ref<HTMLElement>(),
	editTheme = ref<HatadyTheme>(hatadyTheme.value),
	saving = ref(false),
	prompt = ref(false),
	error = ref(''),
	draftError = ref('');
const copy = i18n.ts._hata._hatady._displaySettings;
const settingsCopy = i18n.ts._hata._hatady._settingsView;
const dirty = computed(() => editTheme.value !== hatadyTheme.value),
	canSync = computed(() => ($i as any)?.policies?.canUseHatadySync !== false);
const themes = [
	{ value: 'light' as const, label: settingsCopy.light, icon: 'ti ti-sun', description: settingsCopy.lightDescription },
	{ value: 'dark' as const, label: settingsCopy.dark, icon: 'ti ti-moon', description: settingsCopy.darkDescription },
	{ value: 'paper' as const, label: copy.themePaper, icon: 'ti ti-book', description: settingsCopy.paperDescription },
	{ value: 'espresso' as const, label: copy.themeEspresso, icon: 'ti ti-coffee', description: settingsCopy.espressoDescription },
];
// Keep an existing shared-theme choice visible without rewriting its saved key.
const legacyTheme = ref(editTheme.value === 'hataskey');
const themeOptions = computed(() => legacyTheme.value ? [
	...themes,
	{ value: 'hataskey' as const, label: copy.themeHataskey, icon: 'ti ti-palette', description: settingsCopy.hataskeyDescription },
] : themes);
const themeIndex = computed(() => themeOptions.value.findIndex(opt => opt.value === editTheme.value));
const syncItems = [
	{ key: 'timeline', label: copy.syncItemTimeline, icon: 'ti-notebook' },
	{ key: 'shelf', label: copy.syncItemShelf, icon: 'ti-books' },
	{ key: 'profile', label: copy.syncItemProfile, icon: 'ti-user' },
	{ key: 'display', label: copy.syncItemDisplay, icon: 'ti-palette' },
];
const draft = useHataFormDraft({
	id: 'hatady-display',
	autoSave: false,
	capture: () => ({ theme: editTheme.value }),
	restore: (d) => {
		if (d.theme === 'hataskey') legacyTheme.value = true;
		if (themeOptions.value.some((t) => t.value === d.theme)) editTheme.value = d.theme;
	},
	isMeaningful: () => true,
});
let touchStart: { x: number; y: number } | null = null;
let swipeUntil = 0;

async function choose(value: HatadyTheme) {
	if (saving.value) return;
	editTheme.value = value;
	await nextTick();
	const focused = window.document.activeElement;
	if (focused instanceof HTMLButtonElement && (focused.disabled || focused.getAttribute('aria-hidden') === 'true')) {
		viewport.value?.querySelector<HTMLButtonElement>(`[data-theme="${value}"]`)?.focus({ preventScroll: true });
	}
}

function themeOffset(value: HatadyTheme) {
	return themeOptions.value.findIndex(opt => opt.value === value) - themeIndex.value;
}

function move(delta: number) {
	const next = themeOptions.value[themeIndex.value + delta];
	if (next) void choose(next.value);
}

function onTouchStart(event: TouchEvent) {
	const touch = event.touches[0];
	touchStart = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function onTouchEnd(event: TouchEvent) {
	const start = touchStart, touch = event.changedTouches[0];
	touchStart = null;
	if (!start || !touch) return;
	const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
	if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
		swipeUntil = performance.now() + 400;
		move(dx < 0 ? 1 : -1);
	}
}

function guardSwipeClick(event: MouseEvent) {
	if (performance.now() >= swipeUntil) return;
	event.preventDefault();
	event.stopPropagation();
}

function requestClose() {
	if (saving.value) return;
	if (draft.hasChanges()) {
		prompt.value = true;
		draftError.value = '';
	} else dialog.value?.close();
}

function leave(save: boolean) {
	if (!(save ? draft.saveDraft() : draft.clearDraft())) {
		draftError.value = settingsCopy.draftUpdateFailed;
		return;
	}
	prompt.value = false;
	if (save) hatadyNotify(i18n.ts._hata._hatady._formWizard.draftSaved);
	dialog.value?.close();
}

async function save() {
	saving.value = true;
	try {
		await saveHatadyDisplay(editTheme.value);
		if (!draft.clearDraft()) hatadyNotify(settingsCopy.savedDraftCleanupFailed);
		else hatadyNotify(settingsCopy.saved);
		dialog.value?.close();
	} catch {
		error.value = copy.saveFailed;
	} finally {
		saving.value = false;
	}
}

async function openSubjectManager() {
	const { dispose } = popup(
		(await import('@/components/HatadySubjectManager.vue')).default,
		{},
		{ closed: () => dispose() },
	);
}

async function doExportAll() {
	const { dispose } = popup(
		(await import('@/components/HatadyExportDialog.vue')).default,
		{},
		{ closed: () => dispose() },
	);
}

let tutorialActive = true;
let stopTutorial: (() => void) | undefined;

async function rerunTutorial(event: MouseEvent, kind: HatadyTutorialKind = 'initial') {
	const stop = await showHatadyTutorial({
		kind, replay: true, isActive: () => tutorialActive,
		anchorElement: event.currentTarget as HTMLElement,
		popup,
	});
	if (!stop) return;
	if (tutorialActive) stopTutorial = stop;
	else stop();
}

onUnmounted(() => { tutorialActive = false; stopTutorial?.(); });

</script>
<style module lang="scss">
.dialog [data-hatady-theme][data-embedded='true'][data-bare='true'] {
	background: var(--hy-surface);
}
.embeddedTitle {
	margin: 0 0 24px;
	font-size: 18px;
	line-height: 1.5;
	text-align: center;
}
.settings {
	display: flex;
	flex-direction: column;
	gap: 28px;
}
.settings h3 {
	font-size: 14px;
	display: flex;
	gap: 8px;
	align-items: center;
	margin: 0 0 16px;
}
.settings h3 small {
	margin-left: auto;
	color: var(--hy-muted);
	font-size: 11px;
}
.carousel {
	display: flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
}
.arrow {
	flex: 0 0 44px;
	border: 1px solid var(--hy-border);
}
.viewport {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	justify-items: center;
	align-items: start;
	min-width: 0;
	flex: 1;
	overflow: hidden;
	padding: 8px;
	touch-action: pan-y;
}
.themeCard {
	grid-area: 1 / 1;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
	position: relative;
	width: min(218px, 100%);
	min-width: 0;
	padding: 12px;
	border: 2px solid var(--hy-border);
	border-radius: 20px;
	background: var(--hy-surface);
	color: var(--hy-ink);
	text-align: center;
	cursor: pointer;
	transform: translateX(calc(var(--hy-theme-offset, 0) * 76%)) scale(var(--hy-theme-scale, 1));
	transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, border-color 0.2s;
	opacity: 0.45;
}
.themeCard[aria-pressed='true'] {
	border-color: var(--hy-accent);
	box-shadow: 0 0 0 3px var(--hy-soft);
	opacity: 1;
}
.themeCard[aria-hidden='true'] {
	visibility: hidden;
	pointer-events: none;
}
.themeCard > strong {
	font-size: 17px;
	margin-top: 4px;
}
.themeCard > small {
	font-size: 12px;
}
.selection {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	font-size: 12px;
	min-height: 20px;
	color: var(--hy-muted);
}
.selection > i {
	font-size: 16px;
}
.themeCard[aria-pressed='true'] .selection {
	color: var(--hy-accent);
	font-weight: 700;
}
.preview {
	--hy-theme-bg: var(--MI_THEME-bg);
	--hy-theme-panel: var(--MI_THEME-panel);
	--hy-theme-fg: var(--MI_THEME-accent);
	display: flex;
	flex-direction: column;
	gap: 9px;
	width: 100%;
	height: 132px;
	padding: 14px 12px;
	border-radius: 12px;
	background: var(--hy-theme-bg);
	color: var(--hy-theme-fg);
}
.preview > b {
	font-family: 'Hatady Brand', sans-serif;
	text-align: left;
	font-size: 19px;
	line-height: 1.1;
}
.preview > span {
	display: flex;
	align-items: center;
	gap: 6px;
	background: var(--hy-theme-panel);
	border-radius: 8px;
	padding: 9px;
	text-align: left;
	font-size: 12px;
}
.preview > span:first-of-type > i {
	font-size: 17px;
}
.preview strong {
	font-size: 11px;
}
.preview > span:last-child {
	gap: 5px;
	align-items: flex-end;
	padding: 0;
	background: none;
	flex: 1;
}
.preview > span:last-child i {
	display: block;
	width: 20%;
	height: 70%;
	background: currentColor;
	opacity: 0.3;
	border-radius: 3px;
}
.preview > span:last-child i:nth-child(2) {
	height: 100%;
}
.preview > span:last-child i:nth-child(3) {
	height: 85%;
}
.preview[data-theme-preview='light'] {
	--hy-theme-bg: #eef2f3;
	--hy-theme-panel: #fff;
	--hy-theme-fg: #357359;
}
.preview[data-theme-preview='dark'] {
	--hy-theme-bg: #192321;
	--hy-theme-panel: #25312d;
	--hy-theme-fg: #a9d8bd;
}
.preview[data-theme-preview='paper'] {
	--hy-theme-bg: #f1ebdf;
	--hy-theme-panel: #fffcf7;
	--hy-theme-fg: #855333;
}
.preview[data-theme-preview='espresso'] {
	--hy-theme-bg: #241f1b;
	--hy-theme-panel: #332b25;
	--hy-theme-fg: #edbb88;
}
.dots {
	display: flex;
	justify-content: center;
	gap: 0;
	margin-bottom: 8px;
}
.dots i {
	width: 7px;
	height: 7px;
	border-radius: 999px;
	background: var(--hy-muted);
	transition: width 0.25s, background 0.25s;
}
.dots [aria-pressed='true'] i {
	width: 22px;
	background: var(--hy-accent);
}
.menu {
	display: flex;
	flex-direction: column;
}
.menu > button,
.menu > a {
	display: flex;
	align-items: center;
	gap: 14px;
	min-height: 62px;
	border: 0;
	border-bottom: 1px solid var(--hy-border);
	background: none;
	color: var(--hy-ink);
	text-align: left;
	padding: 10px 4px;
	cursor: pointer;
	font-size: 13px;
}
.menu span {
	flex: 1;
}
.menu small {
	display: block;
	font-size: 11px;
	color: var(--hy-muted);
	margin-top: 4px;
}
.sync {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}
.sync > span {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	padding: 12px;
	border-radius: 16px;
	background: var(--hy-surface-2);
}
.sync > span > i:last-child {
	margin-left: auto;
	color: var(--hy-accent-ink);
}
@container hy-dialog (max-width: 420px) {
	.themeCard {
		width: min(200px, 100%);
		padding: 10px;
	}
	.themeCard > strong {
		font-size: 15px;
	}
	.themeCard > small {
		font-size: 11px;
	}
	.preview {
		height: 125px;
	}
	.sync {
		grid-template-columns: 1fr;
	}
}
@media (prefers-reduced-motion: reduce) {
	.themeCard,
	.dots i {
		transition: none;
	}
}
</style>
