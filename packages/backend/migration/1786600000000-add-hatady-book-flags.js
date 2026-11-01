/*
 * 旗鯖fork: Hatady の本に お気に入り(isFavorite) / おすすめ(isRecommended) / 読了日(finishedAt) を追加。
 *   ソート(読了日)・お気に入り上位表示・プロフィールのおすすめ本セクション用。
 */
export class AddHatadyBookFlags1786600000000 {
	name = 'AddHatadyBookFlags1786600000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_book" ADD "isFavorite" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "hatady_book" ADD "isRecommended" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "hatady_book" ADD "finishedAt" TIMESTAMP WITH TIME ZONE`);
		// 既存の読了本は updatedAt を読了日として初期化しておく。
		await queryRunner.query(`UPDATE "hatady_book" SET "finishedAt" = "updatedAt" WHERE "status" = 'finished'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_book" DROP COLUMN "finishedAt"`);
		await queryRunner.query(`ALTER TABLE "hatady_book" DROP COLUMN "isRecommended"`);
		await queryRunner.query(`ALTER TABLE "hatady_book" DROP COLUMN "isFavorite"`);
	}
}
