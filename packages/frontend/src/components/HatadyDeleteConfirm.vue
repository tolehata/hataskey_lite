<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="title || i18n.ts._hata._hatady._home.delete" :variant="variant" @close="finish(false)" @closed="emit('closed')">
	<p>{{ text }}</p>
	<template #actions>
		<button type="button" :class="$style.cancel" @click="finish(false)">{{ i18n.ts.cancel }}</button>
		<button type="button" :class="danger ? $style.delete : $style.confirm" @click="finish(true)">{{ danger ? i18n.ts._hata._hatady._home.delete : i18n.ts.ok }}</button>
	</template>
</HyDialog>
</template>
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { i18n } from '@/i18n.js';
withDefaults(defineProps<{ variant: HatadySurfaceVariant; text: string; title?: string; danger?: boolean }>(), { danger: true });
const emit = defineEmits<{ (event: 'done', value: boolean): void; (event: 'closed'): void }>();
const dialog = useTemplateRef('dialog');

function finish(value: boolean): void { emit('done', value); dialog.value?.close(); }
</script>
<style lang="scss" module>
.cancel, .delete, .confirm { border: 0; border-radius: 12px; padding: 10px 18px; cursor: pointer; }
.cancel { color: inherit; background: var(--hy-soft); }
.delete { color: #fff; background: #a33636; }
.confirm { color: #fff; background: var(--hy-accent); }
</style>
