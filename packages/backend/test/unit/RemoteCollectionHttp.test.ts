/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as http from 'node:http';
import * as https from 'node:https';
import { Socket } from 'node:net';
import ts from 'typescript';
import { afterEach, describe, expect, test, vi } from 'vitest';
import fetch, { Response } from 'node-fetch';
import { HttpRequestService } from '@/core/HttpRequestService.js';

vi.mock('node-fetch', async importOriginal => ({ ...await importOriginal<typeof import('node-fetch')>(), default: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const source = readFileSync(resolve(process.cwd(), 'src/core/activitypub/models/ApPersonService.ts'), 'utf8');
const ast = ts.createSourceFile('ApPersonService.ts', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(ts.isClassDeclaration)!;

function collectionFetches(method: string) {
	const member = declaration.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === method) as ts.MethodDeclaration;
	const statements = [...member.body!.statements];
	const start = statements.findIndex(node => node.getText(ast).startsWith('let followersCount:'));
	const end = statements.findIndex((node, index) => index > start && node.getText(ast).startsWith(method === 'createPerson' ? 'let user:' : 'const updates ='));
	if (start < 0 || end < 0) throw new Error('Missing production collection fetches');
	const code = statements.slice(start, end).map(node => node.getText(ast)).join('\n');
	return (person: unknown, httpRequestService: unknown) => runInNewContext(ts.transpileModule(`(async function () { ${code}; return { followersCount, followingCount, notesCount }; }).call({ httpRequestService })`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
		person, httpRequestService, fetch: () => { throw new Error('Unprotected fetch used'); },
	});
}

describe('remote actor collection statistics', () => {
	test.each(['createPerson', 'updatePerson'])('%s uses protected HTTP for all three same-host URLs and tolerates unavailable counts', async method => {
		const run = collectionFetches(method);
		const person = { followers: 'https://remote.example/followers', following: 'https://remote.example/following', outbox: 'https://remote.example/outbox' };
		const getJson = vi.fn().mockResolvedValue({ totalItems: 12 });
		expect(await run(person, { getJson })).toEqual({ followersCount: 12, followingCount: 12, notesCount: 12 });
		for (const url of Object.values(person)) expect(getJson).toHaveBeenCalledWith(url, 'application/json');
		expect(getJson).toHaveBeenCalledTimes(3);
		getJson.mockRejectedValue(new Error('Blocked address'));
		expect(await run(person, { getJson })).toEqual({ followersCount: undefined, followingCount: undefined, notesCount: undefined });
		getJson.mockClear();
		await run({ followers: { type: 'Collection', totalItems: 9 } }, { getJson });
		expect(getJson).not.toHaveBeenCalled();
	});

	test.each(['http:', 'https:'])('every redirected %s connection uses the private-address guard', async protocol => {
		vi.stubEnv('NODE_ENV', 'production');
		vi.useFakeTimers();
		const service = new HttpRequestService({ userAgent: 'test', allowedPrivateNetworks: [] } as never);
		const initial = new URL('https://remote.example/followers');
		const redirected = new URL(`${protocol}//127.0.0.1/private`);
		const selected: string[] = [];
		vi.mocked(fetch).mockImplementation(async (_url, options) => {
			for (const url of [initial, redirected]) {
				const agent = (options!.agent as (url: URL) => http.Agent)(url);
				selected.push(url.href);
				const socket = new Socket();
				Object.defineProperty(socket, 'remoteAddress', { value: url === initial ? '93.184.216.34' : '127.0.0.1' });
				const destroy = vi.spyOn(socket, 'destroy').mockReturnValue(socket);
				const base = vi.spyOn(url.protocol === 'https:' ? https.Agent.prototype : http.Agent.prototype, 'createConnection').mockReturnValue(socket);
				try {
					agent.createConnection({}); socket.emit('connect');
					if (url === initial) expect(destroy).not.toHaveBeenCalled();
					else {
						expect(destroy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Blocked address: 127.0.0.1' }));
						throw destroy.mock.calls[0][0];
					}
				} finally { base.mockRestore(); }
			}
			return new Response('{}');
		});
		await expect(service.getJson(initial.href, 'application/json')).rejects.toThrow('Blocked address');
		expect(selected).toEqual([initial.href, redirected.href]);
	});

	test('limits response bodies and aborts stalled collection fetches', async () => {
		vi.useFakeTimers();
		const service = new HttpRequestService({ userAgent: 'test' } as never);
		vi.mocked(fetch).mockImplementation(async (_url, options) => {
			const responseOptions = { status: 200, size: options!.size };
			return new Response(JSON.stringify({ padding: 'x'.repeat(256 * 1024) }), responseOptions);
		});
		await expect(service.getJson('https://remote.example/followers')).rejects.toThrow(/max-size|over limit/i);
		vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
		const request = expect(service.getJson('https://remote.example/followers')).rejects.toThrow('aborted');
		await vi.advanceTimersByTimeAsync(5000);
		await request;
	});
});
