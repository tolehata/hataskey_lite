<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section ref="root" :class="$style.root" :aria-label="copy.adminReview">
	<template v-if="access">
		<div :class="$style.heading">
			<div><span :class="$style.eyebrow"><i class="ti ti-shield" aria-hidden="true"></i>{{ copy.admins }}</span><h1>{{ copy.reviewTitle }}</h1><p>{{ copy.intro }}</p></div>
			<div :class="$style.counts" :aria-label="copy.allStatus" data-hy-page-controls>
				<button v-for="option in moderationStatuses" :key="option.value" type="button" :aria-pressed="filters.status === option.value" @click="filters.status = filters.status === option.value ? 'all' : option.value">
					<i :class="option.icon" aria-hidden="true"></i><span>{{ option.label }}</span><strong>{{ counts[option.value] }}</strong>
				</button>
			</div>
		</div>
		<div :class="$style.toolbar" data-hy-page-controls>
			<HyCapsule :modelValue="filters.category" :options="moderationCategories" :class="$style.types" :label="copy.categoryFilter" @update:modelValue="setCategory"/>
			<label :class="$style.search"><i class="ti ti-search" aria-hidden="true"></i><input v-model="filters.query" type="search" maxlength="200" :placeholder="copy.searchPlaceholder" :aria-label="copy.searchLabel" @keydown.enter.prevent="load()"/></label>
			<button type="button" :class="$style.filterToggle" :aria-expanded="filtersOpen" :aria-controls="filtersId" @click="filtersOpen = !filtersOpen"><i class="ti ti-filter" aria-hidden="true"></i>{{ copy.filters }}</button>
			<button type="button" :class="$style.sort" @click="filters.sort = filters.sort === 'desc' ? 'asc' : 'desc'"><i :class="filters.sort === 'desc' ? 'ti ti-arrow-down' : 'ti ti-arrow-up'" aria-hidden="true"></i>{{ filters.sort === 'desc' ? copy.newest : copy.oldest }}</button>
		</div>
		<div v-show="filtersOpen" :id="filtersId" :class="$style.filters" data-hy-page-controls>
			<label><span>{{ copy.visibility }}</span><select v-model="filters.visibility" class="hy-input"><option value="all">{{ i18n.ts._hata._hatady._media.all }}</option><option v-for="(scope, value) in moderationVisibilities" :key="value" :value="value">{{ scope.label }}</option></select></label>
			<label><span>{{ copy.activity }}</span><select v-model="filters.activity" class="hy-input"><option value="all">{{ i18n.ts._hata._hatady._media.all }}</option><option v-for="activity in moderationActivities" :key="activity.value" :value="activity.value">{{ activity.label }}</option></select></label>
			<div :class="$style.dates"><label>{{ copy.startDate }}<input v-model="filters.from" class="hy-input" type="date"/></label><label>{{ copy.endDate }}<input v-model="filters.to" class="hy-input" type="date"/></label></div>
		</div>
		<div :class="$style.workspace">
			<section :class="$style.listPanel" :aria-label="copy.postList" :aria-busy="loading">
				<div :class="$style.listHead"><span role="status">{{ loading ? copy.loadingShort : i18n.tsx._hata._hatady._moderationView.totalCount({ count: total }) }}</span><button type="button" :class="$style.reset" @click="reset">{{ copy.showAll }}</button></div>
				<div v-if="dateError" :class="$style.empty" role="alert"><i class="ti ti-calendar" aria-hidden="true"></i><strong>{{ copy.dateRangeError }}</strong><span>{{ copy.dateRangeHint }}</span></div>
				<div v-else-if="loading" :class="$style.empty" role="status">{{ copy.loading }}</div>
				<div v-else-if="error" :class="$style.empty"><p class="hy-error" role="alert">{{ error }}</p><button type="button" class="hy-secondary" @click="load()">{{ copy.retry }}</button></div>
				<div v-else-if="!items.length" :class="$style.empty"><i class="ti ti-search" aria-hidden="true"></i><strong>{{ copy.noMatches }}</strong><span>{{ copy.noMatchesHint }}</span><button type="button" class="hy-secondary" @click="reset">{{ copy.clearFilters }}</button></div>
				<div v-else :class="$style.list">
					<button v-for="item in items" :key="item.key" type="button" :class="$style.row" :data-key="item.key" :data-selected="selected?.key === item.key" :aria-pressed="selected?.key === item.key" @click="openDetail(item, $event)">
						<span :class="$style.typeMark"><MkReactionIcon v-if="item.emoji" :reaction="item.emoji" :class="$style.emoji"/><i v-else :class="moderationCategory(item.category).icon" aria-hidden="true"></i></span>
						<span :class="$style.rowContent">
							<span :class="$style.meta"><b>{{ item.actor.name || item.actor.username }}</b><span>{{ moderationCategory(item.category).label }}</span><time :datetime="item.createdAt">{{ moderationDate(item.createdAt) }}</time><span :aria-label="i18n.tsx._hata._hatady._moderationView.visibilityLabel({ scope: moderationVisibilities[item.visibility].label })"><i :class="moderationVisibilities[item.visibility].icon" aria-hidden="true"></i>{{ moderationVisibilities[item.visibility].label }}</span></span>
							<strong :class="$style.rowTitle">{{ item.title }}</strong><span :class="$style.excerpt">{{ item.body || copy.noBody }}</span>
						</span>
						<span :class="$style.rowEnd"><span :class="$style.status" :data-status="item.review.state"><i :class="moderationStatus(item.review.state).icon" aria-hidden="true"></i>{{ moderationStatus(item.review.state).label }}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></span>
					</button>
				</div>
				<nav v-if="page || nextCursor" :class="$style.pagination" :aria-label="copy.listPages">
					<button type="button" class="hy-secondary" :disabled="loading || page === 0" @click="movePage(-1)"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.previous }}</button><span>{{ page + 1 }}</span><button type="button" class="hy-secondary" :disabled="loading || !nextCursor" @click="movePage(1)">{{ copy.next }}<i class="ti ti-arrow-right" aria-hidden="true"></i></button>
				</nav>
			</section>
			<aside ref="detailPane" :class="$style.detail" :aria-label="copy.selectedDetail" :aria-busy="detailLoading" :inert="modalOpen">
				<div v-if="detailLoading" :class="$style.empty" role="status">{{ copy.loadingDetail }}</div>
				<div v-else-if="detailError" :class="$style.empty"><p class="hy-error" role="alert">{{ detailError }}</p><button type="button" class="hy-secondary" @click="retryDetail">{{ copy.retry }}</button></div>
				<HatadyModerationDetail v-else-if="detail && !modalOpen" ref="desktopDetail" v-model:note="note" :detail="detail" :busy="saving" :error="saveError" @select="openRelated" @save="save" @moderated="load()"/>
				<div v-else-if="!modalOpen" :class="$style.empty">{{ copy.selectHint }}</div>
			</aside>
		</div>
		<Teleport to="body">
			<HyDialog v-if="modalOpen" ref="dialog" :title="copy.reviewTitle" centerTitle scrollHint :busy="saving" @close="dialog?.close()" @closed="closeDetail">
				<div v-if="detailLoading" :class="$style.empty" role="status">{{ copy.loadingDetail }}</div>
				<div v-else-if="detailError" :class="$style.empty"><p class="hy-error" role="alert">{{ detailError }}</p><button type="button" class="hy-secondary" @click="retryDetail">{{ copy.retry }}</button></div>
					<HatadyModerationDetail v-else-if="detail" ref="modalDetail" v-model:note="note" :detail="detail" :busy="saving" :error="saveError" @select="openRelated" @save="save" @moderated="load()"/>
			</HyDialog>
		</Teleport>
	</template>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import type { ModerationEntry } from '@/utility/hatady-moderation.js';
