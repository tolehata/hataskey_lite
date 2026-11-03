/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { federationWidgets, widgets } from '@/widgets/index.js';
import type { HataSideStudioStore } from './hata-side-studio.js';
import { HATA_SIDE_NATIVE_WIDGET_REGISTRY, HATA_SIDE_WIDGET_REGISTRY } from './hata-side-studio-widgets.js';
import {
	HATA_SIDE_STUDIO_CHANGE_EVENT,
	HATA_SIDE_STUDIO_FORMAT_VERSION,
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
	getHataSideNodeContainerColumns,
	getHataSideStudioGroupDisplayName,
	getHataSideStudioMenuDisplayLabel,
	getHataSideStudioProfileDisplayName,
	getHataSideWidgetDisplayLabel,
	gradientCss,
	hataSideStudioStore,
	isHataSideStudioStorageString,
	mergeHataSideGroups,
	sanitizeHataSideStudioStore,
} from './hata-side-studio.js';

const storage = vi.hoisted(() => ({
	getItem: vi.fn(() => null as string | null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
}));

const localeState = vi.hoisted(() => ({
	utility: {
		menuLabels: {
			timeline: 'Timeline',
			notifications: 'Notifications',
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
			menuLabels: { timeline: 'Timeline', notifications: 'Notifications' },
			groupNames: { basic: 'Core features', hata: 'Hataskey features' },
			defaultNames: {
				newGroup: 'New group',
				defaultProfile: 'Default',
				groupFallback: 'Group',
				profileFallback: 'Profile',
				collapsedCopyGroup: 'Copied from compact menu',
			},
			widgetLabels: { clock: 'Clock' },
		};
	});

	test('共通localeは表示時だけ解決し、保存値と利用者名を変更しない', () => {
		const translatedSource = [
			{ id: 'timeline', icon: 'ti ti-home', label: 'Timeline', group: 'basic' },
			{ id: 'custom-menu', icon: 'ti ti-point', label: 'My menu', group: 'custom' },
		];
		const profile = createDefaultProfile(translatedSource);
		const storedButtons = profile.expanded.nodes.flatMap(node => node.type === 'group' ? node.children.filter(child => child.type === 'button') : []);
		const widget = createWidget('clock');
		const customWidget = createWidget('clock');
		customWidget.label = 'My clock';

		expect(profile.name).toBe('デフォルト');
		expect(profile.expanded.nodes[0].type === 'group' && profile.expanded.nodes[0].name).toBe('基本機能');
		expect(storedButtons.map(button => button.label)).toEqual(['タイムライン', 'My menu']);
		expect(widget.label).toBe('時計');
		expect(getHataSideStudioProfileDisplayName(profile.name)).toBe('Default');
		expect(getHataSideStudioGroupDisplayName('基本機能')).toBe('Core features');
		expect(getHataSideStudioGroupDisplayName('利用者のグループ')).toBe('利用者のグループ');
		expect(getHataSideStudioMenuDisplayLabel('timeline', storedButtons[0].label)).toBe('Timeline');
		expect(getHataSideStudioMenuDisplayLabel('custom-menu', storedButtons[1].label)).toBe('My menu');
		expect(getHataSideWidgetDisplayLabel(widget.kind, widget.label)).toBe('Clock');
		expect(getHataSideWidgetDisplayLabel(customWidget.kind, customWidget.label)).toBe('My clock');

		const beforeLanguageSwitch = JSON.stringify({ profile, widget, customWidget });
		localeState.utility = {
			menuLabels: { timeline: '时间线', notifications: '通知' },
			groupNames: { basic: '基本功能', hata: '旗服功能' },
			defaultNames: {
				newGroup: '新建分组',
				defaultProfile: '默认',
				groupFallback: '分组',
				profileFallback: '配置',
				collapsedCopyGroup: '从收起菜单复制',
			},
			widgetLabels: { clock: '时钟' },
		};
		expect(getHataSideStudioProfileDisplayName(profile.name)).toBe('默认');
		expect(getHataSideStudioMenuDisplayLabel('timeline', storedButtons[0].label)).toBe('时间线');
		expect(getHataSideWidgetDisplayLabel(widget.kind, widget.label)).toBe('时钟');
		expect(JSON.stringify({ profile, widget, customWidget })).toBe(beforeLanguageSwitch);
		expect(beforeLanguageSwitch).not.toContain('Timeline');
		expect(beforeLanguageSwitch).not.toContain('时间线');
	});

	test('初期状態は拡大グループと縮小専用の縦一列ボタンを別々に持つ', () => {
		const profile = createDefaultProfile(source);
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
		expect(profile.expanded.nodes.every(node => node.type === 'group')).toBe(true);
		expect(profile.expanded.nodes.every(node => node.type !== 'group' || node.foreground === 'var(--MI_THEME-fg)')).toBe(true);
		expect(profile.collapsed.buttons.map(button => button.menuId)).toEqual(['timeline', 'notifications']);
		expect(profile.collapsed.buttons.every(button => button.showLabel === false && button.rotation === 0)).toBe(true);
		expect(profile.collapsed.buttons.every(button => button.border === 'var(--MI_THEME-divider)')).toBe(true);
		expect(profile.collapsed.buttons.every(button => button.borderVisible === false)).toBe(true);
		expect(profile.collapsed.buttons.some(button => button.menuId === 'more')).toBe(false);
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
			{ id: 'favorites', icon: 'ti ti-star', label: 'お気に入り', group: 'hata' },
			{ id: 'notifications', icon: 'ti ti-bell', label: '通知', group: 'basic' },
			{ id: 'hidden', icon: 'ti ti-eye-off', label: '隠す', group: 'basic', visible: false },
		];
		const profile = createDefaultProfile(interleaved);
		const expanded = profile.expanded.nodes.flatMap(node => node.type === 'group' ? node.children.map(child => child.type === 'button' ? child.menuId : '') : []);
		expect(expanded).toEqual(['timeline', 'favorites', 'notifications']);
		expect(profile.collapsed.buttons.map(button => button.menuId)).toEqual(expanded);
		expect(profile.expanded.nodes).toHaveLength(3);
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
		expect(sanitizedProfile.expanded.nodes[0]).toMatchObject({ type: 'button', size: 'normal' });
		expect(sanitizedProfile.expanded.nodes[1].type === 'group' && sanitizedProfile.expanded.nodes[1].children[0].size).toBe('normal');
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
		profile.expanded.nodes.push(createWidget('clock'));
		const copied = copyExpandedToCollapsed(profile);
		expect(copied.collapsed.buttons.map(button => button.menuId)).toEqual(['timeline', 'notifications']);
		expect(copied.collapsed.buttons.every(button => button.type === 'button')).toBe(true);
		expect(copied.collapsed.buttons.every(button => button.borderVisible === false)).toBe(true);
	});

	test('縮小から拡大へコピーするとボタンをグループへまとめ、既存の全幅ウィジェットを保持する', () => {
		const profile = createDefaultProfile(source);
		const widget = createWidget('clock');
		profile.expanded.nodes.push(widget);
		const copied = copyCollapsedToExpanded(profile);
		expect(copied.expanded.nodes[0].type).toBe('group');
		expect(copied.expanded.nodes.some(node => node.id === widget.id)).toBe(true);
		const copiedGroup = copied.expanded.nodes[0];
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
		expect(sanitized.profiles[0].collapsed.buttons).toHaveLength(1);
		expect(sanitized.profiles[0].collapsed.buttons[0]).toMatchObject({ shape: 'rounded', size: 'normal', rotation: 0, showLabel: false });
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
		const migratedWidget = migrated.profiles[0].expanded.nodes[0];
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
		const migratedWidget = migrated.profiles[0].expanded.nodes[0];
		expect(migratedWidget.type).toBe('widget');
		if (migratedWidget.type !== 'widget') throw new Error('widget fixture missing');
		expect(migratedWidget.sizeSettings.small.minHeight).toBe(321);
	});

	test('Studio専用のコンパクト設定は各サイズを完備し、時計の目盛りを薄くしない', () => {
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.clock.sizes.small.data.fadeGraduations).toBe(false);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.postForm.sizes.small.minHeight).toBeGreaterThanOrEqual(220);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.rssTicker.sizes.small.minHeight).toBeLessThan(HATA_SIDE_NATIVE_WIDGET_REGISTRY.rss.sizes.small.minHeight);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.serverMetric.sizes.small.data.view).toBe(3);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.aiscriptApp.defaultData.script).toBe('');
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.aichan.sizes.small.minHeight).toBeGreaterThanOrEqual(168);
		expect(HATA_SIDE_NATIVE_WIDGET_REGISTRY.federation.sizes.large).toBeDefined();
	});

	test('v2の旧4種/content形式を配置ごと保持し、native dataとサイズ設定へ移行する', () => {
		const profile = createDefaultProfile(source);
		const legacyKinds = ['clock', 'clock', 'notifications', 'announcements'] as const;
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
		expect(migrated.map(widget => widget.kind)).toEqual(['clock', 'clock', 'notifications', 'announcements']);
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
		expect(JSON.parse(storage.setItem.mock.calls[0][1]).version).toBe(HATA_SIDE_STUDIO_FORMAT_VERSION);
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
