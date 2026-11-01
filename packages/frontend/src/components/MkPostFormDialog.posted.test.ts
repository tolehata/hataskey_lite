/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import MkPostFormDialog from './MkPostFormDialog.vue';

const mocks = vi.hoisted(() => ({ close: vi.fn() }));
vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ emits: ['click', 'closed', 'esc'], setup(_, { slots, expose }) { expose({ close: mocks.close }); return () => h('div', slots.default?.()); } }) };
});
vi.mock('@/components/MkPostForm.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: ['restoreDraft'], emits: ['posted', 'cancel'], setup(props, { emit, expose }) {
		expose({ canClose: async () => true, abortUploader() {} });
		return () => h('div', { 'data-restore-draft': String(props.restoreDraft) }, [h('button', { 'data-posted': '', onClick: () => emit('posted') }), h('button', { 'data-cancel': '', onClick: () => emit('cancel') })]);
	} }) };
});
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); mocks.close.mockReset(); });

function mount(restoreDraft?: boolean) {
	const posted = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(MkPostFormDialog, { onPosted: posted, ...(restoreDraft === undefined ? {} : { restoreDraft }) }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { posted, target };
}

describe('full post dialog success signal', () => {
	it('defaults draft restoration to true while forwarding explicit false', () => {
		expect(mount().target.querySelector('[data-restore-draft]')?.getAttribute('data-restore-draft')).toBe('true');
		expect(mount(false).target.querySelector('[data-restore-draft]')?.getAttribute('data-restore-draft')).toBe('false');
	});
	it('forwards the child posted event and preserves the send closing animation', () => {
		const view = mount();
		view.target.querySelector<HTMLButtonElement>('[data-posted]')!.click();
		expect(view.posted).toHaveBeenCalledOnce();
		expect(mocks.close).toHaveBeenCalledWith({ useSendAnimation: true });
	});
	it('does not report success when the child cancels', async () => {
		const view = mount();
		view.target.querySelector<HTMLButtonElement>('[data-cancel]')!.click();
		await nextTick();
		expect(mocks.close).toHaveBeenCalledOnce();
		expect(view.posted).not.toHaveBeenCalled();
	});
});
