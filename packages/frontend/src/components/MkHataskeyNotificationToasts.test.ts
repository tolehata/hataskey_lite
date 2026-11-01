/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp as createVueApp, defineComponent, h, nextTick, provide, ref } from 'vue';
import * as Vue from 'vue';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import type { App } from 'vue';
import type { entities } from 'cherrypick-js';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey, hataskeyToastMotionEnabled, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { mainRouter } from '@/router.js';
import { popups } from '@/os.js';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import MkToast from '@/components/MkToast.vue';
import MkTimelineNewNotesContent from '@/components/MkTimelineNewNotesContent.vue';
import { createHataskeyTimelineNewNotes, useRetainedHataskeyTimelineNewNotes } from '@/utility/hataskey-timeline-new-notes.js';
import { i18n } from '@/i18n.js';
import simpleSource from '@/ui/simple.vue?raw';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: { animation: false, 'external.host': 'external.test', 'external.disableNotificationToast': false }, r: { animation: ref(false), useBlurEffect: ref(true), 'external.disableNotificationToast': ref(false) } } };
});
vi.mock('@/os.js', async () => ({ popups: (await import('vue')).ref([]), claimZIndex: () => 1000 }));
vi.mock('@/i.js', () => ({ $i: { id: 'self', username: 'self', name: '旗茶', avatarUrl: '/avatar.webp' } }));
vi.mock('@/router.js', () => ({ mainRouter: { push: vi.fn() } }));
vi.mock('@/utility/external-api.js', () => ({ getExternalEmojiUrlMapForHost: () => ({}) }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { template: '<span>reaction</span>' } }));
vi.mock('@/components/MkNotification.vue', () => ({ default: { props: ['notification'], template: '<p>{{ notification.id }}</p>' } }));
vi.mock('@/i18n.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	return { i18n: new I18n(load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as any) };
});

let app: App | undefined;
let frameCallback: FrameRequestCallback | undefined;
const note = (id: string): entities.Notification => ({ id, type: 'test', createdAt: '2026-09-07T00:00:00Z' });

// Every shell/page/popup fixture needs the globals resolved by the real toast,
// including components in inactive template branches.
function createApp(...args: Parameters<typeof createVueApp>) {
	const application = createVueApp(...args);
	application.component('Mfm', { props: ['text'], template: '<span data-test-mfm>{{ text }}</span>' });
	application.component('MkAvatar', { props: ['user'], template: '<span data-test-avatar/>' });
	application.component('MkCustomEmoji', { props: ['name', 'url'], template: '<img :src="url" :alt="`:${name}:`" data-test-emoji/>' });
	return application;
}

it('limits forced toast motion to the surface that explicitly opts in', () => {
	const regular = { active: ref(true), target: ref<HTMLElement | null>(null), outline: ref<HTMLElement | null>(null), animations: ref(true) };
	const goes = { ...regular, forceAnimations: ref(true) };
	expect(hataskeyToastMotionEnabled(regular, false, true)).toBe(false);
	expect(hataskeyToastMotionEnabled(regular, true, false)).toBe(true);
	expect(hataskeyToastMotionEnabled({ ...regular, animations: ref(false) }, true, false)).toBe(false);
	expect(hataskeyToastMotionEnabled(goes, false, true)).toBe(true);
});

