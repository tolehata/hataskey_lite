<!--Container cherrypick-redis-1        Healthy                             5.9s
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only  Created                             0.1s
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン、channels.vue と同形)。
	     ウィンドウモード等の狭幅でタブが収まらない時、マウスホイールの縦回転を横スクロールに
	     変換 + タブバー上のドラッグでも横スクロールできるようにする (@wheel / pointer ドラッグ)。 -->
	<div :class="$style.htkPillTabs">
		<div
			ref="pillTabsInnerEl"
			:class="$style.htkPillTabsInner"
			@wheel="onPillTabsWheel"
			@pointerdown="onPillTabsPointerDown"
		>
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<!-- 旗鯖fork: ピル型タブ化で PageWithHeader に :tabs="[]" を渡したため標準の MkSwiper が
	     無効化されていた。enableHorizontalSwipe が有効な時はコンテンツを自前で MkSwiper でラップ
	     して左右スワイプによるタブ切替を復活させる (ウィンドウモード含む)。無効時は素の div。
	     swiperBinds は MkSwiper の時だけ v-model:tab / tabs を渡し、div の時は空 (余分な属性を出さない)。 -->
	<component :is="swiperEnabled ? MkSwiper : 'div'" v-bind="swiperBinds">
	<div class="_spacer" :class="$style.channelContent" style="--MI_SPACER-w: 700px;">
		<div v-if="channel && tab === 'overview'" class="_gaps">
			<div class="_panel" :class="$style.bannerContainer">
				<XChannelFollowButton :channel="channel" :full="true" :class="$style.subscribe"/>
				<MkButton v-if="favorited" v-tooltip="i18n.ts.unfavorite" asLike class="button" rounded primary :class="$style.favorite" @click="unfavorite()"><i class="ti ti-star"></i></MkButton>
				<MkButton v-else v-tooltip="i18n.ts.favorite" asLike class="button" rounded :class="$style.favorite" @click="favorite()"><i class="ti ti-star"></i></MkButton>
				<div :style="{ backgroundImage: channel.bannerUrl ? `url(${channel.bannerUrl})` : undefined }" :class="$style.banner">
					<div :class="$style.bannerStatus">
						<div><i class="ti ti-users ti-fw"></i><I18n :src="i18n.ts._channel.usersCount" tag="span" style="margin-left: 4px;"><template #n><b>{{ channel.usersCount }}</b></template></I18n></div>
						<div><i class="ti ti-pencil ti-fw"></i><I18n :src="i18n.ts._channel.notesCount" tag="span" style="margin-left: 4px;"><template #n><b>{{ channel.notesCount }}</b></template></I18n></div>
					</div>
					<div v-if="channel.isSensitive" :class="$style.sensitiveIndicator">{{ i18n.ts.sensitive }}</div>
					<div :class="$style.bannerFade"></div>
				</div>
				<div v-if="channel.description" :class="$style.description">
					<Mfm :text="channel.description" :isNote="false"/>
				</div>
			</div>

			<!-- 旗鯖fork: プライベートチャンネル -->
			<div v-if="channel.isPrivate" class="_panel" :class="$style.privatePanel">
				<div :class="$style.privateHead"><i class="ti ti-lock"></i> {{ copy.privateChannel }}</div>
				<div v-if="canViewContent" :class="$style.privateNote">{{ copy.membersOnlyYouCanView }}</div>
				<template v-else>
					<div :class="$style.privateNote">{{ copy.membersOnly }}</div>
					<div v-if="channel.hasPassword && $i" class="_buttonsCenter" :class="$style.joinBox">
						<MkButton primary rounded :disabled="joining" @click="joinByPassword()"><i class="ti ti-door-enter"></i> {{ copy.enterWithPassphrase }}</MkButton>
					</div>
					<div v-else-if="!$i" :class="$style.privateNote">{{ copy.loginRequired }}</div>
					<div v-else :class="$style.privateNote">{{ copy.invitationRequired }}</div>
				</template>
			</div>

			<MkFoldableSection v-if="canViewContent">
				<template #header><i class="ti ti-pin ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.pinnedNotes }}</template>
				<div v-if="channel.pinnedNotes && channel.pinnedNotes.length > 0" class="_gaps">
					<MkNote v-for="note in channel.pinnedNotes" :key="note.id" class="_panel" :class="$style.pinnedNote" :note="note"/>
				</div>
			</MkFoldableSection>
		</div>
		<div v-if="channel && tab === 'timeline'" class="_gaps">
			<MkInfo v-if="channel.isArchived" warn>{{ i18n.ts.thisChannelArchived }}</MkInfo>

			<!-- 旗鯖fork: プライベートチャンネルの非メンバーには内容を出さず、入室導線を案内 -->
			<div v-if="channel.isPrivate && !canViewContent" class="_panel" :class="$style.privatePanel">
				<div :class="$style.privateHead"><i class="ti ti-lock"></i> {{ copy.privateChannel }}</div>
				<div :class="$style.privateNote">{{ privateTimelineNotice }}</div>
			</div>
			<template v-else>
				<!-- スマホ・タブレットの場合、キーボードが表示されると 投稿が見づらくなるので、デスクトップ場合のみ自動でフォーカスを当てる -->
				<MkPostForm v-if="$i && prefer.r.showFixedPostFormInChannel.value" :channel="channel" class="post-form _panel" fixed :autofocus="deviceKind === 'desktop'"/>

				<MkStreamingNotesTimeline :key="channelId" src="channel" :channel="channelId"/>
			</template>
		</div>
		<div v-else-if="tab === 'featured'">
			<MkNotesTimeline :paginator="featuredPaginator"/>
		</div>
		<div v-else-if="tab === 'search'">
			<div v-if="notesSearchAvailable" class="_gaps">
				<!-- 旗鯖fork: Hataskey UI 検索ページと同様の一体型カプセル検索バー -->
				<div :class="$style.htkCapsule">
					<i :class="$style.htkCapsuleIcon" class="ti ti-search"/>
					<input
						ref="searchQueryEl"
						v-model="searchQuery"
						type="search"
						:class="$style.htkCapsuleInput"
						:placeholder="i18n.ts.search"
						@keydown.enter.prevent="search"
					/>
					<button
						v-if="searchQuery !== ''"
						type="button"
						:class="$style.htkCapsuleClear"
						tabindex="-1"
						:aria-label="i18n.ts.clear"
						@click="searchQuery = ''; searchQueryEl?.focus();"
					>
						<i class="ti ti-x"/>
					</button>
					<button
						type="button"
						:class="$style.htkCapsuleSearch"
						:aria-label="i18n.ts.search"
						@click="search"
					>
						<i class="ti ti-search"/>
					</button>
				</div>
				<MkNotesTimeline v-if="searchPaginator" :key="searchKey" :paginator="searchPaginator"/>
			</div>
			<div v-else>
				<MkInfo warn>{{ i18n.ts.notesSearchNotAvailable }}</MkInfo>
			</div>
		</div>
	</div>
	</component>
	<template #footer>
		<div v-if="canViewContent" :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<div class="_buttonsCenter">
					<MkButton inline rounded primary gradate @click="openPostForm()"><i class="ti ti-pencil"></i> {{ i18n.ts.postToTheChannel }}</MkButton>
				</div>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, watch, ref, markRaw, shallowRef, defineAsyncComponent, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import { url } from '@@/js/config.js';
