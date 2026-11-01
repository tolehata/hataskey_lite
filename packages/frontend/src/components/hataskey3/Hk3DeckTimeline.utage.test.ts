/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import Hk3DeckTimeline from './Hk3DeckTimeline.vue';

const mocks = vi.hoisted(() => ({
	api: vi.fn(), channel: vi.fn(), note: null as null | ((note: unknown) => void), intersection: null as null | ((entries: { isIntersecting: boolean }[]) => void),
}));

vi.mock('./Hk3Note.vue', () => ({ default: {
	props: ['note', 'size', 'inLocal', 'inSocial'],
	template: '<div :data-rendered-note="note.id" :data-note-size="size" :data-utage-local="String(inLocal)" :data-utage-social="String(inSocial)" />',
} }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _hataskeyUi3: { loadFailed: 'Load failed', retry: 'Retry', noNotes: 'No notes', loadOlderFailed: 'Load older failed', endOfTimeline: 'End' } } } } }));
vi.mock('@/store.js', () => ({ store: { s: { tl: { filter: { withSensitive: true, onlyFiles: false } } } } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false }, r: { ltlEmojiVoteEnabled: { value: false } } } }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: mocks.channel }) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/instance.js', () => ({ instance: { notesPerOneAd: 2 } }));
vi.mock('@/events.js', () => ({ globalEvents: { on: vi.fn(), off: vi.fn() }, useGlobalEvent: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/components/MkLtlEmojiVote.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/ltl-emoji-vote.js', async () => {
	const { ref } = await import('vue');
	return { useLtlEmojiVote: () => ({ round: ref(null), choice: ref(null), now: ref(null), phase: ref('idle'), submitting: ref(false), voteError: ref(null), declined: ref(false), refresh: vi.fn(), vote: vi.fn(), dismiss: vi.fn(), claimEffect: vi.fn() }) };
});
vi.mock('@/utility/ltl-emoji-vote-anchor.js', () => ({ getLtlEmojiVoteAnchor: () => null }));
vi.mock('@/composables/use-note-removal.js', () => ({ useNoteRemoval: () => ({ cancelAll: vi.fn(), remove: vi.fn() }) }));

let cleanup: (() => void) | undefined;

async function settle() { for (let i = 0; i < 6; i++) { await Promise.resolve(); await nextTick(); } }

async function mount(src: 'home' | 'local' | 'social' | 'global') {
	const state = reactive({ src });
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(Hk3DeckTimeline, { src: state.src }) });
	app.component('MkLoading', { render: () => null });
	app.component('MkAd', { props: ['preferForms'], template: '<div data-timeline-ad :data-forms="preferForms.join(\',\')" />' });
	app.mount(host);
	cleanup = () => { app.unmount(); host.remove(); };
	await settle();
	return { host, state };
}

beforeEach(() => {
	mocks.api.mockReset().mockResolvedValue([{ id: 'note', userId: 'local-user', user: { id: 'local-user', host: null }, text: '宴' }]);
	mocks.note = null;
	mocks.channel.mockReset().mockImplementation(() => ({ on: (_name: string, handler: (note: unknown) => void) => { mocks.note = handler; }, dispose: vi.fn() }));
	vi.stubGlobal('IntersectionObserver', class { constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { mocks.intersection = callback; } observe() {} disconnect() {} });
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); });

describe('UI S deck utage timeline scope', () => {
	it.each(['home', 'local', 'social', 'global'] as const)('passes utage scope only for local/social on %s', async src => {
		const { host } = await mount(src);
		const note = host.querySelector('[data-rendered-note="note"]');
		expect(note?.getAttribute('data-note-size')).toBe('sm');
		expect(note?.getAttribute('data-utage-local')).toBe(String(src === 'local'));
		expect(note?.getAttribute('data-utage-social')).toBe(String(src === 'social'));
	});

	it('updates utage scope when the deck column source changes', async () => {
		const { host, state } = await mount('local');
		const note = () => host.querySelector('[data-rendered-note="note"]');
		expect(note()?.getAttribute('data-utage-local')).toBe('true');
		state.src = 'social';
		await settle();
		expect(note()?.getAttribute('data-utage-local')).toBe('false');
		expect(note()?.getAttribute('data-utage-social')).toBe('true');
		state.src = 'home';
		await settle();
		expect(note()?.getAttribute('data-utage-local')).toBe('false');
		expect(note()?.getAttribute('data-utage-social')).toBe('false');
	});
});

describe('UI S deck timeline ads', () => {
	const note = (id: string) => ({ id, userId: 'other', user: { id: 'other' }, text: 'body' });
	const rows = (host: Element) => [...host.querySelector('[data-rendered-note]')!.parentElement!.children].map(el => el.getAttribute('data-rendered-note') ?? (el.hasAttribute('data-timeline-ad') ? 'ad' : '?'));

	it('renders both page markers without changing the 20-note cursor', async () => {
		const first = Array.from({ length: 20 }, (_, i) => Object.freeze(note(`first-${i}`)));
		const older = Array.from({ length: 20 }, (_, i) => Object.freeze(note(`older-${i}`)));
		mocks.api.mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce(older);
		const { host } = await mount('home');
		expect(rows(host).slice(0, 6)).toEqual(['first-0', 'first-1', 'first-2', 'first-3', 'ad', 'first-4']);
		mocks.intersection?.([{ isIntersecting: true }]);
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/timeline', expect.objectContaining({ limit: 20, untilId: 'first-19' }));
		expect(rows(host).slice(21, 34)).toEqual(['older-0', 'older-1', 'older-2', 'older-3', 'older-4', 'older-5', 'older-6', 'older-7', 'older-8', 'older-9', 'older-10', 'ad', 'older-11']);
		expect(host.querySelectorAll('[data-rendered-note]')).toHaveLength(40);
		expect(first[3]).not.toHaveProperty('_shouldInsertAd_');
		expect(older[10]).not.toHaveProperty('_shouldInsertAd_');
	});

	it('counts duplicate stream notes once and preserves the queued ad', async () => {
		const { host } = await mount('home');
		host.style.overflowY = 'auto';
		host.scrollTop = 100;
		mocks.note?.(note('new-1'));
		mocks.note?.(note('new-1'));
		mocks.note?.(note('new-2'));
		await settle();
		expect(host.querySelector('button')?.textContent).toContain('2');
		host.querySelector<HTMLButtonElement>('button')!.click();
		await settle();
		expect(rows(host).slice(0, 4)).toEqual(['new-2', 'ad', 'new-1', 'note']);
	});
});
