/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ConcrntOperation } from './types.js';
import type { ConcrntServerInfo } from './server-info.js';

const fixtures = vi.hoisted(() => ({
	user: { id: 'alice' } as { id: string } | null,
	consent: true,
	credential: { ccid: 'con1-fixture', ckid: 'cck1-fixture', domain: 'social.example', secret: 'concrnt-subkey fixture-private-key con1-fixture@social.example' },
	parse: vi.fn(), verify: vi.fn(), anonymous: vi.fn(), probe: vi.fn(),
	profiles: vi.fn(), notifications: vi.fn(), serverInfo: vi.fn(),
	services: [] as { options: { signal: AbortSignal; onOperation: (operation: ConcrntOperation, options?: { create?: boolean; claimStep?: ConcrntOperation['steps'][number]['id'] }) => Promise<void> } }[],
	storage: {
		loadSettings: vi.fn(), loadCredential: vi.fn(), loadConnection: vi.fn(), saveConnection: vi.fn(), forgetCredential: vi.fn(),
		loadOperations: vi.fn(), saveOperation: vi.fn(), loadRead: vi.fn(), markRead: vi.fn(),
		removeOwner: vi.fn(), clear: vi.fn(), loadListSelection: vi.fn(), saveListSelection: vi.fn(),
	},
}));

vi.mock('@/i.js', () => ({ get $i() { return fixtures.user; } }));
vi.mock('@@/js/config.js', () => ({ host: 'hataskey.example' }));
vi.mock('./consent.js', () => ({ hasConcrntConsent: () => fixtures.consent }));
vi.mock('./protocol.js', () => ({
	parseConcrntSubkey: fixtures.parse, verifyConcrntCredential: fixtures.verify,
	createAnonymousConcrntApi: fixtures.anonymous, probeConcrntDomain: fixtures.probe,
}));
vi.mock('./storage.js', () => ({
	getConcrntStorage: () => fixtures.storage,
	defaultConcrntSettings: () => ({ enabled: true, save: 'device', profile: 'main', notifications: true, popups: true }),
	normalizeConcrntSettings: (input: object) => ({ enabled: true, save: 'device', profile: 'main', notifications: true, popups: true, ...input }),
}));
vi.mock('./service.js', () => ({
	ConcrntService: class {
		constructor(public api: unknown, _ccid: string, _domain: string, public options: { signal: AbortSignal; onOperation: (operation: ConcrntOperation, options?: { create?: boolean; claimStep?: ConcrntOperation['steps'][number]['id'] }) => Promise<void> }) {
			fixtures.services.push(this);
		}
		getProfiles() { return fixtures.profiles(); }
		getNotifications() { return fixtures.notifications(); }
		getServerInfo() { return fixtures.serverInfo(); }
	},
}));

const account = 'hataskey.example/alice';
const settings = { enabled: true, save: 'device' as const, profile: 'main', notifications: true, popups: true };