import { useInterval } from '@@/js/use-interval.js';
import type { PageHeaderItem } from '@/types/page-header.js';
import MkPostForm from '@/components/MkPostForm.vue';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import XChannelFollowButton from '@/components/MkChannelFollowButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i, iAmModerator } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { deviceKind } from '@/utility/device-kind.js';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { favoritedChannelsCache } from '@/cache.js';
import MkButton from '@/components/MkButton.vue';
import MkSwiper from '@/components/MkSwiper.vue';
import { prefer } from '@/preferences.js';
import MkNote from '@/components/MkNote.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { isSupportShare } from '@/utility/navigator.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { notesSearchAvailable } from '@/utility/check-permissions.js';
import { miLocalStorage } from '@/local-storage.js';
import { useRouter } from '@/router.js';
import { Paginator } from '@/utility/paginator.js';

const router = useRouter();
const copy = i18n.ts._hata._privateChannels;

const props = defineProps<{
	channelId: string;
}>();

const tab = ref('overview');

const channel = ref<Misskey.entities.Channel | null>(null);
const favorited = ref(false);
// 旗鯖fork: プライベートチャンネル
const joining = ref(false);
const canViewContent = computed(() => {
	const c = channel.value;
	if (c == null) return false;
	if (!c.isPrivate) return true;
	return (c.isMember ?? false) || (c.canManage ?? false);
});
const privateTimelineNotice = computed(() => channel.value?.hasPassword ? copy.membersOnlyWithPassphrase : copy.membersOnlyByInvitation);
const searchQuery = ref('');
const searchQueryEl = useTemplateRef('searchQueryEl');

