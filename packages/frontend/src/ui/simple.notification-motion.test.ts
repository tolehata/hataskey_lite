/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import MkNotificationToastRing from '@/components/MkNotificationToastRing.vue';
import { createHataskeyNotificationToasts, getToastDuration, NOTIFICATION_TOAST_DURATION } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';
import { prefer } from '@/preferences.js';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: { animation: true, 'external.disableNotificationToast': false }, r: { animation: ref(true), useBlurEffect: ref(false), 'external.disableNotificationToast': ref(false) } } };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { close: '閉じる', notifications: '通知' } } }));
vi.mock('@/components/MkNotification.vue', () => ({ default: { props: ['notification'], template: '<p>{{ notification.id }}</p>' } }));
vi.mock('@/components/MkExternalNotificationToast.vue', () => ({ default: { template: '<p>external</p>' } }));
vi.mock('@/components/concrnt/ConcrntNotificationToast.vue', () => ({ default: { template: '<p>concrnt</p>' } }));
vi.mock('@/components/MkFavoriteSavedAnimation.vue', () => ({ default: { template: '<span>saved</span>' } }));
vi.mock('@/components/MkHataskeyNavbarNotice.vue', () => ({ default: { props: ['notice'], template: '<p>{{ notice.message }}</p>' } }));
vi.mock('@/components/MkHataskeyNoticeIcon.vue', () => ({ default: { template: '<i></i>' } }));

const filename = resolve(process.cwd(), 'src/ui/simple.vue');
const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
if (!descriptor.template?.ast || !descriptor.scriptSetup) throw new Error('Missing simple UI SFC');
const setup = ts.createSourceFile('simple.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
type RootNode = NonNullable<NonNullable<typeof descriptor.template>['ast']>;
type ChildNode = RootNode['children'][number];
type ElementNode = Extract<ChildNode, { type: 1 }>;

function prop(node: ElementNode, name: string): string | undefined {
	const value = node.props.find(item => item.type === 6 ? item.name === name : item.arg?.type === 4 && item.arg.content === name);
	return value?.type === 6 ? value.value?.content : value?.exp?.type === 4 ? value.exp.content : undefined;
}

function find(root: RootNode | ElementNode, predicate: (node: ElementNode) => boolean): ElementNode | undefined {
	for (const child of root.children) {
		if (child.type !== 1) continue;
		if (predicate(child)) return child;
		const nested = find(child, predicate);
		if (nested) return nested;
	}
	return undefined;
}

const topBar = find(descriptor.template.ast, node => prop(node, 'class')?.includes('$style.topBar,') ?? false);
if (!topBar) throw new Error('Missing production navbar');

function opening(node: ElementNode): string {
	const first = node.children.at(0);
	return first ? node.loc.source.slice(0, first.loc.start.offset - node.loc.start.offset) : node.loc.source.replace(/<\/[^>]+>\s*$/u, '');
}

// Retain production ancestor attributes and the actual notification viewport /
// bloom. Unrelated navigation contents are a fixed geometry input, not UI copies.
function notificationTemplate(node: ElementNode): string {
	if (prop(node, 'ref') === 'notificationTargetEl' || prop(node, 'ref') === 'notificationBloomEl' || node.tag === 'MkNotificationToastRing') return node.loc.source;
	if (prop(node, 'class') === '$style.topPillNav') return `${opening(node)}navigation</${node.tag}>`;
	const children = node.children.filter((child): child is ElementNode => child.type === 1).map(notificationTemplate).join('');
	return children ? `${opening(node)}${children}</${node.tag}>` : '';
}

const template = compileTemplate({
	source: `<div>${notificationTemplate(topBar)}<MkHataskeyNotificationToasts :context="notificationToasts"/></div>`,
	filename: 'notification-motion-fixture.vue', id: 'notification-motion-fixture',
	compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false },
});
if (template.errors.length) throw new Error(`Notification fixture compile failed: ${String(template.errors[0])}`);
const render = new Function('Vue', template.code)(Vue);

// Execute the complete existing state block. Discover its exports instead of
// requiring new implementation names, so the old source fails on lost height.
const start = setup.statements.findIndex(node => ts.isVariableStatement(node)
	&& node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'mobileToastVisible'));
const end = setup.statements.findIndex(node => ts.isExpressionStatement(node)
	&& ts.isCallExpression(node.expression) && node.expression.expression.getText(setup) === 'provide'
	&& node.expression.arguments[0]?.getText(setup) === 'hataskeyNotificationToastsKey');
