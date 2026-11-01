<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed 2e): Issue 詳細。タイムライン(会話) + メタ情報サイドバー。
  - パンくず / タイトル(+番号コピー) / 塗りステータスピル + メタ行。
  - 本体 grid 1fr 280px。左=タイムライン(縦接続線・ロールバッジ・MFM・リアクション・引用返信・入力欄)、
    右=メタサイドバー(ステータス/カテゴリ・優先度/対処担当/参加者/賛同/スタッフ操作)。
  - 権限(canManage/isStaff/isAdmin)でメタ操作・スタッフ操作の可否を出し分け。
  ※コメント著者の「スタッフ」判定は packed user に権限情報が無いため、この issue の
    対処担当(moderators)を shield バッジで代替する(真のスタッフバッジは後日 backend 拡張)。
-->
<template>
<div :class="$style.root">
	<!-- パンくず -->
	<div :class="$style.crumbs">
		<button type="button" :class="$style.crumbLink" :aria-label="copy.backToList" @click="$emit('back')"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.issues }}</button>
		<span :class="$style.crumbSep">/</span>
		<span :class="$style.crumbNo">#{{ issue?.number ?? '' }}</span>
	</div>

	<div v-if="loading" :class="$style.center">{{ copy.loading }}</div>
	<div v-else-if="loadError" :class="$style.errorBox">
		<i class="ti ti-lock-off" :class="$style.errorIcon"></i>
		<div :class="$style.errorTitle">{{ copy.unavailableTitle }}</div>
		<div :class="$style.errorSub">{{ copy.unavailableDescription }}</div>
		<MkButton rounded primary @click="$emit('back')"><i class="ti ti-arrow-left"></i> {{ copy.backToList }}</MkButton>
	</div>
	<template v-else-if="issue">
		<!-- タイトル + 番号コピー -->
		<div :class="$style.titleRow">
			<h1 :class="$style.title">{{ issue.title }} <span :class="$style.titleNo">#{{ issue.number }}</span></h1>
			<button v-tooltip="copy.copyTitle" :class="$style.copyBtn" @click="copyText(issue.title, copy.title)"><i class="ti ti-copy"></i></button>
		</div>

		<!-- メタ行 -->
		<div :class="$style.metaRow">
			<HfStatusPill :status="issue.status" variant="filled"/>
			<HfCategoryBadge :category="issue.category"/>
			<span v-if="issue.pinned" :class="$style.metaPin"><i class="ti ti-pin"></i> {{ copy.pinned }}</span>
			<span :class="$style.metaText">
				<template v-if="issue.createdBy"><MkUserName :class="$style.metaAuthor" :user="issue.createdBy"/> {{ copy.createdBySuffix }}<MkTime :time="issue.createdAt" mode="relative"/>{{ copy.createdAtSuffix }}</template>
				{{ copyx.commentsAndParticipants({ comments: (issue.commentsCount ?? comments.length).toString(), participants: participants.length.toString() }) }}
			</span>
		</div>

		<!-- 本体グリッド -->
		<div :class="$style.gridCt">
			<div :class="$style.grid">
				<!-- 左: タイムライン -->
				<div :class="$style.timeline">
					<div :class="$style.tlLine"></div>

					<!-- 最初のカード = 原文(作成者の投稿) -->
					<div :class="$style.tlRow">
						<HfAvatar :user="issue.createdBy" :size="36" :class="$style.tlAvatar"/>
						<div :class="$style.card">
							<div :class="[$style.cardHead, $style.cardHeadAuthor]">
								<MkUserName v-if="issue.createdBy" :class="$style.cardName" :user="issue.createdBy"/>
								<MkTime :class="$style.cardTime" :time="issue.createdAt" mode="relative"/>
								<span :class="[$style.roleBadge, $style.roleAuthor]">{{ copy.author }}</span>
								<button v-tooltip="copy.copyDescription" :class="$style.copyMini" @click="copyText(issue.description, copy.description)"><i class="ti ti-copy"></i></button>
							</div>
							<div v-if="issue.description" :class="$style.cardText"><Mfm :text="linkifyRefs(issue.description)"/></div>
							<MkMediaList v-if="issue.files && issue.files.length" :class="$style.cardMedia" :mediaList="issue.files"/>
							<div v-if="issue.code" :class="$style.codeBlock">
								<div :class="$style.codeHead">
									<span><i class="ti ti-code"></i> {{ copy.submittedCode }}</span>
									<button v-tooltip="copy.copyCode" :class="$style.codeCopyBtn" @click="copyText(issue.code, copy.code)"><i class="ti ti-copy"></i> {{ copy.copy }}</button>
								</div>
								<pre :class="$style.codePre"><code>{{ issue.code }}</code></pre>
							</div>
						</div>
					</div>

					<!-- コメント -->
					<div v-for="c in comments" :key="c.id" :ref="el => setCommentRef(c.id, el)" :class="$style.tlRow">
						<HfAvatar :user="c.user" :size="36" :class="$style.tlAvatar"/>
						<div :class="[$style.card, c.mark === 'important' && $style.cardImportant, flashCommentId === c.id && $style.cardFlash]">
							<div :class="$style.cardHead">
								<MkUserName :class="$style.cardName" :user="c.user"/>
								<MkTime :class="$style.cardTime" :time="c.createdAt" mode="relative"/>
								<span v-if="issue.createdBy && c.user?.id === issue.createdBy.id" :class="[$style.roleBadge, $style.roleAuthor]">{{ copy.author }}</span>
								<span v-else-if="isModeratorUser(c.user?.id)" :class="[$style.roleBadge, $style.roleStaff]"><i class="ti ti-shield-check"></i> {{ copy.assignee }}</span>
								<span v-if="c.mark === 'important'" :class="[$style.roleBadge, $style.roleImportant]"><i class="ti ti-alert-triangle-filled"></i> {{ copy.important }}</span>
								<span v-if="c.mark === 'question'" :class="[$style.roleBadge, $style.roleQuestion]"><i class="ti ti-help-circle-filled"></i> ?</span>
								<button :class="$style.cardMenu" @click="openCommentMenu(c, $event)"><i class="ti ti-dots"></i></button>
							</div>
							<button v-if="c.replyTo" :class="$style.replyRef" @click="scrollToComment(c.replyTo.id)">
								<i class="ti ti-arrow-back-up"></i>
								<MkUserName :class="$style.replyRefUser" :user="c.replyTo.user"/>
								<span :class="$style.replyRefText">{{ c.replyTo.text }}</span>
							</button>
							<div :class="$style.cardText"><Mfm :text="linkifyRefs(c.text)" :author="c.user"/></div>
							<MkMediaList v-if="c.files && c.files.length" :class="$style.cardMedia" :mediaList="c.files"/>
							<div :class="$style.reactions">
								<button
									v-for="(count, emoji) in c.reactions"
									:key="emoji"
									:class="[$style.reaction, c.myReaction === String(emoji) && $style.reactionMine]"
									@click="react(c, String(emoji))"
								>
									<MkReactionIcon :reaction="String(emoji)"/> <span>{{ count }}</span>
								</button>
								<button :class="$style.reactionAdd" @click="openReactionPicker($event, c)"><i class="ti ti-mood-plus"></i></button>
							</div>
						</div>
					</div>

					<!-- コメント投稿(タイムライン末尾) -->
					<div v-if="issue.closed" :class="$style.closedNotice"><i class="ti ti-lock"></i> {{ copy.closedNotice }}</div>
					<div v-else :class="$style.tlRow">
						<HfAvatar :user="me" :size="36" :class="$style.tlAvatar"/>
						<div :class="[$style.card, $style.composerCard]">
							<div v-if="replyTarget" :class="$style.replyBar">
								<i class="ti ti-arrow-back-up"></i>
								<span>{{ copy.replyTo }}</span><MkUserName :user="replyTarget.user"/>
								<span :class="$style.replyBarText">{{ (replyTarget.text ?? '').slice(0, 40) }}</span>
								<button :class="$style.replyBarCancel" @click="replyTarget = null"><i class="ti ti-x"></i></button>
							</div>
							<div v-if="commentFiles.length" :class="$style.cFileGrid">
								<div v-for="f in commentFiles" :key="f.id" :class="$style.cFileThumb">
									<img :src="f.thumbnailUrl ?? f.url" :alt="f.name"/>
									<button :class="$style.cFileDel" @click="commentFiles = commentFiles.filter(x => x.id !== f.id)"><i class="ti ti-x"></i></button>
								</div>
							</div>
							<div :class="$style.composerRow">
								<div :class="$style.inputPill">
									<textarea ref="commentTextarea" v-model="newComment" :class="$style.pillInput" :placeholder="replyTarget ? copy.replyPlaceholder : copy.commentPlaceholder" rows="1" @keydown="onCommentKeydown"></textarea>
									<button :class="$style.pillIcon" :title="copy.insertEmoji" @click="insertCommentEmoji"><i class="ti ti-mood-happy"></i></button>
									<button :class="$style.pillIcon" :title="copy.attachImage" @click="attachCommentFiles"><i class="ti ti-photo-plus"></i></button>
								</div>
								<MkButton :class="$style.sendBtn" rounded primary :disabled="!newComment.trim() || sending" @click="sendComment">{{ copy.send }}</MkButton>
							</div>
						</div>
					</div>
				</div>

				<!-- 右: メタサイドバー -->
				<aside :class="$style.side">
					<!-- ステータス -->
					<div :class="$style.sideSec">
						<div :class="$style.sideLabel">{{ copy.status }}</div>
						<button :class="[$style.statusSelect, !canManage && $style.statusStatic]" :disabled="!canManage" @click="openStatusSelect">
							<HfStatusPill :status="issue.status" variant="text"/>
							<i v-if="canManage" class="ti ti-selector" :class="$style.statusCaret"></i>
						</button>
					</div>

					<!-- カテゴリ / 優先度 -->
					<div :class="$style.sideSec">
						<div :class="$style.sideLabel">{{ copy.categoryAndPriority }}</div>
						<div :class="$style.sideBadges">
							<HfCategoryBadge :category="issue.category"/>
							<button :class="$style.prioBadge" :data-prio="issue.priority ?? 'normal'" :disabled="!canManage" @click="openPrioritySelect">{{ copy.priorityPrefix }} {{ priorityLabel[issue.priority ?? 'normal'] }}</button>
						</div>
					</div>

					<!-- 対処担当 -->
					<div :class="$style.sideSec">
						<div :class="$style.sideLabelRow">
							<span class="ti ti-shield-check" :class="$style.sideLabelIcon"></span>
							<span :class="$style.sideLabel">{{ copy.assignee }}</span>
							<button v-if="isAdmin" v-tooltip="copy.grantAssignee" :class="$style.sideGear" @click="grantModerator"><i class="ti ti-settings"></i></button>
						</div>
						<div v-if="moderators.length === 0" :class="$style.sideMuted">{{ copy.unassigned }}</div>
						<div v-else :class="$style.modList">
							<div v-for="m in moderators" :key="m.id" :class="$style.modItem">
								<HfAvatar :user="m" :size="22"/><MkUserName :user="m"/><i class="ti ti-shield-check" :class="$style.modShield"></i>
							</div>
						</div>
					</div>

					<!-- 参加者 -->
					<div :class="$style.sideSec">
						<div :class="$style.sideLabel">{{ copyx.participantCount({ count: participants.length.toString() }) }}</div>
						<div v-if="participants.length" :class="$style.partStack">
							<HfAvatar v-for="p in participants" :key="p.id" :user="p" :size="26" stack/>
						</div>
						<div v-else :class="$style.sideMuted">{{ copy.noParticipants }}</div>
					</div>

					<!-- 賛同 -->
					<div :class="$style.sideSec">
						<button :class="[$style.agreeBtn, issue.isAgreed && $style.agreeBtnOn]" @click="toggleAgree">
							<i :class="issue.isAgreed ? 'ti ti-heart-filled' : 'ti ti-heart'"></i> {{ copyx.agreeCount({ count: issue.agreementsCount.toString() }) }}
						</button>
					</div>

					<!-- スタッフ操作 -->
					<div v-if="canManage" :class="[$style.sideSec, $style.sideSecLast]">
						<div :class="$style.sideLabelRow">
							<span class="ti ti-shield" :class="$style.sideLabelIcon"></span>
							<span :class="$style.sideLabel">{{ copy.staffActions }}</span>
						</div>
						<div :class="$style.staffActions">
							<button :class="$style.staffAction" @click="togglePin"><i class="ti ti-pin"></i> {{ issue.pinned ? copy.unpin : copy.pin }}</button>
							<button v-if="isAdmin" :class="$style.staffAction" @click="grantModerator"><i class="ti ti-user-plus"></i> {{ copy.grantAssignee }}</button>
							<button :class="$style.staffAction" @click="toggleClose"><i :class="issue.closed ? 'ti ti-lock-open' : 'ti ti-lock'"></i> {{ issue.closed ? copy.reopen : copy.closeIssue }}</button>
							<button v-if="isStaff" :class="[$style.staffAction, $style.staffDanger]" @click="removeIssue"><i class="ti ti-trash"></i> {{ copy.deleteIssue }}</button>
						</div>
					</div>
				</aside>
			</div>
		</div>
	</template>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { url } from '@@/js/config.js';
