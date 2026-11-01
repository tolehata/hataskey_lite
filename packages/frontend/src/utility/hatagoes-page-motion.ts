/* SPDX-License-Identifier: AGPL-3.0-only */

/** Animate the live page without remounting forms or moving focus. */
export function captureHatagoesPageTurn(container: HTMLElement | null | undefined, direction = 1): { play: () => void; cancel: () => void } {
	let animation: Animation | undefined;
	let cancelled = false;
	return {
		play() {
			if (cancelled || !container?.isConnected || typeof container.animate !== 'function') return;
			animation?.cancel();
			const next = container.animate([
				{ transform: `translateX(${direction < 0 ? '-10px' : '10px'})` },
				{ transform: 'translateX(0)' },
			], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
			animation = next;
			void next.finished.catch(() => { /* Rapid navigation cancels the previous slide. */ });
			next.onfinish = () => { if (animation === next) animation = undefined; };
		},
		cancel() { cancelled = true; animation?.cancel(); animation = undefined; },
	};
}
