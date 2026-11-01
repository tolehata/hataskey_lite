// SPDX-License-Identifier: AGPL-3.0-only
// Finite, cancelable entrance motion. The DOM always contains its final layout.
export const REVEAL_EASE = 'cubic-bezier(.2,.75,.2,1)';
export type RevealItem = { element: HTMLElement | null; delay?: number; duration?: number; easing?: string; x?: number; y?: number; scale?: number; exit?: boolean; frames?: Keyframe[] };

export function createReveal() {
	const active = new Set<{ animation: Animation; finish: () => void }>();

	function cancel() {
		for (const item of [...active]) { item.animation.cancel(); item.finish(); }
	}

	function play(items: RevealItem[], enabled: boolean): Promise<void> {
		cancel();
		if (!enabled || window.document.hidden) return Promise.resolve();
		return Promise.all(items.map(item => new Promise<void>(resolve => {
			const element = item.element;
			if (!element?.isConnected || typeof element.animate !== 'function') { resolve(); return; }
			const resting = { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' };
			const displaced = { opacity: 0, transform: `translate3d(${item.x ?? 0}px,${item.y ?? 18}px,0) scale(${item.scale ?? 1})` };
			const animation = element.animate(item.frames ?? (item.exit ? [resting, displaced] : [displaced, resting]), {
				duration: item.duration ?? 640, delay: item.delay ?? 0, easing: item.easing ?? REVEAL_EASE, fill: 'both', iterations: 1,
			});
			const entry = { animation, finish: () => {
				if (!active.delete(entry)) return;
				// Removing the finished effect leaves the original layout and styles intact.
				animation.cancel(); resolve();
			} };
			active.add(entry);
			animation.finished.then(entry.finish, entry.finish);
		}))).then(() => undefined);
	}

	return { play, cancel };
}
