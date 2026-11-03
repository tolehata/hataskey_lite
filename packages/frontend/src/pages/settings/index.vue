<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px; --MI_SPACER-min: 20px; --MI_SPACER-max: 32px;">
		<div ref="el" class="vvcocwet" :class="{ wide: !narrow }">
			<div class="body">
				<div v-if="!narrow || currentPage?.route.name == null" class="nav">
					<div class="_gaps_s">
						<MkInfo v-if="emailNotConfigured" warn class="info">{{ i18n.ts.emailNotConfiguredWarning }} <MkA to="/settings/email" class="_link">{{ i18n.ts.configure }}</MkA></MkInfo>
						<MkInfo v-if="!store.r.enablePreferencesAutoCloudBackup.value && store.r.showPreferencesAutoCloudBackupSuggestion.value" class="info">
							<div>{{ i18n.ts._preferencesBackup.autoPreferencesBackupIsNotEnabledForThisDevice }}</div>
							<div><button class="_textButton" @click="enableAutoBackup">{{ i18n.ts.enable }}</button> | <button class="_textButton" @click="skipAutoBackup">{{ i18n.ts.skip }}</button></div>
						</MkInfo>
						<!-- 旗鯖fork: プロフィールボタン再設計 (左=プロフィール / 右=旗鯖独自機能) -->
						<div v-if="$i" :class="$style.htkProfileRow">
							<MkA :to="'/settings/profile'" :class="[$style.htkProfileBtn, { [$style.htkProfileBtnActive]: currentPage?.route.name === 'profile' }]">
								<MkAvatar :class="$style.htkProfileAvatar" :user="$i" :link="false"/>
								<div :class="$style.htkProfileText">
									<div :class="$style.htkProfileName"><Mfm :text="$i.name || $i.username" :plain="true" :nyaize="false"/></div>
									<div :class="$style.htkProfileId">@{{ $i.username }}</div>
								</div>
							</MkA>
							<MkA :to="'/settings/hata-custom'" :class="[$style.htkHataBtn, { [$style.htkHataBtnActive]: currentPage?.route.name === 'hata-custom' }]">
								<!-- Hataskey fork: Hataskey独自機能入口だけハタキュイラスト(treasureFound)にして目立たせる。
								     ⚠️利用者がハタキュ表示をOFFにしたときは元の Tabler アイコンへ戻す。 -->
								<MkHatakyuIllustration v-if="useHatakyuBranding()" asset="treasureFound" :size="28"/>
								<i v-else class="ti ti-flag"></i>
								<span>{{ i18n.ts._hata._common.customFeatures }}</span>
							</MkA>
						</div>
						<MkSuperMenu :def="menuDef" :grid="narrow" :searchIndex="searchIndex"></MkSuperMenu>
					</div>
				</div>
				<div v-if="!(narrow && currentPage?.route.name == null)" class="main">
					<div style="container-type: inline-size;">
						<NestedRouterView/>
					</div>
				</div>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { PageMetadata } from '@/page.js';
import type { SuperMenuDef } from '@/components/MkSuperMenu.vue';
import { i18n } from '@/i18n.js';
import MkInfo from '@/components/MkInfo.vue';
import MkSuperMenu from '@/components/MkSuperMenu.vue';
import MkHatakyuIllustration from '@/components/MkHatakyuIllustration.vue';
import { useHatakyuBranding } from '@/utility/hatakyu-assets.js';
import { $i } from '@/i.js';
import { clearCache } from '@/utility/clear-cache.js';
import { instance } from '@/instance.js';
import { definePage, provideMetadataReceiver, provideReactiveMetadata } from '@/page.js';
import * as os from '@/os.js';
import { useRouter } from '@/router.js';
import { enableAutoBackup, getPreferencesProfileMenu } from '@/preferences/utility.js';
import { store } from '@/store.js';
import { signout, signoutAll } from '@/signout.js';
import { genSearchIndexes } from '@/utility/inapp-search.js';

const searchIndex = await import('search-index:settings').then(({ searchIndexes }) => genSearchIndexes(searchIndexes));

const indexInfo = {
	title: i18n.ts.settings,
	icon: 'ti ti-settings',
	hideHeader: true,
};
const INFO = ref<PageMetadata>(indexInfo);
const el = useTemplateRef('el');
const childInfo = ref<null | PageMetadata>(null);

