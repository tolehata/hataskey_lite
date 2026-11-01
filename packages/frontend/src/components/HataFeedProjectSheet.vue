<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkModal ref="modal" @click="modal?.close()" @esc="modal?.close()" @closed="emit('closed')">
	<section class="hatady-scope hatafeed-scope" :data-hatady-theme="hataFeedTheme" :class="$style.sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId">
		<header :class="$style.header"><h2 :id="titleId">{{ title }}</h2><button type="button" class="_button" :aria-label="i18n.ts.close" @click="modal?.close()"><i class="ti ti-x" aria-hidden="true"></i></button></header>
		<div :class="$style.body">
			<template v-if="projects">
				<button v-for="project in projects" :key="project.id ?? 'official'" type="button" :class="$style.project" :aria-pressed="project.id === currentId" @click="select(project.id)">
					<i :class="project.icon" aria-hidden="true"></i><span>{{ project.name }}</span><i v-if="project.id === currentId" class="ti ti-check" aria-hidden="true"></i>
				</button>
				<button type="button" :class="$style.project" @click="emit('overview'); modal?.close()"><i class="ti ti-info-circle" aria-hidden="true"></i>{{ i18n.ts._hata._hatafeed._home.overview }}</button>
			</template>
			<p v-for="(line, index) in lines" :key="index" :class="$style.paragraph">{{ line }}</p>
		</div>
	</section>
</MkModal>
</template>
<script setup lang="ts">
import { ref, useId } from 'vue';
import MkModal from '@/components/MkModal.vue';
import { i18n } from '@/i18n.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import '@/components/hatafeed-ui.css';
withDefaults(defineProps<{
	title: string;
	lines?: string[];
	projects?: { id: string | null; name: string; icon: string }[];
	currentId?: string | null;
}>(), { lines: () => [], projects: undefined, currentId: null });
const emit = defineEmits<{ closed: []; select: [id: string | null]; overview: [] }>();
const modal = ref<InstanceType<typeof MkModal>>();
const titleId = useId();

function select(id: string | null): void { emit('select', id); modal.value?.close(); }
</script>
<style module>
.sheet { margin: auto; width: min(560px, 100dvw); max-height: 85dvh; display: flex; flex-direction: column; border-radius: 24px; background: var(--hy-surface, var(--MI_THEME-panel)); color: var(--hy-ink, var(--MI_THEME-fg)); overflow: hidden; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid var(--MI_THEME-divider); }
.header h2 { margin: 0; font-size: 20px; }
.header button { width: 44px; height: 44px; }
.body { padding: 12px 22px 24px; overflow: auto; }
.project { display: flex; gap: 14px; align-items: center; width: 100%; padding: 18px 12px; background: transparent; color: inherit; border: 0; border-bottom: 1px solid var(--MI_THEME-divider); text-align: start; font: inherit; cursor: pointer; }
.project span { flex: 1; }
.project[aria-pressed='true'] { color: var(--hy-accent, var(--MI_THEME-accent)); font-weight: 700; }
.paragraph { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; }
@media (max-width: 700px) { .sheet { position: fixed; bottom: 0; left: 0; margin: 0; border-radius: 24px 24px 0 0; padding-bottom: env(safe-area-inset-bottom); } }
</style>
