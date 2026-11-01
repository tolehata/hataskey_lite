<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/support" label="支援管理" :keywords="['Hatask', '支援情報', '支援者', '特典']" icon="ti ti-heart-handshake">
			<MkLoading v-if="loading"/>
			<div v-else-if="!draft" class="_gaps_m">
				<p role="alert">{{ copy.loadFailed }}</p>
				<MkButton @click="loadSettings">{{ copy.retry }}</MkButton>
			</div>
			<div v-else class="_gaps_l" :class="$style.root">
				<section class="_gaps_m">
					<h2 :class="$style.heading"><i class="ti ti-heart-handshake" aria-hidden="true"></i> {{ copy.information }}</h2>
					<p :class="$style.description">{{ copy.description }}</p>
					<MkSwitch v-model="draft.enabled" data-support-field="enabled">
						<template #label>{{ copy.enabled }}</template>
						<template #caption>{{ copy.enabledCaption }}</template>
					</MkSwitch>
					<MkSwitch v-model="draft.navButtonVisible" data-support-field="navButtonVisible">
						<template #label>{{ copy.navButtonVisible }}</template>
					</MkSwitch>
				</section>

				<section class="_gaps_m" :class="$style.section">
					<h3 :class="$style.heading"><i class="ti ti-link" aria-hidden="true"></i> {{ copy.destination }}</h3>
					<MkInput v-model="draft.platform" data-support-field="platform">
						<template #label>{{ copy.platform }}</template>
					</MkInput>
					<MkInput v-model="draft.url" type="url" data-support-field="url">
						<template #prefix><i class="ti ti-link" aria-hidden="true"></i></template>
						<template #label>{{ copy.url }}</template>
						<template #caption>{{ copy.urlCaption }}</template>
					</MkInput>
					<MkInput v-model="draft.manageUrl" type="url" data-support-field="manageUrl">
						<template #prefix><i class="ti ti-link" aria-hidden="true"></i></template>
						<template #label>{{ copy.manageUrl }}</template>
						<template #caption>{{ copy.manageUrlCaption }}</template>
					</MkInput>
					<MkTextarea v-model="draft.intro" data-support-field="intro">
						<template #label>{{ copy.intro }}</template>
						<template #caption>{{ copy.lineBreakCaption }}</template>
					</MkTextarea>
				</section>

				<section class="_gaps_m" :class="$style.section">
					<h3 :class="$style.heading"><i class="ti ti-heart-handshake" aria-hidden="true"></i> {{ copy.banner }}</h3>
					<MkSwitch v-model="draft.bannerVisible" data-support-field="bannerVisible">
						<template #label>{{ copy.bannerVisible }}</template>
					</MkSwitch>
					<MkInput v-model="draft.bannerTitle" data-support-field="bannerTitle">
						<template #label>{{ copy.bannerTitle }}</template>
					</MkInput>
					<MkTextarea v-model="draft.bannerMessage" data-support-field="bannerMessage">
						<template #label>{{ copy.bannerMessage }}</template>
						<template #caption>{{ copy.lineBreakCaption }}</template>
					</MkTextarea>
				</section>

				<section class="_gaps_m" :class="$style.section" data-support-benefits>
					<h3 :class="$style.heading"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i> {{ copy.benefits }}</h3>
					<p :class="$style.description">{{ copy.benefitsCaption }}</p>
					<MkFolder v-for="benefit in draft.benefits" :key="benefit.key" :canPage="false" :data-support-benefit="benefit.key">
						<template #icon><i class="ti" :class="`ti-${supportPolicyDefinition(benefit.key)?.icon ?? 'sparkles'}`" aria-hidden="true"></i></template>
						<template #label>{{ benefit.title || supportPolicyDefinition(benefit.key)?.name }}</template>
						<template #suffix>{{ benefit.visible ? copy.visible : copy.hidden }}</template>
						<div class="_gaps_m">
							<MkSwitch v-model="benefit.visible" data-benefit-field="visible">
								<template #label>{{ copy.benefitVisible }}</template>
							</MkSwitch>
							<MkSwitch v-model="benefit.showBaseline" data-benefit-field="showBaseline">
								<template #label>{{ copy.showBaseline }}</template>
							</MkSwitch>
							<MkInput v-model="benefit.title" data-benefit-field="title">
								<template #label>{{ copy.benefitTitle }}</template>
							</MkInput>
							<MkSelect v-model="benefit.roleId" :items="roleItems(benefit)" data-benefit-field="roleId" @update:modelValue="loadRolePreview">
								<template #label>{{ copy.role }}</template>
							</MkSelect>
							<MkTextarea v-model="benefit.description" data-benefit-field="description">
								<template #label>{{ copy.benefitDescription }}</template>
							</MkTextarea>
							<dl :class="$style.policyPreview" aria-live="polite">
								<div>
									<dt>{{ copy.offered }}</dt>
									<dd>
										<span v-if="benefit.roleId && previewLoading[benefit.roleId]">{{ copy.loading }}</span>
										<span v-else-if="benefit.roleId && previewErrors[benefit.roleId]" role="alert">{{ copy.previewFailed }}</span>
										<strong v-else :data-offered-preview="benefit.key">{{ offeredLabel(benefit) }}</strong>
										<small v-if="supportSnapshotCondition(offeredSnapshot(benefit))">{{ supportSnapshotCondition(offeredSnapshot(benefit)) }}</small>
										<MkButton v-if="benefit.roleId && previewErrors[benefit.roleId]" small @click="loadRolePreview(benefit.roleId)">{{ copy.retry }}</MkButton>
									</dd>
								</div>
								<div>
									<dt>{{ copy.baseline }}</dt>
									<dd>
										<strong :data-baseline-preview="benefit.key">{{ formatSupportSnapshot(benefit.key, baselineSnapshot(benefit.key)) }}</strong>
										<small v-if="supportSnapshotCondition(baselineSnapshot(benefit.key))">{{ supportSnapshotCondition(baselineSnapshot(benefit.key)) }}</small>
									</dd>
								</div>
							</dl>
							<p :class="$style.caption">{{ copy.policyCaption }}</p>
						</div>
					</MkFolder>
				</section>

				<section class="_gaps_m" :class="$style.section" data-supporter-management>
					<h3 :class="$style.heading"><i class="ti ti-users" aria-hidden="true"></i> {{ copy.supporters }}</h3>
					<p :class="$style.description">{{ copy.supportersCaption }}</p>
					<MkButton :disabled="addingUser || removingUserId !== null" :wait="addingUser" data-add-supporter @click="addSupporter"><i class="ti ti-user-plus" aria-hidden="true"></i> {{ copy.addSupporter }}</MkButton>
					<MkInput v-model="query" type="search" data-supporter-search @update:modelValue="onQueryChange">
						<template #prefix><i class="ti ti-search" aria-hidden="true"></i></template>
						<template #label>{{ copy.search }}</template>
					</MkInput>
					<p v-if="mutationError" :class="$style.error" role="alert">{{ mutationError }}</p>
					<p v-if="mutationNotice" :class="$style.caption" role="status">{{ mutationNotice }}</p>
					<p :class="$style.caption">{{ copy.matchingUsers }}: {{ totalUsers }}</p>
					<MkLoading v-if="usersLoading && users.length === 0"/>
					<div v-if="users.length" class="_gaps_s">
						<div v-for="user in users" :key="user.id" :class="$style.userRow" :data-supporter-id="user.id">
							<MkAvatar :user="user" :class="$style.avatar"/>
							<div :class="$style.userInfo">
								<MkUserName :user="user" :nowrap="false"/>
								<span :class="$style.username">@{{ user.username }}</span>
							</div>
							<MkButton small :wait="removingUserId === user.id" :disabled="addingUser || removingUserId !== null" :aria-label="`${user.name || user.username}${copy.removeUserLabel}`" data-remove-supporter @click="removeSupporter(user)">{{ copy.removeSupporter }}</MkButton>
						</div>
					</div>
					<p v-else-if="!usersLoading && !usersError" :class="$style.caption">{{ query ? copy.noMatchingUsers : copy.noSupporters }}</p>
					<div v-if="usersError" class="_gaps_s">
						<p :class="$style.error" role="alert">{{ copy.usersFailed }}</p>
						<MkButton @click="loadSupporters(failedListReset)">{{ copy.retry }}</MkButton>
					</div>
					<MkButton v-else-if="hasMoreUsers" :wait="usersLoading" :disabled="addingUser || removingUserId !== null" full data-load-supporters @click="loadSupporters(false)">{{ copy.loadMore }}</MkButton>
				</section>

				<MkFolder :canPage="false" defaultOpen data-support-preview>
					<template #icon><i class="ti ti-eye" aria-hidden="true"></i></template>
					<template #label>{{ copy.preview }}</template>
					<div class="_gaps_m">
						<p :class="$style.caption">{{ copy.previewCaption }}</p>
						<p v-if="!draft.enabled || !draft.url.trim()" :class="$style.emptyPreview" data-preview-unconfigured>{{ copy.unconfigured }}</p>
						<div v-else-if="draft.bannerVisible" :class="$style.bannerPreview">
							<i class="ti ti-heart-handshake" :class="$style.bannerIcon" aria-hidden="true"></i>
							<div :class="$style.bannerCopy">
								<h4 :class="$style.bannerTitle" data-preview-title>
									<template v-if="draft.bannerTitle === 'ご支援ありがとうございます！'">ご支援<br>ありがとうございます！</template>
									<template v-else>{{ draft.bannerTitle }}</template>
								</h4>
								<p :class="$style.bannerMessage" data-preview-message>{{ draft.bannerMessage }}</p>
							</div>
						</div>
						<p v-else :class="$style.caption">{{ copy.bannerHidden }}</p>
						<dl :class="$style.summary">
							<dt>{{ copy.information }}</dt><dd data-preview-enabled>{{ draft.enabled ? copy.on : copy.off }}</dd>
							<dt>{{ copy.destination }}</dt><dd data-preview-url>{{ draft.url.trim() ? copy.configured : copy.notConfigured }}</dd>
							<dt>{{ copy.visibleBenefits }}</dt><dd data-preview-benefits>{{ draft.benefits.filter(benefit => benefit.visible).length }}{{ copy.items }}</dd>
							<dt>{{ query.trim() ? copy.matchingSupporters : copy.supporterCount }}</dt><dd data-preview-supporters>{{ usersLoading ? copy.loading : usersError ? copy.notLoaded : `${totalUsers}${copy.people}` }}</dd>
							<dt>{{ copy.automaticRoles }}</dt><dd>{{ copy.never }}</dd>
						</dl>
						<MkButton link to="/hatask?tab=support" data-open-saved-support>{{ copy.openSaved }}</MkButton>
					</div>
				</MkFolder>
			</div>
		</SearchMarker>
	</div>
	<template #footer>
		<div v-if="draft" :class="$style.footer">
			<div class="_spacer _gaps_s" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<p v-if="saveError" :class="$style.error" role="alert">{{ saveError }}</p>
				<p v-else-if="savedNotice" :class="$style.caption" role="status">{{ hasUnsavedChanges ? copy.savedWithChanges : copy.saved }}</p>
				<div :class="$style.saveRow">
					<MkButton primary rounded :wait="saving" :disabled="!hasUnsavedChanges" data-save-support @click="save"><i class="ti ti-check" aria-hidden="true"></i> {{ copy.save }}</MkButton>
					<span v-if="hasUnsavedChanges" :class="$style.caption">{{ copy.unsaved }}</span>
				</div>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { SupportSnapshot } from '@/utility/hatask-support.js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { SUPPORT_POLICIES, formatSupportSnapshot, supportHttpsUrl, supportPolicyDefinition, supportSnapshotCondition } from '@/utility/hatask-support.js';