// 旗鯖fork: コンテンツを MkSwiper でラップしてタブ左右スワイプを有効化するか。
// enableHorizontalSwipe が OFF の場合は素の div にフォールバック (スワイプなし)。
const swiperEnabled = computed(() => prefer.s.enableHorizontalSwipe && headerTabs.value.length > 1);
// component :is が MkSwiper の時だけ v-model:tab (= tab + onUpdate:tab) と tabs を渡す。
// div の時は空オブジェクトにして [object Object] 等の余分な属性が付かないようにする。
const swiperBinds = computed(() => swiperEnabled.value ? {
	tab: tab.value,
	'onUpdate:tab': (v: string) => { tab.value = v; },
	tabs: headerTabs.value,
} : {});

// 旗鯖fork: ピルタブの横スクロール制御 (ウィンドウモード等の狭幅対応)。
const pillTabsInnerEl = useTemplateRef('pillTabsInnerEl');
// マウスホイールの縦回転をタブバーの横スクロールに変換する。
function onPillTabsWheel(ev: WheelEvent) {
	const el = pillTabsInnerEl.value;
	if (!el) return;
	// 横スクロールの必要がない(全タブが収まっている)なら通常の縦スクロールに任せる。
	if (el.scrollWidth <= el.clientWidth) return;
	const delta = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
	if (delta === 0) return;
	const atStart = el.scrollLeft <= 0;
	const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
	// 端に達していて更に外へスクロールしようとした時はページ側に委ねる (端で引っかからない)。
	if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
	ev.preventDefault();
	el.scrollLeft += delta;
}
// タブバー上のポインタドラッグで横スクロール (タッチのネイティブスクロールは overflow-x で対応済み、
// これはマウス/トラックパッドのドラッグ操作を補完する)。
let pillDragging = false;
let pillDragStartX = 0;
let pillDragStartScroll = 0;
function onPillTabsPointerDown(ev: PointerEvent) {
	// タッチはネイティブの慣性スクロールに任せる (ドラッグ横取りしない)。
	if (ev.pointerType === 'touch') return;
	const el = pillTabsInnerEl.value;
	if (!el || el.scrollWidth <= el.clientWidth) return;
	pillDragging = true;
	pillDragStartX = ev.clientX;
	pillDragStartScroll = el.scrollLeft;
	window.addEventListener('pointermove', onPillTabsPointerMove);
	window.addEventListener('pointerup', onPillTabsPointerUp);
}
function onPillTabsPointerMove(ev: PointerEvent) {
	if (!pillDragging) return;
	const el = pillTabsInnerEl.value;
	if (!el) return;
	el.scrollLeft = pillDragStartScroll - (ev.clientX - pillDragStartX);
}
function onPillTabsPointerUp() {
	pillDragging = false;
	window.removeEventListener('pointermove', onPillTabsPointerMove);
	window.removeEventListener('pointerup', onPillTabsPointerUp);
}
const searchPaginator = shallowRef();
const searchKey = ref('');
const featuredPaginator = markRaw(new Paginator('notes/featured', {
	limit: 10,
	computedParams: computed(() => ({
		channelId: props.channelId,
	})),
}));

