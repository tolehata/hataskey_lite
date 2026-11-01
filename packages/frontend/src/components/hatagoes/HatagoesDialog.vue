<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkModal v-if="rendered" :manualShowing="open" :preferType="effectivePreferType" forceMotion @click="emit('close')" @esc="emit('close')" @closed="closed">
	<div :inert="!open" :class="[$style.frame, { [$style.drawer]: effectivePreferType === 'drawer' }]"><slot/></div>
</MkModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MkModal from '@/components/MkModal.vue';

const props = withDefaults(defineProps<{ open: boolean; preferType?: 'auto' | 'dialog' | 'drawer'; responsiveSheet?: boolean; keepRendered?: boolean }>(), { preferType: 'auto', responsiveSheet: false, keepRendered: false });
const emit = defineEmits<{ close: []; closed: [] }>();
const rendered = ref(props.open);
const narrowViewport = ref(false);
const effectivePreferType = computed(() => props.responsiveSheet && narrowViewport.value ? 'drawer' : props.preferType);
let viewportQuery: MediaQueryList | undefined;

function syncViewport(event: MediaQueryListEvent | MediaQueryList) { narrowViewport.value = event.matches; }

onMounted(() => {
	if (!props.responsiveSheet || typeof window.matchMedia !== 'function') return;
	viewportQuery = window.matchMedia('(max-width: 600px)');
	syncViewport(viewportQuery);
	viewportQuery.addEventListener('change', syncViewport);
});
onBeforeUnmount(() => viewportQuery?.removeEventListener('change', syncViewport));

watch(() => props.open, open => { if (open) rendered.value = true; });

function closed() {
	if (!props.open) { if (!props.keepRendered) rendered.value = false; emit('closed'); }
}
</script>

<style lang="scss" module>
.frame { min-width: 0; max-width: 100%; margin: auto; }
.drawer { width: 100%; margin: 0; }
.drawer > * { width: 100%; max-width: 100%; box-sizing: border-box; }
</style>
