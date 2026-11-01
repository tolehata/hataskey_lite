/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import HataFeedEmojiApprove from './HataFeedEmojiApprove.vue';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import { prefer } from '@/preferences.js';
const fixture = vi.hoisted(() => ({ api: vi.fn(), records: new Map<string, string>() }));
vi.mock('@/i.js', () => ({ $i: { id: 'reviewer' } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItemAsJson: (key: string) => JSON.parse(fixture.records.get(key) ?? '{}'), setItemAsJson: (key: string, value: unknown) => fixture.records.set(key, JSON.stringify(value)) } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ popup: vi.fn(), toast: vi.fn(), inputText: async () => ({ canceled: false, result: '確認中' }) }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/MkWindow.vue', () => ({ default: defineComponent({ template: '<section><slot name="header"/><slot/></section>' }) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({ template: '<button><slot/></button>' }) }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>' }) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot/><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/></label>' }) }));
vi.mock('@/components/MkInfo.vue', () => ({ default: { template: '<p><slot/></p>' } }));
vi.mock('@/components/HataFeedCategorySelect.vue', () => ({ default: { template: '<div/>' } }));
const cleanups: Array<() => void> = [];
const request = (id: string): HataFeedEmojiRequest => ({ id, name: id, createdAt: '2026-09-14T00:00:00Z', requestedBy: null, category: '', aliases: [], license: 'license', localOnly: false, isSensitive: false, sourceType: 'own', originalUrl: null, remoteHost: null, imageUrl: null, status: 'pending', resolvedComment: null, resolvedAt: null, resolvedById: null, resolvedEmojiId: null });
beforeEach(() => { prefer.r.animation.value = false; fixture.records.clear(); fixture.api.mockReset().mockImplementation(async (endpoint: string, params: { id?: string }) => endpoint === 'hata/feedback/emoji-requests' ? [{ ...request(params.id!), status: 'pending' }] : []); });
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

async function mount() {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedEmojiApprove, { requests: [request('first'), request('second')] }) });
	app.component('MkTime', { template: '<time />' }); app.component('MkAvatar', { template: '<span />' }); app.component('MkUserName', { template: '<span />' }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); }); await nextTick(); return target;
}

async function click(target: HTMLElement, label: string) {
	const button = [...target.querySelectorAll('button')].find(element => element.textContent?.trim() === label || element.getAttribute('aria-label') === label)!;
	expect(button).toBeDefined(); button.click(); await nextTick(); await nextTick();
}

async function changeName(target: HTMLElement, value: string) {
	const input = target.querySelector<HTMLInputElement>('input')!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}

describe('HataFeed review queue input safety', () => {
	test.each([false, true])('switching pending requests preserves independent edits (motion=%s)', async motion => {
		prefer.r.animation.value = motion;
		const target = await mount(); await changeName(target, 'edited_first');
		await click(target, '次の申請'); await vi.waitFor(() => expect(target.querySelector<HTMLInputElement>('input')?.value).toBe('second'));
		await changeName(target, 'edited_second'); await click(target, '前の申請');
		await vi.waitFor(() => expect(target.querySelector<HTMLInputElement>('input')?.value).toBe('edited_first'));
	});
	test('resuming a saved review for another item retains both restored edits', async () => {
		const fields = (name: string) => ({ name, license: 'license', category: '', tagsRaw: '', localOnly: false, isSensitive: false });
		fixture.records.set('hataFormDrafts:reviewer', JSON.stringify({ 'hatafeed:emoji-review': { version: 1, updatedAt: Date.now(), data: { changes: { first: fields('restored_first'), second: fields('restored_second') }, selectedId: 'second' } } }));
		const target = await mount(); await click(target, '続きから編集');
		expect(target.querySelector<HTMLInputElement>('input')?.value).toBe('restored_second');
		await click(target, '前の申請'); expect(target.querySelector<HTMLInputElement>('input')?.value).toBe('restored_first');
	});
	test('failed approval retains the request and edited values for retry', async () => {
		fixture.api.mockImplementation(async (endpoint: string) => { if (endpoint.endsWith('/approve')) throw new Error('offline'); return endpoint.endsWith('emoji-requests') ? [request('first')] : []; });
		const target = await mount(); await changeName(target, 'keep_this'); await click(target, '承認して登録、次へ');
		await vi.waitFor(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
		expect(target.querySelector<HTMLInputElement>('input')?.value).toBe('keep_this');
		expect(fixture.api).toHaveBeenCalledWith('hata/feedback/emoji-requests/approve', expect.objectContaining({ requestId: 'first', name: 'keep_this' }));
	});
});
