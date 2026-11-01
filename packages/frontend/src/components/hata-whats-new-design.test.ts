/* SPDX-License-Identifier: AGPL-3.0-only */
/* eslint-disable vue/one-component-per-file -- Test-only modal and global display components. */
import fs from 'node:fs';
import path from 'node:path';
import { compileStyleAsync } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, computed, ref as createRef } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkHataWhatsNew from './MkHataWhatsNew.vue';
import HataFeedHome from './HataFeedHome.vue';
import HataigoShowcase from './hata-whats-new/HataigoShowcase.vue';
import type { Locale } from '../../../../locales/index.js';
import type * as Misskey from 'cherrypick-js';
import type { App, PropType } from 'vue';
import type { HataFeedHomeIssue, HataFeedHomeActivity } from '@/utility/hatafeed-home.js';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyNotice, hatadyNotify } from '@/utility/hatady-ui.js';
import { createHataskeyNotificationToasts, getNotificationPageContext, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { hataFeedNotify, registerHataFeedNoticeHost } from '@/utility/hatafeed-ui.js';
import { getHataWhatsNewStories, HATA_WHATS_NEW } from '@/utility/hata-whats-new.js';

vi.mock('@/i18n.js', async () => {
	const { I18n } = await import('@@/js/i18n.js');
	const yaml = await import('js-yaml');
	return { i18n: new I18n<Locale>(yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Locale) };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false), darkMode: ref(false), useBlurEffect: ref(false), 'external.disableNotificationToast': ref(false) }, s: { animation: false }, commit: vi.fn() } };
});
vi.mock('@/utility/hatady-prefs.js', async () => { const { ref } = await import('vue'); return { hatadyTheme: ref('light') }; });
vi.mock('@/store.js', async () => { const { ref } = await import('vue'); return { store: { r: { darkMode: ref(false) } } }; });
vi.mock('@/i.js', () => ({ $i: { id: 'actual-user' }, iAmModerator: false }));
vi.mock('@/events.js', () => ({ globalEvents: { on: vi.fn(), off: vi.fn() } }));
vi.mock('@/os.js', () => ({ toast: vi.fn(), popup: vi.fn(() => ({ dispose: vi.fn() })) }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(() => { throw new Error('Introductions must not request real records'); }) }));
vi.mock('@/utility/hatakyu-assets.js', () => ({ useHatakyuBranding: () => true, hatakyuAssetUrl: (key: string) => `/client-assets/hatakyu/${key}.png` }));
vi.mock('@/components/MkHatakyuIllustration.vue', () => ({ default: { template: '<img alt="" data-mascot>' } }));
vi.mock('./hatagoes/motion/HatagoesMergeMotion.vue', () => ({ default: { props: ['active', 'loop'], template: '<div :data-merge-active="active">HataGoes Merge</div>' } }));
const routerPush = vi.hoisted(() => vi.fn());
vi.mock('@/router.js', () => ({ mainRouter: { pushByPath: routerPush } }));
vi.mock('@/components/HyDialog.vue', () => ({ default: { setup() { throw new Error('A decorative preview opened a live dialog'); } } }));
vi.mock('@/components/MkHataskeyNotificationToasts.vue', () => ({ default: { setup() { throw new Error('A decorative preview started a live receiver'); } } }));
vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent: createComponent, h: render, onMounted } = await import('vue');
	return { default: createComponent({
		props: { motionPreset: String },
		emits: ['closed', 'close', 'esc', 'click', 'opened'],
		setup(props, { slots, emit, expose }) {
			// eslint-disable-next-line id-denylist -- Existing MkModal public method.
			expose({ close() {
				modalCloseCalls++;
				emit('close');
				if (deferModalClose) modalFinishClose = () => emit('closed');
				else emit('closed');
			} });
			modalOpened = () => emit('opened');
			onMounted(() => { if (autoOpen) modalOpened(); });
			return () => render('div', { 'data-modal': true, 'data-motion-preset': props.motionPreset, onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('click'); }, onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') emit('esc'); } }, slots.default?.());
		},
	}) };
});

