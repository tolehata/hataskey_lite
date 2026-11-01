/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- These lightweight test stubs isolate the page's state and API behavior. */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskManager from './hatask.vue';
import type { App } from 'vue';

const { api, confirm } = vi.hoisted(() => ({ api: vi.fn(), confirm: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/os.js', () => ({ confirm }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/i.js', () => ({ ensureSignin: () => ({ id: 'admin' }) }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue', 'type', 'disabled'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', attrs, [slots.label?.(), h('input', {
		type: props.type, value: props.modelValue, disabled: props.disabled,
		onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
	}), slots.caption?.()]),
}) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: ['modelValue', 'disabled'], emits: ['update:modelValue'],
	setup: (props, { emit, attrs, slots }) => () => h('label', attrs, [h('input', {
		type: 'checkbox', checked: props.modelValue, disabled: props.disabled,
		onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
	}), slots.label?.(), slots.caption?.()]),
}) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({
	inheritAttrs: false, props: { disabled: Boolean, wait: Boolean, link: Boolean, to: { type: String, default: '' } }, emits: ['click'],
	setup: (props, { emit, attrs, slots }) => () => h(props.link ? 'a' : 'button', {
		...attrs, type: 'button', href: props.link ? props.to : undefined,
		disabled: props.disabled || props.wait, onClick: (event: MouseEvent) => emit('click', event),
	}, slots.default?.()),
}) }));

function fixture() {
	return ['first', 'second'].map(id => ({
		id, name: id, description: `${id}のデコ`, url: `https://example.com/${id}.webp`, roleIdsThatCanBeUsedThisDecoration: [],
		requiresHataskFlowerCompletion: false, availableFrom: null as string | null, availableUntil: null as string | null,
	}));
}

let decorations = fixture();
const mounts: { app: App<Element>; container: HTMLDivElement }[] = [];

async function settle() {
	for (let i = 0; i < 5; i++) { await Promise.resolve(); await nextTick(); }
}

async function mount() {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp(HataskManager);
	app.component('PageWithHeader', defineComponent({ setup: (_, { slots }) => () => h('main', slots.default?.()) }));
	app.component('SearchMarker', defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }));
	app.component('MkLoading', defineComponent({ setup: () => () => h('div', { role: 'status' }, '読み込み中') }));
	app.component('MkAvatar', defineComponent({ props: ['decorations'], setup: props => () => h('span', { 'data-preview-url': props.decorations[0].url }) }));
	app.mount(container);
	mounts.push({ app, container });
	await settle();
	return container;
}

