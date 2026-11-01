/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataskTemplateLibrary from './HataskTemplateLibrary.vue';
import type { App } from 'vue';
import type { HataskPlannerTemplate } from '@/utility/hatask-planner-storage.js';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

const labels = {
	library: 'テンプレート',
	reusable: '何度でも使える',
	filter: '種類で絞り込む',
	all: 'すべて',
	todo: 'Todo',
	event: '予定',
	empty: 'テンプレートはありません',
	emptyHint: 'よく使う内容を保存できます',
	useAction: 'この内容を使う',
	use: (name: string) => `${name}を使う`,
	duplicate: (name: string) => `${name}を複製`,
	archive: (name: string) => `${name}を保管`,
	moveUp: (name: string) => `${name}を上へ`,
	moveDown: (name: string) => `${name}を下へ`,
};

const templates: HataskPlannerTemplate[] = [
	{ id: 'event-1', kind: 'event', name: '週次会議', payload: { title: '週次会議', timeStart: '10:00' }, position: 2, archivedAt: null },
	{ id: 'todo-1', kind: 'todo', name: '朝の確認', payload: { text: '受信箱を確認' }, position: 1, archivedAt: null },
	{ id: 'todo-old', kind: 'todo', name: '古い型', payload: { text: '表示しない' }, position: 0, archivedAt: '2026-08-01T00:00:00.000Z' },
];

function mountLibrary(options: Record<string, unknown> = {}) {
	const handlers = { kind: vi.fn(), use: vi.fn(), duplicate: vi.fn(), archive: vi.fn(), move: vi.fn() };
	const app = createApp(defineComponent({
		setup() {
			return () => h(HataskTemplateLibrary, {
				templates,
				labels,
				onUse: handlers.use,
				onDuplicate: handlers.duplicate,
				onArchive: handlers.archive,
				onMove: handlers.move,
				'onUpdate:kind': handlers.kind,
				...options,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, handlers };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('HataskTemplateLibrary', () => {
	test('保管済みを隠して位置順に表示し、各操作を親へ通知する', async () => {
		const { container, handlers } = mountLibrary();
		await nextTick();
		const names = [...container.querySelectorAll('li strong')].map(element => element.textContent);
		expect(names).toEqual(['朝の確認', '週次会議']);
		expect(container.textContent).not.toContain('古い型');
		expect(container.querySelector('[aria-label="朝の確認を使う"]')?.textContent).toContain('この内容を使う');

		(container.querySelector('[aria-label="朝の確認を使う"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="朝の確認を複製"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="朝の確認を下へ"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="朝の確認を保管"]') as HTMLButtonElement).click();
		(container.querySelector('[title="予定"]') as HTMLButtonElement).click();

		expect(handlers.use).toHaveBeenCalledWith(templates[1]);
		expect(handlers.duplicate).toHaveBeenCalledWith(templates[1]);
		expect(handlers.move).toHaveBeenCalledWith(templates[1], 1);
		expect(handlers.archive).toHaveBeenCalledWith(templates[1]);
		expect(handlers.kind).toHaveBeenCalledWith('event');
	});

	test('読み取り専用時はテンプレート変更操作を無効にする', async () => {
		const { container, handlers } = mountLibrary({ readOnly: true });
		await nextTick();
		const use = container.querySelector<HTMLButtonElement>('[aria-label="朝の確認を使う"]');
		expect(use?.disabled).toBe(true);
		use?.click();
		expect(handlers.use).not.toHaveBeenCalled();
	});
});
