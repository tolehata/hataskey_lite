<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog :title="title" :variant="variant" :busy="busy" @close="emit('return')">
	<p :class="$style.description">{{ description }}</p>
	<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	<slot/>
	<template #actions>
		<div :class="$style.actions">
			<button type="button" class="hy-primary" :disabled="busy" @click="emit('save')">
				{{ copy.draftSaveClose }}
			</button>
			<button type="button" class="hy-secondary" :disabled="busy" @click="emit('discard')">
				{{ copy.draftDiscardClose }}
			</button>
			<button type="button" class="hy-secondary" :disabled="busy" @click="emit('return')">{{ copy.draftReturn }}</button>
		</div>
	</template>
</HyDialog>
</template>
<script setup lang="ts">
import HyDialog from '@/components/HyDialog.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._controls;
withDefaults(defineProps<{ title?: string; description?: string; busy?: boolean; error?: string; variant?: HatadySurfaceVariant }>(), {
	title: i18n.ts._hata._hatady._controls.draftTitle,
	description: i18n.ts._hata._hatady._controls.draftDescription,
	busy: false,
	error: '',
});
const emit = defineEmits<{ (e: 'save'): void; (e: 'discard'): void; (e: 'return'): void }>();
</script>
<style module>
.description {
	text-align: center;
	line-height: 1.8;
	margin: 6px 0;
}
.actions {
	display: grid;
	gap: 10px;
	width: 100%;
}
</style>
