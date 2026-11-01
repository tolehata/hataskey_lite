/*
 * 旗鯖fork: HataFeed のイシュー一覧と状態別件数で同じ絞り込みを使う。
 *   件数だけ別条件になると、一覧の件数と対応状況の数値が食い違うため共通化している。
 */
import { Brackets } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import type { MiFeedbackIssue } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

export type FeedbackIssueListFilter = {
	projectId?: string | null;
	category?: string | null;
	status?: string | null;
	createdById?: string | null;
	query?: string | null;
	includeClosed?: boolean;
};

export function applyFeedbackIssueListFilter(
	query: SelectQueryBuilder<MiFeedbackIssue>,
	filter: FeedbackIssueListFilter,
	isStaff: boolean,
): SelectQueryBuilder<MiFeedbackIssue> {
	if (filter.projectId != null) {
		query.andWhere('issue.projectId = :projectId', { projectId: filter.projectId });
	} else {
		query.andWhere('issue.projectId IS NULL');
	}
	if (filter.category != null) query.andWhere('issue.category = :category', { category: filter.category });
	if (filter.status != null) query.andWhere('issue.status = :status', { status: filter.status });
	if (filter.createdById != null) query.andWhere('issue.createdById = :createdById', { createdById: filter.createdById });
	// 「受付終了」で絞り込むときは、終了分を除外すると常に空になるため含める。
	if (!filter.includeClosed && filter.status !== 'closed') query.andWhere('issue.closed = FALSE');

	// セキュリティ対応(security)のイシューはスタッフ(管理者/モデ)のみ閲覧可。
	if (!isStaff) {
		query.andWhere('issue.category != :securityCategory', { securityCategory: 'security' });
	}

	// 検索: タイトル・説明・会話(コメント本文)のいずれかにマッチ。
	if (filter.query) {
		const q = '%' + sqlLikeEscape(filter.query) + '%';
		query.andWhere(new Brackets(qb => {
			qb.where('issue.title ILIKE :q', { q })
				.orWhere('issue.description ILIKE :q', { q })
				.orWhere('EXISTS (SELECT 1 FROM "feedback_comment" fc WHERE fc."feedbackId" = issue.id AND fc.text ILIKE :q)', { q });
		}));
	}

	return query;
}
