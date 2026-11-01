/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';

export type NoteActionConfirmation = {
	kind: 'delete' | 'deleteAndEdit' | 'unrenote';
	note: Misskey.entities.Note;
	/** Existing note action, invoked only by an explicit confirmation. Errors must propagate. */
	run: () => Promise<void>;
};

type ConfirmationHandler = (request: NoteActionConfirmation) => boolean;
let handler: ConfirmationHandler | undefined;

/** The active UI may host note confirmations. Other dialogs are deliberately unaffected. */
export function registerNoteActionConfirmation(next: ConfirmationHandler): () => void {
	handler = next;
	return () => { if (handler === next) handler = undefined; };
}

/** True means the UI owns this request, including cancellation; false uses the existing dialog. */
export function requestNoteActionConfirmation(request: NoteActionConfirmation): boolean {
	return handler?.(request) ?? false;
}
