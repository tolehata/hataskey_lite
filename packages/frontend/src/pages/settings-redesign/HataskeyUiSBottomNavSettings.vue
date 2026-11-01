<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section class="bottomNavSettings" data-settings-search-group-id="settings.group.hataskey-ui-s.bottom-nav" :data-settings-search-id="searchId" aria-labelledby="hataskey-ui-s-bottom-nav-heading">
	<div class="heading"><div><span class="eyebrow">UI S</span><h3 id="hataskey-ui-s-bottom-nav-heading" ref="heading" tabindex="-1">{{ copy.title }}</h3><p>{{ copy.caption }}</p></div><button type="button" @click="resetOrder"><i class="ti ti-restore" aria-hidden="true"></i>{{ copy.resetOrder }}</button></div>
	<p id="hataskey-ui-s-bottom-nav-help" class="help">{{ copy.keyboardHint }}</p>
	<MkPreferenceContainer k="hataskeyUi3BottomNav">
	<draggable v-model="items" itemKey="id" handle=".bottomNavHandle" ghostClass="bottomNavGhost" :animation="150" class="items">
		<template #item="{ element: item, index }"><div class="item" :class="{ hidden: !isVisibleInUiS(item) }" :data-nav-id="item.id">
			<button type="button" class="bottomNavHandle" :aria-label="`${copy.reorder}: ${displayLabel(item)}`" aria-keyshortcuts="ArrowUp ArrowDown" aria-describedby="hataskey-ui-s-bottom-nav-help" @keydown="moveByKeyboard($event, index)"><i class="ti ti-grip-vertical" aria-hidden="true"></i></button>
			<i :class="item.icon || defaultById.get(item.id)?.icon || 'ti ti-circle'" aria-hidden="true"></i><span class="label">{{ displayLabel(item) }}</span>
			<label class="visibility"><span class="srOnly">{{ `${copy.show}: ${displayLabel(item)}` }}</span><input type="checkbox" role="switch" :checked="isVisibleInUiS(item)" :disabled="item.id === 'home'" @change="setVisible(item.id, $event.target as HTMLInputElement)"></label>
		</div></template>
	</draggable>
	</MkPreferenceContainer>
	<p v-if="visibleCount > UI_S_BOTTOM_NAV_MAX" class="warning" role="status">{{ copy.tooMany }}</p>
	<p v-else-if="limitMessage" class="warning" role="status">{{ copy.limitReached }}</p>
	<p class="saveHint">{{ copy.preview }}: {{ shownInUiS.map(displayLabel).join(' · ') }}</p>
	<p class="saveHint">{{ copy.saveHint }}</p>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import MkPreferenceContainer from '@/components/MkPreferenceContainer.vue';
import { canonicalSearchIdForPreferenceKey } from './settings-preferences-catalog.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import { getUiSBottomNavDefaults, normalizeBottomNavItems, normalizeUiSBottomNav, resolveUiSBottomNav, UI_S_BOTTOM_NAV_MAX } from '@/utility/hatasaba-navigation.js';
import type { HatasabaNavItem } from '@/utility/hatasaba-navigation.js';
import { useRouter } from '@/router.js';

type NavItem = HatasabaNavItem & Record<string, unknown>;
const copy = i18n.ts._hata._hataskeyUi3._bottomNav;
const labels = i18n.ts._hata._hatasabaUi._editWindow;
const sharedDefaults = getInitialPrefValue('simpleUi.bottomNav');
const defaults = getUiSBottomNavDefaults(sharedDefaults);
const defaultById = new Map(defaults.map(item => [item.id, item]));
const searchId = canonicalSearchIdForPreferenceKey('simpleUi.bottomNav');
const router = useRouter();
const heading = ref<HTMLElement | null>(null);
const limitMessage = ref(false);

function currentItems(): NavItem[] {
	return resolveUiSBottomNav(prefer.r.hataskeyUi3BottomNav.value, prefer.r['simpleUi.bottomNav'].value, sharedDefaults);
}

function commit(items: NavItem[]): void {
	prefer.commit('hataskeyUi3BottomNav', normalizeBottomNavItems(items).map(item => ({
		...item,
		icon: item.icon ?? defaultById.get(item.id)?.icon ?? '',
		label: item.label ?? defaultById.get(item.id)?.label ?? item.id,
		visible: item.id === 'home' || (item.visible ?? defaultById.get(item.id)?.visible ?? true),
	})));
	limitMessage.value = false;
}

