/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import { noteEvents, useNoteCapture } from './use-note-capture.js';
import type { entities } from 'cherrypick-js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), intervals: [] as { tick: () => void; stop: ReturnType<typeof vi.fn> }[] }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@@/js/interval.js', () => ({ createVisibilityAwareInterval: (tick: () => void) => {
	const stop = vi.fn(); mocks.intervals.push({ tick, stop }); return stop;
} }));
vi.mock('@/stream.js', () => ({ useStream: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'viewer' } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { pollingInterval: 3 } } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: false } } }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/muted-reactions.js', () => ({ notifyMutedReactionSourceChanged: vi.fn(), reactionCountsChanged: vi.fn(), shouldRevalidateMutedReactionActors: vi.fn() }));
const cleanups: (() => void)[] = [];
beforeEach(() => { mocks.intervals.length = 0; mocks.api.mockReset(); vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

function mount(id: string, status: entities.Note['utageStatus'] = 'running') {
	const note = reactive({ id, createdAt: new Date().toISOString(), reactions: {}, reactionCount: 0, reactionEmojis: {}, utageStatus: status, utageRevision: 1 } as entities.Note);
	let capture!: ReturnType<typeof useNoteCapture>;
	const host = window.document.createElement('div');
	const app = createApp({ setup() { capture = useNoteCapture({ note, parentNote: null }); return () => h('div'); } }); app.mount(host);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); mounted = false; } };
	cleanups.push(unmount); return { note, get live() { return capture.$note; }, unmount };
}

const settle = async () => { for (let i = 0; i < 5; i++) await nextTick(); };
describe('宴の再取得と購読の寿命', () => {
	test('遅延したRESTが先に届いた復活イベントを上書きしない', async () => {
		let resolve!: (value: unknown) => void;
		mocks.api.mockImplementation(() => new Promise(done => { resolve = done; }));
		const view = mount('ordering');
		noteEvents.emit('utageStatusUpdated:ordering', { utageStatus: 'reviving', utageRevision: 3 });
		expect(mocks.api).toHaveBeenCalledWith('notes/show', { noteId: 'ordering' });
		resolve({ utageStatus: 'running', utageRevision: 1 }); await settle();
		expect(view.live.utageStatus).toBe('reviving'); expect(view.note.utageRevision).toBe(3);
	});
	test('通知を失っても再取得で確定し、終端状態でポーリングを解除する', async () => {
		mocks.api.mockResolvedValue({ utageStatus: 'succeeded', utageRevision: 4, utageSuccessMethod: 'revival' });
		const view = mount('recovery', 'reviving'); const interval = mocks.intervals[0]; interval.tick(); await settle();
		expect(view.live.utageStatus).toBe('succeeded'); expect(view.note.utageSuccessMethod).toBe('revival');
		expect(interval.stop).toHaveBeenCalledOnce();
	});
	test('複数列の同じノートは進行中の取得を共有し、破棄後は更新しない', async () => {
		let resolve!: (value: unknown) => void;
		mocks.api.mockImplementation(() => new Promise(done => { resolve = done; }));
		const first = mount('shared', 'reviving'), second = mount('shared', 'reviving');
		mocks.intervals.forEach(interval => interval.tick()); expect(mocks.api).toHaveBeenCalledTimes(1);
		first.unmount(); resolve({ utageStatus: 'failed', utageRevision: 4 }); await settle();
		expect(first.live.utageStatus).toBe('reviving'); expect(second.live.utageStatus).toBe('failed');
		expect(mocks.intervals.every(interval => interval.stop.mock.calls.length === 1)).toBe(true);
	});
});
