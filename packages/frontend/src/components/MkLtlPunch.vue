<!--
SPDX-FileCopyrightText: hataskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<Teleport :to="navbarTarget ?? fallbackNav" :disabled="!navbarTarget && !fallbackNav">
	<div v-if="phase !== 'idle'" class="hata-ltl-punch-nav" :class="{ reduced, preparation: preparing }">
		<div class="hata-ltl-punch-copy"><strong :key="title">{{ title }}</strong><span>{{ displayedHp }} / {{ current?.maxHp }} HP · {{ current?.people }}人</span><button type="button" aria-label="拳の演出を閉じる" @click="dismiss">×</button></div>
		<div class="hata-ltl-punch-meter" role="progressbar" aria-label="巨大な拳のHP" :aria-valuemin="0" :aria-valuemax="current?.maxHp" :aria-valuenow="displayedHp"><i :style="{ width: `${hpPercent}%` }"></i></div>
	</div>
</Teleport>
<div v-if="!navbarTarget" ref="fallbackNav" class="hata-ltl-punch-fallback"></div>
<Teleport to="body">
	<div v-if="busy" class="hata-ltl-punch-shield" :style="viewportStyle" aria-hidden="true"></div>
	<div v-if="phase === 'falling'" class="hata-ltl-punch-viewport" :class="{ reduced }" :style="viewportStyle">
		<div v-if="!reduced" class="hata-ltl-punch-wind" aria-hidden="true" :style="{ top: `${position.tip - 190}px` }"><i v-for="i in 6" :key="i"></i></div>
		<button ref="fist" class="hata-ltl-punch-fist" type="button" aria-label="巨大な拳を攻撃する" :style="{ top: `${position.top}px`, width: `${glyphSize}px`, height: `${glyphSize}px` }" @click="attack"><img :src="'/twemoji/1f91c.svg'" alt="" aria-hidden="true" draggable="false"><small>タップで撃退！</small></button>
		<div ref="dustLayer" class="hata-ltl-punch-dust" aria-hidden="true"></div>
	</div>
	<div ref="burstLayer" class="hata-ltl-punch-burst" aria-hidden="true"></div>
</Teleport>
<span class="hata-ltl-punch-sr" role="status" aria-live="polite">{{ announcement }}</span>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Channels, IChannelConnection } from 'cherrypick-js';
import type { LtlPunchPhase, LtlPunchState } from '@/utility/hata-ltl-punch.js';
import { useStream } from '@/stream.js';
import { acceptPunchState, LTL_PUNCH, punchDamage, punchHP, punchPhase, punchPosition } from '@/utility/hata-ltl-punch.js';

