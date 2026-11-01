<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="hatady-scope hatafeed-scope" :class="$style.root" :data-hatady-theme="hataFeedTheme">
	<HataFeedLeaves v-if="leavesEnabled"/>
	<div :class="$style.page">
		<HataFeedHeader
			v-if="canAccess && !embedded" :tab="issueId ? 'issues' : activeTab" :projectName="currentProject?.name ?? 'Hataskey'" :staff="isStaff" :unread="unreadCount" :refreshing="refreshing" :onDark="hataFeedTheme === 'dark' || hataFeedTheme === 'espresso'"
			@navigate="navigateTab" @create="handleCreate" @project="openProjectSwitch" @notifications="openNotifications" @refresh="refreshAll" @settings="openDisplaySettings()" @exit="exitHataFeed"
		/>
		<div v-if="loading" class="hf-empty"><HataAppLoading app="hatafeed" :size="36" :monochrome="hataFeedTheme === 'dark' || hataFeedTheme === 'espresso'" :active="!embedded || paneActive" :label="pageCopy.loading"/></div>
		<div v-else-if="error" class="hf-empty" role="alert">{{ error }}<button type="button" class="hy-secondary" @click="error = ''; init()">{{ pageCopy.reload }}</button></div>
		<p v-else-if="!canAccess" class="hf-empty">{{ pageCopy.unavailable }}</p>
		<HataFeedIssue v-else-if="issueId" :key="issueId" ref="issueView" :issueId="issueId" :isStaff="isStaff" @back="goList" @changed="onIssueChanged"/>
		<main v-else :class="$style.main">
			<HataFeedHome
				v-if="activeTab === 'home'" :isStaff="isStaff" :roadmap="roadmap" :ownEmojiRequests="ownEmojiRequests" :emojiRequests="emojiRequests" :emojiChangeRequests="emojiChangeRequests" :emojiQuota="emojiQuota" :activity="activity" :issues="issues" :issuesHasNext="issuesHasNext" :loading="issuePageLoading" :active="!embedded || paneActive" :monochrome="hataFeedTheme === 'dark' || hataFeedTheme === 'espresso'"
				@issue="openIssue" @navigate="navigateTab" @approve="openApprove" @addRoadmap="addRoadmap" @ownHistory="openOwnHistory" @reviewQueue="openReviewQueue" @changed="loadEmojiRequests"
			/>
			<HataFeedBeta v-if="activeTab === 'beta'" @createIssue="createIssue"/>
			<div v-if="activeTab === 'emoji' && isStaff" class="hf-panel" :class="$style.emojiAdmin">
				<div :class="$style.eaKindTabs" role="group" :aria-label="pageCopy.requestType">
					<button type="button" :class="$style.eaKindTab" :aria-pressed="emojiAdminKind === 'add'" @click="emojiAdminKind = 'add'">{{ pageCopy.newAddition }}</button>
					<button type="button" :class="$style.eaKindTab" :aria-pressed="emojiAdminKind === 'change'" @click="emojiAdminKind = 'change'">{{ pageCopy.imageUpdateWithdraw }}</button>
				</div>
				<HataFeedEmojiChangeList v-if="emojiAdminKind === 'change'" ref="changeList" isStaff :showTitle="false" @changed="loadEmojiRequests"/>
				<template v-else>
					<div :class="$style.eaTop">
						<div :class="$style.eaFilters">
							<button v-for="f in emojiAdminFilters" :key="String(f.value)" :class="$style.eaFilter" :aria-pressed="emojiAdminStatus === f.value" @click="setEmojiAdminStatus(f.value)">{{ f.label }}</button>
						</div>
						<div :class="$style.eaTopActions">
							<button type="button" :class="$style.eaRequestOwn" @click="requestEmoji"><i class="ti ti-mood-plus"></i> {{ copy.requestEmojiForSelf }}</button>
							<button v-if="emojiAdminStatus === 'pending' && emojiAdminList.length" type="button" :class="$style.eaBatch" @click="openReviewQueue"><i class="ti ti-player-track-next"></i> {{ copy.reviewPendingSequentially }}</button>
						</div>
					</div>
					<div v-if="emojiAdminList.length === 0" :class="$style.emptyBlock">
						<i class="ti ti-mood-empty" :class="$style.emptyBlockIcon"></i>
						<div>{{ emojiAdminStatus === 'pending' ? copy.noPendingRequests : copy.noMatchingRequests }}</div>
					</div>
					<div v-else :class="$style.eaList">
						<div v-for="r in emojiAdminList" :key="r.id" :class="$style.eaRow">
							<span :class="$style.eaTile"><img v-if="r.imageUrl" :src="r.imageUrl" :class="$style.eaImg" :alt="r.name"/></span>
							<div :class="$style.eaInfo">
								<div :class="$style.eaName">:{{ r.name }}:</div>
								<div :class="$style.eaMeta">
									<HfAvatar v-if="r.requestedBy" :user="r.requestedBy" :size="16"/>
									<span>{{ r.requestedBy?.name ?? r.requestedBy?.username }}</span>
									・ <MkTime :time="r.createdAt" mode="relative"/>
									・ {{ r.sourceType === 'remote' ? (r.remoteHost ? copyx.remoteSource({ host: r.remoteHost }) : copy.remote) : copy.ownSource }}
								</div>
								<div v-if="r.resolvedComment" :class="$style.eaResolution"><i class="ti ti-message-circle"></i><span><strong>{{ copy.resolutionReason }}</strong> {{ r.resolvedComment }}</span></div>
							</div>
							<div :class="$style.eaAction">
								<button v-if="r.status === 'pending' || r.status === 'held'" :class="$style.eaReview" @click="openApprove(r)"><i class="ti ti-eye"></i> {{ copy.review }}</button>
								<span v-else :class="['ti', emojiStatusIcon[r.status] ?? '', 'hfEstIcon']" :data-est="r.status" :title="emojiStatusLabel[r.status]"></span>
							</div>
						</div>
					</div>
					<div v-if="emojiAdminPage > 0 || emojiAdminHasNext" :class="$style.pager">
						<button :class="$style.pagerArrow" :disabled="emojiAdminPage === 0" @click="prevEmojiAdminPage"><i class="ti ti-chevron-left"></i> {{ copy.previous }}</button>
						<span :class="$style.pagerPage">{{ emojiAdminPage + 1 }}</span>
						<button :class="$style.pagerArrow" :disabled="!emojiAdminHasNext" @click="nextEmojiAdminPage">{{ copy.next }} <i class="ti ti-chevron-right"></i></button>
					</div>
				</template>
			</div>
			<section v-if="activeTab === 'issues' || activeTab === 'roadmap'" class="hf-panel" :class="$style.statusBar" :aria-label="pageCopy.responseStatus">
				<h2>{{ pageCopy.responseStatus }}<small v-if="statusCounts">{{ i18n.tsx._hata._hatafeed._page.totalCount({ count: String(statusCounts.total) }) }}</small></h2>
				<button v-for="status in (['open', 'inProgress', 'resolved'] as const)" :key="status" type="button" :class="$style.stat" :aria-pressed="filterStatus === status" @click="applyStatus(status)"><b>{{ statusCounts?.[status] ?? '-' }}</b><span>{{ statusLabel[status] }}</span></button>
			</section>
			<section v-if="activeTab === 'issues' || activeTab === 'roadmap'" class="hf-panel" :class="$style.listPanel" :aria-busy="issuePageLoading">
				<header :class="$style.listHead" :data-roadmap-actions="activeTab === 'roadmap' && isStaff">
					<h2>{{ activeTab === 'roadmap' ? copy.roadmap : copy.issues }}<small :title="pageCopy.loadedCount">{{ issues.length }}{{ issuesHasNext ? '+' : '' }}</small></h2>
					<button v-if="activeTab === 'roadmap' && isStaff" type="button" class="hy-secondary hf-roadmap-add" @click="addRoadmap"><i class="ti ti-plus" aria-hidden="true"></i>{{ pageCopy.addPlan }}</button>
					<form :class="$style.search" role="search" @submit.prevent="reloadIssues"><i class="ti ti-search" aria-hidden="true"></i><input v-model="searchQuery" type="search" :aria-label="copy.searchPlaceholder" :placeholder="copy.searchPlaceholder"><button type="submit" class="hf-icon" :aria-label="pageCopy.search"><i class="ti ti-arrow-right" aria-hidden="true"></i></button></form>
				</header>
				<div v-if="!embedded || activeTab === 'issues'" :class="$style.filters"><div :class="$style.segment"><button type="button" :aria-pressed="!includeClosed" @click="setClosed(false)">{{ pageCopy.excludeClosed }}</button><button type="button" :aria-pressed="includeClosed" @click="setClosed(true)">{{ pageCopy.includeClosed }}</button></div><div :class="$style.dropdowns"><button type="button" @click="openCategoryMenu">{{ filterCategory ? categoryLabel[filterCategory] : copy.category }}<i class="ti ti-chevron-down"></i></button><button type="button" @click="openStatusMenu">{{ filterStatus ? statusLabel[filterStatus] : copy.status }}<i class="ti ti-chevron-down"></i></button><button type="button" @click="openAuthorMenu">{{ authorFilter ? (authorFilter.name ?? authorFilter.username) : copy.author }}<i class="ti ti-chevron-down"></i></button></div></div>
				<Transition name="hf-goes-filter"><div v-if="embedded && filterSheetOpen" class="hf-goes-filter-backdrop" @click.self="filterSheetOpen = false"><section ref="filterSheetEl" class="hf-goes-filter-sheet" role="dialog" aria-modal="true" aria-label="絞り込み" @keydown.tab="trapFilterSheetTab" @keydown.esc.stop.prevent="filterSheetOpen = false"><header><strong>絞り込み</strong><button type="button" :aria-label="i18n.ts.close" @click="filterSheetOpen = false"><i class="ti ti-x" aria-hidden="true"></i></button></header><fieldset><legend>{{ copy.category }}</legend><button type="button" :aria-pressed="filterCategory == null" @click="chooseCategory(null)">{{ copy.allCategories }}</button><button v-for="category in filterCategoryKeys" :key="category" type="button" :aria-pressed="filterCategory === category" @click="chooseCategory(category)">{{ categoryLabel[category] }}</button></fieldset><fieldset><legend>{{ copy.status }}</legend><button type="button" :aria-pressed="filterStatus == null" @click="chooseStatus(null)">{{ copy.allStatuses }}</button><button v-for="status in statusKeys" :key="status" type="button" :aria-pressed="filterStatus === status" @click="chooseStatus(status)">{{ statusLabel[status] }}</button></fieldset><fieldset><legend>{{ copy.author }}</legend><button type="button" @click="pickAuthor">{{ authorFilter ? (authorFilter.name ?? authorFilter.username) : copy.author }}</button><button v-if="authorFilter" type="button" @click="authorFilter = null; reloadIssues()">{{ copy.clearAuthorFilter }}</button></fieldset><fieldset><legend>{{ pageCopy.includeClosed }}</legend><button type="button" :aria-pressed="!includeClosed" @click="setClosed(false)">{{ pageCopy.excludeClosed }}</button><button type="button" :aria-pressed="includeClosed" @click="setClosed(true)">{{ pageCopy.includeClosed }}</button></fieldset><button type="button" class="hf-goes-filter-done" @click="filterSheetOpen = false">{{ i18n.ts.close }}</button></section></div></Transition>
				<div v-if="!visibleIssues.length" class="hf-empty"><p>{{ activeTab === 'roadmap' ? copy.noPublishedPlans : pageCopy.noIssues }}</p></div>
				<div v-else ref="issueListEl" :class="$style.listCard">
					<button
						v-for="issue in visibleIssues"
						:key="issue.id"
						:class="$style.issueRow" :data-pinned="issue.pinned" :data-closed="issue.closed"
						@click="openIssue(issue.id)"
					>
						<i v-if="issue.pinned" class="ti ti-pin" :class="$style.rowPin"></i>
						<HfStatusPill v-else :status="issue.status" variant="text" iconOnly :class="$style.rowStatusIcon"/>
						<div :class="$style.rowMain">
							<div :class="$style.rowTitleLine">
								<span :class="$style.rowTitle">{{ issue.title }}</span>
								<HfCategoryBadge :category="issue.category"/>
							</div>
							<div :class="$style.rowMeta">
								<span :class="$style.rowNo">#{{ issue.number }}</span>
								<template v-if="issue.createdBy">・ <MkUserName :class="$style.rowAuthor" :user="issue.createdBy"/>{{ copy.createdAtBefore }}<MkTime :time="issue.createdAt" mode="relative"/>{{ copy.createdAtAfter }}</template>
								・ <HfStatusPill :status="issue.status" variant="text" :showIcon="false" :class="$style.rowStatusText"/>
								<template v-if="issue.assignees && issue.assignees.length"> ・ <i class="ti ti-shield-check" :class="$style.rowAssigneeIcon"></i> <MkUserName :class="$style.rowAuthor" :user="issue.assignees[0]"/>{{ copy.assigneeSuffix }}</template>
							</div>
						</div>
						<div :class="$style.rowSide">
							<span :class="$style.rowStat"><i class="ti ti-message-2"></i> {{ issue.commentsCount }}</span>
							<span :class="$style.rowStat"><i class="ti ti-heart"></i> {{ issue.agreementsCount }}</span>
							<HfAvatar v-if="issue.createdBy" :user="issue.createdBy" :size="22"/>
						</div>
					</button>
				</div>

				<!-- ページ式ナビ -->
				<div v-if="visibleIssues.length > 0 || issuePage > 0" :class="$style.pager">
					<button :class="$style.pagerArrow" :disabled="issuePageLoading || issuePage === 0" @click="prevIssuePage"><i class="ti ti-chevron-left"></i> {{ copy.previous }}</button>
					<span :class="$style.pagerPage">{{ issuePage + 1 }}</span>
					<button :class="$style.pagerArrow" :disabled="issuePageLoading || !issuesHasNext" @click="nextIssuePage">{{ copy.next }} <i class="ti ti-chevron-right"></i></button>
					<label :class="$style.pagerSize">
						<select v-model.number="issuePageSize" :class="$style.pagerSelect" @change="reloadIssues">
							<option :value="10">{{ copyx.itemCount({ count: '10' }) }}</option>
							<option :value="50">{{ copyx.itemCount({ count: '50' }) }}</option>
							<option :value="100">{{ copyx.itemCount({ count: '100' }) }}</option>
						</select>
					</label>
				</div>
			</section>
		</main>
	</div>
