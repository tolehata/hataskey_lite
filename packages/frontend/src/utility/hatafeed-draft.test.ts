/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
const fixture = vi.hoisted(() => ({ records: new Map<string, string>(), failWrite: false, account: { id: 'one' }, notify: vi.fn(), popup: vi.fn(), pending: null as null | { props: { save: () => boolean; discard: () => boolean }; events: { done: (leave: boolean) => void; closed: () => void } } }));
vi.mock('@/i.js', () => ({ $i: fixture.account }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItemAsJson(key: string) { const value = fixture.records.get(key); return value == null ? undefined : JSON.parse(value); },
	setItemAsJson(key: string, value: unknown) { if (fixture.failWrite) throw new Error('quota'); fixture.records.set(key, JSON.stringify(value)); },
} }));
vi.mock('@/os.js', () => ({ toast: fixture.notify, popup: fixture.popup }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => fixture.popup }));
vi.mock('@/components/HataFeedDraftPrompt.vue', () => ({ default: { template: '<div/>' } }));
import { useHataFeedDraft } from './hatafeed-draft.js';
import { hataFeedDraftPromptOpen } from './hatafeed-ui.js';
const cleanups: Array<() => void> = [];

function editor() {
	const value = ref(''); const busy = ref(false);
	let draft!: ReturnType<typeof useHataFeedDraft<{ text: string }>>;
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp(defineComponent({ setup() {
		draft = useHataFeedDraft({ id: 'hatafeed:issue:general', capture: () => ({ text: value.value }), restore: data => { value.value = data.text; }, isMeaningful: data => data.text.length > 0, busy: () => busy.value });
		return () => h('section', { inert: draft.prompt.value }, h('input', { value: value.value }));
	} })); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); }); return { value, busy, draft, target };
}

beforeEach(() => { fixture.records.clear(); fixture.failWrite = false; fixture.account.id = 'one'; fixture.pending = null; fixture.notify.mockReset(); fixture.popup.mockReset().mockImplementation((_component: unknown, props: NonNullable<typeof fixture.pending>['props'], events: NonNullable<typeof fixture.pending>['events']) => { fixture.pending = { props, events }; return { dispose: vi.fn() }; }); });
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

async function prompt() { await vi.waitFor(() => expect(fixture.pending).not.toBeNull()); return fixture.pending!; }

describe('HataFeed explicit draft choices', () => {
	test('offers an existing account-local draft without replacing fresh input until chosen', () => {
		fixture.records.set('hataFormDrafts:one', JSON.stringify({ 'hatafeed:issue:general': { version: 1, updatedAt: Date.now(), data: { text: '続きの内容' } } }));
		const form = editor();
		expect(form.value.value).toBe(''); expect(form.draft.hasDraft.value).toBe(true);
		form.draft.resumeDraft(); expect(form.value.value).toBe('続きの内容'); expect(form.draft.hasChanges()).toBe(true);
	});
	test('returning to editing retains the original DOM, input, and focus', async () => {
		const form = editor(); form.value.value = '編集途中'; await nextTick();
		const input = form.target.querySelector('input')!; input.focus();
		const close = form.draft.beforeClose(); const dialog = await prompt(); await nextTick();
		expect(form.target.querySelector('input')).toBe(input); expect(input.value).toBe('編集途中');
		expect(form.target.querySelector('section')?.hasAttribute('inert')).toBe(true);
		expect(hataFeedDraftPromptOpen.value).toBe(true);
		dialog.events.done(false); dialog.events.closed(); expect(await close).toBe(false);
		expect(hataFeedDraftPromptOpen.value).toBe(false); expect(window.document.activeElement).toBe(input);
		expect(fixture.records.size).toBe(0);
	});
	test('saving before close writes only the original account and does not touch other drafts', async () => {
		fixture.records.set('hataFormDrafts:one', JSON.stringify({ other: { version: 1, updatedAt: Date.now(), data: { text: '別の下書き' } } }));
		const form = editor(); fixture.account.id = 'two'; form.value.value = '保存する内容';
		const close = form.draft.beforeClose(); const dialog = await prompt();
		expect(dialog.props.save()).toBe(true); dialog.events.done(true); dialog.events.closed(); expect(await close).toBe(true);
		expect(fixture.notify).toHaveBeenCalledWith('端末に下書きを保存しました');
		const saved = JSON.parse(fixture.records.get('hataFormDrafts:one')!);
		expect(saved.other.data.text).toBe('別の下書き'); expect(saved['hatafeed:issue:general'].data.text).toBe('保存する内容');
		expect(fixture.records.has('hataFormDrafts:two')).toBe(false);
	});
	test('failed save or discard leaves the editor dirty until the user returns', async () => {
		const form = editor(); form.value.value = '残す内容'; fixture.failWrite = true;
		const close = form.draft.beforeClose(); const dialog = await prompt();
		expect(dialog.props.save()).toBe(false); expect(dialog.props.discard()).toBe(false); expect(form.draft.hasChanges()).toBe(true);
		expect(fixture.notify).not.toHaveBeenCalled();
		dialog.events.done(false); dialog.events.closed(); expect(await close).toBe(false); expect(form.value.value).toBe('残す内容');
	});
	test('busy requests cannot close, but server success can close despite local cleanup failure', async () => {
		const form = editor(); form.value.value = '送信した内容'; form.busy.value = true;
		expect(await form.draft.beforeClose()).toBe(false); expect(fixture.pending).toBeNull();
		fixture.failWrite = true; form.draft.finishSubmission();
		expect(await form.draft.beforeClose()).toBe(true); expect(fixture.notify).toHaveBeenCalledWith('送信は完了しましたが、端末の下書きを削除できませんでした');
	});
	test('a consecutive request starts a fresh draft lifecycle', async () => {
		const form = editor(); form.value.value = '前の申請';
		form.value.value = ''; form.draft.finishSubmission({ resume: true });
		expect(form.draft.hasChanges()).toBe(false);
		form.value.value = '次の申請'; expect(form.draft.hasChanges()).toBe(true);
		const close = form.draft.beforeClose(); const dialog = await prompt();
		expect(dialog.props.discard()).toBe(true); dialog.events.done(true); dialog.events.closed(); expect(await close).toBe(true);
	});
});
