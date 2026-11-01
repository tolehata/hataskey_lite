/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick, ref } from 'vue';
import type { Slots } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import HatadyHome from './HatadyHome.vue';
import { HATA_GOES_HOST, HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';

const dialog = vi.hoisted(() => ({ close: vi.fn(), finish: null as null | (() => void) }));

vi.mock('@@/js/locale.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	return { locale: load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) };
});
vi.mock('@/account.js', () => ({ $i: null }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(async (path: string) => path === 'hata/hatady/activities' ? { items: [], nextCursor: null, hasMore: false } : []) }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false) }, s: {}, commit: vi.fn() } };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { h } = await import('vue');
	return { default: {
		setup(_props: unknown, { emit, expose, slots }: { emit: (event: string) => void; expose: (value: object) => void; slots: Slots }) {
			expose({ close: () => { dialog.close(); dialog.finish = () => emit('closed'); } });
			return () => h('div', { 'data-overview-dialog': '' }, [
				h('button', { class: 'dialog-close', onClick: () => emit('close') }, 'close'),
				...(slots.default?.() ?? []),
			]);
		},
	} };
});

let app: ReturnType<typeof createApp> | null = null;
let host: HTMLElement | null = null;
let header: HTMLElement | null = null;
const headerDate = ref<HTMLElement | null>(null);
const headerActions = ref<HTMLElement | null>(null);
const paneActive = ref(true);
const active = ref(true);
const sessionActive = ref(true);
const records = vi.fn();

async function flush() { await nextTick(); await Promise.resolve(); await nextTick(); }

async function mount(withHeader = false) {
	host = window.document.createElement('div');
	window.document.body.append(host);
	if (withHeader) {
		header = window.document.createElement('nav');
		headerDate.value = window.document.createElement('div');
		headerActions.value = window.document.createElement('div');
		header.append(headerDate.value, headerActions.value);
		window.document.body.append(header);
	}
	app = createApp({ render: () => h(HatadyHome, { revision: 0, onRecords: records, active: paneActive.value, headerDateTarget: headerDate.value, headerActionsTarget: headerActions.value }) });
	app.provide(HATA_GOES_HOST, { active, register: () => () => {}, changed: () => {} });
	app.provide(HATA_GOES_SESSION, { active: sessionActive, track: () => () => {}, preserveDraft: () => () => {} });
	app.component('MkUserName', { render: () => h('span') });
	app.component('MkTime', { render: () => h('time') });
	app.component('MkAvatar', { render: () => h('span') });
	app.component('Mfm', { render: () => h('span') });
	app.mount(host);
	await flush();
	(withHeader ? header : host)!.querySelector<HTMLButtonElement>('button.hy-secondary')!.click();
	await flush();
	return window.document.querySelector<HTMLElement>('[data-overview-dialog]')!;
}

beforeEach(() => {
	headerDate.value = null;
	headerActions.value = null;
	paneActive.value = true;
	active.value = true;
	sessionActive.value = true;
	dialog.close.mockClear();
	dialog.finish = null;
	records.mockClear();
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
	app?.unmount();
	host?.remove();
	header?.remove();
	header = null;
	app = null;
	host = null;
	vi.unstubAllGlobals();
});

test('overview renders at body level and closes after the dialog transition', async () => {
	const overlay = await mount();
	expect(overlay.parentElement).toBe(window.document.body);
	expect(host!.contains(overlay)).toBe(false);
	overlay.querySelector<HTMLButtonElement>('.dialog-close')!.click();
	await flush();
	expect(dialog.close).toHaveBeenCalledOnce();
	expect(window.document.body.contains(overlay)).toBe(true);
	dialog.finish?.();
	await flush();
	expect(window.document.body.contains(overlay)).toBe(false);
});

test('selecting a ranked kind emits records after closure', async () => {
	const overlay = await mount();
	overlay.querySelector<HTMLButtonElement>('button:not(.dialog-close)')!.click();
	await flush();
	expect(dialog.close).toHaveBeenCalledOnce();
	expect(records).not.toHaveBeenCalled();
	dialog.finish?.();
	await flush();
	expect(records).toHaveBeenCalledWith('study');
});

