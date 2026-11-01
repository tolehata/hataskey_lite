/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { FeedbackService } from '@/core/FeedbackService.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import type { MiUser } from '@/models/User.js';
import { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import type { MiFeedbackComment } from '@/models/FeedbackComment.js';
import type { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';

const now = new Date('2026-10-01T00:00:00Z');
const author = { id: 'author' } as MiUser;
const files = [
	{ id: 'own', userId: 'author', url: 'https://example.test/own', type: 'image/png', webpublicUrl: null },
	{ id: 'own-text', userId: 'author', url: 'https://example.test/text', type: 'text/plain', webpublicUrl: null },
	{ id: 'other', userId: 'other-user', url: 'https://example.test/other', type: 'image/png', webpublicUrl: null },
	{ id: 'system', userId: null, url: 'https://example.test/system', type: 'image/png', webpublicUrl: null },
];

function setup() {
	const driveFilesRepository = { findBy: vi.fn(async ({ id }: { id: { _value: string[] } }) => files.filter(file => id._value.includes(file.id))) };
	const issues = { insert: vi.fn(async () => {}), createQueryBuilder: () => ({ select: () => ({ getRawOne: async () => ({ max: 0 }) }) }), update: vi.fn(async () => {}), increment: vi.fn(async () => {}) };
	const comments = { insert: vi.fn(async () => {}) };
	Object.assign(issues, { manager: { transaction: async (run: (manager: unknown) => Promise<unknown>) => run({ getRepository: (entity: unknown) => entity === MiFeedbackIssue ? issues : comments }) } });
	const emojiRequests = { insert: vi.fn(async () => {}), update: vi.fn(async () => {}) };
	const customEmoji = { checkDuplicate: vi.fn(async () => false), add: vi.fn(async () => ({ id: 'new-emoji' })), addDirect: vi.fn(async () => ({ id: 'new-emoji' })) };
	const notifyStaff = vi.fn(async () => {});
	const notify = vi.fn(async () => {});
	const service: FeedbackService = Object.assign(Object.create(FeedbackService.prototype), {
		driveFilesRepository,
		feedbackIssuesRepository: issues,
		feedbackCommentsRepository: comments,
		feedbackEmojiRequestsRepository: emojiRequests,
		customEmojiService: customEmoji,
		idService: { gen: () => 'new-id' },
	});
	Object.defineProperties(service, {
		notifyStaff: { value: notifyStaff },
		notify: { value: notify },
	});

	return { service, driveFilesRepository, issues, comments, emojiRequests, customEmoji, notifyStaff, notify };
}

function issue(patch: Record<string, unknown> = {}) {
	return {
		id: 'issue', number: 1, createdAt: now, updatedAt: now, title: 'title', description: '', category: 'bug',
		status: 'open', priority: 'normal', pinned: false, closed: false, agreementsCount: 0, commentsCount: 0,
		fileIds: [], createdById: author.id, projectId: null, ...patch,
	} as unknown as MiFeedbackIssue;
}

function comment(patch: Record<string, unknown> = {}) {
	return {
		id: 'comment', createdAt: now, updatedAt: null, feedbackId: 'issue', userId: author.id,
		text: 'text', fileIds: [], replyToId: null, ...patch,
	} as unknown as MiFeedbackComment;
}

function request(patch: Record<string, unknown> = {}) {
	return {
		id: 'request', createdAt: now, updatedAt: now, requestedById: author.id, name: 'new',
		category: null, aliases: [], license: null, localOnly: false, isSensitive: false,
		sourceType: 'image', originalUrl: 'https://example.test/original', fileId: 'own',
		status: 'pending', resolvedEmojiId: null, ...patch,
	} as unknown as MiFeedbackEmojiRequest;
}

describe('HataFeed attachment creation and approval', () => {
	test.each(['other', 'missing', 'system'])('rejects %s for all creation methods before writes', async fileId => {
		const { service, issues, comments, emojiRequests, notifyStaff, notify } = setup();

		await expect(service.createIssue(author, { title: 'title', fileIds: ['own', fileId] })).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		await expect(service.addComment(author, issue(), 'text', [fileId])).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		await expect(service.createEmojiRequest(author, { name: 'new', sourceType: 'remote', originalUrl: 'https://example.test/remote', fileId })).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		expect(issues.insert).not.toHaveBeenCalled(); expect(comments.insert).not.toHaveBeenCalled(); expect(emojiRequests.insert).not.toHaveBeenCalled();
		expect(notifyStaff).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
	});
	test('owned files retain order and duplicates; remote without a file remains valid', async () => {
		const { service, issues, comments, emojiRequests } = setup();

		await service.createIssue(author, { title: 'title', fileIds: ['own-text', 'own', 'own-text'] });
		await service.addComment(author, issue(), 'text', ['own', 'own-text', 'own']);
		await service.createEmojiRequest(author, { name: 'local', sourceType: 'image', fileId: 'own' });
		await service.createEmojiRequest(author, { name: 'new', sourceType: 'remote', originalUrl: 'https://example.test/remote' });
		expect(issues.insert).toHaveBeenCalledWith(expect.objectContaining({ fileIds: ['own-text', 'own', 'own-text'] }));
		expect(comments.insert).toHaveBeenCalledWith(expect.objectContaining({ fileIds: ['own', 'own-text', 'own'] }));
		expect(emojiRequests.insert).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'own', sourceType: 'image' }));
		expect(emojiRequests.insert).toHaveBeenCalledWith(expect.objectContaining({ fileId: null }));
	});
	test('image without file and legacy foreign files cannot reach emoji creation', async () => {
		const { service, emojiRequests, customEmoji, notifyStaff, notify } = setup();
		await expect(service.createEmojiRequest(author, { name: 'new', sourceType: 'image' })).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		expect(emojiRequests.insert).not.toHaveBeenCalled();
		const approve = (service as unknown as { applyEmojiApproval: (actor: MiUser, req: MiFeedbackEmojiRequest) => Promise<void> }).applyEmojiApproval.bind(service);
		for (const fileId of ['other', 'missing', 'system']) {
			await expect(approve(author, request({ fileId }))).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		}
		await expect(approve({ id: 'other-user' } as MiUser, request({ sourceType: 'remote', fileId: 'other' }))).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		await expect(approve(author, request({ fileId: null }))).rejects.toMatchObject({ code: 'HATAFEED_INVALID_ATTACHMENT' });
		expect(customEmoji.add).not.toHaveBeenCalled(); expect(customEmoji.addDirect).not.toHaveBeenCalled();
		expect(emojiRequests.update).not.toHaveBeenCalled();
		expect(notifyStaff).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
	});
	test('approval uses the owned file and permits remote requests without a file', async () => {
		const { service, emojiRequests, customEmoji } = setup();
		const approve = (service as unknown as { applyEmojiApproval: (actor: MiUser, req: MiFeedbackEmojiRequest) => Promise<void> }).applyEmojiApproval.bind(service);
		await approve(author, request());
		expect(customEmoji.add).toHaveBeenCalledWith(expect.objectContaining({ originalUrl: 'https://example.test/own' }), author);
		await approve(author, request({ id: 'remote', sourceType: 'remote', fileId: null, originalUrl: 'https://example.test/remote' }));
		expect(customEmoji.add).toHaveBeenCalledWith(expect.objectContaining({ originalUrl: 'https://example.test/remote' }), author);
		await approve(author, request({ id: 'remote-file', status: 'held', sourceType: 'remote', fileId: 'own', originalUrl: 'https://example.test/remote' }));
		expect(customEmoji.add).toHaveBeenLastCalledWith(expect.objectContaining({ originalUrl: 'https://example.test/own' }), author);
		expect(emojiRequests.update).toHaveBeenCalledTimes(3);
	});
});

