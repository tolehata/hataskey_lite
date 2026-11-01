<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component :is="prefer.s.enablePullToRefresh ? MkPullToRefresh : 'div'" :refresher="() => reload()">
	<div class="_spacer" :style="{ '--MI_SPACER-w': narrow ? '800px' : '1100px' }">
		<div ref="rootEl" class="ftskorzw" :class="{ wide: !narrow }" style="container-type: inline-size;">
			<div class="main _gaps">
				<!-- TODO -->
				<!-- <div class="punished" v-if="user.isSuspended"><i class="ti ti-alert-triangle" style="margin-right: 8px;"></i> {{ i18n.ts.userSuspended }}</div> -->
				<!-- <div class="punished" v-if="user.isSilenced"><i class="ti ti-alert-triangle" style="margin-right: 8px;"></i> {{ i18n.ts.userSilenced }}</div> -->

				<div class="profile _gaps">
					<MkAccountMoved v-if="user.movedTo" :movedTo="user.movedTo"/>
					<MkRemoteCaution v-if="user.host != null" :href="user.url ?? user.uri!"/>
					<MkInfo v-if="user.host == null && user.username.includes('.')">{{ i18n.ts.isSystemAccount }}</MkInfo>

					<div :key="user.id" class="main _panel">
						<!-- 旗鯖fork: 既存のバナー画像をぼかしてカード背景に敷くレイヤ。 -->
						<div class="profileBgBlur" :style="style" aria-hidden="true"></div>
						<div ref="bannerEl" class="banner-container">
							<div class="banner" :style="style"></div>
							<div class="fade"></div>
							<div class="title">
								<div class="name">
									<MkUserName :user="user" :nowrap="true" :enableEmojiMenu="!!$i" @click="editNickname(props.user)"/>
								</div>
								<div class="bottom">
									<span class="username"><MkAcct :user="user" :detail="true"/></span>
									<span v-if="'isAdmin' in user && user.isAdmin" v-tooltip="i18n.ts.administrator" style="color: var(--MI_THEME-badge);"><i class="ti ti-shield"></i></span>
									<span v-if="user.isLocked" v-tooltip="i18n.ts.makeFollowManuallyApprove"><i class="ti ti-lock"></i></span>
									<span v-if="user.isBot"><i class="ti ti-robot"></i></span>
									<span v-if="'isProxy' in user && user.isProxy" v-tooltip="i18n.ts.proxyAccount"><i class="ti ti-ghost"></i></span>
									<button v-if="$i && !isEditingMemo && !memoDraft" class="_button add-note-button" @click="showMemoTextarea">
										<i class="ti ti-edit"/> {{ i18n.ts.addMemo }}
									</button>
								</div>
							</div>
							<span v-if="$i && $i.id != user.id && user.isFollowed" class="followed">{{ i18n.ts.followsYou }}</span>
							<div class="actions">
								<button class="menu _button" @click="menu"><i class="ti ti-dots"></i></button>
								<button v-if="notesSearchAvailable && (user.host == null || canSearchNonLocalNotes)" v-tooltip="i18n.ts.searchThisUsersNotes" class="menu _button" @click="router.pushByPath(`/search?username=${encodeURIComponent(user.username)}${user.host != null ? '&host=' + encodeURIComponent(user.host) : ''}`);"><i class="ti ti-search"></i></button>
								<button v-tooltip="user.notify === 'none' ? i18n.ts.notifyNotes : i18n.ts.unnotifyNotes" class="menu _button" @click="toggleNotify"><i :class="user.notify === 'none' ? 'ti ti-bell-plus' : 'ti ti-bell-minus'"></i></button>
								<MkFollowButton v-if="$i?.id != user.id" v-model:user="user" :inline="true" :transparent="false" :full="true" class="koudoku"/>
							</div>
						</div>
						<MkAvatar class="avatar" :user="user" indicator/>
						<div class="title">
							<MkUserName :user="user" :nowrap="false" :enableEmojiMenu="!!$i" class="name" @click="editNickname(props.user)"/>
							<div class="bottom">
								<span class="username"><MkAcct :user="user" :detail="true"/></span>
								<span v-if="'isAdmin' in user && user.isAdmin" v-tooltip="i18n.ts.administrator" style="color: var(--MI_THEME-badge);"><i class="ti ti-shield"></i></span>
								<span v-if="user.isLocked" v-tooltip="i18n.ts.makeFollowManuallyApprove"><i class="ti ti-lock"></i></span>
								<span v-if="user.isBot"><i class="ti ti-robot"></i></span>
								<span v-if="'isProxy' in user && user.isProxy" v-tooltip="i18n.ts.proxyAccount"><i class="ti ti-ghost"></i></span>
							</div>
						</div>
						<div v-if="user.followedMessage != null" class="followedMessage">
							<MkFukidashi class="fukidashi" :tail="narrow ? 'none' : 'left'" negativeMargin>
								<div class="messageHeader">{{ i18n.ts.messageToFollower }}</div>
								<div><MkSparkle><Mfm :plain="true" :text="user.followedMessage" :author="user" :enableEmojiMenu="!!$i" class="_selectable"/></MkSparkle></div>
							</MkFukidashi>
						</div>
						<div v-if="user.roles.length > 0" class="roles">
							<span v-for="role in user.roles" :key="role.id" v-tooltip="role.description" class="role" :style="{ '--color': role.color ?? '' }">
								<MkA v-adaptive-bg :to="`/roles/${role.id}`">
									<img v-if="role.iconUrl" style="height: 1.3em; vertical-align: -22%; border-radius: 0.4em;" :src="role.iconUrl"/>
									{{ role.name }}
								</MkA>
							</span>
						</div>
						<div v-if="iAmModerator" class="moderationNote">
							<MkTextarea v-if="editModerationNote || (moderationNote != null && moderationNote !== '')" v-model="moderationNote" manualSave @change="moderationNoteEditRevision++" @savingStateChange="(changed) => { isModerationNoteDirty = changed; }">
								<template #label>{{ i18n.ts.moderationNote }}</template>
								<template #caption>{{ i18n.ts.moderationNoteDescription }}</template>
							</MkTextarea>
							<div v-else>
								<MkButton class="moderationNoteButton" small @click="editModerationNote = true">{{ i18n.ts.addModerationNote }}</MkButton>
							</div>
						</div>
						<div v-if="isEditingMemo || memoDraft" class="memo" :class="{'no-memo': !memoDraft}">
							<div class="heading" v-text="i18n.ts.memo"/>
							<textarea
								ref="memoTextareaEl"
								v-model="memoDraft"
								rows="1"
								@focus="isEditingMemo = true"
								@blur="updateMemo"
								@input="adjustMemoTextarea"
							/>
						</div>
						<!-- 旗鯖fork: 自鯖限定の実績バッジ。表示中の項目全体を中央揃えにする。 -->
						<div v-if="hataProfileBadges.length > 0" ref="utageBadgeRef" class="utageSuccessWrapper">
							<MkHataProfileBadges :user="user"/>
							<!-- 旗鯖fork: 初回アナウンス吹き出し。
							     祖先の transform/will-change により position:fixed の基準がズレるため、
							     Teleport で body 直下に出して真のビューポート基準にする。
							     scoped CSS が効かないので、グローバルクラス(utageGlobalTip*)でスタイルを当てる。 -->
							<Teleport to="body">
								<div v-if="utageBadgeTipVisible && utageBadgeTipPos" :class="['utageGlobalTip', utageBadgeTipPos.mode === 'sheet' ? 'utageGlobalTipSheet' : utageBadgeTipPos.mode === 'windowSheet' ? 'utageGlobalTipWindowSheet' : (utageBadgeTipPos.placement === 'above' ? 'utageGlobalTipAbove' : 'utageGlobalTipBelow')]" :style="utageBadgeTipPos.mode === 'tooltip' ? { top: utageBadgeTipPos.top + 'px', left: utageBadgeTipPos.left + 'px' } : utageBadgeTipPos.mode === 'windowSheet' ? { left: utageBadgeTipPos.left + 'px', right: utageBadgeTipPos.right + 'px', bottom: utageBadgeTipPos.bottom + 'px' } : {}">
									<div v-if="utageBadgeTipPos.mode === 'tooltip'" class="utageGlobalTipArrow" :style="{ left: utageBadgeTipPos.arrowLeft + 'px' }"></div>
									<div class="utageGlobalTipBody">
										<i class="ti ti-info-circle utageGlobalTipIcon"></i>
									<div class="utageGlobalTipText">
										<b>{{ profileTipCopy.title }}</b><br>
										{{ profileTipCopy.description }}
									</div>
									</div>
									<div class="utageGlobalTipFooter">
									<button class="utageGlobalTipBtn" @click="dismissUtageBadgeTip">{{ profileTipCopy.gotIt }}</button>
									</div>
								</div>
							</Teleport>
						</div>
						<div class="description">
							<MkOmit>
								<Mfm v-if="user.description" :text="user.description" :isNote="false" :author="user" :enableEmojiMenu="!!$i" class="_selectable"/>
								<p v-else class="empty">{{ i18n.ts.noAccountDescription }}</p>
							</MkOmit>
						</div>
						<div class="fields system">
							<dl v-if="user.location" class="field">
								<dt class="name"><i class="ti ti-map-pin ti-fw"></i> {{ i18n.ts.location }}</dt>
								<dd class="value">{{ user.location }}</dd>
							</dl>
							<dl v-if="user.birthday" class="field">
								<dt class="name"><i class="ti ti-cake ti-fw"></i> {{ i18n.ts.birthday }}</dt>
								<dd class="value">{{ user.birthday.replace('-', '/').replace('-', '/') }} ({{ i18n.tsx.yearsOld({ age }) }})</dd>
							</dl>
							<dl class="field">
								<dt class="name"><i class="ti ti-calendar ti-fw"></i> {{ i18n.ts.registeredDate }}</dt>
								<dd class="value">{{ dateString(user.createdAt) }} (<MkTime :time="user.createdAt"/>)</dd>
							</dl>
						</div>
						<div v-if="user.fields.length > 0" class="fields">
							<dl v-for="(field, i) in user.fields" :key="i" class="field">
								<dt class="name">
									<Mfm :text="field.name" :author="user" :plain="true" :colored="false" :enableEmojiMenu="!!$i" class="_selectable"/>
								</dt>
								<dd class="value">
									<Mfm :text="field.value" :author="user" :colored="false" :enableEmojiMenu="!!$i" class="_selectable"/>
									<i v-if="user.verifiedLinks.includes(field.value)" v-tooltip:dialog="i18n.ts.verifiedLink" class="ti ti-circle-check" :class="$style.verifiedLink"></i>
								</dd>
							</dl>
						</div>
						<div class="status">
							<MkA :to="userPage(user)">
								<b>{{ number(user.notesCount) }}</b>
								<span>{{ i18n.ts.notes }}</span>
							</MkA>
							<MkA v-if="isFollowingVisibleForMe(user)" :to="userPage(user, 'following')">
								<b>{{ number(user.followingCount) }}</b>
								<span>{{ i18n.ts.following }}</span>
							</MkA>
							<MkA v-if="isFollowersVisibleForMe(user)" :to="userPage(user, 'followers')">
								<b>{{ number(user.followersCount) }}</b>
								<span>{{ i18n.ts.followers }}</span>
							</MkA>
						</div>
					</div>
				</div>

				<div class="contents _gaps">
					<div v-if="user.pinnedNotes.length > 0 && !user.isBlocked" class="_gaps">
						<MkNote v-for="note in user.pinnedNotes" :key="note.id" class="note _panel" :note="note" :pinned="true"/>
					</div>
					<template v-if="narrow && !user.isBlocked">
						<MkLazy>
							<XFiles :key="user.id" :user="user" @showMore="emit('showMoreFiles')"/>
						</MkLazy>
						<MkLazy>
							<XActivity :key="user.id" :user="user"/>
						</MkLazy>
					</template>
					<div v-if="!disableNotes && !user.isBlocked">
						<MkLazy>
							<XTimeline ref="timelineEl" :user="user"/>
						</MkLazy>
					</div>
					<MkResult v-if="user.isBlocked" type="blocked" :user="user"/>
				</div>
			</div>
			<div v-if="!narrow && !user.isBlocked" class="sub _gaps" style="container-type: inline-size;">
				<XFiles :key="user.id" :user="user" @showMore="emit('showMoreFiles')"/>
				<XActivity :key="user.id" :user="user"/>
			</div>
		</div>
	</div>
