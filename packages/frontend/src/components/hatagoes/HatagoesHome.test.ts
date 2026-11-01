/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { HatagoesCardV3, HatagoesCardV3Id } from '@/utility/hatagoes-preferences.js';
import type { HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';

const loaders = vi.hoisted(() => ({ planner: vi.fn(), flower: vi.fn(), journal: vi.fn(), daily: vi.fn(), reading: vi.fn(), stats: vi.fn() }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/components/HyBookCover.vue', async () => { const { h: makeNode } = await import('vue'); return { default: { props: ['title', 'author', 'colorIndex', 'width', 'showTitle'], setup: (props: { title: string; author?: string; colorIndex?: number; width: number; showTitle: boolean }) => () => makeNode('span', { 'data-book-cover': props.title, 'data-author': props.author, 'data-color-index': props.colorIndex, 'data-width': props.width, 'data-show-title': props.showTitle }) } }; });
vi.mock('@/components/HataskEmoji.vue', async () => { const { h: makeNode } = await import('vue'); return { default: { props: ['emoji'], setup: (props: { emoji: string }) => () => makeNode('span', { 'data-hatask-emoji': props.emoji }) } }; });
vi.mock('@/utility/hatagoes-home.js', () => ({
	HATAGOES_HOME_PATHS: { schedule: '/hatask?tab=cal', todo: '/hatask?tab=todo', flower: '/hatask?tab=garden', mood: '/hatask?tab=mood', meal: '/hatask?tab=meal', reading: '/hatady?tab=collection' },
	HATAGOES_HOME_TITLES: { schedule: '予定', todo: '優先 ToDo', flower: 'おはな' },
	loadHatagoesPlanner: loaders.planner, loadHatagoesFlower: loaders.flower, loadHatagoesStats: loaders.stats,
	loadHatagoesJournal: loaders.journal, loadHatagoesReading: loaders.reading, loadHatagoesIssues: vi.fn(), loadHatagoesCommunity: vi.fn(), loadHatagoesRoadmap: vi.fn(),
}));
vi.mock('@/utility/hatagoes-home-v3.js', () => ({ loadHatagoesDaily: loaders.daily, loadHatagoesJournalV3: loaders.journal }));
import HatagoesHome from './HatagoesHome.vue';
import { prefer } from '@/preferences.js';

async function settle() { for (let index = 0; index < 4; index++) { await Promise.resolve(); await nextTick(); } }

let cleanup: (() => void) | undefined;

function mount(cards: Array<{ id: string; hidden: boolean }>, busyTodoIds: string[] = [], initiallyActive = true, order?: HatagoesCardV3Id[], launcherApps: HatagoesCatalogEntry[] = [], options: { width?: number; busyActions?: string[]; halloween?: boolean; decorationHost?: HTMLElement } = {}) {
	let width = options.width ?? 1000;
	const resizeCallbacks = new Set<() => void>();
	vi.stubGlobal('ResizeObserver', class {
		private notify: (() => void) | undefined;
		constructor(private callback: ResizeObserverCallback) {}
		observe(target: Element) {
			this.notify = () => this.callback([{ target, contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
			resizeCallbacks.add(this.notify); this.notify();
		}
		unobserve() { this.disconnect(); }
		disconnect() { if (this.notify) resizeCallbacks.delete(this.notify); }
	});
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const toggled: string[] = [];
	const navigated: string[] = [];
	const moods: number[] = [];
	const meals: string[] = [];
	const waters: string[] = [];
	const readings: string[] = [];
	const openedApps: string[] = [];
	const allApps = vi.fn();
	const home = ref<InstanceType<typeof HatagoesHome> | null>(null);
	const active = ref(initiallyActive);
	const revision = ref(0);
	const recordRevision = ref(0);
	const busyActions = ref(options.busyActions ?? []);
	const all: HatagoesCardV3Id[] = order ?? ['daily', 'schedule', 'flower', 'todo', 'mood', 'meal', 'reading', 'issues'];
	const cardsV3: HatagoesCardV3[] = all.map(id => ({ id, hidden: cards.find(card => card.id === id)?.hidden ?? true }));
	const app = createApp({ render: () => h(HatagoesHome, { ref: home, cardsV3, launcherApps, revision: revision.value, recordRevision: recordRevision.value, active: active.value, busyTodoIds, busyActions: busyActions.value, halloween: options.halloween, decorationHost: options.decorationHost, onToggleTodo: (id: string) => toggled.push(id), onNavigate: (path: string) => navigated.push(path), onRecordMood: (level: number) => moods.push(level), onRecordMeal: (slot: string) => meals.push(slot), onWater: (day: string) => waters.push(day), onRecordReading: (id: string) => readings.push(id), onOpenApp: (id: string) => openedApps.push(id), onAllApps: allApps }) });
	app.component('MkUserName', { props: ['user', 'nowrap'], render: () => h('span') });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	return { target, toggled, navigated, moods, meals, waters, readings, openedApps, allApps, active, revision, recordRevision, busyActions, home, resize: (nextWidth: number) => { width = nextWidth; resizeCallbacks.forEach(notify => notify()); } };
}

beforeEach(() => { loaders.planner.mockReset(); loaders.flower.mockReset(); loaders.journal.mockReset(); loaders.daily.mockReset(); loaders.reading.mockReset(); loaders.stats.mockReset(); loaders.planner.mockResolvedValue({ schedule: { rows: [] }, todo: { rows: [] } }); loaders.flower.mockResolvedValue({ rows: [] }); loaders.reading.mockResolvedValue({ rows: [] }); loaders.journal.mockResolvedValue({ today: '2026-10-03', week: [], meals: [] }); loaders.daily.mockResolvedValue({ today: '2026-10-03', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-03', known: true, completed: [], count: 0, complete: false }], streakDays: 0 }); prefer.r.animation.value = false; vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 3, 12)); });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function prepareInlineSources() {
	loaders.planner.mockResolvedValue({ schedule: { rows: [] }, todo: { rows: [{ id: 'todo-1', title: '手紙を出す', path: '/hatask?tab=todo&hgId=todo-1', priority: 'high' }], total: 1 } });
	loaders.flower.mockResolvedValue({ rows: [], flower: { emoji: '🌼', name: 'ヒナギク', progress: 72, drops: 2, canWater: true, pourMinutes: 30, harvestedCount: 0 } });
	loaders.reading.mockResolvedValue({ rows: [{ id: 'book-1', title: '夜を編む庭', currentPage: 96, totalPages: 212, progress: 45, path: '/hatady?tab=collection&hgId=book-1' }] });
}

function button(target: ParentNode, selector: string): HTMLButtonElement {
	const element = target.querySelector<HTMLButtonElement>(selector);
	if (!element) throw new Error(`Missing button: ${selector}`);
	return element;
}

describe('HataGoes Home', () => {
	test('上部装飾は本文のスクロール領域を抜けてヘッダーと同じ外枠に表示する', async () => {
		prefer.r.animation.value = true;
		vi.spyOn(window, 'matchMedia').mockReturnValue(Object.assign(new EventTarget(), { matches: false }) as MediaQueryList);
		const shell = window.document.createElement('div');
		shell.innerHTML = '<header><button type="button">検索</button></header><div data-scroll style="overflow:auto"></div>';
		window.document.body.append(shell);
		const scroll = shell.querySelector<HTMLElement>('[data-scroll]')!;
		const view = mount([], [], true, undefined, [], { width: 390, halloween: true, decorationHost: shell });
		scroll.append(view.target);
		const unmount = cleanup;
		cleanup = () => { unmount?.(); shell.remove(); };
		await settle();
		const decorations = shell.querySelector('.hgh-halloween-header')!;
		expect(decorations).not.toBeNull();
		expect(decorations.parentElement).toBe(shell);
		expect(decorations.getAttribute('aria-hidden')).toBe('true');
		// The fourth star stays in the DOM; the effects CSS exposes it only in a wide shell.
		expect(decorations.querySelectorAll('.hgh-halloween-star')).toHaveLength(4);
		expect(decorations.querySelectorAll('.hgh-halloween-spider')).toHaveLength(1);
		expect(scroll.querySelector('.hgh-halloween-header')).toBeNull();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		scroll.scrollTop = 500;
		scroll.dispatchEvent(new Event('scroll'));
		await settle();
		expect(decorations.parentElement).toBe(shell);
		expect(shell.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		view.active.value = false; await settle();
		expect(shell.querySelector('.hgh-halloween-header')).toBeNull();
		view.active.value = true; await settle();
		expect(shell.querySelectorAll('.hgh-halloween-star')).toHaveLength(4);
		unmount?.(); cleanup = () => shell.remove();
		expect(shell.querySelector('.hgh-halloween-header')).toBeNull();
	});

	test('常時装飾は記録の初回読み込み中も取得失敗後も表示する', async () => {
		prefer.r.animation.value = true;
		vi.spyOn(window, 'matchMedia').mockReturnValue(Object.assign(new EventTarget(), { matches: false }) as MediaQueryList);
		let rejectDaily!: (reason: Error) => void;
		loaders.daily.mockReturnValue(new Promise((_, reject) => { rejectDaily = reject; }));
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390, halloween: true });
		await settle();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelectorAll('.hgh-halloween-star')).toHaveLength(4);
		expect(view.target.querySelector('.hgh-halloween-spider')).not.toBeNull();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		rejectDaily(new Error('offline'));
		await settle();
		expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('記録を読み込めませんでした');
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelector('.hgh-halloween-spider')).not.toBeNull();
	});

	test('日次・花カードを隠しても常時装飾は表示し、非表示中と動きの設定には従う', async () => {
		prefer.r.animation.value = true;
		vi.spyOn(window, 'matchMedia').mockReturnValue(Object.assign(new EventTarget(), { matches: false }) as MediaQueryList);
		const view = mount([], [], true, undefined, [], { width: 390, halloween: true });
		await settle();
		expect(loaders.daily).not.toHaveBeenCalled();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		view.active.value = false; await settle();
		expect(view.target.querySelector('.hgh-halloween-ambient')).toBeNull();
		view.active.value = true; await settle();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelector('.hgh-halloween-banner')).toBeNull();
		prefer.r.animation.value = false; await settle();
		expect(view.target.querySelector('.hgh-halloween-ambient')).toBeNull();
	});

	test('実際の演出コンポーネントへ保存後の確定カウントを渡し、初回・復帰時には祝福しない', async () => {
		prefer.r.animation.value = true;
		vi.spyOn(window, 'matchMedia').mockReturnValue(Object.assign(new EventTarget(), { matches: false }) as MediaQueryList);
		const summary = (count: number) => ({ today: '2026-10-03', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-03', known: true, completed: ['mood', 'meal', 'water', 'reading', 'todo'].slice(0, count), count, complete: count === 5 }], streakDays: 0 });
		loaders.daily.mockResolvedValue(summary(4));
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390, halloween: true });
		await settle();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		let resolveDaily!: (data: ReturnType<typeof summary>) => void;
		loaders.daily.mockReturnValueOnce(new Promise(resolve => { resolveDaily = resolve; }));
		view.revision.value++; view.recordRevision.value++; await settle();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		resolveDaily(summary(5)); await settle();
		expect(view.target.querySelectorAll('.hgh-halloween-burst > i')).toHaveLength(12);
		expect(view.target.querySelector('.hgh-halloween-banner')?.textContent).toContain('Happy Halloween!');
		view.active.value = false; await settle();
		loaders.daily.mockResolvedValue(summary(5));
		view.active.value = true; await settle();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		expect(view.target.querySelector('.hgh-halloween-banner')).toBeNull();
	});

	test('390pxでは独立カードが非表示でも5行を開閉し、実データの識別子でその場の記録を依頼する', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390 });
		await settle();
		expect(view.target.querySelector('.hgh')?.getAttribute('data-inline-records')).toBe('true');
		expect([...view.target.querySelectorAll('.hgh-ritual-row')].map(row => row.getAttribute('data-ritual'))).toEqual(['mood', 'meal', 'todo', 'water', 'reading']);
		expect(view.target.querySelector('.hgh-card-mood, .hgh-card-meal, .hgh-card-todo, .hgh-card-flower, .hgh-card-reading')).toBeNull();
		for (const source of [loaders.daily, loaders.planner, loaders.journal, loaders.flower, loaders.reading]) expect(source).toHaveBeenCalledTimes(1);
		expect(button(view.target, '#hgh-toggle-mood').getAttribute('aria-expanded')).toBe('true');
		button(view.target, '#hgh-panel-mood button[aria-label="きもちをいいで記録"]').click();
		button(view.target, '#hgh-toggle-meal').click(); await settle();
		expect(button(view.target, '#hgh-toggle-mood').getAttribute('aria-expanded')).toBe('false');
		expect((view.target.querySelector('#hgh-panel-mood') as HTMLElement).style.display).toBe('none');
		expect(button(view.target, '#hgh-toggle-meal').getAttribute('aria-expanded')).toBe('true');
		expect(view.target.querySelector('#hgh-panel-meal')?.getAttribute('aria-labelledby')).toBe('hgh-toggle-meal');
		button(view.target, '#hgh-panel-meal button:nth-child(2)').click();
		button(view.target, '#hgh-toggle-todo').click(); await settle();
		button(view.target, '#hgh-panel-todo .hgh-inline-todos button').click();
		button(view.target, '#hgh-toggle-water').click(); await settle();
		button(view.target, '#hgh-panel-water .hgh-inline-action').click();
		button(view.target, '#hgh-toggle-reading').click(); await settle();
		button(view.target, '#hgh-panel-reading .hgh-inline-action').click();
		button(view.target, '#hgh-toggle-reading').click(); await settle();
		expect(button(view.target, '#hgh-toggle-reading').getAttribute('aria-expanded')).toBe('false');
		expect(view.moods).toEqual([4]); expect(view.meals).toEqual(['lunch']); expect(view.toggled).toEqual(['todo-1']);
		expect(view.waters).toEqual(['2026-10-03']); expect(view.readings).toEqual(['book-1']); expect(view.navigated).toEqual([]);
	});

	test('きもち保存後の再読込中も入力DOMを保ち、最新の記録が届くまで再入力を止める', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390 });
		await settle();
		const selector = '#hgh-panel-mood button[aria-label="きもちをいいで記録"]';
		const choice = button(view.target, selector);
		choice.click();
		view.busyActions.value = ['mood']; await settle();
		expect(choice.disabled).toBe(true);
		let resolveDaily!: (value: unknown) => void;
		let resolveJournal!: (value: unknown) => void;
		loaders.daily.mockReturnValueOnce(new Promise(resolve => { resolveDaily = resolve; }));
		loaders.journal.mockReturnValueOnce(new Promise(resolve => { resolveJournal = resolve; }));
		view.busyActions.value = []; view.revision.value++; view.recordRevision.value++; await settle();
		expect(button(view.target, selector)).toBe(choice);
		expect(choice.isConnected).toBe(true);
		expect(choice.disabled).toBe(true);
		choice.click(); expect(view.moods).toEqual([4]);
		resolveDaily({ today: '2026-10-03', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-03', known: true, completed: ['mood'], count: 1, complete: false }], streakDays: 0 });
		await settle();
		expect(button(view.target, selector)).toBe(choice);
		expect(choice.disabled).toBe(true);
		resolveJournal({ today: '2026-10-03', week: [], meals: [], mood: { id: 'mood-1', date: '2026-10-03', time: '12:00', level: 4 } });
		await settle();
		expect(button(view.target, selector)).toBe(choice);
		expect(choice.disabled).toBe(false);
		expect(choice.getAttribute('aria-pressed')).toBe('true');
		choice.click(); expect(view.moods).toEqual([4, 4]);
	});

	test('保存中の記録操作を無効にし、保存済み水やりを再取得後も二重に送らない', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], ['todo-1'], true, undefined, [], { width: 390, busyActions: ['mood', 'meal', 'water', 'reading'] });
		await settle();
		for (const selector of ['#hgh-panel-mood button', '#hgh-panel-meal button', '#hgh-panel-todo .hgh-inline-todos button', '#hgh-panel-water .hgh-inline-action', '#hgh-panel-reading .hgh-inline-action']) {
			const action = button(view.target, selector); expect(action.disabled).toBe(true); action.click();
		}
		expect([view.moods, view.meals, view.toggled, view.waters, view.readings]).toEqual([[], [], [], [], []]);
		view.busyActions.value = []; await settle();
		button(view.target, '#hgh-toggle-water').click(); await settle();
		button(view.target, '#hgh-panel-water .hgh-inline-action').click();
		view.home.value?.markWatered('2026-10-03'); await settle();
		expect(button(view.target, '#hgh-panel-water .hgh-inline-action').disabled).toBe(true);
		button(view.target, '#hgh-panel-water .hgh-inline-action').click();
		view.revision.value++; await settle();
		button(view.target, '#hgh-panel-water .hgh-inline-action').click();
		expect(view.waters).toEqual(['2026-10-03']);
		expect(view.target.querySelector('#hgh-toggle-water')?.textContent).toContain('水やり済み');
	});

	test('モバイルでもdaily非表示なら選択済みの独立カードを残し、不要な日次やToDoを取得しない', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'mood', hidden: false }, { id: 'reading', hidden: false }], [], true, undefined, [], { width: 390 });
		await settle();
		expect(view.target.querySelector('.hgh')?.getAttribute('data-inline-records')).toBe('false');
		expect(view.target.querySelector('.hgh-card-daily')).toBeNull();
		expect(view.target.querySelector('.hgh-card-mood')).not.toBeNull();
		expect(view.target.querySelector('.hgh-card-reading')).not.toBeNull();
		button(view.target, '.hgh-mood-choices button').click(); button(view.target, '.hgh-reading-action').click();
		expect(view.moods).toEqual([1]); expect(view.readings).toEqual(['book-1']);
		expect(loaders.journal).toHaveBeenCalledTimes(1); expect(loaders.reading).toHaveBeenCalledTimes(1);
		expect(loaders.daily).not.toHaveBeenCalled(); expect(loaders.planner).not.toHaveBeenCalled(); expect(loaders.flower).not.toHaveBeenCalled();
	});

	test('幅変更では新しく必要になった入力データだけを取得し、日次と花を再取得しない', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }]); await settle();
		expect(loaders.daily).toHaveBeenCalledTimes(1); expect(loaders.flower).toHaveBeenCalledTimes(1);
		expect(loaders.planner).not.toHaveBeenCalled(); expect(loaders.journal).not.toHaveBeenCalled(); expect(loaders.reading).not.toHaveBeenCalled();
		view.resize(390); await settle();
		expect(view.target.querySelectorAll('.hgh-ritual-row')).toHaveLength(5);
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(1);
		view.resize(480); await settle(); view.resize(1000); await settle();
		expect(view.target.querySelector('.hgh-daily-ring')).not.toBeNull();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(1);
	});

	test('ハロウィンでも日次記録のおはなは育成中の花と花しずくを表示する', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390, halloween: true });
		await settle();
		button(view.target, '#hgh-toggle-water').click(); await settle();
		const panel = view.target.querySelector('#hgh-panel-water')!;
		expect(panel.querySelector('[data-hatask-emoji]')?.getAttribute('data-hatask-emoji')).toBe('🌼');
		expect(panel.querySelector('.hgh-inline-copy strong')?.textContent).toBe('ヒナギク · 成長 72%');
		expect(panel.querySelector('.hgh-inline-copy small')?.textContent).toBe('花しずく 2個 · 1回で0.5時間育ちます');
		expect(button(view.target, '#hgh-toggle-water').textContent).toContain('花しずく 2個');
		const flower = button(panel, '.hgh-inline-flower');
		expect(flower.getAttribute('aria-label')).toBe('ヒナギクを開く');
		flower.click();
		expect(view.navigated).toEqual(['/hatask?tab=garden']);
		expect(view.target.querySelector('.hgh-lantern.ti-pumpkin-scary')).not.toBeNull();
	});

	test('ハロウィンでも独立おはなカードはPCとモバイルで育成中の花と花しずくを表示する', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'flower', hidden: false }], [], true, undefined, [], { width: 390, halloween: true });
		await settle();
		for (const width of [390, 1000]) {
			view.resize(width); await settle();
			const flower = button(view.target, '.hgh-card-flower .hgh-tile-body');
			expect(flower.querySelector('[data-hatask-emoji]')?.getAttribute('data-hatask-emoji')).toBe('🌼');
			expect(flower.querySelector('strong')?.textContent).toBe('ヒナギク');
			expect(flower.querySelector('small')?.textContent).toBe('成長 72% · 花しずく 2個');
			expect(flower.textContent).toContain('ヒナギク');
			expect(flower.querySelector('.hgh-sr-only')?.textContent).toBe('を開く');
			expect(view.target.querySelector('.hgh-water-explain')?.textContent).toBe('1回で花しずく1個を使い、0.5時間育ちます');
			flower.click();
		}
		expect(view.navigated).toEqual(['/hatask?tab=garden', '/hatask?tab=garden']);
	});

	test('同じデータを使うPCとモバイルの切替では取得を増やさない', async () => {
		prepareInlineSources();
		const view = mount(['daily', 'flower', 'todo', 'mood', 'meal', 'reading'].map(id => ({ id, hidden: false }))); await settle();
		view.resize(390); await settle(); view.resize(1000); await settle(); view.resize(390); await settle();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(1);
	});

	test('非表示中の変更は取得せず、モバイルホームへの復帰時に各データを一度だけ更新する', async () => {
		prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], [], false, undefined, [], { width: 390 }); await settle();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).not.toHaveBeenCalled();
		view.active.value = true; await settle();
		view.active.value = false; view.revision.value += 2; await settle();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(1);
		view.active.value = true; await settle();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(2);
	});

	test('日付が変われば日次と入力データを更新し、前日の水やり完了を翌日に持ち越さない', async () => {
		vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 50)); prepareInlineSources();
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, [], { width: 390 }); await settle();
		view.home.value?.markWatered('2026-10-03'); await settle();
		expect(button(view.target, '#hgh-panel-water .hgh-inline-action').disabled).toBe(true);
		loaders.daily.mockResolvedValue({ today: '2026-10-04', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-04', known: true, completed: [], count: 0, complete: false }], streakDays: 0 });
		await vi.advanceTimersByTimeAsync(30000); await settle();
		for (const source of [loaders.daily, loaders.flower, loaders.planner, loaders.journal, loaders.reading]) expect(source).toHaveBeenCalledTimes(2);
		button(view.target, '#hgh-toggle-water').click(); await settle();
		expect(button(view.target, '#hgh-panel-water .hgh-inline-action').disabled).toBe(false);
		button(view.target, '#hgh-panel-water .hgh-inline-action').click(); expect(view.waters).toEqual(['2026-10-04']);
	});

	test('renders ranked launcher entries in the mock desktop and mobile slots and emits catalog IDs', () => {
		const launcherApps: HatagoesCatalogEntry[] = Array.from({ length: 14 }, (_, index) => ({ id: `hatask.screen-${index}`, app: 'hatask', label: `画面${index}`, icon: 'ti ti-apps', path: '/hatask' }));
		const view = mount([{ id: 'daily', hidden: false }], [], true, undefined, launcherApps);
		const desktop = view.target.querySelector('.hgh-launcher-desktop')!;
		const mobile = view.target.querySelector('.hgh-launcher-mobile')!;
		expect([...desktop.querySelectorAll('.hgh-launcher-app')]).toHaveLength(12);
		expect([...mobile.querySelectorAll('.hgh-launcher-app')]).toHaveLength(8);
		expect(desktop.querySelector('.hgh-launcher-app')?.textContent).toContain('画面0');
		expect(mobile.querySelectorAll('.hgh-launcher-app')[6]?.textContent).toContain('画面6');
		expect(mobile.querySelectorAll('.hgh-launcher-app')[7]?.textContent).toContain('すべて');
		expect(desktop.nextElementSibling?.classList.contains('hgh-card-daily')).toBe(true);
		expect(mobile.previousElementSibling?.classList.contains('hgh-card-daily')).toBe(true);
		(mobile.querySelector('.hgh-launcher-app') as HTMLButtonElement).click();
		expect(view.openedApps).toEqual(['hatask.screen-0']);
		(mobile.querySelector('.hgh-launcher-app-all') as HTMLButtonElement).click();
		(desktop.querySelector('.hgh-launcher-all') as HTMLButtonElement).click();
		expect(view.allApps).toHaveBeenCalledTimes(2);
	});

	test('places the mobile launcher first when the daily card is hidden', () => {
		const view = mount([]);
		expect(view.target.querySelector('.hgh-card-daily')).toBeNull();
		expect((view.target.querySelector('.hgh-launcher-mobile') as HTMLElement).style.order).toBe('-1');
	});
	test('keeps the default narrow flower and reading pair together', () => {
		const view = mount([{ id: 'flower', hidden: false }, { id: 'reading', hidden: false }]);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-mobile-half-pair')).toBe(true);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-tablet-half-pair')).toBe(true);
	});

	test('expands a lone flower card instead of leaving a half-width gap', () => {
		const view = mount([{ id: 'flower', hidden: false }]);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-mobile-half-pair')).toBe(false);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-tablet-half-pair')).toBe(false);
	});

	test('keeps adjacent flower and reading cards paired in a custom order', () => {
		const order: HatagoesCardV3Id[] = ['daily', 'schedule', 'flower', 'reading', 'todo', 'mood', 'meal', 'issues'];
		const view = mount([{ id: 'flower', hidden: false }, { id: 'reading', hidden: false }], [], true, order);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-tablet-half-pair')).toBe(true);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-mobile-half-pair')).toBe(true);
	});

	test('expands flower and reading when another mobile card separates them', () => {
		const order: HatagoesCardV3Id[] = ['daily', 'schedule', 'flower', 'mood', 'reading', 'todo', 'meal', 'issues'];
		const view = mount([{ id: 'flower', hidden: false }, { id: 'mood', hidden: false }, { id: 'reading', hidden: false }], [], true, order);
		expect(view.target.querySelector('.hgh')?.classList.contains('hgh-mobile-half-pair')).toBe(false);
	});
	test('only renders visible cards and emits the requested ToDo toggle without writing', async () => {
		loaders.planner.mockResolvedValue({ schedule: { rows: [] }, todo: { rows: [{ id: 'todo-1', title: '手紙を出す', path: '/hatask?tab=todo&hgKind=todo&hgId=todo-1', priority: 'high' }], total: 1 } });
		const view = mount([{ id: 'schedule', hidden: true }, { id: 'todo', hidden: false }]);
		await settle();
		expect(view.target.querySelector('.hgh-card-schedule')).toBeNull();
		expect(view.target.textContent).toContain('手紙を出す');
		const check = view.target.querySelector('.hgh-check') as HTMLButtonElement;
		check.click();
		expect(view.toggled).toEqual(['todo-1']);
		expect(loaders.planner).toHaveBeenCalledTimes(1);
	});

	test('keeps a failed flower source separate and retries it', async () => {
		loaders.flower.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ rows: [], flower: { emoji: '🌼', name: '花', progress: 72, drops: 2, canWater: true, harvestedCount: 2 } });
		const view = mount([{ id: 'flower', hidden: false }]);
		await settle();
		expect(view.target.textContent).toContain('読み込めませんでした');
		const retry = [...view.target.querySelectorAll('button')].find(button => button.textContent.includes('再試行'));
		expect(retry).toBeDefined();
		retry?.click();
		await settle();
		expect(view.target.textContent).toContain('成長 72%');
		expect(view.target.querySelector('.hgh-harvested')?.textContent).toContain('2');
		expect(loaders.flower).toHaveBeenCalledTimes(2);
	});

	test('refreshes once on return to home after changes while hidden', async () => {
		loaders.flower.mockResolvedValueOnce({ rows: [], flower: { emoji: '🌼', name: '最初の花', progress: 20, drops: 1, canWater: false } })
			.mockResolvedValueOnce({ rows: [], flower: { emoji: '🌷', name: '新しい花', progress: 60, drops: 2, canWater: true } });
		const view = mount([{ id: 'flower', hidden: false }]);
		await settle();
		expect(view.target.textContent).toContain('最初の花');
		view.active.value = false;
		view.revision.value += 1;
		view.revision.value += 1;
		await settle();
		expect(loaders.flower).toHaveBeenCalledTimes(1);
		view.active.value = true;
		await settle();
		expect(loaders.flower).toHaveBeenCalledTimes(2);
		expect(view.target.textContent).toContain('新しい花');
	});

	test('shows the next event once and keeps the compact flower tile navigable', async () => {
		loaders.planner.mockResolvedValue({ schedule: { rows: [{ id: 'e1', title: '図書館へ', path: '/event/e1', detail: '今日 · 16:30' }], nextEvent: { id: 'e1', title: '図書館へ', path: '/event/e1', date: '2026-10-02', timeStart: '16:30', allDay: false } }, todo: { rows: [] } });
		loaders.flower.mockResolvedValue({ rows: [], flower: { emoji: '🌼', name: '花', progress: 72, drops: 2, canWater: true, pourMinutes: 120 } });
		const view = mount([{ id: 'schedule', hidden: false }, { id: 'flower', hidden: false }]);
		await settle();
		expect(view.target.textContent).toContain('1回で花しずく1個を使い、2時間育ちます');
		expect(view.target.textContent?.match(/図書館へ/g)).toHaveLength(1);
		expect(view.target.textContent).not.toContain('今後30日の予定はありません');
		(view.target.querySelector('.hgh-card-flower .hgh-tile-body') as HTMLButtonElement).click();
		expect(view.navigated).toEqual(['/hatask?tab=garden']);
	});

	test('shows the date of a future timed event', async () => {
		loaders.planner.mockResolvedValue({ schedule: { rows: [], nextEvent: { id: 'e2', title: '通院', path: '/event/e2', date: '2099-11-03', timeStart: '09:00', allDay: false } }, todo: { rows: [] } });
		const view = mount([{ id: 'schedule', hidden: false }]);
		await settle();
		expect(view.target.querySelector('.hgh-kicker')?.textContent).toContain('2099-11-03 · 09:00');
	});

	test('keeps tile status in accessible button text and direct record actions visible', async () => {
		loaders.flower.mockResolvedValue({ rows: [], flower: { emoji: '🌼', name: 'ヒナギク', progress: 72, drops: 2, canWater: true } });
		loaders.journal.mockResolvedValue({ today: '2026-10-03', mood: { id: 'm1', date: '2026-10-03', time: '07:40', level: 4, emoji: '😊', note: 'いい感じ' }, week: [], meals: [{ slot: 'breakfast', entry: { id: 'e1', date: '2026-10-03', time: '08:10', level: 'cooked', note: '朝ごはん' } }] });
		const view = mount([{ id: 'flower', hidden: false }, { id: 'mood', hidden: false }, { id: 'meal', hidden: false }]);
		await settle();
		expect(view.target.querySelector('.hgh-card-flower .hgh-tile-body')?.textContent).toContain('72%');
		expect(view.target.querySelector('.hgh-card-mood')?.textContent).toContain('いい感じ');
		expect(view.target.querySelector('.hgh-card-meal')?.textContent).toContain('朝ごはん');
		expect(view.target.querySelectorAll('.hgh-mood-choices button')).toHaveLength(5);
		(view.target.querySelector('.hgh-mood-choices button:nth-child(4)') as HTMLButtonElement).click();
		(view.target.querySelector('.hgh-meal-choices button') as HTMLButtonElement).click();
		(view.target.querySelector('.hgh-water-action') as HTMLButtonElement).click();
		expect(view.moods).toEqual([4]);
		expect(view.meals).toEqual(['breakfast']);
		expect(view.waters).toEqual(['2026-10-03']);
	});

	test('flower water waits for the hidden daily summary and stays completed through a stale refresh', async () => {
		let resolveDaily!: (value: unknown) => void;
		loaders.daily.mockReturnValueOnce(new Promise(resolve => { resolveDaily = resolve; }));
		loaders.flower.mockResolvedValue({ rows: [], flower: { emoji: '🌼', name: '花', progress: 72, drops: 2, canWater: true, pourMinutes: 30, harvestedCount: 0 } });
		const view = mount([{ id: 'flower', hidden: false }, { id: 'daily', hidden: true }]);
		await settle();
		expect(view.target.querySelector('.hgh-water-action')).toBeNull();
		resolveDaily({ today: '2026-10-03', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-03', known: true, completed: [], count: 0, complete: false }], streakDays: 0 });
		await settle();
		const button = view.target.querySelector('.hgh-water-action') as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		expect(view.target.textContent).toContain('1回で花しずく1個を使い、0.5時間育ちます');
		button.click();
		view.home.value?.markWatered('2026-10-03');
		await settle();
		expect(view.waters).toEqual(['2026-10-03']);
		expect(button.disabled).toBe(true);
		expect(button.textContent).toContain('きょうは水やり済み');
		button.click();
		view.revision.value++;
		await settle();
		expect(view.waters).toEqual(['2026-10-03']);
		expect((view.target.querySelector('.hgh-water-action') as HTMLButtonElement).disabled).toBe(true);
	});

	test('an already completed daily water ritual disables both Home entry points', async () => {
		loaders.daily.mockResolvedValue({ today: '2026-10-03', timezone: 'Asia/Tokyo', days: [{ date: '2026-10-03', known: true, completed: ['water'], count: 1, complete: false }], streakDays: 0 });
		loaders.flower.mockResolvedValue({ rows: [], flower: { emoji: '🌼', name: '花', progress: 72, drops: 2, canWater: true, harvestedCount: 0 } });
		const view = mount([{ id: 'daily', hidden: false }, { id: 'flower', hidden: false }]);
		await settle();
		const action = view.target.querySelector('.hgh-water-action') as HTMLButtonElement;
		const ritual = [...view.target.querySelectorAll('.hgh-rituals button')].find(button => button.textContent.includes('水やり')) as HTMLButtonElement;
		expect(action.textContent).toContain('きょうは水やり済み');
		expect(action.disabled).toBe(true);
		expect(ritual.disabled).toBe(true);
		action.click(); ritual.click();
		expect(view.waters).toEqual([]);
	});

	test('shows measured daily progress and an unknown day separately, then refreshes on revision', async () => {
		loaders.daily.mockResolvedValueOnce({ today: '2026-10-03', timezone: 'Asia/Tokyo', trackedSince: '2026-10-02', days: [{ date: '2026-10-02', known: false, completed: [], count: 0, complete: false }, { date: '2026-10-03', known: true, completed: ['mood', 'meal'], count: 2, complete: false }], streakDays: 0, awardedToday: 4 })
			.mockResolvedValueOnce({ today: '2026-10-03', timezone: 'Asia/Tokyo', trackedSince: '2026-10-02', days: [{ date: '2026-10-02', known: false, completed: [], count: 0, complete: false }, { date: '2026-10-03', known: true, completed: ['mood', 'meal', 'todo'], count: 3, complete: false }], streakDays: 0, awardedToday: 6 });
		const view = mount([{ id: 'daily', hidden: false }]);
		await settle();
		expect(view.target.querySelector('.hgh-daily-ring')?.textContent).toContain('2/5');
		expect(view.target.querySelector('.hgh-heat-days .is-unknown')).not.toBeNull();
		view.revision.value += 1;
		await settle();
		expect(view.target.querySelector('.hgh-daily-ring')?.textContent).toContain('3/5');
	});

	test('loads journal once for mood and meal and shows today records in both cards', async () => {
		loaders.journal.mockResolvedValue({ today: '2026-10-03', week: [], mood: { id: 'm', date: '2026-10-03', time: '08:00', level: 4, note: 'ゆっくり料理できた' }, meals: [{ slot: 'lunch', entry: { id: 'e', date: '2026-10-03', time: '12:00', level: 'cooked', note: 'カレーを作った' } }] });
		const view = mount([{ id: 'mood', hidden: false }, { id: 'meal', hidden: false }]);
		await settle();
		expect(loaders.journal).toHaveBeenCalledTimes(1);
		expect(view.target.querySelector('.hgh-card-meal')?.textContent).toContain('カレーを作った');
		expect(view.target.querySelector('.hgh-card-mood')?.textContent).toContain('ゆっくり料理できた');
	});

	test('renders the reading book through its stored cover color and author', async () => {
		loaders.reading.mockResolvedValue({ rows: [{ id: 'book-1', title: '夜を編む庭', author: '著者', coverColorIndex: 3, currentPage: 184, totalPages: 312, path: '/hatady?tab=collection&hgKind=book&hgId=book-1' }] });
		const view = mount([{ id: 'reading', hidden: false }]);
		await settle();
		const cover = view.target.querySelector('[data-book-cover]');
		expect(cover?.getAttribute('data-book-cover')).toBe('夜を編む庭');
		expect(cover?.getAttribute('data-author')).toBe('著者');
		expect(cover?.getAttribute('data-color-index')).toBe('3');
		expect(cover?.getAttribute('data-width')).toBe('58');
	});
});
