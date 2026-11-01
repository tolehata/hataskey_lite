/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { federationWidgets, widgets } from '@/widgets/index.js';
import type { HataSideButton, HataSideGroup, HataSideStudioProfile, HataSideStudioStore } from './hata-side-studio.js';
import { HATA_SIDE_NATIVE_WIDGET_REGISTRY, HATA_SIDE_WIDGET_REGISTRY } from './hata-side-studio-widgets.js';
import {
	HATA_SIDE_STUDIO_CHANGE_EVENT,
	HATA_SIDE_STUDIO_FORMAT_VERSION,
	HATA_SIDE_STUDIO_UI_S_STORAGE_KEY,
	applyHataSideStudioStore,
	copyCollapsedToExpanded,
	copyExpandedToCollapsed,
	createButton,
	createDefaultProfile,
	createHataSideStudioSourceCatalog,
	createGroup,
	createWidget,
	ensureHataSideStudioInitialized,
	findHataSideNodeParentGroup,
	getActiveHataSideStudioMenuIds,
	getAvailableHataSideStudioMoreItems,
	getHataSideStudioStorageKey,
	getHataSideNodeContainerColumns,
	getHataSideStudioGroupDisplayName,
	getHataSideStudioMenuDisplayLabel,
	getHataSideStudioProfileDisplayName,
	getHataSideWidgetDisplayLabel,
	gradientCss,
	hataSideStudioNodeContainsRequiredMenu,
	hataSideStudioStore,
	isHataSideStudioStorageString,
	mergeHataSideGroups,
	sanitizeHataSideStudioStore,
	startHataSideStudioSync,
	stopHataSideStudioSync,
} from './hata-side-studio.js';

