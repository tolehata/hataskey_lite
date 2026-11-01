/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as sdk from '@concrnt/client';
import { ComputeCCID, LoadKey, Sign, ValidateSignature } from '@concrnt/client';
import {
	CONCRNT_REQUIRED_ENDPOINTS, ConcrntApi, ConcrntProtocolError, createAnonymousConcrntApi, createConcrntApi,
	normalizeConcrntDomain, parseConcrntSubkey, probeConcrntDomain, verifyConcrntCredential,
} from './protocol.js';
import type { Document, Server, SignedDocument } from '@concrnt/client';

vi.mock('@concrnt/client', async importOriginal => {
	const actual = await importOriginal<typeof import('@concrnt/client')>();
	return { ...actual, LoadSubKey: vi.fn(actual.LoadSubKey) };
});

// Public, deterministic test scalars. Never contact a server or use a real account.
const master = '0'.repeat(63) + '1';
const subkey = '0'.repeat(63) + '2';
const ccid = ComputeCCID(LoadKey(master)!.publickey);
const domain = 'social.example';
const secret = `concrnt-subkey ${subkey} ${ccid}@${domain}`;
const credential = parseConcrntSubkey(secret);
const rootURI = `cckv://${ccid}`;
const keyURI = `${rootURI}/keys/${credential.ckid}`;
const messageURI = `${rootURI}/world/main/messages/fixture`;
const csid = 'ccs1w508d6qejxtdg4y5r3zarvary0c5xw7kp9c78e';

function server(): Server & { softwareInfo: { version: string } } {
	return {
		version: '2.0', domain, csid, layer: 'test',
		softwareInfo: { version: 'unknown' },
		endpoints: {
			'net.concrnt.core.resolve': '/api/v2/resolve?uri={uri}',
			'net.concrnt.core.query': '/api/v2/query{?prefix,since,until,limit,order}',
			'net.concrnt.core.commit': '/api/v2/commit',
			'net.concrnt.core.associations': '/api/v2/associations{?uri,until,limit}',
			'net.concrnt.core.association-counts': '/api/v2/association-counts{?uri}',
			'net.concrnt.world.register': '/api/v2/register',
			'net.concrnt.world.timeline.recent': '/api/v2/timeline/recent{?uris,until,limit}',
			'net.concrnt.storage.presign': '/storage/presign',
		},
	};
}

function signed(document: Document<unknown>, uri: string, signingKey = master): SignedDocument {
	const text = JSON.stringify(document);
	return { cckv: uri, ccfs: `ccfs://${ccid}/concrnt/fixture`, document: text, proof: { type: 'concrnt-ecrecover-direct', signature: Sign(signingKey, text) } };
}

function entity(home = domain): SignedDocument {
	return signed({ kind: 'entity', author: ccid, schema: 'https://schema.concrnt.net/entity.json', value: { domain: home, alias: '', alias_proof_type: '' }, createdAt: new Date('2026-10-20T00:00:00Z') }, rootURI);
}

