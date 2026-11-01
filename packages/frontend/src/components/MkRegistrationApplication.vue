<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootElement" :class="$style.root">
	<div :class="$style.banner">
		<MkHatakyuIllustration v-if="useHatakyuBranding()" asset="showingId" :size="64" style="margin: 0 auto;"/><i v-else class="ti ti-file-description"></i>
	</div>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 32px;">
		<MkInfo v-if="!applicationsEnabled" warn>{{ i18n.ts._hata._registrationApplications.registrationModeChanged }}</MkInfo>
		<MkRegistrationRules v-show="applicationsEnabled && step === 'agreements'" :application="true" @update:agreed="onAgreementChange" @done="onRulesDone" @cancel="emit('back')"/>
		<Transition :enterActiveClass="$style.stepEnter" :enterFromClass="$style.stepFrom">
		<form v-show="applicationsEnabled && step === 'input'" class="_gaps_m" @submit.prevent="reviewInput">
			<h2 ref="inputHeading" tabindex="-1" :class="$style.title">{{ flow.inputTitle }}</h2>

			<!-- 戻るリンク -->
			<button type="button" :class="$style.backLink" :disabled="submitting" @click="step = 'agreements'">
				<i class="ti ti-arrow-left"></i> {{ flow.backToAgreements }}
			</button>

			<!-- 1. 登録したい理由 -->
			<div class="_gaps_s">
				<label :class="$style.checkboxLabel">
					<input v-model="hasAdminRelationship" type="checkbox" :class="$style.checkbox" :disabled="submitting" :aria-controls="`${reasonId} ${contactsId}`" :aria-describedby="`${reasonId}-relationship-hint`"/>
					<span>{{ copy.adminRelationshipLabel }}</span>
				</label>
				<div :id="`${reasonId}-relationship-hint`" :class="$style.fieldHint">{{ copy.adminRelationshipHint }}</div>
				<label :for="reasonId" :class="$style.label">{{ copy.reasonLabel }} <span v-if="!hasAdminRelationship" :class="$style.required">{{ copy.required }}</span></label>
				<textarea
					:id="reasonId"
					v-model="reason"
					:class="$style.textarea"
					rows="4"
					maxlength="1024"
					:disabled="hasAdminRelationship || submitting"
					:required="!hasAdminRelationship"
					:placeholder="copy.reasonPlaceholder"
				></textarea>
				<div v-if="!hasAdminRelationship" :class="$style.charCount">{{ reason.length }} / 1024</div>
			</div>

			<div class="_gaps_s">
				<label :for="contactsId" :class="$style.label">{{ copy.contactsLabel }} <span v-if="hasAdminRelationship" :class="$style.required">{{ copy.required }}</span><span v-else :class="$style.optional">({{ i18n.ts.optional }})</span></label>
				<textarea
					:id="contactsId"
					v-model="additionalContacts"
					:class="$style.textarea"
					rows="3"
					maxlength="1024"
					:disabled="submitting"
					:required="hasAdminRelationship"
					:spellcheck="false"
					autocomplete="off"
					:placeholder="copy.contactsPlaceholder"
					:aria-describedby="`${contactsId}-hint`"
				></textarea>
				<div :id="`${contactsId}-hint`" :class="[$style.fieldHint, $style.multilineHint]">{{ hasAdminRelationship ? copy.contactsRequiredHint : copy.contactsHint }}</div>
			</div>

			<!-- 2. ユーザーID -->
			<MkInput v-model="username" :disabled="submitting" type="text" pattern="^[a-zA-Z0-9_]{1,20}$" :spellcheck="false" autocomplete="username" required @update:modelValue="onChangeUsername">
				<template #label>{{ copy.usernameLabel }} <span :class="$style.required">{{ copy.required }}</span></template>
				<template #prefix>@</template>
				<template #caption>
					<div><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.cannotBeChangedLater }}</div>
					<span v-if="usernameState === 'wait'" style="color:#999"><MkLoading :em="true"/> {{ i18n.ts.checking }}</span>
					<span v-else-if="usernameState === 'ok'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.available }}</span>
					<span v-else-if="usernameState === 'unavailable'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ copy.usernameUnavailable }}</span>
					<span v-else-if="usernameState === 'error'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.error }}</span>
					<span v-else-if="usernameState === 'invalid-format'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.usernameInvalidFormat }}</span>
				</template>
			</MkInput>

			<!-- 3. パスワード -->
			<MkInput v-model="password" :disabled="submitting" type="password" autocomplete="new-password" required @update:modelValue="onChangePassword">
				<template #label>{{ i18n.ts.password }} <span :class="$style.required">{{ copy.required }}</span></template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #caption>
					<div>{{ flow.passwordLengthDescription }}</div>
					<span v-if="passwordStrength === 'low'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.weakPassword }}</span>
					<span v-if="passwordStrength === 'medium'" style="color: var(--MI_THEME-warn)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.normalPassword }}</span>
					<span v-if="passwordStrength === 'high'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.strongPassword }}</span>
				</template>
			</MkInput>

			<MkInput v-model="retypedPassword" :disabled="submitting" type="password" autocomplete="new-password" required @update:modelValue="onChangePasswordRetype">
				<template #label>{{ i18n.ts.password }} ({{ i18n.ts.retype }}) <span :class="$style.required">{{ copy.required }}</span></template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #caption>
					<span v-if="passwordRetypeState === 'match'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.passwordMatched }}</span>
					<span v-if="passwordRetypeState === 'not-match'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.passwordNotMatched }}</span>
				</template>
			</MkInput>

			<!-- 4. メールアドレス -->
			<MkInput v-model="email" :disabled="submitting" type="email" required @update:modelValue="onEmailChange">
				<template #label>{{ copy.emailLabel }} <span :class="$style.required">{{ copy.required }}</span></template>
				<template #prefix><i class="ti ti-mail"></i></template>
				<template #caption>
					<!-- 旗鯖fork: メアド重複エラー表示 (送信時にサーバーから EMAIL_ALREADY_EXISTS が返ったら表示) -->
					<div v-if="emailUnavailable" style="color: var(--MI_THEME-error);">
						<i class="ti ti-alert-triangle ti-fw"></i>
						{{ copy.emailUnavailable }}
					</div>
					<span style="color: var(--MI_THEME-fg); opacity: 0.8;">
						<i class="ti ti-info-circle ti-fw"></i>
						<span :class="$style.multilineHint">{{ copy.emailDescription }}</span>
					</span>
				</template>
			</MkInput>

			<!-- 5. CAPTCHA（MkSignupDialog.form.vue と完全同一パターン） -->
			<MkCaptcha v-if="inputVisited && instance.enableHcaptcha" ref="hcaptcha" v-model="hCaptchaResponse" :class="$style.captcha" provider="hcaptcha" :sitekey="instance.hcaptchaSiteKey"/>
			<MkCaptcha v-if="inputVisited && instance.enableMcaptcha" ref="mcaptcha" v-model="mCaptchaResponse" :class="$style.captcha" provider="mcaptcha" :sitekey="instance.mcaptchaSiteKey" :instanceUrl="instance.mcaptchaInstanceUrl"/>
			<MkCaptcha v-if="inputVisited && instance.enableRecaptcha" ref="recaptcha" v-model="reCaptchaResponse" :class="$style.captcha" provider="recaptcha" :sitekey="instance.recaptchaSiteKey"/>
			<MkCaptcha v-if="inputVisited && instance.enableTurnstile" ref="turnstile" v-model="turnstileResponse" :class="$style.captcha" provider="turnstile" :sitekey="instance.turnstileSiteKey"/>
			<MkCaptcha v-if="inputVisited && instance.enableTestcaptcha" ref="testcaptcha" v-model="testcaptchaResponse" :class="$style.captcha" provider="testcaptcha" :sitekey="null"/>

			<!-- 送信ボタン -->
			<MkButton type="submit" :disabled="shouldDisableSubmitting" large gradate rounded style="margin: 0 auto;">
				<template v-if="submitting">
					<MkLoading :em="true" :colored="false"/>
				</template>
				<template v-else><i class="ti ti-send"></i> {{ flow.confirmInput }}</template>
			</MkButton>
		</form>
		</Transition>
		<Transition :enterActiveClass="$style.stepEnter" :enterFromClass="$style.stepFrom">
		<section v-if="applicationsEnabled && step === 'review'" class="_gaps_m" :class="$style.review">
			<h2 ref="reviewHeading" tabindex="-1" :class="$style.title">{{ flow.reviewTitle }}</h2>
			<p>{{ flow.reviewDescription }}</p>
			<dl :class="$style.reviewList">
				<dt>{{ copy.adminRelationshipLabel }}</dt><dd>{{ hasAdminRelationship ? i18n.ts.yes : i18n.ts.no }}</dd>
				<template v-if="!hasAdminRelationship"><dt>{{ copy.reasonLabel }}</dt><dd>{{ reason.trim() }}</dd></template>
				<template v-if="additionalContacts.trim()"><dt>{{ copy.contactsLabel }}</dt><dd>{{ additionalContacts.trim() }}</dd></template>
				<dt>{{ copy.usernameLabel }}</dt><dd>@{{ username }}</dd>
				<dt>{{ copy.emailLabel }}</dt><dd>{{ email.trim() }}</dd>
				<dt>{{ i18n.ts.password }}</dt><dd>{{ flow.passwordSet }}</dd>
			</dl>
			<div class="_buttonsCenter">
				<MkButton rounded :disabled="submitting" @click="step = 'input'">{{ flow.backToInput }}</MkButton>
				<MkButton rounded primary :disabled="shouldDisableSubmitting" @click="onSubmit"><MkLoading v-if="submitting" :em="true"/><template v-else>{{ copy.submit }}</template></MkButton>
			</div>
		</section>
		</Transition>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, nextTick, onBeforeUnmount, useId, watch } from 'vue';
