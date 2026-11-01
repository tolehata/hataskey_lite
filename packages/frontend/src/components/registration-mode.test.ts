/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { load } from 'js-yaml';
import { createApp, defineComponent, h, nextTick, Suspense } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { instance as productionInstance } from '@/instance.js';
import SignupBranch from './MkSignupBranchDialog.vue';
import RegistrationApplication from './MkRegistrationApplication.vue';
import RegistrationRules from './MkRegistrationRules.vue';
import RegistrationApplications from '@/pages/admin/registration-applications.vue';
import RegistrationVoteDialog from '@/pages/admin/registration-applications.vote-dialog.vue';
import { $i } from '@/i.js';
import Moderation from '@/pages/admin/moderation.vue';
import type { Component } from 'vue';

// Node 26 test helpers bypass Vite's browser externalization of node: imports.
const { readFileSync } = process.getBuiltinModule('node:fs');
const { resolve } = process.getBuiltinModule('node:path');

type MockMeta = {
	disableRegistration: boolean;
	registrationClosed: boolean;
	serverRules: string[];
	tosUrl: string | null;
	privacyPolicyUrl: string | null;
	enableHcaptcha: boolean;
	enableMcaptcha: boolean;
	enableRecaptcha: boolean;
	enableTurnstile: boolean;
	enableTestcaptcha: boolean;
};

const instance = productionInstance as unknown as MockMeta;
const mocks = vi.hoisted(() => ({ api: vi.fn(), confirm: vi.fn(), alert: vi.fn(), update: vi.fn(), fetchInstance: vi.fn() }));

vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	return { $i: reactive({ id: 'root', isAdmin: true, isModerator: true }) };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({ confirm: mocks.confirm, alert: mocks.alert, apiWithDialog: mocks.update }));
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive<MockMeta>({
		registrationClosed: false, disableRegistration: true, serverRules: [], tosUrl: null, privacyPolicyUrl: null,
		enableHcaptcha: false, enableMcaptcha: false, enableRecaptcha: false, enableTurnstile: false, enableTestcaptcha: false,
	}), fetchInstance: mocks.fetchInstance };
});
vi.mock('@/i18n.js', () => {
	const words = new Proxy({}, { get: (_, key) => String(key) });
	const phrases = new Proxy({}, { get: (_, key) => () => String(key) });
	return { i18n: {
		ts: {
			_hata: { _common: words, _registrationApplications: { _application: words, _admin: words, _review: words, _flow: words, _notification: words,
				acceptApplications: '申請による登録を受け付ける', openRegistrationConfirm: '登録を一般開放しますか？',
				openRegistrationActive: '現在は登録を一般開放中です', managementPaused: '受付済みの申請は保管されます', registrationModeChanged: '登録方法が変更されました',
			} },
			_serverSettings: { _userGeneratedContentsVisibilityForVisitor: words },
		},
		tsx: { _hata: { _registrationApplications: { _admin: phrases, _review: phrases } } },
	} };
});
vi.mock('@/preferences.js', () => ({ prefer: { r: { animation: { value: false } } } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/utility/hatakyu-assets.js', () => ({ useHatakyuBranding: () => false }));
vi.mock('@/components/MkButton.vue', async () => {
	const Vue = await import('vue');
	return { default: Vue.defineComponent({ props: { disabled: Boolean }, emits: ['click'], render() { return Vue.h('button', { disabled: this.disabled, onClick: () => this.$emit('click') }, this.$slots.default?.()); } }) };
});
vi.mock('@/components/MkInput.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkInfo.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkCaptcha.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkHatakyuIllustration.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkModalWindow.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSignupDialog.form.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSignupDialog.rules.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSelect.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkFolder.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/form/link.vue', () => ({ default: { render: () => null } }));
vi.mock('@/pages/admin/server-rules.vue', () => ({ default: { render: () => null } }));

type BranchSetup = {
	step: string;
	isAcceptedServerRule: boolean;
	goApplication: () => void;
	goInviteCode: () => void;
	acceptRules: () => void;
	backFromRules: () => void;
	onApplicationComplete: () => void;
};
type ApplicationSetup = {
	applicationsEnabled: boolean;
	reason: string;
	hasAdminRelationship: boolean;
	additionalContacts: string;
	username: string;
	usernameState: string | null;
	password: string;
	passwordRetypeState: string | null;
	email: string;
	agreementsAccepted: boolean;
	step: string;
	retypedPassword: string;
	onAgreementChange: (value: boolean) => void;
	reviewInput: () => void;
	shouldDisableSubmitting: boolean;
	onSubmit: () => Promise<void>;
	onChangeUsername: () => void;
};
type AdminSetup = {
	authorized: boolean;
	loadFailed: boolean;
	voteDialog: { choice: string } | null;
	voteError: string | null;
	openVote: (item: ReturnType<typeof adminRow>, choice: 'agree' | 'oppose') => void;
	closeVote: () => void;
	submitVote: (reason: string) => Promise<void>;
	applicationsEnabled: boolean;
	status: string;
	items: { id: string }[];
	summary: unknown;
	headerActions: unknown[];
	loading: boolean;
	actionBusy: boolean;
	hasMore: boolean;
	load: () => Promise<void>;
	loadMore: () => Promise<void>;
	loadSummary: () => Promise<void>;
	approve: (item: { id: string; username: string }) => Promise<void>;
	reject: (item: { id: string; username: string }) => Promise<void>;
	resendNotification: (item: ReturnType<typeof adminRow>) => Promise<void>;
	runLegacyCleanup: () => Promise<void>;
	runLegacyCleanupDryRun: () => Promise<void>;
};
type ModerationSetup = {
	acceptApplications: boolean;
	registrationClosed: boolean;
	onChange_registrationClosed: (value: boolean) => Promise<void>;
	savingRegistrationMode: boolean;
	onChange_acceptApplications: (value: boolean) => Promise<void>;
};

const cleanups = new Set<() => void>();

// Render native form controls when requested; DOM assertions are not browser layout QA.
function mountSetup<T>(component: Component, props: Record<string, unknown> = {}, renderTemplate = false) {
	let setup!: T;
	const render = (component as { render?: (...args: unknown[]) => ReturnType<typeof h> }).render;
	const subject = { ...component, render: (...args: unknown[]) => { setup = args[3] as T; return renderTemplate && render ? render(...args) : h('div'); } };
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp({ render: () => h(Suspense, null, { default: () => h(subject, props) }) });
	app.component('MkLoading', { render: () => null });
	app.component('PageWithHeader', defineComponent({ render() { return h('section', this.$slots.default?.()); } }));
	app.component('MkA', defineComponent({ render() { return h('a', this.$slots.default?.()); } }));
	app.mount(container);
	const unmount = () => {
		if (!cleanups.delete(unmount)) return;
		app.unmount();
		container.remove();
	};
	cleanups.add(unmount);
	return { get state() { return setup; }, container, unmount };
}

function deferred<T>() {
	let resolvePromise!: (value: T) => void;
	let rejectPromise!: (reason: unknown) => void;
	const promise = new Promise<T>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
	return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function flush() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

function validApplication(state: ApplicationSetup) {
	state.reason = ' このサーバーで交流したいです ';
	state.username = 'new_member';
	state.usernameState = 'ok';
	state.password = 'sample-password';
	state.retypedPassword = state.password;
	state.email = ' member@example.test ';
	state.onAgreementChange(true);
	state.step = 'input';
	state.reviewInput();
}

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign($i!, { id: 'root', isAdmin: true, isModerator: true });
	Object.assign(instance, {
		registrationClosed: false, disableRegistration: true, serverRules: [], tosUrl: null, privacyPolicyUrl: null,
		enableHcaptcha: false, enableMcaptcha: false, enableRecaptcha: false, enableTurnstile: false, enableTestcaptcha: false,
	});
	mocks.api.mockReset().mockImplementation(async (endpoint: string) => {
		if (endpoint === 'admin/meta') return {
			...instance, sensitiveWords: [], prohibitedWords: [], prohibitedWordsForNameOfUser: [], hiddenTags: [], preservedUsernames: [],
			blockedHosts: [], silencedHosts: [], mediaSilencedHosts: [], trustedLinkUrlPatterns: [], bubbleInstances: [],
		};
		if (endpoint === 'admin/cleanup-legacy-rejected-registrations') return { cleanedCount: 1, alreadyCleanedCount: 2, emailRetainedCount: 3, executedAt: '2026-08-31T00:00:00Z' };
		if (endpoint === 'admin/approve-registration') return { success: true, emailSent: true };
		if (endpoint === 'admin/reject-registration' || endpoint === 'admin/resend-registration-rejection') return { success: true, emailSent: true, notificationStatus: 'sent' };
		if (endpoint === 'username/available') return { available: true };
		return [];
	});
	mocks.confirm.mockReset().mockResolvedValue({ canceled: false });
	mocks.update.mockReset().mockImplementation(async (_endpoint: string, data: Partial<MockMeta>) => { Object.assign(instance, data); });
	mocks.fetchInstance.mockReset().mockImplementation(async () => instance);
});

afterEach(() => { for (const unmount of cleanups) unmount(); });

describe('登録ダイアログのモード分岐', () => {
	test('完全停止は開いていた申請フォームを閉じ、招待経路も拒否する', () => {
		const item = mountSetup<BranchSetup>(SignupBranch);
		item.state.goApplication();
		expect(item.state.step).toBe('application');
		instance.registrationClosed = true;
		expect(item.state.step).not.toBe('application');
		item.state.goApplication();
		expect(item.state.step).not.toBe('application');
		instance.registrationClosed = false;
		expect(item.state.step).toBe('branch');
	});

	test('完全停止ではフォーム送信と管理API呼出しを止める', async () => {
		instance.registrationClosed = true;
		const application = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(application.state);
		expect(application.state.shouldDisableSubmitting).toBe(true);
		await application.state.onSubmit();
		const admin = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		expect(admin.state.applicationsEnabled).toBe(false);
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('完全停止設定を保存し、元の申請方式を保持する', async () => {
		const item = mountSetup<ModerationSetup>(Moderation);
		await flush();
		await item.state.onChange_registrationClosed(true);
		expect(mocks.update).toHaveBeenCalledWith('admin/update-meta', { registrationClosed: true });
		expect(item.state.registrationClosed).toBe(true);
		expect(item.state.acceptApplications).toBe(true);
		await item.state.onChange_acceptApplications(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);
		await item.state.onChange_registrationClosed(false);
		expect(item.state.registrationClosed).toBe(false);
		expect(item.state.acceptApplications).toBe(true);
	});

	test('一般開放は分岐を省き、規則を確認して通常登録へ進む', () => {
		instance.disableRegistration = false;
		const item = mountSetup<BranchSetup>(SignupBranch);
		expect(item.state.step).toBe('invite');
		expect(item.state.isAcceptedServerRule).toBe(false);
		item.state.goApplication();
		expect(item.state.step).toBe('invite');
		item.state.acceptRules();
		expect(item.state.isAcceptedServerRule).toBe(true);
	});

	test('申請制は招待コードと申請の分岐を維持する（陽性対照）', () => {
		const item = mountSetup<BranchSetup>(SignupBranch);
		expect(item.state.step).toBe('branch');
		item.state.goApplication();
		expect(item.state.step).toBe('application');
		item.state.goInviteCode();
		expect(item.state.step).toBe('invite');
	});

	test('開いている間の切替は前の同意を破棄し、遅れた申請完了を受けない', () => {
		const item = mountSetup<BranchSetup>(SignupBranch);
		item.state.goApplication();
		instance.disableRegistration = false;
		expect(item.state.step).toBe('invite');
		item.state.onApplicationComplete();
		expect(item.state.step).toBe('invite');
		item.state.acceptRules();
		instance.disableRegistration = true;
		expect(item.state.step).toBe('branch');
		expect(item.state.isAcceptedServerRule).toBe(false);
	});

	test('申請完了後の案内は切替後も保ち、一般開放の規則キャンセルは閉じる', () => {
		const done = mountSetup<BranchSetup>(SignupBranch);
		done.state.goApplication();
		done.state.onApplicationComplete();
		instance.disableRegistration = false;
		expect(done.state.step).toBe('applicationComplete');
		const onCancelled = vi.fn();
		const open = mountSetup<BranchSetup>(SignupBranch, { onCancelled });
		open.state.backFromRules();
		expect(onCancelled).toHaveBeenCalledOnce();
	});
});

describe('申請フォームのサーバー設定とモード競合', () => {
	test('関係のチェックで理由と連絡先の必須・無効状態を切り替え、入力途中の内容を保つ', async () => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, {}, true);
		const checkbox = item.container.querySelector<HTMLInputElement>('input[type="checkbox"][aria-controls]');
		const [reason, contact] = item.container.querySelectorAll<HTMLTextAreaElement>('textarea');
		if (!checkbox || !reason || !contact) throw new Error('Missing registration relationship controls');
		expect(checkbox.checked).toBe(false);
		expect(reason.disabled).toBe(false);
		expect(reason.required).toBe(true);
		expect(contact.required).toBe(false);
		validApplication(item.state);
		item.state.additionalContacts = '@member@example.test';
		item.state.step = 'input';
		await nextTick();
		checkbox.click();
		await nextTick();
		expect(reason.disabled).toBe(true);
		expect(reason.required).toBe(false);
		expect(contact.required).toBe(true);
		expect(contact.disabled).toBe(false);
		expect(item.state.hasAdminRelationship).toBe(true);
		expect(item.state.shouldDisableSubmitting).toBe(false);
		checkbox.click();
		await nextTick();
		expect(reason.disabled).toBe(false);
		expect(reason.required).toBe(true);
		expect(contact.required).toBe(false);
		expect(reason.value).toBe(' このサーバーで交流したいです ');
		expect(contact.value).toBe('@member@example.test');
		item.state.reviewInput();
		await item.state.onSubmit();
		expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ hasAdminRelationship: false, reason: 'このサーバーで交流したいです' }), null);
	});

	test.each(['', ' \n '])('関係を申告しない場合は理由が空（%j）なら送信しない', async reason => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.reason = reason;
		item.state.additionalContacts = '@member@example.test';
		expect(item.state.shouldDisableSubmitting).toBe(true);
		await item.state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test.each(['', ' \n '])('関係を申告する場合は連絡先が空（%j）なら送信しない', async contact => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.hasAdminRelationship = true;
		item.state.additionalContacts = contact;
		expect(item.state.shouldDisableSubmitting).toBe(true);
		await item.state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test.each(['', '入力途中の理由は送信しない'])('関係を申告すると理由（%j）を送らず、関係の申告と連絡先を送る', async reason => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.hasAdminRelationship = true;
		item.state.reason = reason;
		item.state.additionalContacts = '  @member@example.test\nhttps://social.example.test/member  ';
		expect(item.state.shouldDisableSubmitting).toBe(false);
		await item.state.onSubmit();
		expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ hasAdminRelationship: true, reason: undefined, additionalContacts: '@member@example.test\nhttps://social.example.test/member' }), null);
	});

	test.each(['rules', 'captcha', 'closed'])('関係を申告しても%sの条件は省略しない', async condition => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, {}, true);
		validApplication(item.state);
		item.state.hasAdminRelationship = true;
		item.state.reason = '';
		item.state.additionalContacts = '@member@example.test';
		expect(item.state.shouldDisableSubmitting).toBe(false);
		if (condition === 'rules') instance.serverRules = ['同意が必要なルール'];
		if (condition === 'captcha') instance.enableTestcaptcha = true;
		if (condition === 'closed') instance.disableRegistration = false;
		expect(item.state.shouldDisableSubmitting).toBe(true);
		await item.state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test.each(['', ' \n '])('任意の連絡先が空（%j）でも送信できる', async contact => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.additionalContacts = contact;
		expect(item.state.shouldDisableSubmitting).toBe(false);
		await item.state.onSubmit();
		expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ additionalContacts: undefined }), null);
	});

	test('連絡先は改行を保った文字列で送り、送信成功後はフォームから消す', async () => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.additionalContacts = '  @private@example.test\nhttps://social.example.test/user  ';
		await item.state.onSubmit();
		expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ additionalContacts: '@private@example.test\nhttps://social.example.test/user' }), null);
		expect(item.state.additionalContacts).toBe('');
	});

	test('連絡先の1024文字を許可し、上限超過は送信しない', async () => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.additionalContacts = 'a'.repeat(1024);
		expect(item.state.shouldDisableSubmitting).toBe(false);
		item.state.additionalContacts += 'b';
		expect(item.state.shouldDisableSubmitting).toBe(true);
		await item.state.onSubmit();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('送信失敗なら連絡先を再編集でき、エラー内容をコンソールへ出さない', async () => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.additionalContacts = '@private@example.test';
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			mocks.api.mockRejectedValueOnce({ code: 'INTERNAL_ERROR', additionalContacts: item.state.additionalContacts });
			await item.state.onSubmit();
			expect(item.state.additionalContacts).toBe('@private@example.test');
			expect(item.state.shouldDisableSubmitting).toBe(false);
			expect(logged).not.toHaveBeenCalled();
		} finally { logged.mockRestore(); }
	});

	test.each(['mode', 'unmount'])('%sで申請画面を離れたら任意の連絡先を破棄する', action => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		const state = item.state;
		state.additionalContacts = '@private@example.test';
		if (action === 'mode') instance.disableRegistration = false;
		else item.unmount();
		expect(state.additionalContacts).toBe('');
	});

	test('他サーバーの規則とURLを使い、規約が空なら取扱いへの同意だけで進める', async () => {
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, {}, true);
		validApplication(item.state);
		expect(item.state.shouldDisableSubmitting).toBe(false);
		instance.serverRules = ['他サーバーの規則'];
		instance.tosUrl = 'https://other.example.test/terms';
		instance.privacyPolicyUrl = 'https://other.example.test/privacy';
		expect(item.state.shouldDisableSubmitting).toBe(true);
		expect(item.state.step).toBe('agreements');
		await nextTick();
		expect(item.container.textContent).toContain('他サーバーの規則');
		expect(item.container.querySelector('a[href="https://other.example.test/terms"]')).not.toBeNull();
		expect(item.container.querySelector('a[href="https://other.example.test/privacy"]')).not.toBeNull();
	});

	test.each(['rules', 'terms', 'policy'])('%sの設定変更は共通の規約画面から同期的に再同意を要求し、入力を保持する', setting => {
		instance.serverRules = ['規則'];
		instance.tosUrl = 'https://other.example.test/terms';
		instance.privacyPolicyUrl = 'https://other.example.test/privacy';
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, {}, true);
		validApplication(item.state);
		expect(item.state.shouldDisableSubmitting).toBe(false);
		if (setting === 'rules') instance.serverRules.push('追加規則');
		if (setting === 'terms') instance.tosUrl += '/updated';
		if (setting === 'policy') instance.privacyPolicyUrl += '/updated';
		expect(item.state.agreementsAccepted).toBe(false);
		expect(item.state.step).toBe('agreements');
		expect(item.state.shouldDisableSubmitting).toBe(true);
		expect(item.state.reason).toBe(' このサーバーで交流したいです ');
		expect(item.state.password).toBe('sample-password');
	});

	test('HTTP以外のポリシーURLをリンクにせず同意を止める（有効URLの陽性対照付き）', async () => {
		instance.tosUrl = 'https://other.example.test/terms';
		const item = mountSetup<{ sections: { id: string; document?: { url?: string } }[] }>(RegistrationRules, { application: true }, true);
		expect(item.container.querySelector('a[href="https://other.example.test/terms"]')).not.toBeNull();
		instance.tosUrl = 'javascript:alert(1)';
		instance.privacyPolicyUrl = 'data:text/html,unsafe';
		await nextTick();
		expect(item.state.sections.find(section => section.id === 'terms')?.document?.url).toBeUndefined();
		expect(item.state.sections.find(section => section.id === 'policy')?.document?.url).toBeUndefined();
		expect(item.container.querySelectorAll('a')).toHaveLength(0);
		expect(item.container.textContent).toContain('documentUnavailable');
	});

	test('一般開放では送信とユーザー名照会を止める', async () => {
		instance.disableRegistration = false;
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		validApplication(item.state);
		item.state.onChangeUsername();
		await item.state.onSubmit();
		expect(item.state.shouldDisableSubmitting).toBe(true);
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('申請制では匿名資格で申請を送信して完了する（陽性対照）', async () => {
		const onComplete = vi.fn();
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, { onComplete });
		validApplication(item.state);
		await item.state.onSubmit();
		expect(mocks.api).toHaveBeenCalledWith('registration/apply', expect.objectContaining({ username: 'new_member', reason: 'このサーバーで交流したいです', email: 'member@example.test' }), null);
		expect(onComplete).toHaveBeenCalledOnce();
	});

	test('モード切替後の申請応答を完了として表示しない', async () => {
		const pending = deferred<void>();
		mocks.api.mockReturnValueOnce(pending.promise);
		const onComplete = vi.fn();
		const item = mountSetup<ApplicationSetup>(RegistrationApplication, { onComplete });
		validApplication(item.state);
		const sending = item.state.onSubmit();
		instance.disableRegistration = false;
		pending.resolve();
		await sending;
		expect(onComplete).not.toHaveBeenCalled();
	});

	test.each([true, false])('受付停止エラーで再取得し、再取得成功=%sのときだけ戻す', async refreshed => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			mocks.api.mockRejectedValueOnce({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
			mocks.fetchInstance.mockImplementationOnce(async () => {
				if (!refreshed) throw new Error('offline');
				instance.disableRegistration = false;
				return instance;
			});
			const onBack = vi.fn();
			const item = mountSetup<ApplicationSetup>(RegistrationApplication, { onBack });
			validApplication(item.state);
			await item.state.onSubmit();
			expect(mocks.fetchInstance).toHaveBeenCalledWith(true);
			expect(item.state.applicationsEnabled).toBe(false);
			expect(onBack).toHaveBeenCalledTimes(refreshed ? 1 : 0);
			await item.state.onSubmit();
			expect(mocks.api).toHaveBeenCalledOnce();
		} finally { spy.mockRestore(); }
	});

	test('古いユーザー名照会は中止され、不正な新しい入力を上書きしない', async () => {
		const pending = deferred<{ available: boolean }>();
		mocks.api.mockReturnValueOnce(pending.promise);
		const item = mountSetup<ApplicationSetup>(RegistrationApplication);
		item.state.username = 'old_name';
		item.state.onChangeUsername();
		const signal = mocks.api.mock.calls[0][3] as AbortSignal;
		item.state.username = 'bad!';
		item.state.onChangeUsername();
		expect(signal.aborted).toBe(true);
		pending.resolve({ available: true });
		await flush();
		expect(item.state.usernameState).toBe('invalid-format');
	});
});

