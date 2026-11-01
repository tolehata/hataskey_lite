<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<article
	:class="$style.root"
	:data-external-note-ui="visualMode !== 'legacy' ? 'hataskey' : undefined"
	:data-external-note-mode="visualMode !== 'legacy' ? visualMode : undefined"
	:data-external-note-glass="visualMode !== 'legacy' && glassBg ? 'on' : undefined"
	:data-external-note-embedded="embedded ? 'on' : undefined"
	:data-external-note-pure-renote="isPureRenote ? 'on' : undefined"
>
	<Hk3VisibilityRail v-if="ui === 'hataskey3' && !embedded" :visibility="appearNote.visibility"/>
	<div v-if="isPureRenote" :class="$style.renoteAttribution">
		<i class="ti ti-repeat"></i>
		<span :class="$style.renoteAttributionName">{{ note.user?.name || note.user?.username }}</span>
		<span>{{ copy.renote }}</span>
		<span v-if="renoteChannelInfo" :class="$style.renoteChannel" :title="renoteChannelInfo.name">
			<i class="ti ti-device-tv" aria-hidden="true"></i>
			<span :class="$style.channelName">{{ renoteChannelInfo.name }}</span>
		</span>
		<MkTime :time="note.createdAt"/>
	</div>
	<div :class="$style.bubbleBody">
		<button v-if="appearNote.user" :class="$style.avatar" class="_button" @click="openUserPopup">
			<img :class="$style.avatarImg" :src="appearNote.user.avatarUrl" :alt="appearNote.user.username"/>
		</button>
		<div :class="$style.main">
			<div>
				<div :class="$style.header">
					<div :class="$style.headerBody">
						<div :class="$style.headerTop">
							<button :class="$style.name" class="_button" @click="openUserPopup">
								<Mfm :text="appearNote.user?.name || appearNote.user?.username" :plain="true" :nyaize="false" :author="mfmAuthor" :emojiUrls="mergedEmojiUrls"/>
							</button>
							<span :class="$style.username">
								@{{ appearNote.user?.username }}@{{ appearNote.user?.host || host }}
							</span>
							<MkA v-if="safeNoteUrl" :to="safeNoteUrl" target="_blank" :class="$style.time">
								<MkTime :time="appearNote.createdAt"/>
							</MkA>
							<span v-else :class="$style.time">
								<MkTime :time="appearNote.createdAt"/>
							</span>
							<span v-if="visibilityInfo" :class="$style.visibilityBadge" :title="visibilityInfo.label">
								<i :class="visibilityInfo.icon"></i>
							</span>
							<span v-if="localOnlyBadge" :class="$style.visibilityBadge" :title="localOnlyBadge.label">
								<i :class="localOnlyBadge.icon"></i>
							</span>
						</div>
					</div>
				</div>

				<div v-if="appearNote.replyId && appearNote.reply?.user" :class="$style.replyContext">
					<i class="ti ti-arrow-back-up"></i>
					<span>{{ replyToText }}</span>
				</div>

				<div v-if="appearNote.cw != null" :class="$style.cw">
					<span>{{ appearNote.cw }}</span>
					<button :class="$style.cwButton" @click="showContent = !showContent">
						{{ showContent ? copy.hideContent : copy.showContent }}
					</button>
				</div>

				<div v-show="appearNote.cw == null || showContent" :class="$style.content">
					<div v-if="appearNote.text" :class="$style.text">
						<Mfm
							:key="`mfm-${emojiMapReady}`"
							:text="appearNote.text"
							:author="mfmAuthor"
							:nyaize="false"
							:emojiUrls="mergedEmojiUrls"
						/>
					</div>

					<!-- ファイル表示（Misskeyメディアプレーヤー使用） -->
					<MkMediaList v-if="appearNote.files && appearNote.files.length > 0" :mediaList="normalizedFiles"/>

					<div v-if="quotedNote && (visualMode === 'legacy' || !embedded)" :class="$style.renote">
						<div :class="$style.renoteHeader">
							<i class="ti ti-repeat"></i> {{ copy.renote }}
						</div>
						<MkExternalNote :note="quotedNote" :host="host" :token="token" :visualMode="visualMode" :glassBg="glassBg" :embedded="visualMode !== 'legacy'" :class="$style.renoteNote"/>
					</div>
				</div>
				<div v-if="channelInfo" :class="$style.channel" :title="channelInfo.name">
					<i class="ti ti-device-tv" aria-hidden="true"></i>
					<span :class="$style.channelName">{{ channelInfo.name }}</span>
				</div>

				<!-- リアクション表示 -->
				<div v-if="!embedded && canInteract && reactionsEntries.length > 0" :class="$style.reactions">
					<button
						v-for="[reaction, count] in reactionsEntries"
						:key="reaction"
						:class="[$style.reaction, { [$style.myReaction]: myReaction === reaction }]"
						@click="toggleReaction(reaction)"
						@mouseenter="onReactionMouseEnter($event, reaction, count)"
						@mouseleave="onReactionMouseLeave()"
						@touchstart.passive="onReactionTouchStart($event, reaction, count)"
						@touchend.passive="onReactionTouchEnd()"
						@touchcancel.passive="onReactionTouchEnd()"
						@contextmenu.prevent
					>
						<MkReactionIcon :key="`${reaction}:${getEmojiUrl(reaction) ?? ''}`" :reaction="reaction" :emojiUrl="getEmojiUrl(reaction)" :fallbackToImage="false" style="pointer-events: none;"/>
						<span :class="$style.reactionCount">{{ formatCount(count) }}</span>
					</button>
					<button ref="reactionAddBtnEl" :class="$style.reactionAdd" @click="openReactionPicker">
						<i class="ti ti-plus"></i>
					</button>
				</div>
				<!-- リアクションユーザーツールチップ (独自実装: 外部絵文字対応) -->
				<Teleport to="body">
					<div v-if="reactionTipVisible" class="ext-reaction-tip" data-ext-tl="reaction-tip" :style="reactionTipStyle" @click="hideReactionTip" @touchstart.passive="hideReactionTip">
						<div class="ext-reaction-tip-emoji">
							<img v-if="reactionTipEmojiUrl && !reactionTipEmojiErrored" :src="reactionTipEmojiUrl" class="ext-reaction-tip-emoji-img" alt="" @error="reactionTipEmojiErrored = true"/>
							<span v-else class="ext-reaction-tip-emoji-text">{{ reactionTipReaction }}</span>
							<div v-if="reactionTipShortcode" class="ext-reaction-tip-shortcode">{{ reactionTipShortcode }}</div>
						</div>
						<div class="ext-reaction-tip-users">
							<div v-if="reactionTipUsers.length === 0" class="ext-reaction-tip-loading">{{ copy.loading }}</div>
							<div v-for="u in reactionTipUsers" :key="u.id" class="ext-reaction-tip-user">
								<img :src="u.avatarUrl" class="ext-reaction-tip-avatar"/>
								<span class="ext-reaction-tip-name">
									<Mfm :text="u.name || u.username" :plain="true" :nowrap="true" :nyaize="false" :emojiUrls="u.emojis" :author="u"/>
								</span>
							</div>
							<div v-if="reactionTipCount > 10" class="ext-reaction-tip-more">+{{ formatCount(reactionTipCount - 10) }}</div>
						</div>
					</div>
				</Teleport>

				<div v-if="!embedded && canInteract" :class="$style.footer">
					<button :class="$style.footerButton" :title="i18n.ts.reply" @click="reply">
						<i class="ti ti-arrow-back-up"></i>
						<span v-if="appearNote.repliesCount > 0" :class="$style.footerCount">{{ formatCount(appearNote.repliesCount) }}</span>
					</button>
					<button :class="$style.footerButton" :title="i18n.ts.renote" @click="showRenoteMenu">
						<i class="ti ti-repeat"></i>
						<span v-if="appearNote.renoteCount > 0" :class="$style.footerCount">{{ formatCount(appearNote.renoteCount) }}</span>
					</button>
					<button ref="reactionBtnEl" :class="[$style.footerButton, { [$style.reacted]: myReaction }]" :title="i18n.ts.reaction" @click="openReactionPicker">
						<i class="ti ti-mood-plus"></i>
						<span v-if="totalReactionCount > 0" :class="$style.footerCount">
							{{ formatCount(totalReactionCount) }}
						</span>
					</button>
					<button :class="$style.footerButton" :title="copy.menu" @click="showNoteMenu">
						<i class="ti ti-dots"></i>
					</button>
				</div>
			</div>
		</div>
	</div>
