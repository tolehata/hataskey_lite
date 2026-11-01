/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type HatadyTutorialKind = 'initial' | 'update';

const REG_SCOPE = ['client', 'hatady'];
const TUTORIAL_KEY = 'tutorialDone';
const UPDATE_KEY = 'updateGuideVersion';
const UPDATE_VERSION = 2;
const MISSING = Symbol('missing Hatady tutorial key');
type TutorialAccount = { id: string; token: string };
type TutorialKey = typeof TUTORIAL_KEY | typeof UPDATE_KEY;

function currentAccount(): TutorialAccount {
	if (!$i) throw new Error('Hatady tutorial requires a signed-in account');
	return { id: $i.id, token: $i.token };
}

function assertCurrentAccount(account: TutorialAccount): void {
	if (!$i || $i.id !== account.id || $i.token !== account.token) {
		throw new Error('Hatady tutorial account changed');
	}
}

async function readKey(account: TutorialAccount, key: TutorialKey): Promise<unknown> {
	assertCurrentAccount(account);
	try {
		const value: unknown = await misskeyApi('i/registry/get', { scope: REG_SCOPE, key }, account.token);
		assertCurrentAccount(account);
		return value;
	} catch (error) {
		assertCurrentAccount(account);
		if (error && typeof error === 'object' && 'code' in error && error.code === 'NO_SUCH_KEY') return MISSING;
		throw error;
	}
}

async function writeKey(account: TutorialAccount, key: TutorialKey, value: boolean | number): Promise<void> {
	assertCurrentAccount(account);
	await misskeyApi('i/registry/set', { scope: REG_SCOPE, key, value }, account.token);
	assertCurrentAccount(account);
}

function tutorialDone(value: unknown): boolean {
	if (value === MISSING) return false;
	if (typeof value === 'boolean') return value;
	throw new TypeError('Unsupported Hatady tutorial completion value');
}

function updateVersion(value: unknown): number {
	if (value === MISSING) return 0;
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
	throw new TypeError('Unsupported Hatady update guide version');
}

export async function loadHatadyTutorialKind(): Promise<HatadyTutorialKind | null> {
	const account = currentAccount();
	if (!tutorialDone(await readKey(account, TUTORIAL_KEY))) return 'initial';
	return updateVersion(await readKey(account, UPDATE_KEY)) >= UPDATE_VERSION ? null : 'update';
}

export async function completeHatadyTutorial(kind: HatadyTutorialKind): Promise<void> {
	if (kind !== 'initial' && kind !== 'update') throw new TypeError('Unsupported Hatady tutorial kind');
	const account = currentAccount();
	// Validate both initial-guide values before writing either key. Existing
	// unknown formats are preserved instead of being treated as missing values.
	const done = kind === 'initial' ? tutorialDone(await readKey(account, TUTORIAL_KEY)) : true;
	const version = updateVersion(await readKey(account, UPDATE_KEY));
	// Initial-guide readers have already seen the current changes. Save that
	// fact first so a partial failure cannot immediately trigger an update guide.
	if (version < UPDATE_VERSION) await writeKey(account, UPDATE_KEY, UPDATE_VERSION);
	if (!done) await writeKey(account, TUTORIAL_KEY, true);
}
