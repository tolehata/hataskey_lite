/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defineAsyncComponent } from 'vue';
import { host } from '@@/js/config.js';
import { miLocalStorage } from '@/local-storage.js';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { enqueueHataDialog } from '@/utility/hata-dialog-queue.js';

function toolsMenuItems(): MenuItem[] {
	const items: MenuItem[] = [{
		type: 'link',
		to: '/scratchpad',
		text: i18n.ts.scratchpad,
		icon: 'ti ti-terminal-2',
	}, {
		type: 'link',
		to: '/api-console',
		text: 'API Console',
		icon: 'ti ti-terminal-2',
	}, {
		type: 'link',
		to: '/clicker',
		text: '🍪👈',
		icon: 'ti ti-cookie',
	}];

	if ($i && ($i.isAdmin || $i.policies.canManageCustomEmojis)) {
		items.push({
			type: 'link',
			to: '/custom-emojis-manager',
			text: i18n.ts.manageCustomEmojis,
			icon: 'ti ti-icons',
		});
	}

	if ($i && ($i.isAdmin || $i.policies.canManageAvatarDecorations)) {
		items.push({
			type: 'link' as const,
			to: '/avatar-decorations',
			text: i18n.ts.manageAvatarDecorations,
			icon: 'ti ti-sparkles',
		});
	}

	if ($i) {
		items.push({
			type: 'button',
			text: i18n.ts.replayUserSetupDialog,
			icon: 'ti ti-list-numbers',
			action: () => {
				store.set('accountSetupWizard', 0);
				const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkUserSetupDialog.vue')), {}, {
					closed: () => dispose(),
				});
			},
		});
	}

	return items;
}

function keepMenuNavigationInside(items: MenuItem[], navigate: (path: string) => void): MenuItem[] {
	return items.map(item => {
		if (item instanceof Promise) return item.then(resolved => keepMenuNavigationInside([resolved], navigate)[0]) as MenuItem;
		if (item.type === 'link') {
			return {
				type: 'button',
				text: item.text,
				caption: item.caption,
				icon: item.icon,
				indicate: item.indicate,
				avatar: item.avatar,
				action: () => navigate(item.to),
			};
		}
		if (item.type === 'parent') {
			const children = item.children;
			return {
				...item,
				children: Array.isArray(children)
					? keepMenuNavigationInside(children, navigate)
					: async () => keepMenuNavigationInside(await children(), navigate),
			};
		}
		return item;
	});
}

export function openInstanceMenu(ev: MouseEvent, navigate?: (path: string) => void) {
	const menuItems: MenuItem[] = [];

	menuItems.push({
		text: instance.name ?? host,
		type: 'label',
	}, {
		type: 'link',
		text: i18n.ts.instanceInfo,
		icon: 'ti ti-info-circle',
		to: '/about',
	}, {
		type: 'link',
		text: i18n.ts.customEmojis,
		icon: 'ti ti-icons',
		to: '/about#emojis',
	});

	if (instance.federation !== 'none') {
		menuItems.push({
			type: 'link',
			text: i18n.ts.federation,
			icon: 'ti ti-world',
			to: '/about#federation',
		});
	}

	menuItems.push({
		type: 'link',
		text: i18n.ts.charts,
		icon: 'ti ti-chart-line',
		to: '/about#charts',
	}, { type: 'divider' }, {
		type: 'link',
		text: i18n.ts.ads,
		icon: 'ti ti-ad',
		to: '/ads',
	});

	if ($i && ($i.isAdmin || $i.policies.canInvite) && instance.disableRegistration) {
		menuItems.push({
			type: 'link',
			to: '/invite',
			text: i18n.ts.invite,
			icon: 'ti ti-user-plus',
		});
	}

	menuItems.push({
		type: 'parent',
		text: i18n.ts.tools,
		icon: 'ti ti-tool',
		children: toolsMenuItems(),
	}, { type: 'divider' }, {
		type: 'link',
		text: i18n.ts.inquiry,
		icon: 'ti ti-help-circle',
		to: '/contact',
	});

	if (instance.impressumUrl) {
		menuItems.push({
			type: 'a',
			text: i18n.ts.impressum,
			icon: 'ti ti-file-invoice',
			href: instance.impressumUrl,
			target: '_blank',
		});
	}

	if (instance.tosUrl) {
		menuItems.push({
			type: 'a',
			text: i18n.ts.termsOfService,
			icon: 'ti ti-notebook',
			href: instance.tosUrl,
			target: '_blank',
		});
	}

	if (instance.privacyPolicyUrl) {
		menuItems.push({
			type: 'a',
			text: i18n.ts.privacyPolicy,
			icon: 'ti ti-shield-lock',
			href: instance.privacyPolicyUrl,
			target: '_blank',
		});
	}

	if (instance.impressumUrl != null || instance.tosUrl != null || instance.privacyPolicyUrl != null) {
		menuItems.push({ type: 'divider' });
	}

	menuItems.push({
		type: 'parent',
		icon: 'ti ti-bulb',
		text: i18n.ts.document,
		children: async () => {
			const documentChildMenu = [] as MenuItem[];

			documentChildMenu.push({
				type: 'a',
				text: i18n.ts.document,
				icon: 'ti ti-bulb',
				href: 'https://misskey-hub.net/docs/for-users/',
				target: '_blank',
			}, {
				type: 'link',
				text: i18n.ts._mfc.cheatSheet,
				icon: 'ti ti-help-circle',
				to: '/mfc-cheat-sheet',
			}, {
				type: 'link',
				text: i18n.ts._keyboardShortCut.list,
				icon: 'ti ti-keyboard',
				to: '/keyboard-shortcuts',
			});

			return documentChildMenu;
		},
	});

	if ($i) {
		menuItems.push({
			text: i18n.ts._initialTutorial.launchTutorial,
			icon: 'ti ti-presentation',
			action: async () => {
				const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkTutorialDialog.vue').then(x => x.default), {}, {
					closed: () => dispose(),
				});
			},
		});
	}

	menuItems.push({
		type: 'link',
		text: i18n.ts.aboutMisskey,
		to: '/about-misskey',
	});

	return os.popupMenu(navigate ? keepMenuNavigationInside(menuItems, navigate) : menuItems, ev.currentTarget ?? ev.target, {
		align: 'left',
	});
}

export function openToolsMenu(ev: MouseEvent) {
	os.popupMenu(toolsMenuItems(), ev.currentTarget ?? ev.target, {
		align: 'left',
	});
}

// ログインボーナスダイアログを表示
export function showLoginBonusIfNeeded() {
	if (!$i) return;
	if (!prefer.s.showLoginBonusPopup) return;
	
	const today = new Date();
	const todayStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
	const lastShown = miLocalStorage.getItem('loginBonusLastShown');
	
	if (lastShown === todayStr) return;

	/*
	旗鯖fork: 更新ダイアログ等と重ならないよう待ち行列に載せる。
	⚠️以前は「表示済み」を**出す前に**書いていたため、更新ダイアログのキャッシュ削除で
	  ページが再読み込みされると、その日はもう二度と出なかった（利用者報告）。
	⚠️記録は閉じられたときに付ける。
	*/
	enqueueHataDialog(() => new Promise<void>(resolve => {
		// 少し遅延させて表示（起動直後は避ける）
		window.setTimeout(() => {
			const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkLoginBonusDialog.vue')), {}, {
				closed: () => {
					miLocalStorage.setItem('loginBonusLastShown', todayStr);
					dispose();
					resolve();
				},
			});
		}, 1500);
	}));
}
