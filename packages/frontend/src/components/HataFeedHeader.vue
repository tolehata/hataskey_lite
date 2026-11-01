<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<header ref="root" :class="$style.header" :data-motion="prefer.r.animation.value" :data-preview="!!preview">
	<button type="button" :class="$style.brand" :aria-label="headerCopy.brandHome" @click="brandTapSequence++; emit('navigate', 'home')"><HataAppLogo app="hatafeed" :size="26" motion="startup" :monochrome="onDark" :active="active" :tapSequence="brandTapSequence"/><HataAppWordmark app="hatafeed" :onDark="onDark"/></button>
	<nav :class="$style.nav" aria-label="HataFeed">
		<button type="button" :class="$style.exit" :aria-label="headerCopy.exit" :title="headerCopy.exit" @click="closeCreate(); emit('exit')"><i class="ti ti-logout-2" aria-hidden="true"></i></button>
		<div ref="outline" :class="$style.capsule" :data-notification="ownsSurface && context.items.value.length > 0">
			<div :class="$style.surface">
				<HyCapsule :class="$style.tabs" :modelValue="tab" :options="tabs" :label="headerCopy.pages" @update:modelValue="emit('navigate', $event as HataFeedTab)">
					<template #icon="{ option }"><HataFeatureIcon v-if="hataFeatureForScreen(`hatafeed.${option.value}`)" bare :feature="hataFeatureForScreen(`hatafeed.${option.value}`)!" :size="20"/><i v-else :class="option.icon" aria-hidden="true"></i></template>
				</HyCapsule>
				<div ref="target" :class="$style.notice" :style="{ height: `${ownsSurface && context.items.value.length ? context.height.value : 0}px` }"></div>
			</div>
		</div>
	</nav>
	<div :class="$style.tools">
		<div ref="createDock" :class="$style.create" @keydown.esc.stop.prevent="closeCreate(true)">
			<button ref="createButton" type="button" class="hf-icon" :class="$style.add" :aria-label="createOpen ? headerCopy.createMenuClose : headerCopy.createMenu" :title="headerCopy.createMenu" :aria-expanded="createOpen" :aria-controls="menuId" aria-haspopup="menu" :data-open="createOpen" @click="toggleCreate" @keydown.down.prevent="openCreate"><i class="ti ti-plus" aria-hidden="true"></i></button>
			<button ref="projectButton" type="button" :class="$style.project" :data-icon-only="projectIconOnly" :aria-label="i18n.tsx._hata._hatafeed._header.switchProject({ name: projectName })" :title="projectName" @click="closeCreate(); emit('project', $event)"><i class="ti ti-flag-2" aria-hidden="true"></i><span v-if="!projectIconOnly">{{ projectName }}</span><span ref="projectMeasure" :class="$style.projectMeasure" aria-hidden="true">{{ projectName }}</span></button>
			<Transition :css="prefer.r.animation.value" :name="prefer.r.animation.value ? 'hf-create' : undefined">
				<div v-if="createOpen" :id="menuId" ref="createMenu" :class="$style.createMenu" role="menu" :aria-label="headerCopy.createMenu" @keydown.down.prevent="moveMenu(1)" @keydown.up.prevent="moveMenu(-1)">
					<button type="button" role="menuitem" @click="selectCreate('emoji')"><i class="ti ti-mood-plus" aria-hidden="true"></i>{{ copy.emojiRequest }}</button>
					<button type="button" role="menuitem" @click="selectCreate('issue')"><i class="ti ti-pencil-plus" aria-hidden="true"></i>{{ copy.newIssue }}</button>
				</div>
			</Transition>
		</div>
		<button type="button" class="hf-icon" :class="$style.bell" :aria-label="copy.notifications" :title="copy.notifications" @click="emit('notifications', $event)"><i class="ti ti-bell" aria-hidden="true"></i><span v-if="unread" :class="$style.badge">{{ unread > 99 ? '99+' : unread }}</span></button>
		<button type="button" class="hf-icon" :class="$style.refresh" :data-refreshing="refreshing" :disabled="refreshing" :aria-busy="refreshing" :aria-label="copy.refresh" :title="copy.refresh" @click="emit('refresh')"><i class="ti ti-refresh" aria-hidden="true"></i></button>
		<button type="button" class="hf-icon" :aria-label="headerCopy.settings" :title="headerCopy.settings" @click="emit('settings', $event)"><HataFeatureIcon feature="hatafeed-settings" :size="20" :mode="onDark ? 'mono-dark' : 'color'"/></button>
	</div>
