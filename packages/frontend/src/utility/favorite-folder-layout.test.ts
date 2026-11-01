/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { favoriteFolderDrop, moveFavoriteCapsule, normalizeFavoriteCapsuleOrder } from './favorite-folder-layout.js';

const folders = [
	{ id: 'read', name: '読む', parentId: null, position: 0 },
	{ id: 'life', name: '暮らし', parentId: null, position: 1 },
	{ id: 'book', name: '本', parentId: 'read', position: 0 },
	{ id: 'other', name: 'メモ', parentId: null, position: 2 },
];

describe('favorite folder drop safety', () => {
	test('root reorder and child extraction remain possible after child permission loss', () => {
		expect(favoriteFolderDrop(folders, 'read', 'life', 'after', false)).toEqual({ parentId: null, position: 1 });
		expect(favoriteFolderDrop(folders, 'book', null, 'root', false)).toEqual({ parentId: null, position: 3 });
		expect(favoriteFolderDrop(folders, 'book', 'life', 'inside', false)).toEqual({ parentId: 'life', position: 0 });
	});
	test('nesting requires permission, never creates third levels or cycles', () => {
		expect(favoriteFolderDrop(folders, 'other', 'life', 'inside', false)).toEqual({ error: 'nestedUnavailable' });
		expect(favoriteFolderDrop(folders, 'other', 'life', 'inside', true)).toEqual({ parentId: 'life', position: 0 });
		expect(favoriteFolderDrop(folders, 'read', 'life', 'inside', true)).toEqual({ error: 'maxDepth' });
		expect(favoriteFolderDrop(folders, 'other', 'book', 'inside', true)).toEqual({ error: 'maxDepth' });
		expect(favoriteFolderDrop(folders, 'read', 'book', 'before', true)).toEqual({ error: 'dropInvalid' });
	});
	test('rejects disappeared destinations and sibling name collision without touching source data', () => {
		const sample = [...folders, { id: 'memo', name: 'メモ', parentId: 'life', position: 0 }];
		const before = structuredClone(sample);
		expect(favoriteFolderDrop(sample, 'other', 'life', 'inside', true)).toEqual({ error: 'duplicateName' });
		expect(favoriteFolderDrop(sample, 'book', 'missing', 'inside', true)).toEqual({ error: 'folderUnavailable' });
		expect(sample).toEqual(before);
	});
});

describe('favorite capsule order', () => {
	test('keeps account order independently of management order and removes only deleted tabs', () => {
		const saved = ['book', 'all', 'read', 'unfiled', 'life'];
		expect(normalizeFavoriteCapsuleOrder(saved, ['life', 'read', 'book'])).toEqual(saved);
		expect(normalizeFavoriteCapsuleOrder(saved, ['life', 'new'])).toEqual(['all', 'unfiled', 'life', 'new']);
		expect(normalizeFavoriteCapsuleOrder(['all', 'all', 4, 'removed'], ['read'])).toEqual(['all', 'unfiled', 'read']);
	});
	test('move by pointer and keyboard does not mutate saved order or lose tabs', () => {
		const order = ['all', 'unfiled', 'read', 'life'];
		expect(moveFavoriteCapsule(order, 'read', -2)).toEqual(['read', 'all', 'unfiled', 'life']);
		expect(moveFavoriteCapsule(order, 'all', -1)).toEqual(order);
		expect(order).toEqual(['all', 'unfiled', 'read', 'life']);
	});
});
