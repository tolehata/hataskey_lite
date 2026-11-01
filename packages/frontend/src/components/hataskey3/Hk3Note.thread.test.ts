/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import Hk3Note from './Hk3Note.vue';
import type * as Misskey from 'cherrypick-js';
import { prefer } from '@/preferences.js';

const mocks = vi.hoisted(() => ({
	apiWithDialog: vi.fn(),
	emit: vi.fn(),
	post: vi.fn(),
	popupMenu: vi.fn(),
	api: vi.fn(),
	picker: vi.fn(),
	menu: vi.fn(),
}));

vi.mock('@/os.js', () => ({ apiWithDialog: mocks.apiWithDialog, post: mocks.post, popupMenu: mocks.popupMenu }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: mocks.emit } }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	unrenote: 'Undo renote', cancel: 'Cancel', close: 'Close',
	renote: 'Renote', quote: 'Quote', more: 'More', reply: 'Reply',
	_visibility: { public: 'Public', home: 'Home', followers: 'Followers', specified: 'Direct' },
	_ffVisibility: { private: 'Private' },
	_hata: { _hataskeyUi3: {
		conversation: 'Conversation', reply: 'Reply', addReaction: 'React', toggleContent: 'Toggle content',
		federateTitle: 'Federated', localOnlyTitle: 'Local only (this server)',
		unrenoteConfirm: 'Undo this renote?', unrenoteConfirmAction: 'Confirm undo',
		attachmentsOnly: 'Attachments only',
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
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: mocks.picker } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/utility/get-note-menu.js', () => ({ getNoteMenu: mocks.menu, getRenoteMenu: vi.fn(), getCopyNoteLinkMenu: vi.fn(), getAbuseNoteMenu: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@@/js/note.js', () => ({ notePage: (linked: { id: string }) => `/notes/${linked.id}` }));
vi.mock('@/filters/user.js', () => ({ userPage: (user: { id: string }) => `/users/${user.id}` }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));
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

type NoteFixture = {
	id: string;
	userId: string;
	user: { id: string; username: string; host: string | null; instance?: { name: string }; badgeRoles?: { name: string; iconUrl: string | null; displayOrder: number }[] };
	createdAt: string;
	text: string | null;
	cw: string | null;
	renoteId: string | null;
	renote?: NoteFixture;
	replyId?: string | null;
	reply?: NoteFixture;
	isHidden?: boolean;
	emojis?: Record<string, string>;
	fileIds: string[];
	files: never[];
	visibility: Misskey.entities.Note['visibility'];
	localOnly?: boolean;
	reactions: Record<string, number>;
	reactionEmojis: Record<string, string>;
	repliesCount: number;
	renoteCount: number;
};

function note(id: string, userId = 'me', text: string | null = 'body'): NoteFixture {
	return {
		id, userId, user: { id: userId, username: userId, host: null },
		createdAt: '2026-09-26T00:00:00.000Z', text, cw: null, renoteId: null,
		fileIds: [], files: [], visibility: 'public', reactions: {}, reactionEmojis: {},
		repliesCount: 0, renoteCount: 0,
	};
}

const cleanups: (() => void)[] = [];

async function settle() {
	await Promise.resolve();
	await nextTick();
	await nextTick();
}

function mount(size: 'lg' | 'sm', instanceBadgePosition?: 'left' | 'right', remote = false, audience: { showAudienceIcons?: boolean; showLocalOnlyIcon?: boolean; note?: NoteFixture } = {}) {
	const parent = audience.note ?? { ...note('parent', 'author'), repliesCount: 2 };
	if (remote) parent.user = { ...parent.user, host: 'remote.example', instance: { name: 'Remote Garden' } };
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3Note, { note: parent as unknown as Misskey.entities.Note, size, instanceBadgePosition, showAudienceIcons: audience.showAudienceIcons, showLocalOnlyIcon: audience.showLocalOnlyIcon }) });
	app.component('MkA', { props: { to: String }, template: '<a :href="to"><slot /></a>' });
	app.component('MkAvatar', { props: ['user'], template: '<span :data-avatar-user="user.id" />' });
	app.component('MkUserName', { props: ['user'], template: '<span>{{ user.username }}</span>' });
	for (const name of ['MkTime', 'MkLoading']) {
		app.component(name, { template: '<span><slot /></span>' });
	}
	app.component('Mfm', { props: ['text', 'nyaize', 'emojiUrls'], template: '<span data-mfm :data-nyaize="String(nyaize)" :data-emoji-urls="JSON.stringify(emojiUrls)">{{ text }}</span>' });
	app.directive('user-preview', {});
	app.directive('tooltip', {});
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return target;
}

