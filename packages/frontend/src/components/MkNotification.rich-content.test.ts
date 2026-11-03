/* SPDX-License-Identifier: AGPL-3.0-only */
import notificationSource from './MkNotification.vue?raw';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { createApp, h, nextTick } from 'vue';
import type { App, Component } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MkNotification from './MkNotification.vue';
import MkAvatar from './global/MkAvatar.vue';
import MkUserName from './global/MkUserName.vue';
import Mfm from './global/MkMfm.js';
import { prefer } from '@/preferences.js';

vi.mock('@/preferences.js', () => ({ prefer: { s: {
	animation: false, showAvatarDecorations: true, useBlurEffect: true, dataSaver: { avatar: false },
	showingAnimatedImages: 'always', 'external.host': 'connected.test',
}, r: {} } }));
vi.mock('@/router.js', () => ({ mainRouter: { push: vi.fn() } }));
vi.mock('@/i.js', () => ({ $i: { id: 'self', policies: { canSearchNotes: true, canSearchUsers: true } }, ensureSignin: () => ({ id: 'self', username: 'self', policies: { canSearchNotes: true, canSearchUsers: true }, avatarDecorations: [] }) }));
vi.mock('@/utility/hatady-activity-actions.js', () => ({ useHatadyActivityActions: () => ({ openProfile: vi.fn(), openConversation: vi.fn(), openSession: vi.fn(), openMediaDetailById: vi.fn() }) }));
vi.mock('@/utility/hatady-record-delete.js', () => ({ confirmHatadyAction: vi.fn() }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: vi.fn() }));
vi.mock('@/instance.js', () => ({ instance: { name: 'example.test' } }));
vi.mock('@/utility/external-api.js', () => ({ getExternalEmojiUrlMapForHost: () => ({ cached: 'https://connected.test/cached.webp' }) }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => url }));
vi.mock('@/utility/scroll-to-visibility.js', async () => {
	const { ref } = await import('vue');
	return { scrollToVisibility: () => ({ showEl: ref(false) }) };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(async (endpoint: string) => endpoint === 'i/registry/keys' ? [] : endpoint === 'i/registry/get-all' ? {} : undefined) }));
vi.mock('@/utility/notification-filter.js', () => ({ NOTIFICATION_FILTER_POLICY_NOTICE_ID: 'policy' }));
vi.mock('@/i18n.js', async () => {
	const { I18n } = await import('@@/js/i18n.js');
	const { load } = await import('js-yaml');
	const readFileSync = process.getBuiltinModule('fs')!.readFileSync;
	const resolve = process.getBuiltinModule('path')!.resolve;
	return { i18n: new I18n(load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as never) };
});

// The real MFM parser selects emoji names, authors and URLs; the image leaf does not fetch during this DOM test.
vi.mock('@/components/global/MkCustomEmoji.vue', () => ({ default: {
	props: ['name', 'url', 'host'], template: '<img data-custom-emoji :alt="name" :src="url" :data-host="host"/>',
} }));
vi.mock('@/components/global/MkA.vue', () => ({ default: { props: ['to'], template: '<a :href="to"><slot/></a>' } }));
vi.mock('@/components/global/MkUrl.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkTime.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkEmoji.vue', () => ({ default: {} }));
vi.mock('@/components/MkLink.vue', () => ({ default: {} }));
vi.mock('@/components/MkMention.vue', () => ({ default: {} }));
vi.mock('@/components/MkCode.vue', () => ({ default: {} }));
vi.mock('@/components/MkCodeInline.vue', () => ({ default: {} }));
vi.mock('@/components/MkGoogle.vue', () => ({ default: {} }));
vi.mock('@/components/MkSparkle.vue', () => ({ default: {} }));
vi.mock('@/components/MkImgWithBlurhash.vue', () => ({ default: {} }));
vi.mock('@/components/MkUserOnlineIndicator.vue', () => ({ default: {} }));
vi.mock('@/components/MkFollowButton.vue', () => ({ default: {} }));
vi.mock('@/components/MkButton.vue', () => ({ default: {} }));
vi.mock('@/components/HataFeedNotificationBody.vue', () => ({ default: {} }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { props: ['reaction', 'emojiUrl'], template: '<img data-reaction :alt="reaction" :src="emojiUrl"/>' } }));

let app: App | undefined;
beforeEach(() => { prefer.s.showAvatarDecorations = true; });
afterEach(() => {
	app?.unmount();
	app = undefined;
	window.document.body.innerHTML = '';
});

const user = (host: string | null = 'author.test') => ({
	id: 'u1', username: 'sender', name: '名前 :flower:', host, avatarUrl: 'https://author.test/avatar.webp',
	avatarDecorations: [{ id: 'd', url: 'https://author.test/decoration.webp', angle: 0.2, flipH: true, offsetX: 0.1, offsetY: -0.1 }],
	emojis: { flower: 'https://author.test/name-flower.webp' },
});
const note = () => ({ id: 'n1', user: user('note.test'), text: 'こんにちは、きょうは :flower: が咲いたよ。', emojis: { flower: 'https://note.test/body-flower.webp' }, files: [] });

