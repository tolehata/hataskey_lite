/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: メンテナンスカテゴリのお知らせに進捗バー(4段階)を追加するためのカラム拡張。
 * - progressSteps: 4段階のラベル配列 (jsonb, 例: ["停止", "バックアップ", "適用", "再開"])
 *   null の場合はこの機能を使わない(従来通りのお知らせ表示)
 * - progressCompleted: 各段階の完了状態 (jsonb, boolean[4])
 *   null の場合は全段階未完了として扱う
 */
export class AddMaintenanceProgressToAnnouncement1780000000000 {
	name = 'AddMaintenanceProgressToAnnouncement1780000000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" ADD "progressSteps" jsonb DEFAULT NULL`);
		await queryRunner.query(`ALTER TABLE "announcement" ADD "progressCompleted" jsonb DEFAULT NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "progressCompleted"`);
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "progressSteps"`);
	}
}
