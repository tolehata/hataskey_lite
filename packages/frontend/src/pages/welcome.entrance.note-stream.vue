<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="welcome-server-notes public-note-stream" :data-feed="feedKey" :data-status="feed.status" :data-paused="paused" :data-hidden="hidden" :data-reduced="reduced" :data-single="feed.notes.length < 2">
	<div class="welcome-notes-heading"><h3><i :class="icon" aria-hidden="true"></i>{{ title }}<small v-if="server">{{ language === 'en' ? 'Public' : '公開' }}</small></h3><button type="button" :aria-label="paused ? `${title}の自動スクロールを再開` : `${title}の自動スクロールを停止`" :aria-pressed="paused" @click="paused = !paused"><i :class="paused ? 'ti ti-player-play' : 'ti ti-player-pause'" aria-hidden="true"></i></button></div>
	<div v-if="feed.notes.length" class="welcome-notes-window" role="region" :aria-label="title" tabindex="0">
		<div class="welcome-notes-track" :style="{ '--public-flow-duration': `${Math.max(30, feed.notes.length * (feedKey === 'files' ? 10 : 7))}s` }">
			<div v-for="copy in (reduced || paused || feed.notes.length < 2 ? 1 : 2)" :key="copy" class="welcome-notes-group" role="list" :aria-hidden="copy === 2 ? true : undefined" :inert="copy === 2"><PublicNoteCard v-for="note in feed.notes" :key="note.id" :note="note"/></div>
		</div>
	</div>
	<div v-else class="public-notes-message" role="status"><i :class="feed.status === 'loading' ? 'ti ti-dots' : 'ti ti-notes-off'" aria-hidden="true"></i><p>{{ message }}</p><button v-if="feed.status === 'error'" type="button" @click="refreshPublicNotes">再読み込み</button></div>
	<div v-if="feed.status === 'error' && feed.notes.length" class="public-notes-update" role="status">更新できませんでした <button type="button" @click="refreshPublicNotes">再試行</button></div>
</div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import PublicNoteCard from './welcome.entrance.note-card.vue';
import type { WelcomeFeedKey as FeedKey } from '@/utility/welcome-public-notes.js';
import { useWelcomePublicNotes } from '@/utility/welcome-public-notes.js';
import { prefer } from '@/preferences.js';
const { feeds: publicFeeds, refresh: refreshPublicNotes } = useWelcomePublicNotes();
const props = defineProps<{ feedKey: FeedKey; title: string; icon: string; server?: boolean; language?: string }>();
const feed = computed(() => publicFeeds[props.feedKey]);
const paused = ref(false), hidden = ref(false), reducedMotion = ref(false);
const reduced = computed(() => reducedMotion.value || !prefer.r.animation.value);
const message = computed(() => ({ loading: '公開投稿を読み込み中…', empty: props.feedKey === 'greetings' ? '最近の公開投稿にあいさつがありません' : '表示できる公開投稿がありません', error: '公開投稿を取得できませんでした', disabled: '現在、公開タイムラインは表示されていません', ready: '' })[feed.value.status]);
let query: MediaQueryList;

function visibility() { hidden.value = window.document.hidden; }

function motion() { reducedMotion.value = query.matches; }

onMounted(() => { query = matchMedia('(prefers-reduced-motion: reduce)'); motion(); visibility(); query.addEventListener('change', motion); window.document.addEventListener('visibilitychange', visibility); });
onBeforeUnmount(() => { query?.removeEventListener('change', motion); window.document.removeEventListener('visibilitychange', visibility); });
</script>
