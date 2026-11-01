/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { RouterFlag } from '@/lib/nirax.js';

type NavigationHook = (fullPath: string, flag?: RouterFlag) => boolean;

export type SettingsSurfaceLeaveGuardRouter = {
	navHook: NavigationHook | null;
	getCurrentFullPath: () => string;
	pushByPath: (fullPath: string, flag?: RouterFlag | null) => void;
};

type PendingNavigation = {
	fullPath: string;
	flag?: RouterFlag;
};

export type SettingsSurfaceLeaveGuard = {
	install: () => void;
	dispose: () => void;
	/** Allows one shell-originated route retry after it already obtained discard consent. */
	allowNextNavigation: (fullPath: string) => void;
};

/**
 * Bridges an async discard confirmation into Nirax's synchronous `navHook`.
 *
 * The previous hook always runs first. A confirmation cancels the original
 * navigation, then retries exactly once after approval; this prevents both
 * discarded drafts and re-entrant confirmation loops.
 */
export function createSettingsSurfaceLeaveGuard({
	router,
	shouldBlockNavigation,
	shouldWarnBeforeUnload,
	requestDiscard,
}: {
	router: SettingsSurfaceLeaveGuardRouter;
	shouldBlockNavigation: (fullPath: string) => boolean;
	shouldWarnBeforeUnload: () => boolean;
	requestDiscard: () => Promise<boolean>;
}): SettingsSurfaceLeaveGuard {
	let previousNavHook: NavigationHook | null = null;
	let activeNavHook: NavigationHook | null = null;
	let installed = false;
	let confirmationRevision = 0;
	let confirmationInFlight = false;
	let pendingNavigation: PendingNavigation | null = null;
	let allowedNavigation: PendingNavigation | null = null;

	function queueNavigation(fullPath: string, flag?: RouterFlag): void {
		pendingNavigation = { fullPath, flag };
		if (confirmationInFlight) return;
		confirmationInFlight = true;
		const revision = ++confirmationRevision;
		void requestDiscard().then(approved => {
			if (!installed || revision !== confirmationRevision) return;
			const next = pendingNavigation;
			pendingNavigation = null;
			confirmationInFlight = false;
			if (!approved || next == null) return;
			allowedNavigation = next;
			router.pushByPath(next.fullPath, next.flag);
		}).catch(() => {
			if (!installed || revision !== confirmationRevision) return;
			// ⚠️確認に失敗したときに遷移を捨てると、画面が空のまま動かせなくなる。
			//   ここは通す。止めて詰むより害が小さい。
			const next = pendingNavigation;
			pendingNavigation = null;
			confirmationInFlight = false;
			if (next == null) return;
			allowedNavigation = next;
			router.pushByPath(next.fullPath, next.flag);
		});
	}

	function currentBrowserFullPath(): string {
		return `${window.location.pathname}${window.location.search}${window.location.hash}`;
	}

	function restoreBlockedPopstate(currentFullPath: string): void {
		// `popstate` is not cancelable. Keep the current entry visible without
		// invoking another popstate; approval retries through the normal hook.
		window.history.pushState(window.history.state, '', currentFullPath);
	}

	function onPopstate(event: PopStateEvent): void {
		const requested = currentBrowserFullPath();
		const current = router.getCurrentFullPath();
		if (requested === current) return;
		const upstreamCanceled = previousNavHook?.(requested) === true;
		if (!upstreamCanceled && !shouldBlockNavigation(requested)) return;
		event.stopImmediatePropagation();
		restoreBlockedPopstate(current);
		if (!upstreamCanceled) queueNavigation(requested);
	}

	function onBeforeUnload(event: BeforeUnloadEvent): void {
		if (!shouldWarnBeforeUnload()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	function install(): void {
		if (installed) return;
		// A cached page can keep this hook in its own chain after disposal.
		// Give each installation an immutable predecessor; reusing the old
		// closure would turn settings -> studio -> settings into A -> B -> A.
		const predecessor = router.navHook;
		const navHook: NavigationHook = (fullPath, flag) => {
			if (!installed || activeNavHook !== navHook) return predecessor?.(fullPath, flag) ?? false;
			const isAllowed = allowedNavigation?.fullPath === fullPath;
			// An upstream rejection must not leave a stale one-time allowance.
			if (isAllowed) allowedNavigation = null;
			if (predecessor?.(fullPath, flag) === true) return true;
			if (isAllowed || !shouldBlockNavigation(fullPath)) return false;
			queueNavigation(fullPath, flag);
			return true;
		};
		installed = true;
		previousNavHook = predecessor;
		activeNavHook = navHook;
		router.navHook = navHook;
		window.addEventListener('popstate', onPopstate, true);
		window.addEventListener('beforeunload', onBeforeUnload);
	}

	function dispose(): void {
		if (!installed) return;
		installed = false;
		++confirmationRevision;
		confirmationInFlight = false;
		pendingNavigation = null;
		allowedNavigation = null;
		if (router.navHook === activeNavHook) router.navHook = previousNavHook;
		activeNavHook = null;
		previousNavHook = null;
		window.removeEventListener('popstate', onPopstate, true);
		window.removeEventListener('beforeunload', onBeforeUnload);
	}

	return {
		install,
		dispose,
		allowNextNavigation(fullPath: string): void {
			allowedNavigation = { fullPath };
		},
	};
}
