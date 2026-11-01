<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="hatady-scope concrnt-ui" data-hatady-theme="hataskey" data-connection-settings @keydown.esc="onEscape">
	<div class="connection-settings">
		<header class="connection-header">
			<span class="connection-mark"><i class="concrnt-icon" aria-hidden="true"></i></span>
			<div><span class="connection-eyebrow">{{ localInstanceName }} / {{ i18n.ts.settings }}</span><h1>コンカレント連携(BETA)</h1></div>
		</header>
		<nav v-if="step === 0" class="connection-nav" aria-label="コンカレント連携(BETA)の設定">
			<HyCapsule :modelValue="section" :options="sections" label="コンカレント連携(BETA)の設定" @update:modelValue="changeSection"/>
		</nav>
		<p class="connection-live" role="status" aria-live="polite" aria-atomic="true">{{ notice }}</p>
		<p v-if="error" :id="errorId" class="connection-alert" role="alert">{{ error }}</p>
		<p v-else-if="!linked && concrntState.error" class="connection-alert" role="alert">{{ concrntState.error }}</p>
		<p v-if="!concrntState.initialized" class="connection-description" role="status">連携情報を確認しています…</p>

		<section v-if="step !== 0" class="connection-card" :aria-busy="busy">
			<ol class="connection-steps" aria-label="連携の手順">
				<li :aria-current="step === 1 ? 'step' : undefined"><b>1</b>接続先</li>
				<li :aria-current="step === 2 ? 'step' : undefined"><b>2</b>認証</li>
				<li :aria-current="step === 3 ? 'step' : undefined"><b>3</b>確認</li>
			</ol>
			<form v-if="step === 1" @submit.prevent="checkDomain">
				<h2><i class="ti ti-world" aria-hidden="true"></i>接続するドメインを確認</h2>
				<p class="connection-description">利用しているConcrnt v2のドメインを指定してください。</p>
				<label class="connection-field" :for="domainId">接続先ドメイン
					<input :id="domainId" ref="domainInput" v-model="domainDraft" type="text" inputmode="url" autocomplete="off" autocapitalize="off" :spellcheck="false" placeholder="social.example" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? errorId : undefined"/>
				</label>
				<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>接続先へアクセスして、v2と必要な機能への対応を確認します。接続先の利用規約・プライバシーポリシーも確認してください。</span></p>
				<div class="connection-actions"><button type="button" class="hy-secondary" :disabled="busy" @click="cancelLink">戻る</button><button type="submit" class="hy-primary" :disabled="busy || !domainDraft.trim()">{{ busy ? '確認中…' : '接続先を確認' }}<i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
			</form>
			<form v-else-if="step === 2" @submit.prevent="connect">
				<h2><i class="ti ti-key" aria-hidden="true"></i>サブキーで連携</h2>
				<ConcrntServerIdentity v-if="checkedServer" :server="checkedServer"/>
				<p :id="secretHelpId" class="connection-note"><i class="ti ti-lock" aria-hidden="true"></i><span>Concrntの公式クライアントで連携用サブキーを作成し、「サブキーのコピー」で得た文字列全体を貼り付けてください。主鍵・ニーモニックは入力しないでください。サブキーには広い操作権限があるため、この連携専用のものを使用してください。</span></p>
				<label class="connection-field" :for="secretId">コピーしたサブキー
					<input :id="secretId" ref="secretInput" v-model="secretDraft" type="password" autocomplete="off" autocapitalize="off" :spellcheck="false" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? secretHelpId + ' ' + errorId : secretHelpId" @paste="pasteSecret"/>
				</label>
				<fieldset class="connection-choice-group" :disabled="busy">
					<legend>接続情報の保存方法</legend>
					<label class="connection-choice"><input v-model="saveDraft" data-settings-search-key="link-save-device" type="radio" :name="saveGroup" value="device"/><span><strong>この端末に保存（既定）</strong><small>このブラウザで連携を続けて使います。</small></span></label>
					<label class="connection-choice"><input v-model="saveDraft" data-settings-search-key="link-save-session" type="radio" :name="saveGroup" value="session"/><span><strong>端末に保存しない</strong><small>接続情報は今回の利用中だけ保持します。</small></span></label>
				</fieldset>
				<p class="connection-note"><i class="ti ti-device-desktop" aria-hidden="true"></i><span>接続情報はこの{{ localInstanceName }}アカウントに対応付けます。ほかの端末との同期や、設定バックアップには含めません。</span></p>
				<div class="connection-actions"><button type="button" class="hy-secondary" :disabled="busy" @click="backToDomain">接続先へ戻る</button><button type="button" class="hy-secondary" :disabled="busy" @click="cancelLink">キャンセル</button><button type="submit" class="hy-primary" :disabled="busy || !secretDraft.trim()">{{ busy ? '認証を確認中…' : 'このサブキーで連携' }}</button></div>
			</form>
			<div v-else class="connection-empty">
				<i class="ti ti-circle-check" aria-hidden="true"></i><h2>アカウントを連携しました</h2>
				<p class="connection-description">{{ activeProfile?.name || 'Concrnt' }}</p>
				<ConcrntServerIdentity v-if="linkedServer" :server="linkedServer" centered/>
				<dl class="connection-account-id"><dt>アカウントID</dt><dd>{{ concrntState.connection?.ccid }}</dd></dl>
				<div class="connection-actions"><button ref="completedButton" type="button" class="hy-primary" @click="finishLink">設定へ進む<i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
			</div>
		</section>

		<template v-else>
			<div v-if="linked && statusExplanation" class="connection-alert" role="alert">
				<strong>{{ statusLabel }}</strong><p>{{ statusExplanation }}</p>
				<div class="connection-actions"><button type="button" class="hy-secondary" :disabled="busy" @click="concrntState.status === 'reauth' ? beginLink() : recheck()">{{ concrntState.status === 'reauth' ? 'サブキーを入れ直す' : 'もう一度確認' }}</button></div>
			</div>
			<template v-if="section === 'account'">
				<section v-if="!linked" class="connection-card connection-empty">
					<i class="concrnt-icon" aria-hidden="true"></i><h2>コンカレントを連携する</h2>
					<p class="connection-description">Concrnt v2のタイムライン閲覧・投稿・画像・返信・引用・リアクション・通知を利用できます。外部アカウント連携と一緒に使えます。</p>
					<p class="connection-description">この{{ localInstanceName }}アカウントに、1つのConcrntアカウントを連携できます。</p>
					<div class="connection-actions"><button ref="linkButton" type="button" class="hy-primary" :disabled="busy || !concrntState.initialized" @click="beginLink"><i class="ti ti-link" aria-hidden="true"></i>連携を始める</button></div>
				</section>
				<template v-else>
					<section class="connection-card">
						<div class="connection-identity">
							<img v-if="activeProfile?.avatarUrl" :src="activeProfile.avatarUrl" class="connection-avatar" alt=""/>
							<span v-else class="connection-avatar"><i class="ti ti-user" aria-hidden="true"></i></span>
							<div class="connection-identity-text"><strong>{{ activeProfile?.name || 'Concrnt' }}</strong><ConcrntServerIdentity v-if="linkedServer" :server="linkedServer"/></div>
							<span class="connection-status" :data-muted="concrntState.status !== 'connected'">{{ statusLabel }}</span>
						</div>
						<label class="connection-row"><span><strong>コンカレント連携を利用する</strong><small>オフの間は取得・送信を止め、接続情報を残します。</small></span><span class="connection-switch"><input type="checkbox" role="switch" aria-label="コンカレント連携を利用する" :checked="concrntState.settings.enabled" :disabled="busy" @change="updateBoolean('enabled', $event)"/></span></label>
						<p v-if="!concrntState.settings.enabled" class="connection-note"><i class="ti ti-player-pause" aria-hidden="true"></i><span>一時停止中です。オンに戻しても、保留中の投稿を自動送信しません。</span></p>
						<div class="connection-actions"><button type="button" class="hy-secondary" :disabled="busy || !concrntState.settings.enabled" @click="recheck"><i class="ti ti-refresh" aria-hidden="true"></i>接続を確認</button><button type="button" class="hy-secondary connection-danger" :disabled="busy" @click="openConfirmation('unlink', $event)"><i class="ti ti-unlink" aria-hidden="true"></i>この端末の連携を解除</button></div>
						<div v-if="confirmation === 'unlink'" class="connection-confirm" role="group" :aria-labelledby="confirmTitleId">
							<h3 :id="confirmTitleId">この端末の連携を解除しますか？</h3><p class="connection-description">この{{ localInstanceName }}アカウントに対応する連携情報を端末から外します。Concrnt側のアカウントや投稿は削除しません。使用したサブキーの失効は、Concrnt側で別途行ってください。</p>
							<div class="connection-actions"><button ref="cancelConfirmButton" type="button" class="hy-secondary" :disabled="busy" @click="closeConfirmation">やめておく</button><button type="button" class="hy-secondary connection-danger" :disabled="busy" @click="confirmUnlink">連携を解除</button></div>
						</div>
					</section>
					<section class="connection-card">
						<h2><i class="ti ti-shield-check" aria-hidden="true"></i>接続と保存</h2>
						<div class="connection-row" data-stack="true"><span><strong>接続先</strong><small>Concrnt v2</small></span><ConcrntServerIdentity v-if="linkedServer" :server="linkedServer"/></div>
						<dl class="connection-account-id"><dt>アカウントID</dt><dd>{{ concrntState.connection?.ccid }}</dd></dl>
						<fieldset class="connection-choice-group" :disabled="busy">
							<legend>接続情報の保存方法</legend>
							<label class="connection-choice"><input type="radio" aria-label="この端末に保存" :name="saveGroup" value="device" :checked="concrntState.settings.save === 'device'" @change="updateSave('device', $event)"/><span><strong>この端末に保存</strong><small>このブラウザで連携を続けて使います。</small></span></label>
							<label class="connection-choice"><input type="radio" aria-label="端末に保存しない" :name="saveGroup" value="session" :checked="concrntState.settings.save === 'session'" @change="updateSave('session', $event)"/><span><strong>端末に保存しない</strong><small>接続情報は今回の利用中だけ保持します。</small></span></label>
						</fieldset>
						<p class="connection-note"><i class="ti ti-lock" aria-hidden="true"></i><span>ほかの端末との同期や、{{ localInstanceName }}の設定バックアップには含めません。</span></p>
					</section>
				</template>
			</template>

			<template v-else-if="section === 'display' && linked">
				<section class="connection-card">
					<h2><i class="ti ti-user" aria-hidden="true"></i>利用するプロフィール</h2>
					<p class="connection-description">連携するアカウントは1つです。</p>
					<label class="connection-field" :for="profileId">プロフィール<select :id="profileId" aria-label="プロフィール" :value="concrntState.settings.profile" :disabled="busy || !concrntState.profiles.length" @change="updateProfile"><option v-if="!concrntState.profiles.length" :value="concrntState.settings.profile">プロフィールを取得できていません</option><option v-for="profile in concrntState.profiles" :key="profile.id" :value="profile.id">{{ profile.name || profile.id }}</option></select></label>
					<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>同じConcrntアカウント内のプロフィールです。閲覧・投稿・通知の対象を切り替えます。</span></p>
				</section>
				<section class="connection-card">
					<h2><i class="concrnt-icon" aria-hidden="true"></i>この連携で利用する機能</h2>
					<div class="connection-feature"><span><i class="ti ti-layout-list" aria-hidden="true"></i>タイムライン</span><small>閲覧</small></div>
					<div class="connection-feature"><span><i class="ti ti-pencil" aria-hidden="true"></i>投稿</span><small>画像・返信・引用</small></div>
					<div class="connection-feature"><span><i class="ti ti-mood-smile" aria-hidden="true"></i>リアクション</span><small>追加・取り消し</small></div>
					<div class="connection-feature"><span><i class="ti ti-bell" aria-hidden="true"></i>通知</span><small>選択したプロフィール</small></div>
					<details class="connection-details"><summary>引用の表示について</summary><p>コメントと元投稿へのリンクを投稿し、元投稿のリルートに関連付けます。件数や通知はリルートとして扱われます。</p></details>
					<div class="connection-actions"><MkA class="hy-primary" to="/concrnt"><i class="ti ti-arrow-right" aria-hidden="true"></i>コンカレントを開く</MkA></div>
				</section>
			</template>

			<section v-else-if="section === 'notifications' && linked" class="connection-card">
				<h2><i class="ti ti-bell" aria-hidden="true"></i>コンカレントの通知</h2>
				<div class="connection-row" data-stack="true"><span><strong>通知の対象</strong><ConcrntServerIdentity v-if="linkedServer" :server="linkedServer"/></span><span class="connection-value">{{ activeProfile?.name || concrntState.settings.profile }}</span></div>
				<label class="connection-row"><span><strong>コンカレントの通知を表示</strong><small>{{ localInstanceName }}を開いている間、選択したプロフィールの通知を取得します。</small></span><span class="connection-switch"><input type="checkbox" role="switch" aria-label="コンカレントの通知を表示" :checked="concrntState.settings.notifications" :disabled="busy" @change="updateBoolean('notifications', $event)"/></span></label>
				<label class="connection-row"><span><strong>ポップアップで知らせる</strong><small>新着通知を画面内で知らせます。</small></span><span class="connection-switch"><input type="checkbox" role="switch" aria-label="ポップアップで知らせる" :checked="concrntState.settings.popups" :disabled="busy || !concrntState.settings.notifications" @change="updateBoolean('popups', $event)"/></span></label>
				<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>既読の記録はこの端末内で管理します。ブラウザを閉じている間のプッシュ通知は、この設定の対象外です。</span></p>
				<p v-if="!concrntState.settings.enabled" class="connection-note"><i class="ti ti-player-pause" aria-hidden="true"></i><span>コンカレント連携の一時停止中は、通知の取得も止まります。</span></p>
			</section>

			<template v-else-if="section === 'data'">
				<section class="connection-card">
					<h2><i class="ti ti-device-desktop" aria-hidden="true"></i>この端末に保存するデータ</h2>
					<div class="connection-row" data-stack="true"><span><strong>接続情報</strong><small>ほかの端末には同期しません。</small></span><span class="connection-value">{{ !linked ? '未連携' : concrntState.settings.save === 'device' ? 'この端末に保存' : '端末に保存しない' }}</span></div>
					<div class="connection-row" data-stack="true"><span><strong>既読の記録</strong><small>コンカレントの通知だけに使います。</small></span><span class="connection-value">この端末内</span></div>
					<div class="connection-row" data-stack="true"><span><strong>送信結果の確認情報</strong><small>結果が不明な投稿を重複送信しないために使います。</small></span><span class="connection-value">必要な間だけ保持</span></div>
					<p class="connection-note"><i class="ti ti-lock" aria-hidden="true"></i><span>{{ localInstanceName }}の設定バックアップには含めません。</span></p>
				</section>
				<section class="connection-card">
					<h2><i class="ti ti-database" aria-hidden="true"></i>表示キャッシュ</h2>
					<p class="connection-description">表示が古いときなどに、取得済みデータを読み直します。</p>
					<div class="connection-actions"><button type="button" class="hy-secondary" :disabled="busy" @click="openConfirmation('cache', $event)"><i class="ti ti-trash" aria-hidden="true"></i>表示キャッシュを消去</button></div>
					<p class="connection-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>表示用の一時データだけが対象です。連携情報・既読の記録・送信結果の確認情報は残ります。</span></p>
					<div v-if="confirmation === 'cache'" class="connection-confirm" role="group" :aria-labelledby="confirmTitleId">
						<h3 :id="confirmTitleId">表示キャッシュを消去しますか？</h3><p class="connection-description">取得済みの表示データを消去します。次に開いたときに再取得します。</p>
						<div class="connection-actions"><button ref="cancelConfirmButton" type="button" class="hy-secondary" :disabled="busy" @click="closeConfirmation">やめておく</button><button type="button" class="hy-secondary connection-danger" :disabled="busy" @click="confirmCache">キャッシュを消去</button></div>
					</div>
				</section>
			</template>

			<section v-else class="connection-card connection-empty"><i class="ti ti-link" aria-hidden="true"></i><h2>コンカレントを連携する</h2><p class="connection-description">アカウントを連携すると、この設定を利用できます。</p><div class="connection-actions"><button type="button" class="hy-primary" :disabled="busy || !concrntState.initialized" @click="beginLink">連携を始める</button></div></section>
		</template>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef } from 'vue';
