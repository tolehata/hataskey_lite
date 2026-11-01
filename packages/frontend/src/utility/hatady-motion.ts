/* SPDX-License-Identifier: AGPL-3.0-only */
import { prefer } from '@/preferences.js';

/** Geometry from the approved mock: connected strips bend from the free edge. */
export function hatadyPaperGeometry(width: number, count: number, progress: number, direction = 1) {
	const p = Math.max(0, Math.min(1, progress)),
		sign = direction < 0 ? -1 : 1,
		span = width / count;
	let x = sign > 0 ? 0 : width,
		z = 0;
	const strips: { left: number; x: number; z: number; angle: number; shade: number }[] = [];
	for (let index = 0; index < count; index++) {
		const s = (index + 0.5) / count,
			angle = Math.PI * p + 0.68 * Math.sin(Math.PI * p) * (s ** 1.6 - 0.28);
		strips.push({
			left: sign > 0 ? index * span : width - (index + 1) * span,
			x: x - (sign < 0 ? span : 0),
			z,
			angle: (-sign * angle * 180) / Math.PI,
			shade: Math.sin(angle) * 0.22,
		});
		x += sign * span * Math.cos(angle);
		z += span * Math.sin(angle);
	}
	return { strips, tipX: x };
}

/** Called by Hatady capsule handlers before changing state. Never changes live form state. */
export function captureHatadyPageTurn(
	container: HTMLElement | null,
	direction = 1,
): { play: (startTime?: CSSNumberish | null) => void; cancel: () => void } {
	const idle = { play: () => {}, cancel: () => {} };
	if (
		!container ||
		window.document.hidden ||
		!prefer.r.animation.value ||
		matchMedia('(prefers-reduced-motion: reduce)').matches ||
		typeof container.animate !== 'function'
	) return idle;
	const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
	const width = container.clientWidth,
		height = container.clientHeight,
		offset = container.scrollTop;
	if (width < 1 || height < 30 || !container.firstElementChild) return idle;
	// Keep the viewport's class and height so direct-child sizing, container
	// queries and percentage heights remain identical inside every paper strip.
	const snapshot = container.cloneNode(false) as HTMLElement;
	snapshot.removeAttribute('id');
	snapshot.classList.add('hy-paper-copy');
	snapshot.style.width = `${width}px`;
	snapshot.style.height = `${height}px`;
	snapshot.style.maxWidth = 'none';
	snapshot.style.maxHeight = 'none';
	snapshot.style.margin = '0';
	snapshot.style.position = 'absolute';
	snapshot.style.overflow = 'hidden';
	const style = getComputedStyle(container);
	snapshot.style.padding = style.padding;
	for (const child of container.children) snapshot.append(child.cloneNode(true));
	const sourceNodes = Array.from(container.querySelectorAll<HTMLElement>('*')),
		copies = Array.from(snapshot.querySelectorAll<HTMLElement>('*'));
	const scrolls: number[][] = [];

	function saveScroll(source: HTMLElement, copy: HTMLElement): void {
		copy.removeAttribute('data-hy-paper-scroll');
		if (source.scrollTop || source.scrollLeft) {
			copy.dataset.hyPaperScroll = String(scrolls.length);
			scrolls.push([source.scrollTop, source.scrollLeft]);
		}
	}

	function sanitizeCopy(root: HTMLElement): void {
		for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
			for (const attribute of ['id', 'name', 'autofocus', 'for', 'form', 'aria-labelledby', 'aria-describedby', 'data-hy-entrance']) node.removeAttribute(attribute);
			if (node.matches('button,input,textarea,select,a,summary,[tabindex],[contenteditable]')) node.tabIndex = -1;
			if (node.hasAttribute('contenteditable')) node.setAttribute('contenteditable', 'false');
		}
	}

	const bounds = container.getBoundingClientRect();
	sourceNodes.forEach((node, index) => {
		const copy = copies[index];
		saveScroll(node, copy);
		if (!node.hasAttribute('data-hy-entrance')) return;
		const rect = node.getBoundingClientRect();
		if (rect.height > 0 && (rect.bottom <= bounds.top || rect.top >= bounds.bottom)) {
			copy.replaceChildren();
			copy.style.boxSizing = 'border-box';
			copy.style.height = `${rect.height}px`;
			copy.style.minHeight = `${rect.height}px`;
			copy.style.visibility = 'hidden';
		}
	});
	sanitizeCopy(snapshot);

	function syncCapsuleSelections(liveContainer: HTMLElement): void {
		const selector = '[data-hy-page-controls][role="group"][aria-label]';
		const liveGroups = new Map(Array.from(liveContainer.querySelectorAll<HTMLElement>(selector))
			.filter(node => !node.closest('.hy-page-leaf'))
			.map(node => [node.getAttribute('aria-label'), node]));
		for (const copiedGroup of snapshot.querySelectorAll<HTMLElement>(selector)) {
			const liveGroup = liveGroups.get(copiedGroup.getAttribute('aria-label'));
			if (!liveGroup) continue;
			const replacement = liveGroup.cloneNode(true) as HTMLElement;
			const liveNodes = [liveGroup, ...liveGroup.querySelectorAll<HTMLElement>('*')];
			const replacementNodes = [replacement, ...replacement.querySelectorAll<HTMLElement>('*')];
			liveNodes.forEach((node, index) => saveScroll(node, replacementNodes[index]));
			sanitizeCopy(replacement);
			copiedGroup.replaceWith(replacement);
		}
	}

	const leaf = window.document.createElement('div');
	leaf.className = 'hy-page-leaf';
	leaf.dataset.hyPageLeaf = '';
	leaf.dataset.direction = direction < 0 ? 'backward' : 'forward';
	leaf.setAttribute('aria-hidden', 'true');
	leaf.inert = true;
	leaf.style.cssText = `top:${offset}px;width:${width}px;height:${height}px`;
	const shadow = window.document.createElement('div');
	shadow.className = 'hy-paper-shadow';
	shadow.style.transformOrigin = direction < 0 ? 'right center' : 'left center';
	leaf.append(shadow);
	const scene = window.document.createElement('div');
	scene.className = 'hy-paper-scene';
	scene.style.perspective = `${Math.max(1800, width * 3.5)}px`;
	leaf.append(scene);
	const count = Math.max(6, Math.min(width < 600 ? 14 : 20, Math.floor(12000 / (copies.length + 1))));
	const frames = Array.from({ length: 33 }, (_, index) => {
		const t = index / 32;
		return { t, ...hatadyPaperGeometry(width, count, (1 - Math.cos(Math.PI * t)) / 2, direction) };
	});
	const animations: Animation[] = [];
	let timer: number | undefined,
		canceled = false;
	const cancel = () => {
		motionPreference.removeEventListener('change', cancel);
		canceled = true;
		window.clearTimeout(timer);
		for (const animation of animations) animation.cancel();
		leaf.remove();
	};
	const play = (startTime: CSSNumberish | null = window.document.timeline.currentTime) => {
		if (canceled || !container.isConnected) return;
		if (motionPreference.matches || !prefer.r.animation.value) {
			cancel();
			return;
		}
		// Turn the whole old page, including its heading and controls. A matching
		// capsule shows the destination selection so the highlight never flashes back.
		syncCapsuleSelections(container);
		leaf.style.top = `${container.scrollTop}px`;
		motionPreference.addEventListener('change', cancel);
		try {
			const scrollRestores: { node: HTMLElement; top: number; left: number }[] = [];
			const effects: { node: HTMLElement; keyframes: Keyframe[] }[] = [];
			// Assemble every strip off-document. Alternating live DOM insertion,
			// scroll restoration and animate() forces layout between paper strips.
			for (let index = 0; index < count; index++) {
				const strip = window.document.createElement('div');
				strip.className = 'hy-paper-strip';
				strip.style.width = `${width / count}px`;
				strip.style.transformOrigin = direction < 0 ? 'right center' : 'left center';
				const front = window.document.createElement('div');
				front.className = 'hy-paper-front';
				const content = snapshot.cloneNode(true) as HTMLElement;
				content.style.left = `${-frames[0].strips[index].left}px`;
				content.style.top = '0';
				front.append(content);
				const back = window.document.createElement('div');
				back.className = 'hy-paper-back';
				strip.append(front, back);
				scene.append(strip);
				content.querySelectorAll<HTMLElement>('[data-hy-paper-scroll]').forEach(node => {
					const saved = scrolls[Number(node.dataset.hyPaperScroll)];
					scrollRestores.push({ node, top: saved[0], left: saved[1] });
					node.removeAttribute('data-hy-paper-scroll');
				});
				scrollRestores.push({ node: content, top: offset, left: 0 });
				effects.push({
					node: strip,
					keyframes: frames.map((frame) => {
						const part = frame.strips[index];
						return { offset: frame.t, transform: `translate3d(${part.x}px,0,${part.z}px) rotateY(${part.angle}deg)` };
					}),
				});
				for (const face of [front, back]) {
					const shade = window.document.createElement('div');
					shade.className = 'hy-paper-shade';
					face.append(shade);
					effects.push({
						node: shade,
						keyframes: frames.map((frame) => ({ offset: frame.t, opacity: frame.strips[index].shade * (face === back ? 0.8 : 1) })),
					});
				}
			}
			effects.push({
				node: shadow,
				keyframes: frames.map(frame => ({
					offset: frame.t,
					opacity: Math.sin(Math.PI * (1 - Math.cos(Math.PI * frame.t)) / 2) * 0.32,
					transform: `scaleX(${0.1 + 0.9 * Math.abs(frame.tipX - (direction < 0 ? width : 0)) / width})`,
				})),
			});
			container.append(leaf);
			// Scroll setters need connected boxes. Restore them together before
			// animations can invalidate those boxes again.
			for (const { node, top, left } of scrollRestores) {
				node.scrollTop = top;
				node.scrollLeft = left;
			}
			for (const { node, keyframes } of effects) {
				animations.push(node.animate(keyframes, { duration: width < 600 ? 760 : 840, easing: 'linear', fill: 'both' }));
			}
			if (startTime != null) for (const animation of animations) animation.startTime = startTime;
			Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(cancel);
			timer = window.setTimeout(cancel, 1100);
		} catch {
			cancel();
		}
	};
	return { play, cancel };
}
