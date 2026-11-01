/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import Hk3AudienceIcons from './Hk3AudienceIcons.vue';
import { useHk3AvatarClearance } from './use-hk3-avatar-clearance.js';

vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	_visibility: { public: 'Public' },
	_hata: { _hataskeyUi3: { federateTitle: 'Federated', localOnlyTitle: 'Local only' } },
} } }));

const cleanups: (() => void)[] = [];
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const resizes: ResizeMock[] = [];
const mutations: MutationMock[] = [];

class ResizeMock {
	observe = vi.fn();
	disconnect = vi.fn();
	constructor(readonly callback: () => void) { resizes.push(this); }
}

class MutationMock {
	observe = vi.fn();
	disconnect = vi.fn();
	constructor(readonly callback: () => void) { mutations.push(this); }
}

function flushFrame() {
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback(0);
}

function geometry(element: Element, bottom: number, visible = true) {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
		x: 0, y: 0, top: 0, left: 0, right: 44, bottom, width: 44, height: bottom,
		toJSON: () => ({}),
	});
	vi.spyOn(element, 'getClientRects').mockReturnValue((visible ? [{ bottom }] : []) as unknown as DOMRectList);
}

function image(avatar: Element, bottom: number, options: { marked?: boolean; visible?: boolean; complete?: boolean; broken?: boolean } = {}) {
	const img = window.document.createElement('img');
	if (options.marked !== false) img.setAttribute('data-avatar-decoration', '');
	Object.defineProperties(img, {
		complete: { configurable: true, value: options.complete !== false },
		naturalWidth: { configurable: true, value: options.broken ? 0 : 200 },
		naturalHeight: { configurable: true, value: options.broken ? 0 : 300 },
	});
	geometry(img, bottom, options.visible !== false);
	avatar.append(img);
	return img;
}

async function mount() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h('div', [
		h('span', { 'data-unrelated': '' }),
		h('span', { 'data-avatar': '' }),
		h(Hk3AudienceIcons, { visibility: 'public' }),
	]) });
	app.mount(target);
	const avatar = target.querySelector<HTMLElement>('[data-avatar]')!;
	const row = target.querySelector<HTMLElement>('[data-audience-icons]')!;
	geometry(avatar, 44);
	geometry(row, 70);
	const cleanup = () => { app.unmount(); target.remove(); };
	cleanups.push(cleanup);
	await nextTick();
	return { target, avatar, row, cleanup };
}

beforeEach(() => {
	frames.clear();
	frameId = 0;
	resizes.length = 0;
	mutations.length = 0;
	vi.stubGlobal('ResizeObserver', ResizeMock);
	vi.stubGlobal('MutationObserver', MutationMock);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
		frames.set(++frameId, callback);
		return frameId;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('UI S avatar decoration clearance', () => {
	it('keeps an 8px gap below the greatest rendered decoration bottom', async () => {
		const { avatar, row } = await mount();
		const first = image(avatar, 66);
		const transformed = image(avatar, 93.5);
		transformed.style.transform = 'rotate(35deg) scale(1.4) translateY(10px)';
		image(avatar, 500, { marked: false }); // Normal avatar / online indicator are excluded.
		flushFrame();
		expect(row.style.marginTop).toBe('57.5px');
		expect(44 + Number.parseFloat(row.style.marginTop) - 93.5).toBe(8);
		expect(resizes[0].observe.mock.calls.map(([element]) => element)).toEqual([avatar, avatar, first, transformed]);
	});

	it('keeps 8px for absent, hidden, pending, broken, or non-overhanging decorations', async () => {
		const { target, avatar, row } = await mount();
		image(target.querySelector('[data-unrelated]')!, 600);
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		image(avatar, 200, { visible: false });
		image(avatar, 200, { complete: false });
		image(avatar, 200, { broken: true });
		image(avatar, 40);
		const hidden = image(avatar, 200);
		hidden.style.visibility = 'hidden';
		mutations[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		image(avatar, 90);
		geometry(avatar, 0, false);
		resizes[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		geometry(avatar, 44);
		geometry(row, 0, false);
		resizes[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
	});

	it('coalesces captured load, attribute mutations and resize, then handles image errors', async () => {
		const { avatar, row } = await mount();
		const img = image(avatar, 84, { complete: false });
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		Object.defineProperty(img, 'complete', { value: true });
		img.dispatchEvent(new Event('load')); // load does not bubble.
		mutations[0].callback();
		resizes[0].callback();
		expect(frames.size).toBe(1);
		flushFrame();
		expect(row.style.marginTop).toBe('48px');
		img.style.translate = '0 20%';
		img.setAttribute('src', 'replacement.png');
		geometry(img, 101);
		mutations[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('65px');
		geometry(avatar, 54);
		resizes[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('55px');
		Object.defineProperty(img, 'naturalWidth', { value: 0 });
		img.dispatchEvent(new Event('error'));
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		expect(mutations[0].observe).toHaveBeenCalledWith(avatar, {
			childList: true, subtree: true, attributes: true,
			attributeFilter: ['style', 'class', 'src', 'srcset', 'hidden', 'data-avatar-decoration'],
		});
		expect(frames.size).toBe(0);
	});

	it('observes decorations inserted later and restores the fallback after DOM removal', async () => {
		const { avatar, row } = await mount();
		flushFrame();
		const img = image(avatar, 80);
		mutations[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('44px');
		expect(resizes[0].observe).toHaveBeenCalledWith(img);
		img.remove();
		mutations[0].callback();
		flushFrame();
		expect(row.style.marginTop).toBe('8px');
		expect(resizes[0].observe).toHaveBeenLastCalledWith(avatar);
	});

	it('cancels pending frames and removes observers and capture listeners on unmount', async () => {
		const { avatar, cleanup } = await mount();
		const removeListener = vi.spyOn(avatar, 'removeEventListener');
		expect(frames.size).toBe(1);
		cleanup();
		cleanups.pop();
		expect(frames.size).toBe(0);
		expect(cancelAnimationFrame).toHaveBeenCalled();
		expect(resizes[0].disconnect).toHaveBeenCalled();
		expect(mutations[0].disconnect).toHaveBeenCalled();
		for (const event of ['load', 'error']) expect(removeListener).toHaveBeenCalledWith(event, expect.any(Function), true);
		avatar.dispatchEvent(new Event('load'));
		mutations[0].callback();
		resizes[0].callback();
		expect(frames.size).toBe(0);
	});

	it('cleans up and measures the new preceding avatar when the root ref is rebound', async () => {
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const root = ref<HTMLElement | null>(null);
		const key = ref(0);
		const app = createApp({
			setup() {
				useHk3AvatarClearance(root);
				return () => h('div', { key: key.value }, [h('span'), h('div', { ref: root })]);
			},
		});
		app.mount(target);
		cleanups.push(() => { app.unmount(); target.remove(); });
		await nextTick();
		const oldAvatar = root.value!.previousElementSibling!;
		key.value++;
		await nextTick();
		expect(resizes[0].disconnect).toHaveBeenCalled();
		expect(mutations[0].disconnect).toHaveBeenCalled();
		expect(cancelAnimationFrame).toHaveBeenCalled();
		const row = root.value!;
		const avatar = row.previousElementSibling!;
		expect(avatar).not.toBe(oldAvatar);
		geometry(avatar, 44);
		geometry(row, 90);
		image(avatar, 72);
		flushFrame();
		expect(row.style.marginTop).toBe('36px');
		expect(mutations[1].observe.mock.calls[0][0]).toBe(avatar);
	});
});
