/* SPDX-License-Identifier: AGPL-3.0-only */
import { watch } from 'vue';
import type { Ref } from 'vue';

/** Keep the audience row below the rendered decorations of its preceding avatar. */
export function useHk3AvatarClearance(root: Ref<HTMLElement | null>) {
	watch(root, (row, _previous, onCleanup) => {
		if (!row) return;
		const element = row;
		const sibling = element.previousElementSibling;
		element.style.marginTop = '8px';
		if (!sibling) return;
		const avatar = sibling;

		let frame: number | null = null;
		let active = true;
		let decorations: HTMLImageElement[] = [];
		const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
		const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);

		function schedule() {
			if (!active || frame !== null) return;
			frame = requestAnimationFrame(measure);
		}

		function visible(element: Element) {
			if (element.getClientRects().length === 0) return false;
			const style = getComputedStyle(element);
			return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.opacity !== '0';
		}

		function measure() {
			frame = null;
			if (!active) return;
			const images = Array.from(avatar.querySelectorAll<HTMLImageElement>('img[data-avatar-decoration]'));
			if (images.length !== decorations.length || images.some((img, index) => img !== decorations[index])) {
				decorations = images;
				resizeObserver?.disconnect();
				resizeObserver?.observe(avatar);
				for (const img of decorations) resizeObserver?.observe(img);
			}

			let clearance = 0;
			if (visible(element) && visible(avatar)) {
				const avatarBottom = avatar.getBoundingClientRect().bottom;
				for (const img of decorations) {
					if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0 || !visible(img)) continue;
					clearance = Math.max(clearance, img.getBoundingClientRect().bottom - avatarBottom);
				}
			}
			element.style.marginTop = `${8 + clearance}px`;
		}

		resizeObserver?.observe(avatar);
		mutationObserver?.observe(avatar, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class', 'src', 'srcset', 'hidden', 'data-avatar-decoration'],
		});
		avatar.addEventListener('load', schedule, true);
		avatar.addEventListener('error', schedule, true);
		schedule();

		onCleanup(() => {
			active = false;
			if (frame !== null) cancelAnimationFrame(frame);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			avatar.removeEventListener('load', schedule, true);
			avatar.removeEventListener('error', schedule, true);
		});
	}, { immediate: true, flush: 'post' });
}
