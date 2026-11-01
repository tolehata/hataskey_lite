<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.search" role="dialog" aria-modal="true" aria-labelledby="hatagoes-search-heading">
	<header :class="$style.heading"><div><h1 id="hatagoes-search-heading">横断検索</h1><p>3つのアプリからまとめて探します。</p></div><button type="button" :class="$style.close" aria-label="検索を閉じる" @click="emit('close')"><i class="ti ti-x" aria-hidden="true"></i></button></header>
	<form :class="$style.form" @submit.prevent="search(false)">
		<i class="ti ti-search" aria-hidden="true"></i><input ref="input" v-model="query" type="search" maxlength="100" placeholder="記録・作品・イシュー・人を検索" aria-label="検索語"/>
		<button v-if="query" type="button" :class="$style.clear" aria-label="検索語を消す" @click="query = ''; input?.focus()"><i class="ti ti-x" aria-hidden="true"></i></button>
		<button type="submit" :class="$style.submit" :disabled="!query.trim()" aria-label="検索"><i class="ti ti-arrow-right" aria-hidden="true"></i></button>
	</form>
	<div :class="$style.filters" role="group" aria-label="検索対象">
		<button v-for="option in filters" :key="option.id" type="button" :aria-label="option.label" :title="option.label" :aria-pressed="app === option.id" @click="app = option.id">
			<HataAppLogo v-if="option.id === 'hatask' || option.id === 'hatady' || option.id === 'hatafeed'" :app="option.id" :size="18" :monochrome="monochrome"/><i v-else :class="option.icon" aria-hidden="true"></i><HataAppWordmark v-if="app === option.id && (option.id === 'hatask' || option.id === 'hatady' || option.id === 'hatafeed')" :app="option.id" :inheritColor="true"/><span v-else-if="app === option.id">{{ option.label }}</span><span v-if="result"> {{ option.id === 'all' ? Object.values(result.counts).reduce((a, b) => a + b, 0) : result.counts[option.id] }}</span>
		</button>
	</div>
	<p v-if="!query.trim()" :class="$style.state">名称や本文から検索できます。</p>
	<p v-if="loading" :class="$style.state" role="status"><i class="ti ti-loader-2" aria-hidden="true"></i> 検索しています…</p>
	<p v-if="error" :class="$style.state" role="alert">検索できませんでした。<button type="button" @click="search(failedMore)">再試行</button></p>
	<p v-if="result && !loading" :class="$style.count" role="status">{{ result.total }}件の検索結果</p>
	<section v-for="group in groups" :key="group.id" :aria-label="group.label">
		<h2 :class="$style.groupTitle">{{ group.label }} <small>{{ result?.counts[group.id] ?? group.items.length }}件</small></h2>
		<ul :class="$style.results">
			<li v-for="item in group.items" :key="item.id">
				<a :href="hatagoesSearchResultUrl(item)" @click="openResult($event, item)">
					<span :class="$style.resultIcon"><HataAppLogo v-if="group.id === 'hatask' || group.id === 'hatady' || group.id === 'hatafeed'" :app="group.id" :size="18" :monochrome="monochrome"/><i v-else :class="group.icon" aria-hidden="true"></i></span><span :class="$style.resultCopy"><small>{{ kindNames[item.kind] ?? item.kind }}</small><strong>{{ item.title || '名称なし' }}</strong><span v-if="item.text" :class="$style.excerpt">{{ item.text }}</span></span><i class="ti ti-chevron-right" :class="$style.resultArrow" aria-hidden="true"></i>
				</a>
			</li>
		</ul>
	</section>
	<p v-if="result?.total === 0 && !loading" :class="$style.state"><i class="ti ti-mood-empty" aria-hidden="true"></i> 一致する情報がありません。</p>
	<button v-if="result?.hasMore" type="button" :class="$style.more" :disabled="loading" @click="search(true)">さらに表示 <i class="ti ti-chevron-down" aria-hidden="true"></i></button>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatagoesSearchResultUrl } from '@/utility/hatagoes-search.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
