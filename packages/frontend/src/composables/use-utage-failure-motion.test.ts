/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { useUtageFailureMotion, UTAGE_FAILURE_DURATION } from './use-utage-failure-motion.js';

type UtageState = 'none' | 'flashing' | 'failed' | 'success';

const cleanups: Array<() => void> = [];
let reduced = false;
let documentHidden = false;
let motionMedia: MediaQueryList;

function required<T>(value: T | null | undefined): T {
	if (value == null) throw new Error('Expected mounted test element');
	return value;
}

function rect(left = 60, top = 120, width = 640, height = 180): DOMRect {
	return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) };
}

function setGeometry(element: HTMLElement, bounds: DOMRect) {
	Object.defineProperties(element, {
		// Give every element its own mock: spying on an already-mocked prototype
		// method would otherwise change the geometry of all parents and children.
		getBoundingClientRect: { configurable: true, value: vi.fn(() => bounds) },
		getClientRects: { configurable: true, value: vi.fn(() => [bounds] as unknown as DOMRectList) },
		offsetWidth: { configurable: true, get: () => bounds.width },
		offsetHeight: { configurable: true, get: () => bounds.height },
		offsetTop: { configurable: true, get: () => 0 },
		offsetLeft: { configurable: true, get: () => 0 },
		clientWidth: { configurable: true, get: () => bounds.width },
		clientHeight: { configurable: true, get: () => bounds.height },
	});
}

function emitReducedMotion(value: boolean) {
	reduced = value;
	const event = new Event('change');
	Object.defineProperties(event, { matches: { value }, media: { value: '(prefers-reduced-motion: reduce)' } });
	motionMedia.dispatchEvent(event);
}

function mountNote(initialState: UtageState = 'flashing', enabled = true) {
	const root = ref<HTMLElement | null>(null);
	const article = ref<HTMLElement | null>(null);
	const state = ref<UtageState>(initialState);
	const animationEnabled = ref(enabled);
	const click = vi.fn();
	const app = createApp(defineComponent({
		setup() {
			useUtageFailureMotion({ root, article, state, animationEnabled, failedText: '宴失敗' });
			return () => h('div', { ref: root }, [
				h('article', { ref: article }, [
					h('p', '宴の投稿本文'),
					h('button', { id: 'original-reaction', name: 'reaction', onClick: click }, 'リアクション'),
					state.value === 'failed'
						? h('span', { 'data-final-badge': '' }, '宴失敗')
						: h('span', { 'data-running-badge': '' }, '宴進行中'),
				]),
			]);
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	const rootElement = required(root.value);
	const articleElement = required(article.value);
	setGeometry(container, rect(0, 0, 1024, 768));
	setGeometry(rootElement, rect());
	setGeometry(articleElement, rect());
	let mounted = true;
	const unmount = () => {
		if (!mounted) return;
		app.unmount();
		container.remove();
		mounted = false;
	};
	cleanups.push(unmount);
	return {
		root: rootElement,
		article: articleElement,
		container,
		state,
		animationEnabled,
		click,
		unmount,
		overlay: () => rootElement.querySelector<HTMLElement>(':scope > section[data-utage-failure-motion]'),
		fail: async () => { state.value = 'failed'; await nextTick(); },
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	reduced = false;
	documentHidden = false;
	const target = new EventTarget();
	Object.defineProperties(target, {
		matches: { get: () => reduced },
		media: { value: '(prefers-reduced-motion: reduce)' },
	});
	motionMedia = target as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockReturnValue(motionMedia);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => documentHidden);
	vi.spyOn(window.document, 'visibilityState', 'get').mockImplementation(() => documentHidden ? 'hidden' : 'visible');
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(handle => window.clearTimeout(handle));
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1024, 768));
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect(0, 0, 1024, 768)] as unknown as DOMRectList);
	vi.spyOn(Math, 'random').mockReturnValue(0);
	vi.stubGlobal('innerWidth', 1024);
	vi.stubGlobal('innerHeight', 768);
});

afterEach(() => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	window.document.body.replaceChildren();
});

