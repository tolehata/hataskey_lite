/* SPDX-License-Identifier: AGPL-3.0-only */

import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsCategoryExplainer from './SettingsCategoryExplainer.vue';
import type { App } from 'vue';

const categoryIds = vi.hoisted(() => ['profile', 'privacy', 'security', 'appearance', 'timeline', 'post', 'notify', 'access', 'mute', 'drive', 'apps', 'data', 'advanced']);

vi.mock('@/i18n.js', () => ({
	i18n: { ts: { _hata: { _settingsBento: {
		categoryExplainerHeading: 'このカテゴリでできること',
		explainer: Object.fromEntries(categoryIds.map(id => [id, `${id} caption`])),
	} } } },
}));

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	vi.unstubAllGlobals();
});

function mountExplainer(categoryId = 'profile') {
	const state = reactive({ categoryId, motionEnabled: true, compact: false });
	const container = window.document.createElement('div');
	const app = createApp({ render: () => h(SettingsCategoryExplainer, state) });
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, state, app };
}

describe('settings category explanations', () => {
	test('13カテゴリそれぞれに説明図と説明文があり、図は読み上げとTab移動の対象外', async () => {
		const { container, state } = mountExplainer();
		for (const categoryId of categoryIds) {
			state.categoryId = categoryId;
			await nextTick();
			const scene = container.querySelector(`[data-scene="${categoryId}"]`);
			expect(scene?.childElementCount).toBe(1);
			expect(scene?.firstElementChild?.childElementCount).toBeGreaterThan(0);
			expect(container.textContent).toContain(`${categoryId} caption`);
			expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
			expect(container.querySelector('svg')?.getAttribute('focusable')).toBe('false');
			expect(container.querySelector('button, input, a')).toBeNull();
		}
	});

	test('アプリ説明は既存の4アプリロゴを使い、モーション設定変更も追従する', async () => {
		const { container, state } = mountExplainer('apps');
		expect([...container.querySelectorAll<HTMLElement>('[data-app]')].map(logo => logo.dataset.app)).toEqual(['hatagoes', 'hatask', 'hatady', 'hatafeed']);
		state.motionEnabled = false;
		await nextTick();
		expect(container.querySelector('[data-motion-enabled]')?.getAttribute('data-motion-enabled')).toBe('false');
		expect([...container.querySelectorAll<HTMLElement>('[data-app]')].every(logo => logo.dataset.active === 'false')).toBe(true);
	});

	test('画面外ではアニメーションを停止し、復帰時だけ再開する', async () => {
		let update: IntersectionObserverCallback | undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal('IntersectionObserver', class {
			constructor(callback: IntersectionObserverCallback) { update = callback; }
			observe = observe;
			disconnect = disconnect;
		});
		const { container, app } = mountExplainer('apps');
		expect(observe).toHaveBeenCalledWith(container.firstElementChild);
		update?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
		await nextTick();
		expect(container.firstElementChild?.getAttribute('data-animation-visible')).toBe('false');
		update?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		await nextTick();
		expect(container.firstElementChild?.getAttribute('data-animation-visible')).toBe('true');
		app.unmount();
		mounted.pop();
		container.remove();
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});
