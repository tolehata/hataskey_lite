/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { prefer } from '@/preferences.js';

export type HataIconMotion =
	| 'image-rise' | 'drive-settle' | 'drive-drop' | 'poll-grow' | 'eye-close'
	| 'hash-tilt' | 'mention-orbit' | 'calendar-page' | 'palette-tilt'
	| 'plug-connect' | 'emoji-pop' | 'globe-spin' | 'bell-ring'
	| 'message-shift' | 'rocket-launch' | 'activity-pulse' | 'star-turn'
	| 'gamepad-tap'
	| 'user-rise' | 'follow-emphasis' | 'antenna-pulse' | 'settings-turn'
	| 'layout-slide' | 'pencil-write' | 'reload-spin' | 'announcement-recoil'
	| 'home-rock' | 'more-dots' | 'search-scan' | 'cache-clear'
	| 'simple-lift' | 'press';

const frames: Record<HataIconMotion, Keyframe[]> = {
	'image-rise': [{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)', offset: .55 }, { transform: 'translateY(0)' }],
	'drive-settle': [{ transform: 'translateY(0)' }, { transform: 'translateY(-1px)', offset: .42 }, { transform: 'translateY(0)' }],
	'drive-drop': [{ transform: 'translateY(-4px)', opacity: .55 }, { transform: 'translateY(2px)', opacity: 1, offset: .62 }, { transform: 'translateY(0)', opacity: 1 }],
	'poll-grow': [{ transform: 'scaleY(.62)', transformOrigin: '50% 100%' }, { transform: 'scaleY(1.12)', transformOrigin: '50% 100%', offset: .68 }, { transform: 'scaleY(1)', transformOrigin: '50% 100%' }],
	'eye-close': [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.12)', offset: .48 }, { transform: 'scaleY(1)' }],
	'hash-tilt': [{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)', offset: .35 }, { transform: 'translateX(2px)', offset: .7 }, { transform: 'translateX(0)' }],
	'mention-orbit': [{ transform: 'rotate(0)' }, { transform: 'rotate(18deg)', offset: .52 }, { transform: 'rotate(0)' }],
	'calendar-page': [{ transform: 'perspective(80px) rotateX(0)' }, { transform: 'perspective(80px) rotateX(38deg) translateY(-2px)', offset: .48 }, { transform: 'perspective(80px) rotateX(0)' }],
	'palette-tilt': [{ transform: 'rotate(0) translateY(0)' }, { transform: 'rotate(-24deg) translateY(-3px)', offset: .55 }, { transform: 'rotate(0) translateY(0)' }],
	'plug-connect': [{ transform: 'translateX(-3px)' }, { transform: 'translateX(2px)', offset: .56 }, { transform: 'translateX(0)' }],
	'emoji-pop': [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-8deg) scale(1.12)', offset: .35 }, { transform: 'rotate(7deg) scale(1)', offset: .7 }, { transform: 'rotate(0) scale(1)' }],
	'globe-spin': [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }],
	'bell-ring': [{ transform: 'rotate(0)', transformOrigin: '50% 10%' }, { transform: 'rotate(-16deg)', transformOrigin: '50% 10%', offset: .25 }, { transform: 'rotate(14deg)', transformOrigin: '50% 10%', offset: .5 }, { transform: 'rotate(-7deg)', transformOrigin: '50% 10%', offset: .72 }, { transform: 'rotate(0)', transformOrigin: '50% 10%' }],
	'message-shift': [{ transform: 'translateY(0)' }, { transform: 'translateY(-1px)', offset: .42 }, { transform: 'translateY(0)' }],
	'rocket-launch': [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-6px)', opacity: .55, offset: .55 }, { transform: 'translateY(0)', opacity: 1 }],
	'activity-pulse': [{ transform: 'scaleX(1) scaleY(1)' }, { transform: 'scaleX(1.18) scaleY(.82)', offset: .28 }, { transform: 'scaleX(.9) scaleY(1.22)', offset: .56 }, { transform: 'scaleX(1) scaleY(1)' }],
	'star-turn': [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(38deg) scale(1.22)', offset: .45 }, { transform: 'rotate(0) scale(1)' }],
	'gamepad-tap': [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg) translateY(-1px)', offset: .34 }, { transform: 'rotate(5deg) translateY(1px)', offset: .68 }, { transform: 'rotate(0)' }],
	'user-rise': [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)', offset: .45 }, { transform: 'translateY(0)' }],
	'follow-emphasis': [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: .46 }, { transform: 'scale(1)' }],
	'antenna-pulse': [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.18)', opacity: .58, offset: .5 }, { transform: 'scale(1)', opacity: 1 }],
	'settings-turn': [{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }],
	'layout-slide': [{ transform: 'scaleX(1) translateX(0)' }, { transform: 'scaleX(1.2) translateX(2px)', offset: .45 }, { transform: 'scaleX(.94) translateX(-1px)', offset: .72 }, { transform: 'scaleX(1) translateX(0)' }],
	'pencil-write': [{ transform: 'translate(0, 0) rotate(0)' }, { transform: 'translate(3px, -3px) rotate(-8deg)', offset: .35 }, { transform: 'translate(-2px, 2px) rotate(4deg)', offset: .7 }, { transform: 'translate(0, 0) rotate(0)' }],
	'reload-spin': [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }],
	'announcement-recoil': [{ transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-1px) rotate(-4deg)', offset: .24 }, { transform: 'translateX(1px) rotate(2deg)', offset: .48 }, { transform: 'rotate(-1deg)', offset: .72 }, { transform: 'translateX(0) rotate(0)' }],
	'home-rock': [{ transform: 'rotate(0)' }, { transform: 'rotate(-13deg)', offset: .28 }, { transform: 'rotate(12deg)', offset: .56 }, { transform: 'rotate(-4deg)', offset: .78 }, { transform: 'rotate(0)' }],
	'more-dots': [{ opacity: 1 }, { opacity: .18, offset: .18 }, { opacity: .18, offset: .82 }, { opacity: 1 }],
	'search-scan': [{ transform: 'translate(0, 0) rotate(0)' }, { transform: 'translate(3px, -2px) rotate(-9deg)', offset: .35 }, { transform: 'translate(-2px, 2px) rotate(7deg)', offset: .7 }, { transform: 'translate(0, 0) rotate(0)' }],
	'cache-clear': [{ transform: 'scale(.78)', opacity: 0 }, { transform: 'scale(.78)', opacity: 0, offset: .46 }, { transform: 'scale(1.04)', opacity: 1, offset: .56 }, { transform: 'scale(1)', opacity: 1, offset: .68 }, { transform: 'scale(1)', opacity: 1 }],
	'simple-lift': [{ transform: 'translateY(0)' }, { transform: 'translateY(-1px)', offset: .42 }, { transform: 'translateY(1px)', offset: .68 }, { transform: 'translateY(0)' }],
	press: [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-1px)', opacity: .72, offset: .5 }, { transform: 'translateY(0)', opacity: 1 }],
};

const navigationMotion: Record<string, HataIconMotion> = {
	timeline: 'home-rock', home: 'home-rock', following: 'home-rock', 'timeline:home': 'home-rock',
	local: 'globe-spin', global: 'globe-spin', 'timeline:local': 'globe-spin', 'timeline:global': 'globe-spin', 'timeline:external-local': 'globe-spin',
	social: 'rocket-launch', 'timeline:social': 'rocket-launch', 'timeline:external-home': 'rocket-launch',
	trending: 'activity-pulse', 'timeline:trending': 'activity-pulse', earthquake: 'activity-pulse', 'tool:earthquake': 'activity-pulse',
	search: 'search-scan', 'tool:search': 'search-scan',
	notifications: 'bell-ring', externalNotifications: 'bell-ring', 'tool:notifications': 'bell-ring', 'tool:externalNotifications': 'bell-ring',
	chat: 'message-shift', messages: 'message-shift', 'tool:chat': 'message-shift',
	announcements: 'announcement-recoil', 'tool:announcements': 'announcement-recoil',
	drive: 'drive-settle', 'tool:drive': 'drive-settle',
	hatask: 'eye-close', 'tool:hatask': 'eye-close',
	hatafeed: 'simple-lift', 'tool:hatafeed': 'simple-lift',
	hatady: 'simple-lift', 'tool:hatady': 'simple-lift',
	channels: 'simple-lift', channel: 'simple-lift', lists: 'simple-lift', list: 'simple-lift',
	antennas: 'antenna-pulse', antenna: 'antenna-pulse',
	favorites: 'star-turn', 'tool:favorites': 'star-turn', explore: 'activity-pulse', 'tool:explore': 'activity-pulse',
	followRequests: 'follow-emphasis', uiSetup: 'palette-tilt', 'tool:ui': 'palette-tilt',
	games: 'gamepad-tap', 'tool:games': 'gamepad-tap', clips: 'simple-lift', 'tool:clips': 'simple-lift',
	studio: 'layout-slide', 'tool:studio': 'layout-slide', admin: 'layout-slide', deck: 'layout-slide', widgets: 'layout-slide', layout: 'layout-slide',
	realtime: 'activity-pulse',
	settings: 'settings-turn', post: 'pencil-write', more: 'more-dots', reload: 'reload-spin', cacheClear: 'cache-clear',
};

export function hataNavigationMotion(id: string): HataIconMotion {
	if (id.startsWith('list:')) return 'simple-lift';
	if (id.startsWith('antenna:')) return 'antenna-pulse';
	if (id.startsWith('channel:')) return 'simple-lift';
	return navigationMotion[id] ?? 'press';
}

function animationAllowed(): boolean {
	return prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createFxPart(rect: DOMRect, color: string): HTMLSpanElement {
	const part = window.document.createElement('span');
	part.dataset.hataIconMotionFx = '';
	Object.assign(part.style, { position: 'fixed', zIndex: '2147483646', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, color, pointerEvents: 'none', transformOrigin: 'center' });
	window.document.body.append(part);
	return part;
}

function playAuxiliaryFx(icon: Element, motion: HataIconMotion, duration: number): void {
	const rect = icon.getBoundingClientRect();
	const color = getComputedStyle(icon).color;
	if (motion === 'announcement-recoil') {
		for (const [index, size] of [7, 12].entries()) {
			const wave = createFxPart(rect, color);
			Object.assign(wave.style, { left: `${rect.right - 1 + index * 2}px`, top: `${rect.top + (rect.height - size) / 2}px`, width: `${size / 2}px`, height: `${size}px`, border: '1.5px solid currentColor', borderLeft: '0', borderRadius: '0 999px 999px 0' });
			wave.animate([{ opacity: 0, transform: 'scale(.72)' }, { opacity: .82, transform: 'scale(1)', offset: .42 }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 620, delay: index * 70, easing: 'cubic-bezier(.2,.72,.24,1)' }).finished.finally(() => wave.remove());
		}
	} else if (motion === 'follow-emphasis') {
		const plus = createFxPart(rect, color);
		plus.textContent = '+';
		Object.assign(plus.style, { left: `${rect.right - 4}px`, top: `${rect.top - 5}px`, width: '10px', height: '12px', font: '800 11px/1 system-ui', textAlign: 'center' });
		plus.animate([{ opacity: 0, transform: 'scale(.72)' }, { opacity: 1, transform: 'scale(1.16)', offset: .36 }, { opacity: 1, transform: 'scale(1)', offset: .64 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }).finished.finally(() => plus.remove());
	} else if (motion === 'more-dots') {
		for (let index = 0; index < 3; index++) {
			const dot = createFxPart(rect, color);
			Object.assign(dot.style, { left: `${rect.left + rect.width / 2 - 5 + index * 4}px`, top: `${rect.top + rect.height / 2 - 1.5}px`, width: '3px', height: '3px', borderRadius: '50%', background: color });
			dot.animate([{ opacity: .2, transform: 'scale(.65)' }, { opacity: 1, transform: 'scale(1.2)', offset: .4 }, { opacity: .2, transform: 'scale(.65)' }], { duration: 540, delay: index * 90, easing: 'ease-in-out' }).finished.finally(() => dot.remove());
		}
	} else if (motion === 'cache-clear') {
		const trash = createFxPart(rect, color);
		Object.assign(trash.style, { left: `${rect.left + rect.width * .31}px`, top: `${rect.top + rect.height * .2}px`, width: `${Math.max(6, rect.width * .38)}px`, height: `${Math.max(5, rect.height * .3)}px`, borderRadius: '48% 58% 44% 54%', background: color });
		trash.animate([{ opacity: 1, transform: 'translateY(-3px) rotate(-8deg) scale(1)' }, { opacity: 1, transform: 'translateY(-3px) rotate(-8deg) scale(.62)', offset: .28 }, { opacity: 1, transform: 'translateY(-3px) rotate(-8deg) scale(.62)', offset: .58 }, { opacity: .78, transform: 'translateY(10px) rotate(3deg) scale(.38)', offset: .9 }, { opacity: 0, transform: 'translateY(11px) rotate(3deg) scale(.16)' }], { duration, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.finally(() => trash.remove());
	}
}

function semanticMotionTarget(icon: Element): Element {
	if (icon.matches('[data-hata-icon-motion-part="semantic"]')) return icon;
	return icon.querySelector('[data-hata-icon-motion-part="semantic"]') ?? icon;
}

export function playHataIconMotion(event: Event, motion: HataIconMotion, duration = 520): void {
	if (!animationAllowed()) return;
	const source = event.currentTarget;
	if (!(source instanceof HTMLElement)) return;
	const icon = source.matches('i, svg, img') ? source : source.querySelector('i, svg, img');
	if (icon == null || typeof icon.animate !== 'function') return;
	const target = semanticMotionTarget(icon);
	for (const animation of icon.getAnimations()) animation.cancel();
	if (target !== icon) for (const animation of target.getAnimations()) animation.cancel();
	// Mascot icons expose only their semantic object as the motion target. Keeping
	// auxiliary effects on the legacy root path preserves every existing icon.
	if (target === icon) playAuxiliaryFx(icon, motion, duration);
	target.animate(frames[motion], { duration, easing: motion === 'globe-spin' || motion === 'reload-spin' ? 'cubic-bezier(.4,0,.2,1)' : 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
}

export function playHataNavigationMotion(event: Event, id: string, duration = 620): void {
	playHataIconMotion(event, hataNavigationMotion(id), duration);
}
