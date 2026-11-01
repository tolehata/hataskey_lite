<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Teleport to="body">
	<Transition name="settings-search-panel" :css="isMotionEnabled">
		<div v-if="open" :class="$style.backdrop" :style="{ zIndex }" :data-motion-enabled="isMotionEnabled ? 'on' : 'off'" data-settings-search-overlay @mousedown.self="close('backdrop')">
			<section
				ref="panelEl"
				:class="$style.panel"
				:data-animated="isMotionEnabled ? 'on' : 'off'"
				tabindex="-1"
				role="dialog"
				:aria-label="copy.search.inputLabel"
				@keydown.capture="onPanelKeydown"
			>
				<div :class="$style.searchHead">
					<i class="ti ti-search" aria-hidden="true"></i>
					<input
						ref="inputEl"
						v-model="query"
						:class="$style.input"
						type="search"
						autocomplete="off"
						spellcheck="false"
						:placeholder="copy.search.placeholder"
						:aria-label="copy.search.inputLabel"
						role="combobox"
						aria-autocomplete="list"
						:aria-controls="listboxId"
						:aria-expanded="hasOptions"
						:aria-activedescendant="activeOptionId"
						@compositionstart="isComposing = true"
						@compositionend="onCompositionEnd"
					>
					<span v-if="query && response != null" :class="$style.count">{{ copyx.search.resultCount({ count: response.totalResults }) }}</span>
					<button type="button" :class="$style.close" :aria-label="copy.search.closeSearch" @click="close('button')"><i class="ti ti-x" aria-hidden="true"></i></button>
				</div>

				<p :class="$style.live" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>

				<div :id="listboxId" :class="$style.body" role="listbox" :aria-label="copy.search.resultsLabel">
					<Transition name="settings-search-results" :css="isMotionEnabled">
						<div :key="resultStateKey">
							<div v-if="catalogState === 'pending'" :class="$style.status"><i class="ti ti-loader-2" aria-hidden="true"></i>{{ copy.search.loadingIndex }}</div>
							<div v-else-if="catalogState === 'error'" :class="$style.empty">
								<i class="ti ti-alert-circle" aria-hidden="true"></i>
								<div>{{ copy.search.preparationFailed }}</div>
								<button type="button" :class="$style.retry" @click="emit('retry')">{{ i18n.ts.retry }}</button>
							</div>
							<div v-else-if="query === ''" :class="$style.empty">
								<i class="ti ti-search" aria-hidden="true"></i>
								<div>{{ copy.search.searchHelp }}</div>
							</div>
							<div v-else-if="isSearching" :class="$style.status"><i class="ti ti-loader-2" aria-hidden="true"></i>{{ copy.search.searching }}</div>
							<!-- A request begins pending immediately, but its visible progress copy is
				     delayed. Keep the result area's height without announcing "no
				     matches" until the current revision has actually responded. -->
							<div v-else-if="isSearchPending || response == null" :class="$style.neutral" aria-hidden="true"></div>
							<div v-else-if="optionItems.length === 0" :class="$style.empty">
								<i class="ti ti-search-off" aria-hidden="true"></i>
								<div>{{ copyx.search.noResults({ query }) }}</div>
								<p>{{ copy.search.searchSuggestion }}</p>
							</div>
							<template v-else>
								<div v-if="resultItems.length > 0" :class="$style.group" role="group" :aria-label="copy.search.matchedSettings">
									<h2 :class="$style.groupTitle" role="presentation" aria-hidden="true">{{ copy.search.matchedSettings }}</h2>
									<button
										v-for="(item, index) in resultItems"
										:id="optionId(index)"
										:key="item.stableId"
										type="button"
										:class="$style.result"
										:style="{ '--i': index }"
										role="option"
										tabindex="-1"
										:aria-selected="activeIndex === index"
										@mousemove="activeIndex = index"
										@click="select(item)"
									>
										<span :class="$style.icon"><i :class="resultIcon(item)" aria-hidden="true"></i></span>
										<span :class="$style.resultText">
											<span :class="[$style.label, { settingsBrand: hasSettingsBrand(item.label) }]"><template v-for="(part, partIndex) in labelParts(item.label)" :key="partIndex"><mark v-if="part.matches" :class="$style.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
											<span :class="$style.path">{{ item.categoryLabel }}</span>
											<span v-if="item.description" :class="$style.description">{{ item.description }}</span>
										</span>
									</button>
								</div>
								<div v-if="suggestionItems.length > 0" :class="$style.group" role="group" :aria-label="copy.search.relatedHeading">
									<h2 :class="$style.groupTitle" role="presentation" aria-hidden="true"><i class="ti ti-bulb" aria-hidden="true"></i>{{ copy.search.relatedHeading }}</h2>
									<div :class="$style.suggestions">
										<button
											v-for="(item, offset) in suggestionItems"
											:id="optionId(resultItems.length + offset)"
											:key="item.stableId"
											type="button"
											:class="$style.suggestion"
											role="option"
											tabindex="-1"
											:aria-selected="activeIndex === resultItems.length + offset"
											@pointermove="activeIndex = resultItems.length + offset"
											@click="select(item)"
										>
											<span :class="{ settingsBrand: hasSettingsBrand(item.label) }">{{ item.label }}</span>
											<code v-if="suggestionEvidence.get(item.stableId)" :class="$style.suggestionEvidence">{{ suggestionEvidence.get(item.stableId) }}</code>
										</button>
									</div>
								</div>
							</template>
						</div>
					</Transition>
				</div>
			</section>
		</div>
	</Transition>
</Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, toRaw } from 'vue';
import type { SettingsCatalogDescriptorV2 } from '@/utility/settings-search-v2.js';
import { i18n } from '@/i18n.js';
import SettingsSearchWorker from '@/workers/settings-search-v2?worker';
import { searchSettingsV2 } from '@/utility/settings-search-v2.js';
import { prefer } from '@/preferences.js';
import { claimZIndex } from '@/os.js';

export type SettingsSearchDescriptor = {
	stableId: string;
	route: string;
	anchor?: string;
	controlId?: string;
	activation?: SettingsCatalogDescriptorV2['activation'];
	label: string;
	description?: string;
	icon?: string;
	categoryId?: string;
	categoryLabel: string;
	aliases?: string[];
	preferenceKeys?: string[];
};

export type SettingsSearchCloseEvent = {
	reason: 'backdrop' | 'button' | 'escape' | 'tab' | 'select';
	direction?: 'next' | 'previous';
};

type SearchCatalog = Parameters<typeof searchSettingsV2>[0];
type SearchResponse = ReturnType<typeof searchSettingsV2>;

const props = defineProps<{
	open: boolean;
	catalog: SearchCatalog | null;
	catalogState: 'pending' | 'ready' | 'error';
}>();

const copy = i18n.ts._hata._settingsRedesign;
const copyx = i18n.tsx._hata._settingsRedesign;

const emit = defineEmits<{
	close: [event: SettingsSearchCloseEvent];
	select: [item: Pick<SettingsSearchDescriptor, 'stableId' | 'route' | 'anchor' | 'controlId' | 'activation'>];
	retry: [];
}>();

const inputEl = ref<HTMLInputElement>();
const panelEl = ref<HTMLElement>();
const zIndex = ref<number>();
const query = ref('');
const response = ref<SearchResponse | null>(null);
const activeIndex = ref(-1);
const isComposing = ref(false);
const isSearching = ref(false);
const isSearchPending = ref(false);
let revision = 0;
let searchPendingTimer: number | null = null;
let worker: Worker | null = null;
let workerUnavailable = false;
let catalogRevision = 0;
let initializedCatalogRevision = -1;
const listboxId = 'settings-search-v2-options';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = ref(reducedMotionQuery.matches);

// Generated controls do not carry a hand-authored icon, whereas legacy
// entries sometimes do. A fixed category map keeps result rows meaningful
// without making the search catalog presentation-dependent. A legacy icon
// always wins, while genuinely unclassified entries retain the neutral icon.
const categoryIcons: Readonly<Record<string, string>> = {
	'hataskey-ui': 'ti ti-sparkles',
	'display-notes': 'ti ti-layout-distribute-vertical',
	'theme-font': 'ti ti-palette',
	'timeline-posting': 'ti ti-list',
	reactions: 'ti ti-mood-smile',
	'notification-sound': 'ti ti-bell',
	account: 'ti ti-user',
	'hata-tools': 'ti ti-flag',
	cherrypick: 'ti ti-cherry',
	'data-connect': 'ti ti-plug',
	'misskey-ui': 'ti ti-archive',
	behavior: 'ti ti-adjustments',
};

