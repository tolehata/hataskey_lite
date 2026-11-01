/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, ref, shallowRef } from 'vue';
import { hk3ComposerEmojiHostKey } from './hk3-composer-emoji-host.js';
import { hk3PostContextKey } from './hk3-post-context.js';
import { hk3PostedNote } from './hk3-state.js';
import type * as Misskey from 'cherrypick-js';
import type { Hk3PostContext } from './hk3-post-context.js';
import type { PostFormProps } from '@/types/post-form.js';
import Hk3Composer from './Hk3Composer.vue';
import { postSendDelayEnabled } from '@/utility/post-send-delay.js';
import { formatTimeString } from '@/utility/format-time-string.js';
import { prefer } from '@/preferences.js';
import type { NoteActionConfirmation } from '@/utility/note-action-confirmation.js';

const mocks = vi.hoisted(() => ({
	upload: vi.fn(), pc: vi.fn(), drive: vi.fn(), url: vi.fn(), menu: vi.fn(),
	api: vi.fn(), alert: vi.fn(), actions: vi.fn(), postDirect: vi.fn(),
	interruptors: [] as { handler: (data: unknown) => Promise<unknown> }[],
	attachmentModels: [] as Misskey.entities.DriveFile[][],
	storage: new Map<string, string>(),
	pickers: [] as { choose: (emoji: string) => void; close: () => void }[],
}));
vi.mock('@/os.js', () => ({
	launchUploader: mocks.upload, popupMenu: mocks.menu, alert: mocks.alert,
	actions: mocks.actions, postDirect: mocks.postDirect,
}));
vi.mock('@/utility/drive.js', () => ({
	chooseFileFromPcAndUpload: mocks.pc, chooseDriveFile: mocks.drive, chooseFileFromUrl: mocks.url,
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => mocks.storage.get(key) ?? null,
	setItem: (key: string, value: string) => mocks.storage.set(key, value),
	getItemAsJson: (key: string) => JSON.parse(mocks.storage.get(key) ?? 'null'),
	setItemAsJson: (key: string, value: unknown) => mocks.storage.set(key, JSON.stringify(value)),
} }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' }, incNotesCount: vi.fn(), notesCount: 10 }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	upload: 'Upload', fromDrive: 'Drive', fromUrl: 'URL', cancel: 'Cancel', close: 'Close', delete: 'Delete', deleteAndEdit: 'Delete and edit', unrenote: 'Remove renote', retry: 'Retry', noteDeleteConfirm: 'Delete this note?', deleteAndEditConfirm: 'Delete and edit this note?', unableToProcess: 'Could not complete',
	_visibility: { public: 'Public', home: 'Home', followers: 'Followers', specified: 'Specified' },
	_hata: {
		_drawingTool: { attachmentLimit: 'Limit 16' },
		_postDelay: { countdown: 'Waiting', cancel: 'Cancel', sendNow: 'Send now' },
		_hataskeyUi3: { attach: 'Attach', emoji: 'Emoji', visibility: 'Visibility', post: 'Post', postTools: 'Tools', cw: 'Content warning', cwPlaceholder: 'Example warning', expandForm: 'Full', noAltText: 'Missing alt', preview: 'Preview', poll: 'Poll', cwRequired: 'Enter a content warning', pollNeedsTwo: 'Enter two choices', recipientRequired: 'Choose a recipient', removeRecipient: 'Remove recipient', quote: 'Quote', reply: 'Reply', channel: 'Channel', clearContext: 'Clear context', attachmentsOnly: 'Attachments only', unrenoteConfirm: 'Remove this renote?' },
	},
}, tsx: { _hata: { _hataskeyUi3: {
	replyTo: ({ name }: { name: string }) => `Reply to ${name}`,
	postToChannel: ({ name }: { name: string }) => `Post to ${name}`,
	pollChoice: ({ number }: { number: string }) => `Choice ${number}`,
} } } } }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: {
		s: { animation: false, defaultNoteVisibility: 'public', defaultNoteLocalOnly: false, showNoAltTextWarning: true },
		r: {
			animation: ref(false), 'postFormVisibilityBorder.enabled': ref(false),
			hataskeyUi3ComposerPosition: ref('bottom'),
			hataskeyUi3ComposerEmojiPosition: ref('afterShortcuts'),
			hataskeyUi3ComposerShortcut1: ref('full'), hataskeyUi3ComposerShortcut2: ref('none'),
		},
	} };
});

vi.mock('@/store.js', () => ({ store: { s: {}, set: vi.fn() } }));
vi.mock('@/instance.js', () => ({ instance: { maxNoteTextLength: 3000 } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));
vi.mock('@/utility/autocomplete.js', () => ({ Autocomplete: class { detach() {} } }));
vi.mock('@/utility/emoji-picker.js', () => ({ emojiPicker: { show: vi.fn() } }));
vi.mock('@/utility/mfm-function-picker.js', () => ({ mfmFunctionPicker: vi.fn() }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => mocks.interruptors }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/components/MkPostFormAttaches.vue', () => ({ default: {
	props: ['modelValue'],
	setup(props: { modelValue: Misskey.entities.DriveFile[] }) { mocks.attachmentModels.push(props.modelValue); },
	template: '<div data-attaches><span v-for="file in modelValue" :key="file.id" :data-file-id="file.id">{{ file.name }}<button data-detach-file @click="$emit(\'detach\', file.id)">Remove</button></span></div>',
} }));
vi.mock('@/components/MkEventEditor.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkHataPostDelayStatus.vue', () => ({ default: {
	emits: ['sendNow', 'cancel'],
	template: '<button data-send-now @click="$emit(\'sendNow\')">Send now</button>',
} }));
vi.mock('./Hk3ShortcutGuide.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3ComposerEmojiPicker.vue', async () => {
	const { defineComponent, h, ref } = await import('vue');
	return { __esModule: true, default: defineComponent({
		props: ['maxHeight', 'condensed'], emits: ['done', 'closed'],
		setup(props, { emit, expose }) {
			const search = ref<HTMLInputElement>();
			mocks.pickers.push({ choose: emoji => emit('done', emoji), close: () => emit('closed') });
			expose({ focus: () => search.value?.focus(), reset: vi.fn() });
			return () => h('div', { 'data-embedded-picker': '', 'data-picker-height': props.maxHeight, 'data-condensed': props.condensed ? 'true' : undefined }, [h('input', { ref: search, 'aria-label': 'Emoji search' })]);
		},
	}) };
});

const cleanups: (() => void)[] = [];
type Composer = {
	adopt: (request: PostFormProps) => boolean;
	focus: () => void;
	openConfirmation: (request: NoteActionConfirmation) => boolean;
	cancelConfirmation: () => void;
	confirmationActive: boolean;
	canConfirm: boolean;
	collapseBlocked: boolean;
};

