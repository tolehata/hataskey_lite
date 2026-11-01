<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed 2a/3a): 通知パネル。ツールバーのベルから開く。
  種類フィルタ(ソート)と前後ページ送り(< 〇 >)をこのパネルに集約。
  表示形態は MkModal が自動で切替える:
    - PC / タブレット → ベルにアンカーした吹き出し(popup、右上に出る)
    - スマホ        → 画面下からのドロワー(drawer、全画面寄り)
  anchorElement(ベル)を渡すのが肝。渡すことで touch スマホ以外は popup になる。
  popup は transparentBg で背後をぼかさず、HataFeedの内容を見比べられるようにする。
-->
<template>
<MkModal
	ref="modal"
	v-slot="{ type, maxHeight }"
	:zPriority="'middle'"
	:anchorElement="anchorElement"
	:anchor="{ x: 'right', y: 'bottom' }"
	:transparentBg="true"
	:disableBgBlur="true"
	@click="modal?.close()"
	@esc="onEscape"
	@closed="emit('closed')"
>
	<div
		class="_popup _shadow hatady-scope hatafeed-scope"
		:data-hatady-theme="hataFeedTheme"
		:class="$style.panel" :data-type="type" :data-hatagoes="!!hataGoes"
		:style="{ maxHeight: maxHeight ? maxHeight + 'px' : undefined, width: type === 'drawer' ? undefined : '360px' }"
	>
		<div :class="$style.header" :inert="!!hataGoes && filterOpen">
			<button v-if="hataGoes" type="button" :class="$style.goesBack" class="hf-icon" :aria-label="i18n.ts._hata._hatady._controls.back" @click="modal?.close()"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
			<span :class="$style.title"><i class="ti ti-bell"></i> {{ copy.title }}</span>
			<button type="button" class="hf-icon" :aria-label="copy.markRead" :title="copy.markRead" :disabled="!unreadCount || markingAll" @click="markAllRead"><i class="ti ti-checks" aria-hidden="true"></i></button>
			<button ref="filterButton" type="button" class="hf-icon" :aria-label="filter ? copyx.filterCurrent({ type: notifTypeLabel[filter] ?? filter }) : copy.filter" :title="copy.filter" :data-active="!!filter" :aria-expanded="filterOpen" :aria-controls="filterId" @click="filterOpen = !filterOpen"><i class="ti ti-filter" aria-hidden="true"></i></button>
			<button type="button" class="hf-icon" :class="$style.closeBtn" :aria-label="copy.close" @click="modal?.close()"><i class="ti ti-x" aria-hidden="true"></i></button>
		</div>
		<label v-if="filterOpen && !hataGoes" :id="filterId" :class="$style.bar"><span>{{ copy.filterType }}</span><select :value="filter ?? ''" @change="chooseFilter"><option value="">{{ copy.all }}</option><option v-for="(label, value) in notifTypeLabel" :key="value" :value="value">{{ label }}</option></select></label>
		<Transition name="hf-notif-filter"><div v-if="hataGoes && filterOpen" :id="filterId" class="hf-notif-filter-backdrop" @click.self="filterOpen = false"><section ref="filterSheet" class="hf-notif-filter-sheet" role="dialog" aria-modal="true" :aria-label="copy.filterType" @keydown.tab="trapFilterTab" @keydown.esc.stop.prevent="filterOpen = false"><header><strong>{{ copy.filterType }}</strong><button type="button" :aria-label="copy.close" @click="filterOpen = false"><i class="ti ti-x" aria-hidden="true"></i></button></header><button type="button" :aria-pressed="filter == null" @click="chooseFilterValue(null)">{{ copy.all }}</button><button v-for="(label, value) in notifTypeLabel" :key="value" type="button" :aria-pressed="filter === value" @click="chooseFilterValue(value)">{{ label }}</button></section></div></Transition>
		<p v-if="error" :class="$style.state" role="alert" :inert="!!hataGoes && filterOpen">{{ error }}<button type="button" class="hy-secondary" @click="reload">{{ copy.reload }}</button></p>

		<div v-if="loading" :class="$style.state" :inert="!!hataGoes && filterOpen">{{ copy.loading }}</div>
		<div v-else-if="items.length === 0" :class="$style.state" :inert="!!hataGoes && filterOpen">
			<i class="ti ti-bell-off" :class="$style.stateIcon"></i>
			<div>{{ filter ? copy.noNotificationsOfType : copy.noNotifications }}</div>
		</div>
		<div v-else :class="$style.list" :inert="!!hataGoes && filterOpen">
			<!-- 旗鯖fork(通知グルーピング): 本体 reaction:grouped の流儀で、同種・同一対象の通知を1行にまとめる。
			     count===1 は従来どおりの単一行。count>1 はまとめ行で、クリックで下に個別行を展開する。 -->
			<template v-for="g in groups" :key="g.key">
				<button
					:class="[$style.row, !g.isRead && $style.rowUnread, g.count > 1 && $style.groupRow]"
					@click="g.count > 1 ? toggle(g.key) : onClick(g.items[0])"
				>
					<i :class="['ti', notifIcon(g.type), $style.rowIcon]"></i>
					<div :class="$style.rowBody">
						<HataFeedNotificationBody :class="$style.rowMsg" :text="g.count > 1 ? groupSummary(g) : notificationDisplayMessage(g.items[0])"/>
						<div :class="$style.rowMeta">
							<template v-if="g.count > 1">
								<span :class="$style.avatars">
									<HfAvatar v-for="a in g.actors.slice(0, 3)" :key="a.id" :user="a" :size="16" :stack="true"/>
								</span>
								<span :class="$style.rowActor">{{ copyx.itemCount({ count: g.count.toString() }) }}</span>
							</template>
							<template v-else>
								<HfAvatar v-if="g.items[0].actor" :user="g.items[0].actor" :size="16"/>
								<span v-if="g.items[0].actor" :class="$style.rowActor">{{ g.items[0].actor.name ?? g.items[0].actor.username }}</span>
							</template>
							<MkTime :class="$style.rowTime" :time="g.createdAt" mode="relative"/>
							<i v-if="g.count > 1" class="ti" :class="[expanded.has(g.key) ? 'ti-chevron-up' : 'ti-chevron-down', $style.expandCaret]"></i>
						</div>
					</div>
				</button>
				<div v-if="g.count > 1 && expanded.has(g.key)" :class="$style.children">
					<button
						v-for="n in g.items"
						:key="n.id"
						:class="[$style.row, $style.childRow, !n.isRead && $style.rowUnread]"
						@click="onClick(n)"
					>
						<i :class="['ti', notifIcon(n.type), $style.rowIcon]"></i>
						<div :class="$style.rowBody">
							<HataFeedNotificationBody :class="$style.rowMsg" :text="notificationDisplayMessage(n)"/>
							<div :class="$style.rowMeta">
								<HfAvatar v-if="n.actor" :user="n.actor" :size="16"/>
								<span v-if="n.actor" :class="$style.rowActor">{{ n.actor.name ?? n.actor.username }}</span>
								<MkTime :class="$style.rowTime" :time="n.createdAt" mode="relative"/>
							</div>
						</div>
					</button>
				</div>
			</template>
		</div>

		<div v-if="page > 0 || hasNext" :class="$style.pager" :inert="!!hataGoes && filterOpen">
			<button :class="$style.pagerBtn" :disabled="loading || page === 0" :aria-label="copy.previousPage" @click="prevPage"><i class="ti ti-chevron-left"></i></button>
			<span :class="$style.pagerPage">{{ page + 1 }}</span>
			<button :class="$style.pagerBtn" :disabled="loading || !hasNext" :aria-label="copy.nextPage" @click="nextPage"><i class="ti ti-chevron-right"></i></button>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { inject, ref, computed, useId, useTemplateRef, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { openHataFeedEmojiNotification } from '@/utility/hatafeed-emoji-notification.js';
import '@/components/hatafeed-ui.css';
import type { HataFeedNotif } from '@/utility/hatafeed.js';
import MkModal from '@/components/MkModal.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import HataFeedNotificationBody from '@/components/HataFeedNotificationBody.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';
import { markHataFeedNotificationsRead, hataFeedUnreadCount, notifIcon, notifTypeLabel, groupHataFeedNotifications, groupSummary, notificationDisplayMessage } from '@/utility/hatafeed.js';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();
const hataGoes = inject(HATA_GOES_HOST, null);

defineProps<{ anchorElement?: HTMLElement | null }>();
const emit = defineEmits<{ (ev: 'closed'): void; (ev: 'read', unreadCount: number): void }>();
const modal = useTemplateRef('modal');
const router = useRouter();
const copy = i18n.ts._hata._hatafeed._notifications;
const copyx = i18n.tsx._hata._hatafeed._notifications;

const PAGE_SIZE = 8;
const items = ref<HataFeedNotif[]>([]);
const unreadCount = ref(0);
const loading = ref(true);
const markingAll = ref(false);
const filter = ref<string | null>(null);
const page = ref(0);
const cursors = ref<(string | undefined)[]>([undefined]); // cursors[i] = page i を取得する untilId
const hasNext = ref(false);
const nextCursor = ref<string>();
const filterOpen = ref(false);
const filterButton = useTemplateRef('filterButton');
const filterSheet = useTemplateRef('filterSheet');
const filterId = useId();
watch(filterOpen, async open => {
	if (!hataGoes) return;
	await nextTick();
	if (open) filterSheet.value?.querySelector<HTMLElement>('button')?.focus();
	else filterButton.value?.focus();
});

function trapFilterTab(event: KeyboardEvent) {
	const buttons = [...(filterSheet.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
	if (!buttons.length) return;
	const first = buttons[0], last = buttons[buttons.length - 1];
	if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
}

const error = ref('');
let generation = 0;
onUnmounted(() => { generation++; });

// 旗鯖fork(通知グルーピング): 取得済みの通知を同種・同一対象でまとめた表示単位。
const groups = computed(() => groupHataFeedNotifications(items.value));
// 旗鯖fork(通知グルーピング): 展開中のグループ key 集合(Set は再代入して反応させる)。
const expanded = ref<Set<string>>(new Set());

function toggle(key: string) {
	const next = new Set(expanded.value);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	expanded.value = next;
}

// A filtered page keeps a cursor into the original stream even when it has no matches.
async function fetchPage(targetPage: number, untilId: string | undefined) {
	const request = ++generation;
	const selectedType = filter.value;
	loading.value = true;
	try {
		const limit = selectedType ? 33 : PAGE_SIZE + 1;
		const result = await misskeyApi('hata/feedback/notifications', { limit, untilId });
		if (request !== generation) return;
		const raw = result.notifications as unknown as HataFeedNotif[];
		const matches = selectedType ? raw.filter(item => item.type === selectedType) : raw;
		items.value = matches.slice(0, PAGE_SIZE);
		hasNext.value = matches.length > PAGE_SIZE || raw.length === limit;
		nextCursor.value = matches.length > PAGE_SIZE ? items.value.at(-1)?.id : raw.at(-1)?.id;
		page.value = targetPage;
		cursors.value[targetPage] = untilId;
		unreadCount.value = result.unreadCount;
		hataFeedUnreadCount.value = result.unreadCount;
		expanded.value = new Set();
		error.value = '';
		if (result.unreadCount > 0) {
			await markHataFeedNotificationsRead();
			emit('read', hataFeedUnreadCount.value);
		}
	} catch { if (request === generation) error.value = copy.loadError; } finally { if (request === generation) loading.value = false; }
}

async function reload() { await fetchPage(0, undefined); }

async function nextPage() {
	if (loading.value || !hasNext.value || !nextCursor.value) return;
	await fetchPage(page.value + 1, nextCursor.value);
}

async function prevPage() {
	if (loading.value || page.value === 0) return;
	await fetchPage(page.value - 1, cursors.value[page.value - 1]);
}

function chooseFilter(event: Event) {
	chooseFilterValue((event.target as HTMLSelectElement).value || null);
}

function chooseFilterValue(value: string | null) {
	filter.value = value;
	filterOpen.value = false;
	filterButton.value?.focus();
	reload();
}

function onEscape(event: KeyboardEvent) {
	event.stopPropagation();
	if (filterOpen.value) { filterOpen.value = false; filterButton.value?.focus(); } else modal.value?.close();
}

async function markAllRead() {
	if (markingAll.value) return;
	markingAll.value = true;
	try {
		await misskeyApi('hata/feedback/notifications/read', {});
		unreadCount.value = 0;
		hataFeedUnreadCount.value = 0;
		items.value = items.value.map(n => ({ ...n, isRead: true }));
		emit('read', 0);
		hataFeedNotify(copy.markedAllRead);
	} catch {
		error.value = copy.markReadFailed;
	} finally {
		markingAll.value = false;
	}
}

const readingNotificationIds = new Set<string>();

async function markRead(n: HataFeedNotif) {
	if (n.isRead || readingNotificationIds.has(n.id)) return;
	readingNotificationIds.add(n.id);
	try {
		await misskeyApi('hata/feedback/notifications/read', { notificationId: n.id });
		items.value = items.value.map(item => item.id === n.id ? { ...item, isRead: true } : item);
		unreadCount.value = Math.max(0, unreadCount.value - 1);
		hataFeedUnreadCount.value = unreadCount.value;
		emit('read', unreadCount.value);
	} finally {
		readingNotificationIds.delete(n.id);
	}
}

async function onClick(n: HataFeedNotif) {
	try {
		await markRead(n);
	} catch {
		// 既読更新に失敗しても、通知先を読む動線は妨げない。
	}
	const feedbackId = n.feedbackId;
	if (typeof feedbackId === 'string') {
		router.push('/hatafeed/:issueId', { params: { issueId: feedbackId } });
		modal.value?.close();
	} else if (n.emojiRequestId || n.emojiChangeRequestId) {
		await openHataFeedEmojiNotification(n, undefined, popup);
	}
}

onMounted(reload);
</script>

<style lang="scss" module>
.panel { display: flex; flex-direction: column; max-width: calc(100dvw - 24px); overflow: hidden; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 24px; box-sizing: border-box; }
.panel[data-type='dialog'] { margin: auto; max-width: 100%; max-height: 100%; }
.panel[data-type='drawer'] { width: 100%; max-width: 100%; border-radius: 24px 24px 0 0; }
.header { display: flex; align-items: center; gap: 2px; padding: 14px 12px 10px; }
.title { display: inline-flex; align-items: center; gap: 8px; padding-left: 4px; font-weight: 700; }
.closeBtn { margin-left: auto; }
.bar { display: grid; gap: 6px; padding: 0 16px 12px; font-size: 12px; }
.bar select { min-height: 44px; padding: 10px 12px; border: 1px solid var(--hy-border); border-radius: 14px; color: inherit; background: var(--hy-surface); }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 0; opacity: .6; text-align: center; }
.stateIcon { font-size: 2rem; opacity: .5; }

.list { flex: 0 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 0 10px 6px; }
.row {
	display: flex; gap: 10px; align-items: flex-start;
	width: 100%; text-align: left; color: inherit; background: none; border: none;
	padding: 10px; border-radius: 10px; cursor: pointer;
	transition: background .12s;
}
.row:hover { background: var(--MI_THEME-bg); }
.rowUnread { background: color-mix(in srgb, var(--MI_THEME-accent) 8%, transparent); }
.rowIcon { font-size: 1.05rem; color: var(--MI_THEME-accent); margin-top: 2px; flex-shrink: 0; }
.rowBody { flex: 1; min-width: 0; }
.rowMsg { font-size: .86em; line-height: 1.5; }
.rowMeta { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.rowActor { font-size: .74em; opacity: .7; }
.rowTime { font-size: .72em; opacity: .5; margin-left: auto; }

/* 旗鯖fork(通知グルーピング): まとめ行。重ねアバター + 「N件」 + 展開キャレット。 */
.groupRow .rowMsg { font-weight: 700; }
.avatars { display: inline-flex; align-items: center; }
.expandCaret { font-size: .8em; opacity: .5; margin-left: 4px; }
/* 展開された個別行のコンテナ。左に軽いインデントと縦線で親子関係を示す。 */
.children {
	display: flex; flex-direction: column; gap: 4px;
	margin: 2px 0 4px 14px; padding-left: 8px;
	border-left: 2px solid var(--MI_THEME-divider);
}
.childRow { padding: 8px 10px; }
.childRow .rowMsg { font-size: .82em; opacity: .92; }

.pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 0 12px; }
.pagerBtn {
	width: 34px; height: 34px; border-radius: 999px;
	border: 1px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel); color: inherit; cursor: pointer;
	display: inline-flex; align-items: center; justify-content: center;
}
.pagerBtn:hover:not(:disabled) { border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }
.pagerBtn:disabled { opacity: .35; cursor: default; }
.pagerPage { min-width: 2em; text-align: center; font-weight: 700; }
.goesBack { display: none; }
@media (max-width: 700px) {
	.panel[data-hatagoes='true'] { position: fixed; inset: 0; width: 100dvw !important; height: 100dvh; max-width: none; max-height: none !important; border-radius: 0; border: 0; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
	.panel[data-hatagoes='true'] .list { flex: 1; }
	.goesBack { display: inline-flex; }
}

</style>

<style scoped>
.hf-notif-filter-backdrop { position:fixed; inset:0; z-index:100; display:flex; align-items:end; justify-content:center; background:rgba(0,0,0,.36); }
.hf-notif-filter-sheet { box-sizing:border-box; display:flex; flex-direction:column; gap:8px; width:min(100%,480px); max-height:75dvh; overflow:auto; padding:18px 20px max(20px,env(safe-area-inset-bottom)); border-radius:22px 22px 0 0; background:var(--MI_THEME-panel); color:var(--MI_THEME-fg); box-shadow:0 -12px 36px rgba(0,0,0,.2); }
.hf-notif-filter-sheet header { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
.hf-notif-filter-sheet button { padding:10px 12px; border:1px solid var(--MI_THEME-divider); border-radius:12px; background:transparent; color:inherit; text-align:start; cursor:pointer; }
.hf-notif-filter-sheet button[aria-pressed='true'] { border-color:var(--MI_THEME-accent); color:var(--MI_THEME-accent); }
.hf-notif-filter-enter-active, .hf-notif-filter-leave-active { transition:opacity 180ms ease; }
.hf-notif-filter-enter-active .hf-notif-filter-sheet, .hf-notif-filter-leave-active .hf-notif-filter-sheet { transition:transform 180ms ease; }
.hf-notif-filter-enter-from, .hf-notif-filter-leave-to { opacity:0; }
.hf-notif-filter-enter-from .hf-notif-filter-sheet, .hf-notif-filter-leave-to .hf-notif-filter-sheet { transform:translateY(14px); }
</style>
