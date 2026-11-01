<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div v-if="failed" role="alert">
		<strong>{{ i18n.ts._captcha._error._requestFailed.title }}</strong>
		<p>{{ i18n.ts._captcha._error._requestFailed.text }}</p>
		<button type="button" @click="start">{{ i18n.ts.retry }}</button>
	</div>
	<span v-else-if="!available">Loading<MkEllipsis/></span>
	<div v-if="props.provider == 'mcaptcha'">
		<div ref="mcaptchaEl" class="m-captcha-style"></div>
	</div>
	<div v-else-if="props.provider == 'testcaptcha'" style="background: #eee; border: solid 1px #888; padding: 8px; color: #000; max-width: 320px; display: flex; gap: 10px; align-items: center; box-shadow: 2px 2px 6px #0004; border-radius: 4px;">
		<img src="/client-assets/testcaptcha.png" style="width: 60px; height: 60px; "/>
		<div v-if="testcaptchaPassed">
			<div style="color: green;">Test captcha passed!</div>
		</div>
		<div v-else>
			<div style="font-size: 13px; margin-bottom: 4px;">Type "ai-chan-kawaii" to pass captcha</div>
			<input v-model="testcaptchaInput" data-cy-testcaptcha-input @keydown.enter.prevent="testcaptchaSubmit"/>
			<button type="button" data-cy-testcaptcha-submit @click="testcaptchaSubmit">Submit</button>
		</div>
	</div>
	<div v-else ref="captchaEl"></div>
</div>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { store } from '@/store.js';
import { i18n } from '@/i18n.js';

export type Captcha = {
	render(container: string | Node, options: {
		readonly [_ in 'sitekey' | 'theme' | 'type' | 'size' | 'tabindex' | 'callback' | 'expired' | 'expired-callback' | 'error-callback' | 'endpoint']?: unknown;
	}): string | number;
	remove?(id: string | number): void;
	execute(id: string | number): void;
	reset(id?: string | number): void;
	getResponse(id: string | number): string;
};
export type CaptchaProvider = 'hcaptcha' | 'recaptcha' | 'turnstile' | 'mcaptcha' | 'testcaptcha';
declare global {
	interface Window {
		hcaptcha?: Captcha;
		grecaptcha?: Captcha;
		turnstile?: Captcha;
	}
}
const props = defineProps<{
	provider: CaptchaProvider;
	sitekey: string | null;
	secretKey?: string | null;
	instanceUrl?: string | null;
	modelValue?: string | null;
}>();
const emit = defineEmits<{ (ev: 'update:modelValue', v: string | null): void }>();
const available = ref(false);
const failed = ref(false);
const captchaEl = useTemplateRef('captchaEl');
const mcaptchaEl = useTemplateRef('mcaptchaEl');
const testcaptchaInput = ref('');
const testcaptchaPassed = ref(false);
const src = computed(() => {
	switch (props.provider) {
		case 'hcaptcha': return 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';
		case 'recaptcha': return 'https://www.recaptcha.net/recaptcha/api.js?render=explicit';
		case 'turnstile': return 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		default: return null;
	}
});
let mounted = false;
let generation = 0;
let timer: number | undefined;
let detachScript: (() => void) | undefined;
let widget: { api: Captcha; id: string | number } | undefined;
let mcaptchaFrame: HTMLIFrameElement | undefined;
let mcaptchaOrigin: string | undefined;

function getCaptcha() {
	switch (props.provider) {
		case 'hcaptcha': return window.hcaptcha;
		case 'recaptcha': return window.grecaptcha;
		case 'turnstile': return window.turnstile;
		default: return undefined;
	}
}

function callback(response?: string) {
	emit('update:modelValue', typeof response === 'string' ? response : null);
}

function stopWaiting() {
	window.clearTimeout(timer);
	timer = undefined;
	detachScript?.();
	detachScript = undefined;
}

function clearWidget() {
	const previous = widget;
	widget = undefined;
	try {
		if (previous?.api.remove) previous.api.remove(previous.id);
		else if (previous) previous.api.reset?.(previous.id);
	} catch { /* Already removed by the provider. */ }
	mcaptchaFrame?.remove();
	mcaptchaFrame = undefined;
	mcaptchaOrigin = undefined;
	const container = mcaptchaEl.value;
	if (container) container.innerHTML = '';
	if (captchaEl.value) captchaEl.value.innerHTML = '';
}

function reset() {
	if (props.provider === 'mcaptcha') {
		void start();
		return;
	}
	callback();
	try { if (widget) widget.api.reset?.(widget.id); } catch { /* Provider may have expired. */ }
	testcaptchaPassed.value = false;
	testcaptchaInput.value = '';
}

