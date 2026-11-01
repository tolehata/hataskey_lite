export class AddHataskEvents1762100000000 {
    name = 'AddHataskEvents1762100000000'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "hatask_event" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(256) NOT NULL, "emoji" character varying(32) NOT NULL DEFAULT '📅', "date" character varying(16) NOT NULL, "dateEnd" character varying(16) NOT NULL DEFAULT '', "timeStart" character varying(8) NOT NULL DEFAULT '', "timeEnd" character varying(8) NOT NULL DEFAULT '', "allDay" boolean NOT NULL DEFAULT false, "color" character varying(16) NOT NULL DEFAULT '#e27d60', "rsvpClosed" boolean NOT NULL DEFAULT false, "rsvp" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_hatask_event" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_hatask_event_userId" ON "hatask_event" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_hatask_event_date" ON "hatask_event" ("date")`);
        await queryRunner.query(`ALTER TABLE "hatask_event" ADD CONSTRAINT "FK_hatask_event_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "hatask_rsvp" ("id" character varying(32) NOT NULL, "eventId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "status" character varying(16) NOT NULL, "respondedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_hatask_rsvp" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_hatask_rsvp_eventId" ON "hatask_rsvp" ("eventId")`);
        await queryRunner.query(`CREATE INDEX "IDX_hatask_rsvp_userId" ON "hatask_rsvp" ("userId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatask_rsvp_eventId_userId" ON "hatask_rsvp" ("eventId", "userId")`);
        await queryRunner.query(`ALTER TABLE "hatask_rsvp" ADD CONSTRAINT "FK_hatask_rsvp_eventId" FOREIGN KEY ("eventId") REFERENCES "hatask_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hatask_rsvp" ADD CONSTRAINT "FK_hatask_rsvp_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "hatask_rsvp" DROP CONSTRAINT "FK_hatask_rsvp_userId"`);
        await queryRunner.query(`ALTER TABLE "hatask_rsvp" DROP CONSTRAINT "FK_hatask_rsvp_eventId"`);
        await queryRunner.query(`DROP TABLE "hatask_rsvp"`);
        await queryRunner.query(`ALTER TABLE "hatask_event" DROP CONSTRAINT "FK_hatask_event_userId"`);
        await queryRunner.query(`DROP TABLE "hatask_event"`);
    }
}
