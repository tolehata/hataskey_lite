<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hatady の学習・映画鑑賞・ゲームプレイを同じ時系列で表示する活動カード。
-->
<template>
<article :class="$style.card" :data-kind="activity.type" :data-hatady-variant="variant">
	<header :class="$style.head">
		<button
			v-if="showAuthor && activity.user"
			type="button"
			:class="$style.author"
			@click="emit('openProfile', activity.user.id)"
		>
			<MkAvatar :class="$style.avatar" :user="activity.user"/>
			<span><MkUserName :user="activity.user"/></span>
		</button>
		<span v-else :class="$style.kindLead">
			<i :class="['ti', kindIcon]"></i>
			{{ kindLabel }}
		</span>
		<span :class="$style.stamp">
			<time :datetime="activity.occurredAt">{{ whenLabel }}</time>
			<VisibilityChip :visibility="activity.visibility"/>
		</span>
		<div :class="$style.context">
			<span>{{ kindLabel }}</span>
			<span v-for="tag in recordTags" :key="tag" :class="$style.tag">
				<i :class="['ti', tagIcon(tag)]"></i>
				{{ tagLabel(tag) }}
			</span>
		</div>
	</header>
	<button type="button" :class="$style.titleButton" @click="openRecord">
		<i :class="['ti', kindIcon]"></i>
		<h3>{{ study?.title || media?.work?.title || sourceRecord.workSnapshot?.title || raw.title }}</h3>
	</button>
	<template v-if="study">
		<details v-if="study.details?.spoiler" :class="$style.spoiler">
			<summary>
				<i class="ti ti-eye-off"></i>
				{{ activityCopy.spoilerRecord }}
			</summary>
			<RecordText v-if="study.body" :text="study.body"/>
			<MkMediaList v-if="study.files?.length" :mediaList="study.files" :user="activity.user"/>
			<ActivityLogDetail v-if="detailed" :record="study"/>
		</details>
		<template v-else>
			<RecordText v-if="study.body" :text="study.body"/>
			<MkMediaList v-if="study.files?.length" :mediaList="study.files" :user="activity.user"/>
			<ActivityLogDetail v-if="detailed" :record="study"/>
		</template>
		<div :class="$style.meta">
			<span>{{ study.subject }}</span>
			<span v-if="study.details?.calories != null">{{ study.details.calories }} kcal</span>
			<span v-if="durationSeconds != null">
				<i class="ti ti-clock"></i>
				{{ secondsLabel(durationSeconds) }}
			</span>
		</div>
		<button
			v-if="study.mediaWork"
			type="button"
			:class="$style.workLink"
			@click="emit('openMedia', study.mediaWork.id)"
		>
			<i class="ti ti-briefcase"></i>
			{{ study.mediaWork.title }}
		</button>
		<button
			v-if="study.book && study.title !== study.book.title"
			type="button"
			:class="$style.workLink"
			@click="emit('openBook', study.book.id)"
		>
			<i class="ti ti-book"></i>
			{{ study.book.title }}
		</button>
	</template>
	<template v-else-if="media?.session">
		<details v-if="media.session.noteSpoiler" :class="$style.spoiler">
			<summary>
				<i class="ti ti-eye-off"></i>
				{{ mediaCopy.detail.showSpoilerSession }}
			</summary>
			<ActivityMediaDetail :session="media.session" :rows="factRows"/>
		</details>
		<ActivityMediaDetail v-else :session="media.session" :rows="factRows"/>
		<div :class="$style.meta">
			<span>{{ media.work?.genres?.join(' · ') }}</span>
			<span v-if="durationSeconds != null">
				<i class="ti ti-clock"></i>
				{{ secondsLabel(durationSeconds) }}
			</span>
		</div>
	</template>
	<template v-else>
		<RecordText :text="raw.body || raw.note || ''"/>
		<div :class="$style.meta">
			<span>{{ raw.subject || raw.genre }}</span>
			<span v-if="durationSeconds != null">
				<i class="ti ti-clock"></i>
				{{ secondsLabel(durationSeconds) }}
			</span>
			<span v-if="raw.calories != null">{{ raw.calories }} kcal</span>
		</div>
	</template>
	<footer v-if="showActions" :class="$style.foot">
		<HatadyReactions
			:variant="variant"
			:target="study ? { logId: study.id } : { sessionId: media?.session?.id || activity.id }"
			:reactions="recordReactions"
			:myReaction="sourceRecord.myReaction ?? null"
		/>
		<div :class="$style.actions">
			<button type="button" class="hy-icon-button" :aria-label="activityCopy.openReplies" @click="openRecord">
				<i class="ti ti-message-circle-2"></i>
				<span v-if="(sourceRecord.commentsCount ?? 0) > 0">{{ sourceRecord.commentsCount }}</span>
			</button>
			<button v-if="variant !== 'hatady'" type="button" class="hy-icon-button" :aria-label="i18n.ts.options" @click="emit('menu', activity, $event)"><i class="ti ti-dots"></i></button>
			<button
				v-else-if="activity.isMine"
				type="button"
				class="hy-icon-button"
				:aria-label="i18n.ts._hata._hatady._wizardComposer.editRecord"
				:title="i18n.ts._hata._hatady._wizardComposer.editRecord"
				:disabled="deleting"
				@click="emit('edit', activity)"
			>
				<i class="ti ti-pencil"></i>
			</button>
			<button v-if="variant === 'hatady' && activity.isMine" type="button" class="hy-icon-button" :aria-label="i18n.ts._hata._recordModeration.deleteRecord" :title="i18n.ts._hata._recordModeration.deleteRecord" :disabled="deleting" :aria-busy="deleting" @click="deleteRecord">
				<i class="ti ti-trash" aria-hidden="true"></i>
			</button>
			<button
				v-else-if="variant === 'hatady' && !activity.isMine"
				type="button"
				class="hy-icon-button"
				:aria-label="i18n.ts.reportAbuse"
				@click="emit('menu', activity, $event)"
			>
				<i class="ti ti-flag"></i>
			</button>
		</div>
	</footer>
