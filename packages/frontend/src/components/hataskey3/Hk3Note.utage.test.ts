/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import Hk3Note from './Hk3Note.vue';
import { useNoteCapture } from '@/composables/use-note-capture.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import type * as Misskey from 'cherrypick-js';
import type { UtageSnapshot } from '@/utility/utage.js';

vi.mock('@/os.js', () => ({}));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	_hata: { _hataskeyUi3: {}, _utage: { success: '宴成功', failed: '宴失敗' } },
} } }));
vi.mock('@/custom-emojis.js', () => ({ customEmojisMap: new Map() }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: { animation: false }, r: { disableNyaize: ref(false), 'postFormVisibilityBorder.enabled': ref(false) } } };
});
vi.mock('@/utility/check-word-mute.js', () => ({ checkWordMute: () => false }));
vi.mock('@/composables/use-note-capture.js', async () => {
	const { reactive } = await import('vue');
	const { pickUtage } = await import('@/utility/utage.js');
	return {
		noteEvents: { emit: vi.fn() },
		useNoteCapture: vi.fn(({ note }: { note: Misskey.entities.Note }) => ({
			$note: reactive({ ...pickUtage(note), reactions: {}, reactionEmojis: {}, myReaction: null, pollChoices: [] }),
			subscribe: vi.fn(),
		})),
	};
});
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: vi.fn() } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/get-note-menu.js', () => ({ getNoteMenu: vi.fn(), getRenoteMenu: vi.fn(), getCopyNoteLinkMenu: vi.fn(), getAbuseNoteMenu: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@@/js/note.js', () => ({ notePage: () => '/notes/note' }));
vi.mock('@/filters/user.js', () => ({ userPage: () => '/users/author' }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkPoll.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionsViewer.reaction.vue', () => ({ default: { render: () => null } }));
vi.mock('./use-hk3-reactions.js', async () => {
	const { computed } = await import('vue');
	return { useHk3Reactions: (_id: string, source: () => Record<string, number>) => computed(source) };
});
vi.mock('./Hk3ConfirmBubble.vue', () => ({ default: { render: () => null } }));
vi.mock('./Hk3InstanceBadge.vue', () => ({ default: { render: () => null } }));
// 共有コンポーネントの文言や人数アニメーションは別testで検証。ここでは親が渡す状態・人数を観測する。
vi.mock('@/components/MkUtageStatus.vue', () => ({ default: {
	props: ['note'],
	template: '<div data-utage-status-line :data-state="note.utageStatus" :data-count="note.utageRevival.reactionCount" :data-target="note.utageRevival.targetCount" />',
} }));

const START = Date.parse('2026-09-26T06:00:00Z');
const SIX_HOURS = 6 * 60 * 60 * 1000;
const iso = (time: number) => new Date(time).toISOString();
const results = ['succeeded', 'failed'] as const;
const sizes = ['lg', 'sm'] as const;
const revival = () => ({ startedAt: iso(START), expiresAt: iso(START + 90 * 1000), targetCount: 6, reactionCount: 2 });
const displays = [
	{ utageStatus: 'succeeded' }, { utageStatus: 'failed' },
	{ utageStatus: 'succeeded', utageRevival: revival() }, { utageStatus: 'failed', utageRevival: revival() },
	{ utageStatus: 'running' }, { utageStatus: 'reviving', utageRevival: revival() },
] satisfies UtageSnapshot[];
const cleanups: (() => void)[] = [];

function note(snapshot: UtageSnapshot = {}): Misskey.entities.Note {
	return {
		id: 'note', userId: 'author', user: { id: 'author', username: 'author', host: null },
		createdAt: iso(START - 20 * 60 * 1000), text: '宴', cw: null, renoteId: null,
		fileIds: [], files: [], visibility: 'public', reactions: {}, reactionEmojis: {},
		repliesCount: 0, renoteCount: 0, utageRevival: null, ...snapshot,
	} as unknown as Misskey.entities.Note;
}

function mount(source: Misskey.entities.Note, size: 'lg' | 'sm' = 'lg', local = true, social = false) {
	const inLocal = ref(local);
	const inSocial = ref(social);
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(Hk3Note, { note: source, size, inLocal: inLocal.value, inSocial: inSocial.value }) });
	app.component('MkA', { template: '<a><slot /></a>' });
	for (const name of ['MkAvatar', 'MkUserName', 'MkTime', 'Mfm', 'MkLoading']) app.component(name, { template: '<span />' });
	app.directive('user-preview', {});
	app.directive('tooltip', {});
	app.mount(host);
	const captured = vi.mocked(useNoteCapture).mock.results.at(-1)!.value.$note;
	let mounted = true;
	const unmount = () => {
		if (!mounted) return;
		mounted = false;
		app.unmount();
		host.remove();
	};
	cleanups.push(unmount);
	return { host, captured, inLocal, inSocial, unmount };
}

