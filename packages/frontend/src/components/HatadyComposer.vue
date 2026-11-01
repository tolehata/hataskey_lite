<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HatadyFormWizard ref="wizard" v-model="values" :title="isEdit ? copy.editRecord : copy.todayRecord" :label="type.label" :icon="type.icon" :pages="pages" :draftId="draftId" :embedded="embedded" :variant="variant" :restore="restoreDraft" :save="save" :saveLabel="isEdit ? copy.saveChanges : copy.saveRecord" @done="emit('done', $event)" @closed="emit('closed')" @back="emit('back')"/>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import type { HatadyMediaWork } from '@/utility/hatady-media.js';
import HatadyFormWizard from '@/components/HatadyFormWizard.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { refreshHataskFlowerStateAfterUpdate, hataskDropRewardMessage } from '@/utility/hatask-flower-v2.js';
import { enqueuePageStatusToast } from '@/utility/hataskey-notification-toast.js';
import { HATADY_ACTIVITY_CHOICES, HATADY_RECORD_TAGS, hatadySeconds } from '@/utility/hatady-ui.js';
import { formField as f, formTimestamp, localDateTime, optionalPages, recordAttachmentPatch, restoreLegacyTime } from '@/utility/hatady-form.js';
import { hySubjects, loadHySubjects, saveHySubject } from '@/utility/hatady-subjects.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();
const copy = i18n.ts._hata._hatady._wizardComposer;
const props = withDefaults(defineProps<{ editLog?: any; kind?: 'study' | 'exercise' | 'work'; work?: HatadyMediaWork | null; initialBookId?: string; embedded?: boolean; variant?: HatadySurfaceVariant }>(), { embedded: false, work: null, variant: 'hatady' });
const emit = defineEmits<{ (event: 'done', value: any): void; (event: 'closed'): void; (event: 'back'): void }>();
const wizard = useTemplateRef('wizard'), source = props.editLog, isEdit = source != null, kind = props.kind ?? source?.kind ?? 'study';
const type = HATADY_ACTIVITY_CHOICES.find(choice => choice.value === kind) ?? HATADY_ACTIVITY_CHOICES[0];
const draftId = isEdit ? `hatady:log:edit:${source.id}` : kind === 'study' ? (props.initialBookId ? `hatady:log:create:book:${props.initialBookId}` : 'hatady:log:create') : `hatady:log:${kind}:create`;
const books = ref<any[]>([]), works = ref<HatadyMediaWork[]>([]);
const values = ref<HatadyFormValues>({
	title: source?.title ?? props.work?.title ?? '', subject: source?.subject ?? props.work?.details?.genre ?? '', bookId: source?.bookId ?? source?.book?.id ?? props.initialBookId ?? '', selectedBook: source?.book ?? null,
	mediaWorkId: source?.mediaWorkId ?? props.work?.id ?? '', pageFrom: source?.pageFrom ?? '', pageTo: source?.pageTo ?? '',
	durationSeconds: source ? hatadySeconds(source) : null, date: localDateTime(source?.studiedAt).slice(0, 10), startedAt: source && Object.hasOwn(source, 'startedAt') ? source.startedAt ?? '' : source?.studiedAt ? localDateTime(source.studiedAt).slice(11) : '',
	files: [...(source?.files ?? [])],
	body: source?.body ?? '', tags: Array.isArray(source?.tags) ? [...source.tags] : source?.tag ? [source.tag] : [], visibility: source?.visibility ?? (source?.isPublic === false ? 'private' : 'public'),
	calories: source?.details?.calories ?? '', place: source?.details?.place ?? '', nextStep: source?.details?.nextStep ?? '', note: source?.details?.note ?? '', pages: source?.details?.pages ?? '', spoiler: source?.details?.spoiler ?? false,
});
const subjects = computed(() => [...new Set([values.value.subject, ...hySubjects.value.map(item => item.name), 'プログラミング', '数学', '英語', '読書', '歴史'])].filter(Boolean));
const pages = computed<HatadyFormPage[]>(() => [
	{ id: 'basics', title: kind === 'exercise' ? copy.exerciseQuestion : kind === 'work' ? copy.workQuestion : kind === 'cooking' ? copy.cookingQuestion : copy.studyQuestion, fields: [
		...(kind === 'work' ? [f('mediaWorkId', copy.work, { type: 'select', options: [{ value: '', label: copy.chooseWork }, ...works.value.map(work => ({ value: work.id, label: work.title }))], action: { label: copy.addWork, run: addWork } })] : []),
		f('title', kind === 'exercise' ? copy.exerciseType : kind === 'work' ? copy.workToday : kind === 'cooking' ? copy.cookedDish : copy.studiedOrRead, { required: true, maxlength: 512, placeholder: kind === 'exercise' ? copy.exerciseExample : kind === 'work' ? copy.workExample : copy.studyExample }),
		...(kind !== 'exercise' ? [f('subject', kind === 'cooking' ? copy.category : i18n.ts._hata._hatady._composer.subjectLabel, { required: kind === 'study', maxlength: 128, suggestions: subjects.value, action: kind === 'study' ? { label: copy.manageSubjects, run: manageSubjects } : undefined })] : []),
	] },
	...(kind === 'study' ? [{ id: 'book', title: copy.bookQuestion, fields: [f('bookId', i18n.ts._hata._hatady._composer.bookLabel, { type: 'select', options: [{ value: '', label: copy.noBook }, ...books.value.map(book => ({ value: book.id, label: book.title }))], action: { label: copy.addBook, run: addBook } }), f('pageFrom', copy.pageFrom, { type: 'number', min: 0, max: 100000, when: data => !!data.bookId }), f('pageTo', copy.pageTo, { type: 'number', min: 0, max: 100000, when: data => !!data.bookId })] }] : []),
	{ id: 'body', title: copy.bodyQuestion, fields: [f('body', copy.body, { type: 'textarea', maxlength: 4096, placeholder: copy.bodyPlaceholder }), f('files', copy.images, { type: 'images', maxItems: 16 }), f('spoiler', i18n.ts._hata._hatady._media.form.containsSpoiler, { type: 'checkbox' })] },
	{ id: 'time', title: copy.timeQuestion, fields: [f('durationSeconds', kind === 'exercise' ? copy.exerciseTime : kind === 'work' ? copy.workTime : copy.activityTime, { type: 'duration', min: 0, step: 1, presets: kind === 'exercise' ? [5, 15, 30, 60] : [15, 30, 60, 120] }), f('startedAt', i18n.ts._hata._hatady._composer.startLabel, { type: 'time', step: '0.001' }), ...(kind === 'exercise' ? [f('calories', copy.calories, { type: 'number', min: 0, max: 1000000, step: 1 })] : [])] },
	...(kind === 'work' ? [{ id: 'progress', title: copy.progressQuestion, fields: [f('tags', copy.workStatus, { type: 'tags', options: HATADY_RECORD_TAGS.filter(tag => ['progress', 'smooth', 'blocked', 'review', 'doneDay', 'doneAll'].includes(tag.value)) }), f('nextStep', copy.nextStep, { maxlength: 240 })] }] : []),
	{ id: 'tags', title: copy.tagsQuestion, fields: [f('tags', copy.tags, { type: 'tags', options: HATADY_RECORD_TAGS.filter(tag => ['strength', 'weak', 'interest', 'effort', 'recommend', ...(kind === 'study' ? ['movie', 'game'] : [])].includes(tag.value)) })] },
	{ id: 'details', title: copy.detailsQuestion, choices: true, fields: [] },
	...optionalPages('context', copy.context, [f('place', copy.place, { maxlength: 120 }), ...(kind === 'study' ? [f('pages', copy.pagesNote, { maxlength: 60 })] : []), f('note', copy.note, { type: 'textarea', maxlength: 8192 })], 'ti ti-map-pin'),
	{ id: 'sharing', title: copy.sharingQuestion, fields: [f('date', copy.recordDate, { type: 'date', required: true }), f('visibility', copy.visibility, { type: 'visibility' })], description: copy.privateHint },
	{ id: 'review', title: copy.reviewQuestion, summary: true, fields: [] },
]);

