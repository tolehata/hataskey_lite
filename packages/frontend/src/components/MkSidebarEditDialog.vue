<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: Hataskey UI サイドバーの編集モーダル。設定画面内のインライン編集 (自動保存) で
発生していた「保存されたか分からない」「サーバー間で同期されてるか不明」というユーザー声に
対応し、明示的な保存ボタン + 「保存しました」トースト + ドラッグ並び替えに対応する。
-->
<template>
<!-- 旗鯖fork: MkModalWindow (背面遮断・ページ遷移で閉じる) から MkWindow (フローティング・
     背面操作可・ドラッグ移動可) に変更。ユーザーが後ろのタイムラインを見ながら
     並び替えを試せるように。canResize=true でサイズ変更可、閉じるボタンあり。 -->
<MkWindow
	ref="dialog"
	:initialWidth="560"
	:initialHeight="720"
	:canResize="true"
	:closeButton="true"
	@closed="onWindowClosed"
>
	<template #header><i class="ti ti-menu-2" style="margin-right:.5em;"></i>{{ copy.title }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 16px; --MI_SPACER-max: 24px;">
		<div :class="$style.hint">
			<i class="ti ti-info-circle"></i>
			<div>
				{{ copy.hint }}<br>
				<b>{{ copy.syncHint }}</b>
			</div>
		</div>

		<draggable
			v-model="editedItems"
			:class="$style.list"
			itemKey="id"
			handle=".sidebarDragHandle"
			ghostClass="sidebarDragGhost"
			:animation="150"
			@change="onDragChange"
		>
			<template #item="{element: item, index}">
				<div :class="[$style.row, isVisible(item) ? '' : $style.rowHidden]">
					<button v-tooltip="copy.dragToReorder" :class="['sidebarDragHandle', $style.handle]" tabindex="-1">
						<i class="ti ti-grip-vertical"></i>
					</button>
					<div :class="$style.groupBadge" :data-group="groupOf(item)">{{ groupLabel(item) }}</div>
					<MkSwitch
						v-if="!isRequired(item.id)"
						:modelValue="isVisible(item)"
						:class="$style.toggle"
						@update:modelValue="setVisible(index, $event)"
					/>
					<span v-else v-tooltip="copy.alwaysVisible" :class="$style.requiredLock">
						<i class="ti ti-lock"></i>
					</span>
					<i :class="[applyIconOverride(item), $style.icon]"></i>
					<span :class="$style.label">{{ itemDisplayLabel(item) }}</span>
				</div>
			</template>
		</draggable>
	</div>

	<!-- 旗鯖fork: MkWindow は #footer スロットを持たないため、body 末尾に footer を配置 -->
	<div :class="$style.footer">
		<MkButton :class="$style.resetBtn" @click="resetToDefault"><i class="ti ti-restore"></i> {{ copy.resetDefaults }}</MkButton>
		<div :class="$style.footerRight">
			<MkButton @click="closeWithoutSave">{{ copy.cancel }}</MkButton>
			<MkButton primary :disabled="!hasChanges" @click="save"><i class="ti ti-device-floppy"></i> {{ copy.save }}</MkButton>
		</div>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { ref, computed, useTemplateRef } from 'vue';
import draggable from 'vuedraggable';
import MkWindow from '@/components/MkWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { prefer } from '@/preferences.js';
import { PREF_DEF } from '@/preferences/def.js';
import { applySidebarIconOverride as applyIconOverride } from '@/utility/sidebar-icon-overrides.js';
import { normalizeHatagoesSidebar } from '@/utility/hatagoes-sidebar.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._sidebarEditor;

// 旗鯖fork: 常時表示 (ON/OFF 不可) な項目。並び替えは可能。
const REQUIRED_IDS = new Set(['timeline', 'notifications', 'externalNotifications', 'announcements', 'followRequests', 'more']);

