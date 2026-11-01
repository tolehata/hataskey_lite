/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomInt } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UtageService } from '@/core/UtageService.js';
import { MiUtageSession } from '@/models/UtageSession.js';
import { MiNoteReaction } from '@/models/NoteReaction.js';
import { MiNote } from '@/models/Note.js';
import { MiUser } from '@/models/User.js';
import { drawRevival, revivalTargetRange, utageSnapshot } from '@/misc/utage-revival.js';

vi.mock('node:crypto', async original => ({ ...await original<object>(), randomInt: vi.fn((min: number, max?: number) => max == null ? 0 : min) }));
const origin = new Date('2026-09-22T00:00:00Z');
const note = (extra = {}) => ({ id: 'note', userId: 'author', userHost: null, text: '宴', cw: null, visibility: 'public', channelId: null, ...extra }) as MiNote;
const user = (id: string, extra = {}) => ({ id, host: null, isBot: false, isSuspended: false, isDeleted: false, ...extra }) as MiUser;

function fixture() {
	const db = { now: new Date(+origin + 1000), session: null as MiUtageSession | null, note: note(), online: 20, users: new Map<string, MiUser>(), reactions: new Map<string, MiNoteReaction>() };
	let sequence = 0;
	let tail: Promise<unknown> = Promise.resolve();
	const manager: any = {
		query: vi.fn(async () => [{ now: db.now }]),
		create: (_type: unknown, value: unknown) => value,
		findOne: vi.fn(async () => db.session),
		findOneBy: vi.fn(async (type: unknown, where: { id: string }) => type === MiNote ? db.note : db.users.get(where.id)),
		find: vi.fn(async () => [...db.reactions.values()]),
		insert: vi.fn(async (type: unknown, value: any) => {
			if (type === MiUtageSession) { db.session = value; return; }
			if ([...db.reactions.values()].some(r => r.userId === value.userId)) throw new Error('duplicate reaction');
			db.reactions.set(value.id, value);
		}),
		delete: vi.fn(async (_type: unknown, id: string) => ({ affected: db.reactions.delete(id) ? 1 : 0 })),
		save: vi.fn(async (_type: unknown, session: MiUtageSession) => { db.session = session; return session; }),
		createQueryBuilder: () => {
			const q: any = { where: () => q, andWhere: () => q, getCount: async () => db.online }; return q;
		},
		transaction: (fn: (m: unknown) => Promise<unknown>) => {
			const run = tail.then(async () => {
				const backup = structuredClone({ session: db.session, reactions: db.reactions });
				try { return await fn(manager); } catch (e) { Object.assign(db, backup); throw e; }
			});
			tail = run.catch(() => {}); return run;
		},
	};
	const repo = { manager, createQueryBuilder: () => {
		let update: any, predicate = '';
		const q: any = { update: () => q, set: (value: unknown) => { update = value; return q; },
																			where: (value: string) => { predicate = value; return q; }, orderBy: () => q, take: () => q,
																			execute: async () => { if (db.session && update.publishedRevision > db.session.publishedRevision) Object.assign(db.session, update); },
																			getMany: async () => !db.session ? [] : predicate.includes('expiresAt')
																				? ((db.session.status === 'running' && db.session.expiresAt <= db.now) || (db.session.status === 'reviving' && db.session.revivalExpiresAt! <= db.now) ? [db.session] : [])
																				: db.session.publishedRevision < db.session.revision ? [db.session] : [],
		}; return q;
	} };
	const queue = { createUtageResolveJob: vi.fn().mockResolvedValue(undefined) };
	const events = { publishNoteStream: vi.fn().mockResolvedValue(1) };
	const achievements = { reconcileUtageAchievements: vi.fn().mockResolvedValue(undefined) };
	const sut = new UtageService(repo as never, { gen: () => `session-${++sequence}`, parse: () => ({ date: origin }) } as never, queue as never, events as never, achievements as never, { manager } as never);

	async function start(extra = {}) {
		db.note = note(extra);
		await sut.onNoteSaved(manager, db.note, user('author'));
	}

	async function react(id: string, extra = {}) {
		const actor = user(id, extra); db.users.set(id, actor);
		const reaction = { id: `reaction-${++sequence}`, noteId: 'note', userId: id, reaction: '👏' } as MiNoteReaction;
		await sut.saveReaction(db.note, actor, reaction); return reaction;
	}

	return { db, manager, sut, queue, events, achievements, start, react };
}

