/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import LogReactionListEndpoint from '@/server/api/endpoints/hata/hatady/reactions/list.js';
import MediaReactionListEndpoint from '@/server/api/endpoints/hata/hatady/media/reactions/list.js';

// 依存先の読み込みで使われるだけで、このテストでは正規表現処理を行わない。
vi.mock('re2', () => ({ default: RegExp }));

const viewer = { id: 'viewer' } as never;
const appToken = { permission: ['read:account'] } as never;
const moderatorFlashToken = { permissions: ['read:account'], user: viewer } as never;

function queryWith(rows: Array<{ id: string; createdAt: Date; reaction: string; userId: string }> = []) {
	const query = {
		where: vi.fn(),
		andWhere: vi.fn(),
		orderBy: vi.fn(),
		take: vi.fn(),
		getMany: vi.fn().mockResolvedValue(rows),
	};
	query.where.mockReturnValue(query);
	query.andWhere.mockReturnValue(query);
	query.orderBy.mockReturnValue(query);
	query.take.mockReturnValue(query);
	return query;
}

describe('Hatady reaction list API', () => {
	test.each(['log', 'comment'] as const)('%s reactions use the log visibility policy for Flash and native moderator sessions', async targetType => {
		const log = { id: 'log', userId: 'owner', visibility: 'private' };
		const logs = Object.setPrototypeOf({
			getLog: vi.fn().mockResolvedValue(log),
			canModerate: vi.fn().mockResolvedValue(true),
			isBlockedEitherDirection: vi.fn().mockResolvedValue(false),
			isFollowing: vi.fn().mockResolvedValue(false),
		}, HatadyService.prototype);
		const comments = { findOneBy: vi.fn().mockResolvedValue({ id: 'comment', logId: 'log' }) };
		const reactions = { createQueryBuilder: vi.fn().mockImplementation(() => queryWith()) };
		const endpoint = new LogReactionListEndpoint(comments as never, reactions as never, logs as never, { packMany: vi.fn().mockResolvedValue([]) } as never);
		const params = targetType === 'log' ? { logId: 'log' } : { commentId: 'comment' };

		await expect(endpoint.exec(params, viewer, null, moderatorFlashToken)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_REACTION_TARGET' });
		await expect(endpoint.exec(params, viewer, appToken, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_REACTION_TARGET' });
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
		expect(logs.canModerate).not.toHaveBeenCalled();

		await expect(endpoint.exec(params, viewer, null, null)).resolves.toEqual([]);
		expect(logs.canModerate).toHaveBeenCalledOnce();
		expect(reactions.createQueryBuilder).toHaveBeenCalledOnce();

		log.visibility = 'public';
		await expect(endpoint.exec(params, viewer, null, moderatorFlashToken)).resolves.toEqual([]);
		expect(logs.canModerate).toHaveBeenCalledOnce();
		expect(reactions.createQueryBuilder).toHaveBeenCalledTimes(2);
	});

	test('log/comment target is exclusive and a missing comment never queries reactions', async () => {
		const query = queryWith();
		const comments = { findOneBy: vi.fn().mockResolvedValue(null) };
		const reactions = { createQueryBuilder: vi.fn().mockReturnValue(query) };
		const logs = { getLog: vi.fn(), canViewLog: vi.fn() };
		const endpoint = new LogReactionListEndpoint(comments as never, reactions as never, logs as never, { packMany: vi.fn() } as never);
		await expect(endpoint.exec({}, viewer, null, null)).rejects.toMatchObject({ code: 'INVALID_TARGET' });
		await expect(endpoint.exec({ logId: 'log', commentId: 'comment' }, viewer, null, null)).rejects.toMatchObject({ code: 'INVALID_TARGET' });
		await expect(endpoint.exec({ commentId: 'missing' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_REACTION_TARGET' });
		expect(logs.getLog).not.toHaveBeenCalled();
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('private parent denies app-token staff and permits staff session only', async () => {
		const reactions = { createQueryBuilder: vi.fn().mockReturnValue(queryWith()) };
		const logs = {
			getLog: vi.fn().mockResolvedValue({ id: 'log', userId: 'owner' }),
			canViewLog: vi.fn().mockImplementation(async (_log, _viewer, staffAccess) => staffAccess),
		};
		const endpoint = new LogReactionListEndpoint({ findOneBy: vi.fn() } as never, reactions as never, logs as never, { packMany: vi.fn().mockResolvedValue([]) } as never);
		await expect(endpoint.exec({ logId: 'log' }, viewer, appToken, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_REACTION_TARGET' });
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
		await endpoint.exec({ logId: 'log' }, viewer, null, null);
		expect(logs.canViewLog).toHaveBeenNthCalledWith(1, { id: 'log', userId: 'owner' }, 'viewer', false);
		expect(logs.canViewLog).toHaveBeenNthCalledWith(2, { id: 'log', userId: 'owner' }, 'viewer', true);
	});

	test('comment parent is resolved, and reaction/cursor/limit use reaction ID order', async () => {
		const query = queryWith([{ id: 'reaction3', createdAt: new Date('2026-09-30T00:00:00Z'), reaction: '👍', userId: 'author' }]);
		const logs = { getLog: vi.fn().mockResolvedValue({ id: 'log' }), canViewLog: vi.fn().mockResolvedValue(true) };
		const users = { packMany: vi.fn().mockResolvedValue([{ id: 'author', username: 'author' }]) };
		const endpoint = new LogReactionListEndpoint({ findOneBy: vi.fn().mockResolvedValue({ id: 'comment', logId: 'log' }) } as never, { createQueryBuilder: vi.fn().mockReturnValue(query) } as never, logs as never, users as never);
		const result = await endpoint.exec({ commentId: 'comment', reaction: '👍', untilId: 'reaction4', limit: 3 }, viewer, null, null);
		expect(logs.getLog).toHaveBeenCalledWith('log');
		expect(query.where).toHaveBeenCalledWith('reaction.commentId = :targetId', { targetId: 'comment' });
		expect(query.andWhere).toHaveBeenCalledWith('reaction.reaction = :reaction', { reaction: '👍' });
		expect(query.andWhere).toHaveBeenCalledWith('reaction.id < :untilId', { untilId: 'reaction4' });
		expect(query.orderBy).toHaveBeenCalledWith('reaction.id', 'DESC');
		expect(query.take).toHaveBeenCalledWith(3);
		expect(result).toEqual([{ id: 'reaction3', createdAt: '2026-09-30T00:00:00.000Z', reaction: '👍', user: { id: 'author', username: 'author' } }]);
		await expect(endpoint.exec({ commentId: 'comment', limit: 101 }, viewer, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});
});

describe('Hatady media reaction list API', () => {
	test.each([
		['work', 'work'],
		['session', 'session'],
		['comment', 'work'],
		['comment', 'session'],
	] as const)('%s reactions with a %s parent use the media visibility policy for Flash and native moderator sessions', async (targetType, parentType) => {
		const parent = { id: parentType, userId: 'owner', visibility: 'private' };
		const hatadyService = {
			canModerate: vi.fn().mockResolvedValue(true),
			isBlockedEitherDirection: vi.fn().mockResolvedValue(false),
		};
		const media = Object.assign(Object.create(HatadyMediaService.prototype), {
			worksRepository: { findOneBy: vi.fn().mockResolvedValue(parentType === 'work' ? parent : null) },
			sessionsRepository: { findOneBy: vi.fn().mockResolvedValue(parentType === 'session' ? parent : null) },
			hatadyService,
			hatadyFollowingsRepository: { existsBy: vi.fn().mockResolvedValue(false) },
		});
		const comments = { findOneBy: vi.fn().mockResolvedValue({ id: 'comment', workId: parentType === 'work' ? 'work' : null, sessionId: parentType === 'session' ? 'session' : null }) };
		const reactions = { createQueryBuilder: vi.fn().mockImplementation(() => queryWith()) };
		const endpoint = new MediaReactionListEndpoint(comments as never, reactions as never, media as never, { packMany: vi.fn().mockResolvedValue([]) } as never);
		const params = { targetType, targetId: targetType === 'comment' ? 'comment' : parentType };

		await expect(endpoint.exec(params, viewer, null, moderatorFlashToken)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_MEDIA' });
		await expect(endpoint.exec(params, viewer, appToken, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_MEDIA' });
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
		expect(hatadyService.canModerate).not.toHaveBeenCalled();

		await expect(endpoint.exec(params, viewer, null, null)).resolves.toEqual([]);
		expect(hatadyService.canModerate).toHaveBeenCalledOnce();
		expect(reactions.createQueryBuilder).toHaveBeenCalledOnce();

		parent.visibility = 'public';
		await expect(endpoint.exec(params, viewer, null, moderatorFlashToken)).resolves.toEqual([]);
		expect(hatadyService.canModerate).toHaveBeenCalledOnce();
		expect(reactions.createQueryBuilder).toHaveBeenCalledTimes(2);
	});

	test('work privacy denies an app token before querying reactions', async () => {
		const reactions = { createQueryBuilder: vi.fn() };
		const media = { getVisibleWork: vi.fn().mockRejectedValue(new Error(HatadyMediaService.ERR_NOT_FOUND)) };
		const endpoint = new MediaReactionListEndpoint({ findOneBy: vi.fn() } as never, reactions as never, media as never, { packMany: vi.fn() } as never);
		await expect(endpoint.exec({ targetType: 'work', targetId: 'privatework' }, viewer, appToken, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_MEDIA' });
		expect(media.getVisibleWork).toHaveBeenCalledWith('privatework', 'viewer', false);
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('comment requires a visible parent, including sessions without a work', async () => {
		const reactions = { createQueryBuilder: vi.fn().mockReturnValue(queryWith()) };
		const media = { getVisibleWork: vi.fn(), getVisibleSession: vi.fn().mockResolvedValue({ id: 'session' }) };
		const comments = { findOneBy: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'comment', workId: null, sessionId: 'session' }) };
		const endpoint = new MediaReactionListEndpoint(comments as never, reactions as never, media as never, { packMany: vi.fn().mockResolvedValue([]) } as never);
		await expect(endpoint.exec({ targetType: 'comment', targetId: 'missing' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATADY_MEDIA' });
		expect(reactions.createQueryBuilder).not.toHaveBeenCalled();
		await endpoint.exec({ targetType: 'comment', targetId: 'comment' }, viewer, null, null);
		expect(media.getVisibleSession).toHaveBeenCalledWith('session', 'viewer', true);
		expect(media.getVisibleWork).not.toHaveBeenCalled();
	});

	test('session reactions paginate by immutable IDs with the default limit', async () => {
		const query = queryWith();
		const media = { getVisibleSession: vi.fn().mockResolvedValue({ id: 'session' }) };
		const endpoint = new MediaReactionListEndpoint({ findOneBy: vi.fn() } as never, { createQueryBuilder: vi.fn().mockReturnValue(query) } as never, media as never, { packMany: vi.fn().mockResolvedValue([]) } as never);
		await endpoint.exec({ targetType: 'session', targetId: 'session', untilId: 'cursor' }, viewer, null, null);
		expect(query.where).toHaveBeenCalledWith('reaction.sessionId = :targetId', { targetId: 'session' });
		expect(query.andWhere).toHaveBeenCalledWith('reaction.id < :untilId', { untilId: 'cursor' });
		expect(query.orderBy).toHaveBeenCalledWith('reaction.id', 'DESC');
		expect(query.take).toHaveBeenCalledWith(10);
		await expect(endpoint.exec({ targetType: 'session', targetId: 'session', limit: 101 }, viewer, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});
});
