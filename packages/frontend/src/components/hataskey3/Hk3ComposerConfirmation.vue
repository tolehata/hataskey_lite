<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section
	ref="panelEl"
	:class="$style.panel"
	:data-active="active ? 'true' : undefined"
	:data-reduced-motion="reducedMotion ? 'true' : undefined"
	:inert="!active"
	:aria-hidden="!active"
	role="dialog"
	aria-modal="true"
	:aria-labelledby="titleId"
	:aria-describedby="noteId"
	:aria-busy="busy"
	@keydown="onKeydown"
>
	<div :class="$style.heading">
		<span :class="$style.mark" aria-hidden="true"><component :is="actionIcon" :size="20"/></span>
		<h2 :id="titleId">{{ title }}</h2>
	</div>
	<div :id="noteId" :class="$style.note">
		<MkAvatar :user="displayNote.user" :class="$style.avatar"/>
		<div :class="$style.author"><b><MkUserName :user="displayNote.user"/></b><span>{{ handle }}</span></div>
		<p v-if="!displayNote.isHidden && (displayNote.cw != null || displayNote.text)" :class="$style.excerpt"><Mfm :text="displayNote.cw ?? displayNote.text ?? ''" :plain="true" :author="displayNote.user" :emojiUrls="displayNote.emojis"/></p>
		<p v-else-if="!displayNote.isHidden && displayNote.files?.length" :class="$style.excerpt">{{ copy.attachmentsOnly }}</p>
	</div>
	<p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
	<div :class="$style.actions">
		<button ref="cancelEl" type="button" :class="$style.cancel" :title="i18n.ts.cancel" :aria-label="i18n.ts.cancel" :aria-disabled="busy" @click="onCancel"><X :size="20" aria-hidden="true"/></button>
		<button ref="confirmEl" type="button" :class="$style.confirm" :title="actionLabel" :aria-label="actionLabel" :disabled="busy" @click="$emit('confirm')"><LoaderCircle v-if="busy" :size="20" :class="$style.spin" aria-hidden="true"/><component :is="actionIcon" v-else :size="20" aria-hidden="true"/></button>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { LoaderCircle, Pencil, Repeat2, Trash2, X } from '@lucide/vue';