import type { HataFeedEditableStatus, HataFeedPriority } from '@/utility/hatafeed.js';
import MkButton from '@/components/MkButton.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import HfStatusPill from '@/components/HfStatusPill.vue';
import HfCategoryBadge from '@/components/HfCategoryBadge.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { useHataGoesEmojiPickers } from '@/utility/hatagoes-emoji-pickers.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { statusLabel, editableStatusKeys, priorityLabel } from '@/utility/hatafeed.js';

const popupMenu = useHataGoesPopupMenu();
const dialogs = useHataGoesDialogs();
const { selectUser, selectDriveFiles } = useHataGoesPickers();
const { showReactionPicker, showEmojiPicker } = useHataGoesEmojiPickers();

const props = defineProps<{ issueId: string; isStaff: boolean }>();
const emit = defineEmits<{ (ev: 'back'): void; (ev: 'changed'): void }>();
const copy = i18n.ts._hata._hatafeed._issue;
const copyx = i18n.tsx._hata._hatafeed._issue;

const me = $i;

const loading = ref(true);
const loadError = ref(false);
const issue = ref<any>(null);
const canManage = ref(false);
const moderators = ref<any[]>([]);
const participants = ref<any[]>([]);
const comments = ref<any[]>([]);
const newComment = ref('');
// 旗鯖fork(2e): コメント欄の絵文字挿入用(カーソル位置に :shortcode: / Unicode を差し込む)。
const commentTextarea = ref<HTMLTextAreaElement | null>(null);

