/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick, provide, ref } from 'vue';
import type { Component } from 'vue';
import type { Router } from '@/router.js';
import { DI } from '@/di.js';
import { HATA_GOES_HOST, HATA_GOES_POPUP_SCOPE, HATA_GOES_SESSION, HATA_GOES_THEME } from './hatagoes-context.js';
import { createHataGoesPopupSession, useHataGoesPopup, useHataGoesPopupMenu } from './hatagoes-popup.js';

const fixture = vi.hoisted(() => ({ popup: vi.fn((_component: Component, _props: Record<string, unknown>, _events?: Record<string, unknown>) => ({ dispose: vi.fn() })), popupMenu: vi.fn() }));
const composer = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: fixture.popup, popupMenu: fixture.popupMenu }));
vi.mock('@/components/MkPopupMenu.vue', () => ({ default: defineComponent({ props: ['items', 'forceMotion'], setup: () => () => h('div') }) }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: composer.capture }));
const cleanup: (() => void)[] = [];

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); fixture.popup.mockClear(); composer.capture.mockReset(); });

function mount(component: Component, props = {}) {
	const el = window.document.createElement('div'); window.document.body.append(el);
	const app = createApp(component, props); app.mount(el);
	cleanup.push(() => { app.unmount(); el.remove(); });
	return el;
}

