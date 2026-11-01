<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL 専用の投稿フォーム。MkPostForm のレイアウトと操作感を複製し、
送信先はコンカレントだけに固定する（旗鯖への投稿・下書き・公開範囲の機能は持たない）。
下書きはフォームを閉じても concrntDraft に残り、接続先の本人が変わった時だけ破棄される。
-->

<template>
<form
	:class="[$style.root, { [$style.modal]: modal, _popup: modal }]" data-concrnt-post-form
	@submit.prevent="publish" @dragover.prevent @drop.prevent="onDrop"
>
	<header :class="$style.header">
		<div :class="$style.headerLeft">
			<button v-if="modal" class="_button" :class="$style.cancel" type="button" aria-label="閉じる" @click="emit('cancel')"><i class="ti ti-x"></i></button>
			<button type="button" class="_button" :class="$style.account" :title="`${profileName}（コンカレント）から投稿`" :aria-label="`投稿するプロフィール：${profileName}`" :disabled="busy || draft.blocked" @click="openDestinationPicker">
				<img v-if="profileAvatar" :class="$style.avatar" :src="profileAvatar" alt="" referrerpolicy="no-referrer"/>
				<span v-else :class="[$style.avatar, $style.avatarFallback]" aria-hidden="true"><i class="ti ti-user"></i></span>
				<span :class="$style.accountBadge" aria-hidden="true"><i :class="profileRestricted ? 'ti ti-lock' : 'concrnt-icon'"></i></span>
			</button>
		</div>
		<div :class="$style.headerRight">
			<button
				ref="destinationButton" type="button" class="_button" :class="[$style.headerRightItem, $style.destination]"
				:disabled="busy || draft.blocked || concrntListState.pending"
				:aria-label="`投稿先：${concrntDestinationLabel}`" data-concrnt-destination @click="openDestinationPicker"
			>
				<i :class="restrictedSelection ? 'ti ti-lock' : 'ti ti-users'" aria-hidden="true"></i><span :class="$style.headerRightButtonText">{{ concrntDestinationLabel }}</span>
			</button>
			<div :class="$style.submit">
				<button class="_button" :class="$style.submitButton" type="submit" :disabled="!canPost" data-concrnt-submit>
					<div :class="$style.submitInner"><i :class="busy ? 'ti ti-loader-2' : 'concrnt-icon'" aria-hidden="true"></i><span>{{ busy ? '処理中…' : draft.target && draft.mode === 'reply' ? '返信' : '投稿' }}</span></div>
				</button>
			</div>
		</div>
	</header>

	<div v-if="draft.target" :class="$style.targetNote">
		<div :class="$style.targetLabel">
			<i :class="draft.mode === 'reply' ? 'ti ti-arrow-back-up' : 'ti ti-quote'" aria-hidden="true"></i>
			<span>{{ draft.mode === 'reply' ? '返信先' : '引用元' }}</span>
			<button type="button" class="_button" :class="$style.targetRemove" :disabled="busy || draft.blocked" aria-label="返信・引用を解除" @click="draft.target = null"><i class="ti ti-x"></i></button>
		</div>
		<ConcrntNote :message="draft.target" embedded :depth="2"/>
	</div>

	<MkInfo v-if="destinationProblem" :class="$style.notice" warn role="status">
		{{ destinationProblem }}
		<button v-if="concrntListState.error || !concrntListState.ready" type="button" class="_textButton" :disabled="concrntListState.loading" @click="refreshConcrntLists()">一覧を更新</button>
	</MkInfo>
	<MkInfo v-if="draft.blocked" :class="$style.notice" warn role="alert">
		送信結果を確認できませんでした。同じ内容の自動再送は行いません。
		<button type="button" class="_textButton" @click="openConcrntHistory()">送信履歴を開く</button> ·
		<button type="button" class="_textButton" @click="resetConcrntDraft()">新しい投稿を書く</button>
	</MkInfo>
	<MkInfo v-if="error" :class="$style.notice" warn role="alert">{{ error }}</MkInfo>

	<div :class="$style.textOuter">
		<textarea
			ref="textareaEl" v-model="draft.body" :class="$style.text" maxlength="20000" :disabled="busy" :readonly="draft.blocked"
			:placeholder="draft.target && draft.mode === 'reply' ? '返信を書く' : 'いま、どうしてる？'" aria-label="投稿本文"
			@keydown="onKeydown" @paste="onPaste"
		></textarea>
		<div v-if="20000 - draft.body.length < 100" :class="['_acrylic', $style.textCount]">{{ 20000 - draft.body.length }}</div>
	</div>

	<div v-if="draft.attachments.length" :class="$style.attaches">
		<div v-for="(media, index) in draft.attachments" :key="media.url" :class="$style.attach">
			<button type="button" class="_button" :class="$style.attachThumb" :aria-label="`添付画像${index + 1}の操作`" @click="showAttachMenu(index, $event)">
				<img :src="media.url" :alt="media.alt ?? ''" referrerpolicy="no-referrer"/>
				<span v-if="media.flag" :class="$style.attachBadge" title="閲覧注意"><i class="ti ti-eye-exclamation"></i></span>
				<span v-if="media.alt" :class="[$style.attachBadge, $style.attachAlt]">ALT</span>
			</button>
		</div>
	</div>
	<p v-if="draft.attachments.length" :class="$style.caption">画像は追加時に公開ストレージへ送信されます。添付を外してもアップロード済みの画像は削除されません。</p>

	<footer :class="$style.footer">
		<div :class="$style.footerLeft">
			<button v-tooltip="'画像を追加'" type="button" class="_button" :class="$style.footerButton" aria-label="画像を追加" :disabled="!canAttach" @click="fileInput?.click()"><i class="ti ti-photo-plus"></i></button>
			<button ref="emojiButton" v-tooltip="'絵文字'" type="button" class="_button" :class="$style.footerButton" aria-label="絵文字" :disabled="busy || draft.blocked" @click="insertEmoji"><i class="ti ti-mood-happy"></i></button>
		</div>
		<input ref="fileInput" :class="$style.fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" :disabled="!canAttach" tabindex="-1" aria-hidden="true" @change="onFileChange"/>
	</footer>
