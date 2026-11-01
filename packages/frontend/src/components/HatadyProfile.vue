<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady 1c): プロフィール・本棚(モーダル)。
  バナー(アバター/名前/自己紹介/統計) + 得意/苦手/興味 + 本棚。
  フォローは Hatady 内で完結(要件①・hataskey 本体と非連動)。自分のプロフィールでは編集ボタン。
-->
<template>
<HyDialog
	ref="dialog"
	:variant="variant"
	:title="copy.title"
	:embedded="inline"
	:bare="inline"
	@close="dialog?.close()"
	@closed="onClosed"
>
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.surface" :style="designStyle">
		<div v-if="!previewData" :class="$style.toolbar" :data-hosted="hostedHeader">
			<h1 v-if="!hostedHeader">{{ copy.title }}</h1>
			<Teleport :to="headerActionsTarget ?? 'body'" :disabled="!hostedHeader">
				<button v-if="profile?.isMe && (!hostedHeader || active)" type="button" class="hy-secondary" :class="$style.designButton" :data-hosted="hostedHeader" :aria-label="profileCopy.editDesign" :title="profileCopy.editDesign" @click="designOpen = true">
					<i class="ti ti-palette" aria-hidden="true"></i>
				</button>
			</Teleport>
		</div>
		<div v-if="loading" class="hy-empty">{{ copy.loading }}</div>
		<template v-else-if="profile">
			<div :class="$style.sections" :data-layout="design.layout">
				<header :class="$style.identityCard">
					<div :class="$style.colorCover"></div>
					<div :class="$style.identityRow">
						<MkAvatar :class="$style.profileAvatar" :user="profile.user"/>
						<div :data-editable="profile.isMe && !previewData">
							<h2><MkUserName :user="profile.user" :nowrap="false"/></h2>
							<div v-if="profile.user?.description" :class="$style.biography">
								<div
									:id="biographyId"
									ref="biographyViewport"
									:class="$style.biographyViewport"
									:data-collapsed="!biographyExpanded"
									:data-overflow="biographyOverflow"
									tabindex="-1"
								>
									<p ref="biographyText">{{ profile.user.description }}</p>
								</div>
								<button
									v-if="biographyOverflow && !biographyExpanded"
									type="button"
									class="hy-secondary"
									:class="$style.biographyMore"
									:aria-controls="biographyId"
									:aria-expanded="biographyExpanded"
									@click="expandBiography"
								>
									{{ profileCopy.showMore }}
									<i class="ti ti-chevron-down" aria-hidden="true"></i>
								</button>
							</div>
							<button
								v-if="profile.isMe && !previewData"
								class="hy-icon-button"
								:class="$style.profileEdit"
								:aria-label="copy.edit"
								:title="copy.edit"
								@click="editProfile"
							>
								<i class="ti ti-user-edit"></i>
							</button>
						</div>
					</div>
					<div :class="$style.socialRow">
						<div>
							<button class="hy-secondary" @click="openUserList('following')">
								<i class="ti ti-user-check"></i>
								{{ profile.followingCount }} {{ copy.following }}
							</button>
							<button class="hy-secondary" @click="openUserList('followers')">
								<i class="ti ti-users"></i>
								{{ profile.followersCount }} {{ copy.followers }}
							</button>
						</div>
						<button v-if="!profile.isMe" class="hy-secondary" :disabled="followBusy" @click="toggleFollow">
							<i :class="following ? 'ti ti-check' : 'ti ti-user-plus'"></i>
							{{ following ? copy.following : copy.follow }}
						</button>
					</div>
				</header>
				<section
					v-for="key in shownSections"
					:key="key"
					:class="$style.sectionCard"
					:style="{ order: design.order.indexOf(key) }"
					:data-section="key"
				>
					<h3>
						<i :class="['ti', sectionLabels[key].icon]"></i>
						{{ sectionLabels[key].label }}
					</h3>
					<template v-if="key === 'stats'">
						<div :class="$style.weekHeading">
							<span>{{ profileCopy.thisWeek }}</span>
							<strong>{{ i18n.tsx._hata._hatady._profileView.recordCount({ count: weekRecords }) }}</strong>
						</div>
						<div :class="$style.week">
							<button
								v-for="day in week"
								:key="day.date"
								:disabled="!day.logs.length"
								:data-recorded="!!day.logs.length"
								:aria-current="day.today ? 'date' : undefined"
								:aria-label="i18n.tsx._hata._hatady._statsView.dayCount({ date: day.date, count: day.logs.length })"
								@click="openDay(day)"
							>
								<small>{{ day.weekday }}</small>
								<strong>{{ day.day }}</strong>
								<i class="ti ti-book"></i>
								<small>{{ day.logs.length || '—' }}</small>
							</button>
						</div>
						<div :class="$style.numbers">
							<div>
								<strong>{{ profile.logCount }}</strong>
								<span>{{ profileCopy.allRecords }}</span>
							</div>
							<div>
								<strong>{{ profile.recordedDays ?? profile.streakDays }}</strong>
								<span>{{ profile.recordedDays != null ? profileCopy.recordedDays : copy.streak }}</span>
							</div>
							<div>
								<strong>{{ duration(profile.totalSeconds ?? profile.totalMinutes * 60) }}</strong>
								<span>{{ profileCopy.totalTime }}</span>
							</div>
						</div>
					</template>
					<template v-else-if="key === 'traits'">
						<div v-if="traitGroups.length" :class="$style.traitGrid">
							<section v-for="group in traitGroups" :key="group.kind">
								<h4>{{ activityName(group.kind) }}</h4>
								<div v-for="genre in group.genres" :key="genre.name">
									<strong>{{ genre.name }}</strong>
									<span v-for="tag in genre.tags" :key="tag" :class="$style.trait">{{ tagName(tag) }}</span>
								</div>
							</section>
						</div>
						<p v-else class="hy-empty">{{ profileCopy.emptyTraits }}</p>
					</template>
					<template v-else-if="key === 'shelf'">
						<div :class="$style.shelfFilters">
							<button
								v-for="f in shelfFilters"
								:key="f.key"
								class="hy-secondary"
								:aria-pressed="shelfFilter === f.key"
								@click="shelfFilter = f.key"
							>
								{{ f.label }}
							</button>
						</div>
						<p v-if="mediaWorksTruncated" class="hy-error">{{ profileCopy.collectionPartial }}</p>
						<div :class="$style.collectionGrid">
							<button v-for="book in shownShelfBooks" :key="book.id" @click="openBook(book.id)">
								<HyBookCover
									:title="book.title"
									:author="book.author"
									:colorIndex="book.coverColorIndex"
									:width="86"
									showTitle
								/>
								<strong>{{ book.title }}</strong>
								<small>{{ bookStatus(book.status) }}</small>
							</button>
							<button v-for="work in shownMediaWorks" :key="work.id" @click="openMedia(work.id)">
								<HyMediaCover
									:kind="work.kind"
									:title="work.title"
									:subtitle="work.creator"
									:colorIndex="work.coverColorIndex"
									:width="86"
								/>
								<strong>{{ work.title }}</strong>
							</button>
						</div>
						<button
							v-if="
								!expandedShelf && (shelfBooks.length > 6 || mediaWorks.filter((w) => w.kind !== 'work').length > 6)
							"
							class="hy-secondary"
							@click="expandedShelf = true"
						>
							{{ profileCopy.showMore }}
						</button>
						<p v-if="!(profile.books?.length || mediaWorks.length)" class="hy-empty">{{ copy.noBooks }}</p>
					</template>
					<template v-else-if="key === 'recent'">
						<div v-if="recent.length" :class="$style.recent">
							<HatadyActivityCard
								v-for="activity in recent.slice(0, 3)"
								:key="activity.id"
								:activity="activity"
								:variant="variant"
								@openLog="openLog($event)"
								@openBook="openBook($event)"
								@openMedia="openMedia($event)"
								@openSession="openMediaSession"
								@edit="editActivity"
								@deleted="onActivityDeleted(activity)"
								@openProfile="openProfile($event)"
								@menu="activityMenu"
							/>
						</div>
						<p v-else class="hy-empty">{{ copy.noPosts }}</p>
					</template>
					<template v-else-if="key === 'work'">
						<button
							v-for="work in mediaWorks.filter((w) => w.kind === 'work')"
							:key="work.id"
							:class="$style.project"
							@click="openMedia(work.id)"
						>
							<i class="ti ti-briefcase"></i>
							<strong>{{ work.title }}</strong>
							<small>{{ work.status === 'completed' ? i18n.ts._hata._hatady._recordTags.doneAll : profileCopy.ongoing }}</small>
						</button>
						<p v-if="!mediaWorks.some((w) => w.kind === 'work')" class="hy-empty">{{ profileCopy.emptyWork }}</p>
					</template>
				</section>
			</div>
		</template>
		<div v-else class="hy-empty">{{ copy.notFound }}</div>
	</div>
