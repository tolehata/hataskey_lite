/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent } from 'vue';
import { useHataGoesPickers } from './hatagoes-pickers.js';

const fixture = vi.hoisted(() => ({ launcher: vi.fn((_component: unknown, _props: unknown, _events: Record<string, (...args: unknown[]) => void>) => ({ dispose: vi.fn() })), legacyPopup: vi.fn(), selectUser: vi.fn(), chooseDriveFile: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: fixture.legacyPopup, selectUser: fixture.selectUser }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => fixture.launcher }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: fixture.chooseDriveFile }));
vi.mock('@/components/MkDriveFileSelectDialog.vue', () => ({ default: { render: () => null } }));

const cleanup: (() => void)[] = [];

function setupPickers() {
	let pickers!: ReturnType<typeof useHataGoesPickers>;
	const el = window.document.createElement('div');
	const app = createApp(defineComponent({ setup() { pickers = useHataGoesPickers(); return () => null; } }));
	app.mount(el);
	cleanup.push(() => app.unmount());
	return pickers;
}

afterEach(() => { cleanup.splice(0).forEach(fn => fn()); fixture.launcher.mockClear(); fixture.selectUser.mockReset(); fixture.chooseDriveFile.mockReset(); });

describe('HataGoes pickers', () => {
	test('user selection resolves cancellation when the owning shell closes', async () => {
		const pickers = setupPickers();
		const pending = pickers.selectUser({ includeSelf: false });
		expect(fixture.launcher).toHaveBeenCalledOnce();
		const events = fixture.launcher.mock.calls[0][2] as { closed: () => void };
		events.closed();
		await expect(pending).resolves.toBeUndefined();
	});

	test('drive selection resolves to no files after cancellation', async () => {
		const pickers = setupPickers();
		const pending = pickers.selectDriveFiles({ multiple: true });
		await vi.waitFor(() => expect(fixture.launcher).toHaveBeenCalledOnce());
		const [, props, events] = fixture.launcher.mock.calls[0] as [unknown, { multiple: boolean }, { closed: () => void }];
		expect(props.multiple).toBe(true);
		events.closed();
		await expect(pending).resolves.toEqual([]);
	});

	test('a closed owner after the asynchronous drive import cannot leave a pending selection', async () => {
		fixture.launcher.mockImplementationOnce((_component, _props, events) => {
			queueMicrotask(() => events.closed());
			return { dispose: vi.fn() };
		});
		const pending = setupPickers().selectDriveFiles();
		await expect(pending).resolves.toEqual([]);
		expect(fixture.launcher).toHaveBeenCalledOnce();
	});
});
