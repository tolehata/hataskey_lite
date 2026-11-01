/* SPDX-License-Identifier: AGPL-3.0-only */

import type { SettingsBentoCategoryId, SettingsBentoSectionId } from './settings-bento-catalog.js';
import { i18n } from '@/i18n.js';

export const settingsExplanationSceneIds = [
	'access', 'actions', 'apps', 'autodel', 'backup', 'bell',
	'block', 'border', 'card', 'clean', 'compose', 'deck',
	'dm', 'effects', 'emoji', 'export', 'extend', 'feed',
	'fold', 'font', 'glass', 'globe', 'history', 'layout',
	'link', 'lock', 'login', 'mail', 'mascot', 'media',
	'mute', 'nav', 'note', 'picker', 'popup', 'profile',
	'reactions', 'shield', 'sliders', 'sound', 'speed', 'swap',
	'swipe', 'theme', 'upload', 'video', 'visibility',
] as const;
export type SettingsExplanationScene = typeof settingsExplanationSceneIds[number];

/** The approved mock has 57 sections sharing 47 decorative scenes. */
export const sectionExplanationScenes = {
	'profile.section0': 'profile',
	'profile.section1': 'card',
	'profile.section2': 'effects',
	'profile.section3': 'mascot',
	'privacy.section0': 'lock',
	'privacy.section1': 'link',
	'privacy.section2': 'dm',
	'privacy.section3': 'shield',
	'privacy.section4': 'autodel',
	'security.section0': 'mail',
	'security.section1': 'login',
	'security.section2': 'history',
	'security.section3': 'swap',
	'appearance.section0': 'theme',
	'appearance.section1': 'font',
	'appearance.section2': 'layout',
	'appearance.section3': 'nav',
	'appearance.section4': 'glass',
	'appearance.section5': 'effects',
	'timeline.section0': 'feed',
	'timeline.section1': 'fold',
	'timeline.section2': 'note',
	'timeline.section3': 'actions',
	'timeline.section4': 'reactions',
	'timeline.section5': 'media',
	'timeline.section6': 'deck',
	'post.section0': 'compose',
	'post.section1': 'visibility',
	'post.section2': 'actions',
	'post.section3': 'border',
	'post.section4': 'emoji',
	'post.section5': 'picker',
	'notify.section0': 'bell',
	'notify.section1': 'popup',
	'notify.section2': 'mail',
	'notify.section3': 'sound',
	'access.section0': 'access',
	'access.section1': 'swipe',
	'access.section2': 'speed',
	'access.section3': 'sliders',
	'mute.section0': 'mute',
	'mute.section1': 'block',
	'mute.section2': 'link',
	'drive.section0': 'upload',
	'drive.section1': 'upload',
	'drive.section2': 'media',
	'drive.section3': 'video',
	'apps.section0': 'apps',
	'apps.section1': 'mascot',
	'data.section0': 'backup',
	'data.section1': 'backup',
	'data.section2': 'export',
	'data.section3': 'link',
	'advanced.section0': 'globe',
	'advanced.section1': 'speed',
	'advanced.section2': 'extend',
	'advanced.section3': 'clean',
} as const satisfies Record<SettingsBentoSectionId, SettingsExplanationScene>;

export function sectionExplanationCaption(id: SettingsBentoSectionId): string {
	const [category, section] = id.split('.') as [SettingsBentoCategoryId, string];
	return (i18n.ts._hata._settingsBento.sectionExplainer[category] as Readonly<Record<string, string>>)[section];
}
