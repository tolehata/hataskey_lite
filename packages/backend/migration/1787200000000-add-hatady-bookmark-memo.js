/*
 * 旗鯖fork(Hatady): しおり(hatady_bookmark)に memo カラムを追加。
 *   name は短い見出し、memo はしおりごとの自由記述の追記。既存行は NULL。
 */
export class AddHatadyBookmarkMemo1787200000000 {
	name = 'AddHatadyBookmarkMemo1787200000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" ADD "memo" character varying(2048)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" DROP COLUMN "memo"`);
	}
}