import { instanceName } from '@@/js/config.js';
import type { ConcrntServerInfo } from '@/utility/concrnt/server-info.js';
import HyCapsule from '@/components/HyCapsule.vue';
import ConcrntServerIdentity from '@/components/concrnt/ConcrntServerIdentity.vue';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { formatConcrntConnectionError } from '@/utility/concrnt/connection-errors.js';
import { normalizeConcrntServerInfo } from '@/utility/concrnt/server-info.js';
import { checkConcrntDomain, clearConcrntCache, concrntState, initializeConcrnt, linkConcrnt, recheckConcrnt, unlinkConcrnt, updateConcrntSettings } from '@/utility/concrnt/runtime.js';
import { requestConcrntConsent } from '@/utility/concrnt/consent.js';
import './concrnt-ui.css';

const localInstanceName = computed(() => instance.name || instanceName);
const section = ref('account');
const sections = [
	{ value: 'account', label: 'アカウント', icon: 'ti ti-user' },
	{ value: 'display', label: '表示・投稿', icon: 'ti ti-layout-list' },
	{ value: 'notifications', label: '通知', icon: 'ti ti-bell' },
	{ value: 'data', label: '絵文字・データ', icon: 'ti ti-database' },
];
const step = ref<0 | 1 | 2 | 3>(0);
const domainDraft = ref('');
const checkedDomain = ref('');
const checkedServer = ref<ConcrntServerInfo | null>(null);
const secretDraft = ref('');
const saveDraft = ref<'device' | 'session'>('device');
const localBusy = ref(false);
const error = ref('');
const notice = ref('');
const confirmation = ref<'unlink' | 'cache' | null>(null);
const busy = computed(() => localBusy.value || concrntState.busy);
const linked = computed(() => concrntState.connection != null);
const activeProfile = computed(() => concrntState.profiles.find(profile => profile.id === concrntState.settings.profile));
const linkedServer = computed(() => {
	const domain = concrntState.connection?.domain;
	if (!domain) return null;
	return concrntState.server?.domain === domain ? concrntState.server : normalizeConcrntServerInfo(domain, null);
});
const statusLabels = { connected: '連携済み', unlinked: '未連携', paused: '一時停止中', offline: '確認が必要', reauth: '再認証が必要', unknownAuth: '認証の確認待ち' };
const statusLabel = computed(() => statusLabels[concrntState.status]);
const statusExplanation = computed(() => {
	if (['offline', 'unknownAuth', 'reauth'].includes(concrntState.status) && concrntState.error) return concrntState.error;
	if (concrntState.status === 'offline') return '接続状態を確認できません。連携情報を保持したまま、もう一度確認できます。';
	if (concrntState.status === 'unknownAuth') return '認証の失効は確認できていません。連携情報はそのまま残しています。';
	if (concrntState.status === 'reauth') return '連携情報と表示設定は保持されています。連携用サブキーを確認してください。';
	return '';
});
const id = useId();
const domainId = `${id}-domain`;
const secretId = `${id}-secret`;
const secretHelpId = `${id}-secret-help`;
const profileId = `${id}-profile`;
const errorId = `${id}-error`;
const saveGroup = `${id}-save`;
const confirmTitleId = `${id}-confirmation`;
const domainInput = useTemplateRef<HTMLInputElement>('domainInput');
const secretInput = useTemplateRef<HTMLInputElement>('secretInput');
const linkButton = useTemplateRef<HTMLButtonElement>('linkButton');
const completedButton = useTemplateRef<HTMLButtonElement>('completedButton');
const cancelConfirmButton = useTemplateRef<HTMLButtonElement>('cancelConfirmButton');
let confirmationOpener: HTMLElement | null = null;
let disposed = false;
let actionGeneration = 0;

