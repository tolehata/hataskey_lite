/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

function frontendSource(path: string): string {
	return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function gardenMarkup(source: string): HTMLElement {
	const markup = source.match(/<!-- ========== GARDEN ========== -->([\s\S]*?)<!-- ========== END TAB PAGES ========== -->/u)?.[1];
	if (!markup) throw new Error('Hatask garden template was not found');
	const fragment = window.document.createElement('template');
	fragment.innerHTML = markup;
	const garden = fragment.content.querySelector<HTMLElement>('.htk-garden-page');
	if (!garden) throw new Error('Hatask garden layout root was not found');
	return garden;
}

describe('Hatask deck window layout contract', () => {
	test('PCのカレンダーは親の全列を使い、ハタキュToDoにも共通レイアウトを使う', () => {
		const source = frontendSource('src/pages/hatask.vue');
		expect(source).toContain('.htk-calendar-page > .htk-planner-shell{grid-column:1/-1;grid-row:1}');
		const todo = source.match(/<div v-if="activeTab==='todo' \|\| captureKind === 'todo'"[^>]+>/u)?.[0];
		expect(todo).toContain('class="htk-tabpage htk-todo-page"');
		const legacyGrid = /hk-panels|htk-panels/u;
		expect(legacyGrid.test('<div class="hk-panels">')).toBe(true);
		expect(legacyGrid.test(todo ?? '')).toBe(false);
	});

	test('モバイルタブは横切り捨てせず、ソートは既存の画面端補正メニューを使う', () => {
		const todo = frontendSource('src/components/hatask/HataskTodoPlanner.vue');
		const calendar = frontendSource('src/components/hatask/HataskCalendarPlanner.vue');
		expect(todo).toContain('v-if="reorderMode || isMobileTabActive(tab)"');
		expect(todo).toMatch(/\.mobileTabs\{[^}]*flex-wrap:wrap[^}]*border-radius:999px/u);
		expect(todo).toContain('await popupMenu(');
		expect(calendar).toContain('@container (max-width: 720px)');
		expect(calendar).toContain('.filters button[data-active="false"] .filterText { display: none; }');
	});

	test('きもち・ごはんは狭幅の従来配置を保ち、PCだけ見出しと入力を一体化する', () => {
		const journal = frontendSource('src/components/hatask/HataskJournal.vue');
		expect(journal).toMatch(/\.toolbar \{ display: flex;[^}]*flex-wrap: wrap;/u);
		expect(journal).toMatch(/\.tabs \{ display: flex;[^}]*overflow-x: auto;/u);
		expect(journal).toContain('@container (min-width: 760px)');
		expect(journal).toMatch(/@container \(min-width: 760px\) \{[\s\S]*?\.captureArea \{[^}]*background: var\(--surface\);[^}]*\}[\s\S]*?\.toolbar \{ display: grid; grid-template-columns: minmax\(96px, 1fr\) auto minmax\(96px, 1fr\); \}/u);
		expect(journal).toMatch(/@container \(min-width: 760px\) \{[\s\S]*?\.tabs \{[^}]*justify-self: center;/u);
	});

	test('Hataskだけ作業向けの初期寸法を使い、呼び出し側の明示寸法は上書きしない', () => {
		const osSource = frontendSource('src/os.ts');
		const windowSource = frontendSource('src/components/MkPageWindow.vue');
		expect(osSource).toContain('? { width: 760, height: 720 }');
		expect(osSource).toContain('initialWidth: options?.initialWidth ?? initialSize.width');
		expect(osSource).toContain('initialHeight: options?.initialHeight ?? initialSize.height');
		expect(windowSource).toContain(':initialWidth="initialWidth ?? 500"');
		expect(windowSource).toContain(':initialHeight="initialHeight ?? 500"');
	});

	test('小窓では標準ページ見出しを重ねず、Hatask自身の幅で一列化する', () => {
		const source = frontendSource('src/pages/hatask.vue');
		expect(source).toContain('<PageWithHeader :hideHeader="true">');
		expect(source).toContain('container-name:hatask-root');
		expect(source).toMatch(/@container hatask-root \(max-width:900px\)\{[\s\S]*?\.htk-panels\{grid-template-columns:minmax\(0,1fr\)\}/u);
		expect(frontendSource('src/components/hatask/HataskAkatsukiLayout.vue')).toContain('@container hatask-akatsuki (max-width: 599px)');
	});

	test('クイック入力の選択パネルを枠内へ収め、開閉時に縦方向へ二重移動させない', () => {
		const pageSource = frontendSource('src/pages/hatask.vue');
		const captureSource = frontendSource('src/components/hatask/HataskQuickCapture.vue');
		expect(pageSource).toMatch(/\.htk-capture-detail\{box-sizing:border-box;width:min\(100%,760px\);min-width:0;margin:0 auto 14px;/u);
		expect(pageSource).toContain(':deep(.htk-capture-detail-enter-active),:deep(.htk-capture-detail-leave-active){transition:opacity .16s ease}');
		expect(pageSource).toContain(':deep(.htk-capture-detail-enter-from),:deep(.htk-capture-detail-leave-to){opacity:0}');
		expect(pageSource).not.toContain('transform:translateY(-8px) scale(.985)');
		expect(captureSource).toContain('transition: opacity .16s ease;');
		expect(captureSource).not.toContain('transform: translateY(-5px) scale(.985);');
	});

	test('カレンダーの詳細予定カードを隣のカレンダー高へ引き伸ばさない', () => {
		const source = frontendSource('src/pages/hatask.vue');
		expect(source).toContain('class="htk-tabpage htk-calendar-page htk-panels"');
		expect(source).toContain('.htk-calendar-page{align-items:start}');
	});

	test('カレンダー詳細はドラフトを残したまま閉じられるモーダルで表示する', () => {
		const source = frontendSource('src/pages/hatask.vue');
		expect(source).toMatch(/<Teleport to="body">\s*<div\s+v-if="showEventDetails && \(!embedded \|\| paneActive \|\| captureKind !== null\)"[\s\S]*?class="htk-lg htk-modal-c htk-event-editor htk-event-editor-modal"/u);
		expect(source).toContain('role="dialog"');
		expect(source).toContain('aria-modal="true"');
		expect(source).toContain('@click.self="closeEventDetailsModal"');
		expect(source).toContain('@keydown.esc.stop.prevent="closeEventDetailsModal"');
		const closeHandler = source.match(/function closeEventDetailsModal\(\): void \{([\s\S]*?)\n\}\s*function clockPlusMinutes/u)?.[1];
		expect(closeHandler).toContain('showEventDetails.value = false');
		expect(closeHandler).not.toContain('newEvent.value=');
		expect(closeHandler).not.toContain('editingEvent.value=');
		expect(closeHandler).not.toContain('resetEventEditor');
		expect(source).toContain('max-height:min(88dvh,780px)');
		expect(source).toContain('.htk-event-editor-modal{width:min(92%,760px);max-width:760px;max-height:min(88dvh,780px);background:var(--surface);overscroll-behavior:contain}');
	});

	test('ハタキュも共通ToDo配置を使い、旧テーマの追加パネルを残さない', () => {
		const source = frontendSource('src/pages/hatask.vue');
		expect(source).toContain('<div class="htk-todo-capture-row">');
		expect(source).not.toContain('htk-capture-companion');
		expect(source).not.toContain('hk-panels');
	});

	test('きもち・ごはんの紙面は余白のある外枠へ描画する', () => {
		const journal = frontendSource('src/components/hatask/HataskJournal.vue');
		expect(journal).toContain(":global(.htk-root:not([data-theme='akatsuki'])) .board");
		expect(journal).not.toContain(":global(.htk-root:not([data-theme='akatsuki'])) .panel {");
	});

	test('お庭はテーマ共通の花ストリームとコレクションを使い、操作と再試行を保つ', () => {
		const source = frontendSource('src/pages/hatask.vue');
		const garden = gardenMarkup(source);
		expect(garden.classList.contains('htk-panels')).toBe(true);
		expect(garden.querySelectorAll('HataskFlowerStream')).toHaveLength(3);
		expect(garden.querySelector('HataskCommunityGarden')?.getAttribute(':theme')).toBe('plannerTheme');
		expect(garden.querySelector('[data-garden-group="community"]')).not.toBeNull();
		expect(garden.querySelector('[data-garden-group="personal"]')).not.toBeNull();
		expect(garden.querySelector('HataskFlowerCare')?.getAttribute('@harvested')).toBe('onFlowerHarvested');
		const handlers = [...garden.querySelectorAll('button')].map(button => button.getAttribute('@click'));
		expect(handlers.filter(handler => handler === 'loadCommunityFlowers')).toHaveLength(2);
		expect(source).toContain('popup(HataskFlowerCollection,');
		expect(frontendSource('src/components/hatask/HataskFlowerCollection.vue')).toContain('data-flower-collection-action="order"');
	});
});