// 旗鯖fork: グループラベル (バッジ表示用)。group 越えドラッグで自動更新するため、idx に依らず item.group ベースで参照。
const GROUP_LABELS: Record<string, string> = {
	basic: copy.groupBasic,
	hata: copy.groupCustom,
	discover: copy.groupDiscover,
	more: copy.groupOther,
};

// 保存済みの label は互換性のため変更せず、既定項目だけ表示時に翻訳する。
const ITEM_LABELS: Record<string, string> = {
	timeline: copy.itemTimeline,
	search: copy.itemSearch,
	notifications: copy.itemNotifications,
	externalNotifications: copy.itemExternalNotifications,
	chat: copy.itemMessages,
	announcements: copy.itemAnnouncements,
	drive: copy.itemDrive,
	favorites: copy.itemFavorites,
	hatagoes: 'HataGoes',
	uiSetup: copy.itemUiSetup,
	explore: copy.itemExplore,
	followRequests: copy.itemFollowRequests,
	channels: copy.itemChannels,
	more: copy.itemMore,
	reload: copy.itemReload,
	cacheClear: copy.itemClearCache,
};

const REMOVED_SIDEBAR_IDS = new Set(['portal']);

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'done', value: { saved: boolean }): void;
}>();

const dialog = useTemplateRef('dialog');

// 編集前の値を deep clone (キャンセル時の比較・破棄用)
const initialSnapshot = JSON.stringify(normalizeHatagoesSidebar((prefer.s['simpleUi.sidebar'] ?? []).filter(item => !REMOVED_SIDEBAR_IDS.has(item?.id))));
const editedItems = ref<any[]>(JSON.parse(initialSnapshot));

const hasChanges = computed(() => JSON.stringify(editedItems.value) !== initialSnapshot);

function groupOf(item: any): string {
	return (item?.group ?? 'basic') as string;
}

function groupLabel(item: any): string {
	return GROUP_LABELS[groupOf(item)] ?? groupOf(item);
}

function itemDisplayLabel(item: any): string {
	return ITEM_LABELS[item?.id] ?? item?.label ?? item?.id ?? '';
}

function isRequired(id: string): boolean {
	return REQUIRED_IDS.has(id);
}

function isVisible(item: any): boolean {
	if (isRequired(item.id)) return true;
	return item.visible !== false;
}

function setVisible(index: number, visible: boolean) {
	const item = editedItems.value[index];
	if (isRequired(item.id)) return;
	editedItems.value[index] = { ...item, visible };
}

// 旗鯖fork: グループ越えドラッグ後、隣接項目の group を引き継いで自動的に書き換える。
//   ドラッグ完了後の vuedraggable の change イベントで、移動先 index の前後の group から
//   最も近い group を新 group として採用する。
function onDragChange(_evt: any) {
	const list = editedItems.value;
	for (let i = 0; i < list.length; i++) {
		const it = list[i];
		const prev = list[i - 1];
		const next = list[i + 1];
		const prevG = prev ? groupOf(prev) : null;
		const nextG = next ? groupOf(next) : null;
		// 前後どちらも同じグループならその group に合わせる
		if (prevG && nextG && prevG === nextG && groupOf(it) !== prevG) {
			list[i] = { ...it, group: prevG };
			continue;
		}
		// 片方しか隣接しない (両端) ならその group に合わせる
		if (prevG && !nextG && groupOf(it) !== prevG) {
			list[i] = { ...it, group: prevG };
			continue;
		}
		if (!prevG && nextG && groupOf(it) !== nextG) {
			list[i] = { ...it, group: nextG };
			continue;
		}
		// 前後でグループが異なる場合は移動した本人の group を「前項目の group」に合わせる
		// (ユーザーがドラッグした直感に近い: 上の塊に追加された認識)
		if (prevG && nextG && prevG !== nextG && groupOf(it) !== prevG && groupOf(it) !== nextG) {
			list[i] = { ...it, group: prevG };
		}
	}
}

