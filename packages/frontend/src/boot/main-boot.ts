/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineAsyncComponent, markRaw } from 'vue';
import { ui } from '@@/js/config.js';
import * as Misskey from 'cherrypick-js';
import { common } from './common.js';
import type { Component } from 'vue';
import type { Keymap } from '@/utility/hotkey.js';
import { i18n } from '@/i18n.js';
import { alert, confirm, popup, post, toast } from '@/os.js';
import { useStream } from '@/stream.js';
import * as sound from '@/utility/sound.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { store } from '@/store.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { miLocalStorage } from '@/local-storage.js';
import { claimAchievement, claimedAchievements } from '@/utility/achievements.js';
import { initializeSw } from '@/utility/initialize-sw.js';
import { emojiPicker } from '@/utility/emoji-picker.js';
import { mainRouter } from '@/router.js';
import { makeHotkey } from '@/utility/hotkey.js';
import { addCustomEmoji, removeCustomEmojis, updateCustomEmojis } from '@/custom-emojis.js';
import { prefer } from '@/preferences.js';
import { updateCurrentAccount } from '@/accounts.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { userName } from '@/filters/user.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { cleanupStaleUiElements } from '@/utility/ui-cleanup.js';
import { initHataFontWatcher } from '@/scripts/hata-font-manager.js';
import { fetchMutedUsers, refreshMutedUsers } from '@/utility/muted-users.js';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';
import { enqueueHataDialog } from '@/utility/hata-dialog-queue.js';
import { HATA_WHATS_NEW } from '@/utility/hata-whats-new.js';
import { startHataskFlowerGrowthTracker } from '@/utility/hatask-flower-growth.js';
import { acceptNotificationUnreadState } from '@/utility/notification-unread-state.js';