class Channel {
	static instances: Channel[] = [];
	onmessage: ((event: { data: unknown }) => void) | null = null;
	postMessage = vi.fn();
	constructor(public name: string) { Channel.instances.push(this); }
	emit(data: unknown) { this.onmessage?.({ data }); }
	close() {}
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

function api() { return { cache: { clear: vi.fn().mockResolvedValue(undefined) }, dispose: vi.fn() }; }

function operation(): ConcrntOperation {
	return {
		version: 1, id: 'operation-fixture', ccid: fixtures.credential.ccid, domain: fixtures.credential.domain,
		profile: 'main', createdAt: '2026-10-20T00:00:00Z', type: 'post', status: 'complete',
		steps: [{ id: 'record', domain: fixtures.credential.domain, document: '{}', state: 'confirmed', receipt: { cckv: 'record', ccfs: 'receipt' } }],
	};
}

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	globalThis.localStorage.clear();
	vi.clearAllMocks();
	for (const mock of Object.values(fixtures.storage)) mock.mockReset();
	fixtures.parse.mockReset().mockReturnValue(fixtures.credential);
	fixtures.verify.mockReset().mockResolvedValue(api());
	fixtures.anonymous.mockReset().mockReturnValue(api());
	fixtures.probe.mockReset().mockResolvedValue({ domain: fixtures.credential.domain });
	fixtures.profiles.mockReset().mockResolvedValue([{ id: 'main', uri: 'profile', name: 'Fixture', visibility: 'unknown' }]);
	fixtures.notifications.mockReset().mockResolvedValue({ items: [], next: null, unavailable: 0 });
	fixtures.serverInfo.mockReset().mockResolvedValue({ domain: fixtures.credential.domain, name: '接続先サーバー', iconUrl: 'https://cdn.example/server.png' });
	fixtures.storage.loadSettings.mockResolvedValue({ ...settings });
	fixtures.storage.loadCredential.mockResolvedValue(null);
	fixtures.storage.loadConnection.mockImplementation(async (owner: string) => {
		const loadedSettings = await fixtures.storage.loadSettings(owner);
		const credential = loadedSettings.save === 'device' ? await fixtures.storage.loadCredential(owner) : null;
		return { settings: loadedSettings, credential };
	});
	fixtures.storage.loadOperations.mockResolvedValue([]);
	fixtures.storage.loadRead.mockResolvedValue([]);
	fixtures.storage.saveConnection.mockResolvedValue(undefined);
	fixtures.storage.forgetCredential.mockResolvedValue(undefined);
	fixtures.storage.removeOwner.mockResolvedValue(undefined);
	fixtures.storage.clear.mockResolvedValue(undefined);
	fixtures.storage.saveOperation.mockResolvedValue(undefined);
	fixtures.services.length = 0;
	fixtures.user = { id: 'alice' };
	fixtures.consent = true;
	Channel.instances = [];
	vi.stubGlobal('BroadcastChannel', Channel);
});

