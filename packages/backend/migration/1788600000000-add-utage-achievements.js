/*
 * 旗鯖fork: 宴の成功・阻止回数に応じた10回刻みの実績を追加する。
 * 既存データは、プロフィール表示の集計と同じく現存するpublicノートだけを対象にする。
 */
export class AddUtageAchievements1788600000000 {
	name = 'AddUtageAchievements1788600000000'

	async up(queryRunner) {
		// 既存行は false のままにし、早期阻止実績はこの更新後に確定したイベントだけを対象にする。
		await queryRunner.query(`ALTER TABLE "utage_session" ADD "interruptedWithin5Seconds" boolean NOT NULL DEFAULT false`);

		await queryRunner.query(`
			WITH thresholds AS (
				SELECT generate_series(10, 100, 10)::integer AS threshold
			),
			success_counts AS (
				SELECT session."userId", COUNT(*)::integer AS count
				FROM "utage_session" AS session
				INNER JOIN "note" ON "note"."id" = session."noteId"
				WHERE session."status" = 'succeeded' AND "note"."visibility" = 'public'
				GROUP BY session."userId"
			),
			interruption_counts AS (
				SELECT session."interruptedByUserId" AS "userId", COUNT(*)::integer AS count
				FROM "utage_session" AS session
				INNER JOIN "note" ON "note"."id" = session."noteId"
				WHERE session."status" = 'failed'
					AND session."interruptedByUserId" IS NOT NULL
					AND "note"."visibility" = 'public'
				GROUP BY session."interruptedByUserId"
			),
			candidates AS (
				SELECT counts."userId", 'utageSuccess' || thresholds.threshold::text AS name
				FROM success_counts AS counts
				CROSS JOIN thresholds
				WHERE counts.count >= thresholds.threshold
				UNION ALL
				SELECT counts."userId", 'utageInterruption' || thresholds.threshold::text AS name
				FROM interruption_counts AS counts
				CROSS JOIN thresholds
				WHERE counts.count >= thresholds.threshold
			),
			additions AS (
				SELECT profile."userId", jsonb_agg(jsonb_build_object(
					'name', candidates.name,
					'unlockedAt', (extract(epoch FROM clock_timestamp()) * 1000)::bigint
				) ORDER BY candidates.name) AS achievements
				FROM candidates
				INNER JOIN "user_profile" AS profile ON profile."userId" = candidates."userId"
				WHERE profile."userHost" IS NULL
					AND jsonb_typeof(profile."achievements") = 'array'
					AND NOT EXISTS (
						SELECT 1
						FROM jsonb_array_elements(profile."achievements") AS existing
						WHERE existing->>'name' = candidates.name
					)
				GROUP BY profile."userId"
			)
			UPDATE "user_profile" AS profile
			SET "achievements" = profile."achievements" || additions.achievements
			FROM additions
			WHERE profile."userId" = additions."userId"
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			UPDATE "user_profile" AS profile
			SET "achievements" = COALESCE((
				SELECT jsonb_agg(existing)
				FROM jsonb_array_elements(profile."achievements") AS existing
				WHERE existing->>'name' NOT LIKE 'utageSuccess%'
					AND existing->>'name' NOT LIKE 'utageInterruption%'
			), '[]'::jsonb)
			WHERE jsonb_typeof(profile."achievements") = 'array'
		`);
		await queryRunner.query(`ALTER TABLE "utage_session" DROP COLUMN "interruptedWithin5Seconds"`);
	}
}
