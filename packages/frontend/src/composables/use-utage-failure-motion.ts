/* SPDX-License-Identifier: AGPL-3.0-only */
import { nextTick, watch } from 'vue';
import type { Ref } from 'vue';
import './use-utage-failure-motion.css';

export const UTAGE_FAILURE_DURATION = 1650;

type Options = {
	root: Readonly<Ref<HTMLElement | null>>;
	article: Readonly<Ref<HTMLElement | null>>;
	state: Readonly<Ref<'none' | 'flashing' | 'reviving' | 'failed' | 'success'>>;
	animationEnabled: Readonly<Ref<boolean>>;
	failedText: string;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - (1 - clamp(value)) ** 3;
const smooth = (value: number) => clamp(value) ** 2 * (3 - 2 * clamp(value));

export function isVisible(article: HTMLElement): boolean {
	const rect = article.getBoundingClientRect();
	let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
	let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
	if (!article.isConnected || rect.width <= 0 || rect.height <= 0) return false;
	for (let element: HTMLElement | null = article; element; element = element.parentElement) {
		const style = getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden' || style.contentVisibility === 'hidden' || style.opacity === '0') return false;
		if (element === article) continue;
		const bounds = element.getBoundingClientRect();
		if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
			left = Math.max(left, bounds.left);
			right = Math.min(right, bounds.right);
		}
		if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
			top = Math.max(top, bounds.top);
			bottom = Math.min(bottom, bounds.bottom);
		}
	}
	return right > left && bottom > top;
}

/** Freeze the rendered note only; copies never mount components or load embedded media. */
function snapshot(source: Element, stickyBounds: DOMRect[]): Element {
	const doc = source.ownerDocument;
	const media = source.matches('img,video,canvas');
	const placeholder = source.matches('iframe,audio,object,embed,source,script,style,link');
	const copy = media ? doc.createElement('canvas') : placeholder ? doc.createElement('span') : source.cloneNode(false) as Element;
	const style = getComputedStyle(source);
	const copyStyle = (copy as HTMLElement | SVGElement).style;
	// Inline used styles retain the actual theme, compact layout and direct-child rules
	// when the snapshot is moved beneath the two clipping layers.
	for (let index = 0; index < style.length; index++) {
		const property = style.item(index);
		// Theme variables still inherit from the same note; avoid copying the full
		// theme onto every glyph/emoji. Local inline variables survive cloneNode.
		if (property.startsWith('--')) continue;
		copyStyle.setProperty(property, style.getPropertyValue(property), 'important');
	}
	copyStyle.setProperty('animation', 'none', 'important');
	copyStyle.setProperty('transition', 'none', 'important');
	copyStyle.setProperty('pointer-events', 'none', 'important');
	if (style.contentVisibility !== 'hidden') copyStyle.setProperty('content-visibility', 'visible', 'important');
	for (const attribute of [...copy.attributes]) {
		if (/^on/i.test(attribute.name) || ['id', 'name', 'autofocus', 'for', 'form', 'aria-labelledby', 'aria-describedby', 'src', 'srcset', 'href', 'xlink:href', 'autoplay', 'data-utage-state', 'data-utage-square'].includes(attribute.name)) {
			copy.removeAttribute(attribute.name);
		}
	}
	if (copy.matches('button,input,textarea,select,a,summary,[tabindex],[contenteditable]')) copy.setAttribute('tabindex', '-1');
	if (copy.hasAttribute('contenteditable')) copy.setAttribute('contenteditable', 'false');
	if (style.position === 'sticky') {
		copy.setAttribute('data-utage-failure-sticky', String(stickyBounds.length));
		stickyBounds.push(source.getBoundingClientRect());
		copyStyle.setProperty('position', 'relative', 'important');
		for (const edge of ['top', 'right', 'bottom', 'left']) copyStyle.setProperty(edge, 'auto', 'important');
	}
	if (media || placeholder) {
		const bounds = source.getBoundingClientRect();
		copyStyle.setProperty('width', style.width || `${bounds.width}px`, 'important');
		copyStyle.setProperty('height', style.height || `${bounds.height}px`, 'important');
		if (copy instanceof HTMLCanvasElement) {
			const pixels = source as HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
			const pixelWidth = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLCanvasElement).width;
			const pixelHeight = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLCanvasElement).height;
			// Retain the intrinsic aspect ratio so the original object-fit still crops
			// avatars/media correctly, without allocating full-resolution attachments.
			const scale = Math.min(1, Math.max(bounds.width, bounds.height) * Math.min(window.devicePixelRatio || 1, 2) / Math.max(1, pixelWidth, pixelHeight));
			copy.width = Math.max(1, Math.round(pixelWidth * scale));
			copy.height = Math.max(1, Math.round(pixelHeight * scale));
			try {
				copy.getContext('2d')?.drawImage(pixels, 0, 0, copy.width, copy.height);
			} catch {
				// Unloaded images or protected video frames keep their existing layout.
			}
		}
	} else {
		for (const child of source.childNodes) {
			if (child instanceof Element) copy.append(snapshot(child, stickyBounds));
			else if (child.nodeType === Node.TEXT_NODE) copy.append(child.cloneNode());
		}
	}
	return copy;
}