</article>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent, reactive, onMounted, useTemplateRef, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { getExternalEmojiUrlMap, getExternalAccount, addExternalRecentReaction, lookupExternalEmojiUrl } from '@/utility/external-api.js';
import { resolveExternalNotePresentation } from '@/utility/external-note-presentation.js';
import Hk3VisibilityRail from '@/components/hataskey3/Hk3VisibilityRail.vue';
import { ui } from '@@/js/config.js';

const MkExternalReactionPicker = defineAsyncComponent(() => import('@/components/MkExternalReactionPicker.vue'));
const MkExternalUserPopup = defineAsyncComponent(() => import('@/components/MkExternalUserPopup.vue'));

type ExternalTimelineVisualMode = 'legacy' | 'hataskey-normal' | 'hataskey-deck';

const props = withDefaults(defineProps<{
	note: any;
	host: string;
	token: string;
	visualMode?: ExternalTimelineVisualMode;
	glassBg?: boolean;
	embedded?: boolean;
}>(), {
	visualMode: 'legacy',
	glassBg: false,
	embedded: false,
});

const emit = defineEmits<{
	(ev: 'reactionChanged', noteId: string, reaction: string | null, oldReaction: string | null, emojiUrl?: string): void;
	(ev: 'noteDeleted', noteId: string): void;
}>();

const showContent = ref(false);
const copy = i18n.ts._hata._externalTimeline._note;
const copyx = i18n.tsx._hata._externalTimeline._note;
const numberFormatter = new Intl.NumberFormat(versatileLang);
const formatCount = (value: number): string => numberFormatter.format(value);
const notePresentation = computed(() => props.visualMode === 'legacy'
	? {
		isPureRenote: false,
		appearNote: props.note,
		quotedNote: props.note?.renote ?? null,
		resolution: 'resolved' as const,
		path: [props.note],
	}
	: resolveExternalNotePresentation(props.note));
const isPureRenote = computed(() => notePresentation.value.isPureRenote);
const appearNote = computed<any>(() => notePresentation.value.appearNote);
const quotedNote = computed<any | null>(() => notePresentation.value.quotedNote);
const canInteract = computed(() => notePresentation.value.resolution === 'resolved');
const myReaction = ref<string | null>(appearNote.value.myReaction || null);
const reactionBtnEl = useTemplateRef('reactionBtnEl');
const reactionAddBtnEl = useTemplateRef('reactionAddBtnEl');