let app: App | undefined, host: HTMLDivElement;
let bodyHeight: number, width: number, hidden: boolean;
let motions: Array<{ element: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: () => void; finish: () => void; done: boolean }>;
let motionListeners: Set<() => void>;
let animateDescriptor: PropertyDescriptor | undefined;
let reduced: boolean;
let cleanups: Array<() => void>;
let errors: string[];
let autoOpen: boolean;
let modalOpened: () => void;
let modalFinishClose: () => void;
let modalCloseCalls: number;
let deferModalClose: boolean;
let closed: ReturnType<typeof vi.fn>;

const twoPageIds = ['hataigo', 'release-notes'];

const user: Misskey.entities.UserLite = { id: 'intro-sample-owner', name: 'こはる', username: 'koharu', host: null, avatarUrl: '', avatarBlurhash: null, avatarDecorations: [], isLocked: false, emojis: {}, onlineStatus: 'unknown' };
const date = new Date(2026, 8, 14, 10, 24).toISOString();
const sampleIssues: HataFeedHomeIssue[] = [
	{ id: 'intro-feed-1', number: 42, title: '小さな画面でも、予定を見やすく', category: 'improvement', status: 'inProgress', commentsCount: 3, agreementsCount: 8 },
	{ id: 'intro-feed-2', number: 43, title: '本棚の絞り込み条件を覚えてほしい', category: 'featureRequest', status: 'open', commentsCount: 2, agreementsCount: 5 },
	{ id: 'intro-feed-3', number: 44, title: 'イシュー検索を使いやすく', category: 'improvement', status: 'planned', commentsCount: 1, agreementsCount: 4 },
].map(issue => ({ ...issue, createdBy: user, createdAt: date, pinned: false, closed: false, assignees: [] })) as HataFeedHomeIssue[];
const sampleRequests: HataFeedEmojiRequest[] = ['hatakyu', 'hatakyu_yay'].map((name, index) => ({ id: `intro-emoji-${index}`, name, status: index ? 'approved' : 'pending', createdAt: date, imageUrl: '/client-assets/hatakyu/treasureFound.png', requestedBy: user, category: null, aliases: [], license: 'AGPL-3.0-only', localOnly: false, isSensitive: false, sourceType: 'upload', originalUrl: null, remoteHost: null, resolvedComment: null, resolvedById: null, resolvedAt: null, resolvedEmojiId: null }));
const sampleActivity: HataFeedHomeActivity[] = [
	{ key: 'intro-feed-activity-1', user, verb: 'がコメントしました', label: sampleIssues[0].title, issueId: sampleIssues[0].id, time: date },
	{ key: 'intro-feed-activity-2', user: { ...user, id: 'intro-feed-aoi', name: 'あおい' }, verb: 'が報告しました', label: sampleIssues[1].title, issueId: sampleIssues[1].id, time: date },
];

async function flush() { for (let i = 0; i < 10; i++) await nextTick(); }

async function finishMotion() { for (let i = 0; i < 5; i++) { for (const item of motions) item.finish(); await flush(); } }

function globals(instance: App) {
	instance.component('MkTime', defineComponent({ props: { time: { type: [String, Date, Number], required: true } }, setup: props => () => h('time', { datetime: String(props.time) }, 'きょう') }));
	instance.component('MkUserName', defineComponent({ props: { user: { type: Object as PropType<{ name?: string }>, required: true } }, setup: props => () => h('span', props.user.name) }));
	instance.component('MkAvatar', defineComponent({ props: { user: { type: Object as PropType<{ name?: string }>, required: true } }, setup: () => () => h('span', '人') }));
	instance.config.errorHandler = error => errors.push(String(error));
	instance.config.warnHandler = warning => errors.push(warning);
}

async function mount() { app = createApp(MkHataWhatsNew, { onClosed: closed }); globals(app); app.mount(host); await flush(); }

