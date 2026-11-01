/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';

const fixtures = vi.hoisted(() => ({
	theme: { value: 'light' },
	records: new Map<string, string>(),
	save: vi.fn(),
	notify: vi.fn(),
}));
vi.mock('@/i.js', () => ({ $i: { id: 'theme-user' } }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	i18n.locale._hata._hatady._displaySettings.saveFailed = '保存できませんでした';
	return { i18n };
});
vi.mock('@/utility/hatady-prefs.js', () => ({ hatadyTheme: fixtures.theme, saveHatadyDisplay: fixtures.save }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixtures.notify, registerHatadySurface: () => () => {} }));
vi.mock('@/utility/hatady-tutorial-launcher.js', () => ({ showHatadyTutorial: vi.fn(async () => () => {}) }));
vi.mock('@/os.js', () => ({ popup: vi.fn() }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem(key: string) { return fixtures.records.get(key) ?? null; },
	setItem(key: string, value: string) { fixtures.records.set(key, value); },
	getItemAsJson(key: string) { const value = fixtures.records.get(key); return value == null ? undefined : JSON.parse(value); },
	setItemAsJson(key: string, value: unknown) { fixtures.records.set(key, JSON.stringify(value)); },
} }));
vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		emits: ['closed'],
		setup(_, { slots, emit, expose }) {
			expose({ close: () => emit('closed') });
			return () => render('div', { 'data-modal-host': '' }, slots.default?.());
		},
	}) };
});
import HatadyDisplaySettings from './HatadyDisplaySettings.vue';

const cleanups: Array<() => void> = [];
const storeKey = 'hataFormDrafts:theme-user';

async function mountSettings(embedded = false) {
	const closed = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatadyDisplaySettings, { embedded, onClosed: closed }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick();
	return { target, closed };
}

async function click(target: HTMLElement, selector: string) {
	const button = target.querySelector<HTMLButtonElement>(selector);
	if (!button) throw new Error(`Missing button: ${selector}`);
	button.click();
	await nextTick();
	await nextTick();
}

function touch(target: HTMLElement, name: string, x: number, y: number) {
	const event = new Event(name, { bubbles: true });
	Object.defineProperty(event, name === 'touchstart' ? 'touches' : 'changedTouches', { value: [{ clientX: x, clientY: y }] });
	target.dispatchEvent(event);
}

