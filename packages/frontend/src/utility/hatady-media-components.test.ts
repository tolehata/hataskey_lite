/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { HATADY_STAT_FIELDS, MEDIA_SESSION_DETAIL_KEYS, mediaDashboardSessions } from './hatady-media.js';
import type { Component } from 'vue';
import type { HatadyFormPage, HatadyFormValues } from './hatady-form.js';
import type { HatadyMediaSessionKind } from './hatady-media.js';
const fixture = vi.hoisted(() => ({ wizard: null as any, api: vi.fn(async (endpoint: string, payload: any) => endpoint.endsWith('/list') ? [] : { id: 'saved', ...payload }) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
// Isolate locale loading so the actual form schemas and API payloads can run without fetching assets.
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/HatadyFormWizard.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: ['modelValue', 'title', 'label', 'icon', 'pages', 'draftId', 'embedded', 'save', 'saveLabel', 'restore', 'summaryTitle'], emits: ['update:modelValue', 'done', 'closed', 'back'], setup(props) { fixture.wizard = props; return () => h('div'); } }) };
});
import HatadyMediaSessionForm from '@/components/HatadyMediaSessionForm.vue';
import HatadyMediaWorkForm from '@/components/HatadyMediaWorkForm.vue';
const cleanup: Array<() => void> = [];

async function mountForm(component: Component, props: Record<string, unknown>) {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(component, props) }); app.mount(target);
	cleanup.push(() => { app.unmount(); target.remove(); }); await nextTick(); return fixture.wizard as { modelValue: HatadyFormValues; pages: HatadyFormPage[]; save: (values: HatadyFormValues) => Promise<any> };
}

const work = (kind = 'game') => ({ id: 'work', kind, title: '作品', visibility: 'private', status: 'planned' });

function reachableKeys(pages: HatadyFormPage[], values: HatadyFormValues) {
	const keys = new Set(pages.filter(page => !page.when || page.when(values)).flatMap(page => page.fields.map(field => field.key)));
	if (keys.has('weaponStats')) for (const key of ['statFields', ...HATADY_STAT_FIELDS]) keys.add(key);
	return keys;
}

afterEach(() => { cleanup.splice(0).forEach(fn => fn()); fixture.api.mockClear(); });

