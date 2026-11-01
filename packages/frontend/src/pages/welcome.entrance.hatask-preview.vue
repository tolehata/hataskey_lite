<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="welcome-app-block" data-welcome-app-preview>
	<div class="welcome-theme-picks" role="group" aria-label="Hatask のテーマ">
		<button v-for="theme in themes" :key="theme.id" type="button" :aria-pressed="skin === theme.id" :data-welcome-theme="theme.id" @click="skin = theme.id"><span :style="{ background: theme.color }"></span>{{ theme.name }}</button>
		<small>Hatask v3.1 · ホームの見本</small>
	</div>
	<div class="welcome-app-frame welcome-hatask htk-root" :data-theme="skin" :data-mode="mode" data-anim="on" :style="hatakyuStyle">
		<HataskAkatsukiLayout v-model:searchQuery="query" :enabled="true" preview :animations="prefer.r.animation.value" activeTab="home" :mode="mode" :model="model" :now="now" :searchOpen="searchOpen" @navigate="navigate" @action="action" @settings="signin" @search="searchOpen = true" @closeSearch="searchOpen = false" @saveFavorites="favorites = $event">
			<template #home-feedback><div class="hak-rich-row"><i class="ti ti-heart" aria-hidden="true"></i><span>きょうの記録にリアクションが届きました</span></div></template>
			<template #search-results><div class="welcome-search-list"><button v-for="item in filtered" :key="item.id" type="button" @click="navigate(item.id)"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button><p v-if="!filtered.length">見つかりませんでした</p></div></template>
		</HataskAkatsukiLayout>
	</div>
</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HataskAkatsukiModel, HataskAkatsukiFavoriteId, HataskAkatsukiAction } from '@/components/hatask/hatask-akatsuki-types.js';
import type { HataskPlannerTheme } from '@/components/hatask/hatask-planner-types.js';
import { getHataskHatakyuStyle } from '@/utility/hatask-theme.js';
import HataskAkatsukiLayout from '@/components/hatask/HataskAkatsukiLayout.vue';
import { prefer } from '@/preferences.js';

const props = defineProps<{ mode: 'light' | 'dark'; language: 'ja' | 'en'; now: Date }>();
const emit = defineEmits<{ signin: [] }>();

function signin() { emit('signin'); }

const skin = ref<HataskPlannerTheme>('akatsuki'), searchOpen = ref(false), query = ref(''), favorites = ref<HataskAkatsukiFavoriteId[]>(['calendar', 'todo']);

const themes: { id: HataskPlannerTheme; name: string; color: string }[] = [
	{ id: 'akatsuki', name: '暁', color: '#8ab7bd' }, { id: 'koke', name: '苔', color: '#76996c' },
	{ id: 'kisetsu', name: '季', color: '#c9a785' }, { id: 'kashin', name: '花信', color: '#ffad7a' },
	{ id: 'suri', name: '刷', color: '#fa679f' }, { id: 'hatakyu', name: 'ハタキュ', color: '#4489b5' },
];
const hatakyuStyle = getHataskHatakyuStyle();
const todos = ref([{ id: 't-1', title: '読みかけの本を返す', meta: '今日 · くらし', completed: false }, { id: 't-2', title: '週末の予定を決める', meta: '今日', completed: false }, { id: 't-3', title: 'メモを整理する', meta: '作業', completed: true }]);
const apps = [{ id: 'cal', label: 'カレンダー', icon: 'ti ti-calendar-event' }, { id: 'todo', label: 'ToDo', icon: 'ti ti-checkbox' }, { id: 'mood', label: 'きもち', icon: 'ti ti-mood-smile' }, { id: 'meal', label: 'ごはん', icon: 'ti ti-soup' }, { id: 'garden', label: 'おはな', icon: 'ti ti-flower' }, { id: 'apps', label: 'アプリ', icon: 'ti ti-apps' }];
const filtered = computed(() => apps.filter(item => item.label.toLowerCase().includes(query.value.trim().toLowerCase())));
const model = computed<HataskAkatsukiModel>(() => ({
	dateLabel: props.now.toLocaleDateString(props.language, { month: 'long', day: 'numeric' }), weekdayLabel: props.now.toLocaleDateString(props.language, { weekday: 'long' }), dayCountLabel: String(props.now.getFullYear()), clockLabel: props.now.toLocaleTimeString(props.language, { hour: '2-digit', minute: '2-digit', hour12: false }), summary: '今日は、少し余白のある一日。',
	home: { recommended: 'calendar', hasUsage: true, favorites: favorites.value, sections: [
		{ id: 'calendar', label: '予定', icon: 'ti ti-calendar-event', summary: 'このあとの予定', reason: '午後の予定を、ここで確認', priority: 2 },
		{ id: 'todo', label: 'ToDo', icon: 'ti ti-checkbox', summary: 'ひとつずつ、進めよう', reason: 'きょうのやること', priority: 1 },
		{ id: 'meal', label: 'ごはん', icon: 'ti ti-soup', summary: '今日のごはん', reason: 'おいしい時間も記録に', priority: 0 },
		{ id: 'tools', label: 'ツール', icon: 'ti ti-apps', summary: 'いつものツール', reason: '使いたいものを、ここから', priority: 0 },
	] },
	next: { id: 'e-1', title: '作業の時間', timeLabel: '13:00–14:00', meta: '自分の予定', detail: 'まずは、きょうの分から。', startMinute: 780, endMinute: 840, action: { type: 'open-event', id: 'e-1' } },
	later: [{ id: 'e-2', title: '本を返しに図書館へ', timeLabel: '16:30', meta: 'くらし', startMinute: 990, endMinute: 1020 }],
	timeline: [{ id: 'e-1', title: '作業', timeLabel: '13:00', startMinute: 780, endMinute: 840 }, { id: 'e-2', title: '図書館', timeLabel: '16:30', startMinute: 990, endMinute: 1020 }],
	stats: [{ id: 'todo', label: 'きょうのToDo', value: todos.value.filter(item => !item.completed).length, unit: '件', tab: 'todo' }, { id: 'events', label: 'きょうの予定', value: 2, unit: '件', tab: 'cal' }, { id: 'flowers', label: '咲いたおはな', value: 12, unit: '本', tab: 'garden' }],
	week: ['水', '木', '金', '土', '日', '月', '火'].map((label, i) => ({ id: String(i), label, icon: i === 3 ? 'ti ti-mood-smile' : 'ti ti-mood-happy', description: i === 3 ? 'のんびり' : 'いい感じ', today: i === 6 })),
	meals: [{ id: 'breakfast', label: '朝', text: 'トーストとコーヒー', recorded: true }, { id: 'lunch', label: '昼', text: 'これから', recorded: false }, { id: 'dinner', label: '夜', text: 'これから', recorded: false }],
	mealSummary: '朝は、トーストとコーヒー。', flower: { name: 'ヒナギク', emoji: '🌼', progress: 72, detail: '少しずつ育っています', watered: false },
	eye: { text: '小さな「できた」を、きょうも。' }, streakLabel: '24日', rankLabel: 'こつこつ育成中', todos: todos.value, apps,
}));

function navigate(id: string) { if (id !== 'home') signin(); }

function action(value: HataskAkatsukiAction) { if (value.type === 'toggle-todo') { const todo = todos.value.find(item => item.id === value.id); if (todo) todo.completed = !todo.completed; } else signin(); }
</script>
<style lang="scss" src="../components/hatask/hatask-themes.scss"></style>
<style lang="scss">
@use "../components/hatask/hatask-fonts.scss";
</style>