function setupPacker() {
	const driveFilesRepository = { findBy: vi.fn(async ({ id }: { id: { _value: string[] } }) => files.filter(file => id._value.includes(file.id))) };
	const packMany = vi.fn(async (sourceFiles: typeof files) => sourceFiles.map(file => ({ id: file.id, url: file.url })));
	const changesQuery = { distinctOn: () => changesQuery, where: () => changesQuery, orderBy: () => changesQuery, addOrderBy: () => changesQuery, getMany: async () => [] };
	const service: FeedbackEntityService = Object.assign(Object.create(FeedbackEntityService.prototype), {
		driveFilesRepository, driveFileEntityService: { packMany },
		feedbackIssueModeratorsRepository: { findBy: async () => [] },
		feedbackCommentReactionsRepository: { findBy: async () => [] },
		feedbackCommentsRepository: { findBy: async () => [] },
		userEntityService: { packMany: async () => [], pack: async () => null },
		emojisRepository: { findBy: async () => [{ id: 'approved-emoji', host: null, name: 'approved', publicUrl: 'https://example.test/approved', originalUrl: 'https://example.test/approved', license: null, category: null, aliases: [] }] },
		feedbackEmojiChangesRepository: { createQueryBuilder: () => changesQuery },
	});
	return { service, packMany };
}

