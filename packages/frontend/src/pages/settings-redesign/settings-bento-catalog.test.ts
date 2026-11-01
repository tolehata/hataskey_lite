/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as never) };
});
import { assertBentoPreferenceInventory, bentoCategoryForDestination, bentoDestinationLinkSections, bentoPreferenceCategory, bentoPreferencePlacements, bentoSectionIds, bentoSectionLabel, parseSettingsBentoCategory, settingsBentoCategories } from './settings-bento-catalog.js';
import { settingsInventoryKeys } from './settings-preferences-catalog.js';
import { settingsDestinations } from './settings-destinations.js';

describe('settings presentation category contract', () => {
	test('preserves every current preference and rejects missing, unknown, and unplaced keys', () => {
		expect(Object.keys(bentoPreferencePlacements).sort()).toEqual([...settingsInventoryKeys].sort());
		expect(() => assertBentoPreferenceInventory(bentoPreferencePlacements)).not.toThrow();
		const missing = { ...bentoPreferencePlacements } as Record<string, string>;
		delete missing['chat.sendOnEnter'];
		expect(() => assertBentoPreferenceInventory(missing)).toThrow('Missing settings preference: chat.sendOnEnter');
		expect(() => assertBentoPreferenceInventory({ ...bentoPreferencePlacements, nonexistent: 'post.section1' })).toThrow('Unknown settings preference: nonexistent');
		expect(() => assertBentoPreferenceInventory({ ...bentoPreferencePlacements, fontSize: 'removed.section1' })).toThrow('Unknown settings section: fontSize');
	});
	test('retains all destination entry points and the approved thirteen categories', () => {
		expect(settingsBentoCategories.map(category => category.id)).toEqual(['profile', 'privacy', 'security', 'appearance', 'timeline', 'post', 'notify', 'access', 'mute', 'drive', 'apps', 'data', 'advanced']);
		expect(bentoSectionIds).toHaveLength(57);
		for (const id of bentoSectionIds) expect(bentoSectionLabel(id).trim().length).toBeGreaterThan(0);
		for (const destination of settingsDestinations) expect(parseSettingsBentoCategory(bentoCategoryForDestination(destination.id)), destination.id).toBeDefined();
		expect(parseSettingsBentoCategory('removed')).toBeUndefined();
		expect(parseSettingsBentoCategory({ category: 'profile' })).toBeUndefined();
	});
	test('separates settings formerly mixed across UI-specific destinations by actual purpose', () => {
		for (const key of ['chat.sendOnEnter', 'chat.showSenderName'] as const) expect(bentoPreferenceCategory(key)).toBe('privacy');
		for (const key of ['hataskeyUi3ComposerPosition', 'postFormVisibilityBorder.enabled', 'additionalUnicodeEmojiIndexes'] as const) expect(bentoPreferenceCategory(key)).toBe('post');
		for (const key of ['fontSize', 'squareAvatars', 'hataskeyUi3TimelineBackground'] as const) expect(bentoPreferenceCategory(key)).toBe('appearance');
		for (const key of ['animation', 'enableHorizontalSwipe', 'dataSaver.urlPreviewThumbnail'] as const) expect(bentoPreferenceCategory(key)).toBe('access');
		expect(bentoPreferenceCategory('externalNavigationWarning')).toBe('mute');
		expect(bentoPreferenceCategory('realtimeMode')).toBe('advanced');
		expect(bentoPreferenceCategory('ltlEmojiVoteEnabled')).toBe('timeline');
	});
	test('keeps every non-inline destination once in its matching section', () => {
		const inlineOwners = ['account-profile', 'account-privacy', 'account-email', 'account-security', 'display-theme', 'display-emoji', 'notifications-page', 'notifications-sounds', 'account-mute', 'account-drive', 'account-profiles', 'account-export'];
		const linkedDestinations = settingsDestinations.filter(destination => !inlineOwners.includes(destination.id) && (destination.route !== '/settings/preferences' || destination.id === 'hataskey-ui-s'));
		const actualIds = bentoDestinationLinkSections.flatMap(section => section.destinationIds);
		expect(actualIds.toSorted()).toEqual(linkedDestinations.map(destination => destination.id).toSorted());
		for (const section of bentoDestinationLinkSections) {
			expect(bentoSectionIds).toContain(section.sectionId);
			for (const id of section.destinationIds) expect(section.sectionId.startsWith(`${bentoCategoryForDestination(id)}.`), id).toBe(true);
		}
		expect(bentoDestinationLinkSections.find(section => section.sectionId === 'timeline.section6')?.destinationIds).toEqual(['misskey-deck']);
		expect(bentoDestinationLinkSections.find(section => section.sectionId === 'data.section3')?.destinationIds).toEqual(['account-external', 'account-concrnt', 'account-connect', 'account-apps']);
	});
});
