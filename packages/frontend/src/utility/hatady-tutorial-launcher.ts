/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyTutorialKind } from '@/utility/hatady-tutorial.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { claimAchievement } from '@/utility/achievements.js';
import { completeHatadyTutorial, loadHatadyTutorialKind } from '@/utility/hatady-tutorial.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';

let activeGuide: { isActive: () => boolean; stop: () => void } | null = null;

/** Both entry points share the modal lifecycle; a settings replay only displays it. */
export async function showHatadyTutorial(options: {
	isActive: () => boolean;
	replay?: boolean;
	kind?: HatadyTutorialKind;
	anchorElement?: HTMLElement | null;
	popup?: typeof os.popup;
}): Promise<(() => void) | undefined> {
	const account = $i;
	if (activeGuide && !activeGuide.isActive()) {
		activeGuide.stop();
		activeGuide = null;
	}
	if (!account || activeGuide || !options.isActive()) return;
	const id = account.id, token = account.token;
	const cancellation = new AbortController();
	const sameAccount = () => $i?.id === id && $i.token === token;
	const canOpen = () => !cancellation.signal.aborted && options.isActive() && sameAccount();
	const stop = () => cancellation.abort();
	const ticket = { isActive: canOpen, stop };
	activeGuide = ticket;
	const release = () => { if (activeGuide === ticket) activeGuide = null; };
	try {
		const kind = options.replay ? (options.kind ?? 'initial') : await loadHatadyTutorialKind();
		if (!kind || !canOpen()) { release(); return; }
		const component = (await import('@/components/HatadyTutorial.vue')).default;
		if (!canOpen()) { release(); return; }
		let completed = false;
		let disposed = false;
		let dispose = () => {};
		const onClosed = () => {
			if (disposed) return;
			disposed = true;
			dispose();
			release();
		};
		const popup = (options.popup ?? os.popup)(component, { kind, anchorElement: options.anchorElement, cancelSignal: cancellation.signal }, {
			done: async () => {
				if (completed || disposed || options.replay || !canOpen()) return;
				completed = true;
				try {
					await completeHatadyTutorial(kind);
					if (kind === 'initial' && sameAccount()) await claimAchievement('welcomeToHatady');
				} catch {
					if (sameAccount()) hatadyNotify('案内の確認状況を保存できませんでした');
				}
			},
			closed: onClosed,
		});
		dispose = popup.dispose;
		return stop;
	} catch {
		// A failed read/import must not open an initial guide or change saved state.
		release();
		return;
	}
}
