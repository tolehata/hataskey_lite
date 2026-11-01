/* SPDX-License-Identifier: AGPL-3.0-only */

import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';

const anchorSelector = '[data-settings-section-anchor]';
const navigationOffset = 76;

export interface SettingsSectionAnchor {
	id: string;
	label: string;
	icon: string;
	element: HTMLElement;
}

/** Only explicit headings in this settings surface participate in navigation. */
export function collectSettingsSectionAnchors(content: HTMLElement): SettingsSectionAnchor[] {
	const visibility = new Map<HTMLElement, boolean>();

	function visible(element: HTMLElement): boolean {
		const cached = visibility.get(element);
		if (cached != null) return cached;
		const style = window.getComputedStyle(element);
		const result = !element.hidden && element.getAttribute('aria-hidden') !== 'true'
			&& style.display !== 'none' && style.visibility !== 'hidden'
			&& (element === content || element.parentElement == null || visible(element.parentElement));
		visibility.set(element, result);
		return result;
	}

	return [...content.querySelectorAll<HTMLElement>(anchorSelector)].flatMap(element => {
		const { settingsSectionAnchor: id, settingsSectionLabel: label, settingsSectionIcon: icon } = element.dataset;
		return id && label && icon && visible(element) ? [{ id, label, icon, element }] : [];
	});
}

/** Count each section's visible body, excluding bodies owned by nested sections. */
export function mostVisibleSettingsSection(anchors: readonly SettingsSectionAnchor[], root: HTMLElement, currentId: string | null): string | null {
	const viewport = root.getBoundingClientRect();
	const top = viewport.top + navigationOffset;
	const bottom = viewport.bottom;
	const rectangles = new Map(anchors.map(anchor => [anchor.element, anchor.element.getBoundingClientRect()]));
	const parents = new Map(anchors.map(anchor => [anchor.element, anchor.element.parentElement?.closest<HTMLElement>(anchorSelector) ?? null]));
	let best = currentId;
	let bestHeight = 0;
	for (const anchor of anchors) {
		const rect = rectangles.get(anchor.element);
		if (rect == null || rect.width <= 0 || rect.height <= 0) continue;
		const start = Math.max(top, rect.top);
		const end = Math.min(bottom, rect.bottom);
		const childRanges = anchors.filter(candidate => parents.get(candidate.element) === anchor.element)
			.map(candidate => rectangles.get(candidate.element))
			.filter((child): child is DOMRect => child != null && child.width > 0 && child.height > 0)
			.map(child => [Math.max(start, child.top), Math.min(end, child.bottom)] as const)
			.filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
		let visibleHeight = Math.max(0, end - start);
		let coveredUntil = start;
		for (const [from, to] of childRanges) {
			visibleHeight -= Math.max(0, to - Math.max(from, coveredUntil));
			coveredUntil = Math.max(coveredUntil, to);
		}
		if (visibleHeight > bestHeight || (visibleHeight > 0 && visibleHeight === bestHeight && anchor.id === currentId)) {
			best = anchor.id;
			bestHeight = visibleHeight;
		}
	}
	return best;
}