</article>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, ref, resolveComponent, useCssModule } from 'vue';
import type { HatadyActivity, HatadyMediaSession, HatadyMediaVisibility } from '@/utility/hatady-media.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import MkMediaList from '@/components/MkMediaList.vue';
import HatadyReactions from '@/components/HatadyReactions.vue';
import { hyTagLabel } from '@/utility/hatady.js';
import { HATADY_RECORD_TAGS, hatadyDuration as secondsLabel } from '@/utility/hatady-ui.js';
import { HATADY_STAT_FIELDS, hatadyMediaCopy, mediaSessionDisplayFacts } from '@/utility/hatady-media.js';
import { confirmHatadyRecordDeletion } from '@/utility/hatady-record-delete.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const props = withDefaults(
	defineProps<{ activity: HatadyActivity; showAuthor?: boolean; showActions?: boolean; detailed?: boolean; variant?: HatadySurfaceVariant }>(),
	{ showAuthor: true, showActions: true, detailed: false, variant: 'hatady' },
);
const emit = defineEmits<{
	(ev: 'openLog', logId: string): void;
	(ev: 'openBook', bookId: string): void;
	(ev: 'openMedia', workId: string): void;
	(ev: 'openProfile', userId: string): void;
	(ev: 'edit', activity: HatadyActivity): void;
	(ev: 'deleted'): void;
	(ev: 'openSession', sessionId: string, workId: string): void;
	(ev: 'menu', activity: HatadyActivity, event: MouseEvent): void;
}>();

const styles = useCssModule();
const deleting = ref(false);
const popup = useHataGoesPopup();

async function deleteRecord(): Promise<void> {
	if (deleting.value) return;
	deleting.value = true;
	try {
		if (await confirmHatadyRecordDeletion(props.activity, props.variant, popup)) emit('deleted');
	} finally { deleting.value = false; }
}