describe('宴失敗の分割演出', () => {
	test.each([
		[0, 'horizontal'], [0.499, 'horizontal'],
		[0.5, 'vertical'], [0.749, 'vertical'],
		[0.75, 'diagonal'], [0.999, 'diagonal'],
	] as const)('乱数%fは%s方向の2枚へ分割する', async (random, direction) => {
		vi.mocked(Math.random).mockReturnValue(random);
		const view = mountNote();
		await view.fail();
		const overlay = view.overlay();
		expect(overlay).not.toBeNull();
		expect(overlay?.dataset.utageFailureMotion).toBe(direction);
		expect(overlay?.querySelectorAll('[data-utage-failure-half]')).toHaveLength(2);
		expect(overlay?.querySelector('[data-utage-failure-label]')?.textContent).toBe('宴失敗');
	});

	test('更新前の進行中ノートを複製し、1650msの後半に本物の失敗表示へ戻す', async () => {
		const view = mountNote();
		view.article.style.opacity = '0.65';
		await view.fail();
		expect(UTAGE_FAILURE_DURATION).toBe(1650);
		expect(view.article.style.opacity).toBe('0');
		expect(view.article.querySelector('[data-final-badge]')).not.toBeNull();
		const snapshots = required(view.overlay()).querySelectorAll('[data-utage-failure-snapshot]');
		expect(snapshots).toHaveLength(2);
		for (const snapshot of snapshots) {
			expect(snapshot.querySelector('[data-running-badge]')).not.toBeNull();
			expect(snapshot.querySelector('[data-final-badge]')).toBeNull();
		}

		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION - 100);
		expect(view.overlay()).not.toBeNull();
		expect(Number(view.article.style.opacity)).toBeGreaterThan(0);
		await vi.advanceTimersByTimeAsync(116);
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('0.65');
		expect(view.article.querySelector('[data-final-badge]')?.textContent).toBe('宴失敗');
	});

	test('ラベルが小さく現れて中間で拡大し、終了前に薄くなる', async () => {
		const view = mountNote();
		await view.fail();
		const label = required(required(view.overlay()).querySelector<HTMLElement>('[data-utage-failure-label]'));
		const scale = () => Number(/scale\(([^)]+)\)/.exec(label.style.transform)?.[1]);
		const initialScale = scale();
		expect(initialScale).toBeGreaterThan(0);
		expect(initialScale).toBeLessThan(0.2);
		expect(Number(label.style.opacity)).toBe(0);
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION * 0.5);
		expect(scale()).toBeGreaterThan(initialScale);
		expect(scale()).toBeCloseTo(1, 1);
		const middleOpacity = Number(label.style.opacity);
		expect(middleOpacity).toBeGreaterThan(0.9);
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION * 0.44);
		expect(view.overlay()).not.toBeNull();
		expect(Number(label.style.opacity)).toBeLessThan(middleOpacity);
		expect(Number(label.style.opacity)).toBeLessThan(0.1);
	});

	test('非同期のリアクション行追加や位置変更が続いても外枠を追従させ最後まで再生する', async () => {
		let notify: (() => void) | undefined;
		const disconnect = vi.fn();
		vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
			constructor(onResize: ResizeObserverCallback) {
				notify = () => onResize([], this);
			}

			observe = vi.fn(() => required(notify)());
			unobserve = vi.fn();
			disconnect = disconnect;
		});
		const view = mountNote();
		view.article.style.opacity = '0.65';
		let settledHeight = 210;
		let settledTop = 0;
		Object.defineProperty(view.article, 'offsetHeight', {
			configurable: true,
			get: () => view.article.querySelector('[data-final-badge]') ? settledHeight : 180,
		});
		Object.defineProperty(view.article, 'offsetTop', { configurable: true, get: () => settledTop });
		expect(view.article.offsetHeight).toBe(180);
		await view.fail();
		await nextTick();
		expect(view.article.offsetHeight).toBe(210);
		const overlay = required(view.overlay());
		expect(overlay.style.height).toBe('210px');
		expect(required(overlay.querySelector<HTMLElement>('[data-utage-failure-snapshot]')).style.height).toBe('180px');
		required(notify)();
		expect(view.overlay()).toBe(overlay);
		expect(disconnect).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(120);
		settledHeight = 240;
		settledTop = 12;
		required(notify)();
		expect(view.overlay()).toBe(overlay);
		expect(overlay.style.height).toBe('240px');
		expect(overlay.style.top).toBe('12px');
		await vi.advanceTimersByTimeAsync(400);
		settledHeight = 260;
		required(notify)();
		expect(view.overlay()).toBe(overlay);
		expect(overlay.style.height).toBe('260px');
		for (const half of overlay.querySelectorAll<HTMLElement>('[data-utage-failure-half]')) {
			expect(half.style.width).toBe('640px');
			expect(half.style.height).toBe('180px');
		}
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION - 520 + 16);
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('0.65');
		expect(disconnect).toHaveBeenCalledTimes(1);
	});

	test('絵文字ピッカー終了時のフォーカス復帰と自動スクロールでは中止しない', async () => {
		const view = mountNote();
		view.root.tabIndex = -1;
		await view.fail();
		const overlay = required(view.overlay());
		await vi.advanceTimersByTimeAsync(100);
		required(view.article.querySelector('button')).focus();
		view.container.dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(100);
		view.root.focus();
		window.document.dispatchEvent(new Event('scroll'));
		expect(view.overlay()).toBe(overlay);
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION - 200 - 100);
		expect(view.overlay()).toBe(overlay);
		await vi.advanceTimersByTimeAsync(116);
		expect(view.overlay()).toBeNull();
	});

	test('別のカラムのスクロール操作では中止しない', async () => {
		const view = mountNote();
		await view.fail();
		const otherColumn = window.document.createElement('div');
		window.document.body.append(otherColumn);
		otherColumn.dispatchEvent(new Event('wheel', { bubbles: true }));
		otherColumn.dispatchEvent(new Event('touchmove', { bubbles: true }));
		otherColumn.dispatchEvent(new Event('scroll'));
		expect(view.overlay()).not.toBeNull();
	});

	test.each(['ResizeObserver', 'window.resize'])('%sで本文の横幅が変わった場合は中止して本物を戻す', async (notification) => {
		let notify: (() => void) | undefined;
		vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
			constructor(onResize: ResizeObserverCallback) { notify = () => onResize([], this); }
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		});
		const view = mountNote();
		await view.fail();
		await nextTick();
		setGeometry(view.article, rect(60, 120, 480));
		if (notification === 'ResizeObserver') required(notify)();
		else window.dispatchEvent(new Event('resize'));
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('');
	});

	test('モバイルのピッカー閉鎖に伴う画面の高さだけの変化では中止しない', async () => {
		const view = mountNote();
		await view.fail();
		const overlay = required(view.overlay());
		vi.stubGlobal('innerHeight', 640);
		window.dispatchEvent(new Event('resize'));
		expect(view.overlay()).toBe(overlay);
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION + 16);
		expect(view.overlay()).toBeNull();
	});

	test('stickyアバターの描画位置を両方の複製に引き継ぎ、本物の配置を変えない', async () => {
		const view = mountNote();
		const avatar = window.document.createElement('span');
		avatar.dataset.testStickyAvatar = '';
		avatar.style.cssText = 'position:sticky;top:12px;left:4px;transform:scale(0.9)';
		avatar.textContent = 'アバター';
		view.article.append(avatar);
		const originalStyle = avatar.style.cssText;
		// The note itself is rendered at 2x width/height; translate must use its local coordinates.
		vi.mocked(view.article.getBoundingClientRect).mockReturnValue(rect(60, 120, 1280, 360));
		vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
			if (this === avatar) return rect(100, 160, 48, 48);
			if (this.hasAttribute('data-test-sticky-avatar')) return rect(80, 120, 48, 48);
			return rect(0, 0, 1024, 768);
		});
		await view.fail();
		const overlay = required(view.overlay());
		const copies = overlay.querySelectorAll<HTMLElement>('[data-test-sticky-avatar]');
		expect(copies).toHaveLength(2);
		for (const copy of copies) {
			expect(copy.style.position).toBe('relative');
			expect(copy.style.top).toBe('auto');
			expect(copy.style.left).toBe('auto');
			expect(copy.style.transform).toBe('translate(10px, 20px) scale(0.9)');
			expect(copy.hasAttribute('data-utage-failure-sticky')).toBe(false);
		}
		expect(avatar.style.cssText).toBe(originalStyle);
		expect(avatar.parentElement).toBe(view.article);
	});

	test.each(['none', 'failed', 'success'] as const)('初期%sからfailedになっても遡って再生しない', async (initial) => {
		const view = mountNote(initial);
		expect(view.overlay()).toBeNull();
		await view.fail();
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('');
	});

	test('失敗の重複通知では演出を作り直さず、成功への遷移では残さない', async () => {
		const view = mountNote();
		await view.fail();
		const overlay = view.overlay();
		await view.fail();
		expect(view.overlay()).toBe(overlay);
		expect(view.root.querySelectorAll('section[data-utage-failure-motion]')).toHaveLength(1);
		view.state.value = 'success';
		await nextTick();
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('');
	});

	test('画像や再生媒体を持たない操作不能な複製にし、本物のIDと操作を保つ', async () => {
		const view = mountNote();
		const original = required(view.article.querySelector('button'));
		original.setAttribute('onclick', 'return false');
		const media = window.document.createElement('div');
		media.innerHTML = '<img alt="添付画像" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><video muted><source src="data:video/mp4;base64,"></video><audio><source src="data:audio/mp3;base64,"></audio><iframe srcdoc="<p>埋め込み</p>"></iframe><canvas></canvas><input id="original-input" name="draft" value="入力中">';
		view.article.append(media);
		await view.fail();
		const overlay = required(view.overlay());
		expect(overlay.inert).toBe(true);
		expect(overlay.getAttribute('aria-hidden')).toBe('true');
		expect(overlay.querySelectorAll('[id], [name], [onclick]')).toHaveLength(0);
		expect(overlay.querySelectorAll('img, video, audio, source, iframe')).toHaveLength(0);
		expect(overlay.querySelectorAll('canvas, span').length).toBeGreaterThan(0);
		const copiedButton = overlay.querySelector('button');
		copiedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.click).not.toHaveBeenCalled();
		expect(original.id).toBe('original-reaction');
		expect(original.name).toBe('reaction');
		expect(view.article.querySelectorAll('img, video, audio, iframe, canvas')).toHaveLength(5);
		view.root.dispatchEvent(new Event('pointerdown'));
		original.click();
		expect(view.click).toHaveBeenCalledTimes(1);
	});
});

