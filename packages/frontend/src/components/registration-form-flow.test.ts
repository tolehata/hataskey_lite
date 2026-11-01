/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Component, VNode } from 'vue';
import { instance } from '@/instance.js';
import Application from './MkRegistrationApplication.vue';
import Signup from './MkSignupDialog.form.vue';

const mocks = vi.hoisted(() => ({ api: vi.fn(), alert: vi.fn(), fetch: vi.fn(), login: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({ alert: mocks.alert }));
vi.mock('@/accounts.js', () => ({ login: mocks.login }));
vi.mock('@@/js/config.js', () => ({ host: 'example.test', apiUrl: '/api' }));
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive({ disableRegistration: true, registrationClosed: false, emailRequiredForSignup: false,
		enableHcaptcha: false, enableMcaptcha: false, enableRecaptcha: false, enableTurnstile: false, enableTestcaptcha: false }), fetchInstance: vi.fn() };
});
vi.mock('@/i18n.js', () => {
	const words = new Proxy({}, { get: (_, key) => String(key) });
	return { i18n: { ts: { ...words, _hata: { _registrationApplications: { _application: words, _flow: words } }, _signup: words }, tsx: { _signup: { emailSent: ({ email }: { email: string }) => email } } } };
});
vi.mock('@/utility/hatakyu-assets.js', () => ({ useHatakyuBranding: () => false }));
vi.mock('@/components/MkRegistrationRules.vue', async () => {
	const { h } = await import('vue');
	return { default: { render: () => h('div', [h('button', { 'aria-controls': 'registration-rules' }, '規約')]) } };
});
vi.mock('@/components/MkButton.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkInput.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkInfo.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkCaptcha.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkHatakyuIllustration.vue', () => ({ default: { render: () => null } }));

type FormState = {
	step: string; username: string; usernameState: string | null; email: string; emailState: string | null;
	password: string; retypedPassword: string; passwordRetypeState: string | null; invitationCode: string;
	reason: string; additionalContacts: string; hasAdminRelationship: boolean; agreementsAccepted: boolean;
	hCaptchaResponse: string | null; mCaptchaResponse: string | null; reCaptchaResponse: string | null;
	turnstileResponse: string | null; testcaptchaResponse: string | null; submitting: boolean;
	shouldDisableSubmitting: boolean; onAgreementChange: (value: boolean) => void;
	onChangeUsername: () => void; onChangeEmail: () => void; onRulesDone: () => void; reviewInput: () => void; onSubmit: () => Promise<void>;
};
const cleanups: (() => void)[] = [];

function mount(component: Component, initialProps: Record<string, unknown> = {}, realDOM = false) {
	let state!: FormState;
	const props = reactive(initialProps);
	const originalRender = (component as { render: (...args: unknown[]) => VNode }).render;
	const subject = { ...component, render(this: unknown, ...args: unknown[]) {
		state = args[3] as FormState;
		return realDOM ? originalRender.apply(this, args) : h('div');
	} };
	const container = window.document.createElement('div');
	if (realDOM) {
		container.style.overflowY = 'auto';
		window.document.body.append(container);
	}
	const scroll = vi.fn((optionsOrX?: ScrollToOptions | number, y?: number) => {
		container.scrollTop = typeof optionsOrX === 'number' ? y ?? 0 : optionsOrX?.top ?? container.scrollTop;
	});
	if (realDOM) container.scroll = scroll;
	const app = createApp({ render: () => h(subject, props) });
	app.mount(container);
	const unmount = () => { app.unmount(); container.remove(); };
	cleanups.push(unmount);
	return { state, props, unmount, container, scroll };
}

function fill(state: FormState) {
	state.username = 'member'; state.usernameState = 'ok'; state.email = 'member@example.test'; state.emailState = 'ok';
	state.password = 'Password123'; state.retypedPassword = 'Password123'; state.reason = '参加したいです'; state.invitationCode = 'invite';
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

async function flush() { await Promise.resolve(); await nextTick(); await Promise.resolve(); }

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(instance, { disableRegistration: true, registrationClosed: false, emailRequiredForSignup: false,
		enableHcaptcha: false, enableMcaptcha: false, enableRecaptcha: false, enableTurnstile: false, enableTestcaptcha: false });
	mocks.api.mockResolvedValue({ available: true });
	mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: 'test-token' }) });
	vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.unstubAllGlobals(); });

