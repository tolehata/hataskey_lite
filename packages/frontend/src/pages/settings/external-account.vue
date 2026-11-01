<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/external-account" :label="accountCopy.title" :keywords="externalAccountKeywords" icon="ti ti-link">
	<div class="hatady-scope concrnt-ui" data-hatady-theme="hataskey" data-connection-settings>
		<div class="connection-settings">
			<header class="connection-header">
				<span class="connection-mark"><i class="ti ti-link" aria-hidden="true"></i></span>
				<div><span class="connection-eyebrow">{{ localInstanceName }} / {{ i18n.ts.settings }}</span><h1>{{ accountCopy.title }}</h1></div>
			</header>
			<nav class="connection-nav" :aria-label="accountCopy.title">
				<HyCapsule v-model="section" :options="sections" :label="accountCopy.title"/>
			</nav>

			<template v-if="section === 'account'">
				<section class="connection-card">
					<div v-if="isLinked" class="connection-identity">
						<img v-if="externalAvatarUrl" :src="externalAvatarUrl" class="connection-avatar" alt=""/>
						<span v-else class="connection-avatar"><i class="ti ti-user" aria-hidden="true"></i></span>
						<div class="connection-identity-text"><strong>@{{ externalUsername }}</strong><ConcrntServerIdentity :server="linkedServer" fallbackIcon="ti ti-server"/></div>
						<span class="connection-status" :data-muted="!externalEnabled">{{ externalEnabled ? accountCopy.linked : '一時停止中' }}</span>
					</div>
					<h2 v-else><i class="ti ti-user" aria-hidden="true"></i>{{ accountCopy.linkSection }}</h2>
					<p class="connection-description">{{ accountCopy.introduction }}</p>
					<label class="connection-row">
						<span><strong>{{ accountCopy.enable }}</strong><small>連携情報を残したまま、表示・投稿への利用を切り替えます。通知は別に設定できます。</small></span>
						<span class="connection-switch"><input type="checkbox" role="switch" :aria-label="accountCopy.enable" :checked="externalEnabled" @change="onEnabledChange"/></span>
					</label>
					<template v-if="externalEnabled && !isLinked">
						<fieldset class="connection-servers" :disabled="linking">
							<legend class="connection-field">{{ accountCopy.destination }}</legend>
							<label v-for="option in hostOptions" :key="option.value" class="connection-server-choice" :data-active="selectedHost === option.value || undefined">
								<input v-model="selectedHost" type="radio" name="external-server" :value="option.value"/>
								<ConcrntServerIdentity :server="serverInfo(option.value)" fallbackIcon="ti ti-server"/>
								<i v-if="selectedHost === option.value" class="ti ti-check" aria-hidden="true"></i>
							</label>
						</fieldset>
						<p class="connection-description">{{ accountCopy.chooseServer }}</p>
						<div class="connection-actions"><button type="button" class="hy-primary" :disabled="linking || !selectedHost" @click="startMiAuth"><i class="ti ti-link" aria-hidden="true"></i>{{ linking ? accountCopy.linking : accountCopy.linkAction }}</button></div>
					</template>
					<div v-if="isLinked" class="connection-actions"><button type="button" class="hy-secondary connection-danger" @click="unlinkAccount"><i class="ti ti-unlink" aria-hidden="true"></i>{{ accountCopy.unlink }}</button></div>
				</section>
				<section v-if="isLinked" class="connection-card">
					<h2><i class="ti ti-server" aria-hidden="true"></i>連携先について</h2>
					<div class="connection-row" data-stack="true"><span><strong>{{ accountCopy.destination }}</strong><small>MiAuthで連携した外部アカウントです。</small></span><ConcrntServerIdentity :server="linkedServer" fallbackIcon="ti ti-server"/></div>
					<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>接続先を変更するときは、現在の連携を解除してから連携し直します。コンカレント連携は独立した設定です。</span></p>
				</section>
			</template>

			<template v-if="section === 'display' && externalEnabled && isLinked">
				<section class="connection-card">
					<h2><i class="ti ti-layout-list" aria-hidden="true"></i>{{ accountCopy.timelineSettings }}</h2>
					<label class="connection-row"><span><strong>{{ accountCopy.showOhtl }}</strong><small>{{ accountCopy.ohtlDescription }}</small></span><span class="connection-switch"><input type="checkbox" role="switch" :aria-label="accountCopy.showOhtl" :checked="enableOHTL" @change="onTimelineChange('external.enableOHTL', $event)"/></span></label>
					<label class="connection-row"><span><strong>{{ accountCopy.showOltl }}</strong><small>{{ accountCopy.oltlDescription }}</small></span><span class="connection-switch"><input type="checkbox" role="switch" :aria-label="accountCopy.showOltl" :checked="enableOLTL" @change="onTimelineChange('external.enableOLTL', $event)"/></span></label>
				</section>
			</template>

			<section v-if="section === 'notifications' && externalEnabled && isLinked" class="connection-card">
				<h2><i class="ti ti-bell" aria-hidden="true"></i>{{ i18n.ts._hata._common.externalNotifications }}</h2>
				<label class="connection-row"><span><strong>{{ accountCopy.disableNotificationPopup }}</strong><small>{{ accountCopy.disableNotificationPopupDescription }}</small></span><span class="connection-switch"><input type="checkbox" role="switch" :aria-label="accountCopy.disableNotificationPopup" :checked="disableNotificationToast" @change="onNotificationChange"/></span></label>
				<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>オンにすると、ポップアップ・リアルタイム接続・通知バッジの更新を停止します。コンカレントの通知設定とは別に管理します。</span></p>
				<div class="connection-actions"><MkA class="hy-secondary" to="/my/external-notifications"><i class="ti ti-bell" aria-hidden="true"></i>外部通知を開く</MkA></div>
			</section>

			<template v-if="section === 'data' && externalEnabled">
				<section v-if="isLinked" class="connection-card">
					<h2><i class="ti ti-star" aria-hidden="true"></i>{{ accountCopy.favoriteEmojiSection }}</h2>
					<p class="connection-description">{{ accountCopy.favoriteEmojiDescription }}</p>
					<div v-if="extFavEmojis.length" class="connection-emojis">
						<div v-for="(emoji, idx) in extFavEmojis" :key="emoji + idx" class="connection-emoji">
							<img v-if="emoji.startsWith(':') && getCustomEmojiUrl(emoji)" :src="getCustomEmojiUrl(emoji)" :alt="emoji"/>
							<span v-else>{{ emoji }}</span>
							<button type="button" :aria-label="`${emoji}をお気に入りから削除`" @click="removeExtFavEmoji(idx)"><i class="ti ti-x" aria-hidden="true"></i></button>
						</div>
					</div>
					<p v-else class="connection-note">{{ accountCopy.noFavoriteEmoji }}</p>
					<div class="connection-actions">
						<button type="button" class="hy-secondary" @click="addExtFavEmojiFromPicker"><i class="ti ti-plus" aria-hidden="true"></i>{{ accountCopy.addEmoji }}</button>
						<button v-if="extFavEmojis.length" type="button" class="hy-secondary connection-danger" @click="clearExtFavEmojis"><i class="ti ti-trash" aria-hidden="true"></i>{{ accountCopy.deleteAll }}</button>
					</div>
					<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>{{ accountCopy.favoriteEmojiInteraction }}</span></p>
				</section>
				<section class="connection-card">
					<h2><i class="ti ti-photo" aria-hidden="true"></i>{{ accountCopy.emojiCacheSection }}</h2>
					<p class="connection-description">{{ accountCopy.emojiCacheIntroduction }} {{ accountCopy.emojiCachePurpose }}</p>
					<div class="connection-actions"><button type="button" class="hy-secondary" @click="clearEmojiCache"><i class="ti ti-trash" aria-hidden="true"></i>{{ accountCopy.clearCache }}</button></div>
					<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span><strong>{{ accountCopy.historyKeptTitle }}</strong> {{ accountCopy.historyKeptDescription }}</span></p>
					<details class="connection-details">
						<summary>{{ accountCopy.cacheStoredTitle }}</summary>
						<ul><li>{{ accountCopy.cacheUrlListBefore }} <strong>{{ accountCopy.cacheUrlListName }}</strong>{{ accountCopy.cacheUrlListAfter }}</li><li>{{ accountCopy.cacheServerLimitBefore }} <strong>{{ accountCopy.cacheServerLimitValue }}</strong>{{ accountCopy.cacheServerLimitAfter }}</li><li>{{ accountCopy.cacheDurationBefore }} <strong>{{ accountCopy.cacheDurationValue }}</strong>{{ accountCopy.cacheDurationAfter }}</li></ul>
						<strong>{{ accountCopy.cacheClearTitle }}</strong><ul><li>{{ accountCopy.cacheClearAll }}</li><li>{{ accountCopy.cacheReloadNext }}</li></ul>
						<strong>{{ accountCopy.cacheUseTitle }}</strong><ul><li>{{ accountCopy.cacheUseStale }}</li><li>{{ accountCopy.cacheUseDeleted }}</li><li>{{ accountCopy.cacheUsePrivacy }}</li></ul>
					</details>
				</section>
			</template>

			<section v-if="section !== 'account' && (!externalEnabled || (!isLinked && section !== 'data'))" class="connection-card connection-empty">
				<i class="ti ti-link" aria-hidden="true"></i><h2>{{ accountCopy.linkSection }}</h2>
				<p class="connection-description">アカウントの連携を有効にすると、この設定を利用できます。</p>
				<div class="connection-actions"><button type="button" class="hy-primary" @click="section = 'account'">アカウント設定へ</button></div>
			</section>
		</div>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent, onMounted, reactive, watch } from 'vue';
