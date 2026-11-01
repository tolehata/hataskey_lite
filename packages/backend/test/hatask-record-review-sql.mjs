/* SPDX-License-Identifier: AGPL-3.0-only */
// Emit the isolated SQL fixture for psql with ON_ERROR_STOP=1. Requires a current backend build.
import { readFileSync } from 'node:fs';
import { HataskRecordReviewService } from '../built/core/HataskRecordReviewService.js';
import { HATASK_REVIEW_CTE, normalizeReviewOptions, reviewHash } from '../built/core/hatask-record-review.js';
import { AddHataskRecordReview1789260000000 } from '../migration/1789260000000-add-hatask-record-review.js';

const migration = [];
await new AddHataskRecordReview1789260000000().up({ query: async sql => migration.push(sql.replace('CREATE TABLE', 'CREATE TEMP TABLE') + ';') });

const queries = [];
const service = new HataskRecordReviewService({ query: async (sql, params) => {
	const literal = value => typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
	queries.push(`PREPARE hatask_list_${queries.length} AS ${sql};\nEXECUTE hatask_list_${queries.length}(${params.map(literal).join(',')});`);
	return [{ items: [], total: 0, kinds: {}, states: {} }];
} }, { isModerator: async () => true }, { packMany: async () => [] });
await service.list({ id: 'mod' }, {});
await service.list({ id: 'mod' }, { query: 'メモ', userId: 'owner', kind: 'event', state: 'unread', visibility: 'specified', dateFrom: '2026-09-01', dateTo: '2026-09-30', sort: 'oldest' });
const options = { limit: 2 };
const cursor = Buffer.from(JSON.stringify({ filter: reviewHash(normalizeReviewOptions(options)), date: '2026-09-16', time: '', id: 'f'.repeat(64) })).toString('base64url');
await service.list({ id: 'mod' }, { ...options, cursor });
process.stdout.write(readFileSync('test/fixtures/hatask-record-review.sql', 'utf8')
	.replace('-- HATASK_RECORD_REVIEW_MIGRATION', () => migration.join('\n'))
	.replace('-- HATASK_RECORD_REVIEW_CTE', () => HATASK_REVIEW_CTE)
	.replace('-- HATASK_RECORD_REVIEW_LIST_QUERIES', () => queries.join('\n')));
