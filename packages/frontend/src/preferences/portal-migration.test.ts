/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';
import { migrateRetiredPortalMenu } from '@/utility/retired-portal-migration.js';

// Exercise the real manager and preference definitions; isolate only app/UI IO.
vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

const account = 'user';
const otherAccount = 'other';
const profileId = 'profile';
const marker = `hata_portal_cleanup_migrated:${account}:${profileId}`;
const affectedKeys = ['menu', 'simpleUi.sidebar'] as const;
const scope = (id: string) => ({ server: 'example.test', account: id });
const localMenu = ['timeline', 'portal', '-', 'hatask'];
const remoteMenu = ['hatady', 'portal', '-', 'timeline', 'custom'];
const remoteSidebar = [
	{ id: 'hatask', icon: 'ti ti-eye', label: '自分のホーム', group: 'personal' },
	{ id: 'portal', icon: 'ti ti-door', label: 'Portal', group: 'hata' },
	{ id: 'external', icon: 'ti ti-link', label: '資料', group: 'custom', external: true, url: 'https://example.test/docs' },
	{ id: 'timeline', icon: 'ti ti-home', label: 'タイムライン', group: 'basic' },
];

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

async function fixture() {
	// Produce a normalized profile using the actual definitions, so subsequent
	// snapshots can detect changes to every other preference, not just two stubs.
	let saved: PreferencesProfile | null = null;
	const seedIo: StorageProvider = {
		load: () => null,
		save: ({ profile }) => { saved = copy(profile); },
		cloudGetBulk: async () => ({}),
		cloudGet: async () => null,
		cloudSet: async () => undefined,
	};
	const seed = new PreferencesManager(seedIo, { id: account });
	await seed.cloudReady;
	const seeded = copy(seed.profile);
	seeded.id = profileId;
	seeded.preferences.menu = [
		[{}, ['shared', 'portal', 'timeline'], {}],
		[scope(account), copy(localMenu), { sync: true }],
		[scope(otherAccount), ['other-first', 'portal', 'other-last'], { sync: true }],
	];
	seeded.preferences['simpleUi.sidebar'] = [
		[{}, [{ id: 'shared', icon: 'ti ti-star', label: 'Shared' }], {}],
		[scope(account), copy(remoteSidebar).reverse(), { sync: true }],
		[scope(otherAccount), [{ id: 'portal', icon: 'ti ti-door', label: 'Portal' }, { id: 'other', icon: 'ti ti-user', label: 'Other' }], { sync: true }],
	];
	saved = copy(seeded);
	const remote = new Map<string, unknown>([
		[`${account}:menu`, copy(remoteMenu)],
		[`${account}:simpleUi.sidebar`, copy(remoteSidebar)],
		[`${otherAccount}:menu`, ['other-first', 'portal', 'other-last']],
		[`${otherAccount}:simpleUi.sidebar`, copy(seeded.preferences['simpleUi.sidebar'][2][1])],
	]);
	const readGates: ReturnType<typeof deferred>[] = [];
	const writeGates: ReturnType<typeof deferred>[] = [];
	const startedWrites: ReturnType<typeof deferred>[] = [];
	const io: StorageProvider = {
		load: () => copy(saved),
		save: vi.fn(({ profile }) => { saved = copy(profile); }),
		cloudGetBulk: vi.fn(async ({ needs }) => {
			const gate = readGates.shift();
			if (gate) await gate.promise;
			const values: Record<string, unknown> = {};
			for (const need of needs) {
				const key = `${need.scope.account}:${need.key}`;
				if (remote.has(key)) values[need.key] = copy(remote.get(key));
			}
			return values as never;
		}),
		cloudGet: async () => null,
		cloudSet: vi.fn(async context => {
			startedWrites.shift()?.resolve();
			const gate = writeGates.shift();
			if (gate) await gate.promise;
			remote.set(`${context.scope.account}:${context.key}`, copy(context.value));
		}),
	};
	return {
		io, seeded, remote, readGates, writeGates, startedWrites,
		boot: (id = account) => new PreferencesManager(io, { id }),
		get saved() { return copy(saved!); },
	};
}

function unaffectedPreferences(profile: PreferencesProfile, changedAccount = account) {
	const preferences = copy(profile.preferences);
	// Keep all keys and all unrelated scopes in the comparison, excluding only
	// the two exact records which this migration is permitted to rewrite.
	for (const key of affectedKeys) {
		preferences[key] = preferences[key].filter(([recordScope]) => recordScope.account !== changedAccount) as never;
	}
	return preferences;
}

function expectPreserved(f: Awaited<ReturnType<typeof fixture>>, changedAccount = account) {
	expect(unaffectedPreferences(f.saved, changedAccount)).toEqual(unaffectedPreferences(f.seeded, changedAccount));
	for (const [context] of vi.mocked(f.io.cloudSet).mock.calls) {
		expect(affectedKeys).toContain(context.key);
		expect(context.scope).toEqual(scope(changedAccount));
	}
}

