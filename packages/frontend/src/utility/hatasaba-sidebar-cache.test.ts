/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Hataskey UI sidebar persisted items', () => {
	test('新規設定に撤去した外部通知を置かず、通知の直後にメッセージを置く', () => {
		const def = source('src/preferences/def.ts');
		const notificationsIndex = def.indexOf("{ id: 'notifications', icon: 'ti ti-bell', label: '通知', group: 'basic' }");
		const chatIndex = def.indexOf("{ id: 'chat'");
		expect(notificationsIndex).toBeGreaterThan(-1);
		expect(chatIndex).toBeGreaterThan(notificationsIndex);
		expect(def.slice(notificationsIndex, chatIndex)).not.toContain('externalNotifications');
		expect(def).not.toContain("{ id: 'externalNotifications'");
	});

	test('撤去した外部通知をナビの項目と編集画面から外す', () => {
		const navbar = source('src/navbar.ts');
		const navbarUi = source('src/ui/_common_/navbar.vue');
		const editor = source('src/components/MkSidebarEditDialog.vue');
		expect(navbar).not.toContain('externalNotifications');
		expect(navbarUi).not.toContain("menu.includes('externalNotifications')");
		expect(navbarUi).toContain('item in navbarItemDef');
		expect(editor).toContain('const REMOVED_SIDEBAR_IDS = HATA_SIDE_STUDIO_DEAD_IDS;');
		expect(source('src/utility/hata-side-studio.ts')).toMatch(/HATA_SIDE_STUDIO_DEAD_IDS = new Set\([^\n]*'externalNotifications'/);
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

	test('サイドバー編集は並び替え可能で、撤去した外部通知を必須項目に残さない', () => {
		const editor = source('src/components/MkSidebarEditDialog.vue');
		const simple = source('src/ui/simple.vue');
		const editorRequired = editor.match(/const REQUIRED_IDS = new Set\(([^\n]+)\);/)?.[1];
		const simpleRequired = simple.match(/const REQUIRED_SIDEBAR_IDS = ([^\n]+);/)?.[1];
		expect(editorRequired).toBeDefined();
		expect(simpleRequired).toBeDefined();
		expect(editorRequired).not.toContain('externalNotifications');
		expect(simpleRequired).not.toContain('externalNotifications');
		expect(editor).toContain('v-model="editedItems"');
		expect(editor).toContain('handle=".sidebarDragHandle"');
		expect(editor).toMatch(/sidebarDragHandle[^>]+tabindex="-1"/);
		expect(editor).not.toContain('moveItemByKeyboard');
		expect(editor).not.toContain('aria-keyshortcuts="ArrowUp ArrowDown"');
	});

});
