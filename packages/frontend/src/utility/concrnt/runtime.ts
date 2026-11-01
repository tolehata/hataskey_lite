/* SPDX-License-Identifier: AGPL-3.0-only */

import { reactive } from 'vue';
import '@/components/concrnt/concrnt-icon.css';
import { host } from '@@/js/config.js';
import { defaultConcrntSettings, getConcrntStorage, normalizeConcrntSettings } from './storage.js';
import { formatConcrntConnectionError, inConcrntConnectionPhase } from './connection-errors.js';
import { hasConcrntConsent } from './consent.js';
import type { ConcrntConnectionPhase } from './connection-errors.js';
import type { Server } from '@concrnt/client';
import type { ConcrntCredential } from './protocol.js';
import type { ConcrntService } from './service.js';
import type { ConcrntServerInfo } from './server-info.js';
import type { ConcrntNotification, ConcrntOperation, ConcrntProfile } from './types.js';
import type { ConcrntSettings } from './storage.js';
import { $i } from '@/i.js';

type Status = 'unlinked' | 'connected' | 'paused' | 'offline' | 'reauth' | 'unknownAuth';
import { CONCRNT_NOTIFICATION_EVENT } from './events.js';
export const concrntState = reactive({
	initialized: false, busy: false, status: 'unlinked' as Status,
	currentOwner: null as string | null,
	connection: null as Pick<ConcrntCredential, 'ccid' | 'ckid' | 'domain'> | null,
	server: null as ConcrntServerInfo | null,
	settings: defaultConcrntSettings(), profiles: [] as ConcrntProfile[], error: null as string | null,
	notifications: [] as ConcrntNotification[], read: [] as string[],
	operations: [] as ConcrntOperation[], revision: 0,
});

let credential: ConcrntCredential | null = null;
let service: ConcrntService | null = null;
let controller = new AbortController();
let generation = 0;
let initializing: { version: number; promise: Promise<void> } | undefined;
let sessionOwner: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let channel: BroadcastChannel | undefined;
let firstNotifications = true;
let mutationQueue = Promise.resolve();
const PURGE_PREFIX = 'hataskey:concrnt:pending-purge:';
const PURGE_MESSAGE = 'コンカレントの保存データを消去できませんでした。再接続すると消去を再試行します。';
const pendingPurges = new Map<string, string>();
const owner = () => $i ? `${host}/${$i.id}` : null;
const aborted = () => new DOMException('接続状態が変わったため中断しました。', 'AbortError');
// 旗鯖fork: 外部サーバー連携の免責事項に同意するまで、コンカレントへは何も送らない（consent.ts）。
const notConsented = () => Object.assign(new Error('Concrnt consent is required.'), { code: 'aborted' });

function assertCurrent(version: number): void {
	if (version !== generation || controller.signal.aborted || !owner() || owner() !== sessionOwner) throw aborted();
}

function invalidate(): number {
	controller.abort();
	controller = new AbortController();
	service = null;
	sessionOwner = owner();
	concrntState.currentOwner = sessionOwner;
	concrntState.busy = false;
	globalThis.clearTimeout(timer);
	firstNotifications = true;
	concrntState.notifications = [];
	concrntState.revision++;
	return ++generation;
}

function syncOwner(): boolean {
	if (owner() === sessionOwner) return false;
	invalidate();
	credential = null;
	concrntState.settings = defaultConcrntSettings();
	concrntState.connection = null;
	concrntState.server = null;
	concrntState.profiles = [];
	concrntState.operations = [];
	concrntState.read = [];
	concrntState.initialized = false;
	concrntState.status = 'unlinked';
	concrntState.error = null;
	return true;
}

/** Serialize local persistence and, where available, mutations from other tabs. */
async function locked<T>(_account: string, action: () => Promise<T>): Promise<T> {
	const run = () => navigator.locks ? navigator.locks.request('hataskey-concrnt-persistence', action) : action();
	const result = mutationQueue.then(run, run);
	mutationQueue = result.then(() => undefined, () => undefined);
	return result;
}

function broadcast(kind: 'reload' | 'remove' | 'clear', account = owner()): void {
	channel?.postMessage({ kind, owner: account });
}

function purgeKey(account?: string, unlink = false): string { return `${PURGE_PREFIX}${unlink ? 'unlink:' : ''}${encodeURIComponent(account ?? '*')}`; }

