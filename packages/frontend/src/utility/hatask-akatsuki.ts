/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskAkatsukiEvent, HataskAkatsukiHomeSection, HataskAkatsukiModel } from '@/components/hatask/hatask-akatsuki-types.js';
import type { HataskAkatsukiUsage } from '@/utility/hatask-akatsuki-usage.js';
import { i18n } from '@/i18n.js';
import { normalizeHataskAkatsukiMobileTabs } from '@/utility/hatask-akatsuki-navigation.js';
import { normalizeHataskAkatsukiFavorites } from '@/utility/hatask-akatsuki-favorites.js';
import { akatsukiUsageScore } from '@/utility/hatask-akatsuki-usage.js';

type EventRow = { id: string; title: string; date: string; dateEnd?: string; timeStart?: string; timeEnd?: string; allDay?: boolean; archivedAt?: string | null };
type TodoRow = { id: string; text: string; done: boolean; due?: string; time?: string; archivedAt?: string | null };
type MoodRow = { id: string; date: string; time?: string; level: number };
type MealRow = { id: string; date: string; time?: string; slot?: string; note?: string; level?: string };

export interface HataskAkatsukiSource {
	now: Date;
	locale: string;
	loading: boolean;
	known: { planner: boolean; moods: boolean; meals: boolean; flower: boolean };
	readOnly: boolean;
	events: readonly EventRow[];
	todos: readonly TodoRow[];
	moods: readonly MoodRow[];
	meals: readonly MealRow[];
	flower: { name: string; emoji: string; progress: number; remaining: string };
	accountCreatedAt?: string | null;
	loginDays: number;
	loginRanking: number;
	eyePhrase: string;
	feedbackUnread: number;
	feedback?: { allowed: boolean; known: boolean };
	apps?: HataskAkatsukiModel['apps'];
	usage?: HataskAkatsukiUsage;
	settings: { showClock?: boolean; showEvents?: boolean; showFlower?: boolean; showMoodSummary?: boolean; showMealSummary?: boolean; showMealSection?: boolean; showFeedbackNotif?: boolean; weekStart?: string; akatsukiMobileTabs?: unknown; akatsukiShortcut?: unknown; akatsukiHomeFavorites?: unknown };
}