function mount(draftId = 'uiS:composer:main', options: { postContext?: Hk3PostContext; deck?: boolean; compact?: boolean; emojiHost?: boolean } = {}) {
	const composer = shallowRef<Composer>();
	const compact = shallowRef(options.compact ?? true);
	const posted = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const hostTarget = options.emojiHost ? window.document.createElement('div') : null;
	if (hostTarget) {
		hostTarget.setAttribute('data-hk3-composer-overlay', '');
		window.document.body.append(hostTarget);
	}
	const hostEnabled = ref(true);
	const hostRef = shallowRef<HTMLElement | null>(hostTarget);
	const hostOpen = ref(false);
	const app = createApp({ render: () => h(Hk3Composer, { ref: composer, compact: compact.value, draftId, deck: options.deck, onPosted: posted }) });
	if (options.emojiHost) app.provide(hk3ComposerEmojiHostKey, { target: hostRef, enabled: computed(() => hostEnabled.value), open: hostOpen });
	if (options.postContext) app.provide(hk3PostContextKey, options.postContext);
	for (const name of ['MkAvatar', 'MkUserName']) app.component(name, { render: () => null });
	app.component('Mfm', defineComponent({
		props: { text: { type: String, required: true }, emojiUrls: Object },
		setup: props => () => h('span', { 'data-mfm': '', 'data-emoji-urls': JSON.stringify(props.emojiUrls) }, props.text),
	}));
	app.mount(target);
	let mounted = true;
	const unmount = () => { if (mounted) app.unmount(); mounted = false; target.remove(); hostTarget?.remove(); };
	cleanups.push(unmount);
	return {
		target, unmount, posted, hostTarget, hostEnabled, hostRef, hostOpen,
		adopt: (request: PostFormProps) => composer.value!.adopt(request),
		openConfirmation: (request: NoteActionConfirmation) => composer.value!.openConfirmation(request),
		cancelConfirmation: () => composer.value!.cancelConfirmation(),
		confirmationActive: () => composer.value!.confirmationActive,
		canConfirm: () => composer.value!.canConfirm,
		collapseBlocked: () => composer.value!.collapseBlocked,
		setCompact: (value: boolean) => { compact.value = value; },
		focus: () => composer.value!.focus(),
		input: () => target.querySelector<HTMLTextAreaElement>('textarea')!,
		send: () => target.querySelector<HTMLButtonElement>('[data-hk3-send]')!,
		ids: () => [...target.querySelectorAll('[data-file-id]')].map(el => el.getAttribute('data-file-id')),
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

function driveFile(id: string): Misskey.entities.DriveFile {
	return { id, name: `${id}.png`, type: 'image/png', url: `https://example.com/${id}.png`, thumbnailUrl: null, isSensitive: false, comment: 'Alt text' } as Misskey.entities.DriveFile;
}

function clipboardFile(name = 'image.png', type = 'image/png') {
	return new File(['clipboard content'], name, { type, lastModified: new Date(2026, 8, 26, 12, 34, 56).getTime() });
}

function paste(view: ReturnType<typeof mount>, items: { kind: string; getAsFile?: () => File | null }[], files: File[] = []) {
	const ev = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(ev, 'clipboardData', { value: { items, files, getData: () => 'ordinary text' } });
	view.input().dispatchEvent(ev);
	return ev;
}

function pasteFile(view: ReturnType<typeof mount>) {
	return paste(view, [{ kind: 'file', getAsFile: () => clipboardFile() }]);
}

function setText(view: ReturnType<typeof mount>, text = 'draft') {
	view.input().value = text;
	view.input().dispatchEvent(new Event('input', { bubbles: true }));
}

function keyboardSubmit(view: ReturnType<typeof mount>) {
	view.input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
}

async function settle() {
	for (let i = 0; i < 8; i++) { await Promise.resolve(); await nextTick(); }
}

async function attachmentAction(view: ReturnType<typeof mount>, index: number) {
	view.target.querySelector<HTMLButtonElement>('button[title="Attach"]')!.click();
	await settle();
	const action = view.target.querySelectorAll<HTMLButtonElement>('[data-composer-menu="attachment"] [role="menuitem"]')[index];
	expect(action).toBeDefined();
	return async () => { action.click(); await settle(); };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.storage.clear();
	mocks.interruptors.length = 0;
	mocks.attachmentModels.length = 0;
	mocks.pickers.length = 0;
	mocks.upload.mockReset().mockResolvedValue([]);
	mocks.pc.mockReset().mockResolvedValue([]);
	mocks.drive.mockReset().mockResolvedValue([]);
	mocks.url.mockReset().mockResolvedValue(driveFile('url'));
	mocks.api.mockReset().mockResolvedValue({ createdNote: null });
	mocks.actions.mockReset().mockResolvedValue({ canceled: false, result: 'post' });
	mocks.postDirect.mockReset().mockResolvedValue(undefined);
	postSendDelayEnabled.value = false;
	prefer.r.animation.value = false;
	prefer.r.hataskeyUi3ComposerEmojiPosition.value = 'afterShortcuts';
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('UI S composer post context receipts', () => {
	let previousPostedNote: typeof hk3PostedNote.value;
	beforeEach(() => {
		previousPostedNote = hk3PostedNote.value;
		hk3PostedNote.value = null;
	});
	afterEach(() => {
		hk3PostedNote.value = previousPostedNote;
	});

	function postContext() {
		const receipt = { complete: vi.fn(), cancel: vi.fn() };
		return { receipt, begin: vi.fn(() => receipt) };
	}

	it('reveals the post context when public focus is called, then focuses the input', async () => {
		const context = { ...postContext(), reveal: vi.fn() };
		const view = mount('uiS:composer:main', { postContext: context });
		await settle();
		context.reveal.mockClear();
		view.input().blur();
		view.focus();
		expect(context.reveal).toHaveBeenCalledTimes(1);
		await settle();
		expect(window.document.activeElement).toBe(view.input());
		expect(context.begin).not.toHaveBeenCalled();
	});

	it('begins before notes/create and completes once with the created note and composer rect without fallback', async () => {
		const context = postContext();
		const sending = deferred<{ createdNote: Misskey.entities.Note }>();
		const createdNote = { id: 'created', text: 'draft' } as Misskey.entities.Note;
		mocks.api.mockImplementation(() => {
			expect(context.begin).toHaveBeenCalledTimes(1);
			return sending.promise;
		});
		const view = mount('uiS:composer:main', { postContext: context });
		setText(view);
		await settle();
		const rect = new DOMRect(12, 34, 320, 48);
		const rectSpy = vi.spyOn(view.input().parentElement!, 'getBoundingClientRect').mockReturnValue(rect);
		cleanups.push(() => rectSpy.mockRestore());
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'draft' }));
		expect(view.collapseBlocked()).toBe(true);
		expect(view.posted).not.toHaveBeenCalled();
		expect(context.receipt.complete).not.toHaveBeenCalled();
		sending.resolve({ createdNote });
		await settle();
		expect(context.begin).toHaveBeenCalledTimes(1);
		expect(context.receipt.complete).toHaveBeenCalledTimes(1);
		expect(context.receipt.complete).toHaveBeenCalledWith(createdNote, rect);
		expect(rectSpy).toHaveBeenCalledTimes(1);
		expect(context.receipt.cancel).not.toHaveBeenCalled();
		expect(hk3PostedNote.value).toBeNull();
		expect(view.input().value).toBe('');
		expect(view.posted).toHaveBeenCalledOnce();
		expect(view.posted).toHaveBeenCalledWith();
		view.unmount();
		expect(context.receipt.complete).toHaveBeenCalledTimes(1);
		expect(context.receipt.cancel).not.toHaveBeenCalled();
	});

	it('cancels the receipt after API rejection without completing or publishing fallback', async () => {
		const context = postContext();
		const sending = deferred<{ createdNote: Misskey.entities.Note }>();
		mocks.api.mockReturnValue(sending.promise);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		cleanups.push(() => errorSpy.mockRestore());
		const view = mount('uiS:composer:main', { postContext: context });
		setText(view);
		keyboardSubmit(view);
		await settle();
		expect(context.begin).toHaveBeenCalledTimes(1);
		expect(mocks.api).toHaveBeenCalledTimes(1);
		sending.reject(new Error('create rejected'));
		await settle();
		expect(context.receipt.cancel).toHaveBeenCalledTimes(1);
		expect(context.receipt.complete).not.toHaveBeenCalled();
		expect(hk3PostedNote.value).toBeNull();
		expect(view.input().value).toBe('draft');
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('updates an editing note without beginning a new post receipt', async () => {
		const context = postContext();
		const view = mount('uiS:composer:main', { postContext: context });
		expect(view.adopt({ initialNote: { id: 'edit', text: 'original', visibility: 'public', files: [] } as unknown as Misskey.entities.Note, updateMode: true })).toBe(true);
		await settle();
		setText(view, 'updated');
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		expect(mocks.api).toHaveBeenCalledWith('notes/update', expect.objectContaining({ noteId: 'edit', text: 'updated' }));
		expect(context.begin).not.toHaveBeenCalled();
		expect(context.receipt.complete).not.toHaveBeenCalled();
		expect(context.receipt.cancel).not.toHaveBeenCalled();
		expect(view.input().value).toBe('');
		expect(view.posted).toHaveBeenCalledOnce();
	});

	it('cancels the post delay without beginning a receipt or calling the API', async () => {
		const context = postContext();
		postSendDelayEnabled.value = true;
		const view = mount('uiS:composer:main', { postContext: context });
		setText(view);
		keyboardSubmit(view);
		await settle();
		expect(view.send().dataset.state).toBe('countdown');
		expect(view.collapseBlocked()).toBe(true);
		expect(context.begin).not.toHaveBeenCalled();
		view.send().click();
		await settle();
		await vi.advanceTimersByTimeAsync(10000);
		expect(view.send().dataset.state).toBe('idle');
		expect(view.input().value).toBe('draft');
		expect(mocks.api).not.toHaveBeenCalled();
		expect(context.begin).not.toHaveBeenCalled();
		expect(context.receipt.complete).not.toHaveBeenCalled();
		expect(context.receipt.cancel).not.toHaveBeenCalled();
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('cancels on unmount before notes/create resolves and ignores the late created note', async () => {
		const context = postContext();
		const sending = deferred<{ createdNote: Misskey.entities.Note }>();
		mocks.api.mockReturnValue(sending.promise);
		const view = mount('uiS:composer:main', { postContext: context });
		setText(view);
		keyboardSubmit(view);
		await settle();
		expect(context.begin).toHaveBeenCalledTimes(1);
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'draft' }));
		view.unmount();
		expect(context.receipt.cancel).toHaveBeenCalledTimes(1);
		sending.resolve({ createdNote: { id: 'late', text: 'draft' } as Misskey.entities.Note });
		await settle();
		expect(context.receipt.cancel).toHaveBeenCalledTimes(1);
		expect(context.receipt.complete).not.toHaveBeenCalled();
		expect(hk3PostedNote.value).toBeNull();
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('marks deck composers while keeping the mobile compact composer outside deck', () => {
		const deck = mount('uiS:composer:deck:a', { deck: true });
		const mobile = mount('uiS:composer:mobile', { deck: false });
		expect(deck.target.querySelector('[data-compact="true"][data-deck="true"]')).not.toBeNull();
		expect(mobile.target.querySelector('[data-compact="true"]')).not.toBeNull();
		expect(mobile.target.querySelector('[data-deck]')).toBeNull();
	});
});

describe('UI S composer in-flight draft ownership', () => {
	it('captures edits made while a warning is open after confirmation', async () => {
		const warning = deferred<{ canceled: boolean; result: string }>();
		mocks.actions.mockReturnValue(warning.promise);
		const view = mount();
		view.adopt({ channel: null, initialText: 'before warning', initialFiles: [{ ...driveFile('no-alt'), comment: null }] });
		keyboardSubmit(view);
		await settle();
		setText(view, 'after warning');
		warning.resolve({ canceled: false, result: 'post' });
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'after warning', fileIds: ['no-alt'] }));
		expect(view.input().value).toBe('');
		expect(view.posted).toHaveBeenCalledOnce();
	});

	it('sends a fixed create payload while retaining later body, CW, attachment and visibility edits', async () => {
		const sending = deferred<{ createdNote: null }>();
		mocks.api.mockReturnValue(sending.promise);
		const view = mount('uiS:composer:main', { compact: false });
		view.adopt({ channel: null, initialText: 'sent body', initialFiles: [driveFile('sent')], initialVisibility: 'public' });
		await settle();
		keyboardSubmit(view);
		await settle();
		setText(view, 'new body');
		view.target.querySelector<HTMLButtonElement>('button[title="Content warning"]')!.click();
		await settle();
		const cw = view.target.querySelector<HTMLInputElement>('input[aria-label="Content warning"]')!;
		cw.value = 'new CW'; cw.dispatchEvent(new Event('input', { bubbles: true }));
		view.target.querySelector<HTMLButtonElement>('[data-detach-file]')!.click();
		view.target.querySelector<HTMLButtonElement>('button[title="Visibility"]')!.click();
		await settle();
		view.target.querySelectorAll<HTMLButtonElement>('[data-composer-menu="visibility"] [role="menuitemradio"]')[1].click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'sent body', fileIds: ['sent'], visibility: 'public', cw: null }));
		sending.resolve({ createdNote: null });
		await settle();
		expect(view.input().value).toBe('new body');
		expect(cw.value).toBe('new CW');
		expect(view.ids()).toEqual([]);
		expect(view.target.querySelector<HTMLButtonElement>('button[title="Visibility"]')!.textContent).toContain('Home');
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('retains a draft changed and restored during create, but clears an unchanged draft', async () => {
		const sending = deferred<{ createdNote: null }>();
		mocks.api.mockReturnValueOnce(sending.promise);
		const changed = mount();
		setText(changed, 'same');
		keyboardSubmit(changed);
		await settle();
		setText(changed, 'other'); setText(changed, 'same');
		sending.resolve({ createdNote: null });
		await settle();
		expect(changed.input().value).toBe('same');
		expect(changed.posted).not.toHaveBeenCalled();
		changed.unmount();
		const unchanged = mount();
		setText(unchanged, 'same');
		keyboardSubmit(unchanged);
		await settle();
		expect(unchanged.input().value).toBe('');
		expect(unchanged.posted).toHaveBeenCalledOnce();
	});

	it('retains changes made during plugin processing and post delay', async () => {
		const plugin = deferred<unknown>();
		const sending = deferred<{ createdNote: null }>();
		mocks.interruptors.push({ handler: () => plugin.promise });
		mocks.api.mockReturnValue(sending.promise);
		postSendDelayEnabled.value = true;
		const view = mount();
		setText(view, 'sent');
		keyboardSubmit(view);
		await settle();
		setText(view, 'new during plugin');
		plugin.resolve({ text: 'sent', visibility: 'public' });
		await settle();
		setText(view, 'new during delay');
		view.target.querySelector<HTMLButtonElement>('[data-send-now]')!.click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'sent' }));
		sending.resolve({ createdNote: null });
		await settle();
		expect(view.input().value).toBe('new during delay');
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('retains editing changes after update and ignores an update response after unmount', async () => {
		const sending = deferred<void>();
		mocks.api.mockReturnValue(sending.promise);
		const view = mount();
		view.adopt({ initialNote: { id: 'edit', text: 'old', visibility: 'public', files: [driveFile('old')] } as Misskey.entities.Note, updateMode: true });
		await settle();
		setText(view, 'sent update');
		keyboardSubmit(view);
		await settle();
		setText(view, 'new update');
		view.target.querySelector<HTMLButtonElement>('[data-detach-file]')!.click();
		expect(mocks.api).toHaveBeenCalledWith('notes/update', expect.objectContaining({ text: 'sent update', fileIds: ['old'] }));
		sending.resolve();
		await settle();
		expect(view.input().value).toBe('new update');
		expect(view.ids()).toEqual([]);
		expect(view.posted).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(0);
		await settle();
		const late = deferred<void>();
		mocks.api.mockReturnValue(late.promise);
		keyboardSubmit(view);
		await settle();
		view.unmount();
		late.resolve();
		await settle();
		expect(view.posted).not.toHaveBeenCalled();
	});

	it('rejects reply, quote and channel adoption while editing without changing the draft', async () => {
		const view = mount();
		view.adopt({ initialNote: { id: 'edit', text: 'editing', visibility: 'public', files: [driveFile('kept')] } as Misskey.entities.Note, updateMode: true });
		await settle();
		const note = { id: 'other', user: { username: 'other' } } as Misskey.entities.Note;
		for (const request of [{ reply: note }, { renote: note }, { channel: { id: 'channel', name: 'Channel' } }]) {
			expect(view.adopt(request as PostFormProps)).toBe(false);
			expect(view.input().value).toBe('editing');
			expect(view.ids()).toEqual(['kept']);
		}
	});
});

