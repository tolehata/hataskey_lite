/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import ConcrntSettings from './ConcrntSettings.vue';
import { concrntState } from '@/utility/concrnt/runtime.js';
import { instance } from '@/instance.js';

const calls = vi.hoisted(() => ({
	initialize: vi.fn(), checkDomain: vi.fn(), link: vi.fn(), update: vi.fn(),
	unlink: vi.fn(), recheck: vi.fn(), clearCache: vi.fn(), consent: vi.fn(),
}));

vi.mock('@/utility/concrnt/consent.js', () => ({ requestConcrntConsent: calls.consent }));

vi.mock('@/utility/concrnt/runtime.js', async () => {
	const { reactive } = await import('vue');
	return {
		concrntState: reactive({
			initialized: true, busy: false, status: 'unlinked', connection: null, server: null,
			settings: { enabled: true, save: 'device', profile: 'main', notifications: true, popups: true },
			profiles: [], error: null,
		}),
		initializeConcrnt: calls.initialize, checkConcrntDomain: calls.checkDomain, linkConcrnt: calls.link,
		updateConcrntSettings: calls.update, unlinkConcrnt: calls.unlink,
		recheckConcrnt: calls.recheck, clearConcrntCache: calls.clearCache,
	};
});
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive({ name: '検証サーバー' }) };
});
vi.mock('@/store.js', () => ({ store: { r: { darkMode: { value: false } } } }));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', () => ({ default: { render: () => null } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { settings: '設定' } } }));
vi.mock('@@/js/config.js', () => ({ instanceName: 'fallback.example' }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false) } } };
});

const cleanups: Array<() => void> = [];
const sampleSecret = 'concrnt-subkey test-export-for-ui-only';

async function flush() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

function button(target: HTMLElement, label: string) {
	const found = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label);
	expect(found, `button: ${label}`).toBeDefined();
	return found!;
}

function fill(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit(target: HTMLElement) {
	target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function paste(input: HTMLInputElement, text: string) {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
	input.dispatchEvent(event);
	return event;
}

function setLinked() {
	concrntState.connection = { ccid: 'con1example', ckid: 'cck1example', domain: 'social.example' };
	concrntState.status = 'connected';
	concrntState.profiles = [
		{ id: 'main', uri: 'world.concrnt.p/main', name: 'メイン', visibility: 'public-observed' },
		{ id: 'work', uri: 'world.concrnt.p/work', name: '仕事', visibility: 'public-observed' },
	];
}

async function mountSettings() {
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const app = createApp({ render: () => h(ConcrntSettings) });
	app.component('MkA', { props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) });
	app.mount(target);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); target.remove(); mounted = false; } };
	cleanups.push(unmount);
	await flush();
	return { target, unmount };
}

async function reachSecret(target: HTMLElement) {
	button(target, '連携を始める').click();
	await flush();
	fill(target.querySelector<HTMLInputElement>('input[type="text"]')!, 'social.example');
	submit(target);
	await flush();
	return target.querySelector<HTMLInputElement>('input[type="password"]')!;
}

