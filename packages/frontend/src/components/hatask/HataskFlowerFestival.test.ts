/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick } from 'vue';
import type { App } from 'vue';
import type { Locale } from '../../../../../locales/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HataskFlowerFestival from './HataskFlowerFestival.vue';
import type { HataskFlowerFestival as Festival } from '@/utility/hatask-flower-v2.js';
import { i18n } from '@/i18n.js';
import { popupMenu } from '@/os.js';

// Keep I18n, Mfm, and MkCustomEmoji real; isolate their unrelated application services.
vi.mock('@/i18n.js', async () => {
	const { default: catalog } = await import('../../../../../locales/ja-JP.yml?raw');
	const { load } = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	return { i18n: new I18n(load(catalog) as Locale) };
});
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { showingAnimatedImages: 'always', advancedMfm: true, animatedMfm: true } } }));
vi.mock('@/custom-emojis.js', async () => {
	const { ref } = await import('vue');
	const emoji = { name: 'flower', url: 'https://local.test/flower.svg' };
	return { customEmojis: ref([emoji]), customEmojisMap: new Map([['flower', emoji]]) };
});
vi.mock('@/utility/media-proxy.js', () => ({ getProxiedImageUrl: (url: string) => url, getStaticImageUrl: (url: string) => url }));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(), misskeyApiGet: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/utility/emoji-palette.js', () => ({ addToEmojiPalette: vi.fn() }));
vi.mock('@/utility/emoji-mute.js', async () => {
	const { ref } = await import('vue');
	return { makeEmojiMuteKey: () => '', checkMuted: () => ref(false), mute: vi.fn(), unmute: vi.fn() };
});
vi.mock('@/components/MkCustomEmojiDetailedDialog.vue', () => ({ default: {} }));
vi.mock('@/pages/emoji-edit-dialog.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkA.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkUrl.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkTime.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkEmoji.vue', () => ({ default: {} }));
vi.mock('@/components/MkLink.vue', () => ({ default: {} }));
vi.mock('@/components/MkMention.vue', () => ({ default: {} }));
vi.mock('@/components/MkCode.vue', () => ({ default: {} }));
vi.mock('@/components/MkCodeInline.vue', () => ({ default: {} }));
vi.mock('@/components/MkGoogle.vue', () => ({ default: {} }));
vi.mock('@/components/MkSparkle.vue', () => ({ default: {} }));

let app: App | undefined;
const originalCopy = i18n.ts._hata._hatask._flowerFestival.participantPoured;
afterEach(() => {
	app?.unmount();
	app = undefined;
	document.body.innerHTML = '';
	i18n.ts._hata._hatask._flowerFestival.participantPoured = originalCopy;
	vi.clearAllMocks();
});

async function mount(names: (string | null)[]) {
	const festival: Festival = {
		id: 'festival', season: 'spring', total: 25, goal: 100,
		startsAt: '2026-03-01T00:00:00Z', endsAt: '2026-04-01T00:00:00Z', bloomedAt: null,
		participated: true, seedReceived: false,
		recentParticipants: names.map((name, index) => ({ id: `person-${index}`, username: `user${index}`, name })),
	};
	const root = document.createElement('div');
	document.body.append(root);
	app = createApp({ render: () => h(HataskFlowerFestival, { festival, animations: false }) });
	app.mount(root);
	await nextTick();
	return root;
}

// Read the participant sentence, excluding its decorative first-character avatar.
const sentences = (root: HTMLElement) => [...root.querySelectorAll('[aria-hidden="true"]')].map(avatar => avatar.nextElementSibling!);

describe('flower festival participant names', () => {
	it('renders a local custom emoji image inside the translated participant sentence without an emoji menu', async () => {
		const root = await mount(['花好き :flower:']);
		const sentence = sentences(root)[0];
		const emoji = sentence.querySelector('img');
		expect(emoji?.getAttribute('src')).toBe('https://local.test/flower.svg');
		expect(emoji?.getAttribute('alt')).toBe(':flower:');
		expect(sentence.textContent).toBe(originalCopy.replace('{name}', '花好き '));
		emoji?.click();
		expect(popupMenu).not.toHaveBeenCalled();
	});

	it('preserves unknown shortcodes and falls back to a shortcode when an image fails', async () => {
		const root = await mount(['名前 :missing: :flower:']);
		const sentence = sentences(root)[0];
		expect(sentence.textContent).toContain(':missing:');
		expect(sentence.querySelectorAll('img')).toHaveLength(1);
		sentence.querySelector('img')?.dispatchEvent(new Event('error'));
		await nextTick();
		expect(sentence.textContent).toBe(originalCopy.replace('{name}', '名前 :missing: :flower:'));
	});

	it.each([null, ''])('uses the username when the display name is %s', async (name) => {
		const root = await mount([name]);
		expect(sentences(root)[0].textContent).toBe(originalCopy.replace('{name}', 'user0'));
	});

	it('keeps markup literal while still rendering emoji', async () => {
		const name = '**bold** $[spin text] <img src=x onerror=alert(1)> :flower:';
		const root = await mount([name]);
		const sentence = sentences(root)[0];
		expect(sentence.textContent).toBe(originalCopy.replace('{name}', name.replace(':flower:', '')));
		expect(sentence.querySelector('strong, script, img[onerror]')).toBeNull();
		expect(sentence.querySelectorAll('img')).toHaveLength(1);
	});

	it('honors translated placeholder order and caps recent participants at five', async () => {
		i18n.ts._hata._hatask._flowerFestival.participantPoured = 'Poured: {name} — thank you' as typeof originalCopy;
		const root = await mount(['one :flower:', 'two', 'three', 'four', 'five', 'six']);
		expect(sentences(root)).toHaveLength(5);
		expect(sentences(root)[0].textContent).toBe('Poured: one  — thank you');
		expect(sentences(root)[0].querySelector('img')?.alt).toBe(':flower:');
		expect(root.textContent).not.toContain('six');
	});
});
