/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ ui: 'simple' as string | null, setDevice: vi.fn(), setProfile: vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => mocks.ui } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	const tabSwipeEnabled = ref(true);
	return { tabSwipeEnabled, setTabSwipeEnabled: (value: boolean) => { mocks.setDevice(value); tabSwipeEnabled.value = value; } };
});
vi.mock('@/preferences.js', async () => {
	const { computed, ref } = await import('vue');
	const enableHorizontalSwipe = ref(false);
	return { prefer: { r: { enableHorizontalSwipe }, model: () => computed({ get: () => enableHorizontalSwipe.value, set: (value: boolean) => { mocks.setProfile(value); enableHorizontalSwipe.value = value; } }) } };
});
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe('horizontal swipe preference scope', () => {
	it.each(['simple', 'hataskey3', null])('uses one device setting in %s without writing the profile', async ui => {
		mocks.ui = ui;
		const subject = await import('./horizontal-swipe-preference.js');
		const device = await import('./hatasaba-device-prefs.js');
		const { prefer } = await import('@/preferences.js');
		const generalSwitch = subject.useHorizontalSwipeModel();
		expect(subject.usesDeviceHorizontalSwipe.value).toBe(true);
		expect(generalSwitch.value).toBe(true);
		generalSwitch.value = false;
		expect(device.tabSwipeEnabled.value).toBe(false);
		expect(subject.horizontalSwipeEnabled.value).toBe(false);
		expect(mocks.setDevice).toHaveBeenCalledExactlyOnceWith(false);
		expect(mocks.setProfile).not.toHaveBeenCalled();
		device.setTabSwipeEnabled(true); // Hataskey editor's existing save action.
		expect(generalSwitch.value).toBe(true);
		prefer.r.enableHorizontalSwipe.value = true;
		device.setTabSwipeEnabled(false);
		expect(subject.horizontalSwipeEnabled.value).toBe(false);
	});
	it.each(['default', 'deck', 'friendly'])('retains the profile setting in %s', async ui => {
		mocks.ui = ui;
		const subject = await import('./horizontal-swipe-preference.js');
		const device = await import('./hatasaba-device-prefs.js');
		const switchModel = subject.useHorizontalSwipeModel();
		expect(subject.usesDeviceHorizontalSwipe.value).toBe(false);
		expect(switchModel.value).toBe(false);
		switchModel.value = true;
		expect(mocks.setProfile).toHaveBeenCalledExactlyOnceWith(true);
		expect(mocks.setDevice).not.toHaveBeenCalled();
		device.setTabSwipeEnabled(false);
		expect(subject.horizontalSwipeEnabled.value).toBe(true);
	});
});
