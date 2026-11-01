<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.dashboard" :data-staff="isStaff">
	<section data-hatafeed-home-panel class="hf-panel" :class="$style.card">
		<header :class="$style.cardHead"><h2><i class="ti ti-route" aria-hidden="true"></i>近々の修正・改善予定</h2><button v-if="isStaff" type="button" class="hf-icon" aria-label="改善予定を追加" @click="emit('addRoadmap')"><i class="ti ti-plus" aria-hidden="true"></i></button></header>
		<p v-if="!roadmap.length" class="hf-empty">{{ copy.noPublishedPlans }}</p>
		<button v-for="plan in roadmap.slice(0, 2)" :key="plan.id" type="button" :class="$style.plan" @click="emit('issue', plan.id)"><HfStatusPill :status="plan.status" iconOnly/><span><strong>{{ plan.title }}</strong><small>{{ statusLabel[plan.status] }} · #{{ plan.number }}</small></span></button>
		<button type="button" :class="$style.textLink" @click="emit('navigate', 'roadmap')"><i class="ti ti-arrow-right" aria-hidden="true"></i>すべての予定</button>
	</section>
	<section data-hatafeed-home-panel class="hf-panel" :class="$style.card">
		<header :class="$style.cardHead"><h2><i class="ti ti-mood-smile" aria-hidden="true"></i>あなたの絵文字申請</h2></header>
		<p v-if="!ownEmojiRequests.length" class="hf-empty">{{ copy.noRequestsYet }}</p>
		<button v-for="request in ownEmojiRequests.slice(0, 3)" :key="request.id" type="button" :class="$style.ownRequest" @click="emit('ownHistory')">
			<span :class="$style.emojiTile"><img v-if="request.currentEmoji?.imageUrl || request.imageUrl" :src="request.currentEmoji?.imageUrl || request.imageUrl!" :alt="request.name"></span>
			<span><strong>:{{ request.currentEmoji?.name ?? request.name }}:</strong><small><span :class="$style.requestStatus" :data-status="request.status"><i :class="['ti', emojiStatusIcon[emojiRequestDisplayStatus(request)]]" aria-hidden="true"></i>{{ emojiStatusLabel[emojiRequestDisplayStatus(request)] }}</span><MkTime :time="request.createdAt" mode="relative"/></small><small v-if="activeEmojiChange(request)">{{ emojiChangeLabel[activeEmojiChange(request)!.kind] }}の確認待ち</small><small v-else-if="request.resolvedComment">{{ request.resolvedComment }}</small></span>
		</button>
		<button type="button" :class="$style.textLink" @click="emit('ownHistory')">自身の絵文字管理へ→</button>
		<div v-if="emojiQuota && !isStaff" :class="$style.quota"><HfQuotaMeter :remaining="emojiQuota.remaining" :limit="emojiQuota.limit"/></div>
	</section>
	<section v-if="isStaff" class="hf-panel" :class="$style.card">
		<header :class="$style.cardHead"><h2><i class="ti ti-mood-plus" aria-hidden="true"></i>確認待ちの絵文字</h2></header>
		<p v-if="!emojiRequests.length && !emojiChangeRequests?.length" class="hf-empty">{{ copy.noPendingRequests }}</p>
		<div v-else :class="$style.pending"><button v-for="request in emojiRequests.slice(0, 3)" :key="request.id" type="button" @click="emit('approve', request)"><img v-if="request.imageUrl" :src="request.imageUrl" :alt="request.name"><small>:{{ request.name }}:</small><small>{{ request.requestedBy?.name ?? request.requestedBy?.username }}</small></button></div>
		<div v-if="emojiChangeRequests?.length" :class="$style.pending"><button v-for="request in emojiChangeRequests.slice(0, 3)" :key="request.id" type="button" @click="openHataFeedEmojiNotification({ emojiChangeRequestId: request.id }, () => emit('changed'), popup)"><img :src="request.imageUrl ?? request.previousImageUrl" :alt="request.name"><small>:{{ request.name }}:</small><small>{{ emojiChangeLabel[request.kind] }}</small></button></div>
		<button v-if="emojiRequests.length" type="button" class="hy-secondary" :class="$style.reviewQueue" @click="emit('reviewQueue')"><i class="ti ti-checks" aria-hidden="true"></i>未処理を連続確認</button>
		<button type="button" :class="$style.textLink" @click="emit('navigate', 'emoji')"><i class="ti ti-arrow-right" aria-hidden="true"></i>申請管理</button>
	</section>
	<section data-hatafeed-home-panel class="hf-panel" :class="[$style.card, $style.activity]">
		<header :class="$style.cardHead"><h2><i class="ti ti-message-circle" aria-hidden="true"></i>最近の動き</h2></header>
		<p v-if="!activity.length" class="hf-empty">{{ copy.noActivityYet }}</p>
		<button v-for="entry in activity.slice(0, 3)" :key="entry.key" type="button" :class="$style.activityRow" @click="entry.issueId ? emit('issue', entry.issueId) : entry.request && isStaff ? emit('approve', entry.request) : emit('ownHistory')"><HfAvatar v-if="entry.user" :user="entry.user" :size="26"/><span><span><MkUserName v-if="entry.user" :user="entry.user"/>{{ entry.verb }}</span><small>{{ entry.label }}</small><small><MkTime :time="entry.time" mode="relative"/></small></span></button>
	</section>