function purgeMarkers(): Map<string, string> {
	const markers = new Map(pendingPurges);
	for (let i = 0; i < globalThis.localStorage.length; i++) {
		const key = globalThis.localStorage.key(i);
		if (key?.startsWith(PURGE_PREFIX)) markers.set(key, globalThis.localStorage.getItem(key) ?? 'pending');
	}
	return markers;
}

/** Keep only non-secret, device-local cleanup markers across signout's localStorage.clear(). */
export function preserveConcrntPurgeMarkers(): () => void {
	let markers = new Map(pendingPurges);
	try { markers = purgeMarkers(); } catch { /* Memory still stops this session. */ }
	return () => {
		for (const [key, value] of markers) {
			try { globalThis.localStorage.setItem(key, value); } catch { pendingPurges.set(key, value); }
		}
	};
}

async function recoverPendingPurge(account: string): Promise<boolean> {
	const markers = purgeMarkers(); // If even marker reads fail, never restore a stored key.
	const global = markers.has(purgeKey());
	const removed = markers.has(purgeKey(account));
	if (!global && !removed && !markers.has(purgeKey(account, true))) return false;
	const result = await cleanupConcrnt(global ? undefined : account, !global && !removed);
	if (!result.cleared) throw new Error(PURGE_MESSAGE);
	const remaining = purgeMarkers();
	if (remaining.has(purgeKey()) || remaining.has(purgeKey(account)) || remaining.has(purgeKey(account, true))) throw new Error(PURGE_MESSAGE);
	return true;
}

function listen(): void {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	channel = new BroadcastChannel('hataskey-concrnt');
	channel.onmessage = event => {
		if (event.data?.kind !== 'clear' && event.data?.owner !== owner()) return;
		invalidate();
		credential = null;
		concrntState.connection = null;
		concrntState.server = null;
		concrntState.status = 'unlinked';
		concrntState.profiles = [];
		concrntState.operations = [];
		concrntState.read = [];
		concrntState.initialized = event.data?.kind !== 'reload';
		if (event.data?.kind === 'reload') void initializeConcrnt();
	};
}

function failure(error: unknown, fallbackPhase?: ConcrntConnectionPhase): void {
	const code = (error as { code?: string })?.code;
	const status = (error as { status?: number })?.status;
	const phase = (error as { phase?: ConcrntConnectionPhase })?.phase ?? fallbackPhase;
	concrntState.status = phase === 'server' || phase === 'storage' ? 'offline' : status === 403 || status === 401 ? 'unknownAuth' : code === 'auth' ? 'reauth' : 'offline';
	concrntState.error = formatConcrntConnectionError(error, fallbackPhase);
}

async function connect(value: ConcrntCredential, version: number): Promise<ConcrntService> {
	const account = owner();
	if (!account) throw aborted();
	if (!hasConcrntConsent()) throw notConsented();
	const signal = controller.signal;
	const [{ verifyConcrntCredential, createAnonymousConcrntApi }, { ConcrntService: Service }] = await Promise.all([import('./protocol.js'), import('./service.js')]);
	assertCurrent(version);
	const api = await verifyConcrntCredential(value, signal);
	assertCurrent(version);
	return new Service(api, value.ccid, value.domain, {
		signal, anonymousApi: createAnonymousConcrntApi(value.domain, signal),
		onOperation: async (operation, options) => {
			try {
				await locked(account, async () => {
					if (version !== generation || owner() !== account) {
						if (options?.create || options?.claimStep || !operation.steps.some(step => step.state === 'confirmed' || step.state === 'unknown')) throw aborted();
					} else assertCurrent(version);
					// The same IDB update checks existence and claims an unsent step before signing.
					await getConcrntStorage().saveOperation(account, operation, { ...options, create: options?.create === true });
				});
			} catch (error) {
				// A conflict must replace a stale retryable UI snapshot without hiding the original failure.
				try {
					assertCurrent(version);
					const operations = await getConcrntStorage().loadOperations(account, operation.ccid);
					assertCurrent(version);
					concrntState.operations = operations;
				} catch { /* A newer session owns the state, or storage is unavailable. */ }
				throw error;
			}
			assertCurrent(version);
			const operations = await getConcrntStorage().loadOperations(account, operation.ccid);
			assertCurrent(version);
			concrntState.operations = operations;
		},
	});
}