describe('UI S compact composer preview', () => {
	it('retains outgoing text and cancels closing when input resumes', async () => {
		prefer.r.animation.value = true;
		const view = mount();
		const preview = () => view.target.querySelector('[data-composer-preview]');
		setText(view, 'first line\nsecond line');
		await settle();
		await vi.advanceTimersByTimeAsync(1000);
		setText(view, '');
		await settle();
		expect(preview()?.querySelector('[data-mfm]')?.textContent).toBe('first line\nsecond line');
		setText(view, 'resumed input');
		await settle();
		await vi.advanceTimersByTimeAsync(1000);
		expect(view.target.querySelectorAll('[data-composer-preview]')).toHaveLength(1);
		expect(preview()?.querySelector('[data-mfm]')?.textContent).toBe('resumed input');
		setText(view, '');
		await settle();
		await vi.advanceTimersByTimeAsync(1000);
		expect((preview() as HTMLElement).style.display).toBe('none');
		expect(preview()?.querySelector('[data-mfm]')?.textContent).toBe('');
	});

	it('renders and updates the input text, hiding the preview for empty or whitespace-only input', async () => {
		const view = mount();
		const preview = () => view.target.querySelector('[data-composer-preview]');
		expect(preview()).toBeNull();
		setText(view, 'first preview');
		await settle();
		expect(preview()).not.toBeNull();
		expect(preview()!.querySelector('[data-mfm]')!.textContent).toBe('first preview');
		setText(view, 'updated preview\nsecond line');
		await settle();
		expect(preview()!.querySelector('[data-mfm]')!.textContent).toBe('updated preview\nsecond line');
		setText(view, '');
		await settle();
		expect(preview()).toBeNull();
		setText(view, ' \n\t ');
		await settle();
		expect(preview()).toBeNull();
	});
});

