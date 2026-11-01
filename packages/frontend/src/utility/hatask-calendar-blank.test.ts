/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isSharedHataskEvent, hataskEventVisibilityLabel } from './hatask-event-audience.js';
import type { HataskCalendarBlankTarget } from '@/components/hatask/hatask-planner-types.js';
import type { HataskCalendarBlankEvent } from '@/components/hatask/HataskCalendarBlankDialog.vue';
import type { HataskPlannerEvent } from '@/utility/hatask-planner-storage.js';

// Execute the real parent handlers with isolated storage; never call the live API.
const filename = resolve(process.cwd(), 'src/pages/hatask.vue');
const page = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
if (!page.scriptSetup) throw new Error('Missing Hatask script');
const script = ts.createSourceFile('hatask.ts', page.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function fn(name: string): string {
	const statement = script.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
	if (!statement) throw new Error(`Missing function ${name}`);
	return statement.getText(script);
}

function declaration(name: string): string {
	for (const statement of script.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const node = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (node) return `const ${node.getText(script)};`;
	}
	throw new Error(`Missing variable ${name}`);
}

function iso(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function source(overrides: Partial<HataskPlannerEvent> = {}): HataskPlannerEvent {
	return { id: 'source', title: '打ち合わせ', emoji: '⭐', color: '#e27d60', date: '2026-09-01', dateEnd: '2026-09-01', timeStart: '10:00', timeEnd: '11:00', allDay: false, visibility: 'private', rsvp: false, notify: true, notifyTimings: ['15分前', '30分前'], recurrence: { frequency: 'none', interval: 1 }, archivedAt: null, ...overrides };
}

function draft() {
	return { title: '', emoji: '⭐', color: '#e27d60', date: '2026-09-01', dateEnd: '2026-09-01', timeStart: '14:00', timeEnd: '15:00', allDay: false, visibility: 'private', rsvp: false, notify: true, notifyTimings: ['15分前', '30分前'], recurrence: { frequency: 'none', interval: 1 } };
}

type Runtime = {
	openBlankCalendarActions: (target: HataskCalendarBlankTarget) => void;
	closeBlankCalendarActions: () => void;
	createBlankCalendarEvent: () => Promise<void>;
	confirmBlankCalendarReschedule: (id: string, mode: 'copy' | 'move') => Promise<void>;
	getBlankCalendarAnchor: () => HTMLElement | null;
	getBlankCalendarAnchorRect: (anchor: HTMLElement) => { left: number; right: number; top: number; bottom: number };
	candidates: HataskCalendarBlankEvent[];
};
const roots: HTMLElement[] = [];
afterEach(() => { roots.splice(0).forEach(root => root.remove()); vi.restoreAllMocks(); });

function fixture(initial = [source()], positiveControl = false) {
	const root = window.document.createElement('div');
	root.innerHTML = '<section data-hatask-component="calendar"><article data-date="2026-09-06"><header><button>6日</button></header><div data-time-canvas></div></article></section>';
	window.document.body.append(root); roots.push(root);
	const anchor = root.querySelector<HTMLElement>('[data-time-canvas]');
	const dayButton = root.querySelector('button');
	if (!anchor || !dayButton) throw new Error('Calendar fixture is incomplete');
	const target: HataskCalendarBlankTarget = { day: { key: '2026-09-06', date: '2026-09-06', label: '2026年9月6日', dayNumber: 6, events: [] }, anchor, time: '23:45', point: { x: 0.5, y: 0.75 } };
	const events = { value: initial };
	const allCalendarEvents = { get value() { return events.value.map(event => ({ ...event, sourceEventId: event.id })); } };
	const sharedEvents = { value: [] as { id: string; revision: string }[] };
	const blankCalendarTarget = { value: null as HataskCalendarBlankTarget | null };
	const blankCalendarReturnFocus = { value: null as HTMLElement | null };
	const blankCalendarBusy = { value: false };
	const blankCalendarError = { value: '' };
	const plannerReadOnly = { value: false };
	const activeTab = { value: 'cal' };
	const newEvent = { value: draft() };
	const editingEvent = { value: null as HataskPlannerEvent | null };
	const selectedDateStr = { value: '2026-09-01' };
	const registrySet = vi.fn(async (_key: string, _events: HataskPlannerEvent[]) => {});
	const confirm = vi.fn(async (_options: unknown) => ({ canceled: false }));
	const openEventDetailsModal = vi.fn();
	const closeEventDetail = vi.fn();
	const scheduleEventNotifications = vi.fn();
	const processPublicEventOutbox = vi.fn(async () => {});
	const loadSharedEvents = vi.fn(async () => {});
	const findUniqueOwnedServerId = vi.fn((_event: HataskPlannerEvent): string | null => null);
	const functions = ['openBlankCalendarActions', 'closeBlankCalendarActions', 'getBlankCalendarAnchor', 'getBlankCalendarAnchorRect', 'blankCalendarSource', 'hasBlankCalendarDraft', 'createBlankCalendarEvent', 'confirmBlankCalendarReschedule', 'applyCalendarReschedule', 'eventScheduleAt', 'calendarDayDistance', 'calendarLocalSource', 'findPlannerCalendarSource', 'parseIsoDate', 'clockPlusMinutes', 'resetEventEditor'];
	let code = functions.map(fn).join('\n');
	if (positiveControl) {
		const guard = 'if (!target || plannerReadOnly.value || blankCalendarBusy.value) return;';
		if (!code.includes(guard)) throw new Error('Missing read-only control');
		code = code.replaceAll(guard, 'if (!target || blankCalendarBusy.value) return;');
	}
	code += `\nlet blankCalendarGeneration = 0;\n${declaration('blankCalendarEvents')}\n({ ${functions.join(', ')}, get candidates() { return blankCalendarEvents.value; } });`;
	const runtime = runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
		isSharedHataskEvent, hataskEventVisibilityLabel,
		events, allCalendarEvents, sharedEvents, blankCalendarTarget, blankCalendarReturnFocus, blankCalendarBusy, blankCalendarError,
		plannerReadOnly, activeTab, newEvent, editingEvent, selectedDateStr, rootEl: { value: root },
		showEventDetails: { value: false }, showEventTemplates: { value: false }, eventCaptureEditor: { value: null },
		HTMLButtonElement, HTMLElement, 'window': window, console: { error: vi.fn() },
		computed: <T>(callback: () => T) => ({ get value() { return callback(); } }),
		nextTick: async () => {}, localDateKey: iso, addCalendarDays: (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
		registrySet, os: { confirm, toast: vi.fn() }, dialogs: { confirm }, openEventDetailsModal, closeEventDetail, scheduleEventNotifications, processPublicEventOutbox, loadSharedEvents, findUniqueOwnedServerId,
		setPlannerAnchor: (date: Date) => { selectedDateStr.value = iso(date); },
		plannerCalendarEvent: (event: HataskPlannerEvent) => ({ ...event, draggable: true }),
		blankCalendarScheduleLabel: (event: HataskPlannerEvent) => `${event.date} ${event.timeStart} — ${event.dateEnd} ${event.timeEnd}${event.allDay ? ' 終日' : ''}`,
		generateId: () => 'copy-id',
		plannerCopy: { publicSyncUnlinked: '未連携', publicSyncFailed: '保存に失敗', eventCopied: 'コピーしました', eventMoved: '移動しました', _blankCalendar: { replaceDraft: '入力を破棄しますか？', unavailable: '選び直してください' } },
	}, { timeout: 1000 }) as Runtime;
	return { runtime, target, root, anchor, dayButton, events, blankCalendarTarget, blankCalendarReturnFocus, blankCalendarBusy, blankCalendarError, plannerReadOnly, activeTab, newEvent, editingEvent, registrySet, confirm, openEventDetailsModal, closeEventDetail, scheduleEventNotifications, processPublicEventOutbox, loadSharedEvents, findUniqueOwnedServerId, sharedEvents };
}

describe('カレンダーの空き場所の操作と保存の結線', () => {
	test('入口・Teleport・共通テーマ・フォーカス復帰・離脱時の解除を結線している', () => {
		const template = page.template?.content ?? '';
		expect(template).toContain('@activateBlank="openBlankCalendarActions"');
		const dialog = template.match(/<HataskCalendarBlankDialog[\s\S]*?\/>/)?.[0];
		expect(dialog).toContain('class="htk-event-details-theme"');
		expect(dialog).toContain(':getAnchorRect="getBlankCalendarAnchorRect"');
		expect(dialog).toContain('@focusFallback="focusEventCalendar"');
		expect(template.indexOf('<Teleport to="body">', template.indexOf('</PageWithHeader>'))).toBeLessThan(template.indexOf('<HataskCalendarBlankDialog'));
		expect(fn('cleanupHataskState')).toContain('closeBlankCalendarActions();');
		expect(template).toContain('<label class="htk-fl" for="hatask-event-title-input">');
		expect(template).toMatch(/<input id="hatask-event-title-input"[^>]+v-model="newEvent.title"/);
		expect(fn('openEventDetailsModal')).toContain('focusTitle ? eventDetailsTitleRef.value : eventDetailsCloseRef.value');
	});
	test('空白を開く・閉じるだけでは既存予定と入力中の内容を変えない', () => {
		const current = fixture(); current.newEvent.value.title = '入力中';
		const before = JSON.stringify([current.events.value, current.newEvent.value]);
		current.runtime.openBlankCalendarActions(current.target);
		expect(current.blankCalendarTarget.value).toBe(current.target);
		expect(current.blankCalendarReturnFocus.value).toBe(current.dayButton);
		expect(current.closeEventDetail).toHaveBeenCalledOnce();
		current.runtime.closeBlankCalendarActions();
		expect(JSON.stringify([current.events.value, current.newEvent.value])).toBe(before);
		expect(current.registrySet).not.toHaveBeenCalled();
	});
	test.each(['readOnly', 'busy', 'disabled', 'detached', 'outside', 'otherTab'] as const)('%sでは開かない', guard => {
		const current = fixture();
		if (guard === 'readOnly') current.plannerReadOnly.value = true;
		if (guard === 'busy') current.blankCalendarBusy.value = true;
		if (guard === 'disabled') current.target.day.isDisabled = true;
		if (guard === 'detached') current.anchor.remove();
		if (guard === 'outside') window.document.body.append(current.anchor);
		if (guard === 'otherTab') current.activeTab.value = 'home';
		current.runtime.openBlankCalendarActions(current.target);
		expect(current.blankCalendarTarget.value).toBeNull();
		if (guard === 'outside') current.anchor.remove();
	});
	test('空き時刻の相対座標はscroll・resize後の矩形に追従する', () => {
		const current = fixture(); current.runtime.openBlankCalendarActions(current.target);
		const measure = vi.spyOn(current.anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 200, 400));
		expect(current.runtime.getBlankCalendarAnchor()).toBe(current.anchor);
		expect(current.runtime.getBlankCalendarAnchorRect(current.anchor)).toEqual({ left: 199, right: 201, top: 499, bottom: 501 });
		measure.mockReturnValue(new DOMRect(40, 20, 400, 800));
		expect(current.runtime.getBlankCalendarAnchorRect(current.anchor)).toEqual({ left: 239, right: 241, top: 619, bottom: 621 });
		current.anchor.remove(); expect(current.runtime.getBlankCalendarAnchor()).toBeNull();
	});
	test('日付ボタンは点ではなくボタン矩形を使い、同じボタンへfocusを戻す', () => {
		const current = fixture(); current.target.anchor = current.dayButton; delete current.target.point;
		current.runtime.openBlankCalendarActions(current.target);
		const rect = new DOMRect(10, 20, 150, 44); vi.spyOn(current.dayButton, 'getBoundingClientRect').mockReturnValue(rect);
		expect(current.runtime.getBlankCalendarAnchorRect(current.dayButton)).toBe(rect);
		expect(current.blankCalendarReturnFocus.value).toBe(current.dayButton);
	});
	test('新規作成はクリック時刻を引き継ぎ、23:45から1時間は翌日終了・未保存', async () => {
		const current = fixture(); current.runtime.openBlankCalendarActions(current.target);
		await current.runtime.createBlankCalendarEvent();
		expect(current.newEvent.value).toMatchObject({ date: '2026-09-06', dateEnd: '2026-09-07', timeStart: '23:45', timeEnd: '00:45', title: '' });
		expect(current.openEventDetailsModal).toHaveBeenCalledOnce();
		expect(current.openEventDetailsModal).toHaveBeenCalledWith(true);
		expect(current.registrySet).not.toHaveBeenCalled();
		expect(current.confirm).not.toHaveBeenCalled();
	});
	test('日付のみの新規作成は既存フォームの14:00–15:00を保持', async () => {
		const current = fixture(); delete current.target.time; current.runtime.openBlankCalendarActions(current.target);
		await current.runtime.createBlankCalendarEvent();
		expect(current.newEvent.value).toMatchObject({ date: '2026-09-06', dateEnd: '2026-09-06', timeStart: '14:00', timeEnd: '15:00' });
	});
	test.each(['title', 'editing', 'metadata', 'time', 'date', 'dateEnd'] as const)('%s入力の破棄を断ると元の入力と予定を維持', async kind => {
		const current = fixture();
		if (kind === 'title') current.newEvent.value.title = '入力中';
		if (kind === 'editing') current.editingEvent.value = source();
		if (kind === 'metadata') current.newEvent.value.emoji = '🍱';
		if (kind === 'time') current.newEvent.value.timeStart = '17:00';
		if (kind === 'date') current.newEvent.value.date = '2026-09-03';
		if (kind === 'dateEnd') current.newEvent.value.dateEnd = '2026-09-03';
		const before = JSON.stringify([current.events.value, current.newEvent.value, current.editingEvent.value]);
		current.confirm.mockResolvedValue({ canceled: true }); current.runtime.openBlankCalendarActions(current.target);
		await current.runtime.createBlankCalendarEvent();
		expect(current.confirm).toHaveBeenCalledOnce();
		expect(JSON.stringify([current.events.value, current.newEvent.value, current.editingEvent.value])).toBe(before);
		expect(current.openEventDetailsModal).not.toHaveBeenCalled();
	});
	test('破棄確認中にHataskを離れたら新規フォームを開かない', async () => {
		const current = fixture(); current.newEvent.value.title = '残す';
		current.confirm.mockImplementation(async () => { current.runtime.closeBlankCalendarActions(); return { canceled: false }; });
		current.runtime.openBlankCalendarActions(current.target); await current.runtime.createBlankCalendarEvent();
		expect(current.newEvent.value.title).toBe('残す'); expect(current.openEventDetailsModal).not.toHaveBeenCalled();
	});
	test('自分の非繰り返し予定のみ候補にし、同じ日時への移動を除外', () => {
		const current = fixture([source(), source({ id: 'repeat', recurrence: { frequency: 'weekly', interval: 1 } }), source({ id: 'archived', archivedAt: '2026-09-01' })]);
		current.target.day.date = '2026-09-01'; current.target.time = '10:00'; current.runtime.openBlankCalendarActions(current.target);
		expect(current.runtime.candidates.map(event => event.id)).toEqual(['source']);
		expect(current.runtime.candidates[0]).toMatchObject({ canCopy: true, canMove: false });
	});
	test('コピーは元・draftを保持し、確認後に非公開・出欠なしの別IDとして保存', async () => {
		const original = source({ visibility: 'public', rsvp: true, serverEventId: 'server', serverEventRevision: 'rev' });
		const current = fixture([original]); current.newEvent.value.title = '残す'; current.runtime.openBlankCalendarActions(current.target);
		expect(current.runtime.candidates[0].targetLabel).toContain('2026-09-07 00:45');
		await current.runtime.confirmBlankCalendarReschedule('source', 'copy');
		expect(current.registrySet).toHaveBeenCalledOnce();
		expect(current.events.value).toHaveLength(2); expect(current.events.value[1]).toBe(original);
		expect(current.events.value[0]).toMatchObject({ id: 'copy-id', clientEventId: 'copy-id', date: '2026-09-06', dateEnd: '2026-09-07', timeStart: '23:45', timeEnd: '00:45', visibility: 'private', rsvp: false, serverEventId: undefined, serverEventRevision: undefined });
		expect(current.newEvent.value.title).toBe('残す'); expect(current.blankCalendarTarget.value).toBeNull();
		expect(current.processPublicEventOutbox).not.toHaveBeenCalled();
	});
	test.each([false, true])('移動は同じIDと日をまたぐ長さを保持（終日=%s）', async allDay => {
		const current = fixture([source({ dateEnd: '2026-09-03', allDay, ...(allDay ? { timeStart: '', timeEnd: '' } : {}) })]);
		current.runtime.openBlankCalendarActions(current.target); await current.runtime.confirmBlankCalendarReschedule('source', 'move');
		expect(current.events.value).toHaveLength(1);
		expect(current.events.value[0]).toMatchObject({ id: 'source', date: '2026-09-06', dateEnd: allDay ? '2026-09-08' : '2026-09-09', timeStart: allDay ? '' : '23:45', timeEnd: allDay ? '' : '00:45', allDay });
	});
	test('公開予定の移動は既存のrevision付きoutboxを通す', async () => {
		const current = fixture([source({ visibility: 'public', serverEventId: 'server', serverEventRevision: 'rev' })]);
		current.runtime.openBlankCalendarActions(current.target); await current.runtime.confirmBlankCalendarReschedule('source', 'move');
		expect(current.events.value[0]).toMatchObject({ serverEventId: 'server', serverEventRevision: 'rev', publicSyncState: 'updating' });
		expect(current.processPublicEventOutbox).toHaveBeenCalledOnce(); expect(current.loadSharedEvents).toHaveBeenCalledOnce();
	});
	test('公開予定が未連携なら保存せずポップアップで理由を表示', async () => {
		const current = fixture([source({ visibility: 'public' })]); current.runtime.openBlankCalendarActions(current.target);
		await current.runtime.confirmBlankCalendarReschedule('source', 'move');
		expect(current.registrySet).not.toHaveBeenCalled(); expect(current.blankCalendarError.value).toBe('未連携');
		expect(current.blankCalendarTarget.value).toBe(current.target);
	});
	test.each(['deleting', 'deleting-local', 'updating', 'creating', 'conflict'] as const)('公開予定の%s状態は移動で上書きせず、コピーは可能', async publicSyncState => {
		const current = fixture([source({ visibility: 'public', publicSyncState })]); current.runtime.openBlankCalendarActions(current.target);
		expect(current.runtime.candidates[0]).toMatchObject({ canCopy: true, canMove: false });
		await current.runtime.confirmBlankCalendarReschedule('source', 'move');
		expect(current.registrySet).not.toHaveBeenCalled(); expect(current.events.value[0].publicSyncState).toBe(publicSyncState);
	});
	test('保存失敗は入力・元予定を保持し、再操作できる状態へ戻す', async () => {
		const current = fixture(); const before = JSON.stringify(current.events.value);
		current.registrySet.mockRejectedValue(new Error('CAS conflict')); current.runtime.openBlankCalendarActions(current.target);
		await current.runtime.confirmBlankCalendarReschedule('source', 'copy');
		expect(JSON.stringify(current.events.value)).toBe(before); expect(current.blankCalendarBusy.value).toBe(false);
		expect(current.blankCalendarError.value).toBe('保存に失敗'); expect(current.blankCalendarTarget.value).toBe(current.target);
	});
	test.each(['removed', 'recurrence', 'archived', 'readOnly', 'busy', 'otherTab'] as const)('候補表示後の%s変更を確定直前にも検査', async guard => {
		const current = fixture(); current.runtime.openBlankCalendarActions(current.target);
		if (guard === 'removed') current.events.value = [];
		if (guard === 'recurrence') current.events.value[0].recurrence.frequency = 'daily';
		if (guard === 'archived') current.events.value[0].archivedAt = '2026-09-01';
		if (guard === 'readOnly') current.plannerReadOnly.value = true;
		if (guard === 'busy') current.blankCalendarBusy.value = true;
		if (guard === 'otherTab') current.activeTab.value = 'todo';
		await current.runtime.confirmBlankCalendarReschedule('source', 'copy'); expect(current.registrySet).not.toHaveBeenCalled();
	});
	test('連打しても保存は1回だけで、保存中の終了後に別popupを復活させない', async () => {
		const current = fixture(); let finish!: () => void;
		current.registrySet.mockImplementation(() => new Promise<void>(resolveSave => { finish = resolveSave; }));
		current.runtime.openBlankCalendarActions(current.target);
		const saving = current.runtime.confirmBlankCalendarReschedule('source', 'copy');
		await current.runtime.confirmBlankCalendarReschedule('source', 'copy'); current.runtime.closeBlankCalendarActions();
		current.runtime.openBlankCalendarActions(current.target); finish(); await saving;
		expect(current.registrySet).toHaveBeenCalledOnce(); expect(current.blankCalendarTarget.value).toBeNull();
	});
	test('陽性対照: readOnlyガードを除去すると保存禁止の回帰を検出する', async () => {
		const current = fixture([source()], true); current.runtime.openBlankCalendarActions(current.target); current.plannerReadOnly.value = true;
		await current.runtime.confirmBlankCalendarReschedule('source', 'copy');
		expect(current.registrySet).toHaveBeenCalledOnce();
	});
});
