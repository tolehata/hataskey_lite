/* SPDX-License-Identifier: AGPL-3.0-only */
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { ref } from 'vue';
import { expect, test, vi } from 'vitest';
import source from './MkExternalTimeline.vue?raw';

// Exercise the actual reload function without an external account or network.
const script = ts.createSourceFile('external.ts', parse(source).descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const reload = script.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'reload')!;
const code = ts.transpileModule(`${reload.getText(script)}\nreturn reload;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function setup() {
	const bindings = {
		props: { src: 'ohtl' }, fetchFromExternal: vi.fn(), isActive: ref(true),
		queuedNotes: ref([{ id: 'queued' }]), notes: ref([{ id: 'original' }]),
		capturedNoteIds: new Set(['original']), uncaptureNote: vi.fn(), captureDisplayedNotes: vi.fn(),
		canFetchOlder: ref(true), error: ref(false), init: vi.fn(),
	};
	return { ...bindings, reload: new Function(...Object.keys(bindings), code)(...Object.values(bindings)) as (preserve?: boolean) => Promise<void> };
}

test('a failed UI S refresh retains the page, pending arrivals and subscriptions', async () => {
	const view = setup();
	let reject!: (error: Error) => void;
	view.fetchFromExternal.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
	const request = view.reload(true);
	view.queuedNotes.value.push({ id: 'during-refresh' });
	reject(new Error('offline'));
	await expect(request).rejects.toThrow('offline');
	expect(view.notes.value).toEqual([{ id: 'original' }]);
	expect(view.queuedNotes.value.map(note => note.id)).toEqual(['queued', 'during-refresh']);
	expect(view.uncaptureNote).not.toHaveBeenCalled();
	expect(view.error.value).toBe(false);
});

test('a successful refresh removes only arrivals included in the fetched page', async () => {
	const view = setup();
	let resolve!: (notes: { id: string }[]) => void;
	view.fetchFromExternal.mockImplementation(() => new Promise(done => { resolve = done; }));
	const request = view.reload(true);
	view.queuedNotes.value.push({ id: 'during-refresh' });
	resolve([{ id: 'queued' }, { id: 'fetched' }]); await request;
	expect(view.fetchFromExternal).toHaveBeenCalledWith('notes/timeline', { limit: 20 });
	expect(view.queuedNotes.value).toEqual([{ id: 'during-refresh' }]);
	expect(view.notes.value.map(note => note.id)).toEqual(['queued', 'fetched']);
	expect(view.uncaptureNote).toHaveBeenCalledWith('original');
	expect(view.captureDisplayedNotes).toHaveBeenCalledOnce();
});

test('existing callers retain the ordinary reload path', async () => {
	const view = setup(); await view.reload();
	expect(view.queuedNotes.value).toEqual([]);
	expect(view.init).toHaveBeenCalledOnce();
	expect(view.fetchFromExternal).not.toHaveBeenCalled();
});
