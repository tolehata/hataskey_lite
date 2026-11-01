<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: 左メニュー。HataSideStudio の有効プロファイル(拡大/縮小)をそのまま描画する。
-->
<template>
<nav :class="$style.root" :data-glass="prefer.r.hataskeyUi3SideMenuBackground.value ? 'true' : undefined" :data-seamless="seamless ? 'true' : undefined" :data-mode="collapsed ? 'collapsed' : 'expanded'" :data-reduce-motion="!prefer.r.animation.value ? 'true' : undefined" :aria-label="copy.menu">
	<button type="button" :class="$style.brand" :title="instanceName" aria-haspopup="menu" :aria-expanded="instanceMenuOpen" @click="openInstanceMenu">
		<img :src="instance.iconUrl || '/favicon.ico'" alt="" :class="$style.brandIcon"/>
	</button>

	<button v-if="collapsible" type="button" :class="$style.collapseButton" :title="collapseLabel" :aria-label="collapseLabel" :aria-expanded="!collapsed" @click="emit('toggleCollapse')">
		<ChevronRight v-if="collapsed" :size="20" aria-hidden="true"/><ChevronLeft v-else :size="20" aria-hidden="true"/>
	</button>

	<div :class="$style.scroll">
		<template v-if="!collapsed">
			<div v-for="block in blocks" :key="block.id" :class="$style.block" :data-group="block.group ? 'true' : undefined">
				<span v-if="block.name" :class="$style.blockName">{{ block.name }}</span>
				<div :class="$style.grid" :style="{ gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))` }">
					<template v-for="item in block.items" :key="item.id">
						<button
							v-if="item.type === 'button'"
							v-show="menuAvailable(item.menuId)"
							type="button"
							:class="$style.item"
							:data-size="item.size"
							:data-menu-id="item.menuId"
							:data-icon-only="item.showLabel && item.size !== 'small' ? undefined : 'true'"
							:data-brand="BRAND_MENUS.has(item.menuId) ? 'true' : undefined"
														:data-active="menuActive(item.menuId) ? 'true' : undefined"
							:style="{ gridColumn: item.size === 'large' ? '1 / -1' : 'auto', ...(item.menuId === 'cacheClear' ? { '--hk3-cache-label-size': getHataSideStudioCacheLabelSize(buttonLabel(item)) } : {}) }"
							:title="buttonLabel(item)"
							@click="onItemClick(item, $event)"
						>
							<HataAppNavIcon v-if="hataAppForMenuIcon(item.menuId, item.icon)" :app="hataAppForMenuIcon(item.menuId, item.icon)!" :size="item.size === 'small' ? 26 : 28" :monochrome="dark && item.menuId !== 'hatagoes'" :class="$style.itemIcon"/><i v-else :class="[iconOf(item), $style.itemIcon]"></i>
							<HataAppWordmark v-if="item.showLabel && item.size !== 'small' && hataAppForMenuLabel(item.menuId, buttonLabel(item), item.icon)" :app="hataAppForMenuLabel(item.menuId, buttonLabel(item), item.icon)!" :class="$style.itemLabel" :onDark="dark" :inheritColor="menuActive(item.menuId)"/><span v-else-if="item.showLabel && item.size !== 'small'" :class="$style.itemLabel">{{ buttonLabel(item) }}</span>
							<span v-if="badgeOf(item.menuId)" :class="$style.badge">{{ badgeOf(item.menuId) }}</span>
						</button>
						<div v-else :class="$style.widget" :data-size="item.size" :style="{ gridColumn: item.size === 'large' ? '1 / -1' : 'auto', minHeight: `${widgetMinHeight(item)}px` }">
							<HataSideStudioFlowers v-if="item.kind === 'hataskFlowers' || item.kind === 'flowers'" :size="item.size"/>
							<HataSideStudioEarthquake v-else-if="item.kind === 'earthquake'" :size="item.size"/>
							<component :is="`widget-${widgetName(item)}`" v-else-if="widgetName(item)" :key="`${item.id}:${item.size}`" :widget="{ id: item.id, name: widgetName(item), data: widgetData(item) }"/>
							<span v-else :class="$style.widgetFallback">{{ getHataSideWidgetDisplayLabel(item.kind, item.label) }}</span>
						</div>
					</template>
				</div>
			</div>
		</template>
		<div v-else :class="$style.rail">
			<button
				v-for="item in railButtons"
				v-show="menuAvailable(item.menuId)"
				:key="item.id"
				type="button"
				:class="$style.railItem"
				:data-menu-id="item.menuId"
				:data-active="menuActive(item.menuId) ? 'true' : undefined"
				:title="buttonLabel(item)"
				@click="onItemClick(item, $event)"
			>
				<HataAppNavIcon v-if="hataAppForMenuIcon(item.menuId, item.icon)" :app="hataAppForMenuIcon(item.menuId, item.icon)!" :size="28" :monochrome="dark && item.menuId !== 'hatagoes'" :class="$style.railIcon"/><i v-else :class="[iconOf(item), $style.railIcon]"></i>
				<span v-if="badgeOf(item.menuId)" :class="$style.railBadge">{{ badgeOf(item.menuId) }}</span>
			</button>
		</div>
	</div>

	<div :class="$style.foot">
		<button v-if="isDeck" type="button" :class="$style.post" :title="copy.note" @click="emit('post')">
			<component :is="postOpen ? X : profile.postButton.icon === 'paw' ? PawPrint : Pencil" :size="20"/>
		</button>
		<div :class="$style.trio" :data-stack="collapsed ? 'true' : undefined">
			<button v-if="isAdmin" type="button" :class="$style.footBtn" :data-active="adminActive ? 'true' : undefined" :title="copy.controlPanel" @click="go('/admin')"><Gauge :size="18"/></button>
			<button v-else type="button" :class="$style.footBtn" :data-active="studioActive ? 'true' : undefined" :title="copy.editSideMenu" @click="go('/hata-side-studio')"><PanelsTopLeft :size="18"/></button>
			<button type="button" :class="$style.footBtn" :title="dark ? copy.lightMode : copy.darkMode" @click="emit('toggleTheme')"><component :is="dark ? Sun : Moon" :size="18"/></button>
			<button type="button" :class="$style.footBtn" :data-active="settingsActive ? 'true' : undefined" :title="i18n.ts.settings" @click="go('/settings')"><Settings :size="18"/></button>
		</div>
		<div :class="$style.pair" :data-stack="collapsed ? 'true' : undefined">
			<button type="button" :class="$style.modeBtn" :data-on="!isDeck ? 'true' : undefined" :aria-pressed="!isDeck" :title="copy.standardView" @click="emit('mode', false)"><RectangleVertical :size="18"/></button>
			<button type="button" :class="$style.modeBtn" :data-on="isDeck ? 'true' : undefined" :aria-pressed="isDeck" :title="copy.deckView" :disabled="!deckAvailable" @click="emit('mode', true)"><Columns3 :size="18"/></button>
		</div>
		<button v-if="$i" type="button" :class="$style.account" :title="copy.account" @click="openAccountMenu">
			<MkAvatar :user="$i" :class="$style.accountAvatar"/>
			<span v-if="!collapsed" :class="$style.accountName">@{{ $i.username }}</span>
		</button>
	</div>
