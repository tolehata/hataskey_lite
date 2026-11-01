/* SPDX-License-Identifier: AGPL-3.0-only */
/* eslint-disable vue/one-component-per-file -- Components here are isolated dependency stubs and test hosts, not product components. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import Decoration from './avatar-decoration.decoration.vue';
import DecorationDialog from './avatar-decoration.dialog.vue';
import DecorationSettings from './avatar-decoration.vue';
import type { Component, VNode } from 'vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import { ensureSignin } from '@/i.js';
import { useAvatarDecorationClock } from '@/composables/use-avatar-decoration-clock.js';

type DecorationData = InstanceType<typeof Decoration>['$props']['decoration'];
type WornDecoration = { id: string; url: string; angle?: number; availableFrom?: string | null; availableUntil?: string | null };
const mocks = vi.hoisted(() => ({
	account: {
		id: 'owner', username: 'owner', host: null, avatarUrl: 'data:image/svg+xml,<svg/>', avatarBlurhash: null,
		roles: [] as { id: string }[], policies: { avatarDecorationLimit: 3 }, avatarDecorations: [] as WornDecoration[],
	},
	api: vi.fn(), popup: vi.fn(), update: vi.fn(), confirm: vi.fn(), closeDialog: vi.fn(),
}));

vi.mock('@/i.js', async () => {
	const { reactive: accountState } = await import('vue');
	const account = accountState(mocks.account);
	return { ensureSignin: () => account, $i: account };
});
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: {
		avatarDecorations: 'アイコンデコ', retry: '再試行', inUse: '使用中', detachAll: 'すべて外す', areYouSure: '確認',
		angle: '角度', position: '位置', scale: '大きさ', opacity: '透明度', flip: '反転', update: '更新', detach: '外す', attach: 'つける',
		_hataskDecoration: { achievement: 'お花の種の達成で解禁', role: 'ロールが必要', notStarted: '開始前', expired: '期間終了', unlocked: '解禁済み', limited: '期間限定', wearUntil: '着用期限', loadFailed: '読み込めませんでした' },
	},
	tsx: { _profile: { avatarDecorationMax: ({ max }: { max: number }) => `最大${max}` }, remainingN: ({ n }: { n: number }) => `残り${n}` },
} }));
vi.mock('@/preferences.js', () => ({ prefer: { s: {
	animation: false, squareAvatars: false, setFederationAvatarShape: false, showAvatarDecorations: true,
	enableHighQualityImagePlaceholders: false, useBlurEffect: false, showingAnimatedImages: 'always',
	disableShowingAnimatedImages: false, dataSaver: { avatar: false },
} } }));
vi.mock('@/utility/scroll-to-visibility.js', async () => {
	const { ref } = await import('vue');
	return { scrollToVisibility: () => ({ showEl: ref(true) }) };
});
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => url }));
vi.mock('@/filters/user.js', () => ({ acct: () => '@owner', userPage: () => '/@owner' }));
vi.mock('@@/js/extract-avg-color-from-blurhash.js', () => ({ extractAvgColorFromBlurhash: () => undefined }));
vi.mock('@/components/MkImgWithBlurhash.vue', () => ({ default: {} }));
vi.mock('@/components/MkUserOnlineIndicator.vue', () => ({ default: {} }));
vi.mock('@/components/global/MkA.vue', () => ({ default: {} }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({ popup: mocks.popup, apiWithDialog: mocks.update, confirm: mocks.confirm }));
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ inheritAttrs: false, setup: (_, { attrs, slots }) => () => render('button', attrs, slots.default?.()) }) };
});
vi.mock('@/components/MkModalWindow.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ setup: (_, { expose, slots }) => {
		// eslint-disable-next-line id-denylist -- Match the real MkModalWindow public method used by the dialog.
		expose({ close: mocks.closeDialog });
		return () => render('section', { role: 'dialog' }, [slots.header?.(), slots.default?.()]);
	} }) };
});
vi.mock('@/components/MkRange.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ setup: (_, { slots }) => () => render('label', slots.label?.()) }) };
});
vi.mock('@/components/MkSwitch.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ setup: (_, { slots }) => () => render('label', slots.label?.()) }) };
});
vi.mock('@/components/MkInfo.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ setup: (_, { slots }) => () => render('p', slots.default?.()) }) };
});

const NOW = Date.parse('2026-10-12T03:00:00Z');
const cleanups: Array<() => void> = [];
const account = ensureSignin();

function decoration(overrides: Partial<DecorationData> = {}): DecorationData {
	return { id: 'flower', name: 'お花の冠', url: 'data:image/svg+xml,<svg><title>flower</title></svg>', roleIdsThatCanBeUsedThisDecoration: [], canUse: true, ...overrides };
}

function mount(render: () => VNode) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render });
	const slot = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) });
	app.component('MkAvatar', MkAvatar);
	app.component('MkCondensedLine', slot);
	app.component('SearchMarker', slot);
	app.component('MkLoading', defineComponent({ setup: () => () => h('span', '読込中') }));
	app.directive('user-preview', {});
	app.directive('panel', {});
	app.mount(host);
	const dispose = () => { app.unmount(); host.remove(); };
	cleanups.push(dispose);
	return { host, dispose };
}

function button(host: HTMLElement, label?: string): HTMLButtonElement {
	const found = label === undefined
		? host.querySelector<HTMLButtonElement>('button')
		: [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent.trim() === label);
	if (found == null) throw new Error(`Button not found: ${label ?? 'first button'}`);
	return found;
}

async function settle() {
	for (let step = 0; step < 8; step++) await Promise.resolve();
	await nextTick();
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	account.avatarDecorations = [];
	account.roles = [];
	account.policies.avatarDecorationLimit = 3;
	mocks.api.mockReset().mockResolvedValue([]);
	mocks.popup.mockReset().mockReturnValue({ dispose: vi.fn() });
	mocks.update.mockReset();
	mocks.confirm.mockReset().mockResolvedValue({ canceled: false });
	mocks.closeDialog.mockReset();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('avatar decoration selection authorization', () => {
	test('未達成の限定デコを一覧に残し、達成済みデコだけ選択できる', async () => {
		const lockedClick = vi.fn(), availableClick = vi.fn();
		const locked = decoration({ requiresHataskFlowerCompletion: true, canUse: false, unavailableReason: 'achievement' });
		const available = decoration({ id: 'unlocked', name: '解禁した冠', requiresHataskFlowerCompletion: true });
		const { host } = mount(() => h('div', [h(Decoration, { decoration: locked, onClick: lockedClick }), h(Decoration, { decoration: available, onClick: availableClick })]));
		const buttons = host.querySelectorAll<HTMLButtonElement>('button');
		expect(buttons).toHaveLength(2);
		expect(buttons[0].textContent).toContain('お花の冠');
		expect(buttons[0].textContent).toContain('お花の種の達成で解禁');
		expect(buttons[0].disabled).toBe(true);
		expect(buttons[1].disabled).toBe(false);
		buttons[0].click(); buttons[1].click();
		await nextTick();
		expect(lockedClick).not.toHaveBeenCalled();
		expect(availableClick).toHaveBeenCalledOnce();
	});

	test('達成フラグ欠落とロール不一致も選択を許可しない', () => {
		const missing = decoration({ requiresHataskFlowerCompletion: true, canUse: undefined });
		const role = decoration({ roleIdsThatCanBeUsedThisDecoration: ['supporter'] });
		const { host } = mount(() => h('div', [h(Decoration, { decoration: missing }), h(Decoration, { decoration: role })]));
		const buttons = host.querySelectorAll<HTMLButtonElement>('button');
		expect(buttons).toHaveLength(2);
		expect(buttons[0].disabled).toBe(true);
		expect(buttons[1].disabled).toBe(true);
	});

	test('期間の終了時刻に実際のアバター装飾を消し、開いている選択肢も無効にする', async () => {
		const item = decoration({ availableUntil: new Date(NOW + 1000).toISOString() });
		account.avatarDecorations = [{ id: item.id, url: item.url, availableUntil: item.availableUntil }];
		const { host } = mount(() => h('div', [h('div', { 'data-worn-avatar': '' }, [h(MkAvatar, { user: account })]), h(Decoration, { decoration: item })]));
		const selector = button(host);
		expect(host.querySelector('[data-worn-avatar] [data-avatar-decoration]')).not.toBeNull();
		expect(selector.disabled).toBe(false);
		await vi.advanceTimersByTimeAsync(999);
		expect(host.querySelector('[data-worn-avatar] [data-avatar-decoration]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(1);
		await nextTick();
		expect(host.querySelector('[data-worn-avatar] [data-avatar-decoration]')).toBeNull();
		expect(selector.disabled).toBe(true);
		expect(selector.textContent).toContain('期間終了');
	});

	test.each(['attach', 'update'] as const)('開いたダイアログが失効したら %s を拒否し、装着済みなら外せる', async action => {
		const item = decoration({ availableUntil: new Date(NOW + 1000).toISOString() });
		if (action === 'update') account.avatarDecorations = [{ id: item.id, url: item.url }];
		const onAttach = vi.fn(), onUpdate = vi.fn(), onDetach = vi.fn();
		const { host } = mount(() => h(DecorationDialog, { decoration: item, usingIndex: action === 'update' ? 0 : null, onAttach, onUpdate, onDetach }));
		const actionButton = button(host, action === 'update' ? '更新' : 'つける');
		expect(actionButton.disabled).toBe(false);
		await vi.advanceTimersByTimeAsync(1000);
		await nextTick();
		expect(actionButton.disabled).toBe(true);
		// Dispatch even through the disabled control to exercise the handler guard.
		actionButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await nextTick();
		expect(onAttach).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
		expect(mocks.closeDialog).not.toHaveBeenCalled();
		if (action === 'update') {
			button(host, '外す').click();
			await nextTick();
			expect(onDetach).toHaveBeenCalledOnce();
			expect(mocks.closeDialog).toHaveBeenCalledOnce();
		}
	});

	test('失効した装着中の選択肢は取り外し用に開ける', () => {
		const onClick = vi.fn();
		const item = decoration({ availableUntil: new Date(NOW).toISOString() });
		const { host } = mount(() => h(Decoration, { decoration: item, active: true, onClick }));
		const selector = button(host);
		expect(selector.disabled).toBe(false);
		expect(selector.textContent).toContain('期間終了');
		selector.click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	test.each([0, 1000])('装着中のデコが %sms 後に失効すると上限の空きを使って新規装着できる', async remaining => {
		account.policies.avatarDecorationLimit = 2;
		account.avatarDecorations = [
			{ id: 'permanent', url: 'data:image/svg+xml,<svg/>' },
			{ id: 'previous', url: 'data:image/svg+xml,<svg/>', availableUntil: new Date(NOW + remaining).toISOString() },
		];
		const onAttach = vi.fn();
		const { host } = mount(() => h(DecorationDialog, { decoration: decoration(), usingIndex: null, onAttach }));
		const attachButton = button(host, 'つける');
		if (remaining > 0) {
			expect(attachButton.disabled).toBe(true);
			attachButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			expect(onAttach).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(remaining);
			await nextTick();
		}
		expect(attachButton.disabled).toBe(false);
		attachButton.click();
		await nextTick();
		expect(onAttach).toHaveBeenCalledOnce();
		// The dialog counts eligibility without mutating the account before save succeeds.
		expect(account.avatarDecorations.map(item => item.id)).toEqual(['permanent', 'previous']);
	});
});

describe('avatar decoration settings refresh and persistence', () => {
	test('読込失敗を表示して再試行でき、成功後に制限付き一覧を表示する', async () => {
		mocks.api.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([decoration({ canUse: false, unavailableReason: 'achievement' })]);
		const { host } = mount(() => h(DecorationSettings));
		await settle();
		expect(host.querySelector('[role="alert"]')?.textContent).toContain('読み込めませんでした');
		button(host, '再試行').click();
		await settle();
		expect(host.querySelector('[role="alert"]')).toBeNull();
		expect(host.textContent).toContain('お花の冠');
		expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('選択直前の再取得で権限が失われたらダイアログを開かない', async () => {
		mocks.api.mockResolvedValueOnce([decoration()]).mockResolvedValue([decoration({ canUse: false, unavailableReason: 'achievement' })]);
		const { host } = mount(() => h(DecorationSettings));
		await settle();
		button(host).click();
		await settle();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(mocks.popup).not.toHaveBeenCalled();
		expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
	});

	test('開始時刻に再取得し、開始前の選択肢を選択可能にする', async () => {
		const item = decoration({ availableFrom: new Date(NOW + 1000).toISOString() });
		mocks.api.mockResolvedValueOnce([{ ...item, canUse: false, unavailableReason: 'notStarted' }]).mockResolvedValue([item]);
		const { host } = mount(() => h(DecorationSettings));
		await settle();
		expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		await settle();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false);
	});

	test.each(['attach', 'update'] as const)('%s 保存応答の期限情報をアカウントへ保持する', async action => {
		const item = decoration({ availableUntil: new Date(NOW + 10000).toISOString() });
		if (action === 'update') account.avatarDecorations = [{ id: item.id, url: item.url }];
		mocks.api.mockResolvedValue([item]);
		const saved = [{ id: item.id, url: item.url, angle: 0.1, availableFrom: null, availableUntil: item.availableUntil }];
		mocks.update.mockResolvedValue({ avatarDecorations: saved });
		const { host } = mount(() => h(DecorationSettings));
		await settle();
		button(host).click();
		await settle();
		expect(mocks.popup).toHaveBeenCalledOnce();
		const handlers = mocks.popup.mock.calls[0][2] as Record<'attach' | 'update', (payload: object) => Promise<void>>;
		await handlers[action]({ angle: 0.1, flipH: false, offsetX: 0, offsetY: 0, scale: 1, opacity: 1 });
		expect(mocks.update).toHaveBeenCalledWith('i/update', expect.objectContaining({ avatarDecorations: expect.arrayContaining([expect.objectContaining({ id: item.id, angle: 0.1 })]) }));
		expect(account.avatarDecorations).toEqual(saved);
	});

	test('新しいデコの装着時に期限切れの装着データを再送せず、有効なデコを保持する', async () => {
		const previous = decoration({ id: 'previous', name: '以前の冠', availableUntil: new Date(NOW).toISOString() });
		const permanent = decoration({ id: 'permanent', name: 'いつもの冠' });
		const added = decoration({ name: '新しい冠' });
		account.avatarDecorations = [
			{ id: previous.id, url: previous.url, availableUntil: previous.availableUntil },
			{ id: permanent.id, url: permanent.url, angle: 0.2 },
		];
		mocks.api.mockResolvedValue([previous, permanent, added]);
		const saved = [account.avatarDecorations[1], { id: added.id, url: added.url }];
		mocks.update.mockResolvedValue({ avatarDecorations: saved });
		const { host } = mount(() => h(DecorationSettings));
		await settle();
		expect(host.textContent).toContain('残り2');
		const selector = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent.includes(added.name));
		if (selector == null) throw new Error('New decoration selector was not rendered');
		selector.click();
		await settle();
		expect(mocks.popup).toHaveBeenCalledOnce();
		const handlers = mocks.popup.mock.calls[0][2] as { attach: (payload: object) => Promise<void> };
		await handlers.attach({ angle: 0, flipH: false, offsetX: 0, offsetY: 0, scale: 1, opacity: 1 });
		expect(mocks.update).toHaveBeenCalledOnce();
		const request = mocks.update.mock.calls[0][1] as { avatarDecorations: WornDecoration[] };
		expect(request.avatarDecorations.map(item => item.id)).toEqual(['permanent', 'flower']);
		expect(request.avatarDecorations[0].angle).toBe(0.2);
		expect(account.avatarDecorations).toEqual(saved);
	});
});

describe('avatar decoration boundary timer lifetime', () => {
	test('通常の装飾にはタイマーを作らず、期限変更と破棄で古い予約を解除する', async () => {
		const entries = reactive<WornDecoration[]>([{ id: 'plain', url: 'data:image/svg+xml,<svg/>' }]);
		const boundary = vi.fn();
		const Clock: Component = defineComponent({ setup: () => {
			useAvatarDecorationClock(() => entries, boundary);
			return () => h('span');
		} });
		mount(() => h(Clock));
		expect(vi.getTimerCount()).toBe(0);
		entries[0].availableUntil = new Date(NOW + 1000).toISOString();
		await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		entries[0].availableUntil = new Date(NOW + 2000).toISOString();
		await nextTick();
		await vi.advanceTimersByTimeAsync(1000);
		expect(boundary).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		const dispose = cleanups.pop();
		if (dispose == null) throw new Error('Timer fixture cleanup was not registered');
		dispose();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(2000);
		expect(boundary).not.toHaveBeenCalled();
	});
});
