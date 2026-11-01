/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { FeedbackService } from '@/core/FeedbackService.js';
import type { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import UpdateIssueEndpoint from '@/server/api/endpoints/hata/feedback/issues/update.js';
import ExportIssuesEndpoint from '@/server/api/endpoints/hata/feedback/issues/export.js';
import StatusCountsEndpoint from '@/server/api/endpoints/hata/feedback/issues/status-counts.js';

const newStatuses = [
	['nextFixConfirmed', '次回修正確定'],
	['nextFixPlanned', '次回修正予定'],
	['monitoring', '修正監視中'],
] as const;

function createUpdateEndpoint(canManage = true) {
	const issue = {
		id: 'issue1', title: '修正対象', status: 'open', category: 'bug', projectId: null,
		createdById: 'author', closed: false, resolutionNote: '既存メモ',
	} as MiFeedbackIssue;
	const repository = {
		findOneBy: vi.fn().mockResolvedValue(issue),
		update: vi.fn().mockImplementation(async (_id: string, patch: Partial<MiFeedbackIssue>) => Object.assign(issue, patch)),
	};
	const insertNotifications = vi.fn().mockResolvedValue(undefined);
	const service = Object.create(FeedbackService.prototype) as FeedbackService;
	Object.assign(service, {
		feedbackIssuesRepository: repository,
		feedbackIssueModeratorsRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
		feedbackNotificationsRepository: { insert: insertNotifications },
		roleService: {
			isModerator: vi.fn().mockResolvedValue(canManage),
			getModeratorIds: vi.fn().mockResolvedValue(['manager', 'staff']),
		},
		idService: { gen: vi.fn().mockReturnValue('notification1') },
		notificationService: { createNotificationAsync: vi.fn().mockResolvedValue(undefined) },
	});
	const endpoint = new UpdateIssueEndpoint(repository as never, {
		packIssue: vi.fn().mockImplementation(async () => issue),
	} as never, service);
	return { endpoint, issue, repository, insertNotifications };
}

describe('HataFeed issue statuses', () => {
	test.each(newStatuses)('saves %s and notifies its Japanese label without closing the issue', async (status, label) => {
		const { endpoint, repository, insertNotifications } = createUpdateEndpoint();
		const result = await endpoint.exec({ issueId: 'issue1', status }, { id: 'manager' } as never, null, null);

		expect(repository.update).toHaveBeenCalledWith('issue1', expect.objectContaining({ status }));
		expect(result).toMatchObject({ status, closed: false, resolutionNote: '既存メモ' });
		expect(insertNotifications).toHaveBeenCalledOnce();
		expect(insertNotifications.mock.calls[0][0]).toEqual(['author', 'staff'].map(userId => expect.objectContaining({
			userId,
			type: 'issueStatusChanged',
			message: `イシュー「修正対象」の状態が「${label}」に変更されました。`,
		})));
	});

	test('rejects a status change by a user without issue management permission', async () => {
		const { endpoint, repository, insertNotifications } = createUpdateEndpoint(false);

		await expect(endpoint.exec({ issueId: 'issue1', status: 'nextFixConfirmed' }, { id: 'user' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATAFEED_MANAGE_DENIED' });
		expect(repository.update).not.toHaveBeenCalled();
		expect(insertNotifications).not.toHaveBeenCalled();
	});

	test('still rejects unknown status values before writing', async () => {
		const { endpoint, repository } = createUpdateEndpoint();

		await expect(endpoint.exec({ issueId: 'issue1', status: 'notAStatus' }, { id: 'manager' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(repository.update).not.toHaveBeenCalled();
	});

	test('returns each new status count and includes it in the total', async () => {
		const query = {
			select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
			groupBy: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
			getRawMany: vi.fn().mockResolvedValue([
				{ status: 'open', count: '4' },
				...newStatuses.map(([status], index) => ({ status, count: String(index + 1) })),
			]),
		};
		const endpoint = new StatusCountsEndpoint({ createQueryBuilder: () => query } as never, {} as never, {
			canAccess: vi.fn().mockResolvedValue(true), isStaff: vi.fn().mockResolvedValue(false),
		} as never);

		const result = await endpoint.exec({}, { id: 'user' } as never, null, null);

		expect(result).toEqual({
			total: 10, open: 4, planned: 0, nextFixConfirmed: 1, nextFixPlanned: 2,
			inProgress: 0, monitoring: 3, resolved: 0, wontfix: 0, unknown: 0, closed: 0,
		});
		expect(query.andWhere).toHaveBeenCalledWith('issue.category != :securityCategory', { securityCategory: 'security' });
	});

	test('accepts exporting all ten statuses together and applies the filter', async () => {
		const statuses = ['open', 'planned', 'nextFixConfirmed', 'nextFixPlanned', 'inProgress', 'monitoring', 'resolved', 'wontfix', 'unknown', 'closed'];
		const query = {
			where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]),
		};
		const endpoint = new ExportIssuesEndpoint({ createQueryBuilder: () => query } as never, {} as never, {} as never, {} as never, {
			canAccess: vi.fn().mockResolvedValue(true), canExport: vi.fn().mockResolvedValue(true),
			isStaff: vi.fn().mockResolvedValue(true),
		} as never);

		const result = await endpoint.exec({ statuses }, { id: 'manager' } as never, null, null);

		expect(result.selection.statuses).toEqual(statuses);
		expect(query.andWhere).toHaveBeenCalledWith('issue.status IN (:...statuses)', { statuses });
	});
});
