/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import SupportManager from './support.vue';
import type { App } from 'vue';
import type { SupportSnapshot } from '@/utility/hatask-support.js';
import { SUPPORT_POLICIES } from '@/utility/hatask-support.js';

const { api, selectUser, confirm } = vi.hoisted(() => ({ api: vi.fn(), selectUser: vi.fn(), confirm: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/os.js', () => ({ selectUser, confirm }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue', 'type'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', { ...attrs, 'data-test-model-value': props.modelValue }, [slots.label?.(), h('input', {
		type: props.type ?? 'text', value: props.modelValue,
		onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
	}), slots.caption?.()]),
}) }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', attrs, [slots.label?.(), h('textarea', {
		value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
	}), slots.caption?.()]),
}) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', attrs, [h('input', {
		type: 'checkbox', checked: props.modelValue,
		onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
	}), slots.label?.(), slots.caption?.()]),
}) }));
vi.mock('@/components/MkSelect.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue', 'items'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', attrs, [slots.label?.(), h('select', {
		value: props.modelValue ?? '', onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value || null),
	}, (props.items as { value: string | null; label: string }[]).map(item => h('option', { value: item.value ?? '' }, item.label)))]),
}) }));
vi.mock('@/components/MkFolder.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['canPage'],
	setup: (_, { attrs, slots }) => () => h('section', attrs, [h('h4', slots.label?.()), slots.default?.()]),
}) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: { disabled: Boolean, wait: Boolean, link: Boolean, to: String }, emits: ['click'],
	setup: (props, { emit, attrs, slots }) => () => h(props.link ? 'a' : 'button', { ...attrs, type: props.link ? undefined : 'button', href: props.link ? props.to : undefined, disabled: props.disabled || props.wait, onClick: (event: MouseEvent) => emit('click', event) }, slots.default?.()),
}) }));

function snapshot(value: number | boolean | null, overrides: Partial<SupportSnapshot> = {}): SupportSnapshot {
	return { value, available: typeof value === 'boolean' ? value : value !== null && value > 0, unlimited: false, condition: null, rateMultiplier: null, ...overrides };
}

function settingsFixture() {
	return {
		enabled: false, navButtonVisible: true, platform: '支援先の名前', url: 'https://support.example.org/', manageUrl: '', intro: '支援の説明',
		bannerVisible: true, bannerTitle: 'ご支援ありがとうございます！', bannerMessage: 'みなさんのご支援が、\nサーバーの運営を支えています。',
		benefits: SUPPORT_POLICIES.map(policy => ({ key: policy.key, title: policy.name, description: policy.description, roleId: 'role-standard' as string | null, visible: true, showBaseline: true })),
	};
}

function responseFixture() {
	return {
		settings: settingsFixture(),
		benefits: SUPPORT_POLICIES.map(policy => ({
			key: policy.key,
			baseline: policy.key === 'driveCapacityMb' ? snapshot(879) : policy.key === 'favoriteFolderLimit' ? snapshot(2) : policy.key === 'emojiRequestLimit' ? snapshot(10) : policy.key === 'mascotMaxPhrases' ? snapshot(10, { available: false, condition: 'mascotUnavailable' }) : snapshot(false),
			offered: (policy.key === 'driveCapacityMb' ? snapshot(5120) : policy.key === 'favoriteFolderLimit' ? snapshot(5) : policy.key === 'emojiRequestLimit' ? snapshot(30) : snapshot(true)) as SupportSnapshot | null,
		})),
		roles: [{ id: 'role-standard', name: '標準特典' }, { id: 'role-extra', name: '追加特典' }],
		rolePreview: null as { id: string; name: string; benefits: { key: string; snapshot: SupportSnapshot }[] } | null,
	};
}

function user(id: string, host: string | null = null) {
	return { id, username: id, name: `利用者${id}`, host, avatarUrl: null, avatarBlurhash: null, avatarDecorations: [], emojis: {}, isSupporter: true };
}