import { focusRegistrationElement } from '@/utility/registration-consent.js';
import MkRegistrationRules from '@/components/MkRegistrationRules.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';
import type { Captcha } from '@/components/MkCaptcha.vue';
import MkCaptcha from '@/components/MkCaptcha.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance, instance } from '@/instance.js';
import MkHatakyuIllustration from '@/components/MkHatakyuIllustration.vue';
import { useHatakyuBranding } from '@/utility/hatakyu-assets.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._registrationApplications._application;
const flow = i18n.ts._hata._registrationApplications._flow;
const step = ref<'agreements' | 'input' | 'review'>('agreements');
const rootElement = ref<HTMLElement>();
const inputHeading = ref<HTMLElement>();
const reviewHeading = ref<HTMLElement>();
const inputVisited = ref(false);
watch(step, (target) => {
	if (target === 'input') inputVisited.value = true;
}, { flush: 'sync' });
watch(step, (target) => {
	void nextTick(() => {
		if (target !== step.value) return;
		focusRegistrationElement(target === 'input' ? inputHeading.value : target === 'review' ? reviewHeading.value : rootElement.value?.querySelector<HTMLElement>('button[aria-controls]'), { scrollToTop: true });
	});
}, { flush: 'post' });
const agreementsAccepted = ref(false);

