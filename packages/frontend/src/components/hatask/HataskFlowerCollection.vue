<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	class="hatask-flower-collection-modal"
	:data-flower-motion="goesMotion || animations ? 'on' : 'off'"
	:data-hatagoes="goesMotion"
	preferType="dialog"
	zPriority="middle"
	:returnFocusTo="source"
	@click="close"
	@esc="dismissWithEscape"
	@opened="onOpened"
	@closed="onClosed"
>
	<section
		:class="$style.panel"
		:style="themeStyle"
		:data-theme="theme"
		:data-mode="mode"
		:data-personal="personal"
		:data-motion="animations ? 'on' : 'off'"
		role="dialog"
		aria-modal="true"
		:aria-labelledby="titleId"
		data-hatask-flower-collection
		@keydown.stop
		@keydown.esc.stop.prevent="close"
	>
		<header :class="$style.header">
			<div :class="$style.heading"><h2 :id="titleId">{{ title }}</h2><p v-if="summary">{{ summary }}</p></div>
			<button ref="closeButton" type="button" :class="$style.close" :aria-label="labels.close" :disabled="closing" data-flower-collection-action="close" @click="close"><i class="ti ti-x" aria-hidden="true"></i></button>
		</header>
		<div :class="$style.toolbar">
			<label :class="$style.sort"><span>{{ labels.sort }}</span><select :value="order" :disabled="closing || loading" data-flower-collection-action="order" @change="changeOrder"><option value="newest">{{ labels.newest }}</option><option value="oldest">{{ labels.oldest }}</option></select></label>
		</div>
		<div ref="content" :class="$style.content" :aria-busy="loading">
			<p v-if="loading" :class="$style.status" role="status">{{ labels.loading }}</p>
			<div v-else-if="error" :class="$style.status" role="alert"><p>{{ labels.error }}</p><button type="button" :disabled="closing" data-flower-collection-action="retry" @click="emit('retry')"><i class="ti ti-reload" aria-hidden="true"></i>{{ labels.retry }}</button></div>
			<p v-else-if="items.length === 0" :class="$style.status" role="status">{{ labels.empty }}</p>
			<div v-else :class="$style.grid">
				<button
					v-for="flower in items"
					:key="flower.id"
					type="button"
					:class="$style.flower"
					:data-flower-id="flower.id"
					:data-rare="flower.rare"
					:disabled="closing"
					:aria-label="flowerLabel(flower)"
					aria-haspopup="dialog"
					@click="selectFlower(flower, $event)"
				>
					<span :class="$style.art"><HataskEmoji :emoji="flower.emoji" :class="$style.emoji"/><span v-if="flower.rare" :class="$style.rare"><i class="ti ti-sparkles" aria-hidden="true"></i>{{ labels.rare }}</span></span>
					<span :class="$style.name" :title="flower.name">{{ flower.name }}</span>
					<span v-if="flower.variety" :class="$style.variety">{{ flower.variety }}</span>
					<span v-if="flower.hanakotoba" :class="$style.meaning">{{ flower.hanakotoba }}</span>
					<span v-if="flower.user" :class="$style.owner"><MkAvatar :user="flower.user" :class="$style.avatar" :link="false" :preview="false" :forceShowDecoration="true"/><MkUserName v-if="!personal" :user="flower.user" :class="$style.ownerName" :nowrap="false" :enableEmojiMenu="false"/></span>
					<time :class="$style.date" :datetime="flower.harvestedAt">{{ flower.dateLabel }}</time>
				</button>
			</div>
		</div>
		<footer :class="$style.footer">
			<button type="button" :aria-label="labels.previous" :disabled="closing || loading || page <= 1" data-flower-collection-action="previous" @click="changePage(page - 1)"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
			<span :class="$style.page" aria-live="polite">{{ page }} / {{ Math.max(1, totalPages) }}</span>
			<button type="button" :aria-label="labels.next" :disabled="closing || loading || page >= totalPages" data-flower-collection-action="next" @click="changePage(page + 1)"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
		</footer>
	</section>
</MkModal>
</template>

