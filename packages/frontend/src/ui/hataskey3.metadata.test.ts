/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { PageMetadata } from '@/page.js';
import Hataskey3 from './hataskey3.vue';
import { mainRouter } from '@/router.js';
import { hataskeyUiSDisplaySize, setHataskeyUiSDisplaySize } from '@/utility/hatasaba-device-prefs.js';

const mocks = vi.hoisted(() => ({
	receiver: null as ((getter: () => PageMetadata) => void) | null,
	metadata: null as Ref<PageMetadata | null> | null,
	appMetadata: null as PageMetadata | null,
}));

vi.mock('@@/js/config.js', () => ({ instanceName: 'Test instance' }));
vi.mock('@/router.js', async () => {
	const { ref } = await import('vue');
	return { mainRouter: { currentRoute: ref({ path: '/' }) } };
});
vi.mock('@/page.js', () => ({
	provideMetadataReceiver: (receiver: typeof mocks.receiver) => { mocks.receiver = receiver; },
	provideReactiveMetadata: (metadata: Ref<PageMetadata | null>) => { mocks.metadata = metadata; },
}));
vi.mock('@/components/hataskey3/Hk3App.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({
		props: ['pageMetadata'],
		setup(props) {
			return () => { mocks.appMetadata = props.pageMetadata; return null; };
		},
	}) };
});
vi.mock('./_common_/common.vue', () => ({ default: { render: () => null } }));

const cleanups: (() => void)[] = [];
let originalTitle: string;

function mount(path = '/') {
	mainRouter.currentRoute.value = { path } as typeof mainRouter.currentRoute.value;
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp(Hataskey3);
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return mocks.metadata!;
}

async function navigate(path: string) {
	mainRouter.currentRoute.value = { path } as typeof mainRouter.currentRoute.value;
	await nextTick();
}

function expectHome(metadata: Ref<PageMetadata | null>) {
	expect(window.document.title).toBe('Test instance');
	expect(metadata.value).toEqual({ title: 'Test instance', icon: 'ti ti-home' });
}

beforeEach(() => {
	originalTitle = window.document.title;
	window.document.title = 'Previous screen';
	mocks.receiver = null;
	mocks.metadata = null;
	mocks.appMetadata = null;
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	window.document.title = originalTitle;
});

describe('UI S home metadata', () => {
	it('updates the root size immediately and removes it when UI S unmounts', () => {
		const originalSize = hataskeyUiSDisplaySize.value;
		setHataskeyUiSDisplaySize('standard');
		mount();
		const root = window.document.documentElement;
		expect(root.dataset.hk3Ui).toBe('true');
		expect(root.dataset.hk3Size).toBe('standard');
		setHataskeyUiSDisplaySize('small');
		expect(root.dataset.hk3Size).toBe('small');
		cleanups.splice(0).forEach(cleanup => cleanup());
		expect(root.dataset.hk3Ui).toBeUndefined();
		expect(root.dataset.hk3Size).toBeUndefined();
		setHataskeyUiSDisplaySize(originalSize);
	});
	it('passes live route metadata to the workspace app', async () => {
		const metadata = mount('/settings');
		mocks.receiver!(() => ({ title: 'Settings' }));
		await nextTick();
		expect(mocks.appMetadata).toBe(metadata.value);
		expect(mocks.appMetadata?.title).toBe('Settings');
		mocks.receiver!(() => ({ title: 'Updated settings' }));
		await nextTick();
		expect(mocks.appMetadata?.title).toBe('Updated settings');
	});

	it('initializes the home title and metadata when mounted', () => {
		expectHome(mount());
	});

	it('restores both title and the provided metadata ref after notifications and messages', async () => {
		const metadata = mount();
		for (const [path, title] of [['/my/notifications', 'Notifications'], ['/my/messaging', 'Messages']]) {
			await navigate(path);
			mocks.receiver!(() => ({ title, icon: 'ti ti-bell' }));
			expect(window.document.title).toBe(`${title} | Test instance`);
			expect(metadata.value).toEqual({ title, icon: 'ti ti-bell' });
			await navigate('/');
			expect(mocks.metadata).toBe(metadata);
			expectHome(metadata);
		}
	});

	it('ignores stale getters arriving immediately and later after returning home', async () => {
		const metadata = mount('/my/notifications');
		mocks.receiver!(() => ({ title: 'Notifications' }));
		mainRouter.currentRoute.value = { path: '/' } as typeof mainRouter.currentRoute.value;
		const staleGetter = vi.fn(() => ({ title: 'Stale notifications', icon: 'ti ti-bell' }));
		mocks.receiver!(staleGetter);
		expectHome(metadata);
		await nextTick();
		mocks.receiver!(staleGetter);
		expectHome(metadata);
		expect(staleGetter).not.toHaveBeenCalled();
	});

	it('accepts metadata updates on another page after returning home', async () => {
		const metadata = mount('/my/notifications');
		mocks.receiver!(() => ({ title: 'Notifications' }));
		await navigate('/');
		expectHome(metadata);
		await navigate('/settings');
		mocks.receiver!(() => ({ title: 'Settings', icon: 'ti ti-settings' }));
		expect(window.document.title).toBe('Settings | Test instance');
		expect(metadata.value).toEqual({ title: 'Settings', icon: 'ti ti-settings' });
	});
});