beforeEach(() => {
	Object.values(calls).forEach(call => call.mockReset());
	calls.initialize.mockResolvedValue(undefined);
	calls.consent.mockResolvedValue(true);
	calls.checkDomain.mockResolvedValue({ version: '2.0', domain: 'social.example' });
	calls.update.mockImplementation(async patch => { Object.assign(concrntState.settings, patch); });
	calls.unlink.mockImplementation(async () => { concrntState.connection = null; concrntState.status = 'unlinked'; });
	calls.recheck.mockResolvedValue(undefined);
	Object.assign(concrntState, {
		initialized: true, busy: false, status: 'unlinked', connection: null, server: null, profiles: [], error: null,
		settings: { enabled: true, save: 'device', profile: 'main', notifications: true, popups: true },
	});
	instance.name = '検証サーバー';
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Concrnt settings connection', () => {
	test('keeps its own name and updates the local server name without hard-coding it', async () => {
		const { target } = await mountSettings();
		expect(target.querySelector('h1')?.textContent).toBe('コンカレント連携(BETA)');
		expect(target.querySelector('header')?.textContent).toContain('検証サーバー / 設定');
		instance.name = '別のサーバー';
		await flush();
		expect(target.querySelector('header')?.textContent).toContain('別のサーバー / 設定');
		expect(calls.initialize).toHaveBeenCalledOnce();
		concrntState.error = 'コンカレントの保存データを消去できませんでした。';
		await flush();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(concrntState.error);
	});

	test('asks for the external server consent before checking the domain and stops when declined', async () => {
		calls.consent.mockResolvedValue(false);
		const { target } = await mountSettings();
		button(target, '連携を始める').click();
		await flush();
		fill(target.querySelector<HTMLInputElement>('input[type="text"]')!, 'social.example');
		submit(target);
		await flush();
		expect(calls.consent).toHaveBeenCalledWith('social.example');
		expect(calls.checkDomain).not.toHaveBeenCalled();
		expect(calls.link).not.toHaveBeenCalled();
		expect(target.querySelector('input[type="password"]')).toBeNull();
		expect(target.querySelector<HTMLInputElement>('input[type="text"]')?.disabled).toBe(false);
		calls.consent.mockResolvedValue(true);
		submit(target);
		await flush();
		expect(calls.consent).toHaveBeenCalledTimes(2);
		expect(calls.checkDomain).toHaveBeenCalledWith('social.example');
	});

	test('requires successful domain verification before exposing the secret field', async () => {
		calls.checkDomain.mockRejectedValue(new Error('unsupported'));
		const { target } = await mountSettings();
		button(target, '連携を始める').click();
		await flush();
		const domain = target.querySelector<HTMLInputElement>('input[type="text"]')!;
		expect(window.document.activeElement).toBe(domain);
		fill(domain, 'legacy.example');
		submit(target);
		await flush();
		expect(calls.checkDomain).toHaveBeenCalledWith('legacy.example');
		expect(target.querySelector('input[type="password"]')).toBeNull();
		expect(domain.getAttribute('aria-invalid')).toBe('true');
		expect(domain.getAttribute('aria-describedby')).toBe(target.querySelector('[role="alert"]')?.id);
		expect(calls.link).not.toHaveBeenCalled();
	});

	test('uses a masked field, defaults to device storage and focuses the enabled secret field', async () => {
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		expect(secret.disabled).toBe(false);
		expect(window.document.activeElement).toBe(secret);
		expect(secret.autocomplete).toBe('off');
		expect(target.querySelector<HTMLInputElement>('input[value="device"]')?.checked).toBe(true);
		expect(target.textContent).toContain('主鍵・ニーモニックは入力しないでください');
	});

	test('shows verified server metadata during linking and clears it before checking a different domain', async () => {
		calls.checkDomain.mockResolvedValueOnce({ version: '2.0', domain: 'social.example', meta: { nickname: '公開サーバー名', logo: 'https://social.example/logo.png' } });
		const { target } = await mountSettings();
		await reachSecret(target);
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('公開サーバー名');
		expect(target.querySelector('.connection-server-domain')?.textContent).toBe('social.example');
		expect(target.querySelector('.connection-server img')?.getAttribute('src')).toBe('https://social.example/logo.png');
		button(target, '接続先へ戻る').click();
		await flush();
		expect(target.querySelector('.connection-server')).toBeNull();
		calls.checkDomain.mockResolvedValueOnce({ version: '2.0', domain: 'second.example' });
		fill(target.querySelector<HTMLInputElement>('input[type="text"]')!, 'second.example');
		submit(target);
		await flush();
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('second.example');
		expect(target.querySelector('.connection-server img')).toBeNull();
		expect(target.textContent).not.toContain('公開サーバー名');
	});

	test.each([
		[{ code: 'network', status: 403 }, '公開サーバー情報へのアクセスが拒否'],
		[{ code: 'capability' }, 'Concrnt v2対応と必要な機能'],
		[{ code: 'network' }, 'ブラウザからの通信許可（CORS）'],
	])('shows the current domain failure instead of a previous connection error: %j', async (cause, expected) => {
		concrntState.error = '以前の接続エラー';
		calls.checkDomain.mockRejectedValue({ ...cause, message: 'private-response-content' });
		const { target } = await mountSettings();
		button(target, '連携を始める').click();
		await flush();
		fill(target.querySelector<HTMLInputElement>('input[type="text"]')!, 'social.example');
		submit(target);
		await flush();
		const alert = target.querySelector('[role="alert"]')?.textContent;
		expect(alert).toContain(expected);
		expect(alert).not.toContain('以前の接続エラー');
		expect(alert).not.toContain('private-response-content');
		expect(target.querySelector('input[type="password"]')).toBeNull();
		expect(calls.link).not.toHaveBeenCalled();
	});

	test.each(['\n', '\r\n', '\u3000'])('preserves copied field separators and the official suffix when pasting %j into the masked input', async separator => {
		const copied = `concrnt-subkey ${'0'.repeat(63)}2 con1w508d6qejxtdg4y5r3zarvary0c5xw7ktdsum3@social.example -`;
		calls.link.mockImplementation(async () => { setLinked(); });
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		const event = paste(secret, `\n${copied.split(' ').join(separator)}\n`);
		await flush();
		expect(event.defaultPrevented).toBe(true);
		expect(secret.type).toBe('password');
		expect(secret.value.trim()).toBe(copied);
		expect(target.textContent).not.toContain(copied);
		submit(target);
		await flush();
		expect(calls.link).toHaveBeenCalledWith(copied, 'social.example', 'device');
		expect(secret.value).toBe('');
	});

	test('pasting replaces only the selected part of the secret input', async () => {
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		fill(secret, 'concrnt-subkey old-value con1fixture@social.example');
		secret.setSelectionRange(15, 24);
		paste(secret, 'replacement');
		await flush();
		expect(secret.value).toBe('concrnt-subkey replacement con1fixture@social.example');
		expect(calls.link).not.toHaveBeenCalled();
	});

	test.each(['キャンセル', '接続先へ戻る'])('%s clears even the detached secret input', async label => {
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		fill(secret, sampleSecret);
		await flush();
		button(target, label).click();
		await flush();
		expect(secret.value).toBe('');
		expect(target.querySelector('input[type="password"]')).toBeNull();
		expect(calls.link).not.toHaveBeenCalled();
	});

	test('unmount removes the current secret from its input node', async () => {
		const { target, unmount } = await mountSettings();
		const secret = await reachSecret(target);
		fill(secret, sampleSecret);
		await flush();
		unmount();
		expect(secret.value).toBe('');
	});

	test('rejects other key formats without calling authentication or leaving the value displayed', async () => {
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		fill(secret, 'this is not an exported subkey');
		submit(target);
		await flush();
		expect(calls.link).not.toHaveBeenCalled();
		expect(secret.value).toBe('');
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('主鍵やニーモニックは使用できません');
	});

	test('clears the secret as authentication starts and confirms only the actual connected account', async () => {
		let finish!: () => void;
		calls.link.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
		const { target } = await mountSettings();
		const live = target.querySelector('.connection-live');
		const secret = await reachSecret(target);
		fill(secret, sampleSecret);
		submit(target);
		await flush();
		expect(calls.link).toHaveBeenCalledWith(sampleSecret, 'social.example', 'device');
		expect(secret.value).toBe('');
		expect(target.textContent).not.toContain('アカウントを連携しました');
		setLinked();
		concrntState.server = { domain: 'social.example', name: '接続先のサーバー', iconUrl: 'https://social.example/icon.webp' };
		finish();
		await flush();
		expect(target.textContent).toContain('アカウントを連携しました');
		expect(target.textContent).toContain('con1example');
		expect(target.querySelector('.connection-account-id dt')?.textContent).toBe('アカウントID');
		expect(target.querySelector('.connection-account-id dd')?.textContent).toBe('con1example');
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('接続先のサーバー');
		expect(target.querySelector('.connection-server-domain')?.textContent).toBe('social.example');
		expect(target.querySelector('.connection-live')).toBe(live);
		expect(window.document.activeElement).toBe(button(target, '設定へ進む'));
	});

	test('a failed authentication preserves the step and clears the input without echoing a thrown secret', async () => {
		calls.link.mockRejectedValue(new Error(sampleSecret));
		const { target } = await mountSettings();
		const secret = await reachSecret(target);
		fill(secret, sampleSecret);
		submit(target);
		await flush();
		expect(secret.value).toBe('');
		expect(target.querySelector('input[type="password"]')).toBe(secret);
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('連携できませんでした');
		expect(target.textContent).not.toContain(sampleSecret);
		expect(target.textContent).not.toContain('アカウントを連携しました');
	});

	test('a reauthentication starts with an empty password while retaining the current domain', async () => {
		setLinked();
		concrntState.status = 'reauth';
		const { target } = await mountSettings();
		button(target, 'サブキーを入れ直す').click();
		await flush();
		expect(target.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('social.example');
		submit(target);
		await flush();
		expect(target.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('');
	});
});

describe('Concrnt local settings', () => {
	test('shows the connected server name, icon and domain independently of the profile and local server', async () => {
		setLinked();
		concrntState.server = { domain: 'social.example', name: '接続先のサーバー', iconUrl: 'https://social.example/icon.webp' };
		const { target } = await mountSettings();
		expect(target.querySelector('header')?.textContent).toContain('検証サーバー / 設定');
		expect(target.querySelector('.connection-identity-text > strong')?.textContent).toBe('メイン');
		for (const identity of target.querySelectorAll('.connection-server')) {
			expect(identity.querySelector('.connection-server-name')?.textContent).toBe('接続先のサーバー');
			expect(identity.querySelector('.connection-server-domain')?.textContent).toBe('social.example');
			expect(identity.querySelector('img')?.getAttribute('src')).toBe('https://social.example/icon.webp');
			expect(identity.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer');
		}
		button(target, '通知').click();
		await flush();
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('接続先のサーバー');
	});

	test('falls back to the Concrnt icon on image failure and retries a changed icon', async () => {
		setLinked();
		concrntState.server = { domain: 'social.example', name: '接続先のサーバー', iconUrl: 'https://social.example/missing.webp' };
		const { target } = await mountSettings();
		const identity = target.querySelector('.connection-server')!;
		identity.querySelector('img')!.dispatchEvent(new Event('error'));
		await flush();
		expect(identity.querySelector('img')).toBeNull();
		expect(identity.querySelector('.concrnt-icon')).not.toBeNull();
		expect(identity.textContent).toContain('接続先のサーバー');
		concrntState.server.iconUrl = 'https://social.example/replaced.webp';
		await flush();
		expect(identity.querySelector('img')?.getAttribute('src')).toBe('https://social.example/replaced.webp');
	});

	test('uses the current domain when metadata is absent or belongs to another connection', async () => {
		setLinked();
		concrntState.server = { domain: 'previous.example', name: '以前のサーバー', iconUrl: 'https://previous.example/icon.webp' };
		const { target } = await mountSettings();
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('social.example');
		expect(target.querySelector('.connection-server img')).toBeNull();
		expect(target.textContent).not.toContain('以前のサーバー');
		concrntState.server = null;
		await flush();
		expect(target.querySelector('.connection-server-name')?.textContent).toBe('social.example');
		expect(target.querySelector('.connection-account-id dd')?.textContent).toBe('con1example');
	});

	test('shows the failed stage when restoring an existing connection', async () => {
		setLinked();
		concrntState.status = 'offline';
		concrntState.error = 'このブラウザの保存領域を利用できませんでした。';
		const { target } = await mountSettings();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(concrntState.error);
		expect(target.textContent).not.toContain('接続先にアクセスできません');
	});

	test('announces a connection check only after a confirmed connection', async () => {
		setLinked();
		concrntState.status = 'offline';
		let finish!: () => void;
		calls.recheck.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
		const { target } = await mountSettings();
		button(target, '接続を確認').click();
		await flush();
		expect(calls.recheck).toHaveBeenCalledOnce();
		expect(target.querySelector('.connection-live')?.textContent).toBe('');
		concrntState.status = 'connected';
		finish();
		await flush();
		expect(target.querySelector('.connection-live')?.textContent).toBe('接続情報を確認しました。');
		expect(target.querySelector('[role="alert"]')).toBeNull();
	});

	test.each(['offline', 'unknownAuth', 'reauth'] as const)('does not announce success when rechecking resolves with %s', async status => {
		setLinked();
		calls.recheck.mockImplementation(async () => {
			concrntState.status = status;
			concrntState.error = '接続を確認できませんでした。';
		});
		const { target } = await mountSettings();
		button(target, '接続を確認').click();
		await flush();
		expect(calls.recheck).toHaveBeenCalledOnce();
		expect(target.querySelector('.connection-live')?.textContent).toBe('');
		expect(target.querySelector('[role="alert"]')?.textContent).toBe('接続を確認できませんでした。');
		expect(concrntState.connection?.ccid).toBe('con1example');
	});

	test('does not check or announce a connection while the integration is paused', async () => {
		setLinked();
		concrntState.settings.enabled = false;
		concrntState.status = 'paused';
		const { target } = await mountSettings();
		const check = button(target, '接続を確認');
		expect(check.disabled).toBe(true);
		check.click();
		await flush();
		expect(calls.recheck).not.toHaveBeenCalled();
		expect(target.querySelector('.connection-live')?.textContent).toBe('');
	});

	test('profile selection sends the profile id rather than its URI', async () => {
		setLinked();
		const { target } = await mountSettings();
		button(target, '表示・投稿').click();
		await flush();
		const select = target.querySelector('select')!;
		select.value = 'work';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await flush();
		expect(calls.update).toHaveBeenCalledWith({ profile: 'work' });
		expect(select.value).toBe('work');
	});

	test('a rejected storage-mode save restores the previously checked radio', async () => {
		setLinked();
		calls.update.mockRejectedValue(new Error('storage unavailable'));
		const { target } = await mountSettings();
		const session = target.querySelector<HTMLInputElement>('input[value="session"]')!;
		session.checked = true;
		session.dispatchEvent(new Event('change', { bubbles: true }));
		await flush();
		expect(calls.update).toHaveBeenCalledWith({ save: 'session' });
		expect(session.checked).toBe(false);
		expect(target.querySelector<HTMLInputElement>('input[value="device"]')?.checked).toBe(true);
	});

	test('notification controls persist independently and disable popups when collection is off', async () => {
		setLinked();
		const { target } = await mountSettings();
		button(target, '通知').click();
		await flush();
		const switches = target.querySelectorAll<HTMLInputElement>('input[role="switch"]');
		switches[0].checked = false;
		switches[0].dispatchEvent(new Event('change', { bubbles: true }));
		await flush();
		expect(calls.update).toHaveBeenCalledWith({ notifications: false });
		expect(switches[1].disabled).toBe(true);
	});

	test('unlink requires explicit confirmation, starts on cancel and restores focus when canceled', async () => {
		setLinked();
		const { target } = await mountSettings();
		const opener = button(target, 'この端末の連携を解除');
		opener.click();
		await flush();
		expect(calls.unlink).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(button(target, 'やめておく'));
		expect(target.textContent).toContain('サブキーの失効は、Concrnt側で別途');
		button(target, 'やめておく').click();
		await flush();
		expect(window.document.activeElement).toBe(opener);
		opener.click();
		await flush();
		button(target, '連携を解除').click();
		await flush();
		expect(calls.unlink).toHaveBeenCalledOnce();
		expect(window.document.activeElement).toBe(button(target, '連携を始める'));
	});

	test('clearing display data uses only the cache operation after confirmation', async () => {
		setLinked();
		const { target } = await mountSettings();
		button(target, '絵文字・データ').click();
		await flush();
		button(target, '表示キャッシュを消去').click();
		await flush();
		expect(calls.clearCache).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(button(target, 'やめておく'));
		button(target, 'キャッシュを消去').click();
		await flush();
		expect(calls.clearCache).toHaveBeenCalledOnce();
		expect(calls.unlink).not.toHaveBeenCalled();
		expect(calls.update).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(button(target, '表示キャッシュを消去'));
	});
});
