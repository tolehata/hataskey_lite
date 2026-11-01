/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const read = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, 'utf8');

describe('ミュートリアクション表示の安定化', () => {
	test('表示元とキャッシュ鍵を同じreactiveデータから作り、取得待ちにrawを描画しない', () => {
		const viewer = read('components/MkReactionsViewer.vue');

		expect(viewer).toContain('const reactionCount = Object.values(newSource).reduce');
		expect(viewer).not.toContain('const reactionCount = props.note?.reactionCount');
		expect(viewer).toContain('if (entry == null) {');
		expect(viewer).toContain('if (justEnabled) {');
		expect(viewer).toContain('mutedUsersRevision,');
	});

	test('リアルタイム取得はraw件数を保持し、表示層だけでミュート分を隠す', () => {
		const capture = read('composables/use-note-capture.ts');
		const boot = read('boot/main-boot.ts');

		expect(capture).not.toContain('if (prefer.s.hideMutedUserReactions && isMutedUser(ctx.userId)) return;');
		expect(boot).toContain('if (hideMutedReactionsLocal.value)');
		expect(boot).not.toContain('if (prefer.s.hideMutedUserReactions)');
	});

	test('polling更新も種別ごとの変化を検出して同数cacheを破棄する', () => {
		const capture = read('composables/use-note-capture.ts');

		expect(capture).toContain('const sourceChanged = reactionCountsChanged($note.reactions, data.reactions);');
		expect(capture).toContain('sourceChanged || shouldRevalidateMutedReactionActors(note.id)');
	});

	test('非同期ミュート取込の完了イベントをbackendからmain streamへ流す', () => {
		const processor = readFileSync(`${process.cwd()}/../backend/src/queue/processors/ImportMutingProcessorService.ts`, 'utf8');
		const boot = read('boot/main-boot.ts');

		expect(processor).toContain('publishMainStream(user.id, \'mutingImportCompleted\')');
		expect(boot).toContain('main.on(\'mutingImportCompleted\'');
		expect(boot).toContain('refreshMutedUsers();');
	});

	test('最新鍵と世代が一致する応答だけを採用する', () => {
		const cache = read('utility/muted-reactions.ts');
		const capture = read('composables/use-note-capture.ts');

		expect(cache).toContain('latestKeyByNote.get(noteId) === key');
		expect(cache).toContain('requestGeneration === generation');
		expect(cache).toContain('mutedUsersRevision.value');
		expect(cache).toContain('export function notifyMutedReactionSourceChanged(noteId: string)');
		expect(capture).toContain('notifyMutedReactionSourceChanged(note.id);');
	});
});