</component>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch, ref, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import { getScrollContainer } from '@@/js/scroll.js';
import MkNote from '@/components/MkNote.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import MkAccountMoved from '@/components/MkAccountMoved.vue';
import MkFukidashi from '@/components/MkFukidashi.vue';
import MkRemoteCaution from '@/components/MkRemoteCaution.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkOmit from '@/components/MkOmit.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkButton from '@/components/MkButton.vue';
import MkHataProfileBadges from '@/components/MkHataProfileBadges.vue';
import { getUserMenu } from '@/utility/get-user-menu.js';
import number from '@/filters/number.js';
import { userPage } from '@/filters/user.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i, iAmModerator } from '@/i.js';
import { dateString } from '@/filters/date.js';
import { confetti } from '@/utility/confetti.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { isFollowingVisibleForMe, isFollowersVisibleForMe } from '@/utility/isFfVisibleForMe.js';
import { useRouter } from '@/router.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';
import MkSparkle from '@/components/MkSparkle.vue';
import { prefer } from '@/preferences.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { miLocalStorage } from '@/local-storage.js';
import { editNickname } from '@/utility/edit-nickname.js';
import { haptic, hapticConfirm } from '@/utility/haptic.js';
import detectLanguage from '@/utility/detect-language.js';
import { globalEvents } from '@/events.js';
import { notesSearchAvailable, canSearchNonLocalNotes } from '@/utility/check-permissions.js';
import { store } from '@/store.js';
import { getHataProfileBadges } from '@/utility/hata-profile-badges.js';
import type XTimeline_TypeReferenceOnly from './index.timeline.vue';

