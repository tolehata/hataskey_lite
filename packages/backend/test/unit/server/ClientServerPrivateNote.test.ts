/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';

type Reply = {
	raw: object;
	header: ReturnType<typeof vi.fn>;
	removeHeader: ReturnType<typeof vi.fn>;
	view: ReturnType<typeof vi.fn>;
};
type Handler = (request: { params: { note: string } }, reply: Reply) => Promise<unknown>;
const source = readFileSync(resolve(process.cwd(), 'src/server/web/ClientServerService.ts'), 'utf8');
const file = ts.createSourceFile('ClientServerService.ts', source, ts.ScriptTarget.Latest, true);
const declaration = file.statements.find((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === 'ClientServerService');
const createServer = declaration?.members.find((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(file) === 'createServer');
const paths = ['/notes/:note', '/embed/notes/:note'];
const registrations = createServer?.body?.statements.filter(statement => ts.isExpressionStatement(statement)
	&& ts.isCallExpression(statement.expression)
	&& statement.expression.arguments.some(arg => ts.isStringLiteral(arg) && paths.includes(arg.text)));
if (registrations?.length !== paths.length) throw new Error('Public note route registrations were not found');
// Execute the real route callbacks with repository/rendering substitutes. No HTTP
// listener, external request, browser, or runtime server dependencies are needed.
const code = ts.transpileModule(`function register(fastify) { ${registrations.map(statement => statement.getText(file)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const register = runInNewContext(`${code}\nregister`, {
	PrivateChannelNoteVisibilityError,
	In: (values: unknown) => values,
	vary: () => {},
	getNoteSummary: () => 'public note summary',
	htmlSafeJsonStringify: JSON.stringify,
	renderBase: (reply: Reply) => reply.view('base', { title: 'public site shell' }),
}) as (this: object, fastify: { get: (path: string, handler: Handler) => void }) => void;

function fixture(pack: () => Promise<unknown>, exists = true) {
	const note = { id: 'secret-note', userId: 'author', userHost: null, visibility: 'public', user: { requireSigninToViewContents: false } };
	const service = {
		meta: { ugcVisibilityForVisitor: 'all' },
		notesRepository: { findOne: vi.fn().mockResolvedValue(exists ? note : null) },
		noteEntityService: { pack: vi.fn(pack) },
		userProfilesRepository: { findOneByOrFail: vi.fn().mockResolvedValue({}) },
		generateCommonPugData: async () => ({}),
	};
	const routes = new Map<string, Handler>();
	register.call(service, { get: (path, handler) => routes.set(path, handler) });
	const route = (path: string): Handler => {
		const handler = routes.get(path);
		if (handler === undefined) throw new Error(`Missing registered route: ${path}`);
		return handler;
	};
	const reply: Reply = { raw: {}, header: vi.fn(), removeHeader: vi.fn(), view: vi.fn((template, data) => ({ template, data })) };
	return { service, reply, route, request: { params: { note: note.id } } };
}

describe('private channel notes in public HTML', () => {
	test('returns the ordinary site shell without note OGP or client context', async () => {
		const f = fixture(async () => { throw new PrivateChannelNoteVisibilityError(); });
		const missing = fixture(async () => null, false);
		const result = await f.route('/notes/:note')(f.request, f.reply);
		expect(result).toEqual(await missing.route('/notes/:note')(missing.request, missing.reply));
		expect(f.reply.view).toHaveBeenCalledWith('base', { title: 'public site shell' });
		expect(f.service.userProfilesRepository.findOneByOrFail).not.toHaveBeenCalled();
		expect(JSON.stringify(result)).not.toContain('secret-note');
	});

	test('preserves OGP and client context for public notes', async () => {
		const packed = { id: 'public-note', text: 'public body', user: { avatarUrl: '/avatar.webp' } };
		const f = fixture(async () => packed);
		await f.route('/notes/:note')(f.request, f.reply);
		expect(f.reply.view).toHaveBeenCalledWith('note', expect.objectContaining({ note: packed, clientCtx: JSON.stringify({ note: packed }) }));
	});

	test('returns no embedded context for inaccessible notes, matching absent notes', async () => {
		const f = fixture(async () => { throw new PrivateChannelNoteVisibilityError(); });
		const missing = fixture(async () => null, false);
		const result = await f.route('/embed/notes/:note')(f.request, f.reply);
		expect(result).toBe(await missing.route('/embed/notes/:note')(missing.request, missing.reply));
		expect(f.reply.view).not.toHaveBeenCalled();
		expect(f.reply.header).not.toHaveBeenCalled();
	});

	test('preserves public embedded notes', async () => {
		const packed = { id: 'public-note', text: 'public body' };
		const f = fixture(async () => packed);
		await f.route('/embed/notes/:note')(f.request, f.reply);
		expect(f.reply.view).toHaveBeenCalledWith('base-embed', expect.objectContaining({ embedCtx: JSON.stringify({ note: packed }) }));
	});

	test.each(paths)('does not mask unrelated packing failures in %s', async path => {
		const error = new Error('database unavailable');
		const f = fixture(async () => { throw error; });
		await expect(f.route(path)(f.request, f.reply)).rejects.toBe(error);
	});
});
