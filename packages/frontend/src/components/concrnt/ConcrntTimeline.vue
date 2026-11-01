<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL（コンカレントのタイムライン）。外部TL(MkExternalTimeline)と同じ Hataskey UI のカード契約で並べる。
投稿・返信・引用はポップアップの投稿フォーム、リアクションは絵文字ピッカーで行い、TLには直置きしない。
通知は旗鯖の通知トーストと通知ページ（コンカレントのタブ）へ外部として流す。
-->

<template>
<div :class="$style.root" :data-embedded="embedded">
	<MkLoading v-if="!state.initialized"/>
	<div v-else-if="state.status !== 'connected'" :class="$style.empty">
		<i class="concrnt-icon" :class="$style.emptyIcon" aria-hidden="true"></i>
		<p :class="$style.emptyTitle">{{ state.connection ? '接続を確認してください' : 'コンカレントを連携する' }}</p>
		<p :class="$style.emptyText">{{ state.error || 'Concrnt v2のアカウントでタイムラインや投稿を利用できます。' }}</p>
		<MkButton link to="/settings/concrnt" primary rounded>連携設定を開く</MkButton>
	</div>
	<template v-else>
		<div :class="$style.toolbar">
			<ConcrntListPicker :class="$style.listPicker" :modelValue="lists.uri" :lists="lists.items" :loading="lists.loading" :error="lists.error" :disabled="lists.pending || !active" @update:modelValue="selectList" @refresh="refreshConcrntLists"/>
			<button v-tooltip="'更新'" class="_button" :class="$style.toolButton" aria-label="更新" :disabled="loading || lists.pending" @click="load(false)"><i class="ti ti-refresh"></i></button>
			<button v-tooltip="'送信履歴'" class="_button" :class="$style.toolButton" aria-label="送信履歴" @click="openConcrntHistory()">
				<i class="ti ti-history"></i><span v-if="pendingOperations" :class="$style.toolBadge">{{ pendingOperations }}</span>
			</button>
			<button v-tooltip="'コンカレントに投稿'" class="_button" :class="[$style.toolButton, $style.compose]" aria-label="コンカレントに投稿" @click="focusComposer()"><i class="ti ti-pencil"></i></button>
		</div>
		<MkInfo v-if="error" :class="$style.info" warn role="alert">{{ error }}</MkInfo>
		<MkInfo v-if="unavailable" :class="$style.info" role="status">{{ unavailable }}件の投稿を取得できませんでした。権限や通信状態をご確認ください。</MkInfo>
		<MkLoading v-if="loading && !messages.length"/>
		<div v-else-if="!messages.length && !error" :class="$style.empty"><p :class="$style.emptyText">表示できる投稿がありません。</p></div>
		<div
			v-else :class="$style.notes"
			:data-concrnt-timeline-ui="hataskeyUi ? 'hataskey' : undefined"
			:data-concrnt-timeline-mode="hataskeyUi ? visualMode : undefined"
			:data-concrnt-timeline-glass="hataskeyUi && glassBg ? 'on' : undefined"
			:data-concrnt-timeline-spacing="hataskeyUi ? spacing : undefined"
		>
			<ConcrntNote v-for="message in messages" :key="message.uri" :class="$style.note" :message="message" :visualMode="visualMode" :glassBg="hataskeyUi && glassBg" @update="replace"/>
		</div>
		<button v-if="next && messages.length" v-appear="prefer.s.enableInfiniteScroll ? loadMore : null" class="_button" :class="$style.more" :disabled="loading" @click="loadMore">
			<MkLoading v-if="loading" :inline="true"/><span v-else>もっと見る</span>
		</button>
	</template>
</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ConcrntMessage } from '@/utility/concrnt/types.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import ConcrntNote from '@/components/concrnt/ConcrntNote.vue';
import ConcrntListPicker from '@/components/concrnt/ConcrntListPicker.vue';
import { prefer } from '@/preferences.js';
import { concrntState as state, initializeConcrnt, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntListState as lists, concrntPostedRevision, concrntSelectedList, openConcrntHistory, openConcrntPostForm, refreshConcrntLists, selectConcrntList } from '@/utility/concrnt/composer.js';
import { storeConcrntMessage } from '@/utility/concrnt/message-cache.js';

const props = withDefaults(defineProps<{
	active?: boolean;
	embedded?: boolean;
	/** Use the Hataskey UI card contract shared with the external timeline. */
	hataskeyUi?: boolean;
	glassBg?: boolean;
}>(), { active: true, embedded: false, hataskeyUi: false, glassBg: false });

const visualMode = computed(() => !props.hataskeyUi ? 'legacy' as const : (prefer.r['simpleUi.deckMode']?.value ?? false) ? 'hataskey-deck' as const : 'hataskey-normal' as const);
const spacing = computed(() => {
	const value = prefer.r['simpleUi.noteSpacing']?.value ?? 'moderate';
	return visualMode.value === 'hataskey-normal' && value === 'compact' ? 'moderate' : value;
});
const messages = ref<ConcrntMessage[]>([]);
const next = ref<string | null>(null);
const unavailable = ref(0);
const loading = ref(false);
const error = ref('');
const pendingOperations = computed(() => state.operations.filter(operation => operation.status === 'unknown' || operation.status === 'partial').length);
let request = 0;
let alive = true;

function report(failure: unknown): void { error.value = failure instanceof Error ? failure.message : '処理を完了できませんでした。'; }

