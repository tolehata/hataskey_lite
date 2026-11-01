-- Run in one existing PostgreSQL session. All relations below are temporary;
-- no application records are read or written, and the session is rolled back.
BEGIN;
SET LOCAL search_path = pg_temp, pg_catalog;
CREATE TEMP TABLE "user" (id varchar(32) PRIMARY KEY, username text, name text);
CREATE TEMP TABLE user_profile ("userId" varchar(32), "hataskFlowerVisibility" text);
CREATE TEMP TABLE registry_item (id varchar(32), "userId" varchar(32), key text, scope varchar[], domain text, value jsonb, "updatedAt" timestamptz);
CREATE TEMP TABLE hatask_event (id varchar(32), "userId" varchar(32), title text, date text, visibility text, "visibleUserIds" varchar[], "createdAt" timestamptz);
CREATE TEMP TABLE hatask_flower (id varchar(32), "userId" varchar(32), "clientFlowerId" text, name text, "harvestedAt" timestamptz);
-- HATASK_RECORD_REVIEW_MIGRATION
INSERT INTO "user" VALUES ('owner','owner','所有者'), ('other','other','別の人'), ('mod','mod','確認者');
INSERT INTO user_profile VALUES ('owner','followers'), ('other','private');
INSERT INTO registry_item VALUES
('one','owner','todos','{client,hatask}',NULL,'[{"id":"task","text":"旧題名","comment":"残すコメント","createdAt":1789516800000}]','2026-09-15'),
('two','owner','todos','{client,hatask}',NULL,'[{"id":"task","text":"新題名"}, "古い形式", {}]','2026-09-16'),
('events','owner','events','{client,hatask}',NULL,'[{"id":"local","serverEventId":"shared","title":"本人用","comment":"本人用メモ"},{"id":"foreign","serverEventId":"otherEvent","title":"他人のIDを含む私的メモ"}]','2026-09-16'),
('moods','owner','moods','{client,hatask}',NULL,'[{"id":"mood","note":"きもちの秘密","date":"2026-09-16","level":2}]','2026-09-16'),
('meals','owner','meals','{client,hatask}',NULL,'[{"id":"meal","note":"食事のメモ","date":"2026-09-16","level":"none"}]','2026-09-16'),
('gallery','owner','gallery','{client,hatask}',NULL,'[{"id":"flower1","name":"花の名前","harvestedAt":"2026-09-16T00:00:00Z"}]','2026-09-16'),
('growing','owner','flower','{client,hatask}',NULL,'{"name":"育成中","startedAt":1789516800000,"progress":12,"lastGrowthAt":1789516800000,"totalMinutes":1}','2026-09-16'),
('backup','owner','__planner_backup_v1_todos','{client,hatask}',NULL,'[{"id":"backup","text":"バックアップ"}]','2026-09-16'),
('wrongscope','owner','todos','{client,another}',NULL,'[{"id":"no","text":"別のアプリ"}]','2026-09-16'),
('domain','owner','todos','{client,hatask}','thirdparty.test','[{"id":"no","text":"別の保存領域"}]','2026-09-16');
INSERT INTO hatask_event VALUES ('shared','owner','共有予定','2026-09-16','specified','{other}','2026-09-16'), ('otherEvent','other','他人の共有予定','2026-09-17','public','{}','2026-09-16');
INSERT INTO hatask_flower VALUES ('sf1','owner','flower1','花の名前','2026-09-16'), ('sf2','other','flower2','非公開の花','2026-09-16');
CREATE TEMP VIEW review_result AS
-- HATASK_RECORD_REVIEW_CTE
SELECT * FROM reviewed;
DO $$ BEGIN
 IF (SELECT count(*) FROM review_result) <> 11 THEN RAISE EXCEPTION 'All sources, malformed rows, and deduplication failed'; END IF;
 IF (SELECT count(*) FROM review_result WHERE kind='event') <> 3 THEN RAISE EXCEPTION 'Event deduplication or owner boundary failed'; END IF;
 IF (SELECT count(*) FROM review_result WHERE kind='todo') <> 3 THEN RAISE EXCEPTION 'Legacy rows were lost'; END IF;
 IF NOT EXISTS (SELECT FROM review_result WHERE title='新題名' AND body='残すコメント') THEN RAISE EXCEPTION 'Legacy field merge failed'; END IF;
 IF NOT EXISTS (SELECT FROM review_result WHERE title='共有予定' AND visibility='specified' AND data->'localRecord'->>'comment'='本人用メモ') THEN RAISE EXCEPTION 'Private local context missing'; END IF;
 IF NOT EXISTS (SELECT FROM review_result WHERE title='他人の共有予定' AND "userId"='other') THEN RAISE EXCEPTION 'Foreign reference hid another owner'; END IF;
 IF (SELECT count(*) FROM review_result WHERE visibility='followers') <> 1 THEN RAISE EXCEPTION 'Flower profile visibility missing'; END IF;
 IF NOT EXISTS (SELECT FROM review_result WHERE title='非公開の花' AND visibility='private') THEN RAISE EXCEPTION 'Private server-only flower missing'; END IF;
END $$;
INSERT INTO hatask_record_review SELECT id,"userId",'reviewed',"contentVersion",1,'mod',now() FROM review_result WHERE title IN ('育成中','新題名');
DO $$ BEGIN
 IF (SELECT count(*) FROM review_result WHERE state='reviewed') <> 2 THEN RAISE EXCEPTION 'Review persistence failed'; END IF;
END $$;
UPDATE registry_item SET value=jsonb_set(value,'{progress}','20') WHERE id='growing';
UPDATE registry_item SET value=jsonb_set(value,'{0,text}','"変更した題名"') WHERE id='two';
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM review_result WHERE title='育成中' AND state='reviewed') THEN RAISE EXCEPTION 'Growth alone invalidated review'; END IF;
 IF NOT EXISTS (SELECT FROM review_result WHERE title='変更した題名' AND state='unread' AND stale) THEN RAISE EXCEPTION 'Changed content not reset'; END IF;
END $$;
-- HATASK_RECORD_REVIEW_LIST_QUERIES
SELECT 'Hatask record source, privacy, merge, review and pagination SQL checks passed' AS result;
ROLLBACK;
