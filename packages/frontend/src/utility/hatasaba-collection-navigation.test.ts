/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Hataskey UIのリスト・アンテナ選択UI', () => {
	test('通常タイムラインはコレクション表示中にアクティブにならない', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('!isCollectionTimelinePage && tab === item.id');
		expect(ui).toContain('if (isCollectionTimelinePage.value) mainRouter.push(\'/\');');
	});

	test('設定ページからホームへはforcePage遷移を使う', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain("if (isPageView.value) { mainRouter.pushByPath('/', 'forcePage'); }");
		expect(ui).toContain("if (isPageView.value) { mainRouter.pushByPath('/', 'forcePage'); } else { scrollToTop(); }");
	});

	test('リストとアンテナは名前・切替・設定を同じピルに持つ', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('{{ activeListName }}');
		expect(ui).toContain('{{ activeAntennaName }}');
		expect(ui).toContain('toggleTimelinePicker(\'list\')');
		expect(ui).toContain('toggleTimelinePicker(\'antenna\')');
		expect(ui).toContain('openActiveCollectionSettings(\'list\')');
		expect(ui).toContain('openActiveCollectionSettings(\'antenna\')');
		expect(ui).toContain('mainRouter.push(\'/my/lists/:listId\', { params: { listId: id } });');
		expect(ui).toContain('mainRouter.push(\'/my/antennas/:antennaId\', { params: { antennaId: id } });');
		expect(ui).toContain('mainRouter.currentRef.value.props.get(\'listId\')');
		expect(ui).toContain('mainRouter.currentRef.value.props.get(\'antennaId\')');
		expect(ui).not.toContain('getTimelineCollectionId(mainRouter.currentRoute.value.path, \'list\')');
		expect(ui).not.toContain('getTimelineCollectionId(mainRouter.currentRoute.value.path, \'antenna\')');
		expect(ui).not.toContain('リストを追加・管理');
		expect(ui).not.toContain('アンテナの管理');
	});

	test('選択ピルは外側を押すと閉じ、コンポーネント破棄時に監視を解除する', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('ref="topNavStackEl"');
		expect(ui).toContain('window.document.addEventListener(\'pointerdown\', closeTimelinePickerOnOutsidePointer, true);');
		expect(ui).toContain('window.document.removeEventListener(\'pointerdown\', closeTimelinePickerOnOutsidePointer, true);');
		expect(ui).toContain('topNavStackEl.value?.contains(target)');
	});

	test('項目が無いときは管理画面へ直行せず、空表示とオプションを出す', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('else timelinePickerKind.value = \'list\';');
		expect(ui).toContain('else timelinePickerKind.value = \'antenna\';');
		expect(ui).toContain("timelinePickerKind === 'list' ? copy.noLists : copy.noAntennas");
		expect(ui).toContain('openEmptyCollectionOptions');
		expect(ui).toContain('<span>{{ copy.options }}</span>');
	});

	test('モバイル上部ナビはアカウントアイコンを中央に揃え、選択ピルを残り幅へ収める', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('align-items:flex-start');
		expect(ui).toContain('position:relative; z-index:1; margin-top:6px');
		expect(ui).toContain('width:max-content; min-width:0; max-width:min(680px,calc(100% - 42px)); flex:0 1 auto');
		expect(ui).toContain('width:max-content; max-width:100%; min-width:0; box-sizing:border-box');
		expect(ui).toContain('position:absolute; top:calc(100% + 7px); left:0; z-index:2');
		expect(ui).toContain('width:100%; max-width:100%; box-sizing:border-box');
		expect(ui).toContain('[$style.collectionPageContainer]: isCollectionTimelinePage');
		expect(ui).toContain('padding-top:calc(68px + env(safe-area-inset-top,0px))');
	});

	test('モバイル下部ナビは明るい背面でもテーマ前景色と高い面不透明度を使う', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('background:color-mix(in srgb,var(--MI_THEME-panel) 92%,transparent)');
		expect(ui).toContain('color:color-mix(in srgb,var(--MI_THEME-fg) 76%,transparent)');
		expect(ui).toContain('90%,');
	});

	test('リスト・アンテナ表示中もモバイル投稿ボタンを残す', () => {
		const ui = source('src/ui/simple.vue');
		expect(ui).toContain('v-if="!isPageView || isCollectionTimelinePage" :class="$style.sideBtn" data-cy-open-post-form');
	});

	test('Hataskey UIではページ側の重複ヘッダーを隠す', () => {
		for (const path of ['src/pages/user-list-timeline.vue', 'src/pages/antenna-timeline.vue']) {
			const page = source(path);
			expect(page).toContain(':popup="isHatasabaUi"');
			expect(page).toContain('miLocalStorage.getItem(\'ui\') === \'simple\'');
		}
	});
});
