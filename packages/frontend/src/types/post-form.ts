/*
 * SPDX-FileCopyrightText: base: syuilo and misskey-project modifier: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import type { PollEditorModelValue } from '@/components/MkPollEditor.vue';

export interface ExternalNote {
	id: string;
	text: string | null;
	cw: string | null;
	user: {
		id: string;
		username: string;
		host: string | null;
		name: string | null;
		avatarUrl: string | null;
	};
	createdAt: string;
	files?: any[];
	replyId?: string | null;
	renoteId?: string | null;
}

export interface PostFormProps {
	reply?: Misskey.entities.Note | null;
	renote?: Misskey.entities.Note | null;
	channel?: {
		id: string;
		name: string;
		color: string;
		isSensitive: boolean;
		allowRenoteToExternal: boolean;
		userId: string | null;
	} | null;
	mention?: Misskey.entities.User;
	specified?: Misskey.entities.UserDetailed;
	initialText?: string;
	initialCw?: string;
	initialVisibility?: (typeof Misskey.noteVisibilities)[number];
	initialFiles?: Misskey.entities.DriveFile[];
	initialPoll?: PollEditorModelValue | null;
	initialEvent?: Misskey.entities.Note['event'];
	initialReactionAcceptance?: Misskey.entities.Note['reactionAcceptance'];
	/** false prevents an unrelated saved draft from replacing explicit inputs. */
	restoreDraft?: boolean;
	initialLocalOnly?: boolean;
	initialVisibleUsers?: Misskey.entities.UserDetailed[];
	initialNote?: Misskey.entities.Note;
	instant?: boolean;
	updateMode?: boolean;
	// 外部サーバーへの投稿用
	externalReply?: ExternalNote | null;
	externalRenote?: ExternalNote | null;
	initialUseExternalAccount?: boolean;
}
