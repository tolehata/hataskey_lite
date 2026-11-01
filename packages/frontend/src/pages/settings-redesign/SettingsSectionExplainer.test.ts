/* SPDX-License-Identifier: AGPL-3.0-only */

import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'js-yaml';
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsSectionExplainer from './SettingsSectionExplainer.vue';
import source from './SettingsSectionExplainer.vue?raw';
import { sectionExplanationScenes, settingsExplanationSceneIds } from './settings-section-explanations.js';
import type { SettingsBentoSectionId } from './settings-bento-catalog.js';
import type { App } from 'vue';

// The approved mock's 57 section-to-scene assignments, independent of the renderer.
const scenesByCategory = vi.hoisted(() => ({
	profile: ['profile', 'card', 'effects', 'mascot'],
	privacy: ['lock', 'link', 'dm', 'shield', 'autodel'],
	security: ['mail', 'login', 'history', 'swap'],
	appearance: ['theme', 'font', 'layout', 'nav', 'glass', 'effects'],
	timeline: ['feed', 'fold', 'note', 'actions', 'reactions', 'media', 'deck'],
	post: ['compose', 'visibility', 'actions', 'border', 'emoji', 'picker'],
	notify: ['bell', 'popup', 'mail', 'sound'],
	access: ['access', 'swipe', 'speed', 'sliders'],
	mute: ['mute', 'block', 'link'],
	drive: ['upload', 'upload', 'media', 'video'],
	apps: ['apps', 'mascot'],
	data: ['backup', 'backup', 'export', 'link'],
	advanced: ['globe', 'speed', 'extend', 'clean'],
}));

vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: { _hata: { _settingsBento: { sectionExplainer: Object.fromEntries(Object.entries(scenesByCategory).map(([category, scenes]) => [category, Object.fromEntries(scenes.map((scene, index) => [`section${index}`, `${category}.${index}: ${scene}`]))])) } } },
		tsx: { _ago: { minutesAgo: ({ n }: { n: number }) => `${n}分前` } },
	},
}));

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	vi.unstubAllGlobals();
});

function mountSection(sectionId: SettingsBentoSectionId = 'profile.section0') {
	const state = reactive({ sectionId, motionEnabled: true });
	const container = window.document.createElement('div');
	const app = createApp({ render: () => h(SettingsSectionExplainer, state) });
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, state, app };
}

describe('settings section explanations', () => {
	test('57節の対応を維持し、実際に47種類すべての図と文を描画する', async () => {
		const expected = Object.fromEntries(Object.entries(scenesByCategory).flatMap(([category, scenes]) => scenes.map((scene, index) => [`${category}.section${index}`, scene])));
		expect(sectionExplanationScenes).toEqual(expected);
		expect(Object.keys(expected)).toHaveLength(57);
		expect([...new Set(Object.values(expected))].sort()).toEqual([...settingsExplanationSceneIds]);
		expect(settingsExplanationSceneIds).toHaveLength(47);
		const { container, state } = mountSection();
		for (const [sectionId, sceneId] of Object.entries(sectionExplanationScenes)) {
			state.sectionId = sectionId as SettingsBentoSectionId;
			await nextTick();
			const scene = container.querySelector(`[data-settings-explanation-scene="${sceneId}"]`);
			expect(scene?.childElementCount, sectionId).toBe(1);
			expect(scene?.firstElementChild?.childElementCount, sectionId).toBeGreaterThan(0);
			expect(container.textContent, sectionId).toContain(`${sectionId.replace('.section', '.')}: ${sceneId}`);
			expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
			expect(container.querySelector('svg')?.getAttribute('focusable')).toBe('false');
			expect(container.querySelector('button, input, a')).toBeNull();
		}
	});

	test('元図の数値寸法をpxへ変換し、reduced-motion用の静止状態も残す', async () => {
		const { container, state } = mountSection('profile.section0');
		expect(container.querySelector<HTMLElement>('[style*="width: 32px"]')?.style.height).toBe('32px');
		const typing = container.querySelector<HTMLElement>('[style*="hata-section-type"]');
		expect(typing?.style.width).toBe('78%');
		state.sectionId = 'appearance.section0';
		state.motionEnabled = false;
		await nextTick();
		expect(container.firstElementChild?.getAttribute('data-motion-enabled')).toBe('false');
		expect(container.querySelector<HTMLElement>('[style*="hata-section-fadeB"]')?.style.opacity).toBe('0');
	});

	test('アプリ図は既存4ロゴを使い、motion設定を引き継ぐ', async () => {
		const { container, state } = mountSection('apps.section0');
		expect([...container.querySelectorAll<HTMLElement>('[data-app]')].map(logo => logo.dataset.app)).toEqual(['hatagoes', 'hatask', 'hatady', 'hatafeed']);
		state.motionEnabled = false;
		await nextTick();
		expect([...container.querySelectorAll<HTMLElement>('[data-app]')].every(logo => logo.dataset.active === 'false')).toBe(true);
	});

	test('画面外で停止してから復帰し、observerを破棄する', async () => {
		let update: IntersectionObserverCallback | undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal('IntersectionObserver', class {
			constructor(callback: IntersectionObserverCallback) { update = callback; }
			observe = observe;
			disconnect = disconnect;
		});
		const { container, app } = mountSection('apps.section0');
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

	test('参照するanimationがすべて定義され、OS設定とコンテナ幅に対応する', () => {
		const keyframes = new Set([...source.matchAll(/@keyframes (hata-section-[\w-]+)/gu)].map(match => match[1]));
		const script = source.split('<script setup lang="ts">')[1].split('</script>')[0];
		const references = new Set([...script.matchAll(/['`](hata-section-[\w-]+)/gu)].map(match => match[1]));
		const missing = (values: Iterable<string>) => [...values].filter(value => !keyframes.has(value));
		expect(missing([...references, 'hata-section-audit-missing'])).toEqual(['hata-section-audit-missing']);
		expect(missing(references)).toEqual([]);
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
		expect(source).toContain('@container settings-section-explainer');
		expect(source).toContain('[data-motion-enabled=\'false\']');
	});

	test('ja/en/zhそれぞれに57節の説明文が揃う', async () => {
		const expected = Object.entries(scenesByCategory).flatMap(([category, scenes]) => scenes.map((_, index) => `${category}.section${index}`)).sort();
		for (const locale of ['ja-JP', 'en-US', 'zh-CN']) {
			const yaml = await fs.readFile(path.resolve(process.cwd(), `../../locales/${locale}.yml`), 'utf8');
			const tree = load(yaml) as { _hata: { _settingsBento: { sectionExplainer: Record<string, Record<string, string>> } } };
			const captions = Object.entries(tree._hata._settingsBento.sectionExplainer).flatMap(([category, sections]) => Object.entries(sections).map(([section, caption]) => [`${category}.${section}`, caption]));
			expect(captions.map(([key]) => key).sort(), locale).toEqual(expected);
			for (const [key, caption] of captions) expect(caption.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
		}
	});
});
