/*
 * SPDX-FileCopyrightText: syuilo and misskey-project & Hata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileScript, compileStyleAsync, parse } from '@vue/compiler-sfc';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import type { App } from 'vue';
import MkLoginBonusDialog from '@/components/MkLoginBonusDialog.vue';
import { $i } from '@/i.js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), close: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/i.js', async () => ({ $i: (await import('vue')).reactive({ loggedInDays: 27 }) }));
vi.mock('@/i18n.js', async () => {
	const { load } = await import('js-yaml');
	const { readFile: read } = await import('node:fs/promises');
	const locale = load(await read(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as { ok: string; _hata: { _loginBonus: Record<string, string> } };
	const copy = locale._hata._loginBonus;
	return { i18n: {
		ts: locale,
		tsx: { _hata: { _loginBonus: Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, (params: Record<string, string | number>) => value.replace(/\{(\w+)\}/gu, (_, name: string) => String(params[name]))])) } },
	} };
});
vi.mock('@/components/MkModal.vue', () => ({ default: defineComponent({
	emits: ['click', 'esc', 'closed'],
	setup(_, { slots, emit, expose }) {
		expose({ close: mocks.close });
		return () => h('div', { 'data-modal': '', onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') emit('esc', event); }, onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('click'); } }, slots.default?.());
	},
}) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({
	setup(_, { slots }) { return () => h('button', slots.default?.()); },
}) }));

const componentPath = resolve(process.cwd(), 'src/components/MkLoginBonusDialog.vue');

function layoutViolations(rule: string): string[] {
	return [
		...(rule.match(/margin:\s*auto;/u) ? [] : ['親モーダル内で中央配置されない']),
		...(rule.match(/box-sizing:\s*border-box;/u) ? [] : ['paddingを含めた幅に収まらない']),
		...(rule.match(/width:\s*400px;/u) ? [] : ['承認済みモックの通常幅を維持しない']),
		...(rule.match(/max-width:\s*100%;/u) ? [] : ['親モーダルの余白を越える']),
	];
}

describe('login bonus dialog layout contract', () => {
	test('SFCとSCSSをコンパイルできる', async () => {
		const source = await readFile(componentPath, 'utf8');
		const parsed = parse(source, { filename: componentPath });
		expect(parsed.errors).toEqual([]);
		expect(() => compileScript(parsed.descriptor, { id: 'mk-login-bonus-dialog' })).not.toThrow();

		const style = await compileStyleAsync({
			source: parsed.descriptor.styles[0]!.content,
			filename: componentPath,
			id: 'mk-login-bonus-dialog',
			preprocessLang: 'scss',
		});
		expect(style.errors).toEqual([]);
	});

	test('親モーダル内で中央配置され、親の余白を越えない', async () => {
		const source = await readFile(componentPath, 'utf8');
		const parsed = parse(source, { filename: componentPath });
		const style = await compileStyleAsync({
			source: parsed.descriptor.styles[0]!.content,
			filename: componentPath,
			id: 'mk-login-bonus-dialog',
			preprocessLang: 'scss',
		});
		const rootRule = style.code.match(/\.root\s*\{(?<declarations>[^}]*)\}/u)?.groups?.declarations;

		expect(rootRule).toBeDefined();
		expect(layoutViolations(rootRule!)).toEqual([]);

		// 陽性対照: 中央寄せを外したCSSは検出器が必ず失敗として扱う。
		const withoutCentering = rootRule!.replace(/margin:\s*auto;/u, 'margin: 0;');
		expect(layoutViolations(withoutCentering)).toContain('親モーダル内で中央配置されない');
	});
});

describe('login days dialog behavior', () => {
	let app: App | undefined;
	let host: HTMLDivElement;

	beforeEach(() => {
		mocks.api.mockReset().mockResolvedValue({ rank: 12 });
		mocks.close.mockReset();
		host = window.document.createElement('div');
		window.document.body.append(host);
	});
	afterEach(() => {
		app?.unmount();
		host.remove();
		vi.restoreAllMocks();
	});

	async function mount(days: number) {
		$i!.loggedInDays = days;
		app = createApp(MkLoginBonusDialog);
		app.mount(host);
		await nextTick();
		await nextTick();
		return host.querySelector<HTMLElement>('[role="dialog"]')!;
	}

	test('通常時は通算日数と順位、次の実績への残り日数を表示する', async () => {
		const dialog = await mount(27);
		expect(dialog.textContent).toContain('これまでのログイン');
		expect(dialog.textContent).toContain('27');
		expect(dialog.textContent).toContain('12位');
		expect(dialog.textContent).toContain('あと3日');
		expect(dialog.textContent).toContain('ログイン30日');
		expect(dialog.textContent).not.toContain('新しい実績を獲得');
		expect(dialog.querySelector<HTMLElement>('[aria-hidden="true"] > div')?.style.width).toBe('80%');
		expect(mocks.api).toHaveBeenCalledWith('hata/login-ranking', {});
		expect(dialog.querySelector('h2')?.id).toBe(dialog.getAttribute('aria-labelledby'));
	});

	test('初日は初回メッセージと3日実績までの残りを表示する', async () => {
		const dialog = await mount(1);
		expect(dialog.textContent).toContain('ようこそ！最初のログインです！');
		expect(dialog.textContent).toContain('あと2日');
		expect(dialog.textContent).toContain('ログイン3日');
	});

	test('実績獲得時はお祝いを表示し、次の区間へ進む', async () => {
		const dialog = await mount(30);
		expect(dialog.textContent).toContain('新しい実績を獲得！');
		expect(dialog.textContent).toContain('ログイン30日');
		expect(dialog.textContent).toContain('あと30日');
		expect(dialog.textContent).toContain('ログイン60日');
		expect(dialog.querySelector<HTMLElement>('[aria-hidden="true"] > div')?.style.width).toBe('0%');
	});

	test.each([1000, 1001])('%i日では残り0日を表示せず、全実績の獲得済み表示にする', async days => {
		const dialog = await mount(days);
		expect(dialog.textContent).toContain('すべてのログイン実績を獲得しました');
		expect(dialog.textContent).not.toContain('あと0日');
		expect(dialog.textContent?.includes('新しい実績を獲得！')).toBe(days === 1000);
	});

	test.each(['unavailable', 'zero'])('順位が%sでも日数と次の実績を表示する', async state => {
		if (state === 'unavailable') {
			mocks.api.mockRejectedValue(new Error('offline'));
			vi.spyOn(console, 'warn').mockImplementation(() => {});
		} else {
			mocks.api.mockResolvedValue({ rank: 0 });
		}
		const dialog = await mount(27);
		expect(dialog.textContent).not.toContain('サーバー内');
		expect(dialog.textContent).toContain('あと3日');
	});

	test('日数更新が表示へ反映され、OK・Esc・背景クリックが共通モーダルを閉じる', async () => {
		const dialog = await mount(27);
		$i!.loggedInDays = 30;
		await nextTick();
		expect(dialog.textContent).toContain('新しい実績を獲得！');
		dialog.querySelector('h2')!.click();
		expect(mocks.close).not.toHaveBeenCalled();
		dialog.querySelector('button')!.click();
		host.querySelector('[data-modal]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		host.querySelector<HTMLElement>('[data-modal]')!.click();
		expect(mocks.close).toHaveBeenCalledTimes(3);
	});
});