const items = computed({ get: currentItems, set: commit });

function isVisibleInUiS(item: HatasabaNavItem): boolean { return item.id === 'home' || item.visible !== false; }

const visibleCount = computed(() => currentItems().filter(isVisibleInUiS).length);
const labelById: Record<string, string> = {
	search: labels.navSearch, home: labels.navHome, notifications: labels.navNotifications,
	hatagoes: 'HataGoes', hatafeed: labels.navHataFeed, widgets: labels.navWidgets,
};

function displayLabel(item: HatasabaNavItem): string { return labelById[item.id] ?? item.label ?? item.id; }

function setVisible(id: string, input: HTMLInputElement): void {
	if (id === 'home') { input.checked = true; return; }
	const visible = input.checked;
	const current = currentItems();
	if (visible && visibleCount.value >= UI_S_BOTTOM_NAV_MAX) {
		input.checked = false;
		limitMessage.value = true;
		return;
	}
	commit(current.map(item => item.id === id ? { ...item, visible } : item));
}

function resetOrder(): void {
	const order = new Map(defaults.map((item, index) => [item.id, index]));
	const current = currentItems();
	commit(current.map((item, index) => ({ item, index })).sort((a, b) => (order.get(a.item.id) ?? defaults.length + a.index) - (order.get(b.item.id) ?? defaults.length + b.index)).map(entry => entry.item));
}

async function moveByKeyboard(event: KeyboardEvent, index: number): Promise<void> {
	const offset = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
	if (!offset) return;
	event.preventDefault();
	const current = currentItems();
	const target = index + offset;
	if (target < 0 || target >= current.length) return;
	const [moved] = current.splice(index, 1);
	current.splice(target, 0, moved!);
	commit(current);
	await nextTick();
	const handle = heading.value?.closest('section')?.querySelectorAll<HTMLButtonElement>('.bottomNavHandle')[target];
	handle?.focus({ preventScroll: true });
}

function focusHashHeading(): void {
	if (router.getCurrentFullPath().split('#')[1] !== 'hataskey-ui-s-bottom-nav-heading') return;
	void nextTick(() => window.requestAnimationFrame(() => {
		if (!heading.value?.isConnected) return;
		heading.value.scrollIntoView({ behavior: 'auto', block: 'center' });
		heading.value.focus({ preventScroll: true });
	}));
}

onMounted(focusHashHeading);
onActivated(focusHashHeading);
watch(router.currentRef, focusHashHeading);

const shownInUiS = computed(() => normalizeUiSBottomNav(currentItems()));
</script>

<style scoped>
.bottomNavSettings { margin: 16px 0; padding: clamp(14px, 4%, 20px); border: 1px solid var(--MI_THEME-divider); border-radius: 18px; background: var(--MI_THEME-panel); }
.heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: 16px; }
.heading h3 { margin: 4px 0 0; font-size: 1.1rem; }
.heading p, .help, .saveHint { margin: 6px 0; color: var(--MI_THEME-fgTransparentWeak); font-size: .85rem; }
.eyebrow { font-size: .72rem; font-weight: 700; opacity: .7; }
.heading button, .bottomNavHandle { border: 0; color: inherit; background: transparent; cursor: pointer; }
.heading button { white-space: nowrap; }
.items { display: grid; gap: 6px; margin-top: 12px; }
.item { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 7px 10px; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; }
.item.hidden { opacity: .65; }
.bottomNavHandle { padding: 8px; touch-action: none; }
.bottomNavHandle:focus-visible, .heading button:focus-visible, .visibility input:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.visibility { display: flex; align-items: center; }
.visibility input { appearance: none; position: relative; width: 38px; height: 22px; border: 1px solid var(--MI_THEME-divider); border-radius: 99px; background: var(--MI_THEME-fgTransparentWeak); cursor: pointer; transition: background .15s ease; }
.visibility input::before { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--MI_THEME-panel); transition: transform .15s ease; }
.visibility input:checked { background: var(--MI_THEME-accent); }
.visibility input:checked::before { transform: translateX(16px); }
.visibility input:disabled { cursor: default; }
.warning { color: var(--MI_THEME-warn); font-size: .85rem; }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .visibility input, .visibility input::before { transition: none; } }
</style>