function resultIcon(item: SettingsSearchDescriptor): string {
	return item.icon?.trim() || (item.categoryId == null ? undefined : categoryIcons[item.categoryId]) || 'ti ti-settings';
}

const hasSettingsBrand = (value: string): boolean => /Hataskey|Hatask|Hatady|HataFeed/u.test(value);

const isMotionEnabled = computed(() => prefer.r.animation?.value !== false && !prefersReducedMotion.value);
const resultItems = computed<SettingsSearchDescriptor[]>(() => response.value?.results ?? []);
const suggestionItems = computed<SettingsSearchDescriptor[]>(() => response.value?.suggestions ?? []);
const optionItems = computed(() => [...resultItems.value, ...suggestionItems.value]);
const suggestionEvidence = computed(() => new Map(suggestionItems.value.flatMap(item => {
	const evidence = searchEvidence(item);
	return evidence == null ? [] : [[item.stableId, evidence] as const];
})));
const hasOptions = computed(() => optionItems.value.length > 0);
const activeOptionId = computed(() => activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined);
const resultStateKey = computed(() => [
	props.catalogState,
	isSearchPending.value ? (isSearching.value ? 'searching' : 'pending') : 'idle',
	response.value?.normalizedQuery ?? query.value,
	optionItems.value.map(item => item.stableId).join(','),
].join('|'));
const liveMessage = computed(() => {
	if (query.value === '') return '';
	if (isSearching.value) return copy.search.liveSearching;
	if (isSearchPending.value || response.value == null) return '';
	if (optionItems.value.length === 0) return copy.search.liveNoMatches;
	return copyx.search.liveCounts({ results: response.value?.totalResults ?? 0, suggestions: suggestionItems.value.length });
});

watch(() => props.open, async (open) => {
	if (!open) return;
	// Settings can live in an MkWindow. Reclaim the popup layer on every open,
	// including after another window has been brought to the front.
	zIndex.value = claimZIndex('middle');
	await nextTick();
	inputEl.value?.focus();
	// Closing invalidates a pending worker revision. Re-submit the visible query
	// when reopening so an already initialized worker cannot leave an empty list.
	if (query.value !== '') search();
}, { immediate: true });

watch(query, () => {
	if (isComposing.value) return;
	search();
});

watch([() => props.catalog, () => props.catalogState], () => {
	++revision;
	clearSearchPending();
	response.value = null;
	activeIndex.value = -1;
	syncWorkerCatalog();
	search();
}, { immediate: true });

watch(activeIndex, async index => {
	if (index < 0) return;
	await nextTick();
	window.document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' });
});

function optionId(index: number) {
	return `${listboxId}-${index}`;
}

type LabelPart = { text: string; matches: boolean };

// Only mark literal visible-label matches. Alias, romaji, and normalized
// matches remain plain; the template always binds text and never HTML.
function labelParts(label: string): LabelPart[] {
	const needle = query.value.trim();
	if (needle === '') return [{ text: label, matches: false }];
	const lowerLabel = label.toLocaleLowerCase();
	const lowerNeedle = needle.toLocaleLowerCase();
	const index = lowerLabel.indexOf(lowerNeedle);
	if (index < 0) return [{ text: label, matches: false }];
	return [
		...(index > 0 ? [{ text: label.slice(0, index), matches: false }] : []),
		{ text: label.slice(index, index + needle.length), matches: true },
		...(index + needle.length < label.length ? [{ text: label.slice(index + needle.length), matches: false }] : []),
	];
}

function isPublicSearchEvidence(value: string): boolean {
	return value.length > 0
		&& value.length <= 96
		&& /^[\p{L}\p{N}][\p{L}\p{N} .:/_-]*$/u.test(value)
		&& !value.startsWith('i18n.')
		&& !/(?:^|[._])(draft|edited|value)(?:[._]|$)/iu.test(value)
		&& !/^(?:editor|props|state|model)\b/iu.test(value);
}

