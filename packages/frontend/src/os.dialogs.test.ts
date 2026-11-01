/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref } from 'vue';
import * as os from './os.js';
import { HATA_GOES_HOST, HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';
import { createHataGoesPopupSession } from '@/utility/hatagoes-popup.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';

vi.mock('cherrypick-js', () => ({}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/preferences.js', () => ({ prefer: {} }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/components/MkPostFormDialog.vue', () => ({ default: {} }));
vi.mock('@/components/MkWaitingDialog.vue', () => ({ default: {} }));
vi.mock('@/components/MkPageWindow.vue', () => ({ default: {} }));
vi.mock('@/components/MkToast.vue', () => ({ default: {} }));
vi.mock('@/components/MkDialog.vue', () => ({ default: {} }));
vi.mock('@/components/MkPopupMenu.vue', () => ({ default: {} }));
vi.mock('@/components/MkContextMenu.vue', () => ({ default: {} }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/show-moved-dialog.js', () => ({ showMovedDialog: vi.fn() }));
vi.mock('@/utility/get-dom-node-or-null.js', () => ({ getHTMLElementOrNull: vi.fn() }));
vi.mock('@/utility/focus.js', () => ({ focusParent: vi.fn() }));
vi.mock('@/utility/hataskey-notification-toast.js', () => ({ enqueuePageStatusToast: vi.fn() }));

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); os.popups.value = []; });

function mountDialogs() {
	const shell = ref(true);
	const session = createHataGoesPopupSession(shell);
	let dialogs!: ReturnType<typeof useHataGoesDialogs>;
	const element = window.document.createElement('div');
	const app = createApp(defineComponent({ setup() {
		provide(HATA_GOES_HOST, { active: ref(true), register: vi.fn(), changed: vi.fn() });
		provide(HATA_GOES_SESSION, session);
		return () => h(defineComponent({ setup() { dialogs = useHataGoesDialogs(); return () => null; } }));
	} }));
	app.mount(element);
	cleanups.push(() => app.unmount());
	return { shell, dialogs };
}

test('shell exit cancels a pending confirmation before deletion can continue', async () => {
	const { shell, dialogs } = mountDialogs();
	const deleteRecord = vi.fn();
	const pending = dialogs.confirm({ type: 'warning', text: 'Delete record?' }).then(({ canceled }) => { if (!canceled) deleteRecord(); return canceled; });
	expect(os.popups.value).toHaveLength(1);
	shell.value = false;
	await expect(pending).resolves.toBe(true);
	expect(deleteRecord).not.toHaveBeenCalled();
});

test('confirmation already accepted remains accepted when its popup closes', async () => {
	const { dialogs } = mountDialogs();
	const pending = dialogs.confirm({ type: 'question', text: 'Continue?' });
	const events = os.popups.value[0].events;
	events.done({ canceled: false, result: true });
	events.closed();
	await expect(pending).resolves.toMatchObject({ canceled: false });
});

test('shell exit cancels text input and action selection', async () => {
	const { shell, dialogs } = mountDialogs();
	const input = dialogs.inputText({ title: 'Name', default: '' });
	const action = dialogs.actions({ type: 'question', actions: [{ value: 'delete', text: 'Delete' }] });
	expect(os.popups.value).toHaveLength(2);
	shell.value = false;
	await expect(input).resolves.toEqual({ canceled: true, result: undefined });
	await expect(action).resolves.toEqual({ canceled: true, result: undefined });
});
