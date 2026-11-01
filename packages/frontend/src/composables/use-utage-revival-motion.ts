/* SPDX-License-Identifier: AGPL-3.0-only */
import { watch } from 'vue';
import { isVisible } from './use-utage-failure-motion.js';
import type { Ref } from 'vue';
import './use-utage-revival-motion.css';
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 1680;
const ease = 'cubic-bezier(.22,.61,.36,1)';

function svgNode(tag: string, attributes: Record<string, string | number>) {
	const node = window.document.createElementNS(NS, tag);
	for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
	return node;
}

export function playUtageRevival(root: HTMLElement, article: HTMLElement, status: HTMLElement, { reduced = false } = {}) {
	if (reduced || window.document.hidden || !isVisible(root)) return () => {};
	const width = root.clientWidth, height = root.clientHeight;
	const style = getComputedStyle(root);
	const radius = (value: string) => Math.max(0, Math.min(parseFloat(value) || 0, width / 2, height / 2) - 1);
	const tl = radius(style.borderTopLeftRadius), tr = radius(style.borderTopRightRadius);
	const bl = radius(style.borderBottomLeftRadius), br = radius(style.borderBottomRightRadius);
	const x = 1, y = 1, right = width - 1, bottom = height - 1, cx = width / 2, cy = height / 2;
	const layer = window.document.createElement('div');
	layer.className = 'utage-revival-motion'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
	const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, width, height, fill: 'none' });
	layer.append(svg);
	const animations: Animation[] = [];
	let timer: number | undefined;
	let observer: ResizeObserver | undefined;
	let finished = false;
	const cancel = () => {
		if (finished) return;
		finished = true;
		window.clearTimeout(timer);
		observer?.disconnect();
		animations.forEach(animation => animation.cancel());
		layer.remove();
		delete root.dataset.utageRevivalMotion;
	};

	function animate(node: Element, frames: Keyframe[], options: KeyframeAnimationOptions = {}) {
		const animation = node.animate(frames, { duration: DURATION, fill: 'both', ...options });
		animations.push(animation);
		return animation;
	}

	try {
		root.dataset.utageRevivalMotion = 'start';
		root.append(layer);
		// Four open sections pull apart, then return toward the same frame.
		const quarters: [string, number, number][] = [
			[`M${cx} ${y}H${right - tr}Q${right} ${y} ${right} ${y + tr}V${cy - 7}`, 6, -4],
			[`M${right} ${cy + 7}V${bottom - br}Q${right} ${bottom} ${right - br} ${bottom}H${cx + 7}`, 6, 4],
			[`M${cx - 7} ${bottom}H${x + bl}Q${x} ${bottom} ${x} ${bottom - bl}V${cy + 7}`, -6, 4],
			[`M${x} ${cy - 7}V${y + tl}Q${x} ${y} ${x + tl} ${y}H${cx - 7}`, -6, -4],
		];
		for (const [d, dx, dy] of quarters) {
			const part = svgNode('path', { d, class: 'utage-revival-fragment' }); svg.append(part);
			animate(part, [
				{ transform: 'translate(0, 0)', opacity: .85, offset: 0 },
				{ transform: `translate(${dx}px, ${dy}px)`, opacity: .7, offset: .15, easing: ease },
				{ transform: `translate(${dx}px, ${dy}px)`, opacity: .35, offset: .23, easing: ease },
				{ transform: 'translate(0, 0)', opacity: 0, offset: .46 },
				{ transform: 'translate(0, 0)', opacity: 0, offset: 1 },
			]);
		}
		// Two strokes climb from the bottom, meeting at the top of the note.
		const sides = [
			`M${cx} ${bottom}H${x + bl}Q${x} ${bottom} ${x} ${bottom - bl}V${y + tl}Q${x} ${y} ${x + tl} ${y}H${cx}`,
			`M${cx} ${bottom}H${right - br}Q${right} ${bottom} ${right} ${bottom - br}V${y + tr}Q${right} ${y} ${right - tr} ${y}H${cx}`,
		];
		for (const d of sides) {
			for (const halo of [true, false]) {
				const line = svgNode('path', { d, pathLength: 1, class: halo ? 'utage-revival-trace utage-revival-halo' : 'utage-revival-trace' });
				svg.append(line);
				animate(line, [
					{ strokeDashoffset: 1, offset: 0 },
					{ strokeDashoffset: 1, offset: .24, easing: 'cubic-bezier(.4,0,.2,1)' },
					{ strokeDashoffset: 0, offset: .73 },
					{ strokeDashoffset: 0, offset: 1 },
				]);
			}
		}
		const join = svgNode('circle', { cx, cy: y, r: 2.2, class: 'utage-revival-join' }); svg.append(join);
		animate(join, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .69 }, { opacity: 1, offset: .74 }, { opacity: 0, offset: .92 }, { opacity: 0, offset: 1 }]);
		animate(layer, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .79 }, { opacity: 0, offset: 1 }]);
		// The actual note stays interactive; only a shallow movement marks the interruption.
		animate(article, [{ transform: 'translateY(0)', offset: 0 }, { transform: 'translateY(2px)', offset: .13, easing: ease }, { transform: 'translateY(0)', offset: .38 }, { transform: 'translateY(0)', offset: 1 }]);
		animate(status, [{ opacity: 0, transform: 'translateY(5px)', offset: 0 }, { opacity: 0, transform: 'translateY(5px)', offset: .32, easing: ease }, { opacity: 1, transform: 'translateY(0)', offset: .61 }, { opacity: 1, transform: 'translateY(0)', offset: 1 }]);
		animate(status.querySelector('[data-utage-revival-symbol]')!, [{ transform: 'rotate(-150deg)', offset: 0 }, { transform: 'rotate(-150deg)', offset: .32, easing: ease }, { transform: 'rotate(0)', offset: .68 }, { transform: 'rotate(0)', offset: 1 }]);
		observer = new ResizeObserver(() => {
			if (root.clientWidth !== width || root.clientHeight !== height) cancel();
		});
		observer.observe(root);
		timer = window.setTimeout(cancel, DURATION + 80);
		Promise.all(animations.map(animation => animation.finished)).then(cancel).catch(cancel);
	} catch {
		// An unsupported animation must never hide the final state.
		cancel();
	}
	return cancel;
}

