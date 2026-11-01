/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskSettings from './HataskSettings.vue';
import type { App } from 'vue';

vi.mock('@/i18n.js', async () => {
	const { readFileSync: readLocaleFile } = await import('node:fs');
	const { resolve: resolveLocalePath } = await import('node:path');
	const { load } = await import('js-yaml');
	const locale = load(readLocaleFile(resolveLocalePath(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as { _hata: { _hatask: Record<string, Record<string, string>> } };
	const format = (strings: Record<string, string>) => new Proxy({}, { get: (_target, key) => (params: Record<string, string>) => strings[String(key)].replace(/\{(\w+)\}/gu, (_match, name: string) => params[name]) });
	return { i18n: { ts: locale, tsx: { _hata: { _hatask: { _settings: format(locale._hata._hatask._settings), _planner: format(locale._hata._hatask._planner), _records: format(locale._hata._hatask._records) } } } } };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/router.js', async () => {
	const { ref } = await import('vue');
	return { useRouter: () => ({ push: vi.fn(), currentRoute: ref({ path: '/hatask' }) }) };
});
vi.mock('@/os.js', () => ({ toast: vi.fn() }));
vi.mock('@/components/MkModalWindow.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ props: { panelClass: String, panelTheme: String, panelMode: String }, setup: (props, { slots, expose }) => { expose({ close: vi.fn() }); return () => render('div', { 'data-test-window': 'modal', 'data-panel-theme': props.panelTheme, 'data-panel-mode': props.panelMode, class: props.panelClass }, slots.default?.()); } }) };
});
vi.mock('@/components/SettingsEmbeddedWindow.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ props: { panelClass: String, panelTheme: String, panelMode: String }, setup: (props, { slots, expose }) => { expose({ close: vi.fn() }); return () => render('div', { 'data-test-window': 'embedded', 'data-panel-theme': props.panelTheme, 'data-panel-mode': props.panelMode, class: props.panelClass }, slots.default?.()); } }) };
});
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: (_props, { slots }) => () => render('button', slots.default?.()) }) };
});

import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const copy = i18n.ts._hata._hatask._settings;
const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];
let readSettings: () => Promise<unknown>;
let writeSettings: (value: unknown) => Promise<unknown>;

async function flush(): Promise<void> { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function textButton(container: HTMLElement, text: string): HTMLButtonElement {
	const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text);
	if (!button) throw new Error(`Missing button: ${text}`);
	return button;
}

function themeButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
	if (!button) throw new Error(`Missing theme: ${name}`);
	return button;
}

async function mountSettings(embedded = true, initialSection?: string) {
	const changed = vi.fn();
	const container = window.document.createElement('div'); window.document.body.append(container);
	const app = createApp({ render: () => h(HataskSettings, { embedded, initialSection, onChanged: changed }) });
	app.mount(container); mounted.push({ app, container });
	await flush();
	return { container, changed };
}

async function openThemes(container: HTMLElement): Promise<void> { expect(container.querySelector('[data-theme-carousel]')).not.toBeNull(); await flush(); }

function writes() { return vi.mocked(misskeyApi).mock.calls.filter(([endpoint]) => endpoint === 'i/registry/set'); }

beforeEach(() => {
	vi.clearAllMocks();
	readSettings = async () => { throw Object.assign(new Error('Settings do not exist'), { code: 'NO_SUCH_KEY' }); };
	writeSettings = async () => undefined;
	vi.mocked(misskeyApi).mockImplementation((async (endpoint: string, params: Record<string, unknown>) => {
		if (endpoint === 'i/registry/get') return readSettings();
		if (endpoint === 'i/registry/set') return writeSettings(params.value);
		if (endpoint === 'hatask/planner/get') throw new Error('Planner backup is unavailable in this test');
		throw new Error(`Unexpected endpoint: ${endpoint}`);
	}) as typeof misskeyApi);
});
afterEach(() => { for (const { app, container } of mounted.splice(0)) { app.unmount(); container.remove(); } });

