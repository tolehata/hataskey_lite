/* SPDX-License-Identifier: AGPL-3.0-only */

/** Home-button scroll only. Other timeline positioning keeps its existing behavior. */
export function createHk3HomeScroll(viewport: () => HTMLElement | null, motion: () => boolean) {
	let frame = 0;
	let target: HTMLElement | null = null;

	function cancel() {
		if (frame) window.cancelAnimationFrame(frame);
		frame = 0;
		target = null;
		window.removeEventListener('wheel', cancel, true);
		window.removeEventListener('touchstart', cancel, true);
		window.removeEventListener('pointerdown', cancel, true);
		window.removeEventListener('keydown', cancel, true);
	}

	function finish() {
		const el = target;
		cancel();
		if (el) el.scrollTop = 0;
	}

	function start() {
		cancel();
		const el = viewport();
		if (!el) return;
		const from = el.scrollTop;
		if (from <= 0 || !motion()) {
			el.scrollTop = 0;
			return;
		}
		target = el;
		const duration = Math.min(900, Math.max(320, 360 + Math.sqrt(from) * 4));
		let startedAt: number | null = null;
		const step = (now: number) => {
			if (target !== el) return;
			if (!motion()) {
				finish();
				return;
			}
			startedAt ??= now;
			const progress = Math.min(1, (now - startedAt) / duration);
			const eased = (1 - Math.cos(Math.PI * progress)) / 2;
			el.scrollTop = from * (1 - eased);
			if (progress === 1) finish();
			else frame = window.requestAnimationFrame(step);
		};
		window.addEventListener('wheel', cancel, true);
		window.addEventListener('touchstart', cancel, true);
		window.addEventListener('pointerdown', cancel, true);
		window.addEventListener('keydown', cancel, true);
		frame = window.requestAnimationFrame(step);
	}

	return { start, cancel, finish };
}