if (start < 0 || end <= start) throw new Error('Missing production notification state boundaries');
const stateStatements = setup.statements.slice(start, end);
const stateNames = stateStatements.flatMap(node => ts.isVariableStatement(node)
	? node.declarationList.declarations.flatMap(item => ts.isIdentifier(item.name) ? [item.name.text] : [])
	: ts.isFunctionDeclaration(node) && node.name ? [node.name.text] : []);
const stateCode = ts.transpileModule(`${stateStatements.map(node => node.getText(setup)).join('\n')}\nreturn { ${stateNames.join(', ')} };`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

type WidthAnimation = {
	element: HTMLElement;
	frames: Keyframe[];
	options: KeyframeAnimationOptions;
	currentWidth: number;
	cancel: ReturnType<typeof vi.fn>;
	finish: () => void;
	onfinish: (() => void) | null;
	finished: Promise<void>;
	playState: string;
};
const apps = new Set<App>();
const animations: WidthAnimation[] = [];
const activeWidths = new Map<HTMLElement, WidthAnimation>();
const motionListeners = new Set<(event: MediaQueryListEvent) => void>();
const reduced = Vue.ref(false);
let restWidth = 280;

function naturalWidth(element: HTMLElement): number {
	const stack = element.closest<HTMLElement>('.topNavStack') ?? element.querySelector<HTMLElement>('.topNavStack');
	if (!stack) return 80;
	const animated = activeWidths.get(stack);
	if (animated) return animated.currentWidth;
	const fixed = Number.parseFloat(stack.style.width);
	if (fixed) return fixed;
	if (stack.dataset.navbarNotice === 'noteAction') return 510;
	if (stack.dataset.navbarNotice === 'emojiAdded') return 640;
	return stack.querySelector('.topPill')?.getAttribute('data-notification') === 'true' ? 360 : restWidth;
}

beforeEach(() => {
	vi.useFakeTimers();
	reduced.value = false;
	restWidth = 280;
	animations.length = 0;
	activeWidths.clear();
	motionListeners.clear();
	prefer.r.animation.value = true;
	prefer.s.animation = true;
	notificationToastsSuppressed.value = false;
	vi.spyOn(performance, 'now').mockReturnValue(0);
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal('matchMedia', () => ({
		get matches() { return reduced.value; },
		addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => motionListeners.add(callback),
		removeEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => motionListeners.delete(callback),
	}));
	vi.stubGlobal('ResizeObserver', class {
		constructor(private callback: () => void) {}
		observe(element: HTMLElement) { if (element.hasAttribute('data-toast-id')) this.callback(); }
		disconnect() {}
	});
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const width = naturalWidth(this);
		const viewport = this.querySelector<HTMLElement>('.notificationViewport');
		const height = this.hasAttribute('data-toast-id') ? 64 : 56 + Number.parseFloat(viewport?.style.height || '0');
		return new DOMRect(0, 0, width, height);
	});
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement, frames, options) {
		let complete: () => void;
		const animation: WidthAnimation = {
			element: this, frames: frames as Keyframe[], options: options as KeyframeAnimationOptions,
			currentWidth: Number.parseFloat((frames as Keyframe[])[0].width as string),
			onfinish: null, playState: 'running', finished: new Promise<void>(resolve => { complete = resolve; }),
			cancel: vi.fn(() => { activeWidths.delete(this); animation.playState = 'idle'; complete(); }),
			finish: () => { activeWidths.delete(this); animation.playState = 'finished'; animation.onfinish?.(); complete(); },
		};
		animations.push(animation);
		activeWidths.set(this, animation);
		return animation as unknown as Animation;
	});
});

