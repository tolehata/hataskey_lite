/* SPDX-FileCopyrightText: hataskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import MkLtlPunch from './MkLtlPunch.vue';
import type { LtlPunchState } from '@/utility/hata-ltl-punch.js';

const mocks = vi.hoisted(() => ({
	send: vi.fn(), dispose: vi.fn(), receive: null as ((state: LtlPunchState | null) => void) | null,
	channels: [] as Array<{ receive: ((state: LtlPunchState | null) => void) | null; send: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
	state: 'connected' as 'initializing' | 'reconnecting' | 'connected',
	listeners: new Map<string, Set<() => void>>(),
}));
vi.mock('@/stream.js', () => ({ useStream: () => ({
	get state() { return mocks.state; },
	useChannel: () => {
		const channel = { receive: null as ((state: LtlPunchState | null) => void) | null, send: vi.fn((...args: unknown[]) => mocks.send(...args)), dispose: vi.fn(() => mocks.dispose()) };
		mocks.channels.push(channel);
		return { on: (_name: string, listener: (state: LtlPunchState | null) => void) => { channel.receive = listener; mocks.receive = listener; }, send: channel.send, dispose: channel.dispose };
	},
	on: (name: string, listener: () => void) => { if (!mocks.listeners.has(name)) mocks.listeners.set(name, new Set()); mocks.listeners.get(name)?.add(listener); },
	off: (name: string, listener: () => void) => { mocks.listeners.get(name)?.delete(listener); },
}) }));

function streamEvent(name: '_connected_' | '_disconnected_', state: typeof mocks.state): void {
	mocks.state = state;
	mocks.listeners.get(name)?.forEach(listener => listener());
}

const initial: LtlPunchState = { id: 'event', revision: 1, startedAt: 10000, fallAt: 13200, endsAt: 49200, finishedAt: null, status: 'active', hp: 240, maxHp: 240, people: 8, serverNow: 10000 };
let app: ReturnType<typeof createApp> | null = null;
let frames: FrameRequestCallback[] = [];
const originalHidden = Object.getOwnPropertyDescriptor(window.document, 'hidden');
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

function setHidden(hidden: boolean): void {
	Object.defineProperty(window.document, 'hidden', { configurable: true, value: hidden });
	window.document.dispatchEvent(new Event('visibilitychange'));
}

async function flushFrame(): Promise<void> {
	frames.splice(0).forEach(frame => frame(performance.now()));
	await nextTick(); await nextTick();
}

function mount() {
	const navbar = window.document.createElement('header'), timeline = window.document.createElement('section'), host = window.document.createElement('div');
	navbar.innerHTML = '<div id="punch-slot"></div>';
	timeline.innerHTML = '<article data-note-removal-id="one"><button id="enabled">React</button><button id="disabled" disabled>Disabled</button></article>';
	Object.defineProperty(navbar, 'getBoundingClientRect', { value: () => ({ left: 0, right: 500, top: 0, bottom: 80, width: 500, height: 80 }) });
	Object.defineProperty(timeline, 'getBoundingClientRect', { value: () => ({ left: 0, right: 500, top: 80, bottom: 640, width: 500, height: 560 }) });
	window.document.body.append(navbar, timeline, host);
	const props = reactive({ active: true, navbarTarget: navbar.firstElementChild as HTMLElement, navbarFrame: navbar, timelineRoot: timeline as HTMLElement | null, viewportTarget: timeline, animationEnabled: true });
	app = createApp({ render: () => h(MkLtlPunch, props) }); app.mount(host);
	return { props, navbar, timeline };
}

beforeEach(() => {
	vi.useFakeTimers(); vi.setSystemTime(10000); mocks.send.mockClear(); mocks.dispose.mockClear(); mocks.receive = null; mocks.channels = []; mocks.listeners.clear(); mocks.state = 'connected'; frames = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
	vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
	app?.unmount(); app = null; window.document.body.replaceChildren(); vi.unstubAllGlobals(); vi.useRealTimers();
	if (originalHidden) Object.defineProperty(window.document, 'hidden', originalHidden); else Reflect.deleteProperty(window.document, 'hidden');
	if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate); else Reflect.deleteProperty(Element.prototype, 'animate');
});

describe('LTL punch lifecycle and operation guard', () => {
	it('guards new note controls without changing disabled state and disposes when inactive', async () => {
		const { props, timeline, navbar } = mount();
		mocks.receive?.(initial); await flushFrame();
		expect(timeline.inert).toBe(true);
		expect((timeline.querySelector('#enabled') as HTMLButtonElement).disabled).toBe(false);
		const added = window.document.createElement('button'); timeline.append(added); await nextTick(); await nextTick();
		expect(added.disabled).toBe(false);
		const click = vi.fn(); added.addEventListener('click', click);
		const event = new MouseEvent('click', { bubbles: true, cancelable: true }); added.dispatchEvent(event);
		expect(click).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(true);
		expect(navbar.dataset.ltlPunchPhase).toBe('charging');
		props.active = false; await nextTick();
		expect(timeline.inert).toBe(false);
		expect((timeline.querySelector('#enabled') as HTMLButtonElement).disabled).toBe(false);
		expect((timeline.querySelector('#disabled') as HTMLButtonElement).disabled).toBe(true);
		expect(added.disabled).toBe(false);
		expect(navbar.hasAttribute('data-ltl-punch-phase')).toBe(false);
		expect(mocks.dispose).toHaveBeenCalledOnce();
	});
	it('preserves a Vue disabled update that arrives while the operation guard is active', async () => {
		const { props, timeline } = mount(); mocks.receive?.(initial); await flushFrame();
		const button = timeline.querySelector('#disabled') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		button.disabled = false;
		props.active = false; await nextTick();
		expect(button.disabled).toBe(false);
	});
	it('does not show an attack button during preparation and sends server attack only during falling', async () => {
		mount(); mocks.receive?.(initial); await flushFrame();
		expect(window.document.querySelector('.hata-ltl-punch-fist')).toBeNull();
		vi.setSystemTime(13200); await flushFrame();
		(window.document.querySelector('.hata-ltl-punch-fist') as HTMLButtonElement).click();
		expect(mocks.send).toHaveBeenCalledWith('attack', { eventId: 'event', requestId: expect.any(String) });
	});
	it('keeps an empty LTL attackable and protects notes as soon as the root appears', async () => {
		const { props, timeline } = mount(); props.timelineRoot = null; await nextTick();
		mocks.receive?.(initial); await flushFrame();
		vi.setSystemTime(13200); await flushFrame();
		const viewport = window.document.querySelector('.hata-ltl-punch-viewport') as HTMLElement;
		expect(viewport.style.height).toBe('560px');
		(window.document.querySelector('.hata-ltl-punch-fist') as HTMLButtonElement).click();
		expect(mocks.send).toHaveBeenCalledWith('attack', expect.objectContaining({ eventId: 'event' }));
		props.timelineRoot = timeline; await nextTick();
		expect(timeline.inert).toBe(true);
		expect((timeline.querySelector('#enabled') as HTMLButtonElement).disabled).toBe(false);
	});
	it('releases guards on a missing sync response without declaring a local result', async () => {
		const { timeline } = mount(); mocks.receive?.(initial); await flushFrame();
		await vi.advanceTimersByTimeAsync(20000);
		expect(timeline.inert).toBe(false);
		expect(window.document.querySelector('.hata-ltl-punch-nav')).toBeNull();
		expect(frames).toHaveLength(0);
	});
	it('keeps the channel when sync replies arrive and renews its acknowledgement time', async () => {
		mount();
		await vi.advanceTimersByTimeAsync(10000);
		mocks.receive?.(null);
		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.channels).toHaveLength(1);
		expect(mocks.dispose).not.toHaveBeenCalled();
		expect(mocks.channels[0].send).toHaveBeenCalledWith('sync', {});
	});
	it('resubscribes after silence, ignores delayed old events, and shows the next state', async () => {
		const { timeline } = mount();
		mocks.receive?.(initial); await flushFrame();
		const oldChannel = mocks.channels[0];
		await vi.advanceTimersByTimeAsync(15000);
		expect(oldChannel.dispose).toHaveBeenCalledOnce();
		expect(timeline.inert).toBe(false);
		oldChannel.receive?.(initial);
		await flushFrame();
		expect(window.document.querySelector('.hata-ltl-punch-nav')).toBeNull();
		await vi.advanceTimersByTimeAsync(1000);
		expect(mocks.channels).toHaveLength(2);
		mocks.channels[1].receive?.({ ...initial, revision: 2, serverNow: 26000 });
		await flushFrame();
		expect(window.document.querySelector('.hata-ltl-punch-nav')).not.toBeNull();
		expect(timeline.inert).toBe(true);
	});
	it('uses exponential retry delays and resets them after a null snapshot', async () => {
		mount();
		await vi.advanceTimersByTimeAsync(15000);
		expect(mocks.channels).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(999);
		expect(mocks.channels).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.channels).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(15000);
		await vi.advanceTimersByTimeAsync(1999);
		expect(mocks.channels).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.channels).toHaveLength(3);
		mocks.channels[2].receive?.(null);
		await vi.advanceTimersByTimeAsync(15000);
		await vi.advanceTimersByTimeAsync(999);
		expect(mocks.channels).toHaveLength(3);
		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.channels).toHaveLength(4);
	});
	it('caps repeated retry delays at 60 seconds', async () => {
		mount();
		for (const delay of [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
			const count = mocks.channels.length;
			await vi.advanceTimersByTimeAsync(15000 + delay - 1);
			expect(mocks.channels).toHaveLength(count);
			await vi.advanceTimersByTimeAsync(1);
			expect(mocks.channels).toHaveLength(count + 1);
		}
	});
	it('cancels pending retries while hidden, inactive, or unmounted', async () => {
		const { props } = mount();
		await vi.advanceTimersByTimeAsync(15000);
		setHidden(true);
		await vi.advanceTimersByTimeAsync(60000);
		expect(mocks.channels).toHaveLength(1);
		setHidden(false);
		expect(mocks.channels).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(15000);
		props.active = false; await nextTick();
		await vi.advanceTimersByTimeAsync(60000);
		expect(mocks.channels).toHaveLength(2);
		props.active = true; await nextTick();
		expect(mocks.channels).toHaveLength(3);
		await vi.advanceTimersByTimeAsync(15000);
		app?.unmount(); app = null;
		await vi.advanceTimersByTimeAsync(60000);
		expect(mocks.channels).toHaveLength(3);
	});
	it('reconnects once after pagehide and pageshow even with a visibility event', () => {
		mount();
		window.dispatchEvent(new Event('pagehide'));
		expect(mocks.channels[0].dispose).toHaveBeenCalledOnce();
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(mocks.channels).toHaveLength(1);
		window.dispatchEvent(new Event('pageshow'));
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(mocks.channels).toHaveLength(2);
	});
	it('waits for socket reconnect before sending sync or checking for silence', async () => {
		mocks.state = 'initializing'; mount();
		expect(mocks.send).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30000);
		expect(mocks.channels).toHaveLength(1);
		streamEvent('_connected_', 'connected');
		expect(mocks.send).toHaveBeenCalledWith('sync', {});
		streamEvent('_disconnected_', 'reconnecting');
		mocks.send.mockClear();
		await vi.advanceTimersByTimeAsync(30000);
		expect(mocks.channels).toHaveLength(1);
		expect(mocks.send).not.toHaveBeenCalled();
		streamEvent('_connected_', 'connected');
		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.channels).toHaveLength(1);
	});
	it('handles animation cancellation rejections', async () => {
		const catches: Array<() => number> = [];
		const cancels: Array<ReturnType<typeof vi.fn>> = [];
		Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => {
			let rejectFinished!: (reason: unknown) => void;
			const finished = new Promise<void>((_, reject) => { rejectFinished = reject; });
			const catchFinished = vi.spyOn(finished, 'catch'); catches.push(() => catchFinished.mock.calls.length);
			const cancel = vi.fn(() => rejectFinished(new DOMException('Cancelled', 'AbortError'))); cancels.push(cancel);
			return { finished, cancel, onfinish: null } as unknown as Animation;
		}) });
		const { props } = mount(); mocks.receive?.(initial); await flushFrame();
		vi.setSystemTime(13200); await flushFrame();
		props.active = false; await nextTick();
		await Promise.resolve();
		expect(catches.length).toBeGreaterThan(0);
		expect(catches.every(count => count() > 0)).toBe(true);
		expect(cancels.some(spy => spy.mock.calls.length > 0)).toBe(true);
	});
});