describe('UI S composer clipboard attachment integration', () => {
	it('leaves text and null file items to native paste', () => {
		const view = mount();
		setText(view, 'existing text');
		expect(paste(view, [{ kind: 'string' }, { kind: 'file', getAsFile: () => null }]).defaultPrevented).toBe(false);
		const empty = new Event('paste', { bubbles: true, cancelable: true });
		view.input().dispatchEvent(empty);
		expect(empty.defaultPrevented).toBe(false);
		expect(view.input().value).toBe('existing text');
		expect(mocks.upload).not.toHaveBeenCalled();
	});
	it('uploads items once, preserving content/MIME and standard timestamp filenames', async () => {
		const view = mount();
		const file = clipboardFile();
		const extensionless = clipboardFile('screenshot', 'image/webp');
		mocks.upload.mockResolvedValue([driveFile('uploaded')]);
		expect(paste(view, [{ kind: 'string' }, { kind: 'file', getAsFile: () => file }, { kind: 'file', getAsFile: () => extensionless }], [file]).defaultPrevented).toBe(true);
		expect(mocks.upload).toHaveBeenCalledTimes(1);
		const uploaded = mocks.upload.mock.calls[0][0] as File[];
		expect(uploaded.map(item => item.name)).toEqual([
			`${formatTimeString(new Date(file.lastModified), 'yyyy-MM-dd HH-mm-ss [{{number}}]').replace('{{number}}', '2')}.png`,
			formatTimeString(new Date(extensionless.lastModified), 'yyyy-MM-dd HH-mm-ss [{{number}}]').replace('{{number}}', '3'),
		]);
		expect(uploaded.map(item => item.type)).toEqual(['image/png', 'image/webp']);
		expect(await uploaded[0].text()).toBe('clipboard content');
		await settle();
		expect(view.ids()).toEqual(['uploaded']);
	});
	it.each([{ items: [] }, { items: [{ kind: 'file', getAsFile: () => null }] }])('falls back to files when items yield no files (%j)', async ({ items }) => {
		const view = mount();
		mocks.upload.mockResolvedValue([driveFile('fallback')]);
		expect(paste(view, items, [clipboardFile()]).defaultPrevented).toBe(true);
		await settle();
		expect(mocks.upload).toHaveBeenCalledTimes(1);
		expect(view.ids()).toEqual(['fallback']);
	});
	it('blocks button and keyboard submit until every concurrent upload settles', async () => {
		const first = deferred<Misskey.entities.DriveFile[]>();
		const second = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const view = mount();
		setText(view);
		pasteFile(view);
		pasteFile(view);
		await settle();
		expect(view.collapseBlocked()).toBe(true);
		expect(view.send().disabled).toBe(true);
		keyboardSubmit(view);
		expect(mocks.api).not.toHaveBeenCalled();
		first.resolve([driveFile('one')]);
		await settle();
		expect(view.send().disabled).toBe(true);
		second.resolve([driveFile('two')]);
		await settle();
		expect(view.collapseBlocked()).toBe(false);
		expect(view.send().disabled).toBe(false);
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ fileIds: ['one', 'two'] }));
	});
	it.each(['cancel', 'reject', 'throw'])('releases pending state on uploader %s', async outcome => {
		const upload = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockImplementation(() => { if (outcome === 'throw') throw new Error('load failed'); return upload.promise; });
		const view = mount();
		setText(view);
		pasteFile(view);
		if (outcome === 'reject') upload.reject(new Error('load failed'));
		else if (outcome === 'cancel') upload.resolve([]);
		await settle();
		expect(view.send().disabled).toBe(false);
		expect(view.ids()).toEqual([]);
	});
	it('blocks collapse while a file chooser is pending even when posting remains enabled', async () => {
		const picking = deferred<Misskey.entities.DriveFile[]>();
		mocks.pc.mockReturnValue(picking.promise);
		const view = mount();
		setText(view);
		await (await attachmentAction(view, 0))();
		expect(view.collapseBlocked()).toBe(true);
		expect(view.send().disabled).toBe(false);
		picking.resolve([]);
		await settle();
		expect(view.collapseBlocked()).toBe(false);
	});
	it('deduplicates IDs within/between upload results and caps concurrent results at 16', async () => {
		const first = deferred<Misskey.entities.DriveFile[]>();
		const second = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const view = mount();
		pasteFile(view);
		pasteFile(view);
		first.resolve([driveFile('same'), driveFile('same'), ...Array.from({ length: 13 }, (_, i) => driveFile(`a${i}`))]);
		second.resolve([driveFile('same'), driveFile('b'), driveFile('b'), driveFile('c'), driveFile('overflow')]);
		await settle();
		expect(view.ids()).toEqual(['same', ...Array.from({ length: 13 }, (_, i) => `a${i}`), 'b', 'c']);
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'warning', text: 'Limit 16' });
		pasteFile(view);
		expect(mocks.upload).toHaveBeenCalledTimes(2);
	});
	it('ignores an old upload after adopt without decrementing the new draft pending count', async () => {
		const old = deferred<Misskey.entities.DriveFile[]>();
		const current = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
		const view = mount();
		pasteFile(view);
		view.adopt({ channel: null, initialText: 'new draft' });
		pasteFile(view);
		old.resolve([driveFile('stale')]);
		await settle();
		expect(view.ids()).toEqual([]);
		expect(view.send().disabled).toBe(true);
		current.resolve([driveFile('current')]);
		await settle();
		expect(view.ids()).toEqual(['current']);
		expect(view.send().disabled).toBe(false);
	});
	it('ignores a late result after clear via cancel editing', async () => {
		const upload = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValue(upload.promise);
		const view = mount();
		view.adopt({ initialNote: { id: 'edit', text: 'edit', visibility: 'public', files: [] } as unknown as Misskey.entities.Note, updateMode: true });
		pasteFile(view);
		await settle();
		view.target.querySelector<HTMLButtonElement>('button[title="Cancel"]')!.click();
		setText(view, 'after clear');
		upload.resolve([driveFile('stale')]);
		await settle();
		expect(view.ids()).toEqual([]);
		expect(view.send().disabled).toBe(false);
	});
	it('ignores late results after unmount and cannot start saved menu actions', async () => {
		const upload = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValue(upload.promise);
		const view = mount();
		const action = await attachmentAction(view, 1);
		pasteFile(view);
		const detachedModel = mocks.attachmentModels.at(-1)!;
		view.unmount();
		upload.resolve([driveFile('stale')]);
		await action();
		await settle();
		expect(mocks.drive).not.toHaveBeenCalled();
		expect(mocks.api).not.toHaveBeenCalled();
		expect(detachedModel).toEqual([]);
		expect(view.ids()).toEqual([]);
	});
	it.each([0, 1, 2])('ignores stale menu entry %s results without blocking submit', async index => {
		const upload = deferred<Misskey.entities.DriveFile[]>();
		mocks.pc.mockReturnValue(upload.promise);
		mocks.drive.mockReturnValue(upload.promise);
		mocks.url.mockImplementation(async () => (await upload.promise)[0]);
		const view = mount();
		setText(view);
		await (await attachmentAction(view, index))();
		await settle();
		expect(view.send().disabled).toBe(false);
		view.adopt({ channel: null });
		upload.resolve([driveFile('old-menu')]);
		await settle();
		expect(view.ids()).toEqual([]);
		expect(view.send().disabled).toBe(false);
	});
	it.each([0, 1, 2])('can submit when cancelled menu entry %s never settles', async index => {
		const neverSettles = new Promise<never>(() => {});
		mocks.pc.mockReturnValue(neverSettles);
		mocks.drive.mockReturnValue(neverSettles);
		mocks.url.mockReturnValue(neverSettles);
		const view = mount();
		setText(view);
		await (await attachmentAction(view, index))();
		await settle();
		expect(view.send().disabled).toBe(false);
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'draft' }));
	});
	it('rejects a menu action saved before adopting another draft', async () => {
		const view = mount();
		const action = await attachmentAction(view, 0);
		view.adopt({ channel: null });
		await action();
		expect(mocks.pc).not.toHaveBeenCalled();
	});
	it('blocks file paste during submit preflight and API sending while preserving text paste', async () => {
		const warning = deferred<{ canceled: boolean; result: string }>();
		const sending = deferred<{ createdNote: null }>();
		mocks.actions.mockReturnValue(warning.promise);
		mocks.api.mockReturnValue(sending.promise);
		const view = mount();
		view.adopt({ channel: null, initialFiles: [{ ...driveFile('no-alt'), comment: null }], initialText: 'body' });
		keyboardSubmit(view);
		await settle();
		expect(pasteFile(view).defaultPrevented).toBe(true);
		expect(paste(view, [{ kind: 'string' }]).defaultPrevented).toBe(false);
		keyboardSubmit(view);
		warning.resolve({ canceled: false, result: 'post' });
		await settle();
		pasteFile(view);
		expect(mocks.upload).not.toHaveBeenCalled();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		sending.resolve({ createdNote: null });
		await settle();
	});
	it('blocks upload during plugin processing and countdown, then sends captured attachments', async () => {
		const plugin = deferred<unknown>();
		mocks.interruptors.push({ handler: () => plugin.promise });
		postSendDelayEnabled.value = true;
		const view = mount();
		setText(view);
		keyboardSubmit(view);
		await settle();
		pasteFile(view);
		expect(mocks.upload).not.toHaveBeenCalled();
		plugin.resolve({ text: 'draft', fileIds: ['captured'] });
		await settle();
		expect(view.send().dataset.state).toBe('countdown');
		pasteFile(view);
		expect(mocks.upload).not.toHaveBeenCalled();
		expect(mocks.api).not.toHaveBeenCalled();
		view.target.querySelector<HTMLButtonElement>('[data-send-now]')!.click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ fileIds: ['captured'] }));
	});
});

describe('UI S full composer handoff', () => {
	async function expand(view: ReturnType<typeof mount>) {
		await settle();
		const button = view.target.querySelector<HTMLButtonElement>('button[title="Full"]');
		expect(button).not.toBeNull();
		button!.click();
		await settle();
		return mocks.postDirect.mock.calls.at(-1)! as [PostFormProps, () => void];
	}

	it('retains the UI S draft when the full dialog closes without a successful posted event', async () => {
		const view = mount('uiS:composer:main', { compact: false });
		expect(view.adopt({ channel: null, initialText: 'keep me', initialFiles: [driveFile('original')] })).toBe(true);
		const [props] = await expand(view);
		expect(props.restoreDraft).toBe(false);
		expect(props.initialPoll).toBeNull();
		expect(props.initialReactionAcceptance).toBeNull();
		expect(view.input().value).toBe('keep me');
		expect(view.ids()).toEqual(['original']);
		// Mutations inside the full form operate on its copied input values.
		props.initialFiles![0].id = 'changed-inside-full';
		props.initialFiles!.push(driveFile('extra'));
		await settle();
		expect(view.ids()).toEqual(['original']);
	});

	it('clears the unchanged draft only after the full form reports success', async () => {
		const view = mount('uiS:composer:main', { compact: false });
		expect(view.adopt({ channel: null, initialText: 'posted text', initialFiles: [driveFile('image')] })).toBe(true);
		const [, posted] = await expand(view);
		expect(view.input().value).toBe('posted text');
		posted();
		await settle();
		expect(view.input().value).toBe('');
		expect(view.ids()).toEqual([]);
	});

	it('preserves newer input or a different context after an earlier full form succeeds', async () => {
		const view = mount('uiS:composer:main', { compact: false });
		expect(view.adopt({ channel: null, initialText: 'first draft' })).toBe(true);
		const [, firstPosted] = await expand(view);
		setText(view, 'new input');
		firstPosted();
		await settle();
		expect(view.input().value).toBe('new input');
		const [, secondPosted] = await expand(view);
		expect(view.adopt({ channel: null, initialText: 'different draft', reply: { id: 'reply', user: { username: 'author' } } as Misskey.entities.Note })).toBe(true);
		secondPosted();
		await settle();
		expect(view.input().value).toContain('different draft');
	});
});

describe('automatic composer drafts', () => {
	it('restores text and attachments and separates deck columns', async () => {
		const first = mount('uiS:composer:deck:a');
		expect(first.adopt({ channel: null, initialText: 'saved input', initialFiles: [driveFile('saved')] })).toBe(true);
		await settle();
		first.unmount();
		expect(mount('uiS:composer:deck:b').input().value).toBe('');
		const restored = mount('uiS:composer:deck:a');
		await settle();
		expect(restored.input().value).toBe('saved input');
		expect(restored.ids()).toEqual(['saved']);
	});
	it('clears a successful post and resumes saving the next draft', async () => {
		const first = mount();
		expect(first.adopt({ channel: null, initialText: 'first draft' })).toBe(true);
		await settle();
		first.send().click();
		await settle();
		expect(JSON.parse(mocks.storage.get('hataFormDrafts:me')!)).toEqual({});
		expect(first.adopt({ channel: null, initialText: 'next draft' })).toBe(true);
		await settle();
		first.unmount();
		const restored = mount();
		await settle();
		expect(restored.input().value).toBe('next draft');
	});
});