import type { NoteActionConfirmation } from '@/utility/note-action-confirmation.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{ request: NoteActionConfirmation; active: boolean; busy: boolean; error: string | null; reducedMotion: boolean }>();
const emit = defineEmits<{ cancel: []; confirm: []; height: [height: number] }>();
const copy = i18n.ts._hata._hataskeyUi3;
const id = useId();
const titleId = `${id}-title`;
const noteId = `${id}-note`;
const panelEl = ref<HTMLElement | null>(null);
const cancelEl = ref<HTMLButtonElement | null>(null);
const confirmEl = ref<HTMLButtonElement | null>(null);
const displayNote = computed(() => props.request.kind === 'unrenote' && props.request.note.renote ? props.request.note.renote : props.request.note);
const title = computed(() => props.request.kind === 'delete' ? i18n.ts.noteDeleteConfirm : props.request.kind === 'deleteAndEdit' ? i18n.ts.deleteAndEditConfirm : copy.unrenoteConfirm);
const actionLabel = computed(() => props.error ? i18n.ts.retry : props.request.kind === 'delete' ? i18n.ts.delete : props.request.kind === 'deleteAndEdit' ? i18n.ts.deleteAndEdit : i18n.ts.unrenote);
const actionIcon = computed(() => props.request.kind === 'delete' ? Trash2 : props.request.kind === 'deleteAndEdit' ? Pencil : Repeat2);
const handle = computed(() => `@${displayNote.value.user.username}${displayNote.value.user.host ? `@${displayNote.value.user.host}` : ''}`);

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
	if (typeof ResizeObserver === 'undefined' || !panelEl.value) return;
	resizeObserver = new ResizeObserver(() => {
		const height = panelEl.value?.offsetHeight ?? 0;
		if (height > 0) emit('height', height);
	});
	resizeObserver.observe(panelEl.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

function focusCancel() { cancelEl.value?.focus({ preventScroll: true }); }

function measureHeight() { return panelEl.value?.offsetHeight ?? 0; }

function onCancel() { if (!props.busy && props.active) emit('cancel'); }

function onKeydown(ev: KeyboardEvent) {
	if (!props.active) return;
	if (ev.key === 'Escape') {
		ev.preventDefault();
		ev.stopPropagation();
		if (!props.busy) emit('cancel');
		return;
	}
	if (ev.key === 'Tab') {
		ev.preventDefault();
		const current = window.document.activeElement;
		const target = props.busy ? cancelEl.value : ev.shiftKey
			? current === cancelEl.value ? confirmEl.value : cancelEl.value
			: current === confirmEl.value ? cancelEl.value : confirmEl.value;
		target?.focus({ preventScroll: true });
	} else if (ev.key === 'Enter' && ev.target !== cancelEl.value && ev.target !== confirmEl.value) {
		ev.preventDefault();
	}
}

defineExpose({ focusCancel, measureHeight });
</script>

<style lang="scss" module>
.panel {
	position: absolute;
	inset: 0 0 auto;
	box-sizing: border-box;
	padding: 18px 18px 16px;
	max-height: min(70svh, 560px);
	overflow-y: auto;
	overscroll-behavior: contain;
	border: 1px solid color-mix(in srgb, var(--hk3-divider) 55%, transparent);
	border-radius: 17px;
	background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-soft-alpha, 30%), transparent);
	-webkit-backdrop-filter: blur(18px) saturate(1.15);
	backdrop-filter: blur(18px) saturate(1.15);
	color: var(--hk3-text);
	opacity: 0;
	transform: translateY(var(--hk3-confirm-enter-offset, 14px));
	pointer-events: none;
	transition: opacity 190ms ease, transform 400ms cubic-bezier(.22, 1, .36, 1);
	&[data-active] { opacity: 1; transform: translateY(0); pointer-events: auto; }
}
:global([data-mobile-dock]) .panel {
	border: 0;
	background: transparent;
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}
.heading { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: color-mix(in srgb, var(--hk3-accent) 15%, transparent); color: var(--hk3-accent-800); }
.heading h2 { max-width: 36em; margin: 0; font-size: 16px; line-height: 1.45; font-weight: 700; }
.note { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 15px; padding: 12px 13px; border-radius: 14px; background: color-mix(in srgb, var(--hk3-text) 6%, transparent); text-align: center; }
.avatar { width: 32px; height: 32px; border-radius: 10px; flex: none; }
.author { display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; gap: 7px; min-width: 0; font-size: 12px; }
.author span { color: var(--hk3-neutral-700); font-size: 11px; overflow-wrap: anywhere; }
.excerpt { max-width: 32em; margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.error { margin: 10px 0 0; color: var(--hk3-accent-800); font-size: 12px; text-align: center; }
.actions { display: flex; justify-content: center; gap: 8px; margin-top: 15px; }
.actions button { display: grid; place-items: center; width: 44px; height: 44px; min-width: 44px; padding: 0; border-radius: 12px; cursor: pointer; }
.actions button:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
.cancel { border: 0; background: color-mix(in srgb, var(--hk3-text) 8%, transparent); color: var(--hk3-text); }
.cancel[aria-disabled="true"] { opacity: .55; cursor: not-allowed; }
.confirm { border: 1px solid color-mix(in srgb, var(--hk3-accent) 36%, transparent); background: color-mix(in srgb, var(--hk3-accent) 16%, transparent); color: var(--hk3-accent-800); }
.confirm:disabled { opacity: .65; cursor: wait; }
.spin { animation: hk3ConfirmationSpin .8s linear infinite; }
@keyframes hk3ConfirmationSpin { to { transform: rotate(360deg); } }
@media (max-width: 380px) { .panel { padding: 14px 12px; } .heading h2 { font-size: 14px; } .note { padding: 9px; } }
@media (prefers-reduced-motion: reduce) { .panel { transition: none; } .spin { animation: none; } }
.panel[data-reduced-motion] { transition: none; }
.panel[data-reduced-motion] .spin { animation: none; }
</style>
