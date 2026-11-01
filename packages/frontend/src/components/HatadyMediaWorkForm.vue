<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HatadyFormWizard ref="wizard" v-model="values" :title="isEdit ? i18n.tsx._hata._hatady._workWizard.editTitle({ type: typeLabel }) : i18n.tsx._hata._hatady._workWizard.addTitle({ type: typeLabel })" :label="typeLabel" :icon="icon" :pages="pages" :draftId="`hatady:media-work:${kind}:${isEdit ? `edit:${source!.id}` : 'create'}`" :embedded="embedded" :variant="variant" :save="save" :saveLabel="isEdit ? i18n.ts._hata._hatady._wizardComposer.saveChanges : i18n.ts._hata._hatady._bookWizard.addToCollection" @done="emit('done', $event)" @closed="emit('closed')" @back="emit('back')"/>
</template>
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import type { HatadyMediaKind, HatadyMediaWork } from '@/utility/hatady-media.js';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import HatadyFormWizard from '@/components/HatadyFormWizard.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { hatadyMediaCopy, mediaStatusCopyKey, mediaStatusOptions, normalizeMediaList } from '@/utility/hatady-media.js';
import { formField as f, optionalPages } from '@/utility/hatady-form.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
const wizardCopy = i18n.ts._hata._hatady._workWizard;
const bookCopy = i18n.ts._hata._hatady._bookWizard;
const mediaCopy = i18n.ts._hata._hatady._media;
const props = withDefaults(defineProps<{ kind: HatadyMediaKind; editWork?: HatadyMediaWork | null; embedded?: boolean; variant?: HatadySurfaceVariant }>(), { editWork: null, embedded: false, variant: 'hatady' });
const emit = defineEmits<{ (event: 'done', value: HatadyMediaWork): void; (event: 'closed'): void; (event: 'back'): void }>();
const wizard = useTemplateRef('wizard'), source = props.editWork, kind = props.kind, isEdit = source != null;
const typeLabel = kind === 'movie' ? i18n.ts._hata._hatady._profile.movie : kind === 'game' ? i18n.ts._hata._hatady._profile.game : i18n.ts._hata._hatady._activityKinds.work, icon = kind === 'movie' ? 'ti ti-movie' : kind === 'game' ? 'ti ti-device-gamepad-2' : 'ti ti-briefcase';
const copy = hatadyMediaCopy();
const values = ref<HatadyFormValues>({
	title: source?.title ?? '', creator: source?.creator ?? '', genre: source?.details?.genre ?? '', description: source?.details?.description ?? '', memo: source?.details?.memo ?? '', nextStep: source?.details?.nextStep ?? '',
	status: source?.status ?? (kind === 'work' ? 'in_progress' : 'planned'), visibility: source?.visibility ?? 'private', coverColorIndex: source?.coverColorIndex ?? null, isFavorite: source?.isFavorite ?? false, isRecommended: source?.isRecommended ?? false,
	originalTitle: source?.originalTitle ?? '', releaseDate: String(source?.releaseDate ?? '').slice(0, 10), releaseYear: source?.releaseYear ?? '', officialUrl: source?.officialUrl ?? '',
	genres: normalizeMediaList(source?.genres), origin: source?.origin ?? '', viewingMode: source?.viewingMode ?? '', primaryLanguage: source?.primaryLanguage ?? '', runtimeMinutes: source?.runtimeMinutes ?? '',
	recommendationRating: source?.recommendationRating == null ? '' : Number(source.recommendationRating) / 2,
	platforms: normalizeMediaList(source?.platforms), developer: source?.developer ?? '', publisher: source?.publisher ?? '', synopsis: source?.synopsis ?? '', synopsisSpoiler: source?.synopsisSpoiler ?? false,
	highlights: normalizeMediaList(source?.highlights), highlightsSpoiler: source?.highlightsSpoiler ?? false, review: source?.review ?? '', reviewSpoiler: source?.reviewSpoiler ?? false,
});
const select = (key: string, label: string, options: Array<[string, string]>) => f(key, label, { type: 'select', options: [{ value: '', label: wizardCopy.unset }, ...options.map(([value, text]) => ({ value, label: text }))] });
const pages: HatadyFormPage[] = [
	{ id: 'basics', title: kind === 'work' ? wizardCopy.workIntro : bookCopy.intro, fields: [f('title', kind === 'work' ? wizardCopy.workName : i18n.tsx._hata._hatady._workWizard.typeTitle({ type: typeLabel }), { required: true, maxlength: 512, placeholder: kind === 'work' ? wizardCopy.workExample : kind === 'movie' ? wizardCopy.movieExample : wizardCopy.gameExample }), kind === 'movie' ? f('genres', bookCopy.genre, { type: 'list', maxlength: 128, maxItems: 30 }) : f('genre', kind === 'work' ? i18n.ts._hata._hatady._composer.subjectLabel : bookCopy.genre, { maxlength: 64 }), ...(kind !== 'work' ? [f('creator', kind === 'movie' ? mediaCopy.form.director : wizardCopy.creator, { maxlength: 256 })] : [])] },
	{ id: 'status', title: wizardCopy.statusQuestion, fields: [f('status', mediaCopy.statusLabel, { type: 'choice', options: mediaStatusOptions(kind).map(value => ({ value, label: kind === 'work' ? ({ in_progress: wizardCopy.inProgress, completed: wizardCopy.completed, on_hold: wizardCopy.onHold } as Record<string, string>)[value] ?? value : String(copy.status?.[mediaStatusCopyKey(kind, value)] ?? value), icon: value === 'completed' || value === 'mastered' ? 'ti ti-check' : value === 'in_progress' ? 'ti ti-player-play' : 'ti ti-bookmark' })) }), f('isFavorite', mediaCopy.form.favorite, { type: 'checkbox' }), f('isRecommended', i18n.ts._hata._hatady._bookDetail.recommend, { type: 'checkbox' })] },
	{ id: 'details', title: bookCopy.detailsQuestion, choices: true, fields: [] },
	...(kind !== 'work' ? optionalPages('release', wizardCopy.basicInfo, [f('originalTitle', wizardCopy.originalTitle, { maxlength: 512 }), f('releaseDate', mediaCopy.form.releaseDate, { type: 'date' }), f('releaseYear', mediaCopy.form.releaseYear, { type: 'number', min: 1800, max: 3000 }), f('officialUrl', wizardCopy.officialSite, { type: 'url', maxlength: 2048 })], 'ti ti-calendar') : optionalPages('next', wizardCopy.nextStepTitle, [f('nextStep', i18n.ts._hata._hatady._wizardComposer.nextStep, { maxlength: 240 })], 'ti ti-arrow-right')),
	...(kind === 'movie' ? optionalPages('viewing', wizardCopy.productionLanguage, [select('origin', wizardCopy.productionRegion, [['domestic', wizardCopy.domestic], ['foreign', wizardCopy.foreign], ['co_production', wizardCopy.coProduction], ['other', mediaCopy.form.otherOrigin]]), select('viewingMode', wizardCopy.subtitlesDubbing, [['original', wizardCopy.originalAudio], ['subtitled', mediaCopy.form.subtitled], ['dubbed', wizardCopy.dubbed]]), f('primaryLanguage', wizardCopy.language, { maxlength: 64 }), f('runtimeMinutes', wizardCopy.runtimeMinutes, { type: 'number', min: 1, max: 100000 })], 'ti ti-movie') : kind === 'game' ? optionalPages('platforms', wizardCopy.platformInfo, [f('platforms', wizardCopy.platforms, { type: 'list', maxlength: 128, maxItems: 30 }), f('developer', mediaCopy.form.developer, { maxlength: 256 }), f('publisher', mediaCopy.form.publisher, { maxlength: 256 })], 'ti ti-device-gamepad-2') : []),
	...(kind !== 'work' ? optionalPages('synopsis', mediaCopy.form.summary, [f('synopsis', mediaCopy.form.summary, { type: 'textarea', maxlength: 8192 }), f('synopsisSpoiler', wizardCopy.summarySpoiler, { type: 'checkbox' })]) : []),
	...(kind === 'movie' ? optionalPages('highlights', mediaCopy.form.highlights, [f('highlights', mediaCopy.form.highlights, { type: 'list', maxlength: 512, maxItems: 50 }), f('highlightsSpoiler', wizardCopy.highlightsSpoiler, { type: 'checkbox' })], 'ti ti-sparkles') : []),
	...(kind !== 'work' ? optionalPages('review', mediaCopy.form.review, [f('review', mediaCopy.form.review, { type: 'textarea', maxlength: 8192 }), f('reviewSpoiler', wizardCopy.reviewSpoiler, { type: 'checkbox' }), ...(kind === 'movie' ? [f('recommendationRating', wizardCopy.recommendationRating, { type: 'number', min: 0, max: 5, step: 0.5 })] : [])], 'ti ti-star') : []),
	...optionalPages('description', kind === 'work' ? wizardCopy.workGoal : bookCopy.introduction, [f('description', bookCopy.description, { type: 'textarea', maxlength: 8192 })]),
	...optionalPages('memo', bookCopy.privateMemo, [f('memo', bookCopy.privateMemo, { type: 'textarea', maxlength: 8192 })], 'ti ti-lock'),
	...(kind !== 'work' ? optionalPages('cover', i18n.ts._hata._hatady._bookDetail.coverColor, [f('coverColorIndex', i18n.ts._hata._hatady._bookDetail.coverColor, { type: 'color' })], 'ti ti-palette') : []),
	{ id: 'sharing', title: bookCopy.sharingQuestion, summary: true, fields: [f('visibility', i18n.tsx._hata._hatady._workWizard.visibility({ type: typeLabel }), { type: 'visibility' })] },
];