export function akatsukiDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function minute(value?: string): number | undefined {
	if (!value || !/^\d{2}:\d{2}$/.test(value)) return undefined;
	const [hours, minutes] = value.split(':').map(Number);
	return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

/** A read-only projection: never normalize or write the account's source collections here. */
export function buildHataskAkatsukiModel(source: HataskAkatsukiSource): { model: HataskAkatsukiModel; counts: { calendar: number; todo: number; meal: number; feedback: number } } {
	const { now, known, settings } = source;
	const copy = i18n.ts._hata._hatask._akatsuki;
	const today = akatsukiDateKey(now);
	const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() - (settings.weekStart === 'sun' ? 0 : 1) + 7) % 7));
	const weekDates = Array.from({ length: 7 }, (_, i) => {
		const day = new Date(weekStart);
		day.setDate(day.getDate() + i);
		return day;
	});
	const keys = weekDates.map(akatsukiDateKey);
	const events = source.events.filter(event => !event.archivedAt);
	const todayEvents = events.filter(event => event.date <= today && (event.dateEnd || event.date) >= today);
	const todos = source.todos.filter(todo => !todo.archivedAt);
	const remainingTodos = todos.filter(todo => !todo.done).sort((a, b) => `${a.due || '9999'}${a.time || '23:59'}`.localeCompare(`${b.due || '9999'}${b.time || '23:59'}`));
	const todayMeals = source.meals.filter(meal => meal.date === today);
	const mealSlots = [{ id: 'breakfast', label: copy.breakfast }, { id: 'lunch', label: copy.lunch }, { id: 'dinner', label: copy.dinner }];
	const mealRows = mealSlots.map(slot => {
		const entry = todayMeals.filter(meal => meal.slot === slot.id).sort((a, b) => (a.time || '').localeCompare(b.time || '')).at(-1);
		return { ...slot, recorded: Boolean(entry), unavailable: !known.meals, text: !known.meals ? copy.recordLoadFailed : entry ? entry.note || (entry.level === 'none' ? copy.noMeal : entry.level === 'little' ? copy.ateLittle : copy.recorded) : copy.notRecorded };
	});
	const missingMeals = mealRows.filter(meal => !meal.recorded);
	const mealSummary = !known.meals ? copy.mealLoadFailed : missingMeals.length ? i18n.tsx._hata._hatask._akatsuki.mealPending({ slots: missingMeals.map(meal => meal.label).join('・') }) : copy.mealsAllRecorded;
	const md = new Intl.DateTimeFormat(source.locale, { month: 'long', day: 'numeric' });
	const weekday = new Intl.DateTimeFormat(source.locale, { weekday: 'long' });
	const shortWeekday = new Intl.DateTimeFormat(source.locale, { weekday: 'short' });
	const eventModel = (event: EventRow): HataskAkatsukiEvent => ({
		id: event.id,
		title: event.title,
		timeLabel: `${event.date === today ? '' : event.date + ' '}${event.allDay ? copy.allDay : event.timeStart || copy.timeUnknown}`,
		meta: `${event.date === today ? copy.today : event.date}${event.dateEnd && event.dateEnd !== event.date ? ` – ${event.dateEnd}` : ''} ・ ${event.allDay ? copy.allDay : [event.timeStart, event.timeEnd].filter(Boolean).join(' – ') || copy.timeUnknown}`,
		startMinute: event.allDay ? undefined : event.date < today ? 0 : minute(event.timeStart),
		endMinute: event.allDay ? undefined : event.dateEnd && event.dateEnd > today ? 1440 : minute(event.timeEnd),
		action: { type: 'open-event', id: event.id },
		buttons: [{ label: copy.openEvent, icon: 'ti ti-calendar-event', primary: true, action: { type: 'open-event', id: event.id } }],
	});
	const time = now.getHours() * 60 + now.getMinutes();
	const upcoming = events.filter(event => {
		const endDate = event.dateEnd || event.date;
		if (endDate < today) return false;
		if (event.date > today || endDate > today || event.allDay) return true;
		const end = minute(event.timeEnd) ?? minute(event.timeStart);
		return end === undefined || end >= time;
	}).sort((a, b) => `${a.date}T${a.timeStart || '00:00'}`.localeCompare(`${b.date}T${b.timeStart || '00:00'}`));
	const moodIcons = ['ti ti-mood-cry', 'ti ti-mood-sad', 'ti ti-mood-neutral', 'ti ti-mood-smile', 'ti ti-mood-heart'];
	const usageScore = (id: string) => akatsukiUsageScore(source.usage ?? {}, id, now.getTime());
	const apps = [...(source.apps ?? [])].sort((a, b) => usageScore(b.id) - usageScore(a.id));
	const hasUsage = apps.some(app => usageScore(app.id) > 0);
	const boost = (id: string) => Math.min(12, usageScore(id) * 2);
	const nearEvent = upcoming.find(event => {
		const start = minute(event.timeStart);
		return !event.allDay && event.date <= today && start !== undefined && (event.date < today || start - time <= 90);
	});
	const nextEvent = nearEvent ?? upcoming.at(0);
	const overdueTodos = remainingTodos.filter(todo => todo.due && (todo.due < today || (todo.due === today && (minute(todo.time) ?? 1440) <= time)));
	const dueToday = remainingTodos.filter(todo => todo.due === today);
	const currentMeal = time >= 5 * 60 && time < 11 * 60 ? 'breakfast' : time >= 11 * 60 && time < 17 * 60 ? 'lunch' : time >= 17 * 60 ? 'dinner' : undefined;
	const mealDue = known.meals && mealRows.find(meal => meal.id === currentMeal && !meal.recorded);
	const sections: HataskAkatsukiHomeSection[] = [
		{ id: 'tools', label: copy.tools, icon: 'ti ti-apps', summary: hasUsage ? apps[0]?.label ?? copy.openTools : copy.toolsIntro, reason: hasUsage ? copy.frequentTools : copy.startHere, priority: 40 + (hasUsage ? 12 : 0) },
	];
	const joinedAt = typeof source.accountCreatedAt === 'string' ? Date.parse(source.accountCreatedAt) : NaN;
	const accountAge = now.getTime() - joinedAt;
	if (Number.isFinite(accountAge) && accountAge >= 0 && accountAge <= 14 * 24 * 60 * 60 * 1000) sections.push({
		id: 'intro', label: 'HataIntro', icon: 'ti ti-book', summary: copy.introSummary,
		reason: copy.introReason, priority: 200,
	});
	if (settings.showEvents !== false) sections.push({
		id: 'calendar', label: copy.events, icon: 'ti ti-calendar-event', count: known.planner ? todayEvents.length : undefined,
		summary: known.planner ? nextEvent?.title ?? copy.noUpcoming : copy.eventsLoadFailed,
		reason: nearEvent ? copy.eventsNear : copy.eventsLater,
		priority: known.planner && upcoming.length ? (nearEvent ? 120 : upcoming[0].date <= today ? 60 : 30) + boost('cal') : 0,
	});
	sections.push({
		id: 'todo', label: 'ToDo', icon: 'ti ti-checkbox', count: known.planner ? remainingTodos.length : undefined,
		summary: known.planner ? remainingTodos[0]?.text ?? copy.noTodo : copy.todoLoadFailed,
		reason: overdueTodos.length ? copy.overdueTodo : dueToday.length ? copy.todayTodo : copy.nextTodo,
		priority: known.planner && remainingTodos.length ? (overdueTodos.length ? 95 : dueToday.length ? 65 : 40) + boost('todo') : 0,
	});
	if (source.feedback?.allowed && settings.showFeedbackNotif !== false) sections.push({
		id: 'feedback', label: 'HataFeed', icon: 'ti ti-message-report', count: source.feedback.known ? source.feedbackUnread : undefined,
		summary: source.feedback.known ? source.feedbackUnread ? i18n.tsx._hata._hatask._akatsuki.notificationsUnread({ count: String(source.feedbackUnread) }) : copy.noUnread : copy.notificationsLoadFailed,
		reason: copy.notificationsReason, priority: source.feedback.known && source.feedbackUnread > 0 ? 85 + boost('feed') : 0,
	});
	if (settings.showMealSection !== false) sections.push({
		id: 'meal', label: copy.meals, icon: 'ti ti-soup', summary: mealSummary,
		reason: mealDue ? i18n.tsx._hata._hatask._akatsuki.mealRecordReason({ slot: mealDue.label }) : copy.mealsReflect,
		priority: mealDue ? 75 + boost('meal') : 0,
	});
	const recommended = [...sections].sort((a, b) => b.priority - a.priority)[0].id;
	const model: HataskAkatsukiModel = {
		home: { sections, recommended, hasUsage, favorites: normalizeHataskAkatsukiFavorites(settings.akatsukiHomeFavorites) },
		apps: apps.slice(0, 6),
		loading: source.loading,
		readOnly: source.readOnly,
		mobileTabs: normalizeHataskAkatsukiMobileTabs(settings.akatsukiMobileTabs, settings.akatsukiShortcut),
		dateLabel: md.format(now),
		weekdayLabel: weekday.format(now),
		clockLabel: new Intl.DateTimeFormat(source.locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
		showClock: settings.showClock !== false,
		showEvents: settings.showEvents !== false,
		scheduleUnavailable: !known.planner,
		dayCountLabel: i18n.tsx._hata._hatask._akatsuki.loginDays({ count: String(source.loginDays) }),
		summary: source.loading ? copy.loadingRecords : `${known.planner ? i18n.tsx._hata._hatask._akatsuki.dailySummary({ events: String(todayEvents.length), todos: String(remainingTodos.length) }) : copy.plannerUnavailable}${settings.showMealSummary !== false ? ` · ${mealSummary}` : ''}`,
		next: known.planner && settings.showEvents !== false && nextEvent ? eventModel(nextEvent) : null,
		later: known.planner && settings.showEvents !== false ? upcoming.filter(event => event !== nextEvent).slice(0, 3).map(eventModel) : [],
		timeline: known.planner && settings.showEvents !== false ? todayEvents.map(eventModel) : [],
		stats: [
			{ id: 'events', label: copy.weekEvents, value: known.planner ? events.filter(event => event.date <= keys[6] && (event.dateEnd || event.date) >= keys[0]).length : '—', unit: copy.eventUnit, tab: 'cal' },
			{ id: 'todo', label: copy.todoCompleted, value: known.planner ? todos.filter(todo => todo.done).length : '—', unit: known.planner ? `/ ${todos.length}` : '', tab: 'todo' },
			{ id: 'mood', label: copy.moodRecords, value: known.moods ? new Set(source.moods.filter(mood => keys.includes(mood.date)).map(mood => mood.date)).size : '—', unit: copy.dayUnit, tab: 'mood' },
			{ id: 'meal', label: copy.mealRecords, value: known.meals ? source.meals.filter(meal => keys.includes(meal.date)).length : '—', unit: copy.mealUnit, tab: 'meal' },
		],
		week: settings.showMoodSummary === false ? [] : weekDates.map(day => {
			const date = akatsukiDateKey(day);
			const last = source.moods.filter(mood => mood.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || '')).at(-1);
			return { id: date, label: shortWeekday.format(day), today: date === today, pending: !known.moods || !last, icon: known.moods && last ? moodIcons[last.level - 1] : undefined, description: `${md.format(day)} ${!known.moods ? copy.moodUnavailable : last ? i18n.tsx._hata._hatask._akatsuki.moodLevel({ level: String(last.level) }) : copy.moodNotRecorded}` };
		}),
		meals: settings.showMealSection === false ? [] : mealRows,
		mealSummary: settings.showMealSummary === false ? undefined : mealSummary,
		flower: settings.showFlower === false || !known.flower ? null : { name: source.flower.name, emoji: source.flower.emoji, progress: source.flower.progress, detail: source.flower.progress >= 100 ? copy.flowerBloomed : i18n.tsx._hata._hatask._akatsuki.flowerUntilBloom({ remaining: source.flower.remaining }) },
		streakLabel: i18n.tsx._hata._hatask._akatsuki.loginTotal({ count: String(source.loginDays) }),
		rankLabel: source.loginRanking > 0 ? `#${source.loginRanking}` : undefined,
		eye: { text: source.eyePhrase },
		todos: known.planner ? remainingTodos.slice(0, 3).map(todo => ({ id: todo.id, title: todo.text, meta: todo.due ? `${todo.due === today ? copy.today : todo.due}${todo.time ? ` ${todo.time}` : ''}` : copy.noDue, completed: false, readOnly: source.readOnly })) : [],
	};
	return { model, counts: { calendar: known.planner ? todayEvents.length : 0, todo: known.planner ? remainingTodos.length : 0, meal: known.meals ? todayMeals.length : 0, feedback: source.feedbackUnread } };
}
