/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HatadyStreaks from './HatadyStreaks.vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), popup: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ popup: fixture.popup }));
vi.mock('@/utility/hatady-prefs.js', () => ({ hatadyTzOffset: () => 540 }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadySeconds: () => 0 }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/HatadyConversation.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { title: String },
		emits: ['close', 'closed'],
		setup(props, { slots, emit, expose }) {
			expose({ close: () => emit('closed') });
			return () => render('section', { 'aria-label': props.title }, slots.default?.());
		},
	}) };
});
vi.mock('@/components/HatadyActivityCard.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { activity: { type: Object, required: true } },
		emits: ['deleted', 'openLog', 'openSession', 'openBook', 'openMedia', 'openProfile', 'edit'],
		setup(props, { emit }) {
			return () => render('article', { 'data-record': props.activity.id }, [
				render('span', props.activity.study.title),
				render('button', { 'aria-label': '削除', onClick: () => emit('deleted') }, '削除'),
				render('button', { 'aria-label': '会話', onClick: () => emit('openLog', props.activity.study.id) }, '会話'),
			]);
		},
	}) };
});

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

async function settle() {
	for (let i = 0; i < 5; i++) { await Promise.resolve(); await nextTick(); }
}

test('removes direct and conversation deletions immediately, refreshes aggregates and the opened range, and ignores old or failed refreshes', async () => {
	const rows: HatadyActivity[] = ['first', 'second', 'third'].map((id, index) => ({
		id: `log:${id}`, type: 'study', occurredAt: `2026-09-${17 + index}T01:00:00Z`, visibility: 'private', isMine: true,
		study: { id, title: `記録 ${id}` },
	}));
	const page = { items: rows, hasMore: false, nextCursor: null };
	let resolveOld: (value: typeof page) => void = () => { throw new Error('Pending request not initialized'); };
	const oldRefresh = new Promise<typeof page>(resolve => { resolveOld = resolve; });
	const streaks = vi.fn()
		.mockResolvedValueOnce({ current: 3, best: 3, periods: [{ start: '2026-09-17', end: '2026-09-19', days: 3 }] })
		.mockResolvedValueOnce({ current: 2, best: 2, periods: [{ start: '2026-09-18', end: '2026-09-19', days: 2 }] })
		.mockRejectedValue(new Error('Aggregate refresh failed'));
	const activities = vi.fn().mockResolvedValueOnce(page).mockReturnValueOnce(oldRefresh).mockRejectedValue(new Error('Period refresh failed'));
	fixture.api.mockImplementation((endpoint: string, params: unknown) => {
		if (endpoint === 'hata/hatady/streaks') return streaks(params);
		if (endpoint === 'hata/hatady/activities') return activities(params);
		throw new Error(`Unexpected endpoint ${endpoint}`);
	});
	fixture.popup.mockReturnValue({ dispose: vi.fn() });
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HatadyStreaks) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	host.querySelector<HTMLButtonElement>('section[aria-label="連続記録"] button')!.click();
	await settle();
	expect(host.querySelectorAll('[data-record]')).toHaveLength(3);
	const originalRange = activities.mock.calls[0][0];
	host.querySelector<HTMLButtonElement>('[data-record="log:first"] [aria-label="削除"]')!.click();
	await settle();
	expect(host.querySelector('[data-record="log:first"]')).toBeNull();
	expect(host.querySelectorAll('[data-record]')).toHaveLength(2);
	expect(host.querySelector('progress')?.getAttribute('value')).toBe('2');
	expect(activities.mock.calls[1][0]).toEqual(originalRange);
	expect(host.querySelector('section[aria-label$="の記録"]')).not.toBeNull();
	host.querySelector<HTMLButtonElement>('[data-record="log:second"] [aria-label="会話"]')!.click();
	await vi.dynamicImportSettled();
	await settle();
	const callbacks = fixture.popup.mock.calls.at(-1)![2];
	callbacks.deleted(rows[1]);
	callbacks.changed();
	await settle();
	expect(host.textContent).toContain('記録を読み込めませんでした');
	expect(host.textContent).toContain('連続記録を読み込めませんでした');
	expect(host.querySelectorAll('[data-record]')).toHaveLength(1);
	expect(host.textContent).toContain('記録 third');
	resolveOld(page);
	await settle();
	expect(host.querySelector('[data-record="log:first"]')).toBeNull();
	expect(host.querySelector('[data-record="log:second"]')).toBeNull();
	expect(host.querySelectorAll('[data-record]')).toHaveLength(1);
	expect(activities).toHaveBeenCalledTimes(3);
	expect(streaks).toHaveBeenCalledTimes(3);
	expect(activities.mock.calls[2][0]).toEqual(originalRange);
});

test('HataGoes shows a month grid and inline records for a selected day, then refetches that day after deletion', async () => {
	const activity = { id: 'log:one', type: 'study', occurredAt: '2026-09-18T01:00:00Z', visibility: 'private', isMine: true, study: { id: 'one', title: '記録 one' } } as HatadyActivity;
	const streaks = vi.fn().mockResolvedValue({ current: 3, best: 3, periods: [{ start: '2026-09-17', end: '2026-09-19', days: 3 }] });
	const activities = vi.fn().mockResolvedValue({ items: [activity], hasMore: false, nextCursor: null });
	fixture.api.mockImplementation((endpoint: string, params: unknown) => {
		if (endpoint === 'hata/hatady/streaks') return streaks(params);
		if (endpoint === 'hata/hatady/activities') return activities(params);
		throw new Error(`Unexpected endpoint ${endpoint}`);
	});
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HatadyStreaks) });
	app.provide(HATA_GOES_HOST, { active: { value: true }, register: () => () => {}, changed: () => {} } as any);
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	expect(host.querySelector('section[aria-label="記録カレンダー"]')).not.toBeNull();
	expect(host.querySelector('button[data-date="2026-09-18"]')?.getAttribute('data-recorded')).toBe('true');
	expect(host.querySelector('button[data-date="2026-09-18"]')?.getAttribute('aria-label')).toContain('記録あり');
	expect(host.querySelector('button[data-date="2026-09-19"]')?.getAttribute('aria-pressed')).toBe('true');
	expect(host.querySelectorAll('[data-record]')).toHaveLength(1);
	expect(host.querySelectorAll('section[aria-label$="の記録"]')).toHaveLength(1);
	host.querySelector<HTMLButtonElement>('button[data-date="2026-09-18"]')!.click();
	await settle();
	expect(activities.mock.calls.at(-1)?.[0]).toEqual({ scope: 'mine', sinceDate: new Date('2026-09-18T00:00:00').getTime(), untilDate: new Date('2026-09-18T23:59:59.999').getTime(), limit: 100 });
	expect(host.querySelector('button[data-date="2026-09-18"]')?.getAttribute('aria-pressed')).toBe('true');
	host.querySelector<HTMLButtonElement>('[data-record="log:one"] [aria-label="削除"]')!.click();
	await settle();
	expect(activities).toHaveBeenCalledTimes(3);
	expect(activities.mock.calls.at(-1)?.[0]).toEqual(activities.mock.calls[1][0]);
	host.querySelector<HTMLButtonElement>('[aria-label="前の月"]')!.click();
	await settle();
	expect(host.querySelector('button[data-date="2026-08-31"]')).not.toBeNull();
	expect(host.querySelectorAll('section[aria-label$="の記録"]')).toHaveLength(0);
});
