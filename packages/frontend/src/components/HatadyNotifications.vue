<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady 1h): 通知ページ(モーダル)。
  リアクション/コメント/フォロー/継続・達成 をフィルタ + 日付グループで表示する。
  ※ フォロー/継続・達成 は将来用(現状はリアクション/コメント通知を生成)。
  ※ hataskey 標準通知への統合(1h 後半)は別途。
-->
<template>
<HyDialog
	ref="dialog"
	:title="copy.title"
	:anchorElement="anchorElement"
	floating
	@close="closeOrCancel"
	@closed="emit('closed')"
>
	<template #headerActions>
		<button
			class="hy-icon-button"
			:disabled="busy || loading || !!deletingIds || !items.length"
			:aria-label="noticeCopy.deleteAll"
			:title="noticeCopy.deleteAll"
			@click="askDelete"
		>
			<i class="ti ti-trash"></i>
		</button>
	</template>
	<div v-if="deletingIds" :class="$style.confirm">
		<p>{{ i18n.tsx._hata._hatady._notificationsView.deleteCount({ count: deletingIds.length }) }}</p>
		<p>{{ noticeCopy.retainContent }}</p>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
		<div>
			<button class="hy-secondary" :disabled="busy" @click="cancelDelete">{{ i18n.ts.cancel }}</button>
			<button class="hy-primary" :disabled="busy" @click="confirmDelete">{{ noticeCopy.deleteAction }}</button>
		</div>
	</div>
	<div v-if="undoIds.length && !deletingIds" :class="$style.undo">
		<span>{{ noticeCopy.deleted }}</span>
		<button class="hy-secondary" :disabled="busy" @click="undoDelete">{{ noticeCopy.undo }}</button>
	</div>
	<p v-if="error && !deletingIds" class="hy-error" role="alert">{{ error }}</p>

	<div v-show="!deletingIds" class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<!-- フィルタ -->
		<div :class="$style.filters">
			<HyCapsule v-model="activeFilter" :options="filters" :label="noticeCopy.typeFilter"/>
			<button type="button" :class="$style.readAll" :disabled="loading || markingRead" @click="markAllRead">
				<i class="ti ti-checks"></i>
				{{ copy.markAllRead }}
			</button>
		</div>

		<div :class="$style.list">
			<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
			<div v-else-if="filtered.length === 0" :class="$style.empty">
				<i class="ti ti-bell-off" :class="$style.emptyIcon"></i>
				<div>{{ copy.empty }}</div>
			</div>
			<template v-else>
				<template v-for="g in groups" :key="g.key">
					<div v-if="g.items.length" :class="$style.groupHead">{{ g.label }}</div>
					<div
						v-for="n in g.items"
						:key="n.id"
						:class="[$style.notif, !n.isRead && $style.unread, isClickable(n) && $style.clickable]"
						:role="isClickable(n) ? 'button' : undefined"
						:tabindex="isClickable(n) ? 0 : undefined"
						@keydown.enter.self="onClickNotif(n)"
						@keydown.space.prevent.self="onClickNotif(n)"
						@click="onClickNotif(n)"
					>
						<span v-if="!n.isRead" :class="$style.dot"></span>
						<!-- アイコン -->
						<span v-if="n.type === 'milestone'" :class="$style.milestoneIcon">
							<i class="ti ti-flame-filled"></i>
						</span>
						<span v-else-if="n.type === 'goalDone'" :class="$style.goalIcon"><i class="ti ti-target-arrow"></i></span>
						<span v-else :class="$style.avatarWrap">
							<MkAvatar :class="$style.avatar" :user="n.user"/>
							<span v-if="isReaction(n)" :class="$style.badgeReaction">
								<MkReactionIcon :reaction="String(n.reaction || '👍')"/>
							</span>
							<span v-else-if="isComment(n)" :class="$style.badgeComment">
								<i :class="['ti', n.type === 'mediaReply' ? 'ti-message-reply' : 'ti-message-circle-2']"></i>
							</span>
							<span v-else-if="n.type === 'follow'" :class="$style.badgeFollow"><i class="ti ti-user-plus"></i></span>
						</span>
						<!-- 本文 -->
						<div :class="$style.content">
							<div :class="$style.text">
								<template v-if="n.type === 'milestone'">
									<b :class="$style.streakVal">{{ copyx.daysStreak({ count: String(n.value) }) }}</b>
									{{ copy.milestoneText }}
								</template>
								<template v-else-if="n.type === 'goalDone'">
									<b :class="$style.who">{{ copy.goalDoneTitle }}</b>
									{{ copy.goalDoneText }}
								</template>
								<template v-else>
									<b :class="$style.who"><MkUserName :user="n.user"/></b>
									{{ verb(n) }}
									<MkReactionIcon
										v-if="isReaction(n)"
										:class="$style.inlineReaction"
										:reaction="String(n.reaction || '👍')"
									/>
								</template>
							</div>
							<div v-if="isMediaNotification(n) && mediaTitle(n)" :class="$style.mediaTarget">
								<i :class="['ti', mediaIcon(n)]"></i>
								<span>{{ mediaTitle(n) }}</span>
							</div>
							<div v-else-if="n.type === 'reaction' && n.logTitle" :class="$style.snippet">{{ n.logTitle }}</div>
							<div v-if="isComment(n) && notificationCommentText(n)" :class="$style.bubble">
								{{ notificationCommentText(n) }}
							</div>
						</div>
						<div :class="$style.right">
							<span :class="$style.time">{{ fmtWhen(n.createdAt) }}</span>
							<button
								v-if="n.type === 'follow' && n.user"
								:class="[$style.followBtn, n.isFollowingBack && $style.followingBtn]"
								:disabled="n.busy"
								@click.stop="toggleFollowBack(n)"
							>
								{{ n.isFollowingBack ? copy.followingBack : copy.followBack }}
							</button>
						</div>
					</div>
				</template>
			</template>
		</div>
	</div>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { versatileLang } from '@@/js/intl-const.js';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { i18n } from '@/i18n.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';

