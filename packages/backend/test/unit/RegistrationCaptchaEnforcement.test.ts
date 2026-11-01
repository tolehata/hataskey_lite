/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { SignupApiService } from '@/server/api/SignupApiService.js';
import ApplyEndpoint from '@/server/api/endpoints/registration/apply.js';

vi.mock('argon2', () => ({ hash: vi.fn(async () => 'hash') }));
vi.mock('bcryptjs', () => ({ default: { genSalt: vi.fn(async () => 'salt'), hash: vi.fn(async () => 'hash') } }));
afterEach(() => vi.unstubAllEnvs());

const providers = [
	{ name: 'hcaptcha', enabled: 'enableHcaptcha', method: 'verifyHcaptcha', token: 'hcaptcha-response', config: { hcaptchaSecretKey: 'secret' }, args: ['secret', 'token'] },
	{ name: 'mcaptcha', enabled: 'enableMcaptcha', method: 'verifyMcaptcha', token: 'm-captcha-response', config: { mcaptchaSecretKey: 'secret', mcaptchaSitekey: 'site', mcaptchaInstanceUrl: 'https://captcha.example.invalid' }, args: ['secret', 'site', 'https://captcha.example.invalid', 'token'] },
	{ name: 'recaptcha', enabled: 'enableRecaptcha', method: 'verifyRecaptcha', token: 'g-recaptcha-response', config: { recaptchaSecretKey: 'secret' }, args: ['secret', 'token'] },
	{ name: 'turnstile', enabled: 'enableTurnstile', method: 'verifyTurnstile', token: 'turnstile-response', config: { turnstileSecretKey: 'secret' }, args: ['secret', 'token'] },
	{ name: 'testcaptcha', enabled: 'enableTestcaptcha', method: 'verifyTestcaptcha', token: 'testcaptcha-response', config: {}, args: ['token'] },
] as const;

function fixture(entry: 'signup' | 'apply', settings: Record<string, unknown>) {
	vi.stubEnv('NODE_ENV', 'production');
	const meta = { registrationClosed: false, disableRegistration: entry === 'apply', emailRequiredForSignup: false, preservedUsernames: [], ...settings };
	const captcha = Object.fromEntries(providers.map(provider => [provider.method, vi.fn(async (...args: unknown[]) => {
		if (args.at(-1) !== 'token') throw new Error('missing or invalid captcha token');
	})]));
	const create = vi.fn().mockResolvedValue({ account: { id: 'user' }, secret: 'secret' });
	const notify = vi.fn().mockResolvedValue(undefined);
	const sendEmail = vi.fn();
	const users = { exists: vi.fn().mockResolvedValue(false) };
	const repository = { exists: vi.fn().mockResolvedValue(false), insert: create };
	const body = { username: 'applicant', password: 'password123', email: 'applicant@example.invalid', reason: 'join', hasAdminRelationship: false };
	const signup = new SignupApiService(
		{} as never, meta as never, users as never, {} as never, {} as never, users as never, {} as never,
		{ pack: vi.fn().mockResolvedValue({ id: 'user' }) } as never, {} as never, captcha as never,
		{ signup: create } as never, {} as never, { sendTemplateEmail: sendEmail } as never,
	);
	const apply = new ApplyEndpoint(meta as never, repository as never, users as never, users as never, { gen: () => 'application' } as never, captcha as never, { notifyNewApplication: notify } as never);
	return {
		captcha, create, notify, sendEmail,
		invoke: (tokens: Record<string, string> = {}) => entry === 'signup'
			? signup.signup({ body: { ...body, ...tokens } } as never, { code: vi.fn() } as never)
			: apply.exec({ ...body, ...tokens }, null, null, null),
	};
}

describe.each(['signup', 'apply'] as const)('%s CAPTCHA enforcement', entry => {
	test.each(providers)('$name verifies the supplied token before creation', async provider => {
		const f = fixture(entry, { ...provider.config, [provider.enabled]: true });
		await f.invoke({ [provider.token]: 'token' });
		expect(f.captcha[provider.method]).toHaveBeenCalledExactlyOnceWith(...provider.args);
		expect(f.create).toHaveBeenCalledTimes(1);
		for (const other of providers.filter(other => other !== provider)) expect(f.captcha[other.method]).not.toHaveBeenCalled();
		expect(f.sendEmail).not.toHaveBeenCalled();
	});

	test.each(providers)('$name rejects verifier failure before creation', async provider => {
		const f = fixture(entry, { ...provider.config, [provider.enabled]: true });
		f.captcha[provider.method].mockRejectedValueOnce(new Error('captcha verification failed'));
		await expect(f.invoke({ [provider.token]: 'token' })).rejects.toMatchObject(entry === 'signup' ? { statusCode: 400 } : { code: 'CAPTCHA_FAILED' });
		expect(f.captcha[provider.method]).toHaveBeenCalledExactlyOnceWith(...provider.args);
		expect(f.create).not.toHaveBeenCalled();
		expect(f.notify).not.toHaveBeenCalled();
		expect(f.sendEmail).not.toHaveBeenCalled();
	});

	test.each(providers)('$name rejects a missing token before creation', async provider => {
		const f = fixture(entry, { ...provider.config, [provider.enabled]: true });
		await expect(f.invoke()).rejects.toMatchObject(entry === 'signup' ? { statusCode: 400 } : { code: 'CAPTCHA_FAILED' });
		expect(f.captcha[provider.method]).toHaveBeenCalledExactlyOnceWith(...provider.args.slice(0, -1), undefined);
		expect(f.create).not.toHaveBeenCalled();
		expect(f.notify).not.toHaveBeenCalled();
		expect(f.sendEmail).not.toHaveBeenCalled();
	});

	test.each(providers)('$name is not verified while disabled', async provider => {
		const f = fixture(entry, { ...provider.config, [provider.enabled]: false });
		await f.invoke();
		for (const verifier of Object.values(f.captcha)) expect(verifier).not.toHaveBeenCalled();
		expect(f.create).toHaveBeenCalledTimes(1);
	});

	for (const provider of providers) {
		for (const field of Object.keys(provider.config)) {
			test.each([null, '', '   '])(`${provider.name} rejects missing ${field} (%s) without verification or creation`, async missing => {
				const f = fixture(entry, { ...provider.config, [provider.enabled]: true, [field]: missing });
				await expect(f.invoke({ [provider.token]: 'token' })).rejects.toMatchObject(entry === 'signup' ? { statusCode: 400 } : { code: 'CAPTCHA_FAILED' });
				for (const verifier of Object.values(f.captcha)) expect(verifier).not.toHaveBeenCalled();
				expect(f.create).not.toHaveBeenCalled();
				expect(f.notify).not.toHaveBeenCalled();
				expect(f.sendEmail).not.toHaveBeenCalled();
			});
		}
	}
});
