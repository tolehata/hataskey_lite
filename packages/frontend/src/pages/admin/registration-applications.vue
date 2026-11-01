<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" :class="$style.root" style="--MI_SPACER-w: 800px;">
		<MkInfo v-if="!authorized" warn>{{ reviewCopy.accessDenied }}</MkInfo>
		<MkInfo v-else-if="!applicationsEnabled"><strong>{{ instance.registrationClosed ? modeCopy.closedMessage : modeCopy.openRegistrationActive }}</strong><br>{{ modeCopy.managementPaused }}</MkInfo>
		<div v-else class="_gaps_m">
			<p :class="$style.introduction">{{ reviewCopy.introduction }}</p>
			<MkInfo v-if="loadFailed" warn>{{ reviewCopy.loadFailed }}</MkInfo>
			<!-- 旗鯖fork: プライバシー保護サマリパネル (rejected ステータス時に表示) -->
			<div v-if="isAdmin && status === 'rejected' && summary" :class="$style.summaryPanel">
				<div :class="$style.summaryHeader">
					<i class="ti ti-shield-lock"></i>
					<span>{{ copy.rejectedPrivacySummary }}</span>
				</div>
				<div :class="$style.summaryGrid">
					<div :class="$style.summaryItem">
						<div :class="$style.summaryValue">{{ summary.cleanedCount }}</div>
						<div :class="$style.summaryLabel">{{ copy.personalDataDeleted }}</div>
						<div :class="$style.summaryDesc">{{ copy.personalDataDeletedDescription }}</div>
					</div>
					<div :class="$style.summaryItem">
						<div :class="$style.summaryValue">{{ summary.emailRetainedCount }}</div>
						<div :class="$style.summaryLabel">{{ copy.emailRetained }}</div>
						<div :class="$style.summaryDesc">{{ copy.emailRetainedDescription }}</div>
					</div>
					<div v-if="summary.legacyCount > 0" :class="[$style.summaryItem, $style.summaryItemWarning]">
						<div :class="$style.summaryValue">{{ summary.legacyCount }}</div>
						<div :class="$style.summaryLabel">⚠️ {{ copy.legacyNotCleaned }}</div>
						<div :class="$style.summaryDesc">{{ copy.legacyNotCleanedDescription }}</div>
					</div>
				</div>
				<div v-if="summary.legacyCount > 0" :class="$style.summaryActions">
					<MkButton danger rounded :disabled="loading || actionBusy" @click="runLegacyCleanup">
						<i class="ti ti-trash"></i> {{ copyx.cleanupExisting({ count: summary.legacyCount.toString() }) }}
					</MkButton>
					<MkButton rounded :disabled="loading || actionBusy" @click="runLegacyCleanupDryRun">
						<i class="ti ti-eye"></i> {{ copy.dryRunOnly }}
					</MkButton>
				</div>
			</div>

			<MkSelect v-model="status" :items="statusItems" :disabled="loading || actionBusy">
				<template #label>{{ copy.status }}</template>
			</MkSelect>

			<div v-if="items.length === 0 && !loading && !loadFailed" :class="$style.empty">
				<div :class="$style.emptyIcon"><i class="ti ti-inbox"></i></div>
				<p>{{ status === 'pending' ? copy.noPending : copy.noMatching }}</p>
			</div>

			<div v-if="loading" :class="$style.empty">
				<MkLoading/>
			</div>

			<div v-else class="_gaps_s">
				<div v-for="item in items" :key="item.id" :class="$style.card">
					<div :class="$style.cardHeader">
						<div :class="$style.cardUser">
							<i class="ti ti-user"></i>
							<span v-if="item.username" :class="$style.username">@{{ item.username }}</span>
							<span v-else :class="[$style.username, $style.usernameDeleted]">@({{ copy.deleted }})</span>
						</div>
						<div :class="$style.cardDate">{{ formatDate(item.createdAt) }}</div>
					</div>

					<!-- 旗鯖fork: 個人情報の削除状態バッジ (rejected の時のみ表示) -->
					<div v-if="item.status === 'rejected'" :class="$style.privacyBadges">
						<span v-if="item.username === null" :class="[$style.privacyBadge, $style.privacyBadgeDeleted]">
							<i class="ti ti-check"></i> {{ copy.credentialsDeleted }}
							<span v-if="item.personalDataDeletedAt" :class="$style.privacyBadgeDate">({{ formatDate(item.personalDataDeletedAt) }})</span>
						</span>
						<span v-else :class="[$style.privacyBadge, $style.privacyBadgeWarning]">
							<i class="ti ti-alert-triangle"></i> {{ copy.credentialsNotDeleted }}
						</span>
						<span v-if="item.review.isRoot && item.email != null" :class="[$style.privacyBadge, $style.privacyBadgeRetained]">
							<i class="ti ti-clock"></i> {{ copy.emailRetained }}
							<span v-if="item.rejectedAt" :class="$style.privacyBadgeDate">({{ copyx.rejectedDays({ count: daysSinceRejection(item.rejectedAt).toString() }) }})</span>
						</span>
						<span v-else-if="item.review.isRoot" :class="[$style.privacyBadge, $style.privacyBadgeDeleted]">
							<i class="ti ti-check"></i> {{ copy.emailDeleted }}
						</span>
					</div>

					<div :class="$style.cardBody">
						<div v-if="item.status === 'pending' && item.additionalContacts" :class="$style.contactsField">
							<div :class="$style.cardFieldLabel">{{ copy.contactsLabel }}</div>
							<div :class="$style.cardFieldValue">{{ item.additionalContacts }}</div>
							<p :class="$style.contactsHint">{{ copy.contactsHandling }}</p>
						</div>
						<div v-if="item.review.isRoot && item.email" :class="$style.cardField">
							<div :class="$style.cardFieldLabel">{{ copy.emailAddress }}</div>
							<div :class="$style.cardFieldValue">{{ item.email }}</div>
						</div>
						<div v-else-if="item.review.isRoot && item.status === 'rejected'" :class="$style.cardField">
							<div :class="$style.cardFieldLabel">{{ copy.emailAddress }}</div>
							<div :class="[$style.cardFieldValue, $style.cardFieldValueDeleted]">({{ copy.deleted }})</div>
						</div>
						<div :class="$style.cardField">
							<div :class="$style.cardFieldLabel">{{ copy.reason }}</div>
							<div :class="$style.cardFieldValue">{{ item.reason }}</div>
						</div>
					</div>

					<section :class="$style.review">
						<h3 :class="$style.reviewTitle">{{ reviewCopy.reviewTitle }}</h3>
						<div v-if="item.status === 'pending'" :class="$style.tally">
							<strong>{{ reviewCopyx.tally({ agree: item.review.agreeCount.toString(), required: item.review.requiredCount.toString() }) }}</strong>
							<span>{{ reviewCopyx.tallyDetails({ oppose: item.review.opposeCount.toString(), waiting: item.review.waitingCount.toString() }) }}</span>
						</div>
						<MkInfo v-if="item.status === 'pending'" :warn="item.review.opposeCount > 0">
							{{ item.review.opposeCount > 0 ? reviewCopy.opposed : item.review.waitingCount > 0 ? reviewCopy.waitingVotes : reviewCopy.allAgreed }}
						</MkInfo>
						<p v-if="item.status === 'pending'" :class="$style.reviewHint">{{ reviewCopy.electorateHint }}</p>
						<ul :class="$style.voters">
							<li v-for="voter in item.review.voters" :key="voter.userId" :class="$style.voter" :data-current="voter.isCurrent">
								<div :class="$style.voterHeading">
									<strong>{{ voter.name || (voter.username ? '@' + voter.username : voter.userId) }}</strong>
									<span v-if="!voter.isCurrent">{{ reviewCopy.retired }}</span>
									<span :class="$style.voteChoice" :data-choice="voter.choice">
										<i v-if="voter.choice === 'agree'" class="ti ti-check" aria-hidden="true"></i>
										<i v-else-if="voter.choice === 'oppose'" class="ti ti-x" aria-hidden="true"></i>
										<i v-else class="ti ti-clock" aria-hidden="true"></i>
										{{ voter.choice === 'agree' ? reviewCopy.agreed : voter.choice === 'oppose' ? reviewCopy.opposedChoice : reviewCopy.waiting }}
									</span>
								</div>
								<time v-if="voter.votedAt" :datetime="voter.votedAt" :class="$style.voteDate">{{ formatDate(voter.votedAt) }}</time>
								<p v-if="voter.reason" :class="$style.voteReason">{{ voter.reason }}</p>
							</li>
						</ul>
						<div v-if="item.review.decidedBy" :class="$style.finalDecision">
							<strong>{{ reviewCopy.decidedBy }}: {{ item.review.decidedBy.name || (item.review.decidedBy.username ? '@' + item.review.decidedBy.username : item.review.decidedBy.userId) }}</strong>
							<time v-if="item.review.decidedAt" :datetime="item.review.decidedAt">{{ formatDate(item.review.decidedAt) }}</time>
						</div>
					</section>

					<div v-if="item.status === 'pending' && item.review.canVote" :class="$style.actionPanel">
						<p v-if="item.review.myChoice" :class="$style.reviewHint">{{ reviewCopy.yourVote }}: {{ item.review.myChoice === 'agree' ? reviewCopy.agreed : reviewCopy.opposedChoice }}</p>
						<p :class="$style.reviewHint">{{ reviewCopy.changeable }}</p>
						<div :class="$style.cardActions">
							<MkButton primary rounded :disabled="actionBusy || loading || item.review.myChoice === 'agree'" @click="openVote(item, 'agree')">
								<i class="ti ti-check" aria-hidden="true"></i> {{ reviewCopy.agree }}
							</MkButton>
							<MkButton danger rounded :disabled="actionBusy || loading || item.review.myChoice === 'oppose'" @click="openVote(item, 'oppose')">
								<i class="ti ti-x" aria-hidden="true"></i> {{ reviewCopy.oppose }}
							</MkButton>
						</div>
					</div>
					<div v-if="item.status === 'pending' && item.review.isRoot" :class="$style.actionPanel">
						<h3 :class="$style.reviewTitle">{{ reviewCopy.finalDecision }}</h3>
						<p :class="$style.reviewHint">{{ reviewCopy.finalConsent }}</p>
						<div :class="$style.cardActions">
							<MkButton primary rounded :disabled="actionBusy || loading || !item.review.canFinalize" @click="approve(item)">
								<i class="ti ti-user-check" aria-hidden="true"></i> {{ reviewCopy.permit }}
							</MkButton>
							<MkButton danger rounded :disabled="actionBusy || loading" @click="reject(item)">
								<i class="ti ti-user-x" aria-hidden="true"></i> {{ reviewCopy.finalizeReject }}
							</MkButton>
						</div>
					</div>
					<section v-if="item.status === 'rejected' && item.review.isRoot" :class="$style.actionPanel" aria-live="polite">
						<h3 :class="$style.reviewTitle">{{ notificationCopy.title }}</h3>
						<p :class="$style.reviewHint">{{ notificationLabel(item.notificationStatus) }}</p>
						<MkButton v-if="item.notificationRetryAvailable" rounded :disabled="actionBusy || loading" @click="resendNotification(item)">
							<i class="ti ti-mail-forward" aria-hidden="true"></i> {{ notificationCopy.retry }}
						</MkButton>
					</section>
					<div v-if="item.status !== 'pending'" :class="$style.cardStatus">
						<span v-if="item.status === 'approved'" :class="$style.statusApproved"><i class="ti ti-check" aria-hidden="true"></i> {{ copy.approved }}</span>
						<span v-if="item.status === 'rejected'" :class="$style.statusRejected"><i class="ti ti-x" aria-hidden="true"></i> {{ copy.rejected }}</span>
					</div>
					<MkA :to="'/admin/modlog?applicationId=' + encodeURIComponent(item.id)" :class="$style.logLink"><i class="ti ti-list-search" aria-hidden="true"></i> {{ reviewCopy.logLink }}</MkA>
				</div>
			</div>

			<div v-if="hasMore" :class="$style.more">
				<MkButton rounded :disabled="loading || actionBusy" @click="loadMore">{{ copy.loadMore }}</MkButton>
			</div>
		</div>
	</div>
