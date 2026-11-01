/* SPDX-License-Identifier: AGPL-3.0-only */
export class AddHataskEventMembers1788990000000 {
	name = 'AddHataskEventMembers1788990000000';
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatask_event" ADD "visibility" varchar(16) NOT NULL DEFAULT 'public', ADD "visibleUserIds" varchar(32)[] NOT NULL DEFAULT '{}'`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_event_visible_users" ON "hatask_event" USING gin ("visibleUserIds")`);
	}
	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_hatask_event_visible_users"`);
		await queryRunner.query(`ALTER TABLE "hatask_event" DROP COLUMN "visibleUserIds", DROP COLUMN "visibility"`);
	}
}
