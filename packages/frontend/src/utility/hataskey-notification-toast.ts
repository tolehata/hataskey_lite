/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, shallowReactive, shallowRef } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { entities } from 'cherrypick-js';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';

export const NOTIFICATION_TOAST_DURATION = 5000;
export const NOTE_ACTION_TOAST_DURATION = 3000;

export type HataskeyNavbarNotice =
	| { kind: 'status'; message: string; icon?: string }
	| { kind: 'noteAction'; action: 'favorite' | 'clip' | 'edit' | 'delete'; message: string; target?: string }
	| { kind: 'emojiAdded'; emoji: Pick<entities.EmojiDetailed, 'id' | 'name' | 'url'> }
	| { kind: 'hourlyTime'; time: string };

export type HataskeyToastSurface = {
	active: Readonly<Ref<boolean>>;
	target: Readonly<Ref<HTMLElement | null>>;
	outline: Readonly<Ref<HTMLElement | null>>;
	animations: Readonly<Ref<boolean>>;
	/** A host such as HataGoes may opt its own notice motion out of global reductions. */
	forceAnimations?: Readonly<Ref<boolean>>;
	paused?: Readonly<Ref<boolean>>;
};

export function hataskeyToastMotionEnabled(surface: HataskeyToastSurface | undefined, animationPreference: boolean, reducedMotion: boolean): boolean {
	return surface?.forceAnimations?.value === true || (animationPreference && !reducedMotion && (surface?.animations.value ?? true));
}

export type HataskeyToast = {
	id: number;
	host?: string;
	elapsed: number;
	updatedAt: number;
} & ({ source: 'local' | 'external'; notification: entities.Notification } | { source: 'concrnt'; notification: ConcrntNotification } | { source: 'status'; message: string; welcomeUser?: entities.UserLite; favoriteSaved?: true; navbarNotice?: HataskeyNavbarNotice });

export function getToastDuration(item: HataskeyToast): number {
	return item.source === 'status' && item.navbarNotice?.kind === 'noteAction' ? NOTE_ACTION_TOAST_DURATION : NOTIFICATION_TOAST_DURATION;
}

/** One queue for both accounts; changing presentation never restarts a timer. */
export function createHataskeyNotificationToasts(nativeMobile: ComputedRef<boolean>, navbarVisible: ComputedRef<boolean>, navbarAvailable: ComputedRef<boolean> = navbarVisible) {
	const items = shallowRef<HataskeyToast[]>([]);
	const target = shallowRef<HTMLElement | null>(null);
	const outline = shallowRef<HTMLElement | null>(null);
	const height = shallowRef(0);
	const paused = shallowRef(false);
	const surfaces = shallowRef<HataskeyToastSurface[]>([]);
	const surface = computed(() => surfaces.value.findLast(value => value.active.value && value.target.value && value.outline.value));
	const mobile = computed(() => !!surface.value || nativeMobile.value);
	const canIntegrateStatus = computed(() => !!surface.value || nativeMobile.value || navbarAvailable.value);
	const navbarNotice = computed(() => {
		const item = items.value[0];
		return item?.source === 'status' ? item.navbarNotice : undefined;
	});
	const integrated = computed(() => mobile.value || navbarVisible.value || !!navbarNotice.value);
	let sequence = 0;

	/** A visible mobile page borrows the existing host without duplicating receipt or timers. */
	function registerSurface(value: HataskeyToastSurface): () => void {
		surfaces.value = [...surfaces.value, value];
		return () => { surfaces.value = surfaces.value.filter(entry => entry !== value); };
	}

	function enqueue(notification: entities.Notification, source: 'local' | 'external', now = performance.now(), host?: string) {
		const item = shallowReactive({ id: ++sequence, notification, source, host, elapsed: 0, updatedAt: now });
		const previous = items.value.filter(x => !((x.source === 'local' || x.source === 'external') && x.source === source && x.host === host && x.notification.id === notification.id));
		items.value = [item, ...previous].slice(0, integrated.value ? 1 : 3);
	}

	/** Concrnt is shown like the external account: a labelled outside source in the same queue. */
	function enqueueConcrnt(notification: ConcrntNotification, now = performance.now()) {
		const item = shallowReactive<HataskeyToast>({ id: ++sequence, source: 'concrnt', notification, elapsed: 0, updatedAt: now });
		const previous = items.value.filter(x => !(x.source === 'concrnt' && x.notification.uri === notification.uri));
		items.value = [item, ...previous].slice(0, integrated.value ? 1 : 3);
	}

	function enqueueStatus(message: string, now = performance.now(), welcomeUser?: entities.UserLite, favoriteSaved?: true) {
		const item = shallowReactive<HataskeyToast>({ id: ++sequence, source: 'status', message, welcomeUser, favoriteSaved, elapsed: 0, updatedAt: now });
		items.value = [item, ...items.value].slice(0, integrated.value ? 1 : 3);
	}

	/** In-app navbar feedback only: never a server notification or a floating card. */
	function enqueueNavbarNotice(notice: HataskeyNavbarNotice, now = performance.now()) {
		items.value = [shallowReactive<HataskeyToast>({ id: ++sequence, source: 'status', message: 'message' in notice ? notice.message : '', navbarNotice: notice, elapsed: 0, updatedAt: now })];
	}

	function dismissNavbarNotice(kind?: HataskeyNavbarNotice['kind']) {
		items.value = items.value.filter(item => !(item.source === 'status' && item.navbarNotice && (!kind || item.navbarNotice.kind === kind)));
	}

	function dismiss(id: number) {
		items.value = items.value.filter(item => item.id !== id);
	}

	function tick(now: number, pausedItems: ReadonlySet<number>) {
		for (const item of items.value) {
			if (!paused.value && !surface.value?.paused?.value && !pausedItems.has(item.id)) item.elapsed = Math.min(getToastDuration(item), item.elapsed + Math.max(0, now - item.updatedAt));
			item.updatedAt = now;
		}
		const expired = items.value.filter(item => item.elapsed >= getToastDuration(item));
		if (expired.length) items.value = items.value.filter(item => item.elapsed < getToastDuration(item));
	}

	function clear() {
		items.value = [];
	}

	return { mobile, integrated, canIntegrateStatus, navbarNotice, items, target, outline, height, paused, surface, registerSurface, enqueue, enqueueConcrnt, enqueueStatus, enqueueNavbarNotice, dismissNavbarNotice, dismiss, tick, clear };
}

