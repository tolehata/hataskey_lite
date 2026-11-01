<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="root" :class="$style.root" :data-tiny="tiny ? 'true' : undefined" data-audience-icons>
	<span :class="$style.icon" role="img" :title="federationLabel" :aria-label="federationLabel" :data-local-only="localOnly ? 'true' : 'false'">
		<Rocket :size="iconSize" aria-hidden="true"/>
		<svg v-if="localOnly" :class="$style.slash" :width="iconSize" :height="iconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="3" x2="21" y2="21"/></svg>
	</span>
	<span v-if="showVisibility" :class="$style.icon" role="img" :title="visibilityLabel" :aria-label="visibilityLabel" :data-visibility="visibility">
		<component :is="visibilityIcon" :size="iconSize" aria-hidden="true"/>
	</span>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Globe, House, Lock, Mail, Rocket } from '@lucide/vue';
import type * as Misskey from 'cherrypick-js';
import { useHk3AvatarClearance } from './use-hk3-avatar-clearance.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	visibility: Misskey.entities.Note['visibility'];
	localOnly?: boolean;
	tiny?: boolean;
	showVisibility?: boolean;
}>(), { localOnly: false, tiny: false, showVisibility: true });

const copy = i18n.ts._hata._hataskeyUi3;
const federationLabel = computed(() => props.localOnly ? copy.localOnlyTitle : copy.federateTitle);
const visibilityLabel = computed(() => i18n.ts._visibility[props.visibility]);
const visibilityIcon = computed(() => ({ public: Globe, home: House, followers: Lock, specified: Mail })[props.visibility]);
const iconSize = computed(() => props.tiny ? 13 : 16);
const root = ref<HTMLElement | null>(null);
useHk3AvatarClearance(root);
</script>

<style lang="scss" module>
.root {
	margin-top: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	width: 100%;
	line-height: 0;
	color: var(--hk3-neutral-700);
}

.icon {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 18px;
	flex: none;

	.root[data-tiny] & { width: 13px; height: 15px; }
}

.slash {
	position: absolute;
	inset: 0;
	margin: auto;
}
</style>