// SECURITY: 外部サーバー由来の note.id / host を URL に組み立てる際は厳格に検証。
// note.id が想定外の文字 (改行、引用符、 javascript: スキームの種となる文字等) を
// 含む場合はリンクを生成しない。
function isSafeExternalHost(h: unknown): h is string {
	if (typeof h !== 'string' || h.length === 0 || h.length > 253) return false;
	if (!/^[a-z0-9.\-]+(?::[1-9][0-9]{0,4})?$/i.test(h)) return false;
	return true;
}

const safeHost = computed<string | null>(() => {
	return isSafeExternalHost(props.host) ? props.host : null;
});

function normalizeExternalEmojiHost(host: string | null | undefined): string | null {
	const normalized = host == null || host === '.' ? safeHost.value : host;
	return isSafeExternalHost(normalized) ? normalized : null;
}

const safeNoteId = computed<string | null>(() => {
	const id = appearNote.value?.id;
	if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null;
	// Misskey/CherryPick の note id は基本的に [a-z0-9] のみ
	if (!/^[A-Za-z0-9]+$/.test(id)) return null;
	return id;
});
const safeNoteUrl = computed<string | null>(() => {
	if (!safeHost.value || !safeNoteId.value) return null;
	return `https://${safeHost.value}/notes/${safeNoteId.value}`;
});

type ExternalChannelInfo = { name: string };

function getExternalChannelInfo(target: any): ExternalChannelInfo | null {
	if (!target?.channel && !target?.channelId) return null;
	const name = typeof target.channel?.name === 'string' && target.channel.name.trim().length > 0
		? target.channel.name
		: i18n.ts.channel;
	return { name };
}

const channelInfo = computed(() => getExternalChannelInfo(appearNote.value));
const renoteChannelInfo = computed(() => isPureRenote.value ? getExternalChannelInfo(props.note) : null);

// 自分のノートかどうか判定
const isMine = computed(() => {
	const ext = getExternalAccount();
	return ext != null && props.note.userId === ext.userId;
});

// リアクションをリアクティブに管理（元のnote.reactionsをコピー）
const reactions = reactive<Record<string, number>>(
	{ ...(appearNote.value.reactions || {}) },
);

const reactionEmojiUrls = reactive<Record<string, string>>({});

function syncReactionEmojiUrls(next: Record<string, string> | null | undefined) {
	if (!next) return;
	for (const [key, url] of Object.entries(next)) {
		if (typeof url !== 'string' || url.length === 0) continue;
		const pureKey = key.split('@')[0];
		reactionEmojiUrls[key] = url;
		reactionEmojiUrls[`:${key}:`] = url;
		reactionEmojiUrls[pureKey] = url;
		reactionEmojiUrls[`:${pureKey}:`] = url;
	}
}

// 親タイムラインが外部サーバーの noteUpdated を受け取った場合も、
// コンポーネント内の操作用状態へ同期する。
watch(() => appearNote.value.reactions, (next) => {
	for (const key of Object.keys(reactions)) delete reactions[key];
	Object.assign(reactions, next ?? {});
}, { deep: true });
watch(() => appearNote.value.myReaction, (next) => { myReaction.value = next ?? null; });
watch(() => appearNote.value.reactionEmojis, syncReactionEmojiUrls, { deep: true, immediate: true });

// ===== 外部サーバーの絵文字URLマップ（非同期で取得） =====
const externalEmojiUrlMap = ref<Record<string, string>>({});
// 絵文字キャッシュの読み込み完了フラグ（初回レンダリング問題対策）
const emojiMapReady = ref(false);

onMounted(async () => {
	try {
		externalEmojiUrlMap.value = await getExternalEmojiUrlMap();
	} catch (err) {
		console.error('[MkExternalNote] Failed to load external emoji map:', err);
	} finally {
		emojiMapReady.value = true;
	}
});

// ===== MFM用 author（外部ホストを設定） =====
// 外部サーバーから取得したノートでは note.user.host = null だが、
// MkMfmが自サーバーの絵文字DBを参照してしまうのを防ぐため、
// host を明示的に設定する
// ===== 投稿種別（visibility）バッジ =====
const visibilityInfo = computed(() => {
	const v = appearNote.value.visibility;
	if (!v || v === 'public') return null; // public は表示不要
	const map: Record<string, { icon: string; label: string }> = {
		home: { icon: 'ti ti-home', label: copy.visibilityHome },
		followers: { icon: 'ti ti-lock', label: copy.visibilityFollowers },
		specified: { icon: 'ti ti-mail', label: copy.visibilitySpecified },
	};
	const info = map[v];
	if (!info) return null;
	// localOnly の場合はアイコンを追加表示
	if (appearNote.value.localOnly) {
		return { icon: info.icon, label: copyx.visibilityLocalOnly({ visibility: info.label }) };
	}
	return info;
});

// localOnly のみ（public + localOnly）の場合も表示
const localOnlyBadge = computed(() => {
	if (appearNote.value.localOnly && (!appearNote.value.visibility || appearNote.value.visibility === 'public')) {
		return { icon: 'ti ti-rocket-off', label: copy.localOnly };
	}
	return null;
});

const mfmAuthor = computed(() => ({
	...appearNote.value.user,
	host: appearNote.value.user?.host || props.host,
}));

const replyToText = computed(() => {
	const user = appearNote.value.reply?.user;
	if (!user) return '';
	const account = `@${user.username}@${user.host || props.host}`;
	return i18n.tsx.replyTo({ user: account });
});

