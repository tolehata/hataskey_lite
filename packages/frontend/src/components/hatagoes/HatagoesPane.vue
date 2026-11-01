<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="root" :class="$style.pane" @scroll.capture.passive="rememberScroll">
	<KeepAlive>
		<Suspense :timeout="0">
			<component
				:is="pageComponent" v-if="active || ownsApp" :key="pageKey" v-bind="pageProps"
				:embedded="true" :requestedTab="requestedTab" :requestedScope="requestedScope" :paneActive="active"
				@tabChange="changeTab" @scopeChange="changeScope" @appearanceChange="emit('appearance', $event)" @exit="emit('exit')"
			/>
			<template #fallback><HataAppLoading :app="app" :monochrome="monochrome" :active="active"/></template>
		</Suspense>
	</KeepAlive>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import HataAppLoading from '@/components/HataAppLoading.vue';
import type { HatagoesApp, HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';
import type { HataGoesAppearance, HataGoesBridge, HataGoesTheme } from '@/utility/hatagoes-context.js';
import { HATA_GOES_HOST, HATA_GOES_THEME } from '@/utility/hatagoes-context.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { hatagoesAppForPath, hatagoesPageKey, hatagoesPaneKey, hatagoesTab, withHatagoesTab } from '@/utility/hatagoes-navigation.js';
import { createRouter } from '@/router.js';
import { page } from '@/router.definition.js';
import { DI } from '@/di.js';
import { $i } from '@/i.js';
import { readHatagoesDeviceCache, writeHatagoesDeviceCache } from '@/utility/hatasaba-device-prefs.js';
import { captureHatagoesPageTurn } from '@/utility/hatagoes-page-motion.js';

const props = defineProps<{ app: HatagoesApp; path: string; active: boolean; monochrome?: boolean; appearance?: HataGoesAppearance; launcherApps?: readonly HatagoesCatalogEntry[]; wide?: boolean; hatadyHeaderDate?: HTMLElement | null; hatadyHeaderActions?: HTMLElement | null; hatadyHeaderOverview?: HTMLElement | null }>();
const emit = defineEmits<{
	navigate: [path: string, replace?: boolean];
	register: [app: HatagoesApp, bridge: HataGoesBridge];
	unregister: [app: HatagoesApp, bridge: HataGoesBridge];
	appearance: [appearance: HataGoesAppearance];
	mode: [mode: string];
	changed: [];
	exit: [];
	leave: [path: string];
	openLauncherScreen: [id: string];
	openAllApps: [];
}>();
const router = createRouter(props.path);
const root = ref<HTMLElement>();
const hataskMode = ref('light');
const theme = computed<HataGoesTheme>(() => props.app === 'hatask' ? {
	hataskTheme: props.appearance?.theme,
	hataskMode: hataskMode.value,
	style: props.appearance?.cssVars,
} : {
	className: 'hatady-scope',
	hatadyTheme: props.app === 'hatady' ? hatadyTheme.value : props.appearance?.theme,
});
provide(HATA_GOES_THEME, theme);
let themeObserver: MutationObserver | undefined;
let surfaceMotion: ReturnType<typeof captureHatagoesPageTurn> | undefined;
provide(DI.router, router);
provide(DI.routerCurrentDepth, 1);
provide(DI.pageMetadata, ref(null));
provide(DI.currentStickyTop, ref(0));
provide(DI.currentStickyBottom, ref(0));
provide(DI.pageWindowClose, () => emit('exit'));
provide(HATA_GOES_HOST, {
	active: computed(() => props.active),
	hatadyHeader: {
		date: computed(() => props.app === 'hatady' ? props.hatadyHeaderDate ?? null : null),
		actions: computed(() => props.app === 'hatady' ? props.hatadyHeaderActions ?? null : null),
		overview: computed(() => props.app === 'hatady' ? props.hatadyHeaderOverview ?? props.hatadyHeaderActions ?? null : null),
	},
	register(app, bridge) {
		emit('register', app, bridge);
		return () => emit('unregister', app, bridge);
	},
	changed: () => emit('changed'),
	openStandalone: path => emit('leave', path),
	launcherApps: computed(() => props.launcherApps ?? []),
	wide: computed(() => props.wide === true),
	openLauncherScreen: id => emit('openLauncherScreen', id),
	openAllApps: () => emit('openAllApps'),
});

const resolved = shallowRef(router.current);
// These legacy routes wrap the same SFC in separate async components. Keep one
// component identity as well as one key when an issue number resolves to an ID.
const feedPage = page(() => import('@/pages/hatafeed.vue'));
const pageComponent = computed(() => hatagoesPageKey(resolved.value._parsedRoute.fullPath) === '/hatafeed' ? feedPage : 'component' in resolved.value.route ? resolved.value.route.component : undefined);
const pageProps = computed(() => Object.fromEntries(resolved.value.props));
const pageKey = computed(() => hatagoesPageKey(resolved.value._parsedRoute.fullPath));
const ownsApp = computed(() => pageKey.value === '/hatask' || pageKey.value === '/hatady' || pageKey.value === '/hatafeed');
const requestedTab = computed(() => hatagoesTab(resolved.value._parsedRoute.fullPath));
const requestedScope = computed(() => new URL(resolved.value._parsedRoute.fullPath, 'https://hatagoes.invalid').searchParams.get('hgScope') ?? undefined);
let syncing = false;
const localReplace = router.replaceByPath.bind(router);
router.replaceByPath = path => {
	if (!syncing && (hatagoesAppForPath(path) !== props.app || hatagoesPaneKey(path) !== hatagoesPaneKey(props.path))) {
		emit('navigate', path, true);
		return;
	}
	localReplace(path);
};
router.navHook = path => {
	if (hatagoesAppForPath(path) !== props.app || hatagoesPaneKey(path) !== hatagoesPaneKey(props.path)) { emit('navigate', path); return true; }
	return false;
};
router.useListener('change', ({ resolved: next }) => {
	const previousUrl = new URL(resolved.value._parsedRoute.fullPath, 'https://hatagoes.invalid');
	const nextUrl = new URL(next._parsedRoute.fullPath, 'https://hatagoes.invalid');
	previousUrl.searchParams.delete('hgScope');
	nextUrl.searchParams.delete('hgScope');
	// Hatady animates its record scope locally, including changes from a deep link.
	const localScopeMotion = props.app === 'hatady' && previousUrl.href === nextUrl.href;
	resolved.value = next;
	surfaceMotion?.cancel();
	// Hatady owns its embedded tab and record-scope motion. The pane must not
	// animate the same live content a second time.
	if (!props.active || props.app === 'hatady' || localScopeMotion) return;
	const motion = captureHatagoesPageTurn(root.value);
	surfaceMotion = motion;
	void nextTick(() => { if (props.active) motion.play(); });
});
router.useListener('push', ({ fullPath }) => { if (!syncing) emit('navigate', fullPath); });
router.useListener('replace', ({ fullPath }) => { if (!syncing) emit('navigate', fullPath, true); });
watch(() => props.path, path => {
	if (router.getCurrentFullPath() === path) return;
	syncing = true;
	try { router.replaceByPath(path); } finally { syncing = false; }
});

function changeTab(tab: string) {
	if (!props.active) return;
	const path = withHatagoesTab(router.getCurrentFullPath(), tab);
	if (path !== router.getCurrentFullPath()) router.pushByPath(path);
}

function changeScope(scope: string) {
	if (!props.active || props.app !== 'hatady' || !['mine', 'recent', 'following', 'all'].includes(scope)) return;
	const url = new URL(router.getCurrentFullPath(), 'https://hatagoes.invalid');
	url.searchParams.set('hgScope', scope);
	const path = `${url.pathname}${url.search}${url.hash}`;
	if (path !== router.getCurrentFullPath()) router.replaceByPath(path);
}

// Scroll state is device-local, scoped to the signed-in account and application.
const scrollKey = `hatagoes:scroll:${$i?.id ?? 'anonymous'}:${props.app}` as const;
let scrollTimer: number | undefined;
let scrollSnapshot: { path: string; top: number; trail: number[] } | undefined;
let restoreObserver: MutationObserver | undefined;
let restoreTimeout: number | undefined;
let restoring = false;

function persistScroll() {
	if (!scrollSnapshot) return;
	writeHatagoesDeviceCache(scrollKey, scrollSnapshot);
}

function rememberScroll(event: Event) {
	if (!props.active || restoring || !(event.target instanceof HTMLElement) || !root.value) return;
	const trail: number[] = [];
	let element: HTMLElement | null = event.target;
	while (element && element !== root.value) {
		const parent: HTMLElement | null = element.parentElement;
		if (!parent) return;
		trail.unshift(Array.from(parent.children).indexOf(element));
		element = parent;
	}
	if (element !== root.value) return;
	scrollSnapshot = { path: router.getCurrentFullPath(), top: event.target.scrollTop, trail };
	window.clearTimeout(scrollTimer);
	scrollTimer = window.setTimeout(persistScroll, 200);
}

function stopRestore() { restoring = false; restoreObserver?.disconnect(); window.clearTimeout(restoreTimeout); }

onMounted(async () => {
	await nextTick();
	let reportedMode: string | undefined;
	const readThemeMode = () => {
		const mode = root.value?.querySelector<HTMLElement>('.htk-root[data-mode]')?.dataset.mode;
		if (mode !== 'light' && mode !== 'dark') return;
		// Publish the first actual mode even when it matches the local light default.
		if (reportedMode !== mode) { hataskMode.value = mode; reportedMode = mode; emit('mode', mode); }
	};
	if (props.app === 'hatask' && root.value) {
		readThemeMode();
		themeObserver = new MutationObserver(readThemeMode);
		themeObserver.observe(root.value, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mode'] });
	}
	try {
		const saved = JSON.parse(readHatagoesDeviceCache(scrollKey) ?? 'null');
		if (saved?.path !== router.getCurrentFullPath() || !Number.isFinite(saved.top) || saved.top < 0 || !Array.isArray(saved.trail)) return;
		restoring = true;
		const restore = () => {
			if (saved.path !== router.getCurrentFullPath()) { stopRestore(); return; }
			let element: Element | undefined = root.value;
			for (const index of saved.trail) element = Number.isInteger(index) && index >= 0 ? element?.children[index] : undefined;
			if (!(element instanceof HTMLElement) || element.scrollHeight - element.clientHeight < saved.top) return;
			element.scrollTop = saved.top;
			stopRestore();
		};
		if (root.value) {
			restoreObserver = new MutationObserver(restore);
			restoreObserver.observe(root.value, { childList: true, subtree: true });
			root.value.addEventListener('wheel', stopRestore, { passive: true });
			root.value.addEventListener('pointerdown', stopRestore, { passive: true });
		}
		restoreTimeout = window.setTimeout(stopRestore, 12000);
		restore();
	} catch { /* Ignore an invalid or unavailable device cache. */ }
});
onBeforeUnmount(() => { themeObserver?.disconnect(); surfaceMotion?.cancel(); window.clearTimeout(scrollTimer); persistScroll(); stopRestore(); });
</script>

<style module>
.pane { min-width: 0; min-height: 0; height: 100%; overflow: auto; container-type: size; }
</style>
