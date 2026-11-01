<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.page" :data-theme="theme" :data-mode="mode" :data-detail="!!metric" data-hatask-ranking :aria-label="copy.title">
	<button v-if="metric" type="button" :class="$style.more" @click="showAll(null)"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.back }}</button>
	<div :class="$style.top">
		<div :class="$style.title_wrap">
			<div :class="$style.kicker">RANKING <span data-ranking-server>{{ instance.name }}</span></div>
			<h2 ref="heading" :class="$style.title" tabindex="-1">{{ metric ? metricLabel(metric) : copy.title }}</h2>
			<p :class="$style.lede">{{ copy.description }}<br>{{ copy.choice }}</p>
		</div>
		<div :class="$style.controls">
			<div :class="$style.seg" role="group" :aria-label="copy.period">
				<button v-for="item in periods" :key="item" type="button" :aria-pressed="period === item" :disabled="saving" @click="selectPeriod(item)">{{ copy[item] }}</button>
			</div>
			<button type="button" :class="$style.vis" :aria-pressed="data?.participating ?? false" :disabled="loading || saving || !data" :title="copy.privacy" @click="toggleParticipation"><i :class="data?.participating ? 'ti ti-eye' : 'ti ti-eye-off'" aria-hidden="true"></i>{{ data ? (data.participating ? copy.participating : copy.notParticipating) : copy.loading }}</button>
		</div>
	</div>
	<p v-if="actionError" :class="$style.status" role="alert">{{ actionError }}</p>
	<div :aria-busy="loading">
		<p v-if="loading" :class="$style.status" role="status"><i class="ti ti-loader-2" aria-hidden="true"></i>{{ copy.loading }}</p>
		<div v-else-if="error" :class="$style.status" role="alert"><p>{{ copy.error }}</p><button type="button" :class="$style.more" @click="load">{{ copy.retry }}</button></div>
		<template v-else-if="data">
			<div v-if="$i" :class="$style.self" :aria-label="copy.myRank">
				<div :class="$style.self_me"><MkAvatar :user="$i" :class="$style.av" :link="false" :preview="false"/><span><MkUserName :user="$i" :class="$style.self_name"/><br><span :class="$style.self_sub">@{{ $i.username }} ・ {{ copy[period] }}（{{ data.from }}〜{{ data.to }}）</span></span></div>
				<div :class="$style.self_grid">
					<div v-for="board in data.boards" :key="board.metric" :class="$style.self_cell">
						<span :class="$style.self_lab">{{ metricLabel(board.metric) }}</span>
						<span :class="$style.self_val" :title="board.self.rank == null ? (board.self.eligible ? copy.unranked : copy.hidden) : undefined"><strong>{{ board.self.rank == null ? '—' : `#${board.self.rank}` }}</strong><span v-if="board.self.rank != null" :class="$style.delta" :data-dir="deltaDirection(board.self.delta)" :aria-label="deltaLabel(board.self.delta)" :title="deltaLabel(board.self.delta)"><i :class="deltaIcon(board.self.delta)" aria-hidden="true"></i>{{ deltaText(board.self.delta) }}</span></span>
					</div>
				</div>
			</div>
			<div v-if="notice" :class="$style.notice" role="status">
				<span :class="$style.notice_ico"><i class="ti ti-trophy" aria-hidden="true"></i></span>
				<div :class="$style.notice_copy"><b>{{ tx.achievementEarned({ name: notice.title }) }}</b><span>{{ notice.description }}。{{ copy.achievementHelp }}</span></div>
				<button type="button" :class="$style.notice_close" :disabled="noticeSaving" :aria-label="copy.closeNotice" @click="dismissNotice"><i class="ti ti-x" aria-hidden="true"></i></button>
			</div>
			<div :class="$style.boards">
				<article v-for="board in data.boards" :key="board.metric" :class="$style.board" :data-tone="metricStyle[board.metric].tone" :data-metric="board.metric">
					<span :class="$style.tack" aria-hidden="true"></span>
					<header :class="$style.bhd"><span :class="$style.bhd_ico"><i :class="metricStyle[board.metric].icon" aria-hidden="true"></i></span><div :class="$style.bhd_copy"><div :class="$style.bhd_k">{{ metricStyle[board.metric].kicker }}</div><h3 :class="$style.bhd_t">{{ metricLabel(board.metric) }}</h3></div><div :class="$style.bhd_meta">{{ copy[period] }} ・ {{ tx.participants({ count: board.total.toLocaleString() }) }}</div></header>
					<p v-if="!board.items.length" :class="$style.status">{{ copy.empty }}</p>
					<ol v-else :class="$style.list" :start="board.items[0].rank">
						<li v-for="row in board.items" :key="row.user.id" :class="$style.row" :data-medal="row.rank <= 3 ? row.rank : undefined" :value="row.rank">
							<span :class="$style.rank">{{ row.rank }}</span>
							<MkAvatar :user="row.user" :class="$style.av"/>
							<MkA :to="`/@${row.user.username}`" :class="$style.who"><MkUserName :user="row.user" :class="$style.name"/><small :class="$style.handle">@{{ row.user.username }}</small></MkA>
							<span :class="$style.val">{{ row.value.toLocaleString() }}<small>{{ metricUnit(board.metric) }}</small></span>
							<span :class="$style.delta" :data-dir="deltaDirection(row.delta)" :aria-label="deltaLabel(row.delta)" :title="deltaLabel(row.delta)"><i :class="deltaIcon(row.delta)" aria-hidden="true"></i>{{ deltaText(row.delta) }}</span>
						</li>
					</ol>
					<button v-if="!metric && board.total > board.items.length" type="button" :class="$style.more" @click="showAll(board.metric)">{{ copy.all }}<i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					<div v-if="metric && board.totalPages > 1" :class="$style.pagination"><button type="button" :disabled="board.page <= 1" :aria-label="copy.previous" @click="selectPage(board.page - 1)"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><span aria-live="polite">{{ board.page }} / {{ board.totalPages }}</span><button type="button" :disabled="board.page >= board.totalPages" :aria-label="copy.next" @click="selectPage(board.page + 1)"><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div>
				</article>
			</div>
			<p :class="$style.foot">{{ copy.rules }}<br>{{ copy.comparison }}</p>
		</template>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useTemplateRef } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import { instance } from '@/instance.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import MkA from '@/components/global/MkA.vue';

