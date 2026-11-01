/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { CDID } from '@concrnt/client';
import { normalizeConcrntServerInfo } from './server-info.js';
import type { ConcrntServerInfo } from './server-info.js';
import type { Api, Document, SignedDocument } from '@concrnt/client';
import type {
	ConcrntEmoji, ConcrntEmojiPackage, ConcrntList, ConcrntMedia, ConcrntMessage, ConcrntNotification,
	ConcrntOperation, ConcrntPage, ConcrntPostInput, ConcrntProfile, ConcrntPublishResult,
	ConcrntReactionUsers, ConcrntTimelineInfo, ConcrntUploadOptions, ConcrntUserProfile, ConcrntVisibility, ConcrntWriteStep,
} from './types.js';

/** world-app subscribes new accounts to this package (utils/emojiPackages.ts TWEMOJI_URL). */
export const CONCRNT_DEFAULT_EMOJI_PACKAGE = 'https://gist.githubusercontent.com/totegamma/6e1a047f54960f6bb7b946064664d793/raw/twemoji.json';

// Wire schemas/paths follow world-app dcec14d7 and world-schemas dec286f6.
// The worldlib Client is deliberately not initialized: its list refresh can write records.
export const CONCRNT_SCHEMAS = {
	markdown: 'https://schema.concrnt.world/m/markdown.json',
	plain: 'https://schema.concrnt.world/m/plaintext.json',
	media: 'https://schema.concrnt.world/m/media.json',
	reply: 'https://schema.concrnt.world/m/reply.json',
	reroute: 'https://schema.concrnt.world/m/reroute.json',
	reaction: 'https://schema.concrnt.world/a/reaction.json',
	like: 'https://schema.concrnt.world/a/like.json',
	replyAssociation: 'https://schema.concrnt.world/a/reply.json',
	rerouteAssociation: 'https://schema.concrnt.world/a/reroute.json',
	mention: 'https://schema.concrnt.world/a/mention.json',
	follow: 'https://schema.concrnt.world/ack/follow.json',
	profile: 'https://schema.concrnt.world/p/main.json',
	list: 'https://schema.concrnt.world/s/list.json',
	communityTimeline: 'https://schema.concrnt.world/t/community.json',
	apInboxTimeline: 'https://schema.concrnt.world/ap/inbox.json',
	reference: 'https://schema.concrnt.net/reference.json',
	delete: 'https://schema.concrnt.net/delete.json',
} as const;

type Value = Record<string, unknown>;
type WireDocument = Document<unknown>;
interface ConcrntTarget {
	key: string;
	document: WireDocument;
	domain: string;
	profile: string;
}

export interface ConcrntServiceOptions {
	/** Must have separate transport, cache and in-flight requests, with no credentials. */
	anonymousApi?: Api;
	signal?: AbortSignal;
	/** Awaited before each write. Throwing prevents that write. */
	onOperation?: (operation: ConcrntOperation, options?: { create?: boolean; claimStep?: ConcrntWriteStep['id'] }) => Promise<void> | void;
	uploadFetch?: typeof fetch;
	publicFetch?: typeof fetch;
}

export interface ConcrntUploadTicket {
	uploadUrl: string;
	fileUrl: string;
	contentType: string;
	sha256: string;
	size: number;
}

function valueOf(value: unknown): Value {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Value : {};
}

