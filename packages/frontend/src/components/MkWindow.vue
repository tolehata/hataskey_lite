<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:enterActiveClass="goesMotion ? $style.transition_hatagoes_enterActive : motionEnabled ? $style.transition_window_enterActive : ''"
	:leaveActiveClass="goesMotion ? $style.transition_hatagoes_leaveActive : motionEnabled ? $style.transition_window_leaveActive : ''"
	:enterFromClass="goesMotion ? $style.transition_hatagoes_enterFrom : motionEnabled ? $style.transition_window_enterFrom : ''"
	:leaveToClass="goesMotion ? $style.transition_hatagoes_leaveTo : motionEnabled ? $style.transition_window_leaveTo : ''"
	:duration="goesMotion ? { enter: 180, leave: 140 } : undefined"
	appear
	@afterLeave="emit('closed')"
>
	<div v-if="showing" ref="rootEl" data-mk-window :data-hatagoes="!!hataGoes" :data-hatagoes-palette="hataGoesTheme ? '' : undefined" :data-hatask-theme="hataGoesTheme?.hataskTheme" :data-hatask-mode="hataGoesTheme?.hataskMode" :data-hatady-theme="hataGoesTheme?.hatadyTheme" :style="hataGoesTheme?.style" :data-center-title="centerTitle" :data-content-height="autoHeight" :data-auto-height="autoHeight && !resized && !maximized && !minimized" :class="[$style.root, hataGoesTheme?.className, { [$style.maximized]: maximized }]">
		<div :class="$style.body" class="_shadow" @mousedown="onBodyMousedown" @keydown="onKeydown">
			<div :class="[$style.header, { [$style.mini]: mini }]" :data-center-title="centerTitle" @contextmenu.prevent.stop="onContextmenu">
				<span :class="$style.headerLeft">
					<button v-if="hataGoes && 'data-hatafeed-window' in surfaceAttrs && buttonsLeft.length === 0" type="button" :class="[$style.headerButton, $style.goesBack]" class="_button" :aria-label="i18n.ts._hata._hatady._controls.back" @click="close()"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
					<template v-if="!minimized">
						<button v-for="button in buttonsLeft" v-tooltip="button.title" :aria-label="button.title" class="_button" :class="[$style.headerButton, { [$style.highlighted]: button.highlighted }]" @click="button.onClick"><i :class="button.icon"></i></button>
					</template>
				</span>
				<span :class="$style.headerTitle" @mousedown.prevent="onHeaderMousedown" @touchstart.prevent="onHeaderMousedown">
					<slot name="header"></slot>
				</span>
				<span :class="$style.headerRight">
					<template v-if="!minimized">
						<button v-for="button in buttonsRight" v-tooltip="button.title" :aria-label="button.title" class="_button" :class="[$style.headerButton, { [$style.highlighted]: button.highlighted }]" @click="button.onClick"><i :class="button.icon"></i></button>
					</template>
					<button v-if="canResize && minimized" v-tooltip="i18n.ts.windowRestore" class="_button" :class="$style.headerButton" @click="unMinimize()"><i class="ti ti-maximize"></i></button>
					<button v-else-if="canResize && !maximized" v-tooltip="i18n.ts.windowMinimize" data-window-minimize class="_button" :class="$style.headerButton" @click="minimize()"><i class="ti ti-minimize"></i></button>
					<button v-if="canResize && maximized" v-tooltip="i18n.ts.windowRestore" class="_button" :class="$style.headerButton" @click="unMaximize()"><i class="ti ti-picture-in-picture"></i></button>
					<button v-else-if="canResize && !maximized && !minimized" v-tooltip="i18n.ts.windowMaximize" class="_button" :class="$style.headerButton" @click="maximize()"><i class="ti ti-rectangle"></i></button>
					<button v-if="closeButton" v-tooltip="i18n.ts.close" class="_button" :class="$style.headerButton" @click="close()"><i class="ti ti-x"></i></button>
				</span>
			</div>
			<div :class="$style.content">
				<slot></slot>
			</div>
		</div>
		<template v-if="canResize && !minimized">
			<div :class="$style.handleTop" @mousedown.prevent="onTopHandleMousedown"></div>
			<div :class="$style.handleRight" @mousedown.prevent="onRightHandleMousedown"></div>
			<div :class="$style.handleBottom" @mousedown.prevent="onBottomHandleMousedown"></div>
			<div :class="$style.handleLeft" @mousedown.prevent="onLeftHandleMousedown"></div>
			<div :class="$style.handleTopLeft" @mousedown.prevent="onTopLeftHandleMousedown"></div>
			<div :class="$style.handleTopRight" @mousedown.prevent="onTopRightHandleMousedown"></div>
			<div :class="$style.handleBottomRight" @mousedown.prevent="onBottomRightHandleMousedown"></div>
			<div :class="$style.handleBottomLeft" @mousedown.prevent="onBottomLeftHandleMousedown"></div>
		</template>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { computed, inject, useAttrs, onBeforeUnmount, onMounted, provide, useTemplateRef, ref } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import contains from '@/utility/contains.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { getViewportTopInset } from '@/utility/viewport-inset.js';
