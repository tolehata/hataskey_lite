<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
	旗鯖fork: 外部アカウント(external.token/host)の通知を表示するウィジェット。
	全UI(default/universal/deck等)のウィジェット追加メニューから利用可能。
	データソースは外部通知ページ(pages/external-notifications.vue)と同一:
	  - マウント時に callExternalApi('i/notifications') で履歴取得
	  - 'external-notification' CustomEvent(external-notification-stream.ts が
	    window へ dispatch)を listen してリアルタイムに先頭追加
	表示名のカスタム絵文字は <Mfm> に author(host付き)を渡すことで解決する
	(author.host が null だと MkMfm が emojiUrls を参照せずショートコードのまま残るため)。
-->

<template>
<MkContainer :style="`height: ${widgetProps.height}px;`" :showHeader="widgetProps.showHeader" :scrollable="true" class="mkw-externalNotifications">
	<template #icon><i class="ti ti-bell-ringing"></i></template>
	<template #header>{{ notificationCopy.title }}</template>
	<template #func="{ buttonStyleClass }">
		<button v-tooltip="notificationCopy.markAllRead" class="_button" :class="buttonStyleClass" @click="markAllAsRead()"><i class="ti ti-check"></i></button>
		<button v-tooltip="notificationCopy.refresh" class="_button" :class="buttonStyleClass" @click="fetchNotifications()"><i class="ti ti-refresh"></i></button>
	</template>

	<div :class="$style.root">
		<div v-if="!connected" :class="$style.empty">
			<i class="ti ti-plug-connected-x" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ notificationCopy.notConnected }}</div>
		</div>
		<div v-else-if="loading" :class="$style.loading">
			<MkLoading/>
		</div>
		<div v-else-if="notifications.length === 0" :class="$style.empty">
			<i class="ti ti-bell-off" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ notificationCopy.empty }}</div>
		</div>
		<div v-else :class="$style.list">
			<div v-for="n in notifications" :key="n.id" :class="$style.item" @click="onItemClick(n)">
				<div :class="$style.itemIconWrap">
					<img v-if="n.user?.avatarUrl" :src="n.user.avatarUrl" :class="$style.itemAvatar" :alt="n.user?.username ?? ''"/>
					<i v-else :class="[iconClassOf(n), $style.itemIcon]"></i>
					<div v-if="n.type === 'reaction' && n.reaction" :class="$style.itemReactionBadge">
						<MkReactionIcon :reaction="normalizeReaction(n.reaction)" :emojiUrl="reactionEmojiUrl(n)"/>
					</div>
				</div>
				<div :class="$style.itemBody">
					<div :class="$style.itemHeader">
						<span :class="$style.itemTitle">
							<Mfm :text="displayNameOf(n)" :plain="true" :nyaize="false" :emojiUrls="emojiUrlsOf(n)" :author="authorOf(n)"/>
							<span :class="$style.itemAction">{{ actionLabelOf(n) }}</span>
						</span>
						<span :class="$style.itemTime">{{ formatTime(n.createdAt) }}</span>
					</div>
					<div v-if="textOf(n)" :class="$style.itemText">{{ textOf(n) }}</div>
				</div>
			</div>
		</div>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import { prefer } from '@/preferences.js';
import { callExternalApi, getExternalEmojiUrlMap } from '@/utility/external-api.js';
import MkContainer from '@/components/MkContainer.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

