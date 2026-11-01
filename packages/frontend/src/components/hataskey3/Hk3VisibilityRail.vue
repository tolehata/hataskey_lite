<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span v-if="color" data-hk3-visibility-rail :class="$style.rail" :style="{ '--hk3-visibility-color': color }" aria-hidden="true"></span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { prefer } from '@/preferences.js';

const props = defineProps<{ visibility?: string | null }>();

const color = computed(() => {
	if (!prefer.r['postFormVisibilityBorder.enabled'].value) return null;
	switch (props.visibility) {
		case 'public': return prefer.r['postFormVisibilityBorder.color.public'].value;
		case 'home': return prefer.r['postFormVisibilityBorder.color.home'].value;
		case 'followers': return prefer.r['postFormVisibilityBorder.color.followers'].value;
		case 'specified': return prefer.r['postFormVisibilityBorder.color.specified'].value;
		default: return null;
	}
});
</script>

<style lang="scss" module>
.rail {
	position: absolute;
	top: 10px;
	bottom: 10px;
	left: 3px;
	width: 3px;
	border-radius: 999px;
	background: linear-gradient(to bottom, transparent, var(--hk3-visibility-color) 18px, var(--hk3-visibility-color) calc(100% - 18px), transparent);
	box-shadow: 2px 0 7px color-mix(in srgb, var(--hk3-visibility-color) 20%, transparent);
	pointer-events: none;
}
</style>