const storage = vi.hoisted(() => ({
	getItem: vi.fn((_key: string) => null as string | null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
}));

const localeState = vi.hoisted(() => ({
	utility: {
		menuLabels: {
			timeline: 'Timeline',
			notifications: 'Notifications',
			externalNotifications: 'External notifications',
		},
		groupNames: {
			basic: 'Core features',
			hata: 'Hataskey features',
		},
		defaultNames: {
			newGroup: 'New group',
			defaultProfile: 'Default',
			groupFallback: 'Group',
			profileFallback: 'Profile',
			collapsedCopyGroup: 'Copied from compact menu',
		},
		widgetLabels: {
			clock: 'Clock',
			hataskFlowers: 'Hatask flowers',
		},
	},
}));

vi.mock('@/i18n.js', () => ({
	i18n: {
		get ts() {
			return { _hata: { _hataSideStudio: { _utility: localeState.utility } } };
		},
	},
}));

vi.mock('@/local-storage.js', () => ({
	miLocalStorage: storage,
}));

const source = [
	{ id: 'timeline', icon: 'ti ti-home', label: 'タイムライン', group: 'basic' },
	{ id: 'notifications', icon: 'ti ti-bell', label: '通知', group: 'basic' },
	{ id: 'externalNotifications', icon: 'ti ti-bell', label: '外部通知', group: 'basic' },
	{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata' },
	{ id: 'more', icon: 'ti ti-dots', label: 'もっと', group: 'more' },
];

describe('HataSideStudio', () => {
	beforeEach(() => {
		storage.getItem.mockReset();
		storage.getItem.mockReturnValue(null);
		storage.setItem.mockClear();
		storage.removeItem.mockClear();
		localeState.utility = {
			menuLabels: { timeline: 'Timeline', notifications: 'Notifications', externalNotifications: 'External notifications' },
			groupNames: { basic: 'Core features', hata: 'Hataskey features' },
			defaultNames: {
				newGroup: 'New group',
				defaultProfile: 'Default',
				groupFallback: 'Group',
				profileFallback: 'Profile',
				collapsedCopyGroup: 'Copied from compact menu',
			},
			widgetLabels: { clock: 'Clock', hataskFlowers: 'Hatask flowers' },
		};
	});

	test('共通localeは表示時だけ解決し、保存値と利用者名を変更しない', () => {
		const translatedSource = [
			{ id: 'timeline', icon: 'ti ti-home', label: 'Timeline', group: 'basic' },
			{ id: 'externalNotifications', icon: 'ti ti-bell', label: 'External notifications', group: 'basic' },
			{ id: 'earthquake', icon: 'ti ti-activity', label: 'Earthquake', group: 'hata' },
			{ id: 'custom-menu', icon: 'ti ti-point', label: 'My menu', group: 'custom' },
		];
		const profile = createDefaultProfile(translatedSource);
		const storedButtons = profile.expanded.nodes.flatMap(node => node.type === 'group' ? node.children.filter(child => child.type === 'button') : []);
		const widget = createWidget('clock');
		const legacyFlowers = createWidget('hataskFlowers');
		legacyFlowers.label = '育てたお花';
		const customWidget = createWidget('clock');
		customWidget.label = 'My clock';

		expect(profile.name).toBe('デフォルト');
		expect(profile.expanded.nodes[0].type === 'group' && profile.expanded.nodes[0].name).toBe('基本機能');
		expect(storedButtons.map(button => button.label)).toEqual(['タイムライン', '外部通知', '地震・津波情報', 'My menu']);
		expect(widget.label).toBe('時計');
		expect(getHataSideStudioProfileDisplayName(profile.name)).toBe('Default');
		expect(getHataSideStudioGroupDisplayName('基本機能')).toBe('Core features');
		expect(getHataSideStudioGroupDisplayName('利用者のグループ')).toBe('利用者のグループ');
		expect(getHataSideStudioMenuDisplayLabel('timeline', storedButtons[0].label)).toBe('Timeline');
		expect(getHataSideStudioMenuDisplayLabel('externalNotifications', storedButtons[1].label)).toBe('External notifications');
		expect(getHataSideStudioMenuDisplayLabel('earthquake', storedButtons[2].label)).toBe('地震・津波情報');
		expect(getHataSideStudioMenuDisplayLabel('custom-menu', storedButtons[3].label)).toBe('My menu');
		expect(getHataSideWidgetDisplayLabel(widget.kind, widget.label)).toBe('Clock');
		expect(getHataSideWidgetDisplayLabel(legacyFlowers.kind, legacyFlowers.label)).toBe('Hatask flowers');
		expect(getHataSideWidgetDisplayLabel(customWidget.kind, customWidget.label)).toBe('My clock');

		const beforeLanguageSwitch = JSON.stringify({ profile, widget, legacyFlowers, customWidget });
		localeState.utility = {
			menuLabels: { timeline: '时间线', notifications: '通知', externalNotifications: '外部通知' },
			groupNames: { basic: '基本功能', hata: '旗服功能' },
			defaultNames: {
				newGroup: '新建分组',
				defaultProfile: '默认',
				groupFallback: '分组',
				profileFallback: '配置',
				collapsedCopyGroup: '从收起菜单复制',
			},
			widgetLabels: { clock: '时钟', hataskFlowers: 'Hatask花朵' },
		};
		expect(getHataSideStudioProfileDisplayName(profile.name)).toBe('默认');
		expect(getHataSideStudioMenuDisplayLabel('timeline', storedButtons[0].label)).toBe('时间线');
		expect(getHataSideWidgetDisplayLabel(widget.kind, widget.label)).toBe('时钟');
		expect(JSON.stringify({ profile, widget, legacyFlowers, customWidget })).toBe(beforeLanguageSwitch);
		expect(beforeLanguageSwitch).not.toContain('Timeline');
		expect(beforeLanguageSwitch).not.toContain('时间线');
	});

	test('初期状態は拡大の各カテゴリを二列にし、縮小専用の縦一列ボタンを別々に持つ', () => {
		const profile = createDefaultProfile(source);
		expect(HATA_SIDE_STUDIO_FORMAT_VERSION).toBe(9);
		expect(profile.postButton).toEqual({
			icon: 'pencil',
			background: 'var(--MI_THEME-buttonGradateA)',
			foreground: 'var(--MI_THEME-fgOnAccent, #fff)',
			gradientEnabled: true,
			gradientTo: 'var(--MI_THEME-buttonGradateB)',
			gradientAngle: 90,
			gradientEasing: 'linear',
		});
		expect(profile.expanded.width).toBe('normal');
		expect(profile.expanded.columns).toBe(1);
		expect(profile.expanded.nodes.every(node => node.type === 'group')).toBe(true);
		expect(profile.expanded.nodes.every(node => node.type !== 'group' || node.columns === 2)).toBe(true);
		expect(profile.expanded.nodes.every(node => node.type !== 'group' || node.foreground === 'var(--MI_THEME-fg)')).toBe(true);
		expect(profile.collapsed.buttons.map(button => button.menuId)).toEqual(['timeline', 'notifications', 'externalNotifications', 'hatagoes']);
		expect(profile.collapsed.buttons.every(button => button.showLabel === false && button.rotation === 0)).toBe(true);
		expect(profile.collapsed.buttons.every(button => button.border === 'var(--MI_THEME-divider)')).toBe(true);
		expect(profile.collapsed.buttons.every(button => button.borderVisible === false)).toBe(true);
		expect(profile.collapsed.buttons.some(button => button.menuId === 'more')).toBe(false);
	});

	test('新規グループと初期化・リセット後の全カテゴリは二列になり、外側は一列を保つ', () => {
		expect(createGroup('追加カテゴリ').columns).toBe(2);
		for (const stored of [null, '{broken']) {
			storage.getItem.mockReturnValue(stored);
			ensureHataSideStudioInitialized(source);
			const profile = hataSideStudioStore.value.profiles[0];
			expect(profile.expanded.columns).toBe(1);
			expect(profile.expanded.nodes.length).toBeGreaterThan(0);
			expect(profile.expanded.nodes.every(node => node.type === 'group' && node.columns === 2)).toBe(true);
		}
	});

	test('保存済みカテゴリの一列・二列・三列設定を読み込み時に維持する', () => {
		const profiles = ([1, 2, 3] as const).map(columns => {
			const profile = createDefaultProfile(source, `${columns}列`);
			for (const node of profile.expanded.nodes) {
				if (node.type === 'group') node.columns = columns;
			}
			return profile;
		});
		const restored = sanitizeHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profiles[0].id, profiles }, source);
		expect(restored.profiles.map(profile => profile.expanded.columns)).toEqual([1, 1, 1]);
		expect(restored.profiles.map(profile => profile.expanded.nodes.map(node => node.type === 'group' ? node.columns : null))).toEqual([[1, 1], [2, 2], [3, 3]]);
	});

	test('v8の全プロファイルへ外部通知を1件だけ補い、配置と装飾を保って再実行しても変化させない', () => {
		const missing = createDefaultProfile(source, '未登録');
		missing.updatedAt = '2026-08-01T00:00:00.000Z';
		missing.postButton = { ...missing.postButton, icon: 'paw', background: '#123456', gradientTo: '#abcdef', gradientAngle: 245, gradientEasing: 'ease-in-out' };
		missing.expanded.columns = 1;
		missing.expanded.width = 'wide';
		missing.expanded.parallax = true;
		missing.expanded.nodes = missing.expanded.nodes.map(node => node.type === 'group' ? { ...node, children: node.children.filter(child => child.type !== 'button' || child.menuId !== 'externalNotifications') } : node);
		missing.collapsed.buttons = missing.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications');
		const decoratedGroup = missing.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group');
		if (!decoratedGroup) throw new Error('group fixture missing');
		decoratedGroup.background = '#101820';
		decoratedGroup.border = '#abcdef';
		decoratedGroup.foreground = '#fefefe';
		decoratedGroup.borderWidth = 3;
		decoratedGroup.borderStyle = 'double';
		decoratedGroup.gradientEnabled = true;
		decoratedGroup.gradientTo = '#334455';
		decoratedGroup.gradientAngle = 210;
		decoratedGroup.gradientEasing = 'ease-out';
		const preservedWidget = createWidget('clock');
		preservedWidget.id = 'preserved-widget';
		preservedWidget.background = '#223344';
		preservedWidget.sizeSettings.normal.minHeight = 321;
		decoratedGroup.children.push(preservedWidget);

		const existing = createDefaultProfile(source, '登録済み');
		existing.updatedAt = '2026-08-02T00:00:00.000Z';
		const existingExpanded = existing.expanded.nodes
			.flatMap(node => node.type === 'group' ? node.children : [node])
			.find((node): node is HataSideButton => node.type === 'button' && node.menuId === 'externalNotifications');
		if (!existingExpanded) throw new Error('expanded external fixture missing');
		for (const node of existing.expanded.nodes) {
			if (node.type === 'group') node.children = node.children.filter(child => child.id !== existingExpanded.id);
		}
		Object.assign(existingExpanded, {
			id: 'kept-expanded-external',
			shape: 'pill',
			size: 'large',
			background: '#112233',
			border: '#445566',
			foreground: '#fefefe',
			borderWidth: 4,
			borderStyle: 'dashed',
			gradientEnabled: true,
			gradientTo: '#778899',
			gradientAngle: 315,
			gradientEasing: 'ease-in-out',
			rotation: 7,
			showLabel: false,
			borderVisible: false,
		});
		const leadingWidget = createWidget('notifications');
		leadingWidget.id = 'leading-widget';
		const duplicateGroup = createGroup('重複確認');
		duplicateGroup.id = 'duplicate-group';
		duplicateGroup.background = '#203040';
		duplicateGroup.children = [createButton(source[2], { background: '#ffffff' })];
		existing.expanded.nodes = [leadingWidget, existingExpanded, ...existing.expanded.nodes, duplicateGroup];
		const existingCollapsed = existing.collapsed.buttons.find(button => button.menuId === 'externalNotifications');
		if (!existingCollapsed) throw new Error('collapsed external fixture missing');
		Object.assign(existingCollapsed, {
			id: 'kept-collapsed-external',
			shape: 'circle',
			size: 'small',
			background: '#321321',
			border: '#654654',
			foreground: '#ffffff',
			borderWidth: 2,
			borderStyle: 'double',
			gradientEnabled: true,
			gradientTo: '#987987',
			gradientAngle: 45,
			gradientEasing: 'ease-in',
			rotation: 0,
			showLabel: false,
			borderVisible: true,
		});
		existing.collapsed.buttons.push(createButton(source[2], { background: '#eeeeee' }));

		const legacy = { version: 8, activeProfileId: existing.id, profiles: [missing, existing] };
		const legacySnapshot = structuredClone(legacy);
		const migrated = sanitizeHataSideStudioStore(legacy, source);
		const expandedButtons = (profile: HataSideStudioProfile) => profile.expanded.nodes.flatMap(node => node.type === 'button' ? [node] : node.type === 'group' ? node.children.filter((child): child is HataSideButton => child.type === 'button') : []);
		const withoutExternalNodes = (profile: HataSideStudioProfile) => profile.expanded.nodes
			.filter(node => node.type !== 'button' || node.menuId !== 'externalNotifications')
			.map(node => node.type === 'group' ? { ...node, children: node.children.filter(child => child.type !== 'button' || child.menuId !== 'externalNotifications') } : node);

		expect(migrated.version).toBe(9);
		expect(migrated.activeProfileId).toBe(existing.id);
		expect(migrated.profiles.map(profile => profile.id)).toEqual([missing.id, existing.id]);
		for (const profile of migrated.profiles) {
			expect(expandedButtons(profile).filter(button => button.menuId === 'externalNotifications')).toHaveLength(1);
			expect(profile.collapsed.buttons.filter(button => button.menuId === 'externalNotifications')).toHaveLength(1);
		}

		const migratedMissing = migrated.profiles[0];
		const migratedMissingGroup = migratedMissing.expanded.nodes.find((node): node is HataSideGroup => node.id === decoratedGroup.id && node.type === 'group');
		if (!migratedMissingGroup) throw new Error('migrated group missing');
		const notificationsIndex = migratedMissingGroup.children.findIndex(child => child.type === 'button' && child.menuId === 'notifications');
		expect(migratedMissingGroup.children[notificationsIndex + 1]).toMatchObject({ type: 'button', menuId: 'externalNotifications' });
		const collapsedNotificationsIndex = migratedMissing.collapsed.buttons.findIndex(button => button.menuId === 'notifications');
		expect(migratedMissing.collapsed.buttons[collapsedNotificationsIndex + 1].menuId).toBe('externalNotifications');
		expect(withoutExternalNodes(migratedMissing)).toEqual(missing.expanded.nodes);
		expect(migratedMissing.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications')).toEqual(missing.collapsed.buttons);
		expect(migratedMissing.postButton).toEqual(missing.postButton);
		expect(migratedMissing.expanded).toMatchObject({ columns: 1, width: 'wide', parallax: true });
		expect(migratedMissing.updatedAt).toBe(missing.updatedAt);
		expect(migratedMissingGroup).toMatchObject({
			background: decoratedGroup.background,
			border: decoratedGroup.border,
			foreground: decoratedGroup.foreground,
			borderWidth: decoratedGroup.borderWidth,
			borderStyle: decoratedGroup.borderStyle,
			gradientEnabled: decoratedGroup.gradientEnabled,
			gradientTo: decoratedGroup.gradientTo,
			gradientAngle: decoratedGroup.gradientAngle,
			gradientEasing: decoratedGroup.gradientEasing,
		});
		expect(migratedMissingGroup.children.find(child => child.id === preservedWidget.id)).toEqual(preservedWidget);

		const migratedExisting = migrated.profiles[1];
		expect(migratedExisting.expanded.nodes[1]).toEqual(existingExpanded);
		expect(migratedExisting.collapsed.buttons.find(button => button.menuId === 'externalNotifications')).toEqual(existingCollapsed);
		expect(withoutExternalNodes(migratedExisting)).toEqual(withoutExternalNodes(existing));
		expect(migratedExisting.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications')).toEqual(existing.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications'));
		expect(migratedExisting.postButton).toEqual(existing.postButton);
		expect(migratedExisting.updatedAt).toBe(existing.updatedAt);
		expect(legacy).toEqual(legacySnapshot);
		expect(sanitizeHataSideStudioStore(migrated, source)).toEqual(migrated);
	});

	test('外部通知ボタンとそれを含むグループを必須項目として判定する', () => {
		const external = createButton(source[2]);
		const timeline = createButton(source[0]);
		const group = createGroup('必須項目あり');
		group.children = [timeline, external];
		expect(hataSideStudioNodeContainsRequiredMenu(external)).toBe(true);
		expect(hataSideStudioNodeContainsRequiredMenu(group)).toBe(true);
		expect(hataSideStudioNodeContainsRequiredMenu(timeline)).toBe(false);
		expect(hataSideStudioNodeContainsRequiredMenu(createWidget('clock'))).toBe(false);
	});

	test('旧プロファイルへノートボタン設定を補い、利用者の肉球・色・グラデーション設定を保持する', () => {
		const legacyProfile = createDefaultProfile(source) as any;
		delete legacyProfile.postButton;
		const migrated = sanitizeHataSideStudioStore({ version: 7, activeProfileId: legacyProfile.id, profiles: [legacyProfile] }, source);
		expect(migrated.profiles[0].postButton).toMatchObject({ icon: 'pencil', gradientEnabled: true, gradientAngle: 90 });

		const customized = {
			...legacyProfile,
			postButton: {
				icon: 'paw',
				background: '#123456',
				foreground: '#fefefe',
				gradientEnabled: true,
				gradientTo: '#abcdef',
				gradientAngle: 245,
				gradientEasing: 'ease-in-out',
			},
		};
		const sanitized = sanitizeHataSideStudioStore({ version: 8, activeProfileId: customized.id, profiles: [customized] }, source);
		expect(sanitized.profiles[0].postButton).toEqual(customized.postButton);

		customized.postButton = { icon: 'heart', background: 'url(javascript:1)', foreground: '', gradientTo: 'red', gradientAngle: 999, gradientEasing: 'spring' };
		const repaired = sanitizeHataSideStudioStore({ version: 8, activeProfileId: customized.id, profiles: [customized] }, source);
		expect(repaired.profiles[0].postButton).toMatchObject({
			icon: 'pencil',
			background: 'var(--MI_THEME-buttonGradateA)',
			foreground: 'var(--MI_THEME-fgOnAccent, #fff)',
			gradientTo: 'var(--MI_THEME-buttonGradateB)',
			gradientAngle: 360,
			gradientEasing: 'linear',
		});
	});

	test('現在の並びは同じグループが再登場しても順番を入れ替えない', () => {
		const interleaved = [
			{ id: 'timeline', icon: 'ti ti-home', label: 'タイムライン', group: 'basic' },
			{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata' },
			{ id: 'notifications', icon: 'ti ti-bell', label: '通知', group: 'basic' },
			{ id: 'hidden', icon: 'ti ti-eye-off', label: '隠す', group: 'basic', visible: false },
		];
		const profile = createDefaultProfile(interleaved);
		const expanded = profile.expanded.nodes.flatMap(node => node.type === 'group' ? node.children.map(child => child.type === 'button' ? child.menuId : '') : []);
		expect(expanded).toEqual(['timeline', 'hatagoes', 'notifications', 'externalNotifications']);
		expect(profile.collapsed.buttons.map(button => button.menuId)).toEqual(expanded);
		expect(profile.expanded.nodes).toHaveLength(3);
	});

	test('全プロファイルの拡大・縮小で既存HataGoesを優先し、位置と装飾を保持する', () => {
		const old = (menuId: string, id: string): HataSideButton => ({ ...createButton(source[0]), id, menuId, icon: 'ti ti-eye', label: '旧ラベル', targetId: 'abc123', background: '#123456' });
		const first = createDefaultProfile(source, '既存あり');
		const group = createGroup('隠したグループ');
		group.showName = false;
		group.background = '#101820';
		group.children = [old('hatafeed', 'old-in-group'), createWidget('clock')];
		const kept = { ...createButton({ id: 'hatagoes', icon: 'ti ti-heart', label: '私の入口' }), id: 'chosen', background: '#abcdef', label: '私の入口' };
		first.expanded.nodes = [old('hatask', 'old-root'), group, kept, old('hatady', 'old-last'), { ...kept, id: 'duplicate' }];
		first.collapsed.buttons = [old('hatady', 'collapsed-old'), { ...kept, id: 'collapsed-chosen' }, old('hatask', 'collapsed-last'), { ...kept, id: 'collapsed-duplicate' }];
		const second = createDefaultProfile(source, '旧のみ');
		const empty = createGroup('空のグループ');
		const legacy = old('hatafeed', 'first-old');
		second.expanded.nodes = [empty, legacy, old('hatask', 'second-old')];
		second.collapsed.buttons = [old('hatask', 'collapsed-first'), old('hatady', 'collapsed-second')];
		const absent = createDefaultProfile(source, '対象なし');
		absent.expanded.nodes = [createWidget('clock')];
		absent.collapsed.buttons = [];
		const store = sanitizeHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: first.id, profiles: [first, second, absent] });
		const [a, b, c] = store.profiles;
		expect(a.expanded.nodes.filter(node => node.type !== 'button' || node.menuId !== 'externalNotifications').map(node => node.id)).toEqual([group.id, 'chosen']);
		const retainedGroup = a.expanded.nodes.find(node => node.id === group.id);
		expect(retainedGroup).toMatchObject({ showName: false, background: '#101820' });
		expect(retainedGroup?.type === 'group' && retainedGroup.children.map(child => child.type)).toEqual(['widget']);
		expect(a.expanded.nodes.find(node => node.id === 'chosen')).toMatchObject({ ...kept, id: 'chosen' });
		expect(a.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications').map(button => button.id)).toEqual(['collapsed-chosen']);
		expect(a.collapsed.buttons.find(button => button.id === 'collapsed-chosen')).toMatchObject({ icon: 'ti ti-heart', label: '私の入口', background: '#abcdef' });
		expect(b.expanded.nodes.filter(node => node.type !== 'button' || node.menuId !== 'externalNotifications').map(node => node.id)).toEqual([empty.id, 'first-old']);
		expect(b.expanded.nodes.find(node => node.id === empty.id)).toMatchObject({ type: 'group', children: [] });
		const converted = b.expanded.nodes.find(node => node.id === 'first-old');
		expect(converted).toMatchObject({ menuId: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', background: '#123456' });
		expect(converted).not.toHaveProperty('targetId');
		expect(b.collapsed.buttons.filter(button => button.menuId !== 'externalNotifications').map(button => button.id)).toEqual(['collapsed-first']);
		const convertedCollapsed = b.collapsed.buttons.find(button => button.id === 'collapsed-first');
		expect(convertedCollapsed).toMatchObject({ menuId: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes' });
		expect(convertedCollapsed).not.toHaveProperty('targetId');
		expect(c.expanded.nodes.map(node => node.type)).toEqual(['button', 'widget']);
		expect(c.expanded.nodes.some(node => node.type === 'button' && node.menuId === 'hatagoes')).toBe(false);
		expect(c.collapsed.buttons.map(button => button.menuId)).toEqual(['externalNotifications']);
		expect(sanitizeHataSideStudioStore(store)).toEqual(store);
	});

	test('旧3項目はcatalogに現れず、既存HataGoesの候補・装飾を優先する', () => {
		const catalog = createHataSideStudioSourceCatalog([
			{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata', external: true, url: 'https://example.com' },
			{ id: 'hatafeed', icon: 'ti ti-message-report', label: 'HataFeed', group: 'hata' },
			{ id: 'hatagoes', icon: 'ti ti-heart', label: '私の入口', group: 'custom', visible: false },
			{ id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', group: 'hata' },
		]);
		expect(catalog.sidebar.map(item => item.id)).toEqual(['hatagoes']);
		expect(catalog.sidebar[0]).toMatchObject({ icon: 'ti ti-heart', label: '私の入口', group: 'custom', visible: false });
		const oldOnly = createHataSideStudioSourceCatalog([], [{ id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', external: true, url: 'https://example.com' }]);
		expect(oldOnly.more).toEqual([{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', group: 'more' }]);
		expect(createButton({ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask' })).toMatchObject({ menuId: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes' });
	});

	test('読み込み・保存・別ウィンドウ同期で旧メニューが再流入しても統合する', () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
		const key = getHataSideStudioStorageKey();
		const profile = createDefaultProfile(source);
		const old = { ...createButton(source[0]), id: 'legacy-again', menuId: 'hatask', icon: 'ti ti-eye', label: 'Hatask' };
		profile.expanded.nodes = [old];
		profile.collapsed.buttons = [{ ...old }];
		const raw: HataSideStudioStore = { version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profile.id, profiles: [profile] };
		values.set(key, JSON.stringify(raw));
		ensureHataSideStudioInitialized(source);
		expect(JSON.parse(values.get(key)!).profiles[0].expanded.nodes.some((node: HataSideButton) => node.menuId === 'hatagoes')).toBe(true);
		applyHataSideStudioStore(raw);
		expect(JSON.parse(values.get(key)!).profiles[0].collapsed.buttons.map((button: HataSideButton) => button.menuId)).toEqual(['externalNotifications', 'hatagoes']);
		window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(raw) }));
		expect(hataSideStudioStore.value.profiles[0].expanded.nodes.some(node => node.type === 'button' && node.menuId === 'hatagoes')).toBe(true);
		expect(hataSideStudioStore.value.profiles[0].expanded.nodes.some(node => node.type === 'button' && node.menuId === 'hatask')).toBe(false);
	});

	test('ワイド幅を保持し、複数列へ持ち込まれた大サイズを安全な標準へ補正する', () => {
		const profile = createDefaultProfile(source);
		const rootButton = createButton(source[0], { size: 'large' });
		const group = createGroup('二列グループ');
		group.columns = 2;
		group.children = [createWidget('clock')];
		group.children[0].size = 'large';
		profile.expanded = { nodes: [rootButton, group], columns: 2, width: 'wide', parallax: false };

		const sanitized = sanitizeHataSideStudioStore({ version: 3, activeProfileId: profile.id, profiles: [profile] }, source);
		const sanitizedProfile = sanitized.profiles[0];
		expect(sanitizedProfile.expanded.width).toBe('wide');
		expect(sanitizedProfile.expanded.nodes.find(node => node.id === rootButton.id)).toMatchObject({ type: 'button', size: 'normal' });
		const sanitizedGroup = sanitizedProfile.expanded.nodes.find(node => node.id === group.id);
		expect(sanitizedGroup?.type === 'group' && sanitizedGroup.children[0].size).toBe('normal');
	});

	test('複数列グループから外へ出した要素はルートの列数でサイズ制約を判定する', () => {
		const profile = createDefaultProfile(source);
		const group = createGroup('二列グループ');
		group.columns = 2;
		const button = createButton(source[0]);
		group.children = [button];
		profile.expanded = { nodes: [group], columns: 1, width: 'normal', parallax: false };

		expect(findHataSideNodeParentGroup(profile, button.id)?.id).toBe(group.id);
		expect(getHataSideNodeContainerColumns(profile, button.id)).toBe(2);

		group.children = [];
		profile.expanded.nodes.push(button);
		expect(findHataSideNodeParentGroup(profile, button.id)).toBeNull();
		expect(getHataSideNodeContainerColumns(profile, button.id)).toBe(1);

		// vuedraggableの更新途中に移動元側が一時的に残ってもルートを優先する。
		group.children = [button];
		expect(findHataSideNodeParentGroup(profile, button.id)).toBeNull();
		expect(getHataSideNodeContainerColumns(profile, button.id)).toBe(1);
	});

	test('拡大から縮小へコピーしてもウィジェットとグループを混入させない', () => {
		const profile = createDefaultProfile(source);
		profile.expanded.nodes.push(createWidget('flowers'));
		const copied = copyExpandedToCollapsed(profile);
		expect(copied.collapsed.buttons.map(button => button.menuId)).toEqual(['timeline', 'notifications', 'externalNotifications', 'hatagoes']);
		expect(copied.collapsed.buttons.every(button => button.type === 'button')).toBe(true);
		expect(copied.collapsed.buttons.every(button => button.borderVisible === false)).toBe(true);
	});

	test('縮小から拡大へコピーするとボタンをグループへまとめ、既存の全幅ウィジェットを保持する', () => {
		const profile = createDefaultProfile(source);
		profile.collapsed.buttons[0].size = 'large';
		const widget = createWidget('clock');
		profile.expanded.nodes.push(widget);
		const copied = copyCollapsedToExpanded(profile);
		expect(copied.expanded.nodes[0].type).toBe('group');
		expect(copied.expanded.nodes.some(node => node.id === widget.id)).toBe(true);
		const copiedGroup = copied.expanded.nodes[0];
		expect(copied.expanded.columns).toBe(1);
		expect(copiedGroup.type === 'group' && copiedGroup.columns).toBe(2);
		expect(copiedGroup.type === 'group' && copiedGroup.children.every(child => child.size === 'normal')).toBe(true);
		expect(copiedGroup.type === 'group' && copiedGroup.children.every(child => child.type !== 'button' || child.borderVisible === true)).toBe(true);
	});

	test('グループを重ねた場合は子要素を統合して元グループを消す', () => {
		const profile = createDefaultProfile(source);
		const sourceGroup = createGroup('移動元');
		sourceGroup.children = profile.collapsed.buttons.slice(0, 1);
		const targetGroup = createGroup('移動先');
		targetGroup.children = profile.collapsed.buttons.slice(1, 2);
		profile.expanded.nodes = [sourceGroup, targetGroup];
		const merged = mergeHataSideGroups(profile, sourceGroup.id, targetGroup.id);
		expect(merged.expanded.nodes).toHaveLength(1);
		expect(merged.expanded.nodes[0].type === 'group' && merged.expanded.nodes[0].children).toHaveLength(2);
	});

	test('壊れた縮小設定からグループとウィジェットを除外し、危険な値を補正する', () => {
		const profile = createDefaultProfile(source);
		const raw: any = { version: 99, activeProfileId: profile.id, profiles: [{ ...profile, collapsed: { buttons: [createWidget('clock'), { type: 'button', menuId: 'timeline', id: 'x', icon: 'ti ti-home', label: 'TL', shape: 'heart', size: 'huge', rotation: 99 }] } }] };
		const sanitized = sanitizeHataSideStudioStore(raw, source);
		expect(sanitized.version).toBe(HATA_SIDE_STUDIO_FORMAT_VERSION);
		expect(sanitized.profiles[0].collapsed.buttons).toHaveLength(2);
		expect(sanitized.profiles[0].collapsed.buttons.find(button => button.menuId === 'timeline')).toMatchObject({ shape: 'rounded', size: 'normal', rotation: 0, showLabel: false });
	});

	test('native widgetレジストリはwidgets/index.tsの全件・順序・条件メタデータと一致する', () => {
		expect(Object.keys(HATA_SIDE_NATIVE_WIDGET_REGISTRY)).toEqual(widgets);
		for (const kind of widgets) {
			const definition = HATA_SIDE_NATIVE_WIDGET_REGISTRY[kind as keyof typeof HATA_SIDE_NATIVE_WIDGET_REGISTRY];
			expect(Object.keys(definition.sizes)).toEqual(['small', 'normal', 'large']);
			expect(definition.availability.requiresFederation).toBe(federationWidgets.includes(kind));
		}
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.jobQueue.availability.adminOnly).toBe(true);
		expect(HATA_SIDE_WIDGET_REGISTRY.announcements.availability.legacy).toBe(true);
	});

	test('v5移行は壊れていた旧レイアウト既定だけを更新し、利用者の基礎設定を保持する', () => {
		const profile = createDefaultProfile(source);
		const widget = createWidget('button');
		widget.data = { label: '自分のボタン', colored: false, script: 'Mk:dialog("test")' };
		widget.sizeSettings.small.minHeight = 900;
		profile.expanded.nodes = [widget];

		const migrated = sanitizeHataSideStudioStore({ version: 4, activeProfileId: profile.id, profiles: [profile] }, source);
		const migratedWidget = migrated.profiles[0].expanded.nodes.find(node => node.id === widget.id);
		if (!migratedWidget) throw new Error('widget fixture missing');
		expect(migratedWidget.type).toBe('widget');
		if (migratedWidget.type !== 'widget') throw new Error('widget fixture missing');
		expect(migratedWidget.sizeSettings.small.minHeight).toBe(HATA_SIDE_NATIVE_WIDGET_REGISTRY.button.sizes.small.minHeight);
		expect(migratedWidget.data).toMatchObject({ label: '自分のボタン', colored: false, script: 'Mk:dialog("test")' });
	});

	test('v7移行は縮小ボタンの枠線を既定で隠し、選んだ枠色とv5のウィジェット高を保持する', () => {
		const profile = createDefaultProfile(source);
		profile.collapsed.buttons[0].border = '#123456';
		delete (profile.collapsed.buttons[0] as Partial<typeof profile.collapsed.buttons[0]>).borderVisible;
		const widget = createWidget('clock');
		widget.sizeSettings.small.minHeight = 321;
		profile.expanded.nodes = [widget];

		const migrated = sanitizeHataSideStudioStore({ version: 6, activeProfileId: profile.id, profiles: [profile] }, source);
		expect(migrated.profiles[0].collapsed.buttons[0]).toMatchObject({ border: '#123456', borderVisible: false });
		const migratedWidget = migrated.profiles[0].expanded.nodes.find(node => node.id === widget.id);
		if (!migratedWidget) throw new Error('widget fixture missing');
		expect(migratedWidget.type).toBe('widget');
		if (migratedWidget.type !== 'widget') throw new Error('widget fixture missing');
		expect(migratedWidget.sizeSettings.small.minHeight).toBe(321);
	});

	test('Studio専用のコンパクト設定は各サイズを完備し、時計の目盛りを薄くしない', () => {
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.clock.sizes.small.data.fadeGraduations).toBe(false);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.postForm.sizes.small.minHeight).toBeGreaterThanOrEqual(220);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.rssTicker.sizes.small.minHeight).toBeLessThan(HATA_SIDE_NATIVE_WIDGET_REGISTRY.rss.sizes.small.minHeight);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.earthquake.sizes.large.data.maxItems).toBe(1);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.serverMetric.sizes.small.data.view).toBe(3);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.aiscriptApp.defaultData.script).toBe('');
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.aichan.sizes.small.minHeight).toBeGreaterThanOrEqual(168);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.federation.sizes.large).toBeDefined();
	});

	test('v2の旧4種/content形式を配置ごと保持し、native dataとサイズ設定へ移行する', () => {
		const profile = createDefaultProfile(source);
		const legacyKinds = ['clock', 'flowers', 'notifications', 'announcements'] as const;
		profile.expanded.nodes = legacyKinds.map((kind, index) => ({
			...createWidget('clock'),
			id: `legacy-${index}`,
			kind,
			label: `旧${kind}`,
			data: undefined,
			sizeSettings: undefined,
			content: { small: 'compact', normal: index % 2 === 0 ? 'normal' : 'detail', large: 'detail' },
		})) as any;
		const sanitized = sanitizeHataSideStudioStore({ version: 2, activeProfileId: profile.id, profiles: [profile] }, source);
		const migrated = sanitized.profiles[0].expanded.nodes.filter(node => node.type === 'widget');

		expect(migrated.map(widget => widget.id)).toEqual(['legacy-0', 'legacy-1', 'legacy-2', 'legacy-3']);
		expect(migrated.map(widget => widget.kind)).toEqual(['clock', 'hataskFlowers', 'notifications', 'announcements']);
		expect(migrated[1]).toMatchObject({ data: {}, content: { small: 'compact', normal: 'detail', large: 'detail' } });
		expect(migrated[1].sizeSettings.normal.content).toBe('detail');
		expect(migrated[3].kind).toBe('announcements');
	});

	test('format移行は既存プロファイルとグループ配置を初期値で破棄しない', () => {
		const profile = createDefaultProfile(source);
		const group = profile.expanded.nodes[0];
		if (group?.type !== 'group') throw new Error('group fixture missing');
		delete (group as Partial<typeof group>).foreground;
		storage.getItem.mockReturnValue(JSON.stringify({ version: 2, activeProfileId: profile.id, profiles: [profile] }));

		ensureHataSideStudioInitialized(source);

		expect(hataSideStudioStore.value.profiles[0].id).toBe(profile.id);
		expect(hataSideStudioStore.value.profiles[0].expanded.nodes[0].id).toBe(group.id);
		expect(hataSideStudioStore.value.profiles[0].expanded.nodes[0]).toMatchObject({ foreground: 'var(--MI_THEME-fg)' });
		expect(storage.setItem).toHaveBeenCalledOnce();
		const persisted = storage.setItem.mock.calls[0][1];
		expect(JSON.parse(persisted).version).toBe(HATA_SIDE_STUDIO_FORMAT_VERSION);
		storage.setItem.mockClear();
		storage.getItem.mockReturnValue(persisted);
		ensureHataSideStudioInitialized(source);
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	test('保存は同一ウィンドウへCustomEventを通知し、storageイベントを別ウィンドウ変更として反映する', () => {
		const localProfile = createDefaultProfile(source, '同一ウィンドウ');
		const events: CustomEvent[] = [];
		const listener = (event: Event) => events.push(event as CustomEvent);
		window.addEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, listener);
		applyHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: localProfile.id, profiles: [localProfile] });
		window.removeEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, listener);

		expect(events).toHaveLength(1);
		expect(JSON.parse(events[0].detail.serialized).activeProfileId).toBe(localProfile.id);

		const remoteProfile = createDefaultProfile(source, '別ウィンドウ');
		const remote = JSON.stringify({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: remoteProfile.id, profiles: [remoteProfile] });
		window.dispatchEvent(new StorageEvent('storage', { key: 'hataSideStudio', newValue: remote }));
		expect(hataSideStudioStore.value.activeProfileId).toBe(remoteProfile.id);
		expect(hataSideStudioStore.value.profiles[0].name).toBe('別ウィンドウ');
	});

	test('UI S は初回のみ旧構成全体を複製し、以後の保存と通知を分離する', () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
		const initial = createDefaultProfile(source, '初期構成');
		initial.expanded.width = 'wide';
		initial.expanded.nodes.push(createWidget('clock'));
		values.set('hataSideStudio', JSON.stringify({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: initial.id, profiles: [initial] }));
		ensureHataSideStudioInitialized(source);
		const cloned = JSON.parse(values.get(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY)!);
		expect(cloned.profiles[0]).toMatchObject({ name: '初期構成', expanded: { width: 'wide' } });
		expect(cloned.profiles[0].expanded.nodes.some((node: { type: string }) => node.type === 'widget')).toBe(true);

		values.set('ui', 'simple');
		const changedLegacy = createDefaultProfile(source, '旧UI変更');
		applyHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: changedLegacy.id, profiles: [changedLegacy] });
		expect(JSON.parse(values.get(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY)!).profiles[0].name).toBe('初期構成');
		values.set('ui', 'hataskey3');
		expect(getHataSideStudioStorageKey()).toBe('hataSideStudio');
		expect(hataSideStudioStore.value.profiles[0].name).toBe('旧UI変更');
		const events: CustomEvent[] = [];
		const listener = (event: Event) => events.push(event as CustomEvent);
		window.addEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, listener);
		const changedUiS = createDefaultProfile(source, 'UI S変更');
		applyHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: changedUiS.id, profiles: [changedUiS] }, HATA_SIDE_STUDIO_UI_S_STORAGE_KEY);
		window.removeEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, listener);
		expect(events.at(-1)?.detail.storageKey).toBe(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY);
		expect(JSON.parse(values.get('hataSideStudio')!).profiles[0].name).toBe('旧UI変更');
		window.dispatchEvent(new StorageEvent('storage', { key: 'hataSideStudio', newValue: values.get('hataSideStudio') }));
		expect(hataSideStudioStore.value.profiles[0].name).toBe('旧UI変更');
	});

	test('モジュール再読込でUIを選び、旧構成がない場合はsidebar sourceでUI Sを初期化する', async () => {
		const values = new Map<string, string>([['ui', 'hataskey3']]);
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
		stopHataSideStudioSync();
		try {
			vi.resetModules();
			const uiS = await import('./hata-side-studio.js');
			expect(uiS.getHataSideStudioStorageKey()).toBe(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY);
			expect(values.has(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY)).toBe(false);
			const laterLegacy = createDefaultProfile(source, '別タブで後から編集');
			values.set('hataSideStudio', JSON.stringify({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: laterLegacy.id, profiles: [laterLegacy] }));
			uiS.ensureHataSideStudioInitialized(source);
			expect(uiS.getActiveHataSideStudioMenuIds().has('hatagoes')).toBe(true);
			expect(uiS.hataSideStudioStore.value.profiles[0].name).not.toBe('別タブで後から編集');
			expect(JSON.parse(values.get(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY)!).profiles[0].expanded.nodes.length).toBeGreaterThan(0);
			values.set('ui', 'simple');
			expect(uiS.getHataSideStudioStorageKey()).toBe(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY);
			uiS.stopHataSideStudioSync();
			vi.resetModules();
			const legacy = await import('./hata-side-studio.js');
			expect(legacy.getHataSideStudioStorageKey()).toBe('hataSideStudio');
			legacy.stopHataSideStudioSync();
		} finally {
			startHataSideStudioSync();
		}
	});

	test('旧UIで先に編集しても、再読込したUI Sは初回アクセス時の構成を使う', async () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
		const initial = createDefaultProfile(source, '複製元');
		values.set('hataSideStudio', JSON.stringify({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: initial.id, profiles: [initial] }));
		values.set('ui', 'simple');
		stopHataSideStudioSync();
		try {
			vi.resetModules();
			const legacy = await import('./hata-side-studio.js');
			expect(JSON.parse(values.get(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY)!).profiles[0].name).toBe('複製元');
			const edited = createDefaultProfile(source, '編集後');
			legacy.applyHataSideStudioStore({ version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: edited.id, profiles: [edited] });
			values.set('ui', 'hataskey3');
			expect(legacy.getHataSideStudioStorageKey()).toBe('hataSideStudio');
			legacy.stopHataSideStudioSync();
			vi.resetModules();
			const uiS = await import('./hata-side-studio.js');
			expect(uiS.getHataSideStudioStorageKey()).toBe(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY);
			expect(uiS.hataSideStudioStore.value.profiles[0].name).toBe('複製元');
			uiS.stopHataSideStudioSync();
		} finally {
			startHataSideStudioSync();
		}
	});

	test('もっと項目catalogは固定項目を拒否し、Studio削除後に候補へ自動復帰する', () => {
		const catalog = createHataSideStudioSourceCatalog([...source, { id: 'hidden', icon: 'ti ti-eye-off', label: '非表示中', visible: false }], [
			{ id: 'reload', icon: 'ti ti-refresh', label: 'リロード' },
			{ id: 'cacheClear', icon: 'ti ti-trash', label: 'キャッシュをクリア' },
			{ id: 'more', icon: 'ti ti-dots', label: 'もっと' },
			{ id: 'unsafe', icon: 'ti ti-link', label: '危険', external: true, url: 'javascript:alert(1)' },
		]);
		expect(catalog.more.map(item => item.id)).toEqual(['reload', 'cacheClear', 'unsafe']);
		expect(catalog.all.some(item => item.id === 'hidden')).toBe(true);
		expect(createDefaultProfile(catalog.all).expanded.nodes.some(node => node.type === 'group' && node.children.some(child => child.type === 'button' && child.menuId === 'hidden'))).toBe(false);
		expect(catalog.more.find(item => item.id === 'unsafe')).not.toHaveProperty('external');

		const aliased = createHataSideStudioSourceCatalog([
			{ id: 'uiSetup', icon: 'ti ti-wand', label: 'UI切り替え' },
		], [
			{ id: 'ui', icon: 'ti ti-devices', label: 'UI切り替え' },
		]);
		expect(aliased.all.map(item => item.id)).toEqual(['uiSetup']);

		const profile = createDefaultProfile(source);
		profile.expanded.nodes.push(createButton(catalog.more[0]));
		const store: HataSideStudioStore = { version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profile.id, profiles: [profile] };
		expect(getActiveHataSideStudioMenuIds(store).has('reload')).toBe(true);
		expect(getAvailableHataSideStudioMoreItems(catalog, store).map(item => item.id)).toEqual(['cacheClear', 'unsafe']);

		profile.expanded.nodes = profile.expanded.nodes.filter(node => node.type !== 'button' || node.menuId !== 'reload');
		expect(getAvailableHataSideStudioMoreItems(catalog, store).map(item => item.id)).toEqual(['reload', 'cacheClear', 'unsafe']);
	});

	test('グラデーションの方向とイージングをCSSへ反映する', () => {
		const css = gradientCss({ background: '#111111', gradientEnabled: true, gradientTo: '#eeeeee', gradientAngle: 210, gradientEasing: 'ease-in-out' });
		expect(css).toContain('linear-gradient(210deg');
		expect(css).toContain('color-mix');
	});

	test('設定一括入出力ではJSON形状とサイズを検査する', () => {
		expect(isHataSideStudioStorageString(JSON.stringify({ profiles: [] }))).toBe(true);
		expect(isHataSideStudioStorageString('{broken')).toBe(false);
		expect(isHataSideStudioStorageString(JSON.stringify({ nope: [] }))).toBe(false);
	});
});
