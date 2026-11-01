/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddHataskRanking1788800000000 {
	name = 'AddHataskRanking1788800000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataskRankingParticipating" boolean NOT NULL DEFAULT true');
		await queryRunner.query('CREATE INDEX "IDX_utage_session_resolved_status" ON "utage_session" ("resolvedAt", "status")');
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX "IDX_utage_session_resolved_status"');
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataskRankingParticipating"');
	}
}