// ===== 絵文字URL マッピング =====
// Proxy を使用: マップに無い絵文字でも外部サーバーの直URLをフォールバック返却。
// これにより MkCustomEmoji が自サーバーの /emoji/ パスや /proxy/ 経由を使わず、
// 外部サーバーから直接絵文字を取得する。
const mergedEmojiUrls = computed(() => {
	const map: Record<string, string> = {};

	// 外部サーバーの全絵文字キャッシュ
	Object.assign(map, externalEmojiUrlMap.value);

	// note付属 emojis
	if (appearNote.value.emojis) {
		if (Array.isArray(appearNote.value.emojis)) {
			for (const emoji of appearNote.value.emojis) {
				if (emoji.name && emoji.url) {
					map[emoji.name] = emoji.url;
				}
			}
		} else {
			Object.assign(map, appearNote.value.emojis);
		}
	}

	// note.user の絵文字（ユーザー名やプロフィールのカスタム絵文字）
	// 連合先ユーザーの場合は特に重要
	if (appearNote.value.user?.emojis) {
		if (Array.isArray(appearNote.value.user.emojis)) {
			for (const emoji of appearNote.value.user.emojis) {
				if (emoji.name && emoji.url) {
					map[emoji.name] = emoji.url;
				}
			}
		} else {
			Object.assign(map, appearNote.value.user.emojis);
		}
	}

	// reactionEmojis
	if (appearNote.value.reactionEmojis) {
		Object.assign(map, appearNote.value.reactionEmojis);
	}
	Object.assign(map, reactionEmojiUrls);

	// ユーザーの連合先ホスト（存在すればそちらを優先）
	const userHost = appearNote.value.user?.host as string | null | undefined;

	// Proxy: マップに無い絵文字名でも外部サーバーの直URLを返す
	return new Proxy(map, {
		get(target, prop: string) {
			if (prop in target) return target[prop];
			// 連合先ユーザー: その連合先サーバーの絵文字URLをフォールバック
			if (userHost) {
				return `https://${userHost}/emoji/${prop}.webp`;
			}
			// 外部サーバーの絵文字直URL（/emoji/{name}.webp）をフォールバック
			return `https://${props.host}/emoji/${prop}.webp`;
		},
		has(target, prop: string) {
			// emojiUrls[name] の存在チェック（in演算子）で常にtrueを返す
			return true;
		},
	});
});

// ===== リアクション一覧（ソート済み） =====
const reactionsEntries = computed(() => {
	return Object.entries(reactions)
		.filter(([, count]) => count > 0)
		.sort((a, b) => b[1] - a[1]);
});

// ===== リアクション合計 =====
const totalReactionCount = computed(() => {
	return Object.values(reactions).reduce((a, b) => a + b, 0);
});

// ===== 外部ファイルをMkMediaList用に正規化 =====
const normalizedFiles = computed(() => {
	if (!appearNote.value.files || !Array.isArray(appearNote.value.files)) return [];
	return appearNote.value.files.map((file: any) => ({
		id: file.id ?? file.url,
		createdAt: file.createdAt ?? appearNote.value.createdAt,
		name: file.name ?? 'unknown',
		type: file.type ?? 'application/octet-stream',
		size: file.size ?? 0,
		md5: file.md5 ?? '',
		url: file.url,
		thumbnailUrl: file.thumbnailUrl ?? null,
		blurhash: file.blurhash ?? null,
		comment: file.comment ?? null,
		isSensitive: file.isSensitive ?? false,
		properties: file.properties ?? {},
		userId: file.userId ?? null,
		folderId: file.folderId ?? null,
	}));
});

