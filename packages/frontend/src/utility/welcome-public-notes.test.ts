/* SPDX-License-Identifier: AGPL-3.0-only */
import { ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createWelcomePublicNotes, isWelcomeGreeting, normalizeWelcomeNotes, publicAssetUrl } from './welcome-public-notes.js';

vi.mock('@@/js/config.js', () => ({ url: 'https://server.test' }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));

const note = (id = 'note1', fields: Record<string, unknown> = {}) => ({ id, createdAt: '2026-09-15T00:00:00Z', visibility: 'public', text: '今日の記録', user: { id: 'user1', name: '投稿者', username: 'visitor', host: null }, ...fields });
const file = { id: 'file1', name: 'photo.png', type: 'image/png', url: 'https://server.test/photo.png' };
const services: ReturnType<typeof createWelcomePublicNotes>[] = [];

function service(request: Parameters<typeof createWelcomePublicNotes>[1], allowed = true) {
	const enabled = ref(allowed), state = createWelcomePublicNotes(enabled, request);
	services.push(state);
	state.start();
	return { ...state, enabled };
}

afterEach(() => { services.splice(0).forEach(state => state.stop()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('welcome public notes', () => {
	test('公開ローカル投稿を陽性対照に、非公開・チャンネル・対象指定・隠された投稿を除く', () => {
		const rows = [note(), ...[
			{ visibility: 'home' }, { visibility: 'followers' }, { visibility: 'specified' },
			{ isHidden: true }, { channelId: 'privatechannel' }, { channel: { id: 'channel1' } },
			{ hasDeliveryTargets: true }, { visibleUserIds: ['user1'] },
			{ user: { username: 'remote', host: 'remote.test' } }, { text: null, renoteId: 'original' },
		].map((fields, i) => note(`excluded${i}`, fields)), note()];
		expect(normalizeWelcomeNotes(rows).map(row => row.id)).toEqual(['note1']);
		expect(normalizeWelcomeNotes([note('bad/path'), null, {}, note('quoted', { renoteId: 'original', text: '公開の引用' })]).map(row => row.id)).toEqual(['quoted']);
	});

	test('実リアクションと添付を保ち、URLのスキーム・資格情報・不正件数を取り除く', () => {
		const [row] = normalizeWelcomeNotes([note('note1', {
			cw: '', files: [file, { ...file, id: 'unsafe', url: 'javascript:alert(1)' }],
			reactions: { '🌼': 3, ':wave:': 2, ':remote@remote.test:': 1, ':bad@remote.test:': 1, zero: 0, negative: -2, invalid: '4' },
			reactionEmojis: { 'remote@remote.test': 'https://remote.test/emoji.png', 'bad@remote.test': 'data:image/svg+xml,bad' },
		})]);
		expect(row.cw).toBe('');
		expect(row.files.map(item => item.id)).toEqual(['file1']);
		expect(row.reactions).toEqual([
			{ name: '🌼', count: 3, image: null }, { name: ':wave:', count: 2, image: 'https://server.test/emoji/wave.webp' },
			{ name: ':remote@remote.test:', count: 1, image: 'https://remote.test/emoji.png' }, { name: ':bad@remote.test:', count: 1, image: null },
		]);
		expect(publicAssetUrl('/photo.png')).toBe('https://server.test/photo.png');
		expect(publicAssetUrl('/photo.png', 'http://localhost:3000')).toBe('http://localhost:3000/photo.png');
		for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', 'file:///secret', 'https://user:password@server.test/file', 'http://remote.test/file']) expect(publicAssetUrl(value)).toBeNull();
	});

	test('日本語・ローマ字・全角のあいさつを識別する', () => {
		for (const text of ['おはよう！', 'おやすみ', 'ohayo', 'Ohayou!', 'OYASUMI', 'oayasumi', 'ｏｈａｙｏ']) expect(isWelcomeGreeting(text)).toBe(true);
		for (const text of ['普通の記録', 'nohayou', 'oyasuming']) expect(isWelcomeGreeting(text)).toBe(false);
	});

	test('四つのフィードは最大12投稿、あいさつ探しは最大3ページに制限する', async () => {
		const request = vi.fn(async (_endpoint: string, params: { withFiles?: boolean; untilId?: string }) => {
			if (params.withFiles) return [note('attachment', { files: [file] }), note('without')];
			const page = params.untilId === 'page199' ? 2 : params.untilId ? 3 : 1;
			return Array.from({ length: 100 }, (_, i) => note(`page${page}${i}`, { text: i < 3 ? 'おはよう' : '日記' }));
		});
		const state = service(request);
		await state.refresh();
		expect(state.feeds.latest.notes).toHaveLength(12);
		expect(state.feeds.popular.notes).toHaveLength(12);
		expect(state.feeds.files.notes.map(row => row.id)).toEqual(['attachment']);
		expect(state.feeds.greetings.notes).toHaveLength(9);
		expect(request).toHaveBeenCalledTimes(5);
		expect(request.mock.calls.filter(([_endpoint, params]) => params.untilId)).toHaveLength(2);
	});

	test('一部APIが失敗しても別フィードの公開投稿を表示し、架空投稿で補完しない', async () => {
		const state = service(async endpoint => {
			if (endpoint === 'notes/featured') throw new Error('unavailable');
			return [note('greeting', { text: 'おやすみ' })];
		});
		await state.refresh();
		expect(state.feeds.latest.status).toBe('ready');
		expect(state.feeds.greetings.status).toBe('ready');
		expect(state.feeds.files.status).toBe('empty');
		expect(state.feeds.popular).toEqual({ status: 'error', notes: [] });
	});

	test('公開設定の撤回・再許可・アンマウント後に古い応答が復活しない', async () => {
		const waiting: { resolve: (value: unknown) => void; signal: AbortSignal }[] = [];
		const request = vi.fn((_endpoint, _params, signal: AbortSignal) => new Promise(resolve => waiting.push({ resolve, signal })));
		const state = service(request, false);
		expect(request).not.toHaveBeenCalled();
		state.enabled.value = true;
		expect(waiting).toHaveLength(3);
		state.enabled.value = false;
		expect(waiting.every(item => item.signal.aborted)).toBe(true);
		state.enabled.value = true;
		waiting.slice(3).forEach(item => item.resolve([note('fresh')]));
		await state.refresh();
		waiting.slice(0, 3).forEach(item => item.resolve([note('stale')]));
		await Promise.resolve();
		expect(state.feeds.latest.notes.map(row => row.id)).toEqual(['fresh']);
		const pending = state.refresh();
		state.stop();
		waiting.slice(6).forEach(item => item.resolve([note('unmounted')]));
		await pending;
		expect(Object.values(state.feeds).every(feed => feed.status === 'disabled' && !feed.notes.length)).toBe(true);
	});

	test('重複更新をまとめ、タイムアウト後は再試行できる', async () => {
		vi.useFakeTimers();
		const request = vi.fn((_endpoint, _params, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
		const state = service(request);
		const pending = state.refresh();
		expect(state.refresh()).toBe(pending);
		await vi.advanceTimersByTimeAsync(20_001);
		await pending;
		expect(Object.values(state.feeds).every(feed => feed.status === 'error')).toBe(true);
		request.mockImplementation(async () => [] as never);
		await state.refresh();
		expect(Object.values(state.feeds).every(feed => feed.status === 'empty')).toBe(true);
		expect(request).toHaveBeenCalledTimes(6);
	});
});
