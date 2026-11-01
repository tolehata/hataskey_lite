/* SPDX-License-Identifier: AGPL-3.0-only */
// Emit SQL for one psql session with ON_ERROR_STOP=1. All data/functions are
// temporary and the entire session is rolled back; no application rows are used.
import { readFileSync } from 'node:fs';
import { HATASK_REVIEW_CTE } from '../built/core/hatask-record-review.js';
import { moderatorLogInfoSql } from '../built/misc/moderation-log-visibility.js';
import { AddHataskRecordReview1789260000000 } from '../migration/1789260000000-add-hatask-record-review.js';
import { RecordModeration1790035300000 } from '../migration/1790035300000-record-moderation.js';
const migration = [];
const temporary = sql => sql.replaceAll('CREATE TABLE', 'CREATE TEMP TABLE').replaceAll('hatask_record_identity(', 'pg_temp.hatask_record_identity(').replaceAll('enforce_hatask_record_moderation()', 'pg_temp.enforce_hatask_record_moderation()');
for (const Migration of [AddHataskRecordReview1789260000000, RecordModeration1790035300000]) await new Migration().up({ query: async sql => migration.push(`${temporary(sql)};`) });
let fixture = readFileSync('test/fixtures/hatask-record-review.sql', 'utf8')
	.replace('-- HATASK_RECORD_REVIEW_MIGRATION', () => migration.join('\n'))
	.replace('-- HATASK_RECORD_REVIEW_CTE', () => HATASK_REVIEW_CTE);
const tests = `
CREATE FUNCTION pg_temp.expect_moderated(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE constraint_name text;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS constraint_name = CONSTRAINT_NAME;
  IF constraint_name <> 'hatask_record_moderated' THEN RAISE; END IF;
  RETURN;
 END;
 RAISE EXCEPTION 'Moderated content was restored: %', statement;
END $$;
INSERT INTO record_moderation_operation VALUES ('op','mod','request-1234567890',repeat('a',64),'hatask','record',repeat('b',64),'delete',now(),' {"reason":"必須の削除理由"}'::jsonb);
DO $$ BEGIN
 BEGIN
  INSERT INTO record_moderation_operation VALUES ('invalid','mod','other-request-1234',repeat('a',64),'hatask','record',repeat('b',64),'delete',now(),'{}');
  RAISE EXCEPTION 'Missing reason passed the database constraint';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
-- Remove all active copies before blocking future writes, as the service does.
UPDATE registry_item SET value=(SELECT COALESCE(jsonb_agg(item ORDER BY n),'[]') FROM jsonb_array_elements(value) WITH ORDINALITY a(item,n) WHERE item->>'id' IS DISTINCT FROM 'task') WHERE id IN ('one','two');
INSERT INTO record_moderation_tombstone VALUES ('owner','todos',pg_temp.hatask_record_identity('todos','{"id":"task"}'),'op');
SELECT pg_temp.expect_moderated($s$UPDATE registry_item SET value='[{"id":"task","text":"戻った記録"}]' WHERE id='one'$s$);
SELECT pg_temp.expect_moderated($s$INSERT INTO registry_item VALUES ('restored','owner','todos','{client,hatask}',NULL,'[{"id":"task"}]',now())$s$);
-- Other owners/scopes/domains and genuinely new IDs remain writable.
INSERT INTO registry_item VALUES ('allowedOther','other','todos','{client,hatask}',NULL,'[{"id":"task"}]',now()), ('allowedDomain','owner','todos','{client,hatask}','external','[{"id":"task"}]',now());
UPDATE registry_item SET value='[{"id":"task"}]' WHERE id='wrongscope';
UPDATE registry_item SET value='[{"id":"new-task"}]' WHERE id='one';
DELETE FROM hatask_event WHERE id='shared';
UPDATE registry_item SET value='[]' WHERE id='events';
INSERT INTO record_moderation_tombstone VALUES ('owner','serverEvent',pg_temp.hatask_record_identity('serverEvent','{"id":"shared"}'),'op');
SELECT pg_temp.expect_moderated($s$UPDATE registry_item SET value='[{"id":"another-local-id","serverEventId":"shared"}]' WHERE id='events'$s$);
SELECT pg_temp.expect_moderated($s$INSERT INTO hatask_event (id,"userId") VALUES ('shared','owner')$s$);
DELETE FROM hatask_flower WHERE id='sf1';
UPDATE registry_item SET value='[]' WHERE id='gallery';
INSERT INTO record_moderation_tombstone VALUES ('owner','gallery',pg_temp.hatask_record_identity('gallery','{"id":"flower1"}'),'op');
SELECT pg_temp.expect_moderated($s$INSERT INTO hatask_flower (id,"userId","clientFlowerId") VALUES ('different-server-id','owner','flower1')$s$);
SELECT pg_temp.expect_moderated($s$UPDATE registry_item SET value='[{"id":"flower1"}]' WHERE id='gallery'$s$);
UPDATE registry_item SET value='null' WHERE id='growing';
INSERT INTO record_moderation_tombstone VALUES ('owner','flower',pg_temp.hatask_record_identity('flower','{"startedAt":1789516800000}'),'op');
SELECT pg_temp.expect_moderated($s$UPDATE registry_item SET value='{"startedAt":1789516800000,"progress":99}' WHERE id='growing'$s$);
UPDATE registry_item SET value='{"startedAt":1789516800001,"progress":0}' WHERE id='growing';
UPDATE registry_item SET value='null' WHERE id='growing';
SELECT pg_temp.hatask_record_identity('flower','"legacy scalar"');
INSERT INTO record_moderation_tombstone VALUES ('owner','meals',pg_temp.hatask_record_identity('meals','"legacy text"'),'op');
SELECT pg_temp.expect_moderated($s$UPDATE registry_item SET value='["legacy text"]' WHERE id='meals'$s$);
DO $$ DECLARE projected jsonb; BEGIN
 SELECT ${moderatorLogInfoSql} INTO projected FROM (SELECT 'deleteHataskRecord'::text AS type,jsonb_build_object('reason','削除理由','targetUsername','owner','targetId',repeat('a',64),'body','秘密','warning','内部の警告文') AS info) log;
 IF projected<>jsonb_build_object('reason','削除理由','targetUsername','owner','targetId',repeat('a',64)) THEN RAISE EXCEPTION 'New audit projection mismatch: %',projected; END IF;
 SELECT ${moderatorLogInfoSql} INTO projected FROM (SELECT 'deleteNote'::text AS type,jsonb_build_object('noteId','note1','reason','非公開理由','body','秘密') AS info) log;
 IF projected<>jsonb_build_object('noteId','note1') THEN RAISE EXCEPTION 'Existing redaction changed'; END IF;
END $$;
SELECT 'Record moderation SQL checks passed: restore guards, scope/owner boundaries, mandatory audit and log projection' AS result;
`;
fixture = fixture.replace('ROLLBACK;', () => `${tests}\nROLLBACK;`);
process.stdout.write(fixture);
