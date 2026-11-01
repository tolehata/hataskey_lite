/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConcrntStorage, defaultConcrntSettings, normalizeConcrntSettings } from './storage.js';
import type { ConcrntStorageBackend } from './storage.js';
import type { ConcrntCredential } from './protocol.js';
import type { ConcrntOperation } from './types.js';

const owner = 'hataskey.example/user-one';
const otherOwner = 'hataskey.example/user-two';
const credential: ConcrntCredential = { ccid: 'con1fixture', ckid: 'cck1fixture', domain: 'social.example', secret: 'private-test-fixture-do-not-export' };

function memory() {
	const values = new Map<string, unknown>();
	const backend: ConcrntStorageBackend = {
		get: async <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
		set: vi.fn(async (key: string, value: unknown) => { values.set(key, structuredClone(value)); }),
		delete: async key => { values.delete(key); },
		keys: async () => [...values.keys()],
		clear: async () => { values.clear(); },
	};
	return { values, backend, storage: new ConcrntStorage(backend) };
}

function operation(id: string, ccid = credential.ccid): ConcrntOperation {
	return { version: 1, id, ccid, domain: credential.domain, profile: 'main', createdAt: '2026-10-21T00:00:00.000Z', type: 'post', status: 'unknown', steps: [{ id: 'record', domain: credential.domain, document: '{"kind":"record"}', state: 'unknown' }] };
}

beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('コンカレントの資格情報保存', () => {
	test('設定と暗号化した接続情報を同じ一件へ保存し、非extractable鍵で復元する', async () => {
		const { values, backend, storage } = memory();
		const settings = { ...defaultConcrntSettings(), profile: 'work', notifications: false };
		await storage.saveConnection(owner, credential, settings);
		expect(backend.set).toHaveBeenCalledTimes(1);
		expect(values.size).toBe(1);
		expect(JSON.stringify([...values])).not.toContain(credential.secret);
		const stored = [...values.values()][0] as { credential: { key: CryptoKey } };
		expect(stored.credential.key.extractable).toBe(false);
		await expect(crypto.subtle.exportKey('raw', stored.credential.key)).rejects.toThrow();
		expect(await storage.loadCredential(owner)).toEqual(credential);
		expect(await storage.loadSettings(owner)).toEqual(settings);
	});

	test('保存の失敗で新しい鍵と古い設定が混在しない', async () => {
		const { backend, storage } = memory();
		const settings = defaultConcrntSettings();
		await storage.saveConnection(owner, credential, settings);
		vi.mocked(backend.set).mockRejectedValueOnce(new Error('quota'));
		await expect(storage.saveConnection(owner, { ...credential, secret: 'new-secret', ccid: 'con1new' }, { ...settings, profile: 'work' })).rejects.toThrow('quota');
		expect(await storage.loadCredential(owner)).toEqual(credential);
		expect(await storage.loadSettings(owner)).toEqual(settings);
	});

	test('初期化用のloadConnectionは設定と鍵を同じ一回のreadから返す', async () => {
		const { backend, storage } = memory();
		const settings = { ...defaultConcrntSettings(), profile: 'work' };
		await storage.saveConnection(owner, credential, settings);
		const read = vi.spyOn(backend, 'get');
		expect(await storage.loadConnection(owner)).toEqual({ settings, credential });
		expect(read).toHaveBeenCalledTimes(1);
	});

	test('sessionへ切替失敗時は元の組を維持し、成功時は鍵と暗号文を同時に外す', async () => {
		const { values, backend, storage } = memory();
		const settings = defaultConcrntSettings();
		await storage.saveConnection(owner, credential, settings);
		vi.mocked(backend.set).mockRejectedValueOnce(new Error('quota'));
		await expect(storage.saveConnection(owner, credential, { ...settings, save: 'session' })).rejects.toThrow();
		expect((await storage.loadSettings(owner)).save).toBe('device');
		expect(await storage.loadCredential(owner)).toEqual(credential);
		await storage.saveConnection(owner, credential, { ...settings, save: 'session' });
		expect(await storage.loadCredential(owner)).toBeNull();
		expect((await storage.loadSettings(owner)).save).toBe('session');
		expect([...values.values()][0]).toMatchObject({ credential: null });
	});

	test('別ownerへ暗号化レコードを移してもAAD照合で復号できない', async () => {
		const { values, storage } = memory();
		await storage.saveConnection(owner, credential, defaultConcrntSettings());
		values.set(`${encodeURIComponent(otherOwner)}:connection`, structuredClone([...values.values()][0]));
		await expect(storage.loadCredential(otherOwner)).rejects.toThrow();
		expect(await storage.loadCredential(owner)).toEqual(credential);
	});

	test('暗号文の改変を検出する', async () => {
		const { values, storage } = memory();
		await storage.saveConnection(owner, credential, defaultConcrntSettings());
		const key = `${encodeURIComponent(owner)}:connection`;
		const stored = values.get(key) as { credential: { cipher: ArrayBuffer } };
		new Uint8Array(stored.credential.cipher)[0] ^= 1;
		await expect(storage.loadCredential(owner)).rejects.toThrow();
	});

	test('解除は設定を保ちながら資格情報を外す', async () => {
		const { storage } = memory();
		const settings = { ...defaultConcrntSettings(), profile: 'work' };
		await storage.saveConnection(owner, credential, settings);
		await storage.forgetCredential(owner);
		expect(await storage.loadCredential(owner)).toBeNull();
		expect(await storage.loadSettings(owner)).toEqual(settings);
	});
});