function insertCommentEmoji(ev: MouseEvent) {
	const target = (ev.currentTarget ?? ev.target) as HTMLElement | null;
	if (!target) return;
	let pos = commentTextarea.value?.selectionStart ?? newComment.value.length;
	let posEnd = commentTextarea.value?.selectionEnd ?? newComment.value.length;
	// emojiPicker は投稿フォームと同じ挙動。focus-trap 対策で直接テキストへ差し込む。
	showEmojiPicker(target, (emoji: string) => {
		const before = newComment.value.substring(0, pos);
		const after = newComment.value.substring(posEnd);
		newComment.value = before + emoji + after;
		pos += emoji.length;
		posEnd += emoji.length;
	}, () => {});
}

const commentFiles = ref<any[]>([]);
const sending = ref(false);
// 旗鯖fork: 会話の返信先・スクロール用。
const replyTarget = ref<any>(null);
const flashCommentId = ref<string | null>(null);
const commentRefs = new Map<string, HTMLElement>();

function setCommentRef(id: string, el: any) { if (el) commentRefs.set(id, el as HTMLElement); else commentRefs.delete(id); }

const editStatus = ref<HataFeedEditableStatus>('open');
const editPriority = ref<HataFeedPriority>('normal');

// この issue の対処担当(moderators)か。コメントのロールバッジ判定に使う。
function isModeratorUser(userId: string | undefined): boolean {
	if (!userId) return false;
	return moderators.value.some(m => m.id === userId);
}

