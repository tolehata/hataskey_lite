/*
 * 旗鯖fork: 花常イベントの開催期間を管理画面から安全に変更できるよう、
 * サーバー設定へ公開用イベント索引を追加する。
 */
export class AddHanaawaseEventIndex1787700000000 {
	name = 'AddHanaawaseEventIndex1787700000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "hanaawaseEventIndex" jsonb NOT NULL DEFAULT '{"v":1,"events":[{"id":"mago-no-inuma","title":"孫の居ぬ間になんとやら","rev":1,"runs":[{"start":"2026-08-01T00:00+09:00","end":"2026-08-18T00:00+09:00","label":"初回"}],"archiveFrom":"2026-08-18T00:00+09:00"}]}'::jsonb`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "hanaawaseEventIndex"`);
	}
}
