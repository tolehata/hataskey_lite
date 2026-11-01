/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Keys } from '@/local-storage.js';
import type { PreferencesManager } from '@/preferences/manager.js';

const legacySounds = {
	'sound.on.note': 'syuilo/n-aec',
	'sound.on.noteMy': 'syuilo/n-cea-4va',
	'sound.on.noteSchedulePost': 'syuilo/n-cea',
	'sound.on.noteEdited': 'syuilo/n-eca',
	'sound.on.notification': 'syuilo/n-ea',
	'sound.on.reaction': 'syuilo/bubble2',
	'sound.on.chatMessage': 'syuilo/waon',
} as const;

const currentSounds = {
	'sound.on.note': 'hataskey-sound/note',
	'sound.on.noteMy': 'hataskey-sound/noteMy',
	'sound.on.noteSchedulePost': 'hataskey-sound/noteSchedulePost',
	'sound.on.noteEdited': 'hataskey-sound/noteEdited',
	'sound.on.notification': 'hataskey-sound/notification',
	'sound.on.reaction': 'hataskey-sound/reaction',
	'sound.on.chatMessage': 'hataskey-sound/chatMessage',
} as const;

type SoundKey = keyof typeof legacySounds;
type Preferences = Pick<PreferencesManager, 'cloudReady' | 'profile' | 's' | 'commit' | 'getMatchedRecordOf'>;
type Storage = {
	getItem: (key: Keys) => string | null;
	setItem: (key: Keys, value: string) => void;
};

function scopeOf(preferences: Preferences, key: SoundKey): string {
	const scope = preferences.getMatchedRecordOf(key)[0];
	return JSON.stringify([scope.server ?? null, scope.account ?? null, scope.device ?? null]);
}

/** 旧既定音だけを一度更新し、独自の選択・無音・音量を保全する。 */
export async function migrateHataskeyDefaultSounds(preferences: Preferences, storage: Storage): Promise<void> {
	const profileId = preferences.profile.id;
	const keys = Object.keys(legacySounds) as SoundKey[];
	const scopes = new Map(keys.map(key => [key, scopeOf(preferences, key)]));
	const stillCurrent = () => preferences.profile.id === profileId
		&& keys.every(key => scopeOf(preferences, key) === scopes.get(key));

	await preferences.cloudReady;
	if (!stillCurrent()) return;

	for (const key of keys) {
		if (!stillCurrent()) return;
		// Scope, rather than the logged-in account, identifies a shared record.
		const marker: Keys = `hata_sound_default_migrated:${JSON.stringify([profileId, key, scopes.get(key)])}`;
		if (storage.getItem(marker) === '1') continue;

		const sound = preferences.s[key];
		if (sound.type === legacySounds[key]) {
			await preferences.commit(key, { ...sound, type: currentSounds[key] });
		}
		if (!stillCurrent()) return;
		storage.setItem(marker, '1');
	}
}
