<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hatady の映画・ゲーム作品詳細。作品本文は一覧へ出さず、ここでだけネタバレ保護付きで表示する。
-->
<template>
<HyDialog
	ref="dialog"
	:variant="variant"
	scrollHint
	:inert="closePrompt"
	:busy="deleting"
	:title="work?.kind === 'work' ? detailCopy.workDetail : detailCopy.mediaDetail"
	@close="requestClose"
	@closed="onClosed"
>
	<div ref="scopeEl" class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<div v-if="loading" :class="$style.loading">{{ label('loading') }}</div>
		<template v-else-if="work">
			<header :class="$style.hero">
				<HyMediaCover
					v-if="work.kind !== 'work'"
					:kind="work.kind"
					:title="work.title"
					:subtitle="work.creator"
					:width="104"
					:colorIndex="work.coverColorIndex"
					showTitle
				/>
				<div :class="$style.heroMeta">
					<div :class="$style.kindLine">
						<span :class="$style.kindChip">
							<i
								:class="[
									'ti',
									work.kind === 'movie' ? 'ti-movie' : work.kind === 'work' ? 'ti-briefcase' : 'ti-device-gamepad-2',
								]"
							></i>
							{{ work.kind === 'movie' ? copy.movies : work.kind === 'work' ? detailCopy.work : copy.games }}
						</span>
						<span :class="$style.statusChip">{{ statusLabel(work.status) }}</span>
						<span :class="$style.statusChip">
							<i
								:class="[
									'ti',
									work.visibility === 'private'
										? 'ti-lock'
										: work.visibility === 'followers'
											? 'ti-users'
											: 'ti-world',
								]"
							></i>
							{{ visibilityLabel(work.visibility) }}
						</span>
					</div>
					<div :class="$style.titleRow">
						<h2 :class="$style.title">{{ work.title }}</h2>
						<div v-if="isMine" :class="$style.titleActions">
							<button type="button" class="hy-icon-button" :disabled="deleting" :aria-label="copy.edit" :title="copy.edit" @click="openEdit">
								<i class="ti ti-pencil" aria-hidden="true"></i>
							</button>
							<button type="button" class="hy-icon-button" :disabled="deleting || commentBusy" :aria-label="work.kind === 'work' ? detailCopy.deleteWork : detailCopy.deleteMedia" :title="work.kind === 'work' ? detailCopy.deleteWork : detailCopy.deleteMedia" @click="deleteWork">
								<i class="ti ti-trash" aria-hidden="true"></i>
							</button>
						</div>
					</div>
					<div v-if="work.originalTitle" :class="$style.originalTitle">{{ work.originalTitle }}</div>
					<div v-if="work.creator" :class="$style.creator">{{ work.creator }}</div>
					<div :class="$style.metaLine">
						<span v-if="work.releaseDate">
							<i class="ti ti-calendar"></i>
							{{ fmtDate(work.releaseDate) }}
						</span>
						<span v-else-if="work.releaseYear">
							<i class="ti ti-calendar"></i>
							{{ work.releaseYear }}
						</span>
						<span v-if="work.kind === 'movie' && work.runtimeMinutes">
							<i class="ti ti-clock"></i>
							{{ formatMediaMinutes(work.runtimeMinutes) }}
						</span>
						<span v-if="work.kind === 'movie' && work.origin">
							<i class="ti ti-world"></i>
							{{ movieOriginLabel(work.origin) }}
						</span>
						<span v-if="work.kind === 'movie' && work.viewingMode">
							<i class="ti ti-language"></i>
							{{ movieViewingModeLabel(work.viewingMode) }}
						</span>
						<span v-if="work.kind === 'movie' && work.primaryLanguage">
							<i class="ti ti-message-language"></i>
							{{ work.primaryLanguage }}
						</span>
						<span v-if="work.kind === 'movie' && work.recommendationRating != null">
							<i class="ti ti-star-filled"></i>
							{{ (work.recommendationRating / 2).toFixed(1) }} / 5
						</span>
						<span v-if="work.kind === 'game' && work.platforms?.length">
							<i class="ti ti-device-gamepad"></i>
							{{ work.platforms.join(' · ') }}
						</span>
						<span v-if="work.kind === 'game' && work.developer">
							<i class="ti ti-code"></i>
							{{ work.developer }}
						</span>
						<span v-if="work.kind === 'game' && work.publisher">
							<i class="ti ti-building-store"></i>
							{{ work.publisher }}
						</span>
					</div>
					<div v-if="genres.length" :class="$style.genres">
						<span v-for="genre in genres" :key="genre">{{ genre }}</span>
					</div>
					<MkLink
						v-if="safeOfficialUrl"
						:url="safeOfficialUrl"
						rel="nofollow noopener noreferrer"
						:class="$style.officialLink"
					>
						{{ label('officialSite') }}
					</MkLink>
				</div>
			</header>

			<div :class="$style.primaryActions">
				<button v-if="isMine" :class="$style.actionPrimary" @click="openSessionForm()">
					<i class="ti ti-plus"></i>
					{{ work.kind === 'movie' ? label('addViewing') : work.kind === 'work' ? detailCopy.recordWork : label('addPlay') }}
				</button>
				<button v-if="work.kind === 'movie'" :class="$style.actionBtn" @click="scheduleMediaViewing(work)">
					<i class="ti ti-calendar-event"></i>
					{{ label('scheduleViewing') }}
				</button>
			</div>

			<section v-if="workDetails.description" :class="$style.section">
				<p :class="$style.detailText">{{ workDetails.description }}</p>
			</section>
			<section v-if="workDetails.nextStep" :class="$style.section">
				<h3>{{ detailCopy.nextStep }}</h3>
				<p :class="$style.detailText">{{ workDetails.nextStep }}</p>
			</section>
			<section v-if="workDetails.memo" :class="$style.section">
				<h3>
					<i class="ti ti-lock"></i>
					{{ detailCopy.privateMemo }}
				</h3>
				<p :class="$style.detailText">{{ workDetails.memo }}</p>
			</section>
			<section v-if="work.kind === 'work'" :class="$style.section">
				<h3>{{ detailCopy.workProgress }}</h3>
				<div :class="$style.metricGrid">
					<div>{{ i18n.tsx._hata._hatady._mediaWorkDetail.recordCount({ count: String(workLogs.length) }) }}</div>
					<div>{{ i18n.tsx._hata._hatady._mediaWorkDetail.dayCount({ count: String(new Set(workLogs.map((l: any) => new Date(l.studiedAt).toLocaleDateString())).size) }) }}</div>
					<div>{{ projectTime }}</div>
				</div>
				<HatadyActivityCard
					v-for="log in workLogs"
					:key="log.id"
					:activity="logActivity(log)"
					:variant="variant"
					@openLog="openLog"
					@edit="editWorkLog"
					@deleted="recordDeleted(log.id)"
					@openMedia="() => {}"
					@openProfile="openProfile"
					@menu="(activity, event) => variant === 'hatady' ? openLog(activity.id) : timelineActions.openActivityMenu(activity, event)"
				/>
			</section>
			<section v-if="hasWorkNotes" :class="$style.section">
				<div :class="$style.sectionTitle">
					<i class="ti ti-notes"></i>
					{{ label('workNotes') }}
				</div>
				<article v-if="work.synopsis" :class="$style.noteBlock">
					<div :class="$style.noteTitle">{{ label('summary') }}</div>
					<SpoilerText :text="String(work.synopsis)" :spoiler="Boolean(work.synopsisSpoiler)"/>
				</article>
				<article v-if="work.kind === 'movie' && work.highlights?.length" :class="$style.noteBlock">
					<div :class="$style.noteTitle">{{ label('highlights') }}</div>
					<SpoilerText :text="work.highlights.join('\n')" :spoiler="Boolean(work.highlightsSpoiler)"/>
				</article>
				<article v-if="work.review" :class="$style.noteBlock">
					<div :class="$style.noteTitle">{{ label('review') }}</div>
					<SpoilerText :text="String(work.review)" :spoiler="Boolean(work.reviewSpoiler)"/>
				</article>
			</section>

			<!-- ゲーム専用ダッシュボード。映画では DOM 自体を生成しない。 -->
			<section v-if="work.kind === 'game'" :class="[$style.section, $style.dashboard]" data-media-dashboard="game">
				<div :class="$style.dashboardHead">
					<div :class="$style.sectionTitle">
						<i class="ti ti-chart-dots-3"></i>
						{{ label('gameDashboard') }}
					</div>
					<div :class="$style.periodPills">
						<button
							v-for="period in dashboardPeriods"
							:key="period.value"
							:class="[$style.periodPill, dashboardPeriod === period.value && $style.periodPillOn]"
							@click="dashboardPeriod = period.value"
						>
							{{ period.label }}
						</button>
					</div>
				</div>
				<div v-if="spoilerSessionsExcluded > 0" :class="$style.dataNotice">
					<i class="ti ti-eye-off"></i>
					{{ label('spoilerSessionsExcluded').replace('{count}', String(spoilerSessionsExcluded)) }}
				</div>
				<div :class="$style.metricGrid">
					<div :class="$style.metric">
						<span>{{ label('playTime') }}</span>
						<b>{{ formatMediaMinutes(gameStats.duration) }}</b>
					</div>
					<div :class="$style.metric">
						<span>{{ label('matches') }}</span>
						<b>{{ gameStats.matches }}</b>
					</div>
					<div :class="$style.metric">
						<span>{{ label('winRate') }}</span>
						<b>{{ gameStats.decidedMatches > 0 ? `${gameStats.winRate}%` : '—' }}</b>
						<small>{{ label('sampleSize') }} {{ gameStats.decidedMatches }}</small>
					</div>
					<div :class="$style.metric">
						<span>K / D</span>
						<b>{{ gameStats.kills }} / {{ gameStats.deaths }}</b>
						<small>{{ gameStats.deaths > 0 ? (gameStats.kills / gameStats.deaths).toFixed(2) : '—' }}</small>
					</div>
				</div>

				<div :class="$style.dashboardColumns">
					<div :class="$style.analysisBlock">
						<h3>
							<i class="ti ti-swords"></i>
							{{ label('weaponPerformance') }}
						</h3>
						<div v-if="gameStats.weapons.length === 0" :class="$style.subtle">{{ label('noWeaponStats') }}</div>
						<div v-else :class="$style.analysisRows">
							<div v-for="weapon in gameStats.weapons" :key="weapon.name" :class="$style.analysisRow">
								<b>{{ weapon.name }}</b>
								<span>{{ weapon.matches }} {{ label('matchesUnit') }}</span>
								<span>K/D {{ weapon.deaths > 0 ? (weapon.kills / weapon.deaths).toFixed(2) : '—' }}</span>
							</div>
						</div>
					</div>
					<div :class="$style.analysisBlock">
						<h3>
							<i class="ti ti-stairs"></i>
							{{ label('roundTrend') }}
						</h3>
						<div v-if="gameStats.rounds.length === 0" :class="$style.subtle">{{ label('noRoundStats') }}</div>
						<div v-else :class="$style.roundRows">
							<div v-for="round in gameStats.rounds" :key="round.index" :class="$style.roundRow">
								<span>{{ label('roundNumber').replace('{index}', String(round.index)) }}</span>
								<span :class="$style.roundBar"><i :style="{ width: `${round.rate}%` }"></i></span>
								<b>{{ round.rate }}%</b>
								<small>{{ round.wins }}/{{ round.total }}</small>
							</div>
						</div>
					</div>
					<div :class="$style.analysisBlock">
						<h3>
							<i class="ti ti-trending-up"></i>
							{{ label('rankRating') }}
						</h3>
						<dl :class="$style.summaryList">
							<div>
								<dt>{{ label('latestRank') }}</dt>
								<dd>{{ gameStats.latestRank || '—' }}</dd>
							</div>
							<div>
								<dt>{{ label('latestRating') }}</dt>
								<dd>{{ gameStats.latestRating ?? '—' }}</dd>
							</div>
							<div>
								<dt>{{ label('ratingChange') }}</dt>
								<dd :data-positive="gameStats.ratingDelta > 0 ? 'true' : undefined">
									{{
										gameStats.hasRatingDelta ? `${gameStats.ratingDelta > 0 ? '+' : ''}${gameStats.ratingDelta}` : '—'
									}}
								</dd>
							</div>
						</dl>
					</div>
					<div :class="$style.analysisBlock">
						<h3>
							<i class="ti ti-route-square"></i>
							{{ label('roguelikeStats') }}
						</h3>
						<dl :class="$style.summaryList">
							<div>
								<dt>{{ label('runs') }}</dt>
								<dd>{{ gameStats.rogueRuns }}</dd>
							</div>
							<div>
								<dt>{{ label('clearRate') }}</dt>
								<dd>{{ gameStats.rogueDecided > 0 ? `${gameStats.rogueClearRate}%` : '—' }}</dd>
							</div>
							<div>
								<dt>{{ label('maxFloor') }}</dt>
								<dd>{{ gameStats.maxFloor ?? '—' }}</dd>
							</div>
							<div>
								<dt>{{ label('popularRoute') }}</dt>
								<dd>{{ gameStats.topRoute || '—' }}</dd>
							</div>
						</dl>
					</div>
				</div>
			</section>

			<section v-if="work.kind !== 'work'" :class="$style.section">
				<div :class="$style.sectionHead">
					<div :class="$style.sectionTitle">
						<i class="ti ti-history"></i>
						{{ work.kind === 'movie' ? label('viewingHistory') : label('playHistory') }}
						<span v-if="sessions.length" :class="$style.count">{{ sessions.length }}</span>
					</div>
					<button v-if="isMine" :class="$style.smallAdd" @click="openSessionForm()">
						<i class="ti ti-plus"></i>
						{{ copy.add }}
					</button>
				</div>
				<div v-if="sessionsLoading" :class="$style.subtle">{{ label('loading') }}</div>
				<div v-else-if="sessionsLoadFailed" :class="$style.dataNotice">
					<i class="ti ti-alert-triangle"></i>
					{{ label('loadFailed') }}
				</div>
				<template v-else>
					<div v-if="sessionsTruncated" :class="$style.dataNotice">
						<i class="ti ti-alert-triangle"></i>
						{{ label('sessionLimitNotice') }}
					</div>
					<div v-if="sessions.length === 0" :class="$style.empty">
						<i :class="['ti', work.kind === 'movie' ? 'ti-movie-off' : 'ti-device-gamepad-off']"></i>
						<span>{{ work.kind === 'movie' ? label('emptyViewing') : label('emptyPlay') }}</span>
					</div>
					<div v-else :class="$style.sessionList">
						<div v-for="session in sessions" :key="session.id">
							<HatadyActivityCard
								:activity="sessionActivity(session)"
								:variant="variant"
								@openSession="openSessionConversation"
								@openMedia="() => {}"
								@openProfile="openProfile"
								@edit="() => openSessionForm(session)"
								@deleted="recordDeleted(session.id)"
								@menu="(activity, event) => variant === 'hatady' ? openSessionConversation(session.id) : timelineActions.openActivityMenu(activity, event)"
							/>
							<details :class="$style.spoilerDetails">
								<summary>{{ detailCopy.recordDetails }}</summary>
								<details v-if="session.noteSpoiler">
									<summary>{{ label('showSpoilerSession') }}</summary>
									<SessionPrivateContent :session="session"/>
								</details>
								<SessionPrivateContent v-else :session="session"/>
							</details>
						</div>
					</div>
				</template>
			</section>

			<section :class="$style.section">
				<div :class="$style.sectionTitle">
					<i class="ti ti-mood-smile"></i>
					{{ label('reactions') }}
				</div>
				<div :class="$style.reactions">
					<HatadyReactionPill
						v-for="(count, emoji) in reactions"
						:key="emoji"
						:target="{ workId: props.workId }"
						:reaction="String(emoji)"
						:count="count"
						:pressed="myReaction === emoji"
						:actionLabel="myReaction === emoji ? i18n.ts._hata._hatady._reactions.remove : i18n.ts._hata._hatady._reactions.add"
						:variant="variant"
						:class="[$style.reaction, myReaction === emoji && $style.reactionOn]"
						@activate="toggleReaction(String(emoji))"
					/>
					<button
						ref="reactionAdd"
						:class="$style.reactionAdd"
						:title="label('addReaction')"
						@click="openReactionPicker"
					>
						<i class="ti ti-mood-plus"></i>
					</button>
				</div>
			</section>

			<section :class="$style.section">
				<div :class="$style.sectionTitle">
					<i class="ti ti-messages"></i>
					{{ label('comments') }}
					<span v-if="comments.length" :class="$style.count">{{ comments.length }}</span>
				</div>
				<form :class="$style.commentComposer" @submit.prevent="createComment">
					<div v-if="replyTo" :class="$style.replying">
						<i class="ti ti-arrow-back-up"></i>
						{{ label('replying') }}
						<button type="button" class="hy-icon-button" :aria-label="detailCopy.clearReplyTarget" @click="replyTo = null">
							<i class="ti ti-x"></i>
						</button>
					</div>
					<div :class="$style.inputBox">
						<textarea
							ref="commentInput"
							v-model="commentText"
							:placeholder="label('commentPlaceholder')"
							rows="3"
							maxlength="2048"
							@keydown="commentKeydown"
						></textarea>
						<div>
							<button type="button" class="hy-icon-button" :aria-label="detailCopy.insertEmoji" @click="insertCommentEmoji">
								<i class="ti ti-mood-plus"></i>
							</button>
							<button
								type="button"
								class="hy-icon-button"
								:aria-label="detailCopy.preview"
								:aria-pressed="commentPreview"
								@click="commentPreview = !commentPreview"
							>
								<i class="ti ti-eye"></i>
							</button>
							<small>{{ commentText.length }} / 2048</small>
						</div>
					</div>
					<div v-if="commentPreview"><Mfm :text="commentText"/></div>
					<label :class="$style.commentSpoiler">
						<input v-model="commentSpoiler" type="checkbox"/>
						<i class="ti ti-eye-off"></i>
						{{ label('containsSpoiler') }}
					</label>
					<button
						type="submit"
						class="hy-primary"
						:disabled="commentBusy || !commentText.trim() || commentText.length > 2048"
					>
						<i class="ti ti-send"></i>
						{{ label('send') }}
					</button>
					<p v-if="draftError" class="hy-error" role="alert">{{ draftError }}</p>
				</form>
				<div v-if="commentsLoading" :class="$style.subtle">{{ label('loading') }}</div>
				<div v-else-if="commentsLoadFailed" :class="$style.dataNotice">
					<i class="ti ti-alert-triangle"></i>
					{{ label('loadFailed') }}
				</div>
				<div v-else-if="comments.length === 0" :class="$style.subtle">{{ label('noComments') }}</div>
				<div v-else :class="$style.commentList">
					<article
						v-for="comment in comments"
						:key="comment.id"
						:class="[$style.comment, comment.replyId && $style.commentReply]"
					>
						<MkAvatar v-if="comment.user" :class="$style.commentAvatar" :user="comment.user"/>
						<div :class="$style.commentMain">
							<div :class="$style.commentHead">
								<MkUserName v-if="comment.user" :user="comment.user"/>
								<time>{{ fmtWhen(comment.createdAt) }}</time>
							</div>
							<details v-if="comment.spoiler">
								<summary>{{ detailCopy.spoilerReply }}</summary>
								<Mfm :text="comment.text"/>
							</details>
							<Mfm v-else :text="comment.text"/>
							<div v-if="comment.reactions?.length" :class="$style.commentReactions">
								<HatadyReactionPill
									v-for="reaction in comment.reactions"
									:key="reaction.reaction"
									:target="{ mediaCommentId: comment.id }"
									:reaction="reaction.reaction"
									:count="reaction.count"
									:pressed="comment.myReaction === reaction.reaction"
									:actionLabel="comment.myReaction === reaction.reaction ? i18n.ts._hata._hatady._reactions.remove : i18n.ts._hata._hatady._reactions.add"
									:variant="variant"
									:class="[$style.reaction, comment.myReaction === reaction.reaction && $style.reactionOn]"
									@activate="toggleCommentReaction(comment, reaction.reaction)"
								/>
							</div>
							<div :class="$style.commentActions">
								<button @click="replyTo = comment.id">
									<i class="ti ti-arrow-back-up"></i>
									{{ label('reply') }}
								</button>
								<button @click="openCommentReactionPicker(comment, $event)">
									<i class="ti ti-mood-plus"></i>
									{{ label('addReaction') }}
								</button>
								<button v-if="comment.userId === $i?.id" :class="$style.danger" @click="deleteComment(comment)">
									<i class="ti ti-trash"></i>
									{{ copy.delete }}
								</button>
								<button v-else-if="comment.user" @click="reportComment(comment)">
									<i class="ti ti-flag"></i>
									{{ i18n.ts.reportAbuse }}
								</button>
							</div>
						</div>
					</article>
					<button
						v-if="commentsHasMore"
						:class="$style.loadMore"
						:disabled="commentsLoadingMore"
						@click="loadMoreComments"
					>
						<i class="ti ti-chevron-down"></i>
						{{ label('loadMoreComments') }}
					</button>
				</div>
			</section>
		</template>
		<div v-else-if="!loading" :class="$style.empty">{{ label('notFound') }}</div>
	</div>