</PageWithHeader>
<RegistrationVoteDialog v-if="voteDialog" :choice="voteDialog.choice" :username="voteDialog.username" :busy="voteSubmitting" :error="voteError" @closed="closeVote" @submit="submitVote"/>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import RegistrationVoteDialog from './registration-applications.vote-dialog.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkButton from '@/components/MkButton.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkInfo from '@/components/MkInfo.vue';
import { fetchInstance, instance } from '@/instance.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';

type RegistrationApplication = Endpoints['admin/registration-applications']['res'][number];

const LIMIT = 20;
const copy = i18n.ts._hata._registrationApplications._admin;
const copyx = i18n.tsx._hata._registrationApplications._admin;
const modeCopy = i18n.ts._hata._registrationApplications;
const reviewCopy = i18n.ts._hata._registrationApplications._review;
const reviewCopyx = i18n.tsx._hata._registrationApplications._review;
const notificationCopy = i18n.ts._hata._registrationApplications._notification;
const modeUnavailable = ref(false);
const permissionDenied = ref(false);
const isAdmin = computed(() => $i?.isAdmin === true);
const authorized = computed(() => !permissionDenied.value && ($i?.isAdmin === true || $i?.isModerator === true));
const applicationsEnabled = computed(() => !instance.registrationClosed && instance.disableRegistration === true && !modeUnavailable.value);