const props = withDefaults(defineProps<{ theme: string; mode: 'light' | 'dark'; showAchievementNotice?: boolean }>(), { showAchievementNotice: true });
type Ranking = Endpoints['hatask/ranking/list']['res'];
type Period = Ranking['period'];
type Metric = Ranking['boards'][number]['metric'];
const copy = i18n.ts._hata._hatask._ranking;
const tx = i18n.tsx._hata._hatask._ranking;
const periods: Period[] = ['month', 'week', 'day'];
const metricStyle = {
	flower: { kicker: 'FLOWERS', icon: 'ti ti-flower', tone: 'teal' },
	utage: { kicker: 'UTAGE SUCCESS', icon: 'ti ti-glass-full', tone: 'sun' },
	block: { kicker: 'UTAGE BLOCKED', icon: 'ti ti-hand-off', tone: 'grape' },
	login: { kicker: 'LOGIN DAYS', icon: 'ti ti-flame', tone: 'coral' },
};
const metricLabel = (id: Metric) => copy[id];
const metricUnit = (id: Metric) => ({ flower: copy.flowerUnit, utage: copy.utageUnit, block: copy.blockUnit, login: copy.loginUnit })[id];
const deltaDirection = (delta: number | null) => delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
const deltaIcon = (delta: number | null) => delta == null || delta === 0 ? 'ti ti-minus' : delta > 0 ? 'ti ti-caret-up-filled' : 'ti ti-caret-down-filled';
const deltaText = (delta: number | null) => delta == null || delta === 0 ? '' : Math.abs(delta).toString();
const deltaLabel = (delta: number | null) => delta == null ? copy.noComparison : delta === 0 ? copy.unchanged : delta > 0 ? tx.up({ count: delta.toString() }) : tx.down({ count: Math.abs(delta).toString() });
const data = ref<Ranking | null>(null);
const period = ref<Period>('month');
const metric = ref<Metric | null>(null);
const page = ref(1);
const loading = ref(true);
const error = ref(false);
const saving = ref(false);
const actionError = ref('');
const heading = useTemplateRef('heading');
let generation = 0;
let active = true;
let disposed = false;
let timer: number | undefined;
const isCurrent = (request: number) => request === generation && !disposed;

