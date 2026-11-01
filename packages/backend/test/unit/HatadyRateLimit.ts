/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { RateLimiterService } from '@/server/api/RateLimiterService.js';
import { meta as activitiesMeta } from '@/server/api/endpoints/hata/hatady/activities.js';
import { meta as adminBooksMeta } from '@/server/api/endpoints/hata/hatady/admin/books.js';
import { meta as adminDeleteBookMeta } from '@/server/api/endpoints/hata/hatady/admin/delete-book.js';
import { meta as adminModerationListMeta } from '@/server/api/endpoints/hata/hatady/admin/moderation/list.js';
import { meta as adminModerationShowMeta } from '@/server/api/endpoints/hata/hatady/admin/moderation/show.js';
import { meta as adminModerationReviewMeta } from '@/server/api/endpoints/hata/hatady/admin/moderation/review.js';
import { meta as bookmarkCreateMeta } from '@/server/api/endpoints/hata/hatady/bookmarks/create.js';
import { meta as bookmarkDeleteMeta } from '@/server/api/endpoints/hata/hatady/bookmarks/delete.js';
import { meta as bookmarkUpdateMeta } from '@/server/api/endpoints/hata/hatady/bookmarks/update.js';
import { meta as booksMeta } from '@/server/api/endpoints/hata/hatady/books.js';
import { meta as bookCreateMeta } from '@/server/api/endpoints/hata/hatady/books/create.js';
import { meta as bookDeleteMeta } from '@/server/api/endpoints/hata/hatady/books/delete.js';
import { meta as bookShowMeta } from '@/server/api/endpoints/hata/hatady/books/show.js';
import { meta as bookUpdateMeta } from '@/server/api/endpoints/hata/hatady/books/update.js';
import { meta as commentsMeta } from '@/server/api/endpoints/hata/hatady/comments.js';
import { meta as commentCreateMeta } from '@/server/api/endpoints/hata/hatady/comments/create.js';
import { meta as commentDeleteMeta } from '@/server/api/endpoints/hata/hatady/comments/delete.js';
import { meta as commentUpdateMeta } from '@/server/api/endpoints/hata/hatady/comments/update.js';
import { meta as followerRemoveMeta } from '@/server/api/endpoints/hata/hatady/followers/remove.js';
import { meta as followingCreateMeta } from '@/server/api/endpoints/hata/hatady/following/create.js';
import { meta as followingDeleteMeta } from '@/server/api/endpoints/hata/hatady/following/delete.js';
import { meta as followingListMeta } from '@/server/api/endpoints/hata/hatady/following/list.js';
import { meta as goalsMeta } from '@/server/api/endpoints/hata/hatady/goals.js';
import { meta as goalCreateMeta } from '@/server/api/endpoints/hata/hatady/goals/create.js';
import { meta as goalDeleteMeta } from '@/server/api/endpoints/hata/hatady/goals/delete.js';
import { meta as goalUpdateMeta } from '@/server/api/endpoints/hata/hatady/goals/update.js';
import { meta as logsMeta } from '@/server/api/endpoints/hata/hatady/logs.js';
import { meta as logCreateMeta } from '@/server/api/endpoints/hata/hatady/logs/create.js';
import { meta as logDeleteMeta } from '@/server/api/endpoints/hata/hatady/logs/delete.js';
import { meta as logShowMeta } from '@/server/api/endpoints/hata/hatady/logs/show.js';
import { meta as logUpdateMeta } from '@/server/api/endpoints/hata/hatady/logs/update.js';
import { meta as mediaCommentCreateMeta } from '@/server/api/endpoints/hata/hatady/media/comments/create.js';
import { meta as mediaCommentDeleteMeta } from '@/server/api/endpoints/hata/hatady/media/comments/delete.js';
import { meta as mediaCommentListMeta } from '@/server/api/endpoints/hata/hatady/media/comments/list.js';
import { meta as mediaCommentUpdateMeta } from '@/server/api/endpoints/hata/hatady/media/comments/update.js';
import { meta as mediaReactionCreateMeta } from '@/server/api/endpoints/hata/hatady/media/reactions/create.js';
import { meta as mediaReactionDeleteMeta } from '@/server/api/endpoints/hata/hatady/media/reactions/delete.js';
import { meta as mediaReactionListMeta } from '@/server/api/endpoints/hata/hatady/media/reactions/list.js';
import { meta as mediaSessionCreateMeta } from '@/server/api/endpoints/hata/hatady/media/sessions/create.js';
import { meta as mediaSessionDeleteMeta } from '@/server/api/endpoints/hata/hatady/media/sessions/delete.js';
import { meta as mediaSessionListMeta } from '@/server/api/endpoints/hata/hatady/media/sessions/list.js';
import { meta as mediaSessionShowMeta } from '@/server/api/endpoints/hata/hatady/media/sessions/show.js';
import { meta as mediaSessionUpdateMeta } from '@/server/api/endpoints/hata/hatady/media/sessions/update.js';
import { meta as mediaWorkCreateMeta } from '@/server/api/endpoints/hata/hatady/media/works/create.js';
import { meta as mediaWorkDeleteMeta } from '@/server/api/endpoints/hata/hatady/media/works/delete.js';
import { meta as mediaWorkListMeta } from '@/server/api/endpoints/hata/hatady/media/works/list.js';
import { meta as mediaWorkShowMeta } from '@/server/api/endpoints/hata/hatady/media/works/show.js';
import { meta as mediaWorkUpdateMeta } from '@/server/api/endpoints/hata/hatady/media/works/update.js';
import { meta as memoCreateMeta } from '@/server/api/endpoints/hata/hatady/memos/create.js';
import { meta as memoDeleteMeta } from '@/server/api/endpoints/hata/hatady/memos/delete.js';
import { meta as memoUpdateMeta } from '@/server/api/endpoints/hata/hatady/memos/update.js';
import { meta as notificationsMeta } from '@/server/api/endpoints/hata/hatady/notifications.js';
import { meta as notificationDeleteMeta } from '@/server/api/endpoints/hata/hatady/notifications/delete.js';
import { meta as notificationRestoreMeta } from '@/server/api/endpoints/hata/hatady/notifications/restore.js';
import { meta as notificationsMarkAllReadMeta } from '@/server/api/endpoints/hata/hatady/notifications/mark-all-read.js';
import { meta as notificationsMarkReadMeta } from '@/server/api/endpoints/hata/hatady/notifications/mark-as-read.js';
import { meta as notificationsUnreadCountMeta } from '@/server/api/endpoints/hata/hatady/notifications/unread-count.js';
import { meta as profileUpdateMeta } from '@/server/api/endpoints/hata/hatady/profile/update.js';
import { meta as reactionCreateMeta } from '@/server/api/endpoints/hata/hatady/reactions/create.js';
import { meta as reactionDeleteMeta } from '@/server/api/endpoints/hata/hatady/reactions/delete.js';
import { meta as reactionListMeta } from '@/server/api/endpoints/hata/hatady/reactions/list.js';
import { meta as searchMeta } from '@/server/api/endpoints/hata/hatady/search.js';
import { meta as statsDetailMeta } from '@/server/api/endpoints/hata/hatady/stats-detail.js';
import { meta as statsMeta } from '@/server/api/endpoints/hata/hatady/stats.js';
import { meta as streaksMeta } from '@/server/api/endpoints/hata/hatady/streaks.js';
import { meta as subjectsMeta } from '@/server/api/endpoints/hata/hatady/subjects.js';
import { meta as subjectDeleteMeta } from '@/server/api/endpoints/hata/hatady/subjects/delete.js';
import { meta as subjectSaveMeta } from '@/server/api/endpoints/hata/hatady/subjects/save.js';
import { meta as timelineMeta } from '@/server/api/endpoints/hata/hatady/timeline.js';
import { meta as userShowMeta } from '@/server/api/endpoints/hata/hatady/users/show.js';

