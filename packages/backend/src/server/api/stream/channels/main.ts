/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { isInstanceMuted, isUserFromMutedInstance } from '@/misc/is-instance-muted.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { Packed } from '@/misc/json-schema.js';
import type { JsonObject } from '@/misc/json-value.js';
import type { EventTypesToEventPayload, MainEventTypes } from '@/core/GlobalEventService.js';
import Channel, { type MiChannelService } from '../channel.js';

// Native Registry and sign-in events have no third-party API equivalent.
// Keep this exhaustive so new events require an explicit authorization decision.
const eventPermissions = {
	notification: 'read:notifications',
	mention: 'read:notifications',
	reply: 'read:notifications',
	renote: 'read:notifications',
	follow: 'read:following',
	followed: 'read:following',
	unfollow: 'read:following',
	meUpdated: 'read:account',
	pageEvent: 'read:pages',
	urlUploadFinished: 'read:drive',
	readAllNotifications: 'read:notifications',
	readNotification: 'read:notifications',
	notificationChanged: 'read:notifications',
	notificationFlushed: 'read:notifications',
	unreadNotification: 'read:notifications',
	unreadAntenna: 'read:account',
	newChatMessage: 'read:chat',
	readAllAnnouncements: 'read:account',
	myTokenRegenerated: null,
	signin: null,
	registryUpdated: null,
	driveFileCreated: 'read:drive',
	readAntenna: 'read:account',
	receiveFollowRequest: 'read:following',
	announcementCreated: 'read:account',
	mutingImportCompleted: 'read:mutes',
} satisfies Record<keyof MainEventTypes, string | null>;

class MainChannel extends Channel {
	public readonly chName = 'main';
	public static shouldShare = true;
	public static requireCredential = true as const;
	public static kind = 'read:account';

	constructor(
		private noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
	}

	@bindThis
	public async init(params: JsonObject) {
		// Subscribe main stream channel
		this.subscriber.on(`mainStream:${this.user!.id}`, this.onData);
	}

	private async packVisibleNote(noteId: string): Promise<Packed<'Note'> | null> {
		try {
			return await this.noteEntityService.pack(noteId, this.user, { detail: true });
		} catch (error) {
			if (error instanceof PrivateChannelNoteVisibilityError || error instanceof EntityNotFoundError) return null;
			throw error;
		}
	}

	private async filterNotification(notification: Packed<'Notification'>, viewerId: string): Promise<Packed<'Notification'> | null> {
		if ('note' in notification && notification.note != null) {
			if (!await this.noteEntityService.isChannelVisibleForMe(notification.note, viewerId)) return null;
			if (notification.note.isHidden) {
				const note = await this.packVisibleNote(notification.note.id);
				if (note == null) return null;
				return { ...notification, note };
			}
		} else if (notification.type === 'reaction:groupedByUser') {
			const notes = await this.noteEntityService.filterChannelVisibleNotes(notification.reactions.map((reaction: { note: Packed<'Note'> }) => reaction.note), viewerId);
			const visibleIds = new Set(notes.map(note => note.id));
			const reactions = notification.reactions.filter((reaction: { note: Packed<'Note'> }) => visibleIds.has(reaction.note.id));
			if (reactions.length === 0) return null;
			return { ...notification, reactions };
		} else if (notification.type === 'note:grouped') {
			const notes = (await Promise.all(notification.noteIds.map((id: string) => this.packVisibleNote(id)))).filter(note => note != null);
			if (notes.length === 0) return null;
			const visibleAuthors = new Set(notes.map(note => note.userId));
			const users = notification.users.filter((user: Packed<'UserLite'>) => visibleAuthors.has(user.id));
			if (users.length === 0) return null;
			return { ...notification, noteIds: notes.map(note => note.id), users };
		}
		return notification;
	}

	@bindThis
	private async onData(data: EventTypesToEventPayload<MainEventTypes>) {
		const viewer = this.user;
		if (viewer == null) return;
		// Unknown events fail closed for scoped tokens, including Play tokens.
		const permission = Object.hasOwn(eventPermissions, data.type) ? eventPermissions[data.type] : null;
		if (!this.connection.hasPermission(permission)) return;
		switch (data.type) {
			case 'notification':
			case 'unreadNotification': {
				// Ignore notifications from instances the user has muted
				if (isUserFromMutedInstance(data.body, this.userMutedInstances)) return;
				if (data.body.userId && this.userIdsWhoMeMuting.has(data.body.userId)) return;

				const notification = await this.filterNotification(data.body, viewer.id);
				if (notification != null) this.send(data.type, notification);
				return;
			}
			case 'mention':
			case 'reply':
			case 'renote': {
				if (isInstanceMuted(data.body, new Set<string>(this.userProfile?.mutedInstances ?? []))) return;

				if (this.userIdsWhoMeMuting.has(data.body.userId)) return;
				if (!await this.noteEntityService.isChannelVisibleForMe(data.body, viewer.id)) return;
				const note = data.type === 'mention' && data.body.isHidden ? await this.packVisibleNote(data.body.id) : data.body;
				if (note != null) this.send(data.type, note);
				return;
			}
		}

		this.send(data.type, data.body);
	}

	@bindThis
	public dispose() {
		this.subscriber.off(`mainStream:${this.user?.id}`, this.onData);
	}
}

@Injectable()
export class MainChannelService implements MiChannelService<true> {
	public readonly shouldShare = MainChannel.shouldShare;
	public readonly requireCredential = MainChannel.requireCredential;
	public readonly kind = MainChannel.kind;

	constructor(
		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): MainChannel {
		return new MainChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
