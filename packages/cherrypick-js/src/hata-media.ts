/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: MIT
 */

import type { UserLite } from './autogen/models.js';

export type HatadyMediaWorkKind = 'movie' | 'game';
export type HatadyMediaWorkStatus = 'planned' | 'in_progress' | 'completed' | 'mastered' | 'on_hold' | 'dropped';
export type HatadyMediaVisibility = 'private' | 'followers' | 'public';
export type HatadyMovieOrigin = 'domestic' | 'foreign' | 'co_production' | 'other';
export type HatadyMovieViewingMode = 'dubbed' | 'subtitled' | 'original';
export type HatadyMediaSessionKind = 'movie_viewing' | 'game_play' | 'game_match' | 'game_roguelike' | 'game_pve';

export type HatadyMediaReactionSummary = { reaction: string; count: number };

export type HatadyMediaWork = {
	id: string;
	createdAt: string;
	updatedAt: string;
	userId: string;
	kind: HatadyMediaWorkKind;
	title: string;
	originalTitle: string | null;
	creator: string | null;
	releaseDate: string | null;
	releaseYear: number | null;
	status: HatadyMediaWorkStatus;
	visibility: HatadyMediaVisibility;
	isFavorite: boolean;
	/** Movie-only recommendation flag. Always false for games. */
	isRecommended: boolean;
	/** Movie-only 0..10 integer in half-star units; display value is recommendationRating / 2. Always null for games. */
	recommendationRating: number | null;
	coverColorIndex: number | null;
	synopsis: string | null;
	synopsisSpoiler: boolean;
	review: string | null;
	reviewSpoiler: boolean;
	officialUrl: string | null;
	runtimeMinutes: number | null;
	genres: string[];
	origin: HatadyMovieOrigin | null;
	viewingMode: HatadyMovieViewingMode | null;
	primaryLanguage: string | null;
	highlights: string[];
	highlightsSpoiler: boolean;
	platforms: string[];
	developer: string | null;
	publisher: string | null;
};

export type HatadyMediaWorkDetail = HatadyMediaWork & {
	isMine: boolean;
	reactions: HatadyMediaReactionSummary[];
	myReaction: string | null;
	commentsCount: number;
};

export type HatadyMediaWorkInput = Partial<Omit<HatadyMediaWork, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'kind'>> & { title?: string };

export type HatadyMediaWorkListRequest = {
	userId?: string;
	kind?: HatadyMediaWorkKind;
	status?: HatadyMediaWorkStatus;
	origin?: HatadyMovieOrigin;
	viewingMode?: HatadyMovieViewingMode;
	isRecommended?: boolean;
	minRecommendation?: number;
	sessionKind?: HatadyMediaSessionKind;
	result?: string;
	weapon?: string;
	rank?: string;
	route?: string;
	since?: string;
	until?: string;
	sort?: 'createdAt' | 'updatedAt' | 'title' | 'releaseDate' | 'releaseYear' | 'status' | 'recommendationRating';
	order?: 'asc' | 'desc';
	query?: string;
	untilId?: string;
	limit?: number;
};

export type HatadyMediaSession = {
	id: string;
	createdAt: string;
	updatedAt: string;
	userId: string;
	workId: string;
	kind: HatadyMediaSessionKind;
	occurredAt: string;
	durationMinutes: number | null;
	note: string | null;
	noteSpoiler: boolean;
	visibility: HatadyMediaVisibility;
	details: Record<string, unknown>;
};

export type HatadyMediaSessionInput = {
	occurredAt?: string;
	durationMinutes?: number | null;
	note?: string | null;
	noteSpoiler?: boolean;
	visibility?: HatadyMediaVisibility;
	details?: Record<string, unknown>;
};

export type HatadyMediaComment = {
	id: string;
	createdAt: string;
	updatedAt: string;
	workId: string;
	userId: string;
	user: UserLite | null;
	replyId: string | null;
	text: string;
	spoiler: boolean;
	reactionsCount: number;
	reactions: HatadyMediaReactionSummary[];
	myReaction: string | null;
};

export type HatadyNotification = {
	id: string;
	createdAt: string;
	type: string;
	isRead: boolean;
	user: UserLite | null;
	logId: string | null;
	logTitle: string | null;
	commentId: string | null;
	commentText: string | null;
	/** Null when the work was deleted or is no longer visible to the recipient. */
	mediaWorkId: string | null;
	mediaTitle: string | null;
	mediaKind: HatadyMediaWorkKind | null;
	/** Null when the comment was deleted or its work is no longer visible. */
	mediaCommentId: string | null;
	/** Always null for spoiler comments until the UI explicitly opens the work. */
	mediaCommentText: string | null;
	mediaCommentSpoiler: boolean | null;
	reaction: string | null;
	value: number | null;
	isFollowingBack: boolean;
};
