/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';
import { migrateHataskeyDefaultSounds } from '@/utility/hataskey-sound-migration.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

const legacy = {
	'sound.on.note': 'syuilo/n-aec',
	'sound.on.noteMy': 'syuilo/n-cea-4va',
	'sound.on.noteSchedulePost': 'syuilo/n-cea',
	'sound.on.noteEdited': 'syuilo/n-eca',
	'sound.on.notification': 'syuilo/n-ea',
	'sound.on.reaction': 'syuilo/bubble2',
	'sound.on.chatMessage': 'syuilo/waon',
} as const;
const keys = Object.keys(legacy) as (keyof typeof legacy)[];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

async function fixture() {
	let saved: PreferencesProfile | null = null;
	const io: StorageProvider = {
		load: () => copy(saved),
		save: vi.fn(({ profile }) => { saved = copy(profile); }),
		cloudGetBulk: vi.fn(async () => ({})),
		cloudGet: async () => null,
		cloudSet: vi.fn(async () => undefined),
	};
	const seed = new PreferencesManager(io, { id: 'user' });
	await seed.cloudReady;
	for (const [index, key] of keys.entries()) {
		seed.profile.preferences[key] = [[{}, { type: legacy[key], volume: index / 10 }, {}]];
	}
	saved = copy(seed.profile);
	vi.mocked(io.save).mockClear();
	return { io, boot: (id = 'user') => new PreferencesManager(io, { id }), seed: copy(saved) };
}

describe('Hataskey既定音の移行', () => {
	beforeEach(() => window.localStorage.clear());

	test('全7用途の旧既定音だけを変更し、音量0を含む音量と他設定を保持する', async () => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		const before = copy(preferences.profile.preferences);
		await migrateHataskeyDefaultSounds(preferences, window.localStorage);
		for (const [index, key] of keys.entries()) {
			expect(preferences.s[key]).toEqual({ type: `hataskey-sound/${key.slice(9)}`, volume: index / 10 });
			delete (before as Partial<typeof before>)[key];
		}
		const after = copy(preferences.profile.preferences);
		for (const key of keys) delete (after as Partial<typeof after>)[key];
		expect(after).toEqual(before);
		expect(window.localStorage.length).toBe(7);
	});

	test('無音・ドライブ音源・別のsyuilo音と追加フィールドを保持する', async () => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		const custom = [null, '_driveFile_', 'syuilo/bubble1'] as const;
		for (const [index, type] of custom.entries()) {
			await preferences.commit(keys[index], { type, volume: 0.4, fileId: 'file', fileUrl: '/sound.wav' });
		}
		const before = keys.slice(0, 3).map(key => copy(preferences.s[key]));
		await migrateHataskeyDefaultSounds(preferences, window.localStorage);
		expect(keys.slice(0, 3).map(key => preferences.s[key])).toEqual(before);
	});

	test('共有scopeの完了印を別accountでも使い、移行後に旧音へ戻した選択を保持する', async () => {
		const f = await fixture();
		const preferences = f.boot();
		await migrateHataskeyDefaultSounds(preferences, window.localStorage);
		await preferences.commit('sound.on.note', { type: legacy['sound.on.note'], volume: 0.2 });
		const other = f.boot('other');
		await migrateHataskeyDefaultSounds(other, window.localStorage);
		expect(other.s['sound.on.note']).toEqual({ type: legacy['sound.on.note'], volume: 0.2 });
		expect(window.localStorage.length).toBe(7);
		other.setAccountOverride('sound.on.note');
		await migrateHataskeyDefaultSounds(other, window.localStorage);
		expect(other.s['sound.on.note'].type).toBe('hataskey-sound/note');
		expect(other.profile.preferences['sound.on.note'][0][1].type).toBe(legacy['sound.on.note']);
		expect(window.localStorage.length).toBe(8);
	});

	test('初期同期の最新選択を使い、同期完了まで保存しない', async () => {
		const f = await fixture();
		const gate = deferred();
		vi.mocked(f.io.cloudGetBulk).mockImplementationOnce(async () => { await gate.promise; return {}; });
		const preferences = f.boot();
		const migration = migrateHataskeyDefaultSounds(preferences, window.localStorage);
		expect(window.localStorage.length).toBe(0);
		expect(f.io.save).not.toHaveBeenCalled();
		await preferences.commit('sound.on.note', { type: 'syuilo/bubble1', volume: 0.7 });
		gate.resolve();
		await migration;
		expect(preferences.s['sound.on.note']).toEqual({ type: 'syuilo/bubble1', volume: 0.7 });
	});

	test('同期失敗時は保存・完了印を残さない', async () => {
		const f = await fixture();
		vi.mocked(f.io.cloudGetBulk).mockRejectedValueOnce(new Error('read failed'));
		await expect(migrateHataskeyDefaultSounds(f.boot(), window.localStorage)).rejects.toThrow('read failed');
		expect(f.io.save).not.toHaveBeenCalled();
		expect(window.localStorage.length).toBe(0);
	});

	test('同期保存を待ち、保存失敗時は完了印を残さない', async () => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		preferences.getMatchedRecordOf('sound.on.note')[2].sync = true;
		const gate = deferred();
		vi.mocked(f.io.cloudSet).mockImplementationOnce(async () => { await gate.promise; });
		const migration = migrateHataskeyDefaultSounds(preferences, window.localStorage);
		const rejected = expect(migration).rejects.toThrow('write failed');
		await Promise.resolve();
		expect(f.io.cloudSet).toHaveBeenCalledTimes(1);
		expect(window.localStorage.length).toBe(0);
		gate.reject(new Error('write failed'));
		await rejected;
		expect(window.localStorage.length).toBe(0);
	});

	test.each(['profile', 'scope'] as const)('同期待ち中の%s変更で移行を中止する', async change => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		const gate = deferred();
		preferences.cloudReady = gate.promise;
		const migration = migrateHataskeyDefaultSounds(preferences, window.localStorage);
		if (change === 'profile') preferences.profile.id = 'other-profile';
		else preferences.setAccountOverride('sound.on.note');
		vi.mocked(f.io.save).mockClear();
		gate.resolve();
		await migration;
		expect(f.io.save).not.toHaveBeenCalled();
		expect(window.localStorage.length).toBe(0);
	});

	test.each(['profile', 'scope'] as const)('保存待ち中の%s変更で完了印と後続変更を中止する', async change => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		preferences.getMatchedRecordOf('sound.on.note')[2].sync = true;
		const gate = deferred();
		vi.mocked(f.io.cloudSet).mockImplementationOnce(async () => { await gate.promise; });
		const migration = migrateHataskeyDefaultSounds(preferences, window.localStorage);
		await Promise.resolve();
		if (change === 'profile') preferences.profile.id = 'other-profile';
		else preferences.setAccountOverride('sound.on.note');
		gate.resolve();
		await migration;
		expect(preferences.s['sound.on.noteMy'].type).toBe(legacy['sound.on.noteMy']);
		expect(window.localStorage.length).toBe(0);
	});
});
