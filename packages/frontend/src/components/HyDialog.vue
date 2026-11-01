<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<component
	:is="embedded ? 'div' : MkModal"
	ref="modal"
	:class="embedded ? $style.embeddedHost : undefined"
	v-bind="
		embedded
			? {}
			: { preferType: floating ? 'popup' : 'dialog', anchorElement, disableBgBlur: floating, transparentBg: floating, motionPreset: instantClose ? 'none' : undefined }
	"
	@click="onBackdrop"
	@esc="requestClose"
	@closed="emit('closed')"
>
	<section
		ref="panel"
		:class="[$style.panel, 'hatady-scope']"
		:data-hatady-variant="variant"
		:data-hatady-theme="props.theme ?? theme"
		:data-wide="wide"
		:data-floating="floating"
		:data-hatagoes="!!hataGoes"
		:data-embedded="embedded"
		:data-bare="bare"
		:inert="inert"
		:role="embedded ? undefined : 'dialog'"
		:aria-modal="embedded ? undefined : true"
		:aria-labelledby="bare ? undefined : titleId"
		:aria-label="bare ? title : undefined"
		:aria-busy="busy || undefined"
	>
		<header v-if="!bare" :class="$style.head" :data-actions="!!$slots.headerActions" :data-title-centered="centerTitle && !$slots.headerActions">
			<button
				v-if="back || hataGoes"
				:class="{ [$style.goesBack]: !back }"
				type="button"
				class="hy-icon-button"
				:aria-label="i18n.ts._hata._hatady._controls.back"
				:disabled="busy"
				@click="back ? emit('back') : requestClose()"
			>
				<i class="ti ti-arrow-left" aria-hidden="true"></i>
			</button>
			<h2 :id="titleId">
				<slot name="header">{{ title }}</slot>
			</h2>
			<slot name="headerActions"></slot>
			<button type="button" class="hy-icon-button" :aria-label="i18n.ts.close" :disabled="busy" @click="requestClose">
				<i class="ti ti-x" aria-hidden="true"></i>
			</button>
		</header>
		<div v-if="!embedded" ref="notice" :class="$style.notice"></div>
		<div
			ref="bodyEl"
			:class="$style.body"
			:data-bare="bare"
			:data-scroll-hint="scrollHint"
			:data-scroll-more="hasMore"
			:style="{ '--hy-fade': `${fadeSize}px` }"
			@scroll.passive="updateScroll"
			@toggle.capture="updateScroll"
			@load.capture="updateScroll"
		>
			<slot></slot>
		</div>
		<footer v-if="$slots.actions || $slots.footer" :class="$style.actions">
			<slot name="actions"><slot name="footer"></slot></slot>
		</footer>
	</section>
</component>
</template>

