/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HatadyActivityCard from './HatadyActivityCard.vue';
import type { HatadyActivity, HatadyActivityType } from '@/utility/hatady-media.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), confirm: vi.fn(), popup: vi.fn(), notify: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ confirm: fixture.confirm, popup: fixture.popup }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => fixture.popup }));
vi.mock('@/i.js', () => ({ $i: { id: 'viewer' } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixture.notify, hatadyDuration: () => '30分' }));
vi.mock('@/utility/hatady.js', () => ({ hyTagLabel: (tag: string) => tag }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/HatadyReactions.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: { render: () => null } }));
import { confirmHatadyRecordDeletion } from '@/utility/hatady-record-delete.js';

const cleanups: Array<() => void> = [];
const timestamp = '2026-09-19T01:02:03.456Z';
const kinds: HatadyActivityType[] = ['study', 'exercise', 'work', 'movie_viewing', 'game_play'];

function activity(type: HatadyActivityType, isMine = true): HatadyActivity {
	const result: HatadyActivity = { id: `activity:${type}`, type, occurredAt: timestamp, visibility: 'private', isMine };
	if (['study', 'exercise', 'work'].includes(type)) {
		result.study = { id: `log-${type}`, title: '残してある記録', kind: type, userId: isMine ? 'viewer' : 'other', details: {} };
	} else {
		result.media = { work: null, session: {
			id: `session-${type}`, workId: null, kind: type as 'movie_viewing' | 'game_play',
			occurredAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
			visibility: 'private', note: '残してある記録', details: {},
		} };
	}
	return result;
}

async function settle() {
	for (let i = 0; i < 5; i++) { await nextTick(); await Promise.resolve(); }
}

async function mountCard(record: HatadyActivity, showActions = true) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const deleted = vi.fn();
	const edit = vi.fn();
	const opened = vi.fn();
	const app = createApp({ render: () => h(HatadyActivityCard, { activity: record, showActions, showAuthor: false, onDeleted: deleted, onEdit: edit, onOpenLog: opened }) });
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	return { host, deleted, edit, opened };
}

function deleteButton(host: HTMLElement): HTMLButtonElement {
	const button = host.querySelector<HTMLButtonElement>('button[aria-label="記録を削除"]');
	expect(button).not.toBeNull();
	if (!button) throw new Error('Delete action is missing');
	return button;
}

beforeEach(() => {
	fixture.api.mockReset().mockResolvedValue(undefined);
	fixture.confirm.mockReset().mockResolvedValue({ canceled: false });
	fixture.notify.mockReset();
});

afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

test.each([undefined, 0, 3])('comment action remains available and shows only a positive count (%s)', async commentsCount => {
	const record = activity('study');
	record.study!.commentsCount = commentsCount;
	const { host, opened } = await mountCard(record);
	const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.querySelector('.ti-message-circle-2'));
	expect(button).toBeDefined();
	expect(button?.getAttribute('aria-label')).toBeTruthy();
	expect(button?.querySelector('span')?.textContent).toBe(commentsCount === 3 ? '3' : undefined);
	button?.click();
	expect(opened).toHaveBeenCalledExactlyOnceWith('log-study');
});

test.each(kinds)('%s deletion uses the underlying record ID and emits only after API success', async type => {
	const record = activity(type);
	const before = JSON.stringify(record);
	const { host, deleted } = await mountCard(record);
	const button = deleteButton(host);
	expect(button.disabled).toBe(false);
	button.click();
	await settle();
	expect(fixture.confirm).toHaveBeenCalledOnce();
	expect(fixture.confirm).toHaveBeenCalledWith(expect.objectContaining({
		type: 'warning', text: expect.stringContaining('作品とドライブの画像は残ります'),
	}));
	expect(fixture.api).toHaveBeenCalledExactlyOnceWith(...(record.study
		? ['hata/hatady/logs/delete', { logId: record.study.id }] as const
		: ['hata/hatady/media/sessions/delete', { sessionId: record.media?.session.id }] as const));
	expect(deleted).toHaveBeenCalledOnce();
	expect(JSON.stringify(record)).toBe(before);
	expect(fixture.notify).toHaveBeenCalledExactlyOnceWith('記録を削除しました');
});

