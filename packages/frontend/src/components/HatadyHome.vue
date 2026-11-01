<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.home" :data-mode="summary.mode" :data-primary="summary.primary || 'mixed'" :data-preview="!!preview" :inert="preview ? true : undefined">
	<header :class="$style.greeting" :data-hosted="hostedHeader">
		<div>
			<Teleport :to="headerDateTarget ?? 'body'" :disabled="!hostedDate">
				<time v-if="!hostedDate || headerActive" :class="$style.date" :data-hosted="hostedDate" :datetime="localDateKey(now)" :aria-label="dateLabel" :title="dateLabel">
					<span :class="$style.fullDate">{{ dateLabel }}</span>
					<span v-if="hostedDate" :class="$style.shortDate" aria-hidden="true">{{ shortDateLabel }}</span>
				</time>
			</Teleport>
			<h1 v-if="summary.mode === 'new'">
				{{ dashboardCopy.newGreetingFirst }}
				<br/>
				{{ dashboardCopy.newGreetingSecond }}
			</h1>
		</div>
		<div :class="$style.greetingActions">
			<Teleport :to="headerActionsTarget ?? 'body'" :disabled="!hostedOverview">
				<button
					v-if="!hostedOverview || headerActive"
					type="button"
					class="hy-secondary"
					:class="$style.overviewButton"
					:data-hosted="hostedOverview"
					:aria-label="i18n.tsx._hata._hatady._homeDashboard.viewFocusRecords({ focus: focusLabel || dashboardCopy.mixedDays })"
					@click="openOverview"
				>
					<i :class="focusIcon" aria-hidden="true"></i>
				</button>
			</Teleport>
			<slot name="greetingActions"></slot>
		</div>
	</header>
	<div v-if="error" class="hy-error" role="alert">
		{{ error }}
		<button class="hy-secondary" @click="load">{{ dashboardCopy.reload }}</button>
	</div>
	<div v-if="loading && !loaded" class="hy-empty"><HataAppLoading app="hatady" :size="32" :monochrome="monochrome" :active="active && hataGoesHost?.active.value !== false && hataGoesSession?.active.value !== false" :label="copy.loading"/></div>
	<div v-else-if="loaded" :class="$style.bento">
		<section :class="$style.hero" data-hy-entrance="home">
			<header :class="$style.head">
				<h2>
					<i
						:class="focusKind === 'work' || focusKind === 'exercise' ? focusIcon : 'ti ti-sparkles'"
						aria-hidden="true"
					></i>
					{{ heroHeading }}
				</h2>
				<button
					v-if="recommendations.length > 1 && !contextHero"
					class="hy-icon-button"
					:aria-label="dashboardCopy.nextRecommendation"
					@click="nextRecommendation"
				>
					<i class="ti ti-refresh" aria-hidden="true"></i>
				</button>
			</header>
			<button v-if="contextHero" :class="[$style.recommendation, $style.contextHero]" @click="openContextHero">
				<span>
					<small>{{ contextHero.eyebrow }}</small>
					<h3>{{ contextHero.title }}</h3>
					<p>{{ contextHero.body }}</p>
					<span :class="$style.recommendFoot">
						<i class="ti ti-notebook" aria-hidden="true"></i>
						{{ dashboardCopy.openRecord }}
						<i class="ti ti-arrow-right" aria-hidden="true"></i>
					</span>
				</span>
				<span :class="$style.activityArt" aria-hidden="true">
					<i :class="contextHero.icon"></i>
					<small>
						{{ focusKind === 'work' ? 'MY PROJECT' : focusKind === 'exercise' ? 'MY MOVEMENT' : 'MY NOTE' }}
					</small>
				</span>
			</button>
			<Transition :name="motion ? 'recommend' : ''" mode="out-in">
				<button
					v-if="recommendation && !contextHero"
					:key="recommendation.work.id"
					:class="$style.recommendation"
					@click="emit('work', recommendation.work)"
				>
					<span>
						<small>{{ recommendation.reason }}</small>
						<h3>{{ recommendation.work.title }}</h3>
						<p>{{ recommendation.work.description }}</p>
						<span :class="$style.recommendFoot">
							{{ recommendation.work.mine ? dashboardCopy.openOwnWork : dashboardCopy.openPublicCollection }}
							<i class="ti ti-arrow-right" aria-hidden="true"></i>
						</span>
					</span>
					<HyBookCover
						v-if="recommendation.work.kind === 'book'"
						:title="recommendation.work.title"
						:author="recommendation.work.creator"
						:colorIndex="recommendation.work.colorIndex"
						:width="100"
						showTitle
					/>
					<HyMediaCover
						v-else
						:kind="recommendation.work.kind"
						:title="recommendation.work.title"
						:subtitle="recommendation.work.creator"
						:colorIndex="recommendation.work.colorIndex"
						:width="100"
					/>
				</button>
			</Transition>
			<p v-if="!recommendation && !contextHero" class="hy-empty">{{ dashboardCopy.recommendationEmpty }}</p>
		</section>
		<section :class="$style.metrics" data-hy-entrance="home">
			<header :class="$style.head">
				<h2>
					<i :class="focusIcon" aria-hidden="true"></i>
					{{ dashboardCopy.recentThirtyDays }}
				</h2>
				<button class="hy-icon-button" :aria-label="dashboardCopy.viewStats" @click="emit('stats')">
					<i class="ti ti-arrow-up-right" aria-hidden="true"></i>
				</button>
			</header>
			<div :class="$style.total">
				<strong>{{ metricCount }}</strong>
				<small>
					{{
						summary.primary === 'movie' || summary.primary === 'game'
							? i18n.tsx._hata._hatady._homeDashboard.workRecordCount({ count: String(metricRows.length) })
							: i18n.tsx._hata._hatady._homeDashboard.recordDays({ days: String(metricDays) })
					}}
				</small>
			</div>
			<div
				:class="$style.bars"
				role="img"
				:aria-label="i18n.tsx._hata._hatady._homeDashboard.lastSevenRecordCount({ records: barRecordDescription })"
			>
				<small>{{ dashboardCopy.lastSevenDays }}</small>
				<div v-for="bar in bars" :key="bar.date" :data-today="bar.today">
					<i :style="{ height: `${Math.max(4, (bar.count / maxBar) * 80)}%` }"></i>
					<small>{{ bar.label }}</small>
				</div>
			</div>
			<small v-if="summary.primary === 'work' || metricSeconds !== null || metricRows.length" :class="$style.metricFoot">
				<i class="ti ti-clock" aria-hidden="true"></i>
				{{
					summary.primary === 'work'
						? i18n.tsx._hata._hatady._homeDashboard.inProgressCount({ count: String(workItems.filter((item) => !item.done).length) })
						: metricSeconds === null
							? dashboardCopy.noTime
							: hatadyDuration(metricSeconds)
				}}
			</small>
		</section>
		<section :class="$style.community" data-hy-entrance="home">
			<header :class="$style.head">
				<h2>
					<i class="ti ti-users" aria-hidden="true"></i>
					{{ dashboardCopy.communityTitle }}
				</h2>
			</header>
			<div :class="$style.total">
				<strong>{{ communityUsers.length }}</strong>
				<small>{{ communityUsers.length === 1 ? dashboardCopy.personRecordedToday : dashboardCopy.peopleRecordedToday }}</small>
			</div>
			<div :class="$style.avatars">
				<button
					v-for="user in communityUsers.slice(0, 6)"
					:key="user.id"
					:aria-label="i18n.tsx._hata._hatady._homeDashboard.userProfile({ name: user.name || user.username })"
					@click="emit('profile', user.id)"
				>
					<HfAvatar v-if="preview" :user="user" :class="$style.avatar"/>
					<MkAvatar v-else :user="user" :class="$style.avatar"/>
				</button>
			</div>
			<button :class="$style.link" @click="emit('community')">
				{{ dashboardCopy.browseCommunity }}
				<i class="ti ti-arrow-right" aria-hidden="true"></i>
			</button>
		</section>
		<section :class="$style.recent" data-hy-entrance="home">
			<header :class="$style.head">
				<h2>
					<i :class="focusIcon" aria-hidden="true"></i>
					{{ recentHeading }}
				</h2>
				<button
					class="hy-icon-button"
					:aria-label="dashboardCopy.viewAllOwnRecords"
					@click="emit('records', focusKind || 'all')"
				>
					<i class="ti ti-arrow-up-right" aria-hidden="true"></i>
				</button>
			</header>
			<div :class="$style.rows">
				<button
					v-for="row in recentRows.slice(0, 3)"
					:key="row.id"
					:class="$style.row"
					@click="emit('activity', row)"
				>
					<i :class="kindIcon(activityKind(row))" aria-hidden="true"></i>
					<span>
						<strong>{{ activityData(row).title }}</strong>
						<small>
							{{ activityData(row).tags.slice(0, 2).map(tagLabel).join(' · ') || activityData(row).genre }}
						</small>
					</span>
					<small>{{ activityData(row).seconds === null ? '' : hatadyDuration(activityData(row).seconds) }}</small>
				</button>
				<p v-if="!recentRows.length" class="hy-empty">
					{{ summary.mode === 'quiet' ? dashboardCopy.noRecentThirty : copy.emptyLog }}
				</p>
			</div>
		</section>
		<section :class="$style.collection" data-hy-entrance="home">
			<header :class="$style.head">
				<h2>
					<i :class="focusIcon" aria-hidden="true"></i>
					{{ focusKind === 'work' ? dashboardCopy.workStatus : focusKind === 'exercise' ? dashboardCopy.exerciseTypes : dashboardCopy.collection }}
				</h2>
				<button
					v-if="shelfOverflow && motion && focusKind !== 'exercise' && focusKind !== 'work'"
					class="hy-icon-button"
					:aria-label="shelfPaused ? dashboardCopy.resumeScroll : dashboardCopy.pauseScroll"
					:aria-pressed="shelfPaused"
					@click="shelfPaused = !shelfPaused"
				>
					<i :class="shelfPaused ? 'ti ti-player-play' : 'ti ti-player-pause'" aria-hidden="true"></i>
				</button>
				<button
					v-else
					class="hy-icon-button"
					:aria-label="dashboardCopy.viewAll"
					@click="
						focusKind === 'exercise'
							? emit('records', 'exercise')
							: emit('collection', focusKind === 'study' ? 'book' : focusKind || 'book')
					"
				>
					<i class="ti ti-arrow-up-right" aria-hidden="true"></i>
				</button>
			</header>
			<template v-if="focusKind === 'exercise'">
				<div :class="$style.rows">
					<button
						v-for="group in exerciseGroups.slice(0, 3)"
						:key="group.name"
						:class="$style.row"
						@click="emit('activity', group.first)"
					>
						<span>
							<strong>{{ group.name }}</strong>
							<small>{{ i18n.tsx._hata._hatady._homeDashboard.timesDuration({ count: String(group.count), duration: hatadyDuration(group.seconds) }) }}</small>
						</span>
					</button>
				</div>
				<small>
					{{ calories.count ? i18n.tsx._hata._hatady._homeDashboard.caloriesEntered({ calories: String(calories.total) }) : dashboardCopy.caloriesMissing }} · {{ i18n.tsx._hata._hatady._homeDashboard.exerciseRecordCount({ done: String(calories.count), total: String(exerciseRows.length) }) }}
				</small>
			</template>
			<template v-else-if="focusKind === 'work'">
				<div :class="$style.rows">
					<button
						v-for="item in workItems.slice(0, 3)"
						:key="item.work.id"
						:class="$style.row"
						@click="emit('work', item.work)"
					>
						<span>
							<strong>{{ item.work.title }}</strong>
							<small>{{ item.label }}</small>
						</span>
						<i
							:class="item.done ? 'ti ti-checks' : item.attention ? 'ti ti-flag' : 'ti ti-arrow-right'"
							aria-hidden="true"
						></i>
					</button>
				</div>
				<small>
					{{ i18n.tsx._hata._hatady._homeDashboard.workProgressSummary({ active: String(workItems.filter((item) => !item.done).length), done: String(workItems.filter((item) => item.done).length) }) }}
				</small>
			</template>
			<template v-else>
				<div ref="shelfEl" :class="$style.shelf">
					<button v-for="work in shelf" :key="work.id" :aria-label="work.title" @click="emit('work', work)">
						<HyBookCover
							v-if="work.kind === 'book'"
							:title="work.title"
							:author="work.creator"
							:colorIndex="work.colorIndex"
							:width="66"
							showTitle
						/>
						<HyMediaCover v-else :kind="work.kind" :title="work.title" :colorIndex="work.colorIndex" :width="66"/>
					</button>
					<p v-if="!shelf.length" class="hy-empty">{{ dashboardCopy.shelfEmpty }}</p>
				</div>
				<button
					:class="$style.shelfCaption"
					@click="emit('collection', focusKind === 'study' ? 'book' : focusKind || 'book')"
				>
					<span>{{ i18n.tsx._hata._hatady._homeDashboard.worksCount({ count: String(shelf.length) }) }}</span>
					<span>
						{{ dashboardCopy.ownCollection }}
						<i class="ti ti-arrow-right" aria-hidden="true"></i>
					</span>
				</button>
			</template>
		</section>
		<section :class="$style.keep" data-hy-entrance="home">
			<div>
				<h2>
					<i class="ti ti-target" aria-hidden="true"></i>
					{{ focusLabel ? i18n.tsx._hata._hatady._homeDashboard.focusProgress({ focus: focusLabel }) : dashboardCopy.ownPace }}
				</h2>
				<strong>{{ dashboardCopy.reviewChanges }}</strong>
				<small v-if="stats?.streakDays">
					{{ i18n.tsx._hata._hatady._homeDashboard.streakDays({ count: String(stats.streakDays) }) }}
				</small>
			</div>
			<div :class="$style.tools">
				<button class="hy-icon-button" :aria-label="copy.toolGoals" @click="emit('goals')">
					<i class="ti ti-target" aria-hidden="true"></i>
				</button>
				<button class="hy-icon-button" :aria-label="copy.toolStats" @click="emit('stats')">
					<i class="ti ti-chart-bar" aria-hidden="true"></i>
				</button>
				<button class="hy-icon-button" :aria-label="copy.toolStreaks" @click="emit('streaks')">
					<i class="ti ti-flame" aria-hidden="true"></i>
				</button>
			</div>
		</section>
	</div>
	<Teleport to="body">
		<HyDialog v-if="overviewOpen && !preview" ref="overviewDialog" :title="dashboardCopy.overviewTitle" @close="closeOverview" @closed="onOverviewClosed">
			<div :class="$style.overview">
				<h3>
					{{
						summary.emerging
							? i18n.tsx._hata._hatady._homeDashboard.emergingKind({ kind: kindLabel(summary.emerging) })
							: summary.primary
								? i18n.tsx._hata._hatady._homeDashboard.primaryKind({ kind: kindLabel(summary.primary) })
								: dashboardCopy.mixedDays
					}}
				</h3>
				<div>
					<span>{{ dashboardCopy.ownRecords }}</span>
					<span>{{ dashboardCopy.thirtyDays }}</span>
					<span>{{ dashboardCopy.sevenDays }}</span>
				</div>
				<button
					v-for="item in summary.ranked"
					:key="item.kind"
					@click="openOverviewRecords(item.kind)"
				>
					<span>
						<i :class="kindIcon(item.kind)" aria-hidden="true"></i>
						{{ kindLabel(item.kind) }}
					</span>
					<b>{{ item.count }}</b>
					<b>{{ item.weekCount }}</b>
				</button>
				<small>{{ localDateKey(new Date(homePeriod(now).since)) }} — {{ localDateKey(now) }}</small>
			</div>
		</HyDialog>
	</Teleport>
