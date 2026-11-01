/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { DeleteAccountService } from '@/core/DeleteAccountService.js';
import { DeleteAccountProcessorService } from '@/queue/processors/DeleteAccountProcessorService.js';

vi.mock('@/core/QueueService.js', () => ({ QueueService: class {} }));
vi.mock('@/core/entities/UserEntityService.js', () => ({ UserEntityService: class {} }));
vi.mock('@/core/activitypub/ApRendererService.js', () => ({ ApRendererService: class {} }));
vi.mock('@/core/ModerationLogService.js', () => ({ ModerationLogService: class {} }));
vi.mock('@/core/SystemAccountService.js', () => ({ SystemAccountService: class {} }));
vi.mock('@/core/GlobalEventService.js', () => ({ GlobalEventService: class {} }));
vi.mock('@/core/HataigoWithdrawalService.js', () => ({ HataigoWithdrawalService: class {} }));
vi.mock('@/core/DriveService.js', () => ({ DriveService: class {} }));
vi.mock('@/core/EmailService.js', () => ({ EmailService: class {} }));
vi.mock('@/core/SearchService.js', () => ({ SearchService: class {} }));
vi.mock('@/core/PageService.js', () => ({ PageService: class {} }));
vi.mock('@/queue/QueueLoggerService.js', () => ({ QueueLoggerService: class {} }));

const user = { id: 'alice', host: null, username: 'alice', isDeleted: false };

test('account deletion marks the user deleted before anonymization and preserves its existing queue/event path', async () => {
	const order: string[] = [];
	const users = { findOneByOrFail: vi.fn(async () => ({ ...user })), update: vi.fn(async () => { order.push('deleted'); }) };
	const queue = { createDeleteAccountJob: vi.fn(), deliver: vi.fn() };
	const events = { publishInternalEvent: vi.fn(() => { order.push('event'); }) };
	const withdrawal = { cleanup: vi.fn(async (id: string) => { expect(id).toBe(user.id); expect(order).toEqual(['deleted']); order.push('anonymized'); }) };
	const service = new DeleteAccountService({ rootUserId: 'root' } as never, users as never, { find: async () => [] } as never, { isLocalUser: () => true, genLocalUserUri: () => 'https://local.example/users/alice' } as never, { addContext: (value: unknown) => value, renderDelete: () => ({ type: 'Delete' }) } as never, queue as never, events as never, {} as never, {} as never, withdrawal as never);
	await service.deleteAccount(user);
	expect(order).toEqual(['deleted', 'anonymized', 'event']);
	expect(queue.createDeleteAccountJob).toHaveBeenCalledWith(user, { soft: false });
	expect(users.update).toHaveBeenCalledWith(user.id, { isDeleted: true });
	expect(events.publishInternalEvent).toHaveBeenCalledWith('userChangeDeletedState', { id: user.id, isDeleted: true });
});

test.each(['soft', 'hard', 'alreadyMissing'] as const)('delete processor always anonymizes before %s handling, including a missing user on retry', async mode => {
	let stored = mode === 'alreadyMissing' ? null : { ...user };
	const order: string[] = [];
	const users = {
		update: vi.fn(async (_id: string, patch: { isDeleted: boolean }) => { if (stored) stored = { ...stored, ...patch }; order.push('flag'); }),
		findOneBy: vi.fn(async () => stored),
		delete: vi.fn(async () => { order.push('hardDelete'); stored = null; }),
	};
	const notes = { find: vi.fn(async () => []), delete: vi.fn() };
	const files = { find: vi.fn(async () => []) }; const pages = { find: vi.fn(async () => []) };
	const withdrawal = { cleanup: vi.fn(async (id: string) => { expect(id).toBe(user.id); expect(stored?.isDeleted ?? true).toBe(true); order.push('cleanup'); }) };
	const logger = { info: vi.fn(), succ: vi.fn() };
	const service = new DeleteAccountProcessorService(users as never, { findOneByOrFail: async () => ({ email: null }) } as never, notes as never, files as never, pages as never, { isRemoteUser: () => false } as never, {} as never, {} as never, {} as never, { logger: { createSubLogger: () => logger } } as never, {} as never, { publishInternalEvent: vi.fn() } as never, withdrawal as never);
	await service.process({ data: { user, soft: mode === 'soft' } } as never);
	expect(withdrawal.cleanup).toHaveBeenCalledOnce(); expect(order.slice(0, 2)).toEqual(['flag', 'cleanup']);
	if (mode === 'hard') expect(users.delete).toHaveBeenCalledWith(user.id);
	else expect(users.delete).not.toHaveBeenCalled();
	if (mode === 'soft') expect(stored?.isDeleted).toBe(true);
	if (mode === 'alreadyMissing') expect(notes.find).not.toHaveBeenCalled();
});
