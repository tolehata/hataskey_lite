<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition :name="goesMotion ? 'hatagoes-event-details' : 'hatask-event-details'" :css="goesMotion || animations !== false">
	<div v-if="visible" ref="overlayEl" v-bind="$attrs" :class="$style.overlay" :style="overlayStyle" :data-presentation="presentation" :data-motion="goesMotion || animations !== false" data-hatask-event-detail="overlay" @click.self="requestClose">
		<div :class="$style.bubble" :style="bubbleStyle" :data-placement="position?.placement" data-hatask-event-detail="bubble">
			<section ref="dialogEl" :class="$style.dialog" role="dialog" aria-modal="true" :aria-labelledby="event ? `${titleId} ${eventTitleId}` : titleId" :aria-busy="busy" :data-compact-height="compactHeight" tabindex="-1" data-hatask-event-detail="dialog" @keydown="onKeydown">
				<header :class="$style.header">
					<h2 :id="titleId"><i class="ti ti-calendar-event" aria-hidden="true"></i>{{ labels.details }}</h2>
					<button ref="closeEl" type="button" :class="$style.closeIcon" :aria-label="labels.close" data-hatask-event-detail-action="close" @click="requestClose"><i class="ti ti-x" aria-hidden="true"></i></button>
				</header>

				<div :class="$style.body" data-hatask-event-detail="body">
					<slot name="body">
						<template v-if="event">
							<div :class="$style.eventHeading">
								<span v-if="event.color" :class="$style.eventColor" :style="{ backgroundColor: event.color }" aria-hidden="true"></span>
								<HataskEmoji v-if="event.emoji" :emoji="event.emoji" :class="$style.eventEmoji"/>
								<h3 :id="eventTitleId" data-hatask-event-detail="title">{{ event.title }}</h3>
							</div>
							<div :class="$style.dateCard" data-hatask-event-detail="date">
								<i class="ti ti-calendar-time" aria-hidden="true"></i>
								<div><span :class="$style.fieldLabel">{{ labels.dateAndTime }}</span><strong>{{ event.dateLabel }}</strong><span v-if="event.timeLabel" :class="$style.time">{{ event.timeLabel }}</span></div>
							</div>
							<dl :class="$style.metadata">
								<div><dt><i :class="event.isPublic ? 'ti ti-world' : 'ti ti-lock'" aria-hidden="true"></i>{{ labels.visibility }}</dt><dd>{{ event.visibilityLabel }}</dd></div>
								<div v-if="event.ownerLabel"><dt><i class="ti ti-user" aria-hidden="true"></i>{{ labels.organizer }}</dt><dd>{{ event.ownerLabel }}</dd></div>
								<div v-if="event.recurrenceLabel"><dt><i class="ti ti-repeat" aria-hidden="true"></i>{{ labels.recurrence }}</dt><dd>{{ event.recurrenceLabel }}<p v-if="event.recurrenceHint" :class="$style.recurrenceHint" data-hatask-event-detail="recurrence-hint">{{ event.recurrenceHint }}</p></dd></div>
								<div v-if="event.notificationLabel"><dt><i class="ti ti-bell" aria-hidden="true"></i>{{ labels.notificationTiming }}</dt><dd>{{ event.notificationLabel }}</dd></div>
							</dl>
							<p v-if="event.syncLabel" :class="$style.notice" data-hatask-event-detail="sync"><i class="ti ti-refresh" aria-hidden="true"></i><span>{{ event.syncLabel }}</span></p>
							<p v-if="readOnly" :class="$style.notice" data-hatask-event-detail="read-only"><i class="ti ti-lock" aria-hidden="true"></i><span>{{ labels.readOnly }}</span></p>

							<section v-if="event.rsvp" :class="$style.rsvp" :aria-labelledby="rsvpTitleId" data-hatask-event-detail="rsvp">
								<div :class="$style.sectionHeading"><h3 :id="rsvpTitleId">{{ event.isOwner ? labels.rsvpDashboard : labels.rsvp }}</h3><span :class="$style.state" :data-closed="event.rsvp.closed"><i :class="event.rsvp.closed ? 'ti ti-lock' : 'ti ti-mail-opened'" aria-hidden="true"></i>{{ event.rsvp.closed ? labels.closed : labels.accepting }}</span></div>
								<div v-if="!event.isOwner" :class="$style.answers" role="group" :aria-label="labels.rsvp" data-hatask-event-detail="answers">
									<button v-for="group in responseGroups" :key="group.status" type="button" :class="$style.answer" :aria-pressed="event.rsvp.myStatus === group.status" :disabled="!canRespond" :data-hatask-event-detail-action="group.status" @click="respond(group.status)"><i :class="group.icon" aria-hidden="true"></i><span>{{ group.answerLabel }}</span></button>
								</div>
								<p v-if="!event.isOwner && selectedResponse" :class="$style.currentResponse" data-hatask-event-detail="current-response"><i :class="selectedResponse.icon" aria-hidden="true"></i>{{ labels.rsvp }}: {{ selectedResponse.answerLabel }}</p>
								<div :class="$style.stats" data-hatask-event-detail="counts">
									<div v-for="group in responseGroups" :key="group.status" :class="$style.stat" :data-status="group.status"><span><i :class="group.icon" aria-hidden="true"></i>{{ group.label }}</span><strong>{{ group.responses.length }}</strong></div>
									<div :class="$style.stat" data-status="total"><span><i class="ti ti-users" aria-hidden="true"></i>{{ labels.total }}</span><strong>{{ totalResponses }}</strong></div>
								</div>
								<div v-if="event.isOwner && totalResponses" :class="$style.ratio" aria-hidden="true"><span v-for="group in responseGroups" :key="group.status" :data-status="group.status" :style="{ width: `${group.responses.length / totalResponses * 100}%` }"></span></div>
								<div v-if="event.isOwner && totalResponses" :class="$style.responseList">
									<template v-for="group in responseGroups" :key="group.status">
										<section v-if="group.responses.length" :class="$style.responseGroup" :data-status="group.status"><h4><i :class="group.icon" aria-hidden="true"></i>{{ group.label }}<span>{{ group.responses.length }}</span></h4><ul><li v-for="response in group.responses" :key="response.userId">@{{ response.username }}</li></ul></section>
									</template>
								</div>
								<p v-if="!totalResponses" :class="$style.empty">{{ labels.noResponses }}</p>
								<button v-if="event.isOwner && !event.rsvp.closed" type="button" :class="$style.closeRsvp" :disabled="!canCloseRsvp" data-hatask-event-detail-action="close-rsvp" @click="closeRsvp"><i class="ti ti-mail-check" aria-hidden="true"></i>{{ labels.closeRsvp }}</button>
							</section>
							<p v-else-if="event.isPublic" :class="$style.notice" data-hatask-event-detail="without-rsvp"><i class="ti ti-world" aria-hidden="true"></i><span>{{ labels.publicEventWithoutRsvp }}</span></p>
						</template>
					</slot>
				</div>

				<footer :class="$style.footer">
					<slot name="footer">
						<button v-if="event?.canEdit" type="button" :class="$style.edit" :disabled="!canModify" data-hatask-event-detail-action="edit" @click="editEvent"><i class="ti ti-pencil" aria-hidden="true"></i>{{ labels.edit }}</button>
						<button v-if="event?.canEdit" type="button" :class="$style.delete" :disabled="!canModify" data-hatask-event-detail-action="delete" @click="deleteEvent"><i class="ti ti-trash" aria-hidden="true"></i>{{ labels.delete }}</button>
						<button type="button" :class="$style.footerClose" data-hatask-event-detail-action="close-footer" @click="requestClose">{{ labels.close }}</button>
					</slot>
				</footer>
			</section>
		</div>
	</div>
