/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';

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
		assert.ok(target, 'symbol observer must observe its heading');
		this.callback([{ isIntersecting, intersectionRatio, target } as IntersectionObserverEntry], this);
	}
}

function symbolFixture(reduced = false) {
	const root = window.document.createElement('div');
	root.dataset.hataskeyEntrance = '';
	root.innerHTML = '<h3 data-symbol-heading><span class="symbol-swap symbol-mail"><span data-symbol-last>メール</span></span></h3>';
	window.document.body.append(root);
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	controller.motionQuery = { matches: reduced } as MediaQueryList;
	const play = vi.spyOn(controller, 'playSymbolHeading');
	controller.setupSymbolHeadings();
	fixtures.push({ controller, root });
	const heading = root.querySelector<HTMLElement>('[data-symbol-heading]');
	assert.ok(heading);
	const observer = observers[observers.length - 1];
	if (!reduced) assert.ok(observer, 'ordinary motion must observe the mail heading');
	return { controller, root, heading, observer, play };
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
