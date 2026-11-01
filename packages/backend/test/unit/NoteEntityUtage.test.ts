/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { MiUtageSession } from '@/models/UtageSession.js';

function fixture() {
	const session = { status: 'reviving', revision: 3, expiresAt: new Date(), userId: 'author', revivalStartedAt: new Date(), revivalExpiresAt: new Date(), revivalTargetCount: 6, revivalOnlineCount: 30, revivalExcludedUserIds: ['blocker'], revivalSupporterIds: ['helper'], successMethod: null } as MiUtageSession;
	const sessions = { findOneBy: vi.fn().mockResolvedValue(session) };
	const users = { findOneBy: vi.fn().mockImplementation(async ({ id }: { id: string }) => ({ id, host: id === 'remote' ? 'elsewhere.example' : null, isBot: id === 'bot', isSuspended: id === 'suspended', isDeleted: id === 'deleted' })) };
	const service = Object.assign(Object.create(NoteEntityService.prototype), { utageSessionsRepository: sessions, usersRepository: users });
	const note = { id: 'note', text: '宴', cw: null, userHost: null };
	return { service, note, session, sessions, users };
}

describe('宴の本人向けAPI情報', () => {
	test.each([['author', 'author'], ['helper', 'accepted'], ['blocker', 'existing'], ['new', 'eligible'], ['remote', 'ineligible'], ['bot', 'ineligible'], ['suspended', 'ineligible'], ['deleted', 'ineligible']])('%sには本人の%sだけを返す', async (viewer, expected) => {
		const f = fixture(); const packed = await f.service.populateUtage(f.note, viewer);
		expect(packed.utageMyParticipation).toBe(expected);
		expect(packed.utageRevival).toMatchObject({ reactionCount: 1, targetCount: 6 });
		expect(Object.keys(packed)).not.toContain('revivalSupporterIds');
		expect(Object.keys(packed)).not.toContain('revivalExcludedUserIds');
		expect(Object.keys(packed)).not.toContain('revivalOnlineCount');
	});
	test('未認証packと共有配信用packに本人情報を入れない', async () => {
		const f = fixture(); const packed = await f.service.populateUtage(f.note, null);
		expect(Object.hasOwn(packed, 'utageMyParticipation')).toBe(false);
		expect(f.users.findOneBy).not.toHaveBeenCalled();
	});
	test('packManyの同一スナップショットを再利用し、ノート毎のDB再取得を避ける', async () => {
		const f = fixture();
		const packed = await f.service.populateUtage(f.note, 'helper', { utageSessionMap: new Map([['note', f.session]]), utageViewer: { id: 'helper', host: null } });
		expect(packed.utageMyParticipation).toBe('accepted');
		expect(f.sessions.findOneBy).not.toHaveBeenCalled(); expect(f.users.findOneBy).not.toHaveBeenCalled();
	});
});
