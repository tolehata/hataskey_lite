/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseCss } from 'postcss';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';
import type { AtRule, Root, Rule } from 'postcss';

const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.css'), 'utf8');
const scope = '[data-hataskey-entrance]';
const fixtures: { controller: HataskeyWelcomeController; root: HTMLElement }[] = [];
const observers: TestIntersectionObserver[] = [];

class TestIntersectionObserver implements IntersectionObserver {
	readonly root = null;
	readonly rootMargin = '0px';
	readonly scrollMargin = '0px';
	readonly thresholds = [0, .18];
	observe = vi.fn<(target: Element) => void>();
	unobserve = vi.fn<(target: Element) => void>();
	disconnect = vi.fn();
	takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

	constructor(private readonly callback: IntersectionObserverCallback) {
		observers.push(this);
	}

	emit(isIntersecting: boolean, intersectionRatio: number): void {
		const target = this.observe.mock.calls[0]?.[0];
		assert.ok(target, 'feature observer must observe its window');
		this.callback([{ isIntersecting, intersectionRatio, target } as IntersectionObserverEntry], this);
	}
}

function fixture(reduced = false) {
	const root = window.document.createElement('div');
	root.dataset.hataskeyEntrance = '';
	root.innerHTML = `
		<section class="more-features" data-feature-phase="waiting" data-feature-visible="false">
			<div class="feature-window" tabindex="0">
				<div class="feature-track"><article class="feature-item"></article><article class="feature-item"></article></div>
			</div>
		</section>`;
	window.document.body.append(root);
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	controller.deckMotionQuery = { matches: reduced } as MediaQueryList;
	controller.setupFeatureEntrance();
	fixtures.push({ controller, root });
	const section = root.querySelector<HTMLElement>('.more-features');
	assert.ok(section);
	const observer = observers[observers.length - 1];
	if (!reduced) assert.ok(observer, 'ordinary motion must use the feature observer');
	return { controller, root, section, observer };
}

function symbolFixture(reduced = false) {
	const root = window.document.createElement('div');
	root.dataset.hataskeyEntrance = '';
	root.innerHTML = '<h3 data-symbol-heading><span class="symbol-swap symbol-mail"><span data-symbol-last>メール</span></span></h3>';
	window.document.body.append(root);
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	controller.deckMotionQuery = { matches: reduced } as MediaQueryList;
	const play = vi.spyOn(controller, 'playSymbolHeading');
	controller.setupSymbolHeadings();
	fixtures.push({ controller, root });
	const heading = root.querySelector<HTMLElement>('[data-symbol-heading]');
	assert.ok(heading);
	const observer = observers[observers.length - 1];
	if (!reduced) assert.ok(observer, 'ordinary motion must observe the mail heading');
	return { controller, root, heading, observer, play };
}

function scrollFixture() {
	const root = window.document.createElement('div');
	const scroller = window.document.createElement('div');
	root.append(scroller);
	window.document.body.append(root);
	Object.defineProperties(root, {
		clientHeight: { configurable: true, value: 200 },
		scrollHeight: { configurable: true, value: 500 },
		scrollTop: { configurable: true, value: 50, writable: true },
	});
	Object.defineProperties(scroller, {
		clientHeight: { configurable: true, value: 100 },
		scrollHeight: { configurable: true, value: 200 },
		scrollTop: { configurable: true, value: 0, writable: true },
	});
	const scrollBy = vi.fn();
	Object.defineProperty(root, 'scrollBy', { configurable: true, value: scrollBy });
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	controller.tlRef(scroller);
	controller.setupUiScrollHandoff();
	fixtures.push({ controller, root });
	return { controller, root, scroller, scrollBy };
}

function wheel(deltaY: number): WheelEvent {
	return new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY });
}

function completeGather(root: HTMLElement): void {
	for (const item of root.querySelectorAll('.feature-item')) {
		const event = new Event('animationend', { bubbles: true });
		Object.defineProperty(event, 'animationName', { value: 'hWelcome-featureGather' });
		item.dispatchEvent(event);
	}
}

function declarations(styleRule: Rule): Record<string, { value: string; important: boolean }> {
	return Object.fromEntries(styleRule.nodes
		.filter(node => node.type === 'decl')
		.map(node => [node.prop, { value: node.value, important: node.important }]));
}

function findRule(styles: Root, selector: string, media?: string): Rule {
	const matches: Rule[] = [];
	styles.walkRules(item => {
		if (!item.selectors.includes(selector)) return;
		const parent = item.parent;
		if (media ? parent?.type === 'atrule' && (parent as AtRule).name === 'media' && (parent as AtRule).params === media : parent?.type === 'root') matches.push(item);
	});
	assert.equal(matches.length, 1, `expected one ${selector} rule`);
	return matches[0];
}

function assertContinuousFeatureFlow(stylesSource: string): void {
	const styles = parseCss(stylesSource);
	const loop = declarations(findRule(styles, `${scope} .more-features[data-feature-phase="loop"] .feature-track`));
	assert.equal(loop['animation-play-state'].value, 'running');
	const focused = declarations(findRule(styles, `${scope} .more-features[data-feature-phase="loop"] .feature-window:focus-visible .feature-track`));
	assert.equal(focused['animation-play-state'].value, 'paused');
	const visibilityStops: string[] = [];
	styles.walkRules(item => {
		if (item.selector.includes('data-feature-visible') && item.selector.includes('.feature-track')) visibilityStops.push(item.selector);
	});
	assert.deepEqual(visibilityStops, [], 'viewport visibility must not pause the feature loop');
	const reduced = declarations(findRule(styles, `${scope} .feature-track`, '(prefers-reduced-motion:reduce)'));
	assert.deepEqual(reduced.animation, { value: 'none', important: true });
}

