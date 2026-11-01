/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { CaptchaService, captchaErrorCodes } from '@/core/CaptchaService.js';

const providers = [
	{ name: 'hcaptcha', method: 'verifyHcaptcha', endpoint: 'https://hcaptcha.com/siteverify' },
	{ name: 'recaptcha', method: 'verifyRecaptcha', endpoint: 'https://www.recaptcha.net/recaptcha/api/siteverify' },
	{ name: 'turnstile', method: 'verifyTurnstile', endpoint: 'https://challenges.cloudflare.com/turnstile/v0/siteverify' },
	{ name: 'mcaptcha', method: 'verifyMcaptcha', endpoint: 'https://captcha.example.invalid/api/v1/pow/siteverify' },
] as const;

function fixture() {
	const send = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, valid: true }) });
	const service = new CaptchaService({ send } as never, {} as never, { getLogger: () => ({}) } as never);
	return { service, send };
}

function verify(service: CaptchaService, provider: typeof providers[number], response: string | null | undefined = 'token & +') {
	return provider.method === 'verifyMcaptcha'
		? service.verifyMcaptcha('secret & +', 'site-key', 'https://captcha.example.invalid/nested', response)
		: service[provider.method]('secret & +', response);
}

describe.each(providers)('$name HTTP verification', provider => {
	test('sends the expected endpoint, token and secret, and accepts success', async () => {
		const f = fixture();
		await expect(verify(f.service, provider)).resolves.toBeUndefined();
		expect(f.send).toHaveBeenCalledExactlyOnceWith(provider.endpoint, {
			method: 'POST',
			body: provider.method === 'verifyMcaptcha'
				? JSON.stringify({ key: 'site-key', secret: 'secret & +', token: 'token & +' })
				: new URLSearchParams({ secret: 'secret & +', response: 'token & +' }).toString(),
			headers: { 'Content-Type': provider.method === 'verifyMcaptcha' ? 'application/json' : 'application/x-www-form-urlencoded' },
		}, { throwErrorWhenResponseNotOk: false });
	});

	test('rejects a negative verification response', async () => {
		const f = fixture();
		f.send.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: false, valid: false }) });
		await expect(verify(f.service, provider)).rejects.toMatchObject({ code: captchaErrorCodes.verificationFailed });
		expect(f.send).toHaveBeenCalledOnce();
	});

	test('rejects an HTTP failure', async () => {
		const f = fixture();
		f.send.mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn() });
		await expect(verify(f.service, provider)).rejects.toMatchObject({ code: captchaErrorCodes.requestFailed });
		expect(f.send).toHaveBeenCalledOnce();
	});

	test('rejects a transport failure', async () => {
		const f = fixture();
		f.send.mockRejectedValueOnce(new Error('network unavailable'));
		await expect(verify(f.service, provider)).rejects.toThrow();
		expect(f.send).toHaveBeenCalledOnce();
	});

	test.each([null, undefined])('rejects a missing token (%s) without HTTP', async response => {
		const f = fixture();
		// Pass undefined directly rather than through verify's token default.
		const request = provider.method === 'verifyMcaptcha'
			? f.service.verifyMcaptcha('secret', 'site', 'https://captcha.example.invalid', response)
			: f.service[provider.method]('secret', response);
		await expect(request).rejects.toMatchObject({ code: captchaErrorCodes.noResponseProvided });
		expect(f.send).not.toHaveBeenCalled();
	});
});

describe('testcaptcha verification', () => {
	test('accepts its exact passing token without HTTP', async () => {
		const f = fixture();
		await expect(f.service.verifyTestcaptcha('testcaptcha-passed')).resolves.toBeUndefined();
		expect(f.send).not.toHaveBeenCalled();
	});
	test.each(['wrong-token', ''])('rejects an invalid token (%s) without HTTP', async token => {
		const f = fixture();
		await expect(f.service.verifyTestcaptcha(token)).rejects.toMatchObject({ code: captchaErrorCodes.verificationFailed });
		expect(f.send).not.toHaveBeenCalled();
	});
	test.each([null, undefined])('rejects a missing token (%s) without HTTP', async token => {
		const f = fixture();
		await expect(f.service.verifyTestcaptcha(token)).rejects.toMatchObject({ code: captchaErrorCodes.noResponseProvided });
		expect(f.send).not.toHaveBeenCalled();
	});
});