import { HATA_GOES_HOST, HATA_GOES_THEME } from '@/utility/hatagoes-context.js';
import { hatagoesWindowMotion } from '@/utility/hatagoes-motion.js';

const hataGoes = inject(HATA_GOES_HOST, null);
const themeContext = inject(HATA_GOES_THEME, null);
const hataGoesTheme = computed(() => themeContext?.value);
const goesMotion = hataGoes != null;
const motionEnabled = computed(() => hatagoesWindowMotion(prefer.s.animation, goesMotion));
const surfaceAttrs = useAttrs();

type WindowButton = {
	title: string;
	icon: string;
	onClick: () => void;
	highlighted?: boolean;
};

const minHeight = 50;
const minWidth = 250;

function dragListen(fn: (ev: MouseEvent | TouchEvent) => void) {
	window.addEventListener('mousemove', fn);
	window.addEventListener('touchmove', fn);
	window.addEventListener('mouseleave', dragClear.bind(null, fn));
	window.addEventListener('mouseup', dragClear.bind(null, fn));
	window.addEventListener('touchend', dragClear.bind(null, fn));
}

function dragClear(fn) {
	window.removeEventListener('mousemove', fn);
	window.removeEventListener('touchmove', fn);
	window.removeEventListener('mouseleave', dragClear);
	window.removeEventListener('mouseup', dragClear);
	window.removeEventListener('touchend', dragClear);
}

const props = withDefaults(defineProps<{
	initialWidth: number;
	initialHeight: number | null;
	autoHeight?: boolean;
	canResize?: boolean;
	closeButton?: boolean;
	centerTitle?: boolean;
	mini?: boolean;
	front?: boolean;
	initialMaximized?: boolean;
	beforeClose?: (() => boolean | Promise<boolean>) | null;
	contextmenu?: MenuItem[] | null;
	buttonsLeft?: WindowButton[];
	buttonsRight?: WindowButton[];
}>(), {
	initialWidth: 400,
	initialHeight: null,
	autoHeight: false,
	canResize: false,
	closeButton: true,
	centerTitle: false,
	mini: false,
	front: false,
	initialMaximized: false,
	beforeClose: null,
	contextmenu: null,
	buttonsLeft: () => [],
	buttonsRight: () => [],
});

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

provide('inWindow', true);

const rootEl = useTemplateRef('rootEl');
const showing = ref(true);
let beforeClickedAt = 0;
const maximized = ref(false);
const minimized = ref(false);
const resized = ref(false);
let contentObserver: ResizeObserver | undefined;
let unResizedTop = '';
let unResizedLeft = '';
let unResizedWidth = '';
let unResizedHeight = '';

async function close() {
	// 旗鯖fork: beforeClose ガードが false を返したら閉じない(未保存確認など)。
	if (props.beforeClose) {
		const ok = await props.beforeClose();
		if (!ok) return;
	}
	showing.value = false;
}

function onKeydown(evt) {
	if (evt.which === 27) { // Esc
		evt.preventDefault();
		evt.stopPropagation();
		close();
	}
}

function onContextmenu(ev: MouseEvent) {
	if (props.contextmenu) {
		os.contextMenu(props.contextmenu, ev);
	}
}

// 最前面へ移動
function top() {
	if (rootEl.value) {
		rootEl.value.style.zIndex = os.claimZIndex(props.front ? 'middle' : 'low').toString();
	}
}

