/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, test, vi } from 'vitest';
import { akatsukiDateKey, buildHataskAkatsukiModel } from './hatask-akatsuki.js';
import type { HataskAkatsukiSource } from './hatask-akatsuki.js';

vi.mock('@/i18n.js', async () => ({ i18n: (await import('./hatask-test-i18n.js')).createTestHataskI18n() }));

function fixture(patch: Partial<HataskAkatsukiSource> = {}): HataskAkatsukiSource {
	return {
		now: new Date(2026, 8, 4, 13, 24), locale: 'ja-JP', loading: false,
		known: { planner: true, moods: true, meals: true, flower: true }, readOnly: false,
		events: [
			{ id: 'past', title: '午前の用事', date: '2026-09-04', timeStart: '09:00', timeEnd: '10:00' },
			{ id: 'next', title: 'レビュー', date: '2026-09-04', timeStart: '14:00', timeEnd: '15:00' },
			{ id: 'tomorrow', title: '買い物', date: '2026-09-05', timeStart: '10:00' },
		],
		todos: [{ id: 'remaining', text: '資料を読む', done: false, due: '2026-09-04' }, { id: 'done', text: '送信', done: true }, { id: 'archived', text: '保管済み', done: false, archivedAt: '2026-09-01' }],
		moods: [{ id: 'm1', date: '2026-09-04', time: '08:00', level: 3 }, { id: 'm2', date: '2026-09-04', time: '12:00', level: 4 }],
		meals: [{ id: 'meal1', date: '2026-09-04', time: '08:00', slot: 'breakfast', level: 'ate', note: 'パン' }],
		flower: { name: 'わかば', emoji: '🌱', progress: 50, remaining: '4時間' },
		loginDays: 12, loginRanking: 3, eyePhrase: 'ひと休みしよう', feedbackUnread: 2, settings: {},
		...patch,
	};
}