afterEach(() => { vi.restoreAllMocks(); vi.mocked(randomInt).mockImplementation(((min: number, max?: number) => max == null ? 0 : min) as typeof randomInt); });

describe('宴の作成と復活ルール', () => {
	test.each([{ visibility: 'home' }, { visibility: 'followers' }, { channelId: 'channel' }, { cw: '' }, { text: '普通' }, { text: '$[scale.x=0 宴]' }])('見えない宴は作成しない: %j', async extra => {
		const f = fixture(); await f.start(extra); expect(f.db.session).toBeNull();
	});
	test('投稿と同じトランザクションで期限とルールを保存する', async () => {
		const f = fixture(); await f.start(); expect(f.db.session).toMatchObject({ status: 'running', ruleVersion: 1, expiresAt: new Date(+origin + 900000) });
		expect(f.events.publishNoteStream).not.toHaveBeenCalled();
	});
	test('20%の境界とランダム時間・目標の両端', async () => {
		for (const [roll, state] of [[1999, 'reviving'], [2000, 'failed']] as const) {
			const f = fixture(); await f.start(); vi.mocked(randomInt).mockImplementationOnce(() => roll); await f.react('blocker'); expect(f.db.session?.status).toBe(state);
		}
		expect(drawRevival(20, ((min: number) => min) as typeof randomInt)).toEqual({ seconds: 30, target: 2 });
		expect(drawRevival(20, ((_min: number, max: number) => max - 1) as typeof randomInt)).toEqual({ seconds: 120, target: 6 });
	});
	test('オンライン人数の上限・下限、少人数では発動しない', async () => {
		expect(revivalTargetRange(1)).toBeNull(); expect(revivalTargetRange(2)).toEqual([2, 2]); expect(revivalTargetRange(1000)).toEqual([20, 20]);
		const f = fixture(); await f.start(); f.db.online = 1; await f.react('blocker'); expect(f.db.session?.status).toBe('failed');
	});
	test('旧セッションと自己反応を抽選に使わない', async () => {
		for (const legacy of [true, false]) {
			const f = fixture(); await f.start(); if (legacy) f.db.session!.ruleVersion = 0;
			await f.react(legacy ? 'blocker' : 'author'); expect(f.db.session?.status).toBe('failed');
		}
	});
});

