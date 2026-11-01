/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EmailService } from '@/core/EmailService.js';

const smtp = vi.hoisted(() => ({
	send: vi.fn(async (_message: Record<string, unknown>) => ({ messageId: 'preview' })),
	create: vi.fn(),
}));
vi.mock('nodemailer', () => ({ createTransport: smtp.create }));
// These injected services are not exercised by email delivery; avoid starting their dependency trees.
vi.mock('@/core/UtilityService.js', () => ({ UtilityService: class {} }));
vi.mock('@/core/LoggerService.js', () => ({ LoggerService: class {} }));
vi.mock('@/core/HttpRequestService.js', () => ({ HttpRequestService: class {} }));

beforeEach(() => {
	vi.clearAllMocks();
	smtp.send.mockResolvedValue({ messageId: 'preview' });
	smtp.create.mockReturnValue({ sendMail: smtp.send });
});

function setup(overrides: Record<string, unknown> = {}) {
	const logger = { info: vi.fn(), error: vi.fn() };
	const meta = {
		enableEmail: true, name: 'そらの広場', iconUrl: 'https://example.invalid/icon.png',
		email: 'sender@example.invalid', langs: ['ja-JP'], smtpHost: 'smtp.example.invalid',
		smtpPort: 465, smtpSecure: true, smtpUser: 'user', smtpPass: 'password', ...overrides,
	};
	const service = new EmailService(
		{ url: 'https://example.invalid', host: 'example.invalid', proxySmtp: 'socks://proxy.invalid' } as never,
		meta as never, {} as never, { getLogger: () => logger } as never, {} as never, {} as never,
	);
	return { service, logger };
}

describe('Hataskey email delivery', () => {
	test('keeps SMTP configuration, recipient and sender while delivering one complete template', async () => {
		const { service } = setup();
		const url = 'https://example.invalid/reset-password/original-token?a=1&b=2';
		await service.sendTemplateEmail('recipient@example.invalid', { kind: 'reset-password', url }, 'ja-JP');
		expect(smtp.create).toHaveBeenCalledWith({
			host: 'smtp.example.invalid', port: 465, secure: true, ignoreTLS: false,
			proxy: 'socks://proxy.invalid', auth: { user: 'user', pass: 'password' },
		});
		expect(smtp.send).toHaveBeenCalledOnce();
		const message = smtp.send.mock.calls[0][0];
		expect(message).toMatchObject({ to: 'recipient@example.invalid', from: { name: 'そらの広場', address: 'sender@example.invalid' }, subject: 'Password reset requested' });
		expect(message.html).toContain('そらの広場');
		expect(message.html).toContain('src="https://example.invalid/icon.png"');
		expect(message.html).toContain('href="https://example.invalid/reset-password/original-token?a=1&amp;b=2"');
		expect(message.html).toContain('受け付けました。<br>下のボタン');
		expect(message.html).toContain('prefers-color-scheme');
		expect(String(message.html).match(/<!doctype html>/gi)).toHaveLength(1);
		expect(message.html).not.toContain('/settings/email');
		expect(message.text).toContain(url);
		expect(message.text).toContain('発行から30分');
	});

	test('disabled email exits before rendering or creating a transport on either entry point', async () => {
		const { service } = setup({ enableEmail: false });
		await service.sendTemplateEmail('recipient@example.invalid', { kind: 'reset-password', url: 'invalid' });
		await service.sendEmail('recipient@example.invalid', 'invalid\nsubject', '<script>bad</script>', 'plain');
		expect(smtp.create).not.toHaveBeenCalled();
		expect(smtp.send).not.toHaveBeenCalled();
	});

	test('retains unauthenticated SMTP and unnamed sender behavior', async () => {
		const { service } = setup({ smtpUser: '', name: null, iconUrl: null });
		await service.sendTemplateEmail('recipient@example.invalid', { kind: 'login' });
		expect(smtp.create.mock.calls[0][0]).toMatchObject({ ignoreTLS: true, auth: undefined });
		expect(smtp.send.mock.calls[0][0].from).toBe('sender@example.invalid');
		expect(smtp.send.mock.calls[0][0].html).toContain('src="https://example.invalid/favicon.ico"');
	});

	test.each([
		['ja-JP', ['en'], 'ja'], ['en-US', ['ja'], 'en'], ['fr-FR', ['ja'], 'en'],
		[null, ['en-US'], 'en'], [undefined, [], 'ja'],
	] as const)('resolves recipient locale %s before server language %s', async (locale, langs, expected) => {
		const { service } = setup({ langs });
		await service.sendTemplateEmail('recipient@example.invalid', { kind: 'login' }, locale);
		expect(smtp.send.mock.calls[0][0].html).toContain(`<html lang="${expected}">`);
	});

	test.each(['javascript:alert(1)', 'https://example.invalid/icon" onerror="bad', 'https://user:pass@example.invalid/icon', 'https://['])('invalid icon metadata falls back without blocking delivery: %s', async iconUrl => {
		const { service } = setup({ iconUrl });
		await service.sendTemplateEmail('recipient@example.invalid', { kind: 'login' });
		expect(smtp.send.mock.calls[0][0].html).toContain('src="https://example.invalid/favicon.ico"');
	});

	test('admin HTML formatting survives while unsafe markup is removed and plain text stays independent', async () => {
		const { service } = setup({ name: '<img src=x> & server' });
		await service.sendEmail('recipient@example.invalid', '<subject>', '<p>一文目。次の文。</p><b>strong</b><a href="https://example.invalid/help">help</a><script>bad()</script><img src=x onerror=bad()><a href="javascript:bad()">bad link</a>', '独立した本文。次の文。');
		const message = smtp.send.mock.calls[0][0];
		expect(message.html).toContain('<b>strong</b>');
		expect(message.html).toContain('href="https://example.invalid/help"');
		expect(message.html).toContain('一文目。<br>次の文。');
		expect(message.html).toContain('&lt;img src=x&gt; &amp; server');
		expect(message.html).not.toMatch(/<script|onerror=|href="javascript:|<img src=x/);
		expect(message.subject).toBe('<subject>');
		expect(message.text).toContain('独立した本文。\n次の文。');
	});

	test('logs and propagates transport failures so callers retain their error contracts', async () => {
		const { service, logger } = setup();
		const error = new Error('SMTP unavailable');
		smtp.send.mockRejectedValueOnce(error);
		await expect(service.sendTemplateEmail('recipient@example.invalid', { kind: 'login' })).rejects.toBe(error);
		expect(logger.error).toHaveBeenCalledWith(error);
		expect(logger.info).not.toHaveBeenCalled();
	});
});
