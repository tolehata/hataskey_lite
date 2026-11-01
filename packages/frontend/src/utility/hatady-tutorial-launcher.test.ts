/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { HatadyTutorialKind } from './hatady-tutorial.js';

type Account = { id: string; token: string } | null;
type PopupProps = { kind: HatadyTutorialKind; anchorElement?: HTMLElement | null; cancelSignal: AbortSignal };
type PopupEvents = { done: () => Promise<void>; closed: () => void };
type Popup = { props: PopupProps; events: PopupEvents; dispose: ReturnType<typeof vi.fn> };
type Launcher = typeof import('./hatady-tutorial-launcher.js').showHatadyTutorial;

const fixtures = vi.hoisted(() => ({
	account: { current: { id: 'owner-one', token: 'test-token-one' } as Account },
	load: vi.fn(),
	complete: vi.fn(),
	claim: vi.fn(),
	notify: vi.fn(),
	popup: vi.fn(),
	component: { name: 'HatadyTutorialStub', render: () => null },
}));

vi.mock('@/i.js', () => ({ get $i() { return fixtures.account.current; } }));
vi.mock('@/os.js', () => ({ popup: fixtures.popup }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: fixtures.claim }));
// The registry utility has separate API/storage tests; this suite controls its async boundary.
vi.mock('@/utility/hatady-tutorial.js', () => ({
	loadHatadyTutorialKind: fixtures.load,
	completeHatadyTutorial: fixtures.complete,
}));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixtures.notify }));
vi.mock('@/components/HatadyTutorial.vue', () => ({ default: fixtures.component }));

let showHatadyTutorial: Launcher;
const popups: Popup[] = [];

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
	return { promise, resolve, reject };
}

function popup(index = 0): Popup {
	const value = popups[index];
	if (!value) throw new Error(`Missing tutorial popup ${index}`);
	return value;
}

beforeEach(async () => {
	vi.resetModules();
	popups.length = 0;
	fixtures.account.current = { id: 'owner-one', token: 'test-token-one' };
	fixtures.load.mockReset().mockResolvedValue('initial');
	fixtures.complete.mockReset().mockResolvedValue(undefined);
	fixtures.claim.mockReset().mockResolvedValue(undefined);
	fixtures.notify.mockReset();
	fixtures.popup.mockReset().mockImplementation((_component: unknown, props: PopupProps, events: PopupEvents) => {
		const value = { props, events, dispose: vi.fn() };
		popups.push(value);
		return { dispose: value.dispose };
	});
	({ showHatadyTutorial } = await import('./hatady-tutorial-launcher.js'));
});

afterEach(() => {
	for (const value of popups) value.events.closed();
});