function clearSecret() {
	secretDraft.value = '';
	if (secretInput.value) secretInput.value.value = '';
}

function pasteSecret(event: ClipboardEvent) {
	const field = secretInput.value;
	if (busy.value || !field || !event.clipboardData) return;
	const pasted = event.clipboardData.getData('text/plain');
	if (!pasted) return;
	// A password input removes line breaks; preserve copied field separators before that happens.
	event.preventDefault();
	field.setRangeText(pasted.replace(/\s+/gu, ' '), field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length, 'end');
	secretDraft.value = field.value;
}

async function beginLink() {
	if (busy.value) return;
	clearSecret();
	domainDraft.value = concrntState.connection?.domain ?? '';
	checkedDomain.value = '';
	checkedServer.value = null;
	saveDraft.value = linked.value ? concrntState.settings.save : 'device';
	confirmation.value = null;
	error.value = '';
	notice.value = '';
	step.value = 1;
	await nextTick();
	domainInput.value?.focus();
}

async function cancelLink() {
	if (busy.value) return;
	actionGeneration++;
	clearSecret();
	checkedDomain.value = '';
	checkedServer.value = null;
	step.value = 0;
	section.value = 'account';
	error.value = '';
	await nextTick();
	linkButton.value?.focus();
}

async function backToDomain() {
	if (busy.value) return;
	clearSecret();
	checkedDomain.value = '';
	checkedServer.value = null;
	error.value = '';
	step.value = 1;
	await nextTick();
	domainInput.value?.focus();
}