const statusItems = [
	{ value: 'pending', label: copy.pending },
	{ value: 'approved', label: copy.approved },
	{ value: 'rejected', label: copy.rejected },
];

const status = ref<'pending' | 'approved' | 'rejected'>('pending');
const items = ref<RegistrationApplication[]>([]);
const loadFailed = ref(false);
const voteDialog = ref<{ applicationId: string; username: string; choice: 'agree' | 'oppose'; reviewRevision: string; version: number } | null>(null);
const voteSubmitting = ref(false);
const voteError = ref<string | null>(null);
const loading = ref(false);
const hasMore = ref(false);
const actionBusy = ref(false);
let revision = 0;
let disposed = false;
let readRequest: AbortController | undefined;

// 旗鯖fork: rejected サマリ統計
const summary = ref<{ cleanedCount: number; emailRetainedCount: number; legacyCount: number } | null>(null);

function isCurrent(version: number) {
	return !disposed && applicationsEnabled.value && authorized.value && version === revision;
}

function clearSensitiveData() {
	for (const item of items.value) {
		item.additionalContacts = null;
		item.email = null;
		item.reason = '';
		item.username = null;
		for (const voter of item.review?.voters ?? []) voter.reason = null;
	}
	items.value = [];
	summary.value = null;
	hasMore.value = false;
	closeVote();
}

