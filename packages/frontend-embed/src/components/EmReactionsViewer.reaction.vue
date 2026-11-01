<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button
	class="_button"
	:class="[$style.root, { [$style.reacted]: note.myReaction == reaction }]"
>
	<EmReactionIcon :class="$style.limitWidth" :reaction="reaction" :emojiUrl="note.reactionEmojis[reaction.substring(1, reaction.length - 1)]"/>
	<span :class="$style.count">{{ count }}</span>
</button>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import EmReactionIcon from '@/components/EmReactionIcon.vue';

const props = defineProps<{
	reaction: string;
	count: number;
	note: Misskey.entities.Note;
}>();
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	height: 38px;
	margin: 2px;
	padding: 0 12px;
	font-size: 1.35em;
	border-radius: 999px;
	align-items: center;
	justify-content: center;

	&:not(.canToggle) {
		cursor: default;
	}

	&.reacted, &.reacted:hover {
		background: var(--MI_THEME-accentedBg);
		color: var(--MI_THEME-accent);
		box-shadow: 0 0 0 1px var(--MI_THEME-accent) inset;

		> .count {
			color: var(--MI_THEME-accent);
		}
	}
}

.limitWidth {
	max-width: 70px;
	object-fit: contain;
}

.count {
	font-size: 0.9em;
	line-height: 32px;
	margin: 0 0 0 5px;
}
</style>
