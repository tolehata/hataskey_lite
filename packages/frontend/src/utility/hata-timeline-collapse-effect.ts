/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const HATA_TIMELINE_COLLAPSE_DURATION_MS = 10_000;

export type HataTimelineCollapseEffect = {
	play: () => boolean;
	cancel: () => void;
	destroy: () => void;
	isRunning: () => boolean;
};

type Options = {
	root: () => HTMLElement | null;
	animationEnabled: () => boolean;
};

type Candidate = {
	element: HTMLElement;
	rect: DOMRect;
};

function isVisible(element: HTMLElement, rect: DOMRect, viewportHeight: number, viewportWidth: number): boolean {
	if (rect.width <= 0 || rect.height <= 0) return false;
	if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) return false;
	const style = window.getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function collectCandidates(root: HTMLElement): Candidate[] {
	const doc = root.ownerDocument;
	const elements = new Set<HTMLElement>();

	root.querySelectorAll<HTMLElement>('[data-hata-collapse-part]').forEach(element => elements.add(element));
	root.querySelectorAll<HTMLElement>('[data-hata-collapse-group]').forEach(group => {
		for (const child of group.children) {
			if (child instanceof HTMLElement) elements.add(child);
		}
	});
	root.querySelectorAll<HTMLElement>('[data-hata-collapse-items] [data-scroll-anchor], [data-hata-collapse-items] [data-deck-frame]').forEach(element => elements.add(element));

	// 投稿モーダルとモバイルドロワーはTeleportでUIルート外へ出るため、専用属性だけを文書全体から拾う。
	doc.querySelectorAll<HTMLElement>('[data-htk-weather-postform], [data-hata-collapse-teleport]').forEach(element => elements.add(element));

	const viewportHeight = Math.max(doc.documentElement.clientHeight, window.innerHeight);
	const viewportWidth = Math.max(doc.documentElement.clientWidth, window.innerWidth);
	const visible = [...elements]
		.map(element => ({ element, rect: element.getBoundingClientRect() }))
		.filter(candidate => isVisible(candidate.element, candidate.rect, viewportHeight, viewportWidth));
	// 親と子へ同時にtransformを掛けると移動量が二重になるため、ノートやデッキ枠など外側の構造単位を優先する。
	return visible
		.filter(candidate => !visible.some(other => other !== candidate && other.element.contains(candidate.element)))
		.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
}

function withTransform(base: string, transform: string): string {
	return base === 'none' || base === '' ? transform : `${base} ${transform}`;
}

export function createHataTimelineCollapseEffect(options: Options): HataTimelineCollapseEffect {
	let running = false;
	let cleanupTimer: number | null = null;
	let animations: Animation[] = [];
	let activeRoot: HTMLElement | null = null;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	const cancel = () => {
		if (cleanupTimer !== null) {
			window.clearTimeout(cleanupTimer);
			cleanupTimer = null;
		}
		for (const animation of animations) {
			try {
				animation.cancel();
			} catch {
				// 既に破棄された要素のAnimationでも、残りの復元処理を継続する。
			}
		}
		animations = [];
		activeRoot?.removeAttribute('data-hata-timeline-collapse-active');
		activeRoot = null;
		running = false;
	};

	const onReducedMotionChange = (event: MediaQueryListEvent) => {
		if (event.matches) cancel();
	};
	reducedMotion.addEventListener('change', onReducedMotionChange);

	const play = (): boolean => {
		if (running || !options.animationEnabled() || reducedMotion.matches) return false;
		const root = options.root();
		if (root === null) return false;

		const candidates = collectCandidates(root);
		if (candidates.length === 0) return false;

		const top = candidates[0].rect.top;
		const bottom = candidates[candidates.length - 1].rect.top;
		const topRange = Math.max(1, bottom - top);
		const viewportHeight = Math.max(root.ownerDocument.documentElement.clientHeight, window.innerHeight);
		const created: Animation[] = [];

		for (let index = 0; index < candidates.length; index++) {
			const { element, rect } = candidates[index];
			if (typeof element.animate !== 'function') continue;

			const style = window.getComputedStyle(element);
			const baseTransform = style.transform || 'none';
			const baseOpacity = style.opacity || '1';
			const stagger = (rect.top - top) / topRange;
			const fallStartMs = 120 + stagger * 900;
			const fallEndMs = fallStartMs + 720;
			const horizontal = (((index * 73) % 19) - 9) * 13;
			const rotation = (((index * 47) % 17) - 8) * 3.2;
			const pileDepth = 18 + (index % 6) * 11;
			const fallDistance = Math.max(48, viewportHeight - rect.bottom - pileDepth);
			const fallen = withTransform(baseTransform, `translate3d(${horizontal}px, ${fallDistance}px, 0) rotate(${rotation}deg)`);
			const rebound = withTransform(baseTransform, `translate3d(${-horizontal * 0.08}px, -12px, 0) rotate(${-rotation * 0.08}deg)`);

			try {
				created.push(element.animate([
					{ offset: 0, transform: baseTransform, opacity: baseOpacity },
					{ offset: fallStartMs / HATA_TIMELINE_COLLAPSE_DURATION_MS, transform: baseTransform, opacity: baseOpacity, easing: 'cubic-bezier(0.45, 0, 1, 1)' },
					{ offset: fallEndMs / HATA_TIMELINE_COLLAPSE_DURATION_MS, transform: fallen, opacity: '0.9' },
					{ offset: 0.89, transform: fallen, opacity: '0.9', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
					{ offset: 0.96, transform: rebound, opacity: baseOpacity },
					{ offset: 1, transform: baseTransform, opacity: baseOpacity },
				], {
					duration: HATA_TIMELINE_COLLAPSE_DURATION_MS,
					fill: 'none',
				}));
			} catch {
				// 1要素のWAAPI失敗で、ほかの要素まで演出不能にしない。
			}
		}

		if (created.length === 0) return false;

		animations = created;
		running = true;
		activeRoot = root;
		root.setAttribute('data-hata-timeline-collapse-active', 'true');
		cleanupTimer = window.setTimeout(cancel, HATA_TIMELINE_COLLAPSE_DURATION_MS);
		return true;
	};

	const destroy = () => {
		cancel();
		reducedMotion.removeEventListener('change', onReducedMotionChange);
	};

	return {
		play,
		cancel,
		destroy,
		isRunning: () => running,
	};
}
