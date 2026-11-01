/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import HatadyActivityCard from './HatadyActivityCard.vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: vi.fn() }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/HatadyReactions.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));

const MfmStub = defineComponent({
	props: { text: { type: String, required: true } },
	setup(props) {
		return () => h('span', { 'data-mfm': '' }, props.text);
	},
});

const cleanups: Array<() => void> = [];
const timestamp = '2026-09-18T01:02:03.456Z';
const text = '今日も :blobcat: がんばった';

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

async function mountCard(activity: HatadyActivity, variant: 'hatady' | 'ui' | 'uis') {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HatadyActivityCard, { activity, variant, showActions: false, showAuthor: false }) });
	app.component('Mfm', MfmStub);
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await nextTick();
	return host;
}

function studyActivity(): HatadyActivity {
	return { id: 'activity', type: 'study', occurredAt: timestamp, visibility: 'public', isMine: false, study: { id: 'log', title: '記録', body: text } };
}

function mediaActivity(): HatadyActivity {
	return { id: 'activity', type: 'movie_viewing', occurredAt: timestamp, visibility: 'public', isMine: false, media: { work: null, session: { id: 'session', workId: null, kind: 'movie_viewing', occurredAt: timestamp, createdAt: timestamp, updatedAt: timestamp, visibility: 'public', note: text } } };
}

function rawActivity(): HatadyActivity {
	return { id: 'activity', type: 'cooking', occurredAt: timestamp, visibility: 'public', isMine: false, body: text } as HatadyActivity;
}

describe('HatadyActivityCard record text', () => {
	test.each([
		['study', studyActivity],
		['media session', mediaActivity],
		['other activity', rawActivity],
	] as const)('UI S renders the %s body through MFM so custom emoji become images', async (_, make) => {
		const host = await mountCard(make(), 'uis');
		const mfm = host.querySelectorAll('[data-mfm]');
		expect(mfm).toHaveLength(1);
		expect(mfm[0].textContent).toBe(text);
		expect(mfm[0].parentElement!.tagName).toBe('P');
	});

	test.each(['hatady', 'ui'] as const)('%s surface keeps the body as plain text', async variant => {
		for (const make of [studyActivity, mediaActivity, rawActivity]) {
			const host = await mountCard(make(), variant);
			expect(host.querySelector('[data-mfm]')).toBeNull();
			expect([...host.querySelectorAll('p')].some(p => p.textContent === text)).toBe(true);
		}
	});
});