async function mount(component: Component, notification: unknown, popup = true) {
	const root = window.document.createElement('div');
	window.document.body.append(root);
	app = createApp({ render: () => h(component, { notification, embedded: popup, toast: popup, sourceHost: 'connected.test' }) });
	app.component('Mfm', Mfm);
	app.component('MkAvatar', MkAvatar);
	app.component('MkUserName', MkUserName);
	app.component('MkA', { props: ['to'], template: '<a :href="to"><slot/></a>' });
	app.component('MkTime', { template: '<time/>' });
	app.component('I18n', { template: '<span><slot/></span>' });
	app.directive('user-preview', {});
	app.mount(root);
	await nextTick();
	return root;
}

describe('notification custom emoji and avatar decorations', () => {
	it.each(['MkNotification.vue'])('%s: compiles the reaction image size rule to a browser selector', async (name) => {
		const filename = `src/components/${name}`;
		const source = notificationSource;
		const style = parse(source, { filename }).descriptor.styles.find(block => block.module);
		if (!style) throw new Error(`Missing notification CSS module: ${name}`);
		const compile = (content: string) => compileStyleAsync({
			source: content,
			filename,
			id: 'notification-rich-content',
			preprocessLang: 'scss',
			scoped: style.scoped,
			modules: true,
			modulesOptions: { generateScopedName: local => `notification-${local}` },
		});
		const imageRule = (css: string) => css.match(/\.notification-toastReaction img\s*\{([^}]*)\}/u)?.[1];
		// Positive control: module-only styles leave :deep untouched in emitted CSS.
		const brokenSource = style.content.replace(/(\.toastReaction\s*\{[^}]*?)\bimg\s*\{/u, '$1:deep(img) {');
		expect(brokenSource).not.toBe(style.content);
		const broken = await compile(brokenSource);
		expect(broken.errors).toEqual([]);
		expect(broken.code).toContain('.notification-toastReaction :deep(img)');
		expect(imageRule(broken.code)).toBeUndefined();

		const compiled = await compile(style.content);
		expect(compiled.errors).toEqual([]);
		expect(compiled.modules?.toastReaction).toBe('notification-toastReaction');
		const declarations = imageRule(compiled.code);
		expect(declarations).toBeDefined();
		for (const declaration of ['display: block', 'width: auto', 'height: 24px', 'max-width: 100%', 'object-fit: contain']) {
			expect(declarations).toContain(declaration);
		}
	});

	for (const [name, component] of [['standard', MkNotification]] as const) {
		it.each(['🌸', ':wide:', ':wide@remote.test:'])(`${name}: separates %s from the decorated avatar and keeps the note`, async (reaction) => {
			const reactionUrl = 'https://connected.test/wide-reaction.webp';
			const body = { ...note(), reactionEmojis: { wide: reactionUrl, 'wide@remote.test': reactionUrl } };
			const root = await mount(component, { id: 'reaction-notice', type: 'reaction', reaction, user: user(), note: body, createdAt: '2026-09-08T00:00:00Z' });
			const content = root.querySelector('[data-reaction-content="true"]');
			expect(content?.querySelectorAll('[data-reaction-chip] [data-reaction]')).toHaveLength(1);
			expect(root.querySelectorAll('[data-reaction]')).toHaveLength(1);
			const surface = root.querySelector(name === 'standard' ? '[data-toast="true"]' : '[data-embedded="true"]');
			expect(surface?.firstElementChild?.querySelector('[data-reaction]')).toBeNull();
			expect(surface?.firstElementChild?.querySelector('img[src="https://author.test/decoration.webp"]')).not.toBeNull();
			expect(content?.textContent).toContain('こんにちは、きょうは');
			expect(content?.querySelector('[data-custom-emoji]')?.getAttribute('src')).toBe('https://note.test/body-flower.webp');
			if (reaction.startsWith(':')) expect(content?.querySelector('[data-reaction]')?.getAttribute('src')).toBe(reactionUrl);
			if (name === 'standard') expect(content?.querySelector('a')?.getAttribute('href')).toBe('/notes/n1');
		});

		it(`${name}: retains the existing reaction layout outside Hataskey popups`, async () => {
			const root = await mount(component, { id: 'reaction-notice', type: 'reaction', reaction: '🌸', user: user(), note: note(), createdAt: '2026-09-08T00:00:00Z' }, false);
			expect(root.querySelector('[data-reaction-chip]')).toBeNull();
			const surface = root.querySelector(name === 'standard' ? '[data-toast="false"]' : '[data-embedded="false"]');
			expect(surface?.firstElementChild?.querySelector('[data-reaction]')).not.toBeNull();
		});
	}

	it('uses separate username and note emoji URLs in standard Hataskey notifications', async () => {
		const root = await mount(MkNotification, { id: 'notification', type: 'reply', user: user(), note: note(), createdAt: '2026-09-08T00:00:00Z' });
		expect([...root.querySelectorAll('[data-custom-emoji]')].map(el => el.getAttribute('src'))).toEqual(['https://author.test/name-flower.webp', 'https://note.test/body-flower.webp']);
		expect(root.querySelector('img[src="https://author.test/decoration.webp"]')).not.toBeNull();
		expect(root.querySelector('wbr')).not.toBeNull();
	});

});