function maximize() {
	if (rootEl.value == null) return;
	maximized.value = true;
	unResizedTop = rootEl.value.style.top;
	unResizedLeft = rootEl.value.style.left;
	unResizedWidth = rootEl.value.style.width;
	unResizedHeight = rootEl.value.style.height;
	rootEl.value.style.top = getViewportTopInset(rootEl.value) + 'px';
	rootEl.value.style.left = '0';
	rootEl.value.style.width = '100%';
	rootEl.value.style.height = getViewportTopInset() > 0 ? 'var(--MI-viewport-height, 100dvh)' : '100%';
}

function unMaximize() {
	if (rootEl.value == null) return;
	maximized.value = false;
	rootEl.value.style.top = unResizedTop;
	rootEl.value.style.left = unResizedLeft;
	rootEl.value.style.width = unResizedWidth;
	rootEl.value.style.height = unResizedHeight;
	if (getViewportTopInset() > 0) onBrowserResize();
}

function minimize() {
	if (rootEl.value == null) return;
	minimized.value = true;
	unResizedWidth = rootEl.value.style.width;
	unResizedHeight = rootEl.value.style.height;
	rootEl.value.style.width = minWidth + 'px';
	const headerHeight = props.mini ? 32 : (parseFloat(window.getComputedStyle(rootEl.value).getPropertyValue('--MI-window-header-height')) || 39);
	rootEl.value.style.height = `${headerHeight}px`;
}

function unMinimize() {
	if (rootEl.value == null) return;

	minimized.value = false;
	rootEl.value.style.width = unResizedWidth;
	rootEl.value.style.height = unResizedHeight;
	if (getViewportTopInset() > 0) {
		onBrowserResize();
	} else {
		const main = rootEl.value;
		const position = main.getBoundingClientRect();
		if (position.top + main.offsetHeight > window.innerHeight) main.style.top = window.innerHeight - main.offsetHeight + 'px';
		if (position.left + main.offsetWidth > window.innerWidth) main.style.left = window.innerWidth - main.offsetWidth + 'px';
	}
}

function onBodyMousedown() {
	top();
}

function onDblClick() {
	if (minimized.value) {
		unMinimize();
	} else {
		maximize();
	}
}

function getPositionX(event: MouseEvent | TouchEvent) {
	return 'touches' in event && event.touches.length > 0 ? event.touches[0].clientX : 'clientX' in event ? event.clientX : 0;
}

function getPositionY(event: MouseEvent | TouchEvent) {
	return 'touches' in event && event.touches.length > 0 ? event.touches[0].clientY : 'clientY' in event ? event.clientY : 0;
}

function onHeaderMousedown(evt: MouseEvent | TouchEvent) {
	// 右クリックはコンテキストメニューを開こうとした可能性が高いため無視
	if ('button' in evt && evt.button === 2) return;

	let beforeMaximized = false;

	if (maximized.value) {
		beforeMaximized = true;
		unMaximize();
	}

	// ダブルクリック判定
	if (Date.now() - beforeClickedAt < 300) {
		beforeClickedAt = Date.now();
		onDblClick();
		return;
	}

	beforeClickedAt = Date.now();

	const main = rootEl.value;
	if (main == null) return;

	if (!contains(main, window.document.activeElement)) main.focus();

	const position = main.getBoundingClientRect();

	const clickX = getPositionX(evt);
	const clickY = getPositionY(evt);
	const moveBaseX = beforeMaximized ? parseInt(unResizedWidth, 10) / 2 : clickX - position.left; // TODO: parseIntやめる
	const moveBaseY = beforeMaximized ? 20 : clickY - position.top;
	const browserWidth = window.innerWidth;
	const topInset = getViewportTopInset(main);
	const originTop = getViewportTopInset() - topInset;
	const browserHeight = window.innerHeight - originTop;
	const windowWidth = main.offsetWidth;
	const windowHeight = main.offsetHeight;

	function move(x: number, y: number) {
		let moveLeft = x - moveBaseX;
		let moveTop = y - moveBaseY - originTop;

		// 下はみ出し
		if (moveTop + windowHeight > browserHeight) moveTop = browserHeight - windowHeight;

		// 左はみ出し
		if (moveLeft < 0) moveLeft = 0;

		// 上はみ出し
		if (moveTop < topInset) moveTop = topInset;

		// 右はみ出し
		if (moveLeft + windowWidth > browserWidth) moveLeft = browserWidth - windowWidth;

		if (rootEl.value) {
			rootEl.value.style.left = moveLeft + 'px';
			rootEl.value.style.top = moveTop + 'px';
		}
	}

	if (beforeMaximized) {
		move(clickX, clickY);
	}

	// 動かした時
	dragListen(me => {
		const x = getPositionX(me);
		const y = getPositionY(me);

		move(x, y);
	});
}