useInterval(() => {
	if (channel.value == null) return;
	miLocalStorage.setItemAsJson(`channelLastReadedAt:${channel.value.id}`, Date.now());
}, 3000, {
	immediate: true,
	afterMounted: true,
});

watch(() => props.channelId, async () => {
	channel.value = await misskeyApi('channels/show', {
		channelId: props.channelId,
	});
	if (channel.value == null) return; // TSを黙らすため

	favorited.value = channel.value.isFavorited ?? false;
	if (favorited.value || channel.value.isFollowing) {
		tab.value = 'timeline';
	}

	if ((favorited.value || channel.value.isFollowing) && channel.value.lastNotedAt) {
		const lastReadedAt: number = miLocalStorage.getItemAsJson(`channelLastReadedAt:${channel.value.id}`) ?? 0;
		const lastNotedAt = Date.parse(channel.value.lastNotedAt);

		if (lastNotedAt > lastReadedAt) {
			miLocalStorage.setItemAsJson(`channelLastReadedAt:${channel.value.id}`, lastNotedAt);
		}
	}
}, { immediate: true });

function edit() {
	router.push('/channels/:channelId/edit', {
		params: {
			channelId: props.channelId,
		},
	});
}

function openPostForm() {
	os.post({
		channel: channel.value,
	});
}

// 旗鯖fork: 合言葉(キーフレーズ)で入室する
async function joinByPassword() {
	if (!channel.value) return;
	const { canceled, result: password } = await os.inputText({
		title: copy.enterWithPassphrase,
		text: copy.passphrasePrompt,
		placeholder: copy.passphraseExample,
		default: '',
	});
	if (canceled || password == null || password === '') return;

	joining.value = true;
	try {
		const updated = await misskeyApi('channels/join', {
			channelId: channel.value.id,
			password,
		});
		channel.value = updated;
		os.success();
		tab.value = 'timeline';
	} catch (err) {
		os.alert({ type: 'error', text: copy.incorrectPassphrase });
	} finally {
		joining.value = false;
	}
}

// 旗鯖fork: メンバー管理ダイアログを開く
function manageMembers() {
	if (!channel.value) return;
	const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkPrivateChannelMembersDialog.vue')), {
		channelId: channel.value.id,
	}, {
		closed: () => dispose(),
	});
}

function favorite() {
	if (!channel.value) return;

	os.apiWithDialog('channels/favorite', {
		channelId: channel.value.id,
	}).then(() => {
		favorited.value = true;
		favoritedChannelsCache.delete();
	});
}

async function unfavorite() {
	if (!channel.value) return;

	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts.unfavoriteConfirm,
	});
	if (confirm.canceled) return;
	os.apiWithDialog('channels/unfavorite', {
		channelId: channel.value.id,
	}).then(() => {
		favorited.value = false;
		favoritedChannelsCache.delete();
	});
}

async function search() {
	if (!channel.value) return;

	const query = searchQuery.value.toString().trim();

	if (query == null) return;

	searchPaginator.value = markRaw(new Paginator('notes/search', {
		limit: 10,
		params: {
			query: query,
			channelId: channel.value.id,
		},
	}));

	searchKey.value = query;
}

