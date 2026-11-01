<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<template v-if="hostMobile">
	<Transition :enterActiveClass="$style.scrimMoving" :leaveActiveClass="$style.scrimMoving" :enterFromClass="$style.scrimHidden" :leaveToClass="$style.scrimHidden">
		<div v-if="open" :class="$style.scrim" aria-hidden="true" @click="emit('close')"></div>
	</Transition>
	<Transition :enterActiveClass="$style.moving" :leaveActiveClass="$style.moving" :enterFromClass="$style.collapsed" :leaveToClass="$style.collapsed" @afterLeave="closed">
		<div v-if="open" ref="panel" :class="$style.mobilePanel" data-hatagoes-mobile-create="">
			<div ref="mobileScroll" :class="$style.mobileScroll" :style="{ maxHeight: `${Math.max(0, maxHeight)}px` }"><slot/></div>
		</div>
	</Transition>
</template>
<Teleport v-else to="body">
	<HatagoesDialog :open="open" @close="emit('close')" @closed="closed"><slot/></HatagoesDialog>
</Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import HatagoesDialog from './HatagoesDialog.vue';

const props = defineProps<{ open: boolean; mobile: boolean; maxHeight: number; returnFocus?: HTMLElement | null }>();
const emit = defineEmits<{ close: []; closed: [] }>();
const panel = ref<HTMLElement>();
const mobileScroll = ref<HTMLElement>();
// Keep the mounted form intact if the viewport changes while creation is open.
const hostMobile = ref(props.mobile);

watch(() => props.open, open => { if (open) hostMobile.value = props.mobile; });

function closed() {
	emit('closed');
	if (hostMobile.value) props.returnFocus?.focus({ preventScroll: true });
}

function onKeydown(event: KeyboardEvent) {
	if (!hostMobile.value || !props.open) return;
	if (event.target instanceof Element && event.target.closest('[data-modal-content], [role="dialog"]:not([aria-label="作成"])')) return;
	if (event.key === 'Escape') { event.preventDefault(); emit('close'); return; }
	if (event.key !== 'Tab' || !panel.value) return;
	const focusable = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length > 0);
	if (!focusable.length) return;
	const first = focusable[0];
	const last = focusable.at(-1)!;
	if (event.shiftKey && (window.document.activeElement === first || !panel.value.contains(window.document.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (window.document.activeElement === last || !panel.value.contains(window.document.activeElement))) { event.preventDefault(); first.focus(); }
}

watch(() => hostMobile.value && props.open, async active => {
	if (active) {
		window.addEventListener('keydown', onKeydown, true);
		await nextTick();
		if (!props.open || !hostMobile.value) return;
		(panel.value?.querySelector<HTMLElement>('button[aria-label="閉じる"]') ?? panel.value?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
		if (mobileScroll.value) mobileScroll.value.scrollTop = 0;
	} else window.removeEventListener('keydown', onKeydown, true);
}, { immediate: true });
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true));
</script>

<style module>
.scrim { position: absolute; inset: 0; z-index: 5; background: #0005; }
.scrimMoving { transition: opacity 260ms ease; }
.scrimHidden { opacity: 0; }
.mobilePanel { position: relative; z-index: 6; flex: none; display: grid; grid-template-rows: 1fr; min-height: 0; margin: 0 12px; overflow: hidden; border: 1px solid var(--rule); border-bottom: 0; border-radius: 24px 24px 0 0; background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); }
.mobileScroll { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.moving { transition: grid-template-rows 360ms cubic-bezier(.22,1,.36,1), opacity 260ms ease, transform 360ms cubic-bezier(.22,1,.36,1); }
.collapsed { grid-template-rows: 0fr; opacity: 0; transform: translateY(16px); }
</style>
