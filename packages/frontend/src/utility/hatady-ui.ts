/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { shallowRef } from 'vue';
import { i18n } from '@/i18n.js';

export type HatadyNotice = { id: number; message: string; duration: number };
export const hatadyNotice = shallowRef<HatadyNotice | null>(null);
export const hatadyDialogSurfaces = shallowRef<HTMLElement[]>([]);
let noticeId = 0;

export function hatadyNotify(message: string): void {
	hatadyNotice.value = { id: ++noticeId, message: message.trim().replace(/[。、]+$/u, ''), duration: 5000 };
}

export function registerHatadySurface(element: HTMLElement): () => void {
	hatadyDialogSurfaces.value = [...hatadyDialogSurfaces.value, element];
	return () => {
		hatadyDialogSurfaces.value = hatadyDialogSurfaces.value.filter((item) => item !== element);
	};
}

export const HATADY_ACTIVITY_CHOICES = [
	{ value: 'study', get label() { return i18n.ts._hata._hatady._activityKinds.study; }, icon: 'ti ti-book' },
	{ value: 'movie', get label() { return i18n.ts._hata._hatady._profile.movie; }, icon: 'ti ti-movie' },
	{ value: 'game', get label() { return i18n.ts._hata._hatady._profile.game; }, icon: 'ti ti-device-gamepad-2' },
	{ value: 'exercise', get label() { return i18n.ts._hata._hatady._activityKinds.exercise; }, icon: 'ti ti-run' },
	{ value: 'work', get label() { return i18n.ts._hata._hatady._activityKinds.work; }, icon: 'ti ti-briefcase' },
	{ value: 'cooking', get label() { return i18n.ts._hata._hatady._activityKinds.cooking; }, icon: 'ti ti-tools-kitchen-2' },
] as const;

export const HATADY_RECORD_TAGS = [
	{ value: 'strength', get label() { return i18n.ts._hata._hatady._tags.strength; }, icon: 'ti ti-star' },
	{ value: 'weak', get label() { return i18n.ts._hata._hatady._tags.weak; }, icon: 'ti ti-flag' },
	{ value: 'interest', get label() { return i18n.ts._hata._hatady._tags.interest; }, icon: 'ti ti-bulb' },
	{ value: 'effort', get label() { return i18n.ts._hata._hatady._recordTags.effort; }, icon: 'ti ti-flame' },
	{ value: 'recommend', get label() { return i18n.ts._hata._hatady._bookDetail.recommend; }, icon: 'ti ti-thumb-up' },
	{ value: 'progress', get label() { return i18n.ts._hata._hatady._recordTags.progress; }, icon: 'ti ti-pencil' },
	{ value: 'smooth', get label() { return i18n.ts._hata._hatady._recordTags.smooth; }, icon: 'ti ti-circle-check' },
	{ value: 'blocked', get label() { return i18n.ts._hata._hatady._recordTags.blocked; }, icon: 'ti ti-alert-circle' },
	{ value: 'review', get label() { return i18n.ts._hata._hatady._recordTags.review; }, icon: 'ti ti-eye' },
	{ value: 'doneDay', get label() { return i18n.ts._hata._hatady._recordTags.doneDay; }, icon: 'ti ti-check' },
	{ value: 'doneAll', get label() { return i18n.ts._hata._hatady._recordTags.doneAll; }, icon: 'ti ti-checks' },
	{ value: 'movie', get label() { return i18n.ts._hata._hatady._tags.movie; }, icon: 'ti ti-movie' },
	{ value: 'game', get label() { return i18n.ts._hata._hatady._tags.game; }, icon: 'ti ti-device-gamepad-2' },
] as const;

export function hatadyDuration(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds)) return '—';
	const value = Math.max(0, seconds),
		hours = Math.floor(value / 3600),
		minutes = Math.floor((value % 3600) / 60),
		rest = value % 60;
	return (
		`${hours ? i18n.tsx._hata._hatady._duration.hours({ count: String(hours) }) : ''}${minutes ? i18n.tsx._hata._hatady._duration.minutes({ count: String(minutes) }) : ''}${rest ? i18n.tsx._hata._hatady._duration.seconds({ count: String(Number(rest.toFixed(3))) }) : ''}` ||
		i18n.tsx._hata._hatady._duration.minutes({ count: '0' })
	);
}

/** The exact field is authoritative, including an explicit null. Old responses still use minutes. */
export function hatadySeconds(value: {
	durationSeconds?: number | null;
	durationMinutes?: number | null;
}): number | null {
	return Object.hasOwn(value, 'durationSeconds')
		? (value.durationSeconds ?? null)
		: value.durationMinutes == null
			? null
			: value.durationMinutes * 60;
}