// 「#番号」を該当イシューへのリンク(MFM)に変換してから Mfm で描画する(数字のみリンク化=安全)。
// MFMは相対パスをリンク化しないため、フルURL(同一オリジン)にする→Misskeyが内部遷移で開く。
function linkifyRefs(text: string): string {
	return text.replace(/#(\d+)/g, `[#$1](${url}/hatafeed/n/$1)`);
}

async function attachCommentFiles() {
	const chosen = await selectDriveFiles({ multiple: true }).catch(() => []);
	for (const f of chosen) {
		if (!commentFiles.value.some(x => x.id === f.id)) commentFiles.value.push(f);
	}
}

const isAdmin = ($i as any)?.isAdmin === true;

async function load() {
	loading.value = true;
	loadError.value = false;
	try {
		const res = await misskeyApi('hata/feedback/issues/show', { issueId: props.issueId });
		issue.value = res.issue;
		canManage.value = res.canManage;
		moderators.value = res.moderators ?? [];
		participants.value = res.participants ?? [];
		editStatus.value = res.issue.status;
		editPriority.value = res.issue.priority ?? 'normal';
		comments.value = await misskeyApi('hata/feedback/comments', { issueId: props.issueId, limit: 100 });
	} catch (err) {
		// 旗鯖fork(#27): 閲覧権限が無い(セキュリティ対応など)・削除済み等で取得に失敗したら、
		//   空白ページにせず案内を出す。通知から飛んだ際の「空白に遷移」を防ぐ。
		issue.value = null;
		loadError.value = true;
	} finally {
		loading.value = false;
	}
}

// 旗鯖fork: タイトル / 補足情報 / 提出コードをクリップボードにコピーする。
// 引用やバグ再現に再利用しやすくするユーザー要望に対応。空テキストは noop。
function copyText(text: string | null | undefined, label: string) {
	if (!text || text === '') {
		dialogs.alert({ type: 'warning', text: copyx.emptyCannotCopy({ label }) });
		return;
	}
	writeClipboard(text, copyx.copied({ label }));
}

// 共通の copyToClipboard は独自トーストも出すため、HataFeed 内は上部の通知だけにそろえる。
async function writeClipboard(text: string, message: string) {
	try {
		await navigator.clipboard.writeText(text);
		hataFeedNotify(message);
	} catch (error) {
		console.error(error);
		hataFeedNotify(i18n.ts.somethingHappened);
	}
}

async function toggleAgree() {
	const res = await misskeyApi('hata/feedback/agree', { issueId: props.issueId });
	issue.value.isAgreed = res.isAgreed;
	issue.value.agreementsCount += res.isAgreed ? 1 : -1;
	emit('changed');
}

function onCommentKeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
	event.preventDefault();
	sendComment();
}

