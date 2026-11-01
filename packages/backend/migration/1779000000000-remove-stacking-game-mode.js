/*
 * SPDX-FileCopyrightText: hatacha and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: つみつみタワー(stacking-game)から「絵文字モード」(gameMode)を撤去する。
 *
 * 本家の絵文字系ゲームに倣い、ゲームで使用する絵文字を Unicode 絵文字のみに統一したため、
 * custom / unicode / mix といった絵文字モードの概念を廃止する。
 * これに伴い、スコア記録(stacking_game_record)および対戦ルーム(stacking_game_room)から
 * gameMode カラムを削除する。
 *
 * 注意: up を適用すると、過去のスコア記録に紐づく gameMode 値(どのモードで記録されたか)は
 * 失われる。down ではカラムを復活できるが、各行の元の値は復元できない
 * (record は 'unicode'、room は 'custom' で一律に埋める)。
 */
export class RemoveStackingGameMode1779000000000 {
	name = 'RemoveStackingGameMode1779000000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "stacking_game_record" DROP COLUMN "gameMode"`);
		await queryRunner.query(`ALTER TABLE "stacking_game_room" DROP COLUMN "gameMode"`);
	}

	async down(queryRunner) {
		// record: 元は varchar(128) NOT NULL (デフォルトなし)
		// 既存行を NOT NULL で埋めるため、一旦デフォルト付きで追加 → デフォルト除去
		await queryRunner.query(`ALTER TABLE "stacking_game_record" ADD "gameMode" varchar(128) NOT NULL DEFAULT 'unicode'`);
		await queryRunner.query(`ALTER TABLE "stacking_game_record" ALTER COLUMN "gameMode" DROP DEFAULT`);

		// room: 元は varchar(64) NOT NULL DEFAULT 'custom'
		await queryRunner.query(`ALTER TABLE "stacking_game_room" ADD "gameMode" varchar(64) NOT NULL DEFAULT 'custom'`);
	}
}
