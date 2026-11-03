/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * hataskey Lite: Hataskey(hata-13.0)から移行したDBを、Liteで新しく作ったDBと同じ形にそろえる。
 *   ⚠️Liteで撤去した機能のデータを削除する。元には戻せない（戻すときは移行前のバックアップから復元する）。
 *   ⚠️新しく作ったLiteのDBでは何も起きない（すべて IF EXISTS か、対象0件）。
 *   ⚠️hata-13.0 にも Lite にも無いマイグレーションが適用済みのDBは、何も消さずに止める。
 *   手順と確認方法の正本は MIGRATION-FROM-HATASKEY.md。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// hata-13.0 で適用済みになり、Lite には無いマイグレーション（54本）。移行後に migrations から消す。
const HATASKEY_ONLY_MIGRATIONS = [
	'AddFeedbackCenter1783000000000', 'AddFeedbackIssueNumber1783100000000', 'AddFontUploadableFileTypes1788300000000',
	'AddHataConsentColumns1774000000000', 'AddHataMascotData1783000000000', 'AddHatadintConsent1788900000000',
	'AddHatady1785000000000', 'AddHatadyBookFlags1786600000000', 'AddHatadyBookMemo1787000000000',
	'AddHatadyBookmark1786800000000', 'AddHatadyBookmarkMemo1787200000000', 'AddHatadyFollowing1786000000000',
	'AddHatadyGoal1787600000000', 'AddHatadyLogVisibility1786200000000', 'AddHatadyMedia1788100000000',
	'AddHatadyModerationReview1789250000000', 'AddHatadyNotification1785800000000', 'AddHatadyRecordAttachments1789500000000',
	'AddHatadySocial1785500000000', 'AddHatadySubject1787400000000', 'AddHatadyUserProfile1786400000000',
	'AddHataskEmotionAnalysis1788200000000', 'AddHataskEventMembers1788990000000', 'AddHataskEvents1762100000000',
	'AddHataskFlowers1788400000000', 'AddHataskRanking1788800000000', 'AddHataskRecordReview1789260000000',
	'AddHataskSupport1789080000000', 'AddLocalProfileBadges1787800000000', 'AddMascotConsent1780300000000',
	'AddUtageAchievements1788600000000', 'AddUtageSession1780200000000', 'EarthquakeNotification1784000000000',
	'ExpandHatadyLogSubject1790380200000', 'ExtendHatadyRecords1789170000000', 'FeedbackCommentThreadMark1783700000000',
	'FeedbackEmojiChanges1790035200000', 'FeedbackIssueCode1783400000000', 'FeedbackIssueIntegrity1790380300000',
	'FeedbackProjectColor1783500000000', 'FeedbackProjectGenre1783800000000', 'FeedbackProjectSuspended1783600000000',
	'Hataigo1792425600000', 'HataskAvatarDecorationRewards1790380400000', 'HataskFlowerV21790290000000',
	'HataskRecipeReferenceLinks1790380100000', 'HataskRecipes1790035500000', 'NoteCharm1792886400000',
	'NoteCharmConsent1793059200000', 'PrivateChannel1783200000000', 'PrivateChannelInvitation1787900000000',
	'PrivateChannelNoExternalRenote1783300000000', 'RecordModeration1790035300000', 'UtageRevival1790035400000',
];

// 撤去した機能だけが使っていた表（49）。
const HATASKEY_ONLY_TABLES = [
	'channel_invitation', 'channel_member', 'earthquake_notification',
	'feedback_agree', 'feedback_comment', 'feedback_comment_reaction', 'feedback_emoji_change_request', 'feedback_emoji_request',
	'feedback_issue', 'feedback_issue_moderator', 'feedback_notification', 'feedback_project',
	'hatady_book', 'hatady_book_memo', 'hatady_bookmark', 'hatady_comment', 'hatady_following', 'hatady_goal', 'hatady_log',
	'hatady_media_comment', 'hatady_media_reaction', 'hatady_media_session', 'hatady_media_work', 'hatady_moderation_review',
	'hatady_notification', 'hatady_reaction', 'hatady_subject', 'hatady_user_profile',
	'hataigo_chat_message', 'hataigo_game',
	'hatask_cooking_record', 'hatask_drop_ledger', 'hatask_drop_wallet', 'hatask_emotion_analysis', 'hatask_event',
	'hatask_flower', 'hatask_flower_discovery', 'hatask_flower_festival', 'hatask_flower_harvest', 'hatask_flower_notice',
	'hatask_flower_participant', 'hatask_flower_request', 'hatask_flower_todo', 'hatask_recipe', 'hatask_record_review', 'hatask_rsvp',
	'record_moderation_operation', 'record_moderation_tombstone', 'utage_session',
];