describe('端末データの消去失敗と再試行', () => {
	const globalMarker = 'hataskey:concrnt:pending-purge:*';
	const unlinkMarker = `hataskey:concrnt:pending-purge:unlink:${encodeURIComponent(account)}`;

	test('消去失敗でもメモリと別タブを直ちに停止し、未完了を秘密なしで保持する', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const signal = fixtures.services[0].options.signal;
		fixtures.storage.clear.mockRejectedValue(new Error('IDB unavailable'));
		const result = runtime.purgeConcrnt();
		expect(signal.aborted).toBe(true);
		expect(runtime.concrntState).toMatchObject({ initialized: true, status: 'unlinked', connection: null });
		expect(Channel.instances[0].postMessage).toHaveBeenCalledWith({ kind: 'clear', owner: account });
		await expect(result).resolves.toEqual({ cleared: false });
		expect(fixtures.storage.clear).toHaveBeenCalledOnce();
		expect(fixtures.storage.forgetCredential).not.toHaveBeenCalled();
		expect(globalThis.localStorage.getItem(globalMarker)).toBeTruthy();
		expect(globalThis.localStorage.getItem(globalMarker)).not.toContain(fixtures.credential.secret);
		expect(runtime.concrntState.error).toContain('消去できませんでした');
	});

	test('5秒で戻り、古い消去が実際に終わるまで再連携を止める', async () => {
		const pending = deferred<void>();
		fixtures.storage.clear.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const purge = runtime.purgeConcrnt();
		await vi.advanceTimersByTimeAsync(5000);
		await expect(purge).resolves.toEqual({ cleared: false });
		const originalMarker = globalThis.localStorage.getItem(globalMarker);
		expect(originalMarker).toBeTruthy();
		const attempt = runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const rejected = expect(attempt).rejects.toThrow('消去できませんでした');
		await vi.advanceTimersByTimeAsync(5000);
		await rejected;
		expect(fixtures.verify).not.toHaveBeenCalled();
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
		pending.resolve(undefined);
		await vi.advanceTimersByTimeAsync(0);
		// The expired queued retry never deletes a newer connection later.
		expect(fixtures.storage.clear).toHaveBeenCalledOnce();
		expect(globalThis.localStorage.getItem(globalMarker)).toBeTruthy();
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		expect(fixtures.storage.clear).toHaveBeenCalledTimes(2);
		expect(globalThis.localStorage.getItem(globalMarker)).toBeNull();
		expect(runtime.concrntState.status).toBe('connected');
	});

	test('起動時の消去失敗は読み込み中表示を終え、手動再接続で消去を再試行できる', async () => {
		globalThis.localStorage.setItem(globalMarker, 'old-device-cleanup');
		fixtures.storage.clear.mockRejectedValueOnce(new Error('blocked'));
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(runtime.concrntState).toMatchObject({ initialized: true, status: 'unlinked', connection: null });
		expect(runtime.concrntState.error).toContain('消去できませんでした');
		expect(fixtures.storage.loadConnection).not.toHaveBeenCalled();
		expect(fixtures.verify).not.toHaveBeenCalled();
		await runtime.recheckConcrnt();
		expect(fixtures.storage.clear).toHaveBeenCalledTimes(2);
		expect(globalThis.localStorage.getItem(globalMarker)).toBeNull();
		expect(runtime.concrntState.error).toBeNull();
		expect(fixtures.storage.loadConnection).not.toHaveBeenCalled();
	});

	test('解除失敗は再起動後も復元せず、再試行では操作履歴を消さない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		fixtures.storage.forgetCredential.mockRejectedValue(new Error('IDB unavailable'));
		await expect(runtime.unlinkConcrnt()).rejects.toThrow('消去できませんでした');
		expect(globalThis.localStorage.getItem(unlinkMarker)).toBeTruthy();
		vi.resetModules();
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		fixtures.verify.mockClear();
		const restored = await import('./runtime.js');
		await restored.initializeConcrnt();
		expect(restored.concrntState).toMatchObject({ initialized: true, connection: null, status: 'unlinked' });
		expect(fixtures.storage.loadConnection).not.toHaveBeenCalled();
		expect(fixtures.verify).not.toHaveBeenCalled();
		fixtures.storage.forgetCredential.mockResolvedValue(undefined);
		await restored.recheckConcrnt();
		expect(fixtures.storage.forgetCredential).toHaveBeenCalledTimes(3);
		expect(fixtures.storage.removeOwner).not.toHaveBeenCalled();
		expect(fixtures.storage.clear).not.toHaveBeenCalled();
		expect(globalThis.localStorage.getItem(unlinkMarker)).toBeNull();
	});

	test('localStorageを消すログアウトでも非秘密の未完了標識だけを保持する', async () => {
		globalThis.localStorage.setItem(globalMarker, 'old-device-cleanup');
		globalThis.localStorage.setItem(unlinkMarker, 'old-unlink');
		globalThis.localStorage.setItem('account', 'ordinary-login-data');
		const runtime = await import('./runtime.js');
		const restore = runtime.preserveConcrntPurgeMarkers();
		globalThis.localStorage.clear();
		restore();
		expect(globalThis.localStorage.getItem(globalMarker)).toBe('old-device-cleanup');
		expect(globalThis.localStorage.getItem(unlinkMarker)).toBe('old-unlink');
		expect(globalThis.localStorage.getItem('account')).toBeNull();
		expect(globalThis.localStorage.length).toBe(2);
	});

	test('標識の読取自体が使えない端末では保存鍵を復元せずエラーを表示する', async () => {
		vi.stubGlobal('localStorage', { get length() { throw new Error('storage disabled'); } });
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(runtime.concrntState).toMatchObject({ initialized: true, status: 'unlinked', connection: null });
		expect(runtime.concrntState.error).toContain('消去できませんでした');
		expect(fixtures.storage.loadConnection).not.toHaveBeenCalled();
		expect(fixtures.verify).not.toHaveBeenCalled();
	});
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('外部サーバー連携の同意', () => {
	test('同意がなければ接続先の確認も連携も始めず、コンカレントへ何も送らない', async () => {
		fixtures.consent = false;
		const runtime = await import('./runtime.js');
		await expect(runtime.checkConcrntDomain(fixtures.credential.domain)).rejects.toMatchObject({ code: 'aborted' });
		await expect(runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain)).rejects.toThrow();
		expect(fixtures.probe).not.toHaveBeenCalled();
		expect(fixtures.parse).not.toHaveBeenCalled();
		expect(fixtures.verify).not.toHaveBeenCalled();
		expect(fixtures.anonymous).not.toHaveBeenCalled();
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
		expect(fixtures.services).toHaveLength(0);
	});

	test('同意の記録がない端末では保存済みの接続も再開せず、連携し直しを求める', async () => {
		fixtures.consent = false;
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(runtime.concrntState.status).toBe('reauth');
		await runtime.recheckConcrnt();
		expect(runtime.concrntState.status).toBe('reauth');
		expect(fixtures.verify).not.toHaveBeenCalled();
		expect(fixtures.anonymous).not.toHaveBeenCalled();
		expect(fixtures.profiles).not.toHaveBeenCalled();
		expect(fixtures.services).toHaveLength(0);
		await expect(runtime.runConcrntAction(async () => 'sent')).rejects.toThrow();
	});
});

