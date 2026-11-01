/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import type { App } from 'vue';
import MkUISetup from './MkUISetup.vue';

const state = vi.hoisted(() => ({
	storage: new Map<string, string>(),
	prefer: { s: { animation: true, useBlurEffect: true, useBlurEffectForModal: true } },
}));

vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => state.storage.get(key) ?? null,
	setItem: (key: string, value: string) => state.storage.set(key, value),
} }));
vi.mock('@/preferences.js', () => ({ prefer: state.prefer }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: {
		close: '閉じる', recommended: '推奨', inUse: '使用中', goBack: '戻る',
		_hata: { _uiSetup: {
			title: 'UIを切り替える', hint: '使いたいUIを選んで切り替え', standardDescription: 'HataskeyのデフォルトUIで、使う楽しさを追求します',
			ui3Description: '美しさと利便性を追求、S(Special)な体験を', otherUis: 'その他のUI', conflictNote: '競合する場合があります',
			notRecommended: '非推奨', legacyDeck: '従来のデッキUI', deprecatedWarning: 'このUIは非推奨です。',
			switchAction: '切り替える',
		} },
	},
	tsx: { _hata: { _uiSetup: { switchConfirm: ({ ui }: { ui: string }) => `${ui} に切り替えますか？` } } },
} }));
vi.mock('@/components/MkModal.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: { disableBgBlur: Boolean },
		emits: ['click', 'esc', 'closed'],
		setup(props, { slots, emit, expose }) {
			expose({ close: () => emit('closed') });
			return () => h('div', { 'data-modal': true, 'data-disable-bg-blur': String(props.disableBgBlur), onKeydown: (event: KeyboardEvent) => {
				if (event.key === 'Escape') emit('esc', event);
			} }, slots.default?.());
		},
	}) };
});

describe('UI切り替えモーダル', () => {
	let app: App | undefined;
	let host: HTMLDivElement;
	let closed: ReturnType<typeof vi.fn>;
	let reload: ReturnType<typeof vi.spyOn>;
	let assign: ReturnType<typeof vi.spyOn>;
	let finishExit: () => void;
	let cancelExit: ReturnType<typeof vi.fn>;
	let animate: ReturnType<typeof vi.fn<HTMLElement['animate']>>;

	async function settle() {
		await new Promise(resolve => setTimeout(resolve, 25));
		await nextTick();
	}

	async function mount(embedded = false) {
		closed = vi.fn();
		app = createApp(MkUISetup, { embedded, onClosed: closed });
		app.mount(host);
		await nextTick();
	}
	function unmountCurrent() {
		app?.unmount();
		app = undefined;
	}

	function button(text: string) {
		const result = [...host.querySelectorAll('button')].find(node => node.textContent?.includes(text));
		if (!result) throw new Error(`Button not found: ${text}`);
		return result;
	}

	beforeEach(() => {
		state.storage.clear();
		state.storage.set('ui', 'simple');
		state.storage.set('ui_setup_completed', 'true');
		state.prefer.s.animation = true;
		state.prefer.s.useBlurEffect = true;
		state.prefer.s.useBlurEffectForModal = true;
		host = document.createElement('div');
		document.body.append(host);
		reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
		assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		animate = vi.fn<HTMLElement['animate']>(() => {
			let rejectExit: (reason?: unknown) => void;
			const finished = new Promise<void>((resolve, reject) => { finishExit = resolve; rejectExit = reject; });
			cancelExit = vi.fn(() => rejectExit());
			return { finished, cancel: cancelExit } as unknown as Animation;
		});
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
		vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(animate);
	});

	afterEach(() => {
		app?.unmount();
		app = undefined;
		host.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test('アニメーション終了まで保存を待ち、連続選択でも一度だけ切り替える', async () => {
		await mount();
		button('Hataskey UI S').click();
		button('Hataskey UI S').click();
		expect(animate).toHaveBeenCalledTimes(1);
		expect(state.storage.get('ui')).toBe('simple');
		expect(assign).not.toHaveBeenCalled();
		finishExit();
		await settle();
		expect(state.storage.get('ui')).toBe('hataskey3');
		expect(assign).toHaveBeenCalledExactlyOnceWith('/');
		button('Hataskey UI S').click();
		expect(assign).toHaveBeenCalledTimes(1);
	});

	test('ガラス表示はぼかし設定に従い、背景のぼかしは共通モーダルへ任せる', async () => {
		await mount();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('data-glass')).toBe('true');
		expect(host.querySelector('[data-modal]')?.getAttribute('data-disable-bg-blur')).toBe('false');
		expect(host.textContent).toContain('HataskeyのデフォルトUIで、使う楽しさを追求します');
		expect(host.textContent).toContain('美しさと利便性を追求、S(Special)な体験を');
		expect(host.textContent).not.toContain('Beta');
		unmountCurrent();
		state.prefer.s.useBlurEffectForModal = false;
		await mount();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('data-glass')).toBe('false');
		unmountCurrent();
		state.prefer.s.useBlurEffectForModal = true;
		state.prefer.s.useBlurEffect = false;
		await mount();
		expect(host.querySelector('[role="dialog"]')?.getAttribute('data-glass')).toBe('false');
	});

	test('非推奨UIは確認で戻れる。確定してから保存する', async () => {
		await mount();
		button('Misskey UI').click();
		await settle();
		expect(host.textContent).toContain('このUIは非推奨です。');
		expect(document.activeElement).toBe(button('戻る'));
		button('戻る').click();
		await settle();
		expect(document.activeElement).toBe(button('Misskey UI'));
		expect(state.storage.get('ui')).toBe('simple');
		button('Misskey UI').click();
		await settle();
		button('切り替える').click();
		expect(reload).not.toHaveBeenCalled();
		finishExit();
		await settle();
		expect(state.storage.get('ui')).toBe('default');
		expect(reload).toHaveBeenCalledTimes(1);
	});

	test.each(['preference', 'system'])('動きを減らす設定（%s）ではアニメーションを待たない', async mode => {
		if (mode === 'preference') state.prefer.s.animation = false;
		else vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
		await mount();
		button('Hataskey UI S').click();
		await settle();
		expect(animate).not.toHaveBeenCalled();
		expect(assign).toHaveBeenCalledTimes(1);
	});

	test('同じUIの選択でも初回セットアップを完了し、リロードしない', async () => {
		state.storage.delete('ui_setup_completed');
		await mount();
		button('Hataskey UI').click();
		await settle();
		expect(state.storage.get('ui_setup_completed')).toBe('true');
		expect(closed).toHaveBeenCalledTimes(1);
		expect(reload).not.toHaveBeenCalled();
	});

	test('退出中にアンマウントされたら保存やナビゲーションを中止する', async () => {
		await mount();
		button('Hataskey UI S').click();
		app?.unmount();
		app = undefined;
		await settle();
		expect(cancelExit).toHaveBeenCalledTimes(1);
		expect(state.storage.get('ui')).toBe('simple');
		expect(assign).not.toHaveBeenCalled();
	});

	test('埋め込み表示で選択クリックが閉じる操作に伝播しない', async () => {
		await mount(true);
		button('Hataskey UI S').click();
		expect(closed).not.toHaveBeenCalled();
		finishExit();
		await settle();
		expect(assign).toHaveBeenCalledTimes(1);
	});

	test('モーダルの外枠にフォーカスがあってもEscで閉じる', async () => {
		await mount();
		host.querySelector('[data-modal]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(closed).toHaveBeenCalledTimes(1);
	});
});
