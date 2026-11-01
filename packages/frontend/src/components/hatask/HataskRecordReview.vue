<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section v-if="allowed" ref="reviewEl" class="review-page" :data-theme="theme" :data-mode="mode" :data-detail-open="detailOpen" :aria-labelledby="`${uid}-title`">
	<header class="review-heading">
		<div><div class="review-eyebrow"><i class="ti ti-shield-check" aria-hidden="true"></i>運営用<span>{{ $i?.isAdmin ? '管理者' : 'モデレーター' }}</span></div><h1 :id="`${uid}-title`">記録確認</h1><p>みんなの記録を、ひとつの一覧で。</p></div>
		<span class="scope-label"><i class="ti ti-lock-access" aria-hidden="true"></i>非公開・指定メンバー限定を含む</span>
	</header>
	<div class="review-workspace">
		<div class="review-list-area">
			<section class="review-filters" aria-label="記録の絞り込み">
				<div class="review-search-row"><label class="review-search"><i class="ti ti-search" aria-hidden="true"></i><span class="sr-only">記録の内容を検索</span><input v-model="query" type="search" maxlength="200" placeholder="内容・ユーザー・記録IDで検索"></label><button class="review-icon" type="button" :aria-expanded="filtersOpen" :aria-controls="`${uid}-filters`" aria-label="絞り込み条件" title="絞り込み条件" @click="filtersOpen = !filtersOpen"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i><span v-if="extraFilterCount" class="filter-dot">{{ extraFilterCount }}</span></button></div>
				<div class="kind-filters" role="group" aria-label="記録の種類"><button v-for="item in kinds" :key="item.id" class="kind-filter" type="button" :aria-pressed="kind === item.id" @click="kind = item.id"><i v-if="item.icon" :class="`ti ${item.icon}`" aria-hidden="true"></i>{{ item.label }}<span v-if="counts">{{ item.id === 'all' ? sum(counts.kinds) : counts.kinds[item.id] ?? 0 }}</span></button></div>
				<div v-if="filtersOpen" :id="`${uid}-filters`" class="extra-filters">
					<div class="owner-filter"><span>ユーザー</span><button class="review-button" type="button" @click="selectOwner">{{ owner ? userName(owner) : '全ユーザー' }}</button><button v-if="owner" class="review-text-button" type="button" @click="owner = null">指定を解除</button></div>
					<label>公開範囲<select v-model="visibility"><option value="all">すべての公開範囲</option><option v-for="item in visibilities" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
					<label>記録の日付・開始<input v-model="dateFrom" type="date" :max="dateTo || undefined"></label><label>終了<input v-model="dateTo" type="date" :min="dateFrom || undefined"></label>
					<p v-if="invalidPeriod" class="period-error" role="alert">終了日は開始日以降にしてください。</p><button class="review-text-button" type="button" @click="resetFilters">条件をリセット</button>
				</div>
			</section>
			<div class="status-tabs" role="group" aria-label="確認状態"><button v-for="item in allStatuses" :key="item.id" type="button" :aria-pressed="state === item.id" @click="state = item.id">{{ item.label }}<span v-if="counts">{{ item.id === 'all' ? sum(counts.states) : counts.states[item.id] ?? 0 }}</span></button></div>
			<div class="list-caption"><span role="status" aria-live="polite">{{ counts ? `${counts.total}件の記録` : '記録一覧' }}</span><label><span class="sr-only">並び順</span><select v-model="sort"><option value="newest">記録日が新しい順</option><option value="oldest">記録日が古い順</option></select></label></div>
			<div v-if="loading && !rows.length" class="review-state" role="status" aria-busy="true"><i class="ti ti-hourglass" aria-hidden="true"></i><h2>記録を読み込んでいます</h2></div>
			<div v-else-if="error && !rows.length" class="review-state" role="alert"><i class="ti ti-cloud-off" aria-hidden="true"></i><h2>{{ error }}</h2><button type="button" class="review-button" @click="loadList()">もう一度読み込む</button></div>
			<div v-else-if="!rows.length" class="review-state"><i class="ti ti-search" aria-hidden="true"></i><h2>条件に合う記録がありません</h2><p>キーワードや絞り込み条件を変えてみてください。</p><button type="button" class="review-button" @click="resetFilters">条件をリセット</button></div>
			<div v-else class="record-list" aria-label="すべての記録" :aria-busy="loading">
				<div v-for="group in groups" :key="group.date" class="record-date-group">
					<h2>{{ dateLabel(group.date) }}</h2><button v-for="record in group.rows" :key="record.id" type="button" class="record-row" :data-record="record.id" :data-selected="selectedId === record.id" :aria-pressed="selectedId === record.id" @click="openRecord(record.id)">
						<div class="record-type" :data-kind="record.kind"><i :class="`ti ${kindInfo(record.kind).icon}`" aria-hidden="true"></i></div>
						<div class="record-content"><div class="record-meta"><span>{{ kindInfo(record.kind).label }}</span><span>{{ userName(record.user) }}</span><time>{{ record.time }}</time></div><strong class="record-title">{{ record.title }}</strong><p v-if="record.body" class="record-preview">{{ record.body }}</p><div class="record-footer"><span class="record-visibility"><i :class="`ti ${visibilityInfo(record.visibility).icon}`" aria-hidden="true"></i>{{ visibilityInfo(record.visibility).label }}</span><span class="review-status" :data-state="record.state"><i :class="`ti ${statusInfo(record.state).icon}`" aria-hidden="true"></i>{{ statusInfo(record.state).label }}</span></div></div><i class="ti ti-chevron-right record-chevron" aria-hidden="true"></i>
					</button>
				</div>
			</div>
			<p v-if="error && rows.length" role="alert" class="review-note">{{ error }}</p>
			<div v-if="nextCursor" class="list-end"><button type="button" class="review-button" :disabled="loading" @click="loadList(true)">{{ loading ? '読み込み中…' : '続きを読み込む' }}</button></div><p v-else-if="rows.length && !loading" class="list-end">{{ rows.length }}件すべてを表示しています</p>
		</div>
		<section v-if="selectedId" class="record-detail" :aria-labelledby="`${uid}-detail`" :aria-busy="detailLoading">
			<div class="detail-top"><button type="button" class="review-text-button detail-back" @click="closeDetail"><i class="ti ti-arrow-left" aria-hidden="true"></i>一覧へ</button><span class="detail-label">記録の詳細</span><span v-if="selected" class="review-status" :data-state="selected.state">{{ statusInfo(selected.state).label }}</span></div>
			<h2 v-if="detailLoading" :id="`${uid}-detail`" ref="detailHeading" tabindex="-1" role="status">記録を読み込んでいます</h2>
			<template v-else-if="selected && detail">
				<div class="detail-author"><MkAvatar class="person-avatar" :user="selected.user" :link="false"/><div><strong>{{ userName(selected.user) }}</strong><span>@{{ selected.user.username }}</span></div><button type="button" class="review-icon" aria-label="このユーザーの記録で絞り込む" title="このユーザーの記録" @click="filterUser(selected.user)"><i class="ti ti-user-search" aria-hidden="true"></i></button></div>
				<div class="detail-metadata"><span><i :class="`ti ${kindInfo(selected.kind).icon}`" aria-hidden="true"></i>{{ kindInfo(selected.kind).label }}</span><span><i :class="`ti ${visibilityInfo(selected.visibility).icon}`" aria-hidden="true"></i>{{ visibilityInfo(selected.visibility).label }}</span></div>
				<h2 :id="`${uid}-detail`" ref="detailHeading" tabindex="-1">{{ selected.title }}</h2><p class="detail-date">{{ selected.dateFallback ? '保存の日付' : '記録の日付' }} {{ dateLabel(selected.date) }} {{ selected.time }}</p>
				<p v-if="selected.body" class="detail-body">{{ selected.body }}</p>
				<p v-if="detail.audience.length" class="detail-body">指定メンバー：{{ detail.audience.map(userName).join('、') }}</p>
				<dl class="detail-fields"><div v-for="(field, index) in detail.fields" :key="index"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl>
				<details class="record-identifier"><summary>記録ID</summary><code>{{ selected.id }}</code></details>
				<div class="review-actions"><h3>確認状態</h3><p v-if="selected.stale" class="review-note">前回の確認後に内容が変わっています。</p><div class="review-state-controls" role="group" aria-label="この記録の確認状態"><button v-for="item in statuses" :key="item.id" type="button" :data-set-state="item.id" :aria-pressed="selected.state === item.id" :disabled="saving" @click="setState(item.id)"><i :class="`ti ${item.icon}`" aria-hidden="true"></i>{{ item.label }}</button></div><p v-if="selected.reviewer && selected.reviewedAt" class="review-note">{{ userName(selected.reviewer) }} · {{ new Date(selected.reviewedAt).toLocaleString() }}</p></div>
				<RecordModerationActions :target="{ product: 'hatask', targetType: 'record', targetId: selected.id }" :busy="saving" :mode="mode" @completed="onModerated"/>
			</template>
			<div v-else class="review-state"><h2 :id="`${uid}-detail`" ref="detailHeading" tabindex="-1">記録を表示できません</h2><button class="review-button" type="button" @click="openRecord(selectedId)">もう一度読み込む</button></div>
			<p v-if="detailError" role="alert" class="review-note">{{ detailError }}</p><p v-if="notice" role="status" class="review-note">{{ notice }}</p>
		</section>
		<div v-else class="detail-placeholder"><i class="ti ti-file-search" aria-hidden="true"></i><p>記録を選ぶと、内容を詳しく確認できます。</p></div>
	</div>