describe('接続情報の保存と復元', () => {
	test('session接続の秘密情報を保存・共有・公開stateへ出さない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain, 'session');
		expect(fixtures.storage.saveConnection).toHaveBeenCalledWith(account, null, expect.objectContaining({ save: 'session' }));
		expect(runtime.concrntState.status).toBe('connected');
		expect(JSON.stringify(runtime.concrntState)).not.toContain(fixtures.credential.secret);
		expect(JSON.stringify(Channel.instances[0].postMessage.mock.calls)).not.toContain(fixtures.credential.secret);
		expect(Channel.instances[0].postMessage).toHaveBeenCalledWith({ kind: 'reload', owner: account });
	});

	test('既定はdevice保存で、保存済みsecret全体を一度だけパーサーに渡す', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		expect(fixtures.storage.saveConnection).toHaveBeenCalledWith(account, fixtures.credential, expect.objectContaining({ save: 'device' }));
		vi.resetModules();
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		fixtures.parse.mockClear();
		const restored = await import('./runtime.js');
		await restored.initializeConcrnt();
		expect(fixtures.parse).toHaveBeenCalledWith(fixtures.credential.secret, fixtures.credential.domain);
		expect(restored.concrntState.connection).toEqual({ ccid: fixtures.credential.ccid, ckid: fixtures.credential.ckid, domain: fixtures.credential.domain });
		expect(restored.concrntState.status).toBe('connected');
		expect(restored.concrntState.server).toEqual({ domain: fixtures.credential.domain, name: '接続先サーバー', iconUrl: 'https://cdn.example/server.png' });
	});

	test('保存metadataと再計算したCCIDが一致しなければ認証を始めない', async () => {
		fixtures.storage.loadCredential.mockResolvedValue({ ...fixtures.credential, ccid: 'different-owner' });
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(fixtures.verify).not.toHaveBeenCalled();
		expect(runtime.concrntState.connection).toBeNull();
	});

	test.each([401, 403])('HTTP %sだけでは失効扱いにせず接続情報を残す', async status => {
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		fixtures.verify.mockRejectedValue({ code: 'auth', status, phase: 'registration' });
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(runtime.concrntState.status).toBe('unknownAuth');
		expect(runtime.concrntState.connection?.ccid).toBe(fixtures.credential.ccid);
		expect(fixtures.storage.forgetCredential).not.toHaveBeenCalled();
	});

	test('公開情報の拒否はサブキーの認証状態を判定せず表示する', async () => {
		fixtures.verify.mockRejectedValue({ code: 'auth', status: 403, phase: 'server' });
		const runtime = await import('./runtime.js');
		await expect(runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain)).rejects.toThrow();
		expect(runtime.concrntState.status).toBe('offline');
		expect(runtime.concrntState.error).toContain('公開サーバー情報へのアクセスが拒否');
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
	});

	test('プロフィールの取得失敗を端末への保存失敗と区別する', async () => {
		fixtures.profiles.mockRejectedValue({ code: 'network', status: 503 });
		const runtime = await import('./runtime.js');
		await expect(runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain)).rejects.toThrow();
		expect(runtime.concrntState.error).toContain('プロフィールを確認できませんでした（HTTP 503）');
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
	});

	test('認証成功後の端末保存失敗を通信障害として表示しない', async () => {
		fixtures.storage.saveConnection.mockRejectedValue(new DOMException(fixtures.credential.secret, 'QuotaExceededError'));
		const runtime = await import('./runtime.js');
		await expect(runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain)).rejects.toThrow();
		expect(runtime.concrntState.error).toContain('保存領域を利用できませんでした');
		expect(runtime.concrntState.error).not.toContain(fixtures.credential.secret);
		expect(runtime.concrntState.connection).toBeNull();
	});

	test('復元時の履歴読取失敗をプロフィール通信失敗として表示しない', async () => {
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		fixtures.storage.loadOperations.mockRejectedValue(new Error(fixtures.credential.secret));
		const runtime = await import('./runtime.js');
		await runtime.initializeConcrnt();
		expect(runtime.concrntState.error).toContain('保存領域を利用できませんでした');
		expect(runtime.concrntState.error).not.toContain('プロフィール');
		expect(runtime.concrntState.error).not.toContain(fixtures.credential.secret);
	});

	test('再確認時にもプロフィール取得の失敗段階を残す', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		fixtures.profiles.mockRejectedValue({ code: 'network', status: 503 });
		await runtime.recheckConcrnt();
		expect(runtime.concrntState.error).toContain('プロフィールを確認できませんでした（HTTP 503）');
	});
});