function enact(schema = 'https://schema.concrnt.net/subkey.json', signingKey = master): SignedDocument {
	return signed({ kind: 'record', author: ccid, key: keyURI, schema, value: { ckid: credential.ckid }, createdAt: new Date('2026-10-20T00:00:00Z') }, keyURI, signingKey);
}

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function fixture(options: { server?: Server; entity?: SignedDocument; enact?: SignedDocument; registration?: unknown } = {}) {
	const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = new URL(String(input));
		if (url.hostname !== domain) throw new Error('Fixture forbids external communication');
		if (url.pathname === '/.well-known/concrnt') return json(options.server ?? server());
		if (url.pathname === '/api/v2/resolve') {
			const uri = url.searchParams.get('uri');
			if (uri === rootURI) return json(options.entity ?? entity());
			if (uri === keyURI) return json(options.enact ?? enact());
			return json(signed({ kind: 'record', key: messageURI, author: ccid, schema: 'test', value: {}, createdAt: new Date(0) }, messageURI));
		}
		if (url.pathname === '/api/v2/register') return json(options.registration ?? { status: 'ok', content: { ccid, meta: {} } });
		if (url.pathname === '/api/v2/commit') {
			const submitted = JSON.parse(String(init?.body));
			return json({ ...submitted, cckv: messageURI, ccfs: `ccfs://${ccid}/concrnt/result` });
		}
		if (url.pathname === '/data') return json({ view: new Headers(init?.headers).has('authorization') ? 'member' : 'guest' });
		throw new Error('Unexpected fixture route');
	});
	vi.stubGlobal('fetch', fetcher);
	return fetcher;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('接続情報の検証', () => {
	test.each([' ', '\n', '\u3000'])('公式のサブキーコピー形式の末尾区切り %s を正規化する', separator => {
		const input = `${secret}${separator}-`;
		expect(sdk.LoadSubKey(input)?.ckid).toBe(credential.ckid);
		expect(parseConcrntSubkey(input, domain)).toEqual(credential);
	});

	test.each([' suffix', ' - -', ' --', ' -foo', ' - suffix'])('公式コピー形式以外の末尾を拒否する: %s', suffix => {
		expect(() => parseConcrntSubkey(`${secret}${suffix}`, domain)).toThrow(expect.objectContaining({ code: 'invalid-input', inputIssue: 'export-format' }));
	});

	test.each(['\u00a0', '\u3000'])('SDKが受理するUnicode空白区切り %s を正規化する', separator => {
		const input = secret.replaceAll(' ', separator);
		expect(sdk.LoadSubKey(input)?.ckid).toBe(credential.ckid);
		expect(parseConcrntSubkey(input, domain)).toEqual(credential);
	});

	test.each([
		['export-format', `prefix ${secret}`, domain],
		['owner-id', secret.replace(ccid, `${ccid.slice(0, -1)}q`), domain],
		['private-key', secret.replace(subkey, '0'.repeat(64)), domain],
		['private-key', secret.replace(subkey, 'f'.repeat(64)), domain],
		['domain', secret.replace(domain, 'social.example/path'), domain],
		['domain', secret, 'http://social.example'],
		['domain-mismatch', secret, 'other.example'],
		['master-key', secret.replace(subkey, master), domain],
	])('入力エラー %s を値を含まない理由で区別する', (inputIssue, input, expectedDomain) => {
		let caught: unknown;
		try { parseConcrntSubkey(input, expectedDomain); } catch (error) { caught = error; }
		expect(caught).toMatchObject({ code: 'invalid-input', inputIssue });
		const serialized = `${String(caught)}${JSON.stringify(caught)}`;
		for (const privateValue of [input, subkey, master, ccid, expectedDomain]) expect(serialized).not.toContain(privateValue);
	});

	test('SDKの鍵導出失敗をコピー形式の不正や主鍵として扱わない', () => {
		const load = vi.mocked(sdk.LoadSubKey);
		for (const failure of [null, new Error(secret)]) {
			if (failure instanceof Error) load.mockImplementationOnce(() => { throw failure; });
			else load.mockReturnValueOnce(null);
			let caught: unknown;
			try { parseConcrntSubkey(secret, domain); } catch (error) { caught = error; }
			expect(caught).toMatchObject({ code: 'invalid-input', inputIssue: 'key-derivation' });
			expect(`${String(caught)}${JSON.stringify(caught)}`).not.toContain(secret);
		}
	});

	test('HTTPSのDNS名を正規化し、正しいサブキーを読み取る', () => {
		expect(normalizeConcrntDomain(' https://SOCIAL.EXAMPLE/ ')).toBe(domain);
		expect(parseConcrntSubkey(`  ${secret}\n`, domain)).toEqual(credential);
		expect(credential.ccid).toBe('con1w508d6qejxtdg4y5r3zarvary0c5xw7ktdsum3');
	});

	test.each(['http://social.example', 'https://user:pass@social.example', 'social.example:8443', 'social.example/path', 'social.example?x', 'social.example#x', 'social.example\\@evil.example', 'localhost', 'test.local', '127.0.0.1', '2130706433', '[::1]', 'social.example.'])('不正な接続先を拒否: %s', input => {
		expect(() => normalizeConcrntDomain(input)).toThrow(expect.objectContaining({ code: 'invalid-input' }));
	});

	test.each(['', ' -'])('末尾 %s でも前後の混入、所有者チェックサム、秘密鍵範囲、主鍵、ドメイン不一致を拒否する', suffix => {
		for (const input of [
			`prefix ${secret}`, `${secret} suffix`, secret.replace(ccid, `${ccid.slice(0, -1)}q`),
			secret.replace(subkey, '0'.repeat(64)), secret.replace(subkey, 'f'.repeat(64)),
			secret.replace(subkey, master),
		]) expect(() => parseConcrntSubkey(`${input}${suffix}`)).toThrow(expect.objectContaining({ code: 'invalid-input' }));
		expect(() => parseConcrntSubkey(`${secret}${suffix}`, 'other.example')).toThrow(expect.objectContaining({ code: 'invalid-input' }));
		expect(() => createConcrntApi({ ...credential, ckid: ccid })).toThrow(expect.objectContaining({ code: 'invalid-input' }));
	});
});

