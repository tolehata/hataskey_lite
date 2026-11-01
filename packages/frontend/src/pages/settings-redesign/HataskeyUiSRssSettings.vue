<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section class="rssSettings" :aria-label="copy.settings" data-settings-rss-section="true" data-settings-search-group-id="settings.group.hataskey-ui-s.rss">
	<div class="sectionHeading">
		<div><span class="eyebrow">RSS</span><h3 id="hataskey-ui-s-rss-heading" ref="rssHeading" tabindex="-1">{{ copy.settings }}</h3><p>{{ copy.deviceOnly }}</p></div>
	</div>
	<div class="settingsGrid">
		<label class="toggle" :data-settings-search-id="searchId('hataskeyUi3RssEnabled')"><span>{{ copy.enabled }}</span><input type="checkbox" :checked="enabled" @change="setEnabled(($event.target as HTMLInputElement).checked)"></label>
		<label class="toggle" :data-settings-search-id="searchId('hataskeyUi3RssAutoSwitch')"><span>{{ copy.autoSwitch }}</span><input type="checkbox" :checked="autoSwitch" @change="prefer.commit('hataskeyUi3RssAutoSwitch', ($event.target as HTMLInputElement).checked)"></label>
		<label :data-settings-search-id="searchId('hataskeyUi3RssReadSeconds')"><span>{{ copy.readSeconds }}</span><select :value="readSeconds" @change="setReadSeconds(($event.target as HTMLSelectElement).value)"><option v-for="seconds in [6, 10, 15, 30]" :key="seconds" :value="seconds">{{ seconds }} {{ copy.seconds }}</option></select></label>
		<label :data-settings-search-id="searchId('hataskeyUi3RssReadMode')"><span>{{ copy.readMode }}</span><select :value="readMode" @change="setReadMode(($event.target as HTMLSelectElement).value)"><option value="full">{{ copy.full }}</option><option value="summary">{{ copy.summary }}</option></select></label>
	</div>
	<div class="feeds" :data-settings-search-id="searchId('hataskeyUi3RssFeeds')">
		<div class="feedHeading"><h4>{{ copy.feeds }} ({{ feeds.length }}/5)</h4><button type="button" @click="importDeck">{{ copy.importDeck }}</button></div>
		<p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>
		<p class="success" role="status">{{ saved ? copy.feedSaved : '' }}</p>
		<p v-if="feeds.length === 0" class="empty">{{ copy.noFeeds }}</p>
		<div v-for="(feed, index) in feeds" :key="feed.id" class="feed" :style="{ '--feed-color': safeColor(feed.color) }">
			<div class="feedTop"><span class="feedNumber">{{ index + 1 }}</span><div class="feedActions"><button type="button" :disabled="index === 0" :aria-label="copy.moveUp" @click="moveFeed(index, -1)"><i class="ti ti-arrow-up" aria-hidden="true"></i></button><button type="button" :disabled="index === feeds.length - 1" :aria-label="copy.moveDown" @click="moveFeed(index, 1)"><i class="ti ti-arrow-down" aria-hidden="true"></i></button><button type="button" :aria-label="copy.removeFeed" @click="removeFeed(feed.id)"><i class="ti ti-trash" aria-hidden="true"></i></button></div></div>
			<div class="feedFields"><label><span>{{ copy.feedUrl }}</span><input v-model="draftUrls[feed.id]" type="url" inputmode="url" autocomplete="url" maxlength="8192" :aria-invalid="!validFeedUrl(draftUrls[feed.id])" @blur="saveUrl(feed.id)" @keydown.enter.prevent="saveUrl(feed.id)"></label><label><span>{{ copy.feedName }}</span><input :value="feed.name || ''" type="text" maxlength="100" @change="setName(feed.id, ($event.target as HTMLInputElement).value)"></label><label class="colorField"><span>{{ copy.feedColor }}</span><input :value="safeColor(feed.color)" type="color" @change="setColor(feed.id, ($event.target as HTMLInputElement).value)"></label></div>
			<p v-if="!validFeedUrl(draftUrls[feed.id])" class="validation" role="alert">{{ copy.invalidUrl }}</p>
		</div>
		<form v-if="feeds.length < 5" class="addFeed" @submit.prevent="addFeed" @input="saved = false">
			<div class="addFeedFields">
				<label><span>{{ copy.feedUrl }}</span><input v-model="newUrl" type="url" inputmode="url" autocomplete="url" maxlength="8192" placeholder="https://example.com/feed.xml" :aria-invalid="newUrl !== '' && !validFeedUrl(newUrl)"></label>
				<label><span>{{ copy.feedName }}</span><input v-model="newName" type="text" maxlength="100"></label>
				<label class="colorField"><span>{{ copy.feedColor }}</span><input v-model="newColor" type="color"></label>
			</div>
			<p v-if="newUrl !== '' && !validFeedUrl(newUrl)" class="validation" role="alert">{{ copy.invalidUrl }}</p>
			<div class="addFeedActions"><button class="addFeedButton" type="submit" :disabled="!validFeedUrl(newUrl)" @click.prevent="addFeed"><i class="ti ti-plus" aria-hidden="true"></i> {{ copy.addFeed }}</button></div>
			<p class="saveDescription">{{ copy.saveDescription }}</p>
		</form>
		<p v-else class="empty">{{ copy.maxFeeds }}</p>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onActivated, onMounted, reactive, ref, watch } from 'vue';
