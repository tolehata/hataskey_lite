/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: hata-11.5 で Forgejo (code.tolehata.net) を閉鎖し
 * GitHub (github.com/tolehata/hataskey) に移行したため、meta テーブルの
 * repositoryUrl / feedbackUrl を新URLに再書換する。
 *
 * 既存マイグレ (1775/1776) は履歴保存のため変更せず、追加で上書きする方式を採用。
 * Forgejo がメタクローラー(meta-webindexer 等)の攻撃で閉鎖を余儀なくされたため、
 * 旧URLは現在 404 を返す状態。早期に新URL反映が必要。
 */
export class MigrateRepositoryUrlToGitHub1782000000000 {
	name = 'MigrateRepositoryUrlToGitHub1782000000000';

	async up(queryRunner) {
		// 旧Forgejo URL を新GitHub URL に書換
		await queryRunner.query(`
			UPDATE "meta"
			SET "repositoryUrl" = 'https://github.com/tolehata/hataskey'
			WHERE "repositoryUrl" = 'https://code.tolehata.net/hatacha/cherrypick-hata'
		`);
		await queryRunner.query(`
			UPDATE "meta"
			SET "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues'
			WHERE "feedbackUrl" IN (
				'https://code.tolehata.net/hatacha/cherrypick-hata/issues',
				'https://code.tolehata.net/hatacha/cherrypick-hata/issues/new'
			)
		`);
	}

	async down(queryRunner) {
		// Forgejoはもう閉鎖されているため、ロールバックしてもアクセス不可。no-op。
	}
}