describe('Hatask theme settings and persistence safety', () => {
	test.each([
		{ month: 8, recommended: false }, { month: 9, recommended: true }, { month: 10, recommended: false },
	])('ハロウィンは月=$monthでも選択を維持し、おすすめ表示は10月だけにする', async ({ month, recommended }) => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, month, 15, 12));
		try {
			const saved = { theme: 'halloween', autoTheme: false, darkMode: true, custom: { keep: 'data' } };
			readSettings = async () => saved;
			const { container, changed } = await mountSettings();
			expect(themeButton(container, 'ハロウィン').getAttribute('aria-pressed')).toBe('true');
			expect(container.querySelector('[data-theme-description="halloween"]')?.textContent?.includes('10月のおすすめ')).toBe(recommended);
			expect(container.querySelector('.htk-theme-preview[data-theme="halloween"]')?.getAttribute('data-mode')).toBe('dark');
			expect(writes()).toHaveLength(0);
			expect(changed).not.toHaveBeenCalled();
			expect(saved).toEqual({ theme: 'halloween', autoTheme: false, darkMode: true, custom: { keep: 'data' } });
		} finally { vi.useRealTimers(); }
	});

	test('shows the theme and all settings together and updates the modal palette with the saved theme', async () => {
		readSettings = async () => ({ theme: 'koke', autoTheme: false, darkMode: true });
		const { container } = await mountSettings(false, 'appearance');
		const panel = container.querySelector('[data-test-window="modal"]');
		expect(panel?.getAttribute('data-panel-theme')).toBe('koke');
		expect(panel?.getAttribute('data-panel-mode')).toBe('dark');
		expect(panel?.className).toMatch(/settingsWindow/u);
		expect(container.querySelector('[data-hatagoes-setting="theme"]')).not.toBeNull();
		expect(container.querySelector('[data-hatagoes-setting="appearance"]')).not.toBeNull();
		expect(container.querySelector('[data-hatagoes-setting="navigation"]')).toBeNull();
		themeButton(container, copy.themeSuri).click(); await flush();
		expect(panel?.getAttribute('data-panel-theme')).toBe('suri');
		expect(panel?.getAttribute('data-panel-mode')).toBe('dark');
	});
	test('keeps the embedded heading in the same reactive palette as the settings body', async () => {
		readSettings = async () => ({ theme: 'koke', autoTheme: false, darkMode: true });
		const { container } = await mountSettings(true);
		const panel = container.querySelector('[data-test-window="embedded"]');
		expect(panel?.className).toMatch(/settingsPalette/u);
		expect(panel?.getAttribute('data-panel-theme')).toBe('koke');
		expect(panel?.getAttribute('data-panel-mode')).toBe('dark');
		themeButton(container, copy.themeSuri).click(); await flush();
		expect(panel?.getAttribute('data-panel-theme')).toBe('suri');
	});
	test('only a missing settings key selects the new default without writing it', async () => {
		const { container, changed } = await mountSettings();
		expect(container.querySelector('[data-akatsuki-navigation]')).toBeNull();
		await openThemes(container);
		const names = [copy.themeAkatsuki, copy.themeKoke, copy.themeKisetsu, copy.themeKashin, copy.themeSuri, copy.themeHatakyu, 'ハロウィン'];
		expect(names.map(name => themeButton(container, name).getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false']);
		expect(writes()).toHaveLength(0);
		expect(changed).not.toHaveBeenCalled();
	});
	test('保存済みの起動時表示が有効でも設定欄を出さない', async () => {
		readSettings = async () => ({ openOnStart: true });
		const { container, changed } = await mountSettings();
		expect(container.querySelector('[data-hatagoes-setting="startup"]')).toBeNull();
		expect(container.querySelector('[role="switch"][aria-label="アプリ起動時にHataskを表示"]')).toBeNull();
		expect(writes()).toHaveLength(0);
		expect(changed).not.toHaveBeenCalled();
	});

	test.each([
		['koke', copy.themeKoke],
		['kisetsu', copy.themeKisetsu], ['kashin', copy.themeKashin], ['suri', copy.themeSuri], ['hatakyu', copy.themeHatakyu],
		['halloween', 'ハロウィン'],
	])('keeps the saved %s selection and unrelated settings', async (theme, name) => {
		const saved = { theme, darkMode: true, autoTheme: false, weekStart: 'sun', custom: { keep: 'data' } };
		readSettings = async () => saved;
		const { container, changed } = await mountSettings();
		await openThemes(container);
		expect(themeButton(container, name).getAttribute('aria-pressed')).toBe('true');
		expect(writes()).toHaveLength(0);
		themeButton(container, copy.themeAkatsuki).click(); await flush();
		expect(writes()).toHaveLength(1);
		expect(writes()[0][1]).toMatchObject({ key: 'settings', scope: ['client', 'hatask'], value: { ...saved, theme: 'akatsuki' } });
		expect(changed).toHaveBeenCalledWith(expect.objectContaining({ ...saved, theme: 'akatsuki' }));
	});

	test.each([false, true])('苔を選ぶと保存され、再表示でも選択と明暗=%sを維持する', async darkMode => {
		const saved = { theme: 'akatsuki', darkMode, autoTheme: false, weekStart: 'sun', custom: { keep: 'data' } };
		let stored: unknown = saved;
		readSettings = async () => stored;
		writeSettings = async value => { stored = value; };
		const first = await mountSettings(); await openThemes(first.container);
		themeButton(first.container, copy.themeKoke).click(); await flush();
		expect(writes()).toHaveLength(1);
		expect(stored).toMatchObject({ ...saved, theme: 'koke' });
		expect(first.changed).toHaveBeenCalledWith(expect.objectContaining({ ...saved, theme: 'koke' }));
		const reopened = await mountSettings(); await openThemes(reopened.container);
		expect(themeButton(reopened.container, copy.themeKoke).getAttribute('aria-pressed')).toBe('true');
		expect(reopened.container.querySelector('.htk-theme-preview[data-theme="koke"]')?.getAttribute('data-mode')).toBe(darkMode ? 'dark' : 'light');
		expect(writes()).toHaveLength(1);
	});

	test.each([{ value: null }, { value: [] }, { value: 'invalid' }])('does not enable or overwrite malformed settings: $value', async ({ value }) => {
		readSettings = async () => value;
		const { container, changed } = await mountSettings();
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.ts._hata._hatask._planner.readFailure);
		expect(container.querySelector('[data-akatsuki-navigation]')).toBeNull();
		expect(container.querySelectorAll('select, [role="switch"]')).toHaveLength(0);
		expect(writes()).toHaveLength(0);
		expect(changed).not.toHaveBeenCalled();
	});

	test('a read failure stays locked until an explicit successful retry', async () => {
		readSettings = async () => { throw Object.assign(new Error('Settings could not be loaded'), { code: 'INTERNAL_ERROR' }); };
		const { container } = await mountSettings();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(container.querySelector('[data-akatsuki-navigation]')).toBeNull();
		expect(writes()).toHaveLength(0);
		readSettings = async () => ({ theme: 'suri' });
		textButton(container, i18n.ts._hata._hatask._planner.retry).click(); await flush();
		await openThemes(container);
		expect(themeButton(container, copy.themeSuri).getAttribute('aria-pressed')).toBe('true');
		expect(writes()).toHaveLength(0);
	});

	test('pending and failed writes never emit an unsaved theme or accept concurrent writes', async () => {
		readSettings = async () => ({ theme: 'kashin', autoTheme: false });
		let rejectSave: (error: Error) => void = () => { throw new Error('Save did not start'); };
		writeSettings = () => new Promise((_resolve, reject) => { rejectSave = reject; });
		const { container, changed } = await mountSettings(); await openThemes(container);
		themeButton(container, copy.themeAkatsuki).click(); await flush();
		expect(writes()).toHaveLength(1); // Positive control: the API write actually began.
		expect(changed).not.toHaveBeenCalled();
		expect(themeButton(container, copy.themeKashin).getAttribute('aria-pressed')).toBe('true');
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="switch"], button[aria-pressed]')].every(button => button.disabled)).toBe(true);
		themeButton(container, copy.themeSuri).click(); await flush();
		expect(writes()).toHaveLength(1);
		rejectSave(new Error('Offline')); await flush();
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(copy.saveFailure);
		expect(changed).not.toHaveBeenCalled();
		expect(themeButton(container, copy.themeKashin).getAttribute('aria-pressed')).toBe('true');
		writeSettings = async () => undefined;
		themeButton(container, copy.themeAkatsuki).click(); await flush();
		expect(writes()).toHaveLength(2);
		expect(changed).toHaveBeenCalledTimes(1);
		expect(themeButton(container, copy.themeAkatsuki).getAttribute('aria-pressed')).toBe('true');
	});
});