function searchEvidence(item: SettingsSearchDescriptor): string | undefined {
	const needle = query.value.trim().toLocaleLowerCase();
	if (needle === '') return undefined;
	const matches = (value: string) => value.toLocaleLowerCase().includes(needle);
	// Preference keys are explicit persistence metadata and can safely explain a
	// hit. The adapter also carries model expressions in `aliases` for search,
	// so only a short non-path alias may cross this visual boundary.
	const preferenceKey = (item.preferenceKeys ?? []).find(value => isPublicSearchEvidence(value) && matches(value));
	if (preferenceKey != null) return preferenceKey;
	return (item.aliases ?? []).find(value => isPublicSearchEvidence(value) && !value.includes('.') && matches(value));
}

type WorkerMessage =
	| { type: 'initialized'; catalogRevision: number }
	| { type: 'result'; catalogRevision: number; queryRevision: number; response: SearchResponse }
	| { type: 'error'; catalogRevision: number; queryRevision?: number };

function clearSearchPending() {
	if (searchPendingTimer != null) window.clearTimeout(searchPendingTimer);
	searchPendingTimer = null;
	isSearchPending.value = false;
	isSearching.value = false;
}

function terminateWorker() {
	worker?.terminate();
	worker = null;
	initializedCatalogRevision = -1;
}

function fallBackToSynchronousSearch() {
	workerUnavailable = true;
	terminateWorker();
}

function ensureWorker(): boolean {
	if (workerUnavailable) return false;
	if (worker != null) return true;
	try {
		worker = new SettingsSearchWorker();
		worker.onmessage = event => onWorkerMessage(event.data as WorkerMessage);
		worker.onerror = () => {
			fallBackToSynchronousSearch();
			search();
		};
		return true;
	} catch {
		fallBackToSynchronousSearch();
		return false;
	}
}

function syncWorkerCatalog() {
	const thisCatalogRevision = ++catalogRevision;
	initializedCatalogRevision = -1;
	if (props.catalogState !== 'ready' || props.catalog == null || !ensureWorker() || worker == null) return;
	// 旗鯖fork: ⚠️props 越しの catalog は Vue のリアクティブなプロキシ。
	//   postMessage の構造化複製は**プロキシを複製できない**ため、
	//   そのまま渡すと `DOMException: Proxy object could not be cloned.` で
	//   ⚠️ワーカーの初期化ごと失敗し、設定検索が使えなくなる。
	//   ⚠️toRaw で生のデータに戻し、入れ子も含めて複製できる形にしてから送ること。
	const rawCatalog = toRaw(props.catalog);
	worker.postMessage({
		type: 'initialize',
		catalogRevision: thisCatalogRevision,
		catalog: {
			descriptors: toRaw(rawCatalog.descriptors).map(descriptor => ({
				...toRaw(descriptor),
				aliases: [...toRaw(descriptor).aliases],
				legacyLabels: [...toRaw(descriptor).legacyLabels],
				preferenceKeys: [...toRaw(descriptor).preferenceKeys],
				relatedIds: [...toRaw(descriptor).relatedIds],
				related: toRaw(descriptor).related.map(relation => ({ ...toRaw(relation) })),
			})),
			canonicalStableIdByLegacyStableId: [...toRaw(rawCatalog.canonicalStableIdByLegacyStableId)],
			fallbackRoutes: [...toRaw(rawCatalog.fallbackRoutes)],
		},
	});
}

function onWorkerMessage(message: WorkerMessage) {
	if (message.catalogRevision !== catalogRevision) return;
	if (message.type === 'initialized') {
		initializedCatalogRevision = message.catalogRevision;
		search();
		return;
	}
	if (message.type === 'error') {
		fallBackToSynchronousSearch();
		if (message.queryRevision == null || message.queryRevision === revision) search();
		return;
	}
	if (message.queryRevision !== revision) return;
	clearSearchPending();
	response.value = message.response;
	isSearching.value = false;
}