function restoreDraft(draft: HatadyFormValues) {
	const restored = restoreLegacyTime(draft);
	if (!Object.hasOwn(restored, 'bookId') && Object.hasOwn(restored, 'selectedBook')) restored.bookId = restored.selectedBook?.id ?? '';
	return restored;
}

watch(() => values.value.bookId, (id, previous) => { const book = books.value.find(item => item.id === id); if (book) values.value.selectedBook = book; if (id !== previous && book && values.value.pageFrom === '') values.value.pageFrom = book.currentPage ?? ''; });
watch(() => values.value.mediaWorkId, id => { const work = works.value.find(item => item.id === id); if (work && !values.value.title) values.value.title = work.title; });
onMounted(async () => {
	if (kind === 'study') {
		loadHySubjects().catch(() => {});
		books.value = await (misskeyApi as any)('hata/hatady/books', { limit: 100 }).catch(() => []);
		if (props.initialBookId && !books.value.some(book => book.id === props.initialBookId)) {
			const shown = await misskeyApi('hata/hatady/books/show', { bookId: props.initialBookId }).catch(() => null);
			if (shown?.book) books.value.unshift(shown.book);
		}
		if (source?.book && !books.value.some(book => book.id === source.book.id)) books.value.unshift(source.book);
		if (values.value.selectedBook?.id && !books.value.some(book => book.id === values.value.selectedBook.id)) books.value.unshift(values.value.selectedBook);
	}
	if (kind === 'work') {
		const response = await (misskeyApi as any)('hata/hatady/media/works/list', { kind: 'work', limit: 100 }).catch(() => []);
		works.value = Array.isArray(response) ? response : response.items ?? [];
		if (props.work && !works.value.some(work => work.id === props.work!.id)) works.value.unshift(props.work);
	}
});