const router = useRouter();

const narrow = ref(false);
const NARROW_THRESHOLD = 600;

const currentPage = computed(() => router.currentRef.value.child);

const ro = new ResizeObserver((entries, observer) => {
	if (entries.length === 0) return;
	narrow.value = entries[0].borderBoxSize[0].inlineSize < NARROW_THRESHOLD;
});

function skipAutoBackup() {
	store.set('showPreferencesAutoCloudBackupSuggestion', false);
}

// Hataskey fork: メニュー項目にハタキュイラストを割り当てる。
//   icon (Tabler) は検索インデックス等で使われている可能性があるため残したまま、
//   表示用の hatakyuAsset だけを追加する(MkSuperMenu 側で hatakyuAsset 優先描画)。
//   即時操作・破壊的操作の項目(プロフィール/設定プロファイル/キャッシュ削除/ログアウト/全端末ログアウト)には付けない。
const menuDef = computed<SuperMenuDef[]>(() => [{
	items: [{
		icon: 'ti ti-lock-open',
		hatakyuAsset: 'showingKey',
		text: i18n.ts.privacy,
		to: '/settings/privacy',
		active: currentPage.value?.route.name === 'privacy',
	}, {
		icon: 'ti ti-bell',
		hatakyuAsset: 'waving',
		text: i18n.ts.notifications,
		to: '/settings/notifications',
		active: currentPage.value?.route.name === 'notifications',
	}, {
		icon: 'ti ti-mail',
		hatakyuAsset: 'reviewingDocuments',
		text: i18n.ts.email,
		to: '/settings/email',
		active: currentPage.value?.route.name === 'email',
	}, {
		icon: 'ti ti-lock',
		hatakyuAsset: 'showingId',
		text: i18n.ts.security,
		to: '/settings/security',
		active: currentPage.value?.route.name === 'security',
	}],
}, {
	items: [{
		icon: 'ti ti-adjustments',
		hatakyuAsset: 'wrench',
		text: i18n.ts.preferences,
		to: '/settings/preferences',
		active: currentPage.value?.route.name === 'preferences',
	}, {
		icon: 'ti ti-palette',
		hatakyuAsset: 'stargazing',
		text: i18n.ts.theme,
		to: '/settings/theme',
		active: currentPage.value?.route.name === 'theme',
	}, {
		icon: 'ti ti-mood-happy',
		hatakyuAsset: 'heartHands',
		text: i18n.ts.emojiPalette,
		to: '/settings/emoji-palette',
		active: currentPage.value?.route.name === 'emoji-palette',
	}, {
		icon: 'ti ti-music',
		hatakyuAsset: 'chatting',
		text: i18n.ts.sounds,
		to: '/settings/sounds',
		active: currentPage.value?.route.name === 'sounds',
	}, {
		icon: 'ti ti-plug',
		hatakyuAsset: 'wrenchAlt',
		text: i18n.ts.plugins,
		to: '/settings/plugin',
		active: currentPage.value?.route.name === 'plugin',
	}],
}, {
	items: [{
		icon: 'ti ti-cloud',
		hatakyuAsset: 'packingBox',
		text: i18n.ts.drive,
		to: '/settings/drive',
		active: currentPage.value?.route.name === 'drive',
	}, {
		icon: 'ti ti-ban',
		hatakyuAsset: 'refusing',
		text: i18n.ts.muteAndBlock,
		to: '/settings/mute-block',
		active: currentPage.value?.route.name === 'mute-block',
	}, {
		icon: 'ti ti-link',
		hatakyuAsset: 'computerChat',
		text: i18n.ts._settings.serviceConnection,
		to: '/settings/connect',
		active: currentPage.value?.route.name === 'connect',
	}, {
		icon: 'ti ti-package',
		hatakyuAsset: 'unpackingBox',
		text: i18n.ts._settings.accountData,
		to: '/settings/account-data',
		active: currentPage.value?.route.name === 'account-data',
	}, {
		icon: 'ti ti-dots',
		hatakyuAsset: 'questioning',
		text: i18n.ts.other,
		to: '/settings/other',
		active: currentPage.value?.route.name === 'other',
        }],
}, {
	items: [{
		type: 'button',
		icon: 'ti ti-settings-2',
		text: i18n.ts.preferencesProfile,
		action: async (ev: MouseEvent) => {
			os.popupMenu(getPreferencesProfileMenu(), ev.currentTarget ?? ev.target);
		},
	}, {
		type: 'button',
		icon: 'ti ti-trash',
		text: i18n.ts.clearCache,
		action: async () => {
			await clearCache();
		},
	}, {
		type: 'button',
		icon: 'ti ti-logout',
		text: i18n.ts.logout,
		action: async () => {
			const { canceled } = await os.confirm({
				type: 'warning',
				title: i18n.ts.logoutConfirm,
				text: i18n.ts.logoutWillClearClientData,
			});
			if (canceled) return;
			signout();
		},
		danger: true,
	}, {
		type: 'button',
		icon: 'ti ti-power',
		text: i18n.ts.logoutAll,
		action: async () => {
			const { canceled } = await os.confirm({
				type: 'warning',
				title: i18n.ts.logoutAllConfirm,
				text: i18n.ts.logoutWillClearClientData,
			});
			if (canceled) return;
			signoutAll();
		},
		danger: true,
	}],
}]);