type SupportAdminResponse = Misskey.Endpoints['admin/hatask/support/show']['res'];
type SupportSettings = SupportAdminResponse['settings'];
type Benefit = SupportSettings['benefits'][number];
type Supporter = Misskey.Endpoints['admin/hatask/support/supporters']['res']['users'][number];

const copy = {
	title: '支援管理', information: '支援情報', description: 'Hataskの支援情報タブに表示する内容と、支援者を管理します',
	enabled: '支援情報を表示する', enabledCaption: 'OFFの間も設定・支援者の登録は保持されます。\n変更は保存後に反映されます',
	navButtonVisible: 'Hatask上部ナビに支援情報を表示',
	destination: '支援先', platform: '支援先の名前', url: '支援のURL', urlCaption: 'HTTPSのURLを指定します。\n空欄の場合は、支援情報が未設定の案内だけを表示します',
	manageUrl: '停止・変更の案内URL', manageUrlCaption: '未設定の場合は、支援のURLを案内します', intro: '支援の説明', lineBreakCaption: '改行もそのまま表示します',
	banner: '感謝のバナー', bannerVisible: '感謝のバナーを表示する', bannerTitle: 'バナーの見出し', bannerMessage: '感謝のメッセージ',
	benefits: '案内する特典', benefitsCaption: '項目ごとに表示・非表示、名前、説明、参照するロールを指定できます。\nロールを付与する操作ではありません',
	visible: '表示', hidden: '非表示', benefitVisible: 'この特典を案内に表示する', showBaseline: '支援なしの利用内容も表示する',
	benefitTitle: '表示名', benefitDescription: '説明文', role: '説明に使う参照ロール', selectRole: '参照ロールを選択してください', missingRole: '参照できないロール（選び直してください）',
	offered: '支援特典（参照ロール）', baseline: '支援なし（サーバー標準）', policyCaption: '設定値そのものは既存のロール管理で変更します',
	loading: '読み込み中…', previewFailed: '参照ロールの設定を読み込めませんでした', loadFailed: '支援情報の設定を読み込めませんでした', retry: '再試行',
	supporters: '支援者の登録', supportersCaption: '支援を確認したローカルユーザーを登録します。\n登録した全員が支援者一覧に掲載されます。ロールの付与・解除は行いません',
	addSupporter: 'ローカルユーザーを追加', removeSupporter: '登録を外す', removeUserLabel: 'さんの支援者登録を外す', search: '登録したユーザーを検索',
	matchingUsers: '該当する支援者', noSupporters: '登録された支援者はいません', noMatchingUsers: '該当する支援者はいません', usersFailed: '支援者一覧を読み込めませんでした', loadMore: 'もっと読み込む',
	localOnly: 'このサーバーのローカルユーザーだけを登録できます', alreadyRegistered: 'このユーザーは登録済みです', registered: '支援者に登録しました。ロール・利用権限は変更していません',
	registerFailed: '登録できませんでした。ユーザーの状態を確認して、もう一度お試しください', removeFailed: '登録を外せませんでした。もう一度お試しください',
	removeTitle: '支援者の登録を外しますか？', removeCaption: '支払いの停止や、ロール・利用権限の変更は行いません', removed: '支援者の登録を外しました。支払い・ロール・利用権限は変更していません',
	save: '保存', unsaved: '未保存の変更があります', saved: '設定を保存しました', savedWithChanges: '設定を保存しました。その後の変更は未保存です',
	saveFailed: '保存できませんでした。入力内容は保持しています。もう一度お試しください', invalidUrl: '支援先と停止・変更のURLには、認証情報を含まないHTTPSのURLを指定してください',
	emptyBanner: '感謝のバナーを表示する場合は、見出しを入力してください',
	preview: 'Hataskでの表示プレビュー', previewCaption: '編集中の内容の見本です。\n配色は本体のテーマに従います', bannerHidden: '感謝のバナーは非表示になります',
	unconfigured: 'このサーバーでは支援情報がありません。\nまた、後ほどご確認ください',
	on: '有効', off: '無効', configured: '設定あり', notConfigured: '設定なし', visibleBenefits: '表示する特典', items: '件', supporterCount: '掲載する支援者',
	matchingSupporters: '検索に一致した支援者', people: '人', notLoaded: '未取得', automaticRoles: 'ロールの自動変更', never: 'しません', openSaved: '保存済みの支援情報を開く',
};