type SearchResult = Endpoints['hata/hatagoes/search']['res'];
type SearchItem = SearchResult['items'][number];
type SearchApp = 'all' | 'hatask' | 'hatady' | 'hatafeed' | 'users';
const emit = defineEmits<{ open: [item: SearchItem]; close: [] }>();
const props = withDefaults(defineProps<{ active?: boolean; revision?: number; monochrome?: boolean }>(), { active: true, revision: 0, monochrome: false });
const input = ref<HTMLInputElement>();
const query = ref('');
const app = ref<SearchApp>('all');
const result = ref<SearchResult>();
const items = ref<SearchItem[]>([]);
const loading = ref(false);
const error = ref(false);
const failedMore = ref(false);
const filters = [{ id: 'all', label: 'すべて', icon: 'ti ti-search' }, { id: 'hatask', label: 'Hatask', icon: '' }, { id: 'hatady', label: 'Hatady', icon: '' }, { id: 'hatafeed', label: 'HataFeed', icon: '' }, { id: 'users', label: '人', icon: 'ti ti-users' }] as const;
const groups = computed(() => filters.filter(filter => filter.id !== 'all').map(filter => ({ ...filter, items: items.value.filter(item => item.app === filter.id) })).filter(group => group.items.length));
const kindNames: Record<string, string> = { event: '予定', todo: 'ToDo', mood: 'きもち', meal: 'ごはん', recipe: 'レシピ', cookingRecord: '料理の記録', flower: 'おはな', log: '記録', book: '本', bookMemo: '読書メモ', bookmark: 'リンク', work: '作品', session: '鑑賞記録', mediaWork: '作品', mediaSession: '鑑賞記録', issue: 'イシュー', comment: 'コメント', project: 'プロジェクト', emojiRequest: '絵文字申請', emojiChangeRequest: '絵文字変更申請', user: 'ユーザー' };
let timer: number | undefined;
let request = 0;
let controller: AbortController | undefined;

function openResult(event: MouseEvent, item: SearchItem) {
	if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	emit('open', item);
}

async function focusSearch() { await nextTick(); if (props.active) input.value?.focus({ preventScroll: true }); }

onMounted(focusSearch);
watch(() => props.active, active => {
	if (active) { void focusSearch(); if (query.value.trim() && !result.value) void search(false); } else { request++; window.clearTimeout(timer); controller?.abort(); loading.value = false; }
});
watch(() => props.revision, () => { if (props.active && query.value.trim()) void search(false); });

async function search(more: boolean) {
	window.clearTimeout(timer);
	const id = ++request;
	controller?.abort();
	controller = new AbortController();
	if (!query.value.trim()) { items.value = []; result.value = undefined; loading.value = false; return; }
	loading.value = true;
	error.value = false;
	if (!more) { items.value = []; result.value = undefined; }
	try {
		const response = await misskeyApi('hata/hatagoes/search', { query: query.value.trim(), app: app.value, offset: more ? items.value.length : 0, limit: 30 }, undefined, controller.signal);
		if (id !== request) return;
		items.value = more ? [...items.value, ...response.items] : response.items;
		result.value = response;
	} catch { if (id === request) { error.value = true; failedMore.value = more; } } finally { if (id === request) loading.value = false; }
}

watch([query, app], () => {
	request++;
	controller?.abort();
	window.clearTimeout(timer);
	items.value = [];
	result.value = undefined;
	loading.value = false;
	error.value = false;
	if (props.active) timer = window.setTimeout(() => void search(false), 300);
});
onBeforeUnmount(() => { request++; window.clearTimeout(timer); controller?.abort(); });
</script>

