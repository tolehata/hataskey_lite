/* SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import MkMascotSettings from '../pages/MkMascotSettings.vue';
import MkMascotFloating from './MkMascotFloating.vue';

const state = vi.hoisted(() => ({
	store: {} as any,
	saved: null as any,
	resize: null as any,
}));

vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/router.js', () => ({ mainRouter: { currentRef: { value: { _parsedRoute: { fullPath: '/timeline' } } } } }));
vi.mock('@/utility/hata-mascot-suppression.js', () => ({ hataMascotSuppressed: ref(false) }));
vi.mock('@/i.js', () => ({ $i: { policies: { canUseMascot: true } } }));
vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: { _hata: { _mascotSettings: new Proxy({}, { get: (_, key) => String(key) }), _mascotFloating: {} } },
		tsx: { _hata: { _mascotSettings: new Proxy({}, { get: () => () => '' }) } },
	},
}));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: vi.fn() }));
vi.mock('@/os.js', () => ({ toast: vi.fn(), alert: vi.fn() }));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', () => ({ default: defineComponent({ setup: () => () => null }) }));
vi.mock('@/components/SettingsEmbeddedWindow.vue', () => ({ default: defineComponent({ setup: () => () => null }) }));
vi.mock('@/components/MkMascotImportSelectDialog.vue', () => ({ default: defineComponent({ setup: () => () => null }) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }) }));
vi.mock('@/components/MkModalWindow.vue', () => ({
	default: defineComponent({
		emits: ['ok'],
		setup: (_, { slots, emit }) => () => h('div', [
			h('button', { 'data-save': true, onClick: () => emit('ok') }, 'save'),
			slots.default?.(),
		]),
	}),
}));
vi.mock('@/utility/mascot-store.js', () => {
	state.store = {
		mascotLoaded: ref(true), displaySettingsLoaded: ref(true),
		currentExpression: ref(null), displayText: ref('ねむいにゃ'), announceMessage: ref(null),
		mascotVisible: ref(false), hatakMascotActive: ref(false), floatingMascotShown: ref(false),
		displaySettings: ref({ floatingEnabledDesktop: true, floatingOpacity: 1, floatingX: 40, floatingY: 40 }),
		loadMascot: vi.fn(async (force?: boolean) => {
			if (force) state.store.currentExpression.value = { ...state.saved.characters[0].expressions[0] };
		}),
		loadDisplaySettings: vi.fn(), saveDisplaySettings: vi.fn(), saveFloatingPosition: vi.fn(),
		pickRandomPhrase: vi.fn(), clearAnnounce: vi.fn(), nextIdleDelayMs: () => 60000,
		expressionDisplayUrl: (e: { url: string } | null) => e?.url ?? '', escapeText: (text: string) => text,
	};
	return state.store;
});
vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: vi.fn(async (endpoint: string, data: unknown) => {
		if (endpoint === 'hata/mascot/update') { state.saved = data; return { ok: true }; }
		return {
			consented: true,
			data: { activeCharacterId: 'cat', characters: [{
				id: 'cat', name: 'cat', expressions: [{ ...state.store.currentExpression.value }],
				phrases: [{ id: 'sleep', text: 'ねむいにゃ', expressionId: 'sleep' }],
			}] },
		};
	}),
}));

const mounted: { app: ReturnType<typeof createApp>; element: HTMLElement }[] = [];

async function settle() {
	for (let i = 0; i < 10; i++) await nextTick();
}

async function mount(component: typeof MkMascotFloating | typeof MkMascotSettings) {
	const element = window.document.createElement('div');
	window.document.body.append(element);
	const app = createApp(component);
	app.mount(element);
	mounted.push({ app, element });
	await settle();
	return element;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('Image', class { src = ''; decode() { return Promise.resolve(); } });
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: ResizeObserverCallback) { state.resize = callback; }
		observe() {}
		disconnect() {}
	});
	state.saved = null;
	state.store.loadMascot.mockClear();
	state.store.currentExpression.value = { id: 'sleep', label: 'sleep', url: '/cat.png', driveFileId: null, bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1 };
});

afterEach(() => {
	for (const { app, element } of mounted.splice(0)) { app.unmount(); element.remove(); }
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test('同じ画像・文言でも再取得した表情の吹き出し位置とサイズを反映する', async () => {
	const element = await mount(MkMascotFloating);
	state.store.currentExpression.value = { ...state.store.currentExpression.value, bubbleX: 0.9, bubbleY: 0.6, bubbleScale: 1.4 };
	await settle();
	const bubble = [...element.querySelectorAll('div')].find(el => el.textContent === 'ねむいにゃ' && el.style.fontSize);
	expect(bubble?.style.left).toBe('90%');
	expect(bubble?.style.top).toBe('60%');
	expect(bubble?.style.fontSize).toBe('1.19rem');
});

test.each([1, 1.6, 2.1])('拡大率 %s のプレビューでドラッグして保存した位置が TL に反映される', async (scale) => {
	const floating = await mount(MkMascotFloating);
	const settings = await mount(MkMascotSettings);
	state.resize([{ contentRect: { width: 200 * scale, height: 150 * scale } }]);
	await settle();
	const stage = settings.querySelector<HTMLElement>('[style*="scale("]')!;
	expect(stage.style.transform).toBe(`scale(${scale})`);
	vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 200 * scale, height: 150 * scale } as DOMRect);
	const bubble = [...stage.querySelectorAll('div')].find(el => el.style.left === '50%')!;
	bubble.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10 + 180 * scale, clientY: 20 + 90 * scale }));
	window.dispatchEvent(new PointerEvent('pointerup'));
	await settle();
	settings.querySelector<HTMLButtonElement>('[data-save]')!.click();
	await settle();
	expect(state.saved.characters[0].expressions[0]).toMatchObject({ bubbleX: 0.9, bubbleY: 0.6 });
	expect(state.store.loadMascot).toHaveBeenCalledWith(true);
	const shown = [...floating.querySelectorAll('div')].find(el => el.textContent === 'ねむいにゃ' && el.style.fontSize);
	expect(shown?.style.left).toBe('90%');
	expect(shown?.style.top).toBe('60%');
});
