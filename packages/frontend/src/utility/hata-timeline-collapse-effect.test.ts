/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	createHataTimelineCollapseEffect,
	HATA_TIMELINE_COLLAPSE_DURATION_MS,
} from './hata-timeline-collapse-effect.js';

function rect(top: number, left = 0, width = 200, height = 60): DOMRect {
	return {
		x: left,
		y: top,
		top,
		left,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON: () => ({}),
	};
}

function setRect(element: HTMLElement, value: DOMRect) {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(value);
}

function setAnimation(element: HTMLElement, order: HTMLElement[] = []) {
	const cancel = vi.fn();
	const animate = vi.fn((frames: Keyframe[], _options: KeyframeAnimationOptions) => {
		order.push(element);
		return { cancel } as unknown as Animation;
	});
	Object.defineProperty(element, 'animate', { configurable: true, value: animate });
	return { animate, cancel };
}

function setReducedMotion(initial: boolean) {
	let matches = initial;
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	const media = {
		get matches() { return matches; },
		media: '(prefers-reduced-motion: reduce)',
		onchange: null,
		addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
			listeners.add(listener as (event: MediaQueryListEvent) => void);
		},
		removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
			listeners.delete(listener as (event: MediaQueryListEvent) => void);
		},
	} as unknown as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockReturnValue(media);
	return {
		emit(value: boolean) {
			matches = value;
			const event = { matches: value, media: media.media } as MediaQueryListEvent;
			for (const listener of listeners) listener(event);
		},
		listenerCount: () => listeners.size,
	};
}

function makeRoot() {
	const root = window.document.createElement('div');
	window.document.body.append(root);
	return root;
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	window.document.body.replaceChildren();
});

