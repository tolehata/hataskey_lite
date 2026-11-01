<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL の投稿1件。外部TL(MkExternalNote)と同じ Hataskey UI のカード契約で描く。
本文は CFM のリンク・画像・絵文字だけを解釈し、MFM や HTML には渡さない。
-->

<template>
<article
	:class="$style.root"
	:data-concrnt-note-ui="visualMode !== 'legacy' ? 'hataskey' : undefined"
	:data-concrnt-note-mode="visualMode !== 'legacy' ? visualMode : undefined"
	:data-concrnt-note-glass="visualMode !== 'legacy' && glassBg ? 'on' : undefined"
	:data-concrnt-note-embedded="embedded ? 'on' : undefined"
	:data-concrnt-note-reroute="isReroute ? 'on' : undefined"
>
	<Hk3VisibilityRail v-if="ui === 'hataskey3' && !embedded" :visibility="message.visibility === 'restricted' ? 'followers' : 'public'"/>
	<div v-if="isReroute" :class="$style.rerouteAttribution">
		<i class="ti ti-repeat" aria-hidden="true"></i>
		<button class="_button" :class="$style.rerouteName" @click="openUser(message.author, message.authorProfile, message.authorName, message.authorAvatarUrl)">{{ authorName }}</button>
		<span>がリルート</span>
		<MkTime :time="message.createdAt"/>
	</div>
	<div v-if="isReroute" :class="$style.rerouteBody">
		<div v-if="targetLoading" :class="$style.embedState" role="status">元の投稿を読み込んでいます…</div>
		<ConcrntNote v-else-if="target" :message="target" :visualMode="visualMode" :glassBg="glassBg" :depth="depth + 1" @update="target = $event"/>
		<div v-else :class="$style.embedState">元の投稿を表示できません。</div>
	</div>
	<div v-else :class="$style.bubbleBody">
		<button class="_button" :class="$style.avatar" :aria-label="`${authorName}のプロフィール`" @click="openUser(message.author, message.authorProfile, message.authorName, message.authorAvatarUrl)">
			<img v-if="message.authorAvatarUrl" :class="$style.avatarImg" :src="message.authorAvatarUrl" alt="" loading="lazy" referrerpolicy="no-referrer"/>
			<span v-else :class="[$style.avatarImg, $style.avatarFallback]" aria-hidden="true"><i class="ti ti-user"></i></span>
		</button>
		<div :class="$style.main">
			<header :class="$style.header">
				<button class="_button" :class="$style.name" @click="openUser(message.author, message.authorProfile, message.authorName, message.authorAvatarUrl)">{{ authorName }}</button>
				<span v-if="message.authorProfile !== 'main'" :class="$style.subprofile">{{ message.authorProfile }}</span>
				<button class="_button" :class="$style.time" :title="new Date(message.createdAt).toLocaleString()" @click="openDetail(message.uri)"><MkTime :time="message.createdAt"/></button>
				<span v-if="message.visibility === 'restricted'" :class="$style.badge" title="公開範囲が限定されています"><i class="ti ti-lock"></i></span>
			</header>
			<button v-if="message.kind === 'reply' && message.targetUri" class="_button" :class="$style.replyContext" @click="openDetail(message.targetUri)">
				<i class="ti ti-arrow-back-up" aria-hidden="true"></i><span>{{ replyLabel }}</span>
			</button>
			<p v-if="message.kind === 'unsupported'" :class="$style.unsupported">この投稿形式はまだ表示できません。</p>
			<div v-else-if="layout.parts.length" :class="$style.text">
				<template v-for="(part, index) in layout.parts" :key="index">
					<span v-if="part.type === 'text'">{{ part.text }}</span>
					<a v-else-if="part.type === 'link'" :class="$style.link" :href="part.url" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">{{ part.text }}</a>
					<img v-else-if="part.type === 'emoji'" :class="$style.emoji" :src="part.url" :alt="part.text" :title="part.text" loading="lazy" referrerpolicy="no-referrer"/>
				</template>
			</div>
			<MkMediaList v-if="mediaFiles.length" :class="$style.media" :mediaList="mediaFiles"/>
			<div v-if="quoteUri && depth < 2" :class="$style.quote">
				<div v-if="targetLoading" :class="$style.embedState" role="status">引用元を読み込んでいます…</div>
				<ConcrntNote v-else-if="target" :message="target" :visualMode="visualMode" :glassBg="glassBg" embedded :depth="depth + 1"/>
				<button v-else class="_button" :class="$style.embedState" @click="openDetail(quoteUri)">引用元を開く</button>
			</div>

			<div v-if="!embedded && message.reactions.length" :class="$style.reactions">
				<button
					v-for="reaction in message.reactions" :key="reaction.imageUrl" class="_button"
					:class="[$style.reaction, { [$style.myReaction]: reaction.ownAssociationUris.length > 0 }]"
					:aria-pressed="reaction.ownAssociationUris.length > 0" :disabled="processing"
					:aria-label="`${reaction.shortcode || 'リアクション'} ${reaction.count}`"
					@click="toggleReaction(reaction)"
					@mouseenter="onReactionEnter($event, reaction)" @mouseleave="hideReactionTip"
					@touchstart.passive="onReactionTouch($event, reaction)" @touchend.passive="cancelReactionTip" @touchcancel.passive="cancelReactionTip"
					@contextmenu.prevent
				>
					<img :src="reaction.imageUrl" :alt="reaction.shortcode" :class="$style.reactionImg" referrerpolicy="no-referrer"/>
					<span :class="$style.reactionCount">{{ formatCount(reaction.count) }}</span>
				</button>
				<button ref="reactionAddEl" class="_button" :class="$style.reactionAdd" aria-label="リアクションを追加" :disabled="processing" @click="openReactionPicker"><i class="ti ti-plus"></i></button>
			</div>

			<footer v-if="!embedded" :class="$style.footer">
				<button class="_button" :class="$style.footerButton" title="返信" aria-label="返信" :disabled="message.kind === 'unsupported'" @click="reply"><i class="ti ti-arrow-back-up"></i><span v-if="replyCount" :class="$style.footerCount">{{ formatCount(replyCount) }}</span></button>
				<button class="_button" :class="$style.footerButton" title="引用" aria-label="引用" :disabled="message.kind === 'unsupported'" @click="quote"><i class="ti ti-quote"></i><span v-if="rerouteCount" :class="$style.footerCount">{{ formatCount(rerouteCount) }}</span></button>
				<button ref="reactionBtnEl" class="_button" :class="[$style.footerButton, { [$style.reacted]: reacted }]" title="リアクション" aria-label="リアクション" :disabled="processing" @click="openReactionPicker"><i class="ti ti-mood-plus"></i><span v-if="totalReactions" :class="$style.footerCount">{{ formatCount(totalReactions) }}</span></button>
				<button class="_button" :class="$style.footerButton" title="その他" aria-label="その他" @click="showMenu"><i class="ti ti-dots"></i></button>
			</footer>
		</div>
	</div>
	<Teleport to="body">
		<div v-if="tip" class="concrnt-reaction-tip" :style="tip.style" role="tooltip" @click="hideReactionTip">
			<div class="concrnt-reaction-tip-emoji">
				<img :src="tip.imageUrl" alt="" class="concrnt-reaction-tip-emoji-img" referrerpolicy="no-referrer"/>
				<div v-if="tip.shortcode" class="concrnt-reaction-tip-shortcode">:{{ tip.shortcode }}:</div>
			</div>
			<div class="concrnt-reaction-tip-users">
				<div v-if="tip.loading" class="concrnt-reaction-tip-muted">読み込み中…</div>
				<div v-else-if="tip.failed" class="concrnt-reaction-tip-muted">取得できませんでした</div>
				<div v-for="user in tip.users" :key="`${user.ccid}/${user.profile}`" class="concrnt-reaction-tip-user">
					<img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="concrnt-reaction-tip-avatar" referrerpolicy="no-referrer"/>
					<span v-else class="concrnt-reaction-tip-avatar" aria-hidden="true"></span>
					<span class="concrnt-reaction-tip-name">{{ concrntDisplayName(user.name) }}</span>
				</div>
				<div v-if="!tip.loading && tip.count > tip.users.length && tip.users.length" class="concrnt-reaction-tip-muted">ほか{{ formatCount(tip.count - tip.users.length) }}人</div>
			</div>
		</div>
	</Teleport>
