/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HataigoChat from './HataigoChat.vue';
import type { ChatTransport } from '@/utility/hataigo/chat.js';
import type { OnlineGame } from '@/utility/hataigo/online/types.js';
import { chatText } from '@/utility/hataigo/chat.js';
const fixture = vi.hoisted(() => ({ transport: null as unknown as ChatTransport }));
vi.mock('@/utility/hataigo/chat-client.js', () => ({ createChatTransport: () => fixture.transport }));
vi.mock('@/i.js', () => ({ $i: { id: 'me', token: 'token', isAdmin: false, isModerator: false } }));
const cleanup: (() => void)[] = [];
beforeEach(() => { fixture.transport = { viewerId: 'me', current: () => true, capability: vi.fn(async () => ({ enabled: false, retentionDays: null, disclosureVersion: null })), messages: vi.fn(async () => [{ id: 'm', gameId: 'g', userId: 'other', user: null, text: '<script>alert(1)</script>', createdAt: '2026-10-20T00:00:00Z', expiresAt: '2099-10-20T00:00:00Z', deleted: false }]), post: vi.fn(), remove: vi.fn(), report: vi.fn(async () => {}), watch: vi.fn(() => vi.fn()) }; });
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));

async function flush(): Promise<void> { for (let i = 0; i < 8; i++) await Promise.resolve(); await nextTick(); }

async function mount() { const target = window.document.createElement('div'); window.document.body.append(target); const active = ref(true); const game = { id: 'g', phase: 'playing', isParticipant: false, allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: false } as OnlineGame; const app = createApp({ render: () => h(HataigoChat, { game, active: active.value }) }); app.mount(target); cleanup.push(() => { app.unmount(); target.remove(); }); await flush(); return { target, active }; }

function button(target: HTMLElement, label: string): HTMLButtonElement { const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent.trim() === label); if (!found) throw new Error(`Missing ${label}`); return found; }

describe('gated chat UI', () => {
	it('has no input or message fetch when policy is disabled', async () => {
		const { target } = await mount();
		expect(target.textContent).toContain(chatText.disabled);
		expect(target.querySelector('textarea')).toBeNull();
		expect(fixture.transport.messages).not.toHaveBeenCalled();
		expect(fixture.transport.watch).not.toHaveBeenCalled();
	});
	it('renders message text as plain text and requires explicit report confirmation', async () => {
		vi.mocked(fixture.transport.capability).mockResolvedValue({ enabled: true, retentionDays: 7, disclosureVersion: 'v1' });
		const { target } = await mount();
		expect(target.querySelector('script')).toBeNull();
		expect(target.textContent).toContain('<script>alert(1)</script>');
		button(target, chatText.report).click();
		await nextTick();
		expect(fixture.transport.report).not.toHaveBeenCalled();
		button(target, chatText.confirmReport).click();
		await flush();
		expect(fixture.transport.report).toHaveBeenCalledWith('other', expect.stringContaining('投稿時刻: 2026-10-20T00:00:00Z'));
	});
	it('shows the approved retention and disclosure explanation without exposing a version token', async () => {
		vi.mocked(fixture.transport.capability).mockResolvedValue({ enabled: true, retentionDays: 30, disclosureVersion: 'approved-policy-internal-version' });
		const { target } = await mount();
		expect(target.textContent).toContain('30日');
		expect(target.textContent).toContain(chatText.disclosurePolicy);
		expect(target.textContent).not.toContain('approved-policy-internal-version');
	});

	it('clears text and composer on inactive lifecycle', async () => {
		vi.mocked(fixture.transport.capability).mockResolvedValue({ enabled: true, retentionDays: 7, disclosureVersion: 'v1' });
		const { target, active } = await mount();
		expect(target.querySelector('textarea')).not.toBeNull();
		active.value = false;
		await flush();
		expect(target.querySelector('textarea')).toBeNull();
		expect(target.textContent).not.toContain('<script>');
	});
});