const name = 'externalNotifications';
const notificationCopy = i18n.ts._hata._externalNotifications;
const notificationCopyx = i18n.tsx._hata._externalNotifications;
const notificationDateFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		default: true,
	},
	height: {
		type: 'number',
		default: 300,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const notifications = ref<any[]>([]);
const loading = ref(true);
const externalEmojiUrlMap = ref<Record<string, string>>({});

function checkConnected(): boolean {
	const token = prefer.s['external.token'];
	const host = prefer.s['external.host'];
	return token != null && host !== '' && host != null;
}
const connected = ref(checkConnected());

async function fetchNotifications() {
	if (!checkConnected()) { connected.value = false; loading.value = false; return; }
	connected.value = true;
	loading.value = true;
	try {
		const result = await callExternalApi('i/notifications', { limit: 20 });
		notifications.value = Array.isArray(result) ? result : [];
	} catch (err) {
		notifications.value = [];
	} finally {
		loading.value = false;
	}
}

async function markAllAsRead() {
	// 旗鯖fork: ローカルのバッジ消去はリモートAPIの成否と切り離す。
	// mark-all-as-read がスコープ不足等で失敗してもバッジが残らないように、
	// 「見た」事実の記録とバッジ消去イベントを先に無条件で行う。
	localStorage.setItem('extNotifLastReadAt', new Date().toISOString());
	window.dispatchEvent(new CustomEvent('ext-tl-notif-count', { detail: 0 }));
	try {
		await callExternalApi('notifications/mark-all-as-read', {});
	} catch {}
}

function onExternalNotification(ev: Event) {
	const n = (ev as CustomEvent).detail;
	if (!n?.id) return;
	if (notifications.value.find(x => x.id === n.id)) return;
	notifications.value.unshift(n);
}

function iconClassOf(n: any): string {
	const map: Record<string, string> = {
		'reaction': 'ti ti-mood-smile',
		'reply': 'ti ti-arrow-back-up',
		'mention': 'ti ti-at',
		'renote': 'ti ti-repeat',
		'quote': 'ti ti-quote',
		'follow': 'ti ti-user-plus',
		'receiveFollowRequest': 'ti ti-user-question',
		'followRequestAccepted': 'ti ti-user-check',
		'achievementEarned': 'ti ti-trophy',
		'app': 'ti ti-apps',
		'pollEnded': 'ti ti-chart-bar',
		'note': 'ti ti-pencil',
	};
	return map[n.type] ?? 'ti ti-bell';
}

// 旗鯖fork: 表示名 (name優先、なければusername) — MFM対応のため生テキストを返す
function displayNameOf(n: any): string {
	return n?.user?.name || n?.user?.username || notificationCopy.someone;
}

function actionLabelOf(n: any): string {
	const labels: Record<string, string> = {
		'reaction': notificationCopy.actions.reaction,
		'reply': notificationCopy.actions.reply,
		'mention': notificationCopy.actions.mention,
		'renote': notificationCopy.actions.renote,
		'quote': notificationCopy.actions.quote,
		'follow': notificationCopy.actions.follow,
		'receiveFollowRequest': notificationCopy.actions.receiveFollowRequest,
		'followRequestAccepted': notificationCopy.actions.followRequestAccepted,
		'achievementEarned': notificationCopy.actions.achievementEarned,
		'app': notificationCopy.actions.app,
		'pollEnded': notificationCopy.actions.pollEnded,
		'note': notificationCopy.actions.note,
	};
	return labels[n.type] ?? notificationCopy.unknownAction;
}

// 旗鯖fork: ユーザー名表示用のMFMカスタム絵文字URLマップ
function emojiUrlsOf(n: any): Record<string, string> {
	const map: Record<string, string> = {};
	if (n?.user?.emojis) Object.assign(map, n.user.emojis);
	return map;
}

// 旗鯖fork: <Mfm> に渡す author。host が null だと MkMfm が emojiUrls を
// 参照せず外部サーバーの絵文字を解決できないため、host(外部サーバー)を補う。
function authorOf(n: any): Misskey.entities.UserLite {
	const host = n?.user?.host ?? prefer.s['external.host'] ?? null;
	// 旗鯖fork(G9): Mfmのauthor propはUserLite全体を要求するが、ここではemojiUrl解決に
	//   使うhost/emojisしか要らない(挙動は既存のまま、型だけ橋渡し)。
	return { host, emojis: n?.user?.emojis } as Misskey.entities.UserLite;
}

function normalizeReaction(reaction: string): string {
	return reaction;
}

function reactionEmojiUrl(n: any): string | undefined {
	if (!n?.reaction) return undefined;
	const m = n.reaction.match(/^:([^:]+):$/);
	if (!m) return undefined;
	const emojiName = m[1];
	const pureName = emojiName.includes('@') ? emojiName.split('@')[0] : emojiName;
	const host = prefer.s['external.host'];
	if (n.note?.reactionEmojis) {
		const e = n.note.reactionEmojis;
		const found = e[emojiName] || e[pureName] || e[`${pureName}@${host}`] || e[`${pureName}@.`];
		if (found) return found;
	}
	if (n.note?.emojis) {
		if (Array.isArray(n.note.emojis)) {
			const f = n.note.emojis.find((e: any) => e.name === pureName || e.name === emojiName);
			if (f?.url) return f.url;
		} else {
			const f = n.note.emojis[pureName] || n.note.emojis[emojiName];
			if (f) return f;
		}
	}
	const cached = externalEmojiUrlMap.value[pureName] || externalEmojiUrlMap.value[emojiName];
	if (cached) return cached;
	if (host) return `https://${host}/emoji/${pureName}.webp`;
	return undefined;
}

function textOf(n: any): string {
	if (n?.note?.text) return n.note.text;
	if (n?.reaction) return n.reaction;
	if (n?.body) return n.body;
	return '';
}

function formatTime(ts: string): string {
	if (!ts) return '';
	const t = new Date(ts).getTime();
	if (Number.isNaN(t)) return '';
	const diff = Math.floor((Date.now() - t) / 1000);
	if (diff < 60) return notificationCopyx.secondsAgo({ count: diff.toString() });
	if (diff < 3600) return notificationCopyx.minutesAgo({ count: Math.floor(diff / 60).toString() });
	if (diff < 86400) return notificationCopyx.hoursAgo({ count: Math.floor(diff / 3600).toString() });
	return notificationDateFormatter.format(new Date(ts));
}

function onItemClick(n: any) {
	// クリック動作は外部通知ページと同様、現状は何もしない
}

onMounted(async () => {
	await fetchNotifications();
	try { externalEmojiUrlMap.value = await getExternalEmojiUrlMap(); } catch { /* フォールバックURLで対応 */ }
	window.addEventListener('external-notification', onExternalNotification);
});

onUnmounted(() => {
	window.removeEventListener('external-notification', onExternalNotification);
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	padding: 8px;
}
.loading {
	display: flex;
	justify-content: center;
	padding: 40px 0;
}
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40px 16px;
	opacity: 0.7;
}
.emptyIcon {
	font-size: 2.4em;
	margin-bottom: 10px;
	opacity: 0.5;
}
.emptyText {
	font-size: 0.9em;
}
.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.item {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 10px 12px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-left: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 70%, #4a9eff);
	border-radius: 10px;
	cursor: pointer;
	transition: background .15s;
}
.item:hover {
	background: color-mix(in srgb, var(--MI_THEME-accent) 4%, var(--MI_THEME-panel));
}
.itemIconWrap {
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}
.itemAvatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	object-fit: cover;
}
.itemReactionBadge {
	position: absolute;
	right: -4px;
	bottom: -4px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	border: 1.5px solid var(--MI_THEME-panel);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	box-shadow: 0 1px 4px rgba(0,0,0,.15);
	overflow: hidden;
}
.itemReactionBadge :deep(img),
.itemReactionBadge :deep(.mk-emoji),
.itemReactionBadge :deep(span) {
	width: 13px !important;
	height: 13px !important;
	max-width: 13px !important;
	max-height: 13px !important;
	object-fit: contain;
	font-size: 11px !important;
	line-height: 1 !important;
	margin: 0 !important;
}
.itemAction {
	font-weight: 400;
	opacity: 0.85;
}
.itemIcon {
	font-size: 1.05em;
	color: var(--MI_THEME-accent);
}
.itemBody {
	flex: 1;
	min-width: 0;
}
.itemHeader {
	display: flex;
	justify-content: space-between;
	gap: 8px;
	align-items: baseline;
}
.itemTitle {
	font-weight: 700;
	font-size: 0.9em;
}
.itemTime {
	font-size: 0.76em;
	opacity: 0.65;
	flex-shrink: 0;
}
.itemText {
	margin-top: 4px;
	font-size: 0.86em;
	opacity: 0.9;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