</Transition>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, useSlots, watch } from 'vue';
import type { HataskEventDetails, HataskEventDetailsLabels, HataskEventRsvpStatus } from './hatask-event-details-types.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import { claimZIndex } from '@/os.js';
import { focusTrap } from '@/utility/focus-trap.js';
import { isFocusable } from '@/utility/focus.js';
import { getHataskEventDetailsPosition } from '@/utility/hatask-event-details-position.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
const goesMotion = !!inject(HATA_GOES_HOST, null);

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
	isOpen: boolean;
	active?: boolean;
	event: HataskEventDetails | null;
	labels: HataskEventDetailsLabels;
	readOnly: boolean;
	busy: boolean;
	returnFocusTo?: HTMLElement | null;
	getAnchor?: () => HTMLElement | null;
	getAnchorRect?: (anchor: HTMLElement) => { left: number; right: number; top: number; bottom: number };
	animations?: boolean;
}>(), {
	active: true,
	returnFocusTo: null,
	getAnchor: () => null,
	getAnchorRect: undefined,
	animations: true,
});
const emit = defineEmits<{
	'close': [];
	edit: [];
	delete: [];
	rsvp: [status: HataskEventRsvpStatus];
	'close-rsvp': [];
	'focus-fallback': [];
}>();
const slots = useSlots();
const titleId = `hatask-event-detail-${useId()}`;
const eventTitleId = `${titleId}-event`;
const rsvpTitleId = `${titleId}-rsvp`;
const overlayEl = ref<HTMLElement | null>(null);
const dialogEl = ref<HTMLElement | null>(null);
const closeEl = ref<HTMLButtonElement | null>(null);
const zIndex = ref(0);
const viewportBounds = ref<ReturnType<typeof getViewport> | null>(null);
const availableHeight = ref<number>();
const overlayStyle = computed(() => ({
	zIndex: zIndex.value,
	...(viewportBounds.value ? {
		left: `${viewportBounds.value.left}px`, top: `${viewportBounds.value.top}px`,
		width: `${viewportBounds.value.width}px`, height: `${viewportBounds.value.height}px`, right: 'auto', bottom: 'auto',
		'--detail-available-height': `${availableHeight.value ?? viewportBounds.value.height}px`,
	} : {}),
}));
const presentation = ref<'sheet' | 'popover'>('sheet');
const compactHeight = ref(false);
const position = ref<ReturnType<typeof getHataskEventDetailsPosition> | null>(null);
const origin = ref({ left: 0, top: 0 });
const bubbleStyle = computed(() => presentation.value === 'popover' && position.value ? {
	left: `${position.value.left - origin.value.left}px`,
	top: `${position.value.top - origin.value.top}px`,
	width: `${position.value.width}px`,
	maxHeight: `${position.value.maxHeight}px`,
	'--arrow-left': `${position.value.arrowLeft ?? 0}px`,
} : undefined);
const visible = computed(() => props.active && props.isOpen && (props.event != null || slots.body != null));
const canModify = computed(() => visible.value && !props.busy && !props.readOnly && props.event?.canEdit === true);
const canRespond = computed(() => visible.value && !props.busy && !props.readOnly && props.event?.isOwner === false && props.event.rsvp != null && !props.event.rsvp.closed);
const canCloseRsvp = computed(() => visible.value && !props.busy && !props.readOnly && props.event?.isOwner === true && props.event.rsvp != null && !props.event.rsvp.closed);
const responseGroups = computed(() => ([
	{ status: 'going' as const, label: props.labels.rsvpParticipation, answerLabel: props.labels.rsvpGoing, icon: 'ti ti-check' },
	{ status: 'maybe' as const, label: props.labels.rsvpMaybe, answerLabel: props.labels.rsvpMaybe, icon: 'ti ti-help-circle' },
	{ status: 'declined' as const, label: props.labels.rsvpDeclined, answerLabel: props.labels.rsvpDeclined, icon: 'ti ti-x' },
].map(group => ({ ...group, responses: props.event?.rsvp?.responses.filter(response => response.status === group.status) ?? [] }))));
const totalResponses = computed(() => props.event?.rsvp?.responses.length ?? 0);
const selectedResponse = computed(() => responseGroups.value.find(group => group.status === props.event?.rsvp?.myStatus));