const headerActions = computed(() => {
	if (channel.value && channel.value.userId) {
		const headerItems: PageHeaderItem[] = [];

		headerItems.push({
			icon: 'ti ti-link',
			text: i18n.ts.copyUrl,
			handler: async (): Promise<void> => {
				if (!channel.value) {
					console.warn('failed to copy channel URL. channel.value is null.');
					return;
				}
				copyToClipboard(`${url}/channels/${channel.value.id}`, 'link');
			},
		});

		if (isSupportShare()) {
			headerItems.push({
				icon: 'ti ti-share',
				text: i18n.ts.share,
				handler: async (): Promise<void> => {
					if (!channel.value) {
						console.warn('failed to share channel. channel.value is null.');
						return;
					}

					navigator.share({
						title: channel.value.name,
						text: channel.value.description ?? undefined,
						url: `${url}/channels/${channel.value.id}`,
					});
				},
			});
		}

		// 旗鯖fork: 作成者・副管理者(canManage)・モデレーターが編集できる
		if (channel.value.canManage || ($i && $i.id === channel.value.userId) || iAmModerator) {
			headerItems.push({
				icon: 'ti ti-settings',
				text: i18n.ts.edit,
				handler: edit,
			});
		}

		// 旗鯖fork: プライベートチャンネルのメンバー管理
		if (channel.value.isPrivate && (channel.value.canManage || iAmModerator)) {
			headerItems.push({
				icon: 'ti ti-users',
				text: copy.membersTitle,
				handler: manageMembers,
			});
		}

		return headerItems.length > 0 ? headerItems : null;
	} else {
		return null;
	}
});

const headerTabs = computed(() => [{
	key: 'overview',
	title: i18n.ts.overview,
	icon: 'ti ti-info-circle',
}, {
	key: 'timeline',
	title: i18n.ts.timeline,
	icon: 'ti ti-home',
}, {
	key: 'featured',
	title: i18n.ts.featured,
	icon: 'ti ti-bolt',
}, {
	key: 'search',
	title: i18n.ts.search,
	icon: 'ti ti-search',
}]);

definePage(() => ({
	// 旗鯖fork: プライベートチャンネルは名前の横に鍵マークを表示。
	title: channel.value ? `${channel.value.isPrivate ? '🔒 ' : ''}${channel.value.name}` : i18n.ts.channel,
	icon: channel.value?.isPrivate ? 'ti ti-lock' : 'ti ti-device-tv',
}));
</script>

<style lang="scss" module>
:global(html[data-hk3-ui]) .channelContent {
	--MI-notes-canvas: transparent;
	--MI-notes-surface: var(--hk3-glass-note, color-mix(in srgb, var(--MI_THEME-panel) 70%, transparent));
	--MI-notes-backdrop-filter: var(--MI-blur, blur(20px)) saturate(1.3);
}

:global(html[data-hk3-ui]) .channelContent .pinnedNote {
	background: var(--MI-notes-surface);
	-webkit-backdrop-filter: var(--MI-notes-backdrop-filter);
	backdrop-filter: var(--MI-notes-backdrop-filter);
}

// The shared bubble layout paints its own body; keep just that glass surface.
:global(html[data-hk3-ui]) .channelContent :global([data-bubble="on"] article > div) {
	background: transparent !important;
}

:global(html[data-hk3-ui]) .channelContent :global([data-bubble="on"] [data-note-content]) {
	background: var(--MI-notes-surface) !important;
}

:global(html[data-hk3-ui]) .channelContent :global([data-bubble="on"] [data-note-content]::after) {
	border-right-color: var(--MI-notes-surface) !important;
}

:global(html[data-hk3-ui]) .channelContent :global([data-streaming-notes]:not([data-bubble="on"]) article) {
	background: transparent !important;
}

/* 旗鯖fork: Hataskey UI 統一ピル型タブ (channels.vue と同一デザイン) */
.htkPillTabs {
	position: sticky;
	top: var(--MI-stickyTop, 0px);
	z-index: 50;
	display: flex;
	justify-content: center;
	padding: 12px 16px;
	background: var(--MI-page-controls-background, color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent));
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	margin-bottom: 8px;
}
.htkPillTabsInner {
	display: inline-flex;
	gap: 4px;
	padding: 4px;
	background: var(--MI-page-tabs-background, var(--MI_THEME-panel));
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	max-width: 100%;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar { display: none; }
}
.htkPillTab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	font-weight: 500;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover { background: var(--MI_THEME-accentedBg); }
	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		/* 旗鯖fork: #fff ハードコード。テーマで --MI_THEME-fgOnAccent が未定義の場合、
		   色が親から継承されアクセント色と混ざり文字が潰れる問題を回避。 */
		color: #fff;
	}
	i { font-size: 1em; line-height: 1; }
}

