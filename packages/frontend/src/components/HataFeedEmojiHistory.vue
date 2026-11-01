<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkWindow ref="window" class="hatady-scope hatafeed-scope" data-hatafeed-window :data-hatady-theme="hataFeedTheme" :initialWidth="650" :initialHeight="600" canResize centerTitle @closed="emit('closed')">
	<template #header>{{ copy.header }}</template>
	<div class="hf-form">
		<template v-if="historyFor"><button type="button" class="hy-secondary" @click="historyFor = null">{{ copy.backToList }}</button><HataFeedEmojiChangeList :originalRequestId="historyFor" @changed="changed"/></template>
		<template v-else>
			<p :class="$style.intro">{{ copy.intro }}</p>
			<form role="search" :aria-label="copy.searchLabel" :class="$style.search" @submit.prevent="search"><label><span>{{ copy.searchLabel }}</span><input v-model="query" type="search" maxlength="128" :placeholder="copy.searchPlaceholder"></label><button type="submit" class="hy-primary">{{ copy.search }}</button></form>
			<div class="hf-actions"><button v-for="option in filters" :key="option.value" type="button" class="hy-secondary" :aria-pressed="filter === option.value" @click="setFilter(option.value)">{{ option.label }}</button></div>
			<button v-if="activeQuery || selectedId" type="button" class="hy-secondary" @click="clearSearch">{{ copy.clearSearch }}</button>
			<HfQuotaMeter v-if="quota" :remaining="quota.remaining" :limit="quota.limit"/>
			<p v-if="error" role="alert">{{ error }}<button type="button" class="hy-secondary" @click="load()">{{ copy.reload }}</button></p>
			<p v-else-if="loading" role="status">{{ copy.loading }}</p>
			<p v-else-if="!requests.length" class="hf-empty">{{ activeQuery || filter !== 'all' ? copy.noMatches : copy.empty }}</p>
			<article v-for="request in requests" :key="request.id" :class="$style.request">
				<img v-if="request.currentEmoji?.imageUrl || request.imageUrl" :src="request.currentEmoji?.imageUrl || request.imageUrl!" :alt="request.name">
				<div>
					<strong>:{{ request.currentEmoji?.name ?? request.name }}:</strong><p><i :class="['ti', emojiStatusIcon[emojiRequestDisplayStatus(request)]]" aria-hidden="true"></i>{{ emojiStatusLabel[emojiRequestDisplayStatus(request)] }} · <MkTime :time="request.createdAt" mode="relative"/></p><p v-if="request.resolvedComment">{{ request.resolvedComment }}</p><p v-if="request.cancelledAt">{{ copy.cancelledAt }}<MkTime :time="request.cancelledAt" mode="detail"/> {{ request.cancellationReason }}</p>
					<p v-if="activeEmojiChange(request)" :class="$style.waiting">{{ i18n.tsx._hata._hatafeed._emojiHistory.changeWaiting({ kind: emojiChangeLabel[activeEmojiChange(request)!.kind], status: activeEmojiChange(request)!.status === 'held' ? copy.held : copy.waiting }) }}</p>
					<div v-else-if="request.status === 'approved' && request.currentEmoji" :class="$style.actions"><button type="button" class="hy-primary" @click="change(request, 'updateImage')">{{ copy.requestUpdateImage }}</button><button type="button" class="hy-secondary" @click="change(request, 'withdraw')">{{ copy.requestWithdraw }}</button></div>
					<div v-else-if="request.status === 'pending' || request.status === 'held'" :class="$style.actions"><button type="button" class="hy-secondary" @click="change(request, 'cancel')">{{ copy.cancelRequest }}</button></div>
					<p v-else-if="emojiRequestDisplayStatus(request) === 'missing'">{{ copy.missingEmoji }}</p>
					<button v-if="request.latestChange" type="button" class="hy-secondary" :class="$style.history" @click="historyFor = request.id">{{ copy.changeHistory }}</button>
				</div>
			</article>
			<div class="hf-actions"><button type="button" class="hf-icon" :aria-label="copy.previousPage" :disabled="loading || page === 0" @click="load(page - 1)"><i class="ti ti-chevron-left"></i></button><span :class="$style.page">{{ page + 1 }}</span><button type="button" class="hf-icon" :aria-label="copy.nextPage" :disabled="loading || !hasNext" @click="load(page + 1)"><i class="ti ti-chevron-right"></i></button></div>
		</template>
		<div class="hf-actions"><button type="button" class="hy-secondary" @click="window?.close()">{{ copy.close }}</button></div>
	</div>