<script lang="ts" setup>
import { inject, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import type { HataskFlowerSelection, HataskFlowerView } from './hatask-flower-view.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import MkModal from '@/components/MkModal.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';

export type HataskFlowerCollectionLabels = {
	close: string;
	sort: string;
	newest: string;
	oldest: string;
	previous: string;
	next: string;
	loading: string;
	error: string;
	retry: string;
	empty: string;
	rare: string;
	harvested: string;
};

const goesMotion = !!inject(HATA_GOES_HOST, null);
const props = withDefaults(defineProps<{
	items: readonly HataskFlowerView[];
	title: string;
	summary: string;
	page: number;
	totalPages: number;
	order: 'newest' | 'oldest';
	loading: boolean;
	error: boolean;
	personal: boolean;
	source: HTMLElement;
	theme: string;
	mode: 'light' | 'dark';
	animations: boolean;
	labels: HataskFlowerCollectionLabels;
	isOpen?: boolean;
}>(), { isOpen: true });
const emit = defineEmits<{
	closed: [];
	select: [payload: HataskFlowerSelection];
	page: [page: number];
	order: [order: 'newest' | 'oldest'];
	retry: [];
}>();
const modal = useTemplateRef('modal');
const closeButton = useTemplateRef('closeButton');
const content = useTemplateRef('content');
const titleId = `hatask-flower-collection-${useId()}`;
const themeStyle = ref<Record<string, string>>({});
const closing = ref(false);
let disposed = false;
let didClose = false;

// The popup is mounted outside Hatask, so retain the opener's existing theme.
const inheritedTokens = ['--bg', '--surface', '--masthead', '--fg', '--fg-2', '--rule', '--accent', '--accent-ink', '--on-accent', '--card-radius', '--card-border', '--htk-font-body', '--htk-font-head', '--htk-fallback', '--shadow'] as const;

function inheritTheme(): void {
	const style = window.getComputedStyle(props.source);
	const values: Record<string, string> = { fontFamily: style.fontFamily };
	for (const token of inheritedTokens) {
		const value = style.getPropertyValue(token).trim();
		if (value) values[token] = value;
	}
	themeStyle.value = values;
}

function close(): void {
	if (closing.value || disposed) return;
	closing.value = true;
	modal.value?.close();
}

function dismissWithEscape(event: KeyboardEvent): void {
	event.preventDefault();
	event.stopPropagation();
	close();
}

function onClosed(): void {
	if (didClose) return;
	didClose = true;
	emit('closed');
}

function onOpened(): void {
	if (!closing.value && !disposed) closeButton.value?.focus({ preventScroll: true });
}

function flowerLabel(flower: HataskFlowerView): string {
	const owner = props.personal ? null : [flower.user?.name, flower.user?.username].find(name => name != null && name !== '');
	return [flower.name, flower.variety, owner, `${props.labels.harvested} ${flower.dateLabel}`, flower.rare ? props.labels.rare : null].filter(Boolean).join(' · ');
}

function selectFlower(flower: HataskFlowerView, event: MouseEvent): void {
	if (closing.value || props.loading || props.error || !(event.currentTarget instanceof HTMLElement)) return;
	const anchor = event.currentTarget;
	emit('select', { flower, anchor, returnFocusTo: anchor });
}

function changePage(page: number): void {
	if (closing.value || props.loading || page < 1 || page > props.totalPages || page === props.page) return;
	emit('page', page);
}

function changeOrder(event: Event): void {
	if (closing.value || props.loading || !(event.target instanceof HTMLSelectElement)) return;
	const order = event.target.value;
	if ((order === 'newest' || order === 'oldest') && order !== props.order) emit('order', order);
}

onMounted(() => {
	inheritTheme();
	if (!props.isOpen) close();
});
watch(() => props.isOpen, open => { if (!open) close(); });
watch([() => props.theme, () => props.mode], inheritTheme);
watch([() => props.page, () => props.order], () => { if (content.value) content.value.scrollTop = 0; });
onBeforeUnmount(() => { disposed = true; });
defineExpose({ close });
</script>

<style lang="scss" module>
.panel {
	--collection-surface: var(--masthead, var(--surface, var(--MI_THEME-panel)));
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	margin: auto;
	width: min(780px, calc(100dvw - 32px));
	max-height: calc(100dvh - 32px);
	border: 1px solid var(--rule, var(--MI_THEME-divider));
	border-radius: min(var(--card-radius, 20px), 20px);
	color: var(--fg, var(--MI_THEME-fg));
	background: linear-gradient(var(--collection-surface), var(--collection-surface)), var(--bg, var(--MI_THEME-bg));
	box-shadow: 0 14px 40px #0003;
	font: 13px/1.6 var(--htk-font-body, inherit);
	line-break: strict;
	overflow-wrap: anywhere;
	caret-color: transparent;
	container-type: inline-size;
}
.panel button, .panel select { box-sizing: border-box; min-height: 44px; border: 1px solid var(--rule, var(--MI_THEME-divider)); border-radius: min(var(--card-radius, 11px), 11px); color: var(--fg, var(--MI_THEME-fg)); background: transparent; font: inherit; cursor: pointer; touch-action: manipulation; }
.panel button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 12px; }
.panel button:hover:not(:disabled) { background-color: color-mix(in srgb, var(--accent, var(--MI_THEME-accent)) 8%, transparent); }
.panel button:focus-visible, .panel select:focus-visible { outline: 3px solid var(--accent-ink, var(--accent, var(--MI_THEME-accent))); outline-offset: 3px; }
.panel button:disabled, .panel select:disabled { opacity: .5; cursor: default; }
.panel select { padding: 7px 28px 7px 10px; background: var(--collection-surface); }
.header { display: flex; flex: 0 0 auto; align-items: flex-start; gap: 12px; padding: 16px 16px 0; }
.heading { flex: 1; min-width: 0; }
.heading h2 { margin: 0; font: 700 19px/1.45 var(--htk-font-head, inherit); }
.heading p { margin: 5px 0 0; color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 12px; }
.panel .close { flex: 0 0 44px; width: 44px; padding: 0; border: 0; border-radius: 50%; font-size: 20px; }
.toolbar { flex: 0 0 auto; padding: 12px 16px; }
.sort { display: flex; align-items: center; justify-content: flex-end; gap: 10px; font-size: 12px; }
.content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px 14px; }
.status { margin: 0; padding: 32px 12px; text-align: center; color: var(--fg-2, var(--MI_THEME-fgMuted)); }
.status p { margin: 0 0 14px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.panel .flower { position: relative; display: flex; flex-direction: column; justify-content: flex-start; gap: 5px; min-width: 0; padding: 12px 10px 10px; text-align: center; }
.flower[data-rare='true'] { border-color: var(--accent, var(--MI_THEME-accent)); box-shadow: 0 0 12px color-mix(in srgb, var(--accent, var(--MI_THEME-accent)) 24%, transparent); }
.flower[data-rare='true']::before { content: ''; position: absolute; inset: -1px; border: 1px solid transparent; border-top-color: var(--accent, var(--MI_THEME-accent)); border-left-color: var(--accent, var(--MI_THEME-accent)); border-radius: inherit; opacity: .7; pointer-events: none; }
.panel[data-motion='on'] .flower[data-rare='true']::before { animation: rareLight 5.6s ease-in-out infinite; }
.art { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 76px; }
.emoji { width: 58px; height: 58px; }
.rare { position: absolute; bottom: -2px; right: 0; display: inline-flex; align-items: center; gap: 3px; padding: 1px 5px; border-radius: 999px; color: var(--accent-ink, var(--accent, var(--MI_THEME-accent))); background: var(--collection-surface); font-size: 12px; }
.name { display: -webkit-box; width: 100%; min-height: 2.9em; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.45; font-weight: 700; white-space: normal; overflow-wrap: anywhere; }
.variety { color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 12px; }
.meaning { font-size: 12px; }
.owner { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; margin-top: auto; padding: 8px 2px 3px; box-sizing: border-box; }
.avatar { flex: 0 0 25px; width: 25px; height: 25px; overflow: visible; }
.ownerName { min-width: 0; font-size: 12px; }
.date { margin-top: auto; color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 12px; }
.footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 14px; padding: 10px 16px; border-top: 1px solid var(--rule, var(--MI_THEME-divider)); }
.footer > button { width: 44px; padding: 0; }
.page { min-width: 58px; text-align: center; font-variant-numeric: tabular-nums; }
@keyframes rareLight { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@container (min-width: 520px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (min-width: 700px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .panel[data-motion='on'] .flower[data-rare='true']::before { animation: none; } }
@media (forced-colors: active) { .flower[data-rare='true'] { border: 2px solid Highlight; box-shadow: none; } }
</style>

<style lang="scss">
.hatask-flower-collection-modal[data-flower-motion='off'] > * { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; }
.hatask-flower-collection-modal[data-flower-motion='off'] * { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
	.hatask-flower-collection-modal:not([data-hatagoes='true']) > * { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; }
	.hatask-flower-collection-modal:not([data-hatagoes='true']) * { animation: none !important; }
}
</style>
