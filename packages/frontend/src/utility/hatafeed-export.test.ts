/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _hatafeed: { _exportRange: { numberAtLeastOne: '番号は1以上', numberOrder: '番号の範囲', dateOrder: '日付の範囲' } } } } } }));
import { downloadHataFeedJson, localDayEndIso, localDayStartIso, validateHataFeedExportRange } from './hatafeed-export.js';

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('HataFeed export helpers', () => {
	test('番号と日付の逆転を拒否する', () => {
		expect(validateHataFeedExportRange({ numberFrom: 0, numberTo: null, createdFrom: '', createdTo: '' })).not.toBeNull();
		expect(validateHataFeedExportRange({ numberFrom: 20, numberTo: 10, createdFrom: '', createdTo: '' })).not.toBeNull();
		expect(validateHataFeedExportRange({ numberFrom: null, numberTo: null, createdFrom: '2026-08-05', createdTo: '2026-08-04' })).not.toBeNull();
	});

	test('未指定または正しい範囲を受け入れる', () => {
		expect(validateHataFeedExportRange({ numberFrom: null, numberTo: null, createdFrom: '', createdTo: '' })).toBeNull();
		expect(validateHataFeedExportRange({ numberFrom: 10, numberTo: 10, createdFrom: '2026-08-05', createdTo: '2026-08-05' })).toBeNull();
	});

	test('指定日をローカル日の始端と終端へ変換する', () => {
		const start = localDayStartIso('2026-08-05');
		const end = localDayEndIso('2026-08-05');
		expect(start).toBeTruthy();
		expect(end).toBeTruthy();
		expect(new Date(end!).getTime() - new Date(start!).getTime()).toBe(86_399_999);
	});

	test('保存処理が始まる前にObject URLを破棄しない', () => {
		vi.useFakeTimers();
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL: vi.fn(() => 'blob:hatafeed-export'),
			revokeObjectURL,
		});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

		downloadHataFeedJson({ issues: [] }, 'issues.json');
		expect(revokeObjectURL).not.toHaveBeenCalled();
		vi.advanceTimersByTime(29_999);
		expect(revokeObjectURL).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:hatafeed-export');
		expect(window.document.querySelector('a[download="issues.json"]')).toBeNull();
	});
});
