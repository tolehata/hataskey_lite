<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<XReaction v-for="[reaction, count] in reactions" :key="reaction" :reaction="reaction" :count="count" :note="note"/>
	<slot v-if="hasMoreReactions" name="more"></slot>
</div>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { watch, ref } from 'vue';
import XReaction from '@/components/EmReactionsViewer.reaction.vue';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	maxNumber?: number;
}>(), {
	maxNumber: Infinity,
});

const reactions = ref<[string, number][]>([]);
const hasMoreReactions = ref(false);

if (props.note.myReaction != null && !(props.note.myReaction in props.note.reactions)) {
	reactions.value.push([props.note.myReaction, props.note.reactions[props.note.myReaction]]);
}

watch([() => props.note.reactions, () => props.maxNumber], ([newSource, maxNumber]) => {
	let newReactions: [string, number][] = [];
	hasMoreReactions.value = Object.keys(newSource).length > maxNumber;

	for (let i = 0; i < reactions.value.length; i++) {
		const reaction = reactions.value[i][0];
		if (reaction in newSource && newSource[reaction] !== 0) {
			reactions.value[i][1] = newSource[reaction];
			newReactions.push(reactions.value[i]);
		}
	}

	const newReactionsNames = newReactions.map(([x]) => x);
	newReactions = [
		...newReactions,
		...Object.entries(newSource)
			.sort(([, a], [, b]) => b - a)
			.filter(([y], i) => i < maxNumber && !newReactionsNames.includes(y)),
	];

	newReactions = newReactions.slice(0, props.maxNumber);

	if (props.note.myReaction && !newReactions.map(([x]) => x).includes(props.note.myReaction)) {
		newReactions.push([props.note.myReaction, newSource[props.note.myReaction]]);
	}

	reactions.value = newReactions;
}, { immediate: true, deep: true });
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	margin: 10px -2px 10px -2px;

	&:empty {
		display: none;
	}
}
</style>
