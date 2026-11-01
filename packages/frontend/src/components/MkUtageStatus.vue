<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root" data-utage-status-line :data-state="note.utageStatus" @click.stop>
	<span :class="$style.title"><i data-utage-revival-symbol :class="waiting ? 'ti ti-clock' : note.utageStatus === 'reviving' ? 'ti ti-repeat' : note.utageStatus === 'succeeded' ? 'ti ti-check' : 'ti ti-x'"></i>{{ heading }}</span>
	<span v-if="note.utageRevival" :class="$style.progress" role="img" :aria-label="i18n.tsx._hata._utage.progress({ count: note.utageRevival.reactionCount, target: note.utageRevival.targetCount })">
		<MkUtageNumber :value="note.utageRevival.reactionCount"/><span aria-hidden="true">/</span><MkUtageNumber :value="note.utageRevival.targetCount"/><span aria-hidden="true">{{ copy.people }}</span>
	</span>
	<span v-if="note.utageStatus === 'reviving'" :class="$style.timer"><span v-if="!waiting">{{ copy.remaining }}</span>{{ Math.floor(remaining / 60) }}:{{ String(remaining % 60).padStart(2, '0') }}</span>
	<span v-if="personal" :class="$style.personal">{{ personal }}</span>
</div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { createVisibilityAwareInterval } from '@@/js/interval.js';
import type { UtageSnapshot } from '@/utility/utage.js';
import { i18n } from '@/i18n.js';
import MkUtageNumber from '@/components/MkUtageNumber.vue';
const props = defineProps<{ note: UtageSnapshot }>();
const copy = i18n.ts._hata._utage;
const clock = ref(Date.now());
const offset = ref(0);
watch(() => props.note.utageServerNow, value => {
	if (value && Number.isFinite(Date.parse(value))) offset.value = Date.parse(value) - Date.now();
	clock.value = Date.now();
}, { immediate: true });
watch(() => props.note.utageStatus, (status, _, cleanup) => {
	if (status === 'reviving') cleanup(createVisibilityAwareInterval(() => { clock.value = Date.now(); }, 250, { immediate: true }));
}, { immediate: true });
const remaining = computed(() => Math.max(0, Math.ceil((Date.parse(props.note.utageRevival?.expiresAt ?? '') - clock.value - offset.value) / 1000)) || 0);
const waiting = computed(() => props.note.utageStatus === 'reviving' && remaining.value === 0);
const heading = computed(() => waiting.value ? copy.waiting : props.note.utageStatus === 'reviving' ? copy.revival : props.note.utageStatus === 'succeeded' ? copy.revived : copy.revivalFailed);
const personal = computed(() => {
	if (props.note.utageStatus !== 'reviving' || waiting.value) return '';
	switch (props.note.utageMyParticipation) {
		case 'accepted': return copy.accepted;
		case 'author': return copy.authorExcluded;
		case 'existing': return copy.existingExcluded;
		case 'ineligible': return copy.ineligible;
		default: return '';
	}
});
</script>
<style lang="scss" module>
.root { display: flex; align-items: center; flex-wrap: wrap; column-gap: 12px; row-gap: 3px; margin-top: 8px; font-size: .8em; color: var(--MI_THEME-fgMuted); }
.title { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; color: var(--MI_THEME-warn); }
.root[data-state='succeeded'] .title { color: var(--MI_THEME-success); }
.root[data-state='failed'] .title { color: var(--MI_THEME-error); }
.progress { display: inline-flex; align-items: baseline; gap: 3px; white-space: nowrap; }
.timer { display: inline-flex; gap: 4px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.personal { flex-basis: 100%; font-size: .9em; }
</style>
