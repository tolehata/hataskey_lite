/* SPDX-License-Identifier: AGPL-3.0-only */
export class UtageRevival1790035400000 {
	name = 'UtageRevival1790035400000';
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "utage_session"
			ADD "ruleVersion" integer NOT NULL DEFAULT 0,
			ADD "revision" integer NOT NULL DEFAULT 0,
			ADD "publishedRevision" integer NOT NULL DEFAULT 0,
			ADD "revivalStartedAt" timestamptz,
			ADD "revivalExpiresAt" timestamptz,
			ADD "revivalOnlineCount" integer,
			ADD "revivalTargetCount" integer,
			ADD "revivalExcludedUserIds" varchar(32)[] NOT NULL DEFAULT '{}',
			ADD "revivalSupporterIds" varchar(32)[] NOT NULL DEFAULT '{}',
			ADD "successMethod" varchar(16)`);
		await queryRunner.query(`UPDATE "utage_session" SET "successMethod" = 'normal' WHERE "status" = 'succeeded'`);
		await queryRunner.query(`CREATE INDEX "IDX_utage_revival_deadline" ON "utage_session" ("revivalExpiresAt") WHERE "status" = 'reviving'`);
		await queryRunner.query(`CREATE INDEX "IDX_utage_pending_publication" ON "utage_session" ("id") WHERE "publishedRevision" < "revision"`);
	}
	async down(queryRunner) {
		// Downgrade must not turn an unfinished revival into a normal success.
		await queryRunner.query(`UPDATE "utage_session" SET "status" = 'failed', "resolvedAt" = now() WHERE "status" = 'reviving'`);
		await queryRunner.query(`DROP INDEX "IDX_utage_pending_publication"`);
		await queryRunner.query(`DROP INDEX "IDX_utage_revival_deadline"`);
		await queryRunner.query(`ALTER TABLE "utage_session" DROP "ruleVersion", DROP "revision", DROP "publishedRevision", DROP "revivalStartedAt", DROP "revivalExpiresAt", DROP "revivalOnlineCount", DROP "revivalTargetCount", DROP "revivalExcludedUserIds", DROP "revivalSupporterIds", DROP "successMethod"`);
	}
}