defineProps<{ anchorElement?: HTMLElement | null }>();
const emit = defineEmits<{
	(ev: 'read', allRead?: boolean): void;
	(ev: 'openLog', logId: string): void;
	(ev: 'openMedia', workId: string): void;
	(ev: 'openSession', sessionId: string, workId?: string): void;
	(ev: 'openProfile', userId: string): void;
	(ev: 'closed'): void;
}>();
const dialog = ref<any>(null);
const dialogs = useHataGoesDialogs();
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._notifications;
const copyx = i18n.tsx._hata._hatady._notifications;
const noticeCopy = i18n.ts._hata._hatady._notificationsView;
const shortDateFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'short', day: 'numeric' });

const items = ref<any[]>([]);
const loading = ref(true);
const markingRead = ref(false);
const activeFilter = ref('all');
let active = true;

const filters = [
	{ value: 'all', label: copy.filterAll, icon: 'ti ti-bell' },
	{ value: 'reaction', label: copy.filterReaction, icon: 'ti ti-heart' },
	{ value: 'comment', label: copy.filterComment, icon: 'ti ti-message-circle-2' },
	{ value: 'follow', label: copy.filterFollow, icon: 'ti ti-user-plus' },
	{ value: 'milestone', label: copy.filterMilestone, icon: 'ti ti-flame' },
];

function verb(n: any): string {
	if (n.type === 'reaction') return copy.verbReaction;
	if (n.type === 'comment') return copy.verbComment;
	if (n.type === 'mediaReaction') return copy.verbMediaReaction;
	if (n.type === 'mediaComment') return copy.verbMediaComment;
	if (n.type === 'mediaReply') return copy.verbMediaReply;
	if (n.type === 'follow') return copy.verbFollow;
	return '';
}

function isReaction(n: any): boolean {
	return n.type === 'reaction' || n.type === 'mediaReaction';
}

function isComment(n: any): boolean {
	return n.type === 'comment' || n.type === 'mediaComment' || n.type === 'mediaReply';
}

function isMediaNotification(n: any): boolean {
	return n.type === 'mediaComment' || n.type === 'mediaReply' || n.type === 'mediaReaction';
}

function mediaWork(n: any): any | null {
	return n.mediaWork ?? null;
}

function mediaTitle(n: any): string {
	return String(n.mediaTitle ?? mediaWork(n)?.title ?? '');
}

function mediaKind(n: any): 'movie' | 'game' | null {
	const kind = n.mediaKind ?? mediaWork(n)?.kind;
	return kind === 'movie' || kind === 'game' ? kind : null;
}

function mediaIcon(n: any): string {
	return mediaKind(n) === 'movie' ? 'ti-movie' : mediaKind(n) === 'game' ? 'ti-device-gamepad-2' : 'ti-library';
}

