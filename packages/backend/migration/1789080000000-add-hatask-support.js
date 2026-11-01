/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddHataskSupport1789080000000 {
	name = 'AddHataskSupport1789080000000';

	async up(queryRunner) {
		const settings = { enabled: false, platform: '', url: '', manageUrl: '', intro: '', bannerTitle: 'ご支援ありがとうございます！', bannerMessage: 'みなさんのご支援が、\nサーバーの運営を支えています。\nいつもこの場所を大切にしてくださり、\nありがとうございます', bannerVisible: true, benefits: [] };
		await queryRunner.query(`ALTER TABLE "meta" ADD "hataskSupport" jsonb NOT NULL DEFAULT '${JSON.stringify(settings).replaceAll("'", "''")}'`);
		await queryRunner.query('ALTER TABLE "user" ADD "hataskSupporter" boolean NOT NULL DEFAULT false');
		await queryRunner.query('CREATE INDEX "IDX_user_hatask_supporter" ON "user" ("hataskSupporter", "id")');
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX "IDX_user_hatask_supporter"');
		await queryRunner.query('ALTER TABLE "user" DROP COLUMN "hataskSupporter"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "hataskSupport"');
	}
}