</form>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { ConcrntEmoji } from '@/utility/concrnt/types.js';
import MkInfo from '@/components/MkInfo.vue';
import ConcrntNote from '@/components/concrnt/ConcrntNote.vue';
import * as os from '@/os.js';
import { concrntState, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntShortcode } from '@/utility/concrnt/content.js';
import {
	concrntDestinationLabel, concrntDestinationProblem, concrntDestinations, concrntDraft as draft, concrntListState,
	concrntPostHome, concrntPostProfile, concrntPostedRevision, openConcrntHistory, refreshConcrntLists, resetConcrntDraft,
} from '@/utility/concrnt/composer.js';

const ConcrntEmojiPicker = () => import('@/components/concrnt/ConcrntEmojiPicker.vue');
const ConcrntDestinationPicker = () => import('@/components/concrnt/ConcrntDestinationPicker.vue');

const props = withDefaults(defineProps<{ modal?: boolean; active?: boolean }>(), { modal: false, active: true });
const emit = defineEmits<{ posted: []; cancel: [] }>();

const textareaEl = useTemplateRef('textareaEl');
const fileInput = useTemplateRef('fileInput');
const destinationButton = useTemplateRef('destinationButton');
const emojiButton = useTemplateRef('emojiButton');
const busy = ref(false);
const error = ref('');
let alive = true;

const profile = computed(() => concrntState.profiles.find(item => item.id === concrntPostProfile.value));
const profileName = computed(() => profile.value?.name || concrntPostProfile.value);
const profileAvatar = computed(() => profile.value?.avatarUrl);
const profileRestricted = computed(() => profile.value?.visibility === 'restricted');
// Only the home timeline's restriction is known without extra reads; the picker shows each timeline's lock.
const restrictedSelection = computed(() => profileRestricted.value && concrntPostHome.value);
const destinationProblem = computed(() => concrntDestinationProblem.value);
const postingReady = computed(() => props.active && concrntState.status === 'connected' && !destinationProblem.value);
const canAttach = computed(() => !busy.value && !draft.blocked && postingReady.value && draft.attachments.length < 4);
const canPost = computed(() => !busy.value && !draft.blocked && postingReady.value && (draft.body.trim().length > 0 || draft.attachments.length > 0));
const identity = () => JSON.stringify([concrntState.currentOwner, concrntState.connection?.ccid, concrntState.settings.profile]);

function report(failure: unknown): void {
	error.value = failure instanceof Error ? failure.message : '処理を完了できませんでした。';
}

async function action(work: () => Promise<void>): Promise<void> {
	if (busy.value) return;
	busy.value = true;
	error.value = '';
	try { await work(); } catch (failure) { if (alive) report(failure); } finally { if (alive) busy.value = false; }
}

/** Only emoji still present in the body are sent, so removed text does not leave stale definitions. */
function usedEmojis(): Record<string, { imageURL?: string }> | undefined {
	const used = Object.fromEntries(Object.entries(draft.emojis).filter(([name]) => draft.body.includes(`:${name}:`)));
	return Object.keys(used).length ? used : undefined;
}

