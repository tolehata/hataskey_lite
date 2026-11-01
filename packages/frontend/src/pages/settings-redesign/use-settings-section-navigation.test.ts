/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, ref, shallowRef } from 'vue';
import { collectSettingsSectionAnchors, mostVisibleSettingsSection, useSettingsSectionNavigation } from './use-settings-section-navigation.js';

const cleanups: (() => void)[] = [];

class IntersectionProbe {
	static instances: IntersectionProbe[] = [];
	observed = new Set<Element>();
	disconnected = false;
	constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) { IntersectionProbe.instances.push(this); }
	observe(element: Element) { this.observed.add(element); }
	disconnect() { this.disconnected = true; this.observed.clear(); }
	fire() { this.callback([], this as unknown as IntersectionObserver); }
}

class MutationProbe {
	static instances: MutationProbe[] = [];
	disconnected = false;
	constructor(readonly callback: MutationCallback) { MutationProbe.instances.push(this); }
	observe() { /* Tests deliver a mutation after changing the fixture DOM. */ }
	disconnect() { this.disconnected = true; }
	fire() { this.callback([], this as unknown as MutationObserver); }
}

class ResizeProbe {
	static instances: ResizeProbe[] = [];
	disconnected = false;
	constructor(readonly callback: ResizeObserverCallback) { ResizeProbe.instances.push(this); }
	observe() { /* Geometry is supplied explicitly because this is not a browser. */ }
	disconnect() { this.disconnected = true; }
	fire() { this.callback([], this as unknown as ResizeObserver); }
}

function latest<T>(instances: readonly T[]): T {
	const instance = instances.at(-1);
	if (instance == null) throw new Error('Expected an observer to be registered');
	return instance;
}

function geometry(element: HTMLElement, top: number, height: number, left = 0, width = 320) {
	const rectangle = { x: left, y: top, top, left, right: left + width, bottom: top + height, height, width, toJSON: () => ({}) };
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rectangle);
	return element;
}

function anchor(parent: HTMLElement, id: string, top: number, height: number, label = id, left = 0) {
	const element = window.document.createElement('section');
	element.dataset.settingsSectionAnchor = id;
	element.dataset.settingsSectionLabel = label;
	element.dataset.settingsSectionIcon = 'ti ti-settings';
	element.tabIndex = -1;
	parent.append(element);
	return geometry(element, top, height, left);
}

function touchEvent(type: string, x: number, y: number) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] });
	return event;
}

function fixture() {
	const layout = geometry(window.document.createElement('div'), 20, 800);
	const main = geometry(window.document.createElement('main'), 100, 600);
	for (const element of [layout, main]) {
		Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 3000 });
		Object.defineProperty(element, 'clientHeight', { value: 600 });
	}
	const content = window.document.createElement('div');
	layout.append(main);
	main.append(content);
	window.document.body.append(layout);
	const layoutScroll = vi.fn();
	const mainScroll = vi.fn();
	layout.scrollTo = layoutScroll;
	main.scrollTo = mainScroll;
	cleanups.push(() => layout.remove());
	return { layout, main, content, layoutScroll, mainScroll };
}

function mountNavigation(dom: ReturnType<typeof fixture>, smooth = false) {
	const content = shallowRef<HTMLElement | null>(dom.content);
	const scrollRoot = shallowRef<HTMLElement | null>(dom.main);
	const enabled = ref(true);
	const categoryId = ref<string | null>('appearance');
	const motionEnabled = ref(smooth);
	const shown = ref(true);
	let navigation!: ReturnType<typeof useSettingsSectionNavigation>;
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const child = {
		setup() {
			navigation = useSettingsSectionNavigation({ content, scrollRoot, enabled, categoryId, motionEnabled });
			return () => h('div');
		},
	};
	const app = createApp({ render: () => h(KeepAlive, null, () => shown.value ? h(child) : null) });
	app.mount(host);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); mounted = false; } host.remove(); };
	cleanups.push(unmount);
	return { navigation, scrollRoot, enabled, categoryId, motionEnabled, shown, unmount };
}

