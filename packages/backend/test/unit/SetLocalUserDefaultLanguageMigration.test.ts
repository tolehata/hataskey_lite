/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { SetLocalUserDefaultLanguage1788000000000 } from '../../migration/1788000000000-set-local-user-default-language.js';

describe('SetLocalUserDefaultLanguage1788000000000', () => {
	test('未設定のローカルユーザーだけをja-JPへ補正する', async () => {
		const query = vi.fn();
		const migration = new SetLocalUserDefaultLanguage1788000000000();

		await migration.up({ query });

		expect(query).toHaveBeenCalledOnce();
		const sql = String(query.mock.calls[0][0]);
		expect(sql).toContain('SET "lang" = \'ja-JP\'');
		expect(sql).toContain('"account"."host" IS NULL');
		expect(sql).toContain('"profile"."lang" IS NULL OR btrim("profile"."lang") = \'\'');
	});

	test('downは既存のja-JPを消さない', async () => {
		const query = vi.fn();
		const migration = new SetLocalUserDefaultLanguage1788000000000();

		await migration.down({ query });

		expect(query).not.toHaveBeenCalled();
	});
});
