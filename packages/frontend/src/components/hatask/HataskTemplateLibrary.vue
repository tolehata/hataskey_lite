<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.root" :data-hatask-theme="theme" :aria-label="labels.library">
	<header :class="$style.header">
		<div>
			<span :class="$style.eyebrow">{{ labels.reusable }}</span>
			<h3>{{ labels.library }}</h3>
		</div>
		<div v-if="showKindFilter" :class="$style.kindFilter" role="group" :aria-label="labels.filter">
			<button v-for="option in kindOptions" :key="option.id" type="button" :data-active="kind === option.id" :aria-pressed="kind === option.id" :title="option.label" @click="emit('update:kind', option.id)">
				<i :class="option.icon" aria-hidden="true"></i><span>{{ option.label }}</span>
			</button>
		</div>
	</header>

	<TransitionGroup v-if="visibleTemplates.length" name="template-card" tag="ul" :class="$style.grid">
		<li v-for="(template, index) in visibleTemplates" :key="template.id" :class="$style.card" :data-kind="template.kind">
			<div :class="$style.kindIcon" aria-hidden="true"><i :class="template.kind === 'event' ? 'ti ti-calendar-event' : 'ti ti-checkbox'"></i></div>
			<div :class="$style.body">
				<div :class="$style.titleRow"><strong>{{ template.name }}</strong><span>{{ template.kind === 'event' ? labels.event : labels.todo }}</span></div>
				<p v-if="templateSummary(template)">{{ templateSummary(template) }}</p>
			</div>
			<div :class="$style.actions" role="group" :aria-label="template.name">
				<button type="button" :class="$style.useAction" :disabled="readOnly" :aria-label="labels.use(template.name)" :title="labels.use(template.name)" @click="emit('use', template)"><i class="ti ti-arrow-up" aria-hidden="true"></i><span>{{ labels.useAction }}</span></button>
				<div :class="$style.secondaryActions">
					<button type="button" :disabled="readOnly" :aria-label="labels.duplicate(template.name)" :title="labels.duplicate(template.name)" @click="emit('duplicate', template)"><i class="ti ti-copy" aria-hidden="true"></i></button>
					<button type="button" :disabled="readOnly || index === 0" :aria-label="labels.moveUp(template.name)" :title="labels.moveUp(template.name)" @click="emit('move', template, -1)"><i class="ti ti-chevron-up" aria-hidden="true"></i></button>
					<button type="button" :disabled="readOnly || index === visibleTemplates.length - 1" :aria-label="labels.moveDown(template.name)" :title="labels.moveDown(template.name)" @click="emit('move', template, 1)"><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
					<button type="button" :class="$style.danger" :disabled="readOnly" :aria-label="labels.archive(template.name)" :title="labels.archive(template.name)" @click="emit('archive', template)"><i class="ti ti-archive" aria-hidden="true"></i></button>
				</div>
			</div>
		</li>
	</TransitionGroup>

	<div v-else :class="$style.empty"><i class="ti ti-template" aria-hidden="true"></i><strong>{{ labels.empty }}</strong><span>{{ labels.emptyHint }}</span></div>
</section>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { HataskPlannerTheme } from './hatask-planner-types.js';
import type { HataskPlannerTemplate, HataskPlannerTemplateKind } from '@/utility/hatask-planner-storage.js';

export type HataskTemplateKindFilter = 'all' | HataskPlannerTemplateKind;
export type HataskTemplateLabels = {
	library: string;
	reusable: string;
	filter: string;
	all: string;
	todo: string;
	event: string;
	empty: string;
	emptyHint: string;
	useAction: string;
	use: (name: string) => string;
	duplicate: (name: string) => string;
	archive: (name: string) => string;
	moveUp: (name: string) => string;
	moveDown: (name: string) => string;
};

const props = withDefaults(defineProps<{
	theme?: HataskPlannerTheme;
	templates: HataskPlannerTemplate[];
	kind?: HataskTemplateKindFilter;
	labels: HataskTemplateLabels;
	readOnly?: boolean;
	showKindFilter?: boolean;
}>(), { theme: undefined, kind: 'all', readOnly: false, showKindFilter: true });

const emit = defineEmits<{
	(ev: 'update:kind', value: HataskTemplateKindFilter): void;
	(ev: 'use', template: HataskPlannerTemplate): void;
	(ev: 'duplicate', template: HataskPlannerTemplate): void;
	(ev: 'archive', template: HataskPlannerTemplate): void;
	(ev: 'move', template: HataskPlannerTemplate, direction: -1 | 1): void;
}>();

const kindOptions = computed(() => [
	{ id: 'all' as const, icon: 'ti ti-layout-grid', label: props.labels.all },
	{ id: 'todo' as const, icon: 'ti ti-checkbox', label: props.labels.todo },
	{ id: 'event' as const, icon: 'ti ti-calendar-event', label: props.labels.event },
]);
const visibleTemplates = computed(() => props.templates
	.filter(template => template.archivedAt == null && (props.kind === 'all' || template.kind === props.kind))
	.sort((a, b) => a.position - b.position));

function templateSummary(template: HataskPlannerTemplate): string {
	const payload = template.payload;
	if (template.kind === 'todo') {
		return [typeof payload.text === 'string' ? payload.text : '', typeof payload.duePreset === 'string' && payload.duePreset !== 'none' ? String(payload.dueLabel ?? '') : ''].filter(Boolean).join(' · ');
	}
	return [typeof payload.title === 'string' ? payload.title : '', typeof payload.timeStart === 'string' ? payload.timeStart : ''].filter(Boolean).join(' · ');
}
</script>

