/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { parse } from '@vue/compiler-sfc';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const fixtures = vi.hoisted(() => ({
	save: vi.fn(), notify: vi.fn(), menu: vi.fn(), api: vi.fn(), dialogClose: vi.fn(),
}));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/utility/hatady-prefs.js', async () => ({
	hatadyTheme: (await import('vue')).ref('hataskey'), saveHatadyDisplay: fixtures.save,
}));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixtures.notify }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	return { i18n: createTestHataskI18n() };
});
vi.mock('@/os.js', () => ({ popupMenu: fixtures.menu }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { title: String, bare: Boolean },
		emits: ['close', 'closed'],
		setup(props, { slots, emit, expose }) {
			let closed = false;
			expose({ close: () => {
				if (closed) return;
				closed = true;
				fixtures.dialogClose();
				emit('closed');
			} });
			return () => render('div', {
				'data-dialog-host': '',
				onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') emit('close'); },
				onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('close'); },
			}, render('section', { role: 'dialog', 'aria-label': props.title, 'data-bare': props.bare }, [
				render('div', { 'data-dialog-body': '' }, slots.default?.()),
			]));
		},
	}) };
});
import HatadyTutorial from './HatadyTutorial.vue';
import type { HatadyTutorialKind } from '@/utility/hatady-tutorial-content.js';
import { getHatadyTutorialPages } from '@/utility/hatady-tutorial-content.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { prefer } from '@/preferences.js';

type AnimationFixture = {
	element: HTMLElement;
	page: string | undefined;
	frames: Keyframe[];
	options: KeyframeAnimationOptions;
	startTime: number | null;
	finished: Promise<void>;
	complete: () => void;
	cancel: ReturnType<typeof vi.fn>;
};
type ThemeOption = { text: string; icon?: string; action: () => Promise<void> };

const animations: AnimationFixture[] = [];
const cleanups: Array<() => void> = [];
const rafCallbacks = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let reduced: EventTarget & { matches: boolean };
let originalAnimate: PropertyDescriptor | undefined;

class TutorialResizeObserver {
	static instances: TutorialResizeObserver[] = [];
	readonly elements = new Set<Element>();
	readonly disconnect = vi.fn(() => this.elements.clear());
	readonly observe = vi.fn((element: Element) => this.elements.add(element));
	readonly unobserve = vi.fn((element: Element) => this.elements.delete(element));
	constructor(private readonly callback: ResizeObserverCallback) { TutorialResizeObserver.instances.push(this); }
	fire(): void { this.callback([], this as unknown as ResizeObserver); }
}

async function settle(): Promise<void> {
	for (let count = 0; count < 8; count++) { await Promise.resolve(); await nextTick(); }
}

function element<T extends Element = HTMLElement>(target: ParentNode, selector: string): T {
	const found = target.querySelector<T>(selector);
	if (!found) throw new Error('Missing tutorial element: ' + selector);
	return found;
}

async function click(target: HTMLElement, selector: string): Promise<void> {
	element<HTMLButtonElement>(target, selector).click();
	await settle();
}

async function pageNumber(target: HTMLElement, index: number): Promise<void> {
	const button = target.querySelectorAll<HTMLButtonElement>('.steps button')[index];
	if (!button) throw new Error('Missing tutorial step: ' + index);
	button.click();
	await settle();
}

async function mountTutorial(kind: HatadyTutorialKind, motion = false, cancelSignal?: AbortSignal, hatagoes = false) {
	prefer.r.animation.value = motion;
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const done = vi.fn(), closed = vi.fn();
	const app = createApp({ render: () => h(HatadyTutorial, { kind, cancelSignal, onDone: done, onClosed: closed }) });
	if (hatagoes) app.provide(HATA_GOES_HOST, { active: ref(true), register: () => () => {}, changed: () => {} });
	app.mount(target);
	let unmounted = false;
	const unmount = () => {
		if (unmounted) return;
		unmounted = true;
		app.unmount();
		target.remove();
	};
	cleanups.push(unmount);
	await settle();
	return { target, done, closed, unmount };
}