async function activate(value: ConcrntCredential, next: ConcrntService, version: number, verifiedProfiles?: ConcrntProfile[]): Promise<void> {
	const account = owner()!;
	const [profiles, operations, read, server] = await Promise.all([
		verifiedProfiles ?? inConcrntConnectionPhase('profiles', () => next.getProfiles()),
		inConcrntConnectionPhase('storage', () => getConcrntStorage().loadOperations(account, value.ccid)),
		inConcrntConnectionPhase('storage', () => getConcrntStorage().loadRead(account, value.ccid, concrntState.settings.profile)),
		next.getServerInfo(),
	]);
	assertCurrent(version);
	credential = value;
	service = next;
	concrntState.connection = { ccid: value.ccid, ckid: value.ckid, domain: value.domain };
	concrntState.server = server;
	concrntState.profiles = profiles;
	concrntState.operations = operations;
	concrntState.read = read;
	concrntState.status = 'connected';
	concrntState.error = null;
	scheduleNotifications(version);
}

function scheduleNotifications(version: number): void {
	globalThis.clearTimeout(timer);
	if (!concrntState.settings.enabled || !concrntState.settings.notifications) return;
	timer = globalThis.setTimeout(async () => {
		if (version !== generation) return;
		if (window.document.visibilityState !== 'hidden') {
			try { await refreshConcrntNotifications(); } catch { if (version === generation) concrntState.error = '通知を取得できませんでした。次の更新で再確認します。'; }
		}
		if (version === generation) scheduleNotifications(version);
	}, firstNotifications ? 5000 : 30000);
}

export async function initializeConcrnt(): Promise<void> {
	syncOwner();
	listen();
	const recoveryOwner = owner();
	try {
		const recovered = recoveryOwner && await recoverPendingPurge(recoveryOwner);
		syncOwner();
		if (recovered && owner() === recoveryOwner) return;
	} catch {
		if (!syncOwner() && owner() === recoveryOwner) {
			concrntState.initialized = true;
			concrntState.status = 'unlinked';
			concrntState.error = PURGE_MESSAGE;
		}
		return;
	}
	if (initializing?.version === generation) return initializing.promise;
	if (concrntState.initialized || !owner()) return;
	const version = generation;
	const account = owner()!;
	sessionOwner = account;
	const promise = (async () => {
		let phase: ConcrntConnectionPhase = 'storage';
		try {
			const { settings, credential: stored } = await getConcrntStorage().loadConnection(account);
			assertCurrent(version);
			concrntState.settings = settings;
			if (!stored) return;
			phase = 'subkey';
			const { parseConcrntSubkey } = await import('./protocol.js');
			const checked = parseConcrntSubkey(stored.secret, stored.domain);
			if (checked.ckid !== stored.ckid || checked.ccid !== stored.ccid) throw new Error('保存情報が一致しません。');
			assertCurrent(version);
			credential = checked;
			if (concrntState.server?.domain !== checked.domain) concrntState.server = null;
			concrntState.connection = { ccid: checked.ccid, ckid: checked.ckid, domain: checked.domain };
			if (!settings.enabled) { concrntState.status = 'paused'; return; }
			// 同意の記録がない端末では保存済みの接続も再開せず、連携し直し（＝免責事項の確認）を求める。
			if (!hasConcrntConsent()) { concrntState.status = 'reauth'; return; }
			phase = 'server';
			const next = await connect(checked, version);
			phase = 'profiles';
			await activate(checked, next, version);
		} catch (error) {
			if (version === generation) failure(error, phase);
		} finally {
			if (version === generation) concrntState.initialized = true;
			if (initializing?.version === version) initializing = undefined;
		}
	})();
	initializing = { version, promise };
	return promise;
}

export async function checkConcrntDomain(domain: string): Promise<Server> {
	if (!hasConcrntConsent()) throw notConsented();
	const { probeConcrntDomain } = await import('./protocol.js');
	return probeConcrntDomain(domain, controller.signal);
}

export async function linkConcrnt(secret: string, domain: string, save: ConcrntSettings['save'] = 'device'): Promise<void> {
	syncOwner();
	listen();
	const account = owner();
	if (!account || concrntState.busy) throw new Error('接続状態を確認してから、もう一度試してください。');
	if (!hasConcrntConsent()) throw notConsented();
	await recoverPendingPurge(account);
	if (owner() !== account) throw aborted();
	const version = invalidate();
	concrntState.busy = true;
	let phase: ConcrntConnectionPhase = 'subkey';
	try {
		const { parseConcrntSubkey } = await import('./protocol.js');
		const value = parseConcrntSubkey(secret, domain);
		if (concrntState.server?.domain !== value.domain) concrntState.server = null;
		phase = 'server';
		const next = await connect(value, version);
		const settings = normalizeConcrntSettings({ ...concrntState.settings, enabled: true, save });
		// Check profile access before replacing any saved connection.
		phase = 'profiles';
		const profiles = await next.getProfiles();
		if (!profiles.some(profile => profile.id === settings.profile) && profiles[0]) settings.profile = profiles.find(profile => profile.id === 'main')?.id ?? profiles[0].id;
		phase = 'storage';
		await locked(account, async () => {
			assertCurrent(version);
			await getConcrntStorage().saveConnection(account, save === 'device' ? value : null, settings);
		});
		assertCurrent(version);
		concrntState.settings = settings;
		credential = value;
		concrntState.connection = { ccid: value.ccid, ckid: value.ckid, domain: value.domain };
		await activate(value, next, version, profiles);
		concrntState.initialized = true;
		broadcast('reload');
	} catch (error) {
		if (version === generation) failure(error, phase);
		throw new Error('連携できませんでした。ドメイン、サブキー、保存先の利用可否を確認してください。');
	} finally { if (version === generation) concrntState.busy = false; }
}