async function publish(): Promise<void> {
	if (!canPost.value) return;
	await action(async () => {
		const target = draft.target;
		const emojis = usedEmojis();
		const result = await runConcrntAction(client => client.publish({
			profile: concrntPostProfile.value, body: draft.body, media: draft.attachments.map(item => ({ ...item })),
			// world-app semantics: readers are decided by the chosen profile and timelines, not claimed public here.
			destinations: concrntDestinations.value, postHome: concrntPostHome.value, visibility: 'inherit',
			...(emojis ? { emojis } : {}),
			...(target ? draft.mode === 'reply' ? { replyTo: target.key ?? target.uri } : { quoteOf: target.key ?? target.uri } : {}),
		}));
		if (result.status === 'complete') {
			resetConcrntDraft();
			concrntPostedRevision.value++;
			os.toast('コンカレントに投稿しました');
			emit('posted');
		} else {
			draft.blocked = true;
		}
	});
}

async function upload(file: File): Promise<void> {
	if (!canAttach.value) return;
	const owner = identity();
	await action(async () => {
		const media = await runConcrntAction(client => client.uploadImage(file, {
			profile: concrntPostProfile.value, destinations: concrntDestinations.value, postHome: concrntPostHome.value, visibility: 'inherit',
		}));
		// Never attach an upload to a draft that now belongs to another identity.
		if (alive && identity() === owner) draft.attachments.push(media);
	});
}

async function onFileChange(event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (file) await upload(file);
	input.value = '';
}

function onPaste(event: ClipboardEvent): void {
	const file = Array.from(event.clipboardData?.files ?? []).find(item => item.type.startsWith('image/'));
	if (!file) return;
	event.preventDefault();
	void upload(file);
}

function onDrop(event: DragEvent): void {
	const file = Array.from(event.dataTransfer?.files ?? []).find(item => item.type.startsWith('image/'));
	if (file) void upload(file);
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void publish(); }
	if (event.key === 'Escape' && props.modal) { event.preventDefault(); emit('cancel'); }
}

async function openDestinationPicker(): Promise<void> {
	if (!concrntListState.ready && !concrntListState.loading) void refreshConcrntLists();
	const component = (await ConcrntDestinationPicker()).default;
	const { dispose } = os.popup(component, { anchorElement: destinationButton.value }, { closed: () => dispose() });
}

function showAttachMenu(index: number, event: MouseEvent): void {
	const media = draft.attachments[index];
	if (!media) return;
	os.popupMenu([
		{ text: '画像の説明を編集', icon: 'ti ti-text-caption', action: async () => {
			const { canceled, result } = await os.inputText({ title: '画像の説明', default: media.alt ?? '', maxLength: 1000 });
			if (!canceled) media.alt = result || undefined;
		} },
		{ type: 'switch', text: '閲覧注意にする', icon: 'ti ti-eye-exclamation', ref: computed({ get: () => media.flag === 'sensitive', set: value => { media.flag = value ? 'sensitive' : undefined; } }) },
		{ type: 'divider' },
		{ text: '添付から外す', icon: 'ti ti-circle-x', danger: true, action: () => { draft.attachments.splice(index, 1); } },
	], (event.currentTarget ?? event.target) as HTMLElement);
}

async function insertAtCursor(text: string): Promise<void> {
	const el = textareaEl.value;
	const start = el?.selectionStart ?? draft.body.length;
	const end = el?.selectionEnd ?? start;
	draft.body = draft.body.slice(0, start) + text + draft.body.slice(end);
	await nextTick();
	el?.focus();
	el?.setSelectionRange(start + text.length, start + text.length);
}

async function insertEmoji(): Promise<void> {
	const component = (await ConcrntEmojiPicker()).default;
	const { dispose } = os.popup(component, { anchorElement: emojiButton.value, mode: 'insert' }, {
		done: (emoji: ConcrntEmoji) => {
			const name = concrntShortcode(emoji.shortcode);
			// Two images under one name would be ambiguous; keep the first definition.
			const existing = draft.emojis[name]?.imageURL;
			const unique = existing && existing !== emoji.imageUrl ? `${name}_${Object.keys(draft.emojis).length}` : name;
			draft.emojis = { ...draft.emojis, [unique]: { imageURL: emoji.imageUrl } };
			void insertAtCursor(`:${unique}:`);
		},
		closed: () => dispose(),
	});
}

function focus(): void { textareaEl.value?.focus(); }

onMounted(() => {
	if (!concrntListState.ready && !concrntListState.loading) void refreshConcrntLists();
	if (props.modal) void nextTick(focus);
});
onBeforeUnmount(() => { alive = false; });

defineExpose({ focus });
</script>

<style lang="scss" module>
.root {
	position: relative;
	container-type: inline-size;
	max-width: 800px;
	color: var(--MI_THEME-fg);

	&.modal {
		width: 100%;
		max-width: 640px;
		overflow-x: clip;
		overflow-y: auto;
	}
}

.header {
	z-index: 1000;
	display: flex;
	flex-wrap: nowrap;
	gap: 4px;
	min-height: 50px;
	padding: 8px 12px;
}

