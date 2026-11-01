/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, watch, version as vueVersion, defineAsyncComponent } from 'vue';
import { compareVersions } from 'compare-versions';
import { version, basedMisskeyVersion, lang, isSafeMode } from '@@/js/config.js';
import defaultLightTheme from '@@/themes/l-cherrypick.json5';
import defaultDarkTheme from '@@/themes/d-cherrypick.json5';
import { storeBootloaderErrors } from '@@/js/store-boot-errors';
import type { App } from 'vue';
import widgets from '@/widgets/index.js';
import directives from '@/directives/index.js';
import components from '@/components/index.js';
import { applyTheme } from '@/theme.js';
import { isDeviceDarkmode } from '@/utility/is-device-darkmode.js';
import { updateI18n, i18n } from '@/i18n.js';
import { refreshCurrentAccount, login } from '@/accounts.js';
import { store } from '@/store.js';
import { fetchInstance, instance } from '@/instance.js';
import { deviceKind, updateDeviceKind } from '@/utility/device-kind.js';
import { reloadChannel } from '@/utility/unison-reload.js';
import { getUrlWithoutLoginId } from '@/utility/login-id.js';
import { getAccountFromId } from '@/utility/get-account-from-id.js';
import { deckStore } from '@/ui/deck/deck-store.js';
import { analytics, initAnalytics } from '@/analytics.js';
import { miLocalStorage } from '@/local-storage.js';
import { fetchCustomEmojis } from '@/custom-emojis.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { launchPlugins } from '@/plugin.js';
import { popup } from '@/os.js';
import { initTelemetry } from '@/telemetry.js';
import { initViewportInset } from '@/utility/viewport-inset.js';

