/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import {
	findLegacyLogError,
	normalizeLogAttributes,
	normalizeLogValue,
	serializeLogError,
} from '@/logging/LogNormalizer.js';

describe('LogNormalizer', () => {
	test('normalizes common non-JSON values', () => {
		expect(normalizeLogAttributes({
			date: new Date('2025-01-02T03:04:05.678Z'),
			bigint: 123n,
			infinity: Infinity,
			undefinedValue: undefined,
		})).toEqual({
			bigint: '123',
			date: '2025-01-02T03:04:05.678Z',
			infinity: 'Infinity',
			undefinedValue: '[Unsupported]: undefined',
		});
	});

	test('normalizes a standalone body value with the same redaction and size rules', () => {
		const normalized = normalizeLogValue({ token: 'secret', text: 'x'.repeat(100) }, { limits: { maxBytes: 256 } });

		expect(normalized).toMatchObject({ token: '[REDACTED]' });
		expect(Buffer.byteLength(JSON.stringify(normalized), 'utf8')).toBeLessThanOrEqual(256);
	});

	test('marks unsupported objects and invalid dates without throwing', () => {
		expect(normalizeLogAttributes({
			map: new Map([['key', 'value']]),
			invalidDate: new Date('invalid'),
		})).toEqual({
			invalidDate: '[Unsupported]: object access failed',
			map: '[Unsupported]: object',
		});
	});

	test('preserves __proto__ as a normal attribute key', () => {
		const value = JSON.parse('{"__proto__":{"nested":"value"},"large":"' + 'x'.repeat(100) + '"}') as Record<string, unknown>;
		const normalized = normalizeLogAttributes(value, { limits: { maxBytes: 64 } });

		expect(Object.keys(normalized)).toContain('__proto__');
		expect(normalized['__proto__']).toEqual({ nested: 'value' });
		expect(Object.getPrototypeOf(normalized)).toBeNull();
	});

	test('redacts sensitive fields recursively, including the Misskey i token', () => {
		expect(normalizeLogAttributes({
			i: 'top-level-token',
			request: {
				Authorization: 'bearer-token',
				captcha: 'captcha-value',
				password: 'password',
				nested: [{ api_key: 'api-key' }],
			},
			visible: 'value',
		})).toEqual({
			i: '[REDACTED]',
			request: {
				Authorization: '[REDACTED]',
				captcha: '[REDACTED]',
				password: '[REDACTED]',
				nested: [{ api_key: '[REDACTED]' }],
			},
			visible: 'value',
		});
	});

	test.each(['standard', 'detailed'] as const)('always redacts optional application contacts in the %s profile', profile => {
		const sentinel = 'sns-private-sentinel-7d1a@contacts.invalid';
		const options = { profile };
		// 陽性対照: 入力全体の省略・切り詰めで検査が空振りしていないことを確認する。
		expect(JSON.stringify(normalizeLogValue({ visible: sentinel }, options))).toContain(sentinel);
		expect(JSON.stringify(normalizeLogAttributes({ visible: sentinel }, options))).toContain(sentinel);

		const keys = ['additionalContacts', 'ADDITIONAL_CONTACTS', 'Additional-Contacts', 'additional.contacts', 'additional contacts'];
		for (const key of keys) {
			const payload = { request: { [key]: sentinel }, response: [{ id: 'application', [key]: { sns: sentinel } }] };
			for (const normalize of [normalizeLogAttributes, normalizeLogValue]) {
				const normalized = normalize(payload, options);
				expect(normalized).toEqual({ request: { [key]: '[REDACTED]' }, response: [{ id: 'application', [key]: '[REDACTED]' }] });
				expect(JSON.stringify(normalized)).not.toContain(sentinel);
				// カスタム秘匿条件でもこの申請専用欄は解除できない。
				expect(normalize(payload, { ...options, redactor: () => false })).toEqual(normalized);
			}
		}
		const error = new Error('fixed failure', { cause: { additionalContacts: sentinel } });
		expect(serializeLogError(error, options)).toMatchObject({ cause: { additionalContacts: '[REDACTED]' } });
		expect(JSON.stringify(serializeLogError(error, options))).not.toContain(sentinel);
	});

	test('redacts optional contacts before reading their value', () => {
		let reads = 0;
		const payload = { get additionalContacts() { reads++; return 'must-not-be-read'; } };
		expect(normalizeLogValue(payload, { redactor: () => false })).toEqual({ additionalContacts: '[REDACTED]' });
		expect(reads).toBe(0);
	});

	test('keeps cycles finite and marks depth and entry truncation', () => {
		const cycle: Record<string, unknown> = { value: 'ok' };
		cycle.self = cycle;

		expect(normalizeLogAttributes({
			cycle,
			deep: { level1: { level2: { level3: 'value' } } },
		}, {
			limits: { maxDepth: 2, maxEntries: 10 },
		})).toEqual({
			cycle: { self: '[Circular]', value: 'ok' },
			deep: { level1: '[Truncated]' },
		});
		expect(normalizeLogAttributes({ entries: { a: 1, b: 2, c: 3 } }, { limits: { maxEntries: 2 } })).toEqual({
			entries: { a: 1, b: 2, '[Truncated]': '[Truncated]' },
		});
	});

	test('uses the detailed profile while retaining the redaction policy', () => {
		const value = { level1: { level2: { level3: { level4: 'value' } } }, token: 'secret' };

		expect(normalizeLogAttributes(value, { limits: { maxDepth: 3 } })).toMatchObject({ level1: { level2: { level3: '[Truncated]' } }, token: '[REDACTED]' });
		expect(normalizeLogAttributes(value, { profile: 'detailed' })).toEqual({
			level1: { level2: { level3: { level4: 'value' } } },
			token: '[REDACTED]',
		});
	});

	test('keeps normalized attributes within the configured byte limit', () => {
		const normalized = normalizeLogAttributes({ first: 'a'.repeat(100), second: 'b'.repeat(100) }, { limits: { maxBytes: 32 } });

		expect(Buffer.byteLength(JSON.stringify(normalized), 'utf8')).toBeLessThanOrEqual(32);
	});

	test('truncates long multibyte strings without splitting characters', () => {
		const normalized = normalizeLogAttributes({ value: '😀'.repeat(100) }, { limits: { maxStringBytes: 16, maxBytes: 100 } });

		expect(Buffer.byteLength(JSON.stringify(normalized.value), 'utf8')).toBeLessThanOrEqual(16);
		expect(JSON.stringify(normalized.value)).not.toContain('�');
	});

	test('serializes Error and its cause consistently', () => {
		const cause = new Error('root cause');
		const error = new TypeError('outer error', { cause });

		expect(serializeLogError(error)).toMatchObject({
			type: 'TypeError',
			message: 'outer error',
			cause: {
				type: 'Error',
				message: 'root cause',
			},
		});
	});

	test('keeps serialized Error output within its byte limit', () => {
		const serialized = serializeLogError(new Error('a long message'), { limits: { maxBytes: 32 } });

		expect(serialized).toBeDefined();
		expect(Buffer.byteLength(JSON.stringify(serialized), 'utf8')).toBeLessThanOrEqual(32);
		expect(serializeLogError(new Error('message'), { limits: { maxBytes: 20 } })).toBeUndefined();
	});

	test('finds Error values in legacy data', () => {
		const error = new Error('legacy');

		expect(findLegacyLogError({ e: error })).toBe(error);
		expect(findLegacyLogError({ stack: 'not-an-error' })).toBeUndefined();
	});
});