async function sendComment() {
	if (sending.value || !newComment.value.trim()) return;
	sending.value = true;
	try {
		const c = await misskeyApi('hata/feedback/comments/create', { issueId: props.issueId, text: newComment.value.trim(), fileIds: commentFiles.value.map(f => f.id), replyToId: replyTarget.value?.id ?? null });
		comments.value.push(c);
		newComment.value = '';
		commentFiles.value = [];
		replyTarget.value = null;
		// 自分を会話参加者として即時反映。
		const me = $i;
		if (me && !participants.value.some(p => p.id === me.id)) participants.value.push(me);
		emit('changed');
	} finally {
		sending.value = false;
	}
}

// 旗鯖fork: 会話の各種操作
function canManageComment(c: any): boolean {
	return canManage.value || ($i != null && c.user?.id === $i.id);
}

function scrollToComment(id: string) {
	const el = commentRefs.get(id);
	if (!el) return;
	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	flashCommentId.value = id;
	window.setTimeout(() => { if (flashCommentId.value === id) flashCommentId.value = null; }, 1500);
}

function startReply(c: any) {
	replyTarget.value = { id: c.id, user: c.user, text: c.text };
}

async function setMark(c: any, mark: 'important' | 'question' | null) {
	const updated = await misskeyApi('hata/feedback/comments/mark', { commentId: c.id, mark });
	c.mark = updated.mark;
}

async function removeComment(c: any) {
	const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.deleteCommentConfirm });
	if (canceled) return;
	await os.apiWithDialog('hata/feedback/comments/delete', { commentId: c.id });
	comments.value = comments.value.filter(x => x.id !== c.id);
	if (issue.value && typeof issue.value.commentsCount === 'number') issue.value.commentsCount = Math.max(0, issue.value.commentsCount - 1);
	emit('changed');
}

function copyComment(c: any) {
	writeClipboard(c.text ?? '', i18n.ts.copiedContent);
}

function openCommentMenu(c: any, ev: MouseEvent) {
	const items: any[] = [
		{ text: copy.reply, icon: 'ti ti-arrow-back-up', action: () => startReply(c) },
		{ text: copy.copyContent, icon: 'ti ti-copy', action: () => copyComment(c) },
	];
	if (canManageComment(c)) {
		items.push({ type: 'divider' });
		items.push(c.mark === 'important'
			? { text: copy.removeImportantMark, icon: 'ti ti-alert-triangle', action: () => setMark(c, null) }
			: { text: copy.markImportant, icon: 'ti ti-alert-triangle-filled', action: () => setMark(c, 'important') });
		items.push(c.mark === 'question'
			? { text: copy.removeQuestionMark, icon: 'ti ti-help-circle', action: () => setMark(c, null) }
			: { text: copy.markQuestion, icon: 'ti ti-help-circle-filled', action: () => setMark(c, 'question') });
		items.push({ type: 'divider' });
		items.push({ text: copy.delete, icon: 'ti ti-trash', danger: true, action: () => removeComment(c) });
	}
	popupMenu(items, (ev.currentTarget ?? ev.target) as HTMLElement);
}

async function react(c: any, emoji: string) {
	const res = await misskeyApi('hata/feedback/comments/react', { commentId: c.id, reaction: emoji });
	// 楽観更新
	if (!res.reacted) {
		c.reactions[emoji] = (c.reactions[emoji] ?? 1) - 1;
		if (c.reactions[emoji] <= 0) delete c.reactions[emoji];
		c.myReaction = null;
	} else {
		if (c.myReaction && c.myReaction !== emoji) {
			c.reactions[c.myReaction] = (c.reactions[c.myReaction] ?? 1) - 1;
			if (c.reactions[c.myReaction] <= 0) delete c.reactions[c.myReaction];
		}
		c.reactions[emoji] = (c.reactions[emoji] ?? 0) + 1;
		c.myReaction = emoji;
	}
}

function openReactionPicker(ev: MouseEvent, c: any) {
	showReactionPicker(ev.currentTarget as HTMLElement, null, (reaction) => {
		react(c, reaction);
	});
}

