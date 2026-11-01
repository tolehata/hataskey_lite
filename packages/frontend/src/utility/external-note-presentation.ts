/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';

export const MAX_EXTERNAL_PURE_RENOTE_DEPTH = 32;

type ExternalNote = Record<string, any>;

export type ExternalNoteResolution = 'resolved' | 'cycle' | 'depth-limit';

export type ExternalNotePresentation = {
	isPureRenote: boolean;
	appearNote: ExternalNote;
	quotedNote: ExternalNote | null;
	resolution: ExternalNoteResolution;
	path: ExternalNote[];
};

function isExternalNote(value: unknown): value is ExternalNote {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

function getExternalNoteId(note: ExternalNote): string | null {
	return typeof note.id === 'string' && note.id.length > 0 ? note.id : null;
}

export function isExternalPureRenote(note: unknown): note is ExternalNote & { renote: ExternalNote } {
	return isExternalNote(note)
		&& isExternalNote(note.renote)
		&& Misskey.note.isPureRenote(note as Misskey.entities.Note)
		&& (!Array.isArray(note.files) || note.files.length === 0);
}

/**
 * 外部サーバー由来の純リノートだけを展開し、本文等を持つ引用で止める。
 * 循環または過剰な深さを検出した場合は、子ノートを再帰描画しない。
 */
export function resolveExternalNotePresentation(note: ExternalNote): ExternalNotePresentation {
	const outerIsPureRenote = isExternalPureRenote(note);
	if (!outerIsPureRenote) {
		return {
			isPureRenote: false,
			appearNote: note,
			quotedNote: isExternalNote(note?.renote) ? note.renote : null,
			resolution: 'resolved',
			path: [note],
		};
	}

	const seenNotes = new Set<ExternalNote>();
	const seenIds = new Set<string>();
	let current: ExternalNote = note;
	let depth = 0;
	const path: ExternalNote[] = [note];

	while (isExternalPureRenote(current)) {
		if (depth >= MAX_EXTERNAL_PURE_RENOTE_DEPTH) {
			return {
				isPureRenote: true,
				appearNote: current,
				quotedNote: null,
				resolution: 'depth-limit',
				path,
			};
		}

		const currentId = getExternalNoteId(current);
		if (seenNotes.has(current) || (currentId != null && seenIds.has(currentId))) {
			return {
				isPureRenote: true,
				appearNote: current,
				quotedNote: null,
				resolution: 'cycle',
				path,
			};
		}

		seenNotes.add(current);
		if (currentId != null) seenIds.add(currentId);

		const next = current.renote;
		const nextId = getExternalNoteId(next);
		if (seenNotes.has(next) || (nextId != null && seenIds.has(nextId))) {
			return {
				isPureRenote: true,
				appearNote: current,
				quotedNote: null,
				resolution: 'cycle',
				path,
			};
		}

		current = next;
		path.push(current);
		depth++;
	}

	return {
		isPureRenote: true,
		appearNote: current,
		quotedNote: isExternalNote(current.renote) ? current.renote : null,
		resolution: 'resolved',
		path,
	};
}

/** 表示末端を更新したあと、保持していた純リノート経路を入力を変えずに組み直す。 */
export function rebuildExternalNotePath(path: ExternalNote[], target: ExternalNote): ExternalNote {
	let rebuilt = target;
	for (let i = path.length - 2; i >= 0; i--) {
		rebuilt = { ...path[i], renote: rebuilt };
	}
	return rebuilt;
}