async function start() {
	if (!mounted) return;
	const current = ++generation;
	stopWaiting();
	clearWidget();
	callback();
	testcaptchaPassed.value = false;
	testcaptchaInput.value = '';
	available.value = false;
	failed.value = false;
	const active = () => mounted && generation === current;
	const fail = () => {
		if (!active() || failed.value) return;
		stopWaiting();
		failed.value = true;
		available.value = false;
		clearWidget();
		callback();
	};
	if (props.provider === 'testcaptcha') {
		available.value = true;
		return;
	}
	if (!props.sitekey || (props.provider === 'mcaptcha' && !props.instanceUrl)) {
		fail();
		return;
	}
	await nextTick();
	if (!active()) return;
	if (props.provider === 'mcaptcha') {
		try {
			const url = new URL(props.instanceUrl!);
			if (!['http:', 'https:'].includes(url.protocol) || !mcaptchaEl.value) throw new Error('Invalid CAPTCHA URL');
			mcaptchaOrigin = url.origin;
			url.pathname = '/widget/';
			url.search = new URLSearchParams({ sitekey: props.sitekey! }).toString();
			url.hash = '';
			const frame = window.document.createElement('iframe');
			frame.title = 'mCaptcha';
			frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups');
			frame.width = '100%';
			frame.height = '100%';
			frame.style.border = '0';
			frame.setAttribute('scrolling', 'no');
			const onLoad = () => {
				if (!active() || failed.value) return;
				stopWaiting();
				available.value = true;
			};
			frame.addEventListener('load', onLoad);
			frame.addEventListener('error', fail);
			detachScript = () => {
				frame.removeEventListener('load', onLoad);
				frame.removeEventListener('error', fail);
			};
			mcaptchaFrame = frame;
			timer = window.setTimeout(fail, 30000);
			frame.src = url.toString();
			mcaptchaEl.value.appendChild(frame);
		} catch { fail(); }
		return;
	}
	const deadline = Date.now() + 30000;
	let waitingScript: HTMLScriptElement | undefined;
	const poll = () => {
		if (!active() || failed.value) return;
		const api = getCaptcha();
		if (typeof api?.render === 'function' && captchaEl.value instanceof Element) {
			stopWaiting();
			try {
				const elem = window.document.createElement('div');
				captchaEl.value.appendChild(elem);
				const guardedCallback = (response?: string) => { if (active() && !failed.value) callback(response); };
				const id = api.render(elem, {
					sitekey: props.sitekey,
					theme: store.s.darkMode ? 'dark' : 'light',
					callback: guardedCallback,
					'expired-callback': () => guardedCallback(),
					'error-callback': fail,
				});
				widget = { api, id };
				if (failed.value) clearWidget();
				else available.value = true;
			} catch { fail(); }
		} else if (Date.now() >= deadline) {
			if (waitingScript) waitingScript.dataset.captchaFailed = 'true';
			fail();
		} else {
			timer = window.setTimeout(poll, 50);
		}
	};
	if (typeof getCaptcha()?.render !== 'function' && src.value) {
		const id = `script-${props.provider}`;
		let script = window.document.getElementById(id) as HTMLScriptElement | null;
		if (script?.dataset.captchaFailed === 'true') {
			script.remove();
			script = null;
		}
		const created = !script;
		script ??= Object.assign(window.document.createElement('script'), { async: true, id, src: src.value });
		const target = script;
		waitingScript = target;
		const onLoad = () => { if (active()) { window.clearTimeout(timer); poll(); } };
		const onError = () => { target.dataset.captchaFailed = 'true'; fail(); };
		target.addEventListener('load', onLoad);
		target.addEventListener('error', onError);
		detachScript = () => {
			target.removeEventListener('load', onLoad);
			target.removeEventListener('error', onError);
		};
		if (created) window.document.head.appendChild(target);
	}
	poll();
}

function onReceivedMessage(message: MessageEvent) {
	if (!mounted || failed.value || props.provider !== 'mcaptcha' || typeof message.data?.token !== 'string') return;
	if (mcaptchaFrame?.contentWindow && message.source === mcaptchaFrame.contentWindow && message.origin === mcaptchaOrigin) {
		stopWaiting();
		available.value = true;
		callback(message.data.token);
	}
}

function testcaptchaSubmit() {
	testcaptchaPassed.value = testcaptchaInput.value === 'ai-chan-kawaii';
	callback(testcaptchaPassed.value ? 'testcaptcha-passed' : undefined);
	if (!testcaptchaPassed.value) testcaptchaInput.value = '';
}

watch(() => [props.provider, props.instanceUrl, props.sitekey, props.secretKey], start, { flush: 'post' });
onMounted(() => {
	mounted = true;
	window.addEventListener('message', onReceivedMessage);
	void start();
});
onBeforeUnmount(() => {
	mounted = false;
	generation++;
	stopWaiting();
	clearWidget();
	window.removeEventListener('message', onReceivedMessage);
});
defineExpose({ reset });
</script>
