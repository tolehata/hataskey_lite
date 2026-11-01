/* SPDX-License-Identifier: AGPL-3.0-only */
export class AddHataskRecordReview1789260000000 {
	name = 'AddHataskRecordReview1789260000000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatask_record_review" (
			"id" varchar(64) PRIMARY KEY,
			"userId" varchar(32) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
			"state" varchar(16) NOT NULL CHECK ("state" IN ('unread', 'flagged', 'reviewed')),
			"contentVersion" varchar(64) NOT NULL,
			"revision" integer NOT NULL CHECK ("revision" > 0),
			"reviewerId" varchar(32) REFERENCES "user"("id") ON DELETE SET NULL,
			"reviewedAt" timestamptz NOT NULL
		)`);
		await queryRunner.query('CREATE INDEX "IDX_hatask_review_user" ON "hatask_record_review" ("userId")');
	}

	async down() {
		throw new Error('Back up Hatask review annotations before explicitly removing this table.');
	}
}