</article>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { ConcrntEmoji, ConcrntMessage, ConcrntReaction, ConcrntReactionUser } from '@/utility/concrnt/types.js';
import MkMediaList from '@/components/MkMediaList.vue';
import Hk3VisibilityRail from '@/components/hataskey3/Hk3VisibilityRail.vue';
import * as os from '@/os.js';
import { ui } from '@@/js/config.js';
import { versatileLang } from '@/utility/intl-const.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { concrntState, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntBodyLayout, concrntDisplayName, concrntQuoteOf } from '@/utility/concrnt/content.js';
import { fetchConcrntMessage, storeConcrntMessage } from '@/utility/concrnt/message-cache.js';
import { openConcrntHistory, openConcrntMessage, openConcrntPostForm } from '@/utility/concrnt/composer.js';

defineOptions({ name: 'ConcrntNote' });

const ConcrntEmojiPicker = defineAsyncComponent(() => import('@/components/concrnt/ConcrntEmojiPicker.vue'));
const ConcrntUserPopup = defineAsyncComponent(() => import('@/components/concrnt/ConcrntUserPopup.vue'));

const props = withDefaults(defineProps<{
	message: ConcrntMessage;
	visualMode?: 'legacy' | 'hataskey-normal' | 'hataskey-deck';
	glassBg?: boolean;
	embedded?: boolean;
	depth?: number;
}>(), { visualMode: 'legacy', glassBg: false, embedded: false, depth: 0 });