const captchaProviders = [
	{ enabled: 'enableHcaptcha', response: 'hCaptchaResponse', payload: 'hcaptcha-response' },
	{ enabled: 'enableMcaptcha', response: 'mCaptchaResponse', payload: 'm-captcha-response' },
	{ enabled: 'enableRecaptcha', response: 'reCaptchaResponse', payload: 'g-recaptcha-response' },
	{ enabled: 'enableTurnstile', response: 'turnstileResponse', payload: 'turnstile-response' },
	{ enabled: 'enableTestcaptcha', response: 'testcaptchaResponse', payload: 'testcaptcha-response' },
] as const;

describe.each([
	{ name: '申請', component: Application, application: true },
	{ name: '招待登録', component: Signup, application: false },
])('$nameのCAPTCHA', form => {
	function prepare(provider: typeof captchaProviders[number]) {
		instance[provider.enabled] = true;
		const { state } = mount(form.component, { agreementsAccepted: true });
		fill(state);
		if (form.application) state.onAgreementChange(true);
		state.step = 'input';
		return state;
	}

	test.each(captchaProviders)('$enabledはトークン取得まで確認と送信を止め、取得後は正しいキーで送信する', async provider => {
		const state = prepare(provider);
		expect(state.shouldDisableSubmitting).toBe(true);
		state.reviewInput();
		expect(state.step).toBe('input');
		await state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
		expect(mocks.fetch).not.toHaveBeenCalled();

		const token = `${provider.enabled}-token`;
		state[provider.response] = token;
		expect(state.shouldDisableSubmitting).toBe(false);
		state.reviewInput();
		expect(state.step).toBe('review');
		expect(mocks.api).not.toHaveBeenCalled();
		expect(mocks.fetch).not.toHaveBeenCalled();
		await state.onSubmit();
		let payload: Record<string, unknown>;
		if (form.application) {
			expect(mocks.api).toHaveBeenCalledExactlyOnceWith('registration/apply', expect.any(Object), null);
			expect(mocks.fetch).not.toHaveBeenCalled();
			payload = mocks.api.mock.calls[0][1];
		} else {
			expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/signup', expect.objectContaining({ method: 'POST' }));
			expect(mocks.api).not.toHaveBeenCalled();
			payload = JSON.parse(mocks.fetch.mock.calls[0][1].body);
		}
		for (const other of captchaProviders) expect(payload[other.payload]).toBe(other === provider ? token : null);
	});

	test.each(captchaProviders)('$enabledは確認中のトークン失効で最終送信を止める', async provider => {
		const state = prepare(provider);
		state[provider.response] = 'valid-token';
		state.reviewInput();
		expect(state.step).toBe('review');
		expect(state.shouldDisableSubmitting).toBe(false);
		state[provider.response] = null;
		expect(state.shouldDisableSubmitting).toBe(true);
		await state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
});

describe('申請の入力・最終確認', () => {
	test.each([
		{ from: 'agreements', to: 'input', heading: 'inputTitle' },
		{ from: 'input', to: 'review', heading: 'reviewTitle' },
		{ from: 'review', to: 'input', heading: 'inputTitle' },
		{ from: 'input', to: 'agreements', heading: null },
	])('$fromから$toへ切り替えた描画後にフォーカスしてスクロールを先頭に戻す', async ({ from, to, heading }) => {
		const { state, container, scroll } = mount(Application, {}, true);
		fill(state);
		state.onAgreementChange(true);
		state.step = from;
		await flush();
		container.scrollTop = 480;
		scroll.mockClear();
		if (from === 'agreements') state.onRulesDone();
		else if (to === 'review') state.reviewInput();
		else state.step = to;
		await flush();

		expect(state.step).toBe(to);
		const focusTarget = heading
			? Array.from(container.querySelectorAll('h2')).find(element => element.textContent === heading)
			: container.querySelector('button[aria-controls]');
		expect(focusTarget?.isConnected).toBe(true);
		expect(window.document.activeElement).toBe(focusTarget);
		expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
		expect(container.scrollTop).toBe(0);
	});
	test('非表示の親の中ではステップを変えてもフォーカスとスクロールを奪わない', async () => {
		const { state, container, scroll } = mount(Application, {}, true);
		fill(state);
		state.onAgreementChange(true);
		await flush();
		const outside = window.document.createElement('button');
		window.document.body.append(outside);
		cleanups.push(() => outside.remove());
		outside.focus();
		container.hidden = true;
		container.scrollTop = 480;
		scroll.mockClear();
		state.onRulesDone();
		await flush();
		expect(state.step).toBe('input');
		expect(window.document.activeElement).toBe(outside);
		expect(scroll).not.toHaveBeenCalled();
		expect(container.scrollTop).toBe(480);
	});
	test('受付再開で同じユーザー名を再照会し、中断した応答を採用しない', async () => {
		const { state } = mount(Application);
		fill(state);
		state.onAgreementChange(true);
		const pending = deferred<{ available: boolean }>();
		const resumed = deferred<{ available: boolean }>();
		mocks.api.mockReturnValueOnce(pending.promise).mockReturnValueOnce(resumed.promise);
		state.onChangeUsername();
		const signal = mocks.api.mock.calls[0][3] as AbortSignal;
		expect(state.usernameState).toBe('wait');
		instance.registrationClosed = true;
		expect(signal.aborted).toBe(true);
		instance.registrationClosed = false;
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(mocks.api).toHaveBeenLastCalledWith('username/available', { username: 'member' }, undefined, expect.any(AbortSignal));
		pending.resolve({ available: false });
		await flush();
		expect(state.usernameState).toBe('wait');
		resumed.resolve({ available: true });
		await flush();
		expect(state.usernameState).toBe('ok');
		expect(state.shouldDisableSubmitting).toBe(false);
	});
	test('同意と明示確認を要求し、確認前にはAPI送信しない', async () => {
		const { state } = mount(Application); fill(state);
		state.reviewInput(); await state.onSubmit(); expect(mocks.api).not.toHaveBeenCalled();
		state.onAgreementChange(true);
		state.reviewInput(); expect(state.step).toBe('agreements');
		state.step = 'input';
		await state.onSubmit(); expect(mocks.api).not.toHaveBeenCalled();
		state.reviewInput(); expect(state.step).toBe('review');
		await state.onSubmit(); expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ username: 'member', reason: '参加したいです' }), null);
		expect(state.password).toBe(''); expect(state.retypedPassword).toBe('');
	});
	test('同意取消で規約へ戻り入力を保ち、元パスワード変更を再確認へ同期する', () => {
		const { state } = mount(Application); fill(state); state.onAgreementChange(true); state.step = 'input'; state.reviewInput();
		state.onAgreementChange(false); expect(state.step).toBe('agreements'); expect(state.reason).toBe('参加したいです');
		state.onAgreementChange(true); state.password = 'Changed123'; expect(state.passwordRetypeState).toBe('not-match'); expect(state.shouldDisableSubmitting).toBe(true);
	});
	test.each([7, 65])('パスワード%s文字を停止する', length => {
		const { state } = mount(Application); fill(state); state.onAgreementChange(true);
		state.password = 'a'.repeat(length); state.retypedPassword = state.password; expect(state.shouldDisableSubmitting).toBe(true);
	});
	test('管理者と関係がある場合は理由の代わりに連絡先を要求する', () => {
		const { state } = mount(Application); fill(state); state.onAgreementChange(true); state.hasAdminRelationship = true; state.reason = '';
		expect(state.shouldDisableSubmitting).toBe(true); state.additionalContacts = '@member@example.test'; expect(state.shouldDisableSubmitting).toBe(false);
	});
	test('送信開始後に同意が失効しても同じ登録モードで成功した受付を通知する', async () => {
		const complete = vi.fn();
		const { state } = mount(Application, { onComplete: complete });
		fill(state);
		state.onAgreementChange(true);
		state.step = 'input';
		state.reviewInput();
		const pending = deferred<void>();
		mocks.api.mockReturnValueOnce(pending.promise);
		const sending = state.onSubmit();
		expect(mocks.api).toHaveBeenCalledOnce();
		state.onAgreementChange(false);
		expect(state.step).toBe('agreements');
		pending.resolve();
		await sending;
		expect(complete).toHaveBeenCalledOnce();
		expect(state.password).toBe('');
	});
});

