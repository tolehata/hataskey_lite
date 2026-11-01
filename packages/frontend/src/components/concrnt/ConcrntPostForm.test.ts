/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import ConcrntPostForm from './ConcrntPostForm.vue';
import type { ConcrntMessage } from '@/utility/concrnt/types.js';
import { concrntState } from '@/utility/concrnt/runtime.js';
import { concrntDraft, concrntListState, concrntPostedRevision, resetConcrntDraft, selectConcrntList } from '@/utility/concrnt/composer.js';

const calls = vi.hoisted(() => ({
	initialize: vi.fn(), loadSelection: vi.fn(), saveSelection: vi.fn(), popup: vi.fn(), popupMenu: vi.fn(), toast: vi.fn(),
	client: { getLists: vi.fn(), publish: vi.fn(), uploadImage: vi.fn(), getMessage: vi.fn() },
}));
vi.mock('@/utility/concrnt/runtime.js', async () => {
	const { reactive } = await import('vue');
	return {
		concrntState: reactive({ initialized: true, busy: false, currentOwner: 'local.example/owner-one', status: 'connected', connection: { ccid: 'con1example', ckid: 'cck1example', domain: 'social.example' }, settings: { profile: 'main', enabled: true, notifications: true, popups: true, save: 'device' }, profiles: [{ id: 'main', name: '本人' }, { id: 'work', name: '仕事', visibility: 'restricted' }], revision: 0, operations: [], read: [], error: null }),
		initializeConcrnt: calls.initialize,
		runConcrntAction: (action: (client: typeof calls.client) => Promise<unknown>) => action(calls.client),
		loadConcrntListSelection: calls.loadSelection, saveConcrntListSelection: calls.saveSelection,
	};
});
vi.mock('@/os.js', () => ({ popup: calls.popup, popupMenu: calls.popupMenu, toast: calls.toast, inputText: vi.fn(), confirm: vi.fn(), alert: vi.fn() }));
vi.mock('@@/js/config.js', async importOriginal => ({ ...await importOriginal<object>(), ui: 'simple' }));

const message: ConcrntMessage = {
	uri: 'cckv://con1author/concrnt.world/profiles/main/posts/one', key: 'one', schema: 'https://schema.concrnt.world/m/markdown.json', kind: 'markdown',
	author: 'con1author', authorName: '投稿者', authorProfile: 'main', createdAt: '2026-10-20T00:00:00Z',
	body: '元の投稿', emojis: {}, media: [], distributes: ['target-timeline'], visibility: 'unknown',
	reactions: [], associationCounts: {}, webUrl: 'https://concrnt.world/post/one',
};
const cleanups: Array<() => void> = [];

async function flush() {
	for (let tick = 0; tick < 10; tick++) { await Promise.resolve(); await nextTick(); }
}

function submit(target: HTMLElement) { return target.querySelector<HTMLButtonElement>('[data-concrnt-submit]')!; }

