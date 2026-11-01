<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div class="htk-pill-tabs">
		<div class="htk-pill-tabs-inner">
			<button v-for="t in headerTabs" :key="t.key" class="htk-pill-tab" :class="{ active: tab === t.key }" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div :key="tab" class="_spacer" style="--MI_SPACER-w: 800px;">
		<MkPagination :paginator="paginator">
			<template #empty><MkResult type="empty" :text="i18n.ts.noFollowRequests"/></template>
			<template #default="{items}">
				<div class="mk-follow-requests _gaps">
					<div v-for="req in items" :key="req.id" class="user _panel">
						<MkAvatar class="avatar" :user="displayUser(req)" indicator link preview/>
						<div class="body">
							<div class="name">
								<MkA v-user-preview="displayUser(req).id" class="name" :to="userPage(displayUser(req))"><MkUserName :user="displayUser(req)"/></MkA>
								<p class="acct">@{{ acct(displayUser(req)) }}</p>
							</div>
							<div v-if="tab === 'list'" class="commands">
								<MkButton class="command" rounded primary @click="accept(displayUser(req))"><i class="ti ti-check"/> {{ i18n.ts.accept }}</MkButton>
								<MkButton class="command" rounded danger @click="reject(displayUser(req))"><i class="ti ti-x"/> {{ i18n.ts.reject }}</MkButton>
							</div>
							<div v-else class="commands">
								<MkButton class="command" rounded danger @click="cancel(displayUser(req))"><i class="ti ti-x"/> {{ i18n.ts.cancel }}</MkButton>
							</div>
						</div>
					</div>
				</div>
			</template>
		</MkPagination>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { computed, markRaw, ref, watch } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import { userPage, acct } from '@/filters/user.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { $i } from '@/i.js';
import { Paginator } from '@/utility/paginator.js';

const tab = ref($i?.isLocked ? 'list' : 'sent');

let paginator: Paginator<'following/requests/list' | 'following/requests/sent'>;

watch(tab, (newTab) => {
	if (newTab === 'list') {
		paginator = markRaw(new Paginator('following/requests/list', { limit: 10 }));
	} else {
		paginator = markRaw(new Paginator('following/requests/sent', { limit: 10 }));
	}
}, { immediate: true });

function accept(user: Misskey.entities.UserLite) {
	os.apiWithDialog('following/requests/accept', { userId: user.id }).then(() => {
		paginator.reload();
	});
}

function reject(user: Misskey.entities.UserLite) {
	os.apiWithDialog('following/requests/reject', { userId: user.id }).then(() => {
		paginator.reload();
	});
}

function cancel(user: Misskey.entities.UserLite) {
	os.apiWithDialog('following/requests/cancel', { userId: user.id }).then(() => {
		paginator.reload();
	});
}

function displayUser(req) {
	return tab.value === 'list' ? req.follower : req.followee;
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [
	{
		key: 'list',
		title: i18n.ts._followRequest.recieved,
		icon: 'ti ti-download',
	}, {
		key: 'sent',
		title: i18n.ts._followRequest.sent,
		icon: 'ti ti-upload',
	},
]);

definePage(() => ({
	title: i18n.ts.followRequests,
	icon: 'ti ti-user-plus',
}));
</script>

<style lang="scss" scoped>
/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
.htk-pill-tabs {
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

.htk-pill-tabs-inner {
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

.htk-pill-tab {
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

	&.active {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}

	> i {
		font-size: 1em;
		line-height: 1;
	}
}

.mk-follow-requests {
	> .user {
		display: flex;
		padding: 16px;

		> .avatar {
			display: block;
			flex-shrink: 0;
			margin: 0 12px 0 0;
			width: 42px;
			height: 42px;
			border-radius: 8px;
		}

		> .body {
			display: flex;
			width: calc(100% - 54px);
			position: relative;
			flex-wrap: wrap;
			gap: 8px;

			> .name {
				flex: 1 1 50%;

				> .name,
				> .acct {
					display: block;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					margin: 0;
				}

				> .name {
					line-height: 24px;
				}

				> .acct {
					line-height: 16px;
					opacity: 0.7;
				}
			}

			> .description {
				width: 55%;
				line-height: 42px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				opacity: 0.7;
				padding-right: 40px;
				padding-left: 8px;
				box-sizing: border-box;

				@media (max-width: 500px) {
					display: none;
				}
			}

			> .commands {
				display: flex;
				gap: 8px;
			}

			> .actions {
				position: absolute;
				top: 0;
				bottom: 0;
				right: 0;
				margin: auto 0;

				> button {
					padding: 12px;
				}
			}
		}
	}
}
</style>
