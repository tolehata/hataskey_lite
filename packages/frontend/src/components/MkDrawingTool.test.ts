/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkDrawingTool from './MkDrawingTool.vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import type { App } from 'vue';
import { i18n } from '@/i18n.js';
import { hatadintCopy as ui } from '@/utility/hatadint-copy.js';

const { api, upload, chooseDrive, proxyImage, post, alert, abortUpload, modalClose, account } = vi.hoisted(() => ({
	api: vi.fn(), upload: vi.fn(), post: vi.fn(), alert: vi.fn(), abortUpload: vi.fn(), modalClose: vi.fn(),
	chooseDrive: vi.fn(), proxyImage: vi.fn(),
	account: { id: 'account-a', token: 'fixture-token' },
}));

vi.mock('@/components/MkModal.vue', () => ({
	default: defineComponent({
		emits: ['closed', 'click', 'esc'],
		setup: (_, { slots, emit, expose }) => {
			expose({ close: () => { modalClose(); emit('closed'); } });
			return () => h('div', {
				'data-modal-fixture': '',
				onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('click'); },
				onKeydown: (event: KeyboardEvent) => { if (event.target === event.currentTarget && event.key === 'Escape') emit('esc'); },
			}, slots.default?.());
		},
	}),
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/utility/drive.js', () => ({ uploadFile: upload, chooseDriveFile: chooseDrive }));
vi.mock('@/os.js', () => ({ post, alert, claimZIndex: () => 3100 }));
vi.mock('@/i.js', () => ({ $i: account }));
vi.mock('@/instance.js', () => ({ instance: { tosUrl: 'https://example.test/terms' } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { uploadFolder: 'drawing-folder' } } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/utility/media-proxy.js', () => ({ getProxiedImageUrl: proxyImage }));
vi.mock('@/i18n.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	const locale = load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Record<string, unknown>;
	const interpolate = (value: unknown): unknown => typeof value === 'object' && value !== null
		? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item)]))
		: (params: Record<string, string>) => String(value).replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? `{${key}}`);
	return { i18n: { ts: locale, tsx: interpolate(locale) } };
});

const copy = i18n.ts._hata._drawingTool;
const artwork = { id: 'drive-artwork', name: 'art.png', url: '/files/art.png', type: 'image/png' };
type Mounted = { app: App<Element>; container: HTMLDivElement; root: HTMLElement; done: ReturnType<typeof vi.fn>; closed: ReturnType<typeof vi.fn> };
const mounts: Mounted[] = [];
let rootWidth = 1280;
let rects: WeakMap<Element, DOMRect>;
let contexts: WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>;
const createdContexts: CanvasRenderingContext2D[] = [];
const captures = new Map<number, HTMLElement>();
const captureMethods = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'] as const;
const originalCaptureMethods = new Map(captureMethods.map(method => [method, Object.getOwnPropertyDescriptor(HTMLElement.prototype, method)]));
const observers: { targets: Set<Element>; callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];

function contextFor(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const existing = contexts.get(canvas);
	if (existing) return existing;
	const noop = () => undefined;
	const context = {
		canvas, clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
		beginPath: vi.fn(), closePath: noop, moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
		stroke: vi.fn(), fill: vi.fn(), save: noop, restore: noop, translate: noop, rotate: noop, scale: noop, clip: noop,
		setTransform: noop, resetTransform: noop, setLineDash: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
		getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' }),
		putImageData: vi.fn(), createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' }),
		createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }),
		globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, fillStyle: '#000', strokeStyle: '#000',
	} as unknown as CanvasRenderingContext2D;
	contexts.set(canvas, context);
	createdContexts.push(context);
	return context;
}

async function settle() {
	for (let i = 0; i < 6; i++) { await Promise.resolve(); await nextTick(); }
}

function resize() {
	for (const observer of observers) observer.callback([...observer.targets].map(target => ({ target, contentRect: target.getBoundingClientRect() })) as ResizeObserverEntry[], {} as ResizeObserver);
}

async function mount(canAttach = true, host = false) {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const done = vi.fn(), closed = vi.fn();
	const app = createApp(MkDrawingTool, { canAttach, onDone: done, onClosed: closed });
	if (host) app.provide(HATA_GOES_HOST, {} as never);
	app.mount(container);
	await settle();
	const root = container.querySelector<HTMLElement>('[data-hatadint]');
	if (!root) throw new Error('Hatadint root did not mount');
	resize();
	await settle();
	const result = { app, container, root, done, closed };
	mounts.push(result);
	return result;
}

function named(root: ParentNode, name: string, tag = 'button'): HTMLElement {
	const found = [...root.querySelectorAll<HTMLElement>(tag)].find(element => element.getAttribute('aria-label') === name || element.textContent?.trim() === name);
	if (!found) throw new Error(`Control missing: ${name}`);
	return found;
}

function popup(root: HTMLElement): HTMLDialogElement {
	const dialog = root.querySelector<HTMLDialogElement>('dialog[open]');
	if (!dialog) throw new Error('Popover is not open');
	return dialog;
}

async function click(root: ParentNode, name: string) {
	if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(1);
	else await new Promise(resolve => window.setTimeout(resolve, 0));
	named(root, name).click();
	await settle();
}

async function exportTo(root: HTMLElement, destination: string) { await click(root, ui.export); await click(popup(root), destination); }

async function agree(root: HTMLElement) {
	const checkbox = popup(root).querySelector<HTMLInputElement>('input[type="checkbox"]');
	if (!checkbox) throw new Error('Consent checkbox missing');
	checkbox.click();
	await settle();
	await click(popup(root), ui.agreeContinue);
}

function drawingSurface(root: HTMLElement) {
	const canvas = root.querySelector<HTMLCanvasElement>('canvas[aria-label]');
	if (!canvas?.parentElement?.parentElement) throw new Error('Drawing surface missing');
	return { canvas, wrap: canvas.parentElement, scroller: canvas.parentElement.parentElement };
}

function unmountEditor(mounted: Mounted) {
	mounted.app.unmount();
	mounted.container.remove();
	mounts.splice(mounts.indexOf(mounted), 1);
}

async function closeEditor(root: HTMLElement) {
	const header = root.querySelector(':scope > header');
	if (!header) throw new Error('Editor header missing');
	await click(header, copy.close);
}

