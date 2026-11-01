<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition name="external-toast" :css="!embedded">
	<div v-if="show || embedded" :class="$style.root" :data-type="notificationType" :data-embedded="embedded" :role="embedded ? 'link' : undefined" :tabindex="embedded ? 0 : undefined" @keydown.enter.prevent="onClick" @click="onClick">
		<!-- Hataskey UIではリアクションを本文側へ分離する。 -->
		<div :class="$style.iconWrap">
			<MkAvatar v-if="embedded && notificationUser?.avatarUrl" :user="author" :class="$style.avatar"/>
			<img v-else-if="notificationUser?.avatarUrl" :src="notificationUser.avatarUrl" :class="$style.avatar" :alt="notificationUser.username ?? ''"/>
			<i v-else :class="[$style.icon, iconClass]"></i>
			<div v-if="!embedded && notificationType === 'reaction' && notification?.reaction" :class="$style.reactionBadge">
				<MkReactionIcon :reaction="notification.reaction" :emojiUrl="reactionEmojiUrl"/>
			</div>
		</div>
		<div :class="$style.body">
			<div v-if="embedded" :class="$style.source"><i class="ti ti-world" aria-hidden="true"></i> {{ i18n.ts._hata._notificationToast.external }}<wbr/><span v-if="sourceHost"> · {{ sourceHost }}</span></div>
			<div :class="$style.title">
				<Mfm :punctuationWrap="embedded" :text="displayName" :plain="true" :nyaize="false" :emojiUrls="emojiUrls" :author="author"/><wbr/><span :class="$style.action">{{ actionLabel }}</span>
			</div>
			<div v-if="embedded && notificationType === 'reaction' && notification?.reaction" :class="$style.reactionContent" data-reaction-content="true">
				<span :class="$style.toastReaction" data-reaction-chip>
					<MkReactionIcon :reaction="notification.reaction" :emojiUrl="reactionEmojiUrl"/>
				</span>
				<div v-if="notification?.note?.text" :class="$style.reactionNote">
					<Mfm :punctuationWrap="true" :text="text" :plain="true" :nowrap="false" :nyaize="false" :emojiUrls="noteEmojiUrls" :author="noteAuthor"/>
				</div>
			</div>
			<div v-else-if="text" :class="$style.text">
				<Mfm v-if="embedded && notification?.note?.text" :punctuationWrap="true" :text="text" :plain="true" :nowrap="false" :nyaize="false" :emojiUrls="noteEmojiUrls" :author="noteAuthor"/>
				<MkReactionIcon v-else-if="embedded && notification?.reaction" :reaction="notification.reaction" :emojiUrl="reactionEmojiUrl"/>
				<MkNotificationText v-else :text="text"/>
			</div>
			<div v-if="hint" :class="$style.hint"><MkNotificationText :text="hint" :wrap="embedded"/></div>
		</div>
		<button v-if="!embedded" :class="$style.close" :aria-label="i18n.ts.close" @click.stop="onClose"><i class="ti ti-x"></i></button>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { mainRouter } from '@/router.js';
import { prefer } from '@/preferences.js';
import { getExternalEmojiUrlMapForHost } from '@/utility/external-api.js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { i18n } from '@/i18n.js';
import MkNotificationText from '@/components/MkNotificationText.js';

const props = defineProps<{
	notification: any;
	embedded?: boolean;
	sourceHost?: string;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
}>();
const notificationCopy = i18n.ts._hata._externalNotifications;

const show = ref(false);
let autoCloseTimer: number | null = null;

const notificationType = computed(() => props.notification?.type ?? 'unknown');
const notificationUser = computed(() => props.notification?.user ?? props.notification?.note?.user);

const iconClass = computed(() => {
	const t = notificationType.value;
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
	return map[t] ?? 'ti ti-bell';
});

// 旗鯖fork: 表示名 (name優先) — MFM対応のため生テキスト
const displayName = computed(() => {
	return notificationUser.value?.name || notificationUser.value?.username || notificationCopy.someone;
});

// 旗鯖fork: アクション文言 (表示名の後ろに付く)
const actionLabel = computed(() => {
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
	return labels[notificationType.value] ?? notificationCopy.unknownToastAction;
});

