/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { SignupApiService } from '@/server/api/SignupApiService.js';

describe('complete registration closure', () => {
	test.each(['signup', 'signupPending'] as const)('%s refuses direct requests before reading invitations or pending users', async method => {
		const lookup = vi.fn();
		const signup = { signup: vi.fn() };
		const repository = { findOneBy: lookup, findOneByOrFail: lookup };
		const service = new SignupApiService(
			{} as never, { registrationClosed: true } as never,
			repository as never, repository as never, repository as never, repository as never, repository as never,
			{} as never, {} as never, {} as never, signup as never, {} as never, {} as never,
		);
		await expect(service[method]({ body: { username: 'member', password: 'password', invitationCode: 'valid-invite', code: 'valid-pending' } } as never, {} as never))
			.rejects.toMatchObject({ statusCode: 403, message: 'REGISTRATION_CLOSED' });
		expect(lookup).not.toHaveBeenCalled();
		expect(signup.signup).not.toHaveBeenCalled();
	});
});
