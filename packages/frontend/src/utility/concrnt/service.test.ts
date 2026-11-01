/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { ConcrntService, CONCRNT_SCHEMAS as schemas, concrntProfileUri, concrntTimelineUri, normalizeConcrntMessage } from './service.js';
import type { Api, Document, Server, SignedDocument } from '@concrnt/client';
import type { ConcrntServiceOptions } from './service.js';
import type { ConcrntOperation } from './types.js';
import { ConcrntStorage } from './storage.js';
import { ConcrntProtocolError } from './protocol.js';

const self = 'con1self';
const other = 'con1other';
const home = 'self.example';
const original = `${concrntProfileUri(other, 'work')}/posts/original`;
const date = new Date('2026-10-21T00:00:00.000Z');

function record(key: string, schema: string, value: unknown, author = self): Document<unknown> {
	return { kind: 'record', key, schema, value, author, createdAt: date };
}

function signed(document: Document<unknown>, ccfs = `ccfs://${other}/concrnt/receipt`): SignedDocument {
	return { cckv: document.key ?? '', ccfs, document: JSON.stringify(document), proof: { type: 'fixture', signature: 'fixture' } };
}

function setup(options: ConcrntServiceOptions = {}) {
	const docs = new Map<string, Document<unknown>>();
	for (const ccid of [self, other]) {
		for (const profile of ['main', 'work']) {
			const uri = concrntProfileUri(ccid, profile);
			docs.set(uri, record(uri, schemas.profile, { username: `${ccid}/${profile}` }, ccid));
			const timeline = concrntTimelineUri(ccid, profile, 'home');
			docs.set(timeline, record(timeline, 'https://schema.concrnt.world/t/user.json', {}, ccid));
			const lists = `${uri}/lists`;
			docs.set(lists, record(lists, 'pinned', [], ccid));
		}
	}
	docs.set(original, { ...record(original, schemas.markdown, { body: '元投稿の本文は転載しない' }, other), distributes: [concrntTimelineUri(other, 'work', 'home')] });
	const lookup = async (uri: string) => {
		const document = docs.get(uri);
		if (!document) throw new Error('missing');
		return structuredClone(document);
	};
	const api = {
		cache: {},
		getServer: vi.fn(async (_domain: string, _options?: unknown) => ({ domain: home, meta: { nickname: '接続先サーバー', logo: 'https://cdn.example/server.png' } }) as Server),
		getDocument: vi.fn(lookup),
		getResource: vi.fn(async (uri: string) => signed(await lookup(uri))),
		resolveDomain: vi.fn(async (owner: string) => owner === other ? 'source.example' : home),
		queryAll: vi.fn(async (_query: unknown) => [] as SignedDocument[]),
		query: vi.fn(async (_query: unknown) => ({ items: [] as SignedDocument[], next: null as string | null, prev: null })),
		getTimelineRanged: vi.fn(async (_timelines?: string[], _params?: unknown, _domain?: string) => [] as { href: string; timestamp: Date }[]),
		getAssociationCounts: vi.fn(async () => ({} as Record<string, number>)),
		getAssociationsAll: vi.fn(async () => [] as SignedDocument[]),
		getAssociations: vi.fn(async (_uri?: string, _query?: unknown) => ({ items: [] as SignedDocument[], next: null as string | null, prev: null })),
		commit: vi.fn(async (document: Document<unknown>, _domain?: string) => signed(document)),
		callConcrntApi: vi.fn(async (_host?: string, _endpoint?: string, _args?: unknown, _init?: unknown) => ({ content: { url: 'https://storage.example/upload?signed=one', file: { url: 'https://storage.example/image.png' } } })),
	};
	const anonymous = { cache: {}, getDocument: vi.fn(lookup) };
	const service = new ConcrntService(api as unknown as Api, self, home, { anonymousApi: anonymous as unknown as Api, onOperation: async () => {}, ...options });
	return { api, anonymous, docs, service };
}

