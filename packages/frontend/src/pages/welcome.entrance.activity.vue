<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-show="panels.length > 0" ref="root" :class="$style.root" data-welcome-activity>
	<div ref="track" :class="$style.track" :data-mobile="mobile" @scroll.passive="syncPanel" @scrollend="onScrollEnd" @pointerdown="onManualScroll" @wheel.passive="onManualScroll">
		<section v-if="statsEnabled && activity" :class="$style.panel" data-activity-panel="active" :data-activity-visible="!mobile || activePanel === 'active'" :inert="mobile && activePanel !== 'active'" :aria-hidden="mobile && activePanel !== 'active' ? true : undefined" :aria-label="labels.active">
			<h3 :class="$style.heading"><i class="ti ti-activity" aria-hidden="true"></i>{{ labels.active }}</h3>
			<dl :class="$style.readouts">
				<div><dt>{{ language === 'ja' ? '7日平均' : '7-day average' }}</dt><dd><span data-activity-average>{{ format(activity.average, 1) }}</span><small>{{ language === 'ja' ? '人' : 'users' }}</small></dd></div>
				<div><dt>{{ language === 'ja' ? '昨日' : 'Yesterday' }}</dt><dd><span data-activity-yesterday>{{ format(activity.yesterday) }}</span><small>{{ language === 'ja' ? '人' : 'users' }}</small></dd></div>
			</dl>
			<p :class="$style.caption">{{ language === 'ja' ? '今日を除く直近7日・UTC集計' : 'Last 7 complete days · UTC' }}</p>
		</section>
		<section v-if="statsEnabled && members !== null" :class="$style.panel" data-activity-panel="members" :data-activity-visible="!mobile || activePanel === 'members'" :inert="mobile && activePanel !== 'members'" :aria-hidden="mobile && activePanel !== 'members' ? true : undefined" :aria-label="labels.members">
			<h3 :class="$style.heading"><i class="ti ti-users" aria-hidden="true"></i>{{ labels.members }}</h3>
			<p :class="$style.members"><span data-activity-members>{{ format(members) }}</span><small>{{ language === 'ja' ? '人' : 'members' }}</small></p>
			<p :class="$style.caption">{{ language === 'ja' ? 'このサーバーに集まる人たち' : 'People on this server' }}</p>
		</section>
	</div>
	<div v-if="panels.length > 1" :class="$style.pager" role="group" :aria-label="language === 'ja' ? 'サーバー情報の切り替え。左右にスワイプできます' : 'Server information. Swipe left or right'" @keydown="onPageKey">
		<button type="button" class="_button" :class="$style.pageButton" data-activity-prev :disabled="activeIndex === 0" :aria-label="language === 'ja' ? '前の項目' : 'Previous panel'" @click="movePanel(-1)"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
		<div :class="$style.pageStatus">
			<span data-activity-current role="status" aria-live="polite" aria-atomic="true">{{ labels[activePanel] }}</span>
			<span :class="$style.dots" aria-hidden="true"><span v-for="panel in panels" :key="panel" :class="$style.dot" :data-active="activePanel === panel"></span></span>
		</div>
		<button type="button" class="_button" :class="$style.pageButton" data-activity-next :disabled="activeIndex >= panels.length - 1" :aria-label="language === 'ja' ? '次の項目' : 'Next panel'" @click="movePanel(1)"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { instance } from '@/instance.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { parseServerMembers, summarizeServerActivity } from '@/utility/welcome-server-activity.js';

const props = defineProps<{ language: 'ja' | 'en' }>();
defineOptions({ name: 'WelcomeServerActivity' });
const emit = defineEmits<{ (ev: 'resize'): void }>();
type Panel = 'active' | 'members';
const root = ref<HTMLElement>();
const track = ref<HTMLElement>();
const mobile = ref(false);
const activePanel = ref<Panel>('active');
const interacted = ref(false);
const activity = ref<ReturnType<typeof summarizeServerActivity>>(null);
const members = ref<number | null>(null);
const statsEnabled = computed(() => instance.clientOptions.showActivitiesForVisitor !== false);
const panels = computed<Panel[]>(() => {
	if (!statsEnabled.value) return [];
	return (['active', 'members'] as const).filter(panel => panel === 'active' ? activity.value !== null : members.value !== null);
});
const activeIndex = computed(() => Math.max(0, panels.value.indexOf(activePanel.value)));
const labels = computed(() => props.language === 'ja' ? {
	active: 'アクティブ人数', members: 'サーバー人数',
} : { active: 'Active users', members: 'Members' });