const emit = defineEmits<{ update: [message: ConcrntMessage] }>();

const numberFormatter = new Intl.NumberFormat(versatileLang);
const formatCount = (value: number): string => numberFormatter.format(value);
const reactionAddEl = useTemplateRef('reactionAddEl');
const reactionBtnEl = useTemplateRef('reactionBtnEl');
const processing = ref(false);
let alive = true;

const authorName = computed(() => concrntDisplayName(props.message.authorName));
const isReroute = computed(() => props.message.kind === 'reroute');
const quoteSplit = computed(() => concrntQuoteOf(props.message.body));
const quoteUri = computed(() => isReroute.value ? undefined : quoteSplit.value.uri);
const layout = computed(() => concrntBodyLayout(quoteSplit.value.body, props.message.emojis));
const counts = computed(() => props.message.associationCounts);
const replyCount = computed(() => counts.value['https://schema.concrnt.world/a/reply.json'] ?? 0);
const rerouteCount = computed(() => counts.value['https://schema.concrnt.world/a/reroute.json'] ?? 0);
const totalReactions = computed(() => props.message.reactions.reduce((sum, reaction) => sum + reaction.count, 0));
const reacted = computed(() => props.message.reactions.some(reaction => reaction.ownAssociationUris.length > 0));

/** Shape remote media as public drive files so MkMediaList opens them in the in-app viewer. */
const mediaFiles = computed<Misskey.entities.DriveFile[]>(() => {
	const items = [
		...props.message.media.map(media => ({ url: media.url, type: media.type, thumbnailUrl: media.thumbnailUrl, alt: media.alt, sensitive: Boolean(media.flag), blurhash: media.blurhash })),
		...layout.value.images.map(image => ({ url: image.url, type: 'image/*', thumbnailUrl: undefined, alt: image.alt, sensitive: false, blurhash: undefined })),
	];
	return items.map((media, index) => ({
		id: `concrnt:${props.message.uri}:${index}`,
		createdAt: props.message.createdAt,
		name: media.alt || media.url.split('/').pop() || 'concrnt-media',
		type: media.type,
		md5: '',
		size: 0,
		isSensitive: media.sensitive,
		blurhash: media.blurhash ?? null,
		properties: {},
		url: media.url,
		thumbnailUrl: media.thumbnailUrl ?? media.url,
		comment: media.alt || null,
		folderId: null,
		folder: null,
		userId: null,
		user: null,
	}) as Misskey.entities.DriveFile);
});

