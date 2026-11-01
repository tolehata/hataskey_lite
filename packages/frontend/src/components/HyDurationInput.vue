<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<fieldset ref="field" :class="$style.field">
	<legend>{{ label || copy.durationLabel }} <small>{{ i18n.ts.optional }}</small></legend>
	<div v-if="!precise" :class="$style.minutes"><input :id="id" :name="`${id}-minutes`" :value="minuteDraft" type="number" inputmode="decimal" min="0" :max="maxSeconds / 60" step="any" placeholder="0" :aria-label="i18n.tsx._hata._hatady._controls.durationInputLabel({ label: label || copy.durationLabel, unit: copy.minutesUnit })" @input="setMinutes"><span>{{ copy.minutesUnit }}</span></div>
	<div v-else :class="$style.parts"><label v-for="(unit, index) in units" :key="unit"><input :name="`${id}-${index}`" :value="partDraft[index]" type="number" inputmode="numeric" min="0" :max="index ? 59 : Math.floor(maxSeconds / 3600)" step="1" placeholder="0" :aria-label="i18n.tsx._hata._hatady._controls.durationInputLabel({ label: label || copy.durationLabel, unit })" @input="setPart(index, $event)"><span>{{ unit }}</span></label></div>
	<div :class="$style.presets" role="group" :aria-label="copy.chooseDuration"><button v-for="minutes in presets || [5, 15, 30, 60]" :key="minutes" type="button" :disabled="!canChoose(minutes * 60)" :aria-pressed="!invalid && modelValue === minutes * 60" @click="choose(minutes * 60)">{{ minutes < 60 ? i18n.tsx._hata._hatady._controls.minutesPreset({ count: String(minutes) }) : i18n.tsx._hata._hatady._controls.hoursPreset({ count: String(minutes / 60) }) }}</button><button type="button" @click="switchMode">{{ precise ? copy.inputMinutes : copy.inputPrecise }}</button><button v-if="hasInput || invalid" type="button" :aria-label="copy.clearDuration" @click="choose(null)"><i class="ti ti-x" aria-hidden="true"></i></button></div>
</fieldset>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._controls;
const props = withDefaults(defineProps<{ modelValue: number | null; label?: string; presets?: number[]; maxSeconds?: number }>(), { maxSeconds: 128849018820 });
const emit = defineEmits<{ (event: 'update:modelValue', value: number | null): void }>();
const id = useId(), units = [copy.hoursUnit, copy.minutesUnit, copy.secondsUnit];
const field = ref<HTMLFieldSetElement>();
const precise = ref(props.modelValue != null && props.modelValue % 60 !== 0);
const minuteDraft = ref('');
const partDraft = ref<string[]>(['', '', '']);
const invalid = ref(false);
const hasInput = computed(() => precise.value ? partDraft.value.some(value => value !== '') : minuteDraft.value !== '');
let pendingValue: number | null | undefined;

function syncDrafts(value: number | null): void {
	minuteDraft.value = value == null ? '' : String(value / 60);
	partDraft.value = value == null ? ['', '', ''] : [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60].map(String);
}

syncDrafts(props.modelValue);
watch(() => props.modelValue, value => {
	// A v-model echo must not replace the text (or invalid fields) being edited.
	if (value !== pendingValue) syncDrafts(value);
	pendingValue = undefined;
}, { flush: 'sync' });
watch([() => props.modelValue, () => props.maxSeconds], () => validate(), { flush: 'post' });
onMounted(() => validate());

function canChoose(seconds: number): boolean {
	return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= props.maxSeconds;
}

function publish(value: number | null): void {
	pendingValue = value === props.modelValue ? undefined : value;
	emit('update:modelValue', value);
}

function validate(): { valid: boolean; value: number | null } {
	const inputs = Array.from(field.value?.querySelectorAll('input') ?? []);
	inputs.forEach(input => input.setCustomValidity(''));
	const blank = precise.value ? partDraft.value.every(value => value === '') : minuteDraft.value === '';
	const value = blank ? null : precise.value ? Number(partDraft.value[0]) * 3600 + Number(partDraft.value[1]) * 60 + Number(partDraft.value[2]) : Math.round(Number(minuteDraft.value) * 60);
	const nativeValid = inputs.every(input => input.validity.valid);
	if (nativeValid && value != null && !canChoose(value)) {
		inputs[0]?.setCustomValidity(copy.durationTooLarge);
	}
	invalid.value = !nativeValid || (value != null && !canChoose(value));
	return { valid: !invalid.value, value };
}

function update(): void {
	const result = validate();
	if (result.valid) publish(result.value);
}

function setMinutes(event: Event): void {
	const input = event.target as HTMLInputElement;
	minuteDraft.value = input.value;
	update();
}

function setPart(index: number, event: Event): void {
	const input = event.target as HTMLInputElement;
	partDraft.value[index] = input.value;
	update();
}

async function switchMode(): Promise<void> {
	const result = validate();
	if (!result.valid) {
		Array.from(field.value?.querySelectorAll('input') ?? []).find(input => !input.validity.valid)?.reportValidity();
		return;
	}
	syncDrafts(result.value);
	precise.value = !precise.value;
	await nextTick();
	validate();
}

async function choose(value: number | null): Promise<void> {
	if (value != null && !canChoose(value)) return;
	syncDrafts(value);
	publish(value);
	await nextTick();
	validate();
}
</script>

<style lang="scss" module>
.field { min-width: 0; border: 0; margin: 0; padding: 0; }
.field > legend { padding: 0; margin-bottom: 10px; font-weight: 700; font-size: 14px; }
.field small { color: var(--hy-muted); font-size: 12px; font-weight: 400; margin-left: 6px; }
.minutes { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--hy-border); border-radius: 16px; background: var(--hy-bg); }
.minutes input { min-width: 0; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; font-size: 26px; font-variant-numeric: tabular-nums; }
.parts { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.parts label { min-width: 0; display: flex; flex-direction: column; gap: 6px; color: var(--hy-muted); font-size: 13px; }
.parts input { box-sizing: border-box; min-width: 0; width: 100%; border: 1px solid var(--hy-border); padding: 12px; background: var(--hy-bg); color: var(--hy-ink); border-radius: 12px; font: inherit; font-size: 20px; min-height: 48px; }
.presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.presets button { min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 8px 14px; background: var(--hy-surface); color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.presets button[aria-pressed="true"] { background: var(--hy-soft); border-color: var(--hy-accent); color: var(--hy-accent); }
.presets button:disabled { opacity: .45; cursor: default; }
</style>
