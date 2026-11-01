/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { HATAGOES_SEARCH_SQL, HatagoesSearchService, hatagoesSearchPattern } from './HatagoesSearchService.js';

describe('HataGoes search input and visibility contract', () => {
	test('one character searches, while blank input cannot become a full data scan', () => {
		expect(hatagoesSearchPattern('本')).toBe('%本%');
		expect(hatagoesSearchPattern(' ＡＢ ')).toBe('%AB%');
		expect(hatagoesSearchPattern(' \u3000 ')).toBeNull();
	});

	test('escapes SQL LIKE wildcards and backslashes', () => {
		expect(hatagoesSearchPattern('50%_\\')).toBe('%50\\%\\_\\\\%');
	});

	test('uses only bounded Hatask Registry keys and parameters for input', () => {
		expect(HATAGOES_SEARCH_SQL).toContain("r.scope=ARRAY['client','hatask']::varchar[]");
		expect(HATAGOES_SEARCH_SQL).toContain("r.key IN ('events','todos','moods','meals','flower','gallery')");
		expect(HATAGOES_SEARCH_SQL).toContain("SELECT * FROM registry_rows WHERE key IN ('events','todos')");
		expect(HATAGOES_SEARCH_SQL).toContain('jsonb_object_agg(field.key,field.value ORDER BY e."updatedAt",e.registry_id,e.ordinality)');
		expect(HATAGOES_SEARCH_SQL).toContain('normalize(search_text, NFKC) ILIKE $2');
		expect(HATAGOES_SEARCH_SQL).toContain('OFFSET $3 LIMIT $4');
	});

	test('does not expose cooking records or community flowers beyond their existing lists', () => {
		const cooking = HATAGOES_SEARCH_SQL.slice(HATAGOES_SEARCH_SQL.indexOf("SELECT 'cooking:'"), HATAGOES_SEARCH_SQL.indexOf("SELECT 'log:'"));
		expect(cooking).toContain('WHERE cr."userId"=$1');
		expect(cooking).not.toContain('cr.visibility');
		const flowers = HATAGOES_SEARCH_SQL.slice(HATAGOES_SEARCH_SQL.indexOf("SELECT 'flower:'"), HATAGOES_SEARCH_SQL.indexOf("SELECT 'cooking:'"));
		expect(flowers).toContain("f.id, f.\"userId\"");
		expect(flowers).toContain('owner.host IS NULL');
		expect(flowers).toContain('owner."isSuspended"=FALSE');
		expect(flowers).toContain('m."muterId"=$1 AND m."muteeId"=f."userId"');
		expect(flowers).toContain('b."blockerId"=$1');
		expect(flowers).toContain('b."blockeeId"=$1');
	});

	test('uses JSONB text for JSONB arrays and SQL array function for SQL arrays', () => {
		expect(HATAGOES_SEARCH_SQL).toContain('l.tags::text');
		expect(HATAGOES_SEARCH_SQL).toContain('w.highlights::text');
		expect(HATAGOES_SEARCH_SQL).not.toContain("array_to_string(l.tags");
		expect(HATAGOES_SEARCH_SQL).not.toContain("array_to_string(w.highlights");
		expect(HATAGOES_SEARCH_SQL).toContain("array_to_string(r.tags,' ')");
		expect(HATAGOES_SEARCH_SQL).toContain("array_to_string(e.aliases,' ')");
	});

	test('gates private HataFeed content before both page and counts', () => {
		expect(HATAGOES_SEARCH_SQL).toContain("$7 OR i.category<>'security'");
		expect(HATAGOES_SEARCH_SQL).toContain('p.suspended=FALSE OR p."ownerId"=$1 OR $7');
		expect(HATAGOES_SEARCH_SQL).toContain("e.\"requestedById\"=$1");
		expect(HATAGOES_SEARCH_SQL.indexOf('), matched AS (')).toBeGreaterThan(HATAGOES_SEARCH_SQL.indexOf('FROM feedback_emoji_change_request'));
	});

	test('passes access decisions as SQL parameters and derives pagination from filtered total', async () => {
		const query = vi.fn().mockResolvedValue([{ items: [{ id: 'book:1', app: 'hatady', kind: 'book', title: '本', text: '', url: '/hatady?tab=collection' }], total: 3, hatask: 1, hatady: 3, hatafeed: 0, users: 1 }]);
		const service = new HatagoesSearchService(
			{ manager: { query } } as unknown as ConstructorParameters<typeof HatagoesSearchService>[0],
			{ canAccess: async () => false, isStaff: async () => false } as unknown as ConstructorParameters<typeof HatagoesSearchService>[1],
			{ getUserPolicies: async () => ({ canSearchUsers: true }) } as unknown as ConstructorParameters<typeof HatagoesSearchService>[2],
		);
		const result = await service.search({ id: 'viewer' } as Parameters<typeof service.search>[0], ' 本 ', 'hatady', 1, 1);
		expect(query).toHaveBeenCalledWith(HATAGOES_SEARCH_SQL, ['viewer', '%本%', 1, 1, 'hatady', false, false, true]);
		expect(result).toMatchObject({ total: 3, counts: { hatask: 1, hatady: 3, hatafeed: 0, users: 1 }, hasMore: true });
		await expect(service.search({ id: 'viewer' } as Parameters<typeof service.search>[0], '   ', 'all', 0, 20)).resolves.toMatchObject({ total: 0, items: [] });
		expect(query).toHaveBeenCalledTimes(1);
	});
});
