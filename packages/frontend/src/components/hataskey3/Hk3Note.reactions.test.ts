/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick, reactive } from 'vue';
import type { entities } from 'cherrypick-js';
import Hk3Note from './Hk3Note.vue';
import externalNoteSource from '@/components/MkExternalNote.vue?raw';
import { DI } from '@/di.js';
import { prefer } from '@/preferences.js';

const mocks = vi.hoisted(() => ({
	me: { id: 'me' } as { id: string } | null,
	api: vi.fn(), dialog: vi.fn(), emit: vi.fn(), picker: vi.fn(), confirm: vi.fn(),
	login: vi.fn(), sound: vi.fn(), remoteEnabled: true,
	emojis: new Map<string, unknown>(), callbacks: new Map<string, (emoji: string) => void>(),
}));
vi.mock('@/i.js', () => ({ get $i() { return mocks.me; } }));
vi.mock('@/os.js', () => ({ apiWithDialog: mocks.dialog, confirm: mocks.confirm }));
vi.mock('@/custom-emojis.js', () => ({ customEmojisMap: mocks.emojis }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: {
		s: { animation: false, confirmOnReact: false, get reactableRemoteReactionEnabled() { return mocks.remoteEnabled; } },
		r: {
			disableNyaize: ref(false),
			'postFormVisibilityBorder.enabled': ref(false),
			'postFormVisibilityBorder.color.public': ref('#336699'),
			'postFormVisibilityBorder.color.home': ref('#228855'),
			'postFormVisibilityBorder.color.followers': ref('#aa7711'),
			'postFormVisibilityBorder.color.specified': ref('#bb4455'),
		},
	} };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: mocks.login }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: mocks.sound }));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: mocks.picker } }));