</header>
<MkHataskeyNotificationToasts v-if="!preview && !inherited" :context="context"/>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, shallowRef, useId, watch } from 'vue';
import type { HataFeedTab } from '@/utility/hatafeed-ui.js';
import HyCapsule from '@/components/HyCapsule.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { hataFeatureForScreen } from '@/utility/hata-feature-icon.js';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { hataFeedDraftPromptOpen, registerHataFeedNoticeHost } from '@/utility/hatafeed-ui.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatafeed._home;
const headerCopy = i18n.ts._hata._hatafeed._header;
const props = defineProps<{ tab: HataFeedTab; projectName: string; staff: boolean; unread: number; refreshing?: boolean; preview?: boolean; onDark?: boolean }>();
const brandTapSequence = ref(0);
const emit = defineEmits<{ navigate: [tab: HataFeedTab]; create: [kind: 'emoji' | 'issue']; project: [event: MouseEvent]; notifications: [event: MouseEvent]; refresh: []; settings: [event: MouseEvent]; exit: [] }>();
const root = ref<HTMLElement>();
const createDock = ref<HTMLElement>();
const createButton = ref<HTMLButtonElement>();
const createMenu = ref<HTMLElement>();
const createOpen = ref(false);
const menuId = useId();
const projectButton = ref<HTMLButtonElement>();
const projectMeasure = ref<HTMLElement>();
const projectIconOnly = ref(false);
let projectObserver: ResizeObserver | undefined;

function measureProject() {
	const button = projectButton.value;
	const label = projectMeasure.value;

	if (!button || !label) return;
	// Keep the allocated slot stable so hiding the label cannot cause a resize loop.
	const iconWidth = button.querySelector('i')?.getBoundingClientRect().width ?? 20;
	projectIconOnly.value = label.getBoundingClientRect().width + iconWidth + 28 > button.clientWidth;
}

watch(() => props.projectName, () => nextTick(measureProject));

function closeCreate(focus = false) { createOpen.value = false; if (focus) createButton.value?.focus(); }

async function openCreate() { createOpen.value = true; await nextTick(); createMenu.value?.querySelector('button')?.focus(); }

function toggleCreate() { if (createOpen.value) closeCreate(true); else openCreate(); }

function selectCreate(kind: 'emoji' | 'issue') { closeCreate(true); emit('create', kind); }

function moveMenu(offset: number) {
	const buttons = Array.from(createMenu.value?.querySelectorAll('button') ?? []);
	const index = buttons.findIndex(button => button === window.document.activeElement);
	buttons[(index + offset + buttons.length) % buttons.length]?.focus();
}

function outside(event: Event) { if (event.target instanceof Node && !createDock.value?.contains(event.target)) closeCreate(); }