// Liteにもある表へHataskeyが足した列。
const HATASKEY_ONLY_COLUMNS = {
	avatar_decoration: ['availableFrom', 'availableUntil', 'requiresHataskFlowerCompletion'],
	channel: ['isPrivate', 'password'],
	meta: ['hataskFlowerRules', 'hataskSupport'],
	user: ['hataskSupporter', 'noteCharm'],
	user_profile: [
		'hataConsentCustomFont', 'hataConsentCustomFontDate', 'hataConsentDrawing', 'hataConsentDrawingDate', 'hataConsentDrawingVersion',
		'hataConsentExternalTl', 'hataConsentExternalTlDate', 'hataConsentMascot', 'hataConsentMascotDate',
		'hataConsentNoteCharm', 'hataConsentNoteCharmDate', 'hataMascotData',
		'hataskFlowerCount', 'hataskFlowerVisibility', 'hataskRankingParticipating',
		'showHataskFlowerCount', 'showUtageInterruptionCount', 'showUtageSuccessCount',
	],
};

// Liteで撤去した実績（宴・LTLパンチ・Hatady/Hataskの歓迎）。
const REMOVED_ACHIEVEMENTS = [
	'ltlPunchDefeat', 'ltlPunchVictory',
	'utageInterruption10', 'utageInterruption20', 'utageInterruption30', 'utageInterruption40', 'utageInterruption50',
	'utageInterruption60', 'utageInterruption70', 'utageInterruption80', 'utageInterruption90', 'utageInterruption100',
	'utageInterruptionWithin5Seconds',
	'utageSuccess10', 'utageSuccess20', 'utageSuccess30', 'utageSuccess40', 'utageSuccess50',
	'utageSuccess60', 'utageSuccess70', 'utageSuccess80', 'utageSuccess90', 'utageSuccess100',
	'welcomeToHatady', 'welcomeToHatask',
];

// Liteで撤去したロールのポリシー。
const REMOVED_ROLE_POLICIES = [
	'canAccessHataFeed', 'canMakePrivateChannel', 'canRequestRemoteEmoji', 'canUseHatadySync', 'canUseHatalyze',
	'canUseMascot', 'canUseNoteCharm', 'emojiRequestLimit', 'hatadyBookLimit', 'hatadyBookmarkLimit',
	'hatadyGameTitleLimit', 'mascotMaxCharacters', 'mascotMaxExpressions', 'mascotMaxPhrases',
];

// 撤去した機能が registry_item に保存していた領域。Liteが使う client/base・client/favorite_folders・clickerGame は残す。
const REMOVED_REGISTRY_SCOPES = [
	'client/hatask', 'client/hataigo', 'client/hatady', 'client/hataMascot',
	'client/hatafeed', 'client/hatagoes', 'client/hatalyze', 'client/uiAnnouncements',
];

const HATASKEY_UPLOADABLE_FILE_TYPES = '["text/*", "application/json", "image/*", "video/*", "audio/*", "font/ttf", "font/otf"]';
const LITE_UPLOADABLE_FILE_TYPES = '["text/*", "application/json", "image/*", "video/*", "audio/*"]';