const replyLabel = ref('返信');
const target = ref<ConcrntMessage | null>(null);
const targetLoading = ref(false);

async function loadTarget(): Promise<void> {
	const uri = isReroute.value ? props.message.targetUri : quoteUri.value;
	if (!uri || props.depth >= 2) return;
	targetLoading.value = true;
	try {
		const found = await fetchConcrntMessage(uri);
		if (alive) target.value = found;
	} catch { /* The fallback offers opening the post explicitly. */ } finally {
		if (alive) targetLoading.value = false;
	}
}

async function loadReplyLabel(): Promise<void> {
	if (props.message.kind !== 'reply' || !props.message.targetUri || props.embedded) return;
	try {
		const parent = await fetchConcrntMessage(props.message.targetUri);
		if (alive) replyLabel.value = `${concrntDisplayName(parent.authorName)} への返信`;
	} catch { /* Keep the generic label. */ }
}

watch(() => [props.message.uri, props.message.targetUri, quoteUri.value], () => { target.value = null; void loadTarget(); void loadReplyLabel(); }, { immediate: true });

function openUser(ccid: string, profileId: string, initialName?: string, initialAvatarUrl?: string): void {
	const { dispose } = os.popup(ConcrntUserPopup, { ccid, profileId, initialName, initialAvatarUrl }, { closed: () => dispose() });
}

function openDetail(uri: string | undefined): void {
	if (uri) void openConcrntMessage(uri);
}

function reply(): void { void openConcrntPostForm({ target: props.message, mode: 'reply' }); }

function quote(): void { void openConcrntPostForm({ target: props.message, mode: 'quote' }); }

async function refresh(): Promise<void> {
	const fresh = await fetchConcrntMessage(props.message.uri, true);
	if (!alive) return;
	storeConcrntMessage(fresh);
	emit('update', fresh);
}

async function settle(status: string): Promise<boolean> {
	if (status === 'complete') return true;
	const { canceled } = await os.confirm({ type: 'warning', text: '送信結果を確認できませんでした。同じ操作の自動再送は行いません。送信履歴で結果を確認してください。', okText: '送信履歴を開く' });
	if (!canceled) void openConcrntHistory();
	return false;
}

async function run(work: () => Promise<void>): Promise<void> {
	if (processing.value) return;
	processing.value = true;
	try {
		await work();
	} catch (error) {
		if (alive) os.alert({ type: 'error', text: error instanceof Error ? error.message : '処理を完了できませんでした。' });
	} finally {
		if (alive) processing.value = false;
	}
}

async function sendReaction(emoji: ConcrntEmoji): Promise<void> {
	await run(async () => {
		const result = await runConcrntAction(client => client.addReaction(props.message.key ?? props.message.uri, emoji, concrntState.settings.profile));
		if (await settle(result.status)) await refresh();
	});
}

function openReactionPicker(): void {
	if (processing.value) return;
	const anchorElement = (reactionAddEl.value ?? reactionBtnEl.value) as HTMLElement | null;
	const { dispose } = os.popup(ConcrntEmojiPicker, { anchorElement, mode: 'reaction', extra: props.message.reactions.filter(reaction => reaction.shortcode) }, {
		done: (emoji: ConcrntEmoji) => { void sendReaction(emoji); },
		closed: () => dispose(),
	});
}

