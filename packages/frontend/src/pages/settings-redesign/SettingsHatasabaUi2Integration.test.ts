/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const shellSource = source('src/pages/settings-redesign/index.vue');
const surfaceSource = source('src/pages/settings-redesign/HatasabaUi2SettingsSurface.vue');
const bodySource = source('src/components/HatasabaUi2SettingsBody.vue');
const gatewaySource = source('src/pages/settings-redesign/gateway.vue');
const viteConfigSource = source('vite.config.ts');

describe('Hataskey UI permanent surface shell integration', () => {
	test('直接開いたglassUiは既存の常設editorを使い、root一覧を上書きしない', () => {
		expect(shellSource).toContain('<HatasabaUi2SettingsSurface');
		expect(shellSource).toContain('v-else-if="isHatasabaUi2SurfaceActive"');
		expect(shellSource).toContain('<div v-else-if="!showOverview" :class="$style.legacyContent" @click.capture="onLegacyContentClickCapture"><NestedRouterView/></div>');
		expect(shellSource).toContain('currentPath.value === \'/settings/hata-custom\' && activeHataCustomCategory.value === \'glassUi\'');
		expect(shellSource).not.toContain('SETTINGS_DEFAULT_ROUTE');
		expect(shellSource).toContain('<SettingsBentoNavigation');
		expect(shellSource).toContain("const initiallyOpenHatasabaUi2Surface = isHataCustomPath(router.getCurrentFullPath())");
		expect(surfaceSource).toContain('mode="permanent"');
		expect(bodySource).toContain('<h2 id="hatasaba-ui2-title"><span class="settingsBrand">Hataskey UI</span></h2>');
		expect(bodySource).toContain('copy.ui2.permanentDescriptionSave');
		expect(viteConfigSource).toContain('filePath: \'src/components/HatasabaUi2SettingsBody.vue\'');
		expect(viteConfigSource).toContain('popup: \'hatasaba-ui2\'');
	});

	test('カテゴリ一覧とUI2プレビューで保存ownerを共有する', () => {
		expect(shellSource).toContain('<SettingsBentoNavigation');
		expect(shellSource).toContain('@select="selectBentoCategory"');
		expect(shellSource).toContain("const hataCustomGlassUiItem = destinationForId('hataskey-ui')!");
		expect(surfaceSource).toContain('const editor = useHatasabaUi2Draft();');
		expect(bodySource).toContain("if (props.editor.save()) emit('saved');");
	});

	test('an unsaved draft cancels every owned route, category, top, and legacy escape until discard succeeds', () => {
		const requestGuard = shellSource.indexOf('if (!await requestSurfaceDiscardBeforeNavigation(target)) return false;');
		const routePush = shellSource.indexOf('pushShellRoute(path);', requestGuard);
		expect(requestGuard).toBeGreaterThan(-1);
		expect(routePush).toBeGreaterThan(requestGuard);
		expect(shellSource).toContain('if (category == null || !await requestSurfaceDiscard()) return;');
		const legacyStart = shellSource.indexOf('async function requestOpenLegacy()');
		const legacyGuard = shellSource.indexOf('if (!await requestSurfaceDiscard()) return;', legacyStart);
		const legacyOpen = shellSource.indexOf("emit('openLegacy');", legacyGuard);
		expect(legacyStart).toBeGreaterThan(-1);
		expect(legacyGuard).toBeGreaterThan(legacyStart);
		expect(legacyOpen).toBeGreaterThan(legacyGuard);
		// ⚠️確認を待つ間に別の画面へ移っていることがあるため、設定にいるときだけ押す。
		//   無条件に押すと、行こうとした先から設定へ引き戻してしまう。
		const topStart = shellSource.indexOf('async function goSettingsTop()');
		const topGuard = shellSource.indexOf('if (!await requestSurfaceDiscard()) return;', topStart);
		expect(topGuard).toBeGreaterThan(topStart);
		expect(shellSource).toContain('if (!isSettingsFullPath(router.getCurrentFullPath())) return;');
		expect(shellSource).toContain("pushShellRoute('/settings')");
		expect(shellSource).toContain('router.getCurrentFullPath() !== fullPath');
		expect(shellSource).toContain(`@click="selectBentoCategory('profile')"`);
		expect(shellSource).toContain('async function runShellAction(id: string)');
		expect(shellSource).toContain('if (!await requestSurfaceDiscard()) return;');
		expect(shellSource).toContain('await settingsShellActions[id as SettingsShellActionId]();');
		expect(surfaceSource).toContain('return editor.discard();');
		expect(surfaceSource).toContain('editor.restoreLivePreviewToSnapshot();');
	});

	test('surface close, save, and side-studio events are shell-owned without changing draft persistence semantics', () => {
		expect(shellSource).toContain('@close="onSurfaceClose"');
		expect(shellSource).toContain('@saved="onSurfaceSaved"');
		expect(shellSource).toContain('@sideStudio="onSurfaceSideStudio"');
		expect(shellSource).toContain('async function onSurfaceClose() {');
		expect(shellSource).toContain('await goSettingsTop();');
		expect(shellSource).toContain('function onSurfaceSaved() {\n\tactiveNavigationTarget.value = null;');
		const studioStart = shellSource.indexOf('async function onSurfaceSideStudio()');
		const cancel = shellSource.indexOf('cancelBentoNavigation();', studioStart);
		const discard = shellSource.indexOf('if (!await requestSurfaceDiscard()) return;', cancel);
		const allow = shellSource.indexOf("settingsSurfaceLeaveGuard.allowNextNavigation('/hata-side-studio');", discard);
		const navigate = shellSource.indexOf("mainRouter.push('/hata-side-studio');", allow);
		expect(studioStart).toBeGreaterThan(-1);
		expect(cancel).toBeGreaterThan(studioStart);
		expect(discard).toBeGreaterThan(cancel);
		expect(allow).toBeGreaterThan(discard);
		expect(navigate).toBeGreaterThan(allow);
		expect(surfaceSource).toContain('@sideStudio="emit(\'sideStudio\')"');
		expect(surfaceSource).not.toContain('prefer.commit(');
	});

	test('the old-settings gateway remains available only after the shell grants the guarded escape', () => {
		expect(shellSource).toContain('@click="requestOpenLegacy"');
		expect(gatewaySource).toContain('<section v-else ref="redesignedRegion"');
		expect(gatewaySource).toContain('<SettingsRedesign @openLegacy="openLegacy"/>');
		expect(gatewaySource).toContain('<section v-if="isLegacyMode" ref="legacyRegion"');
		expect(gatewaySource).toContain('<LegacySettings/>');
		expect(gatewaySource).toContain('function openLegacy() {\n\tisLegacyMode.value = true;');
	});
});
