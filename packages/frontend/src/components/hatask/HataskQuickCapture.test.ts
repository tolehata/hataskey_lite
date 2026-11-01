/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataskQuickCapture from './HataskQuickCapture.vue';
import type { App } from 'vue';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

function mountCapture(options: Record<string, unknown> = {}) {
	const handlers = {
		submit: vi.fn(),
		tool: vi.fn(),
		template: vi.fn(),
		chip: vi.fn(),
		removeChip: vi.fn(),
		collapse: vi.fn(),
		update: vi.fn(),
	};
	const model = ref('');
	const app = createApp(defineComponent({
		setup() {
			return () => h(HataskQuickCapture, {
				mode: 'event',
				modelValue: model.value,
				label: '予定をすぐ追加',
				placeholder: '予定名を入力',
				submitLabel: '予定を追加',
				chipLabel: '選択中の予定設定',
				toolLabel: '予定の入力設定',
				templateLabel: 'テンプレート',
				removeChipLabel: label => `${label}を外す`,
				chips: [
					{ id: 'date', label: '今日', icon: 'ti ti-calendar', actionLabel: '日付を変更', actionIcon: 'ti ti-pencil' },
					{ id: 'priority', label: '優先', icon: 'ti ti-flag' },
				],
				tools: [
					{ id: 'details', label: '詳細設定', icon: 'ti ti-adjustments' },
				],
				onSubmit: handlers.submit,
				onTool: handlers.tool,
				onTemplate: handlers.template,
				onChip: handlers.chip,
				onRemoveChip: handlers.removeChip,
				onCollapse: handlers.collapse,
				'onUpdate:modelValue': (value: string) => {
					model.value = value;
					handlers.update(value);
				},
				...options,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, handlers };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('HataskQuickCapture', () => {
	test('明示的に閉じるまで展開を保ち、設定ピルをその場で操作できる', async () => {
		const { container, handlers } = mountCapture();
		const root = container.querySelector<HTMLElement>('section');
		const input = container.querySelector<HTMLInputElement>('input');

		expect(root?.dataset.open).toBe('false');
		expect(container.querySelector('[aria-label="日付を変更"]')).toBeNull();

		input?.focus();
		await nextTick();
		expect(root?.dataset.open).toBe('true');
		expect(container.querySelectorAll('[data-template-trigger]')).toHaveLength(1);
		(container.querySelector('[aria-label="日付を変更"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="優先を外す"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="詳細設定"]') as HTMLButtonElement).click();
		expect(handlers.chip).toHaveBeenCalledWith('date', container.querySelector('[aria-label="日付を変更"]'));
		expect(handlers.removeChip).toHaveBeenCalledWith('priority');
		expect(handlers.tool).toHaveBeenCalledWith('details', container.querySelector('[aria-label="詳細設定"]'));

		const outside = window.document.createElement('button');
		window.document.body.append(outside);
		outside.focus();
		await nextTick();
		expect(root?.dataset.open).toBe('true');
		outside.remove();

		input?.focus();
		input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		expect(root?.dataset.open).toBe('false');
		expect(handlers.collapse).toHaveBeenCalledTimes(1);
	});

	test.each([
		{ label: '日付を変更', handler: 'chip', id: 'date' },
		{ label: '詳細設定', handler: 'tool', id: 'details' },
	] as const)('$handlerはアイコンを押してもボタン本体をメニューの基準として渡す', async ({ label, handler, id }) => {
		const { container, handlers } = mountCapture();
		container.querySelector<HTMLInputElement>('input')?.focus();
		await nextTick();
		const button = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
		const icon = button?.querySelector('i');
		if (!button || !icon) throw new Error('Capture action was not rendered');
		icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await nextTick();
		expect(handlers[handler]).toHaveBeenCalledWith(id, button);
		expect(handlers[handler].mock.calls[0][1]).not.toBe(icon);
		expect(handlers[handler].mock.calls[0][1].isConnected).toBe(true);
	});

	test.each(['event', 'todo', 'meal'])('%sのテンプレートは空欄・折りたたみ中も1つのアイコンから呼び出せる', async mode => {
		const { container, handlers } = mountCapture({ mode });
		const trigger = container.querySelector<HTMLButtonElement>('[data-template-trigger]');
		expect(container.querySelector('section')?.dataset.open).toBe('false');
		expect(trigger?.disabled).toBe(false);
		expect(trigger?.textContent?.trim()).toBe('');
		expect(trigger?.getAttribute('aria-label')).toBe('テンプレート');
		expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
		trigger?.click();
		await nextTick();
		expect(handlers.template).toHaveBeenCalledOnce();
		expect(container.querySelectorAll('[data-template-trigger]')).toHaveLength(1);
		expect(handlers.submit).not.toHaveBeenCalled();
	});

	test.each([{ disabled: true }, { templateDisabled: true }, { state: 'saving' }])('読み込み未完了・保存中はテンプレートを開かない (%j)', async options => {
		const { container, handlers } = mountCapture(options);
		const trigger = container.querySelector<HTMLButtonElement>('[data-template-trigger]');
		expect(trigger?.disabled).toBe(true);
		trigger?.click();
		await nextTick();
		expect(handlers.template).not.toHaveBeenCalled();
	});

	test('テンプレートを持たないきもちにはアイコンを追加しない', () => {
		const { container } = mountCapture({ mode: 'mood', templateLabel: undefined });
		expect(container.querySelector('[data-template-trigger]')).toBeNull();
	});

	test('入力値を親へ返し、空欄では追加を実行しない', async () => {
		const { container, handlers } = mountCapture();
		const input = container.querySelector<HTMLInputElement>('input');
		const submit = container.querySelector<HTMLButtonElement>('[aria-label="予定を追加"]');
		expect(submit?.disabled).toBe(true);

		if (input == null) throw new Error('capture input was not rendered');
		input.value = '打ち合わせ 明日 10:00';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		expect(handlers.update).toHaveBeenCalledWith('打ち合わせ 明日 10:00');
		expect(submit?.disabled).toBe(false);
		submit?.click();
		expect(handlers.submit).toHaveBeenCalledTimes(1);
	});
});
