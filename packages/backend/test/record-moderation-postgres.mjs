/* SPDX-License-Identifier: AGPL-3.0-only */
// Uses the compiled service and real PostgreSQL, exclusively against temporary
// fixtures. An outer transaction is always rolled back. No application data is
// read, and no production migration is applied. Requires an explicit config path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import * as yaml from 'js-yaml';
import { RecordModerationService } from '../built/core/RecordModerationService.js';

assert(process.env.RECORD_MODERATION_TEST_CONFIG, 'Set RECORD_MODERATION_TEST_CONFIG explicitly');
const { db: config } = yaml.load(readFileSync(process.env.RECORD_MODERATION_TEST_CONFIG, 'utf8'));
assert.equal(config.db, 'record_moderation_test', 'Refusing any non-disposable database');
assert.equal(config.user, 'record_moderation_test', 'Refusing application database credentials');
const client = new pg.Client({ host: config.host, port: config.port, database: config.db, user: config.user, password: config.pass, ssl: config.ssl });
const query = async (sql, params = []) => (await client.query(sql, params)).rows;
let sequence = 0;
const repository = {
	insert: async data => query('INSERT INTO announcement (id,data) VALUES ($1,$2)', [data.id, JSON.stringify(data)]),
	findOneBy: async ({ id }) => (await query('SELECT data FROM announcement WHERE id=$1', [id]))[0]?.data,
};
// PostgreSQL never searches pg_temp for unqualified functions. Qualify only the
// test copy of the identical migration function; relation SQL remains unchanged.
const manager = { query: (sql, params) => query(sql.replaceAll('hatask_record_identity(', 'pg_temp.hatask_record_identity('), params), getRepository: () => repository };
const database = { ...manager, transaction: async (...args) => {
	await query('SAVEPOINT moderation_operation');
	try {
		const result = await args.at(-1)(manager);
		await query('RELEASE SAVEPOINT moderation_operation');
		return result;
	} catch (error) { await query('ROLLBACK TO SAVEPOINT moderation_operation'); throw error; }
} };
const service = new RecordModerationService(database, { isModerator: async () => true }, { gen: () => `op${++sequence}` }, { pack: async data => data }, { publishMainStream() {} }, { changed() {} }, { refreshSourceNotifications: async () => {} });
const moderator = { id: 'mod' };
const target = (product, targetType, targetId) => ({ product, targetType, targetId });
const request = async (value, patch = {}) => ({ ...value, version: (await service.preview(moderator, value)).version, requestId: `request-${String(++sequence).padStart(16, '0')}`, action: 'delete', reason: '対象記録の削除理由', warning: null, ...patch });
const exists = async (table, id) => (await query(`SELECT id FROM ${table} WHERE id=$1`, [id])).length === 1;
let passed = 0;
async function check(name, run) {
	await query('SAVEPOINT moderation_case');
	try { await run(); passed++; console.log(`PASS ${name}`); }
	finally { await query('ROLLBACK TO SAVEPOINT moderation_case'); }
}