// TypeORMは name プロパティ、無ければクラス名でマイグレーションを記録する。
// ⚠️name は「その行だけのクラスのフィールド」に限る（SQL中の name = '…' を拾わない）。名前には _ も入る（NoteHistory2_1725517326637）。
function liteMigrationNames() {
	const dir = dirname(fileURLToPath(import.meta.url));
	const names = new Set();
	for (const file of readdirSync(dir)) {
		if (!file.endsWith('.js')) continue;
		const source = readFileSync(join(dir, file), 'utf8');
		const name = source.match(/^\s+name = ['"]([\w$]+)['"];?\s*$/m)?.[1] ?? source.match(/export class ([\w$]+)/)?.[1];
		if (name) names.add(name);
	}
	return names;
}

async function columnExists(queryRunner, table, column) {
	const rows = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`, [table, column]);
	return rows.length > 0;
}

export class LiteMigrateFromHataskey1793100000000 {
	name = 'LiteMigrateFromHataskey1793100000000';

	async up(queryRunner) {
		// 0) 知らない版のDBでは何も消さずに止める（全体が1トランザクションなので、先に走ったものも巻き戻る）。
		const known = liteMigrationNames();
		for (const name of HATASKEY_ONLY_MIGRATIONS) known.add(name);
		const applied = (await queryRunner.query(`SELECT "name" FROM "migrations"`)).map(row => row.name);
		const unknown = applied.filter(name => !known.has(name));
		if (unknown.length > 0) {
			throw new Error(`hataskey Lite: hata-13.0 にも Lite にも無いマイグレーションが適用済みのため、移行を中止しました（何も変更していません）。Hataskey は hata-13.0 から移行してください。未知のマイグレーション: ${unknown.join(', ')}`);
		}

		// 1) 撤去した表を消す前に、共有の表に付いたトリガーを外す（残すと registry_item への書き込みが失敗する）。
		await queryRunner.query(`DROP TRIGGER IF EXISTS "enforce_record_moderation" ON "registry_item"`);

		// 2) プライベートチャンネルは投稿ごと消す（列を消すと中の投稿が公開になってしまうため）。
		if (await columnExists(queryRunner, 'channel', 'isPrivate')) {
			await queryRunner.query(`
				UPDATE "user" AS u SET "notesCount" = GREATEST(u."notesCount" - c."count", 0)
				FROM (
					SELECT n."userId", count(*)::int AS "count" FROM "note" n
					JOIN "channel" ch ON ch."id" = n."channelId" WHERE ch."isPrivate" GROUP BY n."userId"
				) AS c
				WHERE u."id" = c."userId"`);
			await queryRunner.query(`DELETE FROM "note" WHERE "channelId" IN (SELECT "id" FROM "channel" WHERE "isPrivate")`);
			await queryRunner.query(`DELETE FROM "channel" WHERE "isPrivate"`);
		}

		// 3) Hataskの報酬専用だったアバターデコレーションを消し、付けている人からも外す。
		if (await columnExists(queryRunner, 'avatar_decoration', 'requiresHataskFlowerCompletion')) {
			await queryRunner.query(`
				UPDATE "user" SET "avatarDecorations" = (
					SELECT coalesce(jsonb_agg(d ORDER BY o), '[]'::jsonb)
					FROM jsonb_array_elements("avatarDecorations") WITH ORDINALITY AS t(d, o)
					WHERE d->>'id' NOT IN (SELECT "id" FROM "avatar_decoration" WHERE "requiresHataskFlowerCompletion")
				)
				WHERE jsonb_typeof("avatarDecorations") = 'array' AND EXISTS (
					SELECT 1 FROM jsonb_array_elements("avatarDecorations") AS d
					WHERE d->>'id' IN (SELECT "id" FROM "avatar_decoration" WHERE "requiresHataskFlowerCompletion")
				)`);
			await queryRunner.query(`DELETE FROM "avatar_decoration" WHERE "requiresHataskFlowerCompletion"`);
		}

		// 4) 撤去した実績を外す（並び順は保つ）。
		await queryRunner.query(`
			UPDATE "user_profile" SET "achievements" = (
				SELECT coalesce(jsonb_agg(a ORDER BY o), '[]'::jsonb)
				FROM jsonb_array_elements("achievements") WITH ORDINALITY AS t(a, o)
				WHERE NOT (a->>'name' = ANY($1::text[]))
			)
			WHERE jsonb_typeof("achievements") = 'array' AND EXISTS (
				SELECT 1 FROM jsonb_array_elements("achievements") AS a WHERE a->>'name' = ANY($1::text[])
			)`, [REMOVED_ACHIEVEMENTS]);

		// 5) 撤去したポリシーを外し、Hataskeyが足したフォントのアップロード許可を既定どおりに戻す。
		await queryRunner.query(`UPDATE "meta" SET "policies" = "policies" - $1::text[] WHERE "policies" ?| $1::text[]`, [REMOVED_ROLE_POLICIES]);
		await queryRunner.query(`UPDATE "role" SET "policies" = "policies" - $1::text[] WHERE "policies" ?| $1::text[]`, [REMOVED_ROLE_POLICIES]);
		await queryRunner.query(`UPDATE "meta" SET "policies" = jsonb_set("policies", '{uploadableFileTypes}', '${LITE_UPLOADABLE_FILE_TYPES}'::jsonb, true) WHERE "policies"->'uploadableFileTypes' = '${HATASKEY_UPLOADABLE_FILE_TYPES}'::jsonb`);

		// 6) 撤去した機能の registry_item を消す。
		await queryRunner.query(`DELETE FROM "registry_item" WHERE "domain" IS NULL AND array_to_string("scope", '/') = ANY($1::text[])`, [REMOVED_REGISTRY_SCOPES]);

		// 7) 表・関数・連番を消す。互いに参照し合うので1文でまとめて消す（CASCADEは使わない＝想定外の依存があれば止まる）。
		await queryRunner.query(`DROP TABLE IF EXISTS ${HATASKEY_ONLY_TABLES.map(table => `"${table}"`).join(', ')}`);
		await queryRunner.query(`DROP FUNCTION IF EXISTS "enforce_hatask_record_moderation"()`);
		await queryRunner.query(`DROP FUNCTION IF EXISTS "hatask_record_identity"(text, jsonb)`);
		await queryRunner.query(`DROP SEQUENCE IF EXISTS "feedback_issue_number_seq"`);

		// 8) 共有の表から列を消す（索引・CHECK制約は先に外す）。
		await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP CONSTRAINT IF EXISTS "CHK_avatar_decoration_available_period"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP CONSTRAINT IF EXISTS "CHK_user_profile_hatask_flower_visibility"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channel_isPrivate"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_hatask_supporter"`);
		for (const [table, columns] of Object.entries(HATASKEY_ONLY_COLUMNS)) {
			await queryRunner.query(`ALTER TABLE "${table}" ${columns.map(column => `DROP COLUMN IF EXISTS "${column}"`).join(', ')}`);
		}

		// 9) Hataskeyだけのマイグレーションの記録を消し、LiteのDBと同じ並びにする。
		await queryRunner.query(`DELETE FROM "migrations" WHERE "name" = ANY($1::text[])`, [HATASKEY_ONLY_MIGRATIONS]);
	}

	async down() {
		throw new Error('hataskey Lite: Hataskeyからの移行で消したデータは戻せません。移行前のバックアップから復元してください。');
	}
}