const profileTipCopy = i18n.ts._hata._profileTip;

function calcAge(birthdate: string): number {
	const date = new Date(birthdate);
	const now = new Date();

	let yearDiff = now.getFullYear() - date.getFullYear();
	const monthDiff = now.getMonth() - date.getMonth();
	const pastDate = now.getDate() < date.getDate();

	if (monthDiff < 0 || (monthDiff === 0 && pastDate)) {
		yearDiff--;
	}

	return yearDiff;
}

const XFiles = defineAsyncComponent(() => import('./index.files.vue'));
const XActivity = defineAsyncComponent(() => import('./index.activity.vue'));
const XTimeline = defineAsyncComponent(() => import('./index.timeline.vue'));

const props = withDefaults(defineProps<{
	user: Misskey.entities.UserDetailed;
	/** Refetches the user in place. Supplied by the parent page. */
	refreshUser?: () => Promise<void>;
	/** Test only; MkNotesTimeline currently causes problems in vitest */
	disableNotes?: boolean;
}>(), {
	refreshUser: undefined,
	disableNotes: false,
});

const emit = defineEmits<{
	(ev: 'showMoreFiles'): void;
}>();

const router = useRouter();

const user = ref(props.user);
const narrow = ref<null | boolean>(null);
const hataProfileBadges = computed(() => getHataProfileBadges(user.value, $i?.id ?? null));

// 旗鯖fork: 宴成功バッジの初回アナウンス吹き出しの表示状態
const utageBadgeTipVisible = ref(false);
// 旗鯖fork: 吹き出しを position:fixed で配置する際の座標。
// プロフィールの祖先に overflow:clip が掛かっているため、absolute だと下部が切られる。
// バッジ要素の getBoundingClientRect() からビューポート基準の座標を計算する。
const utageBadgeRef = useTemplateRef('utageBadgeRef');
const utageBadgeTipPos = ref<{ mode: 'tooltip' | 'sheet' | 'windowSheet'; top: number; left: number; right?: number; bottom?: number; placement: 'below' | 'above'; arrowLeft: number } | null>(null);