const headerTabs = computed(() => []);
const draft = ref<SupportSettings | null>(null);
const loaded = ref<SupportAdminResponse | null>(null);
const loading = ref(true);
const saving = ref(false);
const savedSettings = ref('');
const saveError = ref('');
const savedNotice = ref(false);
const hasUnsavedChanges = computed(() => draft.value !== null && JSON.stringify(draft.value) !== savedSettings.value);
const previewCache = ref<Record<string, Record<string, SupportSnapshot> | null>>({});
const previewLoading = ref<Record<string, boolean>>({});
const previewErrors = ref<Record<string, boolean>>({});
const users = ref<Supporter[]>([]);
const usersLoading = ref(false);
const usersError = ref(false);
const failedListReset = ref(true);
const totalUsers = ref(0);
const hasMoreUsers = ref(false);
const query = ref('');
const addingUser = ref(false);
const removingUserId = ref<string | null>(null);
const mutationError = ref('');
const mutationNotice = ref('');
const requests = new Set<AbortController>();
let disposed = false;
let listRequestId = 0;
let listController: AbortController | null = null;
let queryTimer: number | undefined;
let nextOffset = 0;

function requestController(): AbortController {
	const controller = new AbortController();
	requests.add(controller);
	return controller;
}

async function loadSettings() {
	if (disposed) return;
	loading.value = true;
	const controller = requestController();
	try {
		const result = await misskeyApi('admin/hatask/support/show', {}, undefined, controller.signal);
		if (disposed) return;
		loaded.value = result;
		const settings = structuredClone(result.settings);
		// A new server starts with no configured benefits. Keep every supported
		// policy editable, without publishing any sample entitlement or role.
		settings.benefits.push(...SUPPORT_POLICIES.filter(policy => !settings.benefits.some(benefit => benefit.key === policy.key)).map(policy => ({
			key: policy.key, title: policy.name, description: policy.description, roleId: null, visible: false, showBaseline: true,
		})));
		draft.value = settings;
		savedSettings.value = JSON.stringify(settings);
	} catch {
		// No fallback samples: a failed request must not become editable defaults.
	} finally {
		requests.delete(controller);
		if (!disposed) loading.value = false;
	}
}