</div>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { computed, inject, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { HataFeedEmojiRequest, HataFeedEmojiChangeRequest } from '@/utility/hatafeed.js';
import type { HataFeedTab } from '@/utility/hatafeed-ui.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { HATAGOES_CATALOG } from '@/utility/hatagoes-catalog.js';
import { recordHatagoesScreenUsage } from '@/utility/hatagoes-launcher-usage.js';
import HataFeedEmojiChangeList from '@/components/HataFeedEmojiChangeList.vue';
import { openHataFeedEmojiNotification } from '@/utility/hatafeed-emoji-notification.js';
import HataFeedHeader from '@/components/HataFeedHeader.vue';
import HataAppLoading from '@/components/HataAppLoading.vue';
import HataFeedBeta from '@/components/HataFeedBeta.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify, hataFeedProjectId, hataFeedTab } from '@/utility/hatafeed-ui.js';
import '@/components/hatafeed-ui.css';
import HataFeedIssue from '@/components/HataFeedIssue.vue';
import HataFeedLeaves from '@/components/HataFeedLeaves.vue';
import HfStatusPill from '@/components/HfStatusPill.vue';
import HfCategoryBadge from '@/components/HfCategoryBadge.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import HataFeedHome from '@/components/HataFeedHome.vue';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { useHataGoesPopup, useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { useHataMascotSuppression } from '@/utility/hata-mascot-suppression.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchHataFeedIssuePage } from '@/utility/hatafeed-issue-page.js';
import { showHataFeedTutorial } from '@/utility/hatafeed-tutorial-launcher.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { DI } from '@/di.js';
import { prefer } from '@/preferences.js';
import {
	categoryLabel, categoryKeys, staffOnlyCategoryKeys, statusLabel, statusKeys, emojiStatusLabel, emojiStatusIcon,
	hataFeedUnreadCount,
} from '@/utility/hatafeed.js';
import { $i, iAmModerator } from '@/i.js';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();
const popupMenu = useHataGoesPopupMenu();