</nav>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue';
import { ChevronLeft, ChevronRight, Columns3, Gauge, Moon, PanelsTopLeft, PawPrint, Pencil, RectangleVertical, Settings, Sun, X } from '@lucide/vue';
import { instanceName as fallbackInstanceName } from '@@/js/config.js';
import type { HataSideButton, HataSideWidget } from '@/utility/hata-side-studio.js';
import HataSideStudioEarthquake from '@/components/HataSideStudioEarthquake.vue';
import HataSideStudioFlowers from '@/components/HataSideStudioFlowers.vue';
import MkLaunchPad from '@/components/MkLaunchPad.vue';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { instance } from '@/instance.js';
import { mainRouter } from '@/router.js';
import { pushAcceptedSidePage } from './use-hk3-side-page.js';
import { navbarItemDef } from '@/navbar.js';
import { miLocalStorage } from '@/local-storage.js';
import { getAccountMenu } from '@/accounts.js';
import { openInstanceMenu as openServerMenu } from '@/ui/_common_/common.js';
import { getExternalAccount } from '@/utility/external-api.js';
import { SIDEBAR_ICON_OVERRIDES } from '@/utility/sidebar-icon-overrides.js';
import { createButton, getActiveHataSideProfile, getHataSideStudioCacheLabelSize, getHataSideStudioGroupDisplayName, getHataSideStudioMenuDisplayLabel, hataSideStudioStore } from '@/utility/hata-side-studio.js';
import { getHataSideWidgetDisplayLabel, HATA_SIDE_WIDGET_REGISTRY } from '@/utility/hata-side-studio-widgets.js';
import HataAppNavIcon from '@/components/HataAppNavIcon.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { hataAppForMenuIcon, hataAppForMenuLabel } from '@/utility/hata-app-brand.js';