function closeVote() {
	voteDialog.value = null;
	voteError.value = null;
	voteSubmitting.value = false;
	actionBusy.value = false;
}

async function handleError(err: any) {
	if (disposed || err?.name === 'AbortError') return;
	if (['REGISTRATION_REVIEW_FORBIDDEN', 'PERMISSION_DENIED', 'ACCESS_DENIED', 'CREDENTIAL_REQUIRED', 'AUTHENTICATION_FAILED'].includes(err?.code)) {
		permissionDenied.value = true;
		clearSensitiveData();
		return;
	}
	if (err?.code === 'REGISTRATION_REVIEW_CHANGED' || err?.code === 'REGISTRATION_REVIEW_NOT_UNANIMOUS') {
		os.alert({ type: 'warning', text: reviewCopy.reviewChanged });
		return;
	}
	if (err?.code === 'REGISTRATION_APPLICATIONS_DISABLED') {
		modeUnavailable.value = true;
		try {
			const meta = await fetchInstance(true);
			if (!disposed && !meta.registrationClosed && meta.disableRegistration === true) modeUnavailable.value = false;
		} catch { /* Keep operations blocked until the registration mode is known. */ }
		return;
	}
	os.alert({ type: 'error', text: err?.message || copy.errorOccurred });
}

async function load() {
	const version = ++revision;
	readRequest?.abort();
	clearSensitiveData();
	loadFailed.value = false;
	loading.value = false;
	if (!isCurrent(version)) return;
	readRequest = new AbortController();
	loading.value = true;
	try {
		const res = await misskeyApi('admin/registration-applications', {
			status: status.value,
			limit: LIMIT,
			offset: 0,
		}, undefined, readRequest.signal);
		if (!isCurrent(version)) return;
		items.value = res;
		hasMore.value = res.length >= LIMIT;

		// rejected の場合、サマリも取得
		if (status.value === 'rejected' && isAdmin.value) {
			await loadSummary(version);
		} else {
			summary.value = null;
		}
	} catch (err) {
		if (isCurrent(version)) {
			clearSensitiveData();
			loadFailed.value = true;
			await handleError(err);
		}
	} finally {
		if (version === revision) loading.value = false;
	}
}

