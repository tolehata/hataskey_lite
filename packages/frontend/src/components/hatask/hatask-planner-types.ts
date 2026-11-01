/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskPlannerTheme = 'akatsuki' | 'koke' | 'kisetsu' | 'kashin' | 'suri' | 'hatakyu' | 'halloween';

export type HataskCalendarView = 'month' | 'week' | 'day' | 'agenda';

export type HataskCalendarNavigation = 'previous' | 'next' | 'today';

export interface HataskCalendarEvent {
	id: string;
	title: string;
	emoji?: string;
	color?: string;
	timeLabel?: string;
	metaLabel?: string;
	ownerLabel?: string;
	statusLabel?: string;
	isAllDay?: boolean;
	isShared?: boolean;
	readOnly?: boolean;
	draggable?: boolean;
	date?: string;
	dateEnd?: string;
	timeStart?: string;
	timeEnd?: string;
}

export interface HataskCalendarDay {
	key: string;
	date: string;
	label: string;
	dayNumber: string | number;
	weekdayLabel?: string;
	isOutsideRange?: boolean;
	isToday?: boolean;
	isSelected?: boolean;
	isDisabled?: boolean;
	events: HataskCalendarEvent[];
	hiddenEventCount?: number;
}

export type HataskCalendarBlankTarget = {
	day: HataskCalendarDay;
	anchor: HTMLElement;
	time?: string;
	point?: { x: number; y: number };
};

export interface HataskCalendarWeekday {
	id: string;
	label: string;
	isWeekend?: boolean;
}

export interface HataskPlannerFilter {
	id: string;
	label: string;
	active: boolean;
	color?: string;
	count?: number;
	disabled?: boolean;
	icon?: string;
	emoji?: string;
	kind?: 'folder' | 'priority' | 'calendar';
}

export interface HataskCalendarLabels {
	calendar: string;
	viewSelector: string;
	views: Record<HataskCalendarView, string>;
	previousPeriod: string;
	nextPeriod: string;
	today: string;
	filters: string;
	allDay: string;
	loading: string;
	empty: string;
	readOnly: string;
	selectedDay: string;
	dragHint: string;
	trashHint: string;
	selectDate: (dateLabel: string) => string;
	openDayActions?: (dateLabel: string) => string;
	openEvent: (eventTitle: string) => string;
	editEvent: (eventTitle: string) => string;
	moveEvent: (eventTitle: string) => string;
	showMore: (count: number) => string;
}

export type HataskTodoView = 'today' | 'upcoming' | 'overdue' | 'priority' | 'all' | 'completed' | 'templates';

export type HataskTodoMobileTab = HataskTodoView | 'more';

export type HataskTodoSort = 'manual' | 'dueAsc' | 'priority' | 'createdDesc';

export type HataskTodoPriority = 'none' | 'low' | 'medium' | 'high';

export interface HataskTodoSubtask {
	id: string;
	text: string;
	done: boolean;
}

export interface HataskTodoItem {
	id: string;
	text: string;
	done: boolean;
	due?: string;
	time?: string;
	dueLabel?: string;
	folder?: string;
	folderLabel?: string;
	folderEmoji?: string;
	comment?: string;
	commentPreview?: string;
	priority: HataskTodoPriority;
	recurrenceLabel?: string;
	subtasks?: HataskTodoSubtask[];
	archivedAt?: string | null;
	archivedLabel?: string;
	canMoveUp?: boolean;
	canMoveDown?: boolean;
}

export interface HataskTodoLabels {
	todo: string;
	viewSelector: string;
	views: Record<HataskTodoView, string>;
	search: string;
	searchPlaceholder: string;
	addTask: string;
	filters: string;
	loading: string;
	empty: string;
	readOnly: string;
	priorities: Record<HataskTodoPriority, string>;
	completeTask: (taskTitle: string) => string;
	reopenTask: (taskTitle: string) => string;
	editTask: (taskTitle: string) => string;
	archiveTask: (taskTitle: string) => string;
	restoreTask: (taskTitle: string) => string;
	deleteTask: (taskTitle: string) => string;
	moveUp: (taskTitle: string) => string;
	moveDown: (taskTitle: string) => string;
	subtaskProgress: (completed: number, total: number) => string;
	sort: string;
	sortOptions: Record<HataskTodoSort, string>;
	folders: string;
	selectedCount: (count: number) => string;
	bulkComplete: string;
	bulkMove: string;
	bulkDue: string;
	bulkPriority: string;
	bulkArchive: string;
	clearSelection: string;
	addFolder: string;
	manageFolder: (folderName: string) => string;
	moreActions: (taskTitle: string) => string;
	moreViews: string;
	reorderViews: string;
	reorderView: (viewName: string) => string;
	customizeViews: string;
	customizeViewsHint: string;
	showView: (viewName: string) => string;
	hideView: (viewName: string) => string;
}
