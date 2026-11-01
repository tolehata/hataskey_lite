/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** element をスクロールしている一番近い祖先。無ければ null（ページ全体＝window が動く） */
export function scrollParentOf(element: Element | null): HTMLElement | null {
	for (let current = element?.parentElement ?? null; current; current = current.parentElement) {
		const overflowY = getComputedStyle(current).overflowY;
		if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && current.scrollHeight > current.clientHeight) return current;
	}
	return null;
}

/**
 * 画面を切り替えたら先頭から見せる。前の画面のスクロール位置のまま中途半端な所に出るのを防ぐ。
 * すでに先頭なら何もしない。
 */
export function scrollToTop(element: Element | null): void {
	const parent = scrollParentOf(element);
	if (parent) { if (parent.scrollTop !== 0) parent.scrollTo({ top: 0, behavior: 'instant' }); return; }
	if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' });
}
