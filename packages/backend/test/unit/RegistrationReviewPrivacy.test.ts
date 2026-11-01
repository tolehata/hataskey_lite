/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { redactRegisteredEmail, redactRegistrationReviewText } from '@/misc/registration-review-privacy.js';

describe('registration review text privacy', () => {
	test.each([null, '', '参加したいです。連絡はSNSでお願いします。'])('preserves empty values and ordinary review text (%s)', value => {
		expect(redactRegistrationReviewText(value, null)).toBe(value);
	});

	test.each([
		'alice@example.test',
		'Alice+review@example.test',
		'mailto:alice@example.test',
		'"alice smith"@example.test',
		'alice@[192.0.2.1]',
		'利用者@例え.test',
	])('redacts an ordinary email address (%s)', address => {
		const input = `連絡先: ${address}。確認をお願いします。`;
		expect(input).toContain(address); // Positive secret-bearing fixture.
		const output = redactRegistrationReviewText(input, null);
		expect(output).toContain('［メールアドレス非公開］');
		expect(output).not.toContain(address);
	});

	test.each([
		'ａｌｉｃｅ＠ｅｘａｍｐｌｅ．ｔｅｓｔ',
		'ali\u200bce@exam\u2060ple.test',
		'ali\u0000ce@exam\u0007ple.test',
		'alice%40example.test',
		'alice&#64;example&#46;test',
		'alice&#x40;example&#x2E;test',
		'alice&commat;example&period;test',
		encodeURIComponent('ａｌｉｃｅ＠ｅｘａｍｐｌｅ．ｔｅｓｔ'),
	])('normalizes copied email spellings before hiding them (%s)', address => {
		expect(redactRegistrationReviewText(address, 'alice@example.test')).toBe('［メールアドレス非公開］');
	});

	test.each(['@alice', '@alice@social.example.test', 'https://social.example.test/@alice'])('preserves useful SNS identifiers and profile URLs (%s)', address => {
		expect(redactRegistrationReviewText(address, 'private@example.test')).toBe(address);
	});

	test('an SNS-shaped string containing the registered email is still hidden', () => {
		const output = redactRegistrationReviewText('@Alice@Example.Test', 'alice@example.test');
		expect(output).not.toMatch(/alice@example\.test/iu);
		expect(output).toContain('［メールアドレス非公開］');
	});

	test('hides multiple emails while preserving an unrelated SNS account', () => {
		const output = redactRegistrationReviewText('alice@example.test / other@another.test / @alice@social.example.test', 'alice@example.test');
		expect(output).toBe('［メールアドレス非公開］ / ［メールアドレス非公開］ / @alice@social.example.test');
	});

	test('a percent sign elsewhere does not disable redaction of an encoded address', () => {
		const output = redactRegistrationReviewText('100% 確認済み: alice%40example.test', 'alice@example.test');
		expect(output).toContain('100% 確認済み:');
		expect(output).not.toContain('alice');
		expect(output).toContain('［メールアドレス非公開］');
	});

	test('malformed URI text does not throw or prevent plain email removal', () => {
		expect(() => redactRegistrationReviewText('%broken alice@example.test', null)).not.toThrow();
		expect(redactRegistrationReviewText('%broken alice@example.test', null)).not.toContain('alice@example.test');
	});

	test('staff display names keep "name@status" text but still hide the registered email', () => {
		const name = '旗茶@審査中 ｜ ａｂｃ';
		expect(redactRegistrationReviewText(name, 'alice@example.test')).toContain('［メールアドレス非公開］'); // Positive control: the generic rule hides it.
		expect(redactRegisteredEmail(name, 'alice@example.test')).toBe(name);
		expect(redactRegisteredEmail(name, null)).toBe(name);
		expect(redactRegisteredEmail(null, 'alice@example.test')).toBeNull();
		expect(redactRegisteredEmail('ａｌｉｃｅ＠ｅｘａｍｐｌｅ．ｔｅｓｔ さん', 'alice@example.test')).toBe('［メールアドレス非公開］ さん');
	});

	test('the registered email is matched literally even with regular expression characters', () => {
		expect(redactRegistrationReviewText('a+b@example.test / @ab@social.example.test', 'a+b@example.test'))
			.toBe('［メールアドレス非公開］ / @ab@social.example.test');
	});
});
