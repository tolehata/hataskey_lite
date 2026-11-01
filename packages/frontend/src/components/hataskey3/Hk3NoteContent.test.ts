/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type * as Misskey from 'cherrypick-js';
import Hk3NoteContent from './Hk3NoteContent.vue';
import Hk3Note from './Hk3Note.vue';
import { prefer } from '@/preferences.js';

vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	showMore: 'Show more', showLess: 'Close', reply: 'Reply', renote: 'Renote', quote: 'Quote', more: 'More',
	_ffVisibility: { private: 'private' },
	_hata: { _hataskeyUi3: { reply: 'Reply', addReaction: 'React' } },
} } }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: {
		s: { animation: true, collapseLongNoteContent: true, collapseDefault: true, allMediaNoteCollapse: false },
		r: { animation: ref(true), disableNyaize: ref(false), 'postFormVisibilityBorder.enabled': ref(false), collapseLongNoteContent: ref(true), collapseDefault: ref(true), allMediaNoteCollapse: ref(false) },
	} };
});
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/os.js', () => ({ apiWithDialog: vi.fn(), popupMenu: vi.fn() }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/custom-emojis.js', () => ({ customEmojisMap: new Map() }));
vi.mock('@/utility/check-word-mute.js', () => ({ checkWordMute: () => false }));
vi.mock('@/composables/use-note-capture.js', () => ({
	noteEvents: { emit: vi.fn() },
	useNoteCapture: ({ note }: { note: { reactions: Record<string, number>; reactionEmojis: Record<string, string> } }) => ({
		$note: { reactions: note.reactions, reactionEmojis: note.reactionEmojis, myReaction: null }, subscribe: vi.fn(),
	}),
}));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: vi.fn() } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/get-note-menu.js', () => ({ getNoteMenu: vi.fn(), getRenoteMenu: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@@/js/note.js', () => ({ notePage: (note: { id: string }) => `/notes/${note.id}` }));
vi.mock('@/filters/user.js', () => ({ userPage: (user: { id: string }) => `/users/${user.id}` }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { template: '<div data-attachment />' } }));
vi.mock('@/components/MkPoll.vue', () => ({ default: { template: '<div data-poll />' } }));
vi.mock('@/components/MkUserRoleBadges.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionsViewer.reaction.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkUtageStatus.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3ConfirmBubble.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3InstanceBadge.vue', () => ({ default: { render: () => null } }));
vi.mock('./hk3-image-edge-tint.js', () => ({ IMAGE_EDGE_SIDES: [], observeImageEdgeTint: () => vi.fn() }));
vi.mock('./use-hk3-reactions.js', async () => {
	const { computed } = await import('vue');
	return { useHk3Reactions: (_id: string, source: () => Record<string, number>) => computed(source) };
});

const cleanups: (() => void)[] = [];
const observers: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = [];
const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

function mount(component: Parameters<typeof h>[0], props: Record<string, unknown> = {}, children?: Parameters<typeof h>[2]) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(component, props, children) });
	for (const name of ['MkA', 'MkAvatar', 'MkUserName', 'MkTime', 'Mfm', 'MkLoading']) {
		app.component(name, { props: ['text'], template: '<span>{{ text }}<slot /></span>' });
	}
	app.directive('user-preview', {});
	app.mount(target);
	const unmount = () => { app.unmount(); target.remove(); };
	cleanups.push(unmount);
	return { target, unmount };
}

function note(text: string, extra: Record<string, unknown> = {}): Misskey.entities.Note {
	return {
		id: 'note', userId: 'author', user: { id: 'author', username: 'author', host: null },
		createdAt: '2026-09-26T00:00:00.000Z', text, cw: null, files: [],
		visibility: 'public', reactions: {}, reactionEmojis: {}, repliesCount: 0, renoteCount: 0, ...extra,
	} as unknown as Misskey.entities.Note;
}

beforeEach(() => {
	observers.length = 0;
	Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
		configurable: true,
		get: function(this: HTMLElement) { return this.parentElement?.hasAttribute('data-note-content-viewport') ? 400 : 0; },
	});
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
		observe() {}
		disconnect = vi.fn();
	});
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	prefer.r.animation.value = true;
	prefer.r.collapseLongNoteContent.value = true;
	prefer.r.collapseDefault.value = true;
	prefer.r.allMediaNoteCollapse.value = false;
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeightDescriptor);
	else delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
	vi.unstubAllGlobals();
});

