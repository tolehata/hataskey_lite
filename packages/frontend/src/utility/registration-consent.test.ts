/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { registrationDocument, updateRegistrationConsent } from './registration-consent.js';

describe('registrationDocument', () => {
	it('omits absent documents and resolves configured HTTP documents', () => {
		expect(registrationDocument('  ', 'https://server.example')).toEqual({ configured: false });
		expect(registrationDocument('/terms', 'https://server.example')).toEqual({ configured: true, url: 'https://server.example/terms' });
		expect(registrationDocument(' https://docs.example/policy ', 'https://server.example')).toEqual({ configured: true, url: 'https://docs.example/policy' });
	});
	it.each(['javascript:alert(1)', 'data:text/html,terms', 'file:///terms', 'https://user:secret@docs.example', 'http://[invalid', 'https://docs.example/\npolicy', '\thttps://docs.example'])('blocks a configured unsafe document: %s', value => {
		expect(registrationDocument(value, 'https://server.example')).toEqual({ configured: true });
	});
});

describe('updateRegistrationConsent', () => {
	it('requires prior consent and document opening permission', () => {
		expect(updateRegistrationConsent([false, false], 1, true, true)).toEqual([false, false]);
		expect(updateRegistrationConsent([true, false], 1, true, false)).toEqual([true, false]);
		expect(updateRegistrationConsent([true, false], 1, true, true)).toEqual([true, true]);
	});
	it('revokes every later agreement while retaining earlier agreements', () => {
		expect(updateRegistrationConsent([true, true, true, true], 1, false, true)).toEqual([true, false, false, false]);
	});
});