describe('暁の自動配色案内と手動設定の保存', () => {
	const appThemeLabel = '自動（本体のテーマに従う）';
	const osThemeLabel = '自動（端末の設定に従う）';

	function appearanceSwitch(container: HTMLElement, label: string): HTMLButtonElement {
		const button = container.querySelector<HTMLButtonElement>(`button[role="switch"][aria-label="${label}"]`);
		if (!button) throw new Error(`Missing appearance switch: ${label}`);
		return button;
	}

	function assertAppearanceLabel(container: HTMLElement, label: string): HTMLButtonElement {
		const button = appearanceSwitch(container, label);
		expect(button.parentElement?.querySelector('span')?.textContent).toBe(label);
		return button;
	}

	test('本体用と端末用の文言を分け、表示文字とaria-labelの不一致も検出する', () => {
		expect(copy.autoAppearanceTheme).toBe(appThemeLabel);
		expect(copy.autoAppearance).toBe(osThemeLabel);
		const control = window.document.createElement('div');
		control.innerHTML = `<div><span>${osThemeLabel}</span><button role="switch" aria-label="${appThemeLabel}"></button></div>`;
		expect(() => assertAppearanceLabel(control, appThemeLabel)).toThrow();
		expect(() => appearanceSwitch(control, 'missing-positive-control')).toThrow('Missing appearance switch:');
	});

	test.each([
		{ theme: 'akatsuki', label: appThemeLabel }, { theme: undefined, label: appThemeLabel },
		{ theme: 'koke', label: appThemeLabel },
		{ theme: 'kisetsu', label: osThemeLabel }, { theme: 'kashin', label: osThemeLabel },
		{ theme: 'suri', label: osThemeLabel }, { theme: 'hatakyu', label: osThemeLabel }, { theme: 'halloween', label: appThemeLabel },
	])('$themeでは正しい自動配色名を表示し、autoとmanualの保存でもほかの設定を保つ', async ({ theme, label }) => {
		const saved = {
			theme, autoTheme: true, darkMode: false, weekStart: 'sun', animations: false,
			akatsukiMobileTabs: ['home', 'cal', 'todo', 'hataskapps'], custom: { keep: 'data' },
		};
		readSettings = async () => saved;
		const { container, changed } = await mountSettings();
		await openThemes(container);
		const automatic = assertAppearanceLabel(container, label);
		expect(automatic.getAttribute('aria-checked')).toBe('true');
		expect(container.querySelector(`[role="switch"][aria-label="${label === appThemeLabel ? osThemeLabel : appThemeLabel}"]`)).toBeNull();
		expect(container.querySelector(`[role="switch"][aria-label="${copy.darkMode}"]`)).toBeNull();
		automatic.click(); await flush();
		expect(writes()).toHaveLength(1);
		expect(writes()[0][1]).toMatchObject({ key: 'settings', scope: ['client', 'hatask'], value: { ...saved, autoTheme: false } });
		expect(assertAppearanceLabel(container, label).getAttribute('aria-checked')).toBe('false');
		const manual = appearanceSwitch(container, copy.darkMode);
		expect(manual.getAttribute('aria-checked')).toBe('false');
		manual.click(); await flush();
		expect(writes()).toHaveLength(2);
		expect(writes()[1][1]).toMatchObject({ key: 'settings', scope: ['client', 'hatask'], value: { ...saved, autoTheme: false, darkMode: true } });
		expect(appearanceSwitch(container, copy.darkMode).getAttribute('aria-checked')).toBe('true');
		assertAppearanceLabel(container, label).click(); await flush();
		expect(writes()).toHaveLength(3);
		expect(writes()[2][1]).toMatchObject({ key: 'settings', scope: ['client', 'hatask'], value: { ...saved, autoTheme: true, darkMode: true } });
		expect(changed).toHaveBeenCalledTimes(3);
		expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ ...saved, autoTheme: true, darkMode: true }));
		expect(container.querySelector(`[role="switch"][aria-label="${copy.darkMode}"]`)).toBeNull();
		expect(saved.autoTheme).toBe(true);
		expect(saved.darkMode).toBe(false);
	});

	test('暁と旧テーマを選び直すと自動配色の表示とariaが一緒に変わり、配色設定は勝手に切り替えない', async () => {
		const saved = { theme: 'hatakyu', autoTheme: true, darkMode: true, custom: { keep: 'value' } };
		readSettings = async () => saved;
		const { container, changed } = await mountSettings();
		await openThemes(container);
		expect(assertAppearanceLabel(container, osThemeLabel).getAttribute('aria-checked')).toBe('true');
		themeButton(container, copy.themeAkatsuki).click(); await flush();
		expect(assertAppearanceLabel(container, appThemeLabel).getAttribute('aria-checked')).toBe('true');
		expect(writes()[0][1]).toMatchObject({ value: { ...saved, theme: 'akatsuki' } });
		themeButton(container, copy.themeKashin).click(); await flush();
		expect(assertAppearanceLabel(container, osThemeLabel).getAttribute('aria-checked')).toBe('true');
		expect(writes()).toHaveLength(2);
		expect(writes()[1][1]).toMatchObject({ value: { ...saved, theme: 'kashin' } });
		expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ ...saved, theme: 'kashin' }));
	});
});

