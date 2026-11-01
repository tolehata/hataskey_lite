/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { meta as adminMeta } from '@/server/api/endpoints/admin/meta.js';
import { meta as updateMeta } from '@/server/api/endpoints/admin/update-meta.js';
import { meta as resetPasswordMeta } from '@/server/api/endpoints/admin/reset-password.js';
import { meta as unsetMfaMeta } from '@/server/api/endpoints/admin/unset-mfa.js';
import { meta as hatadyAdminBooksMeta } from '@/server/api/endpoints/hata/hatady/admin/books.js';
import { meta as hatadyAdminDeleteBookMeta } from '@/server/api/endpoints/hata/hatady/admin/delete-book.js';

describe('機密性の高い管理API', () => {
	test.each([
		['管理設定の取得', adminMeta],
		['管理設定の更新', updateMeta],
		['パスワード再発行', resetPasswordMeta],
		['二要素認証解除', unsetMfaMeta],
		['Hatady管理一覧', hatadyAdminBooksMeta],
		['Hatady管理削除', hatadyAdminDeleteBookMeta],
	])('%s は外部アプリ用トークンから呼べない', (_name, meta) => {
		expect(meta.requireCredential).toBe(true);
		expect(meta.secure).toBe(true);
		expect(meta.requireAdmin === true || meta.requireModerator === true).toBe(true);
	});
});
