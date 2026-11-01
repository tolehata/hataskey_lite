/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, nextTick, provide, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ ui: 'simple' }));
vi.mock('@@/js/config.js', () => shell);

import { noteCharmDeckActiveKey, useNoteCharmAvailability } from './use-note-charm-context.js';

beforeEach(() => vi.stubGlobal('innerWidth', 1400));
afterEach(() => vi.unstubAllGlobals());

describe('note charm UI availability', () => {
	it.each([['simple', 1099, 1100], ['default', 500, 501]])('follows %s resizing without changing the deck state', async (ui, narrow, wide) => {
		shell.ui = ui;
		vi.stubGlobal('navigator', { userAgent: 'desktop', maxTouchPoints: 0 });
		let available: ReturnType<typeof useNoteCharmAvailability>;
		const app = createApp(defineComponent({ setup() { available = useNoteCharmAvailability(); return () => null; } }));
		app.mount(window.document.createElement('div'));
		try {
			expect(available!.value).toBe(true);
			vi.stubGlobal('innerWidth', narrow);
			window.dispatchEvent(new Event('resize'));
			await nextTick();
			expect(available!.value).toBe(false);
			vi.stubGlobal('innerWidth', wide);
			window.dispatchEvent(new Event('resize'));
			await nextTick();
			expect(available!.value).toBe(true);
		} finally { app.unmount(); }
	});

	it.each(['iPhone', 'Mozilla/5.0 (Linux; Android 16) Mobile Safari/537.36'])('excludes smartphone hardware in a supported UI: %s', userAgent => {
		shell.ui = 'simple';
		vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5 });
		let available = true;
		const app = createApp(defineComponent({ setup() { available = useNoteCharmAvailability().value; return () => null; } }));
		app.mount(window.document.createElement('div'));
		expect(available).toBe(false);
		app.unmount();
	});

	it.each(['deck', 'hataskey3'])('excludes %s', (ui) => {
		shell.ui = ui;
		let available = true;
		const app = createApp(defineComponent({ setup() { available = useNoteCharmAvailability().value; return () => null; } }));
		app.mount(window.document.createElement('div'));
		expect(available).toBe(false);
		app.unmount();
	});

	it('follows the actual simple deck surface and restores normal/mobile pages', async () => {
		shell.ui = 'simple';
		const deckActive = ref(false);
		let available: ReturnType<typeof useNoteCharmAvailability>;
		const child = defineComponent({ setup() { available = useNoteCharmAvailability(); return () => null; } });
		const app = createApp(defineComponent({ components: { child }, setup() { provide(noteCharmDeckActiveKey, deckActive); }, template: '<child />' }));
		app.mount(window.document.createElement('div'));
		expect(available!.value).toBe(true);
		deckActive.value = true;
		await nextTick();
		expect(available!.value).toBe(false);
		deckActive.value = false;
		await nextTick();
		expect(available!.value).toBe(true);
		app.unmount();
	});
});
