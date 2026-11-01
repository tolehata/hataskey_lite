/* SPDX-License-Identifier: AGPL-3.0-only */
export class RecordModeration1790035300000 {
	name = 'RecordModeration1790035300000';
	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE record_moderation_operation (
			id varchar(32) PRIMARY KEY, "moderatorId" varchar(32) NOT NULL, "requestId" varchar(80) NOT NULL,
			"requestHash" varchar(64) NOT NULL, product varchar(16) NOT NULL, "targetType" varchar(32) NOT NULL,
			"targetId" varchar(64) NOT NULL, action varchar(16) NOT NULL, "createdAt" timestamptz NOT NULL,
			info jsonb NOT NULL, UNIQUE ("moderatorId", "requestId"),
			CHECK (product IN ('hatady','hatask')), CHECK (action IN ('delete','warn')),
			CHECK (info ? 'reason' AND jsonb_typeof(info->'reason')='string' AND char_length(btrim(info->>'reason')) BETWEEN 1 AND 1000)
		)`);
		await queryRunner.query('CREATE INDEX record_moderation_operation_target ON record_moderation_operation (product,"targetType","targetId",id)');
		// No target/user FK: deleting a record/account must not erase the audit or revive its ID.
		await queryRunner.query(`CREATE TABLE record_moderation_tombstone (
			"userId" varchar(32) NOT NULL, key varchar(16) NOT NULL, identity varchar(64) NOT NULL,
			"operationId" varchar(32) NOT NULL REFERENCES record_moderation_operation(id),
			PRIMARY KEY ("userId",key,identity)
		)`);
		await queryRunner.query(`CREATE FUNCTION hatask_record_identity(k text, v jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
			SELECT encode(sha256(convert_to((CASE
				WHEN jsonb_typeof(v->'id')='string' AND v->>'id'<>'' THEN jsonb_build_array('id',v->>'id')
				WHEN k='flower' AND v->>'startedAt' IS NOT NULL THEN jsonb_build_array('startedAt',v->>'startedAt')
				ELSE jsonb_build_array('content',CASE WHEN k='flower' AND jsonb_typeof(v)='object' THEN v-'progress'-'lastGrowthAt'-'totalMinutes' ELSE v END)
			END)::text,'UTF8')),'hex')
		$$`);
		await queryRunner.query(`CREATE FUNCTION enforce_hatask_record_moderation() RETURNS trigger LANGUAGE plpgsql AS $$
		DECLARE item jsonb; collection text; owner_id text; identity_value text;
		BEGIN
			IF TG_TABLE_NAME='registry_item' THEN
				IF NEW.domain IS NOT NULL OR NEW.scope<>ARRAY['client','hatask']::varchar[] OR NEW.key NOT IN ('events','todos','moods','meals','flower','gallery') THEN RETURN NEW; END IF;
				collection := NEW.key; owner_id := NEW."userId";
			ELSIF TG_TABLE_NAME='hatask_event' THEN collection := 'serverEvent'; owner_id := NEW."userId";
			ELSE collection := 'gallery'; owner_id := NEW."userId";
			END IF;
			PERFORM pg_advisory_xact_lock(hashtextextended('record-moderation:hatask:' || owner_id,0));
			IF TG_TABLE_NAME='registry_item' THEN
				FOR item IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.value)='array' THEN NEW.value ELSE jsonb_build_array(NEW.value) END) LOOP
					IF EXISTS (SELECT 1 FROM record_moderation_tombstone t WHERE t."userId"=owner_id AND (
						(t.key=collection AND t.identity=hatask_record_identity(collection,item)) OR
						(collection='events' AND t.key='serverEvent' AND t.identity=hatask_record_identity('serverEvent',jsonb_build_object('id',item->>'serverEventId')))
					)) THEN RAISE EXCEPTION 'Record removed by moderation; reload before saving' USING ERRCODE='23514', CONSTRAINT='hatask_record_moderated'; END IF;
				END LOOP;
			ELSE
				IF TG_TABLE_NAME='hatask_event' THEN identity_value := hatask_record_identity(collection,jsonb_build_object('id',NEW.id));
				ELSE identity_value := hatask_record_identity(collection,jsonb_build_object('id',NEW."clientFlowerId")); END IF;
				IF EXISTS (SELECT 1 FROM record_moderation_tombstone WHERE "userId"=owner_id AND key=collection AND identity=identity_value) THEN
					RAISE EXCEPTION 'Record removed by moderation; reload before saving' USING ERRCODE='23514', CONSTRAINT='hatask_record_moderated';
				END IF;
			END IF;
			RETURN NEW;
		END $$`);
		for (const table of ['registry_item', 'hatask_event', 'hatask_flower']) {
			await queryRunner.query(`CREATE TRIGGER enforce_record_moderation BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION enforce_hatask_record_moderation()`);
		}
	}
	async down(queryRunner) {
		for (const table of ['registry_item', 'hatask_event', 'hatask_flower']) await queryRunner.query(`DROP TRIGGER enforce_record_moderation ON ${table}`);
		await queryRunner.query('DROP FUNCTION enforce_hatask_record_moderation()');
		await queryRunner.query('DROP FUNCTION hatask_record_identity(text,jsonb)');
		await queryRunner.query('DROP TABLE record_moderation_tombstone');
		await queryRunner.query('DROP TABLE record_moderation_operation');
	}
}