import { moderationActivities, moderationCategories, moderationCategory, moderationDate, moderationStatus, moderationStatuses, moderationVisibilities, useHatadyModeration } from '@/utility/hatady-moderation.js';
import HyCapsule from '@/components/HyCapsule.vue';
import HyDialog from '@/components/HyDialog.vue';
import HatadyModerationDetail from '@/components/HatadyModerationDetail.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._moderationView;

const access = computed(() => $i && ($i.isAdmin || $i.isModerator) ? $i.id : null);
const { filters, items, counts, total, loading, error, selected, detail, detailLoading, detailError, note, saveError, saving, page, nextCursor, dateError, select, load, save, reset, movePage } = useHatadyModeration(access);
const root = useTemplateRef('root');
const detailPane = useTemplateRef('detailPane');
const desktopDetail = useTemplateRef('desktopDetail');
const modalDetail = useTemplateRef('modalDetail');
const dialog = useTemplateRef('dialog');
const filtersId = useId();
const filtersOpen = ref(false), modalOpen = ref(false), narrow = ref(false);
let observer: ResizeObserver | undefined;
let returnTarget: HTMLElement | null = null;

function setCategory(value: string): void {
	const category = moderationCategories.find(option => option.value === value);
	if (category) filters.category = category.value;
}

function measure(): void {
	const width = root.value?.clientWidth ?? 0;
	if (width > 0) narrow.value = width <= 900;
}

