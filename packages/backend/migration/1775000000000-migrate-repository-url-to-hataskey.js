/*
 * SPDX-FileCopyrightText: hatacha and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: Meta テーブルの repositoryUrl / feedbackUrl が
 * CherryPick 本家GitHub URL のままになっている場合、Hataskey 公式リポジトリ
 * (code.tolehata.net) の URL に書き換える。
 *
 * 既に管理者が独自URLを設定済みの場合は何もしない(防御的マイグレーション)。
 */
export class MigrateRepositoryUrlToHataskey1775000000000 {
	name = 'MigrateRepositoryUrlToHataskey1775000000000';

	async up(queryRunner) {
		// repositoryUrl: GitHub 本家URL → Hataskey 公式URL
		await queryRunner.query(`
			UPDATE "meta"
			SET "repositoryUrl" = 'https://github.com/tolehata/hataskey'
			WHERE "repositoryUrl" = 'https://github.com/kokonect-link/cherrypick'
		`);

		// feedbackUrl: GitHub 本家URL(/issues/new) → Hataskey 公式URL(/issues)
		await queryRunner.query(`
			UPDATE "meta"
			SET "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues'
			WHERE "feedbackUrl" = 'https://github.com/kokonect-link/cherrypick/issues/new'
		`);
	}

	async down(queryRunner) {
		// rollback: Hataskey 公式URL → GitHub 本家URL に戻す
		// (※ 管理者が独自に Hataskey URL を設定していた場合は判別不能のため、
		//   一律で本家URLに戻る点に注意)
		await queryRunner.query(`
			UPDATE "meta"
			SET "repositoryUrl" = 'https://github.com/kokonect-link/cherrypick'
			WHERE "repositoryUrl" = 'https://github.com/tolehata/hataskey'
		`);

		await queryRunner.query(`
			UPDATE "meta"
			SET "feedbackUrl" = 'https://github.com/kokonect-link/cherrypick/issues/new'
			WHERE "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues'
		`);
	}
}