describe('接続先の表示情報', () => {
	test('公開stateに表示情報を渡し、接続情報の保存形式は変えない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		expect(runtime.concrntState.server).toEqual({ domain: fixtures.credential.domain, name: '接続先サーバー', iconUrl: 'https://cdn.example/server.png' });
		expect(fixtures.storage.saveConnection).toHaveBeenCalledWith(account, fixtures.credential, settings);
		expect(JSON.stringify(runtime.concrntState)).not.toContain(fixtures.credential.secret);
	});

	test('同じ接続の停止中と再確認中は保持し、再確認完了時に更新する', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const previous = { ...runtime.concrntState.server! };
		await runtime.updateConcrntSettings({ enabled: false });
		expect(runtime.concrntState.status).toBe('paused');
		expect(runtime.concrntState.server).toEqual(previous);
		const pending = deferred<ConcrntServerInfo>();
		fixtures.serverInfo.mockReturnValueOnce(pending.promise);
		const resume = runtime.updateConcrntSettings({ enabled: true });
		await vi.waitFor(() => expect(fixtures.serverInfo).toHaveBeenCalledTimes(2));
		expect(runtime.concrntState.server).toEqual(previous);
		pending.resolve({ domain: fixtures.credential.domain, name: '新しいサーバー名' });
		await resume;
		expect(runtime.concrntState.server).toEqual({ domain: fixtures.credential.domain, name: '新しいサーバー名' });
	});

	test('同じ接続の再確認失敗では直前の表示情報を失わない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const previous = { ...runtime.concrntState.server! };
		fixtures.verify.mockRejectedValueOnce({ code: 'network', phase: 'server' });
		await runtime.recheckConcrnt();
		expect(runtime.concrntState.status).toBe('offline');
		expect(runtime.concrntState.server).toEqual(previous);
	});

	test('別ドメインへの切替中は前のサーバー名を新しい接続へ持ち込まない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const pending = deferred<ReturnType<typeof api>>();
		const replacement = { ...fixtures.credential, domain: 'other.example' };
		fixtures.parse.mockReturnValueOnce(replacement);
		fixtures.verify.mockReturnValueOnce(pending.promise);
		fixtures.serverInfo.mockResolvedValueOnce({ domain: replacement.domain, name: '別のサーバー' });
		const linking = runtime.linkConcrnt(replacement.secret, replacement.domain);
		await vi.waitFor(() => expect(fixtures.verify).toHaveBeenCalledTimes(2));
		expect(runtime.concrntState.server).toBeNull();
		pending.resolve(api());
		await linking;
		expect(runtime.concrntState.connection?.domain).toBe(replacement.domain);
		expect(runtime.concrntState.server).toEqual({ domain: replacement.domain, name: '別のサーバー' });
	});

	test('解除後に遅い表示情報が返っても復活させない', async () => {
		const pending = deferred<ConcrntServerInfo>();
		fixtures.serverInfo.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const linking = runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const rejected = expect(linking).rejects.toThrow('連携できませんでした');
		await vi.waitFor(() => expect(fixtures.serverInfo).toHaveBeenCalledOnce());
		await runtime.unlinkConcrnt();
		pending.resolve({ domain: fixtures.credential.domain, name: '遅い応答' });
		await rejected;
		expect(runtime.concrntState).toMatchObject({ status: 'unlinked', connection: null, server: null });
	});

	test.each(['remove', 'reload', 'clear'])('別タブの%s通知では表示情報も直ちに消す', async kind => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		Channel.instances[0].emit({ kind, owner: account });
		expect(runtime.concrntState.server).toBeNull();
	});
});

