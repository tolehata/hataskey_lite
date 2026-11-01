/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { EmailService } from '@/core/EmailService.js';
import { SigninWithPasskeyApiService } from '@/server/api/SigninWithPasskeyApiService.js';
import { AdminChannelService } from '@/server/api/stream/channels/admin.js';
import { DriveChannelService } from '@/server/api/stream/channels/drive.js';
import { MainChannelService } from '@/server/api/stream/channels/main.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- 外部送信やDB接続を行わない依存スタブ。 */

const mail = vi.hoisted(() => ({ send: vi.fn(async (_message: Record<string, unknown>) => ({ messageId: 'test' })) }));
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: mail.send }) }));
const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
afterEach(() => vi.clearAllMocks());

describe('古い秘密鍵形式の読み出し', () => {
	const key = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { format: 'pem', type: 'spki' },
		privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
	});

	test('PKCS#8への変換後も同じ公開鍵で署名を検証できる', async () => {
		const repository = {
			findOneByOrFail: async () => ({ userId: 'owner', privateKey: key.privateKey, publicKey: key.publicKey }),
			update: vi.fn(async () => undefined),
		};
		const subject = new UserKeypairService({} as any, repository as any);
		try {
			const result = await subject.fetcher('owner');
			expect(result.privateKey.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
			const message = Buffer.from('Hataskey signature compatibility');
			expect(verify('sha256', message, key.publicKey, sign('sha256', message, result.privateKey))).toBe(true);
			expect(repository.update).toHaveBeenCalledWith({ userId: 'owner' }, { privateKey: result.privateKey });
		} finally {
			subject.dispose();
		}
	});

	test('保存に失敗したときは変換済みとしてキャッシュへ返さない', async () => {
		const subject = new UserKeypairService({} as any, {
			findOneByOrFail: async () => ({ userId: 'owner', privateKey: key.privateKey }),
			update: async () => { throw new Error('storage failed'); },
		} as any);
		try {
			await expect(subject.fetcher('owner')).rejects.toThrow('storage failed');
		} finally {
			subject.dispose();
		}
	});

	test('すでにPKCS#8の鍵は書き換えない', async () => {
		const repository = {
			findOneByOrFail: async () => ({ userId: 'owner', privateKey: '-----BEGIN PRIVATE KEY-----\nfixture' }),
			update: vi.fn(),
		};
		const subject = new UserKeypairService({} as any, repository as any);
		try {
			await subject.fetcher('owner');
			expect(repository.update).not.toHaveBeenCalled();
		} finally {
			subject.dispose();
		}
	});
});

test('通知メールの本文・件名・画像URLをHTMLへ安全に埋め込む', async () => {
	const subject = new EmailService({ url: 'https://example.invalid', host: 'example.invalid' } as any,
		{ enableEmail: true, email: 'sender@example.invalid', logoImageUrl: 'https://example.invalid/logo" onerror="alert(1)' } as any,
		{} as any, { getLogger: () => logger } as any, {} as any, {} as any);
	await subject.sendEmail('recipient@example.invalid', '<img src=x onerror=alert(1)>', '<p>safe <strong>format</strong></p><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>', 'plain');
	expect(mail.send).toHaveBeenCalledTimes(1);
	const message = mail.send.mock.calls[0]![0] as any;
	expect(message.html).toContain('<strong>format</strong>');
	expect(message.html).toContain('&lt;img');
	expect(message.html).not.toContain('<script>');
	expect(message.html).not.toContain('href="javascript:');
	expect(message.html).not.toContain('" onerror="');
});

describe('パスキーのサーバー発行コンテキスト', () => {
	function setup() {
		const webauthn = { verifySignInWithPasskeyAuthentication: vi.fn(async () => 'owner'), initiateSignInWithPasskeyAuthentication: vi.fn(async () => ({ challenge: 'challenge' })) };
		const service = new SigninWithPasskeyApiService({ url: 'https://example.invalid' } as any,
			{ findOneBy: async () => ({ id: 'owner' }) } as any,
			{ findOneByOrFail: async () => ({ usePasswordLessLogin: true }) } as any,
			{ insert: vi.fn() } as any, {} as any, { limit: async () => undefined } as any,
			{ signin: () => 'signedin' } as any, webauthn as any, { getLogger: () => logger } as any);
		const reply = { code: vi.fn(), header: vi.fn() };
		return { service, webauthn, reply };
	}

	test.each([undefined, '', 'auth-context', 'owner', 1234, '882042b6-bb28-1d79-8d63-f869488ef4ef'])('不正なコンテキストを認証処理前に拒否する: %s', async (context) => {
		const { service, webauthn, reply } = setup();
		await service.signin({ body: { credential: { id: 'credential' }, context }, ip: '127.0.0.1' } as any, reply as any);
		expect(reply.code).toHaveBeenCalledWith(400);
		expect(webauthn.verifySignInWithPasskeyAuthentication).not.toHaveBeenCalled();
	});

	test('発行されたUUIDを使えば認証を完了できる', async () => {
		const { service, webauthn, reply } = setup();
		const first = await service.signin({ body: {}, ip: '127.0.0.1' } as any, reply as any) as any;
		expect(webauthn.initiateSignInWithPasskeyAuthentication).toHaveBeenCalledWith(first.context);
		const result = await service.signin({ body: { context: first.context, credential: { id: 'credential' } }, ip: '127.0.0.1' } as any, reply as any);
		expect(result).toEqual({ signinResponse: 'signedin' });
	});
});

describe('WebSocketチャンネルの購読解除', () => {
	test.each(['admin', 'drive', 'main'])('%s は接続中に配信し、切断後は配信を止める', async (name) => {
		const subscriber = new EventEmitter();
		const connection = { user: { id: 'owner' }, hasPermission: () => true, subscriber, sendMessageToWs: vi.fn(), userIdsWhoMeMuting: new Set(), userProfile: { mutedInstances: [] } };
		const factory = name === 'admin' ? new AdminChannelService() : name === 'drive' ? new DriveChannelService() : new MainChannelService({} as any);
		const channel = factory.create('channel', connection as any);
		const eventName = `${name}Stream:owner`;
		await channel.init({});
		const event = { type: 'testEvent', body: { value: 1 } };
		subscriber.emit(eventName, event);
		expect(connection.sendMessageToWs).toHaveBeenCalledTimes(1);
		channel.dispose();
		subscriber.emit(eventName, event);
		expect(connection.sendMessageToWs).toHaveBeenCalledTimes(1);
		expect(subscriber.listenerCount(eventName)).toBe(0);
	});
});