describe('テーマ選択カルーセルの内容高と説明文', () => {
	test('暁の日本語説明は指定箇所だけで改行し、翻訳の元の値や通常設定の説明は変えない', async () => {
		const description = copy.themeAkatsukiDescription;
		const { container } = await mountSettings();
		expect(container.textContent?.replace(/\s+/gu, '')).toContain(description);
		await openThemes(container);
		expect(container.querySelector('[data-theme-description="akatsuki"]')?.textContent).toBe('朝焼けのグラデーションと、\n軽やかな3ペイン');
		expect(container.querySelector('[data-theme-description="kashin"]')?.textContent).toBe(copy.themeKashinDescription);
		expect(copy.themeAkatsukiDescription).toBe(description);
		expect(writes()).toHaveLength(0);
	});

	test('暁の説明が別言語なら句読点で機械的に分割せず、長い翻訳も全文を描画する', async () => {
		const description = copy.themeAkatsukiDescription;
		const translated = 'A sunrise gradient, with a light three-pane layout and a longer translated explanation';
		try {
			copy.themeAkatsukiDescription = translated;
			const { container } = await mountSettings(); await openThemes(container);
			expect(container.querySelector('[data-theme-description="akatsuki"]')?.textContent).toBe(translated);
			expect(container.querySelector('[data-theme-description="akatsuki"] br')).toBeNull();
			expect(writes()).toHaveLength(0);
		} finally {
			copy.themeAkatsukiDescription = description;
		}
	});

	test('高さ固定や絶対配置ではなく、重ねたカードの自然高と選択枠・フォーカス枠の余白を確保する', () => {
		// Source contract: Happy DOM cannot establish real font metrics or clipping.
		const filename = resolvePath(process.cwd(), 'src/pages/HataskSettings.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const stylesheet = parsed.descriptor.styles[0].content;
		const viewportRules = [...stylesheet.matchAll(/\.carViewport\s*\{([^}]+)\}/gu)].map(match => match[1]);
		const cardRules = [...stylesheet.matchAll(/\.themeCard\s*\{([^}]+)\}/gu)].map(match => match[1]);
		expect(viewportRules.length).toBeGreaterThan(0);
		expect(cardRules.length).toBeGreaterThan(0);
		expect(viewportRules[0]).toContain('display:grid');
		expect(viewportRules[0]).toContain('grid-template-columns:minmax(0,1fr)');
		expect(viewportRules[0]).toContain('padding:8px');
		expect(viewportRules[0]).toContain('overflow:hidden');
		expect(cardRules[0]).toContain('grid-area:1 / 1');
		expect(cardRules[0]).toContain('box-sizing:border-box');
		for (const rule of viewportRules) expect(rule).not.toMatch(/(?:^|;)\s*(?:min-|max-)?height\s*:/u);
		for (const rule of cardRules) expect(rule).not.toMatch(/position\s*:\s*absolute/u);
		expect(stylesheet).toMatch(/\.themeJp\s*\{[^}]*white-space:pre-line;[^}]*overflow-wrap:anywhere/u);
		expect(stylesheet).toContain('outline:3px solid var(--MI_THEME-accent); outline-offset:2px');
		expect(stylesheet).toContain('@media (prefers-reduced-motion:reduce)');
	});

	test('自然高への変更後も矢印・ドット・スワイプで同じテーマを選択し、中央と隣接カードの変換を保つ', async () => {
		const { container, changed } = await mountSettings(); await openThemes(container);
		const card = (id: string): HTMLButtonElement => {
			const element = container.querySelector<HTMLButtonElement>(`[data-theme-card="${id}"]`);
			if (!element) throw new Error(`Missing theme card: ${id}`);
			return element;
		};
		expect(card('akatsuki').style.transform).toBe('translateX(0%) scale(1)');
		expect(card('koke').style.transform).toBe('translateX(76%) scale(0.8)');
		expect(card('hatakyu').tabIndex).toBe(-1);
		expect(card('hatakyu').style.pointerEvents).toBe('none');
		container.querySelector<HTMLButtonElement>(`[aria-label="${copy.nextTheme}"]`)?.click(); await flush();
		expect(card('koke').getAttribute('aria-pressed')).toBe('true');
		expect(card('akatsuki').style.transform).toBe('translateX(-76%) scale(0.8)');
		themeButton(container, copy.themeKashin).click(); await flush();
		expect(card('kashin').style.transform).toBe('translateX(0%) scale(1)');
		const viewport = container.querySelector('[data-theme-carousel]');
		if (!viewport) throw new Error('Missing carousel viewport');
		const start = new Event('touchstart'); Object.defineProperty(start, 'changedTouches', { value: [{ clientX: 100 }] });
		const end = new Event('touchend'); Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 20 }] });
		viewport.dispatchEvent(start); viewport.dispatchEvent(end); await flush();
		expect(card('suri').getAttribute('aria-pressed')).toBe('true');
		expect(card('suri').style.transform).toBe('translateX(0%) scale(1)');
		expect(writes().map(([, params]) => (params as { value: { theme: string } }).value.theme)).toEqual(['koke', 'kashin', 'suri']);
		expect(changed).toHaveBeenCalledTimes(3);
	});
});

