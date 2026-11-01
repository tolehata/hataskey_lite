/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref, WatchStopHandle } from 'vue';
import { $i } from '@/i.js';
import { miLocalStorage } from '@/local-storage.js';
import { HATA_GOES_POPUP_SCOPE, HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';

type StoredDraft = {
	version: 1;
	updatedAt: number;
	data: unknown;
};

type DraftStore = Record<string, StoredDraft>;

const DRAFT_TTL = 1000 * 60 * 60 * 24 * 30;
const MAX_DRAFTS = 32;

function storageKey(): `hataFormDrafts:${string}` {
	return `hataFormDrafts:${$i?.id ?? 'anonymous'}`;
}

function readStore(key: `hataFormDrafts:${string}`): DraftStore | null {
	try {
		const parsed = miLocalStorage.getItemAsJson(key);
		if (parsed == null) return {};
		if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		const now = Date.now();
		return Object.fromEntries(Object.entries(parsed as DraftStore).filter(([, draft]) => (
			draft?.version === 1 && typeof draft.updatedAt === 'number' && now - draft.updatedAt <= DRAFT_TTL
		)));
	} catch {
		return null;
	}
}

function writeStore(key: `hataFormDrafts:${string}`, store: DraftStore): boolean {
	try {
		const entries = Object.entries(store)
			.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
			.slice(0, MAX_DRAFTS);
		miLocalStorage.setItemAsJson(key, Object.fromEntries(entries));
		return true;
	} catch {
		return false;
	}
}

export function useHataFormDraft<T>(options: {
	id: string;
	capture: () => T;
	restore: (data: T) => void;
	isMeaningful: (data: T) => boolean;
	delay?: number;
	/** Hatady の明示保存。既存のフォームは従来の自動保存を維持する。 */
	autoSave?: boolean;
	/** A server save can finish before deleting the local draft succeeds. */
	preserveOnExit?: () => boolean;
	onPreserveFailure?: () => void;
}): {
		restored: Ref<boolean>;
		hasChanges: () => boolean;
		clearDraft: (options?: { resume?: boolean }) => boolean;
		saveDraft: () => boolean;
		flushDraft: () => boolean;
		/** Rebase after loading unchanged server data, without deleting a stored draft. */
		resetBaseline: () => void;
	} {
	const restored = ref(false);
	// アカウント切替後のアンマウントでも元のアカウントへだけ保存する。
	const key = storageKey();
	let completed = false;
	let restoreFailed = false;
	let initialSnapshot = '';
	let timer: number | null = null;
	let stopWatch: WatchStopHandle | null = null;
	const popupScope = inject(HATA_GOES_POPUP_SCOPE, null);
	const session = inject(HATA_GOES_SESSION, null);
	let stopPreserving: (() => void) | null = null;

	const cancelTimer = () => {
		if (timer != null) window.clearTimeout(timer);
		timer = null;
	};
	const snapshot = (data: T): string => {
		try { return JSON.stringify(data); } catch { return ''; }
	};
	const hasUnsavedChanges = (data: T): boolean => options.isMeaningful(data) && snapshot(data) !== initialSnapshot;
	const hasChanges = () => !completed && hasUnsavedChanges(options.capture());

	const flushDraft = () => {
		cancelTimer();
		if (completed) return true;
		const store = readStore(key);
		if (store == null) return false;
		const data = options.capture();
		if (restoreFailed && snapshot(data) === initialSnapshot) return true;
		restoreFailed = false;
		if (hasUnsavedChanges(data)) {
			store[options.id] = { version: 1, updatedAt: Date.now(), data };
		} else {
			delete store[options.id];
		}
		return writeStore(key, store);
	};

	const clearDraft = (clearOptions?: { resume?: boolean }) => {
		cancelTimer();
		const store = readStore(key);
		if (store == null) return false;
		delete store[options.id];
		if (!writeStore(key, store)) return false;
		restoreFailed = false;
		completed = !clearOptions?.resume;
		if (clearOptions?.resume) initialSnapshot = snapshot(options.capture());
		restored.value = false;
		return true;
	};

	const beforeUnload = (event: BeforeUnloadEvent) => {
		if (completed || !hasUnsavedChanges(options.capture())) return;
		if (options.autoSave !== false) flushDraft();
		event.preventDefault();
		event.returnValue = '';
	};

	onMounted(() => {
		initialSnapshot = snapshot(options.capture());
		const draft = readStore(key)?.[options.id];
		if (draft != null) {
			try {
				options.restore(draft.data as T);
				restored.value = true;
			} catch {
				restoreFailed = true;
				// 読み取れない旧形式もここでは消さず、明示破棄まで残す。
			}
		}
		if (options.autoSave !== false) stopWatch = watch(options.capture, () => {
			cancelTimer();
			timer = window.setTimeout(flushDraft, options.delay ?? 600);
		}, { deep: true });
		if (options.autoSave === false) {
			stopPreserving = (popupScope ?? session)?.preserveDraft(() => {
				if (hasChanges() && options.preserveOnExit?.() !== false && !flushDraft()) {
					options.onPreserveFailure?.();
					throw new Error('Failed to save HataGoes form draft');
				}
			}) ?? null;
		}
		window.addEventListener('beforeunload', beforeUnload);
	});

	onBeforeUnmount(() => {
		stopPreserving?.();
		stopWatch?.();
		window.removeEventListener('beforeunload', beforeUnload);
		if (options.autoSave !== false) flushDraft();
	});

	return { restored, hasChanges, clearDraft, saveDraft: flushDraft, flushDraft, resetBaseline: () => { initialSnapshot = snapshot(options.capture()); } };
}