await client.connect();
try {
	// Existing fixture verifies the complete source CTE and the migration guards.
	// Capture it without interpreting dollar-quoted SQL as replacement strings.
	const setup = execFileSync(process.execPath, ['test/record-moderation-sql.mjs'], { encoding: 'utf8' }).replace(/ROLLBACK;\s*$/, '');
	await query(setup);
	await query(`CREATE TEMP TABLE announcement (id varchar(32) PRIMARY KEY,data jsonb);
		CREATE TEMP TABLE moderation_log (id varchar(32) PRIMARY KEY,"userId" varchar(32),type text,info jsonb);
		CREATE TEMP TABLE hatask_rsvp (id varchar(32),"eventId" varchar(32));
		CREATE TEMP TABLE hatady_moderation_review ("targetType" text,"targetId" varchar(32),note text,revision integer,"reviewerId" varchar(32),"reviewedAt" timestamptz,"contentVersion" text,state text);`);
	const hatadyTables = ['hatady_book', 'hatady_bookmark', 'hatady_book_memo', 'hatady_log', 'hatady_comment', 'hatady_reaction', 'hatady_media_work', 'hatady_media_session', 'hatady_media_comment', 'hatady_media_reaction', 'hatady_notification'];
	for (const table of hatadyTables) await query(`CREATE TEMP TABLE ${table} (
		id varchar(32) PRIMARY KEY,"userId" varchar(32) DEFAULT 'owner',"createdAt" timestamptz DEFAULT '2026-09-22',title text DEFAULT '確認対象',kind text DEFAULT 'study',visibility text DEFAULT 'private',
		details jsonb DEFAULT '{}',body text,note text,text text,synopsis text,review text,reaction text,"workSnapshot" jsonb DEFAULT '{}',
		"bookId" varchar(32),"mediaWorkId" varchar(32),"workId" varchar(32),"sessionId" varchar(32),"logId" varchar(32),"commentId" varchar(32),"replyId" varchar(32),"mediaSessionId" varchar(32),"mediaCommentId" varchar(32),
		"commentsCount" integer DEFAULT 1,"reactionsCount" integer DEFAULT 1)`);
	// Use the audited production CASCADE / SET NULL relationships.
	for (const [child, column, parent, behavior] of [
		['hatady_bookmark', 'bookId', 'hatady_book', 'CASCADE'], ['hatady_book_memo', 'bookId', 'hatady_book', 'CASCADE'], ['hatady_log', 'bookId', 'hatady_book', 'SET NULL'],
		['hatady_comment', 'logId', 'hatady_log', 'CASCADE'], ['hatady_reaction', 'logId', 'hatady_log', 'CASCADE'], ['hatady_reaction', 'commentId', 'hatady_comment', 'CASCADE'],
		['hatady_media_session', 'workId', 'hatady_media_work', 'SET NULL'], ['hatady_log', 'mediaWorkId', 'hatady_media_work', 'SET NULL'],
		['hatady_media_comment', 'workId', 'hatady_media_work', 'CASCADE'], ['hatady_media_comment', 'sessionId', 'hatady_media_session', 'CASCADE'], ['hatady_media_comment', 'replyId', 'hatady_media_comment', 'SET NULL'],
		['hatady_media_reaction', 'workId', 'hatady_media_work', 'CASCADE'], ['hatady_media_reaction', 'sessionId', 'hatady_media_session', 'CASCADE'], ['hatady_media_reaction', 'commentId', 'hatady_media_comment', 'CASCADE'],
	]) await query(`ALTER TABLE ${child} ADD FOREIGN KEY ("${column}") REFERENCES ${parent}(id) ON DELETE ${behavior}`);
	await query(`INSERT INTO hatady_book (id) VALUES ('book'); INSERT INTO hatady_bookmark (id,"bookId") VALUES ('bookmark','book'); INSERT INTO hatady_book_memo (id,"bookId") VALUES ('memo','book');
		INSERT INTO hatady_log (id,"bookId") VALUES ('log','book'); INSERT INTO hatady_comment (id,"logId") VALUES ('comment','log'); INSERT INTO hatady_comment (id,"logId","replyId","userId") VALUES ('reply','log','comment','other');
		INSERT INTO hatady_reaction (id,"logId") VALUES ('reaction','log'); INSERT INTO hatady_reaction (id,"commentId") VALUES ('commentreaction','comment');
		INSERT INTO hatady_media_work (id,kind) VALUES ('work','movie'); INSERT INTO hatady_media_session (id,kind,"workId") VALUES ('session','movie_viewing','work');
		INSERT INTO hatady_media_comment (id,"sessionId") VALUES ('sessioncomment','session'); INSERT INTO hatady_media_comment (id,"workId") VALUES ('workcomment','work');
		INSERT INTO hatady_media_reaction (id,"sessionId") VALUES ('sessionreaction','session'); INSERT INTO hatady_media_reaction (id,"commentId") VALUES ('workreaction','workcomment');
		INSERT INTO hatady_notification (id,"mediaWorkId") VALUES ('notification','work');`);
	for (const [type, id, table, removed, retained] of [
		['book', 'book', 'hatady_book', [['hatady_bookmark','bookmark'],['hatady_book_memo','memo']], [['hatady_log','log']]],
		['log', 'log', 'hatady_log', [['hatady_comment','comment'],['hatady_reaction','reaction']], [['hatady_book','book']]],
		['comment', 'comment', 'hatady_comment', [['hatady_reaction','commentreaction']], [['hatady_log','log'],['hatady_comment','reply']]],
		['reaction', 'reaction', 'hatady_reaction', [], [['hatady_log','log'],['hatady_reaction','commentreaction']]],
		['mediaWork', 'work', 'hatady_media_work', [['hatady_media_comment','workcomment'],['hatady_notification','notification']], [['hatady_media_session','session'],['hatady_media_comment','sessioncomment']]],
		['mediaSession', 'session', 'hatady_media_session', [['hatady_media_comment','sessioncomment'],['hatady_media_reaction','sessionreaction']], [['hatady_media_work','work']]],
		['mediaComment', 'workcomment', 'hatady_media_comment', [['hatady_media_reaction','workreaction']], [['hatady_media_work','work'],['hatady_media_comment','sessioncomment']]],
		['mediaReaction', 'workreaction', 'hatady_media_reaction', [], [['hatady_media_comment','workcomment']]],
	]) await check(`Hatady ${type}: audited cascade and retained records`, async () => {
		await service.execute(moderator, await request(target('hatady', type, id)));
		for (const [t, i] of [[table,id], ...removed]) assert(!await exists(t,i), `${t}/${i} should be removed`);
		for (const [t, i] of retained) assert(await exists(t,i), `${t}/${i} should remain`);
		assert.equal((await query('SELECT count(*)::int AS n FROM moderation_log'))[0].n, 1);
		if (type === 'comment') assert.equal((await query('SELECT "replyId" FROM hatady_comment WHERE id=\'reply\''))[0].replyId, null);
	});
	await check('Hatady failure rolls back deletion and audit in PostgreSQL', async () => {
		await query("ALTER TABLE moderation_log ADD CHECK (type <> 'deleteHatadyRecord')");
		await assert.rejects(service.execute(moderator, await request(target('hatady','book','book'))));
		assert(await exists('hatady_book','book'));
		assert.equal((await query('SELECT count(*)::int AS n FROM moderation_log'))[0].n, 0);
	});
	await check('related changes after preview require a fresh confirmation', async () => {
		const input = await request(target('hatady','book','book'));
		await query("INSERT INTO hatady_book_memo (id,\"bookId\") VALUES ('added','book')");
		await assert.rejects(service.execute(moderator, input), { code: 'RECORD_MODERATION_CONFLICT' });
		assert(await exists('hatady_book','book'));
	});
	for (const [key, value, entry] of [['todos', [{id:'selected',text:'削除対象'},{id:'keep',text:'残す'}], 'id:selected'], ['moods', [{id:'selected',note:'対象'},{id:'keep'}], 'id:selected'], ['meals', ['匿名の記録',{id:'keep'}], 'fixture:1'], ['flower', {startedAt:1234567,name:'対象'}, 'growing']]) await check(`Hatask ${key}: selected record only, tombstone, warning and retry`, async () => {
		await query('DELETE FROM registry_item WHERE "userId"=\'owner\' AND key=$1', [key]);
		await query('INSERT INTO registry_item VALUES (\'fixture\',\'owner\',$1,\'{client,hatask}\',NULL,$2,now())', [key,JSON.stringify(value)]);
		if (key === 'todos') await query('INSERT INTO registry_item VALUES (\'duplicate\',\'owner\',$1,\'{client,hatask}\',NULL,$2,now())', [key,JSON.stringify(value)]);
		const [row] = await query('SELECT id FROM review_result WHERE "userId"=\'owner\' AND key=$1 AND entry_id=$2', [key,entry]);
		const input = await request(target('hatask','record',row.id), { warning:'利用ルールを確認してください' });
		if (key === 'flower') await query("UPDATE registry_item SET value=value || '{\"progress\":99,\"lastGrowthAt\":9999}',\"updatedAt\"=now() WHERE id='fixture'");
		const result = await service.execute(moderator,input);
		assert.deepEqual(await service.execute(moderator,input),result);
		const stored = await query('SELECT value FROM registry_item WHERE "userId"=\'owner\' AND key=$1',[key]);
		for (const item of stored) assert.deepEqual(item.value, Array.isArray(value) ? [value[1]] : null);
		assert.equal((await query('SELECT count(*)::int AS n FROM moderation_log'))[0].n,2);
		const [announcement] = await query('SELECT data FROM announcement');
		assert.equal(announcement.data.userId,'owner'); assert.equal(announcement.data.needConfirmationToRead,true);
		assert(!announcement.data.text.includes(input.reason));
	});
	await check('Hatask shared event removes same-owner aliases and RSVP only', async () => {
		await query('ALTER TABLE hatask_event ADD UNIQUE(id); ALTER TABLE hatask_rsvp ADD FOREIGN KEY ("eventId") REFERENCES hatask_event(id) ON DELETE CASCADE');
		await query(`INSERT INTO hatask_event (id,"userId",title,"createdAt") VALUES ('event','owner','対象',now());
			INSERT INTO hatask_rsvp VALUES ('rsvp','event');
			UPDATE registry_item SET value='[{"id":"a","serverEventId":"event"},{"id":"b","serverEventId":"event"},{"id":"keep","serverEventId":"otherEvent"}]' WHERE id='events'`);
		const [row] = await query("SELECT id FROM review_result WHERE \"userId\"='owner' AND key='events' AND entry_id='id:a'");
		await service.execute(moderator, await request(target('hatask','record',row.id)));
		assert(!await exists('hatask_event','event')); assert(!await exists('hatask_rsvp','rsvp')); assert(await exists('hatask_event','otherEvent'));
		assert.deepEqual((await query("SELECT value FROM registry_item WHERE id='events'"))[0].value, [{id:'keep',serverEventId:'otherEvent'}]);
	});
	await check('Hatask server-only flower leaves another owner with the same client ID', async () => {
		await query("INSERT INTO hatask_flower VALUES ('ownflower','owner','newflower','対象',now()),('otherflower','other','newflower','別の人',now())");
		const [row] = await query("SELECT id FROM review_result WHERE \"userId\"='owner' AND key='gallery' AND entry_id='id:newflower'");
		await service.execute(moderator, await request(target('hatask','record',row.id)));
		assert(!await exists('hatask_flower','ownflower')); assert(await exists('hatask_flower','otherflower'));
	});
	console.log(`${passed} real-service PostgreSQL checks passed; rolling back all temporary fixtures.`);
} finally { await client.query('ROLLBACK'); await client.end(); }
