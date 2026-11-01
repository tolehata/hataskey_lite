/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { HataFeedTutorialKind } from './hatafeed-tutorial-content.js';

type Popup = { props: { kind: HataFeedTutorialKind; isStaff?: boolean; cancelSignal: AbortSignal; anchorElement?: HTMLElement }; events: { done: () => Promise<void>; closed: () => void }; dispose: ReturnType<typeof vi.fn> };
const fixtures = vi.hoisted(() => ({ api: vi.fn(), load: vi.fn(), complete: vi.fn(), popup: vi.fn(), popups: { value: [] as unknown[] }, notify: vi.fn(), owner: { current: { id: 'alice', token: 'alice-token' } } }));
vi.mock('@/i.js', () => ({ get $i() { return fixtures.owner.current; } }));
vi.mock('@/os.js', () => ({ popup: fixtures.popup, popups: fixtures.popups }));
vi.mock('@/utility/hatafeed-ui.js', () => ({ hataFeedNotify: fixtures.notify }));
vi.mock('@/utility/hatafeed-tutorial.js', () => ({ loadHataFeedTutorialKind: fixtures.load, completeHataFeedTutorial: fixtures.complete }));
vi.mock('@/components/HataFeedTutorial.vue', () => ({ default: { template: '<div/>' } }));
let launch: typeof import('./hatafeed-tutorial-launcher.js').showHataFeedTutorial;
let popup: Popup;
beforeEach(async () => {
	vi.resetModules();
	fixtures.owner.current = { id: 'alice', token: 'alice-token' };
	fixtures.popups.value = [];
	fixtures.load.mockReset().mockResolvedValue('initial'); fixtures.complete.mockReset().mockResolvedValue(undefined); fixtures.notify.mockReset();
	fixtures.popup.mockReset().mockImplementation((_component, props, events) => {
		popup = { props, events, dispose: vi.fn() }; return { dispose: popup.dispose };
	});
	launch = (await import('./hatafeed-tutorial-launcher.js')).showHataFeedTutorial;
});

describe('HataFeed tutorial launch lifecycle', () => {
	test.each(['initial', 'update'] as const)('automatically opens %s and completes exactly once', async kind => {
		fixtures.load.mockResolvedValue(kind);
		await launch({ isActive: () => true, isStaff: true, hasExistingActivity: true });
		expect(popup.props).toMatchObject({ kind, isStaff: true });
		expect(fixtures.load).toHaveBeenCalledWith(true);
		await popup.events.done(); await popup.events.done();
		expect(fixtures.complete).toHaveBeenCalledOnce();
		popup.events.closed(); popup.events.closed(); expect(popup.dispose).toHaveBeenCalledOnce();
	});
	test.each(['initial', 'update'] as const)('settings replay of %s never reads or writes completion, and retains its anchor', async kind => {
		const anchor = window.document.createElement('button');
		await launch({ replay: true, kind, isActive: () => true, anchorElement: anchor });
		expect(popup.props).toMatchObject({ kind, anchorElement: anchor });
		await popup.events.done(); popup.events.closed();
		expect(fixtures.load).not.toHaveBeenCalled(); expect(fixtures.complete).not.toHaveBeenCalled();
		await launch({ replay: true, kind, isActive: () => true });
		expect(fixtures.popup).toHaveBeenCalledTimes(2);
	});
	test('closing without completion does not persist, does not interrupt another tab again, and permits replay', async () => {
		await launch({ isActive: () => true }); popup.events.closed();
		expect(await launch({ isActive: () => true })).toBeUndefined();
		expect(fixtures.complete).not.toHaveBeenCalled();
		await launch({ isActive: () => true, replay: true, kind: 'update' });
		expect(fixtures.popup).toHaveBeenCalledTimes(2);
	});
	test('duplicate requests and account changes during loading do not open or save the wrong guide', async () => {
		let resolve!: (kind: HataFeedTutorialKind) => void;
		fixtures.load.mockImplementation(() => new Promise(done => { resolve = done; }));
		const pending = launch({ isActive: () => true });
		expect(await launch({ isActive: () => true })).toBeUndefined();
		fixtures.owner.current = { id: 'bob', token: 'bob-token' }; resolve('initial'); await pending;
		expect(fixtures.popup).not.toHaveBeenCalled(); expect(fixtures.complete).not.toHaveBeenCalled();
	});
	test('inactive owners cannot open a late guide; mounted owners cancel through the shared dialog lifecycle', async () => {
		let resolve!: (kind: HataFeedTutorialKind) => void; let active = true;
		fixtures.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const pending = launch({ isActive: () => active }); active = false; resolve('initial'); await pending;
		expect(fixtures.popup).not.toHaveBeenCalled();
		active = true; const stop = await launch({ isActive: () => active }); stop?.();
		expect(popup.props.cancelSignal.aborted).toBe(true); await popup.events.done();
		expect(fixtures.complete).not.toHaveBeenCalled();
	});
	test('read failures suppress automatic display and completion failures notify without changing other state', async () => {
		fixtures.load.mockRejectedValueOnce(new Error('offline'));
		await launch({ isActive: () => true }); expect(fixtures.popup).not.toHaveBeenCalled();
		await launch({ isActive: () => true });
		fixtures.complete.mockRejectedValueOnce(new Error('save failed')); await popup.events.done();
		expect(fixtures.notify).toHaveBeenCalledWith('案内の確認状況を保存できませんでした');
	});
	test('an already read guide does not open', async () => {
		fixtures.load.mockResolvedValue(null); await launch({ isActive: () => true });
		expect(fixtures.popup).not.toHaveBeenCalled();
	});
	test('a slow automatic guide cannot cover an editor or draft prompt, while settings replay still opens', async () => {
		let resolve!: (kind: HataFeedTutorialKind) => void;
		fixtures.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const pending = launch({ isActive: () => true });
		fixtures.popups.value = [{ name: 'draft-prompt' }]; resolve('initial'); await pending;
		expect(fixtures.popup).not.toHaveBeenCalled();
		await launch({ isActive: () => true, replay: true });
		expect(fixtures.popup).toHaveBeenCalledOnce();
	});
});