async function manageSubjects() { const { dispose } = popup((await import('@/components/HatadySubjectManager.vue')).default, {}, { changed: () => loadHySubjects().catch(() => {}), closed: () => dispose() }); }

async function addBook() { const { dispose } = popup((await import('@/components/HatadyBookForm.vue')).default, { variant: props.variant }, { done: (book: any) => { books.value.unshift(book); values.value.selectedBook = book; values.value.bookId = book.id; }, closed: () => dispose() }); }

async function addWork() { const { dispose } = popup((await import('@/components/HatadyMediaWorkForm.vue')).default, { kind: 'work', variant: props.variant }, { done: (work: HatadyMediaWork) => { works.value.unshift(work); values.value.mediaWorkId = work.id; if (!values.value.title) values.value.title = work.title; }, closed: () => dispose() }); }

async function save(data: HatadyFormValues) {
	const tags = [...new Set<string>(data.tags)], legacyTag = tags.find(tag => ['strength', 'weak', 'interest', 'movie', 'game'].includes(tag)) ?? null;
	// 料理は Hatask のレシピから作られる種類なので、編集では kind を送らずサーバー側の値を保つ。
	const payload = {
		...recordAttachmentPatch(data.files, source),
		...(isEdit ? { logId: source.id } : {}), ...(kind === 'cooking' ? {} : { kind }), title: data.title.trim(), subject: (kind === 'exercise' ? source?.subject || '運動' : data.subject).trim() || '作業',
		tags, tag: legacyTag, body: data.body.trim() || null, visibility: data.visibility, durationSeconds: data.durationSeconds, startedAt: data.startedAt || null,
		studiedAt: formTimestamp(data.date, source?.studiedAt), bookId: kind === 'study' && data.bookId ? data.bookId : null, mediaWorkId: kind === 'work' && data.mediaWorkId ? data.mediaWorkId : null,
		pageFrom: data.bookId && data.pageFrom !== '' && data.pageFrom != null ? Number(data.pageFrom) : null, pageTo: data.bookId && data.pageTo !== '' && data.pageTo != null ? Number(data.pageTo) : null,
		details: { ...source?.details, place: data.place, note: data.note, spoiler: data.spoiler, ...(kind === 'exercise' ? { calories: data.calories === '' || data.calories == null ? null : Number(data.calories) } : kind === 'work' ? { nextStep: data.nextStep } : { pages: data.pages }) },
	};
	const result = await (misskeyApi as any)(isEdit ? 'hata/hatady/logs/update' : 'hata/hatady/logs/create', payload);
	if (!isEdit && result.flowerReward) {
		enqueuePageStatusToast(hataskDropRewardMessage(result.flowerReward), result.flowerReward.granted ? 'ti ti-droplet-filled' : 'ti ti-hourglass');
		void refreshHataskFlowerStateAfterUpdate().catch(() => {});
	}
	if (kind === 'study') saveHySubject(data.subject.trim()).catch(() => {});
	return result;
}

defineExpose({ requestClose: () => wizard.value?.requestClose() });
</script>