function updateUtageBadgeTipPos() {
	if (!utageBadgeRef.value) return;
	// 旗鯖fork: スマホ(画面狭幅)はバッジ追従ではなく画面下部にシート表示する。
	// モバイルブラウザのアドレスバー伸縮や visualViewport との座標系違いで
	// fixed の座標が安定しないため、画面下部固定の方が確実に見えて押せる。
	const MOBILE_BREAKPOINT = 600;
	if (window.innerWidth < MOBILE_BREAKPOINT) {
		utageBadgeTipPos.value = {
			mode: 'sheet',
			top: 0, left: 0, // sheet モードでは未使用(CSSで bottom 固定)
			placement: 'below', arrowLeft: 0, // sheet モードでは未使用(矢印非表示)
		};
		return;
	}
	// 旗鯖fork: ウィンドウ表示(MkWindow)内のときは、吹き出しが Teleport で body 直下(fixed=ビューポート基準)に
	// 出る都合上、バッジ追従だとウィンドウ枠の外(背後ページ上)へはみ出してしまう。
	// スマホ同様にシート化し、ウィンドウ枠の内側下部に固定して「そのウィンドウの説明」だと分かるようにする。
	const winEl = (utageBadgeRef.value as HTMLElement).closest('[data-mk-window]') as HTMLElement | null;
	if (winEl) {
		const wr = winEl.getBoundingClientRect();
		const m = 12;
		utageBadgeTipPos.value = {
			mode: 'windowSheet',
			top: 0,
			left: wr.left + m,
			right: window.innerWidth - wr.right + m,
			bottom: window.innerHeight - wr.bottom + m,
			placement: 'below', arrowLeft: 0, // windowSheet では未使用(矢印非表示)
		};
		return;
	}
	const rect = (utageBadgeRef.value as HTMLElement).getBoundingClientRect();
	// 吹き出し最大幅(CSSのmax-widthと一致させる) + 画面端マージン
	const tipMaxWidth = Math.min(300, window.innerWidth - 48);
	const margin = 8;
	// 左端基準で配置するが、右端を超えそうなら左に寄せる
	let left = rect.left;
	if (left + tipMaxWidth + margin > window.innerWidth) {
		left = Math.max(margin, window.innerWidth - tipMaxWidth - margin);
	}
	// 吹き出しの予想高さ(content + padding + footer = 約230px、長文時は350px程度)。
	// 余裕を見て 260px 確保できなければ「上出し」に切り替える。
	const estimatedTipHeight = 260;
	const spaceBelow = window.innerHeight - rect.bottom;
	const spaceAbove = rect.top;
	let top: number;
	let placement: 'below' | 'above';
	if (spaceBelow >= estimatedTipHeight + 10 || spaceBelow >= spaceAbove) {
		// 下に十分な余白がある or 下の方が広い → 下出し
		top = rect.bottom + 10;
		placement = 'below';
	} else {
		// 下に余裕無し+上の方が広い → 上出し
		top = rect.top - estimatedTipHeight - 10;
		if (top < margin) top = margin;
		placement = 'above';
	}
	// 矢印はバッジの中心を指すよう、吹き出しの左端からのオフセットを動的計算する。
	const badgeCenterX = rect.left + rect.width / 2;
	const arrowSize = 10;
	let arrowLeft = badgeCenterX - left - arrowSize / 2;
	const arrowMin = 12;
	const arrowMax = tipMaxWidth - 12 - arrowSize;
	arrowLeft = Math.max(arrowMin, Math.min(arrowMax, arrowLeft));
	utageBadgeTipPos.value = { mode: 'tooltip', top, left, placement, arrowLeft };
}

function dismissUtageBadgeTip() {
	utageBadgeTipVisible.value = false;
	// 二度と出さないため preference に記録(preferはマルチデバイス同期されるため媒体問わず通算1回)
	if (!prefer.s['simpleUi.utageBadgeTipShown']) {
		prefer.commit('simpleUi.utageBadgeTipShown', true);
	}
}

// スクロール時は座標再計算(または閉じる)。リサイズも同様。
function onUtageScrollOrResize() {
	if (!utageBadgeTipVisible.value) return;
	updateUtageBadgeTipPos();
}

const rootEl = useTemplateRef('rootEl');
const bannerEl = useTemplateRef('bannerEl');
const memoTextareaEl = useTemplateRef('memoTextareaEl');
const timelineEl = useTemplateRef<InstanceType<typeof XTimeline_TypeReferenceOnly>>('timelineEl');
const memoDraft = ref(props.user.memo);
const isEditingMemo = ref(false);
const moderationNote = ref(props.user.moderationNote ?? '');
const editModerationNote = ref(false);
const moderationNoteEditRevision = ref(0);
const isModerationNoteDirty = ref(false);

watch(moderationNote, async (newValue) => {
	if (newValue === (user.value.moderationNote ?? '')) {
		isModerationNoteDirty.value = false;
		return;
	}
	const editRevision = moderationNoteEditRevision.value;
	isModerationNoteDirty.value = true;
	await misskeyApi('admin/update-user-note', { userId: user.value.id, text: newValue });
	user.value = { ...user.value, moderationNote: newValue };
	if (editRevision === moderationNoteEditRevision.value) isModerationNoteDirty.value = false;
});

const playAnimation = ref(true);
if (prefer.s.showingAnimatedImages === 'interaction') playAnimation.value = false;
let playAnimationTimer = window.setTimeout(() => playAnimation.value = false, 5000);

const style = computed(() => {
	if (props.user.bannerUrl == null) return {};
	if (prefer.s.disableShowingAnimatedImages || prefer.s.dataSaver.avatar || (['interaction', 'inactive'].includes(<string>prefer.s.showingAnimatedImages) && !playAnimation.value)) {
		return {
			backgroundImage: `url(${ getStaticImageUrl(props.user.bannerUrl) })`,
		};
	} else {
		return {
			backgroundImage: `url(${ props.user.bannerUrl })`,
		};
	}
});

const age = computed(() => {
	return props.user.birthday ? calcAge(props.user.birthday) : NaN;
});

function menu(ev: MouseEvent) {
	const { menu, cleanup } = getUserMenu(user.value, router);
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(cleanup);
}

function showMemoTextarea() {
	isEditingMemo.value = true;
	nextTick(() => {
		memoTextareaEl.value?.focus();
	});
}

function adjustMemoTextarea() {
	if (!memoTextareaEl.value) return;
	memoTextareaEl.value.style.height = '0px';
	memoTextareaEl.value.style.height = `${memoTextareaEl.value.scrollHeight}px`;
}

