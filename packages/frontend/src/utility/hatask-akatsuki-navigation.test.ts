/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { HATASK_AKATSUKI_SHORTCUTS, isHataskAkatsukiRequiredTab, moveHataskAkatsukiMobileTab, normalizeHataskAkatsukiMobileTabs, normalizeHataskAkatsukiShortcut, replaceHataskAkatsukiMobileTab } from './hatask-akatsuki-navigation.js';
import type { HataskAkatsukiTab } from '@/components/hatask/hatask-akatsuki-types.js';

describe('暁の下部ナビゲーション設定', () => {
	test('既定はホーム・ショートカット・Hatask・Appsで、不正なショートカットはToDoになる', () => {
		expect(normalizeHataskAkatsukiMobileTabs(undefined)).toEqual(['home', 'todo', 'hataskapps', 'apps']);
		expect(normalizeHataskAkatsukiMobileTabs(undefined, 'meal')).toEqual(['home', 'meal', 'hataskapps', 'apps']);
		expect(normalizeHataskAkatsukiShortcut('games')).toBe('todo');
		expect(normalizeHataskAkatsukiShortcut('home')).toBe('todo');
		expect(normalizeHataskAkatsukiShortcut('eye')).toBe('todo');
		expect(normalizeHataskAkatsukiShortcut('ranking')).toBe('ranking');
		expect(replaceHataskAkatsukiMobileTab(['home', 'todo', 'hataskapps', 'apps'], 1, 'ranking')).toEqual(['home', 'ranking', 'hataskapps', 'apps']);
	});

	test.each([
		{ saved: ['apps', 'eye', 'home', 'hataskapps'], shortcut: 'eye', expected: ['apps', 'todo', 'home', 'hataskapps'] },
		{ saved: ['todo', 'hataskapps', 'eye', 'home'], shortcut: 'todo', expected: ['todo', 'hataskapps', 'cal', 'home'] },
		{ saved: ['eye', 'mood', 'home', 'cal'], shortcut: 'mood', expected: ['hataskapps', 'mood', 'home', 'cal'] },
		{ saved: ['home', 'eye', 'hataskapps', 'apps'], shortcut: 'meal', expected: ['home', 'meal', 'hataskapps', 'apps'] },
	])('旧EYE枠だけを利用可能な項目へ置き換え、他の順序と保存値を保つ: $saved', ({ saved, shortcut, expected }) => {
		const before = [...saved];
		Object.freeze(saved);
		const result = normalizeHataskAkatsukiMobileTabs(saved, shortcut);
		expect(result).toEqual(expected);
		expect(result).not.toContain('eye');
		expect(new Set(result).size).toBe(4);
		expect(saved).toEqual(before);
		expect(normalizeHataskAkatsukiMobileTabs(result, shortcut)).toEqual(result);
	});

	test('EYEショートカットだけが残った設定も重複のない既定表示になる', () => {
		expect(HATASK_AKATSUKI_SHORTCUTS).not.toContain('eye');
		expect(normalizeHataskAkatsukiMobileTabs(undefined, 'eye')).toEqual(['home', 'todo', 'hataskapps', 'apps']);
	});

	test.each([
		null, 'home', [], ['home'], ['home', 'todo', 'todo', 'apps'], ['cal', 'todo', 'mood', 'meal'],
		['home', 'todo', 'games', 'apps'], ['home', 'todo', 'mood', 'meal', 'apps'],
	].map(value => ({ value })))('壊れた4枠は表示用の既定へ戻すが入力を変更しない: $value', ({ value }) => {
		const before = JSON.stringify(value);
		expect(normalizeHataskAkatsukiMobileTabs(value, 'garden')).toEqual(['home', 'garden', 'hataskapps', 'apps']);
		expect(JSON.stringify(value)).toBe(before);
	});

	test('保存済みの順序とホームの位置を保ち、同じ配列を返さない', () => {
		const saved = Object.freeze(['apps', 'mood', 'home', 'hataskapps']);
		const result = normalizeHataskAkatsukiMobileTabs(saved, 'meal');
		expect(result).toEqual(saved);
		expect(result).not.toBe(saved);
	});

	test('支援情報を任意枠へ配置でき、既存の並び順や必須枠は変更しない', () => {
		const saved = Object.freeze<HataskAkatsukiTab[]>(['apps', 'mood', 'home', 'hataskapps']);
		expect(HATASK_AKATSUKI_SHORTCUTS.indexOf('support') + 1).toBe(HATASK_AKATSUKI_SHORTCUTS.indexOf('ranking'));
		expect(normalizeHataskAkatsukiShortcut('support')).toBe('support');
		expect(normalizeHataskAkatsukiMobileTabs(saved)).toEqual(saved);
		const changed = replaceHataskAkatsukiMobileTab(saved, 1, 'support');
		expect(changed).toEqual(['apps', 'support', 'home', 'hataskapps']);
		expect(normalizeHataskAkatsukiMobileTabs(changed)).toEqual(changed);
		expect(replaceHataskAkatsukiMobileTab(changed, 0, 'support')).toEqual(changed);
		expect(replaceHataskAkatsukiMobileTab(saved, 3, 'support')).toEqual(saved);
	});

	test.each([
		{ saved: ['home', 'todo', 'mood', 'apps'], expected: ['home', 'todo', 'mood', 'hataskapps'] },
		{ saved: ['apps', 'mood', 'home', 'cal'], expected: ['apps', 'mood', 'home', 'hataskapps'] },
		{ saved: ['apps', 'mood', 'cal', 'home'], expected: ['apps', 'mood', 'hataskapps', 'home'] },
	])('Hatask Appがない旧設定は末尾の非ホーム枠だけを表示用に修復する: $saved', ({ saved, expected }) => {
		const before = [...saved];
		Object.freeze(saved);
		const result = normalizeHataskAkatsukiMobileTabs(saved, 'eye');
		expect(result).toEqual(expected);
		expect(result).not.toBe(saved);
		expect(saved).toEqual(before);
		expect(normalizeHataskAkatsukiMobileTabs(result)).toEqual(result);
	});

	test('ホームとHatask Appだけを必須項目として識別する', () => {
		expect(isHataskAkatsukiRequiredTab('home')).toBe(true);
		expect(isHataskAkatsukiRequiredTab('hataskapps')).toBe(true);
		for (const id of [...HATASK_AKATSUKI_SHORTCUTS, 'apps'] as const) expect(isHataskAkatsukiRequiredTab(id)).toBe(false);
	});

	test('任意枠は未配置の項目だけへ変更でき、必須枠の置換と重複指定では交換もしない', () => {
		const current = Object.freeze<HataskAkatsukiTab[]>(['home', 'todo', 'hataskapps', 'apps']);
		expect(replaceHataskAkatsukiMobileTab(current, 1, 'cal')).toEqual(['home', 'cal', 'hataskapps', 'apps']);
		expect(replaceHataskAkatsukiMobileTab(current, 3, 'meal')).toEqual(['home', 'todo', 'hataskapps', 'meal']);
		for (const index of [0, 2]) {
			for (const replacement of ['cal', 'home', 'hataskapps', 'apps'] as const) expect(replaceHataskAkatsukiMobileTab(current, index, replacement)).toEqual(current);
		}
		for (const index of [1, 3]) {
			for (const replacement of current) expect(replaceHataskAkatsukiMobileTab(current, index, replacement)).toEqual(current);
		}
		expect(current).toEqual(['home', 'todo', 'hataskapps', 'apps']);
	});

	test.each([-1, 4, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('不正な置換index %sでは変更しない', index => {
		const current: HataskAkatsukiTab[] = ['home', 'todo', 'hataskapps', 'apps'];
		expect(replaceHataskAkatsukiMobileTab(current, index, 'cal')).toEqual(current);
	});

	test('未定義の項目は置換せず、移動済みの必須項目も保護する', () => {
		const current: HataskAkatsukiTab[] = ['todo', 'hataskapps', 'apps', 'home'];
		expect(replaceHataskAkatsukiMobileTab(current, 0, 'games' as HataskAkatsukiTab)).toEqual(current);
		expect(replaceHataskAkatsukiMobileTab(current, 1, 'cal')).toEqual(current);
		expect(replaceHataskAkatsukiMobileTab(current, 3, 'cal')).toEqual(current);
		expect(replaceHataskAkatsukiMobileTab(current, 2, 'cal')).toEqual(['todo', 'hataskapps', 'cal', 'home']);
	});

	test.each([
		{ index: 0, target: 3, expected: ['todo', 'hataskapps', 'apps', 'home'] },
		{ index: 3, target: 0, expected: ['apps', 'home', 'todo', 'hataskapps'] },
		{ index: 2, target: 0, expected: ['hataskapps', 'home', 'todo', 'apps'] },
		{ index: 1, target: 3, expected: ['home', 'hataskapps', 'apps', 'todo'] },
		{ index: 1, target: 2, expected: ['home', 'hataskapps', 'todo', 'apps'] },
	])('ドラッグ元 $index を移動先 $target へ挿入し、それ以外の相対順序を保つ', ({ index, target, expected }) => {
		const current = Object.freeze<HataskAkatsukiTab[]>(['home', 'todo', 'hataskapps', 'apps']);
		const result = moveHataskAkatsukiMobileTab(current, index, target);
		expect(result).toEqual(expected);
		expect(result[target]).toBe(current[index]);
		expect(result.filter(tab => tab !== current[index])).toEqual(current.filter(tab => tab !== current[index]));
		expect(new Set(result).size).toBe(4);
		expect(result).toContain('home');
		expect(result).toContain('hataskapps');
		expect(current).toEqual(['home', 'todo', 'hataskapps', 'apps']);
	});

	test.each([-1, 4, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('移動元・移動先の不正index %sでは変更しない', index => {
		const current: HataskAkatsukiTab[] = ['home', 'todo', 'hataskapps', 'apps'];
		expect(moveHataskAkatsukiMobileTab(current, index, 1)).toEqual(current);
		expect(moveHataskAkatsukiMobileTab(current, 1, index)).toEqual(current);
	});

	test('同じ枠への移動は順序を変えず、新しい配列を返す', () => {
		const current: HataskAkatsukiTab[] = ['home', 'todo', 'hataskapps', 'apps'];
		for (const index of [0, 1, 2, 3]) {
			const result = moveHataskAkatsukiMobileTab(current, index, index);
			expect(result).toEqual(current);
			expect(result).not.toBe(current);
		}
	});
});
