export class AddHataConsentColumns1774000000000 {
	name = 'AddHataConsentColumns1774000000000';
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentExternalTl" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentExternalTl" IS '外部TL使用同意フラグ'`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentExternalTlDate" timestamp with time zone`);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentExternalTlDate" IS '外部TL同意日時'`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentCustomFont" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentCustomFont" IS 'カスタムフォント免責同意フラグ'`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentCustomFontDate" timestamp with time zone`);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentCustomFontDate" IS 'カスタムフォント免責同意日時'`);
	}
	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentCustomFontDate"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentCustomFont"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentExternalTlDate"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentExternalTl"`);
	}
}