function roleItems(benefit: Benefit): { value: string | null; label: string }[] {
	const roles = loaded.value?.roles ?? [];
	return [
		{ value: null, label: copy.selectRole },
		...roles.map(role => ({ value: role.id, label: role.name })),
		...(benefit.roleId && !roles.some(role => role.id === benefit.roleId) ? [{ value: benefit.roleId, label: copy.missingRole }] : []),
	];
}

function baselineSnapshot(key: string): SupportSnapshot | undefined {
	return loaded.value?.benefits.find(benefit => benefit.key === key)?.baseline;
}

function offeredSnapshot(benefit: Benefit): SupportSnapshot | null {
	if (!benefit.roleId) return null;
	if (Object.hasOwn(previewCache.value, benefit.roleId)) return previewCache.value[benefit.roleId]?.[benefit.key] ?? null;
	const response = loaded.value;
	if (!response || response.settings.benefits.find(item => item.key === benefit.key)?.roleId !== benefit.roleId) return null;
	return response.benefits.find(item => item.key === benefit.key)?.offered ?? null;
}

function offeredLabel(benefit: Benefit): string {
	if (!benefit.roleId) return copy.selectRole;
	const snapshot = offeredSnapshot(benefit);
	return snapshot ? formatSupportSnapshot(benefit.key, snapshot) : copy.missingRole;
}