watch(() => props.tab, () => closeCreate());
const target = shallowRef<HTMLElement | null>(null);
const outline = shallowRef<HTMLElement | null>(null);
const active = ref(true);
const visible = ref(false);
// Preview mode is fixed for this mounted instance; receiver ownership must not switch.
const preview = props.preview === true;
const inherited = preview ? null : inject(hataskeyNotificationToastsKey, null);
const context = inherited ?? createHataskeyNotificationToasts(computed(() => true), computed(() => true));
const surface = { active: computed(() => active.value && visible.value), target, outline, animations: prefer.r.animation, paused: hataFeedDraftPromptOpen };
const ownsSurface = computed(() => context.surface.value === surface);
const unregisterSurface = preview ? () => {} : context.registerSurface(surface);
const unregisterReceiver = preview ? () => {} : registerNotificationPageContext(context, () => ownsSurface.value);
const unregisterNotices = preview ? () => {} : registerHataFeedNoticeHost({ active: () => ownsSurface.value, notify: message => context.enqueueStatus(message) });
const tabs = computed(() => [
	{ value: 'home', label: headerCopy.home, icon: 'ti ti-home' },
	{ value: 'issues', label: copy.issues, icon: 'ti ti-clipboard-list' },
	{ value: 'roadmap', label: copy.roadmap, icon: 'ti ti-route' },
	...(props.staff ? [{ value: 'emoji', label: copy.requestManagement, icon: 'ti ti-mood-plus' }] : []),
	{ value: 'beta', label: copy.beta, icon: 'ti ti-flask' },
]);
let observer: IntersectionObserver | undefined;
onMounted(() => {
	observer = new IntersectionObserver(entries => { visible.value = entries.some(entry => entry.isIntersecting); });
	if (root.value) observer.observe(root.value);
	projectObserver = new ResizeObserver(measureProject);
	if (projectButton.value) projectObserver.observe(projectButton.value);
	if (projectMeasure.value) projectObserver.observe(projectMeasure.value);
	measureProject();
	window.document.addEventListener('pointerdown', outside, true);
	window.document.addEventListener('focusin', outside);
});
onActivated(() => { active.value = true; });
onDeactivated(() => { active.value = false; });
onUnmounted(() => { observer?.disconnect(); projectObserver?.disconnect(); unregisterNotices(); unregisterReceiver(); unregisterSurface(); window.document.removeEventListener('pointerdown', outside, true); window.document.removeEventListener('focusin', outside); });
</script>

<style module>
.header { position: sticky; top: var(--MI-stickyTop, 0px); z-index: 5; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; padding: 14px 0 10px; background: var(--hy-bg); }
.header[data-preview='true'] { position: relative; top: auto; }
.header > .brand { justify-self: start; display: inline-flex; align-items: center; gap: 7px; padding: 0; border: 0; background: transparent; color: var(--hy-accent); font: 29px 'Hatady Brand', sans-serif; cursor: pointer; }
/* Reserve only the tabs' height. Notifications grow over the page, as in the
   Hataskey top bar, without moving the header tools or the content below it. */
