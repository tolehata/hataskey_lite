/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { entities } from 'cherrypick-js';
import { getEmojiNameFromReaction } from '@@/js/emoji-name.js';
import { noteEvents, useNoteCapture } from '@/composables/use-note-capture.js';

vi.mock('@/i.js', () => ({ $i: { id: 'viewer' } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: false } } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { pollingInterval: 3 } } }));
vi.mock('@/stream.js', () => ({ useStream: vi.fn() }));
vi.mock('@@/js/interval.js', () => ({ createVisibilityAwareInterval: () => vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/muted-reactions.js', () => ({ notifyMutedReactionSourceChanged: vi.fn(), reactionCountsChanged: vi.fn(), shouldRevalidateMutedReactionActors: vi.fn() }));

const callers = ['MkNote.vue', 'MkNoteDetailed.vue', 'MkSubNoteContent.vue'] as const;
type Caller = typeof callers[number];
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

// Run the production handlers against real note captures, without unrelated note rendering.
function handlers(caller: string, bindings: Record<string, unknown>) {
	const { descriptor } = parse(readFileSync(`${process.cwd()}/src/components/${caller}`, 'utf8'));
	const ast = ts.createSourceFile(caller, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const names = ['toggleReaction', 'react', 'heartReact', 'undoReact'];
	const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''));
	if (!functions.some(node => (node as ts.FunctionDeclaration).name?.text === 'toggleReaction')) throw new Error(`Missing production handler in ${caller}`);
	const exports = functions.map(node => (node as ts.FunctionDeclaration).name!.text);
	const code = ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	return new Function(...Object.keys(bindings), `${code}; return { ${exports.join(',')} };`)(...Object.values(bindings)) as {
		toggleReaction: (reaction: string) => Promise<void>;
		react: () => void;
		heartReact: () => void;
		undoReact: (note?: unknown) => void;
	};
}

function capture(myReaction: string | null) {
	const note = {
		id: 'original', createdAt: '2020-01-01T00:00:00.000Z', reactionCount: myReaction ? 1 : 0,
		reactions: myReaction ? { [myReaction]: 1 } : {}, reactionEmojis: {}, myReaction,
	} as entities.Note;
	let live!: ReturnType<typeof useNoteCapture>['$note'];
	const app = createApp({ setup() { live = useNoteCapture({ note, parentNote: null }).$note; return () => h('div'); } });
	app.mount(window.document.createElement('div'));
	cleanups.push(() => app.unmount());
	return live;
}

function setup(caller: Caller, myReaction: string | null = null) {
	const first = capture(myReaction), second = capture(myReaction);
	const original = { id: 'original', text: '', myReaction: null, reactionAcceptance: null };
	const server = { myReaction, canonicalReaction: undefined as string | undefined };
	const request = vi.fn(async (endpoint: string, params: { noteId: string; reaction?: string }) => {
		if (endpoint === 'notes/reactions/delete') server.myReaction = null;
		if (endpoint === 'notes/reactions/create') {
			server.myReaction = server.canonicalReaction ?? params.reaction ?? null;
			// The server returns what it saved (after fallback/normalization).
			return { reaction: server.myReaction };
		}
		return endpoint === 'notes/show' ? { myReaction: server.myReaction } : undefined;
	});
	const confirm = vi.fn().mockResolvedValue({ canceled: false });
	const picker = vi.fn();
	const prefer = { s: { animation: false, confirmOnReact: false, selectReaction: '👍' } };
	const actions = handlers(caller, {
		note: caller === 'MkSubNoteContent.vue' ? original : { id: 'renote-wrapper', myReaction: null },
		appearNote: original, props: { note: original, mock: false }, $appearNote: first, $note: first,
		$i: { id: 'viewer' }, misskeyApi: request, noteEvents, os: { confirm },
		i18n: { ts: { changeReactionConfirm: 'change', cancelReactionConfirm: 'cancel' } },
		sound: { playMisskeySfx: vi.fn() }, haptic: vi.fn(), pleaseLogin: vi.fn(), showMovedDialog: vi.fn(),
		pleaseLoginContext: { value: {} }, claimAchievement: vi.fn(), blur: vi.fn(), focus: vi.fn(),
		reactButton: { value: null }, heartReactButton: { value: null }, reactionPicker: { show: picker }, prefer,
	});
	return { ...actions, first, second, original, request, confirm, picker, prefer, server };
}

const settle = async () => { for (let i = 0; i < 6; i++) await nextTick(); };

describe.each(callers)('%s: reaction state with streaming disabled', caller => {
	test('targets the displayed note in the picker', () => {
		const view = setup(caller);
		view.react();
		expect(view.picker).toHaveBeenCalledWith(null, view.original, expect.any(Function), expect.any(Function));
	});

	test('updates both note instances only after creating a reaction succeeds', async () => {
		const view = setup(caller);
		let complete!: () => void;
		view.request.mockImplementationOnce(() => new Promise<{ reaction: string }>(resolve => { complete = () => resolve({ reaction: '👍' }); }));
		const pending = view.toggleReaction('👍');
		expect(view.request).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'original', reaction: '👍' });
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
		complete(); await pending;
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['👍', '👍']);
		// A subsequent streaming echo must not apply the successful local operation twice.
		noteEvents.emit('reacted:original', { userId: 'viewer', reaction: '👍' });
		expect([view.first.reactionCount, view.second.reactionCount]).toEqual([1, 1]);
	});

	test('uses the current captured reaction to remove the original reaction', async () => {
		const view = setup(caller, '👍');
		await view.toggleReaction('👍');
		expect(view.request.mock.calls).toEqual([['notes/reactions/delete', { noteId: 'original' }]]);
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
		expect([view.first.reactions, view.second.reactions]).toEqual([{}, {}]);
	});

	test('replaces the original reaction in both instances and removes the previous count', async () => {
		const view = setup(caller, '👍');
		await view.toggleReaction('🎉');
		expect(view.request.mock.calls).toEqual([
			['notes/reactions/delete', { noteId: 'original' }],
			['notes/reactions/create', { noteId: 'original', reaction: '🎉' }],
		]);
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['🎉', '🎉']);
		expect([view.first.reactions, view.second.reactions]).toEqual([{ '🎉': 1 }, { '🎉': 1 }]);
	});

	test('canceling confirmation changes neither the API nor either instance', async () => {
		const view = setup(caller, '👍');
		view.confirm.mockResolvedValue({ canceled: true });
		await view.toggleReaction('🎉');
		expect(view.request).not.toHaveBeenCalled();
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['👍', '👍']);
	});

	test('failed deletion retains the previous reaction and does not attempt creation', async () => {
		const view = setup(caller, '👍');
		view.request.mockRejectedValue(new Error('delete failed'));
		await expect(view.toggleReaction('🎉')).rejects.toThrow('delete failed');
		expect(view.request.mock.calls).toEqual([['notes/reactions/delete', { noteId: 'original' }]]);
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['👍', '👍']);
	});

	test('failed creation after successful deletion leaves both instances unreacted', async () => {
		const view = setup(caller, '👍');
		view.request.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('create failed'));
		await expect(view.toggleReaction('🎉')).rejects.toThrow('create failed');
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
		expect([view.first.reactionCount, view.second.reactionCount]).toEqual([0, 0]);
	});

	test('quick reaction synchronizes the submitted selection after success', async () => {
		const view = setup(caller);
		let complete!: () => void;
		view.request.mockImplementationOnce(() => new Promise<{ reaction: string }>(resolve => { complete = () => resolve({ reaction: '👍' }); }));
		view.heartReact();
		expect(view.request).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'original', reaction: '👍' });
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
		view.prefer.s.selectReaction = '🎉';
		complete(); await settle();
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['👍', '👍']);
	});

	test.each(['', ':removed_emoji:'])('uses the saved fallback for picker and quick request %j', async requested => {
		for (const operation of ['picker', 'quick']) {
			const view = setup(caller);
			view.server.canonicalReaction = '❤';
			if (operation === 'picker') await view.toggleReaction(requested);
			else { view.prefer.s.selectReaction = requested; view.heartReact(); await settle(); }
			// One request: the create response already carries the saved fallback.
			expect(view.request.mock.calls).toEqual([
				['notes/reactions/create', { noteId: 'original', reaction: requested }],
			]);
			expect([view.first.myReaction, view.second.myReaction]).toEqual(['❤', '❤']);
			expect([view.first.reactions, view.second.reactions]).toEqual([{ '❤': 1 }, { '❤': 1 }]);
			cleanups.splice(0).forEach(cleanup => cleanup());
		}
	});

	test('waits for the saved reaction and never shows the requested value instead', async () => {
		const view = setup(caller);
		let complete!: (value: { reaction: string }) => void;
		view.request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
		const pending = view.toggleReaction(':removed_emoji:');
		await settle();
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
		complete({ reaction: '❤' }); await pending;
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['❤', '❤']);
		expect([view.first.reactions, view.second.reactions]).toEqual([{ '❤': 1 }, { '❤': 1 }]);
		expect(view.request.mock.calls.map(call => call[0])).toEqual(['notes/reactions/create']);
	});

	test('server echo before the API completion cannot be undone by the local replacement echo', async () => {
		const view = setup(caller, '👍');
		let complete!: () => void;
		view.request.mockImplementationOnce(() => new Promise<{ reaction: string }>(resolve => { complete = () => resolve({ reaction: '🎉' }); }));
		const pending = view.toggleReaction('🎉');
		await settle();
		noteEvents.emit('unreacted:original', { userId: 'viewer', reaction: '👍' });
		noteEvents.emit('reacted:original', { userId: 'viewer', reaction: '🎉' });
		complete(); await pending;
		expect([view.first.myReaction, view.second.myReaction]).toEqual(['🎉', '🎉']);
		expect([view.first.reactions, view.second.reactions]).toEqual([{ '🎉': 1 }, { '🎉': 1 }]);
		expect([view.first.reactionCount, view.second.reactionCount]).toEqual([1, 1]);
	});
});

