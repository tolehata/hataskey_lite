<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<div :class="$style.head">
		<div :class="$style.icon"><HataAppLogo app="hatafeed" :size="42" :monochrome="store.r.darkMode.value"/></div>
		<span :class="$style.corner"><i class="ti ti-message-report"></i></span>
	</div>
	<div :class="$style.tail">
		<header :class="$style.header">
			<span :class="$style.brandTag">{{ i18n.ts._hata._notificationBrands.hataFeed }}</span>
			<MkTime v-if="withTime" :time="group.createdAt" :class="$style.headerTime" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'"/>
		</header>
		<button
			type="button"
			:class="$style.summary"
			:aria-expanded="expanded"
			@click="toggleExpanded"
		>
			<span :class="$style.summaryText">{{ copy.multipleNotifications }}</span>
			<span :class="$style.count">{{ copyx.itemCount({ count: group.items.length.toString() }) }}</span>
			<i class="ti" :class="expanded ? 'ti-chevron-up' : 'ti-chevron-down'"></i>
		</button>
		<div v-if="expanded" :class="$style.items">
			<MkA
				v-for="item in group.items"
				:key="item.id"
				:data-notification-ids="JSON.stringify([item.id])"
				:to="item.link ?? '/hatafeed'"
				:class="$style.item"
			>
				<HataFeedNotificationBody :class="$style.itemBody" :text="hataFeedNotificationDisplayBody(item.body)"/>
				<MkTime :time="item.createdAt" :class="$style.itemTime" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'"/>
			</MkA>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import type { HataFeedBellGroup } from '@/utility/hatafeed-bell-group.js';
import { hataFeedNotificationDisplayBody } from '@/utility/hatafeed-bell-group.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import HataFeedNotificationBody from '@/components/HataFeedNotificationBody.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import { store } from '@/store.js';

withDefaults(defineProps<{
	group: HataFeedBellGroup;
	withTime?: boolean;
}>(), {
	withTime: false,
});

const expanded = ref(false);
const emit = defineEmits<{ (ev: 'expanded'): void }>();

function toggleExpanded() {
	expanded.value = !expanded.value;
	emit('expanded');
}

const copy = i18n.ts._hata._hatafeed._notificationGroup;
const copyx = i18n.tsx._hata._hatafeed._notificationGroup;
</script>

<style lang="scss" module>
.root {
	box-sizing: border-box;
	display: flex;
	padding: 24px 32px;
	font-size: .9em;
	overflow-wrap: break-word;
	contain: content;
	content-visibility: auto;
	contain-intrinsic-size: 0 100px;
	background: color-mix(in srgb, #8fc0ff 13%, var(--MI_THEME-panel));
}

:global(html[data-color-scheme=light]) .root {
	background: color-mix(in srgb, #2e62a8 9%, var(--MI_THEME-panel));
}

:global(html.hataGlassUi) .root {
	background: color-mix(in srgb,
		color-mix(in srgb, #8fc0ff 18%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
	-webkit-backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
	backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
}

:global(html[data-color-scheme=light].hataGlassUi) .root {
	background: color-mix(in srgb,
		color-mix(in srgb, #2e62a8 8%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
}

.head {
	position: sticky;
	top: 0;
	flex: 0 0 42px;
	width: 42px;
	height: 42px;
	margin-right: 8px;
}

.corner {
	position: absolute;
	right: -5px;
	bottom: -5px;
	display: grid;
	place-items: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #8fc0ff;
	color: #1b2d43;
	font-size: 12px;
}

:global(html[data-color-scheme=light]) .corner {
	background: #2e62a8;
	color: #fff;
}

.brandTag {
	margin-right: 8px;
	padding: 2px 7px;
	border-radius: 999px;
	background: var(--MI_THEME-accentedBg);
	color: #8fc0ff;
	font-size: 11px;
	font-weight: 700;
}

:global(html[data-color-scheme=light]) .brandTag { color: #2e62a8; }

.icon {
	display: grid;
	align-items: center;
	justify-items: center;
	width: 100%;
	height: 100%;
	border-radius: 100%;
}

.tail {
	flex: 1;
	min-width: 0;
}

.header {
	display: flex;
	align-items: baseline;
	white-space: nowrap;
}

.headerTime {
	margin-left: auto;
	font-size: .9em;
}

.summary {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	margin-top: 4px;
	padding: 8px 10px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 35%, var(--MI_THEME-divider));
	border-radius: 10px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-fg);
	font: inherit;
	font-weight: 700;
	text-align: left;
	cursor: pointer;

	i { margin-left: auto; color: var(--MI_THEME-accent); }

	&:hover { filter: brightness(1.04); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
}

.count {
	flex: 0 0 auto;
	padding: 2px 7px;
	border-radius: 999px;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-size: .8em;
}

.summaryText {
	flex: 1 1 auto;
	min-width: 0;
}

.items {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-top: 8px;
	padding-left: 8px;
	border-left: 2px solid var(--MI_THEME-accent);
}

.item {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	min-width: 0;
	padding: 8px 10px;
	border-radius: 8px;
	color: inherit;
	text-decoration: none;

	&:hover { background: var(--MI_THEME-accentedBg); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
}

.itemBody {
	flex: 1;
	min-width: 0;
	white-space: normal;
	word-break: break-word;
}

.itemTime {
	flex: 0 0 auto;
	font-size: .82em;
	opacity: .65;
}

@container (max-width: 420px) {
	.root { padding: 18px 16px; }
	.item { flex-direction: column; gap: 3px; }
	.itemTime { align-self: flex-end; }
}
</style>