<script setup lang="ts">
import { inject, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue';
import type { HatadyTheme } from '@/utility/hatady-prefs.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { i18n } from '@/i18n.js';
import MkModal from '@/components/MkModal.vue';
import { hatadyTheme as theme } from '@/utility/hatady-prefs.js';
import { registerHatadySurface } from '@/utility/hatady-ui.js';
import '@/components/hatady-ui.css';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const hataGoes = inject(HATA_GOES_HOST, null);

const props = withDefaults(
	defineProps<{
		title?: string;
		theme?: HatadyTheme;
		variant?: HatadySurfaceVariant;
		centerTitle?: boolean;
		back?: boolean;
		busy?: boolean;
		wide?: boolean;
		embedded?: boolean;
		bare?: boolean;
		inert?: boolean;
		scrollHint?: boolean;
		anchorElement?: HTMLElement | null;
		floating?: boolean;
		instantClose?: boolean;
	}>(),
	{
		title: '',
		theme: undefined,
		variant: 'hatady',
		centerTitle: false,
		back: false,
		busy: false,
		wide: false,
		embedded: false,
		bare: false,
		inert: false,
		scrollHint: false,
		anchorElement: null,
		floating: false,
		instantClose: false,
	},
);
const emit = defineEmits<{ (event: 'close'): void; (event: 'closed'): void; (event: 'back'): void }>();
const titleId = useId();
const modal = ref<{ close?: () => void } | null>(null);
const panel = useTemplateRef('panel');
const notice = useTemplateRef('notice');
const bodyEl = useTemplateRef('bodyEl');
const hasMore = ref(false),
	fadeSize = ref(0);
let observer: ResizeObserver | undefined, mutation: MutationObserver | undefined;
let unregister: (() => void) | undefined;

function requestClose(): void {
	if (!props.busy && !props.inert) emit('close');
}

function onBackdrop(event?: Event): void {
	// An embedded panel is ordinary DOM; its child clicks must not request closing.
	if (!props.embedded && !event) requestClose();
}

function updateScroll(): void {
	const body = bodyEl.value;
	if (!body) return;
	const remaining = body.scrollHeight - body.clientHeight - Math.max(0, body.scrollTop);
	hasMore.value = props.scrollHint && body.clientHeight > 0 && remaining > 1;
	fadeSize.value = Math.min(32, Math.max(0, remaining));
}

function observeContent(): void {
	observer?.disconnect();
	const body = bodyEl.value;
	if (body) {
		observer?.observe(body);
		for (const child of body.children) observer?.observe(child);
	}
	updateScroll();
}

function close(): void {
	if (props.embedded) emit('closed');
	else modal.value?.close?.();
}

onMounted(() => {
	if (!props.embedded && notice.value) unregister = registerHatadySurface(notice.value);
	observer = new ResizeObserver(updateScroll);
	mutation = new MutationObserver(observeContent);
	if (bodyEl.value) mutation.observe(bodyEl.value, { childList: true });
	observeContent();
});
watch(
	() => props.scrollHint,
	() => nextTick(updateScroll),
);
onUnmounted(() => {
	observer?.disconnect();
	mutation?.disconnect();
	unregister?.();
});
defineExpose({ close, bodyEl, panel });
</script>

<style lang="scss" module>
.panel {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	min-height: 0;
	width: min(690px, calc(100dvw - 32px));
	max-height: calc(100dvh - 40px);
	background: var(--hy-surface);
	color: var(--hy-ink);
	border: 1px solid var(--hy-border);
	border-radius: 28px;
	box-shadow: 0 28px 100px #0b242b55;
	overflow: hidden;
	container: hy-dialog / inline-size;
}
.panel[data-hatady-variant='ui'] {
	--hy-surface: var(--MI_THEME-panel);
	--hy-ink: var(--MI_THEME-fg);
	--hy-body: var(--MI_THEME-fg);
	--hy-muted: color-mix(in srgb, var(--MI_THEME-fg) 66%, transparent);
	--hy-accent: var(--MI_THEME-accent);
	--hy-accent-ink: var(--MI_THEME-accent);
	--hy-border: var(--MI_THEME-divider);
	--hy-soft: var(--MI_THEME-accentedBg);
	--hy-surface-2: var(--MI_THEME-bg);
	border-radius: 16px;
}
.panel[data-hatady-variant='uis'] {
	--hy-surface: var(--hk3-glass-menu, var(--hk3-surface, var(--MI_THEME-panel)));
	--hy-ink: var(--hk3-text, var(--MI_THEME-fg));
	--hy-body: var(--hy-ink);
	--hy-muted: color-mix(in srgb, var(--hy-ink) 68%, transparent);
	--hy-accent: var(--hk3-accent, var(--MI_THEME-accent));
	--hy-accent-ink: var(--hy-accent);
	--hy-border: color-mix(in srgb, var(--hy-ink) 16%, transparent);
	--hy-soft: color-mix(in srgb, var(--hy-accent) 14%, transparent);
	--hy-surface-2: color-mix(in srgb, var(--hy-surface) 86%, transparent);
	backdrop-filter: blur(22px);
}
.panel[data-wide='true'] {
	width: min(1100px, calc(100dvw - 32px));
}
.panel[data-floating='false'][data-embedded='false'] {
	// MkModal provides the full-screen flex area; its child owns centering.
	margin: auto;
	max-width: 100%;
	max-height: 100%;
}
.panel[data-floating='true'] {
	width: min(392px, calc(100dvw - 24px));
	max-height: min(640px, calc(100dvh - 100px));
	border-radius: 24px;
}
.embeddedHost {
	display: flex;
	flex: 1;
	min-height: 0;
	min-width: 0;
}
.panel[data-embedded='true'] {
	flex: 1;
	width: 100%;
	min-height: 0;
	max-height: none;
	border: 0;
	border-radius: 0;
	box-shadow: none;
}
.head {
	display: flex;
	flex: none;
	align-items: center;
	gap: 10px;
	padding: 16px 22px;
	border-bottom: 1px solid var(--hy-border);
}
.head h2 {
	flex: 1;
	margin: 0;
	font-size: 18px;
	line-height: 1.5;
	overflow-wrap: anywhere;
}
.head[data-actions='true'] h2 {
	flex: 0 1 auto;
}
.head[data-actions='true'] > :last-child {
	margin-left: auto;
}
.head[data-title-centered='true'] {
	display: grid;
	grid-template-columns: 44px minmax(0, 1fr) 44px;
}
.head[data-title-centered='true'] h2 {
	grid-column: 2;
	grid-row: 1;
	text-align: center;
}
.head[data-title-centered='true'] > button:first-child {
	grid-column: 1;
	grid-row: 1;
}
.head[data-title-centered='true'] > button:last-child {
	grid-column: 3;
	grid-row: 1;
}
.body {
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	padding: 25px;
	overscroll-behavior: contain;
}
.body[data-bare='true'] {
	padding: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.panel[data-embedded='true'][data-bare='true'] {
	background: transparent;
	overflow: visible;
}
.panel[data-embedded='true'][data-bare='true'] > .body {
	display: block;
	flex: none;
	overflow: visible;
}
.body[data-scroll-hint='true'] {
	scrollbar-width: none;
	scroll-padding-block-end: 32px;
}
.body[data-scroll-hint='true']::-webkit-scrollbar {
	display: none;
}
.body[data-scroll-hint='true'][data-scroll-more='true'] {
	mask-image: linear-gradient(to bottom, #000 calc(100% - var(--hy-fade)), transparent);
	-webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - var(--hy-fade)), transparent);
}
.actions {
	display: flex;
	flex: none;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 10px;
	padding: 16px 25px;
	border-top: 1px solid var(--hy-border);
}
.notice:empty {
	display: none;
}
@container hy-dialog (max-width: 560px) {
	.head {
		padding: 10px 14px;
	}
	.body {
		padding: 19px;
	}
	.body[data-bare='true'] {
		padding: 0;
	}
	.actions {
		padding: 13px 19px;
	}
}
.goesBack { display: none; }
@media (max-width: 700px) {
	.goesBack { display: inline-flex; }
	.panel[data-hatagoes='true'][data-floating='false'][data-embedded='false'] {
		position: fixed; inset: 0; margin: 0;
		width: 100dvw; height: 100dvh; max-width: none; max-height: none;
		border: 0; border-radius: 0;
		padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);
	}
}

</style>
