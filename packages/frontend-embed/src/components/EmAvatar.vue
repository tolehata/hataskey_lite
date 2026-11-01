<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component :is="link ? EmA : 'span'" v-bind="bound" class="_noSelect" :class="[$style.root, { [$style.cat]: user.isCat }]">
	<EmImgWithBlurhash :class="$style.inner" :src="url" :hash="user.avatarBlurhash" :cover="true" :onlyAvgColor="true"/>
	<div v-if="user.isCat" :class="[$style.ears]">
		<div :class="$style.earLeft">
		</div>
		<div :class="$style.earRight">
		</div>
	</div>
	<img
		v-for="decoration in decorations ?? user.avatarDecorations"
		:class="[$style.decoration]"
		:src="getDecorationUrl(decoration)"
		:style="{
			rotate: getDecorationAngle(decoration),
			scale: getDecorationScale(decoration),
			translate: getDecorationOffset(decoration),
			transform: getDecorationTransform(decoration),
			opacity: getDecorationOpacity(decoration),
		}"
		alt=""
	>
</component>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as Misskey from 'cherrypick-js';
import EmImgWithBlurhash from './EmImgWithBlurhash.vue';
import EmA from './EmA.vue';
import { userPage } from '@@/js/user.js';

const props = withDefaults(defineProps<{
	user: Misskey.entities.User;
	link?: boolean;
	preview?: boolean;
	indicator?: boolean;
	decorations?: (Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'> & { blink?: boolean; })[];
}>(), {
	link: false,
	preview: false,
	indicator: false,
	decorations: undefined,
});

const emit = defineEmits<{
	(ev: 'click', v: MouseEvent): void;
}>();

const bound = computed(() => props.link
	? { to: userPage(props.user) }
	: {});

const url = computed(() => {
	if (props.user.avatarUrl == null) return null;
	return props.user.avatarUrl;
});

function getDecorationUrl(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	return decoration.url;
}

function getDecorationAngle(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	const angle = decoration.angle ?? 0;
	return angle === 0 ? undefined : `${angle * 360}deg`;
}

function getDecorationScale(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	const scaleX = decoration.flipH ? -1 : 1;
	return scaleX === 1 ? undefined : `${scaleX} 1`;
}

function getDecorationOffset(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	const offsetX = decoration.offsetX ?? 0;
	const offsetY = decoration.offsetY ?? 0;
	return offsetX === 0 && offsetY === 0 ? undefined : `${offsetX * 100}% ${offsetY * 100}%`;
}

function getDecorationTransform(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	const scale = decoration.scale ?? 1;
	return `${scale === 1 ? '' : `scale(${scale})`}`;
}

function getDecorationOpacity(decoration: Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'>) {
	const opacity = decoration.opacity ?? 1;
	return opacity === 1 ? undefined : opacity;
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: inline-block;
	vertical-align: bottom;
	flex-shrink: 0;
	border-radius: 100%;
	line-height: 16px;
}

.inner {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	top: 0;
	border-radius: 100%;
	z-index: 1;
	overflow: clip;
	object-fit: cover;
	width: 100%;
	height: 100%;
}

.cat {
	> .ears {
		contain: strict;
		position: absolute;
		top: -50%;
		left: -50%;
		width: 100%;
		height: 100%;
		padding: 50%;
		pointer-events: none;

		> .earLeft,
		> .earRight {
			contain: strict;
			display: inline-block;
			height: 50%;
			width: 50%;
			background: currentColor;

			&::after {
				contain: strict;
				content: '';
				display: block;
				width: 60%;
				height: 60%;
				margin: 20%;
				background: #df548f;
			}
		}

		> .earLeft {
			transform: rotate(37.5deg) skew(30deg);

			&, &::after {
				border-radius: 25% 75% 75%;
			}
		}

		> .earRight {
			transform: rotate(-37.5deg) skew(-30deg);

			&, &::after {
				border-radius: 75% 25% 75% 75%;
			}
		}
	}
}

.decoration {
	position: absolute;
	z-index: 1;
	top: -50%;
	left: -50%;
	width: 200%;
	pointer-events: none;
}
</style>
