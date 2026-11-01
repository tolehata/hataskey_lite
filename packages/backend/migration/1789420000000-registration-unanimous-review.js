/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RegistrationUnanimousReview1789420000000 {
	name = 'RegistrationUnanimousReview1789420000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "reviewVotes" jsonb NOT NULL DEFAULT '{}'::jsonb`);
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "reviewVersion" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "reviewDecision" jsonb`);
		await queryRunner.query(`ALTER TABLE "registration_application" ADD CONSTRAINT "CHK_registration_review_votes_object" CHECK (jsonb_typeof("reviewVotes") = 'object')`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" DROP CONSTRAINT "CHK_registration_review_votes_object"`);
		await queryRunner.query(`ALTER TABLE "registration_application" DROP COLUMN "reviewDecision", DROP COLUMN "reviewVersion", DROP COLUMN "reviewVotes"`);
	}
}