afterEach(() => {
	for (const app of apps) app.unmount();
	apps.clear();
	window.document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function flush() { await Vue.nextTick(); await Vue.nextTick(); await Vue.nextTick(); }

async function advance(ms: number) { await vi.advanceTimersByTimeAsync(ms); await flush(); }

function fixture(options: { mobile?: boolean; native?: boolean } = {}) {
	const isDesktop = Vue.ref(!options.mobile);
	const nativeNavbarVisible = Vue.ref(options.native ?? true);
	const showTopBar = Vue.ref(true);
	const context = createHataskeyNotificationToasts(Vue.computed(() => !isDesktop.value), Vue.computed(() => nativeNavbarVisible.value && showTopBar.value), Vue.computed(() => nativeNavbarVisible.value));
	const topNavStackEl = Vue.ref<HTMLElement | null>(null);
	const root = Vue.defineComponent({
		components: { MkHataskeyNotificationToasts, MkNotificationToastRing },
		setup() {
			const bindings = {
				ref: Vue.ref, shallowRef: Vue.shallowRef, computed: Vue.computed, watch: Vue.watch, nextTick: Vue.nextTick,
				onMounted: Vue.onMounted, onUnmounted: Vue.onUnmounted, onBeforeUnmount: Vue.onBeforeUnmount,
				notificationToasts: context, topNavStackEl, isDesktop, nativeNavbarVisible, showTopBar, prefer, getToastDuration, NOTIFICATION_TOAST_DURATION,
				notificationTargetEl: context.target, notificationOutlineEl: context.outline,
				navbarPullPillEl: Vue.ref<HTMLElement | null>(null), navbarPullFrameStyle: Vue.ref({}),
				newNotesMotionEnabled: Vue.computed(() => prefer.r.animation.value && !reduced.value),
				pullRefresh: { active: Vue.ref(false), style: Vue.ref({}), state: Vue.ref({ phase: 'idle', height: 0 }) },
				emojiVoteInNavbar: Vue.ref(false), emojiVoteNavbarState: Vue.ref({ celebrating: false, leaving: false }),
				emojiVoteNavbarStackStyle: Vue.ref({}), navbarNewNotes: Vue.ref(null), navbarNewNotesContent: Vue.ref(null),
				mobileNotificationOnly: Vue.computed(() => !isDesktop.value && !nativeNavbarVisible.value),
				punchVisible: Vue.ref(false), navbarSearchOpen: Vue.ref(false), navbarLoadingShown: Vue.ref(false),
				pendingApiRequestsCount: Vue.ref(0), footerIsDark: Vue.ref(false),
			};
			const state = new Function(...Object.keys(bindings), stateCode)(...Object.values(bindings));
			return { ...bindings, ...state };
		},
		render,
	});
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = Vue.createApp(root);
	// The real toast resolves these application-global components even when its
	// ordinary status branch is active. Supply fixtures instead of hiding warnings.
	app.component('MkAvatar', { props: ['user'], template: '<span data-test-avatar></span>' });
	app.component('Mfm', { props: ['text'], template: '<span>{{ text }}</span>' });
	app.config.globalProperties.$style = new Proxy({}, { get: (_target, key) => key });
	app.mount(container);
	apps.add(app);

	function required(selector: string): HTMLElement {
		const element = container.querySelector<HTMLElement>(selector);
		if (!element) throw new Error(`Missing notification fixture element: ${selector}`);
		return element;
	}

	return {
		context, container, required, showTopBar,
		viewport: () => required('.notificationViewport'), stack: () => required('.topNavStack'),
		glow: () => container.querySelector<SVGElement>('.notificationBloom svg'),
		unmount: () => { app.unmount(); apps.delete(app); },
	};
}

describe('Hataskey navbar notification motion from production source', () => {
	it('retains the outline and geometry after card removal, then contracts the measured width', async () => {
		const view = fixture();
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		expect(view.viewport().style.height).toBe('64px');
		expect(view.stack().getBoundingClientRect().width).toBe(360);
		view.context.dismiss(view.context.items.value[0].id);
		await flush();
		// On the old source this is the first failure: actual height becomes 0px.
		expect(view.viewport().style.height).toBe('64px');
		await advance(349);
		expect(view.viewport().querySelector('article')).not.toBeNull();
		await advance(1);
		expect(view.viewport().querySelector('article')).toBeNull();
		expect(view.viewport().style.height).toBe('64px');
		expect(view.glow()).not.toBeNull();
		await advance(199);
		expect(view.stack().getBoundingClientRect().width).toBe(360);
		expect(view.viewport().style.height).toBe('64px');
		expect(animations).toHaveLength(0);
		await advance(1);
		expect(view.viewport().style.height).toBe('0px');
		expect(animations).toHaveLength(1);
		expect(animations[0].frames).toEqual([{ width: '360px' }, { width: '280px' }]);
		expect(animations[0].options).toMatchObject({ duration: 350, easing: 'cubic-bezier(.22,1,.36,1)' });
		animations[0].finish();
		await flush();
		expect(view.stack().style.width).toBe('');
		expect(view.stack().getBoundingClientRect().width).toBe(280);
	});

	it('cancels both an earlier delayed collapse and an in-flight shrink when a newer notice arrives', async () => {
		const view = fixture();
		view.context.enqueueStatus('最初の通知', 0);
		await flush();
		view.context.clear();
		await advance(200);
		view.context.enqueueStatus('次の通知', 0);
		await advance(400);
		expect(view.viewport().style.height).toBe('64px');
		expect(view.viewport().textContent).toContain('次の通知');
		expect(animations).toHaveLength(0);
		view.context.clear();
		await advance(550);
		expect(animations).toHaveLength(1);
		const previous = animations[0];
		previous.currentWidth = 320;
		view.context.enqueueStatus('割り込んだ通知', 0);
		await flush();
		expect(previous.cancel).toHaveBeenCalledOnce();
		previous.finish();
		await flush();
		expect(view.viewport().style.height).toBe('64px');
		expect(view.stack().style.width).toBe('');
		expect(view.viewport().textContent).toContain('割り込んだ通知');
	});

	it.each(['setting', 'reduced'] as const)('releases immediately with motion disabled by %s', async mode => {
		if (mode === 'setting') {
			prefer.r.animation.value = false;
			prefer.s.animation = false;
		} else {
			reduced.value = true;
		}
		const view = fixture();
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		view.context.clear();
		await advance(0);
		expect(view.viewport().style.height).toBe('0px');
		expect(view.viewport().querySelector('article')).toBeNull();
		expect(view.glow()).toBeNull();
		expect(animations).toHaveLength(0);
	});

	it('finishes the retained exit when animation is disabled during the fade', async () => {
		const view = fixture();
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		view.context.clear();
		await advance(200);
		prefer.r.animation.value = false;
		await advance(0);
		expect(view.viewport().style.height).toBe('0px');
		expect(view.glow()).toBeNull();
		await advance(500);
		expect(animations).toHaveLength(0);
	});

	it('returns the same live card to a page surface without retaining a second native outline', async () => {
		const view = fixture();
		view.context.enqueueStatus('移動する通知', 0);
		await flush();
		view.context.tick(1500, new Set());
		const card = view.viewport().querySelector('article');
		const page = window.document.createElement('section');
		const host = window.document.createElement('div');
		page.append(host);
		window.document.body.append(page);
		const release = view.context.registerSurface({ active: Vue.ref(true), target: Vue.shallowRef(host), outline: Vue.shallowRef(page), animations: Vue.ref(true) });
		await flush();
		expect(view.viewport().style.height).toBe('0px');
		expect(view.glow()).toBeNull();
		expect(host.querySelector('article')).toBe(card);
		expect(view.context.items.value[0].elapsed).toBe(1500);
		expect(animations).toHaveLength(0);
		release();
		await flush();
		expect(view.viewport().querySelector('article')).toBe(card);
		expect(view.viewport().style.height).toBe('64px');
		expect(view.context.items.value[0].elapsed).toBe(1500);
	});

	it.each(['resize', 'reduced'] as const)('cancels width interpolation on %s and releases the fixed width', async event => {
		const view = fixture();
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		view.context.clear();
		await advance(550);
		expect(animations).toHaveLength(1);
		const animation = animations[0];
		if (event === 'resize') {
			restWidth = 220;
			window.dispatchEvent(new Event('resize'));
		} else {
			reduced.value = true;
			for (const listener of motionListeners) listener({ matches: true } as MediaQueryListEvent);
		}
		await flush();
		expect(animation.cancel).toHaveBeenCalledOnce();
		expect(view.stack().style.width).toBe('');
		expect(view.stack().getBoundingClientRect().width).toBe(restWidth);
	});

	it.each([200, 550])('cleans up the retained exit and width animation when unmounted at %d ms', async elapsed => {
		const view = fixture();
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		view.context.clear();
		await advance(elapsed);
		view.unmount();
		if (elapsed === 550) expect(animations[0]?.cancel).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('retains the three-second note-action outline progress and its wider frame through exit', async () => {
		const view = fixture();
		view.context.enqueueNavbarNotice({ kind: 'noteAction', action: 'delete', message: '削除しました' }, 0);
		await flush();
		view.context.tick(1500, new Set());
		await flush();
		expect(view.glow()?.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.5');
		view.context.clear();
		await advance(350);
		expect(view.stack().dataset.navbarNotice).toBe('noteAction');
		expect(view.stack().getBoundingClientRect().width).toBe(510);
		expect(view.glow()?.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.5');
		await advance(200);
		expect(animations[0].frames).toEqual([{ width: '510px' }, { width: '280px' }]);
	});

	it('keeps a notification-only mobile navbar visible until the retained fade has finished', async () => {
		const view = fixture({ mobile: true, native: false });
		view.context.enqueueStatus('保存しました', 0);
		await flush();
		view.context.clear();
		await advance(549);
		expect(view.required('.topBar').style.display).not.toBe('none');
		expect(view.viewport().style.height).toBe('64px');
		await advance(351);
		for (const animation of animations) animation.finish();
		await flush();
		expect(view.required('.topBar').style.display).toBe('none');
	});
});
