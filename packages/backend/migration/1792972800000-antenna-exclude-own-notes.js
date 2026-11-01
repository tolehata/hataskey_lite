/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AntennaExcludeOwnNotes1792972800000 {
	name = 'AntennaExcludeOwnNotes1792972800000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "antenna" ADD "excludeOwnNotes" boolean NOT NULL DEFAULT false');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "antenna" DROP COLUMN "excludeOwnNotes"');
	}
}
