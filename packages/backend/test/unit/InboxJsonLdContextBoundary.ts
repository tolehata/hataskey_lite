/* SPDX-License-Identifier: AGPL-3.0-only */
import * as crypto from 'node:crypto';
import httpSignature from '@peertube/http-signature';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { JsonLd, JsonLdService } from '@/core/activitypub/JsonLdService.js';
import { CONTEXT } from '@/core/activitypub/misc/contexts.js';
import { InboxProcessorService } from '@/queue/processors/InboxProcessorService.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- Queue/auth dependencies are isolated; JSON-LD and RSA verification remain real. */

afterEach(() => vi.restoreAllMocks());

const author = { id: 'author', host: 'author.example', uri: 'https://author.example/users/author' };
const relay = { id: 'relay', host: 'relay.example', uri: 'https://relay.example/users/relay' };
const authorKeyId = `${author.uri}#main-key`;
const relayKeyId = `${relay.uri}#main-key`;
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });

function fixture(httpValid = false) {
	vi.spyOn(httpSignature, 'verifySignature').mockReturnValue(httpValid);
	const send = vi.fn(async () => ({ ok: true, json: async () => ({ '@context': { injected: 'https://context.example/injected' } }) }));
	const httpRequestService = { send } as any;
	const performActivity = vi.fn(async () => 'ok');
	const service = Object.assign(Object.create(InboxProcessorService.prototype), {
		meta: { enableStatsForFederatedInstances: false },
		utilityService: { toPuny: (host: string) => host, isFederationAllowedHost: () => true, extractDbHost: (uri: string) => new URL(uri).hostname },
		logger: { debug: vi.fn(), warn: vi.fn() },
		jsonLdService: new JsonLdService(httpRequestService),
		apDbResolverService: { getAuthUserFromKeyId: async (id: string) => ({ user: id === relayKeyId ? relay : author, key: { keyPem: publicKey } }) },
		apPersonService: { resolvePerson: vi.fn(async () => author) },
		apRequestChart: { inbox: vi.fn() }, federationChart: { inbox: vi.fn() },
		federatedInstanceService: { fetch: vi.fn(async () => null) },
		apInboxService: { performActivity },
	});
	const activity = () => ({
		'@context': [...CONTEXT, { label: 'https://extension.example/vocab#label' }],
		id: 'https://author.example/activities/create', type: 'Create', actor: author.uri,
		object: { id: 'https://author.example/notes/one', type: 'Note', attributedTo: author.uri, content: 'message', label: 'inline extension' },
	});
	const sign = async (value: any) => {
		const options = { type: 'RsaSignature2017', creator: authorKeyId, created: new Date().toISOString(), nonce: 'test-nonce' };
		const jsonLd = new JsonLd(httpRequestService);
		jsonLd.freeze();
		const data = await jsonLd.createVerifyData(value, options);
		return { ...value, signature: { ...options, signatureValue: crypto.sign('sha256', Buffer.from(data), keys.privateKey).toString('base64') } };
	};
	const process = (value: any, keyId = authorKeyId) => service.process({ data: { signature: { keyId }, activity: value } });
	return { send, performActivity, activity, sign, process };
}

describe('inbox LD signature context boundary', () => {
	test.each([
		'https://context.example/untrusted',
		['https://www.w3.org/ns/activitystreams', 'https://context.example/untrusted'],
	])('invalid HTTP and LD signatures cannot fetch context %j', async context => {
		const f = fixture();
		const value: any = f.activity();
		value['@context'] = context;
		value.signature = { type: 'RsaSignature2017', creator: authorKeyId, signatureValue: 'invalid' };
		await expect(f.process(value)).rejects.toThrow('failed to compact activity');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.performActivity).not.toHaveBeenCalled();
	});

	test('a nested remote context is also rejected before any fetch', async () => {
		const f = fixture();
		const value: any = f.activity();
		value.object['@context'] = 'https://context.example/nested';
		value.signature = { type: 'RsaSignature2017', creator: authorKeyId, signatureValue: 'invalid' };
		await expect(f.process(value)).rejects.toThrow('failed to compact activity');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.performActivity).not.toHaveBeenCalled();
	});

	test('invalid RSA signature with bundled and inline contexts is still rejected', async () => {
		const f = fixture();
		const value = await f.sign(f.activity());
		value.signature.signatureValue = crypto.randomBytes(256).toString('base64');
		await expect(f.process(value)).rejects.toThrow('LD-Signatureの検証に失敗しました');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.performActivity).not.toHaveBeenCalled();
	});

	test.each([false, true])('valid original LD signature remains accepted with relay HTTP validity %s', async httpValid => {
		const f = fixture(httpValid);
		const value = await f.sign(f.activity());
		expect(await f.process(value, relayKeyId)).toBe('ok');
		expect(f.performActivity).toHaveBeenCalledWith(author, expect.objectContaining({
			actor: author.uri,
			object: expect.objectContaining({ content: 'message', 'https://extension.example/vocab#label': 'inline extension' }),
		}));
		expect(f.send).not.toHaveBeenCalled();
	});

	test('a context hosted by the LD signer itself is fetched once and the relayed activity verifies', async () => {
		const f = fixture();
		const signerContext = 'https://author.example/schemas/litepub-0.1.jsonld';
		const value: any = f.activity();
		value['@context'] = [...value['@context'], signerContext];
		value.object.injected = 'from signer vocabulary';
		const options = { type: 'RsaSignature2017', creator: authorKeyId, created: new Date().toISOString(), nonce: 'test-nonce' };
		const signer = new JsonLd({ send: f.send } as any);
		signer.freeze('https://author.example');
		const data = await signer.createVerifyData(value, options);
		value.signature = { ...options, signatureValue: crypto.sign('sha256', Buffer.from(data), keys.privateKey).toString('base64') };
		f.send.mockClear();
		expect(await f.process(value, relayKeyId)).toBe('ok');
		expect(f.send).toHaveBeenCalledTimes(1);
		expect((f.send.mock.calls[0] as unknown as [string])[0]).toBe(signerContext);
		expect(f.performActivity).toHaveBeenCalledWith(author, expect.objectContaining({
			object: expect.objectContaining({ 'https://context.example/injected': 'from signer vocabulary' }),
		}));
	});

	test('a context on the relay origin is not fetched for an LD signature by someone else', async () => {
		const f = fixture(true);
		const value: any = f.activity();
		value['@context'] = [...CONTEXT, 'https://relay.example/schemas/litepub-0.1.jsonld'];
		value.signature = { type: 'RsaSignature2017', creator: authorKeyId, signatureValue: 'invalid' };
		await expect(f.process(value, relayKeyId)).rejects.toThrow('failed to compact activity');
		expect(f.send).not.toHaveBeenCalled();
	});

	test('the signer origin cannot be used to fan out more than four context fetches', async () => {
		const f = fixture();
		const value: any = f.activity();
		value['@context'] = [...CONTEXT, ...Array.from({ length: 5 }, (_, index) => `https://author.example/ctx/${index}`)];
		value.signature = { type: 'RsaSignature2017', creator: authorKeyId, signatureValue: 'invalid' };
		await expect(f.process(value)).rejects.toThrow('failed to compact activity');
		expect(f.send).toHaveBeenCalledTimes(4);
		expect(f.performActivity).not.toHaveBeenCalled();
	});

	test('matching valid HTTP signer keeps the existing direct delivery path', async () => {
		const f = fixture(true);
		const value = f.activity();
		expect(await f.process(value)).toBe('ok');
		expect(f.performActivity).toHaveBeenCalledWith(author, value);
		expect(f.send).not.toHaveBeenCalled();
	});
});
