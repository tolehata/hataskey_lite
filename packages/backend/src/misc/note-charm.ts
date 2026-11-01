/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiDriveFile } from '@/models/DriveFile.js';
import type { MiUser } from '@/models/User.js';

export const NOTE_CHARM_PATTERNS = ['cutout', 'clear', 'dots', 'stripes', 'check'] as const;
export const NOTE_CHARM_MIN_SIZE = 48;
export const NOTE_CHARM_MAX_SIZE = 64;
const NOTE_CHARM_LEGACY_MAX_SIZE = 96;
export type NoteCharmSettings = {
	fileId: string;
	enabled: boolean;
	size: number;
	pattern: typeof NOTE_CHARM_PATTERNS[number];
	color: string;
};
export type PublicNoteCharm = Omit<NoteCharmSettings, 'fileId' | 'enabled'> & { url: string };

export const noteCharmSettingsSchema = {
	type: 'object', nullable: true,
	properties: {
		fileId: { type: 'string', format: 'misskey:id' },
		enabled: { type: 'boolean' },
		size: { type: 'integer', minimum: NOTE_CHARM_MIN_SIZE, maximum: NOTE_CHARM_MAX_SIZE },
		pattern: { type: 'string', enum: NOTE_CHARM_PATTERNS },
		color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
	},
	required: ['fileId', 'enabled', 'size', 'pattern', 'color'],
	additionalProperties: false,
} as const;

/** Stored settings keep the former width range so existing decorations survive. */
export function isValidNoteCharmSettings(value: unknown): value is NoteCharmSettings {
	if (typeof value !== 'object' || value == null || Array.isArray(value)) return false;
	const s = value as Record<string, unknown>;
	return Object.keys(s).length === 5 &&
		typeof s.fileId === 'string' && /^[a-zA-Z0-9]+$/.test(s.fileId) &&
		typeof s.enabled === 'boolean' &&
		typeof s.size === 'number' && Number.isInteger(s.size) && s.size >= NOTE_CHARM_MIN_SIZE && s.size <= NOTE_CHARM_LEGACY_MAX_SIZE &&
		NOTE_CHARM_PATTERNS.some(pattern => pattern === s.pattern) &&
		typeof s.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s.color);
}

/** Normalize both public and owner views without rewriting the stored setting. */
export function normalizeNoteCharmSettings(value: unknown): NoteCharmSettings | null {
	return isValidNoteCharmSettings(value) ? { ...value, size: Math.min(value.size, NOTE_CHARM_MAX_SIZE) } : null;
}

export function isValidNoteCharmFile(file: MiDriveFile | null | undefined, userId: string, fileId: string): file is MiDriveFile {
	return file != null && file.id === fileId && file.userId === userId && file.userHost == null &&
		['image/png', 'image/webp', 'image/jpeg'].includes(file.type) &&
		Number.isInteger(file.size) && file.size >= 0 && file.size <= 5 * 1024 * 1024 && !file.isSensitive;
}

/** Null is always permitted so revoked accounts can remove their saved setting. */
export function validateNoteCharmUpdate(settings: NoteCharmSettings | null, permitted: boolean, userId: string, file: MiDriveFile | null): 'restrictedByRole' | 'invalidNoteCharmFile' | null {
	if (settings === null) return null;
	if (permitted !== true) return 'restrictedByRole';
	return isValidNoteCharmFile(file, userId, settings.fileId) ? null : 'invalidNoteCharmFile';
}

/** No persistent cache: consent, files and revoked/expired roles are checked on retrieval. */
export async function packNoteCharms(users: readonly Pick<MiUser, 'id' | 'host' | 'noteCharm'>[], dependencies: {
	findConsentedUserIds: (userIds: string[]) => Promise<ReadonlySet<string>>;
	getPolicies: (userId: string) => Promise<{ canUseNoteCharm: boolean }>;
	findFiles: (ids: string[]) => Promise<MiDriveFile[]>;
	getPublicUrl: (file: MiDriveFile) => string;
}): Promise<Map<string, PublicNoteCharm | null>> {
	const uniqueUsers = [...new Map(users.map(user => [user.id, user])).values()];
	const result = new Map<string, PublicNoteCharm | null>(uniqueUsers.map(user => [user.id, null]));
	const equipped = uniqueUsers.filter(user => user.host == null && isValidNoteCharmSettings(user.noteCharm) && user.noteCharm.enabled);
	if (equipped.length === 0) return result;
	const consentedUserIds = await dependencies.findConsentedUserIds(equipped.map(user => user.id));
	const consented = equipped.filter(user => consentedUserIds.has(user.id));
	const permitted = (await Promise.all(consented.map(async user => (await dependencies.getPolicies(user.id)).canUseNoteCharm === true ? user : null)))
		.filter((user): user is typeof equipped[number] => user !== null);
	if (permitted.length === 0) return result;
	const files = new Map((await dependencies.findFiles([...new Set(permitted.map(user => user.noteCharm!.fileId))])).map(file => [file.id, file]));
	for (const user of permitted) {
		const settings = normalizeNoteCharmSettings(user.noteCharm)!;
		const file = files.get(settings.fileId);
		if (!isValidNoteCharmFile(file, user.id, settings.fileId)) continue;
		result.set(user.id, { url: dependencies.getPublicUrl(file), size: settings.size, pattern: settings.pattern, color: settings.color });
	}
	return result;
}
