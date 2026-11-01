<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HatadyFormWizard ref="wizard" v-model="values" :title="isEdit ? composerCopy.editRecord : composerCopy.todayRecord" :label="workKind === 'movie' ? i18n.ts._hata._hatady._profile.movie : i18n.ts._hata._hatady._profile.game" :icon="workKind === 'movie' ? 'ti ti-movie' : 'ti ti-device-gamepad-2'" :summaryTitle="workTitle" :pages="pages" :draftId="draftId" :embedded="embedded" :variant="variant" :restore="restoreDraft" :save="save" :saveLabel="isEdit ? composerCopy.saveChanges : composerCopy.saveRecord" @done="emit('done', $event)" @closed="emit('closed')" @back="emit('back')"/>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { HatadyMediaWork, HatadyMediaSession, HatadyMediaSessionKind, HatadyMediaSuggestions } from '@/utility/hatady-media.js';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import HatadyFormWizard from '@/components/HatadyFormWizard.vue';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { refreshHataskFlowerStateAfterUpdate, hataskDropRewardMessage } from '@/utility/hatask-flower-v2.js';
import { enqueuePageStatusToast } from '@/utility/hataskey-notification-toast.js';
import { collectMediaSessionSuggestions, normalizeMediaSessions } from '@/utility/hatady-media.js';
import { HATADY_RECORD_TAGS, hatadySeconds } from '@/utility/hatady-ui.js';
import { formField as f, formTimestamp, localDateTime, recordAttachmentPatch, restoreLegacyTime } from '@/utility/hatady-form.js';
import { initialSessionDetails, sessionDetailPages, sessionDetailsPayload, SESSION_TYPE_OPTIONS } from '@/utility/hatady-session-form.js';
import { i18n } from '@/i18n.js';
const composerCopy = i18n.ts._hata._hatady._wizardComposer;
const sessionCopy = i18n.ts._hata._hatady._sessionWizard;
const props = withDefaults(defineProps<{ work: HatadyMediaWork | null; editSession?: HatadyMediaSession; embedded?: boolean; variant?: HatadySurfaceVariant }>(), { embedded: false, variant: 'hatady' });
const emit = defineEmits<{ (event: 'done', value: HatadyMediaSession): void; (event: 'closed'): void; (event: 'back'): void }>();
const wizard = useTemplateRef('wizard'), source = props.editSession, isEdit = source != null;
const workKind = props.work?.kind === 'movie' || source?.kind === 'movie_viewing' ? 'movie' : 'game';
const workTitle = props.work?.title ?? String(source?.workSnapshot?.title ?? sessionCopy.workRecord);
const draftId = isEdit ? `hatady:media-session:edit:${source.id}` : `hatady:media-session:create:${props.work?.id}`;
const values = ref<HatadyFormValues>({
	...initialSessionDetails(source), sessionKind: source?.kind ?? (workKind === 'movie' ? 'movie_viewing' : 'game_play'),
	date: localDateTime(source?.occurredAt).slice(0, 10), startedAt: source && Object.hasOwn(source, 'startedAt') ? source.startedAt ?? '' : source?.occurredAt ? localDateTime(source.occurredAt).slice(11) : '',
	durationSeconds: source ? hatadySeconds(source) : workKind === 'movie' && props.work?.runtimeMinutes != null ? props.work.runtimeMinutes * 60 : null,
	files: [...(source?.files ?? [])],
	note: source?.note ?? '', noteSpoiler: source?.noteSpoiler ?? false, tags: [...(source?.tags ?? [])], visibility: source?.visibility ?? 'private',
	viewingMode: source?.details?.viewingMode ?? props.work?.viewingMode ?? '', __results: {},
});
const suggestions = ref<HatadyMediaSuggestions>({});
const pages = computed<HatadyFormPage[]>(() => [
	...(workKind === 'game' ? [{ id: 'type', title: sessionCopy.playQuestion, description: workTitle, fields: [f('sessionKind', i18n.ts._hata._hatady._media.sessionType, { type: 'choice', required: true, disabled: isEdit, options: SESSION_TYPE_OPTIONS })] }] : []),
	{ id: 'note', title: composerCopy.bodyQuestion, description: workTitle, fields: [f('note', composerCopy.body, { type: 'textarea', maxlength: 8192, placeholder: composerCopy.bodyPlaceholder }), f('files', composerCopy.images, { type: 'images', maxItems: 16 }), f('noteSpoiler', i18n.ts._hata._hatady._media.form.containsSpoiler, { type: 'checkbox' })] },
	{ id: 'time', title: composerCopy.timeQuestion, fields: [f('durationSeconds', workKind === 'movie' ? sessionCopy.viewingTime : sessionCopy.playTime, { type: 'duration', min: 0, step: 1, presets: workKind === 'movie' ? [30, 60, 90, 120] : [15, 30, 60, 120] }), f('startedAt', i18n.ts._hata._hatady._composer.startLabel, { type: 'time', step: '0.001' })] },
	{ id: 'tags', title: composerCopy.tagsQuestion, fields: [f('tags', composerCopy.tags, { type: 'tags', options: HATADY_RECORD_TAGS.filter(tag => ['strength', 'weak', 'interest', 'effort', 'recommend'].includes(tag.value)) })] },
	{ id: 'details', title: composerCopy.detailsQuestion, choices: true, fields: [] },
	...sessionDetailPages(workKind, suggestions.value),
	{ id: 'sharing', title: composerCopy.sharingQuestion, fields: [f('date', composerCopy.recordDate, { type: 'date', required: true }), f('visibility', composerCopy.visibility, { type: 'visibility' })], description: composerCopy.privateHint },
	{ id: 'review', title: composerCopy.reviewQuestion, summary: true, fields: [] },
]);
let restoring = false;

function restoreDraft(stored: HatadyFormValues) { restoring = true; nextTick(() => { restoring = false; }); return { ...restoreLegacyTime(stored), __results: stored.__results ?? {} }; }

watch(() => values.value.sessionKind, (kind, previous) => { if (restoring) return; values.value.__results[previous] = values.value.result; values.value.result = values.value.__results[kind] ?? ''; });
onMounted(async () => { if (props.work?.id) suggestions.value = collectMediaSessionSuggestions(normalizeMediaSessions(await (misskeyApi as any)('hata/hatady/media/sessions/list', { workId: props.work.id, limit: 100 }).catch(() => []))); });

async function save(data: HatadyFormValues) {
	const kind: HatadyMediaSessionKind = source?.kind ?? data.sessionKind;
	const result = await (misskeyApi as any)(isEdit ? 'hata/hatady/media/sessions/update' : 'hata/hatady/media/sessions/create', {
		...(isEdit ? { sessionId: source.id } : { workId: props.work?.id, kind }),
		occurredAt: formTimestamp(data.date, source?.occurredAt), durationSeconds: data.durationSeconds, startedAt: data.startedAt || null,
		...recordAttachmentPatch(data.files, source),
		note: data.note.trim() || null, noteSpoiler: data.noteSpoiler, tags: [...new Set(data.tags)], visibility: data.visibility,
		details: sessionDetailsPayload(workKind, kind, data, source?.details ?? {}),
	});
	if (!isEdit && result.flowerReward) {
		enqueuePageStatusToast(hataskDropRewardMessage(result.flowerReward), result.flowerReward.granted ? 'ti ti-droplet-filled' : 'ti ti-hourglass');
		void refreshHataskFlowerStateAfterUpdate().catch(() => {});
	}
	return result;
}

defineExpose({ requestClose: () => wizard.value?.requestClose() });
</script>