async function save(data: HatadyFormValues) {
	const payload = {
		...(!isEdit ? { kind } : { workId: source!.id }), title: data.title.trim(), creator: String(data.creator).trim() || null, status: data.status, visibility: data.visibility,
		coverColorIndex: data.coverColorIndex, isFavorite: data.isFavorite, isRecommended: data.isRecommended,
		details: { ...source?.details, ...(kind !== 'movie' ? { genre: data.genre } : {}), description: data.description, memo: data.memo, ...(kind === 'work' ? { nextStep: data.nextStep } : {}) },
		...(kind !== 'work' ? { originalTitle: data.originalTitle.trim() || null, releaseDate: data.releaseDate || null, releaseYear: data.releaseYear === '' || data.releaseYear == null ? null : Number(data.releaseYear), officialUrl: data.officialUrl.trim() || null, synopsis: data.synopsis.trim() || null, synopsisSpoiler: data.synopsisSpoiler, review: data.review.trim() || null, reviewSpoiler: data.reviewSpoiler } : {}),
		...(kind === 'movie' ? { genres: normalizeMediaList(data.genres), origin: data.origin || null, viewingMode: data.viewingMode || null, primaryLanguage: data.primaryLanguage.trim() || null, runtimeMinutes: data.runtimeMinutes === '' || data.runtimeMinutes == null ? null : Number(data.runtimeMinutes), highlights: normalizeMediaList(data.highlights), highlightsSpoiler: data.highlightsSpoiler, recommendationRating: data.recommendationRating === '' || data.recommendationRating == null ? null : Math.round(Number(data.recommendationRating) * 2) } : kind === 'game' ? { platforms: normalizeMediaList(data.platforms), developer: data.developer.trim() || null, publisher: data.publisher.trim() || null } : {}),
	};
	return await (misskeyApi as any)(isEdit ? 'hata/hatady/media/works/update' : 'hata/hatady/media/works/create', payload);
}

defineExpose({ requestClose: () => wizard.value?.requestClose() });
</script>
