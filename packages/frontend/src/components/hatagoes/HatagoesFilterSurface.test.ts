/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HatagoesFilterSurface from './HatagoesFilterSurface.vue';

vi.mock('./HatagoesDialog.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: ['open', 'preferType'], setup(props, { slots }) {
		return () => h('div', { 'data-surface-modal': '', 'data-type': props.preferType, 'data-open': String(props.open) }, slots.default?.());
	} }) };
});

let cleanup: (() => void) | undefined;
const originalWidth = window.innerWidth;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth }); });

function mount(embedded: boolean) {
	const open = ref(true);
	const draft = ref('draft');
	const close = vi.fn(() => { open.value = false; });
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatagoesFilterSurface, { embedded, open: open.value, title: 'Filters', closeLabel: 'Close', onClose: close }, { default: () => h('input', { value: draft.value, onInput: (event: Event) => { draft.value = (event.target as HTMLInputElement).value; } }) }) });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	return { target, open, close };
}

describe('HataGoes filter surface', () => {
	test('legacy pages keep the inline filter without a modal', () => {
		const { target } = mount(false);
		expect(target.querySelector('input')).not.toBeNull();
		expect(target.querySelector('[data-surface-modal]')).toBeNull();
	});
	test('narrow embedded pages use a bottom drawer and retain draft content while closing', async () => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 });
		const { target, close } = mount(true);
		const modal = window.document.body.querySelector('[data-type=drawer]')!;
		expect(target.contains(modal)).toBe(false);
		const input = modal.querySelector('input')!;
		input.value = 'kept';
		input.dispatchEvent(new Event('input'));
		(modal.querySelector('button') as HTMLButtonElement).click();
		await nextTick();
		expect(close).toHaveBeenCalledOnce();
		expect(window.document.body.querySelector('[data-surface-modal] input')).toBe(input);
		expect(input.value).toBe('kept');
	});
	test('wide embedded pages keep a centered dialog', () => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1100 });
		mount(true);
		expect(window.document.body.querySelector('[data-type=dialog]')).not.toBeNull();
	});
	test('a narrow app window uses a drawer even inside a wide browser', async () => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 390 } as DOMRect);
		mount(true);
		await nextTick();
		expect(window.document.body.querySelector('[data-type=drawer]')).not.toBeNull();
	});
});