async function loadSummary(version = revision) {
	if (!isCurrent(version) || !isAdmin.value) return;
	try {
		// dry-run でサマリ統計だけ取得
		const res = await misskeyApi('admin/cleanup-legacy-rejected-registrations', {
			execute: false,
		}, undefined, readRequest?.signal);
		if (!isCurrent(version)) return;
		summary.value = {
			cleanedCount: res.alreadyCleanedCount,
			emailRetainedCount: res.emailRetainedCount,
			legacyCount: res.cleanedCount, // dry-run なので「クリーンアップ予定数」= 旧仕様未処理数
		};
	} catch (err) {
		if (isCurrent(version)) {
			summary.value = null;
			await handleError(err);
		}
	}
}

async function loadMore() {
	const version = revision;
	if (!isCurrent(version) || loading.value || actionBusy.value || !hasMore.value) return;
	loading.value = true;
	try {
		const res = await misskeyApi('admin/registration-applications', {
			status: status.value,
			limit: LIMIT,
			offset: items.value.length,
		}, undefined, readRequest?.signal);
		if (!isCurrent(version)) return;
		items.value = [...items.value, ...res];
		hasMore.value = res.length >= LIMIT;
	} catch (err) {
		if (isCurrent(version)) {
			clearSensitiveData();
			loadFailed.value = true;
			await handleError(err);
		}
	} finally {
		if (version === revision) loading.value = false;
	}
}