function button(root: Element, label: string) {
	const found = root.querySelector<HTMLButtonElement>(`button[title="${label}"]`);
	expect(found).not.toBeNull();
	return found!;
}

beforeEach(() => {
	vi.clearAllMocks();
	prefer.r.disableNyaize.value = false;
	mocks.api.mockImplementation((endpoint: string) => Promise.resolve(endpoint === 'notes/replies'
		? [{ ...note('reply-b', 'b'), reactions: { '👍': 1 } }, note('reply-a', 'a')]
		: undefined));
	mocks.apiWithDialog.mockResolvedValue(undefined);
	mocks.popupMenu.mockResolvedValue(undefined);
	mocks.menu.mockReturnValue({ menu: [], cleanup: vi.fn() });
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.unstubAllGlobals();
});

describe('Hk3Note role badges', () => {
	it.each(['lg', 'sm'] as const)('shows the author roles in the note and expanded reply (%s)', async size => {
		const parent = note('parent', 'author');
		parent.repliesCount = 1;
		parent.user.badgeRoles = [
			{ name: 'Author role', iconUrl: '/author-role.png', displayOrder: 0 },
			{ name: 'No image', iconUrl: null, displayOrder: 1 },
		];
		const reply = note('reply', 'reply-author');
		reply.user.badgeRoles = [{ name: 'Reply role', iconUrl: '/reply-role.png', displayOrder: 0 }];
		mocks.api.mockResolvedValue([reply]);
		const target = mount(size, undefined, false, { note: parent });
		button(target, 'Conversation').click();
		await settle();
		const parentBadges = target.querySelectorAll<HTMLImageElement>('[data-note-id="parent"] > article header img[alt]');
		expect([...parentBadges].map(img => [img.getAttribute('src'), img.alt])).toEqual([['/author-role.png', 'Author role']]);
		const replyBadges = target.querySelectorAll<HTMLImageElement>('[data-note-id="reply"] > article header img[alt]');
		expect([...replyBadges].map(img => [img.getAttribute('src'), img.alt])).toEqual([['/reply-role.png', 'Reply role']]);
	});

	it('shows the original author role on a pure renote', () => {
		const original = note('original', 'original-author');
		original.user.badgeRoles = [{ name: 'Original role', iconUrl: '/original-role.png', displayOrder: 0 }];
		const renote = { ...note('renote', 'renoter', null), renoteId: original.id, renote: original };
		renote.user.badgeRoles = [{ name: 'Renoter role', iconUrl: '/renoter-role.png', displayOrder: 0 }];
		const target = mount('lg', undefined, false, { note: renote });
		const badges = target.querySelectorAll<HTMLImageElement>('[data-note-id="renote"] > article header img[alt]');
		expect([...badges].map(img => [img.getAttribute('src'), img.alt])).toEqual([['/original-role.png', 'Original role']]);
	});

	it.each([undefined, [], [{ name: 'No image', iconUrl: null, displayOrder: 0 }]])('leaves no role element when badgeRoles is %j', badgeRoles => {
		const plain = note('plain');
		plain.user.badgeRoles = badgeRoles;
		const target = mount('sm', undefined, false, { note: plain });
		const header = target.querySelector('[data-note-id="plain"] > article header')!;
		expect(header.querySelector('img')).toBeNull();
		expect(header.children).toHaveLength(3);
	});
});

