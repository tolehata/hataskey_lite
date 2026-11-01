/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable vue/one-component-per-file -- Separate test doubles isolate the guide exit and page wrapper. */

import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataIntroPage from './hata-intro.vue';
import HataDocsPage from './hata-docs.vue';
import type { App, Component } from 'vue';
import type { Router } from '@/router.js';
import { DI } from '@/di.js';

const fixture = vi.hoisted(() => ({ mainRouter: { push: vi.fn() } }));

vi.mock('@/router.js', async () => {
	const { inject } = await import('vue');
	const { DI: keys } = await import('@/di.js');
	return {
		mainRouter: fixture.mainRouter,
		useRouter: () => inject(keys.router, null) ?? fixture.mainRouter,
	};
});
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/components/hata-intro/HataIntro.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		emits: ['exit'],
		setup: (_props, { emit }) => () => render('button', {
			type: 'button',
			'data-intro-exit': '',
			onClick: () => emit('exit'),
		}, '終了'),
	}) };
});

const mounted: { app: App; container: HTMLDivElement }[] = [];

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	vi.restoreAllMocks();
});

function mountPage(page: Component, historyLength: number, options: {
	router?: { push: ReturnType<typeof vi.fn> };
	closePageWindow?: () => void;
} = {}) {
	vi.spyOn(window.history, 'length', 'get').mockReturnValue(historyLength);
	const browserBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
	const app = createApp(page);
	app.component('PageWithHeader', {
		setup: (_props, { slots }) => () => h('div', slots.default?.()),
	});
	if (options.router) app.provide(DI.router, options.router as unknown as Router);
	if (options.closePageWindow) app.provide(DI.pageWindowClose, options.closePageWindow);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	mounted.push({ app, container });
	app.mount(container);
	const button = container.querySelector<HTMLButtonElement>('[data-intro-exit]');
	if (!button) throw new Error('HataIntro exit stub was not mounted');
	return { browserBack, exit: async () => { button.click(); await nextTick(); } };
}

describe.each([
	['HataIntro', HataIntroPage],
	['公開機能解説', HataDocsPage],
] as const)('%sの終了経路', (_name, page) => {
	test('通常画面に履歴があればブラウザーで前の画面へ戻る', async () => {
		const current = mountPage(page, 2);
		await current.exit();
		expect(current.browserBack).toHaveBeenCalledOnce();
		expect(fixture.mainRouter.push).not.toHaveBeenCalled();
	});

	test('直接開いた通常画面ではホームへ移動する', async () => {
		const current = mountPage(page, 1);
		await current.exit();
		expect(fixture.mainRouter.push).toHaveBeenCalledExactlyOnceWith('/');
		expect(current.browserBack).not.toHaveBeenCalled();
	});

	test('小窓では履歴やルートを変更せず既存の終了処理を呼ぶ', async () => {
		const router = { push: vi.fn() };
		const closePageWindow = vi.fn();
		const current = mountPage(page, 2, { router, closePageWindow });
		await current.exit();
		expect(closePageWindow).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
		expect(fixture.mainRouter.push).not.toHaveBeenCalled();
		expect(current.browserBack).not.toHaveBeenCalled();
	});

	test('閉窓処理のない別ルーターではその画面のホームへ移動する', async () => {
		const router = { push: vi.fn() };
		const current = mountPage(page, 2, { router });
		await current.exit();
		expect(router.push).toHaveBeenCalledExactlyOnceWith('/');
		expect(fixture.mainRouter.push).not.toHaveBeenCalled();
		expect(current.browserBack).not.toHaveBeenCalled();
	});
});
