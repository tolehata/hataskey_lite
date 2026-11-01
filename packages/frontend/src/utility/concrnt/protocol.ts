/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	Api, ComputeCCID, InMemoryAuthProvider, InMemoryKVS, IsValid256k1PrivateKey,
	LoadSubKey, ValidateSignature, parseCCURI, renderUriTemplate,
} from '@concrnt/client';
import type {
	Document, Entity, FetchOptions, JwtPayload, QueryResult, Registration, RepositoryImportResult,
	Server, SignedDocument,
} from '@concrnt/client';
import type { ConcrntConnectionPhase, ConcrntInputIssue } from './connection-errors.js';
import { normalizeConcrntServerInfo } from './server-info.js';

export type ConcrntErrorCode = 'auth' | 'network' | 'capability' | 'invalid-input' | 'aborted';

/** Never attach a response body, credential, URL, or underlying exception. */
export class ConcrntProtocolError extends Error {
	constructor(public readonly code: ConcrntErrorCode, public readonly status?: number, public readonly phase?: ConcrntConnectionPhase, public readonly inputIssue?: ConcrntInputIssue) {
		const messages: Record<ConcrntErrorCode, string> = {
			auth: '認証または操作の許可を確認できませんでした。',
			network: 'Concrntとの通信を完了できませんでした。',
			capability: '必要なConcrnt v2の機能を確認できませんでした。',
			'invalid-input': '接続情報の形式を確認してください。',
			aborted: 'Concrntとの通信を中止しました。',
		};
		super(messages[code]);
		this.name = 'ConcrntProtocolError';
	}
}

export type ConcrntCredential = Readonly<{
	ccid: string;
	ckid: string;
	domain: string;
	secret: string;
}>;

const WELL_KNOWN = '/.well-known/concrnt';
const SUBKEY_SCHEMA = 'https://schema.concrnt.net/subkey.json';
const ENTITY_SCHEMA = 'https://schema.concrnt.net/entity.json';
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 20;
const TIMEOUT_MS = 20_000;
/** world-app signs tokens for five minutes; renew a minute before that. */
const TOKEN_REUSE_MS = 4 * 60_000;

export const CONCRNT_REQUIRED_ENDPOINTS = [
	'net.concrnt.core.resolve',
	'net.concrnt.core.query',
	'net.concrnt.core.commit',
	'net.concrnt.core.associations',
	'net.concrnt.core.association-counts',
	'net.concrnt.world.register',
	'net.concrnt.world.timeline.recent',
	'net.concrnt.storage.presign',
] as const;

function fail(code: ConcrntErrorCode, status?: number): never {
	throw new ConcrntProtocolError(code, status);
}

function invalidInput(inputIssue: ConcrntInputIssue): never {
	throw new ConcrntProtocolError('invalid-input', undefined, undefined, inputIssue);
}

function active(signal?: AbortSignal | null): void {
	if (signal?.aborted) fail('aborted');
}