import { canonicalSearchIdForPreferenceKey } from './settings-preferences-catalog.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { useRouter } from '@/router.js';
import { genId } from '@/utility/id.js';

type Feed = { id: string; url: string; name?: string; color?: string };
const copy = i18n.ts._hata._hataskeyUi3._rss;
const feeds = computed(() => prefer.r.hataskeyUi3RssFeeds.value as Feed[]);
const enabled = computed(() => prefer.r.hataskeyUi3RssEnabled.value);
const autoSwitch = computed(() => prefer.r.hataskeyUi3RssAutoSwitch.value);
const readSeconds = computed(() => prefer.r.hataskeyUi3RssReadSeconds.value);
const readMode = computed(() => prefer.r.hataskeyUi3RssReadMode.value);
const draftUrls = reactive<Record<string, string>>({});
const newUrl = ref('');
const newName = ref('');
const newColor = ref('#4a9eff');
const feedback = ref('');
const saved = ref(false);
const rssHeading = ref<HTMLElement | null>(null);
const router = useRouter();

function focusHashHeading(): void {
	if (router.getCurrentFullPath().split('#')[1] !== 'hataskey-ui-s-rss-heading') return;
	void nextTick(() => window.requestAnimationFrame(() => {
		const heading = rssHeading.value;
		if (router.getCurrentFullPath().split('#')[1] !== 'hataskey-ui-s-rss-heading' || !heading?.isConnected) return;
		heading.scrollIntoView({ behavior: 'auto', block: 'center' });
		heading.focus({ preventScroll: true });
	}));
}

onMounted(focusHashHeading);
onActivated(focusHashHeading);
watch(router.currentRef, focusHashHeading);

for (const feed of feeds.value) draftUrls[feed.id] = feed.url;

watch(feeds, (current, previous) => {
	const ids = new Set(current.map(feed => feed.id));
	const priorUrls = new Map(previous.map(feed => [feed.id, feed.url]));
	for (const feed of current) {
		if (!(feed.id in draftUrls) || draftUrls[feed.id] === priorUrls.get(feed.id)) draftUrls[feed.id] = feed.url;
	}
	for (const id of Object.keys(draftUrls)) if (!ids.has(id)) delete draftUrls[id];
});

function searchId(key: string): string { return canonicalSearchIdForPreferenceKey(key); }

function validFeedUrl(value: string | undefined): boolean {
	if (value == null || value.trim() === '' || value.trim().length > 8192 || /\s/u.test(value.trim())) return false;
	try {
		const url = new URL(value.trim());
		return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === '';
	} catch { return false; }
}

function isImportableFeed(value: unknown): value is Feed {
	if (value == null || typeof value !== 'object') return false;
	const feed = value as Record<string, unknown>;
	return typeof feed.id === 'string' && typeof feed.url === 'string' && validFeedUrl(feed.url);
}