beforeEach(() => {
	frameCallback = undefined;
	prefer.r.animation.value = false;
	vi.useFakeTimers();
	vi.spyOn(performance, 'now').mockReturnValue(0);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
		frameCallback = now => { vi.mocked(performance.now).mockReturnValue(now); callback(now); };
		return 1;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	// happy-dom supplies no layout. Give visible hosts/cards explicit geometry so
	// the real ring can satisfy its readiness check and expose countdown progress.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 64));
	vi.stubGlobal('ResizeObserver', class {
		observe() { /* Geometry is tested separately; happy-dom has no layout. */ }
		disconnect() { /* No browser observer is allocated. */ }
	});
	notificationToastsSuppressed.value = false;
	prefer.s['external.disableNotificationToast'] = false;
	prefer.r['external.disableNotificationToast'].value = false;
	popups.value = [];
});
afterEach(() => {
	app?.unmount();
	app = undefined;
	window.document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function mount(mobile = false, navbar = true, withNewNotes = false, preloaded = false, nativeAvailable = true) {
	const visible = ref(navbar);
	const newNotes = createHataskeyTimelineNewNotes(() => 'home');
	const owner = Symbol('home');
	const showNewNotes = vi.fn(() => newNotes.update(owner, undefined, null));
	const updateNewNotes = (count: number) => newNotes.update(owner, 'home', { text: `${count}個の新しいノートがあります`, icon: 'ti ti-arrow-up', show: showNewNotes });
	const context = createHataskeyNotificationToasts(computed(() => mobile), computed(() => visible.value || newNotes.notice.value != null), computed(() => nativeAvailable));
	if (preloaded) context.enqueue(note('preloaded'), 'local', 0);
	const bar = window.document.createElement('nav');
	const target = window.document.createElement('div');
	bar.append(target);
	window.document.body.append(bar);
	context.target.value = target;
	context.outline.value = bar;
	const root = window.document.createElement('div');
	window.document.body.append(root);
	// Compile the actual navbar row and click handler, alongside the real toast host.
	const parsed = parse(simpleSource).descriptor.template!.ast!;
	type Node = typeof parsed.children[number];

	function findRow(nodes: Node[]): string | undefined {
		for (const node of nodes) {
			if (node.type !== 1) continue;
			if (node.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.exp?.type === 4 && prop.exp.content === '$style.newNotesViewport')) return node.loc.source;
			const found = findRow(node.children);
			if (found) return found;
		}
		return undefined;
	}

	const row = findRow(parsed.children);
	if (!row) throw new Error('Missing native navbar new-notes row');
	const compiled = compileTemplate({ source: row, filename: 'simple.vue', id: 'new-notes-row', compilerOptions: { mode: 'function' } });
	if (compiled.errors.length > 0) throw new Error(String(compiled.errors));
	const handler = simpleSource.match(/function showNavbarNewNotes\(\) \{[^}]+\}/)?.[0];
	if (!handler) throw new Error('Missing native navbar new-notes handler');
	const NewNotesRow = defineComponent({
		components: { MkTimelineNewNotesContent },
		setup: () => {
			const newNotesMotionEnabled = computed(() => prefer.r.animation.value);
			const navbarNewNotesContent = useRetainedHataskeyTimelineNewNotes(newNotes.notice, newNotesMotionEnabled);
			const navbarNewNotesLabel = computed(() => navbarNewNotesContent.value?.count == null
				? navbarNewNotesContent.value?.text
				: i18n.tsx.newNoteRecivedCount({ n: navbarNewNotesContent.value.count }));
			return {
				navbarNewNotes: newNotes.notice,
				navbarNewNotesContent,
				navbarNewNotesLabel,
				newNotesMotionEnabled,
				showNavbarNewNotes: new Function('showTopBar', 'navbarNewNotes', `${handler}; return showNavbarNewNotes;`)(visible, newNotes.notice),
				isDesktop: !mobile, newNotesButtonEl: ref(null), newNotesContentEl: ref(null), newNotesFlashEl: ref(null),
			};
		},
		render: new Function('Vue', compiled.code)(Vue),
	});
	app = createApp(defineComponent({ setup: () => () => [
		h(MkHataskeyNotificationToasts, { context }),
		withNewNotes ? h(Vue.Teleport, { to: bar }, h(NewNotesRow)) : null,
	] }));
	app.config.globalProperties.$style = { newNotesViewport: 'new-notes-viewport', newNotesContent: 'new-notes-content', newNotesButton: 'new-notes-button' };
	app.mount(root);
	return { context, bar, target, visible, newNotes, updateNewNotes, showNewNotes };
}