beforeEach(() => {
	fixtures.theme.value = 'light';
	fixtures.records.clear();
	fixtures.save.mockReset().mockResolvedValue(undefined);
	fixtures.notify.mockReset();
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

describe('Hatady theme selection', () => {
	test.each([false, true])('embedded=%s uses the appropriate page or dialog shell and keeps save controls', async embedded => {
		const { target, closed } = await mountSettings(embedded);
		const panel = target.querySelector<HTMLElement>('[data-embedded]');
		expect(panel).not.toBeNull();
		expect(panel?.dataset.bare).toBe(String(embedded));
		expect(panel?.getAttribute('role')).toBe(embedded ? null : 'dialog');
		expect(target.querySelectorAll('h2')).toHaveLength(1);
		expect(target.querySelector('h2')?.textContent).toBe('Hatady設定');
		expect(target.querySelectorAll('button[aria-label="閉じる"]')).toHaveLength(embedded ? 0 : 1);
		expect(target.querySelectorAll('[data-modal-host]')).toHaveLength(embedded ? 0 : 1);
		// The explanatory theme hint mentions the inherited language; no local
		// language selector should be introduced by the settings surface.
		expect(target.querySelector('select[aria-label="表示言語"], [role="combobox"][aria-label="表示言語"]')).toBeNull();
		expect(target.querySelector('[to="/settings/preferences"], [href="/settings/preferences"]')).toBeNull();
		await click(target, '[data-theme="dark"]');
		expect(closed).not.toHaveBeenCalled();
		await click(target, 'footer .hy-primary');
		expect(fixtures.save).toHaveBeenCalledExactlyOnceWith('dark');
		expect(closed).toHaveBeenCalledTimes(1);
	});

	test('the four mock themes select through cards and dots without saving until confirmed', async () => {
		const { target, closed } = await mountSettings();
		expect([...target.querySelectorAll<HTMLElement>('[data-theme]')].map(card => card.dataset.theme)).toEqual(['light', 'dark', 'paper', 'espresso']);
		expect(target.querySelector<HTMLButtonElement>('[aria-label="前のテーマ"]')?.disabled).toBe(true);
		await click(target, '[role="group"][aria-label="テーマの一覧"] [aria-label="夜の書斎"]');
		const selected = target.querySelector<HTMLElement>('[data-theme][aria-pressed="true"]');
		expect(selected?.dataset.theme).toBe('espresso');
		expect(selected?.style.getPropertyValue('--hy-theme-offset')).toBe('0');
		expect(selected?.textContent).toContain('落ち着いた茶色');
		expect(selected?.textContent).toContain('選択中');
		expect(target.querySelector<HTMLButtonElement>('[aria-label="次のテーマ"]')?.disabled).toBe(true);
		expect(target.querySelector('[data-theme="light"]')?.getAttribute('aria-hidden')).toBe('true');
		expect(fixtures.save).not.toHaveBeenCalled();
		expect(fixtures.records.size).toBe(0);
		await click(target, 'footer .hy-primary');
		expect(fixtures.save).toHaveBeenCalledExactlyOnceWith('espresso');
		expect(closed).toHaveBeenCalledTimes(1);
	});

	test('an existing shared-theme key remains selected without automatic conversion or writes', async () => {
		fixtures.theme.value = 'hataskey';
		const { target, closed } = await mountSettings();
		expect(target.querySelector('[data-theme][aria-pressed="true"]')?.getAttribute('data-theme')).toBe('hataskey');
		expect(target.querySelectorAll('[data-theme]')).toHaveLength(5);
		await click(target, 'footer .hy-secondary');
		expect(closed).toHaveBeenCalledTimes(1);
		expect(fixtures.theme.value).toBe('hataskey');
		expect(fixtures.save).not.toHaveBeenCalled();
		expect(fixtures.records.size).toBe(0);
	});

	test('a restored draft starts selected and a save failure keeps both selection and stored draft', async () => {
		fixtures.records.set(storeKey, JSON.stringify({ 'hatady-display': { version: 1, updatedAt: Date.now(), data: { theme: 'paper' } } }));
		const original = fixtures.records.get(storeKey);
		fixtures.save.mockRejectedValueOnce(new Error('offline'));
		const { target, closed } = await mountSettings();
		expect(target.querySelector('[data-theme][aria-pressed="true"]')?.getAttribute('data-theme')).toBe('paper');
		await click(target, 'footer .hy-primary');
		expect(target.querySelector('[role="alert"]')?.textContent).toBe('保存できませんでした');
		expect(target.querySelector('[data-theme][aria-pressed="true"]')?.getAttribute('data-theme')).toBe('paper');
		expect(fixtures.records.get(storeKey)).toBe(original);
		expect(closed).not.toHaveBeenCalled();
	});

	test('horizontal swipes change one theme while vertical swipes and the following click do not', async () => {
		const { target } = await mountSettings();
		const viewport = target.querySelector('[data-theme]')?.parentElement;
		if (!viewport) throw new Error('Missing theme viewport');
		touch(viewport, 'touchstart', 120, 100);
		touch(viewport, 'touchend', 80, 200);
		await nextTick();
		expect(target.querySelector('[data-theme][aria-pressed="true"]')?.getAttribute('data-theme')).toBe('light');
		touch(viewport, 'touchstart', 150, 100);
		touch(viewport, 'touchend', 60, 105);
		await nextTick();
		await click(target, '[data-theme="light"]');
		expect(target.querySelector('[data-theme][aria-pressed="true"]')?.getAttribute('data-theme')).toBe('dark');
		expect(fixtures.save).not.toHaveBeenCalled();
	});
});
