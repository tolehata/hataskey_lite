/* SPDX-License-Identifier: AGPL-3.0-only */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, shallowReactive, TransitionGroup } from 'vue';
import tinycolor from 'tinycolor2';
import apricotTheme from '@@/themes/l-apricot.json5';
import lightTheme from '@@/themes/l-light.json5';
import darkTheme from '@@/themes/d-dark.json5';
import type { App } from 'vue';
import type { LtlEmojiVoteChoice, LtlEmojiVoteEffect, LtlEmojiVotePhase, LtlEmojiVoteRound } from '@/utility/ltl-emoji-vote-types.js';
import MkLtlEmojiVote from '@/components/MkLtlEmojiVote.vue';
import { prefer } from '@/preferences.js';
import { globalEvents } from '@/events.js';

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));
vi.mock('@/components/global/MkCustomEmoji.vue', async () => {
	const { h: renderImage } = await import('vue');
	return { default: {
		props: { name: { type: String, default: '' }, url: { type: String, default: '' }, host: { type: String, default: null } },
		setup: (props: { name: string; url: string }) => () => renderImage('img', { src: props.url, alt: `:${props.name}:`, 'data-custom-emoji': props.name }),
	} };
});

type ViewProps = {
	round: LtlEmojiVoteRound;
	choice: LtlEmojiVoteChoice | null;
	now: number;
	phase: LtlEmojiVotePhase;
	active: boolean;
	submitting: boolean;
	voteError: string | null;
	canVote: boolean;
	navbar?: boolean;
	declined?: boolean;
	effectTarget: HTMLElement | null;
	claimEffect: (kind: LtlEmojiVoteEffect, roundId: string) => boolean;
};

const paneBounds = { left: 100, top: 100, right: 400, bottom: 740, width: 300, height: 640, x: 100, y: 100, toJSON: () => ({}) };
const winnerBounds = { left: 226, top: 276, right: 274, bottom: 324, width: 48, height: 48, x: 226, y: 276, toJSON: () => ({}) };
const frames = new Map<number, FrameRequestCallback>();
const resizeCallbacks: ResizeObserverCallback[] = [];
const intersectionSubscriptions: { callback: IntersectionObserverCallback; targets: Set<Element>; observer: IntersectionObserver }[] = [];
let initiallyIntersecting = true;
let frameId = 0;
let app: App | undefined;
let mediaChange: ((event: MediaQueryListEvent) => void) | undefined;
let canvasContext: ReturnType<typeof contextStub>;

function contextStub() {
	return {
		setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
		translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), fillRect: vi.fn(),
	};
}

function roundFixture(count = 5): LtlEmojiVoteRound {
	const candidates = Array.from({ length: count }, (_, index) => ({ id: `emoji-${index}`, name: `local_${index}`, url: `/emoji/local_${index}.webp`, isSensitive: false }));
	return {
		id: 'round-1', noteId: 'note-1', startedAt: 100000, closesAt: 115000, resolvedAt: 116800, expiresAt: 136800,
		candidates, choice: null, total: 0, rankings: [], phase: 'voting',
	};
}

function resultFixture(): LtlEmojiVoteRound {
	const round = roundFixture();
	return { ...round, phase: 'result', total: 14, rankings: round.candidates.map((emoji, index) => ({ emoji, rank: index + 1, tied: false, count: [5, 4, 3, 2, 0][index] })) };
}

async function flush() { await nextTick(); await nextTick(); await nextTick(); }

function requiredElement<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
	const element = parent.querySelector<T>(selector);
	if (!element) throw new Error(`Expected mounted element: ${selector}`);
	return element;
}

function drawFrame(timestamp: number) {
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback(timestamp);
}

function intersectionEntry(target: Element, intersecting: boolean): IntersectionObserverEntry {
	return {
		target, isIntersecting: intersecting, intersectionRatio: intersecting ? 1 : 0,
		intersectionRect: intersecting ? target.getBoundingClientRect() : { ...paneBounds, width: 0, height: 0 },
	} as IntersectionObserverEntry;
}

function deliverIntersection(target: Element, intersecting: boolean) {
	for (const subscription of intersectionSubscriptions) {
		if (subscription.targets.has(target)) subscription.callback([intersectionEntry(target, intersecting)], subscription.observer);
	}
}

