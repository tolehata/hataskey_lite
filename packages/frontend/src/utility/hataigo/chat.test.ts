/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it, vi } from 'vitest';
import { ChatController, chatAllowed, parseChatMessage, parseChatPolicy } from './chat.js';
import type { ChatMessage, ChatTransport } from './chat.js';
import type { OnlineGame } from './online/types.js';

function game(patch: Partial<OnlineGame> = {}): OnlineGame { return { id: 'game', phase: 'playing', isParticipant: false, allowSpectate: true, publicAfterEnd: false, allowSpectatorChat: true, ...patch } as OnlineGame; }

function message(patch: Partial<ChatMessage> = {}): ChatMessage { return { id: 'message', gameId: 'game', userId: 'other', user: null, text: '<script>unsafe</script> @someone', createdAt: '2026-10-20T00:00:00Z', expiresAt: '2099-10-20T00:00:00Z', deleted: false, ...patch }; }

function fixture() {
	let current = true;
	let events: Parameters<ChatTransport['watch']>[1] | undefined;
	const dispose = vi.fn();
	const api = { capability: vi.fn(async () => ({ enabled: true, retentionDays: 7, disclosureVersion: 'v1' })), messages: vi.fn(async () => [message()]), post: vi.fn(async () => message({ id: 'sent', userId: 'me' })), remove: vi.fn(async () => {}), report: vi.fn(async (_userId: string, _comment: string) => {}) };
	const transport: ChatTransport = { ...api, viewerId: 'me', current: () => current, watch: (_id, value) => { events = value; return dispose; } };
	return { transport, api, dispose, invalidate: () => { current = false; }, get events() { if (!events) throw new Error('No subscription'); return events; } };
}