const props = withDefaults(defineProps<{
	collapsed?: boolean;
	collapsible?: boolean;
	seamless?: boolean;
	isDeck?: boolean;
	deckAvailable?: boolean;
	postOpen?: boolean;
	dark?: boolean;
}>(), {
	collapsed: false,
	collapsible: false,
	seamless: false,
	isDeck: false,
	deckAvailable: true,
	postOpen: false,
	dark: false,
});

const emit = defineEmits<{
	(ev: 'toggleCollapse'): void;
	(ev: 'post'): void;
	(ev: 'toggleTheme'): void;
	(ev: 'mode', deck: boolean): void;
	(ev: 'navigate', to?: string): void;
	(ev: 'launchPadOpen', open: boolean): void;
	(ev: 'instanceMenuOpen', open: boolean): void;
}>();

const collapseLabel = computed(() => props.collapsed ? i18n.ts._hata._hatasabaUi._simple.expandMenu : i18n.ts._hata._hatasabaUi._simple.collapseMenu);

const copy = i18n.ts._hata._hataskeyUi3;
const instanceName = computed(() => instance.name || fallbackInstanceName);
const profile = computed(() => getActiveHataSideProfile(hataSideStudioStore.value));
const isAdmin = computed(() => $i != null && ($i.isAdmin || $i.isModerator));
const path = computed(() => mainRouter.currentRoute.value.path);
const adminActive = computed(() => path.value.startsWith('/admin'));
const studioActive = computed(() => path.value.startsWith('/hata-side-studio'));
const settingsActive = computed(() => path.value.startsWith('/settings'));

type Block = { id: string; name: string; group: boolean; columns: number; items: Array<HataSideButton | HataSideWidget> };
const moreButton = createButton({ id: 'more', icon: 'ti ti-dots', label: i18n.ts.more, group: 'more' });
const railButtons = computed(() => profile.value.collapsed.buttons.some(item => item.menuId === 'more')
	? profile.value.collapsed.buttons
	: [...profile.value.collapsed.buttons, { ...moreButton, id: 'hk3-rail-more', size: 'small' as const, showLabel: false }]);

// 連続するルート直下の項目は1つのブロックにまとめ、グループは見出し付きの独立ブロックにする。
const blocks = computed<Block[]>(() => {
	const result: Block[] = [];
	let run: Block | null = null;
	const nodes = profile.value.expanded.nodes;
	for (const node of nodes) {
		if (node.type === 'group') {
			run = null;
			result.push({ id: node.id, name: node.showName ? getHataSideStudioGroupDisplayName(node.name) : '', group: true, columns: node.columns, items: [...node.children] });
			continue;
		}
		if (run == null) {
			run = { id: `run:${node.id}`, name: '', group: false, columns: profile.value.expanded.columns, items: [] };
			result.push(run);
		}
		run.items.push(node);
	}
	if (!nodes.some(node => node.type === 'button' ? node.menuId === 'more' : node.type === 'group' && node.children.some(child => child.type === 'button' && child.menuId === 'more'))) {
		// group.id は生成IDなので、保存名を優先し、改名後はその他系メニューで識別する。
		const other = nodes.find(node => node.type === 'group' && node.name === 'その他')
			?? nodes.find(node => node.type === 'group' && node.children.some(child => child.type === 'button' && (child.menuId === 'reload' || child.menuId === 'cacheClear')));
		const block = other && result.find(block => block.id === other.id);
		if (block) block.items.push(moreButton);
		else result.push({ id: 'hk3-more', name: getHataSideStudioGroupDisplayName('その他'), group: true, columns: 2, items: [moreButton] });
	}
	return result;
});

