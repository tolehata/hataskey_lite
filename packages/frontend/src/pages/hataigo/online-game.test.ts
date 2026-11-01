/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable vue/one-component-per-file -- Independent child component mocks and a KeepAlive host test the page boundary. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, ref } from 'vue';
import OnlineGame from './online-game.vue';
import Lobby from './lobby.vue';
import type { OnlineClient } from '@/utility/hataigo/online/controller.js';
import type { OnlineGame as Game } from '@/utility/hataigo/online/types.js';
import { createGame } from '@/utility/hataigo/rules/game.js';
import { onlineText } from '@/utility/hataigo/online-text.js';

const fixture = vi.hoisted(() => ({ client: null as unknown as OnlineClient, dispose: vi.fn() }));
vi.mock('@/components/hataigo/HataigoChat.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/hataigo/online/client.js', () => ({ createOnlineClient: () => fixture.client }));
vi.mock('@/utility/hataigo/prefs.js', () => ({ useHataigoPrefs: () => ({ prefs: { theme: 'fuji', stones: 'real', labels: true } }) }));
vi.mock('@/os.js', () => ({ selectUser: vi.fn() }));
vi.mock('@/components/hataigo/HataigoBoard.vue', async () => {
	const { defineComponent, h: renderElement } = await import('vue');
	return { default: defineComponent({ inheritAttrs: false, props: { interactive: { type: Boolean, default: false } }, emits: ['place', 'select'], setup(props, { emit }) { return () => renderElement('button', { 'data-board': '', 'data-interactive': String(props.interactive), onClick: () => emit('place', 0, 0) }, 'board'); } }) };
});
vi.mock('@/components/global/MkEmoji.vue', async () => {
	const { defineComponent, h: renderElement } = await import('vue');
	return { default: defineComponent({ props: { emoji: { type: String, required: true } }, setup(props) { return () => renderElement('span', { 'data-emoji': props.emoji, onClick: (event: MouseEvent) => event.stopPropagation() }, props.emoji); } }) };
});

function game(participant = true): Game {
	const vote = { allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false };
	const announcement = { enabled: false, visibility: 'home' as const, allowName: false };
	return { id: 'g', createdAt: '2026-10-20', startedAt: null, endedAt: null, user1Id: participant ? 'me' : 'other', user2Id: 'opponent', user1: null, user2: null, black: 1, phase: 'playing', settings: { size: 9, handicap: 0, komi: 6.5, rules: 'japanese', clock: { kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 } }, user1Ready: false, user2Ready: false, isInvitation: false, invitationAccepted: true, revision: 1, ...vote, visibility: participant ? { user1: vote, user2: vote } : null, announcements: participant ? { user1: announcement, user2: announcement } : null, state: createGame({ size: 9 }), clock: null, serverNowMs: 100000, myColor: participant ? 'black' : null, isParticipant: participant };
}

const cleanup: (() => void)[] = [];
beforeEach(() => {
	fixture.dispose.mockReset();
	fixture.client = { viewerId: 'me', isCurrent: () => true, connected: () => true, watchGame: () => fixture.dispose, watchLobby: () => fixture.dispose, react: vi.fn(async () => {}), api: { show: vi.fn(async () => game()), games: vi.fn(async () => []), invitations: vi.fn(async () => []), match: vi.fn(async () => null), invite: vi.fn(async () => game()), cancelMatch: vi.fn(async () => {}), respond: vi.fn(async () => game()), settings: vi.fn(async () => game()), ready: vi.fn(async () => game()), action: vi.fn(async () => {}), cancelGame: vi.fn(async () => game()), verify: vi.fn(async () => ({ desynced: false })), claimTimeout: vi.fn(async () => game()) } };
});
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));

async function flush(): Promise<void> { for (let i = 0; i < 10; i++) await Promise.resolve(); await nextTick(); }

function button(target: HTMLElement, label: string): HTMLButtonElement { const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(value => value.textContent.trim() === label); if (found === undefined) throw new Error(`Missing ${label}`); return found; }

async function mount(summary = false) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const visible = ref(true);
	const app = createApp({ render: () => h(KeepAlive, null, { default: () => visible.value ? summary ? h(Lobby, { summaryOnly: true }) : h(OnlineGame, { gameId: 'g' }) : h('div') }) });
	app.mount(target);
	cleanup.push(() => { app.unmount(); target.remove(); });
	await flush();
	return { target, visible };
}

