/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HataFeedTutorialKind } from '@/utility/hatafeed-tutorial-content.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { completeHataFeedTutorial, loadHataFeedTutorialKind } from '@/utility/hatafeed-tutorial.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';

let active: { isActive: () => boolean; stop: () => void } | null = null;
// Skip/close should not repeatedly interrupt tab changes in the same session.
const offered = new Set<string>();

export async function showHataFeedTutorial(options: {
	isActive: () => boolean;
	replay?: boolean;
	kind?: HataFeedTutorialKind;
	isStaff?: boolean;
	hasExistingActivity?: boolean;
	anchorElement?: HTMLElement | null;
	popup?: typeof os.popup;
}): Promise<(() => void) | undefined> {
	const owner = $i;
	if (active && !active.isActive()) { active.stop(); active = null; }
	if (!owner || active || !options.isActive() || (!options.replay && offered.has(owner.id))) return;
	const id = owner.id, token = owner.token;
	const cancellation = new AbortController();
	const sameAccount = () => $i?.id === id && $i.token === token;
	const canOpen = () => !cancellation.signal.aborted && options.isActive() && sameAccount();
	// A slow first-visit read must not cover a composer or draft confirmation
	// the user has already opened. Settings replay intentionally overlays settings.
	const canPresent = () => canOpen() && (options.replay === true || os.popups.value.length === 0);
	const stop = () => cancellation.abort();
	const ticket = { isActive: canOpen, stop };
	active = ticket;
	const release = () => { if (active === ticket) active = null; };
	try {
		const kind = options.replay ? (options.kind ?? 'initial') : await loadHataFeedTutorialKind(options.hasExistingActivity);
		if (!kind || !canPresent()) { release(); return; }
		const component = (await import('@/components/HataFeedTutorial.vue')).default;
		if (!canPresent()) { release(); return; }
		let completed = false, disposed = false;
		let dispose = () => {};
		const popup = (options.popup ?? os.popup)(component, { kind, isStaff: options.isStaff, anchorElement: options.anchorElement, cancelSignal: cancellation.signal }, {
			done: async () => {
				if (completed || disposed || options.replay || !canOpen()) return;
				completed = true;
				try { await completeHataFeedTutorial(); } catch { if (sameAccount()) hataFeedNotify('案内の確認状況を保存できませんでした'); }
			},
			closed: () => {
				if (disposed) return;
				disposed = true;
				dispose();
				release();
			},
		});
		dispose = popup.dispose;
		if (!options.replay) offered.add(id);
		return stop;
	} catch {
		release();
		if (options.replay && canOpen()) hataFeedNotify('チュートリアルを開けませんでした');
		return;
	}
}