watch(() => [instance.disableRegistration, instance.registrationClosed], () => { modeUnavailable.value = false; });
watch(() => [$i?.id, $i?.isAdmin, $i?.isModerator], () => { permissionDenied.value = false; void load(); }, { flush: 'sync' });
watch([status, applicationsEnabled, authorized], () => load(), { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { disposed = true; revision++; readRequest?.abort(); clearSensitiveData(); });

function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 旗鯖fork: 却下後の経過日数を計算
function daysSinceRejection(rejectedAt: string): number {
	const rejected = new Date(rejectedAt);
	const now = new Date();
	const diffMs = now.getTime() - rejected.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function openVote(item: RegistrationApplication, choice: 'agree' | 'oppose') {
	if (!isCurrent(revision) || loading.value || actionBusy.value || item.status !== 'pending' || !item.review.canVote || item.review.myChoice === choice) return;
	actionBusy.value = true;
	voteError.value = null;
	voteDialog.value = { applicationId: item.id, username: item.username ?? '', choice, reviewRevision: item.review.revision, version: revision };
}

async function submitVote(reason: string) {
	const request = voteDialog.value;
	if (!request || voteSubmitting.value || !isCurrent(request.version)) return;
	voteSubmitting.value = true;
	try {
		await misskeyApi('admin/vote-registration', {
			applicationId: request.applicationId,
			choice: request.choice,
			reason,
			revision: request.reviewRevision,
		});
		if (!isCurrent(request.version)) return;
		os.alert({ type: 'success', text: request.choice === 'oppose' ? reviewCopy.opposeSaved : reviewCopy.voteSaved });
		await load();
	} catch (err: any) {
		if (!isCurrent(request.version)) return;
		if (err?.code === 'REGISTRATION_REVIEW_REASON_REQUIRED') {
			voteError.value = reviewCopy.reasonRequired;
		} else {
			await handleError(err);
			if (isCurrent(request.version)) await load();
		}
	} finally {
		if (request.version === revision) voteSubmitting.value = false;
	}
}

async function approve(item: RegistrationApplication) {
	await decide(item, 'approve');
}

async function reject(item: RegistrationApplication) {
	await decide(item, 'reject');
}

function notificationLabel(value: RegistrationApplication['notificationStatus']) {
	return value == null ? notificationCopy.legacy : notificationCopy[value];
}

async function resendNotification(item: RegistrationApplication) {
	const version = revision;
	if (!isCurrent(version) || actionBusy.value || loading.value || item.status !== 'rejected' || !item.review.isRoot || !item.notificationRetryAvailable) return;
	actionBusy.value = true;
	try {
		const { canceled } = await os.confirm({ type: 'warning', title: notificationCopy.retry, text: notificationCopy.retryConfirm });
		if (canceled || !isCurrent(version)) return;
		const result = await misskeyApi('admin/resend-registration-rejection', { applicationId: item.id });
		if (!isCurrent(version)) return;
		os.alert({ type: result.emailSent ? 'success' : 'warning', text: result.emailSent ? notificationCopy.retrySent : result.notificationStatus === 'sending' ? notificationCopy.sendingDescription : notificationCopy.retryFailed });
		await load();
	} catch (err: any) {
		if (!isCurrent(version)) return;
		if (err?.code === 'REJECTION_NOTIFICATION_NOT_RETRYABLE') os.alert({ type: 'warning', text: notificationCopy.unavailable });
		else await handleError(err);
		if (isCurrent(version)) await load();
	} finally {
		if (version === revision) actionBusy.value = false;
	}
}

async function decide(item: RegistrationApplication, decision: 'approve' | 'reject') {
	const version = revision;
	if (!isCurrent(version) || actionBusy.value || loading.value || item.status !== 'pending' || !item.review.isRoot || (decision === 'approve' && !item.review.canFinalize)) return;

	const username = item.username ?? '';
	const reviewRevision = item.review.revision;
	actionBusy.value = true;
	try {
		const { canceled } = await os.confirm({
			type: decision === 'approve' ? 'info' : 'warning',
			title: decision === 'approve' ? reviewCopy.approveTitle : reviewCopy.rejectTitle,
			text: `@${username}\n${decision === 'approve' ? reviewCopy.approveText : reviewCopy.rejectText}`,
		});
		if (canceled || !isCurrent(version)) return;
		if (decision === 'approve') {
			const result = await misskeyApi('admin/approve-registration', { applicationId: item.id, revision: reviewRevision });
			if (!isCurrent(version)) return;
			os.alert({ type: result.emailSent ? 'success' : 'warning', text: result.emailSent ? copyx.approvedSuccess({ username }) : reviewCopy.emailFailed });
		} else {
			const result = await misskeyApi('admin/reject-registration', { applicationId: item.id, revision: reviewRevision });
			if (!isCurrent(version)) return;
			os.alert({ type: result.emailSent ? 'success' : 'warning', text: result.emailSent ? notificationCopy.sentDescription : result.notificationStatus === 'sending' ? notificationCopy.sendingDescription : notificationCopy.failedDescription });
		}
		await load();
	} catch (err: any) {
		if (isCurrent(version)) {
			await handleError(err);
			// A decision may have committed even if the response was lost.
			if (isCurrent(version)) await load();
		}
	} finally {
		if (version === revision) actionBusy.value = false;
	}
}

// 旗鯖fork: 既存データのクリーンアップ (Dry-run)
async function runLegacyCleanupDryRun() {
	const version = revision;
	if (!isCurrent(version) || !isAdmin.value || actionBusy.value || loading.value) return;
	actionBusy.value = true;
	try {
		const res = await misskeyApi('admin/cleanup-legacy-rejected-registrations', {
			execute: false,
		});
		if (!isCurrent(version)) return;
		os.alert({
			type: 'info',
			title: copy.cleanupDryRunTitle,
			text: copyx.cleanupDryRunResult({ target: res.cleanedCount.toString(), cleaned: res.alreadyCleanedCount.toString(), retained: res.emailRetainedCount.toString() }),
		});
	} catch (err: any) {
		if (isCurrent(version)) await handleError(err);
	} finally {
		if (version === revision) actionBusy.value = false;
	}
}

// 旗鯖fork: 既存データのクリーンアップ (実削除)
async function runLegacyCleanup() {
	const version = revision;
	if (!isCurrent(version) || !isAdmin.value || actionBusy.value || loading.value) return;
	actionBusy.value = true;
	try {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: copy.cleanupExistingTitle,
			text: copyx.cleanupConfirm({ count: (summary.value?.legacyCount || 0).toString() }),
		});
		if (canceled || !isCurrent(version)) return;
		const res = await misskeyApi('admin/cleanup-legacy-rejected-registrations', {
			execute: true,
		});
		if (!isCurrent(version)) return;
		os.alert({
			type: 'success',
			title: copy.cleanupComplete,
			text: copyx.cleanupCompleteResult({ cleaned: res.cleanedCount.toString(), retained: res.emailRetainedCount.toString(), executedAt: formatDate(res.executedAt) }),
		});
		// リロード
		await load();
	} catch (err: any) {
		if (isCurrent(version)) await handleError(err);
	} finally {
		if (version === revision) actionBusy.value = false;
	}
}

