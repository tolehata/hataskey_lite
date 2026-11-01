<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_popup_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_popup_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_popup_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_popup_leaveTo : ''"
	appear @afterLeave="emit('closed')"
>
	<div v-if="showing" :class="[$style.root, { _popup: !prefer.s.useBlurEffect || !prefer.s.useBlurEffectForModal || !prefer.s.removeModalBgColorForBlur, _popupAcrylic: prefer.s.useBlurEffect && prefer.s.useBlurEffectForModal && prefer.s.removeModalBgColorForBlur }]" class="_shadow" :style="popupStyle" @pointermove="onPointerMove" @pointerleave="resetTilt" @mouseover="() => { emit('mouseover'); }" @mouseleave="() => { if (!menuShowing) emit('mouseleave'); }">
		<MkError v-if="error" @retry="fetchUser()"/>
		<div v-else-if="user != null">
			<div :class="$style.banner" :style="user.bannerUrl ? { backgroundImage: `url(${prefer.s.disableShowingAnimatedImages ? getStaticImageUrl(user.bannerUrl) : user.bannerUrl})` } : ''">
				<span v-if="$i && $i.id != user.id && user.isFollowed" :class="$style.followed">{{ i18n.ts.followsYou }}</span>
			</div>
			<!-- 旗鯖fork: アイコン背後の吹き出し風SVG装飾を削除 (項目18) -->
			<MkAvatar :class="$style.avatar" :user="user" indicator/>
			<div :class="$style.title">
				<MkA :class="$style.name" :to="userPage(user)"><MkUserName :user="user" :nowrap="false"/></MkA>
				<div :class="$style.username"><MkAcct :user="user"/></div>
				<div v-if="('isAdmin' in user && user.isAdmin) || user.isLocked || user.isBot || ('isProxy' in user && user.isProxy)" style="margin-top: 4px;">
					<span v-if="'isAdmin' in user && user.isAdmin" v-tooltip="i18n.ts.administrator" style="color: var(--MI_THEME-badge);"><i class="ti ti-shield"></i></span>
					<span v-if="user.isLocked" v-tooltip="i18n.ts.makeFollowManuallyApprove"><i class="ti ti-lock"></i></span>
					<span v-if="user.isBot"><i class="ti ti-robot"></i></span>
					<span v-if="'isProxy' in user && user.isProxy" v-tooltip="i18n.ts.proxyAccount"><i class="ti ti-ghost"></i></span>
				</div>
			</div>
			<div :class="$style.description">
				<Mfm v-if="user.description" :class="$style.mfm" :text="user.description" :author="user"/>
				<div v-else style="opacity: 0.7;">{{ i18n.ts.noAccountDescription }}</div>
			</div>
			<div :class="$style.status">
				<MkA :to="userPage(user)" :class="$style.statusItem">
					<div :class="$style.statusItemLabel">{{ i18n.ts.notes }}</div>
					<b>{{ number(user.notesCount) }}</b>
				</MkA>
				<MkA v-if="isFollowingVisibleForMe(user)" :class="$style.statusItem" :to="userPage(user, 'following')">
					<div :class="$style.statusItemLabel">{{ i18n.ts.following }}</div>
					<b>{{ number(user.followingCount) }}</b>
				</MkA>
				<MkA v-if="isFollowersVisibleForMe(user)" :class="$style.statusItem" :to="userPage(user, 'followers')">
					<div :class="$style.statusItemLabel">{{ i18n.ts.followers }}</div>
					<b>{{ number(user.followersCount) }}</b>
				</MkA>
			</div>
			<button class="_button" :class="[$style.menu, { [$style.isBlocked]: user.isBlocked || user.isBlocking }]" @click="showMenu"><i class="ti ti-dots"></i></button>
			<button v-tooltip="user.notify === 'none' ? i18n.ts.notifyNotes : i18n.ts.unnotifyNotes" class="_button" :class="[$style.notify, { [$style.isBlocked]: user.isBlocked || user.isBlocking }]" @click="toggleNotify"><i :class="user.notify === 'none' ? 'ti ti-bell-plus' : 'ti ti-bell-minus'"></i></button>
			<MkFollowButton v-if="!user.isBlocked && !user.isBlocking" v-model:user="user" :class="$style.follow" mini/>
		</div>
		<div v-else>
			<MkLoading/>
		</div>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkFollowButton from '@/components/MkFollowButton.vue';