describe('gated shared spectator chat', () => {
	it('never reads, subscribes, posts, reports, or deletes while policy is disabled', async () => {
		const f = fixture();
		f.api.capability.mockResolvedValue({ enabled: false, retentionDays: 7, disclosureVersion: 'v1' });
		const chat = new ChatController(f.transport);
		await chat.update(game(), true);
		chat.draft = 'text';
		expect(await chat.post()).toBe(false);
		expect(await chat.report('message', 'https://example.test')).toBe(false);
		expect(await chat.remove('message', 'abuse')).toBe(false);
		expect(f.api.messages).not.toHaveBeenCalled();
		expect(f.api.post).not.toHaveBeenCalled();
		expect(f.api.report).not.toHaveBeenCalled();
		expect(f.api.remove).not.toHaveBeenCalled();
		expect(f.dispose).not.toHaveBeenCalled();
	});
	it('does not create a private participant chat bypass', async () => {
		const f = fixture();
		const chat = new ChatController(f.transport);
		await chat.update(game({ isParticipant: true, allowSpectate: false }), true);
		expect(chat.allowed).toBe(false);
		expect(f.api.capability).toHaveBeenCalledTimes(1);
		expect(f.api.messages).not.toHaveBeenCalled();
		expect(chatAllowed(game({ phase: 'ended', publicAfterEnd: false }))).toBe(false);
		expect(chatAllowed(game({ phase: 'ended', publicAfterEnd: true }))).toBe(true);
	});
	it('starts the room if capability changes from disabled to enabled without changing games', async () => {
		const f = fixture();
		f.api.capability.mockResolvedValueOnce({ enabled: false, retentionDays: 7, disclosureVersion: 'v1' });
		const chat = new ChatController(f.transport);
		await chat.update(game(), true);
		expect(f.api.messages).not.toHaveBeenCalled();
		await chat.update(game({ revision: 2 }), true);
		expect(f.api.messages).toHaveBeenCalledTimes(1);
		expect(chat.enabled).toBe(true);
		f.api.capability.mockResolvedValueOnce({ enabled: false, retentionDays: 7, disclosureVersion: 'v1' });
		await chat.update(game({ revision: 3 }), true);
		expect(chat.messages).toEqual([]);
		expect(chat.enabled).toBe(false);
	});
	it('hides from playing participants by default and shows the public room after the end', async () => {
		const f = fixture();
		const chat = new ChatController(f.transport);
		await chat.update(game({ isParticipant: true }), true);
		expect(f.api.messages).not.toHaveBeenCalled();
		await chat.toggle();
		expect(f.api.messages).toHaveBeenCalledTimes(1);
		await chat.update(game({ phase: 'ended', isParticipant: true, publicAfterEnd: true }), true);
		expect(chat.visible).toBe(true);
		expect(f.api.messages).toHaveBeenCalledTimes(2);
	});
	it('preserves a failed post draft but clears it and messages on hide', async () => {
		const f = fixture();
		const chat = new ChatController(f.transport);
		await chat.update(game(), true);
		chat.draft = 'keep this';
		f.api.post.mockRejectedValueOnce(new Error('NETWORK'));
		expect(await chat.post()).toBe(false);
		expect(chat.draft).toBe('keep this');
		await chat.update(game({ revision: 2 }), true);
		expect(chat.draft).toBe('keep this');
		await chat.toggle();
		expect(chat.messages).toEqual([]);
		expect(chat.draft).toBe('');
		expect(f.dispose).toHaveBeenCalledTimes(1);
	});
	it('clears retained content on disconnect, revocation, and account switch', async () => {
		const f = fixture();
		const chat = new ChatController(f.transport);
		await chat.update(game(), true);
		chat.draft = 'private draft';
		f.events.disconnected();
		expect(chat.messages).toEqual([]);
		expect(chat.draft).toBe('');
		await chat.update(game(), true);
		f.events.revoked();
		expect(chat.messages).toEqual([]);
		expect(chat.enabled).toBe(false);
		await chat.update(game(), true);
		f.invalidate();
		chat.purge();
		expect(chat.messages).toEqual([]);
		expect(chat.policy).toBeNull();
	});
	it('does not accept an in-flight message page after hiding', async () => {
		const f = fixture();
		let resolve: (rows: ChatMessage[]) => void = () => {};
		f.api.messages.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const chat = new ChatController(f.transport);
		const pending = chat.update(game(), true);
		await Promise.resolve();
		chat.deactivate();
		resolve([message()]);
		await pending;
		expect(chat.messages).toEqual([]);
	});
	it('keeps deletion tombstones against late stale message frames and removes expired content', async () => {
		const f = fixture();
		let now = Date.parse('2026-10-20T00:00:00Z');
		const chat = new ChatController(f.transport, () => {}, () => now);
		await chat.update(game(), true);
		f.events.message(message({ deleted: true, text: null }));
		f.events.message(message());
		expect(chat.messages[0].text).toBeNull();
		now = Date.parse('2100-01-01');
		chat.purge();
		expect(chat.messages).toEqual([]);
	});
	it('uses the existing report endpoint payload including exact text, time and game link', async () => {
		const f = fixture();
		const chat = new ChatController(f.transport);
		await chat.update(game(), true);
		expect(f.api.report).not.toHaveBeenCalled();
		await chat.report('message', 'https://example.test');
		expect(f.api.report).toHaveBeenCalledExactlyOnceWith('other', expect.stringContaining('https://example.test/hataigo/game'));
		const comment = f.api.report.mock.calls.at(0)?.[1];
		expect(comment).toContain(message().text);
		expect(comment).toContain(message().createdAt);
	});
	it('rejects malformed data and normalizes deleted content before rendering', () => {
		expect(parseChatPolicy({ enabled: false, retentionDays: null, disclosureVersion: null }).enabled).toBe(false);
		expect(() => parseChatPolicy({ enabled: true, retentionDays: null, disclosureVersion: null })).toThrow();
		expect(() => parseChatMessage({ ...message(), text: 'x'.repeat(501) })).toThrow();
		expect(parseChatMessage(message({ deleted: true })).text).toBeNull();
	});
});