describe('匿名のドメイン確認', () => {
	test('公開情報のHTTP拒否を認証情報なしのserver段階として返す', async () => {
		const fetcher = fixture();
		fetcher.mockResolvedValueOnce(json({ error: 'browser_signature_banned' }, 403));
		await expect(probeConcrntDomain(domain)).rejects.toMatchObject({ code: 'auth', status: 403, phase: 'server' });
		expect(fetcher).toHaveBeenCalledOnce();
		expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('authorization')).toBe(false);
	});

	test('全機能descriptorを確認し、資格情報は送らない', async () => {
		const fetcher = fixture();
		await expect(probeConcrntDomain(domain)).resolves.toMatchObject({ domain, csid });
		expect(fetcher).toHaveBeenCalledOnce();
		const [, init] = fetcher.mock.calls[0];
		expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
		expect(new Headers(init?.headers).has('authorization')).toBe(false);
	});

	test('確認済みdescriptorに表示用nicknameとlogoだけを保持する', async () => {
		const fetcher = fixture({ server: { ...server(), meta: { nickname: '交流の場所', logo: 'https://cdn.example/server.png', other: 'discard-this-field' } } });
		const descriptor = await probeConcrntDomain(domain);
		expect(descriptor.meta).toEqual({ nickname: '交流の場所', logo: 'https://cdn.example/server.png' });
		expect(Object.isFrozen(descriptor.meta)).toBe(true);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	test.each(CONCRNT_REQUIRED_ENDPOINTS)('必須機能 %s がなければ接続成功にしない', async missing => {
		const desc = server();
		delete desc.endpoints[missing];
		fixture({ server: desc });
		await expect(probeConcrntDomain(domain)).rejects.toMatchObject({ code: 'capability' });
	});

	test('v1、domain不一致、不正CSID、別originのendpointを拒否する', async () => {
		for (const desc of [
			{ ...server(), version: '1.0' }, { ...server(), domain: 'other.example' },
			{ ...server(), csid: `${csid.slice(0, -1)}q` },
			{ ...server(), endpoints: { ...server().endpoints, 'net.concrnt.core.resolve': 'https://other.example/resolve?uri={uri}' } },
		]) {
			fixture({ server: desc });
			await expect(probeConcrntDomain(domain)).rejects.toMatchObject({ code: 'capability' });
		}
	});
});

describe('署名と本人確認', () => {
	test.each([undefined, null, [], { nickname: {}, logo: 'http://cdn.example/icon.png' }])('任意の表示metadata不備で正常な本人確認を失敗させない: %j', async meta => {
		const fetcher = fixture({ server: { ...server(), meta } });
		const api = await verifyConcrntCredential(credential);
		const count = fetcher.mock.calls.length;
		expect((await api.getServer(domain, { cache: 'cache-only' })).meta).toEqual({ nickname: domain });
		expect(fetcher).toHaveBeenCalledTimes(count);
		expect(api.self?.document).toBe(entity().document);
		api.dispose();
	});

	test('本人確認後の表示用descriptor取得は通信を増やさない', async () => {
		const fetcher = fixture({ server: { ...server(), meta: { nickname: '交流の場所', logo: 'https://cdn.example/server.png' } } });
		const api = await verifyConcrntCredential(credential);
		const count = fetcher.mock.calls.length;
		expect((await api.getServer(domain, { cache: 'cache-only' })).meta).toEqual({ nickname: '交流の場所', logo: 'https://cdn.example/server.png' });
		expect(fetcher).toHaveBeenCalledTimes(count);
		api.dispose();
	});

	test.each([
		{ missing: ['cckv'] }, { missing: ['ccfs'] }, { missing: ['cckv', 'ccfs'] },
	])('v2で省略可能なURIメタデータ $missing なしでも署名本文を検証する', async ({ missing }) => {
		const self = entity();
		const key = enact();
		for (const sd of [self, key]) for (const field of missing) Reflect.deleteProperty(sd, field);
		fixture({ entity: self, enact: key });
		const api = await verifyConcrntCredential(credential);
		expect(api.self).toEqual(self);
		await expect(api.getEntity(ccid)).resolves.toMatchObject({ kind: 'entity', author: ccid, value: { domain } });
		api.dispose();
	});

	test('本人確認のラップでも入力エラーの固定理由を保持する', async () => {
		vi.spyOn(ConcrntApi.prototype, 'getServer').mockRejectedValue(new ConcrntProtocolError('invalid-input', undefined, undefined, 'domain'));
		await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'invalid-input', phase: 'server', inputIssue: 'domain' });
	});

	test.each(['identity', 'subkey'])('URIメタデータがあっても %s の識別子不一致や型不正を拒否する', async phase => {
		for (const [field, value, code] of [['cckv', `${rootURI}/other`, 'auth'], ['cckv', null, 'capability'], ['ccfs', null, 'capability']] as const) {
			const sd = phase === 'identity' ? entity() : enact();
			Reflect.set(sd, field, value);
			const fetcher = fixture(phase === 'identity' ? { entity: sd } : { enact: sd });
			await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code, phase });
			expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/v2/register'))).toBe(false);
		}
	});

	test('URIメタデータ省略時も署名・所属ドメイン・サブキー文書の内容を検証する', async () => {
		const tampered = entity();
		tampered.proof.signature = '0'.repeat(130);
		const changedKey = JSON.parse(enact().document) as Document<{ ckid: string }>;
		changedKey.value.ckid = ccid;
		for (const [phase, sd] of [['identity', tampered], ['identity', entity('other.example')], ['subkey', enact(undefined, subkey)], ['subkey', signed(changedKey, keyURI)]] as const) {
			Reflect.deleteProperty(sd, 'cckv');
			Reflect.deleteProperty(sd, 'ccfs');
			const fetcher = fixture(phase === 'identity' ? { entity: sd } : { enact: sd });
			await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'auth', phase });
			expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/v2/register'))).toBe(false);
		}
	});

	test('本人確認中の失敗段階を公開情報・entity・subkey・登録情報で区別する', async () => {
		for (const phase of ['server', 'identity', 'subkey', 'registration']) {
			const fetcher = fixture();
			const fixtureFetch = fetcher.getMockImplementation()!;
			fetcher.mockImplementation(async (input, init) => {
				const url = new URL(String(input));
				const matches = phase === 'server' ? url.pathname === '/.well-known/concrnt'
					: phase === 'identity' ? url.searchParams.get('uri') === rootURI
						: phase === 'subkey' ? url.searchParams.get('uri') === keyURI : url.pathname === '/api/v2/register';
				return matches ? json({ error: secret }, 503) : fixtureFetch(input, init);
			});
			await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'network', status: 503, phase });
		}
	});

	test('主鍵署名entity/enactを確認してから、正しいJWTで本人専用registerを読む', async () => {
		const fetcher = fixture();
		const api = await verifyConcrntCredential(credential);
		const register = fetcher.mock.calls.find(([url]) => String(url).endsWith('/api/v2/register'))!;
		const token = new Headers(register[1]?.headers).get('authorization')!.slice(7);
		const [headerPart, claimPart, signaturePart] = token.split('.');
		const decode = (part: string) => atob(part.replaceAll('-', '+').replaceAll('_', '/'));
		expect(JSON.parse(decode(headerPart))).toMatchObject({ alg: 'CONCRNT', typ: 'JWT', kid: keyURI });
		expect(JSON.parse(decode(claimPart))).toMatchObject({ iss: `${rootURI}@${domain}`, aud: domain, sub: 'concrnt' });
		const hex = [...decode(signaturePart)].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
		expect(ValidateSignature(`${headerPart}.${claimPart}`, hex, credential.ckid)).toBe(true);
		for (const [url, init] of fetcher.mock.calls.filter(([url]) => !String(url).endsWith('/api/v2/register'))) {
			expect(new Headers(init?.headers).has('authorization'), String(url)).toBe(false);
		}
		expect(api.self?.cckv).toBe(rootURI);
		api.dispose();
	});

	test('公開entityの所属domainが違えばJWTを送らない', async () => {
		const fetcher = fixture({ entity: entity('other.example') });
		await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'auth' });
		expect(fetcher.mock.calls.some(([, init]) => new Headers(init?.headers).has('authorization'))).toBe(false);
	});

	test('subkey署名enactと失効済みキーを認証成功にしない', async () => {
		for (const entry of [enact(undefined, subkey), enact('https://schema.concrnt.net/revoked-subkey.json')]) {
			const fetcher = fixture({ enact: entry });
			await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'auth' });
			expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/v2/register'))).toBe(false);
		}
	});

	test('HTTP成功でもregisterのstatus/CCIDが一致しなければ拒否する', async () => {
		for (const registration of [{ status: 'ok', content: { ccid: 'other' } }, { status: 'error', content: { ccid } }]) {
			fixture({ registration });
			await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'auth' });
		}
	});

	test('署名失敗を匿名通信へ落とさず、例外内の秘密情報もログに出さない', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		vi.spyOn(api.authProvider, 'signSub').mockRejectedValue(new Error(secret));
		await expect(api.fetchWithCredential(domain, '/data')).rejects.toMatchObject({ code: 'auth' });
		expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/data'))).toBe(false);
		expect(console.error).not.toHaveBeenCalled();
		expect(console.log).not.toHaveBeenCalled();
		api.dispose();
	});
});

