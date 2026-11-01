/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Captcha, CaptchaProvider } from './MkCaptcha.vue';
import MkCaptcha from './MkCaptcha.vue';

vi.mock('@/store.js', () => ({ store: { s: { darkMode: false } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { retry: 'Retry', _captcha: { _error: { _requestFailed: { title: 'CAPTCHA failed', text: 'Check settings' } } } } } }));
const dispose: (() => void)[] = [];

async function settle() { await nextTick(); await nextTick(); }

async function mount(provider: CaptchaProvider = 'recaptcha', sitekey: string | null = 'configured-key') {
	const props = reactive({ provider, sitekey, instanceUrl: 'https://captcha.example.test' });
	const updated = vi.fn();
	const app = createApp({ render: () => h(MkCaptcha, { ...props, 'onUpdate:modelValue': updated }) });
	app.component('MkEllipsis', { render: () => h('span', '...') });
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const vm = app.mount(container);
	let removed = false;
	const unmount = () => { if (!removed) { app.unmount(); container.remove(); removed = true; } };
	dispose.push(unmount);
	await settle();
	return { props, updated, container, vm, unmount };
}

function api() {
	return { render: vi.fn<Captcha['render']>(() => 0), remove: vi.fn(), reset: vi.fn(), execute: vi.fn(), getResponse: vi.fn(() => '') } satisfies Captcha;
}