function duplicateSnapshot(source: HTMLElement): HTMLElement {
	const copy = source.cloneNode(true) as HTMLElement;
	const canvases = copy.querySelectorAll('canvas');
	source.querySelectorAll('canvas').forEach((canvas, index) => {
		try { canvases[index].getContext('2d')?.drawImage(canvas, 0, 0); } catch { /* Keep the placeholder. */ }
	});
	return copy;
}

function play(root: HTMLElement, article: HTMLElement, failedText: string, motionQuery: MediaQueryList): () => void {
	const doc = article.ownerDocument;
	const width = article.offsetWidth, height = article.offsetHeight;
	const top = article.offsetTop, left = article.offsetLeft;
	const rendered = { height, top, left };
	const originalOpacity = article.style.getPropertyValue('opacity');
	const originalPriority = article.style.getPropertyPriority('opacity');
	const opacity = Number.parseFloat(getComputedStyle(article).opacity) || 1;
	const overlay = doc.createElement('section');
	const random = Math.random();
	const direction = random < 0.5 ? 'horizontal' : random < 0.75 ? 'vertical' : 'diagonal';
	overlay.dataset.utageFailureMotion = direction;
	overlay.setAttribute('aria-hidden', 'true');
	overlay.inert = true;
	overlay.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
	let frame = 0, timer = 0, finished = false;
	let observer: ResizeObserver | undefined;
	const cancel = () => {
		if (finished) return;
		finished = true;
		window.cancelAnimationFrame(frame);
		window.clearTimeout(timer);
		observer?.disconnect();
		motionQuery.removeEventListener('change', onMotionChange);
		doc.removeEventListener('visibilitychange', onVisibilityChange);
		doc.removeEventListener('wheel', onScrollInput, true);
		doc.removeEventListener('touchmove', onScrollInput, true);
		window.removeEventListener('pagehide', cancel);
		window.removeEventListener('resize', syncGeometry);
		root.removeEventListener('pointerdown', cancel, true);
		root.removeEventListener('keydown', cancel, true);
		if (originalOpacity) article.style.setProperty('opacity', originalOpacity, originalPriority);
		else article.style.removeProperty('opacity');
		overlay.remove();
	};
	const onMotionChange = () => { if (motionQuery.matches) cancel(); };
	const onVisibilityChange = () => { if (doc.hidden) cancel(); };
	const onScrollInput = (event: Event) => {
		const target = event.target;
		if (target instanceof Node && (root.contains(target) || target.contains(root))) cancel();
	};
	const syncGeometry = () => {
		if (finished) return;
		// Later reaction/filter results can grow the live note after nextTick.
		// Keep the frozen halves at their original size and move only their frame.
		// A width change would reflow the text, so restore the real note in that case.
		if (!article.isConnected || article.offsetWidth !== width || article.offsetHeight <= 0) { cancel(); return; }
		const height = article.offsetHeight, top = article.offsetTop, left = article.offsetLeft;
		if (height !== rendered.height) overlay.style.height = `${height}px`;
		if (top !== rendered.top) overlay.style.top = `${top}px`;
		if (left !== rendered.left) overlay.style.left = `${left}px`;
		Object.assign(rendered, { height, top, left });
	};

	try {
		const stickyBounds: DOMRect[] = [];
		const first = snapshot(article, stickyBounds) as HTMLElement;
		first.dataset.utageFailureSnapshot = '';
		for (const [property, value] of Object.entries({ position: 'absolute', inset: '0', margin: '0', width: `${width}px`, height: `${height}px`, 'box-sizing': 'border-box' })) {
			first.style.setProperty(property, value, 'important');
		}
		const halves = [first, duplicateSnapshot(first)].map((copy, index) => {
			const half = doc.createElement('span');
			half.dataset.utageFailureHalf = String(index);
			half.style.width = `${width}px`;
			half.style.height = `${height}px`;
			half.append(copy);
			overlay.append(half);
			return half;
		});
		const seam = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
		seam.dataset.utageFailureSeam = '';
		seam.setAttribute('viewBox', '0 0 100 100');
		seam.setAttribute('preserveAspectRatio', 'none');
		const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', direction === 'horizontal' ? 'M50 0V100' : direction === 'vertical' ? 'M0 50H100' : 'M72 0L28 100');
		path.setAttribute('pathLength', '100');
		path.setAttribute('vector-effect', 'non-scaling-stroke');
		seam.append(path);
		const label = doc.createElement('span');
		label.dataset.utageFailureLabel = '';
		label.textContent = failedText;
		label.style.fontSize = `${Math.max(32, Math.min(58, width * 0.08))}px`;
		overlay.append(seam, label);

		const vector = direction === 'horizontal' ? [1, 0] : direction === 'vertical' ? [0, 1] : [0.76, 0.72];
		const draw = (t: number) => {
			const split = easeOut((t - 0.055) / 0.30), drift = smooth((t - 0.30) / 0.32);
			const distance = 12 * split + 7 * drift, rotation = 3.8 * split + 1.4 * drift;
			halves.forEach((half, index) => {
				const sign = index === 0 ? -1 : 1;
				half.style.transform = `translate(${sign * distance * vector[0]}%, ${sign * distance * vector[1]}%) rotate(${sign * rotation}deg)`;
				half.style.opacity = String(1 - smooth((t - 0.34) / 0.27));
			});
			seam.style.opacity = String(smooth(t / 0.045) * (1 - smooth((t - 0.10) / 0.10)));
			path.style.strokeDashoffset = String(100 * (1 - easeOut(t / 0.10)));
			const grow = easeOut((t - 0.10) / 0.34);
			label.style.transform = `translate(-50%, -50%) scale(${0.1 + 0.9 * grow + 0.045 * Math.sin(Math.PI * grow)})`;
			label.style.opacity = String(smooth((t - 0.085) / 0.10) * (1 - smooth((t - 0.68) / 0.29)));
			article.style.setProperty('opacity', String(opacity * smooth((t - 0.60) / 0.36)), 'important');
		};
		draw(0);
		root.append(overlay);
		// A sticky avatar must stay where it was painted, even though the copies
		// now live in a different clipping/scroll container. Read together, then write.
		const bounds = article.getBoundingClientRect();
		const scaleX = bounds.width / width, scaleY = bounds.height / height;
		const stickyPositions = Array.from(overlay.querySelectorAll<HTMLElement>('[data-utage-failure-sticky]')).map(element => {
			const original = stickyBounds[Number(element.dataset.utageFailureSticky)];
			const copied = element.getBoundingClientRect();
			return { element, x: (original.left - copied.left) / scaleX, y: (original.top - copied.top) / scaleY };
		});
		for (const { element, x, y } of stickyPositions) {
			const transform = element.style.transform === 'none' ? '' : element.style.transform;
			element.style.setProperty('transform', `translate(${x}px, ${y}px) ${transform}`, 'important');
			element.removeAttribute('data-utage-failure-sticky');
		}
		motionQuery.addEventListener('change', onMotionChange);
		doc.addEventListener('visibilitychange', onVisibilityChange);
		// Picker focus restoration and browser scroll anchoring are not user input.
		// The overlay is a child of the note and follows those automatic movements.
		doc.addEventListener('wheel', onScrollInput, { capture: true, passive: true });
		doc.addEventListener('touchmove', onScrollInput, { capture: true, passive: true });
		window.addEventListener('pagehide', cancel);
		window.addEventListener('resize', syncGeometry);
		root.addEventListener('pointerdown', cancel, true);
		root.addEventListener('keydown', cancel, true);
		nextTick(syncGeometry);
		if (typeof ResizeObserver !== 'undefined') {
			observer = new ResizeObserver(syncGeometry);
			observer.observe(article);
			observer.observe(root);
		}
		const start = performance.now();
		const tick = (now: number) => {
			if (finished) return;
			if (!article.isConnected || doc.hidden || now - start >= UTAGE_FAILURE_DURATION) { cancel(); return; }
			draw((now - start) / UTAGE_FAILURE_DURATION);
			frame = window.requestAnimationFrame(tick);
		};
		frame = window.requestAnimationFrame(tick);
		timer = window.setTimeout(cancel, UTAGE_FAILURE_DURATION + 100);
	} catch {
		// Decorative work must never prevent the authoritative failed state from rendering.
		cancel();
	}
	return cancel;
}

export function useUtageFailureMotion(options: Options): void {
	// The default pre-flush captures the running note before Vue paints its failure badge.
	// No immediate watch: loading a failed note or returning to LTL never replays it.
	watch([options.state, options.animationEnabled, options.article], ([state, enabled, article], [previous], onCleanup) => {
		const root = options.root.value;
		if (previous !== 'flashing' || state !== 'failed' || !enabled || !article || !root || window.document.hidden) return;
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		if (motionQuery.matches || !isVisible(article) || article.offsetWidth <= 0 || article.offsetHeight <= 0) return;
		onCleanup(play(root, article, options.failedText, motionQuery));
	});
}
