/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';

type Request = { params: { note: string; like: string; user: string }; query: { page: string } };
type Reply = { raw: object; code: ReturnType<typeof vi.fn>; header: ReturnType<typeof vi.fn> };
type Handler = (request: Request, reply: Reply) => Promise<unknown>;
type Harness = { canServeNote: (note: object, request: Request) => Promise<boolean>; featured: Handler; outbox: Handler };
const source = readFileSync(resolve(process.cwd(), 'src/server/ActivityPubServerService.ts'), 'utf8');
const file = ts.createSourceFile('ActivityPubServerService.ts', source, ts.ScriptTarget.Latest, true);
const declaration = file.statements.find((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === 'ActivityPubServerService');
if (!declaration) throw new Error('ActivityPubServerService was not found');
const selected = ['canServeNote', 'featured', 'outbox'].map(name => {
	const method = declaration.members.find((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(file) === name);
	if (!method) throw new Error(`Missing real method: ${name}`);
	const modifiers = method.modifiers?.filter(modifier => !ts.isDecorator(modifier));
	return ts.factory.updateMethodDeclaration(method, modifiers, method.asteriskToken, method.name, method.questionToken, method.typeParameters, method.parameters, method.type, method.body);
});
const harness = ts.factory.createClassDeclaration(undefined, 'Harness', undefined, undefined, selected);
const paths = ['/notes/:note', '/notes/:note/activity', '/likes/:like'];
const createServer = declaration.members.find((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(file) === 'createServer');
const registrations = createServer?.body?.statements.filter(statement => ts.isExpressionStatement(statement)
	&& ts.isCallExpression(statement.expression)
	&& statement.expression.arguments.some(arg => ts.isStringLiteral(arg) && paths.includes(arg.text)));
if (registrations?.length !== paths.length) throw new Error('Public ActivityPub note routes were not found');
// Preserve actual route/method bodies, replacing transport, database, and renderer
// dependencies only. These checks never contact a federation peer.
const code = ts.transpileModule(`${ts.createPrinter().printNode(ts.EmitHint.Unspecified, harness, file)}\nfunction register(fastify) { ${registrations.map(statement => statement.getText(file)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = runInNewContext(`${code}\n({ Harness, register })`, {
	In: (values: unknown) => values, IsNull: () => null, vary: () => {},
	countIf: (predicate: (value: unknown) => boolean, values: unknown[]) => values.filter(predicate).length,
	url: { query: () => '' },
}) as { Harness: new () => Harness; register: (this: object, fastify: { get: (path: string, ...args: unknown[]) => void }) => void };

function fixture(visible = false, deliveryAllowed = true) {
	const note = { id: 'private-note', userId: 'author', userHost: null, visibility: 'public', localOnly: false };
	const renderer = vi.fn().mockResolvedValue({ id: 'rendered-note' });
	const service = Object.assign(new loaded.Harness(), {
		config: { url: 'https://local.test' }, meta: { federation: 'all', enableFanoutTimeline: false },
		notesRepository: { findOneBy: async () => note, findOneByOrFail: async () => note },
		noteReactionsRepository: { findOneBy: async () => ({ id: 'reaction', noteId: note.id }) },
		usersRepository: { findOneBy: async () => ({ id: 'author', notesCount: 1 }) },
		userNotePiningsRepository: { find: async () => [{ noteId: note.id }] },
		noteEntityService: {
			isChannelVisibleForMe: vi.fn().mockResolvedValue(visible),
			filterChannelVisibleNotes: vi.fn(async (notes: object[]) => visible ? notes : []),
		},
		activityPubAccessControlService: { checkNoteAccess: vi.fn().mockResolvedValue(deliveryAllowed) },
		applyAccessControl: async () => false, setResponseType: vi.fn(), getUserNotesFromDb: async () => [note],
		packActivity: renderer,
		apRendererService: { addContext: (value: unknown) => value, renderNote: renderer, renderLike: renderer, renderOrderedCollection: vi.fn(), renderOrderedCollectionPage: vi.fn() },
	});
	const routes = new Map<string, Handler>();
	loaded.register.call(service, { get: (path, ...args) => routes.set(path, args.at(-1) as Handler) });
	const route = (path: string): Handler => {
		const handler = routes.get(path);
		if (handler === undefined) throw new Error(`Missing registered route: ${path}`);
		return handler;
	};
	const reply: Reply = { raw: {}, code: vi.fn(), header: vi.fn() };
	const request: Request = { params: { note: note.id, like: 'reaction', user: 'author' }, query: { page: 'true' } };
	return { service, route, reply, request, renderer, note };
}

describe('public ActivityPub private note access', () => {
	test.each(paths)('%s returns 404 before rendering a private note or a private reference', async path => {
		const f = fixture();
		await f.route(path)(f.request, f.reply);
		expect(f.reply.code).toHaveBeenCalledWith(404);
		expect(f.service.noteEntityService.isChannelVisibleForMe).toHaveBeenCalledWith(f.note, null);
		expect(f.renderer).not.toHaveBeenCalled();
		expect(f.reply.header).not.toHaveBeenCalled();
	});

	test.each(paths)('%s still renders allowed public notes', async path => {
		const f = fixture(true);
		await f.route(path)(f.request, f.reply);
		expect(f.renderer).toHaveBeenCalledOnce();
		expect(f.service.activityPubAccessControlService.checkNoteAccess).toHaveBeenCalledWith(f.note, f.request);
	});

	test('preserves delivery-target rejection after channel visibility passes', async () => {
		const f = fixture(true, false);
		await f.route('/notes/:note')(f.request, f.reply);
		expect(f.reply.code).toHaveBeenCalledWith(404);
		expect(f.renderer).not.toHaveBeenCalled();
	});

	test.each(['followers', 'specified'])('Like dereference does not expose %s-note relationship metadata', async visibility => {
		const f = fixture(true);
		f.note.visibility = visibility;
		await f.route('/likes/:like')(f.request, f.reply);
		expect(f.reply.code).toHaveBeenCalledWith(404);
		expect(f.renderer).not.toHaveBeenCalled();
		expect(f.reply.header).not.toHaveBeenCalled();
	});

	test('Like dereference rejects local-only notes even when publicly visible locally', async () => {
		const f = fixture(true);
		f.note.localOnly = true;
		await f.route('/likes/:like')(f.request, f.reply);
		expect(f.reply.code).toHaveBeenCalledWith(404);
		expect(f.renderer).not.toHaveBeenCalled();
	});

	test.each(['public', 'home'])('Like dereference preserves %s federated notes', async visibility => {
		const f = fixture(true);
		f.note.visibility = visibility;
		await f.route('/likes/:like')(f.request, f.reply);
		expect(f.renderer).toHaveBeenCalledOnce();
		expect(f.reply.code).not.toHaveBeenCalled();
	});

	test.each(['featured', 'outbox'] as const)('%s removes hidden references before rendering collections', async method => {
		const f = fixture();
		await f.service[method](f.request, f.reply);
		expect(f.service.noteEntityService.filterChannelVisibleNotes).toHaveBeenCalledWith([f.note], null);
		expect(f.renderer).not.toHaveBeenCalled();
	});
});
