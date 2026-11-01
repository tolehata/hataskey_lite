<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

Permanent Hataskey UI editor for the redesigned settings page. This component
intentionally has no route side effects; the redesigned shell owns navigation
and may call requestDiscard() before replacing the active settings page.
-->

<template>
<div :class="$style.scope" :data-motion-enabled="motionEnabled ? 'true' : 'false'">
	<HatasabaUi2SettingsBody :editor="editor" mode="permanent" :motionEnabled="motionEnabled" @close="emit('close')" @preview="openPreview" @sideStudio="emit('sideStudio')" @saved="emit('saved')"/>
	<HatasabaUi2ImmediateSettings :motionEnabled="motionEnabled"/>
	<MkHatasabaUi2PreviewWindow v-if="previewOpen" :editor="editor" :motionEnabled="motionEnabled" @closed="previewOpen = false"/>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { prefer } from '@/preferences.js';
import HatasabaUi2SettingsBody from '@/components/HatasabaUi2SettingsBody.vue';
import HatasabaUi2ImmediateSettings from '@/components/HatasabaUi2ImmediateSettings.vue';
import MkHatasabaUi2PreviewWindow from '@/components/MkHatasabaUi2PreviewWindow.vue';
import { useHatasabaUi2Draft } from '@/composables/use-hatasaba-ui2-draft.js';

const props = withDefaults(defineProps<{ motionEnabled?: boolean }>(), { motionEnabled: undefined });
const emit = defineEmits<{ close: []; saved: []; sideStudio: []; preview: [] }>();
const reducedMotionQuery = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reducedMotionQuery?.matches ?? false);
const motionEnabled = computed(() => props.motionEnabled !== false && prefer.r.animation?.value !== false && !reducedMotion.value);
const editor = useHatasabaUi2Draft();
const hasChanges = computed(() => editor.hasChanges);
const previewOpen = ref(false);

/** Returns false when the user keeps an unsaved draft. The shell calls this before a route replacement. */
async function requestDiscard(): Promise<boolean> {
	return editor.discard();
}

function rollback(): void { editor.restoreLivePreviewToSnapshot(); }

function syncReducedMotion(event: MediaQueryListEvent): void { reducedMotion.value = event.matches; }

function openPreview(): void {
	previewOpen.value = true;
	emit('preview');
}

onMounted(() => reducedMotionQuery?.addEventListener('change', syncReducedMotion));

// Route deactivation cannot be cancelled synchronously by this component. It
// nevertheless never leaks temporary <html> preview classes into the next UI.
onBeforeUnmount(() => {
	reducedMotionQuery?.removeEventListener('change', syncReducedMotion);
	editor.restoreLivePreviewToSnapshot();
});

defineExpose({ requestDiscard, rollback, hasChanges, openPreview });
</script>

<style lang="scss" module>
.scope {
	inline-size: 100%;
	max-inline-size: none;
	margin-inline: 0;
	padding: 2px;
	/* 旗鯖fork: ⚠️`both` にしないこと。終状態の transform が残り続け、
	   この中の position: fixed（モーダル）の基準を奪って画面外へ飛ばす。 */
	animation: enter 220ms cubic-bezier(.2, .8, .2, 1) backwards;
}

@keyframes enter {
	from { opacity: 0; transform: translateY(8px); }
	to { opacity: 1; transform: translateY(0); }
}

.scope[data-motion-enabled='false'] { animation: none; }
.scope[data-motion-enabled='false'] :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }

@media (prefers-reduced-motion: reduce) {
	.scope, .scope :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
</style>