// 上ハンドル掴み時
function onTopHandleMousedown(evt: MouseEvent | TouchEvent) {
	const main = rootEl.value;
	// どういうわけかnullになることがある
	if (main == null) return;

	const base = getPositionY(evt);
	const height = parseInt(getComputedStyle(main, '').height, 10);
	const top = parseInt(getComputedStyle(main, '').top, 10);
	const topInset = getViewportTopInset(main);

	// 動かした時
	dragListen(me => {
		const move = getPositionY(me) - base;
		if (top + move > topInset) {
			if (height + -move > minHeight) {
				applyTransformHeight(height + -move);
				applyTransformTop(top + move);
			} else { // 最小の高さより小さくなろうとした時
				applyTransformHeight(minHeight);
				applyTransformTop(top + (height - minHeight));
			}
		} else { // 上のはみ出し時
			applyTransformHeight(top + height - topInset);
			applyTransformTop(topInset);
		}
	});
}

// 右ハンドル掴み時
function onRightHandleMousedown(evt: MouseEvent | TouchEvent) {
	const main = rootEl.value;
	if (main == null) return;

	const base = getPositionX(evt);
	const width = parseInt(getComputedStyle(main, '').width, 10);
	const left = parseInt(getComputedStyle(main, '').left, 10);
	const browserWidth = window.innerWidth;

	// 動かした時
	dragListen(me => {
		const move = getPositionX(me) - base;
		if (left + width + move < browserWidth) {
			if (width + move > minWidth) {
				applyTransformWidth(width + move);
			} else { // 最小の幅より小さくなろうとした時
				applyTransformWidth(minWidth);
			}
		} else { // 右のはみ出し時
			applyTransformWidth(browserWidth - left);
		}
	});
}

// 下ハンドル掴み時
function onBottomHandleMousedown(evt: MouseEvent | TouchEvent) {
	const main = rootEl.value;
	if (main == null) return;

	const base = getPositionY(evt);
	const height = parseInt(getComputedStyle(main, '').height, 10);
	const top = parseInt(getComputedStyle(main, '').top, 10);
	const browserHeight = window.innerHeight - getViewportTopInset() + getViewportTopInset(main);

	// 動かした時
	dragListen(me => {
		const move = getPositionY(me) - base;
		if (top + height + move < browserHeight) {
			if (height + move > minHeight) {
				applyTransformHeight(height + move);
			} else { // 最小の高さより小さくなろうとした時
				applyTransformHeight(minHeight);
			}
		} else { // 下のはみ出し時
			applyTransformHeight(browserHeight - top);
		}
	});
}

// 左ハンドル掴み時
function onLeftHandleMousedown(evt: MouseEvent | TouchEvent) {
	const main = rootEl.value;
	if (main == null) return;

	const base = getPositionX(evt);
	const width = parseInt(getComputedStyle(main, '').width, 10);
	const left = parseInt(getComputedStyle(main, '').left, 10);

	// 動かした時
	dragListen(me => {
		const move = getPositionX(me) - base;
		if (left + move > 0) {
			if (width + -move > minWidth) {
				applyTransformWidth(width + -move);
				applyTransformLeft(left + move);
			} else { // 最小の幅より小さくなろうとした時
				applyTransformWidth(minWidth);
				applyTransformLeft(left + (width - minWidth));
			}
		} else { // 左のはみ出し時
			applyTransformWidth(left + width);
			applyTransformLeft(0);
		}
	});
}

// 左上ハンドル掴み時
function onTopLeftHandleMousedown(evt: MouseEvent | TouchEvent) {
	onTopHandleMousedown(evt);
	onLeftHandleMousedown(evt);
}

// 右上ハンドル掴み時
function onTopRightHandleMousedown(evt: MouseEvent | TouchEvent) {
	onTopHandleMousedown(evt);
	onRightHandleMousedown(evt);
}

// 右下ハンドル掴み時
function onBottomRightHandleMousedown(evt: MouseEvent | TouchEvent) {
	onBottomHandleMousedown(evt);
	onRightHandleMousedown(evt);
}

