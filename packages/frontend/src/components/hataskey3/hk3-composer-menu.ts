/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CSSProperties, Ref } from 'vue';
import { prefer } from '@/preferences.js';

export type Hk3ComposerMenuAppearance = 'uiS-composer';
export const HK3_COMPOSER_MENU_SELECTOR = '[data-hk3-composer-menus]';
const owners = new WeakMap<HTMLElement, { count: Ref<number>; theme?: Ref<Record<string, string>> }>();

export function registerHk3ComposerMenus(owner: HTMLElement, count: Ref<number>, theme?: Ref<Record<string, string>>) {
	owners.set(owner, { count, theme });
	return () => owners.delete(owner);
}

/** Capture before nextTick: an inline tool's anchor can disappear while opening. */
export function captureHk3ComposerMenu(anchor: HTMLElement | null) {
	if (!anchor?.closest(HK3_COMPOSER_MENU_SELECTOR)) return undefined;
	const style = window.getComputedStyle(anchor);
	const palette: CSSProperties = { fontFamily: style.fontFamily };
	for (const name of Array.from(style)) {
		if (name.startsWith('--hk3-')) palette[name as `--${string}`] = style.getPropertyValue(name).trim();
	}
	const owner = owners.get(anchor.closest<HTMLElement>(HK3_COMPOSER_MENU_SELECTOR)!);
	const count = owner?.count;
	if (count) count.value++;
	let released = false;
	return {
		style: computed<CSSProperties>(() => ({
			...palette,
			// Popups live outside Hk3App; keep its provided palette reactive.
			...owner?.theme?.value,
		})),
		release: () => {
			if (released) return;
			released = true;
			if (count) count.value--;
		},
	};
}

/** OS preference and the app's animation switch both disable composer menu motion. */
export function useHk3ComposerMenuReducedMotion() {
	const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	const systemReduced = ref(media?.matches ?? false);
	const update = () => { systemReduced.value = media?.matches ?? false; };
	onMounted(() => media?.addEventListener('change', update));
	onBeforeUnmount(() => media?.removeEventListener('change', update));
	return computed(() => !prefer.r.animation.value || systemReduced.value);
}
