/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/i.js', () => ({ $i: { id: 'mod', isModerator: true, isAdmin: false } }));
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ emits: ['closed'], methods: { close() { this.$emit('closed'); } }, template: '<div><slot/></div>' }) };
});
import RecordModerationDialog from './RecordModerationDialog.vue';
const target = { product: 'hatady', targetType: 'book', targetId: 'book1' } as const;
const preview = { ...target, version: 'a'.repeat(64), title: '確認対象', userId: 'owner', username: 'owner', name: '所有者', impact: [{ label: '本', count: 1 }], retained: '活動記録は残ります' };

async function flushPromises() { for (let i = 0; i < 8; i++) { await Promise.resolve(); await nextTick(); } }

function open(action: 'delete' | 'warn' = 'delete') {
	const host = window.document.createElement('div'); window.document.body.append(host);
	const done = vi.fn();
	const app = createApp({ render: () => h(RecordModerationDialog, { target, action, onDone: done }) }); app.mount(host);
	const wrap = (element: Element) => ({
		attributes: (name: string) => element.hasAttribute(name) ? element.getAttribute(name) : undefined,
		setValue: async (value: string | boolean) => {
			if (typeof value === 'boolean') (element as HTMLInputElement).checked = value;
			else (element as HTMLTextAreaElement).value = value;
			element.dispatchEvent(new Event(typeof value === 'boolean' ? 'change' : 'input', { bubbles: true })); await nextTick();
		},
		trigger: async (name: string) => { element.dispatchEvent(new Event(name, { bubbles: true, cancelable: true })); await nextTick(); },
	});
	return {
		get: (selector: string) => { const element = host.querySelector(selector); if (!element) throw new Error(`Missing element: ${selector}`); return wrap(element); },
		findAll: (selector: string) => [...host.querySelectorAll(selector)].map(wrap),
		emitted: (_event: string) => done.mock.calls,
		unmount: () => { app.unmount(); host.remove(); },
	};
}

beforeEach(() => {
	mocks.api.mockReset();
	mocks.api.mockImplementation(async (endpoint: string) => endpoint.endsWith('preview') ? preview : endpoint.endsWith('history') ? [] : { operationId: 'op1', action: 'delete', performedAt: '2026-09-22T13:00:00Z', warningId: 'warning1' });
});
describe('record moderation confirmation', () => {
	test('requires nonblank reason, warning text and explicit confirmation', async () => {
		const wrapper = open(); await flushPromises();
		const submit = wrapper.get('button[type="submit"]');
		expect(submit.attributes('disabled')).toBeDefined();
		await wrapper.findAll('textarea')[0].setValue('　 ');
		await wrapper.findAll('textarea')[1].setValue('利用者向けの警告');
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
		expect(submit.attributes('disabled')).toBeDefined();
		await wrapper.findAll('textarea')[0].setValue('削除理由');
		expect(submit.attributes('disabled')).toBeUndefined();
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(mocks.api).toHaveBeenCalledWith('admin/record-moderation/execute', expect.objectContaining({ reason: '削除理由', warning: '利用者向けの警告', targetId: 'book1' }));
		expect(wrapper.emitted('done')).toHaveLength(1); wrapper.unmount();
	});
	test('turning warning off permits reason-only deletion', async () => {
		const wrapper = open(); await flushPromises();
		await wrapper.findAll('textarea')[0].setValue('削除理由');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(false);
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(mocks.api).toHaveBeenCalledWith('admin/record-moderation/execute', expect.objectContaining({ action: 'delete', warning: null })); wrapper.unmount();
	});
	test('network uncertainty retains the exact request ID and prevents edited retries', async () => {
		let first = true;
		mocks.api.mockImplementation(async (endpoint: string) => {
			if (endpoint.endsWith('preview')) return preview;
			if (endpoint.endsWith('history')) return [];
			if (first) { first = false; throw new Error('network lost'); }
			return { operationId: 'op1', action: 'warn', performedAt: '2026-09-22T13:00:00Z', warningId: 'warning1' };
		});
		const wrapper = open('warn'); await flushPromises();
		await wrapper.findAll('textarea')[0].setValue('対応理由'); await wrapper.findAll('textarea')[1].setValue('警告文'); await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(wrapper.findAll('textarea')[0].attributes('disabled')).toBeDefined();
		await wrapper.get('form').trigger('submit'); await flushPromises();
		const calls = mocks.api.mock.calls.filter(([endpoint]) => endpoint.endsWith('execute'));
		expect(calls).toHaveLength(2); expect(calls[0][1]).toEqual(calls[1][1]); wrapper.unmount();
	});
});
