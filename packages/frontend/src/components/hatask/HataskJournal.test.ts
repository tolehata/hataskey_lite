/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { App } from 'vue';
import type { HataskPlannerTheme } from './hatask-planner-types.js';
import type { HataskJournalEntry, HataskMealTemplate } from '@/utility/hatask-journal.js';

vi.mock('@/i18n.js', async () => {
	const { readFileSync: readLocaleFile } = await import('node:fs');
	const { resolve: resolveLocalePath } = await import('node:path');
	const { load } = await import('js-yaml');
	const locale = load(readLocaleFile(resolveLocalePath(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as { _hata: { _hatask: Record<string, Record<string, string>> } };
	const format = (strings: Record<string, string>) => new Proxy({}, { get: (_target, key) => (params: Record<string, string>) => strings[String(key)].replace(/\{(\w+)\}/gu, (_match, name: string) => params[name]) });
	return { i18n: { ts: locale, tsx: { _hata: { _hatask: { _journal: format(locale._hata._hatask._journal), _main: format(locale._hata._hatask._main) } } } } };
});
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn(), confirm: vi.fn(async () => ({ canceled: false })), inputText: vi.fn(async () => ({ canceled: false, result: 'いつものお昼' })) }));
vi.mock('@/components/HataskEmoji.vue', async () => {
	const vue = await import('vue');
	return { default: vue.defineComponent({ props: ['emoji'], setup: props => () => vue.h('span', props.emoji) }) };
});

import HataskJournal from './HataskJournal.vue';
import * as os from '@/os.js';
import { changeJournalRows } from '@/utility/hatask-journal.js';

const mounted: Array<{ app: App<Element>; container: HTMLDivElement }> = [];
const mood: HataskJournalEntry = { id: 'mood-1', date: '2026-08-31', time: '08:00', level: 4, note: '朝の散歩', legacy: 'keep' };
const meal: HataskJournalEntry = { id: 'meal-1', date: '2026-08-31', time: '12:00', level: 'ate', slot: 'lunch', note: 'パンとスープ', reasons: [] };

function mountJournal(options: Record<string, unknown> = {}) {
	const journal = ref<InstanceType<typeof HataskJournal> | null>(null);
	const entries = ref<unknown[]>(options.entries as unknown[] | undefined ?? []);
	const templates = ref<unknown[]>(options.templates as unknown[] | undefined ?? []);
	const save = vi.fn(async (entry: HataskJournalEntry, existingId?: string) => { entries.value = changeJournalRows(entries.value, { type: 'save', value: entry, existingId }); });
	const remove = vi.fn(async (id: string) => { entries.value = changeJournalRows(entries.value, { type: 'delete', id }); });
	const storeTemplate = vi.fn(async (template: HataskMealTemplate, existingId?: string) => { templates.value = changeJournalRows(templates.value, { type: 'save', value: template, existingId }); });
	const props = reactive({ kind: 'mood' as const, theme: undefined as HataskPlannerTheme | undefined, writable: true, templatesWritable: true, captureOnly: false, showCaptureHint: true, save, remove, storeTemplate, ...options });
	const app = createApp(defineComponent({ setup: () => () => h(HataskJournal, { ...props, ref: journal, entries: entries.value, templates: templates.value }) }));
	const container = window.document.createElement('div'); window.document.body.append(container); app.mount(container);
	mounted.push({ app, container });
	return { container, save, remove, storeTemplate, entries, templates, journal, props };
}

async function flush(): Promise<void> { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function byLabel(container: HTMLElement, label: string): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
	if (!button) throw new Error(`Missing control: ${label}`);
	return button;
}

function tab(container: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(candidate => candidate.getAttribute('aria-label') === text);
	if (!button) throw new Error(`Missing tab: ${text}`);
	return button;
}

async function inputNote(container: HTMLElement, text: string): Promise<HTMLTextAreaElement> {
	const input = container.querySelector<HTMLTextAreaElement>('textarea');
	if (!input) throw new Error('Missing journal input');
	input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); await flush();
	return input;
}

