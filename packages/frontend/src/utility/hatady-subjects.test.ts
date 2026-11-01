/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { misskeyApi } from '@/utility/misskey-api.js';
import { setHySubjectColorOverrides } from '@/utility/hatady.js';
import { hySubjects, hySubjectsLoaded, loadHySubjects, saveHySubject } from '@/utility/hatady-subjects.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/hatady.js', () => ({ setHySubjectColorOverrides: vi.fn() }));

describe('subject palette reads', () => {
	beforeEach(() => { vi.resetAllMocks(); hySubjects.value = []; hySubjectsLoaded.value = false; });

	test('a failed refresh keeps the saved list and its colors', async () => {
		const saved = [{ name: 'デザイン', color: '#33765d', logCount: 8 }];
		vi.mocked(misskeyApi).mockResolvedValueOnce(saved).mockRejectedValueOnce(new Error('offline'));
		await loadHySubjects();
		expect(setHySubjectColorOverrides).toHaveBeenLastCalledWith({ デザイン: '#33765d' });
		await expect(loadHySubjects()).rejects.toThrow('offline');
		expect(hySubjects.value).toEqual(saved);
		expect(hySubjectsLoaded.value).toBe(true);
		expect(setHySubjectColorOverrides).toHaveBeenCalledTimes(1);
	});

	test('rejects a malformed response, but accepts a real empty list', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce([]);
		await expect(loadHySubjects()).rejects.toThrow('HATADY_SUBJECTS_INVALID_RESPONSE');
		expect(hySubjectsLoaded.value).toBe(false);
		expect(setHySubjectColorOverrides).not.toHaveBeenCalled();
		await expect(loadHySubjects()).resolves.toEqual([]);
		expect(setHySubjectColorOverrides).toHaveBeenCalledWith({});
	});

	test('omits an unspecified color but keeps an explicit reset', async () => {
		vi.mocked(misskeyApi).mockResolvedValue([{ name: '数学', color: '#abc', logCount: 1 }]);
		await saveHySubject('数学');
		expect(misskeyApi).toHaveBeenCalledWith('hata/hatady/subjects/save', { name: '数学', color: undefined });
		await saveHySubject('数学', null);
		expect(misskeyApi).toHaveBeenCalledWith('hata/hatady/subjects/save', { name: '数学', color: null });
	});
});