// 左下ハンドル掴み時
function onBottomLeftHandleMousedown(evt: MouseEvent | TouchEvent) {
	onBottomHandleMousedown(evt);
	onLeftHandleMousedown(evt);
}

// 高さを適用
function applyTransformHeight(height) {
	resized.value = true;
	const availableHeight = window.innerHeight - getViewportTopInset();
	if (height > availableHeight) height = availableHeight;
	if (rootEl.value) rootEl.value.style.height = height + 'px';
}

// 幅を適用
function applyTransformWidth(width) {
	if (width > window.innerWidth) width = window.innerWidth;
	if (rootEl.value) rootEl.value.style.width = width + 'px';
}

// Y座標を適用
function applyTransformTop(top) {
	if (rootEl.value) rootEl.value.style.top = (getViewportTopInset() > 0 ? Math.max(getViewportTopInset(rootEl.value), top) : top) + 'px';
}

// X座標を適用
function applyTransformLeft(left) {
	if (rootEl.value) rootEl.value.style.left = left + 'px';
}

function onBrowserResize() {
	const main = rootEl.value;
	if (main == null) return;

	const viewportInset = getViewportTopInset();
	const topInset = getViewportTopInset(main);
	if (maximized.value && viewportInset > 0) {
		main.style.top = topInset + 'px';
		return;
	}

	const originTop = getViewportTopInset() - topInset;
	const position = main.getBoundingClientRect();
	const browserWidth = window.innerWidth;
	const browserHeight = window.innerHeight - originTop;
	const windowWidth = main.offsetWidth;
	const windowHeight = viewportInset > 0 ? Math.min(main.offsetHeight, browserHeight - topInset) : main.offsetHeight;
	if (main.offsetHeight > windowHeight) applyTransformHeight(windowHeight);
	if (position.left < 0) main.style.left = '0'; // 左はみ出し
	if (position.top - originTop + windowHeight > browserHeight) applyTransformTop(browserHeight - windowHeight); // 下はみ出し
	if (position.left + windowWidth > browserWidth) main.style.left = browserWidth - windowWidth + 'px'; // 右はみ出し
	if (position.top - originTop < topInset) main.style.top = topInset + 'px'; // 上はみ出し
}

onMounted(() => {
	applyTransformWidth(props.initialWidth);
	if (props.initialHeight) applyTransformHeight(props.initialHeight);

	if (rootEl.value) {
		applyTransformTop(getViewportTopInset(rootEl.value) + ((window.innerHeight - getViewportTopInset() - rootEl.value.offsetHeight) / 2));
		applyTransformLeft((window.innerWidth / 2) - (rootEl.value.offsetWidth / 2));
	}

	// 他のウィンドウ内のボタンなどを押してこのウィンドウが開かれた場合、親が最前面になろうとするのでそれに隠されないようにする
	top();

	// 旗鯖fork: 全画面で開くよう指定された場合は最大化状態で起動する(Hatady 等の全画面アプリ用)。
	if (props.initialMaximized) maximize();
	if (props.autoHeight && rootEl.value) {
		contentObserver = new ResizeObserver(onBrowserResize);
		contentObserver.observe(rootEl.value);
	}

	window.addEventListener('resize', onBrowserResize);
});

onBeforeUnmount(() => {
	contentObserver?.disconnect();
	window.removeEventListener('resize', onBrowserResize);
});

defineExpose({
	close,
});
</script>

<style lang="scss" module>
.transition_hatagoes_enterActive { transition: opacity 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1) !important; }
.transition_hatagoes_leaveActive { transition: opacity 140ms ease, transform 140ms ease-in !important; }
.transition_hatagoes_enterFrom, .transition_hatagoes_leaveTo { pointer-events: none; opacity: 0; transform: translateY(6px); }
.transition_window_enterActive,
.transition_window_leaveActive {
	transition: opacity 0.2s, transform 0.2s !important;
}
.transition_window_enterFrom,
.transition_window_leaveTo {
	pointer-events: none;
	opacity: 0;
	transform: scale(0.9);
}

.root {
	// universal.vueとかで直接--MI-stickyBottomが定義されていたりするのでリセット
	--MI-stickyTop: 0;
	--MI-stickyBottom: 0;

	position: fixed;
	top: var(--MI-fixed-top-inset, 0px);
	left: 0;

	&.maximized {
		> .body {
			border-radius: 0;
		}
	}
}