describe('Hataskey UIのタイムライン崩壊演出', () => {
	test('表示要素を上から順に落とし、実行中の再発火を無視して10秒後に復元する', async () => {
		vi.useFakeTimers();
		setReducedMotion(false);
		const order: HTMLElement[] = [];
		const root = makeRoot();
		const group = window.document.createElement('div');
		group.setAttribute('data-hata-collapse-group', '');
		const top = window.document.createElement('input');
		top.value = '投稿中の本文';
		top.style.transform = 'scale(1.01)';
		const bottom = window.document.createElement('button');
		group.append(top, bottom);
		const timeline = window.document.createElement('div');
		timeline.setAttribute('data-hata-collapse-items', '');
		const middle = window.document.createElement('article');
		middle.setAttribute('data-scroll-anchor', '');
		timeline.append(middle);
		root.append(group, timeline);

		setRect(top, rect(20));
		setRect(middle, rect(300));
		setRect(bottom, rect(650));
		const topAnimation = setAnimation(top, order);
		const middleAnimation = setAnimation(middle, order);
		const bottomAnimation = setAnimation(bottom, order);
		const effect = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });

		expect(effect.play()).toBe(true);
		expect(effect.play()).toBe(false);
		expect(effect.isRunning()).toBe(true);
		expect(root.getAttribute('data-hata-timeline-collapse-active')).toBe('true');
		expect(order).toEqual([top, middle, bottom]);

		const topFrames = topAnimation.animate.mock.calls[0][0];
		const bottomFrames = bottomAnimation.animate.mock.calls[0][0];
		expect(Number(topFrames[1].offset)).toBeLessThan(Number(bottomFrames[1].offset));
		expect(topAnimation.animate.mock.calls[0][1]).toMatchObject({ duration: HATA_TIMELINE_COLLAPSE_DURATION_MS, fill: 'none' });
		expect(top.value).toBe('投稿中の本文');
		expect(top.style.transform).toBe('scale(1.01)');

		await vi.advanceTimersByTimeAsync(HATA_TIMELINE_COLLAPSE_DURATION_MS);
		expect(topAnimation.cancel).toHaveBeenCalledTimes(1);
		expect(middleAnimation.cancel).toHaveBeenCalledTimes(1);
		expect(bottomAnimation.cancel).toHaveBeenCalledTimes(1);
		expect(effect.isRunning()).toBe(false);
		expect(root.hasAttribute('data-hata-timeline-collapse-active')).toBe(false);
		effect.destroy();
	});

	test('アニメーションOFFとreduced motionでは開始しない', () => {
		const motion = setReducedMotion(true);
		const root = makeRoot();
		const part = window.document.createElement('div');
		part.setAttribute('data-hata-collapse-part', '');
		root.append(part);
		setRect(part, rect(20));
		const animation = setAnimation(part);

		const reduced = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });
		expect(reduced.play()).toBe(false);
		reduced.destroy();

		motion.emit(false);
		const disabled = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => false });
		expect(disabled.play()).toBe(false);
		expect(animation.animate).not.toHaveBeenCalled();
		disabled.destroy();
	});

	test('画面外の要素を測定対象から除外する', () => {
		setReducedMotion(false);
		const root = makeRoot();
		const visible = window.document.createElement('div');
		visible.setAttribute('data-hata-collapse-part', '');
		const offscreen = window.document.createElement('div');
		offscreen.setAttribute('data-hata-collapse-part', '');
		root.append(visible, offscreen);
		setRect(visible, rect(100));
		setRect(offscreen, rect(window.innerHeight + 50));
		const visibleAnimation = setAnimation(visible);
		const offscreenAnimation = setAnimation(offscreen);
		const effect = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });

		expect(effect.play()).toBe(true);
		expect(visibleAnimation.animate).toHaveBeenCalledTimes(1);
		expect(offscreenAnimation.animate).not.toHaveBeenCalled();
		effect.destroy();
	});

	test('画像付きノートとデッキは内側のanchorでなく外側の構造を1単位で落とす', () => {
		setReducedMotion(false);
		const root = makeRoot();
		const timeline = window.document.createElement('div');
		timeline.setAttribute('data-hata-collapse-items', '');
		const note = window.document.createElement('article');
		note.setAttribute('data-scroll-anchor', '');
		const media = window.document.createElement('div');
		media.setAttribute('data-scroll-anchor', '');
		note.append(media);
		const frame = window.document.createElement('section');
		frame.setAttribute('data-deck-frame', '');
		const framedNote = window.document.createElement('article');
		framedNote.setAttribute('data-scroll-anchor', '');
		frame.append(framedNote);
		timeline.append(note, frame);
		root.append(timeline);
		setRect(note, rect(80));
		setRect(media, rect(110));
		setRect(frame, rect(320));
		setRect(framedNote, rect(350));
		const noteAnimation = setAnimation(note);
		const mediaAnimation = setAnimation(media);
		const frameAnimation = setAnimation(frame);
		const framedNoteAnimation = setAnimation(framedNote);
		const effect = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });

		expect(effect.play()).toBe(true);
		expect(noteAnimation.animate).toHaveBeenCalledTimes(1);
		expect(mediaAnimation.animate).not.toHaveBeenCalled();
		expect(frameAnimation.animate).toHaveBeenCalledTimes(1);
		expect(framedNoteAnimation.animate).not.toHaveBeenCalled();
		effect.destroy();
	});

	test('実行中にreduced motionへ変わると即時復元し、破棄時に監視も外す', () => {
		const motion = setReducedMotion(false);
		const root = makeRoot();
		const part = window.document.createElement('div');
		part.setAttribute('data-hata-collapse-part', '');
		root.append(part);
		setRect(part, rect(100));
		const animation = setAnimation(part);
		const effect = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });

		expect(motion.listenerCount()).toBe(1);
		expect(effect.play()).toBe(true);
		motion.emit(true);
		expect(animation.cancel).toHaveBeenCalledTimes(1);
		expect(effect.isRunning()).toBe(false);
		effect.destroy();
		expect(motion.listenerCount()).toBe(0);
	});

	test('UI Sの標準ノートとデッキ枠は可視の外側だけを動かし、隠れたドロワーを除外して復元する', async () => {
		vi.useFakeTimers();
		setReducedMotion(false);
		const root = makeRoot();
		const header = window.document.createElement('header');
		header.setAttribute('data-hata-collapse-part', '');
		const list = window.document.createElement('div');
		list.setAttribute('data-hata-collapse-items', '');
		const note = window.document.createElement('div');
		note.setAttribute('data-scroll-anchor', '');
		list.append(note);
		const deck = window.document.createElement('div');
		deck.setAttribute('data-hata-collapse-items', '');
		const frame = window.document.createElement('div');
		frame.setAttribute('data-deck-frame', 'frame-1');
		const framedNote = window.document.createElement('div');
		framedNote.setAttribute('data-scroll-anchor', '');
		frame.append(framedNote);
		deck.append(frame);
		const drawer = window.document.createElement('div');
		drawer.setAttribute('data-hata-collapse-part', '');
		drawer.style.display = 'none';
		root.append(header, list, deck, drawer);
		setRect(header, rect(10));
		setRect(note, rect(120));
		setRect(frame, rect(300));
		setRect(framedNote, rect(340));
		setRect(drawer, rect(0));
		const headerAnimation = setAnimation(header);
		const noteAnimation = setAnimation(note);
		const frameAnimation = setAnimation(frame);
		const framedNoteAnimation = setAnimation(framedNote);
		const drawerAnimation = setAnimation(drawer);
		const effect = createHataTimelineCollapseEffect({ root: () => root, animationEnabled: () => true });

		expect(effect.play()).toBe(true);
		expect(headerAnimation.animate).toHaveBeenCalledOnce();
		expect(noteAnimation.animate).toHaveBeenCalledOnce();
		expect(frameAnimation.animate).toHaveBeenCalledOnce();
		expect(framedNoteAnimation.animate).not.toHaveBeenCalled();
		expect(drawerAnimation.animate).not.toHaveBeenCalled();
		expect(effect.play()).toBe(false);
		await vi.advanceTimersByTimeAsync(HATA_TIMELINE_COLLAPSE_DURATION_MS);
		expect(headerAnimation.cancel).toHaveBeenCalledOnce();
		expect(noteAnimation.cancel).toHaveBeenCalledOnce();
		expect(frameAnimation.cancel).toHaveBeenCalledOnce();
		expect(root.hasAttribute('data-hata-timeline-collapse-active')).toBe(false);
		effect.destroy();
	});

	test('simple UIがbroadcastの購読解除と設定変更時の中止まで結線する', () => {
		const simple = fs.readFileSync(path.join(process.cwd(), 'src/ui/simple.vue'), 'utf8');
		const streamingTypes = fs.readFileSync(path.join(process.cwd(), '../cherrypick-js/src/streaming.types.ts'), 'utf8');

		expect(simple).toContain('ref="timelineCollapseRoot"');
		expect(simple).toContain('stream.on(\'hataTimelineCollapse\', onHataTimelineCollapse)');
		expect(simple).toContain('broadcastStream?.off(\'hataTimelineCollapse\', onHataTimelineCollapse)');
		expect(simple).toContain('watch(prefer.r.animation');
		expect(simple).toContain('timelineCollapseEffect.destroy()');
		expect(simple).toContain('if (streamUnmounted || mainCh) return');
		expect(simple).toContain('window.clearTimeout(streamRetryTimer)');
		expect(simple).toContain('data-hata-collapse-items');
		expect(simple).toContain('data-hata-collapse-group');
		expect(streamingTypes).toContain('hataTimelineCollapse: (payload: Record<string, never>) => void;');
	});
});
