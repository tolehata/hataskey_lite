/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, KeepAlive, nextTick, ref, shallowRef } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataskFlowerStream from './HataskFlowerStream.vue';
import type { HataskFlowerView } from './hatask-flower-view.js';

vi.mock('@/components/HataskEmoji.vue', () => ({ default: {
	props: ['emoji'],
	render(this: { emoji: string }) { return h('img', { 'data-emoji': this.emoji, alt: '' }); },
} }));
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: {
	props: ['user', 'forceShowDecoration', 'link', 'preview'],
	render(this: { user: { id: string }; forceShowDecoration: boolean; link: boolean; preview: boolean }) {
		return h('span', { 'data-avatar': this.user.id, 'data-decoration': this.forceShowDecoration, 'data-link': this.link, 'data-preview': this.preview });
	},
} }));
vi.mock('@/components/global/MkUserName.vue', () => ({ default: {
	props: ['user', 'enableEmojiMenu'],
	render(this: { user: { name: string } }) { return h('span', { 'data-owner-name': true }, this.user.name); },
} }));

const sample: HataskFlowerView[] = Array.from({ length: 12 }, (_, index) => ({
	id: `flower-${index}`,
	emoji: '🌼',
	name: `お花${index}`,
	harvestedAt: '2026-09-08T12:00:00.000Z',
	dateLabel: '2026/9/8',
	rare: index === 4,
	isOwner: false,
	user: { id: `user-${index}`, name: `育てた人${index}`, username: `user${index}`, host: null, avatarUrl: '/avatar.webp', avatarBlurhash: null, avatarDecorations: [{ id: 'decoration', url: '/decoration.webp' }] } as HataskFlowerView['user'],
}));

type StreamProps = {
	items: readonly HataskFlowerView[];
	activity: boolean;
	showOwnerName: boolean;
	animations: boolean;
	paused: boolean;
	label: string;
	rareLabel: string;
	harvestedLabel: string;
};
const cleanups: (() => void)[] = [];

function requiredElement<T extends HTMLElement>(value: T | null | undefined): T {
	if (!value) throw new Error('Expected the stream element to be mounted');
	return value;
}