function notificationCommentText(n: any): string {
	if (isMediaNotification(n) && (n.mediaCommentSpoiler === true || n.mediaComment?.spoiler === true)) return '';
	return String(n.mediaCommentText ?? n.mediaComment?.text ?? n.commentText ?? '');
}

function isClickable(n: any): boolean {
	return Boolean(n.mediaSessionId || n.logId || n.mediaWorkId || mediaWork(n)?.id || (n.type === 'follow' && n.user));
}

function fmtWhen(iso: string): string {
	const d = new Date(iso);
	const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
	if (diffMin < 1) return copy.now;
	if (diffMin < 60) return copyx.minutesAgo({ count: diffMin.toString() });
	const diffH = Math.floor(diffMin / 60);
	if (diffH < 24) return copyx.hoursAgo({ count: diffH.toString() });
	const diffD = Math.floor(diffH / 24);
	if (diffD < 7) return copyx.daysAgo({ count: diffD.toString() });
	return shortDateFormatter.format(d);
}

const filtered = computed(() => {
	if (activeFilter.value === 'all') return items.value;
	if (activeFilter.value === 'reaction') return items.value.filter(isReaction);
	if (activeFilter.value === 'comment') return items.value.filter(isComment);
	return items.value.filter((n) => n.type === activeFilter.value);
});

// 今日/昨日/それ以前 でグループ化。
const groups = computed(() => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const buckets = { today: [] as any[], yesterday: [] as any[], earlier: [] as any[] };
	for (const n of filtered.value) {
		const d = new Date(n.createdAt);
		d.setHours(0, 0, 0, 0);
		const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
		if (diff <= 0) buckets.today.push(n);
		else if (diff === 1) buckets.yesterday.push(n);
		else buckets.earlier.push(n);
	}
	return [
		{ key: 'today', label: copy.today, items: buckets.today },
		{ key: 'yesterday', label: copy.yesterday, items: buckets.yesterday },
		{ key: 'earlier', label: copy.earlier, items: buckets.earlier },
	];
});

async function reload() {
	loading.value = true;
	try {
		const collected: any[] = [];
		let untilId: string | undefined;
		const seen = new Set<string>();
		for (;;) {
			const page = (await misskeyApi('hata/hatady/notifications', {
				limit: 100,
				...(untilId ? { untilId } : {}),
			})) as any[];
			if (!Array.isArray(page)) throw new Error('Invalid notification page');
			collected.push(...page.filter((n) => !collected.some((c) => c.id === n.id)));
			if (page.length < 100) break;
			const cursor = page.at(-1)?.id;
			if (!cursor || seen.has(cursor)) throw new Error('Incomplete notification page');
			seen.add(cursor);
			untilId = cursor;
		}
		items.value = collected;
		return true;
	} catch {
		error.value = noticeCopy.loadFailed;
		return false;
	} finally {
		loading.value = false;
	}
}

async function markAllRead() {
	if (!active || loading.value || markingRead.value) return;
	markingRead.value = true;
	error.value = '';
	try {
		await misskeyApi('hata/hatady/notifications/mark-all-read', {});
		for (const n of items.value) n.isRead = true;
		emit('read', true);
	} catch {
		error.value = noticeCopy.readFailed;
	} finally {
		markingRead.value = false;
	}
}

async function markLoadedRead() {
	if (!active || markingRead.value) return;
	const ids = items.value.filter(n => !n.isRead).map(n => n.id);
	if (ids.length === 0) { emit('read'); return; }
	markingRead.value = true;
	try {
		for (let index = 0; index < ids.length && active; index += 100) {
			const batch = ids.slice(index, index + 100);
			await misskeyApi('hata/hatady/notifications/mark-as-read', { notificationIds: batch });
			const acknowledged = new Set(batch);
			for (const item of items.value) if (acknowledged.has(item.id)) item.isRead = true;
		}
		if (active) emit('read');
	} catch {
		error.value = noticeCopy.readFailed;
	} finally {
		markingRead.value = false;
	}
}

function onClickNotif(n: any) {
	const mediaWorkId = n.mediaWorkId ?? mediaWork(n)?.id;
	if (n.mediaSessionId) emit('openSession', n.mediaSessionId, mediaWorkId);
	else if (mediaWorkId) emit('openMedia', mediaWorkId);
	else if (n.logId) emit('openLog', n.logId);
	else if (n.type === 'follow' && n.user) emit('openProfile', n.user.id);
}

