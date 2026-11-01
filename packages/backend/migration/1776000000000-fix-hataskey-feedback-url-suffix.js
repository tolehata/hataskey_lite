/*
 * SPDX-FileCopyrightText: hatacha and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: feedbackUrl の末尾を /issues/new から /issues に変更する追加マイグレーション。
 *
 * 1775000000000-migrate-repository-url-to-hataskey.js を既に適用済みのDB環境では
 * feedbackUrl が 'https://github.com/tolehata/hataskey/issues/new' に
 * なっているため、これを Issue 一覧ページ '/issues' に書き換える。
 *
 * 1775 のファイル自体も /issues に修正済みなので、未マイグレーション環境では 1775 のみで完結し、
 * このマイグレーション(1776)は no-op になる(WHERE 句がマッチしないため)。
 *
 * 既に管理者が独自URLを設定済みの場合は何もしない(防御的マイグレーション)。
 */
export class FixHataskeyFeedbackUrlSuffix1776000000000 {
	name = 'FixHataskeyFeedbackUrlSuffix1776000000000';

	async up(queryRunner) {
		// feedbackUrl: /issues/new → /issues(Issue一覧ページに変更)
		await queryRunner.query(`
			UPDATE "meta"
			SET "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues'
			WHERE "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues/new'
		`);
	}

	async down(queryRunner) {
		// rollback: /issues → /issues/new
		await queryRunner.query(`
			UPDATE "meta"
			SET "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues/new'
			WHERE "feedbackUrl" = 'https://github.com/tolehata/hataskey/issues'
		`);
	}
}
