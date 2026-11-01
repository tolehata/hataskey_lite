/* SPDX-License-Identifier: AGPL-3.0-only */

export type TimelineAdMarker = { _shouldInsertAd_?: boolean };

/** Keep the existing paginator's per-page positions without changing the fetched notes. */
export function markTimelineAdPage<T extends object>(items: T[], phase: 'initial' | 'older'): (T & TimelineAdMarker)[] {
	const index = phase === 'initial' ? 3 : 10;
	if (items.length <= index) return items;
	return items.map((item, i) => i === index ? { ...item, _shouldInsertAd_: true } : item);
}

export function shouldInsertStreamingAd(counter: number, interval: number): boolean {
	return interval > 0 && counter % interval === 0;
}
