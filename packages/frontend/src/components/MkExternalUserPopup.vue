<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :zPriority="'high'" @click="close()" @closed="emit('closed')">
	<div :class="$style.root" @click.stop>
		<div v-if="loading" :class="$style.loading">
			<MkLoading/>
		</div>
		<div v-else-if="errorMsg" :class="$style.error">
			<i class="ti ti-alert-triangle"></i>
			<span>{{ errorMsg }}</span>
		</div>
		<div v-else-if="user" :class="$style.content">
			<!-- バナー -->
			<div :class="$style.banner" :style="user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : {}">
				<button :class="$style.closeBtn" class="_button" @click="close()">
					<i class="ti ti-x"></i>
				</button>
			</div>

			<!-- アバター -->
			<div :class="$style.avatarArea">
				<img :class="$style.avatar" :src="user.avatarUrl" :alt="user.username"/>
			</div>

			<!-- 名前・ユーザー名 -->
			<div :class="$style.nameArea">
				<div :class="$style.name"><Mfm :text="user.name || user.username" :plain="true" :nyaize="false" :author="mfmAuthor" :emojiUrls="emojiUrls"/></div>
				<div :class="$style.username">@{{ user.username }}@{{ user.host || host }}</div>
			</div>

			<!-- 自己紹介 -->
			<div v-if="user.description" :class="$style.description">
				<Mfm :text="user.description" :author="mfmAuthor" :nyaize="false" :emojiUrls="emojiUrls"/>
			</div>
			<div v-else :class="$style.noDescription">{{ copy.noDescription }}</div>

			<!-- ステータス -->
			<div :class="$style.stats">
				<div :class="$style.statItem">
					<div :class="$style.statValue">{{ formatNumber(user.notesCount) }}</div>
					<div :class="$style.statLabel">{{ copy.notes }}</div>
				</div>
				<div :class="$style.statItem">
					<div :class="$style.statValue">{{ formatNumber(user.followingCount) }}</div>
					<div :class="$style.statLabel">{{ copy.following }}</div>
				</div>
				<div :class="$style.statItem">
					<div :class="$style.statValue">{{ formatNumber(user.followersCount) }}</div>
					<div :class="$style.statLabel">{{ copy.followers }}</div>
				</div>
			</div>

			<!-- アクションボタン -->
			<div :class="$style.actions">
				<button class="_button" :class="$style.actionBtn" @click="openExternal()">
					<i class="ti ti-external-link"></i>
					<span>{{ copy.openExternalProfile }}</span>
				</button>
			</div>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import { getExternalEmojiUrlMap } from '@/utility/external-api.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

const props = defineProps<{
	userId: string;
	host: string;
	token: string;
	/** 既にユーザー情報を持っている場合はAPIを叩かずそのまま使う */
	initialUser?: any;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');
const copy = i18n.ts._hata._externalTimeline._userPopup;
const numberFormatter = new Intl.NumberFormat(versatileLang, { notation: 'compact', maximumFractionDigits: 1 });
const user = ref<any>(null);
const loading = ref(true);
const errorMsg = ref<string | null>(null);
const externalEmojiMap = ref<Record<string, string>>({});

const mfmAuthor = computed(() => {
	if (!user.value) return undefined;
	return {
		...user.value,
		host: user.value.host || props.host,
	};
});

// ユーザー名やプロフィールに含まれるカスタム絵文字を解決
// - 接続先サーバーの絵文字マップ (externalEmojiMap) を基本に
// - user.emojis に含まれる絵文字を最優先でマージ
// - 連合先ユーザーの場合は user.host のURLをフォールバックに
const emojiUrls = computed(() => {
	const map: Record<string, string> = {};

	// 接続先サーバーの全絵文字キャッシュ
	Object.assign(map, externalEmojiMap.value);

	// user.emojis（連合先ユーザーの絵文字含む）
	if (user.value?.emojis) {
		if (Array.isArray(user.value.emojis)) {
			for (const emoji of user.value.emojis) {
				if (emoji.name && emoji.url) {
					map[emoji.name] = emoji.url;
				}
			}
		} else {
			Object.assign(map, user.value.emojis);
		}
	}

	// ユーザーの連合先ホスト
	const userHost = user.value?.host as string | null | undefined;

	// Proxy: マップに無い絵文字名でも直URLをフォールバック
	return new Proxy(map, {
		get(target, prop: string) {
			if (prop in target) return target[prop];
			// 連合先ユーザー: 連合先サーバーの絵文字URLをフォールバック
			if (userHost) {
				return `https://${userHost}/emoji/${prop}.webp`;
			}
			// 接続先サーバーの絵文字直URLをフォールバック
			return `https://${props.host}/emoji/${prop}.webp`;
		},
		has(target, prop: string) {
			return true;
		},
	});
});

function formatNumber(n: number | undefined | null): string {
	return numberFormatter.format(n ?? 0);
}

function close() {
	modal.value?.close();
}

function openExternal() {
	window.open(`https://${props.host}/@${user.value?.username}`, '_blank');
}

onMounted(async () => {
	// 絵文字マップの取得（キャッシュから即座に返る）
	try {
		externalEmojiMap.value = await getExternalEmojiUrlMap();
	} catch { /* ignore */ }

	// ユーザー情報取得
	if (props.initialUser && props.initialUser.notesCount != null) {
		// 詳細情報を既に持っている場合はそのまま使う
		user.value = props.initialUser;
		loading.value = false;
		return;
	}

	try {
		const res = await fetch(`https://${props.host}/api/users/show`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				i: props.token,
				userId: props.userId,
			}),
		});

		if (!res.ok) throw new Error(`API error: ${res.status}`);
		user.value = await res.json();
	} catch (err) {
		console.error('[MkExternalUserPopup] Failed to fetch user:', err);
		errorMsg.value = copy.loadFailed;
	} finally {
		loading.value = false;
	}
});
</script>

