/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	TIMELINE_COLLAPSE_CLAIM_SCRIPT,
	TIMELINE_COLLAPSE_ACTIVE_MS,
	TIMELINE_COLLAPSE_DAILY_LIMIT,
	TimelineCollapseService,
} from '@/core/TimelineCollapseService.js';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../../src');

function createService(evalResult: number | Error = 1) {
	const evalMock = evalResult instanceof Error
		? vi.fn().mockRejectedValue(evalResult)
		: vi.fn().mockResolvedValue(evalResult);
	const redisClient = { eval: evalMock };
	const globalEventService = { publishBroadcastStream: vi.fn() };
	const sut = new TimelineCollapseService(redisClient as never, globalEventService as never);
	return { sut, evalMock, globalEventService };
}

const localUser = { id: 'user-a', host: null } as const;
const triggerNote = { text: 'TL崩れる', visibility: 'public', channelId: null } as const;

afterEach(() => {
	vi.useRealTimers();
});

describe('タイムライン崩壊演出のサーバー側判定', () => {
	test.each([1, 2])('当日%j回目の公開ローカル投稿はpayloadなしで同サーバーへ配信する', async (count) => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-04T12:34:56.000Z'));
		const { sut, evalMock, globalEventService } = createService(count);

		await expect(sut.onNoteCreated(triggerNote as never, localUser as never)).resolves.toBe(true);

		expect(evalMock).toHaveBeenCalledTimes(1);
		const args = evalMock.mock.calls[0];
		expect(args[1]).toBe(2);
		expect(args[2]).toBe('hata:timeline-collapse:active');
		expect(args[3]).toBe('hata:timeline-collapse:2026-09-04:user-a');
		expect(args[4]).toBe(TIMELINE_COLLAPSE_DAILY_LIMIT);
		expect(args[6]).toBe(TIMELINE_COLLAPSE_ACTIVE_MS);
		expect(globalEventService.publishBroadcastStream).toHaveBeenCalledWith('hataTimelineCollapse', {});
	});

	test.each([0, -1])('上限到達または演出中(%j)は配信しない', async (claimResult) => {
		const { sut, globalEventService } = createService(claimResult);

		await expect(sut.onNoteCreated(triggerNote as never, localUser as never)).resolves.toBe(false);

		expect(globalEventService.publishBroadcastStream).not.toHaveBeenCalled();
	});

	test.each([
		['別の本文', { ...triggerNote, text: 'TL崩れる！' }, localUser],
		['前後空白つき', { ...triggerNote, text: ' TL崩れる ' }, localUser],
		['home投稿', { ...triggerNote, visibility: 'home' }, localUser],
		['チャンネル投稿', { ...triggerNote, channelId: 'channel-a' }, localUser],
		['リモート投稿', triggerNote, { id: 'user-b', host: 'remote.example' }],
	])('%sは回数判定もしない', async (_label, note, user) => {
		const { sut, evalMock, globalEventService } = createService();

		await expect(sut.onNoteCreated(note as never, user as never)).resolves.toBe(false);

		expect(evalMock).not.toHaveBeenCalled();
		expect(globalEventService.publishBroadcastStream).not.toHaveBeenCalled();
	});

	test('日次キーはクライアント時刻でなくサーバーのUTC日付で切り替わる', async () => {
		vi.useFakeTimers();
		const { sut, evalMock } = createService();

		vi.setSystemTime(new Date('2026-09-04T23:59:59.999Z'));
		await sut.onNoteCreated(triggerNote as never, localUser as never);
		vi.setSystemTime(new Date('2026-09-05T00:00:00.000Z'));
		await sut.onNoteCreated(triggerNote as never, localUser as never);

		expect(evalMock.mock.calls[0][3]).toBe('hata:timeline-collapse:2026-09-04:user-a');
		expect(evalMock.mock.calls[1][3]).toBe('hata:timeline-collapse:2026-09-05:user-a');
	});

	test('演出中判定はカウンター加算より先にLua内で評価される', () => {
		expect(TIMELINE_COLLAPSE_CLAIM_SCRIPT.indexOf('redis.call(\'EXISTS\', KEYS[1])')).toBeGreaterThanOrEqual(0);
		expect(TIMELINE_COLLAPSE_CLAIM_SCRIPT.indexOf('redis.call(\'EXISTS\', KEYS[1])')).toBeLessThan(TIMELINE_COLLAPSE_CLAIM_SCRIPT.indexOf('redis.call(\'INCR\', KEYS[2])'));
		expect(TIMELINE_COLLAPSE_CLAIM_SCRIPT).toContain('redis.call(\'PSETEX\', KEYS[1]');
	});

	test('Redis障害はサービスから通知し、投稿側では握って投稿成立を維持する', async () => {
		const failure = new Error('redis unavailable');
		const { sut } = createService(failure);
		await expect(sut.onNoteCreated(triggerNote as never, localUser as never)).rejects.toThrow('redis unavailable');

		const noteCreateSource = readFileSync(join(srcDir, 'core/NoteCreateService.ts'), 'utf8');
		expect(noteCreateSource).toContain('this.timelineCollapseService.onNoteCreated(note, user).catch(() =>');

		const coreModuleSource = readFileSync(join(srcDir, 'core/CoreModule.ts'), 'utf8');
		expect(coreModuleSource).toContain('import { TimelineCollapseService } from \'./TimelineCollapseService.js\';');
		expect(coreModuleSource).toMatch(/providers:\s*\[[\s\S]*?TimelineCollapseService,/);
	});
});
