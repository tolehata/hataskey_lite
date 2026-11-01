<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog
	ref="dialog"
	:title="copy.title"
	:variant="variant"
	:inert="closePrompt"
	:busy="sending"
	@close="requestClose"
	@closed="onClosed"
>
	<p v-if="loading" class="hy-empty">{{ copy.loading }}</p>
	<p v-if="error && loading" class="hy-error" role="alert">{{ error }}</p>
	<template v-if="!loading && activity">
		<HatadyActivityCard
			:activity="activity"
			:variant="variant"
			:showActions="false"
			detailed
			@openLog="() => {}"
			@openMedia="openWork"
			@openBook="openWork"
			@openSession="() => {}"
			@openProfile="openProfile"
		/>
		<div :class="$style.recordActions">
			<HatadyReactions :target="reactionTarget" :reactions="rootReactions" :myReaction="record?.myReaction ?? null" :variant="variant"/>
			<span></span>
			<button
				v-if="activity.isMine"
				class="hy-icon-button"
				:aria-label="i18n.ts._hata._hatady._wizardComposer.editRecord"
				:title="i18n.ts._hata._hatady._wizardComposer.editRecord"
				@click="editRecord"
			>
				<i class="ti ti-pencil"></i>
			</button>
			<button v-if="activity.isMine" class="hy-icon-button" :aria-label="i18n.ts._hata._recordModeration.deleteRecord" :title="i18n.ts._hata._recordModeration.deleteRecord" :disabled="sending" @click="deleteRecord">
				<i class="ti ti-trash"></i>
			</button>
			<button v-else class="hy-icon-button" :aria-label="i18n.ts.reportAbuse" @click="reportRecord">
				<i class="ti ti-flag"></i>
			</button>
		</div>
		<div v-if="work || record?.book || record?.mediaWork" :class="$style.workLink">
			<button class="hy-secondary" @click="openWork">
				<i class="ti ti-books"></i>
				{{ conversationCopy.workDetails }}
			</button>
		</div>
		<section :class="$style.replies">
			<h3>
				<i class="ti ti-messages"></i>
				{{ copyx.repliesCount({ count: comments.length.toString() }) }}
			</h3>
			<p v-if="!comments.length" class="hy-empty">{{ copy.noReplies }}</p>
			<article v-for="c in comments" :key="c.id" :class="$style.reply" :data-nested="!!c.replyId">
				<MkAvatar v-if="c.user" :class="$style.avatar" :user="c.user"/>
				<div>
					<div :class="$style.replyHead">
						<MkUserName v-if="c.user" :user="c.user"/>
						<time>{{ fmtWhen(c.createdAt) }}</time>
					</div>
					<details v-if="c.spoiler">
						<summary>{{ conversationCopy.spoilerContent }}</summary>
						<Mfm :text="c.text"/>
					</details>
					<Mfm v-else :text="c.text"/>
					<div :class="$style.replyActions">
						<HatadyReactions
							:variant="variant"
							:target="sessionId ? { mediaCommentId: c.id } : { commentId: c.id }"
							:reactions="reactionMap(c.reactions)"
							:myReaction="c.myReaction ?? null"
						/>
						<button class="hy-icon-button" :aria-label="copy.reply" @click="setReplyTo(c)">
							<i class="ti ti-arrow-back-up"></i>
						</button>
						<button
							v-if="c.userId === $i?.id"
							class="hy-icon-button"
							:aria-label="i18n.ts.delete"
							@click="deleteComment(c)"
						>
							<i class="ti ti-trash"></i>
						</button>
						<button
							v-else-if="c.user"
							class="hy-icon-button"
							:aria-label="i18n.ts.reportAbuse"
							@click="reportComment(c)"
						>
							<i class="ti ti-flag"></i>
						</button>
					</div>
				</div>
			</article>
			<button v-if="hasMore" class="hy-secondary" :disabled="loadingMore" @click="loadComments(true)">
				{{ conversationCopy.showMore }}
			</button>
		</section>
	</template>
	<p v-else-if="!loading" class="hy-empty">{{ error || copy.notFound }}</p>
	<template v-if="record" #actions>
		<form :class="$style.composer" @submit.prevent="send">
			<div :class="$style.replying">
				<i class="ti ti-arrow-back-up"></i>
				<span v-if="replyTo">
					<MkUserName v-if="replyTo.user" :user="replyTo.user"/>
					<span v-else>{{ conversationCopy.selectedReply }}</span>
					{{ copy.replyingTo }}
				</span>
				<span v-else>{{ i18n.tsx._hata._hatady._conversationView.replyToRecord({ name: record.user?.name || record.user?.username || conversationCopy.thisRecord }) }}</span>
				<button v-if="replyTo" type="button" class="hy-icon-button" :aria-label="conversationCopy.clearReplyTarget" @click="replyTo = null">
					<i class="ti ti-x"></i>
				</button>
			</div>
			<div :class="$style.inputBox">
				<textarea
					ref="input"
					v-model="draft"
					:placeholder="copy.placeholder"
					maxlength="2048"
					rows="3"
					@keydown="onComposerKeydown"
				></textarea>
				<div :class="$style.inputTools">
					<button
						type="button"
						class="hy-icon-button"
						:aria-label="conversationCopy.insertEmoji"
						:title="conversationCopy.emoji"
						@click="insertEmoji"
					>
						<i class="ti ti-mood-plus"></i>
					</button>
					<button
						type="button"
						class="hy-icon-button"
						:aria-label="conversationCopy.preview"
						:title="conversationCopy.preview"
						:aria-pressed="preview"
						@click="preview = !preview"
					>
						<i class="ti ti-eye"></i>
					</button>
					<small>{{ draft.length }} / 2048</small>
				</div>
			</div>
			<div v-if="preview" :class="$style.preview"><Mfm :text="draft"/></div>
			<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
			<div :class="$style.sendRow">
				<button type="submit" class="hy-primary" :disabled="sending || !draft.trim() || draft.length > 2048">
					<i class="ti ti-send"></i>
					{{ copy.send }}
				</button>
			</div>
		</form>
	</template>