vi.mock('@/utility/check-word-mute.js', () => ({ checkWordMute: () => false }));
vi.mock('@/utility/get-note-menu.js', () => ({ getNoteMenu: vi.fn(), getRenoteMenu: vi.fn(), getCopyNoteLinkMenu: vi.fn(), getAbuseNoteMenu: vi.fn() }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	renote: 'Renote', quote: 'Quote', more: 'More', ok: 'OK', cancel: 'Cancel',
	changeReactionConfirm: 'Change reaction?', cancelReactionConfirm: 'Remove reaction?',
	_hata: { _hataskeyUi3: { reply: 'Reply', addReaction: 'React', conversation: 'Conversation' } },
} } }));
vi.mock('@/composables/use-note-capture.js', () => ({
	noteEvents: { emit: mocks.emit },
	useNoteCapture: ({ note }: { note: entities.Note }) => ({ $note: note, subscribe: vi.fn() }),
}));
vi.mock('./use-hk3-reactions.js', async () => {
	const { computed } = await import('vue');
	return { useHk3Reactions: (_id: string, source: () => Record<string, number>) => computed(source) };
});
vi.mock('@@/js/note.js', () => ({ notePage: (note: entities.Note) => `/notes/${note.id}` }));
vi.mock('@/filters/user.js', () => ({ userPage: (user: entities.UserLite) => `/users/${user.id}` }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkPoll.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkUtageStatus.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3InstanceBadge.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3ConfirmBubble.vue', () => ({ default: { emits: ['ok'], template: '<button data-confirm-unreact @click="$emit(\'ok\')">OK</button>' } }));
vi.mock('@/components/MkReactionsViewer.reaction.vue', () => ({ default: {
	props: ['reaction'], emits: ['activate'], template: '<button :data-reaction="reaction" @click="$emit(\'activate\', $event)"><slot /></button>',
} }));

function note(id: string, reactions: Record<string, number> = {}) {
	return {
		id, userId: 'author', user: { id: 'author', username: 'author', host: null },
		createdAt: '2026-09-27T00:00:00Z', text: id, cw: null, visibility: 'public',
		files: [], fileIds: [], renoteId: null, reactions, reactionEmojis: {},
		repliesCount: 0, renoteCount: 0, myReaction: null,
	} as unknown as entities.Note;
}

const cleanups: (() => void)[] = [];

function mount(current: entities.Note, threadReply = false, mobile = false, size: 'sm' | 'lg' = 'sm') {
	const host = window.document.createElement('div');
	if (mobile) host.dataset.mobile = 'true';
	window.document.body.append(host);
	const app = createApp({ render: () => h(Hk3Note, { note: current, size, threadReply }) });
	app.component('Mfm', defineComponent({
		props: ['text', 'enableEmojiMenuReaction'],
		setup(props) {
			const callback = inject(DI.mfmEmojiReactCallback);
			if (callback) mocks.callbacks.set(props.text, callback);
			return () => h('span', { 'data-mfm': props.text, 'data-menu-reaction': String(props.enableEmojiMenuReaction) });
		},
	}));
	for (const name of ['MkA', 'MkAvatar', 'MkUserName', 'MkTime', 'MkLoading']) app.component(name, { template: '<span><slot /></span>' });
	app.directive('user-preview', {});
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return host;
}

async function settle() { for (let n = 0; n < 5; n++) { await Promise.resolve(); await nextTick(); } }

let measureFrame: FrameRequestCallback | undefined;
let resizeCallback: ResizeObserverCallback | undefined;

async function layoutReactionRows(host: Element, columns: number) {
	const list = host.querySelector<HTMLElement>('button[data-reaction]')!.parentElement!;
	const children = Array.from(list.children) as HTMLElement[];
	children.forEach((child, index) => {
		Object.defineProperty(child, 'offsetTop', { configurable: true, value: Math.floor(index / columns) * 40 });
		Object.defineProperty(child, 'offsetHeight', { configurable: true, value: 34 });
	});
	Object.defineProperty(list, 'scrollHeight', { configurable: true, value: Math.ceil(children.length / columns) * 40 - 6 });
	resizeCallback?.([], {} as ResizeObserver);
	measureFrame?.(0);
	await nextTick();
	return list;
}

function chip(host: Element, reaction: string) {
	const button = [...host.querySelectorAll<HTMLButtonElement>('button[data-reaction]')].find(el => el.dataset.reaction === reaction);
	expect(button).toBeDefined();
	return button!;
}

beforeEach(() => {
	vi.clearAllMocks(); mocks.me = { id: 'me' }; mocks.remoteEnabled = true;
	prefer.r['postFormVisibilityBorder.enabled'].value = false;
	prefer.r['postFormVisibilityBorder.color.public'].value = '#336699';
	prefer.r['postFormVisibilityBorder.color.home'].value = '#228855';
	prefer.r['postFormVisibilityBorder.color.followers'].value = '#aa7711';
	prefer.r['postFormVisibilityBorder.color.specified'].value = '#bb4455';
	mocks.emojis.clear(); mocks.callbacks.clear();
	mocks.dialog.mockResolvedValue(undefined); mocks.confirm.mockResolvedValue({ canceled: false }); mocks.api.mockResolvedValue([]);
	resizeCallback = undefined;
	vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resizeCallback = callback; } observe() {} disconnect() {} });
	measureFrame = undefined;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { measureFrame = callback; return 1; }); vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe('UI S visibility rail', () => {
	it.each([
		['public', '#336699'], ['home', '#228855'], ['followers', '#aa7711'], ['specified', '#bb4455'],
	])('uses the shared %s color and reacts to setting changes', async (visibility, expectedColor) => {
		const current = note('target');
		current.visibility = visibility as entities.Note['visibility'];
		const host = mount(current);
		const rail = () => host.querySelector<HTMLElement>('[data-hk3-visibility-rail]');
		expect(rail()).toBeNull();
		prefer.r['postFormVisibilityBorder.enabled'].value = true;
		await nextTick();
		expect(rail()?.style.getPropertyValue('--hk3-visibility-color')).toBe(expectedColor);
		prefer.r[`postFormVisibilityBorder.color.${visibility}` as 'postFormVisibilityBorder.color.public'].value = '#123456';
		await nextTick();
		expect(rail()?.style.getPropertyValue('--hk3-visibility-color')).toBe('#123456');
		prefer.r['postFormVisibilityBorder.enabled'].value = false;
		await nextTick();
		expect(rail()).toBeNull();
	});

	it('keeps unknown visibility colorless', async () => {
		prefer.r['postFormVisibilityBorder.enabled'].value = true;
		const current = note('unknown');
		current.visibility = 'unknown' as entities.Note['visibility'];
		expect(mount(current).querySelector('[data-hk3-visibility-rail]')).toBeNull();
	});

	it('uses the displayed pure renote body and each thread reply visibility', () => {
		prefer.r['postFormVisibilityBorder.enabled'].value = true;
		const body = note('body');
		body.visibility = 'followers';
		const renote = { ...note('renote'), text: null, visibility: 'public', renoteId: body.id, renote: body } as entities.Note;
		const host = mount(renote);
		expect(host.querySelector<HTMLElement>('[data-hk3-visibility-rail]')?.style.getPropertyValue('--hk3-visibility-color')).toBe('#aa7711');
		const reply = note('reply');
		reply.visibility = 'specified';
		expect(mount(reply, true).querySelector<HTMLElement>('[data-hk3-visibility-rail]')?.style.getPropertyValue('--hk3-visibility-color')).toBe('#bb4455');
	});

	it('uses the same body visibility in external notes only on UI S', () => {
		expect(externalNoteSource).toContain('<Hk3VisibilityRail v-if="ui === \'hataskey3\' && !embedded" :visibility="appearNote.visibility"/>');
		expect(externalNoteSource).toContain('.root:has(> [data-hk3-visibility-rail]) {');
		expect(externalNoteSource).toContain(': resolveExternalNotePresentation(props.note));');
	});
});