describe('応援の受理と不可逆な確定', () => {
	test('原因の反応と開始前の人を除外し、取り消しや再追加でも重複しない', async () => {
		const f = fixture(); await f.start(); const blocker = await f.react('blocker');
		expect(f.db.session).toMatchObject({ status: 'reviving', revivalSupporterIds: [], revivalExcludedUserIds: ['blocker'] });
		await f.sut.removeReaction(f.db.note, blocker.id); await f.react('blocker'); expect(f.db.session!.revivalSupporterIds).toEqual([]);
		const support = await f.react('helper'); await f.sut.removeReaction(f.db.note, support.id); await f.react('helper');
		expect(f.db.session!.revivalSupporterIds).toEqual(['helper']); expect(f.db.session!.status).toBe('reviving');
	});
	test.each([{ host: 'remote.example' }, { isBot: true }, { isSuspended: true }, { isDeleted: true }])('対象外アカウントのリアクションは保存するが加算しない: %j', async extra => {
		const f = fixture(); await f.start(); await f.react('blocker'); await f.react('excluded', extra);
		expect(f.db.reactions.size).toBe(2); expect(f.db.session!.revivalSupporterIds).toEqual([]);
	});
	test('重複挿入は受理までロールバックする', async () => {
		const f = fixture(); await f.start(); await f.react('blocker'); await f.react('helper'); const revision = f.db.session!.revision;
		await expect(f.react('helper')).rejects.toThrow('duplicate'); expect(f.db.session!.revision).toBe(revision); expect(f.db.session!.revivalSupporterIds).toEqual(['helper']);
	});
	test('同時加算でも目標で一度だけ成功し、成功後の取り消しで覆らない', async () => {
		const f = fixture(); await f.start(); await f.react('blocker');
		await Promise.all([f.react('helper-a'), f.react('helper-b'), f.react('helper-c')]);
		expect(f.db.session).toMatchObject({ status: 'succeeded', successMethod: 'revival' }); expect(f.db.session!.revivalSupporterIds).toHaveLength(2);
		await f.sut.removeReaction(f.db.note, [...f.db.reactions.values()][1].id);
		expect(f.db.session!.status).toBe('succeeded'); expect(f.achievements.reconcileUtageAchievements).toHaveBeenCalledWith('author', 'success');
		expect(f.achievements.reconcileUtageAchievements).not.toHaveBeenCalledWith('blocker', 'interruption');
	});
	test('返信・引用で開始できるが、復活中の返信は加算も再失敗もしない', async () => {
		const f = fixture(); await f.start(); const child = note({ id: 'reply', text: '見つけた' });
		await f.sut.onNoteSaved(f.manager, child, user('blocker'), [{ note: f.db.note, kind: 'reply' }]);
		expect(f.db.session!.status).toBe('reviving'); const revision = f.db.session!.revision;
		await f.sut.onNoteSaved(f.manager, child, user('helper'), [{ note: f.db.note, kind: 'renote' }]); expect(f.db.session!.revision).toBe(revision);
	});
	test('元の15分ジョブは復活を成功にしない', async () => {
		const f = fixture(); await f.start(); f.db.now = new Date(+origin + 899000); await f.react('blocker'); f.db.now = new Date(+origin + 900000);
		await f.sut.resolveExpired('note'); expect(f.db.session!.status).toBe('reviving');
	});
	test.each([-1, 0])('復活期限との境界 %d ms', async delta => {
		const f = fixture(); await f.start(); await f.react('blocker'); await f.react('helper-a'); f.db.now = new Date(+f.db.session!.revivalExpiresAt! + delta); await f.react('helper-b');
		expect(f.db.session!.status).toBe(delta < 0 ? 'succeeded' : 'failed');
	});
	test('通常期限到達時は成功、確定後の反応では覆さない', async () => {
		const f = fixture(); await f.start(); f.db.now = new Date(+origin + 900000); await f.sut.resolveExpired('note'); await f.react('helper');
		expect(f.db.session).toMatchObject({ status: 'succeeded', successMethod: 'normal' });
	});
	test('隠蔽と復元で再開しない。復活失敗時だけ最初の阻止者へ記録', async () => {
		const f = fixture(); await f.start(); await f.react('blocker');
		const concealed = note({ cw: '' }); const changed = await f.sut.onNoteUpdatedInTransaction(f.manager, f.db.note, concealed, f.db.session);
		await f.sut.afterCommit([changed!]); await f.sut.onNoteUpdatedInTransaction(f.manager, concealed, f.db.note, f.db.session);
		expect(f.db.session!.status).toBe('failed'); expect(f.db.session!.interruptedWithin5Seconds).toBe(true);
		expect(f.achievements.reconcileUtageAchievements).toHaveBeenCalledWith('blocker', 'interruption');
	});
});

describe('再起動・配信・プライバシー', () => {
	test('副作用失敗は確定済み反応をエラーに戻さず、回復処理で再試行する', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const f = fixture(); await f.start(); f.queue.createUtageResolveJob.mockRejectedValueOnce(new Error('queue unavailable')); await f.react('blocker');
		expect(f.db.session!.publishedRevision).toBe(0); await f.sut.recover(); expect(f.db.session!.publishedRevision).toBe(f.db.session!.revision);
	});
	test('欠落した復活期限ジョブを永続期限から回復する', async () => {
		const f = fixture(); await f.start(); await f.react('blocker'); f.db.now = f.db.session!.revivalExpiresAt!;
		await f.sut.recover(); expect(f.db.session!.status).toBe('failed');
	});
	test('公開スナップショットに参加者ID・除外集合・本人情報を出さない', async () => {
		const f = fixture(); await f.start(); await f.react('blocker'); await f.react('helper');
		const snapshot = utageSnapshot(f.db.session!); expect(snapshot.utageRevival).toMatchObject({ reactionCount: 1, targetCount: 2 });
		expect(JSON.stringify(snapshot)).not.toMatch(/blocker|helper|Excluded|Supporter|MyParticipation/);
		expect(f.events.publishNoteStream.mock.calls.at(-1)?.[2]).toMatchObject({ ...snapshot, utageServerNow: expect.any(String) });
	});
});