describe('UI S composer reply audience', () => {
	it.each([false, true])('leaves an existing draft untouched when delegating a direct reply (editing: %s)', async editing => {
		const view = mount();
		if (editing) {
			view.adopt({ initialNote: { id: 'edit', text: 'kept draft', visibility: 'home', files: [driveFile('kept')] } as Misskey.entities.Note, updateMode: true });
		} else {
			view.adopt({ reply: { id: 'old-reply', user: { id: 'old-author', username: 'old-author' }, visibility: 'home' } as Misskey.entities.Note, initialText: 'kept draft', initialFiles: [driveFile('kept')], initialVisibility: 'home' });
		}
		await settle();
		const direct = { id: 'direct', visibility: 'specified', userId: 'author', user: { id: 'author', username: 'author' }, visibleUserIds: ['me', 'recipient'] } as Misskey.entities.Note;
		expect(view.adopt({ reply: direct })).toBe(false);
		await settle();
		expect(view.input().value).toBe('kept draft');
		expect(view.ids()).toEqual(['kept']);
		expect(mocks.api).not.toHaveBeenCalled();
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith(editing ? 'notes/update' : 'notes/create', expect.objectContaining({
			text: 'kept draft', fileIds: ['kept'],
			...(editing ? { noteId: 'edit' } : { replyId: 'old-reply', visibility: 'home' }),
		}));
	});

	it.each([
		['home', 'public', 'home'], ['home', 'followers', 'followers'], ['home', 'specified', 'specified'],
		['followers', 'public', 'followers'], ['followers', 'home', 'followers'], ['followers', 'specified', 'specified'],
		['public', 'home', 'home'],
	] as const)('uses %s reply visibility without widening %s', async (sourceVisibility, initialVisibility, expectedVisibility) => {
		const view = mount();
		const note = { id: 'reply', user: { id: 'author', username: 'author' }, visibility: sourceVisibility } as Misskey.entities.Note;
		expect(view.adopt({ reply: note, initialVisibility, initialText: 'reply body', initialVisibleUsers: [{ id: 'author', username: 'author' } as Misskey.entities.UserDetailed] })).toBe(true);
		await settle();
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ replyId: 'reply', visibility: expectedVisibility }));
	});

	it('shows and submits local-only when replying to a local-only note', async () => {
		const view = mount();
		const note = { id: 'local', user: { id: 'author', username: 'author' }, visibility: 'public', localOnly: true } as Misskey.entities.Note;
		view.adopt({ reply: note, initialLocalOnly: false, initialText: 'local reply' });
		await settle();
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ localOnly: true }));
	});
});

describe('UI S composer validation after warnings', () => {
	it.each(['poll', 'recipient', 'cw', 'length', 'empty'] as const)('does not send when %s becomes invalid while confirming a warning', async field => {
		const warning = deferred<{ canceled: boolean; result: string }>();
		mocks.actions.mockReturnValue(warning.promise);
		const view = mount();
		view.adopt({ channel: null, initialText: 'body', initialFiles: [{ ...driveFile('no-alt'), comment: null }],
			...(field === 'recipient' ? { initialVisibility: 'specified' as const, initialVisibleUsers: [{ id: 'recipient', username: 'recipient' } as Misskey.entities.UserDetailed] } : {}),
			...(field === 'cw' ? { initialCw: 'original warning' } : {}),
		});
		if (field === 'poll') {
			view.target.querySelector<HTMLButtonElement>('button[title="Tools"]')!.click();
			await settle();
			[...view.target.querySelectorAll<HTMLButtonElement>('[data-composer-menu="tools"] button')].find(button => button.textContent === 'Poll')!.click();
			await settle();
			for (const [index, input] of [...view.target.querySelectorAll<HTMLInputElement>('input[placeholder^="Choice"]')].entries()) {
				input.value = `Option ${index}`; input.dispatchEvent(new Event('input', { bubbles: true }));
			}
		}
		keyboardSubmit(view);
		await settle();
		expect(mocks.actions).toHaveBeenCalledOnce();
		if (field === 'poll' || field === 'cw') {
			const input = view.target.querySelector<HTMLInputElement>(field === 'poll' ? 'input[placeholder="Choice 2"]' : 'input[aria-label="Content warning"]')!;
			input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
		} else if (field === 'recipient') {
			view.target.querySelector<HTMLButtonElement>('button[title="Remove recipient"]')!.click();
		} else if (field === 'length') {
			setText(view, 'x'.repeat(3001));
		} else {
			setText(view, '');
			view.target.querySelector<HTMLButtonElement>('[data-detach-file]')!.click();
		}
		warning.resolve({ canceled: false, result: 'post' });
		await settle();
		expect(mocks.api).not.toHaveBeenCalled();
		expect(view.posted).not.toHaveBeenCalled();
		expect(view.send().dataset.state).toBe('idle');
	});
});

describe('UI S composer quote context', () => {
	it.each([
		{ name: 'public quote', kind: 'quote', explicitChannel: undefined, expectedChannelId: undefined },
		{ name: 'private quote with explicit channel', kind: 'quote', explicitChannel: { id: 'private-channel', name: 'Private' }, expectedChannelId: 'private-channel' },
		{ name: 'reply inheriting its channel', kind: 'reply', explicitChannel: undefined, expectedChannelId: 'source-channel' },
		{ name: 'reply with explicit null channel', kind: 'reply', explicitChannel: null, expectedChannelId: undefined },
	])('uses the requested channel for $name', async ({ kind, explicitChannel, expectedChannelId }) => {
		const sourceChannel = { id: 'source-channel', name: 'Source' };
		const note = { id: 'source-note', user: { id: 'author', username: 'author' }, channel: sourceChannel, text: 'original' } as Misskey.entities.Note;
		const view = mount();
		const request = {
			...(kind === 'reply' ? { reply: note } : { renote: note }),
			...(explicitChannel !== undefined ? { channel: explicitChannel } : {}),
			initialText: 'new text',
		} as PostFormProps;
		expect(view.adopt(request)).toBe(true);
		await settle();
		view.send().click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({
			channelId: expectedChannelId,
			...(kind === 'reply' ? { replyId: 'source-note' } : { renoteId: 'source-note' }),
		}));
	});

	it.each([
		['reply', 'body'], ['reply', 'CW'], ['quote', 'body'], ['quote', 'CW'],
	] as const)('keeps %s %s focus on primary pointer cancellation and restores a context-free draft', async (kind, field) => {
		const note = { id: 'source', user: { id: 'author', username: 'author' }, text: 'original' } as Misskey.entities.Note;
		const postContext = { reveal: vi.fn(), begin: vi.fn(() => ({ complete: vi.fn(), cancel: vi.fn() })) };
		const view = mount('uiS:composer:main', { postContext });
		expect(view.adopt({ channel: null, ...(kind === 'reply' ? { reply: note } : { renote: note }), initialText: 'draft text', initialCw: 'draft warning', initialFiles: [driveFile('kept')], initialVisibility: 'followers' })).toBe(true);
		await settle();
		postContext.reveal.mockClear();
		const context = view.target.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!;
		const wrapper = context.parentElement!.parentElement!;
		const clear = context.querySelector<HTMLButtonElement>('button[title="Clear context"]')!;
		expect(wrapper.getAttribute('aria-hidden')).toBe('false');
		expect(wrapper.hasAttribute('inert')).toBe(false);
		const focusedInput = field === 'body' ? view.input() : view.target.querySelector<HTMLInputElement>('input[aria-label="Content warning"]')!;
		focusedInput.focus();
		focusedInput.setSelectionRange(2, 2);
		for (const button of [1, 2]) {
			const down = new PointerEvent('pointerdown', { button, bubbles: true, cancelable: true });
			clear.dispatchEvent(down);
			expect(down.defaultPrevented).toBe(false);
		}
		const down = new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true });
		clear.dispatchEvent(down);
		expect(down.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(focusedInput);
		expect(wrapper.getAttribute('aria-hidden')).toBe('false');
		clear.click();
		await settle();
		expect(wrapper.getAttribute('aria-hidden')).toBe('true');
		expect(wrapper.hasAttribute('inert')).toBe(true);
		expect(postContext.reveal).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(focusedInput);
		expect(focusedInput.selectionStart).toBe(2);
		expect(view.input().value).toBe('draft text');
		expect(view.ids()).toEqual(['kept']);
		view.unmount();
		const restored = mount();
		await settle();
		expect(restored.target.querySelector('[data-kind="reply"], [data-kind="quote"]')).toBeNull();
		expect(restored.input().value).toBe('draft text');
		expect(restored.ids()).toEqual(['kept']);
		restored.send().click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({
			text: 'draft text', fileIds: ['kept'], cw: 'draft warning', visibility: 'followers', replyId: undefined, renoteId: undefined,
		}));
	});

	it.each(['reply', 'quote'] as const)('returns keyboard focus from the %s clear button synchronously', async kind => {
		const note = { id: 'source', user: { id: 'author', username: 'author' } } as Misskey.entities.Note;
		const postContext = { reveal: vi.fn(), begin: vi.fn(() => ({ complete: vi.fn(), cancel: vi.fn() })) };
		const view = mount('uiS:composer:main', { postContext });
		expect(view.adopt({ channel: null, ...(kind === 'reply' ? { reply: note } : { renote: note }), initialText: 'draft text' })).toBe(true);
		await settle();
		postContext.reveal.mockClear();
		const clear = view.target.querySelector<HTMLButtonElement>(`[data-kind="${kind}"] button[title="Clear context"]`)!;
		clear.focus();
		expect(window.document.activeElement).toBe(clear);
		clear.click();
		expect(window.document.activeElement).toBe(view.input());
		expect(postContext.reveal).not.toHaveBeenCalled();
		await settle();
		expect(view.input().value).toBe('draft text');
	});

	it('shows a CW before body text, passes custom emojis, and hides hidden note contents', async () => {
		const view = mount();
		const note = { id: 'quoted', user: { id: 'author', username: 'author' }, text: 'private body', cw: ':party: warning', emojis: { party: 'https://example.com/party.png' } } as unknown as Misskey.entities.Note;
		expect(view.adopt({ channel: null, renote: note })).toBe(true);
		await settle();
		const quote = () => view.target.querySelector<HTMLElement>('[data-kind="quote"]')!;
		expect(quote().querySelector('[data-mfm]')?.textContent).toBe(':party: warning');
		expect(quote().querySelector('[data-mfm]')?.getAttribute('data-emoji-urls')).toBe(JSON.stringify(note.emojis));
		expect(view.adopt({ channel: null, renote: { ...note, isHidden: true } })).toBe(true);
		await settle();
		expect(quote().querySelector('[data-mfm]')).toBeNull();
		expect(quote().textContent).not.toContain('private body');
		expect(quote().textContent).not.toContain('warning');
		expect(view.adopt({ channel: null, renote: { ...note, cw: null, text: null, files: [driveFile('attachment')] } })).toBe(true);
		await settle();
		expect(quote().textContent).toContain('Attachments only');
	});
});