async function checkDomain() {
	if (busy.value || !domainDraft.value.trim()) return;
	const generation = ++actionGeneration;
	localBusy.value = true;
	error.value = '';
	try {
		const domain = domainDraft.value.trim();
		// 旗鯖fork: 接続先へアクセスする前に、外部サーバー連携の免責事項への同意を求める。同意しなければ連携を始めない。
		if (!await requestConcrntConsent(domain)) return;
		if (disposed || generation !== actionGeneration) return;
		const server = await checkConcrntDomain(domain);
		if (disposed || generation !== actionGeneration) return;
		checkedDomain.value = server.domain;
		checkedServer.value = normalizeConcrntServerInfo(server.domain, server.meta);
		step.value = 2;
		localBusy.value = false;
		await nextTick();
		secretInput.value?.focus();
	} catch (cause) {
		if (!disposed && generation === actionGeneration) error.value = formatConcrntConnectionError(cause, 'server');
	} finally {
		if (!disposed && generation === actionGeneration) localBusy.value = false;
	}
}

async function connect() {
	if (busy.value || !checkedDomain.value || !secretDraft.value.trim()) return;
	if (!/^concrnt-subkey\s/.test(secretDraft.value.trim())) {
		error.value = '「サブキーのコピー」で得た、「concrnt-subkey」で始まる文字列全体を入力してください。主鍵やニーモニックは使用できません。';
		clearSecret();
		secretInput.value?.focus();
		return;
	}
	const generation = ++actionGeneration;
	localBusy.value = true;
	error.value = '';
	try {
		const pending = linkConcrnt(secretDraft.value.trim(), checkedDomain.value, saveDraft.value);
		clearSecret();
		await pending;
		if (disposed || generation !== actionGeneration) return;
		if (!concrntState.connection) throw new Error('Connection was not confirmed');
		step.value = 3;
		notice.value = 'コンカレントのアカウントを連携しました。';
		await nextTick();
		completedButton.value?.focus();
	} catch {
		if (!disposed && generation === actionGeneration) error.value = concrntState.error || '連携できませんでした。サブキーと接続先を確認して、もう一度入力してください。';
	} finally {
		clearSecret();
		if (!disposed && generation === actionGeneration) localBusy.value = false;
	}
}