function mountView(overrides: Partial<ViewProps> = {}) {
	const pane = window.document.createElement('div');
	const mountPoint = window.document.createElement('div');
	const target = window.document.createElement('div');
	target.dataset.effectTarget = 'true';
	Object.defineProperties(target, { clientWidth: { value: 300, configurable: true }, clientHeight: { value: 640, configurable: true } });
	pane.append(mountPoint, target);
	window.document.body.append(pane);
	const claimed = new Set<string>();
	const claimEffect = vi.fn((kind: LtlEmojiVoteEffect, roundId: string) => {
		const key = `${kind}:${roundId}`;
		if (claimed.has(key)) return false;
		claimed.add(key);
		return true;
	});
	const props = shallowReactive<ViewProps>({ round: roundFixture(), choice: null, now: 100000, phase: 'voting', active: true, submitting: false, voteError: null, canVote: true, effectTarget: target, claimEffect, ...overrides });
	const show = ref(true);
	const onVote = vi.fn(() => { props.submitting = true; });
	const onDismiss = vi.fn(() => { props.phase = props.phase === 'result' ? 'leaving' : 'declined'; });
	app = createApp(defineComponent({ setup: () => () => h(TransitionGroup, { tag: 'div', css: false }, { default: () => [
		h('article', { key: 'before', 'data-note': 'before' }, '前のノート'),
		...(show.value ? [h(MkLtlEmojiVote, { ...props, key: props.round.id, class: 'parent-row', onVote, onDismiss })] : []),
		h('article', { key: 'after', 'data-note': 'after' }, '次のノート'),
	] }) }));
	app.mount(mountPoint);
	const row = () => requiredElement<HTMLElement>(mountPoint, 'section');
	return { pane, mountPoint, target, props, row, show, onVote, onDismiss, claimEffect };
}

function stubThemeColors(colors: { fg: string; panel: string; bg: string }) {
	// Supply resolved theme variables without treating Happy DOM as a browser
	// color/layout engine. The component and its global event subscription stay real.
	const themeStyle = window.document.createElement('div').style;
	const setTheme = (next: typeof colors) => {
		for (const surface of ['fg', 'panel', 'bg'] as const) themeStyle.setProperty(`--MI_THEME-${surface}`, next[surface]);
	};
	setTheme(colors);
	const readProperty = vi.spyOn(themeStyle, 'getPropertyValue');
	const nativeGetComputedStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => element.matches('section[aria-label="LTLで絵文字投票"]')
		? themeStyle
		: nativeGetComputedStyle(element, pseudoElement));
	return { setTheme, readProperty };
}

beforeEach(() => {
	vi.useFakeTimers();
	prefer.r.animation.value = true;
	frames.clear();
	resizeCallbacks.length = 0;
	intersectionSubscriptions.length = 0;
	initiallyIntersecting = true;
	frameId = 0;
	mediaChange = undefined;
	canvasContext = contextStub();
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	vi.spyOn(performance, 'now').mockReturnValue(0);
	vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: false, media: '(prefers-reduced-motion: reduce)', addEventListener: (_type: string, handler: EventListener) => { mediaChange = handler as (event: MediaQueryListEvent) => void; }, removeEventListener: vi.fn() }) as unknown as MediaQueryList);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
	vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id); }));
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
		observe() { /* Initial notifications are triggered explicitly by regression tests. */ }
		disconnect() { /* No native observer exists in this mechanical fixture. */ }
	});
	vi.stubGlobal('IntersectionObserver', class {
		private subscription;
		constructor(callback: IntersectionObserverCallback) {
			this.subscription = { callback, targets: new Set<Element>(), observer: this as unknown as IntersectionObserver };
			intersectionSubscriptions.push(this.subscription);
		}
		observe(target: Element) {
			this.subscription.targets.add(target);
			this.subscription.callback([intersectionEntry(target, initiallyIntersecting)], this.subscription.observer);
		}
		unobserve(target: Element) { this.subscription.targets.delete(target); }
		disconnect() { this.subscription.targets.clear(); }
	});
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
	// Happy DOM has no layout. These rectangles exercise scope and origin logic,
	// and are deliberately not evidence of actual browser placement.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		return this.tagName === 'CANVAS' || this.dataset.effectTarget ? paneBounds : winnerBounds;
	});
});