</HyDialog>
<HatadyDraftPrompt
	v-if="closePrompt"
	:variant="variant"
	:title="detailCopy.draftQuestion"
	:error="draftError"
	@save="leave(true)"
	@discard="leave(false)"
	@return="cancelClose"
/>
</template>

<script lang="ts" setup>
import { useHataGoesEmojiPickers } from '@/utility/hatagoes-emoji-pickers.js';
import {
	computed,
	nextTick,
	defineAsyncComponent,
	defineComponent,
	h,
	onMounted,
	ref,
	useCssModule,
	useTemplateRef,
} from 'vue';
import type {
	HatadyMediaComment,
	HatadyMediaKind,
	HatadyMediaSession,
	HatadyMediaWork,
} from '@/utility/hatady-media.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hatadyNotify, hatadySeconds, hatadyDuration } from '@/utility/hatady-ui.js';
import MkLink from '@/components/MkLink.vue';
import HatadyReactionPill from '@/components/HatadyReactionPill.vue';
import HyMediaCover from '@/components/HyMediaCover.vue';
import { i18n } from '@/i18n.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { confirmHatadyAction } from '@/utility/hatady-record-delete.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { invalidateHatadyReactionUsers } from '@/utility/hatady-reaction-details.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { versatileLang } from '@/utility/intl-const.js';
import { $i } from '@/i.js';
import { isOwnHatadyProfile, openOwnHatadyProfileIfNeeded, useHatadyActivityActions } from '@/utility/hatady-activity-actions.js';
import {
	formatMediaMinutes,
	hatadyMediaCopy,
	hatadyViewingEventPayload,
	mediaCommentCreatePayload,
	mediaDashboardSessions,
	mediaReactionPayload,
	mediaSessionDisplayFacts,
	mediaStatusCopyKey,
	normalizeMediaList,
	normalizeMediaSessions,
} from '@/utility/hatady-media.js';