test('hosted date and overview control retain their interaction and independent fallback', async () => {
	const overlay = await mount(true);
	expect(header!.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	expect(header!.querySelector('time')?.getAttribute('aria-label')).toContain('月');
	expect(host!.querySelector('time')).toBeNull();
	expect(host!.querySelector('header button.hy-secondary')).toBeNull();
	expect(overlay.parentElement).toBe(window.document.body);
	overlay.querySelector<HTMLButtonElement>('button:not(.dialog-close)')!.click();
	await flush();
	dialog.finish?.();
	await flush();
	expect(records).toHaveBeenCalledWith('study');

	paneActive.value = false;
	await flush();
	expect(header!.querySelector('time, button')).toBeNull();
	paneActive.value = true;
	await flush();
	expect(header!.querySelectorAll('time')).toHaveLength(1);
	expect(header!.querySelectorAll('button')).toHaveLength(1);
	active.value = false;
	await flush();
	expect(header!.querySelector('time, button')).toBeNull();
	active.value = true;
	sessionActive.value = false;
	await flush();
	expect(header!.querySelector('time, button')).toBeNull();
	sessionActive.value = true;
	const actions = headerActions.value;
	headerActions.value = null;
	await flush();
	expect(header?.querySelector('button')).toBeNull();
	expect(header!.querySelector('time')).not.toBeNull();
	expect(host!.querySelector('time')).toBeNull();
	expect(host!.querySelector('header button.hy-secondary')).not.toBeNull();
	headerActions.value = actions;
	await flush();
	app!.unmount();
	app = null;
	expect(header!.querySelector('time, button')).toBeNull();
});

test('mobile date returns to the home greeting while overview moves without duplication or closing', async () => {
	const overlay = await mount(true);
	if (!header || !host) throw new Error('Missing home and header');
	const desktopDate = headerDate.value;
	const desktopActions = headerActions.value;
	const date = header.querySelector('time');
	const overview = header.querySelector('button');
	const mobileActions = window.document.createElement('div');
	header.append(mobileActions);
	headerDate.value = null;
	headerActions.value = mobileActions;
	await flush();
	expect(host.querySelector('header time')).toBe(date);
	expect(date?.getAttribute('data-hosted')).toBe('false');
	expect(mobileActions.querySelector('button')).toBe(overview);
	expect(host.querySelector('header button.hy-secondary')).toBeNull();
	expect(window.document.querySelector('[data-overview-dialog]')).toBe(overlay);
	paneActive.value = false;
	await flush();
	expect(mobileActions.querySelector('button')).toBeNull();
	paneActive.value = true;
	headerDate.value = desktopDate;
	headerActions.value = desktopActions;
	await flush();
	expect(desktopDate?.querySelector('time')).toBe(date);
	expect(host.querySelector('header time')).toBeNull();
	expect(header.querySelectorAll('button')).toHaveLength(1);
	expect(mobileActions.querySelector('button')).toBeNull();
});

test('inactive pane, session, and owner unmount remove the portal', async () => {
	await mount();
	active.value = false;
	await flush();
	expect(window.document.querySelector('[data-overview-dialog]')).toBeNull();
	active.value = true;
	host!.querySelector<HTMLButtonElement>('header button.hy-secondary')!.click();
	await flush();
	expect(window.document.querySelector('[data-overview-dialog]')).not.toBeNull();
	sessionActive.value = false;
	await flush();
	expect(window.document.querySelector('[data-overview-dialog]')).toBeNull();
	sessionActive.value = true;
	host!.querySelector<HTMLButtonElement>('header button.hy-secondary')!.click();
	await flush();
	expect(window.document.querySelector('[data-overview-dialog]')).not.toBeNull();
	app!.unmount();
	app = null;
	expect(window.document.querySelector('[data-overview-dialog]')).toBeNull();
});
