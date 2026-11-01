<!--
SPDX-FileCopyrightText: tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- Only reviewed, escaped guide illustrations enter this local DOM surface.
     Controllers never receive the account, API client, or preference store. -->
<figure ref="figure" class="hg-scene" style="margin-inline: 0" :data-scene="featureId" :data-source="features[featureId].source" :data-hata-intro-instance="instance" @click="explain" @change="changeTheme" v-html="markup"></figure>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, useId, useTemplateRef, watch } from 'vue';
import { features } from './content.js';
import { composerTools, sceneMarkup } from './static-scenes.js';
import { brandName, hataskGuideProse, icon } from './prose.js';
import * as notes from './note-scenes.js';
import * as tools from './tool-scenes.js';
import * as settings from './settings-scenes.js';
import * as planner from './planner-scenes.js';
import * as feed from './feed-scenes.js';
import * as studio from './studio-scenes.js';
import * as channels from './channel-scenes.js';
import * as collections from './collection-scenes.js';
import * as uiS from './ui-s-scenes.js';
import * as hatagoes from './hatagoes-scenes.js';

const props = defineProps<{ featureId: string }>();
const emit = defineEmits<{ navigate: [id: string]; status: [text: string] }>();
const figure = useTemplateRef<HTMLElement>('figure');
const instance = useId();
const modules = [notes, tools, settings, planner, feed, studio, channels, collections, uiS, hatagoes];
const templates = Object.assign({}, ...modules.map(module => module.templates));
const state = reactive({ previewTheme: 'cherry', deckView: false, logKind: 'all' });
const markup = computed(() => sceneMarkup(props.featureId, state, instance, templates));
let cleanup: (() => void)[] = [];
let focusRevision = 0;

async function restoreFocus(selector: string) {
	const revision = ++focusRevision;
	await nextTick();
	if (revision === focusRevision) figure.value?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}

function dispose() {
	for (const release of cleanup.splice(0)) release();
}

function initialize() {
	if (!figure.value) return;
	cleanup = modules.map(module => module.init(figure.value!));
}

function explain(event: MouseEvent) {
	const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
	if (!button || !figure.value?.contains(button)) return;
	if (button.dataset.action === 'composer-help') {
		const scope = button.closest('[data-composer-example]');
		const tool = composerTools.find(item => item[0] === button.dataset.id);
		const help = scope?.querySelector('[data-composer-help]');
		if (!tool || !scope || !help) return;
		help.innerHTML = `<strong>${icon(tool[1])} ${brandName(tool[2])}</strong><p>${hataskGuideProse(tool[3])}</p>`;
		scope.querySelectorAll('[data-action="composer-help"]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
	} else if (button.dataset.action === 'demo-view') {
		if (button.dataset.view !== 'standard' && button.dataset.view !== 'deck') return;
		state.deckView = button.dataset.view === 'deck';
		if (event.detail === 0) void restoreFocus(`[data-view="${button.dataset.view}"]`);
		emit('status', state.deckView ? '例をデッキ表示に切り替えたよ' : '例を通常表示に戻したよ');
	} else if (button.dataset.action === 'demo-log-kind') {
		const kind = button.dataset.kind;
		if (!kind || !['all', 'study', 'movie', 'game'].includes(kind)) return;
		state.logKind = kind;
		if (event.detail === 0) void restoreFocus(`[data-kind="${kind}"]`);
		emit('status', '例の活動タイムラインを更新したよ');
	} else if (button.dataset.action === 'feature' && button.dataset.id && Object.hasOwn(features, button.dataset.id)) {
		emit('navigate', button.dataset.id);
	}
}

function changeTheme(event: Event) {
	const input = event.target as HTMLInputElement;
	if (!input.matches('[data-preview-theme]') || !['cherry', 'mirerado'].includes(input.value)) return;
	state.previewTheme = input.value;
	void restoreFocus(`[data-preview-theme][value="${input.value}"]`);
}

watch(markup, dispose, { flush: 'pre' });
watch(markup, initialize, { flush: 'post' });
onMounted(initialize);
onBeforeUnmount(() => { focusRevision++; dispose(); });
</script>
