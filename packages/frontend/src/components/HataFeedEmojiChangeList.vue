<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section class="hf-form" :class="$style.list" :aria-busy="loading">
	<h3 v-if="showTitle">{{ originalRequestId ? copy.historyTitle : copy.title }}</h3>
	<div :class="$style.filters" role="group" :aria-label="copy.filterLabel"><button v-for="option in filters" :key="option.value" type="button" :class="$style.filter" :aria-pressed="filter === option.value" @click="setFilter(option.value)">{{ option.label }}</button></div>
	<p v-if="error" role="alert">{{ error }}<button type="button" class="hy-secondary" @click="load()">{{ copy.reload }}</button></p>
	<p v-else-if="loading" role="status">{{ copy.loading }}</p><p v-else-if="!requests.length" class="hf-empty">{{ copy.empty }}</p>
	<button v-for="request in requests" :key="request.id" type="button" :class="$style.row" @click="open(request)"><img :src="request.kind === 'updateImage' ? request.imageUrl ?? request.previousImageUrl : request.previousImageUrl" :alt="request.name"><span><strong>:{{ request.name }}:</strong><small>{{ emojiChangeLabel[request.kind] }} · {{ emojiStatusLabel[request.status] }} · <MkTime :time="request.createdAt" mode="relative"/></small><small v-if="isStaff">{{ request.requestedBy?.name ?? request.requestedBy?.username }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
	<div class="hf-actions"><button type="button" class="hf-icon" :aria-label="copy.previousPage" :disabled="loading || page === 0" @click="load(page - 1)"><i class="ti ti-chevron-left"></i></button><span>{{ page + 1 }}</span><button type="button" class="hf-icon" :aria-label="copy.nextPage" :disabled="loading || !hasNext" @click="load(page + 1)"><i class="ti ti-chevron-right"></i></button></div>
</section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { HataFeedEmojiChangeRequest } from '@/utility/hatafeed.js';
import { emojiChangeLabel, emojiStatusLabel } from '@/utility/hatafeed.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();
const copy = i18n.ts._hata._hatafeed._emojiChangeList;
const props = withDefaults(defineProps<{ originalRequestId?: string; isStaff?: boolean; showTitle?: boolean }>(), { showTitle: true });
const emit = defineEmits<{ changed: [] }>();
type Filter = 'all' | HataFeedEmojiChangeRequest['status'];
const filters: { value: Filter; label: string }[] = [{ value: 'all', label: copy.all }, { value: 'pending', label: copy.pending }, { value: 'held', label: copy.held }, { value: 'approved', label: copy.approved }, { value: 'rejected', label: copy.rejected }];
const filter = ref<Filter>(props.isStaff ? 'pending' : 'all');
const requests = ref<HataFeedEmojiChangeRequest[]>([]);
const loading = ref(false);
const error = ref('');
const page = ref(0);
const hasNext = ref(false);
let cursors: (string | undefined)[] = [undefined];
let generation = 0;

async function load(target = page.value) {
	const current = ++generation; loading.value = true; error.value = '';
	try {
		const result = await misskeyApi('hata/feedback/emoji-change-requests', { mine: !props.isStaff, originalRequestId: props.originalRequestId, status: filter.value === 'all' ? undefined : filter.value, limit: 16, untilId: cursors[target] }) as unknown as HataFeedEmojiChangeRequest[];
		if (current !== generation) return;
		requests.value = result.slice(0, 15); hasNext.value = result.length > 15; page.value = target; cursors[target + 1] = requests.value.at(-1)?.id;
	} catch { if (current === generation) error.value = copy.loadError; } finally { if (current === generation) loading.value = false; }
}

function setFilter(value: Filter) { filter.value = value; cursors = [undefined]; load(0); }

async function open(request: HataFeedEmojiChangeRequest) {
	const { dispose } = popup((await import('@/components/HataFeedEmojiChangeReview.vue')).default, { request, isStaff: props.isStaff }, { done: () => { load(); emit('changed'); }, closed: () => dispose() });
}

onMounted(() => load());
defineExpose({ reload: () => load(0) });
</script>
<style module>
.list { text-align: center; }
.filters { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; width: fit-content; max-width: 100%; box-sizing: border-box; margin-inline: auto; padding: 3px; border-radius: 999px; background: var(--hy-bg); }
.filters .filter { min-height: 40px; padding: 8px 12px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 12px; line-height: 1.4; white-space: nowrap; cursor: pointer; }
.filters .filter:hover { background: var(--hy-soft); }
.filters .filter[aria-pressed='true'] { background: var(--hy-surface); color: var(--hy-accent); font-weight: 700; box-shadow: 0 1px 3px rgb(0 0 0 / 12%); }
.filters .filter:focus-visible { outline: 2px solid var(--hy-accent); outline-offset: 2px; }
.row { display: flex; gap: 14px; align-items: center; width: 100%; padding: 18px 0; border: 0; border-top: 1px solid var(--hy-border); background: transparent; color: var(--hy-ink); text-align: left; cursor: pointer; }
.row img { width: 50px; height: 50px; object-fit: contain; padding: 6px; background: var(--hy-soft); border-radius: 14px; }
.row span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.row small { display: block; margin-top: 5px; color: var(--hy-muted); }
</style>
