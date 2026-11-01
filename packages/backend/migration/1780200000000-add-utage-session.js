export class AddUtageSession1780200000000 {
    name = 'AddUtageSession1780200000000'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "utage_session" ("id" character varying(32) NOT NULL, "noteId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'running', "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_utage_session" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_utage_session_noteId" ON "utage_session" ("noteId")`);
        await queryRunner.query(`CREATE INDEX "IDX_utage_session_userId" ON "utage_session" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_utage_session_expiresAt" ON "utage_session" ("expiresAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_utage_session_status" ON "utage_session" ("status")`);
        await queryRunner.query(`ALTER TABLE "utage_session" ADD CONSTRAINT "FK_utage_session_noteId" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "utage_session" ADD CONSTRAINT "FK_utage_session_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "utage_session" DROP CONSTRAINT "FK_utage_session_userId"`);
        await queryRunner.query(`ALTER TABLE "utage_session" DROP CONSTRAINT "FK_utage_session_noteId"`);
        await queryRunner.query(`DROP TABLE "utage_session"`);
    }
}