import { userPage } from '@/filters/user.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { getUserMenu } from '@/utility/get-user-menu.js';
import number from '@/filters/number.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { isFollowingVisibleForMe, isFollowersVisibleForMe } from '@/utility/isFfVisibleForMe.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';

const props = defineProps<{
	showing: boolean;
	q: string | Misskey.entities.UserDetailed;
	source: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'mouseover'): void;
	(ev: 'mouseleave'): void;
}>();

const zIndex = os.claimZIndex('middle');
const user = ref<Misskey.entities.UserDetailed | null>(null);
const top = ref(0);
const left = ref(0);
const error = ref(false);
const tiltX = ref(0);
const tiltY = ref(0);
const lightX = ref(50);
const lightY = ref(28);
// モバイル・タブレット判定 (ボトムシート表示用)
const isMobile = ref(window.innerWidth <= 800);
function updateIsMobile() { isMobile.value = window.innerWidth <= 800; }
const popupStyle = computed(() => isMobile.value ? { zIndex } : {
	zIndex,
	top: `${top.value}px`,
	left: `${left.value}px`,
	'--hata-card-tilt-x': `${tiltX.value}deg`,
	'--hata-card-tilt-y': `${tiltY.value}deg`,
	'--hata-card-light-x': `${lightX.value}%`,
	'--hata-card-light-y': `${lightY.value}%`,
});

function onPointerMove(event: PointerEvent) {
	if (isMobile.value || event.pointerType === 'touch' || !prefer.s.animation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const target = event.currentTarget as HTMLElement;
	const rect = target.getBoundingClientRect();
	const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
	const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
	tiltX.value = -ny * 1.8;
	tiltY.value = nx * 2.4;
	lightX.value = 50 + nx * 32;
	lightY.value = 32 + ny * 22;
}

function resetTilt() {
	tiltX.value = 0;
	tiltY.value = 0;
	lightX.value = 50;
	lightY.value = 28;
}

// 旗鯖fork: メニュー(...)を開いている間は mouseleave による自動クローズを抑制する。
// メニューを開くとマウスがポップアップ外へ出て mouseleave が発火し、
// ポップアップ本体が閉じてメニューだけ残る問題への対処 (項目17)。
const menuShowing = ref(false);

function showMenu(ev: MouseEvent) {
	if (user.value == null) return;
	const { menu, cleanup } = getUserMenu(user.value);
	menuShowing.value = true;
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(() => {
		cleanup();
		// メニューを閉じたら抑制を解除。以降、マウスがポップアップ外に出れば
		// 通常通り mouseleave → 自動クローズが効く。
		menuShowing.value = false;
	});
}

async function fetchUser() {
	if (typeof props.q === 'object') {
		user.value = props.q;
		error.value = false;
	} else {
		const query: Misskey.entities.UsersShowRequest = props.q.startsWith('@') ?
			Misskey.acct.parse(props.q.substring(1)) :
			{ userId: props.q };

		misskeyApi('users/show', query).then(res => {
			if (!props.showing) return;
			user.value = res;
			error.value = false;
		}, () => {
			error.value = true;
		});
	}
}

async function toggleNotify() {
	if (!user.value) return;

	os.apiWithDialog('following/update', {
		userId: user.value.id,
		notify: user.value.notify === 'normal' ? 'none' : 'normal',
	}).then(() => {
		if (user.value) user.value.notify = user.value.notify === 'normal' ? 'none' : 'normal';
	});
}

onMounted(() => {
	fetchUser();

	const rect = props.source.getBoundingClientRect();
	const rawX = ((rect.left + (props.source.offsetWidth / 2)) - (368 / 2)) + window.scrollX;
	const x = Math.max(window.scrollX + 8, Math.min(window.scrollX + window.innerWidth - 376, rawX));
	const y = rect.top + props.source.offsetHeight + window.scrollY;

	top.value = y;
	left.value = x;

	window.addEventListener('resize', updateIsMobile, { passive: true });
});

onUnmounted(() => {
	window.removeEventListener('resize', updateIsMobile);
});
</script>

<style lang="scss" module>
.transition_popup_enterActive,
.transition_popup_leaveActive {
	transition: opacity 0.15s, transform 0.15s !important;
}
.transition_popup_enterFrom,
.transition_popup_leaveTo {
	opacity: 0;
	transform: scale(0.9);
}

.root {
	position: absolute;
	width: 368px;
	overflow: clip;
	transform-origin: center top;
	transform: perspective(900px) rotateX(var(--hata-card-tilt-x, 0deg)) rotateY(var(--hata-card-tilt-y, 0deg));
	transition: transform .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s ease;
	will-change: transform;
}

/* ===== モバイル・タブレット: ボトムシート表示 ===== */
@media (max-width: 800px) {
	.transition_popup_enterActive,
	.transition_popup_leaveActive {
		transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
	}
	.transition_popup_enterFrom,
	.transition_popup_leaveTo {
		opacity: 0 !important;
		transform: translateY(100%) !important;
	}

	.root {
		position: fixed !important;
		left: 0 !important;
		right: 0 !important;
		top: auto !important;
		bottom: 0 !important;
		width: 100% !important;
		max-width: 100% !important;
		max-height: 85dvh;
		overflow-y: auto;
		border-radius: 20px 20px 0 0;
		transform-origin: bottom center;
		padding-bottom: env(safe-area-inset-bottom, 0);
		box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25);
		transform: none;
		will-change: auto;

		/* ドラッグハンドル風の上部つまみ */
		&::before {
			content: "";
			position: sticky;
			top: 8px;
			display: block;
			width: 40px;
			height: 4px;
			margin: 8px auto 0;
			background: color-mix(in srgb, var(--MI_THEME-fg) 25%, transparent);
			border-radius: 2px;
			z-index: 10;
		}

		/* スクロールバー */
		&::-webkit-scrollbar { width: 4px; }
		&::-webkit-scrollbar-thumb {
			background: color-mix(in srgb, var(--MI_THEME-fg) 20%, transparent);
			border-radius: 2px;
		}
	}
}