export async function recheckConcrnt(): Promise<void> {
	if (syncOwner()) return initializeConcrnt();
	if (concrntState.busy) return;
	if (!credential) return initializeConcrnt();
	const value = credential;
	const version = invalidate();
	concrntState.busy = true;
	try {
		if (!concrntState.settings.enabled) { concrntState.status = 'paused'; return; }
		if (!hasConcrntConsent()) { concrntState.status = 'reauth'; return; }
		await activate(value, await connect(value, version), version);
	} catch (error) { if (version === generation) failure(error); } finally { if (version === generation) concrntState.busy = false; }
}

export async function updateConcrntSettings(patch: Partial<ConcrntSettings>): Promise<void> {
	if (syncOwner()) throw aborted();
	const account = owner();
	if (!account || concrntState.busy) throw new Error('接続処理の完了後に変更してください。');
	const value = credential;
	const next = normalizeConcrntSettings({ ...concrntState.settings, ...patch });
	const version = invalidate();
	concrntState.busy = true;
	try {
		await locked(account, async () => {
			assertCurrent(version);
			await getConcrntStorage().saveConnection(account, next.save === 'device' ? value : null, next);
		});
		assertCurrent(version);
		concrntState.settings = next;
		concrntState.status = value ? 'paused' : 'unlinked';
		broadcast('reload');
	} finally { if (version === generation) concrntState.busy = false; }
	if (value && next.enabled) await recheckConcrnt();
}

export async function unlinkConcrnt(): Promise<void> {
	const account = owner();
	if (!account) { stopConnection(); return; }
	const result = await cleanupConcrnt(account, true);
	if (!result.cleared) throw new Error(PURGE_MESSAGE);
}

function stopConnection(): void {
	invalidate();
	credential = null;
	concrntState.connection = null;
	concrntState.server = null;
	concrntState.profiles = [];
	concrntState.operations = [];
	concrntState.read = [];
	concrntState.busy = false;
	concrntState.status = 'unlinked';
	concrntState.error = null;
	concrntState.initialized = true;
}

export function clearConcrntCache(): void {
	concrntState.notifications = [];
	void recheckConcrnt();
	concrntState.revision++;
}

export async function runConcrntAction<T>(action: (client: ConcrntService) => Promise<T>): Promise<T> {
	if (sessionOwner && syncOwner()) throw aborted();
	await initializeConcrnt();
	const version = generation;
	if (!service || !concrntState.settings.enabled || concrntState.status !== 'connected') throw new Error('設定画面でコンカレントとの接続を確認してください。');
	assertCurrent(version);
	const current = service;
	try {
		const result = await action(current);
		assertCurrent(version);
		return result;
	} catch (error) {
		if (version === generation && (error as { code?: string })?.code === 'auth') {
			// A 401/403 often concerns one resource (a restricted post or profile on another server).
			// Only end the session when our own credentials are rejected by the home server.
			if (await credentialsStillAccepted(current, version)) throw new Error('この投稿やプロフィールを読む権限がないか、相手のサーバーが応答を拒否しました。');
			if (version === generation) {
				failure(error);
				controller.abort();
				service = null;
			}
		}
		throw error;
	}
}

let credentialCheck: { version: number; promise: Promise<boolean> } | undefined;

/** One shared re-check per connection generation. Anything other than a clear auth rejection keeps the session. */
function credentialsStillAccepted(current: ConcrntService, version: number): Promise<boolean> {
	if (credentialCheck?.version === version) return credentialCheck.promise;
	(current.api as { forgetTokens?: () => void }).forgetTokens?.();
	const promise = current.getProfiles().then(() => true, (error: unknown) => (error as { code?: string })?.code !== 'auth');
	credentialCheck = { version, promise };
	void promise.finally(() => { if (credentialCheck?.promise === promise) credentialCheck = undefined; });
	return promise;
}

