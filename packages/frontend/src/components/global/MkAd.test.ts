/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MkAd from './MkAd.vue';

type Ad = NonNullable<InstanceType<typeof MkAd>['$props']['specify']>;

const mocks = vi.hoisted(() => ({
	instance: { ads: [] as Ad[] },
	account: { policies: { canHideAds: false } },
	prefer: { s: { forceShowAds: false } },
	store: { s: { mutedAds: [] as string[] }, push: vi.fn() },
	success: vi.fn(),
}));

vi.mock('@@/js/config.js', () => ({ url: 'https://local.example', host: 'local.example' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _ad: { reduceFrequencyOfThisAd: 'Reduce frequency', back: 'Back' } } } }));
vi.mock('@/instance.js', () => ({ instance: mocks.instance }));
vi.mock('@/i.js', () => ({ $i: mocks.account }));
vi.mock('@/preferences.js', () => ({ prefer: mocks.prefer }));
vi.mock('@/store.js', () => ({ store: mocks.store }));
vi.mock('@/os.js', () => ({ success: mocks.success }));
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ inheritAttrs: false, setup: (_, { attrs, slots }) => () => render('button', attrs, slots.default?.()) }) };
});

const cleanups: Array<() => void> = [];

function ad(id: string, place: string, ratio = 1, url = `https://ads.example/${id}`): Ad {
	return {
		id, place, ratio, url,
		dayOfWeek: 127,
		// Data URLs keep image assertions independent of the network.
		imageUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><title>${id}</title></svg>`)}`,
	};
}

function mount(props: { preferForms?: string[]; specify?: Ad } = {}) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp(defineComponent({ setup: () => () => h(MkAd, props) }));
	app.component('MkA', defineComponent({
		props: { to: { type: String, required: true } },
		setup: (linkProps, { slots }) => () => h('a', { href: linkProps.to }, slots.default?.()),
	}));
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return host;
}

function displayedAd(host: HTMLElement, expected: Ad) {
	const image = host.querySelector<HTMLImageElement>('img');
	expect(image?.getAttribute('src')).toBe(expected.imageUrl);
	const link = image?.closest('a');
	expect(link).not.toBeNull();
	return link!;
}

beforeEach(() => {
	mocks.instance.ads = [];
	mocks.account.policies.canHideAds = false;
	mocks.prefer.s.forceShowAds = false;
	mocks.store.s.mutedAds = [];
	mocks.store.push.mockReset();
	mocks.store.push.mockImplementation((key: string, id: string) => {
		if (key === 'mutedAds') mocks.store.s.mutedAds.push(id);
	});
	mocks.success.mockReset();
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
});

describe('MkAd', () => {
	test('no ads render no ad container or empty box', () => {
		const host = mount({ preferForms: ['horizontal'] });
		expect(host.querySelector('div')).toBeNull();
		expect(host.querySelector('a, img, button')).toBeNull();
		expect(host.textContent).toBe('');
	});

	test('preferred horizontal ads use their ratios and render an external link', () => {
		const first = ad('first', 'horizontal', 1);
		const selected = ad('selected', 'horizontal', 3);
		mocks.instance.ads = [ad('square', 'square', 100), first, selected];
		vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 * (1 + 3) selects the second horizontal ad.
		const host = mount({ preferForms: ['horizontal'] });
		const link = displayedAd(host, selected);
		expect(link.getAttribute('href')).toBe(selected.url);
		expect(link.getAttribute('rel')).toBe('nofollow noopener');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.parentElement?.className).toContain('form_horizontal');
		expect(host.querySelectorAll('img')).toHaveLength(1);
	});

	test('falls back to a square ad when no preferred form exists, keeping internal links local', () => {
		const square = ad('square', 'square', 2, 'https://local.example/featured');
		mocks.instance.ads = [ad('vertical', 'vertical'), square];
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const host = mount({ preferForms: ['horizontal'] });
		const link = displayedAd(host, square);
		expect(link.getAttribute('href')).toBe('/featured');
		expect(link.hasAttribute('target')).toBe(false);
		expect(link.parentElement?.className).toContain('form_square');
	});

	test('a vertical-only inventory does not fill a horizontal placement', () => {
		mocks.instance.ads = [ad('vertical', 'vertical')];
		const host = mount({ preferForms: ['horizontal'] });
		expect(host.querySelector('div, a, img')).toBeNull();
	});

	test.each([
		{ canHideAds: false, forceShowAds: false, visible: true },
		{ canHideAds: false, forceShowAds: true, visible: true },
		{ canHideAds: true, forceShowAds: false, visible: false },
		{ canHideAds: true, forceShowAds: true, visible: true },
	])('visibility respects canHideAds=$canHideAds and forceShowAds=$forceShowAds', ({ canHideAds, forceShowAds, visible }) => {
		const selected = ad('horizontal', 'horizontal');
		mocks.instance.ads = [selected];
		mocks.account.policies.canHideAds = canHideAds;
		mocks.prefer.s.forceShowAds = forceShowAds;
		const host = mount({ preferForms: ['horizontal'] });
		if (visible) displayedAd(host, selected);
		else expect(host.querySelector('div, a, img')).toBeNull();
	});

	test('specify bypasses the hide policy and placement filtering', () => {
		const specified = ad('specified', 'vertical');
		mocks.account.policies.canHideAds = true;
		const host = mount({ preferForms: ['horizontal'], specify: specified });
		const link = displayedAd(host, specified);
		expect(link.getAttribute('href')).toBe(specified.url);
		expect(link.parentElement?.className).toContain('form_vertical');
	});

	test('reduce frequency appends to existing mutedAds and selects another eligible ad', async () => {
		const first = ad('first', 'horizontal', 4);
		const next = ad('next', 'horizontal', 1);
		mocks.instance.ads = [first, next];
		mocks.store.s.mutedAds = ['already-muted'];
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const host = mount({ preferForms: ['horizontal'] });
		displayedAd(host, first);
		host.querySelector<HTMLButtonElement>('a button')!.click();
		await nextTick();
		expect(host.textContent).toContain('Ads by local.example');
		host.querySelectorAll<HTMLButtonElement>('button')[0].click();
		await nextTick();
		expect(mocks.store.push).toHaveBeenCalledOnce();
		expect(mocks.store.push).toHaveBeenCalledWith('mutedAds', first.id);
		expect(mocks.store.s.mutedAds).toEqual(['already-muted', first.id]);
		expect(mocks.success).toHaveBeenCalledOnce();
		displayedAd(host, next);
		expect(host.textContent).not.toContain('Ads by local.example');
	});

	test('an already muted ratio-zero ad does not offer reduction or change persistence', async () => {
		const muted = ad('muted', 'horizontal', 5);
		mocks.instance.ads = [muted];
		mocks.store.s.mutedAds = [muted.id];
		const host = mount({ preferForms: ['horizontal'] });
		displayedAd(host, muted);
		host.querySelector<HTMLButtonElement>('a button')!.click();
		await nextTick();
		expect(host.textContent).toContain('Ads by local.example');
		expect(host.textContent).not.toContain('Reduce frequency');
		expect(mocks.store.push).not.toHaveBeenCalled();
		expect(mocks.store.s.mutedAds).toEqual([muted.id]);
	});
});
