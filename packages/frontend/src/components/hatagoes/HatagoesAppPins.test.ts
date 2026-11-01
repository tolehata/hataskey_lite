/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref } from 'vue';
import { HATAGOES_CATALOG } from '@/utility/hatagoes-catalog.js';
import { getHatagoesAppPinCandidates, normalizeHatagoesAppPins } from '@/utility/hatagoes-app-pins.js';
import HatagoesAppPins from './HatagoesAppPins.vue';

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; });

async function mount(initialPins: string[] = []) {
	const props = reactive({ pins: initialPins, screens: HATAGOES_CATALOG, ready: true, saving: false, error: false });
	const save = vi.fn();
	const close = vi.fn();
	const editor = ref<{ requestClose: () => void } | null>(null);
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatagoesAppPins, { ...props, ref: editor, onSave: save, onClose: close }) });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	await nextTick();
	return { target, props, save, close, editor };
}

function candidate(target: ParentNode, label: string): HTMLLIElement {
	const found = [...target.querySelectorAll<HTMLLIElement>('ul li')].find(item => item.textContent?.includes(label));
	if (!found) throw new Error(`Missing app: ${label}`);
	return found;
}

function button(target: ParentNode, label: string): HTMLButtonElement {
	const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label);
	if (!found) throw new Error(`Missing button: ${label}`);
	return found;
}

describe('K22 App pin editor', () => {
	test('keeps saved legacy pins while hiding apps outside the mock directory', () => {
		const ids = ['hatask.scratchpad', 'hatask.reversi', 'hatask.bubble-game', 'hatask.play', 'hatask.gallery'];
		expect(normalizeHatagoesAppPins(ids)).toEqual(ids);
		const groups = new Map(getHatagoesAppPinCandidates().map(item => [item.id, item.group]));
		expect(ids.map(id => groups.get(id))).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(groups.get('hatask.recipe')).toBe('hatask');
		expect(groups.get('hatask.emotion-analysis')).toBe('hataskey');
	});
	test('starts empty, filters real app candidates, and saves add/remove/reorder as one selection', async () => {
		const view = await mount();
		expect(view.target.textContent).toContain('＋メニューに表示する項目を選んでください。');
		expect(view.target.textContent).toContain('0/8');
		expect(view.target.textContent).not.toContain('カレンダー');
		expect([...view.target.querySelectorAll('nav button')].map(item => item.textContent)).toEqual(['すべて', 'Hatask App', 'Hataskey App']);
		(candidate(view.target, 'レシピ').querySelector('button') as HTMLButtonElement).click();
		(candidate(view.target, 'HataCardMaker').querySelector('button') as HTMLButtonElement).click();
		await nextTick();
		(view.target.querySelector('[aria-label="HataCardMakerを上へ"]') as HTMLButtonElement).click();
		await nextTick();
		button(view.target, '保存').click();
		expect(view.save).toHaveBeenCalledExactlyOnceWith(['hatask.card-maker', 'hatask.recipe']);
		button(view.target, 'Hataskey App').click();
		await nextTick();
		expect(view.target.querySelector('ul')?.textContent).toContain('HataCardMaker');
		await vi.waitFor(() => expect(view.target.querySelector('ul')?.textContent).not.toContain('レシピ'));
		(view.target.querySelector('[aria-label="レシピを＋メニューから外す"]') as HTMLButtonElement).click();
		await nextTick();
		await vi.waitFor(() => expect(view.target.querySelector('ol')?.textContent).not.toContain('レシピ'));
		(view.target.querySelector('[aria-label="閉じる"]') as HTMLButtonElement).click();
		await nextTick();
		expect(view.close).not.toHaveBeenCalled();
		expect(view.target.querySelector('[role="alertdialog"]')?.textContent).toContain('未保存の変更');
		button(view.target, '保存せず閉じる').click();
		expect(view.close).toHaveBeenCalledOnce();
	});

	test('enforces eight pins and shows a retryable draft after a save error', async () => {
		const view = await mount([
			'hatask.recipe', 'hatask.garden', 'hatask.support', 'hatask.ranking',
			'hatask.appearance', 'hatask.card-maker', 'hatask.emotion-analysis', 'hatask.drawing-tool',
		]);
		expect(view.target.textContent).toContain('8/8');
		expect(candidate(view.target, '地震情報').querySelector('button')?.disabled).toBe(true);
		(view.target.querySelector('[aria-label="レシピを＋メニューから外す"]') as HTMLButtonElement).click();
		await nextTick();
		view.props.error = true;
		await nextTick();
		expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('失敗');
		expect(candidate(view.target, '地震情報').querySelector('button')?.disabled).toBe(false);
		expect(button(view.target, '保存').disabled).toBe(false);
	});

	test('reset edits only the draft and warns before a dirty backdrop close', async () => {
		const view = await mount(['hatask.recipe', 'hatask.garden']);
		button(view.target, '初期に戻す').click();
		await nextTick();
		expect(view.target.textContent).toContain('0/8');
		expect(view.save).not.toHaveBeenCalled();
		view.editor.value?.requestClose();
		await nextTick();
		await nextTick();
		expect(view.close).not.toHaveBeenCalled();
		expect(view.target.querySelector('[inert]')).not.toBeNull();
		expect(window.document.activeElement?.textContent).toBe('編集を続ける');
		(window.document.activeElement as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
		expect(window.document.activeElement?.textContent).toBe('保存せず閉じる');
		(window.document.activeElement as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
		expect(window.document.activeElement?.textContent).toBe('編集を続ける');
		button(view.target, '編集を続ける').click();
		await nextTick();
		expect(view.target.querySelector('[role="alertdialog"]')).toBeNull();
		button(view.target, '保存').click();
		expect(view.save).toHaveBeenCalledExactlyOnceWith([]);
		view.props.pins = [];
		await nextTick();
		view.editor.value?.requestClose();
		expect(view.close).toHaveBeenCalledOnce();
	});

	test('does not discard a draft while a save is in flight', async () => {
		const view = await mount(['hatask.recipe']);
		button(view.target, '初期に戻す').click();
		view.props.saving = true;
		await nextTick();
		expect(view.target.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')?.disabled).toBe(true);
		view.editor.value?.requestClose();
		await nextTick();
		expect(view.target.querySelector('[role="alertdialog"]')).toBeNull();
		expect(view.close).not.toHaveBeenCalled();
	});
});
