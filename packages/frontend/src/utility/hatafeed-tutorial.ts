/* SPDX-License-Identifier: AGPL-3.0-only */
import { host } from '@@/js/config.js';
import type { HataFeedTutorialKind } from '@/utility/hatafeed-tutorial-content.js';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const SCOPE = ['client', 'hatafeed'];
const KEY = 'tutorialVersion';
const VERSION = 1;
const MISSING = Symbol('missing tutorial key');
type Account = { id: string; token: string };

function account(): Account {
	if (!$i) throw new Error('HataFeed tutorial requires a signed-in account');
	return { id: $i.id, token: $i.token };
}

function assertAccount(owner: Account): void {
	if (!$i || $i.id !== owner.id || $i.token !== owner.token) throw new Error('HataFeed tutorial account changed');
}

async function read(owner: Account, scope: string[], key: string): Promise<unknown> {
	assertAccount(owner);
	try {
		const value: unknown = await misskeyApi('i/registry/get', { scope, key }, owner.token);
		assertAccount(owner);
		return value;
	} catch (error) {
		assertAccount(owner);
		if (error && typeof error === 'object' && 'code' in error && error.code === 'NO_SUCH_KEY') return MISSING;
		throw error;
	}
}

function version(value: unknown): number {
	if (value === MISSING) return 0;
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Unsupported HataFeed tutorial version');
	return value;
}

export async function loadHataFeedTutorialKind(hasExistingActivity = false): Promise<HataFeedTutorialKind | null> {
	const owner = account();
	const seen = version(await read(owner, SCOPE, KEY));
	if (seen >= VERSION) return null;
	if (seen > 0 || hasExistingActivity) return 'update';
	// Read the retired account's announcement flag only as migration evidence.
	// Never restore its old setting/UI or infer another account's usage from a
	// device-wide flag. A missing flag is different from a failed registry read.
	const legacy = await read(owner, ['client', 'preferences', 'sync'], 'default:simpleUi.hatafeedIntroShown');
	if (legacy === MISSING) return 'initial';
	if (!Array.isArray(legacy) || !legacy.every(record => Array.isArray(record) && record[0] != null && typeof record[0] === 'object' && typeof record[1] === 'boolean')) {
		throw new TypeError('Unsupported HataFeed legacy announcement');
	}
	return legacy.some(([scope, shown]) => shown === true && (scope.account == null || scope.account === owner.id) && (scope.server == null || scope.server === host)) ? 'update' : 'initial';
}

export async function completeHataFeedTutorial(): Promise<void> {
	const owner = account();
	if (version(await read(owner, SCOPE, KEY)) >= VERSION) return;
	assertAccount(owner);
	// One account-scoped key makes completion atomic; it never changes themes,
	// drafts, project data, or the old preferences.
	await misskeyApi('i/registry/set', { scope: SCOPE, key: KEY, value: VERSION }, owner.token);
	assertAccount(owner);
}