<style lang="scss" module>
.root{container-type:inline-size;display:grid;gap:13px}.header{display:flex;align-items:center;justify-content:space-between;gap:12px}.header h3{margin:2px 0 0;font:850 1rem/1.25 var(--htk-font-head,inherit)}.eyebrow{color:var(--fg-3);font-size:.62rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.kindFilter{display:flex;gap:3px;padding:4px;border:1px solid var(--rule);border-radius:999px;background:var(--fill-2)}.kindFilter button{min-height:38px;display:flex;align-items:center;gap:6px;padding:0 11px;border:0;border-radius:999px;background:transparent;color:var(--fg-2);font:750 .7rem/1 var(--htk-font-body,inherit);cursor:pointer}.kindFilter button[data-active=true]{background:var(--surface);color:var(--accent);box-shadow:0 4px 14px -10px rgba(0,0,0,.55)}.grid{display:grid;gap:8px;margin:0;padding:0;list-style:none}.card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:68px;padding:8px;border:1px solid var(--rule);border-radius:16px;background:color-mix(in srgb,var(--surface) 96%,var(--fill));transition:transform .24s var(--ease-smooth,ease),border-color .18s ease,opacity .2s ease}.card:hover{border-color:color-mix(in srgb,var(--accent) 28%,var(--rule));transform:translateY(-1px)}.kindIcon{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:color-mix(in srgb,var(--accent) 11%,transparent);color:var(--accent);font-size:1.05rem}.body{min-width:0;display:grid;gap:4px}.titleRow{min-width:0;display:flex;align-items:center;gap:7px}.titleRow strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.79rem}.titleRow span{flex:none;padding:3px 6px;border-radius:999px;background:var(--fill-2);color:var(--fg-3);font-size:.57rem;font-weight:800}.body p{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg-3);font-size:.68rem}.actions{display:flex;align-items:center;gap:5px}.useAction{min-width:max-content;height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;border:0;border-radius:999px;background:var(--accent);color:var(--on-accent,#fff);font:800 .68rem/1 var(--htk-font-body,inherit);cursor:pointer;box-shadow:0 8px 18px -12px var(--accent);transition:transform .16s var(--ease-spring,ease),filter .16s ease,opacity .16s ease}.useAction:hover:not(:disabled), .useAction:focus-visible:not(:disabled){filter:brightness(1.06)}.useAction:active:not(:disabled){transform:scale(.96)}.secondaryActions{display:flex;align-items:center;gap:2px;padding-inline-start:4px;border-inline-start:1px solid var(--rule)}.secondaryActions button{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--fg-2);cursor:pointer;transition:transform .16s var(--ease-spring,ease),background .16s ease,color .16s ease}.secondaryActions button:hover:not(:disabled), .secondaryActions button:focus-visible:not(:disabled){background:var(--fill-2);color:var(--accent)}.secondaryActions button:active:not(:disabled){transform:scale(.92)}.actions button:disabled{opacity:.3;cursor:default}.secondaryActions .danger:hover:not(:disabled){color:var(--error,#d9485f)}.empty{min-height:180px;display:grid;place-items:center;align-content:center;gap:7px;color:var(--fg-3);text-align:center}.empty>i{font-size:2rem;color:var(--accent)}.empty strong{color:var(--fg-2);font-size:.8rem}.empty span{font-size:.69rem}@container (max-width:720px){.card{grid-template-columns:40px minmax(0,1fr)}.actions{grid-column:1/-1;justify-content:space-between;border-top:1px solid var(--rule);padding-top:6px}.secondaryActions{gap:4px}.secondaryActions button{width:44px;height:44px}}@container (max-width:430px){.actions{align-items:stretch;flex-direction:column}.useAction{width:100%;height:44px}.secondaryActions{justify-content:space-between;padding:0;border-inline-start:0}.secondaryActions button{flex:1}}:global(.template-card-move), :global(.template-card-enter-active), :global(.template-card-leave-active){transition:transform .28s var(--ease-smooth,ease),opacity .2s ease}:global(.template-card-enter-from), :global(.template-card-leave-to){opacity:0;transform:translateY(-7px) scale(.98)}@media (prefers-reduced-motion:reduce){.card, .useAction, .secondaryActions button, :global(.template-card-move), :global(.template-card-enter-active), :global(.template-card-leave-active){transition:none!important}}
.root[data-hatask-theme] { --accent: var(--accent-ink); --fg-3: var(--fg-2); min-width: 0; }
.root[data-hatask-theme] .card { border-radius: 18px; background: var(--fill); box-shadow: none; }
.root[data-hatask-theme] .eyebrow, .root[data-hatask-theme] .titleRow span { font-size: max(11px, .7rem); }
.root[data-hatask-theme] .body p, .root[data-hatask-theme] .useAction { font-size: max(12px, .75rem); }
.root[data-hatask-theme] .titleRow strong, .root[data-hatask-theme] .card p { white-space: normal; overflow-wrap: anywhere; }
@container (max-width:520px) {
	.root[data-hatask-theme] .header { align-items: stretch; flex-direction: column; }
	.root[data-hatask-theme] .kindFilter { flex-wrap: wrap; justify-content: center; }
}
.root:not([data-hatask-theme='akatsuki']) { --on-accent: var(--htk-on-ink); }
:global(.htk-root:not([data-theme='akatsuki'])) .card { border-radius: var(--control-radius); }
</style>
