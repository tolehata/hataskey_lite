/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class Hataigo1792425600000 {
	name = 'Hataigo1792425600000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hataigo_game" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE, "endedAt" TIMESTAMP WITH TIME ZONE, "user1Id" character varying(32), "user2Id" character varying(32), "black" smallint, "phase" character varying(16) NOT NULL DEFAULT 'waiting', "settings" jsonb NOT NULL, "user1Ready" boolean NOT NULL DEFAULT false, "user2Ready" boolean NOT NULL DEFAULT false, "isInvitation" boolean NOT NULL DEFAULT false, "invitationAccepted" boolean NOT NULL DEFAULT true, "result" jsonb, "announcements" jsonb NOT NULL DEFAULT '{"user1":{"enabled":false,"visibility":"home","allowName":false},"user2":{"enabled":false,"visibility":"home","allowName":false}}', "announcementState" jsonb NOT NULL DEFAULT '{"user1":{"status":"none","text":null,"noteId":null,"attempts":0,"nextAttemptAtMs":0,"lastError":null},"user2":{"status":"none","text":null,"noteId":null,"attempts":0,"nextAttemptAtMs":0,"lastError":null}}', "actions" jsonb NOT NULL DEFAULT '[]', "clockState" jsonb, "deadlineAt" TIMESTAMP WITH TIME ZONE, "visibility" jsonb NOT NULL, "allowSpectate" boolean NOT NULL DEFAULT false, "allowSpectatorChat" boolean NOT NULL DEFAULT false, "publicAfterEnd" boolean NOT NULL DEFAULT false, "revision" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_1bd13262b4ee806ae46bd138a05" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_47d73c4dbc0b773bab5a6d4c91" ON "hataigo_game" ("user1Id", "phase")`);
		await queryRunner.query(`CREATE INDEX "IDX_ec4f9e36fc7205be364c924202" ON "hataigo_game" ("user2Id", "phase")`);
		await queryRunner.query(`CREATE INDEX "IDX_994dd963b4376eec124a94f088" ON "hataigo_game" ("phase", "deadlineAt")`);
		await queryRunner.query(`CREATE TABLE "hataigo_chat_message" ("id" character varying(32) NOT NULL, "gameId" character varying(32) NOT NULL, "userId" character varying(32), "text" character varying(500), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "policyVersion" character varying(100) NOT NULL, "deletedAt" TIMESTAMP WITH TIME ZONE, "deletedById" character varying(32), "deletionReason" character varying(16), CONSTRAINT "PK_hataigo_chat_message" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hataigo_chat_game_id" ON "hataigo_chat_message" ("gameId", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hataigo_chat_expires" ON "hataigo_chat_message" ("expiresAt")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "hataigo_chat_message"`);
		await queryRunner.query(`DROP TABLE "hataigo_game"`);
	}
}
