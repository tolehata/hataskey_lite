/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { FeedbackEmojiService, emojiChangeSnapshot, matchesEmojiSnapshot } from '@/core/FeedbackEmojiService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';
import { MiFeedbackEmojiChangeRequest } from '@/models/FeedbackEmojiChangeRequest.js';
import { MiEmoji } from '@/models/Emoji.js';
import type { EmojiTransaction } from '@/misc/emoji-transaction.js';
import type { MiUser } from '@/models/User.js';

const applicant = { id: 'applicant' } as MiUser;
const staff = { id: 'staff' } as MiUser;
const instant = new Date('2026-09-22T00:00:00.000Z');

function setup() {
	const original = { id: 'original', requestedById: applicant.id, status: 'approved', resolvedEmojiId: 'emoji', createdAt: instant } as MiFeedbackEmojiRequest;
	const emoji = { id: 'emoji', name: 'hello', originalUrl: 'https://example.test/old.png', publicUrl: 'https://example.test/old.png', license: 'original license', host: null, updatedAt: instant } as MiEmoji;
	const change = { id: 'change', originalRequestId: original.id, requestedById: applicant.id, targetEmojiId: emoji.id, targetSnapshot: emojiChangeSnapshot(emoji), kind: 'updateImage', status: 'pending', updatedAt: instant, fileId: 'image', reason: 'replace', license: 'new license', events: [] } as unknown as MiFeedbackEmojiChangeRequest;
	const state = { original, emoji: emoji as MiEmoji | null, change, active: false, file: { id: 'image', userId: applicant.id, userHost: null, isLink: false, type: 'image/png', size: 1024, url: 'https://example.test/new.png', webpublicUrl: null } as Record<string, unknown> | null };
	const requestRepo = { findOneBy: vi.fn(async (where: { id: string; requestedById?: string }) => where.id === original.id && (!where.requestedById || where.requestedById === original.requestedById) ? state.original : null), update: vi.fn(async (_id: string, data: Record<string, unknown>) => { Object.assign(state.original, data); }) };
	const changeRepo = { findOne: vi.fn(async () => state.change), existsBy: vi.fn(async () => state.active), insert: vi.fn(async (data: MiFeedbackEmojiChangeRequest) => { state.change = data; }), update: vi.fn(async (_id: string, data: Record<string, unknown>) => { Object.assign(state.change, data); }) };
	const emojiRepo = { findOne: vi.fn(async () => state.emoji), findOneByOrFail: vi.fn(async () => state.emoji) };
	const manager = { query: vi.fn(async () => []), getRepository: (model: unknown) => model === MiFeedbackEmojiRequest ? requestRepo : model === MiFeedbackEmojiChangeRequest ? changeRepo : model === MiEmoji ? emojiRepo : undefined };
	const feedback = { canAccess: vi.fn(async () => true), isStaff: vi.fn(async (id: string) => id === staff.id), notify: vi.fn(async () => {}), notifyStaff: vi.fn(async () => {}), getEmojiRequestQuota: vi.fn(() => { throw new Error('Changes must not consult quota'); }) };
	const customEmoji = {
		update: vi.fn(async (data: { id: string; originalUrl: string; publicUrl: string; license: string | null }, _actor: MiUser, tx: EmojiTransaction) => { expect(tx.manager).toBe(manager); Object.assign(state.emoji!, { originalUrl: data.originalUrl, publicUrl: data.publicUrl, license: data.license }); return null; }),
		delete: vi.fn(async (_id: string, _actor: MiUser, tx: EmojiTransaction) => { expect(tx.manager).toBe(manager); state.emoji = null; }),
	};
	// Unit double: transactions are recorded, not a substitute for PostgreSQL lock tests.
	const service = new FeedbackEmojiService({} as never, { manager: { transaction: async (action: (manager: unknown) => Promise<unknown>) => action(manager) } } as never, { findOneBy: async (where: { id: string; userId: string }) => state.file?.id === where.id && state.file.userId === where.userId ? state.file : null } as never, feedback as never, customEmoji as never, { gen: () => 'newchange' } as never, { getLogger: () => ({ error: vi.fn() }) } as never);
	return { service, state, requestRepo, changeRepo, emojiRepo, feedback, customEmoji, manager };
}

