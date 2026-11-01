/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface HataFeedIssueFilters {
	projectId: string | null;
	category: string | null;
	status: string | null;
	createdById: string | null;
	query: string | null;
	includeClosed: boolean;
}

export interface HataFeedIssuePageRequest extends HataFeedIssueFilters {
	limit: number;
	untilId?: string;
}

/** API の上限 100 件を守り、表示行を減らさずに次ページの有無を調べる。 */
export async function fetchHataFeedIssuePage<T extends { id: string }>(
	request: (params: HataFeedIssuePageRequest) => Promise<T[]>,
	filters: HataFeedIssueFilters,
	pageSize: number,
	untilId?: string,
): Promise<{ issues: T[]; hasNext: boolean }> {
	const params = { ...filters };
	const result = await request({ ...params, limit: Math.min(pageSize + 1, 100), untilId });
	const issues = result.slice(0, pageSize);
	let hasNext = result.length > pageSize;

	if (pageSize === 100 && issues.length === 100) {
		const next = await request({ ...params, limit: 1, untilId: issues[issues.length - 1].id });
		hasNext = next.length > 0;
	}

	return { issues, hasNext };
}