beforeEach(() => {
	vi.useFakeTimers();
	observers.length = 0;
	vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
});

afterEach(() => {
	for (const { controller, root } of fixtures.splice(0)) {
		controller.destroy();
		root.remove();
	}
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('MORE HATASKEYの一度きりの登場と横流れ', () => {
	test('集合後は3秒を超えて静止し、画面外へ戻っても横流れまで進む', () => {
		const { root, section, observer } = fixture();
		observer.emit(true, .2);
		vi.advanceTimersByTime(460);
		expect(section.dataset.featurePhase).toBe('gathering');
		completeGather(root);
		expect(section.dataset.featurePhase).toBe('holding');
		observer.emit(false, 0);
		expect(section.dataset.featurePhase).toBe('holding');
		vi.advanceTimersByTime(3599);
		expect(section.dataset.featurePhase).toBe('holding');
		vi.advanceTimersByTime(1);
		expect(section.dataset.featurePhase).toBe('loop');
	});

	test('横流れ開始後はviewportを出入りしても集合へ巻き戻らない', () => {
		const { root, section, observer, controller } = fixture();
		observer.emit(true, .2);
		vi.advanceTimersByTime(460);
		completeGather(root);
		vi.advanceTimersByTime(3600);
		expect(section.dataset.featurePhase).toBe('loop');
		expect(controller.timeouts.size).toBe(0);
		observer.emit(false, 0);
		observer.emit(true, .2);
		expect(section.dataset.featurePhase).toBe('loop');
		expect(controller.timeouts.size).toBe(0);
	});

	test('reduced-motionでは集合を待たず、横流れ自体はCSSで停止する', () => {
		const { section, controller } = fixture(true);
		expect(section.dataset.featurePhase).toBe('loop');
		expect(controller.timeouts.size).toBe(0);
		assertContinuousFeatureFlow(css);
	});

	test.each([
		['viewport停止条件の復活', `${css}\n${scope} .more-features[data-feature-visible="false"] .feature-track{animation-play-state:paused}`],
		['常時停止への逆戻り', css.replace('animation-play-state:running', 'animation-play-state:paused')],
	])('陽性対照: %sを検出する', (_name, changed) => {
		expect(changed).not.toBe(css);
		expect(() => assertContinuousFeatureFlow(changed)).toThrow();
	});
});

describe('記号見出しの一度きりの再生', () => {
	test('メール見出しは再進入しても二度目を再生しない', () => {
		const { heading, observer, play } = symbolFixture();
		expect(heading.dataset.symbolState).toBe('ready');
		observer.emit(true, .34);
		vi.advanceTimersByTime(540);
		expect(heading.dataset.symbolState).toBe('playing');
		observer.emit(false, 0);
		vi.advanceTimersByTime(4600);
		expect(heading.dataset.symbolState).toBe('done');
		observer.emit(true, .34);
		vi.advanceTimersByTime(1000);
		expect(heading.dataset.symbolState).toBe('done');
		expect(play).toHaveBeenCalledOnce();
	});

	test('再生待ちの間に離れた見出しだけは、再進入時に初回再生できる', () => {
		const { heading, observer, play } = symbolFixture();
		observer.emit(true, .34);
		vi.advanceTimersByTime(300);
		observer.emit(false, 0);
		vi.advanceTimersByTime(1000);
		expect(heading.dataset.symbolState).toBe('ready');
		expect(play).not.toHaveBeenCalled();
		observer.emit(true, .34);
		vi.advanceTimersByTime(540);
		expect(heading.dataset.symbolState).toBe('playing');
		expect(play).toHaveBeenCalledOnce();
	});

	test('reduced-motionでは初めから完了状態にする', () => {
		const { heading, play } = symbolFixture(true);
		expect(heading.dataset.symbolState).toBe('done');
		expect(play).not.toHaveBeenCalled();
	});
});

describe('PCモック内部スクロールのページ引き渡し', () => {
	test('内部で収まるwheelは妨げず、下端と上端では残差だけをページへ渡す', () => {
		const { scroller, scrollBy } = scrollFixture();
		scroller.scrollTop = 20;
		const inside = wheel(50);
		scroller.dispatchEvent(inside);
		expect(inside.defaultPrevented).toBe(false);
		expect(scrollBy).not.toHaveBeenCalled();

		scroller.scrollTop = 80;
		const down = wheel(50);
		scroller.dispatchEvent(down);
		expect(down.defaultPrevented).toBe(true);
		expect(scroller.scrollTop).toBe(100);
		expect(scrollBy).toHaveBeenLastCalledWith({ top: 30, left: 0, behavior: 'instant' });

		scroller.scrollTop = 20;
		const up = wheel(-50);
		scroller.dispatchEvent(up);
		expect(up.defaultPrevented).toBe(true);
		expect(scroller.scrollTop).toBe(0);
		expect(scrollBy).toHaveBeenLastCalledWith({ top: -30, left: 0, behavior: 'instant' });
	});

	test('teardown後はwheelを引き渡さない', () => {
		const { controller, scroller, scrollBy } = scrollFixture();
		controller.teardownUiScrollHandoff();
		scroller.scrollTop = 100;
		const event = wheel(50);
		scroller.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(scrollBy).not.toHaveBeenCalled();
	});
});
