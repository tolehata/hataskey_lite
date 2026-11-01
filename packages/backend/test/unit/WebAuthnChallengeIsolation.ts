/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { WebAuthnService } from '@/core/WebAuthnService.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- チャレンジ保存先だけをメモリ内で再現する。 */

function setup() {
	const challenges = new Map<string, string>();
	const redis = {
		setex: async (key: string, _ttl: number, value: string) => { challenges.set(key, value); },
		get: async (key: string) => challenges.get(key) ?? null,
		getdel: async (key: string) => {
			const value = challenges.get(key) ?? null;
			challenges.delete(key);
			return value;
		},
		del: async (key: string) => { challenges.delete(key); },
	};
	const subject = new WebAuthnService({ url: 'https://example.invalid', hostname: 'example.invalid' } as any,
		{ name: 'Test' } as any, redis as any,
		{ findBy: async () => [{ id: 'YQ', transports: ['internal'] }] } as any);
	return { subject, challenges };
}

describe('WebAuthnの登録・追加認証・パスキーの分離', () => {
	test('同じ識別子で開始しても3種類のチャレンジを上書きしない', async () => {
		const { subject, challenges } = setup();
		const registration = await subject.initiateRegistration('same', 'user');
		const authentication = await subject.initiateAuthentication('same');
		const passkey = await subject.initiateSignInWithPasskeyAuthentication('same');
		expect(challenges.size).toBe(3);
		expect(challenges.get('webauthn:registrationChallenge:same')).toBe(registration.challenge);
		expect(challenges.get('webauthn:authenticationChallenge:same')).toBe(authentication.challenge);
		expect(challenges.get('webauthn:passkeyChallenge:same')).toBe(passkey.challenge);
	});

	test('登録用チャレンジを追加認証やパスキー認証へ流用できない', async () => {
		const { subject, challenges } = setup();
		const registration = await subject.initiateRegistration('same', 'user');
		await expect(subject.verifyAuthentication('same', {} as any)).rejects.toBeDefined();
		await expect(subject.verifySignInWithPasskeyAuthentication('same', {} as any)).rejects.toBeDefined();
		expect(challenges.get('webauthn:registrationChallenge:same')).toBe(registration.challenge);
	});
});
