<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<Transition appear :css="motion" :enterActiveClass="$style.enterActive" :leaveActiveClass="$style.leaveActive" :enterFromClass="$style.hidden" :leaveToClass="$style.hidden" @beforeLeave="leavePanel">
	<div v-if="pane" :class="$style.overlay" :data-motion="motion" @keydown="onKeydown">
		<div :class="$style.scrim" @click="emit('close')"></div>
		<section ref="panel" :class="$style.panel" :data-glass="glass ? 'true' : undefined" role="dialog" aria-modal="true" :aria-label="pane === 'widgets' ? copy.paneWidgets : 'Hatask'" @click="onPanelClick">
			<Hk3RightPane :class="$style.content" :initialTab="pane" mobile @tabChange="emit('tabChange', $event)">
				<template #close>
					<button ref="closeButton" type="button" :class="$style.close" :aria-label="i18n.ts.close" @click="emit('close')"><X :size="20"/></button>
				</template>
			</Hk3RightPane>
		</section>
	</div>
</Transition>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import Hk3RightPane from './Hk3RightPane.vue';
import { i18n } from '@/i18n.js';

type PaneTab = 'widgets' | 'hatask';
const props = defineProps<{ pane: PaneTab | null; glass: boolean; motion: boolean }>();
const emit = defineEmits<{ close: []; tabChange: [tab: PaneTab] }>();
const copy = i18n.ts._hata._hataskeyUi3;
const panel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);

watch(() => props.pane, (pane, previous) => {
	if (pane && !previous) void nextTick(() => {
		const active = window.document.activeElement;
		const appRoot = panel.value?.closest('[data-hk3-theme]');
		if (appRoot && active instanceof HTMLElement && active !== window.document.body && !appRoot.contains(active)) return;
		closeButton.value?.focus({ preventScroll: true });
	});
}, { immediate: true });

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		emit('close');
		return;
	}
	if (event.key !== 'Tab' || !panel.value) return;
	const buttons = Array.from(panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
		.filter(element => !element.closest('[inert], [aria-hidden="true"]'));
	if (!buttons.length) return;
	const current = buttons.indexOf(window.document.activeElement as HTMLElement);
	if (current === -1) {
		event.preventDefault();
		buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus({ preventScroll: true });
		return;
	}
	const next = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
	if (next === 0 && !event.shiftKey || next === buttons.length - 1 && event.shiftKey) {
		event.preventDefault();
		buttons[next]?.focus({ preventScroll: true });
	}
}

function onPanelClick(event: MouseEvent) {
	const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
	if (anchor) {
		const destination = new URL(anchor.href, window.location.href);
		// 旗鯖fork: おはなのリンクは HataGoes の中の Hatask を開くので、/hatagoes への移動でも閉じる。
		if (destination.origin === window.location.origin && (destination.pathname.startsWith('/hatask') || destination.pathname === '/hatagoes')) emit('close');
	}
}

function leavePanel(element: Element) {
	element.setAttribute('inert', '');
	element.setAttribute('aria-hidden', 'true');
}
</script>

<style module>
.overlay { position: absolute; inset: 0; z-index: 950; display: flex; justify-content: flex-end; }
.scrim { position: absolute; inset: 0; background: color-mix(in srgb, var(--hk3-neutral-900) 48%, transparent); }
.panel { position: relative; isolation: isolate; display: flex; flex-direction: column; width: min(380px, 90vw); min-width: 0; height: 100%; color: var(--hk3-text); transition: transform 420ms cubic-bezier(.22, 1, .36, 1); }
.panel::before { content: ''; position: absolute; inset: 0 0 0 -32px; z-index: -1; pointer-events: none; background: var(--hk3-bg); -webkit-mask-image: linear-gradient(to right, transparent, #000 32px); mask-image: linear-gradient(to right, transparent, #000 32px); }
.panel[data-glass]::before { background: var(--hk3-glass-pane, var(--hk3-bg)); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.panel { box-sizing: border-box; padding-bottom: env(safe-area-inset-bottom, 0px); }
.close { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.close:hover { background: var(--hk3-accent-100); }
.close:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
.content { flex: 1; min-height: 0; }
.enterActive, .leaveActive { transition: opacity 420ms ease; }
.hidden { opacity: 0; }
.hidden .panel { transform: translateX(100%); }
.overlay[data-motion='false'], .overlay[data-motion='false'] * { transition: none !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) { .overlay, .overlay * { transition: none !important; animation: none !important; } }
</style>