function pair(offset = 0) {
	const outgoing = animations[offset], incoming = animations[offset + 1];
	if (!outgoing || !incoming) throw new Error('Both page animations must be started');
	expect(outgoing.element.hasAttribute('data-leaving')).toBe(true);
	expect(incoming.element.hasAttribute('data-leaving')).toBe(false);
	expect(outgoing.frames.every(frame => frame.opacity === 1)).toBe(true);
	expect(incoming.frames[0].opacity).toBe(0);
	expect(incoming.frames.at(-1)?.opacity).toBe(1);
	expect(outgoing.options).toMatchObject({ duration: 320, fill: 'both' });
	expect(incoming.options).toEqual(outgoing.options);
	expect(incoming.startTime).toBe(outgoing.startTime);
	return { outgoing, incoming };
}

beforeEach(() => {
	animations.splice(0);
	rafCallbacks.clear();
	nextFrame = 0;
	TutorialResizeObserver.instances = [];
	prefer.r.animation.value = false;
	hatadyTheme.value = 'hataskey';
	fixtures.save.mockReset().mockResolvedValue(undefined);
	fixtures.notify.mockReset();
	fixtures.menu.mockReset().mockResolvedValue(undefined);
	fixtures.api.mockReset().mockRejectedValue(new Error('Tutorial examples cannot call APIs'));
	fixtures.dialogClose.mockReset();
	reduced = Object.assign(new window.EventTarget(), { matches: false });
	vi.spyOn(window, 'matchMedia').mockReturnValue(reduced as MediaQueryList);
	vi.stubGlobal('ResizeObserver', TutorialResizeObserver);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
		const id = ++nextFrame;
		rafCallbacks.set(id, callback);
		return id;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => rafCallbacks.delete(id)));
	originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
	Object.defineProperty(HTMLElement.prototype, 'animate', {
		configurable: true, writable: true,
		value(this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
			let complete: () => void = () => { throw new Error('Animation promise not initialized'); };
			let reject: (error: Error) => void = () => { throw new Error('Animation promise not initialized'); };
			const finished = new Promise<void>((resolve, fail) => { complete = resolve; reject = fail; });
			const animation: AnimationFixture = {
				element: this, page: this.dataset.page, frames, options, finished, complete,
				startTime: 100 + animations.length,
				cancel: vi.fn(() => reject(new Error('Animation cancelled'))),
			};
			animations.push(animation);
			return animation as unknown as Animation;
		},
	});
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
	else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Hatady tutorial pages and completion', () => {
	test.each(['initial', 'update'] as const)('%sの全ページが説明と操作不能な見本を表示し、句読点を維持する', async kind => {
		const { target, done, closed } = await mountTutorial(kind);
		const expected = kind === 'initial'
			? ['about', 'record', 'draft', 'visibility', 'collection', 'following', 'reflection']
			: ['home', 'record', 'records', 'collection', 'profile'];
		const pages = getHatadyTutorialPages(kind);
		expect(pages.map(page => page.id)).toEqual(expected);
		expect(element(target, '[role="dialog"]').getAttribute('data-bare')).toBe('true');
		expect(element(target, '[role="dialog"]').getAttribute('aria-label')).toBe(kind === 'initial' ? 'Hatadyの使い方' : 'Welcome to Hatady V2');
		for (const [index, page] of pages.entries()) {
			const live = element<HTMLElement>(target, '.page:not([data-leaving])');
			expect(live.dataset.page).toBe(page.id);
			expect(element(target, '.steps [aria-current="step"]').textContent).toBe(String(index + 1));
			expect(element(target, '.mobileStep').textContent).toContain((index + 1) + ' / ' + pages.length);
			expect(element(live, 'figure').getAttribute('aria-label')).toBe(page.figure);
			const example = element(live, '.example');
			expect(example.getAttribute('aria-hidden')).toBe('true');
			expect(example.getAttribute('data-page')).toBe(page.id);
			expect(element(example, '.screen').textContent?.trim()).toBeTruthy();
			expect(example.querySelector('button,input,select,textarea,a[href],form,[tabindex]')).toBeNull();
			expect(element(live, '.copy h3').textContent).toBe(page.title);
			expect(element(live, '.copy h3').querySelector('br')).toBeNull();
			for (const [selector, text] of [['p:not(.note)', page.description], ['p.note', page.note]]) {
				if (!text) { expect(live.querySelector('.copy ' + selector)).toBeNull(); continue; }
				const copy = element(live, '.copy ' + selector);
				const phrases = [...copy.querySelectorAll('.phrase')].map(part => part.textContent);
				expect(phrases.join('')).toBe(text);
				expect(copy.querySelectorAll('br')).toHaveLength(Math.max(0, phrases.length - 1));
			}
			expect(target.querySelector('[data-leaving]')).toBeNull();
			expect(done).not.toHaveBeenCalled();
			if (index < pages.length - 1) {
				await click(target, '.actions .hy-primary');
				expect(window.document.activeElement).toBe(element(target, '.page:not([data-leaving]) h3'));
			}
		}
		expect(animations).toHaveLength(0);
		expect(closed).not.toHaveBeenCalled();
		expect(fixtures.api).not.toHaveBeenCalled();
		expect(fixtures.save).not.toHaveBeenCalled();
	});

	test.each((['initial', 'update'] as const).flatMap(kind => ['skip', 'close', 'dialog', 'complete'].map(action => ({ kind, action }))))(
		'$kindの$actionは対応する完了条件で一度だけ閉じる',
		async ({ kind, action }) => {
			const { target, done, closed } = await mountTutorial(kind);
			if (action === 'complete') {
				await pageNumber(target, getHatadyTutorialPages(kind).length - 1);
				await click(target, '.actions .hy-primary');
			} else if (action === 'skip') await click(target, '.actions .hy-secondary');
			else if (action === 'close') await click(target, '[aria-label="閉じる"]');
			else {
				element(target, '[data-dialog-host]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				await settle();
			}
			expect(done).toHaveBeenCalledTimes(kind === 'initial' || action === 'complete' ? 1 : 0);
			expect(closed).toHaveBeenCalledTimes(1);
			expect(fixtures.dialogClose).toHaveBeenCalledTimes(1);
			await click(target, '[aria-label="閉じる"]');
			await click(target, '.actions .hy-primary');
			expect(done).toHaveBeenCalledTimes(kind === 'initial' || action === 'complete' ? 1 : 0);
			expect(closed).toHaveBeenCalledTimes(1);
		},
	);
});