afterEach(() => {
	app?.unmount();
	app = undefined;
	window.document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('LTL emoji vote view', () => {
	it.each([1, 2, 3, 4, 5])('renders %i local candidates in the shared order with accessible buttons', async count => {
		const view = mountView({ round: roundFixture(count) });
		await flush();
		const buttons = [...view.row().querySelectorAll<HTMLButtonElement>('[role="group"] button')];
		expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(view.props.round.candidates.map(emoji => `:${emoji.name}: に投票する`));
		expect(buttons.every(button => !button.disabled)).toBe(true);
		expect(view.row().querySelector('h2')?.textContent).toBe('どの絵文字にする？');
	});

	it('keeps one native section under TransitionGroup and forwards the parent class', async () => {
		const view = mountView();
		await flush();
		expect([...requiredElement(view.mountPoint, 'div').children].map(child => child.tagName)).toEqual(['ARTICLE', 'SECTION', 'ARTICLE']);
		expect(view.row().classList.contains('parent-row')).toBe(true);
		expect(view.row().querySelector('[role="status"]')).not.toBeNull();
		expect(view.target.querySelector('canvas')).not.toBeNull();
		expect(window.document.body.querySelectorAll('canvas')).toHaveLength(1);
	});

	it('emits the chosen ID, disables pending choices, then focuses the accepted-vote status', async () => {
		const view = mountView();
		const button = view.row().querySelectorAll<HTMLButtonElement>('[role="group"] button')[2];
		button.focus();
		button.click();
		await flush();
		button.click();
		expect(view.onVote).toHaveBeenCalledExactlyOnceWith('emoji-2');
		expect([...view.row().querySelectorAll<HTMLButtonElement>('[role="group"] button')].every(candidate => candidate.disabled)).toBe(true);
		view.props.choice = { emojiId: 'emoji-2', votedAt: 100000 };
		view.props.phase = 'waiting';
		view.props.submitting = false;
		await flush();
		expect(view.row().querySelector('button')).toBeNull();
		expect([...view.row().querySelectorAll('p')].map(paragraph => paragraph.textContent)).toContain('あなたの投票は受け付けました');
		expect(window.document.activeElement).toBe(view.row());
	});

	it('shows a retryable vote error without accepting a choice', async () => {
		const view = mountView({ voteError: '投票を送信できませんでした' });
		await flush();
		expect(view.row().querySelector('[role="alert"]')?.textContent).toBe('投票を送信できませんでした');
		requiredElement<HTMLButtonElement>(view.row(), '[role="group"] button').click();
		expect(view.onVote).toHaveBeenCalledExactlyOnceWith('emoji-0');
	});

	it('disables voting for anonymous viewers while showing the same candidates', async () => {
		const view = mountView({ canVote: false });
		await flush();
		expect(view.row().textContent).toContain('ログインして参加できます');
		const buttons = [...view.row().querySelectorAll<HTMLButtonElement>('[role="group"] button')];
		expect(buttons).toHaveLength(5);
		expect(buttons.every(button => button.disabled)).toBe(true);
		buttons[0].click();
		expect(view.onVote).not.toHaveBeenCalled();
	});

	it.each([
		['rain', 'この絵文字に決めた！'],
		['waiting', '他のユーザーの投票を待っています...'],
		['tallying', '集計しています...'],
	] as const)('renders the %s state without allowing another vote', async (phase, title) => {
		const view = mountView({ phase, choice: { emojiId: 'emoji-0', votedAt: 100000 } });
		await flush();
		expect(view.row().querySelector('h2')?.textContent).toBe(title);
		expect(view.row().querySelector('button')).toBeNull();
		if (phase === 'tallying') expect(view.row().querySelector('.ti-hourglass')).not.toBeNull();
	});

	it('renders every ranking through fifth, including zero votes, and keeps the clock icon on ticks', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result', now: 124800 });
		await flush();
		const rankings = [...view.row().querySelectorAll('li')];
		expect(rankings.map(row => row.dataset.rank)).toEqual(['1', '2', '3', '4', '5']);
		for (const [index, row] of rankings.entries()) {
			expect(row.textContent).toContain(`local_${index}`);
			expect(row.textContent).toContain(`${[5, 4, 3, 2, 0][index]}票`);
		}
		expect(view.row().querySelector('[aria-label="残り12秒"] .ti-clock')).not.toBeNull();
		view.props.now += 1000;
		await flush();
		expect(view.row().querySelector('[aria-label="残り11秒"] .ti-clock')).not.toBeNull();
	});

	it('keeps tied places and all-zero entries as supplied by the server', async () => {
		const round = resultFixture();
		round.rankings = round.rankings.map((entry, index) => ({ ...entry, count: index < 2 ? 5 : 0, rank: index < 2 ? 1 : 3, tied: true }));
		const view = mountView({ round, phase: 'result' });
		await flush();
		expect(view.row().querySelectorAll('[data-rank="1"]')).toHaveLength(2);
		expect(view.row().querySelector('li')?.textContent).toContain('同率1位');
		view.props.round = { ...round, total: 0, rankings: round.rankings.map(entry => ({ ...entry, rank: null, tied: false, count: 0 })) };
		await flush();
		expect(view.row().querySelectorAll('[data-rank="none"]')).toHaveLength(5);
		expect(view.row().querySelector('li')?.textContent).toContain('順位なし');
		expect(view.row().textContent).toContain('今回は投票がありませんでした');
	});

	it('marks results inert during collapse and removes only the round row afterwards', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		const before = view.mountPoint.querySelector('[data-note="before"]');
		const after = view.mountPoint.querySelector('[data-note="after"]');
		view.props.phase = 'leaving';
		await flush();
		expect(view.row().dataset.phase).toBe('leaving');
		expect(view.row().getAttribute('aria-hidden')).toBe('true');
		expect(view.row().hasAttribute('inert')).toBe(true);
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		view.show.value = false;
		await flush();
		expect(view.mountPoint.querySelector('section')).toBeNull();
		expect(view.target.childElementCount).toBe(0);
		expect(view.mountPoint.querySelector('[data-note="before"]')).toBe(before);
		expect(view.mountPoint.querySelector('[data-note="after"]')).toBe(after);
	});

	it('removes the selected emoji from waiting while retaining the rain image source', async () => {
		const view = mountView({ phase: 'rain', choice: { emojiId: 'emoji-2', votedAt: 100000 } });
		await flush();
		expect(view.row().querySelector('[data-custom-emoji="local_2"]')).not.toBeNull();
		expect(view.target.querySelectorAll('img').length).toBeGreaterThan(20);
		view.props.phase = 'waiting';
		await flush();
		expect(view.row().querySelector('[data-custom-emoji]')).toBeNull();
		expect(view.row().querySelector('.ti-check')).toBeNull();
		expect(view.row().querySelector('h2')?.textContent).toBe('他のユーザーの投票を待っています...');
	});

	it('declines through the labelled close button without submitting a vote or showing results', async () => {
		const view = mountView({ navbar: true });
		await flush();
		const button = requiredElement<HTMLButtonElement>(view.row(), '[aria-label="投票を辞退する"]');
		const choices = requiredElement(view.row(), '[data-vote-content="voting"]');
		button.focus();
		button.click();
		await flush();
		expect(view.onDismiss).toHaveBeenCalledTimes(1);
		expect(view.onVote).not.toHaveBeenCalled();
		expect(choices.hasAttribute('inert')).toBe(true);
		expect(choices.getAttribute('aria-hidden')).toBe('true');
		expect(view.row().querySelector('[role="status"]')?.textContent).toBe('辞退しました');
		// Exercise Vue's real CSS transition lifecycle; Happy DOM provides no visual geometry.
		for (let step = 0; step < 4; step++) {
			drawFrame(step * 16);
			vi.advanceTimersByTime(300);
			await flush();
		}
		expect(view.row().querySelector('h2')?.textContent).toBe('辞退しました');
		expect(view.row().querySelector('button')).toBeNull();
		expect(view.row().querySelector('[role="group"]')).toBeNull();
		view.props.phase = 'leaving';
		await flush();
		expect(view.row().querySelector('h2')?.textContent).toBe('辞退しました');
		expect(view.row().textContent).not.toContain('集計が完了しました');
		expect(view.row().hasAttribute('inert')).toBe(true);
	});

	it('retains the declined acknowledgement when mounting during its exit', async () => {
		const view = mountView({ phase: 'leaving', declined: true, navbar: true });
		await flush();
		expect(view.row().querySelector('h2')?.textContent).toBe('辞退しました');
		expect(view.row().querySelector('button')).toBeNull();
		expect(view.row().hasAttribute('inert')).toBe(true);
	});

	it.each([{ submitting: true }, { active: false }])('disables dismissal for unavailable controls: %j', async overrides => {
		const view = mountView(overrides);
		await flush();
		const button = requiredElement<HTMLButtonElement>(view.row(), '[data-emoji-vote-dismiss]');
		expect(button.disabled).toBe(true);
		button.click();
		expect(view.onDismiss).not.toHaveBeenCalled();
	});

	it('shows the decline acknowledgement with animation disabled', async () => {
		prefer.r.animation.value = false;
		const view = mountView();
		await flush();
		requiredElement<HTMLButtonElement>(view.row(), '[data-emoji-vote-dismiss]').click();
		await flush();
		expect(view.row().dataset.motion).toBe('false');
		expect(view.row().querySelector('h2')?.textContent).toBe('辞退しました');
		expect(view.onVote).not.toHaveBeenCalled();
	});
});

