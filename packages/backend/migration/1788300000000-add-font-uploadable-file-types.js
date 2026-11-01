/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 従来の既定値をそのまま使っているサーバーに限り、
 * TrueType/OpenType フォントの MIME タイプを追加する。
 * 管理者が独自に変更した許可リストは書き換えない。
 */
export class AddFontUploadableFileTypes1788300000000 {
	name = 'AddFontUploadableFileTypes1788300000000'

	async up(queryRunner) {
		await queryRunner.query(`UPDATE "meta"
			SET "policies" = jsonb_set(
				"policies",
				'{uploadableFileTypes}',
				'["text/*", "application/json", "image/*", "video/*", "audio/*", "font/ttf", "font/otf"]'::jsonb,
				true
			)
			WHERE "policies"->'uploadableFileTypes' = '["text/*", "application/json", "image/*", "video/*", "audio/*"]'::jsonb`);
	}

	async down(queryRunner) {
		await queryRunner.query(`UPDATE "meta"
			SET "policies" = jsonb_set(
				"policies",
				'{uploadableFileTypes}',
				'["text/*", "application/json", "image/*", "video/*", "audio/*"]'::jsonb,
				true
			)
			WHERE "policies"->'uploadableFileTypes' = '["text/*", "application/json", "image/*", "video/*", "audio/*", "font/ttf", "font/otf"]'::jsonb`);
	}
}