describe('Hk3Note quote previews', () => {
	it.each(['lg', 'sm'] as const)('links to the quoted note and shows its CW with its emoji map (%s)', size => {
		const original = { ...note('quoted', 'quoted-author', 'hidden body'), cw: 'CW :flower:', emojis: { flower: '/emoji/flower.png' } };
		const parent = { ...note('parent', 'author', 'my comment'), renoteId: original.id, renote: original };
		const target = mount(size, undefined, false, { note: parent });
		const preview = target.querySelector<HTMLAnchorElement>('a[href="/notes/quoted"]')!;
		expect(preview).not.toBeNull();
		expect(preview.textContent).toContain('CW :flower:');
		expect(preview.textContent).not.toContain('hidden body');
		expect(preview.querySelector('[data-mfm]')?.getAttribute('data-emoji-urls')).toBe(JSON.stringify(original.emojis));
		expect(preview.querySelector('svg')).not.toBeNull();
	});

	it.each(['lg', 'sm'] as const)('does not reveal a hidden quote and keeps the attachment fallback (%s)', size => {
		const hidden = { ...note('hidden', 'quoted-author', 'private body'), cw: 'private CW', isHidden: true };
		const parent = { ...note('parent', 'author', 'my comment'), renoteId: hidden.id, renote: hidden };
		const target = mount(size, undefined, false, { note: parent });
		const preview = target.querySelector<HTMLAnchorElement>('a[href="/notes/hidden"]')!;
		expect(preview.textContent).toContain('Private');
		expect(preview.textContent).not.toContain('private body');
		expect(preview.textContent).not.toContain('private CW');
		expect(preview.querySelector('[data-mfm]')).toBeNull();
		const attachment = { ...note('attachment', 'quoted-author', null) };
		const attachmentParent = { ...note('attachment-parent', 'author', 'my comment'), renoteId: attachment.id, renote: attachment };
		const attachmentTarget = mount(size, undefined, false, { note: attachmentParent });
		expect(attachmentTarget.querySelector('a[href="/notes/attachment"]')?.textContent).toContain('Attachments only');
	});
});

describe('Hk3Note reply previews', () => {
	it.each(['lg', 'sm'] as const)('links to the reply target and prioritizes its CW in %s', size => {
		const original = { ...note('reply-target', 'author', 'body should stay hidden'), cw: 'CW :flower:', emojis: { flower: '/emoji/flower.png' } };
		original.user.host = 'remote.example';
		const target = mount(size, undefined, false, { note: { ...note('reply'), replyId: original.id, reply: original } });
		const preview = target.querySelector<HTMLAnchorElement>('a[href="/notes/reply-target"]')!;
		expect(preview).not.toBeNull();
		expect(preview.textContent).toContain('Reply');
		expect(preview.textContent).toContain('author');
		expect(preview.textContent).toContain('@author@remote.example');
		expect(preview.textContent).toContain('CW :flower:');
		expect(preview.textContent).not.toContain('body should stay hidden');
		expect(preview.querySelector('[data-mfm]')?.getAttribute('data-emoji-urls')).toBe(JSON.stringify(original.emojis));
	});

	it('does not leak a hidden reply target', () => {
		const original = { ...note('hidden-target', 'author', 'private body'), cw: 'private CW', isHidden: true };
		const target = mount('sm', undefined, false, { note: { ...note('reply'), replyId: original.id, reply: original } });
		const preview = target.querySelector<HTMLAnchorElement>('a[href="/notes/hidden-target"]')!;
		expect(preview.textContent).toContain('Private');
		expect(preview.textContent).not.toContain('private body');
		expect(preview.textContent).not.toContain('private CW');
		expect(preview.querySelector('[data-mfm]')).toBeNull();
	});

	it('keeps a link and reply label when only replyId is available', () => {
		const target = mount('sm', undefined, false, { note: { ...note('reply'), replyId: 'missing-target' } });
		const preview = target.querySelector<HTMLAnchorElement>('a[href="/notes/missing-target"]')!;
		expect(preview).not.toBeNull();
		expect(preview.textContent).toContain('Reply');
		expect(preview.textContent).not.toContain('@');
	});
});