import HyCapsule from '@/components/HyCapsule.vue';
import ConcrntServerIdentity from '@/components/concrnt/ConcrntServerIdentity.vue';
import { fetchExternalServerInfo } from '@/utility/external-server-info.js';
import type { ExternalServerInfo } from '@/utility/external-server-info.js';
import '@/components/concrnt/concrnt-ui.css';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { genId } from '@/utility/id.js';
import { hostname, instanceName } from '@@/js/config.js';
import { getExternalFavoriteEmojis, setExternalFavoriteEmojis, removeExternalFavoriteEmoji, getExternalCustomEmojis, clearExternalEmojiCache, isAllowedExternalHost } from '@/utility/external-api.js';
import type { ExternalCustomEmoji } from '@/utility/external-api.js';
import { i18n } from '@/i18n.js';

const MkExternalReactionPicker = defineAsyncComponent(() => import('@/components/MkExternalReactionPicker.vue'));
const accountCopy = i18n.ts._hata._externalAccount;
const accountCopyx = i18n.tsx._hata._externalAccount;
const externalAccountKeywords = ['external', 'ohtl', 'oltl', 'timeline', accountCopy.searchKeyword];
const localInstanceName = computed(() => instance.name || instanceName);
const section = ref('account');
const sections = [
	{ value: 'account', label: 'アカウント', icon: 'ti ti-user' },
	{ value: 'display', label: '表示・投稿', icon: 'ti ti-layout-list' },
	{ value: 'notifications', label: '通知', icon: 'ti ti-bell' },
	{ value: 'data', label: '絵文字・データ', icon: 'ti ti-database' },
];

