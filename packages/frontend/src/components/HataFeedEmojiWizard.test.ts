/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
const fixture = vi.hoisted(() => ({ api: vi.fn(), choose: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'applicant' } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItemAsJson: () => ({}), setItemAsJson: vi.fn() } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: fixture.choose }));
vi.mock('@/os.js', () => ({ popup: vi.fn(), toast: vi.fn(), confirm: async () => ({ canceled: false }) }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/MkWindow.vue', () => ({ default: defineComponent({ props: ['autoHeight', 'initialHeight'], template: '<section><slot name="header"/><slot/></section>' }) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({ template: '<button><slot/></button>' }) }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>' }) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot/><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/></label>' }) }));
vi.mock('@/components/HataFeedCategorySelect.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfQuotaMeter.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfEmojiPreviewPair.vue', () => ({ default: { template: '<div/>' } }));
import HataFeedEmojiWizard from './HataFeedEmojiWizard.vue';

const cleanups: Array<() => void> = [];
const emojis = Array.from({ length: 15 }, (_, index) => ({ id: String(index + 1), name: `emoji_${index + 1}`, url: `https://example.test/${index + 1}.png`, host: 'example.test' }));
beforeEach(() => {
	fixture.api.mockReset().mockImplementation(async (endpoint: string, params: { untilId?: string; limit: number }) => {
		if (endpoint.endsWith('/emoji-quota')) return { limit: 5, remaining: 5, canRemote: true };
		if (endpoint.endsWith('/remote-emojis')) return emojis.slice(Number(params.untilId ?? 0), Number(params.untilId ?? 0) + params.limit);
		return [];
	});
	fixture.choose.mockReset().mockResolvedValue([{ id: 'image-one', name: 'wakaba.png', url: 'https://example.test/image.png' }]);
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

async function mount() {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedEmojiWizard) }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await vi.waitFor(() => expect([...target.querySelectorAll('button')].some(button => button.textContent?.includes('リモートの絵文字から探す') && !button.disabled)).toBe(true));

	return target;
}

async function click(target: HTMLElement, label: string) {
	const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.includes(label));
	expect(button).toBeDefined(); button!.click(); await nextTick();
}

const visibleNames = (target: HTMLElement) => [...target.querySelectorAll('button img')].map(img => img.getAttribute('alt'));

describe('HataFeed emoji application', () => {
	test('remote browsing replaces a short page instead of accumulating a vertical list', async () => {
		const target = await mount(); await click(target, 'リモートの絵文字から探す');
		await vi.waitFor(() => expect(visibleNames(target)).toEqual(emojis.slice(0, 6).map(item => item.name)));
		await click(target, '次のページ');
		await vi.waitFor(() => expect(visibleNames(target)).toEqual(emojis.slice(6, 12).map(item => item.name)));
		expect(fixture.api).toHaveBeenCalledWith('hata/feedback/remote-emojis', expect.objectContaining({ untilId: '6', limit: 7 }));
		await click(target, '前のページ'); expect(visibleNames(target)).toEqual(emojis.slice(0, 6).map(item => item.name));
		await click(target, '次のページ'); await click(target, '次のページ');
		await vi.waitFor(() => expect(visibleNames(target)).toEqual(emojis.slice(12).map(item => item.name)));
		expect(target.querySelector<HTMLButtonElement>('[aria-label="次のページ"]')?.disabled).toBe(true);
	});
	test('paging keeps the submitted search until the user starts a new search', async () => {
		const target = await mount(); await click(target, 'リモートの絵文字から探す');
		await vi.waitFor(() => expect(visibleNames(target)).toHaveLength(6));
		const input = target.querySelector('input')!; input.value = 'new search'; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
		await click(target, '次のページ');
		await vi.waitFor(() => expect(visibleNames(target)[0]).toBe('emoji_7'));
		expect(fixture.api).toHaveBeenLastCalledWith('hata/feedback/remote-emojis', expect.objectContaining({ query: null, untilId: '6' }));
	});
	test('the own-image detail form keeps both scope flags and submits the edited values', async () => {
		const target = await mount(); await click(target, '自分の画像から');
		await vi.waitFor(() => expect(target.querySelector('input')?.value).toBe('wakaba'));
		const inputs = target.querySelectorAll<HTMLInputElement>('input');
		inputs[1].value = 'CC0'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
		const flags = target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		flags[0].checked = true; flags[0].dispatchEvent(new Event('change', { bubbles: true })); await nextTick();
		await click(target, '申請して次を追加');
		await vi.waitFor(() => expect(fixture.api).toHaveBeenCalledWith('hata/feedback/emoji-requests/create', expect.objectContaining({ name: 'wakaba', license: 'CC0', localOnly: true, isSensitive: false, fileId: 'image-one' })));
	});
});