async function renameArtwork(root: HTMLElement, name: string) {
	const button = root.querySelector<HTMLElement>(`:scope > header button[aria-label^="${ui.rename}:"]`);
	if (!button) throw new Error('Rename control missing');
	button.click(); await settle();
	const form = popup(root).querySelector('form');
	const input = form?.querySelector('input');
	if (!form || !input) throw new Error('Rename form missing');
	input.value = name; input.dispatchEvent(new Event('input', { bubbles: true }));
	form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
}

async function drawStroke(root: HTMLElement) {
	const { canvas } = drawingSurface(root);
	await pointer(canvas, 'pointerdown', 71, 'pen', 100, 100);
	await pointer(canvas, 'pointermove', 71, 'pen', 150, 140);
	await pointer(canvas, 'pointerup', 71, 'pen', 150, 140);
}

function storedDraft(name = '保存済みの作品') {
	return JSON.stringify({
		version: 1, width: 640, height: 360, name, bg: 'transparent', active: 0,
		layers: [{ id: 1, name: '下描き', visible: true, opacity: .6, blend: 'multiply', data: 'data:image/png;base64,AAAA' }],
	});
}

function monitorDraftStorage() {
	// vitest-setup may replace native Storage with a plain-object implementation.
	const storageWrite = vi.spyOn(localStorage, 'setItem');
	const storageRemove = vi.spyOn(localStorage, 'removeItem');
	const probeKey = 'hatadint:test:storage-monitor';
	localStorage.setItem(probeKey, 'positive-control');
	expect(storageWrite).toHaveBeenCalledExactlyOnceWith(probeKey, 'positive-control');
	expect(localStorage.getItem(probeKey)).toBe('positive-control');
	localStorage.removeItem(probeKey);
	expect(storageRemove).toHaveBeenCalledExactlyOnceWith(probeKey);
	expect(localStorage.getItem(probeKey)).toBeNull();
	storageWrite.mockClear(); storageRemove.mockClear();
	return { storageWrite, storageRemove };
}

function expectNoDraftTransmission() {
	expect(api).not.toHaveBeenCalled();
	expect(upload).not.toHaveBeenCalled();
	expect(post).not.toHaveBeenCalled();
}

async function pointer(target: HTMLElement, type: string, id: number, pointerType = 'pen', x = 100, y = 100) {
	const receiver = type === 'pointerdown' ? target : captures.get(id) ?? target;
	receiver.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType, clientX: x, clientY: y, pressure: .5, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
	await settle();
}

async function selectTriangle(root: HTMLElement, pointerId: number) {
	await click(root, ui.changeTool);
	await click(popup(root), copy.toolLasso);
	const { canvas } = drawingSurface(root);
	rects.set(canvas, new DOMRect(20, 20, 1000, 800));
	await pointer(canvas, 'pointerdown', pointerId, 'pen', 120, 100);
	await pointer(canvas, 'pointermove', pointerId, 'pen', 260, 100);
	await pointer(canvas, 'pointermove', pointerId, 'pen', 180, 260);
	await pointer(canvas, 'pointerup', pointerId, 'pen', 180, 260);
}

function rectWhileVisible(element: HTMLElement, section: HTMLElement, bounds: DOMRect) {
	// The prototype method is already mocked; spying on it again would change every element's geometry.
	Object.defineProperty(element, 'getBoundingClientRect', {
		configurable: true,
		value: () => section.style.display === 'none' ? new DOMRect(0, 0, 0, 0) : bounds,
	});
}

function paintedContext() {
	const result = createdContexts.find(context => vi.mocked(context.fill).mock.calls.length > 0);
	if (!result) throw new Error('The input did not reach the drawing context');
	return result;
}

function stubImage() {
	class ImageFixture {
		naturalWidth = 640;
		naturalHeight = 360;
		width = 640;
		height = 360;
		crossOrigin = '';
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		private url = '';
		get src() { return this.url; }
		set src(value: string) { this.url = value; window.queueMicrotask(() => this.onload?.()); }
	}
	vi.stubGlobal('Image', ImageFixture);
	return ImageFixture;
}

beforeEach(() => {
	rootWidth = 1280;
	rects = new WeakMap(); contexts = new WeakMap(); observers.splice(0);
	createdContexts.splice(0); captures.clear();
	localStorage.clear();
	account.id = 'account-a';
	api.mockReset(); upload.mockReset(); post.mockReset(); alert.mockReset(); abortUpload.mockReset(); modalClose.mockReset();
	chooseDrive.mockReset(); chooseDrive.mockResolvedValue([]);
	proxyImage.mockReset(); proxyImage.mockImplementation((url: string) => url);
	api.mockResolvedValue({ agreed: false, agreedAt: null, version: null });
	upload.mockReturnValue({ filePromise: Promise.resolve(artwork), abort: abortUpload });
	post.mockResolvedValue(undefined);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return contextFor(this); } as unknown as typeof HTMLCanvasElement.prototype.getContext);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (rects.has(this)) return rects.get(this)!;
		return new DOMRect(20, 20, this.matches('[data-hatadint]') ? rootWidth : 720, 600);
	});
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.matches('[data-hatadint]') ? rootWidth : 720; });
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
	vi.stubGlobal('ResizeObserver', class {
		targets = new Set<Element>();
		disconnect = vi.fn(() => this.targets.clear());
		constructor(public callback: ResizeObserverCallback) { observers.push(this); }
		observe(target: Element) { this.targets.add(target); }
		unobserve(target: Element) { this.targets.delete(target); }
	});
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1400);
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
	Object.defineProperties(HTMLElement.prototype, {
		setPointerCapture: { configurable: true, value(this: HTMLElement, id: number) { captures.set(id, this); } },
		hasPointerCapture: { configurable: true, value(this: HTMLElement, id: number) { return captures.get(id) === this; } },
		releasePointerCapture: { configurable: true, value(this: HTMLElement, id: number) {
			if (captures.get(id) !== this) return;
			captures.delete(id);
			this.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: id, bubbles: true }));
		} },
	});
});