async function load(): Promise<void> {
	window.clearTimeout(timer);
	if (!active || window.document.hidden || disposed) return;
	const request = ++generation;
	loading.value = true;
	error.value = false;
	data.value = null;
	try {
		const result = await misskeyApi('hatask/ranking/list', { period: period.value, ...(metric.value ? { metric: metric.value } : {}), page: page.value, limit: metric.value ? 20 : 5 });
		if (!isCurrent(request)) return;
		data.value = result;
		timer = window.setTimeout(() => void load(), Math.max(1000, Date.parse(result.nextUpdateAt) - Date.now() + 250));
	} catch {
		if (isCurrent(request)) error.value = true;
	} finally {
		if (isCurrent(request)) loading.value = false;
	}
}

function selectPeriod(value: Period): void {
	if (period.value === value || saving.value) return;
	period.value = value;
	page.value = 1;
	void load();
}

function showAll(value: Metric | null): void {
	metric.value = value;
	page.value = 1;
	void load();
	void nextTick(() => heading.value?.focus());
}

function selectPage(value: number): void {
	page.value = value;
	void load();
	void nextTick(() => heading.value?.focus());
}

async function toggleParticipation(): Promise<void> {
	if (!data.value || loading.value || saving.value) return;
	saving.value = true;
	actionError.value = '';
	try {
		await misskeyApi('hatask/ranking/participation', { participating: !data.value.participating });
		await load();
	} catch {
		actionError.value = copy.saveError;
	} finally {
		saving.value = false;
	}
}

const noticeScope = ['client', 'hatask'];
const noticeKey = 'rankingAchievementDismissedAt';
const dismissedAt = ref<number | null>(null);
const noticeSaving = ref(false);
const notice = computed(() => {
	const achievement = data.value?.latestAchievement;
	if (!props.showAchievementNotice || dismissedAt.value == null || !achievement || achievement.unlockedAt <= dismissedAt.value) return null;
	const name = `_${achievement.name}`;
	const definition = Object.prototype.hasOwnProperty.call(i18n.ts._achievements._types, name)
		? i18n.ts._achievements._types[name as keyof typeof i18n.ts._achievements._types] : null;
	if (!definition || typeof definition !== 'object' || !('title' in definition) || !('description' in definition)) return null;
	return { ...achievement, title: definition.title, description: definition.description };
});

async function loadDismissedNotice(): Promise<void> {
	try {
		const value = await misskeyApi('i/registry/get', { scope: noticeScope, key: noticeKey });
		if (!disposed) dismissedAt.value = typeof value === 'number' && Number.isFinite(value) ? value : 0;
	} catch (err) {
		if (!disposed && typeof err === 'object' && err !== null && 'code' in err && err.code === 'NO_SUCH_KEY') dismissedAt.value = 0;
		// An unknown read failure does not overwrite saved dismissal state.
	}
}

async function dismissNotice(): Promise<void> {
	if (!notice.value || noticeSaving.value) return;
	const unlockedAt = notice.value.unlockedAt;
	noticeSaving.value = true;
	try {
		await misskeyApi('i/registry/set', { scope: noticeScope, key: noticeKey, value: unlockedAt });
		dismissedAt.value = unlockedAt;
		await nextTick();
		heading.value?.focus({ preventScroll: true });
	} catch {
		actionError.value = i18n.ts._hata._hatask._settings.saveFailure;
	} finally {
		noticeSaving.value = false;
	}
}

function visibilityChanged(): void {
	window.clearTimeout(timer);
	if (window.document.hidden) generation++;
	else void load();
}

onMounted(() => {
	void load();
	void loadDismissedNotice();
	window.document.addEventListener('visibilitychange', visibilityChanged);
});
onDeactivated(() => { active = false; generation++; window.clearTimeout(timer); });
onActivated(() => { if (!active) { active = true; void load(); } });
onBeforeUnmount(() => {
	disposed = true;
	generation++;
	window.clearTimeout(timer);
	window.document.removeEventListener('visibilitychange', visibilityChanged);
});
</script>

<style module lang="scss" src="./hatask-ranking.scss"></style>