describe('実PreferencesManagerによるポータル移行', () => {
	beforeEach(() => window.localStorage.clear());

	test('初期同期と各cloudSetを待ち、最新の配置と他の全設定・scopeを保全する', async () => {
		const f = await fixture();
		const read = deferred();
		const menuWrite = deferred();
		const sidebarWrite = deferred();
		const menuStarted = deferred();
		const sidebarStarted = deferred();
		f.readGates.push(read);
		f.writeGates.push(menuWrite, sidebarWrite);
		f.startedWrites.push(menuStarted, sidebarStarted);
		const preferences = f.boot();
		const migration = migrateRetiredPortalMenu(preferences, window.localStorage, account);
		expect(preferences.s.menu).toEqual(localMenu);
		expect(f.io.cloudSet).not.toHaveBeenCalled();
		expect(f.io.save).not.toHaveBeenCalled();
		read.resolve();
		await menuStarted.promise;
		expect(preferences.s.menu).toEqual(['hatady', '-', 'timeline', 'custom']);
		expect(f.remote.get(`${account}:menu`)).toEqual(remoteMenu);
		expect(window.localStorage.getItem(marker)).toBeNull();
		menuWrite.resolve();
		await sidebarStarted.promise;
		expect(window.localStorage.getItem(marker)).toBeNull();
		sidebarWrite.resolve();
		await migration;
		expect(preferences.s['simpleUi.sidebar']).toEqual(remoteSidebar.filter(item => item.id !== 'portal'));
		expect(f.remote.get(`${account}:menu`)).toEqual(['hatady', '-', 'timeline', 'custom']);
		expect(f.remote.get(`${account}:simpleUi.sidebar`)).toEqual(remoteSidebar.filter(item => item.id !== 'portal'));
		expect(f.io.cloudSet).toHaveBeenCalledTimes(2);
		expect(window.localStorage.getItem(marker)).toBe('1');
		expectPreserved(f);
	});

	test('cloudGetBulk失敗時はローカル/リモート/完了印を変えない', async () => {
		const f = await fixture();
		const read = deferred();
		f.readGates.push(read);
		const preferences = f.boot();
		const migration = migrateRetiredPortalMenu(preferences, window.localStorage, account);
		const rejected = expect(migration).rejects.toThrow('get failed');
		read.reject(new Error('get failed'));
		await rejected;
		expect(f.io.save).not.toHaveBeenCalled();
		expect(f.io.cloudSet).not.toHaveBeenCalled();
		expect(f.saved).toEqual(f.seeded);
		expect(preferences.s.menu).toEqual(localMenu);
		expect(f.remote.get(`${account}:menu`)).toEqual(remoteMenu);
		expect(window.localStorage.getItem(marker)).toBeNull();
	});

	test.each(['menu', 'simpleUi.sidebar'] as const)('%sのcloudSet失敗後、次bootは残ったremote値から再試行する', async failedKey => {
		const f = await fixture();
		const write = deferred();
		const started = deferred();
		if (failedKey === 'simpleUi.sidebar') {
			const first = deferred();
			first.resolve();
			f.writeGates.push(first);
			f.startedWrites.push(deferred());
		}
		f.writeGates.push(write);
		f.startedWrites.push(started);
		const firstBoot = f.boot();
		const migration = migrateRetiredPortalMenu(firstBoot, window.localStorage, account);
		const rejected = expect(migration).rejects.toThrow('set failed');
		await started.promise;
		// Real commit has already saved the cleaned value locally at this point.
		expect(firstBoot.s.menu).not.toContain('portal');
		if (failedKey === 'simpleUi.sidebar') expect(firstBoot.s['simpleUi.sidebar'].some(item => item.id === 'portal')).toBe(false);
		write.reject(new Error('set failed'));
		await rejected;
		expect(window.localStorage.getItem(marker)).toBeNull();
		expect(f.remote.get(`${account}:${failedKey}`)).toEqual(failedKey === 'menu' ? remoteMenu : remoteSidebar);
		expectPreserved(f);
		vi.mocked(f.io.cloudSet).mockClear();

		const nextBoot = f.boot();
		await nextBoot.cloudReady;
		if (failedKey === 'menu') expect(nextBoot.s.menu).toContain('portal');
		else expect(nextBoot.s['simpleUi.sidebar'].some(item => item.id === 'portal')).toBe(true);
		await migrateRetiredPortalMenu(nextBoot, window.localStorage, account);
		expect(f.io.cloudSet).toHaveBeenCalledTimes(failedKey === 'menu' ? 2 : 1);
		expect(nextBoot.s.menu).toEqual(['hatady', '-', 'timeline', 'custom']);
		expect(nextBoot.s['simpleUi.sidebar']).toEqual(remoteSidebar.filter(item => item.id !== 'portal'));
		expect(window.localStorage.getItem(marker)).toBe('1');
		expectPreserved(f);
	});

	test('同じprofileでも別accountの完了印を使わず、他accountのoverrideを書き換えない', async () => {
		const f = await fixture();
		window.localStorage.setItem(marker, '1');
		const preferences = f.boot(otherAccount);
		const beforeMigration = copy(preferences.profile);
		await migrateRetiredPortalMenu(preferences, window.localStorage, otherAccount);
		expect(preferences.s.menu).toEqual(['other-first', 'other-last']);
		expect(preferences.s['simpleUi.sidebar']).toEqual([{ id: 'other', icon: 'ti ti-user', label: 'Other' }]);
		expect(f.remote.get(`${account}:menu`)).toEqual(remoteMenu);
		expect(window.localStorage.getItem(`hata_portal_cleanup_migrated:${otherAccount}:${profileId}`)).toBe('1');
		// Normalization legitimately creates defaults for account-dependent keys of
		// a new account. Compare the already normalized profile before migration.
		expect(unaffectedPreferences(f.saved, otherAccount)).toEqual(unaffectedPreferences(beforeMigration, otherAccount));
		for (const key of affectedKeys) {
			expect(f.saved.preferences[key].find(([recordScope]) => recordScope.account === account)).toEqual(f.seeded.preferences[key].find(([recordScope]) => recordScope.account === account));
		}
		for (const [context] of vi.mocked(f.io.cloudSet).mock.calls) expect(context.scope).toEqual(scope(otherAccount));
	});
});
