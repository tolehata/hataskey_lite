<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="welcome-app-block" data-welcome-app-preview>
	<div class="welcome-app-caption">HataFeed v3<span>ホーム・イシュー・ロードマップの見本</span></div><div class="welcome-app-frame welcome-hatafeed hatady-scope hatafeed-scope" :class="$style.root" :data-hatady-theme="hataFeedTheme">
		<div :class="$style.page" data-welcome-feed-page>
			<HataFeedHeader
				v-if="canAccess"
				preview :tab="issueId ? 'issues' : activeTab" :projectName="currentProject?.name ?? 'Hataskey'" :staff="isStaff" :unread="unreadCount" :refreshing="refreshing" :onDark="hataFeedTheme === 'dark'"
				@navigate="navigateTab" @create="handleCreate" @project="openProjectSwitch" @notifications="openNotifications" @refresh="refreshAll" @settings="openDisplaySettings" @exit="exitHataFeed"
			/><main :class="$style.main">
				<HataFeedHome
					v-if="activeTab === 'home'" :isStaff="isStaff" :roadmap="roadmap" :ownEmojiRequests="ownEmojiRequests" :emojiRequests="emojiRequests" :emojiQuota="emojiQuota" :activity="activity" :issues="issues" :issuesHasNext="issuesHasNext" :loading="issuePageLoading" :monochrome="hataFeedTheme === 'dark'"
					@issue="openIssue" @navigate="navigateTab" @approve="openApprove" @addRoadmap="addRoadmap" @ownHistory="openOwnHistory" @reviewQueue="openReviewQueue"
				/><section v-if="activeTab === 'issues' || activeTab === 'roadmap'" class="hf-panel" :class="$style.statusBar" aria-label="対応状況">
					<h2>対応状況<small>このページの {{ issues.length }} 件</small></h2>
					<button v-for="status in ['open', 'inProgress', 'resolved']" :key="status" type="button" :class="$style.stat" @click="applyStatus(status)"><b>{{ counts[status] }}</b><span>{{ statusLabel[status] }}</span></button>
				</section><section v-if="activeTab === 'issues' || activeTab === 'roadmap'" class="hf-panel" :class="$style.listPanel" :aria-busy="issuePageLoading">
					<header :class="$style.listHead">
						<h2>{{ activeTab === 'roadmap' ? 'ロードマップ' : 'イシュー' }}<small :title="'読み込み済みの件数'">{{ issues.length }}{{ issuesHasNext ? '+' : '' }}</small></h2>
						<form :class="$style.search" role="search" @submit.prevent><i class="ti ti-search" aria-hidden="true"></i><input v-model="searchQuery" type="search" aria-label="イシュー・会話を検索" placeholder="イシュー・会話を検索"><button type="submit" class="hf-icon" aria-label="検索"><i class="ti ti-arrow-right" aria-hidden="true"></i></button></form>
					</header>
					<div :class="$style.filters"><div :class="$style.segment"><button type="button" :aria-pressed="!includeClosed" @click="setClosed(false)">受付中</button><button type="button" :aria-pressed="includeClosed" @click="setClosed(true)">終了分も含む</button></div><div :class="$style.dropdowns"><button type="button" @click="openCategoryMenu">{{ filterCategory ? categoryLabel[filterCategory] : copy.category }}<i class="ti ti-chevron-down"></i></button><button type="button" @click="openStatusMenu">{{ filterStatus ? statusLabel[filterStatus] : copy.status }}<i class="ti ti-chevron-down"></i></button><button type="button" @click="openAuthorMenu">{{ copy.author }}<i class="ti ti-chevron-down"></i></button></div></div>
					<div v-if="!visibleIssues.length" class="hf-empty"><p>{{ activeTab === 'roadmap' ? copy.noPublishedPlans : 'イシューがありません' }}</p><button v-if="activeTab === 'roadmap' && isStaff" type="button" class="hy-secondary" @click="addRoadmap">改善予定を追加</button></div>
					<div v-else :class="$style.listCard">
						<button
							v-for="issue in visibleIssues"
							:key="issue.id"
							:class="$style.issueRow" :data-pinned="issue.pinned" :data-closed="issue.closed"
							@click="openIssue"
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
						<button :class="$style.pagerArrow" :disabled="issuePageLoading || issuePage === 0"><i class="ti ti-chevron-left"></i> {{ copy.previous }}</button>
						<span :class="$style.pagerPage">{{ issuePage + 1 }}</span>
						<button :class="$style.pagerArrow" :disabled="issuePageLoading || !issuesHasNext">{{ copy.next }} <i class="ti ti-chevron-right"></i></button>
						<label :class="$style.pagerSize">
							<select v-model.number="issuePageSize" :class="$style.pagerSelect">
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
</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HataFeedHomeIssue, HataFeedHomeActivity } from '@/utility/hatafeed-home.js';
import type { HataFeedTab } from '@/utility/hatafeed-ui.js';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import HataFeedHeader from '@/components/HataFeedHeader.vue';
import HataFeedHome from '@/components/HataFeedHome.vue';
import HfStatusPill from '@/components/HfStatusPill.vue';
import HfCategoryBadge from '@/components/HfCategoryBadge.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import { statusLabel, categoryLabel } from '@/utility/hatafeed.js';
import { i18n } from '@/i18n.js';
import { sampleUsers } from '@/utility/welcome-app-examples.js';
import '@/components/hatafeed-ui.css';
const props = defineProps<{ mode: 'light' | 'dark'; language: 'ja' | 'en' }>();
const emit = defineEmits<{ signin: [] }>();
const hataFeedTheme = computed(() => props.mode);

