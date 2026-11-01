/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, expect, test, vi } from 'vitest';
import { loadHatadyCollection } from './hatady-collection.js';
import type { HatadyMediaAdvancedFilters } from './hatady-media.js';

const fixture = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/hatady-ui.js', () => ({ hatadySeconds: vi.fn() }));

const booksApi = 'hata/hatady/books';
const mediaApi = 'hata/hatady/media/works/list';
const filters: HatadyMediaAdvancedFilters = {
	origin: 'domestic', viewingMode: 'subtitled', isRecommended: false, minRecommendation: 8.2,
	sessionKind: 'game_match', result: ' win ', weapon: ' sword ', rank: ' A ', route: ' north ',
	since: '2026-09-01', until: '2026-09-19',
};
const work = (id: string, kind = 'book', userId: string | undefined = 'viewer') => ({
	id, kind, userId, title: id, author: '著者', creator: '制作者', status: kind === 'book' ? 'reading' : 'in_progress',
	details: { genre: '分類', description: '説明' }, isRecommended: true,
});

beforeEach(() => { fixture.api.mockReset(); });

test('all loads both independent paginations and preserves each actual kind and owner without leaking category filters', async () => {
	const books = [...Array.from({ length: 100 }, (_, i) => work(`book-${i}`)), work('book-tail', 'book', 'other')];
	const media = [...Array.from({ length: 100 }, (_, i) => work(`media-${i}`, ['movie', 'game', 'work'][i % 3])), work('media-tail', 'work', 'other')];
	fixture.api.mockImplementation(async (endpoint: string, params: { untilId?: string }) => {
		const rows = endpoint === booksApi ? books : media;
		return params.untilId ? rows.slice(100) : rows.slice(0, 100);
	});
	const rows = await loadHatadyCollection('all', 'following', 'viewer', filters);
	expect(rows).toHaveLength(202);
	expect(new Set(rows.map(row => row.kind))).toEqual(new Set(['book', 'movie', 'game', 'work']));
	expect(rows.filter(row => row.mine)).toHaveLength(200);
	expect(rows.find(row => row.id === 'book-tail')).toMatchObject({ kind: 'book', mine: false, title: 'book-tail', creator: '著者', genre: '分類' });
	expect(rows.find(row => row.id === 'media-tail')).toMatchObject({ kind: 'work', mine: false, title: 'media-tail' });
	expect(fixture.api.mock.calls).toEqual([
		[booksApi, { scope: 'following', limit: 100 }],
		[mediaApi, { scope: 'following', limit: 100 }],
		[booksApi, { scope: 'following', limit: 100, untilId: 'book-99' }],
		[mediaApi, { scope: 'following', limit: 100, untilId: 'media-99' }],
	]);
	expect(rows.find(row => row.id === 'book-0')?.raw).toBe(books[0]);
});

test.each([
	{ kind: 'book', endpoint: booksApi, expected: {} },
	{ kind: 'movie', endpoint: mediaApi, expected: { kind: 'movie', origin: 'domestic', viewingMode: 'subtitled', isRecommended: false, minRecommendation: 8 } },
	{ kind: 'game', endpoint: mediaApi, expected: { kind: 'game', sessionKind: 'game_match', result: 'win', weapon: 'sword', rank: 'A', route: 'north', since: new Date('2026-09-01T00:00:00').toISOString(), until: new Date('2026-09-19T23:59:59.999').toISOString() } },
	{ kind: 'work', endpoint: mediaApi, expected: { kind: 'work', sessionKind: 'game_match', result: 'win', weapon: 'sword', rank: 'A', route: 'north', since: new Date('2026-09-01T00:00:00').toISOString(), until: new Date('2026-09-19T23:59:59.999').toISOString() } },
] as const)('$kind keeps its existing API and advanced-filter conversion', async ({ kind, endpoint, expected }) => {
	const before = JSON.stringify(filters);
	fixture.api.mockResolvedValue([work('item', kind)]);
	const rows = await loadHatadyCollection(kind, 'recent', 'viewer', filters);
	expect(fixture.api).toHaveBeenCalledExactlyOnceWith(endpoint, { scope: 'recent', limit: 100, ...expected });
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ id: 'item', kind, mine: true });
	expect(JSON.stringify(filters)).toBe(before);
});

test.each([booksApi, mediaApi])('all rejects a later-page failure in %s instead of returning the successful other collection', async failingEndpoint => {
	fixture.api.mockImplementation(async (endpoint: string, params: { untilId?: string }) => {
		if (endpoint !== failingEndpoint) return [work('finished-other', endpoint === booksApi ? 'book' : 'movie')];
		if (params.untilId) throw new Error('second page failed');
		return Array.from({ length: 100 }, (_, i) => work(`item-${i}`, endpoint === booksApi ? 'book' : 'movie'));
	});
	await expect(loadHatadyCollection('all', 'mine', 'viewer', {})).rejects.toThrow('second page failed');
	expect(fixture.api).toHaveBeenCalledWith(failingEndpoint, { scope: 'mine', limit: 100, untilId: 'item-99' });
});

test('the two collections start concurrently and an absent viewer never owns returned rows', async () => {
	let finishBooks!: (rows: unknown[]) => void;
	let finishMedia!: (rows: unknown[]) => void;
	fixture.api.mockImplementation((endpoint: string) => new Promise(resolve => {
		if (endpoint === booksApi) finishBooks = resolve;
		else finishMedia = resolve;
	}));
	const request = loadHatadyCollection('all', 'all', undefined, {});
	expect(fixture.api).toHaveBeenCalledTimes(2);
	finishMedia([work('movie', 'movie'), { ...work('missing-owner', 'game'), userId: undefined }]);
	finishBooks([work('book')]);
	const rows = await request;
	expect(rows.map(row => row.mine)).toEqual([false, false, false]);
	expect(fixture.api.mock.calls.every(([, payload]) => payload.scope === 'all')).toBe(true);
});

test('all rejects an unknown media category rather than silently omitting or mislabelling it', async () => {
	fixture.api.mockImplementation(async endpoint => endpoint === booksApi ? [] : [work('unknown', 'unexpected')]);
	await expect(loadHatadyCollection('all', 'mine', 'viewer', {})).rejects.toThrow('Invalid Hatady collection kind');
});
