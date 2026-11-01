/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
旗鯖fork: 花常のプレイ状況（⚠️**集計のみ**）。

⚠️利用者の裁定（2026-07-31）で「**集計のみ・個人を出さない**」と決めた。
⚠️**この方針を後から緩めないこと。** 理由は2つ:
  ①CONSTRAINTS が**ランキングを禁止**している。個人の進行を並べた画面は、
    管理者向けであっても**形がランキングそのもの**になる。
  ②「どの物語をどこまで読んだか」は**閲覧履歴の性質**を持つ。個人と結びつけて見せるべきではない。

⚠️そのための作りとして、**この実装は `userId` を1度も読まない**。
  ⚠️`select` に userId を入れない。⚠️プレイ人数は「`key='progress'` の行数」で数える
  （1ユーザーにつき1行なので、識別子を触らずに人数が出せる）。
  ⚠️ここに userId を足すと、上の約束が**コードの上でも**崩れる。足さないこと。
*/

import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { RegistryItemsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

/** ⚠️花常の保存領域。`storage.ts` の `HANA_AWASE_SCOPE` と同じでなければ何も取れない。 */
const HANAAWASE_SCOPE = ['client', 'hanaawase'];

export const meta = {
	tags: ['admin', 'games'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	// ⚠️`read:admin:show-users` は**存在しない**種別だった（実在一覧に無い）。
	// ⚠️新しい種別を足すと SDK 再生成が要る＝CONSTRAINTS で禁止。⚠️既存の種別から選ぶこと。
	// ⚠️イベント索引の管理APIが `write:admin:meta` なので、読み取り側はこれに揃える。
	kind: 'read:admin:meta',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			players: { type: 'number', optional: false, nullable: false },
			dailyPlayers: { type: 'number', optional: false, nullable: false },
			eventPlayers: { type: 'number', optional: false, nullable: false },
			/** 月ごとの「1つでも星を取った人数」。添字は1〜12。 */
			monthReach: { type: 'array', optional: false, nullable: false, items: { type: 'number' } },
			/** 星の数ごとの面の延べ数。添字0が星1、1が星2、2が星3。 */
			starTotals: { type: 'array', optional: false, nullable: false, items: { type: 'number' } },
			/** 読んだ場面数の分布（0本 / 1〜9 / 10〜29 / 30〜59 / 60本以上）。 */
			storyBuckets: { type: 'array', optional: false, nullable: false, items: { type: 'number' } },
			dailyPlays: { type: 'number', optional: false, nullable: false },
			dailyLongest: { type: 'number', optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** ⚠️面id（例 `m1-1`）から月を取る。取れなければ 0（＝どの月にも数えない）。 */
function monthOfStage(stageId: string): number {
	const matched = /^m(\d{1,2})-/.exec(stageId);
	if (matched == null) return 0;
	const month = Number(matched[1]);
	return month >= 1 && month <= 12 ? month : 0;
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
	) {
		super(meta, paramDef, async () => {
			// ⚠️`key` と `value` だけを引く。⚠️userId は**選ばない**（上のコメントの約束）。
			const rows = await this.registryItemsRepository.createQueryBuilder('item')
				.select(['item.key', 'item.value'])
				.where('item.domain IS NULL')
				.andWhere('item.scope = :scope', { scope: HANAAWASE_SCOPE })
				.andWhere('item.key IN (:...keys)', { keys: ['progress', 'daily', 'events'] })
				.getMany();

			const monthReach = Array.from({ length: 13 }, () => 0); // 添字0は使わない
			const starTotals = [0, 0, 0];
			const storyBuckets = [0, 0, 0, 0, 0];
			let players = 0;
			let dailyPlayers = 0;
			let eventPlayers = 0;
			let dailyPlays = 0;
			let dailyLongest = 0;

			for (const row of rows) {
				const value = row.value;
				if (!isRecord(value)) continue;

				if (row.key === 'progress') {
					// ⚠️1ユーザーにつき1行なので、行数がそのままプレイ人数になる。
					players++;

					const reached = new Set<number>();
					if (isRecord(value.stars)) {
						for (const [stageId, star] of Object.entries(value.stars)) {
							if (typeof star !== 'number' || star < 1) continue;
							if (star >= 1 && star <= 3) starTotals[star - 1]++;
							const month = monthOfStage(stageId);
							if (month > 0) reached.add(month);
						}
					}
					for (const month of reached) monthReach[month]++;

					const seen = Array.isArray(value.vignettesSeen) ? value.vignettesSeen.length : 0;
					// ⚠️人数の少ない層が個人を指してしまわないよう、**幅で丸めて**返す。
					const bucket = seen === 0 ? 0 : seen < 10 ? 1 : seen < 30 ? 2 : seen < 60 ? 3 : 4;
					storyBuckets[bucket]++;
				} else if (row.key === 'daily') {
					const plays = typeof value.plays === 'number' ? value.plays : 0;
					if (plays > 0) dailyPlayers++;
					dailyPlays += plays;
					const longest = typeof value.longest === 'number' ? value.longest : 0;
					if (longest > dailyLongest) dailyLongest = longest;
				} else if (row.key === 'events') {
					// ⚠️イベントに1つでも記録があれば「参加した人」として数える。中身は出さない。
					if (isRecord(value.byEvent) && Object.keys(value.byEvent).length > 0) eventPlayers++;
				}
			}

			return {
				players,
				dailyPlayers,
				eventPlayers,
				monthReach: monthReach.slice(1),
				starTotals,
				storyBuckets,
				dailyPlays,
				dailyLongest,
			};
		});
	}
}