function format(value: number, maximumFractionDigits = 0) {
	return new Intl.NumberFormat(props.language === 'ja' ? 'ja-JP' : 'en-US', { maximumFractionDigits }).format(value);
}

watch(statsEnabled, async (enabled, _previous, onCleanup) => {
	const request = new AbortController();
	onCleanup(() => request.abort());
	activity.value = null;
	members.value = null;
	if (!enabled) return;
	// Each public endpoint may fail independently. Never substitute example data
	// or turn an unavailable count into zero; late responses cannot restore it.
	await Promise.allSettled([
		misskeyApi('stats', {}, null, request.signal).then(response => {
			if (!request.signal.aborted) members.value = parseServerMembers(response);
		}),
		misskeyApi('charts/active-users', { span: 'day', limit: 8 }, null, request.signal).then(response => {
			if (!request.signal.aborted) activity.value = summarizeServerActivity(response);
		}),
	]);
}, { immediate: true });

let scrollTarget: number | null = null;

function alignPanel(smooth = false) {
	const element = track.value;
	if (!element) return;
	const index = Math.max(0, panels.value.indexOf(activePanel.value));
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const left = mobile.value ? index * element.clientWidth : 0;
	scrollTarget = smooth && !reduce ? left : null;
	element.scrollTo({ left, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

function selectPanel(panel: Panel) {
	interacted.value = true;
	activePanel.value = panel;
	alignPanel(true);
}

function syncPanel() {
	const element = track.value;
	if (!mobile.value || !element?.clientWidth || panels.value.length === 0) return;
	// While an arrow's smooth scroll is in flight, repeated presses advance from
	// its intended panel, not whichever panel is briefly passing underneath.
	if (scrollTarget !== null && Math.abs(element.scrollLeft - scrollTarget) > 1) return;
	scrollTarget = null;
	const index = Math.round(element.scrollLeft / element.clientWidth);
	activePanel.value = panels.value[Math.max(0, Math.min(panels.value.length - 1, index))];
}

function onManualScroll() {
	interacted.value = true;
	scrollTarget = null;
	syncPanel();
}

function onScrollEnd() {
	scrollTarget = null;
	syncPanel();
}

function movePanel(direction: -1 | 1) {
	const index = activeIndex.value + direction;
	if (index < 0 || index >= panels.value.length) return;
	selectPanel(panels.value[index]);
}

function onPageKey(event: KeyboardEvent) {
	const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
	if (!keys.includes(event.key)) return;
	event.preventDefault();
	if (event.key === 'Home') selectPanel(panels.value[0]);
	else if (event.key === 'End') selectPanel(panels.value[panels.value.length - 1]);
	else movePanel(event.key === 'ArrowRight' ? 1 : -1);
}

let observer: ResizeObserver | undefined;
let disposed = false;

function measure() {
	const entrance = root.value?.closest<HTMLElement>('[data-hataskey-entrance]');
	const width = entrance?.clientWidth ?? 0;
	mobile.value = (width > 0 ? width : window.innerWidth) <= 820;
	alignPanel();
}

watch(panels, async (available) => {
	if (!interacted.value || !available.includes(activePanel.value)) activePanel.value = available[0] ?? 'active';
	await nextTick();
	if (disposed) return;
	alignPanel();
	emit('resize');
});

onMounted(() => {
	measure();
	observer = new ResizeObserver(measure);
	if (root.value) {
		observer.observe(root.value);
		const entrance = root.value.closest<HTMLElement>('[data-hataskey-entrance]');
		if (entrance) observer.observe(entrance);
	}
});
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); });
</script>

<style lang="scss" module>
.root {
	width: min(980px, 100%);
	min-width: 0;
	color: var(--fg);
}

.track {
	display: flex;
	gap: 12px;
	align-items: stretch;
	min-width: 0;
}

