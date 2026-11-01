/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';

const mocks = vi.hoisted(() => ({ drive: vi.fn(), pick: vi.fn(), upload: vi.fn() }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: mocks.drive }));
vi.mock('@/utility/hatagoes-pickers.js', () => ({ useHataGoesPickers: () => ({ selectDriveFiles: mocks.drive }) }));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/os.js', () => ({ chooseFileFromPc: mocks.pick, launchUploader: mocks.upload }));
vi.mock('@/components/MkDriveFileThumbnail.vue', () => ({ default: { render: () => null } }));
import HatadyImageAttachments from './HatadyImageAttachments.vue';

const cleanups: Array<() => void> = [];
const image = (id: string, type = 'image/png') => ({ id, name: `${id}.png`, type }) as Misskey.entities.DriveFile;

async function settle() { await Promise.resolve(); await nextTick(); await nextTick(); }

function mount(initial: Misskey.entities.DriveFile[] = []) {
	const files = ref(initial), target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatadyImageAttachments, { modelValue: files.value, label: '画像', 'onUpdate:modelValue': value => { files.value = value; } }) });
	app.mount(target);
	const close = () => { app.unmount(); target.remove(); };
	cleanups.push(close);
	return { files, target, close, async click(label: string) {
		const button = [...target.querySelectorAll('button')].find(item => item.textContent?.includes(label) || item.getAttribute('aria-label') === label);
		if (!button) throw new Error(`Missing attachment button: ${label}`);
		button.click(); await settle();
	} };
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

describe('Hatady record images', () => {
	test('merges Drive images in order, excludes non-images and avoids duplicates', async () => {
		mocks.drive.mockResolvedValue([image('one'), image('video', 'video/mp4'), image('two')]);
		const view = mount([image('one')]);
		await view.click('ドライブから');
		expect(view.files.value.map(file => file.id)).toEqual(['one', 'two']);
		expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('画像ファイル');
	});
	test('caps attachments at 16 and detaches locally without deleting Drive files', async () => {
		mocks.drive.mockResolvedValue([image('extra'), image('overflow')]);
		const view = mount(Array.from({ length: 15 }, (_, index) => image(String(index))));
		await view.click('ドライブから');
		expect(view.files.value).toHaveLength(16);
		expect(view.files.value.at(-1)?.id).toBe('extra');
		await view.click('extra.pngの添付を外す');
		expect(view.files.value).toHaveLength(15);
		expect(mocks.upload).not.toHaveBeenCalled();
	});
	test('uses the existing uploader only for image files within the remaining capacity', async () => {
		const photo = new File(['photo'], 'photo.png', { type: 'image/png' });
		mocks.pick.mockResolvedValue([photo, new File(['text'], 'text.txt', { type: 'text/plain' })]);
		mocks.upload.mockResolvedValue([image('new')]);
		const view = mount();
		await view.click('画像を追加');
		expect(mocks.pick).toHaveBeenCalledWith({ multiple: true, accept: 'image/*' });
		expect(mocks.upload).toHaveBeenCalledWith([photo]);
		expect(view.files.value.map(file => file.id)).toEqual(['new']);
	});
	test('cancellation and upload failure preserve the current images', async () => {
		mocks.pick.mockResolvedValue([]);
		const view = mount([image('keep')]);
		await view.click('画像を追加');
		expect(mocks.upload).not.toHaveBeenCalled();
		mocks.drive.mockRejectedValue(new Error('offline'));
		await view.click('ドライブから');
		expect(view.files.value.map(file => file.id)).toEqual(['keep']);
		expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('追加できません');
	});
	test('an upload finishing after the composer closes cannot modify its draft', async () => {
		let finish!: (files: Misskey.entities.DriveFile[]) => void;
		mocks.drive.mockReturnValue(new Promise(resolve => { finish = resolve; }));
		const view = mount();
		await view.click('ドライブから');
		view.close();
		finish([image('late')]); await settle();
		expect(view.files.value).toEqual([]);
	});
});
