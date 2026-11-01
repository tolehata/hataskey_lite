/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick, ref } from 'vue';
import { afterEach, expect, test } from 'vitest';
import HataFeatureIcon from './HataFeatureIcon.vue';
import HataAppLogo from './HataAppLogo.vue';
import type { HataFeature } from '@/utility/hata-feature-icon.js';
import { HATA_FEATURE_ICONS } from '@/utility/hata-feature-icon.js';

let app: ReturnType<typeof createApp> | null = null;
let host: HTMLElement | null = null;

function mount(render: () => ReturnType<typeof h>): HTMLElement {
	host = window.document.createElement('div');
	window.document.body.append(host);
	app = createApp({ render });
	app.mount(host);
	return host;
}

afterEach(() => { app?.unmount(); host?.remove(); app = null; host = null; });

test('simultaneous capsule bars keep every cutout attached to its own SVG', () => {
	const features = Object.keys(HATA_FEATURE_ICONS) as HataFeature[];
	const apps = ['hatagoes', 'hatask', 'hatady', 'hatafeed'] as const;
	const root = mount(() => h('div', [0, 1].flatMap(() => [
		...features.map(feature => h(HataFeatureIcon, { feature, bare: true })),
		...apps.map(logoApp => h(HataAppLogo, { app: logoApp, bare: true })),
	])));
	const icons = Array.from(root.querySelectorAll('svg'));
	expect(icons).toHaveLength((features.length + apps.length) * 2);
	const ids = new Set<string>();
	for (const svg of icons) {
		const mask = svg.querySelector('mask');
		if (!mask) throw new Error('Missing SVG mask');
		expect(mask.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(mask.childElementCount).toBeGreaterThan(0);
		expect(mask.id).toBeTruthy();
		expect(ids.has(mask.id)).toBe(false);
		ids.add(mask.id);
		const paint = svg.querySelector(':scope > rect');
		expect(paint?.getAttribute('mask')).toBe(`url(#${mask.id})`);
		expect(paint?.getAttribute('fill')).toBe('currentColor');
		expect(svg.closest('[aria-hidden=true]')).not.toBeNull();
	}
});

test('switching between capsule and tile restores the selected tile palette', async () => {
	const bare = ref(false);
	const root = mount(() => h(HataFeatureIcon, { feature: 'todo', mode: 'mono-dark', bare: bare.value }));
	const icon = root.querySelector<HTMLElement>('[data-hata-feature]');
	if (!icon) throw new Error('Missing feature icon');
	expect(icon.querySelector('mask')).toBeNull();
	expect(icon.style.getPropertyValue('--hfi-ink')).toBe('#1d1b1f');
	bare.value = true;
	await nextTick();
	expect(icon.querySelector('mask')).not.toBeNull();
	expect(icon.style.getPropertyValue('--hfi-cut')).toBe('#000000');
	bare.value = false;
	await nextTick();
	expect(icon.querySelector('mask')).toBeNull();
	expect(icon.querySelector('svg > rect')?.getAttribute('fill')).toBe('var(--hfi-tile)');
	expect(icon.style.getPropertyValue('--hfi-ink')).toBe('#1d1b1f');
	expect(icon.style.getPropertyValue('--hfi-cut')).toBe('#ffffff');
});