function onEnabledChange(event: Event) {
	onToggleEnabled((event.target as HTMLInputElement).checked);
}

function onTimelineChange(key: 'external.enableOHTL' | 'external.enableOLTL', event: Event) {
	prefer.commit(key, (event.target as HTMLInputElement).checked);
}

async function onNotificationChange(event: Event) {
	await prefer.commit('external.disableNotificationToast', (event.target as HTMLInputElement).checked);
	await onDisableNotifToastChange();
}

const externalEnabled = prefer.model('external.enabled');
const externalHost = prefer.model('external.host');
const externalToken = prefer.model('external.token');
const externalUserId = prefer.model('external.userId');
const externalUsername = prefer.model('external.username');
const externalAvatarUrl = prefer.model('external.avatarUrl');
const enableOHTL = prefer.model('external.enableOHTL');
const enableOLTL = prefer.model('external.enableOLTL');
// 旗鯖fork: 外部通知のトースト無効化トグル (ON時はWSも接続しない)
const disableNotificationToast = prefer.model('external.disableNotificationToast');

// トグル切替時にWSストリームを再起動 (ON→OFF: 接続開始、OFF→ON: 切断)
async function onDisableNotifToastChange() {
	const { restartExternalNotificationStream } = await import('@/utility/external-notification-stream.js');
	restartExternalNotificationStream();
}

