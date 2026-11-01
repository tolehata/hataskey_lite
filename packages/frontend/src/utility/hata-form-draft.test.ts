/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
const storage = vi.hoisted(() => ({ records: new Map<string, string>(), failRead: false, failWrite: false, account: { id: 'one' } }));
vi.mock('@/i.js', () => ({ $i: storage.account }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItemAsJson(key: string) { if (storage.failRead) throw new Error('read failed'); const value = storage.records.get(key); return value == null ? undefined : JSON.parse(value); },
	setItemAsJson(key: string, value: unknown) { if (storage.failWrite) throw new Error('quota'); storage.records.set(key, JSON.stringify(value)); },
} }));
import { useHataFormDraft } from './hata-form-draft.js';
import { HATA_GOES_POPUP_SCOPE } from './hatagoes-context.js';
const unmounts: Array<() => void> = [];

function scope() {
	const callbacks = new Set<() => void>();
	return { callbacks, preserveDraft: (save: () => void) => { callbacks.add(save); return () => { callbacks.delete(save); }; }, preserve: () => { for (const callback of callbacks) callback(); } };
}

function editor(autoSave?: boolean, id = 'hatady:log:create', options: { scope?: ReturnType<typeof scope>; preserveOnExit?: () => boolean; onPreserveFailure?: () => void; offerOnly?: boolean } = {}) {
	const value = ref('');
	const offered = ref('');
	let draft!: ReturnType<typeof useHataFormDraft<{ text: string }>>;
	const app = createApp(defineComponent({ setup() { draft = useHataFormDraft({ id, autoSave, preserveOnExit: options.preserveOnExit, onPreserveFailure: options.onPreserveFailure, capture: () => ({ text: value.value }), restore: data => { if (typeof data.text !== 'string') throw new Error('Invalid draft'); if (options.offerOnly) offered.value = data.text; else value.value = data.text; }, isMeaningful: data => data.text.length > 0 }); return () => h('div'); } }));
	if (options.scope) app.provide(HATA_GOES_POPUP_SCOPE, options.scope);
	const target = window.document.createElement('div'); window.document.body.append(target); app.mount(target);
	let disposed = false;
	const unmount = () => { if (!disposed) { disposed = true; app.unmount(); target.remove(); } };
	unmounts.push(unmount);
	return { draft, value, offered, unmount };
}

function store() { return JSON.parse(storage.records.get('hataFormDrafts:one') || '{}'); }

beforeEach(() => { storage.records.clear(); storage.failRead = false; storage.failWrite = false; storage.account.id = 'one'; });
afterEach(() => { unmounts.splice(0).forEach(unmount => unmount()); vi.useRealTimers(); });

