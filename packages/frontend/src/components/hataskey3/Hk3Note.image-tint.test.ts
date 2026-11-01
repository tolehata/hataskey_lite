/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import Hk3Note from './Hk3Note.vue';
import type * as Misskey from 'cherrypick-js';

const mocks = vi.hoisted(() => ({
	apiWithDialog: vi.fn(),
	emit: vi.fn(),
	popupMenu: vi.fn(),
	copyLink: vi.fn(),
	abuse: vi.fn(),
	account: { id: 'me', isAdmin: false, isModerator: false },
	observeTint: vi.fn(),
}));

vi.mock('@/os.js', () => ({ apiWithDialog: mocks.apiWithDialog, popupMenu: mocks.popupMenu }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: mocks.emit } }));
vi.mock('@/i.js', () => ({ $i: mocks.account }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	unrenote: 'Undo renote', cancel: 'Cancel',
	renote: 'Renote', quote: 'Quote', more: 'More',
	renoteDetails: 'Renote details', copyLinkRenote: 'Copy renote link', reportAbuseRenote: 'Report renote',
	_hata: { _hataskeyUi3: {
		reply: 'Reply', addReaction: 'React',
		unrenoteConfirm: 'Undo this renote?', unrenoteConfirmAction: 'Confirm undo',
	} },
} } }));
vi.mock('@/custom-emojis.js', () => ({ customEmojisMap: new Map() }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: { animation: false }, r: { disableNyaize: ref(false), 'postFormVisibilityBorder.enabled': ref(false) } } };
});
vi.mock('@/utility/check-word-mute.js', () => ({ checkWordMute: () => false }));
vi.mock('@/composables/use-note-capture.js', () => ({
	noteEvents: { emit: vi.fn() },
	useNoteCapture: ({ note: captured }: { note: { reactions: Record<string, number>; reactionEmojis: Record<string, string> } }) => ({
		$note: { reactions: captured.reactions, reactionEmojis: captured.reactionEmojis, myReaction: null },
		subscribe: vi.fn(),
	}),
}));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: vi.fn() } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/get-note-menu.js', () => ({ getNoteMenu: vi.fn(), getRenoteMenu: vi.fn(), getCopyNoteLinkMenu: mocks.copyLink, getAbuseNoteMenu: mocks.abuse }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@@/js/note.js', () => ({ notePage: (linked: { id: string }) => `/notes/${linked.id}` }));
vi.mock('@/filters/user.js', () => ({ userPage: (user: { id: string }) => `/users/${user.id}` }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { template: '<div data-attachment-stub />' } }));
vi.mock('./hk3-image-edge-tint.js', () => ({
	IMAGE_EDGE_SIDES: ['left', 'right', 'top', 'bottom'],
	observeImageEdgeTint: mocks.observeTint,
}));
vi.mock('@/components/MkPoll.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionsViewer.reaction.vue', () => ({ default: {
	props: ['noteId', 'note', 'reaction', 'reactionEmojis', 'myReaction', 'count', 'isInitial', 'custom'],
	emits: ['activate'],
	template: '<button type="button" @click="$emit(\'activate\', $event)"><slot /></button>',
} }));
vi.mock('./use-hk3-reactions.js', async () => {
	const { computed } = await import('vue');
	return { useHk3Reactions: (_id: string, source: () => Record<string, number>) => computed(source) };
});
vi.mock('@/components/MkUtageStatus.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3ConfirmBubble.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3InstanceBadge.vue', () => ({ default: {
	props: ['host', 'instance'],
	template: '<span data-instance-badge>{{ instance?.name ?? host }}</span>',
} }));

const cleanups: (() => void)[] = [];
const palette = { left: [30, 110, 200], right: [210, 60, 40], top: [40, 160, 60], bottom: [140, 60, 190] };
const geometry = { left: 72, top: 118, width: 240, height: 160, centerX: 192, centerY: 198, visibleEdges: { left: true, right: true, top: true, bottom: true } };
let stop: ReturnType<typeof vi.fn>;

function fixture(cw: string | null = null, sensitive = false) {
	return {
		id: 'image-note', userId: 'author', user: { id: 'author', username: 'author', host: null },
		createdAt: '2026-09-26T00:00:00.000Z', text: 'sharp body', cw,
		fileIds: ['attachment'], files: [{ id: 'attachment', type: 'image/png', isSensitive: sensitive }],
		visibility: 'public', reactions: {}, reactionEmojis: {}, repliesCount: 0, renoteCount: 0,
	} as unknown as Misskey.entities.Note;
}

function mount(current: Misskey.entities.Note, size: 'lg' | 'sm' = 'lg', hideSensitive = false) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3Note, { note: current, size, hideSensitive }) });
	for (const componentName of ['MkA', 'MkAvatar', 'MkUserName', 'MkTime', 'Mfm', 'MkLoading']) {
		app.component(componentName, { props: ['text'], template: '<span>{{ text }}<slot /></span>' });
	}
	app.directive('user-preview', {});
	app.mount(target);
	const unmount = () => { app.unmount(); target.remove(); };
	cleanups.push(unmount);
	return { target, unmount };
}

beforeEach(() => {
	stop = vi.fn();
	mocks.observeTint.mockReset().mockReturnValue(stop);
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.unstubAllGlobals();
});

