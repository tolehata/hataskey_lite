/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HatagoesDialog from './HatagoesDialog.vue';

vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { manualShowing: Boolean, forceMotion: Boolean, preferType: String }, emits: ['closed'], setup(props, { slots, emit }) {
		return () => h('div', { 'data-modal': '', 'data-open': String(props.manualShowing), 'data-forced': String(props.forceMotion), 'data-prefer': props.preferType, onAnimationend: () => emit('closed') }, slots.default?.());
	} }) };
});

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); });

describe('HataGoes dialog lifecycle', () => {
	test('retains content while leaving and lets a new open interrupt without losing input', async () => {
		const open = ref(true), closed = vi.fn();
		const target = window.document.createElement('div'); window.document.body.append(target);
		const app = createApp({ render: () => h(HatagoesDialog, { open: open.value, onClosed: closed }, { default: () => h('input') }) });
		app.mount(target); cleanup = () => { app.unmount(); target.remove(); };
		const input = target.querySelector('input')!; input.value = 'draft';
		expect(target.querySelector('[data-forced=true]')).not.toBeNull();
		open.value = false; await nextTick();
		expect(target.querySelector('input')).toBe(input);
		open.value = true; await nextTick();
		expect(target.querySelector('input')?.value).toBe('draft');
		target.querySelector('[data-modal]')?.dispatchEvent(new Event('animationend'));
		await nextTick();
		expect(closed).not.toHaveBeenCalled();
		expect(target.querySelector('input')).toBe(input);
		open.value = false; await nextTick();
		target.querySelector('[data-modal]')?.dispatchEvent(new Event('animationend'));
		await nextTick();
		expect(closed).toHaveBeenCalledOnce();
		expect(target.querySelector('input')).toBeNull();
	});

	test('keeps an opted-in search mounted but inert after the modal closes', async () => {
		const open = ref(true);
		const target = window.document.createElement('div'); window.document.body.append(target);
		const app = createApp({ render: () => h(HatagoesDialog, { open: open.value, keepRendered: true }, { default: () => h('input') }) });
		app.mount(target); cleanup = () => { app.unmount(); target.remove(); };
		const input = target.querySelector('input')!; input.value = '検索中';
		open.value = false; await nextTick();
		target.querySelector('[data-modal]')?.dispatchEvent(new Event('animationend'));
		await nextTick();
		expect(target.querySelector('[data-modal]')?.getAttribute('data-open')).toBe('false');
		expect(input.parentElement?.hasAttribute('inert')).toBe(true);
		expect(target.querySelector('input')).toBe(input);
		open.value = true; await nextTick();
		expect(input.value).toBe('検索中');
		expect(input.parentElement?.hasAttribute('inert')).toBe(false);
	});

	test('uses a drawer only for opted-in dialogs in narrow viewports and tracks resize', async () => {
		let listener: ((event: { matches: boolean }) => void) | undefined;
		const remove = vi.fn();
		vi.stubGlobal('matchMedia', vi.fn(() => ({
			matches: false,
			addEventListener: (_type: string, callback: typeof listener) => { listener = callback; },
			removeEventListener: remove,
		})));
		const target = window.document.createElement('div'); window.document.body.append(target);
		const app = createApp({ render: () => h(HatagoesDialog, { open: true, responsiveSheet: true }, { default: () => h('section', 'picker') }) });
		app.mount(target); cleanup = () => { app.unmount(); target.remove(); };
		expect(target.querySelector('[data-prefer]')?.getAttribute('data-prefer')).toBe('auto');
		listener?.({ matches: true }); await nextTick();
		expect(target.querySelector('[data-prefer]')?.getAttribute('data-prefer')).toBe('drawer');
		expect(target.querySelector('section')?.parentElement?.className).toContain('drawer');
		listener?.({ matches: false }); await nextTick();
		expect(target.querySelector('[data-prefer]')?.getAttribute('data-prefer')).toBe('auto');
		app.unmount(); target.remove(); cleanup = undefined;
		expect(remove).toHaveBeenCalledOnce();
	});
});
