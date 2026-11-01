/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { computed, ref, shallowRef } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { createPostFormRecipients } from './post-form-recipients.js';
import type * as Misskey from 'cherrypick-js';

// Exercise the actual setup, restore callbacks and submission methods, without
// importing unrelated editor/upload UI. This also runs against the old source.
const source = readFileSync(resolvePath(process.cwd(), 'src/components/MkPostForm.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
const ast = ts.createSourceFile('MkPostForm.ts', source, ts.ScriptTarget.Latest, true);
const stateNames = ['visibleRecipients', 'visibleUsers', 'canPost'];
const functionNames = ['pushVisibleUser', 'addVisibleUser', 'removeVisibleUser', 'saveDraft', 'saveServerDraft', 'post', 'postAsScheduled'];
const statements = ast.statements.filter(node =>
	(ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => stateNames.includes(declaration.name.getText(ast)))) ||
	(ts.isFunctionDeclaration(node) && node.name != null && functionNames.includes(node.name.text)) ||
	(ts.isIfStatement(node) && node.expression.getText(ast).startsWith('replyTargetNote.value && [\'home\'')),
).map(node => node.getText(ast)).join('\n');
let restoreServerDraft = '';

function visit(node: ts.Node): void {
	if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'restore' && ts.isArrowFunction(node.initializer)) {
		restoreServerDraft = node.initializer.getText(ast);
	}
	ts.forEachChild(node, visit);
}

visit(ast);

function user(id: string): Misskey.entities.UserDetailed {
	return { id, username: id, host: null } as Misskey.entities.UserDetailed;
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

function setup() {
	const usersRequests: { ids: string[]; request: ReturnType<typeof deferred<Misskey.entities.UserDetailed[] | Misskey.entities.UserDetailed>> }[] = [];
	const api = vi.fn((endpoint: string, params: { userIds?: string[]; userId?: string }) => {
		if (endpoint === 'users/show') {
			const request = deferred<Misskey.entities.UserDetailed[] | Misskey.entities.UserDetailed>();
			usersRequests.push({ ids: params.userIds ?? (params.userId ? [params.userId] : []), request });
			return request.promise;
		}
		return Promise.resolve({ createdNote: null });
	});
	const storage = new Map<string, string>();
	const values = {
		text: ref('reply'), textLength: ref(5), maxTextLength: ref(3000), cwTextLength: ref(0), maxCwTextLength: 100,
		visibility: ref('public'), localOnly: ref(false), useCw: ref(false), cw: ref(null),
		files: ref<Misskey.entities.DriveFile[]>([]), poll: ref(null), event: ref(null), quoteId: ref(null),
		replyTargetNote: ref({ id: 'reply-note', userId: 'alice', visibility: 'specified', visibleUserIds: ['me', 'alice', 'bob'], user: user('alice') }),
		renoteTargetNote: ref(null), targetChannel: ref<{ id: string } | null>(null), scheduledAt: ref<number | null>(null),
		scheduledNoteDelete: ref(null), saveToDraft: ref(false), posting: ref(false), posted: ref(false),
		submitMotionState: ref('idle'), reactionAcceptance: ref(null), disableRightClick: ref(false),
		deliveryTargets: ref(null), withHashtags: ref(false), hashtags: ref(''), postAccount: ref(null),
		useExternalAccount: ref(false), serverDraftId: ref(null), draftKey: ref('reply:reply-note'),
		textareaEl: ref(null), postSendDelayEnabled: ref(false),
	};
	const actions = vi.fn().mockResolvedValue({ canceled: false, result: 'ignore' });
	const selectUser = vi.fn();
	const context = {
		...values, ref, shallowRef, computed, createPostFormRecipients, misskeyApi: api,
		props: { mock: false, instant: false }, $i: { id: 'me' },
		uploader: { uploading: ref(false), items: ref<{ uploaded: unknown }[]>([]), readyForUpload: ref(true) },
		postDelay: { active: ref(false) }, prefer: { s: { animation: false, showNoAltTextWarning: false } },
		miLocalStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
		os: { actions, selectUser, alert: vi.fn(), toast: vi.fn() }, i18n: { ts: { _altWarning: {} } },
		normalizeDeliveryTargets: () => null, getPluginHandlers: () => [],
		uploadFiles: vi.fn(), clear: vi.fn(), emit: vi.fn(), waitForSubmitMotion: () => Promise.resolve(),
		nextTick: vi.fn(), haptic: vi.fn(), sound: { playMisskeySfx: vi.fn() },
		isAnnoying: () => false, output: undefined,
	};
	const compiled = ts.transpileModule(`${statements}\noutput = { canPost, post, saveServerDraft, saveDraft, addVisibleUser, visibleUsers, restoreServerDraft: ${restoreServerDraft}, recipients: typeof visibleRecipients === 'undefined' ? null : visibleRecipients };`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
	}).outputText;
	runInNewContext(compiled, context);
	const form = context.output as unknown as {
		canPost: { value: boolean };
		post: () => Promise<void>;
		addVisibleUser: () => void;
		saveServerDraft: () => Promise<void>;
		saveDraft: () => void;
		visibleUsers: { value: Misskey.entities.UserDetailed[] };
		restoreServerDraft: (draft: Partial<Misskey.entities.NoteDraft>) => Promise<void>;
		recipients: ReturnType<typeof createPostFormRecipients>;
	};
	return { form, api, storage, usersRequests, values, actions, selectUser, context };
}