// ===== 外部API呼び出し =====
async function callExternalApi(endpoint: string, params: Record<string, any> = {}) {
	const res = await window.fetch(`https://${props.host}/api/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ i: props.token, ...params }),
	});
	if (!res.ok) throw new Error(`External API error: ${res.status}`);
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}

// ===== リプライ =====
async function reply() {
	const target = appearNote.value;
	os.post({
		externalReply: {
			id: target.id,
			text: target.text,
			cw: target.cw,
			user: {
				id: target.user.id,
				username: target.user.username,
				host: target.user.host ?? props.host,
				name: target.user.name,
				avatarUrl: target.user.avatarUrl,
			},
			createdAt: target.createdAt,
		},
		initialUseExternalAccount: true,
	});
}

// ===== リノート =====
async function renote() {
	const { canceled } = await os.confirm({
		type: 'question',
		text: copy.confirmRenote,
	});
	if (canceled) return;

	try {
		await callExternalApi('notes/create', { renoteId: appearNote.value.id });
		os.success();
	} catch (err) {
		console.error('Renote error:', err);
		os.alert({ type: 'error', text: copy.renoteFailed });
	}
}

async function quote() {
	const target = appearNote.value;
	os.post({
		externalRenote: {
			id: target.id,
			text: target.text,
			cw: target.cw,
			user: {
				id: target.user.id,
				username: target.user.username,
				host: target.user.host ?? props.host,
				name: target.user.name,
				avatarUrl: target.user.avatarUrl,
			},
			createdAt: target.createdAt,
		},
		initialUseExternalAccount: true,
	});
}

function showRenoteMenu(ev: MouseEvent) {
	os.popupMenu([
		{ text: copy.renote, icon: 'ti ti-repeat', action: renote },
		{ text: copy.quote, icon: 'ti ti-quote', action: quote },
	], ev.currentTarget ?? ev.target);
}

// ===== リアクション =====
/**
 * 外部TL専用リアクションピッカーを開く（ボタンをアンカーとしてポップアップ表示）
 */
function openReactionPicker(ev?: MouseEvent) {
	// クリックされたボタン要素をアンカーに使用
	const anchorEl = (ev?.currentTarget as HTMLElement | null) ?? reactionAddBtnEl.value ?? reactionBtnEl.value;

	const { dispose } = os.popup(MkExternalReactionPicker, {
		anchorElement: anchorEl,
	}, {
		done: async (reaction: string, emojiUrl?: string) => {
			if (!reaction) return;
			await applyReaction(reaction, emojiUrl);
		},
		closed: () => dispose(),
	});
}

/**
 * リアクションを適用（既存リアクションがあれば先に削除）
 */
let reactionProcessing = false;

async function applyReaction(reaction: string, emojiUrl?: string) {
	if (reactionProcessing) return;
	reactionProcessing = true;
	try {
		// 既にリアクション済みなら先に削除
		if (myReaction.value) {
			await callExternalApi('notes/reactions/delete', { noteId: appearNote.value.id });
			// ローカルカウント更新
			if (reactions[myReaction.value] != null) {
				reactions[myReaction.value]--;
				if (reactions[myReaction.value] <= 0) {
					delete reactions[myReaction.value];
				}
			}
		}

		await callExternalApi('notes/reactions/create', {
			noteId: appearNote.value.id,
			reaction: reaction,
		});

		// ローカルカウント更新
		const oldReaction = myReaction.value;
		myReaction.value = reaction;
		reactions[reaction] = (reactions[reaction] || 0) + 1;
		if (emojiUrl) reactionEmojiUrls[reaction] = emojiUrl;

		emit('reactionChanged', appearNote.value.id, reaction, oldReaction, emojiUrl);

		// 履歴に保存(host/url 付き):
		//   - :name@host: 形式 → host 抽出、URL は既知マップから引く
		//   - :name: 形式 → 外部TLの現サーバーhost + 現サーバーの絵文字マップから引く
		//   - Unicode → host=null, url=null(従来挙動と同じ)
		const m = reaction.match(/^:([^:]+?)(?:@([^:]+))?:$/);
		if (m) {
			const name = m[1];
			const explicitHost = m[2] ?? null;
			const targetHost = normalizeExternalEmojiHost(explicitHost);
			const url = emojiUrl ?? (targetHost ? lookupExternalEmojiUrl(targetHost, name) : null);
			addExternalRecentReaction(reaction, targetHost, url);
		} else {
			addExternalRecentReaction(reaction);
		}
	} catch (err) {
		console.error('Reaction error:', err);
		os.alert({ type: 'error', text: copy.reactionFailed });
	} finally {
		reactionProcessing = false;
	}
}

/**
 * 既存リアクションのトグル
 */
async function toggleReaction(reaction: string) {
	if (reactionProcessing) return;
	if (myReaction.value === reaction) {
		// 自分のリアクションを取り消し（確認ダイアログ）
		const { canceled } = await os.confirm({
			type: 'warning',
			text: copy.confirmRemoveReaction,
		});
		if (canceled) return;
		reactionProcessing = true;
		try {
			await callExternalApi('notes/reactions/delete', { noteId: appearNote.value.id });
			if (reactions[reaction] != null) {
				reactions[reaction]--;
				if (reactions[reaction] <= 0) {
					delete reactions[reaction];
				}
			}
			const old = myReaction.value;
			myReaction.value = null;
			emit('reactionChanged', appearNote.value.id, null, old);
		} catch (err) {
			console.error('Unreaction error:', err);
		} finally {
			reactionProcessing = false;
		}
	} else {
		// 別のリアクションに変更
		await applyReaction(reaction);
	}
}

// ===== リアクションしたユーザーのツールチップ表示 (独自実装) =====
let reactionTooltipTimer: number | null = null;
const reactionTipVisible = ref(false);
const reactionTipStyle = ref<Record<string, string>>({});
const reactionTipReaction = ref('');
const reactionTipEmojiUrl = ref<string | undefined>(undefined);
const reactionTipEmojiErrored = ref(false);
const reactionTipUsers = ref<Misskey.entities.UserLite[]>([]);
const reactionTipCount = ref(0);
const reactionTipShortcode = ref('');
let reactionTipHideTimer: number | null = null;

function onReactionMouseEnter(ev: MouseEvent, reaction: string, count: number) {
	if (reactionTooltipTimer) window.clearTimeout(reactionTooltipTimer);
	const el = ev.currentTarget as HTMLElement;
	reactionTooltipTimer = window.setTimeout(() => {
		showReactionUsers(el, reaction, count);
	}, 300);
}

function onReactionMouseLeave() {
	if (reactionTooltipTimer) {
		window.clearTimeout(reactionTooltipTimer);
		reactionTooltipTimer = null;
	}
	// 旗鯖fork: 旧実装ではタッチ操作の3秒残留タイマー(reactionTipHideTimer)を考慮した
	// ガードがあったが、その残留タイマーを廃止したため、ここは常にツールチップを消す。
	hideReactionTip();
}

function onReactionTouchStart(ev: TouchEvent, reaction: string, count: number) {
	if (reactionTooltipTimer) window.clearTimeout(reactionTooltipTimer);
	const el = ev.currentTarget as HTMLElement;
	reactionTooltipTimer = window.setTimeout(() => {
		showReactionUsers(el, reaction, count);
	}, 400);
}

function onReactionTouchEnd() {
	if (reactionTooltipTimer) {
		window.clearTimeout(reactionTooltipTimer);
		reactionTooltipTimer = null;
	}
	// 旗鯖fork: 指を離したらツールチップを即座に消す
	// (旧仕様では3秒間残していたが、ユーザーから「指を離しても画面に残留する」と
	//  報告があったため、PC のマウスリーブと同じく即座に消すように変更)
	if (reactionTipVisible.value) {
		hideReactionTip();
	}
}

function hideReactionTip() {
	reactionTipVisible.value = false;
	reactionTipUsers.value = [];
	reactionTipShortcode.value = '';
	reactionTipEmojiErrored.value = false;
	if (reactionTipHideTimer) { window.clearTimeout(reactionTipHideTimer); reactionTipHideTimer = null; }
}

async function showReactionUsers(anchorEl: HTMLElement, reaction: string, count: number) {
	try {
		// ツールチップの位置をアンカー要素の上に配置
		const rect = anchorEl.getBoundingClientRect();
		reactionTipStyle.value = {
			position: 'fixed',
			left: Math.max(8, Math.min(rect.left + rect.width / 2 - 170, window.innerWidth - 348)) + 'px',
			top: Math.max(8, rect.top - 8) + 'px',
			transform: 'translateY(-100%)',
			zIndex: '1000000',
		};
		reactionTipReaction.value = reaction;
		reactionTipEmojiUrl.value = getEmojiUrl(reaction);
		reactionTipEmojiErrored.value = false;
		reactionTipCount.value = count;
		reactionTipShortcode.value = reaction.startsWith(':') ? reaction : '';
		reactionTipVisible.value = true;
		reactionTipUsers.value = []; // ロード中

		const res = await callExternalApi('notes/reactions', {
			noteId: appearNote.value.id,
			type: reaction,
			limit: 10,
		});
		if (!reactionTipVisible.value) return; // 既に閉じてたら中断
		const users = (Array.isArray(res) ? res : [])
			.map((x: { user?: Misskey.entities.UserLite }) => x.user)
			.filter((user): user is Misskey.entities.UserLite => user != null)
			.map(user => ({
				...user,
				host: user.host ?? props.host,
				emojis: user.emojis ?? {},
			}));
		if (users.length < 1) {
			hideReactionTip();
			return;
		}
		reactionTipUsers.value = users;
	} catch (err) {
		console.warn('[MkExternalNote] Failed to fetch reaction users:', err);
		hideReactionTip();
	}
}

// ===== 絵文字URL取得（リアクション表示用） =====
function getEmojiUrl(reaction: string): string | undefined {
	const match = reaction.match(/^:([^:]+?)(?:@([^:]+))?:$/);
	if (!match) return undefined;

	const pureName = match[1];
	const explicitHost = match[2] ?? null;
	const targetHost = normalizeExternalEmojiHost(explicitHost);
	const emojiName = explicitHost ? `${pureName}@${explicitHost}` : pureName;
	const immediate = reactionEmojiUrls[reaction]
		|| reactionEmojiUrls[emojiName]
		|| reactionEmojiUrls[pureName];
	if (immediate) return immediate;

	// 1. note付属の reactionEmojis から検索（複数パターン）
	const emojis = appearNote.value.reactionEmojis;
	if (emojis) {
		const found = emojis[emojiName]
			|| emojis[pureName]
			|| emojis[`${pureName}@${props.host}`]
			|| emojis[`${pureName}@.`]
			|| emojis[reaction];
		if (found) return found;
	}

	// 2. note付属の emojis からも検索
	if (appearNote.value.emojis) {
		if (Array.isArray(appearNote.value.emojis)) {
			const found = appearNote.value.emojis.find((e: any) => e.name === pureName || e.name === emojiName);
			if (found?.url) return found.url;
		} else {
			const found = appearNote.value.emojis[pureName] || appearNote.value.emojis[emojiName];
			if (found) return found;
		}
	}

	// 3. 外部サーバーの絵文字キャッシュから検索
	const cached = explicitHost == null || explicitHost === '.'
		? externalEmojiUrlMap.value[pureName] || externalEmojiUrlMap.value[emojiName] || (targetHost ? lookupExternalEmojiUrl(targetHost, pureName) : null)
		: (targetHost ? lookupExternalEmojiUrl(targetHost, pureName) : null);
	if (cached) return cached;

	// 4. URLがストリームで後着したときは key が変わり、失敗済み画像を再マウントする。
	if (!targetHost) return undefined;
	return `https://${targetHost}/emoji/${encodeURIComponent(pureName)}.webp`;
}

function openInExternal() {
	window.open(`https://${props.host}/notes/${props.note.id}`, '_blank');
}

function openUserPopup() {
	const user = appearNote.value.user;
	const { dispose } = os.popup(MkExternalUserPopup, {
		userId: user?.id ?? appearNote.value.userId,
		host: props.host,
		token: props.token,
		initialUser: user,
	}, {
		closed: () => dispose(),
	});
}

// ===== ノート削除 =====
async function deleteNote() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: copy.confirmDelete,
	});
	if (canceled) return;

	try {
		await callExternalApi('notes/delete', { noteId: props.note.id });
		os.success();
		emit('noteDeleted', props.note.id);
	} catch (err) {
		console.error('[MkExternalNote] Delete error:', err);
		os.alert({ type: 'error', text: copy.deleteFailed });
	}
}

