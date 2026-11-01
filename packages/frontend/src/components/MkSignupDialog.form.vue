<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<div :class="$style.banner">
		<i class="ti ti-user-edit"></i>
	</div>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 32px;">
		<Transition :enterActiveClass="$style.stepEnter" :enterFromClass="$style.stepFrom">
		<form v-show="step === 'input'" class="_gaps_m" autocomplete="new-password" @submit.prevent="reviewInput">
			<h2 ref="inputHeading" tabindex="-1" :class="$style.title">{{ flow.inputTitle }}</h2>
			<MkInput v-if="instance.disableRegistration" v-model="invitationCode" :disabled="submitting" type="text" :spellcheck="false" required data-cy-signup-invitation-code>
				<template #label>{{ i18n.ts.invitationCode }}</template>
				<template #prefix><i class="ti ti-key"></i></template>
			</MkInput>
			<MkInput v-model="username" :disabled="submitting" type="text" pattern="^[a-zA-Z0-9_]{1,20}$" :spellcheck="false" autocomplete="username" required data-cy-signup-username @update:modelValue="onChangeUsername">
				<template #label>{{ i18n.ts.username }} <div v-tooltip:dialog="i18n.ts.usernameInfo" class="_button _help"><i class="ti ti-help-circle"></i></div></template>
				<template #prefix>@</template>
				<template #suffix>@{{ host }}</template>
				<template #caption>
					<div><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.cannotBeChangedLater }}</div>
					<span v-if="usernameState === 'wait'" style="color:#999"><MkLoading :em="true"/> {{ i18n.ts.checking }}</span>
					<span v-else-if="usernameState === 'ok'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.available }}</span>
					<span v-else-if="usernameState === 'unavailable'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.unavailable }}</span>
					<span v-else-if="usernameState === 'error'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.error }}</span>
					<span v-else-if="usernameState === 'invalid-format'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.usernameInvalidFormat }}</span>
					<span v-else-if="usernameState === 'min-range'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.tooShort }}</span>
					<span v-else-if="usernameState === 'max-range'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.tooLong }}</span>
				</template>
			</MkInput>
			<MkInput v-if="instance.emailRequiredForSignup" v-model="email" :disabled="submitting" :debounce="true" type="email" :spellcheck="false" required data-cy-signup-email @update:modelValue="onChangeEmail">
				<template #label>{{ i18n.ts.emailAddress }} <div v-tooltip:dialog="i18n.ts._signup.emailAddressInfo" class="_button _help"><i class="ti ti-help-circle"></i></div></template>
				<template #prefix><i class="ti ti-mail"></i></template>
				<template #caption>
					<span v-if="emailState === 'wait'" style="color:#999"><MkLoading :em="true"/> {{ i18n.ts.checking }}</span>
					<span v-else-if="emailState === 'ok'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.available }}</span>
					<span v-else-if="emailState === 'unavailable:used'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.used }}</span>
					<span v-else-if="emailState === 'unavailable:format'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.format }}</span>
					<span v-else-if="emailState === 'unavailable:disposable'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.disposable }}</span>
					<span v-else-if="emailState === 'unavailable:banned'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.banned }}</span>
					<span v-else-if="emailState === 'unavailable:mx'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.mx }}</span>
					<span v-else-if="emailState === 'unavailable:smtp'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts._emailUnavailable.smtp }}</span>
					<span v-else-if="emailState === 'unavailable'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.unavailable }}</span>
					<span v-else-if="emailState === 'error'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.error }}</span>
				</template>
			</MkInput>
			<MkInput v-model="password" :disabled="submitting" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required data-cy-signup-password @update:modelValue="onChangePassword" @keydown="checkCapsLock" @focus="checkCapsLock" @click="checkCapsLock">
				<template #label>{{ i18n.ts.password }}</template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #suffix>
					<div v-if="isCapsLock" :class="$style.isCapslock"><i class="ti ti-arrow-big-up-line"></i></div>
					<button v-if="password" type="button" :class="$style.passwordToggleBtn" @click="togglePassword"><i :class="showPassword ? 'ti ti-eye-off' : 'ti ti-eye'"></i></button>
				</template>
				<template #caption>
					<div>{{ flow.passwordLengthDescription }}</div>
					<span v-if="passwordStrength == 'low'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.weakPassword }}</span>
					<span v-if="passwordStrength == 'medium'" style="color: var(--MI_THEME-warn)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.normalPassword }}</span>
					<span v-if="passwordStrength == 'high'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.strongPassword }}</span>
				</template>
			</MkInput>
			<MkInput v-model="retypedPassword" :disabled="submitting" :type="showPassword2 ? 'text' : 'password'" autocomplete="new-password" required data-cy-signup-password-retype @update:modelValue="onChangePasswordRetype" @keydown="checkCapsLock" @focus="checkCapsLock" @click="checkCapsLock">
				<template #label>{{ i18n.ts.password }} ({{ i18n.ts.retype }})</template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #suffix>
					<div v-if="isCapsLock" :class="$style.isCapslock"><i class="ti ti-arrow-big-up-line"></i></div>
					<button v-if="retypedPassword" type="button" :class="$style.passwordToggleBtn" @click="togglePassword2"><i :class="showPassword2 ? 'ti ti-eye-off' : 'ti ti-eye'"></i></button>
				</template>
				<template #caption>
					<span v-if="passwordRetypeState == 'match'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.passwordMatched }}</span>
					<span v-if="passwordRetypeState == 'not-match'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.passwordNotMatched }}</span>
				</template>
			</MkInput>
			<MkCaptcha v-if="instance.enableHcaptcha" ref="hcaptcha" v-model="hCaptchaResponse" :class="$style.captcha" provider="hcaptcha" :sitekey="instance.hcaptchaSiteKey"/>
			<MkCaptcha v-if="instance.enableMcaptcha" ref="mcaptcha" v-model="mCaptchaResponse" :class="$style.captcha" provider="mcaptcha" :sitekey="instance.mcaptchaSiteKey" :instanceUrl="instance.mcaptchaInstanceUrl"/>
			<MkCaptcha v-if="instance.enableRecaptcha" ref="recaptcha" v-model="reCaptchaResponse" :class="$style.captcha" provider="recaptcha" :sitekey="instance.recaptchaSiteKey"/>
			<MkCaptcha v-if="instance.enableTurnstile" ref="turnstile" v-model="turnstileResponse" :class="$style.captcha" provider="turnstile" :sitekey="instance.turnstileSiteKey"/>
			<MkCaptcha v-if="instance.enableTestcaptcha" ref="testcaptcha" v-model="testcaptchaResponse" :class="$style.captcha" provider="testcaptcha" :sitekey="null"/>
			<div class="_buttonsCenter">
				<MkButton inline rounded :disabled="submitting" @click="goBack"><i class="ti ti-arrow-left"></i> {{ i18n.ts.goBack }}</MkButton>
				<MkButton type="submit" :disabled="shouldDisableSubmitting" inline gradate rounded data-cy-signup-submit style="margin: 0 auto;">
					<template v-if="submitting">
						<MkLoading :em="true" :colored="false"/>
					</template>
					<template v-else>{{ flow.confirmInput }}</template>
				</MkButton>
			</div>
		</form>
		</Transition>
		<Transition :enterActiveClass="$style.stepEnter" :enterFromClass="$style.stepFrom">
		<section v-if="step === 'review'" class="_gaps_m" :class="$style.review">
			<h2 ref="reviewHeading" tabindex="-1" :class="$style.title">{{ flow.reviewTitle }}</h2>
			<p>{{ flow.reviewDescription }}</p>
			<dl :class="$style.reviewList">
				<template v-if="instance.disableRegistration"><dt>{{ i18n.ts.invitationCode }}</dt><dd>{{ invitationCode }}</dd></template>
				<dt>{{ i18n.ts.username }}</dt><dd>@{{ username }}@{{ host }}</dd>
				<template v-if="instance.emailRequiredForSignup"><dt>{{ i18n.ts.emailAddress }}</dt><dd>{{ email }}</dd></template>
				<dt>{{ i18n.ts.password }}</dt><dd>{{ flow.passwordSet }}</dd>
			</dl>
			<div class="_buttonsCenter">
				<MkButton inline rounded :disabled="submitting" @click="step = 'input'">{{ flow.backToInput }}</MkButton>
				<MkButton inline rounded gradate :disabled="shouldDisableSubmitting" data-cy-signup-confirm @click="onSubmit"><MkLoading v-if="submitting" :em="true"/><template v-else>{{ i18n.ts.start }}</template></MkButton>
			</div>
		</section>
		</Transition>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { focusRegistrationElement } from '@/utility/registration-consent.js';
