/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataskEventMoveDialog from './HataskEventMoveDialog.vue';
import type { App } from 'vue';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

const labels = {
	moveEyebrow: '予定の日付変更',
	moveTitle: '移動する？ 複製する？',
	moveDescription: '元の予定を残すか選べます',
	move: '移動',
	moveHint: '元の日から移します',
	copy: '複製',
	copyHint: '元の日にも残します',
	trashEyebrow: '予定を捨てる',
	trashTitle: 'この予定を削除しますか',
	trashDescription: '削除前にもう一度確認します',
	trash: '削除',
	cancel: 'キャンセル',
};

function mountDialog(options: Record<string, unknown> = {}) {
	const choose = vi.fn();
	const app = createApp(defineComponent({
		setup() {
			return () => h(HataskEventMoveDialog, {
				isOpen: true,
				mode: 'reschedule',
				eventTitle: '定例会議',
				sourceLabel: '8月30日',
				targetLabel: '8月31日',
				labels,
				onChoose: choose,
				...options,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { choose };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('HataskEventMoveDialog', () => {
	test('移動と複製を明示して選択結果を親へ返す', async () => {
		const { choose } = mountDialog();
		await nextTick();
		await nextTick();
		const dialog = window.document.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(dialog?.textContent).toContain('定例会議');
		if (dialog == null) throw new Error('move dialog was not rendered');
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		buttons.find(button => button.textContent.includes('移動'))?.click();
		buttons.find(button => button.textContent.includes('複製'))?.click();
		expect(choose).toHaveBeenNthCalledWith(1, 'move');
		expect(choose).toHaveBeenNthCalledWith(2, 'copy');
	});

	test('Escapeは取り消し、ゴミ箱モードは削除だけを提示する', async () => {
		const { choose } = mountDialog({ mode: 'trash' });
		await nextTick();
		await nextTick();
		const dialog = window.document.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog?.textContent).toContain('この予定を削除しますか');
		expect(dialog?.textContent).not.toContain('元の日にも残します');
		if (dialog == null) throw new Error('trash dialog was not rendered');
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(choose).toHaveBeenCalledWith('cancel');
		const trash = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent.trim() === '削除');
		trash?.click();
		expect(choose).toHaveBeenCalledWith('trash');
	});
});
