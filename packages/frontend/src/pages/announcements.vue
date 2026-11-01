<!--
SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<!-- 旗鯖fork: 種類フィルターのピル (2段目)。メンテナンスはフィルターに関わらず常に表示。 -->
	<div :class="[$style.htkPillTabs, $style.htkPillTabsSub]">
		<div :class="$style.htkPillTabsInner">
			<button v-for="f in typeFilters" :key="f.key" :class="[$style.htkPillTab, $style.htkPillTabSm, { [$style.htkPillTabActive]: typeFilter === f.key }]" @click="typeFilter = f.key">
				<i v-if="f.icon" :class="f.icon"></i>
				<span>{{ f.label }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div class="_gaps">
			<MkInfo v-if="$i && $i.hasUnreadAnnouncement && tab === 'current'" warn>{{ i18n.ts.youHaveUnreadAnnouncements }}</MkInfo>

			<MkPagination v-slot="{ items }" :paginator="paginator" class="_gaps">
				<!-- ============================================================ -->
				<!-- 現在のお知らせタブ                                             -->
				<!-- ============================================================ -->
				<template v-if="tab === 'current'">
					<!-- 0. ピン留め (旗鯖独自、最上位) -->
					<template v-if="pinnedItems(items).length > 0">
						<div :class="$style.sectionHeader">
							<i class="ti ti-pin" :class="$style.sectionIconPinned"/>
							<span :class="$style.sectionTitlePinned">{{ i18n.ts._announcement.pinned }}</span>
							<span :class="$style.sectionCount">{{ pinnedItems(items).length }}</span>
						</div>
						<section v-for="(announcement, index) in pinnedItems(items)" :key="announcement.id" class="_panel" :class="[$style.announcement, $style.pinnedAnnouncement]">
							<div :class="$style.pinnedControls">
								<button type="button" :class="$style.pinControlBtn" :disabled="index === 0" :aria-label="i18n.ts._announcement.movePinUp" @click="movePin(announcement.id, -1)">
									<i class="ti ti-chevron-up"/>
								</button>
								<button type="button" :class="$style.pinControlBtn" :disabled="index === pinnedItems(items).length - 1" :aria-label="i18n.ts._announcement.movePinDown" @click="movePin(announcement.id, 1)">
									<i class="ti ti-chevron-down"/>
								</button>
								<button type="button" :class="[$style.pinControlBtn, $style.pinControlBtnUnpin]" :aria-label="i18n.ts._announcement.unpin" @click="togglePin(announcement.id)">
									<i class="ti ti-pin-filled"/>
								</button>
							</div>
							<div v-if="announcement.forYou" :class="$style.forYou"><i class="ti ti-pin"/> {{ i18n.ts.forYou }}</div>
							<div :class="$style.header">
								<span v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.newBadge">NEW</span>
								<span :class="$style.headerIcon">
									<i v-if="announcement.icon === 'info'" class="ti ti-info-circle" style="color: var(--MI_THEME-accent);"/>
									<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"/>
									<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"/>
									<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"/>
									<i v-else-if="announcement.icon === 'maintenance'" class="ti ti-tool" style="color: var(--MI_THEME-error);"/>
								</span>
								<MkA :to="`/announcements/${announcement.id}`"><span>{{ announcement.title }}</span></MkA>
							</div>
							<div :class="$style.content">
								<Mfm :text="announcement.text" class="_selectable"/>
								<!-- 旗鯖fork: メンテナンス進捗バー -->
								<MkAnnouncementProgress
									v-if="announcement.progressSteps"
									:steps="announcement.progressSteps"
									:completed="announcement.progressCompleted"
								/>
								<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
								<MkA :to="`/announcements/${announcement.id}`" :class="$style.metadataLink">
									<div :class="$style.metadata">
										{{ i18n.ts.createdAt }}: <MkTime :time="announcement.createdAt" mode="detail"/>
									</div>
									<div v-if="announcement.updatedAt" :class="$style.metadata">
										{{ i18n.ts.updatedAt }}: <MkTime :time="announcement.updatedAt" mode="detail"/>
									</div>
								</MkA>
							</div>
							<div v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.footer">
								<MkButton primary @click="read(announcement)"><i class="ti ti-check"/> {{ i18n.ts.gotIt }}</MkButton>
							</div>
						</section>
					</template>

					<!-- 1. メンテナンス情報(赤字でトップ、ピン留め除く) -->
					<template v-if="maintenanceItems(items).length > 0">
						<div :class="$style.sectionHeader">
							<i class="ti ti-tool" :class="$style.sectionIconMaintenance"/>
							<span :class="$style.sectionTitleMaintenance">{{ i18n.ts.maintenance }}</span>
						</div>
						<section v-for="announcement in maintenanceItems(items)" :key="announcement.id" class="_panel" :class="[$style.announcement, $style.maintenanceAnnouncement]">
							<button type="button" :class="$style.pinToggleBtn" :aria-label="i18n.ts._announcement.pin" @click="togglePin(announcement.id)">
								<i class="ti ti-pin"/>
							</button>
							<div v-if="announcement.forYou" :class="$style.forYou"><i class="ti ti-pin"/> {{ i18n.ts.forYou }}</div>
							<div :class="$style.header">
								<span v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.newBadge">NEW</span>
								<i class="ti ti-tool" :class="$style.headerIconMaintenance"/>
								<MkA :to="`/announcements/${announcement.id}`"><span :class="$style.titleMaintenance">{{ announcement.title }}</span></MkA>
							</div>
							<div :class="$style.content">
								<Mfm :text="announcement.text" class="_selectable"/>
								<!-- 旗鯖fork: メンテナンス進捗バー -->
								<MkAnnouncementProgress
									v-if="announcement.progressSteps"
									:steps="announcement.progressSteps"
									:completed="announcement.progressCompleted"
								/>
								<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
								<MkA :to="`/announcements/${announcement.id}`" :class="$style.metadataLink">
									<div :class="$style.metadata">
										{{ i18n.ts.createdAt }}: <MkTime :time="announcement.createdAt" mode="detail"/>
									</div>
									<div v-if="announcement.updatedAt" :class="$style.metadata">
										{{ i18n.ts.updatedAt }}: <MkTime :time="announcement.updatedAt" mode="detail"/>
									</div>
								</MkA>
							</div>
							<div v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.footer">
								<MkButton primary @click="read(announcement)"><i class="ti ti-check"/> {{ i18n.ts.gotIt }}</MkButton>
							</div>
						</section>
					</template>

					<!-- 2. 最新のアクティブお知らせ(メンテナンス・ピン留めを除く先頭1件) -->
					<template v-if="latestItem(items)">
						<div :class="$style.sectionHeader">
							<i class="ti ti-flare" :class="$style.sectionIconLatest"/>
							<span :class="$style.sectionTitleLatest">{{ i18n.ts._announcement.latest }}</span>
						</div>
						<section :key="latestItem(items)!.id" class="_panel" :class="[$style.announcement, $style.latestAnnouncement]">
							<button type="button" :class="$style.pinToggleBtn" :aria-label="i18n.ts._announcement.pin" @click="togglePin(latestItem(items)!.id)">
								<i class="ti ti-pin"/>
							</button>
							<div v-if="latestItem(items)!.forYou" :class="$style.forYou"><i class="ti ti-pin"/> {{ i18n.ts.forYou }}</div>
							<div :class="$style.header">
								<span v-if="$i && !latestItem(items)!.silence && !latestItem(items)!.isRead" :class="$style.newBadge">NEW</span>
								<span :class="$style.headerIcon">
									<i v-if="latestItem(items)!.icon === 'info'" class="ti ti-info-circle" style="color: var(--MI_THEME-accent);"/>
									<i v-else-if="latestItem(items)!.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"/>
									<i v-else-if="latestItem(items)!.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"/>
									<i v-else-if="latestItem(items)!.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"/>
								</span>
								<MkA :to="`/announcements/${latestItem(items)!.id}`"><span>{{ latestItem(items)!.title }}</span></MkA>
							</div>
							<div :class="$style.content">
								<Mfm :text="latestItem(items)!.text" class="_selectable"/>
								<img v-if="latestItem(items)!.imageUrl" :src="latestItem(items)!.imageUrl"/>
								<MkA :to="`/announcements/${latestItem(items)!.id}`" :class="$style.metadataLink">
									<div :class="$style.metadata">
										{{ i18n.ts.createdAt }}: <MkTime :time="latestItem(items)!.createdAt" mode="detail"/>
									</div>
									<div v-if="latestItem(items)!.updatedAt" :class="$style.metadata">
										{{ i18n.ts.updatedAt }}: <MkTime :time="latestItem(items)!.updatedAt" mode="detail"/>
									</div>
								</MkA>
							</div>
							<div v-if="$i && !latestItem(items)!.silence && !latestItem(items)!.isRead" :class="$style.footer">
								<MkButton primary @click="read(latestItem(items)!)"><i class="ti ti-check"/> {{ i18n.ts.gotIt }}</MkButton>
							</div>
						</section>
					</template>

					<!-- 3. カテゴリ別お知らせ一覧(メンテ・最新・ピン留めを除く) -->
					<template v-for="cat in categoriesInOrder" :key="cat.key">
						<template v-if="categorize(items, cat.key, true).length > 0">
							<div :class="$style.sectionHeader">
								<i :class="[cat.iconClass, $style.sectionIcon]" :style="cat.iconStyle"/>
								<span :class="$style.sectionTitle">{{ cat.label }}</span>
								<span :class="$style.sectionCount">{{ categorize(items, cat.key, true).length }}</span>
							</div>
							<section v-for="announcement in categorize(items, cat.key, true)" :key="announcement.id" class="_panel" :class="$style.announcement">
								<button type="button" :class="$style.pinToggleBtn" :aria-label="i18n.ts._announcement.pin" @click="togglePin(announcement.id)">
									<i class="ti ti-pin"/>
								</button>
								<div v-if="announcement.forYou" :class="$style.forYou"><i class="ti ti-pin"/> {{ i18n.ts.forYou }}</div>
								<div :class="$style.header">
									<span v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.newBadge">NEW</span>
									<span :class="$style.headerIcon">
										<i v-if="announcement.icon === 'info'" class="ti ti-info-circle" style="color: var(--MI_THEME-accent);"/>
										<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"/>
										<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"/>
										<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"/>
									</span>
									<MkA :to="`/announcements/${announcement.id}`"><span>{{ announcement.title }}</span></MkA>
								</div>
								<div :class="$style.content">
									<Mfm :text="announcement.text" class="_selectable"/>
									<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
									<MkA :to="`/announcements/${announcement.id}`" :class="$style.metadataLink">
										<div :class="$style.metadata">
											{{ i18n.ts.createdAt }}: <MkTime :time="announcement.createdAt" mode="detail"/>
										</div>
										<div v-if="announcement.updatedAt" :class="$style.metadata">
											{{ i18n.ts.updatedAt }}: <MkTime :time="announcement.updatedAt" mode="detail"/>
										</div>
									</MkA>
								</div>
								<div v-if="$i && !announcement.silence && !announcement.isRead" :class="$style.footer">
									<MkButton primary @click="read(announcement)"><i class="ti ti-check"/> {{ i18n.ts.gotIt }}</MkButton>
								</div>
							</section>
						</template>
					</template>
				</template>

				<!-- ============================================================ -->
				<!-- 過去のお知らせタブ(カテゴリ別、ピン留めなし)                   -->
				<!-- ============================================================ -->
				<template v-else>
					<template v-for="cat in categoriesInOrder" :key="cat.key">
						<template v-if="categorize(items, cat.key, false).length > 0">
							<div :class="$style.sectionHeader">
								<i :class="[cat.iconClass, $style.sectionIcon]" :style="cat.iconStyle"/>
								<span :class="$style.sectionTitle">{{ cat.label }}</span>
								<span :class="$style.sectionCount">{{ categorize(items, cat.key, false).length }}</span>
							</div>
							<section v-for="announcement in categorize(items, cat.key, false)" :key="announcement.id" class="_panel" :class="$style.announcement">
								<div :class="$style.header">
									<span :class="$style.headerIcon">
										<i v-if="announcement.icon === 'info'" class="ti ti-info-circle" style="color: var(--MI_THEME-accent);"/>
										<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"/>
										<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"/>
										<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"/>
										<i v-else-if="announcement.icon === 'maintenance'" class="ti ti-tool" style="color: var(--MI_THEME-error);"/>
									</span>
									<MkA :to="`/announcements/${announcement.id}`"><span>{{ announcement.title }}</span></MkA>
								</div>
								<div :class="$style.content">
									<Mfm :text="announcement.text" class="_selectable"/>
									<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
									<MkA :to="`/announcements/${announcement.id}`" :class="$style.metadataLink">
										<div :class="$style.metadata">
											{{ i18n.ts.createdAt }}: <MkTime :time="announcement.createdAt" mode="detail"/>
										</div>
										<div v-if="announcement.updatedAt" :class="$style.metadata">
											{{ i18n.ts.updatedAt }}: <MkTime :time="announcement.updatedAt" mode="detail"/>
										</div>
									</MkA>
								</div>
							</section>
						</template>
					</template>
				</template>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, markRaw, onMounted } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkAnnouncementProgress from '@/components/MkAnnouncementProgress.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { $i } from '@/i.js';
