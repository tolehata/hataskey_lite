/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, reactive, defineAsyncComponent } from 'vue';
import { ui } from '@@/js/config.js';
import { clearCache } from './utility/clear-cache.js';
import { $i } from '@/i.js';
import { miLocalStorage } from '@/local-storage.js';
import { openInstanceMenu, openToolsMenu } from '@/ui/_common_/common.js';
import { lookup } from '@/utility/lookup.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { prefer } from '@/preferences.js';

export const navbarItemDef = reactive({
	notifications: {
		title: i18n.ts.notifications,
		icon: 'ti ti-bell',
		show: computed(() => $i != null),
		indicated: computed(() => $i != null && $i.hasUnreadNotification),
		indicateValue: computed(() => {
			if (!$i || $i.unreadNotificationsCount === 0) return '';

			if ($i.unreadNotificationsCount > 99) {
				return '99+';
			} else {
				return $i.unreadNotificationsCount.toString();
			}
		}),
		to: '/my/notifications',
	},
	// 旗鯖fork: 外部通知。外部アカウント連携時のみ表示 (通知の直後に配置)。
	externalNotifications: {
		title: i18n.ts._hata._common.externalNotifications,
		icon: 'ti ti-bell',
		show: computed(() => {
			const token = prefer.r['external.token']?.value;
			const host = prefer.r['external.host']?.value;
			const disabled = prefer.r['external.disableNotificationToast']?.value === true;
			return $i != null && token != null && host != null && host !== '' && !disabled;
		}),
		to: '/my/external-notifications',
	},
	drive: {
		title: i18n.ts.drive,
		icon: 'ti ti-cloud',
		show: computed(() => $i != null),
		to: '/my/drive',
	},
	followRequests: {
		title: i18n.ts.followRequests,
		icon: 'ti ti-user-plus',
		indicated: computed(() => $i != null && $i.hasPendingReceivedFollowRequest),
		to: '/my/follow-requests',
	},
	hatagoes: {
		title: 'HataGoes',
		icon: 'ti ti-sparkles',
		show: computed(() => $i != null),
		to: '/hatagoes',
	},
	mascot: {
		title: i18n.ts._hata._common.mascot,
		icon: 'ti ti-mood-smile',
		show: computed(() => $i != null),
		to: '/mascot',
	},
	earthquake: {
		title: '地震・津波情報',
		icon: 'ti ti-activity',
		to: '/earthquake',
	},
	explore: {
		title: i18n.ts.explore,
		icon: 'ti ti-hash',
		to: '/explore',
	},
	announcements: {
		title: i18n.ts.announcements,
		icon: 'ti ti-speakerphone',
		indicated: computed(() => $i != null && $i.hasUnreadAnnouncement),
		to: '/announcements',
	},
	search: {
		title: i18n.ts.search,
		icon: 'ti ti-search',
		to: '/search',
	},
	lookup: {
		title: i18n.ts.lookup,
		icon: 'ti ti-world-search',
		action: (ev) => {
			lookup();
		},
	},
	qr: {
		title: i18n.ts.qr,
		icon: 'ti ti-qrcode',
		show: computed(() => $i != null),
		to: '/qr',
	},
	lists: {
		title: i18n.ts.lists,
		icon: 'ti ti-list',
		show: computed(() => $i != null),
		to: '/my/lists',
	},
	groups: {
		title: i18n.ts.groups,
		icon: 'ti ti-users',
		show: computed(() => $i != null),
		to: '/my/groups',
	},
	antennas: {
		title: i18n.ts.antennas,
		icon: 'ti ti-antenna',
		show: computed(() => $i != null),
		to: '/my/antennas',
	},
	favorites: {
		title: i18n.ts.favorites,
		icon: 'ti ti-star',
		show: computed(() => $i != null),
		to: '/my/favorites',
	},
	pages: {
		title: i18n.ts.pages,
		icon: 'ti ti-news',
		to: '/pages',
	},
	play: {
		title: 'Play',
		icon: 'ti ti-player-play',
		to: '/play',
	},
	gallery: {
		title: i18n.ts.gallery,
		icon: 'ti ti-icons',
		to: '/gallery',
	},
	clips: {
		title: i18n.ts.clip,
		icon: 'ti ti-paperclip',
		show: computed(() => $i != null),
		to: '/my/clips',
	},
	channels: {
		title: i18n.ts.channel,
		icon: 'ti ti-device-tv',
		to: '/channels',
	},
	chat: {
		title: i18n.ts.directMessage_short,
		icon: 'ti ti-messages',
		to: '/chat',
		show: computed(() => $i != null && $i.policies.chatAvailability !== 'unavailable'),
		indicated: computed(() => $i?.hasUnreadChatMessages),
	},
	achievements: {
		title: i18n.ts.achievements,
		icon: 'ti ti-medal',
		show: computed(() => $i != null),
		to: '/my/achievements',
	},
	games: {
		title: 'Hataskey Games',
		icon: 'ti ti-device-gamepad',
		to: '/games',
	},
	ui: {
		title: i18n.ts.switchUi,
		icon: 'ti ti-devices',
                action: async (ev: MouseEvent) => {
                    const { defineAsyncComponent } = await import('vue');
                    // 即座に MkUISetup.vue を開く
                    os.popup(defineAsyncComponent(() => import('@/components/MkUISetup.vue')), {}, {});
                },
         },	
         help: {
		title: i18n.ts.help,
		icon: 'ti ti-help-circle',
		action: (ev) => {
			os.popupMenu([{
				text: i18n.ts._hata._common.latestUpdates,
				icon: 'ti ti-sparkles',
				action: () => {
					const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkHataWhatsNew.vue')), {}, {
						closed: () => dispose(),
					});
				},
			}, {
				type: 'a',
				text: i18n.ts.document,
				icon: 'ti ti-bulb',
				href: 'https://misskey-hub.net/docs/for-users/',
				target: '_blank',
			}, {
				type: 'link',
				text: i18n.ts._hata._common.featureGuide,
				icon: 'ti ti-book',
				to: '/hatask/intro',
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
			}], ev.currentTarget ?? ev.target);
		},
	},
	about: {
		title: i18n.ts.about,
		icon: 'ti ti-info-circle',
		action: (ev) => {
			openInstanceMenu(ev);
		},
	},
	tools: {
		title: i18n.ts.tools,
		icon: 'ti ti-tool',
		action: (ev) => {
			openToolsMenu(ev);
		},
	},
	reload: {
		title: i18n.ts.reload,
		icon: 'ti ti-refresh',
		action: (ev) => {
			window.location.reload();
		},
	},
	profile: {
		title: i18n.ts.profile,
		icon: 'ti ti-user',
		show: computed(() => $i != null),
		to: `/@${$i?.username}`,
	},
	// 旗鯖fork: CherryPick の支援関連はサイドバーから撤去し、
	// サーバーアイコン → サーバー情報(about-misskey)に集約しています。
	// (旧 support 項目は削除されました)
	cacheClear: {
		title: i18n.ts.clearCache,
		icon: 'ti ti-trash',
		action: (ev) => {
			clearCache();
		},
	},
});