const MENU_PATHS: Record<string, string> = {
	timeline: '/',
	notifications: '/my/notifications',
	search: '/search',
	chat: '/chat',
	hatagoes: '/hatagoes',
	hatask: '/hatask',
	lists: '/my/lists',
	channels: '/channels',
	antennas: '/my/antennas',
	drive: '/my/drive',
	announcements: '/announcements',
	favorites: '/my/favorites',
	explore: '/explore',
	followRequests: '/my/follow-requests',
	hatafeed: '/hatafeed',
	hatady: '/hatady',
	earthquake: '/earthquake',
	externalNotifications: '/my/external-notifications',
};

function navbarFallback(menuId: string) {
	return (navbarItemDef as unknown as Record<string, { show?: boolean; to?: string; action?: (ev?: MouseEvent) => void } | undefined>)[menuId];
}

function menuAvailable(menuId: string): boolean {
	if (menuId === 'externalNotifications') return getExternalAccount() != null;
	return navbarFallback(menuId)?.show !== false;
}

function menuActive(menuId: string): boolean {
	const target = MENU_PATHS[menuId] ?? navbarFallback(menuId)?.to;
	if (typeof target !== 'string') return false;
	if (target === '/') return path.value === '/';
	return path.value.startsWith(target);
}

function iconOf(item: HataSideButton): string {
	return SIDEBAR_ICON_OVERRIDES[item.menuId] ?? item.icon;
}

// Hataskey 独自のツールは、名前をロゴと同じ Righteous で表示する。
const BRAND_MENUS = new Set(['hatagoes']);

function buttonLabel(item: HataSideButton): string {
	return getHataSideStudioMenuDisplayLabel(item.menuId, item.label);
}

function badgeOf(menuId: string): string | null {
	if ($i == null) return null;
	if (menuId === 'notifications' && $i.unreadNotificationsCount > 0) return $i.unreadNotificationsCount > 99 ? '99+' : String($i.unreadNotificationsCount);
	if (menuId === 'chat' && $i.hasUnreadChatMessages) return '•';
	if (menuId === 'announcements' && $i.hasUnreadAnnouncement) return '•';
	return null;
}

function widgetName(widget: HataSideWidget): string | null {
	if (widget.kind === 'flowers') return 'hataskFlowers';
	if (widget.kind === 'announcements') return null;
	return widget.kind;
}

function widgetData(widget: HataSideWidget): Record<string, unknown> {
	return { ...(widget.data ?? {}), ...(widget.sizeSettings[widget.size].data ?? {}) };
}

function widgetMinHeight(widget: HataSideWidget): number {
	return Math.max(widget.sizeSettings[widget.size].minHeight ?? 0, widget.kind === 'aichan' ? HATA_SIDE_WIDGET_REGISTRY.aichan.sizes[widget.size].minHeight : 0);
}

function go(to: string) {
	const actual = pushAcceptedSidePage(mainRouter, to);
	if (actual !== undefined) emit('navigate', actual);
}

const launchPadOpen = ref(false);
const instanceMenuOpen = ref(false);
let launchPadDispose: (() => void) | null = null;

function closeInstanceMenuState() {
	if (!instanceMenuOpen.value) return;
	instanceMenuOpen.value = false;
	emit('instanceMenuOpen', false);
}

function closeLaunchPad() {
	const dispose = launchPadDispose;
	launchPadDispose = null;
	if (launchPadOpen.value) {
		launchPadOpen.value = false;
		emit('launchPadOpen', false);
	}
	dispose?.();
}

