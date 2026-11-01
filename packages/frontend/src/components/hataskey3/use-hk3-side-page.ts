/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, ref, watch } from 'vue';

type SidePageRouter = {
	getCurrentFullPath(): string;
	pushByPath(path: string): void;
};

/** Return the actual route only when Nirax accepted a sidebar navigation. */
export function pushAcceptedSidePage(router: SidePageRouter, to: string): string | undefined {
	const before = router.getCurrentFullPath();
	router.pushByPath(to);
	const actual = router.getCurrentFullPath();
	return actual !== before || actual === to ? actual : undefined;
}

export function useHk3SidePage(options: {
	router: SidePageRouter;
	currentRoute: () => unknown;
	isHome: () => boolean;
	isMobile: () => boolean;
	isDesktopDeck: () => boolean;
}) {
	const session = ref(false);
	const expanded = ref(false);
	const split = computed(() => session.value && !options.isHome() && !options.isMobile() && !expanded.value && !options.isDesktopDeck());
	const timelineVisible = computed(() => options.isHome() || split.value);
	const mode = computed<'home' | 'split' | 'full'>(() => options.isHome() ? 'home' : split.value ? 'split' : 'full');
	// Only routes reached while the pane was open may be restored by browser history.
	const knownModes = new Map<string, 'split' | 'full'>();

	function remember(fullPath: string) {
		knownModes.delete(fullPath);
		knownModes.set(fullPath, expanded.value || options.isMobile() ? 'full' : 'split');
		if (knownModes.size > 32) knownModes.delete(knownModes.keys().next().value!);
	}

	function sidebarNavigated(actualFullPath?: string): boolean {
		if (!actualFullPath || actualFullPath !== options.router.getCurrentFullPath() || options.isHome() || options.isDesktopDeck()) return false;
		session.value = true;
		expanded.value = options.isMobile();
		remember(actualFullPath);
		return true;
	}

	function toggle(): boolean {
		if (!session.value || options.isMobile()) return false;
		expanded.value = !expanded.value;
		remember(options.router.getCurrentFullPath());
		return true;
	}

	function restoreForComposer(adopt: () => boolean): boolean {
		if (!session.value || options.isMobile() || !expanded.value) return false;
		if (!adopt()) return false;
		return toggle();
	}

	function close(): boolean {
		options.router.pushByPath('/');
		if (!options.isHome()) return false;
		session.value = false;
		expanded.value = false;
		return true;
	}

	function restoreOnPopstate() {
		// The global router listener updates its route before this handler runs.
		if (options.isHome() || options.isDesktopDeck()) {
			session.value = false;
			expanded.value = false;
			return;
		}
		const savedMode = knownModes.get(options.router.getCurrentFullPath());
		session.value = savedMode != null;
		expanded.value = savedMode === 'full';
	}

	watch(options.currentRoute, () => {
		if (options.isHome()) {
			session.value = false;
			expanded.value = false;
		} else if (session.value) remember(options.router.getCurrentFullPath());
	});

	return { session, expanded, split, timelineVisible, mode, sidebarNavigated, toggle, restoreForComposer, close, restoreOnPopstate };
}