describe('account-local manual Hatady drafts', () => {
	test('failed restoration keeps the saved record until new input replaces it', () => {
		const old = { version: 1, updatedAt: Date.now(), data: { text: 123, otherText: 'recoverable' } };
		storage.records.set('hataFormDrafts:one', JSON.stringify({ 'hatady:log:create': old }));
		const untouched = editor(); untouched.unmount();
		expect(store()['hatady:log:create']).toEqual(old);
		const changed = editor(); changed.value.value = 'new input'; changed.unmount();
		expect(store()['hatady:log:create'].data).toEqual({ text: 'new input' });
	});
	test('manual mode saves only on explicit choice and never on unmount', async () => {
		vi.useFakeTimers(); const first = editor(false); first.value.value = '途中の入力'; await nextTick(); await vi.advanceTimersByTimeAsync(1000);
		expect(first.draft.hasChanges()).toBe(true); expect(storage.records.size).toBe(0);
		expect(first.draft.saveDraft()).toBe(true); expect(store()['hatady:log:create'].data.text).toBe('途中の入力');
		first.value.value = '保存していない変更'; first.unmount();
		expect(store()['hatady:log:create'].data.text).toBe('途中の入力');
	});
	test('an old key restores, discard removes it, and unmount cannot recreate it', () => {
		storage.records.set('hataFormDrafts:one', JSON.stringify({ 'hatady:log:create': { version: 1, updatedAt: Date.now(), data: { text: '旧下書き' } }, other: { version: 1, updatedAt: Date.now(), data: { text: '別の下書き' } } }));
		const current = editor(false); expect(current.value.value).toBe('旧下書き'); expect(current.draft.restored.value).toBe(true);
		expect(current.draft.clearDraft()).toBe(true); current.unmount();
		expect(store()).toEqual({ other: { version: 1, updatedAt: expect.any(Number), data: { text: '別の下書き' } } });
	});
	test('failed storage writes leave the editor dirty and recover on retry', () => {
		const current = editor(false); current.value.value = '失いたくない'; storage.failWrite = true;
		expect(current.draft.saveDraft()).toBe(false); expect(current.draft.clearDraft()).toBe(false); expect(current.draft.hasChanges()).toBe(true);
		storage.failWrite = false; expect(current.draft.saveDraft()).toBe(true); expect(store()['hatady:log:create'].data.text).toBe('失いたくない');
	});
	test('unreadable stores cannot overwrite unrelated drafts', () => {
		storage.records.set('hataFormDrafts:one', '{broken'); const current = editor(false); current.value.value = '新しい入力';
		expect(current.draft.saveDraft()).toBe(false); expect(current.draft.clearDraft()).toBe(false); expect(storage.records.get('hataFormDrafts:one')).toBe('{broken');
	});
	test('resume after clear allows a new edit and account switches retain the original owner', () => {
		const current = editor(false); current.value.value = '前の入力'; expect(current.draft.clearDraft({ resume: true })).toBe(true); expect(current.draft.hasChanges()).toBe(false);
		storage.account.id = 'two'; current.value.value = '新しい入力'; expect(current.draft.saveDraft()).toBe(true);
		expect(store()['hatady:log:create'].data.text).toBe('新しい入力'); expect(storage.records.has('hataFormDrafts:two')).toBe(false);
	});
	test('legacy callers retain automatic save and the existing delay', async () => {
		vi.useFakeTimers(); const current = editor(undefined, 'hatafeed:old'); current.value.value = '自動保存'; await nextTick();
		await vi.advanceTimersByTimeAsync(599); expect(storage.records.size).toBe(0);
		await vi.advanceTimersByTimeAsync(1); expect(store()['hatafeed:old'].data.text).toBe('自動保存');
	});
	test('force-closing a changed manual form preserves its draft before unmount', () => {
		const draftScope = scope();
		const current = editor(false, 'hatady:log:create', { scope: draftScope });
		current.value.value = '保存中の編集';
		try { expect(draftScope.callbacks.size).toBe(1); draftScope.preserve(); } finally { current.unmount(); }
		expect(store()['hatady:log:create'].data.text).toBe('保存中の編集');
		expect(draftScope.callbacks.size).toBe(0);
	});
	test('does not overwrite an offered HataFeed draft before the user resumes it', () => {
		const stored = { version: 1, updatedAt: Date.now(), data: { text: '既存の下書き' } };
		storage.records.set('hataFormDrafts:one', JSON.stringify({ 'hatafeed:issue': stored }));
		const draftScope = scope();
		const current = editor(false, 'hatafeed:issue', { scope: draftScope, offerOnly: true });
		expect(current.offered.value).toBe('既存の下書き');
		expect(current.draft.hasChanges()).toBe(false);
		draftScope.preserve(); current.unmount();
		expect(store()['hatafeed:issue']).toEqual(stored);
	});
	test('completed submission and explicit discard are not saved on forced close', () => {
		const draftScope = scope();
		let submitted = false;
		const submittedForm = editor(false, 'hatady:submitted', { scope: draftScope, preserveOnExit: () => !submitted });
		submittedForm.value.value = '送信済み';
		submitted = true;
		draftScope.preserve(); submittedForm.unmount();
		expect(store()['hatady:submitted']).toBeUndefined();
		const discarded = editor(false, 'hatady:discarded', { scope: draftScope });
		discarded.value.value = '破棄済み';
		expect(discarded.draft.clearDraft()).toBe(true);
		draftScope.preserve(); discarded.unmount();
		expect(store()['hatady:discarded']).toBeUndefined();
	});
	test('storage failures during forced preservation remain observable', () => {
		const draftScope = scope();
		const onPreserveFailure = vi.fn();
		const current = editor(false, 'hatady:log:create', { scope: draftScope, onPreserveFailure });
		current.value.value = '未保存'; storage.failWrite = true;
		expect(() => draftScope.preserve()).toThrow('Failed to save HataGoes form draft');
		expect(onPreserveFailure).toHaveBeenCalledOnce();
		expect(current.draft.hasChanges()).toBe(true);
	});
});
