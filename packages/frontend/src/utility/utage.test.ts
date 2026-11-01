/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { applyUtage } from './utage.js';
import type { UtageSnapshot } from './utage.js';

const revival = { startedAt: '2026-09-22T00:00:00Z', expiresAt: '2026-09-22T00:01:30Z', targetCount: 6, reactionCount: 2 };
describe('宴の状態同期', () => {
	test('遅れたRESTとイベントで状態・人数を巻き戻さない', () => {
		const note: UtageSnapshot = { utageStatus: 'reviving', utageRevision: 3, utageRevival: revival };
		expect(applyUtage(note, { utageStatus: 'running', utageRevision: 1, utageRevival: null }, true)).toBe(false);
		expect(applyUtage(note, { utageStatus: 'reviving', utageRevision: 2, utageRevival: { ...revival, reactionCount: 0 } })).toBe(false);
		expect(note.utageRevival?.reactionCount).toBe(2);
		expect(applyUtage(note, { utageStatus: 'succeeded', utageRevision: 4, utageRevival: { ...revival, reactionCount: 6 } })).toBe(true);
		expect(note.utageRevival?.reactionCount).toBe(6);
	});
	test.each(['succeeded', 'failed'] as const)('確定済みの%sを反転させない', status => {
		const note: UtageSnapshot = { utageStatus: status, utageRevision: 4 };
		for (const next of ['running', 'reviving', status === 'failed' ? 'succeeded' : 'failed'] as const) {
			expect(applyUtage(note, { utageStatus: next, utageRevision: 5 })).toBe(false);
		}
	});
	test('本人情報はRESTだけで更新し、公開イベントのフィールド混入を防ぐ', () => {
		const note: UtageSnapshot = { utageStatus: 'reviving', utageRevision: 2, utageMyParticipation: 'eligible' };
		applyUtage(note, { utageStatus: 'reviving', utageRevision: 3, utageMyParticipation: 'accepted' });
		expect(note.utageMyParticipation).toBe('eligible');
		applyUtage(note, { utageStatus: 'reviving', utageRevision: 3, utageMyParticipation: 'accepted', utageServerNow: '2026-09-22T00:00:10Z' }, true);
		expect(note.utageMyParticipation).toBe('accepted');
		expect(note.utageServerNow).toBe('2026-09-22T00:00:10Z');
	});
	test('旧形式の通知を受け取れるが、新形式より古い通知は無視する', () => {
		const note: UtageSnapshot = { utageStatus: 'running' };
		expect(applyUtage(note, { status: 'succeeded' })).toBe(true);
		expect(applyUtage({ utageStatus: 'reviving', utageRevision: 2 }, { status: 'failed' })).toBe(false);
	});
});
