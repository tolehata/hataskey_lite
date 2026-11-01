/* SPDX-License-Identifier: AGPL-3.0-only */
import { watch } from 'vue';
import { prefer } from '@/preferences.js';

type EntranceKind = 'home' | 'book' | 'movie' | 'game' | 'exercise' | 'work';
type EntranceEffect = { duration: number; easing: string; origin: string; frames: Keyframe[] };

// Keep the approved mock's separate category entrances and trailing decoration.
const effects: Record<EntranceKind, EntranceEffect> = {
	home: { duration: 460, easing: 'cubic-bezier(.22,.8,.3,1)', origin: 'center', frames: [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }] },
	book: { duration: 520, easing: 'cubic-bezier(.34,1.5,.6,1)', origin: 'bottom center', frames: [{ opacity: 0, transform: 'translateY(24px) rotate(-16deg)' }, { opacity: 1, transform: 'none' }] },
	movie: { duration: 620, easing: 'cubic-bezier(.22,.9,.3,1)', origin: 'center', frames: [{ opacity: 0, transform: 'translateY(10px) scaleY(.82)' }, { opacity: 1, transform: 'none' }] },
	game: { duration: 550, easing: 'cubic-bezier(.34,1.56,.64,1)', origin: 'center', frames: [{ opacity: 0, transform: 'scale(.86) translateY(8px)' }, { opacity: 1, transform: 'none' }] },
	exercise: { duration: 600, easing: 'ease-out', origin: 'bottom center', frames: [{ offset: 0, opacity: 0, transform: 'translate(-18px,6px)' }, { offset: 0.45, opacity: 1, transform: 'translate(3px,-5px)' }, { offset: 0.72, opacity: 1, transform: 'translate(-1px,2px)' }, { offset: 1, opacity: 1, transform: 'none' }] },
	work: { duration: 620, easing: 'cubic-bezier(.22,.9,.3,1)', origin: 'bottom left', frames: [{ opacity: 0, transform: 'translate(10px,18px) rotate(2deg)' }, { offset: 0.7, opacity: 1, transform: 'translate(-1px,-1px) rotate(-.3deg)' }, { opacity: 1, transform: 'none' }] },
};

function entranceKind(node: HTMLElement): EntranceKind | null {
	const kind = node.dataset.hyEntrance;
	if (kind === 'study') return 'book';
	return kind && Object.hasOwn(effects, kind) ? kind as EntranceKind : null;
}

export type HatadyListEntrance = {
	play: (startTime?: CSSNumberish | null) => void;
	finish: () => void;
	cancel: () => void;
};