// 旗鯖fork: <Mfm> に渡す author。host が null だと MkMfm が emojiUrls を
// 参照せず外部サーバーの絵文字を解決できないため、host(外部サーバー)を補う。
const author = computed(() => {
	const user = notificationUser.value;
	return { ...user, host: user?.host ?? props.sourceHost ?? prefer.s['external.host'] ?? null } as Misskey.entities.UserLite;
});

const noteAuthor = computed(() => {
	const user = props.notification?.note?.user ?? notificationUser.value;
	return { ...user, host: user?.host ?? props.sourceHost ?? prefer.s['external.host'] ?? null } as Misskey.entities.UserLite;
});

function emojiMap(host: string | null, ...sources: unknown[]): Record<string, string> | undefined {
	const map: Record<string, string> = { ...(host ? getExternalEmojiUrlMapForHost(host) : null) };
	for (const source of sources) {
		if (Array.isArray(source)) {
			for (const emoji of source) {
				if (typeof emoji?.name === 'string' && typeof emoji.url === 'string') map[emoji.name] = emoji.url;
			}
		} else if (source != null && typeof source === 'object') {
			for (const [name, url] of Object.entries(source)) {
				if (typeof url === 'string') map[name] = url;
			}
		}
	}
	return Object.keys(map).length > 0 ? map : undefined;
}

// 通知した人とノート作者が違う場合も、それぞれのホスト・絵文字URLで描画する。
const emojiUrls = computed(() => emojiMap(author.value.host, notificationUser.value?.emojis));
const noteEmojiUrls = computed(() => emojiMap(noteAuthor.value.host, props.notification?.note?.user?.emojis, props.notification?.note?.emojis));

// 旗鯖fork: リアクション絵文字URL (カスタム絵文字の場合)
const reactionEmojiUrl = computed(() => {
	const n = props.notification;
	if (!n?.reaction) return undefined;
	const m = n.reaction.match(/^:([^:]+):$/);
	if (!m) return undefined;
	const emojiName = m[1];
	const pureName = emojiName.includes('@') ? emojiName.split('@')[0] : emojiName;
	const host = (props.sourceHost ?? prefer.s['external.host']);
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
	// 外部サーバーの絵文字キャッシュ (同期版、ホスト指定)
	if (host) {
		const cacheMap = getExternalEmojiUrlMapForHost(host);
		if (cacheMap) {
			const cached = cacheMap[pureName] || cacheMap[emojiName];
			if (cached) return cached;
		}
		return `https://${host}/emoji/${pureName}.webp`;
	}
	return undefined;
});

const text = computed(() => {
	const n = props.notification;
	if (n?.note?.text) {
		const t = n.note.text;
		return props.embedded ? t : t.length > 60 ? t.slice(0, 60) + '…' : t;
	}
	if (n?.reaction) return n.reaction;
	return '';
});

// 旗鯖fork: フォロー許可リクエスト・セキュリティ系通知は連携先での対応が必要
const hint = computed(() => {
	const t = notificationType.value;
	if (t === 'receiveFollowRequest' || t === 'followRequestAccepted') {
		return notificationCopy.followRequestHint;
	}
	if (t === 'app') {
		// セキュリティ系のアプリ通知も含めて、連携先確認案内
		return notificationCopy.appHint;
	}
	return '';
});

function onClick() {
	// クリックで外部通知ページに遷移
	onClose();
	mainRouter.push('/my/external-notifications');
}

function onClose() {
	if (props.embedded) { emit('close'); return; }
	show.value = false;
	if (autoCloseTimer) {
		window.clearTimeout(autoCloseTimer);
		autoCloseTimer = null;
	}
	// 退場アニメーション後に親通知
	window.setTimeout(() => emit('close'), 300);
}

onMounted(() => {
	if (props.embedded) return;
	// 次のフレームで表示開始 (transition を効かせる)
	requestAnimationFrame(() => {
		show.value = true;
	});
	// 6秒後に自動で閉じる
	autoCloseTimer = window.setTimeout(() => onClose(), 6000);
});