function adminRow() {
	return {
		id: 'pending-1', username: 'member', status: 'pending', createdAt: '2026-09-18T00:00:00Z',
		email: 'private@example.test', reason: '参加したい', additionalContacts: '@private@example.test',
		notificationStatus: null as null | 'sent' | 'failed' | 'sending' | 'pending' | 'unavailable', notificationRetryAvailable: false,
		review: {
			revision: 'review-revision-1', voters: [{ userId: 'moderator', name: '担当者', username: 'moderator', isCurrent: true, choice: 'agree', reason: '確認しました', votedAt: '2026-09-18T00:00:00Z' }],
			requiredCount: 1, agreeCount: 1, opposeCount: 0, waitingCount: 0, myChoice: null as 'agree' | 'oppose' | null,
			canVote: false, canFinalize: true, isRoot: true, decidedBy: null, decidedAt: null,
		},
	};
}

describe('拒否の確定と通知結果', () => {
	test.each([
		{ emailSent: true, notificationStatus: 'sent', type: 'success', text: 'sentDescription' },
		{ emailSent: false, notificationStatus: 'failed', type: 'warning', text: 'failedDescription' },
		{ emailSent: false, notificationStatus: 'sending', type: 'warning', text: 'sendingDescription' },
	])('拒否確定後の通知$emailSent/$notificationStatusを別に案内する', async result => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockResolvedValueOnce(result);
		await item.state.reject(row);
		expect(mocks.api).toHaveBeenCalledWith('admin/reject-registration', { applicationId: row.id, revision: row.review.revision });
		expect(mocks.alert).toHaveBeenCalledWith({ type: result.type, text: result.text });
		expect(mocks.api).toHaveBeenLastCalledWith('admin/registration-applications', { status: 'pending', limit: 20, offset: 0 }, undefined, expect.any(AbortSignal));
		expect(item.state.items).toEqual([]);
	});

	test('鯖缶の再送可能な拒否済み申請だけ通知を再送できる', async () => {
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		const row = adminRow();
		row.notificationRetryAvailable = true;
		await item.state.resendNotification(row);
		row.status = 'rejected';
		row.review.isRoot = false;
		await item.state.resendNotification(row);
		row.review.isRoot = true;
		row.notificationRetryAvailable = false;
		await item.state.resendNotification(row);
		expect(mocks.confirm).not.toHaveBeenCalled();
		row.notificationRetryAvailable = true;
		await item.state.resendNotification(row);
		expect(mocks.api).toHaveBeenCalledWith('admin/resend-registration-rejection', { applicationId: row.id });
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'success', text: 'retrySent' });
	});

	test('再送失敗は拒否を取り消さず警告し、更新後の配送状態を取得する', async () => {
		const row = adminRow();
		row.status = 'rejected';
		row.notificationStatus = 'failed';
		row.notificationRetryAvailable = true;
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockResolvedValueOnce({ success: true, emailSent: false, notificationStatus: 'failed' }).mockResolvedValueOnce([row]);
		await item.state.resendNotification(row);
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'warning', text: 'retryFailed' });
		expect(row.status).toBe('rejected');
		expect(item.state.items).toEqual([row]);
	});

	test('送信中は再送ボタンを無効にし、重複要求を送らない', async () => {
		const row = adminRow();
		row.status = 'rejected';
		row.notificationStatus = 'failed';
		row.notificationRetryAvailable = true;
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications, {}, true);
		await flush();
		const button = Array.from(item.container.querySelectorAll('button')).find(element => element.textContent?.includes('retry'));
		if (!button) throw new Error('Missing retry button');
		expect(button.disabled).toBe(false);
		const pending = deferred<{ success: boolean; emailSent: boolean; notificationStatus: string }>();
		mocks.api.mockClear().mockReturnValueOnce(pending.promise);
		const sending = item.state.resendNotification(row);
		await flush();
		expect(button.disabled).toBe(true);
		await item.state.resendNotification(row);
		expect(mocks.api).toHaveBeenCalledTimes(1);
		pending.resolve({ success: true, emailSent: true, notificationStatus: 'sent' });
		await sending;
	});

	test.each(['reject', 'resendNotification'] as const)('%sの最終確認を取り消すと送信しない', async action => {
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		const row = adminRow();
		if (action === 'resendNotification') row.status = 'rejected';
		row.notificationRetryAvailable = true;
		mocks.api.mockClear();
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		await item.state[action](row);
		expect(mocks.api).not.toHaveBeenCalled();
		expect(mocks.alert).not.toHaveBeenCalled();
		expect(item.state.actionBusy).toBe(false);
	});
});