.body {
	overflow: clip;
	display: flex;
	flex-direction: column;
	contain: content;
	width: 100%;
	height: 100%;
	border-radius: var(--MI-radius);
}

.header {
	--height: var(--MI-window-header-height, 39px);

	display: flex;
	position: relative;
	z-index: 1;
	flex-shrink: 0;
	user-select: none;
	height: var(--height);
	background: var(--MI_THEME-windowHeader);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	//border-bottom: solid 1px var(--MI_THEME-divider);
	font-size: 90%;
	font-weight: bold;

	&.mini {
		--height: 32px;
	}
}

.headerButton {
	height: var(--height);
	width: var(--height);

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}

	&.highlighted {
		color: var(--MI_THEME-accent);
	}
}

.headerLeft {
	margin-right: 16px;
}

.headerRight {
	min-width: 16px;
}

.headerTitle {
	flex: 1;
	position: relative;
	line-height: var(--height);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: move;
}

.header[data-center-title='true'] {
	display: grid;
	grid-template-columns: 132px minmax(0, 1fr) 132px;
	> .headerLeft { margin: 0; display: flex; justify-content: flex-start; }
	> .headerRight { display: flex; justify-content: flex-end; }
	> .headerTitle { text-align: center; }
	.headerButton { width: 44px; flex-shrink: 0; }
}

.root[data-center-title='true'] { container: centered-window / inline-size; }
@container centered-window (max-width: 460px) {
	.header[data-center-title='true'] { grid-template-columns: 88px minmax(0, 1fr) 88px; }
	[data-window-minimize] { display: none; }
}

.content {
	flex: 1;
	overflow: auto;
	background: var(--MI_THEME-panel);
	container-type: size;
}

// Opt-in for content-sized forms. Existing fixed/resizable windows keep their
// size container; these callers need their intrinsic content height instead.
.root[data-content-height='true'] .content { container-type: inline-size; min-height: 0; }
.root[data-auto-height='true'] > .body { height: auto; max-height: calc(var(--MI-viewport-height, 100dvh) - 32px); }
.root[data-auto-height='true'] .content { flex: 0 1 auto; }

$handleSize: 8px;

.handle {
	position: absolute;
}

.handleTop {
	composes: handle;
	top: -($handleSize);
	left: 0;
	width: 100%;
	height: $handleSize;
	cursor: ns-resize;
}

.handleRight {
	composes: handle;
	top: 0;
	right: -($handleSize);
	width: $handleSize;
	height: 100%;
	cursor: ew-resize;
}

.handleBottom {
	composes: handle;
	bottom: -($handleSize);
	left: 0;
	width: 100%;
	height: $handleSize;
	cursor: ns-resize;
}

.handleLeft {
	composes: handle;
	top: 0;
	left: -($handleSize);
	width: $handleSize;
	height: 100%;
	cursor: ew-resize;
}

.handleTopLeft {
	composes: handle;
	top: -($handleSize);
	left: -($handleSize);
	width: $handleSize * 2;
	height: $handleSize * 2;
	cursor: nwse-resize;
}

.handleTopRight {
	composes: handle;
	top: -($handleSize);
	right: -($handleSize);
	width: $handleSize * 2;
	height: $handleSize * 2;
	cursor: nesw-resize;
}

.handleBottomRight {
	composes: handle;
	bottom: -($handleSize);
	right: -($handleSize);
	width: $handleSize * 2;
	height: $handleSize * 2;
	cursor: nwse-resize;
}

.handleBottomLeft {
	composes: handle;
	bottom: -($handleSize);
	left: -($handleSize);
	width: $handleSize * 2;
	height: $handleSize * 2;
	cursor: nesw-resize;
}
.goesBack { display: none; }
@media (max-width: 700px) {
	.root[data-hatagoes='true'][data-hatafeed-window] {
		inset: 0 !important; width: 100dvw !important; height: 100dvh !important;
		max-width: none !important; max-height: none !important;
		> .body { border-radius: 0; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
		> :not(.body) { display: none; }
		.header { --height: 52px; }
		.headerRight > button:not(:last-child) { display: none; }
		.goesBack { display: inline-flex; align-items: center; justify-content: center; }
	}
}

</style>