const homeCopy = i18n.ts._hata._hatady._home;
const activityCopy = i18n.ts._hata._hatady._activityCard;
const homeLabels = homeCopy as unknown as Record<string, string>;
const mediaCopy = hatadyMediaCopy();
const timeFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: '2-digit', day: '2-digit' });
const activity = computed(() => props.activity);
const raw = computed<any>(() => activity.value);
const study = computed<any>(() => activity.value.study ?? null);
const media = computed(() => activity.value.media ?? null);
const kindIcon = computed(() =>
	activity.value.type === 'cooking'
		? 'ti-tools-kitchen-2'
		: activity.value.type === 'exercise'
			? 'ti-run'
			: activity.value.type === 'work'
				? 'ti-briefcase'
				: activity.value.type === 'study'
					? 'ti-book'
					: activity.value.type === 'movie_viewing'
						? 'ti-movie'
						: activity.value.type === 'game_match'
							? 'ti-swords'
							: activity.value.type === 'game_roguelike'
								? 'ti-route-square'
								: activity.value.type === 'game_pve'
									? 'ti-users'
									: 'ti-device-gamepad-2',
);
const kindLabel = computed(() =>
	activity.value.type === 'cooking'
		? i18n.ts._hata._hatady._activityKinds.cooking
		: activity.value.type === 'exercise'
			? i18n.ts._hata._hatady._activityKinds.exercise
			: activity.value.type === 'work'
				? i18n.ts._hata._hatady._activityKinds.work
				: activity.value.type === 'study'
					? homeCopy.activityStudy
					: String(mediaCopy.session.types[activity.value.type] ?? activity.value.type),
);
const whenLabel = computed(
	() =>
		timeFormatter.format(new Date(activity.value.occurredAt)) +
		(sourceRecord.value.startedAt ? ` ${sourceRecord.value.startedAt}` : ''),
);
const factRows = computed(() =>
	media.value
		? mediaSessionDisplayFacts(media.value.session)
			.slice(0, props.detailed ? undefined : 6)
			.map(({ key, value }) => ({ key, label: detailLabel(key), value: detailValue(key, value) }))
		: [],
);

function detailLabel(key: string): string {
	return String(mediaCopy.session?.[key] ?? key);
}

function formatWeaponStatRow(row: unknown): string {
	if (row == null || typeof row !== 'object' || Array.isArray(row)) return '';
	const entry = row as Record<string, unknown>;
	const weapon = typeof entry.weapon === 'string' ? entry.weapon.trim() : '';
	if (weapon.length === 0) return '';
	const stats = HATADY_STAT_FIELDS.filter((field) => typeof entry[field] === 'number')
		.map((field) => `${detailLabel(field)} ${entry[field]}`)
		.join(' · ');
	return stats.length > 0 ? `${weapon}（${stats}）` : weapon;
}

function detailValue(key: string, value: unknown): string {
	// 旗鯖fork(Hatady): 武器ごとの成績は行オブジェクトの配列。指標の組み合わせが記録ごとに変わるので、
	// 数字だけ並べても意味が取れない。ここで指標名を添えて1行の文にする。
	if (key === 'weaponStats' && Array.isArray(value)) return value
		.map((row) => formatWeaponStatRow(row))
		.filter(Boolean)
		.join(' / ');
	if (Array.isArray(value)) return value.map(String).join(' · ');
	if (typeof value === 'boolean') return value ? i18n.ts.yes : i18n.ts.no;
	const translations: Record<string, string> = {
		great: 'moodGreat',
		good: 'moodGood',
		neutral: 'moodNeutral',
		tired: 'moodTired',
		frustrated: 'moodFrustrated',
	};
	return String(mediaCopy.session?.[translations[String(value)] ?? String(value)] ?? value);
}

const sourceRecord = computed<any>(() => study.value || media.value?.session || raw.value);
const recordTags = computed<string[]>(() =>
	Array.isArray(sourceRecord.value.tags)
		? sourceRecord.value.tags
		: sourceRecord.value.tag
			? [sourceRecord.value.tag]
			: [],
);
const recordReactions = computed<Record<string, number>>(() => {
	const r = sourceRecord.value.reactions;
	return Array.isArray(r) ? Object.fromEntries(r.map((item) => [item.reaction, item.count])) : r || {};
});
const durationSeconds = computed<number | null>(() =>
	Object.hasOwn(sourceRecord.value, 'durationSeconds')
		? sourceRecord.value.durationSeconds
		: sourceRecord.value.durationMinutes == null
			? null
			: sourceRecord.value.durationMinutes * 60,
);

function tagLabel(tag: string) {
	return HATADY_RECORD_TAGS.find(item => item.value === tag)?.label || hyTagLabel(tag);
}

function tagIcon(tag: string) {
	return (
		(
			{
				strength: 'ti-star',
				weak: 'ti-flag',
				interest: 'ti-bulb',
				effort: 'ti-flame',
				recommend: 'ti-thumb-up',
				progress: 'ti-pencil',
				doneDay: 'ti-check',
				doneAll: 'ti-checks',
				blocked: 'ti-alert-circle',
				review: 'ti-eye',
			} as Record<string, string>
		)[tag] || 'ti-tag'
	);
}