export function useUtageRevivalMotion(options: {
	root: Readonly<Ref<HTMLElement | null>>;
	frame: Readonly<Ref<HTMLElement | null>>;
	state: Readonly<Ref<'none' | 'flashing' | 'reviving' | 'failed' | 'success'>>;
	animationEnabled: Readonly<Ref<boolean>>;
}): void {
	watch([options.state, options.animationEnabled, options.frame], ([state, enabled, frame], [previous], cleanup) => {
		const root = options.root.value;
		const status = root?.querySelector<HTMLElement>('[data-utage-status-line]');
		if (previous !== 'flashing' || state !== 'reviving' || !enabled || !frame || !root || !status) return;
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		if (query.matches || window.document.hidden) return;
		const cancel = playUtageRevival(frame, root, status);
		const stop = () => {
			cancel(); window.clearTimeout(finishTimer);
			query.removeEventListener('change', stop);
			window.document.removeEventListener('visibilitychange', visibility);
			window.document.removeEventListener('wheel', onInput, true); window.document.removeEventListener('touchmove', onInput, true);
			frame.removeEventListener('pointerdown', stop, true); frame.removeEventListener('keydown', stop, true);
			window.removeEventListener('pagehide', stop); window.removeEventListener('resize', stop);
		};
		const visibility = () => { if (window.document.hidden) stop(); };
		const onInput = (event: Event) => { if (event.target instanceof Node && (frame.contains(event.target) || event.target.contains(frame))) stop(); };
		query.addEventListener('change', stop);
		window.document.addEventListener('visibilitychange', visibility);
		window.document.addEventListener('wheel', onInput, { capture: true, passive: true });
		window.document.addEventListener('touchmove', onInput, { capture: true, passive: true });
		frame.addEventListener('pointerdown', stop, true);
		frame.addEventListener('keydown', stop, true);
		window.addEventListener('pagehide', stop);
		window.addEventListener('resize', stop);
		const finishTimer = window.setTimeout(stop, DURATION + 80);
		cleanup(stop);
	}, { flush: 'post' });
}
