export class AddMascotConsent1780300000000 {
    name = 'AddMascotConsent1780300000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentMascot" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentMascot" IS 'マスコット機能免責同意フラグ'`);
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataConsentMascotDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataConsentMascotDate" IS 'マスコット機能同意日時'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentMascotDate"`);
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataConsentMascot"`);
    }
}
