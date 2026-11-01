/* SPDX-License-Identifier: AGPL-3.0-only */
import { nextTick } from 'vue';
import type { NoteActionConfirmation } from '@/utility/note-action-confirmation.js';

type Composer = {
	readonly canConfirm: boolean;
	readonly confirmationActive: boolean;
	openConfirmation: (request: NoteActionConfirmation) => boolean;
	cancelConfirmation: () => void;
};

/** Wait for the originating menu to release its focus trap before opening the inline dialog. */
export function createHk3NoteConfirmationHost(options: {
	composer: () => Composer | null;
	available: () => boolean;
	beforeOpen: () => void;
}) {
	let revision = 0;
	let pending = false;
	let owner: Composer | null = null;
	return {
		offer(request: NoteActionConfirmation): boolean {
			const composer = options.composer();
			if (pending || composer?.confirmationActive) return true;
			if (!options.available() || !composer?.canConfirm) return false;
			owner = composer;
			pending = true;
			const ticket = ++revision;
			void nextTick(async () => {
				await nextTick();
				if (ticket !== revision) return;
				pending = false;
				if (composer !== options.composer() || !options.available() || !composer.canConfirm) return;
				options.beforeOpen();
				composer.openConfirmation(request);
			});
			return true;
		},
		cancel() {
			revision++;
			pending = false;
			owner?.cancelConfirmation();
			owner = null;
		},
	};
}