const props = defineProps<{
	active: boolean;
	navbarTarget: HTMLElement | null;
	navbarFrame: HTMLElement | null;
	timelineRoot: HTMLElement | null;
	viewportTarget: HTMLElement | null;
	animationEnabled: boolean;
}>();
const emit = defineEmits<{ busy: [boolean]; visible: [boolean] }>();
const current = shallowRef<LtlPunchState | null>(null);
const phase = ref<LtlPunchPhase>('idle');
const clock = ref(Date.now());
const osReduced = ref(false);
const reduced = computed(() => !props.animationEnabled || osReduced.value);
const preparing = computed(() => phase.value === 'charging' || phase.value === 'warning');
const displayedHp = computed(() => current.value ? punchHP(current.value, phase.value, clock.value) : 0);
const hpPercent = computed(() => current.value ? displayedHp.value / current.value.maxHp * 100 : 0);
const title = computed(() => preparing.value ? '上から何か来る...??' : phase.value === 'won' ? '撃退に成功！' : phase.value === 'escaped' ? '撃退に失敗...' : '巨大な拳を撃退しよう');
const fallbackNav = ref<HTMLElement | null>(null);
const fist = ref<HTMLButtonElement | null>(null);
const burstLayer = ref<HTMLElement | null>(null);
const dustLayer = ref<HTMLElement | null>(null);
const announcement = ref('');
const rect = ref({ left: 0, top: 0, width: 0, height: 0 });
const screenWidth = ref(window.innerWidth);
const glyphSize = computed(() => screenWidth.value <= 760 ? 600 : 720);
const progress = computed(() => current.value ? Math.max(0, Math.min(1, (clock.value - current.value.fallAt) / Math.max(1, current.value.endsAt - current.value.fallAt))) : 0);
const position = computed(() => punchPosition(rect.value.height, glyphSize.value, progress.value, preparing.value, reduced.value));
const viewportStyle = computed(() => ({ left: `${rect.value.left}px`, top: `${rect.value.top}px`, width: `${rect.value.width}px`, height: `${rect.value.height}px` }));
const busy = ref(false);
let guardUntil = 0;
let offset = 0;
let lastAcknowledged = 0;
let focusBefore: HTMLElement | null = null;
let watermark: LtlPunchState | null = null;
let dismissedId: string | null = null;
let mounted = false;
let frameId = 0;
let syncTimer: number | null = null;
let retryTimer: number | null = null;
let retryDelay = 1000;
let pageHidden = false;
let burstTimer: number | null = null;
let particleTime = 0;
let resultHandled: string | null = null;
let observer: MutationObserver | null = null;
let protectedRoot: HTMLElement | null = null;
let oldInert = false;
let frameOwner: HTMLElement | null = null;
let oldFramePhase: string | null = null;
let oldFrameClass = false;
let oldFrameReduced = false;
const animations = new Set<Animation>();
const burstAnimations = new Set<Animation>();
interface NoteEffect { element: HTMLElement; top: number; height: number; level: number; }
let notes: NoteEffect[] = [];
type PunchConnection = IChannelConnection<Channels['ltlPunch']>;
let connection: PunchConnection | null = null;
let stream: ReturnType<typeof useStream> | null = null;