const linking = ref(false);

const isLinked = computed(() => {
	return externalToken.value != null && externalUserId.value != null;
});

// ===== 接続先候補 =====
// 現在のインスタンスに応じて、接続先候補を動的に生成
const HATACHI_2 = 'misskey.hatachanoima.net';
// 旗鯖fork: 外部サーバー(旗鯖以外。接続先の規約が適用される)
const LES_REQUIN = 'mi.les-requin.net';
const KIGOTEI = 'ddoskey.com';
const BEARBEAR = 'xiapopisland.top';
const JUICE_SERVER = 'mk-juice.dev';
const YUUSKY = 'yugure.hata.blog';

const hostOptions = computed(() => {
	const options: { value: string; label: string }[] = [];
	const currentHost = hostname;

	// 旗池2丁目（自分自身でなければ追加）
	if (currentHost !== HATACHI_2) {
		options.push({ value: HATACHI_2, label: `旗池2丁目 (${HATACHI_2})` });
	}

	// 旗鯖fork: さめすきーとチョリソリング(外部サーバー。接続先の規約が適用される)
	if (currentHost !== LES_REQUIN) {
		options.push({ value: LES_REQUIN, label: `さめすきーとチョリソリング (${LES_REQUIN})` });
	}

	// 旗鯖fork: 㐂五亭（Sharkey。Misskey互換APIとMiAuthを利用）
	if (currentHost !== KIGOTEI) {
		options.push({ value: KIGOTEI, label: `㐂五亭 (${KIGOTEI})` });
	}

	if (currentHost !== BEARBEAR) {
		options.push({ value: BEARBEAR, label: `BearBear (${BEARBEAR})` });
	}

	if (currentHost !== JUICE_SERVER) {
		options.push({ value: JUICE_SERVER, label: `Juice Server (${JUICE_SERVER})` });
	}

	if (currentHost !== YUUSKY) {
		options.push({ value: YUUSKY, label: `ゆうすきー (${YUUSKY})` });
	}

	return options;
});

const selectedHost = ref(hostOptions.value.length > 0 ? hostOptions.value[0].value : '');

// 旗鯖fork: 接続先はURLではなく、サーバーが公開している名前とアイコンで示す（コンカレント連携と同じ表示）。
const serverInfos = reactive<Record<string, ExternalServerInfo>>({});
const knownServerName = (host: string) => hostOptions.value.find(option => option.value === host)?.label.replace(/\s*\([^)]*\)$/u, '');

function serverInfo(host: string): ExternalServerInfo {
	return serverInfos[host] ?? { domain: host, name: knownServerName(host) ?? host };
}

