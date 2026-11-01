<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HatadyFormWizard ref="wizard" v-model="values" :title="isEdit ? copy.editBook : copy.addBook" :label="i18n.ts._hata._hatady._composer.bookLabel" icon="ti ti-book" :pages="pages" :draftId="`hatady:book:${isEdit ? `edit:${source.id}` : 'create'}`" :embedded="embedded" :variant="variant" :restore="restoreDraft" :save="save" :saveLabel="isEdit ? composerCopy.saveChanges : copy.addToCollection" @done="emit('done', $event)" @closed="emit('closed')" @back="emit('back')"/>
</template>
<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import HatadyFormWizard from '@/components/HatadyFormWizard.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { HatadyFormPartialError, formField as f, formTimestamp, localDateTime, optionalPages, saveBookNotes } from '@/utility/hatady-form.js';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._bookWizard;
const composerCopy = i18n.ts._hata._hatady._wizardComposer;
const props = withDefaults(defineProps<{ editBook?: any; embedded?: boolean; variant?: HatadySurfaceVariant }>(), { embedded: false, variant: 'hatady' });
const emit = defineEmits<{ (event: 'done', value: any): void; (event: 'closed'): void; (event: 'back'): void }>();
const wizard = useTemplateRef('wizard'), source = props.editBook, isEdit = source != null;
const api = misskeyApi as unknown as (endpoint: string, payload: Record<string, unknown>) => Promise<any>;
const clone = (value: any) => JSON.parse(JSON.stringify(value));
let notesReady = !isEdit || Array.isArray(source?.bookmarks) && Array.isArray(source?.memos), draftHasNotes = false;
const values = ref<HatadyFormValues>({
	title: source?.title ?? '', author: source?.author ?? '', genre: source?.details?.genre ?? '', totalPages: source?.totalPages ?? '', currentPage: source?.currentPage ?? 0,
	status: source?.status ?? 'want', colorIndex: source?.coverColorIndex ?? null, isFavorite: source?.isFavorite ?? false, isRecommended: source?.isRecommended ?? false,
	visibility: source?.visibility ?? (isEdit ? 'public' : 'private'), description: source?.details?.description ?? '', memo: source?.details?.memo ?? '', finishedAt: source?.finishedAt ? localDateTime(source.finishedAt).slice(0, 10) : source?.status === 'finished' && source.finishedAt === null ? '' : undefined,
	bookmarks: clone(source?.bookmarks ?? []), memos: clone(source?.memos ?? []), _bookmarksBaseline: clone(source?.bookmarks ?? []), _memosBaseline: clone(source?.memos ?? []),
});
const pages: HatadyFormPage[] = [
	{ id: 'basics', title: copy.intro, fields: [f('title', copy.bookTitle, { required: true, maxlength: 512, placeholder: copy.titleExample }), f('genre', copy.genre, { maxlength: 64 }), f('author', i18n.ts._hata._hatady._bookForm.authorLabel, { maxlength: 256 })] },
	{ id: 'status', title: copy.statusQuestion, fields: [f('status', copy.currentStatus, { type: 'choice', options: [{ value: 'want', label: i18n.ts._hata._hatady._bookForm.status_want, icon: 'ti ti-bookmark' }, { value: 'reading', label: i18n.ts._hata._hatady._bookForm.status_reading, icon: 'ti ti-book' }, { value: 'finished', label: i18n.ts._hata._hatady._bookForm.status_finished, icon: 'ti ti-check' }, { value: 'tsundoku', label: i18n.ts._hata._hatady._bookForm.status_tsundoku, icon: 'ti ti-books' }] }), f('isFavorite', i18n.ts._hata._hatady._bookDetail.favorite, { type: 'checkbox' }), f('isRecommended', i18n.ts._hata._hatady._bookDetail.recommend, { type: 'checkbox' })] },
	{ id: 'details', title: copy.detailsQuestion, choices: true, fields: [] },
	...optionalPages('progress', copy.readingProgress, [f('currentPage', copy.pageRead, { type: 'number', min: 0, max: 100000 }), f('totalPages', i18n.ts._hata._hatady._bookForm.pagesLabel, { type: 'number', min: 1, max: 100000 }), f('finishedAt', copy.finishedDate, { type: 'date' })], 'ti ti-book'),
	...optionalPages('bookmarks', i18n.ts._hata._hatady._bookDetail.bookmarks, [f('bookmarks', i18n.ts._hata._hatady._bookDetail.bookmarks, { type: 'bookmarks' })], 'ti ti-bookmark'),
	...optionalPages('memos', copy.pageMemos, [f('memos', copy.pageMemos, { type: 'memos' })], 'ti ti-pencil'),
	...optionalPages('description', copy.introduction, [f('description', copy.description, { type: 'textarea', maxlength: 8192 })]),
	...optionalPages('memo', copy.privateMemo, [f('memo', copy.privateMemo, { type: 'textarea', maxlength: 8192 })], 'ti ti-lock'),
	...optionalPages('cover', i18n.ts._hata._hatady._bookDetail.coverColor, [f('colorIndex', i18n.ts._hata._hatady._bookDetail.coverColor, { type: 'color' })], 'ti ti-palette'),
	{ id: 'sharing', title: copy.sharingQuestion, summary: true, fields: [f('visibility', copy.bookVisibility, { type: 'visibility' })] },
];