describe('LTL emoji vote theme text contrast', () => {
	it.each([lightTheme, darkTheme])('preserves the readable foreground in $name without local overrides', async theme => {
		stubThemeColors(theme.props);
		const view = mountView();
		await flush();
		for (const surface of ['panel', 'bg'] as const) {
			expect(tinycolor.readability(theme.props.fg, theme.props[surface])).toBeGreaterThanOrEqual(4.5);
			expect(view.row().style.getPropertyValue(`--ltl-emoji-vote-${surface}-fg`)).toBe('');
		}
	});

	it('raises both Apricot surfaces above 4.5 while keeping the correction local to the vote row', async () => {
		stubThemeColors(apricotTheme.props);
		const documentStyle = window.document.documentElement.style.cssText;
		const view = mountView();
		await flush();
		const corrected: string[] = [];
		for (const surface of ['panel', 'bg'] as const) {
			// The actual bundled theme is the positive control for low contrast.
			expect(tinycolor.readability(apricotTheme.props.fg, apricotTheme.props[surface])).toBeLessThan(4.5);
			const color = view.row().style.getPropertyValue(`--ltl-emoji-vote-${surface}-fg`);
			expect(tinycolor(color).isValid()).toBe(true);
			expect(tinycolor.readability(color, apricotTheme.props[surface])).toBeGreaterThanOrEqual(4.5);
			expect(tinycolor(color).getLuminance()).toBeLessThan(tinycolor(apricotTheme.props.fg).getLuminance());
			expect(tinycolor(color).toHexString()).not.toBe('#000000');
			corrected.push(color);
		}
		expect(new Set(corrected).size).toBe(2);
		expect(window.document.documentElement.style.cssText).toBe(documentStyle);
		expect(view.row().style.getPropertyValue('--MI_THEME-fg')).toBe('');
	});

	it('lightens low-contrast text against dark surfaces', async () => {
		const colors = { fg: '#555555', panel: '#222222', bg: '#111111' };
		stubThemeColors(colors);
		const view = mountView();
		await flush();
		for (const surface of ['panel', 'bg'] as const) {
			expect(tinycolor.readability(colors.fg, colors[surface])).toBeLessThan(4.5);
			const color = view.row().style.getPropertyValue(`--ltl-emoji-vote-${surface}-fg`);
			expect(tinycolor.readability(color, colors[surface])).toBeGreaterThanOrEqual(4.5);
			expect(tinycolor(color).getLuminance()).toBeGreaterThan(tinycolor(colors.fg).getLuminance());
			expect(tinycolor(color).toHexString()).not.toBe('#ffffff');
		}
	});

	it('corrects only the surface that needs more contrast', async () => {
		const colors = { fg: '#888888', panel: '#ffffff', bg: '#111111' };
		stubThemeColors(colors);
		const view = mountView();
		await flush();
		expect(tinycolor.readability(colors.fg, colors.panel)).toBeLessThan(4.5);
		expect(tinycolor.readability(colors.fg, colors.bg)).toBeGreaterThanOrEqual(4.5);
		const color = view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg');
		expect(tinycolor(color).isValid()).toBe(true);
		expect(tinycolor.readability(color, colors.panel)).toBeGreaterThanOrEqual(4.5);
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-bg-fg')).toBe('');
	});

	it('clears stale corrections on a readable theme change and restores them when Apricot returns', async () => {
		const theme = stubThemeColors(apricotTheme.props);
		const view = mountView();
		await flush();
		const corrected = view.row().style.cssText;
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).not.toBe('');
		theme.setTheme(lightTheme.props);
		globalEvents.emit('themeChanging');
		await flush();
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).toBe('');
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-bg-fg')).toBe('');
		theme.setTheme(apricotTheme.props);
		globalEvents.emit('themeChanging');
		await flush();
		expect(view.row().style.cssText).toBe(corrected);
	});

	it('releases its real theme listener on unmount and performs no later color reads', async () => {
		const theme = stubThemeColors(apricotTheme.props);
		const before = globalEvents.listenerCount('themeChanging');
		mountView();
		await flush();
		expect(globalEvents.listenerCount('themeChanging')).toBe(before + 1);
		theme.readProperty.mockClear();
		globalEvents.emit('themeChanging');
		expect(theme.readProperty).toHaveBeenCalledWith('--MI_THEME-fg');
		app?.unmount();
		app = undefined;
		expect(globalEvents.listenerCount('themeChanging')).toBe(before);
		theme.readProperty.mockClear();
		globalEvents.emit('themeChanging');
		await flush();
		expect(theme.readProperty).not.toHaveBeenCalled();
	});

	it('rechecks inherited theme colors when changing the navbar destination', async () => {
		const theme = stubThemeColors(apricotTheme.props);
		const view = mountView();
		await flush();
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).not.toBe('');
		const row = view.row();
		theme.setTheme(lightTheme.props);
		view.props.navbar = true;
		await flush();
		expect(view.row()).toBe(row);
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).toBe('');
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-bg-fg')).toBe('');
		theme.setTheme(apricotTheme.props);
		view.props.navbar = false;
		await flush();
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).not.toBe('');
	});

	it.each([
		['panel', 'transparent', 'bg'],
		['bg', 'rgba(230, 229, 226, 0.5)', 'panel'],
		['panel', 'not-a-color', 'bg'],
	] as const)('falls back for %s = %s while keeping the other surface correction', async (surface, background, other) => {
		const theme = stubThemeColors(apricotTheme.props);
		const view = mountView();
		await flush();
		expect(view.row().style.getPropertyValue(`--ltl-emoji-vote-${surface}-fg`)).not.toBe('');
		theme.setTheme({ ...apricotTheme.props, [surface]: background });
		globalEvents.emit('themeChanging');
		await flush();
		expect(view.row().style.getPropertyValue(`--ltl-emoji-vote-${surface}-fg`)).toBe('');
		const color = view.row().style.getPropertyValue(`--ltl-emoji-vote-${other}-fg`);
		expect(tinycolor(color).isValid()).toBe(true);
		expect(tinycolor.readability(color, apricotTheme.props[other])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(['', 'not-a-color'])('clears both corrections when the foreground is invalid: %j', async foreground => {
		const theme = stubThemeColors(apricotTheme.props);
		const view = mountView();
		await flush();
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).not.toBe('');
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-bg-fg')).not.toBe('');
		expect(tinycolor(foreground).isValid()).toBe(false);
		theme.setTheme({ ...apricotTheme.props, fg: foreground });
		globalEvents.emit('themeChanging');
		await flush();
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-panel-fg')).toBe('');
		expect(view.row().style.getPropertyValue('--ltl-emoji-vote-bg-fg')).toBe('');
	});
});

