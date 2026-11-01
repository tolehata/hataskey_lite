<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="$i ? headerActions : null" :tabs="[]" :swipable="true" displayMyAvatar>
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン、ログイン状態で表示切替)。
	     ウィンドウモード (デッキUIのウィンドウ表示) 等の狭幅でタブが収まらない時、マウスホイールの
	     縦回転を横スクロールに変換 + タブバー上のドラッグでも横スクロールできるようにする。 -->
	<div :class="$style.htkPillTabs">
		<div
			ref="pillTabsInnerEl"
			:class="$style.htkPillTabsInner"
			@wheel="onPillTabsWheel"
			@pointerdown="onPillTabsPointerDown"
		>
			<button v-for="t in ($i ? headerTabs : headerTabsWhenNotLogin)" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 1200px;">
		<div v-if="tab === 'search'" :class="$style.searchRoot">
			<div class="_gaps">
				<!-- 旗鯖fork: 検索ページと同様の一体型カプセル検索バー -->
				<div :class="$style.htkCapsule">
					<i :class="$style.htkCapsuleIcon" class="ti ti-search"/>
					<input
						ref="searchQueryEl"
						v-model="searchQuery"
						type="search"
						:class="$style.htkCapsuleInput"
						:placeholder="i18n.ts.search"
						:autofocus="true"
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
				<MkRadios v-model="searchType" @update:modelValue="search()">
					<option value="nameAndDescription">{{ i18n.ts._channel.nameAndDescription }}</option>
					<option value="nameOnly">{{ i18n.ts._channel.nameOnly }}</option>
				</MkRadios>
			</div>

			<MkFoldableSection v-if="channelPaginator">
				<template #header>{{ i18n.ts.searchResult }}</template>
				<MkChannelList :key="key" :paginator="channelPaginator"/>
			</MkFoldableSection>
		</div>
		<div v-if="tab === 'featured'">
			<MkPagination v-slot="{items}" :paginator="featuredPaginator">
				<div :class="$style.root">
					<MkChannelPreview v-for="channel in items" :key="channel.id" :channel="channel"/>
				</div>
			</MkPagination>
		</div>
		<div v-else-if="tab === 'favorites'">
			<MkPagination v-slot="{items}" :paginator="favoritesPaginator">
				<div :class="$style.root">
					<MkChannelPreview v-for="channel in items" :key="channel.id" :channel="channel"/>
				</div>
			</MkPagination>
		</div>
		<div v-else-if="tab === 'following'">
			<MkPagination v-slot="{items}" :paginator="followingPaginator">
				<div :class="$style.root">
					<MkChannelPreview v-for="channel in items" :key="channel.id" :channel="channel"/>
				</div>
			</MkPagination>
		</div>
		<div v-else-if="tab === 'owned'">
			<MkButton class="new" @click="create()"><i class="ti ti-plus"></i></MkButton>
			<MkPagination v-slot="{items}" :paginator="ownedPaginator">
				<div :class="$style.root">
					<MkChannelPreview v-for="channel in items" :key="channel.id" :channel="channel"/>
				</div>
			</MkPagination>
		</div>
		<!-- 旗鯖fork: 管理者専用「すべて」タブ。プライベート含む全チャンネルを横断閲覧 + フィルタ -->
		<div v-else-if="tab === 'adminAll'">
			<div :class="$style.adminFilterRow">
				<MkRadios v-model="adminFilter" @update:modelValue="reloadAdminAll()">
					<option value="all">{{ copy.filterAll }}</option>
					<option value="public">{{ copy.filterPublic }}</option>
					<option value="private">{{ copy.filterPrivate }}</option>
					<option value="archived">{{ copy.filterArchived }}</option>
				</MkRadios>
			</div>
			<MkPagination v-slot="{items}" :key="adminAllKey" :paginator="adminAllPaginator">
				<div :class="$style.root">
					<MkChannelPreview v-for="channel in items" :key="channel.id" :channel="channel"/>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, onMounted, ref, shallowRef, useTemplateRef } from 'vue';
import MkChannelPreview from '@/components/MkChannelPreview.vue';
import MkChannelList from '@/components/MkChannelList.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkInput from '@/components/MkInput.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkButton from '@/components/MkButton.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { useRouter } from '@/router.js';
import { Paginator } from '@/utility/paginator.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const router = useRouter();
const copy = i18n.ts._hata._privateChannels;

const props = defineProps<{
	query: string;
	type?: string;
}>();

const key = ref('');
// 旗鯖fork(#5): ログイン時はフォロー中チャンネル一覧を既定タブにする(未ログイン時は following タブが無いので featured)。
const tab = ref($i ? 'following' : 'featured');
const searchQuery = ref('');
const searchType = ref('nameAndDescription');
const channelPaginator = shallowRef();

const searchQueryEl = useTemplateRef('searchQueryEl');

