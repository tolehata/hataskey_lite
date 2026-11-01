/* SPDX-License-Identifier: AGPL-3.0-only */
// Feed to psql -X -v ON_ERROR_STOP=1. Only temporary objects in pg_temp are
// accessible, and the transaction is always rolled back when the session ends.
import { UtageRevival1790035400000 } from '../migration/1790035400000-utage-revival.js';
const up = [], down = [];
const migration = new UtageRevival1790035400000();
await migration.up({ query: async sql => up.push(`${sql};`) });
await migration.down({ query: async sql => down.push(`${sql};`) });
process.stdout.write(`
BEGIN;
SET LOCAL search_path = pg_temp;
CREATE TEMP TABLE utage_session (id varchar(32) PRIMARY KEY, status varchar(16), "resolvedAt" timestamptz);
INSERT INTO utage_session VALUES ('old-success','succeeded',now()), ('old-running','running',NULL), ('old-failure','failed',now());
${up.join('\n')}
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM utage_session WHERE "ruleVersion" <> 0 OR "revision" <> 0 OR "publishedRevision" <> 0 OR cardinality("revivalSupporterIds") <> 0 OR cardinality("revivalExcludedUserIds") <> 0) THEN RAISE EXCEPTION 'Legacy defaults changed'; END IF;
 IF (SELECT "successMethod" FROM utage_session WHERE id='old-success') IS DISTINCT FROM 'normal' THEN RAISE EXCEPTION 'Normal success not preserved'; END IF;
 IF EXISTS (SELECT 1 FROM utage_session WHERE status <> 'succeeded' AND "successMethod" IS NOT NULL) THEN RAISE EXCEPTION 'Unexpected success method'; END IF;
END $$;
INSERT INTO utage_session (id,status,"ruleVersion","revision","revivalStartedAt","revivalExpiresAt","revivalTargetCount","revivalSupporterIds","revivalExcludedUserIds") VALUES
 ('revival','reviving',1,2,now(),now()+interval '30 seconds',2,'{first}','{blocker}');
-- Positive and negative controls for the persisted array membership predicate.
DO $$ BEGIN
 IF NOT ('blocker' = ANY((SELECT "revivalExcludedUserIds" FROM utage_session WHERE id='revival')::varchar[])) THEN RAISE EXCEPTION 'Excluded reactor accepted'; END IF;
 IF ('new' = ANY((SELECT "revivalExcludedUserIds" FROM utage_session WHERE id='revival')::varchar[])) THEN RAISE EXCEPTION 'New reactor excluded'; END IF;
 IF NOT (SELECT "publishedRevision" < "revision" FROM utage_session WHERE id='revival') THEN RAISE EXCEPTION 'Recovery checkpoint not pending'; END IF;
END $$;
${down.join('\n')}
DO $$ BEGIN
 IF (SELECT status FROM utage_session WHERE id='revival') IS DISTINCT FROM 'failed' THEN RAISE EXCEPTION 'Downgrade produced a false success'; END IF;
 IF (SELECT "resolvedAt" FROM utage_session WHERE id='revival') IS NULL THEN RAISE EXCEPTION 'Downgrade left unresolved session'; END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='pg_temp.utage_session'::regclass AND attnum>0 AND NOT attisdropped) <> 3 THEN RAISE EXCEPTION 'Downgrade columns mismatch'; END IF;
END $$;
SELECT 'utage migration up/down and legacy defaults: passed' AS result;
ROLLBACK;
`);