function restoreDraft(draft: HatadyFormValues) {
	draftHasNotes = Array.isArray(draft.bookmarks) || Array.isArray(draft.memos);
	if (draft.savedBookId) notesReady = true;
	return { ...draft, colorIndex: Object.hasOwn(draft, 'colorIndex') ? draft.colorIndex : Object.hasOwn(draft, 'coverColorIndex') ? draft.coverColorIndex : values.value.colorIndex };
}

onMounted(async () => {
	if (notesReady) return;
	try {
		const response = await api('hata/hatady/books/show', { bookId: source.id });
		const untouched = !wizard.value?.hasChanges();
		if (!draftHasNotes) { values.value.bookmarks = clone(response.bookmarks ?? []); values.value.memos = clone(response.memos ?? []); }
		if (!draftHasNotes || !values.value._bookmarksBaseline?.length) values.value._bookmarksBaseline = clone(response.bookmarks ?? []);
		if (!draftHasNotes || !values.value._memosBaseline?.length) values.value._memosBaseline = clone(response.memos ?? []);
		notesReady = true;
		await nextTick(); if (untouched && !wizard.value?.restored) wizard.value?.resetBaseline();
	} catch { /* Saving remains guarded; unread notes can never become an empty replacement. */ }
});

async function save(data: HatadyFormValues) {
	if (!notesReady) throw new HatadyFormPartialError(copy.notesLoadFailed);
	const bookId = data.savedBookId || source?.id;
	const payload = {
		title: data.title.trim(), author: data.author.trim() || null, totalPages: data.totalPages === '' || data.totalPages == null ? null : Number(data.totalPages), currentPage: Number(data.currentPage) || 0,
		status: data.status, coverColorIndex: data.colorIndex, isFavorite: data.isFavorite, isRecommended: data.isRecommended, visibility: data.visibility,
		...(data.finishedAt === undefined ? {} : { finishedAt: data.finishedAt ? formTimestamp(data.finishedAt, source?.finishedAt) : null }),
		details: { ...source?.details, genre: data.genre, description: data.description, memo: data.memo },
	};
	const book = await api(bookId ? 'hata/hatady/books/update' : 'hata/hatady/books/create', { ...payload, ...(bookId ? { bookId } : {}) });
	data.savedBookId = book.id;
	try { await saveBookNotes(data, book.id, api); } catch { throw new HatadyFormPartialError(copy.notesSaveFailed); }
	return { ...book, bookmarks: data.bookmarks, memos: data.memos };
}

defineExpose({ requestClose: () => wizard.value?.requestClose() });
</script>