test('other people’s records and cards without actions expose no deletion, and the shared helper rejects non-owners', async () => {
	for (const type of ['study', 'game_play'] as const) {
		const other = activity(type, false);
		const { host } = await mountCard(other);
		expect(host.querySelector('[aria-label="記録を削除"]')).toBeNull();
		expect(host.querySelector('[aria-label="通報"]')).not.toBeNull();
		await expect(confirmHatadyRecordDeletion(other)).resolves.toBe(false);
	}
	const { host } = await mountCard(activity('study'), false);
	expect(host.querySelector('[aria-label="記録を削除"]')).toBeNull();
	const incomplete = activity('study');
	incomplete.study = null;
	await expect(confirmHatadyRecordDeletion(incomplete)).resolves.toBe(false);
	expect(fixture.confirm).not.toHaveBeenCalled();
	expect(fixture.api).not.toHaveBeenCalled();
});

test('cancelling confirmation keeps the card and leaves edit available without an API call', async () => {
	fixture.confirm.mockResolvedValueOnce({ canceled: true });
	const { host, deleted, edit } = await mountCard(activity('work'));
	deleteButton(host).click();
	await settle();
	expect(fixture.api).not.toHaveBeenCalled();
	expect(deleted).not.toHaveBeenCalled();
	expect(fixture.notify).not.toHaveBeenCalled();
	expect(host.textContent).toContain('残してある記録');
	expect(deleteButton(host).disabled).toBe(false);
	host.querySelector<HTMLButtonElement>('[aria-label="記録を編集"]')?.click();
	expect(edit).toHaveBeenCalledOnce();
});

test.each(['study', 'movie_viewing'] as const)('%s API failure keeps the record and permits a confirmed retry', async type => {
	fixture.api.mockRejectedValueOnce(new Error('offline'));
	const { host, deleted } = await mountCard(activity(type));
	deleteButton(host).click();
	await settle();
	expect(deleted).not.toHaveBeenCalled();
	expect(host.textContent).toContain('残してある記録');
	expect(deleteButton(host).disabled).toBe(false);
	expect(fixture.notify).toHaveBeenCalledExactlyOnceWith('記録を削除できませんでした');
	deleteButton(host).click();
	await settle();
	expect(fixture.confirm).toHaveBeenCalledTimes(2);
	expect(fixture.api).toHaveBeenCalledTimes(2);
	expect(deleted).toHaveBeenCalledOnce();
});

test('rapid clicks during confirmation and the delete request produce one confirmation, request and success event', async () => {
	let finishConfirm!: (result: { canceled: boolean }) => void;
	let finishDelete!: () => void;
	fixture.confirm.mockImplementationOnce(() => new Promise(resolve => { finishConfirm = resolve; }));
	fixture.api.mockImplementationOnce(() => new Promise<void>(resolve => { finishDelete = resolve; }));
	const { host, deleted } = await mountCard(activity('exercise'));
	const button = deleteButton(host);
	button.click();
	// Direct events also exercise the synchronous guard before disabled is rendered.
	button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle();
	expect(button.disabled).toBe(true);
	expect(fixture.confirm).toHaveBeenCalledOnce();
	expect(fixture.api).not.toHaveBeenCalled();
	expect(deleted).not.toHaveBeenCalled();
	finishConfirm({ canceled: false });
	await settle();
	button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle();
	expect(button.disabled).toBe(true);
	expect(fixture.confirm).toHaveBeenCalledOnce();
	expect(fixture.api).toHaveBeenCalledOnce();
	expect(deleted).not.toHaveBeenCalled();
	finishDelete();
	await settle();
	expect(deleted).toHaveBeenCalledOnce();
	expect(fixture.notify).toHaveBeenCalledOnce();
});