async function changeStatus() {
	await misskeyApi('hata/feedback/issues/update', { issueId: props.issueId, status: editStatus.value });
	issue.value.status = editStatus.value;
	emit('changed');
}

// 2e サイドバー: ステータスをメニューで選ぶ(スタッフのみ)。
function openStatusSelect(ev: MouseEvent) {
	if (!canManage.value) return;
	popupMenu(editableStatusKeys.map(s => ({
		text: statusLabel[s],
		active: issue.value.status === s,
		action: () => { editStatus.value = s; changeStatus(); },
	})), (ev.currentTarget ?? ev.target) as HTMLElement);
}

async function changePriority() {
	await misskeyApi('hata/feedback/issues/update', { issueId: props.issueId, priority: editPriority.value });
	issue.value.priority = editPriority.value;
	emit('changed');
}

// 2e サイドバー: 優先度をメニューで選ぶ(スタッフのみ)。
function openPrioritySelect(ev: MouseEvent) {
	if (!canManage.value) return;
	popupMenu((['low', 'normal', 'high'] as const).map(p => ({
		text: copy.priorityPrefix + ' ' + priorityLabel[p],
		active: (issue.value.priority ?? 'normal') === p,
		action: () => { editPriority.value = p; changePriority(); },
	})), (ev.currentTarget ?? ev.target) as HTMLElement);
}

async function togglePin() {
	const next = !issue.value.pinned;
	await misskeyApi('hata/feedback/issues/update', { issueId: props.issueId, pinned: next });
	issue.value.pinned = next;
	emit('changed');
}

async function toggleClose() {
	const next = !issue.value.closed;
	await misskeyApi('hata/feedback/issues/close', { issueId: props.issueId, close: next });
	issue.value.closed = next;
	emit('changed');
}

async function grantModerator() {
	const user = await selectUser({ includeSelf: false });
	if (!user) return;
	await misskeyApi('hata/feedback/moderators/grant', { issueId: props.issueId, userId: user.id });
	hataFeedNotify('保存しました');
	// 付与後、対処担当リストを最新化。
	load();
}

async function removeIssue() {
	const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.deleteIssueConfirm });
	if (canceled) return;
	await misskeyApi('hata/feedback/issues/delete', { issueId: props.issueId });
	hataFeedNotify('保存しました');
	emit('changed');
	emit('back');
}

onMounted(load);
defineExpose({ reload: load });
</script>

<style lang="scss" module>
.root { display: flex; flex-direction: column; gap: 4px; }
.center { text-align: center; padding: 40px 0; opacity: .6; }
/* 旗鯖fork(#27): 閲覧不可/削除済みの案内 */
.errorBox { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 48px 20px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 16px; }
.errorIcon { font-size: 2.6rem; color: var(--MI_THEME-warn); opacity: .8; }
.errorTitle { font-weight: 800; font-size: 1.1rem; }
.errorSub { font-size: .85em; opacity: .7; margin-bottom: 6px; max-width: 360px; }

/* パンくず */
.crumbs { display: flex; align-items: center; gap: 6px; font-size: .85em; margin-bottom: 10px; }
.crumbLink { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: var(--MI_THEME-accent); cursor: pointer; font: inherit; }
.crumbLink > i { font-size: 20px; }
.crumbLink:hover { background: var(--MI_THEME-accentedBg); }
.crumbLink:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.crumbSep { opacity: .5; }
.crumbNo { font-family: ui-monospace, Menlo, monospace; }

/* タイトル */
.titleRow { display: flex; align-items: flex-start; gap: 12px; }
.title { margin: 0; font-size: 1.4rem; font-weight: 800; line-height: 1.4; color: var(--MI_THEME-fg); flex: 1; min-width: 0; word-break: break-word; }
.titleNo { color: var(--MI_THEME-fgTransparentWeak, #95a7a8); font-weight: 400; font-family: ui-monospace, Menlo, monospace; font-size: .85em; }
.copyBtn { flex-shrink: 0; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--MI_THEME-divider); border-radius: 8px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg)); cursor: pointer; transition: border-color .12s, color .12s; }
.copyBtn:hover { border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }

/* メタ行 */
.metaRow { display: flex; align-items: center; gap: 10px; margin: 10px 0 18px; flex-wrap: wrap; }
.metaPin { display: inline-flex; align-items: center; gap: 4px; font-size: .78em; font-weight: 700; color: var(--MI_THEME-accent); }
.metaText { font-size: .82em; opacity: .7; }
.metaAuthor { font-weight: 700; }

/* 本体グリッド */
.gridCt { container-type: inline-size; container-name: hfIssue; }
.grid { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; min-width: 0; }
.grid > * { min-width: 0; }