// happy-dom has no layout engine. Explicit widths and clocks verify the scroll
// controller; native momentum, CSS geometry and rendered avatars need browser QA.
async function mountStream(options: Partial<StreamProps> = {}, initialWidth = 600, initiallyReduced = false, ancestorScale = 1, roundScroll: (position: number) => number = position => position) {
	let width = initialWidth;
	let now = 0;
	let nextId = 1;
	let hidden = false;
	const frames = new Map<number, FrameRequestCallback>();
	const timers = new Map<number, { callback: () => void; at: number }>();
	const positions = new WeakMap<HTMLElement, number>();
	const pendingScroll = new Set<HTMLElement>();
	const observers: { active: boolean; callback: () => void }[] = [];
	const media = new EventTarget() as EventTarget & { matches: boolean };
	media.matches = initiallyReduced;
	vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
	vi.spyOn(window.performance, 'now').mockImplementation(() => now);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { const id = nextId++; frames.set(id, callback); return id; });
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
	vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay = 0) => {
		const id = nextId++;
		timers.set(id, { callback: () => { if (typeof callback === 'function') callback(); }, at: now + delay });
		return id as unknown as ReturnType<typeof window.setTimeout>;
	});
	vi.spyOn(window, 'clearTimeout').mockImplementation(id => { timers.delete(Number(id)); });
	vi.stubGlobal('ResizeObserver', class {
		active = false;
		constructor(public callback: () => void) { observers.push(this); }
		observe() { this.active = true; }
		disconnect() { this.active = false; }
	});
	const step = (element: HTMLElement) => element.closest<HTMLElement>('[data-hatask-flower-stream]')?.dataset.activity === 'true' ? 260 : width < 520 ? 114 : 130;
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.hasAttribute('data-hatask-flower-stream') || this.hasAttribute('data-row') ? width : 0;
	});
	vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.hasAttribute('data-row') ? (this.firstElementChild?.children.length ?? 0) * step(this) + 12 : 0;
	});
	vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
		return this.hasAttribute('data-flower-id') && this.parentElement ? [...this.parentElement.children].indexOf(this) * step(this) : 0;
	});
	const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollLeft');
	Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
		configurable: true,
		get(this: HTMLElement) { return positions.get(this) ?? 0; },
		set(this: HTMLElement, value: number) {
			const next = Math.max(0, Math.min(roundScroll(value), Math.max(0, this.scrollWidth - this.clientWidth)));
			if (next !== this.scrollLeft) { positions.set(this, next); pendingScroll.add(this); }
		},
	});
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (this.hasAttribute('data-flower-id') && this.parentElement?.parentElement) {
			const index = [...this.parentElement.children].indexOf(this);
			const translation = this.parentElement.style.transform.match(/^translate3d\(([-\d.e]+)px,/);
			const translateX = translation ? Number(translation[1]) : 0;
			return new DOMRect((index * step(this) + 12 + translateX - this.parentElement.parentElement.scrollLeft) * ancestorScale, 0, (step(this) - 12) * ancestorScale, 140 * ancestorScale);
		}
		return new DOMRect(0, 0, width, 160);
	});
	const props = shallowRef<StreamProps>({ items: sample, activity: false, showOwnerName: true, animations: true, paused: false, label: 'みんなの花壇', rareLabel: 'レア花', harvestedLabel: '収穫', ...options });
	const show = ref(true);
	const instance = ref<{ getAnchor(id: string): HTMLElement | null } | null>(null);
	const select = vi.fn();
	const app = createApp(defineComponent({
		setup() { return () => h(KeepAlive, null, { default: () => show.value ? h(HataskFlowerStream, { ...props.value, ref: instance, onSelect: select }) : null }); },
	}));
	const container = window.document.createElement('div');
	const outside = window.document.createElement('button');
	window.document.body.append(container, outside);
	app.mount(container);
	let closed = false;
	const unmount = () => { if (closed) return; closed = true; app.unmount(); container.remove(); outside.remove(); };
	cleanups.push(() => {
		unmount();
		if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollLeft', scrollDescriptor);
		else Reflect.deleteProperty(HTMLElement.prototype, 'scrollLeft');
	});
	const root = () => requiredElement(container.querySelector<HTMLElement>('[data-hatask-flower-stream]'));
	const lane = (index = 0) => requiredElement(root().querySelector<HTMLElement>(`[data-row="${index}"]`));
	const originals = () => [...root().querySelectorAll<HTMLButtonElement>('[data-copy="0"]')];
	const flushScroll = () => {
		let guard = 0;
		while (pendingScroll.size) {
			expect(guard++).toBeLessThan(12);
			const changed = [...pendingScroll]; pendingScroll.clear();
			for (const element of changed) element.dispatchEvent(new Event('scroll'));
		}
	};
	const settle = async () => { for (let index = 0; index < 5; index++) await nextTick(); flushScroll(); await nextTick(); };
	const advance = async (milliseconds: number) => {
		now += milliseconds;
		for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
		const ready = [...frames.values()]; frames.clear();
		for (const callback of ready) callback(now);
		await settle();
	};
	const resize = async (next: number) => { width = next; for (const observer of observers) if (observer.active) observer.callback(); await settle(); };
	const update = async (next: Partial<StreamProps>) => { props.value = { ...props.value, ...next }; await settle(); };
	const setReduced = async (value: boolean) => { media.matches = value; media.dispatchEvent(new Event('change')); await settle(); };
	const setHidden = async (value: boolean) => { hidden = value; window.document.dispatchEvent(new Event('visibilitychange')); await settle(); };
	const pointer = (element: HTMLElement, type: string, x: number, pointerType = 'mouse', pointerId = 1) => {
		const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType, button: 0, clientX: x, clientY: 50 });
		element.dispatchEvent(event); return event;
	};
	const click = (element: HTMLElement, detail = 1) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
	const cycle = (element: HTMLElement) => element.querySelectorAll('[data-copy="0"]').length * step(element);
	const leading = (element: HTMLElement) => {
		const length = cycle(element);
		const offset = ((element.scrollLeft - length) % length + length) % length;
		return element.querySelectorAll<HTMLElement>('[data-copy="0"]')[Math.floor(offset / step(element))].dataset.flowerId;
	};
	await settle();
	return { root, lane, originals, frames, timers, observers, select, instance, show, outside, advance, settle, resize, update, setReduced, setHidden, pointer, click, cycle, leading, flushScroll, unmount };
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('HataskFlowerStream', () => {
	test.each([
		{ fps: 60, rounding: '四捨五入', round: Math.round },
		{ fps: 120, rounding: '四捨五入', round: Math.round },
		{ fps: 60, rounding: '切り捨て', round: Math.floor },
		{ fps: 120, rounding: '切り捨て', round: Math.floor },
	])('$fps Hz・$roundingでも各フレームの表示位置が一定量ずつ進む', async ({ fps, round }) => {
		const f = await mountStream({}, 600, false, 1, round);
		const anchors = [0, 1].map(row => requiredElement(f.lane(row).querySelector<HTMLElement>('[data-copy="0"]')));
		await f.advance(0);
		// Vue Devtools can register its own timer when the first app mounts.
		const initialTimers = f.timers.size;
		for (let frame = 0; frame < fps; frame++) {
			const before = anchors.map(anchor => anchor.getBoundingClientRect().left);
			await f.advance(1000 / fps);
			for (const [row, anchor] of anchors.entries()) {
				expect(before[row] - anchor.getBoundingClientRect().left).toBeCloseTo(14 / fps, 5);
			}
		}
		expect(f.timers.size).toBe(initialTimers);
		expect(f.frames.size).toBe(1);
	});

	test('スマホの活動列も小数位置で停止・再開するときに表示位置を保つ', async () => {
		const f = await mountStream({ activity: true }, 360, false, 1, Math.floor);
		const anchor = f.originals()[0];
		await f.advance(0); await f.advance(16);
		for (const [stop, resume] of [
			[() => f.update({ paused: true }), () => f.update({ paused: false })],
			[() => f.update({ animations: false }), () => f.update({ animations: true })],
			[() => f.setReduced(true), () => f.setReduced(false)],
			[() => f.setHidden(true), () => f.setHidden(false)],
			[() => f.root().dispatchEvent(new MouseEvent('mouseenter')), () => f.root().dispatchEvent(new MouseEvent('mouseleave'))],
			[() => anchor.focus(), () => f.outside.focus()],
		]) {
			const before = anchor.getBoundingClientRect().left;
			await stop(); await f.settle(); await f.advance(1000);
			expect(anchor.getBoundingClientRect().left).toBeCloseTo(before, 5);
			await resume(); await f.settle(); await f.advance(0); await f.advance(16);
			expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(.224, 5);
		}
	});

	test('小数位置からのtouchスクロールと自動再開に段差が生じない', async () => {
		const f = await mountStream({}, 360, false, 1, Math.floor);
		const element = f.lane(), anchor = f.originals()[0];
		await f.advance(0); await f.advance(16);
		const before = anchor.getBoundingClientRect().left;
		f.pointer(element, 'pointerdown', 100, 'touch');
		element.scrollLeft += 25;
		f.flushScroll();
		expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(25, 5);
		f.pointer(element, 'pointerup', 75, 'touch');
		await f.advance(551);
		expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(25, 5);
		await f.advance(16);
		expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(25.224, 5);
	});

	test('小数位置からのmouseドラッグと自動再開に段差が生じない', async () => {
		const f = await mountStream({}, 600, false, 1, Math.round);
		const element = f.lane(), anchor = f.originals()[0];
		await f.advance(0); await f.advance(16);
		const before = anchor.getBoundingClientRect().left;
		f.pointer(element, 'pointerdown', 100);
		f.pointer(element, 'pointermove', 80);
		await f.settle();
		expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(20, 5);
		f.pointer(element, 'pointerup', 80);
		await f.advance(551); await f.advance(16);
		expect(before - anchor.getBoundingClientRect().left).toBeCloseTo(20.224, 5);
	});

	test('手動の逆方向折り返しと自動のループ境界でも小数位置を保つ', async () => {
		const f = await mountStream({}, 600, false, 1, Math.floor);
		const element = f.lane(), anchor = f.originals()[0], cycle = f.cycle(element);
		await f.advance(0); await f.advance(16);
		element.scrollLeft = cycle - 1;
		const beforeWrap = anchor.getBoundingClientRect().left;
		f.flushScroll();
		expect(beforeWrap - anchor.getBoundingClientRect().left).toBeCloseTo(cycle, 5);
		await f.advance(551);
		for (let frame = 0; frame < 10; frame++) {
			const before = anchor.getBoundingClientRect().left;
			await f.advance(1000 / 60);
			const distance = before - anchor.getBoundingClientRect().left;
			expect(distance - Math.round(distance / cycle) * cycle).toBeCloseTo(14 / 60, 5);
		}
	});

	test('拡大縮小中の再配置でも小数位置を保ち、1輪へ減ると補正をリセットする', async () => {
		const f = await mountStream({}, 600, false, .9, Math.floor);
		await f.advance(0); await f.advance(16);
		const before = f.originals()[0].getBoundingClientRect().left;
		await f.resize(600);
		expect(f.originals()[0].getBoundingClientRect().left).toBeCloseTo(before, 5);
		await f.resize(519);
		expect(f.originals()[0].getBoundingClientRect().left).toBeCloseTo((12 - .224 * 114 / 130) * .9, 5);
		await f.update({ items: [sample[0]] });
		expect(f.originals()[0].getBoundingClientRect().left).toBeCloseTo(12 * .9, 5);
		expect(f.frames.size).toBe(0);
	});

	test.each([60, 120])('%i Hz・整数pxに丸められる表示でも小数の移動量を蓄積して両段を流す', async fps => {
		const f = await mountStream({}, 600, false, 1, Math.round);
		const start = [f.lane().scrollLeft, f.lane(1).scrollLeft];
		await f.advance(0);
		for (let frame = 0; frame < fps; frame++) await f.advance(1000 / fps);
		for (let row = 0; row < 2; row++) expect(f.lane(row).scrollLeft - start[row]).toBeCloseTo(14, 0);
		expect(f.frames.size).toBe(1);
	});

	test('小数pxが切り捨てられる表示でも自動移動を手動スクロールと誤判定しない', async () => {
		const f = await mountStream({ activity: true }, 600, false, 1, Math.floor);
		const start = f.lane().scrollLeft;
		await f.advance(0);
		for (let frame = 0; frame < 120; frame++) await f.advance(1000 / 60);
		expect(f.lane().scrollLeft - start).toBeGreaterThanOrEqual(27);
		expect(f.lane().scrollLeft - start).toBeLessThanOrEqual(28);
		expect(f.timers.size).toBe(0);
		expect(f.frames.size).toBe(1);
	});

	test('整数pxの手動移動後は移動先から再開し、継ぎ目を越えて流れる', async () => {
		const f = await mountStream({}, 600, false, 1, Math.round);
		f.lane().scrollLeft = f.cycle(f.lane()) * 2 - 1;
		await f.settle();
		expect(f.frames.size).toBe(0);
		await f.advance(551);
		for (let frame = 0; frame < 60; frame++) await f.advance(1000 / 60);
		expect(f.lane().scrollLeft - f.cycle(f.lane())).toBeCloseTo(13, 0);
		expect(f.frames.size).toBe(1);
	});

	test('12輪を交互の2段へ配置し、既存アバター部品の装飾と安全なクリック設定を渡す', async () => {
		const f = await mountStream();
		expect(f.root().dataset.rows).toBe('2');
		expect(f.originals()).toHaveLength(12);
		expect([...f.lane().querySelectorAll<HTMLElement>('[data-copy="0"]')].map(button => button.dataset.flowerId)).toEqual(['flower-0', 'flower-2', 'flower-4', 'flower-6', 'flower-8', 'flower-10']);
		for (const avatar of f.root().querySelectorAll<HTMLElement>('[data-avatar]')) {
			expect(avatar.dataset.decoration).toBe('true');
			expect(avatar.dataset.link).toBe('false');
			expect(avatar.dataset.preview).toBe('false');
		}
		for (const button of f.root().querySelectorAll<HTMLButtonElement>('[data-copy]')) {
			expect(button.getAttribute('aria-haspopup')).toBe('dialog');
			expect(button.tabIndex).toBe(button.dataset.copy === '0' ? 0 : -1);
			expect(button.getAttribute('aria-hidden')).toBe(button.dataset.copy === '0' ? null : 'true');
		}
		expect(f.instance.value?.getAnchor('flower-4')?.getAttribute('aria-label')).toContain('レア花');
	});

	test('自分のギャラリーはアカウント名の表示と読み上げを省き、装飾アバターと花の情報を保つ', async () => {
		const f = await mountStream({ items: sample.map(flower => ({ ...flower, isOwner: true })), showOwnerName: false });
		for (const button of f.originals()) {
			const flower = sample.find(item => item.id === button.dataset.flowerId);
			expect(button.querySelector('[data-owner-name]')).toBeNull();
			expect(button.querySelector<HTMLElement>('[data-avatar]')?.dataset.decoration).toBe('true');
			expect(button.getAttribute('aria-label')).toContain(flower?.name);
			expect(button.getAttribute('aria-label')).toContain('収穫 2026/9/8');
			expect(button.getAttribute('aria-label')).not.toContain('育てた人');
		}
		await f.update({ showOwnerName: true });
		expect(f.originals()[0].querySelector('[data-owner-name]')?.textContent).toBe('育てた人0');
		expect(f.originals()[0].getAttribute('aria-label')).toContain('育てた人0');
	});

	test('520px境界で段数を切り替え、全品種とキーボードフォーカスを保つ', async () => {
		const f = await mountStream();
		f.instance.value?.getAnchor('flower-3')?.focus();
		await f.resize(519);
		expect(f.root().dataset.rows).toBe('1');
		expect(f.originals().map(button => button.dataset.flowerId)).toEqual(sample.map(flower => flower.id));
		expect((window.document.activeElement as HTMLElement).dataset.flowerId).toBe('flower-3');
		await f.resize(520);
		expect(f.root().dataset.rows).toBe('2');
		expect(f.originals()).toHaveLength(12);
		expect((window.document.activeElement as HTMLElement).dataset.flowerId).toBe('flower-3');
	});

	test('活動は120件でも幅に関係なく1段となり、所有者・収穫日・花を表示する', async () => {
		const records = Array.from({ length: 120 }, (_, index) => ({ ...sample[index % sample.length], id: `activity-${index}` }));
		const f = await mountStream({ activity: true, items: records });
		for (const width of [360, 520, 1800]) {
			await f.resize(width);
			expect(f.root().dataset.rows).toBe('1');
			expect(f.originals().map(button => button.dataset.flowerId)).toEqual(records.map(flower => flower.id));
		}
		const button = f.originals()[0];
		expect(button.querySelector('[data-avatar]')).not.toBeNull();
		expect(button.querySelector('[data-owner-name]')?.textContent).toBe('育てた人0');
		expect(button.querySelector('time')?.dateTime).toBe(sample[0].harvestedAt);
		expect(button.querySelector('[data-emoji]')).not.toBeNull();
		f.click(requiredElement(f.originals().at(-1)));
		expect(f.select.mock.calls[0][0].flower.id).toBe('activity-119');
	});

	test('経過時間に応じて14px/秒で右へスクロールし、長時間停止後の飛びを抑える', async () => {
		const f = await mountStream();
		const element = f.lane(), start = element.scrollLeft;
		await f.advance(16);
		for (let index = 0; index < 100; index++) await f.advance(16);
		expect(element.scrollLeft - start).toBeCloseTo(22.4, 5);
		const before = element.scrollLeft;
		await f.advance(10_000);
		expect(element.scrollLeft - before).toBeLessThanOrEqual(.896001);
		expect(f.frames.size).toBe(1);
	});

	test('ループ境界と手動の逆スクロールを連続位置へ正規化する', async () => {
		const f = await mountStream();
		const element = f.lane(), cycle = f.cycle(element);
		element.scrollLeft = cycle * 2 - .1; f.flushScroll();
		await f.advance(600); await f.advance(32);
		expect(element.scrollLeft).toBeCloseTo(cycle + .348, 3);
		element.scrollLeft = cycle - 15; f.flushScroll();
		expect(element.scrollLeft).toBeCloseTo(cycle * 2 - 15, 3);
		await f.resize(2400);
		expect(f.lane().scrollWidth - f.lane().clientWidth).toBeGreaterThanOrEqual(f.cycle(f.lane()) * 2);
	});

	test('親カードの拡大縮小アニメ中もレイアウト座標でループ距離を測る', async () => {
		const f = await mountStream({}, 600, false, .9);
		const element = f.lane(), cycle = f.cycle(element);
		expect(element.scrollLeft).toBe(cycle);
		expect(f.originals()[0].getBoundingClientRect().width).toBeCloseTo(118 * .9);
		element.scrollLeft = cycle * 2 - .1; f.flushScroll();
		await f.advance(600); await f.advance(32);
		expect(element.scrollLeft).toBeCloseTo(cycle + .348, 3);
	});

	test('動作設定・吹き出し停止・OS設定・非表示でrAFを解除し、手動スクロールは保つ', async () => {
		const f = await mountStream();
		for (const [stop, resume] of [
			[() => f.update({ animations: false }), () => f.update({ animations: true })],
			[() => f.update({ paused: true }), () => f.update({ paused: false })],
			[() => f.setReduced(true), () => f.setReduced(false)],
			[() => f.setHidden(true), () => f.setHidden(false)],
		]) {
			await stop();
			const position = f.lane().scrollLeft;
			expect(f.frames.size).toBe(0);
			await f.advance(1000); expect(f.lane().scrollLeft).toBe(position);
			f.lane().scrollLeft += 20; f.flushScroll();
			expect(f.lane().scrollLeft).toBe(position + 20);
			await f.advance(600); await resume(); expect(f.frames.size).toBe(1);
		}
	});

	test('hover・focus・wheel・pointer中だけ自動移動を止める', async () => {
		const f = await mountStream();
		f.root().dispatchEvent(new MouseEvent('mouseenter')); expect(f.frames.size).toBe(0);
		f.root().dispatchEvent(new MouseEvent('mouseleave')); expect(f.frames.size).toBe(1);
		f.originals()[0].focus(); expect(f.frames.size).toBe(0);
		f.outside.focus(); await f.settle(); expect(f.frames.size).toBe(1);
		f.lane().dispatchEvent(new WheelEvent('wheel')); expect(f.frames.size).toBe(0);
		await f.advance(600); expect(f.frames.size).toBe(1);
		f.pointer(f.lane(), 'pointerdown', 100); expect(f.frames.size).toBe(0);
		f.pointer(f.lane(), 'pointerup', 100); await f.advance(600); expect(f.frames.size).toBe(1);
	});

	test('8px未満はタップ、8px以上はドラッグとなり直後のクリックだけを抑止する', async () => {
		const f = await mountStream();
		const element = f.lane(), button = f.originals()[0], start = element.scrollLeft;
		f.pointer(element, 'pointerdown', 100);
		expect(f.pointer(element, 'pointermove', 107).defaultPrevented).toBe(false);
		expect(element.scrollLeft).toBe(start);
		f.pointer(element, 'pointerup', 107); f.click(button); expect(f.select).toHaveBeenCalledTimes(1);
		f.pointer(element, 'pointerdown', 100);
		expect(f.pointer(element, 'pointermove', 108).defaultPrevented).toBe(true);
		expect(element.scrollLeft).not.toBe(start);
		f.pointer(element, 'pointerup', 108); f.click(button); expect(f.select).toHaveBeenCalledTimes(1);
		f.click(button, 0); expect(f.select).toHaveBeenCalledTimes(2);
	});

	test('touch操作では縦方向ジェスチャーを妨げずブラウザのスクロールに任せる', async () => {
		const f = await mountStream();
		const element = f.lane(), start = element.scrollLeft;
		expect(f.pointer(element, 'pointerdown', 100, 'touch').defaultPrevented).toBe(false);
		expect(f.pointer(element, 'pointermove', 140, 'touch').defaultPrevented).toBe(false);
		expect(element.scrollLeft).toBe(start);
		f.pointer(element, 'pointerup', 140, 'touch');
	});

	test.each(['mouse', 'touch', 'pen'])('%sで花・アバター・名前をタップすると正本と複製から詳細選択を通知する', async pointerType => {
		const f = await mountStream({}, 360);
		for (const copy of ['0', '1']) {
			const button = requiredElement(f.root().querySelector<HTMLButtonElement>(`[data-copy="${copy}"][data-flower-id="flower-0"]`));
			for (const selector of ['[data-emoji]', '[data-avatar]', '[data-owner-name]']) {
				const target = requiredElement(button.querySelector<HTMLElement>(selector));
				f.select.mockClear();
				f.pointer(target, 'pointerdown', 100, pointerType);
				f.pointer(target, 'pointerup', 100, pointerType);
				f.click(target);
				expect(f.select).toHaveBeenCalledTimes(1);
				expect(f.select.mock.calls[0][0]).toMatchObject({ flower: sample[0], anchor: button, returnFocusTo: f.instance.value?.getAnchor('flower-0') });
			}
		}
	});

	test('複製選択はクリック位置と正本の復帰先を別々に返す', async () => {
		const f = await mountStream();
		const clone = requiredElement(f.root().querySelector<HTMLButtonElement>('[data-copy="1"]'));
		f.click(clone);
		const payload = f.select.mock.calls[0][0];
		expect(payload.flower.id).toBe(clone.dataset.flowerId);
		expect(payload.anchor).toBe(clone);
		expect(payload.returnFocusTo).toBe(f.instance.value?.getAnchor(payload.flower.id));
		expect(window.document.activeElement).toBe(payload.returnFocusTo);
	});

	test('リサイズで先頭の花を保ち、項目置換で残った花のフォーカスを復元する', async () => {
		const f = await mountStream();
		f.lane().scrollLeft = f.cycle(f.lane()) + 270; f.flushScroll();
		expect(f.leading(f.lane())).toBe('flower-4');
		await f.resize(519); expect(f.leading(f.lane())).toBe('flower-4');
		await f.resize(800); expect(f.leading(f.lane())).toBe('flower-4'); expect(f.leading(f.lane(1))).toBe('flower-5');
		f.instance.value?.getAnchor('flower-4')?.focus();
		const removed = requiredElement(f.instance.value?.getAnchor('flower-0'));
		await f.update({ items: sample.slice(2).map(flower => ({ ...flower, name: `更新${flower.name}` })) });
		expect((window.document.activeElement as HTMLElement).dataset.flowerId).toBe('flower-4');
		expect(f.originals()).toHaveLength(10);
		f.click(removed); expect(f.select).not.toHaveBeenCalled();
	});

	test('空と1輪は反復や自動移動を作らず、文字列をHTMLとして扱わない', async () => {
		const f = await mountStream({ items: [{ ...sample[0], name: '<img id="injected" src="x">', user: undefined, rare: true }] });
		expect(f.root().querySelectorAll('[data-flower-id]')).toHaveLength(1);
		expect(f.originals()[0].textContent).toContain('<img id="injected" src="x">');
		expect(f.root().querySelector('#injected')).toBeNull();
		expect(f.frames.size).toBe(0);
		expect(f.root().dataset.motion).toBe('true');
		await f.update({ animations: false });
		expect(f.root().dataset.motion).toBe('false');
		await f.update({ items: [] });
		expect(f.root().querySelectorAll('[data-flower-id]')).toHaveLength(0);
		expect(f.frames.size).toBe(0);
	});

	test('KeepAlive退避とunmountで監視・rAF・タイマーを解放し、復帰時は一度だけ再開する', async () => {
		const f = await mountStream();
		f.lane().dispatchEvent(new WheelEvent('wheel'));
		f.show.value = false; await f.settle();
		expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0);
		expect(f.observers.some(observer => observer.active)).toBe(false);
		await f.setReduced(true); await f.setReduced(false); await f.advance(1000);
		expect(f.frames.size).toBe(0);
		f.show.value = true; await f.settle();
		expect(f.frames.size).toBe(1);
		expect(f.observers.filter(observer => observer.active)).toHaveLength(1);
		f.lane().dispatchEvent(new WheelEvent('wheel'));
		const resizing = f.resize(519);
		f.unmount(); await resizing;
		expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0);
		expect(f.observers.some(observer => observer.active)).toBe(false);
	});

	test('初回からOSの動き停止設定が有効なら自動移動を開始しない', async () => {
		const f = await mountStream({}, 600, true);
		expect(f.originals()).toHaveLength(12);
		expect(f.frames.size).toBe(0);
	});
});
