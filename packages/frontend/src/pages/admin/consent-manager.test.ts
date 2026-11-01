/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ConsentManager from './consent-manager.vue';
import type { App } from 'vue';

const { api, copy } = vi.hoisted(() => ({
	api: vi.fn(),
	copy: {
		title: '同意管理', searchPlaceholder: 'ユーザー名で検索', all: 'すべて',
		externalTlConsented: '外部TL同意済み', externalTlNotConsented: '外部TL未同意',
		customFontConsented: 'フォント同意済み', customFontNotConsented: 'フォント未同意',
		mascotConsented: 'マスコット同意済み', mascotNotConsented: 'マスコット未同意',
		noteCharmConsented: 'チャーム同意済み', noteCharmNotConsented: 'チャーム未同意', noteCharmAgreedAt: 'チャーム同意日時',
		drawingConsented: 'Hatadint同意済み', drawingNotConsented: 'Hatadint未同意',
		drawingFirstAgreedAt: '初回同意日時', drawingVersion: '同意した版',
		matchingUsers: '該当ユーザー数', noUsers: '該当するユーザーがいません', loadMore: 'もっと読み込む', refresh: '更新',
	},
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _consentManager: copy } } } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/components/MkInput.vue', () => ({
	default: defineComponent({
		props: ['modelValue', 'placeholder'],
		emits: ['update:modelValue'],
		setup: (props, { emit }) => () => h('input', { value: props.modelValue, placeholder: props.placeholder, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
	}),
}));

const mounts: { app: App<Element>; container: HTMLDivElement }[] = [];
const consentDate = '2026-09-09T12:34:00.000Z';

function user(id: string, agreed = true) {
	return {
		id, username: id, name: null, avatarUrl: null,
		hataConsentExternalTl: false, hataConsentExternalTlDate: null,
		hataConsentCustomFont: false, hataConsentCustomFontDate: null,
		hataConsentMascot: false, hataConsentMascotDate: null,
		hataConsentNoteCharm: agreed, hataConsentNoteCharmDate: agreed ? '2026-10-27T01:23:00.000Z' : null,
		hataConsentDrawing: agreed, hataConsentDrawingDate: agreed ? consentDate : null, hataConsentDrawingVersion: agreed ? '2026-09-09' : null,
	};
}

async function settle() {
	await Promise.resolve();
	await nextTick();
	await nextTick();
}

async function mount() {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp(ConsentManager);
	app.component('PageWithHeader', defineComponent({ setup: (_, { slots }) => () => h('main', slots.default?.()) }));
	app.component('MkLoading', defineComponent({ setup: () => () => h('div', { role: 'status' }, 'Loading') }));
	app.mount(container);
	mounts.push({ app, container });
	await settle();
	return { app, container };
}

function button(container: HTMLElement, label: string) {
	const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label);
	if (!found) throw new Error(`Button was not rendered: ${label}`);
	return found;
}

beforeEach(() => {
	api.mockReset();
	api.mockResolvedValue({ users: [user('agreed'), user('pending', false)], total: 2 });
});