describe('暁の実データ表示モデル', () => {
	test('保存済みのお気に入りを順序どおり復元し、予定・ToDo・食事・花の記録を変更しない', () => {
		const source = fixture({ settings: { akatsukiHomeFavorites: ['flower', 'todo', 'calendar'] } });
		const before = JSON.stringify(source);
		const { model } = buildHataskAkatsukiModel(source);
		expect(model.home?.favorites).toEqual(['flower', 'todo']);
		expect(model.flower?.name).toBe('わかば');
		expect(model.todos?.map(todo => todo.id)).toEqual(['remaining']);
		expect(JSON.stringify(source)).toBe(before);
	});

	test.each([0, 1, 14 * 24 * 60 * 60 * 1000])('参加から%sミリ秒ではログイン日数にかかわらずHataIntroをおすすめする', age => {
		const source = fixture({ loginDays: 999 });
		source.accountCreatedAt = new Date(source.now.getTime() - age).toISOString();
		const before = JSON.stringify(source);
		const { model } = buildHataskAkatsukiModel(source);
		expect(model.home?.recommended).toBe('intro');
		expect(model.home?.sections.find(section => section.id === 'intro')).toMatchObject({ label: 'HataIntro', icon: 'ti ti-book' });
		expect(model.next?.id).toBe('next');
		expect(JSON.stringify(source)).toBe(before);
	});

	test('14日ちょうどの1ミリ秒後に通常おすすめへ戻り、ログイン初日でも古いアカウントを対象にしない', () => {
		const source = fixture({ loginDays: 1 });
		source.accountCreatedAt = new Date(source.now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('intro');
		source.now = new Date(source.now.getTime() + 1);
		const { home } = buildHataskAkatsukiModel(source).model;
		expect(home?.recommended).toBe('calendar');
		expect(home?.sections.some(section => section.id === 'intro')).toBe(false);
		source.accountCreatedAt = '2025-09-04T00:00:00.000Z';
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('calendar');
	});

	test.each([undefined, null, '', 'not-a-date', '2026-99-99T00:00:00.000Z'])('参加日時%sが分からない場合は新規参加と推測しない', accountCreatedAt => {
		const { home } = buildHataskAkatsukiModel(fixture({ accountCreatedAt, loginDays: 0 })).model;
		expect(home?.recommended).toBe('calendar');
		expect(home?.sections.some(section => section.id === 'intro')).toBe(false);
	});

	test('未来の参加日時は対象外とし、タイムゾーン表記が違っても同じ参加時刻なら同じ判定をする', () => {
		const source = fixture({ now: new Date('2026-09-10T12:00:00.000Z') });
		source.accountCreatedAt = '2026-09-10T12:00:00.001Z';
		expect(buildHataskAkatsukiModel(source).model.home?.sections.some(section => section.id === 'intro')).toBe(false);
		for (const createdAt of ['2026-08-27T12:00:00.000Z', '2026-08-27T21:00:00.000+09:00']) {
			source.accountCreatedAt = createdAt;
			expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('intro');
		}
	});

	test('新規参加案内のために記録の表示設定や権限を変更しない', () => {
		const source = fixture({ loading: true, readOnly: true, feedback: { allowed: false, known: false }, settings: { showEvents: false, showMealSection: false } });
		source.accountCreatedAt = source.now.toISOString();
		const { model } = buildHataskAkatsukiModel(source);
		expect(model.home?.recommended).toBe('intro');
		expect(model.home?.sections.map(section => section.id)).toEqual(['tools', 'intro', 'todo']);
		expect(model.readOnly).toBe(true);
		expect(model.showEvents).toBe(false);
	});

	test('近い予定・締切・未読・食事の時間帯の順で状況に合う内容を選ぶ', () => {
		const source = fixture({ feedback: { allowed: true, known: true }, todos: [{ id: 'due', text: '提出', done: false, due: '2026-09-03' }] });
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('calendar');
		source.events = [];
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('todo');
		source.todos = [];
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('feedback');
		source.feedbackUnread = 0;
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('meal');
		source.meals = [...source.meals, { id: 'lunch', date: '2026-09-04', slot: 'lunch', note: '食べた' }];
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('tools');
	});

	test('午前に夕食を勧めず、記録済みの時間帯の食事も催促しない', () => {
		const source = fixture({ now: new Date(2026, 8, 4, 8), events: [], todos: [] });
		expect(buildHataskAkatsukiModel(source).model.home?.recommended).toBe('tools');
		source.meals = [];
		expect(buildHataskAkatsukiModel(source).model.home?.sections.find(section => section.id === 'meal')?.reason).toBe('朝ごはんの記録');
	});

	test('権限・非表示設定・読込失敗を優先表示でも守る', () => {
		const source = fixture({ known: { planner: false, meals: false, moods: true, flower: true }, feedback: { allowed: false, known: true } });
		const { home } = buildHataskAkatsukiModel(source).model;
		expect(home?.recommended).toBe('tools');
		expect(home?.sections.find(section => section.id === 'feedback')).toBeUndefined();
		expect(home?.sections.find(section => section.id === 'todo')?.summary).toContain('読み込めません');
		source.settings = { showEvents: false, showFeedbackNotif: false, showMealSection: false };
		source.feedback = { allowed: true, known: true };
		expect(buildHataskAkatsukiModel(source).model.home?.sections.map(section => section.id)).toEqual(['tools', 'todo']);
	});

	test('終日予定に隠れていた直近の時刻付き予定を先頭にする', () => {
		const source = fixture();
		source.events = [{ id: 'all', title: '記念日', date: '2026-09-04', allDay: true }, ...source.events];
		const { model } = buildHataskAkatsukiModel(source);
		expect(model.next?.id).toBe('next');
		expect(model.later?.map(event => event.id)).toContain('all');
	});

	test('使ったツールを頻度と最近の利用で並べ、元の一覧を変更しない', () => {
		const source = fixture({ apps: [{ id: 'cal', label: 'カレンダー', icon: 'ti ti-calendar' }, { id: 'drawing', label: 'お絵描き', icon: 'ti ti-brush' }], usage: { drawing: { score: 3, lastUsedAt: new Date(2026, 8, 4, 12).getTime() } } });
		expect(buildHataskAkatsukiModel(source).model.apps?.[0].id).toBe('drawing');
		expect(buildHataskAkatsukiModel(source).model.home?.hasUsage).toBe(true);
		expect(source.apps?.[0].id).toBe('cal');
	});

	test('過ぎた予定をつぎの一件にしないが、今日の時間帯には残す', () => {
		const { model, counts } = buildHataskAkatsukiModel(fixture());
		expect(model.next?.id).toBe('next');
		expect(model.later?.map(event => event.id)).toEqual(['tomorrow']);
		expect(model.later?.[0].timeLabel).toBe('2026-09-05 10:00');
		expect(model.timeline?.map(event => event.id)).toEqual(['past', 'next']);
		expect(counts).toEqual({ calendar: 2, todo: 1, meal: 1, feedback: 2 });
		expect(model.stats?.find(stat => stat.id === 'mood')?.value).toBe(1);
		expect(model.todos?.map(todo => todo.id)).toEqual(['remaining']);
	});

	test('跨日の進行中予定と終日予定を残し、保管済み予定は出さない', () => {
		const { model } = buildHataskAkatsukiModel(fixture({
			events: [
				{ id: 'overnight', title: '出張', date: '2026-09-03', dateEnd: '2026-09-05', timeStart: '10:00', timeEnd: '18:00' },
				{ id: 'all-day', title: '記念日', date: '2026-09-04', allDay: true },
				{ id: 'archived', title: '保管', date: '2026-09-04', archivedAt: '2026-09-01' },
			],
		}));
		expect(model.next?.id).toBe('overnight');
		expect(model.timeline?.map(event => event.id)).toEqual(['overnight', 'all-day']);
		expect(model.timeline?.[0]).toMatchObject({ startMinute: 0, endMinute: 1440 });
		expect(model.timeline?.[1].startMinute).toBeUndefined();
	});

	test('読込失敗を0件と扱わず、別々に読み込めた記録は表示する', () => {
		const { model } = buildHataskAkatsukiModel(fixture({ known: { planner: false, moods: true, meals: false, flower: false } }));
		expect(model.summary).toContain('予定・ToDoの記録を読み込めません');
		expect(model.stats?.map(stat => stat.value)).toEqual(['—', '—', 1, '—']);
		expect(model.next).toBeNull();
		expect(model.flower).toBeNull();
		expect(model.meals?.[0].text).toBe('記録を読み込めません');
		expect(model.meals?.[0].unavailable).toBe(true);
	});

	test('空データに架空の予定や連続ログイン、花の水やりを補わない', () => {
		const { model } = buildHataskAkatsukiModel(fixture({ events: [], todos: [], moods: [], meals: [] }));
		expect(model.next).toBeNull();
		expect(model.todos).toEqual([]);
		expect(model.flower?.detail).toBe('開花まで 4時間');
		expect(model.streakLabel).toBe('ログイン累計 12 日');
		expect(model.eye?.number).toBeUndefined();
		expect(model.mealSummary).toBe('朝・昼・夜ごはんが未記録');
	});

	test('ローカル日付と設定された週初めで、同日の最後のきもちを並べる', () => {
		const { model } = buildHataskAkatsukiModel(fixture({ settings: { weekStart: 'sun' } }));
		expect(model.week?.[0].id).toBe('2026-08-30');
		expect(model.week?.find(day => day.today)).toMatchObject({ id: '2026-09-04', icon: 'ti ti-mood-smile' });
		expect(akatsukiDateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
	});

	test('既存の非表示設定と読取専用を維持する', () => {
		const { model } = buildHataskAkatsukiModel(fixture({ readOnly: true, settings: { showClock: false, showEvents: false, showFlower: false, showMoodSummary: false, showMealSummary: false, showMealSection: false } }));
		expect(model).toMatchObject({ showClock: false, next: null, timeline: [], week: [], meals: [], flower: null });
		expect(model.mealSummary).toBeUndefined();
		expect(model.todos?.[0].readOnly).toBe(true);
	});

	test('並べ替えや集計は保存用配列を変更しない', () => {
		const data = fixture();
		const before = JSON.stringify(data);
		buildHataskAkatsukiModel(data);
		expect(JSON.stringify(data)).toBe(before);
	});
});

describe('暁の親結線', () => {
	const page = readFileSync(resolve(process.cwd(), 'src/pages/hatask.vue'), 'utf8');
	test('現在のログインアカウントの参加日時と既存の時計を表示モデルへ渡す', () => {
		const snapshot = page.match(/const akatsukiSnapshot = computed\(\(\) => buildHataskAkatsukiModel\(\{([\s\S]*?)\n\}\)\);/u)?.[1];
		if (!snapshot) throw new Error('Missing Hatask Akatsuki model connection');
		expect(snapshot).toContain('accountCreatedAt: $i?.createdAt');
		expect(snapshot).toContain('now: akatsukiNow.value');
		expect(snapshot).toContain('loginDays: loginDays.value');
	});

	test('設定の読込中やテーマ欠落時も記録カードは暁になり、保存済みの旧テーマは変えない', () => {
		const body = page.match(/const plannerTheme=computed<HataskPlannerTheme>\(\(\)=>\{([\s\S]*?)\n\}\);/u)?.[1];
		if (!body) throw new Error('Missing planner theme computation');
		for (const theme of [undefined, null, '', 'akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu', 'halloween']) {
			const settings = { value: { theme } };
			const result: unknown = runInNewContext(`(() => {${body}})()`, { settings }, { timeout: 100 });
			expect(result).toBe(theme || 'akatsuki');
			expect(settings.value.theme).toBe(theme);
		}
		const oldBody = body.replace('settings.value.theme || \'akatsuki\'', 'settings.value.theme');
		expect(oldBody).not.toBe(body);
		expect(runInNewContext(`(() => {${oldBody}})()`, { settings: { value: {} } }, { timeout: 100 })).toBe('kisetsu');
	});

	test('保存済みテーマ名を保ち、全テーマで共通ホームを使う', () => {
		expect(page).toContain('theme:\'akatsuki\'');
		expect(page).toContain('theme: \'akatsuki\'');
		expect(page).toContain(':enabled="true"');
		for (const id of ['kisetsu', 'kashin', 'suri', 'hatakyu']) expect(page).toContain('id:\'' + id + '\'');
		expect(page).toContain("{ id: 'koke', jp: i18n.ts._hata._hatask._settings.themeKoke, desc: i18n.ts._hata._hatask._settings.themeKokeDescription }");
		expect(page).toContain('settings.value = { ...defaultSettings, ...settings.value }');
	});
	test('きもち・ごはんの同一インスタンスと既存保存関数を再利用する', () => {
		expect(page).toContain('v-show="activeTab===\'mood\' || captureKind === \'mood\'"');
		expect(page).toContain('v-show="activeTab===\'meal\' || captureKind === \'meal\'"');
		expect(page).toContain('registerCompletedUndo(await toggleTodo(action.id, true))');
		const forbiddenWrite = /(?:localStorage\.setItem|misskeyApi\(['"]i\/registry\/set)/;
		expect(forbiddenWrite.test('localStorage.setItem(\'todos\', \'[]\')')).toBe(true);
		expect(forbiddenWrite.test(readFileSync(resolve(process.cwd(), 'src/utility/hatask-akatsuki.ts'), 'utf8'))).toBe(false);
	});
	test('共通レイアウトではページ送り用の旧スワイプ処理を撤去する', () => {
		expect(page).not.toContain('htkTouchStart');
		expect(page).not.toContain('@touchmove');
		expect(page).toContain('<HataskFlowerStream');
	});
});
