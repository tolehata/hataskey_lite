/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskAkatsukiTab = 'home' | 'cal' | 'todo' | 'mood' | 'meal' | 'recipe' | 'garden' | 'support' | 'ranking' | 'hataskapps' | 'apps' | 'review';

export type HataskAkatsukiHomeSectionId = 'tools' | 'intro' | 'calendar' | 'todo' | 'feedback' | 'meal';
export type HataskAkatsukiFavoriteId = 'calendar' | 'todo' | 'meal' | 'flower';
export interface HataskAkatsukiHomeSection {
	id: HataskAkatsukiHomeSectionId;
	label: string;
	icon: string;
	summary: string;
	reason: string;
	priority: number;
	count?: number;
}

/** The layout emits intentions only; the page owns permission checks and persistence. */
export interface HataskAkatsukiAction {
	type: 'exit' | 'open-event' | 'create-event' | 'create-todo' | 'record-mood' | 'record-meal' | 'record-cooking' | 'water-flower' | 'toggle-todo' | 'open-app' | 'snooze-event';
	id?: string;
	value?: string | number | boolean;
}

export interface HataskAkatsukiButton {
	label: string;
	icon?: string;
	action: HataskAkatsukiAction;
	disabled?: boolean;
	primary?: boolean;
}

export interface HataskAkatsukiEvent {
	id: string;
	title: string;
	timeLabel: string;
	meta?: string;
	detail?: string;
	/** Minutes since midnight; omitted for all-day or untimed entries. */
	startMinute?: number;
	endMinute?: number;
	muted?: boolean;
	action?: HataskAkatsukiAction;
	buttons?: HataskAkatsukiButton[];
}

export interface HataskAkatsukiModel {
	canModerate?: boolean;
	home?: { sections: HataskAkatsukiHomeSection[]; recommended: HataskAkatsukiHomeSectionId; hasUsage: boolean; favorites?: HataskAkatsukiFavoriteId[] };
	/** True until actual account data has loaded; unknown counts must not become zero. */
	loading?: boolean;
	readOnly?: boolean;
	dateLabel?: string;
	weekdayLabel?: string;
	dayCountLabel?: string;
	clockLabel?: string;
	showClock?: boolean;
	showEvents?: boolean;
	scheduleUnavailable?: boolean;
	summary?: string;
	next?: HataskAkatsukiEvent | null;
	later?: HataskAkatsukiEvent[];
	timeline?: HataskAkatsukiEvent[];
	stats?: { id: string; label: string; value: string | number; unit?: string; tab?: HataskAkatsukiTab }[];
	week?: { id: string; label: string; icon?: string; emoji?: string; description: string; today?: boolean; pending?: boolean }[];
	mealSummary?: string;
	meals?: { id: string; label: string; text: string; recorded: boolean; unavailable?: boolean }[];
	flower?: { name: string; emoji?: string; progress?: number; detail?: string; watered?: boolean; rows?: { label: string; value: string }[]; buttons?: HataskAkatsukiButton[] } | null;
	streakLabel?: string;
	rankLabel?: string;
	eye?: { text: string; number?: string | number } | null;
	todos?: { id: string; title: string; meta?: string; completed?: boolean; readOnly?: boolean }[];
	apps?: { id: string; label: string; icon: string; description?: string }[];
	/** A parent-supplied saved order/shortcut; default is Home / ToDo / Hatask / Apps. */
	mobileTabs?: HataskAkatsukiTab[];
}

export interface HataskAkatsukiLayoutProps {
	enabled: boolean;
	activeTab: HataskAkatsukiTab;
	model: HataskAkatsukiModel;
	mode?: 'light' | 'dark';
	animations?: boolean;
	preview?: boolean;
	searchOpen?: boolean;
	searchQuery?: string;
	favoritesReady?: boolean;
	favoritesSaving?: boolean;
	favoritesError?: string;
	/** Supply the page's live clock; the layout does not create a second clock timer. */
	now?: Date;
}
