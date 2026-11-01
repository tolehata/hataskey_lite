/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * The redesigned shell keeps these actions separate from search navigation.
 * A search result may focus the matching button, but only an explicit click
 * reaches this module and can clear client data or end a session.
 */
export type SettingsShellActionId = 'clear-cache' | 'logout' | 'logout-all';

export type SettingsShellActionLabels = {
	logoutConfirm: string;
	logoutAllConfirm: string;
	logoutWillClearClientData: string;
};

export type SettingsShellActionDependencies = {
	clearCache: () => Promise<void>;
	signout: () => void;
	signoutAll: () => void;
	confirm: (options: { type: 'warning'; title: string; text: string }) => Promise<{ canceled: boolean }>;
	labels: SettingsShellActionLabels;
};

export type SettingsShellActions = Record<SettingsShellActionId, () => Promise<void>>;

/** Mirrors the legacy settings confirmations without routing search into them. */
export function createSettingsShellActions(dependencies: SettingsShellActionDependencies): SettingsShellActions {
	return {
		'clear-cache': async () => {
			await dependencies.clearCache();
		},
		logout: async () => {
			const { canceled } = await dependencies.confirm({
				type: 'warning',
				title: dependencies.labels.logoutConfirm,
				text: dependencies.labels.logoutWillClearClientData,
			});
			if (canceled) return;
			dependencies.signout();
		},
		'logout-all': async () => {
			const { canceled } = await dependencies.confirm({
				type: 'warning',
				title: dependencies.labels.logoutAllConfirm,
				text: dependencies.labels.logoutWillClearClientData,
			});
			if (canceled) return;
			dependencies.signoutAll();
		},
	};
}