const props = withDefaults(defineProps<{ issueId?: string; number?: string; initialTab?: HataFeedTab; emojiRequestId?: string; emojiChangeRequestId?: string; embedded?: boolean; requestedTab?: string; paneActive?: boolean }>(), { issueId: undefined, number: undefined, initialTab: undefined, emojiRequestId: undefined, emojiChangeRequestId: undefined, embedded: false, requestedTab: undefined, paneActive: true });
useHataMascotSuppression(computed(() => !props.embedded || props.paneActive));
const emit = defineEmits<{ exit: []; tabChange: [tab: string]; appearanceChange: [appearance: { theme: string; projectName?: string; cssVars?: Record<string, string> }] }>();
const hataGoesHost = inject(HATA_GOES_HOST, null);
const dialogs = useHataGoesDialogs();
const { selectUser } = useHataGoesPickers();
const copy = i18n.ts._hata._hatafeed._home;
const copyx = i18n.tsx._hata._hatafeed._home;
const pageCopy = i18n.ts._hata._hatafeed._page;

// 旗鯖fork: スタッフ専用カテゴリ(security等)は一般ユーザーの絞り込みから隠す。
const filterCategoryKeys = computed(() => categoryKeys.filter(c => iAmModerator || !staffOnlyCategoryKeys.some(staffOnly => staffOnly === c)));
const router = useRouter();
const closePageWindow = inject(DI.pageWindowClose, null);

function exitHataFeed() {
	if (props.embedded) { emit('exit'); return; }
	if (closePageWindow) closePageWindow();
	else router.push('/');
}

// 旗鯖fork: 「#番号」リンク(/hatafeed/n/:number)から来た場合、番号→idを解決して該当イシューへ。
async function resolveNumber() {
	const requestedNumber = props.number;
	try {
		const res = await misskeyApi('hata/feedback/issues/show', { number: parseInt(requestedNumber as string, 10) });
		if (props.number !== requestedNumber) return;
		router.replace('/hatafeed/:issueId', { params: { issueId: res.issue.id } });
	} catch {
		if (props.number !== requestedNumber) return;
		router.replace('/hatafeed');
	}
}

const loading = ref(true);
const canAccess = ref(false);
const isStaff = ref(false);
const refreshing = ref(false);

const projects = ref<any[]>([]);
const currentProjectId = hataFeedProjectId;

const issues = ref<any[]>([]);
// 旗鯖fork: ページ式ページネーション(最大表示数 10/50/100・最下部の＜＞で前後ページ)。
const issuePageSize = ref(10);
const issuePage = ref(0);
const issueCursors = ref<(string | undefined)[]>([undefined]); // cursors[i] = page i を取得する untilId
const issuesHasNext = ref(false);
const issuePageLoading = ref(false);
let issuePageRequestId = 0;
const issueListEl = ref<HTMLElement | null>(null);
const issueView = ref<InstanceType<typeof HataFeedIssue> | null>(null);
const roadmap = ref<any[]>([]);
const filterCategory = ref<string | null>(null);
const filterStatus = ref<string | null>(null);
// 旗鯖fork(2a): 作成者フィルタ(選択中のユーザー)。null = 全員。
const authorFilter = ref<any>(null);
const includeClosed = ref(false);
const searchQuery = ref('');
const filterSheetOpen = ref(false);
const filterSheetEl = ref<HTMLElement | null>(null);
const filterEntry = ref<HTMLButtonElement | null>(null);
watch(filterSheetOpen, async open => {
	await nextTick();
	if (open) filterSheetEl.value?.querySelector<HTMLButtonElement>('button')?.focus();
	else filterEntry.value?.focus();
});