import { toUnicode } from 'punycode.js';
import * as Misskey from 'cherrypick-js';
import * as config from '@@/js/config.js';
import MkButton from './MkButton.vue';
import MkInput from './MkInput.vue';
import type { Captcha } from '@/components/MkCaptcha.vue';
import MkCaptcha from '@/components/MkCaptcha.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { login } from '@/accounts.js';

const props = withDefaults(defineProps<{
	autoSet?: boolean;
	agreementsAccepted?: boolean;
}>(), {
	autoSet: false,
	agreementsAccepted: false,
});

const emit = defineEmits<{
	(ev: 'signup', user: Misskey.entities.SignupResponse): void;
	(ev: 'signupEmailPending'): void;
	(ev: 'back'): void;
}>();

const flow = i18n.ts._hata._registrationApplications._flow;
const step = ref<'input' | 'review'>('input');
const inputHeading = ref<HTMLElement>();
const reviewHeading = ref<HTMLElement>();
watch(step, (target) => {
	void nextTick(() => {
		if (target === step.value) focusRegistrationElement(target === 'input' ? inputHeading.value : reviewHeading.value, { scrollToTop: true });
	});
});
let disposed = false;
let modeVersion = 0;
watch(() => [instance.registrationClosed, instance.disableRegistration, instance.emailRequiredForSignup], () => {
	modeVersion++;
	step.value = 'input';
	usernameAbortController.value?.abort();
	emailAbortController.value?.abort();
	if (!instance.registrationClosed) {
		onChangeUsername();
		if (instance.emailRequiredForSignup) onChangeEmail();
	}
}, { flush: 'sync' });
watch(() => props.agreementsAccepted, (agreed) => { if (!agreed) step.value = 'input'; }, { flush: 'sync' });