function openRecord() {
	if (study.value) emit('openLog', study.value.id);
	else if (media.value?.session) emit('openSession', media.value.session.id, media.value.work?.id || '');
	else emit('openSession', sourceRecord.value.id, raw.value.workId || '');
}

const VisibilityChip = defineComponent({
	name: 'VisibilityChip',
	props: { visibility: { type: String as () => HatadyMediaVisibility, required: true } },
	setup(p) {
		return () =>
			h(
				'span',
				{
					class: styles.visibility,
					role: 'img',
					title:
						homeLabels[
							p.visibility === 'public'
								? 'activityPublic'
								: p.visibility === 'followers'
									? 'activityFollowers'
									: 'activityPrivate'
						],
					'aria-label':
						homeLabels[
							p.visibility === 'public'
								? 'activityPublic'
								: p.visibility === 'followers'
									? 'activityFollowers'
									: 'activityPrivate'
						],
				},
				[
					h('i', {
						class: `ti ${p.visibility === 'public' ? 'ti-world' : p.visibility === 'followers' ? 'ti-users' : 'ti-lock'}`,
					}),
				],
			);
	},
});

// 旗鯖fork(Hatady): UI S の Hatady では本文を MFM で描き、:name: をカスタム絵文字の画像
// （通常ノート本文と同じ 2em）で出す。Hatady 本体・UI の面は従来どおりプレーンテキストのまま。
// Mfm は HatadyConversation と同じくグローバル登録のものを使う（直接 import すると preferences まで連れてくる）。
const RecordText = defineComponent({
	name: 'RecordText',
	props: { text: { type: String, required: true } },
	setup(p) {
		return () => h('p', { class: styles.note }, props.variant === 'uis' ? [h(resolveComponent('Mfm'), { text: p.text })] : p.text);
	},
});

const ActivityLogDetail = defineComponent({
	props: { record: { type: Object, required: true } },
	setup(p) {
		return () => {
			const labels: Record<string, string> = {
				place: i18n.ts._hata._hatady._wizardComposer.place,
				nextStep: i18n.ts._hata._hatady._wizardComposer.nextStep,
				note: i18n.ts._hata._hatady._wizardComposer.note,
				startedAt: i18n.ts._hata._hatady._composer.startLabel,
				calories: activityCopy.calories,
				pages: i18n.ts._hata._hatady._bookWizard.pageRead,
				progress: activityCopy.progress,
			};
			const rows = Object.entries(p.record.details || {}).filter(
				([key, value]) => key !== 'spoiler' && value != null && value !== '',
			);
			if (p.record.pageStart != null) rows.unshift([i18n.ts._hata._hatady._bookDetail.page, `${p.record.pageStart} — ${p.record.pageEnd ?? p.record.pageStart}`]);
			return rows.length
				? h(
					'dl',
					{ class: styles.fullDetails },
					rows.flatMap(([key, value]) => [
						h('dt', labels[key] || key),
						h('dd', typeof value === 'object' ? JSON.stringify(value) : String(value)),
					]),
				)
				: null;
		};
	},
});
const ActivityMediaDetail = defineComponent({
	name: 'ActivityMediaDetail',
	props: {
		session: { type: Object as () => HatadyMediaSession, required: true },
		rows: { type: Array as () => Array<{ key: string; label: string; value: string }>, required: true },
	},
	setup(p) {
		return () =>
			h('div', { class: styles.mediaDetail }, [
				p.rows.length
					? h(
						'div',
						{ class: styles.facts },
						p.rows.map((row) => h('span', { key: row.key }, [h('b', row.label), ` ${row.value}`])),
					)
					: null,
				p.session.note ? h(RecordText, { text: p.session.note }) : null,
				p.session.files?.length ? h(MkMediaList, { mediaList: p.session.files }) : null,
			]);
	},
});
</script>