function loadServerInfo(host: string | null | undefined): void {
	if (!host || serverInfos[host]) return;
	void fetchExternalServerInfo(host, knownServerName(host)).then(info => { serverInfos[host] = info; });
}

const linkedServer = computed(() => serverInfo(externalHost.value ?? ''));
watch(externalHost, host => loadServerInfo(host), { immediate: true });
watch(() => externalEnabled.value && !isLinked.value, choosing => { if (choosing) for (const option of hostOptions.value) loadServerInfo(option.value); }, { immediate: true });

// 選択中のホストが旗鯖かどうか
function isHataSaba(host: string): boolean {
	return host === HATACHI_2;
}

// ===== 有効化トグル =====
async function onToggleEnabled(newValue: boolean) {
	if (newValue) {
		externalEnabled.value = true;
	} else {
		externalEnabled.value = false;
	}
}

// ===== MiAuth =====
async function startMiAuth() {
	const host = selectedHost.value;
	if (!host || !isAllowedExternalHost(host)) return;

	// 接続先に応じた免責事項ポップアップを表示
	if (isHataSaba(host)) {
		// 旗鯖同士の場合
		const { canceled, result } = await os.actions({
			type: 'info',
			title: accountCopy.hataLinkTitle,
			text: accountCopy.hataLinkDescription,
			actions: [
				{ value: 'ok', text: accountCopy.startLink, primary: true },
				{ value: 'cancel', text: accountCopy.cancel },
			],
		});
		if (canceled || result === 'cancel') return;
	} else {
		// 旗鯖以外の外部サーバーの場合
		const { canceled, result } = await os.actions({
			type: 'warning',
			title: accountCopy.externalDisclaimerTitle,
			text: accountCopyx.externalDisclaimer({ host }),
			actions: [
				{ value: 'ok', text: accountCopy.understoodStart, primary: true },
				{ value: 'cancel', text: accountCopy.notNow },
			],
		});
		if (canceled || result === 'cancel') return;
	}

	linking.value = true;

	try {
		const sessionId = genId();
		const callbackUrl = `${window.location.origin}/settings/external-account?miauth=${sessionId}`;
		const permissions = ['read:account', 'read:following', 'write:notes', 'write:reactions', 'read:notifications'].join(',');

		const miAuthUrl = `https://${host}/miauth/${sessionId}?name=${encodeURIComponent(accountCopy.miAuthApplicationName)}&callback=${encodeURIComponent(callbackUrl)}&permission=${permissions}`;

		localStorage.setItem('miauth_session', sessionId);
		localStorage.setItem('miauth_host', host);

		externalHost.value = host;
		window.location.href = miAuthUrl;
	} catch (err) {
		console.error('MiAuth error:', err);
		os.alert({ type: 'error', text: accountCopy.startFailed });
		linking.value = false;
	}
}

async function unlinkAccount() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: accountCopy.unlinkConfirm,
	});

	if (canceled) return;

	externalToken.value = null;
	externalUserId.value = null;
	externalUsername.value = null;
	externalAvatarUrl.value = null;

	os.success();
}

// ===== 外部TL お気に入り絵文字管理 =====
const extFavEmojis = ref<string[]>([]);
const extCustomEmojis = ref<ExternalCustomEmoji[]>([]);

function loadExtFavEmojis() {
	extFavEmojis.value = getExternalFavoriteEmojis();
}

function removeExtFavEmoji(index: number) {
	const emoji = extFavEmojis.value[index];
	if (!emoji) return;
	removeExternalFavoriteEmoji(emoji);
	loadExtFavEmojis();
}

function clearExtFavEmojis() {
	setExternalFavoriteEmojis([]);
	loadExtFavEmojis();
}

/**
 * 外部TL絵文字キャッシュをクリア
 * - 現サーバーの絵文字一覧キャッシュ(emojiCache)
 * - ホストごとの絵文字URLマップ(externalEmojiUrlMap)
 * - 履歴/お気に入りは保持(ユーザーの能動的選択履歴のため)
 */