.headerLeft {
	display: flex;
	flex: 1;
	flex-wrap: nowrap;
	align-items: center;
	gap: 6px;
	padding-left: 12px;
}

.cancel {
	padding: 8px;
}

.account {
	position: relative;
	display: inline-flex;
}

.avatar {
	width: 28px;
	height: 28px;
	margin: auto 0;
	border-radius: 100%;
	object-fit: cover;
}

.avatarFallback {
	display: grid;
	place-items: center;
	background: var(--MI_THEME-buttonBg);
	font-size: 16px;
}

.accountBadge {
	position: absolute;
	right: -4px;
	bottom: -3px;
	display: grid;
	place-items: center;
	width: 15px;
	height: 15px;
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-accent);
	font-size: 11px;
	line-height: 1;
}

.headerRight {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	gap: 4px;
	min-height: 48px;
	margin-left: auto;
	padding-left: 4px;
	overflow: clip;
	font-size: .9em;
}

.headerRightItem {
	margin: 0;
	padding: 8px;
	border-radius: 6px;

	&:hover:not(:disabled) { background: light-dark(rgba(0, 0, 0, .05), rgba(255, 255, 255, .05)); }
	&:disabled { opacity: .6; }
}

.headerRightButtonText {
	padding-left: 6px;
}

.destination {
	max-width: 210px;
	overflow: clip;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.submit {
	display: flex;
	margin: 12px 12px 12px 6px;
}

.submitButton {
	&:focus-visible {
		outline: none;

		> .submitInner {
			outline: 2px solid var(--MI_THEME-fgOnAccent);
			outline-offset: -4px;
		}
	}

	&:disabled { opacity: .7; }

	&:not(:disabled):hover > .submitInner,
	&:not(:disabled):active > .submitInner {
		background: light-dark(var(--MI_THEME-buttonGradateB), var(--MI_THEME-buttonGradateA));
	}
}

.submitInner {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	box-sizing: border-box;
	min-width: 104px;
	height: 34px;
	padding: 0 10px;
	border-radius: 6px;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-weight: bold;
	line-height: 1;
	white-space: nowrap;
}

.targetNote {
	padding: 0 30px 16px;
}

.targetLabel {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 6px;
	color: var(--MI_THEME-accent);
	font-size: .9em;
}

.targetRemove {
	margin-left: auto;
	padding: 4px 6px;
	border-radius: 6px;
	color: var(--MI_THEME-fg);

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
}

.notice {
	margin: 0 20px 12px;
}

.textOuter {
	position: relative;
	width: 100%;
}

.text {
	display: block;
	box-sizing: border-box;
	width: 100%;
	min-width: 100%;
	max-width: 100%;
	min-height: 140px;
	margin: 0;
	padding: 0 30px;
	border: none;
	border-radius: 0;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-family: inherit;
	font-size: 110%;
	resize: vertical;

	&:focus { outline: none; }
	&:disabled { opacity: .5; }
}

.textCount {
	position: absolute;
	top: 0;
	right: 2px;
	min-width: 1.6em;
	padding: 4px 6px;
	border-radius: 6px;
	color: var(--MI_THEME-warn);
	font-size: .9em;
	text-align: center;
}

.attaches {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 8px 30px 4px;
}

.attach {
	position: relative;
}

.attachThumb {
	position: relative;
	display: block;
	width: 64px;
	height: 64px;
	overflow: hidden;
	border-radius: 8px;
	background: var(--MI_THEME-bg);

	> img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
}

.attachBadge {
	position: absolute;
	top: 3px;
	left: 3px;
	padding: 1px 4px;
	border-radius: 4px;
	background: rgba(0, 0, 0, .6);
	color: #fff;
	font-size: 10px;
}

.attachAlt {
	right: 3px;
	left: auto;
}

.caption {
	margin: 0;
	padding: 0 30px 8px;
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: .8em;
}

.footer {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 16px 16px;
	font-size: 1em;
}

.footerLeft {
	display: grid;
	flex: 1;
	grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
	grid-auto-rows: 44px;
	min-width: 0;
	max-width: 100%;
}

.footerButton {
	display: inline-block;
	width: auto;
	height: 100%;
	margin: 0;
	padding: 0;
	border-radius: 6px;
	font-size: 1em;

	&:hover:not(:disabled) { background: light-dark(rgba(0, 0, 0, .05), rgba(255, 255, 255, .05)); }
	&:disabled { opacity: .4; }
}

.fileInput {
	display: none;
}

@container (max-width: 500px) {
	.header { padding: 4px; }
	.headerRightButtonText { display: none; }
	.submit { margin: 8px 8px 8px 4px; }
	.targetNote, .attaches, .caption { padding-inline: 22px; }
	.text { min-height: 120px; padding: 0 22px; }
	.footer { padding: 0 8px 8px; }
}
</style>