export async function mainBoot() {
	cleanupStaleUiElements();

	// 旗鯖フォント初期化
	initHataFontWatcher();

	// 旗鯖fork: 柔らかい転換アニメーションは強制ON。preference値が反転トグル仕様で、
	// false = アニメーションON、true = アニメーションOFFという意味。
	// 過去にユーザーが OFF (true) で保存していた場合に備えて、起動時に強制的に false へ上書きする。
	// (設定画面のトグルも操作不可・常時ON表示に固定しているため、UIと挙動が一致する)
	if (prefer.s.smoothTransitionAnimations !== false) {
		prefer.commit('smoothTransitionAnimations', false);
	}

	// 旗鯖fork: ノートのいいね♡ボタンは廃止。過去にユーザーが ON (true) で保存していた場合に備えて、
	// 起動時に強制的に false へ上書きする (設定画面のトグルも削除済み)。
	if (prefer.s.showLikeButtonInNoteFooter !== false) {
		prefer.commit('showLikeButtonInNoteFooter', false);
	}

	// 旗鯖独自: ミュートユーザーリスト先読み（端末ローカル設定が有効な場合のみ）。
	// ノートが流れる前にリスト取得を完了させることで、リアルタイムフィルタの取りこぼしを防ぐ
	if (hideMutedReactionsLocal.value) {
		// 意図的に await しない: mainBootを遅延させないため。
		// capture側はrawの更新を保持し、表示側が取得完了後にまとめてフィルタする。
		fetchMutedUsers();
	}

	const { isClientUpdated, isClientMigrated } = await common(async () => {
		let uiStyle = ui;
		const searchParams = new URLSearchParams(window.location.search);

		if (!$i) uiStyle = 'visitor';

		if (searchParams.has('zen')) uiStyle = 'zen';
		if (uiStyle === 'deck' && prefer.s['deck.useSimpleUiForNonRootPages'] && window.location.pathname !== '/') uiStyle = 'zen';

		if (searchParams.has('ui')) uiStyle = searchParams.get('ui');

		let rootComponent: Component;
		switch (uiStyle) {
			case 'zen':
				rootComponent = await import('@/ui/zen.vue').then(x => x.default);
				break;
			case 'deck':
				rootComponent = await import('@/ui/deck.vue').then(x => x.default);
				break;
			case 'visitor':
				rootComponent = await import('@/ui/visitor.vue').then(x => x.default);
				break;
			case 'hataskey3':
				rootComponent = await import('@/ui/hataskey3.vue').then(x => x.default);
				break;
			case 'simple':
				rootComponent = await import('@/ui/simple.vue').then(x => x.default);
				break;
			case 'default':
				rootComponent = await import('@/ui/universal.vue').then(x => x.default);
				break;
			// 旗鯖fork: friendly UI を全面廃止。
			// 旧 'friendly' 値が来た場合や未知の値は simple にフォールバックする。
			case 'friendly':
			default:
				rootComponent = await import('@/ui/simple.vue').then(x => x.default);
				break;
		}

		return createApp(rootComponent);
	});

	// Hataskのお花はページやUIの表示有無に依存せず、保存時刻から実経過で育てる。
	// 背景・終了中の分も、復帰または次回起動時にまとめて反映する。
	if ($i) startHataskFlowerGrowthTracker();

	// 廃止した接続先の認証情報を common() 内で消してから、許可された外部通知ストリームだけを起動する。
	const { startExternalNotificationStream } = await import('@/utility/external-notification-stream.js');
	startExternalNotificationStream();
	if ($i) {
		const { initializeConcrnt } = await import('@/utility/concrnt/runtime.js');
		void initializeConcrnt();
	}

	reactionPicker.init();
	emojiPicker.init();

	/*
	旗鯖fork: 起動直後の案内は**待ち行列で1つずつ**出す。
	⚠️同時に開くと重なるうえ、MkUpdated を閉じると clearCache() がページを再読み込みするため、
	  後続のダイアログが道連れで消えていた（利用者報告）。
	⚠️「表示済み」の記録は閉じられたときだけ付ける。途中で再読み込みが挟まっても次回起動で出る。
	*/
	if ((isClientUpdated || isClientMigrated) && $i) {
		enqueueHataDialog(() => new Promise<void>(resolve => {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkUpdated.vue')), {}, {
				closed: () => { dispose(); resolve(); },
			});
		}));
	}

	if (isClientMigrated && $i) {
		miLocalStorage.removeItem('neverShowDonationInfo');
		miLocalStorage.removeItem('latestDonationInfoShownAt');
		enqueueHataDialog(() => new Promise<void>(resolve => {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkMigrated.vue')), {}, {
				closed: () => { dispose(); resolve(); },
			});
		}));
	}

	// 旗鯖fork: 「今回の更新内容」。⚠️版が変わったときだけ・端末ごとに1回。
	if ($i && miLocalStorage.getItem('hataWhatsNewShownVersion') !== HATA_WHATS_NEW.version) {
		enqueueHataDialog(() => new Promise<void>(resolve => {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkHataWhatsNew.vue')), {}, {
				closed: () => {
					// ⚠️閉じられて初めて記録する（先に書くと、再読み込みで消えたとき二度と出ない）。
					miLocalStorage.setItem('hataWhatsNewShownVersion', HATA_WHATS_NEW.version);
					dispose();
					resolve();
				},
			});
		}));
	}

	try {
		if (prefer.s.enableSeasonalScreenEffect) {
			const month = new Date().getMonth() + 1;
			if (prefer.s.hemisphere === 'S') {
				// ▼南半球
				if (month === 7 || month === 8) {
					const SnowfallEffect = (await import('@/utility/snowfall-effect.js')).SnowfallEffect;
					new SnowfallEffect({}).render();
				}
			} else {
				// ▼北半球
				if (month === 12 || month === 1) {
					const SnowfallEffect = (await import('@/utility/snowfall-effect.js')).SnowfallEffect;
					new SnowfallEffect({}).render();
				} else if (month === 3 || month === 4) {
					const SakuraEffect = (await import('@/utility/snowfall-effect.js')).SnowfallEffect;
					new SakuraEffect({
						sakura: true,
					}).render();
				}
			}
		}
	} catch (error) {
		// console.error(error);
		console.error('Failed to initialise the seasonal screen effect canvas context:', error);
	}

	if ($i) {
		store.loaded.then(async () => {
			if (store.s.accountSetupWizard !== -1) {
				const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkUserSetupDialog.vue')), {}, {
					closed: () => dispose(),
				});
			}
		});

		for (const announcement of ($i.unreadAnnouncements ?? []).filter(x => x.display === 'dialog')) {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkAnnouncementDialog.vue')), {
				announcement,
			}, {
				closed: () => dispose(),
			});
		}

		function onAnnouncementCreated(ev: { announcement: Misskey.entities.Announcement }) {
			const announcement = ev.announcement;
			if (announcement.display === 'dialog') {
				const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkAnnouncementDialog.vue')), {
					announcement,
				}, {
					closed: () => dispose(),
				});
			}
		}

		if ($i.isDeleted) {
			alert({
				type: 'warning',
				text: i18n.ts.accountDeletionInProgress,
			});
		}

		const now = new Date();
		const m = now.getMonth() + 1;
		const d = now.getDate();

		if ($i.birthday) {
			const bm = parseInt($i.birthday.split('-')[1]);
			const bd = parseInt($i.birthday.split('-')[2]);
			if (m === bm && d === bd) {
				claimAchievement('loggedInOnBirthday');
			}
		}

		if (m === 1 && d === 1) {
			claimAchievement('loggedInOnNewYearsDay');
		}

		if ($i.loggedInDays >= 3) claimAchievement('login3');
		if ($i.loggedInDays >= 7) claimAchievement('login7');
		if ($i.loggedInDays >= 15) claimAchievement('login15');
		if ($i.loggedInDays >= 30) claimAchievement('login30');
		if ($i.loggedInDays >= 60) claimAchievement('login60');
		if ($i.loggedInDays >= 100) claimAchievement('login100');
		if ($i.loggedInDays >= 200) claimAchievement('login200');
		if ($i.loggedInDays >= 300) claimAchievement('login300');
		if ($i.loggedInDays >= 400) claimAchievement('login400');
		if ($i.loggedInDays >= 500) claimAchievement('login500');
		if ($i.loggedInDays >= 600) claimAchievement('login600');
		if ($i.loggedInDays >= 700) claimAchievement('login700');
		if ($i.loggedInDays >= 800) claimAchievement('login800');
		if ($i.loggedInDays >= 900) claimAchievement('login900');
		if ($i.loggedInDays >= 1000) claimAchievement('login1000');

		if ($i.notesCount > 0) claimAchievement('notes1');
		if ($i.notesCount >= 10) claimAchievement('notes10');
		if ($i.notesCount >= 100) claimAchievement('notes100');
		if ($i.notesCount >= 500) claimAchievement('notes500');
		if ($i.notesCount >= 1000) claimAchievement('notes1000');
		if ($i.notesCount >= 5000) claimAchievement('notes5000');
		if ($i.notesCount >= 10000) claimAchievement('notes10000');
		if ($i.notesCount >= 20000) claimAchievement('notes20000');
		if ($i.notesCount >= 30000) claimAchievement('notes30000');
		if ($i.notesCount >= 40000) claimAchievement('notes40000');
		if ($i.notesCount >= 50000) claimAchievement('notes50000');
		if ($i.notesCount >= 60000) claimAchievement('notes60000');
		if ($i.notesCount >= 70000) claimAchievement('notes70000');
		if ($i.notesCount >= 80000) claimAchievement('notes80000');
		if ($i.notesCount >= 90000) claimAchievement('notes90000');
		if ($i.notesCount >= 100000) claimAchievement('notes100000');

		if ($i.followersCount > 0) claimAchievement('followers1');
		if ($i.followersCount >= 10) claimAchievement('followers10');
		if ($i.followersCount >= 50) claimAchievement('followers50');
		if ($i.followersCount >= 100) claimAchievement('followers100');
		if ($i.followersCount >= 300) claimAchievement('followers300');
		if ($i.followersCount >= 500) claimAchievement('followers500');
		if ($i.followersCount >= 1000) claimAchievement('followers1000');

		const createdAt = new Date($i.createdAt);
		const createdAtThreeYearsLater = new Date($i.createdAt);
		createdAtThreeYearsLater.setFullYear(createdAtThreeYearsLater.getFullYear() + 3);
		if (now >= createdAtThreeYearsLater) {
			claimAchievement('passedSinceAccountCreated3');
			claimAchievement('passedSinceAccountCreated2');
			claimAchievement('passedSinceAccountCreated1');
		} else {
			const createdAtTwoYearsLater = new Date($i.createdAt);
			createdAtTwoYearsLater.setFullYear(createdAtTwoYearsLater.getFullYear() + 2);
			if (now >= createdAtTwoYearsLater) {
				claimAchievement('passedSinceAccountCreated2');
				claimAchievement('passedSinceAccountCreated1');
			} else {
				const createdAtOneYearLater = new Date($i.createdAt);
				createdAtOneYearLater.setFullYear(createdAtOneYearLater.getFullYear() + 1);
				if (now >= createdAtOneYearLater) {
					claimAchievement('passedSinceAccountCreated1');
				}
			}
		}

		if (claimedAchievements.length >= 30) {
			claimAchievement('collectAchievements30');
		}

		if (!claimedAchievements.includes('justPlainLucky')) {
			let justPlainLuckyTimer: number | null = null;
			let lastVisibilityChangedAt = Date.now();

			function claimPlainLucky() {
				if (window.document.visibilityState !== 'visible') {
					if (justPlainLuckyTimer != null) window.clearTimeout(justPlainLuckyTimer);
					return;
				}

				if (Math.floor(Math.random() * 20000) === 0) {
					claimAchievement('justPlainLucky');
				} else {
					justPlainLuckyTimer = window.setTimeout(claimPlainLucky, 1000 * 10);
				}
			}

			window.addEventListener('visibilitychange', () => {
				const now = Date.now();

				if (window.document.visibilityState === 'visible') {
					// タブを高速で切り替えたら取得処理が何度も走るのを防ぐ
					if ((now - lastVisibilityChangedAt) < 1000 * 10) {
						justPlainLuckyTimer = window.setTimeout(claimPlainLucky, 1000 * 10);
					} else {
						claimPlainLucky();
					}
				} else if (justPlainLuckyTimer != null) {
					window.clearTimeout(justPlainLuckyTimer);
					justPlainLuckyTimer = null;
				}

				lastVisibilityChangedAt = now;
			}, { passive: true });

			claimPlainLucky();
		}

		if (!claimedAchievements.includes('client30min')) {
			window.setTimeout(() => {
				claimAchievement('client30min');
			}, 1000 * 60 * 30);
		}

		if (!claimedAchievements.includes('client60min')) {
			window.setTimeout(() => {
				claimAchievement('client60min');
			}, 1000 * 60 * 60);
		}

		const lastUsed = miLocalStorage.getItem('lastUsed');
		if (lastUsed) {
			const lastUsedDate = parseInt(lastUsed, 10);
			// 二時間以上前なら
			if (prefer.s.welcomeBackToast && Date.now() - lastUsedDate > 1000 * 60 * 60 * 2) {
				toast(i18n.tsx.welcomeBackWithName({
					name: userName($i),
				}), undefined, true);
			}
		}
		miLocalStorage.setItem('lastUsed', Date.now().toString());

		const latestDonationInfoShownAt = miLocalStorage.getItem('latestDonationInfoShownAt');
		const neverShowDonationInfo = miLocalStorage.getItem('neverShowDonationInfo');
		if (neverShowDonationInfo !== 'true' && (createdAt.getTime() < (Date.now() - (1000 * 60 * 60 * 24 * 3))) && !window.location.pathname.startsWith('/miauth')) {
			if (latestDonationInfoShownAt == null || (new Date(latestDonationInfoShownAt).getTime() < (Date.now() - (1000 * 60 * 60 * 24 * 30)))) {
				const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkDonation.vue')), {}, {
					closed: () => dispose(),
				});
			}
		}

		const modifiedVersionMustProminentlyOfferInAgplV3Section13Read = miLocalStorage.getItem('modifiedVersionMustProminentlyOfferInAgplV3Section13Read');
		// 旗鯖fork: 無改変とみなす公式リポジトリURLは tolehata/hataskey。
		// これと一致する場合は「無改変版」とみなしAGPL第13条のソース開示ポップアップを出さない。
		// (about-misskey.vue の判定と値を揃えること)
		if (modifiedVersionMustProminentlyOfferInAgplV3Section13Read !== 'true' && instance.repositoryUrl !== 'https://github.com/tolehata/hataskey') {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkSourceCodeAvailablePopup.vue')), {}, {
				closed: () => dispose(),
			});
		}

		if ('Notification' in window) {
			// 許可を得ていなかったらリクエスト
			if (Notification.permission === 'default') {
				Notification.requestPermission();
			}
		}

		if (store.s.realtimeMode) {
			const stream = useStream();

			let reloadDialogShowing = false;
			stream.on('_disconnected_', async () => {
				if (prefer.s.serverDisconnectedBehavior === 'reload') {
					window.location.reload();
				} else if (prefer.s.serverDisconnectedBehavior === 'dialog') {
					if (reloadDialogShowing) return;
					reloadDialogShowing = true;
					const { canceled } = await confirm({
						type: 'warning',
						title: i18n.ts.disconnectedFromServer,
						text: i18n.ts.reloadConfirm,
					});
					reloadDialogShowing = false;
					if (!canceled) {
						window.location.reload();
					}
				}
			});

			stream.on('emojiAdded', emojiData => {
				addCustomEmoji(emojiData.emoji);
			});

			stream.on('emojiUpdated', emojiData => {
				updateCustomEmojis(emojiData.emojis);
			});

			stream.on('emojiDeleted', emojiData => {
				removeCustomEmojis(emojiData.emojis);
			});

			stream.on('announcementCreated', onAnnouncementCreated);

			const main = markRaw(stream.useChannel('main', null, 'System'));
			const notificationOwnerId = $i?.id;
			const updateUnread = (state: { unreadNotificationsCount: number; revision: string }) => {
				if ($i?.id !== notificationOwnerId) return;
				const count = acceptNotificationUnreadState(notificationOwnerId, state);
				if (count === null) return;
				updateCurrentAccount({ hasUnreadNotification: count > 0, unreadNotificationsCount: count });
			};
			let unreadSnapshotRequest = 0;
			const refreshUnreadSnapshot = async () => {
				const request = ++unreadSnapshotRequest;
				if (!notificationOwnerId || $i?.id !== notificationOwnerId) return;
				try {
					const state = await misskeyApi('notifications/unread-count', {});
					if (request === unreadSnapshotRequest && $i?.id === notificationOwnerId) updateUnread(state);
				} catch { /* Live events remain authoritative until the next connection. */ }
			};
			stream.on('_connected_', refreshUnreadSnapshot);
			if (stream.state === 'connected') void refreshUnreadSnapshot();

			// 自分の情報が更新されたとき
			main.on('meUpdated', i => {
				if ($i?.id !== notificationOwnerId) return;
				// 未読件数はrevision付き通知イベントだけから適用する。
				const profile = { ...i } as typeof i & { hasUnreadNotification?: boolean; unreadNotificationsCount?: number };
				delete profile.hasUnreadNotification;
				delete profile.unreadNotificationsCount;
				updateCurrentAccount(profile);
			});

			main.on('readAllNotifications', updateUnread);
			main.on('readNotification', updateUnread);
			main.on('notificationChanged', updateUnread);
			main.on('notificationFlushed', updateUnread);
			main.on('unreadNotification', updateUnread);

			main.on('newChatMessage', () => {
				updateCurrentAccount({ hasUnreadChatMessages: true });
				sound.playMisskeySfx('chatMessage');
			});

			main.on('readAllAnnouncements', () => {
				updateCurrentAccount({ hasUnreadAnnouncement: false });
			});

			// 個人宛てお知らせが発行されたとき
			main.on('announcementCreated', onAnnouncementCreated);

			// 非同期のミュート取込が本当に完了した時点で、表示用一覧を取り直す。
			main.on('mutingImportCompleted', () => {
				refreshMutedUsers();
			});
		}

		// 프로필 아이콘 모양 설정 연합 초기화
		if ($i.policies.canSetFederationAvatarShape && prefer.s.setFederationAvatarShape) {
			await misskeyApi('i/update', {
				setFederationAvatarShape: true,
				isSquareAvatars: prefer.s.squareAvatars,
			});
		} else if (!$i.policies.canSetFederationAvatarShape && prefer.s.setFederationAvatarShape) {
			await misskeyApi('i/update', {
				setFederationAvatarShape: false,
				isSquareAvatars: prefer.s.squareAvatars,
			});
		}
	}

	// shortcut
	let safemodeRequestCount = 0;
	let safemodeRequestTimer: number | null = null;
	const keymap = {
		[ui === 'hataskey3' ? 'p' : 'p|n']: () => {
			if ($i == null) return;
			post();
		},
		// 旗鯖fork: 本家 2026.6.0 から取り込み: 「D」キーでダークモードを切り替える際に syncDeviceDarkMode のチェックがバイパスされる問題を修正
		'd': async () => {
			const value = !store.s.darkMode;
			if (prefer.s.syncDeviceDarkMode) {
				const { canceled } = await confirm({
					type: 'question',
					text: i18n.tsx.switchDarkModeManuallyWhenSyncEnabledConfirm({ x: i18n.ts.syncDeviceDarkMode }),
				});
				if (canceled) return;

				prefer.commit('syncDeviceDarkMode', false);
				store.set('darkMode', value);
			} else {
				store.set('darkMode', value);
			}
		},
		's': () => {
			mainRouter.push('/search');
		},
		'g': {
			callback: () => {
				// mを5回押すとセーフモードに入る
				safemodeRequestCount++;
				if (safemodeRequestCount >= 5) {
					miLocalStorage.setItem('isSafeMode', 'true');
					unisonReload();
				} else {
					if (safemodeRequestTimer != null) {
						window.clearTimeout(safemodeRequestTimer);
					}
					safemodeRequestTimer = window.setTimeout(() => {
						safemodeRequestCount = 0;
					}, 300);
				}
			},
			allowRepeat: true,
		},
		// 環境によるかもしれないが?では反応しないため、shift+/にする必要がある
		'shift+/': () => {
			os.popup(defineAsyncComponent(() => import('@/components/MkKeyboardShortcut.vue')), {}, {});
		},
	} as const satisfies Keymap;
	window.document.addEventListener('keydown', makeHotkey(keymap), { passive: false });

	initializeSw();
}
