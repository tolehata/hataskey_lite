/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import {
	isExternalPureRenote,
	MAX_EXTERNAL_PURE_RENOTE_DEPTH,
	rebuildExternalNotePath,
	resolveExternalNotePresentation,
} from './external-note-presentation.js';

type TestNote = Record<string, any>;

function note(id: string, overrides: Partial<TestNote> = {}): TestNote {
	return {
		id,
		text: `note-${id}`,
		cw: null,
		replyId: null,
		renoteId: null,
		fileIds: [],
		files: [],
		poll: null,
		event: null,
		renote: null,
		...overrides,
	};
}

function pureRenote(id: string, renote: TestNote): TestNote {
	return note(id, {
		text: null,
		renoteId: renote.id,
		renote,
	});
}

function quote(id: string, renote: TestNote): TestNote {
	return note(id, {
		text: `quote-${id}`,
		renoteId: renote.id,
		renote,
	});
}

describe('external note presentation', () => {
	test('純リノート判定が本文・添付付きの引用を除外する', () => {
		const original = note('original');
		expect(isExternalPureRenote(pureRenote('pure', original))).toBe(true);
		expect(isExternalPureRenote(quote('quote', original))).toBe(false);
		expect(isExternalPureRenote([])).toBe(false);
		expect(isExternalPureRenote(note('attached', {
			text: null,
			renoteId: original.id,
			renote: original,
			files: [{ id: 'file' }],
		}))).toBe(false);
	});

	test('多段の純リノートは元ノートまで展開し、入力は変更しない', () => {
		const original = note('original');
		const middle = pureRenote('middle', original);
		const outer = pureRenote('outer', middle);

		const presentation = resolveExternalNotePresentation(outer);
		expect(presentation).toMatchObject({
			isPureRenote: true,
			appearNote: original,
			quotedNote: null,
			resolution: 'resolved',
			path: [outer, middle, original],
		});
		expect(outer.renote).toBe(middle);
	});

	test('末端の更新後も中間ノートとrenoteIdを保ったまま経路を組み直す', () => {
		const original = note('original');
		const middle = pureRenote('middle', original);
		const outer = pureRenote('outer', middle);
		const path = resolveExternalNotePresentation(outer).path;
		const updated = { ...original, myReaction: ':done:' };

		const rebuilt = rebuildExternalNotePath(path, updated);
		expect(rebuilt).not.toBe(outer);
		expect(rebuilt.renoteId).toBe(middle.id);
		expect(rebuilt.renote).not.toBe(middle);
		expect(rebuilt.renote.renoteId).toBe(original.id);
		expect(rebuilt.renote.renote).toBe(updated);
		expect(outer.renote).toBe(middle);
		expect(middle.renote).toBe(original);
	});

	test('純リノートの先が引用なら引用で止まり、引用先を一度だけ残す', () => {
		const original = note('original');
		const quoted = quote('quote', original);
		const middle = pureRenote('middle', quoted);
		const outer = pureRenote('outer', middle);

		expect(resolveExternalNotePresentation(outer)).toMatchObject({
			isPureRenote: true,
			appearNote: quoted,
			quotedNote: original,
			resolution: 'resolved',
			path: [outer, middle, quoted],
		});
	});

	test('直接の引用は本文を本体、引用先を埋め込み対象として保持する', () => {
		const original = note('original');
		const quoted = quote('quote', original);

		expect(resolveExternalNotePresentation(quoted)).toMatchObject({
			isPureRenote: false,
			appearNote: quoted,
			quotedNote: original,
			resolution: 'resolved',
		});
	});

	test('返信は再帰対象にしない', () => {
		const reply = note('reply', {
			replyId: 'parent',
			reply: note('parent'),
		});

		expect(resolveExternalNotePresentation(reply)).toMatchObject({
			isPureRenote: false,
			appearNote: reply,
			quotedNote: null,
			resolution: 'resolved',
		});
	});

	test('循環する純リノートは検出し、子ノートを再帰表示しない', () => {
		const first = note('first', { text: null, renoteId: 'second' });
		const second = note('second', { text: null, renoteId: 'first' });
		first.renote = second;
		second.renote = first;

		expect(resolveExternalNotePresentation(first)).toMatchObject({
			isPureRenote: true,
			appearNote: second,
			quotedNote: null,
			resolution: 'cycle',
			path: [first, second],
		});
	});

	test('異なるオブジェクトでも同じIDが再登場したら循環として止める', () => {
		const original = note('original');
		const repeated = pureRenote('repeated', original);
		const outer = pureRenote('repeated', repeated);

		expect(resolveExternalNotePresentation(outer)).toMatchObject({
			isPureRenote: true,
			appearNote: outer,
			quotedNote: null,
			resolution: 'cycle',
		});
	});

	test('上限ちょうどの純リノート連鎖は元ノートまで解決する', () => {
		const original = note('original');
		let chain = original;
		for (let i = MAX_EXTERNAL_PURE_RENOTE_DEPTH - 1; i >= 0; i--) {
			chain = pureRenote(`renote-${i}`, chain);
		}

		expect(resolveExternalNotePresentation(chain)).toMatchObject({
			appearNote: original,
			quotedNote: null,
			resolution: 'resolved',
		});
	});

	test('深すぎる純リノートは上限で止め、子ノートを再帰表示しない', () => {
		let chain = note('original');
		for (let i = MAX_EXTERNAL_PURE_RENOTE_DEPTH; i >= 0; i--) {
			chain = pureRenote(`renote-${i}`, chain);
		}

		const presentation = resolveExternalNotePresentation(chain);
		expect(presentation.resolution).toBe('depth-limit');
		expect(presentation.quotedNote).toBeNull();
		expect(presentation.path).toHaveLength(MAX_EXTERNAL_PURE_RENOTE_DEPTH + 1);
	});
});
