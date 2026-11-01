/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { InjectionKey, Ref } from 'vue';
import type { SettingsCatalogDescriptorV2, SettingsCatalogV2 } from './settings-search-v2.js';

/**
 * A settings destination can require an in-page category or an existing
 * settings popup before its control is present in the DOM.  `stableId` is
 * optional because legacy related links predate the control inventory, while
 * current control results can use it to recover the activation metadata.
 */
export type SettingsSearchNavigationTargetV2 = Pick<SettingsCatalogDescriptorV2, 'route' | 'anchor' | 'controlId' | 'activation'> & {
	stableId?: string;
};

/**
 * The redesigned settings shell provides this context. Keeping it local to
 * that shell lets the legacy settings surface retain its existing markup.
 */
export interface SettingsSearchV2Context {
	catalog: Readonly<Ref<SettingsCatalogV2 | null>>;
	navigateToSetting: (target: SettingsSearchNavigationTargetV2) => void;
	/**
	 * The currently requested destination lets collapsed legacy folders reveal
	 * only the branch that contains that exact control or marker.
	 */
	activeNavigationTarget?: Readonly<Ref<SettingsSearchNavigationTargetV2 | null>>;
	/** Optional so legacy-compatible consumers can continue to provide only navigation. */
	motionEnabled?: Readonly<Ref<boolean>>;
	/** False when the shell renders related destinations once in the page footer. */
	inlineRelated?: boolean;
}

export const settingsSearchV2ContextKey: InjectionKey<SettingsSearchV2Context> = Symbol('settings-search-v2-context');