function script(provider = 'recaptcha') { return window.document.getElementById(`script-${provider}`)!; }

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('_DEV_', false);
	vi.stubGlobal('grecaptcha', undefined);
	vi.stubGlobal('hcaptcha', undefined);
	vi.stubGlobal('turnstile', undefined);
	// Keep DOM rendering real while replacing the network-loading elements.
	// Every load/error event below is dispatched explicitly by the test.
	const createElement = window.document.createElement.bind(window.document);
	vi.spyOn(window.document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
		if (tagName === 'iframe') {
			const frame = window.document.createElementNS('http://www.w3.org/2000/svg', 'iframe');
			Object.defineProperty(frame, 'contentWindow', { value: {} });
			Object.defineProperty(frame, 'src', {
				get: () => frame.getAttribute('src'),
				set: (value: string) => frame.setAttribute('src', value),
			});
			return frame as unknown as HTMLIFrameElement;
		}
		const element = createElement(tagName, options);
		if (tagName === 'script') element.setAttribute('type', 'application/x-captcha-test');
		return element;
	});
});
afterEach(() => {
	for (const cleanup of dispose.splice(0)) cleanup();
	for (const element of window.document.querySelectorAll('script[id^="script-"]')) element.remove();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('configured CAPTCHA providers', () => {
	test.each(['recaptcha', 'hcaptcha', 'turnstile'] as const)('%s waits for the API after load and uses the configured key and token', async provider => {
		const { updated, container } = await mount(provider);
		const target = script(provider);
		expect(target.getAttribute('src')).toMatch(/^https:\/\//);
		target.dispatchEvent(new Event('load'));
		expect(container.textContent).toContain('Loading');
		const mock = api();
		vi.stubGlobal(provider === 'recaptcha' ? 'grecaptcha' : provider, mock);
		await vi.advanceTimersByTimeAsync(50);
		expect(mock.render).toHaveBeenCalledTimes(1);
		const options = mock.render.mock.calls[0][1] as { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void };
		expect(options.sitekey).toBe('configured-key');
		options.callback('provider-issued-token');
		expect(updated).toHaveBeenLastCalledWith('provider-issued-token');
		options['expired-callback']();
		expect(updated).toHaveBeenLastCalledWith(null);
		await vi.advanceTimersByTimeAsync(1000);
		expect(mock.render).toHaveBeenCalledTimes(1);
	});

	test('script failure exposes retry and replaces only the failed script', async () => {
		const { container } = await mount();
		const original = script();
		original.dispatchEvent(new Event('error'));
		await settle();
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('CAPTCHA failed');
		container.querySelector('button')!.click();
		await settle();
		expect(script()).not.toBe(original);
		expect(window.document.querySelectorAll('#script-recaptcha')).toHaveLength(1);
		const mock = api(); vi.stubGlobal('grecaptcha', mock);
		script().dispatchEvent(new Event('load'));
		await settle();
		expect(mock.render).toHaveBeenCalledTimes(1);
	});

	test('timeout stops polling and retry replaces the timed out script', async () => {
		const { container } = await mount(); const original = script();
		await vi.advanceTimersByTimeAsync(30000);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		container.querySelector('button')!.click(); await settle();
		expect(script()).not.toBe(original);
		const mock = api(); vi.stubGlobal('grecaptcha', mock);
		await vi.advanceTimersByTimeAsync(50);
		expect(mock.render).toHaveBeenCalledTimes(1);
	});

	test('unmount cancels polling and script listeners', async () => {
		const { unmount } = await mount(); const target = script();
		unmount(); const mock = api(); vi.stubGlobal('grecaptcha', mock);
		target.dispatchEvent(new Event('load')); target.dispatchEvent(new Event('error'));
		await vi.advanceTimersByTimeAsync(30000);
		expect(mock.render).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('empty key fails without polling and recovers when configured', async () => {
		const { props, container } = await mount('recaptcha', null);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		const mock = api(); vi.stubGlobal('grecaptcha', mock);
		props.sitekey = 'new-key'; await settle();
		expect(mock.render).toHaveBeenCalledTimes(1);
	});

	test('provider changes clean widget zero and ignore old callbacks', async () => {
		const google = api(); const hcaptcha = api();
		vi.stubGlobal('grecaptcha', google); vi.stubGlobal('hcaptcha', hcaptcha);
		const { props, updated, unmount } = await mount();
		const old = google.render.mock.calls[0][1] as { callback: (token: string) => void; 'expired-callback': () => void };
		props.provider = 'hcaptcha'; await settle();
		expect(google.remove).toHaveBeenCalledWith(0);
		expect(hcaptcha.render).toHaveBeenCalledTimes(1);
		updated.mockClear(); old.callback('stale-token');
		expect(updated).not.toHaveBeenCalled();
		unmount(); expect(hcaptcha.remove).toHaveBeenCalledWith(0);
	});

	test('render exceptions offer retry', async () => {
		const mock = api(); mock.render.mockImplementationOnce(() => { throw new Error('render failed'); });
		vi.stubGlobal('grecaptcha', mock);
		const { container } = await mount();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		container.querySelector('button')!.click(); await settle();
		expect(mock.render).toHaveBeenCalledTimes(2);
	});

	test('mCaptcha renders locally in two components and accepts tokens only from its own frame and origin', async () => {
		const first = await mount('mcaptcha'); const second = await mount('mcaptcha');
		const frame = first.container.querySelector('iframe')!;
		const other = second.container.querySelector('iframe')!;
		expect(frame).not.toBe(other);
		expect(frame.getAttribute('src')).toBe('https://captcha.example.test/widget/?sitekey=configured-key');
		expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-scripts allow-popups');
		expect(frame.title).toBe('mCaptcha');
		frame.dispatchEvent(new Event('load')); other.dispatchEvent(new Event('load')); await settle();
		first.updated.mockClear(); second.updated.mockClear();
		const send = (source: Window | null, origin: string, data: unknown) => window.dispatchEvent(new MessageEvent('message', { source, origin, data }));
		send(frame.contentWindow, 'https://captcha.example.test', null);
		send(frame.contentWindow, 'http://captcha.example.test', { token: 'wrong-origin' });
		send(frame.contentWindow, 'https://captcha.example.test', { token: 42 });
		send(null, 'https://captcha.example.test', { token: 'no-source' });
		expect(first.updated).not.toHaveBeenCalled();
		send(other.contentWindow, 'https://captcha.example.test', { token: 'second-token' });
		expect(first.updated).not.toHaveBeenCalled();
		expect(second.updated).toHaveBeenLastCalledWith('second-token');
		send(frame.contentWindow, 'https://captcha.example.test', { token: 'first-token' });
		expect(first.updated).toHaveBeenLastCalledWith('first-token');
		first.unmount(); expect(second.container.querySelector('iframe')).toBe(other);
	});

	test('mCaptcha accepts its own valid token before iframe load', async () => {
		const { container, updated } = await mount('mcaptcha');
		const frame = container.querySelector('iframe')!;
		expect(container.textContent).toContain('Loading');
		window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: 'https://captcha.example.test', data: { token: 'early-token' } }));
		await settle();
		expect(updated).toHaveBeenLastCalledWith('early-token');
		expect(container.textContent).not.toContain('Loading');
		expect(vi.getTimerCount()).toBe(0);
	});

	test('mCaptcha iframe error and timeout offer retry and old load is ignored after unmount', async () => {
		const { container, unmount } = await mount('mcaptcha');
		const original = container.querySelector('iframe')!;
		original.dispatchEvent(new Event('error')); await settle();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		container.querySelector('button')!.click(); await settle();
		const replacement = container.querySelector('iframe')!;
		expect(replacement).not.toBe(original);
		await vi.advanceTimersByTimeAsync(30000);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		unmount(); original.dispatchEvent(new Event('load')); replacement.dispatchEvent(new Event('load'));
		expect(container.querySelector('iframe')).toBeNull();
	});

	test('mCaptcha rejects non HTTP URLs and reset restarts its iframe', async () => {
		const updated = vi.fn();
		const props = reactive({ provider: 'mcaptcha' as const, sitekey: 'key', instanceUrl: 'javascript:alert(1)' });
		let component: { reset: () => void } | undefined;
		const app = createApp({ render: () => h(MkCaptcha, { ...props, ref: (value: unknown) => { component = value as typeof component; }, 'onUpdate:modelValue': updated }) });
		app.component('MkEllipsis', { render: () => h('span') });
		const container = window.document.createElement('div'); window.document.body.append(container); app.mount(container);
		dispose.push(() => { app.unmount(); container.remove(); }); await settle();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(container.querySelector('iframe')).toBeNull();
		props.instanceUrl = 'https://captcha.example.test'; await settle();
		const original = container.querySelector('iframe')!; original.dispatchEvent(new Event('load')); await settle();
		component!.reset(); await settle();
		expect(container.querySelector('iframe')).not.toBe(original);
		expect(updated).toHaveBeenLastCalledWith(null);
	});

	test('reCAPTCHA without remove uses reset to clean widget zero', async () => {
		const mock = api(); const google = { ...mock, remove: undefined }; vi.stubGlobal('grecaptcha', google);
		const { unmount } = await mount(); unmount();
		expect(google.reset).toHaveBeenCalledWith(0);
	});

	test('provider error callbacks clear the token and expose retry', async () => {
		const mock = api(); vi.stubGlobal('grecaptcha', mock);
		const { updated, container } = await mount();
		const options = mock.render.mock.calls[0][1] as { 'error-callback': () => void };
		options['error-callback'](); await settle();
		expect(updated).toHaveBeenLastCalledWith(null);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		container.querySelector('button')!.click(); await settle();
		expect(mock.render).toHaveBeenCalledTimes(2);
	});

	test('testcaptcha has no loading timer, submits on Enter, and resets token', async () => {
		const updated = vi.fn(); const app = createApp(MkCaptcha, { provider: 'testcaptcha', sitekey: null, 'onUpdate:modelValue': updated });
		const container = window.document.createElement('div'); window.document.body.append(container);
		const vm = app.mount(container) as unknown as { reset: () => void };
		dispose.push(() => { app.unmount(); container.remove(); }); await settle();
		expect(vi.getTimerCount()).toBe(0);
		const input = container.querySelector('input')!;
		input.value = 'ai-chan-kawaii'; input.dispatchEvent(new Event('input'));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await settle();
		expect(updated).toHaveBeenLastCalledWith('testcaptcha-passed');
		vm.reset(); await settle();
		expect(updated).toHaveBeenLastCalledWith(null);
		expect(container.querySelector('input')?.value).toBe('');
	});
});
