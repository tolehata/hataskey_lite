/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { SignupApiService } from '@/server/api/SignupApiService.js';

vi.mock('argon2', () => ({ hash: vi.fn(async () => 'argon2-hash') }));
afterEach(() => vi.unstubAllEnvs());

describe('invitation claims', () => {
	function setup(emailRequiredForSignup = false, usedAt: Date | null = null) {
		vi.stubEnv('NODE_ENV', 'production');
		const meta = { disableRegistration: true, registrationClosed: false, emailRequiredForSignup, preservedUsernames: [] };
		const ticket = { id: 'ticket', usedById: null as string | null, usedAt, pendingUserId: null as string | null };
		const repository = {
			findOneBy: vi.fn(async () => ({ ...ticket })),
			update: vi.fn(async (where: unknown, values: Partial<typeof ticket>) => {
				if (Array.isArray(where)) {
					const eligible = where.some(condition => condition.id === ticket.id && ticket.usedById === null && (
						condition.usedAt.type === 'isNull' ? ticket.usedAt === null
						: ticket.usedAt !== null && ticket.usedAt <= condition.usedAt.value
					));
					if (!eligible) return { affected: 0 };
				} else if (typeof where !== 'string' && ticket.usedById !== null) {
					return { affected: 0 };
				}
				Object.assign(ticket, values);
				return { affected: 1 };
			}),
		};
		const signup = vi.fn(async () => ({ account: { id: 'created-user' }, secret: 'secret' }));
		const pending = vi.fn(async () => ({ id: 'pending-user' }));
		const pack = vi.fn(async () => ({ id: 'created-user' }));
		const email = { validateEmailForAccount: vi.fn(async () => ({ available: true })), sendTemplateEmail: vi.fn() };
		const service = new SignupApiService(
			{ url: 'https://example.invalid' } as never, meta as never,
			{ exists: async () => false } as never, {} as never, { insertOne: pending } as never,
			{ exists: async () => false } as never, repository as never,
			{ pack } as never, { gen: () => 'pending-user' } as never, {} as never,
			{ signup } as never, {} as never, email as never,
		);

		function request() {
			const reply = { code: vi.fn() };
			const promise = service.signup({ body: { username: 'member', password: 'password', invitationCode: 'code', emailAddress: 'member@example.invalid' } } as never, reply as never);
			return { promise, reply };
		}

		return { request, ticket, repository, signup, pending, pack, email, meta };
	}

	test.each([false, true])('only one parallel signup consumes the invitation (email=%s)', async email => {
		const fixture = setup(email);
		const first = fixture.request();
		const second = fixture.request();
		await Promise.all([first.promise, second.promise]);
		expect(email ? fixture.pending : fixture.signup).toHaveBeenCalledTimes(1);
		expect([first.reply, second.reply].filter(reply => reply.code.mock.calls.some(([status]) => status === 400))).toHaveLength(1);
		expect(fixture.ticket.usedAt).toBeInstanceOf(Date);
	});

	test('an unconfirmed email invitation can be reclaimed after 30 minutes', async () => {
		const fixture = setup(true, new Date(Date.now() - 31 * 60 * 1000));
		await fixture.request().promise;
		expect(fixture.pending).toHaveBeenCalledTimes(1);
		expect(fixture.ticket.pendingUserId).toBe('pending-user');
	});

	test('an email invitation in its cooldown is not consumed', async () => {
		const fixture = setup(true, new Date());
		const request = fixture.request();
		await request.promise;
		expect(request.reply.code).toHaveBeenCalledWith(400);
		expect(fixture.pending).not.toHaveBeenCalled();
	});

	test.each([false, true])('a failed signup releases its uncommitted invitation (email=%s)', async email => {
		const fixture = setup(email);
		(email ? fixture.pending : fixture.signup).mockRejectedValueOnce(new Error('storage failed'));
		await expect(fixture.request().promise).rejects.toThrow('storage failed');
		expect(fixture.ticket.usedAt).toBeNull();
		expect(fixture.ticket.pendingUserId).toBeNull();
		await fixture.request().promise;
		expect(email ? fixture.pending : fixture.signup).toHaveBeenCalledTimes(2);
	});

	test('a serialization failure does not release an invitation linked to the created account', async () => {
		const fixture = setup();
		fixture.pack.mockRejectedValueOnce(new Error('packing failed'));
		await expect(fixture.request().promise).rejects.toThrow('packing failed');
		expect(fixture.ticket.usedById).toBe('created-user');
		expect(fixture.ticket.usedAt).toBeInstanceOf(Date);
	});
});

describe('pending invitation expiry follows the pending account, not the earlier claim', () => {
	function setup(pendingAgeMinutes: number | null) {
		const ticket = { id: 'ticket', usedById: null as string | null, usedAt: new Date(Date.now() - 31 * 60 * 1000), pendingUserId: 'old-pending' as string | null };
		const pending = pendingAgeMinutes == null ? null : { id: 'old-pending' };
		const matches = (condition: Record<string, any>) => Object.entries(condition).every(([key, expected]) => {
			const value = ticket[key as keyof typeof ticket];
			if (expected?.type === 'isNull') return value == null;
			if (expected?.type === 'lessThanOrEqual') return value != null && value <= expected.value;
			return value === expected;
		});
		const repository = {
			findOneBy: vi.fn(async (condition: Record<string, any>) => matches(condition) ? { ...ticket } : null),
			update: vi.fn(async (condition: Record<string, any> | Record<string, any>[], values: Partial<typeof ticket>) => {
				if (!(Array.isArray(condition) ? condition.some(matches) : matches(condition))) return { affected: 0 };
				Object.assign(ticket, values);
				return { affected: 1 };
			}),
		};
		const pendings = { findOneBy: vi.fn(async () => pending), delete: vi.fn(async () => undefined) };
		const service = Object.assign(Object.create(SignupApiService.prototype), {
			meta: { emailRequiredForSignup: true }, registrationTicketsRepository: repository, userPendingsRepository: pendings,
			idService: { parse: () => ({ date: new Date(Date.now() - (pendingAgeMinutes ?? 0) * 60 * 1000) }) },
		});
		return { service, ticket, repository, pendings };
	}

	test('the still-valid pending account prevents reclaim after usedAt has expired', async () => {
		const f = setup(29);
		expect(await f.service.claimRegistrationTicket({ ...f.ticket })).toBe(false);
		expect(f.ticket.pendingUserId).toBe('old-pending');
		expect(f.pendings.delete).not.toHaveBeenCalled();
	});

	test.each([31, null])('an expired or missing pending account can be reclaimed once (age=%s)', async age => {
		const f = setup(age);
		const stale = { ...f.ticket };
		expect(await Promise.all([f.service.claimRegistrationTicket(stale), f.service.claimRegistrationTicket(stale)])).toEqual([true, false]);
		expect(f.ticket.pendingUserId).toBeNull();
		expect(f.ticket.usedAt.getTime()).toBeGreaterThan(Date.now() - 1000);
		expect(f.pendings.delete).toHaveBeenCalledTimes(age == null ? 0 : 1);
	});

	test('a concurrent account attachment is not detached or reclaimed', async () => {
		const f = setup(31);
		f.pendings.findOneBy.mockImplementationOnce(async () => {
			f.ticket.usedById = 'created-account';
			return { id: 'old-pending' };
		});
		expect(await f.service.claimRegistrationTicket({ ...f.ticket })).toBe(false);
		expect(f.ticket.pendingUserId).toBe('old-pending');
		expect(f.pendings.delete).not.toHaveBeenCalled();
	});
});