const popup = useHataGoesPopup();
const pickers = useHataGoesEmojiPickers();
const dialogs = useHataGoesDialogs();

const props = withDefaults(defineProps<{ workId: string; kind?: HatadyMediaKind; variant?: 'hatady' | 'ui' | 'uis' }>(), { variant: 'hatady' });
const timelineActions = useHatadyActivityActions({
	variant: props.variant,
	onChanged: () => { void reloadWork(); emit('changed'); },
	onDeleted: activity => removeLocalRecord(activity.id),
});
const emit = defineEmits<{
	(ev: 'changed'): void;
	(ev: 'deleted'): void;
	(ev: 'scheduleViewing', work: HatadyMediaWork): void;
	(ev: 'closed'): void;
}>();
const dialog = useTemplateRef('dialog');
const reactionAdd = useTemplateRef('reactionAdd');
const theme = hatadyTheme;
const copy = hatadyMediaCopy();
const detailCopy = i18n.ts._hata._hatady._mediaWorkDetail;
const styles = useCssModule();
const mediaApi = misskeyApi as unknown as (endpoint: string, payload: Record<string, unknown>) => Promise<any>;
const dateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat(versatileLang, {
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
});
const loading = ref(true);
const work = ref<HatadyMediaWork | null>(null);
const workLogs = ref<any[]>([]);
const workDetails = computed<any>(() => work.value?.details || {});
const projectTime = computed(() =>
	workLogs.value.some((l) => hatadySeconds(l) != null)
		? hatadyDuration(workLogs.value.reduce((sum, l) => sum + (hatadySeconds(l) || 0), 0))
		: detailCopy.noDuration,
);
const kind = computed<HatadyMediaKind>(() => work.value?.kind ?? props.kind ?? 'movie');
const isMine = ref(false);
const deleting = ref(false);
const sessions = ref<HatadyMediaSession[]>([]);
const sessionsLoading = ref(true);
const sessionsLoadFailed = ref(false);
const sessionsTruncated = ref(false);
const reactions = ref<Record<string, number>>({});
const myReaction = ref<string | null>(null);
const comments = ref<HatadyMediaComment[]>([]);
const commentsLoading = ref(true);
const commentsLoadFailed = ref(false);
const commentsLoadingMore = ref(false);
const commentsHasMore = ref(false);
const commentText = ref('');
const commentSpoiler = ref(false);
const replyTo = ref<string | null>(null);
const commentBusy = ref(false);
const commentInput = ref<HTMLTextAreaElement>(),
	commentPreview = ref(false),
	closePrompt = ref(false),
	draftError = ref('');