function measure(): void {
	const target = props.viewportTarget ?? props.timelineRoot;
	if (!target) return;
	screenWidth.value = window.innerWidth;
	const r = target.getBoundingClientRect();
	const timeline = props.timelineRoot?.getBoundingClientRect();
	const hasNotes = !!props.timelineRoot?.querySelector('[data-note-removal-id]');
	const noteBounds = timeline && timeline.height > 0 && hasNotes ? timeline : null;
	const frameBottom = props.navbarFrame?.getBoundingClientRect().bottom ?? 0;
	const left = Math.max(0, r.left, noteBounds?.left ?? r.left);
	const right = Math.min(window.innerWidth, r.right, noteBounds?.right ?? r.right);
	let top = Math.max(0, r.top, noteBounds?.top ?? r.top, frameBottom);
	let bottom = Math.min(window.innerHeight, r.bottom, noteBounds?.bottom ?? r.bottom);
	// Empty/filtering/loading LTLs still need an attackable stage. Exclude explicit
	// composer regions from the fallback, including composers anchored at the bottom.
	if (!noteBounds) {
		let segments = [{ top, bottom }];
		for (const form of target.querySelectorAll<HTMLElement>('[data-htk-weather-postform], [data-hata-collapse-part][data-position], .mkw-post-form')) {
			const f = form.getBoundingClientRect();
			if (f.height <= 0 || f.right <= left || f.left >= right) continue;
			segments = segments.flatMap(segment => f.bottom <= segment.top || f.top >= segment.bottom ? [segment] : [
				{ top: segment.top, bottom: Math.max(segment.top, f.top) },
				{ top: Math.min(segment.bottom, f.bottom), bottom: segment.bottom },
			]);
		}
		const largest = segments.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))[0];
		top = largest.top; bottom = largest.bottom;
	}
	rect.value = { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function cancelAnimation(animation: Animation): void { try { animation.cancel(); } catch { /* Detached/unsupported animation must never leave the timeline locked. */ } }

function runAnimation(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions, collection = animations): Animation | null {
	try {
		const animation = element.animate(frames, options);
		collection.add(animation);
		void animation.finished.catch(() => {});
		if (options.fill !== 'forwards' && options.fill !== 'both') animation.onfinish = () => { collection.delete(animation); };
		return animation;
	} catch { return null; }
}

function clearBurst(): void {
	if (burstTimer) window.clearTimeout(burstTimer);
	burstTimer = null;
	burstAnimations.forEach(cancelAnimation); burstAnimations.clear();
	burstLayer.value?.replaceChildren();
}

function clearMotion(): void {
	animations.forEach(cancelAnimation); animations.clear();
	dustLayer.value?.replaceChildren(); particleTime = 0;
	notes.forEach(note => { note.level = 0; });
	clearBurst();
}

function collectNotes(): void {
	const root = props.timelineRoot;
	if (!root) return;
	const known = new Set(notes.map(note => note.element));
	const marked = [...root.querySelectorAll<HTMLElement>('[data-note-removal-id]')].filter(element => !element.parentElement?.closest('[data-note-removal-id]'));
	const candidates = marked.length ? marked : [...root.querySelectorAll<HTMLElement>('article')];
	const elements = candidates.length ? candidates : [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
	const origin = rect.value.top;
	notes.forEach(note => { if (note.level === 0) { const r = note.element.getBoundingClientRect(); note.top = r.top - origin; note.height = r.height; } });
	for (const element of elements) {
		if (known.has(element)) continue;
		const r = element.getBoundingClientRect();
		notes.push({ element, top: r.top - origin, height: r.height, level: 0 });
	}
}

function protectNewControls(): void {
	collectNotes();
}

function captureGuard(event: Event): void {
	if (!busy.value) return;
	event.preventDefault(); event.stopImmediatePropagation();
}

const guardedEvents = ['click', 'pointerdown', 'pointerup', 'keydown', 'submit'];

function releaseProtection(): void {
	observer?.disconnect(); observer = null;
	if (protectedRoot) {
		protectedRoot.inert = oldInert;
		guardedEvents.forEach(event => protectedRoot?.removeEventListener(event, captureGuard, true));
	}
	protectedRoot = null;
}

function setBusy(value: boolean): void {
	if (value === busy.value && (!value || protectedRoot === props.timelineRoot)) return;
	releaseProtection(); busy.value = value; emit('busy', value);
	if (!value || !props.timelineRoot) return;
	protectedRoot = props.timelineRoot; oldInert = Boolean(protectedRoot.inert);
	protectedRoot.inert = true;
	guardedEvents.forEach(event => protectedRoot?.addEventListener(event, captureGuard, true));
	protectNewControls();
	observer = new MutationObserver(protectNewControls); observer.observe(protectedRoot, { childList: true, subtree: true });
}

function restoreFrame(): void {
	if (!frameOwner) return;
	if (oldFramePhase === null) frameOwner.removeAttribute('data-ltl-punch-phase'); else frameOwner.setAttribute('data-ltl-punch-phase', oldFramePhase);
	frameOwner.classList.toggle('hata-ltl-punch-frame', oldFrameClass);
	frameOwner.classList.toggle('hata-ltl-punch-reduced', oldFrameReduced); frameOwner = null;
}

function updateFrame(): void {
	const target = props.navbarFrame ?? fallbackNav.value;
	if (frameOwner !== target) {
		restoreFrame(); frameOwner = target;
		if (frameOwner) { oldFramePhase = frameOwner.getAttribute('data-ltl-punch-phase'); oldFrameClass = frameOwner.classList.contains('hata-ltl-punch-frame'); oldFrameReduced = frameOwner.classList.contains('hata-ltl-punch-reduced'); }
	}
	if (!frameOwner) return;
	frameOwner.classList.add('hata-ltl-punch-frame');
	frameOwner.classList.toggle('hata-ltl-punch-reduced', reduced.value);
	frameOwner.setAttribute('data-ltl-punch-phase', phase.value);
}

function damageNote(note: NoteEffect, level: number, index: number): void {
	if (level <= note.level) return;
	note.level = level;
	if (reduced.value) return;
	const el = note.element;
	if (level === 1) runAnimation(el, [{ transform: 'translateX(-3px)' }, { transform: 'translateX(4px) rotate(.8deg)' }, { transform: 'none' }], { duration: 300 });
	if (level === 2) {
		const part = el.querySelector<HTMLElement>('header, [class*="avatar"]');
		if (part) runAnimation(part, [{ transform: 'none' }, { transform: 'translate(-14px,20px) rotate(-18deg)' }], { duration: 450, fill: 'forwards' });
	}
	if (level === 3) {
		const sign = index % 2 ? 1 : -1;
		const y = rect.value.height - note.top - 80 + index % 3 * 13;
		runAnimation(el, [{ transform: 'translate(0,0) rotate(-2deg)' }, { transform: `translate(${sign * (78 + index % 3 * 17)}px,${y}px) rotate(${sign * (18 + index % 3 * 4)}deg)`, opacity: .85 }], { duration: 720, easing: 'cubic-bezier(.55,.02,.9,.48)', fill: 'forwards' });
	}
}

function victoryBurst(): void {
	clearBurst();
	const layer = burstLayer.value; if (!layer) return;
	const calm = reduced.value, count = calm ? 10 : window.innerWidth <= 760 ? 64 : 96;
	const x = Math.max(40, Math.min(window.innerWidth - 40, rect.value.left + rect.value.width / 2));
	const y = Math.max(40, Math.min(window.innerHeight - 40, rect.value.top + Math.max(60, position.value.tip)));
	for (let i = 0; i < count; i++) {
		const image = window.document.createElement('img'); image.src = `/twemoji/${['1f91b', '1f44a', '1f91c'][i % 3]}.svg`; image.alt = ''; image.draggable = false;
		const size = calm ? 36 : 24 + Math.random() * 48;
		const angle = i / count * Math.PI * 2;
		const distance = calm ? 60 : Math.hypot(window.innerWidth, window.innerHeight) * (.25 + Math.random() * .6);
		const dx = Math.cos(angle) * distance, dy = Math.sin(angle) * distance, spin = (Math.random() - .5) * 900;
		Object.assign(image.style, { width: `${size}px`, height: `${size}px`, left: `${x - size / 2 + (calm ? dx : 0)}px`, top: `${y - size / 2 + (calm ? dy : 0)}px` }); layer.append(image);
		runAnimation(image, calm ? [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }] : [{ transform: 'scale(.5)', opacity: 1 }, { transform: `translate(${dx * .58}px,${dy * .58 - 90}px) rotate(${spin * .6}deg)`, opacity: 1, offset: .45 }, { transform: `translate(${dx}px,${dy + 120}px) rotate(${spin}deg)`, opacity: 0 }], { duration: calm ? 850 : 2250 + Math.random() * 450, fill: 'forwards', easing: 'cubic-bezier(.16,.7,.3,1)' }, burstAnimations);
	}
	burstTimer = window.setTimeout(clearBurst, calm ? 910 : 2760);
}

function dust(now: number): void {
	if (reduced.value || now - particleTime < 240) return;
	particleTime = now;
	const layer = dustLayer.value; if (!layer || layer.childElementCount > 25) return;
	for (let i = 0; i < 4; i++) {
		const chip = window.document.createElement('i'); Object.assign(chip.style, { left: `${i % 2 ? 85 : 15}%`, top: `${Math.max(0, position.value.tip)}px` }); layer.append(chip);
		const animation = runAnimation(chip, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translate(${(i - 2) * 35}px,60px) rotate(130deg)`, opacity: 0 }], { duration: 550 });
		if (!animation) { chip.remove(); continue; }
		animation.onfinish = () => { animations.delete(animation); chip.remove(); };
	}
}

function attack(): void {
	if (!connection || !current.value || phase.value !== 'falling' || dismissedId === current.value.id) return;
	connection.send('attack', { eventId: current.value.id, requestId: crypto.randomUUID() });
}

function returnFocus(): void {
	if (window.document.activeElement !== fist.value) return;
	const prior = focusBefore?.isConnected && !focusBefore.closest('[inert]') && !focusBefore.matches(':disabled') ? focusBefore : null;
	const target = prior ?? props.navbarFrame ?? fallbackNav.value;
	if (!target) return;
	const previous = target.getAttribute('tabindex');
	if (previous === null) target.setAttribute('tabindex', '-1');
	target.focus({ preventScroll: true });
	if (previous === null) target.removeAttribute('tabindex');
}

function dismiss(): void {
	dismissedId = current.value?.id ?? null; returnFocus(); clearMotion(); guardUntil = Date.now() + offset + LTL_PUNCH.guard; phase.value = 'idle'; setBusy(true); restoreFrame(); announcement.value = '拳の演出を閉じました。'; scheduleFrame();
}

function receive(incoming: LtlPunchState | null): void {
	lastAcknowledged = Date.now();
	if (!incoming && watermark) return;
	if (!incoming) { returnFocus(); current.value = null; clearMotion(); guardUntil = 0; phase.value = 'idle'; setBusy(false); restoreFrame(); return; }
	if (!acceptPunchState(watermark, incoming)) return;
	const newEvent = current.value?.id !== incoming.id;
	if (newEvent) { focusBefore = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null; clearMotion(); notes = []; resultHandled = null; guardUntil = 0; }
	watermark = incoming; current.value = incoming; offset = incoming.serverNow - Date.now();
	measure(); collectNotes(); scheduleFrame();
}

function scheduleFrame(): void { if (mounted && props.active && !pageHidden && !window.document.hidden && !frameId) frameId = requestAnimationFrame(tick); }

function tick(): void {
	frameId = 0;
	if (!mounted || !props.active || pageHidden || window.document.hidden) return;
	clock.value = Date.now() + offset;
	if (connection && current.value && dismissedId !== current.value.id) {
		const previous = phase.value;
		phase.value = punchPhase(current.value, clock.value);
		if (phase.value !== previous) {
			void nextTick(() => { measure(); collectNotes(); });
			announcement.value = title.value;
			if (phase.value === 'falling' && (window.document.activeElement === window.document.body || props.navbarTarget?.contains(window.document.activeElement))) void nextTick(() => fist.value?.focus({ preventScroll: true }));
			if (phase.value === 'escaped') returnFocus();
			if (phase.value === 'won') {
				returnFocus(); animations.forEach(cancelAnimation); animations.clear(); dustLayer.value?.replaceChildren();
				guardUntil = clock.value + LTL_PUNCH.guard;
				if (resultHandled !== current.value.id && clock.value - (current.value.finishedAt ?? 0) <= LTL_PUNCH.freshVictory) victoryBurst();
				resultHandled = current.value.id;
			}
			if (phase.value === 'idle' && previous !== 'idle') { clearMotion(); returnFocus(); guardUntil = clock.value + LTL_PUNCH.guard; }
		}
		setBusy(preparing.value || phase.value === 'falling' || phase.value === 'escaped' || clock.value < guardUntil);
		if (phase.value !== 'idle') updateFrame(); else restoreFrame();
		if (phase.value === 'falling') { notes.forEach((note, i) => damageNote(note, punchDamage(note.top, note.height, position.value.tip), i)); dust(clock.value); }
		if (phase.value === 'escaped') notes.forEach((note, i) => { if (clock.value - (current.value?.finishedAt ?? clock.value) >= i * 120) damageNote(note, 3, i); });
	}
	if (!current.value || dismissedId === current.value.id) setBusy(clock.value < guardUntil);
	if (phase.value !== 'idle' || clock.value < guardUntil) scheduleFrame();
}

function stopConnection(preserveBackoff = false): void {
	cancelAnimationFrame(frameId); frameId = 0;
	const previous = connection; connection = null; previous?.dispose();
	if (syncTimer) window.clearInterval(syncTimer); syncTimer = null;
	if (retryTimer) window.clearTimeout(retryTimer); retryTimer = null;
	if (!preserveBackoff) retryDelay = 1000;
	if (stream) { stream.off('_disconnected_', disconnected); stream.off('_connected_', connected); } stream = null;
	returnFocus(); current.value = null; phase.value = 'idle'; guardUntil = 0; clearMotion(); notes = []; setBusy(false); restoreFrame();
}

function disconnected(): void { cancelAnimationFrame(frameId); frameId = 0; returnFocus(); current.value = null; phase.value = 'idle'; clearMotion(); guardUntil = 0; setBusy(false); restoreFrame(); }

function connected(): void { lastAcknowledged = Date.now(); connection?.send('sync', {}); }

function retryConnection(): void {
	if (retryTimer) return;
	const delay = retryDelay;
	retryDelay = Math.min(delay * 2, 60000);
	retryTimer = window.setTimeout(() => { retryTimer = null; connect(); }, delay);
}

function connect(): void {
	if (!mounted || !props.active || pageHidden || window.document.hidden || connection || retryTimer) return;
	stream = useStream(); connection = stream.useChannel('ltlPunch');
	const thisConnection = connection;
	thisConnection.on('state', state => {
		if (!mounted || !props.active || pageHidden || window.document.hidden || connection !== thisConnection) return;
		retryDelay = 1000;
		receive(state);
	});
	stream.on('_disconnected_', disconnected); stream.on('_connected_', connected);
	lastAcknowledged = Date.now();
	if (stream.state === 'connected') thisConnection.send('sync', {});
	syncTimer = window.setInterval(() => {
		if (pageHidden || window.document.hidden || stream?.state !== 'connected') return;
		if (Date.now() - lastAcknowledged >= 15000) {
			stopConnection(true);
			retryConnection();
			return;
		}
		connection?.send('sync', {});
	}, 5000);
}

function visibility(): void { if (pageHidden || window.document.hidden) stopConnection(); else connect(); }

function pagehide(): void { pageHidden = true; stopConnection(); }

function pageshow(): void { pageHidden = false; connect(); }

function escape(event: KeyboardEvent): void { if (event.key === 'Escape' && phase.value !== 'idle') { event.preventDefault(); dismiss(); } }

let media: MediaQueryList | null = null;

function mediaChanged(): void { osReduced.value = media?.matches ?? false; }

watch(() => props.active, value => { if (value) connect(); else stopConnection(); });
watch(reduced, () => { clearMotion(); measure(); collectNotes(); });
watch(phase, value => emit('visible', value !== 'idle'));

function boundsChanged(): void { if (phase.value === 'idle') return; measure(); collectNotes(); }

watch(() => props.timelineRoot, () => { clearMotion(); notes = []; measure(); collectNotes(); if (busy.value) setBusy(true); scheduleFrame(); });
watch(() => props.viewportTarget, () => { measure(); collectNotes(); scheduleFrame(); });
watch(() => props.navbarFrame, () => { if (phase.value !== 'idle') updateFrame(); else restoreFrame(); });
onMounted(() => {
	mounted = true; media = matchMedia('(prefers-reduced-motion: reduce)'); osReduced.value = media.matches; media.addEventListener('change', mediaChanged);
	window.document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pagehide); window.addEventListener('pageshow', pageshow); window.addEventListener('keydown', escape, true); window.addEventListener('resize', boundsChanged); window.addEventListener('scroll', boundsChanged, true); connect();
});
onBeforeUnmount(() => {
	mounted = false; cancelAnimationFrame(frameId); stopConnection(); media?.removeEventListener('change', mediaChanged); window.document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow); window.removeEventListener('keydown', escape, true); window.removeEventListener('resize', boundsChanged); window.removeEventListener('scroll', boundsChanged, true); emit('visible', false);
});
</script>

<style>
.hata-ltl-punch-nav{color:var(--MI_THEME-fg);padding:8px 10px;min-height:40px;animation:hata-punch-nav-in .4s ease-out}
.hata-ltl-punch-copy{display:flex;align-items:center;gap:8px;font-size:11px;flex-wrap:wrap}.hata-ltl-punch-copy strong{color:var(--MI_THEME-accent);animation:hata-punch-nav-in .4s ease-out}.hata-ltl-punch-copy span{margin-left:auto;font-size:10px}.hata-ltl-punch-copy button{min-width:44px;min-height:44px;border:0;background:transparent;color:inherit;cursor:pointer}
.hata-ltl-punch-meter{height:4px;background:#80383e55;overflow:hidden}.hata-ltl-punch-meter i{display:block;height:100%;background:var(--MI_THEME-accent);transition:none}
.hata-ltl-punch-frame{isolation:isolate}.hata-ltl-punch-fallback{position:relative}.hata-ltl-punch-frame::after{content:"";position:absolute;inset:0;padding:2px;background:linear-gradient(115deg,#c9283d,#ff783f,#9d1232);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;opacity:0;transition:opacity .5s;z-index:4}
.hata-ltl-punch-frame[data-ltl-punch-phase=charging]::after,.hata-ltl-punch-frame[data-ltl-punch-phase=warning]::after{opacity:1;animation:hata-punch-alert 1.2s ease-in-out infinite;filter:drop-shadow(0 0 6px #e82f42aa)}
@keyframes hata-punch-alert{0%,100%{opacity:.45}50%{opacity:1}}@keyframes hata-punch-nav-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.hata-ltl-punch-shield,.hata-ltl-punch-viewport{position:fixed;z-index:15000;overflow:hidden}.hata-ltl-punch-shield{background:transparent;touch-action:manipulation}.hata-ltl-punch-viewport{z-index:15001;pointer-events:none}.hata-ltl-punch-fist{position:absolute;left:50%;transform:translateX(-50%);border:0;background:transparent;padding:0;pointer-events:auto;cursor:pointer;touch-action:manipulation;filter:drop-shadow(0 20px 22px #0007)}.hata-ltl-punch-fist:focus-visible{outline:2px solid var(--MI_THEME-accent);outline-offset:-4px}.hata-ltl-punch-fist img{display:block;width:100%;height:100%;object-fit:contain;transform:rotate(90deg);pointer-events:none}.hata-ltl-punch-fist small{position:absolute;bottom:7%;left:50%;transform:translateX(-50%);white-space:nowrap;background:var(--MI_THEME-accent);color:var(--MI_THEME-fgOnAccent);padding:5px 9px;border-radius:4px;font-size:11px}
.hata-ltl-punch-wind{position:absolute;left:0;right:0;pointer-events:none}.hata-ltl-punch-wind i{position:absolute;left:8%;height:170px;width:2px;background:linear-gradient(transparent,#ffc5e6aa,transparent);animation:hata-punch-wind .65s linear infinite}.hata-ltl-punch-wind i:nth-child(2){left:18%;height:110px;animation-delay:-.2s}.hata-ltl-punch-wind i:nth-child(3){left:88%;animation-delay:-.4s}.hata-ltl-punch-wind i:nth-child(4){left:78%;height:125px;animation-delay:-.1s}.hata-ltl-punch-wind i:nth-child(5){left:3%;animation-delay:-.3s}.hata-ltl-punch-wind i:nth-child(6){left:96%;height:100px;animation-delay:-.5s}@keyframes hata-punch-wind{from{transform:translateY(-55px);opacity:.2}to{transform:translateY(75px);opacity:1}}
.hata-ltl-punch-dust{position:absolute;inset:0;overflow:hidden;pointer-events:none}.hata-ltl-punch-dust i{position:absolute;width:10px;height:6px;background:var(--MI_THEME-accent)}.hata-ltl-punch-burst{position:fixed;inset:0;z-index:15002;overflow:hidden;pointer-events:none;contain:strict}.hata-ltl-punch-burst img{position:absolute;display:block;object-fit:contain;pointer-events:none;will-change:transform,opacity}
.hata-ltl-punch-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.hata-ltl-punch-reduced::after,.hata-ltl-punch-nav.reduced,.hata-ltl-punch-nav.reduced strong{animation:none!important;transition:none!important}
</style>