function requiredElement<T extends Element = HTMLElement>(selector: string, parent: Element = host): T {
	const element = parent.querySelector<T>(selector);
	if (!element) throw new Error(`Missing element: ${selector}`);
	return element;
}

async function next() { requiredElement<HTMLButtonElement>('[aria-label="次へ"]').click(); await flush(); }

// The shipped notice has one page. Paging and the HataIgo showcase remain supported, so keep them on a two-page fixture.
function withHataigoPage() {
	const groups = HATA_WHATS_NEW.groups;
	HATA_WHATS_NEW.groups = [{ label: 'HataIgo', title: '一局、打ちませんか。', feature: 'hataigo', cards: [{ id: 'hataigo', label: 'HataIgo', icon: 'ti ti-circles', title: 'HataIgo' }] }, ...groups];
	cleanups.push(() => { HATA_WHATS_NEW.groups = groups; });
}

beforeEach(() => {
	bodyHeight = 600; width = 870; hidden = false; reduced = false; errors = []; cleanups = [];
	autoOpen = true;
	deferModalClose = false; modalCloseCalls = 0; modalFinishClose = () => {};
	closed = vi.fn();
	motionListeners = new Set(); motions = [];
	vi.clearAllMocks();
	prefer.r.animation.value = false; store.r.darkMode.value = false; hatadyNotice.value = null;
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, cb: () => void) => motionListeners.add(cb), removeEventListener: (_: string, cb: () => void) => motionListeners.delete(cb) }));
	vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.getAttribute('role') === 'region' ? bodyHeight : 350; });
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(780);
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1100);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 350));
	animateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
	Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, writable: true, value: function (this: HTMLElement, frames: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
		let resolve: () => void;
		const finished = new Promise<void>(done => { resolve = done; });
		const item = { element: this, frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, done: false, cancel: () => { item.done = true; resolve(); }, finish: () => { item.done = true; resolve(); } };
		motions.push(item); return { finished, cancel: item.cancel } as unknown as Animation;
	} });
	host = window.document.createElement('div'); window.document.body.append(host);
});
afterEach(async () => {
	app?.unmount(); app = undefined; await flush(); host.remove(); cleanups.forEach(cleanup => cleanup());
	if (animateDescriptor) Object.defineProperty(HTMLElement.prototype, 'animate', animateDescriptor);
	else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
	expect(errors).toEqual([]);
	expect(motionListeners.size).toBe(0);
	vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('production update introduction', () => {
	test('Introduce completes before the first story mounts and does not replay while paging', async () => {
		withHataigoPage();
		prefer.r.animation.value = true;
		autoOpen = false;
		await mount();
		expect(motions).toEqual([]);
		expect(host.querySelector('[data-story]')).toBeNull();
		modalOpened(); await flush();
		const shell = requiredElement('[data-release-opening-shell]');
		const opening = requiredElement('[data-release-opening]');
		expect(shell.getAttribute('data-opening')).toBe('true');
		expect(requiredElement('[data-opening-word]').textContent).toBe('Introduce');
		expect(opening.getAttribute('aria-hidden')).toBe('true');
		expect(opening.hasAttribute('inert')).toBe(true);
		expect(requiredElement('footer').hasAttribute('inert')).toBe(true);
		expect(host.querySelector('[data-story]')).toBeNull();
		expect(motions.some(item => item.element.tagName === 'HEADER')).toBe(false);
		const word = motions.find(item => item.element.hasAttribute('data-opening-word'));
		const surface = motions.find(item => item.element.hasAttribute('data-opening-surface'));
		expect(word).toBeDefined(); expect(surface).toBeDefined();
		expect(motions.every(item => opening.contains(item.element))).toBe(true);
		expect(word?.frames.some(frame => Number(frame.opacity) === 1)).toBe(true);
		expect(word?.frames.at(-1)).toMatchObject({ opacity: 0 });
		expect(word?.options).toMatchObject({ iterations: 1, duration: 2200, easing: 'linear' });
		expect(word?.frames[1]).toMatchObject({ offset: .18, opacity: 1, transform: 'scale(1)', letterSpacing: '-.04em', filter: 'blur(0px)' });
		expect(word?.frames[2]).toMatchObject({ offset: .64, opacity: 1, transform: 'scale(1)', letterSpacing: '-.04em', filter: 'blur(0px)' });
		word?.finish(); await flush();
		expect(host.querySelector('[data-story]')).toBeNull();
		surface?.finish(); await flush();
		expect(requiredElement('[data-release-opening-shell]')).toBe(shell);
		expect(shell.getAttribute('data-opening')).toBe('false');
		expect(motions.find(item => item.element.tagName === 'HEADER')?.frames[0]).toMatchObject({ opacity: 0 });
		expect(host.querySelector('[data-release-opening]')).toBeNull();
		expect(requiredElement('footer').hasAttribute('inert')).toBe(false);
		expect(host.querySelector('[data-story] h2')).not.toBeNull();
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
		await finishMotion();
		await next(); await finishMotion();
		requiredElement<HTMLButtonElement>('[aria-label="戻る"]').click(); await finishMotion();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('data-page')).toBe('1');
		expect(motions.filter(item => item.element.hasAttribute('data-opening-word'))).toHaveLength(1);
	});
	test.each(['programmatic close', 'Escape'])('closing via %s during Introduce never reveals a late story', async (method) => {
		prefer.r.animation.value = true;
		await mount();
		expect(host.querySelector('[data-release-opening]')).not.toBeNull();
		expect(motions.some(item => !item.done)).toBe(true);
		if (method === 'programmatic close') requiredElement<HTMLButtonElement>('[aria-label="更新案内を閉じる"]').click();
		else requiredElement('[data-modal]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await flush();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(motions.every(item => item.done)).toBe(true);
		const count = motions.length;
		await finishMotion();
		expect(host.querySelector('[data-release-opening]')).toBeNull();
		expect(host.querySelector('[data-story]')).toBeNull();
		expect(motions.length).toBe(count);
	});
	test.each(['preference', 'reduced', 'hidden'])('%s initially skips Introduce and immediately makes the first page usable', async (setting) => {
		withHataigoPage();
		prefer.r.animation.value = setting !== 'preference'; reduced = setting === 'reduced'; hidden = setting === 'hidden';
		await mount();
		expect(host.querySelector('[data-release-opening]')).toBeNull();
		expect(requiredElement('[data-release-opening-shell]').getAttribute('data-opening')).toBe('false');
		expect(requiredElement('footer').hasAttribute('inert')).toBe(false);
		expect(requiredElement<HTMLButtonElement>('[aria-label="次へ"]').disabled).toBe(false);
		expect(motions).toEqual([]);
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
	});
	test.each(['reduced', 'hidden'])('%s during Introduce settles to readable content without replaying on return', async (setting) => {
		withHataigoPage();
		prefer.r.animation.value = true;
		await mount();
		expect(host.querySelector('[data-release-opening]')).not.toBeNull();
		expect(motions.some(item => !item.done)).toBe(true);
		if (setting === 'reduced') { reduced = true; motionListeners.forEach(listener => listener()); } else { hidden = true; window.document.dispatchEvent(new Event('visibilitychange')); }
		await flush();
		expect(motions.every(item => item.done)).toBe(true);
		expect(host.querySelector('[data-release-opening]')).toBeNull();
		expect(host.querySelector('[data-story] h2')).not.toBeNull();
		expect(requiredElement('footer').hasAttribute('inert')).toBe(false);
		const count = motions.length;
		reduced = false; hidden = false;
		motionListeners.forEach(listener => listener()); window.document.dispatchEvent(new Event('visibilitychange')); await flush();
		expect(motions.length).toBe(count);
		expect(requiredElement<HTMLButtonElement>('[aria-label="次へ"]').disabled).toBe(false);
	});
	test('unmount during Introduce releases effects without starting content entrance', async () => {
		prefer.r.animation.value = true;
		await mount();
		expect(motions.some(item => !item.done)).toBe(true);
		const count = motions.length;
		app?.unmount(); app = undefined; await flush();
		expect(motions.every(item => item.done)).toBe(true);
		await finishMotion();
		expect(motions.length).toBe(count);
		expect(host.querySelector('[data-story]')).toBeNull();
	});
	test('the shipped single page keeps focus and finishes with the release-notes link', async () => {
		await mount();
		expect(host.querySelector('#hata-whats-new-title')?.textContent).toBe('今回の更新内容(hata-13.0)');
		expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('release-notes');
		expect(requiredElement('[data-story] h2').textContent).toBe('詳しくはリリースノートをご確認ください');
		const link = requiredElement<HTMLAnchorElement>('[data-story] a');
		expect(link.href).toBe('https://github.com/tolehata/hataskey/blob/master/HATA-CHANGELOG.md#hata-130');
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		expect(host.querySelector('footer')?.textContent).toContain('1 / 1');
		expect(host.querySelector('[aria-label="次へ"]')).toBeNull();
		expect(host.querySelector('[aria-label="戻る"]')).toBeNull();
		expect(requiredElement<HTMLButtonElement>('footer > button:last-child').textContent).toContain('わかった');
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
	});

	test('a two-page notice shows the HataIgo showcase before the release-notes link', async () => {
		withHataigoPage();
		await mount();
		expect(requiredElement('[data-story] h2').textContent).toBe('一局、打ちませんか。');
		const showcase = requiredElement('[data-hataigo-showcase]');
		expect(showcase.getAttribute('data-reveal')).toBe('stage');
		expect(showcase.textContent).toContain('囲碁を、Hataskeyで。');
		for (const mode of ['ひとりで並べる', 'AIと打つ', '人と打つ']) expect(showcase.textContent).toContain(mode);
		// Motion is off here, so the decorative board shows the whole sequence at rest.
		expect(showcase.querySelectorAll('svg [data-color]')).toHaveLength(16);
		await next();
		expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('release-notes');
		expect(requiredElement('[data-story] h2').textContent).toBe('詳しくはリリースノートをご確認ください');
		const link = requiredElement<HTMLAnchorElement>('[data-story] a');
		expect(link.href).toBe('https://github.com/tolehata/hataskey/blob/master/HATA-CHANGELOG.md#hata-130');
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
	});

	test.each([600, 380])('two pages preserve live notification ownership at body height %s', async height => {
		withHataigoPage();
		bodyHeight = height;
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
		cleanups.push(registerNotificationPageContext(context, () => true));
		const received = vi.fn(); cleanups.push(registerHataFeedNoticeHost({ active: () => true, notify: received }));
		const save = vi.spyOn(localStorage, 'setItem');
		await mount();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('hata-whats-new-title');
		expect(host.querySelector('#hata-whats-new-title')?.textContent).toBe('今回の更新内容(hata-13.0)');
		expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('hataigo');
		expect(host.querySelector('[aria-label="戻る"]')).toBeNull();
		store.r.darkMode.value = true; await flush();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('data-mode')).toBe('dark');
		hatadyNotify('実際の画面への通知');
		const notice = hatadyNotice.value;
		const seen: string[] = [];
		for (let pageNumber = 1; pageNumber <= 2; pageNumber++) {
			expect(requiredElement('[data-story]').getAttribute('data-story')).toBe('updates');
			expect(host.querySelector('footer')?.textContent).toContain(`${pageNumber} / 2`);
			seen.push(requiredElement('[data-summary]').getAttribute('data-summary') ?? '');
			expect(host.querySelector('[data-theme-choice], [data-hy-entrance], [data-hatafeed-home-panel], [data-hataintro-canvas]')).toBeNull();
			expect(hatadyNotice.value).toBe(notice);
			expect(getNotificationPageContext()).toBe(context);
			if (pageNumber === 1) { requiredElement<HTMLElement>('[role="region"]').scrollTop = 72; await next(); expect(requiredElement<HTMLElement>('[role="region"]').scrollTop).toBe(0); }
		}
		expect(seen).toEqual(twoPageIds);
		expect(host.querySelector('[aria-label="次へ"]')).toBeNull();
		hataFeedNotify('本体での更新'); expect(received).toHaveBeenCalledWith('本体での更新');
		expect(closed).not.toHaveBeenCalled();
		requiredElement<HTMLButtonElement>('[aria-label="戻る"]').click(); await flush();
		expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('hataigo');
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
		expect(host.querySelector('[aria-label="戻る"]')).toBeNull();
		expect(misskeyApi).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(prefer.commit).not.toHaveBeenCalled();
	});

	test('resizing keeps the same two pages and active story', async () => {
		withHataigoPage();
		bodyHeight = 380; width = 390;
		await mount();
		for (const height of [600, 469, 470, 380]) {
			bodyHeight = height; window.dispatchEvent(new Event('resize')); await flush();
			expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('hataigo');
			expect(host.querySelector('footer')?.textContent).toContain('/ 2');
		}
		await next();
		for (const height of [600, 380]) {
			bodyHeight = height; window.dispatchEvent(new Event('resize')); await flush();
			expect(requiredElement('[data-summary]').getAttribute('data-summary')).toBe('release-notes');
			expect(host.querySelector('footer')?.textContent).toContain('/ 2');
		}
	});

	test('finishing the notice emits closed once and leaves persistence to the caller', async () => {
		const save = vi.spyOn(localStorage, 'setItem');
		await mount();
		for (let pageNumber = 1; pageNumber < getHataWhatsNewStories().length; pageNumber++) await next();
		expect(closed).not.toHaveBeenCalled();
		const finish = requiredElement<HTMLButtonElement>('footer > button:last-child');
		expect(finish.textContent).toContain('わかった');
		finish.click(); await flush();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(host.querySelector('[data-story]')).toBeNull();
		finish.click();
		requiredElement('[data-modal]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flush();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(save).not.toHaveBeenCalled();
	});
	test.each(['finish', 'close button', 'Escape', 'outside click'])('%s retains the story through the dissolve until the modal reports closed', async method => {
		prefer.r.animation.value = true;
		deferModalClose = true;
		await mount(); await finishMotion();
		if (method === 'finish') {
			while (host.querySelector('[aria-label="次へ"]')) { await next(); await finishMotion(); }
			requiredElement<HTMLButtonElement>('footer > button:last-child').click();
		} else if (method === 'close button') {
			requiredElement<HTMLButtonElement>('[aria-label="更新案内を閉じる"]').click();
		} else if (method === 'Escape') {
			requiredElement('[data-modal]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		} else {
			requiredElement('[data-modal]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		await flush();
		expect(requiredElement('[data-modal]').getAttribute('data-motion-preset')).toBe('dissolve');
		expect(requiredElement('[data-story]')).toBeTruthy();
		expect(requiredElement('[data-release-opening-shell]').hasAttribute('inert')).toBe(true);
		expect(requiredElement('[data-release-opening-shell]').getAttribute('aria-hidden')).toBe('true');
		expect(closed).not.toHaveBeenCalled();
		requiredElement<HTMLButtonElement>('[aria-label="更新案内を閉じる"]').click();
		requiredElement('[data-modal]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		requiredElement('[data-modal]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(modalCloseCalls).toBe(1);
		modalFinishClose(); await flush();
		expect(host.querySelector('[data-story]')).toBeNull();
		expect(closed).toHaveBeenCalledTimes(1);
	});
	test.each(['preference', 'reduced', 'hidden'])('%s disables modal motion for the update notice', async setting => {
		withHataigoPage();
		prefer.r.animation.value = setting !== 'preference'; reduced = setting === 'reduced'; hidden = setting === 'hidden';
		await mount();
		expect(requiredElement('[data-modal]').getAttribute('data-motion-preset')).toBe('none');
		expect(requiredElement('[data-hataigo-showcase]').querySelectorAll('svg [data-color]')).toHaveLength(16);
	});
	test('the HataIgo start button closes the notice once and opens HataIgo', async () => {
		withHataigoPage();
		routerPush.mockClear();
		await mount();
		const start = [...host.querySelectorAll<HTMLButtonElement>('[data-hataigo-showcase] button')].find(button => button.textContent.includes('HataIgoをはじめる'));
		expect(start).toBeDefined();
		start?.click(); await flush();
		expect(closed).toHaveBeenCalledTimes(1);
		// The router is imported lazily on click, so wait for that module to resolve.
		await vi.waitFor(() => expect(routerPush).toHaveBeenCalledExactlyOnceWith('/hataigo'));
		expect(host.querySelector('[data-story]')).toBeNull();
	});
	test('the HataIgo board places stones one by one only while animated and releases its timer', async () => {
		vi.useFakeTimers();
		try {
			const animate = createRef(true);
			app = createApp(defineComponent({ setup: () => () => h(HataigoShowcase, { animate: animate.value }) }));
			globals(app); app.mount(host); await flush();
			const stones = () => host.querySelectorAll('svg [data-color]').length;
			expect(stones()).toBe(0);
			vi.advanceTimersByTime(560); await flush();
			expect(stones()).toBe(1);
			expect(host.querySelector('svg [data-color]')?.getAttribute('data-color')).toBe('black');
			vi.advanceTimersByTime(560); await flush();
			expect(stones()).toBe(2);
			animate.value = false; await flush();
			expect(stones()).toBe(16);
			expect(vi.getTimerCount()).toBe(0);
			animate.value = true; await flush();
			expect(stones()).toBe(0);
			app.unmount(); app = undefined;
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
	test('back/forward labels stay accessible while visible buttons are icons, and motion stops on close', async () => {
		withHataigoPage();
		prefer.r.animation.value = true;
		await mount(); await finishMotion();
		expect(motions.length).toBeGreaterThan(0);
		requiredElement<HTMLButtonElement>('[aria-label="次へ"]').click(); await finishMotion();
		expect(host.querySelector('[aria-label="戻る"]')?.textContent.trim()).toBe('');
		expect(host.querySelector('[aria-label="次へ"]')).toBeNull();
		expect(window.document.activeElement).toBe(host.querySelector('[data-story] h2'));
		requiredElement<HTMLButtonElement>('[aria-label="更新案内を閉じる"]').click();
		await finishMotion();
		expect(host.querySelector('[data-story]')).toBeNull();
		expect(motions.every(item => item.done)).toBe(true);
	});
	test('reduced motion and a hidden document settle finite entrances without replay loops', async () => {
		withHataigoPage();
		prefer.r.animation.value = true;
		await mount();
		reduced = true; motionListeners.forEach(listener => listener()); await flush();
		expect(motions.every(item => item.done)).toBe(true);
		const count = motions.length;
		reduced = false; motionListeners.forEach(listener => listener()); await flush();
		expect(motions.length).toBe(count);
		requiredElement<HTMLButtonElement>('[aria-label="次へ"]').click(); await finishMotion();
		hidden = true; window.document.dispatchEvent(new Event('visibilitychange')); await flush();
		expect(motions.every(item => item.done)).toBe(true);
		requiredElement('[data-modal]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flush();
		expect(host.querySelector('[data-story]')).toBeNull();
	});
	test('the extracted live HataFeed home still routes user actions through its owner', async () => {
		const issue = vi.fn(), navigate = vi.fn(), approve = vi.fn(), ownHistory = vi.fn();
		app = createApp(HataFeedHome, { isStaff: true, roadmap: sampleIssues, ownEmojiRequests: sampleRequests, emojiRequests: sampleRequests, emojiQuota: null, activity: sampleActivity, issues: sampleIssues, onIssue: issue, onNavigate: navigate, onApprove: approve, onOwnHistory: ownHistory });
		globals(app); app.mount(host); await flush();
		const button = (text: string) => {
			const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent.includes(text));
			if (!found) throw new Error(`Missing button: ${text}`);
			return found;
		};
		button('小さな画面でも、予定を見やすく').click(); expect(issue).toHaveBeenCalledWith(sampleIssues[0].id);
		button('すべての予定').click(); expect(navigate).toHaveBeenCalledWith('roadmap');
		button('一覧を見る').click(); expect(navigate).toHaveBeenCalledWith('issues');
		button('自身の絵文字管理へ→').click(); expect(ownHistory).toHaveBeenCalled();
		const pending = [...host.querySelectorAll('section')].find(section => section.textContent.includes('確認待ちの絵文字'));
		expect(pending).toBeDefined();
		requiredElement<HTMLButtonElement>('button', pending).click(); expect(approve).toHaveBeenCalledWith(sampleRequests[0]);
	});
	test('all CSS Module references resolve and the header uses balanced columns inside a centered panel', async () => {
		const folder = path.join(process.cwd(), 'src/components');
		const css = fs.readFileSync(path.join(folder, 'hata-whats-new/release.module.css'), 'utf8');
		const compiled = await compileStyleAsync({ source: css, filename: 'release.module.css', id: 'release', modules: true });
		expect(compiled.errors).toEqual([]);
		const sources = fs.readFileSync(path.join(folder, 'MkHataWhatsNew.vue'), 'utf8');
		const missing = (source: string) => [...source.matchAll(/\$style\.([\w]+)/g)].map(match => match[1]).filter(name => !compiled.modules?.[name]);
		expect(missing(`${sources}\n$style.missingExample`)).toContain('missingExample');
		expect(missing(sources)).toEqual([]);
		const centered = (source: string) => /\.releaseHeader\s*\{[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/.test(source) && /\.releaseHeading\s*\{[^}]*justify-content:\s*center/.test(source) && /\.releasePanel\s*\{[^}]*margin:\s*auto/.test(source);
		expect(centered(css.replaceAll('44px minmax(0, 1fr) 44px', '1fr auto'))).toBe(false);
		expect(centered(css)).toBe(true);
		expect(css).toContain('.releaseBody { overflow-y: auto; overflow-x: hidden;');
	});
	test('narrow and short containers retain readable release content and allow body scrolling', async () => {
		const css = fs.readFileSync(path.join(process.cwd(), 'src/components/hata-whats-new/release.module.css'), 'utf8');
		const contract = async (source: string) => {
			const compiled = await compileStyleAsync({ source, filename: 'release.module.css', id: 'release', modules: true });
			expect(compiled.errors).toEqual([]);
			expect(compiled.rawResult?.root).toBeDefined();
			const result = { narrowPadding: false, shortStartsAtTop: false, compactPadding: false };
			compiled.rawResult?.root.walkAtRules('container', container => {
				const query = container.params.replaceAll(/\s/g, '');
				container.walkRules(rule => {
					if (!compiled.modules?.simplePage || rule.selector !== `.${compiled.modules.simplePage}`) return;
					rule.walkDecls(declaration => {
						if (query === 'release(max-width:620px)' && declaration.prop === 'padding' && declaration.value === '18px 18px 24px') result.narrowPadding = true;
						if (query === 'release-body(max-height:560px)' && declaration.prop === 'justify-content' && declaration.value === 'flex-start') result.shortStartsAtTop = true;
						if (query === 'release-body(max-height:380px)' && declaration.prop === 'padding' && declaration.value === '10px 14px') result.compactPadding = true;
					});
				});
			});
			return result;
		};
		expect(await contract(css.replaceAll('.simplePage', '.missingPageExample'))).toEqual({ narrowPadding: false, shortStartsAtTop: false, compactPadding: false });
		expect(await contract(css)).toEqual({ narrowPadding: true, shortStartsAtTop: true, compactPadding: true });
	});
});