/** Keep one controller for a destination list; call play again after async data arrives. */
export function createHatadyListEntrance(container: HTMLElement): HatadyListEntrance {
	const ownerDocument = container.ownerDocument;
	const view = ownerDocument.defaultView ?? window;
	const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
	const seen = new WeakSet<HTMLElement>();
	const active = new Set<() => void>();
	let canceled = false;

	function enabled(): boolean {
		return prefer.r.animation.value && !reducedMotion.matches && !ownerDocument.hidden;
	}

	function stopActive(): void {
		for (const finish of [...active]) finish();
	}

	function checkPreference(): void {
		if (!enabled()) stopActive();
	}

	const stopPreferenceWatch = watch(prefer.r.animation, checkPreference, { flush: 'sync' });
	reducedMotion.addEventListener('change', checkPreference);
	ownerDocument.addEventListener('visibilitychange', checkPreference);

	function play(startTime: CSSNumberish | null = ownerDocument.timeline?.currentTime ?? null): void {
		if (canceled || !container.isConnected) return;
		const items = Array.from(container.querySelectorAll<HTMLElement>('[data-hy-entrance]')).filter(node => {
			// Page-turn snapshots copy markup but must never animate their duplicate cards.
			if (seen.has(node) || !entranceKind(node) || node.closest('.hy-page-leaf, [inert], [hidden], [aria-hidden="true"]')) return false;
			seen.add(node);
			return true;
		});
		if (!enabled()) {
			stopActive();
			return;
		}
		const home = items.every(node => node.dataset.hyEntrance === 'home');
		const bounds = container.getBoundingClientRect();
		// Measure the whole batch before attributes, flair or animations dirty
		// layout. Cards outside the scroll viewport already have their final state.
		const ordered = items.map(node => ({ node, rect: node.getBoundingClientRect() }))
			.filter(({ rect }) => !(bounds.height > 0 && rect.height > 0 && (rect.bottom <= bounds.top || rect.top >= bounds.bottom)));
		if (home) ordered.sort((a, b) => Math.abs(a.rect.top - b.rect.top) > 2 ? a.rect.top - b.rect.top : a.rect.left - b.rect.left);
		const prepared = ordered.map(({ node }) => {
			const before = view.getComputedStyle(node);
			const baseTransform = before.transform && before.transform !== 'none' ? before.transform : '';
			const baseOpacity = Number.parseFloat(before.opacity) || (before.opacity === '0' ? 0 : 1);
			return { node, baseTransform, baseOpacity };
		});
		prepared.forEach(({ node, baseTransform, baseOpacity }, index) => {
			const kind = entranceKind(node);
			if (!kind || !node.isConnected || typeof node.animate !== 'function') return;
			const effect = effects[kind];
			const originalOrigin = node.style.getPropertyValue('transform-origin');
			const originalPriority = node.style.getPropertyPriority('transform-origin');
			const originalMotion = node.getAttribute('data-hy-list-motion');
			const animations: Animation[] = [];
			let flair: HTMLElement | null = null;
			let finished = false;
			node.setAttribute('data-hy-list-motion', kind);
			node.style.setProperty('transform-origin', effect.origin);

			function finish(): void {
				if (finished) return;
				finished = true;
				active.delete(finish);
				for (const animation of animations) animation.cancel();
				if (originalMotion === null) node.removeAttribute('data-hy-list-motion');
				else node.setAttribute('data-hy-list-motion', originalMotion);
				if (originalOrigin) node.style.setProperty('transform-origin', originalOrigin, originalPriority);
				else node.style.removeProperty('transform-origin');
				flair?.remove();
			}

			function animate(target: HTMLElement, frames: Keyframe[], duration: number, easing = effect.easing): void {
				const animation = target.animate(frames, { duration, delay: home ? index * 65 : Math.min(index * 55, 330), easing, fill: 'both' });
				animation.finished.catch(() => {});
				animations.push(animation);
				if (startTime !== null) animation.startTime = startTime;
			}

			active.add(finish);
			try {
				animate(node, effect.frames.map(frame => ({
					...frame,
					opacity: Number(frame.opacity) * baseOpacity,
					transform: frame.transform === 'none' ? baseTransform || 'none' : `${frame.transform}${baseTransform ? ` ${baseTransform}` : ''}`,
				})), effect.duration);
				if (kind === 'movie' || kind === 'game' || kind === 'work') {
					flair = ownerDocument.createElement('span');
					flair.className = 'hy-list-flair';
					flair.dataset.kind = kind;
					flair.setAttribute('aria-hidden', 'true');
					node.append(flair);
					const frames: Keyframe[] = kind === 'movie' ? [{ opacity: 0, transform: 'translateX(-115%)' }, { offset: 0.28, opacity: 1 }, { opacity: 0, transform: 'translateX(115%)' }]
						: kind === 'game' ? [{ opacity: 0 }, { offset: 0.35, opacity: 0.85 }, { opacity: 0 }]
							: [{ opacity: 0, transform: 'translateY(12px)' }, { offset: 0.5, opacity: 0.8 }, { opacity: 0, transform: 'translateY(0)' }];
					animate(flair, frames, kind === 'movie' ? 950 : 800, 'ease-out');
				}
				Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(finish);
			} catch {
				finish();
			}
		});
	}

	return {
		play,
		// Interruption ends this visual effect but retains seen nodes for later API arrivals.
		finish: stopActive,
		cancel() {
			if (canceled) return;
			canceled = true;
			stopActive();
			stopPreferenceWatch();
			reducedMotion.removeEventListener('change', checkPreference);
			ownerDocument.removeEventListener('visibilitychange', checkPreference);
		},
	};
}