describe('HataGoes popup context', () => {
	test('detached popup keeps the launching pane palette as other apps become active', async () => {
		const owner = ref({ className: 'hatady-scope', hatadyTheme: 'paper', style: { '--custom': '#855333' } });
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const target = defineComponent({ setup() {
			expect(inject(HATA_GOES_THEME)).toBe(owner);
			return () => h('button', 'owned');
		} });
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_THEME, owner); return () => h(source); } }));
		launch(target, {}, {});
		const wrapper = fixture.popup.mock.calls[0][0];
		const el = mount(wrapper);
		expect(el.querySelector('[data-hatagoes-palette]')?.getAttribute('data-hatady-theme')).toBe('paper');
		host.active.value = false;
		expect(el.querySelector('button')?.textContent).toBe('owned');
		owner.value = { className: 'hatady-scope', hatadyTheme: 'espresso', style: { '--custom': '#edbb88' } };
		await nextTick();
		expect(el.querySelector('[data-hatagoes-palette]')?.getAttribute('data-hatady-theme')).toBe('espresso');
		expect((el.querySelector('[data-hatagoes-palette]') as HTMLElement).style.getPropertyValue('--custom')).toBe('#edbb88');
	});
	test('legacy launchers keep the original component identity', () => {
		const target = defineComponent(() => () => h('p', 'legacy'));
		mount(defineComponent({ setup() { useHataGoesPopup()(target, {}); return () => null; } }));
		expect(fixture.popup.mock.calls[0][0]).toBe(target);
	});
	test('legacy menu launchers use the original popupMenu directly', () => {
		let launchMenu!: ReturnType<typeof useHataGoesPopupMenu>;
		mount(defineComponent({ setup() { launchMenu = useHataGoesPopupMenu(); return () => null; } }));
		const anchor = window.document.createElement('button');
		launchMenu([], anchor);
		expect(fixture.popupMenu).toHaveBeenCalledWith([], anchor);
		expect(composer.capture).not.toHaveBeenCalled();
	});
	test('a forced nested menu keeps motion even without a pane injection', async () => {
		let launchMenu!: ReturnType<typeof useHataGoesPopupMenu>;
		mount(defineComponent({ setup() { launchMenu = useHataGoesPopupMenu(true); return () => null; } }));
		const done = launchMenu([], null);
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalledOnce());
		const [, props, events] = fixture.popup.mock.calls[0];
		expect(props).toMatchObject({ forceMotion: true });
		(events as { closed: () => void }).closed();
		await expect(done).resolves.toBeUndefined();
	});
	test('asynchronous and nested launches retain host, router, props and close events without inheriting page exit', async () => {
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		const router = {} as Router;
		const exit = vi.fn(), closed = vi.fn();
		let launch: ReturnType<typeof useHataGoesPopup>;
		let nested: ReturnType<typeof useHataGoesPopup>;
		const target = defineComponent({
			props: { title: String }, emits: ['closed'],
			setup(props, { emit }) {
				expect(inject(HATA_GOES_HOST)).toBe(host);
				expect(inject(DI.router)).toBe(router);
				expect(inject(DI.pageWindowClose, null)).toBeNull();
				nested = useHataGoesPopup();
				return () => h('button', { onClick: () => emit('closed') }, props.title);
			},
		});
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(DI.router, router); provide(DI.pageWindowClose, exit); return () => h(defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } })); } }));
		await Promise.resolve();
		launch!(target, { title: 'detail' }, { closed });
		const [wrapper, props] = fixture.popup.mock.calls[0];
		const el = mount(wrapper, { ...props, onClosed: closed });
		el.querySelector('button')!.click();
		expect(closed).toHaveBeenCalledOnce();
		expect(exit).not.toHaveBeenCalled();
		nested!(target, { title: 'nested' }, {});
		expect(fixture.popup.mock.calls[1][0]).not.toBe(target);
	});
	test('a scoped menu keeps anchor, focus return, closing callback and disposal after closed', async () => {
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		const anchor = window.document.createElement('button');
		window.document.body.append(anchor);
		cleanup.push(() => anchor.remove());
		const onClosing = vi.fn();
		const release = vi.fn();
		composer.capture.mockReturnValueOnce({ style: undefined, release });
		let launchMenu!: ReturnType<typeof useHataGoesPopupMenu>;
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); return () => h(defineComponent({ setup() { launchMenu = useHataGoesPopupMenu(); return () => null; } })); } }));
		const done = launchMenu([{ type: 'button', text: 'Action', action: () => {} }], anchor, { width: 260, onClosing });
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalledOnce());
		const [, props, events] = fixture.popup.mock.calls[0];
		expect(props).toMatchObject({ anchorElement: anchor, returnFocusTo: anchor, width: 260, forceMotion: true });
		expect(composer.capture).toHaveBeenCalledWith(anchor);
		(events as { closing: () => void }).closing();
		expect(onClosing).toHaveBeenCalledOnce();
		(events as { closed: () => void }).closed();
		await expect(done).resolves.toBeUndefined();
		expect(release).toHaveBeenCalledOnce();
	});

	test('app changes retain a popup, while shell exit closes it once', () => {
		const shell = ref(true), appActive = ref(true);
		const session = createHataGoesPopupSession(shell);
		const host = { active: appActive, register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => h(source); } }));
		const closed = vi.fn();
		const handle = launch(defineComponent(() => () => null), {}, { closed });
		const underlying = fixture.popup.mock.results[0].value;
		appActive.value = false;
		expect(underlying.dispose).not.toHaveBeenCalled();
		shell.value = false;
		expect(closed).toHaveBeenCalledOnce();
		expect(underlying.dispose).toHaveBeenCalledOnce();
		handle.dispose();
		(fixture.popup.mock.calls[0][2] as { closed: () => void }).closed();
		expect(closed).toHaveBeenCalledOnce();
		expect(underlying.dispose).toHaveBeenCalledOnce();
	});

	test('nested popups are tracked by their original shell alone', () => {
		const firstActive = ref(true), secondActive = ref(true);
		const first = createHataGoesPopupSession(firstActive);
		const second = createHataGoesPopupSession(secondActive);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		let nested!: ReturnType<typeof useHataGoesPopup>;
		const target = defineComponent({ setup() {
			expect(inject(HATA_GOES_SESSION)).toBe(first);
			nested = useHataGoesPopup();
			return () => null;
		} });
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, first); return () => h(source); } }));
		const parent = launch(target, {}, {});
		const wrapper = fixture.popup.mock.calls[0][0];
		mount(wrapper);
		const child = nested(target, {}, {});
		const otherSource = defineComponent({ setup() { useHataGoesPopup()(target, {}, {}); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, second); return () => h(otherSource); } }));
		firstActive.value = false;
		expect(fixture.popup.mock.results[0].value.dispose).toHaveBeenCalledOnce();
		expect(fixture.popup.mock.results[1].value.dispose).toHaveBeenCalledOnce();
		expect(fixture.popup.mock.results[2].value.dispose).not.toHaveBeenCalled();
		parent.dispose(); child.dispose();
		secondActive.value = false;
		expect(fixture.popup.mock.results[2].value.dispose).toHaveBeenCalledOnce();
	});

	test('an asynchronous launcher cannot reopen after its source unmounts', async () => {
		const visible = ref(true), shell = ref(true);
		const session = createHataGoesPopupSession(shell);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => visible.value ? h(source) : null; } }));
		visible.value = false;
		await nextTick();
		const closed = vi.fn();
		launch(defineComponent(() => () => null), {}, { closed });
		await Promise.resolve();
		expect(fixture.popup).not.toHaveBeenCalled();
		expect(closed).toHaveBeenCalledOnce();
	});

	test('a scoped menu settles if the shell leaves before its delayed import', async () => {
		const shell = ref(true);
		let launch!: ReturnType<typeof useHataGoesPopupMenu>;
		const source = defineComponent({ setup() { launch = useHataGoesPopupMenu(); return () => null; } });
		mount(defineComponent({ setup() {
			provide(HATA_GOES_HOST, { active: ref(true), register: vi.fn(), changed: vi.fn() });
			provide(HATA_GOES_SESSION, createHataGoesPopupSession(shell));
			return () => h(source);
		} }));
		const done = launch([], null);
		shell.value = false;
		await expect(done).resolves.toBeUndefined();
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('forced popup removal preserves its drafts before disposal and isolates failures', async () => {
		const visible = ref(true), shell = ref(true);
		const session = createHataGoesPopupSession(shell);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		const order: string[] = [];
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => visible.value ? h(source) : null; } }));
		const target = defineComponent({ setup() {
			const scope = inject(HATA_GOES_POPUP_SCOPE)!;
			scope.preserveDraft(() => { order.push('failed save'); throw new Error('storage'); });
			scope.preserveDraft(() => order.push('saved'));
			return () => null;
		} });
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			launch(target, {}, { closed: () => order.push('closed') });
			const wrapper = fixture.popup.mock.calls[0][0];
			mount(wrapper);
			const underlying = fixture.popup.mock.results[0].value;
			underlying.dispose.mockImplementation(() => order.push('disposed'));
			visible.value = false;
			await nextTick();
			expect(order).toEqual(['failed save', 'saved', 'closed', 'disposed']);
			expect(error).toHaveBeenCalledOnce();
		} finally { error.mockRestore(); }
	});

	test('shell cleanup saves inline drafts before closing popups even when one save throws', () => {
		const active = ref(true);
		const session = createHataGoesPopupSession(active);
		const order: string[] = [];
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			session.preserveDraft(() => { order.push('failed'); throw new Error('storage'); });
			session.preserveDraft(() => order.push('saved'));
			session.track(() => order.push('closed'));
			active.value = false;
			expect(order).toEqual(['failed', 'saved', 'closed']);
			expect(error).toHaveBeenCalledOnce();
		} finally { error.mockRestore(); }
	});

	test('one throwing closed callback cannot prevent sibling popup cleanup', () => {
		const active = ref(true);
		const session = createHataGoesPopupSession(active);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => h(source); } }));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			launch(defineComponent(() => () => null), {}, { closed: () => { throw new Error('closed'); } });
			const siblingClosed = vi.fn();
			launch(defineComponent(() => () => null), {}, { closed: siblingClosed });
			active.value = false;
			expect(siblingClosed).toHaveBeenCalledOnce();
			expect(fixture.popup.mock.results[0].value.dispose).toHaveBeenCalledOnce();
			expect(fixture.popup.mock.results[1].value.dispose).toHaveBeenCalledOnce();
			expect(error).toHaveBeenCalledOnce();
		} finally { error.mockRestore(); }
	});

	test('late picker results are ignored while disposal is pending', () => {
		const active = ref(true);
		const session = createHataGoesPopupSession(active);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopup>;
		const source = defineComponent({ setup() { launch = useHataGoesPopup(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => h(source); } }));
		const done = vi.fn();
		launch(defineComponent(() => () => null), {}, { done });
		const events = fixture.popup.mock.calls[0][2] as { done: () => void };
		active.value = false;
		events.done();
		expect(done).not.toHaveBeenCalled();
	});

	test('menu actions and deferred submenu actions cannot run after shell exit', async () => {
		const active = ref(true);
		const session = createHataGoesPopupSession(active);
		const host = { active: ref(true), register: vi.fn(), changed: vi.fn() };
		let launch!: ReturnType<typeof useHataGoesPopupMenu>;
		const source = defineComponent({ setup() { launch = useHataGoesPopupMenu(); return () => null; } });
		mount(defineComponent({ setup() { provide(HATA_GOES_HOST, host); provide(HATA_GOES_SESSION, session); return () => h(source); } }));
		const action = vi.fn();
		const pending = launch([
			{ type: 'button', text: 'save', action },
			{ type: 'parent', text: 'more', children: async () => [{ type: 'button', text: 'later', action }] },
			Promise.resolve({ type: 'button' as const, text: 'promised', action }),
		], null);
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalledOnce());
		const props = fixture.popup.mock.calls[0][1] as { items: Array<{ action?: (event: MouseEvent) => void; children?: () => Promise<unknown[]> }> };
		const click = new MouseEvent('click');
		props.items[0].action?.(click);
		expect(action).toHaveBeenCalledOnce();
		active.value = false;
		props.items[0].action?.(click);
		const children = await props.items[1].children?.();
		expect(children).toEqual([]);
		const promised = await (props.items[2] as Promise<{ action: (event: MouseEvent) => void }>);
		promised.action(click);
		expect(action).toHaveBeenCalledOnce();
		await expect(pending).resolves.toBeUndefined();
		active.value = true;
		props.items[0].action?.(click);
		promised.action(click);
		expect(action).toHaveBeenCalledOnce();
	});
});
