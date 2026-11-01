/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync } from '@vue/compiler-sfc';
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskRanking from './HataskRanking.vue';
import type { App } from 'vue';
import { instance } from '@/instance.js';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/instance.js', async () => ({ instance: (await import('vue')).reactive({ name: 'テストサーバー' }) }));
vi.mock('@/i.js', () => ({ $i: { id: 'owner', username: 'owner', name: '自分の名前' } }));
vi.mock('@/i18n.js', async () => {
	const { load } = await import('js-yaml');
	const words = load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as { _hata: { _hatask: { _ranking: Record<string, string> } } };
	const phrases = Object.fromEntries(Object.entries(words._hata._hatask._ranking).map(([key, value]) => [key, (args: Record<string, string>) => value.replace(/\{(\w+)\}/g, (_, name: string) => args[name])]));
	return { i18n: { ts: words, tsx: { _hata: { _hatask: { _ranking: phrases } } } } };
});
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: { props: ['user'], setup: (props: { user: { id: string } }) => () => h('span', { 'data-avatar': props.user.id }) } }));
vi.mock('@/components/global/MkUserName.vue', () => ({ default: { props: ['user'], setup: (props: { user: { name: string } }) => () => h('span', { 'data-user-name': '' }, props.user.name) } }));
vi.mock('@/components/global/MkA.vue', () => ({ default: { props: ['to'], setup: (props: { to: string }, context: { slots: { default?: () => unknown } }) => () => h('a', { href: props.to }, context.slots.default?.() as never) } }));

const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];
const metrics = ['flower', 'utage', 'block', 'login'] as const;