function safeColor(value: string | undefined): string { return value != null && /^#[0-9a-f]{6}$/iu.test(value) ? value : '#4a9eff'; }

function commitFeeds(next: Feed[]): void { if (next.length <= 5 && next.every(feed => validFeedUrl(feed.url))) prefer.commit('hataskeyUi3RssFeeds', next); }

function setEnabled(value: boolean): void { prefer.commit('hataskeyUi3RssEnabled', value); }

function setReadSeconds(value: string): void { const n = Number(value); if (n === 6 || n === 10 || n === 15 || n === 30) prefer.commit('hataskeyUi3RssReadSeconds', n); }

function setReadMode(value: string): void { if (value === 'full' || value === 'summary') prefer.commit('hataskeyUi3RssReadMode', value); }

function saveUrl(id: string): void {
	const url = (draftUrls[id] ?? '').trim();
	if (!validFeedUrl(url)) return;
	commitFeeds(feeds.value.map(feed => feed.id === id ? { ...feed, url } : feed));
}

function setName(id: string, value: string): void { commitFeeds(feeds.value.map(feed => feed.id === id ? { ...feed, name: value.trim().slice(0, 100) || undefined } : feed)); }

function setColor(id: string, value: string): void { commitFeeds(feeds.value.map(feed => feed.id === id ? { ...feed, color: safeColor(value) } : feed)); }

function removeFeed(id: string): void { commitFeeds(feeds.value.filter(feed => feed.id !== id)); }

function moveFeed(index: number, step: number): void {
	const target = index + step;
	if (target < 0 || target >= feeds.value.length) return;
	const next = [...feeds.value];
	[next[index], next[target]] = [next[target], next[index]];
	commitFeeds(next);
}

function addFeed(): void {
	if (!validFeedUrl(newUrl.value) || feeds.value.length >= 5) return;
	const feed: Feed = { id: genId(), url: newUrl.value.trim(), color: newColor.value };
	if (newName.value.trim()) feed.name = newName.value.trim().slice(0, 100);
	commitFeeds([...feeds.value, feed]);
	newUrl.value = '';
	newName.value = '';
	feedback.value = '';
	saved.value = true;
}

function importDeck(): void {
	saved.value = false;
	const source: unknown = prefer.r['simpleUi.deckRssFeeds'].value;
	if (!Array.isArray(source) || source.length === 0) { feedback.value = copy.importNothing; return; }
	const imported: unknown[] = source.slice(0, 5);
	if (!imported.every(isImportableFeed)) { feedback.value = copy.importInvalid; return; }
	const next = imported.map(feed => ({ id: genId(), url: feed.url.trim(), name: typeof feed.name === 'string' ? feed.name.trim().slice(0, 100) || undefined : undefined, color: safeColor(feed.color) }));
	commitFeeds(next);
	for (const feed of next) draftUrls[feed.id] = feed.url;
	prefer.commit('hataskeyUi3RssEnabled', prefer.r['simpleUi.deckRssEnabled'].value);
	feedback.value = '';
}
</script>

<style lang="scss" scoped>
.rssSettings { display: grid; gap: 16px; min-width: 0; container: settings-rss / inline-size; padding: clamp(16px, 4%, 24px); border: 1px solid var(--MI_THEME-divider); border-radius: 20px; background: var(--MI_THEME-panel); }
.sectionHeading h3, .feedHeading h4 { margin: 0; }.sectionHeading p { margin: 8px 0 0; color: var(--MI_THEME-fgTransparentWeak); }.eyebrow { display: block; margin-bottom: 5px; color: var(--MI_THEME-accent); font-size: .75rem; font-weight: 800; letter-spacing: .08em; }
.settingsGrid, .feedFields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px; }.settingsGrid > label, .feedFields > label, .addFeedFields > label { min-width: 0; display: grid; gap: 6px; font-weight: 700; font-size: .88rem; }.settingsGrid .toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.toggle input { width: 20px; height: 20px; accent-color: var(--MI_THEME-accent); }
input:not([type='checkbox']), select { box-sizing: border-box; min-width: 0; width: 100%; min-height: 44px; padding: 8px 10px; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); font: inherit; }input[type='color'] { min-width: 54px; padding: 4px; }input[aria-invalid='true'] { border-color: var(--MI_THEME-warn); }.colorField { max-width: 100px; }
.feeds { display: grid; gap: 12px; padding-top: 12px; border-top: 1px solid var(--MI_THEME-divider); }.feedHeading, .feedTop, .feedActions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.feedHeading { flex-wrap: wrap; }.feedActions { justify-content: flex-end; }.feed { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--MI_THEME-divider); border-inline-start: 4px solid var(--feed-color); border-radius: 12px; background: color-mix(in srgb, var(--MI_THEME-bg) 55%, var(--MI_THEME-panel)); }.feedNumber { color: var(--feed-color); font-weight: 900; }.addFeed { display: grid; gap: 10px; }.addFeedFields { display: grid; grid-template-columns: minmax(180px, 2fr) minmax(120px, 1fr) auto; align-items: end; gap: 10px; }.addFeedActions { display: flex; }.addFeedButton { min-width: 180px; border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); font-weight: 700; }.saveDescription { margin: 0; color: var(--MI_THEME-fgTransparentWeak); font-size: .85rem; }.success { margin: 0; color: var(--MI_THEME-success); font-size: .85rem; }.success:empty { display: none; }
button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); font: inherit; cursor: pointer; }button:hover, button:focus-visible { border-color: var(--MI_THEME-accent); }button:disabled { opacity: .45; cursor: default; }.validation, .feedback { margin: 0; color: var(--MI_THEME-warn); font-size: .85rem; }.empty { margin: 0; color: var(--MI_THEME-fgTransparentWeak); }
@container settings-rss (max-width: 680px) { .addFeedButton { width: 100%; min-width: 0; }.addFeedFields { grid-template-columns: minmax(0, 1fr) auto; }.addFeedFields > label:first-child, .addFeedFields > label:nth-child(2) { grid-column: 1 / -1; } }
</style>