function trapFilterSheetTab(event: KeyboardEvent) {
	const buttons = [...(filterSheetEl.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
	if (!buttons.length) return;
	const first = buttons[0], last = buttons[buttons.length - 1];
	if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
}

// 旗鯖fork: バッジは共有の状態を見る(標準通知から既読にしたときも消えるように)。
const unreadCount = hataFeedUnreadCount;
const emojiRequests = ref<HataFeedEmojiRequest[]>([]);
const emojiChangeRequests = ref<HataFeedEmojiChangeRequest[]>([]);
const emojiAdminKind = ref<'add' | 'change'>('add');
const changeList = useTemplateRef('changeList');
const emojiQuota = ref<{ limit: number; remaining: number } | null>(null);

const issueId = computed(() => props.issueId ?? null);
const ownProjects = computed(() => projects.value.filter(p => !p.isOfficial));
// 公式は API の projectId=null に対応するレコードの表示情報を使う。
const currentProject = computed(() => projects.value.find(p => currentProjectId.value == null ? p.isOfficial : p.id === currentProjectId.value) ?? null);

// 旗鯖fork(2a/3a): アクティブなタブ。'issues'/'roadmap' はイシュー一覧のフィルタ違い、
// 'emoji' はスタッフ専用の絵文字申請管理ビュー(本体を差し替える)。
const activeTab = ref<HataFeedTab>(props.initialTab ?? hataFeedTab.value);
watch(activeTab, tab => { if (tab !== 'beta') hataFeedTab.value = tab; }, { flush: 'sync' });
const hataFeedUsageScreenIds: Partial<Record<HataFeedTab, string>> = {
	home: 'hatafeed.home', issues: 'hatafeed.issues', roadmap: 'hatafeed.roadmap', beta: 'hatafeed.beta', emoji: 'hatafeed.emoji',
};
watch([activeTab, canAccess, isStaff], ([tab, allowed, staff]) => {
	if (!allowed || props.embedded) return;
	const screenId = hataFeedUsageScreenIds[tab];
	if (!screenId) return;
	const available = HATAGOES_CATALOG.filter(screen => screen.app === 'hatafeed' && (screen.access !== 'hatafeedStaff' || staff));
	recordHatagoesScreenUsage($i?.id, screenId, available);
}, { immediate: true });
// RouterView caches both URLs. A cached beta page may have last navigated away
// through the admin tab; restore the tab belonging to the activated URL.
onActivated(() => {
	tutorialActive = !props.embedded || props.paneActive;
	if (props.embedded && loading.value) return;
	const tab = props.embedded ? embeddedTab() : props.initialTab === 'beta' ? 'beta' : hataFeedTab.value;
	if (activeTab.value !== tab) selectTab(tab);
	if (canAccess.value && !loading.value) refreshProjects();
	maybeShowTutorial();
});

// 旗鯖fork(3a): 対応状況の件数。表示中ページではなく、状態以外の絞り込みが同じ全件を数える
// (状態で絞り込んでも他の数値が変わらず、一覧の件数とも一致するように)。
const statusCounts = ref<Misskey.entities.HataFeedbackIssuesStatusCountsResponse | null>(null);
let statusCountsRequestId = 0;
// 旗鯖fork: 若葉アニメの表示可否(アクセシビリティ設定・既定OFF)。
const leavesEnabled = computed(() => prefer.r['hatafeed.leaves'].value && prefer.r.animation.value);

const visibleIssues = computed(() => activeTab.value === 'home' ? issues.value.slice(0, 3) : issues.value);
const ownEmojiRequests = ref<HataFeedEmojiRequest[]>([]);
const error = ref('');

let tutorialActive = !props.embedded || props.paneActive;
let stopTutorial: (() => void) | undefined;

async function maybeShowTutorial() {
	if (!tutorialActive || loading.value || !canAccess.value || error.value || issueId.value || props.number) return;
	const hasExistingActivity = ownEmojiRequests.value.length > 0 || issues.value.some(issue => issue.createdBy?.id === $i?.id) || projects.value.some(project => project.ownerId === $i?.id);
	const stop = await showHataFeedTutorial({ isActive: () => tutorialActive && !issueId.value, isStaff: isStaff.value, hasExistingActivity, popup });
	if (!stop) return;
	if (tutorialActive) stopTutorial = stop;
	else stop?.();
}

function stopOwnedTutorial() { tutorialActive = false; stopTutorial?.(); }

onDeactivated(stopOwnedTutorial);
onUnmounted(stopOwnedTutorial);

// ライブアクティビティ: 直近のイシュー・絵文字申請を時系列でマージ。
const activity = computed(() => {
	const items: any[] = [];
	for (const i of issues.value) {
		if (!i.closed) {
			if (!i.createdBy) continue;
			items.push({ key: 'i' + i.id, type: 'issue', issueId: i.id, user: i.createdBy, time: i.createdAt, verb: copy.activityCreatedIssue, label: i.title });
		} else {
			// クローズ済みは「立てました」ではなく「クローズしました」として、どのイシューが閉じたかを明記する。
			items.push({ key: 'c' + i.id, type: 'issueClosed', issueId: i.id, user: i.closedBy ?? null, time: i.closedAt ?? i.createdAt, verb: copy.activityClosedIssue, label: i.title });
		}
	}
	for (const r of emojiRequests.value) {
		if (!r.requestedBy) continue;
		items.push({ key: 'e' + r.id, type: 'emoji', request: r, user: r.requestedBy, time: r.createdAt, verb: copy.activityRequestedEmoji, label: ':' + r.name + ':', image: r.imageUrl });
	}
	return items.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 10);
});

async function init() {
	loading.value = true;
	try {
		const av = await misskeyApi('hata/feedback/available', {});
		canAccess.value = av.available;
		isStaff.value = av.isStaff;
		if (!canAccess.value) return;
		await loadProjects();
		if (currentProjectId.value && !projects.value.some(project => project.id === currentProjectId.value)) currentProjectId.value = null;
		if (activeTab.value === 'emoji' && !isStaff.value) activeTab.value = 'home';
		if (activeTab.value === 'roadmap') filterCategory.value = 'improvement';
		await Promise.all([reloadIssues(), loadRoadmap(), loadNotifications(), loadEmojiRequests(), ...(activeTab.value === 'emoji' ? [reloadEmojiAdmin()] : [])]);
	} catch {
		error.value = pageCopy.loadError;
	} finally {
		loading.value = false;
	}
	maybeShowTutorial();
}

async function loadProjects() {
	projects.value = await misskeyApi('hata/feedback/projects', {});
}

async function refreshProjects() {
	try {
		await loadProjects();
		if (currentProjectId.value && !projects.value.some(project => project.id === currentProjectId.value)) selectProject(null);
	} catch {
		hataFeedNotify(pageCopy.projectsLoadError);
	}
}

// 旗鯖fork: 指定カーソル(untilId)から1ページ分取得する。
async function fetchIssuePage(untilId: string | undefined) {
	const requestId = ++issuePageRequestId;
	issuePageLoading.value = true;
	try {
		const result = await fetchHataFeedIssuePage(
			params => misskeyApi('hata/feedback/issues', params) as Promise<{ id: string }[]>,
			{
				projectId: currentProjectId.value,
				category: filterCategory.value,
				status: filterStatus.value,
				createdById: authorFilter.value?.id ?? null,
				query: searchQuery.value.trim() || null,
				includeClosed: includeClosed.value,
			},
			issuePageSize.value,
			untilId,
		);
		if (requestId !== issuePageRequestId) return null;
		issues.value = result.issues;
		issuesHasNext.value = result.hasNext;
		return result;
	} catch (error) {
		if (requestId === issuePageRequestId) {
			console.error(error);
			dialogs.alert({ type: 'error', text: i18n.ts.somethingHappened });
		}
		return null;
	} finally {
		if (requestId === issuePageRequestId) issuePageLoading.value = false;
	}
}

async function loadStatusCounts() {
	const requestId = ++statusCountsRequestId;
	try {
		const result = await misskeyApi('hata/feedback/issues/status-counts', {
			projectId: currentProjectId.value,
			category: filterCategory.value,
			createdById: authorFilter.value?.id ?? null,
			query: searchQuery.value.trim() || null,
			includeClosed: includeClosed.value,
		});
		if (requestId === statusCountsRequestId) statusCounts.value = result;
	} catch (error) {
		// 件数は補助表示なので、取得できなくても一覧は使えるようにする。
		console.error(error);
		if (requestId === statusCountsRequestId) statusCounts.value = null;
	}
}

// フィルタ変更・表示数変更時は1ページ目から取り直す。
async function reloadIssues() {
	loadStatusCounts();
	if (!await fetchIssuePage(undefined)) return false;
	issuePage.value = 0;
	issueCursors.value = [undefined];
	return true;
}

async function nextIssuePage() {
	if (issuePageLoading.value || !issuesHasNext.value) return;
	const lastId = issues.value[issues.value.length - 1]?.id;
	if (lastId == null || !await fetchIssuePage(lastId)) return;
	issuePage.value += 1;
	issueCursors.value[issuePage.value] = lastId;
	scrollIssueListTop();
}

async function prevIssuePage() {
	if (issuePageLoading.value || issuePage.value === 0) return;
	const previousPage = issuePage.value - 1;
	if (!await fetchIssuePage(issueCursors.value[previousPage])) return;
	issuePage.value = previousPage;
	scrollIssueListTop();
}

function scrollIssueListTop() {
	issueListEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ロードマップ = 公式の「改善予定(improvement)」イシュー。
async function loadRoadmap() {
	roadmap.value = await misskeyApi('hata/feedback/issues', { projectId: null, category: 'improvement', includeClosed: false, limit: 12 });
}

// 旗鯖fork(2a/3a): ツールバー/フィルタのメニュー・トグル群。
async function openProjectSwitch(ev: MouseEvent) {
	if (props.embedded) {
		const component = (await import('@/components/HataFeedProjectSheet.vue')).default;
		const { dispose } = popup(component, {
			title: 'プロジェクト', currentId: currentProjectId.value,
			projects: [
				{ id: null, name: projects.value.find(project => project.isOfficial)?.name ?? 'Hataskey', icon: 'ti ti-flag-2' },
				...ownProjects.value.map(project => ({ id: project.id, name: project.name + (project.suspended ? copy.suspendedSuffix : ''), icon: project.suspended ? 'ti ti-player-pause' : 'ti ti-cube' })),
			],
		}, { select: selectProject, overview: () => { void showProjectOverview(currentProject.value ?? { name: 'Hataskey' }); }, closed: () => dispose() });
		return;
	}
	const items: any[] = [
		{ text: projects.value.find(p => p.isOfficial)?.name ?? 'Hataskey', icon: 'ti ti-flag-2', active: currentProjectId.value == null, action: () => selectProject(null) },
		...ownProjects.value.map(p => ({
			text: p.name + (p.suspended ? copy.suspendedSuffix : ''),
			icon: p.suspended ? 'ti ti-player-pause' : 'ti ti-cube',
			active: currentProjectId.value === p.id,
			action: () => selectProject(p.id),
		})),
	];
	items.push(null, { text: copy.overview, icon: 'ti ti-info-circle', action: () => showProjectOverview(currentProject.value ?? { name: 'Hataskey' }) });
	popupMenu(items, (ev.currentTarget ?? ev.target) as HTMLElement);
}

function openCategoryMenu(ev: MouseEvent) {
	if (props.embedded) { filterSheetOpen.value = true; return; }
	popupMenu([
		{ text: copy.allCategories, active: filterCategory.value == null, action: () => { filterCategory.value = null; reloadIssues(); } },
		...filterCategoryKeys.value.map(c => ({ text: categoryLabel[c], active: filterCategory.value === c, action: () => { filterCategory.value = c; reloadIssues(); } })),
	], (ev.currentTarget ?? ev.target) as HTMLElement);
}

function openStatusMenu(ev: MouseEvent) {
	if (props.embedded) { filterSheetOpen.value = true; return; }
	popupMenu([
		{ text: copy.allStatuses, active: filterStatus.value == null, action: () => { filterStatus.value = null; reloadIssues(); } },
		...statusKeys.map(s => ({ text: statusLabel[s], active: filterStatus.value === s, action: () => { filterStatus.value = s; reloadIssues(); } })),
	], (ev.currentTarget ?? ev.target) as HTMLElement);
}

// 旗鯖fork(2a): 作成者で絞り込む。ユーザー選択ダイアログで作成者を指定/解除する。
async function openAuthorMenu(ev: MouseEvent) {
	if (props.embedded) { filterSheetOpen.value = true; return; }
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	if (authorFilter.value) {
		popupMenu([
			{ text: copyx.filteringByAuthor({ name: authorFilter.value.name ?? authorFilter.value.username }), icon: 'ti ti-user', action: () => {} },
			{ type: 'divider' },
			{ text: copy.clearAuthorFilter, icon: 'ti ti-x', action: () => { authorFilter.value = null; reloadIssues(); } },
			{ text: copy.chooseDifferentAuthor, icon: 'ti ti-user-search', action: () => pickAuthor() },
		], anchor);
	} else {
		pickAuthor();
	}
}

function chooseCategory(value: string | null) {
	if (filterCategory.value === value) return;
	filterCategory.value = value;
	reloadIssues();
}

function chooseStatus(value: string | null) {
	if (filterStatus.value === value) return;
	filterStatus.value = value;
	reloadIssues();
}

async function pickAuthor() {
	const user = await selectUser({});
	if (!user) return;
	authorFilter.value = user;
	reloadIssues();
}

function setClosed(v: boolean) {
	if (includeClosed.value === v) return;
	includeClosed.value = v;
	reloadIssues();
}

// 3a 集計チップからのステータス絞り込み。もう一度押すと解除する。
// 解決済みは受付終了(closed)とは別状態なので、「受付終了も含む」の選択は変えない。
function applyStatus(s: string) {
	filterStatus.value = filterStatus.value === s ? null : s;
	reloadIssues();
}

// タブ: イシュー(改善予定の絞りを解除して全体へ)。
function goIssuesTab() {
	activeTab.value = 'issues';
	if (filterCategory.value === 'improvement') { filterCategory.value = null; reloadIssues(); }
}

// タブ: ロードマップ(= improvement カテゴリの一覧を本体に出す)。
function goRoadmapTab() {
	activeTab.value = 'roadmap';
	if (filterCategory.value !== 'improvement') { filterCategory.value = 'improvement'; reloadIssues(); }
}

// タブ: 絵文字申請管理(スタッフ専用・2g)。本体を申請一覧の管理ビューに差し替える。
function goEmojiAdminTab() {
	activeTab.value = 'emoji';
	reloadEmojiAdmin();
}

// ===== 旗鯖fork(2g): 絵文字申請管理 =====
const EMOJI_ADMIN_PAGE_SIZE = 15;
const emojiAdminList = ref<HataFeedEmojiRequest[]>([]);
const emojiAdminStatus = ref<HataFeedEmojiRequest['status'] | null>('pending'); // 既定は「未処理」から確認できるように。
const emojiAdminPage = ref(0);
const emojiAdminCursors = ref<(string | undefined)[]>([undefined]);
const emojiAdminHasNext = ref(false);
const emojiAdminFilters: { value: HataFeedEmojiRequest['status'] | null; label: string }[] = [
	{ value: 'pending', label: emojiStatusLabel.pending },
	{ value: 'held', label: emojiStatusLabel.held },
	{ value: 'approved', label: emojiStatusLabel.approved },
	{ value: 'rejected', label: emojiStatusLabel.rejected },
	{ value: null, label: copy.all },
];

async function fetchEmojiAdminPage(untilId: string | undefined) {
	const res = await misskeyApi('hata/feedback/emoji-requests', {
		status: emojiAdminStatus.value ?? undefined,
		limit: EMOJI_ADMIN_PAGE_SIZE + 1,
		untilId,
	}) as unknown as HataFeedEmojiRequest[];
	emojiAdminHasNext.value = res.length > EMOJI_ADMIN_PAGE_SIZE;
	emojiAdminList.value = res.slice(0, EMOJI_ADMIN_PAGE_SIZE);
}

async function reloadEmojiAdmin() {
	emojiAdminPage.value = 0;
	emojiAdminCursors.value = [undefined];
	await fetchEmojiAdminPage(undefined);
	await changeList.value?.reload();
}

function setEmojiAdminStatus(s: HataFeedEmojiRequest['status'] | null) {
	if (emojiAdminStatus.value === s) return;
	emojiAdminStatus.value = s;
	reloadEmojiAdmin();
}

async function nextEmojiAdminPage() {
	if (!emojiAdminHasNext.value) return;
	const lastId = emojiAdminList.value[emojiAdminList.value.length - 1]?.id;
	emojiAdminPage.value += 1;
	emojiAdminCursors.value[emojiAdminPage.value] = lastId;
	await fetchEmojiAdminPage(lastId);
}

async function prevEmojiAdminPage() {
	if (emojiAdminPage.value === 0) return;
	emojiAdminPage.value -= 1;
	await fetchEmojiAdminPage(emojiAdminCursors.value[emojiAdminPage.value]);
}

// 旗鯖fork: 未読件数のみ取得(ツールバーのベルのバッジ用)。通知一覧・フィルタ・
//   ページ送りは HataFeedNotifications パネル側が担う。
async function loadNotifications() {
	const res = await misskeyApi('hata/feedback/notifications', { limit: 1 });
	unreadCount.value = res.unreadCount;
}

// ツールバーのベル: 通知パネル(種類フィルタ + 前後ページ送り付き)を開く。
//   PC/タブレットではベルにアンカーした吹き出し(popup)、スマホでは全画面寄りの
//   ドロワー(drawer)に MkModal 側が自動で切り替える(anchorElement を渡すのが肝)。
async function openNotifications(event: MouseEvent) {
	// currentTarget is cleared as soon as dispatch ends, before the import resolves.
	const anchorElement = event.currentTarget as HTMLElement;
	const { dispose } = popup((await import('@/components/HataFeedNotifications.vue')).default, {
		anchorElement,
	}, {
		read: (count: number) => { unreadCount.value = count; },
		closed: () => { loadNotifications(); dispose(); },
	});
}

async function loadEmojiRequests() {
	const [own, pending, changes] = await Promise.all([
		misskeyApi('hata/feedback/emoji-requests', { mine: true, limit: 20 }),
		isStaff.value ? misskeyApi('hata/feedback/emoji-requests', { status: 'pending', limit: 20 }) : Promise.resolve([]),
		isStaff.value ? misskeyApi('hata/feedback/emoji-change-requests', { status: 'pending', limit: 20 }) : Promise.resolve([]),
	]);
	ownEmojiRequests.value = own as unknown as HataFeedEmojiRequest[];
	emojiRequests.value = isStaff.value ? pending as unknown as HataFeedEmojiRequest[] : ownEmojiRequests.value;
	emojiChangeRequests.value = changes as unknown as HataFeedEmojiChangeRequest[];
	emojiQuota.value = await misskeyApi('hata/feedback/emoji-quota', {}).catch(() => null);
}

function selectProject(id: string | null) {
	currentProjectId.value = id;
	if (issueId.value) { activeTab.value = 'home'; router.push('/hatafeed'); }
	reloadIssues();
}

function openIssue(id: string) {
	router.push('/hatafeed/:issueId', { params: { issueId: id } });
}

function openBeta() {
	activeTab.value = 'beta';
	if (props.initialTab !== 'beta') router.push('/hatafeed/beta');
}

function goList() { navigateTab('issues'); }

function onIssueChanged() {
	if (props.embedded) hataGoesHost?.changed();
}

async function createIssue() { await createIssueWithSignal(); }

async function createIssueWithSignal(signal?: AbortSignal) {
	if (signal?.aborted) return;
	const component = (await import('@/components/HataFeedIssueWizard.vue')).default;
	if (signal?.aborted) return;
	const { dispose } = popup(component, {
		projectId: currentProjectId.value,
		projects: projects.value,
	}, {
		done: () => { reloadIssues(); if (props.embedded) hataGoesHost?.changed(); },
		closed: () => dispose(),
	});
}

async function requestEmoji() { await requestEmojiWithSignal(); }

async function requestEmojiWithSignal(signal?: AbortSignal) {
	if (signal?.aborted) return;
	const component = (await import('@/components/HataFeedEmojiWizard.vue')).default;
	if (signal?.aborted) return;
	const { dispose } = popup(component, { isStaff: isStaff.value }, {
		done: () => { loadEmojiRequests(); if (props.embedded) hataGoesHost?.changed(); },
		closed: () => dispose(),
	});
}

async function openApprove(r: any) {
	const { dispose } = popup((await import('@/components/HataFeedEmojiApprove.vue')).default, { req: r }, {
		done: () => { loadEmojiRequests(); if (activeTab.value === 'emoji') reloadEmojiAdmin(); },
		closed: () => dispose(),
	});
}

// 旗鯖fork: 未処理申請を最大100件まで取得し、1件ずつ内容を確認しながら連続処理する。
// 一括承認は行わず、各操作は既存のスタッフ専用 approve/reject API を順番に呼ぶ。
async function openReviewQueue() {
	const pending = await misskeyApi('hata/feedback/emoji-requests', { status: 'pending', limit: 100 }) as unknown as HataFeedEmojiRequest[];
	if (pending.length === 0) {
		hataFeedNotify(copy.noPendingRequests);
		await loadEmojiRequests();
		if (activeTab.value === 'emoji') await reloadEmojiAdmin();
		return;
	}
	const { dispose } = popup((await import('@/components/HataFeedEmojiApprove.vue')).default, { requests: pending }, {
		done: () => { loadEmojiRequests(); if (activeTab.value === 'emoji') reloadEmojiAdmin(); },
		closed: () => { loadEmojiRequests(); if (activeTab.value === 'emoji') reloadEmojiAdmin(); dispose(); },
	});
}

// 旗鯖fork: プロジェクトの概要(タイトル/ジャンル/説明/リポジトリURL)を表示する。
async function showProjectOverview(project: any) {
	const lines: string[] = [];
	if (project.genre) lines.push(copyx.genreValue({ genre: project.genre }));
	if (project.description) lines.push(project.description);
	if (project.url) lines.push(copyx.repositoryValue({ url: project.url }));
	if (lines.length === 0) lines.push(copy.noProjectDescription);
	if (props.embedded) {
		const { dispose } = popup((await import('@/components/HataFeedProjectSheet.vue')).default, { title: project.name, lines }, { closed: () => dispose() });
		return;
	}
	dialogs.alert({
		type: 'info',
		title: project.name,
		text: lines.join('\n\n'),
	});
}

// スタッフ: 近々の修正・改善予定を掲示する。ロードマップ専用の作成画面(ウィザード)を開く。
async function addRoadmap() {
	const { dispose } = popup((await import('@/components/HataFeedRoadmapWizard.vue')).default, {}, {
		done: () => { loadRoadmap(); if (filterCategory.value === 'improvement') reloadIssues(); if (props.embedded) hataGoesHost?.changed(); },
		closed: () => dispose(),
	});
}

watch(() => props.issueId, (v, old) => {
	if (old != null && v == null) { reloadIssues(); loadRoadmap(); loadNotifications(); maybeShowTutorial(); }
});
watch(() => props.number, (number, previous) => {
	if (number && number !== previous) void resolveNumber();
});

onMounted(() => {
	if (props.number) { void resolveNumber(); if (!props.embedded) return; }
	init().then(() => {
		if (props.embedded) selectTab(embeddedTab());
		openLinkedEmojiRequest();
	});
});

function openLinkedEmojiRequest() {
	if (canAccess.value && (props.emojiRequestId || props.emojiChangeRequestId)) openHataFeedEmojiNotification(props, loadEmojiRequests, popup);
}

watch([() => props.emojiRequestId, () => props.emojiChangeRequestId], openLinkedEmojiRequest);

// 旗鯖fork(2a): 更新はツールバーの更新アイコンから。MkPageHeader の actions 帯は
// リポジトリUIのツールバーと機能が重複し、下の UI に覆いかぶさって邪魔なため廃止した。
async function refreshAll() {
	if (refreshing.value) return;
	refreshing.value = true;
	const results = await Promise.allSettled([reloadIssues(), loadRoadmap(), loadNotifications(), loadEmojiRequests(),
																																											...(activeTab.value === 'emoji' && isStaff.value ? [reloadEmojiAdmin()] : []),
																																											...(issueView.value ? [issueView.value.reload()] : []),
	]);
	if (results.some(result => result.status === 'rejected') || (results[0].status === 'fulfilled' && results[0].value === false)) hataFeedNotify(pageCopy.refreshPartial);
	else hataFeedNotify(pageCopy.refreshed);
	refreshing.value = false;
}

definePage(() => ({
	title: 'HataFeed',
	icon: 'ti ti-message-report',
	hataApp: 'hatafeed',
}));

function navigateTab(tab: HataFeedTab) {
	if (tab === 'emoji' && !isStaff.value) return;
	if (tab === 'beta') { openBeta(); return; }
	selectTab(tab);
	if (issueId.value || props.initialTab === 'beta') router.push('/hatafeed');
}

function selectTab(tab: HataFeedTab) {
	if (props.embedded && tab === activeTab.value) return;
	if (tab === 'beta') { activeTab.value = 'beta'; return; }
	if (tab === 'issues') goIssuesTab();
	else if (tab === 'roadmap') goRoadmapTab();
	else if (tab === 'emoji') goEmojiAdminTab();
	else {
		activeTab.value = 'home';
		filterCategory.value = null;
		filterStatus.value = null;
		authorFilter.value = null;
		searchQuery.value = '';
		includeClosed.value = false;
		reloadIssues();
	}
}

function handleCreate(kind: 'emoji' | 'issue') {
	if (kind === 'emoji') requestEmoji();
	else createIssue();
}

async function openDisplaySettings(initialSection?: string) {
	const { dispose } = popup((await import('@/components/HataFeedDisplaySettings.vue')).default, { initialSection }, { projectsChanged: refreshProjects, closed: () => dispose() });
}

async function openOwnHistory() {
	const { dispose } = popup((await import('@/components/HataFeedEmojiHistory.vue')).default, {}, { changed: loadEmojiRequests, closed: () => { loadEmojiRequests(); dispose(); } });
}

function embeddedTab(): HataFeedTab {
	const tab = props.requestedTab;
	return tab === 'home' || tab === 'issues' || tab === 'roadmap' || tab === 'beta' || (tab === 'emoji' && isStaff.value) ? tab : 'home';
}

watch(() => props.requestedTab, () => {
	if (props.embedded && !loading.value && canAccess.value) selectTab(embeddedTab());
});
watch(activeTab, tab => { if (props.embedded && props.paneActive && tab !== embeddedTab()) emit('tabChange', tab); });
watch([hataFeedTheme, currentProject], ([theme, project]) => { if (props.embedded) emit('appearanceChange', { theme, projectName: project?.name ?? 'Hataskey' }); }, { immediate: true });
watch(() => props.paneActive, active => {
	if (!props.embedded) return;
	if (!active) stopOwnedTutorial();
	else { tutorialActive = true; void loadNotifications(); void maybeShowTutorial(); }
});
let goesOwnerDisposed = false;
const goesReadyWaiters = new Set<() => void>();

watch(loading, pending => {
	if (!pending) { for (const resolve of goesReadyWaiters) resolve(); goesReadyWaiters.clear(); }
});

async function waitForGoesOwner(signal?: AbortSignal): Promise<boolean> {
	if (loading.value && !goesOwnerDisposed) await new Promise<void>(resolve => goesReadyWaiters.add(resolve));
	if (goesOwnerDisposed || signal?.aborted) return false;
	if (!canAccess.value || error.value) { await dialogs.alert({ type: 'error', text: error.value || pageCopy.unavailable }); return false; }
	return true;
}

onUnmounted(() => {
	goesOwnerDisposed = true;
	for (const resolve of goesReadyWaiters) resolve();
	goesReadyWaiters.clear();
});
// eslint-disable-next-line vue/no-setup-props-reactivity-loss -- The owner registration is fixed for this mounted pane.
const unregisterHataGoes = props.embedded ? hataGoesHost?.register('hatafeed', {
	openSettings: openDisplaySettings,
	async openProjectSwitch(event) {
		// currentTarget is cleared once event dispatch ends; retain the anchor before waiting.
		const anchor = (event.currentTarget ?? event.target) as HTMLElement;
		if (!await waitForGoesOwner() || !props.paneActive) return;
		await openProjectSwitch({ currentTarget: anchor, target: anchor } as unknown as MouseEvent);
	},
	async create(kind, signal?: AbortSignal) {
		if (signal?.aborted || !await waitForGoesOwner(signal) || signal?.aborted) return;
		if (kind === 'emoji') await requestEmojiWithSignal(signal);
		else await createIssueWithSignal(signal);
	},
	refresh: refreshAll,
	async openResult(kind, id) {
		if (!await waitForGoesOwner() || !props.paneActive) return;
		if (kind === 'issue') openIssue(id);
		else if (kind === 'emojiRequest') await openHataFeedEmojiNotification({ emojiRequestId: id }, loadEmojiRequests, popup);
		else if (kind === 'emojiChangeRequest') await openHataFeedEmojiNotification({ emojiChangeRequestId: id }, loadEmojiRequests, popup);
		else if (kind === 'project') {
			await refreshProjects();
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The active pane can change while refreshProjects awaits.
			if (!props.paneActive) return;
			const project = projects.value.find(item => item.id === id);
			if (!project) { await dialogs.alert({ type: 'error', text: 'このプロジェクトは見つからないか、表示できません。' }); return; }
			selectProject(project.isOfficial ? null : project.id);
			navigateTab('issues');
		} else await dialogs.alert({ type: 'error', text: 'この検索結果の詳細を表示できません。' });
	},
}) : undefined;
onUnmounted(() => unregisterHataGoes?.());

</script>

<style module src="../components/hatafeed-page.module.css"></style>

<style scoped>
.hf-goes-filter-entry { display:flex; align-items:center; gap:8px; margin:12px 0; padding:10px 14px; border:1px solid var(--MI_THEME-divider); border-radius:14px; background:var(--MI_THEME-panel); color:inherit; cursor:pointer; }
.hf-goes-filter-backdrop { position:fixed; inset:0; z-index:10000; display:flex; align-items:end; justify-content:center; background:rgba(0,0,0,.38); }
.hf-goes-filter-sheet { box-sizing:border-box; width:min(100%,560px); max-height:min(86dvh,780px); overflow:auto; padding:18px 20px 24px; border-radius:24px 24px 0 0; background:var(--MI_THEME-panel); color:var(--MI_THEME-fg); box-shadow:0 -18px 50px rgba(0,0,0,.2); }
.hf-goes-filter-sheet header { display:flex; justify-content:space-between; align-items:center; }
.hf-goes-filter-sheet fieldset { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0; padding:0; border:0; }
.hf-goes-filter-sheet legend { width:100%; margin-bottom:8px; font-weight:700; }
.hf-goes-filter-sheet button { padding:8px 12px; border:1px solid var(--MI_THEME-divider); border-radius:999px; background:transparent; color:inherit; cursor:pointer; }
.hf-goes-filter-sheet button[aria-pressed='true'] { border-color:var(--MI_THEME-accent); color:var(--MI_THEME-accent); }
.hf-goes-filter-sheet .hf-goes-filter-done { width:100%; border-color:var(--MI_THEME-accent); background:var(--MI_THEME-accent); color:var(--MI_THEME-fgOnAccent); }
.hf-goes-filter-enter-active, .hf-goes-filter-leave-active { transition:opacity 180ms ease; }
.hf-goes-filter-enter-active .hf-goes-filter-sheet, .hf-goes-filter-leave-active .hf-goes-filter-sheet { transition:transform 180ms ease; }
.hf-goes-filter-enter-from, .hf-goes-filter-leave-to { opacity:0; }
.hf-goes-filter-enter-from .hf-goes-filter-sheet, .hf-goes-filter-leave-to .hf-goes-filter-sheet { transform:translateY(16px); }
header[data-roadmap-actions='true'] { flex-wrap: wrap; }
header[data-roadmap-actions='true'] > form { margin-left: auto; }
.hf-roadmap-add { flex-shrink: 0; white-space: nowrap; }
.hfEstIcon[data-est="pending"] { color: var(--hy-accent); }
.hfEstIcon[data-est="held"] { color: #a36a24; }
.hfEstIcon[data-est="approved"] { color: var(--hy-accent); }
.hfEstIcon[data-est="rejected"] { color: var(--MI_THEME-error); }
</style>
