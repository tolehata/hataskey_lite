<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: デッキのカラム用タイムライン。標準表示と同じ UI3 のノートを縦に並べる。
スクロールはカラム(デッキのタブ枠)が受け持ち、読んでいる途中の新着は上部の知らせに溜める。
-->
<template>
<div ref="rootEl" data-hk3-deck-timeline :class="$style.root">
	<!-- ローカルのカラムでは、LTL の絵文字投票をカラム上部に出す(標準表示の上部バナーと同じ投票ストア)。 -->
	<div v-if="emojiVoteRound && emojiVoteAnchor" :class="$style.vote">
		<MkLtlEmojiVote
			:key="`hk3-deck-emoji-vote:${emojiVoteRound.id}`"
			:round="emojiVoteRound"
			:choice="emojiVoteChoice"
			:now="emojiVoteNow"
			:phase="emojiVotePhase"
			:declined="emojiVoteDeclined"
			:active="voteActive"
			:effectTarget="emojiVoteEffectTarget"
			:submitting="emojiVoteSubmitting"
			:voteError="emojiVoteError"
			:canVote="!!$i"
			:claimEffect="claimEmojiVoteEffect"
			navbar
			@vote="voteEmoji"
			@dismiss="dismissEmojiVote"
		/>
	</div>
	<button v-if="queue.length > 0" type="button" :class="$style.queue" @click="flushQueue">
		<ArrowUp :size="16"/><span>{{ queue.length }}</span>
	</button>

	<div v-if="loading && notes.length === 0" :class="$style.state"><MkLoading/></div>
	<div v-else-if="error && notes.length === 0" :class="$style.state">
		<span>{{ copy.loadFailed }}</span>
		<button type="button" :class="$style.retry" @click="reload()">{{ copy.retry }}</button>
	</div>
	<div v-else-if="notes.length === 0" :class="$style.state">{{ copy.noNotes }}</div>

	<div ref="listEl" :class="$style.list">
		<template v-for="note in notes" :key="note.id">
			<Hk3Note :data-note-removal-id="note.id" :note="note" size="sm" :inLocal="src === 'local'" :inSocial="src === 'social'" :hideSensitive="!store.s.tl.filter.withSensitive"/>
			<MkAd v-if="note._shouldInsertAd_" :class="$style.ad" :preferForms="['horizontal', 'horizontal-big']"/>
		</template>
	</div>
	<div v-if="notes.length > 0" ref="sentinelEl" :class="$style.sentinel">
		<MkLoading v-if="loadingMore" :em="true"/>
		<button v-else-if="loadMoreFailed" type="button" :class="$style.retry" @click="loadMore">{{ copy.loadOlderFailed }}</button>
		<span v-else-if="!hasMore" :class="$style.end">{{ copy.endOfTimeline }}</span>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { ArrowUp } from '@lucide/vue';
import * as Misskey from 'cherrypick-js';
import Hk3Note from './Hk3Note.vue';
import type { TimelineAdMarker } from '@/utility/timeline-ad.js';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import { prefer } from '@/preferences.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { instance } from '@/instance.js';
import { markTimelineAdPage, shouldInsertStreamingAd } from '@/utility/timeline-ad.js';
import { globalEvents, useGlobalEvent } from '@/events.js';
import { $i } from '@/i.js';
import MkLtlEmojiVote from '@/components/MkLtlEmojiVote.vue';
import { useLtlEmojiVote } from '@/utility/ltl-emoji-vote.js';
import { getLtlEmojiVoteAnchor } from '@/utility/ltl-emoji-vote-anchor.js';
import { useNoteRemoval } from '@/composables/use-note-removal.js';

type Src = 'home' | 'local' | 'social' | 'global' | 'mentions' | 'directs' | 'list' | 'antenna' | 'channel';

const props = withDefaults(defineProps<{
	src: Src;
	list?: string;
	antenna?: string;
	channel?: string;
	withRenotes?: boolean;
	emojiVoteActive?: boolean;
	emojiVoteEffectTarget?: HTMLElement | null;
}>(), {
	withRenotes: true,
	emojiVoteActive: false,
	emojiVoteEffectTarget: null,
});

const copy = i18n.ts._hata._hataskeyUi3;
const PAGE = 20;
const QUEUE_MAX = 99;