describe('UI S note reaction actions', () => {
	it.each([[20, false], [200, false], [20, true], [200, true]] as const)('keeps the expanded side stable and within the note (%i reactions, own=%s)', async (count, own) => {
		const current = reactive(note('target', Object.fromEntries(Array.from({ length: count }, (_, i) => [`reaction-${i}`, 1]))));
		current.myReaction = own ? 'reaction-0' : null;
		const host = mount(current, false, false, 'lg');
		const article = host.querySelector('article');
		const firstReaction = host.querySelector('button[data-reaction]');
		const grid = firstReaction?.parentElement;
		const side = grid?.parentElement;
		const more = grid?.querySelector<HTMLButtonElement>('button:last-child');
		if (!article || !grid || !side || !more) throw new Error('Missing side reactions');
		let width = 900;
		article.style.padding = '18px 20px';
		article.style.columnGap = '12px';
		article.style.setProperty('--hk3-note-avatar-size', '44px');
		Object.defineProperty(article, 'clientWidth', { configurable: true, get: () => width });
		const sideWidth = () => Number.parseFloat(article.style.gridTemplateColumns.match(/([\d.]+)px$/)?.[1] ?? '0');
		// Narrowing the body changes its wrapped height. Feeding this back into
		// the row count used to alternate the reaction width on every resize.
		Object.defineProperty(side, 'clientHeight', { configurable: true, get: () => Math.max(Number.parseFloat(side.style.minHeight) || 0, sideWidth() > 126 ? 282 : 100) });
		const remeasure = async () => {
			resizeCallback?.([], {} as ResizeObserver);
			measureFrame?.(0);
			await settle();
		};
		await remeasure();
		more.click(); await settle();
		const expanded = article.style.gridTemplateColumns;
		for (let i = 0; i < 8; i++) {
			await remeasure();
			expect(article.style.gridTemplateColumns).toBe(expanded);
		}
		const assertFits = () => {
			expect(grid.querySelectorAll('button[data-reaction]')).toHaveLength(count);
			expect(sideWidth()).toBeLessThanOrEqual(width / 2);
			for (const cell of grid.children as HTMLCollectionOf<HTMLElement>) {
				expect(Number.parseFloat(cell.style.left) + 52).toBeLessThanOrEqual(sideWidth() - 10);
				expect(Number.parseFloat(cell.style.top) + 50).toBeLessThanOrEqual(side.clientHeight + 8);
			}
		};
		assertFits();
		width = 600;
		await remeasure();
		assertFits();
		more.click(); await settle();
		await remeasure();
		expect(sideWidth()).toBe(126);
		expect(side.style.minHeight).toBe('');
		expect(grid.querySelectorAll('button[data-reaction]').length).toBeLessThan(count);
		more.click(); await settle();
		await remeasure();
		assertFits();
		current.reactions = { 'reaction-0': 1 };
		await settle();
		await remeasure();
		expect(sideWidth()).toBe(126);
		expect(side.style.minHeight).toBe('');
		expect(more.isConnected).toBe(false);
	});

	it('shows three mobile rows without an expand button when all chips fit', async () => {
		const host = mount(note('target', Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`reaction-${i}`, 1]))), false, true);
		const list = await layoutReactionRows(host, 2);
		expect(list.style.maxHeight).toBe('114px');
		expect(list.parentElement!.children.length).toBe(1);
	});

	it('counts only the fourth mobile row onward and can expand, collapse, and remeasure', async () => {
		const host = mount(note('target', Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`reaction-${i}`, 1]))), false, true);
		const list = await layoutReactionRows(host, 2);
		const more = list.parentElement!.querySelector<HTMLButtonElement>(':scope > button')!;
		expect(list.style.maxHeight).toBe('114px');
		expect(more.textContent).toContain('+1');
		more.click(); await nextTick();
		expect(list.style.maxHeight).toBe('154px');
		more.click(); await nextTick();
		expect(list.style.maxHeight).toBe('114px');
		await layoutReactionRows(host, 3);
		expect(list.style.maxHeight).toBe('114px');
		expect(list.parentElement!.children.length).toBe(1);
		await layoutReactionRows(host, 2);
		expect(list.style.maxHeight).toBe('114px');
		expect(list.parentElement!.querySelector<HTMLButtonElement>(':scope > button')!.textContent).toContain('+1');
	});

	it('shows the expand arrow when only the add button reaches the fourth mobile row', async () => {
		const host = mount(note('target', Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`reaction-${i}`, 1]))), false, true);
		const list = await layoutReactionRows(host, 2);
		const more = list.parentElement!.querySelector<HTMLButtonElement>(':scope > button')!;
		expect(list.parentElement!.children.length).toBe(2);
		expect(more.textContent).not.toContain('+0');
		expect(more.textContent).toBe('');
		more.click(); await nextTick();
		expect(list.style.maxHeight).toBe('154px');
	});

	it('uses three rows for a mobile thread reply and remeasures after it narrows', async () => {
		const host = mount(note('reply', Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`reaction-${i}`, 1]))), true, true);
		const list = await layoutReactionRows(host, 2);
		expect(list.style.maxHeight).toBe('114px');
		expect(list.parentElement!.children.length).toBe(1);
		await layoutReactionRows(host, 1);
		expect(list.style.maxHeight).toBe('114px');
		expect(list.parentElement!.querySelector<HTMLButtonElement>(':scope > button')!.textContent).toContain('+2');
	});

	it('keeps the one-row limit for S notes outside the mobile app', async () => {
		const host = mount(note('target', Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`reaction-${i}`, 1]))));
		const list = await layoutReactionRows(host, 2);
		expect(list.style.maxHeight).toBe('34px');
		expect(list.parentElement!.querySelector<HTMLButtonElement>(':scope > button')!.textContent).toContain('+3');
	});

	it.each(['create', 'change', 'delete'] as const)('suppresses the success dialog for %s while retaining reaction events and sound', async operation => {
		const current = note('target', { '👍': 1 });
		if (operation !== 'create') current.myReaction = operation === 'delete' ? '👍' : ':old@.:';
		const host = mount(current);
		if (operation === 'delete') {
			// Clicking my own reaction opens the inline cancellation confirmation.
			chip(host, '👍').click(); await settle();
			host.querySelector<HTMLButtonElement>('[data-confirm-unreact]')!.click();
		} else {
			chip(host, '👍').click();
		}
		await settle();
		expect(mocks.dialog).toHaveBeenCalledTimes(operation === 'change' ? 2 : 1);
		const options = { showSuccess: false };
		if (operation !== 'create') {
			expect(mocks.dialog).toHaveBeenNthCalledWith(1, 'notes/reactions/delete', { noteId: 'target' }, undefined, undefined, options);
		}
		if (operation !== 'delete') {
			expect(mocks.dialog).toHaveBeenNthCalledWith(operation === 'change' ? 2 : 1, 'notes/reactions/create', { noteId: 'target', reaction: '👍' }, undefined, undefined, options);
		}
		expect(mocks.emit).toHaveBeenCalledTimes(operation === 'change' ? 2 : 1);
		expect(mocks.sound).toHaveBeenCalledTimes(operation === 'delete' ? 0 : 1);
		if (operation === 'change') expect(mocks.confirm).toHaveBeenCalledOnce();
	});

	it.each(['note', 'renote', 'thread'] as const)('provides the body emoji reaction callback for the %s target', async kind => {
		const original = note('original');
		const wrapper = { ...note('wrapper'), text: null, renoteId: original.id, renote: original };
		mount(kind === 'renote' ? wrapper : original, kind === 'thread');
		expect(mocks.callbacks.get('original')).toBeTypeOf('function');
		mocks.callbacks.get('original')!(':wave:');
		await settle();
		expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'original', reaction: ':wave:' }, undefined, undefined, { showSuccess: false });
		expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('reacted:original', { userId: 'me', reaction: ':wave:' });
	});

	it('gives an expanded thread reply its own body emoji callback', async () => {
		const parent = note('parent'); parent.repliesCount = 1;
		mocks.api.mockResolvedValue([note('reply')]);
		const host = mount(parent);
		host.querySelector<HTMLButtonElement>('button[title="Conversation"]')!.click();
		await settle();
		mocks.callbacks.get('reply')!(':wave:');
		await settle();
		expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'reply', reaction: ':wave:' }, undefined, undefined, { showSuccess: false });
	});

	it('converts a remote chip to a same-name local emoji when the setting allows it', async () => {
		mocks.emojis.set('wave', { name: 'wave' });
		chip(mount(note('target', { ':wave@remote.example:': 2 })), ':wave@remote.example:').click();
		await settle();
		expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'target', reaction: ':wave:' }, undefined, undefined, { showSuccess: false });
		expect(mocks.picker).not.toHaveBeenCalled();
	});

	it.each(['body', 'remote'] as const)('uses direct create for %s even when I already reacted', async action => {
		mocks.emojis.set('wave', { name: 'wave' });
		const current = note('target', { ':wave@remote.example:': 2 }); current.myReaction = ':old@.:';
		const host = mount(current);
		if (action === 'body') mocks.callbacks.get('target')!(':wave:');
		else chip(host, ':wave@remote.example:').click();
		await settle();
		expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith('notes/reactions/create', { noteId: 'target', reaction: ':wave:' }, undefined, undefined, { showSuccess: false });
		expect(mocks.confirm).not.toHaveBeenCalled();
	});

	it.each(['disabled', 'missing'] as const)('opens the picker without sending a remote literal when %s', async reason => {
		mocks.remoteEnabled = reason !== 'disabled';
		if (reason === 'disabled') mocks.emojis.set('wave', { name: 'wave' });
		chip(mount(note('target', { ':wave@remote.example:': 2 })), ':wave@remote.example:').click();
		await settle();
		expect(mocks.dialog).not.toHaveBeenCalled();
		expect(mocks.picker).toHaveBeenCalledOnce();
	});

	it('keeps legacy local :name: chips usable without the remote alternative setting', async () => {
		mocks.remoteEnabled = false;
		chip(mount(note('target', { ':wave:': 1 })), ':wave:').click();
		await settle();
		expect(mocks.dialog).toHaveBeenCalledWith('notes/reactions/create', { noteId: 'target', reaction: ':wave:' }, undefined, undefined, { showSuccess: false });
		expect(mocks.picker).not.toHaveBeenCalled();
	});

	it('confirms removing my remote reaction before considering a replacement', async () => {
		mocks.remoteEnabled = false;
		const current = note('target', { ':wave@remote.example:': 1 }); current.myReaction = ':wave@remote.example:';
		const host = mount(current); chip(host, current.myReaction).click(); await settle();
		expect(mocks.dialog).not.toHaveBeenCalled(); expect(mocks.picker).not.toHaveBeenCalled();
		host.querySelector<HTMLButtonElement>('[data-confirm-unreact]')!.click(); await settle();
		expect(mocks.dialog).toHaveBeenCalledExactlyOnceWith('notes/reactions/delete', { noteId: 'target' }, undefined, undefined, { showSuccess: false });
	});

	it('guards the callback and chip and disables the body reaction menu when logged out', async () => {
		mocks.me = null;
		const host = mount(note('target', { ':wave@remote.example:': 1 }));
		expect(host.querySelector('[data-mfm="target"]')?.getAttribute('data-menu-reaction')).toBe('false');
		mocks.callbacks.get('target')!(':wave:'); chip(host, ':wave@remote.example:').click(); await settle();
		expect(mocks.dialog).not.toHaveBeenCalled(); expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.picker).not.toHaveBeenCalled();
	});

	it.each(['create', 'remote', 'delete'] as const)('handles repeated %s failures through the dialog without success events', async operation => {
		mocks.dialog.mockRejectedValue(new Error('request failed'));
		mocks.emojis.set('wave', { name: 'wave' });
		const current = note('target', { ':wave@remote.example:': 1, '👍': 1 });
		if (operation === 'delete') current.myReaction = ':old@.:';
		const host = mount(current);
		const invoke = () => {
			if (operation === 'delete') chip(host, '👍').click();
			else if (operation === 'remote') chip(host, ':wave@remote.example:').click();
			else mocks.callbacks.get('target')!(':wave:');
		};
		invoke(); await settle(); invoke(); await settle();
		expect(mocks.dialog).toHaveBeenCalledTimes(2);
		const endpoint = operation === 'delete' ? 'delete' : 'create';
		expect(mocks.dialog).toHaveBeenCalledWith(`notes/reactions/${endpoint}`, endpoint === 'create' ? { noteId: 'target', reaction: ':wave:' } : { noteId: 'target' }, undefined, undefined, { showSuccess: false });
		expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.sound).not.toHaveBeenCalled();
	});
});