describe('HataFeed attachment packing of historical records', () => {
	test('issue and comment batches filter per author, preserving owned order and duplicates', async () => {
		const { service, packMany } = setupPacker();
		const issueRows = await service.packIssues([
			issue({ id: 'a', fileIds: ['own-text', 'other', 'own', 'own-text'] }),
			issue({ id: 'b', createdById: 'other-user', fileIds: ['own', 'other'] }),
			issue({ id: 'c', createdById: null, fileIds: ['own'] }),
		]);
		expect((issueRows[0].files as Array<{ id: string }>).map(file => file.id)).toEqual(['own-text', 'own', 'own-text']);
		expect((issueRows[1].files as Array<{ id: string }>).map(file => file.id)).toEqual(['other']);
		expect(issueRows[2].files).toEqual([]);
		const commentRows = await service.packComments([
			comment({ id: 'a', fileIds: ['other', 'own-text', 'own', 'own-text'] }),
			comment({ id: 'b', userId: 'other-user', fileIds: ['own', 'other'] }),
			comment({ id: 'c', userId: null, fileIds: ['own'] }),
		]);
		expect((commentRows[0].files as Array<{ id: string }>).map(file => file.id)).toEqual(['own-text', 'own', 'own-text']);
		expect((commentRows[1].files as Array<{ id: string }>).map(file => file.id)).toEqual(['other']);
		expect(commentRows[2].files).toEqual([]);
		expect(packMany).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'system' })]));
	});
	test('emoji requests hide foreign, deleted and authorless file URLs in every status', async () => {
		const { service } = setupPacker();
		const rows = await service.packEmojiRequests([
			request({ id: 'owned' }), request({ id: 'foreign', fileId: 'other', status: 'approved' }),
			request({ id: 'deleted', fileId: 'missing', status: 'held' }), request({ id: 'authorless', requestedById: null }),
			request({ id: 'remote', sourceType: 'remote', fileId: null, originalUrl: 'https://example.test/remote' }),
			request({ id: 'image-no-file', fileId: null }),
		]);
		expect(rows.map(row => [row.fileId, row.imageUrl])).toEqual([
			['own', 'https://example.test/own'], [null, null], [null, null], [null, null],
			[null, 'https://example.test/remote'], [null, null],
		]);
		const [approved] = await service.packEmojiRequests([request({ id: 'approved', status: 'approved', fileId: 'missing', resolvedEmojiId: 'approved-emoji' })]);
		expect(approved.fileId).toBeNull(); expect(approved.imageUrl).toBeNull();
		expect(approved.currentEmoji).toEqual(expect.objectContaining({ id: 'approved-emoji', imageUrl: 'https://example.test/approved' }));
	});
});