describe('Hataskey notification host', () => {
	it.each([true, false])('renders an independent leading check and emoji image in the same navbar, then replaces it with the clock (mobile=%s)', async (mobile) => {
		const { context, target } = mount(mobile);
		context.enqueueNavbarNotice({ kind: 'emojiAdded', emoji: { id: 'added', name: 'hatakyu', url: '/emoji/hatakyu.webp' } }, 0);
		await nextTick();
		const card = target.querySelector('article');
		expect(card?.getAttribute('data-integrated')).toBe('true');
		expect(card?.getAttribute('data-navbar-notice')).toBe('true');
		const message = card?.querySelector('[data-navbar-notice-kind="emojiAdded"]');
		expect(message?.firstElementChild?.querySelector('.ti-check')).not.toBeNull();
		expect(message?.querySelector('img')?.getAttribute('src')).toBe('/emoji/hatakyu.webp');
		expect(message?.querySelector('img')?.getAttribute('alt')).toBe(':hatakyu:');
		expect(message?.querySelector('img')?.parentElement?.querySelector('.ti-check')).toBeNull();
		expect(message?.textContent).toContain('が当サーバーでお使いいただけるようになりました');
		expect(message?.textContent).toContain('サーバーで');
		expect(message?.textContent).toContain('の絵文字を使用可能に');
		context.enqueueNavbarNotice({ kind: 'hourlyTime', time: '00:00' }, 1000);
		await nextTick();
		expect(target.querySelectorAll('article')).toHaveLength(1);
		expect(target.querySelector('[data-navbar-notice-kind="hourlyTime"]')?.textContent).toBe('00:00をお知らせします');
		expect(target.querySelector('.ti-clock')).not.toBeNull();
		expect(target.querySelector('.ti-check, img')).toBeNull();
		frameCallback?.(5999);
		await nextTick();
		expect(context.items.value).toHaveLength(1);
		frameCallback?.(6000);
		await nextTick();
		expect(context.items.value).toEqual([]);
		expect(target.querySelector('article')).toBeNull();
	});
	it('keeps navbar notices integrated when scrolling hides tabs and allows manual dismissal', async () => {
		const { context, target, visible } = mount(false, false);
		context.enqueueNavbarNotice({ kind: 'hourlyTime', time: '12:00' });
		await nextTick();
		expect(visible.value).toBe(false);
		expect(target.querySelector('article')?.getAttribute('data-integrated')).toBe('true');
		(target.querySelector('button[aria-label="閉じる"]') as HTMLButtonElement).click();
		await nextTick();
		expect(context.items.value).toEqual([]);
		expect(context.integrated.value).toBe(false);
	});
	it('keeps a leaving note action in the hidden navbar host until its motion completes', async () => {
		prefer.r.animation.value = true;
		const { context, target, visible } = mount(false, false);
		context.enqueueNavbarNotice({ kind: 'noteAction', action: 'delete', message: 'ノートを削除しました' }, 0);
		await nextTick();
		expect(visible.value).toBe(false);
		const card = target.querySelector('article');
		expect(card?.getAttribute('data-integrated')).toBe('true');
		context.dismiss(context.items.value[0].id);
		await nextTick();
		expect(context.integrated.value).toBe(false);
		expect(target.querySelector('article')).toBe(card);
		expect(target.querySelector('[data-integrated="true"]')).not.toBeNull();
		expect([...window.document.body.querySelectorAll('article')].filter(item => !target.contains(item))).toHaveLength(0);
		vi.advanceTimersByTime(350);
		await nextTick();
		expect(target.querySelector('article')).toBeNull();
	});
	it.each([true, false])('renders a favorite save once in the navbar as plain text and expires it (mobile=%s)', async (mobile) => {
		const { context, target } = mount(mobile);
		const folder = '<img src=x onerror=alert(1)><b>保存先</b> $[tada :star:] あとで読み返したい大切なノート'.repeat(2);
		const message = `「${folder}」に保存しました`;
		context.enqueueStatus(message, 0, undefined, true);
		await nextTick();
		const card = target.querySelector('article');
		expect(window.document.querySelectorAll('article')).toHaveLength(1);
		expect(card?.getAttribute('data-integrated')).toBe('true');
		expect(card?.textContent).toBe(message);
		expect(card?.querySelector('img, b, script, [data-test-mfm], [data-test-avatar]')).toBeNull();
		const animation = card?.querySelector('[data-favorite-saved-animation]');
		expect(animation?.getAttribute('aria-hidden')).toBe('true');
		expect(animation?.getAttribute('data-motion')).toBe('false');
		expect(animation?.querySelector('.ti-check')).not.toBeNull();
		frameCallback?.(4999);
		await nextTick();
		expect(target.querySelector('article')).toBe(card);
		frameCallback?.(5000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		expect(target.querySelector('article')).toBeNull();
	});
	it.each([false, true])('respects reduced motion and the animation setting for favorite feedback (reduced=%s)', async (reduced) => {
		prefer.r.animation.value = true;
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: reduced, media: '(prefers-reduced-motion: reduce)', onchange: null,
			addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
		});
		const { context, target } = mount();
		context.enqueueStatus('未分類に保存しました', 0, undefined, true);
		await nextTick();
		const animation = target.querySelector('[data-favorite-saved-animation]');
		expect(animation?.getAttribute('data-motion')).toBe(String(!reduced));
		prefer.r.animation.value = false;
		await nextTick();
		expect(animation?.getAttribute('data-motion')).toBe('false');
		expect(target.querySelector('article')?.textContent).toBe('未分類に保存しました');
	});
	it('replaces welcome and ordinary notifications through the same navbar slot without leaking favorite decoration', async () => {
		const { context, target } = mount();
		if (!$i) throw new Error('Missing test account');
		context.enqueueStatus('おかえりなさい、旗茶さん :wave:', 0, $i);
		await nextTick();
		expect(target.querySelector('[data-test-avatar]')).not.toBeNull();
		expect(target.querySelector('[data-test-mfm]')).not.toBeNull();
		expect(target.querySelector('[data-favorite-saved-animation]')).toBeNull();
		context.enqueueStatus('「あとで読む」に保存しました', 1000, undefined, true);
		await nextTick();
		expect(target.querySelectorAll('article')).toHaveLength(1);
		expect(target.querySelector('[data-favorite-saved-animation]')).not.toBeNull();
		expect(target.querySelector('[data-test-avatar], [data-test-mfm]')).toBeNull();
		context.enqueue(note('new-reply'), 'local', 2000);
		await nextTick();
		expect(target.querySelectorAll('article')).toHaveLength(1);
		expect(target.querySelector('article')?.textContent).toBe('new-reply');
		expect(target.querySelector('[data-favorite-saved-animation]')).toBeNull();
		context.enqueueStatus('おかえりなさい、旗茶さん :wave:', 3000, $i);
		await nextTick();
		expect(target.querySelectorAll('article')).toHaveLength(1);
		expect(target.querySelector('[data-test-avatar]')).not.toBeNull();
		expect(target.querySelector('[data-test-mfm]')).not.toBeNull();
		expect(target.querySelector('[data-favorite-saved-animation]')).toBeNull();
	});
	it.each([true, false])('routes the boot welcome popup into the existing navbar and expires it once (mobile=%s)', async (mobile) => {
		const { context, bar } = mount(mobile);
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const closed = vi.fn();
		const message = 'おかえりなさい、旗茶さん :wave:';
		const popupApp = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message, welcome: true, onClosed: closed });
			},
		});
		try {
			popupApp.mount(root);
			await nextTick();
			expect(closed).toHaveBeenCalledTimes(1);
			expect(root.textContent).toBe('');
			expect(context.items.value).toHaveLength(1);
			expect(context.items.value[0]).toMatchObject({ source: 'status', message, welcomeUser: { id: 'self' } });
			expect(bar.querySelector('article')?.textContent).toContain(message);
			popupApp.unmount();
			// Disposing the original popup must leave ownership with the shared host.
			vi.mocked(performance.now).mockReturnValue(5000);
			await vi.advanceTimersByTimeAsync(250);
			await nextTick();
			expect(context.items.value).toHaveLength(0);
			expect(bar.querySelector('article')).toBeNull();
		} finally {
			if (root.hasChildNodes()) popupApp.unmount();
		}
	});
	it.each([true, false])('retains the standalone popup when welcome=%s has no Hataskey host', async (welcome) => {
		const root = window.document.createElement('div');
		window.document.body.append(root);
		app = createApp({ render: () => h(MkToast, { message: '表示メッセージ', welcome }) });
		app.mount(root);
		await nextTick();
		expect(root.textContent).toContain('表示メッセージ');
	});
	it('keeps welcome in the shared queue even before its navbar target mounts', async () => {
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const closed = vi.fn();
		app = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message: 'おかえりなさい :wave:', welcome: true, onClosed: closed });
			},
		});
		app.mount(root);
		await nextTick();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(root.textContent).toBe('');
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0]).toMatchObject({ source: 'status', message: 'おかえりなさい :wave:', welcomeUser: { id: 'self' } });
	});
	it.each([true, false])('routes an ordinary toast into one navbar status, then closes or expires it (mobile=%s)', async (mobile) => {
		const { context, target } = mount(mobile, false);
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const closed = vi.fn();
		const popupApp = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message: '<b>料理として記録しました</b> :wave:', icon: 'ti ti-tools-kitchen-2', onClosed: closed });
			},
		});
		try {
			popupApp.mount(root);
			await nextTick();
			expect(closed).toHaveBeenCalledTimes(1);
			expect(root.textContent).toBe('');
			expect(context.items.value).toHaveLength(1);
			expect(context.navbarNotice.value).toMatchObject({ kind: 'status', message: '<b>料理として記録しました</b> :wave:' });
			expect(target.querySelectorAll('article')).toHaveLength(1);
			expect(target.querySelector('[data-navbar-notice-kind="status"]')?.textContent).toContain('<b>料理として記録しました</b> :wave:');
			expect(target.querySelector('.ti-tools-kitchen-2')).not.toBeNull();
			expect(target.querySelector('b, [data-test-mfm]')).toBeNull();
			expect(context.integrated.value).toBe(true);
			frameCallback?.(4999);
			await nextTick();
			expect(context.items.value).toHaveLength(1);
			if (mobile) {
				frameCallback?.(5000);
				await nextTick();
				expect(context.items.value).toEqual([]);
			} else {
				(target.querySelector('button[aria-label="閉じる"]') as HTMLButtonElement).click();
				await nextTick();
				expect(context.items.value).toEqual([]);
			}
		} finally {
			popupApp.unmount();
			root.remove();
		}
	});
	it('routes a clip toast with its target into the three-second note action notice', async () => {
		const { context, target } = mount();
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const popupApp = createApp({ setup() {
			provide(hataskeyNotificationToastsKey, context);
			return () => h(MkToast, { message: 'クリップに追加しました', icon: 'clipped', target: 'あとで読む' });
		} });
		try {
			popupApp.mount(root);
			await nextTick();
			expect(context.navbarNotice.value).toEqual({ kind: 'noteAction', action: 'clip', message: 'クリップに追加しました', target: 'あとで読む' });
			expect(target.querySelector('[data-note-action-animation][data-action="clip"]')).not.toBeNull();
			expect(target.textContent).toContain('あとで読む');
			frameCallback?.(2999); await nextTick();
			expect(context.items.value).toHaveLength(1);
			frameCallback?.(3000); await nextTick();
			expect(context.items.value).toHaveLength(0);
		} finally { popupApp.unmount(); root.remove(); }
	});
	it.each(['posted', 'reply', 'renote', 'copied'])('keeps the %s icon alias in navbar status', async (icon) => {
		const { context, target } = mount();
		context.enqueueNavbarNotice({ kind: 'status', message: '保存しました', icon });
		await nextTick();
		const iconClass = { posted: 'ti-check', reply: 'ti-arrow-back-up', renote: 'ti-repeat', copied: 'ti-copy' }[icon as 'posted' | 'reply' | 'renote' | 'copied'];
		expect(target.querySelector(`[data-navbar-notice-kind="status"] .${iconClass}`)).not.toBeNull();
	});
	it('prefers the active page navbar over an injected shell navbar', async () => {
		const { context: shell } = mount();
		const page = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const pageBar = window.document.createElement('nav');
		const pageTarget = window.document.createElement('div');
		pageBar.append(pageTarget);
		window.document.body.append(pageBar);
		page.target.value = pageTarget;
		page.outline.value = pageBar;
		const release = registerNotificationPageContext(page, () => true);
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const pageApp = createApp({ render: () => h(MkHataskeyNotificationToasts, { context: page }) });
		const popupApp = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, shell);
				return () => h(MkToast, { message: 'タイマーを保存しました', icon: 'scheduled' });
			},
		});
		try {
			pageApp.mount(root);
			const popupRoot = window.document.createElement('div');
			root.append(popupRoot);
			popupApp.mount(popupRoot);
			await nextTick();
			expect(shell.items.value).toEqual([]);
			expect(page.items.value).toHaveLength(1);
			expect(pageTarget.querySelector('[data-navbar-notice-kind="status"]')?.textContent).toContain('タイマーを保存しました');
			expect(pageTarget.querySelector('.ti-calendar-time')).not.toBeNull();
		} finally {
			popupApp.unmount();
			pageApp.unmount();
			release();
			root.remove();
			pageBar.remove();
		}
	});
	it('keeps the ordinary popup when no navbar target exists', async () => {
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const root = window.document.createElement('div');
		window.document.body.append(root);
		app = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message: 'コピーしました', icon: 'copied' });
			},
		});
		app.mount(root);
		await nextTick();
		expect(root.textContent).toContain('コピーしました');
		expect(context.items.value).toHaveLength(0);
	});
	it('falls back to the popup when the desktop navbar is unavailable despite a mounted target', async () => {
		const { context, target } = mount(false, false, false, false, false);
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const popupApp = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message: 'レシピを保存しました', icon: 'ti ti-check' });
			},
		});
		try {
			popupApp.mount(root);
			await nextTick();
			expect(context.canIntegrateStatus.value).toBe(false);
			expect(root.textContent).toContain('レシピを保存しました');
			expect(context.items.value).toEqual([]);
			expect(target.querySelector('article')).toBeNull();
		} finally {
			popupApp.unmount();
			root.remove();
		}
	});
	it('uses an active page surface even when the native navbar is unavailable', async () => {
		const { context } = mount(false, false, false, false, false);
		const pageBar = window.document.createElement('nav');
		const pageTarget = window.document.createElement('div');
		pageBar.append(pageTarget);
		window.document.body.append(pageBar);
		const release = context.registerSurface({ active: ref(true), target: ref(pageTarget), outline: ref(pageBar), animations: ref(false) });
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const popupApp = createApp({
			setup() {
				provide(hataskeyNotificationToastsKey, context);
				return () => h(MkToast, { message: '料理として記録しました', icon: 'ti ti-tools-kitchen-2' });
			},
		});
		try {
			popupApp.mount(root);
			await nextTick();
			expect(context.canIntegrateStatus.value).toBe(true);
			expect(root.textContent).toBe('');
			expect(context.items.value).toHaveLength(1);
			expect(pageTarget.querySelector('[data-navbar-notice-kind="status"]')?.textContent).toContain('料理として記録しました');
		} finally {
			popupApp.unmount();
			release();
			root.remove();
			pageBar.remove();
		}
	});
	it('delivers external events only to the active page renderer and restores the native receiver on release', async () => {
		const { context: native } = mount();
		const page = createHataskeyNotificationToasts(computed(() => true), computed(() => true));
		const receiveExternal = ref(true);
		const release = registerNotificationPageContext(page, () => receiveExternal.value);
		const nativeEnqueue = vi.spyOn(native, 'enqueue');
		const pageEnqueue = vi.spyOn(page, 'enqueue');
		const root = window.document.createElement('div');
		window.document.body.append(root);
		const pageApp = createApp({ render: () => h(MkHataskeyNotificationToasts, { context: page, receiveExternal: receiveExternal.value }) });
		try {
			pageApp.mount(root);
			window.dispatchEvent(new CustomEvent('external-notification', { detail: note('page-owned') }));
			await nextTick();
			expect(nativeEnqueue).not.toHaveBeenCalled();
			expect(native.items.value).toEqual([]);
			expect(pageEnqueue).toHaveBeenCalledExactlyOnceWith(note('page-owned'), 'external', 0, 'external.test');
			expect(page.items.value).toHaveLength(1);
			expect(window.document.querySelectorAll('article')).toHaveLength(1);

			// An offscreen page keeps its renderer for status notices, but yields receipt.
			receiveExternal.value = false;
			release();
			await nextTick();
			window.dispatchEvent(new CustomEvent('external-notification', { detail: note('native-again') }));
			await nextTick();
			expect(nativeEnqueue).toHaveBeenCalledExactlyOnceWith(note('native-again'), 'external', 0, 'external.test');
			expect(native.items.value).toHaveLength(1);
			expect(pageEnqueue).toHaveBeenCalledTimes(1);
			expect(page.items.value[0]).toMatchObject({ source: 'external', notification: { id: 'page-owned' } });
		} finally {
			release();
			pageApp.unmount();
			root.remove();
		}
	});

	it('moves the same live toast into Hatask and back without restarting its clock or duplicating receipt', async () => {
		const { context, target: nativeTarget } = mount(true);
		context.enqueue(note('surface'), 'local', 0);
		await nextTick();
		const article = nativeTarget.querySelector('article');
		expect(article).not.toBeNull();
		context.tick(2100, new Set());
		const pageBar = window.document.createElement('header');
		const pageTarget = window.document.createElement('div'); pageBar.append(pageTarget); window.document.body.append(pageBar);
		const active = ref(true);
		const release = context.registerSurface({ active, target: ref(pageTarget), outline: ref(pageBar), animations: ref(false) });
		await nextTick();
		expect(pageTarget.querySelector('article')).toBe(article);
		expect(nativeTarget.querySelector('article')).toBeNull();
		expect(context.items.value[0].elapsed).toBe(2100);
		active.value = false; await nextTick();
		expect(nativeTarget.querySelector('article')).toBe(article);
		active.value = true; await nextTick();
		window.dispatchEvent(new CustomEvent('external-notification', { detail: note('external-surface') }));
		await nextTick();
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0].source).toBe('external');
		expect(pageTarget.querySelectorAll('article')).toHaveLength(1);
		release(); await nextTick();
		expect(pageTarget.querySelector('article')).toBeNull();
		expect(nativeTarget.querySelectorAll('article')).toHaveLength(1);
		context.tick(5000, new Set()); await nextTick();
		expect(nativeTarget.querySelector('article')).toBeNull();
	});

	it.each([true, false])('expires at five seconds even without animation frames (mobile=%s)', async (mobile) => {
		prefer.r.animation.value = true;
		const start = Date.now();
		vi.mocked(performance.now).mockImplementation(() => Date.now() - start);
		const { context, bar } = mount(mobile);
		context.enqueue(note('no-frames'), 'local');
		await nextTick();
		await vi.advanceTimersByTimeAsync(2000);
		expect(bar.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.6');
		await vi.advanceTimersByTimeAsync(2999);
		expect(context.items.value).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(context.items.value).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(350);
		expect(bar.querySelector('article')).toBeNull();
	});

	it('cleans up pending close and clock timers when the host unmounts', async () => {
		prefer.r.animation.value = true;
		const { context, bar } = mount(true);
		context.enqueue(note('leaving'), 'local', 0);
		await nextTick();
		context.clear();
		await nextTick();
		app?.unmount();
		app = undefined;
		await vi.advanceTimersByTimeAsync(6000);
		expect(bar.querySelector('article')).toBeNull();
		expect(context.items.value).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('starts the timer for a notification received before the host mounts', async () => {
		const { context } = mount(true, true, false, true);
		expect(requestAnimationFrame).toHaveBeenCalled();
		frameCallback?.(5000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
	});

	it('does not freeze the countdown or outline behind an unrelated popup', async () => {
		const { context, bar } = mount(true);
		popups.value = [{ id: 1, component: {}, props: {}, events: {} }];
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		frameCallback?.(2000);
		await nextTick();
		expect(bar.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.6');
		frameCallback?.(5000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		expect(bar.querySelector('article')).toBeNull();
	});

	it('does not keep touch hover or touch focus paused after tapping a notification', async () => {
		const { context, target } = mount(true);
		context.enqueue(note('touch'), 'local', 0);
		await nextTick();
		const card = target.querySelector('article');
		const button = card?.querySelector('button');
		if (!card || !button) throw new Error('Missing toast');
		vi.spyOn(button, 'matches').mockReturnValue(false); // Pointer focus has no keyboard focus ring.
		card.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
		button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await nextTick();
		frameCallback?.(5000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
	});

	it('restarts an interrupted frame request when a PWA returns to the foreground', async () => {
		const { context } = mount(true);
		const frames = new Map<number, FrameRequestCallback>();
		let sequence = 0;
		vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
			frames.set(++sequence, callback);
			return sequence;
		}));
		vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
		context.enqueue(note('resume'), 'local', 0);
		await nextTick();
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		frames.clear(); // Simulate the old frame not being delivered after suspension.
		vi.mocked(performance.now).mockReturnValue(60000);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(frames.size).toBe(1);
		const callback = frames.values().next().value;
		if (!callback) throw new Error('Missing resumed frame');
		frames.clear();
		vi.mocked(performance.now).mockReturnValue(65000);
		callback(65000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
	});

	it.each([true, false])('finishes close without waiting forever for animation frames (mobile=%s)', async (mobile) => {
		prefer.r.animation.value = true;
		const { context, updateNewNotes, bar } = mount(mobile, true, true);
		updateNewNotes(2);
		context.enqueue(note('first'), 'local', 0);
		await nextTick();
		context.enqueue(note('second'), 'local', 100);
		await nextTick();
		const button = bar.querySelector<HTMLButtonElement>(`article[data-toast-id="${context.items.value[0].id}"] > button`);
		if (!button) throw new Error('Missing current close button');
		button.click();
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		// No rAF or transitionend is delivered, even for the outgoing replaced card.
		await vi.advanceTimersByTimeAsync(500);
		expect(bar.querySelector('article')).toBeNull();
		expect(bar.querySelector('svg')).toBeNull();
		expect(bar.querySelector('.new-notes-button')?.textContent).toContain('2個');
	});

	it.each([true, false])('removes animated notifications on timeout and close (navbar=%s)', async (navbar) => {
		prefer.r.animation.value = true;
		const start = Date.now();
		vi.mocked(performance.now).mockImplementation(() => Date.now() - start);
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
		vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
		const { context } = mount(false, navbar);
		context.enqueue(note('expires'), 'local');
		await nextTick();
		expect(window.document.querySelector('article')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(6000);
		expect(context.items.value).toHaveLength(0);
		expect(window.document.querySelector('article')).toBeNull();
		context.enqueue(note('close'), 'local');
		await nextTick();
		const closeButton = window.document.querySelector<HTMLButtonElement>('article > button');
		if (!closeButton) throw new Error('Missing notification close button');
		closeButton.click();
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1000);
		expect(window.document.querySelector('article')).toBeNull();
	});

	it.each([true, false])('keeps new notes after a simultaneous toast expires without restarting its timer (mobile=%s)', async (mobile) => {
		const { context, bar, target, updateNewNotes } = mount(mobile, true, true);
		updateNewNotes(3);
		context.enqueue(note('simultaneous'), 'local', 0);
		await nextTick();
		expect(target.querySelector('article')).not.toBeNull();
		expect(bar.querySelector('.new-notes-button')?.textContent).toContain('3個');
		frameCallback?.(2000);
		updateNewNotes(9);
		await nextTick();
		frameCallback?.(5000);
		await nextTick();
		expect(target.querySelector('article')).toBeNull();
		expect(bar.querySelector('.new-notes-button')?.textContent).toContain('9個');
		expect(bar.querySelector('.new-notes-viewport')?.getAttribute('data-active')).toBe('true');
	});

	it('keeps a simultaneous toast in the navbar when the new-notes action clears the queue', async () => {
		const { context, bar, target, visible, updateNewNotes, showNewNotes } = mount(false, false, true);
		updateNewNotes(4);
		context.enqueue(note('still-visible'), 'local', 0);
		await nextTick();
		const card = target.querySelector('article');
		expect(card).not.toBeNull();
		frameCallback?.(1000);
		bar.querySelector<HTMLButtonElement>('.new-notes-button')?.click();
		await nextTick();
		expect(showNewNotes).toHaveBeenCalledOnce();
		expect(visible.value).toBe(true);
		expect(bar.querySelector('.new-notes-viewport')?.getAttribute('data-active')).toBe('false');
		expect(target.querySelector('article')).toBe(card);
		frameCallback?.(3000);
		expect(context.items.value[0].elapsed).toBe(3000);
	});

	it('teleports the same card between the navbar and desktop corner without restarting it', async () => {
		const { context, target, visible, bar } = mount();
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		const card = target.querySelector('article');
		expect(card).not.toBeNull();
		expect(bar.querySelectorAll('svg path')).toHaveLength(2);
		frameCallback?.(2000);
		await nextTick();
		visible.value = false;
		await nextTick();
		expect(target.querySelector('article')).toBeNull();
		expect(window.document.querySelector('article')).toBe(card);
		expect(card?.querySelectorAll('svg path')).toHaveLength(1);
		expect(context.items.value[0].elapsed).toBe(2000);
		frameCallback?.(5000);
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		expect(window.document.querySelector('article')).toBeNull();
	});
	it('keeps mobile notifications integrated even away from a timeline and replaces local with external', async () => {
		const { context, target } = mount(true, false);
		context.enqueue(note('flower'), 'local', 0);
		await nextTick();
		window.dispatchEvent(new CustomEvent('external-notification', { detail: note('remote') }));
		await nextTick();
		expect(context.items.value.map(item => item.source)).toEqual(['external']);
		expect(target.querySelectorAll('article')).toHaveLength(1);
		expect(target.textContent).toContain('外部通知');
		expect(target.textContent).toContain('external.test');
		(target.querySelector('[role=link]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await nextTick();
		expect(mainRouter.push).toHaveBeenCalledWith('/my/external-notifications');
		expect(context.items.value).toHaveLength(0);
	});
	it('pauses on hover and focus, then resumes with the remaining time', async () => {
		const { context, target } = mount();
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		const card = target.querySelector('article')!;
		card.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
		await nextTick();
		frameCallback?.(4000);
		expect(context.items.value[0].elapsed).toBe(0);
		card.dispatchEvent(new Event('pointerleave'));
		vi.spyOn(card, 'matches').mockReturnValue(true); // Keyboard focus.
		card.dispatchEvent(new FocusEvent('focusin'));
		await nextTick();
		frameCallback?.(7000);
		expect(context.items.value[0].elapsed).toBe(0);
		card.dispatchEvent(new FocusEvent('focusout'));
		await nextTick();
		frameCallback?.(11999);
		expect(context.items.value).toHaveLength(1);
		frameCallback?.(12000);
		expect(context.items.value).toHaveLength(0);
	});
	it('clears suppressed toasts and respects the external-notification switch', async () => {
		const { context } = mount();
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		notificationToastsSuppressed.value = true;
		await nextTick();
		expect(context.items.value).toHaveLength(0);
		window.dispatchEvent(new CustomEvent('external-notification', { detail: note('suppressed') }));
		expect(context.items.value).toHaveLength(0);
		notificationToastsSuppressed.value = false;
		prefer.s['external.disableNotificationToast'] = true;
		window.dispatchEvent(new CustomEvent('external-notification', { detail: note('disabled') }));
		expect(context.items.value).toHaveLength(0);
	});

	it('discards suspended background time', async () => {
		const { context } = mount();
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		frameCallback?.(2000);
		vi.mocked(performance.now).mockReturnValue(2000);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		vi.mocked(performance.now).mockReturnValue(20000);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		frameCallback?.(21000);
		expect(context.items.value[0].elapsed).toBe(3000);
		frameCallback?.(23000);
		expect(context.items.value).toHaveLength(0);
	});

	it('uses a stepped countdown when animation is disabled and removes listeners on unmount', async () => {
		const { context, bar } = mount();
		context.enqueue(note('local'), 'local', 0);
		await nextTick();
		frameCallback?.(1499);
		await nextTick();
		expect(bar.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.8');
		app?.unmount();
		app = undefined;
		window.dispatchEvent(new CustomEvent('external-notification', { detail: note('after-unmount') }));
		expect(context.items.value).toHaveLength(0);
		expect(context.height.value).toBe(0);
	});
});