describe('コンカレントのownerとprofileの分離', () => {
	test('リスト選択をowner・CCID・profile別に保存し、nullで解除する', async () => {
		const { storage } = memory();
		await storage.saveListSelection(owner, credential.ccid, 'main', 'cckv://con1fixture/list/main');
		await storage.saveListSelection(owner, credential.ccid, 'work', 'cckv://con1fixture/list/work');
		await storage.saveListSelection(otherOwner, credential.ccid, 'main', 'cckv://con1fixture/list/other');
		expect(await storage.loadListSelection(owner, credential.ccid, 'main')).toBe('cckv://con1fixture/list/main');
		expect(await storage.loadListSelection(owner, credential.ccid, 'work')).toBe('cckv://con1fixture/list/work');
		expect(await storage.loadListSelection(owner, 'con1different', 'main')).toBeNull();
		await storage.saveListSelection(owner, credential.ccid, 'main', null);
		expect(await storage.loadListSelection(owner, credential.ccid, 'main')).toBeNull();
		expect(await storage.loadListSelection(otherOwner, credential.ccid, 'main')).toBe('cckv://con1fixture/list/other');
	});

	test('同時に既読を追加しても片側を失わず、owner/profileを混ぜない', async () => {
		const { backend, storage } = memory();
		const secondTab = new ConcrntStorage(backend);
		await Promise.all([storage.markRead(owner, credential.ccid, 'main', ['a']), secondTab.markRead(owner, credential.ccid, 'main', ['b'])]);
		expect(await storage.loadRead(owner, credential.ccid, 'main')).toEqual(['a', 'b']);
		expect(await storage.loadRead(owner, credential.ccid, 'work')).toEqual([]);
		expect(await storage.loadRead(otherOwner, credential.ccid, 'main')).toEqual([]);
	});

	test('独立した送信journalを失わず、別CCIDを読み込まない', async () => {
		const { storage } = memory();
		await Promise.all([storage.saveOperation(owner, operation('one'), { create: true }), storage.saveOperation(owner, operation('two'), { create: true }), storage.saveOperation(owner, operation('different', 'con1different'), { create: true })]);
		expect((await storage.loadOperations(owner, credential.ccid)).map(item => item.id).sort()).toEqual(['one', 'two']);
		expect(await storage.loadOperations(otherOwner, credential.ccid)).toEqual([]);
	});

	test('遅延した不明結果で確認済みreceiptを上書きせず、同じIDの別payloadを拒否する', async () => {
		const { storage } = memory();
		const pending = operation('same');
		await storage.saveOperation(owner, pending, { create: true });
		const complete = structuredClone(pending);
		complete.steps[0]!.state = 'confirmed';
		complete.steps[0]!.receipt = { cckv: 'cckv://fixture/post', ccfs: 'ccfs://fixture/concrnt/receipt' };
		complete.status = 'complete';
		await storage.saveOperation(owner, complete);
		await storage.saveOperation(owner, pending);
		expect((await storage.loadOperations(owner, credential.ccid))[0]).toMatchObject({ status: 'complete', steps: [{ state: 'confirmed', receipt: complete.steps[0]!.receipt }] });
		pending.steps[0]!.document = '{"kind":"different"}';
		await expect(storage.saveOperation(owner, pending)).rejects.toThrow('内容が一致');
	});

	test('同じ未送信段階を獲得できるのは一つのタブだけで、古いpreparedへ戻さない', async () => {
		const { backend, storage } = memory();
		const secondTab = new ConcrntStorage(backend);
		const prepared = operation('race');
		prepared.steps[0]!.state = 'prepared';
		prepared.status = 'prepared';
		await storage.saveOperation(owner, prepared, { create: true });
		const submitting = structuredClone(prepared);
		submitting.steps[0]!.state = 'submitting';
		const claims = await Promise.allSettled([
			storage.saveOperation(owner, submitting, { claimStep: 'record' }),
			secondTab.saveOperation(owner, submitting, { claimStep: 'record' }),
		]);
		expect(claims.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
		await secondTab.saveOperation(owner, prepared);
		expect((await storage.loadOperations(owner, credential.ccid))[0]).toMatchObject({ status: 'unknown', steps: [{ state: 'submitting' }] });
	});

	test.each(['unknown', 'confirmed'] as const)('%sへ進んだ履歴は古い未送信履歴から獲得できない', async state => {
		const { storage } = memory();
		const prior = operation('advanced');
		prior.steps[0]!.state = state;
		await storage.saveOperation(owner, prior, { create: true });
		const stale = structuredClone(prior);
		stale.steps[0]!.state = 'prepared';
		await storage.saveOperation(owner, stale);
		stale.steps[0]!.state = 'submitting';
		await expect(storage.saveOperation(owner, stale, { claimStep: 'record' })).rejects.toThrow('別の処理');
		expect((await storage.loadOperations(owner, credential.ccid))[0]!.steps[0]!.state).toBe(state);
	});

	test('削除後の遅いreceipt更新は同じatomic updateで拒否し履歴を作り直さない', async () => {
		const { storage } = memory();
		const pending = operation('removed');
		await storage.saveOperation(owner, pending, { create: true });
		await storage.removeOwner(owner);
		pending.steps[0]!.state = 'confirmed';
		await expect(storage.saveOperation(owner, pending)).rejects.toThrow('変更されています');
		expect(await storage.loadOperations(owner, credential.ccid)).toEqual([]);
	});

	test('ownerの削除はその設定・資格情報・journal・既読・リストだけを除く', async () => {
		const { storage } = memory();
		for (const current of [owner, otherOwner]) {
			await storage.saveConnection(current, credential, defaultConcrntSettings());
			await storage.saveOperation(current, operation('one'), { create: true });
			await storage.markRead(current, credential.ccid, 'main', ['read']);
			await storage.saveListSelection(current, credential.ccid, 'main', 'list');
		}
		await storage.removeOwner(owner);
		expect(await storage.loadCredential(owner)).toBeNull();
		expect(await storage.loadOperations(owner, credential.ccid)).toEqual([]);
		expect(await storage.loadRead(owner, credential.ccid, 'main')).toEqual([]);
		expect(await storage.loadListSelection(owner, credential.ccid, 'main')).toBeNull();
		expect(await storage.loadCredential(otherOwner)).toEqual(credential);
		expect((await storage.loadOperations(otherOwner, credential.ccid)).length).toBe(1);
		expect(await storage.loadRead(otherOwner, credential.ccid, 'main')).toEqual(['read']);
		expect(await storage.loadListSelection(otherOwner, credential.ccid, 'main')).toBe('list');
	});

	test('profile識別子はserviceと同じ制限で正規化する', () => {
		expect(normalizeConcrntSettings({ profile: '仕事メモ' }).profile).toBe('仕事メモ');
		for (const profile of ['', '.', '..', 'main/other', 'main#x', 'a b', 'x'.repeat(201)]) {
			expect(normalizeConcrntSettings({ profile }).profile).toBe('main');
		}
	});
});