describe('管理申請一覧の受付停止', () => {
	test.each(['approve', 'reject'] as const)('%s後は表示から任意の連絡先も破棄する', async action => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		await item.state[action](row);
		expect(row.additionalContacts).toBeNull();
		expect(item.state.items).toEqual([]);
	});

	test.each(['approve', 'reject'] as const)('%sの応答が失敗しても確定済みの申請を再取得して古い連絡先を消す', async action => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockRejectedValueOnce(new Error('response unavailable')).mockResolvedValueOnce([]);
		await item.state[action](row);
		expect(mocks.api).toHaveBeenLastCalledWith('admin/registration-applications', { status: 'pending', limit: 20, offset: 0 }, undefined, expect.any(AbortSignal));
		expect(row.additionalContacts).toBeNull();
		expect(item.state.items).toEqual([]);
	});

	test.each(['mode', 'unmount'])('管理画面を%sで離れると表示済み連絡先も破棄する', async action => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		if (action === 'mode') instance.disableRegistration = false;
		else item.unmount();
		expect(row.additionalContacts).toBeNull();
	});

	test('一般開放時は全操作・一覧とサマリ取得を停止する', async () => {
		instance.disableRegistration = false;
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		const row = adminRow();
		await item.state.load();
		await item.state.loadMore();
		await item.state.loadSummary();
		await item.state.approve(row);
		await item.state.reject(row);
		await item.state.runLegacyCleanup();
		await item.state.runLegacyCleanupDryRun();
		expect(item.state.headerActions).toEqual([]);
		expect(mocks.confirm).not.toHaveBeenCalled();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('申請制では一覧と承認・却下・cleanupを実行できる（陽性対照）', async () => {
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		expect(mocks.api).toHaveBeenCalledWith('admin/registration-applications', { status: 'pending', limit: 20, offset: 0 }, undefined, expect.any(AbortSignal));
		const row = adminRow();
		await item.state.approve(row);
		await item.state.reject(row);
		await item.state.runLegacyCleanupDryRun();
		await item.state.runLegacyCleanup();
		expect(mocks.api).toHaveBeenCalledWith('admin/approve-registration', { applicationId: row.id, revision: row.review.revision });
		expect(mocks.api).toHaveBeenCalledWith('admin/reject-registration', { applicationId: row.id, revision: row.review.revision });
		expect(mocks.api).toHaveBeenCalledWith('admin/cleanup-legacy-rejected-registrations', { execute: false });
		expect(mocks.api).toHaveBeenCalledWith('admin/cleanup-legacy-rejected-registrations', { execute: true });
	});

	test('OFF切替時は一覧を隠し、遅い一覧応答を捨て、ONで再取得する', async () => {
		const pending = deferred<{ id: string }[]>();
		mocks.api.mockReturnValueOnce(pending.promise);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		const signal = mocks.api.mock.calls[0][3] as AbortSignal;
		instance.disableRegistration = false;
		expect(signal.aborted).toBe(true);
		pending.resolve([{ id: 'pending-1' }]);
		await flush();
		expect(item.state.items).toEqual([]);
		expect(item.state.headerActions).toEqual([]);
		mocks.api.mockResolvedValueOnce([{ id: 'pending-preserved' }]);
		instance.disableRegistration = true;
		await flush();
		expect(item.state.items).toEqual([{ id: 'pending-preserved' }]);
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test.each(['approve', 'reject', 'runLegacyCleanup'] as const)('%s確認中にOFFになったら書き込みを発行しない', async action => {
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockClear();
		const confirmation = deferred<{ canceled: boolean }>();
		mocks.confirm.mockReturnValueOnce(confirmation.promise);
		const acting = item.state[action](adminRow());
		instance.disableRegistration = false;
		confirmation.resolve({ canceled: false });
		await acting;
		expect(mocks.api).not.toHaveBeenCalled();
		expect(item.state.actionBusy).toBe(false);
	});

	test('受付停止APIエラーで一覧を伏せ、再取得失敗でも操作を復活させない', async () => {
		mocks.api.mockRejectedValueOnce({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		mocks.fetchInstance.mockRejectedValueOnce(new Error('offline'));
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		expect(mocks.fetchInstance).toHaveBeenCalledWith(true);
		expect(item.state.applicationsEnabled).toBe(false);
		expect(item.state.items).toEqual([]);
		await item.state.load();
		expect(mocks.api).toHaveBeenCalledOnce();
	});

	test('アンマウント後の一覧応答で表示データを更新しない', async () => {
		const pending = deferred<{ id: string }[]>();
		mocks.api.mockReturnValueOnce(pending.promise);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		const state = item.state;
		item.unmount();
		pending.resolve([{ id: 'late' }]);
		await flush();
		expect(state.items).toEqual([]);
	});
});

describe('参加申請の投票と権限変更', () => {
	test.each([true, false])('実テンプレートはroot=%sに応じてメールと最終操作を分ける', async root => {
		Object.assign($i!, { id: root ? 'root' : 'moderator', isAdmin: root, isModerator: true });
		const row = adminRow();
		row.additionalContacts = '@member@social.example.test';
		row.reason = '<img src=x onerror="alert(1)">';
		Object.assign(row.review, { isRoot: root, canVote: !root, canFinalize: false });
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications, {}, true);
		await flush();
		const text = item.container.textContent ?? '';
		expect(text).toContain('@member@social.example.test');
		expect(text).toContain('<img src=x onerror="alert(1)">');
		expect(item.container.querySelector('img')).toBeNull();
		expect(text.includes('private@example.test')).toBe(root);
		expect(text).toContain('担当者');
		expect(text).toContain('確認しました');
		const buttons = Array.from(item.container.querySelectorAll('button'));
		const permit = buttons.find(button => button.textContent?.includes('permit'));
		const oppose = buttons.find(button => button.textContent?.includes('oppose'));
		if (root) {
			expect(permit?.disabled).toBe(true);
			expect(oppose).toBeUndefined();
		} else {
			expect(permit).toBeUndefined();
			expect(oppose?.disabled).toBe(false);
		}
	});

	test('モデレーターは取得でき、本人の反対理由とリビジョンだけを送る', async () => {
		Object.assign($i!, { id: 'moderator', isAdmin: false, isModerator: true });
		const row = adminRow();
		Object.assign(row.review, { isRoot: false, canVote: true, canFinalize: false });
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		item.state.openVote(row, 'oppose');
		expect(item.state.voteDialog?.choice).toBe('oppose');
		await item.state.submitVote('ルールへの同意を確認できません');
		expect(mocks.api).toHaveBeenCalledWith('admin/vote-registration', { applicationId: row.id, choice: 'oppose', reason: 'ルールへの同意を確認できません', revision: 'review-revision-1' });
		expect(item.state.voteDialog).toBeNull();
		expect(row.additionalContacts).toBeNull();
	});

	test('未投票・反対票があれば鯖缶でも許可を送らず、通常管理者は最終判断できない', async () => {
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		const row = adminRow();
		row.review.canFinalize = false;
		await item.state.approve(row);
		row.review.canFinalize = true;
		row.review.isRoot = false;
		await item.state.approve(row);
		await item.state.reject(row);
		expect(mocks.confirm).not.toHaveBeenCalled();
		expect(mocks.api).toHaveBeenCalledTimes(1);
	});

	test('モデレーターへ降格すると以前のメール・連絡先・審査理由を消し再取得する', async () => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		Object.assign($i!, { isAdmin: false, isModerator: true });
		expect(row.email).toBeNull();
		expect(row.additionalContacts).toBeNull();
		expect(row.reason).toBe('');
		expect(row.review.voters[0].reason).toBeNull();
		await flush();
		expect(item.state.items).toEqual([]);
	});

	test('権限を失うと投票ダイアログを閉じ、遅れた送信を止める', async () => {
		const row = adminRow();
		row.review.canVote = true;
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		item.state.openVote(row, 'oppose');
		Object.assign($i!, { isAdmin: false, isModerator: false });
		expect(item.state.authorized).toBe(false);
		expect(item.state.voteDialog).toBeNull();
		expect(item.state.items).toEqual([]);
		mocks.api.mockClear();
		await item.state.submitVote('送信してはいけない');
		await item.state.runLegacyCleanup();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('全員賛成の表示後に審査が変わったら最新状態へ更新し再許可しない', async () => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		const updated = adminRow();
		updated.review.canFinalize = false;
		mocks.api.mockRejectedValueOnce({ code: 'REGISTRATION_REVIEW_CHANGED' }).mockResolvedValueOnce([updated]);
		await item.state.approve(row);
		expect(mocks.api).toHaveBeenCalledWith('admin/approve-registration', { applicationId: row.id, revision: 'review-revision-1' });
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'warning', text: 'reviewChanged' });
		expect(item.state.items).toEqual([updated]);
		mocks.api.mockClear();
		await item.state.approve(updated);
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('サーバーが権限喪失を返したらデータを破棄し再取得しない', async () => {
		const row = adminRow();
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockRejectedValueOnce({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		await item.state.reject(row);
		expect(item.state.authorized).toBe(false);
		expect(item.state.items).toEqual([]);
		expect(row.email).toBeNull();
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('反対理由のAPIエラーはダイアログに表示し、理由の再入力を許可する', async () => {
		const row = adminRow();
		row.review.canVote = true;
		mocks.api.mockResolvedValueOnce([row]);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		item.state.openVote(row, 'oppose');
		mocks.api.mockRejectedValueOnce({ code: 'REGISTRATION_REVIEW_REASON_REQUIRED' });
		await item.state.submitVote('');
		expect(item.state.voteDialog?.choice).toBe('oppose');
		expect(item.state.voteError).toBe('reasonRequired');
		await item.state.submitVote('確認できないため');
		expect(item.state.voteDialog).toBeNull();
	});

	test('管理者が却下済みを選ぶと一覧を保持して読み取り専用サマリを表示する', async () => {
		const item = mountSetup<AdminSetup>(RegistrationApplications, {}, true);
		await flush();
		mocks.api.mockClear();
		const row = { ...adminRow(), status: 'rejected' };
		const pendingSummary = deferred<{ cleanedCount: number; alreadyCleanedCount: number; emailRetainedCount: number; executedAt: string }>();
		mocks.api.mockResolvedValueOnce([row]).mockReturnValueOnce(pendingSummary.promise);

		item.state.status = 'rejected';
		await flush();
		expect(mocks.api).toHaveBeenNthCalledWith(1, 'admin/registration-applications', { status: 'rejected', limit: 20, offset: 0 }, undefined, expect.any(AbortSignal));
		expect(mocks.api).toHaveBeenNthCalledWith(2, 'admin/cleanup-legacy-rejected-registrations', { execute: false }, undefined, expect.any(AbortSignal));
		expect(item.state.items).toEqual([row]);

		pendingSummary.resolve({ cleanedCount: 1, alreadyCleanedCount: 2, emailRetainedCount: 3, executedAt: '2026-09-18T00:00:00Z' });
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(item.state.items).toEqual([row]);
		expect(item.state.summary).toEqual({ cleanedCount: 2, emailRetainedCount: 3, legacyCount: 1 });
		expect(item.state.loading).toBe(false);
		expect(item.state.loadFailed).toBe(false);
		expect(item.container.textContent).toContain('@member');
		expect(item.container.textContent).toContain('rejectedPrivacySummary');
		expect(item.container.textContent).toContain('personalDataDeleted');
		expect(item.container.textContent).toContain('emailRetained');
		expect(item.container.textContent).toContain('legacyNotCleaned');
		expect(mocks.alert).not.toHaveBeenCalled();
		expect(mocks.confirm).not.toHaveBeenCalled();
	});

	test('モデレーターにはcleanupサマリも破壊的操作も許可しない', async () => {
		Object.assign($i!, { isAdmin: false, isModerator: true });
		const item = mountSetup<AdminSetup>(RegistrationApplications, {}, true);
		await flush();
		const row = { ...adminRow(), status: 'rejected' };
		row.review.isRoot = false;
		mocks.api.mockResolvedValueOnce([row]);
		item.state.status = 'rejected';
		await flush();
		await item.state.loadSummary();
		await item.state.runLegacyCleanup();
		await item.state.runLegacyCleanupDryRun();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(mocks.api).toHaveBeenLastCalledWith('admin/registration-applications', { status: 'rejected', limit: 20, offset: 0 }, undefined, expect.any(AbortSignal));
		expect(mocks.api.mock.calls.every(([endpoint]) => endpoint === 'admin/registration-applications')).toBe(true);
		expect(item.state.items).toEqual([row]);
		expect(item.state.summary).toBeNull();
		expect(item.container.textContent).toContain('@member');
		expect(item.container.textContent).not.toContain('rejectedPrivacySummary');
		expect(mocks.alert).not.toHaveBeenCalled();
		expect(mocks.confirm).not.toHaveBeenCalled();
	});

	test('追加読込が失敗したら以前の申請も隠し、失敗状態を表示する', async () => {
		const rows = Array.from({ length: 20 }, (_, index) => ({ ...adminRow(), id: String(index) }));
		mocks.api.mockResolvedValueOnce(rows);
		const item = mountSetup<AdminSetup>(RegistrationApplications);
		await flush();
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		await item.state.loadMore();
		expect(item.state.items).toEqual([]);
		expect(item.state.loadFailed).toBe(true);
		expect(rows.every(row => row.email === null)).toBe(true);
	});
});

describe('反対理由を必須にするダイアログ', () => {
	type VoteSetup = { reason: string; validationError: string | null; submit: () => void };
	test.each(['', '  \n ', '\u200B\u2060', '\u0000\u0001', '\u0007', '\u034F', '\uFE0F', '\u0301\u0308', '\u2800'])('空欄・空白・不可視文字だけ（%j）を送信しない', reason => {
		const onSubmit = vi.fn();
		const item = mountSetup<VoteSetup>(RegistrationVoteDialog, { choice: 'oppose', username: 'member', busy: false, error: null, onSubmit });
		item.state.reason = reason;
		item.state.submit();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(item.state.validationError).toBe('reasonRequired');
	});

	test('300文字の理由は送信でき、301文字は拒否する（陽性対照）', () => {
		const onSubmit = vi.fn();
		const item = mountSetup<VoteSetup>(RegistrationVoteDialog, { choice: 'oppose', username: 'member', busy: false, error: null, onSubmit });
		item.state.reason = 'あ'.repeat(301);
		item.state.submit();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(item.state.validationError).toBe('reasonTooLong');
		item.state.reason = 'あ'.repeat(300);
		item.state.submit();
		expect(onSubmit).toHaveBeenCalledWith('あ'.repeat(300));
	});

	test('賛成時のメモは任意で、閉じた後は理由を残さない', () => {
		const onSubmit = vi.fn();
		const item = mountSetup<VoteSetup>(RegistrationVoteDialog, { choice: 'agree', username: 'member', busy: false, error: null, onSubmit });
		item.state.submit();
		expect(onSubmit).toHaveBeenCalledWith('');
		item.state.reason = '保管しない判断メモ';
		const state = item.state;
		item.unmount();
		expect(state.reason).toBe('');
	});
});

describe('モデレーション設定の登録モード', () => {
	test('OFFへの変更をキャンセルしたら申請制を保ち、設定APIを呼ばない', async () => {
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		const item = mountSetup<ModerationSetup>(Moderation);
		await flush();
		await item.state.onChange_acceptApplications(false);
		expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', text: '登録を一般開放しますか？' }));
		expect(mocks.update).not.toHaveBeenCalled();
		expect(item.state.acceptApplications).toBe(true);
		expect(item.state.savingRegistrationMode).toBe(false);
	});

	test('OFFはfalseで一般開放、ONはtrueで申請制に保存する', async () => {
		const item = mountSetup<ModerationSetup>(Moderation);
		await flush();
		await item.state.onChange_acceptApplications(false);
		expect(mocks.update).toHaveBeenLastCalledWith('admin/update-meta', { disableRegistration: false });
		expect(item.state.acceptApplications).toBe(false);
		await item.state.onChange_acceptApplications(true);
		expect(mocks.update).toHaveBeenLastCalledWith('admin/update-meta', { disableRegistration: true });
		expect(item.state.acceptApplications).toBe(true);
		expect(mocks.confirm).toHaveBeenCalledOnce();
	});

	test('保存失敗では画面の設定を戻し、多重送信も防ぐ', async () => {
		const pending = deferred<void>();
		mocks.update.mockReturnValueOnce(pending.promise);
		const item = mountSetup<ModerationSetup>(Moderation);
		await flush();
		const saving = item.state.onChange_acceptApplications(false);
		await flush();
		await item.state.onChange_acceptApplications(false);
		expect(mocks.update).toHaveBeenCalledOnce();
		pending.reject(new Error('save failed'));
		await expect(saving).rejects.toThrow('save failed');
		expect(item.state.acceptApplications).toBe(true);
		expect(item.state.savingRegistrationMode).toBe(false);
	});
});

describe('登録設定のテンプレート契約', () => {
	test('任意連絡先の案内は審査中の保管と確定時の削除だけを簡潔に示す', () => {
		const locale = load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as {
			_hata: { _registrationApplications: { _application: Record<string, string>; _admin: Record<string, string> } };
		};
		const copy = locale._hata._registrationApplications._application;
		expect(copy.contactsDeletion).toContain('審査中のみ保管');
		expect(copy.contactsDeletion).toContain('承認・拒否の確定時');
		expect(copy).not.toHaveProperty('contactsPurpose');
		expect(copy).not.toHaveProperty('contactsSeparation');
		expect(copy).not.toHaveProperty('contactsBackupNotice');
		const notice = [copy.contactsHandling, copy.contactsDeletion].join('');
		for (const removed of ['プロフィールや通知には保存しません', '登録用メールアドレスは別の取り扱いです', 'バックアップや控えは削除対象外', '管理者だけが審査と必要な連絡に使用します']) {
			expect(notice).not.toContain(removed);
		}
		const misplacedReference = /この欄|こちら|下に記載/u;
		expect(misplacedReference.test('この欄をご確認ください')).toBe(true);
		expect(misplacedReference.test(notice)).toBe(false);
		expect(notice.length).toBeLessThan(80);
		expect(locale._hata._registrationApplications._admin.contactsHandling).toBe('承認・拒否が確定すると、SNSなどの連絡先は申請データから自動削除されます');
	});

	test.each([
		{ locale: 'en-US', reason: 'application reason', adminRemoved: ['only to review', 'do not copy or save'] },
		{ locale: 'zh-CN', reason: '申请理由', adminRemoved: ['仅用于审核', '请勿抄录或另行保存'] },
	])('$localeでも連絡先欄への入力と確定時の削除だけを案内する', ({ locale, reason, adminRemoved }) => {
		const messages = load(readFileSync(resolve(process.cwd(), `../../locales/${locale}.yml`), 'utf8')) as {
			_hata: { _registrationApplications: { _application: Record<string, string>; _admin: Record<string, string> } };
		};
		const application = messages._hata._registrationApplications._application;
		expect(application.contactsHint).toContain(reason);
		expect(application.contactsDeletion).toMatch(/application data|申请数据/u);
		const admin = messages._hata._registrationApplications._admin.contactsHandling;
		for (const removed of adminRemoved) expect(admin).not.toContain(removed);
	});

	test('申請完了の承認メール案内の直後で改行し、画面でも改行を保つ', () => {
		const locale = load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as {
			_hata: { _common: { applicationCompleteDescription: string } };
		};
		expect(locale._hata._common.applicationCompleteDescription).toBe('申請が承認された場合、承認のメールが届き、\n記入されたID名でログインできるようになります。');
		const source = readFileSync(resolve(process.cwd(), 'src/components/MkSignupBranchDialog.vue'), 'utf8');
		expect(source).toContain('<p :class="$style.completionDescription">{{ copy.applicationCompleteDescription }}</p>');
		expect(source).toMatch(/\.completionDescription\s*\{\s*white-space: pre-line;/u);
	});

	test('任意連絡先は関連付けたラベル・説明を持ち、管理側もプレーンテキストで表示する', () => {
		const root = resolve(process.cwd(), 'src');
		const admin = readFileSync(resolve(root, 'pages/admin/registration-applications.vue'), 'utf8');
		const application = readFileSync(resolve(root, 'components/MkRegistrationApplication.vue'), 'utf8');
		expect(application).toContain('<label :for="contactsId"');
		expect(application).toContain(':aria-describedby="`${contactsId}-hint`"');
		expect(readFileSync(resolve(root, 'components/MkRegistrationRules.vue'), 'utf8')).toContain('copy.contactsDeletion');
		expect(application).not.toContain('copy.contactsPurpose');
		expect(application).not.toContain('copy.contactsSeparation');
		expect(application).not.toContain('copy.contactsBackupNotice');
		expect(admin).toContain('v-if="item.status === \'pending\' && item.additionalContacts"');
		expect(admin).toContain('{{ item.additionalContacts }}');
		const unsafeRendering = /v-html="[^"]*additionalContacts|<Mfm[^>]*additionalContacts/;
		expect(unsafeRendering.test('<div v-html="item.additionalContacts"/>')).toBe(true);
		expect(unsafeRendering.test(admin)).toBe(false);
	});

	test('受付停止説明・操作領域の分離とサーバー固有ポリシー参照を保つ', () => {
		const root = resolve(process.cwd(), 'src');
		const admin = readFileSync(resolve(root, 'pages/admin/registration-applications.vue'), 'utf8');
		const application = readFileSync(resolve(root, 'components/MkRegistrationApplication.vue'), 'utf8');
		const moderation = readFileSync(resolve(root, 'pages/admin/moderation.vue'), 'utf8');
		expect(admin).toContain('<MkInfo v-else-if="!applicationsEnabled">');
		expect(admin).toContain('modeCopy.managementPaused');
		expect(admin).toContain('<div v-else class="_gaps_m">');
		const rules = readFileSync(resolve(root, 'components/MkRegistrationRules.vue'), 'utf8');
		expect(application).toContain('<MkRegistrationRules');
		expect(rules).toContain('registrationDocument(instance.tosUrl');
		expect(rules).toContain('registrationDocument(instance.privacyPolicyUrl');
		expect(rules).toContain(':href="section.document.url"');
		expect(rules).toContain('v-for="(rule, ruleIndex) in instance.serverRules"');
		const fixedPolicyPattern = /misskey\.hatachanoima\.net|copy\.rule(?:Age|Gdpr|Moderation)/u;
		expect(fixedPolicyPattern.test('href="https://misskey.hatachanoima.net/policy"')).toBe(true);
		expect(fixedPolicyPattern.test(application)).toBe(false);
		expect(moderation).toContain(':modelValue="acceptApplications" :disabled="registrationClosed || savingRegistrationMode"');
	});
});