function reviewInput() {
	if (step.value === 'input' && !shouldDisableSubmitting.value) {
		showPassword.value = false;
		showPassword2.value = false;
		step.value = 'review';
	}
}

const host = toUnicode(config.host);

const hcaptcha = ref<Captcha | undefined>();
const mcaptcha = ref<Captcha | undefined>();
const recaptcha = ref<Captcha | undefined>();
const turnstile = ref<Captcha | undefined>();
const testcaptcha = ref<Captcha | undefined>();

const username = ref<string>('');
const password = ref<string>('');
const retypedPassword = ref<string>('');
const invitationCode = ref<string>('');
const email = ref('');
const usernameState = ref<null | 'wait' | 'ok' | 'unavailable' | 'error' | 'invalid-format' | 'min-range' | 'max-range'>(null);
const emailState = ref<null | 'wait' | 'ok' | 'unavailable:used' | 'unavailable:format' | 'unavailable:disposable' | 'unavailable:banned' | 'unavailable:mx' | 'unavailable:smtp' | 'unavailable' | 'error'>(null);
const passwordStrength = ref<'' | 'low' | 'medium' | 'high'>('');
const passwordRetypeState = ref<null | 'match' | 'not-match'>(null);
const submitting = ref<boolean>(false);
const hCaptchaResponse = ref<string | null>(null);
const mCaptchaResponse = ref<string | null>(null);
const reCaptchaResponse = ref<string | null>(null);
const turnstileResponse = ref<string | null>(null);
const testcaptchaResponse = ref<string | null>(null);
const usernameAbortController = shallowRef<null | AbortController>(null);
const emailAbortController = shallowRef<null | AbortController>(null);

const shouldDisableSubmitting = computed((): boolean => {
	return !props.agreementsAccepted || instance.registrationClosed || submitting.value ||
		instance.enableHcaptcha && !hCaptchaResponse.value ||
		instance.enableMcaptcha && !mCaptchaResponse.value ||
		instance.enableRecaptcha && !reCaptchaResponse.value ||
		instance.enableTurnstile && !turnstileResponse.value ||
		instance.enableTestcaptcha && !testcaptchaResponse.value ||
		instance.emailRequiredForSignup && (emailState.value !== 'ok' || email.value.trim().length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) ||
		instance.disableRegistration && invitationCode.value.trim() === '' ||
		usernameState.value !== 'ok' ||
		passwordRetypeState.value !== 'match' || password.value !== retypedPassword.value ||
		password.value.length < 8 || password.value.length > 64 || !/^[a-zA-Z0-9_]{1,20}$/.test(username.value);
});

