<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 旗鯖fork: 通知ページの「コンカレント」タブ。外部通知と同じ見た目で、外部の通知として一覧する。 -->

<template>
<div :class="$style.root">
	<MkLoading v-if="!state.initialized || (loading && !items.length)"/>
	<div v-else-if="state.status !== 'connected'" :class="$style.empty">
		<i class="concrnt-icon" :class="$style.emptyIcon" aria-hidden="true"></i>
		<div>{{ state.connection ? 'コンカレントとの接続を確認してください。' : 'コンカレントは連携されていません。' }}</div>
		<MkButton link to="/settings/concrnt" rounded>連携設定を開く</MkButton>
	</div>
	<div v-else-if="!state.settings.notifications" :class="$style.empty">
		<i class="ti ti-bell-off" :class="$style.emptyIcon" aria-hidden="true"></i>
		<div>コンカレントの通知の受信は、連携設定で停止されています。</div>
		<MkButton link to="/settings/concrnt" rounded>連携設定を開く</MkButton>
	</div>
	<template v-else>
		<MkInfo v-if="error" warn role="alert">{{ error }}</MkInfo>
		<MkInfo v-if="unavailable" role="status">{{ unavailable }}件の通知を取得できませんでした。</MkInfo>
		<div v-if="!items.length && !error" :class="$style.empty">
			<i class="ti ti-bell-off" :class="$style.emptyIcon" aria-hidden="true"></i>
			<div>通知はありません</div>
		</div>
		<div v-else :class="$style.list">
			<div v-for="item in items" :key="item.uri" :class="$style.item" :data-unread="!state.read.includes(item.uri)" role="link" tabindex="0" @click="open(item)" @keydown.enter.prevent="open(item)">
				<div :class="$style.itemIconWrap">
					<img v-if="item.authorAvatarUrl" :src="item.authorAvatarUrl" :class="$style.itemAvatar" alt="" referrerpolicy="no-referrer"/>
					<i v-else :class="[iconOf(item), $style.itemIcon]" aria-hidden="true"></i>
					<span v-if="item.emoji" :class="$style.itemReactionBadge"><img :src="item.emoji.imageUrl" :alt="item.emoji.shortcode" referrerpolicy="no-referrer"/></span>
				</div>
				<div :class="$style.itemBody">
					<div :class="$style.itemHeader">
						<span :class="$style.itemTitle">{{ concrntDisplayName(item.authorName) }}<span :class="$style.itemAction">が{{ concrntNotificationLabels[item.type] }}</span></span>
						<MkTime :class="$style.itemTime" :time="item.createdAt"/>
					</div>
					<div v-if="item.preview" :class="$style.itemText">{{ item.preview }}</div>
				</div>
			</div>
		</div>
		<button v-if="next" v-appear="prefer.s.enableInfiniteScroll ? loadMore : null" class="_button" :class="$style.more" :disabled="loading" @click="loadMore">
			<MkLoading v-if="loading" :inline="true"/><span v-else>もっと見る</span>
		</button>
	</template>
</div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import { prefer } from '@/preferences.js';
import { concrntState as state, initializeConcrnt, markConcrntNotificationsRead, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntDisplayName, concrntNotificationLabels } from '@/utility/concrnt/content.js';
import { openConcrntMessage } from '@/utility/concrnt/composer.js';

const items = ref<ConcrntNotification[]>([]);
const next = ref<string | null>(null);
const unavailable = ref(0);
const loading = ref(false);
const error = ref('');
let request = 0;
let alive = true;

function iconOf(item: ConcrntNotification): string {
	return ({ reaction: 'ti ti-mood-smile', like: 'ti ti-heart', reply: 'ti ti-arrow-back-up', reroute: 'ti ti-repeat', mention: 'ti ti-at', follow: 'ti ti-user-plus', other: 'ti ti-bell' })[item.type];
}

async function load(more = false): Promise<void> {
	if (state.status !== 'connected' || !state.settings.notifications) return;
	const id = ++request;
	loading.value = true;
	error.value = '';
	try {
		const page = await runConcrntAction(client => client.getNotifications(state.settings.profile, more ? next.value ?? undefined : undefined));
		if (!alive || id !== request) return;
		items.value = more ? [...new Map([...items.value, ...page.items].map(item => [item.uri, item])).values()] : page.items;
		next.value = page.next;
		unavailable.value = page.unavailable;
	} catch (failure) {
		if (alive && id === request) error.value = failure instanceof Error ? failure.message : '通知を取得できませんでした。';
	} finally {
		if (alive && id === request) loading.value = false;
	}
}

function loadMore(): void { if (!loading.value && next.value) void load(true); }

/** Only notifications that were actually displayed are marked as read. */
async function markAllRead(): Promise<void> {
	if (items.value.length) await markConcrntNotificationsRead(items.value.map(item => item.uri));
}

function open(item: ConcrntNotification): void {
	void markConcrntNotificationsRead([item.uri]).catch(() => {});
	const uri = item.type === 'reply' || item.type === 'mention' ? item.messageUri ?? item.targetUri : item.targetUri ?? item.messageUri;
	if (uri) void openConcrntMessage(uri);
}

watch(() => state.revision, () => { request++; items.value = []; next.value = null; unavailable.value = 0; loading.value = false; });
watch(() => [state.status, state.busy, state.settings.notifications] as const, ([status, busy, enabled]) => { if (status === 'connected' && !busy && enabled) void load(); });
onMounted(async () => {
	await initializeConcrnt();
	if (alive) await load();
});
onBeforeUnmount(() => { alive = false; request++; });

defineExpose({ reload: () => load(), markAllRead });
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 0;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 60px 16px;
	text-align: center;
	opacity: .75;
}

.emptyIcon {
	font-size: 3em;
	opacity: .5;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.item {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 12px 14px;
	border: 1px solid var(--MI_THEME-divider);
	border-left: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 70%, #4a9eff);
	border-radius: 10px;
	background: var(--MI_THEME-panel);
	cursor: pointer;
	transition: background .15s;

	&:hover { background: color-mix(in srgb, var(--MI_THEME-accent) 4%, var(--MI_THEME-panel)); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
	&[data-unread='true'] { background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)); }
}

.itemIconWrap {
	position: relative;
	display: flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
}

.itemAvatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	object-fit: cover;
}

.itemIcon {
	color: var(--MI_THEME-accent);
	font-size: 1.1em;
}

.itemReactionBadge {
	position: absolute;
	right: -4px;
	bottom: -4px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	overflow: hidden;
	border: 1.5px solid var(--MI_THEME-panel);
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	box-shadow: 0 1px 4px rgba(0, 0, 0, .15);

	img {
		width: 14px;
		height: 14px;
		object-fit: contain;
	}
}

.itemBody {
	flex: 1;
	min-width: 0;
}

.itemHeader {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
}

.itemTitle {
	min-width: 0;
	font-size: .92em;
	font-weight: 700;
	overflow-wrap: anywhere;
}

.itemAction {
	font-weight: 400;
	opacity: .85;
}

.itemTime {
	flex-shrink: 0;
	font-size: .78em;
	opacity: .65;
}

.itemText {
	display: -webkit-box;
	margin-top: 4px;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	font-size: .85em;
	opacity: .85;
	overflow-wrap: anywhere;
}

.more {
	display: block;
	width: 100%;
	padding: 16px;
	color: var(--MI_THEME-accent);
}
</style>
