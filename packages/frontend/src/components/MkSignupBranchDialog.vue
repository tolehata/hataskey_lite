<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="500"
	:height="600"
	@close="onClose"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.signup }}</template>

	<div style="overflow-x: clip;">
		<div ref="stages" :class="[$style.stages, { [$style.noMotion]: !prefer.r.animation.value }]">
			<!-- ステップ1: 分岐選択 -->
			<div v-if="instance.registrationClosed" key="closed" :class="$style.container">{{ i18n.ts._hata._registrationApplications.closedMessage }}</div>
			<div v-else-if="step === 'branch'" key="branch" :class="$style.container">
				<div :class="$style.branchMessage">
					<MkHatakyuIllustration v-if="useHatakyuBranding()" asset="waving" :size="72" style="margin: 0 auto;"/><i v-else class="ti ti-user-plus" :class="$style.branchIcon"></i>
					<p>{{ copy.haveInviteCode }}</p>
					<p :class="$style.branchDescription">{{ flow.branchIntro }}</p>
				</div>
				<div :class="$style.branchButtons">
					<button type="button" class="_button" :class="$style.branchOption" @click="goInviteCode"><i class="ti ti-ticket" aria-hidden="true"></i><span><strong>{{ copy.haveInviteCodeYes }}</strong><small>{{ flow.inviteDescription }}</small></span><i class="ti ti-arrow-right" aria-hidden="true"></i></button>
					<button type="button" class="_button" :class="$style.branchOption" @click="goApplication"><i class="ti ti-pencil" aria-hidden="true"></i><span><strong>{{ copy.haveInviteCodeNo }}</strong><small>{{ flow.applicationDescription }}</small></span><i class="ti ti-arrow-right" aria-hidden="true"></i></button>
				</div>
			</div>

			<!-- ステップ2a: 通常登録（申請制のときは招待コード登録） -->
			<div v-show="!instance.registrationClosed && step === 'invite'" key="invite">
				<XServerRules v-show="!isAcceptedServerRule" @done="acceptRules" @cancel="backFromRules" @update:agreed="onAgreedUpdate"/>
				<XSignup v-if="signupVisited" v-show="isAcceptedServerRule" :autoSet="autoSet" :agreementsAccepted="isAcceptedServerRule && step === 'invite' && !instance.registrationClosed" @back="isAcceptedServerRule = false" @signup="onSignup" @signupEmailPending="onSignupEmailPending"/>
			</div>

			<!-- ステップ2b: 申請登録フォーム -->
			<div v-show="!instance.registrationClosed && step === 'application'" key="application">
				<MkRegistrationApplication
					@complete="onApplicationComplete"
					@back="backFromApplication"
				/>
			</div>

			<!-- ステップ3: 申請完了メッセージ -->
			<div v-if="!instance.registrationClosed && step === 'applicationComplete'" key="complete" :class="$style.container">
				<div :class="$style.completeMessage">
					<MkHatakyuIllustration v-if="useHatakyuBranding()" asset="treasureFound" :size="72" style="margin: 0 auto;"/><i v-else class="ti ti-circle-check" :class="$style.completeIcon"></i>
					<h3>{{ copy.applicationComplete }}</h3>
					<p :class="$style.completionDescription">{{ copy.applicationCompleteDescription }}</p>
					<div :class="$style.notice">
						<ul>
							<li>{{ copy.reviewTime }}</li>
							<li>{{ copy.noRejectionEmail }}</li>
							<li>{{ copy.criteriaNotPublic }}</li>
						</ul>
					</div>
					<div :class="$style.completeButton">
						<MkButton primary rounded @click="onClose">{{ i18n.ts.close }}</MkButton>
					</div>
				</div>
			</div>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, ref, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import XSignup from '@/components/MkSignupDialog.form.vue';
import XServerRules from '@/components/MkSignupDialog.rules.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkRegistrationApplication from '@/components/MkRegistrationApplication.vue';
import MkHatakyuIllustration from '@/components/MkHatakyuIllustration.vue';
import { useHatakyuBranding } from '@/utility/hatakyu-assets.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { focusRegistrationElement } from '@/utility/registration-consent.js';

const props = withDefaults(defineProps<{
	autoSet?: boolean;
}>(), {
	autoSet: false,
});

