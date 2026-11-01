<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="$i ? headerActions : null" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: ヘッダタブを廃止し、他ページと統一したピル型タブを body 上部に配置 -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in ($i ? headerTabs : headerTabsWhenNotLogin)" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 1400px;">
		<div v-if="tab === 'explore'">
			<MkFoldableSection class="_margin">
				<template #header><i class="ti ti-clock"></i>{{ i18n.ts.recentPosts }}</template>
				<MkPagination v-slot="{items}" :paginator="recentPostsPaginator">
					<div :class="$style.items">
						<MkGalleryPostPreview v-for="post in items" :key="post.id" :post="post" class="post"/>
					</div>
				</MkPagination>
			</MkFoldableSection>
			<MkFoldableSection class="_margin">
				<template #header><i class="ti ti-comet"></i>{{ i18n.ts.popularPosts }}</template>
				<MkPagination v-slot="{items}" :paginator="popularPostsPaginator">
					<div :class="$style.items">
						<MkGalleryPostPreview v-for="post in items" :key="post.id" :post="post" class="post"/>
					</div>
				</MkPagination>
			</MkFoldableSection>
		</div>
		<div v-else-if="tab === 'liked'">
			<MkPagination v-slot="{items}" :paginator="likedPostsPaginator">
				<div :class="$style.items">
					<MkGalleryPostPreview v-for="like in items" :key="like.id" :post="like.post" class="post"/>
				</div>
			</MkPagination>
		</div>
		<div v-else-if="tab === 'my'">
			<MkPagination v-slot="{items}" :paginator="myPostsPaginator">
				<div :class="$style.items">
					<MkGalleryPostPreview v-for="post in items" :key="post.id" :post="post" class="post"/>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { watch, ref, computed, markRaw } from 'vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkGalleryPostPreview from '@/components/MkGalleryPostPreview.vue';
import { definePage } from '@/page.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { useRouter } from '@/router.js';
import { Paginator } from '@/utility/paginator.js';

const router = useRouter();

const props = defineProps<{
	tag?: string;
}>();

const tab = ref('explore');
const tagsRef = ref();

const recentPostsPaginator = markRaw(new Paginator('gallery/posts', {
	limit: 6,
}));
const popularPostsPaginator = markRaw(new Paginator('gallery/featured', {
	noPaging: true,
}));
const myPostsPaginator = markRaw(new Paginator('i/gallery/posts', {
	limit: 5,
}));
const likedPostsPaginator = markRaw(new Paginator('i/gallery/likes', {
	limit: 5,
}));

watch(() => props.tag, () => {
	if (tagsRef.value) tagsRef.value.tags.toggleContent(props.tag == null);
});

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts.postToGallery,
	handler: () => {
		router.push('/gallery/new');
	},
}]);

const headerTabs = computed(() => [{
	key: 'explore',
	title: i18n.ts.gallery,
	icon: 'ti ti-icons',
}, {
	key: 'liked',
	title: i18n.ts._gallery.liked,
	icon: 'ti ti-heart',
}, {
	key: 'my',
	title: i18n.ts._gallery.my,
	icon: 'ti ti-edit',
}]);

const headerTabsWhenNotLogin = computed(() => [{
	key: 'explore',
	title: i18n.ts.gallery,
	icon: 'ti ti-icons',
}]);

definePage(() => ({
	title: i18n.ts.gallery,
	icon: 'ti ti-icons',
}));
</script>

<style lang="scss" module>
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

.items {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	grid-gap: 12px;
	margin: 0 var(--MI-margin);
}
</style>
