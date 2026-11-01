/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { App } from 'vue';
import { useTooltip } from '@/composables/use-tooltip.js';

function source(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('iPhoneのノート操作をタッチ補助UIが奪わない', () => {
	let app: App<Element> | undefined;
	let container: HTMLDivElement | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		app?.unmount();
		container?.remove();
		app = undefined;
		container = undefined;
		vi.useRealTimers();
	});

	test('通常ツールチップはタッチ開始からポップアップを開かない', () => {
		const directive = source('src/directives/tooltip.ts');

		expect(directive).toContain('el.addEventListener(\'mouseenter\'');
		expect(directive).toContain('if (isTouchUsing) return;');
		expect(directive).not.toMatch(/addEventListener\(['"]touchstart['"][\s\S]{0,500}state\.show/);
	});

	test('利用者一覧ツールチップはタッチ時に閉じ、touchcancelも後始末する', () => {
		const composable = source('src/composables/use-tooltip.ts');

		expect(composable).toContain('const cancelTouchTooltip = () => {');
		expect(composable).toContain('el.addEventListener(\'touchstart\', cancelTouchTooltip');
		expect(composable).toContain('el.addEventListener(\'touchcancel\', cancelTouchTooltip');
		expect(composable).not.toMatch(/const onTouchstart[\s\S]{0,300}window\.setTimeout\(open/);
	});

	test('実際のタッチ後に合成mouseoverが来てもツールチップを開かない', async () => {
		const onShow = vi.fn();
		const target = ref<HTMLElement | null>(null);
		app = createApp(defineComponent({
			setup() {
				useTooltip(target, onShow, 10);
				return () => h('button', { ref: target });
			},
		}));
		container = window.document.createElement('div');
		window.document.body.appendChild(container);
		app.mount(container);
		await nextTick();

		const button = container.querySelector('button');
		if (button == null) throw new Error('テスト用ボタンを生成できませんでした');
		button.dispatchEvent(new Event('touchstart', { bubbles: true }));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(30);
		expect(onShow).not.toHaveBeenCalled();

		button.dispatchEvent(new Event('touchend', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(1200);
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(10);
		expect(onShow).toHaveBeenCalledOnce();
	});

	test('通常・詳細・サブノートの操作ボタンはiOSのタップ操作を優先する', () => {
		for (const component of ['MkNote.vue', 'MkNoteDetailed.vue', 'MkSubNoteContent.vue']) {
			const componentSource = source(`src/components/${component}`);
			expect(componentSource).toMatch(/\.(?:noteFooterButton|footerButton)\s*\{[\s\S]{0,180}touch-action:\s*manipulation;/);
		}
	});

	test('既存リアクションは短いタップと段階的な長押しを別経路で扱う', () => {
		const reaction = source('src/components/MkReactionsViewer.reaction.vue');

		expect(reaction).toContain('@click.stop="onReactionClick"');
		expect(reaction).toContain('@touchcancel.stop="onReactionTouchCancel"');
		expect(reaction).toContain('new ReactionTouchGesture({');
		expect(reaction).not.toContain('openEmojiMenu');
		expect(reaction).not.toMatch(/window\.setTimeout\([\s\S]{0,120}stealReaction/);
	});
});
