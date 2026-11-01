/**
 * PostgreSQL integration check for flower rewards, concurrent watering, and harvests.
 * Run with installed backend dependencies, from this repository:
 *   HATASK_FLOWER_VERIFY_SOCKET=/tmp/hatask-flower-verify-socket node packages/backend/test/hatask-flower-v2-postgres.mjs
 *
 * Use ONLY a disposable PostgreSQL 15+ instance with network disabled. Create an
 * empty database named hatask_flower_v2_verify owned by postgres beforehand, and
 * expose its Unix socket at the explicit verification path above. No TCP/default
 * database fallback exists. The script creates and removes a unique test schema.
 * Fixture IDs are synthetic. Production connections and production data are forbidden.
 * Service code is compiled from current source; DI adapters and notifications are
 * stubbed, while every application SQL statement runs against real PostgreSQL.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { transformSync } from '@swc/core';
import pg from 'pg';
const base=fileURLToPath(new URL('../', import.meta.url));
const socket=process.env.HATASK_FLOWER_VERIFY_SOCKET;
if (!socket?.startsWith('/') || !socket.includes('hatask-flower-verify')) throw new Error('Set HATASK_FLOWER_VERIFY_SOCKET to an isolated test socket directory containing hatask-flower-verify.');
const work=mkdtempSync(join(tmpdir(), 'hatask-flower-verify-'));
const schema=`hatask_flower_verify_${process.pid}_${Date.now()}`;
for (const [src,dest] of [['src/core/HataskFlowerV2Service.ts','service.mjs'],['src/core/hatask-flower-v2.ts','hatask-flower-v2.js'],['src/misc/hatask-flower-catalog.ts','catalog.mjs']]) {
 let s=readFileSync(`${base}/${src}`,'utf8');
 s=s.replace("import { Inject, Injectable } from '@nestjs/common';", 'const Inject=()=>()=>{}, Injectable=()=>v=>v;').replace("import { DI } from '@/di-symbols.js';",'const DI={db:Symbol()};').replace("import { NotificationService } from './NotificationService.js';",'class NotificationService {}').replace("import { IdService } from '@/core/IdService.js';",'class IdService {}').replace("'@/misc/hatask-flower-catalog.js'","'./catalog.mjs'");
 writeFileSync(join(work,dest),transformSync(s,{filename:src,jsc:{parser:{syntax:'typescript',decorators:true},target:'es2022',transform:{legacyDecorator:true,decoratorMetadata:true}},module:{type:'es6'}}).code);
}
writeFileSync(join(work,'package.json'), JSON.stringify({type:'module'}));
const {HataskFlowerV2Service}=await import(pathToFileURL(join(work,'service.mjs')).href);
const pool=new pg.Pool({host:socket,user:'postgres',database:'hatask_flower_v2_verify',options:`-c search_path=${schema}`});
const query=async(s,p)=>(await pool.query(s,p)).rows;
const db={query,transaction:async(fn)=>{const c=await pool.connect();try {await c.query('BEGIN');const r=await fn({query:async(s,p)=>(await c.query(s,p)).rows});await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
await query(`CREATE SCHEMA ${schema}`);
try {
await query('CREATE TABLE "user" (id varchar(32) PRIMARY KEY,name text,username text); CREATE TABLE meta (id varchar(32)); CREATE TABLE registry_item ("userId" varchar(32),"updatedAt" timestamptz,value jsonb,domain varchar,scope varchar[],key varchar); CREATE TABLE hatask_flower (id varchar(32),"userId" varchar(32),"clientFlowerId" varchar(64),emoji text,name text,hanakotoba text,"harvestedAt" timestamptz, UNIQUE("userId","clientFlowerId"))');
const {HataskFlowerV21790290000000}=await import(`${base}/migration/1790290000000-hatask-flower-v2.js`);await new HataskFlowerV21790290000000().up({query});
await query('INSERT INTO "user" VALUES ($1::varchar,$1::varchar,$1::varchar),($2::varchar,$2::varchar,$2::varchar);',['u1','u2']);await query("INSERT INTO meta(id) VALUES ('meta')");
let counter=0;const svc=new HataskFlowerV2Service(db,{gen:()=>String(++counter).padStart(16,'0')},{createNotificationAsync:async()=>{}});
const states=await Promise.all(Array.from({length:5},()=>svc.show('u1','Asia/Tokyo')));assert(states.every(s=>s.drops===1));console.log('PASS concurrent login awarded once');
await query('UPDATE hatask_drop_wallet SET drops=10 WHERE "userId"=$1',['u1']);
await Promise.all(Array.from({length:5},()=>svc.pour('u1','self','same-request')));assert.equal((await svc.show('u1')).drops,9);console.log('PASS same-request concurrent pour decrements once');
await Promise.all(['r2','r3'].map(id=>svc.pour('u1','self',id)));assert.equal((await svc.show('u1')).drops,7);console.log('PASS distinct concurrent pours');
const next=[{id:'todo1',text:'ＡＢＣ',done:true}],prev=[{...next[0],done:false}];
let result=await db.transaction(m=>svc.onTodosCommitted(m,'u1',prev,next));assert.equal(result.todo1.why,'young');
await query('UPDATE hatask_flower_todo SET "createdAt"=now()-interval \'1 hour\'');
const rewards=await Promise.all(Array.from({length:5},()=>db.transaction(m=>svc.onTodosCommitted(m,'u1',prev,next))));assert.equal(rewards.filter(r=>r.todo1.granted).length,1);console.log('PASS young rejected and concurrent same todo awarded once');
await query('INSERT INTO hatask_flower_todo("userId",id,"createdAt") VALUES ($1,$2,now()-interval \'1 hour\')',['u1','todo2']);
result=await db.transaction(m=>svc.onTodosCommitted(m,'u1',[{id:'todo2',text:'abc',done:false}],[{id:'todo2',text:' a b c ',done:true}]));assert.equal(result.todo2.why,'dup');console.log('PASS normalized duplicate title rejected');
await query('UPDATE hatask_drop_wallet SET flower=jsonb_set(flower,\'{totalMinutes}\',flower->\'targetMinutes\') WHERE "userId"=$1',['u1']);const before=await svc.show('u1');
await query('INSERT INTO hatask_flower(id,"userId","clientFlowerId",emoji,name,hanakotoba,"harvestedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',['legacy-sync-row','u1',before.flower.id,'🌼','legacy display','']);
const harvests=await Promise.all(Array.from({length:3},()=>svc.harvest('u1',before.flower.id,'nickname')));assert(harvests.every(h=>h.entry.id===before.flower.id));assert.equal((await query('SELECT count(*)::int count FROM hatask_flower_harvest'))[0].count,1);assert(harvests.every(h=>h.entry.memory.includes('ＡＢＣ')));assert.equal((await query('SELECT count(*)::int count FROM hatask_flower'))[0].count,1);console.log('PASS concurrent harvest inserts once, reconciles legacy sync, and retains own memory');
await query('UPDATE meta SET "hataskFlowerRules"=jsonb_set("hataskFlowerRules",\'{festivalGoal}\',\'2\')');
await query('DELETE FROM hatask_flower_festival');await svc.show('u2','Asia/Tokyo');
await Promise.all([svc.pour('u1','festival','f1'),svc.pour('u2','festival','f2')]);
const festival=(await svc.show('u1')).festival;assert.equal(festival.total,2);assert(festival.bloomedAt);assert.equal((await query("SELECT count(*)::int count FROM hatask_flower_notice WHERE type='hataskFestivalBloomed'"))[0].count,2);console.log('PASS concurrent festival full bloom and both participant notices');
await query('UPDATE hatask_drop_wallet SET drops=1 WHERE "userId"=$1',['u1']);
const raced=await Promise.allSettled(['last1','last2'].map(id=>svc.pour('u1','self',id)));assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal((await svc.show('u1')).drops,0);console.log('PASS one remaining drop cannot be overspent');
} finally {
 await query(`DROP SCHEMA ${schema} CASCADE`);
 await pool.end();
 rmSync(work,{recursive:true,force:true});
}
