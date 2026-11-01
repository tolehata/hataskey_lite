/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyActivity } from '@/utility/hatady-media.js';

export type HatadyTimelineScope = 'mine' | 'recent' | 'following';
export type HatadyTimelineKind = 'all' | 'study' | 'movie' | 'game' | 'exercise' | 'work' | 'cooking';
export type HatadyTimelineKey = `log:${string}` | `session:${string}`;

export function hatadyTimelineKey(activity: HatadyActivity): HatadyTimelineKey {
	return `${activity.study ? 'log' : 'session'}:${activity.id}`;
}

export function compareHatadyTimelineActivities(a: HatadyActivity, b: HatadyActivity): number {
	const date = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
	if (date !== 0) return date;
	const source = Number(Boolean(b.study)) - Number(Boolean(a.study));
	if (source !== 0) return source;
	return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
}

export function sortHatadyTimelineActivities(items: readonly HatadyActivity[]): HatadyActivity[] {
	return [...new Map(items.map(item => [hatadyTimelineKey(item), item])).values()].sort(compareHatadyTimelineActivities);
}

export function upsertHatadyTimelineActivity(items: readonly HatadyActivity[], activity: HatadyActivity): HatadyActivity[] {
	const key = hatadyTimelineKey(activity);
	return sortHatadyTimelineActivities([...items.filter(item => hatadyTimelineKey(item) !== key), activity]);
}

export function removeHatadyTimelineActivity(items: readonly HatadyActivity[], key: string): HatadyActivity[] {
	return items.filter(item => hatadyTimelineKey(item) !== key);
}

/** A request may only publish its result while its view and connection are current. */
export class HatadyTimelineGeneration {
	private generation = 0;
	public next(): number { return ++this.generation; }
	public current(value: number): boolean { return value === this.generation; }
	public invalidate(): void { this.generation++; }
}

export function hatadyTimelineAutoRefreshAllowed(active: boolean, realtimeMode: boolean, visible: boolean): boolean {
	return active && realtimeMode && visible;
}

export function hatadyTimelineShouldLoadOnActivate(realtimeMode: boolean, initialLoadSettled: boolean): boolean {
	return realtimeMode || !initialLoadSettled;
}

export function hatadyTimelineTrackedKeys(displayed: readonly HatadyActivity[], queued: readonly HatadyActivity[]): string[] {
	return [...new Set([...displayed, ...queued].map(hatadyTimelineKey))];
}