describe('inline composer menus', () => {
	function controls(view: ReturnType<typeof mount>) {
		const tools = view.target.querySelector<HTMLButtonElement>('button[title="Tools"]')!;
		const visibility = view.target.querySelector<HTMLButtonElement>('button[title="Visibility"]')!;
		const panel = view.target.querySelector<HTMLElement>('[data-composer-menu-panel]')!;
		const menu = panel.querySelector<HTMLElement>('[data-composer-menu]')!;
		return { tools, visibility, panel, menu };
	}

	it('blocks collapse for an inline menu and composition in the input, CW, and picker', async () => {
		const view = mount();
		expect(view.collapseBlocked()).toBe(false);
		const { tools } = controls(view);
		tools.click();
		await settle();
		expect(view.collapseBlocked()).toBe(true);
		tools.click();
		await settle();
		expect(view.collapseBlocked()).toBe(false);
		const cw = view.target.querySelector<HTMLInputElement>('input[aria-label="Content warning"]')!;
		for (const input of [view.input(), cw]) {
			input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
			expect(view.collapseBlocked()).toBe(true);
			input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
			expect(view.collapseBlocked()).toBe(false);
		}
		view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
		await vi.dynamicImportSettled();
		await settle();
		const picker = view.target.querySelector<HTMLInputElement>('input[aria-label="Emoji search"]')!;
		picker.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		expect(view.collapseBlocked()).toBe(true);
		picker.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
		await settle();
		expect(view.collapseBlocked()).toBe(false);
	});

	it('keeps CW text and input through rapid reversal, hides closed CW from focus, and leaves inline menus usable', async () => {
		const view = mount();
		const toggle = view.target.querySelector<HTMLButtonElement>('button[title="Content warning"]')!;
		const cw = view.target.querySelector<HTMLInputElement>('input[aria-label="Content warning"]')!;
		const wrapper = cw.closest<HTMLElement>('[aria-hidden]')!;
		expect(wrapper.hasAttribute('inert')).toBe(true);
		toggle.click(); await settle();
		expect(wrapper.hasAttribute('inert')).toBe(false);
		expect(cw.getAttribute('placeholder')).toBe('Example warning');
		cw.value = 'spoiler';
		cw.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		cw.focus();
		toggle.click(); await settle();
		expect(wrapper.hasAttribute('inert')).toBe(true);
		expect(wrapper.getAttribute('aria-hidden')).toBe('true');
		expect(window.document.activeElement).toBe(toggle);
		toggle.click(); toggle.click(); toggle.click(); await settle();
		expect(view.target.querySelector<HTMLInputElement>('input[aria-label="Content warning"]')).toBe(cw);
		expect(cw.value).toBe('spoiler');
		expect(wrapper.hasAttribute('inert')).toBe(false);
		const { tools, visibility, panel } = controls(view);
		tools.click(); await settle();
		expect(panel.dataset.open).toBe('true');
		expect(cw.value).toBe('spoiler');
		visibility.click(); await settle();
		expect(panel.querySelectorAll('[role="menuitemradio"]')).toHaveLength(4);
		expect(wrapper.hasAttribute('inert')).toBe(false);
	});

	it('keeps one menu in the composer, switches content and preserves the draft', async () => {
		const view = mount();
		setText(view, 'keep this draft');
		await settle();
		const { tools, visibility, panel, menu } = controls(view);
		let contentHeight = 210;
		Object.defineProperty(menu, 'offsetHeight', { get: () => contentHeight });
		tools.click();
		await settle();
		expect(panel.closest('[data-hk3-composer-menus]')).toBe(view.target.querySelector('[data-hk3-composer-menus]'));
		expect(panel.dataset.open).toBe('true');
		expect(panel.style.height).toBe('210px');
		expect(menu.dataset.composerMenu).toBe('tools');
		expect(menu.querySelectorAll('[role="menuitemcheckbox"]').length).toBeGreaterThan(1);
		expect(view.target.querySelector('[data-hk3-composer-menus]')?.getAttribute('data-busy')).toBe('true');
		contentHeight = 174;
		visibility.click();
		await settle();
		expect(panel.style.height).toBe('174px');
		expect(menu.dataset.composerMenu).toBe('visibility');
		expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(4);
		expect(tools.getAttribute('aria-expanded')).toBe('false');
		expect(visibility.getAttribute('aria-expanded')).toBe('true');
		visibility.click();
		await settle();
		expect(panel.style.height).toBe('0px');
		expect(panel.getAttribute('aria-hidden')).toBe('true');
		expect(view.input().value).toBe('keep this draft');
		expect(view.target.querySelector('[data-composer-preview]')).not.toBeNull();
	});

	it('reverses closing height and returns focus on Escape; outside click closes', async () => {
		const view = mount();
		const { tools, panel, menu } = controls(view);
		Object.defineProperty(menu, 'offsetHeight', { get: () => 190 });
		tools.click();
		await settle();
		menu.querySelector<HTMLButtonElement>('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(panel.style.height).toBe('0px');
		expect(window.document.activeElement).toBe(tools);
		tools.click();
		await settle();
		expect(panel.style.height).toBe('190px');
		window.document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await settle();
		expect(panel.style.height).toBe('0px');
	});

	it('closes after selecting a tool while keeping menu items inside a viewport cap', async () => {
		const view = mount();
		const { tools, panel, menu } = controls(view);
		const root = panel.closest<HTMLElement>('[data-hk3-composer-menus]')!;
		Object.defineProperty(root, 'offsetHeight', { get: () => 126 });
		const rect = vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, window.innerHeight - 126, 390, 126));
		cleanups.push(() => rect.mockRestore());
		tools.click();
		await settle();
		expect(menu.style.maxHeight).toBe('240px');
		const viewportHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(320);
		window.dispatchEvent(new Event('resize'));
		await settle();
		// The mobile dock reserves 150px below/above its body and 14px of padding.
		expect(menu.style.maxHeight).toBe('30px');
		viewportHeight.mockRestore();
		const items = menu.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]');
		const scroll = vi.fn();
		items[1].scrollIntoView = scroll;
		items[0].focus();
		items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
		expect(window.document.activeElement).toBe(items[1]);
		expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
		menu.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!.click();
		await settle();
		expect(tools.getAttribute('aria-expanded')).toBe('false');
		expect(panel.getAttribute('aria-hidden')).toBe('true');
		const deck = mount('uiS:composer:deck:menu', { deck: true, compact: false });
		expect(controls(deck).panel.closest('[data-hk3-composer-menus]')).toBe(deck.target.querySelector('[data-hk3-composer-menus]'));
	});
});

describe('embedded composer picker and attachments', () => {
	async function openEmoji(view: ReturnType<typeof mount>) {
		const trigger = view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!;
		trigger.click();
		await vi.dynamicImportSettled();
		await settle();
		expect(view.target.querySelector('[data-embedded-picker]')).not.toBeNull();
		return { trigger, picker: mocks.pickers.at(-1)! };
	}

	it('replaces the selection with exact Unicode and custom shortcodes, including rapid picks and a moved caret', async () => {
		const view = mount();
		setText(view, 'before REPLACE after');
		await settle();
		view.input().setSelectionRange(7, 14);
		const { picker } = await openEmoji(view);
		picker.choose('👩🏽‍🚀');
		picker.choose(':custom_flower:');
		await settle();
		expect(view.input().value).toBe('before 👩🏽‍🚀:custom_flower: after');
		expect(view.input().selectionStart).toBe('before 👩🏽‍🚀:custom_flower:'.length);
		view.input().setSelectionRange(0, 6);
		picker.choose('🌸');
		await settle();
		expect(view.input().value).toBe('🌸 👩🏽‍🚀:custom_flower: after');
		expect(view.input().selectionStart).toBe('🌸'.length);
		expect(mocks.menu).not.toHaveBeenCalled();
	});

	it.each(['afterShortcuts', 'beforeVisibility'] as const)('lets the picker own arrow keys and returns Escape focus at %s', async position => {
		prefer.r.hataskeyUi3ComposerEmojiPosition.value = position;
		const view = mount();
		const { trigger } = await openEmoji(view);
		const search = view.target.querySelector<HTMLInputElement>('[aria-label="Emoji search"]')!;
		search.focus();
		const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		search.dispatchEvent(arrow);
		expect(arrow.defaultPrevented).toBe(false);
		expect(window.document.activeElement).toBe(search);
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(window.document.activeElement).toBe(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('keeps the embedded deck picker usable when the floating composer starts at the bottom edge', async () => {
		const view = mount('uiS:composer:deck:picker', { deck: true });
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		Object.defineProperty(root, 'offsetHeight', { get: () => 126 });
		const rect = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, window.innerHeight - 126, 560, 126));
		cleanups.push(() => rect.mockRestore());
		await openEmoji(view);
		const menu = view.target.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		expect(Number.parseFloat(menu.style.maxHeight)).toBeGreaterThan(100);
		expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(480);
	});

	it('reserves the mobile dock body padding so a short-screen picker cannot cover the posting controls', async () => {
		const viewportHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(568);
		cleanups.push(() => viewportHeight.mockRestore());
		const view = mount();
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		Object.defineProperty(root, 'offsetHeight', { get: () => 126 });
		const rect = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 358, 300, 126));
		cleanups.push(() => rect.mockRestore());
		await openEmoji(view);
		const menu = view.target.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		expect(Number.parseFloat(menu.style.maxHeight) + 126 + 14).toBeLessThanOrEqual(568 - 150);
	});

	it('switches in place and discards a closed picker callback when adopting a different draft', async () => {
		const view = mount();
		setText(view, 'original');
		const { picker } = await openEmoji(view);
		const panel = view.target.querySelector('[data-composer-menu-panel]')!;
		view.target.querySelector<HTMLButtonElement>('button[title="Attach"]')!.click();
		await settle();
		expect(view.target.querySelector('[data-composer-menu-panel]')).toBe(panel);
		expect(view.target.querySelector('[data-embedded-picker]')).toBeNull();
		expect(panel.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
		picker.choose(':late:');
		expect(view.adopt({ channel: null, initialText: 'next' })).toBe(true);
		picker.choose(':later:');
		await settle();
		expect(view.input().value).toBe('original next');
		expect(panel.getAttribute('aria-hidden')).toBe('true');
	});

	it('retains the picker while closing, safely reverses the transition and disposes it on unmount', async () => {
		prefer.r.animation.value = true;
		const view = mount();
		const { trigger, picker } = await openEmoji(view);
		const element = view.target.querySelector('[data-embedded-picker]');
		picker.close();
		await settle();
		expect(view.target.querySelector('[data-embedded-picker]')).toBe(element);
		expect(view.target.querySelector('[data-composer-menu-panel]')!.getAttribute('inert')).not.toBeNull();
		picker.choose('ignored');
		expect(view.input().value).toBe('');
		trigger.click();
		await settle();
		expect(window.document.activeElement).toBe(view.target.querySelector('[aria-label="Emoji search"]'));
		await vi.advanceTimersByTimeAsync(340);
		expect(view.target.querySelector('[data-embedded-picker]')).toBe(element);
		view.unmount();
		await vi.advanceTimersByTimeAsync(340);
		expect(view.target.querySelector('[data-embedded-picker]')).toBeNull();
	});

	it.each([0, 1, 2])('routes inline attachment source %s through existing choosers and preserves local-only home payload', async index => {
		mocks.pc.mockResolvedValue([driveFile('chosen')]);
		mocks.drive.mockResolvedValue([driveFile('chosen')]);
		mocks.url.mockResolvedValue(driveFile('chosen'));
		const view = mount();
		expect(view.adopt({ channel: null, initialText: 'body :local:', initialVisibility: 'home', initialLocalOnly: true })).toBe(true);
		await (await attachmentAction(view, index))();
		expect(view.ids()).toEqual(['chosen']);
		const chooser = [mocks.pc, mocks.drive, mocks.url][index];
		expect(chooser).toHaveBeenCalledTimes(1);
		if (index !== 2) expect(chooser).toHaveBeenCalledWith({ multiple: true });
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/create', expect.objectContaining({ text: 'body :local:', fileIds: ['chosen'], visibility: 'home', localOnly: true }));
		expect(mocks.menu).not.toHaveBeenCalled();
	});
});