afterEach(() => {
	for (const { app, container } of mounts.splice(0)) { app.unmount(); container.remove(); }
	for (const method of captureMethods) {
		const descriptor = originalCaptureMethods.get(method);
		if (descriptor) Object.defineProperty(HTMLElement.prototype, method, descriptor);
		else Reflect.deleteProperty(HTMLElement.prototype, method);
	}
	vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('Hatadintの制作UI', () => {
	test('HataGoesの狭幅メニューは同じdialogを下部シートで閉じアニメーション中も保持する', async () => {
		rootWidth = 430;
		const { root } = await mount(true, true);
		await click(root, ui.changeTool);
		const dialog = popup(root);
		expect(dialog.dataset.sheet).toBe('true');
		expect(dialog.style.bottom).toBe('0px');
		await click(dialog, copy.close);
		expect(dialog.open).toBe(true);
		expect(dialog.dataset.closing).toBe('true');
		expect(dialog.textContent).toContain(copy.toolEraser);
		expect(dialog.hasAttribute('inert')).toBe(true);
		await click(root, copy.brushSize);
		expect(popup(root)).toBe(dialog);
		expect(dialog.dataset.closing).toBe('false');
		expect(dialog.textContent).toContain(copy.brushSize);
		await new Promise(resolve => window.setTimeout(resolve, 180));
		expect(dialog.open).toBe(true);
		await click(dialog, copy.close);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	test('上部のツール・サイズ・不透明度は同じ非モーダル吹き出しを切り替える', async () => {
		const { root } = await mount();
		await click(root, ui.changeTool);
		const dialog = popup(root);
		expect(dialog.getAttribute('aria-modal')).toBe('false');
		expect(named(dialog, copy.toolEraser)).toBeTruthy();
		await click(root, copy.brushSize);
		expect(popup(root)).toBe(dialog);
		const number = dialog.querySelector<HTMLInputElement>('input[type="number"]')!;
		number.value = '24'; number.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(named(root, copy.brushSize).textContent).toContain('24');
		await click(root, copy.opacity);
		expect(popup(root)).toBe(dialog);
		expect(dialog.querySelector('input[type="range"]')?.getAttribute('max')).toBe('1');
	});

	test('同じ上部ボタンをもう一度押すと吹き出しを閉じる', async () => {
		const { root } = await mount();
		await click(root, ui.changeTool); await click(root, ui.changeTool);
		expect(root.querySelector('dialog')?.open).toBe(false);
	});

	test('PCのキャンバスペインからフィルターを開いても元ボタンの位置を保ち、閉じるとそこへフォーカスを戻す', async () => {
		const { root } = await mount();
		await click(root, ui.canvas);
		const inspector = root.querySelector('aside:last-of-type')!;
		const canvasPanel = named(inspector, copy.importImage).closest('section')!;
		const filterButton = named(canvasPanel, copy.filters);
		const rootBeforeFixture = root.getBoundingClientRect();
		rectWhileVisible(filterButton, canvasPanel, new DOMRect(990, 310, 180, 44));
		expect(root.getBoundingClientRect().toJSON()).toEqual(rootBeforeFixture.toJSON());
		filterButton.click(); await settle();
		const dialog = popup(root);
		expect(named(dialog, copy.filterGrayscale)).toBeTruthy();
		expect(Number.parseFloat(dialog.style.left)).toBeCloseTo(898);
		expect(Number.parseFloat(dialog.style.top)).toBeGreaterThan(200);
		resize(); await settle();
		expect(Number.parseFloat(dialog.style.left)).toBeCloseTo(898);
		await click(dialog, copy.close);
		expect(dialog.open).toBe(false);
		expect(canvasPanel.style.display).not.toBe('none');
		expect(window.document.activeElement).toBe(filterButton);
	});

	test('右ペインを閉じると操作対象から外し、開くと同じペインを再び操作できる', async () => {
		const { root } = await mount();
		const inspector = root.querySelector('aside:last-of-type')!;
		const colorLock = named(inspector, ui.lockColor);
		await click(root, ui.panels);
		expect(named(root, ui.panels).getAttribute('aria-pressed')).toBe('true');
		expect(inspector.hasAttribute('inert')).toBe(true);
		expect(inspector.getAttribute('aria-hidden')).toBe('true');
		await click(root, ui.panels);
		expect(named(root, ui.panels).getAttribute('aria-pressed')).toBe('false');
		expect(inspector.hasAttribute('inert')).toBe(false);
		expect(inspector.getAttribute('aria-hidden')).not.toBe('true');
		expect(named(inspector, ui.lockColor)).toBe(colorLock);
		colorLock.click(); await settle();
		expect(colorLock.getAttribute('aria-pressed')).toBe('true');
	});

	test('右上のハンド切り替えは選択していた消しゴムに戻る', async () => {
		const { root } = await mount();
		await click(root, ui.changeTool); await click(popup(root), copy.toolEraser);
		await click(root, copy.handTool);
		expect(named(root, `${ui.returnTool}: ${copy.toolEraser}`).getAttribute('aria-pressed')).toBe('true');
		await click(root, `${ui.returnTool}: ${copy.toolEraser}`);
		expect(named(root, ui.changeTool).textContent).toContain(copy.toolEraser);
	});

	test('左上の作品名を変更し、元に戻すと変更前の名前に戻る', async () => {
		const { root } = await mount();
		await click(root, `${ui.rename}: ${ui.untitled}`);
		const form = popup(root).querySelector('form')!;
		const input = form.querySelector('input')!;
		input.value = '旗のスケッチ'; input.dispatchEvent(new Event('input', { bubbles: true }));
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle();
		expect(named(root, `${ui.rename}: 旗のスケッチ`)).toBeTruthy();
		await click(root, copy.undo);
		expect(named(root, `${ui.rename}: ${ui.untitled}`)).toBeTruthy();
	});

	test('カラーロックは平面と色相のキー操作を止め、色コード変更は許可する', async () => {
		const { root } = await mount();
		const colorPanel = named(root, ui.lockColor).closest('section')!;
		const input = colorPanel.querySelector<HTMLInputElement>('input[type="text"]')!;
		const hue = named(colorPanel, ui.hue, '[role="slider"]');
		await click(root, ui.lockColor);
		const before = input.value;
		hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await settle();
		expect(input.value).toBe(before);
		input.value = '#ff0000'; input.dispatchEvent(new Event('change', { bubbles: true })); await settle();
		expect(input.value).toBe('#ff0000');
		await click(root, ui.lockColor);
		hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await settle();
		expect(input.value).not.toBe('#ff0000');
	});

	test('広いウィンドウの中でも制作コンテナがスマホ幅ならパネルを吹き出しへ移す', async () => {
		rootWidth = 480;
		const { root } = await mount();
		const mobileDock = root.querySelector(':scope > nav')!;
		await click(mobileDock, copy.color);
		const dialog = popup(root);
		expect(dialog.contains(named(root, ui.lockColor))).toBe(true);
		expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(0);
		expect(Number.parseFloat(dialog.style.left) + Number.parseFloat(dialog.style.width)).toBeLessThanOrEqual(rootWidth);
		rootWidth = 1000;
		resize(); await settle();
		expect(dialog.open).toBe(false);
		expect(root.querySelector('aside:last-of-type')?.contains(named(root, ui.lockColor))).toBe(true);
	});

	test('スマホのその他からフィルターへ切り替えても吹き出しの起点はドックのままにする', async () => {
		rootWidth = 480;
		const { root } = await mount();
		const dock = root.querySelector(':scope > nav')!;
		const moreButton = named(dock, ui.more);
		rects.set(moreButton, new DOMRect(420, 540, 44, 44));
		moreButton.click(); await settle();
		const dialog = popup(root);
		const before = { left: dialog.style.left, top: dialog.style.top, arrow: dialog.style.getPropertyValue('--arrow-x') };
		const filterButton = named(dialog, copy.filters);
		const canvasPanel = filterButton.closest('section')!;
		const rootBeforeFixture = root.getBoundingClientRect();
		rectWhileVisible(filterButton, canvasPanel, new DOMRect(40, 140, 260, 44));
		expect(root.getBoundingClientRect().toJSON()).toEqual(rootBeforeFixture.toJSON());
		filterButton.click(); await settle();
		expect(popup(root)).toBe(dialog);
		expect(named(dialog, copy.filterGrayscale)).toBeTruthy();
		expect({ left: dialog.style.left, top: dialog.style.top, arrow: dialog.style.getPropertyValue('--arrow-x') }).toEqual(before);
		expect(moreButton.getAttribute('aria-expanded')).toBe('true');
		await click(dialog, copy.close);
		expect(moreButton.getAttribute('aria-expanded')).toBe('false');
		expect(window.document.activeElement).toBe(moreButton);
	});

	test('投げ縄の三角形の輪郭は移動・拡縮・回転後も選択画像と同じ枠に入り、✓で確定できる', async () => {
		const { root } = await mount();
		await selectTriangle(root, 51);
		const polygon = root.querySelector<SVGPolygonElement>('svg polygon');
		expect(polygon).toBeTruthy();
		const points = polygon!.getAttribute('points')!;
		expect(points.trim().split(/\s+/).map(point => point.split(',').map(Number))).toEqual([[0, 0], [140, 0], [60, 160]]);
		const selection = polygon!.closest('div')!;
		expect(selection.querySelector('canvas')).toBeTruthy();
		const initialLeft = Number.parseFloat(selection.style.left), initialTop = Number.parseFloat(selection.style.top);
		const zoom = Number.parseFloat(drawingSurface(root).wrap.style.width) / 1000;
		await pointer(selection, 'pointerdown', 52, 'mouse', 200, 200);
		await pointer(selection, 'pointermove', 52, 'mouse', 240, 225);
		await pointer(selection, 'pointerup', 52, 'mouse', 240, 225);
		expect(Number.parseFloat(selection.style.left)).toBeCloseTo(initialLeft + 40 * zoom);
		expect(Number.parseFloat(selection.style.top)).toBeCloseTo(initialTop + 25 * zoom);
		for (const [label, value] of [[copy.scale, '150'], [copy.rotation, '30']]) {
			const input = [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')].find(range => range.closest('label')?.textContent?.startsWith(label))!;
			expect(input).toBeTruthy();
			input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
		}
		await settle();
		expect(selection.style.transform).toBe('scale(1.5) rotate(30deg)');
		expect(polygon!.closest('div')).toBe(selection);
		expect(polygon!.getAttribute('points')).toBe(points);
		const apply = named(root, copy.apply), cancel = named(root, copy.cancel);
		expect(apply.getAttribute('aria-label')).toBe(copy.apply);
		expect(cancel.getAttribute('aria-label')).toBe(copy.cancel);
		expect(apply.textContent?.trim()).toBe('✓');
		expect(cancel.textContent?.trim()).toBe('✖');
		apply.click(); await settle();
		expect(root.querySelector('svg polygon')).toBeNull();
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
		await click(root, copy.undo);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
	});

	test('投げ縄選択は✖で取り消せて、元画像へ戻しUndoの履歴を増やさない', async () => {
		const { root } = await mount();
		await selectTriangle(root, 61);
		expect(root.querySelector('svg polygon')).toBeTruthy();
		const restoredBefore = createdContexts.reduce((total, context) => total + vi.mocked(context.putImageData).mock.calls.length, 0);
		const cancel = named(root, copy.cancel);
		expect(cancel.getAttribute('aria-label')).toBe(copy.cancel);
		expect(cancel.textContent?.trim()).toBe('✖');
		cancel.click(); await settle();
		expect(root.querySelector('svg polygon')).toBeNull();
		expect(createdContexts.reduce((total, context) => total + vi.mocked(context.putImageData).mock.calls.length, 0)).toBeGreaterThan(restoredBefore);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
	});

	test('ドライブ画像は原寸を保つプロキシから読み込み、正の寸法で配置してUndoできる', async () => {
		const ImageFixture = stubImage();
		const { root } = await mount();
		chooseDrive.mockResolvedValueOnce([{ id: 'import-image', type: 'image/png', url: '/files/source.png' }]);
		await click(root, ui.canvas);
		await click(root, copy.importImage);
		await click(popup(root), ui.fromDrive);
		expect(chooseDrive).toHaveBeenCalledExactlyOnceWith({ multiple: false });
		expect(proxyImage).toHaveBeenCalledExactlyOnceWith('/files/source.png', undefined, true);
		const placed = root.querySelector<HTMLImageElement>('img[draggable="false"]');
		expect(placed).toBeTruthy();
		expect(Number.parseFloat(placed!.parentElement!.style.width)).toBeGreaterThan(0);
		expect(Number.parseFloat(placed!.parentElement!.style.height)).toBeGreaterThan(0);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
		await click(root, copy.place);
		const draw = createdContexts.flatMap(context => vi.mocked(context.drawImage).mock.calls).find(args => args[0] instanceof ImageFixture);
		expect(draw).toBeTruthy();
		expect(draw![3]).toBe(640); expect(draw![4]).toBe(360);
		expect(root.querySelector('img[draggable="false"]')).toBeNull();
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
		await click(root, copy.undo);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
	});

	test('端末画像のblob URLを配置プレビュー中は保ち、キャンセルすると解放する', async () => {
		stubImage();
		const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:import-fixture');
		const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
		const { root } = await mount();
		await click(root, ui.canvas);
		await click(root, copy.importImage);
		await click(popup(root), ui.fromDevice);
		const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
		Object.defineProperty(input, 'files', { configurable: true, value: [new File(['png'], 'source.png', { type: 'image/png' })] });
		input.dispatchEvent(new Event('change', { bubbles: true })); await settle();
		expect(created).toHaveBeenCalledTimes(1);
		expect(root.querySelector('img[draggable="false"]')?.getAttribute('src')).toBe('blob:import-fixture');
		expect(revoked).not.toHaveBeenCalled();
		await click(root, copy.cancel);
		expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:import-fixture');
		expect(root.querySelector('img[draggable="false"]')).toBeNull();
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('Hatadintのポインター所有と視点移動', () => {
	test('2本指開始では描きかけを戻し、両指のcaptureを保ってピンチを続ける', async () => {
		const { root } = await mount();
		const { canvas, wrap, scroller } = drawingSurface(root);
		await pointer(canvas, 'pointerdown', 1, 'touch', 100, 100);
		const context = paintedContext();
		const before = wrap.style.width;
		await pointer(canvas, 'pointerdown', 2, 'touch', 200, 100);
		expect(context.putImageData).toHaveBeenCalledTimes(1);
		expect(captures.get(1)).toBe(scroller);
		expect(captures.get(2)).toBe(scroller);
		await pointer(canvas, 'pointermove', 2, 'touch', 300, 100);
		expect(Number.parseFloat(wrap.style.width)).toBeGreaterThan(Number.parseFloat(before));
		await pointer(canvas, 'pointerup', 1, 'touch'); await pointer(canvas, 'pointerup', 2, 'touch');
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
		expect(captures.size).toBe(0);
	});

	test('ピンチ中のペン入力へ引き継ぎ、残った指の終了でペンを止めない', async () => {
		const { root } = await mount();
		const { canvas, scroller } = drawingSurface(root);
		await pointer(canvas, 'pointerdown', 1, 'touch', 100, 100);
		await pointer(canvas, 'pointerdown', 2, 'touch', 200, 100);
		const context = paintedContext();
		await pointer(canvas, 'pointerdown', 3, 'pen', 150, 120);
		expect(captures.has(1)).toBe(false); expect(captures.has(2)).toBe(false);
		expect(captures.get(3)).toBe(scroller);
		expect(context.fill).toHaveBeenCalledTimes(2);
		await pointer(canvas, 'pointerup', 1, 'touch');
		await pointer(canvas, 'pointermove', 3, 'pen', 200, 140);
		expect(context.stroke).toHaveBeenCalledTimes(1);
		await pointer(canvas, 'pointerup', 3, 'pen', 200, 140);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
	});

	test('別ポインターのcancelは進行中のペンを取り消さない', async () => {
		const { root } = await mount();
		const { canvas } = drawingSurface(root);
		await pointer(canvas, 'pointerdown', 7);
		const context = paintedContext();
		await pointer(canvas, 'pointercancel', 99, 'touch');
		expect(context.putImageData).not.toHaveBeenCalled();
		await pointer(canvas, 'pointermove', 7, 'pen', 160, 160);
		expect(context.stroke).toHaveBeenCalledTimes(1);
		await pointer(canvas, 'pointerup', 7, 'pen', 160, 160);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
	});

	test('所有ポインターのcancelは描きかけを戻しUndo履歴へ入れない', async () => {
		const { root } = await mount();
		const { canvas } = drawingSurface(root);
		await pointer(canvas, 'pointerdown', 7);
		const context = paintedContext();
		await pointer(canvas, 'pointermove', 7, 'pen', 160, 160);
		await pointer(canvas, 'pointercancel', 7);
		expect(context.putImageData).toHaveBeenCalledTimes(1);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(true);
		await pointer(canvas, 'pointerdown', 8);
		await pointer(canvas, 'pointerup', 8);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
	});

	test('ミニマップの枠から親ケースへcaptureし、枠外でも視点移動と終了を受け取る', async () => {
		const { root } = await mount();
		const { wrap } = drawingSurface(root);
		await click(root, ui.zoomIn); await click(root, ui.zoomIn);
		const frame = named(root, ui.moveView);
		const minimap = frame.parentElement!;
		const miniCanvas = minimap.querySelector('canvas')!;
		rects.set(miniCanvas, new DOMRect(800, 50, 160, 128));
		await pointer(frame, 'pointerdown', 41, 'mouse', 820, 70);
		expect(captures.get(41)).toBe(minimap);
		await pointer(frame, 'pointermove', 41, 'mouse', 850, 90);
		expect(wrap.style.transform).not.toBe('translate(0px, 0px)');
		const moved = wrap.style.transform;
		await pointer(frame, 'pointerup', 41, 'mouse', 850, 90);
		expect(captures.has(41)).toBe(false);
		await pointer(minimap, 'pointermove', 41, 'mouse', 900, 100);
		expect(wrap.style.transform).toBe(moved);
	});
});

describe('Hatadintの端末下書き保存の確認', () => {
	const draftKey = 'hatadint:draft:account-a';

	async function requestClose(mounted: Mounted, source: 'close' | 'escape' | 'backdrop') {
		if (source === 'close') return closeEditor(mounted.root);
		const modalFixture = mounted.container.querySelector<HTMLElement>('[data-modal-fixture]');
		if (!modalFixture) throw new Error('Modal fixture missing');
		if (source === 'escape') modalFixture.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		else modalFixture.click();
		await settle();
	}

	test.each(['close', 'escape', 'backdrop'] as const)('無編集なら %s から確認も下書き保存もせず閉じる', async source => {
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		const { storageWrite } = monitorDraftStorage();
		const mounted = await mount();
		await requestClose(mounted, source);
		expect(modalClose).toHaveBeenCalledTimes(1);
		expect(mounted.closed).toHaveBeenCalledTimes(1);
		expect(mounted.root.querySelector('dialog[open]')).toBeNull();
		expect(storageWrite).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previous);
		expectNoDraftTransmission();
	});

	test.each(['close', 'escape', 'backdrop'] as const)('編集後の %s は下書き確認を開き、Escapeでは編集に戻る', async source => {
		const mounted = await mount();
		await drawStroke(mounted.root);
		await requestClose(mounted, source);
		const dialog = popup(mounted.root);
		expect(dialog.textContent).toContain(ui.draftTitle);
		expect(dialog.textContent).toContain(ui.draftLocalOnly);
		expect(window.document.activeElement).toBe(named(dialog, ui.continueEditing));
		expect(modalClose).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBeNull();
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(dialog.open).toBe(false);
		expect(modalClose).not.toHaveBeenCalled();
		expect((named(mounted.root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
		expectNoDraftTransmission();
	});

	test('編集して待機しても強制アンマウントしても、明示保存なしに既存下書きを変更しない', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		const { storageWrite } = monitorDraftStorage();
		const mounted = await mount();
		await drawStroke(mounted.root);
		await renameArtwork(mounted.root, '保存を選んでいない作品');
		await vi.advanceTimersByTimeAsync(2000);
		expect(storageWrite).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previous);
		unmountEditor(mounted);
		await vi.advanceTimersByTimeAsync(2000);
		expect(storageWrite).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previous);
		expectNoDraftTransmission();
	});

	test('編集に戻るボタンはキャンバスと未保存の変更を保持し、次に閉じると再び確認する', async () => {
		const { root } = await mount();
		await renameArtwork(root, '編集中の作品');
		const canvas = drawingSurface(root).canvas;
		await closeEditor(root);
		await click(popup(root), ui.continueEditing);
		expect(root.querySelector('dialog[open]')).toBeNull();
		expect(drawingSurface(root).canvas).toBe(canvas);
		expect(named(root, `${ui.rename}: 編集中の作品`)).toBeTruthy();
		expect(modalClose).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBeNull();
		await closeEditor(root);
		expect(popup(root).textContent).toContain(ui.draftTitle);
		expectNoDraftTransmission();
	});

	test('保存せず閉じる場合は以前の下書きを削除・上書きせず、終了後もそのまま残す', async () => {
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		const { storageWrite, storageRemove } = monitorDraftStorage();
		const mounted = await mount();
		await drawStroke(mounted.root);
		await closeEditor(mounted.root);
		await click(popup(mounted.root), ui.closeWithoutSaving);
		expect(modalClose).toHaveBeenCalledTimes(1);
		unmountEditor(mounted);
		expect(storageWrite).not.toHaveBeenCalled();
		expect(storageRemove).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previous);
		expectNoDraftTransmission();
	});

	test('端末保存を選んだときだけ、作品名と個別レイヤーを保存して以前の下書きを置き換える', async () => {
		localStorage.setItem(draftKey, storedDraft());
		const { storageWrite } = monitorDraftStorage();
		const mounted = await mount();
		await drawStroke(mounted.root);
		await renameArtwork(mounted.root, '端末に残す作品');
		await click(mounted.root, copy.layers);
		await click(mounted.root, ui.addLayer);
		await closeEditor(mounted.root);
		expect(popup(mounted.root).textContent).toContain(ui.replaceDraft);
		expect(storageWrite).not.toHaveBeenCalled();
		await click(popup(mounted.root), ui.saveDraftAndClose);
		expect(storageWrite).toHaveBeenCalledTimes(1);
		expect(storageWrite.mock.calls[0][0]).toBe(draftKey);
		const saved = JSON.parse(localStorage.getItem(draftKey) ?? '');
		expect(saved).toMatchObject({ version: 1, name: '端末に残す作品', width: 1000, height: 800 });
		expect(saved.layers).toHaveLength(2);
		for (const layer of saved.layers) expect(layer).toMatchObject({ data: 'data:image/png;base64,AAAA', visible: true, opacity: 1, blend: 'normal' });
		expect(modalClose).toHaveBeenCalledTimes(1);
		unmountEditor(mounted);
		expect(storageWrite).toHaveBeenCalledTimes(1);
		expectNoDraftTransmission();
	});

	test.each(['QuotaExceededError', 'SecurityError'])('端末保存が %s で失敗したら作品と既存下書きを保持し、再試行できる', async errorName => {
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		const { root } = await mount();
		await drawStroke(root);
		await closeEditor(root);
		const canvas = drawingSurface(root).canvas;
		const { storageWrite } = monitorDraftStorage();
		storageWrite.mockImplementationOnce(() => { throw new DOMException('Local storage unavailable', errorName); });
		await click(popup(root), ui.saveDraftAndClose);
		expect(storageWrite).toHaveBeenCalledTimes(1);
		expect(storageWrite.mock.calls[0][0]).toBe(draftKey);
		expect(popup(root).querySelector('[role="alert"]')?.textContent).toContain(ui.draftFailed);
		expect(modalClose).not.toHaveBeenCalled();
		expect(drawingSurface(root).canvas).toBe(canvas);
		expect((named(root, copy.undo) as HTMLButtonElement).disabled).toBe(false);
		expect(localStorage.getItem(draftKey)).toBe(previous);
		expect((named(popup(root), ui.saveDraftAndClose) as HTMLButtonElement).disabled).toBe(false);
		await click(popup(root), ui.saveDraftAndClose);
		expect(storageWrite).toHaveBeenCalledTimes(2);
		expect(modalClose).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem(draftKey)).not.toBe(previous);
		expectNoDraftTransmission();
	});

	test('レイヤーの画像化に失敗しても、部分的な下書きで以前の保存を壊さない', async () => {
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		const { storageWrite } = monitorDraftStorage();
		const { root } = await mount();
		await drawStroke(root);
		await closeEditor(root);
		vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementationOnce(() => { throw new DOMException('Canvas is not origin-clean', 'SecurityError'); });
		await click(popup(root), ui.saveDraftAndClose);
		expect(popup(root).querySelector('[role="alert"]')?.textContent).toContain(ui.draftFailed);
		expect(modalClose).not.toHaveBeenCalled();
		expect(storageWrite).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previous);
		expectNoDraftTransmission();
	});

	test('同じ端末でもアカウントごとに下書きを分け、別アカウントの作品を上書きしない', async () => {
		const first = await mount();
		await renameArtwork(first.root, 'アカウントAの作品');
		await closeEditor(first.root);
		await click(popup(first.root), ui.saveDraftAndClose);
		const firstSaved = localStorage.getItem(draftKey);
		unmountEditor(first);
		account.id = 'account-b';
		const second = await mount();
		await renameArtwork(second.root, 'アカウントBの作品');
		await closeEditor(second.root);
		await click(popup(second.root), ui.saveDraftAndClose);
		expect(JSON.parse(localStorage.getItem('hatadint:draft:account-b') ?? '').name).toBe('アカウントBの作品');
		expect(localStorage.getItem(draftKey)).toBe(firstSaved);
		expect(JSON.parse(firstSaved ?? '').name).toBe('アカウントAの作品');
		expectNoDraftTransmission();
	});

	test('開いた後にアカウントが切り替わった場合は下書き保存を止め、元の作品と両アカウントの下書きを維持する', async () => {
		const previousA = storedDraft('Aの保存済み作品'), previousB = storedDraft('Bの保存済み作品');
		localStorage.setItem(draftKey, previousA);
		localStorage.setItem('hatadint:draft:account-b', previousB);
		const { storageWrite } = monitorDraftStorage();
		const { root } = await mount();
		await renameArtwork(root, 'Aの編集中作品');
		await closeEditor(root);
		account.id = 'account-b';
		await click(popup(root), ui.saveDraftAndClose);
		expect(popup(root).querySelector('[role="alert"]')?.textContent).toContain(ui.accountChanged);
		expect(modalClose).not.toHaveBeenCalled();
		expect(storageWrite).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBe(previousA);
		expect(localStorage.getItem('hatadint:draft:account-b')).toBe(previousB);
		expect(named(root, `${ui.rename}: Aの編集中作品`)).toBeTruthy();
		expectNoDraftTransmission();
	});

	test('復元しただけなら保存確認なしで閉じ、復元後に編集した場合は確認する', async () => {
		stubImage();
		const previous = storedDraft();
		localStorage.setItem(draftKey, previous);
		for (const edit of [false, true]) {
			const mounted = await mount();
			await click(mounted.root, ui.canvas);
			await click(mounted.root, ui.restoreDraft);
			await click(popup(mounted.root), copy.apply);
			expect(named(mounted.root, `${ui.rename}: 保存済みの作品`)).toBeTruthy();
			if (edit) await drawStroke(mounted.root);
			modalClose.mockClear();
			await closeEditor(mounted.root);
			if (edit) {
				expect(popup(mounted.root).textContent).toContain(ui.draftTitle);
				expect(modalClose).not.toHaveBeenCalled();
			} else expect(modalClose).toHaveBeenCalledTimes(1);
			unmountEditor(mounted);
			expect(localStorage.getItem(draftKey)).toBe(previous);
		}
		expectNoDraftTransmission();
	});

	test.each([ui.saveDevice, ui.saveDrive])('%s でPNGを書き出した後も、未保存のレイヤー下書きを閉じる際に確認する', async destination => {
		vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-before-draft');
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		api.mockResolvedValue({ agreed: true, agreedAt: '2026-09-09T01:00:00Z', version: '2026-09-09' });
		const { root } = await mount();
		await drawStroke(root);
		await exportTo(root, destination);
		expect(modalClose).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBeNull();
		const exports = { api: api.mock.calls.length, upload: upload.mock.calls.length, post: post.mock.calls.length };
		expect(exports).toEqual(destination === ui.saveDrive ? { api: 1, upload: 1, post: 0 } : { api: 0, upload: 0, post: 0 });
		await closeEditor(root);
		expect(popup(root).textContent).toContain(ui.draftTitle);
		await click(popup(root), ui.saveDraftAndClose);
		expect(localStorage.getItem(draftKey)).not.toBeNull();
		expect(modalClose).toHaveBeenCalledTimes(1);
		expect({ api: api.mock.calls.length, upload: upload.mock.calls.length, post: post.mock.calls.length }).toEqual(exports);
	});

	test('投稿への添付成功後も編集済み下書きの保存を確認し、端末保存は追加アップロードしない', async () => {
		api.mockResolvedValue({ agreed: true, agreedAt: '2026-09-09T01:00:00Z', version: '2026-09-09' });
		const { root, done } = await mount();
		await drawStroke(root);
		await exportTo(root, ui.attachNote);
		expect(done).toHaveBeenCalledExactlyOnceWith(artwork);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(modalClose).not.toHaveBeenCalled();
		expect(popup(root).textContent).toContain(ui.draftTitle);
		await click(popup(root), ui.saveDraftAndClose);
		expect(localStorage.getItem(draftKey)).not.toBeNull();
		expect(modalClose).toHaveBeenCalledTimes(1);
		expect(done).toHaveBeenCalledTimes(1);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(api.mock.calls.map(call => call[0])).toEqual(['hata/consent/get']);
		expect(post).not.toHaveBeenCalled();
	});

	test.each(['lasso', 'placement'] as const)('未確定の %s がある間は保存確認へ進まず、確定か取消を促して作品を維持する', async operation => {
		const { root } = await mount();
		await drawStroke(root);
		if (operation === 'lasso') await selectTriangle(root, 72);
		else {
			stubImage();
			chooseDrive.mockResolvedValueOnce([{ id: 'import-image', type: 'image/png', url: '/files/source.png' }]);
			await click(root, ui.canvas);
			await click(root, copy.importImage);
			await click(popup(root), ui.fromDrive);
		}
		await closeEditor(root);
		expect(root.querySelector(':scope > p[role="status"]')?.textContent).toContain(ui.finishEdit);
		expect(root.querySelector('dialog[open]')).toBeNull();
		expect(root.querySelector(operation === 'lasso' ? 'svg polygon' : 'img[draggable="false"]')).toBeTruthy();
		expect(modalClose).not.toHaveBeenCalled();
		expect(localStorage.getItem(draftKey)).toBeNull();
		expectNoDraftTransmission();
	});
});

describe('Hatadintの同意と書き出し', () => {
	test('端末へのPNG保存は同意APIとサーバーアップロードを呼ばない', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hatadint-fixture');
		const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
		let downloadName = '';
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });
		const { root } = await mount();
		await exportTo(root, ui.saveDevice);
		expect(api).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(created).toHaveBeenCalledTimes(1);
		expect(downloadName).toBe(`${ui.untitled}.png`);
		await vi.advanceTimersByTimeAsync(1000);
		expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:hatadint-fixture');
		vi.useRealTimers();
	});

	test('初回はチェック必須で同意をサーバーに記録してからDriveへアップロードする', async () => {
		const { root, done } = await mount();
		let serverAgreed = false;
		let finishConsent!: () => void;
		api.mockImplementation(async endpoint => {
			if (endpoint === 'hata/consent/update') return new Promise(resolve => {
				finishConsent = () => { serverAgreed = true; resolve({ ok: true }); };
			});
			return { agreed: serverAgreed, agreedAt: serverAgreed ? '2026-09-09T01:00:00Z' : null, version: serverAgreed ? '2026-09-09' : null };
		});
		await exportTo(root, ui.attachNote);
		expect(api).toHaveBeenCalledWith('hata/consent/get', {});
		expect((named(popup(root), ui.agreeContinue) as HTMLButtonElement).disabled).toBe(true);
		expect(upload).not.toHaveBeenCalled();
		await agree(root);
		expect(api).toHaveBeenCalledWith('hata/consent/update', { type: 'drawing', agree: true });
		expect(upload).not.toHaveBeenCalled();
		finishConsent();
		await settle();
		expect(upload).toHaveBeenCalledTimes(1);
		expect(upload.mock.calls[0][1]).toMatchObject({ source: 'hatadint' });
		expect(done).toHaveBeenCalledExactlyOnceWith(artwork);
		expect(post).not.toHaveBeenCalled();
	});

	test('既に同意したアカウントは古い版でも再同意せずDriveに保存する', async () => {
		const { root, done } = await mount();
		api.mockResolvedValue({ agreed: true, agreedAt: '2025-01-01T00:00:00Z', version: 'old-version' });
		await exportTo(root, ui.saveDrive);
		expect(api.mock.calls.map(call => call[0])).toEqual(['hata/consent/get']);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(done).not.toHaveBeenCalled();
		expect(post).not.toHaveBeenCalled();
	});

	test('同意状態の取得に失敗したらアップロードを止める', async () => {
		const { root } = await mount();
		api.mockRejectedValue(new Error('offline'));
		await exportTo(root, ui.saveDrive);
		expect(upload).not.toHaveBeenCalled();
		expect(root.textContent).toContain(ui.consentFailed);
	});

	test('同意の記録に失敗したらアップロードを止め、再試行できる', async () => {
		const { root } = await mount();
		await exportTo(root, ui.saveDrive);
		api.mockRejectedValueOnce(new Error('offline'));
		await agree(root);
		expect(upload).not.toHaveBeenCalled();
		expect(root.textContent).toContain(ui.consentFailed);
		expect((named(popup(root), ui.agreeContinue) as HTMLButtonElement).disabled).toBe(false);
	});

	test('同意更新が成功を返しても読み戻した状態が未同意ならアップロードしない', async () => {
		const { root } = await mount();
		api.mockImplementation(async endpoint => endpoint === 'hata/consent/update' ? { ok: true } : { agreed: false, agreedAt: null, version: null });
		await exportTo(root, ui.saveDrive);
		await agree(root);
		expect(api.mock.calls.map(call => call[0])).toEqual(['hata/consent/get', 'hata/consent/update', 'hata/consent/get']);
		expect(upload).not.toHaveBeenCalled();
		expect(root.textContent).toContain(ui.consentFailed);
	});

	test('同意確認のキャンセルでは同意記録もアップロードも行わない', async () => {
		const { root } = await mount();
		await exportTo(root, ui.attachNote);
		popup(root).querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
		await settle();
		await click(popup(root), copy.cancel);
		expect(api.mock.calls.map(call => call[0])).toEqual(['hata/consent/get']);
		expect(upload).not.toHaveBeenCalled();
		await exportTo(root, ui.saveDrive);
		expect(popup(root).querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
		expect((named(popup(root), ui.agreeContinue) as HTMLButtonElement).disabled).toBe(true);
	});

	test('単独で開いたツールからの投稿添付は投稿フォームを開き、自動送信しない', async () => {
		const { root, done } = await mount(false);
		api.mockResolvedValue({ agreed: true, agreedAt: '2026-09-09T01:00:00Z', version: '2026-09-09' });
		await exportTo(root, ui.attachNote);
		expect(post).toHaveBeenCalledTimes(1);
		expect(post.mock.calls[0][0]).toMatchObject({ initialFiles: [artwork] });
		expect(done).not.toHaveBeenCalled();
	});

	test('アップロード失敗時に作品を添付したことにしない', async () => {
		const { root, done } = await mount();
		api.mockResolvedValue({ agreed: true, agreedAt: '2026-09-09T01:00:00Z', version: '2026-09-09' });
		upload.mockImplementation(() => ({ filePromise: Promise.reject(new Error('upload failed')), abort: abortUpload }));
		await exportTo(root, ui.attachNote);
		await vi.waitFor(() => {
			expect(upload).toHaveBeenCalledTimes(1);
			expect(root.querySelector('[role="alert"]')?.textContent).toContain(copy.saveFailed);
		});
		expect(done).not.toHaveBeenCalled();
		expect(modalClose).not.toHaveBeenCalled();
	});

	test('アカウントが変わった状態で元の作品を他のアカウントへ送信しない', async () => {
		const { root } = await mount();
		account.id = 'account-b';
		await exportTo(root, ui.attachNote);
		expect(upload).not.toHaveBeenCalled();
		expect(root.textContent).toContain(ui.accountChanged);
	});

	test('閉じる際にサイズ監視を解除し進行中のアップロードを中止する', async () => {
		const { app, container, root } = await mount();
		api.mockResolvedValue({ agreed: true, agreedAt: '2026-09-09T01:00:00Z', version: '2026-09-09' });
		upload.mockReturnValue({ filePromise: new Promise(() => undefined), abort: abortUpload });
		await exportTo(root, ui.saveDrive);
		expect(upload).toHaveBeenCalledTimes(1);
		app.unmount(); container.remove(); mounts.splice(0);
		expect(observers.length).toBeGreaterThan(0);
		for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledTimes(1);
		expect(abortUpload).toHaveBeenCalledTimes(1);
	});
});