// ===== メニュー =====
function showNoteMenu(ev: MouseEvent) {
	const items: any[] = [];

	if (isMine.value) {
		items.push({
			text: copy.delete,
			icon: 'ti ti-trash',
			danger: true,
			action: deleteNote,
		});
		items.push({ type: 'divider' });
	}

	items.push({
		text: copy.openOnExternalSite,
		icon: 'ti ti-external-link',
		action: openInExternal,
	});

	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

</script>

<style lang="scss" module>
.root {
	padding: 10px 10px 6px;
	font-size: 0.95em;
	display: block;
}

.root:has(> [data-hk3-visibility-rail]) {
	position: relative;
}

/* 旗鯖fork(Hataskey UI 2): 外部TL (ohtl/oltl) のノートにも --htk-glass-card-opacity を反映。
   MkNote と同じ計算式 (accent tint + panel を変数で透明化) でカード面をガラス化する。
   ダーク/ライトで accent tint 濃度を出し分け。 */
:global(html.hataGlassUi) .root {
	border-radius: 20px;
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 18%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
	-webkit-backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
	backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
}
:global(html[data-color-scheme=light].hataGlassUi) .root {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
}

/* hataskeyUi prop から明示された時だけ、外部ノートを Hataskey UI のカード契約へ寄せる。
   visualMode の既定値は legacy のため、default UI の直置き表示には影響しない。 */
.root[data-external-note-ui='hataskey'][data-external-note-mode] {
	box-sizing: border-box;
	width: auto;
	min-width: 0;
	max-width: 100%;
	padding: 10px 10px 6px;
	border: none !important;
	border-radius: 0;
	background: transparent !important;
	box-shadow: none;
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}

:global(html.hataGlassUi) .root[data-external-note-ui='hataskey'] {
	border-radius: 0;
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}

.root[data-external-note-mode='hataskey-normal'] .bubbleBody {
	width: 100%;
	padding: 12px;
	border: 2px solid color-mix(in srgb, var(--MI_THEME-divider) 60%, transparent);
	border-radius: 20px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 2px 16px color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);
}

