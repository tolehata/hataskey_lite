/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { useHk3Reactions } from './use-hk3-reactions.js';
import { prefer } from '@/preferences.js';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';
import { hiddenReactionsVersion } from '@/utility/hidden-reactions.js';
import { mutedReactionsRevision } from '@/utility/muted-reactions.js';

const mocks = vi.hoisted(() => ({
	entry: undefined as { delta: Record<string, number> } | undefined,
	request: vi.fn(), fetch: vi.fn(), hidden: new Set<string>(),
}));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { mutingEmojis: ref<string[]>([]) } } };
});
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hideMutedReactionsLocal: ref(false) };
});
vi.mock('@/utility/muted-users.js', async () => {
	const { ref } = await import('vue');
	return { fetchMutedUsers: mocks.fetch, mutedUsersRevision: ref(0) };
});
vi.mock('@/utility/muted-reactions.js', async () => {
	const { ref } = await import('vue');
	return { getMutedReactions: () => mocks.entry, requestMutedReactions: mocks.request, mutedReactionsRevision: ref(0) };
});
vi.mock('@/utility/hidden-reactions.js', async () => {
	const { ref } = await import('vue');
	return {
		hiddenReactionsVersion: ref(0),
		filterHiddenReactions: (_id: string, source: Record<string, number>) => Object.fromEntries(Object.entries(source).filter(([key]) => !mocks.hidden.has(key))),
	};
});
const scopes: ReturnType<typeof effectScope>[] = [];

function setup(initial: Record<string, number> = { '👍': 3, '❤️': 1 }) {
	const source = ref<Record<string, number>>(initial);
	const mine = ref<string | null>(null);
	const scope = effectScope();
	scopes.push(scope);
	const result = scope.run(() => useHk3Reactions('note1', () => source.value, () => mine.value))!;
	return { source, mine, result };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.entry = undefined;
	mocks.hidden.clear();
	hideMutedReactionsLocal.value = false;
	prefer.r.mutingEmojis.value = [];
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

describe('UI S reaction filtering', () => {
	it('uses the shared emoji mute normalization and reacts to changes immediately', () => {
		const { result } = setup({ ':cat@.:': 2, ':cat@remote.example:': 1, '👍': 3 });
		prefer.r.mutingEmojis.value = [':cat:', '👍'];
		expect(result.value).toEqual({ ':cat@remote.example:': 1 });
		prefer.r.mutingEmojis.value = [':cat@remote.example:'];
		expect(result.value).toEqual({ ':cat@.:': 2, '👍': 3 });
		expect(mocks.request).not.toHaveBeenCalled();
	});
	it('applies per-note hidden reactions without fetching actors', () => {
		const { result } = setup();
		mocks.hidden.add('👍');
		hiddenReactionsVersion.value++;
		expect(result.value).toEqual({ '❤️': 1 });
		expect(mocks.request).not.toHaveBeenCalled();
	});
	it('waits for actor counts, subtracts muted actors, and retains own reactions', async () => {
		hideMutedReactionsLocal.value = true;
		const { result, mine } = setup();
		expect(result.value).toEqual({});
		expect(mocks.request).toHaveBeenCalledWith('note1', 4);
		mocks.entry = { delta: { '👍': 2, '❤️': 1 } };
		mutedReactionsRevision.value++;
		await nextTick();
		expect(result.value).toEqual({ '👍': 1 });
		mine.value = '❤️';
		await nextTick();
		expect(result.value).toEqual({ '👍': 1, '❤️': 1 });
	});
	it('subtracts muted actors sharing my emoji and updates on removal, re-reaction and disabling', async () => {
		hideMutedReactionsLocal.value = true;
		mocks.entry = { delta: { '👍': 2, '😢': 2 } };
		const { result, source, mine } = setup({ '👍': 3, '😢': 2, '❤️': 2 });
		mine.value = '👍';
		await nextTick();
		// Two muted actors share my reaction; only my one reaction stays visible.
		expect(result.value).toEqual({ '👍': 1, '❤️': 2 });

		mine.value = null;
		source.value['👍'] = 2;
		await nextTick();
		expect(result.value).toEqual({ '❤️': 2 });

		mine.value = '👍';
		source.value['👍'] = 3;
		await nextTick();
		expect(result.value).toEqual({ '👍': 1, '❤️': 2 });

		hideMutedReactionsLocal.value = false;
		await nextTick();
		expect(result.value).toEqual({ '👍': 3, '😢': 2, '❤️': 2 });
	});
	it('never flashes unfiltered counts while enabling or refreshing mute filtering', async () => {
		const { result, source } = setup();
		expect(result.value).toEqual({ '👍': 3, '❤️': 1 });
		hideMutedReactionsLocal.value = true;
		await nextTick();
		expect(result.value).toEqual({});
		mocks.entry = { delta: { '👍': 2 } };
		mutedReactionsRevision.value++;
		await nextTick();
		expect(result.value).toEqual({ '👍': 1, '❤️': 1 });
		mocks.entry = undefined;
		source.value['👍'] = 10;
		await nextTick();
		expect(result.value['👍']).toBe(1);
		hideMutedReactionsLocal.value = false;
		await nextTick();
		expect(result.value['👍']).toBe(10);
	});
});
