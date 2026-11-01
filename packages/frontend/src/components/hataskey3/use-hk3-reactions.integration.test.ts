/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hideMutedReactionsLocal: ref(true) };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { mutingEmojis: ref<string[]>([]) } } };
});

const scopes: ReturnType<typeof effectScope>[] = [];
const cleanups: (() => void)[] = [];
const timestamp = '2026-09-27T00:00:00.000Z';
const user = (id: string) => ({ id, username: id, name: null, host: null, avatarUrl: null, avatarBlurhash: null, avatarDecorations: [], isBot: false, isCat: false, emojis: {}, roles: [] });
const mute = (id: string) => ({ id: `mute-${id}`, createdAt: timestamp, expiresAt: null, muteeId: id, mutee: user(id) });
const reaction = (id: string, type: string, userId: string) => ({ id, createdAt: timestamp, type, user: user(userId) });

beforeEach(() => {
	vi.resetModules();
	mocks.api.mockReset();
	localStorage.removeItem('hiddenReactions');
});
afterEach(() => {
	scopes.splice(0).forEach(scope => scope.stop());
	cleanups.splice(0).forEach(cleanup => cleanup());
});

async function settle() {
	// mute/list settles, its revision requests notes/reactions, then the actor
	// cache revision recomputes the hook. No timers or component mount are needed.
	for (let i = 0; i < 8; i++) {
		await Promise.resolve();
		await nextTick();
	}
}

async function setup(counts: Record<string, number>, rows: ReturnType<typeof reaction>[], mine: string | null = null, mutedIds = ['muted']) {
	let resolveMutes!: (rows: ReturnType<typeof mute>[]) => void;
	const muteList = new Promise<ReturnType<typeof mute>[]>(resolve => { resolveMutes = resolve; });
	mocks.api.mockImplementation(async (endpoint: string) => {
		if (endpoint === 'mute/list') return muteList;
		if (endpoint === 'notes/reactions') return rows;
		throw new Error(`Unexpected endpoint: ${endpoint}`);
	});
	const { useHk3Reactions } = await import('./use-hk3-reactions.js');
	const users = await import('@/utility/muted-users.js');
	const actors = await import('@/utility/muted-reactions.js');
	const { hideMutedReactionsLocal } = await import('@/utility/hatasaba-device-prefs.js');
	const source = ref(counts);
	const myReaction = ref(mine);
	const scope = effectScope();
	scopes.push(scope);
	cleanups.push(() => { users.invalidateMutedUsers(); actors.invalidateMutedReactions(); });
	const visible = scope.run(() => useHk3Reactions('note1', () => source.value, () => myReaction.value))!;
	return { visible, source, myReaction, users, hideMutedReactionsLocal, loadMutes: () => resolveMutes(mutedIds.map(mute)) };
}

describe('UI S reactions through the real shared mute stores', () => {
	it('loads mute/list before actors, hides muted-only Unicode/custom reactions and subtracts mixed actors', async () => {
		const view = await setup({ '😢': 1, ':cat@.:': 1, '👍': 2 }, [
			reaction('r1', '😢', 'muted'),
			reaction('r2', ':cat@.:', 'muted-2'),
			reaction('r3', '👍', 'muted-3'),
			reaction('r4', '👍', 'ordinary'),
		], null, ['muted', 'muted-2', 'muted-3']);
		expect(view.visible.value).toEqual({});
		view.loadMutes();
		await settle();
		expect(view.visible.value).toEqual({ '👍': 1 });
		expect(view.users.isMutedUser('muted')).toBe(true);
		expect(mocks.api.mock.calls.map(call => call[0])).toEqual(['mute/list', 'notes/reactions']);
		expect(mocks.api).toHaveBeenCalledWith('mute/list', { limit: 100 });
		expect(mocks.api).toHaveBeenCalledWith('notes/reactions', { noteId: 'note1', limit: 100 });
	});

	it('subtracts muted users sharing my emoji and returns filtered counts when the setting is reenabled', async () => {
		const view = await setup({ '👍': 2, ':cat@.:': 1 }, [
			reaction('r1', '👍', 'muted'),
			reaction('r2', '👍', 'me'),
			reaction('r3', ':cat@.:', 'muted-2'),
		], '👍', ['muted', 'muted-2']);
		view.loadMutes();
		await settle();
		// The self reaction remains as one actor; it must not exempt the entire emoji.
		expect(view.visible.value).toEqual({ '👍': 1 });
		view.hideMutedReactionsLocal.value = false;
		await settle();
		expect(view.visible.value).toEqual({ '👍': 2, ':cat@.:': 1 });
		view.hideMutedReactionsLocal.value = true;
		await settle();
		expect(view.visible.value).toEqual({ '👍': 1 });
		expect(mocks.api.mock.calls.filter(call => call[0] === 'notes/reactions')).toHaveLength(1);
	});

	it('updates displayed reactions on immediate unmute and remute without reloading the note', async () => {
		const view = await setup({ '😢': 1, '👍': 2 }, [
			reaction('r1', '😢', 'muted'),
			reaction('r2', '👍', 'muted-2'),
			reaction('r3', '👍', 'ordinary'),
		], null, ['muted', 'muted-2']);
		view.loadMutes();
		await settle();
		expect(view.visible.value).toEqual({ '👍': 1 });
		view.users.updateMutedUserState('muted', false);
		view.users.updateMutedUserState('muted-2', false);
		await settle();
		expect(view.visible.value).toEqual({ '😢': 1, '👍': 2 });
		view.users.updateMutedUserState('muted', true);
		view.users.updateMutedUserState('muted-2', true);
		await settle();
		expect(view.visible.value).toEqual({ '👍': 1 });
		expect(mocks.api.mock.calls.filter(call => call[0] === 'mute/list')).toHaveLength(1);
		expect(mocks.api.mock.calls.filter(call => call[0] === 'notes/reactions')).toHaveLength(2);
	});
});
