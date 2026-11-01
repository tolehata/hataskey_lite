<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<Teleport to="body">
	<Transition name="event-move-dialog" @afterEnter="focusPrimary">
		<div v-if="isOpen" :class="$style.overlay" :data-hatask-theme="theme" :data-hatask-mode="colorMode" @click.self="emit('choose', 'cancel')">
			<section ref="dialogEl" :class="$style.dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" @keydown="onDialogKeydown">
				<div :class="$style.handle" aria-hidden="true"></div>
				<header>
					<span :class="$style.heroIcon" :data-mode="mode"><i :class="mode === 'trash' ? 'ti ti-trash' : 'ti ti-calendar-bolt'" aria-hidden="true"></i></span>
					<div><span :class="$style.eyebrow">{{ mode === 'trash' ? labels.trashEyebrow : labels.moveEyebrow }}</span><h2 :id="titleId">{{ mode === 'trash' ? labels.trashTitle : labels.moveTitle }}</h2></div>
				</header>

				<div :class="$style.eventCard"><i class="ti ti-calendar-event" aria-hidden="true"></i><strong>{{ eventTitle }}</strong></div>
				<div v-if="mode === 'reschedule'" :class="$style.route" aria-hidden="true"><span>{{ sourceLabel }}</span><i class="ti ti-arrow-narrow-right"></i><span>{{ targetLabel }}</span></div>
				<p :class="$style.description">{{ mode === 'trash' ? labels.trashDescription : labels.moveDescription }}</p>

				<div v-if="mode === 'reschedule'" :class="$style.choices">
					<button ref="primaryEl" type="button" :class="$style.primary" @click="emit('choose', 'move')"><i class="ti ti-arrow-move-right" aria-hidden="true"></i><span><strong>{{ labels.move }}</strong><small>{{ labels.moveHint }}</small></span></button>
					<button type="button" @click="emit('choose', 'copy')"><i class="ti ti-copy-plus" aria-hidden="true"></i><span><strong>{{ labels.copy }}</strong><small>{{ labels.copyHint }}</small></span></button>
				</div>
				<div v-else :class="$style.trashChoices"><button ref="primaryEl" type="button" :class="$style.danger" @click="emit('choose', 'trash')"><i class="ti ti-trash" aria-hidden="true"></i>{{ labels.trash }}</button></div>
				<button type="button" :class="$style.cancel" @click="emit('choose', 'cancel')">{{ labels.cancel }}</button>
			</section>
		</div>
	</Transition>
</Teleport>
</template>

<script lang="ts" setup>
import { nextTick, ref } from 'vue';
import type { HataskPlannerTheme } from './hatask-planner-types.js';

export type HataskEventMoveDialogLabels = {
	moveEyebrow: string;
	moveTitle: string;
	moveDescription: string;
	move: string;
	moveHint: string;
	copy: string;
	copyHint: string;
	trashEyebrow: string;
	trashTitle: string;
	trashDescription: string;
	trash: string;
	cancel: string;
};

defineProps<{
	isOpen: boolean;
	theme?: HataskPlannerTheme;
	colorMode?: 'light' | 'dark';
	mode: 'reschedule' | 'trash';
	eventTitle: string;
	sourceLabel: string;
	targetLabel: string;
	labels: HataskEventMoveDialogLabels;
}>();
const emit = defineEmits<{ (ev: 'choose', choice: 'move' | 'copy' | 'trash' | 'cancel'): void }>();
const dialogEl = ref<HTMLElement | null>(null);
const primaryEl = ref<HTMLButtonElement | null>(null);
const titleId = 'hatask-event-move-dialog-title';

function focusPrimary(): void { nextTick(() => (primaryEl.value ?? dialogEl.value)?.focus()); }

function onDialogKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.preventDefault();
		emit('choose', 'cancel');
		return;
	}
	if (event.key !== 'Tab' || dialogEl.value == null) return;
	const focusable = [...dialogEl.value.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
		.filter(element => element.offsetParent !== null || element === window.document.activeElement);
	if (focusable.length === 0) return;
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (event.shiftKey && window.document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && window.document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}
</script>

<style lang="scss" module>
.overlay{--surface:var(--MI_THEME-panel);--fg:var(--MI_THEME-fg);--fg-2:color-mix(in srgb,var(--MI_THEME-fg) 80%,transparent);--fg-3:color-mix(in srgb,var(--MI_THEME-fg) 60%,transparent);--rule:color-mix(in srgb,var(--MI_THEME-fg) 15%,transparent);--fill:color-mix(in srgb,var(--MI_THEME-fg) 6%,transparent);--accent:var(--MI_THEME-accent);position:fixed;inset:0;z-index:1000003;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.dialog{width:min(100%,520px);display:grid;gap:14px;padding:18px;border:1px solid var(--rule);border-radius:28px;background:color-mix(in srgb,var(--surface) 96%,transparent);color:var(--fg);box-shadow:0 35px 100px -35px rgba(0,0,0,.85);font-family:var(--htk-font-body,inherit);outline:0}.handle{display:none;width:42px;height:4px;margin:-5px auto 0;border-radius:99px;background:var(--rule)}.dialog header{display:flex;align-items:center;gap:12px}.heroIcon{width:48px;height:48px;display:grid;place-items:center;flex:none;border-radius:16px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);font-size:1.25rem}.heroIcon[data-mode=trash]{background:color-mix(in srgb,#d94359 11%,transparent);color:#d94359}.eyebrow{color:var(--fg-3);font-size:.61rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.dialog h2{margin:2px 0 0;font-size:1.08rem;line-height:1.35}.eventCard{min-width:0;display:flex;align-items:center;gap:9px;padding:11px 13px;border:1px solid var(--rule);border-radius:15px;background:var(--fill)}.eventCard i{color:var(--accent)}.eventCard strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem}.route{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);align-items:center;gap:5px;color:var(--fg-2);font-size:.69rem;text-align:center}.route span{padding:7px;border-radius:10px;background:var(--fill);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.route i{color:var(--accent)}.description{margin:0;color:var(--fg-2);font-size:.72rem;line-height:1.65}.choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.choices button, .trashChoices button{min-height:74px;display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:12px;border:1px solid var(--rule);border-radius:17px;background:var(--surface);color:var(--fg);font:inherit;text-align:start;cursor:pointer;transition:transform .18s var(--ease-spring,ease),border-color .18s ease,background-color .18s ease}.choices button>i{font-size:1.2rem;color:var(--accent)}.choices button span{display:grid;gap:3px}.choices button strong{font-size:.77rem}.choices button small{color:var(--fg-3);font-size:.62rem;line-height:1.35}.choices .primary{border-color:color-mix(in srgb,var(--accent) 42%,var(--rule));background:color-mix(in srgb,var(--accent) 8%,var(--surface))}.choices button:hover, .choices button:focus-visible{transform:translateY(-2px);border-color:var(--accent)}.trashChoices .danger{width:100%;min-height:52px;justify-content:center;border-color:color-mix(in srgb,#d94359 42%,var(--rule));background:color-mix(in srgb,#d94359 9%,var(--surface));color:#d94359;font-weight:850}.cancel{min-height:44px;border:0;border-radius:13px;background:transparent;color:var(--fg-2);font:750 .74rem/1 var(--htk-font-body,inherit);cursor:pointer}.cancel:hover, .cancel:focus-visible{background:var(--fill)}.dialog button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}:global(.event-move-dialog-enter-active), :global(.event-move-dialog-leave-active){transition:opacity .2s ease}:global(.event-move-dialog-enter-active) .dialog, :global(.event-move-dialog-leave-active) .dialog{transition:transform .3s var(--ease-smooth,cubic-bezier(.22,1,.36,1)),opacity .2s ease}:global(.event-move-dialog-enter-from), :global(.event-move-dialog-leave-to){opacity:0}:global(.event-move-dialog-enter-from) .dialog, :global(.event-move-dialog-leave-to) .dialog{opacity:0;transform:translateY(18px) scale(.97)}@media(max-width:560px){.overlay{place-items:end center;padding:12px 12px max(12px,env(safe-area-inset-bottom))}.dialog{border-radius:26px;padding:15px}.handle{display:block}.choices{grid-template-columns:1fr}.choices button{min-height:66px}}@media(prefers-reduced-motion:reduce){:global(.event-move-dialog-enter-active), :global(.event-move-dialog-leave-active), :global(.event-move-dialog-enter-active) .dialog, :global(.event-move-dialog-leave-active) .dialog, .choices button{transition:none!important}}
/* Teleport先の暁パレット。ほかのテーマは共有パレットから受け取る。 */
.overlay[data-hatask-theme='akatsuki'] {
	--surface: #fff7f2;
	--fg: #2b1f2c;
	--fg-2: #6a5566;
	--fg-3: #6a5566;
	--rule: rgba(80, 50, 70, .18);
	--fill: rgba(224, 86, 122, .06);
	--accent: #b02e56;
	--htk-font-body: 'Zen Kaku Gothic New', sans-serif;
	color-scheme: light;
}
.overlay[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] {
	--surface: #1b1424;
	--fg: #f6ecf3;
	--fg-2: #c8b5c6;
	--fg-3: #c8b5c6;
	--rule: rgba(255, 255, 255, .18);
	--fill: rgba(255, 127, 163, .08);
	--accent: #ff7fa3;
	color-scheme: dark;
}
.overlay[data-hatask-theme] .dialog { box-sizing: border-box; max-height: calc(100dvh - 36px); overflow-y: auto; border-radius: 24px; background: var(--surface); }
.overlay[data-hatask-theme] .dialog h2 { font-family: var(--htk-font-head, 'Zen Maru Gothic'), sans-serif; }
.overlay[data-hatask-theme] .eyebrow, .overlay[data-hatask-theme] .choices button small { font-size: max(11px, .7rem); }
.overlay[data-hatask-theme] .description, .overlay[data-hatask-theme] .route { font-size: max(12px, .75rem); }
.overlay[data-hatask-theme] .eventCard strong, .overlay[data-hatask-theme] .route span { white-space: normal; overflow-wrap: anywhere; }
.overlay[data-hatask-theme][data-hatask-mode='dark'] .danger, .overlay[data-hatask-theme][data-hatask-mode='dark'] .heroIcon[data-mode='trash'] { color: #ff8798; }
.overlay:not([data-hatask-theme='akatsuki']) .dialog { border-radius: var(--card-radius); box-shadow: var(--shadow); }
</style>