const rootEl = shallowRef<HTMLElement | null>(null);
const listEl = shallowRef<HTMLElement | null>(null);
const removal = useNoteRemoval(() => listEl.value);
const sentinelEl = shallowRef<HTMLElement | null>(null);
type TimelineNote = Misskey.entities.Note & TimelineAdMarker;
const notes = ref<TimelineNote[]>([]);
const queue = ref<TimelineNote[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const loadMoreFailed = ref(false);
const error = ref(false);
const hasMore = ref(true);

// ===== LTL の絵文字投票 =====
const VOTE_TRIGGER = '絵文字を選ぶぞ';
const voteActive = computed(() => props.src === 'local' && props.emojiVoteActive && prefer.r.ltlEmojiVoteEnabled.value);
const {
	round: emojiVoteRound, choice: emojiVoteChoice, now: emojiVoteNow, phase: emojiVotePhase,
	submitting: emojiVoteSubmitting, voteError: emojiVoteError, declined: emojiVoteDeclined,
	refresh: refreshEmojiVote, vote: voteEmoji, dismiss: dismissEmojiVote, claimEffect: claimEmojiVoteEffect,
} = useLtlEmojiVote(voteActive);
const emojiVoteAnchor = computed(() => voteActive.value && emojiVotePhase.value !== 'idle' && !loading.value
	? getLtlEmojiVoteAnchor([...queue.value, ...notes.value], emojiVoteRound.value?.noteId, $i, {
		mutedWords: [...($i?.mutedWords ?? []), ...($i?.hardMutedWords ?? [])],
		withSensitive: store.s.tl.filter.withSensitive,
	}) : null);
watch(() => voteActive.value
	? [...queue.value, ...notes.value].filter(note => note.text?.trim() === VOTE_TRIGGER).map(note => note.id).join(',')
	: '', ids => {
	if (ids) void refreshEmojiVote(ids.split(',')[0]);
});

const motion = () => prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== 取得 =====
async function fetchPage(untilId?: string): Promise<Misskey.entities.Note[]> {
	const filter = store.s.tl.filter;
	const base = { limit: PAGE, untilId };
	const tl = { ...base, withRenotes: props.withRenotes, withFiles: filter.onlyFiles ? true : undefined };
	switch (props.src) {
		case 'home': return await misskeyApi('notes/timeline', tl);
		case 'local': return await misskeyApi('notes/local-timeline', tl);
		case 'social': return await misskeyApi('notes/hybrid-timeline', tl);
		case 'global': return await misskeyApi('notes/global-timeline', tl);
		case 'mentions': return await misskeyApi('notes/mentions', base);
		case 'directs': return await misskeyApi('notes/mentions', { ...base, visibility: 'specified' });
		case 'list': return props.list ? await misskeyApi('notes/user-list-timeline', { ...tl, listId: props.list }) : [];
		case 'antenna': return props.antenna ? await misskeyApi('antennas/notes', { ...base, antennaId: props.antenna }) : [];
		case 'channel': return props.channel ? await misskeyApi('channels/timeline', { ...base, channelId: props.channel }) : [];
		default: return [];
	}
}

let loadSeq = 0;
let adInsertionCounter = 0;

async function reload() {
	removal.cancelAll();
	const seq = ++loadSeq;
	adInsertionCounter = 0;
	loading.value = true;
	error.value = false;
	queue.value = [];
	loadMoreFailed.value = false;
	disconnect();
	try {
		const result = await fetchPage();
		if (seq !== loadSeq) return;
		notes.value = markTimelineAdPage(result, 'initial');
		// タイムラインは件数が上限未満でも続きがあることがある。空になった時だけ終端とする。
		hasMore.value = result.length > 0;
		connect();
	} catch (err) {
		if (seq !== loadSeq) return;
		console.error('Hataskey UI 3 deck timeline failed', err);
		error.value = true;
		notes.value = [];
	} finally {
		if (seq === loadSeq) loading.value = false;
	}
}

async function loadMore() {
	if (loadingMore.value || loading.value || !hasMore.value || notes.value.length === 0) return;
	loadingMore.value = true;
	const seq = loadSeq;
	try {
		const result = await fetchPage(notes.value[notes.value.length - 1].id);
		if (seq !== loadSeq) return;
		const known = new Set(notes.value.map(note => note.id));
		notes.value.push(...markTimelineAdPage(result, 'older').filter(note => !known.has(note.id)));
		hasMore.value = result.length > 0;
		loadMoreFailed.value = false;
	} catch {
		loadMoreFailed.value = true;
	} finally {
		loadingMore.value = false;
	}
}

// ===== ストリーム =====
const stream = useStream();
let connection: { dispose: () => void } | null = null;

function connect() {
	const filter = store.s.tl.filter;
	const tl = { withRenotes: props.withRenotes, withFiles: filter.onlyFiles ? true : undefined };
	switch (props.src) {
		case 'home': { const c = stream.useChannel('homeTimeline', tl); c.on('note', onStreamNote); connection = c; break; }
		case 'local': { const c = stream.useChannel('localTimeline', tl); c.on('note', onStreamNote); connection = c; break; }
		case 'social': { const c = stream.useChannel('hybridTimeline', tl); c.on('note', onStreamNote); connection = c; break; }
		case 'global': { const c = stream.useChannel('globalTimeline', tl); c.on('note', onStreamNote); connection = c; break; }
		case 'mentions':
		case 'directs': {
			const c = stream.useChannel('main');
			c.on('mention', note => {
				if (props.src === 'directs' && note.visibility !== 'specified') return;
				onStreamNote(note);
			});
			connection = c;
			break;
		}
		case 'list': {
			if (!props.list) return;
			const c = stream.useChannel('userList', { ...tl, listId: props.list });
			c.on('note', onStreamNote);
			connection = c;
			break;
		}
		case 'antenna': {
			if (!props.antenna) return;
			const c = stream.useChannel('antenna', { antennaId: props.antenna });
			c.on('note', onStreamNote);
			connection = c;
			break;
		}
		case 'channel': {
			if (!props.channel) return;
			const c = stream.useChannel('channel', { channelId: props.channel });
			c.on('note', onStreamNote);
			connection = c;
			break;
		}
	}
}

function disconnect() {
	connection?.dispose();
	connection = null;
}

/** カラムのスクロールを受け持つ祖先(デッキのタブ枠)。 */
function scrollContainer(): HTMLElement | null {
	let el = rootEl.value?.parentElement ?? null;
	while (el) {
		const overflow = window.getComputedStyle(el).overflowY;
		if (overflow === 'auto' || overflow === 'scroll') return el;
		el = el.parentElement;
	}
	return null;
}

function isKnown(id: string): boolean {
	return notes.value.some(note => note.id === id) || queue.value.some(note => note.id === id);
}

function onStreamNote(note: Misskey.entities.Note) {
	if (isKnown(note.id)) return;
	adInsertionCounter++;
	const receivedNote = shouldInsertStreamingAd(adInsertionCounter, instance.notesPerOneAd)
		? { ...note, _shouldInsertAd_: true } : note;
	// 先頭を見ているときはそのまま差し込み、読み進めている途中なら位置を動かさず知らせに溜める。
	if ((scrollContainer()?.scrollTop ?? 0) < 8) {
		notes.value.unshift(receivedNote);
		return;
	}
	queue.value = [receivedNote, ...queue.value].slice(0, QUEUE_MAX);
}

function flushQueue() {
	const known = new Set(notes.value.map(note => note.id));
	const incoming = queue.value.filter(note => !known.has(note.id));
	notes.value = [...incoming, ...notes.value];
	queue.value = [];
	scrollContainer()?.scrollTo({ top: 0, behavior: motion() ? 'smooth' : 'auto' });
	if (!motion()) return;
	void nextTick(() => {
		(Array.from(listEl.value?.children ?? []) as HTMLElement[]).filter(el => el.dataset.noteRemovalId).slice(0, incoming.length).forEach((el, i) => el.animate(
			[{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }],
			{ duration: 380, delay: i * 50, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
		));
	});
}

// 削除されたノート(その純リノートも含む)は一覧と新着待ちから外す。
useGlobalEvent('noteDeleted', noteId => {
	const keep = (note: Misskey.entities.Note) => note.id !== noteId && !(note.renoteId === noteId && Misskey.note.isPureRenote(note));
	for (const note of notes.value.filter(note => !keep(note))) {
		removal.remove(note.id, () => { notes.value = notes.value.filter(item => item.id !== note.id); });
	}
	queue.value = queue.value.filter(keep);
});

// デッキの「全カラム更新」から読み直す。
function onReloadTimeline() {
	void reload();
}

let observer: IntersectionObserver | null = null;
watch(sentinelEl, el => {
	observer?.disconnect();
	if (!el) return;
	observer = new IntersectionObserver(entries => {
		if (entries.some(entry => entry.isIntersecting)) void loadMore();
	}, { root: scrollContainer(), rootMargin: '600px 0px' });
	observer.observe(el);
});

watch(() => [props.src, props.list, props.antenna, props.channel, props.withRenotes], () => { void reload(); });

onMounted(() => {
	globalEvents.on('reloadTimeline', onReloadTimeline);
	void reload();
});

onBeforeUnmount(() => {
	loadSeq++;
	globalEvents.off('reloadTimeline', onReloadTimeline);
	disconnect();
	observer?.disconnect();
});

defineExpose({ reload });
</script>

<style lang="scss" module>
.root {
	position: relative;
	min-height: 100%;
	// The parent tab pane already supplies the single glassDensity-controlled glass layer.
	background: transparent;
	color: var(--hk3-text);
}

.vote {
	position: sticky;
	top: 0;
	z-index: 4;
	border-bottom: 1px solid var(--hk3-divider);
	background: var(--hk3-surface);

	:global(*) { border-radius: 0 !important; }
}

.queue {
	position: sticky;
	top: 0;
	z-index: 3;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	width: 100%;
	height: 36px;
	border: 0;
	background: var(--hk3-accent);
	color: var(--hk3-bg);
	cursor: pointer;
	font: inherit;
	font-size: 13px;
	font-weight: 800;
	font-variant-numeric: tabular-nums;

	&:hover { background: var(--hk3-accent-600); }
}

.list {
	display: flex;
	flex-direction: column;
}

.ad { padding: 12px 16px; }

.state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	padding: 48px 16px;
	color: var(--hk3-neutral-700);
	font-size: 14px;
	text-align: center;
}

.retry {
	height: 32px;
	padding: 0 14px;
	border: 1px solid var(--hk3-divider);
	background: var(--hk3-bg);
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: 13px;
	font-weight: 700;

	&:hover { border-color: var(--hk3-accent); }
}

.sentinel {
	display: flex;
	justify-content: center;
	padding: 20px 0 28px;
}

.end {
	color: var(--hk3-neutral-600);
	font-size: 12px;
}
</style>
