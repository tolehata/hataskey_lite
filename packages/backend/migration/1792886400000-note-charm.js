/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteCharm1792886400000 {
	name = 'NoteCharm1792886400000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user" ADD "noteCharm" jsonb');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user" DROP COLUMN "noteCharm"');
	}
}
