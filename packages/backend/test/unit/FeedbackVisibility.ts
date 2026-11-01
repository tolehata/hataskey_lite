/*
 * 旗鯖fork(セキュリティ): FeedbackService.canViewIssue / canViewComment の可視性判定。
 *   DB を使わないよう、必要なリポジトリ / RoleService だけをスタブして直接インスタンス化する。
 */
import { describe, expect, test } from 'vitest';
import { FeedbackService } from '@/core/FeedbackService.js';
import type { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import type { MiFeedbackProject } from '@/models/FeedbackProject.js';

type Stub = Record<string, unknown>;

function makeIssue(patch: Partial<MiFeedbackIssue>): MiFeedbackIssue {
	return {
		id: 'issue1',
		category: 'bug',
		projectId: null,
		createdById: 'author',
		...patch,
	} as MiFeedbackIssue;
}

function makeProject(patch: Partial<MiFeedbackProject>): MiFeedbackProject {
	return {
		id: 'proj1',
		ownerId: 'owner',
		suspended: false,
		...patch,
	} as MiFeedbackProject;
}

/**
 * @param staffIds モデレーター/管理者とみなすユーザーID
 * @param projects projectId → プロジェクト(存在しない場合は null)
 * @param comments commentId → { feedbackId }
 * @param issues issueId → Issue
 */
function makeService(opts: {
	staffIds?: string[];
	projects?: Record<string, MiFeedbackProject | null>;
	comments?: Record<string, { feedbackId: string } | null>;
	issues?: Record<string, MiFeedbackIssue | null>;
	persistedNotificationUserIds?: string[];
	bellNotificationUserIds?: string[];
}): FeedbackService {
	const staff = new Set(opts.staffIds ?? []);
	const projects = opts.projects ?? {};
	const comments = opts.comments ?? {};
	const issues = opts.issues ?? {};

	const feedbackProjectsRepository: Stub = {
		findOneBy: async ({ id }: { id: string }) => projects[id] ?? null,
	};
	const feedbackIssuesRepository: Stub = {
		findOneBy: async ({ id }: { id: string }) => issues[id] ?? null,
	};
	const feedbackCommentsRepository: Stub = {
		findOneBy: async ({ id }: { id: string }) => comments[id] ?? null,
	};
	const feedbackNotificationsRepository: Stub = {
		insert: async (rows: Array<{ userId: string }>) => {
			for (const row of rows) opts.persistedNotificationUserIds?.push(row.userId);
		},
	};
	const roleService: Stub = {
		isModerator: async ({ id }: { id: string }) => staff.has(id),
	};
	const idService: Stub = {
		gen: () => 'notification1',
	};
	const notificationService: Stub = {
		createNotificationAsync: async (userId: string) => {
			opts.bellNotificationUserIds?.push(userId);
		},
	};

	// 使わない依存は null で埋める(判定系メソッドからは触られない)。
	return new FeedbackService(
		feedbackProjectsRepository as never,
		feedbackIssuesRepository as never,
		null as never, // feedbackAgreesRepository
		feedbackCommentsRepository as never,
		null as never, // feedbackCommentReactionsRepository
		null as never, // feedbackIssueModeratorsRepository
		null as never, // feedbackEmojiRequestsRepository
		feedbackNotificationsRepository as never,
		null as never, // driveFilesRepository
		idService as never,
		roleService as never,
		null as never, // customEmojiService
		notificationService as never,
	);
}

describe('FeedbackService.canViewIssue', () => {
	test('通常イシューは一般ユーザーでも見える', async () => {
		const svc = makeService({});
		expect(await svc.canViewIssue('someone', makeIssue({ category: 'bug' }))).toBe(true);
	});

	test('security イシューは非スタッフには見えない', async () => {
		const svc = makeService({ staffIds: ['mod'] });
		expect(await svc.canViewIssue('someone', makeIssue({ category: 'security' }))).toBe(false);
	});

	test('security イシューはスタッフには見える', async () => {
		const svc = makeService({ staffIds: ['mod'] });
		expect(await svc.canViewIssue('mod', makeIssue({ category: 'security' }))).toBe(true);
	});

	test('security イシューは未ログイン(null)には見えない', async () => {
		const svc = makeService({ staffIds: ['mod'] });
		expect(await svc.canViewIssue(null, makeIssue({ category: 'security' }))).toBe(false);
	});

	test('サスペンド中プロジェクトのイシューは無関係な一般ユーザーには見えない', async () => {
		const svc = makeService({
			staffIds: ['mod'],
			projects: { proj1: makeProject({ suspended: true, ownerId: 'owner' }) },
		});
		expect(await svc.canViewIssue('someone', makeIssue({ projectId: 'proj1' }))).toBe(false);
	});

	test('サスペンド中プロジェクトのイシューは owner には見える', async () => {
		const svc = makeService({
			projects: { proj1: makeProject({ suspended: true, ownerId: 'owner' }) },
		});
		expect(await svc.canViewIssue('owner', makeIssue({ projectId: 'proj1' }))).toBe(true);
	});

	test('サスペンド中プロジェクトのイシューはスタッフには見える', async () => {
		const svc = makeService({
			staffIds: ['mod'],
			projects: { proj1: makeProject({ suspended: true, ownerId: 'owner' }) },
		});
		expect(await svc.canViewIssue('mod', makeIssue({ projectId: 'proj1' }))).toBe(true);
	});

	test('サスペンドしていないプロジェクトのイシューは誰でも見える', async () => {
		const svc = makeService({
			projects: { proj1: makeProject({ suspended: false }) },
		});
		expect(await svc.canViewIssue('someone', makeIssue({ projectId: 'proj1' }))).toBe(true);
	});

	test('プロジェクトが見つからない場合は従来どおり見える(挙動不変)', async () => {
		const svc = makeService({ projects: {} });
		expect(await svc.canViewIssue('someone', makeIssue({ projectId: 'missing' }))).toBe(true);
	});
});

describe('FeedbackService.canViewComment', () => {
	test('通常イシューのコメントは一般ユーザーでも触れる', async () => {
		const svc = makeService({
			comments: { c1: { feedbackId: 'issue1' } },
			issues: { issue1: makeIssue({ category: 'bug' }) },
		});
		expect(await svc.canViewComment('someone', 'c1')).toBe(true);
	});

	test('security イシューのコメントは非スタッフには触れない', async () => {
		const svc = makeService({
			staffIds: ['mod'],
			comments: { c1: { feedbackId: 'issue1' } },
			issues: { issue1: makeIssue({ category: 'security' }) },
		});
		expect(await svc.canViewComment('someone', 'c1')).toBe(false);
		expect(await svc.canViewComment('mod', 'c1')).toBe(true);
	});

	test('存在しないコメントは false', async () => {
		const svc = makeService({ comments: {}, issues: {} });
		expect(await svc.canViewComment('someone', 'nope')).toBe(false);
	});

	test('イシューが消えているコメントは false', async () => {
		const svc = makeService({
			comments: { c1: { feedbackId: 'gone' } },
			issues: {},
		});
		expect(await svc.canViewComment('someone', 'c1')).toBe(false);
	});
});

describe('FeedbackService Issue 通知の可視性', () => {
	test('security 化後は過去の一般参加者へタイトル付き通知を送らない', async () => {
		const persistedNotificationUserIds: string[] = [];
		const bellNotificationUserIds: string[] = [];
		const issue = makeIssue({ category: 'security' });
		const svc = makeService({
			staffIds: ['mod'],
			issues: { issue1: issue },
			persistedNotificationUserIds,
			bellNotificationUserIds,
		});

		await svc.notify('formerParticipant', 'issueStatusChanged', { feedbackId: issue.id }, '非公開の題名');
		expect(persistedNotificationUserIds).toEqual([]);
		expect(bellNotificationUserIds).toEqual([]);

		await svc.notify('mod', 'issueStatusChanged', { feedbackId: issue.id }, '非公開の題名');
		expect(persistedNotificationUserIds).toEqual(['mod']);
		expect(bellNotificationUserIds).toEqual(['mod']);
	});
});