async function clearEmojiCache() {
	const { canceled } = await os.confirm({
		type: 'warning',
		title: accountCopy.clearCacheConfirmTitle,
		text: accountCopy.clearCacheConfirmText,
	});
	if (canceled) return;
	clearExternalEmojiCache();
	os.success();
}

function getCustomEmojiUrl(reaction: string): string {
	const match = reaction.match(/^:([^:]+):$/);
	if (!match) return '';
	const name = match[1];
	const emoji = extCustomEmojis.value.find(e => e.name === name);
	return emoji?.url ?? '';
}

function addExtFavEmojiFromPicker(ev: MouseEvent) {
	// 旗鯖fork: anchorElement を渡してボタン周辺にピッカーを表示する
	// (これがないと画面右サイドや下端にデフォルト位置で表示されてしまう)
	const anchor = ev.currentTarget as HTMLElement;
	const { dispose } = os.popup(MkExternalReactionPicker, {
		anchorElement: anchor,
	}, {
		done: (reaction: string) => {
			if (!reaction) return;
			const list = getExternalFavoriteEmojis().filter(e => e !== reaction);
			list.push(reaction);
			setExternalFavoriteEmojis(list);
			loadExtFavEmojis();
		},
		closed: () => dispose(),
	});
}

// MiAuthコールバック処理
async function handleMiAuthCallback() {
	const url = new URL(window.location.href);
	const sessionParam = url.searchParams.get('miauth');

	if (!sessionParam) return;

	const savedSession = localStorage.getItem('miauth_session');
	const savedHost = localStorage.getItem('miauth_host');

	if (!savedSession || !savedHost || sessionParam !== savedSession || !isAllowedExternalHost(savedHost)) {
		console.error('Invalid MiAuth session');
		localStorage.removeItem('miauth_session');
		localStorage.removeItem('miauth_host');
		return;
	}

	url.searchParams.delete('miauth');
	window.history.replaceState({}, '', url.toString());

	try {
		const res = await window.fetch(`https://${savedHost}/api/miauth/${savedSession}/check`, {
			method: 'POST',
		});

		if (!res.ok) {
			throw new Error('Failed to verify MiAuth');
		}

		const data = await res.json();

		if (!data.ok || !data.token || !data.user) {
			throw new Error('Invalid MiAuth response');
		}

		externalHost.value = savedHost;
		externalToken.value = data.token;
		externalUserId.value = data.user.id;
		externalUsername.value = data.user.username;
		externalAvatarUrl.value = data.user.avatarUrl ?? null;

		localStorage.removeItem('miauth_session');
		localStorage.removeItem('miauth_host');

		// 外部TL同意をサーバーに記録
		prefer.commit('hataConsent.externalTl', true);
		prefer.commit('hataConsent.externalTlDate', new Date().toISOString());
		misskeyApi('hata/consent/update', { type: 'externalTl', agree: true }).catch(console.error);

		os.success();
	} catch (err) {
		console.error('MiAuth callback error:', err);
		os.alert({ type: 'error', text: accountCopy.completeFailed });
	}
}

onMounted(async () => {
	handleMiAuthCallback();
	loadExtFavEmojis();
	if (isLinked.value) {
		// 既存ユーザー対策: 連携済みなのに同意フラグが立っていない場合は自動で記録
		if (!prefer.s['hataConsent.externalTl']) {
			prefer.commit('hataConsent.externalTl', true);
			prefer.commit('hataConsent.externalTlDate', new Date().toISOString());
			misskeyApi('hata/consent/update', { type: 'externalTl', agree: true }).catch(console.error);
		}
		try {
			extCustomEmojis.value = await getExternalCustomEmojis();
		} catch (e) {
			// ignore
		}
	}
});

definePage({
	title: accountCopy.title,
	icon: 'ti ti-link',
});
</script>
