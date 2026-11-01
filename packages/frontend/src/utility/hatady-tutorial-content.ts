/* SPDX-License-Identifier: AGPL-3.0-only */
export type HatadyTutorialKind = 'initial' | 'update';

export type { HyTutorialPage as HatadyTutorialPage } from '@/utility/hy-tutorial.js';
import type { HyTutorialPage as HatadyTutorialPage } from '@/utility/hy-tutorial.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatady._tutorial;

const initialPages: readonly HatadyTutorialPage[] = [
	{
		id: 'about',
		label: copy.initial.about.label,
		icon: 'ti ti-home',
		title: copy.initial.about.title,
		description: copy.initial.about.description,
		note: copy.initial.about.note,
		figure: copy.initial.about.figure,
		caption: copy.initial.about.caption,
	},
	{
		id: 'record',
		label: copy.initial.record.label,
		icon: 'ti ti-plus',
		title: copy.initial.record.title,
		description: copy.initial.record.description,
		note: '',
		figure: copy.initial.record.figure,
		caption: copy.initial.record.caption,
	},
	{
		id: 'draft',
		label: copy.initial.draft.label,
		icon: 'ti ti-pencil',
		title: copy.initial.draft.title,
		description: copy.initial.draft.description,
		note: copy.initial.draft.note,
		figure: copy.initial.draft.figure,
		caption: copy.initial.draft.caption,
	},
	{
		id: 'visibility',
		label: copy.initial.visibility.label,
		icon: 'ti ti-lock',
		title: copy.initial.visibility.title,
		description: copy.initial.visibility.description,
		note: copy.initial.visibility.note,
		figure: copy.initial.visibility.figure,
		caption: copy.initial.visibility.caption,
	},
	{
		id: 'collection',
		label: copy.initial.collection.label,
		icon: 'ti ti-books',
		title: copy.initial.collection.title,
		description: copy.initial.collection.description,
		note: '',
		figure: copy.initial.collection.figure,
		caption: copy.initial.collection.caption,
	},
	{
		id: 'following',
		label: copy.initial.following.label,
		icon: 'ti ti-users',
		title: copy.initial.following.title,
		description: copy.initial.following.description,
		note: copy.initial.following.note,
		figure: copy.initial.following.figure,
		caption: copy.initial.following.caption,
	},
	{
		id: 'reflection',
		label: copy.initial.reflection.label,
		icon: 'ti ti-chart-bar',
		title: copy.initial.reflection.title,
		description: copy.initial.reflection.description,
		note: copy.initial.reflection.note,
		figure: copy.initial.reflection.figure,
		caption: copy.initial.reflection.caption,
	},
];

const updatePages: readonly HatadyTutorialPage[] = [
	{
		id: 'home',
		label: copy.update.home.label,
		icon: 'ti ti-home',
		title: copy.update.home.title,
		description: copy.update.home.description,
		note: copy.update.home.note,
		figure: copy.update.home.figure,
		caption: copy.update.home.caption,
	},
	{
		id: 'record',
		label: copy.update.record.label,
		icon: 'ti ti-pencil',
		title: copy.update.record.title,
		description: copy.update.record.description,
		note: copy.update.record.note,
		figure: copy.update.record.figure,
		caption: copy.update.record.caption,
	},
	{
		id: 'records',
		label: copy.update.records.label,
		icon: 'ti ti-notebook',
		title: copy.update.records.title,
		description: copy.update.records.description,
		note: copy.update.records.note,
		figure: copy.update.records.figure,
		caption: copy.update.records.caption,
	},
	{
		id: 'collection',
		label: copy.update.collection.label,
		icon: 'ti ti-books',
		title: copy.update.collection.title,
		description: copy.update.collection.description,
		note: copy.update.collection.note,
		figure: copy.update.collection.figure,
		caption: copy.update.collection.caption,
	},
	{
		id: 'profile',
		label: copy.update.profile.label,
		icon: 'ti ti-user',
		title: copy.update.profile.title,
		description: copy.update.profile.description,
		note: copy.update.profile.note,
		figure: copy.update.profile.figure,
		caption: copy.update.profile.caption,
	},
];

export function getHatadyTutorialPages(kind: HatadyTutorialKind): readonly HatadyTutorialPage[] {
	return kind === 'update' ? updatePages : initialPages;
}
