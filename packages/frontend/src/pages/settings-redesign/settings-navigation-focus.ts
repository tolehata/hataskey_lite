/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** An activation target must be unique before it may receive focus. */
export type ExactSettingsNavigationElement =
	| { state: 'missing' }
	| { state: 'ambiguous' }
	| { state: 'found'; element: HTMLElement };

type SettingsNavigationFocusOptions = {
	find: () => ExactSettingsNavigationElement;
	focus: (element: HTMLElement) => boolean;
	isCurrent: () => boolean;
	timeoutMs?: number;
};

export type SettingsNavigationFocusWaiter = {
	promise: Promise<boolean>;
	cancel: () => void;
};

/**
 * Wait for an exact destination to exist and verify focus before declaring a
 * navigation successful. This keeps a search overlay alive when a conditional
 * setting never mounts rather than dropping its keyboard origin onto the page.
 */
export function waitForSettingsNavigationFocus(options: SettingsNavigationFocusOptions): SettingsNavigationFocusWaiter {
	let observer: MutationObserver | null = null;
	let timeout: number | null = null;
	let complete = false;
	let resolvePromise: (result: boolean) => void = () => {};

	const promise = new Promise<boolean>(resolve => {
		resolvePromise = resolve;
	});
	const finish = (result: boolean) => {
		if (complete) return;
		complete = true;
		observer?.disconnect();
		if (timeout != null) window.clearTimeout(timeout);
		resolvePromise(result);
	};
	const attempt = () => {
		if (!options.isCurrent()) {
			finish(false);
			return true;
		}
		const result = options.find();
		if (result.state === 'missing') return false;
		if (result.state === 'ambiguous') {
			finish(false);
			return true;
		}
		finish(options.focus(result.element));
		return true;
	};

	if (!attempt()) {
		observer = new MutationObserver(() => { attempt(); });
		observer.observe(window.document.body, { childList: true, subtree: true });
		timeout = window.setTimeout(() => finish(false), options.timeoutMs ?? 2500);
		attempt();
	}

	return { promise, cancel: () => finish(false) };
}
