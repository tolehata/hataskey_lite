/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const read = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, 'utf8');

describe('HataSideStudio UI integration', () => {
	test('ノートボタンの肉球アイコン・色・グラデーションをプレビューと実サイドメニューへ反映する', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		expect(studio).toContain("activeProfile.postButton.icon = 'paw'");
		expect(studio).toContain('class="ti ti-paw"');
		expect(studio).toContain('<GradientEditor v-if="!isUiS" :modelValue="activeProfile.postButton"/>');
		expect(studio).toContain(':style="postButtonStyle(activeProfile.postButton)"');
		expect(simple.match(/:style="studioPostButtonStyle"/g)).toHaveLength(2);
		expect(simple.match(/:style="studioPostButtonStyle"[^>]*>\s*<i :class="composeIcon"/g)).toHaveLength(2);
		expect(simple).toContain("studioProfile.value.postButton.icon === 'paw' ? 'ti ti-paw' : 'ti ti-pencil'");
	});

	test('モバイルのHataskey UIドロワーにも固定のもっとメニューを表示する', () => {
		const simple = read('ui/simple.vue');
		expect(simple).toContain('data-hatasaba-mobile-more');
		expect(simple).toContain('@click="openMore($event, true)"');
		expect(simple).toContain("if (id === 'more' && ev && simpleDrawerShowing.value)");
		expect(simple).toContain('if (closeMobileDrawerAfter) simpleDrawerShowing.value = false;');
	});

	test('Hataskプレビューはローカル日付を使い、アーカイブ済みTodoを保留数から除外する', () => {
		const simple = read('ui/simple.vue');
		expect(simple).toContain("return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;");
		expect(simple).toContain('todos.filter(todo => todo.done !== true && todo.archivedAt == null)');
	});

	test('縮小サイドバーは専用ボタン配列だけを描画し、縦一列を固定する', () => {
		const simple = read('ui/simple.vue');
		const studio = read('pages/hata-side-studio.vue');
		expect(simple).toContain('v-for="item in studioCollapsedButtons"');
		expect(simple).toContain('内幅48pxへ左右2pxずつ余白を残し');
		expect(simple).toContain('flex-direction:column');
		expect(simple).toContain('width:calc(100% - 4px)');
		expect(simple).toContain('max-width:44px');
		expect(simple).not.toMatch(/v-for="item in studioCollapsedButtons"[\s\S]{0,300}type === 'widget'/);
		expect(simple).toContain("item.type !== 'button' || item.borderVisible !== false");
		expect(studio).toContain("node.type !== 'button' || node.borderVisible !== false");
		expect(studio).toContain('copy.showBorder');
		expect(studio).toContain('copy.collapsedBorderHiddenDescription');
	});

	test('外部通知はStudioプロファイルの保存位置で描画し、未連携時だけ隠して未読を表示する', () => {
		const simple = read('ui/simple.vue');
		expect(simple).toContain("const isExternalLinked = computed(() => prefer.r['external.enabled'].value && prefer.r['external.token'].value != null);");
		expect(simple).toContain("if (menuId === 'externalNotifications') return isExternalLinked.value;");
		expect(simple).toContain("if (item.id === 'externalNotifications' && !isExternalLinked.value) continue;");
		expect(simple).toContain('externalNotifications: () => goToExternalNotifications()');
		expect(simple.match(/item\.menuId==='externalNotifications' && extNotifHasUnread/g)).toHaveLength(1);
		expect(simple.match(/child\.menuId==='externalNotifications' && extNotifHasUnread/g)).toHaveLength(2);
		expect(simple.match(/node\.menuId==='externalNotifications' && extNotifHasUnread/g)).toHaveLength(2);
		expect(simple).not.toContain("!studioCollapsedButtons.some(item => item.menuId === 'externalNotifications')");
		expect(simple).not.toContain("!studioExpandedMenuIds.has('externalNotifications')");
		expect(simple).not.toContain('const studioExpandedMenuIds');
		expect(simple).not.toContain('const extNotifItem');
		expect(simple).not.toContain('basic.items.splice(notifIdx2 + 1');
	});

	test('Hataskey UIの通知・外部通知・お知らせバッジをメニューボタンの縦中央へ揃える', () => {
		const simple = read('ui/simple.vue');
		for (const selector of ['.sbBadge', '.sbExtDot', '.sbDot', '.sbNotifDot']) {
			const block = simple.slice(simple.indexOf(`${selector} {`), simple.indexOf('}', simple.indexOf(`${selector} {`)));
			expect(block).toContain('top:50%');
			expect(block).toContain('transform:translateY(-50%)');
		}
	});

	test('外部通知とそれを含むグループは、確認ダイアログより前に削除を拒否する', () => {
		const studio = read('pages/hata-side-studio.vue');
		const requestRemove = studio.slice(studio.indexOf('async function requestRemoveNode'), studio.indexOf('function activateProfile'));
		expect(studio).toContain('hataSideStudioNodeContainsRequiredMenu');
		expect(requestRemove).toContain('if (hataSideStudioNodeContainsRequiredMenu(node))');
		expect(requestRemove).toContain("os.toast(i18n.ts._hata._sidebarEditor.alwaysVisible, 'ti ti-lock')");
		expect(requestRemove.indexOf('hataSideStudioNodeContainsRequiredMenu(node)')).toBeLessThan(requestRemove.indexOf('askStudioConfirm'));
		expect(requestRemove.indexOf('return;')).toBeLessThan(requestRemove.indexOf('askStudioConfirm'));
	});

	test('編集画面は拡大と縮小の相互コピー、PC二ペイン、削除モードを備える', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('copyLayout(\'expandedToCollapsed\')');
		expect(studio).toContain('copyLayout(\'collapsedToExpanded\')');
		expect(studio).toContain('grid-template-columns:minmax(390px,1fr) minmax(430px,1fr)');
		expect(studio).toContain('deleteMode = !deleteMode');
		expect(studio).toContain('copy.saveChangesQuestion');
		expect(studio).toContain('src:url(\'/client-assets/Righteous-Regular.woff2\')');
		expect(studio).toContain('font-family:\'Righteous\'');
		expect(studio).toContain('instance.iconUrl');
		expect(studio).toContain('$i?.avatarUrl');
		expect(studio).toContain('copy.importCurrentOrder');
		expect(studio).toContain('buttonPickerOpen');
		expect(studio).toContain('quickEditorOpen');
	});

	test('その場で調整はグラデーション、詳細設定、グループ編集を実際の操作へ接続する', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('<GradientEditor v-if="!isUiS" :modelValue="selected"/>');
		expect(studio).toContain('const GradientEditor = defineComponent');
		expect(studio).toContain("h(GradientEditor, { modelValue: props.modelValue })");
		expect(studio).toContain("h('span', copy.secondColor)");
		expect(studio).toContain("h('span', copy.colorTransition)");
		expect(studio).toContain('style: { background: gradientCss(value) }');
		expect(studio).toContain('openSelectedInspector');
		expect(studio).toContain('inspectorPaneEl.value?.scrollIntoView');
		expect(studio).toContain('@click.stop="openQuickEditor(node.id)"');
		expect(studio).toContain('copy.adjustGroupHere');
		expect(studio).toContain('copy.grid');
	});

	test('グループへのドラッグ、高度な並び替え、機能ラベルを省略しない', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain(':group="groupChildDragGroup"');
		expect(studio).toContain('copy.dropButtonOrWidgetHere');
		expect(studio).toContain('copy.advancedReorder');
		expect(studio).toContain('moveReorderItem');
		expect(studio).toContain('copy.createWidget');
		expect(studio).toContain('copy.createGroup');
		expect(studio).toContain('copy.createButton');
		expect(studio).toContain(':data-container="section.id"');
		expect(studio).toContain('.reorderSection:not([data-container="root"])');
		expect(studio).toContain('.dragTimelineSection:not([data-container="root"])');
		expect(studio).toContain('notifyDragConstraint();');
		expect(studio).toContain(':data-disabled="!canUseTimelineContainer(section.id) ? \'true\' : undefined"');
		expect(studio).toContain('.dragTimelineGap[data-disabled="true"]');
	});

	test('モバイルのドラッグは座標から簡易タイムラインを判定し、上部操作を機能ごと整列する', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('data-timeline-drop');
		expect(studio).toContain('window.document.elementsFromPoint(dragPointer.value.x, dragPointer.value.y)');
		expect(studio).toContain('updateDragDropTargetFromPoint();');
		expect(studio).toContain("const target = pointTarget('[data-timeline-drop]');");
		expect(studio).not.toContain('pointTarget<never>');
		expect(studio).toContain('const width = Math.min(compact ? 300 : 224, window.innerWidth - 24);');
		expect(studio).toContain('.profileBar { width:100%;padding:4px;box-sizing:border-box;justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;');
		expect(studio).toContain('.headerControlGroup { margin-left:auto;flex:0 0 auto; }');
		expect(studio).toContain('.sideTools[data-side="right"] { top:91px;right:auto;left:8px;display:flex;justify-content:flex-start; }');
		expect(studio).toContain('.dragTimelineGap { min-height:38px;');
	});

	test('丸型を固定寸法へ収め、錠剤型を左右対称にする', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		expect(studio).toContain('.previewButton[data-shape="circle"] { width:44px');
		expect(studio).toContain('.previewButton[data-shape="pill"] { width:calc(100% - 8px);margin-inline:4px');
		expect(studio).toContain('.collapsedButton { position:relative;display:grid!important;place-items:center;align-self:center;flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;');
		expect(simple).toContain('.hssButton[data-hss-shape="circle"]');
		expect(simple).toContain('width:calc(100% - 4px);margin-inline:2px;border-radius:999px');
		expect(studio).toContain("{ value: 'pill', label: copy.capsule }");
	});

	test('枠線の四隅を選択枠や回転で切らず、回転時だけ必要な上下幅を予約する', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain("'--hss-rotation-space': `${rotationSpace}px`");
		expect(studio).toContain('margin-block:var(--hss-rotation-space,0)');
		expect(studio).toContain('background-clip:padding-box');
		expect(studio).toContain('outline:2px solid var(--studioAccent)');
		expect(studio).not.toContain('box-shadow:inset 0 0 0 2px var(--studioAccent)');
	});

	test('全native widgetを実コンポーネントで描画し、サイズ別設定を編集できる', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		expect(studio).toContain('HATA_SIDE_WIDGET_REGISTRY');
		expect(studio).toContain('resolveDynamicComponent(`widget-${nativeKind}`)');
		expect(studio).toContain('widgetSizeSettingEntries');
		expect(studio).toContain('copy.widgetContent');
		expect(simple).toContain('studioWidgetComponent');
		expect(simple).toContain(':widget="studioWidgetModel(');
	});

	test('低コントラストのグループへ端末内判定のポップオーバーと一括文字色変更を出す', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('inspectHataSideContrast');
		expect(studio).toContain('copy.lowContrastColors');
		expect(studio).toContain('applyGroupTextColor');
		expect(studio).toContain('for (const child of group.children) child.foreground = color');
	});

	test('確認・チュートリアルは小窓で表示し、終了は設定へreplaceする', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('<Teleport to="body">');
		expect(studio).toContain('studioDialogWindow');
		expect(studio).toContain('tutorialWindow');
		expect(studio).toContain('z-index:3500000');
		expect(studio).toContain('.creationPicker,.quickEditor,.reorderWindow,.dragTimeline,.studioDialogWindow,.windowLayer,.tutorialWindow { pointer-events:auto; }');
		expect(studio).toContain('transform:translate(-50%,-50%)');
		expect(studio).toContain('.header.tutorialFocus,.sidebarPreview.tutorialFocus { position:relative; }');
		expect(studio).toContain("claimAchievement('hataSideStudioPioneer')");
		expect(studio).toContain("studioRouter.replace('/settings/hata-custom')");
		expect(studio).not.toContain('modalBackdrop');
	});

	test('Hataskey UIデッキで内側の戻るボタンを隠し、Studioの窓と保存操作を前面で保つ', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain("miLocalStorage.getItem('ui') === 'simple' && prefer.r['simpleUi.deckMode'].value === true");
		expect(studio).toContain('v-if="!isHatasabaDeckUi"');
		expect(studio).toContain('ref="studioDialogControl"');
		expect(studio).toContain('studioDialogControl.value?.focus');
		expect(studio).toContain('{{ hasChanges ? copy.save : copy.saved }}');
		expect(studio).not.toContain(':disabled="!hasChanges"');
		expect(studio).toContain('cloneHataSideStudioStore(hataSideStudioStore.value)');
	});

	test('ホバー操作、列崩れ防止、ドラッグ先削除、ワイド幅を実装する', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		expect(studio).toContain('canSetNodeSize');
		expect(studio).toContain('canSetRootColumns');
		expect(studio).toContain('canSetGroupColumns');
		expect(studio).toContain('canUseTimelineContainer');
		expect(studio).toContain('dragTimelineDelete');
		expect(studio).toContain('dragTimelineGap');
		expect(studio).toContain('copy.insertInGap');
		expect(studio).toContain('sidebarPreviewEl.value?.getBoundingClientRect()');
		expect(studio).toContain('opacity:0;visibility:hidden;pointer-events:none');
		expect(studio).toContain('[data-node-id]:hover > .dragHandle');
		expect(studio).toContain("activeProfile.expanded.width === 'wide'");
		expect(simple).toContain("studioProfile.expanded.width === 'wide'");
		expect(simple).toContain('.sidebarWide');
	});

	test('ウィジェット補正をHataSideStudio内だけへ閉じ、専用の花・地震表示を使う', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		const flowers = read('components/HataSideStudioFlowers.vue');
		const earthquake = read('components/HataSideStudioEarthquake.vue');
		expect(studio).toContain('HataSideStudioFlowers');
		expect(studio).toContain('HataSideStudioEarthquake');
		expect(simple).toContain('data-hss-kind');
		expect(simple).toContain('onStudioWidgetWheel');
		expect(flowers).toContain('{{ flower.progress }}%');
		expect(flowers).toContain('{{ remainingText }}');
		expect(earthquake).toContain('MkEarthquakeTicker');
		expect(earthquake).not.toContain('v-for="quake');
		expect(simple).toContain('.hssWidget[data-hss-kind="postForm"]');
		expect(simple).toContain('font-variant-numeric:tabular-nums');
		expect(simple).toContain("if (widget.kind === 'serverMetric' && widget.size === 'small') data.view = 3");
		expect(simple).toContain('--hss-aichan-scale');
		expect(studio).toContain('height:350px!important');
		expect(earthquake).toContain('transform:none');
		expect(simple).toContain('[data-scroll-anchor]:nth-child(n+3)');
	});

	test('投稿フォームの下部ツール列は独立した横スクロール幅を持つ', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		for (const source of [studio, simple]) {
			expect(source).toContain('.mkw-post-form footer > div');
			expect(source).toContain('width:max-content!important');
			expect(source).toContain('flex:0 0 38px!important');
		}
		expect(studio).toContain('onPreviewPostFormWheel');
		expect(simple).toContain("closest?.('.mkw-post-form footer')");
	});

	test('モバイルもStudioプロファイルを描画し、Hataskとサーバーメニューに起動導線を持つ', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		const hatask = read('pages/hatask.vue');
		expect(simple).toContain('$style.hssMobileRoot');
		expect(simple).toContain('submitStudioMobileSearch');
		expect(simple).toContain('copy.openHataSideStudio');
		expect(hatask).toMatch(/label:\s*'HataSideStudio'/);
		expect(hatask).toContain("routeRouter.push('/hata-side-studio')");
		expect(hatask).toMatch(/label:\s*copy\.appWhatsNew/);
		expect(hatask).toContain("import('@/components/MkHataWhatsNew.vue')");
		expect(studio).not.toContain('端末内で編集');
		expect(studio).toContain('copy.exportImportSettings');
	});

	test('縮小プレビューのモード切替はChromeでも中央に収まる固定寸法を使う', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).toContain('.sidebarPreviewCollapsed .modeToggle { width:44px;margin-inline:auto;');
		expect(studio).toContain('.modeToggle button { display:grid;place-items:center;width:100%;min-width:0;');
	});

	test('小ウィジェットを切り抜かず内容高へ伸ばし、複数行型はサイズ別の完結件数に絞る', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		expect(simple).toContain('onStudioWidgetWheel(child.kind, $event)');
		expect(simple).toContain("if (kind !== 'postForm') return;");
		expect(simple).toMatch(/\.hssWidget \{[\s\S]*?height:auto;[\s\S]*?min-height:calc\(var\(--hss-widget-min-height, 72px\) \+ 10px\);/);
		expect(simple).toContain('.hssWidgetFrame { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-min-height,72px);box-sizing:border-box;overflow:visible;');
		expect(simple).toContain('.hssWidget[data-hss-kind="trends"][data-hss-size="small"] :global(.tags > div:nth-child(n+2))');
		expect(simple).toContain('.hssWidget[data-hss-kind="federation"][data-hss-size="large"] :global(.instances > .instance:nth-child(n+4))');
		expect(simple).toContain('.hssWidget[data-hss-kind="notifications"] :global(.mkw-notifications)');
		expect(simple).toContain('height:auto!important;min-height:var(--hss-widget-min-height,112px)!important;');
		expect(simple).toContain('.hssWidget[data-hss-kind="externalNotifications"][data-hss-size="small"]');
		expect(simple).toContain('.hssWidget[data-hss-kind="photos"][data-hss-size="small"]');
		expect(simple).toContain('.hssWidget[data-hss-kind="userList"][data-hss-size="small"]');
		expect(simple).toContain('.hssWidget[data-hss-kind="chat"][data-hss-size="small"]');
		expect(simple).toContain('.hssWidget[data-hss-kind="instanceCloud"] :global(.mkw-instance-cloud canvas)');
		expect(simple).not.toContain('.hssWidget[data-hss-size="small"] .hssWidgetFrame > * { max-height:100%;overflow:hidden!important; }');
		expect(studio).toContain('.nativeWidgetPreview { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-height,160px);');
		expect(studio).toContain('.nativeWidgetFrame { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-height,160px);box-sizing:border-box;overflow:visible;');
		expect(studio).toContain('copy.contentGrowsWithoutClipping');
		expect(studio).not.toContain('.nativeWidgetPreview[data-hss-size="small"] .nativeWidgetFrame > * { max-height:100%;overflow:hidden!important; }');
	});

	test('フロント画面へTabler Iconsのライセンス文を表示しない', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).not.toContain('Tabler Iconsは');
		expect(studio).not.toContain('$style.license');
	});

	test('もっと内の項目をStudioへ移し、保存中だけランチパッドから除外する', () => {
		const studio = read('pages/hata-side-studio.vue');
		const launchPad = read('components/MkLaunchPad.vue');
		expect(studio).toContain('navbarItemDef');
		expect(studio).toContain('createHataSideStudioSourceCatalog');
		expect(launchPad).toContain('getActiveHataSideStudioMenuIds');
		expect(launchPad).toContain('hataSideStudioStore');
		expect(launchPad).toContain('hiddenFromLaunchPad');
		expect(launchPad).toContain('normalizeHataSideStudioMenuId');
	});

	test('合意済みモックの主要操作と実データプレビューを省略しない', () => {
		const studio = read('pages/hata-side-studio.vue');
		const simple = read('ui/simple.vue');
		const hatask = read('pages/hatask.vue');
		const routes = read('router.definition.ts');
		expect(studio).toContain('copy.createWidget');
		expect(studio).toContain('copy.createGroup');
		expect(studio).toContain('copy.createButton');
		expect(studio).toContain('copy.copyOrder');
		expect(studio).toContain('togglePreviewWidth');
		expect(studio).toContain('instance.name');
		expect(studio).toContain('instance.iconUrl');
		expect(studio).toContain('$i?.name');
		expect(studio).toContain('$i?.avatarUrl');
		expect(studio).toContain('resetConfirmOpen');
		expect(studio).toContain('leaveConfirmOpen');
		expect(studio).toContain('dragHintVisible');
		expect(studio).not.toContain('この構成を試す');
		expect(simple).toContain("api('i/notifications', { limit: 1, markAsRead: false })");
		expect(simple).toContain("api('chat/history', { room: false })");
		expect(simple).toContain("api('hata/hatady/stats', { tzOffset: hatadyTzOffset() })");
		expect(simple).toContain("api('hata/feedback/available', {})");
		expect(simple).toContain("targetPath: `/hatask?tab=${tabs[index] ?? 'home'}`");
		expect(routes).toMatch(/path: '\/hatask',[\s\S]{0,100}query: \{[\s\S]{0,50}tab: 'tab'/);
		expect(hatask).toContain("routeRouter.currentRef.value.props.get('tab')");
	});

	test('公開テーマの送受信処理は検証前の段階では実装しない', () => {
		const studio = read('pages/hata-side-studio.vue');
		expect(studio).not.toContain('publishTheme');
		expect(studio).not.toContain('misskeyApi(\'hata/side-studio');
	});
});