describe('Hk3Note image tint integration', () => {
	it.each(['lg', 'sm'] as const)('renders decorative four-edge tint behind readable body in %s without mutating note data', async size => {
		const current = fixture();
		const before = JSON.stringify(current);
		const { target } = mount(current, size);
		await nextTick();
		expect(mocks.observeTint).toHaveBeenCalledTimes(1);
		const [host, apply, options] = mocks.observeTint.mock.calls[0];
		expect(host.querySelector('[data-attachment-stub]')).not.toBeNull();
		expect(options.geometry.relativeTo).toBe(target.querySelector('article'));
		const layer = target.querySelector('[data-image-edge-tint]')!;
		expect(layer.hasAttribute('data-tinted')).toBe(false);
		expect([...layer.querySelectorAll<HTMLElement>('[data-edge]')].map(edge => edge.style.backgroundColor)).toEqual(Array(4).fill('transparent'));
		options.geometry.apply(geometry);
		apply(palette);
		await nextTick();
		expect(target.querySelector('[data-image-edge-tint]')).toBe(layer);
		expect(layer.getAttribute('data-tinted')).toBe('true');
		expect(layer.querySelector<HTMLElement>('[data-edge="left"]')?.style.backgroundColor).toBe('rgb(30, 110, 200)');
		expect((layer as HTMLElement).style.getPropertyValue('--image-left')).toBe('72px');
		expect((layer as HTMLElement).style.getPropertyValue('--image-top')).toBe('118px');
		expect((layer as HTMLElement).style.getPropertyValue('--image-width')).toBe('240px');
		expect((layer as HTMLElement).style.getPropertyValue('--image-height')).toBe('160px');
		expect(layer.getAttribute('aria-hidden')).toBe('true');
		expect([...layer.querySelectorAll('[data-edge]')].map(edge => edge.getAttribute('data-edge'))).toEqual(['left', 'right', 'top', 'bottom']);
		expect(target.textContent).toContain('sharp body');
		expect(JSON.stringify(current)).toBe(before);
		apply(null);
		await nextTick();
		expect(target.querySelector('[data-image-edge-tint]')).toBe(layer);
		expect(layer.hasAttribute('data-tinted')).toBe(false);
		expect([...layer.querySelectorAll<HTMLElement>('[data-edge]')].map(edge => edge.style.backgroundColor)).toEqual(Array(4).fill('transparent'));
		expect((layer as HTMLElement).style.getPropertyValue('--image-left')).toBe('');
	});
	it('updates the same layer on geometry movement and suppresses clipped image edges', async () => {
		const { target } = mount(fixture());
		await nextTick();
		const [_, apply, options] = mocks.observeTint.mock.calls[0];
		const layer = target.querySelector<HTMLElement>('[data-image-edge-tint]')!;
		options.geometry.apply(geometry);
		apply(palette);
		await nextTick();
		options.geometry.apply({ ...geometry, top: 164, centerY: 244, visibleEdges: { ...geometry.visibleEdges, bottom: false } });
		await nextTick();
		expect(target.querySelector('[data-image-edge-tint]')).toBe(layer);
		expect(layer.style.getPropertyValue('--image-top')).toBe('164px');
		expect(layer.querySelector<HTMLElement>('[data-edge="bottom"]')?.style.backgroundColor).toBe('transparent');
		expect(layer.querySelector<HTMLElement>('[data-edge="top"]')?.style.backgroundColor).toBe('rgb(40, 160, 60)');
	});
	it('does not mount empty glow layers for text or video-only notes', async () => {
		for (const files of [[], [{ id: 'attachment', type: 'video/mp4' }]]) {
			const current = { ...fixture(), files } as Misskey.entities.Note;
			const { target } = mount(current);
			await nextTick();
			expect(target.querySelector('[data-image-edge-tint]')).toBeNull();
		}
	});
	it('does not observe CW attachments until opened and disposes when closed or unmounted', async () => {
		const { target, unmount } = mount(fixture('CW'));
		await nextTick();
		expect(mocks.observeTint).not.toHaveBeenCalled();
		expect(target.querySelector('[data-image-edge-tint]')).toBeNull();
		const toggle = target.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
		toggle.click();
		await nextTick();
		expect(mocks.observeTint).toHaveBeenCalledTimes(1);
		mocks.observeTint.mock.calls[0][2].geometry.apply(geometry);
		mocks.observeTint.mock.calls[0][1](palette);
		await nextTick();
		toggle.click();
		await nextTick();
		expect(stop).toHaveBeenCalledTimes(1);
		expect(target.querySelector('[data-image-edge-tint]')).toBeNull();
		toggle.click();
		await nextTick();
		expect(mocks.observeTint).toHaveBeenCalledTimes(2);
		unmount();
		expect(stop).toHaveBeenCalledTimes(2);
	});
	it('does not mount/observe note-level sensitive media until explicitly shown', async () => {
		const { target } = mount(fixture(null, true), 'sm', true);
		await nextTick();
		expect(mocks.observeTint).not.toHaveBeenCalled();
		target.querySelector<HTMLButtonElement>('button')!.click();
		await nextTick();
		expect(mocks.observeTint).toHaveBeenCalledTimes(1);
	});
});
