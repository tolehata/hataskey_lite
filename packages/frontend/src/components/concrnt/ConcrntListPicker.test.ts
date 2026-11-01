/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import ConcrntListPicker from './ConcrntListPicker.vue';
import type { ConcrntList } from '@/utility/concrnt/types.js';

const lists: ConcrntList[] = [
	{ uri: 'cc://con1example/world.concrnt.list/main', name: 'いつものリスト', timelines: ['one'], pinned: true, excludeSelf: false, defaultPostHome: true, defaultPostTimelines: ['one'], communities: [] },
	{ uri: 'cc://con1example/world.concrnt.list/work', name: '仕事のリスト', timelines: ['one', 'two'], pinned: false, excludeSelf: true, defaultPostHome: false, defaultPostTimelines: ['two'], communities: [] },
];
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

async function flush() { await nextTick(); await Promise.resolve(); await nextTick(); }

function popup() { return window.document.querySelector<HTMLElement>('.concrnt-list-popup')!; }

function key(value: string) { window.document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }

async function mountPicker(initial: Partial<{ modelValue: string; loading: boolean; error: string; disabled: boolean; lists: ConcrntList[] }> = {}) {
	const state = reactive({ modelValue: lists[1].uri, lists, loading: false, error: '', disabled: false, ...initial });
	const refresh = vi.fn();
	const selected = vi.fn((value: string) => { state.modelValue = value; });
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const app = createApp({ render: () => h(ConcrntListPicker, { ...state, onRefresh: refresh, 'onUpdate:modelValue': selected }) });
	app.mount(target);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); target.remove(); mounted = false; } };
	cleanups.push(unmount);
	await flush();
	return { state, target, trigger: target.querySelector<HTMLButtonElement>('button')!, refresh, selected, unmount };
}

describe('CTL list picker', () => {
	test('shows the selected list and opens on that list with an explicit popup relationship', async () => {
		const { trigger, refresh } = await mountPicker();
		expect(trigger.textContent).toContain('仕事のリスト');
		trigger.click();
		await flush();
		expect(refresh).toHaveBeenCalledOnce();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(trigger.getAttribute('aria-controls')).toBe(popup().id);
		expect(popup().getAttribute('role')).toBe('dialog');
		expect(window.document.activeElement?.getAttribute('aria-pressed')).toBe('true');
		expect(window.document.activeElement?.textContent).toContain('仕事のリスト');
	});

	test('selection emits the exact list URI and returns focus to the trigger', async () => {
		const { trigger, selected } = await mountPicker();
		trigger.click();
		await flush();
		const choice = Array.from(popup().querySelectorAll('button')).find(item => item.textContent?.includes('いつものリスト'))!;
		choice.click();
		await flush();
		expect(selected).toHaveBeenCalledWith(lists[0].uri);
		expect(popup()).toBeNull();
		expect(window.document.activeElement).toBe(trigger);
		expect(trigger.textContent).toContain('いつものリスト');
	});

	test('supports arrow, Home, End and Escape without changing the selection', async () => {
		const { trigger, selected } = await mountPicker();
		trigger.click();
		await flush();
		const choices = Array.from(popup().querySelectorAll('button'));
		key('Home');
		expect(window.document.activeElement).toBe(choices[0]);
		key('ArrowUp');
		expect(window.document.activeElement).toBe(choices.at(-1));
		key('ArrowDown');
		expect(window.document.activeElement).toBe(choices[0]);
		key('End');
		expect(window.document.activeElement).toBe(choices.at(-1));
		key('Escape');
		await flush();
		expect(popup()).toBeNull();
		expect(window.document.activeElement).toBe(trigger);
		expect(selected).not.toHaveBeenCalled();
	});

	test('restores the selected-item focus after a loading response', async () => {
		const { state, trigger } = await mountPicker({ loading: true });
		trigger.click();
		await flush();
		expect(popup().getAttribute('aria-busy')).toBe('true');
		expect(popup().textContent).toContain('リストを取得しています');
		state.loading = false;
		await flush();
		expect(window.document.activeElement?.textContent).toContain('仕事のリスト');
		expect(window.document.activeElement?.getAttribute('aria-pressed')).toBe('true');
	});

	test.each([false, true])('returns to the trigger before native Tab traversal (shift: %s)', async shiftKey => {
		const { trigger, selected } = await mountPicker();
		trigger.click();
		await flush();
		expect(window.document.activeElement?.textContent).toContain('仕事のリスト');
		const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
		const allowDefault = window.document.activeElement!.dispatchEvent(event);
		// Synthetic events do not perform native Tab traversal; verify its starting point and permission.
		expect(window.document.activeElement).toBe(trigger);
		expect(allowDefault).toBe(true);
		expect(event.defaultPrevented).toBe(false);
		await flush();
		expect(popup()).toBeNull();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(selected).not.toHaveBeenCalled();
	});

	test('shows a failed list request and retries without selecting home', async () => {
		const { trigger, refresh, selected } = await mountPicker({ error: '一覧を取得できませんでした。' });
		trigger.click();
		await flush();
		expect(popup().querySelector('[role="alert"]')?.textContent).toContain('一覧を取得できませんでした');
		popup().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
		expect(refresh).toHaveBeenCalledTimes(2);
		expect(selected).not.toHaveBeenCalled();
	});

	test('indicates an unavailable selection and allows an explicit return to home', async () => {
		const { trigger, selected } = await mountPicker({ modelValue: 'cc://missing/list' });
		expect(trigger.textContent).toContain('選択したリストを確認してください');
		trigger.click();
		await flush();
		popup().querySelector<HTMLButtonElement>('button')!.click();
		await flush();
		expect(selected).toHaveBeenCalledWith('');
		expect(trigger.textContent).toContain('ホーム');
	});

	test('outside input and disabled changes close the popup without mutating selection', async () => {
		const { state, trigger, selected } = await mountPicker();
		trigger.click();
		await flush();
		window.document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await flush();
		expect(popup()).toBeNull();
		trigger.click();
		await flush();
		state.disabled = true;
		await flush();
		expect(popup()).toBeNull();
		expect(trigger.disabled).toBe(true);
		expect(selected).not.toHaveBeenCalled();
	});

	test('unmount removes the teleported popup', async () => {
		const { trigger, unmount } = await mountPicker();
		trigger.click();
		await flush();
		expect(popup()).not.toBeNull();
		unmount();
		expect(popup()).toBeNull();
	});
});
