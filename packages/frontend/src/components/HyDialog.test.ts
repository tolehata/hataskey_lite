/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HyDialog from './HyDialog.vue';
import MkModal from './MkModal.vue';
import HatadyDraftPrompt from './HatadyDraftPrompt.vue';
import { focusTrap } from '@/utility/focus-trap.js';

vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));

const fixtures = vi.hoisted(() => ({ zIndex: 100, viewportInset: 0 }));
vi.mock('@/os.js', () => ({ claimZIndex: () => ++fixtures.zIndex }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, useBlurEffectForModal: false } } }));
vi.mock('@/utility/touch.js', () => ({ isTouchUsing: false }));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/utility/viewport-inset.js', () => ({ getViewportTopInset: (element?: Element) => element?.closest('[data-contained]') ? 0 : fixtures.viewportInset }));
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('light') }));

const cleanup: Array<() => void> = [];

async function settle() { await nextTick(); await nextTick(); }

beforeEach(() => {
	fixtures.viewportInset = 0;
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(async () => {
	cleanup.splice(0).reverse().forEach(fn => fn());
	await settle();
	vi.unstubAllGlobals();
});

function mountEditor() {
	const page = window.document.createElement('main');
	page.innerHTML = '<button>ページ上の操作</button>';
	window.document.body.append(page);
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const prompt = ref(false);
	const dialog = ref<InstanceType<typeof HyDialog> | null>(null);
	const returnToEditing = () => { prompt.value = false; };
	const app = createApp({
		setup() {
			return () => [
				h(HyDialog, { ref: dialog, title: '記録', inert: prompt.value }, { default: () => h('button', { onClick: () => { prompt.value = true; } }, '下書きを確認') }),
				prompt.value ? h(HatadyDraftPrompt, { onReturn: returnToEditing, onSave: returnToEditing, onDiscard: returnToEditing }) : null,
			];
		},
	});
	app.directive('hotkey', {});
	app.mount(host);
	const roots = new Set<HTMLElement>();
	const captureRoots = () => {
		for (const panel of host.querySelectorAll<HTMLElement>('[role="dialog"]')) roots.add(panel.parentElement!.parentElement!);
	};
	cleanup.push(() => {
		captureRoots();
		// Release the actual trap registry even when testing the broken unmount path.
		for (const root of roots) {
			if (!root.isConnected) host.append(root);
			focusTrap(root).release();
		}
		app.unmount(); host.remove(); page.remove();
	});
	return { host, page, prompt, dialog, captureRoots };
}

function isInert(element: HTMLElement): boolean {
	return element.inert || (element.parentElement ? isInert(element.parentElement) : false);
}

describe('Hatady draft dialog focus lifecycle', () => {
	test('returning from a removed draft prompt restores the editor and closing it restores the page', async () => {
		const view = mountEditor();
		await settle();
		const editor = view.host.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(isInert(view.page)).toBe(true);
		expect(isInert(editor)).toBe(false);
		view.prompt.value = true;
		await settle();
		view.captureRoots();
		expect(isInert(editor)).toBe(true);
		const confirm = [...view.host.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1)!;
		const back = [...confirm.querySelectorAll('button')].find(button => button.textContent === '編集に戻る')!;
		back.click();
		await settle();
		expect(view.host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(isInert(editor), 'The removed draft prompt must release its real MkModal focus trap').toBe(false);
		expect(isInert(view.page), 'The remaining editor must still block the background').toBe(true);
		view.dialog.value!.close();
		await settle();
		expect(isInert(view.page), 'Closing the last editor must restore page interaction').toBe(false);
	});
});

async function mountPlainModals(withAnchor = false) {
	const page = window.document.createElement('main');
	page.innerHTML = '<button>背景の操作</button>';
	const anchor = page.querySelector('button')!;
	const host = window.document.createElement('div');
	window.document.body.append(page, host);
	const showFirst = ref(true), showSecond = ref(false);
	const first = ref<InstanceType<typeof MkModal> | null>(null);
	const second = ref<InstanceType<typeof MkModal> | null>(null);
	const app = createApp({
		setup() {
			return () => [
				showFirst.value ? h(MkModal, { ref: first, preferType: 'dialog', anchorElement: withAnchor ? anchor : null }, { default: () => h('button', { 'data-plain-modal': 'first' }, '最初のモーダル') }) : null,
				showSecond.value ? h(MkModal, { ref: second, preferType: 'dialog', anchorElement: withAnchor ? anchor : null }, { default: () => h('button', { 'data-plain-modal': 'second' }, '手前のモーダル') }) : null,
			];
		},
	});
	app.directive('hotkey', {});
	app.mount(host);
	const roots = new Set<HTMLElement>();
	const captureRoots = () => {
		for (const button of host.querySelectorAll<HTMLElement>('[data-plain-modal]')) roots.add(button.parentElement!.parentElement!);
	};
	cleanup.push(() => {
		captureRoots();
		for (const root of roots) {
			if (!root.isConnected) host.append(root);
			focusTrap(root).release();
		}
		app.unmount(); host.remove(); page.remove();
	});
	await settle();
	captureRoots();
	return { page, host, anchor, first, second, showFirst, showSecond, captureRoots };
}

describe('plain MkModal focus cleanup', () => {
	test('a normal close restores its background before the closed component is removed', async () => {
		const view = await mountPlainModals();
		expect(isInert(view.page)).toBe(true);
		view.first.value!.close();
		await settle();
		expect(isInert(view.page)).toBe(false);
		view.showSecond.value = true;
		await settle();
		view.captureRoots();
		view.showFirst.value = false;
		await settle();
		expect(isInert(view.page)).toBe(true);
		expect(isInert(view.host.querySelector<HTMLElement>('[data-plain-modal="second"]')!)).toBe(false);
		view.second.value!.close();
		await settle();
		expect(isInert(view.page)).toBe(false);
	});

	test('removing a visible modal through v-if restores background interaction', async () => {
		const view = await mountPlainModals();
		expect(isInert(view.page)).toBe(true);
		view.showFirst.value = false;
		await settle();
		expect(view.host.querySelector('[data-plain-modal]')).toBeNull();
		expect(isInert(view.page)).toBe(false);
	});

	test('removing an anchored modal also restores the anchor pointer events', async () => {
		const view = await mountPlainModals(true);
		expect(view.anchor.style.pointerEvents).toBe('none');
		view.showFirst.value = false;
		await settle();
		expect(view.anchor.style.pointerEvents).toBe('auto');
		expect(isInert(view.page)).toBe(false);
	});

	test('removing a closed modal does not unlock the same anchor used by a new modal', async () => {
		const view = await mountPlainModals(true);
		view.first.value!.close();
		await settle();
		expect(view.anchor.style.pointerEvents).toBe('auto');
		view.showSecond.value = true;
		await settle();
		view.captureRoots();
		expect(view.anchor.style.pointerEvents).toBe('none');
		view.showFirst.value = false;
		await settle();
		expect(view.anchor.style.pointerEvents).toBe('none');
		expect(isInert(view.page)).toBe(true);
		view.showSecond.value = false;
		await settle();
		expect(view.anchor.style.pointerEvents).toBe('auto');
		expect(isInert(view.page)).toBe(false);
	});

	test('removing the upper modal restores the lower modal while keeping its background blocked', async () => {
		const view = await mountPlainModals();
		const lower = view.host.querySelector<HTMLElement>('[data-plain-modal="first"]')!;
		view.showSecond.value = true;
		await settle();
		view.captureRoots();
		expect(isInert(lower)).toBe(true);
		expect(isInert(view.page)).toBe(true);
		view.showSecond.value = false;
		await settle();
		expect(isInert(lower)).toBe(false);
		expect(isInert(view.page)).toBe(true);
		view.showFirst.value = false;
		await settle();
		expect(isInert(view.page)).toBe(false);
	});
});

describe('MkModal popup viewport top exclusion', () => {
	test.each([
		{ name: 'desktop', inset: 0, contained: false, fixed: true, scrollY: 0 },
		{ name: 'iOS viewport', inset: 16, contained: false, fixed: true, scrollY: 0 },
		{ name: 'iOS contained shell', inset: 16, contained: true, fixed: true, scrollY: 0 },
		{ name: 'iOS scrolled document', inset: 16, contained: false, fixed: false, scrollY: 100 },
	])('$name keeps an anchored popup outside the top band', async ({ inset, contained, fixed, scrollY }) => {
		fixtures.viewportInset = inset;
		const heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight')!;
		const scrollDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
		Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
		cleanup.push(() => {
			Object.defineProperty(window, 'innerHeight', heightDescriptor);
			Object.defineProperty(window, 'scrollY', scrollDescriptor);
		});
		const host = window.document.createElement('div');
		if (contained) host.dataset.contained = '';
		const anchor = window.document.createElement('button');
		if (fixed) anchor.style.position = 'fixed';
		let anchorTop = 20;
		anchor.getBoundingClientRect = () => new DOMRect(100, anchorTop, 40, 20);
		Object.defineProperty(anchor, 'offsetWidth', { value: 40 });
		Object.defineProperty(anchor, 'offsetHeight', { value: 20 });
		window.document.body.append(anchor, host);
		const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
		const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
		cleanup.push(() => { offsetWidth.mockRestore(); offsetHeight.mockRestore(); });
		const anchorY = ref('center');
		const modal = ref<InstanceType<typeof MkModal> | null>(null);
		let realign: (() => void) | undefined;
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: () => void) { realign = callback; }
			observe() {}
			disconnect() {}
		});
		const app = createApp({
			setup: () => () => h(MkModal, { ref: modal, preferType: 'popup', anchorElement: anchor, anchor: { x: 'center', y: anchorY.value } }, {
				default: ({ maxHeight }: { maxHeight?: number }) => h('button', { 'data-popup-height': maxHeight }, '操作'),
			}),
		});
		app.directive('hotkey', {});
		app.mount(host);
		cleanup.push(() => { app.unmount(); host.remove(); anchor.remove(); });
		await settle();
		const button = host.querySelector<HTMLButtonElement>('[data-popup-height]')!;
		const content = button.parentElement!;
		const originTop = contained ? inset : 0;
		const documentOffset = fixed ? 0 : scrollY;
		expect(parseFloat(content.style.top) + originTop - documentOffset).toBe(inset + 16);
		// Moving the same anchor to the bottom must still flip above it, with
		// maxHeight calculated from the usable top edge rather than the viewport's 0.
		anchorTop = 560;
		anchorY.value = 'bottom';
		await settle();
		realign!();
		await settle();
		expect(parseFloat(content.style.top) + originTop - documentOffset).toBe(360);
		expect(Number(button.dataset.popupHeight)).toBe(560 - inset - 16);
		modal.value!.close();
		await settle();
		expect(anchor.style.pointerEvents).toBe('auto');
	});
});