describe('通信とキャンセルの境界', () => {
	test('別origin/プロトコル相対URLと外部から渡された認証ヘッダーを拒否する', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		for (const path of ['https://other.example/data', '//other.example/data', '/\\other.example/data']) {
			await expect(api.fetchWithCredential(domain, path)).rejects.toMatchObject({ code: 'capability' });
		}
		await expect(api.fetchHost(domain, '/data', { headers: { Authorization: secret } })).rejects.toMatchObject({ code: 'invalid-input' });
		expect(fetcher.mock.calls.every(([url]) => new URL(String(url)).pathname === '/.well-known/concrnt')).toBe(true);
		api.dispose();
	});

	test('匿名読取は認証キャッシュと合流せず、匿名クライアントでは書き込めない', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		const anonymous = createAnonymousConcrntApi(domain);
		expect(anonymous.cache).not.toBe(api.cache);
		await expect(api.fetchWithCache(domain, '/data', 'same')).resolves.toEqual({ view: 'member' });
		await expect(api.fetchWithCache(domain, '/data', 'same', { auth: 'no-auth', cache: 'force-cache' })).rejects.toMatchObject({ code: 'network' });
		await expect(api.fetchWithCache(domain, '/data', 'same', { auth: 'no-auth' })).resolves.toEqual({ view: 'guest' });
		await expect(anonymous.fetchWithCache(domain, '/data', 'same')).resolves.toEqual({ view: 'guest' });
		await expect(anonymous.fetchHost(domain, '/data', { method: 'POST' })).rejects.toMatchObject({ code: 'auth' });
		expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/data'))).toHaveLength(3);
		api.dispose(); anonymous.dispose();
	});

	test('中止済みのAPIはキャッシュにも通信にも戻らない', async () => {
		const fetcher = fixture();
		const controller = new AbortController();
		const api = createConcrntApi(credential, controller.signal);
		await api.fetchWithCache(domain, '/data', 'same');
		controller.abort();
		const before = fetcher.mock.calls.length;
		await expect(api.fetchWithCache(domain, '/data', 'same', { cache: 'force-cache' })).rejects.toMatchObject({ code: 'aborted' });
		await expect(api.getServer(domain)).rejects.toMatchObject({ code: 'aborted' });
		expect(fetcher).toHaveBeenCalledTimes(before);
		expect(api.authProvider.canSignSub()).toBe(false);
		expect(api.tokens).toEqual({});
	});

	test('進行中のfetchを中止し、遅れて成功しても認証済みに戻らない', async () => {
		const controller = new AbortController();
		let release!: (response: Response) => void;
		let ready!: () => void;
		const started = new Promise<void>(resolve => { ready = resolve; });
		const fetcher = vi.fn((_input: unknown, init: RequestInit) => {
			expect(init.signal).toBeDefined();
			ready();
			return new Promise<Response>(resolve => { release = resolve; });
		});
		vi.stubGlobal('fetch', fetcher);
		const result = verifyConcrntCredential(credential, controller.signal);
		await started;
		controller.abort();
		release(json(server()));
		await expect(result).rejects.toMatchObject({ code: 'aborted' });
		expect(fetcher).toHaveBeenCalledOnce();
	});

	test('署名待ちの間に中止したら、生成済みJWTを送信しない', async () => {
		const fetcher = fixture();
		const controller = new AbortController();
		const api = createConcrntApi(credential, controller.signal);
		let release!: (result: [string, string]) => void;
		let ready!: () => void;
		const started = new Promise<void>(resolve => { ready = resolve; });
		vi.spyOn(api.authProvider, 'signSub').mockImplementation(() => { ready(); return new Promise(resolve => { release = resolve; }); });
		const result = api.fetchWithCredential(domain, '/data');
		await started;
		controller.abort();
		release(['0'.repeat(130), credential.ckid]);
		await expect(result).rejects.toMatchObject({ code: 'aborted' });
		expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/data'))).toBe(false);
		expect(api.tokens).toEqual({});
	});

	test.each([[403, 'auth'], [404, 'network'], [503, 'network']] as const)('HTTP %s を安全な %s エラーへ分ける', async (status, code) => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		await api.getServer(domain);
		fetcher.mockResolvedValueOnce(json({ error: secret }, status));
		const error = await api.fetchHost(domain, '/data').catch(value => value);
		expect(error).toMatchObject({ code, status });
		expect(String(error)).not.toContain(secret);
		expect(console.error).not.toHaveBeenCalled();
		api.dispose();
	});
});