async function updateMemo() {
	await misskeyApi('users/update-memo', {
		memo: memoDraft.value,
		userId: props.user.id,
	});
	isEditingMemo.value = false;
}

function resetTimer() {
	playAnimation.value = true;
	window.clearTimeout(playAnimationTimer);
	playAnimationTimer = window.setTimeout(() => playAnimation.value = false, 5000);
}

async function toggleNotify() {
	os.apiWithDialog('following/update', {
		userId: props.user.id,
		notify: props.user.notify === 'normal' ? 'none' : 'normal',
	}).then(() => {
		user.value.notify = user.value.notify === 'normal' ? 'none' : 'normal';
	});
}

watch(() => props.user, () => {
	user.value = props.user;
	if (!isModerationNoteDirty.value) moderationNote.value = props.user.moderationNote ?? '';
	if (!isEditingMemo.value) memoDraft.value = props.user.memo;
});

async function reload() {
	await Promise.allSettled([
		props.refreshUser?.(),
		timelineEl.value?.reload(),
	]);
}

let bannerParallaxResizeObserver: ResizeObserver | null = null;

function calcBannerParallax() {
	if (!bannerEl.value || !CSS.supports('view-timeline-inset', 'auto 100px')) return;
	const elRect = bannerEl.value.getBoundingClientRect();
	const scrollEl = getScrollContainer(bannerEl.value);
	const scrollPosition = scrollEl?.scrollTop ?? window.scrollY;
	const scrollContainerHeight = scrollEl?.clientHeight ?? window.innerHeight;
	const scrollContainerTop = scrollEl?.getBoundingClientRect().top ?? 0;
	const top = scrollPosition + elRect.top - scrollContainerTop;
	const bottom = scrollContainerHeight - top;
	bannerEl.value.style.setProperty('--bannerParallaxInset', `auto ${bottom}px`);
}

function initCalcBannerParallax() {
	const scrollEl = bannerEl.value ? getScrollContainer(bannerEl.value) : null;
	if (scrollEl != null && CSS.supports('view-timeline-inset', 'auto 100px')) {
		bannerParallaxResizeObserver = new ResizeObserver(() => {
			calcBannerParallax();
		});
		bannerParallaxResizeObserver.observe(scrollEl);
	}
}

function disposeBannerParallaxResizeObserver() {
	if (bannerParallaxResizeObserver) {
		bannerParallaxResizeObserver.disconnect();
		bannerParallaxResizeObserver = null;
	}
}

onMounted(() => {
	narrow.value = rootEl.value!.clientWidth < 1000;

	// 旗鯖fork: 宴成功バッジの初回アナウンス吹き出し。
	// 自分/他人どちらのプロフィールでも、preferが未表示(false)なら1回だけ出す。
	// 次のtickまで遅らせて、ページ遷移直後の連続描画と衝突しないようにする。
	if (!prefer.s['simpleUi.utageBadgeTipShown']) {
		nextTick(() => {
			updateUtageBadgeTipPos();
			utageBadgeTipVisible.value = true;
		});
	}
	// 吹き出し表示中のスクロール/リサイズで座標を追従する
	window.addEventListener('scroll', onUtageScrollOrResize, { passive: true, capture: true });
	window.addEventListener('resize', onUtageScrollOrResize, { passive: true });

	if (props.user.birthday) {
		const m = new Date().getMonth() + 1;
		const d = new Date().getDate();
		const bm = parseInt(props.user.birthday.split('-')[1]);
		const bd = parseInt(props.user.birthday.split('-')[2]);
		if (m === bm && d === bd) {
			confetti({
				duration: 1000 * 4,
			});
		}
	}

	nextTick(() => {
		calcBannerParallax();
		adjustMemoTextarea();
	});

	initCalcBannerParallax();

	if (prefer.s.showingAnimatedImages === 'inactive') {
		window.addEventListener('mousemove', resetTimer);
		window.addEventListener('touchstart', resetTimer);
		window.addEventListener('touchend', resetTimer);
	}
});

onActivated(() => {
	if (bannerEl.value) {
		calcBannerParallax();
		initCalcBannerParallax();
	}

	if (prefer.s.showingAnimatedImages === 'inactive') {
		window.removeEventListener('mousemove', resetTimer);
		window.removeEventListener('touchstart', resetTimer);
		window.removeEventListener('touchend', resetTimer);
	}
});

onUnmounted(disposeBannerParallaxResizeObserver);
// 旗鯖fork: 宴バッジ吹き出しのscroll/resizeリスナーを解除し、
//   Teleport で body 直下に出している吹き出しが画面に残らないよう必ず隠す。
//   (keep-alive で deactivate された場合や、ウィンドウ(MkWindow)を閉じた場合の残留対策)
onUnmounted(() => {
	window.removeEventListener('scroll', onUtageScrollOrResize, { capture: true } as any);
	window.removeEventListener('resize', onUtageScrollOrResize);
	utageBadgeTipVisible.value = false;
});
onDeactivated(() => {
	disposeBannerParallaxResizeObserver();
	utageBadgeTipVisible.value = false;
});
</script>

