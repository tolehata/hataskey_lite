/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';

type Visibility = 'public' | 'home' | 'followers' | 'specified';
type Channel = { id: string; name: string; isPrivate?: boolean };
export type Hk3ComposerDraft = {
	schemaVersion: 1;
	draftText: string;
	draftFiles: Misskey.entities.DriveFile[];
	cwEnabled: boolean;
	cwText: string;
	pollEnabled: boolean;
	pollChoices: string[];
	pollMultiple: boolean;
	pollExpiresAt: number | null;
	pollExpiredAfterUnit: 'original' | 'infinite' | 'hour' | 'day' | 'week';
	event: Record<string, unknown> | null;
	reactionAcceptance: Misskey.entities.Note['reactionAcceptance'];
	visibility: Visibility;
	localOnly: boolean;
	visibleUsers: Misskey.entities.UserLite[];
	context: { kind: 'reply' | 'quote' | 'channel'; note?: Misskey.entities.Note; channel: Channel | null } | null;
	editingNote: Misskey.entities.Note | null;
};

const record = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value);
const identified = (value: unknown): boolean => record(value) && typeof value.id === 'string';
const user = (value: unknown): boolean => identified(value) && record(value) && typeof value.username === 'string';
const file = (value: unknown): boolean => identified(value) && record(value)
	&& ['name', 'type', 'url'].every(key => typeof value[key] === 'string')
	&& (value.thumbnailUrl === null || typeof value.thumbnailUrl === 'string')
	&& typeof value.isSensitive === 'boolean';
const note = (value: unknown): boolean => identified(value) && record(value) && user(value.user);
const channel = (value: unknown): boolean => record(value) && identified(value) && typeof value.name === 'string' && (value.isPrivate == null || typeof value.isPrivate === 'boolean');

/** Validate the complete snapshot before applying any fields, including reply/edit targets. */
export function parseHk3ComposerDraft(value: unknown): Hk3ComposerDraft {
	if (!record(value) || value.schemaVersion !== 1
		|| !['draftText', 'cwText'].every(key => typeof value[key] === 'string')
		|| !['cwEnabled', 'pollEnabled', 'pollMultiple', 'localOnly'].every(key => typeof value[key] === 'boolean')
		|| !Array.isArray(value.draftFiles) || value.draftFiles.length > 16 || !value.draftFiles.every(file)
		|| !Array.isArray(value.pollChoices) || value.pollChoices.length < 2 || value.pollChoices.length > 10 || !value.pollChoices.every(choice => typeof choice === 'string')
		|| !(value.pollExpiresAt === null || typeof value.pollExpiresAt === 'number' && Number.isFinite(value.pollExpiresAt))
		|| !['original', 'infinite', 'hour', 'day', 'week'].includes(value.pollExpiredAfterUnit as string)
		|| !(value.event === null || record(value.event))
		|| ![null, 'likeOnly', 'likeOnlyForRemote', 'nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote'].includes(value.reactionAcceptance as string | null)
		|| !['public', 'home', 'followers', 'specified'].includes(value.visibility as string)
		|| !Array.isArray(value.visibleUsers) || !value.visibleUsers.every(user)
		|| !(value.editingNote === null || note(value.editingNote))) throw new Error('Invalid UI S composer draft');
	const ctx = value.context;
	if (!(ctx === null || record(ctx)
		&& ['reply', 'quote', 'channel'].includes(ctx.kind as string)
		&& (ctx.channel === null || channel(ctx.channel))
		&& (ctx.kind === 'channel' ? channel(ctx.channel) : note(ctx.note)))) throw new Error('Invalid UI S composer context');
	return JSON.parse(JSON.stringify(value)) as Hk3ComposerDraft;
}

export function isMeaningfulHk3ComposerDraft(data: Hk3ComposerDraft): boolean {
	return Boolean(data.draftText.trim() || data.draftFiles.length || data.cwEnabled || data.cwText
		|| data.pollEnabled || data.pollChoices.some(choice => choice !== '') || data.pollMultiple
		|| data.pollExpiredAfterUnit !== 'infinite' || data.pollExpiresAt !== null || data.event
		|| data.reactionAcceptance || data.context || data.editingNote || data.visibleUsers.length
		|| data.visibility !== 'public' || data.localOnly);
}