function find<T extends Element>(container: Element, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing rendered element: ${selector}`);
	return element;
}

async function toggle(container: Element, selector: string, value: boolean) {
	const input = find<HTMLInputElement>(container, `${selector} input`);
	input.checked = value;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
}

async function date(container: Element, selector: string, value: string) {
	const input = find<HTMLInputElement>(container, `${selector} input`);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}

async function select(container: Element, id: string) {
	find<HTMLButtonElement>(container, `[data-decoration-select] [data-decoration-id="${id}"]`).click();
	await settle();
}

async function replaceWith(container: Element, id: string) {
	find<HTMLButtonElement>(container, '[data-replace]').click();
	await settle();
	find<HTMLButtonElement>(container, `[data-replacement-picker] [data-replacement-id="${id}"]`).click();
	await settle();
}

function saveCalls() { return api.mock.calls.filter(call => call[0] === 'admin/hatask/update-decoration'); }

beforeEach(() => {
	decorations = fixture();
	api.mockReset();
	confirm.mockReset().mockResolvedValue({ canceled: false });
	api.mockImplementation(async (endpoint: string) => {
		if (endpoint === 'admin/avatar-decorations/list') return structuredClone(decorations);
		if (endpoint === 'admin/hatask/update-decoration') return;
		throw new Error(`Unexpected endpoint: ${endpoint}`);
	});
});

afterEach(() => {
	for (const { app, container } of mounts.splice(0)) { app.unmount(); container.remove(); }
});

describe('Hatask管理のアイコンデコ設定', () => {
	test('一覧の読み込み失敗を空一覧と区別し、再試行後に選択できる', async () => {
		api.mockRejectedValueOnce(new Error('network'));
		const container = await mount();
		expect(container.textContent).toContain('読み込めませんでした');
		expect(container.querySelector('[data-save]')).toBeNull();
		find<HTMLButtonElement>(container, '[data-retry]').click();
		await settle();
		expect(find<HTMLButtonElement>(container, '[data-decoration-id="first"]').getAttribute('aria-pressed')).toBe('true');
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(true);
	});

	test('名前と画像を見ながら選択でき、通常の管理画面にも移動できる', async () => {
		const container = await mount();
		const first = find<HTMLButtonElement>(container, '[data-decoration-select] [data-decoration-id="first"]');
		const second = find<HTMLButtonElement>(container, '[data-decoration-select] [data-decoration-id="second"]');
		expect(first.textContent).toContain('first');
		expect(second.textContent).toContain('second');
		expect(find<HTMLElement>(first, '[data-preview-url]').getAttribute('data-preview-url')).toBe(decorations[0].url);
		expect(find<HTMLElement>(second, '[data-preview-url]').getAttribute('data-preview-url')).toBe(decorations[1].url);
		expect(first.getAttribute('aria-pressed')).toBe('true');
		expect(second.getAttribute('aria-pressed')).toBe('false');
		await select(container, 'second');
		expect(first.getAttribute('aria-pressed')).toBe('false');
		expect(second.getAttribute('aria-pressed')).toBe('true');
		expect(find<HTMLAnchorElement>(container, 'a[href="/admin/avatar-decorations"]')).toBeTruthy();
	});

	test('登録がない場合はデコの登録先を案内する', async () => {
		decorations = [];
		const container = await mount();
		expect(find<HTMLAnchorElement>(container, 'a').getAttribute('href')).toBe('/admin/avatar-decorations');
		expect(container.querySelector('[data-save]')).toBeNull();
	});

	test('選んだデコだけ達成者限定にし、保存前の切り替えでも入力を保持する', async () => {
		const container = await mount();
		expect(container.textContent).toContain('解禁後は季節が変わっても使えます');
		await toggle(container, '[data-completion]', true);
		await select(container, 'second');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(false);
		await select(container, 'first');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(1);
		expect(saveCalls()[0][1]).toEqual({ id: 'first', requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: null });
		expect(container.textContent).toContain('設定を保存しました');
	});

	test('終了未入力と逆転した日時を止め、正しい期間だけUTCに変換して保存する', async () => {
		const container = await mount();
		await toggle(container, '[data-period]', true);
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(true);
		await date(container, '[data-start]', '2026-11-10T12:00');
		await date(container, '[data-end]', '2026-11-10T11:59');
		expect(container.textContent).toContain('終了日時は開始日時より後');
		find<HTMLButtonElement>(container, '[data-save]').click();
		expect(saveCalls()).toHaveLength(0);
		await date(container, '[data-end]', '2026-11-10T12:01');
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()[0][1]).toMatchObject({
			availableFrom: new Date('2026-11-10T12:00').toISOString(),
			availableUntil: new Date('2026-11-10T12:01').toISOString(),
		});
	});

	test('開始なしの期限を設定でき、期間OFFの保存で期限を解除する', async () => {
		const container = await mount();
		await toggle(container, '[data-period]', true);
		await date(container, '[data-end]', '2026-11-10T12:00');
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()[0][1]).toMatchObject({ availableFrom: null, availableUntil: new Date('2026-11-10T12:00').toISOString() });
		await toggle(container, '[data-period]', false);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()[1][1]).toMatchObject({ availableFrom: null, availableUntil: null });
	});

	test('達成条件だけ変更したとき既存の日時の秒やミリ秒を変えない', async () => {
		decorations[0].availableFrom = '2026-11-01T00:00:12.345Z';
		decorations[0].availableUntil = '2026-11-10T00:00:34.567Z';
		const container = await mount();
		await toggle(container, '[data-completion]', true);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()[0][1]).toMatchObject({ availableFrom: decorations[0].availableFrom, availableUntil: decorations[0].availableUntil });
	});

	test('保存失敗時も入力を保持して再試行できる', async () => {
		const container = await mount();
		await toggle(container, '[data-completion]', true);
		api.mockRejectedValueOnce(new Error('save rejected'));
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(container.textContent).toContain('入力内容は保持しています');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(false);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(2);
		expect(container.textContent).toContain('設定を保存しました');
	});

	test('通常のデコを特典にする保存は着用者から外れることを確認し、キャンセルなら送らず入力を保つ', async () => {
		const container = await mount();
		await toggle(container, '[data-completion]', true);
		confirm.mockResolvedValueOnce({ canceled: true });
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(confirm).toHaveBeenCalledOnce();
		expect(confirm.mock.calls[0][0].text).toContain('お花図鑑を達成していない人');
		expect(saveCalls()).toHaveLength(0);
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(false);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(1);
	});

	test('期間を過去で終えると全員から外れることを確認する', async () => {
		const container = await mount();
		await toggle(container, '[data-period]', true);
		await date(container, '[data-end]', '2020-01-01T00:00');
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(confirm).toHaveBeenCalledOnce();
		expect(confirm.mock.calls[0][0].text).toContain('期間外になる全員');
		expect(saveCalls()).toHaveLength(1);
	});

	test('着用者に影響しない保存では確認を出さない', async () => {
		decorations[0].requiresHataskFlowerCompletion = true;
		const container = await mount();
		await toggle(container, '[data-period]', true);
		await date(container, '[data-end]', '2999-01-01T00:00');
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(confirm).not.toHaveBeenCalled();
		expect(saveCalls()).toHaveLength(1);
	});

	test('保存中の二重送信と別デコへの切り替えを止める', async () => {
		const container = await mount();
		await toggle(container, '[data-completion]', true);
		let finish!: () => void;
		api.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(true);
		expect(find<HTMLButtonElement>(container, '[data-decoration-id="second"]').disabled).toBe(true);
		expect(find<HTMLInputElement>(container, '[data-completion] input').disabled).toBe(true);
		find<HTMLButtonElement>(container, '[data-save]').click();
		expect(saveCalls()).toHaveLength(1);
		finish();
		await settle();
		expect(find<HTMLButtonElement>(container, '[data-decoration-id="second"]').disabled).toBe(false);
	});

	test('特典デコの差し替えは編集中の期間と旧IDを一度に送り、旧デコの期間を保持する', async () => {
		decorations[0].requiresHataskFlowerCompletion = true;
		decorations[0].availableFrom = '2026-11-01T00:00:12.345Z';
		decorations[0].availableUntil = '2026-11-10T00:00:34.567Z';
		const container = await mount();
		const originalStart = find<HTMLInputElement>(container, '[data-start] input').value;
		const originalEnd = find<HTMLInputElement>(container, '[data-end] input').value;
		await date(container, '[data-end]', '2026-11-30T12:00');
		await replaceWith(container, 'second');
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(1);
		expect(saveCalls()[0][1]).toEqual({
			id: 'second', replaceFromId: 'first', requiresHataskFlowerCompletion: true,
			availableFrom: decorations[0].availableFrom,
			availableUntil: new Date('2026-11-30T12:00').toISOString(),
		});
		expect(find<HTMLButtonElement>(container, '[data-decoration-id="second"]').getAttribute('aria-pressed')).toBe('true');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		await select(container, 'first');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(false);
		expect(find<HTMLInputElement>(container, '[data-start] input').value).toBe(originalStart);
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe(originalEnd);
	});

	test('差し替え失敗時は元の特典と選んだ候補・編集中の期間を保持して再試行できる', async () => {
		decorations[0].requiresHataskFlowerCompletion = true;
		const container = await mount();
		await toggle(container, '[data-period]', true);
		await date(container, '[data-end]', '2026-11-30T12:00');
		await replaceWith(container, 'second');
		api.mockRejectedValueOnce(new Error('replacement rejected'));
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(1);
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe('2026-11-30T12:00');
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(false);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()).toHaveLength(2);
		expect(saveCalls()[1][1]).toEqual(saveCalls()[0][1]);
		expect(saveCalls()[1][1]).toMatchObject({ id: 'second', replaceFromId: 'first', requiresHataskFlowerCompletion: true });
		await select(container, 'first');
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(false);
	});

	test('差し替えのキャンセルではAPIを呼ばず元の編集中の期間に戻れる', async () => {
		decorations[0].requiresHataskFlowerCompletion = true;
		const container = await mount();
		await toggle(container, '[data-period]', true);
		await date(container, '[data-end]', '2026-11-30T12:00');
		await replaceWith(container, 'second');
		find<HTMLButtonElement>(container, '[data-cancel-replacement]').click();
		await settle();
		expect(saveCalls()).toHaveLength(0);
		expect(container.querySelector('[data-replacement-picker]')).toBeNull();
		expect(find<HTMLButtonElement>(container, '[data-decoration-id="first"]').getAttribute('aria-pressed')).toBe('true');
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe('2026-11-30T12:00');
	});

	test('指定解除のキャンセルと失敗で特典・入力を保ち、成功時は保存済み期間だけを送る', async () => {
		decorations[0].requiresHataskFlowerCompletion = true;
		decorations[0].availableUntil = '2026-11-10T00:00:34.567Z';
		const container = await mount();
		await date(container, '[data-end]', '2026-11-30T12:00');
		confirm.mockResolvedValueOnce({ canceled: true });
		find<HTMLButtonElement>(container, '[data-remove-reward]').click();
		await settle();
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(saveCalls()).toHaveLength(0);
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe('2026-11-30T12:00');
		api.mockRejectedValueOnce(new Error('unassign rejected'));
		find<HTMLButtonElement>(container, '[data-remove-reward]').click();
		await settle();
		expect(saveCalls()).toHaveLength(1);
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(true);
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe('2026-11-30T12:00');
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		find<HTMLButtonElement>(container, '[data-remove-reward]').click();
		await settle();
		expect(saveCalls()).toHaveLength(2);
		expect(saveCalls()[1][1]).toEqual({ id: 'first', requiresHataskFlowerCompletion: false, availableFrom: null, availableUntil: decorations[0].availableUntil });
		expect(find<HTMLInputElement>(container, '[data-completion] input').checked).toBe(false);
		expect(find<HTMLInputElement>(container, '[data-end] input').value).toBe('2026-11-30T12:00');
		expect(find<HTMLButtonElement>(container, '[data-save]').disabled).toBe(false);
		find<HTMLButtonElement>(container, '[data-save]').click();
		await settle();
		expect(saveCalls()[2][1]).toMatchObject({ id: 'first', requiresHataskFlowerCompletion: false, availableUntil: new Date('2026-11-30T12:00').toISOString() });
	});
});
