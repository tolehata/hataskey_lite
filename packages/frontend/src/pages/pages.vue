<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="$i ? headerActions : null" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in pillTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div v-if="tab === 'featured'">
			<MkPagination v-slot="{items}" :paginator="featuredPagesPaginator">
				<div class="_gaps">
					<MkPagePreview v-for="page in items" :key="page.id" :page="page"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'my'" class="_gaps">
			<MkPagination v-slot="{items}" :paginator="myPagesPaginator">
				<div class="_gaps">
					<MkPagePreview v-for="page in items" :key="page.id" :page="page"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'liked'">
			<MkPagination v-slot="{items}" :paginator="likedPagesPaginator">
				<div class="_gaps">
					<MkPagePreview v-for="like in items" :key="like.page.id" :page="like.page"/>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import MkPagePreview from '@/components/MkPagePreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { Paginator } from '@/utility/paginator.js';
import { $i } from '@/i.js';

const router = useRouter();

const tab = ref('featured');

const featuredPagesPaginator = markRaw(new Paginator('pages/featured', {
	noPaging: true,
}));
const myPagesPaginator = markRaw(new Paginator('i/pages', {
	limit: 5,
}));
const likedPagesPaginator = markRaw(new Paginator('i/page-likes', {
	limit: 5,
}));

function create() {
	router.push('/pages/new');
}

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts.create,
	handler: create,
}]);

const headerTabs = computed(() => [{
	key: 'featured',
	title: i18n.ts._pages.featured,
	icon: 'ti ti-flare',
}, {
	key: 'my',
	title: i18n.ts._pages.my,
	icon: 'ti ti-edit',
}, {
	key: 'liked',
	title: i18n.ts._pages.liked,
	icon: 'ti ti-heart',
}]);

const headerTabsWhenNotLogin = computed(() => [{
	key: 'featured',
	title: i18n.ts._pages.featured,
	icon: 'ti ti-flare',
}]);

// 旗鯖fork: ピル型タブ用。ログイン状態に応じてタブを出し分ける
const pillTabs = computed(() => $i ? headerTabs.value : headerTabsWhenNotLogin.value);

definePage(() => ({
	title: i18n.ts.pages,
	icon: 'ti ti-note',
}));
</script>

<style lang="scss" module>
/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
.htkPillTabs {
	position: sticky;
	top: 0;
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
		color: var(--MI_THEME-fgOnAccent);
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}
</style>