async function toggleReaction(reaction: ConcrntReaction): Promise<void> {
	// A long press only shows who reacted; the click that follows it must not toggle.
	if (suppressClick) { suppressClick = false; return; }
	hideReactionTip();
	if (!reaction.ownAssociationUris.length) { await sendReaction(reaction); return; }
	const { canceled } = await os.confirm({ type: 'warning', text: 'このリアクションを取り消しますか？' });
	if (canceled) return;
	await run(async () => {
		for (const uri of reaction.ownAssociationUris) {
			const result = await runConcrntAction(client => client.removeReaction(uri));
			if (!await settle(result.status)) return;
		}
		await refresh();
	});
}

function showMenu(ev: MouseEvent): void {
	os.popupMenu([
		{ text: '詳細', icon: 'ti ti-info-circle', action: () => openDetail(props.message.uri) },
		{ text: 'リンクをコピー', icon: 'ti ti-link', action: () => { copyToClipboard(props.message.webUrl); os.toast('リンクをコピーしました'); } },
		{ type: 'divider' },
		{ text: 'コンカレントで開く', icon: 'ti ti-external-link', action: () => { window.open(props.message.webUrl, '_blank', 'noopener,noreferrer'); } },
	], (ev.currentTarget ?? ev.target) as HTMLElement);
}

// ===== リアクションした人のツールチップ =====
type Tip = { style: Record<string, string>; imageUrl: string; shortcode: string; count: number; users: ConcrntReactionUser[]; loading: boolean; failed: boolean };
const tip = ref<Tip | null>(null);
let tipTimer: number | undefined;
let tipRequest = 0;
let suppressClick = false;

function cancelReactionTip(): void {
	if (tip.value) {
		suppressClick = true;
		window.setTimeout(() => { suppressClick = false; }, 600);
	}
	hideReactionTip();
}

function hideReactionTip(): void {
	window.clearTimeout(tipTimer);
	tipRequest++;
	tip.value = null;
}

function onReactionEnter(ev: MouseEvent, reaction: ConcrntReaction): void {
	const el = ev.currentTarget as HTMLElement;
	window.clearTimeout(tipTimer);
	tipTimer = window.setTimeout(() => { void showReactionUsers(el, reaction); }, 300);
}

function onReactionTouch(ev: TouchEvent, reaction: ConcrntReaction): void {
	const el = ev.currentTarget as HTMLElement;
	window.clearTimeout(tipTimer);
	tipTimer = window.setTimeout(() => { void showReactionUsers(el, reaction); }, 400);
}

async function showReactionUsers(anchor: HTMLElement, reaction: ConcrntReaction): Promise<void> {
	const id = ++tipRequest;
	const rect = anchor.getBoundingClientRect();
	tip.value = {
		style: { position: 'fixed', left: `${Math.max(8, Math.min(rect.left + rect.width / 2 - 170, window.innerWidth - 348))}px`, top: `${Math.max(8, rect.top - 8)}px`, transform: 'translateY(-100%)', zIndex: '1000000' },
		imageUrl: reaction.imageUrl, shortcode: reaction.shortcode, count: reaction.count, users: [], loading: true, failed: false,
	};
	try {
		const result = await runConcrntAction(client => client.getReactionUsers(props.message.uri, reaction.imageUrl, 10));
		if (id !== tipRequest || !tip.value) return;
		tip.value = { ...tip.value, shortcode: tip.value.shortcode || result.shortcode, users: result.users, loading: false };
	} catch {
		if (id === tipRequest && tip.value) tip.value = { ...tip.value, loading: false, failed: true };
	}
}

onBeforeUnmount(() => { alive = false; hideReactionTip(); });
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: block;
	padding: 10px 10px 6px;
	font-size: .95em;
	container-type: inline-size;
}