describe('削除したスマホ下部タブ設定', () => {
	test.each([true, false])('embedded=%sで旧設定値があっても欄を表示せず、自動保存しない', async embedded => {
		const saved = {
			theme: 'akatsuki', akatsukiMobileTabs: ['apps', 'hataskapps', 'home', 'cal'],
			akatsukiShortcut: 'meal', custom: { keep: 'data' },
		};
		readSettings = async () => saved;
		const { container, changed } = await mountSettings(embedded);
		expect(container.querySelector('[data-test-window]')?.getAttribute('data-test-window')).toBe(embedded ? 'embedded' : 'modal');
		expect(container.querySelector('[data-hatagoes-setting="theme"]')).not.toBeNull();
		expect(container.querySelector('[data-hatagoes-setting="calendar"]')).not.toBeNull();
		expect(container.querySelector('[data-hatagoes-setting="navigation"], [data-akatsuki-navigation], [data-ak-slot], [data-ak-menu]')).toBeNull();
		expect(container.textContent).not.toContain('スマホの下部タブ');
		expect(writes()).toHaveLength(0);
		expect(changed).not.toHaveBeenCalled();
		// Reading a legacy setting must not mutate the object returned by the API.
		expect(saved.akatsukiMobileTabs).toEqual(['apps', 'hataskapps', 'home', 'cal']);
	});

	test('別の設定を保存しても旧ナビ値を保つ', async () => {
		const saved = {
			theme: 'akatsuki', akatsukiMobileTabs: ['apps', 'hataskapps', 'home', 'cal'],
			akatsukiShortcut: 'meal', custom: { keep: 'data' },
		};
		readSettings = async () => saved;
		const { container, changed } = await mountSettings();
		themeButton(container, copy.themeSuri).click(); await flush();
		expect(writes()).toHaveLength(1);
		expect(writes()[0][1]).toMatchObject({ key: 'settings', scope: ['client', 'hatask'], value: { ...saved, theme: 'suri' } });
		expect(changed).toHaveBeenCalledWith(expect.objectContaining({ ...saved, theme: 'suri' }));
		expect(container.querySelector('[data-akatsuki-navigation]')).toBeNull();
	});
});