onMounted(() => {
	if (el.value == null) return; // TSを黙らすため

	ro.observe(el.value);

	narrow.value = el.value.offsetWidth < NARROW_THRESHOLD;

	if (!narrow.value && currentPage.value?.route.name == null) {
		router.replace('/settings/profile');
	}
});

onActivated(() => {
	if (el.value == null) return; // TSを黙らすため

	narrow.value = el.value.offsetWidth < NARROW_THRESHOLD;

	if (!narrow.value && currentPage.value?.route.name == null) {
		router.replace('/settings/profile');
	}
});

onUnmounted(() => {
	ro.disconnect();
});

watch(router.currentRef, (to) => {
	if (to.route.name === 'settings' && to.child?.route.name == null && !narrow.value) {
		router.replace('/settings/profile');
	}
});

const emailNotConfigured = computed(() => $i && instance.enableEmail && ($i.email == null || !$i.emailVerified));

provideMetadataReceiver((metadataGetter) => {
	const info = metadataGetter();
	if (info == null) {
		childInfo.value = null;
	} else {
		childInfo.value = info;
		INFO.value.needWideArea = info.needWideArea ?? undefined;
	}
});
provideReactiveMetadata(INFO);

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => INFO.value);
// w 890
// h 700
</script>

<style lang="scss" scoped>
.vvcocwet {
	&.wide {
		> .body {
			display: flex;
			height: 100%;

			> .nav {
				width: 34%;
				padding-right: 32px;
				box-sizing: border-box;
			}

			> .main {
				flex: 1;
				min-width: 0;
			}
		}
	}
}
</style>

<style lang="scss" module>
/* 旗鯖fork: プロフィールボタン再設計 (左=プロフィール / 右=旗鯖独自機能) */
.htkProfileRow {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: stretch;
}

.htkProfileBtn {
	flex: 1 1 200px;
	min-width: 0;
	overflow: hidden;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 14px;
	text-decoration: none;
	color: var(--MI_THEME-fg);
	transition: border-color 0.15s, background 0.15s;

	&:hover {
		border-color: var(--MI_THEME-accent);
		text-decoration: none;
	}

	&.htkProfileBtnActive {
		border-color: var(--MI_THEME-accent);
		background: var(--MI_THEME-accentedBg);
	}
}

.htkProfileAvatar {
	width: 44px;
	height: 44px;
	flex-shrink: 0;
}

.htkProfileText {
	flex: 1 1 0;
	min-width: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 2px;
}

.htkProfileName {
	font-weight: 700;
	font-size: 0.95em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.htkProfileId {
	font-size: 0.8em;
	opacity: 0.6;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.htkHataBtn {
	flex: 1 1 auto;
	min-width: 96px;
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	width: 92px;
	padding: 10px 8px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 14px;
	cursor: pointer;
	color: var(--MI_THEME-fg);
	font-family: inherit;
	font-size: 0.78em;
	text-align: center;
	text-decoration: none;
	transition: border-color 0.15s, background 0.15s;

	&:hover {
		border-color: var(--MI_THEME-accent);
		text-decoration: none;
	}

	&.htkHataBtnActive {
		border-color: var(--MI_THEME-accent);
		background: var(--MI_THEME-accentedBg);
	}

	i {
		font-size: 1.2em;
	}
}
</style>