export type HataskeyNotificationToasts = ReturnType<typeof createHataskeyNotificationToasts>;
export const hataskeyNotificationToastsKey: InjectionKey<HataskeyNotificationToasts> = Symbol('hataskeyNotificationToasts');

// A page in the universal/deck shell can use the same receiver and timer host.
const pageContexts: { context: HataskeyNotificationToasts; active: () => boolean }[] = [];
export function registerNotificationPageContext(context: HataskeyNotificationToasts, active: () => boolean): () => void {
	const entry = { context, active };
	pageContexts.push(entry);
	return () => { const index = pageContexts.indexOf(entry); if (index >= 0) pageContexts.splice(index, 1); };
}
export function getNotificationPageContext(): HataskeyNotificationToasts | undefined {
	return pageContexts.findLast(entry => entry.active())?.context;
}

/** 表示中の通知領域へ直接届け、ポップアップのマウント待ちによる表示順の逆転を防ぐ。 */
export function enqueuePageStatusToast(message: string, icon?: string, target?: string): boolean {
	const context = getNotificationPageContext();
	if (!context?.canIntegrateStatus.value || !(context.surface.value?.target.value ?? context.target.value)) return false;
	if (icon === 'edited' || icon === 'clipped' || icon === 'deleted') {
		context.enqueueNavbarNotice({ kind: 'noteAction', action: icon === 'edited' ? 'edit' : icon === 'clipped' ? 'clip' : 'delete', message, target });
	} else {
		context.enqueueNavbarNotice({ kind: 'status', message, icon });
	}
	return true;
}

/** Open paths meet at the bottom; floating cards start at the top-right arc. */
export function notificationOutlinePaths(width: number, height: number, radius: number, integrated: boolean): string[] {
	const right = Math.max(1, width - 1);
	const bottom = Math.max(1, height - 1);
	const r = Math.max(0, Math.min(radius - 1, (right - 1) / 2, (bottom - 1) / 2));
	if (integrated) {
		return [
			`M ${width / 2} 1 H ${right - r} A ${r} ${r} 0 0 1 ${right} ${1 + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${width / 2}`,
			`M ${width / 2} 1 H ${1 + r} A ${r} ${r} 0 0 0 1 ${1 + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${1 + r} ${bottom} H ${width / 2}`,
		];
	}
	const x = right - r + r * Math.SQRT1_2;
	const y = 1 + r - r * Math.SQRT1_2;
	return [`M ${x} ${y} A ${r} ${r} 0 0 1 ${right} ${1 + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${1 + r} A ${r} ${r} 0 0 1 1 ${bottom - r} V ${1 + r} A ${r} ${r} 0 0 1 ${1 + r} 1 H ${right - r} A ${r} ${r} 0 0 1 ${x} ${y} Z`];
}