/* Hataskey UI のカード契約（MkExternalNote と同じ見た目）。 */
.root[data-concrnt-note-ui='hataskey'] {
	box-sizing: border-box;
	min-width: 0;
	max-width: 100%;
	background: transparent;

	.bubbleBody { gap: 14px; }
	.avatarImg { width: 58px; height: 58px; }
	.footer { flex-wrap: wrap; gap: 4px 10px; width: 100%; }
	.footerButton { flex: 1 1 40px; justify-content: center; box-sizing: border-box; min-width: 0; padding: 8px; }
}

/* 投稿1件ごとのカードだけを描き、TL全体に下敷き（帯状の面）は敷かない。通常表示もデッキも同じ。 */
.root[data-concrnt-note-mode] > .bubbleBody {
	width: 100%;
	box-sizing: border-box;
	padding: 12px;
	border: 2px solid color-mix(in srgb, var(--MI_THEME-divider) 60%, transparent);
	border-radius: 20px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 2px 16px color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);
}

.root[data-concrnt-note-mode='hataskey-deck'] > .bubbleBody {
	padding: 10px;
	border-radius: 16px;
	box-shadow: none;
}

.root[data-concrnt-note-mode][data-concrnt-note-glass='on']:not([data-concrnt-note-embedded='on']) > .bubbleBody,
:global(html.hataGlassUi) .root[data-concrnt-note-mode]:not([data-concrnt-note-embedded='on']) > .bubbleBody {
	background: color-mix(in srgb, color-mix(in srgb, var(--MI_THEME-accent) 18%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}

:global(html[data-color-scheme=light]) .root[data-concrnt-note-mode][data-concrnt-note-glass='on']:not([data-concrnt-note-embedded='on']) > .bubbleBody,
:global(html[data-color-scheme=light].hataGlassUi) .root[data-concrnt-note-mode]:not([data-concrnt-note-embedded='on']) > .bubbleBody {
	background: color-mix(in srgb, color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}

/* 引用・リルート先として埋め込む時は枠を持たない。 */
.root[data-concrnt-note-embedded='on'] {
	padding: 0;
	background: transparent;

	> .bubbleBody {
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		gap: 10px;
	}

	.avatarImg { width: 36px; height: 36px; }
}

/* リルートは元投稿のカードをそのまま見せ、帰属の行だけ外側に出す。 */
.root[data-concrnt-note-reroute='on'] {
	> .rerouteBody > .root { padding: 0; }
}

.bubbleBody {
	display: flex;
	align-items: flex-start;
	min-width: 0;
	gap: 10px;
}

.avatar {
	flex-shrink: 0;
	margin-top: 2px;
	border-radius: 50%;

	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
}

.avatarImg {
	display: block;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	object-fit: cover;
}

.avatarFallback {
	display: grid;
	place-items: center;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 22px;
}

.main {
	position: relative;
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.header {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 4px 8px;
	min-width: 0;
}

.name {
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover { text-decoration: underline; }
}

.subprofile {
	min-width: 0;
	overflow: hidden;
	font-size: .85em;
	text-overflow: ellipsis;
	white-space: nowrap;
	opacity: .7;
}

.time {
	margin-left: auto;
	font-size: .85em;
	opacity: .7;

	&:hover { text-decoration: underline; }
}

.badge {
	font-size: .8em;
	opacity: .6;
}

.replyContext {
	display: flex;
	align-items: center;
	align-self: flex-start;
	gap: 6px;
	margin: 2px 0 6px;
	color: var(--MI_THEME-accent);
	font-size: .9em;

	&:hover { text-decoration: underline; }
}

.unsupported {
	margin: 4px 0;
	font-size: .9em;
	opacity: .7;
}

.text {
	line-height: 1.6;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.link {
	color: var(--MI_THEME-link);

	&:hover { text-decoration: underline; }
}

.emoji {
	height: 1.5em;
	max-width: 6em;
	object-fit: contain;
	vertical-align: -.35em;
}

.media {
	margin-top: 8px;
}

.quote {
	margin-top: 8px;
	padding: 8px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 12px;
	background: var(--MI_THEME-bg);
}

.rerouteAttribution {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	padding: 0 10px 8px;
	font-size: .85em;
	opacity: .75;

	> :last-child { margin-left: auto; }
}

.rerouteName {
	min-width: 0;
	overflow: hidden;
	font-weight: 700;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover { text-decoration: underline; }
}

.embedState {
	display: block;
	padding: 8px;
	font-size: .85em;
	opacity: .7;
}

.reactions {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin-top: 6px;
	user-select: none;
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
	font-size: .9em;
	transition: background .2s;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
}

.myReaction {
	border-color: var(--MI_THEME-accent);
	background: color-mix(in srgb, var(--MI_THEME-accent) 15%, transparent);
	color: var(--MI_THEME-accent);
}

.reactionImg {
	width: 22px;
	height: 22px;
	object-fit: contain;
	pointer-events: none;
}

.reactionCount {
	min-width: 1em;
	font-size: .85em;
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
	opacity: .5;
	transition: all .2s;

	&:hover { border-style: solid; background: var(--MI_THEME-buttonBg); opacity: 1; }
}

.footer {
	display: flex;
	gap: 16px;
	margin-top: 4px;
}

.footerButton {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	border-radius: 8px;
	color: var(--MI_THEME-fg);
	font-size: .9em;
	opacity: .7;
	transition: all .2s ease;

	&:hover:not(:disabled) { background: var(--MI_THEME-buttonBg); opacity: 1; }
	&:disabled { opacity: .35; }
	&.reacted { color: var(--MI_THEME-accent); opacity: 1; }
}

.footerCount {
	font-size: .85em;
}

@container (max-width: 580px) {
	.root[data-concrnt-note-ui='hataskey'] .avatarImg { width: 50px; height: 50px; }
}

@container (max-width: 450px) {
	.root[data-concrnt-note-ui='hataskey'] {
		.bubbleBody { gap: 10px; }
		.avatarImg { width: 46px; height: 46px; }
	}
}

@container (max-width: 400px) {
	.root[data-concrnt-note-ui='hataskey'] {
		.footer { gap: 2px; }
		.footerButton { padding: 8px 4px; }
	}
}

.root[data-concrnt-note-embedded='on'] .avatarImg {
	width: 36px;
	height: 36px;
}
</style>

<!-- Teleport 先の body に当てるため非 module。 -->
<style lang="scss">
.concrnt-reaction-tip {
	display: flex;
	gap: 10px;
	max-width: 340px;
	padding: 10px 12px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	box-shadow: 0 8px 32px rgba(0, 0, 0, .3);
	pointer-events: auto;
	animation: concrnt-reaction-tip-in .15s ease-out;
}

@keyframes concrnt-reaction-tip-in {
	from { opacity: 0; transform: translateY(calc(-100% + 6px)); }
	to { opacity: 1; transform: translateY(-100%); }
}

@media (prefers-reduced-motion: reduce) {
	.concrnt-reaction-tip { animation: none; }
}

.concrnt-reaction-tip-emoji {
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding-right: 8px;
	border-right: 1px solid var(--MI_THEME-divider);
}

.concrnt-reaction-tip-emoji-img {
	width: 60px;
	height: 60px;
	object-fit: contain;
}

.concrnt-reaction-tip-shortcode {
	max-width: 90px;
	font-size: .75em;
	line-height: 1.3;
	text-align: center;
	word-break: break-all;
	opacity: .6;
}

.concrnt-reaction-tip-users {
	flex: 1;
	min-width: 0;
	font-size: .95em;
}

.concrnt-reaction-tip-muted {
	padding: 4px 0;
	font-size: .85em;
	opacity: .6;
}

.concrnt-reaction-tip-user {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 3px 0;
	line-height: 24px;
	overflow: hidden;
	white-space: nowrap;
}

.concrnt-reaction-tip-avatar {
	flex-shrink: 0;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--MI_THEME-buttonBg);
	object-fit: cover;
}

.concrnt-reaction-tip-name {
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
