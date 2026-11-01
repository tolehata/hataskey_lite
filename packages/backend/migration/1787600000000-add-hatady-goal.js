/*
 * 旗鯖fork(Hatady): 学習目標(hatady_goal)テーブルを追加。
 *   短期/長期(termType)・任意の期限(targetDate)・自動計測(metricType/metricTarget)・達成状態(done/doneAt)。
 */
export class AddHatadyGoal1787600000000 {
	name = 'AddHatadyGoal1787600000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_goal" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(256) NOT NULL, "description" character varying(2048), "termType" character varying(8) NOT NULL DEFAULT 'short', "targetDate" TIMESTAMP WITH TIME ZONE, "metricType" character varying(16), "metricTarget" integer, "done" boolean NOT NULL DEFAULT false, "doneAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_hatady_goal" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_goal_userId" ON "hatady_goal" ("userId")`);
		await queryRunner.query(`ALTER TABLE "hatady_goal" ADD CONSTRAINT "FK_hatady_goal_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_goal" DROP CONSTRAINT "FK_hatady_goal_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_goal"`);
	}
}
