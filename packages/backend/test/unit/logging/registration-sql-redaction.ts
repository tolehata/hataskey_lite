/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';
import { bindThis } from '@/decorators.js';
import { redactRegistrationApplicationSql } from '@/logging/registration-sql-redaction.js';

const sentinel = 'sns-private-sentinel-a318@contacts.invalid';
const levels = ['info', 'error', 'warn'] as const;
type Level = typeof levels[number];
type SqlLogger = {
	logQuery(query: string, parameters?: unknown[], runner?: unknown): void;
	logQueryError(error: string, query: string, parameters?: unknown[], runner?: unknown): void;
	logQuerySlow(time: number, query: string, parameters?: unknown[], runner?: unknown): void;
};

// 実際のSQL loggerを実行する。DB・全entityの初期化を避けるため、ソースの対象宣言だけをそのままコンパイルする。
const source = ts.createSourceFile('postgres.ts', readFileSync(resolve(process.cwd(), 'src/postgres.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['highlightSql', 'truncateSql', 'stringifyParameter', 'MyCustomLogger'];
const declarations = names.map(name => {
	const node = source.statements.find(statement => (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name);
	if (!node) throw new Error(`SQL logger declaration is missing: ${name}`);
	return node.getText(source);
});
const compiledLogger = ts.transpileModule(declarations.join('\n'), {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText;

function createLogger(options: { enableQueryParamLogging?: boolean; disableQueryTruncation?: boolean; printReplicationMode?: boolean } = {}) {
	const output = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
	const Constructor = runInNewContext(`${compiledLogger}\nMyCustomLogger;`, {
		sqlLogger: output,
		highlight: { highlight: (query: string) => query },
		bindThis,
		redactRegistrationApplicationSql,
		Date,
	}) as new (props: typeof options) => SqlLogger;
	return { logger: new Constructor(options), output };
}

function logAt(logger: SqlLogger, level: Level, query: string, parameters?: unknown[], runner?: unknown) {
	if (level === 'info') logger.logQuery(query, parameters, runner);
	else if (level === 'error') logger.logQueryError(`error detail/message/params: ${sentinel}`, query, parameters, runner);
	else logger.logQuerySlow(500, query, parameters, runner);
}

describe('registration SQL log privacy', () => {
	test.each([
		'INSERT INTO "registration_application" ("additionalContacts") VALUES ($1)',
		'UPDATE REGISTRATION_APPLICATION SET "additionalContacts" = $1',
		'DELETE FROM public."registration_application" WHERE id = $1',
		'SELECT r.* FROM "user" u JOIN "registration_application" r ON r."userId" = u.id',
		`/* ${'padding '.repeat(30)} */ SELECT * FROM "registration_application" WHERE "additionalContacts" = '${sentinel}'`,
	])('redacts the whole statement and positional values: %s', query => {
		const safe = redactRegistrationApplicationSql(query, [sentinel]);
		expect(safe).toEqual({ query: '[REDACTED registration_application SQL]', parameters: undefined });
		expect(JSON.stringify(safe)).not.toContain(sentinel);
	});

	test('positive control: leaves ordinary SQL and its parameters unchanged', () => {
		const query = `SELECT '${sentinel}' FROM "note" WHERE id = $1`;
		const parameters = [sentinel, new Date('2026-08-31T00:00:00.000Z')];
		const safe = redactRegistrationApplicationSql(query, parameters);
		expect(safe.query).toBe(query);
		expect(safe.parameters).toBe(parameters);
		expect(JSON.stringify(safe)).toContain(sentinel);
	});

	test.each(levels)('%s executes the real logger without exposing contact SQL, parameters or raw errors', level => {
		for (const disableQueryTruncation of [false, true]) {
			const { logger, output } = createLogger({ enableQueryParamLogging: true, disableQueryTruncation, printReplicationMode: true });
			const query = `/* ${sentinel} ${'prefix '.repeat(25)} */ INSERT INTO "registration_application" ("additionalContacts") VALUES ('${sentinel}')`;
			logAt(logger, level, query, [sentinel, { additionalContacts: sentinel }], { getReplicationMode: () => 'master' });
			expect(output[level]).toHaveBeenCalledExactlyOnceWith('[master] [REDACTED registration_application SQL]', undefined);
			expect(JSON.stringify(output[level].mock.calls)).not.toContain(sentinel);
		}
	});

	test.each(levels)('positive control: %s preserves ordinary query text, parameter settings and date formatting', level => {
		const query = 'SELECT * FROM "note" WHERE id = $1';
		const parameters = [sentinel, new Date('2026-08-31T00:00:00.000Z')];
		const enabled = createLogger({ enableQueryParamLogging: true });
		logAt(enabled.logger, level, query, parameters);
		expect(enabled.output[level]).toHaveBeenCalledExactlyOnceWith(query, [sentinel, '2026-08-31T00:00:00.000Z']);
		expect(JSON.stringify(enabled.output[level].mock.calls)).toContain(sentinel);

		const disabled = createLogger();
		logAt(disabled.logger, level, query, parameters);
		expect(disabled.output[level]).toHaveBeenCalledExactlyOnceWith(query, undefined);
	});

	test('never reads positional values of private SQL and retains ordinary query truncation', () => {
		const { logger, output } = createLogger({ enableQueryParamLogging: true });
		const parameters = new Proxy([], { get: () => { throw new Error('parameters must not be inspected'); } });
		logger.logQuery('SELECT * FROM registration_application', parameters);
		expect(output.info).toHaveBeenLastCalledWith('[REDACTED registration_application SQL]', undefined);

		const ordinaryQuery = `SELECT ${'id, '.repeat(40)}id FROM "note"`;
		logger.logQuery(ordinaryQuery, ['visible']);
		expect(output.info).toHaveBeenLastCalledWith(`${ordinaryQuery.slice(0, 100)}...`, ['visible']);
	});
});