async function loadRolePreview(roleId: string | null) {
	if (!roleId || disposed || previewLoading.value[roleId]) return;
	if (Object.hasOwn(previewCache.value, roleId) && !previewErrors.value[roleId]) return;
	previewLoading.value[roleId] = true;
	previewErrors.value[roleId] = false;
	const controller = requestController();
	try {
		const result = await misskeyApi('admin/hatask/support/show', { previewRoleId: roleId }, undefined, controller.signal);
		if (disposed) return;
		// Only cache this role's preview. Never merge the server's saved settings
		// into the draft when a role selection changes or an old response arrives.
		previewCache.value[roleId] = result.rolePreview?.id === roleId ? Object.fromEntries(result.rolePreview.benefits.map(benefit => [benefit.key, benefit.snapshot])) : null;
	} catch {
		if (!disposed) previewErrors.value[roleId] = true;
	} finally {
		requests.delete(controller);
		if (!disposed) previewLoading.value[roleId] = false;
	}
}

async function save() {
	if (!draft.value || saving.value || disposed) return;
	saveError.value = '';
	savedNotice.value = false;
	if ([draft.value.url, draft.value.manageUrl].some(value => value.trim() && !supportHttpsUrl(value))) {
		saveError.value = copy.invalidUrl;
		return;
	}
	if (draft.value.bannerVisible && !draft.value.bannerTitle.trim()) {
		saveError.value = copy.emptyBanner;
		return;
	}
	// Capture the request without clearing the current draft. Edits made while
	// saving remain unsaved instead of being overwritten by the response.
	const submittedDraft = JSON.stringify(draft.value);
	const settings: SupportSettings = JSON.parse(submittedDraft);
	settings.url = settings.url.trim();
	settings.manageUrl = settings.manageUrl.trim();
	saving.value = true;
	const controller = requestController();
	try {
		await misskeyApi('admin/hatask/support/update', { settings }, undefined, controller.signal);
		if (disposed) return;
		savedSettings.value = submittedDraft;
		savedNotice.value = true;
	} catch {
		if (!disposed) saveError.value = copy.saveFailed;
	} finally {
		requests.delete(controller);
		if (!disposed) saving.value = false;
	}
}