/* 旗鯖fork: Hataskey UI 検索ページと同様の一体型カプセル検索バー (channels.vue と同一) */
.htkCapsule {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 6px 6px 14px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	transition: border-color 0.15s, box-shadow 0.15s;
}
.htkCapsule:focus-within {
	border-color: var(--MI_THEME-accent);
	box-shadow: 0 0 0 3px color(from var(--MI_THEME-accent) srgb r g b / 0.15);
}
.htkCapsuleIcon { font-size: 1.1em; opacity: 0.6; flex-shrink: 0; }
.htkCapsuleInput {
	flex: 1;
	min-width: 0;
	padding: 8px 4px;
	background: transparent;
	border: none;
	outline: none;
	color: var(--MI_THEME-fg);
	font-size: 15px;
	font-family: inherit;

	&::placeholder { color: color(from var(--MI_THEME-fg) srgb r g b / 0.5); }
}
.htkCapsuleClear {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fg);
	opacity: 0.55;
	cursor: pointer;
	flex-shrink: 0;
	transition: opacity 0.1s, background 0.1s;

	&:hover { opacity: 1; background: color(from var(--MI_THEME-fg) srgb r g b / 0.08); }
}
.htkCapsuleSearch {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	background: var(--MI_THEME-accent);
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fgOnAccent, #fff);
	cursor: pointer;
	flex-shrink: 0;
	transition: filter 0.1s, transform 0.05s;

	&:hover { filter: brightness(1.08); }
	&:active { transform: scale(0.96); }
}

/* 旗鯖fork: プライベートチャンネル */
.privatePanel {
	padding: 16px;
}

.privateHead {
	font-weight: 700;
	display: flex;
	align-items: center;
	gap: 6px;

	> i {
		color: var(--MI_THEME-accent);
	}
}

.privateNote {
	margin-top: 6px;
	font-size: 0.9em;
	opacity: 0.85;
}

.joinBox {
	margin-top: 12px;
}

.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.5);
	border-top: solid 0.5px var(--MI_THEME-divider);
	/* 旗鯖fork: friendly.vue前提の +70px はボトムナビと被らないための余白だが、
	   Hataskey UIではボトムナビ構成が異なり過剰な空白になる。safe-area + 控えめな余白に。 */
	padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
}

.bannerContainer {
	position: relative;
}

.subscribe {
	position: absolute;
	z-index: 1;
	top: 16px;
	left: 16px;
}

.favorite {
	position: absolute;
	z-index: 1;
	top: 16px;
	right: 16px;
}

.banner {
	position: relative;
	height: 200px;
	background-position: center;
	background-size: cover;
}

.bannerFade {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: 64px;
	background: linear-gradient(0deg, var(--MI_THEME-panel), color(from var(--MI_THEME-panel) srgb r g b / 0));
}

.bannerStatus {
	position: absolute;
	z-index: 1;
	bottom: 16px;
	right: 16px;
	padding: 8px 12px;
	font-size: 80%;
	background: rgba(0, 0, 0, 0.7);
	border-radius: 6px;
	color: #fff;
}

.description {
	padding: 16px;
}

.sensitiveIndicator {
	position: absolute;
	z-index: 1;
	bottom: 16px;
	left: 16px;
	background: rgba(0, 0, 0, 0.7);
	color: var(--MI_THEME-warn);
	border-radius: 6px;
	font-weight: bold;
	font-size: 1em;
	padding: 4px 7px;
}
</style>