function write(target: HTMLElement, value: string) {
	const input = target.querySelector('textarea')!;
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function mountForm() {
	const props = reactive({ active: true });
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const app = createApp({ render: () => h(ConcrntPostForm, props) });
	app.directive('tooltip', {});
	app.component('MkTime', { render: () => h('time') });
	app.component('MkMediaList', { render: () => h('div') });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await flush();
	return { target, props };
}

beforeEach(() => {
	for (const call of [calls.initialize, calls.loadSelection, calls.saveSelection, calls.popup, calls.popupMenu, calls.toast, ...Object.values(calls.client)]) call.mockReset();
	calls.initialize.mockResolvedValue(undefined);
	calls.loadSelection.mockResolvedValue(null);
	calls.saveSelection.mockResolvedValue(undefined);
	calls.client.getLists.mockResolvedValue([{ uri: 'list-main', name: 'いつものリスト', timelines: ['one'], pinned: true, excludeSelf: false, defaultPostHome: true, defaultPostTimelines: ['one'] }]);
	calls.client.publish.mockResolvedValue({ status: 'complete' });
	calls.client.getMessage.mockResolvedValue(message);
	Object.assign(concrntState, { currentOwner: 'local.example/owner-one', status: 'connected', settings: { profile: 'main', enabled: true, notifications: true, popups: true, save: 'device' }, revision: concrntState.revision + 1 });
	resetConcrntDraft();
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

describe('CTL post form', () => {
	test('posts to Concrnt with the selected profile and list destination, then clears the draft', async () => {
		const posted = concrntPostedRevision.value;
		const { target } = await mountForm();
		write(target, 'コンカレントだけへ投稿');
		await flush();
		submit(target).click();
		await flush();
		// world-app semantics: readers follow the chosen profile and timelines; the form never claims "public".
		expect(calls.client.publish).toHaveBeenCalledWith(expect.objectContaining({ profile: 'main', body: 'コンカレントだけへ投稿', destinations: ['one'], postHome: true, visibility: 'inherit' }));
		expect(concrntDraft.body).toBe('');
		expect(concrntPostedRevision.value).toBe(posted + 1);
	});

	test('waits for the destination lists before allowing posting or image upload', async () => {
		let complete!: (items: unknown[]) => void;
		calls.client.getLists.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
		const { target } = await mountForm();
		write(target, '接続先を確認するまで送らない');
		await flush();
		expect(submit(target).disabled).toBe(true);
		expect(target.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
		target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await flush();
		expect(calls.client.publish).not.toHaveBeenCalled();
		complete([]);
		await flush();
		expect(submit(target).disabled).toBe(false);
	});

	test('a missing saved list blocks sending until home is selected explicitly', async () => {
		calls.loadSelection.mockResolvedValue('missing-list');
		const { target } = await mountForm();
		write(target, '宛先を確認してから送る');
		await flush();
		expect(target.textContent).toContain('選択したリストが見つかりません');
		expect(submit(target).disabled).toBe(true);
		await selectConcrntList('');
		await flush();
		expect(calls.saveSelection).toHaveBeenCalledWith(null);
		expect(concrntDraft.body).toBe('宛先を確認してから送る');
		expect(submit(target).disabled).toBe(false);
	});

	test('a reply goes to the chosen destinations, not the timelines of the original post', async () => {
		concrntDraft.target = { ...message, distributes: [] };
		concrntDraft.mode = 'reply';
		const { target } = await mountForm();
		write(target, '宛先は自分で選ぶ返信');
		await flush();
		submit(target).click();
		await flush();
		expect(calls.client.publish).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'one', postHome: true, destinations: ['one'], visibility: 'inherit' }));
	});

	test('choosing another profile, no home and several timelines is sent as chosen', async () => {
		const { target } = await mountForm();
		concrntDraft.profile = 'work';
		concrntDraft.postHome = false;
		concrntDraft.destinations = ['one', 'two'];
		write(target, '複数のTLへ');
		await flush();
		submit(target).click();
		await flush();
		expect(calls.client.publish).toHaveBeenCalledWith(expect.objectContaining({ profile: 'work', postHome: false, destinations: ['one', 'two'] }));
	});

	test('nothing to post to blocks sending until a destination is chosen', async () => {
		const { target } = await mountForm();
		concrntDraft.postHome = false;
		concrntDraft.destinations = [];
		write(target, '宛先なし');
		await flush();
		expect(target.textContent).toContain('投稿先がありません');
		expect(submit(target).disabled).toBe(true);
		concrntDraft.destinations = ['one'];
		await flush();
		expect(submit(target).disabled).toBe(false);
	});

	test('reply submits the canonical target key', async () => {
		concrntDraft.target = message;
		concrntDraft.mode = 'reply';
		const { target } = await mountForm();
		expect(target.textContent).toContain('返信先');
		write(target, '返信の本文');
		await flush();
		submit(target).click();
		await flush();
		expect(calls.client.publish).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'one', body: '返信の本文' }));
	});

	test('an unknown result blocks the same draft from another send', async () => {
		calls.client.publish.mockResolvedValue({ status: 'unknown' });
		const { target } = await mountForm();
		write(target, '結果確認が必要な投稿');
		await flush();
		submit(target).click();
		await flush();
		expect(target.textContent).toContain('送信結果を確認できませんでした');
		expect(concrntDraft.body).toBe('結果確認が必要な投稿');
		expect(submit(target).disabled).toBe(true);
		submit(target).click();
		await flush();
		expect(calls.client.publish).toHaveBeenCalledOnce();
	});

	test('inserted emoji are sent only while their shortcode remains in the body', async () => {
		const { target } = await mountForm();
		write(target, 'やあ');
		await flush();
		concrntDraft.emojis = { wave: { imageURL: 'https://cdn.example/wave.png' }, gone: { imageURL: 'https://cdn.example/gone.png' } };
		write(target, 'やあ :wave:');
		await flush();
		submit(target).click();
		await flush();
		expect(calls.client.publish).toHaveBeenCalledWith(expect.objectContaining({ emojis: { wave: { imageURL: 'https://cdn.example/wave.png' } } }));
	});

	test('the draft survives reconnecting but never moves to another profile or account', async () => {
		await mountForm();
		concrntDraft.body = '接続し直しても残す下書き';
		concrntState.revision++;
		await flush();
		expect(concrntDraft.body).toBe('接続し直しても残す下書き');
		concrntState.settings.profile = 'work';
		await flush();
		expect(concrntDraft.body).toBe('');
		concrntDraft.body = '前のアカウントの下書き';
		concrntState.currentOwner = 'local.example/owner-two';
		await flush();
		expect(concrntDraft.body).toBe('');
		expect(calls.client.publish).not.toHaveBeenCalled();
		expect(concrntListState.uri).toBe('');
	});
});
