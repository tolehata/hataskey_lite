/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'cherrypick-js';
import type { HataFeedCategory, HataFeedEmojiRequest, HataFeedStatus } from '@/utility/hatafeed.js';

export type HataFeedHomeIssue = {
	id: string; number: number; title: string; status: HataFeedStatus; category: HataFeedCategory;
	createdAt: string; createdBy?: Misskey.entities.UserLite | null; assignees?: Misskey.entities.UserLite[];
	pinned?: boolean; closed?: boolean; commentsCount: number; agreementsCount: number;
};
export type HataFeedHomeActivity = {
	key: string; user?: Misskey.entities.UserLite | null; verb: string; label: string; time: string;
	issueId?: string; request?: HataFeedEmojiRequest;
};