function openLaunchPad(anchor: HTMLElement) {
	if (launchPadOpen.value) return;
	launchPadOpen.value = true;
	emit('launchPadOpen', true);
	try {
		launchPadDispose = os.popup(MkLaunchPad, { anchorElement: anchor }, { closed: closeLaunchPad }).dispose;
	} catch (error) {
		closeLaunchPad();
		throw error;
	}
}

onBeforeUnmount(() => {
	closeLaunchPad();
	closeInstanceMenuState();
});

function onItemClick(item: HataSideButton, ev: MouseEvent) {
	const anchor = ev.currentTarget as HTMLElement;
	if (item.targetId && item.menuId === 'lists') {
		miLocalStorage.setItem('hatasabaLastListId', item.targetId);
		go(`/timeline/list/${item.targetId}`);
		return;
	}
	if (item.targetId && item.menuId === 'antennas') {
		miLocalStorage.setItem('hatasabaLastAntennaId', item.targetId);
		go(`/timeline/antenna/${item.targetId}`);
		return;
	}
	switch (item.menuId) {
		case 'more': openLaunchPad(anchor); return;
		case 'reload': window.location.reload(); return;
		case 'cacheClear': void import('@/utility/clear-cache.js').then(({ clearCache }) => clearCache()); return;
		case 'uiSetup': {
			const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkUISetup.vue')), {}, { closed: () => dispose() });
			return;
		}
	}
	const target = MENU_PATHS[item.menuId];
	if (target != null) {
		go(target);
		return;
	}
	const fallback = navbarFallback(item.menuId);
	if (fallback == null || fallback.show === false) return;
	if (typeof fallback.to === 'string') {
		go(fallback.to);
		return;
	}
	emit('navigate');
	fallback.action?.(ev);
}

async function openInstanceMenu(ev: MouseEvent) {
	if (instanceMenuOpen.value) return;
	instanceMenuOpen.value = true;
	emit('instanceMenuOpen', true);
	try {
		await openServerMenu(ev);
	} finally {
		closeInstanceMenuState();
	}
}

function openAccountMenu(ev: MouseEvent) {
	void getAccountMenu({ withExtraOperation: true }).then(menu => os.popupMenu(menu, ev.currentTarget as HTMLElement));
}
</script>

<style lang="scss" module>
@use './side-nav-item' as sideNavItem;