describe('production media forms', () => {
	test('movie and game work forms mount their own controls and save their own payload fields', async () => {
		const movie = await mountForm(HatadyMediaWorkForm, { kind: 'movie' });
		const movieKeys = reachableKeys(movie.pages, movie.modelValue);
		expect(movieKeys.has('genres')).toBe(true); expect(movieKeys.has('platforms')).toBe(false); expect(movieKeys.has('weaponStats')).toBe(false);
		movie.modelValue.title = '映画'; movie.modelValue.genres = ['Action, Adventure', 'Drama']; movie.modelValue.recommendationRating = 3.5;
		await movie.save(movie.modelValue);
		expect(fixture.api.mock.calls.at(-1)).toEqual(['hata/hatady/media/works/create', expect.objectContaining({ kind: 'movie', recommendationRating: 7, genres: ['Action, Adventure', 'Drama'] })]);
		expect(fixture.api.mock.calls.at(-1)?.[1]).not.toHaveProperty('platforms');
		const game = await mountForm(HatadyMediaWorkForm, { kind: 'game' });
		const gameKeys = reachableKeys(game.pages, game.modelValue);
		expect(gameKeys.has('platforms')).toBe(true); expect(gameKeys.has('genres')).toBe(false); expect(gameKeys.has('viewingMode')).toBe(false);
	});
	test('updates cannot change the immutable media kind and preserve unknown details', async () => {
		const editor = await mountForm(HatadyMediaWorkForm, { kind: 'game', editWork: { ...work(), details: { future: { value: 7 }, memo: 'メモ' }, isRecommended: true } });
		editor.modelValue.title = '変更した作品';
		await editor.save(editor.modelValue);
		const [endpoint, payload] = fixture.api.mock.calls.at(-1)!;
		expect(endpoint).toBe('hata/hatady/media/works/update'); expect(payload.workId).toBe('work'); expect(payload).not.toHaveProperty('kind');
		expect(payload.details).toMatchObject({ future: { value: 7 }, memo: 'メモ' }); expect(payload.isRecommended).toBe(true);
	});
	for (const kind of Object.keys(MEDIA_SESSION_DETAIL_KEYS) as HatadyMediaSessionKind[]) {
		test(`${kind}: all saved details remain reachable through the actual form schema`, async () => {
			const editor = await mountForm(HatadyMediaSessionForm, { work: work(kind === 'movie_viewing' ? 'movie' : 'game') });
			editor.modelValue.sessionKind = kind; await nextTick();
			const keys = reachableKeys(editor.pages, editor.modelValue);
			for (const key of MEDIA_SESSION_DETAIL_KEYS[kind]) expect(keys.has(key), `${kind}.${key} has no input`).toBe(true);
			if (kind === 'movie_viewing') { expect(keys.has('weaponStats')).toBe(false); expect(keys.has('matchmaking')).toBe(false); } else expect(keys.has('theaterName')).toBe(false);
			// Positive control: removing an actual input must be detected by the same coverage check.
			const first = MEDIA_SESSION_DETAIL_KEYS[kind].find(key => !HATADY_STAT_FIELDS.includes(key as any) && key !== 'statFields')!;
			const broken = editor.pages.map(page => ({ ...page, fields: page.fields.filter(field => field.key !== first) }));
			expect(reachableKeys(broken, editor.modelValue).has(first)).toBe(false);
		});
	}
	test('a deleted work remains editable by session ID with its original kind and timestamp', async () => {
		const occurredAt = '2026-09-10T02:03:04.567Z';
		const editor = await mountForm(HatadyMediaSessionForm, { work: null, editSession: { id: 'session', workId: null, kind: 'game_match', occurredAt, visibility: 'followers', durationSeconds: 125, startedAt: '11:03:04.567', workSnapshot: { title: '削除された作品', kind: 'game' }, details: { result: 'win', rank: 'A', future: ['keep'] } } });
		expect(editor.pages.flatMap(page => page.fields).find(field => field.key === 'sessionKind')?.disabled).toBe(true);
		editor.modelValue.note = 'メモを追記'; editor.modelValue.sessionKind = 'movie_viewing';
		await editor.save(editor.modelValue);
		const [endpoint, payload] = fixture.api.mock.calls.at(-1)!;
		expect(endpoint).toBe('hata/hatady/media/sessions/update'); expect(payload.sessionId).toBe('session'); expect(payload).not.toHaveProperty('kind'); expect(payload).not.toHaveProperty('workId');
		expect(payload).toMatchObject({ occurredAt, durationSeconds: 125, startedAt: '11:03:04.567', visibility: 'followers', details: { rank: 'A', future: ['keep'] } });
	});
	test('switching a new game subtype keeps its outcome when returning', async () => {
		const editor = await mountForm(HatadyMediaSessionForm, { work: work() });
		editor.modelValue.sessionKind = 'game_match'; await nextTick(); editor.modelValue.result = 'win';
		editor.modelValue.sessionKind = 'game_pve'; await nextTick(); editor.modelValue.result = 'cleared';
		editor.modelValue.sessionKind = 'game_match'; await nextTick(); expect(editor.modelValue.result).toBe('win');
		editor.modelValue.sessionKind = 'game_pve'; await nextTick(); expect(editor.modelValue.result).toBe('cleared');
	});
	test('spoiler sessions stay outside another viewer’s game aggregates', () => {
		const visible = { id: 'plain', noteSpoiler: false } as any, spoiler = { id: 'spoiler', noteSpoiler: true } as any;
		expect(mediaDashboardSessions([visible, spoiler], false)).toEqual([visible]);
		expect(mediaDashboardSessions([visible, spoiler], true)).toEqual([visible, spoiler]);
	});
});