async function settleUsers(view: ReturnType<typeof setup>): Promise<void> {
	for (const { ids, request } of view.usersRequests) {
		const call = view.api.mock.calls.find(([endpoint, params]) => endpoint === 'users/show' && (params.userIds === ids || params.userId === ids[0]));
		request.resolve(call?.[1].userId ? user(ids[0]) : ids.map(user));
	}
	await Promise.resolve();
	await Promise.resolve();
}

describe('standard composer direct-recipient submission', () => {
	it.each(['specified', 'followers'] as const)('restores a %s draft outside the previous channel without widening its audience', async visibility => {
		const view = setup();
		await settleUsers(view);
		view.values.targetChannel.value = { id: 'old-channel' };
		await view.form.restoreServerDraft({ id: 'draft', text: 'private draft', visibility, visibleUserIds: visibility === 'specified' ? ['bob'] : [] });
		await settleUsers(view);
		await view.form.post();
		expect(view.values.targetChannel.value).toBeNull();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({
			visibility, channelId: undefined, visibleUserIds: visibility === 'specified' ? ['bob'] : undefined,
		}), undefined);
	});

	it('keeps the saved channel for an ordinary public channel draft', async () => {
		const view = setup();
		await settleUsers(view);
		await view.form.restoreServerDraft({ id: 'draft', text: 'channel draft', visibility: 'public', channel: { id: 'saved-channel' } as Misskey.entities.NoteDraft['channel'] });
		await settleUsers(view);
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ visibility: 'public', channelId: 'saved-channel' }), undefined);
	});

	it('disables fast send and refuses a programmatic post while reply recipients are unresolved', async () => {
		const view = setup();
		await view.form.post();
		expect(view.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/create')).toEqual([]);
		expect(view.form.canPost.value).toBe(false);
	});

	it('includes the author and other group recipients after hydration, without the signed-in user', async () => {
		const view = setup();
		await settleUsers(view);
		expect(view.form.canPost.value).toBe(true);
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ visibility: 'specified', visibleUserIds: expect.arrayContaining(['alice', 'bob']) }), undefined);
	});

	it('does not schedule or save a server draft with an incomplete audience', async () => {
		const view = setup();
		view.values.scheduledAt.value = Date.now() + 60_000;
		await view.form.post();
		await view.form.saveServerDraft();
		expect(view.api.mock.calls.filter(([endpoint]) => endpoint.startsWith('notes/'))).toEqual([]);
		expect(view.context.clear).not.toHaveBeenCalled();
	});

	it('clears a successfully scheduled draft exactly once', async () => {
		const view = setup();
		await settleUsers(view);
		view.values.scheduledAt.value = Date.now() + 60_000;
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/drafts/create', expect.objectContaining({ isActuallyScheduled: true, visibleUserIds: expect.arrayContaining(['alice', 'bob']) }));
		expect(view.context.clear).toHaveBeenCalledOnce();
	});

	it('autosaves intended recipient IDs before users/show finishes', () => {
		const view = setup();
		view.form.saveDraft();
		const draft = JSON.parse(view.storage.get('drafts') ?? '{}')['reply:reply-note'];
		expect(draft.data.visibleUserIds).toEqual(['alice', 'bob']);
	});

	it('keeps a failed lookup blocked, then sends to the whole audience after retry', async () => {
		const view = setup();
		view.usersRequests[0].request.reject(new Error('offline'));
		await Promise.resolve();
		await Promise.resolve();
		expect(view.form.canPost.value).toBe(false);
		await view.form.post();
		expect(view.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/create')).toEqual([]);
		const retry = view.form.recipients.retry();
		await settleUsers(view);
		await retry;
		expect(view.form.canPost.value).toBe(true);
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ visibleUserIds: expect.arrayContaining(['alice', 'bob']) }), undefined);
	});

	it('requires an explicit removal before a missing recipient can be excluded', async () => {
		const view = setup();
		view.usersRequests[0].request.resolve([user('alice')]);
		await Promise.resolve();
		await Promise.resolve();
		expect(view.form.canPost.value).toBe(false);
		expect(view.form.recipients.missingIds.value).toEqual(['bob']);
		view.form.recipients.remove('bob');
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ visibleUserIds: ['alice'] }), undefined);
	});

	it('does not add recipients from the old reply to a server draft restored during loading', async () => {
		const view = setup();
		await view.form.restoreServerDraft({ id: 'server-draft', text: 'different conversation', visibility: 'specified', visibleUserIds: ['carol'] });
		await settleUsers(view);
		await view.form.post();
		expect(view.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'different conversation', visibleUserIds: ['carol'] }), undefined);
		expect(view.form.visibleUsers.value.map(u => u.id)).toEqual(['carol']);
		expect(view.usersRequests.filter(({ ids }) => ids.includes('carol'))).toHaveLength(1);
	});

	it('ignores a user selected for the prior draft after a server draft is restored', async () => {
		const view = setup();
		const selection = deferred<Misskey.entities.UserDetailed>();
		view.selectUser.mockReturnValue(selection.promise);
		view.form.addVisibleUser();
		await view.form.restoreServerDraft({ id: 'server-draft', text: 'different conversation', visibility: 'specified', visibleUserIds: ['carol'] });
		selection.resolve(user('old-recipient'));
		await Promise.resolve();
		expect(view.form.recipients.userIds.value).toEqual(['carol']);
		expect(view.values.text.value).toBe('different conversation');
	});

	it('keeps the draft when recipient restoration interrupts a scheduled upload', async () => {
		const view = setup();
		await settleUsers(view);
		const upload = deferred<void>();
		view.values.scheduledAt.value = Date.now() + 60_000;
		view.context.uploader.items.value = [{ uploaded: null }];
		view.context.uploadFiles.mockReturnValueOnce(upload.promise);
		const post = view.form.post();
		await view.form.restoreServerDraft({ id: 'server-draft', text: 'different conversation', visibility: 'specified', visibleUserIds: ['carol'], scheduledAt: Date.now() + 60_000 });
		view.context.uploader.items.value = [];
		upload.resolve();
		await post;
		expect(view.api.mock.calls.filter(([endpoint]) => endpoint.startsWith('notes/'))).toEqual([]);
		expect(view.context.clear).not.toHaveBeenCalled();
	});

	it('rechecks recipient hydration after an asynchronous warning', async () => {
		const view = setup();
		await settleUsers(view);
		const warning = deferred<{ canceled: boolean; result: string }>();
		view.context.prefer.s.showNoAltTextWarning = true;
		view.values.files.value = [{ id: 'file', comment: null } as unknown as Misskey.entities.DriveFile];
		view.actions.mockReturnValueOnce(warning.promise);
		const post = view.form.post();
		await view.form.restoreServerDraft({ id: 'server-draft', text: 'different conversation', visibility: 'specified', visibleUserIds: ['carol'] });
		warning.resolve({ canceled: false, result: 'ignore' });
		await post;
		expect(view.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/create')).toEqual([]);
	});
});