describe('Hatady tutorial transitions', () => {
	test('次へと戻るは旧ページを不透明で重ね、両方の終了を待ってから取り除く', async () => {
		const { target } = await mountTutorial('update', true);
		const oldText = element(target, '.page').textContent;
		await click(target, '.actions .hy-primary');
		const leaving = element<HTMLElement>(target, '[data-leaving]');
		expect(leaving.dataset.page).toBe('home');
		expect(leaving.textContent).toBe(oldText);
		expect(leaving.getAttribute('aria-hidden')).toBe('true');
		expect(leaving.hasAttribute('inert')).toBe(true);
		expect(leaving.hasAttribute('id')).toBe(false);
		expect(leaving.querySelector('[id]')).toBeNull();
		const live = element<HTMLElement>(target, '.page:not([data-leaving])');
		expect(live.dataset.page).toBe('record');
		expect(window.document.activeElement).toBe(element(live, 'h3'));
		expect(target.querySelectorAll('[id]')).toHaveLength(1);
		const forward = pair();
		expect(forward.outgoing.frames.at(-1)?.transform).toBe('translateX(-12px)');
		expect(forward.incoming.frames[0].transform).toBe('translateX(12px)');
		forward.incoming.complete(); await settle();
		expect(leaving.isConnected).toBe(true);
		forward.outgoing.complete(); await settle();
		expect(target.querySelector('[data-leaving]')).toBeNull();
		await click(target, '.actions .hy-secondary');
		const backward = pair(2);
		expect(backward.incoming.frames[0].transform).toBe('translateX(-12px)');
		expect(backward.outgoing.frames.at(-1)?.transform).toBe('translateX(12px)');
		expect(live.dataset.page).toBe('home');
		backward.outgoing.complete(); await settle();
		expect(backward.outgoing.element.isConnected).toBe(true);
		backward.incoming.complete(); await settle();
		expect(target.querySelector('[data-leaving]')).toBeNull();
	});

	test('連打中は進行中の遷移を取り消さず、最後に指定したページへだけ進む', async () => {
		const { target, done } = await mountTutorial('update', true);
		await click(target, '.actions .hy-primary');
		const first = pair();
		await pageNumber(target, 2);
		await pageNumber(target, 4);
		expect(animations).toHaveLength(2);
		expect(first.outgoing.cancel).not.toHaveBeenCalled();
		expect(first.incoming.cancel).not.toHaveBeenCalled();
		expect(element(target, '.page:not([data-leaving])').getAttribute('data-page')).toBe('record');
		first.outgoing.complete(); first.incoming.complete(); await settle();
		expect(animations).toHaveLength(4);
		const queued = pair(2);
		expect(queued.outgoing.page).toBe('record');
		expect(queued.incoming.page).toBe('profile');
		expect(target.querySelectorAll('[data-leaving]')).toHaveLength(1);
		queued.outgoing.complete(); queued.incoming.complete(); await settle();
		expect(target.querySelector('[data-leaving]')).toBeNull();
		expect(element(target, '.steps [aria-current]').textContent).toBe('5');
		expect(done).not.toHaveBeenCalled();
	});

	test.each(['close', 'resize', 'reduced', 'preference', 'unmount'])('%sで重なりと予約を片付け、古い遷移を再開しない', async reason => {
		const mounted = await mountTutorial('update', true);
		await click(mounted.target, '.actions .hy-primary');
		await pageNumber(mounted.target, 4);
		const moving = pair();
		const live = element<HTMLElement>(mounted.target, '.page:not([data-leaving])');
		const observer = TutorialResizeObserver.instances[0];
		observer.fire();
		if (reason === 'close') await click(mounted.target, '[aria-label="閉じる"]');
		if (reason === 'resize') window.dispatchEvent(new window.Event('resize'));
		if (reason === 'reduced') { reduced.matches = true; reduced.dispatchEvent(new window.Event('change')); }
		if (reason === 'preference') prefer.r.animation.value = false;
		if (reason === 'unmount') mounted.unmount();
		await settle();
		expect(moving.outgoing.cancel).toHaveBeenCalled();
		expect(moving.incoming.cancel).toHaveBeenCalled();
		expect(moving.outgoing.element.isConnected).toBe(false);
		expect(live.dataset.page).toBe('record');
		expect(animations).toHaveLength(2);
		expect(mounted.done).not.toHaveBeenCalled();
		expect(mounted.closed).toHaveBeenCalledTimes(reason === 'close' ? 1 : 0);
		if (reason === 'unmount') {
			expect(observer.disconnect).toHaveBeenCalledTimes(1);
			expect(rafCallbacks.size).toBe(0);
			observer.fire();
			window.dispatchEvent(new window.Event('resize'));
			reduced.dispatchEvent(new window.Event('change'));
			await settle();
			expect(rafCallbacks.size).toBe(0);
			expect(animations).toHaveLength(2);
		} else expect(mounted.target.querySelector('[data-leaving]')).toBeNull();
	});

	test('HataGoesではアニメーション設定を無視し、短いページ遷移を使う', async () => {
		reduced.matches = true;
		const { target } = await mountTutorial('initial', false, undefined, true);
		await click(target, '.actions .hy-primary');
		expect(animations).toHaveLength(2);
		expect(animations[0].options.duration).toBe(160);
		expect(animations[1].frames[0].transform).toBe('translateX(4px)');
		prefer.r.animation.value = true;
		reduced.dispatchEvent(new window.Event('change'));
		await settle();
		expect(animations.every(animation => animation.cancel.mock.calls.length === 0)).toBe(true);
		animations.forEach(animation => animation.complete());
		await settle();
		expect(target.querySelector('[data-leaving]')).toBeNull();
	});

	test('OSの動きを減らす設定ではアニメーションも旧ページも作らず移動する', async () => {
		reduced.matches = true;
		const { target } = await mountTutorial('initial', true);
		await click(target, '.actions .hy-primary');
		expect(element(target, '.page').getAttribute('data-page')).toBe('record');
		expect(target.querySelector('[data-leaving]')).toBeNull();
		expect(animations).toHaveLength(0);
		expect(window.document.activeElement).toBe(element(target, '.page h3'));
	});

	test('呼出元からの中断は初回でも完了を発火せず、遷移を片付けてダイアログを一度だけ閉じる', async () => {
		const controller = new AbortController();
		const { target, done, closed } = await mountTutorial('initial', true, controller.signal);
		await click(target, '.actions .hy-primary');
		await pageNumber(target, 4);
		const moving = pair();
		controller.abort();
		await settle();
		expect(moving.outgoing.cancel).toHaveBeenCalledTimes(1);
		expect(moving.incoming.cancel).toHaveBeenCalledTimes(1);
		expect(target.querySelector('[data-leaving]')).toBeNull();
		expect(element(target, '.page').getAttribute('data-page')).toBe('record');
		expect(animations).toHaveLength(2);
		expect(done).not.toHaveBeenCalled();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(fixtures.dialogClose).toHaveBeenCalledTimes(1);
		controller.abort();
		await click(target, '[aria-label="閉じる"]');
		expect(done).not.toHaveBeenCalled();
		expect(closed).toHaveBeenCalledTimes(1);
		expect(fixtures.dialogClose).toHaveBeenCalledTimes(1);
	});
});

