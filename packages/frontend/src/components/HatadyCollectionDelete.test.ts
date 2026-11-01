/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HatadyBookDetail from './HatadyBookDetail.vue';
import HatadyMediaWorkDetail from './HatadyMediaWorkDetail.vue';

const fixture = vi.hoisted(() => ({ api: vi.fn(), confirm: vi.fn(), notify: vi.fn(), popup: vi.fn(), mine: true, kind: 'movie', deletedRecord: false }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (endpoint: string, params: unknown) => {
	const result = fixture.api(endpoint, params);
	return Promise.resolve(result === undefined ? endpoint === 'i/registry/keys' ? [] : endpoint === 'i/registry/get-all' ? {} : undefined : result);
} }));
vi.mock('@/os.js', () => ({ confirm: fixture.confirm, popup: fixture.popup, popupMenu: vi.fn() }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));
vi.mock('@/router.js', () => ({ mainRouter: { pushByPath: vi.fn() }, useRouter: () => ({ pushByPath: vi.fn() }) }));
vi.mock('@/i.js', () => ({ $i: { id: 'owner', isAdmin: false, isModerator: false } }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/utility/hatady-ui.js', async importOriginal => ({ ...await importOriginal<typeof import('@/utility/hatady-ui.js')>(), hatadyNotify: fixture.notify }));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: vi.fn() } }));
vi.mock('@/utility/emoji-picker.js', () => ({ emojiPicker: { show: vi.fn() } }));
vi.mock('@/utility/hata-form-draft.js', async () => {
	const { ref } = await import('vue');
	return { useHataFormDraft: () => ({ restored: ref(false), resetBaseline: vi.fn(), hasChanges: () => false, saveDraft: () => true, clearDraft: () => true }) };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { title: String, busy: Boolean, inert: Boolean, scrollHint: Boolean },
		emits: ['close', 'closed'],
		setup(props, { slots, emit, expose }) {
			expose({ close: () => emit('closed') });
			return () => render('section', { role: 'dialog', 'data-busy': String(props.busy) }, [
				render('button', { 'aria-label': '閉じる', onClick: () => emit('close') }),
				slots.default?.(),
			]);
		},
	}) };
});
vi.mock('@/components/HatadyActivityCard.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: ['activity'], emits: ['deleted', 'openLog', 'openSession'],
		setup(props, { emit }) {
			return () => render('article', [
				render('button', { 'data-record-delete': '', onClick: () => { fixture.deletedRecord = true; emit('deleted'); } }, '記録を削除'),
				render('button', { 'data-record-open': '', onClick: () => {
					if (props.activity.study) emit('openLog', props.activity.study.id);
					else emit('openSession', props.activity.media.session.id);
				} }, '記録を開く'),
			]);
		},
	}) };
});
vi.mock('@/components/HatadyConversation.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HyBookCover.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HyMediaCover.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HySubjectBadge.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkLink.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HatadyDraftPrompt.vue', () => ({ default: { render: () => null } }));

const cleanup: Array<() => void> = [];
const kinds = ['book', 'movie', 'game', 'work'] as const;
type Kind = typeof kinds[number];
const now = '2026-09-19T00:00:00Z';
const log = { id: 'log', kind: 'study', title: '読書の記録', subject: '読書', studiedAt: now, details: {} };
const session = { id: 'session', workId: 'work', kind: 'movie_viewing', occurredAt: now, createdAt: now, updatedAt: now, visibility: 'private', details: {} };
const labelFor = (kind: Kind) => kind === 'book' ? '本を削除' : kind === 'work' ? '作業を削除' : '作品を削除';
const endpointFor = (kind: Kind) => kind === 'book' ? 'hata/hatady/books/delete' : 'hata/hatady/media/works/delete';

async function settle() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

async function mountDetail(kind: Kind) {
	fixture.kind = kind;
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const changed = vi.fn(), closed = vi.fn(), deleted = vi.fn();
	const app = createApp({ render: () => kind === 'book'
		? h(HatadyBookDetail, { bookId: 'book', onChanged: changed, onClosed: closed, onDeleted: deleted })
		: h(HatadyMediaWorkDetail, { workId: 'work', onChanged: changed, onClosed: closed, onDeleted: deleted }) });
	for (const name of ['MkAvatar', 'MkUserName', 'Mfm']) app.component(name, { render: () => null });
	app.mount(host);
	cleanup.push(() => { app.unmount(); host.remove(); });
	await settle();
	return { host, changed, closed, deleted };
}

beforeEach(() => {
	fixture.mine = true;
	fixture.deletedRecord = false;
	fixture.confirm.mockReset().mockResolvedValue({ canceled: true });
	fixture.notify.mockReset();
	fixture.popup.mockReset().mockReturnValue({ dispose: vi.fn() });
	fixture.api.mockReset().mockImplementation(async (endpoint: string) => {
		if (endpoint === 'hata/hatady/books/show') return { book: { id: 'book', title: '本の名前', status: 'reading', currentPage: 0, visibility: 'private' }, isMine: fixture.mine, bookmarks: [], memos: [], logs: fixture.deletedRecord ? [] : [log] };
		if (endpoint === 'hata/hatady/media/works/show') return { id: 'work', title: '作品の名前', kind: fixture.kind, status: 'planned', visibility: 'private', isMine: fixture.mine, logs: fixture.kind === 'work' && !fixture.deletedRecord ? [{ ...log, kind: 'work' }] : [] };
		if (endpoint === 'hata/hatady/media/sessions/list') return fixture.kind !== 'work' && !fixture.deletedRecord ? [session] : [];
		if (endpoint === 'hata/hatady/media/comments/list') return [];
		if (endpoint.endsWith('/delete')) return undefined;
		throw new Error(`Unexpected API: ${endpoint}`);
	});
});
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });

describe('Hatady collection deletion', () => {
	test.each(kinds)('%s exposes one owner delete beside edit and confirms before deleting', async kind => {
		const view = await mountDetail(kind);
		const button = view.host.querySelector<HTMLButtonElement>(`button[aria-label="${labelFor(kind)}"]`)!;
		expect(button).not.toBeNull();
		expect(view.host.querySelectorAll(`button[aria-label="${labelFor(kind)}"]`)).toHaveLength(1);
		expect(button.parentElement?.querySelector('button[aria-label="編集"]')).not.toBeNull();
		expect(button.parentElement?.parentElement?.querySelector('h2')).not.toBeNull();
		let answer!: (value: { canceled: boolean }) => void;
		fixture.confirm.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
		button.click();
		button.click();
		await settle();
		expect(fixture.confirm).toHaveBeenCalledTimes(1);
		expect(fixture.confirm.mock.calls[0][0].text).toContain(kind === 'book' ? '読書の記録は残ります' : '記録への返信・リアクションは残ります');
		expect(fixture.confirm.mock.calls[0][0].text).toContain(kind === 'book' ? 'しおりと内容メモも削除' : 'への返信とリアクションも削除');
		expect(button.disabled).toBe(true);
		expect(view.host.querySelector('[role="dialog"]')?.getAttribute('data-busy')).toBe('true');
		view.host.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')!.click();
		expect(view.closed).not.toHaveBeenCalled();
		expect(fixture.api.mock.calls.some(([endpoint]) => endpoint === endpointFor(kind))).toBe(false);
		answer({ canceled: true });
		await settle();
		expect(button.disabled).toBe(false);
		expect(view.changed).not.toHaveBeenCalled();

		fixture.confirm.mockResolvedValue({ canceled: false });
		fixture.api.mockRejectedValueOnce(new Error('offline'));
		button.click();
		await settle();
		expect(view.closed).not.toHaveBeenCalled();
		expect(view.changed).not.toHaveBeenCalled();
		expect(view.deleted).not.toHaveBeenCalled();
		expect(fixture.notify).toHaveBeenLastCalledWith(expect.stringContaining('削除できません'));
		expect(button.disabled).toBe(false);

		button.click();
		await settle();
		expect(fixture.api.mock.calls.at(-1)).toEqual([endpointFor(kind), kind === 'book' ? { bookId: 'book' } : { workId: 'work' }]);
		expect(view.changed).toHaveBeenCalledOnce();
		expect(view.closed).toHaveBeenCalledOnce();
		expect(view.deleted).toHaveBeenCalledOnce();
		expect(view.deleted.mock.invocationCallOrder[0]).toBeLessThan(view.changed.mock.invocationCallOrder[0]);
	});

	test.each(kinds)('%s does not expose owner deletion on someone else’s collection', async kind => {
		fixture.mine = false;
		const { host } = await mountDetail(kind);
		expect(host.querySelector(`button[aria-label="${labelFor(kind)}"]`)).toBeNull();
		expect(fixture.confirm).not.toHaveBeenCalled();
	});

	test.each(['book', 'movie', 'work'] as const)('%s refreshes its related records and parent collection after a card deletion', async kind => {
		const view = await mountDetail(kind);
		const record = view.host.querySelector<HTMLButtonElement>('[data-record-delete]')!;
		expect(record).not.toBeNull();
		fixture.api.mockClear();
		record.click();
		await settle();
		expect(fixture.api).toHaveBeenCalledWith(kind === 'book' ? 'hata/hatady/books/show' : 'hata/hatady/media/works/show', kind === 'book' ? { bookId: 'book' } : { workId: 'work' });
		if (kind === 'movie') expect(fixture.api).toHaveBeenCalledWith('hata/hatady/media/sessions/list', { workId: 'work', limit: 100 });
		expect(view.host.querySelector('[data-record-delete]')).toBeNull();
		expect(view.changed).toHaveBeenCalledOnce();
		expect(view.closed).not.toHaveBeenCalled();
	});

	test.each(['book', 'movie', 'work'] as const)('%s removes a deleted card before reloading even when reloading fails', async kind => {
		const view = await mountDetail(kind);
		fixture.api.mockRejectedValue(new Error('offline'));
		view.host.querySelector<HTMLButtonElement>('[data-record-delete]')!.click();
		await settle();
		expect(view.host.querySelector('[data-record-delete]')).toBeNull();
		expect(view.changed).toHaveBeenCalledOnce();
		expect(view.closed).not.toHaveBeenCalled();
	});

	test.each(['book', 'movie', 'work'] as const)('%s removes a record deleted in its conversation without waiting for the refresh', async kind => {
		const view = await mountDetail(kind);
		view.host.querySelector<HTMLButtonElement>('[data-record-open]')!.click();
		await vi.dynamicImportSettled();
		await settle();
		expect(fixture.popup).toHaveBeenCalledOnce();
		const handlers = fixture.popup.mock.calls[0][2];
		const callsBefore = fixture.api.mock.calls.length;
		handlers.deleted();
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(callsBefore);
		expect(view.host.querySelector('[data-record-delete]')).toBeNull();
		fixture.api.mockRejectedValue(new Error('offline'));
		handlers.changed();
		await settle();
		expect(view.host.querySelector('[data-record-delete]')).toBeNull();
		expect(view.changed).toHaveBeenCalledOnce();
		expect(view.closed).not.toHaveBeenCalled();
	});
});