describe('宴失敗演出の軽減と中止', () => {
	test.each(['アプリ設定', 'OS設定', '非表示タブ'] as const)('%sで軽減中は開始しない', async (setting) => {
		if (setting === 'OS設定') reduced = true;
		if (setting === '非表示タブ') documentHidden = true;
		const view = mountNote('flashing', setting !== 'アプリ設定');
		await view.fail();
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('');
	});

	test.each(['アプリ設定', 'OS設定', 'visibilitychange', 'pagehide', 'wheel', 'touchmove', 'pointerdown', 'keydown', 'unmount'] as const)('%sで直ちに中止し元のopacityへ復元する', async (reason) => {
		const view = mountNote();
		view.article.style.opacity = '0.4';
		await view.fail();
		expect(view.overlay()).not.toBeNull();
		expect(view.article.style.opacity).toBe('0');
		switch (reason) {
			case 'アプリ設定': view.animationEnabled.value = false; break;
			case 'OS設定': emitReducedMotion(true); break;
			case 'visibilitychange':
				documentHidden = true;
				window.document.dispatchEvent(new Event('visibilitychange'));
				break;
			case 'pagehide': window.dispatchEvent(new Event(reason)); break;
			case 'wheel':
			case 'touchmove': view.container.dispatchEvent(new Event(reason, { bubbles: true })); break;
			case 'pointerdown':
			case 'keydown': required(view.article.querySelector('button')).dispatchEvent(new Event(reason, { bubbles: true })); break;
			case 'unmount': view.unmount(); break;
		}
		await nextTick();
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('0.4');
		await vi.advanceTimersByTimeAsync(UTAGE_FAILURE_DURATION + 32);
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('0.4');
	});

	test('設定を戻しても既に失敗したノートを遅れて再生しない', async () => {
		const view = mountNote('flashing', false);
		await view.fail();
		view.animationEnabled.value = true;
		await nextTick();
		expect(view.overlay()).toBeNull();
	});

	test.each(['画面下', '画面右', '幅ゼロ', '高さゼロ', 'display:none', 'visibility:hidden', 'opacity:0', '祖先のoverflow'] as const)('%sで見えないノートは開始しない', async (hiddenBy) => {
		const view = mountNote();
		switch (hiddenBy) {
			case '画面下': setGeometry(view.article, rect(60, 900)); break;
			case '画面右': setGeometry(view.article, rect(1100, 120)); break;
			case '幅ゼロ': setGeometry(view.article, rect(60, 120, 0)); break;
			case '高さゼロ': setGeometry(view.article, rect(60, 120, 640, 0)); break;
			case 'display:none': view.container.style.display = 'none'; break;
			case 'visibility:hidden': view.container.style.visibility = 'hidden'; break;
			case 'opacity:0': view.container.style.opacity = '0'; break;
			case '祖先のoverflow':
				// happy-dom does not expand the overflow shorthand into its computed longhands.
				view.container.style.overflowY = 'hidden';
				setGeometry(view.container, rect(0, 0, 1024, 60));
				break;
		}
		await view.fail();
		expect(view.overlay()).toBeNull();
		expect(view.article.style.opacity).toBe('');
	});
});
