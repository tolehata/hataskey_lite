/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyHomeWork } from '@/utility/hatady-home.js';
import type { HatadyMediaAdvancedFilters, HatadyMediaKind } from '@/utility/hatady-media.js';
import { collectWorkPages, homeWork } from '@/utility/hatady-home.js';
import { mediaAdvancedFilterPayload } from '@/utility/hatady-media.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type CollectionRow = Record<string, unknown> & { id: string; userId?: string; kind?: HatadyMediaKind };
type CollectionScope = 'mine' | 'recent' | 'public' | 'following' | 'all';

/** Load the complete selected collection, leaving scope authorization to the existing APIs. */
export async function loadHatadyCollection(
	kind: 'all' | HatadyHomeWork['kind'],
	scope: string,
	viewerId: string | undefined,
	filters: HatadyMediaAdvancedFilters,
): Promise<HatadyHomeWork[]> {
	const params = { scope: scope as CollectionScope, limit: 100 };
	const isMine = (work: CollectionRow): boolean => !!viewerId && work.userId === viewerId;

	async function loadBooks(): Promise<HatadyHomeWork[]> {
		const rows = await collectWorkPages<CollectionRow>(untilId => misskeyApi<CollectionRow[]>(
			'hata/hatady/books', { ...params, ...(untilId ? { untilId } : {}) },
		));
		return rows.map(work => homeWork(work, isMine(work), 'book'));
	}

	async function loadMedia(mediaKind?: HatadyMediaKind): Promise<HatadyHomeWork[]> {
		const mediaParams = {
			...params,
			...(mediaKind ? {
				kind: mediaKind,
				...mediaAdvancedFilterPayload(mediaKind, {
					...filters,
					since: filters.since ? new Date(`${filters.since}T00:00:00`).toISOString() : undefined,
					until: filters.until ? new Date(`${filters.until}T23:59:59.999`).toISOString() : undefined,
				}),
			} : {}),
		};
		const rows = await collectWorkPages<CollectionRow>(untilId => misskeyApi<CollectionRow[]>(
			'hata/hatady/media/works/list', { ...mediaParams, ...(untilId ? { untilId } : {}) },
		));
		return rows.map(work => {
			const actualKind = mediaKind ?? work.kind;
			if (actualKind !== 'movie' && actualKind !== 'game' && actualKind !== 'work') throw new Error('Invalid Hatady collection kind');
			return homeWork(work, isMine(work), actualKind);
		});
	}

	if (kind === 'book') return loadBooks();
	if (kind !== 'all') return loadMedia(kind);
	// Reject the whole request if either collection fails; never display a partial result as complete.
	const [books, media] = await Promise.all([loadBooks(), loadMedia()]);
	return [...books, ...media];
}