function onAgreementChange(agreed: boolean) {
	agreementsAccepted.value = agreed;
	if (!agreed) step.value = 'agreements';
}

function onRulesDone() {
	if (applicationsEnabled.value && agreementsAccepted.value) step.value = 'input';
}

function reviewInput() {
	if (step.value === 'input' && !shouldDisableSubmitting.value) step.value = 'review';
}

const modeUnavailable = ref(false);
const applicationsEnabled = computed(() => !instance.registrationClosed && instance.disableRegistration === true && !modeUnavailable.value);
let disposed = false;
let modeVersion = 0;

const emit = defineEmits<{
	(ev: 'complete'): void;
	(ev: 'back'): void;
}>();

// --- CAPTCHA refs（MkSignupDialog.form.vue と同一パターン）---
const hcaptcha = ref<Captcha | undefined>();
const mcaptcha = ref<Captcha | undefined>();
const recaptcha = ref<Captcha | undefined>();
const turnstile = ref<Captcha | undefined>();
const testcaptcha = ref<Captcha | undefined>();

// --- フォーム値 ---
const reason = ref('');
const reasonId = useId();
const hasAdminRelationship = ref(false);
const additionalContacts = ref('');
const contactsId = useId();
const username = ref('');
const password = ref('');
const retypedPassword = ref('');
const email = ref('');
const submitting = ref(false);

// --- CAPTCHA レスポンス ---
const hCaptchaResponse = ref<string | null>(null);
const mCaptchaResponse = ref<string | null>(null);
const reCaptchaResponse = ref<string | null>(null);
const turnstileResponse = ref<string | null>(null);
const testcaptchaResponse = ref<string | null>(null);