describe('online page behavior', () => {
	it('cannot send a spectator move even if a board event is forged', async () => {
		vi.mocked(fixture.client.api.show).mockResolvedValue(game(false));
		const { target } = await mount();
		expect(target.querySelector('[data-board]')?.getAttribute('data-interactive')).toBe('false');
		(target.querySelector('[data-board]') as HTMLButtonElement).click();
		await flush();
		expect(fixture.client.api.action).not.toHaveBeenCalled();
		expect(target.textContent).toContain(onlineText.readOnly);
	});

	it('sends resignation only after explicit confirmation', async () => {
		const { target } = await mount();
		button(target, onlineText.resign).click();
		await nextTick();
		expect(fixture.client.api.action).not.toHaveBeenCalled();
		button(target, onlineText.confirmResign).click();
		await flush();
		expect(fixture.client.api.action).toHaveBeenCalledExactlyOnceWith('g', { type: 'resign' }, 1);
	});

	it('disposes the game subscription while cached and fetches a fresh position on return', async () => {
		const { visible } = await mount();
		expect(fixture.client.api.show).toHaveBeenCalledTimes(1);
		visible.value = false;
		await flush();
		expect(fixture.dispose).toHaveBeenCalledTimes(1);
		visible.value = true;
		await flush();
		expect(fixture.client.api.show).toHaveBeenCalledTimes(2);
	});

	it('never auto-accepts a scoring draft when opened', async () => {
		const value = game();
		if (value.state === null) throw new Error('Missing fixture state');
		value.phase = 'scoring';
		value.state = { ...value.state, phase: 'scoring' };
		vi.mocked(fixture.client.api.show).mockResolvedValue(value);
		const { target } = await mount();
		expect(target.textContent).toContain(onlineText.scoringTitle);
		expect(fixture.client.api.action).not.toHaveBeenCalled();
		button(target, onlineText.acceptScore).click();
		await flush();
		expect(fixture.client.api.action).toHaveBeenCalledExactlyOnceWith('g', { type: 'acceptScore' }, 1);
	});

	it('sends a fixed reaction when the rendered emoji stops click bubbling', async () => {
		const { target } = await mount();
		const glyphs = [...target.querySelectorAll<HTMLElement>('button [data-emoji]')];
		expect(glyphs.map(glyph => glyph.getAttribute('data-emoji'))).toEqual(['👏', '😮', '🤔', '😂', '🔥', '🙏']);
		glyphs[0].click();
		await flush();
		expect(fixture.client.react).toHaveBeenCalledExactlyOnceWith('g', '👏');
	});

	it('shows an anonymized withdrawal end without offering actions or inventing a winner', async () => {
		const ended = game();
		ended.phase = 'ended';
		ended.user2Id = null;
		ended.user1 = { id: 'me', username: 'remaining-player', name: '残る対局者', avatarUrl: null };
		vi.mocked(fixture.client.api.show).mockResolvedValue(ended);
		const { target } = await mount();
		expect(target.textContent).toContain(onlineText.deletedUser);
		expect(target.textContent).toContain(onlineText.withdrawalEnded);
		expect(target.textContent).not.toContain(onlineText.opponentTurn);
		expect([...target.querySelectorAll('button')].some(value => value.textContent.trim() === onlineText.pass || value.textContent.trim() === onlineText.resign)).toBe(false);
		expect(target.querySelector('[data-board]')?.getAttribute('data-interactive')).toBe('false');
	});

	it('home summary shows ongoing games, no empty invitation box, and no queue or public controls', async () => {
		const { target } = await mount(true);
		expect(target.textContent).toContain(onlineText.ongoing);
		// 招待は届いているときだけ出す（空の「届いた招待」の箱は出さない）
		expect(target.textContent).not.toContain(onlineText.noInvitations);
		expect(target.textContent).not.toContain(onlineText.publicGames);
		expect([...target.querySelectorAll('button')].some(value => value.textContent.trim() === onlineText.match)).toBe(false);
		expect(fixture.client.api.match).not.toHaveBeenCalled();
	});

	it('free match sends the any-size choice only when the switch is on', async () => {
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ render: () => h(Lobby) });
		app.mount(target);
		cleanup.push(() => { app.unmount(); target.remove(); });
		await flush();
		const go = () => [...target.querySelectorAll('button')].find(value => value.textContent.trim() === onlineText.findOpponent);
		go()?.click();
		await flush();
		expect(fixture.client.api.match).toHaveBeenLastCalledWith(expect.objectContaining({ size: 19, anySize: false }));
		[...target.querySelectorAll('button')].find(value => value.textContent.trim() === onlineText.cancel)?.click();
		await flush();
		const anySize = [...target.querySelectorAll('label')].find(label => label.textContent.includes(onlineText.anySize))?.querySelector('input');
		if (!anySize) throw new Error('any-size switch not rendered');
		anySize.click();
		await flush();
		go()?.click();
		await flush();
		expect(fixture.client.api.match).toHaveBeenLastCalledWith(expect.objectContaining({ size: 19, anySize: true }));
	});

	it('shows a received invitation with accept and decline', async () => {
		vi.mocked(fixture.client.api.invitations).mockResolvedValue([{ ...game(), user1Id: 'opponent', user2Id: 'me', phase: 'waiting', state: null, isInvitation: true, invitationAccepted: false }]);
		const { target } = await mount(true);
		expect(target.textContent).toContain(onlineText.invitations);
		expect([...target.querySelectorAll('button')].map(value => value.textContent.trim())).toEqual(expect.arrayContaining([onlineText.accept, onlineText.decline]));
	});
});
