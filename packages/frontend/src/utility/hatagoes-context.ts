/* SPDX-License-Identifier: AGPL-3.0-only */
import type { InjectionKey, Ref } from 'vue';
import type { HatagoesApp } from './hatagoes-catalog.js';
import type { HatagoesCatalogEntry } from './hatagoes-catalog.js';

/** The mounted application remains the sole owner of its existing save logic. */
export type HataGoesBridge = {
	openSettings: (section?: string) => void | Promise<void>;
	openProjectSwitch?: (event: MouseEvent) => void | Promise<void>;
	toggleTodo?: (id: string) => Promise<void>;
	recordMood?: (level: 1 | 2 | 3 | 4 | 5) => Promise<void>;
	water?: (day?: string) => Promise<void>;
	recordMeal?: (slot: 'breakfast' | 'lunch' | 'dinner', signal?: AbortSignal, surface?: HTMLElement) => Promise<void>;
	recordReading?: (bookId: string) => Promise<void>;
	openTool?: (tool: 'drawing-tool' | 'whats-new') => void | Promise<void>;
	create: (kind: string, signal?: AbortSignal, surface?: HTMLElement) => void | Promise<void>;
	refresh: () => void | Promise<void>;
	openResult?: (kind: string, id: string, onClosed?: () => void) => void | Promise<void>;
};
export type HataGoesAppearance = { theme: string; projectName?: string; cssVars?: Record<string, string> };
/** Palette captured from the pane that launched a detached popup. */
export type HataGoesTheme = {
	className?: string;
	hataskTheme?: string;
	hataskMode?: string;
	hatadyTheme?: string;
	style?: Record<string, string>;
};
export const HATA_GOES_THEME: InjectionKey<Readonly<Ref<HataGoesTheme>>> = Symbol('HataGoesTheme');
export type HataGoesHost = {
	active: Readonly<Ref<boolean>>;
	hatadyHeader?: {
		date?: Readonly<Ref<HTMLElement | null>>;
		actions: Readonly<Ref<HTMLElement | null>>;
		overview?: Readonly<Ref<HTMLElement | null>>;
	};
	register: (app: HatagoesApp, bridge: HataGoesBridge) => () => void;
	changed: () => void;
	openStandalone?: (path: string) => void;
	launcherApps?: Readonly<Ref<readonly HatagoesCatalogEntry[]>>;
	wide?: Readonly<Ref<boolean>>;
	openLauncherScreen?: (id: string) => void;
	openAllApps?: () => void;
};
export const HATA_GOES_HOST: InjectionKey<HataGoesHost> = Symbol('HataGoesHost');

/** Popup lifetime belongs to a HataGoes shell, not its currently selected app. */
export type HataGoesPopupSession = {
	active: Readonly<Ref<boolean>>;
	track: (close: () => void) => () => void;
	/** Save dirty local form state before forced popup disposal. */
	preserveDraft: (save: () => void) => () => void;
};
export const HATA_GOES_SESSION: InjectionKey<HataGoesPopupSession> = Symbol('HataGoesPopupSession');

/** Drafts within a detached popup are saved only when that popup is forcibly removed. */
export type HataGoesPopupScope = Pick<HataGoesPopupSession, 'preserveDraft'>;
export const HATA_GOES_POPUP_SCOPE: InjectionKey<HataGoesPopupScope> = Symbol('HataGoesPopupScope');
