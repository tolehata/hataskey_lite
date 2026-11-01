/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ExpandHatadyLogSubject1790380200000 {
	name = 'ExpandHatadyLogSubject1790380200000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_log" ALTER COLUMN "subject" TYPE character varying(128)`);
	}

	async down(queryRunner) {
		const rows = await queryRunner.query(`SELECT 1 FROM "hatady_log" WHERE char_length("subject") > 64 LIMIT 1`);
		if (rows.length > 0) throw new Error('Cannot reduce hatady_log.subject to 64 characters while longer values exist');
		await queryRunner.query(`ALTER TABLE "hatady_log" ALTER COLUMN "subject" TYPE character varying(64)`);
	}
}
