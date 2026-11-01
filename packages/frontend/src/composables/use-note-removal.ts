/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { nextTick, onBeforeUnmount } from 'vue';
import { prefer } from '@/preferences.js';

/** Shrink only rows explicitly removed by a noteDeleted event. */
export function useNoteRemoval(list: () => HTMLElement | null) {
	const pending = new Map<string, (cancelled?: boolean) => void>();

	function cancelAll() {
		for (const cancel of pending.values()) cancel(true);
		pending.clear();
	}

	function remove(id: string, commit: () => void) {
		const parent = list();
		const row = Array.from(parent?.children ?? []).find((child): child is HTMLElement =>
			child instanceof HTMLElement && child.dataset.noteRemovalId === id);
		removeElement(id, row, commit);
	}

	function removeElement(id: string, row: HTMLElement | undefined | null, commit: () => void) {
		if (pending.has(id)) return;
		const parent = row?.parentElement;
		if (!row || !row.isConnected || !prefer.s.animation ||
			(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
			typeof row.animate !== 'function' || row.offsetHeight <= 0) {
			if (row) row.dataset.noteRemovalCollapsed = '';
			commit();
			return;
		}

		const style = window.getComputedStyle(row);
		const remaining = parent ? Array.from(parent.children).filter(child => child !== row && !child.hasAttribute('data-note-removal-pending')).length : 0;
		const gap = remaining > 0 && parent ? parseFloat(window.getComputedStyle(parent).rowGap) || 0 : 0;
		const px = (value: string) => `${parseFloat(value) || 0}px`;
		const before = {
			height: `${row.offsetHeight}px`,
			paddingTop: px(style.paddingTop), paddingBottom: px(style.paddingBottom),
			borderTopWidth: px(style.borderTopWidth), borderBottomWidth: px(style.borderBottomWidth),
			marginTop: px(style.marginTop), marginBottom: px(style.marginBottom),
			opacity: style.opacity,
			clipPath: 'inset(0 0 0 0)',
		};
		const after = {
			...before,
			height: '0px', paddingTop: '0px', paddingBottom: '0px',
			borderTopWidth: '0px', borderBottomWidth: '0px',
			marginTop: '0px', marginBottom: `${-gap}px`,
			opacity: '0', clipPath: 'inset(50% 0 50% 0)',
		};
		const old = { overflow: row.style.overflow, minHeight: row.style.minHeight, boxSizing: row.style.boxSizing, inert: row.inert };
		row.inert = true;
		row.dataset.noteRemovalPending = '';
		row.style.overflow = 'hidden';
		row.style.minHeight = '0';
		row.style.boxSizing = 'border-box';

		let animation: Animation;
		try {
			animation = row.animate([before, after], { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
		} catch {
			delete row.dataset.noteRemovalPending;
			row.inert = old.inert;
			row.style.overflow = old.overflow;
			row.style.minHeight = old.minHeight;
			row.style.boxSizing = old.boxSizing;
			row.dataset.noteRemovalCollapsed = '';
			commit();
			return;
		}
		const cleanup = (cancelled = false) => {
			pending.delete(id);
			animation.cancel();
			delete row.dataset.noteRemovalPending;
			if (cancelled) delete row.dataset.noteRemovalCollapsed;
			row.inert = old.inert;
			row.style.overflow = old.overflow;
			row.style.minHeight = old.minHeight;
			row.style.boxSizing = old.boxSizing;
		};
		pending.set(id, cleanup);
		animation.finished.then(async () => {
			if (pending.get(id) !== cleanup) return;
			if (row.isConnected && row.parentElement === parent) {
				row.dataset.noteRemovalCollapsed = '';
				commit();
			}
			await nextTick();
			if (pending.get(id) === cleanup) cleanup();
		}, async () => {
			if (pending.get(id) !== cleanup) return;
			if (row.isConnected && row.parentElement === parent) {
				row.dataset.noteRemovalCollapsed = '';
				commit();
			}
			await nextTick();
			if (pending.get(id) === cleanup) cleanup();
		});
	}

	onBeforeUnmount(cancelAll);
	return { remove, removeElement, cancelAll };
}
