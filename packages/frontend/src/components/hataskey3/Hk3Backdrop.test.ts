/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import Hk3Backdrop from './Hk3Backdrop.vue';

type BackdropProps = {
	bannerUrl?: string | null;
	avatarUrl?: string | null;
	motion?: boolean;
};
const cleanups: (() => void)[] = [];

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
});

function mount(props: BackdropProps = {}) {
	const state = ref(props);
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3Backdrop, state.value) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return {
		state, target,
		root: () => target.firstElementChild as HTMLElement,
		image: () => target.querySelector('img'),
	};
}

async function emit(image: HTMLImageElement, type: 'load' | 'error') {
	image.dispatchEvent(new Event(type));
	await nextTick();
}

describe('Hk3Backdrop', () => {
	it('prefers the banner, revealing it only after load, with inert decorative markup', async () => {
		const bannerUrl = 'https://example.test/banner?title="hello")';
		const view = mount({ bannerUrl, avatarUrl: '/avatar.png' });
		expect(view.root().getAttribute('aria-hidden')).toBe('true');
		expect(view.root().hasAttribute('inert')).toBe(true);
		expect(view.root().dataset.motion).toBe('true');
		expect(view.image()!.getAttribute('src')).toBe(bannerUrl);
		expect(view.image()!.getAttribute('alt')).toBe('');
		expect(view.image()!.getAttribute('draggable')).toBe('false');
		expect(view.image()!.dataset.loaded).toBe('false');
		await emit(view.image()!, 'load');
		expect(view.image()!.dataset.loaded).toBe('true');
	});

	it.each([undefined, null, ''])('uses the avatar when the banner is absent (%s)', async bannerUrl => {
		const view = mount({ bannerUrl, avatarUrl: '/avatar.png' });
		expect(view.image()!.getAttribute('src')).toBe('/avatar.png');
		expect(view.image()!.dataset.loaded).toBe('false');
		await emit(view.image()!, 'load');
		expect(view.image()!.dataset.loaded).toBe('true');
	});

	it('hides a broken banner immediately, then tries the avatar and removes it on failure', async () => {
		const view = mount({ bannerUrl: '/banner.png', avatarUrl: '/avatar.png' });
		const banner = view.image()!;
		await emit(banner, 'load');
		banner.dispatchEvent(new Event('error'));
		expect(banner.style.visibility).toBe('hidden');
		await nextTick();
		const avatar = view.image()!;
		expect(avatar).not.toBe(banner);
		expect(avatar.getAttribute('src')).toBe('/avatar.png');
		expect(avatar.dataset.loaded).toBe('false');
		await emit(avatar, 'load');
		expect(avatar.dataset.loaded).toBe('true');
		await emit(avatar, 'error');
		expect(view.image()).toBeNull();
		expect(view.root().getAttribute('aria-hidden')).toBe('true');
	});

	it.each([{}, { bannerUrl: null, avatarUrl: null }, { bannerUrl: '', avatarUrl: '' }])('keeps only the themed background without URLs: %j', props => {
		const view = mount(props);
		expect(view.image()).toBeNull();
		expect(view.root()).not.toBeNull();
	});

	it('keeps only the background if a sole banner or avatar fails', async () => {
		for (const props of [{ bannerUrl: '/banner.png' }, { avatarUrl: '/avatar.png' }]) {
			const view = mount(props);
			await emit(view.image()!, 'error');
			expect(view.image()).toBeNull();
		}
	});

	it('resets both failures on URL changes and clears loaded state for the new image', async () => {
		const view = mount({ bannerUrl: '/banner.png', avatarUrl: '/avatar.png' });
		await emit(view.image()!, 'error');
		await emit(view.image()!, 'error');
		view.state.value.avatarUrl = '/new-avatar.png';
		await nextTick();
		expect(view.image()!.getAttribute('src')).toBe('/banner.png');
		await emit(view.image()!, 'error');
		expect(view.image()!.getAttribute('src')).toBe('/new-avatar.png');
		await emit(view.image()!, 'load');
		view.state.value.bannerUrl = '/new-banner.png';
		await nextTick();
		expect(view.image()!.getAttribute('src')).toBe('/new-banner.png');
		expect(view.image()!.dataset.loaded).toBe('false');
		view.state.value = {};
		await nextTick();
		expect(view.image()).toBeNull();
		view.state.value.avatarUrl = '/returned-avatar.png';
		await nextTick();
		expect(view.image()!.getAttribute('src')).toBe('/returned-avatar.png');
	});

	it('ignores stale load/error events after URL replacement, including returning to the same URL', async () => {
		const view = mount({ bannerUrl: '/first.png', avatarUrl: '/avatar.png' });
		const first = view.image()!;
		view.state.value.bannerUrl = '/second.png';
		await nextTick();
		const second = view.image()!;
		await emit(first, 'load');
		await emit(first, 'error');
		expect(view.image()).toBe(second);
		expect(second.dataset.loaded).toBe('false');
		view.state.value.bannerUrl = '/first.png';
		await nextTick();
		const returned = view.image()!;
		expect(returned).not.toBe(first);
		await emit(first, 'load');
		await emit(first, 'error');
		await emit(second, 'load');
		await emit(second, 'error');
		expect(view.image()).toBe(returned);
		expect(returned.dataset.loaded).toBe('false');
		await emit(returned, 'load');
		expect(returned.dataset.loaded).toBe('true');
	});

	it('ignores stale banner events during fallback even if banner and avatar URLs match', async () => {
		const view = mount({ bannerUrl: '/same.png', avatarUrl: '/same.png' });
		const banner = view.image()!;
		banner.dispatchEvent(new Event('error'));
		// Late events can also arrive before the fallback DOM update.
		banner.dispatchEvent(new Event('load'));
		banner.dispatchEvent(new Event('error'));
		await nextTick();
		const avatar = view.image()!;
		expect(avatar).not.toBe(banner);
		await emit(banner, 'load');
		await emit(banner, 'error');
		expect(view.image()).toBe(avatar);
		expect(avatar.dataset.loaded).toBe('false');
		await emit(avatar, 'error');
		await emit(banner, 'load');
		expect(view.image()).toBeNull();
	});

	it('updates the motion opt-out without replacing or hiding the loaded image', async () => {
		const view = mount({ bannerUrl: '/banner.png', motion: false });
		const image = view.image()!;
		expect(view.root().dataset.motion).toBe('false');
		await emit(image, 'load');
		expect(image.dataset.loaded).toBe('true');
		view.state.value.motion = true;
		await nextTick();
		expect(view.root().dataset.motion).toBe('true');
		expect(view.image()).toBe(image);
		expect(image.dataset.loaded).toBe('true');
	});
});
