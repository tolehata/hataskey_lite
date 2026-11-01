/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

export const basicTimelineTypes = [
	'home',
	'local',
	'social',
	'global',
	'media',
	'bubble',
] as const;

export type BasicTimelineType = typeof basicTimelineTypes[number];

export function isBasicTimeline(timeline: string | null | undefined): timeline is BasicTimelineType {
	return basicTimelineTypes.includes(timeline as BasicTimelineType);
}

export function basicTimelineIconClass(timeline: BasicTimelineType): string {
	switch (timeline) {
		case 'home':
			return 'ti ti-home';
		case 'local':
			return 'ti ti-planet';
		case 'social':
			return 'ti ti-universe';
		case 'global':
			return 'ti ti-world';
		case 'media':
			return 'ti ti-photo';
		case 'bubble':
			return 'ti ti-droplet';
	}
}

export function isAvailableBasicTimeline(timeline: BasicTimelineType | undefined | null): boolean {
	switch (timeline) {
		case 'home':
			return $i != null && prefer.s.enableHomeTimeline;
		case 'local':
			return ($i == null && instance.policies.ltlAvailable) || ($i != null && $i.policies.ltlAvailable && prefer.s.enableLocalTimeline);
		case 'social':
			return $i != null && $i.policies.ltlAvailable && prefer.s.enableSocialTimeline;
		case 'global':
			return ($i == null && instance.policies.gtlAvailable) || ($i != null && $i.policies.gtlAvailable && prefer.s.enableGlobalTimeline);
		case 'media':
			return ($i == null && instance.policies.ltlAvailable) || ($i != null && $i.policies.ltlAvailable && prefer.s.enableMediaTimeline);
		case 'bubble':
			return ($i == null && instance.policies.btlAvailable) || ($i != null && $i.policies.btlAvailable && prefer.s.enableBubbleTimeline);
		default:
			return false;
	}
}

export function availableBasicTimelines(): BasicTimelineType[] {
	return basicTimelineTypes.filter(isAvailableBasicTimeline);
}

export function hasWithReplies(timeline: BasicTimelineType | undefined | null): boolean {
	return timeline === 'local' || timeline === 'social';
}

// ============================================================================
// 旗鯖fork: トレンドタイムライン (TTL) 用ヘルパー
// ============================================================================
//
// TTL は basicTimelineTypes には含めない (専用コンポーネント MkTrendingTimeline.vue で
// 描画する設計のため、ohtl/oltl と同じ独立扱い)。
//
// 将来 enableTrendingTimeline の preferences フラグで可否制御するように
// 拡張する場合、この関数を更新するだけで OK。
// ============================================================================

export function isAvailableTrendingTimeline(): boolean {
	// 現状: 常時利用可能。将来 prefer.s.enableTrendingTimeline 等を追加する場合はここで判定
	return true;
}

export function trendingTimelineIconClass(): string {
	return 'ti ti-flame';
}