export async function refreshConcrntNotifications(): Promise<void> {
	if (syncOwner()) return;
	const version = generation;
	if (!service || !concrntState.settings.enabled || !concrntState.settings.notifications) return;
	const page = await service.getNotifications(concrntState.settings.profile);
	assertCurrent(version);
	const existing = new Set(concrntState.notifications.map(item => item.uri));
	const fresh = page.items.filter(item => !existing.has(item.uri) && !concrntState.read.includes(item.uri));
	concrntState.notifications = page.items;
	// The shared Hataskey toast host shows these as an external source (see MkHataskeyNotificationToasts).
	if (!firstNotifications && concrntState.settings.popups) {
		for (const item of fresh.slice(0, 3).reverse()) window.dispatchEvent(new CustomEvent<ConcrntNotification>(CONCRNT_NOTIFICATION_EVENT, { detail: item }));
	}
	firstNotifications = false;
}

export async function markConcrntNotificationsRead(uris: string[]): Promise<void> {
	if (syncOwner()) throw aborted();
	const account = owner();
	const ccid = concrntState.connection?.ccid;
	const profile = concrntState.settings.profile;
	const version = generation;
	if (!account || !ccid) return;
	const read = await locked(account, () => { assertCurrent(version); return getConcrntStorage().markRead(account, ccid, profile, uris); });
	assertCurrent(version);
	concrntState.read = read;
}

export async function loadConcrntListSelection(): Promise<string | null> {
	if (syncOwner()) throw aborted();
	const account = owner();
	const ccid = concrntState.connection?.ccid;
	const version = generation;
	if (!account || !ccid) return null;
	const selected = await getConcrntStorage().loadListSelection(account, ccid, concrntState.settings.profile);
	assertCurrent(version);
	return selected;
}

export async function saveConcrntListSelection(uri: string | null): Promise<void> {
	if (syncOwner()) throw aborted();
	const account = owner();
	const ccid = concrntState.connection?.ccid;
	const profile = concrntState.settings.profile;
	const version = generation;
	if (!account || !ccid) return;
	await locked(account, () => { assertCurrent(version); return getConcrntStorage().saveListSelection(account, ccid, profile, uri); });
	assertCurrent(version);
}

/** Called before removing a Hataskey account or signing out. */
export async function purgeConcrnt(account?: string): Promise<{ cleared: boolean }> {
	return cleanupConcrnt(account);
}

async function cleanupConcrnt(account?: string, unlink = false): Promise<{ cleared: boolean }> {
	if (!account || account === owner()) stopConnection();
	try { listen(); broadcast(account ? 'remove' : 'clear', account); } catch { /* Storage cleanup must still run. */ }
	const version = generation;
	const key = purgeKey(account, unlink);
	const marker = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${performance.now()}`;
	let previous = new Map(pendingPurges);
	try { previous = purgeMarkers(); } catch { /* Marker writes are attempted independently below. */ }
	pendingPurges.set(key, marker);
	try { globalThis.localStorage.setItem(key, marker); } catch { /* Do not block ordinary logout. */ }
	previous.set(key, marker);
	let expired = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const cleanup = locked(account ?? '*', async () => {
		if (expired) throw aborted(); // A timed-out queued cleanup must never run after a new connection.
		await (unlink && account ? getConcrntStorage().forgetCredential(account) : account ? getConcrntStorage().removeOwner(account) : getConcrntStorage().clear());
	});
	try {
		const cleared = await Promise.race([
			cleanup.then(() => true, () => false),
			new Promise<false>(resolve => { timeout = globalThis.setTimeout(() => { expired = true; resolve(false); }, 5000); }),
		]);
		if (!cleared) {
			if (generation === version && (!account || account === owner())) concrntState.error = PURGE_MESSAGE;
			return { cleared: false };
		}
		for (const [savedKey, savedMarker] of previous) {
			if (account && savedKey !== key && (unlink || savedKey !== purgeKey(account, true))) continue;
			if (pendingPurges.get(savedKey) === savedMarker) pendingPurges.delete(savedKey);
			try { if (globalThis.localStorage.getItem(savedKey) === savedMarker) globalThis.localStorage.removeItem(savedKey); } catch { /* A retained marker keeps restoration blocked. */ }
		}
		return { cleared: true };
	} finally { globalThis.clearTimeout(timeout); }
}