function deferred<T>() {
	let finish!: (value: T) => void;
	let fail!: (reason: Error) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => { finish = resolvePromise; fail = rejectPromise; });
	return { promise, finish, fail };
}

let initialResponse = responseFixture();
let serverUsers = [user('first'), user('second')];
const mounts: { app: App<Element>; container: HTMLDivElement }[] = [];

async function settle() {
	for (let i = 0; i < 5; i++) { await Promise.resolve(); await nextTick(); }
}

async function mount() {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp(SupportManager);
	app.component('PageWithHeader', defineComponent({ setup: (_, { slots }) => () => h('main', [slots.default?.(), slots.footer?.()]) }));
	app.component('SearchMarker', defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }));
	app.component('MkLoading', defineComponent({ setup: () => () => h('div', { role: 'status' }, '読み込み中') }));
	app.component('MkAvatar', defineComponent({ props: ['user'], setup: props => () => h('span', { 'data-native-avatar': props.user.id }) }));
	app.component('MkUserName', defineComponent({ props: ['user'], setup: props => () => h('strong', { 'data-native-user-name': props.user.id }, props.user.name) }));
	app.mount(container);
	mounts.push({ app, container });
	await settle();
	return { app, container };
}

function find<T extends Element>(container: Element, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing rendered element: ${selector}`);
	return element;
}

async function setInput(container: Element, field: string, value: string) {
	const input = find<HTMLInputElement | HTMLTextAreaElement>(container, `[data-support-field="${field}"] input, [data-support-field="${field}"] textarea`);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}

async function chooseRole(container: Element, key: string, role: string) {
	const select = find<HTMLSelectElement>(container, `[data-support-benefit="${key}"] select`);
	select.value = role;
	select.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
}

function callsTo(endpoint: string) { return api.mock.calls.filter(call => call[0] === endpoint); }

beforeEach(() => {
	initialResponse = responseFixture();
	serverUsers = [user('first'), user('second')];
	api.mockReset(); selectUser.mockReset(); confirm.mockReset();
	confirm.mockResolvedValue({ canceled: false });
	selectUser.mockResolvedValue(user('new-local'));
	api.mockImplementation(async (endpoint: string, params: Record<string, unknown> = {}) => {
		if (endpoint === 'admin/hatask/support/show') {
			const result = structuredClone(initialResponse);
			if (params.previewRoleId) result.rolePreview = { id: String(params.previewRoleId), name: '追加特典', benefits: SUPPORT_POLICIES.map(policy => ({ key: policy.key, snapshot: policy.key === 'driveCapacityMb' ? snapshot(params.previewRoleId === 'role-standard' ? 5120 : 10240) : policy.key === 'favoriteFolderLimit' ? snapshot(5) : policy.key === 'emojiRequestLimit' ? snapshot(30) : snapshot(true) })) };
			return result;
		}
		if (endpoint === 'admin/hatask/support/supporters') return { users: serverUsers, total: serverUsers.length, hasMore: false };
		if (endpoint === 'admin/hatask/support/update') return { saved: true };
		if (endpoint === 'admin/hatask/support/register') { serverUsers.push(user(String(params.userId))); return { isSupporter: true }; }
		if (endpoint === 'admin/hatask/support/unregister') { serverUsers = serverUsers.filter(item => item.id !== params.userId); return { isSupporter: false }; }
		throw new Error(`Unexpected endpoint: ${endpoint}`);
	});
});

afterEach(() => {
	for (const { app, container } of mounts.splice(0)) { app.unmount(); container.remove(); }
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('コンパネのHatask支援管理', () => {
	test('Hatask上部ナビの支援情報ボタンを独立して切り替え、保存する', async () => {
		const { container } = await mount();
		const toggle = find<HTMLInputElement>(container, '[data-support-field="navButtonVisible"] input');
		expect(toggle.checked).toBe(true);
		toggle.checked = false;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		expect(callsTo('admin/hatask/support/update')[0][1].settings.navButtonVisible).toBe(false);
		expect(callsTo('admin/hatask/support/update')[0][1].settings.enabled).toBe(false);
	});

	test('初期OFF・未設定でも15項目を非公開の編集行として用意し、実際の標準値を読み取り専用で表示する', async () => {
		initialResponse.settings.benefits = [];
		const { container } = await mount();
		expect(find<HTMLInputElement>(container, '[data-support-field="enabled"] input').checked).toBe(false);
		expect(container.querySelectorAll('[data-support-benefit]')).toHaveLength(15);
		for (const element of container.querySelectorAll<HTMLInputElement>('[data-benefit-field="visible"] input')) expect(element.checked).toBe(false);
		for (const element of container.querySelectorAll<HTMLSelectElement>('[data-benefit-field="roleId"] select')) expect(element.value).toBe('');
		expect(find<HTMLElement>(container, '[data-baseline-preview="driveCapacityMb"]').textContent).toBe('879 MB');
		expect(find<HTMLElement>(container, '[data-baseline-preview="emojiRequestLimit"]').textContent).toBe('10 件 / 7日');
		expect(find<HTMLElement>(container, '[data-baseline-preview="mascotMaxPhrases"]').parentElement?.textContent).toContain('マスコット機能は利用できません');
		expect(container.querySelector('[data-baseline-preview] input')).toBeNull();
		expect(find<HTMLButtonElement>(container, '[data-save-support]').disabled).toBe(true);
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
	});

	test('旧設定に絵文字申請の特典を非公開で補完し、管理者が選んだ場合だけ保存する', async () => {
		initialResponse.settings.benefits = initialResponse.settings.benefits.filter(benefit => benefit.key !== 'emojiRequestLimit');
		const existingBenefits = structuredClone(initialResponse.settings.benefits);
		const { container } = await mount();
		const row = find<HTMLElement>(container, '[data-support-benefit="emojiRequestLimit"]');
		expect(find<HTMLInputElement>(row, '[data-benefit-field="visible"] input').checked).toBe(false);
		expect(find<HTMLSelectElement>(row, '[data-benefit-field="roleId"] select').value).toBe('');
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		await chooseRole(container, 'emojiRequestLimit', 'role-extra');
		expect(find<HTMLElement>(container, '[data-offered-preview="emojiRequestLimit"]').textContent).toBe('30 件 / 7日');
		const visible = find<HTMLInputElement>(row, '[data-benefit-field="visible"] input');
		visible.checked = true;
		visible.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		const saved = callsTo('admin/hatask/support/update')[0][1].settings as ReturnType<typeof settingsFixture>;
		expect(saved.benefits.slice(0, -1)).toEqual(existingBenefits);
		expect(saved.benefits.at(-1)).toMatchObject({ key: 'emojiRequestLimit', roleId: 'role-extra', visible: true, showBaseline: true });
	});

	test('旧設定にお気に入り特典を非公開で補完し、参照ロールのプレビューと保存でも既存設定・利用権限を保つ', async () => {
		const favoriteKeys = ['favoriteFolderLimit', 'canCreateFavoriteSubfolders'];
		initialResponse.settings.benefits = initialResponse.settings.benefits.filter(benefit => !favoriteKeys.includes(benefit.key)).reverse();
		Object.assign(initialResponse.settings.benefits[0], { title: '運営が設定した特典名', description: '既存の説明文', visible: false, showBaseline: false });
		const existingBenefits = structuredClone(initialResponse.settings.benefits);
		const { container } = await mount();
		for (const key of favoriteKeys) {
			const row = find<HTMLElement>(container, `[data-support-benefit="${key}"]`);
			expect(find<HTMLInputElement>(row, '[data-benefit-field="visible"] input').checked).toBe(false);
			expect(find<HTMLSelectElement>(row, '[data-benefit-field="roleId"] select').value).toBe('');
		}
		expect(find<HTMLElement>(container, '[data-baseline-preview="favoriteFolderLimit"]').textContent).toBe('2 個');
		expect(find<HTMLElement>(container, '[data-baseline-preview="canCreateFavoriteSubfolders"]').textContent).toBe('作成できません');
		expect(find<HTMLButtonElement>(container, '[data-save-support]').disabled).toBe(true);
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);

		await chooseRole(container, 'favoriteFolderLimit', 'role-extra');
		await chooseRole(container, 'canCreateFavoriteSubfolders', 'role-extra');
		expect(find<HTMLElement>(container, '[data-offered-preview="favoriteFolderLimit"]').textContent).toBe('5 個');
		expect(find<HTMLElement>(container, '[data-offered-preview="canCreateFavoriteSubfolders"]').textContent).toBe('作成できます');
		expect(callsTo('admin/hatask/support/show').filter(call => call[1].previewRoleId === 'role-extra')).toHaveLength(1);
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		for (const key of favoriteKeys) {
			const visible = find<HTMLInputElement>(container, `[data-support-benefit="${key}"] [data-benefit-field="visible"] input`);
			visible.checked = true;
			visible.dispatchEvent(new Event('change', { bubbles: true }));
		}
		await settle();
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		const saved = callsTo('admin/hatask/support/update')[0][1].settings as ReturnType<typeof settingsFixture>;
		expect(saved.benefits.filter(benefit => !favoriteKeys.includes(benefit.key))).toEqual(existingBenefits);
		expect(saved.benefits.slice(-2)).toEqual(SUPPORT_POLICIES.filter(policy => favoriteKeys.includes(policy.key)).map(policy => ({
			key: policy.key, title: policy.name, description: policy.description, roleId: 'role-extra', visible: true, showBaseline: true,
		})));
		expect({ ...saved, benefits: existingBenefits }).toEqual(initialResponse.settings);
		expect(new Set(api.mock.calls.map(call => call[0]))).toEqual(new Set(['admin/hatask/support/show', 'admin/hatask/support/supporters', 'admin/hatask/support/update']));
	});

	test('OFFへの変更は保存時だけ送信し、特典の設定・支援者の登録を消さない', async () => {
		initialResponse.settings.enabled = true;
		const { container } = await mount();
		const toggle = find<HTMLInputElement>(container, '[data-support-field="enabled"] input');
		toggle.checked = false;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		const saved = callsTo('admin/hatask/support/update')[0][1].settings;
		expect(saved).toEqual({ ...initialResponse.settings, enabled: false });
		expect(container.querySelectorAll('[data-supporter-id]')).toHaveLength(2);
		expect(callsTo('admin/hatask/support/unregister')).toHaveLength(0);
		expect(container.textContent).toContain('設定を保存しました');
	});

	test('保存失敗時にも入力と変更状態を保持し、同じ内容で再試行できる', async () => {
		const { container } = await mount();
		await setInput(container, 'platform', '編集中の支援先');
		api.mockRejectedValueOnce(new Error('save failed'));
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		expect(container.textContent).toContain('入力内容は保持しています');
		expect(find<HTMLInputElement>(container, '[data-support-field="platform"] input').value).toBe('編集中の支援先');
		expect(find<HTMLButtonElement>(container, '[data-save-support]').disabled).toBe(false);
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		expect(callsTo('admin/hatask/support/update')[1][1].settings.platform).toBe('編集中の支援先');
	});

	test('保存中の追加入力を応答で上書きせず、次の未保存変更として残す', async () => {
		const { container } = await mount();
		await setInput(container, 'platform', '送信する内容');
		const waiting = deferred<{ saved: boolean }>();
		api.mockImplementationOnce(() => waiting.promise);
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		await setInput(container, 'platform', '送信後に書いた内容');
		waiting.finish({ saved: true });
		await settle();
		expect(callsTo('admin/hatask/support/update')[0][1].settings.platform).toBe('送信する内容');
		expect(find<HTMLInputElement>(container, '[data-support-field="platform"] input').value).toBe('送信後に書いた内容');
		expect(container.textContent).toContain('その後の変更は未保存です');
		expect(find<HTMLButtonElement>(container, '[data-save-support]').disabled).toBe(false);
	});

	test('参照ロールの変更はサーバー計算のプレビューだけ更新し、入力や現在の選択を古い応答で巻き戻さない', async () => {
		const { container } = await mount();
		await setInput(container, 'platform', '編集を維持');
		const waiting = deferred<ReturnType<typeof responseFixture>>();
		api.mockImplementationOnce(() => waiting.promise);
		await chooseRole(container, 'driveCapacityMb', 'role-extra');
		await chooseRole(container, 'driveCapacityMb', 'role-standard');
		const response = responseFixture();
		response.rolePreview = { id: 'role-extra', name: '追加特典', benefits: [{ key: 'driveCapacityMb', snapshot: snapshot(10240) }] };
		waiting.finish(response);
		await settle();
		expect(find<HTMLSelectElement>(container, '[data-support-benefit="driveCapacityMb"] select').value).toBe('role-standard');
		expect(find<HTMLElement>(container, '[data-offered-preview="driveCapacityMb"]').textContent).toBe('5 GB');
		expect(find<HTMLInputElement>(container, '[data-support-field="platform"] input').value).toBe('編集を維持');
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
	});

	test('参照ロールの読込失敗を表示し、再試行に成功した時だけ新しい設定値を表示する', async () => {
		const { container } = await mount();
		api.mockRejectedValueOnce(new Error('preview failed'));
		await chooseRole(container, 'driveCapacityMb', 'role-extra');
		const row = find<HTMLElement>(container, '[data-support-benefit="driveCapacityMb"]');
		expect(row.textContent).toContain('参照ロールの設定を読み込めませんでした');
		const retry = [...row.querySelectorAll('button')].find(item => item.textContent === '再試行');
		expect(retry).toBeTruthy();
		retry!.click();
		await settle();
		expect(find<HTMLElement>(row, '[data-offered-preview="driveCapacityMb"]').textContent).toBe('10 GB');
	});

	test('削除された参照ロールを勝手に別ロールへ置き換えず、設定IDと再選択の案内を保持する', async () => {
		initialResponse.settings.benefits[0].roleId = 'removed-role';
		initialResponse.benefits[0].offered = null;
		const { container } = await mount();
		const select = find<HTMLSelectElement>(container, '[data-support-benefit="driveCapacityMb"] select');
		expect(select.value).toBe('removed-role');
		expect(select.selectedOptions[0].textContent).toContain('選び直してください');
		expect(find<HTMLElement>(container, '[data-offered-preview="driveCapacityMb"]').textContent).toContain('参照できないロール');
	});

	test('既存のローカルユーザー選択を使って即時登録し、設定保存やロール付与を呼ばない', async () => {
		const { container } = await mount();
		find<HTMLButtonElement>(container, '[data-add-supporter]').click();
		await settle();
		expect(selectUser).toHaveBeenCalledExactlyOnceWith({ includeSelf: true, localOnly: true });
		expect(callsTo('admin/hatask/support/register')[0][1]).toEqual({ userId: 'new-local' });
		expect(container.querySelector('[data-supporter-id="new-local"] [data-native-avatar]')).not.toBeNull();
		expect(container.querySelector('[data-supporter-id="new-local"] [data-native-user-name]')).not.toBeNull();
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		expect(api.mock.calls.some(call => String(call[0]).startsWith('admin/roles/'))).toBe(false);
	});

	test('万一選択結果がリモートユーザーでも登録要求を発行しない', async () => {
		const { container } = await mount();
		selectUser.mockResolvedValueOnce(user('remote', 'remote.example.org'));
		find<HTMLButtonElement>(container, '[data-add-supporter]').click();
		await settle();
		expect(callsTo('admin/hatask/support/register')).toHaveLength(0);
		expect(container.textContent).toContain('ローカルユーザーだけを登録できます');
	});

	test('登録解除を確認し、キャンセルやAPI失敗で一覧を消さず、成功後だけ反映する', async () => {
		const { container } = await mount();
		confirm.mockResolvedValueOnce({ canceled: true });
		find<HTMLButtonElement>(container, '[data-supporter-id="first"] [data-remove-supporter]').click();
		await settle();
		expect(callsTo('admin/hatask/support/unregister')).toHaveLength(0);
		api.mockRejectedValueOnce(new Error('remove failed'));
		find<HTMLButtonElement>(container, '[data-supporter-id="first"] [data-remove-supporter]').click();
		await settle();
		expect(container.querySelector('[data-supporter-id="first"]')).not.toBeNull();
		expect(container.textContent).toContain('登録を外せませんでした');
		find<HTMLButtonElement>(container, '[data-supporter-id="first"] [data-remove-supporter]').click();
		await settle();
		expect(container.querySelector('[data-supporter-id="first"]')).toBeNull();
		expect(confirm.mock.calls[0][0].text).toContain('ロール・利用権限の変更は行いません');
	});

	test('支援者をページングし、重複行を増やさずAPIが返した次のoffsetを保持する', async () => {
		const original = api.getMockImplementation()!;
		api.mockImplementation((endpoint: string, params: Record<string, unknown> = {}) => endpoint === 'admin/hatask/support/supporters' ? Promise.resolve({ users: [user('first')], total: 4, hasMore: true }) : original(endpoint, params));
		const { container } = await mount();
		api.mockResolvedValueOnce({ users: [user('first'), user('second')], total: 4, hasMore: true });
		find<HTMLButtonElement>(container, '[data-load-supporters]').click();
		await settle();
		expect(callsTo('admin/hatask/support/supporters')[1][1]).toEqual({ offset: 1, limit: 30, query: '', registeredOnly: true });
		expect(container.querySelectorAll('[data-supporter-id]')).toHaveLength(2);
		api.mockResolvedValueOnce({ users: [user('last')], total: 4, hasMore: false });
		find<HTMLButtonElement>(container, '[data-load-supporters]').click();
		await settle();
		expect(callsTo('admin/hatask/support/supporters')[2][1].offset).toBe(3);
		expect(container.querySelector('[data-load-supporters]')).toBeNull();
	});

	test('古い検索応答を待機中から無効化し、新しい検索結果だけを反映する', async () => {
		vi.useFakeTimers();
		const { container } = await mount();
		const search = find<HTMLInputElement>(container, '[data-supporter-search] input');
		const waiting = deferred<{ users: ReturnType<typeof user>[]; total: number; hasMore: boolean }>();
		api.mockImplementationOnce(() => waiting.promise);
		search.value = 'old'; search.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(300);
		search.value = 'new'; search.dispatchEvent(new Event('input', { bubbles: true }));
		waiting.finish({ users: [user('old-user')], total: 1, hasMore: false });
		await settle();
		expect(container.textContent).not.toContain('利用者old-user');
		api.mockResolvedValueOnce({ users: [user('new-user')], total: 1, hasMore: false });
		await vi.advanceTimersByTimeAsync(300);
		await settle();
		expect(container.querySelector('[data-supporter-id="new-user"]')).not.toBeNull();
		expect(callsTo('admin/hatask/support/supporters').at(-1)?.[1]).toEqual({ offset: 0, limit: 30, query: 'new', registeredOnly: true });
	});

	test('ページを離れたら検索待機と読込を撤去して後続要求を送らない', async () => {
		vi.useFakeTimers();
		const { app, container } = await mount();
		const search = find<HTMLInputElement>(container, '[data-supporter-search] input');
		search.value = 'later'; search.dispatchEvent(new Event('input', { bubbles: true }));
		app.unmount(); container.remove(); mounts.splice(0);
		const before = api.mock.calls.length;
		await vi.advanceTimersByTimeAsync(400);
		expect(api.mock.calls).toHaveLength(before);
	});

	test('設定の読込失敗を編集可能なサンプルへ置換しない', async () => {
		api.mockRejectedValueOnce(new Error('show failed'));
		const { container } = await mount();
		expect(container.textContent).toContain('支援情報の設定を読み込めませんでした');
		expect(container.querySelector('[data-support-field]')).toBeNull();
		expect(container.querySelector('[data-save-support]')).toBeNull();
	});

	test('不正なURLや空のバナー見出しを保存せず、修正できる入力を保持する', async () => {
		const { container } = await mount();
		await setInput(container, 'url', 'javascript:alert(1)');
		find<HTMLButtonElement>(container, '[data-save-support]').click(); await settle();
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		expect(container.textContent).toContain('認証情報を含まないHTTPS');
		expect(find<HTMLInputElement>(container, '[data-support-field="url"] input').value).toBe('javascript:alert(1)');
		await setInput(container, 'url', 'https://support.example.org/');
		await setInput(container, 'bannerTitle', '');
		find<HTMLButtonElement>(container, '[data-save-support]').click(); await settle();
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		expect(container.textContent).toContain('見出しを入力してください');
	});

	test('保存済みURLの前後空白は送信時だけ取り除き、編集中のmodelを書き換えない', async () => {
		// URL-type inputs sanitize whitespace before an input event. Seed legacy
		// stored data to exercise the save boundary without bypassing HTML rules.
		initialResponse.settings.url = '  https://support.example.org/  ';
		initialResponse.settings.manageUrl = '   ';
		const { container } = await mount();
		expect(find<HTMLInputElement>(container, '[data-support-field="url"] input').value).toBe('https://support.example.org/');
		expect(find<HTMLInputElement>(container, '[data-support-field="manageUrl"] input').value).toBe('');
		await setInput(container, 'platform', '保存する支援先');
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		const saved = callsTo('admin/hatask/support/update')[0][1].settings;
		expect(saved.url).toBe('https://support.example.org/');
		expect(saved.manageUrl).toBe('');
		expect(find<HTMLElement>(container, '[data-support-field="url"]').getAttribute('data-test-model-value')).toBe('  https://support.example.org/  ');
		expect(find<HTMLElement>(container, '[data-support-field="manageUrl"]').getAttribute('data-test-model-value')).toBe('   ');
		expect(find<HTMLButtonElement>(container, '[data-save-support]').disabled).toBe(true);
		await setInput(container, 'url', '   ');
		find<HTMLButtonElement>(container, '[data-save-support]').click();
		await settle();
		expect(callsTo('admin/hatask/support/update')[1][1].settings.url).toBe('');
	});

	test('未保存の見出し・感謝文と表示設定を内容見本へ反映し、保存済みページへの導線を保持する', async () => {
		initialResponse.settings.enabled = true;
		const { container } = await mount();
		await setInput(container, 'bannerTitle', '<img src=x onerror=alert(1)>');
		await setInput(container, 'bannerMessage', 'みなさんのご支援が、\nこの場所を支えています');
		expect(find<HTMLElement>(container, '[data-preview-title]').textContent).toBe('<img src=x onerror=alert(1)>');
		expect(container.querySelector('[data-preview-title] img')).toBeNull();
		expect(find<HTMLElement>(container, '[data-preview-message]').textContent).toBe('みなさんのご支援が、\nこの場所を支えています');
		expect(find<HTMLElement>(container, '[data-preview-enabled]').textContent).toBe('有効');
		expect(find<HTMLElement>(container, '[data-preview-benefits]').textContent).toBe('15件');
		expect(find<HTMLElement>(container, '[data-preview-supporters]').textContent).toBe('2人');
		expect(find<HTMLAnchorElement>(container, '[data-open-saved-support]').getAttribute('href')).toBe('/hatask?tab=support');
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
		const visible = find<HTMLInputElement>(container, '[data-support-field="bannerVisible"] input');
		visible.checked = false; visible.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(container.querySelector('[data-preview-title]')).toBeNull();
		expect(find<HTMLElement>(container, '[data-support-preview]').textContent).toContain('感謝のバナーは非表示になります');
	});

	test.each([
		{ enabled: false, url: 'https://support.example.org/' },
		{ enabled: true, url: '   ' },
	])('OFFまたはURL未設定の見本はバナーではなく未設定案内にする: %j', async ({ enabled, url }) => {
		initialResponse.settings.enabled = enabled;
		initialResponse.settings.url = url;
		const { container } = await mount();
		expect(find<HTMLElement>(container, '[data-preview-unconfigured]').textContent).toBe('このサーバーでは支援情報がありません。\nまた、後ほどご確認ください');
		expect(container.querySelector('[data-preview-title]')).toBeNull();
		expect(container.querySelector('[data-preview-message]')).toBeNull();
		// Preparing the page must not discard the configured banner or people.
		expect(find<HTMLInputElement>(container, '[data-support-field="bannerTitle"] input').value).toBe(initialResponse.settings.bannerTitle);
		expect(find<HTMLElement>(container, '[data-preview-supporters]').textContent).toBe('2人');
		expect(callsTo('admin/hatask/support/update')).toHaveLength(0);
	});

	test('支援者を検索中の件数サマリーを全体の支援者数と誤表示しない', async () => {
		vi.useFakeTimers();
		const { container } = await mount();
		const search = find<HTMLInputElement>(container, '[data-supporter-search] input');
		search.value = 'first'; search.dispatchEvent(new Event('input', { bubbles: true }));
		api.mockResolvedValueOnce({ users: [user('first')], total: 1, hasMore: false });
		await vi.advanceTimersByTimeAsync(300);
		await settle();
		expect(find<HTMLElement>(container, '[data-support-preview]').textContent).toContain('検索に一致した支援者');
		expect(find<HTMLElement>(container, '[data-preview-supporters]').textContent).toBe('1人');
	});

	test('同意管理の直下に管理者だけの項目を置き、ルートにも管理者ガードを持つ', () => {
		const nav = readFileSync(resolve(process.cwd(), 'src/pages/admin/index.vue'), 'utf8');
		const route = readFileSync(resolve(process.cwd(), 'src/router.definition.ts'), 'utf8');
		const guardedNav = (source: string) => /to: '\/admin\/consent-manager',[\s\S]*?\}, \.\.\.\(iAmAdmin \? \[\{[^}]*to: '\/admin\/support'/u.test(source);
		const guardedRoute = (source: string) => /path: '\/support',\s*name: 'support',\s*component: iAmAdmin \? page\(\(\) => import\('@\/pages\/admin\/support\.vue'\)\) : page\(\(\) => import\('@\/pages\/not-found\.vue'\)\)/u.test(source);
		expect(guardedNav(nav)).toBe(true);
		expect(guardedNav(nav.replace('}, ...(iAmAdmin ? [{\n\t\ticon: \'ti ti-heart-handshake\'', '}, ...(true ? [{\n\t\ticon: \'ti ti-heart-handshake\''))).toBe(false);
		expect(guardedRoute(route)).toBe(true);
		expect(guardedRoute(route.replace('component: iAmAdmin ? page(() => import(\'@/pages/admin/support.vue\'))', 'component: true ? page(() => import(\'@/pages/admin/support.vue\'))'))).toBe(false);
	});
});