async function loadSupporters(reset = true) {
	if (disposed) return;
	if (queryTimer !== undefined) { window.clearTimeout(queryTimer); queryTimer = undefined; }
	const requestId = ++listRequestId;
	listController?.abort();
	const controller = requestController();
	listController = controller;
	usersLoading.value = true;
	usersError.value = false;
	failedListReset.value = reset;
	const offset = reset ? 0 : nextOffset;
	try {
		const result = await misskeyApi('admin/hatask/support/supporters', { offset, limit: 30, query: query.value.trim(), registeredOnly: true }, undefined, controller.signal);
		if (disposed || requestId !== listRequestId) return;
		const nextUsers = reset ? result.users : [...users.value, ...result.users];
		users.value = [...new Map(nextUsers.map(user => [user.id, user])).values()];
		nextOffset = offset + result.users.length;
		totalUsers.value = result.total;
		hasMoreUsers.value = result.hasMore;
	} catch {
		if (!disposed && requestId === listRequestId) usersError.value = true;
	} finally {
		requests.delete(controller);
		if (!disposed && requestId === listRequestId) usersLoading.value = false;
	}
}

function onQueryChange() {
	if (queryTimer !== undefined) window.clearTimeout(queryTimer);
	// Invalidate an in-flight old query before waiting for the debounce.
	listRequestId++;
	listController?.abort();
	users.value = [];
	totalUsers.value = 0;
	hasMoreUsers.value = false;
	nextOffset = 0;
	usersLoading.value = true;
	usersError.value = false;
	queryTimer = window.setTimeout(() => { void loadSupporters(true); }, 300);
}

async function addSupporter() {
	if (addingUser.value || removingUserId.value !== null || disposed) return;
	const user = await os.selectUser({ includeSelf: true, localOnly: true });
	if (disposed) return;
	mutationError.value = '';
	mutationNotice.value = '';
	if (user.host != null) { mutationError.value = copy.localOnly; return; }
	if (users.value.some(item => item.id === user.id)) { mutationNotice.value = copy.alreadyRegistered; return; }
	addingUser.value = true;
	const controller = requestController();
	try {
		await misskeyApi('admin/hatask/support/register', { userId: user.id }, undefined, controller.signal);
		if (disposed) return;
		mutationNotice.value = copy.registered;
		await loadSupporters(true);
	} catch {
		if (!disposed) mutationError.value = copy.registerFailed;
	} finally {
		requests.delete(controller);
		if (!disposed) addingUser.value = false;
	}
}

