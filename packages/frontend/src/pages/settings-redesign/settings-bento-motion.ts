/* SPDX-License-Identifier: AGPL-3.0-only */

type BentoViewTransition = Pick<ViewTransition, 'ready' | 'finished' | 'updateCallbackDone' | 'skipTransition'> & {
	types?: { add(value: string): unknown };
};

/** Use native snapshots of the existing tiles; never duplicate a settings form. */
export function createSettingsBentoMotion(options: {
	enabled: () => boolean;
	nextTick: () => Promise<unknown>;
}) {
	let revision = 0;
	let active: BentoViewTransition | null = null;

	function cancel(discardPending = false): void {
		// Resizing or disabling motion skips only the animation. Leaving settings
		// or starting a newer navigation must also discard its pending callback.
		if (discardPending) revision++;
		const previous = active;
		active = null;
		previous?.skipTransition();
	}

	async function transition(update: () => void): Promise<void> {
		cancel(true);
		const current = revision;
		const updateState: { promise: Promise<void> | null } = { promise: null };
		const apply = (): Promise<void> => {
			// skipTransition() still runs its callback. A superseded route must not.
			if (current !== revision) return Promise.resolve();
			updateState.promise ??= (async () => {
				update();
				await options.nextTick();
			})();
			return updateState.promise;
		};

		if (!options.enabled() || typeof window.document.startViewTransition !== 'function') {
			await apply();
			return;
		}

		let native: BentoViewTransition;
		try {
			native = window.document.startViewTransition(apply);
		} catch {
			// A browser that cannot start a transition must still navigate once.
			await (updateState.promise ?? apply());
			return;
		}
		if (current === revision) {
			active = native;
		} else {
			native.skipTransition();
		}
		native.types?.add('settings-bento');
		void native.ready.catch(() => undefined);
		const release = () => { if (active === native) active = null; };
		void native.finished.then(release, release);

		try {
			// Focus and subsequent input need not wait for the decorative animation.
			await native.updateCallbackDone;
		} catch {
			// Preserve actual update errors, but recover a native failure that occurs
			// before it invokes the callback. Never replay a callback that already ran.
			await (updateState.promise ?? apply());
		}
	}

	return { transition, cancel };
}