.banner {
	position: relative;
	height: 166px;
	overflow: hidden;
	background-color: rgba(0, 0, 0, 0.1);
	background-size: cover;
	background-position: center;

	&::before {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, .02), rgba(0, 0, 0, .34));
		pointer-events: none;
	}

	&::after {
		content: "";
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at var(--hata-card-light-x, 50%) var(--hata-card-light-y, 28%), rgba(255, 255, 255, .34), transparent 42%);
		pointer-events: none;
		mix-blend-mode: soft-light;
		transition: background-position .18s ease;
	}

}

.followed {
	position: absolute;
	top: 12px;
	left: 12px;
	padding: 4px 8px;
	color: #fff;
	background: rgba(0, 0, 0, 0.7);
	font-size: 0.7em;
	border-radius: 6px;
}

.avatar {
	display: block;
	position: absolute;
	top: 119px;
	left: 0;
	right: 0;
	margin: 0 auto;
	z-index: 2;
	width: 86px;
	height: 86px;
	border: solid 4px var(--MI_THEME-popup);
	border-radius: 30%;
	background: var(--MI_THEME-popup);
	box-shadow: 0 12px 32px rgba(0, 0, 0, .24);
}

.title {
	position: relative;
	z-index: 3;
	display: block;
	padding: 8px 26px 16px 26px;
	margin-top: 34px;
	text-align: center;
}

.name {
	display: inline-block;
	font-weight: bold;
	word-break: break-all;
}

.username {
	display: block;
	font-size: 0.8em;
	opacity: 0.7;
}

.description {
	padding: 16px 26px;
	font-size: 0.8em;
	text-align: center;
	border-top: solid 1px var(--MI_THEME-divider);
	border-bottom: solid 1px var(--MI_THEME-divider);
}

.mfm {
	display: -webkit-box;
	-webkit-line-clamp: 5;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.status {
	display: flex;
	padding: 16px 26px 16px 26px;
}

.statusItem {
	display: inline-block;
	width: 33%;
	text-align: center;
	flex: 1;

	&:hover {
		text-decoration: none;
	}
}

.statusItemLabel {
	font-size: 0.7em;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
}

.menu,
.notify {
	position: absolute;
	top: 8px;
	right: 80px;
	padding: 6px;
	background: var(--MI_THEME-panel);
	border-radius: 999px;
}

.menu {
	&.isBlocked {
		right: 44px;
	}
}

.notify {
	right: 44px;

	&.isBlocked {
		right: 8px;
	}
}

.follow {
	position: absolute !important;
	top: 8px;
	right: 8px;
}

@media (prefers-reduced-motion: reduce) {
	.transition_popup_enterActive,
	.transition_popup_leaveActive,
	.root,
	.banner::after {
		transition: none !important;
	}

	.root {
		transform: none;
	}
}
</style>
