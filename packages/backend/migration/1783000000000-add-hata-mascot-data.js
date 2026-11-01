export class AddHataMascotData1783000000000 {
    name = 'AddHataMascotData1783000000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataMascotData" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_profile"."hataMascotData" IS '旗鯖マスコット機能のデータ(キャラ・表情・文言)'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataMascotData"`);
    }
}
