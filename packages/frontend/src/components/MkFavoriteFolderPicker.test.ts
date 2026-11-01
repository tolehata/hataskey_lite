/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint vue/one-component-per-file: off -- Local stubs keep these tests focused on dialog behavior. */
import { computed, createApp, h, nextTick, provide } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkFavoriteFolderPicker from './MkFavoriteFolderPicker.vue';
import MkFavoriteFolderEditor from './MkFavoriteFolderEditor.vue';
import { $i } from '@/i.js';
import { favoriteFoldersState } from '@/utility/favorite-folders.js';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';

const api = vi.hoisted(() => vi.fn());
const achievement = vi.hoisted(() => vi.fn());
const modal = vi.hoisted(() => ({ deferClose: false, finishClose: undefined as (() => void) | undefined }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: achievement }));
vi.mock('@/os.js', () => ({ popup: vi.fn() }));
vi.mock('@/i.js', async () => ({ $i: (await import('vue')).reactive({ id: 'owner', token: 'token' }) }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { save: '保存', cancel: 'キャンセル', retry: '再試行', create: '作成', delete: '削除', unfavorite: '解除', _hata: { _navbarNotice: { favoriteAdded: 'お気に入りに追加しました' }, _favoriteFolders: {
	chooseDestination: '保存先', moveNote: '移動', unfiled: '未分類', newFolder: '新規フォルダ', folderName: '名前', folderColor: '色', accountChanged: 'account changed', loadingFailed: 'load failed', saveFailed: 'save failed', selectedFolderMissing: 'missing', limitReached: 'limit', childrenNotAllowed: 'permission', maxDepth: 'depth', duplicateName: 'duplicate', invalidName: 'invalid', invalidMove: 'move', editFolder: '編集', moveFolder: '移動', deleteFolder: '削除', createChild: '子作成', colorRose: 'rose', colorAmber: 'amber', colorGreen: 'green', colorBlue: 'blue', colorViolet: 'violet', colorSlate: 'slate',
} } }, tsx: { _hata: { _favoriteFolders: { deleteFolderDescription: ({ notes }: { notes: number }) => `move ${notes} notes`, noteAddedToFolder: ({ name }: { name: string }) => `お気に入りの${name}にノートを追加しました。` } } } } }));
vi.mock('@/components/MkModalWindow.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ emits: ['closed', 'close', 'click', 'esc'], setup(_props, { emit, expose }) { expose({ close: () => { modal.finishClose = () => emit('closed'); if (!modal.deferClose) modal.finishClose(); } }); }, template: '<section><header><slot name="header"/></header><slot/><footer><slot name="footer"/></footer></section>' }) };
});
vi.mock('@/components/MkButton.vue', () => ({ default: { props: ['disabled'], template: '<button :disabled="disabled"><slot/></button>' } }));
vi.mock('@/components/MkInput.vue', () => ({ default: { props: ['modelValue', 'disabled'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>' } }));

let counter = 0;
const cleanup: (() => void)[] = [];
const folders = [{ id: 'read', name: 'Read', color: 'rose' as const, parentId: null, count: 2, position: 0 }];
const result = () => ({ folders: structuredClone(folders), totalCount: 3, unfiledCount: 1, folderLimit: 2, canCreateSubfolders: false });

async function settle() { for (let i = 0; i < 12; i++) await nextTick(); }

function button(container: Element, text: string) { const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text); if (!found) throw new Error(`Missing button: ${text}`); return found; }

async function mount(editor = false, mode: 'create' | 'move' | 'remove' = 'create', withToastHost = false) {
	const done = vi.fn();
	const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
	const app = createApp({ setup() {
		if (withToastHost) provide(hataskeyNotificationToastsKey, context);
		return () => editor ? h(MkFavoriteFolderEditor, { mode: 'create', onDone: done }) : h(MkFavoriteFolderPicker, { noteId: 'note', mode, folderId: null, onDone: done });
	} });
	app.component('MkLoading', { template: '<span>Loading</span>' });
	const container = window.document.createElement('div'); window.document.body.append(container); app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	await settle(); return { container, done, context };
}

beforeEach(() => {
	$i!.id = `owner-${++counter}`;
	api.mockReset(); achievement.mockReset();
	modal.deferClose = false; modal.finishClose = undefined;
	notificationToastsSuppressed.value = false;
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	api.mockImplementation(async endpoint => endpoint.endsWith('/list') ? result() : undefined);
});
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); vi.restoreAllMocks(); });

describe('favorite folder dialogs', () => {
	test('selection alone and cancellation create no favorite or achievement', async () => {
		const { container, done } = await mount();
		const destination = container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1];
		destination.click(); await settle();
		expect(destination.getAttribute('aria-checked')).toBe('true');
		button(container, 'キャンセル').click();
		expect(done).toHaveBeenCalledWith(false);
		expect(api.mock.calls.map(([endpoint]) => endpoint)).toEqual(['notes/favorites/folders/list']);
		expect(achievement).not.toHaveBeenCalled();
	});

	test('failed save keeps destination selected and retry saves once with achievement after success', async () => {
		const { container, done, context } = await mount(false, 'create', true);
		container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
		let fail = true;
		api.mockImplementation(async endpoint => {
			if (endpoint.endsWith('/list')) return result();
			if (fail) throw Object.assign(new Error('Retry the save'), { code: 'RETRY' });
			return undefined;
		});
		button(container, '保存').click(); await settle();
		expect(container.querySelectorAll('[role="radio"]')[1].getAttribute('aria-checked')).toBe('true');
		expect(container.textContent).toContain('save failed');
		expect(done).not.toHaveBeenCalled(); expect(achievement).not.toHaveBeenCalled();
		expect(context.items.value).toHaveLength(0);
		fail = false;
		button(container, '保存').click(); await settle();
		expect(api).toHaveBeenCalledWith('notes/favorites/create', { noteId: 'note', folderId: 'read' }, 'token');
		expect(done).toHaveBeenCalledWith(true);
		expect(achievement).toHaveBeenCalledTimes(1);
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'noteAction', action: 'favorite', message: 'お気に入りに追加しました', target: 'Read' } });
	});

	test('waits for the dialog to close after success and announces the selected child path once', async () => {
		const { container, context } = await mount(false, 'create', true);
		favoriteFoldersState.folders.push({ ...folders[0], id: 'child', name: '小説', parentId: 'read' });
		await settle();
		container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[2].click();
		modal.deferClose = true;
		button(container, '保存').click(); await settle();
		expect(api).toHaveBeenCalledWith('notes/favorites/create', { noteId: 'note', folderId: 'child' }, 'token');
		expect(context.items.value).toHaveLength(0);
		modal.finishClose?.(); await settle();
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0]).toMatchObject({ source: 'status', navbarNotice: { kind: 'noteAction', action: 'favorite', message: 'お気に入りに追加しました', target: 'Read / 小説' } });
		modal.finishClose?.(); await settle();
		expect(context.items.value).toHaveLength(1);
	});

	test('without injection, successful save announces once through the registered page context after close', async () => {
		const { container, context, done } = await mount();
		cleanup.push(registerNotificationPageContext(context, () => true));
		const enqueue = vi.spyOn(context, 'enqueueNavbarNotice');
		container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
		modal.deferClose = true;
		button(container, '保存').click(); await settle();
		expect(done).toHaveBeenCalledWith(true);
		expect(enqueue).not.toHaveBeenCalled();
		modal.finishClose?.(); await settle();
		expect(enqueue).toHaveBeenCalledExactlyOnceWith({ kind: 'noteAction', action: 'favorite', message: 'お気に入りに追加しました', target: 'Read' });
		expect(context.items.value).toHaveLength(1);
		modal.finishClose?.(); await settle();
		expect(enqueue).toHaveBeenCalledTimes(1);
	});

	test('without injection, a failed save sends no favorite notice', async () => {
		const failed = await mount();
		cleanup.push(registerNotificationPageContext(failed.context, () => true));
		const enqueue = vi.spyOn(failed.context, 'enqueueNavbarNotice');
		api.mockImplementation(async endpoint => {
			if (endpoint.endsWith('/list')) return result();
			throw new Error('save failed');
		});
		button(failed.container, '保存').click(); await settle();
		expect(failed.done).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
		expect(failed.context.items.value).toHaveLength(0);
	});

	test('without injection, cancellation sends no favorite notice', async () => {
		const { container, context, done } = await mount();
		cleanup.push(registerNotificationPageContext(context, () => true));
		const enqueue = vi.spyOn(context, 'enqueueNavbarNotice');
		container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
		button(container, 'キャンセル').click(); await settle();
		expect(done).toHaveBeenCalledWith(false);
		expect(enqueue).not.toHaveBeenCalled();
		expect(context.items.value).toHaveLength(0);
	});

	test('announces unfiled only on save, never on selection or cancellation', async () => {
		const first = await mount(false, 'create', true);
		button(first.container, 'キャンセル').click(); await settle();
		expect(first.context.items.value).toHaveLength(0);
		const second = await mount(false, 'create', true);
		button(second.container, '保存').click(); await settle();
		expect(second.context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'noteAction', action: 'favorite', target: '未分類' } });
	});

	test.each(['move', 'remove'] as const)('does not announce a new favorite after %s', async mode => {
		const { container, context, done } = await mount(false, mode, true);
		button(container, mode === 'remove' ? '解除' : '保存').click(); await settle();
		expect(done).toHaveBeenCalledWith(true);
		expect(context.items.value).toHaveLength(0);
	});

	test.each(['account', 'suppressed', 'hidden'] as const)('discards pending feedback when %s changes before close', async reason => {
		const { container, context, done } = await mount(false, 'create', true);
		modal.deferClose = true;
		button(container, '保存').click(); await settle();
		expect(done).toHaveBeenCalledWith(true);
		if (reason === 'account') {
			if (!$i) throw new Error('Missing test account');
			$i.id = 'different-account';
		}
		if (reason === 'suppressed') notificationToastsSuppressed.value = true;
		if (reason === 'hidden') vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		modal.finishClose?.(); await settle();
		expect(context.items.value).toHaveLength(0);
	});

	test('removed destination is kept invalid until user explicitly picks another destination', async () => {
		const { container } = await mount();
		container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click(); await settle();
		favoriteFoldersState.folders = []; await settle();
		expect(button(container, '保存').disabled).toBe(true);
		expect(container.textContent).toContain('missing');
		container.querySelector<HTMLButtonElement>('[role="radio"]')!.click(); await settle();
		expect(button(container, '保存').disabled).toBe(false);
	});

	test('create quota loss hides confirmation while preserving entered name, color, cancel and retry', async () => {
		const { container } = await mount(true);
		const input = container.querySelector('input')!;
		input.value = 'My folder'; input.dispatchEvent(new Event('input', { bubbles: true }));
		container.querySelector<HTMLButtonElement>('[aria-label="green"]')!.click(); await settle();
		favoriteFoldersState.folderLimit = 1; await settle();
		expect([...container.querySelectorAll('button')].some(item => item.textContent === '作成')).toBe(false);
		expect(input.value).toBe('My folder');
		expect(container.querySelector('[aria-label="green"]')!.getAttribute('aria-pressed')).toBe('true');
		expect(button(container, 'キャンセル').disabled).toBe(false);
		favoriteFoldersState.folderLimit = 2; await settle();
		expect(button(container, '作成').disabled).toBe(false);
	});

	test('an account switch disables save instead of submitting the previous account selection', async () => {
		const { container } = await mount();
		$i!.id = 'someone-else'; await settle();
		expect(button(container, '保存').disabled).toBe(true);
		expect(container.textContent).toContain('account changed');
		expect(achievement).not.toHaveBeenCalled();
	});
});
