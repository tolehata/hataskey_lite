/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/os.js', () => ({ popupMenu: vi.fn(async () => {}) }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));

vi.mock('@/components/HataskEmoji.vue', async () => {
	const { defineComponent: defineMockComponent, h: renderNode } = await import('vue');
	return { default: defineMockComponent({ props: { emoji: { type: String, default: '' } }, setup: props => () => renderNode('span', { 'data-test-emoji': '' }, props.emoji) }) };
});

import HataskTodoPlanner from './HataskTodoPlanner.vue';
import type { App } from 'vue';
import type { HataskTodoItem, HataskTodoLabels } from './hatask-planner-types.js';
import * as os from '@/os.js';
import { HATASK_TODO_DEFAULT_MOBILE_TABS, HATASK_TODO_MAX_MOBILE_TABS, normalizeHataskTodoMobileTabs } from '@/utility/hatask-todo-tabs.js';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

const labels: HataskTodoLabels = {
	todo: 'やること',
	viewSelector: '表示',
	views: { today: '今日', upcoming: 'これから', overdue: '期限切れ', priority: '優先', all: 'すべて', completed: '完了済み', templates: 'テンプレート' },
	search: 'やることを検索',
	searchPlaceholder: '検索',
	addTask: '追加',
	filters: '絞り込み',
	loading: '読み込み中',
	empty: 'やることはありません',
	readOnly: '読み取り専用',
	priorities: { none: 'なし', low: '低', medium: '中', high: '高' },
	completeTask: title => `${title}を完了`,
	reopenTask: title => `${title}を未完了へ戻す`,
	editTask: title => `${title}を編集`,
	archiveTask: title => `${title}を保管`,
	restoreTask: title => `${title}を復元`,
	deleteTask: title => `${title}を削除`,
	moveUp: title => `${title}を上へ`,
	moveDown: title => `${title}を下へ`,
	subtaskProgress: (completed, total) => `小項目 ${completed}/${total}`,
	sort: '並び順',
	sortOptions: { manual: '手動順', dueAsc: '期限が近い順', priority: '優先度順', createdDesc: '新しく作った順' },
	folders: 'フォルダ',
	selectedCount: count => `${count}件を選択中`,
	bulkComplete: '完了',
	bulkMove: '移動',
	bulkDue: '期限',
	bulkPriority: '優先度',
	bulkArchive: 'アーカイブ',
	clearSelection: '選択を解除',
	addFolder: 'フォルダを追加',
	manageFolder: name => `${name}を管理`,
	moreActions: title => `${title}のその他の操作`,
	moreViews: 'その他',
	reorderViews: 'タブを並び替え',
	reorderView: name => `${name}を並び替え`,
	customizeViews: '表示するタブ',
	customizeViewsHint: '表示するタブは「その他」を含めて5個までです。外したタブは「その他」から開けます',
	showView: name => `${name}をタブに追加`,
	hideView: name => `${name}をタブから外す`,
};

const items: HataskTodoItem[] = [
	{
		id: 'todo-1',
		text: '資料を仕上げる',
		done: false,
		priority: 'high',
		dueLabel: '今日 18:00',
		recurrenceLabel: '毎週',
		subtasks: [{ id: 'sub-1', text: '確認', done: true }, { id: 'sub-2', text: '送信', done: false }],
	},
	{
		id: 'todo-2',
		text: '記録を見直す',
		done: true,
		priority: 'none',
		archivedAt: '2026-08-29T00:00:00.000Z',
		archivedLabel: '8月29日に保管',
	},
];