// フォロー通知からその場でフォロー返し / 解除。楽観的に更新し、状態はサーバーにも保存される。
async function toggleFollowBack(n: any) {
	if (!n.user) return;
	const uname = n.user.name || n.user.username;
	const { canceled } = await dialogs.confirm({
		type: n.isFollowingBack ? 'warning' : 'question',
		text: n.isFollowingBack ? copyx.unfollowConfirm({ name: uname }) : copyx.followConfirm({ name: uname }),
	});
	if (canceled) return;
	n.busy = true;
	try {
		const next = !n.isFollowingBack;
		await misskeyApi(next ? 'hata/hatady/following/create' : 'hata/hatady/following/delete', { userId: n.user.id });
		n.isFollowingBack = next;
	} catch {
		error.value = i18n.ts._hata._hatady._profileView.followFailed;
	} finally {
		n.busy = false;
	}
}

const busy = ref(false),
	error = ref(''),
	deletingIds = ref<string[] | null>(null),
	undoIds = ref<string[]>([]);
let oldScroll = 0;

function askDelete() {
	if (busy.value) return;
	oldScroll = dialog.value?.bodyEl?.scrollTop || 0;
	deletingIds.value = items.value.map((n) => n.id);
	error.value = '';
}

function cancelDelete() {
	deletingIds.value = null;
	error.value = '';
	void nextTick(() => {
		if (dialog.value?.bodyEl) dialog.value.bodyEl.scrollTop = oldScroll;
	});
}

function closeOrCancel() {
	if (deletingIds.value) cancelDelete();
	else {
		active = false;
		dialog.value?.close();
	}
}

async function confirmDelete() {
	if (busy.value || !deletingIds.value) return;
	busy.value = true;
	error.value = '';
	const ids = [...deletingIds.value];
	try {
		for (let i = 0; i < ids.length; i += 100) {
			const batch = ids.slice(i, i + 100);
			await (misskeyApi as any)('hata/hatady/notifications/delete', { notificationIds: batch });
			items.value = items.value.filter((n) => !batch.includes(n.id));
			undoIds.value = [...new Set([...undoIds.value, ...batch])];
			deletingIds.value = deletingIds.value.filter((id) => !batch.includes(id));
		}
		deletingIds.value = null;
		emit('read');
		hatadyNotify(noticeCopy.deleted);
	} catch {
		error.value = noticeCopy.deleteRemainingFailed;
		emit('read');
	} finally {
		busy.value = false;
	}
}

async function undoDelete() {
	if (busy.value) return;
	busy.value = true;
	error.value = '';
	const ids = [...undoIds.value];
	try {
		for (let i = 0; i < ids.length; i += 100) {
			const batch = ids.slice(i, i + 100);
			await (misskeyApi as any)('hata/hatady/notifications/restore', { notificationIds: batch });
			undoIds.value = undoIds.value.filter((id) => !batch.includes(id));
		}
		await reload();
		emit('read');
		hatadyNotify(noticeCopy.restored);
	} catch {
		error.value = noticeCopy.restoreRemainingFailed;
		await reload();
		emit('read');
	} finally {
		busy.value = false;
	}
}

onMounted(async () => {
	if (!(await reload())) return;
	// Wait until the loaded list is rendered, and never acknowledge a popup
	// that was closed while its notifications were still loading.
	await nextTick();
	if (!active) return;
	await markLoadedRead();
});
onBeforeUnmount(() => { active = false; });
</script>

<style lang="scss" module>
.body {
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	min-height: 100%;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}
.filters {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 0 0 8px;
}
.readAll {
	margin-left: auto;
	min-height: 44px;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	background: none;
	border: none;
	color: var(--hy-body);
	font-size: 12px;
	cursor: pointer;
}
.readAll:hover {
	color: var(--hy-accent);
}

.list {
	flex: 1;
	overflow-y: auto;
	padding: 6px 12px 14px;
}
.loading {
	opacity: 0.6;
	padding: 30px 0;
	text-align: center;
}
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	padding: 48px 20px;
	text-align: center;
	color: var(--hy-muted);
}
.emptyIcon {
	font-size: 2.2rem;
	color: var(--hy-accent);
	opacity: 0.5;
}
.groupHead {
	font-size: 11px;
	font-weight: 700;
	color: var(--hy-muted);
	padding: 10px 8px 6px;
}