async function openDetail(item: ModerationEntry, event?: Event): Promise<void> {
	if (event?.currentTarget instanceof HTMLElement) returnTarget = event.currentTarget;
	measure();
	if (modalOpen.value || narrow.value || detailPane.value && getComputedStyle(detailPane.value).display === 'none') modalOpen.value = true;
	await select(item);
}

async function openRelated(item: ModerationEntry): Promise<void> {
	await openDetail(item);
	await nextTick();
	if (modalOpen.value) modalDetail.value?.focusHeading();
	else desktopDetail.value?.focusHeading();
}

async function closeDetail(): Promise<void> {
	modalOpen.value = false;
	await nextTick();
	const row = Array.from(root.value?.querySelectorAll<HTMLElement>('button[data-key]') ?? []).find(element => element.dataset.key === selected.value?.key);
	const target = row ?? (returnTarget?.isConnected ? returnTarget : root.value?.querySelector<HTMLElement>('button'));
	target?.focus({ preventScroll: true });
}

function retryDetail(): void {
	if (selected.value) void select(selected.value, true);
}

onMounted(() => {
	measure();
	observer = new ResizeObserver(measure);
	if (root.value) observer.observe(root.value);
});
onUnmounted(() => observer?.disconnect());
</script>

<style module>
.root { container: hy-review / inline-size; min-width: 0; color: var(--hy-ink); }
.heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px 24px; margin-bottom: 18px; }
.heading > div { min-width: 0; }
.heading h1 { margin: 0; font-size: 25px; overflow-wrap: anywhere; }
.heading p { margin: 5px 0 0; color: var(--hy-muted); font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
.eyebrow { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; color: var(--hy-muted); font-size: 12px; }
.counts { display: flex; flex-wrap: wrap; gap: 8px; max-width: 100%; }
.root .counts > button { display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 44px; min-height: 44px; padding: 9px 13px; border: 1px solid var(--hy-border); border-radius: 16px; background: var(--hy-surface); color: var(--hy-muted); font-size: 13px; line-height: 1.5; cursor: pointer; }
.counts strong { color: var(--hy-ink); font-size: 20px; font-variant-numeric: tabular-nums; }
.root .counts > button[aria-pressed='true'] { border-color: var(--hy-accent); background: var(--hy-soft); color: var(--hy-accent); }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; min-width: 0; }
.toolbar > .types { box-sizing: border-box; flex-wrap: wrap; gap: 2px; width: max-content; max-width: 100%; padding: 4px; overflow: clip; box-shadow: none; }
.toolbar > .types > button { min-width: 44px; min-height: 44px; max-width: 100%; padding: 8px; gap: 5px; font-size: 13px; white-space: normal; }
.toolbar > .types > button > span { inline-size: auto; min-width: 0; flex-shrink: 1; overflow-wrap: anywhere; }
.toolbar > .types > button > i { font-size: 18px; }
.search { display: flex; align-items: center; gap: 9px; flex: 1 1 220px; min-width: 0; max-width: 100%; min-height: 46px; padding: 0 13px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: var(--hy-muted); }
.root .search input { width: 100%; min-width: 0; min-height: 44px; padding: 9px 0; border: 0; background: transparent; color: var(--hy-ink); font-size: 16px; }
.search input::placeholder { color: var(--hy-muted); opacity: 1; }
.search:focus-within { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.root .search input:focus-visible { outline: none; }
.root .filterToggle,.root .sort { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 44px; min-height: 44px; max-width: 100%; padding: 9px 13px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: var(--hy-ink); font-size: 13px; overflow-wrap: anywhere; cursor: pointer; }
.root .filterToggle[aria-expanded='true'] { background: var(--hy-soft); border-color: var(--hy-accent); color: var(--hy-accent); }
.filters { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--hy-border); border-radius: 20px; background: var(--hy-surface); }
.filters label { display: grid; gap: 7px; min-width: 0; font-size: 13px; font-weight: 700; }
.filters :is(input,select) { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; font-size: 16px; }
.dates { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; min-width: 0; }
.workspace { display: grid; grid-template-columns: minmax(0,1fr) minmax(320px,380px); align-items: start; gap: 18px; min-width: 0; }
.listPanel,.detail { min-width: 0; border: 1px solid var(--hy-border); border-radius: 24px; background: var(--hy-surface); }
.listHead { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; padding: 12px 18px; border-bottom: 1px solid var(--hy-border); }
.listHead > span { font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; }
.root .reset { min-height: 44px; padding: 5px 10px; border: 0; border-radius: 12px; background: transparent; color: var(--hy-accent); font-size: 13px; cursor: pointer; }
.list { min-width: 0; padding: 5px; }
.root .row { display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: start; gap: 10px; width: 100%; min-height: 44px; padding: 15px 12px; border: 0; border-radius: 18px; background: transparent; color: var(--hy-ink); text-align: left; transition: background-color .16s ease,box-shadow .16s ease; cursor: pointer; }
.row + .row { margin-top: 3px; }
.root .row[data-selected='true'] { background: var(--hy-soft); box-shadow: inset 3px 0 0 var(--hy-accent); }
.typeMark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px; background: var(--hy-soft); color: var(--hy-accent); font-size: 21px; }
.row[data-selected='true'] .typeMark { background: var(--hy-surface); }
.typeMark .emoji { width: 24px; height: 24px; object-fit: contain; }
.rowContent { display: grid; gap: 5px; min-width: 0; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 9px; min-width: 0; color: var(--hy-muted); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.meta > span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.meta time { font-variant-numeric: tabular-nums; }
.rowTitle { font-size: 15px; font-weight: 700; line-height: 1.6; overflow-wrap: anywhere; }
.excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; color: var(--hy-muted); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.rowEnd { display: flex; align-items: flex-end; flex-direction: column; gap: 9px; min-width: 0; }
.rowEnd > i { font-size: 17px; color: var(--hy-muted); }
.status { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 5px 8px; border-radius: 999px; background: var(--hy-cool); color: var(--hy-ink); font-size: 12px; line-height: 1.5; white-space: nowrap; }
.status[data-status='flagged'] { background: var(--hy-warm); }
.status[data-status='reviewed'] { background: var(--hy-soft); }
.empty { display: grid; justify-items: center; gap: 12px; padding: 32px 18px; text-align: center; color: var(--hy-muted); font-size: 14px; overflow-wrap: anywhere; }
.empty > i { font-size: 30px; }
.empty p { margin: 0; }
.detail { position: sticky; top: 12px; padding: 20px; overflow-wrap: anywhere; }
.root .row:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: -3px; }
.pagination { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; padding: 12px; border-top: 1px solid var(--hy-border); font-variant-numeric: tabular-nums; }
@media (hover: hover) { .root .row:hover,.root .counts > button:hover,.root .filterToggle:hover,.root .sort:hover { background: var(--hy-soft); } }
@container hy-review (max-width: 900px) { .workspace { grid-template-columns: minmax(0,1fr); } .workspace > .detail { display: none; } }
@container hy-review (max-width: 620px) {
	.heading { align-items: flex-start; gap: 14px; }
	.heading h1 { font-size: 23px; }
	.counts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); width: 100%; gap: 7px; }
	.root .counts > button { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 0 4px; padding: 7px 8px; font-size: 12px; }
	.counts > button > strong { grid-column: 1 / -1; }
	.toolbar { gap: 8px; }
	.search { flex-basis: 100%; }
	.filters { grid-template-columns: minmax(0,1fr); gap: 12px; padding: 14px; }
	.listHead { padding: 10px 14px; }
	.root .row { grid-template-columns: 34px minmax(0,1fr); gap: 8px 10px; padding: 13px 10px; }
	.typeMark { width: 34px; height: 34px; border-radius: 12px; font-size: 19px; }
	.rowEnd { grid-column: 2; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; }
	.rowTitle { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) { .root .row { transition: none; } }
</style>