function ranking(options: { period?: 'month' | 'week' | 'day'; metric?: typeof metrics[number]; page?: number; limit?: number } = {}) {
	return {
		period: options.period ?? 'month', from: '2026-09-01', to: '2026-09-09',
		generatedAt: '2026-09-09T12:15:00Z', nextUpdateAt: '2026-09-09T13:00:00Z', previousGeneratedAt: null,
		participating: true, latestAchievement: null as { name: string; unlockedAt: number } | null,
		boards: (options.metric ? [options.metric] : metrics).map(metric => ({
			metric, total: 21, totalPages: Math.ceil(21 / (options.limit ?? 5)), page: options.page ?? 1,
			self: { value: 3, rank: 2, eligible: true, delta: null },
			items: [{ rank: 1, value: 6, delta: null, user: { id: 'other', username: 'other', name: '実データの名前 :custom:' } }],
		})),
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-09T12:15:00Z'));
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	instance.name = 'テストサーバー';
	mocks.api.mockReset();
	mocks.api.mockImplementation(async (endpoint: string, params: Parameters<typeof ranking>[0]) => {
		if (endpoint === 'hatask/ranking/list') return ranking(params);
		if (endpoint === 'i/registry/get') throw Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
		return {};
	});
});
afterEach(() => {
	for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

async function flush(): Promise<void> { for (let i = 0; i < 8; i++) await nextTick(); }

function mount(options: { theme?: string; mode?: 'light' | 'dark'; showAchievementNotice?: boolean } = {}) {
	const props = reactive({ theme: 'akatsuki', mode: 'light' as 'light' | 'dark', showAchievementNotice: true, ...options });
	const app = createApp({ setup: () => () => h(HataskRanking, props) });
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { app, container, props };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
	const result = [...container.querySelectorAll('button')].find(item => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
	if (!result) throw new Error(`Button not found: ${label}`);
	return result;
}

function deferred<T>() {
	let resolvePromise!: (value: T) => void;
	const promise = new Promise<T>(complete => { resolvePromise = complete; });
	return { promise, resolve: resolvePromise };
}

describe('Hatask ranking view', () => {
	test.each(['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'].flatMap(theme => ['light', 'dark'].map(mode => ({ theme, mode: mode as 'light' | 'dark' }))))('$theme / $mode renders four boards with real user components and dynamic server name', async props => {
		const { container } = mount(props);
		await flush();
		expect(container.querySelector('[data-hatask-ranking]')?.getAttribute('data-theme')).toBe(props.theme);
		expect(container.querySelector('[data-hatask-ranking]')?.getAttribute('data-mode')).toBe(props.mode);
		expect(container.querySelectorAll('article')).toHaveLength(4);
		expect(container.querySelectorAll('[data-avatar="other"]')).toHaveLength(4);
		expect(container.querySelector('[data-ranking-server]')?.textContent).toBe('テストサーバー');
		expect(container.querySelector('article [data-user-name]')?.textContent).toBe('実データの名前 :custom:');
		expect(container.querySelector('article a')?.getAttribute('href')).toBe('/@other');
		instance.name = '<img src=x onerror=alert(1)> 新しい名前';
		await nextTick();
		expect(container.querySelector('[data-ranking-server]')?.textContent).toBe(instance.name);
		expect(container.querySelector('[data-ranking-server]')?.children).toHaveLength(0);
	});
	test('an old request cannot overwrite the selected period', async () => {
		const old = deferred<ReturnType<typeof ranking>>();
		mocks.api.mockImplementation(async (endpoint, params) => endpoint === 'hatask/ranking/list' ? (params.period === 'month' ? old.promise : ranking(params)) : 0);
		const { container } = mount();
		button(container, '今日').click();
		await flush();
		expect(button(container, '今日').getAttribute('aria-pressed')).toBe('true');
		expect(container.querySelector('article')?.textContent).toContain('今日');
		old.resolve(ranking({ period: 'month' }));
		await flush();
		expect(container.querySelector('article')?.textContent).toContain('今日');
		expect(vi.getTimerCount()).toBe(1);
	});
	test('failed loading clears stale rankings and offers a working retry', async () => {
		const { container } = mount();
		await flush();
		expect(container.querySelectorAll('article')).toHaveLength(4);
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		button(container, '今週').click();
		await flush();
		expect(container.querySelectorAll('article')).toHaveLength(0);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('ランキングを読み込めませんでした');
		button(container, '再試行').click();
		await flush();
		expect(container.querySelectorAll('article')).toHaveLength(4);
	});
	test('participation updates are serialized, confirmed by the API, and recover from failure', async () => {
		const { container } = mount();
		await flush();
		mocks.api.mockRejectedValueOnce(new Error('write failed'));
		button(container, 'ランキングに参加中').click();
		await flush();
		expect(button(container, 'ランキングに参加中').getAttribute('aria-pressed')).toBe('true');
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('参加設定を保存できませんでした');
		const saving = deferred<unknown>();
		mocks.api.mockImplementation(async endpoint => {
			if (endpoint === 'hatask/ranking/participation') return saving.promise;
			return { ...ranking(), participating: false };
		});
		button(container, 'ランキングに参加中').click();
		await flush();
		expect(button(container, 'ランキングに参加中').disabled).toBe(true);
		button(container, 'ランキングに参加中').click();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'hatask/ranking/participation')).toHaveLength(2);
		saving.resolve({ participating: false });
		await flush();
		expect(button(container, 'ランキングに不参加中').getAttribute('aria-pressed')).toBe('false');
		expect(mocks.api).toHaveBeenCalledWith('hatask/ranking/participation', { participating: false });
	});
	test('all-view requests only its metric, pages by 20 and returns to all four boards', async () => {
		const { container } = mount();
		await flush();
		button(container, 'すべて見る').click();
		await flush();
		expect(mocks.api).toHaveBeenLastCalledWith('hatask/ranking/list', { period: 'month', metric: 'flower', page: 1, limit: 20 });
		expect(container.querySelectorAll('article')).toHaveLength(1);
		expect(window.document.activeElement).toBe(container.querySelector('h2'));
		button(container, '次のページ').click();
		await flush();
		expect(mocks.api).toHaveBeenLastCalledWith('hatask/ranking/list', { period: 'month', metric: 'flower', page: 2, limit: 20 });
		expect(button(container, '次のページ').disabled).toBe(true);
		button(container, 'ランキング一覧に戻る').click();
		await flush();
		expect(container.querySelectorAll('article')).toHaveLength(4);
	});
	test('the hourly refresh pauses while hidden, resumes on return, and is removed on unmount', async () => {
		const { container, app } = mount();
		await flush();
		await vi.advanceTimersByTimeAsync(45 * 60000 + 250);
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'hatask/ranking/list')).toHaveLength(2);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(vi.getTimerCount()).toBe(0);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		await flush();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'hatask/ranking/list')).toHaveLength(3);
		const remove = vi.spyOn(window.document, 'removeEventListener');
		app.unmount();
		mounted.splice(mounted.findIndex(item => item.app === app), 1);
		container.remove();
		expect(vi.getTimerCount()).toBe(0);
		expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
	});
	test('existing Utage achievement copy is dismissible only after its saved state was read', async () => {
		const response = { ...ranking(), latestAchievement: { name: 'utageSuccess10', unlockedAt: 100 } };
		mocks.api.mockImplementation(async endpoint => endpoint === 'hatask/ranking/list' ? response : 0);
		const { container, props } = mount();
		await flush();
		expect(container.textContent).toContain('いい感じ');
		expect(container.textContent).not.toContain('阻止数で3位');
		props.showAchievementNotice = false;
		await nextTick();
		expect(container.textContent).not.toContain('いい感じ');
		props.showAchievementNotice = true;
		await nextTick();
		mocks.api.mockRejectedValueOnce(new Error('write failed'));
		button(container, 'お知らせを閉じる').click();
		await flush();
		expect(container.textContent).toContain('いい感じ');
		button(container, 'お知らせを閉じる').click();
		await flush();
		expect(container.textContent).not.toContain('いい感じ');
		expect(mocks.api).toHaveBeenLastCalledWith('i/registry/set', { scope: ['client', 'hatask'], key: 'rankingAchievementDismissedAt', value: 100 });
	});
	test('a failed registry read never exposes a dismiss action or overwrites saved data', async () => {
		mocks.api.mockImplementation(async endpoint => {
			if (endpoint === 'hatask/ranking/list') return { ...ranking(), latestAchievement: { name: 'utageSuccess10', unlockedAt: 100 } };
			throw new Error('registry unavailable');
		});
		const { container } = mount();
		await flush();
		expect(container.querySelectorAll('article')).toHaveLength(4);
		expect(container.textContent).not.toContain('いい感じ');
		expect(mocks.api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/set')).toBe(false);
	});
	test('SCSS emits every template class, global Tabler icons, avatar sizing and all five themes', async () => {
		const filename = resolve(process.cwd(), 'src/components/hatask/hatask-ranking.scss');
		const source = readFileSync(filename, 'utf8');
		const compiled = await compileStyleAsync({ filename, source, id: 'ranking', modules: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const template = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskRanking.vue'), 'utf8').split('<script')[0];
		for (const [, name] of template.matchAll(/\$style\.(\w+)/g)) expect(compiled.modules?.[name], name).toBeTruthy();
		expect(compiled.code).toContain(`.${compiled.modules?.av}`);
		expect(compiled.code).toMatch(/width: 34px/);
		expect(compiled.code).toContain(' .ti');
		expect(compiled.modules).not.toHaveProperty('ti');
		expect(compiled.code).toContain('[data-theme]');
		const skins = readFileSync(resolve(process.cwd(), 'src/components/hatask/hatask-themes.scss'), 'utf8');
		for (const theme of ['koke', 'kisetsu', 'kashin', 'suri', 'hatakyu']) expect(skins).toContain(`[data-hatask-ranking][data-theme='${theme}']`);
		expect(compiled.code).toContain('@container hatask-ranking');
		expect(compiled.code).toContain('prefers-reduced-motion');
	});
});
