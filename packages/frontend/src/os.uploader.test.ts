/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchUploader, popups, postDirect } from './os.js';

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
vi.mock('@/components/MkUploaderDialog.vue', () => ({ default: { name: 'Uploader' } }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/utility/please-login.js', () => ({ pleaseLogin: vi.fn() }));
vi.mock('@/utility/show-moved-dialog.js', () => ({ showMovedDialog: vi.fn() }));
vi.mock('@/utility/get-dom-node-or-null.js', () => ({ getHTMLElementOrNull: vi.fn() }));
vi.mock('@/utility/focus.js', () => ({ focusParent: vi.fn() }));
vi.mock('@/utility/hataskey-notification-toast.js', () => ({ enqueuePageStatusToast: vi.fn() }));

afterEach(() => { popups.value = []; });

async function openUploader() {
	const file = new File(['image'], 'image.png', { type: 'image/png' });
	const result = launchUploader([file]);
	await vi.waitFor(() => expect(popups.value).toHaveLength(1));
	return { result, popup: popups.value[0], file };
}

describe('launchUploader', () => {
	it('settles cancellation so callers can release their pending state', async () => {
		const { result, popup } = await openUploader();
		popup.events.canceled();
		await expect(result).resolves.toEqual([]);
		popup.events.closed();
		await vi.waitFor(() => expect(popups.value).toHaveLength(0));
	});

	it('settles a dialog closed without an upload result', async () => {
		const { result, popup } = await openUploader();
		popup.events.closed();
		await expect(result).resolves.toEqual([]);
		await vi.waitFor(() => expect(popups.value).toHaveLength(0));
	});

	it('keeps uploaded files when the dialog subsequently closes', async () => {
		const { result, popup, file } = await openUploader();
		expect(popup.props.files).toEqual([file]);
		const uploaded = [{ id: 'uploaded-image' }];
		popup.events.done(uploaded);
		popup.events.closed();
		await expect(result).resolves.toEqual(uploaded);
		await vi.waitFor(() => expect(popups.value).toHaveLength(0));
	});

	it('treats an empty input as a no-op', async () => {
		await expect(launchUploader([])).resolves.toEqual([]);
		expect(popups.value).toHaveLength(0);
	});
});

describe('postDirect posted callback', () => {
	it('resolves cancellation as before without treating closure as a successful post', async () => {
		const posted = vi.fn();
		const result = postDirect({ initialText: 'draft' }, posted);
		expect(popups.value).toHaveLength(1);
		popups.value[0].events.closed();
		await expect(result).resolves.toBeUndefined();
		expect(posted).not.toHaveBeenCalled();
	});
	it('forwards success separately while keeping the Promise pending until close', async () => {
		const posted = vi.fn();
		const resolved = vi.fn();
		const result = postDirect({}, posted);
		void result.then(resolved);
		popups.value[0].events.posted();
		await Promise.resolve();
		expect(posted).toHaveBeenCalledOnce();
		expect(resolved).not.toHaveBeenCalled();
		popups.value[0].events.closed();
		await result;
		expect(resolved).toHaveBeenCalledOnce();
	});
});