describe('Hatady tutorial popup lifecycle', () => {
	test.each(['initial', 'update'] as const)('%s の判定と呼び出し元のアンカーを見本ダイアログへ渡す', async kind => {
		fixtures.load.mockResolvedValue(kind);
		const anchor = window.document.createElement('button');
		const stop = await showHatadyTutorial({ isActive: () => true, anchorElement: anchor });
		expect(stop).toBeTypeOf('function');
		expect(fixtures.load).toHaveBeenCalledTimes(1);
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
		expect(fixtures.popup.mock.calls[0][0]).toBe(fixtures.component);
		expect(popup().props).toEqual({ kind, anchorElement: anchor, cancelSignal: expect.anything() });
		expect(popup().props.anchorElement).toBe(anchor);
		expect(popup().props.cancelSignal.aborted).toBe(false);
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
	});

	test('未ログインでは判定も表示も始めない', async () => {
		fixtures.account.current = null;
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(fixtures.load).not.toHaveBeenCalled();
		expect(fixtures.popup).not.toHaveBeenCalled();
	});

	test('表示不要の判定は何も開かず、次回の起動を妨げない', async () => {
		fixtures.load.mockResolvedValueOnce(null);
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(fixtures.popup).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(await showHatadyTutorial({ isActive: () => true })).toBeTypeOf('function');
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
	});

	test('取得失敗を初回扱いせず、次回は再取得できる', async () => {
		fixtures.load.mockRejectedValueOnce(new Error('registry offline'));
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(fixtures.popup).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(fixtures.notify).not.toHaveBeenCalled();
		await showHatadyTutorial({ isActive: () => true });
		expect(fixtures.load).toHaveBeenCalledTimes(2);
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
	});

	test('表示元が既に無効ならダイアログを開かない', async () => {
		expect(await showHatadyTutorial({ isActive: () => false })).toBeUndefined();
		expect(fixtures.load).not.toHaveBeenCalled();
		expect(fixtures.popup).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
	});

	test('判定を待つ間に表示元が破棄されたら遅延応答で開かない', async () => {
		const loading = deferred<HatadyTutorialKind>();
		fixtures.load.mockReturnValueOnce(loading.promise);
		let active = true;
		const opening = showHatadyTutorial({ isActive: () => active });
		expect(fixtures.load).toHaveBeenCalledTimes(1);
		active = false;
		loading.resolve('initial');
		expect(await opening).toBeUndefined();
		expect(fixtures.popup).not.toHaveBeenCalled();
		active = true;
		await showHatadyTutorial({ isActive: () => active });
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
	});

	test('無効になった表示元の判定を待たずに新しい案内を開き、古い応答で新しい起動枠を解放しない', async () => {
		const loading = deferred<HatadyTutorialKind>();
		fixtures.load.mockReturnValueOnce(loading.promise).mockResolvedValue('update');
		let oldActive = true;
		const oldOpening = showHatadyTutorial({ isActive: () => oldActive });
		oldActive = false;
		const stop = await showHatadyTutorial({ isActive: () => true });
		expect(stop).toBeTypeOf('function');
		expect(fixtures.load).toHaveBeenCalledTimes(2);
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
		expect(popup().props.kind).toBe('update');
		loading.resolve('initial');
		expect(await oldOpening).toBeUndefined();
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(fixtures.load).toHaveBeenCalledTimes(2);
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
		expect(popup().props.cancelSignal.aborted).toBe(false);
		expect(popup().dispose).not.toHaveBeenCalled();
	});

	test.each([
		{ label: '別アカウント', account: { id: 'owner-two', token: 'test-token-two' } },
		{ label: '同じアカウントの別トークン', account: { id: 'owner-one', token: 'new-token' } },
		{ label: 'ログアウト', account: null },
	])('$label へ変わった後の遅延応答では表示しない', async ({ account }) => {
		const loading = deferred<HatadyTutorialKind>();
		fixtures.load.mockReturnValueOnce(loading.promise);
		const opening = showHatadyTutorial({ isActive: () => true });
		fixtures.account.current = account;
		loading.resolve('update');
		expect(await opening).toBeUndefined();
		expect(fixtures.popup).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
	});

	test('読み込み中と表示中の重複起動は cleanup を返さず、既存ダイアログを維持する', async () => {
		const loading = deferred<HatadyTutorialKind>();
		fixtures.load.mockReturnValueOnce(loading.promise);
		const opening = showHatadyTutorial({ isActive: () => true });
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(fixtures.load).toHaveBeenCalledTimes(1);
		loading.resolve('initial');
		const stop = await opening;
		expect(stop).toBeTypeOf('function');
		expect(await showHatadyTutorial({ isActive: () => true, replay: true })).toBeUndefined();
		expect(fixtures.popup).toHaveBeenCalledTimes(1);
		expect(popup().dispose).not.toHaveBeenCalled();
		popup().events.closed();
		await showHatadyTutorial({ isActive: () => true });
		expect(fixtures.popup).toHaveBeenCalledTimes(2);
		stop?.();
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
		expect(popup(1).dispose).not.toHaveBeenCalled();
	});

	test('初回 done は完了保存を待ってから実績を一度だけ進め、dispose は closed まで待つ', async () => {
		const saving = deferred<void>();
		const order: string[] = [];
		fixtures.complete.mockImplementation(() => {
			order.push('save started');
			return saving.promise.then(() => { order.push('save finished'); });
		});
		fixtures.claim.mockImplementation(async () => { order.push('achievement'); });
		await showHatadyTutorial({ isActive: () => true });
		const first = popup().events.done();
		await popup().events.done();
		expect(fixtures.complete).toHaveBeenCalledExactlyOnceWith('initial');
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(popup().dispose).not.toHaveBeenCalled();
		saving.resolve(undefined);
		await first;
		await popup().events.done();
		expect(order).toEqual(['save started', 'save finished', 'achievement']);
		expect(fixtures.claim).toHaveBeenCalledExactlyOnceWith('welcomeToHatady');
		expect(popup().dispose).not.toHaveBeenCalled();
		popup().events.closed();
		expect(popup().dispose).toHaveBeenCalledTimes(1);
	});

	test('更新案内の done は更新完了だけを一度保存し、実績を進めない', async () => {
		fixtures.load.mockResolvedValue('update');
		await showHatadyTutorial({ isActive: () => true });
		await popup().events.done();
		await popup().events.done();
		expect(fixtures.complete).toHaveBeenCalledExactlyOnceWith('update');
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(popup().dispose).not.toHaveBeenCalled();
	});

	test.each(['initial', 'update'] as const)('%s の再閲覧は既読の取得・保存・実績を動かさない', async kind => {
		await showHatadyTutorial({ isActive: () => true, replay: true, kind });
		expect(popup().props.kind).toBe(kind);
		await popup().events.done();
		await popup().events.done();
		expect(fixtures.load).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(popup().dispose).not.toHaveBeenCalled();
		popup().events.closed();
		expect(popup().dispose).toHaveBeenCalledTimes(1);
	});

	test('closed と返された cleanup が重なっても dispose は一度だけ行う', async () => {
		const stop = await showHatadyTutorial({ isActive: () => true });
		popup().events.closed();
		stop?.();
		popup().events.closed();
		await popup().events.done();
		expect(popup().dispose).toHaveBeenCalledTimes(1);
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
	});

	test('unmount の cleanup 後に遅れて done が届いても保存や実績を進めない', async () => {
		const stop = await showHatadyTutorial({ isActive: () => true });
		expect(stop).toBeTypeOf('function');
		const aborted = vi.fn();
		popup().props.cancelSignal.addEventListener('abort', aborted);
		stop?.();
		stop?.();
		expect(popup().props.cancelSignal.aborted).toBe(true);
		expect(aborted).toHaveBeenCalledTimes(1);
		await popup().events.done();
		await popup().events.done();
		expect(popup().dispose).not.toHaveBeenCalled();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
		await showHatadyTutorial({ isActive: () => true });
		expect(fixtures.popup).toHaveBeenCalledTimes(2);
		popup().events.closed();
		popup().events.closed();
		expect(popup().dispose).toHaveBeenCalledTimes(1);
		expect(popup(1).dispose).not.toHaveBeenCalled();
		expect(popup(1).props.cancelSignal.aborted).toBe(false);
		expect(await showHatadyTutorial({ isActive: () => true })).toBeUndefined();
	});

	test('表示後にアカウントが変わったら古い done を無視する', async () => {
		await showHatadyTutorial({ isActive: () => true });
		fixtures.account.current = { id: 'owner-two', token: 'test-token-two' };
		await popup().events.done();
		expect(fixtures.complete).not.toHaveBeenCalled();
		expect(fixtures.claim).not.toHaveBeenCalled();
	});

	test('保存中のアカウント切替後に別の利用者の実績を進めない', async () => {
		const saving = deferred<void>();
		fixtures.complete.mockReturnValue(saving.promise);
		await showHatadyTutorial({ isActive: () => true });
		const completion = popup().events.done();
		fixtures.account.current = { id: 'owner-two', token: 'test-token-two' };
		saving.resolve(undefined);
		await completion;
		expect(fixtures.complete).toHaveBeenCalledExactlyOnceWith('initial');
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(fixtures.notify).not.toHaveBeenCalled();
	});

	test('保存失敗は通知し、実績を進めず closed までダイアログを保持する', async () => {
		fixtures.complete.mockRejectedValue(new Error('registry write failed'));
		await showHatadyTutorial({ isActive: () => true });
		await popup().events.done();
		await popup().events.done();
		expect(fixtures.complete).toHaveBeenCalledExactlyOnceWith('initial');
		expect(fixtures.notify).toHaveBeenCalledExactlyOnceWith('案内の確認状況を保存できませんでした');
		expect(fixtures.claim).not.toHaveBeenCalled();
		expect(popup().dispose).not.toHaveBeenCalled();
		popup().events.closed();
		expect(popup().dispose).toHaveBeenCalledTimes(1);
	});
});