.root {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 0;
	background: var(--hk3-bg);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
	color: var(--hk3-text);
	border-right: 0;
	overflow: hidden;
	box-sizing: border-box;

	&[data-glass] {
		background: var(--hk3-glass-pane, var(--hk3-bg));
		-webkit-backdrop-filter: blur(16px);
		backdrop-filter: blur(16px);
	}

	&[data-seamless] {
		background: transparent;
		border-right: 0;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	&[data-mode="collapsed"] {
		.brand, .railItem { border-bottom: 0; }
	}
}

.brand {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	height: 58px;
	flex: none;
	border: 0;
	border-bottom: 2px solid var(--hk3-divider);
	background: transparent;
	color: inherit;
	cursor: pointer;
	font: inherit;
	justify-content: center;
	padding: 0;
	&:hover { background: var(--hk3-accent-100); }
}

.brandIcon {
	width: 32px;
	height: 32px;
	flex: none;
	object-fit: cover;
	background: var(--hk3-accent);
}

.collapseButton {
	display: grid;
	place-items: center;
	align-self: center;
	flex: none;
	width: 44px;
	height: 44px;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: inherit;
	cursor: pointer;
	&:hover { background: var(--hk3-accent-100); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
}

.scroll {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-width: none;
}

.block {
	display: flex;
	flex-direction: column;

	&[data-group] { border-bottom: 2px solid var(--hk3-divider); }
}

.blockName {
	@include sideNavItem.heading;
	padding: calc(10px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1)) calc(4px * var(--hk3-ui-scale, 1));
	font-size: calc(11px * var(--hk3-ui-scale, 1));
}

.grid { display: grid; }

.item {
	@include sideNavItem.frame;
	--hk3-side-icon-size: calc(22px * var(--hk3-ui-scale, 1));
	gap: calc(6px * var(--hk3-ui-scale, 1));
	height: max(44px, calc(72px * var(--hk3-ui-scale, 1)));
	min-height: max(44px, calc(72px * var(--hk3-ui-scale, 1)));
	padding: 0 calc(4px * var(--hk3-ui-scale, 1));
	border-right: 0;
	cursor: pointer;
	font: inherit;
	&[data-size="small"] { --hk3-side-icon-size: calc(20px * var(--hk3-ui-scale, 1)); height: max(44px, calc(52px * var(--hk3-ui-scale, 1))); min-height: max(44px, calc(52px * var(--hk3-ui-scale, 1))); }
	&[data-size="large"] { height: max(44px, calc(84px * var(--hk3-ui-scale, 1))); min-height: max(44px, calc(84px * var(--hk3-ui-scale, 1))); }
}

.itemIcon {
	display: block;
	@include sideNavItem.icon;

	.item[data-active] & { color: var(--hk3-accent); }
}

.itemLabel {
	@include sideNavItem.label;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
}

.item[data-menu-id="cacheClear"] .itemLabel {
	@include sideNavItem.cache-clear-label;
	font-size: min(calc(12px * var(--hk3-ui-scale, 1)), calc(var(--hk3-cache-label-size, 10.5cqi) * var(--hk3-ui-scale, 1)));
	@container (min-width: 140px) { font-size: calc(12px * var(--hk3-ui-scale, 1)); }
}
.item[data-menu-id="earthquake"] .itemLabel {
	@include sideNavItem.earthquake-label;
	font-size: clamp(calc(9px * var(--hk3-ui-scale, 1)), calc(14cqi * var(--hk3-ui-scale, 1)), calc(12px * var(--hk3-ui-scale, 1)));
}

.badge, .railBadge {
	position: absolute;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	min-width: 18px;
	min-height: 18px;
	padding: 1px 5px;
	border: 1px solid color-mix(in srgb, var(--hk3-text) 12%, transparent);
	border-radius: 999px;
	background: color-mix(in srgb, color-mix(in srgb, var(--hk3-bg, var(--MI_THEME-panel)) 94%, var(--hk3-accent)) 88%, transparent);
	color: var(--hk3-text, var(--MI_THEME-fg));
	-webkit-backdrop-filter: blur(12px);
	backdrop-filter: blur(12px);
	box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%), 0 2px 5px rgb(0 0 0 / 10%);
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	line-height: 1;
	white-space: nowrap;
}

.badge { top: 6px; right: 6px; }

.item:is([data-menu-id="chat"], [data-menu-id="announcements"]) .badge,
.railItem:is([data-menu-id="chat"], [data-menu-id="announcements"]) .railBadge {
	min-width: 6px;
	min-height: 6px;
	padding: 0;
	border: 0;
	background: var(--hk3-accent);
	box-shadow: none;
	font-size: 0;
}

.item[data-brand] .itemLabel {
	font-family: 'Righteous', system-ui, sans-serif;
	font-weight: 400;
	letter-spacing: 0.02em;
}

.widget {
	position: relative;
	min-width: 0;
	border-right: 0;
	border-bottom: 1px solid var(--hk3-divider);
	overflow: hidden;

	:global(._panel), :global(.container), :global(section) { border-radius: 0 !important; }
}

.widgetFallback {
	display: block;
	padding: calc(14px * var(--hk3-ui-scale, 1));
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 700;
}

.rail {
	display: flex;
	flex-direction: column;
}

.railItem {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: max(44px, calc(56px * var(--hk3-ui-scale, 1)));
	padding: 0;
	border: 0;
	border-bottom: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
}

.railIcon {
	display: block;
	font-size: calc(22px * var(--hk3-ui-scale, 1));
	line-height: 22px;

	.railItem[data-active] & { color: var(--hk3-accent); }
}

.railBadge {
	top: 9px;
	right: 5px;
}

.foot {
	display: flex;
	flex-direction: column;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	padding: calc(12px * var(--hk3-ui-scale, 1));
	flex: none;
	border-top: 2px solid var(--hk3-divider);
}