function search() {
	const thisRevision = ++revision;
	clearSearchPending();
	activeIndex.value = -1;
	if (query.value === '' || props.catalog == null) {
		response.value = null;
		isSearching.value = false;
		return;
	}
	response.value = null;
	if (props.catalogState !== 'ready') {
		isSearching.value = false;
		return;
	}
	if (workerUnavailable) {
		// Workers can be unavailable in older browsers or restrictive embeds. Keep
		// search usable; unlike the worker path this makes no artificial delay claim.
		response.value = searchSettingsV2(props.catalog, query.value);
		isSearching.value = false;
		return;
	}
	if (initializedCatalogRevision !== catalogRevision || worker == null) {
		// The catalog may be ready while its worker index is still initializing.
		// It is still unsafe to announce an empty result for the current query.
		isSearchPending.value = true;
		isSearching.value = false;
		return;
	}

	// A request is pending from postMessage onward. The visible status appears
	// only after 150ms so quick searches never flash a false 0-result state.
	isSearchPending.value = true;
	searchPendingTimer = window.setTimeout(() => {
		if (thisRevision === revision) isSearching.value = true;
	}, 150);
	worker.postMessage({ type: 'search', catalogRevision, queryRevision: thisRevision, query: query.value });
}

function onCompositionEnd() {
	isComposing.value = false;
	search();
}

function onKeydown(event: KeyboardEvent) {
	if (event.isComposing || isComposing.value) return;
	const length = optionItems.value.length;
	if (length === 0) return;
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		activeIndex.value = (activeIndex.value + 1) % length;
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		activeIndex.value = (activeIndex.value - 1 + length) % length;
	} else if (event.key === 'Home') {
		event.preventDefault();
		activeIndex.value = 0;
	} else if (event.key === 'End') {
		event.preventDefault();
		activeIndex.value = length - 1;
	} else if (event.key === 'Enter' && activeIndex.value >= 0) {
		event.preventDefault();
		select(optionItems.value[activeIndex.value]);
	}
}

function select(item: SettingsSearchDescriptor) {
	emit('select', item);
}

function onPanelKeydown(event: KeyboardEvent) {
	if (event.isComposing || isComposing.value) return;
	if (event.key === 'Tab') {
		const focusables = Array.from(panelEl.value?.querySelectorAll<HTMLElement>([
			'input:not([disabled])',
			'button:not([disabled]):not([tabindex="-1"])',
			'[href]:not([tabindex="-1"])',
			'[tabindex]:not([tabindex="-1"])',
		].join(',')) ?? []);
		const index = focusables.indexOf(event.target as HTMLElement);
		const atBoundary = event.shiftKey ? index === 0 : index === focusables.length - 1;
		if (!atBoundary) return;
		event.preventDefault();
		event.stopPropagation();
		close('tab', event.shiftKey ? 'previous' : 'next');
		return;
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		close('escape');
		return;
	}
	// Only the combobox input owns result navigation. Once focus reaches the
	// close/retry controls, their native Enter/Space/Home/End behavior must not
	// be interpreted as an active-result command.
	if (event.target === inputEl.value) onKeydown(event);
}

function close(reason: SettingsSearchCloseEvent['reason'], direction?: SettingsSearchCloseEvent['direction']) {
	++revision;
	clearSearchPending();
	isSearching.value = false;
	emit('close', { reason, ...(direction ? { direction } : {}) });
}

function updateReducedMotion() {
	prefersReducedMotion.value = reducedMotionQuery.matches;
}

onMounted(() => reducedMotionQuery.addEventListener('change', updateReducedMotion));
onBeforeUnmount(() => {
	clearSearchPending();
	terminateWorker();
	reducedMotionQuery.removeEventListener('change', updateReducedMotion);
});
</script>

<style lang="scss" module>
.backdrop {
	position: fixed;
	inset: 0;
	display: grid;
	place-items: start center;
	padding: max(16px, env(safe-area-inset-top)) 16px 16px;
	background: color-mix(in srgb, var(--MI_THEME-bg) 58%, transparent);
}

.panel {
	width: min(520px, 100%);
	max-height: min(720px, calc(100dvh - 32px));
	overflow: auto;
	overscroll-behavior: contain;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 24px;
	background: var(--MI_THEME-bg);
	color: var(--MI_THEME-fg);
	box-shadow: 0 16px 44px color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent);
	font-family: 'Noto Sans JP', var(--MI-font), sans-serif;
}

