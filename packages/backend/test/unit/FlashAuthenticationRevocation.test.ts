/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { AuthenticateService, AuthenticationError } from '@/server/api/AuthenticateService.js';

describe('Flash authentication uses current account state', () => {
	function fixture() {
		const original = { id: 'user', host: null, isSuspended: false, isDeleted: false, name: 'old' };
		const flash = { user: original, permissions: ['read:account', 'write:notes'] };
		const current = { ...original, name: 'current' };
		const users = { findOneBy: vi.fn(async () => current) };
		const service = new AuthenticateService(users as never, { findOne: async () => null } as never, {} as never,
			{ flashAccessTokensCache: { get: async () => flash } } as never);
		return { service, users, flash, current };
	}

	test('refreshes the user without changing permissions or the stored token snapshot', async () => {
		const f = fixture();
		try {
			const [user, accessToken, token] = await f.service.authenticate('flash-token-that-is-not-native');
			expect(user).toBe(f.current);
			expect(accessToken).toBeNull();
			expect(token?.user).toBe(f.current);
			expect(token?.permissions).toEqual(f.flash.permissions);
			expect(f.flash.user.name).toBe('old');
			expect(f.users.findOneBy).toHaveBeenCalledWith({ id: 'user' });
		} finally {
			f.service.dispose();
		}
	});

	test.each(['isSuspended', 'isDeleted', 'missing', 'remote'] as const)('rejects %s after the token was issued', async state => {
		const f = fixture();
		try {
			await expect(f.service.authenticate('flash-token')).resolves.toBeDefined();
			if (state === 'missing') f.users.findOneBy.mockResolvedValue(null as never);
			else if (state === 'remote') f.users.findOneBy.mockResolvedValue({ ...f.current, host: 'remote.invalid' } as never);
			else f.current[state] = true;
			await expect(f.service.authenticate('flash-token')).rejects.toBeInstanceOf(AuthenticationError);
			expect(f.flash.user.isSuspended).toBe(false);
			expect(f.flash.user.isDeleted).toBe(false);
		} finally {
			f.service.dispose();
		}
	});

	test('keeps anonymous and native authentication on their existing paths', async () => {
		const user = { id: 'native' };
		const fetch = vi.fn(async () => user);
		const findOneBy = vi.fn();
		const service = new AuthenticateService({ findOneBy } as never, {} as never, {} as never,
			{ localUserByNativeTokenCache: { fetch } } as never);
		try {
			await expect(service.authenticate(null)).resolves.toEqual([null, null, null]);
			await expect(service.authenticate('0123456789abcdef')).resolves.toEqual([user, null, null]);
			expect(fetch).toHaveBeenCalledOnce();
			expect(findOneBy).not.toHaveBeenCalled();
		} finally {
			service.dispose();
		}
	});
});