beforeEach(() => {
	IntersectionProbe.instances = [];
	MutationProbe.instances = [];
	ResizeProbe.instances = [];
	vi.stubGlobal('IntersectionObserver', IntersectionProbe);
	vi.stubGlobal('MutationObserver', MutationProbe);
	vi.stubGlobal('ResizeObserver', ResizeProbe);
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('settings section anchor collection', () => {
	test.each(['display', 'visibility', 'hidden', 'aria-hidden'] as const)('excludes descendants of a %s ancestor and restores them when revealed', method => {
		const { content } = fixture();
		const group = window.document.createElement('div');
		content.append(group);
		anchor(group, 'inside', 200, 100);
		anchor(content, 'outside', 400, 100);
		if (method === 'display') group.style.display = 'none';
		if (method === 'visibility') group.style.visibility = 'hidden';
		if (method === 'hidden') group.hidden = true;
		if (method === 'aria-hidden') group.setAttribute('aria-hidden', 'true');
		expect(collectSettingsSectionAnchors(content).map(item => item.id)).toEqual(['outside']);
		group.removeAttribute('style');
		group.removeAttribute('hidden');
		group.removeAttribute('aria-hidden');
		expect(collectSettingsSectionAnchors(content).map(item => item.id)).toEqual(['inside', 'outside']);
	});

	test('keeps separately addressable cards with the same label and ignores ordinary headings', () => {
		const { content } = fixture();
		anchor(content, 'font-prefs', 100, 200, '表示');
		anchor(content, 'font-owner', 300, 200, '表示');
		const ordinary = window.document.createElement('h3');
		ordinary.textContent = '別の見出し';
		content.append(ordinary);
		anchor(content, 'incomplete', 500, 100).removeAttribute('data-settings-section-label');
		expect(collectSettingsSectionAnchors(content).map(({ id, label }) => ({ id, label }))).toEqual([
			{ id: 'font-prefs', label: '表示' }, { id: 'font-owner', label: '表示' },
		]);
	});
});

describe('settings section scroll position', () => {
	test('uses visible reading height so a small complete card does not defeat a long card', () => {
		const { content, main } = fixture();
		anchor(content, 'long', -1500, 2150);
		anchor(content, 'small', 650, 50);
		expect(mostVisibleSettingsSection(collectSettingsSectionAnchors(content), main, 'small')).toBe('long');
	});

	test('selects the visible inner form body instead of the enclosing form', () => {
		const { content, main } = fixture();
		const owner = anchor(content, 'profile', 100, 2400);
		const inner = anchor(owner, 'profile-fields', 400, 700);
		const last = anchor(owner, 'profile-badges', 1200, 500);
		const anchors = collectSettingsSectionAnchors(content);
		expect(mostVisibleSettingsSection(anchors, main, 'profile')).toBe('profile-fields');
		geometry(owner, -1000, 2400);
		geometry(inner, -700, 700);
		geometry(last, 100, 500);
		expect(mostVisibleSettingsSection(anchors, main, 'profile-fields')).toBe('profile-badges');
	});

	test('returns to the parent when general controls follow the final nested settings body', () => {
		const { content, main } = fixture();
		const owner = anchor(content, 'ui-layout', 100, 2400);
		const rss = anchor(owner, 'rss', 400, 700);
		const bottomNav = anchor(owner, 'bottom-nav', 1200, 500);
		const anchors = collectSettingsSectionAnchors(content);
		geometry(owner, -1000, 2400);
		geometry(rss, -700, 700);
		geometry(bottomNav, 100, 500);
		expect(mostVisibleSettingsSection(anchors, main, 'rss')).toBe('bottom-nav');
		geometry(owner, -1500, 2400);
		geometry(rss, -1200, 700);
		geometry(bottomNav, -400, 500);
		expect(mostVisibleSettingsSection(anchors, main, 'bottom-nav')).toBe('ui-layout');
	});

	test('keeps the selected column on a visibility tie and has deterministic initial selection', () => {
		const { content, main } = fixture();
		anchor(content, 'left', 200, 400, '左', 0);
		anchor(content, 'right', 200, 400, '右', 340);
		const anchors = collectSettingsSectionAnchors(content);
		expect(mostVisibleSettingsSection(anchors, main, 'right')).toBe('right');
		expect(mostVisibleSettingsSection(anchors, main, null)).toBe('left');
	});
});

describe('settings section navigation lifecycle', () => {
	test('discovers asynchronously inserted cards and updates hidden folders through its mutation observer', async () => {
		const dom = fixture();
		anchor(dom.content, 'first', 200, 100);
		const { navigation } = mountNavigation(dom);
		const mutation = latest(MutationProbe.instances);
		const lazy = anchor(dom.content, 'lazy', 450, 100);
		expect(navigation.items.value.map(item => item.id)).toEqual(['first']);
		mutation.fire();
		await nextTick();
		expect(navigation.items.value.map(item => item.id)).toEqual(['first', 'lazy']);
		expect(IntersectionProbe.instances.at(-1)?.observed.has(lazy)).toBe(true);
		lazy.hidden = true;
		mutation.fire();
		await nextTick();
		expect(navigation.items.value.map(item => item.id)).toEqual(['first']);
	});

	test('scrolls only the supplied desktop pane, then the mobile layout after root switching, and focuses the heading', async () => {
		const dom = fixture();
		const target = anchor(dom.content, 'target', 500, 200);
		const targetFocus = vi.spyOn(target, 'focus');
		dom.main.scrollTop = 200;
		dom.layout.scrollTop = 80;
		const { navigation, scrollRoot } = mountNavigation(dom);
		const desktopObserver = latest(IntersectionProbe.instances);
		navigation.select('target');
		expect(dom.mainScroll).toHaveBeenLastCalledWith({ top: 524, behavior: 'auto' });
		expect(dom.layoutScroll).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(target);
		expect(targetFocus).toHaveBeenCalledWith({ preventScroll: true });
		scrollRoot.value = dom.layout;
		await nextTick();
		navigation.select('target');
		expect(dom.mainScroll).toHaveBeenCalledTimes(1);
		expect(dom.layoutScroll).toHaveBeenLastCalledWith({ top: 484, behavior: 'auto' });
		expect(desktopObserver.disconnected).toBe(true);
		expect(IntersectionProbe.instances.at(-1)?.options.root).toBe(dom.layout);
	});

	test.each([true, false])('keeps a clicked short section after arrival and observer updates (motion=%s)', async smooth => {
		vi.useFakeTimers();
		const dom = fixture();
		anchor(dom.content, 'left', 200, 400, '左', 0);
		const right = anchor(dom.content, 'right', 200, 400, '右', 340);
		const { navigation } = mountNavigation(dom, smooth);
		navigation.select('right');
		expect(dom.mainScroll).toHaveBeenLastCalledWith({ top: 24, behavior: smooth ? 'smooth' : 'auto' });
		geometry(right, 650, 50, 340);
		dom.main.scrollTop = 24;
		dom.main.dispatchEvent(new Event('scroll'));
		IntersectionProbe.instances.at(-1)?.fire();
		expect(navigation.activeId.value).toBe('right');
		await vi.advanceTimersByTimeAsync(2000);
		ResizeProbe.instances.at(-1)?.fire();
		expect(navigation.activeId.value).toBe('right');
		// A real manual movement resumes tracking without waiting for an IO threshold.
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
		expect(navigation.activeId.value).toBe('right');
		dom.main.scrollTop = 64;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('left');
	});

	test('keeps a clicked parent while a nested section occupies most of the viewport', async () => {
		const dom = fixture();
		const parent = anchor(dom.content, 'parent', 176, 1800);
		anchor(parent, 'nested', 300, 700);
		const { navigation } = mountNavigation(dom);
		navigation.select('parent');
		IntersectionProbe.instances.at(-1)?.fire();
		expect(navigation.activeId.value).toBe('parent');
		parent.hidden = true;
		anchor(dom.content, 'replacement', 200, 300);
		latest(MutationProbe.instances).fire();
		await nextTick();
		expect(navigation.activeId.value).toBe('replacement');
	});

	test('keeps a bottom-clamped selection on input that cannot move the pane', () => {
		const dom = fixture();
		Object.defineProperty(dom.main, 'scrollHeight', { value: 1100 });
		anchor(dom.content, 'long', 180, 450);
		anchor(dom.content, 'last', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('last');
		dom.main.scrollTop = 500;
		dom.main.dispatchEvent(new Event('scroll'));
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
		dom.main.dispatchEvent(new Event('scroll'));
		latest(IntersectionProbe.instances).fire();
		expect(navigation.activeId.value).toBe('last');
	});

	test.each(['PageDown', 'ArrowDown', 'End', ' '])('resumes tracking after %s scrolls the focused section', key => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		dom.main.scrollTop = 50;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
	});

	test.each(['input', 'textarea', 'select', 'div'])('does not treat %s editing or horizontal/zoom input as pane scrolling', tag => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const control = window.document.createElement(tag);
		if (tag === 'div') control.setAttribute('contenteditable', 'true');
		target.append(control);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 2 }));
		const zoom = new WheelEvent('wheel', { deltaY: 50 });
		// happy-dom's WheelEvent omits MouseEvent modifier properties.
		Object.defineProperty(zoom, 'ctrlKey', { value: true });
		dom.main.dispatchEvent(zoom);
		dom.main.scrollTop = 20;
		dom.main.dispatchEvent(new Event('scroll'));
		latest(IntersectionProbe.instances).fire();
		expect(navigation.activeId.value).toBe('target');
	});

	test('allows page scrolling from a focused button without treating Space activation as scrolling', () => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const button = window.document.createElement('button');
		target.append(button);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		dom.main.scrollTop = 20;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
		dom.main.scrollTop = 80;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
	});

	test('discards unconsumed input so a later layout shift cannot change the selected item', async () => {
		vi.useFakeTimers();
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		anchor(dom.content, 'target', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
		await vi.advanceTimersByTimeAsync(500);
		dom.main.scrollTop = 30;
		dom.main.dispatchEvent(new Event('scroll'));
		latest(ResizeProbe.instances).fire();
		expect(navigation.activeId.value).toBe('target');
	});

	test('does not unlock during smooth arrival when a nested scrollable field consumes the wheel', () => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const field = window.document.createElement('textarea');
		field.style.overflowY = 'auto';
		Object.defineProperty(field, 'scrollHeight', { value: 400 });
		Object.defineProperty(field, 'clientHeight', { value: 100 });
		target.append(field);
		const { navigation } = mountNavigation(dom, true);
		navigation.select('target');
		field.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, bubbles: true }));
		dom.main.scrollTop = 30;
		dom.main.dispatchEvent(new Event('scroll'));
		latest(IntersectionProbe.instances).fire();
		expect(navigation.activeId.value).toBe('target');
	});

	test('a second selection replaces both the clicked item and any pending manual input', () => {
		const dom = fixture();
		anchor(dom.content, 'left', 200, 400);
		anchor(dom.content, 'right', 650, 50);
		const { navigation } = mountNavigation(dom, true);
		navigation.select('left');
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaY: 50 }));
		navigation.select('right');
		dom.main.scrollTop = 40;
		dom.main.dispatchEvent(new Event('scroll'));
		latest(IntersectionProbe.instances).fire();
		expect(navigation.activeId.value).toBe('right');
	});

	test('resumes after a vertical touch scroll, but keeps the choice on a tap or horizontal swipe', () => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		target.dispatchEvent(touchEvent('touchstart', 100, 300));
		target.dispatchEvent(touchEvent('touchmove', 160, 301));
		dom.main.scrollTop = 20;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		target.dispatchEvent(touchEvent('touchstart', 100, 300));
		target.dispatchEvent(touchEvent('touchmove', 100, 240));
		dom.main.scrollTop = 80;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
	});

	test('resumes after holding and dragging the vertical scrollbar, but not a pointer press in the form', async () => {
		vi.useFakeTimers();
		const dom = fixture();
		Object.defineProperty(dom.main, 'clientWidth', { value: 300 });
		anchor(dom.content, 'long', 200, 400);
		anchor(dom.content, 'target', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		dom.main.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 100 }));
		dom.main.scrollTop = 20;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		dom.main.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 310 }));
		await vi.advanceTimersByTimeAsync(500);
		dom.main.scrollTop = 80;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
		window.dispatchEvent(new MouseEvent('pointerup'));
	});

	test('resumes when a touch reverses direction at the bottom without lifting the finger', () => {
		const dom = fixture();
		Object.defineProperty(dom.main, 'scrollHeight', { value: 1100 });
		anchor(dom.content, 'long', 200, 400);
		const target = anchor(dom.content, 'target', 650, 50);
		const { navigation } = mountNavigation(dom);
		navigation.select('target');
		dom.main.scrollTop = 500;
		target.dispatchEvent(touchEvent('touchstart', 100, 300));
		target.dispatchEvent(touchEvent('touchmove', 100, 200));
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		target.dispatchEvent(touchEvent('touchmove', 100, 220));
		dom.main.scrollTop = 480;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
	});

	test('resumes for a shell-forwarded wheel only when it moves the current root', async () => {
		const dom = fixture();
		anchor(dom.content, 'long', 200, 400);
		anchor(dom.content, 'target', 650, 50);
		const { navigation, scrollRoot } = mountNavigation(dom);
		navigation.select('target');
		navigation.notifyManualScroll(dom.layout);
		dom.main.scrollTop = 20;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		navigation.notifyManualScroll(dom.main);
		dom.main.scrollTop = 80;
		dom.main.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
		scrollRoot.value = dom.layout;
		await nextTick();
		navigation.select('target');
		dom.main.dispatchEvent(new WheelEvent('wheel', { deltaY: 50 }));
		dom.layout.scrollTop = 20;
		dom.layout.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('target');
		dom.layout.dispatchEvent(new WheelEvent('wheel', { deltaY: 50 }));
		dom.layout.scrollTop = 80;
		dom.layout.dispatchEvent(new Event('scroll'));
		expect(navigation.activeId.value).toBe('long');
	});

	test('recomputes the active section when the scroll viewport resizes', () => {
		const dom = fixture();
		anchor(dom.content, 'first', 180, 120);
		anchor(dom.content, 'second', 300, 600);
		geometry(dom.main, 100, 200);
		const { navigation } = mountNavigation(dom);
		expect(navigation.activeId.value).toBe('first');
		geometry(dom.main, 100, 800);
		ResizeProbe.instances.at(-1)?.fire();
		expect(navigation.activeId.value).toBe('second');
	});

	test('clears old category anchors and cancels a pending jump before selecting the next category', async () => {
		vi.useFakeTimers();
		const dom = fixture();
		const old = anchor(dom.content, 'old', 300, 300);
		const { navigation, categoryId } = mountNavigation(dom, true);
		navigation.select('old');
		const oldObservers = [IntersectionProbe.instances.at(-1), MutationProbe.instances.at(-1), ResizeProbe.instances.at(-1)];
		old.remove();
		anchor(dom.content, 'new', 200, 300);
		categoryId.value = 'timeline';
		await nextTick();
		expect(navigation.items.value.map(item => item.id)).toEqual(['new']);
		expect(navigation.activeId.value).toBe('new');
		expect(oldObservers.every(observer => observer?.disconnected)).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		navigation.select('old');
		expect(navigation.activeId.value).toBe('new');
		expect(dom.mainScroll).toHaveBeenCalledTimes(1);
	});

	test('does not scroll when disabled, for missing anchors, or after its scroll root is detached', async () => {
		const dom = fixture();
		anchor(dom.content, 'first', 300, 100);
		const { navigation, enabled } = mountNavigation(dom);
		navigation.select('missing');
		enabled.value = false;
		navigation.select('first');
		await nextTick();
		expect(navigation.items.value).toEqual([]);
		enabled.value = true;
		await nextTick();
		dom.layout.remove();
		navigation.select('first');
		expect(dom.mainScroll).not.toHaveBeenCalled();
	});

	test('disconnects observers and prevents queued collections from surviving unmount', async () => {
		vi.useFakeTimers();
		const dom = fixture();
		anchor(dom.content, 'first', 300, 100);
		const { navigation, unmount } = mountNavigation(dom, true);
		navigation.select('first');
		const mutation = latest(MutationProbe.instances);
		anchor(dom.content, 'late', 500, 100);
		mutation.fire();
		unmount();
		await nextTick();
		await vi.advanceTimersByTimeAsync(1000);
		expect(navigation.items.value.map(item => item.id)).toEqual(['first']);
		expect([...IntersectionProbe.instances, ...MutationProbe.instances, ...ResizeProbe.instances].every(observer => observer.disconnected)).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('stops navigation while kept inactive and recollects the current content on activation', async () => {
		const dom = fixture();
		anchor(dom.content, 'first', 300, 100);
		const { navigation, shown } = mountNavigation(dom);
		const oldObservers = [IntersectionProbe.instances.at(-1), MutationProbe.instances.at(-1), ResizeProbe.instances.at(-1)];
		shown.value = false;
		await nextTick();
		navigation.select('first');
		expect(dom.mainScroll).not.toHaveBeenCalled();
		expect(oldObservers.every(observer => observer?.disconnected)).toBe(true);
		anchor(dom.content, 'added-while-away', 500, 100);
		shown.value = true;
		await nextTick();
		expect(navigation.items.value.map(item => item.id)).toEqual(['first', 'added-while-away']);
		navigation.select('added-while-away');
		expect(dom.mainScroll).toHaveBeenCalledOnce();
	});
});
