/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';

const fixtures = vi.hoisted(() => ({ api: vi.fn(), save: vi.fn(), register: vi.fn() }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('paper') }));
vi.mock('@/utility/hatady-ui.js', () => ({ registerHatadySurface: fixtures.register }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({
		props: { preferType: String, anchorElement: Object }, emits: ['closed', 'esc', 'click'],
		setup(_, { expose, emit }) { expose({ close: () => emit('closed') }); },
		template: '<div data-modal @keydown.esc="$emit(\'esc\')"><div class="_modalBg" @click="$emit(\'click\')"/><div><slot/></div></div>',
	}) };
});
import HataFeedTutorial from './HataFeedTutorial.vue';
import HataFeedTutorialExample from './HataFeedTutorialExample.vue';
import { getHataFeedTutorialPages } from '@/utility/hatafeed-tutorial-content.js';
import type { HataFeedTutorialKind } from '@/utility/hatafeed-tutorial-content.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { prefer } from '@/preferences.js';
import { NOTIFICATION_TOAST_DURATION, notificationOutlinePaths } from '@/utility/hataskey-notification-toast.js';

const cleanups: (() => void)[] = [];

async function settle() { for (let i = 0; i < 6; i++) { await Promise.resolve(); await nextTick(); } }

async function mount(kind: HataFeedTutorialKind, isStaff: boolean, cancelSignal?: AbortSignal) {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const done = vi.fn(), closed = vi.fn();
	const app = createApp({ render: () => h(HataFeedTutorial, { kind, isStaff, cancelSignal, onDone: done, onClosed: closed }) });
	app.mount(target); cleanups.push(() => { app.unmount(); target.remove(); }); await settle();
	return { target, done, closed };
}

function button(target: HTMLElement, selector: string): HTMLButtonElement {
	const result = target.querySelector<HTMLButtonElement>(selector);
	if (!result) throw new Error('Missing tutorial button ' + selector);
	return result;
}

beforeEach(() => {
	fixtures.api.mockReset().mockRejectedValue(new Error('No real requests from examples')); fixtures.save.mockReset();
	fixtures.register.mockReset().mockReturnValue(vi.fn()); hataFeedTheme.value = 'light';
	prefer.r.animation.value = false;
});
afterEach(() => { cleanups.splice(0).forEach(close => close()); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function mountExample(initialPage: string, kind: HataFeedTutorialKind = 'update') {
	const page = ref(initialPage);
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedTutorialExample, { page: page.value, kind, isStaff: true }) });
	app.mount(target); cleanups.push(() => { app.unmount(); target.remove(); }); await settle();
	return { target, page };
}