describe('HataFeed emoji ownership, quota and review', () => {
	test('an addition cancelled after the staff list was loaded cannot be approved', async () => {
		const { state, manager } = setup(); state.original.status = 'cancelled';
		const applyApproval = vi.fn();
		const service = Object.assign(Object.create(FeedbackService.prototype), {
			feedbackEmojiRequestsRepository: { manager: { transaction: async (action: (manager: unknown) => Promise<void>) => action(manager) }, findOneBy: async () => state.original },
			applyEmojiApproval: applyApproval,
		}) as FeedbackService;
		Object.defineProperties(service, { canAccess: { value: async () => true }, isStaff: { value: async () => true } });
		await expect(service.approveEmojiRequest(staff, { ...state.original, status: 'pending' })).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_REQUEST_CONFLICT' });
		expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['hatafeed-emoji-request', 'original']);
		expect(applyApproval).not.toHaveBeenCalled();
	});
	test('review notifications are saved with the change and delivered after commit with a detail link', async () => {
		const insert = vi.fn(async () => {});
		const deliver = vi.fn(async () => {});
		const service = Object.assign(Object.create(FeedbackService.prototype), {
			idService: { gen: () => 'notification' }, notificationService: { createNotificationAsync: deliver },
		}) as FeedbackService;
		const tx: EmojiTransaction = { manager: { getRepository: () => ({ insert }) } as never, afterCommit: [], afterRollback: [] };
		await service.notify('applicant', 'emojiApproved', { actorId: 'staff', emojiRequestId: 'original', emojiChangeRequestId: 'change' }, '画像更新申請が承認されました。', tx);
		expect(insert).toHaveBeenCalledWith([expect.objectContaining({ userId: 'applicant', emojiChangeRequestId: 'change', emojiRequestId: 'original', type: 'emojiApproved' })]);
		expect(deliver).not.toHaveBeenCalled();
		for (const publish of tx.afterCommit) await publish();
		expect(deliver).toHaveBeenCalledWith('applicant', 'hataFeed', expect.objectContaining({ customLink: '/hatafeed?emojiChangeRequestId=change' }));
	});
	test('another applicant cannot change or cancel the original request', async () => {
		const { service, changeRepo, requestRepo } = setup();
		const other = { id: 'other' } as MiUser;
		await expect(service.create(other, { originalRequestId: 'original', kind: 'withdraw', reason: 'remove' })).rejects.toMatchObject({ code: 'NO_SUCH_EMOJI_REQUEST' });
		await expect(service.cancel(other, 'original')).rejects.toMatchObject({ code: 'NO_SUCH_EMOJI_REQUEST' });
		expect(changeRepo.insert).not.toHaveBeenCalled(); expect(requestRepo.update).not.toHaveBeenCalled();
	});
	test.each(['pending', 'held'])('cancelling %s preserves the quota ledger and creation time', async status => {
		const { service, state, requestRepo, manager } = setup(); state.original.status = status;
		await service.cancel(applicant, 'original', 'cancel');
		expect(state.original.status).toBe('cancelled'); expect(state.original.createdAt).toBe(instant);
		expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['hatafeed-emoji-request', 'original']);
		await service.cancel(applicant, 'original'); expect(requestRepo.update).toHaveBeenCalledTimes(1);
	});
	test('an already approved addition cannot be cancelled', async () => {
		const { service, requestRepo } = setup(); await expect(service.cancel(applicant, 'original')).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_REQUEST_CONFLICT' }); expect(requestRepo.update).not.toHaveBeenCalled();
	});
	test.each(['updateImage', 'withdraw'] as const)('%s creates a separate request without consuming quota', async kind => {
		const { service, changeRepo, requestRepo, feedback } = setup();
		await service.create(applicant, { originalRequestId: 'original', kind, reason: 'change', fileId: 'image', license: 'own image' });
		expect(changeRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ kind, targetEmojiId: 'emoji', status: 'pending' }));
		expect(requestRepo.update).not.toHaveBeenCalled(); expect(feedback.getEmojiRequestQuota).not.toHaveBeenCalled();
	});
	test('a pending change prevents both additional change kinds', async () => {
		const { service, state, changeRepo } = setup(); state.active = true;
		await expect(service.create(applicant, { originalRequestId: 'original', kind: 'withdraw', reason: 'change' })).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_CHANGE_PENDING' }); expect(changeRepo.insert).not.toHaveBeenCalled();
	});
	test.each([{ userId: 'someone-else' }, { type: 'text/html' }, { isLink: true }, { size: 6 * 1024 * 1024 }])('rejects an unavailable or unsafe replacement file %j', async patch => {
		const { service, state, changeRepo } = setup(); Object.assign(state.file!, patch);
		await expect(service.create(applicant, { originalRequestId: 'original', kind: 'updateImage', reason: 'update', fileId: 'image', license: 'license' })).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_INVALID_IMAGE' }); expect(changeRepo.insert).not.toHaveBeenCalled();
	});
	test('only staff may resolve a request', async () => {
		const { service, customEmoji } = setup(); await expect(service.resolve(applicant, 'change', 'approved', instant.toISOString())).rejects.toMatchObject({ code: 'HATAFEED_ACCESS_DENIED' }); expect(customEmoji.update).not.toHaveBeenCalled();
	});
	test('approval preserves the emoji ID and changes only image and license; retry does not reapply', async () => {
		const { service, state, customEmoji, feedback } = setup();
		await service.resolve(staff, 'change', 'approved', instant.toISOString());
		expect(customEmoji.update.mock.calls[0][0]).toEqual({ id: 'emoji', originalUrl: 'https://example.test/new.png', publicUrl: 'https://example.test/new.png', fileType: 'image/png', license: 'new license' });
		expect(state.change.status).toBe('approved'); expect(state.emoji?.id).toBe('emoji');
		await service.resolve(staff, 'change', 'approved', instant.toISOString()); expect(customEmoji.update).toHaveBeenCalledTimes(1); expect(feedback.notify).toHaveBeenCalledTimes(1);
	});
	test('withdrawal deletes the emoji but retains the original quota row', async () => {
		const { service, state, requestRepo, customEmoji } = setup(); state.change.kind = 'withdraw';
		await service.resolve(staff, 'change', 'approved', instant.toISOString());
		expect(customEmoji.delete).toHaveBeenCalledTimes(1); expect(requestRepo.update).not.toHaveBeenCalled(); expect(state.original.createdAt).toBe(instant);
	});
	test.each(['held', 'rejected'] as const)('%s requires a comment and never changes the registered emoji', async status => {
		const { service, state, customEmoji } = setup();
		await expect(service.resolve(staff, 'change', status, instant.toISOString(), ' ')).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_REASON_REQUIRED' });
		await service.resolve(staff, 'change', status, instant.toISOString(), 'review reason');
		expect(state.change.events.at(-1)?.comment).toBe('review reason'); expect(customEmoji.update).not.toHaveBeenCalled(); expect(customEmoji.delete).not.toHaveBeenCalled();
	});
	test('stale reviews, changed targets and missing images cannot be approved', async () => {
		const { service, state, customEmoji } = setup();
		await expect(service.resolve(staff, 'change', 'approved', '2020-01-01T00:00:00.000Z')).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_REQUEST_CONFLICT' });
		state.emoji!.name = 'renamed';
		await expect(service.resolve(staff, 'change', 'approved', instant.toISOString())).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_TARGET_CHANGED' });
		state.emoji!.name = 'hello'; state.file = null;
		await expect(service.resolve(staff, 'change', 'approved', instant.toISOString())).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_INVALID_IMAGE' }); expect(customEmoji.update).not.toHaveBeenCalled();
	});
	test('jsonb key order does not invalidate a target snapshot', () => {
		const { state } = setup(); const snapshot = Object.fromEntries(Object.entries(state.change.targetSnapshot).reverse());
		expect(matchesEmojiSnapshot(state.emoji!, snapshot as typeof state.change.targetSnapshot)).toBe(true);
	});
	test('failed image processing never marks a review approved or sends a result notification', async () => {
		const { service, state, customEmoji, feedback } = setup(); customEmoji.update.mockRejectedValueOnce(new Error('image copy failed'));
		await expect(service.resolve(staff, 'change', 'approved', instant.toISOString())).rejects.toThrow('image copy failed'); expect(state.change.status).toBe('pending'); expect(feedback.notify).not.toHaveBeenCalled();
	});
	test('rollback cleans up the replacement copy and never publishes a committed result', async () => {
		const { service, customEmoji, feedback } = setup();
		const cleanup = vi.fn(async () => {});
		const publish = vi.fn(async () => {});
		customEmoji.update.mockImplementationOnce(async (_data, _actor, tx) => {
			tx.afterRollback.push(cleanup); tx.afterCommit.push(publish);
			throw new Error('failed after image copy');
		});
		await expect(service.resolve(staff, 'change', 'approved', instant.toISOString())).rejects.toThrow('failed after image copy');
		expect(cleanup).toHaveBeenCalledOnce(); expect(publish).not.toHaveBeenCalled(); expect(feedback.notify).not.toHaveBeenCalled();
	});
	test('a held review always advances the version even within the same millisecond', async () => {
		const { service, state } = setup();
		const now = vi.spyOn(Date, 'now').mockReturnValue(instant.getTime());
		try {
			await service.resolve(staff, 'change', 'held', instant.toISOString(), 'checking');
			expect(state.change.updatedAt.getTime()).toBeGreaterThan(instant.getTime());
			await expect(service.resolve(staff, 'change', 'approved', instant.toISOString())).rejects.toMatchObject({ code: 'HATAFEED_EMOJI_REQUEST_CONFLICT' });
		} finally { now.mockRestore(); }
	});
});