import { updateCurrentAccount } from '@/accounts.js';
import { Paginator } from '@/utility/paginator.js';
import { prefer } from '@/preferences.js';

const tab = ref('current');

const paginator = markRaw(new Paginator('announcements', {
	limit: 20,
	computedParams: computed(() => ({
		isActive: tab.value === 'current',
	})),
}));

// ===== ピン留め管理 ===== //
// preferences の hataPinnedAnnouncementIds を直接 prefer.commit/r で読み書き
function getPinnedIds(): string[] {
	return prefer.r['hataPinnedAnnouncementIds'].value ?? [];
}

function setPinnedIds(ids: string[]) {
	prefer.commit('hataPinnedAnnouncementIds', ids);
}

function togglePin(id: string) {
	const ids = [...getPinnedIds()];
	const idx = ids.indexOf(id);
	if (idx >= 0) {
		ids.splice(idx, 1);
	} else {
		ids.push(id);
	}
	setPinnedIds(ids);
}

function movePin(id: string, direction: -1 | 1) {
	const ids = [...getPinnedIds()];
	const idx = ids.indexOf(id);
	if (idx < 0) return;
	const newIdx = idx + direction;
	if (newIdx < 0 || newIdx >= ids.length) return;
	[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
	setPinnedIds(ids);
}

function isPinned(id: string): boolean {
	return getPinnedIds().includes(id);
}

// ピン留めされているお知らせを、ピン留め順序通りに返す
function pinnedItems(items: any[]) {
	if (tab.value !== 'current') return [];
	const ids = getPinnedIds();
	const map = new Map(items.map(a => [a.id, a]));
	const result: any[] = [];
	for (const id of ids) {
		const a = map.get(id);
		// 旗鯖fork: 種類フィルター適用時はその種類のピン留めのみ表示 (allなら全部)
		if (a && (typeFilter.value === 'all' || a.icon === typeFilter.value)) result.push(a);
	}
	return result;
}

// ===== ピン留めIDの自動クリーンアップ ===== //
// マウント時にAPIで全お知らせ(アクティブ + アーカイブ)を取得し、
// pinnedIds の中で存在しなくなった(=管理者により削除された)IDを除去する
async function cleanupPinnedIds() {
	const currentIds = getPinnedIds();
	if (currentIds.length === 0) return; // 何もピン留めされてなければスキップ

	try {
		// limit=100 で十分なケースが多い。それ以上ある場合は次のロード時に追従
		const [activeAnnouncements, archivedAnnouncements] = await Promise.all([
			misskeyApi('announcements', { limit: 100, isActive: true }),
			misskeyApi('announcements', { limit: 100, isActive: false }),
		]);

		const existingIds = new Set<string>([
			...activeAnnouncements.map(a => a.id),
			...archivedAnnouncements.map(a => a.id),
		]);

		// 存在するIDのみ残す。順序は元の pinnedIds 順を維持
		const cleanedIds = currentIds.filter(id => existingIds.has(id));

		// 削除が発生した場合のみ commit (無駄な書き込みを避ける)
		if (cleanedIds.length !== currentIds.length) {
			setPinnedIds(cleanedIds);
			if (_DEV_) console.log(`[announcements] ピン留めから ${currentIds.length - cleanedIds.length} 件の削除済みお知らせを除去しました`);
		}
	} catch (err) {
		// API失敗時は何もしない(既存のpinnedIdsは保持)
		if (_DEV_) console.warn('[announcements] ピン留めクリーンアップに失敗:', err);
	}
}

onMounted(() => {
	cleanupPinnedIds();
});

// ===== カテゴリ定義 ===== //
type CategoryKey = 'warning' | 'success' | 'info' | 'error' | 'maintenance';

// 旗鯖fork: 種類フィルター (2段目のピル)。'all' は全種類表示。
// メンテナンスはこのフィルターに関わらず常に表示する (下の maintenanceItems で制御)。
const typeFilter = ref<'all' | CategoryKey>('all');
const typeFilters = computed(() => [
	{ key: 'all' as const, label: i18n.ts.all, icon: 'ti ti-list' },
	{ key: 'info' as const, label: i18n.ts._announcement.categoryInfo, icon: 'ti ti-info-circle' },
	{ key: 'warning' as const, label: i18n.ts._announcement.categoryWarning, icon: 'ti ti-alert-triangle' },
	{ key: 'error' as const, label: i18n.ts._announcement.categoryError, icon: 'ti ti-circle-x' },
	{ key: 'success' as const, label: i18n.ts._announcement.categorySuccess, icon: 'ti ti-check' },
	{ key: 'maintenance' as const, label: i18n.ts.maintenance, icon: 'ti ti-tool' },
]);

const categoriesInOrder = computed(() => [
	{ key: 'warning' as const, label: i18n.ts._announcement.categoryWarning, iconClass: 'ti ti-alert-triangle', iconStyle: 'color: var(--MI_THEME-warn);' },
	{ key: 'success' as const, label: i18n.ts._announcement.categorySuccess, iconClass: 'ti ti-check', iconStyle: 'color: var(--MI_THEME-success);' },
	{ key: 'info' as const, label: i18n.ts._announcement.categoryInfo, iconClass: 'ti ti-info-circle', iconStyle: 'color: var(--MI_THEME-accent);' },
	{ key: 'error' as const, label: i18n.ts._announcement.categoryError, iconClass: 'ti ti-circle-x', iconStyle: 'color: var(--MI_THEME-error);' },
].filter(c => typeFilter.value === 'all' || typeFilter.value === c.key));

// 現在タブで「メンテナンス」(ピン留め除く)
function maintenanceItems(items: any[]) {
	if (tab.value !== 'current') return [];
	return items.filter(a => a.icon === 'maintenance' && !isPinned(a.id));
}

// 現在タブで「最新の通常お知らせ」(メンテナンス・ピン留め除く)
function latestItem(items: any[]): any | null {
	if (tab.value !== 'current') return null;
	// 旗鯖fork: 種類フィルター適用時はその種類に絞る (allなら全種類から最新)
	const nonMaint = items.filter(a => a.icon !== 'maintenance' && !isPinned(a.id) && (typeFilter.value === 'all' || a.icon === typeFilter.value));
	if (nonMaint.length === 0) return null;
	return nonMaint[0];
}

// カテゴリで items を抽出
// excludeFeatured = true なら、現在タブ用に「メンテナンス」「最新通常」「ピン留め」を除外
function categorize(items: any[], cat: CategoryKey, excludeFeatured: boolean) {
	const latest = latestItem(items);
	return items.filter(a => {
		if (a.icon !== cat) return false;
		if (excludeFeatured) {
			if (a.icon === 'maintenance') return false;
			if (latest && a.id === latest.id) return false;
			if (isPinned(a.id)) return false;
		}
		return true;
	});
}

async function read(target) {
	if (target.needConfirmationToRead) {
		const confirm = await os.confirm({
			type: 'question',
			title: i18n.ts._announcement.readConfirmTitle,
			text: i18n.tsx._announcement.readConfirmText({ title: target.title }),
		});
		if (confirm.canceled) return;
	}

	paginator.updateItem(target.id, a => ({
		...a,
		isRead: true,
	}));
	misskeyApi('i/read-announcement', { announcementId: target.id });
	updateCurrentAccount({
		unreadAnnouncements: $i!.unreadAnnouncements.filter(a => a.id !== target.id),
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'current',
	title: i18n.ts.currentAnnouncements,
	icon: 'ti ti-flare',
}, {
	key: 'past',
	title: i18n.ts.pastAnnouncements,
	icon: 'ti ti-point',
}]);

definePage(() => ({
	title: i18n.ts.announcements,
	icon: 'ti ti-speakerphone',
}));
</script>

<style lang="scss" module>
/* ===== セクションヘッダ ===== */
.sectionHeader {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 4px 4px 4px;
	margin-top: 8px;
	font-size: 13px;
	font-weight: 600;
	color: var(--MI_THEME-fg);
	opacity: 0.85;
}

.sectionIcon {
	font-size: 16px;
}

.sectionIconMaintenance {
	font-size: 18px;
	color: var(--MI_THEME-error);
}

.sectionIconLatest {
	font-size: 18px;
	color: var(--MI_THEME-accent);
}

.sectionIconPinned {
	font-size: 18px;
	color: #d28a3f;
}

.sectionTitle {
	flex: 1;
}

.sectionTitleMaintenance {
	flex: 1;
	color: var(--MI_THEME-error);
	font-weight: 700;
}

.sectionTitleLatest {
	flex: 1;
	color: var(--MI_THEME-accent);
}

.sectionTitlePinned {
	flex: 1;
	color: #d28a3f;
	font-weight: 700;
}

.sectionCount {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 22px;
	height: 22px;
	padding: 0 8px;
	background: rgba(127, 127, 127, 0.15);
	border-radius: 999px;
	font-size: 11px;
	font-weight: 600;
}

/* ===== お知らせカード ===== */
.announcement {
	position: relative;
	padding: 16px;
}

.maintenanceAnnouncement {
	border: 2px solid var(--MI_THEME-error);
	background: rgba(255, 42, 42, 0.04);
}

.latestAnnouncement {
	border: 1px solid var(--MI_THEME-accent);
	background: rgba(0, 122, 255, 0.03);
}

.pinnedAnnouncement {
	border: 1px solid #d28a3f;
	background: rgba(210, 138, 63, 0.05);
}

/* ===== ピン留めボタン ===== */
.pinToggleBtn {
	position: absolute;
	top: 10px;
	right: 10px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fg);
	opacity: 0.4;
	cursor: pointer;
	transition: opacity 0.1s, background 0.1s, color 0.1s;
	z-index: 1;
}

