/* SPDX-License-Identifier: AGPL-3.0-only */
// HataSNSCordUI の廃止に伴い、保存済みの基本ポリシーとロールポリシーから専用キーを取り除く。
export class RemoveHatacordingUiPolicies1790035600000 {
	name = 'RemoveHatacordingUiPolicies1790035600000';
	async up(queryRunner) {
		const keys = `'canUseHatacordingUi', 'hatacordingUiSubpaneMaxTabs', 'hatacordingUiRateLimit', 'canBypassHatacordingUiRateLimit'`;
		await queryRunner.query(`UPDATE "meta" SET "policies" = "policies" - ARRAY[${keys}]::text[] WHERE "policies" ?| ARRAY[${keys}]::text[]`);
		await queryRunner.query(`UPDATE "role" SET "policies" = "policies" - ARRAY[${keys}]::text[] WHERE "policies" ?| ARRAY[${keys}]::text[]`);
	}
	async down() {
		// 削除した値は復元できない。旧版はキーが無ければ既定値で動作する。
	}
}