async function resetToDefault() {
	const c = await os.confirm({
		type: 'warning',
		title: copy.resetDefaults,
		text: copy.resetConfirm,
	});
	if (c.canceled) return;
	const def = PREF_DEF['simpleUi.sidebar'].default as any[];
	editedItems.value = JSON.parse(JSON.stringify(normalizeHatagoesSidebar(def)));
}

async function save() {
	if (!hasChanges.value) {
		dialog.value?.close();
		return;
	}
	try {
		await prefer.commit('simpleUi.sidebar', JSON.parse(JSON.stringify(normalizeHatagoesSidebar(editedItems.value))));
		os.toast(copy.saved);
		emit('done', { saved: true });
		dialog.value?.close();
	} catch (err) {
		os.alert({
			type: 'error',
			title: copy.saveFailed,
			text: copy.tryAgain + (err instanceof Error ? `\n\n${copy.details}: ${err.message}` : ''),
		});
	}
}

async function closeWithoutSave() {
	if (hasChanges.value) {
		const c = await os.confirm({
			type: 'warning',
			title: copy.discardTitle,
			text: copy.discardText,
		});
		if (c.canceled) return;
	}
	emit('done', { saved: false });
	dialog.value?.close();
}

// 旗鯖fork: MkWindow の close ボタン (X) やエスケープキーで閉じられた時に呼ばれる。
//   MkWindow は「開いたまま裏で作業できる」性質のため、閉じる際の未保存確認は行わない
//   (ユーザーは意識的に閉じる)。done(saved: false) だけ emit する。
function onWindowClosed() {
	emit('done', { saved: false });
	emit('closed');
}
</script>

<style lang="scss" module>
.hint {
	display: flex;
	gap: 10px;
	padding: 12px 14px;
	border-radius: 12px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-fg);
	font-size: .84em;
	line-height: 1.55;
	margin-bottom: 16px;

	> i {
		flex-shrink: 0;
		color: var(--MI_THEME-accent);
		font-size: 1.15em;
		margin-top: 2px;
	}
}

.list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	transition: opacity .15s, border-color .15s;
}
.rowHidden { opacity: .42; }

.handle {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	background: none;
	color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg));
	cursor: grab;
	border-radius: 8px;
	flex-shrink: 0;

	&:hover { background: var(--MI_THEME-bg); }
	&:active { cursor: grabbing; }
}

.groupBadge {
	flex-shrink: 0;
	min-width: 2.6em;
	text-align: center;
	font-size: .7em;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--MI_THEME-bg);
	color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg));
	border: 1px solid var(--MI_THEME-divider);
}
.groupBadge[data-group="basic"]    { background: #e1efff; color: #2b6fc0; border-color: transparent; }
.groupBadge[data-group="hata"]     { background: #ffe1ef; color: #c02b6f; border-color: transparent; }
.groupBadge[data-group="discover"] { background: #e1ffea; color: #1f8a5b; border-color: transparent; }
.groupBadge[data-group="more"]     { background: #efefef; color: #666;   border-color: transparent; }

.toggle {
	flex-shrink: 0;
	transform: scale(.85);
	transform-origin: left center;
	margin: 0;
}
.requiredLock {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 999px;
	background: var(--MI_THEME-bg);
	color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg));
	flex-shrink: 0;
	font-size: .85em;
}

.icon {
	font-size: 1.1em;
	color: var(--MI_THEME-fg);
	flex-shrink: 0;
	width: 1.4em;
	text-align: center;
}

.label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border-top: 1px solid var(--MI_THEME-divider);
	flex-wrap: wrap;
}
.resetBtn { font-size: .85em; }
.footerRight {
	display: flex;
	gap: 8px;
	margin-left: auto;
}
</style>

<style>
/* 旗鯖fork: vuedraggable の ghost クラスは scoped CSS Modules では当たらないため global で定義 */
.sidebarDragGhost {
	opacity: .35;
	background: var(--MI_THEME-accentedBg) !important;
}
</style>