describe('Hataskey ownerと進行中の操作', () => {
	test('本人確認中にownerが変わったら旧接続を新ownerへ保存しない', async () => {
		const pending = deferred<ReturnType<typeof api>>();
		fixtures.verify.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const result = runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const rejected = expect(result).rejects.toThrow('連携できませんでした');
		await vi.waitFor(() => expect(fixtures.verify).toHaveBeenCalledOnce());
		fixtures.user = { id: 'bob' };
		pending.resolve(api());
		await rejected;
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
		expect(fixtures.services).toHaveLength(0);
		expect(runtime.concrntState.connection).toBeNull();
	});

	test('接続後のowner切替は操作コールバックを呼ぶ前に止める', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		await runtime.updateConcrntSettings({ notifications: false, popups: false, profile: 'work' });
		fixtures.user = { id: 'bob' };
		const action = vi.fn().mockResolvedValue('would send');
		await expect(runtime.runConcrntAction(action)).rejects.toThrow();
		expect(action).not.toHaveBeenCalled();
		expect(runtime.concrntState.settings).toEqual(settings);
		expect(runtime.concrntState.server).toBeNull();
	});

	test('owner切替後の保存設定変更に旧ownerの秘密情報を引き継がない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain, 'session');
		fixtures.storage.saveConnection.mockClear();
		fixtures.user = { id: 'bob' };
		await runtime.updateConcrntSettings({ save: 'device' }).catch(() => {});
		expect(fixtures.storage.saveConnection.mock.calls.some(([account, value]) => account === 'hataskey.example/bob' && value != null)).toBe(false);
	});

	test('本人確認が保留中でも解除でき、遅い成功応答で接続が復活しない', async () => {
		const pending = deferred<ReturnType<typeof api>>();
		fixtures.verify.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const result = runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const rejected = expect(result).rejects.toThrow();
		await vi.waitFor(() => expect(fixtures.verify).toHaveBeenCalledOnce());
		const signal = fixtures.verify.mock.calls[0][1] as AbortSignal;
		await runtime.unlinkConcrnt();
		expect(signal.aborted).toBe(true);
		pending.resolve(api());
		await rejected;
		expect(runtime.concrntState).toMatchObject({ status: 'unlinked', connection: null, busy: false });
		expect(fixtures.storage.saveConnection).not.toHaveBeenCalled();
		expect(fixtures.storage.forgetCredential).toHaveBeenCalledWith(account);
	});

	test('解除後の遅い操作結果を呼出元へ成功として返さない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const pending = deferred<string>();
		const action = vi.fn(() => pending.promise);
		const result = runtime.runConcrntAction(action);
		const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
		await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
		await runtime.unlinkConcrnt();
		pending.resolve('late result');
		await rejected;
		expect(runtime.concrntState.status).toBe('unlinked');
	});

	test('解除は接続先確認probeにも同じ中断signalを伝える', async () => {
		const pending = deferred<{ domain: string }>();
		fixtures.probe.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const result = runtime.checkConcrntDomain(fixtures.credential.domain);
		await vi.waitFor(() => expect(fixtures.probe).toHaveBeenCalledOnce());
		const signal = fixtures.probe.mock.calls[0][1] as AbortSignal;
		await runtime.unlinkConcrnt();
		expect(signal.aborted).toBe(true);
		pending.resolve({ domain: fixtures.credential.domain });
		await result.catch(() => {});
	});
});

