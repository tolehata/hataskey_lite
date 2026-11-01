/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref } from 'vue';
import { HATA_GOES_HOST } from './hatagoes-context.js';

const fixture = vi.hoisted(() => ({
	popup: vi.fn(), scopedPopup: vi.fn(),
	alert: vi.fn(), confirm: vi.fn(), actions: vi.fn(), inputText: vi.fn(), inputNumber: vi.fn(), inputDatetime: vi.fn(),
	launch: null as null | (() => void),
}));
vi.mock('@/os.js', () => fixture);
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => fixture.launch ?? fixture.popup }));
import { useHataGoesDialogs } from './hatagoes-dialogs.js';

function capture(host = false) {
	let dialogs!: ReturnType<typeof useHataGoesDialogs>;
	const element = window.document.createElement('div');
	const app = createApp(defineComponent({ setup() {
		if (host) provide(HATA_GOES_HOST, { active: ref(true), register: vi.fn(), changed: vi.fn() });
		return () => h(defineComponent({ setup() { dialogs = useHataGoesDialogs(); return () => null; } }));
	} }));
	app.mount(element);
	app.unmount();
	return dialogs;
}

beforeEach(() => {
	fixture.launch = null;
	for (const method of ['alert', 'confirm', 'actions', 'inputText', 'inputNumber', 'inputDatetime'] as const) fixture[method].mockReset();
});

test('outside HataGoes uses the original dialog functions', () => {
	const dialogs = capture();
	expect(dialogs.confirm).toBe(fixture.confirm);
	expect(dialogs.inputText).toBe(fixture.inputText);
});

test('inside HataGoes passes the captured popup launcher to confirmation, input and alerts', () => {
	fixture.launch = fixture.scopedPopup;
	const dialogs = capture(true);
	const confirmation = { type: 'warning' as const, text: 'delete?' };
	const input = { title: 'name', default: '' };
	void dialogs.confirm(confirmation);
	void dialogs.inputText(input);
	void dialogs.alert({ type: 'info', text: 'saved' });
	expect(fixture.confirm).toHaveBeenCalledExactlyOnceWith(confirmation, fixture.scopedPopup);
	expect(fixture.inputText).toHaveBeenCalledExactlyOnceWith(input, fixture.scopedPopup);
	expect(fixture.alert).toHaveBeenCalledExactlyOnceWith({ type: 'info', text: 'saved' }, fixture.scopedPopup);
});
