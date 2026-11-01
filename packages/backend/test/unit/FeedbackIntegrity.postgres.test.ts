/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DataSource, EntitySchema } from 'typeorm';
import { FeedbackService } from '@/core/FeedbackService.js';
import { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import { MiFeedbackAgree } from '@/models/FeedbackAgree.js';
import { MiFeedbackComment } from '@/models/FeedbackComment.js';
import { entities } from '@/postgres.js';
import { FeedbackIssueIntegrity1790380300000 } from '../../migration/1790380300000-feedback-issue-integrity.js';

// Opt-in only, against a disposable database whose name cannot be confused with
// the application database. No default config or production credentials are read.
const url = process.env.HATA_FEEDBACK_TEST_URL;
if (url && !/^hataskey_feedback_test_[a-z0-9_]+$/.test(new URL(url).pathname.slice(1))) throw new Error('A disposable hataskey_feedback_test_* database is required');

describe.skipIf(!url)('HataFeed integrity on PostgreSQL', () => {
	const issueSchema = new EntitySchema({ name: MiFeedbackIssue.name, target: MiFeedbackIssue, tableName: 'feedback_issue',
		columns: {
			id: { type: String, primary: true }, number: { type: Number, default: 0 },
			createdAt: { type: 'timestamptz', default: () => 'now()' }, updatedAt: { type: 'timestamptz', default: () => 'now()' },
			title: { type: String, default: '' }, description: { type: String, default: '' }, category: { type: String, default: 'bug' }, status: { type: String, default: 'open' }, priority: { type: String, default: 'normal' },
			pinned: { type: Boolean, default: false }, closed: { type: Boolean, default: false }, agreementsCount: { type: Number, default: 0 }, commentsCount: { type: Number, default: 0 },
			fileIds: { type: 'varchar', array: true, default: '{}' }, projectId: { type: String, nullable: true }, code: { type: String, nullable: true }, createdById: { type: String, nullable: true }, lastCommentedAt: { type: 'timestamptz', nullable: true },
		}, indices: [{ name: 'IDX_feedback_issue_number', columns: ['number'] }],
	});
	const agreeSchema = new EntitySchema({ name: MiFeedbackAgree.name, target: MiFeedbackAgree, tableName: 'feedback_agree',
		columns: { id: { type: String, primary: true }, createdAt: { type: 'timestamptz', default: () => 'now()' }, feedbackId: { type: String }, userId: { type: String } },
		uniques: [{ columns: ['feedbackId', 'userId'] }],
	});
	const commentSchema = new EntitySchema({ name: MiFeedbackComment.name, target: MiFeedbackComment, tableName: 'feedback_comment',
		columns: { id: { type: String, primary: true }, createdAt: { type: 'timestamptz', default: () => 'now()' }, updatedAt: { type: 'timestamptz', nullable: true },
			feedbackId: { type: String }, userId: { type: String }, text: { type: String, default: '' }, fileIds: { type: 'varchar', array: true, default: '{}' }, replyToId: { type: String, nullable: true } },
	});
	const db = new DataSource({ type: 'postgres', url, entities: [issueSchema, agreeSchema, commentSchema], synchronize: false, extra: { max: 12, statement_timeout: 10000 } });
	const migration = new FeedbackIssueIntegrity1790380300000();
	const migrate = async (direction: 'up' | 'down' = 'up') => {
		const runner = db.createQueryRunner();
		await runner.connect(); await runner.startTransaction();
		try {
			await migration[direction](runner);
			await runner.commitTransaction();
		} catch (error) {
			await runner.rollbackTransaction();
			throw error;
		} finally {
			await runner.release();
		}
	};
	const service: FeedbackService = Object.assign(Object.create(FeedbackService.prototype), {
		feedbackIssuesRepository: db.getRepository(MiFeedbackIssue), feedbackAgreesRepository: db.getRepository(MiFeedbackAgree), feedbackCommentsRepository: db.getRepository(MiFeedbackComment),
		driveFilesRepository: { findBy: async () => [] }, idService: { gen: () => randomUUID() },
	});
	beforeAll(async () => { await db.initialize(); });
	beforeEach(async () => { await db.synchronize(true); });
	afterAll(async () => { if (db.isInitialized) await db.destroy(); });

	test('preserves old links, repairs actual counters, and assigns unique numbers under concurrent creation', async () => {
		await db.getRepository(MiFeedbackIssue).insert({ id: 'old', number: 8, agreementsCount: -2, commentsCount: -1 });
		await db.getRepository(MiFeedbackAgree).insert({ id: 'agree', feedbackId: 'old', userId: 'owner' });
		await db.getRepository(MiFeedbackComment).insert({ id: 'comment', feedbackId: 'old', userId: 'owner' });
		await migrate();
		const ids = await Promise.all(Array.from({ length: 20 }, () => service.createIssue({ id: 'owner' } as never, { title: 'test', projectId: 'project' })));
		const rows = await db.getRepository(MiFeedbackIssue).find();
		expect(new Set(rows.map(row => row.number)).size).toBe(21);
		expect(rows.find(row => row.id === 'old')).toMatchObject({ number: 8, agreementsCount: 1, commentsCount: 1 });
		expect(rows.filter(row => ids.includes(row.id)).every(row => row.number > 8)).toBe(true);
		await expect(db.getRepository(MiFeedbackIssue).insert({ id: 'duplicate', number: 8 })).rejects.toMatchObject({ driverError: { code: '23505' } });
	});

	test('refuses historical duplicate numbers without renumbering or partially applying the migration', async () => {
		await db.getRepository(MiFeedbackIssue).insert([{ id: 'one', number: 4 }, { id: 'two', number: 4 }]);
		await expect(migrate()).rejects.toThrow('Duplicate feedback issue numbers');
		expect((await db.getRepository(MiFeedbackIssue).find()).map(row => row.number)).toEqual([4, 4]);
		expect((await db.query("SELECT to_regclass('feedback_issue_number_seq') AS sequence"))[0].sequence).toBeNull();
	});

	test('serializes same-user toggles and counts concurrent comment deletes only once', async () => {
		await migrate();
		await db.getRepository(MiFeedbackIssue).insert({ id: 'issue', createdById: 'owner' });
		const issue = await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'issue' });
		const actor = { id: 'owner' } as never;
		await Promise.all(Array.from({ length: 10 }, () => service.toggleAgree(actor, issue)));
		expect(await db.getRepository(MiFeedbackAgree).count()).toBe(0);
		expect((await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'issue' })).agreementsCount).toBe(0);
		await Promise.all(Array.from({ length: 12 }, (_, index) => service.toggleAgree({ id: `user${index}` } as never, issue)));
		expect(await db.getRepository(MiFeedbackAgree).count()).toBe(12);
		expect((await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'issue' })).agreementsCount).toBe(12);
		const commentId = await service.addComment(actor, issue, 'keep the counter consistent');
		const comment = await db.getRepository(MiFeedbackComment).findOneByOrFail({ id: commentId });
		await Promise.all(Array.from({ length: 10 }, () => service.deleteComment(comment)));
		expect(await db.getRepository(MiFeedbackComment).count()).toBe(0);
		expect((await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'issue' })).commentsCount).toBe(0);
	});

	test('rolls back both the source row and counter when a count update fails', async () => {
		await migrate();
		await db.getRepository(MiFeedbackIssue).insert({ id: 'issue', createdById: 'owner' });
		const issue = await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'issue' });
		await db.query('ALTER TABLE "feedback_issue" ADD CHECK ("agreementsCount" = 0), ADD CHECK ("commentsCount" = 0)');
		await expect(service.toggleAgree({ id: 'owner' } as never, issue)).rejects.toThrow();
		await expect(service.addComment({ id: 'owner' } as never, issue, 'must roll back')).rejects.toThrow();
		expect(await db.getRepository(MiFeedbackAgree).count()).toBe(0);
		expect(await db.getRepository(MiFeedbackComment).count()).toBe(0);
	});

	test('supports an empty database and reversal without changing existing numbers', async () => {
		await migrate();
		await db.getRepository(MiFeedbackIssue).insert({ id: 'first' });
		expect((await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'first' })).number).toBe(1);
		await migrate('down');
		expect((await db.getRepository(MiFeedbackIssue).findOneByOrFail({ id: 'first' })).number).toBe(1);
	});

	test('can construct the real entity schema without running migrations', async () => {
		const native = new DataSource({ type: 'postgres', url, entities, synchronize: false });
		await native.initialize();
		try {
			await native.synchronize(true);
			expect(native.getMetadata(MiFeedbackIssue).generatedColumns.some(column => column.propertyName === 'number' && column.generationStrategy === 'increment')).toBe(true);
			expect((await native.query("SELECT nextval('feedback_issue_number_seq') AS number"))[0].number).toBe(1);
		} finally { await native.destroy(); }
	});
});