.searchHead {
	display: flex;
	align-items: center;
	gap: 11px;
	min-height: 64px;
	padding: 0 12px 0 20px;
	border-bottom: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 72%, transparent);
	background: var(--MI_THEME-panel);
	/* 旗鯖fork: 親の .panel が border-radius + overflow で角を切り抜くため、
	   内側の光る枠が角で途切れていた。上端の角丸を親に合わせて追従させる。 */
	border-start-start-radius: 23px;
	border-start-end-radius: 23px;

	> i { color: var(--MI_THEME-accent); font-size: 1.2rem; }
	&:focus-within { box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--MI_THEME-accent) 58%, transparent); }
}

.input {
	min-width: 0;
	flex: 1;
	border: 0;
	outline: 0;
	background: transparent;
	color: var(--MI_THEME-fg);
	font: inherit;
	font-size: 0.95rem;
	font-weight: 700;
	line-height: 1.5;

	&::placeholder { color: color-mix(in srgb, var(--MI_THEME-fg) 48%, transparent); font-weight: 400; }
}

.count {
	border-radius: 999px;
	padding: 5px 11px;
	background: var(--MI_THEME-buttonBg);
	color: color-mix(in srgb, var(--MI_THEME-fg) 66%, transparent);
	font-size: 0.72rem;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.close {
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	border: 0;
	border-radius: 999px;
	background: transparent;
	color: var(--MI_THEME-fg);
	cursor: pointer;
	/* ⚠️ボタン既定の字面を引き継がせない。 */
	font: inherit;
	font-size: 1.2rem;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: -3px; }
}

.live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.body { padding: 14px 20px 20px; }
.group + .group { margin-top: 18px; }
.groupTitle { margin: 0 0 10px; color: var(--MI_THEME-accent); font-size: 0.75rem; font-weight: 700; line-height: 1.5; }
.groupTitle > i { margin-right: 6px; }

.result {
	display: flex;
	width: 100%;
	min-width: 0;
	min-height: 44px;
	align-items: flex-start;
	gap: 12px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 72%, transparent);
	border-radius: 16px;
	padding: 13px 15px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	cursor: pointer;
	font: inherit;
	text-align: start;

	+ .result { margin-top: 8px; }
	&[aria-selected='true'], &:hover,
	&[aria-selected='true']:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 56%, var(--MI_THEME-divider)); background: light-dark(color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)), color-mix(in srgb, var(--MI_THEME-accent) 16%, var(--MI_THEME-panel))); }
	&:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: 2px; }
}

.icon { display: grid; flex: 0 0 36px; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: light-dark(color-mix(in srgb, var(--MI_THEME-accent) 16%, var(--MI_THEME-panel)), color-mix(in srgb, var(--MI_THEME-accent) 24%, var(--MI_THEME-panel))); color: var(--MI_THEME-accent); font-size: 1.1rem; }
.resultText { min-width: 0; flex: 1; }
.label, .path, .description { display: block; line-break: strict; word-break: normal; text-wrap: pretty; }
.label { font-size: 0.86rem; font-weight: 700; line-height: 1.55; }
.match { border-radius: 4px; background: color-mix(in srgb, var(--MI_THEME-accent) 26%, transparent); color: inherit; font: inherit; font-weight: 800; }
.path, .description { margin-top: 3px; color: color-mix(in srgb, var(--MI_THEME-fg) 61%, transparent); font-size: 0.72rem; line-height: 1.6; }
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.suggestion { display: inline-flex; min-width: 0; max-width: 100%; min-height: 44px; flex: 0 1 auto; align-items: center; gap: 7px; border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent); border-radius: 999px; padding: 8px 14px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; font: inherit; font-size: .8rem; line-height: 1.45; text-align: start; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; &:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 56%, var(--MI_THEME-divider)); background: var(--MI_THEME-buttonHoverBg); } &[aria-selected='true'], &[aria-selected='true']:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 56%, var(--MI_THEME-divider)); background: light-dark(color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)), color-mix(in srgb, var(--MI_THEME-accent) 16%, var(--MI_THEME-panel))); } &:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: 2px; } }
.suggestion > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.suggestionEvidence { max-inline-size: 13rem; overflow: hidden; border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 35%, var(--MI_THEME-divider)); border-radius: 999px; padding: 2px 6px; color: color-mix(in srgb, var(--MI_THEME-fg) 68%, transparent); font: 600 .65rem/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
.empty, .status, .neutral { display: grid; place-items: center; gap: 8px; min-height: clamp(96px, 18dvh, 136px); padding: 20px; color: color-mix(in srgb, var(--MI_THEME-fg) 65%, transparent); font-size: .85rem; line-height: 1.7; text-align: center; line-break: strict; text-wrap: pretty; }
.empty > i, .status > i { color: var(--MI_THEME-accent); font-size: 1.5rem; }
.empty > p { margin: 0; font-size: .75rem; }
.retry { min-height: 44px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; padding: 8px 16px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; font: inherit; font-size: .8rem; font-weight: 700; &:hover { background: var(--MI_THEME-buttonHoverBg); } &:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: 2px; } }
.panel[data-animated='on'] .status > i { animation: spin 900ms linear infinite; }

