/* SPDX-License-Identifier: AGPL-3.0-only */
export class AddHatadyRecordAttachments1789500000000 {
	name = 'AddHatadyRecordAttachments1789500000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "hatady_log" ADD "fileIds" character varying(32)[] NOT NULL DEFAULT \'{}\'');
		await queryRunner.query('ALTER TABLE "hatady_media_session" ADD "fileIds" character varying(32)[] NOT NULL DEFAULT \'{}\'');
	}

	async down() {
		throw new Error('Hatady attachment rollback requires an explicit attachment reference backup; no data was removed.');
	}
}