.notif {
	display: flex;
	gap: 12px;
	align-items: flex-start;
	position: relative;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 11px;
	padding: 12px 14px;
	margin-bottom: 8px;
}
.clickable {
	cursor: pointer;
	transition: border-color 0.12s;
}
.clickable:hover {
	border-color: var(--hy-accent);
}
.unread {
	background: color-mix(in srgb, var(--hy-accent) 7%, var(--hy-surface));
}
.dot {
	position: absolute;
	left: 5px;
	top: 50%;
	transform: translateY(-50%);
	width: 6px;
	height: 6px;
	border-radius: 999px;
	background: var(--hy-accent);
}

.avatarWrap {
	position: relative;
	flex-shrink: 0;
	width: 36px;
	height: 36px;
}
.avatar {
	width: 36px;
	height: 36px;
}
.badgeReaction,
.badgeComment,
.badgeFollow {
	position: absolute;
	bottom: -5px;
	right: -5px;
	z-index: 3;
	width: 20px;
	height: 20px;
	border-radius: 999px;
	border: 2px solid var(--hy-surface);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	overflow: hidden;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.badgeReaction {
	background: var(--hy-chip-bg);
	font-size: 12px;
}
/* 横長のカスタム絵文字がバッジからはみ出て「バー」に見えるのを防ぐ(枠に収める)。 */
.badgeReaction img {
	max-width: 15px;
	max-height: 15px;
	height: auto;
	width: auto;
	object-fit: contain;
}
.inlineReaction {
	display: inline-flex;
	align-items: center;
	vertical-align: -0.25em;
	margin-left: 4px;
}
img.inlineReaction,
.inlineReaction img {
	height: 1.3em;
	max-height: 1.3em;
	width: auto;
	max-width: 6em;
	object-fit: contain;
}
.badgeComment {
	background: #e3ebf3;
	color: #45688f;
}
.badgeFollow {
	background: #dcecd5;
	color: #4e7d4a;
}
.milestoneIcon {
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	border-radius: 999px;
	background: linear-gradient(135deg, #e79b5e, #d9824a);
	color: #fff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 19px;
}
.goalIcon {
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	border-radius: 999px;
	background: linear-gradient(135deg, #8a7ab3, #6b5a94);
	color: #fff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 19px;
}

.content {
	flex: 1;
	min-width: 0;
}
.text {
	font-size: 13px;
	line-height: 1.6;
	color: var(--hy-ink);
}
.who {
	font-family: var(--hy-heading);
}
.streakVal {
	font-family: var(--hy-heading);
	color: var(--hy-accent-ink);
}
.snippet {
	font-size: 12px;
	color: var(--hy-muted);
	margin-top: 2px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.mediaTarget {
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
	margin-top: 2px;
	font-size: 12px;
	color: var(--hy-muted);
}
.mediaTarget i {
	color: var(--hy-accent-ink);
	flex-shrink: 0;
}
.mediaTarget span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.bubble {
	font-size: 12px;
	color: var(--hy-body);
	margin-top: 4px;
	background: var(--hy-surface-2);
	border-radius: 7px;
	padding: 5px 9px;
	display: inline-block;
	max-width: 100%;
	word-break: break-word;
}
.right {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
	flex-shrink: 0;
}
.time {
	font-size: 11px;
	color: var(--hy-muted);
	white-space: nowrap;
	flex-shrink: 0;
}
.followBtn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border-radius: 999px;
	padding: 5px 12px;
	font-size: 11.5px;
	font-weight: 700;
	font-family: var(--hy-heading);
	cursor: pointer;
	white-space: nowrap;
	border: 1.5px solid var(--hy-accent);
	background: var(--hy-accent);
	color: #fff;
}
.followingBtn {
	background: transparent;
	color: var(--hy-accent-ink);
}
.followBtn:disabled {
	opacity: 0.6;
}

.body {
	padding: 0;
	min-height: 0;
	background: var(--hy-surface);
}
.filters {
	gap: 5px;
	flex-wrap: wrap;
}
.filter {
	min-height: 40px;
	border-radius: 999px;
}
.readAll {
	margin-left: auto;
	min-height: 44px;
}
.notif {
	border-radius: 18px;
	padding: 14px 8px;
}
.confirm {
	text-align: center;
	line-height: 1.8;
	padding: 20px 0;
}
.confirm > div {
	display: flex;
	justify-content: center;
	gap: 10px;
	margin-top: 20px;
}
.undo {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
}
.avatar {
	width: 36px;
	height: 36px;
}
.text {
	font-size: 13px;
}
.bubble {
	font-size: 13px;
}
.empty {
	padding: 30px 12px;
}
</style>