<style lang="scss" scoped>
.ftskorzw {
	> .main {
		> .punished {
			font-size: 0.8em;
			padding: 16px;
		}

		> .profile {
			> .main {
				position: relative;
				overflow: clip;

				> .banner-container {
					position: relative;
					--bannerHeight: 250px;
					height: var(--bannerHeight);
					overflow: clip;

					> .banner {
						width: 100%;
						height: 100%;
						background-size: cover;
						background-color: #4c5e6d;
						background-repeat: repeat-y;
						background-position-x: center;
						background-position-y: 50%;
						will-change: background-position-y;
					}

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 78px;
						background: linear-gradient(transparent, rgba(#000, 0.7));
					}

					> .followed {
						position: absolute;
						top: 12px;
						left: 12px;
						padding: 4px 8px;
						color: #fff;
						background: rgba(0, 0, 0, 0.7);
						font-size: 0.7em;
						border-radius: 6px;
					}

					> .actions {
						position: absolute;
						top: 12px;
						right: 12px;
						-webkit-backdrop-filter: var(--MI-blur, blur(8px));
						backdrop-filter: var(--MI-blur, blur(8px));
						background: rgba(0, 0, 0, 0.2);
						padding: 8px;
						border-radius: 24px;

						> .menu {
							vertical-align: bottom;
							height: 31px;
							width: 31px;
							color: #fff;
							text-shadow: 0 0 8px #000;
							font-size: 16px;
						}

						> .koudoku {
							margin-left: 4px;
							vertical-align: bottom;
						}
					}

					> .title {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						padding: 0 0 8px 154px;
						box-sizing: border-box;
						color: #fff;

						> .name {
							display: flex;
							gap: 8px;
							margin: -10px;
							padding: 10px;
							line-height: 32px;
							font-weight: bold;
							font-size: 1.8em;
							filter: drop-shadow(0 0 4px #000);
						}

						> .bottom {
							> * {
								display: inline-block;
								margin-right: 16px;
								line-height: 20px;
								opacity: 0.8;

								&.username {
									font-weight: bold;
								}
							}

							> .add-note-button {
								background: rgba(0, 0, 0, 0.2);
								color: #fff;
								-webkit-backdrop-filter: var(--MI-blur, blur(8px));
								backdrop-filter: var(--MI-blur, blur(8px));
								border-radius: 24px;
								padding: 4px 8px;
								font-size: 80%;
							}
						}
					}
				}

				> .title {
					display: none;
					text-align: center;
					padding: 50px 8px 16px 8px;
					font-weight: bold;
					border-bottom: solid 0.5px var(--MI_THEME-divider);

					> .bottom {
						> * {
							display: inline-block;
							margin-right: 8px;
							opacity: 0.8;
						}
					}
				}

				> .avatar {
					display: block;
					position: absolute;
					top: 170px;
					left: 16px;
					z-index: 2;
					width: 120px;
					height: 120px;
					box-shadow: 1px 1px 3px rgba(#000, 0.2);
				}

				> .followedMessage {
					padding: 24px 24px 0 154px;

					> .fukidashi {
						display: block;
						--fukidashi-bg: color-mix(in srgb, var(--MI_THEME-accent), var(--MI_THEME-panel) 85%);
						--fukidashi-radius: 16px;
						font-size: 0.9em;

						.messageHeader {
							opacity: 0.7;
							font-size: 0.85em;
						}
					}
				}

				> .roles {
					padding: 24px 24px 0 154px;
					font-size: 0.95em;
					display: flex;
					flex-wrap: wrap;
					gap: 8px;

					> .role {
						border: solid 1px var(--color, var(--MI_THEME-divider));
						border-radius: 999px;
						margin-right: 4px;
						padding: 3px 8px;
					}
				}

				> .moderationNote {
					margin: 12px 24px 0 154px;
				}

				> .memo {
					margin: 12px 24px 0 154px;
					background: transparent;
					color: var(--MI_THEME-fg);
					border: 1px solid var(--MI_THEME-divider);
					border-radius: 8px;
					padding: 8px;
					line-height: 0;

					> .heading {
						text-align: left;
						color: color(from var(--MI_THEME-fg) srgb r g b / 0.5);
						line-height: 1.5;
						font-size: 85%;
					}

					textarea {
						margin: 0;
						padding: 0;
						resize: none;
						border: none;
						outline: none;
						width: 100%;
						height: auto;
						min-height: 0;
						line-height: 1.5;
						color: var(--MI_THEME-fg);
						overflow: hidden;
						background: transparent;
						font-family: inherit;
					}
				}

				/* 旗鯖fork: 自鯖実績バッジ用ラッパー(吹き出しの位置基準) */
				> .utageSuccessWrapper {
					position: relative;
					margin: 16px 24px 0;
					display: flex;
					justify-content: center;

					/* 旗鯖fork: 吹き出し本体(.utageGlobalTip*) は Teleport で body 直下に出るため、
					   scoped CSS では効かない。<style>(scopedなし)ブロックでグローバル定義している。 */
				}

				> .description {
					padding: 24px 24px 24px 154px;
					font-size: 0.95em;

					div {
						> .empty {
							margin: 0;
							opacity: 0.5;
						}

						> .translateButton {
							margin-top: 10px;
						}

						> .translation {
							border: solid 0.5px var(--MI_THEME-divider);
							border-radius: var(--MI-radius);
							padding: 12px;
							margin-top: 8px;
						}
					}
				}

				> .fields {
					padding: 24px;
					font-size: 0.9em;
					border-top: solid 0.5px var(--MI_THEME-divider);

					> .field {
						display: flex;
						padding: 0;
						margin: 0;
						align-items: center;

						&:not(:last-child) {
							margin-bottom: 8px;
						}

						> .name {
							width: 30%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							font-weight: bold;
							text-align: center;
						}

						> .value {
							width: 70%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							margin: 0;
						}
					}

					&.system > .field > .name {
					}
				}

				> .status {
					display: flex;
					padding: 24px;
					border-top: solid 0.5px var(--MI_THEME-divider);

					> a {
						flex: 1;
						text-align: center;

						&.active {
							color: var(--MI_THEME-accent);
						}

						&:hover {
							text-decoration: none;
						}

						> b {
							display: block;
							line-height: 16px;
						}

						> span {
							font-size: 70%;
						}
					}

					>div {
						flex: 1;
						text-align: center;

						> i {
							display: block;
							line-height: 16px;
							margin: 0 auto;
						}

						> span {
							font-size: 70%;
						}
					}
				}
			}
		}

		> .contents {
			> .content {
				margin-bottom: var(--MI-margin);
			}
		}
	}

	&.wide {
		display: flex;
		width: 100%;

		> .main {
			width: 100%;
			min-width: 0;
		}

		> .sub {
			max-width: 350px;
			min-width: 350px;
			margin-left: var(--MI-margin);
		}
	}
}

@container (max-width: 500px) {
	.ftskorzw {
		> .main {
			> .profile > .main {
				> .banner-container {
					--bannerHeight: 140px;
					height: var(--bannerHeight);

					> .fade {
						display: none;
					}

					> .title {
						display: none;
					}
				}

				> .title {
					display: block;
				}

				> .avatar {
					top: 90px;
					left: 0;
					right: 0;
					width: 92px;
					height: 92px;
					margin: auto;
				}

				> .followedMessage {
					padding: 16px 16px 0 16px;
				}

				> .roles {
					padding: 16px 16px 0 16px;
					justify-content: center;
				}

				> .moderationNote {
					margin: 16px 16px 0 16px;

					div {
						> .moderationNoteButton {
							margin: 0 auto;
						}
					}
				}

				/* 狭い表示でもバッジ群をカード全体の中央に保つ。 */
				> .utageSuccessWrapper {
					margin: 16px 16px 0;
				}

				> .memo {
					margin: 16px 16px 0 16px;
				}

				> .description {
					padding: 16px;
					text-align: center;

					div {
						> .translateButton {
							margin: 10px auto 0;
						}
					}
				}

				> .fields {
					padding: 16px;
				}

				> .status {
					padding: 16px;
				}
			}

			> .contents {
				> .nav {
					font-size: 80%;
				}
			}
		}
	}
}

@supports (view-timeline-name: --name) {
	.ftskorzw {
		> .main {
			> .profile > .main {
				> .banner-container {
					view-timeline-name: --bannerParallax;
					view-timeline-inset: var(--bannerParallaxInset, auto);
					view-timeline-axis: block;

					> .banner {
						animation: bannerParallaxKeyframes linear both;
						animation-timeline: --bannerParallax;
						animation-range: cover;
					}
				}
			}
		}
	}
}

@keyframes bannerParallaxKeyframes {
	from {
		background-position-y: 50%;
	}
	to {
		background-position-y: calc(50% + var(--bannerHeight, 250px) / 3);
	}
}
</style>

<style lang="scss" module>
.tl {
	background: var(--MI_THEME-bg);
	border-radius: var(--MI-radius);
	overflow: clip;
}

.verifiedLink {
	margin-left: 4px;
	color: var(--MI_THEME-success);
}
</style>

<style lang="scss">
/* 旗鯖fork: 宴成功バッジの初回アナウンス吹き出し。
   <Teleport to="body"> で body 直下に出すため scoped CSS が効かないので、
   グローバルスコープでユニークなクラス名(.utageGlobalTip*)を使って定義する。 */
.utageGlobalTip {
	position: fixed;
	z-index: 9999;
	max-width: min(300px, calc(100vw - 48px));
	min-width: 180px;
	background: var(--MI_THEME-panel);
	border: 1.5px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
	border-radius: 10px;
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
	padding: 10px 12px 8px;
	animation: utageGlobalTipFadeIn 0.25s ease-out;

	/* 旗鯖fork: スマホ時(画面下部シート表示)。バッジ追従ではなく画面下端固定。
	   モバイルの座標系のブレ(visualViewport/アドレスバー伸縮)を完全に回避できる。 */
	&.utageGlobalTipSheet {
		top: auto !important;
		left: 16px !important;
		right: 16px;
		bottom: 16px;
		max-width: none;
		min-width: 0;
		padding: 14px 16px 12px;
		border-radius: 14px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
		animation: utageGlobalTipSheetSlideUp 0.3s ease-out;
	}

	/* 旗鯖fork: ウィンドウ表示内のシート。位置(left/right/bottom)は JS からインライン指定し、
	   ウィンドウ枠の内側下部に固定する。!important で潰さないようここでは位置を指定しない。 */
	&.utageGlobalTipWindowSheet {
		top: auto;
		max-width: none;
		min-width: 0;
		padding: 14px 16px 12px;
		border-radius: 14px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
		animation: utageGlobalTipSheetSlideUp 0.3s ease-out;
	}

	> .utageGlobalTipArrow {
		position: absolute;
		/* left はJSから動的指定される(バッジ中心に追従) */
		width: 10px;
		height: 10px;
		background: var(--MI_THEME-panel);
	}
	/* 下出し時: 矢印は吹き出しの上端で上向き */
	&.utageGlobalTipBelow > .utageGlobalTipArrow {
		top: -6px;
		border-top: 1.5px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
		border-left: 1.5px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
		transform: rotate(45deg);
	}
	/* 上出し時: 矢印は吹き出しの下端で下向き */
	&.utageGlobalTipAbove > .utageGlobalTipArrow {
		bottom: -6px;
		border-bottom: 1.5px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
		border-right: 1.5px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
		transform: rotate(45deg);
	}
	> .utageGlobalTipBody {
		display: flex;
		gap: 6px;
		align-items: flex-start;
		font-size: 0.85em;
		line-height: 1.5;
		color: var(--MI_THEME-fg);

		> .utageGlobalTipIcon {
			flex-shrink: 0;
			font-size: 1.15em;
			color: var(--MI_THEME-accent);
			margin-top: 1px;
		}
		> .utageGlobalTipText {
			flex: 1;
			min-width: 0;
			word-break: break-word;

			b {
				display: block;
				margin-bottom: 3px;
				font-size: 1em;
			}
		}
	}
	> .utageGlobalTipFooter {
		margin-top: 8px;
		text-align: center;

		> .utageGlobalTipBtn {
			padding: 5px 18px;
			background: var(--MI_THEME-accent);
			color: var(--MI_THEME-fgOnAccent);
			border: none;
			border-radius: 999px;
			font-size: 0.85em;
			font-weight: 700;
			cursor: pointer;
			font-family: inherit;
			transition: opacity 0.15s;

			&:hover {
				opacity: 0.85;
			}
		}
	}
}

@keyframes utageGlobalTipFadeIn {
	from { opacity: 0; transform: translateY(-4px); }
	to { opacity: 1; transform: translateY(0); }
}
@keyframes utageGlobalTipSheetSlideUp {
	from { opacity: 0; transform: translateY(12px); }
	to { opacity: 1; transform: translateY(0); }
}

/* =======================================================================
   旗鯖fork: UI 2 / S のプロフィールカードをガラス面にする。
   scoped ではプレフィックスの都合で :global を跨げないため、ページ固有ラッパ .ftskorzw
   配下に限定した非scopedグローバルとして定義(他ページの .main/.profile に影響させない)。
   ぼかしは --MI-blur (useBlurEffect=false で none) を尊重。
   ======================================================================= */
html:is(.hataGlassUi, [data-hk3-ui]) .ftskorzw > .main > .profile > .main {
	background: var(--hk3-glass-soft, color-mix(in srgb, var(--MI_THEME-panel) 70%, transparent));
	-webkit-backdrop-filter: var(--MI-blur, blur(20px)) saturate(1.5);
	backdrop-filter: var(--MI-blur, blur(20px)) saturate(1.5);
}
/* ぼかしバナー背景レイヤ(通常は非表示・グラス時のみ表示)。
   カードの角丸内に収めるため親 .main の overflow:clip(既存)で切り取られる。 */
.profileBgBlur {
	display: none;
}
html:is(.hataGlassUi, [data-hk3-ui]) .ftskorzw > .main > .profile > .main > .profileBgBlur {
	display: block;
	position: absolute;
	inset: -60px;
	z-index: 0;
	background-size: cover;
	background-position: center;
	filter: blur(48px) saturate(1.3);
	transform: scale(1.2);
	pointer-events: none;
}
/* 既存のプロフィールぼかしOFF設定を UI 2 / S で共有する。<html> に
   'hataProfileNoBannerBg' クラスが付いている時 (simpleUi.profileNoBannerBg = true)、
   プロフィールカードのぼかしレイヤを非表示にする。
   同時にプロフィールカード面 (.main の背景) を不透明パネルに戻すことで、背景が透けない
   従来カードの見た目を維持する。 */
html:is(.hataGlassUi, [data-hk3-ui]).hataProfileNoBannerBg .ftskorzw > .main > .profile > .main > .profileBgBlur {
	display: none !important;
}
html:is(.hataGlassUi, [data-hk3-ui]).hataProfileNoBannerBg .ftskorzw > .main > .profile > .main {
	background: var(--MI_THEME-panel) !important;
	-webkit-backdrop-filter: none !important;
	backdrop-filter: none !important;
}
/* 視認性ベール(ライト/ダーク両対応)。
   --MI_THEME-bg ベースなので、ライトは明るいベール(暗い文字が映える)、ダークは暗いベール
   (明るい文字が映える)と、テーマに応じてコントラストが取れる方向に自動で働く。
   ヘッダー画像の色がベールを突き抜けて文字と干渉しないよう、やや濃いめ(72%)にしている
   (28% はぼかし画像が残るのでヒーロー感は保たれる)。 */
html:is(.hataGlassUi, [data-hk3-ui]) .ftskorzw > .main > .profile > .main > .profileBgBlur::after {
	content: "";
	position: absolute;
	inset: 0;
	background: color-mix(in srgb, var(--MI_THEME-bg) 72%, transparent);
}
/* 前面の実コンテンツはガラス面/ぼかし背景の上に来るよう z-index を持ち上げる。
   ⚠️ここに漏れた直下の子は、静的配置のため .profileBgBlur(position:absolute; z-index:0)
   より先に描画され、ぼかしバナー層の下に隠れる。
   実際に .title(アバター下の名前・表示名) が漏れており、
   「グラスUI × 狭い幅(コンテナ500px以下)」でプロフィールの名前が消えていた
   (広い幅ではバナー上の .banner-container > .title が使われるため再現しない＝"場合がある"の正体)。
   ⚠️.profile > .main の直下に子を足したら、必ずこのリストにも足すこと。 */
html:is(.hataGlassUi, [data-hk3-ui]) .ftskorzw > .main > .profile > .main > :is(.banner-container, .title, .followedMessage, .roles, .moderationNote, .memo, .utageSuccessWrapper, .description, .fields, .status) {
	position: relative;
	z-index: 1;
}

/* プロフィール内だけ、埋め込みTLとピン留めノートへSのガラス面を渡す。 */
html[data-hk3-ui] .ftskorzw {
	--MI-notes-canvas: transparent;
	--MI-notes-surface: var(--hk3-glass-note, color-mix(in srgb, var(--MI_THEME-panel) 70%, transparent));
	--MI-notes-backdrop-filter: var(--MI-blur, blur(20px)) saturate(1.3);
}
html[data-hk3-ui] .ftskorzw > .main > .contents > ._gaps > .note {
	background: var(--MI-notes-surface);
	-webkit-backdrop-filter: var(--MI-notes-backdrop-filter);
	backdrop-filter: var(--MI-notes-backdrop-filter);
}
</style>
