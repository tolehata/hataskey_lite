/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import Reactions, { meta as reactionsMeta } from '@/server/api/endpoints/notes/reactions.js';
import FrequentlyReplied from '@/server/api/endpoints/users/get-frequently-replied-users.js';
import RevokeToken from '@/server/api/endpoints/i/revoke-token.js';
import { meta as emojiImportMeta } from '@/server/api/endpoints/admin/emoji/import-zip.js';
import { meta as queueStatsMeta } from '@/server/api/endpoints/admin/queue/stats.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- DBへ接続せず、実際のエンドポイントへ必要な依存だけを渡す。 */

function query(rows: any[]) {
	const builder: any = { getMany: vi.fn(async () => rows) };
	for (const name of ['select', 'where', 'andWhere', 'leftJoinAndSelect', 'orderBy', 'limit']) {
		builder[name] = vi.fn(() => builder);
	}
	return builder;
}

describe('notes/reactions の閲覧権限', () => {
	test.each([null, { id: 'viewer' }])('閲覧できないノートはリアクターを検索する前に拒否する: %j', async (viewer) => {
		const repository = { createQueryBuilder: vi.fn() };
		const visibility = { isVisibleForMe: vi.fn(async () => false) };
		const subject = new Reactions(repository as any, {} as any, visibility as any, {} as any, {
			getNote: async () => ({ id: 'note' }),
		} as any);
		await expect(subject.exec({ noteId: 'note' }, viewer as any, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		expect(visibility.isVisibleForMe).toHaveBeenCalledWith({ id: 'note' }, viewer?.id ?? null);
		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('公開ノートの取得は匿名でも成功し、ローカル絵文字名を検索形式に戻す', async () => {
		const rows = [{ id: 'reaction' }];
		const builder = query(rows);
		const subject = new Reactions({ createQueryBuilder: () => builder } as any,
			{ packMany: async (values: any[]) => values } as any,
			{ isVisibleForMe: async () => true } as any,
			{ makePaginationQuery: (value: any) => value } as any,
			{ getNote: async () => ({ id: 'note' }) } as any);
		expect(await subject.exec({ noteId: 'note', type: ':wave@.:' }, null, null, null)).toEqual(rows);
		expect(builder.andWhere).toHaveBeenCalledWith('reaction.reaction = :type', { type: ':wave:' });
		expect(reactionsMeta).not.toHaveProperty('allowGet');
		expect(reactionsMeta).not.toHaveProperty('cacheSec');
	});
});
describe('返信相手の集計', () => {
	async function aggregate(viewerId: string | null) {
		const source = query([{ id: 'source', userId: 'author', replyId: 'target' }]);
		const target = query([{ id: 'target', userId: 'replyuser' }]);
		const repository = { createQueryBuilder: vi.fn().mockReturnValueOnce(source).mockReturnValueOnce(target) };
		const visibility = { generateVisibilityQuery: vi.fn() };
		const subject = new FrequentlyReplied(repository as any,
			{ packMany: async (ids: string[]) => ids.map(id => ({ id })) } as any,
			visibility as any,
			{ getUser: async () => ({ id: 'author' }) } as any);
		const viewer = viewerId ? { id: viewerId } : null;
		const result = await subject.exec({ userId: 'author' }, viewer as any, null, null);
		return { result, source, target, visibility };
	}

	test('匿名でも集計を表示し、集計元と返信先の両方に可視判定をかける', async () => {
		const { result, visibility, source, target } = await aggregate(null);
		expect(result).toEqual([{ user: { id: 'replyuser' }, weight: 1 }]);
		expect(visibility.generateVisibilityQuery).toHaveBeenCalledTimes(2);
		expect(visibility.generateVisibilityQuery).toHaveBeenCalledWith(source, null);
		expect(visibility.generateVisibilityQuery).toHaveBeenCalledWith(target, null);
	});

	test('本人の集計は集計元の可視判定だけを省略する', async () => {
		const { result, visibility, target } = await aggregate('author');
		expect(result).toEqual([{ user: { id: 'replyuser' }, weight: 1 }]);
		expect(visibility.generateVisibilityQuery).toHaveBeenCalledExactlyOnceWith(target, { id: 'author' });
	});
});

describe('アクセストークン自身の失効', () => {
	function setup() {
		const tokens = [{ id: 'first', token: 'firstvalue', userId: 'owner' }, { id: 'second', token: 'secondvalue', userId: 'owner' }, { id: 'foreign', token: 'foreignvalue', userId: 'someone' }];
		const repository = {
			findOneBy: vi.fn(async (where: any) => tokens.find(token => Object.entries(where).every(([key, value]) => (token as any)[key] === value)) ?? null),
			delete: vi.fn(async () => undefined),
		};
		return { subject: new RevokeToken(repository as any), repository, current: tokens[0] as any, owner: { id: 'owner' } as any };
	}

	test('匿名要求を認証エラーにする', async () => {
		const { subject, repository } = setup();
		await expect(subject.exec({ tokenId: 'first' }, null, null, null)).rejects.toMatchObject({ code: 'CREDENTIAL_REQUIRED' });
		expect(repository.findOneBy).not.toHaveBeenCalled();
	});

	test.each([{ tokenId: 'first' }, { token: 'firstvalue' }])('第三者アプリは自身を失効できる: %j', async (params) => {
		const { subject, repository, owner, current } = setup();
		await subject.exec(params, owner, current, null);
		expect(repository.delete).toHaveBeenCalledWith({ id: 'first' });
	});

	test('同じ所有者の別トークンも第三者アプリからは失効できない', async () => {
		const { subject, repository, owner, current } = setup();
		await expect(subject.exec({ tokenId: 'second' }, owner, current, null)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
		expect(repository.delete).not.toHaveBeenCalled();
	});

	test('他人のトークンは本人のセッションからも失効できない', async () => {
		const { subject, repository, owner } = setup();
		await subject.exec({ tokenId: 'foreign' }, owner, null, null);
		expect(repository.delete).not.toHaveBeenCalled();
	});

	test('本人のセッションは自身の別トークンを失効できる', async () => {
		const { subject, repository, owner } = setup();
		await subject.exec({ tokenId: 'second' }, owner, null, null);
		expect(repository.delete).toHaveBeenCalledWith({ id: 'second' });
	});
});

test('絵文字ZIPは管理者・本人セッション限定で、キュー参照には読み取り権限を使う', () => {
	for (const key of ['requireCredential', 'requireAdmin', 'secure'] as const) expect(emojiImportMeta[key]).toBe(true);
	expect(emojiImportMeta.kind).toBe('write:admin:emoji');
	expect(queueStatsMeta.kind).toBe('read:admin:queue');
});
