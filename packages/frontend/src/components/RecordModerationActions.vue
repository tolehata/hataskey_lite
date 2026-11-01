<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.root" :aria-label="copy.actionsTitle">
	<h3>{{ copy.actionsTitle }}</h3>
	<div :class="$style.actions">
		<button type="button" :disabled="busy" @click="open('warn')"><i class="ti ti-alert-triangle" aria-hidden="true"></i>{{ copy.warn }}</button>
		<button type="button" :class="$style.danger" :disabled="busy" @click="open('delete')"><i class="ti ti-trash" aria-hidden="true"></i>{{ copy.deleteRecord }}</button>
		<button type="button" :disabled="busy" @click="open('history')"><i class="ti ti-history" aria-hidden="true"></i>{{ copy.history }}</button>
	</div>
</section>
</template>
<script setup lang="ts">
import type { RecordModerationResult, RecordModerationTarget } from '@/utility/record-moderation.js';
import { openRecordModeration } from '@/utility/record-moderation.js';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._recordModeration;
const props = defineProps<{ target: RecordModerationTarget; busy?: boolean; mode?: 'light' | 'dark' }>();
const emit = defineEmits<{ completed: [result: RecordModerationResult] }>();

function open(action: 'delete' | 'warn' | 'history') { void openRecordModeration({ ...props.target }, action, result => emit('completed', result), props.mode); }
</script>
<style module>
.root { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--hy-border, var(--rule, var(--MI_THEME-divider))); }
.root h3 { margin: 0 0 12px; font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.actions button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 8px 13px; border: 1px solid var(--hy-border, var(--rule, var(--MI_THEME-divider))); border-radius: 999px; background: var(--hy-surface, var(--surface, var(--MI_THEME-panel))); color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.actions .danger { color: var(--MI_THEME-error); }
.actions button:disabled { opacity: .5; cursor: default; }
.actions button:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
</style>