function requestClose(): void { if (visible.value) emit('close'); }

function editEvent(): void { if (canModify.value) emit('edit'); }

function deleteEvent(): void { if (canModify.value) emit('delete'); }

function respond(status: HataskEventRsvpStatus): void { if (canRespond.value) emit('rsvp', status); }

function closeRsvp(): void { if (canCloseRsvp.value) emit('close-rsvp'); }

let releaseTrap: (() => void) | null = null;
let opener: HTMLElement | null = null;
let focusCycle = 0;
let disposed = false;
let dialogActive = false;
let layoutCycle = 0;
let positionFrame: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let anchorObserver: MutationObserver | null = null;
let contentObserver: MutationObserver | null = null;
let trackedAnchor: HTMLElement | null = null;
let viewport: VisualViewport | null = null;

function getViewport() {
	const visual = window.visualViewport;
	return {
		left: visual?.offsetLeft ?? 0,
		top: visual?.offsetTop ?? 0,
		width: visual?.width ?? (window.document.documentElement.clientWidth || window.innerWidth),
		height: visual?.height ?? window.innerHeight,
	};
}

function trackAnchor(anchor: HTMLElement | null): void {
	if (trackedAnchor === anchor) return;
	if (trackedAnchor) resizeObserver?.unobserve(trackedAnchor);
	anchorObserver?.disconnect();
	trackedAnchor = anchor;
	if (!anchor) return;
	resizeObserver?.observe(anchor);
	// Page windows move through ancestor styles, without resizing the date itself.
	for (let parent: HTMLElement | null = anchor; parent; parent = parent.parentElement) {
		anchorObserver?.observe(parent, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
	}
}

function getChromeHeight(dialog: HTMLElement): number {
	const style = window.getComputedStyle(dialog);
	return (dialog.querySelector('header')?.offsetHeight ?? 0) + (dialog.querySelector('footer')?.offsetHeight ?? 0)
		+ (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
}

// These values can change while nextTick yields, including during a quick reopen.
function isCurrentLayout(cycle: number): boolean {
	return cycle === layoutCycle && visible.value && !disposed;
}

function isCurrentFocus(cycle: number): boolean {
	return cycle === focusCycle && visible.value && !disposed;
}

async function updatePosition(): Promise<void> {
	const overlay = overlayEl.value;
	const dialog = dialogEl.value;
	if (!visible.value || !overlay || !dialog) return;
	const cycle = ++layoutCycle;
	const bounds = getViewport();
	viewportBounds.value = bounds;
	const padding = window.getComputedStyle(overlay);
	const paddingX = (parseFloat(padding.paddingLeft) || 0) + (parseFloat(padding.paddingRight) || 0);
	const paddingY = (parseFloat(padding.paddingTop) || 0) + (parseFloat(padding.paddingBottom) || 0);
	availableHeight.value = Math.max(0, bounds.height - paddingY);
	const contentWidth = bounds.width - paddingX;
	presentation.value = contentWidth > 560 ? 'popover' : 'sheet';
	if (presentation.value === 'sheet') {
		position.value = null;
		trackAnchor(null);
		await nextTick();
		if (isCurrentLayout(cycle)) compactHeight.value = availableHeight.value < getChromeHeight(dialog) + 80;
		return;
	}
	await nextTick();
	if (!isCurrentLayout(cycle)) return;
	const anchor = props.getAnchor();
	trackAnchor(anchor);
	const anchorRect = anchor?.isConnected ? (props.getAnchorRect?.(anchor) ?? anchor.getBoundingClientRect()) : { left: 0, right: 0, top: 0, bottom: 0 };
	const overlayRect = overlay.getBoundingClientRect();
	origin.value = { left: overlayRect.left, top: overlayRect.top };
	// Set the real card width before measuring wrapped text. Never measure a
	// transition's transformed rectangle or treat an already clipped body as its natural height.
	const initialPosition = getHataskEventDetailsPosition({ anchor: anchorRect, viewport: bounds, width: 460, height: 0 });
	if (!position.value || position.value.width !== initialPosition.width) position.value = initialPosition;
	await nextTick();
	if (!isCurrentLayout(cycle)) return;
	const body = dialog.querySelector<HTMLElement>('[data-hatask-event-detail="body"]');
	const chromeHeight = getChromeHeight(dialog);
	position.value = getHataskEventDetailsPosition({
		anchor: anchorRect, viewport: bounds, width: 460,
		height: chromeHeight + (body?.scrollHeight ?? 0), minHeight: Math.max(180, chromeHeight + 80),
	});
	compactHeight.value = position.value.maxHeight < chromeHeight + 80;
}

function schedulePosition(event?: Event): void {
	if (!visible.value || disposed || positionFrame != null) return;
	if (event?.type === 'scroll' && event.target instanceof Node && overlayEl.value?.contains(event.target)) return;
	positionFrame = window.requestAnimationFrame(() => {
		positionFrame = null;
		void updatePosition();
	});
}

function onAnchorMotionEnd(event: Event): void {
	if (event.target instanceof Element && trackedAnchor && event.target.contains(trackedAnchor)) schedulePosition();
}

function startPositionTracking(): void {
	resizeObserver = new ResizeObserver(() => schedulePosition());
	anchorObserver = new MutationObserver(() => schedulePosition());
	contentObserver = new MutationObserver(() => schedulePosition());
	if (overlayEl.value) resizeObserver.observe(overlayEl.value);
	if (dialogEl.value) resizeObserver.observe(dialogEl.value);
	// Slotted steps and search results can change natural height without changing
	// the event. Exclude attributes so our own positioning styles cannot loop.
	if (dialogEl.value) contentObserver.observe(dialogEl.value, { childList: true, subtree: true, characterData: true });
	window.addEventListener('resize', schedulePosition);
	window.document.addEventListener('scroll', schedulePosition, true);
	for (const type of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) window.document.addEventListener(type, onAnchorMotionEnd, true);
	viewport = window.visualViewport;
	viewport?.addEventListener('resize', schedulePosition);
	viewport?.addEventListener('scroll', schedulePosition);
}

function stopPositionTracking(): void {
	layoutCycle++;
	if (positionFrame != null) window.cancelAnimationFrame(positionFrame);
	positionFrame = null;
	resizeObserver?.disconnect();
	resizeObserver = null;
	anchorObserver?.disconnect();
	anchorObserver = null;
	contentObserver?.disconnect();
	contentObserver = null;
	trackedAnchor = null;
	window.removeEventListener('resize', schedulePosition);
	window.document.removeEventListener('scroll', schedulePosition, true);
	for (const type of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) window.document.removeEventListener(type, onAnchorMotionEnd, true);
	viewport?.removeEventListener('resize', schedulePosition);
	viewport?.removeEventListener('scroll', schedulePosition);
	viewport = null;
}

async function activateDialog(): Promise<void> {
	dialogActive = true;
	const cycle = ++focusCycle;
	const active = window.document.activeElement;
	opener = props.returnFocusTo ?? (active instanceof HTMLElement ? active : null);
	zIndex.value = claimZIndex('middle');
	await nextTick();
	if (!isCurrentFocus(cycle)) return;
	startPositionTracking();
	await updatePosition();
	const overlay = overlayEl.value;
	if (!isCurrentFocus(cycle) || !overlay) return;
	releaseTrap?.();
	releaseTrap = focusTrap(overlay).release;
	closeEl.value?.focus({ preventScroll: true });
}

function releaseDialog(): void {
	if (!dialogActive) return;
	dialogActive = false;
	focusCycle++;
	stopPositionTracking();
	const overlay = overlayEl.value;
	const active = window.document.activeElement;
	const shouldRestore = active === window.document.body || active == null || !active.isConnected || overlay?.contains(active);
	const target = opener;
	opener = null;
	releaseTrap?.();
	releaseTrap = null;
	if (!shouldRestore || !props.active) return;
	void nextTick(() => {
		if (!disposed && visible.value) return;
		const current = window.document.activeElement;
		if (current != null && current !== window.document.body && current.isConnected && !overlay?.contains(current)) return;
		if (isVisibleFocusTarget(target)) target.focus({ preventScroll: true });
		else if (!disposed) emit('focus-fallback');
	});
}

function isVisibleFocusTarget(target: HTMLElement | null): target is HTMLElement {
	if (!target || !isFocusable(target) || target.closest('[inert], [hidden]')) return false;
	// A home tab hidden with v-show can still contain a focusable-looking button.
	for (let parent = target.parentElement; parent; parent = parent.parentElement) {
		if (window.getComputedStyle(parent).display === 'none') return false;
	}
	return true;
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.preventDefault(); event.stopPropagation(); requestClose();
		return;
	}
	if (event.key !== 'Tab' || !dialogEl.value) return;
	event.stopPropagation();
	const focusable = [...dialogEl.value.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')]
		.filter(element => isFocusable(element) && !element.closest('[inert]'));
	const first = focusable.at(0);
	const last = focusable.at(-1);
	const active = window.document.activeElement;
	if (!first || !last) { event.preventDefault(); dialogEl.value.focus({ preventScroll: true }); return; }
	if (!focusable.some(element => element === active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
		event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
	}
}

// Release while the overlay is still attached so the shared trap can restore its siblings.
watch(visible, isVisible => { if (isVisible) void activateDialog(); else releaseDialog(); }, { immediate: true, flush: 'pre' });
watch([() => props.event, () => props.getAnchor, () => props.getAnchorRect], () => schedulePosition(), { flush: 'post' });
onBeforeUnmount(() => { disposed = true; releaseDialog(); });
</script>

<style lang="scss" module>
.overlay {
	position: fixed;
	inset: 0;
	box-sizing: border-box;
	container: hatask-event-details / inline-size;
	display: grid;
	place-items: center;
	padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
	background: rgb(0 0 0 / .42);
	backdrop-filter: blur(8px);
	font-family: var(--htk-font-body, inherit);
	color: var(--fg);
}
.overlay *, .overlay *::before, .overlay *::after { box-sizing: border-box; }
.overlay[data-presentation='popover'] { background: transparent; backdrop-filter: none; }
.bubble {
	position: relative;
	width: min(720px, 100%);
	max-height: min(var(--detail-available-height, 100dvh), calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));
	min-width: 0;
	min-height: 0;
	display: grid;
}
.overlay[data-presentation='popover'] .bubble { position: absolute; }
.bubble[data-placement='above'], .bubble[data-placement='below'] {
	&::before {
		content: '';
		position: absolute;
		z-index: 1;
		left: var(--arrow-left);
		width: 18px;
		height: 18px;
		pointer-events: none;
		transform: translateX(-50%) rotate(45deg);
		border: var(--card-border, 1px solid var(--rule));
		background: linear-gradient(var(--surface), var(--surface)), linear-gradient(var(--surface), var(--surface)), var(--bg);
	}
}
.bubble[data-placement='above'] {
	--enter-offset: 8px;
	&::before { bottom: -8px; border-top: 0; border-left: 0; }
}
.bubble[data-placement='below'] {
	--enter-offset: -8px;
	&::before { top: -8px; border-bottom: 0; border-right: 0; }
}
.dialog {
	width: 100%;
	max-height: inherit;
	min-width: 0;
	min-height: 0;
	display: grid;
	grid-template-rows: auto minmax(0, 1fr) auto;
	overflow: hidden;
	border: var(--card-border, 1px solid var(--rule));
	border-radius: var(--card-radius, 24px);
	box-shadow: var(--card-shadow);
	background: linear-gradient(var(--surface), var(--surface)), var(--bg);
	outline: none;
}
.dialog[data-compact-height='true'] { display: block; overflow-y: auto; overscroll-behavior: contain; }
.dialog[data-compact-height='true'] .body { overflow-y: visible; }
.dialog h2, .dialog h3, .dialog h4, .dialog p, .dialog dl, .dialog dd, .dialog ul { margin: 0; }
.dialog h2, .dialog h3, .dialog h4 { font-family: var(--htk-font-head, inherit); }
.dialog button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 16px; border: 1px solid var(--rule); border-radius: var(--card-radius, 14px); background: var(--surface); color: var(--fg); font: inherit; font-weight: 700; line-height: 1.4; cursor: pointer; overflow-wrap: anywhere; }
.dialog button:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.dialog button:focus-visible { outline: 3px solid var(--accent-ink, var(--accent)); outline-offset: 2px; }
.dialog button:disabled { opacity: .5; cursor: default; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--rule); }
.header h2 { display: flex; align-items: center; gap: 10px; font-size: 1rem; line-height: 1.4; overflow-wrap: anywhere; }
.header h2 > i { color: var(--accent-ink, var(--accent)); flex-shrink: 0; }
.dialog .closeIcon { width: 44px; padding: 0; flex: 0 0 44px; border-radius: 50%; }
.body { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 20px; padding: 24px; scrollbar-gutter: stable; }
.eventHeading { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.eventHeading h3 { min-width: 0; font-size: clamp(22px, 3cqi, 32px); font-weight: 800; line-height: 1.45; line-break: strict; overflow-wrap: anywhere; }
.eventColor { flex: 0 0 5px; width: 5px; min-height: 40px; align-self: stretch; border-radius: 99px; }
.eventEmoji { flex: 0 0 auto; font-size: 32px; margin-top: 3px; }
.dateCard { display: flex; align-items: flex-start; gap: 14px; padding: 18px; border: 1px solid var(--rule); border-radius: var(--card-radius, 18px); background: var(--surface); }
.dateCard > i { flex-shrink: 0; font-size: 28px; color: var(--accent-ink, var(--accent)); }
.dateCard > div { display: grid; gap: 5px; min-width: 0; }
.fieldLabel { color: var(--fg-2); font-size: .75rem; font-weight: 700; }
.dateCard strong { font-family: var(--htk-font-head, inherit); font-size: 1.15rem; line-height: 1.55; overflow-wrap: anywhere; }
.time { font-size: 1.2rem; font-weight: 750; line-height: 1.5; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
.metadata > div { min-width: 0; }
.metadata dt { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; color: var(--fg-2); font-size: .8rem; font-weight: 700; }
.metadata dd { line-height: 1.65; overflow-wrap: anywhere; }
.metadata .recurrenceHint { margin-top: 6px; color: var(--fg-2); font-size: .8rem; }
.notice { display: flex; align-items: flex-start; gap: 9px; padding: 13px 15px; border: 1px solid var(--rule); border-radius: var(--card-radius, 14px); color: var(--fg-2); background: var(--surface); font-size: .85rem; line-height: 1.6; overflow-wrap: anywhere; }
.notice > i { margin-top: .2em; flex-shrink: 0; }
.rsvp { display: grid; gap: 16px; padding-top: 20px; border-top: 1px solid var(--rule); }
.sectionHeading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.sectionHeading h3 { font-size: 1rem; overflow-wrap: anywhere; }
.state { display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border: 1px solid var(--rule); border-radius: 99px; color: var(--fg-2); font-size: .75rem; font-weight: 700; }
.state[data-closed='false'] { color: var(--accent-ink, var(--accent)); }
.answers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.dialog .answer[aria-pressed='true'] { color: var(--on-accent); background: var(--accent-ink, var(--accent)); border-color: var(--accent-ink, var(--accent)); }
.currentResponse { display: flex; align-items: center; gap: 8px; font-size: .85rem; color: var(--fg-2); }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.stat { display: grid; gap: 10px; padding: 14px 12px; border: 1px solid var(--rule); border-radius: var(--card-radius, 14px); background: var(--surface); min-width: 0; }
.stat > span { display: flex; align-items: center; gap: 6px; color: var(--fg-2); font-size: .75rem; font-weight: 700; overflow-wrap: anywhere; }
.stat strong { font-size: 1.7rem; line-height: 1; font-variant-numeric: tabular-nums; }
.ratio { display: flex; overflow: hidden; height: 8px; border-radius: 99px; background: var(--rule); }
.ratio > span[data-status='going'] { background: var(--accent-ink, var(--accent)); }
.ratio > span[data-status='maybe'] { background: color-mix(in srgb, var(--accent-ink, var(--accent)) 50%, var(--surface)); }
.ratio > span[data-status='declined'] { background: var(--fg-2); }
.responseList { display: grid; gap: 16px; }
.responseGroup h4 { display: flex; align-items: center; gap: 8px; font-size: .85rem; }
.responseGroup h4 > span { margin-left: auto; color: var(--fg-2); font-variant-numeric: tabular-nums; }
.responseGroup ul { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0 0; list-style: none; }
.responseGroup li { min-width: 0; max-width: 100%; padding: 5px 9px; border: 1px solid var(--rule); border-radius: 99px; background: var(--surface); font-size: .8rem; line-height: 1.5; overflow-wrap: anywhere; }
.empty { padding: 16px; text-align: center; color: var(--fg-2); font-size: .9rem; line-height: 1.6; }
.closeRsvp { justify-self: start; }
.footer { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 14px 20px; background: var(--surface); border-top: 1px solid var(--rule); }
.dialog .edit { background: var(--accent-ink, var(--accent)); border-color: var(--accent-ink, var(--accent)); color: var(--on-accent); }
.dialog .edit:hover:not(:disabled) { background: var(--accent-ink, var(--accent)); filter: brightness(.95); }
.dialog .delete { background: transparent; }
.footerClose { margin-left: auto; }
.overlay[data-presentation='popover'] .body { gap: 16px; padding: 18px; }
.overlay[data-presentation='popover'] .eventHeading h3 { font-size: 24px; }
.overlay[data-presentation='popover'] .dateCard { padding: 14px; }
.overlay[data-presentation='popover'] .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.overlay[data-presentation='popover'] .stat { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.overlay[data-presentation='popover'] .stat strong { font-size: 1.35rem; }
:global(.hatask-event-details-enter-active), :global(.hatask-event-details-leave-active) { transition: opacity .18s ease; }
:global(.hatask-event-details-enter-active) .bubble, :global(.hatask-event-details-leave-active) .bubble { transition: transform .22s cubic-bezier(.2, 0, 0, 1), opacity .18s ease; }
:global(.hatask-event-details-enter-from), :global(.hatask-event-details-leave-to) { opacity: 0; }
:global(.hatask-event-details-enter-from) .bubble, :global(.hatask-event-details-leave-to) .bubble { transform: translateY(var(--enter-offset, 12px)); opacity: 0; }
:global(.hatask-event-details-leave-active) { pointer-events: none; }
:global(.hatagoes-event-details-enter-active) { transition: opacity 160ms ease; }
:global(.hatagoes-event-details-leave-active) { transition: opacity 120ms ease; pointer-events: none; }
:global(.hatagoes-event-details-enter-active) .bubble, :global(.hatagoes-event-details-leave-active) .bubble { transition: transform 160ms ease; }
:global(.hatagoes-event-details-enter-from), :global(.hatagoes-event-details-leave-to) { opacity: 0; }
:global(.hatagoes-event-details-enter-from) .bubble, :global(.hatagoes-event-details-leave-to) .bubble { transform: translateY(4px); }
@container hatask-event-details (max-width: 560px) {
	.bubble { align-self: end; }
	.header, .footer { padding: 12px 16px; }
	.body { gap: 16px; padding: 18px 16px; }
	.metadata, .answers, .stats { grid-template-columns: minmax(0, 1fr); }
	.stat { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; }
	.stat strong { font-size: 1.35rem; }
	.footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.footerClose { grid-column: 1 / -1; margin-left: 0; }
	.closeRsvp { justify-self: stretch; }
}
@media (prefers-reduced-motion: reduce) {
	:global(.hatask-event-details-enter-active), :global(.hatask-event-details-leave-active), :global(.hatask-event-details-enter-active) .bubble, :global(.hatask-event-details-leave-active) .bubble { transition: none; }
}
</style>