</HyDialog>
<Teleport to="body">
	<HatadyProfileDesign
		v-if="designOpen"
		:profile="{ ...profile, mediaWorks }"
		:design="design"
		@saved="saveDesign"
		@closed="designOpen = false"
	/>
</Teleport>
<HyDialog v-if="selectedDay" :variant="variant" :title="i18n.tsx._hata._hatady._statsView.dayRecords({ date: selectedDay.date })" @close="selectedDay = null">
	<HatadyActivityCard
		v-for="activity in selectedDay.logs"
		:key="activity.id"
		:activity="activity"
		:variant="variant"
		@openLog="openLog($event)"
		@openMedia="openMedia($event)"
		@openBook="openBook($event)"
		@openSession="openMediaSession"
		@edit="editActivity"
		@deleted="onActivityDeleted(activity)"
		@openProfile="openProfile($event)"
		@menu="activityMenu"
	/>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick, useId, watch, defineAsyncComponent } from 'vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyProfileDesign from '@/components/HatadyProfileDesign.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import {
	hatadyDuration as duration,
	hatadyNotify,
	HATADY_RECORD_TAGS,
	HATADY_ACTIVITY_CHOICES,
} from '@/utility/hatady-ui.js';
import HyBookCover from '@/components/HyBookCover.vue';
import HyMediaCover from '@/components/HyMediaCover.vue';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import * as os from '@/os.js';
import { useHataGoesPopup, useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { confirmHatadyAction } from '@/utility/hatady-record-delete.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { HY_BANNER_PRESETS } from '@/utility/hatady.js';
import { hatadyTheme, hatadyTzOffset } from '@/utility/hatady-prefs.js';
import { isOwnHatadyProfile, openOwnHatadyProfileIfNeeded, useHatadyActivityActions } from '@/utility/hatady-activity-actions.js';

const popup = useHataGoesPopup();
const popupMenu = useHataGoesPopupMenu();

const props = withDefaults(defineProps<{
	userId?: string | null;
	variant?: 'hatady' | 'ui' | 'uis';
	inline?: boolean;
	active?: boolean;
	headerActionsTarget?: HTMLElement | null;
	previewData?: any;
	previewDesign?: Record<string, any>;
}>(), { active: true });
const hostedHeader = computed(() => props.inline && !props.previewData && !!props.headerActionsTarget);
const timelineActions = useHatadyActivityActions({
	variant: props.variant,
	onChanged: () => { void reload(); emit('changed'); },
	onDeleted: removeActivity,
});
const emit = defineEmits<{
	(ev: 'changed'): void;
	(ev: 'openLog', logId: string): void;
	(ev: 'openProfile', userId: string): void;
	(ev: 'openBook', bookId: string): void;
	(ev: 'openMedia', workId: string): void;
	(ev: 'closed'): void;
}>();
const dialog = ref<any>(null);
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._profile;
const copyx = i18n.tsx._hata._hatady._profile;
const profileCopy = i18n.ts._hata._hatady._profileView;

const profile = ref<any>(props.previewData || null);
const biographyId = useId();
const biographyViewport = ref<HTMLElement | null>(null);
const biographyText = ref<HTMLElement | null>(null);
const biographyExpanded = ref(false);
const biographyOverflow = ref(false);
let biographyObserver: ResizeObserver | undefined;

function measureBiography() {
	const viewport = biographyViewport.value;
	const text = biographyText.value;
	biographyOverflow.value = !!viewport && !!text && viewport.clientHeight > 0 && text.scrollHeight > viewport.clientHeight + 1;
}

async function expandBiography() {
	biographyExpanded.value = true;
	await nextTick();
	biographyViewport.value?.focus({ preventScroll: true });
}

watch([biographyViewport, biographyText], ([viewport, text]) => {
	biographyObserver?.disconnect();
	if (viewport && text) {
		biographyObserver = new ResizeObserver(measureBiography);
		biographyObserver.observe(viewport);
		biographyObserver.observe(text);
	}
	measureBiography();
}, { flush: 'post' });

watch([() => profile.value?.user?.id, () => profile.value?.user?.description], async () => {
	biographyExpanded.value = false;
	await nextTick();
	measureBiography();
});

onUnmounted(() => biographyObserver?.disconnect());

const loading = ref(!props.previewData);
const mediaLoading = ref(false);
const mediaWorks = ref<any[]>(props.previewData?.mediaWorks || []);
const mediaWorksTruncated = ref(false);
const following = ref(false);
const followBusy = ref(false);
const bannerColor = ref<string | null>(null);
const expandedShelf = ref(false);
const shelfFilter = ref<'all' | 'reading' | 'finished' | 'tsundoku' | 'want'>('all');

const shelfFilters = [
	{ key: 'all' as const, label: copy.filterAll },
	{ key: 'reading' as const, label: copy.statusReading },
	{ key: 'finished' as const, label: copy.statusFinished },
	{ key: 'tsundoku' as const, label: copy.statusTsundoku },
	{ key: 'want' as const, label: copy.statusWant },
];
const statusLabels: Record<string, string> = {
	reading: copy.statusReading,
	finished: copy.statusFinished,
	tsundoku: copy.statusTsundoku,
	want: copy.statusWant,
};

function bookStatus(status: string): string {
	return statusLabels[status] ?? status;
}

async function openUserList(type: 'following' | 'followers') {
	if (!profile.value) return;
	const { dispose } = popup(
		(await import('@/components/HatadyUserList.vue')).default,
		{
			userId: profile.value.user.id,
			type,
		},
		{
			openProfile: (uid: string) => openProfile(uid),
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

const shelfBooks = computed(() => {
	if (!profile.value) return [];
	return shelfFilter.value === 'all'
		? profile.value.books
		: profile.value.books.filter((b: any) => b.status === shelfFilter.value);
});
const shownShelfBooks = computed(() => (expandedShelf.value ? shelfBooks.value : shelfBooks.value.slice(0, 6)));
const shownMediaWorks = computed(() => {
	const works = mediaWorks.value.filter((w) => w.kind !== 'work');
	return expandedShelf.value ? works : works.slice(0, 6);
});

let profileRequest = 0;
let disposed = false;

async function reloadMedia(userId: string, request: number) {
	const PAGE_LIMIT = 100;
	const MAX_PAGES = 50;
	mediaLoading.value = true;
	mediaWorksTruncated.value = false;
	try {
		const collected: any[] = [];
		const seenIds = new Set<string>();
		const seenCursors = new Set<string>();
		let untilId: string | undefined;
		let completed = false;

		for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
			let page: any[];
			try {
				const response = await misskeyApi(
					'hata/hatady/media/works/list' as never,
					{
						userId,
						sort: 'updatedAt',
						order: 'desc',
						limit: PAGE_LIMIT,
						...(untilId ? { untilId } : {}),
					} as never,
				);
				if (request !== profileRequest) return;
				if (!Array.isArray(response)) throw new TypeError('Invalid Hatady media work list response');
				page = response;
			} catch {
				if (request !== profileRequest) return;
				mediaWorksTruncated.value = true;
				break;
			}

			for (const work of page) {
				if (typeof work?.id !== 'string' || seenIds.has(work.id)) continue;
				seenIds.add(work.id);
				collected.push(work);
			}

			if (page.length < PAGE_LIMIT) {
				completed = true;
				break;
			}

			const nextUntilId = page.at(-1)?.id;
			if (typeof nextUntilId !== 'string' || seenCursors.has(nextUntilId)) {
				mediaWorksTruncated.value = true;
				break;
			}
			seenCursors.add(nextUntilId);
			untilId = nextUntilId;
		}

		// 50ページ目が満杯でも、ちょうど5000件なら「打ち切り」ではない。
		// 次の1件だけを確認し、実際に続きがある場合だけ下限表示(≥)にする。
		if (!completed && untilId) {
			try {
				const probe: unknown = await misskeyApi(
					'hata/hatady/media/works/list' as never,
					{
						userId,
						sort: 'updatedAt',
						order: 'desc',
						limit: 1,
						untilId,
					} as never,
				);
				if (request !== profileRequest) return;
				if (!Array.isArray(probe)) throw new TypeError('Invalid Hatady media work list response');
				completed = probe.length === 0;
			} catch {
				if (request !== profileRequest) return;
				mediaWorksTruncated.value = true;
			}
		}

		mediaWorks.value = collected;
		if (!completed) mediaWorksTruncated.value = true;
	} finally {
		if (request === profileRequest) mediaLoading.value = false;
	}
}

async function reload() {
	if (disposed) return;
	const request = ++profileRequest;
	loading.value = true;
	mediaLoading.value = false;
	try {
		const payload: Record<string, unknown> = { tzOffset: hatadyTzOffset() };
		if (props.userId) payload.userId = props.userId;
		const nextProfile = await misskeyApi('hata/hatady/users/show', payload).catch(() => null);
		if (request !== profileRequest) return;
		profile.value = nextProfile;
		following.value = profile.value?.isFollowing ?? false;
		bannerColor.value = profile.value?.bannerColor ?? null;
		if (profile.value?.user?.id) await reloadMedia(profile.value.user.id, request);
		else {
			mediaWorks.value = [];
			mediaWorksTruncated.value = false;
		}
	} finally {
		if (request === profileRequest) loading.value = false;
	}
}

async function toggleFollow() {
	if (!profile.value || profile.value.isMe) return;
	const uname = profile.value.user.name || profile.value.user.username;
	// フォロー / 解除の前に確認する。
	if (!(await confirmHatadyAction(props.variant ?? 'hatady', following.value ? copyx.unfollowConfirm({ name: uname }) : copyx.followConfirm({ name: uname }), following.value ? 'warning' : 'question', popup))) return;
	followBusy.value = true;
	const target = profile.value.user.id;
	try {
		const next = !following.value;
		await misskeyApi(next ? 'hata/hatady/following/create' : 'hata/hatady/following/delete', { userId: target });
		following.value = next;
		profile.value.followersCount = Math.max(0, profile.value.followersCount + (next ? 1 : -1));
		// フォロー境界が変わった直後に、APIが現在許可する作品だけへ同期する。
		// 特に解除後、取得済みの followers 作品をプロフィール内へ残さない。
		await reload();
		emit('changed');
	} catch {
		hatadyNotify(profileCopy.followFailed);
	} finally {
		followBusy.value = false;
	}
}

function editProfile() {
	// プロフィール(名前/アイコン/自己紹介)は hataskey 本体の設定に準ずる。
	os.pageWindow('/settings/profile');
}

const designOpen = ref(false),
	selectedDay = ref<any>(null);
const sectionLabels: Record<string, { label: string; icon: string }> = {
	stats: { label: profileCopy.statsSection, icon: 'ti-calendar' },
	traits: { label: profileCopy.traitsSection, icon: 'ti-sparkles' },
	shelf: { label: i18n.ts._hata._hatady._media.collection, icon: 'ti-books' },
	recent: { label: profileCopy.recentSection, icon: 'ti-notebook' },
	work: { label: profileCopy.workSection, icon: 'ti-briefcase' },
};
const design = computed<any>(() => {
	const d = props.previewDesign || profile.value?.design || {};
	return {
		...d,
		layout: d.layout || 'bento',
		palette: d.palette || 'theme',
		corners: d.corners || 'soft',
		spacing: d.spacing || 'relaxed',
		order: [...new Set([...(Array.isArray(d.order) ? d.order : []), ...Object.keys(sectionLabels)])],
		hidden: Array.isArray(d.hidden) ? d.hidden : [],
	};
});
const shownSections = computed(
	() => design.value.order.filter((k: string) => sectionLabels[k] && !design.value.hidden.includes(k)) as string[],
);
const designStyle = computed(() => {
	const dark = theme.value === 'dark' || theme.value === 'espresso';
	const palettes: Record<string, { accent: string; wash: string }> = {
		leaf: { accent: dark ? '#a9d8bd' : '#326946', wash: dark ? '#293f34' : '#e6eee6' },
		violet: { accent: dark ? '#cdbbee' : '#665285', wash: dark ? '#3d354e' : '#ebe5f4' },
		clay: { accent: dark ? '#eec09d' : '#844d39', wash: dark ? '#49352e' : '#f5e5d9' },
	};
	const palette = palettes[design.value.palette];
	const hasPalette = Boolean(props.previewDesign?.palette || profile.value?.design?.palette);
	const legacyAccent = HY_BANNER_PRESETS.find(preset => preset.key === bannerColor.value)?.from;
	const accent = palette?.accent || (!hasPalette && legacyAccent) || 'var(--hy-accent)';
	return {
		'--profile-accent': accent,
		'--profile-wash': palette?.wash || (!hasPalette && legacyAccent ? `color-mix(in srgb, ${legacyAccent} 18%, var(--hy-surface))` : 'var(--hy-soft)'),
		'--profile-radius': design.value.corners === 'neat' ? '14px' : '26px',
		'--profile-gap': design.value.spacing === 'compact' ? '12px' : '20px',
	};
});
const recent = computed<any[]>(
	() =>
		profile.value?.activities ||
		(profile.value?.logs || []).map((log: any) => ({
			id: log.id,
			type: log.kind || 'study',
			occurredAt: log.studiedAt,
			user: log.user || profile.value.user,
			visibility: log.visibility || (log.isPublic ? 'public' : 'private'),
			isMine: profile.value.isMe,
			study: log,
		})),
);
const week = computed(() =>
	Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - 6 + i);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		return {
			date: key,
			day: d.getDate(),
			weekday: new Intl.DateTimeFormat(versatileLang, { weekday: 'short' }).format(d),
			today: i === 6,
			logs: recent.value.filter((a) => new Date(a.occurredAt).toLocaleDateString('sv-SE') === key),
		};
	}),
);
const weekRecords = computed(() => week.value.reduce((n, d) => n + d.logs.length, 0));
const traitGroups = computed<any[]>(() => {
	if (Array.isArray(profile.value?.traits)) return profile.value.traits;
	const groups = new Map<string, Map<string, Set<string>>>();
	for (const a of recent.value) {
		const r = a.study || a.media?.session || a;
		const kind =
			a.type === 'study'
				? r.kind || 'study'
				: a.type.startsWith('movie')
					? 'movie'
					: a.type.startsWith('game')
						? 'game'
						: a.type;
		const genre = r.subject || a.media?.work?.genres?.[0] || r.details?.genre || i18n.ts._hata._hatady._workWizard.unset;
		if (!groups.has(kind)) groups.set(kind, new Map());
		const g = groups.get(kind)!;
		if (!g.has(genre)) g.set(genre, new Set());
		for (const tag of r.tags || [r.tag].filter(Boolean)) g.get(genre)!.add(tag);
	}
	return [...groups].map(([kind, g]) => ({ kind, genres: [...g].map(([name, tags]) => ({ name, tags: [...tags] })) }));
});