const isCapsLock = ref(false);
const showPassword = ref(false);
const showPassword2 = ref(false);

function getPasswordStrength(source: string): number {
	let strength = 0;
	let power = 0.018;

	// 英数字
	if (/[a-zA-Z]/.test(source) && /[0-9]/.test(source)) {
		power += 0.020;
	}

	// 大文字と小文字が混ざってたら
	if (/[a-z]/.test(source) && /[A-Z]/.test(source)) {
		power += 0.015;
	}

	// 記号が混ざってたら
	if (/[!\x22\#$%&@'()*+,-./_]/.test(source)) {
		power += 0.02;
	}

	strength = power * source.length;

	return Math.max(0, Math.min(1, strength));
}

function onChangeUsername(): void {
	usernameAbortController.value?.abort();
	usernameAbortController.value = null;
	if (disposed || instance.registrationClosed) return;
	if (username.value === '') {
		usernameState.value = null;
		return;
	}

	{
		const err =
			!username.value.match(/^[a-zA-Z0-9_]+$/) ? 'invalid-format' :
			username.value.length < 1 ? 'min-range' :
			username.value.length > 20 ? 'max-range' :
			null;

		if (err) {
			usernameState.value = err;
			return;
		}
	}

	usernameState.value = 'wait';
	const controller = new AbortController();
	const checkedUsername = username.value;
	const version = modeVersion;
	usernameAbortController.value = controller;
	const isCurrent = () => !disposed && !controller.signal.aborted && usernameAbortController.value === controller && username.value === checkedUsername && version === modeVersion && !instance.registrationClosed;

	misskeyApi('username/available', {
		username: checkedUsername,
	}, undefined, controller.signal).then(result => {
		if (isCurrent()) usernameState.value = result.available ? 'ok' : 'unavailable';
	}).catch((err) => {
		if (isCurrent() && err.name !== 'AbortError') {
			usernameState.value = 'error';
		}
	});
}

function onChangeEmail(): void {
	emailAbortController.value?.abort();
	emailAbortController.value = null;
	if (disposed || instance.registrationClosed) return;
	if (email.value === '') {
		emailState.value = null;
		return;
	}

	emailState.value = 'wait';
	const controller = new AbortController();
	const checkedEmail = email.value;
	const version = modeVersion;
	emailAbortController.value = controller;
	const isCurrent = () => !disposed && !controller.signal.aborted && emailAbortController.value === controller && email.value === checkedEmail && version === modeVersion && !instance.registrationClosed;

	misskeyApi('email-address/available', {
		emailAddress: checkedEmail,
	}, undefined, controller.signal).then(result => {
		if (!isCurrent()) return;
		emailState.value = result.available ? 'ok' :
			result.reason === 'used' ? 'unavailable:used' :
			result.reason === 'format' ? 'unavailable:format' :
			result.reason === 'disposable' ? 'unavailable:disposable' :
			result.reason === 'banned' ? 'unavailable:banned' :
			result.reason === 'mx' ? 'unavailable:mx' :
			result.reason === 'smtp' ? 'unavailable:smtp' :
			'unavailable';
	}).catch((err) => {
		if (isCurrent() && err.name !== 'AbortError') {
			emailState.value = 'error';
		}
	});
}

watch([password, retypedPassword], onChangePasswordRetype, { flush: 'sync' });

function onChangePassword(): void {
	if (password.value === '') {
		passwordStrength.value = '';
		return;
	}

	const strength = getPasswordStrength(password.value);
	passwordStrength.value = strength > 0.7 ? 'high' : strength > 0.3 ? 'medium' : 'low';
}

function onChangePasswordRetype(): void {
	if (retypedPassword.value === '') {
		passwordRetypeState.value = null;
		return;
	}

	passwordRetypeState.value = password.value === retypedPassword.value ? 'match' : 'not-match';
}

function goBack() {
	if (submitting.value) return;
	emit('back');
}

function resetCaptcha() {
	hCaptchaResponse.value = null;
	mCaptchaResponse.value = null;
	reCaptchaResponse.value = null;
	turnstileResponse.value = null;
	testcaptchaResponse.value = null;
	hcaptcha.value?.reset?.();
	mcaptcha.value?.reset?.();
	recaptcha.value?.reset?.();
	turnstile.value?.reset?.();
	testcaptcha.value?.reset?.();
}

function clearSecrets() {
	password.value = '';
	retypedPassword.value = '';
	invitationCode.value = '';
	showPassword.value = false;
	showPassword2.value = false;
	resetCaptcha();
}

async function onSubmit(): Promise<void> {
	if (step.value !== 'review' || shouldDisableSubmitting.value) return;
	submitting.value = true;
	const version = modeVersion;
	const submittedEmail = email.value;
	const requiresEmail = instance.emailRequiredForSignup;

	const signupPayload: Misskey.entities.SignupRequest = {
		username: username.value,
		password: password.value,
		emailAddress: email.value,
		invitationCode: invitationCode.value,
		'hcaptcha-response': hCaptchaResponse.value,
		'm-captcha-response': mCaptchaResponse.value,
		'g-recaptcha-response': reCaptchaResponse.value,
		'turnstile-response': turnstileResponse.value,
		'testcaptcha-response': testcaptchaResponse.value,
	};

	const res = await window.fetch(`${config.apiUrl}/signup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(signupPayload),
	}).catch(() => null);

	if (disposed || version !== modeVersion || instance.registrationClosed) {
		submitting.value = false;
		clearSecrets();
		return;
	}

	if (res && res.ok) {
		clearSecrets();
		if (res.status === 204 || requiresEmail) {
			os.alert({
				type: 'success',
				title: i18n.ts._signup.almostThere,
				text: i18n.tsx._signup.emailSent({ email: submittedEmail }),
			});
			emit('signupEmailPending');
		} else {
			const resJson = (await res.json()) as Misskey.entities.SignupResponse;
			if (disposed || version !== modeVersion) return;

			emit('signup', resJson);

			if (props.autoSet) {
				await login(resJson.token);
			}
		}
	} else {
		onSignupApiError();
	}

	submitting.value = false;
}

function onSignupApiError() {
	if (disposed) return;
	submitting.value = false;
	resetCaptcha();
	step.value = 'input';

	os.alert({
		type: 'error',
		text: i18n.ts.somethingHappened,
	});
}

function checkCapsLock(ev: KeyboardEvent) {
	isCapsLock.value = ev.getModifierState('CapsLock');
}

function togglePassword() {
	showPassword.value = !showPassword.value;
}

function togglePassword2() {
	showPassword2.value = !showPassword2.value;
}

onMounted(() => {
	window.addEventListener('keydown', checkCapsLock);
	window.addEventListener('keyup', checkCapsLock);
});

onUnmounted(() => {
	disposed = true;
	usernameAbortController.value?.abort();
	emailAbortController.value?.abort();
	clearSecrets();
	window.removeEventListener('keydown', checkCapsLock);
	window.removeEventListener('keyup', checkCapsLock);
});
</script>

<style lang="scss" module>
.root {
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
	overflow: hidden;
}

.title {
	margin: 0;
	font-size: 1.3em;
}

.review {
	line-height: 1.7;
}

.reviewList {
	margin: 0;
	display: grid;
	gap: 8px;

	dt {
		font-weight: bold;
	}

	dd {
		margin: 0 0 12px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
}

.stepEnter {
	transition: opacity 260ms ease, transform 260ms ease;
}

.stepFrom {
	opacity: 0;
	transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
	.stepEnter {
		transition: none;
	}

	.stepFrom {
		transform: none;
	}
}

.banner {
	padding: 16px;
	text-align: center;
	font-size: 26px;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}

.captcha {
	margin: 16px 0;
}

.isCapslock {
	display: inline-block;
	padding: 2px;
	border-radius: 6px;
	margin-right: 4px;
	background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
}

.passwordToggleBtn {
	position: relative;
	z-index: 2;
	margin: 0 auto;
	border: none;
	background: none;
	color: var(--MI_THEME-fg);
	font-size: 0.8em;
	cursor: pointer;
	pointer-events: auto;
	-webkit-tap-highlight-color: transparent;
}
</style>
