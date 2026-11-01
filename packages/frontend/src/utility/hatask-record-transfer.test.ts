/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { acquireHataskRecordOperation, finishHataskRecordImport, importHataskRecords, markHataskRecordViewsUnsafe, parseHataskRecordsFile, refreshHataskRecordViews, registerHataskRecordSync, waitForHataskRecordWrites } from './hatask-record-transfer.js';
import { misskeyApi } from '@/utility/misskey-api.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));

describe('Hatask record transfer', () => {
	test('accepts only the dedicated export envelope before sending it', () => {
		const data = { moods: [], meals: [], flowers: [] };
		expect(parseHataskRecordsFile(JSON.stringify({ format: 'hatask-records-export', version: 1, exportedAt: '2026-10-08T00:00:00Z', data })).data).toEqual(data);
		expect(() => parseHataskRecordsFile(JSON.stringify({ format: 'hatask-planner-export', version: 1, exportedAt: '', data }))).toThrow();
		expect(() => parseHataskRecordsFile(JSON.stringify({ format: 'hatask-records-export', version: 2, exportedAt: '', data }))).toThrow();
	});
	test('waits for each live Hatask view and releases its write guard', async () => {
		const calls: string[] = [];
		const unregister = registerHataskRecordSync({
			beforeImport: async () => { calls.push('before'); },
			markUnsafe: () => { calls.push('unsafe'); },
			afterImport: async () => { calls.push('after'); },
			finish: () => { calls.push('finish'); },
		});
		const token = acquireHataskRecordOperation();
		expect(token).not.toBeNull();
		try {
			await waitForHataskRecordWrites(token!);
			markHataskRecordViewsUnsafe(token!);
			await refreshHataskRecordViews(token!);
			finishHataskRecordImport(token!);
			expect(calls).toEqual(['before', 'unsafe', 'after', 'finish']);
		} finally { unregister(); }
	});
	test('refreshes every view even if one read fails', async () => {
		const calls: string[] = [];
		const first = registerHataskRecordSync({ beforeImport: async () => {}, markUnsafe: () => {}, afterImport: async () => { calls.push('first'); throw new Error('offline'); }, finish: () => {} });
		const second = registerHataskRecordSync({ beforeImport: async () => {}, markUnsafe: () => {}, afterImport: async () => { calls.push('second'); }, finish: () => {} });
		const token = acquireHataskRecordOperation();
		expect(token).not.toBeNull();
		try {
			await expect(refreshHataskRecordViews(token!)).rejects.toThrow('offline');
			expect(calls).toEqual(['first', 'second']);
		} finally { finishHataskRecordImport(token!); first(); second(); }
	});
	test('a second settings window cannot release another operation', () => {
		const owner = acquireHataskRecordOperation();
		expect(owner).not.toBeNull();
		try {
			expect(acquireHataskRecordOperation()).toBeNull();
			expect(() => finishHataskRecordImport(Symbol('other'))).toThrow();
			expect(acquireHataskRecordOperation()).toBeNull();
		} finally { finishHataskRecordImport(owner!); }
		const next = acquireHataskRecordOperation();
		expect(next).not.toBeNull();
		try { expect(acquireHataskRecordOperation()).toBeNull(); } finally { finishHataskRecordImport(next!); }
	});
	test('aborts an import whose result remains unknown after the timeout', async () => {
		vi.useFakeTimers();
		vi.mocked(misskeyApi).mockImplementationOnce((_endpoint, _params, _token, signal) => new Promise((_resolve, reject) => {
			signal?.addEventListener('abort', () => reject(new Error('aborted')));
		}) as never);
		try {
			const file = parseHataskRecordsFile(JSON.stringify({ format: 'hatask-records-export', version: 1, exportedAt: '2026-10-08T00:00:00Z', data: { moods: [], meals: [], flowers: [] } }));
			const request = importHataskRecords(file);
			const result = expect(request).rejects.toThrow('aborted');
			await vi.advanceTimersByTimeAsync(90000);
			await result;
		} finally { vi.useRealTimers(); }
	});
});