const emit = defineEmits<{
	(ev: 'done', res: Misskey.entities.SignupResponse): void;
	(ev: 'cancelled'): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');
const applicationMode = computed(() => !instance.registrationClosed && instance.disableRegistration === true);
const step = ref<'branch' | 'invite' | 'application' | 'applicationComplete'>(applicationMode.value ? 'branch' : 'invite');
const isAcceptedServerRule = ref(false);
const signupVisited = ref(false);
const stages = useTemplateRef<HTMLDivElement>('stages');
const copy = i18n.ts._hata._common;
const flow = i18n.ts._hata._registrationApplications._flow;

function onAgreedUpdate(value: boolean) { if (!value) isAcceptedServerRule.value = false; }

// A settings refresh can change the registration mode while this dialog is open.
// Re-enter the matching rules flow rather than keeping a stale application form.
watch([applicationMode, () => instance.registrationClosed], ([enabled]) => {
	if (step.value === 'applicationComplete') return;
	isAcceptedServerRule.value = false;
	signupVisited.value = false;
	step.value = enabled ? 'branch' : 'invite';
}, { flush: 'sync' });

watch([step, isAcceptedServerRule], () => {
	void nextTick(() => {
		const stage = Array.from(stages.value?.children ?? []).find(element => (element as HTMLElement).style.display !== 'none') as HTMLElement | undefined;
		if (!stage) return;
		const candidates = Array.from(stage.querySelectorAll<HTMLElement>('h2, h3, button'));
		const target = candidates.find(element => {
			let current: HTMLElement | null = element;
			while (current && current !== stage) { if (current.style.display === 'none' || current.inert) return false; current = current.parentElement; }
			return true;
		});
		if (target?.matches('h2, h3')) target.tabIndex = -1;
		focusRegistrationElement(target, { scrollToTop: true });
	});
});

onMounted(() => {
	window.document.documentElement.setAttribute('data-hata-signup-modal-open', 'true');
});

onUnmounted(() => {
	window.document.documentElement.removeAttribute('data-hata-signup-modal-open');
});

function goInviteCode() {
	if (instance.registrationClosed) return;
	step.value = 'invite';
}

function goApplication() {
	if (!applicationMode.value) return;
	step.value = 'application';
}

function acceptRules() {
	if (step.value === 'invite' && !instance.registrationClosed) {
		signupVisited.value = true;
		isAcceptedServerRule.value = true;
	}
}

function backFromRules() {
	isAcceptedServerRule.value = false;
	if (applicationMode.value) step.value = 'branch';
	else onClose();
}

function backFromApplication() {
	isAcceptedServerRule.value = false;
	step.value = applicationMode.value ? 'branch' : 'invite';
}

function onClose() {
	emit('cancelled');
	dialog.value?.close();
}

function onSignup(res: Misskey.entities.SignupResponse) {
	if (instance.registrationClosed || step.value !== 'invite') return;
	emit('done', res);
	dialog.value?.close();
}

function onSignupEmailPending() {
	if (instance.registrationClosed || step.value !== 'invite') return;
	dialog.value?.close();
}

function onApplicationComplete() {
	if (applicationMode.value && step.value === 'application') step.value = 'applicationComplete';
}
</script>

<style lang="scss" module>
.completionDescription {
	white-space: pre-line;
}

.container {
	padding: 24px;
}

.branchMessage {
	text-align: center;
	margin-bottom: 20px;

	p {
		font-size: 1.1em;
		margin: 8px 0 0;
	}
}

.branchIcon {
	font-size: 40px;
	color: var(--MI_THEME-accent);
}

.branchButtons {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.branchDescription { font-size: .9em !important; opacity: .7; }
.stages > div { animation: stageIn 260ms ease both; }
.noMotion > div { animation: none; }
.noMotion .branchOption { transition: none; }
@keyframes stageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.branchOption { display: flex; align-items: center; gap: 13px; width: 100%; padding: 18px 16px; border: 1px solid var(--MI_THEME-divider); border-radius: 16px; background: var(--MI_THEME-panel); text-align: left; transition: background 260ms, border-color 260ms, transform 260ms; }
.branchOption > i:first-child { padding: 12px; border-radius: 12px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }
.branchOption span { flex: 1; min-width: 0; }
.branchOption strong, .branchOption small { display: block; line-height: 1.6; }
.branchOption small { margin-top: 4px; opacity: .7; }
.branchOption:hover { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); transform: translateY(-2px); }
.branchOption:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 3px; }

.completeMessage {
	text-align: center;

	h3 {
		margin: 16px 0 8px;
	}

	p {
		color: var(--MI_THEME-fg);
		line-height: 1.6;
	}
}

/* 旗鯖fork: 完了画面の「閉じる」ボタンを中央寄せ (MkButton は block 幅のため text-align では中央化されない) */
.completeButton {
	display: flex;
	justify-content: center;
	margin-top: 16px;
}

.completeIcon {
	font-size: 48px;
	color: var(--MI_THEME-success);
}

.notice {
	background: var(--MI_THEME-bg);
	border-radius: 8px;
	padding: 16px;
	margin: 16px 0;
	text-align: left;
	font-size: 0.9em;

	ul {
		margin: 0;
		padding-left: 20px;
		line-height: 1.8;
	}
}

.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 260ms cubic-bezier(0,0,.35,1), transform 260ms cubic-bezier(0,0,.35,1);
}
.transition_x_enterFrom {
	opacity: 0;
	transform: translateX(50px);
}
.transition_x_leaveTo {
	opacity: 0;
	transform: translateX(-50px);
}
@media (prefers-reduced-motion: reduce) { .stages > div { animation: none; } .transition_x_enterActive, .transition_x_leaveActive, .branchOption { transition: none; } }
</style>