/* ===== タイムライン ===== */
.timeline { position: relative; min-width: 0; }
.tlLine { position: absolute; left: 17px; top: 24px; bottom: 84px; width: 2px; background: var(--MI_THEME-divider); }
.tlRow { position: relative; display: flex; gap: 12px; margin-bottom: 16px; }
.tlRow:last-child { margin-bottom: 0; }
.tlAvatar { border: 2px solid var(--MI_THEME-bg); z-index: 1; }
.card { flex: 1; min-width: 0; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 24px; box-shadow: var(--hy-shadow); overflow: hidden; transition: background .4s; }
.cardImportant { border-color: color-mix(in srgb, var(--MI_THEME-warn) 55%, var(--MI_THEME-divider)); }
.cardFlash { background: color-mix(in srgb, var(--MI_THEME-accent) 14%, var(--MI_THEME-panel)); }
.cardHead { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--MI_THEME-divider); font-size: .84em; }
.cardHeadAuthor { background: color-mix(in srgb, var(--MI_THEME-accent) 7%, transparent); }
.cardName { font-weight: 700; }
.cardTime { opacity: .6; }
.cardMenu { margin-left: auto; background: none; border: none; color: inherit; opacity: .5; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.cardMenu:hover { opacity: 1; background: var(--MI_THEME-bg); }
.copyMini { margin-left: auto; background: none; border: none; color: inherit; opacity: .5; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.copyMini:hover { opacity: 1; background: var(--MI_THEME-bg); }

/* ロールバッジ */
.roleBadge { display: inline-flex; align-items: center; gap: 3px; font-size: .82em; font-weight: 700; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
.roleAuthor { border: 1px solid var(--MI_THEME-divider); color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg)); }
.roleStaff { background: var(--MI_THEME-accent); color: var(--hy-on-accent); }
.roleImportant { background: #ecb637; color: #352900; }
.roleQuestion { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }

.cardText { padding: 12px 14px; line-height: 1.75; word-break: break-word; }
.cardMedia { margin: 0 14px 12px; max-width: 300px; }

/* 引用返信 */
.replyRef { display: inline-flex; align-items: center; gap: 5px; max-width: calc(100% - 28px); margin: 10px 14px 0; padding: 3px 10px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 8px; font-size: .8em; color: inherit; cursor: pointer; opacity: .85; }
.replyRef:hover { border-color: var(--MI_THEME-accent); }
.replyRefUser { font-weight: 700; flex-shrink: 0; }
.replyRefText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .7; }

/* リアクション */
.reactions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 12px; }
.reaction { display: inline-flex; align-items: center; gap: 4px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 999px; padding: 2px 10px; cursor: pointer; font-size: .85em; color: inherit; }
.reactionMine { background: color-mix(in srgb, var(--MI_THEME-accent) 18%, transparent); border-color: var(--MI_THEME-accent); }
.reactionAdd { background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 999px; padding: 2px 10px; cursor: pointer; color: inherit; opacity: .7; }

/* コード */
.codeBlock { margin: 0 14px 12px; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; overflow: hidden; }
.codeHead { font-size: .8em; opacity: .8; padding: 6px 12px; background: var(--MI_THEME-bg); border-bottom: 1px solid var(--MI_THEME-divider); display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.codeCopyBtn { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; font-size: .9em; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: inherit; cursor: pointer; }
.codeCopyBtn:hover { border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }
.codePre { margin: 0; padding: 12px; overflow-x: auto; font-family: Consolas, Menlo, monospace; font-size: .82em; line-height: 1.5; background: var(--MI_THEME-panel); white-space: pre; }

/* コンポーザ(シンプルな1行ピル: 丸い入力欄に絵文字/画像アイコン内蔵 + 送信ボタン) */
.composerCard { padding: 10px 12px; }
.replyBar { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 12px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 8px; font-size: .82em; }
.replyBarText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .65; flex: 1; }
.replyBarCancel { background: none; border: none; color: inherit; opacity: .6; cursor: pointer; }
.composerRow { display: flex; align-items: flex-end; gap: 8px; }
.inputPill { flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 2px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 20px; padding: 4px 6px 4px 14px; transition: border-color .12s; }
.inputPill:focus-within { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.pillInput:focus-visible { outline: none; }
.pillInput { flex: 1; min-width: 0; background: none; border: none; outline: none; color: inherit; resize: none; font-family: inherit; font-size: .88em; line-height: 1.6; padding: 6px 0; max-height: 120px; overflow-y: auto; }
.pillInput::placeholder { opacity: .5; }
.pillIcon { flex-shrink: 0; width: 44px; height: 44px; border-radius: 999px; border: none; background: none; color: inherit; opacity: .6; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; transition: all .12s; }
.pillIcon:hover { opacity: 1; color: var(--MI_THEME-accent); background: var(--MI_THEME-panel); }
.sendBtn { flex-shrink: 0; min-width: 0; }
.cFileGrid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.cFileThumb { position: relative; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 1px solid var(--MI_THEME-divider); }
.cFileThumb img { width: 100%; height: 100%; object-fit: cover; }
.cFileDel { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.5); color: #fff; border: none; border-radius: 999px; width: 18px; height: 18px; cursor: pointer; }

.closedNotice { display: flex; align-items: center; gap: 6px; margin-top: 4px; padding: 12px 14px; border-radius: 10px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); opacity: .75; font-size: .88em; }

