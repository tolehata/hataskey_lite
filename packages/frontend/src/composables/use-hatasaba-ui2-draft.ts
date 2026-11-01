/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * One buffered editing session for both the floating Hataskey UI editor and
 * the permanent settings surface.  Nothing in this composable writes a
 * preference until save() is called; preview-only changes stay on <html>.
 */

import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { prefer } from '@/preferences.js';
import { PREF_DEF } from '@/preferences/def.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import {
	glassUiLocal, setGlassUiLocal,
	glassUiBubbleLocal, setGlassUiBubbleLocal,
	deckIgnoreWidth, setDeckIgnoreWidth,
	tabSwipeEnabled, setTabSwipeEnabled,
} from '@/utility/hatasaba-device-prefs.js';
import { miLocalStorage } from '@/local-storage.js';
import { HATASABA_BOTTOM_NAV_MAX, mergeMissingNavItems, normalizeBottomNavItems } from '@/utility/hatasaba-navigation.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

type NavItem = { id: string; icon?: string; label?: string; visible?: boolean };
type PersistedNavItem = { id: string; icon: string; label: string; visible: boolean };

function normalizeNavItems(items: NavItem[], defaults: NavItem[]): PersistedNavItem[] {
	const defaultsById = new Map(defaults.map(item => [item.id, item]));
	return items.map(item => {
		const fallback = defaultsById.get(item.id);
		return {
			id: item.id,
			icon: item.icon ?? fallback?.icon ?? '',
			label: item.label ?? fallback?.label ?? item.id,
			visible: item.visible ?? fallback?.visible ?? true,
		};
	});
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function useHatasabaUi2Draft() {
	const copy = i18n.ts._hata._hatasabaUi._editWindow;
	const copyx = i18n.tsx._hata._hatasabaUi._editWindow;
	const topNavDefaults = clone(getInitialPrefValue('simpleUi.topNav')) as NavItem[];
	const bottomNavDefaults = clone(getInitialPrefValue('simpleUi.bottomNav')) as NavItem[];
	const snapshot = {
		glassUi: glassUiLocal.value,
		glassUiBubble: glassUiBubbleLocal.value,
		normalNoBannerBg: prefer.r['simpleUi.normalNoBannerBg'].value,
		profileNoBannerBg: prefer.r['simpleUi.profileNoBannerBg'].value,
		opacity: prefer.r['simpleUi.glassUiCardOpacity'].value as number,
		disableBubbleInHatasabaDeck: prefer.r['simpleUi.disableBubbleInHatasabaDeck'].value,
		showTrendingTab: prefer.r['simpleUi.showTrendingTab'].value,
		showHatadyTab: prefer.r['simpleUi.showHatadyTab'].value,
		topNavMode: prefer.r['simpleUi.topNavMode'].value,
		deckIgnoreWidth: deckIgnoreWidth.value,
		tabSwipeEnabled: tabSwipeEnabled.value,
		topNav: clone(prefer.s['simpleUi.topNav'] ?? []) as NavItem[],
		bottomNav: mergeMissingNavItems<NavItem>(
			// Both lists intentionally use the persisted, optional-field shape. The
			// defaults are typed more narrowly by the preference registry, but the
			// merge must preserve the draft's stable NavItem contract.
			normalizeBottomNavItems(clone(prefer.s['simpleUi.bottomNav'] ?? []) as NavItem[]),
			normalizeBottomNavItems(bottomNavDefaults),
		),
	};

	const draft = reactive({
		editedGlassUi: snapshot.glassUi,
		editedGlassUiBubble: snapshot.glassUiBubble,
		editedNormalNoBannerBg: snapshot.normalNoBannerBg,
		editedProfileNoBannerBg: snapshot.profileNoBannerBg,
		editedOpacity: snapshot.opacity,
		editedDisableBubbleInHatasabaDeck: snapshot.disableBubbleInHatasabaDeck,
		editedShowTrendingTab: snapshot.showTrendingTab,
		editedShowHatadyTab: snapshot.showHatadyTab,
		editedTopNavMode: snapshot.topNavMode,
		editedDeckIgnoreWidth: snapshot.deckIgnoreWidth,
		editedTabSwipeEnabled: snapshot.tabSwipeEnabled,
		editedTopNav: clone(snapshot.topNav),
		editedBottomNav: clone(snapshot.bottomNav),
	});

	const hasNavChanges = computed(() => JSON.stringify(draft.editedTopNav) !== JSON.stringify(snapshot.topNav)
		|| JSON.stringify(draft.editedBottomNav) !== JSON.stringify(snapshot.bottomNav));
	const hasChanges = computed(() => (
		draft.editedGlassUi !== snapshot.glassUi
		|| draft.editedGlassUiBubble !== snapshot.glassUiBubble
		|| draft.editedNormalNoBannerBg !== snapshot.normalNoBannerBg
		|| draft.editedProfileNoBannerBg !== snapshot.profileNoBannerBg
		|| draft.editedOpacity !== snapshot.opacity
		|| draft.editedDisableBubbleInHatasabaDeck !== snapshot.disableBubbleInHatasabaDeck
		|| draft.editedShowTrendingTab !== snapshot.showTrendingTab
		|| draft.editedShowHatadyTab !== snapshot.showHatadyTab
		|| draft.editedTopNavMode !== snapshot.topNavMode
		|| draft.editedDeckIgnoreWidth !== snapshot.deckIgnoreWidth
		|| draft.editedTabSwipeEnabled !== snapshot.tabSwipeEnabled
		|| hasNavChanges.value
	));
	const changeCount = computed(() => {
		let count = 0;
		if (draft.editedGlassUi !== snapshot.glassUi) count++;
		if (draft.editedGlassUiBubble !== snapshot.glassUiBubble) count++;
		if (draft.editedNormalNoBannerBg !== snapshot.normalNoBannerBg) count++;
		if (draft.editedProfileNoBannerBg !== snapshot.profileNoBannerBg) count++;
		if (draft.editedOpacity !== snapshot.opacity) count++;
		if (draft.editedDisableBubbleInHatasabaDeck !== snapshot.disableBubbleInHatasabaDeck) count++;
		if (draft.editedShowTrendingTab !== snapshot.showTrendingTab) count++;
		if (draft.editedShowHatadyTab !== snapshot.showHatadyTab) count++;
		if (draft.editedTopNavMode !== snapshot.topNavMode) count++;
		if (draft.editedDeckIgnoreWidth !== snapshot.deckIgnoreWidth) count++;
		if (draft.editedTabSwipeEnabled !== snapshot.tabSwipeEnabled) count++;
		if (JSON.stringify(draft.editedTopNav) !== JSON.stringify(snapshot.topNav)) count++;
		if (JSON.stringify(draft.editedBottomNav) !== JSON.stringify(snapshot.bottomNav)) count++;
		return count;
	});

	function setOpacity(value: number): void {
		if (!Number.isFinite(value)) return;
		draft.editedOpacity = Math.max(0, Math.min(100, Math.round(value)));
		window.document.documentElement.style.setProperty('--htk-glass-card-opacity', `${draft.editedOpacity}%`);
	}

	function onOpacityInput(event: Event): void {
		setOpacity(Number((event.target as HTMLInputElement).value));
	}

	function setGlassUi(value: boolean): void {
		draft.editedGlassUi = !!value;
		window.document.documentElement.classList.toggle('hataGlassUi', !!value);
	}

	function setGlassUiBubble(value: boolean): void {
		draft.editedGlassUiBubble = !!value;
		window.document.documentElement.classList.toggle('hataGlassUiBubble', !!value);
	}

	function setProfileNoBannerBg(value: boolean): void {
		draft.editedProfileNoBannerBg = !!value;
		window.document.documentElement.classList.toggle('hataProfileNoBannerBg', !!value);
	}

	function restoreLivePreviewToSnapshot(): void {
		window.document.documentElement.classList.toggle('hataGlassUi', snapshot.glassUi);
		window.document.documentElement.classList.toggle('hataGlassUiBubble', snapshot.glassUiBubble);
		window.document.documentElement.classList.toggle('hataProfileNoBannerBg', snapshot.profileNoBannerBg);
		window.document.documentElement.style.setProperty('--htk-glass-card-opacity', `${snapshot.opacity}%`);
	}

	function resetDraftToSnapshot(): void {
		draft.editedGlassUi = snapshot.glassUi;
		draft.editedGlassUiBubble = snapshot.glassUiBubble;
		draft.editedNormalNoBannerBg = snapshot.normalNoBannerBg;
		draft.editedProfileNoBannerBg = snapshot.profileNoBannerBg;
		draft.editedOpacity = snapshot.opacity;
		draft.editedDisableBubbleInHatasabaDeck = snapshot.disableBubbleInHatasabaDeck;
		draft.editedShowTrendingTab = snapshot.showTrendingTab;
		draft.editedShowHatadyTab = snapshot.showHatadyTab;
		draft.editedTopNavMode = snapshot.topNavMode;
		draft.editedDeckIgnoreWidth = snapshot.deckIgnoreWidth;
		draft.editedTabSwipeEnabled = snapshot.tabSwipeEnabled;
		draft.editedTopNav = clone(snapshot.topNav);
		draft.editedBottomNav = clone(snapshot.bottomNav);
	}

	async function resetToDefault(): Promise<void> {
		const confirmation = await os.confirm({ type: 'warning', title: copy.resetDefaults, text: copy.resetAllConfirm });
		if (confirmation.canceled) return;
		draft.editedGlassUi = true;
		draft.editedGlassUiBubble = false;
		draft.editedNormalNoBannerBg = PREF_DEF['simpleUi.normalNoBannerBg'].default as boolean;
		draft.editedProfileNoBannerBg = PREF_DEF['simpleUi.profileNoBannerBg'].default as boolean;
		draft.editedOpacity = PREF_DEF['simpleUi.glassUiCardOpacity'].default as number;
		draft.editedDisableBubbleInHatasabaDeck = PREF_DEF['simpleUi.disableBubbleInHatasabaDeck'].default as boolean;
		draft.editedShowTrendingTab = PREF_DEF['simpleUi.showTrendingTab'].default as boolean;
		draft.editedShowHatadyTab = PREF_DEF['simpleUi.showHatadyTab'].default as boolean;
		draft.editedTopNavMode = PREF_DEF['simpleUi.topNavMode'].default as boolean;
		draft.editedDeckIgnoreWidth = false;
		draft.editedTabSwipeEnabled = true;
		setOpacity(draft.editedOpacity);
		setGlassUi(draft.editedGlassUi);
		setGlassUiBubble(draft.editedGlassUiBubble);
		setProfileNoBannerBg(draft.editedProfileNoBannerBg);
	}

	async function resetTopNav(): Promise<void> {
		const confirmation = await os.confirm({ type: 'warning', title: copy.resetDefaults, text: copy.resetTopNavConfirm });
		if (!confirmation.canceled) draft.editedTopNav = clone(getInitialPrefValue('simpleUi.topNav')) as NavItem[];
	}

	async function resetBottomNav(): Promise<void> {
		const confirmation = await os.confirm({ type: 'warning', title: copy.resetDefaults, text: copy.resetBottomNavConfirm });
		if (!confirmation.canceled) draft.editedBottomNav = normalizeBottomNavItems(clone(getInitialPrefValue('simpleUi.bottomNav')) as NavItem[]);
	}

	function setTopNavVisible(index: number, visible: boolean): void {
		draft.editedTopNav = draft.editedTopNav.map((item, current) => current === index ? { ...item, visible } : item);
	}

	function setBottomNavVisible(index: number, visible: boolean): void {
		draft.editedBottomNav = draft.editedBottomNav.map((item, current) => current === index ? { ...item, visible } : item);
	}

	function moveNavItem(items: NavItem[], index: number, direction: -1 | 1): NavItem[] | null {
		const targetIndex = index + direction;
		if (!Number.isInteger(index) || index < 0 || targetIndex < 0 || index >= items.length || targetIndex >= items.length) return null;
		const next = [...items];
		const current = next[index];
		next[index] = next[targetIndex]!;
		next[targetIndex] = current!;
		return next;
	}

	function moveTopNav(index: number, direction: -1 | 1): boolean {
		const next = moveNavItem(draft.editedTopNav, index, direction);
		if (next == null) return false;
		draft.editedTopNav = next;
		return true;
	}

	function moveBottomNav(index: number, direction: -1 | 1): boolean {
		const next = moveNavItem(draft.editedBottomNav, index, direction);
		if (next == null) return false;
		draft.editedBottomNav = next;
		return true;
	}

	const windowWidth = ref(typeof window === 'undefined' ? 1100 : window.innerWidth);

	function onResize(): void { windowWidth.value = window.innerWidth; }

	onMounted(() => window.addEventListener('resize', onResize, { passive: true }));
	onBeforeUnmount(() => window.removeEventListener('resize', onResize));
	const isHatasabaUi = computed(() => miLocalStorage.getItem('ui') === 'simple');
	const isDeckModeOn = computed(() => prefer.r['simpleUi.deckMode']?.value === true);
	const isDesktop = computed(() => (draft.editedDeckIgnoreWidth && isDeckModeOn.value) || windowWidth.value >= 1100);
	const isBottomNavVisible = computed(() => isHatasabaUi.value && !isDesktop.value);
	const isHatasabaDeckActive = computed(() => isHatasabaUi.value && isDeckModeOn.value && isDesktop.value);
	const navLabelById: Record<string, string> = {
		following: copy.navHome, local: copy.navLocal, social: copy.navSocial, mixed: copy.navGlobal,
		search: copy.navSearch, home: copy.navHome, notifications: copy.navNotifications,
		hatagoes: 'HataGoes', hatafeed: copy.navHataFeed, widgets: copy.navWidgets,
	};

	function navDisplayLabel(item: NavItem): string { return navLabelById[item.id] ?? item.label ?? item.id; }

	function openSidebarEditDialog(): void {
		const { dispose } = os.popup(
			defineAsyncComponent(() => import('@/components/MkSidebarEditDialog.vue')),
			{},
			{ done: () => {}, closed: () => dispose() },
		);
	}

	function onReplayDeckTutorial(): void {
		if (!isHatasabaDeckActive.value) return;
		const { dispose } = os.popup(
			defineAsyncComponent(() => import('@/ui/_common_/HatasabaDeckTutorial.vue')),
			{},
			{ closed: () => dispose() },
		);
	}

	function save(): boolean {
		if (!hasChanges.value) return false;
		try {
			if (draft.editedGlassUi !== snapshot.glassUi) setGlassUiLocal(draft.editedGlassUi);
			if (draft.editedGlassUiBubble !== snapshot.glassUiBubble) setGlassUiBubbleLocal(draft.editedGlassUiBubble);
			if (draft.editedNormalNoBannerBg !== snapshot.normalNoBannerBg) prefer.commit('simpleUi.normalNoBannerBg', draft.editedNormalNoBannerBg);
			if (draft.editedProfileNoBannerBg !== snapshot.profileNoBannerBg) prefer.commit('simpleUi.profileNoBannerBg', draft.editedProfileNoBannerBg);
			if (draft.editedOpacity !== snapshot.opacity) prefer.commit('simpleUi.glassUiCardOpacity', Math.max(0, Math.min(100, Math.round(draft.editedOpacity))));
			if (draft.editedDisableBubbleInHatasabaDeck !== snapshot.disableBubbleInHatasabaDeck) prefer.commit('simpleUi.disableBubbleInHatasabaDeck', draft.editedDisableBubbleInHatasabaDeck);
			if (draft.editedShowTrendingTab !== snapshot.showTrendingTab) prefer.commit('simpleUi.showTrendingTab', draft.editedShowTrendingTab);
			if (draft.editedShowHatadyTab !== snapshot.showHatadyTab) prefer.commit('simpleUi.showHatadyTab', draft.editedShowHatadyTab);
			if (draft.editedTopNavMode !== snapshot.topNavMode) prefer.commit('simpleUi.topNavMode', draft.editedTopNavMode);
			if (draft.editedDeckIgnoreWidth !== snapshot.deckIgnoreWidth) setDeckIgnoreWidth(draft.editedDeckIgnoreWidth);
			if (draft.editedTabSwipeEnabled !== snapshot.tabSwipeEnabled) setTabSwipeEnabled(draft.editedTabSwipeEnabled);
			if (hasNavChanges.value) {
				prefer.commit('simpleUi.topNav', normalizeNavItems(draft.editedTopNav, topNavDefaults));
				prefer.commit('simpleUi.bottomNav', normalizeNavItems(normalizeBottomNavItems(draft.editedBottomNav), normalizeBottomNavItems(bottomNavDefaults)));
			}
			os.toast(copy.savedReloading);
		window.setTimeout(() => window.location.reload(), 300);
			return true;
		} catch (error) {
			os.alert({ type: 'error', title: copy.saveFailedTitle, text: error instanceof Error ? copyx.tryAgainWithDetails({ details: error.message }) : copy.tryAgain });
			return false;
		}
	}

	async function discard(): Promise<boolean> {
		if (hasChanges.value) {
			const confirmation = await os.confirm({ type: 'warning', title: copy.discardChangesTitle, text: copy.discardChangesText });
			if (confirmation.canceled) return false;
		}
		resetDraftToSnapshot();
		restoreLivePreviewToSnapshot();
		return true;
	}

	return reactive({
		copy, copyx, draft, hasChanges, hasNavChanges, changeCount, HATASABA_BOTTOM_NAV_MAX,
		isBottomNavVisible, isHatasabaDeckActive,
		onOpacityInput, setOpacity, setGlassUi, setGlassUiBubble, setProfileNoBannerBg,
		resetToDefault, resetTopNav, resetBottomNav, setTopNavVisible, setBottomNavVisible, moveTopNav, moveBottomNav,
		navDisplayLabel, openSidebarEditDialog, onReplayDeckTutorial,
		save, discard, resetDraftToSnapshot, restoreLivePreviewToSnapshot,
	});
}

export type HatasabaUi2Draft = ReturnType<typeof useHatasabaUi2Draft>;