test('見本はページ全体の残量で縮小と再拡大を行い、横並びと閉じた後の処理を切り替える', async () => {
	// Controlled DOM dimensions exercise the fit calculation, not device layout.
	const { target } = await mountTutorial('update');
	const page = element<HTMLElement>(target, '.page');
	const scene = element<HTMLElement>(page, '.previewScene');
	const stage = element<HTMLElement>(page, '.previewStage');
	const preview = element<HTMLElement>(page, '.preview');
	const caption = element<HTMLElement>(preview, 'figcaption');
	const copy = element<HTMLElement>(page, '.copy');
	const dimensions = { pageHeight: 360, stageWidth: 280, stageHeight: 162 };
	Object.defineProperties(scene, {
		offsetWidth: { configurable: true, get: () => 320 },
		offsetHeight: { configurable: true, get: () => 400 },
	});
	Object.defineProperties(stage, {
		clientWidth: { configurable: true, get: () => dimensions.stageWidth },
		clientHeight: { configurable: true, get: () => dimensions.stageHeight },
	});
	Object.defineProperty(page, 'clientHeight', { configurable: true, get: () => dimensions.pageHeight });
	Object.defineProperty(copy, 'offsetHeight', { configurable: true, get: () => 160 });
	Object.defineProperty(caption, 'offsetHeight', { configurable: true, get: () => 20 });
	page.style.setProperty('--preview-stacked', '1');
	page.style.rowGap = '12px';
	preview.style.rowGap = '6px';
	const writeScale = vi.spyOn(scene.style, 'setProperty');
	const writeHeight = vi.spyOn(preview.style, 'setProperty');
	const observer = TutorialResizeObserver.instances[0];

	async function fit(): Promise<void> {
		observer.fire();
		const callbacks = [...rafCallbacks.values()];
		rafCallbacks.clear();
		for (const callback of callbacks) callback(0);
		await settle();
	}

	await fit();
	expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBeCloseTo(162 / 400);
	expect(preview.style.getPropertyValue('--preview-height')).toBe('188px');
	expect(188 + copy.offsetHeight + 12).toBe(dimensions.pageHeight);
	writeScale.mockClear(); writeHeight.mockClear();
	await fit();
	expect(writeScale).not.toHaveBeenCalled();
	expect(writeHeight).not.toHaveBeenCalled();

	// The previous fitted stage height must not trap a taller page at the old scale.
	dimensions.pageHeight = 700;
	await fit();
	expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(280 / 320);
	expect(preview.style.getPropertyValue('--preview-height')).toBe('376px');
	expect(376 + copy.offsetHeight + 12).toBeLessThan(dimensions.pageHeight);
	page.style.setProperty('--preview-stacked', '0');
	dimensions.stageWidth = 160;
	dimensions.stageHeight = 400;
	await fit();
	expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(0.5);
	expect(preview.style.getPropertyValue('--preview-height')).toBe('');

	observer.fire();
	await click(target, '[aria-label="閉じる"]');
	dimensions.stageWidth = 320;
	writeScale.mockClear(); writeHeight.mockClear();
	await fit();
	expect(writeScale).not.toHaveBeenCalled();
	expect(writeHeight).not.toHaveBeenCalled();
	expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(0.5);
	expect(rafCallbacks.size).toBe(0);
});

