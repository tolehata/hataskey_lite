/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it, vi } from 'vitest';
import { compileTemplate, parse } from '@vue/compiler-sfc';
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});
import surfaceSource from './SettingsPreferencesSurface.vue?raw';
import modelsSource from './settings-preferences-models.ts?raw';
import defaultsSource from '@/preferences/def.ts?raw';
import {
	assertPreferenceInventory,
	canonicalSearchIdForPreferenceKey,
	destinationForPreferenceKey,
	destinationForSearchDescriptor,
	generatedPreferenceSearchId,
	legacyDescriptorIdsForPreferenceKey,
	preferenceAuxiliaryControls,
	preferenceContainerKeys,
	preferenceControls,
	preferenceDestinationIds,
	searchIdForPreferenceKey,
	settingsInventoryKeys,
} from './settings-preferences-catalog.js';

import { destinationForId } from './settings-destinations.js';
import legacySource from '@/pages/settings/preferences.vue?raw';
import legacyCustomSource from '@/pages/settings/hata-custom.vue?raw';
const unique = (values: string[]) => [...new Set(values)];
const oldContainers = unique([...legacySource.matchAll(/<MkPreferenceContainer\b[^>]*\bk="([^"]+)"/gu)].map(match => match[1]));
const oldModels = unique([...legacySource.matchAll(/prefer\.model\(\s*['"]([^'"]+)['"]/gu)].map(match => match[1]));
const navbarKeys = ['emojiAdditionNotice', 'hourlyTimeNotice'];
const ui3ComposerKeys = ['hataskeyUi3ComposerShortcut1', 'hataskeyUi3ComposerShortcut2', 'hataskeyUi3ComposerEmojiPosition', 'hataskeyUi3ComposerPosition'];
const ui3RssKeys = ['hataskeyUi3RssEnabled', 'hataskeyUi3RssFeeds', 'hataskeyUi3RssAutoSwitch', 'hataskeyUi3RssReadSeconds', 'hataskeyUi3RssReadMode'];
const ui3BackgroundKeys = ['hataskeyUi3TimelineBackground', 'hataskeyUi3SideMenuBackground', 'hataskeyUi3RightPaneBackground', 'hataskeyUi3GlassDensity'];
const visibilityBorderKeys = ['postFormVisibilityBorder.enabled', 'postFormVisibilityBorder.width', 'postFormVisibilityBorder.color.public', 'postFormVisibilityBorder.color.home', 'postFormVisibilityBorder.color.followers', 'postFormVisibilityBorder.color.specified'];
const newKeys = [...navbarKeys, ...ui3BackgroundKeys, ...ui3ComposerKeys, ...visibilityBorderKeys, ...ui3RssKeys];

describe('redesigned preferences inventory', () => {
	it.each([
		['hataskeyUi3SideMenuBackground', '左サイドメニューの背景'],
		['hataskeyUi3RightPaneBackground', 'ウィジェット・Hataskの背景'],
	])('registers independent enabled-by-default pane background %s', (key, label) => {
		expect(defaultsSource).toMatch(new RegExp(`${key}:\\s*\\{\\s*default:\\s*true\\s*\\}`, 'u'));
		expect(preferenceControls.find(control => control.key === key)).toMatchObject({ kind: 'switch', destinationId: 'hataskey-ui-s', label });
		expect(modelsSource).toContain(`prefer.model('${key}')`);
		expect(surfaceSource.match(/const ui3ComposerResetKeys = \[([\s\S]*?)\] as const/u)?.[1]).not.toContain(key);
	});
	it('registers an enabled-by-default UI S background switch independently of composer reset', () => {
		const key = 'hataskeyUi3TimelineBackground';
		expect(defaultsSource).toMatch(/hataskeyUi3TimelineBackground:\s*\{\s*default:\s*true\s*\}/u);
		expect(preferenceControls.find(control => control.key === key)).toMatchObject({
			kind: 'switch', destinationId: 'hataskey-ui-s', label: 'タイムライン背景',
			caption: ['ヘッダー画像をすりガラス風の背景に表示します。未設定の場合はアイコンを使用します。'],
		});
		expect(modelsSource).toContain(`prefer.model('${key}')`);
		expect(preferenceControls.filter(control => control.destinationId === 'hataskey-ui-s')[0]?.key).toBe(key);
		expect(surfaceSource.match(/const ui3ComposerResetKeys = \[([\s\S]*?)\] as const/u)?.[1]).not.toContain(key);
	});
	it('mounts the device display size control and includes it in UI S reset', () => {
		expect(surfaceSource).toContain(':data-settings-search-id="uiSDisplaySizeSearchId"');
		expect(surfaceSource).toContain(':modelValue="hataskeyUiSDisplaySize" @update:modelValue="setHataskeyUiSDisplaySize($event)"');
		expect(surfaceSource).toContain("setHataskeyUiSDisplaySize('standard');");
	});
	it('shares all six visibility border models with the old control and keeps disabled rows searchable', () => {
		const { descriptor, errors } = parse(surfaceSource);
		expect(errors).toEqual([]);
		expect(compileTemplate({ source: descriptor.template!.content, filename: 'SettingsPreferencesSurface.vue', id: 'preferences-surface' }).errors).toEqual([]);
		for (const key of visibilityBorderKeys) {
			expect(legacyCustomSource).toContain(`prefer.model('${key}')`);
			expect(modelsSource).toContain(`'${key}': unknownRef(prefer.model('${key}'))`);
			expect([...modelsSource.matchAll(/prefer\.model\(['"]([^'"]+)['"]/gu)].filter(match => match[1] === key)).toHaveLength(1);
			expect(preferenceControls.filter(control => control.key === key)).toHaveLength(1);
			expect(preferenceControls.find(control => control.key === key)).toMatchObject({ destinationId: 'hataskey-ui-s', canonicalSearchId: generatedPreferenceSearchId(key), cherry: false });
			expect(surfaceSource.match(/const ui3ComposerResetKeys = \[([\s\S]*?)\] as const/u)?.[1]).not.toContain(key);
		}
		expect(preferenceControls.find(control => control.key === visibilityBorderKeys[0])).toMatchObject({ kind: 'switch', label: '投稿範囲に応じて枠の色を変える', caption: ['公開・ホーム・フォロワー・ダイレクトの各範囲ごとに投稿フォームの枠色を変えます。Hataskey UIとUI Sのウィジェット・デッキの投稿フォームにも適用されます。UI Sでは、自分と他のユーザーのノートの左辺にも公開範囲に応じた色を表示します。色とオン・オフは投稿フォームと共通です。'] });
		expect(preferenceControls.find(control => control.key === visibilityBorderKeys[1])).toMatchObject({ kind: 'range', min: 1, max: 12 });
		expect(legacyCustomSource).toContain('v-model="pfvbWidth" type="number" :min="1" :max="12"');
		expect(visibilityBorderKeys.slice(2).map(key => preferenceControls.find(control => control.key === key)?.kind)).toEqual(['color', 'color', 'color', 'color']);
		expect(surfaceSource).toContain(`<MkInput v-else-if="control.kind === 'color'" type="color" :modelValue="String(read(control.key) ?? '')" :disabled="isDisabled(control)" @update:modelValue="write(control.key, $event)">`);
		expect(surfaceSource).toContain("key.startsWith('postFormVisibilityBorder.') && key !== 'postFormVisibilityBorder.enabled') return !read('postFormVisibilityBorder.enabled')");
		expect(surfaceSource.match(/function isControlMounted[\s\S]*?\n\}/u)?.[0]).not.toContain('postFormVisibilityBorder');
		expect(surfaceSource).toContain('return models.controls[key].value');
		expect(surfaceSource).toContain('models.controls[key].value = value');
	});

	it('explains automatic Hataskey placement while retaining other UIs saved options', () => {
		const byKey = new Map(preferenceControls.map(control => [control.key, control]));
		expect(byKey.get('notificationPosition')?.label).toBe('通知ポップアップの位置');
		expect(byKey.get('notificationPosition')?.caption.join(' ')).toMatch(/PC.*下.*モバイル.*上.*右下.*5秒/);
		expect(byKey.get('notificationPosition')?.caption.join(' ')).toMatch(/タイムライン以外.*ナビバーを表示せず.*不透明/);
		expect(byKey.get('notificationStackAxis')?.caption.join(' ')).toMatch(/入れ替わり.*下へ.*3件.*縦/);
		expect(byKey.get('notificationPosition')?.options).toEqual(['leftTop', 'rightTop', 'leftBottom', 'rightBottom']);
		expect(byKey.get('notificationStackAxis')?.options).toEqual(['vertical', 'horizontal']);
	});

	it('retains every legacy container alongside the new-settings-only navbar switches and UI3 composer options', () => {
		expect(oldContainers).toHaveLength(101);
		expect(preferenceContainerKeys).toHaveLength(122);
		expect(new Set(preferenceContainerKeys.filter(key => !newKeys.includes(key)))).toEqual(new Set(oldContainers));
		for (const key of newKeys) {
			expect(oldContainers).not.toContain(key);
			expect(oldModels).not.toContain(key);
			expect(modelsSource).toContain(`prefer.model('${key}')`);
		}
		for (const key of navbarKeys) {
			expect(preferenceControls.find(control => control.key === key)).toMatchObject({ kind: 'switch', destinationId: 'notifications-preferences' });
		}
		expect(preferenceControls.find(control => control.key === 'hataskeyUi3ComposerShortcut1')).toMatchObject({ kind: 'select', destinationId: 'hataskey-ui-s' });
		expect(preferenceControls.find(control => control.key === 'hataskeyUi3GlassDensity')).toMatchObject({ kind: 'radios', destinationId: 'hataskey-ui-s', label: 'すりガラスの濃さ', options: ['light', 'dense'] });
		expect(preferenceControls.find(control => control.key === 'hataskeyUi3ComposerShortcut2')).toMatchObject({ kind: 'select', destinationId: 'hataskey-ui-s' });
		expect(preferenceControls.find(control => control.key === 'hataskeyUi3ComposerEmojiPosition')).toMatchObject({ kind: 'radios', destinationId: 'hataskey-ui-s', options: ['afterShortcuts', 'beforeVisibility'] });
		expect(preferenceControls.find(control => control.key === 'hataskeyUi3ComposerPosition')).toMatchObject({ kind: 'radios', destinationId: 'hataskey-ui-s', options: ['top', 'bottom'] });
		expect(preferenceControls.filter(control => control.destinationId === 'hataskey-ui-s').map(control => control.key)).toEqual([...ui3BackgroundKeys, ...ui3ComposerKeys, ...visibilityBorderKeys, ...ui3RssKeys]);
		expect(preferenceControls.find(control => control.key === 'showFixedPostForm')?.destinationId).toBe('timeline-post-form');
		expect(surfaceSource).toContain("key === 'showFixedPostForm') return ui === 'hataskey3'");
		expect(surfaceSource).toContain("control.key === 'showFixedPostForm' && ui === 'hataskey3'");
	});

	it('keeps every explicit legacy model and the special animation inversion', () => {
		expect(oldModels).toHaveLength(103);
		expect(new Set(oldModels)).toEqual(new Set([...preferenceContainerKeys.filter(key => !newKeys.includes(key)), 'externalNavigationWarning', 'overridedDeviceKind']));
		expect(modelsSource).toContain('prefer.model(\'animation\', value => !value, value => !value)');
		expect(modelsSource).toContain('prefer.model(\'chat.sendOnEnter\')');
		expect(modelsSource).toContain('prefer.model(\'chat.showSenderName\')');
		expect(modelsSource).toContain('Boolean(controls.squareAvatars.value)');
		expect(modelsSource).toContain('if (fontSizeBefore.value == null)');
	});

	it('has one manifest destination for all settings and auxiliary controls', () => {
		expect(preferenceControls).toHaveLength(122);
		expect(settingsInventoryKeys).toHaveLength(140);
		assertPreferenceInventory(preferenceControls, preferenceAuxiliaryControls);
		for (const item of [...preferenceControls, ...preferenceAuxiliaryControls]) expect(preferenceDestinationIds).toContain(item.destinationId);
	});

	it('keeps the inventory detector live for duplicate, missing, and unknown input', () => {
		expect(() => assertPreferenceInventory([...preferenceControls, preferenceControls[0]], preferenceAuxiliaryControls)).toThrow(/duplicate/iu);
		expect(() => assertPreferenceInventory(preferenceControls.slice(1), preferenceAuxiliaryControls)).toThrow(/missing/iu);
		expect(() => assertPreferenceInventory([...preferenceControls, { key: 'fixture.unknown', destinationId: 'display-general' }], preferenceAuxiliaryControls)).toThrow(/unknown/iu);
	});

	it('has explicit translated labels and captions rather than raw preference keys', () => {
		expect(preferenceControls.every(control => control.label.length > 0)).toBe(true);
		expect(preferenceAuxiliaryControls).toHaveLength(18);
		expect(preferenceAuxiliaryControls.every(control => control.label.length > 0 && Array.isArray(control.caption))).toBe(true);
		expect(surfaceSource).not.toContain('labelForKey');
		expect(surfaceSource).not.toContain('?? key');
		expect(preferenceControls.filter(control => control.cherry).map(control => destinationForId(control.destinationId)?.categoryId)).toEqual(Array(preferenceControls.filter(control => control.cherry).length).fill('cherrypick'));
	});

	it('uses one generated canonical DOM id even for duplicate legacy descriptors', () => {
		const descriptors = [
			{ stableId: 'settings.control.animation-accessibility', route: '/settings/preferences', source: 'control', preferenceKeys: ['animation'] },
			{ stableId: 'settings.control.animation-performance', route: '/settings/preferences', source: 'control', preferenceKeys: ['animation'] },
			{ stableId: 'settings.control.reply-target', route: '/settings/preferences', source: 'control', preferenceKeys: ['showReplyTargetNote'] },
		];
		expect(legacyDescriptorIdsForPreferenceKey('animation', descriptors)).toHaveLength(2);
		expect(canonicalSearchIdForPreferenceKey('animation', descriptors)).toBe(generatedPreferenceSearchId('animation'));
		expect(searchIdForPreferenceKey('animation', descriptors)).toBe(generatedPreferenceSearchId('animation'));
		expect(destinationForSearchDescriptor({ preferenceKeys: ['animation'] })).toBe('misskey-accessibility');
		expect(destinationForPreferenceKey('externalNavigationWarning')).toBe('cherrypick-external-navigation');
	});

	it('preserves range, options, previews, and progressive-disclosure conditions', () => {
		const byKey = new Map(preferenceControls.map(control => [control.key, control]));
		expect(byKey.get('pollingInterval')).toMatchObject({ kind: 'range', min: 1, max: 3 });
		expect(byKey.get('fontSize')).toMatchObject({ kind: 'range', min: 1, max: 19 });
		expect(byKey.get('numberOfPageCache')).toMatchObject({ kind: 'range', min: 1, max: 10 });
		expect(byKey.get('notificationPosition')?.options).toEqual(['leftTop', 'rightTop', 'leftBottom', 'rightBottom']);
		expect(byKey.get('defaultNoteVisibility')?.options).toEqual(['public', 'home', 'followers', 'specified']);
		expect(byKey.get('showingAnimatedImages')?.options).toEqual(['always', 'interaction', 'inactive']);
		expect(surfaceSource).toContain('control.key === \'smoothTransitionAnimations\'');
		expect(surfaceSource).toContain('control.key === \'removeModalBgColorForBlur\'');
		expect(surfaceSource).toContain('key === \'animatedMfm\'');
		expect(surfaceSource).toContain('fontSizePreview');
		expect(surfaceSource).toContain('emojiPreview');
		expect(surfaceSource).toContain('mfmPreview');
	});
});
