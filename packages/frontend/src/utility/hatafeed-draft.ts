/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, inject, nextTick, ref, shallowRef } from 'vue';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hataFeedDraftPromptOpen, hataFeedNotify } from '@/utility/hatafeed-ui.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

let openPrompts = 0;
export function useHataFeedDraft<T>(options: {
	id: string;
	capture: () => T;
	restore: (value: T) => void;
	isMeaningful: (value: T) => boolean;
	busy?: () => boolean;
}) {
	const popup = useHataGoesPopup();
	const host = inject(HATA_GOES_HOST, null);
	const offered = shallowRef<T | null>(null);
	const prompt = ref(false);
	let completed = false;
	const draft = useHataFormDraft<T>({ ...options, autoSave: false, restore: value => { offered.value = value; }, onPreserveFailure: () => hataFeedNotify('下書きを保存できませんでした') });

	function resumeDraft() {
		if (offered.value == null) return;
		options.restore(offered.value);
		offered.value = null;
	}

	function clearDraft(clearOptions?: { resume?: boolean }) {
		const cleared = draft.clearDraft(clearOptions);
		if (cleared) { offered.value = null; completed = !clearOptions?.resume; }
		return cleared;
	}

	// A successful server operation must not be submitted again when local storage fails.
	function finishSubmission(finishOptions?: { resume?: boolean }) {
		const cleared = draft.clearDraft(finishOptions);
		completed = !finishOptions?.resume;
		offered.value = null;
		draft.resetBaseline();
		if (!cleared) hataFeedNotify('送信は完了しましたが、端末の下書きを削除できませんでした');
	}

	async function beforeClose(): Promise<boolean> {
		if (completed) return true;
		if (options.busy?.() || prompt.value) return false;
		if (!draft.hasChanges()) return true;
		const focus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
		prompt.value = true;
		hataFeedDraftPromptOpen.value = ++openPrompts > 0;
		let leaving = false;
		try {
			const component = (await import('@/components/HataFeedDraftPrompt.vue')).default;
			if (host && !host.active.value) return false;
			const result = await new Promise<boolean>(resolve => {
				const { dispose } = popup(component, { save: () => {
					const saved = draft.saveDraft();
					if (saved) hataFeedNotify('端末に下書きを保存しました');
					return saved;
				}, discard: clearDraft, returnFocusTo: focus }, {
					done: (leave: boolean) => resolve(leave),
					closed: () => { resolve(false); dispose(); },
				});
			});
			leaving = result;
			return result;
		} finally {
			prompt.value = false;
			hataFeedDraftPromptOpen.value = --openPrompts > 0;
			if (!leaving) { await nextTick(); focus?.focus({ preventScroll: true }); }
		}
	}

	return { ...draft, clearDraft, finishSubmission, beforeClose, prompt, hasDraft: computed(() => offered.value != null), resumeDraft };
}
