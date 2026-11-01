<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="isPulling ? $style.isPulling : null">
	<!-- 小数が含まれるとレンダリングが高頻度になりすぎパフォーマンスが悪化するためround -->
	<div v-if="isPulling" :class="$style.frame" :style="`--frame-min-height: ${Math.round(pullDistance / (PULL_BRAKE_BASE + (pullDistance / PULL_BRAKE_FACTOR)))}px;`">
		<div :class="$style.frameContent">
			<MkLoading v-if="isRefreshing" :class="$style.loader" :em="true"/>
			<i v-else class="ti ti-arrow-bar-to-down" :class="[$style.icon, { [$style.refresh]: isPulledEnough }]"></i>
			<div :class="$style.text">
				<template v-if="isPulledEnough">{{ i18n.ts.releaseToRefresh }}</template>
				<template v-else-if="isRefreshing">{{ i18n.ts.refreshing }}</template>
				<template v-else>{{ i18n.ts.pullDownToRefresh }}</template>
			</div>
		</div>
	</div>

	<slot/>
</div>
</template>

<script lang="ts" setup>
import { inject, onDeactivated, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { getScrollContainer } from '@@/js/scroll.js';
import { i18n } from '@/i18n.js';
import { isHorizontalSwipeSwiping } from '@/utility/touch.js';
import { haptic } from '@/utility/haptic.js';
import { attachNavbarPullGesture, navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';

const navbarPull = inject(navbarPullRefreshKey, null);
let navbarGesture: ReturnType<typeof attachNavbarPullGesture> | undefined;

const SCROLL_STOP = 10;
const MAX_PULL_DISTANCE = Infinity;
const FIRE_THRESHOLD = 200;
const RELEASE_TRANSITION_DURATION = 200;
const PULL_BRAKE_BASE = 1.5;
const PULL_BRAKE_FACTOR = 170;

const isPulling = ref(false);
const isPulledEnough = ref(false);
const isRefreshing = ref(false);
const pullDistance = ref(0);

let startScreenY: number | null = null;
let startScreenX = 0;
let mounted = false;
let releaseVersion = 0;
let stopMove: (() => void) | undefined;

const rootEl = useTemplateRef('rootEl');
let scrollEl: HTMLElement | null = null;

const props = withDefaults(defineProps<{
	refresher: () => Promise<void>;
}>(), {
	refresher: () => Promise.resolve(),
});

const emit = defineEmits<{
	(ev: 'refresh'): void;
}>();

function getScreenPosition(event: TouchEvent | MouseEvent): { screenX: number; screenY: number } {
	return 'touches' in event ? event.touches[0] : event;
}

function removeGestureListeners() {
	window.removeEventListener('mousemove', moving);
	window.removeEventListener('mouseup', onPullRelease);
	window.removeEventListener('touchmove', moving);
	window.removeEventListener('touchend', onPullRelease);
	window.removeEventListener('touchcancel', cancelPull);
}

function cancelPull() {
	removeGestureListeners();
	startScreenY = null;
	isPulledEnough.value = false;
	const version = ++releaseVersion;
	closeContent().then(() => {
		if (mounted && version === releaseVersion) isPulling.value = false;
	});
}

// When at the top of the page, disable vertical overscroll so passive touch listeners can take over.
function lockDownScroll() {
	if (navbarPull) return;
	if (scrollEl == null) return;
	scrollEl.style.touchAction = 'pan-x pan-down pinch-zoom';
	scrollEl.style.overscrollBehavior = 'auto none';
}

function unlockDownScroll() {
	if (scrollEl == null) return;
	scrollEl.style.touchAction = 'auto';
	scrollEl.style.overscrollBehavior = 'auto contain';
}

function moveStartByMouse(event: MouseEvent) {
	if (navbarPull) return;
	if (event.button !== 1) return;
	if (isRefreshing.value || isPulling.value || scrollEl == null) return;

	const scrollPos = scrollEl.scrollTop;
	if (scrollPos !== 0) {
		unlockDownScroll();
		return;
	}

	lockDownScroll();

	event.preventDefault(); // 中クリックによるスクロール、テキスト選択などを防ぐ

	isPulling.value = true;
	const point = getScreenPosition(event);
	startScreenX = point.screenX;
	startScreenY = point.screenY;
	pullDistance.value = 0;

	window.addEventListener('mousemove', moving, { passive: true });
	window.addEventListener('mouseup', onPullRelease, { passive: true });
}

function moveStartByTouch(event: TouchEvent) {
	if (navbarPull) return;
	if (isRefreshing.value) return;
	if (event.touches.length !== 1) {
		if (isPulling.value) cancelPull();
		return;
	}
	if (isPulling.value || scrollEl == null) return;

	const scrollPos = scrollEl.scrollTop;
	if (scrollPos !== 0) {
		unlockDownScroll();
		return;
	}

	lockDownScroll();

	isPulling.value = true;
	const point = getScreenPosition(event);
	startScreenX = point.screenX;
	startScreenY = point.screenY;
	pullDistance.value = 0;

	window.addEventListener('touchmove', moving, { passive: true });
	window.addEventListener('touchend', onPullRelease, { passive: true });
	window.addEventListener('touchcancel', cancelPull, { passive: true });
}

function moveBySystem(to: number): Promise<void> {
	stopMove?.();
	return new Promise(r => {
		const startHeight = pullDistance.value;
		const overHeight = pullDistance.value - to;
		if (overHeight < 1) {
			r();
			return;
		}
		const startTime = Date.now();
		const intervalId = window.setInterval(() => {
			const time = Date.now() - startTime;
			if (time > RELEASE_TRANSITION_DURATION) {
				pullDistance.value = to;
				window.clearInterval(intervalId);
				stopMove = undefined;
				r();
				return;
			}
			const nextHeight = startHeight - (overHeight / RELEASE_TRANSITION_DURATION) * time;
			if (pullDistance.value < nextHeight) return;
			pullDistance.value = nextHeight;
		}, 1);
		stopMove = () => {
			window.clearInterval(intervalId);
			stopMove = undefined;
			r();
		};
	});
}

async function fixOverContent() {
	if (pullDistance.value > FIRE_THRESHOLD) {
		await moveBySystem(FIRE_THRESHOLD);
	}
}

async function closeContent() {
	if (pullDistance.value > 0) {
		await moveBySystem(0);
	}
}

function onPullRelease() {
	removeGestureListeners();
	startScreenY = null;
	const version = ++releaseVersion;
	if (isPulledEnough.value) {
		isPulledEnough.value = false;
		isRefreshing.value = true;
		fixOverContent().then(() => {
			if (!mounted || version !== releaseVersion) return;
			emit('refresh');
			props.refresher().then(() => {
				if (mounted && version === releaseVersion) refreshFinished();
			});
		});
	} else {
		closeContent().then(() => {
			if (mounted && version === releaseVersion) isPulling.value = false;
		});
	}
}

function toggleScrollLockOnTouchEnd() {
	if (scrollEl == null) return;
	const scrollPos = scrollEl.scrollTop;
	if (scrollPos === 0) {
		lockDownScroll();
	} else {
		unlockDownScroll();
	}
}

function moving(event: MouseEvent | TouchEvent) {
	if (startScreenY === null) return;
	if ('touches' in event && event.touches.length !== 1) {
		cancelPull();
		return;
	}
	const point = getScreenPosition(event);
	const moveHeight = point.screenY - startScreenY;
	const horizontalDistance = Math.abs(point.screenX - startScreenX);
	if ((scrollEl?.scrollTop ?? 0) > SCROLL_STOP + pullDistance.value || isHorizontalSwipeSwiping.value ||
		(horizontalDistance > SCROLL_STOP && horizontalDistance > Math.abs(moveHeight))) {
		cancelPull();
		return;
	}
	pullDistance.value = Math.min(Math.max(moveHeight, 0), MAX_PULL_DISTANCE);

	isPulledEnough.value = pullDistance.value >= FIRE_THRESHOLD;

	if (isPulledEnough.value) haptic();
}

/**
 * emit(refresh)が完了したことを知らせる関数
 *
 * タイムアウトがないのでこれを最終的に実行しないと出たままになる
 */
function refreshFinished() {
	const version = releaseVersion;
	closeContent().then(() => {
		if (!mounted || version !== releaseVersion) return;
		isPulling.value = false;
		isRefreshing.value = false;
	});
}

onMounted(() => {
	if (rootEl.value == null) return;
	mounted = true;
	scrollEl = getScrollContainer(rootEl.value);
	if (navbarPull && scrollEl) navbarGesture = attachNavbarPullGesture(rootEl.value, scrollEl, navbarPull, async () => {
		emit('refresh');
		await (navbarPull.refresher ?? props.refresher)();
	});
	lockDownScroll();
	rootEl.value.addEventListener('mousedown', moveStartByMouse, { passive: false }); // preventDefaultするため
	rootEl.value.addEventListener('touchstart', moveStartByTouch, { passive: true });
	rootEl.value.addEventListener('touchend', toggleScrollLockOnTouchEnd, { passive: true });
});

onDeactivated(() => navbarGesture?.reset());

onUnmounted(() => {
	navbarGesture?.dispose();
	mounted = false;
	releaseVersion++;
	removeGestureListeners();
	stopMove?.();
	unlockDownScroll();
	if (rootEl.value) rootEl.value.removeEventListener('mousedown', moveStartByMouse);
	if (rootEl.value) rootEl.value.removeEventListener('touchstart', moveStartByTouch);
	if (rootEl.value) rootEl.value.removeEventListener('touchend', toggleScrollLockOnTouchEnd);
});
</script>

<style lang="scss" module>
.isPulling {
	will-change: contents;
}

.frame {
	position: relative;
	overflow: clip;

	width: 100%;
	min-height: var(--frame-min-height, 0px);

	// box-shadow: inset 0px -7px 10px -10px rgba(0,0,0,.1);
	mask-image: linear-gradient(90deg, #000 0%, #000 80%, transparent);
	-webkit-mask-image: -webkit-linear-gradient(90deg, #000 0%, #000 80%, transparent);

	pointer-events: none;
}

.frameContent {
	position: absolute;
	bottom: 0;
	width: 100%;
	margin: 5px 0;
	display: flex;
	flex-direction: column;
	align-items: center;

	> .icon, > .loader {
		margin: 6px 0;
	}

	> .icon {
    font-size: 14px;
		transition: transform .25s;

		&.refresh {
			transform: rotate(180deg);
		}
	}
}

.text {
	margin: 5px 0;
	font-size: 90%;
}
</style>
