/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type ConcrntVisibility = 'public-observed' | 'restricted' | 'unknown';

export interface ConcrntProfile {
	id: string;
	uri: string;
	name: string;
	avatarUrl?: string;
	bannerUrl?: string;
	description?: string;
	visibility: ConcrntVisibility;
}

export interface ConcrntUserProfile extends ConcrntProfile {
	ccid: string;
}

export interface ConcrntReactionUser {
	ccid: string;
	profile: string;
	name: string;
	avatarUrl?: string;
}

export interface ConcrntReactionUsers {
	shortcode: string;
	users: ConcrntReactionUser[];
}

export interface ConcrntList {
	uri: string;
	name: string;
	timelines: string[];
	/** Community / ActivityPub inbox timelines in this list: the ones that can be posted to. */
	communities: string[];
	pinned: boolean;
	excludeSelf: boolean;
	defaultPostHome: boolean;
	defaultPostTimelines: string[];
	/** world-app pins may name the subprofile to post from. */
	defaultProfile?: string;
}

export interface ConcrntMedia {
	url: string;
	type: string;
	thumbnailUrl?: string;
	alt?: string;
	flag?: string;
	blurhash?: string;
}

export interface ConcrntEmoji {
	shortcode: string;
	imageUrl: string;
}

export interface ConcrntReaction extends ConcrntEmoji {
	count: number;
	ownAssociationUris: string[];
}

export interface ConcrntMessage {
	uri: string;
	key?: string;
	schema: string;
	kind: 'plain' | 'markdown' | 'media' | 'reply' | 'reroute' | 'unsupported';
	author: string;
	authorName: string;
	authorAvatarUrl?: string;
	authorProfile: string;
	createdAt: string;
	body: string;
	emojis: Record<string, { imageURL?: string; animURL?: string }>;
	media: ConcrntMedia[];
	targetUri?: string;
	distributes: string[];
	visibility: ConcrntVisibility;
	reactions: ConcrntReaction[];
	associationCounts: Record<string, number>;
	webUrl: string;
}

export interface ConcrntPage<T> {
	items: T[];
	next: string | null;
	/** Items that could not be fetched are not reported as an empty timeline. */
	unavailable: number;
}

export interface ConcrntNotification {
	uri: string;
	schema: string;
	type: 'reaction' | 'like' | 'reply' | 'reroute' | 'mention' | 'follow' | 'other';
	author: string;
	authorName: string;
	authorAvatarUrl?: string;
	authorProfile: string;
	createdAt: string;
	targetUri?: string;
	messageUri?: string;
	emoji?: ConcrntEmoji;
	/** Plain-text excerpt of the related post; never rendered as markup. */
	preview?: string;
}

export interface ConcrntPostInput {
	profile: string;
	body: string;
	postHome?: boolean;
	destinations?: string[];
	media?: ConcrntMedia[];
	emojis?: Record<string, { imageURL?: string; animURL?: string }>;
	replyTo?: string;
	quoteOf?: string;
	/** public requires fresh anonymous reads; inherit does not promise a public audience. */
	visibility: 'public' | 'inherit';
}

export interface ConcrntWriteStep {
	id: 'record' | 'association' | 'reaction' | 'delete';
	domain: string;
	/** Exact unsigned wire document, including the original createdAt and record key. */
	document: string;
	state: 'prepared' | 'submitting' | 'confirmed' | 'unknown';
	receipt?: { cckv: string; ccfs: string };
}

export interface ConcrntOperation {
	version: 1;
	id: string;
	ccid: string;
	domain: string;
	profile: string;
	createdAt: string;
	type: 'post' | 'reply' | 'quote' | 'reaction' | 'delete-reaction';
	status: 'prepared' | 'complete' | 'partial' | 'unknown' | 'cancelled' | 'failed';
	steps: ConcrntWriteStep[];
	/** Absent on records from before world-app destinations: those were strict public posts. */
	visibility?: 'public' | 'inherit';
	error?: string;
}

export interface ConcrntPublishResult {
	status: ConcrntOperation['status'];
	operation: ConcrntOperation;
	messageUri?: string;
	associationUri?: string;
	error?: string;
}

export interface ConcrntUploadOptions {
	profile: string;
	replyTo?: string;
	postHome?: boolean;
	destinations?: string[];
	visibility: 'public' | 'inherit';
	signal?: AbortSignal;
}

export interface ConcrntEmojiPackage {
	url: string;
	name: string;
	iconUrl?: string;
	emojis: ConcrntEmoji[];
}

export interface ConcrntTimelineInfo {
	uri: string;
	name: string;
	iconUrl?: string;
	/** A read policy limits who sees posts here (鍵). */
	restricted: boolean;
}