describe('Hk3Note expanded replies', () => {
	it('does not repeat the reply preview inside the expanded child', async () => {
		const parent = { ...note('parent', 'author'), repliesCount: 1 };
		mocks.api.mockResolvedValueOnce([{ ...note('child'), replyId: parent.id, reply: parent }]);
		const target = mount('sm', undefined, false, { note: parent });
		button(target, 'Conversation').click();
		await settle();
		expect(target.querySelector('[data-note-id="child"] a[href="/notes/parent"]')).toBeNull();
	});

	it.each([
		['lg', 'left'], ['sm', 'left'], ['sm', undefined],
	] as const)('keeps the server badge placement for notes and replies (%s, %s)', async (size, position) => {
		const remoteReply = note('remote-reply');
		remoteReply.user = { ...remoteReply.user, host: 'remote.example', instance: { name: 'Remote Garden' } };
		mocks.api.mockResolvedValue([remoteReply]);
		const target = mount(size, position, true);
		button(target, 'Conversation').click();
		await settle();
		const badges = [...target.querySelectorAll('[data-instance-badge]')];
		expect(badges).toHaveLength(2);
		for (const badge of badges) {
			expect(badge.getAttribute('data-position')).toBe(position ?? 'right');
			expect(badge.textContent).toBe('Remote Garden');
		}
	});

	it.each(['lg', 'sm'] as const)('targets each reply independently in %s', async size => {
		const target = mount(size);
		button(target, 'Conversation').click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('notes/replies', { noteId: 'parent', limit: 10 });
		for (const id of ['reply-a', 'reply-b']) {
			const child = target.querySelector<HTMLElement>(`[data-note-id="${id}"]`)!;
			expect(child).not.toBeNull();
			button(child, 'Reply').focus();
			await settle();
			button(child, 'Reply').click();
			expect(mocks.post.mock.lastCall?.[0].reply.id).toBe(id);
			button(child, 'More').click();
			expect(mocks.menu.mock.lastCall?.[0].note.id).toBe(id);
			await settle();
			button(child, 'React').click();
			expect(mocks.picker.mock.lastCall?.[1].id).toBe(id);
			await mocks.picker.mock.lastCall?.[2]('❤️');
			await settle();
			expect(mocks.apiWithDialog).toHaveBeenLastCalledWith('notes/reactions/create', { noteId: id, reaction: '❤️' }, undefined, undefined, { showSuccess: false });
		}
		const chip = target.querySelector<HTMLButtonElement>('[data-note-id="reply-b"] button[data-reaction="👍"]')!;
		chip.click();
		await settle();
		expect(mocks.apiWithDialog).toHaveBeenLastCalledWith('notes/reactions/create', { noteId: 'reply-b', reaction: '👍' }, undefined, undefined, { showSuccess: false });
		expect(mocks.apiWithDialog).toHaveBeenCalledTimes(3);
		expect(target.querySelector('a button')).toBeNull();
		expect(mocks.post.mock.calls.every(([options]) => options.reply.id !== 'parent')).toBe(true);
	});
});