</HyDialog>
<HatadyDraftPrompt
	v-if="closePrompt"
	:variant="variant"
	:title="conversationCopy.draftQuestion"
	:error="error"
	@save="leave(true)"
	@discard="leave(false)"
	@return="cancelClose"
/>
</template>
<script setup lang="ts">
import { useHataGoesEmojiPickers } from '@/utility/hatagoes-emoji-pickers.js';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { isOwnHatadyProfile, openOwnHatadyProfileIfNeeded } from '@/utility/hatady-activity-actions.js';
import { computed, defineAsyncComponent, ref, onMounted, nextTick } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import { confirmHatadyAction, confirmHatadyRecordDeletion } from '@/utility/hatady-record-delete.js';
import HatadyReactions from '@/components/HatadyReactions.vue';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';

const popup = useHataGoesPopup();
const pickers = useHataGoesEmojiPickers();
const props = withDefaults(defineProps<{ logId?: string; initialLog?: any; sessionId?: string; workId?: string; variant?: HatadySurfaceVariant }>(), { variant: 'hatady' });
const emit = defineEmits<{ (e: 'changed'): void; (e: 'deleted', activity: HatadyActivity): void; (e: 'closed'): void }>();
const api = misskeyApi as unknown as (endpoint: string, payload: Record<string, unknown>) => Promise<any>;
const copy = i18n.ts._hata._hatady._conversation,
	copyx = i18n.tsx._hata._hatady._conversation;
const conversationCopy = i18n.ts._hata._hatady._conversationView;
const dialog = ref<any>(),
	input = ref<HTMLTextAreaElement>(),
	record = ref<any>(props.initialLog || null),
	work = ref<any>(null),
	comments = ref<any[]>([]),
	loading = ref(true),
	loadingMore = ref(false),
	hasMore = ref(false),
	draft = ref(''),
	replyTo = ref<any>(null),
	sending = ref(false),
	preview = ref(false),
	error = ref(''),
	closePrompt = ref(false);
let pendingLeave: (() => void) | null = null;
let closing = true;
let navigateToOwnProfile = false;

function cancelClose() {
	navigateToOwnProfile = false;
	closePrompt.value = false;
}

function onClosed() {
	emit('closed');
	if (navigateToOwnProfile) openOwnHatadyProfileIfNeeded(undefined, props.variant);
}

const drafts = useHataFormDraft({
	id: `hatady-reply:${props.sessionId ? 'session' : 'log'}:${props.sessionId || props.logId}`,
	autoSave: false,
	capture: () => ({ text: draft.value, replyId: replyTo.value?.id ?? null }),
	restore: (d: any) => {
		draft.value = typeof d?.text === 'string' ? d.text : '';
		if (d?.replyId) replyTo.value = { id: d.replyId };
	},
	isMeaningful: (d) => !!d.text.trim(),
});
const activity = computed<any>(() =>
	!record.value
		? null
		: {
			id: record.value.id,
			type: props.sessionId ? record.value.kind : record.value.kind || 'study',
			occurredAt: record.value.occurredAt || record.value.studiedAt,
			user: record.value.user || work.value?.user,
			visibility: record.value.visibility || (record.value.isPublic ? 'public' : 'private'),
			isMine: record.value.isMine || record.value.userId === $i?.id || work.value?.userId === $i?.id,
			...(props.sessionId ? { media: { work: work.value, session: record.value } } : { study: record.value }),
		},
);
const reactionTarget = computed(() => (props.sessionId ? { sessionId: props.sessionId } : { logId: props.logId }));