const replyDraft = useHataFormDraft({
	id: `hatady-work-reply:${props.workId}`,
	autoSave: false,
	capture: () => ({ text: commentText.value, spoiler: commentSpoiler.value, replyId: replyTo.value }),
	restore: (d: any) => {
		commentText.value = d?.text || '';
		commentSpoiler.value = !!d?.spoiler;
		replyTo.value = d?.replyId || null;
	},
	isMeaningful: (d) => !!d.text.trim(),
});

function requestClose() {
	if (commentBusy.value || deleting.value) return;
	if (replyDraft.hasChanges() || replyDraft.restored.value) closePrompt.value = true;
	else dialog.value?.close();
}

let navigateToOwnProfile = false;

function cancelClose() {
	navigateToOwnProfile = false;
	closePrompt.value = false;
}

function onClosed() {
	emit('closed');
	if (navigateToOwnProfile) openOwnHatadyProfileIfNeeded(undefined, props.variant);
}

function leave(save: boolean) {
	if (!(save ? replyDraft.saveDraft() : replyDraft.clearDraft())) {
		draftError.value = detailCopy.draftFailed;
		return;
	}
	closePrompt.value = false;
	dialog.value?.close();
	if (save) hatadyNotify(detailCopy.draftSaved);
}

function commentKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
		e.preventDefault();
		void createComment();
	}
}

function insertCommentEmoji(e: MouseEvent) {
	let start = commentInput.value?.selectionStart ?? commentText.value.length,
		end = commentInput.value?.selectionEnd ?? start;
	pickers.showEmojiPicker(
		e.currentTarget as HTMLElement,
		(emoji) => {
			commentText.value = commentText.value.slice(0, start) + emoji + commentText.value.slice(end);
			start += emoji.length;
			end = start;
		},
		() => {
			void nextTick(() => {
				commentInput.value?.focus();
				commentInput.value?.setSelectionRange(start, end);
			});
		},
	);
}

function sessionActivity(session: any) {
	return {
		id: session.id,
		type: session.kind,
		occurredAt: session.occurredAt,
		user: work.value?.user,
		visibility: session.visibility,
		isMine: isMine.value,
		media: { work: work.value, session },
	} as any;
}

function logActivity(log: any) {
	return {
		id: log.id,
		type: log.kind || 'work',
		occurredAt: log.studiedAt,
		user: log.user || work.value?.user,
		visibility: log.visibility,
		isMine: isMine.value,
		study: log,
	} as any;
}