function expectPlain(host: Element) {
	expect(host.querySelector('[data-utage-result], [data-utage-status-line], [data-utage="true"]')).toBeNull();
}

function expectDisplay(host: Element, snapshot: UtageSnapshot) {
	if (snapshot.utageRevival != null) {
		expect(host.querySelector('[data-utage-status-line]')?.getAttribute('data-state')).toBe(snapshot.utageStatus);
	} else if (snapshot.utageStatus === 'running') {
		expect(host.querySelector('[data-utage="true"]')).not.toBeNull();
	} else {
		expect(host.querySelector('[data-utage-result]')?.getAttribute('data-utage-result')).toBe(snapshot.utageStatus);
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(START);
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe.each(sizes)('Hk3Note utage (%s)', size => {
	it.each(results)('renders a fresh normal %s result below the body on mount', status => {
		const { host } = mount(note({ utageStatus: status }), size);
		const badge = host.querySelector('[data-utage-result]')!;
		expect(badge.getAttribute('data-utage-result')).toBe(status);
		expect(badge.textContent?.trim()).toBe(status === 'succeeded' ? '宴成功' : '宴失敗');
		expect(badge.previousElementSibling?.querySelector('p')).toBeTruthy();
		expect(badge.querySelector('svg')?.getAttribute('width')).toBe('14');
		expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		expect(host.querySelector('[data-utage-status-line], [data-utage="true"]')).toBeNull();
	});

	it.each(results)('reactively replaces running with normal %s without changing the source note', async status => {
		const source = note({ utageStatus: 'running', utageExpiresAt: iso(START + 1000) });
		const { host, captured } = mount(source, size);
		expect(host.querySelector('[data-utage="true"]')).not.toBeNull();
		expect(host.querySelector('[data-utage-result], [data-utage-status-line]')).toBeNull();
		expect(vi.getTimerCount()).toBe(2);
		captured.utageStatus = status;
		await nextTick();
		expect(source.utageStatus).toBe('running');
		expect(host.querySelector('[data-utage-result]')?.getAttribute('data-utage-result')).toBe(status);
		expect(host.querySelector('[data-utage="true"], [data-utage-status-line]')).toBeNull();
		expect(vi.getTimerCount()).toBe(1);
	});

	it.each(['reviving', ...results] as const)('passes revival %s and counts to the shared component without a normal badge', status => {
		const { host } = mount(note({ utageStatus: status, utageRevival: revival() }), size);
		const line = host.querySelector('[data-utage-status-line]')!;
		expect(line.getAttribute('data-state')).toBe(status);
		expect(line.getAttribute('data-count')).toBe('2');
		expect(line.getAttribute('data-target')).toBe('6');
		expect(host.querySelectorAll('[data-utage-status-line]')).toHaveLength(1);
		expect(host.querySelector('[data-utage-result]')).toBeNull();
	});
});

describe('Hk3Note utage reactive state and display window', () => {
	it.each(results)('does not mistake running with a revival record for failure, then follows revival → %s', async status => {
		const source = note({ utageStatus: 'running', utageExpiresAt: iso(START - 1000), utageRevival: revival() });
		const { host, captured } = mount(source);
		expect(host.querySelector('[data-utage-result], [data-utage-status-line]')).toBeNull();
		captured.utageStatus = 'reviving';
		await nextTick();
		expect(host.querySelector('[data-utage-status-line]')?.getAttribute('data-state')).toBe('reviving');
		// 復活ゲージは通常宴の古いexpiryではなく復活のexpiryを使う。
		const bar = host.querySelector('rect[stroke-dasharray]')!;
		expect(Number(bar.getAttribute('stroke-dasharray')!.split(' ')[0])).toBe(100);
		await vi.advanceTimersByTimeAsync(30 * 1000);
		await nextTick();
		expect(Number(bar.getAttribute('stroke-dasharray')!.split(' ')[0])).toBeCloseTo(200 / 3);
		captured.utageRevival = { ...revival(), reactionCount: 6 };
		captured.utageStatus = status;
		await nextTick();
		expect(source.utageStatus).toBe('running');
		expect(host.querySelector('[data-utage-status-line]')?.getAttribute('data-state')).toBe(status);
		expect(host.querySelector('[data-utage-status-line]')?.getAttribute('data-count')).toBe('6');
		expect(host.querySelector('[data-utage-result], [data-utage="true"]')).toBeNull();
		expect(vi.getTimerCount()).toBe(1);
	});

	it.each(displays)('suppresses every display outside LTL, on remote notes, and at/after six hours: %j', snapshot => {
		const source = note(snapshot);
		expectPlain(mount(source, 'lg', false).host);
		expectPlain(mount({ ...source, user: { ...source.user, host: 'remote.example' } }).host);
		for (const age of [SIX_HOURS, SIX_HOURS + 1]) {
			expectPlain(mount({ ...source, createdAt: iso(START - age) }).host);
		}
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(displays)('removes the display precisely at the six-hour boundary and releases timers: %j', async snapshot => {
		const { host } = mount({ ...note(snapshot), createdAt: iso(START - SIX_HOURS + 250) });
		expect(host.querySelector('[data-utage-result], [data-utage-status-line], [data-utage="true"]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(249);
		await nextTick();
		expect(host.querySelector('[data-utage-result], [data-utage-status-line], [data-utage="true"]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(1);
		await nextTick();
		expectPlain(host);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['LTL switch', 'new status'] as const)('refreshes a stale clock on %s, including when the window already expired', async trigger => {
		for (const elapsed of [500, 1500]) {
			vi.setSystemTime(START);
			const source = { ...note({ utageStatus: trigger === 'LTL switch' ? 'succeeded' : undefined }), createdAt: iso(START - SIX_HOURS + 1000) };
			const target = mount(source, 'lg', trigger !== 'LTL switch');
			expect(vi.getTimerCount()).toBe(0);
			await vi.advanceTimersByTimeAsync(elapsed);
			if (trigger === 'LTL switch') target.inLocal.value = true;
			else target.captured.utageStatus = 'succeeded';
			await nextTick();
			if (elapsed < 1000) {
				expect(target.host.querySelector('[data-utage-result]')).not.toBeNull();
				expect(vi.getTimerCount()).toBe(1);
				await vi.advanceTimersByTimeAsync(1000 - elapsed);
				await nextTick();
			}
			expectPlain(target.host);
			expect(vi.getTimerCount()).toBe(0);
		}
	});

	it.each(displays)('cleans up on leaving LTL, reentry, status removal, and unmount: %j', async snapshot => {
		const target = mount(note(snapshot));
		const timers = snapshot.utageStatus === 'running' || snapshot.utageStatus === 'reviving' ? 2 : 1;
		expect(vi.getTimerCount()).toBe(timers);
		target.inLocal.value = false;
		await nextTick();
		expectPlain(target.host);
		expect(vi.getTimerCount()).toBe(0);
		target.inLocal.value = true;
		await nextTick();
		expect(vi.getTimerCount()).toBe(timers);
		target.captured.utageStatus = undefined;
		await nextTick();
		expectPlain(target.host);
		expect(vi.getTimerCount()).toBe(0);
		target.captured.utageStatus = snapshot.utageStatus;
		await nextTick();
		expect(vi.getTimerCount()).toBe(timers);
		target.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe.each(sizes)('Hk3Note utage on local and social timelines (%s)', size => {
	it.each(displays)('shows each local-author state in both timelines: %j', snapshot => {
		for (const [local, social] of [[true, false], [false, true]] as const) {
			const target = mount(note(snapshot), size, local, social);
			expectDisplay(target.host, snapshot);
			target.unmount();
		}
	});

	it.each(displays)('never shows a nonlocal or malformed author host: %j', snapshot => {
		for (const hostValue of ['remote.example', undefined, '']) {
			const source = note(snapshot);
			const user = { ...source.user, host: hostValue } as Misskey.entities.Note['user'];
			for (const [local, social] of [[true, false], [false, true]] as const) {
				const target = mount({ ...source, user, localOnly: true }, size, local, social);
				expectPlain(target.host);
				expect(vi.getTimerCount()).toBe(0);
				target.unmount();
			}
		}
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('Hk3Note social utage ownership and lifetime', () => {
	it.each([false, true])('uses the original author of a pure renote (original local: %s)', originalLocal => {
		const original = note({ utageStatus: 'succeeded' });
		original.id = 'original';
		original.user = { ...original.user, host: originalLocal ? null : 'remote.example' };
		const wrapper = {
			...note({ utageStatus: 'failed' }), id: 'wrapper', text: null,
			renoteId: original.id, renote: original,
			user: { ...original.user, host: originalLocal ? 'remote.example' : null },
		} as Misskey.entities.Note;
		const target = mount(wrapper, 'lg', false, true);
		if (originalLocal) {
			expect(target.host.querySelector('[data-utage-result]')?.getAttribute('data-utage-result')).toBe('succeeded');
		} else {
			expectPlain(target.host);
		}
	});

	it.each([false, true])('uses the quote author instead of the quoted author (quote local: %s)', quoteLocal => {
		const quoted = note({ utageStatus: quoteLocal ? 'failed' : 'succeeded' });
		quoted.id = 'quoted';
		quoted.user = { ...quoted.user, host: quoteLocal ? 'remote.example' : null };
		const quote = {
			...note({ utageStatus: 'succeeded' }), id: 'quote', text: '宴の引用文',
			renoteId: quoted.id, renote: quoted,
			user: { ...quoted.user, host: quoteLocal ? null : 'remote.example' },
		} as Misskey.entities.Note;
		const target = mount(quote, 'lg', false, true);
		if (quoteLocal) {
			expect(target.host.querySelector('[data-utage-result]')?.getAttribute('data-utage-result')).toBe('succeeded');
		} else {
			expectPlain(target.host);
		}
	});

	it('checks each expanded social reply by its own author', async () => {
		const parent = { ...note({ utageStatus: 'running' }), id: 'parent', repliesCount: 2 };
		const localReply = { ...note({ utageStatus: 'succeeded' }), id: 'local-reply' };
		const remoteReply = {
			...note({ utageStatus: 'failed' }), id: 'remote-reply', localOnly: true,
			user: { ...parent.user, id: 'remote-author', host: 'remote.example' },
		};
		vi.mocked(misskeyApi).mockResolvedValue([localReply, remoteReply] as never);
		const target = mount(parent, 'lg', false, true);
		const conversationButton = target.host.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
		expect(conversationButton).not.toBeNull();
		conversationButton!.click();
		await Promise.resolve();
		await nextTick();
		await nextTick();
		expect(target.host.querySelector('[data-note-id="local-reply"] [data-utage-result]')?.getAttribute('data-utage-result')).toBe('succeeded');
		expectPlain(target.host.querySelector('[data-note-id="remote-reply"]')!);
	});

	it('reacts to a social status update and expires exactly at six hours', async () => {
		const source = { ...note({ utageStatus: 'running', utageExpiresAt: iso(START + 1000) }), createdAt: iso(START - SIX_HOURS + 250) };
		const target = mount(source, 'sm', false, true);
		expect(target.host.querySelector('[data-utage="true"]')).not.toBeNull();
		expect(vi.getTimerCount()).toBe(2);
		target.captured.utageStatus = 'succeeded';
		await nextTick();
		expect(target.host.querySelector('[data-utage-result]')?.getAttribute('data-utage-result')).toBe('succeeded');
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(249);
		await nextTick();
		expect(target.host.querySelector('[data-utage-result]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(1);
		await nextTick();
		expectPlain(target.host);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('releases social timers on exit, reentry, status removal and unmount', async () => {
		const target = mount(note({ utageStatus: 'running' }), 'lg', false, true);
		expect(vi.getTimerCount()).toBe(2);
		target.inSocial.value = false;
		await nextTick();
		expectPlain(target.host);
		expect(vi.getTimerCount()).toBe(0);
		target.inSocial.value = true;
		await nextTick();
		expect(vi.getTimerCount()).toBe(2);
		target.captured.utageStatus = undefined;
		await nextTick();
		expectPlain(target.host);
		expect(vi.getTimerCount()).toBe(0);
		target.captured.utageStatus = 'running';
		await nextTick();
		expect(vi.getTimerCount()).toBe(2);
		target.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
