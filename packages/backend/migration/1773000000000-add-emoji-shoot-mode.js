export class AddEmojiShootMode1773000000000 {
	name = 'AddEmojiShootMode1773000000000';
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji_shoot_record" ADD "mode" varchar(32) NOT NULL DEFAULT 'normal'`);
		await queryRunner.query(`CREATE INDEX "IDX_emoji_shoot_record_mode" ON "emoji_shoot_record" ("mode")`);
	}
	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_emoji_shoot_record_mode"`);
		await queryRunner.query(`ALTER TABLE "emoji_shoot_record" DROP COLUMN "mode"`);
	}
}