describe('書込み・ページングの結果', () => {
	test('自分の本文を自homeへ一度だけ送信し、SDKの本文ログを出さない', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		const doc: Document<unknown> = { kind: 'record', key: messageURI, author: ccid, schema: 'test', value: { text: 'sample' }, createdAt: new Date(0) };
		const receipt = await api.commit(doc, domain);
		expect(receipt.document).toBe(JSON.stringify(doc));
		const sends = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
		expect(sends).toHaveLength(1);
		expect(sends[0][0]).toBe(`https://${domain}/api/v2/commit`);
		const submitted = JSON.parse(String(sends[0][1]?.body));
		expect(ValidateSignature(submitted.document, submitted.proof.signature, credential.ckid)).toBe(true);
		expect(submitted.proof.key).toBe(keyURI);
		expect(submitted.references[rootURI].cckv).toBe(rootURI);
		expect(new Headers(sends[0][1]?.headers).has('authorization')).toBe(false);
		expect(console.log).not.toHaveBeenCalled();
		api.dispose();
	});

	test('本文の送信先違いと範囲削除を送信前に拒否する', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		const doc: Document<unknown> = { kind: 'record', key: messageURI, author: ccid, schema: 'test', value: {}, createdAt: new Date(0) };
		await expect(api.commit(doc, 'other.example')).rejects.toMatchObject({ code: 'invalid-input' });
		await expect(api.delete(`${rootURI}/*`)).rejects.toMatchObject({ code: 'invalid-input' });
		expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
		api.dispose();
	});

	test('2ページ目のエラーと繰り返すカーソルを部分成功で隠さない', async () => {
		const api = createConcrntApi(credential);
		const sd = enact();
		const query = vi.spyOn(api, 'query');
		query.mockResolvedValueOnce({ items: [sd], next: 'cursor', prev: null }).mockRejectedValueOnce(new Error('second page'));
		await expect(api.queryAll({ prefix: rootURI })).rejects.toThrow('second page');
		query.mockResolvedValue({ items: [sd], next: 'cursor', prev: null });
		await expect(api.queryAll({ prefix: rootURI })).rejects.toMatchObject({ code: 'capability' });
		api.dispose();
	});

	test('一覧ではccfsのない項目を重複扱いで黙って落とさない', async () => {
		const api = createConcrntApi(credential);
		const sd = enact();
		Reflect.deleteProperty(sd, 'ccfs');
		vi.spyOn(api, 'query').mockResolvedValue({ items: [sd], next: null, prev: null });
		await expect(api.queryAll({ prefix: rootURI })).rejects.toMatchObject({ code: 'capability' });
		api.dispose();
	});

	test('repositoryの直接fetch経路とアカウント登録変更を許可しない', async () => {
		const fetcher = fixture();
		const api = createConcrntApi(credential);
		await expect(api.dumpRepository()).rejects.toMatchObject({ code: 'capability' });
		await expect(api.unregister()).rejects.toMatchObject({ code: 'capability' });
		expect(fetcher).not.toHaveBeenCalled();
		api.dispose();
	});
});