<style lang="scss" module>
.root {
	background: var(--MI_THEME-panel);
	border-radius: 16px;
	overflow: hidden;
	width: 350px;
	max-width: calc(100vw - 32px);
	max-height: calc(100vh - 64px);
	overflow-y: auto;
	margin: auto;
}

.loading {
	padding: 40px;
	text-align: center;
}

.error {
	padding: 32px;
	text-align: center;
	color: var(--MI_THEME-warn);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.content {
	display: flex;
	flex-direction: column;
}

// ===== バナー =====
.banner {
	height: 100px;
	background-color: color-mix(in srgb, var(--MI_THEME-accent) 30%, var(--MI_THEME-bg));
	background-size: cover;
	background-position: center;
	position: relative;
}

.closeBtn {
	position: absolute;
	top: 8px;
	right: 8px;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.5);
	color: #fff;
	border-radius: 50%;
	font-size: 0.9em;
	transition: background 0.2s;

	&:hover {
		background: rgba(0, 0, 0, 0.7);
	}
}

// ===== アバター =====
.avatarArea {
	display: flex;
	justify-content: center;
	margin-top: -36px;
	position: relative;
	z-index: 2;
}

.avatar {
	width: 72px;
	height: 72px;
	border-radius: 50%;
	object-fit: cover;
	border: 4px solid var(--MI_THEME-panel);
	background: var(--MI_THEME-panel);
}

// ===== 名前 =====
.nameArea {
	text-align: center;
	padding: 8px 20px 0;
}

.name {
	font-weight: bold;
	font-size: 1.1em;
	word-break: break-all;
}

.username {
	font-size: 0.85em;
	opacity: 0.7;
	margin-top: 2px;
}

// ===== 自己紹介 =====
.description {
	padding: 12px 20px;
	font-size: 0.85em;
	line-height: 1.6;
	border-top: 1px solid var(--MI_THEME-divider);
	border-bottom: 1px solid var(--MI_THEME-divider);
	margin-top: 12px;
	max-height: 180px;
	overflow-y: auto;
	word-wrap: break-word;
	overflow-wrap: break-word;

	/* スクロールバー見た目調整 */
	&::-webkit-scrollbar {
		width: 4px;
	}
	&::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--MI_THEME-fg) 20%, transparent);
		border-radius: 2px;
	}
}

.noDescription {
	padding: 12px 20px;
	font-size: 0.85em;
	opacity: 0.5;
	text-align: center;
	border-top: 1px solid var(--MI_THEME-divider);
	border-bottom: 1px solid var(--MI_THEME-divider);
	margin-top: 12px;
}

// ===== ステータス =====
.stats {
	display: flex;
	padding: 14px 20px;
}

.statItem {
	flex: 1;
	text-align: center;
}

.statValue {
	font-weight: bold;
	font-size: 1.05em;
}

.statLabel {
	font-size: 0.75em;
	opacity: 0.7;
	margin-top: 2px;
}

// ===== アクションボタン =====
.actions {
	padding: 0 16px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.actionBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 10px 16px;
	border-radius: 8px;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	transition: background 0.2s;
	width: 100%;

	&:hover {
		background: var(--MI_THEME-buttonHoverBg);
	}
}
</style>