describe('Hk3Note content collapse', () => {
	it('uses the shared long/MFM/media conditions and follows setting changes', async () => {
		const short = mount(Hk3Note, { note: note('short') });
		expect(short.target.querySelector('[data-note-content-viewport]')).not.toBeNull();
		expect(short.target.querySelector('button[aria-expanded]')).toBeNull();
		const empty = mount(Hk3Note, { note: note('') });
		expect(empty.target.querySelector('[data-note-content-viewport]')).toBeNull();
		const long = mount(Hk3Note, { note: note('x'.repeat(501)) });
		const toggle = long.target.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
		expect(toggle.textContent).toContain('Show more');
		expect(long.target.querySelector('[data-note-content-viewport]')?.getAttribute('data-collapsed')).toBe('true');
		prefer.r.collapseLongNoteContent.value = false;
		await nextTick(); await nextTick();
		expect(long.target.querySelector('[data-note-content-viewport]')?.hasAttribute('data-collapsed')).toBe(false);
		expect(long.target.querySelector('button[aria-expanded]')).toBeNull();
		prefer.r.collapseLongNoteContent.value = true;
		await nextTick(); await nextTick();
		expect(long.target.querySelector('[data-note-content-viewport]')?.getAttribute('data-collapsed')).toBe('true');
		const mfm = mount(Hk3Note, { note: note('$[x2 hello]') });
		expect(mfm.target.querySelector('[data-collapsed]')).not.toBeNull();
		const media = mount(Hk3Note, { note: note('short', { files: [{ id: 'file', type: 'image/png' }] }) });
		expect(media.target.querySelector('[data-collapsed]')).toBeNull();
		prefer.r.allMediaNoteCollapse.value = true;
		await nextTick(); await nextTick();
		expect(media.target.querySelector('[data-collapsed]')).not.toBeNull();
	});

	it('keeps CW content out of the DOM until revealed and never adds automatic collapse', async () => {
		const { target } = mount(Hk3Note, { note: note('private hidden body'.repeat(40), { cw: 'Warning' }) });
		expect(target.textContent).not.toContain('private hidden body');
		expect(target.querySelector('[data-note-content-viewport]')).toBeNull();
		(target.querySelector('button[aria-pressed]') as HTMLButtonElement).click();
		await nextTick();
		expect(target.textContent).toContain('private hidden body');
		expect(target.querySelector('button[aria-expanded]')).toBeNull();
	});

	it('measures height, reverses from the current height, tracks content resize, and cleans up', async () => {
		const { target, unmount } = mount(Hk3NoteContent, { collapsible: true, animationEnabled: true }, { default: () => h('div', [h('button', 'hidden action')]) });
		const viewport = target.querySelector<HTMLElement>('[data-note-content-viewport]')!;
		const inner = viewport.firstElementChild as HTMLElement;
		const toggle = target.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
		viewport.style.fontSize = '16px';
		let visibleHeight = 144;
		vi.spyOn(viewport, 'getBoundingClientRect').mockImplementation(() => ({ height: visibleHeight, bottom: visibleHeight } as DOMRect));
		let contentHeight = 360;
		Object.defineProperty(inner, 'scrollHeight', { get: () => contentHeight });
		toggle.click(); await nextTick();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(viewport.style.height).toBe('360px');
		visibleHeight = 250;
		toggle.click(); await nextTick();
		expect(viewport.style.height).toBe('144px');
		visibleHeight = 144;
		toggle.click(); await nextTick();
		contentHeight = 420;
		observers[0].callback([], {} as ResizeObserver);
		expect(viewport.style.height).toBe('420px');
		const end = new Event('transitionend', { bubbles: true }) as TransitionEvent;
		Object.defineProperty(end, 'propertyName', { value: 'height' });
		viewport.dispatchEvent(end);
		expect(viewport.style.height).toBe('auto');
		visibleHeight = 300;
		toggle.click(); await nextTick();
		viewport.style.fontSize = '14.4px';
		observers[0].callback([], {} as ResizeObserver);
		expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(129.6);
		unmount();
		expect(observers[0].disconnect).toHaveBeenCalled();
	});

	it('observes candidates only and removes the control if actual content fits', async () => {
		mount(Hk3NoteContent, { collapsible: false, animationEnabled: true }, { default: () => h('span', 'short') });
		expect(observers).toHaveLength(0);
		const { target } = mount(Hk3NoteContent, { collapsible: true, animationEnabled: true }, { default: () => h('span', 'short') });
		const viewport = target.querySelector<HTMLElement>('[data-note-content-viewport]')!;
		const inner = viewport.firstElementChild as HTMLElement;
		Object.defineProperty(inner, 'scrollHeight', { get: () => 80 });
		observers[0].callback([], {} as ResizeObserver);
		await nextTick();
		expect(target.querySelector('button[aria-expanded]')).toBeNull();
		expect(viewport.style.height).toBe('auto');
		expect(viewport.hasAttribute('data-collapsed')).toBe(false);
	});

	it('opens when a clipped control receives focus and skips motion when disabled', async () => {
		const { target } = mount(Hk3NoteContent, { collapsible: true, animationEnabled: false }, { default: () => h('button', 'hidden action') });
		const viewport = target.querySelector<HTMLElement>('[data-note-content-viewport]')!;
		const hidden = viewport.querySelector<HTMLButtonElement>('button')!;
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ bottom: 144 } as DOMRect);
		vi.spyOn(hidden, 'getBoundingClientRect').mockReturnValue({ bottom: 200 } as DOMRect);
		hidden.focus(); await nextTick();
		expect(target.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('true');
		expect(viewport.style.height).toBe('auto');
	});

	it('settles active motion when reduced motion is requested and removes the listener', async () => {
		const listeners = new Set<() => void>();
		const query = {
			matches: false,
			addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
			removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
		};
		vi.stubGlobal('matchMedia', () => query);
		const { target, unmount } = mount(Hk3NoteContent, { collapsible: true, animationEnabled: true }, { default: () => h('span', 'long') });
		const viewport = target.querySelector<HTMLElement>('[data-note-content-viewport]')!;
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ height: 144 } as DOMRect);
		(target.querySelector('button[aria-expanded]') as HTMLButtonElement).click();
		await nextTick();
		expect(viewport.style.height).toBe('400px');
		query.matches = true;
		for (const listener of listeners) listener();
		expect(viewport.style.height).toBe('auto');
		unmount();
		expect(query.removeEventListener).toHaveBeenCalled();
		expect(listeners.size).toBe(0);
	});
});
