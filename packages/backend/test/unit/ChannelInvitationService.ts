/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { ChannelService } from '@/core/ChannelService.js';
import type { MiChannelInvitation } from '@/models/ChannelInvitation.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- リポジトリの必要最小限の振る舞いだけを再現するテスト用スタブ。 */

function createSubject(initialInvitation?: MiChannelInvitation) {
	const members = new Set<string>();
	const invitations = new Map<string, MiChannelInvitation>();
	if (initialInvitation) invitations.set(initialInvitation.id, initialInvitation);

	const memberRepository = {
		exists: async ({ where }: any) => members.has(`${where.channelId}:${where.userId}`),
		insert: async (value: any) => { members.add(`${value.channelId}:${value.userId}`); },
		delete: async ({ channelId, userId }: any) => { members.delete(`${channelId}:${userId}`); },
	};
	const invitationRepository = {
		findOneBy: async (where: any) => [...invitations.values()].find(invitation => Object.entries(where).every(([key, value]) => (invitation as any)[key] === value)) ?? null,
		update: async (id: string, value: Partial<MiChannelInvitation>) => {
			const current = invitations.get(id);
			if (current) invitations.set(id, { ...current, ...value });
		},
		insertOne: async (value: MiChannelInvitation) => {
			const invitation = { ...value, channel: null, user: null, invitedBy: null } as MiChannelInvitation;
			invitations.set(invitation.id, invitation);
			return invitation;
		},
		delete: async (criteria: string | Partial<MiChannelInvitation>) => {
			if (typeof criteria === 'string') {
				return { affected: invitations.delete(criteria) ? 1 : 0 };
			}
			const target = [...invitations.values()].find(candidate => Object.entries(criteria).every(([key, value]) => (candidate as any)[key] === value));
			if (target == null) return { affected: 0 };
			invitations.delete(target.id);
			return { affected: 1 };
		},
	};
	const subject = new ChannelService(
		{} as any,
		memberRepository as any,
		invitationRepository as any,
		{ gen: () => 'generated-invitation' } as any,
		{ isModerator: async () => false } as any,
	);
	return { subject, members, invitations };
}

function invitation(status: 'pending' | 'rejected' = 'pending'): MiChannelInvitation {
	return {
		id: 'invitation',
		createdAt: new Date('2026-08-06T00:00:00Z'),
		respondedAt: status === 'rejected' ? new Date('2026-08-06T01:00:00Z') : null,
		channelId: 'channel',
		channel: null,
		userId: 'invitee',
		user: null,
		invitedById: 'manager',
		invitedBy: null,
		status,
	};
}

describe('ChannelService private channel invitations', () => {
	test('招待された本人が承認した時だけメンバーになる', async () => {
		const { subject, members, invitations } = createSubject(invitation());
		expect(await subject.acceptInvitation('invitation', 'someone-else')).toBeNull();
		expect(members.size).toBe(0);

		expect((await subject.acceptInvitation('invitation', 'invitee'))?.channelId).toBe('channel');
		expect(members.has('channel:invitee')).toBe(true);
		expect(invitations.has('invitation')).toBe(false);
	});

	test('同じ招待を同時に承認しても一方だけがメンバー追加へ進む', async () => {
		const { subject, members, invitations } = createSubject(invitation());
		const results = await Promise.all([
			subject.acceptInvitation('invitation', 'invitee'),
			subject.acceptInvitation('invitation', 'invitee'),
		]);

		expect(results.filter(result => result != null)).toHaveLength(1);
		expect(members).toEqual(new Set(['channel:invitee']));
		expect(invitations.has('invitation')).toBe(false);
	});

	test('本人の拒否はメンバー化せず招待拒否として残る', async () => {
		const { subject, members, invitations } = createSubject(invitation());
		expect(await subject.rejectInvitation('invitation', 'someone-else')).toBeNull();
		expect((await subject.rejectInvitation('invitation', 'invitee'))?.status).toBe('rejected');
		expect(members.size).toBe(0);
		expect(invitations.get('invitation')?.status).toBe('rejected');
		expect(invitations.get('invitation')?.respondedAt).toBeInstanceOf(Date);
	});

	test('拒否済みの相手を再招待すると招待中へ戻し、重複した招待中通知は作らない', async () => {
		const { subject, invitations } = createSubject(invitation('rejected'));
		const reopened = await subject.inviteMember('channel', 'invitee', 'new-manager');
		expect(reopened.shouldNotify).toBe(true);
		expect(reopened.invitation.id).toBe('generated-invitation');
		expect(invitations.has('invitation')).toBe(false);
		expect(invitations.get('generated-invitation')).toMatchObject({ status: 'pending', respondedAt: null, invitedById: 'new-manager' });

		const duplicate = await subject.inviteMember('channel', 'invitee', 'new-manager');
		expect(duplicate.shouldNotify).toBe(false);
	});
});