.nav { display: flex; align-items: flex-start; justify-content: center; min-width: 0; height: 56px; justify-self: center; }
.exit { display: none; box-sizing: border-box; flex: 0 0 44px; width: 44px; height: 44px; margin-top: 6px; padding: 0; border: 1px solid var(--hy-border); border-radius: 50%; background: var(--hy-surface); color: var(--hy-ink); box-shadow: var(--hy-shadow); cursor: pointer; }
.exit > i { width: 1em; height: 1em; font-size: 20px; line-height: 1; }
.exit > i::before { font-size: 100%; }
.exit:hover { background: var(--hy-soft); }
.exit:focus-visible { outline: 2px solid var(--hy-accent); outline-offset: 2px; }
.capsule { position: relative; isolation: isolate; width: max-content; max-width: 100%; border-radius: 28px; }
/* The shared timer ring uses the same soft outline as simple.vue / HyNav. */
.capsule > svg[data-integrated='true'] { overflow: visible; z-index: -1; stroke-width: 40; stroke-linecap: round; filter: blur(14px); opacity: .55; }
.surface { position: relative; display: flex; flex-direction: column; align-items: center; max-width: 100%; box-sizing: border-box; border: 1px solid var(--hy-border); border-radius: inherit; background: var(--hy-surface); box-shadow: var(--hy-shadow); overflow: hidden; }
.surface > .tabs { width: auto; border: 0; box-shadow: none; background: transparent; }
/* Keep the capsule geometry fixed while giving transparent marks more room. */
.tabs > button > [data-hata-feature] { transform: scale(1.2); }
.tabs > button[data-active='false'] > [data-hata-feature] { transform: scale(1.4); }
.tabs > button[data-active='false'] > i { transform: scale(1.2); }
/* Notice text must not change the intrinsic width of the tabs. */
.notice { position: relative; width: 0; min-width: 100%; flex: none; overflow: hidden; transition: height .35s cubic-bezier(.22,1,.36,1); }
.tools { display: flex; align-items: center; gap: 4px; justify-self: end; width: 100%; min-width: 236px; max-width: 316px; }
.create { position: relative; display: flex; align-items: center; gap: 4px; flex: 1; min-width: 92px; }
.add { background: var(--hy-accent) !important; color: var(--hy-on-accent) !important; }
.add > i { display: grid; place-items: center; transition: transform .22s ease; }
.add > i::before { font-size: 100%; line-height: 1; }
.header[data-motion='false'] .add > i, .header[data-motion='false'] .notice { transition: none; }
.add[data-open='true'] > i { transform: rotate(45deg); }
.createMenu { position: absolute; top: calc(100% + 10px); right: 0; z-index: 1; display: grid; width: 220px; padding: 8px; border: 1px solid var(--hy-border); border-radius: 20px; background: var(--hy-surface); box-shadow: 0 16px 42px #0002; }
.createMenu button { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 14px; border: 0; border-radius: 14px; background: transparent; color: var(--hy-ink); text-align: left; cursor: pointer; }
.createMenu button:hover { background: var(--hy-soft); }
.create > .project { box-sizing: border-box; position: relative; min-width: 44px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 44px; padding: 8px 10px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: var(--hy-muted); font-size: 12px; cursor: pointer; }
.project > i { flex: none; width: 1em; margin: 0; font-size: 18px; text-align: center; }
.project > i::before { font-size: 100%; }
.project { overflow: hidden; }
.project span { white-space: nowrap; }
.project > .projectMeasure { position: absolute; visibility: hidden; pointer-events: none; width: max-content; }
.refresh[data-refreshing='true'] > i { animation: refreshing .8s linear infinite; }
@keyframes refreshing { to { transform: rotate(360deg); } }
.header[data-motion='false'] .refresh > i { animation: none; }
.bell { position: relative; }
.badge { position: absolute; top: 0; right: 0; padding: 1px 5px; border-radius: 999px; background: var(--hy-accent); color: var(--hy-on-accent); font-size: 10px; }
@container hatafeed (max-width: 850px) { .header { display: flex; flex-wrap: wrap; gap: 8px; } .tools { flex: 1; margin-inline-start: auto; } .nav { order: 1; flex: 1 0 100%; display: flex; justify-content: center; gap: 8px; } .exit { display: grid; place-items: center; } .capsule { min-width: 0; max-width: calc(100% - 52px); flex: 0 1 auto; }
	/* Include the capsule padding in its width; leave 44px + 8px for exit.
	   Module-only styles use native selectors, not scoped-style :deep(). */
	.surface > .tabs { box-sizing: border-box; }
	.tabs > button { box-sizing: border-box; padding-inline: 8px; }
	.tabs > button > i { flex-shrink: 0; width: 1em; font-size: 20px; line-height: 1; }
	.tabs > button > i::before { font-size: 100%; }
}
@container hatafeed (max-width: 440px) { .header > .brand { font-size: 23px; } .header { gap: 6px; padding-top: 10px; } .tools { gap: 0; min-width: 220px; } .create { gap: 0; min-width: 88px; } .tabs > button > span:not([data-hata-feature]) { display: none; } }
@media (prefers-reduced-motion: reduce) { .notice, .add > i { transition: none; } .refresh > i { animation: none !important; } }
</style>
<style scoped>
.hf-create-enter-active, .hf-create-leave-active { transition: opacity .18s, transform .18s; transform-origin: top right; }
.hf-create-enter-from, .hf-create-leave-to { opacity: 0; transform: translateY(-5px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .hf-create-enter-active, .hf-create-leave-active { transition: none; } }
</style>
