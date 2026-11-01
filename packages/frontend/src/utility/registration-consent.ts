/* SPDX-License-Identifier: AGPL-3.0-only */
import { scrollToTop as scrollRegistrationToTop } from '@@/js/scroll.js';

export type RegistrationDocument = { configured: boolean; url?: string };

export function focusRegistrationElement(element: HTMLElement | null | undefined, options: { scrollToTop?: boolean } = {}): void {
	if (!element?.isConnected) return;
	let ancestor: HTMLElement | null = element;
	while (ancestor) {
		if (ancestor.hidden || ancestor.inert || ancestor.style.display === 'none' || ancestor.ownerDocument.defaultView?.getComputedStyle(ancestor).display === 'none') return;
		ancestor = ancestor.parentElement;
	}
	element.focus({ preventScroll: true });
	if (options.scrollToTop) scrollRegistrationToTop(element, { behavior: 'instant' });
}

export function registrationDocument(value: string | null | undefined, origin: string): RegistrationDocument {
	if (value && /[\u0000-\u001f\u007f]/.test(value)) return { configured: true };
	if (!value?.trim()) return { configured: false };
	try {
		const url = new URL(value.trim(), origin);
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { configured: true };
		return { configured: true, url: url.href };
	} catch {
		return { configured: true };
	}
}

export function updateRegistrationConsent(current: boolean[], index: number, value: boolean, permitted: boolean): boolean[] {
	if (index < 0 || index >= current.length || (value && (!permitted || current.slice(0, index).some(item => !item)))) return current;
	return current.map((item, position) => position === index ? value : position > index && !value ? false : item);
}