function finishLink() {
	clearSecret();
	checkedDomain.value = '';
	step.value = 0;
	section.value = 'account';
}

function changeSection(value: string) {
	section.value = value;
	confirmation.value = null;
	error.value = '';
	notice.value = '';
}

async function perform(action: () => Promise<void> | void, success: string) {
	if (busy.value) return false;
	localBusy.value = true;
	error.value = '';
	notice.value = '';
	try {
		await action();
		if (disposed) return false;
		notice.value = success;
		return true;
	} catch {
		if (!disposed) error.value = concrntState.error || '操作を完了できませんでした。もう一度お試しください。';
		return false;
	} finally {
		if (!disposed) localBusy.value = false;
	}
}

function updateBoolean(key: 'enabled' | 'notifications' | 'popups', event: Event) {
	const input = event.target as HTMLInputElement;
	const checked = input.checked;
	input.checked = concrntState.settings[key];
	return perform(() => updateConcrntSettings({ [key]: checked }), '設定を保存しました。');
}

function updateSave(save: 'device' | 'session', event: Event) {
	const fieldset = (event.target as HTMLInputElement).closest('fieldset');
	for (const input of fieldset?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []) {
		input.checked = input.value === concrntState.settings.save;
	}
	return perform(() => updateConcrntSettings({ save }), '接続情報の保存方法を変更しました。');
}