// 旗鯖fork: ピルタブの横スクロール制御 (ウィンドウモード等の狭幅対応)。
const pillTabsInnerEl = useTemplateRef('pillTabsInnerEl');
function onPillTabsWheel(ev: WheelEvent) {
	const el = pillTabsInnerEl.value;
	if (!el) return;
	if (el.scrollWidth <= el.clientWidth) return;
	const delta = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
	if (delta === 0) return;
	const atStart = el.scrollLeft <= 0;
	const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
	if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
	ev.preventDefault();
	el.scrollLeft += delta;
}
let pillDragging = false;
let pillDragStartX = 0;
let pillDragStartScroll = 0;
function onPillTabsPointerDown(ev: PointerEvent) {
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

onMounted(() => {
	searchQuery.value = props.query ?? '';
	searchType.value = props.type ?? 'nameAndDescription';
});

const featuredPaginator = markRaw(new Paginator('channels/featured', {
	limit: 10,
	noPaging: true,
}));
const favoritesPaginator = markRaw(new Paginator('channels/my-favorites', {
	limit: 100,
	noPaging: true,
}));
const followingPaginator = markRaw(new Paginator('channels/followed', {
	limit: 10,
}));
const ownedPaginator = markRaw(new Paginator('channels/owned', {
	limit: 10,
}));

// 旗鯖fork: 管理者専用「すべて」タブ。フィルタ変更時は paginator を作り直して再取得する。
const adminFilter = ref<'all' | 'public' | 'private' | 'archived'>('all');
const adminAllKey = ref(0);
function buildAdminAllPaginator() {
	// 旗鯖fork: admin/channels/list は新規エンドポイントで cherrypick-js SDK 型が未生成のため as any。
	// SDK 再生成 (pnpm build-cherrypick-js-with-types) 後はリテラル型として解決される。
	return markRaw(new Paginator('admin/channels/list' as any, {
		limit: 30,
		params: () => ({ filter: adminFilter.value }),
	} as any));
}
const adminAllPaginator = shallowRef(buildAdminAllPaginator());
function reloadAdminAll() {
	adminAllPaginator.value = buildAdminAllPaginator();
	adminAllKey.value++;
}

async function search() {
	const query = searchQuery.value.toString().trim();

	if (query == null) return;

	const type = searchType.value.toString().trim();

	if (type !== 'nameAndDescription' && type !== 'nameOnly') {
		console.error(`Unrecognized search type: ${type}`);
		return;
	}

	channelPaginator.value = markRaw(new Paginator('channels/search', {
		limit: 10,
		params: {
			query: searchQuery.value,
			type: type,
		},
	}));

	key.value = query + type;
}

function create() {
	router.push('/channels/new');
}

// 旗鯖fork: あいことば(キーフレーズ)だけでプライベートチャンネルに参加する
async function joinByPassword() {
	const { canceled, result: password } = await os.inputText({
		title: copy.joinWithPassphrase,
		text: copy.passphrasePrompt,
		placeholder: copy.passphraseExample,
		default: '',
	});
	if (canceled || password == null || password === '') return;

	try {
		const ch = await misskeyApi('channels/join', { password });
		os.success();
		router.push('/channels/:channelId', { params: { channelId: ch.id } });
	} catch (err) {
		os.alert({ type: 'error', text: copy.noMatchingChannel });
	}
}

const headerActions = computed(() => [{
	icon: 'ti ti-door-enter',
	text: copy.joinWithPassphrase,
	handler: joinByPassword,
}, {
	icon: 'ti ti-plus',
	text: i18n.ts.create,
	handler: create,
}]);

const headerTabs = computed(() => [{
	key: 'search',
	title: i18n.ts.search,
	icon: 'ti ti-search',
}, {
	key: 'featured',
	title: i18n.ts._channel.featured,
	icon: 'ti ti-comet',
}, {
	key: 'favorites',
	title: i18n.ts.favorites,
	icon: 'ti ti-star',
}, {
	key: 'following',
	title: i18n.ts._channel.following,
	icon: 'ti ti-eye',
}, {
	key: 'owned',
	title: i18n.ts._channel.owned,
	icon: 'ti ti-edit',
},
// 旗鯖fork: 管理者/モデレーターのみ「全チャンネル」タブを表示 (プライベート含む全件をモデレーション目的で閲覧)
...(($i?.isAdmin || $i?.isModerator) ? [{
	key: 'adminAll',
	title: copy.allChannels,
	icon: 'ti ti-shield-cog',
}] : [])]);

const headerTabsWhenNotLogin = computed(() => [{
	key: 'search',
	title: i18n.ts.search,
	icon: 'ti ti-search',
}, {
	key: 'featured',
	title: i18n.ts._channel.featured,
	icon: 'ti ti-comet',
}]);

definePage(() => ({
	title: i18n.ts.channel,
	icon: 'ti ti-device-tv',
}));
</script>

<style lang="scss" module>
.searchRoot {
	width: 100%;
	max-width: 700px;
	margin: 0 auto;
}

.root {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
	gap: var(--MI-margin);
}

/* 旗鯖fork: 管理者「すべて」タブのフィルタ行 */
.adminFilterRow {
	margin-bottom: 14px;
}

.deleteBtn {
	position: relative;
	z-index: 2;
	margin: 0 auto;
	border: none;
	background: none;
	color: inherit;
	font-size: 0.8em;
	cursor: pointer;
	pointer-events: auto;
	-webkit-tap-highlight-color: transparent;
}

/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
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

	&::-webkit-scrollbar {
		display: none;
	}
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

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}

	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		/* 旗鯖fork: #fff ハードコード。テーマで --MI_THEME-fgOnAccent が未定義の場合、
		   色が親から継承されアクセント色と混ざり文字が潰れる問題を回避。 */
		color: #fff;
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}

/* 旗鯖fork: 検索ページと同様の一体型カプセル検索バー */
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

.htkCapsuleIcon {
	font-size: 1.1em;
	opacity: 0.6;
	flex-shrink: 0;
}

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

	&::placeholder {
		color: color(from var(--MI_THEME-fg) srgb r g b / 0.5);
	}
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

	&:hover {
		opacity: 1;
		background: color(from var(--MI_THEME-fg) srgb r g b / 0.08);
	}
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

	&:hover {
		filter: brightness(1.08);
	}

	&:active {
		transform: scale(0.96);
	}
}
</style>