function mountTodo(options: Record<string, unknown> = {}) {
	const liveOptions = reactive(options);
	const handlers = {
		view: vi.fn(),
		search: vi.fn(),
		sort: vi.fn(),
		filter: vi.fn(),
		complete: vi.fn(),
		moveUp: vi.fn(),
		moveDown: vi.fn(),
		edit: vi.fn(),
		archive: vi.fn(),
		restore: vi.fn(),
		remove: vi.fn(),
		addFolder: vi.fn(),
		manageFolder: vi.fn(),
		mobileOrder: vi.fn(),
		dropTarget: vi.fn(),
		bulk: vi.fn(),
	};
	const app = createApp(defineComponent({
		setup() {
			return () => h(HataskTodoPlanner, {
				theme: 'suri',
				view: 'today',
				items,
				labels,
				filters: [{ id: 'folder:work', kind: 'folder', label: '作業', active: false, count: 8, color: '#1677aa' }],
				viewCounts: { today: 1, all: 2, completed: 1 },
				mobileTabOrder: ['today', 'upcoming', 'all', 'completed', 'more'],
				'onUpdate:view': handlers.view,
				'onUpdate:searchQuery': handlers.search,
				'onUpdate:sort': handlers.sort,
				onToggleFilter: handlers.filter,
				onComplete: handlers.complete,
				onMoveUp: handlers.moveUp,
				onMoveDown: handlers.moveDown,
				onEdit: handlers.edit,
				onArchive: handlers.archive,
				onRestore: handlers.restore,
				onDelete: handlers.remove,
				onAddFolder: handlers.addFolder,
				onManageFolder: handlers.manageFolder,
				'onUpdate:mobileTabOrder': handlers.mobileOrder,
				onDropTarget: handlers.dropTarget,
				onBulkAction: handlers.bulk,
				...liveOptions,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, handlers, setProps: (next: Record<string, unknown>) => Object.assign(liveOptions, next) };
}

async function openTabEditor(container: HTMLElement): Promise<void> {
	await nextTick();
	const button = container.querySelector<HTMLButtonElement>('[aria-label="タブを並び替え"]');
	if (!button) throw new Error('mobile tab editor trigger must exist');
	button.click();
	await nextTick();
	expect(container.querySelector('[data-mobile-tab-editor]')).not.toBeNull();
}

function tabOrder(container: HTMLElement): string[] {
	return [...container.querySelectorAll<HTMLElement>('[data-mobile-tab]')].map(tab => tab.dataset.mobileTab ?? '');
}

async function waitForTabOrder(container: HTMLElement, expected: string[]): Promise<void> {
	await nextTick();
	// Keep the real Vue leave transition; only inspect the final order after it ends.
	await vi.waitFor(() => expect(tabOrder(container)).toEqual(expected));
}

function clickRequired(container: ParentNode, selector: string): void {
	const button = container.querySelector<HTMLButtonElement>(selector);
	if (!button) throw new Error(`required control not found: ${selector}`);
	button.click();
}

function dispatchTouchPointer(target: EventTarget, type: string): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		pointerType: { value: 'touch' }, pointerId: { value: 1 },
		clientX: { value: 10 }, clientY: { value: 10 },
	});
	target.dispatchEvent(event);
}

afterEach(async () => {
	vi.clearAllMocks();
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
	await vi.waitFor(() => expect(window.document.querySelector('#hatask-todo-mobile-organizer')).toBeNull());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('normalizeHataskTodoMobileTabs', () => {
	test('保存キーがない時だけ従来のタブへ戻し、旧形式の順序は保つ', () => {
		expect(normalizeHataskTodoMobileTabs(undefined)).toEqual(HATASK_TODO_DEFAULT_MOBILE_TABS);
		const oldOrder = ['completed', 'today', 'more', 'all', 'upcoming'];
		expect(normalizeHataskTodoMobileTabs(oldOrder)).toEqual(oldOrder);
	});

	test('非表示のタブを復活させず、追加したビューと順序を保つ', () => {
		const saved = ['templates', 'priority', 'more', 'overdue'];
		expect(normalizeHataskTodoMobileTabs(saved)).toEqual(saved);
		expect(saved).toEqual(['templates', 'priority', 'more', 'overdue']);
	});

	test('空の表示一覧でもその他から全ビューへ辿れる', () => {
		expect(normalizeHataskTodoMobileTabs([])).toEqual(['more']);
		expect(normalizeHataskTodoMobileTabs(['more'])).toEqual(['more']);
		expect(normalizeHataskTodoMobileTabs(['priority'])).toEqual(['priority', 'more']);
	});

	test('重複と未知のビューを除外し、完全に壊れた値は初期表示へ戻す', () => {
		expect(normalizeHataskTodoMobileTabs(['priority', 'priority', 'inbox', 42, 'more'])).toEqual(['priority', 'more']);
		expect(normalizeHataskTodoMobileTabs(['inbox', 42])).toEqual(HATASK_TODO_DEFAULT_MOBILE_TABS);
		expect(normalizeHataskTodoMobileTabs({ today: true })).toEqual(HATASK_TODO_DEFAULT_MOBILE_TABS);
	});

	test('その他を含む表示タブを最大5個に収め、既存の順序を優先する', () => {
		expect(HATASK_TODO_MAX_MOBILE_TABS).toBe(5);
		expect(normalizeHataskTodoMobileTabs(['priority', 'templates', 'today', 'upcoming', 'all', 'completed', 'more'])).toEqual(['priority', 'templates', 'today', 'upcoming', 'more']);
		expect(normalizeHataskTodoMobileTabs(['more', 'priority', 'templates', 'today', 'upcoming', 'all'])).toEqual(['more', 'priority', 'templates', 'today', 'upcoming']);
	});
});

describe('HataskTodoPlanner', () => {
	test('埋め込み時は検索・並び替えの下に入力フォームの移動先を渡す', async () => {
		const captureTarget = vi.fn();
		const { container } = mountTodo({ embedded: true, onCaptureTarget: captureTarget });
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="todo"]');
		const target = root?.querySelector<HTMLElement>('[data-hatagoes-inline-capture="todo"]');
		expect(target).toBeInstanceOf(HTMLElement);
		expect(captureTarget).toHaveBeenCalledWith(target);
		const header = root?.querySelector('header');
		if (!root || !header || !target) throw new Error('Missing inline capture layout');
		expect(header.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(target.compareDocumentPosition(root.querySelector('[data-todo-id]') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const legacy = mountTodo();
		expect(legacy.container.querySelector('[data-hatagoes-inline-capture]')).toBeNull();
	});

	test('優先度・小項目・保管状態を表示し、操作を親へ通知する', async () => {
		const { container, handlers } = mountTodo();
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="todo"]');
		expect(root?.dataset.hataskTheme).toBe('suri');
		expect(container.querySelector('[data-todo-id="todo-1"]')?.getAttribute('data-priority')).toBe('high');
		expect(container.querySelector('progress')?.getAttribute('value')).toBe('1');

		const checkbox = container.querySelector<HTMLInputElement>('[aria-label="資料を仕上げるを完了"]');
		checkbox?.click();
		(container.querySelector('[aria-label="これから"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="作業"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="資料を仕上げるのその他の操作"]') as HTMLButtonElement).click();
		await nextTick();
		(container.querySelector('[aria-label="資料を仕上げるを下へ"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="資料を仕上げるを編集"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="資料を仕上げるを保管"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="記録を見直すを復元"]') as HTMLButtonElement).click();

		const search = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (search == null) throw new Error('search input was not rendered');
		search.value = '資料';
		search.dispatchEvent(new Event('input', { bubbles: true }));

		expect(handlers.complete).toHaveBeenCalledWith(items[0], true);
		expect(handlers.view).toHaveBeenCalledWith('upcoming');
		expect(handlers.filter).toHaveBeenCalledWith('folder:work');
		expect(handlers.moveDown).toHaveBeenCalledWith(items[0], 0);
		expect(handlers.edit).toHaveBeenCalledWith(items[0]);
		expect(handlers.archive).toHaveBeenCalledWith(items[0]);
		expect(handlers.restore).toHaveBeenCalledWith(items[1]);
		expect(handlers.search).toHaveBeenCalledWith('資料');
	});

	test('並べ替えにはドラッグ不要の上下ボタンがあり、端では無効になる', async () => {
		const { container } = mountTodo();
		await nextTick();
		(container.querySelector('[aria-label="資料を仕上げるのその他の操作"]') as HTMLButtonElement).click();
		await nextTick();
		expect(container.querySelector<HTMLButtonElement>('[aria-label="資料を仕上げるを上へ"]')?.disabled).toBe(true);
		expect(container.querySelector<HTMLButtonElement>('[aria-label="資料を仕上げるを下へ"]')?.disabled).toBe(false);
		(container.querySelector('[aria-label="記録を見直すのその他の操作"]') as HTMLButtonElement).click();
		await nextTick();
		expect(container.querySelector<HTMLButtonElement>('[aria-label="記録を見直すを下へ"]')?.disabled).toBe(true);
	});

	test('並び順は文字列ボタンでなくアイコンメニューから選べる', async () => {
		const { container, handlers } = mountTodo();
		await nextTick();
		(container.querySelector('[aria-label="並び順: 手動順"]') as HTMLButtonElement).click();
		await nextTick();
		const [menu, anchor, options] = vi.mocked(os.popupMenu).mock.calls[0];
		expect(anchor).toBe(container.querySelector('[aria-label="並び順: 手動順"]'));
		expect(options?.motionPreset).toBe('postform');
		expect(menu).toHaveLength(4);
		const option = menu.find(item => item != null && 'type' in item && item.type === 'radioOption' && item.text === '期限が近い順');
		if (option == null || !('action' in option)) throw new Error('due date sort option was not passed to the viewport-aware menu');
		option.action(new MouseEvent('click'));
		expect(handlers.sort).toHaveBeenCalledWith('dueAsc');
	});

	test('モバイル用タブケースは受信箱を含まず、その他を含めてキーボードでも並び替えられる', async () => {
		const { container, handlers } = mountTodo();
		await nextTick();
		const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['今日', 'これから', 'すべて', '完了済み', 'その他']);
		expect(tabs.map(tab => tab.textContent.trim())).toEqual(['今日', '', '', '', '']);
		const tablerIconCss = readFileSync(resolve(process.cwd(), 'node_modules/@tabler/icons-webfont/dist/tabler-icons.css'), 'utf8');
		const productionIconCss = readFileSync(resolve(process.cwd(), 'node_modules/icons-subsetter/built/tabler-icons-frontend.css'), 'utf8');
		for (const tab of tabs) {
			const icon = tab.querySelector<HTMLElement>('i[aria-hidden="true"]');
			expect(icon).not.toBeNull();
			const iconClass = [...(icon?.classList ?? [])].find(className => className.startsWith('ti-'));
			expect(iconClass).toBeDefined();
			expect(tablerIconCss).toContain(`.${iconClass}:before`);
			expect(productionIconCss).toContain(`.${iconClass}::before`);
		}
		expect(container.textContent).not.toContain('受信箱');

		(container.querySelector('[aria-label="タブを並び替え"]') as HTMLButtonElement).click();
		await nextTick();
		const today = container.querySelector<HTMLButtonElement>('[aria-label="今日を並び替え"]');
		if (today == null) throw new Error('reorderable today tab was not rendered');
		today.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();
		expect(handlers.mobileOrder).toHaveBeenCalledWith(['upcoming', 'today', 'all', 'completed', 'more']);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].map(tab => tab.dataset.mobileTab)).toEqual(['upcoming', 'today', 'all', 'completed', 'more']);
	});

	test.each(['today', 'upcoming', 'all', 'completed', 'priority', 'overdue', 'templates'] as const)('%sでも選択中のモバイルタブだけラベルを表示する', async view => {
		const { container } = mountTodo({ view });
		await nextTick();
		const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		expect(tabs.filter(tab => tab.textContent.trim())).toHaveLength(1);
		const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
		expect(active?.textContent.trim()).toBe(active?.getAttribute('aria-label'));
	});

	test.each(['priority', 'overdue', 'templates'] as const)('%sも5個の上限内で追加・削除し、再読込後も選択した順序だけを復元する', async view => {
		const { container, handlers, setProps } = mountTodo();
		expect(container.querySelector('[data-mobile-tab-editor]')).toBeNull();
		await openTabEditor(container);
		expect(container.querySelectorAll('[data-tab-choice]')).toHaveLength(7);
		expect(container.querySelectorAll('[data-tab-earlier], [data-tab-later]')).toHaveLength(0);
		expect(container.querySelector<HTMLButtonElement>(`[data-tab-choice="${view}"]`)?.disabled).toBe(true);
		clickRequired(container, '[data-tab-choice="completed"]');
		await waitForTabOrder(container, ['today', 'upcoming', 'all', 'more']);
		expect(container.querySelector<HTMLButtonElement>(`[data-tab-choice="${view}"]`)?.disabled).toBe(false);
		clickRequired(container, `[data-tab-choice="${view}"]`);
		const added = ['today', 'upcoming', 'all', view, 'more'];
		await waitForTabOrder(container, added);
		expect(tabOrder(container)).toEqual(added);
		expect(handlers.mobileOrder).toHaveBeenLastCalledWith(added);
		container.querySelector(`[data-mobile-tab="${view}"]`)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		await nextTick();
		const reordered = ['today', 'upcoming', view, 'all', 'more'];
		expect(tabOrder(container)).toEqual(reordered);
		expect(handlers.mobileOrder).toHaveBeenLastCalledWith(reordered);
		setProps({ mobileTabOrder: [...reordered], view });
		await nextTick();
		clickRequired(container, '[aria-label="タブを並び替え"]');
		await nextTick();
		expect(container.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveLength(1);
		expect(container.querySelector(`[data-mobile-tab="${view}"]`)?.getAttribute('aria-selected')).toBe('true');
		expect(container.querySelector('[data-mobile-tab="more"]')?.getAttribute('aria-selected')).toBe('false');
		await openTabEditor(container);
		clickRequired(container, `[data-tab-choice="${view}"]`);
		await nextTick();
		expect(handlers.mobileOrder).toHaveBeenLastCalledWith(['today', 'upcoming', 'all', 'more']);
	});

	test('表示中のタブを外してもToDoや開いているビューを変えず、その他から再選択できる', async () => {
		const { container, handlers } = mountTodo({ view: 'today' });
		await openTabEditor(container);
		clickRequired(container, '[data-tab-choice="today"]');
		await waitForTabOrder(container, ['upcoming', 'all', 'completed', 'more']);
		expect(container.querySelector('[data-mobile-tab="today"]')).toBeNull();
		expect(container.querySelector('[data-mobile-tab="more"]')?.getAttribute('aria-selected')).toBe('true');
		expect(container.querySelector('[data-hatask-component="todo"]')?.getAttribute('data-view')).toBe('today');
		expect(handlers.view).not.toHaveBeenCalled();
		expect(handlers.remove).not.toHaveBeenCalled();
		expect(handlers.complete).not.toHaveBeenCalled();
		clickRequired(container, '[aria-label="タブを並び替え"]');
		await nextTick();
		clickRequired(container, '[data-mobile-tab="more"]');
		await nextTick();
		const organizer = window.document.querySelector('#hatask-todo-mobile-organizer');
		if (!organizer) throw new Error('Mobile ToDo organizer was not found');
		expect(organizer.querySelectorAll('.hatask-smart-views button')).toHaveLength(4);
		clickRequired(organizer, '[aria-label="今日"]');
		expect(handlers.view).toHaveBeenLastCalledWith('today');
	});

	test('直接表示を全部外してもその他を残し、PC側には全7ビューを維持する', async () => {
		const { container, handlers } = mountTodo();
		await openTabEditor(container);
		for (const view of ['today', 'upcoming', 'all', 'completed']) {
			clickRequired(container, `[data-tab-choice="${view}"]`);
			await nextTick();
		}
		await waitForTabOrder(container, ['more']);
		expect(handlers.mobileOrder).toHaveBeenLastCalledWith(['more']);
		expect(container.querySelectorAll('.hatask-smart-views button')).toHaveLength(7);
		clickRequired(container, '[aria-label="タブを並び替え"]');
		await nextTick();
		clickRequired(container, '[data-mobile-tab="more"]');
		await nextTick();
		expect(window.document.querySelectorAll('#hatask-todo-mobile-organizer .hatask-smart-views button')).toHaveLength(7);
	});

	test('追加ビューのタブもキーボードで並び替えられ、保存値の更新は非表示設定を保つ', async () => {
		const { container, handlers, setProps } = mountTodo({ mobileTabOrder: ['priority', 'templates', 'more'], view: 'priority' });
		await openTabEditor(container);
		const priority = container.querySelector('[data-mobile-tab="priority"]');
		if (!priority) throw new Error('added priority tab was not rendered');
		priority.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();
		expect(handlers.mobileOrder).toHaveBeenLastCalledWith(['templates', 'priority', 'more']);
		setProps({ mobileTabOrder: ['overdue', 'more'] });
		await waitForTabOrder(container, ['overdue', 'more']);
		expect(container.querySelector('[data-tab-choice="priority"]')?.getAttribute('aria-pressed')).toBe('false');
	});

	test('タブのドラッグ中断は元の順序へ戻し、保存せず次のドラッグへ進める', async () => {
		const originalItems = JSON.stringify(items);
		const { container, handlers } = mountTodo({ mobileTabOrder: ['priority', 'today', 'more'], view: 'priority' });
		await openTabEditor(container);
		const source = container.querySelector<HTMLElement>('[data-mobile-tab="priority"]');
		const target = container.querySelector<HTMLElement>('[data-mobile-tab="today"]');
		if (!source || !target) throw new Error('reorderable tabs were not rendered');
		Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
		vi.spyOn(window.document, 'elementFromPoint').mockReturnValue(target);

		dispatchTouchPointer(source, 'pointerdown');
		dispatchTouchPointer(source, 'pointermove');
		await nextTick();
		expect(tabOrder(container)).toEqual(['today', 'priority', 'more']);
		dispatchTouchPointer(source, 'pointercancel');
		dispatchTouchPointer(source, 'pointerup');
		await nextTick();
		expect(tabOrder(container)).toEqual(['priority', 'today', 'more']);
		expect(handlers.mobileOrder).not.toHaveBeenCalled();
		expect(source.dataset.dragging).toBe('false');

		// Positive control after cancellation: normal completion still saves.
		dispatchTouchPointer(source, 'pointerdown');
		dispatchTouchPointer(source, 'pointermove');
		dispatchTouchPointer(source, 'pointerup');
		await nextTick();
		expect(handlers.mobileOrder).toHaveBeenCalledTimes(1);
		expect(handlers.mobileOrder).toHaveBeenCalledWith(['today', 'priority', 'more']);
		expect(handlers.view).not.toHaveBeenCalled();
		expect(JSON.stringify(items)).toBe(originalItems);
	});

	test('別のToDo画面のタブへ重ねても並び替えず、自分のタブ上だけで移動する', async () => {
		const first = mountTodo({ mobileTabOrder: ['priority', 'today', 'more'] });
		const second = mountTodo({ mobileTabOrder: ['today', 'more'] });
		await openTabEditor(first.container);
		const source = first.container.querySelector<HTMLElement>('[data-mobile-tab="priority"]');
		const ownTarget = first.container.querySelector<HTMLElement>('[data-mobile-tab="today"]');
		const otherTarget = second.container.querySelector<HTMLElement>('[data-mobile-tab="today"]');
		if (!source || !ownTarget || !otherTarget) throw new Error('two instances of tab controls were not rendered');
		Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
		const hitTest = vi.spyOn(window.document, 'elementFromPoint').mockReturnValue(otherTarget);
		dispatchTouchPointer(source, 'pointerdown');
		dispatchTouchPointer(source, 'pointermove');
		await nextTick();
		expect(tabOrder(first.container)).toEqual(['priority', 'today', 'more']);
		expect(tabOrder(second.container)).toEqual(['today', 'more']);
		expect(first.handlers.mobileOrder).not.toHaveBeenCalled();
		expect(second.handlers.mobileOrder).not.toHaveBeenCalled();

		hitTest.mockReturnValue(ownTarget);
		dispatchTouchPointer(source, 'pointermove');
		dispatchTouchPointer(source, 'pointerup');
		await nextTick();
		expect(tabOrder(first.container)).toEqual(['today', 'priority', 'more']);
		expect(first.handlers.mobileOrder).toHaveBeenCalledTimes(1);
		expect(first.handlers.mobileOrder).toHaveBeenCalledWith(['today', 'priority', 'more']);
		expect(second.handlers.mobileOrder).not.toHaveBeenCalled();
	});

	test('ドラッグ開始後でなく並び替えモードの開始時からタッチ操作を確保する', () => {
		// Source contract only; actual touch scrolling needs a browser/device check.
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskTodoPlanner.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		expect(parsed.descriptor.styles[0].content).toMatch(/\.mobileTabShell\[data-reordering=true\]\s+\.mobileTab\s*\{\s*touch-action:\s*none\s*\}/);
	});

	test('PC幅に変わったらモバイル専用の編集UIを閉じる', async () => {
		let notifyResize: ResizeObserverCallback | undefined;
		class TestResizeObserver {
			constructor(callback: ResizeObserverCallback) { notifyResize = callback; }
			observe() {}
			disconnect() {}
		}
		vi.stubGlobal('ResizeObserver', TestResizeObserver);
		const { container } = mountTodo();
		await openTabEditor(container);
		if (!notifyResize) throw new Error('layout observer was not registered');
		notifyResize([{ contentRect: { width: 1100 } } as ResizeObserverEntry], {} as ResizeObserver);
		await nextTick();
		expect(container.querySelector('[data-mobile-tab-editor]')).toBeNull();
		expect(container.querySelector('[aria-label="タブを並び替え"]')?.getAttribute('aria-pressed')).toBe('false');
		expect(container.querySelectorAll('.hatask-smart-views button')).toHaveLength(7);
	});

	test('タッチ長押し後のclickで選択が解除されず、アイコン一括操作にも名前がある', async () => {
		vi.useFakeTimers();
		try {
			const { container } = mountTodo();
			await nextTick();
			const row = container.querySelector<HTMLElement>('[data-todo-id="todo-1"]');
			if (row == null) throw new Error('todo row was not rendered');
			const pointerDown = new Event('pointerdown', { bubbles: true });
			Object.defineProperties(pointerDown, {
				pointerType: { value: 'touch' },
				clientX: { value: 10 },
				clientY: { value: 10 },
			});
			row.dispatchEvent(pointerDown);
			vi.advanceTimersByTime(380);
			await nextTick();
			row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await nextTick();

			expect(row.dataset.selected).toBe('true');
			expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('1件を選択中');
			expect(container.querySelector('[aria-label="完了"]')).not.toBeNull();
			expect(container.querySelector('[aria-label="移動"]')).not.toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	test('読み取り専用時は状態を伝え、完了・編集・削除を無効にする', async () => {
		const { container, handlers } = mountTodo({ readOnly: true });
		await nextTick();
		expect(container.textContent).toContain(labels.readOnly);
		expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
		expect(container.querySelector<HTMLInputElement>('[aria-label="資料を仕上げるを完了"]')?.disabled).toBe(true);
		expect(container.querySelector<HTMLButtonElement>('[aria-label="資料を仕上げるを編集"]')?.disabled).toBe(true);
		(container.querySelector('[aria-label="資料を仕上げるのその他の操作"]') as HTMLButtonElement).click();
		await nextTick();
		const remove = container.querySelector<HTMLButtonElement>('[aria-label="資料を仕上げるを削除"]');
		expect(remove?.disabled).toBe(true);
		remove?.click();
		expect(handlers.remove).not.toHaveBeenCalled();
	});

	test('読み込み表示は親のライブリージョンと重複せず、busy状態だけを公開する', async () => {
		const { container } = mountTodo({ loading: true });
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="todo"]');
		expect(root?.getAttribute('aria-busy')).toBe('true');
		expect(container.textContent).toContain(labels.loading);
		expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
	});
});