@keyframes spin { to { transform: rotate(1turn); } }

/* 旗鯖fork: 開くときは少し下から、わずかに縮んだ状態で立ち上がる。
   ⚠️閉じるときは短くする。待たされる感じを残さないため。 */
:global(.settings-search-panel-enter-active)[data-motion-enabled='on'] .panel {
	transition: opacity 240ms cubic-bezier(.2, .9, .2, 1), transform 280ms cubic-bezier(.2, .9, .2, 1);
}

:global(.settings-search-panel-leave-active)[data-motion-enabled='on'] .panel {
	transition: opacity 140ms ease-out, transform 140ms ease-out;
}

:global(.settings-search-panel-enter-from)[data-motion-enabled='on'] .panel {
	opacity: 0;
	transform: translateY(-14px) scale(.965);
}

:global(.settings-search-panel-leave-to)[data-motion-enabled='on'] .panel {
	opacity: 0;
	transform: translateY(-8px) scale(.985);
}

/* 背景の暗幕も一緒に。⚠️パネルより気持ち早く出して、開いた感じを先に伝える。 */
:global(.settings-search-panel-enter-active)[data-motion-enabled='on'],
:global(.settings-search-panel-leave-active)[data-motion-enabled='on'] {
	transition: opacity 200ms ease;
}

:global(.settings-search-panel-enter-from)[data-motion-enabled='on'],
:global(.settings-search-panel-leave-to)[data-motion-enabled='on'] {
	opacity: 0;
}

:global(.settings-search-panel-leave-active)[data-motion-enabled='on'] {
	pointer-events: none;
}

:global(.settings-search-panel-leave-active)[data-motion-enabled='on'] .panel {
	transition-duration: 150ms;
}

/* 結果の入れ替え。⚠️打ち込むたびに走るので、短くしないと文字入力の邪魔になる。 */
:global(.settings-search-results-enter-active),
:global(.settings-search-results-leave-active) {
	transition: opacity 180ms cubic-bezier(.2, .9, .2, 1), transform 180ms cubic-bezier(.2, .9, .2, 1);
}

:global(.settings-search-results-enter-from) {
	opacity: 0;
	transform: translateY(8px);
}

:global(.settings-search-results-leave-to) {
	opacity: 0;
	transform: translateY(-6px);
}

/* 1件ずつ順に立ち上がる。⚠️並び順(=点の高い順)に出るので、上から読める。 */
@keyframes settings-search-result-in {
	from { opacity: 0; transform: translateY(6px); }
	to { opacity: 1; transform: none; }
}

.panel[data-animated='on'] .result {
	animation: settings-search-result-in .26s cubic-bezier(.2, .9, .2, 1) both;
	/* ⚠️打鍵のたびに走るので、遅延は必ず頭打ちにする。
	   積み上がると入力が引っかかるように感じる。 */
	animation-delay: min(calc(var(--i, 0) * 26ms), 130ms);
}

@media (prefers-reduced-motion: reduce) {
	.panel[data-animated='on'] .status > i { animation: none; }
	:global(.settings-search-panel-enter-active) .panel,
	:global(.settings-search-panel-leave-active) .panel,
	:global(.settings-search-results-enter-active),
	:global(.settings-search-results-leave-active) { transition: none; }
}
</style>