export async function common(createVue: () => Promise<App<Element>>) {
	initViewportInset();
	console.info(`CherryPick v${version}`);

	if (_DEV_) {
		console.warn('Development mode!!!');

		console.info(`vue ${vueVersion}`);

		window.addEventListener('error', event => {
			console.error(event);
			/*
			alert({
				type: 'error',
				title: 'DEV: Unhandled error',
				text: event.message
			});
			*/
		});

		window.addEventListener('unhandledrejection', event => {
			if (event.defaultPrevented) return;
			console.error(event);
			/*
			alert({
				type: 'error',
				title: 'DEV: Unhandled promise rejection',
				text: event.reason
			});
			*/
		});
	}

	let isClientUpdated = false;
	let isClientMigrated = false;
	const showPushNotificationDialog = miLocalStorage.getItem('showPushNotificationDialog');

	if (miLocalStorage.getItem('ui') === null) miLocalStorage.setItem('ui', 'simple');

	// 旗鯖fork: friendly UI を全面廃止しているため、毎boot時にチェックして
	// 'ui' === 'friendly' なら強制的に 'simple' に書き換える。
	// friendly.vue 自体は削除されているため、放置すると main-boot のフォールバックで
	// 同じく simple が選ばれるが、 localStorage の値が古いままだと UI 切替メニュー等で
	// 混乱が生じるため、ここで都度クリーンアップする。
	if (miLocalStorage.getItem('ui') === 'friendly') {
		miLocalStorage.setItem('ui', 'simple');
	}

	// 旗鯖fork: HataSNSCordUI は Hataskey UI 3 に置き換えて廃止した。利用中だった端末は UI3 へ移す。
	if (miLocalStorage.getItem('ui') === 'hatacording') {
		miLocalStorage.setItem('ui', 'hataskey3');
	}
	// 旧UIの端末ローカル設定・通知履歴キャッシュは参照元が無くなったため片付ける。
	try {
		for (const key of Object.keys(window.localStorage)) {
			if (key.startsWith('hatacordingUi:') || key.startsWith('hatacordingActivityCache:')) window.localStorage.removeItem(key);
		}
	} catch { /* ストレージにアクセスできない環境では何もしない */ }

	// 旗鯖: デッキUI以外のユーザーをSimple UIに一度だけ強制移行
	if (!miLocalStorage.getItem('hata_ui_migrated')) {
		const currentUi = miLocalStorage.getItem('ui');
		if (currentUi !== 'deck' && currentUi !== 'simple' && currentUi !== 'hataskey3') {
			miLocalStorage.setItem('ui', 'simple');
		}
		miLocalStorage.setItem('hata_ui_migrated', '1');
	}

	// 旗鯖: classicNoteSpacingを一度だけ強制ON
	// 旗鯖: showGapBodyOfTheNoteを一度だけ強制ON
	if (!miLocalStorage.getItem('hata_gap_body_migrated')) {
		const { prefer: preferGap } = await import('@/preferences.js');
		if (!preferGap.s.showGapBodyOfTheNote) {
			preferGap.commit('showGapBodyOfTheNote', true);
		}
		miLocalStorage.setItem('hata_gap_body_migrated', '1');
	}

	if (!miLocalStorage.getItem('hata_classic_spacing_migrated')) {
		const { prefer } = await import('@/preferences.js');
		if (!prefer.s['simpleUi.classicNoteSpacing']) {
			prefer.commit('simpleUi.classicNoteSpacing', true);
		}
		miLocalStorage.setItem('hata_classic_spacing_migrated', '1');
	}

	// 旗鯖fork: Misskey(デフォルト)UI では ノートの間隔の既定を「広め」にする。
	//   旧既定(moderate)のままのユーザーを一度だけ wide に引き上げる(一度きり・以後の変更は尊重)。
	if (!miLocalStorage.getItem('hata_misskeyui_wide_spacing_migrated')) {
		const { prefer } = await import('@/preferences.js');
		if (miLocalStorage.getItem('ui') === 'default' && prefer.s['simpleUi.noteSpacing'] === 'moderate') {
			prefer.commit('simpleUi.noteSpacing', 'wide');
		}
		miLocalStorage.setItem('hata_misskeyui_wide_spacing_migrated', '1');
	}

	// 旗鯖: 天気エフェクトを一度だけ強制OFF。以前デフォルトが誤ってONだったため、
	// 光過敏症(光感受性てんかん)配慮を最優先して既存ユーザーも一度リセットする。
	// 一度きり(フラグで保護)なので、その後ユーザーが設定で再度ONにすれば尊重される。
	if (!miLocalStorage.getItem('hata_weather_default_off_migrated')) {
		const { prefer: preferWeather } = await import('@/preferences.js');
		if (preferWeather.s['weatherEffect.enabled']) {
			preferWeather.commit('weatherEffect.enabled', false);
		}
		miLocalStorage.setItem('hata_weather_default_off_migrated', '1');
	}

	// 旗鯖(#31): 旧「ミュートユーザーのリアクション非表示」(prefer同期)を有効にしていた人は、
	//   端末ローカルのトグルを自動でONにする(端末ごと)。
	{
		const { prefer: preferMr } = await import('@/preferences.js');
		const hadEnabled = preferMr.s['hideMutedUserReactions'] === true;
		// 端末ローカルのトグルを有効化(この端末で1回だけ)。
		if (hadEnabled && !miLocalStorage.getItem('hata_muted_reactions_local_migrated')) {
			const { setHideMutedReactionsLocal } = await import('@/utility/hatasaba-device-prefs.js');
			setHideMutedReactionsLocal(true);
		}
		if (!miLocalStorage.getItem('hata_muted_reactions_local_migrated')) {
			miLocalStorage.setItem('hata_muted_reactions_local_migrated', '1');
		}
	}

	// 旗鯖: サイドバーに「お知らせ」「UI切り替え」を自動追加（既存ユーザー向け）
	if (!miLocalStorage.getItem('hata_sidebar_v2_migrated')) {
		const { prefer: preferSidebar } = await import('@/preferences.js');
		const current = [...(preferSidebar.s['simpleUi.sidebar'] ?? [])];
		const has = (id: string) => current.some(i => i && i.id === id);
		let changed = false;
		// 「もっと」の直前に挿入（無ければ末尾に追加）
		const moreIdx = current.findIndex(i => i && i.id === 'more');
		const insertAt = moreIdx >= 0 ? moreIdx : current.length;
		if (!has('uiSetup')) {
			current.splice(insertAt, 0, { id: 'uiSetup', icon: 'ti ti-wand', label: 'UI切り替え' });
			changed = true;
		}
		if (!has('announcements')) {
			// 再検索（uiSetup追加で位置が変わってる可能性があるため）
			const newMoreIdx = current.findIndex(i => i && i.id === 'more');
			const insertPos = newMoreIdx >= 0 ? newMoreIdx : current.length;
			current.splice(insertPos, 0, { id: 'announcements', icon: 'ti ti-speakerphone', label: 'お知らせ' });
			changed = true;
		}
		if (changed) {
			preferSidebar.commit('simpleUi.sidebar', current);
		}
		miLocalStorage.setItem('hata_sidebar_v2_migrated', '1');
	}

	// 旗鯖: サイドメニュー3グループ再編 (hata-11.x) — 既存ユーザーも新デフォルト構成へ強制移行
	// 旧構成 (13項目フラット) から新構成 (基本機能/旗鯖独自/発見・交流の3グループ) に置き換える。
	// chat/lists/antennas はサイドバーから外れ「もっと」(ランチパッド) からアクセス可能。
	//
	// 旗鯖fork: 旧実装は miLocalStorage フラグでマイグレ済み判定していたが、simpleUi.sidebar 自体は
	// prefer (マルチデバイス同期) であるのに対し、miLocalStorage は端末ローカルのため、
	// 別端末/別ブラウザ/シークレットウィンドウでアクセスするたびにマイグレが走り、
	// ユーザーが ON/OFF した設定や並び順をデフォルト値で完全上書きしてしまう本番不具合があった。
	// 「sidebar の中身が新形式(group プロパティを持つ) ならマイグレ済み」と判定するロジックに変更し、
	// 端末を跨いでも prefer 経由で正しくスキップされるようにする (旧 miLocalStorage フラグは無害化のため
	// 設定するが、もはや判定には使わない)。
	//
	// ★ 今後のサイドバーマイグレ方針 (設計指針):
	//   - 「強制リセット (デフォルト値で完全上書き)」型のマイグレは新規追加しないこと
	//     (この v3 のような形式は本番不具合の温床になる)。
	//   - 新機能をサイドバーに追加する場合は v4 同様の insertAfter / push 方式を採用し、
	//     既存にない id だけを追加する。ユーザーが過去に visible:false でOFFにした項目は
	//     復活させないこと(意思を尊重)。
	//   - 旧 id をリネームする等の構造変更は、置換ではなく旧id→新idの mapping で対応し、
	//     表示/非表示や順序は保持すること。
	//   - グループ構成の大きな変更が必要な場合のみ、ユーザー周知 + 同意ダイアログを挟むこと。
	if (!miLocalStorage.getItem('hata_sidebar_v3_migrated')) {
		const { prefer: preferSidebarV3 } = await import('@/preferences.js');
		const currentSidebar = preferSidebarV3.s['simpleUi.sidebar'] ?? [];
		const isAlreadyNewFormat = Array.isArray(currentSidebar)
			&& currentSidebar.length > 0
			&& currentSidebar.some(i => i && typeof i.group === 'string');
		if (!isAlreadyNewFormat) {
			const { PREF_DEF } = await import('@/preferences/def.js');
			// def.ts のデフォルト定義をそのまま採用 (二重管理を避ける)
			const newDefault = PREF_DEF['simpleUi.sidebar'].default;
			preferSidebarV3.commit('simpleUi.sidebar', JSON.parse(JSON.stringify(newDefault)));
		}
		miLocalStorage.setItem('hata_sidebar_v3_migrated', '1');
	}

	// 旗鯖: HataFeed・地震/津波情報をサイドバーの「旗鯖独自」グループに自動追加（既存ユーザー向け・既定で表示）
	if (!miLocalStorage.getItem('hata_sidebar_v4_migrated')) {
		const { prefer: preferSb4 } = await import('@/preferences.js');
		const current = [...(preferSb4.s['simpleUi.sidebar'] ?? [])];
		const has = (id: string) => current.some(i => i && i.id === id);
		let changed = false;
		const insertAfter = (afterId: string, item: any) => {
			if (has(item.id)) return;
			let idx = current.findIndex(i => i && i.id === afterId);
			if (idx < 0) {
				// 基準が無ければ「もっと」の直前、それも無ければ末尾。
				const m = current.findIndex(i => i && i.id === 'more');
				idx = (m >= 0 ? m - 1 : current.length - 1);
			}
			current.splice(idx + 1, 0, item);
			changed = true;
		};
		insertAfter('hatask', { id: 'hatafeed', icon: 'ti ti-message-report', label: 'HataFeed', group: 'hata' });
		insertAfter('hatafeed', { id: 'earthquake', icon: 'ti ti-activity', label: '地震・津波情報', group: 'hata' });
		if (changed) preferSb4.commit('simpleUi.sidebar', current);
		miLocalStorage.setItem('hata_sidebar_v4_migrated', '1');
	}

	// 旗鯖fork: chat (メッセージ) と reload (リロード) をサイドバー項目化 (hata-11.7.x)
	// かつて ui/simple.vue で chat は動的注入・reload はテンプレート内ハードコード表示していたが、
	// 「設定 UI で項目が見えない・ON/OFF や並び替えができない」というユーザー要望に対応するため
	// 通常の prefer 保存項目として扱う。設計指針通り insertAfter 方式 (既存にない id だけ追加) で
	// ユーザーの ON/OFF / 並び替え状態を保持。
	if (!miLocalStorage.getItem('hata_sidebar_v5_migrated')) {
		const { prefer: preferSb5 } = await import('@/preferences.js');
		const current = [...(preferSb5.s['simpleUi.sidebar'] ?? [])];
		const has = (id: string) => current.some(i => i && i.id === id);
		let changed = false;
		// chat を notifications の直後 (なければ basic 末尾) に追加
		if (!has('chat')) {
			const notifIdx = current.findIndex(i => i && i.id === 'notifications');
			const insertAt = notifIdx >= 0 ? notifIdx + 1 : current.length;
			current.splice(insertAt, 0, { id: 'chat', icon: 'ti ti-messages', label: 'メッセージ', group: 'basic' });
			changed = true;
		}
		// reload を more の直後 (なければ末尾) に追加
		if (!has('reload')) {
			const moreIdx = current.findIndex(i => i && i.id === 'more');
			const insertAt = moreIdx >= 0 ? moreIdx + 1 : current.length;
			current.splice(insertAt, 0, { id: 'reload', icon: 'ti ti-refresh', label: 'リロード', group: 'more' });
			changed = true;
		}
		if (changed) preferSb5.commit('simpleUi.sidebar', current);
		miLocalStorage.setItem('hata_sidebar_v5_migrated', '1');
	}

	// 旗鯖fork(v6): Hatady(学習・読書記録)を hatafeed の直後 (なければ hata グループ末尾/全体末尾) に追加。
	//   設計指針通り insertAfter 方式 (既存にない id だけ追加)。ユーザーが非表示にしていれば復活させない。
	if (!miLocalStorage.getItem('hata_sidebar_v6_migrated')) {
		const { prefer: preferSb6 } = await import('@/preferences.js');
		const current = [...(preferSb6.s['simpleUi.sidebar'] ?? [])];
		if (!current.some(i => i && i.id === 'hatady')) {
			const afterIdx = current.findIndex(i => i && i.id === 'hatafeed');
			const insertAt = afterIdx >= 0 ? afterIdx + 1 : current.length;
			current.splice(insertAt, 0, { id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', group: 'hata' });
			preferSb6.commit('simpleUi.sidebar', current);
		}
		miLocalStorage.setItem('hata_sidebar_v6_migrated', '1');
	}

	// 旗鯖fork(#36): Haskホームに「HataFeed通知」「地震・津波」タイルを強制追加(既存ユーザー向け)
	//   registry の hatask scope を直接読み書きする。設定の sectionOrder に新セクションがなければ
	//   末尾に追加して保存。トグル既定はON(showFeedbackNotif/showEarthquake未定義時は表示)。
	if (!miLocalStorage.getItem('hata_hask_tiles_v1_migrated')) {
		try {
			const HATASK_SCOPE = ['client', 'hatask'];
			const { misskeyApi: api } = await import('@/utility/misskey-api.js');
			const cur: any = await api('i/registry/get', { key: 'settings', scope: HATASK_SCOPE }).catch(() => null);
			if (cur) {
				let changed = false;
				if (Array.isArray(cur.sectionOrder)) {
					if (!cur.sectionOrder.includes('feedbackNotif')) { cur.sectionOrder.push('feedbackNotif'); changed = true; }
					if (!cur.sectionOrder.includes('earthquake')) { cur.sectionOrder.push('earthquake'); changed = true; }
				}
				if (cur.showFeedbackNotif === undefined) { cur.showFeedbackNotif = true; changed = true; }
				if (cur.showEarthquake === undefined) { cur.showEarthquake = true; changed = true; }
				if (changed) await api('i/registry/set', { key: 'settings', value: cur, scope: HATASK_SCOPE });
			}
		} catch { /* registry未初期化のユーザーは hatask 初回起動時に defaultSectionOrder で補完される */ }
		miLocalStorage.setItem('hata_hask_tiles_v1_migrated', '1');
	}

	// 旗鯖fork(v7): 「キャッシュをクリア」を reload の直後へ追加。
	// 既存の並び順・表示状態を維持し、まだ存在しない場合だけ追加する。
	if (!miLocalStorage.getItem('hata_sidebar_v7_migrated')) {
		const { prefer: preferSb7 } = await import('@/preferences.js');
		const current = [...(preferSb7.s['simpleUi.sidebar'] ?? [])];
		if (!current.some(i => i && i.id === 'cacheClear')) {
			const reloadIdx = current.findIndex(i => i && i.id === 'reload');
			const moreIdx = current.findIndex(i => i && i.id === 'more');
			const insertAt = reloadIdx >= 0 ? reloadIdx + 1 : moreIdx >= 0 ? moreIdx + 1 : current.length;
			current.splice(insertAt, 0, { id: 'cacheClear', icon: 'ti ti-trash', label: 'キャッシュをクリア', group: 'more' });
			preferSb7.commit('simpleUi.sidebar', current);
		}
		miLocalStorage.setItem('hata_sidebar_v7_migrated', '1');
	}

	// 旗鯖: 「旗鯖機能解説 (hataDocs)」をユーザー設定から自動削除（既存ユーザー向け）
	// hataDocs は navbar 定義から削除済みだが、過去にサイドバーや「もっと!」候補に
	// 残っているケースがあるため、保存済みのユーザー設定からも除去する
	if (!miLocalStorage.getItem('hata_docs_cleanup_migrated')) {
		const { prefer: preferDocsCleanup } = await import('@/preferences.js');

		// 1. navbar メニュー (prefer.s.menu) から 'hataDocs' を削除
		const currentMenu = [...(preferDocsCleanup.s.menu ?? [])];
		const filteredMenu = currentMenu.filter(item => item !== 'hataDocs');
		if (filteredMenu.length !== currentMenu.length) {
			preferDocsCleanup.commit('menu', filteredMenu);
		}

		// 2. SimpleUI サイドバー (prefer.s['simpleUi.sidebar']) からも念のため削除
		const currentSidebar = [...(preferDocsCleanup.s['simpleUi.sidebar'] ?? [])];
		const filteredSidebar = currentSidebar.filter(i => !(i && i.id === 'hataDocs'));
		if (filteredSidebar.length !== currentSidebar.length) {
			preferDocsCleanup.commit('simpleUi.sidebar', filteredSidebar);
		}

		miLocalStorage.setItem('hata_docs_cleanup_migrated', '1');
	}

	// 旗鯖fork: CherryPick 支援関連メニュー (support) をサイドバー / メニューから自動削除
	// 旗鯖fork では支援関連の導線はサーバーアイコン → サーバー情報(about-misskey)に集約しているため、
	// サイドバー / 「もっと」メニュー / SimpleUI サイドバーの全所から 'support' を除去する。
	if (!miLocalStorage.getItem('hata_support_cleanup_migrated')) {
		const { prefer: preferSupportCleanup } = await import('@/preferences.js');

		// 1. navbar メニュー (prefer.s.menu) から 'support' を削除
		const currentMenu = [...(preferSupportCleanup.s.menu ?? [])];
		const filteredMenu = currentMenu.filter(item => item !== 'support');
		if (filteredMenu.length !== currentMenu.length) {
			preferSupportCleanup.commit('menu', filteredMenu);
		}

		// 2. SimpleUI サイドバー (prefer.s['simpleUi.sidebar']) からも削除
		const currentSidebar = [...(preferSupportCleanup.s['simpleUi.sidebar'] ?? [])];
		const filteredSidebar = currentSidebar.filter(i => !(i && i.id === 'support'));
		if (filteredSidebar.length !== currentSidebar.length) {
			preferSupportCleanup.commit('simpleUi.sidebar', filteredSidebar);
		}

		miLocalStorage.setItem('hata_support_cleanup_migrated', '1');
	}

	// 初期同期を待つ清掃は起動を止めずに行う。取得・保存失敗時には完了印を付けない。
	const { migrateHataskeyDefaultSounds } = await import('@/utility/hataskey-sound-migration.js');
	void migrateHataskeyDefaultSounds(prefer, miLocalStorage).catch(() => {
		console.warn('[hataskey-sound-migration] 設定の取得・保存に失敗したため、次回起動時に再試行します');
	});
	const { migrateRetiredPortalMenu } = await import('@/utility/retired-portal-migration.js');
	const { migrateHatagoesBottomNav } = await import('@/utility/hatagoes-bottom-nav-migration.js');
	void migrateHatagoesBottomNav(prefer).catch(() => {
		console.warn('[hatagoes-bottom-nav-migration] 設定の取得・保存に失敗したため、次回起動時に再試行します');
	});
	const { migrateExternalNotificationsSidebar } = await import('@/utility/external-notifications-sidebar-migration.js');
	const { migrateHatagoesSidebar } = await import('@/utility/hatagoes-sidebar-migration.js');
	const repairExternalNotificationsSidebar = async () => {
		try {
			await migrateExternalNotificationsSidebar(prefer, miLocalStorage, $i?.id ?? 'guest');
		} catch {
			console.warn('[external-notifications-sidebar-migration] 設定の取得・保存に失敗したため、次回同期時に再試行します');
		}
	};
	const repairHatagoesSidebar = async () => {
		try {
			await migrateHatagoesSidebar(prefer);
		} catch {
			console.warn('[hatagoes-sidebar-migration] 設定の取得・保存に失敗したため、次回同期時に再試行します');
		}
	};
	// 保存操作を直列化し、初回修復の進行中に届いた同期更新も取りこぼさない。
	let pendingSidebarRepair = migrateRetiredPortalMenu(prefer, miLocalStorage, $i?.id ?? 'guest')
		.catch(() => {
			console.warn('[portal-migration] 設定の取得・保存に失敗したため、次回起動時に再試行します');
		})
		.then(repairExternalNotificationsSidebar)
		.then(repairHatagoesSidebar);
	watch([prefer.r.menu, prefer.r['simpleUi.sidebar']], () => {
		pendingSidebarRepair = pendingSidebarRepair.then(repairExternalNotificationsSidebar).then(repairHatagoesSidebar);
	}, { deep: true });

	if (instance.swPublickey && ('PushManager' in window) && $i && $i.token && showPushNotificationDialog == null) {
		const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkPushNotification.vue')), {}, {
			closed: () => dispose(),
		});
	}

	//#region クライアントが更新されたかチェック
	const lastVersion = miLocalStorage.getItem('lastVersion');
	const lastBasedMisskeyVersion = miLocalStorage.getItem('lastBasedMisskeyVersion');
	if (lastVersion !== version || lastBasedMisskeyVersion !== basedMisskeyVersion) {
		if (lastVersion == null) miLocalStorage.setItem('lastVersion', version);
		else {
			try { // 変なバージョン文字列(別系統フォークからの移行等)でcompareVersionsがエラーになるのを防ぐ
				if (compareVersions(version, lastVersion) === 0 || compareVersions(version, lastVersion) === 1) miLocalStorage.setItem('lastVersion', version);
			} catch (err) {
				// lastVersion が不正なsemver = 別系統からの移行とみなし、現在バージョンで上書き
				miLocalStorage.setItem('lastVersion', version);
			}
		}
		miLocalStorage.setItem('lastBasedMisskeyVersion', basedMisskeyVersion);

		try { // 変なバージョン文字列来るとcompareVersionsでエラーになるため
			if ((lastVersion != null && compareVersions(version, lastVersion) === 1) || (lastBasedMisskeyVersion != null && compareVersions(basedMisskeyVersion, lastBasedMisskeyVersion) === 1)) {
				isClientUpdated = true;
			} else if (lastVersion != null && compareVersions(version, lastVersion) === -1) isClientMigrated = true;
		} catch (err) { /* empty */ }
	}
	//#endregion

	// 旗鯖fork(hata-12.0): 外部アカウント連携から撤去した旗池3丁目・シュリンピアについて、
	// 設定同期の読込後にログイン情報と端末内キャッシュを削除する。
	// 廃止ホストは external-api 側でも拒否するため、移行途中に通信が再開することはない。
	await import('@/utility/external-account-migration.js')
		.then(({ migrateRetiredExternalAccount }) => migrateRetiredExternalAccount())
		.catch(err => console.error('[external-account-migration] Failed to purge retired host data:', err));

	//#region Detect language & fetch translations
	storeBootloaderErrors({ ...i18n.ts._bootErrors, reload: i18n.ts.reload });

	if (import.meta.hot) {
		import.meta.hot.on('locale-update', async (updatedLang: string) => {
			console.info(`Locale updated: ${updatedLang}`);
			if (updatedLang === lang) {
				await new Promise(resolve => {
					window.setTimeout(resolve, 500);
				});
				// fetch with cache: 'no-store' to ensure the latest locale is fetched
				await window.fetch(`/assets/locales/${lang}.${version}.json`, { cache: 'no-store' }).then(async res => res.status === 200 && await res.text());
				window.location.reload();
			}
		});
	}
	//#endregion

	// タッチデバイスでCSSの:hoverを機能させる
	window.document.addEventListener('touchend', () => {}, { passive: true });

	// URLに#pswpを含む場合は取り除く
	if (window.location.hash === '#pswp') {
		window.history.replaceState(null, '', window.location.href.replace('#pswp', ''));
	}

	// 一斉リロード
	reloadChannel.addEventListener('message', path => {
		if (path !== null) window.location.href = path;
		else window.location.reload();
	});

	// If mobile, insert the viewport meta tag
	if (['smartphone', 'tablet'].includes(deviceKind)) {
		const viewport = window.document.getElementsByName('viewport').item(0);
		viewport.setAttribute('content',
			`${viewport.getAttribute('content')}, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`);
	}

	//#region Set lang attr
	const html = window.document.documentElement;
	html.setAttribute('lang', lang);
	//#endregion

	await store.ready;
	await deckStore.ready;

	const fetchInstanceMetaPromise = fetchInstance();

	fetchInstanceMetaPromise.then(() => {
		miLocalStorage.setItem('v', instance.version);
		miLocalStorage.setItem('basedMisskeyVersion', instance.basedMisskeyVersion);
	});

	//#region loginId
	const params = new URLSearchParams(window.location.search);
	const loginId = params.get('loginId');

	if (loginId) {
		const target = getUrlWithoutLoginId(window.location.href);

		if (!$i || $i.id !== loginId) {
			const account = await getAccountFromId(loginId);
			if (account) {
				await login(account.token, target);
			}
		}

		window.history.replaceState({ cherrypick: 'loginId' }, '', target);
	}
	//#endregion

	//#region Sync dark mode
	if (prefer.s.syncDeviceDarkMode) {
		store.set('darkMode', isDeviceDarkmode());
	}

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (mql) => {
		if (prefer.s.syncDeviceDarkMode) {
			store.set('darkMode', mql.matches);
		}
	});
	//#endregion

	// NOTE: この処理は必ずクライアント更新チェック処理より後に来ること(テーマ再構築のため)
	// NOTE: この処理は必ずダークモード判定処理より後に来ること(初回のテーマ適用のため)
	// see: https://github.com/misskey-dev/misskey/issues/16562
	watch(store.r.darkMode, (darkMode) => {
		const theme = (() => {
			if (darkMode) {
				return isSafeMode ? defaultDarkTheme : (prefer.s.darkTheme ?? defaultDarkTheme);
			} else {
				return isSafeMode ? defaultLightTheme : (prefer.s.lightTheme ?? defaultLightTheme);
			}
		})();

		applyTheme(theme);
	}, { immediate: true });

	window.document.documentElement.dataset.colorScheme = store.s.darkMode ? 'dark' : 'light';

	if (!isSafeMode) {
		const darkTheme = prefer.model('darkTheme');
		const lightTheme = prefer.model('lightTheme');

		watch(darkTheme, (theme) => {
			if (store.s.darkMode) {
				applyTheme(theme ?? defaultDarkTheme);
			}
		});

		watch(lightTheme, (theme) => {
			if (!store.s.darkMode) {
				applyTheme(theme ?? defaultLightTheme);
			}
		});

		fetchInstanceMetaPromise.then(() => {
			// TODO: instance.defaultLightTheme/instance.defaultDarkThemeが不正な形式だった場合のケア
			if (prefer.s.lightTheme == null && instance.defaultLightTheme != null) prefer.commit('lightTheme', JSON.parse(instance.defaultLightTheme));
			if (prefer.s.darkTheme == null && instance.defaultDarkTheme != null) prefer.commit('darkTheme', JSON.parse(instance.defaultDarkTheme));
		});
	}

	watch(prefer.r.overridedDeviceKind, (kind) => {
		updateDeviceKind(kind);
	}, { immediate: true });

	watch(prefer.r.useBlurEffectForModal, v => {
		window.document.documentElement.style.setProperty('--MI-modalBgFilter', v ? 'blur(4px)' : 'none');
	}, { immediate: true });

	watch(prefer.r.useBlurEffect, v => {
		if (v) {
			window.document.documentElement.style.removeProperty('--MI-blur');
		} else {
			window.document.documentElement.style.setProperty('--MI-blur', 'none');
		}
	}, { immediate: true });

	// Keep screen on
	const onVisibilityChange = () => window.document.addEventListener('visibilitychange', () => {
		if (window.document.visibilityState === 'visible') {
			navigator.wakeLock.request('screen');
		}
	});
	if (prefer.s.keepScreenOn && 'wakeLock' in navigator) {
		navigator.wakeLock.request('screen')
			.then(onVisibilityChange)
			.catch(() => {
				// On WebKit-based browsers, user activation is required to send wake lock request
				// https://webkit.org/blog/13862/the-user-activation-api/
				window.document.addEventListener(
					'click',
					() => navigator.wakeLock.request('screen').then(onVisibilityChange),
					{ once: true },
				);
			});
	}

	if (prefer.s.makeEveryTextElementsSelectable) {
		window.document.documentElement.classList.add('forceSelectableAll');
	}

	// 旗鯖fork(Hataskey UI 2): `simpleUi.profileNoBannerBg` を <html> のクラス
	// (`hataProfileNoBannerBg`) にブリッジする。プロフィールページの CSS が
	// `html.hataGlassUi.hataProfileNoBannerBg` セレクタで機能を切替する。
	// preferences reactive を watch して即時反映 (別端末での変更もこの端末に伝播する)。
	{
		const applyProfileNoBannerBg = (v: boolean) => {
			window.document.documentElement.classList.toggle('hataProfileNoBannerBg', v);
		};
		applyProfileNoBannerBg(prefer.r['simpleUi.profileNoBannerBg']?.value ?? false);
		const { watch } = await import('vue');
		watch(prefer.r['simpleUi.profileNoBannerBg'], v => applyProfileNoBannerBg(!!v), { immediate: false });
	}

	// 旗鯖fork(Hataskey UI 2): `simpleUi.glassUiCardOpacity` (0-100) を CSS 変数
	// `--htk-glass-card-opacity` (パーセント値) として <html> に注入する。
	// MkStreamingNotesTimeline のノートカード面が `color-mix` の中でこの変数を消費する。
	{
		const applyOpacity = (v: unknown) => {
			const raw = typeof v === 'number' ? v : Number(v);
			const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 55;
			window.document.documentElement.style.setProperty('--htk-glass-card-opacity', clamped + '%');
		};
		applyOpacity(prefer.r['simpleUi.glassUiCardOpacity']?.value ?? 55);
		const { watch } = await import('vue');
		watch(prefer.r['simpleUi.glassUiCardOpacity'], v => applyOpacity(v), { immediate: false });
	}

	//#region Fetch user
	if ($i && $i.token) {
		if (_DEV_) {
			console.log('account cache found. refreshing...');
		}

		refreshCurrentAccount();
	}
	//#endregion

	try {
		await fetchCustomEmojis();
	} catch (err) { /* empty */ }

	// analytics
	fetchInstanceMetaPromise.then(async () => {
		await initAnalytics(instance);

		if ($i) {
			analytics.identify($i.id);
		}

		analytics.page({
			path: window.location.pathname,
		});
	});

	const app = await createVue();

	if (_DEV_) {
		app.config.performance = true;
	}

	widgets(app);
	directives(app);
	components(app);

	// https://github.com/misskey-dev/misskey/pull/8575#issuecomment-1114239210
	// なぜか2回実行されることがあるため、mountするdivを1つに制限する
	const rootEl = ((): HTMLElement => {
		const CHERRYPICK_MOUNT_DIV_ID = 'cherrypick_app';

		const currentRoot = window.document.getElementById(CHERRYPICK_MOUNT_DIV_ID);

		if (currentRoot) {
			console.warn('multiple import detected');
			return currentRoot;
		}

		const root = window.document.createElement('div');
		root.id = CHERRYPICK_MOUNT_DIV_ID;
		window.document.body.appendChild(root);
		return root;
	})();

	await initTelemetry(instance, app);

	try {
		await launchPlugins();
	} catch (error) {
		console.error('Failed to launch plugins:', error);
	}

	app.mount(rootEl);

	// boot.jsのやつを解除
	window.onerror = null;
	window.onunhandledrejection = null;

	removeSplash();

	//#region Self-XSS 対策メッセージ
	if (!_DEV_) {
		console.log(
			`%c${i18n.ts._selfXssPrevention.warning}`,
			'color: #f00; background-color: #ff0; font-size: 36px; padding: 4px;',
		);
		console.log(
			`%c${i18n.ts._selfXssPrevention.title}`,
			'color: #f00; font-weight: 900; font-family: "Hiragino Sans W9", "Hiragino Kaku Gothic ProN", sans-serif; font-size: 24px;',
		);
		console.log(
			`%c${i18n.ts._selfXssPrevention.description1}`,
			'font-size: 16px; font-weight: 700;',
		);
		console.log(
			`%c${i18n.ts._selfXssPrevention.description2}`,
			'font-size: 16px;',
			'font-size: 20px; font-weight: 700; color: #f00;',
		);
		console.log(
			`%c${i18n.tsx._selfXssPrevention.description3({ link: 'https://github.com/tolehata/hataskey' })}`,
			'font-size: 14px;',
		);
		console.log(i18n.tsx._selfXssPrevention.description4({ link: 'https://misskey-hub.net/docs/for-users/resources/self-xss/' }));
	}
	//#endregion

	return {
		isClientUpdated,
		isClientMigrated,
		lastVersion,
		app,
	};
}

function removeSplash() {
	const splash = window.document.getElementById('splash');
	if (splash) {
		splash.style.opacity = '0';
		splash.style.pointerEvents = 'none';

		// transitionendイベントが発火しない場合があるため
		window.setTimeout(() => {
			splash.remove();
		}, 1000);
	}
}