onUnmounted(() => {
	if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 12px 14px;
	min-width: 260px;
	max-width: 340px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-left: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 70%, #4a9eff); /* 外部=青寄り */
	border-radius: 10px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
	cursor: pointer;
	transition: transform .15s, box-shadow .15s;
}
.root:hover {
	transform: translateY(-1px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.root[data-embedded='true'] {
	padding:0; min-width:0; max-width:none; width:100%; align-items:center; gap:9px;
	background:transparent; border:0; box-shadow:none; transform:none; font-size:12px; line-height:1.5;
	.iconWrap { margin:6px 8px 6px 4px; }
	.title, .text { font-size:12px; color:inherit; }
	.hint { font-size:10px; }
	.title { white-space:normal; word-break:keep-all; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
	.text, .hint { white-space:normal; word-break:keep-all; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
	&:focus-visible { outline:2px solid var(--MI_THEME-accent); outline-offset:2px; border-radius:4px; }
}
.source { color:var(--MI_THEME-accent); font-size:10px; line-height:1.5; word-break:keep-all; overflow-wrap:anywhere; }
.reactionContent { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; margin-top:5px; min-width:0; }
.toastReaction {
	display:inline-flex; align-items:center; justify-content:center; flex:0 1 auto;
	box-sizing:border-box; min-width:36px; max-width:min(108px,100%); min-height:32px; padding:4px 6px;
	border:1px solid color-mix(in srgb,var(--MI_THEME-accent) 22%,transparent); border-radius:8px;
	background:var(--MI_THEME-accentedBg); color:var(--MI_THEME-fg); font-size:22px; line-height:1;
	img { display:block; width:auto; height:24px; max-width:100%; object-fit:contain; }
}
.reactionNote {
	flex:1 1 120px; min-width:0; padding-left:8px; border-left:2px solid var(--MI_THEME-divider);
	font-size:12px; line-height:1.5; opacity:.85; white-space:normal; word-break:keep-all; overflow-wrap:anywhere;
	display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
}
.icon {
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	color: var(--MI_THEME-accent);
	font-size: 1.1em;
}
/* 旗鯖fork: アバター + リアクション絵文字オーバーレイ */
.iconWrap {
	flex-shrink: 0;
	position: relative;
	width: 32px;
	height: 32px;
}
.avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	object-fit: cover;
}
.reactionBadge {
	position: absolute;
	right: -3px;
	bottom: -3px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	border: 1.5px solid var(--MI_THEME-panel);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	box-shadow: 0 1px 3px rgba(0,0,0,.15);
	overflow: hidden;
}
.reactionBadge :deep(img),
.reactionBadge :deep(.mk-emoji),
.reactionBadge :deep(span) {
	width: 13px !important;
	height: 13px !important;
	max-width: 13px !important;
	max-height: 13px !important;
	object-fit: contain;
	font-size: 11px !important;
	line-height: 1 !important;
	margin: 0 !important;
}
.action {
	font-weight: 400;
	opacity: 0.85;
}
.body {
	flex: 1;
	min-width: 0;
}
.title {
	font-weight: 700;
	font-size: 0.9em;
	color: var(--MI_THEME-fg);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.text {
	margin-top: 2px;
	font-size: 0.82em;
	color: var(--MI_THEME-fg);
	opacity: 0.85;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.hint {
	margin-top: 4px;
	font-size: 0.75em;
	color: var(--MI_THEME-warn, #e67e22);
	opacity: 0.95;
	white-space: normal;
	line-height: 1.3;
}
.close {
	flex-shrink: 0;
	background: transparent;
	border: none;
	color: var(--MI_THEME-fg);
	opacity: 0.5;
	cursor: pointer;
	padding: 0;
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.close:hover {
	opacity: 1;
}

/* Transition: 右からスライドイン */
:global(.external-toast-enter-from) { transform: translateX(100%); opacity: 0; }
:global(.external-toast-enter-to) { transform: translateX(0); opacity: 1; }
:global(.external-toast-enter-active) { transition: transform .25s, opacity .25s; }
:global(.external-toast-leave-from) { transform: translateX(0); opacity: 1; }
:global(.external-toast-leave-to) { transform: translateX(100%); opacity: 0; }
:global(.external-toast-leave-active) { transition: transform .25s, opacity .25s; }
</style>
