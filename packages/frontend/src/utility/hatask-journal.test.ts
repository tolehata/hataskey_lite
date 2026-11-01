/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { changeJournalRows, isJournalDate, isJournalTime, isMealTemplate, journalLocalDateTime, mealTemplateFromEntry, persistJournalChange, selectJournalEntries } from './hatask-journal.js';
import type { HataskJournalEntry } from './hatask-journal.js';

const mood: HataskJournalEntry = { id: 'old-mood', date: '2026-08-31', time: '08:00', level: 4, note: '朝の散歩', customLegacyField: { keep: true } };
const meal: HataskJournalEntry = { id: 'old-meal', date: '2026-08-30', time: '12:00', level: 'little', slot: 'lunch', reasons: ['忙しくて時間がなかった'], note: 'パン' };

describe('Hatask journal storage and views', () => {
	test('追加は既存行・未知形式・順序を保持し、元配列を変更しない', () => {
		const unknown = { futureVersion: 3, payload: ['must', 'stay'] };
		const rows = Object.freeze([mood, unknown, null]);
		const added = { ...mood, id: 'new' };
		expect(changeJournalRows(rows, { type: 'save', value: added })).toEqual([added, mood, unknown, null]);
		expect(rows).toEqual([mood, unknown, null]);
	});
	test('編集は指定IDだけを更新して未知フィールドを引き継ぐ', () => {
		const next = changeJournalRows([mood, meal], { type: 'save', existingId: mood.id, value: { id: mood.id, note: '散歩できた' } });
		expect(next).toEqual([{ ...mood, note: '散歩できた' }, meal]);
		expect(mood.note).toBe('朝の散歩');
	});
	test('不明ID・重複IDを変更せず、編集でIDも差し替えない', () => {
		expect(() => changeJournalRows([mood], { type: 'delete', id: 'missing' })).toThrow();
		expect(() => changeJournalRows([mood, mood], { type: 'delete', id: mood.id })).toThrow();
		expect(() => changeJournalRows([mood], { type: 'save', value: mood })).toThrow();
		expect(() => changeJournalRows([mood], { type: 'save', value: { ...mood, id: 'changed' }, existingId: mood.id })).toThrow();
	});
	test('保存失敗時は元の配列を維持する', async () => {
		const rows = [mood, { legacy: true }];
		const write = vi.fn().mockRejectedValue(new Error('offline'));
		await expect(persistJournalChange(rows, { type: 'delete', id: mood.id }, write)).rejects.toThrow('offline');
		expect(write).toHaveBeenCalledWith([{ legacy: true }]);
		expect(rows).toEqual([mood, { legacy: true }]);
	});
	test('保存の応答を待ってから変更済み配列を返す', async () => {
		let complete!: () => void;
		const write = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
		const pending = persistJournalChange([mood], { type: 'save', value: meal }, write);
		const settled = vi.fn();
		void pending.then(settled);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
		complete();
		expect(await pending).toEqual([meal, mood]);
	});
	test('削除のUndoは元のIDと全フィールドを復元する', () => {
		const remaining = changeJournalRows([mood, meal], { type: 'delete', id: mood.id });
		expect(changeJournalRows(remaining, { type: 'save', value: mood })).toEqual([mood, meal]);
	});
	test('表示用の検索・ソートで保存データを並べ替えたり除去したりしない', () => {
		const later = { ...mood, id: 'later', time: '20:00', note: '散歩 ＡＢＣ' };
		const rows = [mood, null, later];
		expect(selectJournalEntries(rows, 'mood').map(entry => entry.id)).toEqual(['later', mood.id]);
		expect(selectJournalEntries(rows, 'mood', { oldestFirst: true }).map(entry => entry.id)).toEqual([mood.id, 'later']);
		expect(selectJournalEntries(rows, 'mood', { query: 'abc' })).toEqual([later]);
		expect(selectJournalEntries(rows, 'mood', { date: '2026-08-30' })).toEqual([]);
		expect(rows).toEqual([mood, null, later]);
	});
	test('翻訳後の理由やきもちのラベルも検索対象にする', () => {
		expect(selectJournalEntries([meal], 'meal', { query: 'busy', text: () => 'Busy' })).toEqual([meal]);
		expect(selectJournalEntries([mood], 'mood', { query: 'いい感じ', text: () => 'いい感じ' })).toEqual([mood]);
	});
	test('存在しない日付・不正時刻を拒否する', () => {
		expect(isJournalDate('2026-02-29')).toBe(false);
		expect(isJournalDate('2028-02-29')).toBe(true);
		expect(isJournalDate('2026-13-01')).toBe(false);
		expect(isJournalDate('')).toBe(false);
		expect(isJournalTime('24:00')).toBe(false);
		expect(isJournalTime('12:61')).toBe(false);
		expect(isJournalTime('00:00')).toBe(true);
	});
	test('日付と時刻をともに端末のローカル時刻で作る', () => {
		const local = new Date(2026, 7, 31, 0, 5);
		expect(journalLocalDateTime(local)).toEqual({ date: '2026-08-31', time: '00:05' });
	});
	test('テンプレートに日付・時刻・元のID・未知フィールドを持ち込まない', () => {
		const template = mealTemplateFromEntry({ ...meal, secretExtra: 'old' }, 'template-id', '  いつものお昼  ');
		expect(template).toEqual({ id: 'template-id', name: 'いつものお昼', slot: 'lunch', level: 'little', note: 'パン', reasons: ['忙しくて時間がなかった'] });
		expect(isMealTemplate(template)).toBe(true);
		expect(isMealTemplate({ ...template, level: 4 })).toBe(false);
		expect(isMealTemplate({ ...template, reasons: [null] })).toBe(false);
	});
});