function recordMenuAction(text: string): () => Promise<void> {
	const menu = vi.mocked(os.popupMenu).mock.calls.at(-1)?.[0] as Array<{ text?: string; action?: () => Promise<void> }>;
	const action = menu.find(item => item.text === text)?.action;
	if (!action) throw new Error(`Missing menu action: ${text}`);
	return action;
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 7, 31, 12, 0)); vi.clearAllMocks(); });
afterEach(() => { for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); } vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Hatask mood and meal journals', () => {
	test.each(['mood', 'meal'])('%sのクイック作成は同じ入力を保ち、分析・履歴と操作説明を表示しない', async kind => {
		const f = mountJournal({ kind, captureOnly: true, showCaptureHint: false, entries: [kind === 'mood' ? mood : meal] });
		const input = await inputNote(f.container, '記録の書きかけ');
		expect(f.container.querySelector('[data-journal-capture]')).not.toBeNull();
		expect(f.container.querySelector('[role="tab"]')).toBeNull();
		expect(f.container.textContent).not.toContain('Ctrl');
		expect(f.container.textContent).not.toContain('Enter');
		f.props.captureOnly = false;
		await flush();
		expect(f.container.querySelector('[role="tab"]')).not.toBeNull();
		expect(f.container.querySelector('textarea')).toBe(input);
		expect(input.value).toBe('記録の書きかけ');
	});
	test.each([
		{ kind: 'mood', title: 'きもち', intro: 'いまのきもちを、ひと息で残そう', info: 'きもち記録について' },
		{ kind: 'meal', title: 'ごはん', intro: 'きょうのごはんを、あなたのペースで', info: 'ごはん記録について' },
	])('$kindの見出しと入力を同じキャプチャ領域に保つ', ({ kind, title, intro, info }) => {
		const f = mountJournal({ kind });
		const captureArea = f.container.querySelector('[data-journal-capture]');
		expect(captureArea?.querySelector('h2')?.textContent).toBe(title);
		expect(captureArea?.textContent).toContain(intro);
		expect(captureArea?.querySelector('textarea')).not.toBeNull();
		expect(captureArea?.querySelector(`button[aria-label="${info}"]`)).not.toBeNull();
	});

	test('PCだけ見出しと入力を横に融合し、狭い幅では従来の縦積みを保つ', () => {
		// Source contract only; Happy DOM does not calculate CSS container queries.
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskJournal.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const stylesheet = parsed.descriptor.styles[0].content;
		expect(stylesheet).toMatch(/\.captureArea \{ display: grid; gap: 20px; min-width: 0; \}/u);
		expect(stylesheet).toMatch(/\.heading \{ display: flex;[^}]*padding: 4px 4px 0; \}/u);
		expect(stylesheet).toMatch(/\.toolbar \{ display: flex;[^}]*justify-content: space-between;[^}]*flex-wrap: wrap;/u);
		expect(stylesheet).toMatch(/\.tabs \{ display: flex;[^}]*overflow-x: auto;[^}]*scrollbar-width: none;/u);
		expect(stylesheet).toMatch(/\.tabs button \{[^}]*padding: 8px 16px;/u);
		const desktopRules = stylesheet.match(/@container \(min-width: 760px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';
		expect(desktopRules).toMatch(/\.captureArea \{ grid-template-columns: minmax\(260px, \.38fr\) minmax\(0, 1fr\);[^}]*background: var\(--surface\);/u);
		expect(desktopRules).toMatch(/\.heading \{ align-self: center;[^}]*border: 0;[^}]*background: var\(--surface\);[^}]*box-shadow: none;/u);
		expect(desktopRules).toMatch(/\.toolbar \{ display: grid; grid-template-columns: minmax\(96px, 1fr\) auto minmax\(96px, 1fr\); \}/u);
		expect(desktopRules).toMatch(/\.tabs \{[^}]*grid-column: 2;[^}]*justify-self: center;[^}]*overflow-x: visible;/u);
		expect(desktopRules).toMatch(/\.tabs button:not\(\[data-selected='true'\]\) span \{ display: none; \}/u);
		const mobileRules = stylesheet.match(/@container \(max-width: 560px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';
		expect(mobileRules).toMatch(/\.tabs \{ width: 100%; \}/u);
		expect(mobileRules).toMatch(/\.tabs button \{ flex: 1 0 auto; padding-inline: 12px; \}/u);
	});

	test('暁の説明カードは親テーマの色・外枠を継承し、見出しに半透明背景を重ねない', () => {
		// Source contract only; Happy DOM does not composite translucent CSS surfaces.
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskJournal.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const stylesheet = parsed.descriptor.styles[0].content;
		const themeRules = stylesheet.match(/\.root\[data-hatask-theme\] \{([^}]+)\}/u)?.[1] ?? '';
		const replacedThemeTokens = /--(?:surface|fg|fg-2|card-radius|card-border|card-shadow)\s*:/u;
		// Positive control: catch a locally fixed surface before checking the real rules.
		expect(replacedThemeTokens.test(`${themeRules}\n--surface: #fff;`)).toBe(true);
		expect(replacedThemeTokens.test(themeRules)).toBe(false);
		const captureRules = stylesheet.match(/\.root\[data-hatask-theme\] \.captureArea \{([^}]+)\}/u)?.[1] ?? '';
		for (const declaration of ['border: var(--card-border)', 'border-radius: var(--card-radius)', 'background: var(--surface)', 'color: var(--fg)', 'box-shadow: var(--card-shadow)']) {
			expect(captureRules).toContain(declaration);
		}
		expect(stylesheet).toMatch(/\.heading \{[^}]*color: var\(--fg\);/u);
		expect(stylesheet).toMatch(/\.heading p, \.reviewHeading p \{[^}]*color: var\(--fg-2\);/u);
		expect(stylesheet).toMatch(/\.root\[data-hatask-theme\] \.heading \{[^}]*background: transparent;/u);
	});

	test.each(['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'])('%sのテーマ識別子を見出し・入力へ渡し、説明と書きかけを保つ', async theme => {
		for (const kind of ['mood', 'meal']) {
			const f = mountJournal({ kind, theme });
			await inputNote(f.container, '残しておく記録');
			const root = f.container.querySelector<HTMLElement>(`section[data-kind="${kind}"]`)!;
			expect(root.getAttribute('data-hatask-theme')).toBe(theme);
			expect(root.querySelector('[data-journal-capture] > header h2')?.textContent).toBe(kind === 'mood' ? 'きもち' : 'ごはん');
			expect(root.querySelector('section[data-hatask-theme]')?.getAttribute('data-hatask-theme')).toBe(theme);
			expect(root.querySelector('textarea')?.value).toBe('残しておく記録');
			expect(f.save).not.toHaveBeenCalled();
		}
	});

	test.each(['mood', 'meal'])('%sのテーマを切り替えても同じ入力と未保存の記録を保つ', async kind => {
		const f = mountJournal({ kind });
		const note = await inputNote(f.container, 'テーマを変えても残すメモ');
		const instance = f.journal.value;
		for (const theme of ['kisetsu', 'kashin', 'suri', 'hatakyu', 'akatsuki'] as const) {
			f.props.theme = theme;
			await flush();
			expect(f.journal.value).toBe(instance);
			expect(f.container.querySelector('textarea')).toBe(note);
			expect(note.value).toBe('テーマを変えても残すメモ');
			expect(f.container.querySelector(`section[data-kind="${kind}"]`)?.getAttribute('data-hatask-theme')).toBe(theme);
			expect(f.save).not.toHaveBeenCalled();
		}
	});

	test.each(['mood', 'meal'])('%sのモバイルタブは全ラベルを保ち、切り替えても名前とアイコンを失わない', async kind => {
		const f = mountJournal({ kind });
		const tabs = [...f.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		expect(tabs.every(button => button.textContent.trim() === button.getAttribute('aria-label'))).toBe(true);
		for (const tabButton of tabs) {
			tabButton.click(); await flush();
			expect(tabButton.textContent.trim()).toBe(tabButton.getAttribute('aria-label'));
			expect(tabButton.getAttribute('aria-selected')).toBe('true');
			expect(tabButton.querySelector('i[aria-hidden="true"]')).not.toBeNull();
		}
	});
	test('きもちにはテンプレートを置かず、メモなしでも選んで記録できる', async () => {
		const f = mountJournal();
		expect(f.container.textContent).not.toContain('テンプレート');
		expect(f.container.querySelectorAll('[role="tab"]')).toHaveLength(3);
		expect(f.container.querySelector('[aria-label="記録する日"]')).not.toBeNull();
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save).toHaveBeenCalledOnce();
		expect(f.save.mock.calls[0][0]).toMatchObject({ date: '2026-08-31', time: '12:00', note: '（ひとことなし）', level: 4 });
	});
	test.each(['mood', 'meal'] as const)('%sの作成完了チェックを表示後に追加アイコンへ戻す', async kind => {
		const f = mountJournal({ kind });
		const submit = byLabel(f.container, '記録する');
		expect(submit.querySelector('i')?.classList.contains('ti-plus')).toBe(true);
		submit.click(); await flush();
		expect(f.save).toHaveBeenCalledOnce();
		expect(submit.querySelector('i')?.classList.contains('ti-check')).toBe(true);
		await vi.advanceTimersByTimeAsync(899); await flush();
		expect(submit.querySelector('i')?.classList.contains('ti-check')).toBe(true);
		await vi.advanceTimersByTimeAsync(1); await flush();
		expect(submit.querySelector('i')?.classList.contains('ti-plus')).toBe(true);
	});
	test('日付・時刻のピルから変更でき、外へフォーカスしても入力が閉じない', async () => {
		const f = mountJournal();
		const note = await inputNote(f.container, '昨日のメモ');
		byLabel(f.container, '記録する日').click(); await flush();
		const date = f.container.querySelector<HTMLInputElement>('input[type="date"]')!;
		date.value = '2026-08-30'; date.dispatchEvent(new Event('change', { bubbles: true })); await flush();
		byLabel(f.container, '記録する時刻').click(); await flush();
		const time = f.container.querySelector<HTMLInputElement>('input[type="time"]')!;
		time.value = '21:15'; time.dispatchEvent(new Event('change', { bubbles: true })); await flush();
		tab(f.container, '履歴').focus(); await flush();
		expect(note.value).toBe('昨日のメモ');
		expect(f.container.querySelector('input[type="time"]')).not.toBeNull();
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save.mock.calls[0][0]).toMatchObject({ date: '2026-08-30', time: '21:15', note: '昨日のメモ' });
	});
	test('保存応答を待つ間は二重送信せず、失敗時に入力を残して再試行できる', async () => {
		let reject!: (reason: Error) => void;
		const save = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
		const f = mountJournal({ save });
		const input = await inputNote(f.container, '消えてはいけないメモ');
		byLabel(f.container, '記録する').click(); await flush();
		expect(input.value).toBe('消えてはいけないメモ');
		expect(byLabel(f.container, '記録する').disabled).toBe(true);
		reject(new Error('offline')); await flush();
		expect(input.value).toBe('消えてはいけないメモ');
		expect(f.container.querySelector('[role="alert"]')?.textContent).toContain('入力内容は残っています');
		expect(byLabel(f.container, '記録する').disabled).toBe(false);
	});
	test('履歴の検索・日付指定・並び替えは記録を変更しない', async () => {
		const f = mountJournal({ entries: [mood, { ...mood, id: 'later', time: '20:00', note: '夜の映画' }] });
		tab(f.container, '履歴').click(); await flush();
		const records = () => Array.from(f.container.querySelectorAll('[data-journal-view="history"] [data-journal-record]')).map(element => element.getAttribute('data-journal-record'));
		expect(records()).toEqual(['later', mood.id]);
		byLabel(f.container, '新しい順').click(); await flush();
		expect(records()).toEqual([mood.id, 'later']);
		byLabel(f.container, '検索').click(); await flush();
		const search = f.container.querySelector<HTMLInputElement>('input[type="search"]')!;
		search.value = '映画'; search.dispatchEvent(new Event('input', { bubbles: true })); await flush();
		// Vue keeps leaving records mounted until their exit animation finishes.
		await vi.advanceTimersByTimeAsync(400); await flush();
		expect(records()).toEqual(['later']);
		expect(f.save).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
		expect(f.entries.value).toHaveLength(2);
	});
	test('既存記録の編集キャンセルで新規の書きかけを復元する', async () => {
		const f = mountJournal({ entries: [mood] });
		await inputNote(f.container, '新しい書きかけ');
		f.container.querySelector<HTMLButtonElement>('[data-journal-record] > button')!.click();
		await recordMenuAction('記録を編集')(); await flush();
		expect(f.container.querySelector('textarea')?.value).toBe(mood.note);
		const cancel = Array.from(f.container.querySelectorAll('button')).find(button => button.textContent === 'キャンセル')!;
		cancel.click(); await flush();
		expect(f.container.querySelector('textarea')?.value).toBe('新しい書きかけ');
	});
	test('削除を取り消すと元のIDと未知フィールドも復元する', async () => {
		const f = mountJournal({ entries: [mood] });
		f.container.querySelector<HTMLButtonElement>('[data-journal-record] > button')!.click();
		await recordMenuAction('削除')(); await flush();
		expect(f.remove).toHaveBeenCalledWith(mood.id);
		expect(f.entries.value).toEqual([]);
		const undo = Array.from(f.container.querySelectorAll('button')).find(button => button.textContent?.includes('元に戻す'))!;
		undo.click(); await flush();
		expect(f.entries.value).toEqual([mood]);
	});
	test('ごはんには定番保存を用意し、テンプレートは記録へ即送信しない', async () => {
		const template = { id: 'template', name: 'いつものお昼', slot: 'lunch', level: 'ate', note: 'パンとスープ', reasons: [] };
		const f = mountJournal({ kind: 'meal', templates: [template] });
		expect(f.container.querySelectorAll('[role="tab"]')).toHaveLength(4);
		const trigger = byLabel(f.container, 'テンプレート');
		expect(trigger.textContent?.trim()).toBe('');
		expect(f.container.querySelectorAll('[data-template-trigger]')).toHaveLength(1);
		trigger.click();
		await recordMenuAction('テンプレートを使う')(); await flush();
		const use = Array.from(f.container.querySelectorAll('button')).find(button => button.textContent?.includes('この内容を使う'))!;
		use.click(); await flush();
		expect(f.container.querySelector('textarea')?.value).toBe('パンとスープ');
		expect(f.save).not.toHaveBeenCalled();
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save.mock.calls[0][0]).toMatchObject({ slot: 'lunch', level: 'ate', note: 'パンとスープ', date: '2026-08-31', time: '12:00' });
		expect(f.save.mock.calls[0][0].id).not.toBe(template.id);
	});
	test('同じテンプレートアイコンから今のごはんを保存でき、記録は作らない', async () => {
		const f = mountJournal({ kind: 'meal' });
		await inputNote(f.container, 'いつものパン');
		byLabel(f.container, 'テンプレート').click();
		await recordMenuAction('テンプレートに保存')(); await flush();
		expect(f.storeTemplate).toHaveBeenCalledOnce();
		expect(f.storeTemplate.mock.calls[0][0]).toMatchObject({ note: 'いつものパン', slot: 'lunch', level: 'ate' });
		expect(f.save).not.toHaveBeenCalled();
		expect(f.container.querySelector('textarea')?.value).toBe('いつものパン');
	});
	test('既存ごはんから保存するテンプレートは日時を引き継がない', async () => {
		const f = mountJournal({ kind: 'meal', entries: [meal] });
		f.container.querySelector<HTMLButtonElement>('[data-journal-record] > button')!.click();
		await recordMenuAction('この内容を定番に保存')(); await flush();
		expect(f.storeTemplate).toHaveBeenCalledOnce();
		expect(f.storeTemplate.mock.calls[0][0]).toMatchObject({ name: 'いつものお昼', note: 'パンとスープ' });
		expect(f.storeTemplate.mock.calls[0][0]).not.toHaveProperty('date');
		expect(f.storeTemplate.mock.calls[0][0]).not.toHaveProperty('time');
		expect(f.entries.value).toEqual([meal]);
	});
	test('ホームの夜ごはんから空の入力を開くと、夜を選ぶ', async () => {
		const f = mountJournal({ kind: 'meal' });
		f.journal.value!.focusFromHome('dinner'); await flush();
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save.mock.calls[0][0]).toMatchObject({ slot: 'dinner' });
	});
	test('ホームから開き直しても、書きかけのごはんと食事枠を変更しない', async () => {
		const f = mountJournal({ kind: 'meal' });
		await inputNote(f.container, '書きかけの昼ごはん');
		f.journal.value!.focusFromHome('dinner'); await flush();
		expect(f.container.querySelector('textarea')?.value).toBe('書きかけの昼ごはん');
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save.mock.calls[0][0]).toMatchObject({ note: '書きかけの昼ごはん', slot: 'lunch' });
	});
	test('読み込み失敗時は追加を無効にし、空の記録と誤表示しない', async () => {
		const f = mountJournal({ writable: false });
		expect(byLabel(f.container, '記録する').disabled).toBe(true);
		expect(f.container.textContent).toContain('記録を安全に読み込めませんでした');
		expect(f.container.textContent).not.toContain('記録はまだありません');
		byLabel(f.container, '記録する').click(); await flush();
		expect(f.save).not.toHaveBeenCalled();
	});
	test('振り返りの7日平均に古い記録や未来の記録を混ぜない', async () => {
		const f = mountJournal({ entries: [mood, { ...mood, id: 'old', date: '2026-08-01', level: 1 }, { ...mood, id: 'future', date: '2026-09-05', level: 1 }] });
		tab(f.container, '振り返り').click(); await flush();
		expect(f.container.querySelector('[data-journal-view="review"]')?.textContent).toContain('4.0');
		expect(f.container.querySelector('[data-journal-view="review"]')?.textContent).not.toContain('まだありません');
	});
	test('左右キーでタブを切り替え、フォーカスと選択状態を一致させる', async () => {
		const f = mountJournal();
		tab(f.container, '今日').focus();
		f.container.querySelector('[role="tablist"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await flush();
		expect(tab(f.container, '履歴').getAttribute('aria-selected')).toBe('true');
		expect(window.document.activeElement).toBe(tab(f.container, '履歴'));
	});
	test('IME変換中や通常の改行では送信せず、Ctrl+Enterで記録する', async () => {
		const f = mountJournal();
		const input = await inputNote(f.container, 'メモ');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true })); await flush();
		expect(f.save).not.toHaveBeenCalled();
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); await flush();
		expect(f.save).toHaveBeenCalledOnce();
	});
});