function updateProfile(event: Event) {
	const select = event.target as HTMLSelectElement;
	const profile = select.value;
	select.value = concrntState.settings.profile;
	return perform(() => updateConcrntSettings({ profile }), '利用するプロフィールを変更しました。');
}

function recheck() {
	if (!concrntState.settings.enabled) return;
	return perform(async () => {
		await recheckConcrnt();
		if (concrntState.status !== 'connected') throw new Error('Connection was not confirmed');
	}, '接続情報を確認しました。');
}

async function openConfirmation(action: 'unlink' | 'cache', event: Event) {
	if (busy.value) return;
	confirmationOpener = event.currentTarget as HTMLElement;
	confirmation.value = action;
	error.value = '';
	await nextTick();
	cancelConfirmButton.value?.focus();
}

async function closeConfirmation() {
	if (busy.value) return;
	confirmation.value = null;
	await nextTick();
	if (confirmationOpener?.isConnected) confirmationOpener.focus();
}

async function confirmUnlink() {
	if (!await perform(() => unlinkConcrnt(), 'この端末のコンカレント連携を解除しました。')) return;
	clearSecret();
	confirmation.value = null;
	await nextTick();
	linkButton.value?.focus();
}

async function confirmCache() {
	if (!await perform(() => clearConcrntCache(), '表示キャッシュを消去しました。')) return;
	await closeConfirmation();
}

function onEscape() {
	if (busy.value) return;
	if (confirmation.value) closeConfirmation();
	else if (step.value === 1 || step.value === 2) cancelLink();
}

onMounted(async () => {
	try { await initializeConcrnt(); } catch {
		if (!disposed) error.value = concrntState.error || '連携情報を読み込めませんでした。';
	}
});
onBeforeUnmount(() => {
	disposed = true;
	actionGeneration++;
	clearSecret();
});
</script>