describe('Hk3Note audience icons', () => {
	it.each(['lg', 'sm'] as const)('renders every scope and federation state under the main avatar (%s)', size => {
		for (const [visibility, label, icon] of [
			['public', 'Public', 'globe'], ['home', 'Home', 'house'],
			['followers', 'Followers', 'lock'], ['specified', 'Direct', 'mail'],
		] as const) {
			for (const localOnly of [false, true]) {
				const target = mount(size, undefined, false, {
					showAudienceIcons: true, note: { ...note('audience', 'author'), visibility, localOnly },
				});
				const row = target.querySelector('[data-audience-icons]')!;
				expect(row).not.toBeNull();
				expect(row.previousElementSibling?.getAttribute('data-avatar-user')).toBe('author');
				expect(row.querySelectorAll('[role="img"]')).toHaveLength(2);
				expect(row.textContent).toBe('');
				expect(row.querySelector('button, a, [tabindex]')).toBeNull();
				const federation = row.querySelector('[data-local-only]')!;
				const federationLabel = localOnly ? 'Local only (this server)' : 'Federated';
				expect(federation.getAttribute('title')).toBe(federationLabel);
				expect(federation.getAttribute('aria-label')).toBe(federationLabel);
				expect(federation.querySelector('svg[class*="lucide-rocket"]')).not.toBeNull();
				expect(federation.querySelector('line') !== null).toBe(localOnly);
				const scope = row.querySelector('[data-visibility]')!;
				expect(scope.getAttribute('data-visibility')).toBe(visibility);
				expect(scope.getAttribute('title')).toBe(label);
				expect(scope.getAttribute('aria-label')).toBe(label);
				expect(scope.querySelector(`svg[class*="lucide-${icon}"]`)).not.toBeNull();
				for (const svg of row.querySelectorAll('svg')) {
					expect(svg.getAttribute('width')).toBe('16');
					expect(svg.getAttribute('aria-hidden')).toBe('true');
				}
				expect(target.querySelector('header svg')).toBeNull();
			}
		}
	});

	it.each(['lg', 'sm'] as const)('shows only local-only marks while retaining scope headers (%s)', async size => {
		mocks.api.mockResolvedValue([
			{ ...note('local-reply', 'reply-author'), visibility: 'specified', localOnly: true },
			{ ...note('federated-reply'), localOnly: false },
		]);
		const target = mount(size, undefined, false, {
			showLocalOnlyIcon: true,
			note: { ...note('local-parent'), visibility: 'home', localOnly: true, repliesCount: 2 },
		});
		button(target, 'Conversation').click();
		await settle();
		const rows = [...target.querySelectorAll('[data-audience-icons]')];
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect(row.querySelectorAll('[role="img"]')).toHaveLength(1);
			expect(row.querySelector('[data-local-only="true"] line')).not.toBeNull();
			expect(row.querySelector('[data-visibility]')).toBeNull();
			expect(row.previousElementSibling?.hasAttribute('data-avatar-user')).toBe(true);
		}
		const child = target.querySelector('[data-note-id="local-reply"]')!;
		const replyRow = child.previousElementSibling!.querySelector('[data-audience-icons][data-tiny]')!;
		expect(replyRow).not.toBeNull();
		for (const svg of replyRow.querySelectorAll('svg')) expect(svg.getAttribute('width')).toBe('13');
		expect(child.querySelector('[data-audience-icons]')).toBeNull();
		expect(child.querySelector('header svg[class*="lucide-mail"]')).not.toBeNull();
		expect(target.querySelector('[data-note-id="local-parent"] > article header svg[class*="lucide-house"]')).not.toBeNull();
		expect(target.querySelector('header svg[class*="lucide-globe-lock"]')).toBeNull();
		const federatedChild = target.querySelector('[data-note-id="federated-reply"]')!;
		expect(federatedChild.previousElementSibling!.querySelector('[data-audience-icons]')).toBeNull();
	});

	it.each([false, true])('uses the original federation state for the local-only renote row (%s)', localOnly => {
		const original = { ...note('original', 'original-author'), visibility: 'followers' as const, localOnly };
		const renote = { ...note('renote', 'renoter', null), localOnly: !localOnly, renoteId: original.id, renote: original };
		const target = mount('lg', undefined, false, { showLocalOnlyIcon: true, note: renote });
		const row = target.querySelector('[data-audience-icons]');
		expect(row !== null).toBe(localOnly);
		if (row) expect(row.previousElementSibling?.getAttribute('data-avatar-user')).toBe('original-author');
		expect(target.querySelector('header svg[class*="lucide-lock"]')).not.toBeNull();
		expect(target.querySelector('header svg[class*="lucide-globe-lock"]')).toBeNull();
	});

	it('uses the original note and author for a pure renote', () => {
		const original = { ...note('original', 'original-author'), visibility: 'followers' as const, localOnly: true };
		const renote = { ...note('renote', 'renoter', null), renoteId: original.id, renote: original };
		const target = mount('lg', undefined, false, { showAudienceIcons: true, note: renote });
		const row = target.querySelector('[data-audience-icons]')!;
		expect(row.previousElementSibling?.getAttribute('data-avatar-user')).toBe('original-author');
		expect(row.querySelector('[data-visibility="followers"]')).not.toBeNull();
		expect(row.querySelector('[data-local-only="true"]')).not.toBeNull();
		expect(target.querySelector('header svg')).toBeNull();
	});

	it.each(['lg', 'sm'] as const)('keeps deck/default note headers without audience rows (%s)', async size => {
		const target = mount(size, undefined, false, {
			note: { ...note('default'), visibility: 'home', localOnly: true, repliesCount: 1 },
		});
		button(target, 'Conversation').click();
		await settle();
		expect(target.querySelector('[data-audience-icons]')).toBeNull();
		expect(target.querySelector('[data-note-id="default"] > article header')?.querySelectorAll('svg')).toHaveLength(2);
	});

	it.each(['lg', 'sm'] as const)('renders tiny reply icons by the external avatar and removes duplicate headers (%s)', async size => {
		mocks.api.mockResolvedValue([{ ...note('private-reply', 'reply-author'), visibility: 'specified', localOnly: true }]);
		const target = mount(size, undefined, false, { showAudienceIcons: true });
		button(target, 'Conversation').click();
		await settle();
		const child = target.querySelector('[data-note-id="private-reply"]')!;
		const avatarCol = child.previousElementSibling!;
		expect(avatarCol.querySelector('[data-avatar-user="reply-author"]')).not.toBeNull();
		const row = avatarCol.querySelector('[data-audience-icons][data-tiny]')!;
		expect(row).not.toBeNull();
		expect(row.querySelector('[data-visibility="specified"]')).not.toBeNull();
		expect(row.querySelector('[data-local-only="true"]')).not.toBeNull();
		for (const svg of row.querySelectorAll('svg')) expect(svg.getAttribute('width')).toBe('13');
		expect(child.querySelector('[data-audience-icons], header svg')).toBeNull();
		expect(target.querySelectorAll('[data-audience-icons]')).toHaveLength(2);
	});
});