const limiterOptions = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('ratelimiter', () => ({
	default: class FakeLimiter {
		constructor(options: Record<string, unknown>) {
			limiterOptions.push(options);
		}

		public get(callback: (error: null, info: { remaining: number }) => void) {
			callback(null, { remaining: 1 });
		}
	},
}));

const endpointGroups = [
	{
		profile: HATADY_RATE_LIMITS.read,
		endpoints: [
			['本棚一覧', booksMeta],
			['コメント一覧', commentsMeta],
			['目標一覧', goalsMeta],
			['学習記録一覧', logsMeta],
			['通知一覧', notificationsMeta],
			['未読通知数', notificationsUnreadCountMeta],
			['科目一覧', subjectsMeta],
			['作品一覧', mediaWorkListMeta],
			['作品の詳細', mediaWorkShowMeta],
			['記録一覧', mediaSessionListMeta],
			['記録詳細', mediaSessionShowMeta],
			['作品コメント一覧', mediaCommentListMeta],
			['リアクション一覧', reactionListMeta],
			['作品リアクション一覧', mediaReactionListMeta],
		],
	},
	{
		profile: HATADY_RATE_LIMITS.heavyRead,
		endpoints: [
			['管理用本棚一覧', adminBooksMeta],
			['管理用モデレーション一覧', adminModerationListMeta],
			['管理用モデレーション詳細', adminModerationShowMeta],
			['本の詳細', bookShowMeta],
			['フォロー一覧', followingListMeta],
			['学習記録の詳細', logShowMeta],
			['横断検索', searchMeta],
			['詳細統計', statsDetailMeta],
			['統計', statsMeta],
			['連続記録', streaksMeta],
			['タイムライン', timelineMeta],
			['利用者詳細', userShowMeta],
			['活動一覧', activitiesMeta],
		],
	},
	{
		profile: HATADY_RATE_LIMITS.write,
		endpoints: [
			['しおり作成', bookmarkCreateMeta],
			['管理用モデレーション審査', adminModerationReviewMeta],
			['しおり更新', bookmarkUpdateMeta],
			['本の作成', bookCreateMeta],
			['本の更新', bookUpdateMeta],
			['コメント作成', commentCreateMeta],
			['コメント更新', commentUpdateMeta],
			['通知を非表示', notificationDeleteMeta],
			['通知を復元', notificationRestoreMeta],
			['フォロワー解除', followerRemoveMeta],
			['フォロー作成', followingCreateMeta],
			['フォロー解除', followingDeleteMeta],
			['目標作成', goalCreateMeta],
			['目標更新', goalUpdateMeta],
			['学習記録作成', logCreateMeta],
			['学習記録更新', logUpdateMeta],
			['メモ作成', memoCreateMeta],
			['メモ更新', memoUpdateMeta],
			['通知をすべて既読', notificationsMarkAllReadMeta],
			['通知を個別に既読', notificationsMarkReadMeta],
			['プロフィール更新', profileUpdateMeta],
			['リアクション作成', reactionCreateMeta],
			['リアクション解除', reactionDeleteMeta],
			['科目保存', subjectSaveMeta],
			['作品の作成', mediaWorkCreateMeta],
			['作品の更新', mediaWorkUpdateMeta],
			['記録の作成', mediaSessionCreateMeta],
			['記録の更新', mediaSessionUpdateMeta],
			['作品コメント作成', mediaCommentCreateMeta],
			['作品コメント更新', mediaCommentUpdateMeta],
			['作品リアクション作成', mediaReactionCreateMeta],
		],
	},
	{
		profile: HATADY_RATE_LIMITS.destructive,
		endpoints: [
			['しおり削除', bookmarkDeleteMeta],
			['コメント削除', commentDeleteMeta],
			['本の削除', bookDeleteMeta],
			['目標削除', goalDeleteMeta],
			['学習記録削除', logDeleteMeta],
			['メモ削除', memoDeleteMeta],
			['科目削除', subjectDeleteMeta],
			['作品の削除', mediaWorkDeleteMeta],
			['記録の削除', mediaSessionDeleteMeta],
			['作品コメント削除', mediaCommentDeleteMeta],
			['作品リアクション解除', mediaReactionDeleteMeta],
		],
	},
	{
		profile: HATADY_RATE_LIMITS.adminDestructive,
		endpoints: [
			['管理者による本の削除', adminDeleteBookMeta],
		],
	},
] as const;

