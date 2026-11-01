/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: Hatask感情分析の集計結果。
 */
export class AddHataskEmotionAnalysis1788200000000 {
	name = 'AddHataskEmotionAnalysis1788200000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatask_emotion_analysis" (
			"id" varchar(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"userId" varchar(32) NOT NULL,
			"analysisVersion" varchar(64) NOT NULL,
			"lexiconVersion" varchar(64) NOT NULL,
			"scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
			"source" jsonb NOT NULL DEFAULT '{}'::jsonb,
			"summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
			"result" jsonb NOT NULL DEFAULT '{}'::jsonb,
			CONSTRAINT "PK_hatask_emotion_analysis" PRIMARY KEY ("id"),
			CONSTRAINT "FK_hatask_emotion_analysis_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "CHK_hatask_emotion_analysis_scope_object" CHECK (jsonb_typeof("scope") = 'object'),
			CONSTRAINT "CHK_hatask_emotion_analysis_source_object" CHECK (jsonb_typeof("source") = 'object'),
			CONSTRAINT "CHK_hatask_emotion_analysis_summary_object" CHECK (jsonb_typeof("summary") = 'object'),
			CONSTRAINT "CHK_hatask_emotion_analysis_result_object" CHECK (jsonb_typeof("result") = 'object')
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_emotion_analysis_user_created" ON "hatask_emotion_analysis" ("userId", "createdAt" DESC, "id" DESC)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_hatask_emotion_analysis_user_created"`);
		await queryRunner.query(`DROP TABLE "hatask_emotion_analysis"`);
	}
}