describe('LTL-scoped effects lifecycle', () => {
	it.each(['button', 'deadline'] as const)('fades existing confetti on %s exit without emitting another burst', async exit => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
		const canvas = requiredElement<HTMLCanvasElement>(view.target, 'canvas');
		const clears = canvasContext.clearRect.mock.calls.length;
		if (exit === 'button') {
			const button = requiredElement<HTMLButtonElement>(view.row(), '[aria-label="結果を閉じる"]');
			button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
			expect(canvasContext.clearRect).toHaveBeenCalledTimes(clears);
			button.click();
			expect(view.onDismiss).toHaveBeenCalledTimes(1);
		} else {
			view.props.now = view.props.round.expiresAt;
			view.props.phase = 'leaving';
		}
		await flush();
		expect(canvas.dataset.fading).toBe('true');
		expect(canvasContext.clearRect).toHaveBeenCalledTimes(clears);
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		expect(view.row().hasAttribute('inert')).toBe(true);
		drawFrame(160);
		// Only the original 320 pieces were drawn again; a fresh burst would add another 320.
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(640);
		expect(frames.size).toBe(1);
		vi.advanceTimersByTime(480);
		await flush();
		expect(frames.size).toBe(0);
		expect(canvasContext.clearRect.mock.calls.length).toBeGreaterThan(clears);
	});

	it('keeps all five navbar choices and accepts one vote without mounting a confetti canvas', async () => {
		const view = mountView({ navbar: true });
		await flush();
		expect(view.row().dataset.navbar).toBe('true');
		const buttons = [...view.row().querySelectorAll<HTMLButtonElement>('[role="group"] button')];
		expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(view.props.round.candidates.map(emoji => `:${emoji.name}: に投票する`));
		buttons[4].click();
		await flush();
		buttons[0].click();
		expect(view.onVote).toHaveBeenCalledExactlyOnceWith('emoji-4');
		expect(view.target.querySelector('canvas')).toBeNull();
	});

	it('shows every navbar ranking without claiming confetti, allowing a later inline result to celebrate', async () => {
		const view = mountView({ navbar: true, round: resultFixture(), phase: 'result' });
		await flush();
		expect([...view.row().querySelectorAll('li')].map(row => row.dataset.rank)).toEqual(['1', '2', '3', '4', '5']);
		expect(view.row().textContent).toContain('local_4');
		expect(view.row().textContent).toContain('0票');
		expect(view.target.querySelector('canvas')).toBeNull();
		expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
		expect(view.claimEffect).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
		view.props.navbar = false;
		await flush();
		expect(view.claimEffect).toHaveBeenCalledExactlyOnceWith('confetti', 'round-1');
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
	});

	it('stops running confetti when the same vote view moves into the navbar', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
		const row = view.row();
		view.props.navbar = true;
		await flush();
		expect(view.row()).toBe(row);
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		expect(view.target.querySelector('canvas')).toBeNull();
		expect(frames.size).toBe(0);
		drawFrame(450);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
		expect(canvasContext.clearRect).toHaveBeenCalled();
	});

	it('preserves the full LTL rain in navbar mode without creating confetti', async () => {
		const view = mountView({ navbar: true, phase: 'rain', choice: { emojiId: 'emoji-0', votedAt: 100000 } });
		await flush();
		expect(view.target.querySelectorAll('img').length).toBeGreaterThan(20);
		expect(view.claimEffect).toHaveBeenCalledExactlyOnceWith('rain', 'round-1');
		expect(view.target.querySelector('canvas')).toBeNull();
		vi.advanceTimersByTime(1550);
		await flush();
		expect(view.target.querySelectorAll('img')).toHaveLength(0);
		expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
	});

	it('does not consume an offscreen deck column effect until both its host and winning image intersect the viewport', async () => {
		initiallyIntersecting = false;
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		expect(view.claimEffect).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
		// The canvas may be visible while its winner is clipped by the LTL scroller.
		deliverIntersection(view.target, true);
		await flush();
		expect(view.claimEffect).not.toHaveBeenCalled();
		const winner = requiredElement(view.row(), '[data-winner="true"] img');
		deliverIntersection(winner, true);
		await flush();
		expect(view.claimEffect).toHaveBeenCalledExactlyOnceWith('confetti', 'round-1');
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
	});

	it('stops a celebration when its winning image is clipped and does not replay after scrolling back', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
		const winner = requiredElement(view.row(), '[data-winner="true"] img');
		deliverIntersection(winner, false);
		await flush();
		expect(frames.size).toBe(0);
		deliverIntersection(winner, true);
		await flush();
		drawFrame(150);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
	});

	it('plays a full rain after a delayed acknowledgement and ignores automatic layout/scroll notifications', async () => {
		const view = mountView({ phase: 'rain', now: 100800, choice: { emojiId: 'emoji-0', votedAt: 100000 } });
		await flush();
		const count = view.target.querySelectorAll('img').length;
		expect(count).toBeGreaterThan(20);
		expect(view.claimEffect).toHaveBeenCalledWith('rain', 'round-1');
		for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
		view.pane.dispatchEvent(new Event('scroll', { bubbles: true }));
		await flush();
		expect(view.target.querySelectorAll('img')).toHaveLength(count);
		vi.advanceTimersByTime(1160);
		await flush();
		expect(view.target.querySelector('[data-fading="true"]')).not.toBeNull();
		vi.advanceTimersByTime(389);
		await flush();
		expect(view.target.querySelectorAll('img')).toHaveLength(count);
		vi.advanceTimersByTime(1);
		await flush();
		expect(view.target.querySelectorAll('img')).toHaveLength(0);
	});

	it('clears rain on actual LTL input while unrelated deck input leaves it running', async () => {
		const view = mountView({ phase: 'rain', choice: { emojiId: 'emoji-0', votedAt: 100000 } });
		await flush();
		const otherColumn = window.document.createElement('div');
		window.document.body.append(otherColumn);
		otherColumn.dispatchEvent(new Event('wheel', { bubbles: true }));
		await flush();
		expect(view.target.querySelectorAll('img').length).toBeGreaterThan(20);
		view.pane.dispatchEvent(new Event('wheel', { bubbles: true }));
		await flush();
		expect(view.target.querySelectorAll('img')).toHaveLength(0);
	});

	it('starts result confetti once and cancels it when its LTL is hidden', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
		view.props.now += 1000;
		await flush();
		expect(view.claimEffect).toHaveBeenCalledExactlyOnceWith('confetti', 'round-1');
		view.props.active = false;
		await flush();
		expect(frames.size).toBe(0);
		expect(view.target.childElementCount).toBe(0);
		view.props.active = true;
		await flush();
		drawFrame(150);
		expect(canvasContext.fillRect).toHaveBeenCalledTimes(320);
	});

	it('preserves result content while reduced motion disables and cancels effects', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(frames.size).toBe(1);
		mediaChange?.({ matches: true } as MediaQueryListEvent);
		await flush();
		expect(view.row().dataset.motion).toBe('false');
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		expect(frames.size).toBe(0);
		expect(canvasContext.clearRect).toHaveBeenCalled();
	});

	it('honors the existing animation setting before the first effect', async () => {
		prefer.r.animation.value = false;
		const view = mountView({ phase: 'rain', choice: { emojiId: 'emoji-0', votedAt: 100000 } });
		await flush();
		expect(view.row().dataset.motion).toBe('false');
		expect(view.target.querySelectorAll('img')).toHaveLength(0);
		expect(view.claimEffect).not.toHaveBeenCalled();
		expect(view.row().textContent).toContain('あなたの投票は受け付けました');
	});

	it('cancels the pending frame and clears the local canvas on unmount', async () => {
		const view = mountView({ round: resultFixture(), phase: 'result' });
		await flush();
		drawFrame(0);
		expect(frames.size).toBe(1);
		app?.unmount();
		app = undefined;
		expect(frames.size).toBe(0);
		expect(canvasContext.clearRect).toHaveBeenCalled();
		expect(view.target.childElementCount).toBe(0);
	});

	it('never teleports to the page body when an LTL effect host is absent', async () => {
		const view = mountView({ effectTarget: null, round: resultFixture(), phase: 'result' });
		await flush();
		expect(view.row().querySelectorAll('li')).toHaveLength(5);
		expect(window.document.querySelector('canvas')).toBeNull();
		expect(view.claimEffect).not.toHaveBeenCalled();
	});
});
