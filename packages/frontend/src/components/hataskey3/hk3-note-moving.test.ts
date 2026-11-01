/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it, vi } from 'vitest';
import { createHk3NoteMoving } from './hk3-note-moving.js';

function animation() {
	let finish!: () => void;
	let reject!: (error: Error) => void;
	const finished = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; });
	const cancel = vi.fn(() => reject(new Error('canceled')));
	return { value: { finished, cancel } as unknown as Animation, finish, cancel };
}

describe('moving note marker', () => {
	it('waits for every overlapping animation before restoring the attribute', async () => {
		const moving = createHk3NoteMoving();
		const note = window.document.createElement('article');
		const first = animation();
		const second = animation();
		moving.track(note, first.value);
		moving.track(note, second.value);
		expect(note.hasAttribute('data-hk3-note-moving')).toBe(true);
		first.finish();
		await first.value.finished;
		expect(note.hasAttribute('data-hk3-note-moving')).toBe(true);
		second.finish();
		await second.value.finished;
		expect(note.hasAttribute('data-hk3-note-moving')).toBe(false);
	});

	it('cancels all owners on hide or unmount and restores a preexisting value', async () => {
		const moving = createHk3NoteMoving();
		const note = window.document.createElement('article');
		note.setAttribute('data-hk3-note-moving', 'original');
		const first = animation();
		const second = animation();
		moving.track(note, first.value);
		moving.track(note, second.value);
		moving.cancel(first.value);
		expect(note.getAttribute('data-hk3-note-moving')).toBe('');
		moving.cancelAll();
		expect(second.cancel).toHaveBeenCalledTimes(1);
		expect(note.getAttribute('data-hk3-note-moving')).toBe('original');
		await Promise.resolve();
		expect(note.getAttribute('data-hk3-note-moving')).toBe('original');
	});

	it('keeps a forwards-filled clip marked until the animation is canceled', async () => {
		const moving = createHk3NoteMoving();
		const note = window.document.createElement('article');
		const clip = animation();
		moving.track(note, clip.value, true);
		clip.finish();
		await clip.value.finished;
		expect(note.hasAttribute('data-hk3-note-moving')).toBe(true);
		moving.cancel(clip.value);
		expect(note.hasAttribute('data-hk3-note-moving')).toBe(false);
	});
});
