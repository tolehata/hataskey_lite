<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="[]" :tabs="[]" :user="user" :swipable="true" :disableFollowButton="tab === 'home'">
	<div v-if="user">
		<!-- 旗鯖fork: プロフィールタブをピルケース型に (Hataskey UI 統一デザイン) -->
		<div :class="$style.htkPillTabs">
			<div :class="$style.htkPillTabsInner" @wheel="onPillWheel">
				<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
					<i v-if="t.icon" :class="t.icon"></i>
					<span>{{ t.title }}</span>
				</button>
			</div>
		</div>
		<XHome v-if="tab === 'home'" :user="user" :refreshUser="refreshUser" @showMoreFiles="() => { tab = 'files'; }"/>
		<XNotes v-else-if="tab === 'notes'" :user="user"/>
		<XFiles v-else-if="tab === 'files'" :user="user"/>
		<XEvent v-else-if="tab === 'events'" :user="user"/>
		<XActivity v-else-if="tab === 'activity'" :user="user"/>
		<XAchievements v-else-if="tab === 'achievements'" :user="user"/>
		<!-- <XReactions v-else-if="tab === 'reactions'" :user="user"/> -->
		<XClips v-else-if="tab === 'clips'" :user="user"/>
		<XLists v-else-if="tab === 'lists'" :user="user"/>
		<XPages v-else-if="tab === 'pages'" :user="user"/>
		<XFlashs v-else-if="tab === 'flashs'" :user="user"/>
		<XGallery v-else-if="tab === 'gallery'" :user="user"/>
		<XRaw v-else-if="tab === 'raw'" :user="user"/>
	</div>
	<MkError v-else-if="error" @retry="fetchUser()"/>
	<MkLoading v-else/>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, watch, ref, onUnmounted } from 'vue';
import * as Misskey from 'cherrypick-js';
import * as os from '@/os.js';
import { acct as getAcct } from '@/filters/user.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { getUserMenu } from '@/utility/get-user-menu.js';
import { useRouter } from '@/router.js';
import { deviceKind } from '@/utility/device-kind.js';
import { serverContext, assertServerContext } from '@/server-context.js';

const MOBILE_THRESHOLD = 500;
const router = useRouter();

const isMobile = ref(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);
const handleResize = () => {
	isMobile.value = deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD;
};

window.addEventListener('resize', handleResize);

const XHome = defineAsyncComponent(() => import('./home.vue'));
const XNotes = defineAsyncComponent(() => import('./notes.vue'));
const XFiles = defineAsyncComponent(() => import('./files.vue'));
const XEvent = defineAsyncComponent(() => import('./events.vue'));
const XActivity = defineAsyncComponent(() => import('./activity.vue'));
const XAchievements = defineAsyncComponent(() => import('./achievements.vue'));
//const XReactions = defineAsyncComponent(() => import('./reactions.vue'));
const XClips = defineAsyncComponent(() => import('./clips.vue'));
const XLists = defineAsyncComponent(() => import('./lists.vue'));
const XPages = defineAsyncComponent(() => import('./pages.vue'));
const XFlashs = defineAsyncComponent(() => import('./flashs.vue'));
const XGallery = defineAsyncComponent(() => import('./gallery.vue'));
const XRaw = defineAsyncComponent(() => import('./raw.vue'));

// contextは非ログイン状態の情報しかないためログイン時は利用できない
const CTX_USER = !$i && assertServerContext(serverContext, 'user') ? serverContext.user : null;

const props = withDefaults(defineProps<{
	acct: string;
	page?: string;
}>(), {
	page: 'home',
});

const tab = ref(props.page);

const user = ref<null | Misskey.entities.UserDetailed>(CTX_USER);
const error = ref<any>(null);

function fetchUser(): void {
	if (props.acct == null) return;

	const { username, host } = Misskey.acct.parse(props.acct);

	if (CTX_USER && CTX_USER.username === username && CTX_USER.host === host) {
		user.value = CTX_USER;
		return;
	}

	user.value = null;
	misskeyApi('users/show', {
		username,
		host,
	}).then(u => {
		user.value = u;
	}).catch(err => {
		error.value = err;
	});
}

watch(() => props.acct, fetchUser, {
	immediate: true,
});

async function refreshUser(): Promise<void> {
	if (props.acct == null) return;
	const { username, host } = Misskey.acct.parse(props.acct);
	user.value = await misskeyApi('users/show', { username, host });
}

onUnmounted(() => {
	window.removeEventListener('resize', handleResize);
});

const headerActions = computed(() => [{
	icon: 'ti ti-dots',
	text: i18n.ts.menu,
	handler: menu,
}]);

const headerTabs = computed(() => user.value ? [{
	key: 'home',
	title: i18n.ts.overview,
	icon: 'ti ti-home',
}, ...(!user.value.isBlocked ? [{
	key: 'notes',
	title: i18n.ts.notes,
	icon: 'ti ti-pencil',
}, {
	key: 'files',
	title: i18n.ts.files,
	icon: 'ti ti-photo',
}, {
	key: 'events',
	title: i18n.ts.events,
	icon: 'ti ti-calendar',
}, {
	key: 'activity',
	title: i18n.ts.activity,
	icon: 'ti ti-chart-line',
}, ...(user.value.host == null ? [{
	key: 'achievements',
	title: i18n.ts.achievements,
	icon: 'ti ti-medal',
}] : []), {
	key: 'clips',
	title: i18n.ts.clips,
	icon: 'ti ti-paperclip',
}, {
	key: 'lists',
	title: i18n.ts.lists,
	icon: 'ti ti-list',
}, {
	key: 'pages',
	title: i18n.ts.pages,
	icon: 'ti ti-news',
}, {
	key: 'flashs',
	title: 'Play',
	icon: 'ti ti-player-play',
}, {
	key: 'gallery',
	title: i18n.ts.gallery,
	icon: 'ti ti-icons',
}] : []), {
	key: 'raw',
	title: 'Raw',
	icon: 'ti ti-code',
}] : []);

function menu(ev) {
	if (!user.value) return;
	const { menu, cleanup } = getUserMenu(user.value, router);
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(cleanup);
}

// 旗鯖fork: タブが多くPC(マウスホイール)で横スクロールしづらいため、
// 縦ホイールを横スクロールに変換する。横スクロール余地があるときだけ既定動作を奪う。
function onPillWheel(ev: WheelEvent) {
	const el = ev.currentTarget as HTMLElement;
	if (el.scrollWidth <= el.clientWidth) return; // スクロール不要なら何もしない
	if (ev.deltaY === 0) return;
	el.scrollLeft += ev.deltaY;
	ev.preventDefault();
}

definePage(() => ({
	title: i18n.ts.user,
	icon: 'ti ti-user',
	...user.value ? {
		title: user.value.name ? `${user.value.name} (@${user.value.username})` : `@${user.value.username}`,
		subtitle: `@${getAcct(user.value)}`,
		userName: user.value,
		avatar: user.value,
		path: `/@${user.value.username}`,
		share: {
			title: user.value.name,
		},
	} : {},
}));
</script>

<style lang="scss" module>
/* 旗鯖fork: ピル型タブ (Hataskey UI 統一デザイン) */
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
</style>