.root[data-external-note-mode='hataskey-deck'] {
	background: var(--MI_THEME-panel) !important;
}

.root[data-external-note-mode='hataskey-normal'][data-external-note-glass='on']:not([data-external-note-embedded='on']) .bubbleBody,
.root[data-external-note-mode='hataskey-deck'][data-external-note-glass='on']:not([data-external-note-embedded='on']),
:global(html.hataGlassUi) .root[data-external-note-mode='hataskey-normal']:not([data-external-note-embedded='on']) .bubbleBody,
:global(html.hataGlassUi) .root[data-external-note-mode='hataskey-deck']:not([data-external-note-embedded='on']) {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 18%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent) !important;
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}

:global(html[data-color-scheme=light]) .root[data-external-note-mode='hataskey-normal'][data-external-note-glass='on']:not([data-external-note-embedded='on']) .bubbleBody,
:global(html[data-color-scheme=light]) .root[data-external-note-mode='hataskey-deck'][data-external-note-glass='on']:not([data-external-note-embedded='on']),
:global(html[data-color-scheme=light].hataGlassUi) .root[data-external-note-mode='hataskey-normal']:not([data-external-note-embedded='on']) .bubbleBody,
:global(html[data-color-scheme=light].hataGlassUi) .root[data-external-note-mode='hataskey-deck']:not([data-external-note-embedded='on']) {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent) !important;
}

.root[data-external-note-ui='hataskey'] {
	.bubbleBody,
	.main,
	.main > div,
	.header,
	.headerBody,
	.headerTop,
	.content,
	.renote {
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
	}

	.renote {
		container-type: inline-size;
	}

	.bubbleBody {
		gap: 14px;
	}

	.avatarImg {
		width: 58px;
		height: 58px;
	}

	.name,
	.username {
		max-width: 100%;
	}

	.footer {
		width: 100%;
		min-width: 0;
		flex-wrap: wrap;
		gap: 4px 10px;
	}

	.footerButton {
		box-sizing: border-box;
		flex: 1 1 40px;
		justify-content: center;
		min-width: 0;
		padding: 8px;
	}
}

.root[data-external-note-embedded='on'] {
	padding: 0;
	border: none !important;
	border-radius: 0 !important;
	background: transparent !important;
	box-shadow: none !important;
	-webkit-backdrop-filter: none !important;
	backdrop-filter: none !important;

	.bubbleBody {
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent !important;
		box-shadow: none;
	}

	.avatarImg {
		width: 36px;
		height: 36px;
	}
}

.root[data-external-note-ui='hataskey'][data-external-note-mode='hataskey-deck'][data-external-note-glass='on'] {
	border-radius: 20px;
}

:global(html.hataGlassUi) .root[data-external-note-ui='hataskey'][data-external-note-mode='hataskey-deck'] {
	border-radius: 20px;
}

.avatar {
	flex-shrink: 0;
	margin-top: 2px;
	margin-right: 0;
}

.avatarImg {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	object-fit: cover;
}

.main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	position: relative;
}

.bubbleArrow {
	display: none;
}

.bubbleBody {
	display: flex;
	align-items: flex-start;
	gap: 0;
	min-width: 0;
}

.renoteAttribution {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	padding: 0 10px 8px;
	font-size: 0.85em;
	opacity: 0.75;

	> :last-child {
		margin-left: auto;
	}
}

.renoteAttributionName {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: 700;
}

.header {
	display: flex;
	gap: 8px;
}

.headerBody {
	flex: 1;
	min-width: 0;
}

.headerTop {
	display: flex;
	align-items: baseline;
	gap: 8px;
	flex-wrap: wrap;
}

.name {
	font-weight: bold;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}
}