function activityName(kind: string) {
	return HATADY_ACTIVITY_CHOICES.find((k) => k.value === kind)?.label || kind;
}

function tagName(tag: string) {
	return HATADY_RECORD_TAGS.find((k) => k.value === tag)?.label || tag;
}

function saveDesign(value: Record<string, any>) {
	if (profile.value) profile.value.design = value;
	emit('changed');
}

function openDay(day: any) {
	selectedDay.value = day;
}

async function openMediaSession(sessionId: string, workId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ sessionId, workId, variant: props.variant },
		{
			deleted: removeActivity,
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

function removeActivity(activity: HatadyActivity): void {
	profileRequest++;
	if (profile.value?.activities) profile.value.activities = profile.value.activities.filter((row: HatadyActivity) => row.id !== activity.id);
	if (activity.study && profile.value?.logs) profile.value.logs = profile.value.logs.filter((log: { id: string }) => log.id !== activity.study!.id);
	if (selectedDay.value) selectedDay.value.logs = selectedDay.value.logs.filter((row: HatadyActivity) => row.id !== activity.id);
}

async function onActivityDeleted(activity: HatadyActivity): Promise<void> {
	removeActivity(activity);
	emit('changed');
	await reload();
}

async function editActivity(activity: any) {
	if (activity.study) {
		const { dispose } = popup(
			(await import('@/components/HatadyComposer.vue')).default,
			{ editLog: activity.study, variant: props.variant },
			{
				done: () => {
					void reload();
					emit('changed');
				},
				closed: () => dispose(),
			},
		);
	} else if (activity.media?.work) {
		const { dispose } = popup(
			(await import('@/components/HatadyMediaSessionForm.vue')).default,
			{ work: activity.media.work, editSession: activity.media.session, variant: props.variant },
			{
				done: () => {
					void reload();
					emit('changed');
				},
				closed: () => dispose(),
			},
		);
	}
}

function activityMenu(activity: any, event: MouseEvent) {
	if (props.variant && props.variant !== 'hatady') { timelineActions.openActivityMenu(activity, event); return; }
	popupMenu(
		[
			{
				text: i18n.ts.reportAbuse,
				icon: 'ti ti-flag',
				action: () => {
					const { dispose } = popup(
						defineAsyncComponent(() => import('@/components/MkAbuseReportWindow.vue')),
						{
							user: activity.user,
							initialComment: `hatady:${activity.study ? 'log' : 'media:session'}:${activity.id}`,
						},
						{ closed: () => dispose() },
					);
				},
			},
		],
		event.currentTarget as HTMLElement,
	);
}

async function openLog(logId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ logId, variant: props.variant },
		{
			deleted: removeActivity,
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openBook(bookId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyBookDetail.vue')).default,
		{ bookId, variant: props.variant },
		{
			deleted: () => {
				profileRequest++;
				if (profile.value?.books) profile.value.books = profile.value.books.filter((book: { id: string }) => book.id !== bookId);
			},
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openMedia(workId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyMediaWorkDetail.vue')).default,
		{ workId, variant: props.variant },
		{
			deleted: () => {
				profileRequest++;
				mediaWorks.value = mediaWorks.value.filter(work => work.id !== workId);
			},
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

let navigateToOwnProfile = false;

function onClosed() {
	emit('closed');
	if (navigateToOwnProfile) openOwnHatadyProfileIfNeeded(undefined, props.variant ?? 'hatady');
}

async function openProfile(userId: string) {
	if (isOwnHatadyProfile(userId, props.variant ?? 'hatady')) {
		navigateToOwnProfile = true;
		dialog.value?.close();
		return;
	}
	const { dispose } = popup(
		defineAsyncComponent(() => import('@/components/HatadyProfile.vue')),
		{ userId, variant: props.variant },
		{
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

watch(
	() => props.userId,
	() => {
		void reload();
	},
);

watch(
	() => props.previewData,
	(value) => {
		if (value) {
			profileRequest++;
			profile.value = value;
			mediaWorks.value = value.mediaWorks || [];
		}
	},
	{ deep: true },
);
onMounted(() => {
	if (!props.previewData) void reload();
});
onUnmounted(() => {
	disposed = true;
	profileRequest++;
});
</script>

<style lang="scss" module>
.surface {
	--profile-panel-gap: min(var(--profile-gap), 16px);
	container: hy-profile / inline-size;
	width: 100%;
	min-width: 0;
	color: var(--hy-body);
}
.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	margin: 8px 0 16px;
}
.toolbar h1 {
	font-size: 24px;
	margin: 0;
}
.toolbar[data-hosted='true'] {
	display: contents;
}
.designButton[data-hosted] {
	display: inline-flex;
	flex: 0 0 44px;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	padding: 0;
}
.designButton[data-hosted='true'] {
	order: -1;
}
.identityCard {
	order: -1;
	border: 1px solid var(--hy-border);
	border-radius: var(--profile-radius);
	background: var(--hy-surface);
	overflow: hidden;
}
.colorCover {
	height: 88px;
	background: var(--profile-wash);
}
.identityRow {
	display: flex;
	gap: 20px;
	padding: 0 26px 24px;
}
.profileAvatar {
	width: 88px;
	height: 88px;
	flex: none;
	margin-top: -28px;
	border: 5px solid var(--hy-surface);
	border-radius: 50%;
}
.identityRow > div {
	padding-top: 18px;
	min-width: 0;
	flex: 1;
	position: relative;
}
.identityRow h2 {
	font-size: 26px;
	margin: 4px 0 12px;
	overflow-wrap: anywhere;
}
.identityRow > [data-editable='true'] h2 {
	padding-inline-end: 44px;
}
.biography {
	margin: 14px 0;
	font-size: 14px;
	line-height: 1.7;
}
.biographyViewport[data-collapsed='true'] {
	max-height: 6.8em;
	overflow: hidden;
}
.biographyViewport[data-collapsed='true'][data-overflow='true'] {
	mask-image: linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent);
	-webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent);
}
.biography p {
	margin: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
.biographyMore {
	margin-top: 4px;
	font-size: inherit;
}
.profileEdit {
	position: absolute;
	right: 0;
	top: 12px;
}
.socialRow {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	gap: 12px;
	margin: 0 26px 24px;
	padding-top: 16px;
	border-top: 1px solid var(--hy-border);
}
.socialRow > div {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}
.sections {
	--profile-card-width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: var(--profile-panel-gap);
}
.identityCard,
.sectionCard {
	container: hy-profile-card / inline-size;
	box-sizing: border-box;
	flex: 1 1 var(--profile-card-width);
	min-width: 0;
}
.sectionCard {
	padding: var(--profile-panel-gap);
	border: 1px solid var(--hy-border);
	border-radius: var(--profile-radius);
	background: var(--hy-surface);
	min-width: 0;
}
.sectionCard > h3 {
	display: flex;
	gap: 8px;
	align-items: center;
	font-size: 16px;
	margin: 0 0 16px;
}
.weekHeading {
	display: flex;
	justify-content: space-between;
	margin-bottom: 16px;
}
.week {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
	gap: 8px;
}
.week button {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 7px;
	border: 1px solid transparent;
	border-radius: 18px;
	padding: 10px 3px;
	background: var(--hy-bg);
	color: var(--hy-muted);
}
.week button[data-recorded='true'] {
	color: var(--profile-accent);
	background: var(--profile-wash);
	cursor: pointer;
}
.week button[aria-current='date'] {
	border-color: var(--profile-accent);
}
.week strong {
	font-size: 20px;
}
.numbers {
	display: grid;
	grid-template-columns: 1fr 1fr 1.5fr;
	border-top: 1px solid var(--hy-border);
	margin-top: 20px;
	padding-top: 16px;
}
.numbers > div {
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 9px;
	padding: 10px 6px;
}
.numbers > div + div {
	border-left: 1px solid var(--hy-border);
}
.numbers strong {
	font-size: 24px;
	color: var(--profile-accent);
	font-weight: 400;
}
.numbers span {
	font-size: 12px;
	color: var(--hy-muted);
}
.traitGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 16px;
}
.traitGrid section {
	background: var(--hy-surface-2);
	padding: 16px;
	border-radius: 16px;
}
.traitGrid h4 {
	margin: 0 0 14px;
}
.traitGrid section > div {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	border-top: 1px solid var(--hy-border);
	padding: 12px 0;
}
.traitGrid strong {
	width: 100%;
	font-size: 13px;
}
.trait {
	font-size: 12px;
	border-radius: 999px;
	background: var(--hy-surface);
	padding: 4px 8px;
}
.collectionGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 86px), 1fr));
	gap: 14px;
}
.collectionGrid button {
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 10px;
	background: none;
	border: 0;
	color: inherit;
	cursor: pointer;
	min-width: 0;
}
.collectionGrid strong {
	font-size: 13px;
	overflow-wrap: anywhere;
}
.collectionGrid small {
	color: var(--hy-muted);
}
.recent {
	display: grid;
	gap: 12px;
}
.project {
	display: flex;
	gap: 12px;
	align-items: center;
	width: 100%;
	padding: 16px 0;
	border: 0;
	border-top: 1px solid var(--hy-border);
	background: none;
	text-align: left;
	color: inherit;
	cursor: pointer;
}
.project strong {
	flex: 1;
}
.project small {
	color: var(--hy-muted);
}
@container hy-profile (min-width:700px) {
	.sections:not([data-layout='journal']) {
		--profile-card-width: calc((100% - var(--profile-panel-gap)) / 2);
	}
	.sections[data-layout='gallery'] > .sectionCard[data-section='shelf'] {
		flex-basis: 100%;
	}
}
@container hy-profile (min-width:1100px) {
	.sections:not([data-layout='journal']) {
		--profile-card-width: calc((100% - var(--profile-panel-gap) * 2) / 3);
	}
	.sections:not([data-layout='journal']) > .sectionCard[data-section='stats'] {
		flex-basis: calc(var(--profile-card-width) * 2 + var(--profile-panel-gap));
	}
}
@container (max-width:650px) {
	.identityRow {
		padding-inline: 18px;
		gap: 14px;
	}
	.socialRow {
		margin-inline: 18px;
		flex-wrap: wrap;
	}
	.numbers strong {
		font-size: 19px;
	}
	.numbers span {
		font-size: 11px;
	}
	.week {
		gap: 5px;
	}
}
.shelfFilters {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 16px;
}
.shelfFilters button[aria-pressed='true'] {
	background: var(--hy-accent);
	color: var(--hy-on-accent, #fff);
}
</style>