describe('別タブからの状態変更', () => {
	test('古い初期化のfinallyは新しい初期化を消さない', async () => {
		const first = deferred<typeof settings>();
		const second = deferred<typeof settings>();
		fixtures.storage.loadSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		const runtime = await import('./runtime.js');
		const old = runtime.initializeConcrnt();
		await vi.waitFor(() => expect(fixtures.storage.loadSettings).toHaveBeenCalledOnce());
		Channel.instances[0].emit({ kind: 'reload', owner: account });
		await vi.waitFor(() => expect(fixtures.storage.loadSettings).toHaveBeenCalledTimes(2));
		first.resolve({ ...settings });
		await old;
		const current = runtime.initializeConcrnt();
		expect(fixtures.storage.loadSettings).toHaveBeenCalledTimes(2);
		second.resolve({ ...settings, enabled: false, profile: 'work' });
		await current;
		expect(runtime.concrntState).toMatchObject({ initialized: true, status: 'paused', settings: { profile: 'work' } });
		expect(fixtures.verify).not.toHaveBeenCalled();
	});

	test('別タブで解除されたら初期化中の認証成功を破棄する', async () => {
		fixtures.storage.loadCredential.mockResolvedValue(fixtures.credential);
		const pending = deferred<ReturnType<typeof api>>();
		fixtures.verify.mockReturnValueOnce(pending.promise);
		const runtime = await import('./runtime.js');
		const result = runtime.initializeConcrnt();
		await vi.waitFor(() => expect(fixtures.verify).toHaveBeenCalledOnce());
		Channel.instances[0].emit({ kind: 'remove', owner: account });
		pending.resolve(api());
		await result;
		expect(runtime.concrntState).toMatchObject({ initialized: true, status: 'unlinked', connection: null, profiles: [], operations: [] });
		expect(fixtures.services).toHaveLength(0);
	});

	test('他ownerへの解除通知では現在の接続を止めない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const signal = fixtures.services[0].options.signal;
		Channel.instances[0].emit({ kind: 'remove', owner: 'hataskey.example/bob' });
		expect(runtime.concrntState.status).toBe('connected');
		expect(signal.aborted).toBe(false);
	});

	test('削除済みjournalを遅いreceiptで復活させない', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const callback = fixtures.services[0].options.onOperation;
		await runtime.purgeConcrnt();
		fixtures.storage.saveOperation.mockRejectedValueOnce(new Error('journal removed'));
		await expect(callback(operation())).rejects.toThrow('journal removed');
		expect(fixtures.storage.saveOperation).toHaveBeenCalledWith(account, operation(), { create: false });
		expect(runtime.concrntState.operations).toEqual([]);
	});

	test('段階獲得の競合は元エラーを返し、履歴UIを保存済みの最新状態へ戻す', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const latest = operation();
		const stale = structuredClone(latest);
		stale.steps[0]!.state = 'submitting';
		stale.status = 'prepared';
		const conflict = new Error('claim already taken');
		fixtures.storage.saveOperation.mockRejectedValueOnce(conflict);
		fixtures.storage.loadOperations.mockResolvedValue([latest]);
		await expect(fixtures.services[0].options.onOperation(stale, { claimStep: 'record' })).rejects.toBe(conflict);
		expect(fixtures.storage.saveOperation).toHaveBeenCalledWith(account, stale, { create: false, claimStep: 'record' });
		expect(runtime.concrntState.operations).toEqual([latest]);
	});
});

describe('一時的な拒否と認証切れの区別', () => {
	test('他人の鍵投稿などへの403では接続を切らず、ホームで認証が通るか確かめるだけにする', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const before = fixtures.profiles.mock.calls.length;
		const forbidden = Object.assign(new Error('forbidden'), { code: 'auth', status: 403 });
		await expect(runtime.runConcrntAction(() => Promise.reject(forbidden))).rejects.toThrow('権限がない');
		expect(fixtures.profiles.mock.calls.length).toBe(before + 1);
		expect(runtime.concrntState.status).toBe('connected');
		await expect(runtime.runConcrntAction(() => Promise.resolve('next'))).resolves.toBe('next');
	});

	test('ホームでも認証が拒否されたときだけ再認証の状態にする', async () => {
		const runtime = await import('./runtime.js');
		await runtime.linkConcrnt(fixtures.credential.secret, fixtures.credential.domain);
		const rejected = Object.assign(new Error('expired'), { code: 'auth', status: 401 });
		fixtures.profiles.mockRejectedValueOnce(rejected);
		await expect(runtime.runConcrntAction(() => Promise.reject(rejected))).rejects.toBe(rejected);
		expect(runtime.concrntState.status).toBe('unknownAuth');
	});
});