// --- ユーザー名チェック ---
const usernameState = ref<null | 'wait' | 'ok' | 'unavailable' | 'error' | 'invalid-format'>(null);
const usernameAbortController = shallowRef<null | AbortController>(null);

watch(() => [instance.disableRegistration, instance.registrationClosed], () => { modeUnavailable.value = false; });
watch(applicationsEnabled, () => {
	modeVersion++;
	usernameAbortController.value?.abort();
	if (applicationsEnabled.value) {
		onChangeUsername();
	} else {
		additionalContacts.value = '';
	}
}, { flush: 'sync' });
onBeforeUnmount(() => { disposed = true; usernameAbortController.value?.abort(); clearSecrets(); });

// 旗鯖fork: メアド重複検出フラグ (送信時にサーバーから EMAIL_ALREADY_EXISTS が返った時に true)
// メアドが変更されたら false にリセットする
const emailUnavailable = ref(false);

function onEmailChange() {
	if (emailUnavailable.value) {
		emailUnavailable.value = false;
	}
}

// --- パスワード ---
const passwordStrength = ref<'' | 'low' | 'medium' | 'high'>('');
const passwordRetypeState = ref<null | 'match' | 'not-match'>(null);

// --- 送信可否 ---
const shouldDisableSubmitting = computed((): boolean => {
	return !applicationsEnabled.value || submitting.value ||
		(!hasAdminRelationship.value && (reason.value.trim().length === 0 || reason.value.length > 1024)) ||
		(hasAdminRelationship.value && additionalContacts.value.trim().length === 0) ||
		additionalContacts.value.length > 1024 ||
		usernameState.value !== 'ok' ||
		passwordRetypeState.value !== 'match' ||
		password.value.length < 8 || password.value.length > 64 ||
		password.value !== retypedPassword.value || !/^[a-zA-Z0-9_]{1,20}$/.test(username.value) ||
		email.value.trim().length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ||
		!agreementsAccepted.value ||
		(instance.enableHcaptcha && !hCaptchaResponse.value) ||
		(instance.enableMcaptcha && !mCaptchaResponse.value) ||
		(instance.enableRecaptcha && !reCaptchaResponse.value) ||
		(instance.enableTurnstile && !turnstileResponse.value) ||
		(instance.enableTestcaptcha && !testcaptchaResponse.value);
});

