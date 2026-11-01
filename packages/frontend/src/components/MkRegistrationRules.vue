<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="root" :class="[$style.root, { [$style.noMotion]: !prefer.r.animation.value }]">
	<div class="_gaps_s">
		<MkInfo v-if="!application && instance.disableRegistration" warn>{{ i18n.ts.invitationRequiredToRegister }}</MkInfo>
		<MkInfo v-if="instance.federation === 'specified'" warn>{{ i18n.ts.federationSpecified }}</MkInfo>
		<MkInfo v-else-if="instance.federation === 'none'" warn>{{ i18n.ts.federationDisabled }}</MkInfo>
	</div>
	<p>{{ i18n.ts.pleaseConfirmBelowBeforeSignup }}</p>
	<div v-for="(section, index) in sections" :key="section.id" :class="[$style.panel, { [$style.current]: index === firstPending }]">
		<button :id="`${uid}-${section.id}-heading`" type="button" class="_button" :class="$style.heading" :disabled="index > firstPending" :aria-expanded="expanded === section.id" :aria-controls="`${uid}-${section.id}`" @click="expanded = expanded === section.id ? null : section.id">
			<i :class="consents[index] ? 'ti ti-circle-check' : 'ti ti-circle'" aria-hidden="true"></i><strong>{{ section.label }}</strong><i class="ti ti-chevron-down" aria-hidden="true"></i>
		</button>
		<div :class="[$style.expansion, { [$style.open]: expanded === section.id }]" :inert="expanded !== section.id">
			<div :id="`${uid}-${section.id}`" :class="$style.body">
				<ol v-if="section.id === 'rules'" :class="$style.rules"><li v-for="(rule, ruleIndex) in instance.serverRules" :key="ruleIndex"><div v-html="rule"></div></li></ol>
				<template v-else-if="section.document">
					<a v-if="section.document.url" :href="section.document.url" target="_blank" rel="noopener noreferrer" class="_link" @click="opened[section.id] = true" @auxclick="onAuxClick($event, section.id)">{{ section.label }} <i class="ti ti-external-link" aria-hidden="true"></i></a>
					<p v-else role="alert" :class="$style.error">{{ flow.documentUnavailable }}</p>
					<p :id="`${uid}-${section.id}-hint`" :class="$style.hint">{{ flow.documentOpenHint }}</p>
				</template>
				<template v-else-if="section.id === 'privacy'">
					<div v-if="application" class="_gaps_s">
						<section><strong>{{ copy.contactsHandling }}</strong><p>{{ copy.contactsDeletion }}</p></section>
						<section><strong>{{ copy.ifApproved }}</strong><p>{{ copy.approvedEmailUse }}</p></section>
						<section><strong>{{ copy.ifRejected }}</strong><ul><li>{{ copy.rejectedCredentialsDeletedBefore }}<strong>ID</strong>{{ copy.rejectedCredentialsDeletedMiddle }}<strong>{{ i18n.ts.password }}</strong>{{ copy.rejectedCredentialsDeletedAfter }}</li><li>{{ copy.emailLabel }}{{ copy.rejectedEmailRetention }}</li><li>{{ copy.noRejectionEmail }}</li></ul></section>
						<MkInfo><span :class="$style.emailReuseWarning">{{ copy.emailReuseWarning }}</span></MkInfo>
					</div>
					<template v-else><p>{{ flow.signupPrivacyUse }}</p><p>{{ flow.signupPrivacyContact }}</p></template>
				</template>
				<label :class="$style.agreement"><input type="checkbox" :checked="consents[index]" :disabled="!canAgree(index)" :aria-describedby="section.document ? `${uid}-${section.id}-hint` : undefined" :data-testid="`signup-rules-${section.id === 'notes' ? 'notes' : section.id}-agree`" @change="changeConsent(index, $event)"><span>{{ i18n.ts.agree }}</span></label>
			</div>
		</div>
	</div>
	<p v-if="!allAgreed" aria-live="polite" :class="$style.hint">{{ i18n.ts.pleaseAgreeAllToContinue }}</p>
	<div :class="$style.actions">
		<MkButton inline rounded @click="emit('cancel')">{{ i18n.ts.cancel }}</MkButton>
		<div :class="[$style.next, { [$style.open]: allAgreed }]" :inert="!allAgreed"><div><MkButton inline primary rounded :disabled="!allAgreed" data-testid="signup-rules-continue" @click="continueToForm">{{ flow.next }} <i class="ti ti-arrow-right" aria-hidden="true"></i></MkButton></div></div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import { focusRegistrationElement, registrationDocument, updateRegistrationConsent } from '@/utility/registration-consent.js';
import type { RegistrationDocument } from '@/utility/registration-consent.js';

