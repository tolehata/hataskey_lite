/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { useUtageRevivalMotion } from './use-utage-revival-motion.js';

type State = 'none' | 'flashing' | 'reviving' | 'success' | 'failed';
const cleanups: (() => void)[] = [];
let hidden = false;
let media: MediaQueryList;
const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
const geometry = { x: 10, y: 10, left: 10, top: 10, right: 650, bottom: 250, width: 640, height: 240, toJSON: () => ({}) };
beforeEach(() => {
	vi.useFakeTimers(); hidden = false; animations.length = 0;
	media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockReturnValue(media);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(geometry);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
	Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => {
		const animation = { cancel: vi.fn(), finished: new Promise(() => {}) }; animations.push(animation); return animation;
	}) });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers();
	delete (Element.prototype as { animate?: unknown }).animate;
});

function mount(initial: State = 'flashing', enabled = true) {
	const root = ref<HTMLElement | null>(null), state = ref<State>(initial), animationEnabled = ref(enabled);
	const host = window.document.createElement('div'); window.document.body.append(host);
	const app = createApp({ setup() {
		useUtageRevivalMotion({ root, frame: root, state, animationEnabled });
		return () => h('article', { ref: root, style: { borderRadius: '17px 17px 17px 5px' } }, [
			h('p', '宴の本文'), h('button', 'リアクション'),
			h('div', { 'data-utage-status-line': '' }, [h('i', { 'data-utage-revival-symbol': '' }), state.value]),
		]);
	} }); app.mount(host);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); host.remove(); mounted = false; } };
	cleanups.push(unmount);
	return { host, root: root.value!, state, animationEnabled, unmount, overlay: () => host.querySelector<HTMLElement>('.utage-revival-motion'), start: async () => { state.value = 'reviving'; await nextTick(); } };
}

describe('復活開始の演出', () => {
	test('開始の遷移だけで枠を描き、実際の非対称な角丸を使い、完了時に解放する', async () => {
		const view = mount(); await nextTick(); expect(view.overlay()).toBeNull(); await view.start();
		expect(view.overlay()).not.toBeNull(); expect(view.overlay()?.inert).toBe(true);
		expect(view.overlay()?.getAttribute('aria-hidden')).toBe('true');
		expect(view.overlay()?.querySelectorAll('.utage-revival-fragment')).toHaveLength(4);
		expect(view.overlay()?.querySelector('.utage-revival-trace')?.getAttribute('d')).toContain('H5Q1 239 1 235');
		expect(view.host.querySelectorAll('button')).toHaveLength(1);
		const original = view.overlay(); await view.start(); expect(view.overlay()).toBe(original);
		await vi.advanceTimersByTimeAsync(1760);
		expect(view.overlay()).toBeNull(); expect(view.root.dataset.utageRevivalMotion).toBeUndefined();
		expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});
	test.each(['none', 'reviving', 'failed', 'success'] as const)('初期%sからの読み込み・更新では再演しない', async initial => {
		const view = mount(initial); await view.start(); expect(view.overlay()).toBeNull();
	});
	test.each(['pointerdown', 'wheel', 'touchmove', 'keydown', 'resize', 'pagehide', '非表示', 'OS', '設定', '確定', 'unmount'] as const)('%sで演出を解除して操作を妨げない', async reason => {
		const view = mount(); await view.start(); expect(view.overlay()).not.toBeNull();
		if (['pointerdown', 'wheel', 'touchmove', 'keydown'].includes(reason)) view.root.querySelector('button')!.dispatchEvent(new Event(reason, { bubbles: true }));
		if (reason === 'resize' || reason === 'pagehide') window.dispatchEvent(new Event(reason));
		if (reason === '非表示') { hidden = true; window.document.dispatchEvent(new Event('visibilitychange')); }
		if (reason === 'OS') media.dispatchEvent(new Event('change'));
		if (reason === '設定') view.animationEnabled.value = false;
		if (reason === '確定') view.state.value = 'success';
		if (reason === 'unmount') view.unmount();
		await nextTick(); expect(view.overlay()).toBeNull(); expect(view.root.dataset.utageRevivalMotion).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});
	test.each(['設定', '非表示', '画面外', '祖先非表示'] as const)('%sでは開始を省略する', async reason => {
		const view = mount('flashing', reason !== '設定');
		if (reason === '非表示') hidden = true;
		if (reason === '画面外') vi.spyOn(view.root, 'getBoundingClientRect').mockReturnValue({ ...geometry, top: 100000, bottom: 100240 });
		if (reason === '祖先非表示') view.host.style.display = 'none';
		await view.start(); expect(view.overlay()).toBeNull();
	});
});
