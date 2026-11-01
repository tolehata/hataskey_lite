/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HyTutorialPage } from '@/utility/hy-tutorial.js';
import { i18n } from '@/i18n.js';

export type HataFeedTutorialKind = 'initial' | 'update';

const copy = i18n.ts._hata._hatafeed._tutorial;

const settings: HyTutorialPage = {
	id: 'settings', label: copy.initial.settings.label, icon: 'ti ti-settings', title: copy.initial.settings.title,
	description: copy.initial.settings.description,
	note: copy.initial.settings.note,
	figure: copy.initial.settings.figure,
};
const admin: HyTutorialPage = {
	id: 'admin', label: copy.initial.admin.label, icon: 'ti ti-mood-cog', title: copy.initial.admin.title,
	description: copy.initial.admin.description,
	note: copy.initial.admin.note,
	figure: copy.initial.admin.figure,
};
const initial: readonly HyTutorialPage[] = [
	{
		id: 'home', label: copy.initial.home.label, icon: 'ti ti-home', title: copy.initial.home.title,
		description: copy.initial.home.description,
		note: copy.initial.home.note,
		figure: copy.initial.home.figure,
	},
	{
		id: 'create', label: copy.initial.create.label, icon: 'ti ti-plus', title: copy.initial.create.title,
		description: copy.initial.create.description,
		note: copy.initial.create.note,
		figure: copy.initial.create.figure,
	},
	{
		id: 'issues', label: copy.initial.issues.label, icon: 'ti ti-clipboard-list', title: copy.initial.issues.title,
		description: copy.initial.issues.description,
		note: copy.initial.issues.note,
		figure: copy.initial.issues.figure,
	},
	{
		id: 'emoji', label: copy.initial.emoji.label, icon: 'ti ti-mood-plus', title: copy.initial.emoji.title,
		description: copy.initial.emoji.description,
		note: copy.initial.emoji.note,
		figure: copy.initial.emoji.figure,
	},
	{
		id: 'roadmap', label: copy.initial.roadmap.label, icon: 'ti ti-route', title: copy.initial.roadmap.title,
		description: copy.initial.roadmap.description,
		note: copy.initial.roadmap.note,
		figure: copy.initial.roadmap.figure,
	},
	settings,
];
const update: readonly HyTutorialPage[] = [
	{
		id: 'home', label: copy.update.home.label, icon: 'ti ti-home', title: copy.update.home.title,
		description: copy.update.home.description,
		note: copy.update.home.note,
		figure: copy.update.home.figure,
	},
	{
		id: 'create', label: copy.update.create.label, icon: 'ti ti-plus', title: copy.update.create.title,
		description: copy.update.create.description,
		note: copy.update.create.note,
		figure: copy.update.create.figure,
	},
	{
		id: 'notifications', label: copy.update.notifications.label, icon: 'ti ti-bell', title: copy.update.notifications.title,
		description: copy.update.notifications.description,
		note: copy.update.notifications.note,
		figure: copy.update.notifications.figure,
	},
	{
		id: 'emoji', label: copy.initial.emoji.label, icon: 'ti ti-mood-plus', title: copy.update.emoji.title,
		description: copy.update.emoji.description,
		note: copy.update.emoji.note,
		figure: copy.update.emoji.figure,
	},
	{
		...settings, title: copy.update.settings.title,
		description: copy.update.settings.description,
		note: copy.update.settings.note,
	},
];

export function getHataFeedTutorialPages(kind: HataFeedTutorialKind, isStaff = false): readonly HyTutorialPage[] {
	const pages = kind === 'update' ? update : initial;
	return isStaff ? [...pages.slice(0, -1), admin, pages[pages.length - 1]] : pages;
}