afterEach(() => {
	for (const { app, container } of mounts.splice(0)) {
		app.unmount();
		container.remove();
	}
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('Hatadintの管理者向け同意一覧', () => {
	test('同意済みと未同意、初回日時・同意時の版を表示し、ユーザーの同意を代行変更しない', async () => {
		const { container } = await mount();
		expect(container.textContent).toContain('Hatadint同意済み');
		expect(container.textContent).toContain('Hatadint未同意');
		expect(container.textContent).toContain('初回同意日時');
		expect(container.textContent).toContain('同意した版: 2026-09-09');
		expect(container.querySelector<HTMLTimeElement>(`time[datetime="${consentDate}"]`)?.dateTime).toBe(consentDate);
		expect(container.querySelector(`time[datetime="${consentDate}"]`)?.textContent).toMatch(/\d{1,2}:\d{2}/);
		expect([...container.querySelectorAll('button')].map(item => item.textContent)).toEqual([
			copy.all, copy.externalTlConsented, copy.customFontConsented, copy.mascotConsented, copy.noteCharmConsented, copy.noteCharmNotConsented, copy.drawingConsented, copy.drawingNotConsented,
		]);
		expect(api).toHaveBeenCalledExactlyOnceWith('admin/hata/consent-list', { limit: 50, offset: 0, filter: 'all', username: null });
	});

	test('チャーム同意状態と日時を表示し、同意を代行変更する操作を持たない', async () => {
		const { container } = await mount();
		const rows = [...container.querySelectorAll('strong')].map(item => item.parentElement!.parentElement!);
		expect(rows[0].textContent).toContain(copy.noteCharmConsented);
		expect(rows[0].querySelector('time')?.dateTime).toBe('2026-10-27T01:23:00.000Z');
		expect(rows[0].querySelector('time')?.textContent).toContain(copy.noteCharmAgreedAt);
		expect(rows[1].textContent).toContain(copy.noteCharmNotConsented);
		expect(rows.every(row => row.querySelectorAll('button, input').length === 0)).toBe(true);
		expect(api.mock.calls.every(([endpoint]) => endpoint === 'admin/hata/consent-list')).toBe(true);
	});

	test.each(['noteCharm', 'noteCharmPending'] as const)('%sでチャームの同意を絞り込み、件数と追加ページを同じ条件で取得する', async filter => {
		const { container } = await mount();
		api.mockResolvedValueOnce({ users: [user('first', filter === 'noteCharm')], total: 2 });
		const target = button(container, filter === 'noteCharm' ? copy.noteCharmConsented : copy.noteCharmNotConsented); target.click(); await settle();
		expect(target.getAttribute('aria-pressed')).toBe('true');
		expect(api).toHaveBeenLastCalledWith('admin/hata/consent-list', { limit: 50, offset: 0, filter, username: null });
		expect(container.textContent).toContain('2');
		api.mockResolvedValueOnce({ users: [user('second', filter === 'noteCharm')], total: 2 }); button(container, copy.loadMore).click(); await settle();
		expect(api).toHaveBeenLastCalledWith('admin/hata/consent-list', { limit: 50, offset: 1, filter, username: null });
		expect([...container.querySelectorAll('strong')].map(item => item.textContent)).toEqual(['first', 'second']);
	});

	test.each(['drawing', 'drawingPending'] as const)('%sは対応するサーバーフィルタを使い選択状態を示す', async filter => {
		const { container } = await mount();
		const target = button(container, filter === 'drawing' ? copy.drawingConsented : copy.drawingNotConsented);
		target.click();
		await settle();
		expect(api).toHaveBeenLastCalledWith('admin/hata/consent-list', { limit: 50, offset: 0, filter, username: null });
		expect(target.getAttribute('aria-pressed')).toBe('true');
		expect(button(container, copy.all).getAttribute('aria-pressed')).toBe('false');
	});

	test('フィルタを素早く切り替えても古い応答で一覧を巻き戻さない', async () => {
		const { container } = await mount();
		let finishOld!: (value: unknown) => void;
		api.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
		button(container, copy.drawingConsented).click();
		api.mockResolvedValueOnce({ users: [user('latestPending', false)], total: 1 });
		button(container, copy.drawingNotConsented).click();
		await settle();
		finishOld({ users: [user('staleAgreed')], total: 1 });
		await settle();
		expect(container.querySelector('strong')?.textContent).toBe('latestPending');
		expect(button(container, copy.drawingNotConsented).getAttribute('aria-pressed')).toBe('true');
	});

	test('追加読み込みは同じHatadintフィルタを保持し現在件数をoffsetに使う', async () => {
		api.mockResolvedValue({ users: [user('first')], total: 2 });
		const { container } = await mount();
		button(container, copy.drawingConsented).click();
		await settle();
		api.mockResolvedValueOnce({ users: [user('second')], total: 2 });
		button(container, copy.loadMore).click();
		await settle();
		expect(api).toHaveBeenLastCalledWith('admin/hata/consent-list', { limit: 50, offset: 1, filter: 'drawing', username: null });
		expect([...container.querySelectorAll('strong')].map(item => item.textContent)).toEqual(['first', 'second']);
	});

	test('検索待ちのままページを閉じたときに後続APIを発行しない', async () => {
		vi.useFakeTimers();
		const { app, container } = await mount();
		const input = container.querySelector('input')!;
		input.value = 'later';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		app.unmount();
		mounts.splice(0);
		container.remove();
		await vi.advanceTimersByTimeAsync(500);
		expect(api).toHaveBeenCalledTimes(1);
	});
});