export function useSettingsSectionNavigation(options: {
	content: Readonly<Ref<HTMLElement | null>>;
	scrollRoot: Readonly<Ref<HTMLElement | null>>;
	enabled: Readonly<Ref<boolean>>;
	categoryId: Readonly<Ref<string | null>>;
	motionEnabled: Readonly<Ref<boolean>>;
}) {
	const anchors = shallowRef<SettingsSectionAnchor[]>([]);
	const activeId = ref<string | null>(null);
	const activated = ref(true);
	let dispose: (() => void) | undefined;
	let clickedId: string | null = null;
	let manualScrollTop: number | undefined;
	let inputTimer: number | undefined;

	function clearJump(): void {
		clickedId = null;
		manualScrollTop = undefined;
		window.clearTimeout(inputTimer);
		inputTimer = undefined;
	}

	/** Also used when the shell forwards a header wheel event into this pane. */
	function notifyManualScroll(root: HTMLElement): void {
		if (clickedId == null || root !== options.scrollRoot.value) return;
		manualScrollTop = root.scrollTop;
		window.clearTimeout(inputTimer);
		// An input that did not move this pane must not unlock a later layout shift.
		inputTimer = window.setTimeout(() => { manualScrollTop = undefined; inputTimer = undefined; }, 200);
	}

	function syncActive(): void {
		const root = options.scrollRoot.value;
		if (!activated.value || !options.enabled.value || root == null) return;
		// A short section may never win the visibility vote, even at its destination.
		// Keep the clicked item through smooth scrolling, clamping and layout changes.
		if (clickedId != null) {
			if (manualScrollTop == null || Math.abs(root.scrollTop - manualScrollTop) < 1) return;
			clearJump();
		}
		activeId.value = mostVisibleSettingsSection(anchors.value, root, activeId.value);
	}

	function stop(): void {
		dispose?.();
		dispose = undefined;
		clearJump();
	}

	watch([options.content, options.scrollRoot, options.enabled, options.categoryId, activated], ([content, root, enabled, category], previous) => {
		stop();
		if (category !== previous[3]) activeId.value = null;
		anchors.value = [];
		if (!enabled || !activated.value || content == null || root == null) return;
		let disposed = false;
		let queued = false;
		let intersection: IntersectionObserver | undefined;
		let mutation: MutationObserver | undefined;
		let resize: ResizeObserver | undefined;
		let touchPosition: { x: number; y: number } | undefined;

		function canScroll(element: HTMLElement, delta: number): boolean {
			return delta < 0 ? element.scrollTop > 0 : element.scrollTop < element.scrollHeight - element.clientHeight - 1;
		}

		function isPaneScroll(target: EventTarget | null, delta: number): boolean {
			if (root == null || !canScroll(root, delta)) return false;
			let element = target instanceof HTMLElement ? target : null;
			while (element != null && element !== root) {
				if (/^(auto|scroll|overlay)$/.test(window.getComputedStyle(element).overflowY) && canScroll(element, delta)) return false;
				element = element.parentElement;
			}
			return true;
		}

		function onWheel(event: WheelEvent): void {
			if (event.defaultPrevented || event.ctrlKey || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
			if (root != null && isPaneScroll(event.target, event.deltaY)) notifyManualScroll(root);
		}

		function onTouchStart(event: TouchEvent): void {
			const touch = event.touches.length === 1 ? event.touches[0] : undefined;
			touchPosition = touch == null ? undefined : { x: touch.clientX, y: touch.clientY };
		}

		function onTouchMove(event: TouchEvent): void {
			const touch = event.touches.length === 1 ? event.touches[0] : undefined;
			const previousTouch = touchPosition;
			touchPosition = touch == null ? undefined : { x: touch.clientX, y: touch.clientY };
			if (event.defaultPrevented || touch == null || previousTouch == null) return;
			const dx = Math.abs(touch.clientX - previousTouch.x);
			const delta = previousTouch.y - touch.clientY;
			if (Math.abs(delta) > dx && root != null && isPaneScroll(event.target, delta)) notifyManualScroll(root);
		}

		function onKeyDown(event: KeyboardEvent): void {
			if (event.defaultPrevented || event.altKey || event.metaKey) return;
			if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
			if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="listbox"], [role="combobox"]')) return;
			if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, [role="button"]')) return;
			const delta = ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 1;
			if (root != null && isPaneScroll(event.target, delta)) notifyManualScroll(root);
		}

		function onPointerDown(event: PointerEvent): void {
			if (root == null || event.target !== root || event.button !== 0) return;
			const left = root.getBoundingClientRect().left;
			// Only the vertical scrollbar gutter; tapping the form is not scrolling.
			if (event.clientX < left + root.clientLeft || event.clientX >= left + root.clientLeft + root.clientWidth) {
				notifyManualScroll(root);
				window.clearTimeout(inputTimer);
				inputTimer = undefined;
				window.addEventListener('pointerup', endScrollbarDrag);
				window.addEventListener('pointercancel', endScrollbarDrag);
			}
		}

		function endScrollbarDrag(): void {
			window.removeEventListener('pointerup', endScrollbarDrag);
			window.removeEventListener('pointercancel', endScrollbarDrag);
			syncActive();
			manualScrollTop = undefined;
		}

		function collect(): void {
			if (disposed || content == null || root == null) return;
			const next = collectSettingsSectionAnchors(content);
			if (next.length === anchors.value.length && next.every((anchor, index) => {
				const before = anchors.value[index];
				return anchor.element === before.element && anchor.id === before.id && anchor.label === before.label && anchor.icon === before.icon;
			})) return;
			anchors.value = next;
			if (!next.some(anchor => anchor.id === clickedId)) clearJump();
			if (!next.some(anchor => anchor.id === activeId.value)) activeId.value = next[0]?.id ?? null;
			intersection?.disconnect();
			if (typeof IntersectionObserver !== 'undefined') {
				intersection = new IntersectionObserver(syncActive, {
					root, rootMargin: `-${navigationOffset}px 0px 0px 0px`,
					threshold: [0, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
				});
				for (const anchor of next) intersection.observe(anchor.element);
			}
			syncActive();
		}

		function scheduleCollect(): void {
			if (queued || disposed) return;
			queued = true;
			void nextTick(() => { queued = false; collect(); });
		}

		if (typeof MutationObserver !== 'undefined') {
			mutation = new MutationObserver(scheduleCollect);
			mutation.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'data-settings-section-anchor', 'data-settings-section-label', 'data-settings-section-icon'] });
		}
		if (typeof ResizeObserver !== 'undefined') {
			resize = new ResizeObserver(() => { scheduleCollect(); syncActive(); });
			resize.observe(root);
			resize.observe(content);
		}
		root.addEventListener('scroll', syncActive, { passive: true });
		root.addEventListener('wheel', onWheel, { passive: true });
		root.addEventListener('touchstart', onTouchStart, { passive: true });
		root.addEventListener('touchmove', onTouchMove, { passive: true });
		root.addEventListener('keydown', onKeyDown);
		root.addEventListener('pointerdown', onPointerDown, { passive: true });
		dispose = () => {
			disposed = true;
			intersection?.disconnect();
			mutation?.disconnect();
			resize?.disconnect();
			root.removeEventListener('scroll', syncActive);
			root.removeEventListener('wheel', onWheel);
			root.removeEventListener('touchstart', onTouchStart);
			root.removeEventListener('touchmove', onTouchMove);
			root.removeEventListener('keydown', onKeyDown);
			root.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointerup', endScrollbarDrag);
			window.removeEventListener('pointercancel', endScrollbarDrag);
		};
		collect();
	}, { immediate: true, flush: 'post' });

	function select(id: string): void {
		const root = options.scrollRoot.value;
		const target = anchors.value.find(anchor => anchor.id === id)?.element;
		if (!activated.value || !options.enabled.value || root == null || target == null || !root.isConnected) return;
		clearJump();
		activeId.value = id;
		clickedId = id;
		const smooth = options.motionEnabled.value;
		const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - navigationOffset;
		target.focus({ preventScroll: true });
		root.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
	}

	onActivated(() => { activated.value = true; });
	onDeactivated(() => { activated.value = false; stop(); });
	onBeforeUnmount(stop);
	return { items: computed(() => anchors.value.map(({ id, label, icon }) => ({ id, label, icon }))), activeId, select, notifyManualScroll };
}
