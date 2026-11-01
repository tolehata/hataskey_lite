/*
 * 旗鯖fork: 言語未設定の既存ローカルユーザーを日本語へ補正する。
 * リモートユーザーと、既に言語を選択しているユーザーは変更しない。
 */
export class SetLocalUserDefaultLanguage1788000000000 {
	name = 'SetLocalUserDefaultLanguage1788000000000'

	async up(queryRunner) {
		await queryRunner.query(`UPDATE "user_profile" AS "profile" SET "lang" = 'ja-JP' FROM "user" AS "account" WHERE "profile"."userId" = "account"."id" AND "account"."host" IS NULL AND ("profile"."lang" IS NULL OR btrim("profile"."lang") = '')`);
	}

	async down() {
		// 既存の ja-JP と今回補正した値は区別できないため、不可逆な巻き戻しは行わない。
	}
}
