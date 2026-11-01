<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root" :data-mode="mode" :data-mobile="mobile ? 'true' : undefined" :data-reduce-motion="reduceMotion ? 'true' : undefined" :data-glass="glass ? 'true' : undefined">
	<div data-hk3-side-page :class="$style.page" :data-active="pageActive ? 'true' : undefined" :inert="!pageActive || pageInert" :aria-hidden="!pageActive">
		<div v-if="controls && pageActive" :class="$style.toolbar">
			<span :class="$style.toolbarSpacer" aria-hidden="true"></span>
			<h1 v-if="title" :class="$style.title" :title="title">{{ title }}</h1>
			<div :class="$style.controls">
				<button v-if="!mobile" type="button" :class="$style.control" :title="mode === 'split' ? expandLabel : restoreLabel" :aria-label="mode === 'split' ? expandLabel : restoreLabel" @click="emit('toggle')"><ArrowLeftRight :size="18"/></button>
				<button type="button" :class="$style.control" :title="closeLabel" :aria-label="closeLabel" @click="emit('close')"><X :size="18"/></button>
			</div>
		</div>
		<Hk3SidePageContent :class="[$style.content, pageClass]" :data-embedded-surfaces="mode === 'split' && !!controls && pageActive && !mobile && !preservePageNavigation ? 'true' : undefined" :omitHeaderTitle="!!(controls && pageActive && title)" :omitHeaderBack="mode === 'split' && !!controls && pageActive && !mobile && !preservePageNavigation" :containedControls="!mobile"><slot name="page"/></Hk3SidePageContent>
	</div>
	<div data-hk3-side-timeline :class="$style.timeline" :data-active="timelineActive ? 'true' : undefined" :inert="!timelineActive" :aria-hidden="!timelineActive">
		<slot name="timeline"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ArrowLeftRight, X } from '@lucide/vue';
import Hk3SidePageContent from './Hk3SidePageContent.vue';

defineProps<{
	mode: 'home' | 'split' | 'full';
	pageActive: boolean;
	pageInert?: boolean;
	timelineActive: boolean;
	controls?: boolean;
	mobile?: boolean;
	preservePageNavigation?: boolean;
	reduceMotion?: boolean;
	glass?: boolean;
	pageClass?: string;
	title?: string;
	expandLabel: string;
	restoreLabel: string;
	closeLabel: string;
}>();

const emit = defineEmits<{
	(ev: 'toggle'): void;
	(ev: 'close'): void;
}>();
</script>

<style lang="scss" module>
.root {
	position: relative;
	isolation: isolate;
	display: grid;
	grid-template-columns: minmax(0, 0fr) minmax(0, 1fr);
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	background: transparent;
	transition: grid-template-columns 360ms cubic-bezier(0.22, 1, 0.36, 1);

	&[data-mode='split'] { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
	&[data-mode='full'] { grid-template-columns: minmax(0, 1fr) minmax(0, 0fr); }
	&[data-glass][data-mode='split'] {
		background: linear-gradient(to right, var(--hk3-glass-panel, var(--hk3-bg)) 45%, var(--hk3-glass-note, var(--hk3-bg)) 55%);
		&::before {
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			left: calc(50% - 24px);
			z-index: 0;
			width: 48px;
			pointer-events: none;
			background: linear-gradient(to right, transparent, color-mix(in srgb, var(--hk3-bg) 15%, transparent), transparent);
			-webkit-backdrop-filter: blur(16px);
			backdrop-filter: blur(16px);
		}
	}
}

.page, .timeline {
	position: relative;
	z-index: 1;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
}

.page {
	display: flex;
	flex-direction: column;
	visibility: hidden;
	transition: visibility 0s linear 360ms;
	&[data-active] { visibility: visible; transition-delay: 0s; }
}

.content {
	flex: 1;
	min-width: 0;
	min-height: 0;
}

.root[data-glass] .content {
	--MI-page-canvas: transparent;
	--MI-page-header-background: color-mix(in srgb, var(--MI_THEME-bg) 38%, transparent);
	--MI-page-controls-background: color-mix(in srgb, var(--MI_THEME-bg) 24%, transparent);
	--MI-page-tabs-background: color-mix(in srgb, var(--MI_THEME-panel) 56%, transparent);
	--MI-page-header-divider: transparent;
}

.root[data-glass] .content[data-embedded-surfaces] {
	--MI-embedded-canvas: transparent;
	--MI-embedded-bar: color-mix(in srgb, var(--MI_THEME-bg) 32%, transparent);
	--MI-embedded-panel: color-mix(in srgb, var(--MI_THEME-panel) 52%, transparent);
}

.root[data-glass][data-mode='split'] .content,
.root[data-glass][data-mode='split'] .timeline > :global(div) { background: transparent; }

.timeline {
	display: flex;
	flex-direction: column;
	visibility: hidden;
	transition: visibility 0s linear 360ms;
	&[data-active] { visibility: visible; overflow: visible; transition-delay: 0s; }
}

.toolbar {
	--hk3-side-controls-width: 94px;
	position: relative;
	flex: none;
	display: grid;
	grid-template-columns: var(--hk3-side-controls-width) minmax(0, 1fr) var(--hk3-side-controls-width);
	align-items: center;
	gap: 6px;
	height: 48px;
	padding: 2px 12px;
	box-sizing: border-box;
	background: transparent;

	// Only the background softens the join; title and controls keep their own sharp paint.
	&::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		bottom: -12px;
		z-index: -1;
		height: 28px;
		pointer-events: none;
		background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--hk3-glass-panel, var(--hk3-bg)) 24%, transparent) 45%, transparent);
		filter: blur(4px);
	}
}

.root[data-mobile] .toolbar { --hk3-side-controls-width: 44px; }
.toolbarSpacer { grid-column: 1; }

.title {
	grid-column: 2;
	min-width: 0;
	margin: 0;
	overflow: hidden;
	color: var(--hk3-text);
	font-size: 15px;
	font-weight: 700;
	text-align: center;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.controls {
	grid-column: 3;
	display: flex;
	justify-content: flex-end;
	gap: 6px;
}

.control {
	flex: none;
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	&:hover { background: var(--hk3-accent-100); color: var(--hk3-accent-800); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
}

.root[data-mobile] { transition: none; }
.root[data-mobile] .page, .root[data-mobile] .timeline { transition: none; }
.root[data-reduce-motion] { transition: none; }
.root[data-reduce-motion] .page, .root[data-reduce-motion] .timeline { transition: none; }
@media (prefers-reduced-motion: reduce) {
	.root, .page, .timeline { transition: none; }
}
</style>