describe('UI S text menu state', () => {
	it('shows escaped source beside MFM, closes it and reuses persistent menu refs', async () => {
		const raw = '<script>alert(1)</script> **source**';
		const target = mount('sm', undefined, false, { note: { ...note('source', 'author'), text: raw } });
		button(target, 'More').click();
		const first = mocks.menu.mock.lastCall![0];
		first.viewTextSource.value = true;
		first.noNyaize.value = true;
		await settle();
		const source = target.querySelector('[data-note-text-source]')!;
		expect(source.querySelector('pre')?.textContent).toBe(raw);
		expect(source.querySelector('script')).toBeNull();
		expect(source.closest('p')).toBeNull();
		expect(target.querySelector('[data-mfm]')?.textContent).toBe(raw);
		expect(target.querySelector('[data-mfm]')?.getAttribute('data-nyaize')).toBe('false');
		button(target, 'More').click();
		const second = mocks.menu.mock.lastCall![0];
		expect(second.viewTextSource).toBe(first.viewTextSource);
		expect(second.noNyaize).toBe(first.noNyaize);
		source.querySelector<HTMLButtonElement>('button')!.click();
		await settle();
		expect(target.querySelector('[data-note-text-source]')).toBeNull();
		expect(first.viewTextSource.value).toBe(false);
	});
	it('updates CW/body nyaize from menu and global preference without revealing a closed CW', async () => {
		const target = mount('lg', undefined, false, { note: { ...note('cw', 'author'), cw: 'CW text', text: 'private body' } });
		target.querySelector('[data-note-id="cw"]')!.dispatchEvent(new MouseEvent('mouseenter'));
		await settle();
		button(target, 'More').click();
		const state = mocks.menu.mock.lastCall![0];
		state.viewTextSource.value = true;
		state.noNyaize.value = true;
		await settle();
		expect(target.querySelector('[data-note-text-source]')).toBeNull();
		expect(target.querySelectorAll('[data-mfm]')).toHaveLength(1);
		expect(target.querySelector('[data-mfm]')?.getAttribute('data-nyaize')).toBe('false');
		button(target, 'Toggle content').click();
		await settle();
		expect(target.querySelectorAll('[data-mfm]')).toHaveLength(2);
		expect([...target.querySelectorAll('[data-mfm]')].every(element => element.getAttribute('data-nyaize') === 'false')).toBe(true);
		state.noNyaize.value = false;
		await settle();
		expect([...target.querySelectorAll('[data-mfm]')].every(element => element.getAttribute('data-nyaize') === 'respect')).toBe(true);
		prefer.r.disableNyaize.value = true;
		await settle();
		expect([...target.querySelectorAll('[data-mfm]')].every(element => element.getAttribute('data-nyaize') === 'false')).toBe(true);
		prefer.r.disableNyaize.value = false;
		await settle();
		expect([...target.querySelectorAll('[data-mfm]')].every(element => element.getAttribute('data-nyaize') === 'respect')).toBe(true);
	});
});