describe('コミュニティのURI', () => {
	test('サーバーのドメインが持ち主のコミュニティTLを読み、正規形でない持ち主は拒否する', async () => {
		const fetcher = fixture();
		const api = createAnonymousConcrntApi(domain);
		await expect(api.getDocument(`cckv://${domain}/concrnt.world/communities/flowers`)).resolves.toMatchObject({ kind: 'record' });
		const resolved = fetcher.mock.calls.map(([input]) => new URL(String(input))).find(url => url.pathname === '/api/v2/resolve');
		expect(resolved?.searchParams.get('uri')).toBe(`cckv://${domain}/concrnt.world/communities/flowers`);
		for (const owner of [domain.toUpperCase(), 'localhost', '127.0.0.1', 'not_a_domain']) {
			await expect(api.getDocument(`cckv://${owner}/concrnt.world/communities/flowers`)).rejects.toMatchObject({ code: 'invalid-input' });
		}
		api.dispose();
	});
});

describe('他のユーザーのentity', () => {
	function unsigned(author = ccid, home = domain): SignedDocument {
		const text = JSON.stringify({ kind: 'entity', key: rootURI, value: { domain: home }, author, schema: 'https://schema.concrnt.net/entity.json', createdAt: '2025-06-02T17:52:00.976672Z' });
		return { document: text, proof: { type: 'none' } } as unknown as SignedDocument;
	}

	test('v1から移行した署名なしのentityでも所属サーバーを引ける', async () => {
		fixture({ entity: unsigned() });
		const api = createAnonymousConcrntApi(domain);
		await expect(api.getEntity(ccid)).resolves.toMatchObject({ kind: 'entity', author: ccid, value: { domain } });
		await expect(api.getDocument(messageURI)).resolves.toMatchObject({ key: messageURI, author: ccid });
		api.dispose();
	});

	test('署名なしでも作者が違えば拒否し、付いている署名は検証する', async () => {
		const forged = entity();
		forged.proof.signature = '0'.repeat(130);
		for (const sd of [unsigned('con13yvjv8q96evepw2derwzgcz7yrmp984ldq0exp'), forged]) {
			fixture({ entity: sd });
			const api = createAnonymousConcrntApi(domain);
			await expect(api.getEntity(ccid)).rejects.toMatchObject({ code: 'auth' });
			api.dispose();
		}
	});

	test('自分の連携確認では署名なしのentityを受け入れない', async () => {
		const fetcher = fixture({ entity: unsigned() });
		await expect(verifyConcrntCredential(credential)).rejects.toMatchObject({ code: 'auth', phase: 'identity' });
		expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/v2/register'))).toBe(false);
	});
});