.username {
	opacity: 0.7;
	font-size: 0.9em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.time {
	font-size: 0.85em;
	opacity: 0.7;
	margin-left: auto;

	&:hover {
		text-decoration: underline;
	}
}

.visibilityBadge {
	font-size: 0.8em;
	opacity: 0.6;
	cursor: help;

	> i {
		font-size: 0.9em;
	}
}

.cw {
	padding: 8px 12px;
	background: var(--MI_THEME-buttonBg);
	border-radius: 8px;
}

.cwButton {
	margin-left: 8px;
	padding: 4px 12px;
	font-size: 0.9em;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	border: none;
	border-radius: 4px;
	cursor: pointer;

	&:hover {
		opacity: 0.9;
	}
}

.content {
	// empty
}

.text {
	line-height: 1.6;
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.replyContext {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 2px 0 6px;
	font-size: 0.9em;
	color: var(--MI_THEME-accent);
}

.channel,
.renoteChannel {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
	max-width: 100%;
	font-size: 0.8em;
	opacity: 0.7;
}

.channel {
	margin-top: 6px;
}

.renoteChannel {
	max-width: min(40%, 16em);
}

.channelName {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

// ===== リノート =====
.renote {
	margin-top: 8px;
	padding: 8px;
	background: var(--MI_THEME-bg);
	border-radius: 8px;
	border: 1px solid var(--MI_THEME-divider);
}

.renoteHeader {
	font-size: 0.85em;
	opacity: 0.7;
	margin-bottom: 8px;
}

.renoteNote {
	padding: 0;
}

// ===== リアクション =====
.reactions {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin-top: 4px;
	user-select: none;
	-webkit-user-select: none;
	-webkit-touch-callout: none;
}

.reaction {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 6px;
	background: var(--MI_THEME-buttonBg);
	cursor: pointer;
	font-size: 0.9em;
	transition: all 0.2s;
	user-select: none;
	-webkit-user-select: none;
	-webkit-touch-callout: none;

	&:hover {
		background: var(--MI_THEME-buttonHoverBg);
	}
}

.myReaction {
	background: color-mix(in srgb, var(--MI_THEME-accent) 15%, transparent);
	border-color: var(--MI_THEME-accent);
	color: var(--MI_THEME-accent);
}

.reactionCount {
	font-size: 0.85em;
	min-width: 1em;
	text-align: center;
}

.reactionAdd {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border: 1px dashed var(--MI_THEME-divider);
	border-radius: 6px;
	background: none;
	cursor: pointer;
	opacity: 0.5;
	transition: all 0.2s;

	&:hover {
		opacity: 1;
		background: var(--MI_THEME-buttonBg);
		border-style: solid;
	}
}

// ===== フッター =====
.footer {
	display: flex;
	gap: 16px;
	margin-top: 4px;
}

// ===== モバイル対応 =====
@container (max-width: 700px) {
	.root {
		padding: 8px 6px 5px;
	}
	.avatarImg {
		width: 36px;
		height: 36px;
	}
}

.footerButton {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	font-size: 0.9em;
	color: var(--MI_THEME-fg);
	opacity: 0.7;
	background: none;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		opacity: 1;
		background: var(--MI_THEME-buttonBg);
	}

	&.reacted {
		color: var(--MI_THEME-accent);
		opacity: 1;
	}
}

.footerCount {
	font-size: 0.85em;
}

@container (max-width: 580px) {
	.root[data-external-note-ui='hataskey'] {
		font-size: 0.95em;

		.avatarImg {
			width: 50px;
			height: 50px;
		}
	}
}

@container (max-width: 450px) {
	.root[data-external-note-ui='hataskey'] {
		.bubbleBody {
			gap: 10px;
		}

		.avatarImg {
			width: 46px;
			height: 46px;
		}
	}
}

@container (max-width: 400px) {
	.root[data-external-note-ui='hataskey'] {
		.footer {
			gap: 2px;
		}

		.footerButton {
			padding: 8px 4px;
		}
	}
}

@container (max-width: 300px) {
	.root[data-external-note-ui='hataskey'] {
		padding-right: 6px;
		padding-left: 6px;

		.bubbleBody {
			gap: 8px;
		}

		.avatarImg {
			width: 44px;
			height: 44px;
		}
	}
}

.root[data-external-note-embedded='on'] .avatarImg {
	width: 36px;
	height: 36px;
}
</style>

<!-- グローバルスタイル: Teleport先のbodyに適用するため非module -->
<style lang="scss">
.ext-reaction-tip {
	background: var(--MI_THEME-panel, rgba(18, 18, 28, 0.95));
	border: 1px solid var(--MI_THEME-divider, rgba(255, 255, 255, 0.12));
	border-radius: 12px;
	padding: 10px 12px;
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	display: flex;
	gap: 10px;
	max-width: 340px;
	pointer-events: auto;
	animation: ext-reaction-tip-in 0.15s ease-out;
	color: var(--MI_THEME-fg, #fff);
}

@keyframes ext-reaction-tip-in {
	from { opacity: 0; transform: translateY(calc(-100% + 6px)); }
	to { opacity: 1; transform: translateY(-100%); }
}

.ext-reaction-tip-emoji {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding-right: 8px;
	border-right: 1px solid var(--MI_THEME-divider, rgba(255, 255, 255, 0.1));
	gap: 4px;
}

.ext-reaction-tip-emoji-img {
	width: 60px;
	height: 60px;
	object-fit: contain;
}

.ext-reaction-tip-emoji-text {
	font-size: 46px;
	line-height: 1;
}

.ext-reaction-tip-shortcode {
	font-size: 0.75em;
	opacity: 0.6;
	word-break: break-all;
	text-align: center;
	max-width: 90px;
	line-height: 1.3;
}

.ext-reaction-tip-users {
	flex: 1;
	min-width: 0;
	font-size: 0.95em;
}

.ext-reaction-tip-loading {
	opacity: 0.5;
	font-size: 0.85em;
	padding: 4px 0;
}

.ext-reaction-tip-user {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 3px 0;
	line-height: 24px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ext-reaction-tip-avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	flex-shrink: 0;
}

.ext-reaction-tip-name {
	overflow: hidden;
	text-overflow: ellipsis;
}

.ext-reaction-tip-more {
	padding: 2px 0;
	opacity: 0.6;
	font-size: 0.9em;
}
</style>