<style lang="scss" module>
.card {
	padding: 22px;
	border: 1px solid var(--hy-border);
	border-radius: 24px;
	background: var(--hy-surface);
	color: var(--hy-body);
	container-type: inline-size;
}
.card[data-hatady-variant='ui'] {
	--hy-surface: var(--MI_THEME-panel);
	--hy-ink: var(--MI_THEME-fg);
	--hy-body: var(--MI_THEME-fg);
	--hy-muted: color-mix(in srgb, var(--MI_THEME-fg) 65%, transparent);
	--hy-accent: var(--MI_THEME-accent);
	--hy-accent-ink: var(--MI_THEME-accent);
	--hy-border: var(--MI_THEME-divider);
	--hy-soft: var(--MI_THEME-accentedBg);
	--hy-surface-2: color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);
	border-radius: 12px;
}
.card[data-hatady-variant='uis'] {
	--hy-surface: color-mix(in srgb, var(--hk3-surface, var(--MI_THEME-panel)) 80%, transparent);
	--hy-ink: var(--hk3-text, var(--MI_THEME-fg));
	--hy-body: var(--hy-ink);
	--hy-muted: color-mix(in srgb, var(--hy-ink) 68%, transparent);
	--hy-accent: var(--hk3-accent, var(--MI_THEME-accent));
	--hy-accent-ink: var(--hy-accent);
	--hy-border: color-mix(in srgb, var(--hy-ink) 14%, transparent);
	--hy-soft: color-mix(in srgb, var(--hy-accent) 13%, transparent);
	--hy-surface-2: color-mix(in srgb, var(--hy-surface) 85%, transparent);
	border-radius: 18px;
	backdrop-filter: blur(14px);
	/* 旗鯖fork(Hatady): リアクションの絵文字は 12px の 1.3em（約16px）だと小さすぎたので、UI S のカードだけ大きくする。 */
	--hy-reaction-icon-size: 24px;
}
.head {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px 12px;
	margin-bottom: 16px;
}
.author {
	display: flex;
	align-items: center;
	gap: 10px;
	border: 0;
	background: none;
	text-align: left;
	color: inherit;
	min-width: 0;
	cursor: pointer;
}
.avatar {
	width: 32px;
	height: 32px;
	flex: none;
}
.author > span {
	overflow-wrap: anywhere;
}
.stamp {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--hy-muted);
	font-size: 12px;
}
.visibility {
	display: inline-grid;
	place-items: center;
}
.context {
	grid-column: 1/-1;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	font-size: 12px;
	padding-left: 44px;
	color: var(--hy-muted);
}
.tag {
	display: inline-flex;
	gap: 4px;
	align-items: center;
	padding: 4px 8px;
	border-radius: 999px;
	background: var(--hy-surface-2);
	color: var(--hy-ink);
}
.kindLead {
	display: flex;
	align-items: center;
	gap: 8px;
}
.titleButton {
	display: flex;
	gap: 9px;
	align-items: center;
	background: none;
	border: 0;
	color: var(--hy-ink);
	padding: 0;
	text-align: left;
	cursor: pointer;
}
.titleButton h3 {
	font: inherit;
	font-size: 18px;
	margin: 0;
	overflow-wrap: anywhere;
}
.note {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	font-size: 14px;
	line-height: 1.75;
	margin: 12px 0;
}
.meta {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
	font-size: 12px;
	color: var(--hy-muted);
	margin: 14px 0;
}
.card[data-hatady-variant='ui'] .meta {
	background: none;
}
.meta > span {
	display: flex;
	align-items: center;
	gap: 5px;
}
.workLink {
	border: 0;
	background: none;
	color: var(--hy-accent-ink);
	padding: 8px 0;
	cursor: pointer;
}
.foot {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	margin-top: 12px;
}
.actions {
	display: flex;
	gap: 5px;
	align-items: center;
	margin-left: auto;
}
.actions button {
	gap: 6px;
}
.facts {
	display: flex;
	gap: 6px 12px;
	flex-wrap: wrap;
	font-size: 12px;
	color: var(--hy-muted);
}
.spoiler {
	margin-top: 12px;
}
.spoiler summary {
	min-height: 44px;
	display: flex;
	gap: 8px;
	align-items: center;
	cursor: pointer;
}
.mediaDetail {
	min-width: 0;
}
.study,
.media {
	min-width: 0;
}
@container (max-width:430px) {
	.card {
		padding: 16px;
	}
	.stamp {
		font-size: 11px;
	}
	.context {
		padding-left: 0;
	}
	.titleButton h3 {
		font-size: 16px;
	}
}
.fullDetails {
	display: grid;
	grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr);
	gap: 8px;
	font-size: 12px;
}
.fullDetails dt {
	color: var(--hy-muted);
}
.fullDetails dd {
	margin: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
</style>