.panel {
	--activity-delay: 0ms;
	--activity-x: -16px;
	--activity-y: 12px;
	--activity-tilt: -8deg;
	--activity-ease: cubic-bezier(.16, 1, .3, 1);
	flex: 1 1 0;
	min-width: 0;
	box-sizing: border-box;
	padding: 18px;
	border: 1px solid var(--dividerStrong);
	border-radius: 20px;
	background: color-mix(in srgb, var(--panel) 80%, transparent);
	text-align: center;
	// Keep the scroll-snap box still; only fade its surface and move its content.
	&[data-activity-panel="active"] { --activity-delay: 45ms; --activity-x: 0px; --activity-y: 20px; --activity-tilt: 10deg; }
	&[data-activity-panel="members"] { --activity-delay: 90ms; --activity-x: 16px; --activity-y: -12px; --activity-tilt: -12deg; }
	&[data-activity-visible="true"] {
		animation: surfaceArrive .48s var(--activity-ease) var(--activity-delay) backwards;
		> * { animation: contentArrive .64s var(--activity-ease) calc(var(--activity-delay) + 45ms) backwards; }
		> :nth-child(2) { animation-delay: calc(var(--activity-delay) + 90ms); }
		> :nth-child(3) { animation-delay: calc(var(--activity-delay) + 135ms); }
		.heading > i { animation: iconArrive .72s var(--activity-ease) calc(var(--activity-delay) + 90ms) backwards; }
	}
	// Never make a focused or pressed control wait for its entrance to finish.
	&:focus-within, &:active {
		animation: none;
		> *, .heading > i { animation: none; }
	}
}

.heading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 7px;
	margin: 0 0 18px;
	font-size: 12px;
	font-weight: 700;
	letter-spacing: .04em;
	color: var(--fgSoft);
	i { color: var(--accentText); }
}

.readouts {
	display: flex;
	justify-content: center;
	gap: 18px;
	margin: 0;
	> div { min-width: 0; flex: 1; }
	dt { font-size: 11px; color: var(--fgMuted); }
	dd { margin: 3px 0 0; font-size: clamp(24px, 4cqi, 36px); }
}

.readouts dd, .members {
	font-variant-numeric: tabular-nums;
	font-weight: 700;
	line-height: 1.25;
	overflow-wrap: anywhere;
	small { display: inline-block; margin-inline-start: 4px; font-size: 11px; font-weight: 500; color: var(--fgMuted); }
}

.members { margin: 22px 0 0; font-size: clamp(30px, 5cqi, 44px); }
.caption { margin: 16px 0 0; font-size: 10.5px; line-height: 1.7; color: var(--fgMuted); }
.pager { display: none; }

@container hataskey-entrance (max-width: 820px) {
	.track {
		gap: 0;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		border-radius: 20px;
		&::-webkit-scrollbar { display: none; }
	}
	.panel {
		flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always;
		// The incoming panel must stay under the finger, not drift horizontally.
		&[data-activity-panel] { --activity-delay: 0ms; --activity-x: 0px; --activity-y: 12px; }
	}
	.pager { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 12px; width: min(320px, 100%); margin: 10px auto 0; }
	.pageButton {
		display: grid;
		place-items: center;
		width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		box-shadow: none;
		font-size: 16px;
		color: var(--fg);
		transition: color .18s, background-color .18s, opacity .18s;
		&:not(:disabled):hover, &:not(:disabled):active { color: var(--accentText); background: var(--accentedBg); }
		&:disabled { opacity: .35; cursor: default; }
		&:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	}
	.pageStatus { display: grid; justify-items: center; gap: 7px; min-width: 0; color: var(--fgSoft); font-size: 12px; font-weight: 700; text-align: center; }
	.dots { display: flex; gap: 7px; color: var(--accentText); }
	.dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .3; transition: opacity .2s; }
	.dot[data-active="true"] { opacity: 1; }
}

@keyframes surfaceArrive { from { opacity: .35; } to { opacity: 1; } }
@keyframes contentArrive {
	from { opacity: 0; transform: translate3d(var(--activity-x), var(--activity-y), 0) scale(.96); }
	to { opacity: 1; transform: none; }
}
@keyframes iconArrive {
	from { opacity: 0; transform: translateY(-8px) rotate(var(--activity-tilt)) scale(.7); }
	65% { opacity: 1; transform: translateY(1px) rotate(0deg) scale(1.08); }
	to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
	.panel[data-activity-visible="true"] {
		animation: none;
		> *, .heading > i { animation: none; }
	}
	.dot, .pageButton { transition: none; }
}
</style>