function reactionMap(r: any): Record<string, number> {
	return Array.isArray(r) ? Object.fromEntries(r.map((x) => [x.reaction, x.count])) : r || {};
}

const rootReactions = computed(() => reactionMap(record.value?.reactions));

function fmtWhen(value: string) {
	return new Date(value).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

async function loadComments(append = false) {
	loadingMore.value = true;
	try {
		const payload = {
			...(props.sessionId ? { sessionId: props.sessionId } : { logId: props.logId }),
			limit: 100,
			...(append && comments.value.length ? { untilId: comments.value[0].id } : {}),
		};
		const response = await api(props.sessionId ? 'hata/hatady/media/comments/list' : 'hata/hatady/comments', payload);
		const page = Array.isArray(response) ? response : response?.items || [];
		const added = page.filter((r: any) => !comments.value.some((c) => c.id === r.id));
		comments.value = append ? [...added, ...comments.value] : page;
		hasMore.value = !!props.sessionId && page.length === 100 && (!append || added.length > 0);
		const target = comments.value.find((c) => c.id === replyTo.value?.id);
		if (target) replyTo.value = target;
	} catch {
		error.value = conversationCopy.repliesLoadFailed;
	} finally {
		loadingMore.value = false;
	}
}

async function reload() {
	loading.value = true;
	try {
		if (props.sessionId) {
			const result = await api('hata/hatady/media/sessions/show', { sessionId: props.sessionId });
			record.value = { ...result.session, isMine: result.isMine };
			work.value = result.work;
		} else record.value = await api('hata/hatady/logs/show', { logId: props.logId });
		await loadComments();
	} catch {
		error.value = conversationCopy.recordLoadFailed;
	} finally {
		loading.value = false;
	}
}

function setReplyTo(c: any) {
	replyTo.value = c;
	input.value?.focus();
}

function onComposerKeydown(e: KeyboardEvent) {
	if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
	e.preventDefault();
	void send();
}

function insertEmoji(e: MouseEvent) {
	let start = input.value?.selectionStart ?? draft.value.length,
		end = input.value?.selectionEnd ?? start;
	pickers.showEmojiPicker(
		e.currentTarget as HTMLElement,
		(emoji) => {
			draft.value = draft.value.slice(0, start) + emoji + draft.value.slice(end);
			start += emoji.length;
			end = start;
		},
		() => {
			void nextTick(() => {
				input.value?.focus();
				input.value?.setSelectionRange(start, end);
			});
		},
	);
}

async function send() {
	if (sending.value || !draft.value.trim() || draft.value.length > 2048) return;
	sending.value = true;
	error.value = '';
	try {
		const result = await api(props.sessionId ? 'hata/hatady/media/comments/create' : 'hata/hatady/comments/create', {
			...(props.sessionId ? { sessionId: props.sessionId } : { logId: props.logId }),
			text: draft.value.trim(),
			...(replyTo.value?.id ? { replyId: replyTo.value.id } : {}),
		});
		comments.value.push(result);
		draft.value = '';
		replyTo.value = null;
		if (!drafts.clearDraft({ resume: true })) hatadyNotify(conversationCopy.sentDraftCleanupFailed);
		else hatadyNotify(conversationCopy.sent);
		emit('changed');
		await nextTick();
		input.value?.focus();
	} catch {
		error.value = conversationCopy.sendFailed;
	} finally {
		sending.value = false;
	}
}

function requestClose(next?: () => void) {
	if (sending.value) return;
	closing = typeof next !== 'function';
	pendingLeave = typeof next === 'function' ? next : () => dialog.value?.close();
	if (drafts.hasChanges() || drafts.restored.value) closePrompt.value = true;
	else pendingLeave();
}

function leave(save: boolean) {
	if (!(save ? drafts.saveDraft() : drafts.clearDraft({ resume: !closing }))) {
		error.value = conversationCopy.draftChangeFailed;
		return;
	}
	closePrompt.value = false;
	if (save) hatadyNotify(i18n.ts._hata._hatady._formWizard.draftSaved);
	else if (!closing) {
		draft.value = '';
		replyTo.value = null;
		drafts.resetBaseline();
	}
	pendingLeave?.();
}

async function deleteComment(c: any) {
	if (!(await confirmHatadyAction(props.variant, copy.deleteCommentConfirm, 'warning', popup))) return;
	try {
		await api(props.sessionId ? 'hata/hatady/media/comments/delete' : 'hata/hatady/comments/delete', {
			commentId: c.id,
		});
		if (replyTo.value?.id === c.id) replyTo.value = null;
		await loadComments();
		emit('changed');
	} catch {
		hatadyNotify(conversationCopy.deleteFailed);
	}
}

function reportComment(c: any) {
	const { dispose } = popup(
		defineAsyncComponent(() => import('@/components/HatadyReport.vue')),
		{ user: c.user, initialComment: `hatady:${props.sessionId ? 'media:comment' : 'comment'}:${c.id}\n${c.text}`, variant: props.variant },
		{ closed: () => dispose() },
	);
}

function reportRecord() {
	const { dispose } = popup(
		defineAsyncComponent(() => import('@/components/HatadyReport.vue')),
		{
			user: activity.value.user,
			initialComment: `hatady:${props.sessionId ? 'media:session' : 'log'}:${record.value.id}`,
			variant: props.variant,
		},
		{ closed: () => dispose() },
	);
}

async function editRecord() {
	requestClose(async () => {
		const component = props.sessionId
			? (await import('@/components/HatadyMediaSessionForm.vue')).default
			: (await import('@/components/HatadyComposer.vue')).default;
		const { dispose } = popup(
			component as any,
			props.sessionId ? { work: work.value, editSession: record.value, variant: props.variant } : { editLog: record.value, variant: props.variant },
			{
				done: () => {
					void reload();
					emit('changed');
				},
				closed: () => dispose(),
			},
		);
	});
}

async function deleteRecord() {
	if (sending.value || !activity.value?.isMine) return;
	sending.value = true;
	try {
		if (!await confirmHatadyRecordDeletion(activity.value, props.variant, popup)) return;
		emit('deleted', activity.value);
		emit('changed');
		dialog.value?.close();
	} finally {
		sending.value = false;
	}
}

function openWork() {
	requestClose(async () => {
		const id = props.sessionId ? work.value?.id : record.value?.book?.id || record.value?.mediaWork?.id;
		if (!id) return;
		const media = props.sessionId || record.value?.mediaWork;
		const component = media
			? (await import('@/components/HatadyMediaWorkDetail.vue')).default
			: (await import('@/components/HatadyBookDetail.vue')).default;
		const { dispose } = popup(component as any, media ? { workId: id, variant: props.variant } : { bookId: id, variant: props.variant }, {
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		});
	});
}

function openProfile(userId: string) {
	if (isOwnHatadyProfile(userId, props.variant)) {
		if (sending.value) return;
		navigateToOwnProfile = true;
		requestClose();
		return;
	}
	requestClose(async () => {
		const { dispose } = popup(
			(await import('@/components/HatadyProfile.vue')).default,
			{ userId, variant: props.variant },
			{ closed: () => dispose() },
		);
	});
}

onMounted(reload);
</script>
<style lang="scss" module>
.recordActions {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 12px;
}
.recordActions > span {
	flex: 1;
}
.workLink {
	display: flex;
	justify-content: center;
	margin: 20px 0;
}
.replies {
	margin-top: 24px;
	border-top: 1px solid var(--hy-border);
	padding-top: 20px;
}
.replies h3 {
	display: flex;
	gap: 8px;
	font-size: 16px;
}
.reply {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 16px 0;
	min-width: 0;
}
.reply[data-nested='true'] {
	padding-left: 20px;
}
.avatar {
	width: 32px;
	height: 32px;
	flex: none;
}
.reply > div {
	min-width: 0;
	flex: 1;
	overflow-wrap: anywhere;
}
.replyHead {
	display: flex;
	justify-content: space-between;
	gap: 8px;
	font-size: 13px;
	margin-bottom: 8px;
}
.replyHead time {
	color: var(--hy-muted);
	font-size: 11px;
}
.replyActions {
	display: flex;
	gap: 4px;
	align-items: center;
	flex-wrap: wrap;
	margin-top: 10px;
}
.composer {
	width: 100%;
	display: grid;
	gap: 10px;
}
.replying {
	display: flex;
	gap: 8px;
	align-items: center;
	font-size: 13px;
	font-weight: 700;
}
.inputBox {
	border: 1px solid var(--hy-border);
	border-radius: 20px;
	overflow: hidden;
	background: var(--hy-surface);
}
.inputBox:focus-within {
	outline: 2px solid var(--hy-accent);
	outline-offset: 2px;
}
.inputBox textarea {
	display: block;
	width: 100%;
	box-sizing: border-box;
	resize: vertical;
	min-height: 74px;
	max-height: 25dvh;
	border: 0;
	background: none;
	padding: 13px;
	font: inherit;
	font-size: 14px;
	color: inherit;
	outline: none;
}
.inputTools {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 0 6px;
}
.inputTools small {
	margin-left: auto;
	color: var(--hy-muted);
	font-size: 11px;
	padding-right: 8px;
}
.preview {
	padding: 12px;
	border: 1px solid var(--hy-border);
	border-radius: 16px;
	max-height: 20dvh;
	overflow: auto;
}
.sendRow {
	display: flex;
	justify-content: center;
}
</style>