<style module>
.search { --search-fg: var(--fg, var(--MI_THEME-fg)); --search-muted: var(--fg-2, var(--MI_THEME-fg)); --search-accent: var(--accent, var(--MI_THEME-accent)); --search-rule: var(--rule, var(--MI_THEME-divider)); --search-surface: var(--surface, var(--MI_THEME-panel)); box-sizing: border-box; width: min(760px, calc(100dvw - 32px)); max-width: 100%; max-height: min(86dvh, 900px); overflow-y: auto; overscroll-behavior: contain; padding: 0 clamp(16px, 3vw, 32px) 24px; margin: auto; border-radius: 24px; background: var(--search-surface); color: var(--search-fg); box-shadow: 0 24px 56px rgb(0 0 0 / 18%); }
.heading { position: sticky; z-index: 2; top: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-top: clamp(16px, 3vw, 32px); background: var(--search-surface); }
.heading h1 { margin: 0; font-size: 24px; }
.heading p { margin: 4px 0 14px; color: var(--search-muted); font-size: 13px; }
.search .close { display: grid; place-items: center; flex: 0 0 44px; width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; font-size: 21px; }
.form { display: flex; align-items: center; gap: 10px; min-height: 54px; margin-top: 6px; padding: 5px 6px 5px 17px; border: 1px solid var(--search-rule); border-radius: 999px; background: var(--search-surface); box-shadow: 0 6px 24px rgb(0 0 0 / 5%); }
.form:focus-within { outline: 2px solid var(--search-accent); outline-offset: 2px; }
.form > i { color: var(--search-accent); font-size: 20px; }
.form input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--search-fg); font: inherit; font-size: 15px; }
.search button { border: 1px solid var(--search-rule); background: var(--search-surface); color: var(--search-fg); cursor: pointer; font: inherit; }
.search button:focus-visible, .search a:focus-visible { outline: 2px solid var(--search-accent); outline-offset: 2px; }
.search .form input:focus-visible { outline: none; }
.form .clear { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; }
.form .submit { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: var(--search-accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent, #fff)); font-size: 20px; }
.form .submit:disabled { opacity: .4; }
.filters { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; width: fit-content; max-width: 100%; margin: 20px auto 24px; padding: 4px; border: 1px solid var(--search-rule); border-radius: 999px; background: var(--search-surface); }
.filters button { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 6px 12px; border: 0; border-radius: 999px; color: var(--search-muted); white-space: nowrap; transition: background-color 140ms ease, color 140ms ease; }
.filters button[aria-pressed=true] { background: var(--search-accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent, #fff)); }
.state { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 110px; margin: 8px 0; color: var(--search-muted); text-align: center; }
.state > i { font-size: 22px; }
.state button { padding: 6px 10px; border-radius: 999px; }
.count { margin: 12px 0; color: var(--search-muted); font-size: 12px; }
.groupTitle { display: flex; gap: 8px; align-items: baseline; margin: 24px 0 10px; font-size: 16px; }
.groupTitle small { color: var(--search-muted); font-size: 12px; font-weight: normal; }
.results { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.results a { display: flex; align-items: center; gap: 14px; min-height: 68px; padding: 10px 14px; border: 1px solid var(--search-rule); border-radius: 16px; background: var(--search-surface); color: var(--search-fg); text-decoration: none; overflow-wrap: anywhere; }
.results a:hover { border-color: var(--search-accent); }
.resultIcon { display: grid; place-items: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 11px; background: color-mix(in srgb, var(--search-accent) 12%, var(--search-surface)); color: var(--search-accent); font-size: 18px; }
.resultCopy { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 2px; }
.resultCopy small, .excerpt { color: var(--search-muted); font-size: 11px; }
.resultCopy strong { font-size: 14px; }
.excerpt { display: -webkit-box; overflow: hidden; white-space: pre-wrap; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.resultArrow { color: var(--search-muted); }
.more { display: block; margin: 16px auto; padding: 10px 16px; border-radius: 999px; }
@media (max-width: 580px) { .search { width: calc(100dvw - 24px); max-height: 86dvh; padding-inline: 16px; } .filters { border-radius: 20px; } .filters button { padding-inline: 8px; } }
</style>