</section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onDeactivated, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { HatadyActivity, HatadyLogKind } from '@/utility/hatady-media.js';
import type { HatadyHomePreview, HatadyHomeWork } from '@/utility/hatady-home.js';
import { createHatadyShelfMotion } from '@/utility/hatady-shelf-motion.js';
import HyDialog from '@/components/HyDialog.vue';
import HataAppLoading from '@/components/HataAppLoading.vue';
import { HATA_GOES_HOST, HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';
import HyBookCover from '@/components/HyBookCover.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import HyMediaCover from '@/components/HyMediaCover.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { requireHatadyActivityPage } from '@/utility/hatady-media.js';
import {
	activityData,
	activityKind,
	collectActivityPages,
	collectWorkPages,
	homePeriod,
	homeWork,
	localDateKey,
	summarizeHome,
} from '@/utility/hatady-home.js';
import {
	HATADY_ACTIVITY_CHOICES,
	HATADY_RECORD_TAGS,
	hatadyDialogSurfaces,
	hatadyDuration,
} from '@/utility/hatady-ui.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { $i } from '@/i.js';

const props = withDefaults(defineProps<{ revision: number; stats?: Record<string, any> | null; preview?: HatadyHomePreview; active?: boolean; monochrome?: boolean; headerDateTarget?: HTMLElement | null; headerActionsTarget?: HTMLElement | null }>(), { active: true, monochrome: false });
const emit = defineEmits<{
	(event: 'records' | 'record', kind: string): void;
	(event: 'work', work: HatadyHomeWork): void;
	(event: 'activity', activity: HatadyActivity): void;
	(event: 'collection', kind: string): void;
	(event: 'profile', id: string): void;
	(event: 'stats' | 'goals' | 'streaks' | 'community' | 'ready'): void;
}>();
const copy = i18n.ts._hata._hatady._home;
const dashboardCopy = i18n.ts._hata._hatady._homeDashboard;
const rows = ref<HatadyActivity[]>([]),
	communityRows = ref<HatadyActivity[]>([]),
	works = ref<HatadyHomeWork[]>([]);
const loading = ref(false),
	loaded = ref(false),
	error = ref(''),
	hasOlder = ref(false),
	now = ref(new Date());
const overviewOpen = ref(false);
const overviewDialog = ref<InstanceType<typeof HyDialog> | null>(null);
const hataGoesHost = inject(HATA_GOES_HOST, null);
const hataGoesSession = inject(HATA_GOES_SESSION, null);
const hostedDate = computed(() => !props.preview && !!props.headerDateTarget);
const hostedOverview = computed(() => !props.preview && !!props.headerActionsTarget);
const hostedHeader = computed(() => hostedDate.value && hostedOverview.value);
const headerActive = computed(() => props.active && hataGoesHost?.active.value !== false && hataGoesSession?.active.value !== false);
let overviewClosing = false;
let overviewRecordsKind: string | null = null;

function openOverview(): void {
	if (props.preview || hataGoesHost?.active.value === false || hataGoesSession?.active.value === false) return;
	overviewOpen.value = true;
}

function closeOverview(): void {
	if (overviewClosing) return;
	overviewClosing = true;
	overviewDialog.value?.close();
}

function onOverviewClosed(): void {
	overviewOpen.value = false;
	overviewClosing = false;
	if (overviewRecordsKind !== null) {
		const kind = overviewRecordsKind;
		overviewRecordsKind = null;
		emit('records', kind);
	}
}

function openOverviewRecords(kind: string): void {
	overviewRecordsKind = kind;
	closeOverview();
}

function discardOverview(): void {
	overviewOpen.value = false;
	overviewClosing = false;
	overviewRecordsKind = null;
}

watch(() => props.preview, preview => { if (preview) discardOverview(); });
watch(() => hataGoesHost?.active.value, active => { if (active === false) discardOverview(); });
watch(() => hataGoesSession?.active.value, active => { if (active === false) discardOverview(); });
onDeactivated(discardOverview);
const recommendIndex = ref(0),
	reduced = ref(false),
	shelfPaused = ref(false),
	shelfOverflow = ref(false);
const shelfEl = useTemplateRef('shelfEl');
const motion = computed(() => !props.preview && prefer.r.animation.value && !reduced.value);
const summary = computed(() => summarizeHome(rows.value, now.value, hasOlder.value));
const focusKind = computed(() => summary.value.primary || summary.value.emerging);
const kindLabel = (kind: string) => HATADY_ACTIVITY_CHOICES.find((item) => item.value === kind)?.label ?? '';
const kindIcon = (kind: string) =>
	HATADY_ACTIVITY_CHOICES.find((item) => item.value === kind)?.icon ?? 'ti ti-notebook';
const tagLabel = (tag: string) => HATADY_RECORD_TAGS.find((item) => item.value === tag)?.label ?? tag;
const focusLabel = computed(() => kindLabel(focusKind.value || ''));
const focusIcon = computed(() => kindIcon(focusKind.value || ''));
const recentRows = computed(() =>
	summary.value.primary ? summary.value.ranked.find((row) => row.kind === summary.value.primary)!.rows : rows.value,
);
const metricRows = computed(() =>
	summary.value.primary
		? summary.value.ranked.find((row) => row.kind === summary.value.primary)!.rows
		: summary.value.recent,
);
const recentHeading = computed(
	() =>
		({ study: dashboardCopy.recentStudy, movie: dashboardCopy.recentMovie, game: dashboardCopy.recentGame, exercise: dashboardCopy.recentExercise, work: dashboardCopy.recentWork })[
			summary.value.primary as HatadyLogKind
		] || dashboardCopy.recentRecords,
);
const heroHeading = computed(
	() =>
		contextHero.value?.heading ||
		(focusKind.value === 'movie'
			? dashboardCopy.nextMovie
			: focusKind.value === 'game'
				? dashboardCopy.nextGame
				: focusKind.value === 'study'
					? dashboardCopy.nextBook
					: dashboardCopy.nextFun),
);
const dateLabel = computed(() =>
	new Intl.DateTimeFormat(versatileLang, { month: 'long', day: 'numeric', weekday: 'long' }).format(now.value),
);
const shortDateLabel = computed(() =>
	new Intl.DateTimeFormat(versatileLang, { month: 'numeric', day: 'numeric' }).format(now.value),
);
const metricCount = computed(() =>
	summary.value.primary === 'movie' || summary.value.primary === 'game'
		? new Set(metricRows.value.map((row) => activityData(row).workId || activityData(row).title)).size
		: metricRows.value.length,
);
const metricDays = computed(() => new Set(metricRows.value.map((row) => localDateKey(new Date(row.occurredAt)))).size);
const metricSeconds = computed(() => {
	const values = metricRows.value.map((row) => activityData(row).seconds).filter((value) => value !== null);
	return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
});
const bars = computed(() =>
	Array.from({ length: 7 }, (_, index) => {
		const date = new Date(now.value);
		date.setDate(date.getDate() - 6 + index);
		const key = localDateKey(date);
		return {
			date: key,
			label: new Intl.DateTimeFormat(versatileLang, { weekday: 'short' }).format(date),
			today: index === 6,
			count: metricRows.value.filter((row) => localDateKey(new Date(row.occurredAt)) === key).length,
		};
	}),
);
const barRecordDescription = computed(() => {
	const labels = bars.value.map((bar) =>
		i18n.tsx._hata._hatady._homeDashboard.dayRecordCount({ date: bar.date, count: String(bar.count) }),
	);
	return versatileLang.startsWith('ja')
		? labels.join('、')
		: new Intl.ListFormat(versatileLang, { style: 'short', type: 'conjunction' }).format(labels);
});
const maxBar = computed(() => Math.max(1, ...bars.value.map((bar) => bar.count)));
const communityUsers = computed(() => [
	...new Map(
		communityRows.value.filter((row) => row.user && row.user.id !== (props.preview?.viewerId ?? $i?.id)).map((row) => [row.user!.id, row.user!]),
	).values(),
]);
const shelf = computed(() =>
	works.value.filter(
		(work) =>
			work.mine &&
			(focusKind.value && focusKind.value !== 'exercise'
				? work.kind === (focusKind.value === 'study' ? 'book' : focusKind.value)
				: work.kind !== 'work'),
	),
);
const exerciseRows = computed(() => summary.value.ranked.find((item) => item.kind === 'exercise')!.rows);
const exerciseGroups = computed(() => {
	const groups = new Map<string, { name: string; first: HatadyActivity; count: number; seconds: number }>();
	for (const row of exerciseRows.value) {
		const data = activityData(row),
			name = data.title || data.genre,
			group = groups.get(name) ?? { name, first: row, count: 0, seconds: 0 };
		group.count++;
		group.seconds += data.seconds || 0;
		groups.set(name, group);
	}
	return [...groups.values()].sort((a, b) => b.count - a.count);
});
const calories = computed(() => {
	const values = exerciseRows.value
		.map((row) => activityData(row).calories)
		.filter((value): value is number => value !== null && Number.isFinite(value));
	return { count: values.length, total: values.reduce((sum, value) => sum + value, 0) };
});
const workItems = computed(() =>
	works.value
		.filter((work) => work.mine && work.kind === 'work')
		.map((work) => {
			const linked = rows.value.filter((row) => activityKind(row) === 'work' && activityData(row).workId === work.id),
				latest = linked[0],
				tags = latest ? activityData(latest).tags : [];
			const done = linked.some((row) => activityData(row).tags.includes('doneAll')) || work.status === 'completed';
			const attention =
				!done && latest && Date.parse(latest.occurredAt) >= homePeriod(now.value).since
					? tags.includes('blocked')
						? 2
						: tags.includes('review')
							? 1
							: 0
					: 0;
			return {
				work,
				latest,
				done,
				attention,
				label: done
					? dashboardCopy.workDone
					: attention === 2
						? dashboardCopy.workBlocked
						: attention === 1
							? dashboardCopy.workReview
							: tags.includes('doneDay')
								? dashboardCopy.workDoneToday
								: dashboardCopy.workInProgress,
			};
		})
		.sort(
			(a, b) =>
				Number(a.done) - Number(b.done) ||
				b.attention - a.attention ||
				(b.latest?.occurredAt || '').localeCompare(a.latest?.occurredAt || ''),
		),
);
const contextHero = computed(() => {
	const project = focusKind.value === 'work' ? workItems.value[0] : null;
	const latest = focusKind.value ? summary.value.ranked.find((item) => item.kind === focusKind.value)?.rows[0] : null;
	const note =
		project?.latest ||
		(focusKind.value === 'exercise' || (focusKind.value === 'study' && latest && !activityData(latest).workId)
			? latest
			: null);
	if (!project && !note) return null;
	const data = note ? activityData(note) : null;
	return {
		project,
		note,
		title: project?.work.title || data?.title || '',
		body: data?.body || project?.work.description || '',
		heading: project
			? project.done
				? dashboardCopy.heroWorkDone
				: project.attention === 2
					? dashboardCopy.heroWorkPaused
					: project.attention === 1
						? dashboardCopy.heroWorkReview
						: dashboardCopy.heroWorkContinue
			: focusKind.value === 'exercise'
				? dashboardCopy.heroExercise
				: dashboardCopy.heroStudy,
		eyebrow:
			project?.label || `${data ? localDateKey(new Date(data.occurredAt)) : ''} · ${hatadyDuration(data?.seconds)}`,
		icon: project?.done ? 'ti ti-checks' : focusIcon.value,
	};
});

function openContextHero(): void {
	const hero = contextHero.value;
	if (hero?.project) emit('work', hero.project.work);
	else if (hero?.note) emit('activity', hero.note);
}

const recommendations = computed(() => {
	const interests = new Set(
		rows.value
			.map(activityData)
			.filter((row) => row.tags.includes('interest'))
			.map((row) => `${row.kind}\0${row.genre}`),
	);
	const scores = summary.value.ranked,
		total = scores.reduce((sum, row) => sum + row.score, 0) || 1;
	return works.value
		.filter((work) => work.kind !== 'work')
		.map((work) => {
			const kind = work.kind === 'book' ? 'study' : work.kind,
				interested = interests.has(`${kind}\0${work.genre}`);
			return {
				work,
				score:
					((scores.find((row) => row.kind === kind)?.score ?? 0) / total) * 8 +
					(interested ? 3 : 0) +
					(work.mine ? 0 : 2) +
					(work.recommended ? 1 : 0),
				reason: interested
					? i18n.tsx._hata._hatady._homeDashboard.interestReason({ genre: work.genre })
					: work.mine
						? dashboardCopy.ownCollectionReason
						: work.recommended
							? dashboardCopy.publicRecordsReason
							: dashboardCopy.publicCollectionReason,
			};
		})
		.sort((a, b) => b.score - a.score);
});
const recommendation = computed(() => {
	const mediaKind = focusKind.value === 'study' ? 'book' : focusKind.value;
	const preferred = recommendations.value.filter((item) => item.work.kind === mediaKind);
	const pool = [...preferred, ...recommendations.value.filter((item) => item.work.kind !== mediaKind)];
	return pool[recommendIndex.value % Math.max(1, pool.length)];
});

function nextRecommendation(): void {
	recommendIndex.value++;
}

let generation = 0,
	motionQuery: MediaQueryList | undefined,
	shelfMotion: ReturnType<typeof createHatadyShelfMotion> | undefined;
watch([shelfEl, shelf], () => {
	shelfMotion?.dispose();
	shelfMotion = undefined;
	nextTick(() => {
		shelfMotion?.dispose();
		if (shelfEl.value) shelfMotion = createHatadyShelfMotion({
			element: shelfEl.value,
			paused: () => shelfPaused.value,
			motionEnabled: () => motion.value,
			blocked: () => hatadyDialogSurfaces.value.length > 0,
			onStateChange: (state) => {
				shelfOverflow.value = state.overflow;
			},
		});
	});
});
watch([shelfPaused, motion, hatadyDialogSurfaces], () => shelfMotion?.refresh());

async function fetchActivities(params: Record<string, unknown>): Promise<HatadyActivity[]> {
	return collectActivityPages(async (cursor) =>
		requireHatadyActivityPage(
			await misskeyApi(
				'hata/hatady/activities' as never,
				{ ...params, limit: 100, ...(cursor ? { cursor } : {}) } as never,
			),
		),
	);
}

async function fetchWorks(scope: 'mine' | 'recent'): Promise<HatadyHomeWork[]> {
	const books = await collectWorkPages<Record<string, any> & { id: string }>(
		async (untilId) =>
			(await misskeyApi(
				'hata/hatady/books' as never,
				{ scope, limit: 100, ...(untilId ? { untilId } : {}) } as never,
			)) as any,
	);
	const media = await collectWorkPages<Record<string, any> & { id: string }>(
		async (untilId) =>
			(await misskeyApi(
				'hata/hatady/media/works/list' as never,
				{ scope, limit: 100, ...(untilId ? { untilId } : {}) } as never,
			)) as any,
	);
	return [
		...books.map((book) => homeWork(book, book.userId === $i?.id, 'book')),
		...media.map((work) => homeWork(work, work.userId === $i?.id, work.kind)),
	];
}

async function load(): Promise<void> {
	const request = ++generation;
	if (props.preview) {
		rows.value = props.preview.rows;
		communityRows.value = props.preview.communityRows;
		works.value = props.preview.works;
		now.value = props.preview.now;
		hasOlder.value = false;
		loading.value = false;
		error.value = '';
		loaded.value = true;
		return;
	}
	loading.value = true;
	error.value = '';
	const current = new Date(),
		period = homePeriod(current),
		today = new Date(current);
	today.setHours(0, 0, 0, 0);
	try {
		const [mine, community, ownWorks, publicWorks] = await Promise.all([
			fetchActivities({ scope: 'mine', untilDate: period.until }),
			fetchActivities({ scope: 'recent', sinceDate: today.getTime(), untilDate: period.until }),
			fetchWorks('mine'),
			fetchWorks('recent'),
		]);
		if (request !== generation) return;
		rows.value = mine;
		communityRows.value = community;
		works.value = [...new Map([...publicWorks, ...ownWorks].map((work) => [work.id, work])).values()];
		hasOlder.value = mine.some((row) => Date.parse(row.occurredAt) < period.since);
		now.value = current;
		loaded.value = true;
	} catch {
		if (request === generation) error.value = dashboardCopy.loadFailed;
	} finally {
		if (request === generation) loading.value = false;
	}
}

function onMotion(): void {
	reduced.value = motionQuery?.matches ?? false;
}

function onVisibility(): void {
	if (props.preview) return;
	if (!window.document.hidden && localDateKey(new Date()) !== localDateKey(now.value)) load();
}

watch(loaded, value => { if (value) emit('ready'); }, { flush: 'post' });
watch(() => props.revision, load);
watch(() => props.preview, load);
onMounted(() => {
	load();
	motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
	onMotion();
	motionQuery.addEventListener('change', onMotion);
	window.document.addEventListener('visibilitychange', onVisibility);
});
onUnmounted(() => {
	discardOverview();
	generation++;
	shelfMotion?.dispose();
	motionQuery?.removeEventListener('change', onMotion);
	window.document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<style lang="scss" module>
.home {
	container: hy-home / inline-size;
}
.home[data-preview='true'] .shelf {
	flex-wrap: wrap;
	overflow: visible;
}
.greeting {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 14px;
}
.greeting > div:first-child {
	min-width: 0;
}
.greeting[data-hosted='true'] {
	margin-bottom: 0;
}
.home[data-mode='new'] .greeting {
	margin-bottom: 14px;
}
.greetingActions {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	gap: 6px;
}
.greeting h1 {
	margin: 2px 0 0;
	font-size: 24px;
	line-height: 1.35;
}
.date {
	color: var(--hy-muted);
	font-size: 12px;
}
.date[data-hosted='true'] {
	display: block;
	color: var(--hy-ink);
	font-size: 24px;
	font-weight: 700;
	line-height: 1.25;
	white-space: nowrap;
}
.fullDate {
	display: block;
}
.fullDate, .shortDate {
	overflow: hidden;
	text-overflow: ellipsis;
}
.shortDate {
	display: none;
}
.overviewButton {
	display: inline-grid;
	place-items: center;
	padding: 0;
	width: 44px;
	min-height: 44px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
}
.overviewButton[data-hosted='true'] {
	order: -1;
}
@container (max-width: 600px) {
	.date[data-hosted='true'] {
		font-size: 18px;
	}
	.date[data-hosted='true'] .fullDate {
		display: none;
	}
	.shortDate {
		display: block;
	}
}
.bento {
	display: grid;
	grid-template-columns: repeat(12, minmax(0, 1fr));
	gap: 14px;
}
.bento > section {
	min-width: 0;
	border: 1px solid var(--hy-border);
	border-radius: 24px;
	padding: 18px;
	background: var(--hy-surface);
	box-shadow: var(--hy-shadow);
}
.bento h2 {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 15px;
	margin: 0;
}
.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-height: 44px;
	margin-top: -7px;
}
.head > h2 {
	min-width: 0;
}
.bento .hero {
	grid-column: span 8;
	background: var(--hy-soft);
	border-color: transparent;
	min-height: 270px;
}
.hero h3 {
	margin: 9px 0;
	font-size: 26px;
}
.hero p {
	line-height: 1.8;
	margin: 8px 0;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
}
.hero small {
	color: var(--hy-muted);
}
.recommendation {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	min-height: 198px;
	gap: 24px;
	padding: 5px;
	background: transparent;
	border: 0;
	color: inherit;
	text-align: left;
	cursor: pointer;
}
.recommendation > span:first-child {
	min-width: 0;
	flex: 1;
}
.recommendation > span:last-child {
	transform: rotate(5deg);
}
.recommendFoot {
	display: flex;
	align-items: center;
	gap: 10px;
	font-size: 13px;
	margin-top: 17px;
}
.contextHero {
	padding: 8px 4px;
}
.activityArt {
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 18px;
	flex: none;
	width: 116px;
	height: 142px;
	border-radius: 24px;
	background: var(--hy-surface);
	color: var(--hy-accent);
	transform: rotate(5deg);
}
.activityArt > i {
	font-size: 44px;
}
.activityArt small {
	font-size: 10px;
	letter-spacing: 0.08em;
}
.overview {
	display: grid;
	gap: 12px;
}
.overview > h3,
.overview > small {
	text-align: center;
}
.overview > div,
.overview > button {
	display: grid;
	grid-template-columns: 1fr 48px 48px;
	align-items: center;
	gap: 10px;
}
.overview > button {
	min-height: 58px;
	padding: 10px;
	border: 0;
	background: var(--hy-soft);
	color: var(--hy-ink);
	border-radius: 16px;
	text-align: left;
	cursor: pointer;
}
.overview > button span {
	display: flex;
	align-items: center;
	gap: 12px;
}
.overview > button b,
.overview > div > :not(:first-child) {
	text-align: center;
}
.metrics {
	grid-column: span 4;
	display: flex;
	flex-direction: column;
}
.total {
	display: flex;
	align-items: baseline;
	gap: 4px;
	margin: 10px 0;
}
.total strong {
	font-size: 30px;
	font-weight: 400;
	font-variant-numeric: tabular-nums;
}
.total small,
.metricFoot {
	color: var(--hy-muted);
	font-size: 12px;
}
.bars {
	display: flex;
	position: relative;
	flex: 1;
	align-items: flex-end;
	justify-content: space-between;
	min-height: 96px;
	padding-top: 20px;
	gap: 8px;
}
.bars > small {
	position: absolute;
	top: -3px;
	left: 0;
	font-size: 11px;
	color: var(--hy-muted);
}
.bars > div {
	display: flex;
	flex: 1;
	height: 78px;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	gap: 7px;
}
.bars i {
	width: 100%;
	border-radius: 6px;
	background: var(--hy-soft);
	min-height: 3px;
}
.bars [data-today='true'] i {
	background: var(--hy-accent);
}
.bars small {
	font-size: 11px;
	color: var(--hy-muted);
}
.metricFoot {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 8px;
}
.bento .community {
	grid-column: span 4;
	background: var(--hy-warm);
	border-color: transparent;
}
.avatars {
	display: flex;
}
.avatars button {
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: transparent;
	margin-right: -5px;
}
.avatar {
	width: 32px;
	height: 32px;
	border: 2px solid var(--hy-warm);
}
.link {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 44px;
	border: 0;
	padding: 0;
	background: transparent;
	color: var(--hy-accent);
	font-size: 13px;
	cursor: pointer;
}
.recent {
	grid-column: span 6;
	grid-row: 2;
}
.collection {
	grid-column: span 6;
	grid-row: 2;
}
.rows {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 8px;
}
.row {
	display: flex;
	align-items: center;
	width: 100%;
	min-width: 0;
	min-height: 55px;
	gap: 10px;
	padding: 7px 0;
	border: 0;
	background: transparent;
	color: inherit;
	text-align: left;
	cursor: pointer;
}
.row > i:first-child {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 42px;
	height: 42px;
	border-radius: 14px;
	background: var(--hy-soft);
	font-size: 19px;
}
.row > span {
	flex: 1;
	min-width: 0;
}
.row strong,
.row small {
	display: block;
}
.row strong {
	font-size: 14px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.row small {
	color: var(--hy-muted);
	font-size: 12px;
}
.shelf {
	display: flex;
	align-items: flex-end;
	gap: 55px;
	overflow: auto;
	scrollbar-width: none;
	min-height: 123px;
	padding: 12px;
	scroll-snap-type: none;
	scroll-behavior: auto;
	position: relative;
}
.shelf::-webkit-scrollbar {
	display: none;
}
.shelf > :is(button, [data-hatady-shelf-copy]) {
	border: 0;
	padding: 0;
	background: transparent;
	flex-shrink: 0;
	cursor: pointer;
}
.shelfCaption {
	width: 100%;
	display: flex;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 0 0;
	min-height: 32px;
	border: 0;
	background: transparent;
	color: var(--hy-muted);
	font-size: 12px;
	cursor: pointer;
}
.keep {
	grid-column: span 8;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
}
.keep strong,
.keep small {
	display: block;
	margin-top: 8px;
	font-size: 14px;
}
.keep small {
	color: var(--hy-muted);
	font-size: 12px;
}
.tools {
	display: flex;
	padding: 5px;
	border-radius: 999px;
	background: var(--hy-soft);
}
:global(.recommend-enter-active),
:global(.recommend-leave-active) {
	transition:
		opacity 0.18s ease,
		transform 0.18s ease;
}
:global(.recommend-enter-from) {
	opacity: 0;
	transform: translateY(8px);
}
:global(.recommend-leave-to) {
	opacity: 0;
	transform: translateY(-6px);
}
@container hy-home (max-width: 400px) {
	.greetingActions {
		display: grid;
		grid-template-columns: repeat(2, 44px);
	}
	.greetingActions > [data-hatady-home-actions] {
		grid-column: 1 / -1;
	}
}
@container hy-home (max-width: 580px) {
	.greeting h1 {
		font-size: 21px;
	}
	.bento {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.bento > section {
		padding: 14px;
		border-radius: 21px;
	}
	.bento .hero {
		grid-column: 1 / -1;
		grid-row: 1;
		min-height: 248px;
	}
	.hero h3 {
		font-size: 23px;
	}
	.recommendation {
		min-height: 175px;
		gap: 18px;
	}
	.recommendFoot {
		display: none;
	}
	.metrics {
		grid-column: 1;
		grid-row: 2;
		min-height: 165px;
	}
	.bento .community {
		grid-column: 2;
		grid-row: 2;
		min-height: 165px;
	}
	.community p,
	.avatars,
	.bars {
		display: none;
	}
	.community .link,
	.metricFoot {
		margin-top: auto;
	}
	.recent {
		grid-column: 1;
		grid-row: 3;
	}
	.collection {
		grid-column: 2;
		grid-row: 3;
	}
	.rows .row:nth-child(n + 2),
	.row > i:first-child,
	.row > small {
		display: none;
	}
	.row {
		padding-top: 22px;
	}
	.shelf {
		gap: 25px;
		min-height: 92px;
		padding: 8px;
	}
	.shelf > :is(button, [data-hatady-shelf-copy]) {
		transform: scale(0.72);
		transform-origin: left bottom;
		margin-right: -18px;
	}
	.shelfCaption > span:last-child {
		display: none;
	}
	.keep {
		grid-column: 1 / -1;
		grid-row: 4;
		min-height: 132px;
	}
	.keep > div > strong {
		display: none;
	}
	.bento h2 {
		font-size: 13px;
	}
}
@media (prefers-reduced-motion: reduce) {
	:global(.recommend-enter-active),
	:global(.recommend-leave-active) {
		transition: none;
	}
}
</style>