test('配色は既存メニューから保存し、保存中の重複操作と失敗後の誤反映を防ぐ', async () => {
	const { target, done } = await mountTutorial('update');
	await click(target, '[aria-label="配色を選ぶ"]');
	const options = fixtures.menu.mock.calls[0][0] as ThemeOption[];
	expect(options.map(option => option.text)).toEqual(['ライト', 'ダーク', 'ペーパー', 'エスプレッソ', 'Hataskeyに合わせる']);
	expect(options.find(option => option.text === 'Hataskeyに合わせる')?.icon).toBe('ti ti-check');
	let finishSave: () => void = () => { throw new Error('Save promise not initialized'); };
	const pending = new Promise<void>(resolve => { finishSave = resolve; });
	fixtures.save.mockImplementationOnce(async () => { await pending; hatadyTheme.value = 'paper'; });
	const saving = options[2].action();
	await settle();
	expect(element<HTMLButtonElement>(target, '[aria-label="配色を選ぶ"]').disabled).toBe(true);
	await options[1].action();
	expect(fixtures.save).toHaveBeenCalledExactlyOnceWith('paper');
	finishSave(); await saving; await settle();
	expect(hatadyTheme.value).toBe('paper');
	expect(element<HTMLButtonElement>(target, '[aria-label="配色を選ぶ"]').disabled).toBe(false);
	fixtures.save.mockRejectedValueOnce(new Error('offline'));
	await options[3].action(); await settle();
	expect(fixtures.notify).toHaveBeenCalledExactlyOnceWith('配色を保存できませんでした');
	expect(hatadyTheme.value).toBe('paper');
	expect(done).not.toHaveBeenCalled();
	await click(target, '[aria-label="閉じる"]');
	await options[0].action();
	expect(fixtures.save).toHaveBeenCalledTimes(2);
});