.post {
	position: relative;
	height: 44px;
	border: 0;
	background: var(--hk3-accent);
	color: var(--hk3-bg);
	&::before {
		content: "";
		position: absolute;
		inset: 0;
		padding: 2px;
		pointer-events: none;
		background: linear-gradient(135deg,
			color-mix(in srgb, var(--hk3-accent) 65%, var(--hk3-bg)),
			var(--hk3-accent-100) 50%,
			color-mix(in srgb, var(--hk3-accent) 75%, var(--hk3-text)));
		mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		mask-composite: exclude;
	}
	cursor: pointer;
	display: grid;
	place-items: center;

	&:hover { background: var(--hk3-accent-600); }
}

.trio, .pair {
	position: relative;
	isolation: isolate;
	display: grid;
	border: 1px solid transparent;

	// 寸法とボタンの選択背景を保ち、外枠だけを柔らかくする。
	&::before {
		content: '';
		position: absolute;
		inset: 2px;
		z-index: -1;
		border: 1px solid var(--hk3-divider);
		border-radius: 6px;
		filter: blur(1.5px);
		opacity: 0.85;
		pointer-events: none;
	}
}

.trio { grid-template-columns: 1fr 1fr 1fr; }
.pair { grid-template-columns: 1fr 1fr; }
.trio[data-stack], .pair[data-stack] { grid-template-columns: 1fr; }

.footBtn, .modeBtn {
	height: 40px;
	border: 0;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	display: grid;
	place-items: center;

	& + & { border-left: 1px solid color-mix(in srgb, var(--hk3-divider) 70%, transparent); }
	[data-stack] > & + & { border-left: 0; border-top: 1px solid color-mix(in srgb, var(--hk3-divider) 70%, transparent); }
}

.modeBtn {
	&:disabled { opacity: 0.45; cursor: default; }
}

.item, .railItem, .footBtn, .modeBtn {
	position: relative;
	isolation: isolate;
	background: transparent;
	transition: color 180ms ease;

	// 右TLメニューと同じ柔らかい背景。文字・アイコン・バッジはぼかさない。
	&::before {
		content: '';
		position: absolute;
		inset: var(--hk3-nav-highlight-inset, 10px);
		z-index: -1;
		border-radius: 10px;
		pointer-events: none;
		background: color-mix(in srgb, var(--hk3-accent) 18%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hk3-accent) 28%, transparent);
		filter: blur(6px);
		opacity: 0;
		transform: scale(0.96);
		transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	&:hover:not(:disabled), &:focus-visible { color: var(--hk3-accent-800); }
	&:hover:not(:disabled)::before, &:focus-visible::before { opacity: 0.65; transform: scale(1); }
	&[data-active], &[data-on] { color: var(--hk3-accent-800); }
	&[data-active]::before, &[data-on]::before { opacity: 1; transform: scale(1); }

	.root &:focus-visible {
		outline: 2px solid var(--hk3-accent);
		outline-offset: -3px;
	}
}

.footBtn, .modeBtn { --hk3-nav-highlight-inset: 8px; }
.footBtn[data-active], .modeBtn[data-on] { color: var(--hk3-accent); }
.itemIcon, .railIcon { transition: color 180ms ease; }

.root[data-reduce-motion] {
	.item, .railItem, .footBtn, .modeBtn, .itemIcon, .railIcon { transition: none; }
	.item::before, .railItem::before, .footBtn::before, .modeBtn::before { transition: none; }
}

@media (prefers-reduced-motion: reduce) {
	.item, .railItem, .footBtn, .modeBtn, .itemIcon, .railIcon { transition: none; }
	.item::before, .railItem::before, .footBtn::before, .modeBtn::before { transition: none; }
}

.account {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	min-width: 0;

	.root[data-mode="collapsed"] & { justify-content: center; }
}

.accountAvatar {
	width: 32px;
	height: 32px;
	flex: none;
	border-radius: 0 !important;
	:global(img) { border-radius: 0 !important; }
}

.accountName {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
}
</style>