</div>
<section data-hatafeed-home-panel class="hf-panel" :class="$style.listPanel" :aria-busy="loading">
	<header :class="$style.listHead"><h2>イシュー<small title="読み込み済みの件数">{{ issues.length }}{{ issuesHasNext ? '+' : '' }}</small></h2><button type="button" :class="$style.textLink" @click="emit('navigate', 'issues')"><i class="ti ti-arrow-right" aria-hidden="true"></i>一覧を見る</button></header>
	<div v-if="loading && !issues.length" class="hf-empty"><HataAppLoading app="hatafeed" :size="28" :active="active" :monochrome="monochrome" label="読み込み中"/></div>
	<div v-else-if="!issues.length" class="hf-empty">イシューがありません</div>
	<div v-else :class="$style.listCard">
		<button
			v-for="issue in issues.slice(0, 3)"
			:key="issue.id"
			:class="$style.issueRow" :data-pinned="issue.pinned" :data-closed="issue.closed"
			@click="emit('issue', issue.id)"
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
</section>
</template>
<script setup lang="ts">
import type { HataFeedHomeActivity, HataFeedHomeIssue } from '@/utility/hatafeed-home.js';
import type { HataFeedEmojiRequest, HataFeedEmojiChangeRequest } from '@/utility/hatafeed.js';
import type { HataFeedTab } from '@/utility/hatafeed-ui.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { openHataFeedEmojiNotification } from '@/utility/hatafeed-emoji-notification.js';
import HfStatusPill from '@/components/HfStatusPill.vue';
import HfCategoryBadge from '@/components/HfCategoryBadge.vue';
import HfAvatar from '@/components/HfAvatar.vue';
import HataAppLoading from '@/components/HataAppLoading.vue';
import HfQuotaMeter from '@/components/HfQuotaMeter.vue';
import { activeEmojiChange, emojiChangeLabel, emojiRequestDisplayStatus, emojiStatusIcon, emojiStatusLabel, statusLabel } from '@/utility/hatafeed.js';
import { i18n } from '@/i18n.js';

const popup = useHataGoesPopup();

defineProps<{
	isStaff: boolean;
	roadmap: HataFeedHomeIssue[];
	ownEmojiRequests: HataFeedEmojiRequest[];
	emojiRequests: HataFeedEmojiRequest[];
	emojiChangeRequests?: HataFeedEmojiChangeRequest[];
	emojiQuota: { remaining: number; limit: number } | null;
	activity: HataFeedHomeActivity[];
	issues: HataFeedHomeIssue[];
	issuesHasNext?: boolean;
	loading?: boolean;
	active?: boolean;
	monochrome?: boolean;
}>();
const emit = defineEmits<{
	issue: [id: string];
	navigate: [tab: HataFeedTab];
	approve: [request: HataFeedEmojiRequest];
	addRoadmap: [];
	ownHistory: [];
	reviewQueue: [];
	changed: [];
}>();
const copy = i18n.ts._hata._hatafeed._home;
</script>
<style module src="./hatafeed-page.module.css"></style>