test('既存HyDialogの中央配置を継承し、固定高さと重ねる領域をCSSで保持する', () => {
	// Source contracts only: this does not measure browser or device geometry.
	const source = readFileSync(process.cwd() + '/src/components/HyTutorial.vue', 'utf8');
	const dialog = readFileSync(process.cwd() + '/src/components/HyDialog.vue', 'utf8');
	const { descriptor } = parse(source);
	const css = descriptor.styles.map(style => style.content).join('\n').replace(/\s+/g, '');
	expect(descriptor.template?.content).toContain('<HyDialog');
	expect(descriptor.template?.content).toMatch(/\sbare\s/u);
	expect(descriptor.template?.content).toContain(':anchorElement="anchorElement"');
	expect(css).toContain('height:min(700px,100%)');
	expect(css).toContain('.tutorial:deep([role=\'dialog\']){height:100%;}');
	expect(css).toContain('grid-area:1/1');
	expect(css).toContain('grid-template-columns:44pxminmax(0,1fr)44px');
	expect(css).toContain('max-width:100%;max-height:100%;margin:auto');
	expect(css).toContain('@containerhy-dialog(max-width:700px)');
	expect(css).toContain('height:var(--preview-height,auto)');
	expect(css).toMatch(/\.page\[data-leaving\]\{z-index:0;pointer-events:none;user-select:none;?\}/u);
	expect(dialog).toMatch(/\.panel\[data-floating='false'\]\[data-embedded='false'\]\s*\{[^}]*margin:\s*auto;/u);
	expect(dialog).toMatch(/\.body\s*\{[^}]*min-height:\s*0;/u);
	expect(dialog).toMatch(/\.body\[data-bare='true'\]\s*\{[^}]*padding:\s*0;[^}]*display:\s*flex;[^}]*overflow:\s*hidden;/u);
});
