/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick, ref } from 'vue';
import { afterEach, expect, test } from 'vitest';
import HataAppLogo from './HataAppLogo.vue';
import HataAppLoading from './HataAppLoading.vue';

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

test.each([false, true])('loading and tap replay preserve size in bare=%s mode', async (bare) => {
	const loading = ref(false);
	const active = ref(true);
	const tapSequence = ref(0);
	const root = mount(() => h(HataAppLogo, { app: 'hatagoes', bare, size: 16, motion: 'startup', loading: loading.value, active: active.value, tapSequence: tapSequence.value }));
	const tile = root.querySelector<HTMLElement>('[data-app=hatagoes]');
	expect(tile?.style.width).toBe('16px');
	expect(tile?.querySelectorAll('polygon')).toHaveLength(2);
	expect(tile?.querySelector('[class*=startWave]')).not.toBeNull();
	loading.value = true;
	await nextTick();
	expect(tile?.querySelectorAll('[class*=loadBand]')).toHaveLength(2);
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
	active.value = false;
	await nextTick();
	expect(tile?.dataset.active).toBe('false');
	loading.value = false;
	active.value = true;
	tapSequence.value++;
	await nextTick();
	await nextTick();
	await Promise.resolve();
	await nextTick();
	expect(tile?.querySelector('[class*=loadBand]')).toBeNull();
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
	expect(tile?.querySelector('[class*=tap]')).not.toBeNull();
	const childEnd = new Event('animationend', { bubbles: true });
	Object.defineProperty(childEnd, 'animationName', { value: 'xMinifiedChild' });
	tile?.querySelector('[class*=tap] polygon')?.dispatchEvent(childEnd);
	await nextTick();
	expect(tile?.querySelector('[class*=tap]')).not.toBeNull();
	const tapEnd = new Event('animationend', { bubbles: true });
	Object.defineProperty(tapEnd, 'animationName', { value: 'xAyfQfobxy' });
	tile?.querySelector('[class*=tap]')?.dispatchEvent(tapEnd);
	await nextTick();
	expect(tile?.querySelector('[class*=tap]')).toBeNull();
	expect(tile?.style.width).toBe('16px');
});

test.each([false, true])('startup stays complete across motion changes in bare=%s mode', async (bare) => {
	const motion = ref<'startup' | 'idle' | 'loading'>('startup');
	const root = mount(() => h(HataAppLogo, { app: 'hatask', bare, motion: motion.value }));
	const tile = root.querySelector<HTMLElement>('[data-app=hatask]');
	expect(tile?.querySelector('[class*=startWave]')).not.toBeNull();
	const bandEnd = new Event('animationend', { bubbles: true });
	Object.defineProperty(bandEnd, 'animationName', { value: 'xMinifiedBand' });
	tile?.querySelector('[class*=startBand]')?.dispatchEvent(bandEnd);
	await nextTick();
	expect(tile?.querySelector('[class*=startWave]')).not.toBeNull();
	const waveEnd = new Event('animationend', { bubbles: true });
	Object.defineProperty(waveEnd, 'animationName', { value: 'xwp0lgl2Jx' });
	tile?.querySelector('[class*=startWave]')?.dispatchEvent(waveEnd);
	await nextTick();
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
	motion.value = 'loading';
	await nextTick();
	expect(tile?.querySelector('[class*=loadShape]')).not.toBeNull();
	motion.value = 'startup';
	await nextTick();
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
});

test.each([false, true])('initial loading takes priority over startup in bare=%s mode', async (bare) => {
	const loading = ref(true);
	const root = mount(() => h(HataAppLogo, { app: 'hatafeed', bare, motion: 'startup', loading: loading.value }));
	const tile = root.querySelector<HTMLElement>('[data-app=hatafeed]');
	expect(tile?.querySelector('[class*=loadShape]')).not.toBeNull();
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
	loading.value = false;
	await nextTick();
	expect(tile?.querySelector('[class*=loadShape]')).toBeNull();
	expect(tile?.querySelector('[class*=startWave]')).toBeNull();
});

test('the loading wrapper exposes status while active and keeps the logo decorative', async () => {
	const loading = ref(true);
	const root = mount(() => h(HataAppLoading, { app: 'hatady', loading: loading.value, label: '同期中' }));
	expect(root.querySelector('[role=status]')?.getAttribute('aria-label')).toBe('同期中');
	expect(root.querySelector('svg')?.closest('[aria-hidden=true]')).not.toBeNull();
	loading.value = false;
	await nextTick();
	expect(root.querySelector('[role=status]')).toBeNull();
	expect(root.querySelector('[class*=loadShape]')).toBeNull();
});