/* ===== メタサイドバー ===== */
.side { display: flex; flex-direction: column; padding: 20px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 24px; box-shadow: var(--hy-shadow); }
.sideSec { padding: 14px 0; border-bottom: 1px solid var(--MI_THEME-divider); }
.sideSec:first-child { padding-top: 0; }
.sideSecLast { border-bottom: none; }
.sideLabel { font-size: .72em; font-weight: 800; color: var(--MI_THEME-fgTransparentWeak, #7e9192); letter-spacing: .04em; }
.sideLabelRow { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.sideLabelRow .sideLabel { margin: 0; }
.sideLabelIcon { color: var(--MI_THEME-fgTransparentWeak, #7e9192); font-size: 1em; }
.sideGear { margin-left: auto; background: none; border: none; color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg)); opacity: .7; cursor: pointer; padding: 0; }
.sideGear:hover { opacity: 1; color: var(--MI_THEME-accent); }
.sideMuted { font-size: .84em; opacity: .5; margin-top: 8px; }

.statusSelect { margin-top: 8px; width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 6px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 8px; padding: 7px 12px; color: inherit; cursor: pointer; }
.statusSelect:not(:disabled):hover { border-color: var(--MI_THEME-accent); }
.statusStatic { cursor: default; }
.statusCaret { margin-left: auto; opacity: .5; }

.sideBadges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
.prioBadge { font-size: .72em; font-weight: 700; padding: 3px 10px; border-radius: 999px; border: none; cursor: pointer; color: inherit; }
.prioBadge:disabled { cursor: default; }

.modList { display: flex; flex-direction: column; gap: 8px; }
.modItem { display: flex; align-items: center; gap: 7px; font-size: .86em; }
.modShield { color: var(--MI_THEME-accent); font-size: 1em; margin-left: auto; }

.partStack { display: flex; margin-top: 8px; }

.agreeBtn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 7px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 8px; padding: 9px 0; font-size: .9em; font-weight: 700; color: #dd2e44; cursor: pointer; transition: all .12s; }
.agreeBtn:hover { border-color: #dd2e44; background: color-mix(in srgb, #dd2e44 6%, transparent); }
.agreeBtnOn { background: color-mix(in srgb, #dd2e44 12%, transparent); border-color: #dd2e44; }

/* 旗鯖fork(2e): スタッフ操作は田(2x2)グリッドでまとめて表示する(左詰めの縦積みは間延びして見えるため)。 */
.staffActions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.staffAction { display: flex; align-items: center; gap: 7px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); color: var(--MI_THEME-fg); opacity: .9; cursor: pointer; text-align: left; padding: 8px 10px; border-radius: 8px; font-size: .82em; }
.staffAction:hover { opacity: 1; border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }
.staffAction i { font-size: 1.05em; }
.staffDanger { color: #ec4137; }
.staffDanger:hover { color: #ec4137; border-color: #ec4137; }

/* ===== レスポンシブ: サイドバーを上に畳む ===== */
@container hfIssue (max-width: 720px) {
	.grid { grid-template-columns: 1fr; }
	.side { order: -1; flex-direction: row; flex-wrap: wrap; gap: 8px 20px; padding: 12px 14px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 24px; margin-bottom: 4px; }
	.sideSec { padding: 4px 0; border-bottom: none; flex: 1; min-width: 130px; }
	.sideSecLast { flex-basis: 100%; }
}
</style>

<style lang="scss" scoped>
/* 動的な値(優先度)で色が変わる小要素は data 属性で当てる(module の動的キーはビルドで解決されないため)。 */
.prioBadge[data-prio="low"] { background: #eef1f2; color: #6b7b7c; }
.prioBadge[data-prio="normal"] { background: #e1efff; color: #2b6fc0; }
.prioBadge[data-prio="high"] { background: #fff0d6; color: #b6791f; }
</style>
