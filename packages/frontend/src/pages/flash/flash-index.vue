<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="$i ? headerActions : null" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in ($i ? headerTabs : headerTabsWhenNotLogin)" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div v-if="tab === 'search'">
			<div class="_gaps">
				<MkInput v-model="searchQuery" :large="true" type="search">
					<template #prefix><i class="ti ti-search"></i></template>
				</MkInput>
				<MkButton large primary gradate rounded style="margin: 0 auto;" @click="search">{{ i18n.ts.search }}</MkButton>
				<MkPagination v-if="searchPaginator" v-slot="{items}" :key="searchKey" :paginator="searchPaginator">
					<div class="_gaps_s">
						<MkFlashPreview v-for="flash in items" :key="flash.id" :flash="flash"/>
					</div>
				</MkPagination>
			</div>
		</div>

		<div v-else-if="tab === 'featured'">
			<MkPagination v-slot="{items}" :paginator="featuredFlashsPaginator">
				<div class="_gaps_s">
					<MkFlashPreview v-for="flash in items" :key="flash.id" :flash="flash"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'my'">
			<div class="_gaps">
				<MkPagination v-slot="{items}" :paginator="myFlashsPaginator">
					<div class="_gaps_s">
						<MkFlashPreview v-for="flash in items" :key="flash.id" :flash="flash"/>
					</div>
				</MkPagination>
			</div>
		</div>

		<div v-else-if="tab === 'liked'">
			<MkPagination v-slot="{items}" :paginator="likedFlashsPaginator" withControl>
				<div class="_gaps_s">
					<MkFlashPreview v-for="like in items" :key="like.flash.id" :flash="like.flash"/>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref, shallowRef } from 'vue';
import type { IPaginator } from '@/utility/paginator.js';
import MkFlashPreview from '@/components/MkFlashPreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { Paginator } from '@/utility/paginator.js';
import { $i } from '@/i.js';

const router = useRouter();

const tab = ref('featured');

const searchQuery = ref('');
const searchPaginator = shallowRef<Paginator<'flash/search'> | null>(null);
const searchKey = ref(0);

const featuredFlashsPaginator = markRaw(new Paginator('flash/featured', {
	limit: 5,
	offsetMode: true,
}));
const myFlashsPaginator = markRaw(new Paginator('flash/my', {
	limit: 5,
}));
const likedFlashsPaginator = markRaw(new Paginator('flash/my-likes', {
	limit: 5,
	canSearch: true,
	searchParamName: 'search',
}));

function create() {
	router.push('/play/new');
}

function search() {
	if (searchQuery.value.trim() === '') {
		return;
	}

	searchPaginator.value = markRaw(new Paginator('flash/search', {
		params: {
			query: searchQuery.value,
		},
	}));

	searchKey.value++;
}

const headerActions = computed(() => [{
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
	title: i18n.ts._play.featured,
	icon: 'ti ti-flare',
}, {
	key: 'my',
	title: i18n.ts._play.my,
	icon: 'ti ti-edit',
}, {
	key: 'liked',
	title: i18n.ts._play.liked,
	icon: 'ti ti-heart',
}]);

const headerTabsWhenNotLogin = computed(() => [{
	key: 'featured',
	title: i18n.ts._play.featured,
	icon: 'ti ti-flare',
}]);

definePage(() => ({
	title: 'Play',
	icon: 'ti ti-player-play',
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