const headerActions = computed(() => authorized.value && applicationsEnabled.value && !loading.value && !actionBusy.value ? [{
	icon: 'ti ti-refresh',
	text: copy.reload,
	handler: () => load(),
}] : []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: copy.title,
	icon: 'ti ti-file-description',
}));
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
}

.introduction {
	margin: 0;
	line-height: 1.7;
}

.review {
	display: grid;
	gap: 12px;
	padding-top: 16px;
	border-top: 1px solid var(--MI_THEME-divider);
}

.reviewTitle,
.reviewHint {
	margin: 0;
	line-height: 1.7;
	overflow-wrap: anywhere;
}

.reviewTitle {
	font-size: 1em;
}

.reviewHint {
	font-size: 0.9em;
}

.tally,
.voterHeading,
.finalDecision {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 16px;
}

.voters {
	display: grid;
	gap: 8px;
	list-style: none;
	margin: 0;
	padding: 0;
}

.voter {
	min-width: 0;
	padding: 12px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 8px;
	overflow-wrap: anywhere;

	&[data-current='false'] {
		border-style: dashed;
	}
}

.voteChoice {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-left: auto;
	font-weight: bold;

	&[data-choice='oppose'] {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
}

.voteDate {
	display: block;
	margin-top: 6px;
	font-size: 0.85em;
}

.voteReason {
	margin: 8px 0 0;
	white-space: pre-wrap;
	line-height: 1.7;
}

.actionPanel {
	display: grid;
	gap: 12px;
	padding-top: 16px;
	margin-top: 16px;
	border-top: 1px solid var(--MI_THEME-divider);
}

.logLink {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-top: 20px;
	min-height: 44px;
	text-decoration: underline;
	text-underline-offset: 3px;
}

.contactsField {
	display: grid;
	gap: 8px;
	min-width: 0;
}

.contactsHint {
	margin: 8px 0 0;
	font-size: 0.85em;
	line-height: 1.7;
	overflow-wrap: anywhere;
}

.empty {
	text-align: center;
	padding: 64px 16px;
	color: var(--MI_THEME-fgTransparentWeak);
}

.emptyIcon {
	font-size: 48px;
	margin-bottom: 16px;
}

.card {
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 16px;
}

.cardHeader {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
	padding-bottom: 12px;
	border-bottom: 1px solid var(--MI_THEME-divider);
}

.cardUser {
	display: flex;
	align-items: center;
	gap: 6px;
}

.username {
	font-weight: bold;
	font-size: 1.1em;
}

.usernameDeleted {
	color: var(--MI_THEME-fgTransparentWeak);
	font-style: italic;
}

.cardDate {
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 0.9em;
}

/* 旗鯖fork: プライバシー保護バッジ群 */
.privacyBadges {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 12px;
	padding: 8px;
	background: var(--MI_THEME-bg);
	border-radius: 6px;
}

.privacyBadge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 10px;
	border-radius: 999px;
	font-size: 0.85em;
	font-weight: 500;
}

