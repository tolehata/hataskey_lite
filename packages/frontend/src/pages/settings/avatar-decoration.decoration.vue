<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button
	type="button"
	:class="$style.root"
	:data-active="active"
	:disabled="locked && !active"
	@click="emit('click')"
>
	<div :class="$style.name"><MkCondensedLine :minScale="0.5">{{ decoration.name }}</MkCondensedLine></div>
	<MkAvatar style="width: 60px; height: 60px;" :user="$i" :decorations="[{ url: decoration.url, angle, flipH, offsetX, offsetY, scale, opacity }]" forceShowDecoration/>
	<div v-if="status" :class="$style.status">{{ status }}</div>
	<i v-if="locked" :class="$style.lock" class="ti ti-lock" aria-hidden="true"></i>
</button>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { DecorationAvailability } from '@/utility/avatar-decoration-availability.js';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { decorationUnavailableReason } from '@/utility/avatar-decoration-availability.js';
import { useAvatarDecorationClock } from '@/composables/use-avatar-decoration-clock.js';

const $i = ensureSignin();

const props = defineProps<{
	active?: boolean;
	decoration: DecorationAvailability & {
		id: string;
		url: string;
		name: string;
		roleIdsThatCanBeUsedThisDecoration: string[];
	};
	angle?: number;
	flipH?: boolean;
	offsetX?: number;
	offsetY?: number;
	scale?: number;
	opacity?: number;
}>();

const emit = defineEmits<{
	(ev: 'click'): void;
}>();

const now = useAvatarDecorationClock(() => [props.decoration]);
const reason = computed(() => decorationUnavailableReason(props.decoration, $i.roles.map(role => role.id), now.value));
const locked = computed(() => reason.value != null);
const status = computed(() => reason.value ? i18n.ts._hataskDecoration[reason.value] : props.decoration.requiresHataskFlowerCompletion ? i18n.ts._hataskDecoration.unlocked : props.decoration.availableUntil ? i18n.ts._hataskDecoration.limited : '');
</script>

<style lang="scss" module>
.root {
	position: relative;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-panel);
	font-family: inherit;
	min-width: 0;
	cursor: pointer;
	padding: 16px 16px 28px 16px;
	border: solid 2px var(--MI_THEME-divider);
	border-radius: 8px;
	text-align: center;
	font-size: 90%;
	overflow: clip;
	contain: content;
}

.root[data-active='true'] {
	background-color: var(--MI_THEME-accentedBg);
	border-color: var(--MI_THEME-accent);
}

.name {
	position: relative;
	z-index: 10;
	font-weight: bold;
	margin-bottom: 20px;
}

.root:disabled { cursor: not-allowed; }
.root:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.status { margin-top: 12px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }

.lock {
	position: absolute;
	bottom: 12px;
	right: 12px;
	color: var(--MI_THEME-warn);
}
</style>
