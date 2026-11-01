<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: 外部アカウント通知の専用ページ。
外部TL連携 (external.token + external.host) がONの時のみアクセス可能。
未連携時は external-account 設定ページにリダイレクトする。
-->

<template>
<PageWithHeader :actions="headerActions">
	<div :class="$style.root">
		<div v-if="loading" :class="$style.loading">
			<MkLoading/>
		</div>
		<div v-else-if="notifications.length === 0" :class="$style.empty">
			<i class="ti ti-bell-off" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ notificationCopy.empty }}</div>
		</div>
		<div v-else :class="$style.list">
			<div v-for="n in notifications" :key="n.id" :class="$style.item" @click="onItemClick(n)">
				<!-- 旗鯖fork: アバター画像 + リアクション絵文字のオーバーレイ -->
				<div :class="$style.itemIconWrap">
					<img v-if="n.user?.avatarUrl" :src="n.user.avatarUrl" :class="$style.itemAvatar" :alt="n.user?.username ?? ''"/>
					<i v-else :class="[iconClassOf(n), $style.itemIcon]"></i>
					<!-- リアクション通知は絵文字を右下にオーバーレイ -->
					<div v-if="n.type === 'reaction' && n.reaction" :class="$style.itemReactionBadge">
						<MkReactionIcon :reaction="normalizeReaction(n.reaction)" :emojiUrl="reactionEmojiUrl(n)"/>
					</div>
				</div>
				<div :class="$style.itemBody">
					<div :class="$style.itemHeader">
						<!-- 表示名 (MFM対応、name優先、なければusername) -->
						<span :class="$style.itemTitle">
							<Mfm :text="displayNameOf(n)" :plain="true" :nyaize="false" :emojiUrls="emojiUrlsOf(n)" :author="authorOf(n)"/>
							<span :class="$style.itemAction">{{ actionLabelOf(n) }}</span>
						</span>
						<span :class="$style.itemTime">{{ formatTime(n.createdAt) }}</span>
					</div>
					<div v-if="textOf(n)" :class="$style.itemText">{{ textOf(n) }}</div>
					<div v-if="hintOf(n)" :class="$style.itemHint">{{ hintOf(n) }}</div>
				</div>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { prefer } from '@/preferences.js';
import { useRouter } from '@/router.js';
import { callExternalApi } from '@/utility/external-api.js';
import { getExternalEmojiUrlMap } from '@/utility/external-api.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { definePage } from '@/page.js';
import MkLoading from '@/components/global/MkLoading.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';

const notifications = ref<any[]>([]);
const loading = ref(true);
const router = useRouter();
const notificationCopy = i18n.ts._hata._externalNotifications;
const notificationCopyx = i18n.tsx._hata._externalNotifications;
const notificationDateFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// 旗鯖fork: 外部サーバーのカスタム絵文字URLマップ (reactionEmojis に無い絵文字の解決用)
const externalEmojiUrlMap = ref<Record<string, string>>({});

// 旗鯖fork: 未連携時は external-account 設定ページへリダイレクト
function checkConnected(): boolean {
	const token = prefer.s['external.token'];
	const host = prefer.s['external.host'];
	return token != null && host !== '' && host != null;
}

async function fetchNotifications() {
	loading.value = true;
	try {
		const result = await callExternalApi('i/notifications', { limit: 30 });
		notifications.value = Array.isArray(result) ? result : [];
	} catch (err) {
		notifications.value = [];
	} finally {
		loading.value = false;
	}
}

async function markAllAsRead() {
	// 旗鯖fork: ローカルのバッジ消去はリモートAPIの成否と切り離す。
	// 以前は mark-all-as-read 成功後にのみイベントを飛ばしていたため、
	// トークンのスコープ不足・レート制限・一時的な通信失敗のいずれかで
	// API が落ちると catch {} に握り潰されてバッジが永遠に消えなかった。
	// 「ユーザーが通知を見た」事実はこの時点で確定しているので先に消す。
	localStorage.setItem('extNotifLastReadAt', new Date().toISOString());
	window.dispatchEvent(new CustomEvent('ext-tl-notif-count', { detail: 0 }));
	try {
		await callExternalApi('notifications/mark-all-as-read', {});
	} catch {}
}

function onExternalNotification(ev: Event) {
	// リアルタイム受信した通知を先頭に追加
	const n = (ev as CustomEvent).detail;
	if (!n?.id) return;
	if (notifications.value.find(x => x.id === n.id)) return;
	notifications.value.unshift(n);
}

const headerActions = computed(() => [{
	icon: 'ti ti-check',
	text: notificationCopy.markAllRead,
	handler: async () => {
		await markAllAsRead();
	},
}, {
	icon: 'ti ti-refresh',
	text: notificationCopy.refresh,
	handler: async () => {
		await fetchNotifications();
	},
}]);

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

// 旗鯖fork: アクション文言 (表示名と分離してMFM名の後ろに付ける)
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

// 旗鯖fork: <Mfm> に渡す author。
// MkMfm はカスタム絵文字(emojiCode)の解決時、author?.host が null だと
// emojiUrls を参照せず自インスタンス扱いになり、外部サーバー発の絵文字が
// ショートコードのまま残る。標準の MkUserName と同様に author(host付き)を
// 渡すことで emojiUrls 経由の url 解決を走らせ、絵文字を正しく描画する。
function authorOf(n: any): Misskey.entities.UserLite {
	const host = n?.user?.host ?? prefer.s['external.host'] ?? null;
	// 旗鯖fork(G9): Mfmのauthor propはUserLite全体を要求するが、ここではemojiUrl解決に
	//   使うhost/emojisしか要らない(挙動は既存のまま、型だけ橋渡し)。
	return { host, emojis: n?.user?.emojis } as Misskey.entities.UserLite;
}

