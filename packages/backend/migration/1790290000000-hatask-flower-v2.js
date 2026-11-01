export class HataskFlowerV21790290000000 {
	name = 'HataskFlowerV21790290000000';
	async up(q) {
		await q.query(`CREATE TABLE hatask_drop_wallet ("userId" varchar(32) PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, drops integer NOT NULL DEFAULT 0 CHECK(drops BETWEEN 0 AND 20), timezone varchar(80), flower jsonb, seeds jsonb NOT NULL DEFAULT '[]', "rareSeeds" jsonb NOT NULL DEFAULT '[]')`);
		await q.query(`CREATE TABLE hatask_drop_ledger ("userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, source varchar(16) NOT NULL, "sourceId" varchar(128) NOT NULL, day varchar(10) NOT NULL, title text, "createdAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY("userId",source,"sourceId"))`);
		await q.query(`CREATE INDEX ON hatask_drop_ledger("userId",day,source)`);
		await q.query(`CREATE TABLE hatask_flower_todo ("userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, id varchar(128), "createdAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY("userId",id))`);
		await q.query(`CREATE TABLE hatask_flower_harvest (id varchar(64) PRIMARY KEY, "userId" varchar(32) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, "speciesId" varchar(80) NOT NULL, season varchar(8) NOT NULL, entry jsonb NOT NULL)`);
		await q.query(`CREATE TABLE hatask_flower_discovery ("speciesId" varchar(80), "userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, rank integer NOT NULL, PRIMARY KEY("speciesId","userId"), UNIQUE("speciesId",rank))`);
		await q.query(`CREATE TABLE hatask_flower_festival (id varchar(32) PRIMARY KEY, season varchar(8) NOT NULL, goal integer NOT NULL, total integer NOT NULL DEFAULT 0, "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL, "bloomedAt" timestamptz)`);
		await q.query(`CREATE TABLE hatask_flower_participant ("festivalId" varchar(32) REFERENCES hatask_flower_festival(id) ON DELETE CASCADE, "userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, count integer NOT NULL DEFAULT 1, "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY("festivalId","userId"))`);
		await q.query(`CREATE TABLE hatask_flower_request ("userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, id varchar(128), target varchar(16) NOT NULL, PRIMARY KEY("userId",id))`);
		await q.query(`ALTER TABLE meta ADD COLUMN "hataskFlowerRules" jsonb NOT NULL DEFAULT '{"todoMinAgeMinutes":30,"todoMinLength":3,"hatadyGapSeconds":60,"pourMinutes":120,"todoCap":5,"hatadyCap":10,"loginCap":1,"festivalGoal":1000}'`);
		await q.query(`CREATE TABLE hatask_flower_notice ("userId" varchar(32) REFERENCES "user"(id) ON DELETE CASCADE, type varchar(32), "sourceId" varchar(64), "sentAt" timestamptz, PRIMARY KEY("userId",type,"sourceId"))`);
		// Existing persisted todos predate v2. Conservatively use their last server write.
		await q.query(`INSERT INTO hatask_flower_todo("userId",id,"createdAt") SELECT r."userId",t->>'id',LEAST(r."updatedAt",now()) FROM registry_item r CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.value)='array' THEN r.value ELSE '[]'::jsonb END) t WHERE r.domain IS NULL AND r.scope=ARRAY['client','hatask']::varchar[] AND r.key='todos' AND length(t->>'id') BETWEEN 1 AND 128 ON CONFLICT DO NOTHING`);
	}
	async down(q) {
		await q.query(`ALTER TABLE meta DROP COLUMN "hataskFlowerRules"`);
		for (const t of ['notice','request','participant','festival','discovery','harvest','todo']) await q.query(`DROP TABLE hatask_flower_${t}`);
		await q.query('DROP TABLE hatask_drop_ledger');
		await q.query('DROP TABLE hatask_drop_wallet');
	}
}
