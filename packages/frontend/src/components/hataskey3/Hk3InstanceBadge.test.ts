/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import Hk3InstanceBadge from './Hk3InstanceBadge.vue';
import { getProxiedImageUrlNullable } from '@/utility/media-proxy.js';

vi.mock('@/utility/media-proxy.js', () => ({
	getProxiedImageUrlNullable: vi.fn((url: string | null) => url ? `/proxy?url=${encodeURIComponent(url)}` : null),
}));

type BadgeProps = {
	host: string;
	instance?: { name?: string | null; faviconUrl?: string | null; themeColor?: string | null };
};
const cleanups: (() => void)[] = [];
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllMocks();
});

function mount(props: BadgeProps) {
	const state = ref(props);
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3InstanceBadge, { ...state.value, class: 'host' }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { state, target, root: () => target.firstElementChild as HTMLElement };
}

describe('Hk3InstanceBadge', () => {
	it('uses supplied metadata and the existing nullable image proxy', () => {
		const view = mount({ host: 'remote.example', instance: { name: 'Remote Community', faviconUrl: 'https://remote.example/icon.png', themeColor: '#ff0000' } });
		expect(view.root().tagName).toBe('SPAN');
		expect(view.root().classList.contains('host')).toBe(true);
		expect(view.root().textContent).toContain('Remote Community');
		expect(view.root().title).toBe('Remote Community (remote.example)');
		expect(view.root().getAttribute('aria-label')).toBe(view.root().title);
		expect(view.root().hasAttribute('tabindex')).toBe(false);
		expect(getProxiedImageUrlNullable).toHaveBeenCalledWith('https://remote.example/icon.png');
		expect(view.target.querySelector('img')?.getAttribute('src')).toBe('/proxy?url=https%3A%2F%2Fremote.example%2Ficon.png');
		expect(view.target.querySelector('img')?.getAttribute('alt')).toBe('');
	});

	it.each([undefined, {}, { name: null, faviconUrl: null }, { name: ' \t\n' }])('falls back to the host and Server for missing/blank metadata: %j', instance => {
		const view = mount({ host: 'remote.example', instance });
		expect(view.root().textContent).toContain('remote.example');
		expect(view.target.querySelector('img')).toBeNull();
		expect(view.target.querySelector('svg')?.getAttribute('width')).toBe('14');
		expect(view.target.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		expect(getProxiedImageUrlNullable).toHaveBeenCalledWith(null);
	});

	it('replaces a broken icon with Server', async () => {
		const view = mount({ host: 'remote.example', instance: { faviconUrl: 'https://remote.example/broken.png' } });
		view.target.querySelector('img')!.dispatchEvent(new Event('error'));
		await nextTick();
		expect(view.target.querySelector('img')).toBeNull();
		expect(view.target.querySelector('svg')).not.toBeNull();
	});

	it('retries changed URLs and ignores errors from the old image', async () => {
		const view = mount({ host: 'remote.example', instance: { faviconUrl: 'https://remote.example/old.png' } });
		const oldImage = view.target.querySelector('img')!;
		oldImage.dispatchEvent(new Event('error'));
		await nextTick();
		view.state.value.instance = { faviconUrl: 'https://remote.example/new.png' };
		await nextTick();
		const newImage = view.target.querySelector('img')!;
		expect(newImage.getAttribute('src')).toContain('new.png');
		oldImage.dispatchEvent(new Event('error'));
		await nextTick();
		expect(view.target.querySelector('img')).toBe(newImage);
		view.state.value.instance = { faviconUrl: 'https://remote.example/third.png' };
		await nextTick();
		expect(view.target.querySelector('img')).not.toBe(newImage);
		newImage.dispatchEvent(new Event('error'));
		await nextTick();
		expect(view.target.querySelector('img')?.getAttribute('src')).toContain('third.png');
	});

	it('keeps a full long name accessible', () => {
		const name = 'A long community name '.repeat(20);
		const view = mount({ host: 'remote.example', instance: { name } });
		expect(view.root().title).toBe(`${name} (remote.example)`);
		expect(view.root().getAttribute('aria-label')).toBe(view.root().title);
	});
});