async function removeSupporter(user: Supporter) {
	if (addingUser.value || removingUserId.value !== null || disposed) return;
	const { canceled } = await os.confirm({ type: 'warning', title: copy.removeTitle, text: `${user.name || user.username}${copy.removeUserLabel}\n${copy.removeCaption}`, okText: copy.removeSupporter });
	if (canceled || disposed) return;
	mutationError.value = '';
	mutationNotice.value = '';
	removingUserId.value = user.id;
	const controller = requestController();
	try {
		await misskeyApi('admin/hatask/support/unregister', { userId: user.id }, undefined, controller.signal);
		if (disposed) return;
		users.value = users.value.filter(item => item.id !== user.id);
		totalUsers.value = Math.max(0, totalUsers.value - 1);
		mutationNotice.value = copy.removed;
		await loadSupporters(true);
	} catch {
		if (!disposed) mutationError.value = copy.removeFailed;
	} finally {
		requests.delete(controller);
		if (!disposed) removingUserId.value = null;
	}
}

onMounted(() => { void loadSettings(); void loadSupporters(true); });
onUnmounted(() => {
	disposed = true;
	listRequestId++;
	if (queryTimer !== undefined) window.clearTimeout(queryTimer);
	for (const controller of requests) controller.abort();
	requests.clear();
});

definePage({ title: copy.title, icon: 'ti ti-heart-handshake' });
</script>

<style lang="scss" module>
.root {
	container: support-admin / inline-size;
}

.heading {
	display: flex;
	align-items: center;
	gap: 10px;
	margin: 0;
	font-size: 1.1em;
}

.section {
	border-top: 1px solid var(--MI_THEME-divider);
	padding-top: 24px;
}

.description,
.caption {
	margin: 0;
	color: var(--MI_THEME-fgTransparentWeak);
	white-space: pre-line;
	overflow-wrap: anywhere;
}

.caption {
	font-size: 0.85em;
}

.policyPreview {
	display: grid;
	gap: 14px;
	margin: 0;
	border-top: 1px solid var(--MI_THEME-divider);
	padding-top: 14px;

	> div {
		display: flex;
		justify-content: space-between;
		gap: 8px 16px;
		flex-wrap: wrap;
	}

	dt { color: var(--MI_THEME-fgTransparentWeak); }
	dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
	strong { color: var(--MI_THEME-accent); }
	small { display: block; color: var(--MI_THEME-fgTransparentWeak); }
}

.userRow {
	display: flex;
	align-items: center;
	gap: 12px;
	padding-block: 12px;
	border-bottom: 1px solid var(--MI_THEME-divider);
}

.avatar { width: 40px; height: 40px; flex-shrink: 0; }
.userInfo { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.username { display: block; font-size: 0.85em; color: var(--MI_THEME-fgTransparentWeak); }
.error { margin: 0; color: var(--MI_THEME-error); white-space: pre-line; }
.footer { background: color(from var(--MI_THEME-bg) srgb r g b / 0.85); backdrop-filter: var(--MI-blur, blur(15px)); }
.saveRow { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.bannerPreview { display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 12px; }
.bannerIcon { font-size: 2em; flex-shrink: 0; color: var(--MI_THEME-accent); }
.bannerCopy { min-width: 0; flex: 1; }
.bannerTitle { margin: 0 0 12px; font-size: 1.25em; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
.bannerMessage { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.emptyPreview { margin: 0; padding-block: 24px; text-align: center; white-space: pre-line; overflow-wrap: anywhere; }
.summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; margin: 0; }
.summary dt { color: var(--MI_THEME-fgTransparentWeak); }
.summary dd { margin: 0; text-align: right; font-weight: 700; }

@container support-admin (max-width: 360px) {
	.userRow { flex-wrap: wrap; }
	.userInfo { flex-basis: calc(100% - 52px); }
}
</style>