function object(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** A browser cannot prove that a DNS name will never resolve to a private address. */
export function normalizeConcrntDomain(input: string): string {
	if (typeof input !== 'string' || input.length > 300) invalidInput('domain');
	const text = input.trim();
	if (!text || /[\s\\%?#]/u.test(text)) invalidInput('domain');
	let url: URL;
	try {
		url = new URL(text.includes('://') ? text : `https://${text}`);
	} catch {
		return invalidInput('domain');
	}
	const domain = url.hostname;
	if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' ||
		!domain.includes('.') || domain.length > 253 || domain.endsWith('.') ||
		/^\d+(?:\.\d+){3}$/u.test(domain) || domain.includes(':') ||
		/(?:^|\.)(?:localhost|local|internal|home|lan|test)$/u.test(domain) ||
		!domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) {
		invalidInput('domain');
	}
	return domain;
}

/** A public server domain used as a resource owner, already in canonical form. */
function domainOwner(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	try { return normalizeConcrntDomain(value) === value; } catch { return false; }
}

/** Bech32's checksum and canonical 20-byte address, not the SDK's prefix-only guard. */
function validId(value: unknown, prefix: 'con' | 'cck' | 'ccs'): value is string {
	if (typeof value !== 'string' || value.length !== 42 || !value.startsWith(`${prefix}1`)) return false;
	const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
	const data = [...value.slice(4)].map(char => alphabet.indexOf(char));
	if (data.some(part => part < 0)) return false;
	const expanded = [...prefix].map(char => char.charCodeAt(0) >> 5)
		.concat([0], [...prefix].map(char => char.charCodeAt(0) & 31), data);
	const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
	let checksum = 1;
	for (const part of expanded) {
		const top = checksum >>> 25;
		checksum = ((checksum & 0x1ffffff) << 5) ^ part;
		for (let bit = 0; bit < 5; bit++) {
			if ((top >>> bit) & 1) checksum ^= generators[bit];
		}
	}
	return checksum === 1;
}

export function parseConcrntSubkey(secret: string, expectedDomain?: string): ConcrntCredential {
	if (typeof secret !== 'string' || secret.length > 512) invalidInput('export-format');
	// The official client's copied subkey includes a trailing standalone "-".
	const match = /^concrnt-subkey\s+([0-9a-fA-F]{64})\s+(con1[a-z0-9]+)@([^\s]+)(?:\s+-)?$/u.exec(secret.trim());
	if (!match) invalidInput('export-format');
	if (!validId(match[2], 'con')) invalidInput('owner-id');
	if (!IsValid256k1PrivateKey(match[1])) invalidInput('private-key');
	const domain = normalizeConcrntDomain(match[3]);
	if (expectedDomain != null && domain !== normalizeConcrntDomain(expectedDomain)) invalidInput('domain-mismatch');
	const normalized = `concrnt-subkey ${match[1].toLowerCase()} ${match[2]}@${domain}`;
	let key: ReturnType<typeof LoadSubKey>;
	let keyOwner: string;
	try {
		key = LoadSubKey(normalized);
		if (!key || !validId(key.ckid, 'cck')) return invalidInput('key-derivation');
		keyOwner = ComputeCCID(key.keypair.publickey);
	} catch {
		return invalidInput('key-derivation');
	}
	if (keyOwner === key.ccid) invalidInput('master-key');
	return Object.freeze({ ccid: key.ccid, ckid: key.ckid, domain, secret: normalized });
}

function requestURL(domain: string, path: string): URL {
	if (!path || /[\\\r\n\t]/u.test(path) || path.startsWith('//')) fail('capability');
	let url: URL;
	try {
		url = new URL(path, `https://${domain}`);
	} catch {
		return fail('capability');
	}
	if (url.origin !== `https://${domain}` || url.username || url.password || url.hash ||
		(!path.startsWith('/') && !path.startsWith('https://'))) fail('capability');
	return url;
}

function descriptor(value: unknown, domain: string, full: boolean): Server {
	// core a52686b/server.GetWellKnown publishes protocol Version "2.0";
	// its independent SoftwareInfo.Version may be a release number or "unknown".
	if (!object(value) || typeof value.version !== 'string' || !/^2(?:\.|$)/u.test(value.version) ||
		value.domain !== domain || !validId(value.csid, 'ccs') || typeof value.layer !== 'string' ||
		!object(value.endpoints)) fail('capability');
	const endpoints: Record<string, string> = {};
	for (const [name, endpoint] of Object.entries(value.endpoints)) {
		if (typeof endpoint !== 'string' || endpoint.length > 4096) fail('capability');
		// Keep URI-template expressions intact. Validate the expanded URL again before each request.
		requestURL(domain, endpoint);
		endpoints[name] = endpoint;
	}
	const required: readonly string[] = full ? CONCRNT_REQUIRED_ENDPOINTS : ['net.concrnt.core.resolve'];
	if (required.some(name => !endpoints[name])) fail('capability');
	const info = normalizeConcrntServerInfo(domain, value.meta);
	return Object.freeze({
		version: value.version, domain, csid: value.csid, layer: value.layer,
		endpoints: Object.freeze(endpoints),
		meta: Object.freeze({ nickname: info.name, ...(info.iconUrl ? { logo: info.iconUrl } : {}) }),
	});
}

async function requestJSON<T>(domain: string, path: string, init: RequestInit, signal?: AbortSignal, timeout = TIMEOUT_MS): Promise<T> {
	active(signal);
	active(init.signal);
	const url = requestURL(domain, path);
	const controller = new AbortController();
	const abort = () => controller.abort();
	signal?.addEventListener('abort', abort, { once: true });
	init.signal?.addEventListener('abort', abort, { once: true });
	const timer = globalThis.setTimeout(abort, Math.min(Math.max(timeout, 1), 60_000));
	try {
		const response = await globalThis.fetch(url.href, {
			...init,
			mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
			referrerPolicy: 'no-referrer', signal: controller.signal,
		});
		active(signal);
		active(init.signal);
		if (response.redirected || (response.url && new URL(response.url).origin !== url.origin)) fail('network');
		if (!response.ok) fail(response.status === 401 || response.status === 403 ? 'auth' : 'network', response.status);
		if (response.status === 204) return undefined as T;
		if (!response.body) fail('network');
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let bytes = 0;
		try {
			while (true) {
				const part = await reader.read();
				active(signal);
				active(init.signal);
				if (controller.signal.aborted) fail('network');
				if (part.done) break;
				bytes += part.value.byteLength;
				if (bytes > MAX_RESPONSE_BYTES) fail('network');
				chunks.push(part.value);
			}
		} finally {
			await reader.cancel().catch(() => {});
			reader.releaseLock();
		}
		const buffer = new Uint8Array(bytes);
		let offset = 0;
		for (const chunk of chunks) {
			buffer.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return JSON.parse(new TextDecoder().decode(buffer)) as T;
	} catch (error) {
		active(signal);
		active(init.signal);
		if (error instanceof ConcrntProtocolError) throw error;
		return fail('network');
	} finally {
		globalThis.clearTimeout(timer);
		signal?.removeEventListener('abort', abort);
		init.signal?.removeEventListener('abort', abort);
	}
}

export async function probeConcrntDomain(input: string, signal?: AbortSignal): Promise<Server> {
	const domain = normalizeConcrntDomain(input);
	try {
		const data = await requestJSON<unknown>(domain, WELL_KNOWN, { headers: { Accept: 'application/json' } }, signal);
		return descriptor(data, domain, true);
	} catch (error) {
		throw new ConcrntProtocolError(error instanceof ConcrntProtocolError ? error.code : 'network', error instanceof ConcrntProtocolError ? error.status : undefined, 'server', error instanceof ConcrntProtocolError ? error.inputIssue : undefined);
	}
}

function documentOf(sd: unknown): Document<unknown> {
	if (!object(sd) || typeof sd.document !== 'string' || !object(sd.proof) ||
		(sd.cckv !== undefined && typeof sd.cckv !== 'string') ||
		(sd.ccfs !== undefined && typeof sd.ccfs !== 'string')) fail('capability');
	try {
		const doc: unknown = JSON.parse(sd.document);
		if (!object(doc) || typeof doc.kind !== 'string' || typeof doc.author !== 'string' ||
			typeof doc.schema !== 'string' || !('value' in doc)) fail('capability');
		return doc as unknown as Document<unknown>;
	} catch {
		return fail('capability');
	}
}

/** Core v2 omits URI metadata in some responses; present metadata must still match. */
function matchesDocumentKey(sd: { cckv?: string }, expected: string): boolean {
	return sd.cckv === undefined || sd.cckv === expected;
}

function directDocument(sd: SignedDocument, ccid: string): Document<unknown> {
	const doc = documentOf(sd);
	if (doc.author !== ccid || sd.proof.type !== 'concrnt-ecrecover-direct' ||
		typeof sd.proof.signature !== 'string' || !/^[0-9a-f]{130}$/iu.test(sd.proof.signature)) fail('auth');
	try {
		if (!ValidateSignature(sd.document, sd.proof.signature, ccid)) fail('auth');
	} catch {
		fail('auth');
	}
	return doc;
}

/**
 * Another user's entity, used only to locate their server. Accounts migrated from Concrnt v1 are
 * served by the home server with `proof: { type: 'none' }`; the official client accepts them without
 * a signature. A present signature must still verify. Our own entity keeps using directDocument.
 */
function entityDocument(sd: SignedDocument, ccid: string): Document<unknown> {
	if (object(sd.proof) && sd.proof.type === 'none') {
		const doc = documentOf(sd);
		if (doc.author !== ccid) fail('auth');
		return doc;
	}
	return directDocument(sd, ccid);
}

function resourceURI(uri: string): ReturnType<typeof parseCCURI> {
	try {
		if (typeof uri !== 'string' || uri.length > 4096 || !/^(?:cckv|ccfs):\/\//u.test(uri) || /[\s\\?#]/u.test(uri)) fail('invalid-input');
		const parsed = parseCCURI(uri);
		// Communities are owned by their server's domain: cckv://example.com/concrnt.world/communities/<id>.
		if (!['cckv', 'ccfs'].includes(parsed.scheme) ||
			(!validId(parsed.owner, 'con') && !validId(parsed.owner, 'ccs') && !domainOwner(parsed.owner))) fail('invalid-input');
		if (parsed.hint) normalizeConcrntDomain(parsed.hint);
		return parsed;
	} catch {
		return fail('invalid-input');
	}
}

/** No browser storage, automatic writes, guest fallback, retries, or shared authenticated cache. */
export class ConcrntApi extends Api {
	private readonly lifetime = new AbortController();
	private readonly servers = new Map<string, Server>();
	private readonly issuedTokens = new Map<string, { token: string; expires: number }>();
	private readonly pendingTokens = new Map<string, Promise<string>>();
	private readonly home: string;
	private readonly anonymous: boolean;
	private detachAbort?: () => void;

	constructor(domain: string, credential?: ConcrntCredential, signal?: AbortSignal) {
		const home = normalizeConcrntDomain(domain);
		const parsed = credential ? parseConcrntSubkey(credential.secret, home) : undefined;
		if (parsed && (!credential || credential.ccid !== parsed.ccid || credential.ckid !== parsed.ckid)) fail('invalid-input');
		super(home, new InMemoryAuthProvider(undefined, parsed?.secret), new InMemoryKVS());
		this.home = home;
		this.anonymous = !parsed;
		const abort = () => this.dispose();
		if (signal?.aborted) this.dispose();
		else {
			signal?.addEventListener('abort', abort, { once: true });
			this.detachAbort = () => signal?.removeEventListener('abort', abort);
		}
	}

	dispose(): void {
		this.lifetime.abort();
		this.detachAbort?.();
		this.detachAbort = undefined;
		this.tokens = {};
		this.issuedTokens.clear();
		this.pendingTokens.clear();
		this.self = null;
		this.servers.clear();
		if (this.authProvider instanceof InMemoryAuthProvider) {
			this.authProvider.subkey = undefined;
			this.authProvider.masterkey = undefined;
			this.authProvider.ckid = undefined;
			this.authProvider.ccid = '';
		}
		this.authProvider = new InMemoryAuthProvider();
		void this.cache.clear();
	}

	override async getServer(remote: string, opts?: FetchOptions<Server>): Promise<Server> {
		active(this.lifetime.signal);
		const domain = normalizeConcrntDomain(remote);
		const cached = this.servers.get(domain);
		if (cached && opts?.cache !== 'no-cache') return cached;
		if (opts?.cache === 'cache-only' || opts?.cache === 'force-cache') fail('capability');
		const data = await requestJSON<unknown>(domain, WELL_KNOWN, { headers: { Accept: 'application/json' } }, this.lifetime.signal);
		const server = descriptor(data, domain, false);
		active(this.lifetime.signal);
		this.servers.set(domain, server);
		return server;
	}

	override getServerOnlineStatus = async (host: string): Promise<boolean> => {
		try {
			await this.getServer(host, { cache: 'no-cache' });
			return true;
		} catch (error) {
			active(this.lifetime.signal);
			if (error instanceof ConcrntProtocolError && error.code === 'network') return false;
			throw error;
		}
	};

	override async signJWT(claim: JwtPayload, opts?: { useMasterkey?: boolean }): Promise<string> {
		active(this.lifetime.signal);
		if (this.anonymous || opts?.useMasterkey || claim.sub !== 'concrnt' ||
			claim.iss !== `cckv://${this.authProvider.getCCID()}@${this.home}` ||
			!claim.aud || !this.servers.has(normalizeConcrntDomain(claim.aud))) fail('auth');
		try {
			const token = await super.signJWT(claim);
			active(this.lifetime.signal);
			return token;
		} catch {
			active(this.lifetime.signal);
			return fail('auth');
		}
	}

	override async generateApiToken(remote: string, opts?: { useMasterkey?: boolean }): Promise<string> {
		active(this.lifetime.signal);
		if (this.anonymous || opts?.useMasterkey) fail('auth');
		const host = normalizeConcrntDomain(remote);
		await this.getServer(host);
		try {
			// Do not reuse the SDK's pending token promises across cancellation or reauthentication.
			const token = await super.generateApiToken(host);
			active(this.lifetime.signal);
			return token;
		} catch {
			active(this.lifetime.signal);
			return fail('auth');
		} finally {
			this.tokens = {};
		}
	}

	/** Drop reusable tokens, e.g. before re-checking credentials after a rejected request. */
	forgetTokens(): void {
		this.issuedTokens.clear();
	}

	/**
	 * A signed token (5 minutes) is reused by this connection only, then renewed one minute early.
	 * Signing per request made a timeline page issue hundreds of tokens and tripped rate limits.
	 * Only completed tokens are kept; a pending signature is shared but never outlives its own failure.
	 */
	override getAuthToken(remote: string, opts?: { useMasterkey?: boolean }): Promise<string> {
		if (opts?.useMasterkey) return this.generateApiToken(remote, opts);
		const host = normalizeConcrntDomain(remote);
		const issued = this.issuedTokens.get(host);
		if (issued && issued.expires > Date.now()) return Promise.resolve(issued.token);
		const pending = this.pendingTokens.get(host);
		if (pending) return pending;
		const promise = this.generateApiToken(host).then(token => {
			active(this.lifetime.signal);
			this.issuedTokens.set(host, { token, expires: Date.now() + TOKEN_REUSE_MS });
			return token;
		}).finally(() => { this.pendingTokens.delete(host); });
		this.pendingTokens.set(host, promise);
		return promise;
	}

	private async transport<T>(host: string, path: string, init: RequestInit, authenticate: boolean, timeoutms?: number): Promise<T> {
		active(this.lifetime.signal);
		active(init.signal);
		const domain = normalizeConcrntDomain(host || this.home);
		requestURL(domain, path);
		await this.getServer(domain);
		const method = (init.method ?? 'GET').toUpperCase();
		if (this.anonymous && !['GET', 'HEAD'].includes(method)) fail('auth');
		const headers = new Headers(init.headers);
		if (headers.has('authorization') || headers.has('cookie') || headers.has('proxy-authorization')) fail('invalid-input');
		headers.set('Accept', 'application/json');
		if (authenticate && !this.anonymous) headers.set('Authorization', `Bearer ${await this.getAuthToken(domain)}`);
		active(this.lifetime.signal);
		active(init.signal);
		return requestJSON<T>(domain, path, { ...init, headers }, this.lifetime.signal, timeoutms);
	}

	override fetchHost<T>(host: string, path: string, init: RequestInit = {}, timeoutms?: number): Promise<T> {
		return this.transport<T>(host, path, init, false, timeoutms);
	}

	override fetchWithCredential<T>(host: string, path: string, init: RequestInit = {}, timeoutms?: number, opts?: { useMasterkey?: boolean }): Promise<T> {
		if (opts?.useMasterkey) return Promise.reject(new ConcrntProtocolError('auth'));
		return this.transport<T>(host, path, init, true, timeoutms);
	}

	override async fetchWithCache<T>(host: string | undefined, path: string, cacheKey: string, opts?: FetchOptions<T>): Promise<T> {
		active(this.lifetime.signal);
		const domain = normalizeConcrntDomain(host || this.home);
		requestURL(domain, path);
		const authenticated = !this.anonymous && opts?.auth !== 'no-auth';
		const scopedKey = JSON.stringify([authenticated, domain, path, cacheKey]);
		if (opts?.cache === 'cache-only' || opts?.cache === 'force-cache') {
			const entry = await this.cache.get<T>(scopedKey);
			active(this.lifetime.signal);
			if (!entry || Date.now() - entry.timestamp > (opts.TTL ?? this.defaultCacheTTL)) fail('network');
			return entry.data;
		}
		const result = await this.transport<T>(domain, path, {}, authenticated, opts?.timeoutms);
		active(this.lifetime.signal);
		if (opts?.cache !== 'no-cache' && opts?.cache !== 'negative-only') await this.cache.set(scopedKey, result);
		active(this.lifetime.signal);
		opts?.expressGetter?.(result);
		return result;
	}

	async readOwnEntity(): Promise<SignedDocument> {
		const ccid = this.authProvider.getCCID();
		const server = await this.getServer(this.home);
		const uri = `cckv://${ccid}`;
		const sd = await this.fetchHost<SignedDocument>(this.home, renderUriTemplate(server, 'net.concrnt.core.resolve', { uri, owner: ccid }));
		const doc = directDocument(sd, ccid);
		if (doc.kind !== 'entity' || doc.schema !== ENTITY_SCHEMA || !object(doc.value) || doc.value.domain !== this.home || !matchesDocumentKey(sd, uri)) fail('auth');
		return sd;
	}

	override async getEntity(ccid: string, hint?: string, opts?: FetchOptions<SignedDocument>): Promise<Document<Entity>> {
		const owner = ccid.startsWith('cckv://') ? resourceURI(ccid).owner : ccid;
		if (!validId(owner, 'con')) fail('invalid-input');
		const normalizedHint = hint ? normalizeConcrntDomain(hint) : undefined;
		const uri = `cckv://${owner}${normalizedHint ? `@${normalizedHint}` : ''}`;
		const server = await this.getServer(this.home);
		const sd = await this.fetchWithCache<SignedDocument>(this.home, renderUriTemplate(server, 'net.concrnt.core.resolve', { uri, owner }), uri, { ...opts, auth: 'no-auth' });
		const doc = entityDocument(sd, owner);
		if (doc.kind !== 'entity' || doc.schema !== ENTITY_SCHEMA || !object(doc.value) || typeof doc.value.domain !== 'string' || !matchesDocumentKey(sd, `cckv://${owner}`)) fail('capability');
		normalizeConcrntDomain(doc.value.domain);
		return doc as Document<Entity>;
	}

	override async resolveDomain(owner: string, hint?: string, opts?: { cache: 'cache-only' }): Promise<string> {
		active(this.lifetime.signal);
		if (validId(owner, 'con')) return normalizeConcrntDomain((await this.getEntity(owner, hint, opts)).value.domain);
		if (validId(owner, 'ccs')) {
			const resolved = await this.getServerByCSID(owner, hint, opts);
			const server = await this.getServer(normalizeConcrntDomain(resolved.domain));
			if (server.csid !== owner) fail('capability');
			return server.domain;
		}
		return normalizeConcrntDomain(owner);
	}

	override async getResource<T>(uri: string, hint?: string, opts?: FetchOptions<T>): Promise<T> {
		const parsed = resourceURI(uri);
		const domain = await this.resolveDomain(parsed.owner, hint ?? parsed.hint, opts?.cache === 'cache-only' ? { cache: 'cache-only' } : undefined);
		const server = await this.getServer(domain, opts?.cache === 'cache-only' ? { cache: 'cache-only' } : undefined);
		const path = renderUriTemplate(server, 'net.concrnt.core.resolve', { uri, owner: parsed.owner, key: parsed.key });
		return this.fetchWithCache<T>(domain, path, uri, opts);
	}

	override async getDocument<T>(uri: string, domain?: string, opts?: FetchOptions<SignedDocument>): Promise<Document<T>> {
		return documentOf(await this.getResource<SignedDocument>(uri, domain, opts)) as Document<T>;
	}

	override async getRegistration(host = this.home, opts?: { useMasterkey?: boolean }): Promise<Registration> {
		if (normalizeConcrntDomain(host) !== this.home || opts?.useMasterkey || this.anonymous) fail('auth');
		const reply = await this.callConcrntApi<unknown>(host, 'net.concrnt.world.register', {});
		if (!object(reply) || reply.status !== 'ok' || !object(reply.content) || reply.content.ccid !== this.authProvider.getCCID()) fail('auth');
		return reply.content as unknown as Registration;
	}

	override async commit<T>(document: Document<T>, domain?: string, opts?: { useMasterkey: boolean }): Promise<SignedDocument> {
		active(this.lifetime.signal);
		if (this.anonymous || opts?.useMasterkey || document.author !== this.authProvider.getCCID()) fail('auth');
		let docString: string;
		try { docString = JSON.stringify(document); } catch { return fail('invalid-input'); }
		// Route the frozen document, not an object that a caller can mutate during the awaits below.
		const frozen = JSON.parse(docString) as Document<unknown>;
		let authority: string;
		if (frozen.kind === 'record') {
			if (!frozen.key || resourceURI(frozen.key).owner !== this.authProvider.getCCID()) fail('invalid-input');
			authority = this.home;
		} else if (frozen.kind === 'association' && frozen.associate) {
			const target = resourceURI(frozen.associate);
			authority = await this.resolveDomain(target.owner, target.hint);
		} else if (frozen.kind === 'delete' && typeof frozen.value === 'string' && !frozen.value.includes('*')) {
			const target = resourceURI(frozen.value);
			authority = await this.resolveDomain(target.owner, target.hint);
		} else {
			return fail('invalid-input');
		}
		if (domain != null && normalizeConcrntDomain(domain) !== authority) fail('invalid-input');
		const self = await this.readOwnEntity();
		const server = await this.getServer(authority);
		let signature: string;
		let ckid: string;
		try { [signature, ckid] = await this.authProvider.signSub(docString); } catch { active(this.lifetime.signal); return fail('auth'); }
		active(this.lifetime.signal);
		const references: Record<string, SignedDocument> = { [`cckv://${frozen.author}`]: self };
		if (frozen.schema === 'https://schema.concrnt.net/reference.json' && object(frozen.value) && typeof frozen.value.href === 'string') {
			references[frozen.value.href] = await this.getResource<SignedDocument>(frozen.value.href);
		}
		const result = await this.fetchHost<SignedDocument>(authority, renderUriTemplate(server, 'net.concrnt.core.commit', {}), {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ document: docString, proof: { type: 'concrnt-ecrecover-subkey', signature, key: `cckv://${frozen.author}/keys/${ckid}` }, references }),
		});
		documentOf(result);
		if (result.document !== docString) fail('network');
		await this.cache.clear();
		active(this.lifetime.signal);
		return result;
	}

	override async delete(uri: string, domain?: string): Promise<void> {
		resourceURI(uri);
		await this.commit({ kind: 'delete', author: this.authProvider.getCCID(), schema: 'https://schema.concrnt.net/delete.json', value: uri, createdAt: new Date() }, domain);
	}

	// Fail on incomplete pagination; the SDK otherwise resolves with a partial array after later errors.
	override async queryAll(query: Parameters<Api['queryAll']>[0], domain?: string, opts?: Parameters<Api['queryAll']>[2]): Promise<SignedDocument[]> {
		return this.collectPages(cursor => this.query({ ...query, limit: 100, ...(query.order === 'asc' ? { since: cursor } : { until: cursor }) }, domain, opts));
	}

	override async getAssociationsAll(uri: string, query: Parameters<Api['getAssociationsAll']>[1], hint?: string): Promise<SignedDocument[]> {
		return this.collectPages(cursor => this.getAssociations(uri, { ...query, limit: 100, until: cursor }, hint));
	}

	private async collectPages(load: (cursor?: string) => Promise<QueryResult>): Promise<SignedDocument[]> {
		const collected = new Map<string, SignedDocument>();
		const seen = new Set<string>();
		let cursor: string | undefined;
		for (let count = 0; count < MAX_PAGES; count++) {
			active(this.lifetime.signal);
			const page = await load(cursor);
			active(this.lifetime.signal);
			if (!object(page) || !Array.isArray(page.items)) fail('capability');
			for (const sd of page.items) {
				documentOf(sd);
				// Pagination needs an immutable identifier to avoid dropping distinct items.
				if (!sd.ccfs) fail('capability');
				collected.set(sd.ccfs, sd);
			}
			if (page.next == null) return [...collected.values()];
			if (typeof page.next !== 'string' || seen.has(page.next)) fail('capability');
			seen.add(page.next);
			cursor = page.next;
		}
		return fail('capability');
	}

	// These account-administration paths are outside this integration; dumpRepository also bypasses Api transport.
	override async dumpRepository(): Promise<string> { return fail('capability'); }
	override async importRepository(): Promise<RepositoryImportResult[]> { return fail('capability'); }
	override async updateRegistration(): Promise<void> { return fail('capability'); }
	override async unregister(): Promise<void> { return fail('capability'); }
}

export function createConcrntApi(credential: ConcrntCredential, signal?: AbortSignal): ConcrntApi {
	return new ConcrntApi(credential.domain, credential, signal);
}

export function createAnonymousConcrntApi(domain: string, signal?: AbortSignal): ConcrntApi {
	return new ConcrntApi(domain, undefined, signal);
}

export async function verifyConcrntCredential(credential: ConcrntCredential, signal?: AbortSignal): Promise<ConcrntApi> {
	const api = createConcrntApi(credential, signal);
	let phase: ConcrntConnectionPhase = 'server';
	try {
		const server = descriptor(await api.getServer(credential.domain, { cache: 'no-cache' }), credential.domain, true);
		phase = 'identity';
		const self = await api.readOwnEntity();
		phase = 'subkey';
		const uri = `cckv://${credential.ccid}/keys/${credential.ckid}`;
		const sd = await api.fetchHost<SignedDocument>(credential.domain, renderUriTemplate(server, 'net.concrnt.core.resolve', { uri, owner: credential.ccid, key: `keys/${credential.ckid}` }));
		const doc = directDocument(sd, credential.ccid);
		if (!matchesDocumentKey(sd, uri) || doc.key !== uri || doc.kind !== 'record' || doc.schema !== SUBKEY_SCHEMA ||
			!object(doc.value) || doc.value.ckid !== credential.ckid) fail('auth');
		phase = 'registration';
		await api.getRegistration();
		active(signal);
		api.self = self;
		return api;
	} catch (error) {
		api.dispose();
		throw new ConcrntProtocolError(error instanceof ConcrntProtocolError ? error.code : 'auth', error instanceof ConcrntProtocolError ? error.status : undefined, phase, error instanceof ConcrntProtocolError ? error.inputIssue : undefined);
	}
}