test('delayed replacement echo does not clear the new reaction or count it twice', () => {
	const first = capture('👍'), second = capture('👍');
	// The local operation completes first; the server then echoes the same delete/create pair.
	for (let i = 0; i < 2; i++) {
		noteEvents.emit('unreacted:original', { userId: 'viewer', reaction: '👍' });
		if (i === 1) expect([first.myReaction, second.myReaction]).toEqual(['🎉', '🎉']);
		noteEvents.emit('reacted:original', { userId: 'viewer', reaction: '🎉' });
	}
	expect([first.myReaction, second.myReaction]).toEqual(['🎉', '🎉']);
	expect([first.reactions, second.reactions]).toEqual([{ '🎉': 1 }, { '🎉': 1 }]);
	expect([first.reactionCount, second.reactionCount]).toEqual([1, 1]);
});

test('another user can add, replace and remove reactions without altering my reaction', () => {
	const first = capture('❤'), second = capture('❤');
	noteEvents.emit('reacted:original', { userId: 'other', reaction: '👍' });
	noteEvents.emit('unreacted:original', { userId: 'other', reaction: '👍' });
	noteEvents.emit('reacted:original', { userId: 'other', reaction: '🎉' });
	expect([first.reactions, second.reactions]).toEqual([{ '❤': 1, '🎉': 1 }, { '❤': 1, '🎉': 1 }]);
	noteEvents.emit('unreacted:original', { userId: 'other', reaction: '🎉' });
	expect([first.myReaction, second.myReaction]).toEqual(['❤', '❤']);
	expect([first.reactions, second.reactions]).toEqual([{ '❤': 1 }, { '❤': 1 }]);
	expect([first.reactionCount, second.reactionCount]).toEqual([1, 1]);
});

