/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Hataskey UI sidebar persisted items', () => {
	test('新規設定では外部通知を通知の直後かつメッセージの前に置く', () => {
		const def = source('src/preferences/def.ts');
		const notificationsIndex = def.indexOf("{ id: 'notifications'");
		const externalNotificationsIndex = def.indexOf("{ id: 'externalNotifications'");
		const chatIndex = def.indexOf("{ id: 'chat'");
		expect(notificationsIndex).toBeGreaterThan(-1);
		expect(externalNotificationsIndex).toBeGreaterThan(notificationsIndex);
		expect(chatIndex).toBeGreaterThan(externalNotificationsIndex);
		expect(def.slice(externalNotificationsIndex, externalNotificationsIndex + 140)).toContain("group: 'basic'");
	});

	test('新規設定ではリロードの直後に表示可能な通常項目として置く', () => {
		const def = source('src/preferences/def.ts');
		const reloadIndex = def.indexOf('{ id: \'reload\'');
		const cacheClearIndex = def.indexOf('{ id: \'cacheClear\'');
		expect(reloadIndex).toBeGreaterThan(-1);
		expect(cacheClearIndex).toBeGreaterThan(reloadIndex);
		expect(def.slice(reloadIndex, cacheClearIndex + 120)).toContain('label: \'キャッシュをクリア\'');
		expect(def.slice(reloadIndex, cacheClearIndex + 120)).toContain('group: \'more\'');
	});

	test('既存設定には一度だけ追加し、並び順と表示状態を上書きしない', () => {
		const boot = source('src/boot/common.ts');
		expect(boot).toContain('hata_sidebar_v7_migrated');
		expect(boot).toContain('!current.some(i => i && i.id === \'cacheClear\')');
		expect(boot).toContain('reloadIdx >= 0 ? reloadIdx + 1');
		expect(boot).not.toContain('preferSb7.commit(\'simpleUi.sidebar\', JSON.parse(JSON.stringify(newDefault)))');
	});

	test('サイドメニューから既存のキャッシュ削除処理を呼び出す', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('import { clearCache } from \'@/utility/clear-cache.js\';');
		expect(ui).toContain('cacheClear: () => { void clearCacheWithMotion(ev); }');
		expect(ui).toContain("playHataIconMotion(ev, 'cache-clear', 720)");
	});

	test('必須項目にはせず表示非表示を選べる', () => {
		const editor = source('src/components/MkSidebarEditDialog.vue');
		const requiredLine = editor.match(/const REQUIRED_IDS = new Set\(([^\n]+)\);/)?.[1] ?? '';
		expect(requiredLine).not.toContain('cacheClear');
	});

	test('外部通知はHataskey UIの両編集経路で必須だが並び替え可能にする', () => {
		const editor = source('src/components/MkSidebarEditDialog.vue');
		const simple = source('src/ui/simple.vue');
		const editorRequired = editor.match(/const REQUIRED_IDS = new Set\(([^\n]+)\);/)?.[1] ?? '';
		const simpleRequired = simple.match(/const REQUIRED_SIDEBAR_IDS = ([^\n]+);/)?.[1] ?? '';
		expect(editorRequired).toContain('externalNotifications');
		expect(simpleRequired).toContain('externalNotifications');
		expect(editor).toContain('externalNotifications: copy.itemExternalNotifications');
		expect(editor).toContain('v-model="editedItems"');
		expect(editor).toContain('handle=".sidebarDragHandle"');
		expect(editor).toMatch(/sidebarDragHandle[^>]+tabindex="-1"/);
		expect(editor).not.toContain('moveItemByKeyboard');
		expect(editor).not.toContain('aria-keyshortcuts="ArrowUp ArrowDown"');
	});

	test('portal清掃後に外部通知移行を直列実行し、sidebarの並行commitを避ける', () => {
		const boot = source('src/boot/common.ts');
		const portalIndex = boot.indexOf('await migrateRetiredPortalMenu(');
		const externalIndex = boot.indexOf('await repairExternalNotificationsSidebar();');
		const watcherIndex = boot.indexOf("watch(prefer.r['simpleUi.sidebar']");
		expect(portalIndex).toBeGreaterThan(-1);
		expect(externalIndex).toBeGreaterThan(portalIndex);
		expect(watcherIndex).toBeGreaterThan(externalIndex);
		expect(boot.slice(watcherIndex, watcherIndex + 260)).toContain('pendingRepair.then(repairExternalNotificationsSidebar)');
		expect(boot.slice(portalIndex, watcherIndex + 360)).toContain('})();');
	});
});