</section>
<p v-else-if="revoked" role="alert">記録確認の権限がありません。</p>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, useId, watch } from 'vue';
import type { Endpoints, entities } from 'cherrypick-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import MkAvatar from '@/components/global/MkAvatar.vue';
import RecordModerationActions from '@/components/RecordModerationActions.vue';

type Page = Endpoints['admin/hatask/records/list']['res'];
type Detail = Endpoints['admin/hatask/records/show']['res'];
type Item = Detail['item'];
type State = Item['state'];
type Options = Endpoints['admin/hatask/records/list']['req'];
defineProps<{ theme?: string; mode?: 'light' | 'dark' }>();
const uid = useId(), reviewEl = ref<HTMLElement>(), detailHeading = ref<HTMLElement>();
const { selectUser } = useHataGoesPickers();
const revoked = ref(false);
const allowed = computed(() => !revoked.value && !!$i && ($i.isAdmin || $i.isModerator));
const kinds = [{ id: 'all', label: 'すべて', icon: '' }, { id: 'event', label: '予定', icon: 'ti-calendar-event' }, { id: 'todo', label: 'ToDo', icon: 'ti-checkbox' }, { id: 'mood', label: 'きもち', icon: 'ti-mood-smile' }, { id: 'meal', label: 'ごはん', icon: 'ti-soup' }, { id: 'flower', label: 'おはな', icon: 'ti-flower' }] as const;
const statuses = [{ id: 'unread', label: '未確認', icon: 'ti-circle-dashed' }, { id: 'flagged', label: '要確認', icon: 'ti-flag' }, { id: 'reviewed', label: '確認済み', icon: 'ti-circle-check' }] as const;
const allStatuses = [{ id: 'all', label: 'すべて' }, ...statuses] as const;
const visibilities = [{ id: 'private', label: '非公開', icon: 'ti-lock' }, { id: 'specified', label: '指定メンバー', icon: 'ti-users' }, { id: 'public', label: '公開', icon: 'ti-world' }, { id: 'followers', label: 'フォロワー', icon: 'ti-user-check' }] as const;
const kindInfo = (id: Item['kind']) => kinds.find(item => item.id === id)!;
const statusInfo = (id: State) => statuses.find(item => item.id === id)!;
const visibilityInfo = (id: Item['visibility']) => visibilities.find(item => item.id === id)!;
const userName = (user: entities.UserLite) => user.name || user.username;
const dateLabel = (date: string) => `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
const sum = (values: object) => Object.values(values).reduce((total: number, value: number) => total + value, 0);
const query = ref(''), kind = ref<NonNullable<Options['kind']>>('all'), state = ref<NonNullable<Options['state']>>('all'), visibility = ref<NonNullable<Options['visibility']>>('all');
const owner = ref<entities.UserLite | null>(null), dateFrom = ref(''), dateTo = ref(''), sort = ref<'newest' | 'oldest'>('newest');
const filtersOpen = ref(false), detailOpen = ref(false), selectedId = ref(''), detail = ref<Detail | null>(null);
const rows = ref<Item[]>([]), counts = ref<Pick<Page, 'total' | 'kinds' | 'states'> | null>(null), nextCursor = ref<string | null>(null);
const loading = ref(false), detailLoading = ref(false), saving = ref(false), error = ref(''), detailError = ref(''), notice = ref('');
const selected = computed(() => detail.value?.item);
const invalidPeriod = computed(() => !!dateFrom.value && !!dateTo.value && dateFrom.value > dateTo.value);
const extraFilterCount = computed(() => Number(!!owner.value) + Number(visibility.value !== 'all') + Number(!!dateFrom.value || !!dateTo.value));
const options = computed<Options>(() => ({ query: query.value, kind: kind.value, state: state.value, visibility: visibility.value, userId: owner.value?.id ?? null, dateFrom: dateFrom.value || null, dateTo: dateTo.value || null, sort: sort.value, limit: 30 }));
const groups = computed(() => {
	const result: { date: string; rows: Item[] }[] = [];
	for (const record of rows.value) {
		let group = result.at(-1);
		if (group?.date !== record.date) { group = { date: record.date, rows: [] }; result.push(group); }
		group.rows.push(record);
	}
	return result;
});
let alive = true, listRequest = 0, detailRequest = 0, saveRequest = 0, timer: number | undefined;
const valid = (account: string | undefined) => alive && allowed.value && account === $i?.id;

function accessDenied(err: unknown) {
	if (!['HATASK_REVIEW_ACCESS_DENIED', 'ROLE_PERMISSION_DENIED', 'PERMISSION_DENIED', 'ACCESS_DENIED', 'AUTHENTICATION_FAILED'].includes((err as { code?: string })?.code ?? '')) return false;
	revoked.value = true; clearData(); return true;
}

function clearData() {
	window.clearTimeout(timer); listRequest++; detailRequest++; saveRequest++;
	rows.value = []; counts.value = null; nextCursor.value = null; selectedId.value = ''; detail.value = null; detailOpen.value = false;
	loading.value = false; detailLoading.value = false; saving.value = false; error.value = ''; detailError.value = ''; notice.value = '';
}

async function loadList(more = false) {
	if (!allowed.value || !alive || invalidPeriod.value) return;
	const request = ++listRequest, account = $i?.id;
	loading.value = true; error.value = '';
	try {
		const page = await misskeyApi('admin/hatask/records/list', { ...options.value, cursor: more ? nextCursor.value : null });
		if (request !== listRequest || !valid(account)) return;
		rows.value = more ? [...rows.value, ...page.items.filter(item => !rows.value.some(row => row.id === item.id))] : page.items;
		counts.value = page; nextCursor.value = page.nextCursor;
		if (!selectedId.value && rows.value[0]) void openRecord(rows.value[0].id, false);
	} catch (err) { if (request === listRequest && valid(account) && !accessDenied(err)) error.value = '記録を読み込めませんでした'; } finally { if (request === listRequest && valid(account)) loading.value = false; }
}

async function openRecord(id: string, reveal = true) {
	if (!valid($i?.id)) return;
	const request = ++detailRequest, account = $i?.id;
	selectedId.value = id; detail.value = null; detailLoading.value = true; detailError.value = ''; notice.value = '';
	if (reveal) detailOpen.value = true;
	try {
		const result = await misskeyApi('admin/hatask/records/show', { id });
		if (request !== detailRequest || !valid(account)) return;
		detail.value = result;
	} catch (err) { if (request === detailRequest && valid(account) && !accessDenied(err)) detailError.value = '記録が削除されたか、読み込みに失敗しました。'; } finally {
		if (request === detailRequest && valid(account)) {
			detailLoading.value = false;
			if (reveal) { await nextTick(); detailHeading.value?.focus({ preventScroll: true }); if ((reviewEl.value?.clientWidth ?? 0) <= 800) reviewEl.value?.scrollIntoView({ block: 'start' }); }
		}
	}
}

async function closeDetail() {
	detailOpen.value = false; await nextTick();
	const target = reviewEl.value?.querySelector<HTMLElement>(`[data-record="${selectedId.value}"]`) ?? reviewEl.value?.querySelector<HTMLElement>('.status-tabs [aria-pressed="true"]');
	target?.focus();
}

function filterUser(user: entities.UserLite) { owner.value = user; filtersOpen.value = true; detailOpen.value = false; }

async function selectOwner() {
	const account = $i?.id;
	try { const user = await selectUser({ includeSelf: true, localOnly: true }); if (user && valid(account)) filterUser(user); } catch { /* Selection cancelled. */ }
}

function resetFilters() { query.value = ''; kind.value = state.value = visibility.value = 'all'; owner.value = null; dateFrom.value = dateTo.value = ''; }

async function onModerated() {
	selectedId.value = ''; detail.value = null; detailOpen.value = false;
	await loadList();
}

async function setState(value: State) {
	if (!selected.value || saving.value || !valid($i?.id)) return;
	const item = selected.value, request = ++saveRequest, account = $i?.id, opened = detailRequest;
	saving.value = true; detailError.value = ''; notice.value = '';
	try {
		const result = await misskeyApi('admin/hatask/records/review', { id: item.id, state: value, expectedRevision: item.revision, expectedContentVersion: item.contentVersion });
		if (request !== saveRequest || !valid(account)) return;
		if (opened === detailRequest) { detail.value = result; notice.value = result.item.stale ? '内容が変わったため、未確認に戻しました。' : `「${statusInfo(result.item.state).label}」にしました。`; }
		await loadList();
	} catch (err) {
		if (request !== saveRequest || opened !== detailRequest || !valid(account)) return;
		if (accessDenied(err)) return;
		if ((err as { code?: string }).code === 'HATASK_REVIEW_CONFLICT') {
			await openRecord(item.id, false);
			if (request === saveRequest && selectedId.value === item.id && valid(account)) detailError.value = '内容や確認状態が更新されました。最新の内容を確認してから、もう一度選んでください。';
		} else detailError.value = '確認状態を保存できませんでした。もう一度お試しください。';
	} finally { if (request === saveRequest && valid(account)) saving.value = false; }
}

watch(options, () => { clearData(); loading.value = !invalidPeriod.value; timer = window.setTimeout(() => void loadList(), 300); });
watch(() => `${$i?.id}:${allowed.value}`, () => { clearData(); if (allowed.value) void loadList(); }, { immediate: true });
onDeactivated(() => { alive = false; clearData(); });
onActivated(() => { if (!alive) { alive = true; void loadList(); } });
onBeforeUnmount(() => { alive = false; clearData(); });
defineExpose({ search(value: string) { query.value = value; detailOpen.value = false; } });
</script>

<style scoped>
.review-page { container: review-page / inline-size; min-width: 0; width: 100%; --review-paper: var(--paper, var(--surface)); }
/* Slot content does not receive the layout component's scoped button reset. */
.review-page button { margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: start; }
.review-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 0 0 24px; }
.review-eyebrow { display: flex; gap: 7px; align-items: center; font-size: 12px; font-weight: 700; color: var(--accent-ink); }
.review-eyebrow > span { padding-inline-start: 8px; margin-inline-start: 2px; border-inline-start: 1px solid var(--rule); color: var(--fg-2); font-weight: 500; }
.review-heading h1 { margin: 5px 0 0; font: 800 28px/1.45 var(--htk-font-head); letter-spacing: .02em; }
.review-heading p { margin: 5px 0 0; color: var(--fg-2); font-size: 13px; }
.scope-label { display: inline-flex; align-items: center; gap: 6px; color: var(--fg-2); font-size: 11px; padding-bottom: 4px; }
.review-workspace { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(290px, .85fr); align-items: start; gap: 24px; min-width: 0; }
.review-list-area { min-width: 0; }
.review-filters { padding: 16px; background: var(--review-paper); border: 1px solid var(--rule); border-radius: var(--card-radius); box-shadow: var(--shadow); }
.review-search-row { display: flex; gap: 8px; }
.review-search { display: flex; gap: 10px; align-items: center; background: var(--fill); border: 1px solid var(--rule); border-radius: var(--control-radius, 14px); min-width: 0; flex: 1; padding-inline: 12px; color: var(--fg-2); }
.review-search input { background: none; border: 0; color: var(--fg); min-width: 0; width: 100%; height: 44px; font-size: 14px; }
.review-search input::placeholder { color: var(--fg-2); opacity: 1; }
.review-page .review-icon { position: relative; border: 1px solid var(--rule); border-radius: var(--control-radius, 14px); min-width: 44px; width: 44px; height: 44px; display: grid; place-items: center; color: var(--fg-2); }
.review-icon .ti { display: block; text-align: center; }
.review-icon[aria-expanded='true'] { background: var(--fill-2); color: var(--accent-ink); }
.filter-dot { position: absolute; right: -4px; top: -4px; background: var(--accent-ink); color: var(--htk-on-ink, #fff); min-width: 17px; border-radius: 20px; padding: 0 3px; font-size: 10px; text-align: center; }
.kind-filters { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 12px; }
.review-page .kind-filter { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 40px; padding: 7px 10px; border-radius: var(--control-radius, 12px); border: 1px solid transparent; font-size: 12px; color: var(--fg-2); }
.kind-filter > span { font: 600 11px Archivo, sans-serif; }
.review-page .kind-filter[aria-pressed='true'] { background: var(--fill-2); border-color: var(--rule2); color: var(--accent-ink); font-weight: 700; }
.extra-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; border-top: 1px solid var(--rule); margin-top: 12px; padding-top: 14px; }
.extra-filters label { display: grid; gap: 5px; font-size: 11px; color: var(--fg-2); min-width: 0; }
.extra-filters :is(select, input) { width: 100%; min-width: 0; height: 44px; border: 1px solid var(--rule); border-radius: var(--control-radius, 10px); background: var(--review-paper); color: var(--fg); padding: 7px 9px; font-size: 13px; }
.period-error { grid-column: 1 / -1; margin: 0; font-size: 12px; color: var(--accent-ink); }
.review-page .review-text-button { padding: 8px 4px; display: inline-flex; align-items: center; gap: 6px; color: var(--accent-ink); font-weight: 700; font-size: 12px; min-height: 40px; }
.status-tabs { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--rule); margin-top: 20px; }
.review-page .status-tabs button { display: flex; align-items: center; gap: 5px; min-height: 44px; padding: 9px 5px; border-bottom: 2px solid transparent; color: var(--fg-2); font-size: 12px; white-space: nowrap; }
.status-tabs span { font-family: Archivo, sans-serif; font-size: 11px; }
.review-page .status-tabs button[aria-pressed='true'] { border-bottom-color: var(--accent-ink); color: var(--accent-ink); font-weight: 700; }
.list-caption { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 48px; color: var(--fg-2); font-size: 11px; }
.list-caption select { border: 0; padding: 8px 0 8px 4px; background: transparent; color: var(--fg-2); font-size: 11px; max-width: 165px; }
select option { color: var(--fg, #252528); background: var(--paper, #fff); }
.record-date-group > h2 { margin: 18px 0 9px; display: flex; gap: 10px; align-items: baseline; color: var(--fg-2); font-size: 12px; font-weight: 700; }
.record-date-group:first-child > h2 { margin-top: 0; }
.record-date-group > h2 span { font-family: Archivo, sans-serif; font-size: 10px; font-weight: 400; }
.review-page .record-row { width: 100%; display: grid; grid-template-columns: 34px minmax(0, 1fr) 12px; gap: 11px; text-align: left; padding: 15px 14px; border: 1px solid var(--rule); border-radius: min(var(--card-radius), 18px); background: var(--review-paper); margin-bottom: 8px; transition: background .16s, border-color .16s; }
.review-page .record-row[data-selected='true'] { border-color: var(--accent-ink); background: color-mix(in srgb, var(--accent) 7%, var(--review-paper)); box-shadow: inset 3px 0 0 var(--accent-ink); }
.record-row:hover { background: var(--fill); }
.record-type { width: 34px; height: 34px; display: grid; place-items: center; background: var(--fill-2); border-radius: min(var(--card-radius), 10px); color: var(--accent-ink); font-size: 18px; }
.record-content { min-width: 0; }
.record-meta { display: flex; flex-wrap: wrap; gap: 5px 9px; align-items: baseline; color: var(--fg-2); font-size: 10px; }
.record-meta time { margin-left: auto; font-family: Archivo, sans-serif; }
.record-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 13px; line-height: 1.65; margin-top: 4px; font-weight: 700; overflow-wrap: anywhere; }
.record-preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 4px 0 0; color: var(--fg-2); font-size: 11px; }
.record-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 10px; }
.record-visibility { font-size: 10px; color: var(--fg-2); display: flex; gap: 4px; align-items: center; }
.review-status { font-size: 10px; display: inline-flex; align-items: center; gap: 4px; color: var(--fg-2); white-space: nowrap; }
.record-footer .review-status { margin-left: auto; }
.review-status[data-state='flagged'] { color: var(--accent-ink); font-weight: 700; background: var(--fill-2); padding: 2px 7px; border-radius: var(--control-radius, 6px); }
.review-status[data-state='reviewed'] { font-weight: 500; }
.record-chevron { align-self: center; color: var(--fg-2); font-size: 13px; }
.list-end { text-align: center; color: var(--fg-2); font-size: 11px; margin: 24px 0; }
.record-detail { position: sticky; top: 16px; min-width: 0; border: 1px solid var(--rule); border-radius: var(--card-radius); background: var(--review-paper); box-shadow: var(--shadow); padding: 20px; }
.detail-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid var(--rule); }
.detail-label { font-size: 12px; font-weight: 700; }
.review-page .detail-back { display: none; }
.detail-author { display: flex; gap: 10px; align-items: center; margin: 18px 0; }
.person-avatar { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 50%; background: var(--fill-2); border: 1px solid var(--rule); color: var(--accent-ink); font-weight: 700; }
.detail-author > div { display: grid; gap: 1px; min-width: 0; }
.detail-author strong { font-size: 13px; }
.detail-author span:not(.person-avatar) { font-size: 11px; color: var(--fg-2); overflow-wrap: anywhere; }
.detail-author .review-icon { border: 0; margin-left: auto; flex: none; }
.detail-metadata { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 11px; color: var(--fg-2); }
.detail-metadata span { display: inline-flex; gap: 5px; align-items: center; }
.record-detail h2 { margin: 10px 0 6px; font-size: 19px; line-height: 1.65; font-family: var(--htk-font-head); overflow-wrap: anywhere; }
.detail-date { color: var(--fg-2); font-size: 10px; margin: 0 0 18px; }
.detail-body { margin: 16px 0; font-size: 13px; line-height: 1.9; white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-fields { margin: 0; border-top: 1px solid var(--rule); }
.detail-fields > div { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--rule); font-size: 11px; }
.detail-fields dt { color: var(--fg-2); }
.detail-fields dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.record-identifier { color: var(--fg-2); font-size: 10px; margin-top: 14px; }
.record-identifier summary { min-height: 32px; padding-block: 8px; }
.record-identifier code { overflow-wrap: anywhere; }
.review-actions { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--rule); }
.review-actions h3 { font-size: 12px; margin: 0 0 10px; }
.review-state-controls { display: flex; gap: 6px; }
.review-page .review-state-controls button { flex: 1; min-width: 0; min-height: 44px; padding: 7px 4px; border: 1px solid var(--rule); border-radius: var(--control-radius, 10px); font-size: 11px; display: flex; justify-content: center; gap: 4px; align-items: center; }
.review-page .review-state-controls button[aria-pressed='true'] { background: var(--accent-ink); color: var(--htk-on-ink, var(--on-accent)); border-color: var(--accent-ink); }
.review-note { margin: 13px 0 0; padding: 10px; background: var(--fill); border-radius: min(var(--card-radius), 10px); color: var(--fg-2); font-size: 11px; line-height: 1.8; }
.review-note > i { margin-right: 5px; }
.review-state, .detail-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 55px 20px; text-align: center; color: var(--fg-2); }
.review-state > .ti, .detail-placeholder > .ti { display: block; margin-inline: auto; font-size: 32px; color: var(--accent-ink); text-align: center; }
.review-state h1, .review-state h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--fg); }
.review-state p, .detail-placeholder p { margin: 0; font-size: 12px; }
.review-page .review-button { border: 1px solid var(--rule2); border-radius: var(--control-radius, 12px); padding: 10px 16px; background: var(--fill-2); color: var(--accent-ink); font-weight: 700; min-height: 44px; font-size: 13px; }
.review-page :is(button, input, select, summary):focus-visible { outline: 2px solid var(--accent-ink); outline-offset: -2px; }
.review-page button:hover { filter: brightness(.97); }
.review-page[data-mode='dark'] button:hover { filter: brightness(1.1); }
.review-page[data-theme='hatakyu'] .record-type[data-kind] { background: var(--record-art) center / contain no-repeat; }
.review-page[data-theme='hatakyu'] .record-type .ti { visibility: hidden; }
.review-page[data-theme='hatakyu'] .record-type[data-kind='event'] { --record-art: var(--hatakyu-calendar); }
.review-page[data-theme='hatakyu'] .record-type[data-kind='todo'] { --record-art: var(--hatakyu-todo); }
.review-page[data-theme='hatakyu'] .record-type[data-kind='mood'] { --record-art: var(--hatakyu-mood); }
.review-page[data-theme='hatakyu'] .record-type[data-kind='meal'] { --record-art: var(--hatakyu-meal); }
.review-page[data-theme='hatakyu'] .record-type[data-kind='flower'] { --record-art: var(--hatakyu-garden); }
@container review-page (max-width: 800px) {
  .review-heading { display: block; padding-bottom: 20px; }
  .scope-label { margin-top: 9px; }
  .review-workspace { display: block; }
  .record-detail, .detail-placeholder { display: none; }
  .review-page[data-detail-open='true'] .review-list-area { display: none; }
  .review-page[data-detail-open='true'] .record-detail { display: block; position: static; }
  .review-page .detail-back { display: inline-flex; }
  .detail-label { display: none; }
  .record-detail h2 { font-size: 21px; }
  .record-meta, .record-visibility, .review-status, .detail-date, .detail-fields > div { font-size: 12px; }
  .record-title, .detail-body { font-size: 14px; }
}
@container hatask-akatsuki (max-width: 599px) {
  .review-page { padding-block: 14px 28px; }
  .review-heading h1 { font-size: 25px; }
  .review-heading p { font-size: 12px; }
  .scope-label { font-size: 10px; }
  .review-filters { padding: 12px; }
  .review-search input { font-size: 16px; }
  .review-page .kind-filter { min-height: 44px; padding-inline: 8px; }
  .status-tabs { justify-content: space-between; gap: 3px; }
  .review-page .status-tabs button { gap: 4px; padding-inline: 2px; font-size: 11px; }
  .record-detail { padding: 16px; }
  .review-page .record-row { gap: 9px; padding: 13px 11px; }
  .record-meta { font-size: 10px; }
  .extra-filters :is(select, input) { font-size: 16px; }
}
@container review-page (max-width: 300px) {
  .extra-filters { grid-template-columns: minmax(0, 1fr); }
  .record-type { width: 28px; height: 28px; font-size: 16px; }
  .review-page .record-row { grid-template-columns: 28px minmax(0, 1fr) 10px; }
  .review-state-controls { flex-wrap: wrap; }
  .review-page .review-state-controls button { flex-basis: 70px; }
}

.review-page, .review-page * { box-sizing: border-box; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.review-page button { cursor: pointer; }
.review-page button:disabled { opacity: .55; cursor: wait; }
.owner-filter { display: grid; gap: 5px; min-width: 0; font-size: 11px; color: var(--fg-2); }
.owner-filter button { overflow-wrap: anywhere; }
.detail-fields dt, .detail-author strong { overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .review-page * { transition: none !important; } }
</style>