async function load(more: boolean): Promise<void> {
	if (!props.active) return;
	const id = ++request;
	loading.value = true;
	error.value = '';
	try {
		if (!more && !await refreshConcrntLists()) {
			if (alive && request === id && lists.error) error.value = lists.error;
			return;
		}
		if (!alive || request !== id) return;
		if (lists.uri && !concrntSelectedList.value) { error.value = '選択したリストが見つかりません。リストを選び直してください。'; return; }
		const page = await runConcrntAction(client => client.getTimeline(state.settings.profile, lists.uri || undefined, more ? next.value ?? undefined : undefined));
		if (!alive || request !== id) return;
		for (const item of page.items) storeConcrntMessage(item);
		messages.value = more ? [...new Map([...messages.value, ...page.items].map(message => [message.uri, message])).values()] : page.items;
		next.value = page.next;
		unavailable.value = page.unavailable;
	} catch (failure) {
		if (alive && request === id) report(failure);
	} finally {
		if (alive && request === id) loading.value = false;
	}
}

function loadMore(): void {
	if (!loading.value && next.value) void load(true);
}

function replace(message: ConcrntMessage): void {
	messages.value = messages.value.map(item => item.uri === message.uri ? message : item);
}

async function selectList(uri: string): Promise<void> {
	try {
		if (!await selectConcrntList(uri) || !alive) return;
		request++;
		messages.value = []; next.value = null; unavailable.value = 0;
		await load(false);
	} catch (failure) { if (alive) report(failure); }
}

function clear(): void {
	request++;
	loading.value = false;
	messages.value = []; next.value = null; unavailable.value = 0; error.value = '';
}

watch(() => state.revision, clear);
watch(() => [state.status, state.busy] as const, ([status, connecting]) => { if (status === 'connected' && !connecting) void load(false); });
watch(() => props.active, active => {
	if (!active) { request++; loading.value = false; } else if (state.status === 'connected' && !messages.value.length) void load(false);
});
watch(concrntPostedRevision, () => { if (props.active && state.status === 'connected') void load(false); });
onMounted(async () => {
	await initializeConcrnt();
	if (alive && state.status === 'connected' && !loading.value) await load(false);
});
onBeforeUnmount(() => { alive = false; request++; });

/** Shells call this from their compose button while CTL is shown. */
async function focusComposer(): Promise<void> { await openConcrntPostForm(); }

defineExpose({ reloadTimeline: () => load(false), refreshFromPull: () => load(false), focusComposer });
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
	min-width: 0;
	max-width: 780px;
	margin-inline: auto;
	color: var(--MI_THEME-fg);

	&[data-embedded='true'] { max-width: none; }
}

.toolbar {
	position: sticky;
	top: var(--MI-stickyTop, 0px);
	z-index: 10;
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 10px;
}

.listPicker {
	flex: 1;
	min-width: 0;
}

.toolButton {
	position: relative;
	display: grid;
	flex: none;
	place-items: center;
	width: 40px;
	height: 40px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--MI_THEME-panel) 86%, transparent);
	box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--MI_THEME-divider) 70%, transparent);
	backdrop-filter: blur(12px);

	&:hover:not(:disabled) { background: var(--MI_THEME-buttonHoverBg); }
	&:disabled { opacity: .5; }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
}

.compose {
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	box-shadow: none;

	&:hover:not(:disabled) { background: var(--MI_THEME-accentLighten, var(--MI_THEME-accent)); }
}

.toolBadge {
	position: absolute;
	top: -2px;
	right: -2px;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	box-sizing: border-box;
	border-radius: 999px;
	background: var(--MI_THEME-warn);
	color: #fff;
	font-size: 10px;
	line-height: 16px;
}

.info {
	margin: 0 10px 10px;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 40px 20px;
	text-align: center;
}

.emptyIcon {
	font-size: 40px;
	opacity: .6;
}

.emptyTitle {
	margin: 0;
	font-weight: bold;
}

.emptyText {
	margin: 0 0 8px;
	font-size: .9em;
	opacity: .7;
}

.notes {
	container-type: inline-size;
	display: flex;
	flex-direction: column;
	gap: var(--MI-margin, 12px);
	padding: 0 0 8px;

	> .note {
		border-radius: var(--MI-radius);
		background: var(--MI_THEME-panel);
	}
}

/* Hataskey UI の外部TL契約と同じ間隔・境界（MkExternalTimeline 参照）。 */
.notes[data-concrnt-timeline-ui='hataskey'] {
	gap: 0;
	background: transparent;

	> .note {
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		border: none;
		border-radius: 0;
		background: transparent;
	}
}

.notes[data-concrnt-timeline-mode='hataskey-normal'] {
	&[data-concrnt-timeline-glass='on'][data-concrnt-timeline-spacing='moderate'] > .note {
		padding-top: 6px;
		padding-bottom: 4px;
	}

	&[data-concrnt-timeline-spacing='wide'] > .note {
		padding-top: 14px;
		padding-bottom: 10px;
	}
}

.notes[data-concrnt-timeline-mode='hataskey-deck'] {
	/* カードの間は地のまま。帯状の下敷き（panel 背景と区切り線）は敷かない。 */
	> .note {
		margin: 0;
		padding-top: 4px;
		padding-bottom: 4px;
	}

	&[data-concrnt-timeline-spacing='compact'] > .note {
		padding-top: 2px;
		padding-bottom: 2px;
	}

	&[data-concrnt-timeline-spacing='wide'] > .note {
		padding-top: 10px;
		padding-bottom: 8px;
	}
}

:global(html.hataGlassUi) .notes[data-concrnt-timeline-mode='hataskey-normal'][data-concrnt-timeline-spacing='moderate'] > .note {
	padding-top: 6px;
	padding-bottom: 4px;
}

.more {
	display: block;
	width: 100%;
	box-sizing: border-box;
	padding: 16px;
	color: var(--MI_THEME-accent);
}
</style>
