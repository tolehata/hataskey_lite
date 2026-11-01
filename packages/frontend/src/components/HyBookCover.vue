<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hatady の自動表紙。円と曲線のアートを描き、既存の手動色指定を維持する。
-->
<template>
<span
	:class="$style.root"
	:data-kind="kind"
	:style="{
		width: `${width}px`, height: `${height}px`, backgroundColor: color,
		'--cover-padding': `${Math.min(17, Math.max(4, width * 0.12))}px`,
		'--cover-title-size': `${Math.min(14, Math.max(9, width * 0.14))}px`,
		'--cover-small-size': `${Math.min(10, Math.max(6, width * 0.1))}px`,
	}"
	:title="title"
>
	<template v-if="showTitle">
		<small :class="$style.imprint">{{ imprint }}</small>
		<strong :class="$style.title">{{ title }}</strong>
		<small v-if="author" :class="$style.author">{{ author }}</small>
	</template>
</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { HY_COVER_SETS } from '@/utility/hatady.js';

const props = withDefaults(defineProps<{
	title: string;
	author?: string | null;
	width?: number;
	showTitle?: boolean;
	colorIndex?: number | null;
	kind?: 'book' | 'movie' | 'game' | 'work';
}>(), {
	author: null,
	width: 34,
	showTitle: false,
	colorIndex: null,
	kind: 'book',
});

const palette = ['#405c63', '#a7614a', '#7b7453', '#655d86', '#486f70'];
const height = computed(() => Math.round(props.width * (props.kind === 'movie' ? 1.5 : props.kind === 'game' ? 1 : 1.36)));
const imprint = computed(() => ({ book: 'HATADY BOOKS', movie: 'HATADY CINEMA', game: 'HATADY GAMES', work: 'HATADY WORKS' })[props.kind]);
const color = computed(() => {
	// 手動で保存した番号は従来のパレットを参照し、保存値を変換しない。
	if (props.colorIndex != null && Number.isInteger(props.colorIndex) && props.colorIndex >= 0) {
		return HY_COVER_SETS[props.colorIndex % HY_COVER_SETS.length][0];
	}
	const key = props.kind === 'book' ? props.title : `${props.kind}:${props.title}`;
	let hash = 0;
	for (let index = 0; index < key.length; index++) hash = (Math.imul(hash, 31) + key.charCodeAt(index)) | 0;
	return palette[Math.abs(hash) % palette.length];
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	isolation: isolate;
	overflow: hidden;
	display: inline-flex;
	flex: 0 0 auto;
	flex-direction: column;
	justify-content: space-between;
	box-sizing: border-box;
	padding: var(--cover-padding);
	border-radius: 8px 13px 13px 8px;
	color: #fff8e8;
	text-align: left;
	box-shadow: inset 4px 0 0 #ffffff15, 6px 8px 14px -10px #293e4766;

	&[data-kind='movie'], &[data-kind='game'] { border-radius: 12px; }
	&::before {
		content: '';
		position: absolute;
		width: 85%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #eddbbd;
		right: -30%;
		top: 15%;
		opacity: .85;
	}
	&::after {
		content: '';
		position: absolute;
		left: 18%;
		bottom: -30%;
		width: 160%;
		height: 76%;
		border-radius: 50%;
		background: #162e3d88;
		transform: rotate(-24deg);
	}
}
.imprint, .title, .author {
	position: relative;
	z-index: 1;
	color: inherit;
	line-height: 1.4;
}
.imprint, .author { font-size: var(--cover-small-size); letter-spacing: .04em; }
.imprint { max-width: 8em; }
.title {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	font-family: var(--hy-heading, sans-serif);
	font-size: var(--cover-title-size);
	font-weight: 700;
	overflow-wrap: anywhere;
}
.author { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
