/* SPDX-License-Identifier: AGPL-3.0-only */
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type * as Misskey from 'cherrypick-js';
import { createHk3NoteConfirmationHost } from './hk3-note-confirmation-host.js';
import { registerNoteActionConfirmation, requestNoteActionConfirmation } from '@/utility/note-action-confirmation.js';

function setup() {
	const request = { kind: 'delete' as const, note: { id: 'original' } as Misskey.entities.Note, run: vi.fn(async () => {}) };
	const composer = { canConfirm: true, confirmationActive: false, openConfirmation: vi.fn(() => true), cancelConfirmation: vi.fn() };
	const state = { composer: composer as typeof composer | null, available: true };
	const beforeOpen = vi.fn();
	const host = createHk3NoteConfirmationHost({ composer: () => state.composer, available: () => state.available, beforeOpen });
	return { host, composer, state, request, beforeOpen };
}

describe('note confirmation host', () => {
	it('hands off only after the originating menu has closed and never executes the action itself', async () => {
		const view = setup();
		expect(view.host.offer(view.request)).toBe(true);
		expect(view.host.offer(view.request)).toBe(true);
		expect(view.composer.openConfirmation).not.toHaveBeenCalled();
		await nextTick(); await nextTick();
		expect(view.beforeOpen).toHaveBeenCalledOnce();
		expect(view.composer.openConfirmation).toHaveBeenCalledExactlyOnceWith(view.request);
		expect(view.request.run).not.toHaveBeenCalled();
	});

	it('does not fall through to a second dialog while a confirmation is active', () => {
		const view = setup();
		view.composer.confirmationActive = true;
		expect(view.host.offer(view.request)).toBe(true);
		expect(view.composer.openConfirmation).not.toHaveBeenCalled();
	});

	it('leaves deck, hidden, and busy composers on their existing confirmation path', () => {
		const view = setup();
		view.state.available = false;
		expect(view.host.offer(view.request)).toBe(false);
		view.state.available = true; view.composer.canConfirm = false;
		expect(view.host.offer(view.request)).toBe(false);
		view.state.composer = null;
		expect(view.host.offer(view.request)).toBe(false);
		expect(view.request.run).not.toHaveBeenCalled();
	});

	it.each(['cancel', 'replace', 'hide'] as const)('does not reopen stale confirmation after %s during menu dismissal', async kind => {
		const view = setup();
		view.host.offer(view.request);
		if (kind === 'cancel') view.host.cancel();
		if (kind === 'replace') view.state.composer = { ...view.composer };
		if (kind === 'hide') view.state.available = false;
		await nextTick(); await nextTick();
		expect(view.composer.openConfirmation).not.toHaveBeenCalled();
		expect(view.request.run).not.toHaveBeenCalled();
	});

	it('releases the UI registration without an old owner clearing a newer UI', () => {
		const request = setup().request;
		const first = vi.fn(() => true);
		const second = vi.fn(() => false);
		const releaseFirst = registerNoteActionConfirmation(first);
		expect(requestNoteActionConfirmation(request)).toBe(true);
		const releaseSecond = registerNoteActionConfirmation(second);
		releaseFirst();
		expect(requestNoteActionConfirmation(request)).toBe(false);
		expect(second).toHaveBeenCalledExactlyOnceWith(request);
		releaseSecond();
		expect(requestNoteActionConfirmation(request)).toBe(false);
	});
});