const props = withDefaults(defineProps<{ application?: boolean; agreed?: boolean }>(), { application: false, agreed: false });
const emit = defineEmits<{ (ev: 'done'): void; (ev: 'cancel'): void; (ev: 'update:agreed', agreed: boolean): void }>();
const uid = useId();
const root = useTemplateRef<HTMLDivElement>('root');
const copy = i18n.ts._hata._registrationApplications._application;
const flow = i18n.ts._hata._registrationApplications._flow;
type Section = { id: string; label: string; document?: RegistrationDocument };
const sections = computed<Section[]>(() => {
	const result: Section[] = [];
	if (instance.serverRules.length > 0) result.push({ id: 'rules', label: i18n.ts.serverRules });
	const terms = registrationDocument(instance.tosUrl, window.location.origin);
	const policy = registrationDocument(instance.privacyPolicyUrl, window.location.origin);
	if (terms.configured) result.push({ id: 'terms', label: i18n.ts.termsOfService, document: terms });
	if (policy.configured) result.push({ id: 'policy', label: i18n.ts.privacyPolicy, document: policy });
	result.push({ id: 'privacy', label: copy.privacyHandling });
	if (!props.application) result.push({ id: 'notes', label: i18n.ts.basicNotesBeforeCreateAccount, document: registrationDocument('https://misskey-hub.net/docs/for-users/onboarding/warning/', window.location.origin) });
	return result;
});
const consents = ref<boolean[]>([]);
const opened = ref<Record<string, boolean>>({});
const expanded = ref<string | null>(null);
const firstPending = computed(() => { const index = consents.value.findIndex(value => !value); return index < 0 ? sections.value.length : index; });
const allAgreed = computed(() => consents.value.length === sections.value.length && consents.value.every(Boolean));
watch(() => JSON.stringify([props.application, instance.serverRules, instance.tosUrl, instance.privacyPolicyUrl]), () => {
	consents.value = sections.value.map(() => false);
	opened.value = {};
	expanded.value = sections.value[0]?.id ?? null;
	emit('update:agreed', false);
}, { immediate: true, flush: 'sync' });
watch(allAgreed, value => emit('update:agreed', value), { flush: 'sync' });

function canAgree(index: number): boolean {
	const section = sections.value[index];
	return index <= firstPending.value && (!section.document || Boolean(section.document.url && opened.value[section.id]));
}

function changeConsent(index: number, event: Event) {
	const input = event.target as HTMLInputElement;
	consents.value = updateRegistrationConsent(consents.value, index, input.checked, canAgree(index));
	input.checked = consents.value[index];
	// Move keyboard focus to the next heading as its former panel becomes inert.
	if (consents.value[index] && firstPending.value < sections.value.length) {
		expanded.value = sections.value[firstPending.value].id;
		const headingId = `${uid}-${expanded.value}-heading`;
		void nextTick(() => focusRegistrationElement(root.value?.querySelector<HTMLElement>(`[id="${headingId}"]`)));
	} else if (!consents.value[index]) expanded.value = sections.value[index].id;
}

function onAuxClick(event: MouseEvent, id: string) { if (event.button === 1) opened.value[id] = true; }

function continueToForm() { if (allAgreed.value) emit('done'); }
</script>

<style lang="scss" module>
.root { padding: 24px; }
.panel { border: 1px solid var(--MI_THEME-divider); border-radius: 16px; background: var(--MI_THEME-panel); margin: 12px 0; overflow: clip; }
.current { border-color: var(--MI_THEME-accent); }
.heading { display: flex; align-items: center; gap: 10px; padding: 16px; width: 100%; text-align: left; color: var(--MI_THEME-fg); }
.heading strong { flex: 1; }
.heading:disabled { color: var(--MI_THEME-fgTransparent); cursor: default; }
.heading:focus-visible, .agreement input:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -3px; }
.expansion, .next { display: grid; grid-template-rows: 0fr; visibility: hidden; opacity: 0; transition: grid-template-rows 260ms ease, opacity 260ms ease, visibility 260ms; }
.open { grid-template-rows: 1fr; visibility: visible; opacity: 1; }
.body, .next > div { min-height: 0; overflow: hidden; }
.body { padding: 0 16px; line-height: 1.8; overflow-wrap: anywhere; }
.rules { padding-left: 24px; }
.emailReuseWarning { white-space: pre-line; overflow-wrap: normal; }
.agreement { display: flex; gap: 10px; align-items: center; padding: 16px 0; border-top: 1px solid var(--MI_THEME-divider); }
.agreement input { accent-color: var(--MI_THEME-accent); width: 18px; height: 18px; }
.hint { font-size: .9em; opacity: .75; }
.error { color: var(--MI_THEME-error); }
.actions { display: flex; justify-content: center; align-items: start; margin-top: 20px; }
.next { min-width: 0; max-width: 0; margin-left: 0; overflow: hidden; transition: grid-template-rows 260ms ease, max-width 260ms ease, margin-left 260ms ease, opacity 260ms ease, visibility 260ms; }
.next > div { white-space: nowrap; }
.next.open { max-width: 20em; margin-left: 12px; }
.noMotion .expansion, .noMotion .next { transition: none; }
@media (prefers-reduced-motion: reduce) { .expansion, .next { transition: none; } }
</style>