function getPasswordStrength(source: string): number {
	let strength = 0;
	let power = 0.018;
	if (/[a-zA-Z]/.test(source) && /[0-9]/.test(source)) power += 0.020;
	if (/[a-z]/.test(source) && /[A-Z]/.test(source)) power += 0.015;
	if (/[!\x22\#$%&@'()*+,-./_]/.test(source)) power += 0.02;
	strength = power * source.length;
	return Math.max(0, Math.min(1, strength));
}

function onChangeUsername(): void {
	usernameAbortController.value?.abort();
	usernameAbortController.value = null;
	if (!applicationsEnabled.value) return;
	if (username.value === '') {
		usernameState.value = null;
		return;
	}

	if (!username.value.match(/^[a-zA-Z0-9_]{1,20}$/)) {
		usernameState.value = 'invalid-format';
		return;
	}

	usernameState.value = 'wait';
	const controller = new AbortController();
	const checkedUsername = username.value;
	usernameAbortController.value = controller;
	const isCurrent = () => !disposed && applicationsEnabled.value && !controller.signal.aborted && usernameAbortController.value === controller && username.value === checkedUsername;

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

watch([password, retypedPassword], onChangePasswordRetype, { flush: 'sync' });

function clearSecrets() {
	password.value = '';
	retypedPassword.value = '';
	additionalContacts.value = '';
	resetCaptcha();
}

function onChangePassword(): void {
	if (password.value === '') {
		passwordStrength.value = '';
		return;
	}

	const s = getPasswordStrength(password.value);
	passwordStrength.value = s > 0.7 ? 'high' : s > 0.3 ? 'medium' : 'low';
}

function onChangePasswordRetype(): void {
	if (retypedPassword.value === '') {
		passwordRetypeState.value = null;
		return;
	}

	passwordRetypeState.value = password.value === retypedPassword.value ? 'match' : 'not-match';
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

async function onSubmit(): Promise<void> {
	if (step.value !== 'review' || submitting.value || shouldDisableSubmitting.value) return;
	submitting.value = true;
	const version = modeVersion;

	try {
		await (misskeyApi as any)('registration/apply', {
			username: username.value,
			password: password.value,
			reason: hasAdminRelationship.value ? undefined : reason.value.trim(),
			hasAdminRelationship: hasAdminRelationship.value,
			additionalContacts: additionalContacts.value.trim() || undefined,
			email: email.value.trim(),
			'hcaptcha-response': hCaptchaResponse.value,
			'm-captcha-response': mCaptchaResponse.value,
			'g-recaptcha-response': reCaptchaResponse.value,
			'turnstile-response': turnstileResponse.value,
			'testcaptcha-response': testcaptchaResponse.value,
		}, null);

		clearSecrets();
		if (!disposed && applicationsEnabled.value && version === modeVersion) emit('complete');
	} catch (err: any) {
		if (disposed) return;
		submitting.value = false;
		resetCaptcha();
		step.value = agreementsAccepted.value ? 'input' : 'agreements';

		const code = err?.code;
		if (code === 'REGISTRATION_APPLICATIONS_DISABLED') {
			modeUnavailable.value = true;
			let refreshed = false;
			await fetchInstance(true).then(() => { refreshed = true; }).catch(() => { /* Keep the stale form blocked if the refresh fails. */ });
			if (!disposed) {
				os.alert({ type: 'info', text: i18n.ts._hata._registrationApplications.registrationModeChanged });
				if (refreshed) emit('back');
			}
		} else if (code === 'ADDITIONAL_CONTACTS_REQUIRED') {
			os.alert({ type: 'error', text: copy.contactsRequiredHint });
		} else if (code === 'USERNAME_ALREADY_EXISTS') {
			usernameState.value = 'unavailable';
			os.alert({ type: 'error', text: copy.usernameUnavailableAlert });
		} else if (code === 'EMAIL_ALREADY_EXISTS') {
			// 旗鯖fork: メアド重複時はフィールド下にも赤字表示し、モーダルでも通知
			emailUnavailable.value = true;
			os.alert({ type: 'error', text: copy.emailUnavailable });
		} else if (code === 'INVALID_EMAIL') {
			os.alert({ type: 'error', text: copy.invalidEmail });
		} else if (code === 'CAPTCHA_FAILED') {
			os.alert({ type: 'error', text: copy.captchaFailed });
		} else if (code === 'RATE_LIMIT_EXCEEDED') {
			os.alert({ type: 'error', text: copy.rateLimitExceeded });
		} else if (code === 'UNKNOWN_API_ENDPOINT') {
			os.alert({ type: 'error', text: copy.unknownApiEndpoint });
		} else {
			os.alert({ type: 'error', text: `${i18n.ts.somethingHappened} (${code || 'unknown'})` });
		}
		return;
	}

	submitting.value = false;
}
</script>

<style lang="scss" module>
.multilineHint { white-space: pre-line; }
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

.backLink {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: var(--MI_THEME-accent);
	background: none;
	border: none;
	cursor: pointer;
	font-size: 0.9em;

	&:hover {
		text-decoration: underline;
	}
}

.label {
	font-weight: bold;
	font-size: 0.95em;
}

.required {
	color: var(--MI_THEME-error);
	font-size: 0.8em;
}

.optional {
	font-size: 0.85em;
	font-weight: normal;
}

.fieldHint {
	font-size: 0.9em;
	line-height: 1.7;
	overflow-wrap: anywhere;
}

.textarea {
	width: 100%;
	padding: 10px 12px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 16px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	font-size: 1em;
	resize: vertical;
	box-sizing: border-box;
	font-family: inherit;

	&:disabled {
		background: var(--MI_THEME-bg);
		opacity: 0.6;
		cursor: not-allowed;
	}

	&:focus {
		border-color: var(--MI_THEME-accent);
		outline: 2px solid var(--MI_THEME-accent);
		outline-offset: 2px;
	}
}

.charCount {
	text-align: right;
	font-size: 0.8em;
	opacity: 0.6;
}

.checkboxLabel {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	cursor: pointer;
	font-size: 0.95em;

	a {
		color: var(--MI_THEME-accent);
		text-decoration: underline;
	}
}

.checkbox { width: 18px; height: 18px; accent-color: var(--MI_THEME-accent); }
</style>
