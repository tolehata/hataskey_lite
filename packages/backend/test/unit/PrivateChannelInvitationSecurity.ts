/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { meta as addMemberMeta } from '@/server/api/endpoints/channels/add-member.js';
import { meta as invitationsMeta } from '@/server/api/endpoints/channels/invitations.js';
import { meta as acceptMeta } from '@/server/api/endpoints/channels/invitations/accept.js';
import { meta as rejectMeta } from '@/server/api/endpoints/channels/invitations/reject.js';

describe('private channel invitation endpoint security', () => {
	test.each([
		['招待作成', addMemberMeta, 'write:channels'],
		['招待状況一覧', invitationsMeta, 'read:channels'],
		['招待承認', acceptMeta, 'write:channels'],
		['招待拒否', rejectMeta, 'write:channels'],
	])('%s はログインと適切な権限スコープを要求する', (_name, meta, kind) => {
		expect(meta.requireCredential).toBe(true);
		expect(meta.kind).toBe(kind);
	});
});