function signin() { emit('signin'); }

const copy = i18n.ts._hata._hatafeed._home, copyx = i18n.tsx._hata._hatafeed._home;
const activeTab = ref<HataFeedTab>('home'), searchQuery = ref(''), filterStatus = ref(''), includeClosed = ref(false);
const issueId = null, isStaff = false, canAccess = true, unreadCount = 2, refreshing = false, currentProject = { name: 'Hataskey' };
const filterCategory = '', issuePageLoading = false, issuesHasNext = false;
const allIssues: HataFeedHomeIssue[] = [
	{ id: 'issue-1', number: 32, title: 'ご意見・不具合報告はこちらへ', status: 'open', category: 'other', pinned: true, commentsCount: 8, agreementsCount: 5, closed: false, createdBy: sampleUsers[0], createdAt: new Date().toISOString() },
	{ id: 'issue-2', number: 35, title: '予定をもっと見つけやすくしたい', status: 'inProgress', category: 'featureRequest', commentsCount: 4, agreementsCount: 12, closed: false, createdBy: sampleUsers[1], createdAt: new Date().toISOString() },
	{ id: 'issue-3', number: 36, title: '記録を一覧で振り返りたい', status: 'planned', category: 'featureRequest', commentsCount: 3, agreementsCount: 7, closed: false, createdBy: sampleUsers[2], createdAt: new Date().toISOString() },
	{ id: 'issue-4', number: 31, title: '小さい画面でメニューが重なる', status: 'resolved', category: 'bug', commentsCount: 6, agreementsCount: 9, closed: true, createdBy: sampleUsers[3], createdAt: new Date().toISOString() },
];
const roadmap = allIssues.slice(1, 3);
const issues = computed(() => (activeTab.value === 'roadmap' ? roadmap : allIssues).filter(x => (includeClosed.value || !x.closed) && (!filterStatus.value || x.status === filterStatus.value) && x.title.includes(searchQuery.value.trim())));
const visibleIssues = computed(() => activeTab.value === 'home' ? issues.value.slice(0, 3) : issues.value);
const counts = computed(() => Object.fromEntries(['open', 'inProgress', 'resolved'].map(status => [status, issues.value.filter(x => x.status === status).length])));
const ownEmojiRequests: HataFeedEmojiRequest[] = [
	{ id: 'emoji-1', name: 'hatakyu_wave', imageUrl: '/client-assets/hatakyu/waving.png', status: 'approved', resolvedComment: '絵文字が追加されました' },
	{ id: 'emoji-2', name: 'hatakyu_heart', imageUrl: '/client-assets/hatakyu/heart-hands.png', status: 'pending', resolvedComment: null },
].map(request => ({ createdAt: new Date().toISOString(), requestedBy: sampleUsers[0], category: null, aliases: [], license: null, localOnly: true, isSensitive: false, sourceType: 'upload', originalUrl: null, remoteHost: null, resolvedById: null, resolvedAt: null, resolvedEmojiId: null, ...request, status: request.status as HataFeedEmojiRequest['status'] }));
const emojiQuota = { remaining: 3, limit: 5 };
const emojiRequests: HataFeedEmojiRequest[] = [];
const activity: HataFeedHomeActivity[] = [{ key: 'a-1', user: sampleUsers[1], verb: 'が予定を更新しました', label: '予定をもっと見つけやすくしたい', issueId: 'issue-2', time: new Date().toISOString() }, { key: 'a-2', user: sampleUsers[0], verb: 'の絵文字が追加されました', label: ':hatakyu_wave:', time: new Date().toISOString() }];

function navigateTab(tab: HataFeedTab) { if (tab === 'beta' || tab === 'emoji') return signin(); activeTab.value = tab; filterStatus.value = ''; searchQuery.value = ''; }

const openIssue = signin, handleCreate = signin, openOwnHistory = signin, openProjectSwitch = signin;
const openNotifications = signin, openDisplaySettings = signin, exitHataFeed = signin, openCategoryMenu = signin;
const openStatusMenu = () => { filterStatus.value = filterStatus.value ? '' : 'inProgress'; };
const openAuthorMenu = signin, refreshAll = signin;

function setClosed(value: boolean) { includeClosed.value = value; }

function applyStatus(status: string) { filterStatus.value = filterStatus.value === status ? '' : status; }

const issuePage = 0, issuePageSize = ref(10);
const addRoadmap = signin, openReviewQueue = signin, openApprove = signin;
</script>
<style module src="../components/hatafeed-page.module.css"></style>