describe('mobile hosted composer picker', () => {
	it('fits a full emoji row below the search in a 128px header-to-composer gap', async () => {
		const view = mount('uiS:composer:host:short', { emojiHost: true });
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 180, 390, 120));
		vi.spyOn(view.hostTarget!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 44, 390, 0));
		view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
		await vi.dynamicImportSettled();
		await settle();
		const menu = view.hostTarget!.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		const picker = view.hostTarget!.querySelector<HTMLElement>('[data-embedded-picker]')!;
		expect(menu.style.maxHeight).toBe('128px');
		expect(menu.parentElement?.getAttribute('data-condensed')).toBe('true');
		expect(picker.getAttribute('data-condensed')).toBe('true');
		const pickerBudget = Number(picker.getAttribute('data-picker-height'));
		expect(pickerBudget).toBe(90);
		expect(pickerBudget - 40).toBeGreaterThanOrEqual(44);
	});

	it.each(['afterShortcuts', 'beforeVisibility'] as const)('keeps the %s trigger in the composer and moves only the picker', async position => {
		prefer.r.hataskeyUi3ComposerEmojiPosition.value = position;
		const view = mount(`uiS:composer:host:${position}`, { emojiHost: true });
		const trigger = view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!;
		setText(view, 'draft');
		view.input().focus();
		const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
		trigger.dispatchEvent(down);
		expect(down.defaultPrevented).toBe(true);
		trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		await vi.dynamicImportSettled();
		await settle();
		expect(view.target.contains(trigger)).toBe(true);
		expect(view.hostTarget?.querySelector('[data-embedded-picker]')).not.toBeNull();
		expect(view.target.querySelector('[data-embedded-picker]')).toBeNull();
		expect(view.hostOpen.value).toBe(true);
		expect(window.document.activeElement).toBe(view.input());
		const picker = mocks.pickers.at(-1)!;
		view.input().setSelectionRange(0, 5);
		picker.choose('👩🏽‍🚀');
		await settle();
		expect(window.document.activeElement).toBe(view.input());
		view.hostTarget!.querySelector<HTMLInputElement>('[aria-label="Emoji search"]')!.focus();
		view.input().setSelectionRange(0, '👩🏽‍🚀'.length);
		picker.choose('🌸');
		picker.choose(':flower:');
		await settle();
		expect(view.input().value).toBe('🌸:flower:');
		expect(window.document.activeElement).toBe(view.hostTarget!.querySelector('[aria-label="Emoji search"]'));
		view.hostTarget!.querySelector<HTMLButtonElement>('button[title="Close"]')!.click();
		await settle();
		expect(window.document.activeElement).toBe(view.input());
		expect(view.hostOpen.value).toBe(false);
	});

	it('retains draft focus when the trigger closes and does not close during search composition', async () => {
		const view = mount('uiS:composer:host:close', { emojiHost: true });
		const trigger = view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!;
		view.input().focus();
		trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
		trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		await vi.dynamicImportSettled();
		await settle();
		const search = view.hostTarget!.querySelector<HTMLInputElement>('[aria-label="Emoji search"]')!;
		search.focus();
		search.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		mocks.pickers.at(-1)!.close();
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }));
		expect(view.hostOpen.value).toBe(true);
		search.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(window.document.activeElement).toBe(view.input());
		expect(view.hostOpen.value).toBe(false);
		trigger.click();
		await settle();
		view.hostTarget!.querySelector<HTMLInputElement>('[aria-label="Emoji search"]')!.focus();
		trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
		trigger.click();
		await settle();
		expect(window.document.activeElement).toBe(view.input());
		expect(view.hostOpen.value).toBe(false);
	});

	it('stays local in deck and desktop even when a host is supplied', async () => {
		for (const options of [{ compact: false }, { deck: true }]) {
			const view = mount(`uiS:composer:local:${JSON.stringify(options)}`, { ...options, emojiHost: true });
			view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
			await vi.dynamicImportSettled();
			await settle();
			expect(view.target.querySelector('[data-embedded-picker]')).not.toBeNull();
			expect(view.hostTarget?.querySelector('[data-embedded-picker]')).toBeNull();
			expect(view.hostOpen.value).toBe(false);
		}
	});

	it('bounds height, closes outside, and ignores IME and stale host callbacks', async () => {
		const view = mount('uiS:composer:host:bounds', { emojiHost: true });
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 420, 320, 120));
		vi.spyOn(view.hostTarget!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, 320, 0));
		const trigger = view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!;
		view.input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		trigger.click();
		await settle();
		expect(view.hostOpen.value).toBe(false);
		view.input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		trigger.click();
		await vi.dynamicImportSettled();
		await settle();
		const menu = view.hostTarget!.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		expect(menu.style.maxHeight).toBe('352px');
		const picker = mocks.pickers.at(-1)!;
		view.input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		picker.choose('⛔');
		expect(view.input().value).toBe('');
		view.input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		view.hostEnabled.value = false;
		await settle();
		expect(view.hostOpen.value).toBe(false);
		picker.choose('late');
		expect(view.input().value).toBe('');
		view.hostEnabled.value = true;
		await settle();
		expect(view.hostOpen.value).toBe(false);
		trigger.click();
		await settle();
		expect(view.hostOpen.value).toBe(true);
		view.hostRef.value = null;
		await settle();
		expect(view.hostOpen.value).toBe(false);
		view.hostRef.value = view.hostTarget;
		await settle();
		trigger.click();
		await settle();
		window.document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		expect(view.hostOpen.value).toBe(false);
	});
});

