/* SPDX-License-Identifier: AGPL-3.0-only */

/** Scroll only the dialog body; scrollIntoView can displace its fixed header. */
export function revealHatagoesSetting(root: HTMLElement | undefined, section: string | undefined): void {
	if (!root || !section) return;
	const target = [...root.querySelectorAll<HTMLElement>('[data-hatagoes-setting]')].find(element => element.dataset.hatagoesSetting === section);
	if (!target) return;
	for (let container = target.parentElement; container; container = container.parentElement) {
		if (!['auto', 'scroll'].includes(getComputedStyle(container).overflowY) || container.scrollHeight <= container.clientHeight) continue;
		const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12;
		container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
		break;
	}
	target.tabIndex = -1;
	target.focus({ preventScroll: true });
}