describe('HataFeed tutorial using the Hatady guide layout', () => {
	test.each((['initial', 'update'] as const).flatMap(kind => [false, true].map(isStaff => ({ kind, isStaff }))))('$kind staff=$isStaff renders every page, keeps examples inert, and completes at the end', async ({ kind, isStaff }) => {
		const { target, done, closed } = await mount(kind, isStaff);
		const pages = getHataFeedTutorialPages(kind, isStaff);
		expect(target.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(kind === 'initial' ? 'HataFeedの使い方' : '新しくなったHataFeed');
		expect(pages.some(page => page.id === 'admin')).toBe(isStaff);
		for (const [index, page] of pages.entries()) {
			expect(target.querySelector('.page')?.getAttribute('data-page')).toBe(page.id);
			expect(target.querySelector('.copy h3')?.textContent).toBe(page.title);
			expect(target.querySelector('figure')?.getAttribute('aria-label')).toBe(page.figure);
			expect(target.querySelector('figure')?.getAttribute('data-caption')).toBe('false');
			expect(target.querySelector('figcaption')).toBeNull();
			const example = target.querySelector('.example');
			expect(example?.getAttribute('aria-hidden')).toBe('true');
			expect(example?.querySelector('.card')?.textContent?.trim()).toBeTruthy();
			expect(example?.querySelector('button,input,select,textarea,a[href],form,[tabindex]')).toBeNull();
			expect(example?.querySelector('.add')?.tagName).toBe('SPAN');
			expect(example?.querySelector('.add > .ti-plus')).not.toBeNull();
			if (page.id === 'settings') {
				expect(example?.querySelector('.projectChoice > span')?.textContent).toBe('Hataskey');
				expect(example?.querySelector('.projectChoice')?.classList.contains('search')).toBe(false);
			}
			expect(target.querySelector('.steps [aria-current="step"]')?.textContent).toBe(String(index + 1));
			expect(done).not.toHaveBeenCalled();
			button(target, '.actions .hy-primary').click(); await settle();
		}
		expect(done).toHaveBeenCalledOnce(); expect(closed).toHaveBeenCalledOnce();
		expect(fixtures.api).not.toHaveBeenCalled(); expect(fixtures.save).not.toHaveBeenCalled();
	});
	test('the update introduction breaks after まとめて', async () => {
		const { target } = await mount('update', true);
		expect(target.querySelector('.copy h3')?.textContent).toBe('状況をまとめて\n見られるホームに');
		const shell = readFileSync(process.cwd() + '/src/components/HyTutorial.vue', 'utf8');
		expect(shell).toMatch(/\.copy h3\s*\{[^}]*white-space: pre-line/u);
	});
	test('caption-free previews still fit and re-expand within the remaining height', async () => {
		// Synthetic dimensions verify the fit algorithm, not device rendering.
		const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
		const { target } = await mount('update', true);
		const page = target.querySelector<HTMLElement>('.page')!;
		const preview = target.querySelector<HTMLElement>('.preview')!;
		const scene = target.querySelector<HTMLElement>('.previewScene')!;
		const stage = target.querySelector<HTMLElement>('.previewStage')!;
		const copy = target.querySelector<HTMLElement>('.copy')!;
		const dimensions = { pageHeight: 360, stageWidth: 280, stageHeight: 188 };
		Object.defineProperties(scene, { offsetWidth: { get: () => 320 }, offsetHeight: { get: () => 400 } });
		Object.defineProperties(stage, { clientWidth: { get: () => dimensions.stageWidth }, clientHeight: { get: () => dimensions.stageHeight } });
		Object.defineProperty(page, 'clientHeight', { get: () => dimensions.pageHeight });
		Object.defineProperty(copy, 'offsetHeight', { get: () => 160 });
		page.style.setProperty('--preview-stacked', '1'); page.style.rowGap = '12px';

		async function fit() {
			window.dispatchEvent(new Event('resize'));
			const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); await settle();
		}

		await fit();
		expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(188 / 400);
		expect(preview.style.getPropertyValue('--preview-height')).toBe('188px');
		dimensions.pageHeight = 700; await fit();
		expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(280 / 320);
		expect(preview.style.getPropertyValue('--preview-height')).toBe('350px');
		page.style.setProperty('--preview-stacked', '0'); dimensions.stageWidth = 160; dimensions.stageHeight = 400; await fit();
		expect(Number(scene.style.getPropertyValue('--preview-scale'))).toBe(.5);
		expect(preview.style.getPropertyValue('--preview-height')).toBe('');
	});
	test('the creation example anchors its dropdown and overlays the editor for draft confirmation', async () => {
		vi.useFakeTimers(); prefer.r.animation.value = true;
		const { target, page } = await mountExample('create');
		expect(target.querySelector('.createDock .createMenu')).not.toBeNull();
		expect(target.querySelector('.add')?.getAttribute('data-open')).toBe('true');
		const editor = target.querySelector('.editorScene > .card');
		await vi.advanceTimersByTimeAsync(2400); await settle();
		expect(target.querySelector('.createMenu')).toBeNull();
		expect(target.querySelector('.add')?.getAttribute('data-open')).toBe('false');
		expect(target.querySelector('.editorScene > .card')).toBe(editor);
		expect(target.querySelector('.draftBackdrop .draftPrompt')).not.toBeNull();
		expect([...target.querySelectorAll('.draftActions .action')].map(item => item.textContent)).toEqual(['端末に下書きを保存して閉じる', '保存せず閉じる', '編集に戻る']);
		page.value = 'settings'; await settle();
		expect(target.querySelector('.draftBackdrop')).toBeNull();
	});
	test('the notification example uses the production outline paths and timing without a real notification queue', async () => {
		vi.useFakeTimers(); prefer.r.animation.value = true;
		vi.stubGlobal('ResizeObserver', class {
			constructor(private callback: () => void) {}
			observe(element: HTMLElement) {
				Object.defineProperties(element, { offsetWidth: { get: () => 240 }, offsetHeight: { get: () => 88 } });
				this.callback();
			}
			disconnect() {}
		});
		const { target, page } = await mountExample('notifications');
		const navbar = target.querySelector('.navbar')!;
		const tabs = navbar.querySelector('.tabs'); const content = target.querySelector('.screen > .card');
		expect(navbar.querySelector('.notice')?.getAttribute('data-open')).toBe('false');
		await vi.advanceTimersByTimeAsync(500); await settle();
		expect(navbar.querySelector('.notice')?.getAttribute('data-open')).toBe('true');
		expect(navbar.querySelector('.navSurface')?.contains(tabs!)).toBe(true);
		expect(navbar.querySelector('.navSurface')?.contains(navbar.querySelector('.notice'))).toBe(true);
		expect([...navbar.querySelectorAll('.noticeRing path')].map(path => path.getAttribute('d'))).toEqual(notificationOutlinePaths(240, 88, 20, true));
		await vi.advanceTimersByTimeAsync(NOTIFICATION_TOAST_DURATION); await settle();
		expect(navbar.querySelector('.notice')?.getAttribute('data-open')).toBe('false');
		expect(navbar.querySelector('.notice')?.getAttribute('data-leaving')).toBe('true');
		expect(navbar.querySelector('.noticeRing')).toBeNull();
		expect(target.querySelector('.screen > .card')).toBe(content);
		page.value = 'home'; await settle(); page.value = 'notifications'; await settle();
		await vi.advanceTimersByTimeAsync(500); await settle();
		expect(navbar.querySelector('.notice')?.getAttribute('data-open')).toBe('true');
		page.value = 'home'; await settle(); await vi.advanceTimersByTimeAsync(NOTIFICATION_TOAST_DURATION);
		expect(target.querySelector('.noticeRing')).toBeNull();
		expect(fixtures.api).not.toHaveBeenCalled();
	});
	test('turning animations off leaves a static notification example and cancels its expiry', async () => {
		vi.useFakeTimers(); prefer.r.animation.value = true;
		const { target } = await mountExample('notifications');
		prefer.r.animation.value = false; await settle();
		expect(target.querySelector('.example')?.getAttribute('data-motion')).toBe('false');
		await vi.advanceTimersByTimeAsync(2 * NOTIFICATION_TOAST_DURATION); await settle();
		expect(target.querySelector('.notice')?.getAttribute('data-open')).toBe('true');
	});
	test('preview layout rules isolate the plus, center the project, and keep notifications above the content', () => {
		const example = readFileSync(process.cwd() + '/src/components/HataFeedTutorialExample.vue', 'utf8');
		const plusIsSquare = (source: string) => /\.add\s*\{[^}]*place-items: center;[^}]*width: 30px;[^}]*height: 30px;[^}]*padding: 0;/u.test(source);
		expect(plusIsSquare(example.replace('width: 30px; height: 30px;', 'width: 1em; height: auto;'))).toBe(false);
		expect(plusIsSquare(example)).toBe(true);
		expect(example).toMatch(/\.add > i::before\s*\{[^}]*font-size: 100%/u);
		expect(example).toMatch(/\.projectChoice\s*\{[^}]*justify-content: center;/u);
		expect(example).not.toContain('.search > :last-child');
		expect(example).toMatch(/\.createMenu\s*\{[^}]*position: absolute;[^}]*max-width: 100%;/u);
		expect(example).toMatch(/\.draftBackdrop\s*\{[^}]*inset: 0;[^}]*place-items: center;/u);
		expect(example).toMatch(/\.navbar\s*\{[^}]*height: 40px;/u);
		expect(example).toContain('height .35s cubic-bezier(.22,1,.36,1)');
		expect(example).toContain('filter: blur(14px); opacity: .55;');
		expect(example).toContain('translateY(calc(100% + 12px))');
	});
	test.each(['skip', 'close', 'escape', 'cancel'] as const)('%s closes without marking an unread guide completed', async action => {
		const cancellation = new AbortController();
		const { target, done, closed } = await mount('initial', false, cancellation.signal);
		if (action === 'skip') button(target, '.actions .hy-secondary').click();
		if (action === 'close') button(target, '[aria-label="閉じる"]').click();
		if (action === 'escape') target.querySelector('[data-modal]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		if (action === 'cancel') cancellation.abort();
		await settle(); expect(done).not.toHaveBeenCalled(); expect(closed).toHaveBeenCalledOnce();
	});
	test('back and page buttons preserve focus while all four themes follow HataFeed instead of Hatady', async () => {
		const { target } = await mount('update', false);
		for (const theme of ['light', 'dark', 'paper', 'espresso'] as const) {
			hataFeedTheme.value = theme; await settle();
			expect(target.querySelector('[role="dialog"]')?.getAttribute('data-hatady-theme')).toBe(theme);
		}
		button(target, '.steps button:nth-child(3)').click(); await settle();
		expect(target.querySelector('.page')?.getAttribute('data-page')).toBe('notifications');
		button(target, '.actions .hy-secondary').click(); await settle();
		expect(target.querySelector('.page')?.getAttribute('data-page')).toBe('create');
		expect(window.document.activeElement).toBe(target.querySelector('.copy h3'));
	});
	test('the shared shell keeps the panel centered and fitted; the detector rejects a removed centering rule', () => {
		// Source layout contracts only; browser geometry is not measured here.
		const shell = readFileSync(process.cwd() + '/src/components/HyTutorial.vue', 'utf8');
		const validate = (source: string) => {
			const panel = source.match(/\.tutorial :deep\(\[role='dialog'\]\)\s*\{([^}]+)\}/u)?.[1] ?? '';
			return /margin:\s*auto/u.test(panel) && /box-sizing:\s*border-box/u.test(panel) && /max-width:\s*100%/u.test(panel) && /max-height:\s*100%/u.test(panel);
		};
		expect(validate(shell.replace('margin: auto;', 'margin: 0;'))).toBe(false);
		expect(validate(shell)).toBe(true);
		expect(shell).toContain('height: min(700px, 100%)');
		expect(shell).toContain('stage.clientWidth / width, availableHeight / height');
		expect(shell).toContain("!reducedMotion.matches && prefer.r.animation.value");
	});
});
