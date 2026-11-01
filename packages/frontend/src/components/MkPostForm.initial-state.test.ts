/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { deepClone } from '@/utility/clone.js';
import type { PostFormProps } from '@/types/post-form.js';
import { hk3CanAdoptPostForm } from './hataskey3/hk3-state.js';
import { createPostFormRecipients } from './post-form-recipients.js';
import type * as Misskey from 'cherrypick-js';

const source = readFileSync(resolve(process.cwd(), 'src/components/MkPostForm.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
const ast = ts.createSourceFile('MkPostForm.ts', source, ts.ScriptTarget.Latest, true);
const initials = ast.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ['poll', 'event', 'reactionAcceptance'].includes(declaration.name.getText(ast)))).map(node => node.getText(ast)).join('\n');
let restore = '';

function visit(node: ts.Node) {
	if (ts.isIfStatement(node) && node.expression.getText(ast).startsWith('props.restoreDraft !== false')) restore = node.getText(ast);
	ts.forEachChild(node, visit);
}

visit(ast);

function initialize(props: PostFormProps) {
	const values: Record<string, { value: unknown }> = {};
	for (const key of ['text', 'useCw', 'cw', 'disableRightClick', 'saveToDraft', 'visibility', 'localOnly', 'files', 'quoteId', 'scheduledAt', 'scheduledNoteDelete', 'deliveryTargets']) values[key] = ref(null);
	values.text.value = props.initialText;
	values.files.value = props.initialFiles;
	const draft = { data: { text: 'unrelated saved text', files: [{ id: 'saved' }], poll: { choices: ['saved a', 'saved b'] }, event: { title: 'saved event' }, reactionAcceptance: 'likeOnly' } };
	const context = { props, ref, deepClone, store: { s: { reactionAcceptance: 'likeOnly' } }, ...values, draftKey: ref('note'), miLocalStorage: { getItem: () => JSON.stringify({ note: draft }) }, normalizeDeliveryTargets: () => [], output: undefined };
	expect(initials).not.toBe('');
	expect(restore).not.toBe('');
	const compiled = ts.transpileModule(initials + '\n' + restore + '\noutput = { poll, event, reactionAcceptance, text, files };', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
	runInNewContext(compiled, context);
	return context.output as unknown as Record<string, { value: unknown }>;
}

describe('explicit full composer initial state', () => {
	it('keeps incomplete poll/event inputs, explicit null reaction acceptance and draft text instead of a saved standard draft', () => {
		const props: PostFormProps = {
			restoreDraft: false, initialText: 'UI S draft', initialFiles: [],
			initialPoll: { choices: ['unfinished', ''], multiple: true, expiresAt: null, expiredAfter: 3600000 },
			initialEvent: { title: 'UI S event', start: '2026-09-27T00:00:00Z', end: null, metadata: {} },
			initialReactionAcceptance: null,
		};
		const result = initialize(props);
		expect(result.text.value).toBe('UI S draft');
		expect(result.poll.value).toEqual(props.initialPoll);
		expect(result.event.value).toEqual(props.initialEvent);
		expect(result.reactionAcceptance.value).toBeNull();
		(result.poll.value as { choices: string[] }).choices[0] = 'edited in full';
		(result.event.value as { title: string }).title = 'edited event';
		expect(props.initialPoll!.choices[0]).toBe('unfinished');
		expect(props.initialEvent!.title).toBe('UI S event');
	});
	it('keeps the profile default for omitted reaction acceptance and restores saved drafts by default', () => {
		expect(initialize({ restoreDraft: false }).reactionAcceptance.value).toBe('likeOnly');
		const restored = initialize({ initialText: 'incoming text' });
		expect(restored.text.value).toBe('unrelated saved text');
		expect(restored.files.value).toEqual([{ id: 'saved' }]);
	});
	it('falls back to the full form for advanced explicit inputs that the compact adopter cannot preserve', () => {
		for (const advanced of [{ initialPoll: { choices: ['', ''], multiple: false, expiresAt: null, expiredAfter: 1234 } }, { initialEvent: null }, { initialReactionAcceptance: null }, { restoreDraft: false }]) {
			expect(hk3CanAdoptPostForm({ channel: null, ...advanced })).toBe(false);
		}
		expect(hk3CanAdoptPostForm({ channel: null })).toBe(true);
	});
});

describe('direct reply standard-form fallback', () => {
	it.each(['author', 'me'])('hydrates the original audience asynchronously for a reply to %s', async authorId => {
		const reply = { id: 'direct', visibility: 'specified', userId: authorId, visibleUserIds: ['me', authorId, 'recipient'] } as NonNullable<PostFormProps['reply']>;
		expect(hk3CanAdoptPostForm({ reply })).toBe(false);
		const inheritance = ast.statements.find(node => ts.isIfStatement(node) && node.expression.getText(ast).startsWith("replyTargetNote.value && ['home', 'followers', 'specified']"));
		expect(inheritance).toBeDefined();
		const visibility = ref('public');
		const pending = new Map<string, (users: Misskey.entities.UserDetailed[]) => void>();
		const misskeyApi = vi.fn((_endpoint: string, _args: { userIds: string[] }) => new Promise<Misskey.entities.UserDetailed[]>(complete => pending.set('recipients', complete)));
		const visibleRecipients = createPostFormRecipients(userIds => misskeyApi('users/show', { userIds }));
		const visibleUsers = visibleRecipients.users;
		const context = {
			replyTargetNote: ref(reply), visibility, $i: { id: 'me' }, visibleRecipients,
		};
		const compiled = ts.transpileModule(inheritance!.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
		runInNewContext(compiled, context);
		expect(visibility.value).toBe('specified');
		expect(visibleUsers.value).toEqual([]);
		const recipientIds = authorId === 'me' ? ['recipient'] : ['author', 'recipient'];
		expect(visibleRecipients.ready.value).toBe(false);
		expect(misskeyApi).toHaveBeenCalledExactlyOnceWith('users/show', { userIds: recipientIds });
		pending.get('recipients')!(recipientIds.map(id => ({ id }) as Misskey.entities.UserDetailed));
		await Promise.resolve();
		expect(visibleUsers.value.map(user => user.id).sort()).toEqual(recipientIds);
		expect(visibleRecipients.ready.value).toBe(true);
	});
});