// 旗鯖fork: リアクション文字列の正規化 (両端コロン等の処理は MkReactionIcon に任せる)
function normalizeReaction(reaction: string): string {
	return reaction;
}

// 旗鯖fork: リアクション絵文字のURL取得 (カスタム絵文字の場合)
function reactionEmojiUrl(n: any): string | undefined {
	if (!n?.reaction) return undefined;
	// :name@host: or :name: 形式のカスタム絵文字
	const m = n.reaction.match(/^:([^:]+):$/);
	if (!m) return undefined; // Unicode絵文字はURL不要
	const emojiName = m[1];
	const pureName = emojiName.includes('@') ? emojiName.split('@')[0] : emojiName;
	const host = prefer.s['external.host'];

	// 1. note付属の reactionEmojis から検索 (複数パターン)
	if (n.note?.reactionEmojis) {
		const e = n.note.reactionEmojis;
		const found = e[emojiName] || e[pureName] || e[`${pureName}@${host}`] || e[`${pureName}@.`];
		if (found) return found;
	}
	// 2. note付属の emojis からも検索
	if (n.note?.emojis) {
		if (Array.isArray(n.note.emojis)) {
			const f = n.note.emojis.find((e: any) => e.name === pureName || e.name === emojiName);
			if (f?.url) return f.url;
		} else {
			const f = n.note.emojis[pureName] || n.note.emojis[emojiName];
			if (f) return f;
		}
	}
	// 3. 外部サーバーの絵文字キャッシュから検索 (reactionEmojis に無い絵文字の本命)
	const cached = externalEmojiUrlMap.value[pureName] || externalEmojiUrlMap.value[emojiName];
	if (cached) return cached;
	// 4. フォールバック: 外部サーバーの絵文字プロキシURL
	if (host) return `https://${host}/emoji/${pureName}.webp`;
	return undefined;
}

function textOf(n: any): string {
	if (n?.note?.text) return n.note.text;
	if (n?.reaction) return n.reaction;
	if (n?.body) return n.body;
	return '';
}

// 旗鯖fork: フォロー許可リクエスト・セキュリティ系通知は連携先で対応が必要
function hintOf(n: any): string {
	if (n.type === 'receiveFollowRequest' || n.type === 'followRequestAccepted') {
		return notificationCopy.followRequestHint;
	}
	if (n.type === 'app') {
		return notificationCopy.appHint;
	}
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
	// クリック動作はノート関連の通知のみ意味があるが、現状は何もしない
	// (外部鯖のノート遷移は MkExternalNote パネル経由の方が筋がいいため、別途検討)
}

onMounted(async () => {
	// 未連携ならリダイレクト
	if (!checkConnected()) {
		router.replace('/settings/external-account');
		return;
	}
	// 旗鯖fork: 訪問時に既読化。fetch の完了/失敗を待たず、ページを開いた時点で
	// 即座にバッジを消す (fetch が遅い・失敗するケースでもバッジが残らないように)
	markAllAsRead();
	await fetchNotifications();
	// 旗鯖fork: 外部サーバーの絵文字URLマップを取得 (リアクション絵文字解決用)
	try { externalEmojiUrlMap.value = await getExternalEmojiUrlMap(); } catch { /* 失敗時はフォールバックURLで対応 */ }
	// リアルタイム受信を listen
	window.addEventListener('external-notification', onExternalNotification);
});

onUnmounted(() => {
	window.removeEventListener('external-notification', onExternalNotification);
});

definePage(() => ({
	title: notificationCopy.title,
	icon: 'ti ti-bell',
}));
</script>

<style lang="scss" module>
.root {
	max-width: 700px;
	margin: 0 auto;
	padding: 16px;
}
.loading {
	display: flex;
	justify-content: center;
	padding: 60px 0;
}
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 60px 16px;
	opacity: 0.7;
}
.emptyIcon {
	font-size: 3em;
	margin-bottom: 12px;
	opacity: 0.5;
}
.emptyText {
	font-size: 0.95em;
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
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}
/* 旗鯖fork: アバター画像 */
.itemAvatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	object-fit: cover;
}
/* 旗鯖fork: リアクション絵文字を右下にオーバーレイ */
.itemReactionBadge {
	position: absolute;
	right: -4px;
	bottom: -4px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	border: 1.5px solid var(--MI_THEME-panel);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	box-shadow: 0 1px 4px rgba(0,0,0,.15);
	overflow: hidden;
}
/* 旗鯖fork: 内部の絵文字(img/span)を強制的にバッジサイズに収める */
.itemReactionBadge :deep(img),
.itemReactionBadge :deep(.mk-emoji),
.itemReactionBadge :deep(span) {
	width: 14px !important;
	height: 14px !important;
	max-width: 14px !important;
	max-height: 14px !important;
	object-fit: contain;
	font-size: 12px !important;
	line-height: 1 !important;
	margin: 0 !important;
}
/* 旗鯖fork: アクション文言 (表示名の後ろ) */
.itemAction {
	font-weight: 400;
	opacity: 0.85;
}
.itemIcon {
	font-size: 1.1em;
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
	font-size: 0.92em;
}
.itemTime {
	font-size: 0.78em;
	opacity: 0.65;
	flex-shrink: 0;
}
.itemText {
	margin-top: 4px;
	font-size: 0.88em;
	opacity: 0.85;
	overflow-wrap: anywhere;
}
.itemHint {
	margin-top: 6px;
	font-size: 0.78em;
	color: var(--MI_THEME-warn, #e67e22);
	opacity: 0.95;
}
</style>
