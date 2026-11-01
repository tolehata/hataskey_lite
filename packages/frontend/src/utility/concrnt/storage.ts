/* SPDX-License-Identifier: AGPL-3.0-only */

import { createStore, get, set, del, keys, clear, update } from 'idb-keyval';
import type { ConcrntCredential } from './protocol.js';
import type { ConcrntOperation } from './types.js';

export interface ConcrntSettings {
	enabled: boolean;
	save: 'device' | 'session';
	profile: string;
	notifications: boolean;
	popups: boolean;
}

export const defaultConcrntSettings = (): ConcrntSettings => ({
	enabled: true, save: 'device', profile: 'main', notifications: true, popups: true,
});

export function normalizeConcrntSettings(input: Partial<ConcrntSettings> | null | undefined): ConcrntSettings {
	const defaults = defaultConcrntSettings();
	return {
		enabled: typeof input?.enabled === 'boolean' ? input.enabled : defaults.enabled,
		save: input?.save === 'session' ? 'session' : 'device',
		profile: typeof input?.profile === 'string' && input.profile.length > 0 && input.profile.length <= 200 && !/[/?#\\\s]/.test(input.profile) && input.profile !== '.' && input.profile !== '..' ? input.profile : 'main',
		notifications: typeof input?.notifications === 'boolean' ? input.notifications : defaults.notifications,
		popups: typeof input?.popups === 'boolean' ? input.popups : defaults.popups,
	};
}

export interface ConcrntStorageBackend {
	get<T>(key: string): Promise<T | undefined>;
	set(key: string, value: unknown): Promise<void>;
	delete(key: string): Promise<void>;
	keys(): Promise<string[]>;
	clear(): Promise<void>;
	/** Atomic read/modify/write. The browser implementation uses one IndexedDB transaction. */
	update?<T>(key: string, updater: (previous: T | undefined) => T): Promise<void>;
}

interface EncryptedConnection {
	version: 1;
	key: CryptoKey;
	iv: Uint8Array<ArrayBuffer>;
	cipher: ArrayBuffer;
}

interface ConnectionRecord {
	version: 1;
	settings: ConcrntSettings;
	credential: EncryptedConnection | null;
}

const queues = new WeakMap<ConcrntStorageBackend, Promise<unknown>>();

/** Separate database: excluded from preferences, account sync and settings exports. */
function browserBackend(): ConcrntStorageBackend {
	const store = createStore('HataskeyConcrnt', 'private');
	return {
		get: <T>(key: string) => get<T>(key, store),
		set: (key, value) => set(key, value, store),
		delete: key => del(key, store),
		keys: async () => (await keys(store)).filter((key): key is string => typeof key === 'string'),
		clear: () => clear(store),
		update: <T>(key: string, updater: (previous: T | undefined) => T) => update<T>(key, updater, store),
	};
}

/** Encryption prevents plaintext credential export; it does not protect against same-origin script execution. */
export class ConcrntStorage {
	constructor(private readonly backend: ConcrntStorageBackend) {}

	private prefix(owner: string): string {
		if (!owner || owner.length > 600) throw new Error('接続情報の保存先を確認できません。');
		return `${encodeURIComponent(owner)}:`;
	}

	private async encrypt(owner: string, credential: ConcrntCredential): Promise<EncryptedConnection> {
		const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const cipher = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, key,
			new TextEncoder().encode(JSON.stringify(credential)),
		);
		return { version: 1, key, iv, cipher };
	}

	/** Settings and the device credential are replaced together, or neither is replaced. */
	async saveConnection(owner: string, credential: ConcrntCredential | null, settings: ConcrntSettings): Promise<void> {
		const key = `${this.prefix(owner)}connection`;
		const normalized = normalizeConcrntSettings(settings);
		const encrypted = normalized.save === 'device' && credential ? await this.encrypt(owner, credential) : null;
		await this.backend.set(key, { version: 1, settings: normalized, credential: encrypted } satisfies ConnectionRecord);
	}

	private mutate<T>(key: string, updater: (previous: T | undefined) => T): Promise<void> {
		if (this.backend.update) return this.backend.update(key, updater);
		// Memory/test adapters may omit IDB's atomic update. Serialize their shared backend.
		const previous = queues.get(this.backend) ?? Promise.resolve();
		const next = previous.catch(() => {}).then(async () => {
			await this.backend.set(key, updater(await this.backend.get<T>(key)));
		});
		queues.set(this.backend, next);
		return next;
	}

	async saveCredential(owner: string, credential: ConcrntCredential): Promise<void> {
		const encrypted = await this.encrypt(owner, credential);
		await this.mutate<ConnectionRecord>(`${this.prefix(owner)}connection`, previous => ({
			version: 1, settings: { ...normalizeConcrntSettings(previous?.settings), save: 'device' }, credential: encrypted,
		}));
	}

	private async decrypt(owner: string, record: ConnectionRecord | undefined): Promise<ConcrntCredential | null> {
		if (record && record.version !== 1) throw new Error('保存した接続情報の形式を確認できません。');
		if (record?.settings?.save === 'session') return null;
		const stored = record?.credential;
		if (!stored) return null;
		if (stored.version !== 1 || !stored.key || !stored.iv || !stored.cipher) throw new Error('保存した接続情報を読み取れません。再連携してください。');
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: stored.iv, additionalData: new TextEncoder().encode(owner) }, stored.key, stored.cipher,
		);
		const value = JSON.parse(new TextDecoder().decode(plain)) as ConcrntCredential;
		if (typeof value.secret !== 'string' || typeof value.ccid !== 'string' || typeof value.ckid !== 'string' || typeof value.domain !== 'string') {
			throw new Error('保存した接続情報を読み取れません。再連携してください。');
		}
		return value;
	}

	async loadCredential(owner: string): Promise<ConcrntCredential | null> {
		return this.decrypt(owner, await this.backend.get<ConnectionRecord>(`${this.prefix(owner)}connection`));
	}

	/** Read both values from the same revision, including while another tab replaces the connection. */
	async loadConnection(owner: string): Promise<{ settings: ConcrntSettings; credential: ConcrntCredential | null }> {
		const record = await this.backend.get<ConnectionRecord>(`${this.prefix(owner)}connection`);
		return { settings: normalizeConcrntSettings(record?.settings), credential: await this.decrypt(owner, record) };
	}

	forgetCredential(owner: string): Promise<void> {
		return this.mutate<ConnectionRecord>(`${this.prefix(owner)}connection`, previous => ({
			version: 1, settings: normalizeConcrntSettings(previous?.settings), credential: null,
		}));
	}

	async loadSettings(owner: string): Promise<ConcrntSettings> {
		const record = await this.backend.get<ConnectionRecord>(`${this.prefix(owner)}connection`);
		if (record && record.version !== 1) throw new Error('保存した接続情報の形式を確認できません。');
		return normalizeConcrntSettings(record?.settings);
	}

	saveSettings(owner: string, settings: ConcrntSettings): Promise<void> {
		const normalized = normalizeConcrntSettings(settings);
		return this.mutate<ConnectionRecord>(`${this.prefix(owner)}connection`, previous => ({
			version: 1, settings: normalized, credential: normalized.save === 'device' ? previous?.credential ?? null : null,
		}));
	}

	async saveOperation(owner: string, operation: ConcrntOperation, options: { create?: boolean; claimStep?: ConcrntOperation['steps'][number]['id'] } = {}): Promise<void> {
		// One key per operation avoids lost updates between tabs and keeps unresolved writes until reviewed.
		await this.mutate<ConcrntOperation>(`${this.prefix(owner)}operation:${operation.ccid}:${operation.id}`, previous => {
			if (options.create ? Boolean(previous) : !previous) throw new Error('送信記録が変更されています。履歴を読み直してください。');
			const merged = structuredClone(operation);
			if (previous) {
				if (previous.ccid !== operation.ccid || previous.domain !== operation.domain || previous.type !== operation.type || previous.profile !== operation.profile || previous.createdAt !== operation.createdAt || previous.steps.length !== operation.steps.length || previous.steps.some((step, index) => step.id !== operation.steps[index]?.id || step.document !== operation.steps[index]?.document || step.domain !== operation.steps[index]?.domain)) {
					throw new Error('送信記録の内容が一致しません。');
				}
				if (options.claimStep) {
					const before = previous.steps.find(step => step.id === options.claimStep);
					const after = merged.steps.find(step => step.id === options.claimStep);
					if (before?.state !== 'prepared' || after?.state !== 'submitting') throw new Error('この段階は別の処理が開始しています。結果を確認してください。');
				}
				// Do not let a stale tab turn an attempted write into a retryable, unsent write.
				const rank = { prepared: 0, submitting: 1, unknown: 2, confirmed: 3 };
				previous.steps.forEach((step, index) => {
					if (rank[step.state] >= rank[merged.steps[index].state]) merged.steps[index] = structuredClone(step);
				});
			} else if (options.claimStep) throw new Error('送信記録がありません。履歴を読み直してください。');
			if (merged.steps.length && merged.steps.every(step => step.state === 'confirmed')) {
				merged.status = 'complete';
				delete merged.error;
			} else if (merged.steps.some(step => step.state === 'confirmed')) merged.status = 'partial';
			else if (merged.steps.some(step => step.state === 'unknown' || step.state === 'submitting')) merged.status = 'unknown';
			return merged;
		});
	}

	async loadOperations(owner: string, ccid: string): Promise<ConcrntOperation[]> {
		const prefix = `${this.prefix(owner)}operation:${ccid}:`;
		const entries = await Promise.all((await this.backend.keys()).filter(key => key.startsWith(prefix)).map(key => this.backend.get<ConcrntOperation>(key)));
		return entries.filter((entry): entry is ConcrntOperation => entry?.version === 1 && entry.ccid === ccid)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	async loadRead(owner: string, ccid: string, profile: string): Promise<string[]> {
		const value = await this.backend.get<unknown>(`${this.prefix(owner)}read:${encodeURIComponent(ccid)}:${encodeURIComponent(profile)}`);
		return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-500) : [];
	}

	async markRead(owner: string, ccid: string, profile: string, uris: string[]): Promise<string[]> {
		let seen: string[] = [];
		await this.mutate<unknown>(`${this.prefix(owner)}read:${encodeURIComponent(ccid)}:${encodeURIComponent(profile)}`, previous => {
			seen = [...new Set([...(Array.isArray(previous) ? previous.filter((id): id is string => typeof id === 'string') : []), ...uris])].slice(-500);
			return seen;
		});
		return seen;
	}

	async loadListSelection(owner: string, ccid: string, profile: string): Promise<string | null> {
		const value = await this.backend.get<unknown>(`${this.prefix(owner)}list:${encodeURIComponent(ccid)}:${encodeURIComponent(profile)}`);
		return typeof value === 'string' ? value : null;
	}

	saveListSelection(owner: string, ccid: string, profile: string, uri: string | null): Promise<void> {
		const key = `${this.prefix(owner)}list:${encodeURIComponent(ccid)}:${encodeURIComponent(profile)}`;
		return uri === null ? this.backend.delete(key) : this.backend.set(key, uri);
	}

	async removeOwner(owner: string): Promise<void> {
		const prefix = this.prefix(owner);
		await Promise.all((await this.backend.keys()).filter(key => key.startsWith(prefix)).map(key => this.backend.delete(key)));
	}

	clear(): Promise<void> {
		return this.backend.clear();
	}
}

let storage: ConcrntStorage | undefined;
export function getConcrntStorage(): ConcrntStorage {
	return storage ??= new ConcrntStorage(browserBackend());
}