describe('招待登録の入力・最終確認', () => {
	test.each([200, 204])('送信開始後の同意失効で成功%sのsignup・メール確認待ち通知を捨てない', async status => {
		const signup = vi.fn();
		const emailPending = vi.fn();
		const item = mount(Signup, { agreementsAccepted: true, onSignup: signup, onSignupEmailPending: emailPending });
		fill(item.state);
		item.state.reviewInput();
		const pending = deferred<{ ok: boolean; status: number; json: () => Promise<{ token: string }> }>();
		mocks.fetch.mockReturnValueOnce(pending.promise);
		const sending = item.state.onSubmit();
		expect(mocks.fetch).toHaveBeenCalledOnce();
		item.props.agreementsAccepted = false;
		await nextTick();
		pending.resolve({ ok: true, status, json: async () => ({ token: 'test-token' }) });
		await sending;
		if (status === 204) {
			expect(emailPending).toHaveBeenCalledOnce();
			expect(signup).not.toHaveBeenCalled();
		} else {
			expect(signup).toHaveBeenCalledWith({ token: 'test-token' });
			expect(emailPending).not.toHaveBeenCalled();
		}
		expect(item.state.password).toBe('');
	});
	test('同意を要求し、入力から確認へ進んでもPOSTせず、二重送信を止める', async () => {
		const item = mount(Signup); fill(item.state); item.state.reviewInput(); await item.state.onSubmit(); expect(mocks.fetch).not.toHaveBeenCalled();
		item.props.agreementsAccepted = true; await nextTick(); item.state.reviewInput(); expect(item.state.step).toBe('review'); expect(mocks.fetch).not.toHaveBeenCalled();
		const pending = deferred<{ ok: boolean; status: number }>(); mocks.fetch.mockReturnValueOnce(pending.promise);
		const sending = item.state.onSubmit(); await item.state.onSubmit(); expect(mocks.fetch).toHaveBeenCalledOnce();
		pending.resolve({ ok: true, status: 204 }); await sending; expect(item.state.password).toBe(''); expect(item.state.invitationCode).toBe('');
	});
	test('確認から入力へ戻ると入力とCAPTCHAを維持し、同意取消時には送信を止める', async () => {
		const item = mount(Signup, { agreementsAccepted: true }); fill(item.state); item.state.hCaptchaResponse = 'response'; item.state.reviewInput(); item.state.step = 'input';
		expect(item.state.password).toBe('Password123'); expect(item.state.hCaptchaResponse).toBe('response'); item.state.reviewInput();
		item.props.agreementsAccepted = false; await nextTick(); expect(item.state.step).toBe('input'); await item.state.onSubmit(); expect(mocks.fetch).not.toHaveBeenCalled();
	});
	test('古い空き確認は現値・空値を上書きしない', async () => {
		const { state } = mount(Signup, { agreementsAccepted: true });
		const name = deferred<{ available: boolean }>(); mocks.api.mockReturnValueOnce(name.promise); state.username = 'old'; state.onChangeUsername(); state.username = ''; state.onChangeUsername(); name.resolve({ available: true }); await flush(); expect(state.usernameState).toBeNull();
		const email = deferred<{ available: boolean }>(); mocks.api.mockReturnValueOnce(email.promise); state.email = 'old@example.test'; state.onChangeEmail(); state.email = ''; state.onChangeEmail(); email.resolve({ available: true }); await flush(); expect(state.emailState).toBeNull();
	});
	test('最新のユーザー名とメールの空き確認は利用可能へ進む', async () => {
		const { state } = mount(Signup, { agreementsAccepted: true });
		const name = deferred<{ available: boolean }>();
		const email = deferred<{ available: boolean }>();
		mocks.api.mockReturnValueOnce(name.promise).mockReturnValueOnce(email.promise);
		state.username = 'member';
		state.onChangeUsername();
		state.email = 'member@example.test';
		state.onChangeEmail();
		expect(state.usernameState).toBe('wait');
		expect(state.emailState).toBe('wait');
		name.resolve({ available: true });
		email.resolve({ available: true });
		await flush();
		expect(state.usernameState).toBe('ok');
		expect(state.emailState).toBe('ok');
	});
	test('メール確認待ち経路とautoSetログイン経路を維持する', async () => {
		const signup = vi.fn(); const pending = vi.fn(); const item = mount(Signup, { agreementsAccepted: true, autoSet: true, onSignup: signup, onSignupEmailPending: pending }); fill(item.state); item.state.reviewInput(); await item.state.onSubmit(); expect(signup).toHaveBeenCalledWith({ token: 'test-token' }); expect(mocks.login).toHaveBeenCalledWith('test-token'); expect(pending).not.toHaveBeenCalled();
		instance.emailRequiredForSignup = true; await flush(); fill(item.state); item.state.reviewInput(); await item.state.onSubmit(); expect(pending).toHaveBeenCalledOnce(); expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ text: 'member@example.test' }));
	});
});