async function openSessionConversation(sessionId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ sessionId, workId: props.workId, variant: props.variant },
		{
			deleted: () => removeLocalRecord(sessionId),
			changed: () => {
				void loadSessions();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openLog(logId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ logId, variant: props.variant },
		{
			deleted: () => removeLocalRecord(logId),
			changed: () => {
				void reloadWork();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function editWorkLog(a: any) {
	const { dispose } = popup(
		(await import('@/components/HatadyComposer.vue')).default,
		{ editLog: a.study, variant: props.variant },
		{
			done: () => {
				void reloadWork();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openProfile(userId: string) {
	if (isOwnHatadyProfile(userId, props.variant)) {
		if (commentBusy.value || deleting.value) return;
		navigateToOwnProfile = true;
		requestClose();
		return;
	}
	const { dispose } = popup(
		(await import('@/components/HatadyProfile.vue')).default,
		{ userId, variant: props.variant },
		{ closed: () => dispose() },
	);
}

const dashboardPeriod = ref<'all' | '30' | '90'>('all');

function label(key: string): string {
	return String(copy.detail?.[key] ?? copy.session?.[key] ?? copy[key] ?? key);
}

const genres = computed(() => normalizeMediaList(work.value?.genres));
const hasWorkNotes = computed(() => !!(work.value?.synopsis || work.value?.highlights?.length || work.value?.review));
const safeOfficialUrl = computed(() => {
	const raw = String(work.value?.officialUrl ?? '');
	try {
		const parsed = new URL(raw);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
	} catch {
		return null;
	}
});
const dashboardPeriods = computed(() => [
	{ value: 'all' as const, label: label('periodAll') },
	{ value: '30' as const, label: label('period30') },
	{ value: '90' as const, label: label('period90') },
]);
const dashboardPeriodSessions = computed(() => {
	if (dashboardPeriod.value === 'all') return sessions.value;
	const since = Date.now() - Number(dashboardPeriod.value) * 86_400_000;
	return sessions.value.filter((session) => Date.parse(session.occurredAt) >= since);
});
const dashboardSessions = computed(() => mediaDashboardSessions(dashboardPeriodSessions.value, isMine.value));
const spoilerSessionsExcluded = computed(() =>
	isMine.value ? 0 : dashboardPeriodSessions.value.filter((session) => session.noteSpoiler).length,
);
const gameStats = computed(() => {
	const source = dashboardSessions.value;
	const matches = source.filter((session) => session.kind === 'game_match');
	const decided = matches.filter((session) => ['win', 'loss', 'draw'].includes(detailText(session, 'result')));
	const wins = decided.filter((session) => detailText(session, 'result') === 'win').length;
	let kills = 0;
	let deaths = 0;
	const weapons = new Map<string, { matches: number; kills: number; deaths: number }>();
	const rounds = new Map<number, { wins: number; total: number }>();
	for (const match of matches) {
		const matchKills = detailNumber(match, 'kills') ?? 0;
		const matchDeaths = detailNumber(match, 'deaths') ?? 0;
		kills += matchKills;
		deaths += matchDeaths;
		const weapon = detailText(match, 'weapon');
		if (weapon) {
			const current = weapons.get(weapon) ?? { matches: 0, kills: 0, deaths: 0 };
			current.matches++;
			current.kills += matchKills;
			current.deaths += matchDeaths;
			weapons.set(weapon, current);
		}
		const roundResults = Array.isArray(match.details?.roundResults) ? match.details.roundResults : [];
		roundResults.forEach((item, index) => {
			const value = typeof item === 'string' ? item : String((item as any)?.result ?? '');
			const current = rounds.get(index + 1) ?? { wins: 0, total: 0 };
			current.total++;
			if (/^(win|w|won|victory|勝|○)$/i.test(value.trim())) current.wins++;
			rounds.set(index + 1, current);
		});
	}
	const ordered = [...source].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
	const ratingPoints = ordered
		.flatMap((session) => [
			detailNumber(session, 'ratingBefore'),
			detailNumber(session, 'rating'),
			detailNumber(session, 'ratingAfter'),
		])
		.filter((value): value is number => value != null);
	const latestRank =
		[...ordered]
			.reverse()
			.map((session) => detailText(session, 'rank'))
			.find(Boolean) ?? '';
	const rogues = source.filter((session) => session.kind === 'game_roguelike');
	const rogueDecided = rogues.filter((session) =>
		['cleared', 'failed', 'retired'].includes(detailText(session, 'result')),
	);
	const routes = new Map<string, number>();
	for (const run of rogues) {
		const route = detailText(run, 'route');
		if (route) routes.set(route, (routes.get(route) ?? 0) + 1);
	}
	return {
		duration: source.reduce((total, session) => total + Number(session.durationMinutes ?? 0), 0),
		matches: matches.length,
		decidedMatches: decided.length,
		winRate: decided.length ? Math.round((wins / decided.length) * 100) : 0,
		kills,
		deaths,
		weapons: [...weapons.entries()]
			.map(([name, value]) => ({ name, ...value }))
			.sort((a, b) => b.matches - a.matches)
			.slice(0, 8),
		rounds: [...rounds.entries()]
			.map(([index, value]) => ({
				index,
				...value,
				rate: value.total ? Math.round((value.wins / value.total) * 100) : 0,
			}))
			.sort((a, b) => a.index - b.index),
		latestRank,
		latestRating: ratingPoints.at(-1) ?? null,
		hasRatingDelta: ratingPoints.length >= 2,
		ratingDelta: ratingPoints.length >= 2 ? Number((ratingPoints.at(-1)! - ratingPoints[0]).toFixed(2)) : 0,
		rogueRuns: rogues.length,
		rogueDecided: rogueDecided.length,
		rogueClearRate: rogueDecided.length
			? Math.round(
				(rogueDecided.filter((session) => detailText(session, 'result') === 'cleared').length / rogueDecided.length) *
						100,
			)
			: 0,
		maxFloor:
			rogues
				.map((session) => detailNumber(session, 'floor'))
				.filter((value): value is number => value != null)
				.sort((a, b) => b - a)[0] ?? null,
		topRoute: [...routes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
	};
});

function normalizeReactions(value: unknown): Record<string, number> {
	if (value && !Array.isArray(value) && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.map(([key, count]): [string, number] => [key, Number(count) || 0])
				.filter((entry) => entry[1] > 0),
		);
	}
	if (Array.isArray(value)) {
		return Object.fromEntries(
			value
				.map((item): [string, number] => [String(item.reaction ?? item.emoji ?? ''), Number(item.count ?? 0)])
				.filter((entry) => entry[0].length > 0 && entry[1] > 0),
		);
	}
	return {};
}

function normalizeComments(value: unknown): HatadyMediaComment[] {
	const source = Array.isArray(value) ? value : ((value as any)?.items ?? []);
	return source.filter((v: any) => v && typeof v.id === 'string');
}

async function reloadWork() {
	loading.value = true;
	try {
		const result = await mediaApi('hata/hatady/media/works/show', { workId: props.workId });
		workLogs.value = result.logs || [];
		const packed = (result?.work ?? result) as HatadyMediaWork;
		work.value = packed && typeof packed.id === 'string' ? packed : null;
		isMine.value = result?.isMine === true;
		reactions.value = normalizeReactions(result?.reactions ?? packed?.reactions);
		myReaction.value = result?.myReaction ?? packed?.myReaction ?? null;
	} catch {
		work.value = null;
		isMine.value = false;
	} finally {
		loading.value = false;
	}
}

async function loadSessions() {
	sessionsLoading.value = true;
	sessionsLoadFailed.value = false;
	sessionsTruncated.value = false;
	try {
		const all: HatadyMediaSession[] = [];
		const seen = new Set<string>();
		let untilId: string | undefined;
		for (let pageIndex = 0; pageIndex < 50; pageIndex++) {
			const page = normalizeMediaSessions(
				await mediaApi('hata/hatady/media/sessions/list', {
					workId: props.workId,
					limit: 100,
					...(untilId ? { untilId } : {}),
				}),
			);
			let added = 0;
			for (const item of page) if (!seen.has(item.id)) {
				seen.add(item.id);
				all.push(item);
				added++;
			}
			if (page.length < 100) break;
			const nextUntilId = page.at(-1)?.id;
			if (!nextUntilId || nextUntilId === untilId || added === 0) {
				sessionsTruncated.value = true;
				break;
			}
			untilId = nextUntilId;
			if (pageIndex === 49) {
				try {
					const probe = normalizeMediaSessions(
						await mediaApi('hata/hatady/media/sessions/list', { workId: props.workId, limit: 1, untilId }),
					);
					sessionsTruncated.value = probe.some((item) => !seen.has(item.id));
				} catch {
					sessionsTruncated.value = true;
				}
			}
		}
		sessions.value = all;
	} catch {
		sessions.value = [];
		sessionsLoadFailed.value = true;
	} finally {
		sessionsLoading.value = false;
	}
}

async function loadComments() {
	commentsLoading.value = true;
	commentsLoadFailed.value = false;
	try {
		const page = normalizeComments(
			await mediaApi('hata/hatady/media/comments/list', { workId: props.workId, limit: 100 }),
		);
		comments.value = page;
		commentsHasMore.value = page.length === 100;
	} catch {
		comments.value = [];
		commentsHasMore.value = false;
		commentsLoadFailed.value = true;
	} finally {
		commentsLoading.value = false;
	}
}

async function loadMoreComments() {
	if (commentsLoadingMore.value || !commentsHasMore.value) return;
	commentsLoadingMore.value = true;
	try {
		const untilId = comments.value[0]?.id;
		const page = normalizeComments(
			await mediaApi('hata/hatady/media/comments/list', {
				workId: props.workId,
				limit: 100,
				...(untilId ? { untilId } : {}),
			}),
		);
		const seen = new Set(comments.value.map((item) => item.id));
		const added = page.filter((item) => !seen.has(item.id));
		comments.value = [...added, ...comments.value];
		commentsHasMore.value = page.length === 100 && added.length > 0 && page[0]?.id !== untilId;
	} catch {
		commentsHasMore.value = false;
		dialogs.alert({ type: 'error', text: label('loadFailed') });
	} finally {
		commentsLoadingMore.value = false;
	}
}

function statusLabel(status: any): string {
	return String(copy.status?.[mediaStatusCopyKey(kind.value, status)] ?? status);
}

function visibilityLabel(value: string): string {
	return String(copy.form?.[value] ?? copy.session?.[value] ?? value);
}

function fmtDate(value: string): string {
	return dateFormatter.format(new Date(value));
}

function fmtWhen(value: unknown): string {
	if (!value) return '';
	const d = new Date(String(value));
	return Number.isNaN(d.getTime()) ? '' : timeFormatter.format(d);
}

function movieOriginLabel(value: string): string {
	const key = value === 'co_production' ? 'coProduction' : value === 'other' ? 'otherOrigin' : value;
	return String(copy.form?.[key] ?? value);
}

function movieViewingModeLabel(value: string): string {
	return String(copy.form?.[value] ?? value);
}

function detailText(session: HatadyMediaSession, key: string): string {
	return typeof session.details?.[key] === 'string' ? String(session.details[key]) : '';
}

function detailNumber(session: HatadyMediaSession, key: string): number | null {
	return typeof session.details?.[key] === 'number' ? Number(session.details[key]) : null;
}

function moodLabel(value: string): string {
	const keys: Record<string, string> = {
		great: 'moodGreat',
		good: 'moodGood',
		neutral: 'moodNeutral',
		tired: 'moodTired',
		frustrated: 'moodFrustrated',
	};
	return String(copy.session?.[keys[value] ?? value] ?? value);
}

function resultLabel(value: string): string {
	return String(copy.session?.[value] ?? value);
}

function sessionDetailValue(key: string, value: unknown): string {
	if (value == null || value === '') return '';
	if (typeof value === 'boolean') return String(value ? i18n.ts.yes : i18n.ts.no);
	if (Array.isArray(value)) {
		const items = key === 'roundResults' ? value.map((item) => resultLabel(String(item))) : value.map(String);
		return items.filter(Boolean).join(' · ');
	}
	if (key === 'mood') return moodLabel(String(value));
	if (['result', 'viewingMode', 'playMode', 'matchmaking', 'opponentType'].includes(key)) return String(copy.session?.[String(value)] ?? value);
	return String(value);
}

function sessionDetailRows(
	session: HatadyMediaSession,
): Array<{ key: string; icon: string; label: string; value: string }> {
	return mediaSessionDisplayFacts(session)
		.map(({ key, value }) => {
			return {
				key,
				icon:
					key === 'mood'
						? 'ti-mood-smile'
						: key === 'weapon'
							? 'ti-sword'
							: key === 'route'
								? 'ti-route-square'
								: 'ti-point',
				label: label(key),
				value: sessionDetailValue(key, value),
			};
		})
		.filter((row) => row.value !== '');
}

async function openEdit() {
	if (!work.value) return;
	const { dispose } = popup(
		(await import('@/components/HatadyMediaWorkForm.vue')).default,
		{ kind: kind.value, editWork: work.value, variant: props.variant },
		{
			done: () => {
				reloadWork();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function scheduleMediaViewing(target: HatadyMediaWork) {
	const now = new Date(),
		date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	const { canceled, result } = await dialogs.form(String(copy.detail.scheduleViewing), {
		date: { type: 'string', label: String(copy.form.eventDate), default: date },
		timeStart: { type: 'string', label: String(copy.form.eventTime), default: '20:00' },
	});
	if (canceled) return;
	const eventDate = String(result.date ?? ''),
		eventTime = String(result.timeStart ?? '');
	const parsed = new Date(`${eventDate}T${eventTime}:00`);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
		!/^\d{2}:\d{2}$/.test(eventTime) ||
		!Number.isFinite(parsed.getTime()) ||
		parsed.getFullYear() !== Number(eventDate.slice(0, 4)) ||
		parsed.getMonth() + 1 !== Number(eventDate.slice(5, 7)) ||
		parsed.getDate() !== Number(eventDate.slice(8))
	) {
		await dialogs.alert({ type: 'error', text: String(copy.form.invalidDateTime) });
		return;
	}
	try {
		await misskeyApi(
			'hatask/events/create',
			hatadyViewingEventPayload(String(copy.detail.viewingEventTitle), target.title, eventDate, eventTime) as never,
		);
		hatadyNotify(detailCopy.calendarAdded);
	} catch {
		hatadyNotify(detailCopy.calendarAddFailed);
	}
}

async function deleteWork() {
	if (!work.value || !isMine.value || deleting.value || commentBusy.value) return;
	deleting.value = true;
	try {
		const name = work.value.kind === 'work' ? detailCopy.work : detailCopy.media;
		if (!(await confirmHatadyAction(props.variant, i18n.tsx._hata._hatady._mediaWorkDetail.deleteConfirm({ name }), 'warning', popup))) return;
		await mediaApi('hata/hatady/media/works/delete', { workId: props.workId });
		hatadyNotify(i18n.tsx._hata._hatady._mediaWorkDetail.deleted({ name }));
		emit('deleted');
		emit('changed');
		dialog.value?.close();
	} catch {
		hatadyNotify(detailCopy.deleteFailed);
	} finally {
		deleting.value = false;
	}
}

function removeLocalRecord(recordId: string) {
	workLogs.value = workLogs.value.filter(log => log.id !== recordId);
	sessions.value = sessions.value.filter(session => session.id !== recordId);
}

async function recordDeleted(recordId: string) {
	removeLocalRecord(recordId);
	if (work.value?.kind === 'work') await reloadWork();
	else await Promise.all([reloadWork(), loadSessions()]);
	emit('changed');
}

async function openSessionForm(session?: HatadyMediaSession) {
	if (work.value?.kind === 'work') {
		const { dispose } = popup(
			(await import('@/components/HatadyComposer.vue')).default,
			{ kind: 'work', work: work.value, variant: props.variant } as any,
			{
				done: () => {
					void reloadWork();
					emit('changed');
				},
				closed: () => dispose(),
			},
		);
		return;
	}
	if (!work.value) return;
	const { dispose } = popup(
		(await import('@/components/HatadyMediaSessionForm.vue')).default,
		{ work: work.value, editSession: session, variant: props.variant },
		{
			done: () => {
				loadSessions();
				reloadWork();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function toggleReaction(emoji: string) {
	if (myReaction.value === emoji) {
		await mediaApi('hata/hatady/media/reactions/delete', mediaReactionPayload('work', props.workId));
	} else {
		await mediaApi('hata/hatady/media/reactions/create', mediaReactionPayload('work', props.workId, emoji));
	}
	invalidateHatadyReactionUsers({ workId: props.workId });
	await reloadWork();
}

function openReactionPicker() {
	pickers.showReactionPicker(reactionAdd.value ?? null, null, async (reaction) => {
		await mediaApi('hata/hatady/media/reactions/create', mediaReactionPayload('work', props.workId, reaction));
		invalidateHatadyReactionUsers({ workId: props.workId });
		await reloadWork();
	});
}

async function createComment() {
	if (!commentText.value.trim() || commentBusy.value) return;
	commentBusy.value = true;
	try {
		await mediaApi(
			'hata/hatady/media/comments/create',
			mediaCommentCreatePayload(props.workId, commentText.value, commentSpoiler.value, replyTo.value),
		);
		commentText.value = '';
		commentSpoiler.value = false;
		replyTo.value = null;
		if (!replyDraft.clearDraft({ resume: true })) hatadyNotify(detailCopy.replyDraftDeleteFailed);
		await loadComments();
		await reloadWork();
	} catch {
		draftError.value = detailCopy.replyFailed;
	} finally {
		commentBusy.value = false;
	}
}

async function deleteComment(comment: HatadyMediaComment) {
	if (!(await confirmHatadyAction(props.variant, label('deleteCommentConfirm'), 'warning', popup))) return;
	await mediaApi('hata/hatady/media/comments/delete', { commentId: comment.id });
	await loadComments();
	await reloadWork();
}

function reportComment(comment: HatadyMediaComment) {
	if (!comment.user) return;
	const { dispose } = popup(
		defineAsyncComponent(() => import('@/components/MkAbuseReportWindow.vue')),
		{
			user: comment.user,
			initialComment: `hatady:media-comment:${comment.id}\n${comment.text}`,
		},
		{ closed: () => dispose() },
	);
}

async function toggleCommentReaction(comment: HatadyMediaComment, reaction: string) {
	if (comment.myReaction === reaction) await mediaApi('hata/hatady/media/reactions/delete', { targetType: 'comment', targetId: comment.id });
	else await mediaApi('hata/hatady/media/reactions/create', { targetType: 'comment', targetId: comment.id, reaction });
	invalidateHatadyReactionUsers({ mediaCommentId: comment.id });
	await loadComments();
}

function openCommentReactionPicker(comment: HatadyMediaComment, ev: MouseEvent) {
	pickers.showReactionPicker(ev.currentTarget as HTMLElement, null, async (reaction) => {
		await mediaApi('hata/hatady/media/reactions/create', { targetType: 'comment', targetId: comment.id, reaction });
		invalidateHatadyReactionUsers({ mediaCommentId: comment.id });
		await loadComments();
	});
}

const SpoilerText = defineComponent({
	name: 'SpoilerText',
	props: { text: { type: String, required: true }, spoiler: { type: Boolean, default: false } },
	setup(p) {
		const shown = ref(!p.spoiler);
		return () =>
			p.spoiler && !shown.value
				? h(
					'button',
					{
						type: 'button',
						class: styles.spoilerButton,
						onClick: () => {
							shown.value = true;
						},
					},
					[h('i', { class: 'ti ti-eye-off' }), ` ${label('showSpoiler')}`],
				)
				: h('div', { class: styles.noteText }, p.text);
	},
});

const SessionPrivateContent = defineComponent({
	name: 'SessionPrivateContent',
	props: { session: { type: Object as () => HatadyMediaSession, required: true } },
	setup(p) {
		return () =>
			h('div', { class: styles.sessionPrivate }, [
				h('div', { class: styles.sessionFacts }, [
					p.session.durationMinutes
						? h('span', [h('i', { class: 'ti ti-clock' }), ` ${formatMediaMinutes(p.session.durationMinutes)}`])
						: null,
					...sessionDetailRows(p.session).map((row) =>
						h('span', { key: row.key }, [
							h('i', { class: `ti ${row.icon}` }),
							h('b', ` ${row.label}`),
							` ${row.value}`,
						]),
					),
				]),
				p.session.note ? h('div', { class: styles.sessionNote }, p.session.note) : null,
				p.session.files?.length ? h(MkMediaList, { mediaList: p.session.files }) : null,
			]);
	},
});

onMounted(() => {
	reloadWork();
	loadSessions();
	loadComments();
});
</script>

<style lang="scss" module>
.body {
	min-height: 100%;
	padding: 21px;
	box-sizing: border-box;
	container-type: inline-size;
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
}
.loading,
.subtle {
	padding: 28px 0;
	text-align: center;
	color: var(--hy-muted);
	font-size: 12.5px;
}
.hero {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	gap: 19px;
	align-items: start;
}
.heroMeta {
	min-width: 0;
}
.kindLine {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7px;
}
.kindChip,
.statusChip,
.genres span,
.count {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 9px;
	border-radius: 999px;
	font-size: 10.5px;
	font-weight: 700;
}
.kindChip {
	color: var(--hy-accent-ink);
	background: color-mix(in srgb, var(--hy-accent) 14%, var(--hy-surface));
}
.statusChip,
.genres span {
	border: 1px solid var(--hy-border);
	background: var(--hy-surface);
	color: var(--hy-body);
}
.title {
	overflow-wrap: anywhere;
	margin: 9px 0 2px;
	color: var(--hy-ink);
	font-family: var(--hy-serif);
	font-size: 22px;
	line-height: 1.35;
}
.originalTitle {
	overflow-wrap: anywhere;
	color: var(--hy-body);
	font-family: var(--hy-serif);
	font-size: 12px;
}
.creator {
	overflow-wrap: anywhere;
	color: var(--hy-muted);
	font-size: 12.5px;
}
.metaLine {
	display: flex;
	flex-wrap: wrap;
	gap: 7px 14px;
	margin-top: 12px;
	color: var(--hy-body);
	font-size: 11.5px;
}
.genres {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 10px;
}
.officialLink {
	display: inline-block;
	margin-top: 11px;
	font-size: 12px;
}
.primaryActions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 19px 0;
}
.actionBtn,
.actionPrimary,
.smallAdd {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 7px 13px;
	background: var(--hy-surface);
	color: var(--hy-ink);
	font-family: var(--hy-heading);
	font-size: 11.5px;
	font-weight: 700;
	cursor: pointer;
}
.actionPrimary {
	border-color: transparent;
	background: var(--hy-accent);
	color: #fff;
}
.danger {
	color: #c0563a !important;
}
.section {
	margin-top: 14px;
	padding: 15px;
	border: 1px solid var(--hy-border);
	border-radius: 13px;
	background: var(--hy-surface);
}
.sectionHead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}
.sectionTitle {
	display: flex;
	align-items: center;
	gap: 7px;
	color: var(--hy-ink);
	font-family: var(--hy-heading);
	font-size: 13px;
	font-weight: 800;
}
.sectionTitle > i {
	color: var(--hy-accent);
}
.count {
	padding: 1px 7px;
	background: var(--hy-bg);
	color: var(--hy-muted);
}
.noteBlock + .noteBlock {
	margin-top: 13px;
	padding-top: 13px;
	border-top: 1px solid var(--hy-border);
}
.noteTitle {
	margin-bottom: 6px;
	color: var(--hy-muted);
	font-size: 10.5px;
	font-weight: 700;
}
.noteText,
.sessionNote,
.commentText {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	color: var(--hy-body);
	font-size: 12.5px;
	line-height: 1.65;
}
.sessionPrivate {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.dashboardHead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.periodPills {
	display: inline-flex;
	gap: 2px;
	padding: 3px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-bg);
}
.periodPill {
	padding: 4px 10px;
	border: 0;
	border-radius: 999px;
	background: transparent;
	color: var(--hy-muted);
	font: 700 10.5px var(--hy-heading);
	cursor: pointer;
}
.periodPillOn {
	background: var(--hy-ink);
	color: var(--hy-bg);
}
.metricGrid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 7px;
	margin-top: 13px;
}
.metric {
	display: flex;
	flex-direction: column;
	min-width: 0;
	gap: 2px;
	padding: 10px;
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	background: var(--hy-bg);
}
.metric > span {
	color: var(--hy-muted);
	font-size: 10px;
}
.metric > b {
	overflow: hidden;
	color: var(--hy-ink);
	font: 800 17px var(--hy-heading);
	text-overflow: ellipsis;
}
.metric > small {
	color: var(--hy-muted);
	font-size: 9.5px;
}
.dashboardColumns {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	margin-top: 8px;
}
.analysisBlock {
	min-width: 0;
	padding: 11px;
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	background: var(--hy-bg);
}
.analysisBlock h3 {
	display: flex;
	align-items: center;
	gap: 5px;
	margin: 0 0 9px;
	color: var(--hy-ink);
	font: 800 11.5px var(--hy-heading);
}
.analysisBlock h3 i {
	color: var(--hy-accent);
}
.analysisRows,
.roundRows {
	display: grid;
	gap: 5px;
}
.analysisRow {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	gap: 7px;
	align-items: center;
	color: var(--hy-muted);
	font-size: 10px;
}
.analysisRow b {
	overflow: hidden;
	color: var(--hy-body);
	text-overflow: ellipsis;
	white-space: nowrap;
}
.roundRow {
	display: grid;
	grid-template-columns: auto minmax(40px, 1fr) auto auto;
	gap: 6px;
	align-items: center;
	color: var(--hy-muted);
	font-size: 9.5px;
}
.roundBar {
	height: 5px;
	overflow: hidden;
	border-radius: 999px;
	background: var(--hy-border);
}
.roundBar i {
	display: block;
	height: 100%;
	border-radius: inherit;
	background: var(--hy-accent);
}
.roundRow b {
	color: var(--hy-ink);
}
.summaryList {
	display: grid;
	gap: 5px;
	margin: 0;
}
.summaryList > div {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 9px;
}
.summaryList dt {
	color: var(--hy-muted);
	font-size: 10px;
}
.summaryList dd {
	margin: 0;
	color: var(--hy-ink);
	font-size: 11px;
	font-weight: 700;
	text-align: right;
}
.summaryList dd[data-positive='true'] {
	color: #4d8d55;
}
.spoilerButton {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 7px 12px;
	border: 1px dashed var(--hy-border);
	border-radius: 9px;
	background: var(--hy-bg);
	color: var(--hy-muted);
	cursor: pointer;
}
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 25px;
	color: var(--hy-muted);
	font-size: 12px;
	text-align: center;
}
.empty i {
	font-size: 26px;
	opacity: 0.65;
}
.dataNotice {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 10px;
	padding: 8px 10px;
	border-radius: 9px;
	background: color-mix(in srgb, #d9a441 12%, var(--hy-bg));
	color: var(--hy-body);
	font-size: 10.5px;
}
.sessionList {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 12px;
}
.sessionCard {
	padding: 11px 12px;
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	background: var(--hy-bg);
}
.sessionTop {
	display: flex;
	align-items: center;
	gap: 7px;
}
.sessionTop time {
	margin-left: auto;
	color: var(--hy-muted);
	font-size: 10.5px;
}
.sessionType {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	color: var(--hy-ink);
	font-family: var(--hy-heading);
	font-size: 11.5px;
	font-weight: 700;
}
.iconBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: var(--hy-muted);
	cursor: pointer;
}
.iconBtn:hover {
	background: var(--hy-chip-bg);
}
.sessionFacts {
	display: flex;
	flex-wrap: wrap;
	gap: 5px 12px;
	margin-top: 8px;
	color: var(--hy-muted);
	font-size: 11px;
}
.sessionFacts b {
	color: var(--hy-body);
	font-weight: 700;
}
.sessionNote {
	margin-top: 9px;
	color: var(--hy-ink);
}
.spoilerDetails {
	margin-top: 8px;
	color: var(--hy-muted);
	font-size: 11.5px;
}
.spoilerDetails summary {
	cursor: pointer;
}
.reactions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 12px;
}
.reaction,
.reactionAdd {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-height: 28px;
	padding: 3px 9px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-bg);
	color: var(--hy-body);
	cursor: pointer;
}
.reactionOn {
	border-color: var(--hy-accent);
	background: color-mix(in srgb, var(--hy-accent) 14%, var(--hy-bg));
}
.reaction :global(img) {
	height: 1.25em;
}
.commentComposer {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px;
	margin-top: 12px;
}
.commentInput {
	min-width: 0;
	resize: vertical;
	padding: 9px 11px;
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	outline: none;
	background: var(--hy-bg);
	color: var(--hy-ink);
	font: inherit;
}
.commentInput:focus {
	border-color: var(--hy-accent);
}
.commentComposer > button {
	align-self: end;
	padding: 8px 13px;
	border: 0;
	border-radius: 999px;
	background: var(--hy-accent);
	color: #fff;
	font-weight: 700;
	cursor: pointer;
}
.commentComposer > button:disabled {
	opacity: 0.45;
}
.commentSpoiler {
	grid-column: 1;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	color: var(--hy-muted);
	font-size: 10.5px;
	cursor: pointer;
}
.commentSpoiler input {
	accent-color: var(--hy-accent);
}
.replying {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	gap: 5px;
	color: var(--hy-accent-ink);
	font-size: 11px;
}
.replying button {
	margin-left: auto;
	border: 0;
	background: none;
	color: inherit;
	cursor: pointer;
}
.commentList {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 14px;
}
.comment {
	display: flex;
	gap: 9px;
}
.commentReply {
	margin-left: 34px;
	padding-left: 11px;
	border-left: 2px solid var(--hy-border);
}
.commentAvatar {
	width: 30px;
	height: 30px;
	flex: 0 0 auto;
}
.commentMain {
	flex: 1;
	min-width: 0;
}
.commentHead {
	display: flex;
	align-items: center;
	gap: 7px;
	color: var(--hy-ink);
	font-size: 11.5px;
	font-weight: 700;
}
.commentHead time {
	margin-left: auto;
	color: var(--hy-muted);
	font-size: 10px;
	font-weight: 400;
}
.commentActions {
	display: flex;
	gap: 10px;
	margin-top: 5px;
}
.commentActions button {
	padding: 0;
	border: 0;
	background: none;
	color: var(--hy-muted);
	font-size: 10.5px;
	cursor: pointer;
}
.commentReactions {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 6px;
}
.commentReactions .reaction {
	min-height: 24px;
	padding: 2px 7px;
}
.loadMore {
	align-self: center;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 6px 13px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-bg);
	color: var(--hy-body);
	font: 700 10.5px var(--hy-heading);
	cursor: pointer;
}
@container (max-width: 520px) {
	.body {
		padding: 15px;
	}
	.hero {
		grid-template-columns: 78px minmax(0, 1fr);
		gap: 13px;
	}
	.hero > :first-child {
		width: 78px !important;
		height: auto !important;
		aspect-ratio: 1 / 1.36;
	}
	.title {
		font-size: 18px;
	}
	.dashboardHead {
		align-items: stretch;
		flex-direction: column;
	}
	.periodPills {
		align-self: flex-start;
	}
	.metricGrid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.dashboardColumns {
		grid-template-columns: 1fr;
	}
	.primaryActions > * {
		flex: 1 1 auto;
		justify-content: center;
	}
	.sessionTop {
		flex-wrap: wrap;
	}
	.sessionTop time {
		order: 3;
		flex: 1 1 100%;
		margin-left: 0;
	}
	.commentComposer {
		grid-template-columns: 1fr;
	}
	.commentComposer > button {
		justify-self: center;
	}
	.commentReply {
		margin-left: 18px;
	}
}

.body {
	padding: 0;
	background: var(--hy-surface);
	min-height: 0;
}
.hero {
	gap: 24px;
}
.titleRow {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}
.titleActions {
	display: flex;
	flex: none;
	gap: 8px;
}
.titleRow h2 {
	flex: 0 1 auto;
	min-width: 0;
	max-width: 100%;
	font: 700 25px var(--hy-heading);
	margin: 0;
	overflow-wrap: anywhere;
}
.titleRow button {
	flex: none;
}
.primaryActions {
	justify-content: center;
	flex-wrap: wrap;
}
.actionBtn,
.actionPrimary {
	min-height: 44px;
	border-radius: 999px;
}
.detailText {
	white-space: pre-wrap;
	line-height: 1.8;
}
.sessionList {
	gap: 14px;
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
	background: none;
	color: inherit;
	font: inherit;
	border: 0;
	padding: 13px;
	resize: vertical;
	min-height: 75px;
	outline: none;
}
.inputBox > div {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 0 6px;
}
.inputBox small {
	margin-left: auto;
	color: var(--hy-muted);
	font-size: 11px;
	padding-right: 8px;
}
.commentComposer {
	display: grid;
	gap: 10px;
	background: none;
	padding: 0;
	border: 0;
}
.commentComposer > button {
	grid-column: 1 / -1;
	justify-self: center;
}
.section {
	margin-block: 24px;
}
.commentActions > button {
	min-height: 44px;
}
</style>