function stringOf(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function stringsOf(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function profileName(name: string): string {
	if (!name || name.length > 200 || /[/?#\\\s]/.test(name) || name === '.' || name === '..') {
		throw new Error('プロフィールの識別子が不正です。');
	}
	return name;
}

export function concrntProfileUri(ccid: string, profile: string): string {
	return `cckv://${ccid}/concrnt.world/profiles/${profileName(profile)}`;
}

export function concrntTimelineUri(ccid: string, profile: string, kind: 'home' | 'activity' | 'notify'): string {
	return `${concrntProfileUri(ccid, profile)}/${kind}-timeline`;
}

export function concrntWebUrl(uri: string): string {
	return `https://concrnt.world/post/${encodeURIComponent(uri)}`;
}

function resourceUri(uri: string): URL {
	const parsed = new URL(uri);
	if (!['cckv:', 'ccfs:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
		throw new Error('コンカレントのリソースURIが不正です。');
	}
	return parsed;
}

function publicHttps(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return undefined;
		return url.href;
	} catch {
		return undefined;
	}
}

function parseSigned(sd: SignedDocument): WireDocument {
	const parsed: unknown = JSON.parse(sd.document);
	const document = valueOf(parsed);
	if (typeof document.author !== 'string' || typeof document.schema !== 'string' || typeof document.kind !== 'string') throw new Error('コンカレントの文書形式が不正です。');
	return parsed as WireDocument;
}

function restricted(document: WireDocument): boolean {
	return document.policy?.entries?.some(entry => /(?:restrict|private|readers)/i.test(entry.url)) ?? false;
}

/** Known document policy shapes only; this does not evaluate server globals or future changes. */
function permitsPublicObservation(document: WireDocument): boolean {
	if (document.policy === undefined) return true;
	const policy = valueOf(document.policy);
	if (!Array.isArray(policy.entries) || Object.keys(policy).some(key => key !== 'entries')) return false;
	// world-policies e8b662f8: write-public/allow-writers emit only record:create.
	return policy.entries.every(raw => {
		const entry = valueOf(raw);
		if (Object.keys(entry).some(key => !['url', 'params', 'defaults'].includes(key))) return false;
		if (Object.keys(valueOf(entry.defaults)).some(action => action !== 'record:create')) return false;
		if (entry.url === 'https://policy.concrnt.world/t/write-public.json' || entry.url === 'https://policy.concrnt.world/t/allow-writers.json') return true;
		return entry.url === 'https://policy.concrnt.world/t/inline-read-write.json' && valueOf(entry.params).isReadPublic === true;
	});
}

function visibilityOf(document: WireDocument): ConcrntVisibility {
	return restricted(document) ? 'restricted' : 'unknown';
}

function profileOf(author: string, document: WireDocument): string {
	const prefix = `cckv://${author}/concrnt.world/profiles/`;
	const key = document.key;
	if (key?.startsWith(prefix)) return key.slice(prefix.length).split('/')[0] || 'main';
	const uri = stringOf(valueOf(document.value).profileURI);
	if (uri?.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) return uri.slice(prefix.length) || 'main';
	return 'main';
}

function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

function sameDocument(actual: WireDocument, expected: string): boolean {
	return stable(JSON.parse(JSON.stringify(actual))) === stable(JSON.parse(expected));
}

function errorMessage(error: unknown): string {
	// Transport errors may include response bodies or URLs. Do not persist them in the journal.
	return error instanceof DOMException && error.name === 'AbortError'
		? '処理を中断しました。送信済みの処理は、結果を確認するまで再送できません。'
		: '処理を完了できませんでした。結果を確認してから続行してください。';
}

function iso(value: unknown): string {
	const date = new Date(value as string);
	if (!Number.isFinite(date.getTime())) throw new Error('投稿日時を読み取れません。');
	return date.toISOString();
}

const PROFILE_TTL = 5 * 60_000;
const READ_CONCURRENCY = 6;

/** Rate limits, gateway errors and dropped connections, never 4xx answers about a specific resource. */
function transient(error: unknown): boolean {
	const detail = error as { code?: unknown; status?: unknown; name?: unknown };
	if (detail?.name === 'AbortError') return false;
	if (detail?.code !== 'network') return false;
	return typeof detail.status !== 'number' || detail.status === 429 || detail.status >= 500;
}

/** Reads only: one delayed retry for a transient failure. Writes are never retried here. */
async function readWithRetry<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (!transient(error)) throw error;
		await new Promise(resolve => globalThis.setTimeout(resolve, 400));
		return work();
	}
}

/** Bounded parallelism so one timeline page does not open hundreds of requests at once. */
async function settleLimited<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
	const results: PromiseSettledResult<R>[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			try { results[index] = { status: 'fulfilled', value: await work(items[index]) }; } catch (reason) { results[index] = { status: 'rejected', reason }; }
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

/** Pure conversion. Unsupported schemas stay unsupported; they are never rewritten as public posts. */
export function normalizeConcrntMessage(uri: string, document: WireDocument): ConcrntMessage {
	resourceUri(uri);
	const value = valueOf(document.value);
	const kinds: Record<string, ConcrntMessage['kind']> = {
		[CONCRNT_SCHEMAS.plain]: 'plain', [CONCRNT_SCHEMAS.markdown]: 'markdown',
		[CONCRNT_SCHEMAS.media]: 'media', [CONCRNT_SCHEMAS.reply]: 'reply', [CONCRNT_SCHEMAS.reroute]: 'reroute',
	};
	const kind = kinds[document.schema] ?? 'unsupported';
	const media = Array.isArray(value.medias) ? value.medias.flatMap(item => {
		const file = valueOf(item);
		const url = publicHttps(file.mediaURL);
		const type = stringOf(file.mediaType);
		return url && type ? [{ url, type, thumbnailUrl: publicHttps(file.thumbnailURL), alt: stringOf(file.altText), flag: stringOf(file.flag), blurhash: stringOf(file.blurhash) }] : [];
	}) : [];
	const emojis: ConcrntMessage['emojis'] = {};
	for (const [name, definition] of Object.entries(valueOf(value.emojis))) {
		if (!/^[a-zA-Z0-9_]+$/.test(name)) continue;
		const emoji = valueOf(definition);
		emojis[name] = { imageURL: publicHttps(emoji.imageURL), animURL: publicHttps(emoji.animURL) };
	}
	return {
		uri, key: document.key, schema: document.schema, kind, author: document.author,
		// The CCID is an identifier, not a name. The UI supplies a fallback label.
		authorName: '', authorProfile: profileOf(document.author, document), createdAt: iso(document.createdAt),
		body: kind === 'unsupported' || kind === 'reroute' ? '' : stringOf(value.body) ?? '', emojis, media,
		targetUri: stringOf(value.targetURI), distributes: stringsOf(document.distributes), visibility: visibilityOf(document),
		reactions: [], associationCounts: {}, webUrl: concrntWebUrl(document.key ?? uri),
	};
}

export class ConcrntService {
	private readonly uploadTickets = new WeakMap<ConcrntUploadTicket, { file: File; snapshot: string }>();
	private readonly executing = new Set<string>();
	private readonly profileCache = new Map<string, { at: number; promise: Promise<ConcrntProfile> }>();
	private readonly timelineCache = new Map<string, Promise<ConcrntTimelineInfo>>();

	constructor(readonly api: Api, readonly ccid: string, readonly domain: string, private readonly options: ConcrntServiceOptions = {}) {
		if (options.anonymousApi === api || (options.anonymousApi && options.anonymousApi.cache === api.cache)) {
			throw new Error('匿名確認には独立したクライアントとキャッシュが必要です。');
		}
	}

	private check(signal?: AbortSignal): void {
		this.options.signal?.throwIfAborted();
		signal?.throwIfAborted();
	}

	/** Display metadata uses only the descriptor already verified during connection. */
	async getServerInfo(): Promise<ConcrntServerInfo> {
		this.check();
		let info = normalizeConcrntServerInfo(this.domain, undefined);
		try {
			const server = await this.api.getServer(this.domain, { cache: 'cache-only' });
			if (server.domain === this.domain) info = normalizeConcrntServerInfo(this.domain, server.meta);
		} catch { /* Optional display data must not make a working connection fail. */ }
		this.check();
		return info;
	}

	/**
	 * Display profiles are shared by every post of the same author. They are cached briefly per connection
	 * (this service is discarded on reconnect) so a timeline page does not refetch the same profile dozens of times.
	 * `hint` is the server where the author was seen; the home server may not know remote reactors yet.
	 */
	private profile(author: string, name: string, hint?: string): Promise<ConcrntProfile> {
		const key = `${author}/${name}`;
		const cached = this.profileCache.get(key);
		if (cached && Date.now() - cached.at < PROFILE_TTL) return cached.promise;
		const uri = concrntProfileUri(author, name);
		const promise = (async () => {
			this.check();
			let document: WireDocument;
			// world-app resolves users without a hint first; the hint only helps when the home server does not know them.
			try {
				document = await this.readDocument(uri);
			} catch (error) {
				if (!hint || hint === this.domain) throw error;
				document = await this.readDocument(uri, hint);
			}
			this.check();
			const value = valueOf(document.value);
			return { id: name, uri, name: stringOf(value.username) ?? '', avatarUrl: publicHttps(value.avatar), bannerUrl: publicHttps(value.banner), description: stringOf(value.description), visibility: visibilityOf(document) };
		})();
		this.profileCache.set(key, { at: Date.now(), promise });
		promise.catch(() => { if (this.profileCache.get(key)?.promise === promise) this.profileCache.delete(key); });
		return promise;
	}

	/**
	 * Display reads. Another server may refuse this connection's token (401/403) for data that is public anyway;
	 * like world-app, which drops the auth header when it cannot use it, retry once without credentials.
	 * Only the separate anonymous client is used for that, so no authenticated cache is shared.
	 */
	private async readDocument(uri: string, hint?: string): Promise<WireDocument> {
		try {
			return await readWithRetry(() => this.api.getDocument<unknown>(uri, hint, { cache: 'no-cache' }));
		} catch (error) {
			const anonymous = this.options.anonymousApi;
			if (!anonymous || (error as { name?: unknown })?.name === 'AbortError') throw error;
			this.check();
			try {
				return await readWithRetry(() => anonymous.getDocument<unknown>(uri, hint, { cache: 'no-cache', auth: 'no-auth' }));
			} catch {
				throw error;
			}
		}
	}

	/** Same fallback as readDocument for other public reads (counts, reaction lists). */
	private async publicRead<T>(work: (api: Api) => Promise<T>): Promise<T> {
		try {
			return await readWithRetry(() => work(this.api));
		} catch (error) {
			const anonymous = this.options.anonymousApi;
			if (!anonymous || (error as { name?: unknown })?.name === 'AbortError') throw error;
			this.check();
			try { return await readWithRetry(() => work(anonymous)); } catch { throw error; }
		}
	}

	private async domainOf(uri: string): Promise<string | undefined> {
		try { return await this.api.resolveDomain(resourceUri(uri).hostname); } catch { return undefined; }
	}

	/** Read-only display data for another user's subprofile. */
	async getUserProfile(ccid: string, profile = 'main'): Promise<ConcrntUserProfile> {
		if (!/^[a-zA-Z0-9]{1,100}$/.test(ccid)) throw new Error('ユーザーの識別子が不正です。');
		return { ...await this.profile(ccid, profileName(profile)), ccid };
	}

	/** Up to `limit` reactors for one emoji image, newest first. */
	async getReactionUsers(message: string, imageUrl: string, limit = 10): Promise<ConcrntReactionUsers> {
		this.check();
		resourceUri(message);
		if (!publicHttps(imageUrl)) throw new Error('リアクションの画像URLが不正です。');
		const hint = await this.domainOf(message);
		const page = await this.publicRead(api => api.getAssociations(message, { schema: CONCRNT_SCHEMAS.reaction, variant: imageUrl, limit: Math.max(1, Math.min(50, limit)) }, hint));
		this.check();
		let shortcode = '';
		const authors = new Map<string, { profile: string; override: Value }>();
		for (const sd of page.items ?? []) {
			let doc: WireDocument;
			try { doc = parseSigned(sd); } catch { continue; }
			const value = valueOf(doc.value);
			if (doc.schema !== CONCRNT_SCHEMAS.reaction || doc.associate !== message || value.imageUrl !== imageUrl) continue;
			shortcode ||= stringOf(value.shortcode) ?? '';
			if (!authors.has(doc.author)) authors.set(doc.author, { profile: profileOf(doc.author, doc), override: valueOf(value.profileOverride) });
		}
		// As world-app's Association.loadAuthorProfile: the reactor's profile, then any profileOverride on the reaction.
		const users = await Promise.all([...authors].map(async ([ccid, { profile, override }]) => {
			const found = await this.profile(ccid, profile, hint).catch(() => null);
			return { ccid, profile, name: stringOf(override.username) || (found?.name ?? ''), avatarUrl: publicHttps(override.avatar) ?? found?.avatarUrl };
		}));
		this.check();
		return { shortcode, users };
	}

	private async excerpt(uri: string | undefined): Promise<string | undefined> {
		if (!uri) return undefined;
		try {
			resourceUri(uri);
			const document = await this.readDocument(uri);
			const body = stringOf(valueOf(document.value).body);
			return body ? body.replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || undefined : undefined;
		} catch { return undefined; }
	}

	async getProfiles(): Promise<ConcrntProfile[]> {
		this.check();
		const docs = await this.api.queryAll({ parent: `cckv://${this.ccid}/concrnt.world/profiles`, schema: CONCRNT_SCHEMAS.profile }, this.domain, { cache: 'no-cache' });
		this.check();
		const prefix = `cckv://${this.ccid}/concrnt.world/profiles/`;
		return docs.flatMap(sd => {
			const doc = parseSigned(sd);
			const key = doc.key ?? sd.cckv;
			if (!key.startsWith(prefix) || key.slice(prefix.length).includes('/') || doc.author !== this.ccid) return [];
			const value = valueOf(doc.value);
			return [{ id: key.slice(prefix.length), uri: key, name: stringOf(value.username) ?? '', avatarUrl: publicHttps(value.avatar), description: stringOf(value.description), visibility: visibilityOf(doc) }];
		}).sort((a, b) => a.id === 'main' ? -1 : b.id === 'main' ? 1 : a.id.localeCompare(b.id));
	}

	/**
	 * Subscribed emoji packages, as world-app lists them: reference records under
	 * `cckv://<ccid>/concrnt.world/emojipacks/`, each pointing to `{ name, iconURL, emojis[] }`.
	 * Account-wide, not per subprofile. No list is created or modified here.
	 */
	async getEmojiPackages(): Promise<ConcrntEmojiPackage[]> {
		this.check();
		const references = await readWithRetry(() => this.api.queryAll({ prefix: `cckv://${this.ccid}/concrnt.world/emojipacks/` }, this.domain, { cache: 'no-cache' }));
		this.check();
		const urls = references.flatMap(sd => {
			let document: WireDocument;
			try { document = parseSigned(sd); } catch { return []; }
			const href = publicHttps(valueOf(document.value).href);
			return document.schema === CONCRNT_SCHEMAS.reference && href ? [href] : [];
		});
		const selected = [...new Set(references.length ? urls : [CONCRNT_DEFAULT_EMOJI_PACKAGE])].slice(0, 20);
		const packages = await Promise.allSettled(selected.map(url => this.emojiPackage(url)));
		this.check();
		const loaded = packages.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
		if (!loaded.length) throw new Error('絵文字一覧を取得できませんでした。');
		return loaded;
	}

	/** One package file. Public, anonymous and size-bounded; redirects may only land on another public HTTPS URL. */
	private async emojiPackage(url: string): Promise<ConcrntEmojiPackage> {
		this.check();
		const signals = [this.options.signal, AbortSignal.timeout(10000)].filter((signal): signal is AbortSignal => Boolean(signal));
		// Package hosts such as GitHub raw/gist answer through redirects; world-app follows them too.
		const response = await (this.options.publicFetch ?? globalThis.fetch)(url, { credentials: 'omit', redirect: 'follow', cache: 'no-cache', referrerPolicy: 'no-referrer', signal: AbortSignal.any(signals) });
		if (response.url && !publicHttps(response.url)) throw new Error('絵文字パックの取得先が安全ではありません。');
		if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 2 * 1024 * 1024) throw new Error('絵文字パックを読み取れません。');
		let text = '';
		if (response.body) {
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let bytes = 0;
			try {
				while (true) {
					const chunk = await reader.read();
					if (chunk.done) break;
					bytes += chunk.value.byteLength;
					if (bytes > 2 * 1024 * 1024) throw new Error('絵文字パックが大きすぎます。');
					text += decoder.decode(chunk.value, { stream: true });
				}
				text += decoder.decode();
			} finally { await reader.cancel(); }
		} else {
			text = await response.text();
			if (text.length > 2 * 1024 * 1024) throw new Error('絵文字パックが大きすぎます。');
		}
		this.check();
		const pack = valueOf(JSON.parse(text));
		if (!Array.isArray(pack.emojis)) throw new Error('絵文字パックの形式を読み取れません。');
		const emojis = new Map<string, ConcrntEmoji>();
		for (const raw of pack.emojis.slice(0, 10000)) {
			const emoji = valueOf(raw);
			const shortcode = stringOf(emoji.shortcode);
			const imageUrl = publicHttps(emoji.imageURL);
			if (shortcode && imageUrl) emojis.set(`${shortcode}\0${imageUrl}`, { shortcode, imageUrl });
		}
		return { url, name: stringOf(pack.name)?.slice(0, 100) || '絵文字パック', iconUrl: publicHttps(pack.iconURL), emojis: [...emojis.values()] };
	}

	/** All subscribed emoji in one list (packages keep their own order). */
	async getEmojis(profile: string): Promise<ConcrntEmoji[]> {
		profileName(profile);
		const emojis = new Map<string, ConcrntEmoji>();
		for (const pack of await this.getEmojiPackages()) for (const emoji of pack.emojis) emojis.set(`${emoji.shortcode}\0${emoji.imageUrl}`, emoji);
		return [...emojis.values()];
	}

	/** Display name for a destination timeline. Users' home timelines show the owner's profile name. */
	getTimelineInfo(uri: string): Promise<ConcrntTimelineInfo> {
		const cached = this.timelineCache.get(uri);
		if (cached) return cached;
		const promise = (async () => {
			const parsed = resourceUri(uri);
			const document = await this.readDocument(uri);
			this.check();
			const value = valueOf(document.value);
			const home = /\/concrnt\.world\/profiles\/([^/]+)\/home-timeline$/.exec(parsed.pathname);
			const owner = home ? await this.profile(parsed.hostname, home[1]).catch(() => null) : null;
			const name = stringOf(value.name) ?? (owner ? `${owner.name || owner.id}のホーム` : stringOf(value.shortname)) ?? 'タイムライン';
			return { uri, name: name.slice(0, 100), iconUrl: publicHttps(value.icon) ?? owner?.avatarUrl, restricted: restricted(document) || owner?.visibility === 'restricted' };
		})();
		this.timelineCache.set(uri, promise);
		promise.catch(() => { if (this.timelineCache.get(uri) === promise) this.timelineCache.delete(uri); });
		return promise;
	}

	async getLists(profile: string): Promise<ConcrntList[]> {
		this.check();
		const parent = `${concrntProfileUri(this.ccid, profile)}/lists`;
		const [pinsResult, docs] = await Promise.all([
			this.api.getDocument<unknown>(parent, this.domain, { cache: 'no-cache' }).catch(error => {
				if (error instanceof Error) {
					const detail = error as Error & { code?: unknown; status?: unknown };
					// Only this optional pins record may be absent; list queries must still succeed.
					if (detail.constructor.name === 'NotFoundError' || (detail.code === 'network' && detail.status === 404)) return null;
				}
				throw error;
			}),
			this.api.queryAll({ parent, schema: CONCRNT_SCHEMAS.list }, this.domain, { cache: 'no-cache' }),
		]);
		this.check();
		const pins = Array.isArray(pinsResult?.value) ? pinsResult.value.map(valueOf) : [];
		const lists = await Promise.all(docs.map(async sd => {
			const doc = parseSigned(sd);
			const uri = doc.key ?? sd.cckv;
			if (!uri.startsWith(`${parent}/`) || doc.author !== this.ccid) throw new Error('リストの所有者を確認できません。');
			const entries = await this.api.queryAll({ prefix: `${uri}/` }, this.domain, { cache: 'no-cache' });
			this.check();
			const references = entries.flatMap(entry => {
				const reference = parseSigned(entry);
				const value = valueOf(reference.value);
				const href = stringOf(value.href);
				return reference.schema === CONCRNT_SCHEMAS.reference && href ? [{ href: resourceUri(href).href, schema: stringOf(value.schema) }] : [];
			});
			const timelines = references.map(reference => reference.href);
			// Lists mix followed users' home timelines with communities. Like world-app's knownCommunities,
			// only references recorded as community or ActivityPub inbox timelines are offered as post destinations.
			const communities = references.flatMap(reference => reference.schema === CONCRNT_SCHEMAS.communityTimeline || reference.schema === CONCRNT_SCHEMAS.apInboxTimeline ? [reference.href] : []);
			const pin = pins.find(item => item.uri === uri);
			const defaultProfile = stringOf(pin?.defaultProfile);
			return { uri, name: stringOf(valueOf(doc.value).name) ?? uri, timelines: [...new Set(timelines)], communities: [...new Set(communities)], pinned: Boolean(pin), excludeSelf: pin?.excludeSelf === true, defaultPostHome: pin?.defaultPostHome === true, defaultPostTimelines: stringsOf(pin?.defaultPostTimelines), ...(defaultProfile ? { defaultProfile } : {}) };
		}));
		return lists.sort((a, b) => {
			const aIndex = pins.findIndex(pin => pin.uri === a.uri);
			const bIndex = pins.findIndex(pin => pin.uri === b.uri);
			return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex) || a.name.localeCompare(b.name);
		});
	}

	async getMessage(uri: string): Promise<ConcrntMessage> {
		this.check();
		resourceUri(uri);
		const document = await this.readDocument(uri);
		this.check();
		const message = normalizeConcrntMessage(uri, document);
		const [profile, counts, reactionCounts, own] = await Promise.all([
			this.profile(message.author, message.authorProfile).catch(() => null),
			this.publicRead(api => api.getAssociationCounts(uri)).catch(() => ({} as Record<string, number>)),
			this.publicRead(api => api.getAssociationCounts(uri, CONCRNT_SCHEMAS.reaction)).catch(() => ({} as Record<string, number>)),
			this.api.getAssociationsAll(uri, { author: this.ccid, schema: CONCRNT_SCHEMAS.reaction }).catch(() => [] as SignedDocument[]),
		]);
		this.check();
		if (profile) {
			message.authorName = profile.name;
			message.authorAvatarUrl = profile.avatarUrl;
		}
		message.associationCounts = counts;
		const ownByUrl = new Map<string, { shortcode: string; uris: string[] }>();
		for (const sd of own) {
			const doc = parseSigned(sd);
			if (doc.author !== this.ccid || doc.schema !== CONCRNT_SCHEMAS.reaction || doc.associate !== uri) continue;
			const value = valueOf(doc.value);
			const imageUrl = publicHttps(value.imageUrl);
			if (!imageUrl) continue;
			const current = ownByUrl.get(imageUrl) ?? { shortcode: stringOf(value.shortcode) ?? '', uris: [] };
			current.uris.push(sd.ccfs);
			ownByUrl.set(imageUrl, current);
		}
		message.reactions = [...new Set([...Object.keys(reactionCounts), ...ownByUrl.keys()])].flatMap(imageUrl => {
			if (!publicHttps(imageUrl)) return [];
			const ownReaction = ownByUrl.get(imageUrl);
			return [{ imageUrl, shortcode: ownReaction?.shortcode ?? '', count: reactionCounts[imageUrl] ?? ownReaction?.uris.length ?? 0, ownAssociationUris: ownReaction?.uris ?? [] }];
		});
		return message;
	}

	async getTimeline(profile: string, listUri?: string, cursor?: string): Promise<ConcrntPage<ConcrntMessage>> {
		this.check();
		const lists = await this.getLists(profile);
		const list = listUri ? lists.find(item => item.uri === listUri) : lists.find(item => item.pinned);
		if (listUri && !list) throw new Error('選択したリストが見つかりません。');
		const timelines = [...new Set([...(list?.excludeSelf ? [] : [concrntTimelineUri(this.ccid, profile, 'home')]), ...(list?.timelines ?? [])])];
		if (!timelines.length) return { items: [], next: null, unavailable: 0 };
		const before = cursor ? valueOf(JSON.parse(cursor)) : {};
		const seen = new Set(stringsOf(before.seen));
		const limit = Math.min(500, 40 + seen.size);
		const rows = await readWithRetry(() => this.api.getTimelineRanged(timelines, { limit, ...(before.until ? { until: new Date(iso(before.until)) } : {}) }, this.domain));
		this.check();
		const fresh = rows.filter(row => row.href && !seen.has(row.href));
		if (rows.length >= limit && fresh.length === 0) throw new Error('同じ時刻の投稿が多いため、続きを取得できませんでした。');
		const resolved = await settleLimited([...new Set(fresh.map(row => row.href!))], READ_CONCURRENCY, uri => this.getMessage(uri));
		this.check();
		const items = resolved.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
		const unavailable = resolved.filter(result => result.status === 'rejected').length;
		const oldest = rows.length ? Math.min(...rows.map(row => new Date(row.timestamp).getTime())) : NaN;
		const boundary = rows.filter(row => new Date(row.timestamp).getTime() === oldest).flatMap(row => row.href ? [row.href] : []);
		const previous = before.until === new Date(oldest || 0).toISOString() ? [...seen] : [];
		return { items, unavailable, next: rows.length >= limit && Number.isFinite(oldest) ? JSON.stringify({ until: new Date(oldest).toISOString(), seen: [...new Set([...previous, ...boundary])] }) : null };
	}

	async getNotifications(profile: string, cursor?: string): Promise<ConcrntPage<ConcrntNotification>> {
		this.check();
		const prefix = `${concrntTimelineUri(this.ccid, profile, 'notify')}/`;
		const page = await readWithRetry(() => this.api.query({ prefix, limit: 30, ...(cursor ? { until: cursor } : {}) }, this.domain, { cache: 'no-cache' }));
		const resolved = await settleLimited(page.items, READ_CONCURRENCY, async sd => {
			this.check();
			let document = parseSigned(sd);
			let uri = sd.cckv || sd.ccfs;
			if (document.schema === CONCRNT_SCHEMAS.reference) {
				uri = stringOf(valueOf(document.value).href) ?? '';
				resourceUri(uri);
				document = await this.readDocument(uri);
			}
			const value = valueOf(document.value);
			const name = profileOf(document.author, document);
			// The home server received this notification; it can resolve a remote sender the client has not seen.
			const authorProfile = await this.profile(document.author, name, this.domain).catch(() => null);
			const types: Record<string, ConcrntNotification['type']> = {
				[CONCRNT_SCHEMAS.reaction]: 'reaction', [CONCRNT_SCHEMAS.like]: 'like', [CONCRNT_SCHEMAS.replyAssociation]: 'reply',
				[CONCRNT_SCHEMAS.rerouteAssociation]: 'reroute', [CONCRNT_SCHEMAS.mention]: 'mention', [CONCRNT_SCHEMAS.follow]: 'follow',
			};
			const imageUrl = publicHttps(value.imageUrl);
			const type = types[document.schema] ?? 'other';
			const messageUri = stringOf(value.targetURI);
			// Replies and mentions show what was written; reactions show which post was reacted to.
			const preview = await this.excerpt(type === 'reply' || type === 'mention' ? messageUri ?? document.associate : document.associate);
			return {
				uri, schema: document.schema, type, author: document.author,
				authorName: authorProfile?.name ?? '', authorAvatarUrl: authorProfile?.avatarUrl, authorProfile: name,
				createdAt: iso(document.createdAt), targetUri: document.associate, messageUri,
				emoji: imageUrl ? { imageUrl, shortcode: stringOf(value.shortcode) ?? '' } : undefined,
				...(preview ? { preview } : {}),
			} satisfies ConcrntNotification;
		});
		this.check();
		return { items: resolved.flatMap(item => item.status === 'fulfilled' ? [item.value] : []), next: page.next === cursor ? null : page.next, unavailable: resolved.filter(item => item.status === 'rejected').length };
	}

	/** This is an observation at request time, not a complete policy evaluator. */
	private async requireAnonymous(uri: string): Promise<WireDocument> {
		this.check();
		if (!this.options.anonymousApi) throw new Error('公開範囲を匿名で確認できないため送信できません。');
		resourceUri(uri);
		const document = await this.options.anonymousApi.getDocument<unknown>(uri, undefined, { cache: 'no-cache', auth: 'no-auth' });
		this.check();
		if (!permitsPublicObservation(document)) throw new Error('公開範囲を確認できない設定があるため、公開投稿として送信できません。');
		return document;
	}

	private async publicDestinations(input: Pick<ConcrntPostInput, 'profile' | 'postHome' | 'destinations' | 'visibility' | 'replyTo'>, replyTarget?: ConcrntTarget): Promise<string[]> {
		if (input.visibility === 'inherit') return this.chosenDestinations(input);
		if (input.visibility !== 'public') throw new Error('この連携からは、公開範囲を確認できた投稿先だけへ投稿できます。');
		const profile = concrntProfileUri(this.ccid, input.profile);
		const source = input.replyTo ? replyTarget ?? await this.target(input.replyTo) : undefined;
		const destinations = [...new Set(source ? source.document.distributes ?? [] : [...(input.postHome === false ? [] : [concrntTimelineUri(this.ccid, input.profile, 'home')]), ...(input.destinations ?? [])])];
		if (source && !destinations.length) throw new Error('返信元の投稿先を確認できないため返信できません。');
		if (!destinations.length) throw new Error('投稿先を選択してください。');
		for (const uri of [profile, ...destinations]) await this.requireAnonymous(uri);
		return destinations;
	}

	/**
	 * world-app semantics: the chosen subprofile's home (optional) plus any chosen timelines, replies included.
	 * Who can read the post is decided by those timelines' and the profile's own policies, so nothing here
	 * claims the post is public; the composer says so explicitly.
	 */
	private chosenDestinations(input: Pick<ConcrntPostInput, 'profile' | 'postHome' | 'destinations'>): string[] {
		profileName(input.profile);
		const destinations = [...new Set([...(input.postHome === false ? [] : [concrntTimelineUri(this.ccid, input.profile, 'home')]), ...(input.destinations ?? [])])];
		if (!destinations.length) throw new Error('投稿先を選択してください。');
		for (const uri of destinations) resourceUri(uri);
		return destinations;
	}

	private async target(uri: string, visibility: ConcrntPostInput['visibility'] = 'public'): Promise<ConcrntTarget> {
		// A restricted post can be answered by those who can read it; only the strict public mode re-reads anonymously.
		const document = visibility === 'inherit' ? await this.readDocument(uri) : await this.requireAnonymous(uri);
		const key = document.key ?? (uri.startsWith('cckv://') ? uri : undefined);
		if (!key || document.kind !== 'record' || !key.startsWith(`cckv://${document.author}/concrnt.world/profiles/`) || !key.includes('/posts/')) throw new Error('元投稿の識別子を確認できません。');
		if (visibility !== 'inherit') {
			await this.requireAnonymous(concrntProfileUri(document.author, profileOf(document.author, document)));
			for (const timeline of document.distributes ?? []) await this.requireAnonymous(timeline);
		}
		const domain = await this.api.resolveDomain(resourceUri(key).hostname);
		this.check();
		return { key, document, domain, profile: profileOf(document.author, document) };
	}

	private operation(type: ConcrntOperation['type'], profile: string, visibility: ConcrntPostInput['visibility'] = 'public'): ConcrntOperation {
		return { version: 1, id: crypto.randomUUID(), ccid: this.ccid, domain: this.domain, profile, createdAt: new Date().toISOString(), type, status: 'prepared', steps: [], ...(visibility === 'inherit' ? { visibility } : {}) };
	}

	private step(id: ConcrntWriteStep['id'], document: WireDocument, domain = this.domain): ConcrntWriteStep {
		return { id, domain, document: JSON.stringify(document), state: 'prepared' };
	}

	private async save(operation: ConcrntOperation, options?: { create?: boolean; claimStep?: ConcrntWriteStep['id'] }): Promise<void> {
		if (!this.options.onOperation) throw new Error('送信記録の保存先がないため送信できません。');
		await this.options.onOperation(structuredClone(operation), options);
	}

	private result(operation: ConcrntOperation): ConcrntPublishResult {
		const record = operation.steps.find(step => step.id === 'record');
		const association = operation.steps.find(step => step.id === 'association' || step.id === 'reaction');
		return { status: operation.status, operation, messageUri: record ? stringOf(valueOf(JSON.parse(record.document)).key) : undefined, associationUri: association?.receipt?.ccfs, error: operation.error };
	}

	async publish(input: ConcrntPostInput): Promise<ConcrntPublishResult> {
		this.check();
		if (input.replyTo && input.quoteOf) throw new Error('返信と引用を同時には指定できません。');
		const operation = this.operation(input.quoteOf ? 'quote' : input.replyTo ? 'reply' : 'post', input.profile, input.visibility);
		const targetUri = input.replyTo ?? input.quoteOf;
		const target = targetUri ? await this.target(targetUri, input.visibility) : undefined;
		const distributes = await this.publicDestinations(input, input.replyTo ? target : undefined);
		let body = input.body;
		const medias = (input.media ?? []).map(media => {
			if (!publicHttps(media.url) || !media.type.startsWith('image/')) throw new Error('対応していない画像URLまたは形式です。');
			return media;
		});
		if (target && medias.length) {
			if (medias.some(media => media.flag)) throw new Error('返信・引用の画像には閲覧注意フラグを引き継げません。通常の画像投稿を使用してください。');
			// CFM 0.0.0 Image grammar: ![anything except ]](anything except )).
			// Reject an unrepresentable alt instead of silently changing its meaning.
			if (medias.some(media => /[\]\r\n]/.test(media.alt ?? ''))) throw new Error('返信・引用の画像説明には ] と改行を使用できません。');
			body += `\n\n${medias.map(media => `![${media.alt ?? ''}](${media.url.replace(/\)/g, '%29')})`).join('\n')}`;
		}
		if (input.quoteOf && target) body += `\n\n${concrntWebUrl(target.key)}`;
		if (!body.trim() && !medias.length) throw new Error('本文または画像を入力してください。');
		const createdAt = new Date(operation.createdAt);
		const key = `${concrntProfileUri(this.ccid, input.profile)}/posts/${CDID.newFromString(`${operation.id}:${body}`, createdAt).toString()}`;
		const schema = input.replyTo ? CONCRNT_SCHEMAS.reply : medias.length && !target ? CONCRNT_SCHEMAS.media : CONCRNT_SCHEMAS.markdown;
		const value: Value = { body, ...(input.emojis ? { emojis: input.emojis } : {}) };
		if (input.replyTo && target) Object.assign(value, { targetURI: target.key, replyToMessageAuthor: target.document.author });
		if (medias.length && !target) value.medias = medias.map(media => ({ mediaURL: media.url, mediaType: media.type, ...(media.alt ? { altText: media.alt } : {}), ...(media.flag ? { flag: media.flag } : {}), ...(media.blurhash ? { blurhash: media.blurhash } : {}) }));
		operation.steps.push(this.step('record', { kind: 'record', key, schema, value, author: this.ccid, distributes, createdAt }));
		if (target) operation.steps.push(this.step('association', {
			kind: 'association', schema: input.replyTo ? CONCRNT_SCHEMAS.replyAssociation : CONCRNT_SCHEMAS.rerouteAssociation,
			author: this.ccid, associate: target.key, value: { targetURI: key, ...(input.profile !== 'main' ? { profileURI: concrntProfileUri(this.ccid, input.profile) } : {}) },
			distributes: [concrntTimelineUri(this.ccid, input.profile, 'activity'), concrntTimelineUri(target.document.author, target.profile, 'notify')], createdAt,
		}, target.domain));
		return this.execute(operation, true);
	}

	private async execute(operation: ConcrntOperation, create = false): Promise<ConcrntPublishResult> {
		this.check();
		this.validateOperation(operation);
		if (this.executing.has(operation.id)) throw new Error('この処理は実行中です。');
		if (operation.steps.some(step => step.state === 'unknown' || step.state === 'submitting')) throw new Error('送信結果が不明なため、結果を確認するまで再送できません。');
		this.executing.add(operation.id);
		try {
			await this.save(operation, { create });
			for (const step of operation.steps) {
				if (step.state === 'confirmed') continue;
				this.check();
				step.state = 'submitting';
				try {
					await this.save(operation, { claimStep: step.id });
				} catch (error) {
					step.state = 'prepared';
					throw error;
				}
				try {
					this.check();
				} catch (error) {
					step.state = 'prepared';
					throw error;
				}
				try {
					const receipt = await this.api.commit(JSON.parse(step.document) as WireDocument, step.domain);
					if (!receipt?.ccfs || !sameDocument(parseSigned(receipt), step.document)) throw new Error('送信結果を文書と照合できません。');
					step.receipt = { cckv: receipt.cckv, ccfs: receipt.ccfs };
					step.state = 'confirmed';
					await this.save(operation);
				} catch (error) {
					if (step.state !== 'confirmed') step.state = 'unknown';
					throw error;
				}
			}
			operation.status = 'complete';
			delete operation.error;
			await this.save(operation);
		} catch (error) {
			operation.error = errorMessage(error);
			operation.status = operation.steps.some(step => step.state === 'confirmed') ? 'partial'
				: operation.steps.some(step => step.state === 'unknown' || step.state === 'submitting') ? 'unknown'
				: this.options.signal?.aborted ? 'cancelled' : 'failed';
			await this.save(operation).catch(() => {});
		} finally {
			this.executing.delete(operation.id);
		}
		return this.result(operation);
	}

	private validateOperation(operation: ConcrntOperation): void {
		if (operation.version !== 1 || operation.ccid !== this.ccid || operation.domain !== this.domain || !operation.steps.length) throw new Error('このアカウントの送信記録ではありません。');
		for (const step of operation.steps) {
			const document = valueOf(JSON.parse(step.document));
			if (document.author !== this.ccid) throw new Error('送信記録の所有者が一致しません。');
		}
	}

	/** Only a matching receipt proves success. A 404 or a network error never proves no delivery. */
	async resolveOperation(operation: ConcrntOperation): Promise<ConcrntPublishResult> {
		this.check();
		this.validateOperation(operation);
		if (this.executing.has(operation.id)) throw new Error('この処理は実行中です。送信結果を待ってください。');
		for (const step of operation.steps) {
			if (step.state !== 'unknown' && step.state !== 'submitting') continue;
			const document = JSON.parse(step.document) as WireDocument;
			let receipt: SignedDocument | undefined;
			try {
				if (document.key) {
					receipt = await this.api.getResource<SignedDocument>(document.key, step.domain, { cache: 'no-cache' });
				} else if (document.associate) {
					const associations = await this.api.getAssociationsAll(document.associate, { author: this.ccid, schema: document.schema }, step.domain);
					receipt = associations.find(sd => sameDocument(parseSigned(sd), step.document));
				}
				this.check();
				if (receipt?.ccfs && sameDocument(parseSigned(receipt), step.document)) {
					step.state = 'confirmed';
					step.receipt = { cckv: receipt.cckv, ccfs: receipt.ccfs };
				} else step.state = 'unknown';
			} catch {
				this.check();
				step.state = 'unknown';
			}
		}
		operation.status = operation.steps.every(step => step.state === 'confirmed') ? 'complete' : operation.steps.some(step => step.state === 'confirmed') ? 'partial' : 'unknown';
		await this.save(operation);
		return this.result(operation);
	}

	async retryOperation(operation: ConcrntOperation): Promise<ConcrntPublishResult> {
		this.validateOperation(operation);
		if (operation.steps.some(step => step.state === 'unknown' || step.state === 'submitting')) throw new Error('送信結果が不明なため、結果を確認するまで再送できません。');
		if (['post', 'reply', 'quote'].includes(operation.type)) {
			const recordStep = operation.steps.find(step => step.id === 'record');
			const document = recordStep ? JSON.parse(recordStep.document) as WireDocument : undefined;
			if (!document) throw new Error('投稿の送信記録を確認できません。');
			// Records written before the visibility field existed were always strict public posts.
			const visibility = operation.visibility ?? 'public';
			if (operation.type === 'reply' && visibility === 'public') {
				const original = stringOf(valueOf(document.value).targetURI);
				const source = original ? await this.target(original) : undefined;
				if (!source || stable([...(source.document.distributes ?? [])].sort()) !== stable([...(document.distributes ?? [])].sort())) throw new Error('返信元の投稿先が変わっています。結果を確認してください。');
			}
			await this.publicDestinations({ profile: operation.profile, postHome: false, destinations: document.distributes, visibility });
			const association = operation.steps.find(step => step.id === 'association' && step.state === 'prepared');
			if (association) {
				const targetUri = (JSON.parse(association.document) as WireDocument).associate;
				if (!targetUri || (await this.target(targetUri, visibility)).domain !== association.domain) throw new Error('元投稿の接続先が変わっています。結果を確認してください。');
			}
		}
		return this.execute(operation);
	}

	async addReaction(message: ConcrntMessage | string, emoji: ConcrntEmoji, profile: string): Promise<ConcrntPublishResult> {
		this.check();
		const uri = typeof message === 'string' ? message : message.key ?? message.uri;
		resourceUri(uri);
		const document = await this.readDocument(uri);
		// Counts carry only the image URL; reuse the name another reactor sent with it.
		if (publicHttps(emoji.imageUrl) && !emoji.shortcode) emoji = { ...emoji, shortcode: (await this.getReactionUsers(uri, emoji.imageUrl, 1).catch(() => null))?.shortcode ?? '' };
		if (!publicHttps(emoji.imageUrl) || !emoji.shortcode) throw new Error('リアクションの画像と名前を確認してください。');
		const domain = await this.api.resolveDomain(resourceUri(uri).hostname);
		const existing = await this.api.getAssociationsAll(uri, { author: this.ccid, schema: CONCRNT_SCHEMAS.reaction, variant: emoji.imageUrl }, domain);
		if (existing.some(sd => valueOf(parseSigned(sd).value).imageUrl === emoji.imageUrl)) throw new Error('このリアクションはすでに送信されています。');
		const operation = this.operation('reaction', profile);
		operation.steps.push(this.step('reaction', {
			kind: 'association', schema: CONCRNT_SCHEMAS.reaction, author: this.ccid, associate: uri, associationVariant: emoji.imageUrl,
			value: { shortcode: emoji.shortcode, imageUrl: emoji.imageUrl, ...(profile !== 'main' ? { profileURI: concrntProfileUri(this.ccid, profile) } : {}) },
			distributes: [concrntTimelineUri(this.ccid, profile, 'activity'), concrntTimelineUri(document.author, profileOf(document.author, document), 'notify')], createdAt: new Date(operation.createdAt),
		}, domain));
		return this.execute(operation, true);
	}

	async removeReaction(associationUri: string): Promise<ConcrntPublishResult> {
		this.check();
		if (resourceUri(associationUri).protocol !== 'ccfs:') throw new Error('解除するリアクションの識別子が不正です。');
		const document = await this.api.getDocument<unknown>(associationUri, undefined, { cache: 'no-cache' });
		if (document.author !== this.ccid || document.kind !== 'association' || document.schema !== CONCRNT_SCHEMAS.reaction) throw new Error('自分のリアクションだけ解除できます。');
		const domain = await this.api.resolveDomain(resourceUri(associationUri).hostname);
		const operation = this.operation('delete-reaction', profileOf(this.ccid, document));
		operation.steps.push(this.step('delete', { kind: 'delete', schema: CONCRNT_SCHEMAS.delete, author: this.ccid, value: associationUri, createdAt: new Date(operation.createdAt) }, domain));
		return this.execute(operation, true);
	}

	async prepareImageUpload(file: File, options: ConcrntUploadOptions): Promise<ConcrntUploadTicket> {
		this.check(options.signal);
		if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || !file.size) throw new Error('対応する画像ファイルを選択してください。');
		await this.publicDestinations(options);
		const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
		this.check(options.signal);
		const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
		const response = await this.api.callConcrntApi<{ content: { url: string; file: { url: string } } }>(this.domain, 'net.concrnt.storage.presign', {}, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type, size: file.size, sha256 }), signal: options.signal ?? this.options.signal,
		});
		this.check(options.signal);
		const uploadUrl = publicHttps(response.content?.url);
		const fileUrl = publicHttps(response.content?.file?.url);
		if (!uploadUrl || !fileUrl) throw new Error('画像の送信先を確認できません。');
		const ticket = { uploadUrl, fileUrl, contentType: file.type, sha256, size: file.size };
		this.uploadTickets.set(ticket, { file, snapshot: stable(ticket) });
		return ticket;
	}

	async uploadPreparedImage(file: File, ticket: ConcrntUploadTicket, options: ConcrntUploadOptions): Promise<ConcrntMedia> {
		this.check(options.signal);
		const issued = this.uploadTickets.get(ticket);
		if (!issued || issued.file !== file || issued.snapshot !== stable(ticket)) throw new Error('画像の送信準備をやり直してください。');
		// A ticket is single use. An aborted PUT is not automatically retried.
		this.uploadTickets.delete(ticket);
		await this.publicDestinations(options);
		this.check(options.signal);
		const signals = [this.options.signal, options.signal].filter((signal): signal is AbortSignal => Boolean(signal));
		const signal = signals.length ? AbortSignal.any(signals) : undefined;
		const response = await (this.options.uploadFetch ?? globalThis.fetch)(ticket.uploadUrl, {
			method: 'PUT', headers: { 'Content-Type': ticket.contentType }, body: file, signal,
			credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
		});
		this.check(options.signal);
		if (!response.ok) throw new Error('画像をアップロードできませんでした。');
		return { url: ticket.fileUrl, type: ticket.contentType, alt: file.name };
	}

	async uploadImage(file: File, options: ConcrntUploadOptions): Promise<ConcrntMedia> {
		const ticket = await this.prepareImageUpload(file, options);
		return this.uploadPreparedImage(file, ticket, options);
	}
}
