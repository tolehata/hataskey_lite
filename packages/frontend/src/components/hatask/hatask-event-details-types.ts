/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskEventRsvpStatus = 'going' | 'maybe' | 'declined';

export type HataskEventDetails = {
	id: string;
	title: string;
	emoji?: string;
	color?: string;
	dateLabel: string;
	timeLabel: string;
	visibilityLabel: string;
	isPublic: boolean;
	ownerLabel?: string;
	recurrenceLabel?: string;
	recurrenceHint?: string;
	notificationLabel?: string;
	syncLabel?: string;
	canEdit: boolean;
	isOwner: boolean;
	rsvp?: {
		closed: boolean;
		myStatus: HataskEventRsvpStatus | null;
		responses: { userId: string; username: string; status: HataskEventRsvpStatus }[];
	} | null;
};

export type HataskEventDetailsLabels = {
	details: string;
	'close': string;
	dateAndTime: string;
	visibility: string;
	organizer: string;
	recurrence: string;
	notificationTiming: string;
	readOnly: string;
	rsvpDashboard: string;
	rsvp: string;
	closed: string;
	accepting: string;
	rsvpParticipation: string;
	rsvpGoing: string;
	rsvpMaybe: string;
	rsvpDeclined: string;
	total: string;
	noResponses: string;
	closeRsvp: string;
	publicEventWithoutRsvp: string;
	edit: string;
	delete: string;
};
