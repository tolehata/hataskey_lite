/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type SettingsNavigationIdSection = {
	items: readonly { id: string }[];
};

/** Reject ambiguous navigation targets before the settings shell can render them. */
export function assertUniqueNavigationIds(sections: readonly SettingsNavigationIdSection[]): void {
	const ids = new Set<string>();
	for (const section of sections) {
		for (const item of section.items) {
			if (ids.has(item.id)) throw new Error(`[settings-redesign] duplicate navigation item id: ${item.id}`);
			ids.add(item.id);
		}
	}
}