.pinToggleBtn:hover {
	opacity: 1;
	background: rgba(210, 138, 63, 0.15);
	color: #d28a3f;
}

/* ピン留め済み: 並び替え + 解除ボタン群 */
.pinnedControls {
	position: absolute;
	top: 10px;
	right: 10px;
	display: flex;
	align-items: center;
	gap: 4px;
	z-index: 1;
}

.pinControlBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: transparent;
	border: 1px solid rgba(210, 138, 63, 0.3);
	border-radius: 50%;
	color: #d28a3f;
	cursor: pointer;
	transition: opacity 0.1s, background 0.1s;
}

.pinControlBtn:hover:not(:disabled) {
	background: rgba(210, 138, 63, 0.15);
}

.pinControlBtn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.pinControlBtnUnpin {
	background: rgba(210, 138, 63, 0.15);
}

.pinControlBtnUnpin:hover {
	background: rgba(210, 138, 63, 0.3);
}

.forYou {
	display: flex;
	align-items: center;
	line-height: 24px;
	font-size: 90%;
	white-space: pre;
	color: #d28a3f;
}

.header {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
	padding-right: 50px; /* ピン留めボタン分の余白 */
	font-weight: bold;
	font-size: 120%;
}

.headerIcon {
	display: inline-flex;
}