test('detailed-note undo uses the live reaction after a like was added', async () => {
	const view = setup('MkNoteDetailed.vue', '❤');
	view.undoReact(view.original); await settle();
		expect(view.request).toHaveBeenCalledExactlyOnceWith('notes/reactions/delete', { noteId: 'original' });
		expect([view.first.myReaction, view.second.myReaction]).toEqual([null, null]);
});

describe('Unicode reaction chips with streaming disabled', () => {
	test.each([null, '👍'])('updates both instances from %s without custom emoji metadata', async previous => {
		const first = capture(previous), second = capture(previous);
		const request = vi.fn(async (endpoint: string) => endpoint === 'notes/reactions/create' ? { reaction: '🎉' } : undefined);
		const action = handlers('MkReactionsViewer.reaction.vue', {
			props: { noteId: 'original', myReaction: previous, reaction: '🎉', count: 1 },
			$i: { id: 'viewer' }, mock: false, canToggle: { value: true },
			misskeyApi: request, noteEvents, customEmojisMap: new Map(), emojiName: { value: '🎉' }, getEmojiNameFromReaction,
			os: { confirm: vi.fn().mockResolvedValue({ canceled: false }) },
			i18n: { ts: { changeReactionConfirm: 'change' } }, prefer: { s: { confirmOnReact: false } },
			haptic: vi.fn(), sound: { playMisskeySfx: vi.fn() },
		});
		await action.toggleReaction('unused'); await settle();
		expect(request).toHaveBeenCalledWith('notes/reactions/create', { noteId: 'original', reaction: '🎉' });
		expect(request.mock.calls.map(call => call[0])).not.toContain('notes/show');
		expect([first.myReaction, second.myReaction]).toEqual(['🎉', '🎉']);
		expect([first.reactions, second.reactions]).toEqual([{ '🎉': 1 }, { '🎉': 1 }]);
	});

	test('a removed custom emoji chip reflects the saved fallback', async () => {
		const first = capture(null), second = capture(null);
		const request = vi.fn(async (endpoint: string) => endpoint === 'notes/reactions/create' ? { reaction: '❤' } : undefined);
		const action = handlers('MkReactionsViewer.reaction.vue', {
			props: { noteId: 'original', myReaction: null, reaction: ':removed_emoji@.:', count: 1 },
			$i: { id: 'viewer' }, mock: false, canToggle: { value: true },
			misskeyApi: request, noteEvents, customEmojisMap: new Map(), emojiName: { value: 'removed_emoji' }, getEmojiNameFromReaction,
			os: { confirm: vi.fn().mockResolvedValue({ canceled: false }) },
			i18n: { ts: {} }, prefer: { s: { confirmOnReact: false } },
			haptic: vi.fn(), sound: { playMisskeySfx: vi.fn() },
		});
		await action.toggleReaction('unused'); await settle();
		expect(request).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'original', reaction: ':removed_emoji@.:' });
		expect([first.myReaction, second.myReaction]).toEqual(['❤', '❤']);
		expect([first.reactions, second.reactions]).toEqual([{ '❤': 1 }, { '❤': 1 }]);
	});
});