describe('UI S composer textarea width changes', () => {
	let observers: ResizeObserverMock[];

	class ResizeObserverMock {
		private readonly targets = new Set<Element>();
		readonly disconnect = vi.fn(() => this.targets.clear());

		constructor(private readonly callback: ResizeObserverCallback) {
			observers.push(this);
		}

		observe = vi.fn((target: Element) => { this.targets.add(target); });

		notify(target: Element, width: number, height = 42) {
			expect(this.targets.has(target)).toBe(true);
			this.callback([{
				target,
				contentRect: new DOMRect(0, 0, width, height),
			} as ResizeObserverEntry], this as unknown as ResizeObserver);
		}
	}

	beforeEach(() => {
		observers = [];
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
	});

	afterEach(() => { vi.unstubAllGlobals(); });

	it('tracks confirmation panel height changes without replacing the draft', async () => {
		const view = mount();
		const input = view.input();
		const action: NoteActionConfirmation = {
			kind: 'delete',
			note: { id: 'target', text: 'Target', user: { id: 'writer', username: 'writer', host: null } } as Misskey.entities.Note,
			run: vi.fn().mockResolvedValue(undefined),
		};
		view.openConfirmation(action);
		await settle();
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		const stage = root.firstElementChild as HTMLElement;
		const panel = view.target.querySelector<HTMLElement>('[role="dialog"]')!;
		let height = 180;
		Object.defineProperty(panel, 'offsetHeight', { get: () => height });
		observers[1].notify(panel, 300, height);
		await settle();
		expect(stage.style.height).toBe('180px');
		height = 220;
		observers[1].notify(panel, 250, height);
		await settle();
		expect(stage.style.height).toBe('220px');
		expect(view.input()).toBe(input);
	});

	it('recalculates the open picker budget when preview or context increases the composer height', async () => {
		const viewportHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(568);
		cleanups.push(() => viewportHeight.mockRestore());
		const view = mount();
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		let baseHeight = 126;
		Object.defineProperty(root, 'offsetHeight', { get: () => baseHeight });
		const rect = vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => new DOMRect(10, 484 - baseHeight, 300, baseHeight));
		cleanups.push(() => rect.mockRestore());
		view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
		await vi.dynamicImportSettled();
		await settle();
		const menu = view.target.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		expect(menu.style.maxHeight).toBe('278px');
		baseHeight = 230;
		observers[0].notify(root, 300, baseHeight);
		await settle();
		expect(menu.style.maxHeight).toBe('174px');
	});

	it('recalculates hosted height when the header grows without resizing the target', async () => {
		const view = mount('uiS:composer:host:header', { emojiHost: true });
		const root = view.target.querySelector<HTMLElement>('[data-hk3-composer-menus]')!;
		vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 420, 320, 120));
		let headerBottom = 60;
		vi.spyOn(view.hostTarget!, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, headerBottom, 320, 0));
		view.target.querySelector<HTMLButtonElement>('button[title="Emoji"]')!.click();
		await vi.dynamicImportSettled();
		await settle();
		const menu = view.hostTarget!.querySelector<HTMLElement>('[data-composer-menu="emoji"]')!;
		expect(menu.style.maxHeight).toBe('352px');
		headerBottom = 100;
		observers[0].notify(view.hostTarget!.parentElement!, 320, 100);
		await settle();
		expect(menu.style.maxHeight).toBe('312px');
	});

	it('shrinks the same textarea when a narrow pane returns to full width', async () => {
		const view = mount();
		const input = view.input();
		const observer = observers[0];
		let width = 180;
		Object.defineProperty(input, 'clientWidth', { get: () => width });
		Object.defineProperty(input, 'scrollHeight', { get: () => width < 300 ? 210 : 65 });
		setText(view, 'draft that wraps in a narrow pane');
		await settle();
		observer.notify(input, width);
		expect(input.style.height).toBe('120px');
		width = 400;
		observer.notify(input, width);
		expect(view.input()).toBe(input);
		expect(input.style.height).toBe('65px');
		expect(input.value).toBe('draft that wraps in a narrow pane');
	});

	it('keeps the last height at zero width and measures again on return', async () => {
		const view = mount();
		const input = view.input();
		const observer = observers[0];
		let width = 180;
		const scrollHeight = vi.fn(() => width < 300 ? 210 : 65);
		Object.defineProperty(input, 'clientWidth', { get: () => width });
		Object.defineProperty(input, 'scrollHeight', { get: scrollHeight });
		observer.notify(input, width);
		expect(input.style.height).toBe('120px');
		width = 0;
		observer.notify(input, width);
		const reads = scrollHeight.mock.calls.length;
		setText(view, 'draft while hidden');
		await settle();
		expect(input.style.height).toBe('120px');
		expect(scrollHeight).toHaveBeenCalledTimes(reads);
		width = 400;
		observer.notify(input, width);
		expect(input.style.height).toBe('65px');
		expect(input.value).toBe('draft while hidden');
	});

	it('ignores height-only notifications, updates a compact limit at the same width, and disconnects', async () => {
		const view = mount('uiS:composer:main', { compact: false });
		const input = view.input();
		const observer = observers[0];
		const scrollHeight = vi.fn(() => 145);
		Object.defineProperty(input, 'clientWidth', { get: () => 400 });
		Object.defineProperty(input, 'scrollHeight', { get: scrollHeight });
		observer.notify(input, 400);
		expect(input.style.height).toBe('145px');
		const reads = scrollHeight.mock.calls.length;
		observer.notify(input, 400, 145);
		observer.notify(input, 400, 160);
		expect(scrollHeight).toHaveBeenCalledTimes(reads);
		view.setCompact(true);
		await settle();
		expect(view.input()).toBe(input);
		expect(input.style.height).toBe('120px');
		view.unmount();
		expect(observer.disconnect).toHaveBeenCalledOnce();
	});
});

describe('UI S inline note confirmation', () => {
	function request(run = vi.fn().mockResolvedValue(undefined), kind: NoteActionConfirmation['kind'] = 'delete'): NoteActionConfirmation {
		return {
			kind, run,
			note: { id: 'original', text: 'Original note', cw: null, files: [], emojis: {}, isHidden: false, user: { id: 'writer', username: 'writer', host: 'example.org', name: 'Writer' } } as unknown as Misskey.entities.Note,
		};
	}

	it('keeps the same draft DOM and attachment through cancel, and a closed dialog cannot run', async () => {
		const view = mount();
		expect(view.adopt({ channel: null, initialFiles: [driveFile('kept')] })).toBe(true);
		setText(view, 'Unsent text');
		await settle();
		const input = view.input();
		const action = request();
		expect(view.canConfirm()).toBe(true);
		expect(view.collapseBlocked()).toBe(false);
		expect(view.openConfirmation(action)).toBe(true);
		await settle();
		expect(view.collapseBlocked()).toBe(true);
		const dialog = view.target.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.hasAttribute('data-reduced-motion')).toBe(true);
		expect(view.input()).toBe(input);
		expect(input.closest('[inert]')).not.toBeNull();
		expect(window.document.activeElement).toBe(dialog.querySelector('button[title="Cancel"]'));
		dialog.querySelector<HTMLButtonElement>('button[title="Cancel"]')!.click();
		await settle();
		expect(view.confirmationActive()).toBe(false);
		expect(view.collapseBlocked()).toBe(false);
		expect(view.input()).toBe(input);
		expect(input.value).toBe('Unsent text');
		expect(view.ids()).toEqual(['kept']);
		expect(input.closest('[inert]')).toBeNull();
		dialog.querySelector<HTMLButtonElement>('button[title="Delete"]')!.click();
		await settle();
		expect(action.run).not.toHaveBeenCalled();
	});

	it('reveals an offscreen composer before opening the confirmation', async () => {
		const context: Hk3PostContext = { begin: vi.fn(() => ({ complete: vi.fn(), cancel: vi.fn() })), reveal: vi.fn() };
		const view = mount('uiS:composer:main', { postContext: context });
		await settle();
		expect(view.openConfirmation(request())).toBe(true);
		expect(context.reveal).toHaveBeenCalledTimes(1);
	});

	it('runs once during repeated confirmation and does not revive a cancelled busy dialog', async () => {
		const view = mount();
		const pending = deferred<void>();
		const action = request(vi.fn(() => pending.promise));
		view.openConfirmation(action);
		await settle();
		const button = view.target.querySelector<HTMLButtonElement>('[role="dialog"] button[title="Delete"]')!;
		button.click();
		button.click();
		await settle();
		expect(view.collapseBlocked()).toBe(true);
		expect(action.run).toHaveBeenCalledTimes(1);
		const cancel = view.target.querySelector<HTMLButtonElement>('[role="dialog"] button[title="Cancel"]')!;
		expect(cancel.getAttribute('aria-disabled')).toBe('true');
		cancel.click();
		cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(view.confirmationActive()).toBe(true);
		view.cancelConfirmation();
		await settle();
		expect(view.confirmationActive()).toBe(false);
		expect(view.collapseBlocked()).toBe(true);
		expect(view.openConfirmation(action)).toBe(true);
		pending.resolve();
		await settle();
		expect(view.confirmationActive()).toBe(false);
		expect(action.run).toHaveBeenCalledTimes(1);
	});

	it('shows the original note for an unrenote while retaining its wrapper as the action target', async () => {
		const view = mount();
		const run = vi.fn().mockResolvedValue(undefined);
		const action = request(run, 'unrenote');
		action.note = { ...action.note, text: null, renote: { ...action.note, id: 'quoted', text: 'Quoted content', user: { ...action.note.user, username: 'quoted', host: null } } } as Misskey.entities.Note;
		view.openConfirmation(action);
		await settle();
		expect(view.target.querySelector('[role="dialog"]')?.textContent).toContain('Quoted content');
		expect(view.target.querySelector('[role="dialog"]')?.textContent).toContain('@quoted');
		view.target.querySelector<HTMLButtonElement>('[role="dialog"] button[title="Remove renote"]')!.click();
		await settle();
		expect(run).toHaveBeenCalledTimes(1);
		expect(action.note.id).toBe('original');
	});

	it('shows a failed action inline and permits an explicit retry', async () => {
		const view = mount();
		const run = vi.fn().mockRejectedValueOnce(new Error('Delete failed')).mockResolvedValue(undefined);
		view.openConfirmation(request(run));
		await settle();
		const button = view.target.querySelector<HTMLButtonElement>('[role="dialog"] button[title="Delete"]')!;
		button.click();
		await settle();
		expect(view.target.querySelector('[role="alert"]')?.textContent).toBe('Delete failed');
		expect(view.confirmationActive()).toBe(true);
		expect(button.getAttribute('aria-label')).toBe('Retry');
		button.click();
		await settle();
		expect(run).toHaveBeenCalledTimes(2);
		expect(view.confirmationActive()).toBe(false);
	});

	it('falls back while uploading or in deck, and keeps post shortcuts inactive during confirmation', async () => {
		const uploading = deferred<Misskey.entities.DriveFile[]>();
		mocks.upload.mockReturnValue(uploading.promise);
		const view = mount();
		pasteFile(view);
		await settle();
		expect(view.canConfirm()).toBe(false);
		expect(view.openConfirmation(request())).toBe(false);
		uploading.resolve([]);
		await settle();
		setText(view);
		view.openConfirmation(request());
		await settle();
		keyboardSubmit(view);
		await settle();
		expect(mocks.api).not.toHaveBeenCalled();
		const deck = mount('uiS:composer:deck', { deck: true });
		expect(deck.canConfirm()).toBe(false);
		expect(deck.openConfirmation(request())).toBe(false);
	});
});