.privacyBadgeDeleted {
	background: color-mix(in srgb, var(--MI_THEME-success) 20%, transparent);
	color: var(--MI_THEME-success);
	border: 1px solid color-mix(in srgb, var(--MI_THEME-success) 40%, transparent);
}

.privacyBadgeRetained {
	background: color-mix(in srgb, var(--MI_THEME-warn) 20%, transparent);
	color: var(--MI_THEME-warn);
	border: 1px solid color-mix(in srgb, var(--MI_THEME-warn) 40%, transparent);
}

.privacyBadgeWarning {
	background: color-mix(in srgb, var(--MI_THEME-error) 20%, transparent);
	color: var(--MI_THEME-error);
	border: 1px solid color-mix(in srgb, var(--MI_THEME-error) 40%, transparent);
}

.privacyBadgeDate {
	margin-left: 4px;
	opacity: 0.7;
	font-weight: 400;
	font-size: 0.9em;
}

.cardBody {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 12px;
}

.cardField {
	display: flex;
	gap: 8px;
}

.cardFieldLabel {
	min-width: 100px;
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 0.9em;
}

.cardFieldValue {
	flex: 1;
	min-width: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.cardFieldValueDeleted {
	color: var(--MI_THEME-fgTransparentWeak);
	font-style: italic;
}

.cardActions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	justify-content: flex-end;
}

.cardStatus {
	display: flex;
	justify-content: flex-end;
}

.statusApproved {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: var(--MI_THEME-success);
}

.statusRejected {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: var(--MI_THEME-error);
}

.more {
	text-align: center;
}

/* 旗鯖fork: サマリパネル */
.summaryPanel {
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 16px;
}

.summaryHeader {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: bold;
	font-size: 1.1em;
	margin-bottom: 12px;
	padding-bottom: 12px;
	border-bottom: 1px solid var(--MI_THEME-divider);

	> i {
		color: var(--MI_THEME-accent);
	}
}

.summaryGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 12px;
	margin-bottom: 12px;
}

.summaryItem {
	padding: 12px;
	background: var(--MI_THEME-bg);
	border-radius: 8px;
	border: 1px solid var(--MI_THEME-divider);
}

.summaryItemWarning {
	border-color: var(--MI_THEME-error);
	background: color-mix(in srgb, var(--MI_THEME-error) 10%, var(--MI_THEME-bg));
}

.summaryValue {
	font-size: 2em;
	font-weight: bold;
	color: var(--MI_THEME-accent);
	line-height: 1;
	margin-bottom: 4px;
}

.summaryItemWarning .summaryValue {
	color: var(--MI_THEME-error);
}

.summaryLabel {
	font-weight: 500;
	margin-bottom: 4px;
}

.summaryDesc {
	font-size: 0.85em;
	color: var(--MI_THEME-fgTransparentWeak);
	line-height: 1.4;
}

.summaryActions {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

@container (max-width: 480px) {
	.cardHeader {
		flex-wrap: wrap;
		gap: 8px;
	}

	.cardField {
		flex-direction: column;
	}

	.cardActions {
		justify-content: flex-start;
	}
}
</style>