</MkWindow>
</template>
<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import MkWindow from '@/components/MkWindow.vue';
import HataFeedEmojiChangeList from '@/components/HataFeedEmojiChangeList.vue';
import HfQuotaMeter from '@/components/HfQuotaMeter.vue';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { activeEmojiChange, emojiChangeLabel, emojiRequestDisplayStatus, emojiStatusIcon, emojiStatusLabel } from '@/utility/hatafeed.js';
import '@/components/hatafeed-ui.css';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();
const copy = i18n.ts._hata._hatafeed._emojiHistory;
const props = defineProps<{ requestId?: string }>();
const emit = defineEmits<{ closed: []; changed: [] }>();
const window = useTemplateRef('window');
const requests = ref<HataFeedEmojiRequest[]>([]);
const page = ref(0);
let cursors: (string | undefined)[] = [undefined];
const hasNext = ref(false);
const loading = ref(false);
const error = ref('');
const query = ref('');
const activeQuery = ref('');
const selectedId = ref(props.requestId);
const historyFor = ref<string | null>(null);
const quota = ref<{ remaining: number; limit: number } | null>(null);
type Filter = 'all' | 'registered' | 'waiting';
const filter = ref<Filter>('all');
const filters: { value: Filter; label: string }[] = [{ value: 'all', label: copy.all }, { value: 'registered', label: copy.registered }, { value: 'waiting', label: copy.waiting }];
let generation = 0;

async function load(target = page.value) {
	const current = ++generation;
	loading.value = true;
	error.value = '';
	try {
		const result = await misskeyApi('hata/feedback/emoji-requests', { mine: true, id: selectedId.value, query: activeQuery.value, filter: filter.value, limit: 16, untilId: cursors[target] }) as unknown as HataFeedEmojiRequest[];
		if (current !== generation) return;
		requests.value = result.slice(0, 15);
		hasNext.value = result.length > 15;
		page.value = target;
		cursors[target + 1] = requests.value.at(-1)?.id;
		error.value = '';
	} catch { if (current === generation) error.value = copy.historyLoadError; } finally { if (current === generation) loading.value = false; }
}

function search() { activeQuery.value = query.value.trim(); selectedId.value = undefined; cursors = [undefined]; load(0); }

function clearSearch() { query.value = ''; filter.value = 'all'; search(); }

function setFilter(value: Filter) { filter.value = value; selectedId.value = undefined; cursors = [undefined]; load(0); }

function changed() { load(); emit('changed'); }

async function change(request: HataFeedEmojiRequest, kind: 'updateImage' | 'withdraw' | 'cancel') {
	const { dispose } = popup((await import('@/components/HataFeedEmojiChangeWizard.vue')).default, { request, kind }, { done: changed, closed: () => dispose() });
}

onMounted(() => { load(); misskeyApi('hata/feedback/emoji-quota', {}).then(value => { quota.value = value; }).catch(() => {}); });
</script>
<style module>
.request { display: flex; align-items: flex-start; gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--hy-border); text-align: left; }
.request > img { width: 44px; height: 44px; object-fit: contain; flex: none; background: var(--hy-soft); border-radius: 12px; padding: 6px; }
.request > div { flex: 1; min-width: 0; }
.request p { margin: 6px 0; font-size: 12px; color: var(--hy-muted); }
.page { align-self: center; }
.intro { text-align: center; color: var(--hy-muted); }
.search { display: flex; align-items: end; gap: 8px; }
.search label { flex: 1; min-width: 0; display: grid; gap: 8px; }
.search input { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--hy-border); border-radius: 999px; padding: 12px; background: var(--hy-bg); color: var(--hy-ink); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.waiting { padding: 12px; border-radius: 12px; background: var(--hy-soft); text-align: center; }
.history { margin-top: 12px; }
.request strong { overflow-wrap: anywhere; }
</style>