describe('コンカレントの読み取り', () => {
	test('表示用サーバー情報は接続時のキャッシュだけから取り出す', async () => {
		const { api, service } = setup();
		await expect(service.getServerInfo()).resolves.toEqual({ domain: home, name: '接続先サーバー', iconUrl: 'https://cdn.example/server.png' });
		expect(api.getServer).toHaveBeenCalledExactlyOnceWith(home, { cache: 'cache-only' });
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('サーバー情報のキャッシュが使えなくてもドメイン表示へ戻す', async () => {
		const { api, service } = setup();
		api.getServer.mockRejectedValue(new ConcrntProtocolError('capability'));
		await expect(service.getServerInfo()).resolves.toEqual({ domain: home, name: home });
		expect(api.getServer).toHaveBeenCalledExactlyOnceWith(home, { cache: 'cache-only' });
	});

	test('別ドメインのサーバー名とアイコンを採用しない', async () => {
		const { api, service } = setup();
		api.getServer.mockResolvedValue({ domain: 'other.example', meta: { nickname: '別ドメイン', logo: 'https://other.example/icon.png' } } as Server);
		await expect(service.getServerInfo()).resolves.toEqual({ domain: home, name: home });
	});

	test('プロフィール一覧は所有者と直下のキーを確認し、既存データを作成しない', async () => {
		const { api, service } = setup();
		api.queryAll.mockResolvedValue([
			signed(record(concrntProfileUri(self, 'work'), schemas.profile, { username: '作業' })),
			signed(record(concrntProfileUri(self, 'main'), schemas.profile, { username: 'メイン' })),
			signed(record(concrntProfileUri(other, 'main'), schemas.profile, { username: '別の人' }, other)),
			signed(record(`${concrntProfileUri(self, 'main')}/posts/x`, schemas.profile, { username: '子文書' })),
		]);
		expect((await service.getProfiles()).map(profile => profile.id)).toEqual(['main', 'work']);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('未作成のリストは自動作成しない', async () => {
		const { api, service } = setup();
		class NotFoundError extends Error {}
		api.getDocument.mockRejectedValue(new NotFoundError('missing'));
		expect(await service.getLists('main')).toEqual([]);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('ピン設定だけが404でも既存リストの選択とタイムライン取得を続ける', async () => {
		const { api, service } = setup();
		const parent = `${concrntProfileUri(self, 'main')}/lists`;
		const listUri = `${parent}/friends`;
		const source = concrntTimelineUri(other, 'work', 'home');
		api.getDocument.mockRejectedValue(new ConcrntProtocolError('network', 404));
		api.queryAll.mockImplementation(async query => {
			const q = query as { parent?: string; prefix?: string };
			return q.parent === parent ? [signed(record(listUri, schemas.list, { name: '友達' }))]
				: q.prefix === `${listUri}/` ? [signed(record(`${listUri}/ref`, schemas.reference, { href: source }))] : [];
		});
		await expect(service.getLists('main')).resolves.toMatchObject([{ uri: listUri, name: '友達', timelines: [source], pinned: false }]);
		await expect(service.getTimeline('main', listUri)).resolves.toMatchObject({ items: [], next: null, unavailable: 0 });
		expect(api.getTimelineRanged.mock.calls[0]?.[0]).toEqual([concrntTimelineUri(self, 'main', 'home'), source]);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test.each([
		new ConcrntProtocolError('network', 403),
		new ConcrntProtocolError('network', 500),
		new ConcrntProtocolError('network'),
		new ConcrntProtocolError('auth', 404),
		new ConcrntProtocolError('capability', 404),
		Object.assign(new Error('unknown'), { status: 404 }),
		Object.assign(new Error('wrong status type'), { code: 'network', status: '404' }),
	])('ピン設定の取得失敗を404欠落以外は無視しない: %s', async error => {
		const { api, service } = setup();
		api.getDocument.mockRejectedValue(error);
		await expect(service.getLists('main')).rejects.toBe(error);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test.each(['lists', 'references'])('ピン以外の%s取得の404は欠落扱いで成功させない', async failedQuery => {
		const { api, service } = setup();
		const parent = `${concrntProfileUri(self, 'main')}/lists`;
		const listUri = `${parent}/friends`;
		const error = new ConcrntProtocolError('network', 404);
		api.getDocument.mockRejectedValue(new ConcrntProtocolError('network', 404));
		api.queryAll.mockImplementation(async query => {
			const q = query as { parent?: string; prefix?: string };
			if (failedQuery === 'lists' || q.prefix) throw error;
			return [signed(record(listUri, schemas.list, { name: '友達' }))];
		});
		await expect(service.getLists('main')).rejects.toBe(error);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('ホームは先頭ピンの参照先と自分のhomeを合わせ、取得失敗を区別する', async () => {
		const { api, docs, service } = setup();
		const parent = `${concrntProfileUri(self, 'main')}/lists`;
		const listUri = `${parent}/friends`;
		const source = concrntTimelineUri(other, 'work', 'home');
		docs.set(parent, record(parent, 'pinned', [{ uri: listUri, defaultPostHome: true }]));
		api.queryAll.mockImplementation(async query => {
			const q = query as { parent?: string; prefix?: string };
			return q.parent === parent ? [signed(record(listUri, schemas.list, { name: '友達' }))]
				: q.prefix === `${listUri}/` ? [signed(record(`${listUri}/ref`, schemas.reference, { href: source }))] : [];
		});
		api.getTimelineRanged.mockResolvedValue([{ href: original, timestamp: date }, { href: `${original}-missing`, timestamp: date }]);
		const page = await service.getTimeline('main');
		expect(api.getTimelineRanged.mock.calls[0]?.[0]).toEqual([concrntTimelineUri(self, 'main', 'home'), source]);
		expect(page.items.map(item => item.uri)).toEqual([original]);
		expect(page.unavailable).toBe(1);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('未知schemaをMarkdownへ変換せず、mediaのaltとflagを保持する', () => {
		const unknown = normalizeConcrntMessage(original, record(original, 'https://unknown.example/schema', { body: 'html<script>' }, other));
		expect(unknown.kind).toBe('unsupported');
		expect(unknown.body).toBe('');
		const media = normalizeConcrntMessage(original, record(original, schemas.media, { body: '画像', medias: [{ mediaURL: 'https://cdn.example/a.png', mediaType: 'image/png', altText: '説明', flag: 'sensitive' }] }, other));
		expect(media.media[0]).toMatchObject({ alt: '説明', flag: 'sensitive' });
		expect(media.visibility).toBe('unknown');
	});

	test('通知は選択サブprofileをqueryし、配送referenceを解決する', async () => {
		const { api, docs, service } = setup();
		const uri = `ccfs://${self}/concrnt/notification`;
		docs.set(uri, { kind: 'association', author: other, schema: schemas.rerouteAssociation, associate: original, value: { targetURI: `${original}-quote`, profileURI: concrntProfileUri(other, 'work') }, createdAt: date });
		api.query.mockResolvedValue({ items: [signed(record(`${concrntTimelineUri(self, 'work', 'notify')}/ref`, schemas.reference, { href: uri }))], next: 'cursor', prev: null });
		const page = await service.getNotifications('work');
		expect(api.query.mock.calls[0]?.[0]).toMatchObject({ prefix: `${concrntTimelineUri(self, 'work', 'notify')}/` });
		expect(page.items[0]).toMatchObject({ type: 'reroute', targetUri: original, messageUri: `${original}-quote`, authorProfile: 'work' });
		expect(page.next).toBe('cursor');
		expect(api.commit).not.toHaveBeenCalled();
	});
});

describe('コンカレントの公開確認と引用送信', () => {
	test('引用コメントと元リンクをMarkdownへ載せ、関連付けの向きと通知先を保持する', async () => {
		const events: string[] = [];
		const { api, anonymous, service } = setup({ onOperation: async operation => { events.push(`save:${operation.steps.map(step => step.state).join(',')}`); } });
		api.commit.mockImplementation(async (document, domain) => {
			events.push(`commit:${domain}`);
			expect(events.at(-2)).toContain('submitting');
			return signed(document);
		});
		const result = await service.publish({ profile: 'work', body: '引用コメント', quoteOf: original, visibility: 'public' });
		expect(result.status).toBe('complete');
		expect(api.commit).toHaveBeenCalledTimes(2);
		const q = api.commit.mock.calls[0]![0];
		const a = api.commit.mock.calls[1]![0];
		expect(q.schema).toBe(schemas.markdown);
		expect(q.key).toContain(`${concrntProfileUri(self, 'work')}/posts/`);
		expect(q.value).toEqual({ body: `引用コメント\n\nhttps://concrnt.world/post/${encodeURIComponent(original)}` });
		expect(a).toMatchObject({ kind: 'association', schema: schemas.rerouteAssociation, associate: original, value: { targetURI: q.key, profileURI: concrntProfileUri(self, 'work') }, distributes: [concrntTimelineUri(self, 'work', 'activity'), concrntTimelineUri(other, 'work', 'notify')] });
		expect(a.key).toBeUndefined();
		expect(api.commit.mock.calls[1]![1]).toBe('source.example');
		expect(anonymous.getDocument.mock.calls.some(([uri]) => uri === original)).toBe(true);
	});

	test('匿名で元投稿を読めない場合は返信も引用も送信しない', async () => {
		const { api, anonymous, service } = setup();
		anonymous.getDocument.mockImplementation(async uri => {
			if (uri === original) throw new Error('denied');
			return record(uri, schemas.profile, {});
		});
		await expect(service.publish({ profile: 'main', body: '返信', replyTo: original, visibility: 'public' })).rejects.toThrow();
		await expect(service.publish({ profile: 'main', body: '引用', quoteOf: original, visibility: 'public' })).rejects.toThrow();
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('匿名クライアントの未指定や認証キャッシュ共有は送信を許さない', async () => {
		const { api } = setup();
		const client = api as unknown as Api;
		expect(() => new ConcrntService(client, self, home, { anonymousApi: client })).toThrow('独立');
		await expect(new ConcrntService(client, self, home).publish({ profile: 'main', body: '投稿', visibility: 'public' })).rejects.toThrow('匿名');
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('匿名で読めても未知policyやread用defaultがあれば公開として送らない', async () => {
		const { api, docs, service } = setup();
		const uri = concrntProfileUri(self, 'main');
		for (const entry of [
			{ url: 'https://custom.example/dynamic.json' },
			{ url: 'https://policy.concrnt.world/t/write-public.json', defaults: { 'record:read': 'no' } },
			{ url: 'https://policy.concrnt.world/t/inline-read-write.json', params: { isReadPublic: false } },
		]) {
			docs.set(uri, { ...record(uri, schemas.profile, {}), policy: { entries: [entry] } });
			await expect(service.publish({ profile: 'main', body: '投稿', visibility: 'public' })).rejects.toThrow('公開範囲');
		}
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('既知の書込みだけを制御するpolicyは匿名確認と併用できる', async () => {
		const { api, docs, service } = setup();
		const uri = concrntTimelineUri(self, 'main', 'home');
		docs.set(uri, { ...record(uri, 'timeline', {}), policy: { entries: [{ url: 'https://policy.concrnt.world/t/write-public.json' }] } });
		expect((await service.publish({ profile: 'main', body: '投稿', visibility: 'public' })).status).toBe('complete');
		expect(api.commit).toHaveBeenCalledTimes(1);
	});

	test('引用元のプロフィールや投稿先に未知policyがあれば本文が読めても引用を止める', async () => {
		const { api, docs, service } = setup();
		const uri = concrntProfileUri(other, 'work');
		docs.set(uri, { ...record(uri, schemas.profile, {}, other), policy: { entries: [{ url: 'https://custom.example/private-rule' }] } });
		await expect(service.publish({ profile: 'main', body: '引用', quoteOf: original, visibility: 'public' })).rejects.toThrow('公開範囲');
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('画像返信はCFMの画像へ変換し、表現できないflagを落とさない', async () => {
		const { api, service } = setup();
		const media = { url: 'https://cdn.example/photo).png', type: 'image/png', alt: '風景' };
		await service.publish({ profile: 'main', body: '返信', replyTo: original, media: [media], visibility: 'public' });
		expect(api.commit.mock.calls[0]![0]).toMatchObject({ schema: schemas.reply, value: { body: '返信\n\n![風景](https://cdn.example/photo%29.png)', targetURI: original } });
		const count = api.commit.mock.calls.length;
		await expect(service.publish({ profile: 'main', body: '返信', replyTo: original, media: [{ ...media, flag: 'sensitive' }], visibility: 'public' })).rejects.toThrow('フラグ');
		expect(api.commit.mock.calls.length).toBe(count);
	});

	test('返信の投稿先は元投稿の集合に固定し、pickerや自身homeを追加しない', async () => {
		const { api, service } = setup();
		await service.publish({ profile: 'main', body: '返信', replyTo: original, postHome: true, destinations: ['cckv://different.example/community'], visibility: 'public' });
		expect(api.commit.mock.calls[0]![0].distributes).toEqual([concrntTimelineUri(other, 'work', 'home')]);
	});

	test('返信元の投稿先が空なら投稿も画像presignも開始しない', async () => {
		const { api, docs, service } = setup();
		docs.set(original, record(original, schemas.markdown, { body: '投稿先不明' }, other));
		await expect(service.publish({ profile: 'main', body: '返信', replyTo: original, visibility: 'public' })).rejects.toThrow('返信元の投稿先');
		await expect(service.prepareImageUpload(new File(['test'], 'test.png', { type: 'image/png' }), { profile: 'main', replyTo: original, visibility: 'public' })).rejects.toThrow('返信元の投稿先');
		expect(api.commit).not.toHaveBeenCalled();
		expect(api.callConcrntApi).not.toHaveBeenCalled();
	});
});

describe('コンカレントの絵文字購読の読取り', () => {
	test('購読referenceのパックを匿名GETし、リストを作成せず画像URLを取得する', async () => {
		const publicFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ emojis: [
			{ shortcode: 'flower', imageURL: 'https://emoji.example/flower.png' },
			{ shortcode: 'unsafe', imageURL: 'javascript:alert(1)' },
		] }), { headers: { 'Content-Type': 'application/json' } }));
		const { api, service } = setup({ publicFetch: publicFetch as typeof fetch });
		api.queryAll.mockResolvedValue([signed(record(`cckv://${self}/concrnt.world/emojipacks/one`, schemas.reference, { href: 'https://packs.example/flowers.json' }))]);
		expect(await service.getEmojis('work')).toEqual([{ shortcode: 'flower', imageUrl: 'https://emoji.example/flower.png' }]);
		// Package hosts (GitHub raw/gist) redirect; world-app follows them, and the landing URL is re-checked.
		expect(publicFetch.mock.calls[0]).toEqual(['https://packs.example/flowers.json', expect.objectContaining({ credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer' })]);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('購読パックはパックごとに名前とアイコンを保ち、安全でない転送先のパックは捨てる', async () => {
		const publicFetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			const response = new Response(JSON.stringify(url.includes('cats')
				? { name: 'ねこ', iconURL: 'https://emoji.example/cat-icon.png', emojis: [{ shortcode: 'cat', imageURL: 'https://emoji.example/cat.png' }] }
				: { name: '転送', emojis: [{ shortcode: 'x', imageURL: 'https://emoji.example/x.png' }] }));
			if (!url.includes('cats')) Object.defineProperty(response, 'url', { value: 'http://files.internal/pack.json' });
			return response;
		});
		const { api, service } = setup({ publicFetch: publicFetch as typeof fetch });
		api.queryAll.mockResolvedValue([
			signed(record(`cckv://${self}/concrnt.world/emojipacks/cats`, schemas.reference, { href: 'https://packs.example/cats.json' })),
			signed(record(`cckv://${self}/concrnt.world/emojipacks/moved`, schemas.reference, { href: 'https://packs.example/moved.json' })),
		]);
		expect(await service.getEmojiPackages()).toEqual([{ url: 'https://packs.example/cats.json', name: 'ねこ', iconUrl: 'https://emoji.example/cat-icon.png', emojis: [{ shortcode: 'cat', imageUrl: 'https://emoji.example/cat.png' }] }]);
	});

	test('購読未作成なら公式既定パックを読むだけで保存を増やさない', async () => {
		const publicFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"emojis":[]}'));
		const { api, service } = setup({ publicFetch: publicFetch as typeof fetch });
		expect(await service.getEmojis('main')).toEqual([]);
		expect(String(publicFetch.mock.calls[0]?.[0])).toContain('gist.githubusercontent.com/totegamma/');
		expect(api.commit).not.toHaveBeenCalled();
	});
});

describe('コンカレントの送信結果の照合', () => {
	test('別タブの古いprepared履歴は、送信中・確定後・削除後のいずれも再commitしない', async () => {
		const values = new Map<string, unknown>();
		const storage = new ConcrntStorage({
			get: async <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
			set: async (key, value) => { values.set(key, structuredClone(value)); },
			delete: async key => { values.delete(key); },
			keys: async () => [...values.keys()],
			clear: async () => { values.clear(); },
		});
		const owner = 'hataskey.example/fixture';
		let stale: ConcrntOperation | undefined;
		const onOperation: NonNullable<ConcrntServiceOptions['onOperation']> = async (operation, options) => {
			if (options?.create) stale = structuredClone(operation);
			await storage.saveOperation(owner, operation, options);
		};
		const first = setup({ onOperation });
		let finish!: (value: SignedDocument) => void;
		first.api.commit.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		const pending = first.service.publish({ profile: 'main', body: '一度だけ送信する', visibility: 'public' });
		await vi.waitFor(() => expect(first.api.commit).toHaveBeenCalledOnce());
		const second = setup({ onOperation });
		const retry = async () => {
			expect(stale).toBeDefined();
			const result = await second.service.retryOperation(structuredClone(stale!));
			expect(result.status).toBe('failed');
			expect(second.api.commit).not.toHaveBeenCalled();
		};
		await retry();
		expect((await storage.loadOperations(owner, self))[0]!.steps[0]!.state).toBe('submitting');
		finish(signed(first.api.commit.mock.calls[0]![0]));
		expect((await pending).status).toBe('complete');
		await retry();
		expect((await storage.loadOperations(owner, self))[0]!.status).toBe('complete');
		await storage.removeOwner(owner);
		await retry();
		expect(await storage.loadOperations(owner, self)).toEqual([]);
	});

	test('投稿本体の応答が失われたら再送せず、同じ文書の受理確認後に関連付けだけを送る', async () => {
		const { api, service } = setup();
		let accepted: Document<unknown> | undefined;
		api.commit.mockImplementationOnce(async document => { accepted = document; throw new Error('response lost'); });
		const first = await service.publish({ profile: 'main', body: '引用', quoteOf: original, visibility: 'public' });
		expect(first.status).toBe('unknown');
		expect(first.operation.steps.map(step => step.state)).toEqual(['unknown', 'prepared']);
		await expect(service.retryOperation(first.operation)).rejects.toThrow('結果が不明');
		expect(api.commit).toHaveBeenCalledTimes(1);
		api.getResource.mockResolvedValue(signed(accepted!));
		const checked = await service.resolveOperation(first.operation);
		expect(checked.status).toBe('partial');
		const completed = await service.retryOperation(first.operation);
		expect(completed.status).toBe('complete');
		expect(api.commit).toHaveBeenCalledTimes(2);
		expect(api.commit.mock.calls[1]![0].kind).toBe('association');
	});

	test('存在しないという応答や別のpayloadでは不明を解除しない', async () => {
		const { api, service } = setup();
		api.commit.mockRejectedValue(new Error('offline'));
		const result = await service.publish({ profile: 'main', body: '投稿', visibility: 'public' });
		api.getResource.mockRejectedValueOnce(new Error('404'));
		expect((await service.resolveOperation(result.operation)).status).toBe('unknown');
		const different = JSON.parse(result.operation.steps[0]!.document) as Document<unknown>;
		different.value = { body: '別の投稿' };
		api.getResource.mockResolvedValue(signed(different));
		expect((await service.resolveOperation(result.operation)).status).toBe('unknown');
		await expect(service.retryOperation(result.operation)).rejects.toThrow();
		expect(api.commit).toHaveBeenCalledTimes(1);
	});

	test('通知associationだけ不明な場合は同一associationを探し、投稿本体を再送しない', async () => {
		const { api, service } = setup();
		api.commit.mockImplementationOnce(async doc => signed(doc)).mockRejectedValueOnce(new Error('lost'));
		const result = await service.publish({ profile: 'main', body: '引用', quoteOf: original, visibility: 'public' });
		expect(result.status).toBe('partial');
		const association = JSON.parse(result.operation.steps[1]!.document) as Document<unknown>;
		api.getAssociationsAll.mockResolvedValue([signed(association)]);
		expect((await service.resolveOperation(result.operation)).status).toBe('complete');
		expect(api.commit).toHaveBeenCalledTimes(2);
		expect(api.getResource).not.toHaveBeenCalled();
	});

	test('journalが保存できなければ送信せず、プロフィール変更時の中断で次phaseを止める', async () => {
		const refused = setup({ onOperation: async () => { throw new Error('disk full'); } });
		expect((await refused.service.publish({ profile: 'main', body: '投稿', visibility: 'public' })).status).toBe('failed');
		expect(refused.api.commit).not.toHaveBeenCalled();
		const controller = new AbortController();
		const active = setup({ signal: controller.signal, onOperation: async operation => {
			if (operation.steps[0]?.state === 'confirmed') controller.abort();
		} });
		const result = await active.service.publish({ profile: 'main', body: '引用', quoteOf: original, visibility: 'public' });
		expect(result.status).toBe('partial');
		expect(result.operation.steps.map(step => step.state)).toEqual(['confirmed', 'prepared']);
		expect(active.api.commit).toHaveBeenCalledTimes(1);
	});

	test('別アカウントのjournalを再実行しない', async () => {
		const { api, service } = setup();
		const forged: ConcrntOperation = { version: 1, id: 'other', ccid: other, domain: home, profile: 'main', createdAt: date.toISOString(), type: 'post', status: 'prepared', steps: [{ id: 'record', domain: home, document: JSON.stringify(record(original, schemas.markdown, { body: '別人' }, other)), state: 'prepared' }] };
		await expect(service.retryOperation(forged)).rejects.toThrow('アカウント');
		expect(api.commit).not.toHaveBeenCalled();
	});
});

describe('コンカレントの画像送信', () => {
	function file() {
		const image = new File(['test'], 'sample.png', { type: 'image/png' });
		Object.defineProperty(image, 'arrayBuffer', { value: async () => new TextEncoder().encode('test').buffer });
		return image;
	}

	test('presignとPUTを分離し、外部storageへ認証情報を付けない', async () => {
		const upload = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response);
		const { api, service } = setup({ uploadFetch: upload as typeof fetch });
		const image = file();
		const options = { profile: 'main', visibility: 'public' as const };
		const ticket = await service.prepareImageUpload(image, options);
		expect(upload).not.toHaveBeenCalled();
		expect(api.callConcrntApi.mock.calls[0]?.[1]).toBe('net.concrnt.storage.presign');
		const media = await service.uploadPreparedImage(image, ticket, options);
		expect(media).toMatchObject({ url: 'https://storage.example/image.png', type: 'image/png' });
		expect(upload.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { 'Content-Type': 'image/png' } });
		await expect(service.uploadPreparedImage(image, ticket, options)).rejects.toThrow('準備');
		expect(upload).toHaveBeenCalledTimes(1);
	});

	test('公開確認に失敗した画像や書き換えられた送信先をアップロードしない', async () => {
		const upload = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true }) as Response);
		const { api, anonymous, service } = setup({ uploadFetch: upload as typeof fetch });
		const image = file();
		const options = { profile: 'main', visibility: 'public' as const };
		const ticket = await service.prepareImageUpload(image, options);
		ticket.uploadUrl = 'https://different.example/upload';
		await expect(service.uploadPreparedImage(image, ticket, options)).rejects.toThrow('準備');
		anonymous.getDocument.mockRejectedValue(new Error('private'));
		await expect(service.uploadImage(image, options)).rejects.toThrow();
		expect(upload).not.toHaveBeenCalled();
		expect(api.callConcrntApi).toHaveBeenCalledTimes(1);
	});
});

describe('CTL表示のための読み取り', () => {
	function reaction(author: string, imageUrl: string, shortcode: string): SignedDocument {
		return signed({ kind: 'association', schema: schemas.reaction, author, associate: original, value: { imageUrl, shortcode }, createdAt: date } as Document<unknown>, `ccfs://${author}/reaction`);
	}

	test('投稿者名が無いときにCCIDを名前として返さない', () => {
		const message = normalizeConcrntMessage(original, record(original, schemas.markdown, { body: '本文' }, other));
		expect(message.authorName).toBe('');
		expect(message.author).toBe(other);
	});

	test('リアクションした人を絵文字ごとに取得し、名前とアイコンを解決する', async () => {
		const { api, service } = setup();
		api.getAssociations.mockResolvedValue({ items: [reaction(other, 'https://cdn.example/like.png', 'like'), reaction(other, 'https://cdn.example/like.png', 'like'), reaction(self, 'https://cdn.example/other.png', 'nope')], next: null, prev: null });
		const result = await service.getReactionUsers(original, 'https://cdn.example/like.png', 10);
		// The reaction list and its reactors are read through the server that holds the post.
		expect(api.getAssociations).toHaveBeenCalledWith(original, { schema: schemas.reaction, variant: 'https://cdn.example/like.png', limit: 10 }, 'source.example');
		// Like world-app, users are resolved without a hint first.
		expect(api.getDocument).toHaveBeenCalledWith(concrntProfileUri(other, 'main'), undefined, expect.anything());
		expect(result.shortcode).toBe('like');
		expect(result.users).toEqual([{ ccid: other, profile: 'main', name: `${other}/main`, avatarUrl: undefined }]);
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('件数だけ分かるリアクションへ乗るときは、既存の名前を引き継いで送る', async () => {
		const { api, service } = setup();
		api.getAssociations.mockResolvedValue({ items: [reaction(other, 'https://cdn.example/like.png', 'like')], next: null, prev: null });
		const result = await service.addReaction(original, { imageUrl: 'https://cdn.example/like.png', shortcode: '' }, 'main');
		expect(result.status).toBe('complete');
		const sent = api.commit.mock.calls[0]?.[0] as Document<{ shortcode: string; imageUrl: string }>;
		expect(sent.value).toMatchObject({ shortcode: 'like', imageUrl: 'https://cdn.example/like.png' });
	});

	test('名前を確認できないリアクションは送らない', async () => {
		const { service, api } = setup();
		await expect(service.addReaction(original, { imageUrl: 'https://cdn.example/like.png', shortcode: '' }, 'main')).rejects.toThrow('リアクションの画像と名前');
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('通知には関連投稿の本文の抜粋を付け、画像記法は含めない', async () => {
		const { api, docs, service } = setup();
		const uri = `ccfs://${self}/concrnt/reaction-notification`;
		docs.set(uri, { kind: 'association', author: other, schema: schemas.reaction, associate: original, value: { imageUrl: 'https://cdn.example/like.png', shortcode: 'like' }, createdAt: date });
		docs.set(original, { ...record(original, schemas.markdown, { body: 'わたしの投稿\n![図](https://cdn.example/a.png)' }, other) });
		api.query.mockResolvedValue({ items: [signed(record(`${concrntTimelineUri(self, 'main', 'notify')}/ref`, schemas.reference, { href: uri }))], next: null, prev: null });
		const page = await service.getNotifications('main');
		expect(page.items[0]).toMatchObject({ type: 'reaction', preview: 'わたしの投稿', emoji: { shortcode: 'like' } });
	});

	test('他ユーザーのプロフィールは不正な識別子を拒み、バナーを公開URLだけ返す', async () => {
		const { docs, service } = setup();
		const uri = concrntProfileUri(other, 'main');
		docs.set(uri, record(uri, schemas.profile, { username: '相手', banner: 'https://cdn.example/banner.png', avatar: 'http://insecure.example/a.png' }, other));
		await expect(service.getUserProfile(other)).resolves.toMatchObject({ ccid: other, name: '相手', bannerUrl: 'https://cdn.example/banner.png', avatarUrl: undefined });
		await expect(service.getUserProfile('../x')).rejects.toThrow();
	});
});

describe('world-app と同じ宛先の選び方（inherit）', () => {
	test('鍵プロフィールや非公開のタイムラインへも、匿名確認なしで選んだ宛先だけへ送る', async () => {
		const { anonymous, api, service } = setup();
		const community = 'cckv://ccs1community/concrnt.world/communities/secret';
		const result = await service.publish({ profile: 'work', body: '鍵の投稿', postHome: true, destinations: [community], visibility: 'inherit' });
		expect(result.status).toBe('complete');
		const sent = api.commit.mock.calls[0]?.[0] as Document<unknown>;
		expect(sent.distributes).toEqual([concrntTimelineUri(self, 'work', 'home'), community]);
		expect(result.operation.visibility).toBe('inherit');
		expect(anonymous.getDocument).not.toHaveBeenCalled();
	});

	test('返信も元投稿の宛先に固定せず、選んだ宛先へ送る', async () => {
		const { api, service } = setup();
		const result = await service.publish({ profile: 'main', body: '返信', postHome: true, destinations: [], replyTo: original, visibility: 'inherit' });
		expect(result.status).toBe('complete');
		const [record, association] = api.commit.mock.calls.map(call => call[0] as Document<unknown>);
		expect(record.distributes).toEqual([concrntTimelineUri(self, 'main', 'home')]);
		expect(association.associate).toBe(original);
	});

	test('宛先が一つもなければ送らない', async () => {
		const { api, service } = setup();
		await expect(service.publish({ profile: 'main', body: '宛先なし', postHome: false, destinations: [], visibility: 'inherit' })).rejects.toThrow('投稿先を選択してください');
		expect(api.commit).not.toHaveBeenCalled();
	});

	test('一時的な通信失敗は読み取りだけ1回やり直す', async () => {
		const { anonymous, api, service } = setup();
		const transientError = Object.assign(new Error('busy'), { code: 'network', status: 503 });
		api.getDocument.mockRejectedValueOnce(transientError);
		await expect(service.getMessage(original)).resolves.toMatchObject({ uri: original });
		// A refusal is not retried with the same token; a public post is read again without credentials instead.
		const forbidden = Object.assign(new Error('forbidden'), { code: 'auth', status: 403 });
		api.getDocument.mockRejectedValueOnce(forbidden);
		const before = api.getDocument.mock.calls.length;
		await expect(service.getMessage(original)).resolves.toMatchObject({ uri: original });
		expect(api.getDocument.mock.calls.slice(before).filter(call => call[0] === original)).toHaveLength(1);
		expect(anonymous.getDocument).toHaveBeenCalledWith(original, undefined, expect.objectContaining({ auth: 'no-auth' }));
	});

	test('同じ投稿者のプロフィールは接続中しばらく使い回す', async () => {
		const { api, service } = setup();
		await service.getMessage(original);
		await service.getMessage(original);
		const profileReads = api.getDocument.mock.calls.filter(call => call[0] === concrntProfileUri(other, 'work'));
		expect(profileReads).toHaveLength(1);
	});
});

describe('投稿先の候補', () => {
	test('リストの中のフォロー中ユーザーのホームは読むが、投稿先の候補はコミュニティとAP受信箱だけにする', async () => {
		const { api, service } = setup();
		const parent = `${concrntProfileUri(self, 'main')}/lists`;
		const listUri = `${parent}/mixed`;
		const followed = concrntTimelineUri(other, 'main', 'home');
		const community = 'cckv://ccs1community/concrnt.world/communities/flowers';
		const inbox = 'cckv://ccs1community/concrnt.world/ap/inbox';
		const legacy = 'cckv://ccs1community/concrnt.world/communities/legacy';
		api.queryAll.mockImplementation(async query => {
			const q = query as { parent?: string; prefix?: string };
			return q.parent === parent ? [signed(record(listUri, schemas.list, { name: '混在' }))]
				: q.prefix === `${listUri}/` ? [
					signed(record(`${listUri}/a`, schemas.reference, { href: followed, schema: 'https://schema.concrnt.world/t/user.json' })),
					signed(record(`${listUri}/b`, schemas.reference, { href: community, schema: 'https://schema.concrnt.world/t/community.json' })),
					signed(record(`${listUri}/c`, schemas.reference, { href: inbox, schema: 'https://schema.concrnt.world/ap/inbox.json' })),
					signed(record(`${listUri}/d`, schemas.reference, { href: legacy })),
				] : [];
		});
		const [list] = await service.getLists('main');
		expect(list.timelines).toEqual([followed, community, inbox, legacy]);
		expect(list.communities).toEqual([community, inbox]);
	});
});

describe('他サーバーに断られた公開データの読み直し', () => {
	test('リアクションした人のプロフィールが認証付きで拒否されたら、認証なしで読み直して名前を出す', async () => {
		const { anonymous, api, service } = setup();
		const reactor = 'con1reactor';
		const profileUri = concrntProfileUri(reactor, 'main');
		const forbidden = Object.assign(new Error('forbidden'), { code: 'auth', status: 401 });
		api.getDocument.mockImplementation(async (uri: string) => {
			if (uri === profileUri) throw forbidden;
			throw new Error('missing');
		});
		anonymous.getDocument.mockImplementation(async (uri: string) => {
			if (uri === profileUri) return record(profileUri, schemas.profile, { username: 'リアクションした人', avatar: 'https://cdn.example/r.png' }, reactor);
			throw new Error('missing');
		});
		api.getAssociations.mockResolvedValue({ items: [signed({ kind: 'association', schema: schemas.reaction, author: reactor, associate: original, value: { imageUrl: 'https://cdn.example/like.png', shortcode: 'like' }, createdAt: date } as Document<unknown>)], next: null, prev: null });
		const result = await service.getReactionUsers(original, 'https://cdn.example/like.png');
		expect(result.users).toEqual([{ ccid: reactor, profile: 'main', name: 'リアクションした人', avatarUrl: 'https://cdn.example/r.png' }]);
		expect(anonymous.getDocument).toHaveBeenCalledWith(profileUri, undefined, expect.objectContaining({ auth: 'no-auth' }));
	});

	test('リアクションのprofileOverrideは本家と同じくプロフィールより優先する', async () => {
		const { api, service } = setup();
		api.getAssociations.mockResolvedValue({ items: [signed({ kind: 'association', schema: schemas.reaction, author: other, associate: original, value: { imageUrl: 'https://cdn.example/like.png', shortcode: 'like', profileOverride: { username: '代理の名前' } }, createdAt: date } as Document<unknown>)], next: null, prev: null });
		const result = await service.getReactionUsers(original, 'https://cdn.example/like.png');
		expect(result.users[0]?.name).toBe('代理の名前');
	});
});
