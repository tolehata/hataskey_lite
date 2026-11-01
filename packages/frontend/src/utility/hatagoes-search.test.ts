/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { hatagoesSearchResultUrl } from './hatagoes-search.js';
import { readHatagoesLocation } from './hatagoes-navigation.js';

describe('HataGoes search links', () => {
	test('links to the precise saved record even when opened in another tab', () => {
		const location = readHatagoesLocation(hatagoesSearchResultUrl({ url: '/hatask?tab=todo', kind: 'todo', targetId: 'record-1' }));
		expect(location.view).toBe('app');
		if (location.view !== 'app') throw new Error('Expected app');
		const path = new URL(location.path, 'https://example.test');
		expect(path.searchParams.get('hgKind')).toBe('todo');
		expect(path.searchParams.get('hgId')).toBe('record-1');
		expect(path.searchParams.get('tab')).toBe('todo');
	});

	test('preserves the issue comment anchor and existing issue route', () => {
		const location = readHatagoesLocation(hatagoesSearchResultUrl({ url: '/hatafeed/issue-1#comment-1', kind: 'comment', targetId: 'comment-1' }));
		expect(location).toMatchObject({ view: 'app', app: 'hatafeed', path: '/hatafeed/issue-1#comment-1' });
	});

	test('opens user profiles through their existing routes', () => {
		expect(hatagoesSearchResultUrl({ url: '/@test', kind: 'user', targetId: 'user-1' })).toBe('/@test');
	});
});