describe('Hatady API のレート制限', () => {
	test('全70エンドポイントに用途別の基準値が設定されている', () => {
		const endpoints = endpointGroups.flatMap(group => group.endpoints);
		const endpointDirectory = resolve(process.cwd(), 'src/server/api/endpoints/hata/hatady');
		const endpointFiles = readdirSync(endpointDirectory, { recursive: true })
			// _ で始まるのは共有スキーマ等でエンドポイントではない(_schemas.ts / _shared.ts)。
			.filter(path => typeof path === 'string' && path.endsWith('.ts') && !path.split('/').pop()!.startsWith('_'));

		expect(endpoints).toHaveLength(70);
		expect(endpointFiles).toHaveLength(endpoints.length);
		for (const group of endpointGroups) {
			for (const [name, meta] of group.endpoints) {
				expect(meta.requireCredential, name).toBe(true);
				expect(meta.limit, name).toBe(group.profile);
			}
		}
	});

	test('基準値は通常操作を妨げず、重い処理と削除を段階的に絞る', () => {
		expect(HATADY_RATE_LIMITS).toEqual({
			read: { duration: 60_000, max: 120 },
			heavyRead: { duration: 60_000, max: 60 },
			write: { duration: 60_000, max: 60 },
			destructive: { duration: 60_000, max: 30 },
			adminDestructive: { duration: 3_600_000, max: 30 },
		});
	});

	test('ロールのレート制限倍率が実際の上限へ反映される', async () => {
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';
		limiterOptions.length = 0;

		try {
			const service = new RateLimiterService({} as never, {
				getLogger: () => ({ debug: vi.fn() }),
			} as never);

			await service.limit({
				...HATADY_RATE_LIMITS.read,
				key: 'hata/hatady/books',
			}, 'user-a', 0.5);
			await service.limit({
				...HATADY_RATE_LIMITS.read,
				key: 'hata/hatady/books',
			}, 'user-b', 2);

			expect(limiterOptions).toHaveLength(2);
			expect(limiterOptions[0]).toMatchObject({ duration: 60_000, max: 240 });
			expect(limiterOptions[1]).toMatchObject({ duration: 60_000, max: 60 });
		} finally {
			process.env.NODE_ENV = originalNodeEnv;
		}
	});
});