.headerIconMaintenance {
	color: var(--MI_THEME-error);
	font-size: 1.2em;
}

.titleMaintenance {
	color: var(--MI_THEME-error);
}

.newBadge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 2px 8px;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent, #fff);
	border-radius: 999px;
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.05em;
}

.content > img {
	display: block;
	max-height: 300px;
	max-width: 100%;
}

.metadataLink {
	display: block;
	margin-top: 8px;
}

.metadata {
	opacity: 0.7;
	font-size: 85%;
}

.footer {
	margin-top: 16px;
}

/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
.htkPillTabs {
	position: sticky;
	top: 0;
	z-index: 50;
	display: flex;
	justify-content: center;
	padding: 12px 16px;
	background: var(--MI-page-controls-background, color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent));
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	margin-bottom: 8px;
}

.htkPillTabsInner {
	display: inline-flex;
	gap: 4px;
	padding: 4px;
	background: var(--MI-page-tabs-background, var(--MI_THEME-panel));
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	max-width: 100%;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
}

.htkPillTab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	font-weight: 500;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}

	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}

/* 旗鯖fork: 種類フィルター用の2段目ピル */
.htkPillTabsSub {
	position: static;
	padding-top: 0;
	padding-bottom: 4px;
	margin-bottom: 4px;
	backdrop-filter: none;
	-webkit-backdrop-filter: none;
	background: transparent;
}

.htkPillTabSm {
	padding: 4px 12px;
	font-size: 0.82em;
}
</style>
